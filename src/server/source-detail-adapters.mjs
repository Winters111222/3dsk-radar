import { Buffer } from "node:buffer";
import { CollectorError } from "./collectors/collector-contract.mjs";
import { CONTRACTS_FINDER_SOURCE_ID } from "./collectors/contracts-finder.mjs";
import { FIND_TENDER_SOURCE_ID } from "./collectors/find-tender.mjs";
import { TED_SEARCH_URL, TED_SOURCE_ID } from "./collectors/ted.mjs";

export const FIND_TENDER_RECORD_URL = "https://www.find-tender.service.gov.uk/api/1.0/ocdsRecordPackages";
export const CONTRACTS_FINDER_RECORD_URL = "https://www.contractsfinder.service.gov.uk/Published/OCDS/Record";
export const SOURCE_DETAIL_MAX_BYTES = 2_000_000;

const TED_DETAIL_FIELDS = Object.freeze([
  "publication-number", "publication-date", "notice-title", "buyer-name", "buyer-country",
  "buyer-email", "buyer-touchpoint-email", "notice-type", "form-type", "procedure-identifier",
  "deadline-receipt-tender-date-lot", "description-lot", "description-proc", "contract-nature",
  "estimated-value-lot", "estimated-value-cur-lot", "estimated-value-proc", "estimated-value-cur-proc", "links"
]);

function sourceRecord(candidate) {
  const record = candidate?.primary_record;
  if (!record || typeof record !== "object") throw new CollectorError("SOURCE_DETAIL_CANDIDATE_INVALID", "Candidate has no source record.", { status:400 });
  return record;
}

function safeTedPublicationNumber(value) {
  const id = String(value || "");
  if (!/^\d{1,8}-\d{4}$/.test(id)) throw new CollectorError("TED_DETAIL_ID_INVALID", "TED publication number is invalid.", { status:400 });
  return id;
}

function safeOcid(value, code) {
  const id = String(value || "");
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{4,199}$/.test(id)) throw new CollectorError(code, "OCDS process identifier is invalid.", { status:400 });
  return id;
}

export function buildSourceDetailRequest(candidate) {
  const record = sourceRecord(candidate);
  if (record.source_id === TED_SOURCE_ID) {
    const publicationNumber = safeTedPublicationNumber(record.publication_number || record.source_item_id);
    return {
      source_id:TED_SOURCE_ID,
      identity:publicationNumber,
      url:TED_SEARCH_URL,
      options:{
        method:"POST",
        headers:{ "content-type":"application/json", accept:"application/json" },
        body:JSON.stringify({ query:`publication-number="${publicationNumber}"`, fields:TED_DETAIL_FIELDS, page:1, limit:1, checkQuerySyntax:false, paginationMode:"PAGE_NUMBER" })
      }
    };
  }
  if (record.source_id === FIND_TENDER_SOURCE_ID) {
    const ocid = safeOcid(record.tender_identity, "FIND_TENDER_DETAIL_ID_INVALID");
    return { source_id:FIND_TENDER_SOURCE_ID, identity:ocid, url:`${FIND_TENDER_RECORD_URL}/${encodeURIComponent(ocid)}`, options:{ method:"GET", headers:{ accept:"application/json" } } };
  }
  if (record.source_id === CONTRACTS_FINDER_SOURCE_ID) {
    const ocid = safeOcid(record.tender_identity, "CONTRACTS_FINDER_DETAIL_ID_INVALID");
    return { source_id:CONTRACTS_FINDER_SOURCE_ID, identity:ocid, url:`${CONTRACTS_FINDER_RECORD_URL}/${encodeURIComponent(ocid)}`, options:{ method:"GET", headers:{ accept:"application/json" } } };
  }
  throw new CollectorError("SOURCE_DETAIL_ADAPTER_UNAVAILABLE", "No approved detail adapter exists for this source.", { status:400 });
}

function latestRelease(releases) {
  return [...(Array.isArray(releases) ? releases : [])].sort((a, b) => String(b?.date || "").localeCompare(String(a?.date || "")))[0] || null;
}

function parseTedDetail(payload, identity) {
  if (!payload || !Array.isArray(payload.notices)) throw new CollectorError("TED_DETAIL_SCHEMA_MISMATCH", "TED detail response is missing notices[].");
  const notice = payload.notices.find((item) => textValues(item?.["publication-number"]).includes(identity));
  if (!notice) throw new CollectorError("TED_DETAIL_IDENTITY_MISMATCH", "TED detail response did not contain the requested publication.");
  return { document:notice, releases:[notice] };
}

