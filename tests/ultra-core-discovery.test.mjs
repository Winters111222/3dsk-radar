import test from "node:test";
import assert from "node:assert/strict";
import { createUltraCoreDiscoveryExecutor } from "../src/server/ultra-core-discovery.mjs";
import {
  ULTRA_CORE_DISCOVERY_SHARD_IDS,
  ULTRA_CORE_DISCOVERY_SHARDS,
  ULTRA_CORE_MAX_RESULTS,
  ULTRA_CORE_OPENAI_REQUEST_LIMIT,
  ULTRA_CORE_TOTAL_TOOL_CALL_LIMIT,
  validateUltraCoreDiscoveryPlan
} from "../src/server/ultra-core-discovery-plan.mjs";
import { ultraMaxNextOperationId } from "../src/server/ultra-max-run-contract.mjs";
import { executeUltraMaxPhase, startUltraMaxRun } from "../src/server/ultra-max-run-service.mjs";
import { createStateRepository } from "../src/server/state-repository.mjs";
import { memoryPaidCoordinator } from "./helpers/memory-paid-coordinator.mjs";
import { memoryStore } from "./helpers/memory-store.mjs";

const NOW="2026-09-08T18:00:00.000Z";
const PROFILE={capabilities:[],credentials:[]};

function searchResult(overrides={}) {
  return {
    attempts:1,
    openai_request_count:ULTRA_CORE_OPENAI_REQUEST_LIMIT,
    web_search_call_count:22,
    model:"gpt-5.6-luna",
    usage:{input_tokens:11_000,output_tokens:2_200,input_tokens_details:{cached_tokens:0}},
    search_status:"COMPLETE",
    records:[{id:"record-core-1"}],
    opportunities:[{id:"record-core-1"}],
    coverage:ULTRA_CORE_DISCOVERY_SHARDS.map((shard)=>({shard_id:shard.id,status:"COMPLETE"})),
    diagnostics:{source_yield:[]},
    response_ids:ULTRA_CORE_DISCOVERY_SHARDS.map((_,index)=>`resp_${index}`),
    counters:{candidates_seen:17},
    ...overrides
  };
}

async function rootAfterNative(repository) {
  const started=await startUltraMaxRun({repository,requestId:"request_ultra_core",runId:"ultra-root-core-001",nowIso:NOW});
  const operationId=ultraMaxNextOperationId(started.run,"NATIVE_COLLECTION");
  const completed=await executeUltraMaxPhase({repository,runId:started.run.run_id,phaseId:"NATIVE_COLLECTION",operationId,nowIso:NOW,execute:async()=>({complete:true,usage:{}})});
  return completed.run;
}

test("CORE_DISCOVERY owns eleven non-procurement buyer shards with exact request caps", () => {
  assert.equal(validateUltraCoreDiscoveryPlan(),true);
  assert.equal(ULTRA_CORE_DISCOVERY_SHARDS.length,11);
  assert.equal(ULTRA_CORE_OPENAI_REQUEST_LIMIT,11);
  assert.equal(ULTRA_CORE_TOTAL_TOOL_CALL_LIMIT,33);
  assert.equal(ULTRA_CORE_MAX_RESULTS,40);
  assert.deepEqual(ULTRA_CORE_DISCOVERY_SHARDS.map((item)=>item.id),ULTRA_CORE_DISCOVERY_SHARD_IDS);
  assert.equal(ULTRA_CORE_DISCOVERY_SHARD_IDS.some((id)=>/grant|funding|multilingual|backfill/i.test(id)),false);
  assert.equal(validateUltraCoreDiscoveryPlan(ULTRA_CORE_DISCOVERY_SHARDS.slice(1)),false);
});

test("CORE executor persists paid coordinator version and root usage without retry", async () => {
  const repository=createStateRepository(memoryStore());
  const coordinator=memoryPaidCoordinator({capMicrousd:15_000_000,lifecycleMode:"MULTI_OPERATION"});
  const root=await rootAfterNative(repository);
  let calls=0;
  const executor=createUltraCoreDiscoveryExecutor({coordinator,apiKey:"test-key",profile:PROFILE,nowIso:NOW,searchRunner:async(input)=>{
    calls+=1;
    assert.deepEqual(input.shards.map((item)=>item.id),ULTRA_CORE_DISCOVERY_SHARD_IDS);
    assert.equal(input.maxResults,40);
    assert.equal(input.maxToolCallsPerShard,3);
    return searchResult();
  }});
  const operationId=ultraMaxNextOperationId(root,"CORE_DISCOVERY");
  const completed=await executeUltraMaxPhase({repository,runId:root.run_id,phaseId:"CORE_DISCOVERY",operationId,nowIso:NOW,execute:executor});
  assert.equal(calls,1);
  assert.equal(completed.run.plan_snapshot.phases[1].status,"COMPLETED");
  assert.equal(completed.run.paid_coordinator_version,4);
  assert.equal(completed.run.usage.openai_requests,11);
  assert.equal(completed.run.usage.web_search_calls,22);
  assert.equal(completed.run.usage.candidates_seen,17);
  assert.equal(completed.run.usage.results_accepted,1);
  const replay=await executeUltraMaxPhase({repository,runId:root.run_id,phaseId:"CORE_DISCOVERY",operationId,nowIso:NOW,execute:async()=>{calls+=1;}});
  assert.equal(replay.replayed,true);
  assert.equal(calls,1);
});

test("CORE request overflow becomes UNCERTAIN without a second dispatch", async () => {
  const repository=createStateRepository(memoryStore());
  const coordinator=memoryPaidCoordinator({capMicrousd:15_000_000,lifecycleMode:"MULTI_OPERATION"});
  const root=await rootAfterNative(repository);
  let calls=0;
  const executor=createUltraCoreDiscoveryExecutor({coordinator,apiKey:"test-key",profile:PROFILE,nowIso:NOW,searchRunner:async()=>{calls+=1;return searchResult({openai_request_count:12});}});
  const operationId=ultraMaxNextOperationId(root,"CORE_DISCOVERY");
  await assert.rejects(()=>executeUltraMaxPhase({repository,runId:root.run_id,phaseId:"CORE_DISCOVERY",operationId,nowIso:NOW,execute:executor}),/ULTRA_PAID_DISPATCH_UNCERTAIN/);
  assert.equal(calls,1);
  assert.equal((await repository.getUltraMaxRun(root.run_id)).status,"UNCERTAIN");
  assert.equal(coordinator.runs.get(root.run_id).status,"UNCERTAIN");
  const replay=await executeUltraMaxPhase({repository,runId:root.run_id,phaseId:"CORE_DISCOVERY",operationId,nowIso:NOW,execute:async()=>{calls+=1;}});
  assert.equal(replay.replayed,true);
  assert.equal(calls,1);
});
