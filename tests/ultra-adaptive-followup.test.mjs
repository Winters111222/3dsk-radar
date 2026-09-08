import test from "node:test";
import assert from "node:assert/strict";
import { createUltraAdaptiveFollowupExecutor } from "../src/server/ultra-adaptive-followup.mjs";
import {
  buildUltraAdaptiveFollowupPlan,
  ULTRA_ADAPTIVE_MAX_RESULTS,
  ULTRA_ADAPTIVE_MAX_SHARDS,
  ULTRA_ADAPTIVE_TOOL_CALLS_PER_SHARD,
  validateUltraAdaptiveFollowupPlan
} from "../src/server/ultra-adaptive-followup-plan.mjs";
import { createUltraCoreDiscoveryExecutor } from "../src/server/ultra-core-discovery.mjs";
import { createUltraMultilingualLongTailExecutor } from "../src/server/ultra-multilingual-long-tail.mjs";
import { createUltraProcurementFundingExecutor } from "../src/server/ultra-procurement-funding.mjs";
import { createUltraSignalExpansionExecutor } from "../src/server/ultra-signal-expansion.mjs";
import { ultraMaxNextOperationId } from "../src/server/ultra-max-run-contract.mjs";
import { executeUltraMaxPhase, startUltraMaxRun } from "../src/server/ultra-max-run-service.mjs";
import { createStateRepository } from "../src/server/state-repository.mjs";
import { memoryPaidCoordinator } from "./helpers/memory-paid-coordinator.mjs";
import { memoryStore } from "./helpers/memory-store.mjs";

const NOW="2026-09-08T22:00:00.000Z";
const PROFILE={capabilities:[],credentials:[]};

function searchResult(shards,{webCalls=shards.length*2,id="record",candidates=10,coverageCandidates=0,overrides={}}={}) {
  return {
    attempts:1,
    openai_request_count:shards.length,
    web_search_call_count:webCalls,
    direct_source_requests:0,
    model:"gpt-5.6-luna",
    usage:{input_tokens:10_000,output_tokens:2_000,input_tokens_details:{cached_tokens:0}},
    search_status:"COMPLETE",
    records:[{id}],
    opportunities:[{id}],
    coverage:shards.map((shard)=>({shard_id:shard.id,status:"COMPLETE",candidates_seen:coverageCandidates})),
    diagnostics:{source_yield:[]},
    response_ids:shards.map((_,index)=>`resp_${id}_${index}`),
    counters:{candidates_seen:candidates},
    ...overrides
  };
}

async function executeHosted({repository,coordinator,run,phaseId,createExecutor}) {
  const execute=createExecutor({repository,coordinator,apiKey:"test-key",profile:PROFILE,nowIso:NOW,searchRunner:async(input)=>searchResult(input.shards,{id:`record-${phaseId}`})});
  return (await executeUltraMaxPhase({repository,runId:run.run_id,phaseId,operationId:ultraMaxNextOperationId(run,phaseId),nowIso:NOW,execute})).run;
}

async function rootAfterSignals(repository,coordinator) {
  const started=await startUltraMaxRun({repository,requestId:"request_ultra_adaptive",runId:"ultra-root-adaptive",nowIso:NOW});
  let run=(await executeUltraMaxPhase({repository,runId:started.run.run_id,phaseId:"NATIVE_COLLECTION",operationId:ultraMaxNextOperationId(started.run,"NATIVE_COLLECTION"),nowIso:NOW,execute:async()=>({complete:true,usage:{}})})).run;
  run=await executeHosted({repository,coordinator,run,phaseId:"CORE_DISCOVERY",createExecutor:createUltraCoreDiscoveryExecutor});
  run=await executeHosted({repository,coordinator,run,phaseId:"PROCUREMENT_FUNDING",createExecutor:createUltraProcurementFundingExecutor});
  run=await executeHosted({repository,coordinator,run,phaseId:"MULTILINGUAL_LONG_TAIL",createExecutor:createUltraMultilingualLongTailExecutor});
  return executeHosted({repository,coordinator,run,phaseId:"SIGNAL_EXPANSION",createExecutor:createUltraSignalExpansionExecutor});
}

test("adaptive plan prioritizes failed, zero and low-yield coverage with distinct prompts", () => {
  const shards=buildUltraAdaptiveFollowupPlan({maxShards:4,phasePayloads:[{
    phase_id:"CORE_DISCOVERY",
    coverage:[
      {shard_id:"human_face_body_marketplaces",status:"COMPLETE",candidates_seen:5},
      {shard_id:"realitycapture_processing",status:"FAILED",candidates_seen:0},
      {shard_id:"wrap3d_face_pipeline",status:"COMPLETE",candidates_seen:0},
      {shard_id:"zbrush_scan_cleanup",status:"COMPLETE",candidates_seen:1},
      {shard_id:"substance_scan_texturing",status:"COMPLETE",candidates_seen:2}
    ],
    records:[{source_url:"https://www.upwork.com/jobs/~accepted"}]
  }]});
  assert.equal(validateUltraAdaptiveFollowupPlan(shards),true);
  assert.deepEqual(shards.map((item)=>item.selection_reason),["FAILED_COVERAGE","ZERO_CANDIDATES","SINGLE_CANDIDATE","LOW_YIELD"]);
  assert.equal(shards[0].origin_shard_id,"realitycapture_processing");
  assert.match(shards[0].focus,/not a transport retry/);
  assert.match(shards[1].focus,/ADAPTIVE_FOLLOWUP/);
  assert.match(shards[1].focus,/already accepted URLs: https:\/\/www\.upwork\.com\/jobs\/~accepted/);
  assert.throws(()=>buildUltraAdaptiveFollowupPlan({phasePayloads:[]}),/ULTRA_ADAPTIVE_EVIDENCE_REQUIRED/);
  assert.equal(validateUltraAdaptiveFollowupPlan([...shards,{...shards[0]}]),false);
});

