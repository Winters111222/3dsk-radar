import test from "node:test";
import assert from "node:assert/strict";
import { createUltraCoreDiscoveryExecutor } from "../src/server/ultra-core-discovery.mjs";
import { ULTRA_CORE_DISCOVERY_SHARD_IDS } from "../src/server/ultra-core-discovery-plan.mjs";
import { createUltraMultilingualLongTailExecutor } from "../src/server/ultra-multilingual-long-tail.mjs";
import {
  ULTRA_MULTILINGUAL_LONG_TAIL_MAX_RESULTS,
  ULTRA_MULTILINGUAL_LONG_TAIL_OPENAI_REQUEST_LIMIT,
  ULTRA_MULTILINGUAL_LONG_TAIL_SHARD_IDS,
  ULTRA_MULTILINGUAL_LONG_TAIL_SHARDS,
  ULTRA_MULTILINGUAL_LONG_TAIL_TOTAL_TOOL_CALL_LIMIT,
  validateUltraMultilingualLongTailPlan
} from "../src/server/ultra-multilingual-long-tail-plan.mjs";
import { createUltraProcurementFundingExecutor } from "../src/server/ultra-procurement-funding.mjs";
import { ULTRA_PROCUREMENT_FUNDING_SHARD_IDS } from "../src/server/ultra-procurement-funding-plan.mjs";
import { ultraMaxNextOperationId } from "../src/server/ultra-max-run-contract.mjs";
import { executeUltraMaxPhase, startUltraMaxRun } from "../src/server/ultra-max-run-service.mjs";
import { createStateRepository } from "../src/server/state-repository.mjs";
import { memoryPaidCoordinator } from "./helpers/memory-paid-coordinator.mjs";
import { memoryStore } from "./helpers/memory-store.mjs";

const NOW="2026-09-08T20:00:00.000Z";
const PROFILE={capabilities:[],credentials:[]};

function searchResult(shards,{webCalls=shards.length*2,id="record",overrides={}}={}) {
  return {
    attempts:1,
    openai_request_count:shards.length,
    web_search_call_count:webCalls,
    model:"gpt-5.6-luna",
    usage:{input_tokens:10_000,output_tokens:2_000,input_tokens_details:{cached_tokens:0}},
    search_status:"COMPLETE",
    records:[{id}],
    opportunities:[{id}],
    coverage:shards.map((shard)=>({shard_id:shard.id,status:"COMPLETE"})),
    diagnostics:{source_yield:[]},
    response_ids:shards.map((_,index)=>`resp_${id}_${index}`),
    counters:{candidates_seen:10},
    ...overrides
  };
}

async function executeHostedPhase({repository,coordinator,run,phaseId,createExecutor}) {
  const executor=createExecutor({coordinator,apiKey:"test-key",profile:PROFILE,nowIso:NOW,searchRunner:async(input)=>searchResult(input.shards,{id:`record-${phaseId}`} )});
  const operationId=ultraMaxNextOperationId(run,phaseId);
  return (await executeUltraMaxPhase({repository,runId:run.run_id,phaseId,operationId,nowIso:NOW,execute:executor})).run;
}

async function rootAfterProcurement(repository,coordinator) {
  const started=await startUltraMaxRun({repository,requestId:"request_ultra_multilingual",runId:"ultra-root-multilingual",nowIso:NOW});
  let run=(await executeUltraMaxPhase({repository,runId:started.run.run_id,phaseId:"NATIVE_COLLECTION",operationId:ultraMaxNextOperationId(started.run,"NATIVE_COLLECTION"),nowIso:NOW,execute:async()=>({complete:true,usage:{}})})).run;
  run=await executeHostedPhase({repository,coordinator,run,phaseId:"CORE_DISCOVERY",createExecutor:createUltraCoreDiscoveryExecutor});
  return executeHostedPhase({repository,coordinator,run,phaseId:"PROCUREMENT_FUNDING",createExecutor:createUltraProcurementFundingExecutor});
}

