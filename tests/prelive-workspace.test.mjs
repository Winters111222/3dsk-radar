import test from 'node:test';import assert from 'node:assert/strict';
import handler from '../netlify/functions/prelive-workspace.mjs';
import {storeOptions,acceptanceEnabled} from '../src/server/netlify-state.mjs';
const request=()=>new Request('https://radar.test/api/prelive-workspace',{method:'POST',headers:{authorization:'Bearer test-secret','x-radar-workspace':'acceptance'}});
test('isolated prelive seed refuses unauthenticated, disabled and live AI modes',async()=>{
 globalThis.Netlify={env:{get:k=>({RADAR_INTERNAL_ACCESS_SECRET:'test-secret'}[k]||'')}};
 assert.equal((await handler(request())).status,423);
 globalThis.Netlify.env.get=k=>({RADAR_INTERNAL_ACCESS_SECRET:'test-secret',RADAR_PRELIVE_ACCEPTANCE_ENABLED:'true',RADAR_LIVE_AI_ENABLED:'true'}[k]||'');
 assert.equal(acceptanceEnabled(),false);assert.equal((await handler(request())).status,423);
 assert.equal((await handler(new Request('https://radar.test/api/prelive-workspace',{method:'POST'}))).status,401);
});
test('production store survives deploys while preview remains deploy scoped; QA namespace is separate',()=>{
 assert.deepEqual(storeOptions({context:'production'}),{name:'radar-state',consistency:'strong',production:true});
 assert.equal(storeOptions({context:'deploy-preview'}).production,false);
 assert.equal(storeOptions({context:'production',acceptance:true}).name,'radar-prelive-acceptance');
});
