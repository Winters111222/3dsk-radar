import test from "node:test";
import assert from "node:assert/strict";
import { officialHintsForShard } from "../src/server/official-source-run.mjs";
import { createUltraAdaptiveFollowupExecutor } from "../src/server/ultra-adaptive-followup.mjs";
import { createUltraCoreDiscoveryExecutor } from "../src/server/ultra-core-discovery.mjs";
import { createUltraDetailVerificationExecutor } from "../src/server/ultra-detail-verification.mjs";
import {
  buildUltraDetailVerificationShards,
  collectUltraDetailCandidates,
  ULTRA_DETAIL_MAX_CANDIDATES,
  ULTRA_DETAIL_TOOL_CALLS_PER_CANDIDATE,
  validateUltraDetailVerificationPlan
} from "../src/server/ultra-detail-verification-plan.mjs";
import { createUltraMultilingualLongTailExecutor } from "../src/server/ultra-multilingual-long-tail.mjs";
import { createUltraProcurementFundingExecutor } from "../src/server/ultra-procurement-funding.mjs";
import { createUltraSignalExpansionExecutor } from "../src/server/ultra-signal-expansion.mjs";
import { ultraMaxNextOperationId } from "../src/server/ultra-max-run-contract.mjs";
import { executeUltraMaxPhase, startUltraMaxRun } from "../src/server/ultra-max-run-service.mjs";
import { createStateRepository } from "../src/server/state-repository.mjs";
import { memoryPaidCoordinator } from "./helpers/memory-paid-coordinator.mjs";
import { memoryStore } from "./helpers/memory-store.mjs";

const NOW="2026-09-08T23:00:00.000Z";
const PROFILE={capabilities:[],credentials:[]};
const URLS=Object.freeze({
  CORE_DISCOVERY:"https://www.upwork.com/freelance-jobs/apply/Human-scan-cleanup_~0123456789",
  PROCUREMENT_FUNDING:"https://ted.europa.eu/en/notice/-/detail/123-2026",
  MULTILINGUAL_LONG_TAIL:"https://www.freelancer.com/projects/3d-modelling/human-scan-cleanup",
  SIGNAL_EXPANSION:"https://www.workwithindies.com/careers/external-character-team",
  ADAPTIVE_FOLLOWUP:"https://een.ec.europa.eu/partnering-opportunities/3d-photogrammetry-production-partner"
});

function candidate(phaseId,overrides={}) {
  return {
    id:`candidate-${phaseId}`,
    record_kind:"SALES_OPPORTUNITY",
    source_url:URLS[phaseId],
    canonical_url:URLS[phaseId],
    title:`3D production ${phaseId}`,
    company:`Buyer ${phaseId}`,
    summary:"Current external-studio production brief.",
    opportunity_kind:"OPEN_OPPORTUNITY",
    notice_status:"OPEN",
    studio_eligibility:"YES",
    budget_type:"UNKNOWN",
    win_score:80,
    fit_score:90,
    ...overrides
  };
}

function searchResult(shards,{phaseId,records=null,webCalls=shards.length*2,overrides={}}={}) {
  const selected=records??(phaseId?[candidate(phaseId)]:[]);
  return {
    attempts:1,
    openai_request_count:shards.length,
    web_search_call_count:webCalls,
    direct_source_requests:0,
    model:"gpt-5.6-luna",
    usage:{input_tokens:10_000,output_tokens:2_000,input_tokens_details:{cached_tokens:0}},
    search_status:"COMPLETE",
    records:selected,
    opportunities:selected,
    coverage:shards.map((shard)=>({
      shard_id:shard.id,
      status:"COMPLETE",
      candidates_seen:selected.length?1:0,
      ...(shard.candidate_source_url?{verified_source_urls:[shard.candidate_source_url]}:{})
    })),
    diagnostics:{source_yield:[]},
    response_ids:shards.map((_,index)=>`resp_${phaseId||"detail"}_${index}`),
    counters:{candidates_seen:selected.length?10:0},
    ...overrides
  };
}

async function executeHosted({repository,coordinator,run,phaseId,createExecutor,withCandidates}) {
  const execute=createExecutor({repository,coordinator,apiKey:"test-key",profile:PROFILE,nowIso:NOW,searchRunner:async(input)=>searchResult(input.shards,{phaseId,records:withCandidates?[candidate(phaseId)]:[]})});
  return (await executeUltraMaxPhase({repository,runId:run.run_id,phaseId,operationId:ultraMaxNextOperationId(run,phaseId),nowIso:NOW,execute})).run;
}

