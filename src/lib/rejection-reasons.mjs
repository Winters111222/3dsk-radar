// Model-reported detail outcomes are diagnostics, never authority to accept a record.
export const DETAIL_REJECTION_REASONS = Object.freeze([
  "stale_or_unverified", "inactive_notice", "source_redirected_or_unavailable",
  "out_of_scope", "individual_employment", "seller_side_offer",
  "engagement_track_unproven", "detail_evidence_missing"
]);

export function rejectionExplanation(code) {
  return ({
    stale_or_unverified:"Publication or recent buyer activity could not be established.",
    inactive_notice:"The source reports closed, filled, cancelled or awarded work.",
    source_redirected_or_unavailable:"The original detail was unavailable or redirected away from the listing.",
    out_of_scope:"The requested work does not match the allowed production scope.",
    individual_employment:"Employment recruitment, not an independent production project.",
    seller_side_offer:"A seller offering services, not a buyer requesting work.",
    engagement_track_unproven:"Eligibility for studio or independent delivery was not established.",
    detail_evidence_missing:"The detail check returned no sufficient evidence; the precise cause is unknown.",
    detail_verification_failed:"Legacy detail check failed without retaining a specific reason."
  })[code] || code;
}
