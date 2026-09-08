import test from "node:test";
import assert from "node:assert/strict";
import { createUltraCoreDiscoveryExecutor } from "../src/server/ultra-core-discovery.mjs";
import { ULTRA_CORE_DISCOVERY_SHARD_IDS, ULTRA_CORE_DISCOVERY_SHARDS, ULTRA_CORE_OPENAI_REQUEST_LIMIT } from "../src/server/ultra-core-discovery-plan.mjs";
import { createUltraProcurementFundingExecutor } from "../src/server/ultra-procurement-funding.mjs";
import {
  ULTRA_PROCUREMENT_FUNDING_MAX_RESULTS,
  ULTRA_PROCUREMENT_FUNDING_OPENAI_REQUEST_LIMIT,
  ULTRA_PROCUREMENT_FUNDING_SHARD_IDS,
  ULTRA_PROCUREMENT_FUNDING_SHARDS,
  ULTRA_PROCUREMENT_FUNDING_TOTAL_TOOL_CALL_LIMIT,
  validateUltraProcurementFundingPlan
} from "../src/server/ultra-procurement-funding-plan.mjs";
import { ultraMaxNextOperationId } from "../src/server/ultra-max-run-contract.mjs";
import { executeUltraMaxPhase, startUltraMaxRun } from "../src/server/ultra-max-run-service.mjs";
import { createStateRepository } from "../src/server/state-repository.mjs";
import { memoryPaidCoordinator } from "./helpers/memory-paid-coordinator.mjs";
import { memoryStore } from "./helpers/memory-store.mjs";

const NOW="2026-09-08T19:00:00.000Z";
const PROFILE={capabilities:[],credentials:[]};

function searchResult(shards,{webCalls,candidates,id,overrides={}}) {
  return {
    attempts:1,
    openai_request_count:shards.length,
    web_search_call_count:webCalls,
    model:"gpt-5.6-luna",
    usage:{input_tokens:11_000,output_tokens:2_200,input_tokens_details:{cached_tokens:0}},
    search_status:"COMPLETE",
    records:[{id}],
    opportunities:[{id}],
    coverage:shards.map((shard)=>({shard_id:shard.id,status:"COMPLETE"})),
    diagnostics:{source_yield:[]},
    response_ids:shards.map((_,index)=>`resp_${id}_${index}`),
    counters:{candidates_seen:candidates},
    ...overrides
  };
}

async function rootAfterNative(repository,requestId="request_ultra_procurement") {
  const started=await startUltraMaxRun({repository,requestId,runId:`ultra-root-${requestId}`,nowIso:NOW});
  const operationId=ultraMaxNextOperationId(started.run,"NATIVE_COLLECTION");
  const completed=await executeUltraMaxPhase({repository,runId:started.run.run_id,phaseId:"NATIVE_COLLECTION",operationId,nowIso:NOW,execute:async()=>({complete:true,usage:{}})});
  return completed.run;
}

test("PROCUREMENT_FUNDING owns nine procurement and grant shards without CORE overlap", () => {
  assert.equal(validateUltraProcurementFundingPlan(),true);
  assert.equal(ULTRA_PROCUREMENT_FUNDING_SHARDS.length,9);
  assert.equal(ULTRA_PROCUREMENT_FUNDING_OPENAI_REQUEST_LIMIT,9);
  assert.equal(ULTRA_PROCUREMENT_FUNDING_TOTAL_TOOL_CALL_LIMIT,27);
  assert.equal(ULTRA_PROCUREMENT_FUNDING_MAX_RESULTS,35);
  assert.deepEqual(ULTRA_PROCUREMENT_FUNDING_SHARDS.map((item)=>item.id),ULTRA_PROCUREMENT_FUNDING_SHARD_IDS);
  assert.deepEqual(ULTRA_PROCUREMENT_FUNDING_SHARD_IDS.filter((id)=>ULTRA_CORE_DISCOVERY_SHARD_IDS.includes(id)),[]);
  assert.equal(validateUltraProcurementFundingPlan(ULTRA_PROCUREMENT_FUNDING_SHARDS.slice(1)),false);

  const domains=new Set(ULTRA_PROCUREMENT_FUNDING_SHARDS.flatMap((item)=>item.allowed_domains));
  for (const domain of ["ted.europa.eu","een.ec.europa.eu","nen.nipez.cz","uvo.gov.sk","josephine.proebiz.com","mk.gov.cz","fpu.sk","find-tender.service.gov.uk","contractsfinder.service.gov.uk"]) {
    assert.equal(domains.has(domain),true,domain);
  }
  const grant=ULTRA_PROCUREMENT_FUNDING_SHARDS.find((item)=>item.id==="cz_sk_heritage_funding");
  assert.match(grant.focus,/POTENTIAL_LEAD/);
  assert.match(grant.focus,/Never label a grant as OPEN_OPPORTUNITY/);
  assert.match(grant.focus,/never treat the grant amount as buyer project budget/);
});

