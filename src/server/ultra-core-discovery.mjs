import { runWideOpportunitySearch } from "./openai-search.mjs";
import { estimateSearchCost } from "./search-cost.mjs";
import { executeUltraPaidChild } from "./ultra-paid-operation-service.mjs";
import {
  ULTRA_CORE_DISCOVERY_SHARDS,
  ULTRA_CORE_MAX_CONCURRENCY,
  ULTRA_CORE_MAX_RESULTS,
  ULTRA_CORE_OPENAI_REQUEST_LIMIT,
  ULTRA_CORE_RESULTS_PER_SHARD,
  ULTRA_CORE_TOOL_CALLS_PER_SHARD,
  ULTRA_CORE_TOTAL_TOOL_CALL_LIMIT,
  validateUltraCoreDiscoveryPlan
} from "./ultra-core-discovery-plan.mjs";

function usageFor(result, estimatedCost) {
  return {
    source_requests:0,
    openai_requests:Number(result.openai_request_count)||0,
    web_search_calls:Number(result.web_search_call_count)||0,
    cost_microusd:Math.ceil(estimatedCost.total_usd*1_000_000),
    candidates_seen:Number(result.counters?.candidates_seen)||0,
    results_accepted:Array.isArray(result.opportunities)?result.opportunities.length:0
  };
}

function payloadFor(result, estimatedCost) {
  return {
    phase_id:"CORE_DISCOVERY",
    search_profile:"ULTRA_CORE_DISCOVERY",
    search_status:result.search_status,
    records:result.records||result.opportunities||[],
    coverage:result.coverage||[],
    diagnostics:result.diagnostics||null,
    model:result.model||null,
    response_ids:result.response_ids||[],
    estimated_cost:estimatedCost
  };
}

export function createUltraCoreDiscoveryExecutor({coordinator,apiKey,model="gpt-5.6-luna",profile,nowIso,searchRunner=runWideOpportunitySearch,fetchImpl=fetch}={}) {
  if (!apiKey) throw new Error("ULTRA_CORE_API_KEY_REQUIRED");
  if (!profile?.capabilities || !Array.isArray(profile.credentials)) throw new Error("ULTRA_CORE_PROFILE_REQUIRED");
  if (!Number.isFinite(Date.parse(nowIso))) throw new Error("ULTRA_CORE_TIMESTAMP_INVALID");
  if (!validateUltraCoreDiscoveryPlan()) throw new Error("ULTRA_CORE_PLAN_INVALID");
  return async ({run,phase,operationId}={}) => {
    if (phase?.phase_id!=="CORE_DISCOVERY" || phase.kind!=="PAID_HOSTED_SEARCH" || phase.budget_cap_microusd!==3_000_000) throw new Error("ULTRA_CORE_PHASE_MISMATCH");
    const paid=await executeUltraPaidChild({
      coordinator,run,phaseId:phase.phase_id,operationId,expectedVersion:run.paid_coordinator_version,
      dispatch:async()=>{
        const result=await searchRunner({
          apiKey,model,profile,nowIso,shards:ULTRA_CORE_DISCOVERY_SHARDS,
          maxResults:ULTRA_CORE_MAX_RESULTS,
          maxResultsPerShard:ULTRA_CORE_RESULTS_PER_SHARD,
          maxToolCallsPerShard:ULTRA_CORE_TOOL_CALLS_PER_SHARD,
          maxOutputTokensPerShard:6000,
          maxConcurrency:ULTRA_CORE_MAX_CONCURRENCY,
          fetchImpl,
          searchProfile:"ULTRA_CORE_DISCOVERY"
        });
        if (result.attempts!==1
          || result.openai_request_count!==ULTRA_CORE_OPENAI_REQUEST_LIMIT
          || result.web_search_call_count>ULTRA_CORE_TOTAL_TOOL_CALL_LIMIT) throw new Error("ULTRA_CORE_REQUEST_BOUNDARY_EXCEEDED");
        const estimatedCost=estimateSearchCost({model:result.model,usage:result.usage,webSearchCalls:result.web_search_call_count});
        if (!estimatedCost) throw new Error("ULTRA_CORE_COST_UNKNOWN");
        return {usage:usageFor(result,estimatedCost),payload:payloadFor(result,estimatedCost)};
      }
    });
    return {
      complete:true,
      usage:paid.result.usage,
      payload:paid.result.payload,
      paid_coordinator_version:paid.coordinator_version
    };
  };
}
