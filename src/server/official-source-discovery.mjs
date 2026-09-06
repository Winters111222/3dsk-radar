import { Buffer } from "node:buffer";

export const UPWORK_GRAPHQL_URL = "https://api.upwork.com/graphql";
export const REDDIT_API_ORIGIN = "https://oauth.reddit.com";
export const BLUESKY_PUBLIC_API_ORIGIN = "https://public.api.bsky.app";
export const OFFICIAL_SOURCE_MAX_BYTES = 2_000_000;
export const OFFICIAL_SOURCE_MAX_RESULTS = 25;
export const RADAR_SOURCE_USER_AGENT = "3dsk-opportunity-radar/0.1 (+https://3d.sk)";

const UPWORK_SEARCH_QUERY = `query SearchJobs($filter: MarketplaceJobPostingsSearchFilter) {
  marketplaceJobPostingsSearch(
    marketPlaceJobFilter: $filter
    searchType: USER_JOBS_SEARCH
    sortAttributes: [{ field: RECENCY }]
  ) {
    totalCount
    edges {
      node {
        id
        title
        description
        ciphertext
        amount { displayValue currency }
        skills { name }
        client { totalFeedback }
      }
    }
  }
}`;

function boundedLimit(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(OFFICIAL_SOURCE_MAX_RESULTS, parsed)) : 10;
}

