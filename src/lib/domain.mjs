import { COMMERCIAL_ROLES, FRESHNESS_BASES, NOTICE_STATUSES, SCOPE_FITS, STUDIO_ELIGIBILITY_VALUES } from "./source-truth.mjs";
import { RECORD_KINDS, isSalesOpportunityRecord, recordKindOf } from "../server/record-classification.mjs";

export const STATUS_VALUES = ["NEW", "INTERESTING", "CONTACTED", "IGNORE"];
export const OPPORTUNITY_KINDS = ["OPEN_OPPORTUNITY", "POTENTIAL_LEAD"];
export const BUDGET_TYPES = ["PUBLISHED", "ESTIMATED", "UNKNOWN"];
export const MANUAL_VERIFICATION_STATUSES = ["REQUIRED_BEFORE_CONTACT", "VERIFIED_BEFORE_CONTACT"];

export const REQUIRED_OPPORTUNITY_FIELDS = [
  "id","record_kind","canonical_url","source_url","source_domain","title","company","summary","opportunity_kind","commercial_role","notice_status","studio_eligibility","eligibility_reason","scope_fit","categories","location","remote_scope","published_date","source_updated_date","freshness_basis","acceptance_source_url","acceptance_verified_at","first_seen","last_seen","is_new","status","fit_score","win_score","win_band","budget_type","budget_published","budget_estimated_min","budget_estimated_max","budget_currency","budget_confidence","budget_reason","contact_name","contact_role","contact_email","contact_email_source","apply_url","why_it_fits","risks","missing_requirements","source_evidence"
];

export function bandForScore(score) {
  if (!Number.isFinite(score) || score < 0 || score > 100) throw new RangeError("score must be between 0 and 100");
  if (score >= 80) return "HIGH";
  if (score >= 60) return "MEDIUM";
  return "LOW";
}

export function contactDisplay(opportunity) {
  return opportunity.contact_email || "Email not publicly available";
}

export function validateBudgetProvenance(opportunity) {
  if (!BUDGET_TYPES.includes(opportunity.budget_type)) return { ok:false, reason:"invalid budget_type" };
  if (opportunity.budget_type === "PUBLISHED") {
    return opportunity.budget_published
      ? { ok:true }
      : { ok:false, reason:"PUBLISHED budget requires budget_published" };
  }
  if (opportunity.budget_type === "ESTIMATED") {
    const validRange = Number.isFinite(opportunity.budget_estimated_min) && Number.isFinite(opportunity.budget_estimated_max) && opportunity.budget_estimated_max >= opportunity.budget_estimated_min;
    return validRange && Boolean(opportunity.budget_reason)
      ? { ok:true }
      : { ok:false, reason:"ESTIMATED budget requires a numeric range and reason" };
  }
  const hasNumericEstimate = Number.isFinite(opportunity.budget_estimated_min) || Number.isFinite(opportunity.budget_estimated_max);
  return !opportunity.budget_published && !hasNumericEstimate
    ? { ok:true }
    : { ok:false, reason:"UNKNOWN budget must not contain published or estimated values" };
}


