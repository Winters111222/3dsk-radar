// Netlify's current Node runtime exposes process.env. Retain the legacy
// Netlify.env interface for existing deployments and deterministic fixtures.
export function envValue(key) {
  return globalThis.Netlify?.env?.get(key) ?? process.env[key] ?? "";
}

export function liveAIEnabled() {
  return envValue("RADAR_LIVE_AI_ENABLED").toLowerCase() === "true";
}

export function acceptanceEnabled() {
  return envValue("RADAR_PRELIVE_ACCEPTANCE_ENABLED") === "true" && !liveAIEnabled();
}

export function workspaceAllowed(request) {
  return request?.headers.get("x-radar-workspace") !== "acceptance" || acceptanceEnabled();
}
