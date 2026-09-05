import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const fixture = JSON.parse(await readFile(new URL("../fixtures/collectors/ted-search-response.json", import.meta.url), "utf8"));

function installEnv(t, values) {
  const previous = globalThis.Netlify;
  globalThis.Netlify = { env:{ get:(key) => values[key] || "" } };
  t.after(() => {
    delete globalThis.__RADAR_TEST_TED_FETCH__;
    delete globalThis.__3DSK_RADAR_SOURCE_COLLECTION_STATE__;
    if (previous === undefined) delete globalThis.Netlify;
    else globalThis.Netlify = previous;
  });
}

function request(method = "POST", body = {}, token = "team-secret") {
  return new Request("https://radar.test/api/source-collection", {
    method,
    headers:{ authorization:`Bearer ${token}`, "content-type":"application/json" },
    ...(method === "POST" ? { body:JSON.stringify(body) } : {})
  });
}

async function handler() {
  return (await import(`../netlify/functions/source-collection.mjs?test=${Math.random()}`)).default;
}

test("source collector registry is authenticated and reports the default-off gate without network", async t => {
  installEnv(t, { RADAR_INTERNAL_ACCESS_SECRET:"team-secret", RADAR_SOURCE_COLLECTION_ENABLED:"false" });
  globalThis.__RADAR_TEST_TED_FETCH__ = async () => { throw new Error("locked route must not fetch"); };
  const run = await handler();
  assert.equal((await run(request("GET", {}, "wrong"))).status, 401);
  const get = await run(request("GET"));
  const catalog = await get.json();
  assert.equal(get.status, 200);
  assert.equal(catalog.collection_enabled, false);
  assert.equal(catalog.openai_requests, 0);
  assert.equal(catalog.collectors.find((item) => item.source_id === "ted_eu").status, "LOCKED");
  const post = await run(request("POST", { source_id:"ted_eu", query_pack_id:"other_relevant" }));
  assert.equal(post.status, 423);
  assert.equal((await post.json()).error.code, "SOURCE_COLLECTION_LOCKED");
});

test("enabled TED endpoint remains read-only, capped and zero-cost", async t => {
  installEnv(t, {
    RADAR_INTERNAL_ACCESS_SECRET:"team-secret",
    RADAR_SOURCE_COLLECTION_ENABLED:"true",
    RADAR_SOURCE_COLLECTION_MAX_RESULTS:"2",
    RADAR_SOURCE_COLLECTION_COOLDOWN_SECONDS:"0"
  });
  let requestBody;
  globalThis.__RADAR_TEST_TED_FETCH__ = async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return Response.json(fixture);
  };
  const run = await handler();
  const response = await run(request("POST", { source_id:"ted_eu", query_pack_id:"other_relevant", limit:50 }));
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(requestBody.limit, 2);
  assert.equal(payload.records.length, 2);
  assert.equal(payload.run.persistence, "NONE");
  assert.equal(payload.run.estimated_cost_usd, 0);
  assert.equal(payload.run.counters.openai_requests, 0);
  assert.equal(payload.run.counters.list_pages_fetched, 1);
});

test("source endpoint rejects arbitrary collectors and excluded query packs before fetch", async t => {
  installEnv(t, {
    RADAR_INTERNAL_ACCESS_SECRET:"team-secret",
    RADAR_SOURCE_COLLECTION_ENABLED:"true",
    RADAR_SOURCE_COLLECTION_COOLDOWN_SECONDS:"0"
  });
  let calls = 0;
  globalThis.__RADAR_TEST_TED_FETCH__ = async () => { calls += 1; return Response.json(fixture); };
  const run = await handler();
  let response = await run(request("POST", { source_id:"https://attacker.example", query_pack_id:"other_relevant" }));
  assert.equal((await response.json()).error.code, "COLLECTOR_NOT_AVAILABLE");
  response = await run(request("POST", { source_id:"ted_eu", query_pack_id:"visual_ai_motion" }));
  assert.equal((await response.json()).error.code, "TED_QUERY_PACK_UNKNOWN");
  assert.equal(calls, 0);
});
