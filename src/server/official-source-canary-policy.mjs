import { sourceConnectorReadiness } from "./wide-v3-source-plan.mjs";

export const OFFICIAL_SOURCE_CANARY_CONFIRMATION = "RUN_WIDE_V3_FREE_SOURCE_CANARY_ONCE";

const PROFILES = Object.freeze({
  BLUESKY_ONLY:Object.freeze({ source_ids:Object.freeze(["bluesky_public"]), request_limit:1 }),
  BLUESKY_MASTODON:Object.freeze({ source_ids:Object.freeze(["bluesky_public", "mastodon_official"]), request_limit:2 })
});

const enabled = (value) => String(value || "").trim().toLowerCase() === "true";

export function officialSourceCanaryConfiguration({ context, getEnv = (key) => process.env[key] } = {}) {
  if (context?.deploy?.context !== "deploy-preview") return { ok:false, code:"OFFICIAL_SOURCE_CANARY_PREVIEW_REQUIRED" };
  if (!enabled(getEnv("RADAR_OFFICIAL_SOURCE_CANARY_ENABLED"))) return { ok:false, code:"OFFICIAL_SOURCE_CANARY_LOCKED" };
  if (enabled(getEnv("RADAR_LIVE_AI_ENABLED"))) return { ok:false, code:"OFFICIAL_SOURCE_CANARY_LIVE_AI_MUST_BE_LOCKED" };
  const profileName = String(getEnv("RADAR_OFFICIAL_SOURCE_CANARY_PROFILE") || "").trim().toUpperCase();
  const profile = PROFILES[profileName];
  if (!profile) return { ok:false, code:"OFFICIAL_SOURCE_CANARY_PROFILE_INVALID" };
  const requestLimit = Number(String(getEnv("RADAR_OFFICIAL_SOURCE_CANARY_MAX_REQUESTS") || "").trim());
  if (!Number.isInteger(requestLimit) || requestLimit !== profile.request_limit) {
    return { ok:false, code:"OFFICIAL_SOURCE_CANARY_REQUEST_LIMIT_INVALID" };
  }
  const readiness = new Map(sourceConnectorReadiness(getEnv).map((item) => [item.id, item]));
  const blocked = profile.source_ids.filter((sourceId) => readiness.get(sourceId)?.status !== "CONFIG_READY");
  if (blocked.length) return { ok:false, code:"OFFICIAL_SOURCE_CANARY_CONNECTOR_NOT_READY", blocked_sources:blocked };
  return { ok:true, profile:profileName, source_ids:[...profile.source_ids], request_limit:profile.request_limit, max_results_per_source:10 };
}
