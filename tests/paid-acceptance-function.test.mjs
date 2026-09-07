import test from "node:test";
import assert from "node:assert/strict";
import handler from "../netlify/functions/paid-coordinator-acceptance.mjs";
import searchHandler from "../netlify/functions/search.mjs";
import { memoryPaidCoordinator } from "./helpers/memory-paid-coordinator.mjs";

const PREVIEW_CONTEXT = { deploy:{ context:"deploy-preview" } };

function installEnv(values) {
  const old = globalThis.Netlify;
  globalThis.Netlify = { env:{ get:(key) => values[key] } };
  return () => old === undefined ? delete globalThis.Netlify : (globalThis.Netlify = old);
}

test("deployed coordinator acceptance proves one concurrent claim and reservation winner without paid requests", async () => {
  const restore = installEnv({ RADAR_INTERNAL_ACCESS_SECRET:"team-secret", RADAR_PAID_ACCEPTANCE_ENABLED:"true" });
  globalThis.__RADAR_TEST_PAID_COORDINATOR__ = memoryPaidCoordinator();
  try {
    const response = await handler(new Request("https://radar.test/api/paid-coordinator-acceptance", {
      method:"POST",
      headers:{ authorization:"Bearer team-secret", "content-type":"application/json" },
      body:JSON.stringify({ test_id:"atomic-test-001" })
    }), PREVIEW_CONTEXT);
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.ok, true);
    assert.equal(payload.concurrent_claim_winners, 1);
    assert.equal(payload.concurrent_budget_winners, 1);
    assert.equal(payload.idempotent_settlement, true);
    assert.equal(payload.openai_requests, 0);
  } finally {
    delete globalThis.__RADAR_TEST_PAID_COORDINATOR__;
    restore();
  }
});

test("paid search rejects anything except the exact armed run and no-retry $0.50 boundary before OpenAI", async () => {
  const oldFetch = globalThis.fetch;
  let fetches = 0;
  globalThis.fetch = async () => { fetches += 1; throw new Error("must not fetch"); };
  const restore = installEnv({
    RADAR_INTERNAL_ACCESS_SECRET:"team-secret",
    RADAR_LIVE_AI_ENABLED:"false",
    RADAR_PAID_ACCEPTANCE_ENABLED:"true",
    RADAR_PAID_ACCEPTANCE_RUN_ID:"paid-run-exact-001",
    RADAR_PAID_ACCEPTANCE_MAX_USD:"0.50",
    OPENAI_API_KEY:"fake-test-key"
  });
  try {
    const response = await searchHandler(new Request("https://radar.test/api/search", {
      method:"POST",
      headers:{ authorization:"Bearer team-secret", "content-type":"application/json" },
      body:JSON.stringify({ run_id:"paid-run-exact-001", operation_id:"focused-search", max_cost_usd:0.50, no_retry:false })
    }), PREVIEW_CONTEXT);
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, "PAID_ACCEPTANCE_BOUNDARY_INVALID");
    assert.equal(fetches, 0);
  } finally {
    globalThis.fetch = oldFetch;
    restore();
  }
});

test("armed coordinator probe rejects production context before touching the database", async () => {
  const restore = installEnv({ RADAR_INTERNAL_ACCESS_SECRET:"team-secret", RADAR_PAID_ACCEPTANCE_ENABLED:"true" });
  let coordinatorCalls = 0;
  globalThis.__RADAR_TEST_PAID_COORDINATOR__ = {
    readiness: { provider:"NETLIFY_DATABASE", contract_version:1, concurrency_safe:true, unique_operation_identity:true, durable_budget_reservation:true, fencing:true, uncertainty_terminal:true },
    claimOperation:async () => { coordinatorCalls += 1; throw new Error("must not touch coordinator"); }
  };
  try {
    const response = await handler(new Request("https://radar.test/api/paid-coordinator-acceptance", {
      method:"POST",
      headers:{ authorization:"Bearer team-secret", "content-type":"application/json" },
      body:JSON.stringify({ test_id:"atomic-test-002" })
    }), { deploy:{ context:"production" } });
    assert.equal(response.status, 423);
    assert.equal((await response.json()).error.code, "PAID_ACCEPTANCE_PREVIEW_REQUIRED");
    assert.equal(coordinatorCalls, 0);
  } finally {
    delete globalThis.__RADAR_TEST_PAID_COORDINATOR__;
    restore();
  }
});
