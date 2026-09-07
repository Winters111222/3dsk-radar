import { normalizeUrl } from "./normalize.mjs";
import { indexDiscoveryPolicyForUrl } from "./index-discovery.mjs";

export const FIRECRAWL_SEARCH_URL = "https://api.firecrawl.dev/v2/search";
export const FIRECRAWL_MAX_REQUESTS = 5;
export const FIRECRAWL_MAX_CREDITS = 26;
export const FIRECRAWL_RESULT_LIMIT = 8;

const PUBLIC_RENDER_DOMAINS = Object.freeze(new Set([
  "workwithindies.com",
  "remotegamejobs.com",
  "greenhouse.io",
  "lever.co",
  "ashbyhq.com",
  "workable.com",
  "teamtailor.com",
  "recruitee.com",
  "ted.europa.eu",
  "find-tender.service.gov.uk",
  "contractsfinder.service.gov.uk",
  "sam.gov",
  "canadabuys.canada.ca",
  "ungm.org",
  "procurement-notices.undp.org",
  "worldbank.org"
]));

const QUERY_BY_SHARD = Object.freeze({
  direct_marketplaces:'("3D character" OR photogrammetry OR "scan cleanup" OR "digital human" OR "character outsourcing") (project OR contract OR freelance OR vendor)',
  artist_communities:'("3D character" OR photogrammetry OR "scan cleanup" OR "digital human") (paid OR hiring OR contract OR freelance)',
  contract_and_ats:'("character artist" OR "character outsourcing" OR photogrammetry OR "digital human" OR "external development") (contract OR freelance OR vendor OR outsourcing)',
  public_procurement:'(photogrammetry OR "3D scanning" OR "digital human" OR "character production" OR "facial capture") (tender OR RFP OR RFQ OR procurement)',
  worldwide_multilingual:'("3D character" OR photogrammetry OR "digital human" OR "scan cleanup" OR fotogrammetrie OR digitaler Mensch OR personnage 3D OR escaneo 3D OR キャラクター) (contract OR freelance OR vendor OR outsourcing OR tender)',
  marketplaces_core:'("3D character" OR photogrammetry OR "scan cleanup" OR "digital human" OR "character outsourcing") (project OR contract OR freelance OR vendor)',
  communities_paid:'("3D character" OR photogrammetry OR "scan cleanup" OR "digital human") (paid OR hiring OR contract OR freelance)',
  contract_boards:'("character artist" OR "character outsourcing" OR photogrammetry OR "digital human" OR "external development") (contract OR freelance OR vendor OR outsourcing)',
  procurement:'(photogrammetry OR "3D scanning" OR "digital human" OR "character production" OR "facial capture") (tender OR RFP OR RFQ OR procurement)'
});

const RENDER_SHARDS = new Set(["contract_and_ats", "public_procurement", "contract_boards", "procurement"]);
const CHALLENGE_PATTERN = /verify you are human|checking your browser|captcha|automated traffic|access denied|sign in to continue|log in to continue/i;

function hostnameMatches(hostname, domain) {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

function allowedDomain(url, domains) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return domains.some((domain) => hostnameMatches(hostname, domain));
  } catch {
    return false;
  }
}

function renderDomainsForShard(shard) {
  return shard.allowed_domains.filter((domain) => PUBLIC_RENDER_DOMAINS.has(domain));
}

function sourceText(item) {
  return [item?.title, item?.description, item?.markdown].filter(Boolean).join("\n").trim();
}

function renderedPageVerified(item, normalizedUrl, renderDomains) {
  if (!renderDomains.length || !allowedDomain(normalizedUrl, renderDomains)) return false;
  const status = Number(item?.metadata?.statusCode);
  const markdown = String(item?.markdown || "").trim();
  if ((!Number.isFinite(status) || !((status >= 200 && status < 300) || status === 304)) || markdown.length < 80) return false;
  return !CHALLENGE_PATTERN.test(markdown.slice(0, 1500));
}

function safeErrorCode(error) {
  if (error?.name === "TimeoutError" || error?.name === "AbortError") return "FIRECRAWL_TIMEOUT";
  return String(error?.code || "FIRECRAWL_REQUEST_FAILED").slice(0, 80);
}

export function buildFirecrawlSearchRequest(shard) {
  const query = QUERY_BY_SHARD[shard?.id];
  if (!query || !Array.isArray(shard?.allowed_domains) || !shard.allowed_domains.length) {
    const error = new Error("FIRECRAWL_SHARD_INVALID");
    error.code = "FIRECRAWL_SHARD_INVALID";
    throw error;
  }
  const renderDomains = RENDER_SHARDS.has(shard.id) ? renderDomainsForShard(shard) : [];
  const includeDomains = renderDomains.length ? renderDomains : [...shard.allowed_domains];
  const body = {
    query,
    sources:["web"],
    includeDomains,
    tbs:"qdr:m",
    limit:FIRECRAWL_RESULT_LIMIT,
    safe:true,
    highlights:false,
    ignoreInvalidURLs:true,
    timeout:30000
  };
  if (renderDomains.length) {
    body.scrapeOptions = {
      formats:["markdown"],
      onlyMainContent:true,
      maxAge:3600000,
      parsers:[]
    };
  }
  return { body, render_domains:renderDomains, predicted_max_credits:2 + (renderDomains.length ? FIRECRAWL_RESULT_LIMIT : 0) };
}

