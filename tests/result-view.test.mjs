import test from 'node:test';
import assert from 'node:assert/strict';
import {CATEGORIES,visibleResults} from '../src/lib/result-view.mjs';
const items=[
{id:'a',company:'Zulu',fit_score:90,win_score:80,categories:['FULL_PIPELINE','WRAP_BASEMESH'],status:'NEW',company_bookmarked:true,published_date:'2026-09-01'},
{id:'b',company:'Alpha',fit_score:70,win_score:95,categories:['PHOTOGRAMMETRY_PROCESSING'],status:'NEW',published_date:null},
{id:'c',company:'Beta',fit_score:85,win_score:60,categories:['SCAN_CLEANUP'],status:'IGNORE',published_date:'2026-09-05'}
];
test('category OR combines with status and score filters and includes secondary tags',()=>{
assert.equal(Object.hasOwn(CATEGORIES,'VISUAL_AI_MOTION'),false);
assert.deepEqual(visibleResults(items,{categories:['WRAP_BASEMESH','PHOTOGRAMMETRY_PROCESSING'],status:'NEW',minFit:60}).map(x=>x.id),['b','a']);
assert.deepEqual(visibleResults(items,{categories:['WRAP_BASEMESH','PHOTOGRAMMETRY_PROCESSING'],minFit:80}).map(x=>x.id),['a']);
assert.equal(visibleResults(items,{categories:['FACIAL_FACS']}).length,0);
});
test('column sorting switches direction without mutating source',()=>{
assert.deepEqual(visibleResults(items,{sortKey:'company',sortDirection:'asc'}).map(x=>x.id),['b','c','a']);
assert.deepEqual(visibleResults(items,{sortKey:'company',sortDirection:'desc'}).map(x=>x.id),['a','c','b']);
assert.deepEqual(items.map(x=>x.id),['a','b','c']);
});
test('unknown dates stay last in either direction',()=>{
assert.deepEqual(visibleResults(items,{sortKey:'published_date',sortDirection:'asc'}).map(x=>x.id),['a','c','b']);
assert.deepEqual(visibleResults(items,{sortKey:'published_date',sortDirection:'desc'}).map(x=>x.id),['c','a','b']);
});
test('bookmark view intersects selected category and clearing restores all',()=>{
assert.equal(visibleResults(items,{view:'BOOKMARKED',categories:['PHOTOGRAMMETRY_PROCESSING']}).length,0);
assert.deepEqual(visibleResults(items,{view:'BOOKMARKED',categories:[]}).map(x=>x.id),['a']);
assert.equal(visibleResults(items,{categories:[]}).length,3);
});
test('default sales views exclude intelligence and competitor view excludes source platforms',()=>{
const mixed=[...items,{id:'d',record_kind:'COMPETITOR',company:'Seller',fit_score:99,win_score:0,categories:['FULL_PIPELINE'],status:'NEW'},{id:'e',record_kind:'SOURCE_PLATFORM',company:'Jobs Index',fit_score:100,win_score:0,categories:['OTHER_RELEVANT'],status:'NEW'}];
assert.deepEqual(visibleResults(mixed,{view:'ALL'}).map(x=>x.id),['b','a','c']);
assert.deepEqual(visibleResults(mixed,{view:'COMPETITORS'}).map(x=>x.id),['d']);
});
