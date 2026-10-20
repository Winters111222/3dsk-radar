// Read-only presentation rules. Never change saved scores, status or company memory.
import { currentManualReview } from "./manual-review.mjs";
const DAY = 86400000;
export function actionableOpportunity(item) {
  return item.status!=="IGNORE" && commercialKind(item).key!=="EMPLOYMENT_SIGNAL"
    && !["CLOSED","CANCELLED","AWARDED","EXPIRED","FILLED","HIRED","IN_PROGRESS"].includes(item.notice_status)
    && !["CLOSED","UNAVAILABLE","FALSE_POSITIVE"].includes(currentManualReview(item)?.outcome);
}
function age(value, now) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp <= now ? Math.floor((now - timestamp) / DAY) : null;
}

export function commercialKind(item) {
  if (item.commercial_role === "EMPLOYER" || /\b(permanent|full[ -]time|payroll|salaried)\b/i.test(item.title || "")) {
    return { key:"EMPLOYMENT_SIGNAL", label:"Employment signal", note:"Recruitment, not a confirmed freelance or studio contract." };
  }
  if (item.opportunity_kind === "POTENTIAL_LEAD") {
    return { key:"POTENTIAL_LEAD", label:item.categories?.includes("HERITAGE_FUNDING_PARTNERSHIP") ? "Funding / partnership" : "Potential collaboration", note:"A contact or partnership signal, not a confirmed open order." };
  }
  return { key:"OPEN_OPPORTUNITY", label:"Project opportunity", note:"Check the original request before contacting the buyer." };
}

export function opportunityReview(item, now = Date.now()) {
  const kind = commercialKind(item);
  const human=currentManualReview(item);
  if (["CLOSED","UNAVAILABLE","FALSE_POSITIVE"].includes(human?.outcome)) return {bucket:"HISTORY",label:human.outcome==="CLOSED"?"Closed · human checked":human.outcome==="UNAVAILABLE"?"Source unavailable · human checked":"Not relevant · human reviewed",reason:`Human review on ${human.reviewed_at}. Notes and history are retained.`,checkedRecently:false};
  const humanAge=human?.outcome==="OPEN"?age(human.reviewed_at,now):null;
  const publishedAge = age(item.published_date, now);
  const manualAge = item.manual_verification_status === "VERIFIED_BEFORE_CONTACT"
    && item.manual_verified_source_url === item.source_url ? age(item.manual_verified_at, now) : null;
  const checkedRecently = manualAge !== null && manualAge <= 14;
  if (item.status === "IGNORE" || ["CLOSED", "CANCELLED", "AWARDED"].includes(item.notice_status) && !item.categories?.includes("HERITAGE_FUNDING_PARTNERSHIP") || kind.key === "EMPLOYMENT_SIGNAL") {
    return { bucket:"HISTORY", label:"History / signals", reason:kind.key === "EMPLOYMENT_SIGNAL" ? kind.note : "Ignored or recorded as closed. Retained with all notes and history.", publishedAge, checkedRecently };
  }
  if (humanAge!==null && humanAge<=14) return {bucket:"RECENT",label:"Open · human checked",reason:`Checked by a person ${humanAge} days ago against this exact source. Not automated verification.`,publishedAge,checkedRecently:true};
  if (checkedRecently) return { bucket:"RECENT", label:"Recently checked", reason:`Manually checked ${manualAge} days ago against this exact source.`, publishedAge, checkedRecently };
  if (publishedAge !== null && publishedAge <= 30) return { bucket:"RECENT", label:"Recent listing", reason:`Published ${publishedAge} days ago. A recent date is not proof it still accepts proposals.`, publishedAge, checkedRecently };
  return { bucket:"REVIEW", label:"Needs checking", reason:publishedAge === null ? "Publication date is unknown or invalid. Check the original source." : `Published ${publishedAge} days ago; no manual check of this URL within 14 days. This does not mean the offer is closed.`, publishedAge, checkedRecently };
}

export function budgetWarning(item) {
  // Use explicit recorded evidence, not currency conversion or guessed hourly/project units.
  const evidence = [item.budget_reason, ...(item.risks || [])].filter(Boolean);
  return evidence.some(text => /\b(?:very\s+)?low\s+(?:published\s+)?(?:budget|rate)|\b(?:budget|rate)\b.{0,35}\b(?:too low|below (?:typical |usual )?studio)|\bunderpaid\b/i.test(text))
    ? "Low budget flagged in the source assessment. Check scope and rate; scores are unchanged." : null;
}
