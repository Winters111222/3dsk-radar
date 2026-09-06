import { envValue } from "./runtime.mjs";
import {
  WIDE_SEARCH_MAX_OPENAI_REQUESTS,
  WIDE_SEARCH_MAX_TOOL_CALLS_PER_SHARD,
  WIDE_SEARCH_MAX_TOTAL_TOOL_CALLS,
  WIDE_SEARCH_SHARDS,
  validateWideSearchPlan
} from "./wide-search-plan.mjs";

export const PRODUCTION_SEARCH_MODEL = "gpt-5.6-luna";
export const PRODUCTION_SEARCH_MAX_CAP_MICROUSD = 500_000;
export const PRODUCTION_SEARCH_MAX_RESULTS = 6;
export const PRODUCTION_SEARCH_MAX_TOOL_CALLS = 3;
export const PRODUCTION_SEARCH_MAX_OUTPUT_TOKENS = 8000;
export const PRODUCTION_WIDE_SEARCH_MAX_CAP_MICROUSD = 2_000_000;
export const PRODUCTION_WIDE_SEARCH_MAX_RESULTS = 24;
export const PRODUCTION_WIDE_SEARCH_MAX_OUTPUT_TOKENS_PER_SHARD = 6000;

const enabled = (value) => String(value || "").toLowerCase() === "true";

export function productionSearchEnabled(getEnv = envValue) {
  return enabled(getEnv("RADAR_PRODUCTION_SEARCH_ENABLED"));
}

export function productionSearchContextAllowed(context) {
  return context?.deploy?.context === "production";
}

export function productionSearchConfiguration({ getEnv = envValue, nowIso = new Date().toISOString() } = {}) {
  const requestedProfile = String(getEnv("RADAR_PRODUCTION_SEARCH_PROFILE") || "FOCUSED").trim().toUpperCase();
  const wide = requestedProfile === "WIDE_INDEX";
  if (!wide && requestedProfile !== "FOCUSED") return { ok:false };
  const usdText = String(getEnv("RADAR_PRODUCTION_SEARCH_MAX_USD") || "").trim();
  const resultText = String(getEnv("RADAR_PRODUCTION_SEARCH_MAX_RESULTS") || "").trim();
  const usd = Number(usdText);
  const maxResults = Number(resultText);
  const windowMatch = String(nowIso).match(/^(\d{4})-(\d{2})-(\d{2})T/);
  const capMicrousd = Math.round(usd * 1_000_000);
  const expectedCap = wide ? PRODUCTION_WIDE_SEARCH_MAX_CAP_MICROUSD : PRODUCTION_SEARCH_MAX_CAP_MICROUSD;
  const expectedMaxResults = wide ? PRODUCTION_WIDE_SEARCH_MAX_RESULTS : PRODUCTION_SEARCH_MAX_RESULTS;
  const valid = usdText !== ""
    && Number.isFinite(usd)
    && capMicrousd === expectedCap
    && resultText !== ""
    && Number.isInteger(maxResults)
    && maxResults >= 1
    && (wide ? maxResults === expectedMaxResults : maxResults <= expectedMaxResults)
    && Boolean(windowMatch)
    && Number.isFinite(Date.parse(nowIso))
    && (!wide || validateWideSearchPlan());

  if (!valid) return { ok:false };
  const windowUtc = `${windowMatch[1]}-${windowMatch[2]}-${windowMatch[3]}`;
  return {
    ok:true,
    mode:wide ? "PRODUCTION_DAILY_WIDE_INDEX" : "PRODUCTION_DAILY",
    search_profile:wide ? "WIDE_INDEX" : "FOCUSED",
    run_id:wide
      ? `prod-wide-index-search-${windowUtc.replaceAll("-", "")}`
      : `prod-search-${windowUtc.replaceAll("-", "")}`,
    operation_id:wide ? "daily-wide-index-search" : "daily-focused-search",
    reservation_id:wide ? "daily-wide-index-budget" : "daily-focused-budget",
    window_utc:windowUtc,
    cap_microusd:capMicrousd,
    max_results:maxResults,
    model:PRODUCTION_SEARCH_MODEL,
    allow_structured_retry:false,
    openai_request_limit:wide ? WIDE_SEARCH_MAX_OPENAI_REQUESTS : 1,
    max_tool_calls:wide ? WIDE_SEARCH_MAX_TOTAL_TOOL_CALLS : PRODUCTION_SEARCH_MAX_TOOL_CALLS,
    max_tool_calls_per_request:wide ? WIDE_SEARCH_MAX_TOOL_CALLS_PER_SHARD : PRODUCTION_SEARCH_MAX_TOOL_CALLS,
    max_output_tokens:wide ? PRODUCTION_WIDE_SEARCH_MAX_OUTPUT_TOKENS_PER_SHARD : PRODUCTION_SEARCH_MAX_OUTPUT_TOKENS,
    shards:wide ? WIDE_SEARCH_SHARDS : null,
    now_iso:nowIso
  };
}

export function productionSearchState({ context, getEnv = envValue } = {}) {
  if (!enabled(getEnv("RADAR_LIVE_AI_ENABLED")) || !productionSearchEnabled(getEnv)) return "LOCKED";
  if (!productionSearchContextAllowed(context)) return "CONTEXT_BLOCKED";
  return productionSearchConfiguration({ getEnv }).ok ? "READY" : "CONFIG_BLOCKED";
}
