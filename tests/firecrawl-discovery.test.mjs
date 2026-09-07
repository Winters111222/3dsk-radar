import test from "node:test";
import assert from "node:assert/strict";
import {
  FIRECRAWL_MAX_CREDITS,
  FIRECRAWL_MAX_REQUESTS,
  FIRECRAWL_SEARCH_URL,
  buildFirecrawlSearchRequest,
  callFirecrawlSearch,
  runFirecrawlWideDiscovery
} from "../src/server/firecrawl-discovery.mjs";
import { WIDE_SEARCH_SHARDS } from "../src/server/wide-search-plan.mjs";

const ATS_URL = "https://workwithindies.com/careers/example-studio-character-artist";
const TENDER_URL = "https://ted.europa.eu/en/notice/-/detail/123456-2026";

function payload({ id, credits, url, rendered = false, challenge = false } = {}) {
  return {
    success:true,
    id,
    creditsUsed:credits,
    data:{web:[{
      url,
      title:"Character production contract",
      description:"Current external character production contract.",
      ...(rendered ? {
        markdown:challenge ? "Verify you are human. CAPTCHA challenge. ".repeat(8) : "Current contract role for an external character production partner. ".repeat(8),
        metadata:{statusCode:200}
      } : {})
    }]}
  };
}

test("Firecrawl requests are five fixed domain-bounded 30-day searches", () => {
  const requests = WIDE_SEARCH_SHARDS.map(buildFirecrawlSearchRequest);
  assert.equal(requests.length, FIRECRAWL_MAX_REQUESTS);
  assert.equal(requests.reduce((sum, item) => sum + item.predicted_max_credits, 0), FIRECRAWL_MAX_CREDITS);
  assert.equal(requests.every((item) => item.body.limit === 8 && item.body.tbs === "qdr:m"), true);
  assert.equal(requests.every((item) => !item.body.includeDomains.includes("linkedin.com")), true);
  assert.equal(requests[0].body.scrapeOptions, undefined);
  assert.deepEqual(requests[2].body.scrapeOptions.formats, ["markdown"]);
  assert.equal(requests[2].body.includeDomains.includes("upwork.com"), false);
});

test("Firecrawl secret is sent only in the Authorization header", async () => {
  let seen;
  const fakeFetch = async (url, init) => {
    seen = {url, init};
    return new Response(JSON.stringify(payload({id:"fc-1",credits:2,url:ATS_URL})), {status:200});
  };
  await callFirecrawlSearch({apiKey:"fc-secret-test",body:{query:"test"},fetchImpl:fakeFetch});
  assert.equal(seen.url, FIRECRAWL_SEARCH_URL);
  assert.equal(seen.init.headers.authorization, "Bearer fc-secret-test");
  assert.equal(seen.init.body.includes("fc-secret-test"), false);
});

test("wide discovery renders only reviewed public domains and rejects challenge pages", async () => {
  const calls = [];
  const fakeFetch = async (_url, init) => {
    const body = JSON.parse(init.body);
    calls.push(body);
    const rendered = Boolean(body.scrapeOptions);
    const url = body.includeDomains.includes("ted.europa.eu") ? TENDER_URL : ATS_URL;
    return new Response(JSON.stringify(payload({
      id:`fc-${calls.length}`,
      credits:rendered ? 2 + body.limit : 2,
      url,
      rendered,
      challenge:calls.length === 4
    })), {status:200});
  };
  const result = await runFirecrawlWideDiscovery({apiKey:"fake",shards:WIDE_SEARCH_SHARDS,fetchImpl:fakeFetch});
  assert.equal(calls.length, FIRECRAWL_MAX_REQUESTS);
  assert.equal(result.requests, FIRECRAWL_MAX_REQUESTS);
  assert.equal(result.credits_used, FIRECRAWL_MAX_CREDITS);
  assert.equal(result.status, "COMPLETE");
  assert.equal(result.verified_urls.includes(ATS_URL), true);
  assert.equal(result.verified_urls.includes(TENDER_URL), false);
  assert.equal(result.shards[3].rendered_pages, 0);
});

test("a failed Firecrawl shard is recorded once without retry", async () => {
  let calls = 0;
  const fakeFetch = async (_url, init) => {
    calls += 1;
    if (calls === 2) return new Response(JSON.stringify({success:false}), {status:429});
    const body = JSON.parse(init.body);
    return new Response(JSON.stringify(payload({id:`fc-${calls}`,credits:body.scrapeOptions ? 10 : 2,url:body.includeDomains.includes("ted.europa.eu") ? TENDER_URL : ATS_URL,rendered:Boolean(body.scrapeOptions)})), {status:200});
  };
  const result = await runFirecrawlWideDiscovery({apiKey:"fake",shards:WIDE_SEARCH_SHARDS,fetchImpl:fakeFetch});
  assert.equal(calls, FIRECRAWL_MAX_REQUESTS);
  assert.equal(result.status, "PARTIAL");
  assert.equal(result.shards[1].status, "FAILED");
  assert.equal(result.shards[1].error_code, "FIRECRAWL_HTTP_429");
});
