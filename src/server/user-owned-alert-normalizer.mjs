import { createHash } from "node:crypto";

export const USER_OWNED_ALERT_MAX_LINKS = 25;

const PLATFORM_RULES = Object.freeze({
  upwork:Object.freeze({
    source_id:"upwork_alert_bridge",
    domains:Object.freeze(["upwork.com"]),
    paths:Object.freeze([
      { pattern:/^\/jobs\/~([a-z0-9]+)\/?$/i, canonical:(id) => `/jobs/~${id}/` },
      { pattern:/^\/freelance-jobs\/apply\/[^/]+_(~[a-z0-9]+)\/?$/i },
      { pattern:/^\/ab\/feed\/jobs\/details\/~([a-z0-9]+)\/?$/i, canonical:(id) => `/jobs/~${id}/` }
    ])
  }),
  linkedin:Object.freeze({
    source_id:"linkedin_alert_bridge",
    domains:Object.freeze(["linkedin.com"]),
    paths:Object.freeze([
      { pattern:/^\/(?:comm\/)?jobs\/view\/(\d+)\/?$/i, canonical:(id) => `/jobs/view/${id}/` },
      { pattern:/^\/feed\/update\/urn:li:activity:(\d+)\/?$/i },
      { pattern:/^\/posts\/([^/]+)\/?$/i }
    ])
  })
});

function clean(value, max) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

function canonicalAlertLink(value, rule) {
  let url;
  try { url = new URL(String(value || "")); }
  catch { return null; }
  if (url.protocol !== "https:" || url.username || url.password) return null;
  const hostname = url.hostname.toLowerCase();
  if (!rule.domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))) return null;
  const route = rule.paths.map((entry) => ({ entry, match:url.pathname.match(entry.pattern) })).find((item) => item.match);
  if (!route) return null;
  url.protocol = "https:";
  url.hostname = `www.${rule.domains[0]}`;
  url.port = "";
  if (route.entry.canonical) url.pathname = route.entry.canonical(route.match[1]);
  url.search = "";
  url.hash = "";
  return { url:url.toString(), item_id:clean(route.match[1], 240) };
}

export function normalizeUserOwnedAlert({ platform, message_id:messageId, subject, body_text:bodyText, received_at:receivedAt, links } = {}) {
  const rule = PLATFORM_RULES[clean(platform, 40).toLowerCase()];
  if (!rule) throw Object.assign(new Error("ALERT_PLATFORM_UNSUPPORTED"), { code:"ALERT_PLATFORM_UNSUPPORTED" });
  const message = clean(messageId, 500);
  const received = Date.parse(String(receivedAt || ""));
  const text = clean([subject, bodyText].filter(Boolean).join(" — "), 4000);
  if (!message || !Number.isFinite(received) || !text || !Array.isArray(links) || links.length > USER_OWNED_ALERT_MAX_LINKS) {
    throw Object.assign(new Error("ALERT_PAYLOAD_INVALID"), { code:"ALERT_PAYLOAD_INVALID" });
  }
  const seen = new Set();
  return links.map((link) => canonicalAlertLink(link, rule)).filter((item) => {
    if (!item || seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  }).map((item) => ({
    source_id:rule.source_id,
    event_id:`mail-${createHash("sha256").update(`${message}:${item.item_id}`).digest("hex").slice(0, 40)}`,
    channel_id:null,
    source_url:item.url,
    author:null,
    text,
    published_at:new Date(received).toISOString()
  }));
}
