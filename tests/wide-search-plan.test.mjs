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
  assert.deepEqual(WIDE_SEARCH_SHARDS.map((item) => item.id), [
    "human_data_capture_worldwide",
    "scan_postproduction_worldwide",
    "character_vendor_pipeline",
    "cultural_heritage_cz_sk",
    "worldwide_multilingual_buyer_sweep"
  ]);
  const heritage = WIDE_SEARCH_SHARDS.find((item) => item.id === "cultural_heritage_cz_sk");
  assert.deepEqual(heritage.allowed_domains, [
    "ted.europa.eu", "nen.nipez.cz", "zakazky.gov.cz", "zakazky.krajbezkorupce.cz",
    "zakazky.kr-stredocesky.cz", "uvo.gov.sk", "josephine.proebiz.com", "mk.gov.cz",
    "fpu.sk", "culture.gov.sk", "eeagrants.org"
  ]);
  assert.match(heritage.focus, /never OPEN_OPPORTUNITY/);
  assert.match(heritage.focus, /only in Czechia or Slovakia/);
  assert.doesNotMatch(JSON.stringify(WIDE_SEARCH_SHARDS), /ordinary employee roles.*POTENTIAL_LEAD/i);
});
