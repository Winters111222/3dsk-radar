import { envValue } from "../../src/server/runtime.mjs";

export default async () => {
  const liveAIEnabled = envValue("RADAR_LIVE_AI_ENABLED").toLowerCase() === "true";
  return Response.json({
    ok: true,
    service: "3dsk-opportunity-radar",
    stage: "prelive-zero-cost-acceptance",
    access_configured: Boolean(envValue("RADAR_INTERNAL_ACCESS_SECRET")),
    live_ai_enabled: liveAIEnabled,
    paid_ai_state: liveAIEnabled ? "ENABLED" : "LOCKED",
    prelive_acceptance_enabled: envValue("RADAR_PRELIVE_ACCEPTANCE_ENABLED") === "true" && !liveAIEnabled,
    search_backend: "IMPLEMENTED",
    persistence: "NETLIFY_BLOBS",
    response_generation: "IMPLEMENTED"
  }, { headers: { "cache-control": "no-store" } });
};

export const config = { path: "/api/health" };
