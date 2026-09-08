import { WIDE_MAX_SEARCH_SHARDS } from "./wide-max-search-plan.mjs";
import { WIDE_V3_SEARCH_SHARDS } from "./wide-v3-source-plan.mjs";

export const ULTRA_ADAPTIVE_OBSERVED_PHASE_IDS = Object.freeze([
  "CORE_DISCOVERY",
  "PROCUREMENT_FUNDING",
  "MULTILINGUAL_LONG_TAIL",
  "SIGNAL_EXPANSION"
]);
export const ULTRA_ADAPTIVE_MAX_SHARDS = 20;
export const ULTRA_ADAPTIVE_TOOL_CALLS_PER_SHARD = 3;
export const ULTRA_ADAPTIVE_RESULTS_PER_SHARD = 4;
export const ULTRA_ADAPTIVE_MAX_RESULTS = 40;
export const ULTRA_ADAPTIVE_MAX_CONCURRENCY = 5;

const sourceById = new Map([...WIDE_MAX_SEARCH_SHARDS,...WIDE_V3_SEARCH_SHARDS].map((shard)=>[shard.id,shard]));

function gapReason(coverage) {
  if (coverage?.status!=="COMPLETE") return {rank:0,code:"FAILED_COVERAGE"};
  const seen=Math.max(0,Number(coverage?.candidates_seen)||0);
  if (seen===0) return {rank:1,code:"ZERO_CANDIDATES"};
  if (seen===1) return {rank:2,code:"SINGLE_CANDIDATE"};
  if (seen===2) return {rank:3,code:"LOW_YIELD"};
  return {rank:4,code:"DIVERSIFY_SUCCESSFUL_SHARD"};
}

function priorUrls(records,domains) {
  const urls=[];
  for (const record of Array.isArray(records)?records:[]) {
    try {
      const url=new URL(String(record?.source_url||""));
      const host=url.hostname.toLowerCase();
      if (url.protocol!=="https:"||!domains.some((domain)=>host===domain||host.endsWith(`.${domain}`))) continue;
      url.hash="";
      const normalized=url.toString();
      if (!urls.includes(normalized)) urls.push(normalized);
    } catch {}
  }
  return urls.slice(0,8);
}

function followupFocus(source,reason,urls) {
  const reasonInstruction={
    FAILED_COVERAGE:"The earlier coverage failed. Use alternative buyer terminology and exact detail routes; this is a new discovery strategy, not a transport retry.",
    ZERO_CANDIDATES:"The earlier search produced zero structured candidates. Replace broad wording with concrete deliverables, buyer verbs, proposal language and adjacent production terminology.",
    SINGLE_CANDIDATE:"The earlier search produced one candidate. Expand synonyms, buyer roles and exact project-detail paths while preserving every truth gate.",
    LOW_YIELD:"The earlier search produced only two candidates. Diversify terminology and buyer contexts without broadening the deliverable scope.",
    DIVERSIFY_SUCCESSFUL_SHARD:"The earlier shard had candidates; search a distinct adjacent buyer vocabulary and exact detail paths to uncover non-duplicate demand."
  }[reason];
  const exclusions=urls.length?` Do not return these already accepted URLs: ${urls.join(" ")}`:"";
  return `${source.focus} ADAPTIVE_FOLLOWUP: ${reasonInstruction} Open and cite the exact original buyer detail; reject indexes, search pages, sellers and employee-only vacancies.${exclusions}`;
}

export function buildUltraAdaptiveFollowupPlan({phasePayloads,maxShards=ULTRA_ADAPTIVE_MAX_SHARDS}={}) {
  if (!Array.isArray(phasePayloads)||!phasePayloads.length) throw new Error("ULTRA_ADAPTIVE_EVIDENCE_REQUIRED");
  const limit=Math.max(1,Math.min(ULTRA_ADAPTIVE_MAX_SHARDS,Number(maxShards)||ULTRA_ADAPTIVE_MAX_SHARDS));
  const allRecords=phasePayloads.flatMap((item)=>Array.isArray(item?.records)?item.records:[]);
  const observations=[];
  const seenIds=new Set();
  phasePayloads.forEach((payload,phaseIndex)=>{
    if (!ULTRA_ADAPTIVE_OBSERVED_PHASE_IDS.includes(payload?.phase_id)||!Array.isArray(payload?.coverage)) return;
    payload.coverage.forEach((coverage,coverageIndex)=>{
      const source=sourceById.get(coverage?.shard_id);
      if (!source||seenIds.has(source.id)) return;
      seenIds.add(source.id);
      const reason=gapReason(coverage);
      observations.push({source,phaseIndex,coverageIndex,reason,previousCandidatesSeen:Math.max(0,Number(coverage?.candidates_seen)||0)});
    });
  });
  if (!observations.length) throw new Error("ULTRA_ADAPTIVE_EVIDENCE_REQUIRED");
  observations.sort((left,right)=>left.reason.rank-right.reason.rank||left.previousCandidatesSeen-right.previousCandidatesSeen||left.phaseIndex-right.phaseIndex||left.coverageIndex-right.coverageIndex);
  const shards=observations.slice(0,limit).map(({source,reason,previousCandidatesSeen})=>Object.freeze({
    id:`adaptive_${source.id}`,
    label:`Adaptive · ${source.label}`,
    allowed_domains:Object.freeze([...source.allowed_domains]),
    signal_only_domains:Object.freeze([...(source.signal_only_domains||[])]),
    focus:followupFocus(source,reason.code,priorUrls(allRecords,source.allowed_domains)),
    origin_shard_id:source.id,
    selection_reason:reason.code,
    previous_candidates_seen:previousCandidatesSeen
  }));
  return Object.freeze(shards);
}

export function validateUltraAdaptiveFollowupPlan(shards) {
  if (!Array.isArray(shards)||!shards.length||shards.length>ULTRA_ADAPTIVE_MAX_SHARDS) return false;
  const ids=new Set();
  return shards.every((shard)=>shard?.id===`adaptive_${shard?.origin_shard_id}`
    && !ids.has(shard.id)
    && ids.add(shard.id)
    && sourceById.has(shard.origin_shard_id)
    && shard.allowed_domains?.length>0
    && (shard.signal_only_domains||[]).every((domain)=>shard.allowed_domains.includes(domain))
    && typeof shard.focus==="string"
    && shard.focus.includes("ADAPTIVE_FOLLOWUP"));
}
