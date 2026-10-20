import test from "node:test";
import assert from "node:assert/strict";
import { opportunityReview, commercialKind, budgetWarning } from "../src/lib/opportunity-review.mjs";
import { visibleResults } from "../src/lib/result-view.mjs";
import { runSummary } from "../src/lib/run-summary.mjs";
const NOW=Date.parse("2026-10-20T12:00:00Z");
const item={id:"one",title:"Human scan cleanup",company:"Buyer",opportunity_kind:"OPEN_OPPORTUNITY",status:"NEW",notice_status:"OPEN",source_url:"https://example.com/job",published_date:"2026-10-18",fit_score:82,win_score:67};
test("recent, undated, old and closed offers are distinct without changing saved data",()=>{
  assert.equal(opportunityReview(item,NOW).bucket,"RECENT");
  for(const date of [null,"invalid","2026-11-01","2026-07-15"])assert.equal(opportunityReview({...item,published_date:date},NOW).bucket,"REVIEW");
  assert.equal(opportunityReview({...item,published_date:"2026-09-20"},NOW).bucket,"RECENT");
  assert.equal(opportunityReview({...item,published_date:"2026-09-19"},NOW).bucket,"REVIEW");
  assert.equal(opportunityReview({...item,status:"IGNORE"},NOW).bucket,"HISTORY");
  assert.equal(opportunityReview({...item,notice_status:"CLOSED"},NOW).bucket,"HISTORY");
  const saved=structuredClone(item);opportunityReview(item,NOW);assert.deepEqual(item,saved);
});
test("only a recent manual check against the same URL refreshes an old offer",()=>{
  const old={...item,published_date:"2026-07-15",last_seen:"2026-10-20",manual_verification_status:"VERIFIED_BEFORE_CONTACT",manual_verified_at:"2026-10-19T10:00:00Z",manual_verified_source_url:item.source_url};
  assert.equal(opportunityReview(old,NOW).bucket,"RECENT");
  assert.equal(opportunityReview({...old,manual_verified_source_url:"https://example.com/other"},NOW).bucket,"REVIEW");
  assert.equal(opportunityReview({...old,manual_verified_at:"2026-09-01"},NOW).bucket,"REVIEW");
  assert.equal(opportunityReview({...old,manual_verified_at:"2026-11-01"},NOW).bucket,"REVIEW");
});
test("employment signal is not presented as a project or collaboration",()=>{
  const employee={...item,title:"Lead Character Artist (Remote/Permanent)"};
  assert.equal(commercialKind(employee).key,"EMPLOYMENT_SIGNAL");
  assert.equal(opportunityReview(employee,NOW).bucket,"HISTORY");
  assert.deepEqual(visibleResults([employee],{view:"OPEN_OPPORTUNITY"}),[]);
  assert.equal(visibleResults([employee],{view:"EMPLOYMENT_SIGNAL"}).length,1);
  assert.equal(commercialKind({...item,title:"Freelance scan project"}).key,"OPEN_OPPORTUNITY");
  assert.equal(commercialKind({...item,opportunity_kind:"POTENTIAL_LEAD"}).label,"Potential collaboration");
});
test("freshness combines with saved filters; all preserves historical access",()=>{
  const old={...item,id:"old",published_date:null,contact_note:"Keep this note",company_bookmarked:true};
  assert.deepEqual(visibleResults([item,old],{freshness:"RECENT",now:NOW}).map(x=>x.id),["one"]);
  assert.deepEqual(visibleResults([item,old],{freshness:"REVIEW",now:NOW}).map(x=>x.id),["old"]);
  assert.equal(visibleResults([item,old],{freshness:"ALL"}).length,2);
  assert.equal(old.contact_note,"Keep this note");
});
test("budget warning uses explicit assessment, never infers conversion or alters scores",()=>{
  assert.match(budgetWarning({...item,risks:["Very low published budget"]}),/Low budget/);
  assert.equal(budgetWarning({...item,budget_published:"10–30 CAD"}),null);
  assert.equal(budgetWarning({...item,budget_published:"$100/hour",risks:[]}),null);
});
test("run summary prefers final zero to intermediate discoveries and reveals legacy partials",()=>{
  const run={search_status:"COMPLETE",returned_count:0,counters:{new_opportunities:0,updated_opportunities:0},coverage:[{status:"FAILED"},{status:"COMPLETE"}],diagnostics:{source_yield:[{returned:3}]}};
  assert.deepEqual(runSummary(run),{status:"PARTIAL",failedShards:1,returned:0,newCount:0,updated:0,workspace:null});
  assert.equal(runSummary({}).returned,null);
  assert.equal(runSummary({search_status:"FAILED",failed_shards:3}).status,"FAILED");
  assert.equal(runSummary({search_status:"COMPLETE",failed_shards:0}).status,"UNVERIFIED");
  assert.equal(runSummary({search_status:"COMPLETE",status_evidence_version:1,failed_shards:0}).status,"COMPLETE");
});
