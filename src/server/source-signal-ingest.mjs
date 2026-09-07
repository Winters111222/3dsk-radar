import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const SOURCE_SIGNAL_MAX_BYTES = 65_536;
export const SOURCE_SIGNAL_MAX_CLOCK_SKEW_SECONDS = 300;
export const SOURCE_SIGNAL_IDS = Object.freeze([
  "linkedin_alert_bridge",
  "telegram_authorized_channels",
  "discord_authorized_channels"
]);

const SOURCE_RULES = Object.freeze({
  linkedin_alert_bridge:{ gate:"RADAR_LINKEDIN_SIGNAL_ENABLED", domains:["linkedin.com"] },
  telegram_authorized_channels:{ gate:"RADAR_TELEGRAM_SOURCE_ENABLED", domains:["t.me"], allowlist:"TELEGRAM_SOURCE_ALLOWED_CHATS" },
  discord_authorized_channels:{ gate:"RADAR_DISCORD_SOURCE_ENABLED", domains:["discord.com", "discordapp.com"], allowlist:"DISCORD_SOURCE_ALLOWED_CHANNELS" }
});

function equalText(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

function enabled(value) {
  return String(value || "").trim().toLowerCase() === "true";
}

function allowlist(value) {
  return new Set(String(value || "").split(/[\s,]+/).map((item) => item.trim()).filter(Boolean));
}

function clean(value, max) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

function validSourceUrl(value, domains) {
  try {
    const url = new URL(String(value || ""));
    if (url.protocol !== "https:" || url.username || url.password) return null;
    const hostname = url.hostname.toLowerCase();
    if (!domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))) return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

export function signSourceSignal(rawBody, timestamp, secret) {
  return `sha256=${createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex")}`;
}

export function verifyAndNormalizeSourceSignal({ rawBody, timestamp, signature, secret, getEnv = (key) => process.env[key], nowMs = Date.now() } = {}) {
  if (!enabled(getEnv("RADAR_SOURCE_SIGNAL_INGEST_ENABLED"))) throw Object.assign(new Error("SOURCE_SIGNAL_INGEST_LOCKED"), { code:"SOURCE_SIGNAL_INGEST_LOCKED", status:423 });
  if (!secret) throw Object.assign(new Error("SOURCE_SIGNAL_SECRET_REQUIRED"), { code:"SOURCE_SIGNAL_SECRET_REQUIRED", status:503 });
  const bytes = Buffer.byteLength(String(rawBody || ""), "utf8");
  if (!bytes || bytes > SOURCE_SIGNAL_MAX_BYTES) throw Object.assign(new Error("SOURCE_SIGNAL_BODY_INVALID"), { code:"SOURCE_SIGNAL_BODY_INVALID", status:400 });
  const timestampNumber = Number(timestamp);
  if (!Number.isInteger(timestampNumber) || Math.abs(Math.floor(nowMs / 1000) - timestampNumber) > SOURCE_SIGNAL_MAX_CLOCK_SKEW_SECONDS) {
    throw Object.assign(new Error("SOURCE_SIGNAL_TIMESTAMP_INVALID"), { code:"SOURCE_SIGNAL_TIMESTAMP_INVALID", status:401 });
  }
  if (!equalText(signature, signSourceSignal(rawBody, timestampNumber, secret))) {
    throw Object.assign(new Error("SOURCE_SIGNAL_SIGNATURE_INVALID"), { code:"SOURCE_SIGNAL_SIGNATURE_INVALID", status:401 });
  }
  let body;
  try { body = JSON.parse(rawBody); }
  catch { throw Object.assign(new Error("SOURCE_SIGNAL_JSON_INVALID"), { code:"SOURCE_SIGNAL_JSON_INVALID", status:400 }); }
  const sourceId = clean(body?.source_id, 80);
  const rule = SOURCE_RULES[sourceId];
  if (!rule || !enabled(getEnv(rule.gate))) throw Object.assign(new Error("SOURCE_SIGNAL_SOURCE_LOCKED"), { code:"SOURCE_SIGNAL_SOURCE_LOCKED", status:423 });
  const channelId = clean(body?.channel_id, 160) || null;
  if (rule.allowlist && (!channelId || !allowlist(getEnv(rule.allowlist)).has(channelId))) {
    throw Object.assign(new Error("SOURCE_SIGNAL_CHANNEL_FORBIDDEN"), { code:"SOURCE_SIGNAL_CHANNEL_FORBIDDEN", status:403 });
  }
  const eventId = clean(body?.event_id, 240);
  const text = clean(body?.text, 4000);
  const sourceUrl = validSourceUrl(body?.source_url, rule.domains);
  const published = Date.parse(String(body?.published_at || ""));
  if (!eventId || !text || !sourceUrl || !Number.isFinite(published)) throw Object.assign(new Error("SOURCE_SIGNAL_PAYLOAD_INVALID"), { code:"SOURCE_SIGNAL_PAYLOAD_INVALID", status:400 });
  const signalId = `signal-${createHash("sha256").update(`${sourceId}:${eventId}`).digest("hex").slice(0, 40)}`;
  return {
    signal_id:signalId,
    source_id:sourceId,
    source_event_id:eventId,
    channel_id:channelId,
    source_url:sourceUrl,
    author:clean(body?.author, 240) || null,
    text,
    published_at:new Date(published).toISOString(),
    received_at:new Date(nowMs).toISOString(),
    discovery_only:true,
    requires_original_verification:true,
    outreach_locked:true
  };
}
