import { envValue, paidAcceptanceContextAllowed, sourceCollectionEnabled } from "../../src/server/runtime.mjs";
import { productionSearchConfiguration, productionSearchState } from "../../src/server/production-search-policy.mjs";
import { productionReplyState } from "../../src/server/production-reply-policy.mjs";

export default async (_request, context) => {
  const liveAIEnabled = envValue("RADAR_LIVE_AI_ENABLED").toLowerCase() === "true";
  const paidAcceptanceEnabled = envValue("RADAR_PAID_ACCEPTANCE_ENABLED").toLowerCase() === "true";
  const paidAcceptancePreview = paidAcceptanceContextAllowed(context);
  const controlledProductionSearch = productionSearchState({ context });
  const productionSearchConfig = controlledProductionSearch === "READY" ? productionSearchConfiguration() : null;
  const controlledProductionReply = productionReplyState({ context });
  return Response.json({
    ok: true,
    service: "3dsk-opportunity-radar",
    stage: paidAcceptanceEnabled ? "phase-e-paid-acceptance" : controlledProductionSearch === "READY" ? "production-controlled-live" : "prelive-zero-cost-acceptance",
    access_configured: Boolean(envValue("RADAR_INTERNAL_ACCESS_SECRET")),
    live_ai_enabled: liveAIEnabled,
    paid_ai_state: liveAIEnabled ? "ENABLED" : "LOCKED",
    production_search: controlledProductionSearch,
    production_search_profile: productionSearchConfig?.search_profile || null,
    production_search_max_results: productionSearchConfig?.max_results || null,
    production_search_max_usd: productionSearchConfig ? productionSearchConfig.cap_microusd / 1_000_000 : null,
    production_search_openai_request_limit: productionSearchConfig?.openai_request_limit || null,
    production_search_web_call_limit: productionSearchConfig?.max_tool_calls || null,
    cloud_browser: productionSearchConfig?.firecrawl_enabled ? "FIRECRAWL_READY" : "LOCKED",
    cloud_browser_request_limit: productionSearchConfig?.firecrawl_request_limit || 0,
    cloud_browser_credit_cap: productionSearchConfig?.firecrawl_credit_cap || 0,
    production_reply: controlledProductionReply,
    paid_acceptance: paidAcceptanceEnabled ? (paidAcceptancePreview ? "ARMED" : "CONTEXT_BLOCKED") : "LOCKED",
    deploy_context: context?.deploy?.context || "unknown",
    paid_coordinator: "NETLIFY_DATABASE",
    prelive_acceptance_enabled: envValue("RADAR_PRELIVE_ACCEPTANCE_ENABLED") === "true" && !liveAIEnabled,
    search_backend: "IMPLEMENTED",
    source_collection: sourceCollectionEnabled() ? "ENABLED" : "LOCKED",
    source_collectors: { ted:"IMPLEMENTED_API_VERIFIED", find_tender:"IMPLEMENTED_API_VERIFIED", contracts_finder:"IMPLEMENTED_API_VERIFIED", community:"BLOCKED_ACCESS_REVIEW" },
    source_run_engine: sourceCollectionEnabled() ? "IMPLEMENTED_ENABLED" : "IMPLEMENTED_LOCKED",
    persistence: "NETLIFY_BLOBS",
    response_generation: controlledProductionReply === "READY" ? "IMPLEMENTED_ENABLED" : "IMPLEMENTED_LOCKED"
  }, { headers: { "cache-control": "no-store" } });
};

export const config = { path: "/api/health" };