function cleanText(value, max = 1200) {
  return String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

function isoOrNull(value) {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function safeToken(value, code) {
  const token = String(value || "").trim();
  if (!token || /[\r\n]/.test(token)) {
    const error = new Error(code);
    error.code = code;
    throw error;
  }
  return token;
}

function safeMastodonOrigin(value) {
  let url;
  try { url = new URL(String(value || "")); }
  catch { url = null; }
  if (!url || url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    const error = new Error("MASTODON_ORIGIN_INVALID");
    error.code = "MASTODON_ORIGIN_INVALID";
    throw error;
  }
  return url.origin;
}

async function boundedJson(response, maxBytes = OFFICIAL_SOURCE_MAX_BYTES) {
  if (!response?.ok) {
    const error = new Error(`OFFICIAL_SOURCE_HTTP_${response?.status || "UNKNOWN"}`);
    error.code = `OFFICIAL_SOURCE_HTTP_${response?.status || "UNKNOWN"}`;
    error.status = response?.status || 502;
    throw error;
  }
  const declared = Number(response.headers?.get?.("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    const error = new Error("OFFICIAL_SOURCE_RESPONSE_TOO_LARGE");
    error.code = "OFFICIAL_SOURCE_RESPONSE_TOO_LARGE";
    throw error;
  }
  const text = await response.text();
  if (Buffer.byteLength(text, "utf8") > maxBytes) {
    const error = new Error("OFFICIAL_SOURCE_RESPONSE_TOO_LARGE");
    error.code = "OFFICIAL_SOURCE_RESPONSE_TOO_LARGE";
    throw error;
  }
  try { return JSON.parse(text); }
  catch {
    const error = new Error("OFFICIAL_SOURCE_JSON_INVALID");
    error.code = "OFFICIAL_SOURCE_JSON_INVALID";
    throw error;
  }
}

async function requestJson(url, options, { fetchImpl = fetch, timeoutMs = 15_000 } = {}) {
  let response;
  try {
    response = await fetchImpl(url, { ...options, redirect:"error", signal:AbortSignal.timeout(timeoutMs) });
  } catch (cause) {
    const timeout = cause?.name === "TimeoutError" || cause?.name === "AbortError";
    const error = new Error(timeout ? "OFFICIAL_SOURCE_TIMEOUT" : "OFFICIAL_SOURCE_NETWORK_FAILED");
    error.code = error.message;
    throw error;
  }
  return boundedJson(response);
}

export function buildUpworkSearchRequest({ accessToken, tenantId, query, limit = 10 } = {}) {
  const token = safeToken(accessToken, "UPWORK_OAUTH_TOKEN_REQUIRED");
  const tenant = safeToken(tenantId, "UPWORK_TENANT_ID_REQUIRED");
  const expression = cleanText(query, 240);
  if (!expression) throw Object.assign(new Error("UPWORK_QUERY_REQUIRED"), { code:"UPWORK_QUERY_REQUIRED" });
  return {
    url:UPWORK_GRAPHQL_URL,
    options:{
      method:"POST",
      headers:{
        accept:"application/json",
        "content-type":"application/json",
        authorization:`Bearer ${token}`,
        "x-upwork-api-tenantid":tenant
      },
      body:JSON.stringify({
        query:UPWORK_SEARCH_QUERY,
        variables:{ filter:{ searchExpression_eq:expression, pagination_eq:{ after:"0", first:boundedLimit(limit) } } }
      })
    }
  };
}

export function buildRedditSearchRequest({ accessToken, query, limit = 10 } = {}) {
  const token = safeToken(accessToken, "REDDIT_OAUTH_TOKEN_REQUIRED");
  const search = cleanText(query, 240);
  if (!search) throw Object.assign(new Error("REDDIT_QUERY_REQUIRED"), { code:"REDDIT_QUERY_REQUIRED" });
  const url = new URL("/r/gameDevClassifieds/search", REDDIT_API_ORIGIN);
  url.search = new URLSearchParams({ q:search, restrict_sr:"1", sort:"new", t:"month", raw_json:"1", limit:String(boundedLimit(limit)) }).toString();
  return { url:url.toString(), options:{ method:"GET", headers:{ accept:"application/json", authorization:`Bearer ${token}` } } };
}

export function buildBlueskySearchRequest({ query, limit = 10 } = {}) {
  const search = cleanText(query, 240);
  if (!search) throw Object.assign(new Error("BLUESKY_QUERY_REQUIRED"), { code:"BLUESKY_QUERY_REQUIRED" });
  const url = new URL("/xrpc/app.bsky.feed.searchPosts", BLUESKY_PUBLIC_API_ORIGIN);
  url.search = new URLSearchParams({ q:search, sort:"latest", limit:String(boundedLimit(limit)) }).toString();
  return { url:url.toString(), options:{ method:"GET", headers:{ accept:"application/json", "user-agent":RADAR_SOURCE_USER_AGENT } } };
}

export function buildMastodonSearchRequest({ origin, accessToken, query, limit = 10 } = {}) {
  const token = safeToken(accessToken, "MASTODON_ACCESS_TOKEN_REQUIRED");
  const search = cleanText(query, 240);
  if (!search) throw Object.assign(new Error("MASTODON_QUERY_REQUIRED"), { code:"MASTODON_QUERY_REQUIRED" });
  const url = new URL("/api/v2/search", safeMastodonOrigin(origin));
  url.search = new URLSearchParams({ q:search, type:"statuses", resolve:"false", limit:String(boundedLimit(limit)) }).toString();
  return { url:url.toString(), options:{ method:"GET", headers:{ accept:"application/json", authorization:`Bearer ${token}` } } };
}

function atUriPostUrl(uri, handle) {
  const match = String(uri || "").match(/^at:\/\/[^/]+\/app\.bsky\.feed\.post\/([^/]+)$/);
  return match && handle ? `https://bsky.app/profile/${encodeURIComponent(handle)}/post/${encodeURIComponent(match[1])}` : null;
}

function normalizedHint(sourceId, item) {
  return {
    source_id:sourceId,
    source_item_id:String(item.source_item_id || "").slice(0, 240),
    source_url:item.source_url || null,
    title:cleanText(item.title, 240),
    excerpt:cleanText(item.excerpt, 1200),
    published_at:isoOrNull(item.published_at),
    author:cleanText(item.author, 160) || null,
    discovery_only:true,
    requires_original_verification:true
  };
}

export function parseUpworkSearch(payload) {
  const edges = payload?.data?.marketplaceJobPostingsSearch?.edges;
  if (!Array.isArray(edges)) throw Object.assign(new Error("UPWORK_SCHEMA_MISMATCH"), { code:"UPWORK_SCHEMA_MISMATCH" });
  return edges.map(({ node }) => normalizedHint("upwork_official", {
    source_item_id:node?.id,
    source_url:node?.ciphertext ? `https://www.upwork.com/jobs/${encodeURIComponent(String(node.ciphertext))}` : null,
    title:node?.title,
    excerpt:node?.description,
    published_at:null,
    author:null
  })).filter((item) => item.source_item_id && item.source_url && item.title);
}

export function parseRedditSearch(payload) {
  const children = payload?.data?.children;
  if (!Array.isArray(children)) throw Object.assign(new Error("REDDIT_SCHEMA_MISMATCH"), { code:"REDDIT_SCHEMA_MISMATCH" });
  return children.map((entry) => entry?.data).filter((item) => String(item?.subreddit || "").toLowerCase() === "gamedevclassifieds")
    .map((item) => normalizedHint("reddit_official", {
      source_item_id:item.name || item.id,
      source_url:item.permalink ? new URL(item.permalink, "https://www.reddit.com").toString() : null,
      title:item.title,
      excerpt:item.selftext,
      published_at:Number.isFinite(Number(item.created_utc)) ? new Date(Number(item.created_utc) * 1000).toISOString() : null,
      author:item.author
    })).filter((item) => item.source_item_id && item.source_url && item.title);
}

export function parseBlueskySearch(payload) {
  if (!Array.isArray(payload?.posts)) throw Object.assign(new Error("BLUESKY_SCHEMA_MISMATCH"), { code:"BLUESKY_SCHEMA_MISMATCH" });
  return payload.posts.map((post) => normalizedHint("bluesky_public", {
    source_item_id:post?.uri,
    source_url:atUriPostUrl(post?.uri, post?.author?.handle),
    title:post?.record?.text,
    excerpt:post?.record?.text,
    published_at:post?.record?.createdAt || post?.indexedAt,
    author:post?.author?.handle
  })).filter((item) => item.source_item_id && item.source_url && item.title);
}

export function parseMastodonSearch(payload) {
  if (!Array.isArray(payload?.statuses)) throw Object.assign(new Error("MASTODON_SCHEMA_MISMATCH"), { code:"MASTODON_SCHEMA_MISMATCH" });
  return payload.statuses.map((status) => normalizedHint("mastodon_official", {
    source_item_id:status?.id,
    source_url:status?.url,
    title:status?.content,
    excerpt:[status?.spoiler_text, status?.content].filter(Boolean).join(" "),
    published_at:status?.created_at,
    author:status?.account?.acct
  })).filter((item) => item.source_item_id && item.source_url && item.title);
}

const ADAPTERS = Object.freeze({
  upwork_official:{ build:buildUpworkSearchRequest, parse:parseUpworkSearch },
  reddit_official:{ build:buildRedditSearchRequest, parse:parseRedditSearch },
  bluesky_public:{ build:buildBlueskySearchRequest, parse:parseBlueskySearch },
  mastodon_official:{ build:buildMastodonSearchRequest, parse:parseMastodonSearch }
});

export async function collectOfficialSource({ sourceId, config = {}, query, limit = 10, fetchImpl = fetch } = {}) {
  const adapter = ADAPTERS[sourceId];
  if (!adapter) throw Object.assign(new Error("OFFICIAL_SOURCE_ADAPTER_UNAVAILABLE"), { code:"OFFICIAL_SOURCE_ADAPTER_UNAVAILABLE" });
  const request = adapter.build({ ...config, query, limit });
  const payload = await requestJson(request.url, request.options, { fetchImpl });
  const items = adapter.parse(payload).slice(0, boundedLimit(limit));
  return {
    source_id:sourceId,
    status:"COMPLETE",
    requests:1,
    items,
    counters:{ source_requests:1, candidates_seen:items.length, openai_requests:0, retries:0, cost_usd:0 }
  };
}
