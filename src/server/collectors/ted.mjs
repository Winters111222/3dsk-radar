import { createHash } from "node:crypto";
import { CollectorError, assertCollectorResult, boundedCollectorInteger } from "./collector-contract.mjs";

export const TED_SOURCE_ID = "ted_eu";
export const TED_SEARCH_URL = "https://api.ted.europa.eu/v3/notices/search";
export const TED_DOCUMENTATION_URL = "https://docs.ted.europa.eu/api/latest/search.html";

// Product-facing groups approved for Search. Visual / AI / Motion is intentionally absent.
export const TED_QUERY_PACKS = Object.freeze({
  external_development: {
    label: "External Development",
    categories: ["EXTERNAL_DEVELOPMENT", "CHARACTER_OUTSOURCING"],
    phrases: ["external development", "3D character production", "character outsourcing", "digital human"]
  },
  production_overflow: {
    label: "Production Overflow",
    categories: ["PRODUCTION_OVERFLOW", "CHARACTER_FINISHING"],
    phrases: ["production overflow", "3D character services", "photogrammetry services", "scan processing"]
  },
  pipeline_consulting: {
    label: "Pipeline Consulting",
    categories: ["PIPELINE_CONSULTING", "FACIAL_FACS"],
    phrases: ["pipeline consulting", "character pipeline", "facial rig", "FACS"]
  },
  other_relevant: {
    label: "Other Relevant",
    categories: ["OTHER_RELEVANT", "CAPTURE", "PHOTOGRAMMETRY_PROCESSING", "SCAN_CLEANUP"],
    phrases: ["human photogrammetry", "3D scanning services", "digital double", "human scan cleanup"]
  }
});

// These fields are documented in TED examples or used by the EU's own open-data explorer.
export const TED_RETURN_FIELDS = Object.freeze([
  "publication-number",
  "publication-date",
  "notice-title",
  "buyer-name",
  "buyer-country",
  "notice-type",
  "form-type",
  "procedure-identifier",
  "links"
]);

function compactDate(date) {
  return date.toISOString().slice(0, 10).replaceAll("-", "");
}

export function tedFreshnessCutoff(nowIso, days = 30) {
  const now = new Date(nowIso);
  if (!Number.isFinite(now.getTime())) throw new CollectorError("COLLECTOR_TIME_INVALID", "A valid server timestamp is required.", { status:500 });
  now.setUTCDate(now.getUTCDate() - days);
  return compactDate(now);
}

function quotedPhrase(value) {
  return `FT~"${String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

export function buildTedExpertQuery(queryPackId, nowIso) {
  const pack = TED_QUERY_PACKS[queryPackId];
  if (!pack) throw new CollectorError("TED_QUERY_PACK_UNKNOWN", "Unknown TED query pack.", { status:400 });
  const terms = pack.phrases.map(quotedPhrase).join(" OR ");
  return `(${terms}) AND publication-date>=${tedFreshnessCutoff(nowIso)} SORT BY publication-date DESC`;
}

export function buildTedSearchRequest({ queryPackId, nowIso, page = 1, limit = 25 } = {}) {
  return {
    url: TED_SEARCH_URL,
    options: {
      method: "POST",
      headers: { "content-type":"application/json", accept:"application/json" },
      body: JSON.stringify({
        query: buildTedExpertQuery(queryPackId, nowIso),
        fields: TED_RETURN_FIELDS,
        page: boundedCollectorInteger(page, 1, 1, 20),
        limit: boundedCollectorInteger(limit, 25, 1, 50),
        scope: "ACTIVE",
        checkQuerySyntax: false,
        paginationMode: "PAGE_NUMBER"
      })
    }
  };
}

function textValues(value) {
  if (value == null) return [];
  if (["string", "number"].includes(typeof value)) return String(value).trim() ? [String(value).trim()] : [];
  if (Array.isArray(value)) return value.flatMap(textValues);
  if (typeof value === "object") {
    if ("value" in value) return textValues(value.value);
    const prioritized = [value.ENG, value.eng, value.EN, value.en, value.FRA, value.fra].flatMap(textValues);
    return prioritized.length ? prioritized : Object.values(value).flatMap(textValues);
  }
  return [];
}

function uniqueText(value) {
  return [...new Set(textValues(value))];
}

function firstText(value) {
  return uniqueText(value)[0] || null;
}

function safeTedLink(value) {
  for (const candidate of uniqueText(value)) {
    try {
      const url = new URL(candidate);
      if (url.protocol === "https:" && (url.hostname === "ted.europa.eu" || url.hostname.endsWith(".ted.europa.eu"))) return url.toString();
    } catch {
      // Ignore schema drift and fall back to the stable public notice URL.
    }
  }
  return null;
}

function noticeLink(notice, publicationNumber) {
  return safeTedLink(notice?.links?.html)
    || (publicationNumber ? `https://ted.europa.eu/en/notice/-/detail/${encodeURIComponent(publicationNumber)}` : null);
}

