import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const html=read('../index.html'),css=read('../src/director.css'),app=read('../src/app.js');
test('score numbers and labels override legacy light text and meet AA contrast',()=>{
  assert.match(css,/\.score strong, \.score.high small, \.score.medium small, \.score.low small\s*\{\s*color:inherit;/);
  const luminance=hex=>{
    const channels=hex.match(/\w{2}/g).map(x=>parseInt(x,16)/255).map(x=>x<=0.04045?x/12.92:((x+0.055)/1.055)**2.4);
    return channels[0]*0.2126+channels[1]*0.7152+channels[2]*0.0722;
  };
  for(const level of ['high','medium','low']){
    const rule=css.match(new RegExp(`\\.score\\.${level} \\{ color:#([a-f0-9]{6}); background:#([a-f0-9]{6});`));
    assert.ok(rule,`${level} palette present`);
    const values=[luminance(rule[1]),luminance(rule[2])].sort((a,b)=>b-a);
    assert.ok((values[0]+0.05)/(values[1]+0.05)>=4.5,`${level} score contrast >= 4.5:1`);
  }
});
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
