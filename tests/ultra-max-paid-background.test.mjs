import test from "node:test";
import assert from "node:assert/strict";
import { runUltraMaxPhaseBackground } from "../netlify/functions/ultra-max-phase-background.mjs";
import { ultraMaxNextOperationId } from "../src/server/ultra-max-run-contract.mjs";
import { executeUltraMaxPhase, startUltraMaxRun } from "../src/server/ultra-max-run-service.mjs";
import { createStateRepository } from "../src/server/state-repository.mjs";
import { ULTRA_MAX_PAID_CONFIRMATION } from "../src/server/ultra-max-paid-policy.mjs";
import { memoryPaidCoordinator } from "./helpers/memory-paid-coordinator.mjs";
import { memoryStore } from "./helpers/memory-store.mjs";

const NOW="2026-09-08T23:30:00.000Z";
const CONTEXT={deploy:{context:"production"}};
const SOURCE="https://www.upwork.com/freelance-jobs/apply/Human-scan-cleanup_~0123456789";

function candidate() {
  return {
    id:"ultra-paid-candidate",
    record_kind:"SALES_OPPORTUNITY",
    source_url:SOURCE,
    canonical_url:SOURCE,
    title:"External human scan cleanup",
    company:"Buyer Studio",
    summary:"Current external-studio production brief.",
    opportunity_kind:"OPEN_OPPORTUNITY",
    commercial_role:"BUYER",
    notice_status:"OPEN",
    studio_eligibility:"YES",
    scope_fit:"CORE",
    categories:["SCAN_CLEANUP"],
    remote_scope:"WORLDWIDE_VENDOR",
    budget_type:"UNKNOWN",
    fit_score:95,
    win_score:85,
    status:"NEW"
  };
}

function request(path,body) {
  return new Request(`https://radar.test${path}`,{method:"POST",headers:{authorization:"Bearer team-secret","content-type":"application/json"},body:JSON.stringify(body)});
}

function install(t) {
  const values={
    RADAR_INTERNAL_ACCESS_SECRET:"team-secret",
    RADAR_ULTRA_MAX_ENABLED:"true",
    RADAR_ULTRA_MAX_PAID_ENABLED:"true",
    RADAR_LIVE_AI_ENABLED:"true",
    RADAR_SOURCE_COLLECTION_ENABLED:"true",
    OPENAI_API_KEY:"test-key"
  };
  const repository=createStateRepository(memoryStore());
  globalThis.Netlify={env:{get:(key)=>values[key]||""}};
  globalThis.__RADAR_TEST_STATE_REPOSITORY__=repository;
  globalThis.__RADAR_TEST_PAID_COORDINATOR__=memoryPaidCoordinator({capMicrousd:15_000_000,lifecycleMode:"MULTI_OPERATION"});
  globalThis.__RADAR_TEST_NOW_ISO__=NOW;
  globalThis.__RADAR_TEST_RUNTIME_ELIGIBLE_SOURCE_IDS__=new Set(["ted_eu"]);
  t.after(()=>{
    for (const key of ["Netlify","__RADAR_TEST_STATE_REPOSITORY__","__RADAR_TEST_PAID_COORDINATOR__","__RADAR_TEST_NOW_ISO__","__RADAR_TEST_RUNTIME_ELIGIBLE_SOURCE_IDS__","__RADAR_TEST_ULTRA_SEARCH_RUNNER__"]) delete globalThis[key];
  });
  return repository;
}

