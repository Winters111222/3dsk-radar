import test from "node:test";
import assert from "node:assert/strict";
import statusHandler from "../netlify/functions/search-status.mjs";
import { runBackgroundSearch } from "../netlify/functions/search-background.mjs";
import { productionSearchConfiguration } from "../src/server/production-search-policy.mjs";
import { memoryPaidCoordinator } from "./helpers/memory-paid-coordinator.mjs";

const PRODUCTION = { deploy:{ context:"production" } };

function installNetlifyEnv(values) {
  const old = globalThis.Netlify;
  globalThis.Netlify = { env:{ get:(key) => values[key] ?? undefined } };
  return () => {
    if (old === undefined) delete globalThis.Netlify;
    else globalThis.Netlify = old;
  };
}

function wideEnv() {
  return {
    RADAR_INTERNAL_ACCESS_SECRET:"team-secret",
    RADAR_LIVE_AI_ENABLED:"true",
    RADAR_PRODUCTION_SEARCH_ENABLED:"true",
    RADAR_PRODUCTION_SEARCH_PROFILE:"WIDE_INDEX",
    RADAR_PRODUCTION_SEARCH_MAX_USD:"2.00",
    RADAR_PRODUCTION_SEARCH_MAX_RESULTS:"24",
    OPENAI_API_KEY:"fake-test-key"
  };
}

function request(path, method = "GET") {
  return new Request(`https://radar.test${path}`, { method, headers:{ authorization:"Bearer team-secret", "content-type":"application/json" }, ...(method === "POST" ? { body:"{}" } : {}) });
}

test("background endpoint fails closed unless WIDE_INDEX is armed", async () => {
  const restore = installNetlifyEnv({ ...wideEnv(), RADAR_PRODUCTION_SEARCH_PROFILE:"FOCUSED", RADAR_PRODUCTION_SEARCH_MAX_USD:"0.50", RADAR_PRODUCTION_SEARCH_MAX_RESULTS:"6" });
  try {
    const response = await runBackgroundSearch(request("/api/search-background", "POST"), PRODUCTION);
    assert.equal(response.status, 423);
    assert.equal((await response.json()).error.code, "WIDE_BACKGROUND_NOT_ARMED");
  } finally {
    restore();
  }
});

test("search status reports not-started, running, and completed without dispatching", async () => {
  const restore = installNetlifyEnv(wideEnv());
  const coordinator = memoryPaidCoordinator({ capMicrousd:2_000_000 });
  globalThis.__RADAR_TEST_PAID_COORDINATOR__ = coordinator;
  try {
    const execution = productionSearchConfiguration();
    const initial = await statusHandler(request("/api/search-status"), PRODUCTION);
    assert.equal(initial.status, 200);
    assert.equal((await initial.json()).status, "NOT_STARTED");

    const claim = await coordinator.claimOperation(execution.run_id, execution.operation_id, 0);
    await coordinator.reserveBudget(execution.run_id, execution.reservation_id, execution.cap_microusd, claim.version);
    const running = await statusHandler(request("/api/search-status"), PRODUCTION);
    const runningPayload = await running.json();
    assert.equal(runningPayload.status, "RUNNING");
    assert.equal(runningPayload.retry_allowed, false);

    const settlement = await coordinator.settleBudget(execution.run_id, execution.reservation_id, 125_000, claim.fence_token);
    await coordinator.completeOperation(execution.run_id, execution.operation_id, { ok:true }, claim.fence_token);
    const completed = await statusHandler(request("/api/search-status"), PRODUCTION);
    const completedPayload = await completed.json();
    assert.equal(completedPayload.status, "COMPLETED");
    assert.equal(completedPayload.settled_usd, settlement.actual_microusd / 1_000_000);
    assert.equal(completedPayload.retry_allowed, false);
  } finally {
    delete globalThis.__RADAR_TEST_PAID_COORDINATOR__;
    restore();
  }
});

test("search status authenticates before reading coordinator state", async () => {
  const restore = installNetlifyEnv(wideEnv());
  globalThis.__RADAR_TEST_PAID_COORDINATOR__ = { readOperation() { throw new Error("must not read"); } };
  try {
    const response = await statusHandler(new Request("https://radar.test/api/search-status", { headers:{ authorization:"Bearer wrong-secret" } }), PRODUCTION);
    assert.equal(response.status, 401);
    assert.equal((await response.json()).error.code, "UNAUTHORIZED");
  } finally {
    delete globalThis.__RADAR_TEST_PAID_COORDINATOR__;
    restore();
  }
});