async function rootAfterAdaptive(repository,coordinator,{withCandidates=true}={}) {
  const started=await startUltraMaxRun({repository,requestId:`request_ultra_detail_${withCandidates}`,runId:`ultra-root-detail-${withCandidates}`,nowIso:NOW});
  let run=(await executeUltraMaxPhase({repository,runId:started.run.run_id,phaseId:"NATIVE_COLLECTION",operationId:ultraMaxNextOperationId(started.run,"NATIVE_COLLECTION"),nowIso:NOW,execute:async()=>({complete:true,usage:{}})})).run;
  for (const [phaseId,createExecutor] of [
    ["CORE_DISCOVERY",createUltraCoreDiscoveryExecutor],
    ["PROCUREMENT_FUNDING",createUltraProcurementFundingExecutor],
    ["MULTILINGUAL_LONG_TAIL",createUltraMultilingualLongTailExecutor],
    ["SIGNAL_EXPANSION",createUltraSignalExpansionExecutor],
    ["ADAPTIVE_FOLLOWUP",createUltraAdaptiveFollowupExecutor]
  ]) run=await executeHosted({repository,coordinator,run,phaseId,createExecutor,withCandidates});
  return run;
}

test("detail plan deduplicates exact URLs and prioritizes open high-score sales candidates", () => {
  const open=candidate("CORE_DISCOVERY",{win_score:95});
  const lead=candidate("PROCUREMENT_FUNDING",{opportunity_kind:"POTENTIAL_LEAD",notice_status:"AWARDED",win_score:99});
  const duplicate={...open,id:"duplicate",win_score:10};
  const candidates=collectUltraDetailCandidates([
    {phase_id:"CORE_DISCOVERY",records:[duplicate,lead,{record_kind:"COMPETITOR",source_url:URLS.CORE_DISCOVERY}]},
    {phase_id:"ADAPTIVE_FOLLOWUP",records:[open,{record_kind:"SALES_OPPORTUNITY",source_url:"https://evil.example/item"}]}
  ]);
  assert.equal(candidates.length,2);
  assert.equal(candidates[0].id,open.id);
  assert.equal(candidates[1].id,lead.id);
  const shards=buildUltraDetailVerificationShards(candidates);
  assert.equal(validateUltraDetailVerificationPlan(shards),true);
  assert.equal(shards.length,2);
  assert.deepEqual(shards[0].allowed_domains,["upwork.com"]);
  assert.match(shards[0].focus,/Do not discover or substitute another opportunity/);
  assert.match(shards[0].focus,/buyer identity/);
  assert.equal(ULTRA_DETAIL_MAX_CANDIDATES,20);
  assert.equal(ULTRA_DETAIL_TOOL_CALLS_PER_CANDIDATE,3);
});

test("DETAIL_VERIFICATION reopens each exact candidate and completes the full ULTRA root", async () => {
  const repository=createStateRepository(memoryStore());
  const coordinator=memoryPaidCoordinator({capMicrousd:15_000_000,lifecycleMode:"MULTI_OPERATION"});
  const run=await rootAfterAdaptive(repository,coordinator);
  assert.equal(run.paid_coordinator_version,20);
  assert.equal(run.usage.openai_requests,49);
  let calls=0;
  const executor=createUltraDetailVerificationExecutor({repository,coordinator,apiKey:"test-key",profile:PROFILE,nowIso:NOW,searchRunner:async(input)=>{
    calls+=1;
    assert.equal(input.shards.length,5);
    assert.equal(input.maxResults,5);
    assert.equal(input.maxResultsPerShard,1);
    assert.equal(input.maxToolCallsPerShard,3);
    assert.equal(input.searchProfile,"ULTRA_DETAIL_VERIFICATION");
    assert.equal(input.includeVerificationEvidence,true);
    assert.equal(input.officialDiscovery.requests,0);
    assert.equal(input.officialDiscovery.hints.length,5);
    for (const shard of input.shards) {
      const hints=officialHintsForShard(input.officialDiscovery,shard.id);
      assert.equal(hints.length,1);
      assert.equal(hints[0].url,shard.candidate_source_url);
    }
    const verified=[candidate("CORE_DISCOVERY"),candidate("PROCUREMENT_FUNDING")];
    return searchResult(input.shards,{records:verified,webCalls:10});
  }});
  const operationId=ultraMaxNextOperationId(run,"DETAIL_VERIFICATION");
  const completed=await executeUltraMaxPhase({repository,runId:run.run_id,phaseId:"DETAIL_VERIFICATION",operationId,nowIso:NOW,execute:executor});
  assert.equal(calls,1);
  assert.equal(completed.run.status,"COMPLETED");
  assert.equal(completed.run.paid_coordinator_version,24);
  assert.equal(completed.run.usage.openai_requests,54);
  assert.equal(completed.run.usage.web_search_calls,108);
  assert.equal(completed.run.usage.candidates_seen,50);
  assert.equal(completed.run.usage.results_accepted,5);
  assert.equal(completed.result.payload.records.length,2);
  assert.equal(completed.result.payload.verification.verified_candidates,2);
  assert.equal(completed.result.payload.verification.rejected_candidates,3);
  const replay=await executeUltraMaxPhase({repository,runId:run.run_id,phaseId:"DETAIL_VERIFICATION",operationId,nowIso:NOW,execute:async()=>{calls+=1;}});
  assert.equal(replay.replayed,true);
  assert.equal(calls,1);
});