function normalizedDate(value) {
  const match = firstText(value)?.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function stableRecordId(queryPackId, publicationNumber, canonicalUrl, index) {
  const identity = `${queryPackId}|${publicationNumber || canonicalUrl || `unknown-${index}`}`;
  return `ted-${createHash("sha256").update(identity).digest("hex").slice(0, 16)}`;
}

function withinFreshnessWindow(publicationDate, fetchedAt) {
  if (!publicationDate) return false;
  const fetchedDate = normalizedDate(fetchedAt);
  if (!fetchedDate) throw new CollectorError("COLLECTOR_TIME_INVALID", "A valid fetched_at timestamp is required.", { status:500 });
  const cutoff = new Date(`${fetchedDate}T00:00:00.000Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - 30);
  const cutoffDate = cutoff.toISOString().slice(0, 10);
  return publicationDate >= cutoffDate && publicationDate <= fetchedDate;
}

export function parseTedSearchResponse(payload, { queryPackId, fetchedAt } = {}) {
  if (!payload || !Array.isArray(payload.notices)) {
    throw new CollectorError("TED_SCHEMA_MISMATCH", "TED response is missing notices[].");
  }
  const pack = TED_QUERY_PACKS[queryPackId];
  if (!pack) throw new CollectorError("TED_QUERY_PACK_UNKNOWN", "Unknown TED query pack.", { status:400 });
  const parsedRecords = payload.notices.map((notice, index) => {
    const publicationNumber = firstText(notice?.["publication-number"]);
    const canonicalUrl = noticeLink(notice, publicationNumber);
    return {
      collector_record_id: stableRecordId(queryPackId, publicationNumber, canonicalUrl, index),
      source_id: TED_SOURCE_ID,
      query_pack_id: queryPackId,
      suggested_categories: [...pack.categories],
      publication_number: publicationNumber,
      publication_date: normalizedDate(notice?.["publication-date"]),
      title: firstText(notice?.["notice-title"]),
      buyer_names: uniqueText(notice?.["buyer-name"]),
      buyer_countries: uniqueText(notice?.["buyer-country"]),
      notice_type: firstText(notice?.["notice-type"]),
      form_type: firstText(notice?.["form-type"]),
      procedure_identifier: firstText(notice?.["procedure-identifier"]),
      canonical_url: canonicalUrl,
      fetched_at: fetchedAt
    };
  });
  const records = parsedRecords.filter((record) => withinFreshnessWindow(record.publication_date, fetchedAt));
  return {
    records,
    rejected_stale_or_undated: parsedRecords.length - records.length,
    upstream_total: Number.isFinite(Number(payload.totalNoticeCount)) ? Number(payload.totalNoticeCount) : null,
    iteration_next_token: typeof payload.iterationNextToken === "string" ? payload.iterationNextToken : null
  };
}

async function errorExcerpt(response) {
  try { return (await response.text()).replace(/\s+/g, " ").slice(0, 240); }
  catch { return ""; }
}

export async function collectTedNotices({ queryPackId, nowIso, page = 1, limit = 25, fetchImpl = fetch, timeoutMs = 12_000 } = {}) {
  const request = buildTedSearchRequest({ queryPackId, nowIso, page, limit });
  let response;
  try {
    response = await fetchImpl(request.url, { ...request.options, signal:AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    const timeout = error?.name === "TimeoutError" || error?.name === "AbortError";
    throw new CollectorError(timeout ? "TED_TIMEOUT" : "TED_NETWORK_FAILED", timeout ? "TED request timed out." : "TED request failed.", { status:timeout ? 504 : 502 });
  }
  if (!response?.ok) {
    const excerpt = await errorExcerpt(response);
    throw new CollectorError("TED_UPSTREAM_FAILED", `TED returned HTTP ${response?.status || "unknown"}${excerpt ? `: ${excerpt}` : "."}`, { upstreamStatus:response?.status || null });
  }
  let payload;
  try { payload = await response.json(); }
  catch { throw new CollectorError("TED_JSON_INVALID", "TED returned invalid JSON."); }
  const parsed = parseTedSearchResponse(payload, { queryPackId, fetchedAt:nowIso });
  return assertCollectorResult({
    source_id: TED_SOURCE_ID,
    query_pack_id: queryPackId,
    records: parsed.records,
    upstream_total: parsed.upstream_total,
    counters: {
      source_services_planned: 1,
      source_services_completed: 1,
      source_services_blocked: 0,
      source_services_failed: 0,
      list_pages_fetched: 1,
      detail_pages_fetched: 0,
      records_seen: payload.notices.length,
      records_returned: parsed.records.length,
      records_rejected_stale_or_undated: parsed.rejected_stale_or_undated,
      openai_requests: 0,
      cost_usd: 0
    }
  });
}
