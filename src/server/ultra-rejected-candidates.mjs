import { createHash } from "node:crypto";
import { normalizeUrl } from "./normalize.mjs";

function idFor(record) {
  if (/^[A-Za-z0-9_-]{8,80}$/.test(String(record?.id||""))) return record.id;
  const identity=normalizeUrl(record?.source_url)||`${record?.company||"unknown"}|${record?.title||"untitled"}`;
  return `rejected-${createHash("sha256").update(identity).digest("hex").slice(0,24)}`;
}

function reviewRecord(record,overrides,nowIso) {
  return {
    id:idFor(record),
    review_record_kind:"REJECTED_CANDIDATE",
    title:String(record?.title||"Rejected candidate").slice(0,240),
    company:String(record?.company||"Buyer not established").slice(0,200),
    summary:String(record?.summary||"No candidate summary was returned.").slice(0,1200),
    source_url:normalizeUrl(record?.source_url),
    source_id:record?.source_id||record?.discovery_source_id||null,
    published_date:record?.published_date||null,
    engagement_track:["B2B_STUDIO","INDIVIDUAL_FREELANCE"].includes(record?.engagement_track)?record.engagement_track:"UNKNOWN",
    categories:Array.isArray(record?.categories)?record.categories.slice(0,8):[],
    fit_score:Math.max(0,Math.min(100,Number(record?.fit_score)||0)),
    win_score:Math.max(0,Math.min(100,Number(record?.win_score)||0)),
    rejection_reason:"other_validation_failure",
    rejection_stage:"NORMALIZATION",
    review_status:"PENDING",
    outreach_locked:true,
    first_seen:nowIso,
    last_seen:nowIso,
    ...overrides
  };
}

export function collectUltraRejectedCandidates({phasePayloads,detailPayload,nowIso}={}) {
  const byKey=new Map();
  const add=(item)=>{
    const key=normalizeUrl(item.source_url)||`id:${item.id}`;
    const previous=byKey.get(key);
    byKey.set(key,previous?{...previous,...item,id:previous.id,first_seen:previous.first_seen||item.first_seen}:item);
  };
  for (const payload of Array.isArray(phasePayloads)?phasePayloads:[]) {
    for (const rejected of Array.isArray(payload?.rejected_candidates)?payload.rejected_candidates:[]) add(reviewRecord(rejected,{
      rejection_reason:rejected.rejection_reason||"other_validation_failure",
      rejection_stage:rejected.rejection_stage||"NORMALIZATION"
    },nowIso));
  }
  const acceptedByUrl=new Map();
  for (const payload of Array.isArray(phasePayloads)?phasePayloads:[]) {
    for (const record of Array.isArray(payload?.records)?payload.records:[]) {
      const url=normalizeUrl(record?.source_url);
      if (url&&!acceptedByUrl.has(url)) acceptedByUrl.set(url,record);
    }
  }
  for (const result of Array.isArray(detailPayload?.verification?.candidate_results)?detailPayload.verification.candidate_results:[]) {
    if (result?.status!=="REJECTED") continue;
    const url=normalizeUrl(result.source_url),record=acceptedByUrl.get(url)||{id:result.candidate_id,source_url:url,title:"Rejected candidate"};
    add(reviewRecord(record,{
      id:result.candidate_id||idFor(record),
      rejection_reason:result.rejection_reason||"detail_verification_failed",
      rejection_stage:"DETAIL_VERIFICATION"
    },nowIso));
  }
  return [...byKey.values()].sort((a,b)=>b.win_score-a.win_score||b.fit_score-a.fit_score||a.id.localeCompare(b.id));
}
