import test from "node:test";import assert from "node:assert/strict";import { createStateRepository } from "../src/server/state-repository.mjs";
function memoryStore(){const data=new Map();return{async setJSON(k,v){data.set(k,structuredClone(v));},async get(k){return data.has(k)?structuredClone(data.get(k)):null;},async list({prefix}={}){return{blobs:[...data.keys()].filter(k=>!prefix||k.startsWith(prefix)).map(key=>({key,etag:"x"})),directories:[]};}};}
const opportunity=(o={})=>({id:"opp-1",canonical_url:"https://example.com/a",source_domain:"example.com",title:"AAA Human Vendor",company:"Example Games",first_seen:"2026-09-05T09:00:00Z",last_seen:"2026-09-05T09:00:00Z",status:"NEW",is_new:true,...o});
test("bookmark applies to every opportunity from same company",async()=>{const repo=createStateRepository(memoryStore());await repo.saveOpportunity(opportunity());await repo.saveOpportunity(opportunity({id:"opp-2",canonical_url:"https://example.com/b",title:"Second Request"}));await repo.setBookmark("Example Games",true,"2026-09-05T10:00:00Z");const snap=await repo.snapshot();assert.ok(snap.opportunities.every(x=>x.company_bookmarked));});
test("mark email sent also marks the opportunity CONTACTED",async()=>{const repo=createStateRepository(memoryStore());await repo.saveOpportunity(opportunity());await repo.markEmailSent("Example Games",{opportunityId:"opp-1",recipient:"sales@example.com",sentAt:"2026-09-05T10:00:00Z"});assert.equal((await repo.getOpportunity("opp-1")).status,"CONTACTED");});
test("search merge preserves first_seen and status and makes repeat result not new",async()=>{const repo=createStateRepository(memoryStore());await repo.saveOpportunity(opportunity({status:"INTERESTING"}));const [merged]=await repo.mergeSearchResults([opportunity({id:"new-model-id",first_seen:"2026-09-06T09:00:00Z"})],"2026-09-06T09:00:00Z");assert.equal(merged.id,"opp-1");assert.equal(merged.first_seen,"2026-09-05T09:00:00Z");assert.equal(merged.status,"INTERESTING");assert.equal(merged.is_new,false);});

test("detailed search merge separates new, updated and workspace totals",async()=>{const repo=createStateRepository(memoryStore());await repo.saveOpportunity(opportunity());const result=await repo.mergeSearchResultsWithStats([opportunity({id:"repeat"}),opportunity({id:"opp-2",canonical_url:"https://example.com/b",title:"New Request"})],"2026-09-06T09:00:00Z");assert.equal(result.new_count,1);assert.equal(result.updated_count,1);assert.equal(result.workspace_total,2);});

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
