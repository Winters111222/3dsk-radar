import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parseHTML } from 'linkedom';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
function boot(reduced=false){
  const {document,window:dom}=parseHTML(html);
  let time=0,id=0;const timers=new Map(),listeners=new Map();
  const window={matchMedia:()=>({matches:reduced}),
    addEventListener:(name,fn)=>listeners.set(name,fn),
    removeEventListener:(name)=>listeners.delete(name)};
  const tick=ms=>{const end=time+ms;while(true){const due=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!due)break;time=due[1].at;timers.delete(due[0]);due[1].fn();}time=end;};
  runInNewContext(document.querySelector('#radar-boot-controller').textContent,{
    document,window,Date:{now:()=>time},
    setTimeout:(fn,ms)=>{timers.set(++id,{fn,at:time+ms});return id;},
    clearTimeout:key=>timers.delete(key)
  });
  document.dispatchEvent(new dom.Event('DOMContentLoaded'));
  return{document,tick,emit:(name,event={})=>listeners.get(name)?.(event),
    active:()=>document.documentElement.classList.contains('radar-booting')};
}
test('first paint hides app before external CSS and module; no-JS has an escape',()=>{
  assert.match(html,/<html[^>]+class="radar-booting"/);
  assert.ok(html.indexOf('id="radar-boot-style"')<html.indexOf('rel="stylesheet"'));
  assert.match(html,/html\.radar-booting \.app-shell[^}]+visibility:hidden!important/);
  assert.match(html,/<noscript><style>#radar-boot\{display:none!important/);
  assert.match(html,/@media\(prefers-reduced-motion:reduce\)[^\n]+animation:none!important/);
});
test('waits for ready, then gently reveals and removes overlay once',()=>{
  const b=boot();b.tick(200);assert.ok(b.active());b.emit('radar:ready');
  b.tick(449);assert.ok(b.active());b.tick(1);assert.equal(b.active(),false);
  assert.ok(b.document.querySelector('#radar-boot').classList.contains('is-leaving'));
  b.tick(280);assert.equal(b.document.querySelector('#radar-boot'),null);
  b.emit('radar:ready');b.tick(10000);assert.ok(b.document.querySelector('#radar-boot-notice').hidden);
});
test('reduced motion has neither minimum wait nor fade delay',()=>{
  const b=boot(true);b.emit('radar:ready');b.tick(0);
  assert.equal(b.active(),false);assert.equal(b.document.querySelector('#radar-boot'),null);
});
test('stalled initialization unblocks at deadline and shows honest notice',()=>{
  const b=boot();b.tick(9999);assert.ok(b.active());b.tick(281);
  assert.equal(b.active(),false);assert.equal(b.document.querySelector('#radar-boot'),null);
  assert.match(b.document.querySelector('#radar-boot-notice').textContent,/still be loading/);
});
test('bundle failure unblocks, while an image failure does not end initialization',()=>{
  const b=boot();b.emit('error',{target:{tagName:'IMG'}});b.tick(5);assert.ok(b.active());
  b.emit('error',{target:{tagName:'SCRIPT'}});b.tick(280);
  assert.equal(b.active(),false);assert.match(b.document.querySelector('#radar-boot-notice').textContent,/could not finish/);
});
test('manual escape and back-forward restoration cannot leave a curtain',()=>{
  const b=boot();b.document.querySelector('#radar-boot-skip').click();b.tick(280);
  assert.equal(b.active(),false);assert.equal(b.document.querySelector('#radar-boot'),null);
  const restored=boot();restored.emit('pageshow',{persisted:true});restored.tick(12000);
  assert.equal(restored.active(),false);assert.equal(restored.document.querySelector('#radar-boot'),null);
});
