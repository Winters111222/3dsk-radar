import { buildOpenAIRequest } from "./search-contract.mjs";
import {
  extractWebSourceUrls,
  normalizeUrl,
  normalizeSearchResponse,
  parseStructuredSearchResponse
} from "./normalize.mjs";
import { addUsage, countWebSearchCalls } from "./search-cost.mjs";
import {
  FOCUSED_INDEX_DISCOVERY_ALLOWED_DOMAINS,
  INDEX_DISCOVERY_MODE
} from "./index-discovery.mjs";

export const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

function safeApiError(payload, status) {
  const code = payload?.error?.code || payload?.error?.type || `HTTP_${status}`;
  const message = payload?.error?.message || "OpenAI request failed";
  return { code:String(code).slice(0, 120), message:String(message).slice(0, 500) };
}

export async function callOpenAIResponses({ apiKey, body, fetchImpl = fetch, timeoutMs = 52000 }) {
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
  const response = await fetchImpl(OPENAI_RESPONSES_URL, {
    method:"POST",
    headers:{ "content-type":"application/json", authorization:`Bearer ${apiKey}` },
    body:JSON.stringify(body),
    signal:AbortSignal.timeout(timeoutMs)
  });

  let payload = null;
  try { payload = await response.json(); } catch { payload = null; }
  if (!response.ok) {
    const safe = safeApiError(payload, response.status);
    const error = new Error(safe.message);
    error.code = safe.code;
    error.status = response.status;
    throw error;
  }
  return payload;
}

export async function runOpportunitySearch({
  apiKey,
  model,
  profile,
  nowIso,
  maxResults = 12,
  fetchImpl = fetch,
  allowStructuredRetry = true,
  maxToolCalls = 3,
  maxOutputTokens = 8000
}) {
  let lastError;
  let aggregateUsage = null;
  let webSearchCallCount = 0;
  const attempts = allowStructuredRetry ? 2 : 1;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const requestBody = buildOpenAIRequest({
      profile,
      nowIso,
      maxResults,
      model,
      retry:attempt === 1,
      maxToolCalls,
      maxOutputTokens,
      allowedDomains:FOCUSED_INDEX_DISCOVERY_ALLOWED_DOMAINS
    });
    const raw = await callOpenAIResponses({ apiKey, body:requestBody, fetchImpl });
    aggregateUsage = addUsage(aggregateUsage, raw?.usage);
    webSearchCallCount += countWebSearchCalls(raw);
    try {
      const normalized = normalizeSearchResponse(raw, { nowIso, maxResults, indexDiscovery:true });
      return {
        ...normalized,
        discovery_mode:INDEX_DISCOVERY_MODE,
        search_profile:"FOCUSED",
        search_status:"COMPLETE",
        coverage:null,
        allowed_domains:[...FOCUSED_INDEX_DISCOVERY_ALLOWED_DOMAINS],
        direct_source_requests:0,
        model:raw?.model || model,
        response_id:raw?.id || null,
        response_ids:raw?.id ? [raw.id] : [],
        usage:aggregateUsage,
        web_search_call_count:webSearchCallCount,
        openai_request_count:attempt + 1,
        attempts:attempt + 1
      };
    } catch (error) {
      lastError = error;
      if (attempt + 1 >= attempts) break;
    }
  }

  const error = new Error(`Structured search validation failed: ${lastError?.message || "unknown error"}`);
  error.code = "SEARCH_SCHEMA_VALIDATION_FAILED";
  throw error;
}

function syntheticResponse(successful, model) {
  const output = [];
  let usage = null;
  const opportunities = [];
  for (const item of successful) {
    usage = addUsage(usage, item.raw?.usage);
    opportunities.push(...item.parsed.opportunities);
    output.push(...(item.raw?.output || []).filter((part) => part?.type === "web_search_call"));
  }
  output.push({
    type:"message",
    content:[{ type:"output_text", text:JSON.stringify({ opportunities }) }]
  });
  return { id:"wide-search-combined", model:successful.find((item) => item.raw?.model)?.raw.model || model, usage, output };
}

function failureCode(error) {
  if (error?.name === "TimeoutError" || error?.name === "AbortError") return "TIMEOUT";
  return String(error?.code || "REQUEST_FAILED").slice(0, 80);
}

