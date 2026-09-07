import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { callOpenAIResponses, runOpportunitySearch, runWideOpportunitySearch } from "../src/server/openai-search.mjs";
import { WIDE_SEARCH_SHARDS } from "../src/server/wide-search-plan.mjs";

const profile = JSON.parse(await readFile(new URL("../config/company-profile.public.json", import.meta.url), "utf8"));
const NOW = "2026-09-05T10:00:00.000Z";
const SOURCE = "https://www.upwork.com/freelance-jobs/apply/Human-Scan-Cleanup_~0123456789";

function validCandidate() {
  return {
    title:"Human scan cleanup vendor",
    company:"Buyer Studio",
    summary:"Public external vendor request for scan cleanup and basemesh conforming.",
    opportunity_kind:"OPEN_OPPORTUNITY",
    commercial_role:"BUYER",
    notice_status:"OPEN",
    studio_eligibility:"YES",
    eligibility_reason:"Worldwide external vendor request.",
    scope_fit:"CORE",
    categories:["SCAN_CLEANUP","WRAP_BASEMESH"],
    location:"Worldwide",
    remote_scope:"WORLDWIDE_VENDOR",
    published_date:"2026-09-05",
    source_updated_date:null,
    acceptance_source_url:null,
    source_url:SOURCE,
    apply_url:SOURCE,
    fit_score:93,
    win_score:82,
    budget_type:"UNKNOWN",
    budget_published:null,
    budget_estimated_min:null,
    budget_estimated_max:null,
    budget_currency:null,
    budget_confidence:null,
    budget_reason:"No public rate.",
    contact_name:null,
    contact_role:null,
    contact_email:null,
    contact_email_source:null,
    why_it_fits:["Direct scan cleanup match."],
    risks:[],
    missing_requirements:[],
    source_evidence:[{type:"PRIMARY_SOURCE",url:SOURCE,note:"Official request"}]
  };
}

function apiResponse(text, withSource = true) {
  return {
    id:"resp_test",
    model:"gpt-5.6-luna",
    usage:{input_tokens:10,output_tokens:10,total_tokens:20},
    output:[
      ...(withSource ? [{type:"web_search_call",action:{sources:[{url:SOURCE,title:"source"}]}}] : []),
      {type:"message",content:[{type:"output_text",text}]}
    ]
  };
}

test("raw OpenAI transport sends API key only in Authorization header", async () => {
  let seen;
  const fakeFetch = async (url, init) => {
    seen = {url, init};
    return new Response(JSON.stringify({ok:true}), {status:200,headers:{"content-type":"application/json"}});
  };
  await callOpenAIResponses({apiKey:"sk-test-not-real",body:{model:"x"},fetchImpl:fakeFetch,timeoutMs:1000});
  assert.equal(seen.url, "https://api.openai.com/v1/responses");
  assert.equal(seen.init.headers.authorization, "Bearer sk-test-not-real");
  assert.equal(seen.init.body.includes("sk-test-not-real"), false);
});

test("structured validation gets at most one safe retry", async () => {
  let calls = 0;
  const fakeFetch = async () => {
    calls += 1;
    const payload = calls === 1
      ? apiResponse(JSON.stringify({opportunities:[validCandidate()]}), false)
      : apiResponse(JSON.stringify({opportunities:[validCandidate()]}), true);
    return new Response(JSON.stringify(payload), {status:200,headers:{"content-type":"application/json"}});
  };
  const result = await runOpportunitySearch({apiKey:"fake",model:"gpt-5.6-luna",profile,nowIso:NOW,fetchImpl:fakeFetch});
  assert.equal(calls, 2);
  assert.equal(result.attempts, 2);
  assert.equal(result.opportunities.length, 1);
});

test("valid first response does not retry", async () => {
  let calls = 0;
  const fakeFetch = async () => {
    calls += 1;
    return new Response(JSON.stringify(apiResponse(JSON.stringify({opportunities:[validCandidate()]}))), {status:200,headers:{"content-type":"application/json"}});
  };
  const result = await runOpportunitySearch({apiKey:"fake",model:"gpt-5.6-luna",profile,nowIso:NOW,fetchImpl:fakeFetch});
  assert.equal(calls, 1);
  assert.equal(result.attempts, 1);
  assert.equal(result.discovery_mode, "INDEX_DISCOVERY_MANUAL_VERIFY");
  assert.equal(result.direct_source_requests, 0);
  assert.equal(result.opportunities[0].manual_verification_status, "REQUIRED_BEFORE_CONTACT");
  assert.equal(result.opportunities[0].discovery_source_id, "upwork");
});

