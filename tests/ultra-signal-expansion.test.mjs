import test from "node:test";
import assert from "node:assert/strict";
import { officialHintsForShard } from "../src/server/official-source-run.mjs";
import { createUltraCoreDiscoveryExecutor } from "../src/server/ultra-core-discovery.mjs";
import { createUltraMultilingualLongTailExecutor } from "../src/server/ultra-multilingual-long-tail.mjs";
import { createUltraProcurementFundingExecutor } from "../src/server/ultra-procurement-funding.mjs";
import { createUltraSignalExpansionExecutor } from "../src/server/ultra-signal-expansion.mjs";
import {
  ULTRA_SIGNAL_EXPANSION_MAX_RESULTS,
  ULTRA_SIGNAL_EXPANSION_MAX_STORED_SIGNALS,
  ULTRA_SIGNAL_EXPANSION_OPENAI_REQUEST_LIMIT,
  ULTRA_SIGNAL_EXPANSION_SHARD_IDS,
  ULTRA_SIGNAL_EXPANSION_SHARDS,
  ULTRA_SIGNAL_EXPANSION_TOTAL_TOOL_CALL_LIMIT,
  validateUltraSignalExpansionPlan
} from "../src/server/ultra-signal-expansion-plan.mjs";
import { ultraMaxNextOperationId } from "../src/server/ultra-max-run-contract.mjs";
import { executeUltraMaxPhase, startUltraMaxRun } from "../src/server/ultra-max-run-service.mjs";
import { createStateRepository } from "../src/server/state-repository.mjs";
import { memoryPaidCoordinator } from "./helpers/memory-paid-coordinator.mjs";
import { memoryStore } from "./helpers/memory-store.mjs";

const NOW="2026-09-08T21:00:00.000Z";
const PROFILE={capabilities:[],credentials:[]};

function searchResult(shards,{webCalls=shards.length*2,id="record",overrides={}}={}) {
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
    coverage:shards.map((shard)=>({shard_id:shard.id,status:"COMPLETE"})),
    diagnostics:{source_yield:[]},
    response_ids:shards.map((_,index)=>`resp_${id}_${index}`),
    counters:{candidates_seen:10},
    ...overrides
  };
}

async function executeHosted({repository,coordinator,run,phaseId,createExecutor}) {
  const execute=createExecutor({repository,coordinator,apiKey:"test-key",profile:PROFILE,nowIso:NOW,searchRunner:async(input)=>searchResult(input.shards,{id:`record-${phaseId}`})});
  return (await executeUltraMaxPhase({repository,runId:run.run_id,phaseId,operationId:ultraMaxNextOperationId(run,phaseId),nowIso:NOW,execute})).run;
}

async function rootAfterMultilingual(repository,coordinator) {
  const started=await startUltraMaxRun({repository,requestId:"request_ultra_signal",runId:"ultra-root-signal",nowIso:NOW});
  let run=(await executeUltraMaxPhase({repository,runId:started.run.run_id,phaseId:"NATIVE_COLLECTION",operationId:ultraMaxNextOperationId(started.run,"NATIVE_COLLECTION"),nowIso:NOW,execute:async()=>({complete:true,usage:{}})})).run;
  run=await executeHosted({repository,coordinator,run,phaseId:"CORE_DISCOVERY",createExecutor:createUltraCoreDiscoveryExecutor});
  run=await executeHosted({repository,coordinator,run,phaseId:"PROCUREMENT_FUNDING",createExecutor:createUltraProcurementFundingExecutor});
  return executeHosted({repository,coordinator,run,phaseId:"MULTILINGUAL_LONG_TAIL",createExecutor:createUltraMultilingualLongTailExecutor});
}

async function saveSignals(repository) {
  await repository.saveSourceSignal({
    signal_id:"signal-linkedin-fresh",source_id:"linkedin_alert_bridge",source_event_id:"li-1",
    source_url:"https://www.linkedin.com/jobs/view/123",text:"External character vendor wanted",
    published_at:"2026-09-08T12:00:00.000Z",discovery_only:true,requires_original_verification:true,outreach_locked:true
  });
  await repository.saveSourceSignal({
    signal_id:"signal-telegram-fresh",source_id:"telegram_authorized_channels",source_event_id:"tg-1",
    source_url:"https://t.me/design_jobs/42",text:"Paid photogrammetry team request",
    published_at:"2026-09-07T12:00:00.000Z",discovery_only:true,requires_original_verification:true,outreach_locked:true
  });
  await repository.saveSourceSignal({
    signal_id:"signal-linkedin-stale",source_id:"linkedin_alert_bridge",source_event_id:"li-old",
    source_url:"https://www.linkedin.com/jobs/view/old",text:"Old vendor signal",
    published_at:"2026-07-01T12:00:00.000Z",discovery_only:true,requires_original_verification:true,outreach_locked:true
  });
}

