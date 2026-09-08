import { WIDE_V3_SEARCH_SHARDS } from "./wide-v3-source-plan.mjs";

export const ULTRA_SIGNAL_EXPANSION_SHARD_IDS = Object.freeze([
  "contract_boards",
  "ats_external_development",
  "social_signals",
  "supplier_and_partner"
]);

const byId = new Map(WIDE_V3_SEARCH_SHARDS.map((shard)=>[shard.id,shard]));
export const ULTRA_SIGNAL_EXPANSION_SHARDS = Object.freeze(ULTRA_SIGNAL_EXPANSION_SHARD_IDS.map((id)=>byId.get(id)));
export const ULTRA_SIGNAL_EXPANSION_OPENAI_REQUEST_LIMIT = ULTRA_SIGNAL_EXPANSION_SHARDS.length;
export const ULTRA_SIGNAL_EXPANSION_TOOL_CALLS_PER_SHARD = 3;
export const ULTRA_SIGNAL_EXPANSION_TOTAL_TOOL_CALL_LIMIT = ULTRA_SIGNAL_EXPANSION_OPENAI_REQUEST_LIMIT * ULTRA_SIGNAL_EXPANSION_TOOL_CALLS_PER_SHARD;
export const ULTRA_SIGNAL_EXPANSION_RESULTS_PER_SHARD = 5;
export const ULTRA_SIGNAL_EXPANSION_MAX_RESULTS = 20;
export const ULTRA_SIGNAL_EXPANSION_MAX_CONCURRENCY = 4;
export const ULTRA_SIGNAL_EXPANSION_MAX_STORED_SIGNALS = 25;

export function validateUltraSignalExpansionPlan(shards=ULTRA_SIGNAL_EXPANSION_SHARDS) {
  if (!Array.isArray(shards)||shards.length!==ULTRA_SIGNAL_EXPANSION_SHARD_IDS.length) return false;
  return shards.every((shard,index)=>shard?.id===ULTRA_SIGNAL_EXPANSION_SHARD_IDS[index]
    && shard.allowed_domains?.length>0
    && typeof shard.focus==="string"
    && (shard.signal_only_domains||[]).every((domain)=>shard.allowed_domains.includes(domain)));
}
