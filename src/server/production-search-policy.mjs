import { envValue } from "./runtime.mjs";
import {
  WIDE_SEARCH_MAX_OPENAI_REQUESTS,
  WIDE_SEARCH_MAX_TOOL_CALLS_PER_SHARD,
  WIDE_SEARCH_MAX_TOTAL_TOOL_CALLS,
  WIDE_SEARCH_SHARDS,
  validateWideSearchPlan
} from "./wide-search-plan.mjs";
import { FIRECRAWL_MAX_CREDITS, FIRECRAWL_MAX_REQUESTS } from "./firecrawl-discovery.mjs";
import {
  WIDE_V3_MAX_HOSTED_SEARCH_CALLS,
  WIDE_V3_MAX_OPENAI_REQUESTS,
  WIDE_V3_SEARCH_SHARDS,
  validateWideV3Plan,
  wideV3FirecrawlShards
} from "./wide-v3-source-plan.mjs";
import { OFFICIAL_SOURCE_MAX_REQUESTS, officialSourceRunPlan } from "./official-source-run.mjs";

export const PRODUCTION_SEARCH_MODEL = "gpt-5.6-luna";
export const PRODUCTION_SEARCH_MAX_CAP_MICROUSD = 500_000;
export const PRODUCTION_SEARCH_MAX_RESULTS = 6;
export const PRODUCTION_SEARCH_MAX_TOOL_CALLS = 3;
export const PRODUCTION_SEARCH_MAX_OUTPUT_TOKENS = 8000;
export const PRODUCTION_WIDE_SEARCH_MAX_CAP_MICROUSD = 2_000_000;
export const PRODUCTION_WIDE_SEARCH_MAX_RESULTS = 24;
export const PRODUCTION_WIDE_SEARCH_MAX_OUTPUT_TOKENS_PER_SHARD = 6000;
export const PRODUCTION_WIDE_SEARCH_RECOVERY_SLOT = "2";
export const PRODUCTION_WIDE_V3_MODEL = "gpt-5.6-sol";
export const PRODUCTION_WIDE_V3_MAX_CAP_MICROUSD = 3_000_000;
export const PRODUCTION_WIDE_V3_MAX_RESULTS = 32;

const enabled = (value) => String(value || "").toLowerCase() === "true";

export function productionSearchEnabled(getEnv = envValue) {
  return enabled(getEnv("RADAR_PRODUCTION_SEARCH_ENABLED"));
}

export function productionSearchContextAllowed(context) {
  return context?.deploy?.context === "production";
}