test("SIGNAL_EXPANSION owns four non-duplicate signal routes with exact caps", () => {
  assert.equal(validateUltraSignalExpansionPlan(),true);
  assert.equal(ULTRA_SIGNAL_EXPANSION_SHARDS.length,4);
  assert.equal(ULTRA_SIGNAL_EXPANSION_OPENAI_REQUEST_LIMIT,4);
  assert.equal(ULTRA_SIGNAL_EXPANSION_TOTAL_TOOL_CALL_LIMIT,12);
  assert.equal(ULTRA_SIGNAL_EXPANSION_MAX_RESULTS,20);
  assert.equal(ULTRA_SIGNAL_EXPANSION_MAX_STORED_SIGNALS,25);
  assert.deepEqual(ULTRA_SIGNAL_EXPANSION_SHARDS.map((item)=>item.id),ULTRA_SIGNAL_EXPANSION_SHARD_IDS);
  assert.equal(validateUltraSignalExpansionPlan(ULTRA_SIGNAL_EXPANSION_SHARDS.slice(1)),false);
  const social=ULTRA_SIGNAL_EXPANSION_SHARDS.find((item)=>item.id==="social_signals");
  assert.deepEqual(social.signal_only_domains,["linkedin.com","bsky.app","mastodon.social","x.com"]);
  assert.match(social.focus,/Resolve every signal to an original buyer/);
});

test("SIGNAL_EXPANSION consumes fresh stored hints without direct source requests", async () => {
  const repository=createStateRepository(memoryStore());
  const coordinator=memoryPaidCoordinator({capMicrousd:15_000_000,lifecycleMode:"MULTI_OPERATION"});
  await saveSignals(repository);
  const run=await rootAfterMultilingual(repository,coordinator);
  assert.equal(run.paid_coordinator_version,12);
  let calls=0;
  const executor=createUltraSignalExpansionExecutor({repository,coordinator,apiKey:"test-key",profile:PROFILE,nowIso:NOW,searchRunner:async(input)=>{
    calls+=1;
    assert.deepEqual(input.shards.map((item)=>item.id),ULTRA_SIGNAL_EXPANSION_SHARD_IDS);
    assert.equal(input.searchProfile,"ULTRA_SIGNAL_EXPANSION");
    assert.equal(input.maxResults,20);
    assert.equal(input.maxToolCallsPerShard,3);
    assert.equal(input.officialDiscovery.requests,0);
    assert.equal(input.officialDiscovery.stored_signal_count,2);
    assert.equal(officialHintsForShard(input.officialDiscovery,"social_signals").length,2);
    assert.equal(officialHintsForShard(input.officialDiscovery,"procurement").length,0);
    return searchResult(input.shards,{webCalls:8,id:"record-signal",overrides:{official_source_discovery:{requests:0,stored_signal_count:2}}});
  }});
  const operationId=ultraMaxNextOperationId(run,"SIGNAL_EXPANSION");
  const completed=await executeUltraMaxPhase({repository,runId:run.run_id,phaseId:"SIGNAL_EXPANSION",operationId,nowIso:NOW,execute:executor});
  assert.equal(calls,1);
  assert.equal(completed.run.plan_snapshot.phases[4].status,"COMPLETED");
  assert.equal(completed.run.paid_coordinator_version,16);
  assert.equal(completed.run.usage.source_requests,0);
  assert.equal(completed.run.usage.openai_requests,29);
  assert.equal(completed.run.usage.web_search_calls,58);
  assert.equal(completed.result.payload.source_context.stored_signal_count,2);
  assert.equal(completed.result.payload.direct_source_requests,0);
  const replay=await executeUltraMaxPhase({repository,runId:run.run_id,phaseId:"SIGNAL_EXPANSION",operationId,nowIso:NOW,execute:async()=>{calls+=1;}});
  assert.equal(replay.replayed,true);
  assert.equal(calls,1);
});

test("SIGNAL_EXPANSION fails closed if a direct connector request is hidden in the paid phase", async () => {
  const repository=createStateRepository(memoryStore());
  const coordinator=memoryPaidCoordinator({capMicrousd:15_000_000,lifecycleMode:"MULTI_OPERATION"});
  const run=await rootAfterMultilingual(repository,coordinator);
  let calls=0;
  const executor=createUltraSignalExpansionExecutor({repository,coordinator,apiKey:"test-key",profile:PROFILE,nowIso:NOW,searchRunner:async(input)=>{
    calls+=1;
    return searchResult(input.shards,{overrides:{direct_source_requests:1}});
  }});
  const operationId=ultraMaxNextOperationId(run,"SIGNAL_EXPANSION");
  await assert.rejects(()=>executeUltraMaxPhase({repository,runId:run.run_id,phaseId:"SIGNAL_EXPANSION",operationId,nowIso:NOW,execute:executor}),/ULTRA_PAID_DISPATCH_UNCERTAIN/);
  assert.equal(calls,1);
  assert.equal((await repository.getUltraMaxRun(run.run_id)).status,"UNCERTAIN");
  assert.equal(coordinator.runs.get(run.run_id).status,"UNCERTAIN");
});
