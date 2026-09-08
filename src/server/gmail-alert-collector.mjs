import { Buffer } from "node:buffer";
import { normalizeGmailPlatformAlert } from "./gmail-alert-adapter.mjs";

export const GMAIL_API_ORIGIN = "https://gmail.googleapis.com";
export const GMAIL_ALERT_MAX_MESSAGES = 20;
export const GMAIL_ALERT_MAX_REQUESTS = GMAIL_ALERT_MAX_MESSAGES + 1;
export const GMAIL_ALERT_MAX_BYTES = 2_000_000;

const defaultEnv = (name) => process.env[name] || "";

export function gmailAlertCollectionReadiness(getEnv = defaultEnv) {
  const enabled = String(getEnv("RADAR_GMAIL_ALERT_COLLECTION_ENABLED") || "").trim().toLowerCase() === "true";
  if (!enabled) return {
    status:"LOCKED",
    missing_configuration:[],
    max_messages:GMAIL_ALERT_MAX_MESSAGES,
    max_requests:GMAIL_ALERT_MAX_REQUESTS
  };
  const missing = ["GMAIL_ALERT_OAUTH_ACCESS_TOKEN", "GMAIL_ALERT_LABEL"]
    .filter((name) => !String(getEnv(name) || "").trim());
  return {
    status:missing.length ? "CONFIG_REQUIRED" : "CONFIG_READY",
    missing_configuration:missing,
    max_messages:GMAIL_ALERT_MAX_MESSAGES,
    max_requests:GMAIL_ALERT_MAX_REQUESTS
  };
}

function required(value, code) {
  const text = String(value || "").trim();
  if (!text || /[\r\n]/.test(text)) throw Object.assign(new Error(code), { code });
  return text;
}

function labelName(value) {
  const label = required(value, "GMAIL_ALERT_LABEL_REQUIRED");
  if (label.length > 64 || !/^[\p{L}\p{N} _.-]+$/u.test(label)) {
    throw Object.assign(new Error("GMAIL_ALERT_LABEL_INVALID"), { code:"GMAIL_ALERT_LABEL_INVALID" });
  }
  return label;
}

function authHeaders(accessToken) {
  return { accept:"application/json", authorization:`Bearer ${required(accessToken, "GMAIL_ALERT_OAUTH_TOKEN_REQUIRED")}` };
}

export function buildGmailAlertListRequest({ accessToken, label = "3dsk-radar", maxResults = GMAIL_ALERT_MAX_MESSAGES } = {}) {
  const url = new URL("/gmail/v1/users/me/messages", GMAIL_API_ORIGIN);
  const limit = Math.max(1, Math.min(GMAIL_ALERT_MAX_MESSAGES, Number.parseInt(maxResults, 10) || GMAIL_ALERT_MAX_MESSAGES));
  url.search = new URLSearchParams({
    q:`label:"${labelName(label)}" newer_than:30d -in:spam -in:trash {from:jobalerts-noreply@linkedin.com from:upwork.com}`,
    maxResults:String(limit)
  }).toString();
  return { url:url.toString(), options:{ method:"GET", headers:authHeaders(accessToken) } };
}

export function buildGmailAlertMessageRequest({ accessToken, messageId } = {}) {
  const id = required(messageId, "GMAIL_ALERT_MESSAGE_ID_REQUIRED");
  if (!/^[a-z0-9]+$/i.test(id)) throw Object.assign(new Error("GMAIL_ALERT_MESSAGE_ID_INVALID"), { code:"GMAIL_ALERT_MESSAGE_ID_INVALID" });
  const url = new URL(`/gmail/v1/users/me/messages/${encodeURIComponent(id)}`, GMAIL_API_ORIGIN);
  url.searchParams.set("format", "full");
  return { url:url.toString(), options:{ method:"GET", headers:authHeaders(accessToken) } };
}

