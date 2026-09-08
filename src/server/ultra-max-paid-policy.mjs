import { envValue } from "./runtime.mjs";
import { ULTRA_MAX_PROFILE } from "./ultra-max-run-contract.mjs";

export const ULTRA_MAX_PAID_CONFIRMATION = "RUN_ULTRA_MAX_15_USD_NO_RETRY";
export const ULTRA_MAX_PAID_MODEL = "gpt-5.6-luna";

function enabled(getEnv,key) {
  return String(getEnv(key)||"").toLowerCase()==="true";
}

export function ultraMaxPaidState({context,getEnv=envValue}={}) {
  if (!enabled(getEnv,"RADAR_ULTRA_MAX_ENABLED")||!enabled(getEnv,"RADAR_ULTRA_MAX_PAID_ENABLED")) return "LOCKED";
  if (!enabled(getEnv,"RADAR_LIVE_AI_ENABLED")) return "LIVE_AI_LOCKED";
  if (context?.deploy?.context!=="production") return "CONTEXT_BLOCKED";
  if (!String(getEnv("OPENAI_API_KEY")||"")) return "OPENAI_NOT_CONFIGURED";
  return "READY";
}

export function ultraMaxPaidConfiguration(options={}) {
  const state=ultraMaxPaidState(options);
  if (state!=="READY") return {ok:false,state};
  return {
    ok:true,
    state,
    model:ULTRA_MAX_PAID_MODEL,
    cap_microusd:ULTRA_MAX_PROFILE.max_cost_microusd,
    openai_request_limit:ULTRA_MAX_PROFILE.max_openai_requests,
    web_search_call_limit:ULTRA_MAX_PROFILE.max_web_search_calls,
    source_request_limit:ULTRA_MAX_PROFILE.max_source_requests,
    candidate_limit:ULTRA_MAX_PROFILE.max_candidates,
    result_limit:ULTRA_MAX_PROFILE.max_results,
    retry_allowed:false
  };
}

export function ultraMaxPaidConfirmationValid(value) {
  return value===ULTRA_MAX_PAID_CONFIRMATION;
}
