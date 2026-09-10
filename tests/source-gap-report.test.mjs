import test from "node:test";
import assert from "node:assert/strict";
import report from "../config/source-gap-report.v1.json" with {type:"json"};
import { validateSourceGapReport } from "../scripts/source-gap-report.mjs";

test("source-gap report is ranked, complete and keeps every source locked",()=>{
  const result=validateSourceGapReport(report);
  assert.equal(result.ok,true);
  assert.equal(result.entries.length,13);
  assert.equal(result.entries.every((entry)=>entry.runtime_eligible===false),true);
  assert.equal(result.entries[0].source_id,"upwork");
  assert.equal(result.entries.some((entry)=>entry.source_id==="cz_sk_heritage_funding"),true);
  assert.deepEqual([result.network_requests,result.openai_requests,result.cost_usd],[0,0,0]);
});

test("source-gap report rejects silent activation",()=>{
  const changed=structuredClone(report);
  changed.entries[0].runtime_eligible=true;
  assert.throws(()=>validateSourceGapReport(changed),/SOURCE_GAP_RUNTIME_MUST_STAY_LOCKED/);
});
