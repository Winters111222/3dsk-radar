import { CollectorError } from "./collector-contract.mjs";
import {
  buildContractsFinderRequest,
  parseContractsFinderResponse
} from "./contracts-finder.mjs";
import {
  buildFindTenderRequest,
  parseFindTenderResponse
} from "./find-tender.mjs";
import { SOURCE_QUERY_PACKS } from "./query-packs.mjs";
import { collectTedNotices } from "./ted.mjs";

export const YIELD_MEASUREMENT_LIMIT = 50;
export const YIELD_MEASUREMENT_MAX_REQUESTS = 6;
export const YIELD_MEASUREMENT_PACK_IDS = Object.freeze(Object.keys(SOURCE_QUERY_PACKS));

function wait(milliseconds) {
  return milliseconds > 0 ? new Promise((resolve) => setTimeout(resolve, milliseconds)) : Promise.resolve();
}

function safeError(error) {
  return {
    status:"ERROR",
    code:String(error?.code || error?.name || "SOURCE_MEASUREMENT_FAILED").slice(0, 80),
    upstream_status:Number.isInteger(error?.upstreamStatus) ? error.upstreamStatus : null
  };
}

function tedMetrics(result) {
  return {
    status:"OK",
    records_seen:result.counters.records_seen,
    records_returned:result.counters.records_returned,
    records_rejected_stale_or_undated:result.counters.records_rejected_stale_or_undated,
    upstream_total:result.upstream_total
  };
}

function ocdsMetrics(parsed, recordsSeen) {
  return {
    status:"OK",
    records_seen:recordsSeen,
    records_returned:parsed.records.length,
    records_rejected_stale_or_undated:parsed.rejected_stale_or_undated,
    records_rejected_inactive:parsed.rejected_inactive,
    records_rejected_scope:parsed.rejected_scope,
    records_rejected_invalid:parsed.rejected_invalid
  };
}

async function fetchOcdsPage({ buildRequest, parseResponse, queryPackId, nowIso, countedFetch, timeoutMs }) {
  const request = buildRequest({ queryPackId, nowIso, limit:YIELD_MEASUREMENT_LIMIT });
  let response;
  try {
    response = await countedFetch(request.url, { ...request.options, signal:AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    const timeout = error?.name === "TimeoutError" || error?.name === "AbortError";
    throw new CollectorError(timeout ? "YIELD_MEASUREMENT_TIMEOUT" : "YIELD_MEASUREMENT_NETWORK_FAILED", "Yield measurement request failed.", { status:timeout ? 504 : 502 });
  }
  if (!response?.ok) {
    throw new CollectorError("YIELD_MEASUREMENT_UPSTREAM_FAILED", `Yield measurement returned HTTP ${response?.status || "unknown"}.`, { status:502, upstreamStatus:response?.status || null });
  }
  let payload;
  try { payload = await response.json(); }
  catch { throw new CollectorError("YIELD_MEASUREMENT_JSON_INVALID", "Yield measurement returned invalid JSON."); }
  if (!Array.isArray(payload?.releases)) {
    throw new CollectorError("YIELD_MEASUREMENT_SCHEMA_MISMATCH", "Yield measurement response is missing releases[].");
  }
  const packs = {};
  for (const packId of YIELD_MEASUREMENT_PACK_IDS) {
    packs[packId] = ocdsMetrics(parseResponse(payload, { queryPackId:packId, fetchedAt:nowIso }), payload.releases.length);
  }
  return packs;
}

export async function measureCollectorYield({
  nowIso = new Date().toISOString(),
  fetchImpl = fetch,
  timeoutMs = 20_000,
  delayMs = 750
} = {}) {
  let networkRequests = 0;
  const countedFetch = (...args) => {
    networkRequests += 1;
    if (networkRequests > YIELD_MEASUREMENT_MAX_REQUESTS) {
      throw new CollectorError("YIELD_MEASUREMENT_REQUEST_CAP_EXCEEDED", "Yield measurement exceeded its fixed request cap.", { status:500 });
    }
    return fetchImpl(...args);
  };

  const sources = { ted_eu:{} };
  for (const packId of YIELD_MEASUREMENT_PACK_IDS) {
    try {
      const result = await collectTedNotices({ queryPackId:packId, nowIso, limit:YIELD_MEASUREMENT_LIMIT, fetchImpl:countedFetch, timeoutMs });
      sources.ted_eu[packId] = tedMetrics(result);
    } catch (error) {
      sources.ted_eu[packId] = safeError(error);
    }
    await wait(delayMs);
  }

  for (const definition of [
    { sourceId:"find_tender_uk", buildRequest:buildFindTenderRequest, parseResponse:parseFindTenderResponse },
    { sourceId:"contracts_finder_uk", buildRequest:buildContractsFinderRequest, parseResponse:parseContractsFinderResponse }
  ]) {
    try {
      sources[definition.sourceId] = await fetchOcdsPage({
        ...definition,
        queryPackId:"other_relevant",
        nowIso,
        countedFetch,
        timeoutMs
      });
    } catch (error) {
      sources[definition.sourceId] = safeError(error);
    }
    await wait(delayMs);
  }

  const allStatuses = Object.values(sources).flatMap((source) => source.status ? [source.status] : Object.values(source).map((pack) => pack.status));
  const complete = allStatuses.length === 12 && allStatuses.every((status) => status === "OK");
  return {
    ok:complete,
    mode:"READ_ONLY_SOURCE_YIELD_MEASUREMENT",
    measured_at:nowIso,
    records_per_page:YIELD_MEASUREMENT_LIMIT,
    network_requests:networkRequests,
    max_network_requests:YIELD_MEASUREMENT_MAX_REQUESTS,
    automatic_retries:0,
    openai_requests:0,
    cost_usd:0,
    persistence:"NONE",
    sources
  };
}
