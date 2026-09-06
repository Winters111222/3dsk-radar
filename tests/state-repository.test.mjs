import test from "node:test";import assert from "node:assert/strict";import { createStateRepository } from "../src/server/state-repository.mjs";
function memoryStore(){const data=new Map();return{async setJSON(k,v){data.set(k,structuredClone(v));},async get(k){return data.has(k)?structuredClone(data.get(k)):null;},async list({prefix}={}){return{blobs:[...data.keys()].filter(k=>!prefix||k.startsWith(prefix)).map(key=>({key,etag:"x"})),directories:[]};}};}
const opportunity=(o={})=>({id:"opp-1",canonical_url:"https://example.com/a",source_domain:"example.com",title:"AAA Human Vendor",company:"Example Games",first_seen:"2026-09-05T09:00:00Z",last_seen:"2026-09-05T09:00:00Z",status:"NEW",is_new:true,...o});
test("bookmark applies to every opportunity from same company",async()=>{const repo=createStateRepository(memoryStore());await repo.saveOpportunity(opportunity());await repo.saveOpportunity(opportunity({id:"opp-2",canonical_url:"https://example.com/b",title:"Second Request"}));await repo.setBookmark("Example Games",true,"2026-09-05T10:00:00Z");const snap=await repo.snapshot();assert.ok(snap.opportunities.every(x=>x.company_bookmarked));});
test("mark email sent also marks the opportunity CONTACTED",async()=>{const repo=createStateRepository(memoryStore());await repo.saveOpportunity(opportunity());await repo.markEmailSent("Example Games",{opportunityId:"opp-1",recipient:"sales@example.com",sentAt:"2026-09-05T10:00:00Z"});assert.equal((await repo.getOpportunity("opp-1")).status,"CONTACTED");});
test("search merge preserves first_seen and status and makes repeat result not new",async()=>{const repo=createStateRepository(memoryStore());await repo.saveOpportunity(opportunity({status:"INTERESTING"}));const [merged]=await repo.mergeSearchResults([opportunity({id:"new-model-id",first_seen:"2026-09-06T09:00:00Z"})],"2026-09-06T09:00:00Z");assert.equal(merged.id,"opp-1");assert.equal(merged.first_seen,"2026-09-05T09:00:00Z");assert.equal(merged.status,"INTERESTING");assert.equal(merged.is_new,false);});

test("detailed search merge separates new, updated and workspace totals",async()=>{const repo=createStateRepository(memoryStore());await repo.saveOpportunity(opportunity());const result=await repo.mergeSearchResultsWithStats([opportunity({id:"repeat"}),opportunity({id:"opp-2",canonical_url:"https://example.com/b",title:"New Request"})],"2026-09-06T09:00:00Z");assert.equal(result.new_count,1);assert.equal(result.updated_count,1);assert.equal(result.workspace_total,2);});

test("search merge persists one authoritative workspace snapshot for reloads",async()=>{
 const store=memoryStore(),repo=createStateRepository(store);
 await repo.saveOpportunity(opportunity());
 await repo.mergeSearchResultsWithStats([opportunity({id:"opp-2",canonical_url:"https://example.com/b",title:"New Request"})],"2026-09-06T09:00:00Z");
 store.list=async()=>({blobs:[],directories:[]});
 const snap=await createStateRepository(store).snapshot();
 assert.deepEqual(snap.opportunities.map((item)=>item.id).sort(),["opp-1","opp-2"]);
});

test("legacy blob lists with prefix-relative keys are loaded and migrated",async()=>{
 const data=new Map([["opportunities/opp-legacy",opportunity({id:"opp-legacy"})]]);
 const store={
  async setJSON(key,value){data.set(key,structuredClone(value));},
  async get(key){return data.has(key)?structuredClone(data.get(key)):null;},
  async list({prefix}={}){return{blobs:[...data.keys()].filter((key)=>key.startsWith(prefix)).map((key)=>({key:key.slice(prefix.length),etag:"x"})),directories:[]};}
 };
 const repo=createStateRepository(store);
 assert.equal((await repo.listOpportunities())[0].id,"opp-legacy");
 await repo.saveOpportunity(opportunity({id:"opp-new",canonical_url:"https://example.com/new"}));
 assert.deepEqual((await data.get("metadata/opportunities-v1")).map((item)=>item.id).sort(),["opp-legacy","opp-new"]);
});

test("search merge fails closed when the workspace snapshot cannot be read back",async()=>{
 const store=memoryStore(),originalGet=store.get.bind(store);
 store.get=async(key,...args)=>key==="metadata/opportunities-v1"?null:originalGet(key,...args);
 await assert.rejects(
  ()=>createStateRepository(store).mergeSearchResultsWithStats([opportunity()],"2026-09-06T09:00:00Z"),
  /STATE_WRITE_VERIFICATION_FAILED/
 );
});