test("CORE and PROCUREMENT_FUNDING settle sequentially under one paid root", async () => {
  const repository=createStateRepository(memoryStore());
  const coordinator=memoryPaidCoordinator({capMicrousd:15_000_000,lifecycleMode:"MULTI_OPERATION"});
  let run=await rootAfterNative(repository,"request_ultra_sequential");
  let coreCalls=0;
  const coreExecutor=createUltraCoreDiscoveryExecutor({coordinator,apiKey:"test-key",profile:PROFILE,nowIso:NOW,searchRunner:async(input)=>{
    coreCalls+=1;
    return searchResult(input.shards,{webCalls:22,candidates:17,id:"record-core"});
  }});
  let operationId=ultraMaxNextOperationId(run,"CORE_DISCOVERY");
  run=(await executeUltraMaxPhase({repository,runId:run.run_id,phaseId:"CORE_DISCOVERY",operationId,nowIso:NOW,execute:coreExecutor})).run;
  assert.equal(run.paid_coordinator_version,4);

  let procurementCalls=0;
  const procurementExecutor=createUltraProcurementFundingExecutor({coordinator,apiKey:"test-key",profile:PROFILE,nowIso:NOW,searchRunner:async(input)=>{
    procurementCalls+=1;
    assert.deepEqual(input.shards.map((item)=>item.id),ULTRA_PROCUREMENT_FUNDING_SHARD_IDS);
    assert.equal(input.searchProfile,"ULTRA_PROCUREMENT_FUNDING");
    assert.equal(input.maxResults,35);
    assert.equal(input.maxToolCallsPerShard,3);
    return searchResult(input.shards,{webCalls:18,candidates:13,id:"record-procurement"});
  }});
  operationId=ultraMaxNextOperationId(run,"PROCUREMENT_FUNDING");
  const completed=await executeUltraMaxPhase({repository,runId:run.run_id,phaseId:"PROCUREMENT_FUNDING",operationId,nowIso:NOW,execute:procurementExecutor});
  assert.equal(coreCalls,1);
  assert.equal(procurementCalls,1);
  assert.equal(completed.run.plan_snapshot.phases[2].status,"COMPLETED");
  assert.equal(completed.run.paid_coordinator_version,8);
  assert.equal(completed.run.usage.openai_requests,ULTRA_CORE_OPENAI_REQUEST_LIMIT+ULTRA_PROCUREMENT_FUNDING_OPENAI_REQUEST_LIMIT);
  assert.equal(completed.run.usage.web_search_calls,40);
  assert.equal(completed.run.usage.candidates_seen,30);
  assert.equal(completed.run.usage.results_accepted,2);

  const replay=await executeUltraMaxPhase({repository,runId:run.run_id,phaseId:"PROCUREMENT_FUNDING",operationId,nowIso:NOW,execute:async()=>{procurementCalls+=1;}});
  assert.equal(replay.replayed,true);
  assert.equal(procurementCalls,1);
});

test("PROCUREMENT_FUNDING boundary overflow becomes UNCERTAIN without redispatch", async () => {
  const repository=createStateRepository(memoryStore());
  const coordinator=memoryPaidCoordinator({capMicrousd:15_000_000,lifecycleMode:"MULTI_OPERATION"});
  let run=await rootAfterNative(repository,"request_ultra_procurement_overflow");
  run=(await executeUltraMaxPhase({
    repository,runId:run.run_id,phaseId:"CORE_DISCOVERY",operationId:ultraMaxNextOperationId(run,"CORE_DISCOVERY"),nowIso:NOW,
    execute:createUltraCoreDiscoveryExecutor({coordinator,apiKey:"test-key",profile:PROFILE,nowIso:NOW,searchRunner:async(input)=>searchResult(input.shards,{webCalls:22,candidates:17,id:"record-core"})})
  })).run;
  let calls=0;
  const executor=createUltraProcurementFundingExecutor({coordinator,apiKey:"test-key",profile:PROFILE,nowIso:NOW,searchRunner:async(input)=>{
    calls+=1;
    return searchResult(input.shards,{webCalls:28,candidates:13,id:"record-overflow"});
  }});
  const operationId=ultraMaxNextOperationId(run,"PROCUREMENT_FUNDING");
  await assert.rejects(()=>executeUltraMaxPhase({repository,runId:run.run_id,phaseId:"PROCUREMENT_FUNDING",operationId,nowIso:NOW,execute:executor}),/ULTRA_PAID_DISPATCH_UNCERTAIN/);
  assert.equal(calls,1);
  assert.equal((await repository.getUltraMaxRun(run.run_id)).status,"UNCERTAIN");
  assert.equal(coordinator.runs.get(run.run_id).status,"UNCERTAIN");
  const replay=await executeUltraMaxPhase({repository,runId:run.run_id,phaseId:"PROCUREMENT_FUNDING",operationId,nowIso:NOW,execute:async()=>{calls+=1;}});
  assert.equal(replay.replayed,true);
  assert.equal(calls,1);
});
