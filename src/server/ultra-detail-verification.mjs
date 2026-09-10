import { ultraMaxNextOperationId } from "./ultra-max-run-contract.mjs";
import { createUltraHostedDiscoveryExecutor } from "./ultra-hosted-discovery.mjs";
import {
  buildUltraDetailVerificationShards,
  collectUltraDetailCandidates,
  ULTRA_DETAIL_MAX_CANDIDATES,
  ULTRA_DETAIL_MAX_CONCURRENCY,
  ULTRA_DETAIL_OBSERVED_PHASE_IDS,
  ULTRA_DETAIL_RESULTS_PER_CANDIDATE,
  ULTRA_DETAIL_TOOL_CALLS_PER_CANDIDATE,
  validateUltraDetailVerificationPlan
} from "./ultra-detail-verification-plan.mjs";

function remaining(limit,value) {
  return Math.max(0,Number(limit||0)-Number(value||0));
}

export async function loadUltraDetailEvidence({repository,run}={}) {
  if (!repository||typeof repository.getUltraMaxRunOperation!=="function") throw new Error("ULTRA_DETAIL_REPOSITORY_REQUIRED");
  const payloads=[];
  for (const phaseId of ULTRA_DETAIL_OBSERVED_PHASE_IDS) {
    const phase=run?.plan_snapshot?.phases?.find((item)=>item.phase_id===phaseId);
    if (!phase||phase.status!=="COMPLETED") throw new Error("ULTRA_DETAIL_PRIOR_PHASE_INCOMPLETE");
    const operation=await repository.getUltraMaxRunOperation(run.run_id,ultraMaxNextOperationId(run,phaseId));
    const payload=operation?.status==="COMPLETED"?operation?.result?.payload:null;
    if (!payload||payload.phase_id!==phaseId||!Array.isArray(payload.records)) throw new Error("ULTRA_DETAIL_EVIDENCE_REQUIRED");
    payloads.push(payload);
  }
  return payloads;
}

function detailCapacity(run) {
  const root=run?.plan_snapshot||{},usage=run?.usage||{};
  return Math.min(
    ULTRA_DETAIL_MAX_CANDIDATES,
    remaining(root.max_openai_requests,usage.openai_requests),
    Math.floor(remaining(root.max_web_search_calls,usage.web_search_calls)/ULTRA_DETAIL_TOOL_CALLS_PER_CANDIDATE)
  );
}

function skippedPayload(reason) {
  return {
    phase_id:"DETAIL_VERIFICATION",
    search_profile:"ULTRA_DETAIL_VERIFICATION",
    search_status:"SKIPPED",
    completion_reason:reason,
    records:[],
    coverage:[],
    verification:{selected_candidates:0,verified_candidates:0,rejected_candidates:0,candidate_results:[]}
  };
}

function discoveryHints(candidates,shards) {
  return {
    provider:"ULTRA_STORED_CANDIDATES",
    status:"STORED",
    requests:0,
    request_cap:0,
    sources:[],
    hints:candidates.map((record,index)=>({
      source_id:"ultra_stored_candidate",
      source_item_id:record.id,
      source_url:record.source_url,
      title:record.title,
      excerpt:String(record.summary||"").slice(0,1200),
      published_at:record.published_date||record.source_updated_date||null,
      author:record.company||null,
      discovery_only:true,
      requires_original_verification:true,
      shard_ids:[shards[index].id]
    }))
  };
}

function exactResultValidator(shards) {
  const urls=new Set(shards.map((shard)=>shard.candidate_source_url));
  const byShard=new Map(shards.map((shard)=>[shard.id,shard.candidate_source_url]));
  return (result)=>Array.isArray(result.coverage)
    && result.coverage.length===shards.length
    && result.coverage.every((item)=>byShard.has(item?.shard_id)
      && Array.isArray(item.verified_source_urls)
      && item.verified_source_urls.includes(byShard.get(item.shard_id)))
    && new Set(result.coverage.map((item)=>item.shard_id)).size===shards.length
    && result.opportunities.every((record)=>urls.has(record?.source_url));
}

function detailPayloadDecorator(candidates) {
  return (payload,result)=>{
    const byUrl=new Map(candidates.map((record)=>[record.source_url,record]));
    const verifiedUrls=new Set(result.opportunities.map((record)=>record.source_url));
    const rejectedByUrl=new Map((result.rejected_candidates||[]).map((record)=>[record.source_url,record.rejection_reason]));
    return {
      ...payload,
      records:result.opportunities,
      verification:{
        selected_candidates:candidates.length,
        verified_candidates:verifiedUrls.size,
        rejected_candidates:candidates.length-verifiedUrls.size,
        candidate_results:candidates.map((record)=>({
          candidate_id:record.id,
          source_url:record.source_url,
          status:verifiedUrls.has(record.source_url)?"VERIFIED":"REJECTED",
          ...(verifiedUrls.has(record.source_url)?{}:{rejection_reason:rejectedByUrl.get(record.source_url)||"detail_verification_failed"})
        })),
        verified_original_ids:result.opportunities.map((record)=>byUrl.get(record.source_url)?.id).filter(Boolean)
      }
    };
  };
}

export function createUltraDetailVerificationExecutor({repository,...dependencies}={}) {
  if (!repository||typeof repository.getUltraMaxRunOperation!=="function") throw new Error("ULTRA_DETAIL_REPOSITORY_REQUIRED");
  return async (context={})=>{
    const capacity=detailCapacity(context.run);
    if (capacity<1) return {complete:true,usage:{},payload:skippedPayload("ROOT_REQUEST_CAPACITY_EXHAUSTED")};
    const evidence=await loadUltraDetailEvidence({repository,run:context.run});
    const candidates=collectUltraDetailCandidates(evidence,capacity);
    if (!candidates.length) return {complete:true,usage:{},payload:skippedPayload("NO_VERIFIABLE_SALES_CANDIDATES")};
    const shards=buildUltraDetailVerificationShards(candidates);
    const execute=createUltraHostedDiscoveryExecutor({
      ...dependencies,
      phaseId:"DETAIL_VERIFICATION",
      phaseKind:"PAID_DETAIL_VERIFY",
      searchProfile:"ULTRA_DETAIL_VERIFICATION",
      budgetCapMicrousd:3_000_000,
      shards,
      maxResults:candidates.length,
      resultsPerShard:ULTRA_DETAIL_RESULTS_PER_CANDIDATE,
      toolCallsPerShard:ULTRA_DETAIL_TOOL_CALLS_PER_CANDIDATE,
      maxConcurrency:Math.min(ULTRA_DETAIL_MAX_CONCURRENCY,shards.length),
      validatePlan:validateUltraDetailVerificationPlan,
      validateResult:exactResultValidator(shards),
      mapUsage:(result,estimatedCost,usage)=>({...usage,candidates_seen:0,results_accepted:0}),
      decoratePayload:detailPayloadDecorator(candidates),
      prepareSearchInput:async()=>({officialDiscovery:discoveryHints(candidates,shards),includeVerificationEvidence:true})
    });
    return execute(context);
  };
}
