import { createHash, randomUUID } from "node:crypto";
import { IMPLEMENTED_COLLECTORS } from "./collectors/dispatch.mjs";

export const SOURCE_RUN_SCHEMA_VERSION = 2;
export const SOURCE_RUN_STATUSES = Object.freeze(["READY", "RUNNING", "PAUSED", "COMPLETED", "CANCELLED", "UNCERTAIN"]);
export const SOURCE_RUN_TERMINAL_STATUSES = Object.freeze(["COMPLETED", "CANCELLED", "UNCERTAIN"]);

export const SOURCE_RUN_PROFILES = Object.freeze({
  FOCUSED:Object.freeze({
    profile_id:"FOCUSED",
    max_source_services:15,
    max_list_pages:40,
    max_detail_pages:80,
    max_total_pages:120,
    max_candidates:45,
    max_web_search_calls:12,
    budget_cap_usd:0.50,
    chunk_list_pages:4,
    chunk_detail_pages:4
  }),
  WIDE:Object.freeze({
    profile_id:"WIDE",
    max_source_services:45,
    max_list_pages:140,
    max_detail_pages:360,
    max_total_pages:500,
    max_candidates:180,
    max_web_search_calls:40,
    budget_cap_usd:1.00,
    chunk_list_pages:4,
    chunk_detail_pages:4
  })
});

function sha(value, length = 24) {
  return createHash("sha256").update(String(value)).digest("hex").slice(0, length);
}

function normalizedText(value) {
  return String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function normalizedUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    url.hash = "";
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "gclid"].forEach((key) => url.searchParams.delete(key));
    url.searchParams.sort();
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function recordDate(record) {
  return record.source_updated_date || record.publication_date || record.published_date || record.fetched_at || "";
}

export function sourceRunProfile(profileId) {
  return SOURCE_RUN_PROFILES[profileId] || null;
}

export function buildSourceRunPlan() {
  const workItems = [];
  for (const [sourceId, collector] of Object.entries(IMPLEMENTED_COLLECTORS)) {
    for (const queryPackId of Object.keys(collector.queryPacks)) {
      workItems.push({
        work_item_id:`${sourceId}--${queryPackId}`,
        source_id:sourceId,
        query_pack_id:queryPackId,
        status:"PENDING",
        position:sourceId === "ted_eu" ? { page:1, cursor:null } : { page:null, cursor:null },
        attempts:0,
        max_attempts:2,
        pages_fetched:0,
        not_before:null,
        last_error:null
      });
    }
  }
  return workItems;
}

function emptyCounters(planned) {
  return {
    source_services_planned:planned,
    source_services_completed:0,
    source_services_blocked:0,
    source_services_failed:0,
    list_pages_fetched:0,
    detail_pages_fetched:0,
    total_pages_fetched:0,
    records_seen:0,
    records_returned:0,
    candidates_seen:0,
    candidates_accepted:0,
    candidates_rejected_cap:0,
    candidates_detail_verified:0,
    candidates_promoted:0,
    candidates_rejected_truth:0,
    candidates_blocked_detail:0,
    candidate_rejection_reasons:{},
    opportunities_new:0,
    opportunities_updated:0,
    detail_requests_attempted:0,
    duplicate_records:0,
    cross_source_duplicates:0,
    tender_revisions_updated:0,
    openai_requests:0,
    cost_usd:0
  };
}

export function createSourceRun({ profileId, requestId, nowIso, runId = randomUUID() } = {}) {
  const profile = sourceRunProfile(profileId);
  if (!profile) throw new Error("SOURCE_RUN_PROFILE_INVALID");
  if (!validClientId(requestId)) throw new Error("SOURCE_RUN_REQUEST_ID_INVALID");
  const workItems = buildSourceRunPlan();
  if (workItems.length > profile.max_source_services) throw new Error("SOURCE_RUN_SERVICE_CAP_EXCEEDED");
  return {
    schema_version:SOURCE_RUN_SCHEMA_VERSION,
    run_id:runId,
    request_id:requestId,
    profile_id:profileId,
    status:"READY",
    phase:"COLLECTION",
    completion_reason:null,
    created_at:nowIso,
    updated_at:nowIso,
    started_at:null,
    completed_at:null,
    cancel_requested_at:null,
    next_retry_at:null,
    active_operation_id:null,
    paid_execution:"LOCKED",
    persistence:"NETLIFY_BLOBS",
    plan_snapshot:{
      ...profile,
      work_items:workItems.map(({ work_item_id, source_id, query_pack_id }) => ({ work_item_id, source_id, query_pack_id }))
    },
    work_items:workItems,
    counters:emptyCounters(workItems.length),
    budget:{
      cap_microusd:usdToMicros(profile.budget_cap_usd),
      reserved_microusd:0,
      settled_microusd:0,
      reservations:{},
      openai_requests:0
    }
  };
}