async function requestJson(request, fetchImpl) {
  let response;
  try { response = await fetchImpl(request.url, { ...request.options, redirect:"error", signal:AbortSignal.timeout(15_000) }); }
  catch (cause) {
    const code = cause?.name === "TimeoutError" || cause?.name === "AbortError" ? "GMAIL_ALERT_TIMEOUT" : "GMAIL_ALERT_NETWORK_FAILED";
    throw Object.assign(new Error(code), { code });
  }
  if (!response?.ok) throw Object.assign(new Error(`GMAIL_ALERT_HTTP_${response?.status || "UNKNOWN"}`), { code:`GMAIL_ALERT_HTTP_${response?.status || "UNKNOWN"}` });
  const declared = Number(response.headers?.get?.("content-length"));
  if (Number.isFinite(declared) && declared > GMAIL_ALERT_MAX_BYTES) throw Object.assign(new Error("GMAIL_ALERT_RESPONSE_TOO_LARGE"), { code:"GMAIL_ALERT_RESPONSE_TOO_LARGE" });
  const text = await response.text();
  if (Buffer.byteLength(text, "utf8") > GMAIL_ALERT_MAX_BYTES) throw Object.assign(new Error("GMAIL_ALERT_RESPONSE_TOO_LARGE"), { code:"GMAIL_ALERT_RESPONSE_TOO_LARGE" });
  try { return JSON.parse(text); }
  catch { throw Object.assign(new Error("GMAIL_ALERT_JSON_INVALID"), { code:"GMAIL_ALERT_JSON_INVALID" }); }
}

function dedupeSignals(signals) {
  const seen = new Set();
  return signals.filter((signal) => {
    if (!signal?.event_id || seen.has(signal.event_id)) return false;
    seen.add(signal.event_id);
    return true;
  });
}

export async function collectGmailAlertSignals({ accessToken, label = "3dsk-radar", maxMessages = GMAIL_ALERT_MAX_MESSAGES, fetchImpl = fetch } = {}) {
  const listRequest = buildGmailAlertListRequest({ accessToken, label, maxResults:maxMessages });
  const list = await requestJson(listRequest, fetchImpl);
  if (list?.messages !== undefined && !Array.isArray(list.messages)) throw Object.assign(new Error("GMAIL_ALERT_LIST_SCHEMA_MISMATCH"), { code:"GMAIL_ALERT_LIST_SCHEMA_MISMATCH" });
  const ids = [...new Set((list?.messages || []).map((item) => String(item?.id || "")).filter((id) => /^[a-z0-9]+$/i.test(id)))].slice(0, GMAIL_ALERT_MAX_MESSAGES);
  const messages = await Promise.all(ids.map(async (messageId) => {
    try {
      const request = buildGmailAlertMessageRequest({ accessToken, messageId });
      const payload = await requestJson(request, fetchImpl);
      return { status:"ACCEPTED", signals:normalizeGmailPlatformAlert(payload), error_code:null };
    } catch (error) {
      return { status:"REJECTED", signals:[], error_code:String(error?.code || "GMAIL_ALERT_REJECTED").slice(0, 100) };
    }
  }));
  const requests = 1 + ids.length;
  if (requests > GMAIL_ALERT_MAX_REQUESTS) throw Object.assign(new Error("GMAIL_ALERT_REQUEST_CAP_EXCEEDED"), { code:"GMAIL_ALERT_REQUEST_CAP_EXCEEDED" });
  const signals = dedupeSignals(messages.flatMap((item) => item.signals));
  return {
    provider:"GMAIL_ALERTS",
    status:messages.every((item) => item.status === "ACCEPTED") ? "COMPLETE" : "PARTIAL",
    requests,
    request_cap:GMAIL_ALERT_MAX_REQUESTS,
    messages_seen:ids.length,
    messages_accepted:messages.filter((item) => item.status === "ACCEPTED").length,
    messages_rejected:messages.filter((item) => item.status === "REJECTED").length,
    signals,
    diagnostics:messages.map(({ signals:ignored, ...item }) => item)
  };
}

export async function runGmailAlertCollection({ getEnv = defaultEnv, fetchImpl = fetch } = {}) {
  const readiness = gmailAlertCollectionReadiness(getEnv);
  if (readiness.status !== "CONFIG_READY") return {
    provider:"GMAIL_ALERTS",
    status:readiness.status,
    requests:0,
    request_cap:readiness.max_requests,
    messages_seen:0,
    messages_accepted:0,
    messages_rejected:0,
    signals:[],
    diagnostics:[],
    missing_configuration:readiness.missing_configuration
  };
  return collectGmailAlertSignals({
    accessToken:getEnv("GMAIL_ALERT_OAUTH_ACCESS_TOKEN"),
    label:getEnv("GMAIL_ALERT_LABEL"),
    fetchImpl
  });
}
