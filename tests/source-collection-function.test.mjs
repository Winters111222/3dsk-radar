import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const tedFixture = JSON.parse(await readFile(new URL("../fixtures/collectors/ted-search-response.json", import.meta.url), "utf8"));
const findTenderFixture = JSON.parse(await readFile(new URL("../fixtures/collectors/find-tender-release-package.json", import.meta.url), "utf8"));
const contractsFinderFixture = JSON.parse(await readFile(new URL("../fixtures/collectors/contracts-finder-release-package.json", import.meta.url), "utf8"));

function installEnv(t, values) {
  const previous = globalThis.Netlify;
  globalThis.Netlify = { env:{ get:(key) => values[key] || "" } };
  if (values.RADAR_SOURCE_COLLECTION_ENABLED === "true") {
    globalThis.__RADAR_TEST_RUNTIME_ELIGIBLE_SOURCE_IDS__ = new Set(["ted_eu", "find_tender_uk", "contracts_finder_uk"]);
  }
  t.after(() => {
    delete globalThis.__RADAR_TEST_TED_FETCH__;
    delete globalThis.__RADAR_TEST_FIND_TENDER_FETCH__;
    delete globalThis.__RADAR_TEST_CONTRACTS_FINDER_FETCH__;
    delete globalThis.__RADAR_TEST_NOW_ISO__;
    delete globalThis.__3DSK_RADAR_SOURCE_COLLECTION_STATE__;
    delete globalThis.__RADAR_TEST_RUNTIME_ELIGIBLE_SOURCE_IDS__;
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

test("environment enable cannot bypass the historical relevance gate", async t => {
  installEnv(t, { RADAR_INTERNAL_ACCESS_SECRET:"team-secret", RADAR_SOURCE_COLLECTION_ENABLED:"true" });
  delete globalThis.__RADAR_TEST_RUNTIME_ELIGIBLE_SOURCE_IDS__;
  let calls = 0;
  globalThis.__RADAR_TEST_TED_FETCH__ = async () => { calls += 1; throw new Error("relevance lock must not fetch"); };
  const run = await handler();
  const get = await run(request("GET"));
  const catalog = await get.json();
  assert.deepEqual(catalog.qualification.eligible_source_ids, []);
  assert.equal(catalog.collectors.find((item) => item.source_id === "ted_eu").status, "BLOCKED_RELEVANCE_REVIEW");
  const post = await run(request("POST", { source_id:"ted_eu", query_pack_id:"other_relevant" }));
  assert.equal(post.status, 423);
  assert.equal((await post.json()).error.code, "SOURCE_RELEVANCE_LOCKED");
  assert.equal(calls, 0);
});

test("enabled TED endpoint remains read-only, capped and zero-cost", async t => {
  installEnv(t, {
    RADAR_INTERNAL_ACCESS_SECRET:"team-secret",
    RADAR_SOURCE_COLLECTION_ENABLED:"true",
    RADAR_SOURCE_COLLECTION_MAX_RESULTS:"2",
    RADAR_SOURCE_COLLECTION_COOLDOWN_SECONDS:"0"
  });
  globalThis.__RADAR_TEST_NOW_ISO__ = "2026-09-05T12:00:00.000Z";
  let requestBody;
  globalThis.__RADAR_TEST_TED_FETCH__ = async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return Response.json(tedFixture);
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

test("enabled Find a Tender endpoint is fixed, cursor-aware, capped and zero-cost", async t => {
  installEnv(t, {
    RADAR_INTERNAL_ACCESS_SECRET:"team-secret",
    RADAR_SOURCE_COLLECTION_ENABLED:"true",
    RADAR_SOURCE_COLLECTION_MAX_RESULTS:"4",
    RADAR_SOURCE_COLLECTION_COOLDOWN_SECONDS:"0"
  });
  globalThis.__RADAR_TEST_NOW_ISO__ = "2026-09-05T12:00:00.000Z";
  let requestUrl;
  globalThis.__RADAR_TEST_FIND_TENDER_FETCH__ = async (url) => {
    requestUrl = new URL(url);
    return Response.json(findTenderFixture);
  };
  const run = await handler();
  const response = await run(request("POST", { source_id:"find_tender_uk", query_pack_id:"other_relevant", limit:50, cursor:"MTAwM=" }));
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(requestUrl.origin, "https://www.find-tender.service.gov.uk");
  assert.equal(requestUrl.searchParams.get("limit"), "4");
  assert.equal(requestUrl.searchParams.get("cursor"), "MTAwM=");
  assert.equal(payload.records.length, 1);
  assert.equal(payload.run.next_cursor, "MTAwM=");
  assert.equal(payload.run.persistence, "NONE");
  assert.equal(payload.run.estimated_cost_usd, 0);
  assert.equal(payload.run.counters.openai_requests, 0);
});

test("Find a Tender upstream Retry-After is preserved without retrying", async t => {
  installEnv(t, {
    RADAR_INTERNAL_ACCESS_SECRET:"team-secret",
    RADAR_SOURCE_COLLECTION_ENABLED:"true",
    RADAR_SOURCE_COLLECTION_COOLDOWN_SECONDS:"0"
  });
  globalThis.__RADAR_TEST_NOW_ISO__ = "2026-09-05T12:00:00.000Z";
  let calls = 0;
  globalThis.__RADAR_TEST_FIND_TENDER_FETCH__ = async () => {
    calls += 1;
    return new Response("slow down", { status:429, headers:{ "retry-after":"19" } });
  };
  const run = await handler();
  const response = await run(request("POST", { source_id:"find_tender_uk", query_pack_id:"other_relevant" }));
  const payload = await response.json();
  assert.equal(response.status, 429);
  assert.equal(payload.error.code, "FIND_TENDER_UPSTREAM_RATE_LIMITED");
  assert.equal(payload.error.retry_after_seconds, 19);
  assert.equal(calls, 1);
});

test("enabled Contracts Finder endpoint returns only first-party source records at zero cost", async t => {
  installEnv(t, {
    RADAR_INTERNAL_ACCESS_SECRET:"team-secret",
    RADAR_SOURCE_COLLECTION_ENABLED:"true",
    RADAR_SOURCE_COLLECTION_MAX_RESULTS:"4",
    RADAR_SOURCE_COLLECTION_COOLDOWN_SECONDS:"0"
  });
  globalThis.__RADAR_TEST_NOW_ISO__ = "2026-09-05T12:00:00.000Z";
  let requestUrl;
  globalThis.__RADAR_TEST_CONTRACTS_FINDER_FETCH__ = async (url) => {
    requestUrl = new URL(url);
    return Response.json(contractsFinderFixture);
  };
  const run = await handler();
  const response = await run(request("POST", { source_id:"contracts_finder_uk", query_pack_id:"other_relevant", limit:50 }));
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(requestUrl.origin, "https://www.contractsfinder.service.gov.uk");
  assert.equal(requestUrl.searchParams.get("limit"), "4");
  assert.equal(payload.records.length, 1);
  assert.equal(payload.records[0].source_id, "contracts_finder_uk");
  assert.match(payload.records[0].canonical_url, /^https:\/\/www\.contractsfinder\.service\.gov\.uk\/Notice\//);
  assert.equal(payload.run.persistence, "NONE");
  assert.equal(payload.run.estimated_cost_usd, 0);
  assert.equal(payload.run.counters.openai_requests, 0);
});

test("source endpoint rejects arbitrary collectors and excluded query packs before fetch", async t => {
  installEnv(t, {
    RADAR_INTERNAL_ACCESS_SECRET:"team-secret",
    RADAR_SOURCE_COLLECTION_ENABLED:"true",
    RADAR_SOURCE_COLLECTION_COOLDOWN_SECONDS:"0"
  });
  let calls = 0;
  globalThis.__RADAR_TEST_TED_FETCH__ = async () => { calls += 1; return Response.json(tedFixture); };
  const run = await handler();
  let response = await run(request("POST", { source_id:"https://attacker.example", query_pack_id:"other_relevant" }));
  assert.equal((await response.json()).error.code, "COLLECTOR_NOT_AVAILABLE");
  response = await run(request("POST", { source_id:"ted_eu", query_pack_id:"visual_ai_motion" }));
  assert.equal((await response.json()).error.code, "TED_QUERY_PACK_UNKNOWN");
  assert.equal(calls, 0);
});