function urlMatchesAllowedDomain(value, allowedDomains) {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return allowedDomains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

export async function runWideOpportunitySearch({
  apiKey,
  model,
  profile,
  nowIso,
  shards,
  maxResults = 24,
  maxResultsPerShard = 6,
  maxToolCallsPerShard = 3,
  maxOutputTokensPerShard = 6000,
  fetchImpl = fetch,
  timeoutMs = 45000
}) {
  if (!Array.isArray(shards) || !shards.length) {
    const error = new Error("Wide search plan is empty");
    error.code = "WIDE_SEARCH_PLAN_INVALID";
    throw error;
  }

  const settled = await Promise.all(shards.map(async (shard) => {
    const requestBody = buildOpenAIRequest({
      profile,
      nowIso,
      maxResults:maxResultsPerShard,
      model,
      retry:false,
      maxToolCalls:maxToolCallsPerShard,
      maxOutputTokens:maxOutputTokensPerShard,
      allowedDomains:shard.allowed_domains,
      searchFocus:shard.focus,
      shardLabel:shard.label,
      searchContextSize:"high"
    });
    let raw = null;
    try {
      raw = await callOpenAIResponses({ apiKey, body:requestBody, fetchImpl, timeoutMs });
      const parsed = parseStructuredSearchResponse(raw);
      const webCalls = countWebSearchCalls(raw);
      const sourceUrls = extractWebSourceUrls(raw);
      if (webCalls < 1 || webCalls > maxToolCallsPerShard) {
        const error = new Error("Shard did not honor the hosted web-search boundary");
        error.code = "WIDE_SEARCH_TOOL_BOUNDARY_INVALID";
        throw error;
      }
      if (!sourceUrls.size) {
        const error = new Error("Shard returned no verifiable hosted-search sources");
        error.code = "WIDE_SEARCH_NO_VERIFIABLE_SOURCES";
        throw error;
      }
      if (![...sourceUrls].every((url) => urlMatchesAllowedDomain(url, shard.allowed_domains))) {
        const error = new Error("Shard returned a source outside its server-owned domain boundary");
        error.code = "WIDE_SEARCH_DOMAIN_BOUNDARY_INVALID";
        throw error;
      }
      parsed.opportunities = parsed.opportunities.filter((candidate) => {
        const sourceUrl = normalizeUrl(candidate?.source_url);
        return sourceUrl && sourceUrls.has(sourceUrl) && urlMatchesAllowedDomain(sourceUrl, shard.allowed_domains);
      });
      return {
        ok:true,
        shard,
        raw,
        parsed,
        web_calls:webCalls,
        consulted_urls:sourceUrls.size
      };
    } catch (error) {
      return {
        ok:false,
        shard,
        raw,
        web_calls:countWebSearchCalls(raw),
        consulted_urls:extractWebSourceUrls(raw).size,
        error_code:failureCode(error)
      };
    }
  }));

  const successful = settled.filter((item) => item.ok);
  if (!successful.length) {
    const error = new Error("All required wide-search coverage shards failed; no result was persisted");
    error.code = "WIDE_SEARCH_ALL_SHARDS_FAILED";
    error.coverage = settled.map((item) => ({ shard_id:item.shard.id, status:"FAILED", error_code:item.error_code }));
    throw error;
  }

  const combined = syntheticResponse(successful, model);
  const normalized = normalizeSearchResponse(combined, { nowIso, maxResults, indexDiscovery:true });
  const aggregateUsage = settled.reduce((usage, item) => addUsage(usage, item.raw?.usage), null);
  const aggregateWebSearchCalls = settled.reduce((sum, item) => sum + Number(item.web_calls || 0), 0);
  const allowedDomains = [...new Set(shards.flatMap((item) => item.allowed_domains))];
  const coverage = settled.map((item) => item.ok ? {
    shard_id:item.shard.id,
    shard_label:item.shard.label,
    status:"COMPLETE",
    allowed_domain_count:item.shard.allowed_domains.length,
    consulted_urls:item.consulted_urls,
    candidates_seen:item.parsed.opportunities.length,
    web_search_calls:item.web_calls,
    error_code:null
  } : {
    shard_id:item.shard.id,
    shard_label:item.shard.label,
    status:"FAILED",
    allowed_domain_count:item.shard.allowed_domains.length,
    consulted_urls:item.consulted_urls,
    candidates_seen:0,
    web_search_calls:item.web_calls,
    error_code:item.error_code
  });

  return {
    ...normalized,
    discovery_mode:INDEX_DISCOVERY_MODE,
    search_profile:"WIDE_INDEX",
    search_status:successful.length === shards.length ? "COMPLETE" : "PARTIAL",
    coverage,
    allowed_domains:allowedDomains,
    direct_source_requests:0,
    model:combined.model,
    response_id:null,
    response_ids:successful.map((item) => item.raw?.id).filter(Boolean),
    usage:aggregateUsage,
    web_search_call_count:aggregateWebSearchCalls,
    openai_request_count:shards.length,
    attempts:1
  };
}