export async function callFirecrawlSearch({ apiKey, body, fetchImpl = fetch, timeoutMs = 35000 } = {}) {
  if (!apiKey) {
    const error = new Error("FIRECRAWL_API_KEY_REQUIRED");
    error.code = "FIRECRAWL_API_KEY_REQUIRED";
    throw error;
  }
  const response = await fetchImpl(FIRECRAWL_SEARCH_URL, {
    method:"POST",
    headers:{ "content-type":"application/json", authorization:`Bearer ${apiKey}` },
    body:JSON.stringify(body),
    signal:AbortSignal.timeout(timeoutMs)
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.success !== true) {
    const error = new Error("FIRECRAWL_UPSTREAM_FAILED");
    error.code = `FIRECRAWL_HTTP_${response.status}`;
    error.status = response.status;
    throw error;
  }
  return payload;
}

function normalizeShardResult(shard, payload, request) {
  const hints = [];
  const verifiedUrls = new Set();
  for (const item of payload?.data?.web || []) {
    const url = normalizeUrl(item?.url);
    if (!url || !allowedDomain(url, shard.allowed_domains) || !indexDiscoveryPolicyForUrl(url)) continue;
    const text = sourceText(item);
    hints.push({
      url,
      title:String(item?.title || "").slice(0, 240),
      description:String(item?.description || "").slice(0, 500),
      excerpt:String(item?.markdown || "").slice(0, 1400),
      rendered:renderedPageVerified(item, url, request.render_domains)
    });
    if (hints.at(-1).rendered) verifiedUrls.add(url);
  }
  const credits = Number(payload?.creditsUsed);
  if (!Number.isInteger(credits) || credits < 0 || credits > request.predicted_max_credits) {
    const error = new Error("FIRECRAWL_CREDIT_BOUNDARY_EXCEEDED");
    error.code = "FIRECRAWL_CREDIT_BOUNDARY_EXCEEDED";
    throw error;
  }
  return {
    shard_id:shard.id,
    status:"COMPLETE",
    request_id:payload?.id || null,
    credits_used:credits,
    results_seen:(payload?.data?.web || []).length,
    hints,
    verified_urls:[...verifiedUrls],
    rendered_pages:hints.filter((item) => item.rendered).length,
    error_code:null
  };
}

export async function runFirecrawlWideDiscovery({ apiKey, shards, fetchImpl = fetch } = {}) {
  if (!Array.isArray(shards) || shards.length !== FIRECRAWL_MAX_REQUESTS) {
    const error = new Error("FIRECRAWL_PLAN_INVALID");
    error.code = "FIRECRAWL_PLAN_INVALID";
    throw error;
  }
  const settled = await Promise.all(shards.map(async (shard) => {
    const request = buildFirecrawlSearchRequest(shard);
    try {
      const payload = await callFirecrawlSearch({ apiKey, body:request.body, fetchImpl });
      return normalizeShardResult(shard, payload, request);
    } catch (error) {
      return {
        shard_id:shard.id,
        status:"FAILED",
        request_id:null,
        credits_used:0,
        results_seen:0,
        hints:[],
        verified_urls:[],
        rendered_pages:0,
        error_code:safeErrorCode(error)
      };
    }
  }));
  const creditsUsed = settled.reduce((sum, item) => sum + item.credits_used, 0);
  if (creditsUsed > FIRECRAWL_MAX_CREDITS) throw new Error("FIRECRAWL_RUN_CREDIT_CAP_EXCEEDED");
  return {
    provider:"FIRECRAWL",
    status:settled.every((item) => item.status === "COMPLETE") ? "COMPLETE" : "PARTIAL",
    requests:FIRECRAWL_MAX_REQUESTS,
    credits_used:creditsUsed,
    credit_cap:FIRECRAWL_MAX_CREDITS,
    rendered_pages:settled.reduce((sum, item) => sum + item.rendered_pages, 0),
    verified_urls:[...new Set(settled.flatMap((item) => item.verified_urls))],
    shards:settled
  };
}

export function firecrawlHintsForShard(discovery, shardId) {
  return discovery?.shards?.find((item) => item.shard_id === shardId)?.hints || [];
}

export function firecrawlVerifiedUrlsForShard(discovery, shardId) {
  return new Set(discovery?.shards?.find((item) => item.shard_id === shardId)?.verified_urls || []);
}
