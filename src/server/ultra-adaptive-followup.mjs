import { ultraMaxNextOperationId } from "./ultra-max-run-contract.mjs";
import { createUltraHostedDiscoveryExecutor } from "./ultra-hosted-discovery.mjs";
import {
  buildUltraAdaptiveFollowupPlan,
  ULTRA_ADAPTIVE_MAX_CONCURRENCY,
  ULTRA_ADAPTIVE_MAX_RESULTS,
  ULTRA_ADAPTIVE_MAX_SHARDS,
  ULTRA_ADAPTIVE_OBSERVED_PHASE_IDS,
  ULTRA_ADAPTIVE_RESULTS_PER_SHARD,
  ULTRA_ADAPTIVE_TOOL_CALLS_PER_SHARD,
  validateUltraAdaptiveFollowupPlan
} from "./ultra-adaptive-followup-plan.mjs";

function remaining(limit,value) {
  return Math.max(0,Number(limit||0)-Number(value||0));
}

export async function loadUltraAdaptiveEvidence({repository,run}={}) {
  if (!repository||typeof repository.getUltraMaxRunOperation!=="function") throw new Error("ULTRA_ADAPTIVE_REPOSITORY_REQUIRED");
  const payloads=[];
  for (const phaseId of ULTRA_ADAPTIVE_OBSERVED_PHASE_IDS) {
    const phase=run?.plan_snapshot?.phases?.find((item)=>item.phase_id===phaseId);
    if (!phase||phase.status!=="COMPLETED") throw new Error("ULTRA_ADAPTIVE_PRIOR_PHASE_INCOMPLETE");
    const operationId=ultraMaxNextOperationId(run,phaseId);
    const operation=await repository.getUltraMaxRunOperation(run.run_id,operationId);
    const payload=operation?.status==="COMPLETED"?operation?.result?.payload:null;
    if (!payload||payload.phase_id!==phaseId||!Array.isArray(payload.coverage)||!Array.isArray(payload.records)) {
      throw new Error("ULTRA_ADAPTIVE_EVIDENCE_REQUIRED");
    }
    payloads.push(payload);
  }
  return payloads;
}

function adaptiveCapacity(run) {
  const root=run?.plan_snapshot||{};
  const usage=run?.usage||{};
  const openai=remaining(root.max_openai_requests,usage.openai_requests);
  const web=remaining(root.max_web_search_calls,usage.web_search_calls);
  const candidates=remaining(root.max_candidates,usage.candidates_seen);
  const results=remaining(root.max_results,usage.results_accepted);
  if (!openai||web<ULTRA_ADAPTIVE_TOOL_CALLS_PER_SHARD||!candidates||!results) return null;
  const resultsPerShard=Math.min(ULTRA_ADAPTIVE_RESULTS_PER_SHARD,candidates);
  const maxShards=Math.min(ULTRA_ADAPTIVE_MAX_SHARDS,openai,Math.floor(web/ULTRA_ADAPTIVE_TOOL_CALLS_PER_SHARD),Math.floor(candidates/resultsPerShard));
  return maxShards>0?{maxShards,resultsPerShard,results}:null;
}

function skippedPayload(reason) {
  return {
    phase_id:"ADAPTIVE_FOLLOWUP",
    search_profile:"ULTRA_ADAPTIVE_FOLLOWUP",
    search_status:"SKIPPED",
    completion_reason:reason,
    records:[],
    coverage:[],
    adaptive_plan:{selected_shards:0,selections:[]}
  };
}

export function createUltraAdaptiveFollowupExecutor({repository,...dependencies}={}) {
  if (!repository||typeof repository.getUltraMaxRunOperation!=="function") throw new Error("ULTRA_ADAPTIVE_REPOSITORY_REQUIRED");
  return async (context={})=>{
    const capacity=adaptiveCapacity(context.run);
    if (!capacity) return {complete:true,usage:{},payload:skippedPayload("ROOT_CAPACITY_EXHAUSTED")};
    const evidence=await loadUltraAdaptiveEvidence({repository,run:context.run});
    const shards=buildUltraAdaptiveFollowupPlan({phasePayloads:evidence,maxShards:capacity.maxShards});
    const maxResults=Math.min(ULTRA_ADAPTIVE_MAX_RESULTS,capacity.results,shards.length*capacity.resultsPerShard);
    const execute=createUltraHostedDiscoveryExecutor({
      ...dependencies,
      phaseId:"ADAPTIVE_FOLLOWUP",
      searchProfile:"ULTRA_ADAPTIVE_FOLLOWUP",
      budgetCapMicrousd:3_000_000,
      shards,
      maxResults,
      resultsPerShard:capacity.resultsPerShard,
      toolCallsPerShard:ULTRA_ADAPTIVE_TOOL_CALLS_PER_SHARD,
      maxConcurrency:Math.min(ULTRA_ADAPTIVE_MAX_CONCURRENCY,shards.length),
      validatePlan:validateUltraAdaptiveFollowupPlan
    });
    const output=await execute(context);
    return {
      ...output,
      payload:{
        ...output.payload,
        adaptive_plan:{
          selected_shards:shards.length,
          results_per_shard:capacity.resultsPerShard,
          max_results:maxResults,
          selections:shards.map((shard)=>({
            shard_id:shard.id,
            origin_shard_id:shard.origin_shard_id,
            reason:shard.selection_reason,
            previous_candidates_seen:shard.previous_candidates_seen
          }))
        }
      }
    };
  };
}
