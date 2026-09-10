import { normalizeUserOwnedAlert } from "./user-owned-alert-normalizer.mjs";
import { Buffer } from "node:buffer";

const PLATFORM_BY_DOMAIN = Object.freeze({
  "linkedin.com":"linkedin",
  "upwork.com":"upwork"
});

function headers(payload) {
  const result = new Map();
  for (const header of payload?.headers || []) {
    const name = String(header?.name || "").toLowerCase();
    if (name && !result.has(name)) result.set(name, String(header?.value || ""));
  }
  return result;
}

function addressDomain(value) {
  const match = String(value || "").match(/<?[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@([a-z0-9.-]+)>?/i);
  return match?.[1]?.toLowerCase() || null;
}

function platformForSender(value) {
  const domain = addressDomain(value);
  if (!domain) return null;
  return Object.entries(PLATFORM_BY_DOMAIN).find(([root]) => domain === root || domain.endsWith(`.${root}`))?.[1] || null;
}

function authenticatedDomain(value, platform) {
  const root = platform === "linkedin" ? "linkedin.com" : "upwork.com";
  const text = String(value || "").toLowerCase();
  const domains = [...text.matchAll(/header\.from=([a-z0-9.-]+)/g)].map((match) => match[1]);
  return /\bdmarc=pass\b/.test(text) && domains.some((domain) => domain === root || domain.endsWith(`.${root}`));
}

function textParts(part, output = []) {
  if (!part) return output;
  const mimeType = String(part.mimeType || part.mime_type || "").toLowerCase();
  if (mimeType === "text/plain") {
    if (part.body?.data) output.push(Buffer.from(String(part.body.data), "base64url").toString("utf8"));
    else if (part.body?.content) output.push(String(part.body.content));
  }
  for (const child of part.parts || []) textParts(child, output);
  return output;
}

function linkContext(text, start) {
  const prefix = text.slice(Math.max(0, start - 500), start)
    .replace(/https:\/\/\S+/gi, " ")
    .replace(/[-_]{8,}/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return prefix.slice(-320).replace(/(?:view|zobrazit)\s+(?:the\s+)?(?:job|pracovn[ií]\s+p[řr][ií]le[žz]itost)\s*:?\s*$/iu, "").trim();
}

function linksFromPlainText(text) {
  const links = [];
  const pattern = /https:\/\/[^\s<>"']+/gi;
  for (const match of text.matchAll(pattern)) {
    links.push({ url:match[0].replace(/&amp;/g, "&"), text:linkContext(text, match.index || 0) });
  }
  return links;
}

export function normalizeGmailPlatformAlert(message) {
  const values = headers(message?.payload);
  const platform = platformForSender(values.get("from"));
  if (!platform) throw Object.assign(new Error("GMAIL_ALERT_SENDER_UNSUPPORTED"), { code:"GMAIL_ALERT_SENDER_UNSUPPORTED" });
  const authentication = [values.get("authentication-results"), values.get("arc-authentication-results")].find((value) => authenticatedDomain(value, platform));
  if (!authentication) throw Object.assign(new Error("GMAIL_ALERT_DMARC_REQUIRED"), { code:"GMAIL_ALERT_DMARC_REQUIRED" });
  const messageId = values.get("message-id");
  const subject = values.get("subject");
  const internalDate = Number(message?.internalDate || message?.internal_date);
  const receivedAt = Number.isFinite(internalDate) && internalDate > 0 ? new Date(internalDate).toISOString() : new Date(values.get("date")).toISOString();
  const plain = textParts(message?.payload).join("\n");
  if (!plain) throw Object.assign(new Error("GMAIL_ALERT_TEXT_REQUIRED"), { code:"GMAIL_ALERT_TEXT_REQUIRED" });
  return normalizeUserOwnedAlert({
    platform,
    message_id:messageId,
    subject,
    body_text:"Platform alert delivered to the user's authenticated mailbox.",
    received_at:receivedAt,
    links:linksFromPlainText(plain)
  });
}
