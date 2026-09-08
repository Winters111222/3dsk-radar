import test from "node:test";
import assert from "node:assert/strict";
import { createUltraMaxRun, completeUltraMaxPhase, beginUltraMaxPhase } from "../src/server/ultra-max-run-contract.mjs";
import { executeUltraPaidChild } from "../src/server/ultra-paid-operation-service.mjs";
import { memoryPaidCoordinator } from "./helpers/memory-paid-coordinator.mjs";

const NOW = "2026-09-08T17:00:00.000Z";

function coreRun() {
  let run = createUltraMaxRun({requestId:"request_paid_ultra",runId:"ultra-root-paid-001",nowIso:NOW});
  run = beginUltraMaxPhase(run,"NATIVE_COLLECTION",NOW);
  run = completeUltraMaxPhase(run,"NATIVE_COLLECTION",NOW);
  return run;
}

test("ULTRA paid child reserves before exactly one dispatch and returns the next coordinator version", async () => {
  const coordinator = memoryPaidCoordinator({capMicrousd:15_000_000,lifecycleMode:"MULTI_OPERATION"});
  const run = coreRun();
  const operationId = `${run.plan_snapshot.phases[1].operation_id}-chunk-0001`;
  let calls = 0;
  const result = await executeUltraPaidChild({coordinator,run,phaseId:"CORE_DISCOVERY",operationId,expectedVersion:0,dispatch:async ({reservationId}) => {
    calls += 1;
    assert.equal(coordinator.runs.get(run.run_id).status,"RESERVED");
    assert.match(reservationId,/ultra-budget-2-.+-chunk-0001/);
    return {usage:{cost_microusd:1_250_000,openai_requests:5,web_search_calls:15},payload:{records:3}};
  }});
  assert.equal(calls,1);
  assert.equal(result.coordinator_version,4);
  assert.equal(result.run_status,"READY");
  assert.equal(coordinator.runs.get(run.run_id).settled,1_250_000);
});

test("replaying a completed child returns its stored result without dispatch", async () => {
  const coordinator = memoryPaidCoordinator({capMicrousd:15_000_000,lifecycleMode:"MULTI_OPERATION"});
  const run = coreRun();
  const operationId = `${run.plan_snapshot.phases[1].operation_id}-chunk-0001`;
  const input = {coordinator,run,phaseId:"CORE_DISCOVERY",operationId,expectedVersion:0};
  await executeUltraPaidChild({...input,dispatch:async()=>({usage:{cost_microusd:100},payload:{records:1}})});
  let calls = 0;
  const replay = await executeUltraPaidChild({...input,dispatch:async()=>{calls+=1;}});
  assert.equal(replay.replayed,true);
  assert.equal(replay.result.payload.records,1);
  assert.equal(calls,0);
});

test("an ambiguous paid failure makes the root UNCERTAIN and cannot be redispatched", async () => {
  const coordinator = memoryPaidCoordinator({capMicrousd:15_000_000,lifecycleMode:"MULTI_OPERATION"});
  const run = coreRun();
  const operationId = `${run.plan_snapshot.phases[1].operation_id}-chunk-0001`;
  let calls = 0;
  const execute = () => executeUltraPaidChild({coordinator,run,phaseId:"CORE_DISCOVERY",operationId,expectedVersion:0,dispatch:async()=>{calls+=1;throw new Error("transport lost");}});
  await assert.rejects(execute,/ULTRA_PAID_DISPATCH_UNCERTAIN/);
  await assert.rejects(execute,/ULTRA_PAID_OPERATION_REPLAY_UNCERTAIN|PAID_COORDINATOR_RUN_TERMINAL/);
  assert.equal(calls,1);
  assert.equal(coordinator.runs.get(run.run_id).status,"UNCERTAIN");
});

test("locked coordinator and altered operation identity fail before dispatch", async () => {
  const run = coreRun();
  let calls = 0;
  const dispatch = async()=>{calls+=1;};
  await assert.rejects(()=>executeUltraPaidChild({coordinator:memoryPaidCoordinator(),run,phaseId:"CORE_DISCOVERY",operationId:"changed-operation",expectedVersion:0,dispatch}),/ULTRA_PAID_COORDINATOR_LOCKED/);
  const coordinator = memoryPaidCoordinator({capMicrousd:15_000_000,lifecycleMode:"MULTI_OPERATION"});
  await assert.rejects(()=>executeUltraPaidChild({coordinator,run,phaseId:"CORE_DISCOVERY",operationId:"changed-operation",expectedVersion:0,dispatch}),/ULTRA_PAID_OPERATION_ID_MISMATCH/);
  assert.equal(calls,0);
});

test("root cap mismatch fails before claim and phase usage overflow becomes terminal uncertain", async () => {
  const run = coreRun();
  const operationId = `${run.plan_snapshot.phases[1].operation_id}-chunk-0001`;
  let calls = 0;
  await assert.rejects(()=>executeUltraPaidChild({coordinator:memoryPaidCoordinator({capMicrousd:14_000_000,lifecycleMode:"MULTI_OPERATION"}),run,phaseId:"CORE_DISCOVERY",operationId,expectedVersion:0,dispatch:async()=>{calls+=1;}}),/ULTRA_PAID_ROOT_CAP_MISMATCH/);
  assert.equal(calls,0);
  const coordinator = memoryPaidCoordinator({capMicrousd:15_000_000,lifecycleMode:"MULTI_OPERATION"});
  await assert.rejects(()=>executeUltraPaidChild({coordinator,run,phaseId:"CORE_DISCOVERY",operationId,expectedVersion:0,dispatch:async()=>{calls+=1;return{usage:{cost_microusd:1,openai_requests:21}};}}),/ULTRA_PAID_DISPATCH_UNCERTAIN/);
  assert.equal(calls,1);
  assert.equal(coordinator.runs.get(run.run_id).status,"UNCERTAIN");
  assert.equal(coordinator.runs.get(run.run_id).settled,0);
});