test("MULTILINGUAL_LONG_TAIL owns five language and active-backfill shards without overlap", () => {
  assert.equal(validateUltraMultilingualLongTailPlan(),true);
  assert.equal(ULTRA_MULTILINGUAL_LONG_TAIL_SHARDS.length,5);
  assert.equal(ULTRA_MULTILINGUAL_LONG_TAIL_OPENAI_REQUEST_LIMIT,5);
  assert.equal(ULTRA_MULTILINGUAL_LONG_TAIL_TOTAL_TOOL_CALL_LIMIT,15);
  assert.equal(ULTRA_MULTILINGUAL_LONG_TAIL_MAX_RESULTS,30);
  assert.deepEqual(ULTRA_MULTILINGUAL_LONG_TAIL_SHARDS.map((item)=>item.id),ULTRA_MULTILINGUAL_LONG_TAIL_SHARD_IDS);
  const prior=new Set([...ULTRA_CORE_DISCOVERY_SHARD_IDS,...ULTRA_PROCUREMENT_FUNDING_SHARD_IDS]);
  assert.deepEqual(ULTRA_MULTILINGUAL_LONG_TAIL_SHARD_IDS.filter((id)=>prior.has(id)),[]);
  assert.equal(validateUltraMultilingualLongTailPlan([...ULTRA_MULTILINGUAL_LONG_TAIL_SHARDS].reverse()),false);

  const focus=ULTRA_MULTILINGUAL_LONG_TAIL_SHARDS.map((item)=>item.focus).join(" ");
  for (const language of ["English","German","French","Spanish","Italian","Portuguese","Polish","Czech","Slovak"]) assert.match(focus,new RegExp(language));
  assert.match(focus,/31 to 90 days/);
  assert.match(focus,/explicitly proves that proposals are still accepted now/);
});

test("MULTILINGUAL_LONG_TAIL settles as the third paid child and replays without redispatch", async () => {
  const repository=createStateRepository(memoryStore());
  const coordinator=memoryPaidCoordinator({capMicrousd:15_000_000,lifecycleMode:"MULTI_OPERATION"});
  const run=await rootAfterProcurement(repository,coordinator);
  assert.equal(run.paid_coordinator_version,8);
  let calls=0;
  const executor=createUltraMultilingualLongTailExecutor({coordinator,apiKey:"test-key",profile:PROFILE,nowIso:NOW,searchRunner:async(input)=>{
    calls+=1;
    assert.deepEqual(input.shards.map((item)=>item.id),ULTRA_MULTILINGUAL_LONG_TAIL_SHARD_IDS);
    assert.equal(input.searchProfile,"ULTRA_MULTILINGUAL_LONG_TAIL");
    assert.equal(input.maxResults,30);
    assert.equal(input.maxToolCallsPerShard,3);
    return searchResult(input.shards,{webCalls:10,id:"record-multilingual"});
  }});
  const operationId=ultraMaxNextOperationId(run,"MULTILINGUAL_LONG_TAIL");
  const completed=await executeUltraMaxPhase({repository,runId:run.run_id,phaseId:"MULTILINGUAL_LONG_TAIL",operationId,nowIso:NOW,execute:executor});
  assert.equal(calls,1);
  assert.equal(completed.run.plan_snapshot.phases[3].status,"COMPLETED");
  assert.equal(completed.run.paid_coordinator_version,12);
  assert.equal(completed.run.usage.openai_requests,25);
  assert.equal(completed.run.usage.web_search_calls,50);
  const replay=await executeUltraMaxPhase({repository,runId:run.run_id,phaseId:"MULTILINGUAL_LONG_TAIL",operationId,nowIso:NOW,execute:async()=>{calls+=1;}});
  assert.equal(replay.replayed,true);
  assert.equal(calls,1);
});

test("MULTILINGUAL_LONG_TAIL rejects a hidden retry and becomes UNCERTAIN", async () => {
  const repository=createStateRepository(memoryStore());
  const coordinator=memoryPaidCoordinator({capMicrousd:15_000_000,lifecycleMode:"MULTI_OPERATION"});
  const run=await rootAfterProcurement(repository,coordinator);
  let calls=0;
  const executor=createUltraMultilingualLongTailExecutor({coordinator,apiKey:"test-key",profile:PROFILE,nowIso:NOW,searchRunner:async(input)=>{
    calls+=1;
    return searchResult(input.shards,{overrides:{attempts:2}});
  }});
  const operationId=ultraMaxNextOperationId(run,"MULTILINGUAL_LONG_TAIL");
  await assert.rejects(()=>executeUltraMaxPhase({repository,runId:run.run_id,phaseId:"MULTILINGUAL_LONG_TAIL",operationId,nowIso:NOW,execute:executor}),/ULTRA_PAID_DISPATCH_UNCERTAIN/);
  assert.equal(calls,1);
  assert.equal((await repository.getUltraMaxRun(run.run_id)).status,"UNCERTAIN");
  assert.equal(coordinator.runs.get(run.run_id).status,"UNCERTAIN");
});
