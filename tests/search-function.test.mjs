import test from "node:test";
import assert from "node:assert/strict";
import handler from "../netlify/functions/search.mjs";
import { memoryPaidCoordinator } from "./helpers/memory-paid-coordinator.mjs";

const SOURCE = "https://buyer.example/vendor-request";

function candidate() {
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

function mockOpenAIResponse() {
  return {
    id:"resp_function_test",
    model:"gpt-5.6-luna",
    usage:{input_tokens:20,output_tokens:10,total_tokens:30},
    output:[
      {type:"web_search_call",action:{sources:[{url:SOURCE,title:"official"}]}},
      {type:"message",content:[{type:"output_text",text:JSON.stringify({opportunities:[candidate()]})}]}
    ]
  };
}

function installNetlifyEnv(values) {
  const old = globalThis.Netlify;
  globalThis.Netlify = { env: { get: (key) => values[key] ?? undefined } };
  return () => {
    if (old === undefined) delete globalThis.Netlify;
    else globalThis.Netlify = old;
  };
}

function clearWarmState() {
  delete globalThis.__3DSK_RADAR_STAGE2_SEARCH_STATE__;
  delete globalThis.__RADAR_TEST_STATE_REPOSITORY__;
  delete globalThis.__RADAR_TEST_PAID_COORDINATOR__;
}

test("search function rejects non-POST without touching paid path", async () => {
  const response = await handler(new Request("https://radar.test/api/search"));
  assert.equal(response.status, 405);
  const payload = await response.json();
  assert.equal(payload.error.code, "METHOD_NOT_ALLOWED");
});

test("search function rejects invalid access before checking OpenAI config", async () => {
  clearWarmState();
  const restore = installNetlifyEnv({ RADAR_INTERNAL_ACCESS_SECRET:"right-secret" });
  try {
    const response = await handler(new Request("https://radar.test/api/search", {method:"POST",headers:{authorization:"Bearer wrong-secret"}}));
    assert.equal(response.status, 401);
    const payload = await response.json();
    assert.equal(payload.error.code, "UNAUTHORIZED");
  } finally {
    restore();
    clearWarmState();
  }
});

test("authorized search function normalizes a mocked hosted-search response end to end", async () => {
  const oldFetch = globalThis.fetch;
  clearWarmState();
  const restore = installNetlifyEnv({
    RADAR_INTERNAL_ACCESS_SECRET:"team-secret",
    RADAR_LIVE_AI_ENABLED:"false",
    RADAR_PAID_ACCEPTANCE_ENABLED:"true",
    RADAR_PAID_ACCEPTANCE_RUN_ID:"paid-run-test-001",
    RADAR_PAID_ACCEPTANCE_MAX_USD:"0.50",
    OPENAI_API_KEY:"fake-test-key",
    RADAR_SEARCH_COOLDOWN_SECONDS:"0"
  });
  globalThis.__RADAR_TEST_PAID_COORDINATOR__ = memoryPaidCoordinator();
  globalThis.__RADAR_TEST_STATE_REPOSITORY__ = { mergeSearchResultsWithStats: async (items) => ({opportunities:items,new_count:1,updated_count:0,workspace_total:1}), saveSearchRun: async (run) => { assert.equal(run.mode,"LIVE_SEARCH"); } };
  globalThis.fetch = async (_url, options) => {
    const request = JSON.parse(options.body);
    assert.equal(request.max_tool_calls, 3);
    assert.equal(request.max_output_tokens, 8000);
    return new Response(JSON.stringify(mockOpenAIResponse()), {status:200,headers:{"content-type":"application/json"}});
  };
  try {
    const response = await handler(new Request("https://radar.test/api/search", {method:"POST",headers:{authorization:"Bearer team-secret","content-type":"application/json"},body:JSON.stringify({run_id:"paid-run-test-001",operation_id:"focused-search",max_cost_usd:0.50,no_retry:true})}));
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.ok, true);
    assert.equal(payload.opportunities.length, 1);
    assert.equal(payload.opportunities[0].source_url, SOURCE);
    assert.equal(payload.opportunities[0].win_band, "HIGH");
    assert.equal(payload.run.returned_count, 1);
    assert.equal(payload.run.persistence, "NETLIFY_BLOBS");
    assert.equal(payload.run.counters.candidates_seen, 1);
    assert.equal(payload.run.counters.candidates_verified, 1);
    assert.equal(payload.run.counters.new_opportunities, 1);
    assert.equal(payload.run.counters.workspace_total, 1);
    assert.equal(payload.run.attempts, 1);
    assert.equal(payload.run.paid_acceptance.openai_requests, 1);
    assert.equal(payload.run.paid_acceptance.retries, 0);
  } finally {
    globalThis.fetch = oldFetch;
    restore();
    clearWarmState();
  }
});

test("completed paid operation replays stored result without a second OpenAI request or write", async () => {
  const oldFetch = globalThis.fetch;
  clearWarmState();
  const restore = installNetlifyEnv({
    RADAR_INTERNAL_ACCESS_SECRET:"team-secret",
    RADAR_LIVE_AI_ENABLED:"false",
    RADAR_PAID_ACCEPTANCE_ENABLED:"true",
    RADAR_PAID_ACCEPTANCE_RUN_ID:"paid-run-replay-001",
    RADAR_PAID_ACCEPTANCE_MAX_USD:"0.50",
    OPENAI_API_KEY:"fake-test-key"
  });
  let openaiRequests = 0;
  let writes = 0;
  globalThis.__RADAR_TEST_PAID_COORDINATOR__ = memoryPaidCoordinator();
  globalThis.__RADAR_TEST_STATE_REPOSITORY__ = {
    mergeSearchResultsWithStats: async (items) => ({ opportunities:items, new_count:1, updated_count:0, workspace_total:1 }),
    saveSearchRun: async () => { writes += 1; }
  };
  globalThis.fetch = async () => {
    openaiRequests += 1;
    return new Response(JSON.stringify(mockOpenAIResponse()), { status:200, headers:{ "content-type":"application/json" } });
  };
  const request = () => new Request("https://radar.test/api/search", {
    method:"POST",
    headers:{ authorization:"Bearer team-secret", "content-type":"application/json" },
    body:JSON.stringify({ run_id:"paid-run-replay-001", operation_id:"focused-search", max_cost_usd:0.50, no_retry:true })
  });
  try {
    const first = await handler(request());
    const second = await handler(request());
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal((await second.json()).replayed, true);
    assert.equal(openaiRequests, 1);
    assert.equal(writes, 1);
  } finally {
    globalThis.fetch = oldFetch;
    restore();
    clearWarmState();
  }
});