export function validClientId(value) {
  return typeof value === "string" && /^[A-Za-z0-9_-]{8,80}$/.test(value);
}

export function isTerminalRun(run) {
  return SOURCE_RUN_TERMINAL_STATUSES.includes(run?.status);
}

export function canFetchPage(run, pageKind = "list") {
  const counters = run.counters;
  const profile = run.plan_snapshot;
  if (counters.total_pages_fetched >= profile.max_total_pages) return { ok:false, code:"TOTAL_PAGE_CAP_REACHED" };
  if (pageKind === "list" && counters.list_pages_fetched >= profile.max_list_pages) return { ok:false, code:"LIST_PAGE_CAP_REACHED" };
  if (pageKind === "detail" && counters.detail_pages_fetched >= profile.max_detail_pages) return { ok:false, code:"DETAIL_PAGE_CAP_REACHED" };
  return { ok:true, code:null };
}

export function recordFetchedPage(run, { pageKind = "list", recordsSeen = 0, recordsReturned = 0 } = {}) {
  const allowed = canFetchPage(run, pageKind);
  if (!allowed.ok) return { ok:false, code:allowed.code, run };
  const counterName = pageKind === "detail" ? "detail_pages_fetched" : "list_pages_fetched";
  return {
    ok:true,
    code:null,
    run:{
      ...run,
      counters:{
        ...run.counters,
        [counterName]:run.counters[counterName] + 1,
        total_pages_fetched:run.counters.total_pages_fetched + 1,
        records_seen:run.counters.records_seen + Math.max(0, Number(recordsSeen) || 0),
        records_returned:run.counters.records_returned + Math.max(0, Number(recordsReturned) || 0)
      }
    }
  };
}

export function candidateDedupeKeys(record) {
  const keys = [];
  const sourceId = normalizedText(record.source_id);
  const tenderIdentity = normalizedText(record.tender_identity || record.procedure_identifier || record.publication_number);
  if (sourceId && tenderIdentity) keys.push(`native:${sourceId}:${tenderIdentity}`);
  const url = normalizedUrl(record.canonical_url);
  if (url) keys.push(`url:${url}`);
  const buyer = (Array.isArray(record.buyer_names) ? record.buyer_names : [record.buyer_name]).map(normalizedText).filter(Boolean).sort().join("|");
  const title = normalizedText(record.title);
  if (buyer && title) keys.push(`semantic:${buyer}:${title}`);
  if (!keys.length && record.collector_record_id) keys.push(`record:${sourceId}:${normalizedText(record.collector_record_id)}`);
  return [...new Set(keys)];
}

export function candidateIdForRecord(record) {
  const keys = candidateDedupeKeys(record);
  const identity = keys.find((key) => key.startsWith("native:")) || keys.find((key) => key.startsWith("semantic:")) || keys[0];
  if (!identity) throw new Error("SOURCE_RECORD_IDENTITY_MISSING");
  return `candidate-${sha(identity)}`;
}

function referenceIdentity(record) {
  return `${record.source_id || "unknown"}|${record.source_item_id || record.publication_number || record.collector_record_id || "unknown"}|${record.source_revision || record.publication_number || record.source_updated_date || record.publication_date || "unknown"}`;
}

