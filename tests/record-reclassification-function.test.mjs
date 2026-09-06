import test from "node:test";
import assert from "node:assert/strict";
import { PRODUCTION_RECORD_RECLASSIFICATION } from "../src/server/record-reclassification.mjs";

function request(body, secret = "secret") {
  return new Request("https://radar.test/api/record-reclassification", {
    method:"POST",
    headers:{authorization:`Bearer ${secret}`,"content-type":"application/json"},
    body:JSON.stringify(body)
  });
}

function approvedBody() {
  return {
    migration_id:PRODUCTION_RECORD_RECLASSIFICATION.migration_id,
    confirmation:PRODUCTION_RECORD_RECLASSIFICATION.confirmation,
    expected_preflight_digest:PRODUCTION_RECORD_RECLASSIFICATION.expected_preflight_digest
  };
}

async function handler(tag) {
  return (await import(`../netlify/functions/record-reclassification.mjs?${tag}=${Date.now()}`)).default;
}

function install(repository) {
  globalThis.Netlify = {env:{get:(key) => key === "RADAR_INTERNAL_ACCESS_SECRET" ? "secret" : ""}};
  globalThis.__RADAR_TEST_STATE_REPOSITORY__ = repository;
}

function cleanup() {
  delete globalThis.Netlify;
  delete globalThis.__RADAR_TEST_STATE_REPOSITORY__;
}

test("reclassification endpoint is auth-first and production-only", async () => {
  let calls = 0;
  install({runRecordReclassification:async () => { calls += 1; }});
  try {
    const run = await handler("guards");
    assert.equal((await run(request(approvedBody(), "wrong"), {deploy:{context:"production"}})).status, 401);
    assert.equal((await run(request(approvedBody()), {deploy:{context:"deploy-preview"}})).status, 409);
    assert.equal(calls, 0);
  } finally { cleanup(); }
});

test("reclassification endpoint requires the exact three-part confirmation", async () => {
  let calls = 0;
  install({runRecordReclassification:async () => { calls += 1; }});
  try {
    const run = await handler("confirmation");
    const response = await run(request({...approvedBody(),confirmation:"wrong"}), {deploy:{context:"production"}});
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, "RECLASSIFICATION_CONFIRMATION_INVALID");
    assert.equal(calls, 0);
  } finally { cleanup(); }
});

test("reclassification endpoint returns only sanitized verified counters", async () => {
  install({runRecordReclassification:async () => ({
    migration_id:PRODUCTION_RECORD_RECLASSIFICATION.migration_id,
    mode:"APPLIED",
    input_record_count:7,
    records_written:4,
    snapshot_writes:1,
    readback_verified:true,
    counts:{sales_opportunities:3,competitors:3,source_platforms:1,manual_review:0}
  })});
  try {
    const run = await handler("success");
    const response = await run(request(approvedBody()), {deploy:{context:"production"}});
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.records_written, 4);
    assert.equal(payload.readback_verified, true);
    assert.equal(JSON.stringify(payload).includes("company"), false);
  } finally { cleanup(); }
});
