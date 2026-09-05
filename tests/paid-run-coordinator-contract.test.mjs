import test from "node:test";
import assert from "node:assert/strict";
import { PAID_COORDINATOR_REQUIRED_CAPABILITIES, paidCoordinatorReadiness } from "../src/server/paid-run-coordinator-contract.mjs";
import { createPostgresPaidCoordinator } from "../src/server/paid-run-coordinator-netlify-db.mjs";

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
});

test("Netlify Database coordinator can replay an existing paid operation without mutation", async () => {
  const queries = [];
  const client = {
    async query(sql) {
      queries.push(sql);
      if (sql.includes("FROM radar_paid_runs")) return { rows:[{ run_id:"paid-run-001", status:"COMPLETED", version:4, fence_token:1, cap_microusd:500_000 }] };
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