function isHttpUrl(value) {
  if (typeof value !== "string" || !value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isIsoTimestamp(value) {
  return typeof value === "string" && value.length > 0 && Number.isFinite(Date.parse(value));
}

export function sourceVerificationSatisfied(opportunity) {
  if (!isSalesOpportunityRecord(opportunity)) return false;
  if (opportunity?.discovery_mode !== "INDEX_DISCOVERY_MANUAL_VERIFY") return true;
  return opportunity.manual_verification_status === "VERIFIED_BEFORE_CONTACT"
    && isIsoTimestamp(opportunity.manual_verified_at)
    && opportunity.manual_verified_source_url === opportunity.source_url;
}

export function validateOpportunity(opportunity) {
  const missing = REQUIRED_OPPORTUNITY_FIELDS.filter((key) => !(key in opportunity));
  const errors = missing.map((key) => `missing:${key}`);
  const recordKind = recordKindOf(opportunity);
  if (!RECORD_KINDS.includes(opportunity.record_kind)) errors.push("invalid:record_kind");
  if (recordKind === "SALES_OPPORTUNITY" && !OPPORTUNITY_KINDS.includes(opportunity.opportunity_kind)) errors.push("invalid:opportunity_kind");
  if (recordKind !== "SALES_OPPORTUNITY" && opportunity.opportunity_kind !== null) errors.push("invalid:non_sales_opportunity_kind");
  if (!COMMERCIAL_ROLES.includes(opportunity.commercial_role)) errors.push("invalid:commercial_role");
  if (!NOTICE_STATUSES.includes(opportunity.notice_status)) errors.push("invalid:notice_status");
  if (!STUDIO_ELIGIBILITY_VALUES.includes(opportunity.studio_eligibility)) errors.push("invalid:studio_eligibility");
  if (!SCOPE_FITS.includes(opportunity.scope_fit)) errors.push("invalid:scope_fit");
  if (recordKind === "SALES_OPPORTUNITY" && !FRESHNESS_BASES.includes(opportunity.freshness_basis)) errors.push("invalid:freshness_basis");
  if (recordKind !== "SALES_OPPORTUNITY" && opportunity.freshness_basis !== null && !FRESHNESS_BASES.includes(opportunity.freshness_basis)) errors.push("invalid:freshness_basis");
  if (opportunity.acceptance_verified_at && !isHttpUrl(opportunity.acceptance_source_url)) errors.push("invalid:acceptance_without_source");
  if (!Array.isArray(opportunity.categories) || opportunity.categories.length === 0) errors.push("invalid:categories");
  if (!isHttpUrl(opportunity.canonical_url)) errors.push("invalid:canonical_url");
  if (!isHttpUrl(opportunity.source_url)) errors.push("invalid:source_url");
  if (!isHttpUrl(opportunity.apply_url)) errors.push("invalid:apply_url");
  if (!Array.isArray(opportunity.source_evidence) || opportunity.source_evidence.length === 0 || opportunity.source_evidence.some((item) => !isHttpUrl(item?.url))) errors.push("invalid:source_evidence");
  if (!STATUS_VALUES.includes(opportunity.status)) errors.push("invalid:status");
  if (!Number.isFinite(opportunity.win_score) || opportunity.win_score < 0 || opportunity.win_score > 100) errors.push("invalid:win_score");
  else if (bandForScore(opportunity.win_score) !== opportunity.win_band) errors.push("invalid:win_band");
  if (!Number.isFinite(opportunity.fit_score) || opportunity.fit_score < 0 || opportunity.fit_score > 100) errors.push("invalid:fit_score");
  const budget = validateBudgetProvenance(opportunity);
  if (!budget.ok) errors.push(`invalid:budget:${budget.reason}`);
  if (opportunity.contact_email && !isHttpUrl(opportunity.contact_email_source)) errors.push("invalid:contact_email_without_source");
  if ("discovery_mode" in opportunity) {
    if (opportunity.discovery_mode !== "INDEX_DISCOVERY_MANUAL_VERIFY") errors.push("invalid:discovery_mode");
    if (opportunity.source_access_method !== "OPENAI_HOSTED_WEB_SEARCH") errors.push("invalid:source_access_method");
    if (!MANUAL_VERIFICATION_STATUSES.includes(opportunity.manual_verification_status)) errors.push("invalid:manual_verification_status");
    if (opportunity.manual_verification_status === "REQUIRED_BEFORE_CONTACT"
      && (opportunity.manual_verified_at !== null || opportunity.manual_verified_source_url !== null)) errors.push("invalid:manual_verification_pending_state");
    if (opportunity.manual_verification_status === "VERIFIED_BEFORE_CONTACT"
      && !sourceVerificationSatisfied(opportunity)) errors.push("invalid:manual_verification_provenance");
    if (opportunity.direct_source_requests !== 0) errors.push("invalid:direct_source_requests");
  }
  return { ok: errors.length === 0, errors };
}
