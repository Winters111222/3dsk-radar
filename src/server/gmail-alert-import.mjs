import { signSourceSignal, verifyAndNormalizeSourceSignal } from "./source-signal-ingest.mjs";
import { gmailAlertCollectionReadiness, runGmailAlertCollection } from "./gmail-alert-collector.mjs";

export const GMAIL_ALERT_CANARY_CONTEXT = "deploy-preview";
export const GMAIL_ALERT_CANARY_CONFIRMATION = "READ_ONE_GMAIL_ALERT_AND_IMPORT_ONE_LOCKED_SIGNAL";
export const GMAIL_ALERT_CANARY_MAX_MESSAGES = 1;
export const GMAIL_ALERT_CANARY_MAX_SIGNALS = 1;

const enabled = (value) => String(value || "").trim().toLowerCase() === "true";

function sourceEnabled(sourceId, getEnv) {
  if (sourceId === "linkedin_alert_bridge") return enabled(getEnv("RADAR_LINKEDIN_SIGNAL_ENABLED"));
  if (sourceId === "upwork_alert_bridge") return enabled(getEnv("RADAR_UPWORK_SIGNAL_ENABLED"));
  return false;
}

export function gmailAlertImportReadiness({ context, getEnv = (name) => process.env[name] || "" } = {}) {
  if (context?.deploy?.context !== GMAIL_ALERT_CANARY_CONTEXT) return {
    status:"CONTEXT_BLOCKED",
    missing_configuration:[],
    deploy_context:context?.deploy?.context || "unknown"
  };
  const collection = gmailAlertCollectionReadiness(getEnv);
  if (collection.status !== "CONFIG_READY") return {
    status:collection.status,
    missing_configuration:collection.missing_configuration,
    deploy_context:GMAIL_ALERT_CANARY_CONTEXT
  };
  const missing = [];
  if (!enabled(getEnv("RADAR_SOURCE_SIGNAL_INGEST_ENABLED"))) missing.push("RADAR_SOURCE_SIGNAL_INGEST_ENABLED");
  if (!String(getEnv("RADAR_SOURCE_INGEST_SECRET") || "").trim()) missing.push("RADAR_SOURCE_INGEST_SECRET");
  if (!enabled(getEnv("RADAR_LINKEDIN_SIGNAL_ENABLED")) && !enabled(getEnv("RADAR_UPWORK_SIGNAL_ENABLED"))) {
    missing.push("RADAR_LINKEDIN_SIGNAL_ENABLED_OR_RADAR_UPWORK_SIGNAL_ENABLED");
  }
  return {
    status:missing.length ? "CONFIG_REQUIRED" : "READY",
    missing_configuration:missing,
    deploy_context:GMAIL_ALERT_CANARY_CONTEXT
  };
}

export async function importGmailAlertSignals({ context, getEnv, fetchImpl = fetch, repository, nowMs = Date.now() } = {}) {
  const readiness = gmailAlertImportReadiness({ context, getEnv });
  if (readiness.status !== "READY") return {
    provider:"GMAIL_ALERT_IMPORT",
    status:readiness.status,
    requests:0,
    messages_seen:0,
    signals_collected:0,
    signals_source_locked:0,
    signals_deferred:0,
    signals_imported:0,
    signals_replayed:0,
    signals_rejected:0,
    missing_configuration:readiness.missing_configuration
  };
  if (!repository || typeof repository.getSourceSignal !== "function" || typeof repository.saveSourceSignal !== "function") {
    throw Object.assign(new Error("GMAIL_ALERT_REPOSITORY_REQUIRED"), { code:"GMAIL_ALERT_REPOSITORY_REQUIRED" });
  }
  const collection = await runGmailAlertCollection({ getEnv, fetchImpl, maxMessages:GMAIL_ALERT_CANARY_MAX_MESSAGES });
  const sourceEligible = collection.signals.filter((signal) => sourceEnabled(signal.source_id, getEnv));
  const eligible = sourceEligible.slice(0, GMAIL_ALERT_CANARY_MAX_SIGNALS);
  const results = [];
  for (const candidate of eligible) {
    try {
      const timestamp = Math.floor(nowMs / 1000);
      const rawBody = JSON.stringify(candidate);
      const secret = getEnv("RADAR_SOURCE_INGEST_SECRET");
      const signal = verifyAndNormalizeSourceSignal({
        rawBody,
        timestamp,
        signature:signSourceSignal(rawBody, timestamp, secret),
        secret,
        getEnv,
        nowMs
      });
      const existing = await repository.getSourceSignal(signal.signal_id);
      if (existing) {
        results.push({ status:"REPLAYED", error_code:null });
        continue;
      }
      await repository.saveSourceSignal(signal);
      const readback = await repository.getSourceSignal(signal.signal_id);
      if (!readback) throw Object.assign(new Error("GMAIL_ALERT_SIGNAL_WRITE_FAILED"), { code:"GMAIL_ALERT_SIGNAL_WRITE_FAILED" });
      results.push({ status:"IMPORTED", error_code:null });
    } catch (error) {
      results.push({ status:"REJECTED", error_code:String(error?.code || "GMAIL_ALERT_SIGNAL_REJECTED").slice(0, 100) });
    }
  }
  return {
    provider:"GMAIL_ALERT_IMPORT",
    status:collection.status === "COMPLETE" && results.every((item) => item.status !== "REJECTED") ? "COMPLETE" : "PARTIAL",
    requests:collection.requests,
    request_cap:collection.request_cap,
    messages_seen:collection.messages_seen,
    messages_accepted:collection.messages_accepted,
    messages_rejected:collection.messages_rejected,
    signals_collected:collection.signals.length,
    signals_source_locked:collection.signals.length - sourceEligible.length,
    signals_deferred:sourceEligible.length - eligible.length,
    signals_imported:results.filter((item) => item.status === "IMPORTED").length,
    signals_replayed:results.filter((item) => item.status === "REPLAYED").length,
    signals_rejected:results.filter((item) => item.status === "REJECTED").length,
    diagnostics:[...collection.diagnostics, ...results.filter((item) => item.error_code)],
    missing_configuration:[]
  };
}
