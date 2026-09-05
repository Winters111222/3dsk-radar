export const STATUS_VALUES = ["NEW", "INTERESTING", "CONTACTED", "IGNORE"];
export const OPPORTUNITY_KINDS = ["OPEN_OPPORTUNITY", "POTENTIAL_LEAD"];
export const BUDGET_TYPES = ["PUBLISHED", "ESTIMATED", "UNKNOWN"];

export const REQUIRED_OPPORTUNITY_FIELDS = [
  "id","canonical_url","source_url","source_domain","title","company","summary","opportunity_kind","categories","location","remote_scope","published_date","first_seen","last_seen","is_new","status","fit_score","win_score","win_band","budget_type","budget_published","budget_estimated_min","budget_estimated_max","budget_currency","budget_confidence","budget_reason","contact_name","contact_role","contact_email","contact_email_source","apply_url","why_it_fits","risks","missing_requirements","source_evidence"
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

export function validateOpportunity(opportunity) {
  const missing = REQUIRED_OPPORTUNITY_FIELDS.filter((key) => !(key in opportunity));
  const errors = missing.map((key) => `missing:${key}`);
  if (!OPPORTUNITY_KINDS.includes(opportunity.opportunity_kind)) errors.push("invalid:opportunity_kind");
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
  return { ok: errors.length === 0, errors };
}
