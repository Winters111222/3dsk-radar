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
  assert.equal(result.find((item) => item.id === "x_official").runtime_available, false);
});

test("signal connector readiness includes the shared signed-ingest boundary", () => {
  const env = new Map([
    ["RADAR_TELEGRAM_SOURCE_ENABLED", "true"],
    ["TELEGRAM_SOURCE_BOT_TOKEN", "bot-secret"],
    ["TELEGRAM_SOURCE_ALLOWED_CHATS", "-100123"],
    ["RADAR_SOURCE_INGEST_SECRET", "ingest-secret"]
  ]);
  const blocked = sourceConnectorReadiness((key) => env.get(key)).find((item) => item.id === "telegram_authorized_channels");
  assert.equal(blocked.status, "CONFIG_REQUIRED");
  assert.deepEqual(blocked.missing_configuration, ["RADAR_SOURCE_SIGNAL_INGEST_ENABLED=true"]);
  env.set("RADAR_SOURCE_SIGNAL_INGEST_ENABLED", "true");
  const ready = sourceConnectorReadiness((key) => env.get(key)).find((item) => item.id === "telegram_authorized_channels");
  assert.equal(ready.status, "CONFIG_READY");
  assert.equal(JSON.stringify(ready).includes("bot-secret"), false);
});

test("X cannot report runtime ready before its separately approved adapter exists", () => {
  const env = (key) => ({ RADAR_X_SEARCH_ENABLED:"true", X_API_BEARER_TOKEN:"x-secret" })[key] || "";
  const result = sourceConnectorReadiness(env).find((item) => item.id === "x_official");
  assert.equal(result.status, "CONFIG_REQUIRED");
  assert.deepEqual(result.missing_configuration, ["OFFICIAL_SOURCE_ADAPTER_NOT_IMPLEMENTED"]);
});

test("invalid WIDE V3 plans and signal domains fail validation", () => {
  assert.equal(validateWideV3Plan([]), false);
  const invalid = WIDE_V3_SEARCH_SHARDS.map((item, index) => index === 5
    ? { ...item, signal_only_domains:["evil.example"] }
    : item);
  assert.equal(validateWideV3Plan(invalid), false);
});