test("DETAIL_VERIFICATION rejects substitution of an unselected opportunity URL", async () => {
  const repository=createStateRepository(memoryStore());
  const coordinator=memoryPaidCoordinator({capMicrousd:15_000_000,lifecycleMode:"MULTI_OPERATION"});
  const run=await rootAfterAdaptive(repository,coordinator);
  let calls=0;
  const executor=createUltraDetailVerificationExecutor({repository,coordinator,apiKey:"test-key",profile:PROFILE,nowIso:NOW,searchRunner:async(input)=>{
    calls+=1;
    const substituted=candidate("CORE_DISCOVERY",{id:"substitute",source_url:"https://www.upwork.com/freelance-jobs/apply/Different-project_~9999999999"});
    return searchResult(input.shards,{records:[substituted]});
  }});
  const operationId=ultraMaxNextOperationId(run,"DETAIL_VERIFICATION");
  await assert.rejects(()=>executeUltraMaxPhase({repository,runId:run.run_id,phaseId:"DETAIL_VERIFICATION",operationId,nowIso:NOW,execute:executor}),/ULTRA_PAID_DISPATCH_UNCERTAIN/);
  assert.equal(calls,1);
  assert.equal((await repository.getUltraMaxRun(run.run_id)).status,"UNCERTAIN");
  assert.equal(coordinator.runs.get(run.run_id).status,"UNCERTAIN");
});

test("DETAIL_VERIFICATION rejects an exact result when its shard did not reopen the assigned URL", async () => {
  const repository=createStateRepository(memoryStore());
  const coordinator=memoryPaidCoordinator({capMicrousd:15_000_000,lifecycleMode:"MULTI_OPERATION"});
  const run=await rootAfterAdaptive(repository,coordinator);
  const executor=createUltraDetailVerificationExecutor({repository,coordinator,apiKey:"test-key",profile:PROFILE,nowIso:NOW,searchRunner:async(input)=>{
    const result=searchResult(input.shards,{records:[candidate("CORE_DISCOVERY")]});
    result.coverage[0].verified_source_urls=["https://www.upwork.com/freelance-jobs/apply/Different-project_~9999999999"];
    return result;
  }});
  await assert.rejects(
    ()=>executeUltraMaxPhase({repository,runId:run.run_id,phaseId:"DETAIL_VERIFICATION",operationId:ultraMaxNextOperationId(run,"DETAIL_VERIFICATION"),nowIso:NOW,execute:executor}),
    /ULTRA_PAID_DISPATCH_UNCERTAIN/
  );
  assert.equal((await repository.getUltraMaxRun(run.run_id)).status,"UNCERTAIN");
});

test("DETAIL_VERIFICATION completes without paid dispatch when discovery found no sales candidates", async () => {
  const repository=createStateRepository(memoryStore());
  const coordinator=memoryPaidCoordinator({capMicrousd:15_000_000,lifecycleMode:"MULTI_OPERATION"});
  const run=await rootAfterAdaptive(repository,coordinator,{withCandidates:false});
  let calls=0;
  const executor=createUltraDetailVerificationExecutor({repository,coordinator,apiKey:"test-key",profile:PROFILE,nowIso:NOW,searchRunner:async()=>{calls+=1;throw new Error("must not dispatch");}});
  const completed=await executeUltraMaxPhase({repository,runId:run.run_id,phaseId:"DETAIL_VERIFICATION",operationId:ultraMaxNextOperationId(run,"DETAIL_VERIFICATION"),nowIso:NOW,execute:executor});
  assert.equal(calls,0);
  assert.equal(completed.run.status,"COMPLETED");
  assert.equal(completed.run.paid_coordinator_version,20);
  assert.equal(completed.result.payload.completion_reason,"NO_VERIFIABLE_SALES_CANDIDATES");
});
