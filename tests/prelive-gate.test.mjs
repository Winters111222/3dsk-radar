import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const search = await readFile(new URL("../netlify/functions/search.mjs", import.meta.url), "utf8");
const reply = await readFile(new URL("../netlify/functions/generate-response.mjs", import.meta.url), "utf8");
const env = await readFile(new URL("../.env.example", import.meta.url), "utf8");
test("all paid AI paths are guarded by explicit final-acceptance kill switch",()=>{
  for (const source of [search, reply]) {
    assert.match(source,/LIVE_AI_LOCKED/);
    assert.ok(source.indexOf("LIVE_AI_LOCKED") < source.indexOf("OPENAI_API_KEY"));
  }
  assert.match(env,/^RADAR_LIVE_AI_ENABLED=false$/m);
  assert.match(env,/^RADAR_PRODUCTION_SEARCH_ENABLED=false$/m);
  assert.match(env,/^RADAR_PRODUCTION_REPLY_ENABLED=false$/m);
});
