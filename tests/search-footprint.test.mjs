import test from 'node:test';
import assert from 'node:assert/strict';
import { searchFootprint } from '../src/lib/search-footprint.mjs';
import { matchesSavedSearch, visibleResults, visibleRejectedResults } from '../src/lib/result-view.mjs';

test('footprint does not invent a history for a legacy or disconnected run',()=>{
  assert.deepEqual(searchFootprint(null),{completedAt:null,topics:[],sources:[],links:[]});
  const report=searchFootprint({coverage:[{shard_label:'Human scans',status:'FAILED'}],diagnostics:{source_yield:[{source_label:'Catalog only',consulted_urls:0,candidates_seen:0,returned:0}]}});
  assert.equal(report.topics[0].consulted,null);assert.equal(report.topics[0].calls,null);
  assert.equal(report.topics[0].status,'FAILED');assert.equal(report.sources.length,0);
});
test('footprint groups recorded sources and retains exact ledger URLs only',()=>{
  const report=searchFootprint({diagnostics:{source_yield:[{source_label:'Upwork',consulted_urls:3,candidates_seen:1,returned:0}]},forensic_audit:{accepted_candidate_ledger:[
    {title:'Scan cleanup',source_url:'https://www.upwork.com/jobs/~0123',detail_status:'REJECTED'},
    {source_url:'https://www.upwork.com/jobs/~0123'},
    {source_url:'javascript:alert(1)'},{source_url:'https://secret:token@example.com/'},{source_url:'invalid'}
  ]}});
  assert.equal(report.sources.length,1);assert.equal(report.sources[0].rejected,null);
  assert.equal(report.links.length,1);assert.equal(report.links[0].status,'REJECTED');
  assert.equal(report.links[0].url,'https://www.upwork.com/jobs/~0123');
});
test('saved text search supports title, company and friendly capability labels',()=>{
  const item={id:'one',title:'Human scan repair',company:'Example buyer',summary:'Facial data',categories:['WRAP_BASEMESH'],fit_score:90,win_score:60,status:'NEW',record_kind:'SALES_OPPORTUNITY'};
  assert.equal(matchesSavedSearch(item,'HUMAN buyer'),true);
  assert.equal(matchesSavedSearch(item,'basemesh'),true);
  assert.equal(matchesSavedSearch(item,'metahuman'),false);
  assert.equal(visibleResults([item],{query:'repair'}).length,1);
  assert.equal(visibleResults([item],{query:'repair',minFit:95}).length,0);
  assert.equal(visibleRejectedResults([item],{query:'repair'}).length,1);
  assert.equal(visibleRejectedResults([item],{query:'tire'}).length,0);
});