export function productionSearchConfiguration({ getEnv = envValue, nowIso = new Date().toISOString() } = {}) {
  const requestedProfile = String(getEnv("RADAR_PRODUCTION_SEARCH_PROFILE") || "FOCUSED").trim().toUpperCase();
  const wideV2 = requestedProfile === "WIDE_INDEX";
  const wideV3 = requestedProfile === "WIDE_V3";
  const wide = wideV2 || wideV3;
  if (!wide && requestedProfile !== "FOCUSED") return { ok:false };
  const recoverySlot = String(getEnv("RADAR_PRODUCTION_SEARCH_WIDE_RECOVERY_SLOT") || "").trim();
  const recovery = wideV2 && recoverySlot === PRODUCTION_WIDE_SEARCH_RECOVERY_SLOT;
  const firecrawlEnabled = wide && enabled(getEnv("RADAR_FIRECRAWL_WIDE_ENABLED"));
  const officialSourcesEnabled = wideV3 && enabled(getEnv("RADAR_OFFICIAL_SOURCE_DISCOVERY_ENABLED"));
  const officialSourceRequestLimitText = String(getEnv("RADAR_OFFICIAL_SOURCE_MAX_REQUESTS") || "").trim();
  const officialSourceRequestLimit = Number(officialSourceRequestLimitText);
  const officialSourcePlan = officialSourcesEnabled ? officialSourceRunPlan(getEnv) : [];
  const firecrawlCreditsText = String(getEnv("RADAR_FIRECRAWL_MAX_CREDITS") || "").trim();
  const firecrawlCredits = Number(firecrawlCreditsText);
  const usdText = String(getEnv("RADAR_PRODUCTION_SEARCH_MAX_USD") || "").trim();
  const resultText = String(getEnv("RADAR_PRODUCTION_SEARCH_MAX_RESULTS") || "").trim();
  const usd = Number(usdText);
  const maxResults = Number(resultText);
  const windowMatch = String(nowIso).match(/^(\d{4})-(\d{2})-(\d{2})T/);
  const capMicrousd = Math.round(usd * 1_000_000);
  const expectedCap = wideV3 ? PRODUCTION_WIDE_V3_MAX_CAP_MICROUSD : wideV2 ? PRODUCTION_WIDE_SEARCH_MAX_CAP_MICROUSD : PRODUCTION_SEARCH_MAX_CAP_MICROUSD;
  const expectedMaxResults = wideV3 ? PRODUCTION_WIDE_V3_MAX_RESULTS : wideV2 ? PRODUCTION_WIDE_SEARCH_MAX_RESULTS : PRODUCTION_SEARCH_MAX_RESULTS;
  const valid = usdText !== ""
    && Number.isFinite(usd)
    && capMicrousd === expectedCap
    && resultText !== ""
    && Number.isInteger(maxResults)
    && maxResults >= 1
    && (wide ? maxResults === expectedMaxResults : maxResults <= expectedMaxResults)
    && Boolean(windowMatch)
    && Number.isFinite(Date.parse(nowIso))
    && (recoverySlot === "" || recovery)
    && (!firecrawlEnabled || (firecrawlCreditsText !== "" && firecrawlCredits === FIRECRAWL_MAX_CREDITS))
    && (!wideV2 || validateWideSearchPlan())
    && (!wideV3 || validateWideV3Plan())
    && (!wideV3 || officialSourcesEnabled)
    && (!officialSourcesEnabled || (officialSourceRequestLimitText !== ""
      && officialSourceRequestLimit === OFFICIAL_SOURCE_MAX_REQUESTS
      && officialSourcePlan.length > 0));

  if (!valid) return { ok:false };
  const windowUtc = `${windowMatch[1]}-${windowMatch[2]}-${windowMatch[3]}`;
  return {
    ok:true,
    mode:wideV3 ? "PRODUCTION_DAILY_WIDE_V3" : wideV2 ? (recovery ? "PRODUCTION_APPROVED_WIDE_RECOVERY" : "PRODUCTION_DAILY_WIDE_INDEX") : "PRODUCTION_DAILY",
    search_profile:wideV3 ? "WIDE_V3" : wideV2 ? "WIDE_INDEX" : "FOCUSED",
    run_id:wideV3
      ? `prod-wide-v3-search-${windowUtc.replaceAll("-", "")}`
      : wideV2
      ? `prod-wide-index-search-${windowUtc.replaceAll("-", "")}${recovery ? `-recovery-${PRODUCTION_WIDE_SEARCH_RECOVERY_SLOT}` : ""}`
      : `prod-search-${windowUtc.replaceAll("-", "")}`,
    operation_id:wideV3 ? "daily-wide-v3-search" : wideV2 ? (recovery ? `approved-wide-recovery-${PRODUCTION_WIDE_SEARCH_RECOVERY_SLOT}` : "daily-wide-index-search") : "daily-focused-search",
    reservation_id:wideV3 ? "daily-wide-v3-budget" : wideV2 ? (recovery ? `approved-wide-recovery-budget-${PRODUCTION_WIDE_SEARCH_RECOVERY_SLOT}` : "daily-wide-index-budget") : "daily-focused-budget",
    window_utc:windowUtc,
    cap_microusd:capMicrousd,
    max_results:maxResults,
    model:wideV3 ? PRODUCTION_WIDE_V3_MODEL : PRODUCTION_SEARCH_MODEL,
    allow_structured_retry:false,
    openai_request_limit:wideV3 ? WIDE_V3_MAX_OPENAI_REQUESTS : wideV2 ? WIDE_SEARCH_MAX_OPENAI_REQUESTS : 1,
    max_tool_calls:wideV3 ? WIDE_V3_MAX_HOSTED_SEARCH_CALLS : wideV2 ? WIDE_SEARCH_MAX_TOTAL_TOOL_CALLS : PRODUCTION_SEARCH_MAX_TOOL_CALLS,
    max_tool_calls_per_request:wide ? WIDE_SEARCH_MAX_TOOL_CALLS_PER_SHARD : PRODUCTION_SEARCH_MAX_TOOL_CALLS,
    max_output_tokens:wide ? PRODUCTION_WIDE_SEARCH_MAX_OUTPUT_TOKENS_PER_SHARD : PRODUCTION_SEARCH_MAX_OUTPUT_TOKENS,
    shards:wideV3 ? WIDE_V3_SEARCH_SHARDS : wideV2 ? WIDE_SEARCH_SHARDS : null,
    firecrawl_shards:wideV3 ? wideV3FirecrawlShards() : wideV2 ? WIDE_SEARCH_SHARDS : null,
    firecrawl_enabled:firecrawlEnabled,
    firecrawl_request_limit:firecrawlEnabled ? FIRECRAWL_MAX_REQUESTS : 0,
    firecrawl_credit_cap:firecrawlEnabled ? FIRECRAWL_MAX_CREDITS : 0,
    official_sources_enabled:officialSourcesEnabled,
    official_source_request_limit:officialSourcesEnabled ? OFFICIAL_SOURCE_MAX_REQUESTS : 0,
    now_iso:nowIso
  };
}

export function productionSearchState({ context, getEnv = envValue } = {}) {
  if (!enabled(getEnv("RADAR_LIVE_AI_ENABLED")) || !productionSearchEnabled(getEnv)) return "LOCKED";
  if (!productionSearchContextAllowed(context)) return "CONTEXT_BLOCKED";
  return productionSearchConfiguration({ getEnv }).ok ? "READY" : "CONFIG_BLOCKED";
}
