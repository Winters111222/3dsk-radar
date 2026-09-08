import test from "node:test";
import assert from "node:assert/strict";
import { PAID_COORDINATOR_REQUIRED_CAPABILITIES, paidCoordinatorReadiness, ultraPaidCoordinatorReadiness } from "../src/server/paid-run-coordinator-contract.mjs";
import { createPostgresPaidCoordinator } from "../src/server/paid-run-coordinator-netlify-db.mjs";
import { memoryPaidCoordinator } from "./helpers/memory-paid-coordinator.mjs";

test("paid coordinator stays locked without every atomic capability", () => {
  const readiness = paidCoordinatorReadiness({ capabilities:{ atomic_compare_and_swap:true } });
  assert.equal(readiness.ready, false);
  assert.equal(readiness.paid_execution, "LOCKED");
  assert.ok(readiness.missing.includes("transactional_budget_reservation"));
  assert.ok(readiness.missing.includes("claimOperation(runId, operationId, expectedVersion)"));
});

test("Netlify Database coordinator advertises the complete contract before any query", () => {
  const provider = createPostgresPaidCoordinator({ pool:{ connect() { throw new Error("not queried"); } } });
  const readiness = paidCoordinatorReadiness(provider);
  assert.equal(readiness.ready, true);
  assert.equal(typeof provider.completeOperation, "function");
  assert.equal(typeof provider.markUncertain, "function");
  assert.equal(typeof provider.readOperation, "function");
});

test("Netlify Database coordinator exposes read-only operation state without a transaction", async () => {
  const queries = [];
  const client = {
    async query(sql) {
      queries.push(sql);
      if (sql.includes("FROM radar_paid_runs")) return { rows:[{ run_id:"prod-wide-index-search-20260906", status:"RESERVED", lifecycle_mode:"SINGLE_OPERATION", version:2, fence_token:1, cap_microusd:2_000_000, reserved_microusd:2_000_000, settled_microusd:0, updated_at:"2026-09-06T14:00:00.000Z" }] };
      if (sql.includes("FROM radar_paid_operations")) return { rows:[{ operation_id:"daily-wide-index-search", status:"CLAIMED", version:1, fence_token:1, error_code:null, completed_at:null }] };
      return { rows:[] };
    },
    release() {}
  };
  const provider = createPostgresPaidCoordinator({ pool:{ async connect() { return client; } }, capMicrousd:2_000_000 });
  const state = await provider.readOperation("prod-wide-index-search-20260906", "daily-wide-index-search");
  assert.equal(state.run_status, "RESERVED");
  assert.equal(state.operation_status, "CLAIMED");
  assert.equal(state.reserved_microusd, 2_000_000);
  assert.equal(state.updated_at, "2026-09-06T14:00:00.000Z");
  assert.ok(!queries.includes("BEGIN ISOLATION LEVEL SERIALIZABLE"));
});

test("Netlify Database coordinator can replay an existing paid operation without mutation", async () => {
  const queries = [];
  const client = {
    async query(sql) {
      queries.push(sql);
      if (sql.includes("FROM radar_paid_runs")) return { rows:[{ run_id:"paid-run-001", status:"COMPLETED", lifecycle_mode:"SINGLE_OPERATION", version:4, fence_token:1, cap_microusd:500_000 }] };
      if (sql.includes("FROM radar_paid_operations")) return { rows:[{ operation_id:"focused-search", status:"COMPLETED", version:4, fence_token:1, result_json:{ ok:true } }] };
      return { rows:[] };
    },
    release() {}
  };
  const provider = createPostgresPaidCoordinator({ pool:{ async connect() { return client; } } });
  const replay = await provider.claimOperation("paid-run-001", "focused-search", 0);
  assert.equal(replay.replayed, true);
  assert.deepEqual(replay.result, { ok:true });
  assert.ok(queries.some((sql) => sql === "COMMIT"));
});

test("ULTRA readiness requires an explicit multi-operation lifecycle", () => {
  assert.equal(ultraPaidCoordinatorReadiness(memoryPaidCoordinator()).ready,false);
  const ready = ultraPaidCoordinatorReadiness(memoryPaidCoordinator({capMicrousd:15_000_000,lifecycleMode:"MULTI_OPERATION"}));
  assert.deepEqual(ready,{contract_version:1,ready:true,paid_execution:"READY_FOR_ULTRA_INTEGRATION",missing:[]});
});

test("multi-operation coordinator completes successive child operations under one cumulative root cap", async () => {
  const coordinator = memoryPaidCoordinator({capMicrousd:1_000_000,lifecycleMode:"MULTI_OPERATION"});
  let version = 0;
  for (const [index,actual] of [300_000,200_000].entries()) {
    const operationId = `ultra-child-${index + 1}`;
    const claim = await coordinator.claimOperation("ultra-root-001",operationId,version);
    const reservation = await coordinator.reserveBudget("ultra-root-001",`ultra-budget-${index + 1}`,400_000,claim.version);
    const settlement = await coordinator.settleBudget("ultra-root-001",`ultra-budget-${index + 1}`,actual,reservation.fence_token);
    const completed = await coordinator.completeOperation("ultra-root-001",operationId,{index},settlement.fence_token);
    assert.equal(completed.run_status,"READY");
    version = completed.version;
  }
  const run = coordinator.runs.get("ultra-root-001");
  assert.equal(run.settled,500_000);
  assert.equal(run.operations.size,2);
  assert.equal(run.status,"READY");
  const claim = await coordinator.claimOperation("ultra-root-001","ultra-child-3",version);
  await assert.rejects(() => coordinator.reserveBudget("ultra-root-001","ultra-budget-3",600_000,claim.version),/PAID_COORDINATOR_BUDGET_CAP_EXCEEDED/);
});

test("two concurrent ULTRA child claims have exactly one winner", async () => {
  const coordinator = memoryPaidCoordinator({capMicrousd:1_000_000,lifecycleMode:"MULTI_OPERATION"});
  const outcomes = await Promise.allSettled([
    coordinator.claimOperation("ultra-root-race","ultra-child-a",0),
    coordinator.claimOperation("ultra-root-race","ultra-child-b",0)
  ]);
  assert.equal(outcomes.filter((item)=>item.status==="fulfilled").length,1);
  assert.equal(outcomes.filter((item)=>item.status==="rejected").length,1);
  assert.equal(coordinator.runs.get("ultra-root-race").operations.size,1);
});

test("coordinator contract requires CAS, fencing, uniqueness and transactional budget settlement", () => {
  const capabilities = Object.fromEntries(PAID_COORDINATOR_REQUIRED_CAPABILITIES.map((name) => [name, true]));
  const readiness = paidCoordinatorReadiness({
    capabilities,
    claimOperation() {},
    reserveBudget() {},
    settleBudget() {}
  });
  assert.deepEqual(readiness, { contract_version:1, ready:true, paid_execution:"READY_FOR_INTEGRATION", missing:[] });
});