test("wide search dispatches every required shard once and deduplicates their results", async () => {
  const sourceForFirstDomain = {
    "upwork.com":SOURCE,
    "reddit.com":"https://www.reddit.com/r/gameDevClassifieds/comments/abc123/hiring_character_artist/",
    "workwithindies.com":"https://workwithindies.com/careers/example-studio-character-artist",
    "ted.europa.eu":"https://ted.europa.eu/en/notice/-/detail/123456-2026"
  };
  const requests = [];
  const fakeFetch = async (_url, options) => {
    const request = JSON.parse(options.body);
    requests.push(request);
    const firstDomain = request.tools[0].filters.allowed_domains[0];
    const source = sourceForFirstDomain[firstDomain];
    const opportunities = firstDomain === "upwork.com" ? [validCandidate()] : [];
    return new Response(JSON.stringify({
      id:`resp_${requests.length}`,
      model:"gpt-5.6-luna",
      usage:{input_tokens:100,output_tokens:50,total_tokens:150},
      output:[
        {type:"web_search_call",action:{sources:[{url:source,title:"source"}]}},
        {type:"message",content:[{type:"output_text",text:JSON.stringify({opportunities})}]}
      ]
    }), {status:200,headers:{"content-type":"application/json"}});
  };
  const result = await runWideOpportunitySearch({
    apiKey:"fake",
    model:"gpt-5.6-luna",
    profile,
    nowIso:NOW,
    shards:WIDE_SEARCH_SHARDS,
    fetchImpl:fakeFetch
  });
  assert.equal(requests.length, 5);
  assert.equal(result.openai_request_count, 5);
  assert.equal(result.web_search_call_count, 5);
  assert.equal(result.search_profile, "WIDE_INDEX");
  assert.equal(result.search_status, "COMPLETE");
  assert.equal(result.coverage.length, 5);
  assert.equal(result.coverage.every((item) => item.status === "COMPLETE"), true);
  assert.equal(result.opportunities.length, 1);
  assert.equal(result.counters.duplicates_removed, 1);
  assert.equal(requests.every((request) => request.tool_choice === "required" && request.max_tool_calls === 3), true);
  assert.equal(requests.some((request) => request.tools[0].filters.allowed_domains.includes("linkedin.com")), false);
});

test("wide search records a failed shard as partial without retrying it", async () => {
  const shards = [WIDE_SEARCH_SHARDS[0], WIDE_SEARCH_SHARDS[1]];
  let calls = 0;
  const fakeFetch = async (_url, options) => {
    calls += 1;
    const request = JSON.parse(options.body);
    if (request.tools[0].filters.allowed_domains[0] === "reddit.com") {
      return new Response(JSON.stringify({
        id:"resp_malformed",
        model:"gpt-5.6-luna",
        usage:{input_tokens:30,output_tokens:20,total_tokens:50},
        output:[
          {type:"web_search_call",action:{sources:[{url:"https://www.reddit.com/r/gameDevClassifieds/comments/abc123/hiring_character_artist/"}]}},
          {type:"message",content:[{type:"output_text",text:"not-json"}]}
        ]
      }), {status:200,headers:{"content-type":"application/json"}});
    }
    return new Response(JSON.stringify(apiResponse(JSON.stringify({opportunities:[validCandidate()]}))), {status:200,headers:{"content-type":"application/json"}});
  };
  const result = await runWideOpportunitySearch({apiKey:"fake",model:"gpt-5.6-luna",profile,nowIso:NOW,shards,fetchImpl:fakeFetch});
  assert.equal(calls, 2);
  assert.equal(result.search_status, "PARTIAL");
  assert.deepEqual(result.coverage.map((item) => item.status), ["COMPLETE", "FAILED"]);
  assert.deepEqual(result.coverage.map((item) => item.web_search_calls), [1, 1]);
  assert.equal(result.web_search_call_count, 2);
  assert.equal(result.usage.input_tokens, 40);
  assert.equal(result.openai_request_count, 2);
  assert.equal(result.attempts, 1);
});

test("wide search accepts an exact Firecrawl-rendered detail URL and preserves cloud provenance", async () => {
  const shard = WIDE_SEARCH_SHARDS[2];
  const source = "https://workwithindies.com/careers/example-studio-character-artist";
  const firecrawlCandidate = {
    ...validCandidate(),
    source_url:source,
    apply_url:source,
    acceptance_source_url:null,
    source_evidence:[{type:"PRIMARY_SOURCE",url:source,note:"Rendered public detail"}]
  };
  const fakeFetch = async () => new Response(JSON.stringify({
    id:"resp_firecrawl_hint",
    model:"gpt-5.6-luna",
    usage:{input_tokens:100,output_tokens:50,total_tokens:150},
    output:[
      {type:"web_search_call",action:{sources:[{url:"https://jobs.lever.co/example/4d6d1713-f9d7-4d4f-96d2-827c5d140102",title:"secondary"}]}},
      {type:"message",content:[{type:"output_text",text:JSON.stringify({opportunities:[firecrawlCandidate]})}]}
    ]
  }), {status:200});
  const result = await runWideOpportunitySearch({
    apiKey:"fake",
    model:"gpt-5.6-luna",
    profile,
    nowIso:NOW,
    shards:[shard],
    fetchImpl:fakeFetch,
    preDiscovery:{
      requests:1,
      credits_used:10,
      rendered_pages:1,
      verified_urls:[source],
      shards:[{shard_id:shard.id,hints:[{url:source,title:"Character contract",description:"",excerpt:"Current contract",rendered:true}],verified_urls:[source]}]
    }
  });
  assert.equal(result.opportunities.length, 1);
  assert.equal(result.opportunities[0].source_access_method, "FIRECRAWL_SEARCH_PUBLIC_RENDER");
  assert.equal(result.opportunities[0].discovery_mode, "HYBRID_WIDE_SEARCH");
  assert.equal(result.cloud_browser_requests, 1);
  assert.equal(result.firecrawl_credits_used, 10);
});
