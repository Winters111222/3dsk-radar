export const COMMERCIAL_ROLES = ["BUYER", "EMPLOYER", "SELLER", "PARTNER", "UNKNOWN"];
export const NOTICE_STATUSES = ["OPEN", "UPCOMING", "CLOSED", "AWARDED", "CANCELLED", "UNKNOWN"];
export const STUDIO_ELIGIBILITY_VALUES = ["YES", "NO", "UNKNOWN"];
export const SCOPE_FITS = ["CORE", "CHARACTER_ADJACENT", "OUT_OF_SCOPE", "EQUIPMENT"];
export const FRESHNESS_BASES = ["PUBLISHED_DATE", "SOURCE_UPDATED_DATE", "ACTIVE_ACCEPTANCE_EVIDENCE"];

const INACTIVE_NOTICE_STATUSES = new Set(["CLOSED", "AWARDED", "CANCELLED"]);
const EXCLUDED_SCOPE_FITS = new Set(["OUT_OF_SCOPE", "EQUIPMENT"]);

export function normalizeSourceDate(value, nowIso) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  const now = Date.parse(nowIso);
  if (!Number.isFinite(timestamp) || !Number.isFinite(now) || timestamp > now + 86400000) return null;
  return value;
}

export function isRecentSourceDate(value, nowIso, maxAgeDays = 30) {
  const normalized = normalizeSourceDate(value, nowIso);
  if (!normalized) return false;
  const nowDate = new Date(nowIso);
  const cutoff = Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth(), nowDate.getUTCDate() - maxAgeDays);
  return Date.parse(`${normalized}T00:00:00Z`) >= cutoff;
}

export function evaluateSourceTruth({
  requestedKind,
  commercialRole,
  noticeStatus,
  studioEligibility,
  scopeFit,
  publishedDate,
  sourceUpdatedDate,
  acceptanceVerified,
  nowIso,
  maxAgeDays = 30
}) {
  if (commercialRole === "SELLER") return { ok:false, rejection:"seller_not_opportunity" };
  if (commercialRole === "UNKNOWN") return { ok:false, rejection:"unknown_commercial_role" };
  if (INACTIVE_NOTICE_STATUSES.has(noticeStatus)) return { ok:false, rejection:"inactive_notice" };
  if (studioEligibility === "NO") return { ok:false, rejection:"studio_ineligible" };
  if (EXCLUDED_SCOPE_FITS.has(scopeFit)) return { ok:false, rejection:"out_of_scope" };

  const recentPublished = isRecentSourceDate(publishedDate, nowIso, maxAgeDays);
  const recentUpdated = isRecentSourceDate(sourceUpdatedDate, nowIso, maxAgeDays);
  if (!recentPublished && !recentUpdated && !acceptanceVerified) {
    return { ok:false, rejection:"stale_or_unverified" };
  }

  let opportunityKind = requestedKind;
  if (requestedKind === "OPEN_OPPORTUNITY") {
    const provenOpenBuyerRequest = commercialRole === "BUYER" && noticeStatus === "OPEN" && studioEligibility === "YES";
    if (!provenOpenBuyerRequest) opportunityKind = "POTENTIAL_LEAD";
  }

  const freshnessBasis = recentPublished
    ? "PUBLISHED_DATE"
    : recentUpdated
      ? "SOURCE_UPDATED_DATE"
      : "ACTIVE_ACCEPTANCE_EVIDENCE";
  return { ok:true, opportunityKind, freshnessBasis };
}
