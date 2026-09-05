import { companyKey, emptyCompanyState, applyOpportunityState } from "./company-memory.mjs";

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
    if(previous){for(const field of ["reply_to","reply_subject","reply_body","reply_generated_at","reply_model","reply_response_id"]){if(Object.hasOwn(previous,field))normalized[field]=previous[field];}}
    mergedCurrent.push(applyOpportunityState(normalized,normalized.status,companyState));
  }
  return mergedCurrent;
}