function parseOcdsDetail(payload, identity) {
  if (!payload || !Array.isArray(payload.records)) throw new CollectorError("OCDS_DETAIL_SCHEMA_MISMATCH", "OCDS detail response is missing records[].");
  const record = payload.records.find((item) => String(item?.ocid || "") === identity);
  if (!record) throw new CollectorError("OCDS_DETAIL_IDENTITY_MISMATCH", "OCDS detail response did not contain the requested process.");
  const document = record.compiledRelease || latestRelease(record.releases);
  if (!document || String(document.ocid || record.ocid || "") !== identity) throw new CollectorError("OCDS_DETAIL_SCHEMA_MISMATCH", "OCDS record has no matching compiled or released process state.");
  return { document, releases:Array.isArray(record.releases) ? record.releases : [] };
}

function textValues(value) {
  if (value == null) return [];
  if (["string", "number", "boolean"].includes(typeof value)) return [String(value).trim()].filter(Boolean);
  if (Array.isArray(value)) return value.flatMap(textValues);
  if (typeof value === "object") {
    if (Object.hasOwn(value, "value")) return textValues(value.value);
    const preferred = [value.ENG, value.eng, value.EN, value.en].flatMap(textValues);
    return preferred.length ? preferred : Object.values(value).flatMap(textValues);
  }
  return [];
}

async function responseText(response, maxBytes) {
  const declaredLength = Number(response?.headers?.get?.("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new CollectorError("SOURCE_DETAIL_RESPONSE_TOO_LARGE", "Source detail response exceeded the byte cap.");
  }
  if (!response?.body?.getReader) {
    const text = await response.text();
    if (Buffer.byteLength(text, "utf8") > maxBytes) throw new CollectorError("SOURCE_DETAIL_RESPONSE_TOO_LARGE", "Source detail response exceeded the byte cap.");
    return text;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let bytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new CollectorError("SOURCE_DETAIL_RESPONSE_TOO_LARGE", "Source detail response exceeded the byte cap.");
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, bytes).toString("utf8");
}

function retryAfterSeconds(response) {
  const value = Number.parseInt(response?.headers?.get?.("retry-after"), 10);
  return Number.isFinite(value) && value >= 0 ? Math.min(value, 3_600) : null;
}

export async function fetchSourceDetail({ candidate, nowIso, fetchImpl = fetch, timeoutMs = 12_000, maxBytes = SOURCE_DETAIL_MAX_BYTES } = {}) {
  const request = buildSourceDetailRequest(candidate);
  let response;
  try {
    response = await fetchImpl(request.url, { ...request.options, redirect:"error", signal:AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    const timeout = error?.name === "TimeoutError" || error?.name === "AbortError";
    throw new CollectorError(timeout ? "SOURCE_DETAIL_TIMEOUT" : "SOURCE_DETAIL_NETWORK_FAILED", timeout ? "Source detail request timed out." : "Source detail request failed.", { status:timeout ? 504 : 502 });
  }
  if (!response?.ok) {
    const upstreamStatus = response?.status || null;
    const rateLimited = upstreamStatus === 403 || upstreamStatus === 429 || upstreamStatus === 503;
    throw new CollectorError(rateLimited ? "SOURCE_DETAIL_RATE_LIMITED" : (upstreamStatus === 404 ? "SOURCE_DETAIL_NOT_FOUND" : "SOURCE_DETAIL_UPSTREAM_FAILED"), `Source detail returned HTTP ${upstreamStatus || "unknown"}.`, { status:rateLimited ? 429 : 502, upstreamStatus, retryAfterSeconds:rateLimited ? (retryAfterSeconds(response) || (upstreamStatus === 403 ? 300 : 30)) : null });
  }
  const text = await responseText(response, Math.max(1, Math.min(Number(maxBytes) || SOURCE_DETAIL_MAX_BYTES, SOURCE_DETAIL_MAX_BYTES)));
  let payload;
  try { payload = JSON.parse(text); }
  catch { throw new CollectorError("SOURCE_DETAIL_JSON_INVALID", "Source detail returned invalid JSON."); }
  const parsed = request.source_id === TED_SOURCE_ID ? parseTedDetail(payload, request.identity) : parseOcdsDetail(payload, request.identity);
  return {
    source_id:request.source_id,
    source_identity:request.identity,
    fetched_at:nowIso,
    document:parsed.document,
    releases:parsed.releases,
    counters:{ detail_pages_fetched:1, records_seen:1, records_returned:1, openai_requests:0, cost_usd:0 }
  };
}
