import { createHash } from "node:crypto";
import { classifyRecordCandidate, recordKindOf, reclassifyStoredRecord } from "./record-classification.mjs";

export const RECORD_RECLASSIFICATION_MIGRATION_ID = "competitor-source-v1-20260906";
export const RECORD_RECLASSIFICATION_CONFIRMATION = "APPLY_EXACT_COMPETITOR_SOURCE_RECLASSIFICATION_V1";

export function classificationSnapshotDigest(records) {
  const projection = [...records]
    .sort((left, right) => String(left?.id || "").localeCompare(String(right?.id || "")))
    .map((record) => ({
      id:String(record?.id || ""),
      company:String(record?.company || ""),
      title:String(record?.title || ""),
      summary:String(record?.summary || ""),
      eligibility_reason:String(record?.eligibility_reason || ""),
      commercial_role:String(record?.commercial_role || "UNKNOWN").toUpperCase(),
      source_url:String(record?.source_url || ""),
      canonical_url:String(record?.canonical_url || ""),
      opportunity_kind:record?.opportunity_kind ?? null,
      record_kind:recordKindOf(record),
      first_seen:record?.first_seen ?? null,
      last_seen:record?.last_seen ?? null,
      status:record?.status ?? null
    }));
  return createHash("sha256").update(JSON.stringify(projection)).digest("hex");
}

export function createRecordReclassificationContract(expectedPreflightDigest) {
  return Object.freeze({
    migration_id:RECORD_RECLASSIFICATION_MIGRATION_ID,
    confirmation:RECORD_RECLASSIFICATION_CONFIRMATION,
    expected_preflight_digest:expectedPreflightDigest,
    expected_input_records:7,
    expected_sales:3,
    expected_competitors:3,
    expected_source_platforms:1,
    expected_transitions:4
  });
}

export const PRODUCTION_RECORD_RECLASSIFICATION = createRecordReclassificationContract(
  "c633aed639f75c4efd2dc638c806276bf807c390779ed2006b55547db98d74ce"
);

function proposedRows(records) {
  return records.map((record) => {
    const classification = classifyRecordCandidate(record);
    return { record, classification, proposed_record_kind:classification.record_kind || recordKindOf(record) };
  });
}

function countsForRows(rows) {
  return {
    sales_opportunities:rows.filter((row) => row.proposed_record_kind === "SALES_OPPORTUNITY").length,
    competitors:rows.filter((row) => row.proposed_record_kind === "COMPETITOR").length,
    source_platforms:rows.filter((row) => row.proposed_record_kind === "SOURCE_PLATFORM").length,
    manual_review:rows.filter((row) => !row.classification.record_kind).length
  };
}

export function buildRecordReclassificationPlan(records, contract = PRODUCTION_RECORD_RECLASSIFICATION) {
  const rows = proposedRows(records);
  const counts = countsForRows(rows);
  const transitions = rows.filter((row) =>
    row.proposed_record_kind !== "SALES_OPPORTUNITY"
      && recordKindOf(row.record) !== row.proposed_record_kind);
  const nonSalesTargets = rows.filter((row) => row.proposed_record_kind !== "SALES_OPPORTUNITY");
  const alreadyApplied = nonSalesTargets.length === contract.expected_transitions
    && nonSalesTargets.every((row) => row.record?.classification_migration_id === contract.migration_id
      && recordKindOf(row.record) === row.proposed_record_kind);
  const digest = classificationSnapshotDigest(records);
  const contractMatches = records.length === contract.expected_input_records
    && counts.sales_opportunities === contract.expected_sales
    && counts.competitors === contract.expected_competitors
    && counts.source_platforms === contract.expected_source_platforms
    && counts.manual_review === 0
    && transitions.length === contract.expected_transitions;
  return {
    migration_id:contract.migration_id,
    input_record_count:records.length,
    preflight_digest:digest,
    proposed_counts:counts,
    transition_count:transitions.length,
    transition_ids:transitions.map((row) => row.record.id),
    already_applied:alreadyApplied,
    preflight_ok:alreadyApplied || (digest === contract.expected_preflight_digest && contractMatches)
  };
}

function migrationError(code, message) {
  const error = new Error(message);
  error.code = code;
  error.status = 409;
  return error;
}

export function applyRecordReclassification(records, nowIso, contract = PRODUCTION_RECORD_RECLASSIFICATION) {
  const plan = buildRecordReclassificationPlan(records, contract);
  if (plan.already_applied) {
    return { mode:"ALREADY_APPLIED", records:[...records], changed_records:[], plan };
  }
  if (!plan.preflight_ok) {
    throw migrationError("RECLASSIFICATION_PREFLIGHT_MISMATCH", "Stored records do not match the exact approved migration snapshot.");
  }
  const changedRecords = [];
  const nextRecords = records.map((record) => {
    const classification = classifyRecordCandidate(record);
    if (!classification.record_kind || classification.record_kind === "SALES_OPPORTUNITY") return record;
    const result = reclassifyStoredRecord(record, nowIso);
    if (!result.changed) return record;
    const history = [...(result.record.classification_history || [])];
    if (history.length) history[history.length - 1] = { ...history[history.length - 1], migration_id:contract.migration_id };
    const next = {
      ...result.record,
      classification_history:history,
      classification_migration_id:contract.migration_id
    };
    changedRecords.push(next);
    return next;
  });
  return { mode:"APPLIED", records:nextRecords, changed_records:changedRecords, plan };
}

export function verifyRecordReclassificationReadback(records, contract = PRODUCTION_RECORD_RECLASSIFICATION) {
  const rows = proposedRows(records);
  const counts = countsForRows(rows);
  const targets = rows.filter((row) => row.proposed_record_kind !== "SALES_OPPORTUNITY");
  return records.length === contract.expected_input_records
    && counts.sales_opportunities === contract.expected_sales
    && counts.competitors === contract.expected_competitors
    && counts.source_platforms === contract.expected_source_platforms
    && counts.manual_review === 0
    && targets.length === contract.expected_transitions
    && targets.every((row) => row.record?.classification_migration_id === contract.migration_id
      && recordKindOf(row.record) === row.proposed_record_kind);
}