test("a new repository instance retains old opportunities, reply and last search a week later",async()=>{
 const store=memoryStore(),repo=createStateRepository(store);
 await repo.saveOpportunity(opportunity({reply_subject:"Approved subject",reply_body:"Saved body",reply_to:"public@example.com"}));
 await repo.saveOpportunity(opportunity({id:"old-other",canonical_url:"https://example.com/old"}));
 await repo.mergeSearchResults([opportunity({id:"new-id",reply_body:"overwrite attempt"})],"2026-09-12T09:00:00Z");
 const run={completed_at:"2026-09-12T09:00:00Z",estimated_cost_usd:0.0128};await repo.saveSearchRun(run);
 const snap=await createStateRepository(store).snapshot();
 assert.equal(snap.opportunities.length,2);const saved=snap.opportunities.find(x=>x.id==="opp-1");
 assert.equal(saved.reply_body,"Saved body");assert.equal(saved.reply_subject,"Approved subject");assert.equal(saved.first_seen,"2026-09-05T09:00:00Z");assert.equal(saved.last_seen,"2026-09-12T09:00:00Z");assert.deepEqual(snap.last_search,run);
});

test("legacy seller price is hidden on list and reply reads without rewriting history",async()=>{
 const store=memoryStore(),repo=createStateRepository(store);
 const item=opportunity({budget_type:"PUBLISHED",budget_published:"$240,000 annual license",reply_body:"Saved response",status:"INTERESTING"});
 await repo.saveOpportunity(item);
 for(const result of [await repo.getOpportunity(item.id),...(await repo.snapshot()).opportunities]){
  assert.equal(result.budget_type,"UNKNOWN");assert.equal(result.budget_published,null);
  assert.equal(result.reply_body,"Saved response");assert.equal(result.status,"INTERESTING");
 }
 assert.equal((await store.get(`opportunities/${item.id}`)).budget_published,item.budget_published);
});

test("new buyer budget evidence survives a repository reload",async()=>{
 const store=memoryStore(),repo=createStateRepository(store),url="https://example.com/buyer-brief";
 await repo.saveOpportunity(opportunity({budget_type:"PUBLISHED",budget_basis:"BUYER_PROJECT",budget_source_url:url,budget_published:"EUR 12,000 per batch",source_evidence:[{url}]}));
 const result=await createStateRepository(store).getOpportunity("opp-1");
 assert.equal(result.budget_type,"PUBLISHED");assert.equal(result.budget_published,"EUR 12,000 per batch");
});

test("manual source verification is URL-bound, idempotent and survives a repeat search",async()=>{
 const store=memoryStore(),repo=createStateRepository(store),source="https://www.upwork.com/freelance-jobs/apply/Human-Scan-Cleanup_~0123";
 const pending=opportunity({canonical_url:source,source_url:source,discovery_mode:"INDEX_DISCOVERY_MANUAL_VERIFY",manual_verification_status:"REQUIRED_BEFORE_CONTACT",manual_verified_at:null,manual_verified_source_url:null});
 await repo.saveOpportunity(pending);
 await assert.rejects(()=>repo.verifyOpportunitySource("opp-1","https://upwork.com/freelance-jobs/apply/Other_~999","2026-09-06T08:00:00Z"),error=>error.code==="SOURCE_VERIFICATION_URL_MISMATCH");
 const verified=await repo.verifyOpportunitySource("opp-1",source,"2026-09-06T08:01:00Z");
 assert.equal(verified.manual_verification_status,"VERIFIED_BEFORE_CONTACT");
 assert.equal(verified.manual_verified_source_url,source);
 const replay=await repo.verifyOpportunitySource("opp-1",source,"2026-09-06T08:02:00Z");
 assert.equal(replay.manual_verified_at,"2026-09-06T08:01:00Z");
 const [merged]=await repo.mergeSearchResults([pending],"2026-09-06T09:00:00Z");
 assert.equal(merged.manual_verification_status,"VERIFIED_BEFORE_CONTACT");
 assert.equal(merged.manual_verified_at,"2026-09-06T08:01:00Z");
 const changedSource="https://www.upwork.com/freelance-jobs/apply/Human-Scan-Cleanup-Updated_~0456";
 const [changed]=await repo.mergeSearchResults([{...pending,canonical_url:source,source_url:changedSource}],"2026-09-06T10:00:00Z");
 assert.equal(changed.manual_verification_status,"REQUIRED_BEFORE_CONTACT");
 assert.equal(changed.manual_verified_at,null);
 assert.equal(changed.manual_verified_source_url,null);
});
