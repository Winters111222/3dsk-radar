import { envValue } from "./runtime.mjs";

export const PRODUCTION_SEARCH_MODEL = "gpt-5.6-luna";
export const PRODUCTION_SEARCH_MAX_CAP_MICROUSD = 500_000;
export const PRODUCTION_SEARCH_MAX_RESULTS = 6;
export const PRODUCTION_SEARCH_MAX_TOOL_CALLS = 3;
export const PRODUCTION_SEARCH_MAX_OUTPUT_TOKENS = 8000;

const enabled = (value) => String(value || "").toLowerCase() === "true";

export function productionSearchEnabled(getEnv = envValue) {
  return enabled(getEnv("RADAR_PRODUCTION_SEARCH_ENABLED"));
}

export function productionSearchContextAllowed(context) {
  return context?.deploy?.context === "production";
}

export function productionSearchConfiguration({ getEnv = envValue, nowIso = new Date().toISOString() } = {}) {
  const usdText = String(getEnv("RADAR_PRODUCTION_SEARCH_MAX_USD") || "").trim();
  const resultText = String(getEnv("RADAR_PRODUCTION_SEARCH_MAX_RESULTS") || "").trim();
  const usd = Number(usdText);
  const maxResults = Number(resultText);
  const windowMatch = String(nowIso).match(/^(\d{4})-(\d{2})-(\d{2})T/);
  const capMicrousd = Math.round(usd * 1_000_000);
  const valid = usdText !== ""
    && Number.isFinite(usd)
    && capMicrousd === PRODUCTION_SEARCH_MAX_CAP_MICROUSD
    && resultText !== ""
    && Number.isInteger(maxResults)
    && maxResults >= 1
    && maxResults <= PRODUCTION_SEARCH_MAX_RESULTS
    && Boolean(windowMatch)
    && Number.isFinite(Date.parse(nowIso));

  if (!valid) return { ok:false };
  const windowUtc = `${windowMatch[1]}-${windowMatch[2]}-${windowMatch[3]}`;
  return {
    ok:true,
    mode:"PRODUCTION_DAILY",
    run_id:`prod-search-${windowUtc.replaceAll("-", "")}`,
    operation_id:"daily-focused-search",
    reservation_id:"daily-focused-budget",
    window_utc:windowUtc,
    cap_microusd:capMicrousd,
    max_results:maxResults,
    model:PRODUCTION_SEARCH_MODEL,
    allow_structured_retry:false,
    max_tool_calls:PRODUCTION_SEARCH_MAX_TOOL_CALLS,
    max_output_tokens:PRODUCTION_SEARCH_MAX_OUTPUT_TOKENS,
    now_iso:nowIso
  };
}

export function productionSearchState({ context, getEnv = envValue } = {}) {
  if (!enabled(getEnv("RADAR_LIVE_AI_ENABLED")) || !productionSearchEnabled(getEnv)) return "LOCKED";
  if (!productionSearchContextAllowed(context)) return "CONTEXT_BLOCKED";
  return productionSearchConfiguration({ getEnv }).ok ? "READY" : "CONFIG_BLOCKED";
}
