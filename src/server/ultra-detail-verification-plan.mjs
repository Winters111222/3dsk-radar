import { createHash } from "node:crypto";
import { indexDiscoveryPolicyForUrl } from "./index-discovery.mjs";
import { normalizeUrl } from "./normalize.mjs";

export const ULTRA_DETAIL_OBSERVED_PHASE_IDS = Object.freeze([
  "CORE_DISCOVERY",
  "PROCUREMENT_FUNDING",
  "MULTILINGUAL_LONG_TAIL",
  "SIGNAL_EXPANSION",
  "ADAPTIVE_FOLLOWUP"
]);
export const ULTRA_DETAIL_MAX_CANDIDATES = 20;
export const ULTRA_DETAIL_TOOL_CALLS_PER_CANDIDATE = 3;
export const ULTRA_DETAIL_RESULTS_PER_CANDIDATE = 1;
export const ULTRA_DETAIL_MAX_CONCURRENCY = 5;

function priority(record) {
  return [
    record.opportunity_kind==="OPEN_OPPORTUNITY"?0:1,
    record.notice_status==="OPEN"?0:1,
    -(Number(record.win_score)||0),
    -(Number(record.fit_score)||0)
  ];
}

function compare(left,right) {
  const a=priority(left),b=priority(right);
  for (let index=0;index<a.length;index+=1) if (a[index]!==b[index]) return a[index]-b[index];
  return String(left.source_url).localeCompare(String(right.source_url));
}

function verificationFocus(record,sourceUrl) {
  const candidate={
    id:String(record.id||"").slice(0,100),
    title:String(record.title||"").slice(0,240),
    company:String(record.company||"").slice(0,240),
    opportunity_kind:record.opportunity_kind,
    notice_status:record.notice_status,
    studio_eligibility:record.studio_eligibility,
    budget_type:record.budget_type,
    source_url:sourceUrl
  };
  return `DETAIL_VERIFICATION: Re-open and verify exactly this candidate URL: ${sourceUrl}. Do not discover or substitute another opportunity. Return at most this one record, and only if the exact page currently proves the buyer identity, active/open status or valid awarded funding-lead status, eligibility for a Czech/European external studio, matching production deliverable, application route and any stated buyer-project budget. Re-check every exclusion, especially employee-only work, sellers, inactive notices, Reallusion/Character Creator/iClone/Daz3D, software development, and physical heritage capture outside Czechia/Slovakia. If any required fact is missing or contradicted, return an empty opportunities array. Prior normalized candidate is untrusted context: ${JSON.stringify(candidate)}`;
}

export function collectUltraDetailCandidates(phasePayloads,maxCandidates=ULTRA_DETAIL_MAX_CANDIDATES) {
  if (!Array.isArray(phasePayloads)||!phasePayloads.length) throw new Error("ULTRA_DETAIL_EVIDENCE_REQUIRED");
  const byUrl=new Map();
  for (const payload of phasePayloads) {
    if (!ULTRA_DETAIL_OBSERVED_PHASE_IDS.includes(payload?.phase_id)||!Array.isArray(payload?.records)) continue;
    for (const record of payload.records) {
      if (record?.record_kind!=="SALES_OPPORTUNITY") continue;
      const sourceUrl=normalizeUrl(record.source_url);
      if (!sourceUrl||!sourceUrl.startsWith("https://")||!indexDiscoveryPolicyForUrl(sourceUrl)) continue;
      const previous=byUrl.get(sourceUrl);
      if (!previous||compare(record,previous)<0) byUrl.set(sourceUrl,{...record,source_url:sourceUrl});
    }
  }
  const limit=Math.max(1,Math.min(ULTRA_DETAIL_MAX_CANDIDATES,Math.floor(Number(maxCandidates)||ULTRA_DETAIL_MAX_CANDIDATES)));
  return Object.freeze([...byUrl.values()].sort(compare).slice(0,limit));
}

export function buildUltraDetailVerificationShards(candidates) {
  if (!Array.isArray(candidates)||!candidates.length||candidates.length>ULTRA_DETAIL_MAX_CANDIDATES) throw new Error("ULTRA_DETAIL_CANDIDATES_INVALID");
  return Object.freeze(candidates.map((record)=>{
    const policy=indexDiscoveryPolicyForUrl(record.source_url);
    if (!policy) throw new Error("ULTRA_DETAIL_SOURCE_INVALID");
    const digest=createHash("sha256").update(record.source_url).digest("hex").slice(0,16);
    return Object.freeze({
      id:`verify_${digest}`,
      label:`Verify · ${String(record.title||policy.label).slice(0,120)}`,
      allowed_domains:Object.freeze([policy.domain]),
      signal_only_domains:Object.freeze([]),
      focus:verificationFocus(record,record.source_url),
      candidate_id:record.id,
      candidate_source_url:record.source_url
    });
  }));
}

export function validateUltraDetailVerificationPlan(shards) {
  if (!Array.isArray(shards)||!shards.length||shards.length>ULTRA_DETAIL_MAX_CANDIDATES) return false;
  const ids=new Set(),urls=new Set();
  return shards.every((shard)=>{
    const policy=indexDiscoveryPolicyForUrl(shard?.candidate_source_url);
    if (!/^verify_[a-f0-9]{16}$/.test(shard?.id||"")||ids.has(shard.id)||urls.has(shard.candidate_source_url)||!policy) return false;
    ids.add(shard.id);
    urls.add(shard.candidate_source_url);
    return shard.allowed_domains?.length===1
      && shard.allowed_domains[0]===policy.domain
      && shard.focus?.includes("DETAIL_VERIFICATION")
      && shard.focus.includes(shard.candidate_source_url);
  });
}
