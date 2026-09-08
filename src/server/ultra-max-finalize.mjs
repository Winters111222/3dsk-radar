import { loadUltraDetailEvidence } from "./ultra-detail-verification.mjs";

function addUsage(left={},right={}) {
  return Object.fromEntries([
    "source_requests","openai_requests","web_search_calls","cost_microusd","candidates_seen","results_accepted"
  ].map((key)=>[key,Number(left[key]||0)+Number(right[key]||0)]));
}

export async function persistUltraMaxVerifiedResults({repository,run,detailOutput,nowIso}={}) {
  if (!repository||typeof repository.mergeSearchResultsWithStats!=="function"||typeof repository.saveSearchRun!=="function") {
    throw new Error("ULTRA_FINALIZE_REPOSITORY_REQUIRED");
  }
  const records=detailOutput?.payload?.records;
  if (!Array.isArray(records)) throw new Error("ULTRA_FINALIZE_VERIFIED_RECORDS_REQUIRED");
  const cancel=typeof repository.getUltraMaxRunCancel==="function"?await repository.getUltraMaxRunCancel(run.run_id):null;
  if (cancel?.requested_at) return {cancelled:true};
  const prior=await loadUltraDetailEvidence({repository,run});
  const payloads=[...prior,detailOutput.payload];
  const merge=await repository.mergeSearchResultsWithStats(records,nowIso);
  const usage=addUsage(run.usage,detailOutput.usage);
  const coverage=payloads.flatMap((payload)=>Array.isArray(payload.coverage)?payload.coverage:[]);
  const sourceYield=payloads.flatMap((payload)=>Array.isArray(payload.diagnostics?.source_yield)?payload.diagnostics.source_yield:[]);
  const searchRun={
    mode:"ULTRA_MAX",
    search_profile:"ULTRA_MAX",
    search_status:"COMPLETE",
    run_id:run.run_id,
    completed_at:nowIso,
    model:"gpt-5.6-luna",
    attempts:1,
    retry_allowed:false,
    coverage,
    diagnostics:{source_yield:sourceYield,rejection_reasons:{},zero_result_reason:records.length?null:"NO_VERIFIED_RESULTS_AFTER_DETAIL"},
    returned_count:records.length,
    counters:{
      collector_mode:"ULTRA_MAX",
      source_requests:usage.source_requests,
      openai_requests:usage.openai_requests,
      web_search_calls:usage.web_search_calls,
      candidates_seen:usage.candidates_seen,
      candidates_verified:records.length,
      new_opportunities:merge.new_count,
      updated_opportunities:merge.updated_count,
      workspace_total:merge.workspace_total,
      workspace_record_total:merge.workspace_record_total,
      workspace_competitor_total:merge.workspace_competitor_total,
      workspace_source_platform_total:merge.workspace_source_platform_total
    },
    usage,
    web_search_call_count:usage.web_search_calls,
    estimated_cost_usd:usage.cost_microusd/1_000_000,
    persistence:"NETLIFY_BLOBS",
    verification:detailOutput.payload.verification
  };
  await repository.saveSearchRun(searchRun);
  return {
    new_count:merge.new_count,
    updated_count:merge.updated_count,
    workspace_total:merge.workspace_total,
    workspace_record_total:merge.workspace_record_total,
    workspace_competitor_total:merge.workspace_competitor_total,
    workspace_source_platform_total:merge.workspace_source_platform_total
  };
}
