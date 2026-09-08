import { envValue, paidAcceptanceContextAllowed, sourceCollectionEnabled } from "../../src/server/runtime.mjs";
import { productionSearchConfiguration, productionSearchState } from "../../src/server/production-search-policy.mjs";
import { productionReplyState } from "../../src/server/production-reply-policy.mjs";
import { sourceConnectorReadiness } from "../../src/server/wide-v3-source-plan.mjs";
import { officialSourceCanaryConfiguration } from "../../src/server/official-source-canary-policy.mjs";
import { anyRuntimeSourceEligible } from "../../src/server/source-qualification.mjs";
import { ultraMaxPaidConfiguration } from "../../src/server/ultra-max-paid-policy.mjs";
import { gmailAlertCollectionReadiness } from "../../src/server/gmail-alert-collector.mjs";
import { gmailAlertImportReadiness } from "../../src/server/gmail-alert-import.mjs";

export default async (_request, context) => {
  const liveAIEnabled = envValue("RADAR_LIVE_AI_ENABLED").toLowerCase() === "true";
  const paidAcceptanceEnabled = envValue("RADAR_PAID_ACCEPTANCE_ENABLED").toLowerCase() === "true";
  const paidAcceptancePreview = paidAcceptanceContextAllowed(context);
  const controlledProductionSearch = productionSearchState({ context });
  const productionSearchConfig = controlledProductionSearch === "READY" ? productionSearchConfiguration() : null;
  const controlledProductionReply = productionReplyState({ context });
  const officialSourceCanary = officialSourceCanaryConfiguration({ context, getEnv:envValue });
  const ultraMaxEnabled = envValue("RADAR_ULTRA_MAX_ENABLED").toLowerCase() === "true";
  const runtimeSourcesAvailable = anyRuntimeSourceEligible();
  const ultraMaxNativeReady = ultraMaxEnabled && (!runtimeSourcesAvailable || sourceCollectionEnabled());
  const ultraMaxNativeMode = !ultraMaxEnabled
    ? "LOCKED"
    : runtimeSourcesAvailable
      ? sourceCollectionEnabled() ? "ACTIVE" : "SOURCE_COLLECTION_LOCKED"
      : "SKIP_NO_RUNTIME_ELIGIBLE_SOURCES";
  const ultraMaxPaid = ultraMaxPaidConfiguration({context,getEnv:envValue});
  const gmailAlerts = gmailAlertCollectionReadiness(envValue);
  const gmailAlertCanary = gmailAlertImportReadiness({context,getEnv:envValue});
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
    official_source_discovery: productionSearchConfig?.official_sources_enabled ? "READY" : "LOCKED",
    official_source_request_limit: productionSearchConfig?.official_source_request_limit || 0,
    official_source_canary: officialSourceCanary.ok ? "READY" : officialSourceCanary.code,
    official_source_canary_request_limit: officialSourceCanary.ok ? officialSourceCanary.request_limit : 0,
    official_source_canary_context: officialSourceCanary.ok ? officialSourceCanary.deploy_context : null,
    official_source_canary_commit_ref: officialSourceCanary.ok ? officialSourceCanary.commit_ref || null : null,
    official_source_canary_deploy_url: officialSourceCanary.ok ? officialSourceCanary.deploy_url || null : null,
    source_signal_ingest: envValue("RADAR_SOURCE_SIGNAL_INGEST_ENABLED").toLowerCase() === "true" ? "ENABLED" : "LOCKED",
    production_reply: controlledProductionReply,
    paid_acceptance: paidAcceptanceEnabled ? (paidAcceptancePreview ? "ARMED" : "CONTEXT_BLOCKED") : "LOCKED",
    deploy_context: context?.deploy?.context || "unknown",
    paid_coordinator: "NETLIFY_DATABASE",
    prelive_acceptance_enabled: envValue("RADAR_PRELIVE_ACCEPTANCE_ENABLED") === "true" && !liveAIEnabled,
    search_backend: "IMPLEMENTED",
    source_collection: sourceCollectionEnabled() ? "ENABLED" : "LOCKED",
    source_collectors: { ted:"IMPLEMENTED_API_VERIFIED", find_tender:"IMPLEMENTED_API_VERIFIED", contracts_finder:"IMPLEMENTED_API_VERIFIED", community:"BLOCKED_ACCESS_REVIEW" },
    source_connectors_v3:sourceConnectorReadiness(envValue).map((item) => ({
      id:item.id,
      access_method:item.access_method,
      paid:item.paid,
      runtime_available:item.runtime_available,
      status:item.status,
      missing_configuration:item.missing_configuration
    })),
    gmail_alert_collection:gmailAlerts.status,
    gmail_alert_missing_configuration:gmailAlerts.missing_configuration,
    gmail_alert_max_messages:gmailAlerts.max_messages,
    gmail_alert_request_limit:gmailAlerts.max_requests,
    gmail_alert_canary:gmailAlertCanary.status,
    gmail_alert_canary_missing_configuration:gmailAlertCanary.missing_configuration,
    gmail_alert_canary_context:gmailAlertCanary.deploy_context,
    source_run_engine: sourceCollectionEnabled() ? "IMPLEMENTED_ENABLED" : "IMPLEMENTED_LOCKED",
    ultra_max_native: ultraMaxNativeReady ? "READY" : "LOCKED",
    ultra_max_native_mode:ultraMaxNativeMode,
    ultra_max_paid:ultraMaxPaid.state,
    ultra_max_paid_max_usd:ultraMaxPaid.ok ? ultraMaxPaid.cap_microusd/1_000_000 : null,
    ultra_max_paid_openai_request_limit:ultraMaxPaid.ok ? ultraMaxPaid.openai_request_limit : null,
    ultra_max_paid_web_call_limit:ultraMaxPaid.ok ? ultraMaxPaid.web_search_call_limit : null,
    ultra_max_paid_retry_allowed:false,
    persistence: "NETLIFY_BLOBS",
    response_generation: controlledProductionReply === "READY" ? "IMPLEMENTED_ENABLED" : "IMPLEMENTED_LOCKED"
  }, { headers: { "cache-control": "no-store" } });
};

export const config = { path: "/api/health" };
