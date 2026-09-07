import { envValue } from "./runtime.mjs";

const enabled = (value) => String(value || "").toLowerCase() === "true";

export function productionReplyEnabled(getEnv = envValue) {
  return enabled(getEnv("RADAR_PRODUCTION_REPLY_ENABLED"));
}

export function productionReplyContextAllowed(context) {
  return context?.deploy?.context === "production";
}

export function productionReplyState({ context, getEnv = envValue } = {}) {
  if (!enabled(getEnv("RADAR_LIVE_AI_ENABLED")) || !productionReplyEnabled(getEnv)) return "LOCKED";
  return productionReplyContextAllowed(context) ? "READY" : "CONTEXT_BLOCKED";
}
