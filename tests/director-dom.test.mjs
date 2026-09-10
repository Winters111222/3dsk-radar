import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseHTML } from 'linkedom';

test('director interactions render real app code with isolated, read-only API mocks',async()=>{
  const {window,document}=parseHTML(readFileSync(new URL('../index.html',import.meta.url),'utf8'));
  // linkedom models DOM, not layout; supply the native select setter it omits.
  Object.defineProperty(window.HTMLSelectElement.prototype,'value',{get(){return this.querySelector('option[selected]')?.value||this.querySelector('option')?.value||'';},set(value){for(const option of this.querySelectorAll('option'))option.selected=option.value===value;},configurable:true});
  const storage=()=>{const data=new Map();return{getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,String(value)),removeItem:key=>data.delete(key)};};
  const session=storage();session.setItem('3dsk-radar-access-v2','isolated-test-only');
  Object.assign(globalThis,{window,document,location:{search:''},sessionStorage:session,localStorage:storage(),CustomEvent:window.CustomEvent});
  window.matchMedia=()=>({matches:false});
  window.HTMLElement.prototype.scrollIntoView=()=>{};
  const fixtures=JSON.parse(readFileSync(new URL('../fixtures/opportunities.json',import.meta.url),'utf8'));
  const rejected={id:'rejected-dom-001',title:'Rejected human scan task',company:'Fixture buyer',summary:'Expired fixture',source_url:'https://example.com/rejected',categories:['SCAN_CLEANUP'],fit_score:80,win_score:50,rejection_reason:'inactive_notice',review_status:'PENDING'};
  const calls=[];
  globalThis.fetch=async(path,options={})=>{
    calls.push({path,method:options.method||'GET'});
    assert.equal(options.method||'GET','GET','UI navigation must not write data or run paid operations');
    const payload=path==='/api/health'?{paid_ai_state:'LOCKED',source_collection:'LOCKED'}:
      path==='/api/opportunities'?{ok:true,opportunities:fixtures,rejected_candidates:[rejected],companies:[],last_search:{completed_at:'2026-09-10T09:00:00Z',coverage:[{shard_label:'Human cleanup',status:'COMPLETE',web_search_calls:1,consulted_urls:2}],diagnostics:{source_yield:[{source_label:'Example',consulted_urls:2,candidates_seen:1,returned:0}]},forensic_audit:{accepted_candidate_ledger:[{title:'Rejected human scan task',source_url:'https://example.com/rejected',detail_status:'REJECTED'}]}}}:
      {ok:true,run:null,candidates:[]};
    return{ok:true,json:async()=>payload};
  };
  await import('../src/app.js');
  for(let i=0;i<30;i++)await Promise.resolve();
  const click=selector=>document.querySelector(selector).click();
  assert.ok(document.querySelectorAll('#opportunity-body tr[data-id]').length>0);
  assert.ok(document.querySelectorAll('#detail-panel .detail-disclosure').length>=3);
  assert.match(document.querySelector('#search-footprint-content').textContent,/Human cleanup/);
  assert.match(document.querySelector('#search-footprint-content').textContent,/example.com/);
  const input=document.querySelector('#opportunity-search');input.value='no-such-buyer';input.dispatchEvent(new window.Event('input'));
  assert.equal(document.querySelectorAll('#opportunity-body tr[data-id]').length,0);
  click('#reset-filters');assert.ok(document.querySelectorAll('#opportunity-body tr[data-id]').length>0);
  click('#table-layout');assert.equal(document.querySelector('.results-layout').classList.contains('cards-mode'),false);
  click('#list-layout');assert.equal(document.querySelector('#list-layout').getAttribute('aria-pressed'),'true');
  click('[data-view="REJECTED"]');
  assert.match(document.querySelector('#detail-panel').textContent,/OUTREACH & PROMOTION LOCKED/);
  assert.equal(document.querySelector('#detail-panel [data-generate-response]'),null);
  assert.equal(document.querySelectorAll('#opportunity-body tr[data-id]').length,1);
  click('[data-view="ALL"]');assert.ok(document.querySelectorAll('#opportunity-body tr[data-id]').length>0);
  assert.ok(calls.length>=2);assert.ok(calls.every(call=>call.method==='GET'));
});
