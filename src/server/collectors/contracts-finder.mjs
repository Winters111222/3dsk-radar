import { createHash } from "node:crypto";
import { CollectorError, assertCollectorResult, boundedCollectorInteger } from "./collector-contract.mjs";
import { boundedFindTenderCursor, findTenderFreshnessBounds, parseFindTenderResponse } from "./find-tender.mjs";
import { SOURCE_QUERY_PACKS } from "./query-packs.mjs";

export const CONTRACTS_FINDER_SOURCE_ID = "contracts_finder_uk";
export const CONTRACTS_FINDER_API_URL = "https://www.contractsfinder.service.gov.uk/Published/Notices/OCDS/Search";
export const CONTRACTS_FINDER_DOCUMENTATION_URL = "https://www.contractsfinder.service.gov.uk/apidocumentation/Notices/1/GET-Published-Notice-OCDS-Search";
export const CONTRACTS_FINDER_QUERY_PACKS = SOURCE_QUERY_PACKS;

export function buildContractsFinderRequest({ queryPackId, nowIso, cursor = null, limit = 25 } = {}) {
  if (!CONTRACTS_FINDER_QUERY_PACKS[queryPackId]) {
    throw new CollectorError("CONTRACTS_FINDER_QUERY_PACK_UNKNOWN", "Unknown Contracts Finder query pack.", { status:400 });
  }
  const bounds = findTenderFreshnessBounds(nowIso);
  const url = new URL(CONTRACTS_FINDER_API_URL);
  url.searchParams.set("publishedFrom", bounds.updatedFrom);
  url.searchParams.set("publishedTo", bounds.updatedTo);
  url.searchParams.set("stages", "tender");
  url.searchParams.set("limit", String(boundedCollectorInteger(limit, 25, 1, 50)));
  const safeCursor = boundedFindTenderCursor(cursor);
  if (safeCursor) url.searchParams.set("cursor", safeCursor);
  return { url:url.toString(), options:{ method:"GET", headers:{ accept:"application/json" } } };
}

function safeNoticeUrl(release) {
  const documents = Array.isArray(release?.tender?.documents) ? release.tender.documents : [];
  for (const document of documents) {
    if (document?.documentType !== "tenderNotice" || typeof document?.url !== "string") continue;
    try {
      const url = new URL(document.url);
      if (url.protocol === "https:" && url.hostname === "www.contractsfinder.service.gov.uk" && /^\/Notice\/[A-Za-z0-9-]+$/.test(url.pathname)) {
        return url.toString();
      }
    } catch {
      // Keep looking for a valid first-party tender notice URL.
    }
  }
  return null;
}

function dateOnly(value) {
  const match = String(value || "").match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function stableRecordId(queryPackId, tenderIdentity, sourceRevision) {
  return `cfs-${createHash("sha256").update(`${queryPackId}|${tenderIdentity}|${sourceRevision}`).digest("hex").slice(0, 16)}`;
}

function nextCursor(payload) {
  const value = payload?.links?.next;
  if (value == null) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "www.contractsfinder.service.gov.uk" || url.pathname !== "/Published/Notices/OCDS/Search") {
      throw new Error("unexpected next link");
    }
    return boundedFindTenderCursor(url.searchParams.get("cursor"));
  } catch (error) {
    if (error instanceof CollectorError) throw error;
    throw new CollectorError("CONTRACTS_FINDER_SCHEMA_MISMATCH", "Contracts Finder returned an invalid next cursor.");
  }
}

export function parseContractsFinderResponse(payload, { queryPackId, fetchedAt } = {}) {
  // Both UK services publish the same OCDS release fields used by the local truth filters.
  // Suppress the other service's cursor parser, then replace source identity and provenance below.
  const parsed = parseFindTenderResponse({ ...payload, links:{} }, { queryPackId, fetchedAt });
  const releasesById = new Map((Array.isArray(payload?.releases) ? payload.releases : []).map((release) => [String(release?.id || ""), release]));
  let rejectedInvalid = parsed.rejected_invalid;
  const records = parsed.records.flatMap((record) => {
    const release = releasesById.get(record.source_revision);
    const canonicalUrl = safeNoticeUrl(release);
    if (!canonicalUrl) {
      rejectedInvalid += 1;
      return [];
    }
    return [{
      ...record,
      collector_record_id:stableRecordId(queryPackId, record.tender_identity, record.source_revision),
      source_id:CONTRACTS_FINDER_SOURCE_ID,
      published_date:dateOnly(release?.tender?.datePublished),
      canonical_url:canonicalUrl
    }];
  });
  return {
    ...parsed,
    records,
    rejected_invalid:rejectedInvalid,
    iteration_next_token:nextCursor(payload)
  };
}

async function errorExcerpt(response) {
  try { return (await response.text()).replace(/\s+/g, " ").slice(0, 240); }
  catch { return ""; }
}

export async function collectContractsFinderNotices({ queryPackId, nowIso, cursor = null, limit = 25, fetchImpl = fetch, timeoutMs = 12_000 } = {}) {
  const request = buildContractsFinderRequest({ queryPackId, nowIso, cursor, limit });
  let response;
  try {
    response = await fetchImpl(request.url, { ...request.options, signal:AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    const timeout = error?.name === "TimeoutError" || error?.name === "AbortError";
    throw new CollectorError(timeout ? "CONTRACTS_FINDER_TIMEOUT" : "CONTRACTS_FINDER_NETWORK_FAILED", timeout ? "Contracts Finder request timed out." : "Contracts Finder request failed.", { status:timeout ? 504 : 502 });
  }
  if (!response?.ok) {
    const excerpt = await errorExcerpt(response);
    const upstreamStatus = response?.status || null;
    const rateLimited = upstreamStatus === 403;
    throw new CollectorError(
      rateLimited ? "CONTRACTS_FINDER_UPSTREAM_RATE_LIMITED" : "CONTRACTS_FINDER_UPSTREAM_FAILED",
      `Contracts Finder returned HTTP ${upstreamStatus || "unknown"}${excerpt ? `: ${excerpt}` : "."}`,
      { status:rateLimited ? 429 : 502, upstreamStatus, retryAfterSeconds:rateLimited ? 300 : null }
    );
  }
  let payload;
  try { payload = await response.json(); }
  catch { throw new CollectorError("CONTRACTS_FINDER_JSON_INVALID", "Contracts Finder returned invalid JSON."); }
  const parsed = parseContractsFinderResponse(payload, { queryPackId, fetchedAt:nowIso });
  return assertCollectorResult({
    source_id:CONTRACTS_FINDER_SOURCE_ID,
    query_pack_id:queryPackId,
    records:parsed.records,
    upstream_total:null,
    next_cursor:parsed.iteration_next_token,
    counters:{
      source_services_planned:1,
      source_services_completed:1,
      source_services_blocked:0,
      source_services_failed:0,
      list_pages_fetched:1,
      detail_pages_fetched:0,
      records_seen:payload.releases.length,
      records_returned:parsed.records.length,
      records_rejected_stale_or_undated:parsed.rejected_stale_or_undated,
      records_rejected_inactive:parsed.rejected_inactive,
      records_rejected_scope:parsed.rejected_scope,
      records_rejected_invalid:parsed.rejected_invalid,
      openai_requests:0,
      cost_usd:0
    }
  });
}
