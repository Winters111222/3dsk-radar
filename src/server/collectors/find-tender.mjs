import { createHash } from "node:crypto";
import { CollectorError, assertCollectorResult, boundedCollectorInteger } from "./collector-contract.mjs";
import { SOURCE_QUERY_PACKS } from "./query-packs.mjs";

export const FIND_TENDER_SOURCE_ID = "find_tender_uk";
export const FIND_TENDER_API_URL = "https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages";
export const FIND_TENDER_DOCUMENTATION_URL = "https://www.find-tender.service.gov.uk/Developer/Documentation";
export const FIND_TENDER_RELEASE_DOCUMENTATION_URL = "https://www.find-tender.service.gov.uk/apidocumentation/1.0/GET-ocdsReleasePackages";
export const FIND_TENDER_QUERY_PACKS = SOURCE_QUERY_PACKS;

function serverTime(nowIso) {
  const now = new Date(nowIso);
  if (!Number.isFinite(now.getTime())) {
    throw new CollectorError("COLLECTOR_TIME_INVALID", "A valid server timestamp is required.", { status:500 });
  }
  return now;
}

function apiTimestamp(date) {
  return date.toISOString().slice(0, 19);
}

function dateOnly(value) {
  const match = String(value || "").match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

export function findTenderFreshnessBounds(nowIso, days = 30) {
  const now = serverTime(nowIso);
  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - days);
  return { updatedFrom:apiTimestamp(from), updatedTo:apiTimestamp(now) };
}

export function boundedFindTenderCursor(value) {
  if (value == null || value === "") return null;
  const cursor = String(value);
  if (!/^[A-Za-z0-9=]{1,300}$/.test(cursor)) {
    throw new CollectorError("FIND_TENDER_CURSOR_INVALID", "Find a Tender cursor is invalid.", { status:400 });
  }
  return cursor;
}

export function buildFindTenderRequest({ queryPackId, nowIso, cursor = null, limit = 25 } = {}) {
  if (!FIND_TENDER_QUERY_PACKS[queryPackId]) {
    throw new CollectorError("FIND_TENDER_QUERY_PACK_UNKNOWN", "Unknown Find a Tender query pack.", { status:400 });
  }
  const bounds = findTenderFreshnessBounds(nowIso);
  const url = new URL(FIND_TENDER_API_URL);
  url.searchParams.set("updatedFrom", bounds.updatedFrom);
  url.searchParams.set("updatedTo", bounds.updatedTo);
  url.searchParams.set("stages", "tender");
  url.searchParams.set("limit", String(boundedCollectorInteger(limit, 25, 1, 50)));
  const safeCursor = boundedFindTenderCursor(cursor);
  if (safeCursor) url.searchParams.set("cursor", safeCursor);
  return {
    url:url.toString(),
    options:{ method:"GET", headers:{ accept:"application/json" } }
  };
}

function textValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

function compactText(values, maxLength = 2_000) {
  return values.map(textValue).filter(Boolean).join(" ").replace(/\s+/g, " ").slice(0, maxLength);
}

function buyerNames(release) {
  const names = [textValue(release?.buyer?.name)];
  for (const party of Array.isArray(release?.parties) ? release.parties : []) {
    if (Array.isArray(party?.roles) && party.roles.includes("buyer")) names.push(textValue(party?.name));
  }
  return [...new Set(names.filter(Boolean))];
}

function searchableText(release) {
  const tender = release?.tender || {};
  const lotDescriptions = Array.isArray(tender.lots) ? tender.lots.map((lot) => lot?.description) : [];
  const itemDescriptions = Array.isArray(tender.items)
    ? tender.items.flatMap((item) => [item?.description, ...(Array.isArray(item?.additionalClassifications) ? item.additionalClassifications.map((entry) => entry?.description) : [])])
    : [];
  return compactText([
    tender.title,
    tender.description,
    tender.classification?.description,
    release?.description,
    ...lotDescriptions,
    ...itemDescriptions
  ], 20_000).toLowerCase();
}

function matchedPhrases(release, queryPackId) {
  const haystack = searchableText(release);
  return FIND_TENDER_QUERY_PACKS[queryPackId].phrases.filter((phrase) => haystack.includes(phrase.toLowerCase()));
}

function isFreshRelease(releaseDate, fetchedAt) {
  const releaseDay = dateOnly(releaseDate);
  const fetchedDay = dateOnly(fetchedAt);
  if (!releaseDay || !fetchedDay) return false;
  const cutoff = serverTime(`${fetchedDay}T00:00:00.000Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - 30);
  return releaseDay >= cutoff.toISOString().slice(0, 10) && releaseDay <= fetchedDay;
}

function isActiveTender(tender, fetchedAt) {
  if (String(tender?.status || "").toLowerCase() !== "active") return false;
  const deadline = dateOnly(tender?.tenderPeriod?.endDate);
  return !deadline || deadline >= dateOnly(fetchedAt);
}

function canonicalProcurementUrl(ocid) {
  const id = textValue(ocid);
  return /^[A-Za-z0-9._-]{1,160}$/.test(id)
    ? `https://www.find-tender.service.gov.uk/procurement/${encodeURIComponent(id)}`
    : null;
}

function stableRecordId(queryPackId, ocid, releaseId, index) {
  const identity = `${queryPackId}|${ocid || "unknown"}|${releaseId || index}`;
  return `fts-${createHash("sha256").update(identity).digest("hex").slice(0, 16)}`;
}

function nextCursor(payload) {
  const value = payload?.links?.next;
  if (value == null) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "www.find-tender.service.gov.uk" || url.pathname !== "/api/1.0/ocdsReleasePackages") {
      throw new Error("unexpected next link");
    }
    return boundedFindTenderCursor(url.searchParams.get("cursor"));
  } catch (error) {
    if (error instanceof CollectorError) throw error;
    throw new CollectorError("FIND_TENDER_SCHEMA_MISMATCH", "Find a Tender returned an invalid next cursor.");
  }
}

