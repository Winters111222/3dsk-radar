import { WIDE_MAX_SEARCH_SHARDS } from "./wide-max-search-plan.mjs";

export const ULTRA_PROCUREMENT_FUNDING_SHARD_IDS = Object.freeze([
  "human_casting_capture_procurement",
  "een_business_requests",
  "een_technology_requests",
  "heritage_ted",
  "heritage_nen_cz",
  "heritage_uvo_sk",
  "human_capture_global_procurement",
  "cz_sk_heritage_funding",
  "heritage_uk_remote_processing"
]);

const byId = new Map(WIDE_MAX_SEARCH_SHARDS.map((shard)=>[shard.id,shard]));
export const ULTRA_PROCUREMENT_FUNDING_SHARDS = Object.freeze(ULTRA_PROCUREMENT_FUNDING_SHARD_IDS.map((id)=>byId.get(id)));
export const ULTRA_PROCUREMENT_FUNDING_OPENAI_REQUEST_LIMIT = ULTRA_PROCUREMENT_FUNDING_SHARDS.length;
export const ULTRA_PROCUREMENT_FUNDING_TOOL_CALLS_PER_SHARD = 3;
export const ULTRA_PROCUREMENT_FUNDING_TOTAL_TOOL_CALL_LIMIT = ULTRA_PROCUREMENT_FUNDING_OPENAI_REQUEST_LIMIT * ULTRA_PROCUREMENT_FUNDING_TOOL_CALLS_PER_SHARD;
export const ULTRA_PROCUREMENT_FUNDING_RESULTS_PER_SHARD = 6;
export const ULTRA_PROCUREMENT_FUNDING_MAX_RESULTS = 35;
export const ULTRA_PROCUREMENT_FUNDING_MAX_CONCURRENCY = 5;

export function validateUltraProcurementFundingPlan(shards=ULTRA_PROCUREMENT_FUNDING_SHARDS) {
  if (!Array.isArray(shards) || shards.length!==ULTRA_PROCUREMENT_FUNDING_SHARD_IDS.length) return false;
  return shards.every((shard,index)=>shard?.id===ULTRA_PROCUREMENT_FUNDING_SHARD_IDS[index]
    && shard.allowed_domains?.length>0
    && typeof shard.focus==="string"
    && /procurement|een_|heritage|funding/.test(shard.id));
}