test("one prepared background action advances all six paid phases and persists only detail-verified records", async t => {
  const repository=install(t);
  let calls=0;
  globalThis.__RADAR_TEST_ULTRA_SEARCH_RUNNER__=async(input)=>{
    calls+=1;
    const detail=input.searchProfile==="ULTRA_DETAIL_VERIFICATION";
    const core=input.searchProfile==="ULTRA_CORE_DISCOVERY";
    const records=core||detail?[candidate()]:[];
    return {
      attempts:1,
      openai_request_count:input.shards.length,
      web_search_call_count:input.shards.length,
      direct_source_requests:0,
      model:"gpt-5.6-luna",
      usage:{input_tokens:1000,output_tokens:200,input_tokens_details:{cached_tokens:0}},
      search_status:"COMPLETE",
      records,
      opportunities:records,
      rejected_candidates:core?[{id:"rejected-background-1",title:"Old human scan task",company:"Buyer",summary:"Candidate is no longer active.",source_url:"https://www.upwork.com/freelance-jobs/apply/Old-human-scan_~0999",source_id:"upwork",rejection_reason:"inactive_notice",rejection_stage:"NORMALIZATION",review_status:"PENDING",outreach_locked:true,first_seen:NOW,last_seen:NOW}]:[],
      coverage:input.shards.map((shard)=>({
        shard_id:shard.id,
        shard_label:shard.label,
        status:"COMPLETE",
        allowed_domain_count:shard.allowed_domains.length,
        consulted_urls:1,
        candidates_seen:records.length,
        web_search_calls:1,
        ...(detail?{verified_source_urls:[shard.candidate_source_url]}:{})
      })),
      diagnostics:{source_yield:[],rejection_reasons:{}},
      response_ids:[`response_${calls}`],
      counters:{candidates_seen:records.length}
    };
  };
  const started=await startUltraMaxRun({repository,requestId:"request_ultra_paid_background",runId:"ultra-paid-background",nowIso:NOW});
  let run=(await executeUltraMaxPhase({
    repository,
    runId:started.run.run_id,
    phaseId:"NATIVE_COLLECTION",
    operationId:ultraMaxNextOperationId(started.run,"NATIVE_COLLECTION"),
    nowIso:NOW,
    execute:async()=>({complete:true,usage:{}})
  })).run;
  const main=(await import(`../netlify/functions/ultra-max-runs.mjs?paid=${Date.now()}`)).default;
  for (const phaseId of ["CORE_DISCOVERY","PROCUREMENT_FUNDING","MULTILINGUAL_LONG_TAIL","SIGNAL_EXPANSION","ADAPTIVE_FOLLOWUP","DETAIL_VERIFICATION"]) {
    const body={phase_id:phaseId,run_id:run.run_id,operation_id:ultraMaxNextOperationId(run,phaseId),paid_confirmation:ULTRA_MAX_PAID_CONFIRMATION};
    const prepared=await main(request("/api/ultra-max-runs",{action:"PREPARE_PAID",...body}),CONTEXT);
    assert.equal(prepared.status,200);
    assert.equal((await prepared.json()).background_path,"/api/ultra-max-phase-background");
    const response=await runUltraMaxPhaseBackground(request("/api/ultra-max-phase-background",body),CONTEXT);
    assert.equal(response.status,200);
    run=(await response.json()).run;
  }
  assert.equal(calls,6);
  assert.equal(run.status,"COMPLETED");
  assert.equal(run.paid_coordinator_version,24);
  const snapshot=await repository.snapshot();
  assert.equal(snapshot.opportunities.length,1);
  assert.equal(snapshot.last_search.mode,"ULTRA_MAX");
  assert.equal(snapshot.last_search.returned_count,1);
  assert.equal(snapshot.last_search.retry_allowed,false);
  assert.equal(snapshot.last_search.estimated_cost_usd,run.usage.cost_microusd/1_000_000);
  assert.equal(snapshot.last_search.forensic_audit.schema_version,1);
  assert.equal(snapshot.last_search.forensic_audit.funnel.candidates_seen,1);
  assert.equal(snapshot.last_search.forensic_audit.funnel.detail_candidates_verified,1);
  assert.equal(snapshot.last_search.forensic_audit.funnel.accounting_complete,true);
  assert.equal(snapshot.last_search.forensic_audit.accepted_candidate_ledger[0].source_url,SOURCE);
  assert.equal(snapshot.rejected_candidates.length,1);
  assert.equal(snapshot.rejected_candidates[0].rejection_reason,"inactive_notice");
  assert.equal(snapshot.rejected_candidates[0].contact_email,null);
  assert.equal(snapshot.last_search.counters.rejected_workspace_total,1);
});

test("background paid phase rejects auth, preview context and missing exact confirmation before dispatch", async t => {
  install(t);
  let calls=0;
  globalThis.__RADAR_TEST_ULTRA_SEARCH_RUNNER__=async()=>{calls+=1;throw new Error("must not dispatch");};
  const body={phase_id:"CORE_DISCOVERY",run_id:"valid-run-id",operation_id:"valid-operation-id"};
  const unauthorized=await runUltraMaxPhaseBackground(new Request("https://radar.test/api/ultra-max-phase-background",{method:"POST",headers:{authorization:"Bearer wrong","content-type":"application/json"},body:JSON.stringify(body)}),CONTEXT);
  assert.equal(unauthorized.status,401);
  const unconfirmed=await runUltraMaxPhaseBackground(request("/api/ultra-max-phase-background",body),CONTEXT);
  assert.equal(unconfirmed.status,403);
  const preview=await runUltraMaxPhaseBackground(request("/api/ultra-max-phase-background",{...body,paid_confirmation:ULTRA_MAX_PAID_CONFIRMATION}),{deploy:{context:"deploy-preview"}});
  assert.equal(preview.status,423);
  assert.equal(calls,0);
});
