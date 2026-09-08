import { WIDE_MAX_SEARCH_SHARDS } from "./wide-max-search-plan.mjs";

export const ULTRA_CORE_DISCOVERY_SHARD_IDS = Object.freeze([
  "human_face_body_marketplaces",
  "human_ai_dataset_marketplaces",
  "realitycapture_processing",
  "wrap3d_face_pipeline",
  "zbrush_scan_cleanup",
  "substance_scan_texturing",
  "batch_scan_postproduction",
  "realistic_human_marketplace_projects",
  "digital_double_marketplace_projects",
  "character_overflow_communities",
  "marketplace_paid_tests_batches"
]);

const byId = new Map(WIDE_MAX_SEARCH_SHARDS.map((shard)=>[shard.id,shard]));
export const ULTRA_CORE_DISCOVERY_SHARDS = Object.freeze(ULTRA_CORE_DISCOVERY_SHARD_IDS.map((id)=>byId.get(id)));
export const ULTRA_CORE_OPENAI_REQUEST_LIMIT = ULTRA_CORE_DISCOVERY_SHARDS.length;
export const ULTRA_CORE_TOOL_CALLS_PER_SHARD = 3;
export const ULTRA_CORE_TOTAL_TOOL_CALL_LIMIT = ULTRA_CORE_OPENAI_REQUEST_LIMIT * ULTRA_CORE_TOOL_CALLS_PER_SHARD;
export const ULTRA_CORE_RESULTS_PER_SHARD = 6;
export const ULTRA_CORE_MAX_RESULTS = 40;
export const ULTRA_CORE_MAX_CONCURRENCY = 5;

export function validateUltraCoreDiscoveryPlan(shards=ULTRA_CORE_DISCOVERY_SHARDS) {
  if (!Array.isArray(shards) || shards.length!==ULTRA_CORE_DISCOVERY_SHARD_IDS.length) return false;
  return shards.every((shard,index)=>shard?.id===ULTRA_CORE_DISCOVERY_SHARD_IDS[index]
    && shard.allowed_domains?.length>0
    && typeof shard.focus==="string"
    && !/grant|funding|multilingual|backfill/i.test(shard.id));
}
