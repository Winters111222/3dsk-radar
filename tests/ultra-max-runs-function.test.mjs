import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createStateRepository } from "../src/server/state-repository.mjs";
import { memoryStore } from "./helpers/memory-store.mjs";
import { ULTRA_MAX_PAID_CONFIRMATION } from "../src/server/ultra-max-paid-policy.mjs";

const tedFixture = JSON.parse(await readFile(new URL("../fixtures/collectors/ted-search-response.json", import.meta.url), "utf8"));

function install(t, overrides = {}) {
  const values = {
    RADAR_INTERNAL_ACCESS_SECRET:"team-secret",
    RADAR_ULTRA_MAX_ENABLED:"true",
    RADAR_SOURCE_COLLECTION_ENABLED:"true",
    ...overrides
  };
  globalThis.Netlify = {env:{get:(key) => values[key] || ""}};
  globalThis.__RADAR_TEST_STATE_REPOSITORY__ = createStateRepository(memoryStore());
  globalThis.__RADAR_TEST_NOW_ISO__ = "2026-09-08T16:00:00.000Z";
  globalThis.__RADAR_TEST_RUNTIME_ELIGIBLE_SOURCE_IDS__ = new Set(["ted_eu","find_tender_uk","contracts_finder_uk"]);
  t.after(() => {
    for (const key of ["Netlify","__RADAR_TEST_STATE_REPOSITORY__","__RADAR_TEST_NOW_ISO__","__RADAR_TEST_RUNTIME_ELIGIBLE_SOURCE_IDS__","__RADAR_TEST_TED_FETCH__"]) delete globalThis[key];
  });
  return values;
}

function request(method, body = null, query = "", token = "team-secret") {
  return new Request(`https://radar.test/api/ultra-max-runs${query}`, {
    method,
    headers:{authorization:`Bearer ${token}`,"content-type":"application/json"},
    ...(body ? {body:JSON.stringify(body)} : {})
  });
}

async function load(tag) {
  return (await import(`../netlify/functions/ultra-max-runs.mjs?${tag}=${Date.now()}`)).default;
}

test("ULTRA endpoint is auth-first and default-off before any source request", async t => {
  install(t, {RADAR_ULTRA_MAX_ENABLED:"false"});
  let calls = 0;
  globalThis.__RADAR_TEST_TED_FETCH__ = async () => { calls += 1; throw new Error("must stay offline"); };
  const handler = await load("locked");
  assert.equal((await handler(request("POST",{action:"START",request_id:"request_ultra_http"},"","wrong"),{})).status, 401);
  const locked = await handler(request("POST",{action:"START",request_id:"request_ultra_http"}),{});
  assert.equal(locked.status, 423);
  assert.equal((await locked.json()).error.code, "ULTRA_MAX_LOCKED");
  assert.equal(calls, 0);
});

test("START, CONTINUE_NATIVE, replay and GET preserve one bounded root run", async t => {
  install(t);
  let calls = 0;
  globalThis.__RADAR_TEST_TED_FETCH__ = async () => { calls += 1; return Response.json(tedFixture); };
  const handler = await load("flow");
  let response = await handler(request("POST",{action:"START",request_id:"request_ultra_http"}),{});
  assert.equal(response.status, 201);
  const started = await response.json();
  assert.equal(started.run.status, "READY");
  const operationId = started.next_operation.operation_id;
  response = await handler(request("POST",{action:"CONTINUE_NATIVE",run_id:started.run.run_id,operation_id:operationId}),{});
  const continued = await response.json();
  assert.equal(response.status, 200);
  assert.equal(continued.run.status, "PAUSED");
  assert.equal(continued.run.usage.source_requests, 4);
  assert.equal(calls, 4);
  response = await handler(request("POST",{action:"CONTINUE_NATIVE",run_id:started.run.run_id,operation_id:operationId}),{});
  assert.equal((await response.json()).replayed, true);
  assert.equal(calls, 4);
  response = await handler(request("GET",null,`?run_id=${started.run.run_id}`),{});
  assert.equal((await response.json()).run.run_id, started.run.run_id);
});

test("ULTRA advances to paid discovery without HTTP when no native source is qualified", async t => {
  const values = install(t);
  values.RADAR_SOURCE_COLLECTION_ENABLED = "false";
  globalThis.__RADAR_TEST_RUNTIME_ELIGIBLE_SOURCE_IDS__ = new Set();
  let calls = 0;
  globalThis.__RADAR_TEST_TED_FETCH__ = async () => { calls += 1; throw new Error("must stay offline"); };
  const handler = await load("paid-only-fallback");
  let response = await handler(request("POST",{action:"START",request_id:"request_ultra_paid_only"}),{});
  assert.equal(response.status,201);
  const started = await response.json();
  response = await handler(request("POST",{
    action:"CONTINUE_NATIVE",
    run_id:started.run.run_id,
    operation_id:started.next_operation.operation_id
  }),{});
  const continued = await response.json();
  assert.equal(response.status,200);
  assert.equal(continued.run.plan_snapshot.phases[0].status,"COMPLETED");
  assert.equal(continued.result.payload.child_status,"SKIPPED_NO_RUNTIME_ELIGIBLE_SOURCES");
  assert.equal(continued.next_operation.phase_id,"CORE_DISCOVERY");
  assert.equal(continued.run.usage.source_requests,0);
  assert.equal(calls,0);
});

test("a qualified native source still requires the independent collection gate", async t => {
  install(t,{RADAR_SOURCE_COLLECTION_ENABLED:"false"});
  let calls = 0;
  globalThis.__RADAR_TEST_TED_FETCH__ = async () => { calls += 1; throw new Error("must stay offline"); };
  const handler = await load("qualified-source-locked");
  const response = await handler(request("POST",{action:"START",request_id:"request_ultra_native_locked"}),{});
  assert.equal(response.status,423);
  assert.equal((await response.json()).error.code,"SOURCE_COLLECTION_LOCKED");
  assert.equal(calls,0);
});

test("CANCEL stays available after the ULTRA gate is disabled", async t => {
  const values = install(t);
  const handler = await load("cancel");
  const started = await (await handler(request("POST",{action:"START",request_id:"request_ultra_cancel"}),{})).json();
  values.RADAR_ULTRA_MAX_ENABLED = "false";
  const response = await handler(request("POST",{action:"CANCEL",run_id:started.run.run_id,operation_id:"operation_cancel_ultra"}),{});
  assert.equal(response.status, 200);
  assert.equal((await response.json()).run.status, "CANCELLED");
});

test("PREPARE_PAID reports the independent default-off gate before coordinator or search dispatch", async t => {
  install(t,{RADAR_ULTRA_MAX_PAID_ENABLED:"false",RADAR_LIVE_AI_ENABLED:"true",OPENAI_API_KEY:"test-key"});
  let calls=0;
  globalThis.__RADAR_TEST_ULTRA_SEARCH_RUNNER__=async()=>{calls+=1;throw new Error("must not dispatch");};
  t.after(()=>delete globalThis.__RADAR_TEST_ULTRA_SEARCH_RUNNER__);
  const handler=await load("paid-locked");
  const response=await handler(request("POST",{
    action:"PREPARE_PAID",
    run_id:"valid-run-id",
    phase_id:"CORE_DISCOVERY",
    operation_id:"valid-operation-id",
    paid_confirmation:ULTRA_MAX_PAID_CONFIRMATION
  }),{deploy:{context:"production"}});
  assert.equal(response.status,423);
  assert.equal((await response.json()).error.code,"ULTRA_MAX_PAID_LOCKED");
  assert.equal(calls,0);
});
