import { runWideOpportunitySearch } from "./openai-search.mjs";
import { estimateSearchCost } from "./search-cost.mjs";
import { executeUltraPaidChild } from "./ultra-paid-operation-service.mjs";

function usageFor(result,estimatedCost) {
  return {
    source_requests:0,
    openai_requests:Number(result.openai_request_count)||0,
    web_search_calls:Number(result.web_search_call_count)||0,
    cost_microusd:Math.ceil(estimatedCost.total_usd*1_000_000),
    candidates_seen:Number(result.counters?.candidates_seen)||0,
    results_accepted:Array.isArray(result.opportunities)?result.opportunities.length:0
  };
}

function payloadFor(result,estimatedCost,phaseId,searchProfile) {
  return {
    phase_id:phaseId,
    search_profile:searchProfile,
    search_status:result.search_status,
    records:result.records||result.opportunities||[],
    coverage:result.coverage||[],
    diagnostics:result.diagnostics||null,
    model:result.model||null,
    response_ids:result.response_ids||[],
    estimated_cost:estimatedCost
  };
}

export function createUltraHostedDiscoveryExecutor({
  coordinator,apiKey,model="gpt-5.6-luna",profile,nowIso,searchRunner=runWideOpportunitySearch,fetchImpl=fetch,
  phaseId,searchProfile,budgetCapMicrousd,shards,maxResults,resultsPerShard=6,toolCallsPerShard=3,maxOutputTokensPerShard=6000,maxConcurrency=5,validatePlan
}={}) {
  if (!apiKey) throw new Error("ULTRA_HOSTED_API_KEY_REQUIRED");
  if (!profile?.capabilities||!Array.isArray(profile.credentials)) throw new Error("ULTRA_HOSTED_PROFILE_REQUIRED");
  if (!Number.isFinite(Date.parse(nowIso))) throw new Error("ULTRA_HOSTED_TIMESTAMP_INVALID");
  if (typeof validatePlan!=="function"||!validatePlan(shards)) throw new Error("ULTRA_HOSTED_PLAN_INVALID");
  const requestLimit=shards.length;
  const webCallLimit=requestLimit*toolCallsPerShard;
  return async ({run,phase,operationId}={})=>{
    if (phase?.phase_id!==phaseId||phase.kind!=="PAID_HOSTED_SEARCH"||phase.budget_cap_microusd!==budgetCapMicrousd) throw new Error("ULTRA_HOSTED_PHASE_MISMATCH");
    const paid=await executeUltraPaidChild({
      coordinator,run,phaseId,operationId,expectedVersion:run.paid_coordinator_version,
      dispatch:async()=>{
        const result=await searchRunner({apiKey,model,profile,nowIso,shards,maxResults,maxResultsPerShard:resultsPerShard,maxToolCallsPerShard:toolCallsPerShard,maxOutputTokensPerShard,maxConcurrency,fetchImpl,searchProfile});
        if (result.attempts!==1
          || result.openai_request_count!==requestLimit
          || result.web_search_call_count>webCallLimit
          || !Array.isArray(result.opportunities)
          || result.opportunities.length>maxResults) throw new Error("ULTRA_HOSTED_REQUEST_BOUNDARY_EXCEEDED");
        const estimatedCost=estimateSearchCost({model:result.model,usage:result.usage,webSearchCalls:result.web_search_call_count});
        if (!estimatedCost) throw new Error("ULTRA_HOSTED_COST_UNKNOWN");
        return {usage:usageFor(result,estimatedCost),payload:payloadFor(result,estimatedCost,phaseId,searchProfile)};
      }
    });
    return {complete:true,usage:paid.result.usage,payload:paid.result.payload,paid_coordinator_version:paid.coordinator_version};
  };
}
