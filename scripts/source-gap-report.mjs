import report from "../config/source-gap-report.v1.json" with {type:"json"};
import { pathToFileURL } from "node:url";

const REQUIRED = Object.freeze([
  "rank", "source_id", "missing_source", "expected_yield", "access_method",
  "implementation_effort", "legal_or_tos_constraint", "required_authorization_or_credential",
  "detail_verification", "safe_next_state", "runtime_eligible"
]);

export function validateSourceGapReport(value=report) {
  if (value?.schema_version !== 1 || !Array.isArray(value.entries) || !value.entries.length) throw new Error("SOURCE_GAP_SCHEMA_INVALID");
  const ids=new Set();
  value.entries.forEach((entry,index)=>{
    if (REQUIRED.some((key)=>entry[key]===undefined || entry[key]===null || entry[key]==="")) throw new Error("SOURCE_GAP_FIELD_MISSING");
    if (entry.rank!==index+1 || ids.has(entry.source_id)) throw new Error("SOURCE_GAP_ORDER_INVALID");
    if (entry.runtime_eligible!==false) throw new Error("SOURCE_GAP_RUNTIME_MUST_STAY_LOCKED");
    if (/scrap(?:e|ing)|captcha bypass|private xhr/i.test(entry.access_method)) throw new Error("SOURCE_GAP_ACCESS_METHOD_UNSAFE");
    ids.add(entry.source_id);
  });
  return {ok:true,mode:"OFFLINE_SOURCE_GAP_REPORT",runtime_activation:value.runtime_activation,entries:value.entries,network_requests:0,openai_requests:0,cost_usd:0};
}

if (import.meta.url===pathToFileURL(process.argv[1]||"").href) console.log(JSON.stringify(validateSourceGapReport(),null,2));
