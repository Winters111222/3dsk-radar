import test from "node:test";
import assert from "node:assert/strict";
import { INDEX_DISCOVERY_ALLOWED_DOMAINS } from "../src/server/index-discovery.mjs";
import {
  WIDE_MAX_MAX_CONCURRENCY,
  WIDE_MAX_OPENAI_REQUEST_LIMIT,
  WIDE_MAX_RESULTS_PER_SHARD,
  WIDE_MAX_SEARCH_SHARDS,
  WIDE_MAX_TOOL_CALLS_PER_SHARD,
  WIDE_MAX_TOTAL_TOOL_CALL_LIMIT,
  validateWideMaxPlan
} from "../src/server/wide-max-search-plan.mjs";

test("WIDE_MAX has 25 distinct buyer-focused shards and exact 5x discovery boundaries", () => {
  assert.equal(validateWideMaxPlan(), true);
  assert.equal(WIDE_MAX_SEARCH_SHARDS.length, 25);
  assert.equal(WIDE_MAX_OPENAI_REQUEST_LIMIT, 25);
  assert.equal(WIDE_MAX_TOOL_CALLS_PER_SHARD, 3);
  assert.equal(WIDE_MAX_TOTAL_TOOL_CALL_LIMIT, 75);
  assert.equal(WIDE_MAX_RESULTS_PER_SHARD, 6);
  assert.equal(WIDE_MAX_MAX_CONCURRENCY, 5);
  assert.equal(new Set(WIDE_MAX_SEARCH_SHARDS.map((item) => item.id)).size, 25);
});

test("WIDE_MAX covers every accepted hosted-index domain without LinkedIn", () => {
  const planned = new Set(WIDE_MAX_SEARCH_SHARDS.flatMap((item) => item.allowed_domains));
  assert.deepEqual([...INDEX_DISCOVERY_ALLOWED_DOMAINS].sort(), [...planned].sort());
  assert.equal(planned.has("linkedin.com"), false);
  assert.equal(WIDE_MAX_SEARCH_SHARDS.filter((item) => /heritage/i.test(item.id)).length >= 4, true);
  assert.equal(WIDE_MAX_SEARCH_SHARDS.filter((item) => /human|casting/i.test(item.id)).length >= 5, true);
  assert.equal(WIDE_MAX_SEARCH_SHARDS.every((item) => /Reject|reject|irrelevant|omit/i.test(item.focus)), true);
});

test("WIDE_MAX plan validation fails closed on missing, duplicate or extra shards", () => {
  assert.equal(validateWideMaxPlan(WIDE_MAX_SEARCH_SHARDS.slice(0, 24)), false);
  assert.equal(validateWideMaxPlan([...WIDE_MAX_SEARCH_SHARDS, WIDE_MAX_SEARCH_SHARDS[0]]), false);
  assert.equal(validateWideMaxPlan(WIDE_MAX_SEARCH_SHARDS.map((item, index) => index === 24 ? { ...item, id:WIDE_MAX_SEARCH_SHARDS[0].id } : item)), false);
});