export function mergeSourceCandidate(existing, record, nowIso) {
  const dedupeKeys = candidateDedupeKeys(record);
  const reference = {
    reference_id:sha(referenceIdentity(record), 20),
    source_id:record.source_id,
    source_item_id:record.source_item_id || record.publication_number || record.collector_record_id || null,
    tender_identity:record.tender_identity || record.procedure_identifier || record.publication_number || null,
    source_revision:record.source_revision || record.publication_number || record.source_updated_date || record.publication_date || null,
    canonical_url:normalizedUrl(record.canonical_url),
    observed_at:nowIso
  };
  if (!existing) {
    return {
      candidate:{
        schema_version:SOURCE_RUN_SCHEMA_VERSION,
        candidate_id:candidateIdForRecord(record),
        first_seen_at:nowIso,
        last_seen_at:nowIso,
        dedupe_keys:dedupeKeys,
        primary_record:record,
        source_references:[reference],
        review_state:"RAW_CANDIDATE",
        detail_attempts:0,
        detail_not_before:null,
        detail_last_error:null,
        enrichment:null,
        rejection_reason:null,
        promoted_opportunity_id:null,
        reviewed_at:null
      },
      outcome:"NEW"
    };
  }
  const sameReference = existing.source_references.some((item) => item.reference_id === reference.reference_id);
  if (sameReference) {
    return { candidate:{ ...existing, last_seen_at:nowIso, dedupe_keys:[...new Set([...existing.dedupe_keys, ...dedupeKeys])] }, outcome:"DUPLICATE" };
  }
  const sameNativeTender = existing.source_references.some((item) => item.source_id === reference.source_id && item.tender_identity && item.tender_identity === reference.tender_identity);
  const crossSource = existing.source_references.some((item) => item.source_id !== reference.source_id);
  const newer = recordDate(record) > recordDate(existing.primary_record);
  const resetReview = newer && existing.primary_record !== record;
  return {
    candidate:{
      ...existing,
      last_seen_at:nowIso,
      dedupe_keys:[...new Set([...existing.dedupe_keys, ...dedupeKeys])],
      primary_record:newer ? record : existing.primary_record,
      source_references:[...existing.source_references, reference],
      ...(resetReview ? {
        review_state:"RAW_CANDIDATE",
        detail_attempts:0,
        detail_not_before:null,
        detail_last_error:null,
        enrichment:null,
        rejection_reason:null,
        promoted_opportunity_id:null,
        reviewed_at:null
      } : {})
    },
    outcome:sameNativeTender ? "REVISION" : (crossSource ? "CROSS_SOURCE_DUPLICATE" : "DUPLICATE")
  };
}

export function applyCandidateOutcome(run, outcome) {
  const delta = {
    candidates_seen:1,
    candidates_accepted:outcome === "NEW" ? 1 : 0,
    duplicate_records:outcome === "DUPLICATE" ? 1 : 0,
    cross_source_duplicates:outcome === "CROSS_SOURCE_DUPLICATE" ? 1 : 0,
    tender_revisions_updated:outcome === "REVISION" ? 1 : 0
  };
  return {
    ...run,
    counters:{
      ...run.counters,
      candidates_seen:run.counters.candidates_seen + delta.candidates_seen,
      candidates_accepted:run.counters.candidates_accepted + delta.candidates_accepted,
      duplicate_records:run.counters.duplicate_records + delta.duplicate_records,
      cross_source_duplicates:run.counters.cross_source_duplicates + delta.cross_source_duplicates,
      tender_revisions_updated:run.counters.tender_revisions_updated + delta.tender_revisions_updated
    }
  };
}

export function rejectCandidateAtCap(run) {
  return { ...run, counters:{ ...run.counters, candidates_seen:run.counters.candidates_seen + 1, candidates_rejected_cap:run.counters.candidates_rejected_cap + 1 } };
}

export function usdToMicros(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) throw new Error("SOURCE_RUN_COST_INVALID");
  return Math.round(amount * 1_000_000);
}

export function reserveRunCost(run, { reservationId, maxCostUsd } = {}) {
  if (!validClientId(reservationId)) throw new Error("SOURCE_RUN_RESERVATION_ID_INVALID");
  const existing = run.budget.reservations[reservationId];
  if (existing) return { run, reservation:existing, replayed:true };
  const amount = usdToMicros(maxCostUsd);
  if (amount <= 0) throw new Error("SOURCE_RUN_COST_INVALID");
  if (run.budget.reserved_microusd + run.budget.settled_microusd + amount > run.budget.cap_microusd) throw new Error("SOURCE_RUN_BUDGET_CAP_EXCEEDED");
  const reservation = { reservation_id:reservationId, max_microusd:amount, status:"RESERVED", actual_microusd:null };
  return {
    replayed:false,
    reservation,
    run:{ ...run, budget:{ ...run.budget, reserved_microusd:run.budget.reserved_microusd + amount, reservations:{ ...run.budget.reservations, [reservationId]:reservation } } }
  };
}

export function settleRunCost(run, { reservationId, actualCostUsd } = {}) {
  const reservation = run.budget.reservations[reservationId];
  if (!reservation) throw new Error("SOURCE_RUN_RESERVATION_MISSING");
  if (reservation.status === "SETTLED") return { run, reservation, replayed:true };
  const actual = usdToMicros(actualCostUsd);
  if (actual > reservation.max_microusd) throw new Error("SOURCE_RUN_RESERVATION_EXCEEDED");
  const settled = { ...reservation, status:"SETTLED", actual_microusd:actual };
  return {
    replayed:false,
    reservation:settled,
    run:{ ...run, budget:{ ...run.budget, reserved_microusd:run.budget.reserved_microusd - reservation.max_microusd, settled_microusd:run.budget.settled_microusd + actual, reservations:{ ...run.budget.reservations, [reservationId]:settled } } }
  };
}