function normalizedValue(value) {
  const amount = Number(value?.amount);
  const currency = textValue(value?.currency);
  return Number.isFinite(amount) && amount >= 0 && /^[A-Z]{3}$/.test(currency) ? { amount, currency } : null;
}

export function parseFindTenderResponse(payload, { queryPackId, fetchedAt } = {}) {
  const pack = FIND_TENDER_QUERY_PACKS[queryPackId];
  if (!pack) throw new CollectorError("FIND_TENDER_QUERY_PACK_UNKNOWN", "Unknown Find a Tender query pack.", { status:400 });
  if (!payload || !Array.isArray(payload.releases)) {
    throw new CollectorError("FIND_TENDER_SCHEMA_MISMATCH", "Find a Tender response is missing releases[].");
  }

  const counters = { rejected_stale_or_undated:0, rejected_inactive:0, rejected_scope:0, rejected_invalid:0 };
  const records = [];
  payload.releases.forEach((release, index) => {
    const releaseDate = dateOnly(release?.date);
    if (!isFreshRelease(releaseDate, fetchedAt)) {
      counters.rejected_stale_or_undated += 1;
      return;
    }
    if (!isActiveTender(release?.tender, fetchedAt)) {
      counters.rejected_inactive += 1;
      return;
    }
    const matches = matchedPhrases(release, queryPackId);
    if (!matches.length) {
      counters.rejected_scope += 1;
      return;
    }
    const ocid = textValue(release?.ocid) || null;
    const releaseId = textValue(release?.id) || null;
    const title = textValue(release?.tender?.title) || null;
    const canonicalUrl = canonicalProcurementUrl(ocid);
    if (!releaseId || !title || !canonicalUrl) {
      counters.rejected_invalid += 1;
      return;
    }
    records.push({
      collector_record_id:stableRecordId(queryPackId, ocid, releaseId, index),
      source_id:FIND_TENDER_SOURCE_ID,
      query_pack_id:queryPackId,
      suggested_categories:[...pack.categories],
      source_item_id:releaseId,
      tender_identity:ocid,
      source_revision:releaseId,
      source_updated_date:releaseDate,
      title,
      summary:compactText([release?.tender?.description, release?.description]),
      buyer_names:buyerNames(release),
      tender_status:textValue(release?.tender?.status) || null,
      tender_deadline:dateOnly(release?.tender?.tenderPeriod?.endDate),
      classification_id:textValue(release?.tender?.classification?.id) || null,
      classification_description:textValue(release?.tender?.classification?.description) || null,
      upstream_tender_value:normalizedValue(release?.tender?.value),
      matched_phrases:matches,
      canonical_url:canonicalUrl,
      fetched_at:fetchedAt
    });
  });

  return { records, ...counters, upstream_total:null, iteration_next_token:nextCursor(payload) };
}

async function errorExcerpt(response) {
  try { return (await response.text()).replace(/\s+/g, " ").slice(0, 240); }
  catch { return ""; }
}

function retryAfterSeconds(response) {
  const value = Number.parseInt(response?.headers?.get?.("retry-after"), 10);
  return Number.isFinite(value) && value >= 0 ? Math.min(value, 3_600) : null;
}

export async function collectFindTenderNotices({ queryPackId, nowIso, cursor = null, limit = 25, fetchImpl = fetch, timeoutMs = 12_000 } = {}) {
  const request = buildFindTenderRequest({ queryPackId, nowIso, cursor, limit });
  let response;
  try {
    response = await fetchImpl(request.url, { ...request.options, signal:AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    const timeout = error?.name === "TimeoutError" || error?.name === "AbortError";
    throw new CollectorError(timeout ? "FIND_TENDER_TIMEOUT" : "FIND_TENDER_NETWORK_FAILED", timeout ? "Find a Tender request timed out." : "Find a Tender request failed.", { status:timeout ? 504 : 502 });
  }
  if (!response?.ok) {
    const excerpt = await errorExcerpt(response);
    const upstreamStatus = response?.status || null;
    const retryAfter = retryAfterSeconds(response);
    const rateLimited = upstreamStatus === 429 || upstreamStatus === 503;
    throw new CollectorError(
      rateLimited ? "FIND_TENDER_UPSTREAM_RATE_LIMITED" : "FIND_TENDER_UPSTREAM_FAILED",
      `Find a Tender returned HTTP ${upstreamStatus || "unknown"}${excerpt ? `: ${excerpt}` : "."}`,
      { status:rateLimited ? upstreamStatus : 502, upstreamStatus, retryAfterSeconds:retryAfter }
    );
  }
  let payload;
  try { payload = await response.json(); }
  catch { throw new CollectorError("FIND_TENDER_JSON_INVALID", "Find a Tender returned invalid JSON."); }
  const parsed = parseFindTenderResponse(payload, { queryPackId, fetchedAt:nowIso });
  return assertCollectorResult({
    source_id:FIND_TENDER_SOURCE_ID,
    query_pack_id:queryPackId,
    records:parsed.records,
    upstream_total:parsed.upstream_total,
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
