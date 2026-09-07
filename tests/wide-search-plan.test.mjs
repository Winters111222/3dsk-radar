import test from "node:test";
import assert from "node:assert/strict";
import { INDEX_DISCOVERY_ALLOWED_DOMAINS } from "../src/server/index-discovery.mjs";
import {
  WIDE_SEARCH_MAX_OPENAI_REQUESTS,
  WIDE_SEARCH_MAX_TOOL_CALLS_PER_SHARD,
  WIDE_SEARCH_MAX_TOTAL_TOOL_CALLS,
  WIDE_SEARCH_SHARDS,
  validateWideSearchPlan
} from "../src/server/wide-search-plan.mjs";

test("wide plan guarantees five distinct hosted-search coverage shards", () => {
  assert.equal(validateWideSearchPlan(), true);
  assert.equal(WIDE_SEARCH_SHARDS.length, 5);
  assert.equal(WIDE_SEARCH_MAX_OPENAI_REQUESTS, 5);
  assert.equal(WIDE_SEARCH_MAX_TOOL_CALLS_PER_SHARD, 3);
  assert.equal(WIDE_SEARCH_MAX_TOTAL_TOOL_CALLS, 15);
  assert.equal(new Set(WIDE_SEARCH_SHARDS.map((item) => item.id)).size, 5);
});

test("every accepted detail domain belongs to a required shard and LinkedIn is excluded", () => {
  const planned = new Set(WIDE_SEARCH_SHARDS.flatMap((item) => item.allowed_domains));
  assert.deepEqual([...INDEX_DISCOVERY_ALLOWED_DOMAINS].sort(), [...planned].sort());
  assert.equal(planned.has("linkedin.com"), false);
});
