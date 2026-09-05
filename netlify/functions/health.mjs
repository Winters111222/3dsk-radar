import { envValue, paidAcceptanceContextAllowed, sourceCollectionEnabled } from "../../src/server/runtime.mjs";

export default async (_request, context) => {
  const liveAIEnabled = envValue("RADAR_LIVE_AI_ENABLED").toLowerCase() === "true";
  const paidAcceptanceEnabled = envValue("RADAR_PAID_ACCEPTANCE_ENABLED").toLowerCase() === "true";
  const paidAcceptancePreview = paidAcceptanceContextAllowed(context);
  return Response.json({
    ok: true,
    service: "3dsk-opportunity-radar",
    stage: paidAcceptanceEnabled ? "phase-e-paid-acceptance" : "prelive-zero-cost-acceptance",
    access_configured: Boolean(envValue("RADAR_INTERNAL_ACCESS_SECRET")),
    live_ai_enabled: liveAIEnabled,
    paid_ai_state: liveAIEnabled ? "ENABLED" : "LOCKED",
    paid_acceptance: paidAcceptanceEnabled ? (paidAcceptancePreview ? "ARMED" : "CONTEXT_BLOCKED") : "LOCKED",
    deploy_context: context?.deploy?.context || "unknown",
    paid_coordinator: "NETLIFY_DATABASE",
    prelive_acceptance_enabled: envValue("RADAR_PRELIVE_ACCEPTANCE_ENABLED") === "true" && !liveAIEnabled,
    search_backend: "IMPLEMENTED",
    source_collection: sourceCollectionEnabled() ? "ENABLED" : "LOCKED",
    source_collectors: { ted:"IMPLEMENTED_API_VERIFIED", find_tender:"IMPLEMENTED_API_VERIFIED", contracts_finder:"IMPLEMENTED_API_VERIFIED", community:"BLOCKED_ACCESS_REVIEW" },
    source_run_engine: sourceCollectionEnabled() ? "IMPLEMENTED_ENABLED" : "IMPLEMENTED_LOCKED",
    persistence: "NETLIFY_BLOBS",
    response_generation: "IMPLEMENTED"
  }, { headers: { "cache-control": "no-store" } });
};

export const config = { path: "/api/health" };
