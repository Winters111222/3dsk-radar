import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { addUsage, countWebSearchCalls, estimateSearchCost } from "../src/server/search-cost.mjs";

const index = await readFile(new URL("../index.html", import.meta.url), "utf8");
const panel = await readFile(new URL("../src/search-cost-panel.js", import.meta.url), "utf8");
const searchFunction = await readFile(new URL("../netlify/functions/search.mjs", import.meta.url), "utf8");

test("Luna search cost includes web-search fee plus uncached, cached and output tokens", () => {
  const cost = estimateSearchCost({
    model: "gpt-5.6-luna",
    webSearchCalls: 1,
    usage: {
      input_tokens: 10000,
      input_tokens_details: { cached_tokens: 2000 },
      output_tokens: 1000
    }
  });
  assert.equal(cost.total_usd, 0.01284);
  assert.equal(cost.web_search_usd, 0.01);
  assert.equal(cost.token_usd, 0.00284);
  assert.equal(cost.total_tokens, 11000);
  assert.equal(cost.is_estimate, true);
});

test("retry usage and tool calls can be accumulated without hiding first-attempt cost", () => {
  const total = addUsage(
    { input_tokens: 100, input_tokens_details: { cached_tokens: 20 }, output_tokens: 30 },
    { input_tokens: 200, input_tokens_details: { cached_tokens: 50 }, output_tokens: 40 }
  );
  assert.deepEqual(total, {
    input_tokens: 300,
    output_tokens: 70,
    total_tokens: 370,
    input_tokens_details: { cached_tokens: 70 }
  });
  assert.equal(countWebSearchCalls({ output: [{ type: "web_search_call" }, { type: "message" }, { type: "web_search_call" }] }), 2);
});

test("unknown model pricing fails closed instead of inventing a dollar estimate", () => {
  assert.equal(estimateSearchCost({ model: "unknown-model", usage: { input_tokens: 1 }, webSearchCalls: 1 }), null);
});

test("search API exposes estimated cost metadata and the frontend renders a dedicated cost panel", () => {
  assert.match(searchFunction, /estimated_cost_usd/);
  assert.match(searchFunction, /cost_breakdown/);
  assert.match(searchFunction, /web_search_call_count/);
  assert.match(index, /search-cost-panel\.js/);
  assert.match(panel, /LAST SEARCH COST/);
  assert.match(panel, /EST\. COST/);
  assert.match(panel, /Final invoice may vary/);
  assert.match(panel, /\$0\.0000/);
});
