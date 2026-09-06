import { companyKey, emptyCompanyState, applyOpportunityState } from "./company-memory.mjs";
import { recordKindOf } from "./record-classification.mjs";

export function opportunityFingerprint(item) {
  const canonical=String(item.canonical_url||"").trim().toLowerCase();
  if (canonical) return `url:${canonical}`;
  return `fallback:${String(item.company||"").trim().toLowerCase()}|${String(item.title||"").trim().toLowerCase()}|${String(item.source_domain||"").trim().toLowerCase()}`;
}
export function mergeOpportunityHistory(existingItems, incomingItems, companyStatesByKey, nowIso) {
  const existingByFingerprint=new Map(existingItems.map((item)=>[opportunityFingerprint(item),item]));
  const mergedCurrent=[];
  for (const incoming of incomingItems) {
    const previous=existingByFingerprint.get(opportunityFingerprint(incoming));
    const key=companyKey(incoming.company);
    const companyState=companyStatesByKey[key]||emptyCompanyState(incoming.company);
    const normalized={...previous,...incoming,id:previous?.id||incoming.id,first_seen:previous?.first_seen||incoming.first_seen||nowIso,last_seen:nowIso,is_new:!previous,status:previous?.status||incoming.status||"NEW"};
    if(previous && Array.isArray(previous.classification_history)) normalized.classification_history=[...previous.classification_history];
    if(previous && recordKindOf(previous)!==recordKindOf(incoming)){
      normalized.classification_history=[...(Array.isArray(previous.classification_history)?previous.classification_history:[]),{changed_at:nowIso,from_record_kind:recordKindOf(previous),to_record_kind:recordKindOf(incoming),previous_opportunity_kind:previous.opportunity_kind??null,reason:incoming.record_kind_reason||"SERVER_RECLASSIFICATION"}];
    }
    if(previous){for(const field of ["reply_to","reply_subject","reply_body","reply_generated_at","reply_model","reply_response_id"]){if(Object.hasOwn(previous,field))normalized[field]=previous[field];}}
    if(previous?.manual_verification_status==="VERIFIED_BEFORE_CONTACT" && previous.source_url===incoming.source_url){
      normalized.manual_verification_status=previous.manual_verification_status;
      normalized.manual_verified_at=previous.manual_verified_at;
      normalized.manual_verified_source_url=previous.manual_verified_source_url;
    }
    mergedCurrent.push(applyOpportunityState(normalized,normalized.status,companyState));
  }
  return mergedCurrent;
}
