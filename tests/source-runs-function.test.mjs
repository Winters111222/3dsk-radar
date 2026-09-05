import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createStateRepository } from "../src/server/state-repository.mjs";
import { memoryStore } from "./helpers/memory-store.mjs";

const tedFixture = JSON.parse(await readFile(new URL("../fixtures/collectors/ted-search-response.json", import.meta.url), "utf8"));

function installRuntime(t, values) {
  const previousNetlify = globalThis.Netlify;
  globalThis.Netlify = { env:{ get:(key) => values[key] || "" } };
  globalThis.__RADAR_TEST_STATE_REPOSITORY__ = createStateRepository(memoryStore());
  globalThis.__RADAR_TEST_NOW_ISO__ = "2026-09-05T12:00:00.000Z";
  t.after(() => {
    delete globalThis.__RADAR_TEST_STATE_REPOSITORY__;
    delete globalThis.__RADAR_TEST_NOW_ISO__;
    delete globalThis.__RADAR_TEST_TED_FETCH__;
    delete globalThis.__RADAR_TEST_FIND_TENDER_FETCH__;
    delete globalThis.__RADAR_TEST_CONTRACTS_FINDER_FETCH__;
    delete globalThis.__3DSK_RADAR_SOURCE_RUN_STATE__;
    if (previousNetlify === undefined) delete globalThis.Netlify;
    else globalThis.Netlify = previousNetlify;
  });
}

function request(method, body = null, query = "") {
  return new Request(`https://radar.test/api/source-runs${query}`, {
    method,
    headers:{ authorization:"Bearer team-secret", "content-type":"application/json" },
    ...(body ? { body:JSON.stringify(body) } : {})
  });
}

async function handler() {
  return (await import(`../netlify/functions/source-runs.mjs?test=${Math.random()}`)).default;
}

test("source run START and CONTINUE are locked before network by default", async t => {
  installRuntime(t, { RADAR_INTERNAL_ACCESS_SECRET:"team-secret", RADAR_SOURCE_COLLECTION_ENABLED:"false" });
  let calls = 0;
  globalThis.__RADAR_TEST_TED_FETCH__ = async () => { calls += 1; throw new Error("must stay offline"); };
  const run = await handler();
  let response = await run(request("POST", { action:"START", profile_id:"FOCUSED", request_id:"request_locked1" }));
  assert.equal(response.status, 423);
  assert.equal((await response.json()).error.code, "SOURCE_COLLECTION_LOCKED");
  response = await run(request("POST", { action:"CONTINUE", run_id:"run_locked_01", operation_id:"operation_lock1" }));
  assert.equal(response.status, 423);
  assert.equal(calls, 0);
});

test("source run endpoint persists a zero-cost chunk and replays operation ids", async t => {
  installRuntime(t, {
    RADAR_INTERNAL_ACCESS_SECRET:"team-secret",
    RADAR_SOURCE_COLLECTION_ENABLED:"true",
    RADAR_SOURCE_COLLECTION_COOLDOWN_SECONDS:"0"
  });
  let calls = 0;
  globalThis.__RADAR_TEST_TED_FETCH__ = async () => { calls += 1; return Response.json(tedFixture); };
  const run = await handler();
  let response = await run(request("POST", { action:"START", profile_id:"FOCUSED", request_id:"request_http_01" }));
  assert.equal(response.status, 201);
  const started = await response.json();
  assert.equal(started.run.paid_execution, "LOCKED");
  assert.equal(started.openai_requests, 0);

  response = await run(request("POST", { action:"START", profile_id:"FOCUSED", request_id:"request_http_01" }));
  assert.equal((await response.json()).run.run_id, started.run.run_id);
  response = await run(request("POST", { action:"CONTINUE", run_id:started.run.run_id, operation_id:"operation_http1" }));
  const continued = await response.json();
  assert.equal(response.status, 200);
  assert.equal(calls, 4);
  assert.equal(continued.run.counters.list_pages_fetched, 4);
  assert.equal(continued.run.counters.openai_requests, 0);
  assert.equal(continued.run.counters.cost_usd, 0);

  response = await run(request("POST", { action:"CONTINUE", run_id:started.run.run_id, operation_id:"operation_http1" }));
  assert.equal((await response.json()).replayed, true);
  assert.equal(calls, 4);

  response = await run(request("GET", null, `?run_id=${started.run.run_id}`));
  const snapshot = await response.json();
  assert.equal(snapshot.run.run_id, started.run.run_id);
  assert.equal(snapshot.candidate_count, 2);
  assert.equal(snapshot.openai_requests, 0);
  assert.equal(await globalThis.__RADAR_TEST_STATE_REPOSITORY__.listOpportunities().then((items) => items.length), 0);
});

test("CANCEL remains available after the collection gate is switched off", async t => {
  const values = { RADAR_INTERNAL_ACCESS_SECRET:"team-secret", RADAR_SOURCE_COLLECTION_ENABLED:"true" };
  installRuntime(t, values);
  const run = await handler();
  let response = await run(request("POST", { action:"START", profile_id:"FOCUSED", request_id:"request_cancel_http" }));
  const started = await response.json();
  values.RADAR_SOURCE_COLLECTION_ENABLED = "false";
  response = await run(request("POST", { action:"CANCEL", run_id:started.run.run_id, operation_id:"operation_cancel_http" }));
  const cancelled = await response.json();
  assert.equal(response.status, 200);
  assert.equal(cancelled.run.status, "CANCELLED");
});
