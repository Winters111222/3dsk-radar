export const REVIEW_OUTCOMES = Object.freeze({ OPEN:"Still open — checked by a person", CLOSED:"Closed", UNAVAILABLE:"Source unavailable", FALSE_POSITIVE:"Not relevant", CLEAR:"Clear review decision" });
export const REVIEW_REASONS = Object.freeze({ EMPLOYMENT:"Employment, not a project", LOW_BUDGET:"Budget too low", WRONG_SCOPE:"Wrong scope", SELLER:"Seller, not buyer", DEAD_SOURCE:"Dead or redirected source", OTHER:"Other" });
export function currentManualReview(item) {
  const review=item.manual_review;
  return review?.source_url===item.source_url ? review : null;
}
export function applyManualReview(item,{outcome,reason,source_url},nowIso) {
  if (!Object.hasOwn(REVIEW_OUTCOMES,outcome) || (outcome==="FALSE_POSITIVE" && !Object.hasOwn(REVIEW_REASONS,reason))) throw Object.assign(new Error("Choose a valid outcome and a reason for Not relevant."),{code:"REVIEW_INVALID"});
  if (!source_url || source_url!==item.source_url) throw Object.assign(new Error("Source changed. Reload before reviewing."),{code:"SOURCE_VERIFICATION_URL_MISMATCH"});
  const entry={outcome,reason:outcome==="FALSE_POSITIVE"?reason:null,source_url,reviewed_at:nowIso,method:"HUMAN"};
  const next={...item,manual_review:entry,manual_review_history:[...(item.manual_review_history||[]),entry],updated_at:nowIso};
  if(item.discovery_mode==="INDEX_DISCOVERY_MANUAL_VERIFY" && outcome!=="CLEAR"){
    next.manual_verification_status=outcome==="OPEN"?"VERIFIED_BEFORE_CONTACT":"REQUIRED_BEFORE_CONTACT";
    next.manual_verified_at=outcome==="OPEN"?nowIso:null;
    next.manual_verified_source_url=outcome==="OPEN"?source_url:null;
  }
  return next;
}
