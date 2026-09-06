import test from "node:test";
import assert from "node:assert/strict";
import {
  PRODUCTION_SEARCH_MODEL,
  PRODUCTION_WIDE_SEARCH_MAX_CAP_MICROUSD,
  PRODUCTION_WIDE_V3_MAX_CAP_MICROUSD,
  PRODUCTION_WIDE_V3_MODEL,
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
  assert.equal(config.openai_request_limit, 1);
  assert.equal(config.search_profile, "FOCUSED");
});

test("wide-index profile has exact two-dollar and five-shard server-owned boundaries", () => {
  const config = productionSearchConfiguration({
    getEnv:configured({
      RADAR_PRODUCTION_SEARCH_PROFILE:"WIDE_INDEX",
      RADAR_PRODUCTION_SEARCH_MAX_USD:"2.00",
      RADAR_PRODUCTION_SEARCH_MAX_RESULTS:"24"
    }),
    nowIso:"2026-09-07T00:00:01.000Z"
  });
  assert.equal(config.ok, true);
  assert.equal(config.mode, "PRODUCTION_DAILY_WIDE_INDEX");
  assert.equal(config.search_profile, "WIDE_INDEX");
  assert.equal(config.cap_microusd, PRODUCTION_WIDE_SEARCH_MAX_CAP_MICROUSD);
  assert.equal(config.max_results, 24);
  assert.equal(config.openai_request_limit, 5);
  assert.equal(config.max_tool_calls, 15);
  assert.equal(config.max_tool_calls_per_request, 3);
  assert.equal(config.shards.length, 5);
  assert.equal(config.firecrawl_enabled, false);
  assert.equal(config.run_id, "prod-wide-index-search-20260907");
  assert.notEqual(config.run_id, productionSearchConfiguration({
    getEnv:configured(),
    nowIso:"2026-09-07T00:00:01.000Z"
  }).run_id);
});

test("Firecrawl WIDE v2 requires the exact 26-credit no-retry boundary", () => {
  const config = productionSearchConfiguration({
    getEnv:configured({
      RADAR_PRODUCTION_SEARCH_PROFILE:"WIDE_INDEX",
      RADAR_PRODUCTION_SEARCH_MAX_USD:"2.00",
      RADAR_PRODUCTION_SEARCH_MAX_RESULTS:"24",
      RADAR_FIRECRAWL_WIDE_ENABLED:"true",
      RADAR_FIRECRAWL_MAX_CREDITS:"26"
    }),
    nowIso:"2026-09-06T10:00:00.000Z"
  });
  assert.equal(config.ok, true);
  assert.equal(config.firecrawl_enabled, true);
  assert.equal(config.firecrawl_request_limit, 5);
  assert.equal(config.firecrawl_credit_cap, 26);
  assert.equal(productionSearchConfiguration({
    getEnv:configured({
      RADAR_PRODUCTION_SEARCH_PROFILE:"WIDE_INDEX",
      RADAR_PRODUCTION_SEARCH_MAX_USD:"2.00",
      RADAR_PRODUCTION_SEARCH_MAX_RESULTS:"24",
      RADAR_FIRECRAWL_WIDE_ENABLED:"true",
      RADAR_FIRECRAWL_MAX_CREDITS:"27"
    }),
    nowIso:"2026-09-06T10:00:00.000Z"
  }).ok, false);
});

test("WIDE V3 uses eight Sol shards, four official API slots and a distinct daily identity", () => {
  const config = productionSearchConfiguration({
    getEnv:configured({
      RADAR_PRODUCTION_SEARCH_PROFILE:"WIDE_V3",
      RADAR_PRODUCTION_SEARCH_MAX_USD:"3.00",
      RADAR_PRODUCTION_SEARCH_MAX_RESULTS:"32",
      RADAR_OFFICIAL_SOURCE_DISCOVERY_ENABLED:"true",
      RADAR_OFFICIAL_SOURCE_MAX_REQUESTS:"4",
      RADAR_BLUESKY_SEARCH_ENABLED:"true"
    }),
    nowIso:"2026-09-07T01:00:00.000Z"
  });
  assert.equal(config.ok, true);
  assert.equal(config.mode, "PRODUCTION_DAILY_WIDE_V3");
  assert.equal(config.search_profile, "WIDE_V3");
  assert.equal(config.model, PRODUCTION_WIDE_V3_MODEL);
  assert.equal(config.cap_microusd, PRODUCTION_WIDE_V3_MAX_CAP_MICROUSD);
  assert.equal(config.max_results, 32);
  assert.equal(config.openai_request_limit, 8);
  assert.equal(config.max_tool_calls, 24);
  assert.equal(config.shards.length, 8);
  assert.equal(config.official_sources_enabled, true);
  assert.equal(config.official_source_request_limit, 4);
  assert.equal(config.run_id, "prod-wide-v3-search-20260907");
  assert.equal(config.operation_id, "daily-wide-v3-search");
});

test("WIDE V3 official discovery fails closed without an exact cap and ready connector", () => {
  for (const overrides of [
    {},
    { RADAR_OFFICIAL_SOURCE_MAX_REQUESTS:"3", RADAR_BLUESKY_SEARCH_ENABLED:"true" },
    { RADAR_OFFICIAL_SOURCE_MAX_REQUESTS:"4" }
  ]) {
    assert.equal(productionSearchConfiguration({
      getEnv:configured({
        RADAR_PRODUCTION_SEARCH_PROFILE:"WIDE_V3",
        RADAR_PRODUCTION_SEARCH_MAX_USD:"3.00",
        RADAR_PRODUCTION_SEARCH_MAX_RESULTS:"32",
        RADAR_OFFICIAL_SOURCE_DISCOVERY_ENABLED:"true",
        ...overrides
      }),
      nowIso:"2026-09-07T01:00:00.000Z"
    }).ok, false);
  }
});

