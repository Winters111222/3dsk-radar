import { normalizeUrl } from "./normalize.mjs";

export const ULTRA_FORENSIC_SCHEMA_VERSION = 1;
export const ULTRA_FORENSIC_DISCOVERY_PHASE_IDS = Object.freeze([
  "CORE_DISCOVERY",
  "PROCUREMENT_FUNDING",
  "MULTILINGUAL_LONG_TAIL",
  "SIGNAL_EXPANSION",
  "ADAPTIVE_FOLLOWUP"
]);

function integer(value) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function counts(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value)
    .filter(([key, count]) => /^[a-z0-9_:-]{1,120}$/i.test(key) && integer(count) > 0)
    .map(([key, count]) => [key, integer(count)])
    .sort(([left], [right]) => left.localeCompare(right)));
}

function phasePayload(payload) {
  const usage = payload?.usage || {};
  const body = payload?.payload || payload || {};
  const coverageCandidates = Array.isArray(body.coverage)
    ? body.coverage.reduce((sum, item) => sum + integer(item?.candidates_seen), 0)
    : 0;
  return {
    phase_id:body.phase_id,
    search_status:body.search_status || null,
    candidates_seen:integer(usage.candidates_seen ?? body?.diagnostics?.candidates_seen ?? coverageCandidates),
    accepted_occurrences:integer(usage.results_accepted ?? body?.records?.length),
    returned_records:Array.isArray(body.records) ? body.records.length : 0,
    rejection_reasons:counts(body?.diagnostics?.rejection_reasons),
    source_yield:Array.isArray(body?.diagnostics?.source_yield)
      ? body.diagnostics.source_yield.map((item) => ({
        source_id:String(item?.source_id || "unattributed").slice(0,120),
        candidates_seen:integer(item?.candidates_seen),
        candidates_accepted:integer(item?.candidates_accepted),
        candidates_rejected:integer(item?.candidates_rejected),
        duplicates_removed:integer(item?.duplicates_removed),
        returned:integer(item?.returned)
      }))
      : []
  };
}

function acceptedLedger(payloads, detailResults) {
  const byUrl = new Map();
  for (const payload of payloads) {
    const body = payload?.payload || payload || {};
    for (const record of Array.isArray(body.records) ? body.records : []) {
      if (record?.record_kind !== "SALES_OPPORTUNITY") continue;
      const sourceUrl = normalizeUrl(record.source_url);
      if (!sourceUrl) continue;
      const entry = byUrl.get(sourceUrl) || {
        candidate_id:record.id || null,
        title:String(record.title || "").slice(0,240) || null,
        source_url:sourceUrl,
        source_id:record.discovery_source_id || null,
        accepted_in_phases:[],
        accepted_occurrences:0,
        detail_status:"NOT_SELECTED"
      };
      entry.accepted_occurrences += 1;
      if (!entry.accepted_in_phases.includes(body.phase_id)) entry.accepted_in_phases.push(body.phase_id);
      byUrl.set(sourceUrl, entry);
    }
  }
  const detailByUrl = new Map((detailResults || []).map((item) => [normalizeUrl(item?.source_url), item]));
  for (const entry of byUrl.values()) {
    const result=detailByUrl.get(entry.source_url);
    entry.detail_status = result?.status || "NOT_SELECTED";
    if (result?.rejection_reason) entry.rejection_reason=result.rejection_reason;
  }
  return [...byUrl.values()].sort((left, right) => left.source_url.localeCompare(right.source_url));
}

export function buildUltraForensicAudit({run, phaseOutputs, detailOutput, persistence = null} = {}) {
  if (!run?.run_id || !Array.isArray(phaseOutputs)) throw new Error("ULTRA_FORENSIC_EVIDENCE_REQUIRED");
  const discovery = ULTRA_FORENSIC_DISCOVERY_PHASE_IDS.map((phaseId) => {
    const output = phaseOutputs.find((item) => (item?.payload || item)?.phase_id === phaseId);
    return output ? phasePayload(output) : {
      phase_id:phaseId,
      search_status:"EVIDENCE_UNAVAILABLE",
      candidates_seen:0,
      accepted_occurrences:0,
      returned_records:0,
      rejection_reasons:{},
      source_yield:[]
    };
  });
  const detailBody = detailOutput?.payload || detailOutput || {};
  const verification = detailBody.verification || {};
  const totalSeen = discovery.reduce((sum, item) => sum + item.candidates_seen, 0);
  const acceptedOccurrences = discovery.reduce((sum, item) => sum + item.accepted_occurrences, 0);
  const selected = integer(verification.selected_candidates);
  const verified = integer(verification.verified_candidates);
  const preTruthRejected = Math.max(0, totalSeen - acceptedOccurrences);
  const duplicateOccurrences = Math.max(0, acceptedOccurrences - selected);
  const detailRejected = Math.max(0, selected - verified);
  const finalNew = integer(persistence?.new_count);
  const finalUpdated = integer(persistence?.updated_count);
  const verifiedNotPersisted = Math.max(0, verified - finalNew - finalUpdated);
  const accountedNonFinal = preTruthRejected + duplicateOccurrences + detailRejected + verifiedNotPersisted;
  const aggregateReasons = {};
  const exactCandidateLevelRejectionsAvailable=phaseOutputs.length===ULTRA_FORENSIC_DISCOVERY_PHASE_IDS.length
    && phaseOutputs.every((output)=>Array.isArray((output?.payload||output)?.rejected_candidates));
  for (const item of discovery) {
    for (const [reason, count] of Object.entries(item.rejection_reasons)) {
      aggregateReasons[reason] = integer(aggregateReasons[reason]) + count;
    }
  }
  for (const item of verification.candidate_results || []) {
    if (item?.status!=="REJECTED") continue;
    const reason=String(item.rejection_reason||"detail_verification_failed");
    aggregateReasons[reason]=integer(aggregateReasons[reason])+1;
  }
  return {
    schema_version:ULTRA_FORENSIC_SCHEMA_VERSION,
    privacy:exactCandidateLevelRejectionsAvailable?"PUBLIC_CANDIDATE_REVIEW_RECORDS_NO_CONTACT_DATA":"ACCEPTED_URLS_AND_AGGREGATED_REJECTIONS_ONLY",
    run_id:run.run_id,
    exact_candidate_level_rejections_available:exactCandidateLevelRejectionsAvailable,
    limitation:exactCandidateLevelRejectionsAvailable
      ? "Rejected candidates are review-only and never become sales records without passing the existing truth gates."
      : "Historical phase payloads did not retain every pre-truth candidate; only accepted exact URLs and aggregate reasons are reconstructable.",
    funnel:{
      candidates_seen:totalSeen,
      accepted_occurrences:acceptedOccurrences,
      rejected_before_detail:preTruthRejected,
      detail_candidates_selected:selected,
      duplicate_accepted_occurrences:duplicateOccurrences,
      detail_candidates_rejected:detailRejected,
      detail_candidates_verified:verified,
      final_new_sales:finalNew,
      final_updated_sales:finalUpdated,
      verified_not_persisted:verifiedNotPersisted,
      non_final_candidates_accounted:accountedNonFinal,
      accounting_complete:accountedNonFinal + finalNew + finalUpdated === totalSeen
    },
    rejection_reasons:counts(aggregateReasons),
    phases:discovery,
    accepted_candidate_ledger:acceptedLedger(phaseOutputs, verification.candidate_results)
  };
}