test("ADAPTIVE_FOLLOWUP uses the full twenty-shard phase allowance for weakest coverage", async () => {
  const repository=createStateRepository(memoryStore());
  const coordinator=memoryPaidCoordinator({capMicrousd:15_000_000,lifecycleMode:"MULTI_OPERATION"});
  const run=await rootAfterSignals(repository,coordinator);
  assert.equal(run.paid_coordinator_version,16);
  let calls=0;
  const executor=createUltraAdaptiveFollowupExecutor({repository,coordinator,apiKey:"test-key",profile:PROFILE,nowIso:NOW,searchRunner:async(input)=>{
    calls+=1;
    assert.equal(input.shards.length,ULTRA_ADAPTIVE_MAX_SHARDS);
    assert.equal(new Set(input.shards.map((item)=>item.origin_shard_id)).size,ULTRA_ADAPTIVE_MAX_SHARDS);
    assert.equal(input.searchProfile,"ULTRA_ADAPTIVE_FOLLOWUP");
    assert.equal(input.maxResults,ULTRA_ADAPTIVE_MAX_RESULTS);
    assert.equal(input.maxResultsPerShard,4);
    assert.equal(input.maxToolCallsPerShard,ULTRA_ADAPTIVE_TOOL_CALLS_PER_SHARD);
    assert.equal(input.shards.every((item)=>item.focus.includes("ADAPTIVE_FOLLOWUP")),true);
    return searchResult(input.shards,{webCalls:40,id:"record-adaptive"});
  }});
  const operationId=ultraMaxNextOperationId(run,"ADAPTIVE_FOLLOWUP");
  const completed=await executeUltraMaxPhase({repository,runId:run.run_id,phaseId:"ADAPTIVE_FOLLOWUP",operationId,nowIso:NOW,execute:executor});
  assert.equal(calls,1);
  assert.equal(completed.run.plan_snapshot.phases[5].status,"COMPLETED");
  assert.equal(completed.run.paid_coordinator_version,20);
  assert.equal(completed.run.usage.openai_requests,49);
  assert.equal(completed.run.usage.web_search_calls,98);
  assert.equal(completed.result.payload.adaptive_plan.selected_shards,20);
  assert.equal(completed.result.payload.adaptive_plan.selections[0].reason,"ZERO_CANDIDATES");
  const replay=await executeUltraMaxPhase({repository,runId:run.run_id,phaseId:"ADAPTIVE_FOLLOWUP",operationId,nowIso:NOW,execute:async()=>{calls+=1;}});
  assert.equal(replay.replayed,true);
  assert.equal(calls,1);
});

test("ADAPTIVE_FOLLOWUP shrinks to the exact remaining candidate and result capacity", async () => {
  const repository=createStateRepository(memoryStore());
  const coordinator=memoryPaidCoordinator({capMicrousd:15_000_000,lifecycleMode:"MULTI_OPERATION"});
  let run=await rootAfterSignals(repository,coordinator);
  run={...run,usage:{...run.usage,candidates_seen:199,results_accepted:99}};
  await repository.saveUltraMaxRun(run);
  const executor=createUltraAdaptiveFollowupExecutor({repository,coordinator,apiKey:"test-key",profile:PROFILE,nowIso:NOW,searchRunner:async(input)=>{
    assert.equal(input.shards.length,1);
    assert.equal(input.maxResultsPerShard,1);
    assert.equal(input.maxResults,1);
    return searchResult(input.shards,{webCalls:2,id:"record-last",candidates:1});
  }});
  const completed=await executeUltraMaxPhase({repository,runId:run.run_id,phaseId:"ADAPTIVE_FOLLOWUP",operationId:ultraMaxNextOperationId(run,"ADAPTIVE_FOLLOWUP"),nowIso:NOW,execute:executor});
  assert.equal(completed.run.usage.candidates_seen,200);
  assert.equal(completed.run.usage.results_accepted,100);
  assert.equal(completed.result.payload.adaptive_plan.selected_shards,1);
});

test("ADAPTIVE_FOLLOWUP completes without dispatch when root result capacity is exhausted", async () => {
  const repository=createStateRepository(memoryStore());
  const coordinator=memoryPaidCoordinator({capMicrousd:15_000_000,lifecycleMode:"MULTI_OPERATION"});
  let run=await rootAfterSignals(repository,coordinator);
  run={...run,usage:{...run.usage,results_accepted:100}};
  await repository.saveUltraMaxRun(run);
  let calls=0;
  const executor=createUltraAdaptiveFollowupExecutor({repository,coordinator,apiKey:"test-key",profile:PROFILE,nowIso:NOW,searchRunner:async()=>{calls+=1;throw new Error("must not dispatch");}});
  const completed=await executeUltraMaxPhase({repository,runId:run.run_id,phaseId:"ADAPTIVE_FOLLOWUP",operationId:ultraMaxNextOperationId(run,"ADAPTIVE_FOLLOWUP"),nowIso:NOW,execute:executor});
  assert.equal(calls,0);
  assert.equal(completed.run.paid_coordinator_version,16);
  assert.equal(completed.result.payload.search_status,"SKIPPED");
  assert.equal(completed.result.payload.completion_reason,"ROOT_CAPACITY_EXHAUSTED");
});
