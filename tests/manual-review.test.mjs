import test from "node:test";
import assert from "node:assert/strict";
import {applyManualReview,currentManualReview} from "../src/lib/manual-review.mjs";
import {actionableOpportunity,opportunityReview} from "../src/lib/opportunity-review.mjs";
import {visibleResults} from "../src/lib/result-view.mjs";
import {createStateRepository} from "../src/server/state-repository.mjs";
import {evaluateCandidateRelevance} from "../src/server/relevance-policy.mjs";
const now="2026-10-20T12:00:00Z";
const item={id:"review-001",company:"Test",title:"Human scan cleanup paid project",source_url:"https://example.com/job/1",canonical_url:"https://example.com/job/1",status:"INTERESTING",opportunity_kind:"OPEN_OPPORTUNITY",fit_score:80,win_score:60,first_seen:"2026-08-01T12:00:00Z",contact_note:"Keep this note",contact_channel:"LINKEDIN"};
const decide=(outcome,reason)=>({outcome,reason,source_url:item.source_url});
test("manual review validates reason and exact URL, preserving unrelated state",()=>{
 assert.throws(()=>applyManualReview(item,decide("FALSE_POSITIVE"),now),{code:"REVIEW_INVALID"});
 assert.throws(()=>applyManualReview(item,{...decide("OPEN"),source_url:"https://other.test"},now),{code:"SOURCE_VERIFICATION_URL_MISMATCH"});
 const closed=applyManualReview(item,decide("CLOSED"),now);
 assert.equal(closed.status,item.status);assert.equal(closed.contact_note,item.contact_note);assert.equal(closed.manual_review.method,"HUMAN");
 assert.equal(actionableOpportunity(closed),false);
 const clear=applyManualReview(closed,decide("CLEAR"),now);
 assert.equal(clear.manual_review_history.length,2);assert.equal(actionableOpportunity(clear),true);
});
test("human open freshness is time bounded and bound to exact source",()=>{
 const open=applyManualReview(item,decide("OPEN"),now);
 assert.equal(opportunityReview(open,Date.parse(now)).label,"Open · human checked");
 assert.equal(opportunityReview(open,Date.parse("2026-11-10")).bucket,"REVIEW");
 assert.equal(currentManualReview({...open,source_url:"https://example.com/changed"}),null);
});
test("actionable view excludes ignored, closed, unavailable, false-positive and employment without deleting archive",()=>{
 const items=[item,{...item,id:"ignored",status:"IGNORE"},{...item,id:"job",title:"Permanent character artist"},{...item,id:"expired",notice_status:"EXPIRED"},...['CLOSED','UNAVAILABLE','FALSE_POSITIVE'].map(outcome=>({...applyManualReview(item,decide(outcome,"WRONG_SCOPE"),now),id:outcome}))];
 assert.equal(visibleResults(items,{view:"ACTIONABLE"}).length,1);
 assert.equal(visibleResults(items,{view:"ALL"}).length,7);
});
test("review history and contact notes survive reload, hostile rediscovery and clear",async()=>{
 const data=new Map(),store={async get(k){return structuredClone(data.get(k)??null);},async setJSON(k,v){data.set(k,structuredClone(v));},async list(){return{blobs:[...data.keys()].map(key=>({key})),directories:[]};}};
 const repo=createStateRepository(store);await repo.saveOpportunity(item);
 await repo.reviewOpportunity(item.id,decide("FALSE_POSITIVE","SELLER"),now);
 await repo.mergeSearchResults([{...item,manual_review:{outcome:"CLEAR"},manual_review_history:[],contact_note:"overwrite"}],now);
 const saved=await createStateRepository(store).getOpportunity(item.id);
 assert.equal(saved.contact_note,item.contact_note);assert.equal(saved.manual_review.outcome,"FALSE_POSITIVE");assert.equal(saved.manual_review_history.length,1);assert.equal(saved.first_seen,item.first_seen);assert.equal(saved.status,item.status);
 await repo.reviewOpportunity(item.id,decide("OPEN"),now);
 assert.equal((await repo.getOpportunity(item.id)).manual_review_history.length,2);
});
test("precision regressions reject closed bids and seller posts, not discussion of completed prior projects",()=>{
 const base={commercial_role:"BUYER",engagement_track:"INDIVIDUAL_FREELANCE",categories:["SCAN_CLEANUP"],title:"Paid human scan cleanup",summary:"Seeking freelance cleanup of supplied human scans. Remote project delivery."};
 assert.equal(evaluateCandidateRelevance({...base,summary:"Bidding is closed"}).rejection,"inactive_source_evidence");
 assert.equal(evaluateCandidateRelevance({...base,title:"[FOR HIRE] Character artist"}).rejection,"seller_side_offer");
 assert.notEqual(evaluateCandidateRelevance({...base,summary:base.summary+" We closed our previous project."}).rejection,"inactive_source_evidence");
});
