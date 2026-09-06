import test from "node:test";
import assert from "node:assert/strict";
import {
  PRODUCTION_SEARCH_MODEL,
  productionSearchConfiguration,
  productionSearchState
} from "../src/server/production-search-policy.mjs";

const configured = (overrides = {}) => (key) => ({
  RADAR_LIVE_AI_ENABLED:"true",
  RADAR_PRODUCTION_SEARCH_ENABLED:"true",
  RADAR_PRODUCTION_SEARCH_MAX_USD:"0.50",
  RADAR_PRODUCTION_SEARCH_MAX_RESULTS:"6",
  ...overrides
})[key] || "";

test("production search identity is server-owned and fixed to one UTC daily window", () => {
  const config = productionSearchConfiguration({
    getEnv:configured(),
    nowIso:"2026-09-06T23:59:59.999Z"
  });
  assert.equal(config.ok, true);
  assert.equal(config.run_id, "prod-search-20260906");
  assert.equal(config.operation_id, "daily-focused-search");
  assert.equal(config.reservation_id, "daily-focused-budget");
  assert.equal(config.window_utc, "2026-09-06");
  assert.equal(config.cap_microusd, 500_000);
  assert.equal(config.max_results, 6);
  assert.equal(config.model, PRODUCTION_SEARCH_MODEL);
  assert.equal(config.allow_structured_retry, false);
  assert.equal(config.max_tool_calls, 3);
});

test("production search configuration fails closed above the hard cap or without exact bounds", () => {
  for (const overrides of [
    { RADAR_PRODUCTION_SEARCH_MAX_USD:"0.51" },
    { RADAR_PRODUCTION_SEARCH_MAX_USD:"0.49" },
    { RADAR_PRODUCTION_SEARCH_MAX_USD:"" },
    { RADAR_PRODUCTION_SEARCH_MAX_RESULTS:"7" },
    { RADAR_PRODUCTION_SEARCH_MAX_RESULTS:"" }
  ]) {
    assert.equal(productionSearchConfiguration({ getEnv:configured(overrides), nowIso:"2026-09-06T10:00:00.000Z" }).ok, false);
  }
});

test("health reports production search ready only with both gates, exact config and production context", () => {
  assert.equal(productionSearchState({ context:{deploy:{context:"production"}}, getEnv:configured() }), "READY");
  assert.equal(productionSearchState({ context:{deploy:{context:"deploy-preview"}}, getEnv:configured() }), "CONTEXT_BLOCKED");
  assert.equal(productionSearchState({ context:{deploy:{context:"production"}}, getEnv:configured({RADAR_LIVE_AI_ENABLED:"false"}) }), "LOCKED");
  assert.equal(productionSearchState({ context:{deploy:{context:"production"}}, getEnv:configured({RADAR_PRODUCTION_SEARCH_ENABLED:"false"}) }), "LOCKED");
  assert.equal(productionSearchState({ context:{deploy:{context:"production"}}, getEnv:configured({RADAR_PRODUCTION_SEARCH_MAX_USD:"1.00"}) }), "CONFIG_BLOCKED");
});
