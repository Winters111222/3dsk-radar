import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const html=read('../index.html'),css=read('../src/director.css'),app=read('../src/app.js');
test('director workspace preserves unique existing controls and hides technical sections initially',()=>{
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
  assert.equal(ids.length,new Set(ids).size);
  for(const id of ['search-tools','diagnostics-tools','search-footprint'])assert.match(html,new RegExp(`<details id="${id}"[^>]*>`));
  assert.doesNotMatch(html,/<details id="(?:search-tools|diagnostics-tools|search-footprint)"[^>]*\sopen/);
  for(const id of ['ultra-max-button','source-run-button','find-button','connect-button','opportunity-body','detail-panel','opportunity-search','reset-filters'])assert.ok(ids.includes(id));
  assert.match(css,/\[hidden\]\s*\{\s*display:none!important/);
  assert.match(app,/renderDetailContent\(\)/);
  assert.match(app,/not a probability of winning/);
});
test('official logo is local, static SVG and UI adds no external script',()=>{
  const svg=read('../assets/3dsk-logo.svg');
  assert.match(svg,/<svg/);assert.doesNotMatch(svg,/<script|<foreignObject|\bonload=|\bhref=/i);
  assert.match(html,/src="\/assets\/3dsk-logo.svg"/);
  assert.doesNotMatch(html,/<script[^>]*src="https?:/);
});
test('source outline explicitly distinguishes activity counts from complete browsing history',()=>{
  assert.match(app,/not a complete browsing history/);
  assert.match(app,/not necessarily final sales/);
  assert.match(app,/does not mean Radar directly crawled/);
  assert.match(html,/What did Radar search\?/);
});