test("explicit server-owned WIDE recovery slot has a distinct one-time coordinator identity", () => {
  const config = productionSearchConfiguration({
    getEnv:configured({
      RADAR_PRODUCTION_SEARCH_PROFILE:"WIDE_INDEX",
      RADAR_PRODUCTION_SEARCH_MAX_USD:"2.00",
      RADAR_PRODUCTION_SEARCH_MAX_RESULTS:"24",
      RADAR_PRODUCTION_SEARCH_WIDE_RECOVERY_SLOT:"2"
    }),
    nowIso:"2026-09-06T18:00:00.000Z"
  });
  assert.equal(config.ok, true);
  assert.equal(config.mode, "PRODUCTION_APPROVED_WIDE_RECOVERY");
  assert.equal(config.run_id, "prod-wide-index-search-20260906-recovery-2");
  assert.equal(config.operation_id, "approved-wide-recovery-2");
  assert.equal(config.reservation_id, "approved-wide-recovery-budget-2");
  assert.equal(config.cap_microusd, PRODUCTION_WIDE_SEARCH_MAX_CAP_MICROUSD);
  assert.equal(config.openai_request_limit, 5);
  assert.equal(config.max_tool_calls, 15);
});

test("production search configuration fails closed above the hard cap or without exact bounds", () => {
  for (const overrides of [
    { RADAR_PRODUCTION_SEARCH_MAX_USD:"0.51" },
    { RADAR_PRODUCTION_SEARCH_MAX_USD:"0.49" },
    { RADAR_PRODUCTION_SEARCH_MAX_USD:"" },
    { RADAR_PRODUCTION_SEARCH_MAX_RESULTS:"7" },
    { RADAR_PRODUCTION_SEARCH_MAX_RESULTS:"" },
    { RADAR_PRODUCTION_SEARCH_PROFILE:"UNKNOWN" }
  ]) {
    assert.equal(productionSearchConfiguration({ getEnv:configured(overrides), nowIso:"2026-09-06T10:00:00.000Z" }).ok, false);
  }
});

test("wide-index configuration fails closed unless both wide bounds are exact", () => {
  for (const overrides of [
    { RADAR_PRODUCTION_SEARCH_MAX_USD:"1.99", RADAR_PRODUCTION_SEARCH_MAX_RESULTS:"24" },
    { RADAR_PRODUCTION_SEARCH_MAX_USD:"2.00", RADAR_PRODUCTION_SEARCH_MAX_RESULTS:"25" },
    { RADAR_PRODUCTION_SEARCH_MAX_USD:"2.00", RADAR_PRODUCTION_SEARCH_MAX_RESULTS:"6" }
  ]) {
    assert.equal(productionSearchConfiguration({
      getEnv:configured({ RADAR_PRODUCTION_SEARCH_PROFILE:"WIDE_INDEX", ...overrides }),
      nowIso:"2026-09-07T10:00:00.000Z"
    }).ok, false);
  }
});

test("recovery slot fails closed outside WIDE or for spent/unsupported slot values", () => {
  for (const overrides of [
    { RADAR_PRODUCTION_SEARCH_WIDE_RECOVERY_SLOT:"1" },
    {
      RADAR_PRODUCTION_SEARCH_PROFILE:"WIDE_INDEX",
      RADAR_PRODUCTION_SEARCH_MAX_USD:"2.00",
      RADAR_PRODUCTION_SEARCH_MAX_RESULTS:"24",
      RADAR_PRODUCTION_SEARCH_WIDE_RECOVERY_SLOT:"1"
    },
    {
      RADAR_PRODUCTION_SEARCH_PROFILE:"WIDE_INDEX",
      RADAR_PRODUCTION_SEARCH_MAX_USD:"2.00",
      RADAR_PRODUCTION_SEARCH_MAX_RESULTS:"24",
      RADAR_PRODUCTION_SEARCH_WIDE_RECOVERY_SLOT:"retry"
    }
  ]) {
    assert.equal(productionSearchConfiguration({
      getEnv:configured(overrides),
      nowIso:"2026-09-06T18:00:00.000Z"
    }).ok, false);
  }
});

test("health reports production search ready only with both gates, exact config and production context", () => {
  assert.equal(productionSearchState({ context:{deploy:{context:"production"}}, getEnv:configured() }), "READY");
  assert.equal(productionSearchState({ context:{deploy:{context:"deploy-preview"}}, getEnv:configured() }), "CONTEXT_BLOCKED");
  assert.equal(productionSearchState({ context:{deploy:{context:"production"}}, getEnv:configured({RADAR_LIVE_AI_ENABLED:"false"}) }), "LOCKED");
  assert.equal(productionSearchState({ context:{deploy:{context:"production"}}, getEnv:configured({RADAR_PRODUCTION_SEARCH_ENABLED:"false"}) }), "LOCKED");
  assert.equal(productionSearchState({ context:{deploy:{context:"production"}}, getEnv:configured({RADAR_PRODUCTION_SEARCH_MAX_USD:"1.00"}) }), "CONFIG_BLOCKED");
});
