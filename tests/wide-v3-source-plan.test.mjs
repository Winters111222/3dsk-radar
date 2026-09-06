import test from "node:test";
import assert from "node:assert/strict";
import {
  sourceConnectorReadiness,
  validateWideV3Plan,
  WIDE_V3_MAX_HOSTED_SEARCH_CALLS,
  WIDE_V3_MAX_OPENAI_REQUESTS,
  WIDE_V3_SEARCH_SHARDS,
  WIDE_V3_SOURCE_CONNECTORS,
  wideV3FirecrawlShards
} from "../src/server/wide-v3-source-plan.mjs";

test("WIDE V3 splits discovery into eight bounded source groups", () => {
  assert.equal(validateWideV3Plan(), true);
  assert.equal(WIDE_V3_SEARCH_SHARDS.length, 8);
  assert.equal(WIDE_V3_MAX_OPENAI_REQUESTS, 8);
  assert.equal(WIDE_V3_MAX_HOSTED_SEARCH_CALLS, 24);
  const social = WIDE_V3_SEARCH_SHARDS.find((item) => item.id === "social_signals");
  assert.deepEqual(social.signal_only_domains, ["linkedin.com", "bsky.app", "mastodon.social", "x.com"]);
  assert.equal(social.allowed_domains.includes("reddit.com"), true);
  assert.equal(social.allowed_domains.includes("greenhouse.io"), true);
  assert.equal(wideV3FirecrawlShards().length, 5);
});

test("connector readiness is fail-closed and never reports secret values", () => {
  const env = new Map([
    ["RADAR_BLUESKY_SEARCH_ENABLED", "true"],
    ["RADAR_UPWORK_API_ENABLED", "true"],
    ["UPWORK_OAUTH_ACCESS_TOKEN", "secret-token"]
  ]);
  const result = sourceConnectorReadiness((key) => env.get(key));
  assert.equal(result.length, WIDE_V3_SOURCE_CONNECTORS.length);
  assert.equal(result.find((item) => item.id === "bluesky_public").status, "CONFIG_READY");
  assert.deepEqual(result.find((item) => item.id === "upwork_official").missing_configuration, ["UPWORK_API_TENANT_ID"]);
  assert.equal(JSON.stringify(result).includes("secret-token"), false);
  assert.equal(result.find((item) => item.id === "x_official").status, "LOCKED");
  assert.equal(result.find((item) => item.id === "x_official").paid, true);
});

test("invalid WIDE V3 plans and signal domains fail validation", () => {
  assert.equal(validateWideV3Plan([]), false);
  const invalid = WIDE_V3_SEARCH_SHARDS.map((item, index) => index === 5
    ? { ...item, signal_only_domains:["evil.example"] }
    : item);
  assert.equal(validateWideV3Plan(invalid), false);
});
