import { WIDE_MAX_SEARCH_SHARDS } from "./wide-max-search-plan.mjs";

export const ULTRA_MULTILINGUAL_LONG_TAIL_SHARD_IDS = Object.freeze([
  "english_marketplace_freshness",
  "german_french_buyer_sweep",
  "romance_buyer_sweep",
  "central_europe_buyer_sweep",
  "active_backfill_31_90_days"
]);

const byId = new Map(WIDE_MAX_SEARCH_SHARDS.map((shard)=>[shard.id,shard]));
export const ULTRA_MULTILINGUAL_LONG_TAIL_SHARDS = Object.freeze(ULTRA_MULTILINGUAL_LONG_TAIL_SHARD_IDS.map((id)=>byId.get(id)));
export const ULTRA_MULTILINGUAL_LONG_TAIL_OPENAI_REQUEST_LIMIT = ULTRA_MULTILINGUAL_LONG_TAIL_SHARDS.length;
export const ULTRA_MULTILINGUAL_LONG_TAIL_TOOL_CALLS_PER_SHARD = 3;
export const ULTRA_MULTILINGUAL_LONG_TAIL_TOTAL_TOOL_CALL_LIMIT = ULTRA_MULTILINGUAL_LONG_TAIL_OPENAI_REQUEST_LIMIT * ULTRA_MULTILINGUAL_LONG_TAIL_TOOL_CALLS_PER_SHARD;
export const ULTRA_MULTILINGUAL_LONG_TAIL_RESULTS_PER_SHARD = 6;
export const ULTRA_MULTILINGUAL_LONG_TAIL_MAX_RESULTS = 30;
export const ULTRA_MULTILINGUAL_LONG_TAIL_MAX_CONCURRENCY = 5;

export function validateUltraMultilingualLongTailPlan(shards=ULTRA_MULTILINGUAL_LONG_TAIL_SHARDS) {
  if (!Array.isArray(shards) || shards.length!==ULTRA_MULTILINGUAL_LONG_TAIL_SHARD_IDS.length) return false;
  return shards.every((shard,index)=>shard?.id===ULTRA_MULTILINGUAL_LONG_TAIL_SHARD_IDS[index]
    && shard.allowed_domains?.length>0
    && typeof shard.focus==="string"
    && /sweep|freshness|backfill/.test(shard.id));
}
