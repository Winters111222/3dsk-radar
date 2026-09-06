import test from "node:test";
import assert from "node:assert/strict";
import handler from "../netlify/functions/search.mjs";
import { memoryPaidCoordinator } from "./helpers/memory-paid-coordinator.mjs";

const SOURCE = "https://www.upwork.com/freelance-jobs/apply/Human-Scan-Cleanup_~0123456789";
const PREVIEW_CONTEXT = { deploy:{ context:"deploy-preview" } };

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
  let savedRun;
  globalThis.__RADAR_TEST_STATE_REPOSITORY__ = { mergeSearchResultsWithStats: async (items) => ({opportunities:items,new_count:1,updated_count:0,workspace_total:1}), saveSearchRun: async (run) => { savedRun=run; } };
  globalThis.fetch = async (_url, options) => {
    const request = JSON.parse(options.body);
    assert.equal(request.max_tool_calls, 3);
    assert.equal(request.max_output_tokens, 8000);
    assert.deepEqual(request.tools[0].filters.allowed_domains, ["upwork.com","freelancer.com","reddit.com","forums.unrealengine.com","polycount.com"]);
    return new Response(JSON.stringify(mockOpenAIResponse()), {status:200,headers:{"content-type":"application/json"}});
  };
  try {
    const response = await handler(new Request("https://radar.test/api/search", {method:"POST",headers:{authorization:"Bearer team-secret","content-type":"application/json"},body:JSON.stringify({run_id:"paid-run-test-001",operation_id:"focused-search",max_cost_usd:0.50,no_retry:true})}), PREVIEW_CONTEXT);
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.ok, true);
    assert.equal(payload.opportunities.length, 1);
    assert.equal(payload.opportunities[0].source_url, SOURCE);
    assert.equal(payload.opportunities[0].win_band, "HIGH");
    assert.equal(payload.opportunities[0].manual_verification_status, "REQUIRED_BEFORE_CONTACT");
    assert.equal(payload.opportunities[0].direct_source_requests, 0);
    assert.equal(payload.run.returned_count, 1);
    assert.equal(payload.run.persistence, "NETLIFY_BLOBS");
    assert.equal(payload.run.counters.candidates_seen, 1);
    assert.equal(payload.run.counters.candidates_verified, 1);
    assert.equal(payload.run.counters.new_opportunities, 1);
    assert.equal(payload.run.counters.workspace_total, 1);
    assert.equal(payload.run.diagnostics.privacy,"AGGREGATED_COUNTS_ONLY");
    assert.equal(payload.run.diagnostics.source_yield.find((item)=>item.source_id==="upwork").returned,1);
    assert.deepEqual(savedRun.diagnostics,payload.run.diagnostics);
    assert.equal(payload.run.attempts, 1);
    assert.equal(payload.run.mode, "INDEX_DISCOVERY_MANUAL_VERIFY");
    assert.equal(payload.run.counters.collector_mode, "INDEX_DISCOVERY_MANUAL_VERIFY");
    assert.equal(payload.run.direct_source_requests, 0);
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
    const first = await handler(request(), PREVIEW_CONTEXT);
    const second = await handler(request(), PREVIEW_CONTEXT);
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

test("armed paid search rejects production context before OpenAI or persistence", async () => {
  const oldFetch = globalThis.fetch;
  clearWarmState();
  let fetches = 0;
  let writes = 0;
  const restore = installNetlifyEnv({
    RADAR_INTERNAL_ACCESS_SECRET:"team-secret",
    RADAR_LIVE_AI_ENABLED:"false",
    RADAR_PAID_ACCEPTANCE_ENABLED:"true",
    RADAR_PAID_ACCEPTANCE_RUN_ID:"paid-run-context-001",
    RADAR_PAID_ACCEPTANCE_MAX_USD:"0.50",
    OPENAI_API_KEY:"fake-test-key"
  });
  globalThis.fetch = async () => { fetches += 1; throw new Error("must not fetch"); };
  globalThis.__RADAR_TEST_PAID_COORDINATOR__ = memoryPaidCoordinator();
  globalThis.__RADAR_TEST_STATE_REPOSITORY__ = { mergeSearchResultsWithStats:async () => { writes += 1; }, saveSearchRun:async () => { writes += 1; } };
  try {
    const response = await handler(new Request("https://radar.test/api/search", {
      method:"POST",
      headers:{ authorization:"Bearer team-secret", "content-type":"application/json" },
      body:JSON.stringify({ run_id:"paid-run-context-001", operation_id:"focused-search", max_cost_usd:0.50, no_retry:true })
    }), { deploy:{ context:"production" } });
    assert.equal(response.status, 423);
    assert.equal((await response.json()).error.code, "PAID_ACCEPTANCE_PREVIEW_REQUIRED");
    assert.equal(fetches, 0);
    assert.equal(writes, 0);
  } finally {
    globalThis.fetch = oldFetch;
    restore();
    clearWarmState();
  }
});

test("production search stays locked behind its dedicated gate before OpenAI", async () => {
  const oldFetch = globalThis.fetch;
  clearWarmState();
  let fetches = 0;
  const restore = installNetlifyEnv({
    RADAR_INTERNAL_ACCESS_SECRET:"team-secret",
    RADAR_LIVE_AI_ENABLED:"true",
    RADAR_PRODUCTION_SEARCH_ENABLED:"false",
    OPENAI_API_KEY:"fake-test-key"
  });
  globalThis.fetch = async () => { fetches += 1; throw new Error("must not fetch"); };
  try {
    const response = await handler(new Request("https://radar.test/api/search", {
      method:"POST",
      headers:{ authorization:"Bearer team-secret", "content-type":"application/json" },
      body:"{}"
    }), { deploy:{ context:"production" } });
    assert.equal(response.status, 423);
    assert.equal((await response.json()).error.code, "PRODUCTION_SEARCH_LOCKED");
    assert.equal(fetches, 0);
  } finally {
    globalThis.fetch = oldFetch;
    restore();
    clearWarmState();
  }
});

test("production search rejects non-production context and invalid budget config before OpenAI", async () => {
  const oldFetch = globalThis.fetch;
  clearWarmState();
  let fetches = 0;
  const values = {
    RADAR_INTERNAL_ACCESS_SECRET:"team-secret",
    RADAR_LIVE_AI_ENABLED:"true",
    RADAR_PRODUCTION_SEARCH_ENABLED:"true",
    RADAR_PRODUCTION_SEARCH_MAX_USD:"0.50",
    RADAR_PRODUCTION_SEARCH_MAX_RESULTS:"6",
    OPENAI_API_KEY:"fake-test-key"
  };
  const restore = installNetlifyEnv(values);
  globalThis.fetch = async () => { fetches += 1; throw new Error("must not fetch"); };
  const request = () => new Request("https://radar.test/api/search", {
    method:"POST",
    headers:{ authorization:"Bearer team-secret", "content-type":"application/json" },
    body:"{}"
  });
  try {
    const preview = await handler(request(), PREVIEW_CONTEXT);
    assert.equal(preview.status, 423);
    assert.equal((await preview.json()).error.code, "PRODUCTION_SEARCH_PRODUCTION_REQUIRED");
    values.RADAR_PRODUCTION_SEARCH_MAX_USD = "5.00";
    const invalid = await handler(request(), { deploy:{ context:"production" } });
    assert.equal(invalid.status, 503);
    assert.equal((await invalid.json()).error.code, "PRODUCTION_SEARCH_CONFIG_INVALID");
    assert.equal(fetches, 0);
  } finally {
    globalThis.fetch = oldFetch;
    restore();
    clearWarmState();
  }
});

test("production search dispatches once per UTC day and replays without a second charge or write", async () => {
  const oldFetch = globalThis.fetch;
  clearWarmState();
  const restore = installNetlifyEnv({
    RADAR_INTERNAL_ACCESS_SECRET:"team-secret",
    RADAR_LIVE_AI_ENABLED:"true",
    RADAR_PRODUCTION_SEARCH_ENABLED:"true",
    RADAR_PRODUCTION_SEARCH_MAX_USD:"0.50",
    RADAR_PRODUCTION_SEARCH_MAX_RESULTS:"6",
    OPENAI_API_KEY:"fake-test-key"
  });
  let openaiRequests = 0;
  let writes = 0;
  globalThis.__RADAR_TEST_PAID_COORDINATOR__ = memoryPaidCoordinator();
  globalThis.__RADAR_TEST_STATE_REPOSITORY__ = {
    mergeSearchResultsWithStats: async (items) => ({ opportunities:items, new_count:1, updated_count:0, workspace_total:1 }),
    saveSearchRun: async () => { writes += 1; }
  };
  globalThis.fetch = async (_url, options) => {
    openaiRequests += 1;
    const providerRequest = JSON.parse(options.body);
    assert.equal(providerRequest.store, false);
    assert.equal(providerRequest.max_tool_calls, 3);
    assert.equal(providerRequest.max_output_tokens, 8000);
    return new Response(JSON.stringify(mockOpenAIResponse()), { status:200, headers:{ "content-type":"application/json" } });
  };
  const request = () => new Request("https://radar.test/api/search", {
    method:"POST",
    headers:{ authorization:"Bearer team-secret", "content-type":"application/json" },
    body:JSON.stringify({ run_id:"attacker-controlled", max_cost_usd:99, no_retry:false })
  });
  try {
    const first = await handler(request(), { deploy:{ context:"production" } });
    const firstPayload = await first.json();
    const second = await handler(request(), { deploy:{ context:"production" } });
    const secondPayload = await second.json();
    assert.equal(first.status, 200);
    assert.equal(firstPayload.ok, true);
    assert.match(firstPayload.run.paid_execution.run_id, /^prod-search-\d{8}$/);
    assert.equal(firstPayload.run.paid_execution.mode, "PRODUCTION_DAILY");
    assert.equal(firstPayload.run.paid_execution.cap_usd, 0.5);
    assert.equal(firstPayload.run.paid_execution.openai_requests, 1);
    assert.equal(firstPayload.run.paid_execution.retries, 0);
    assert.equal(second.status, 200);
    assert.equal(secondPayload.replayed, true);
    assert.equal(openaiRequests, 1);
    assert.equal(writes, 1);
  } finally {
    globalThis.fetch = oldFetch;
    restore();
    clearWarmState();
  }
});

test("concurrent production clicks have one paid winner", async () => {
  const oldFetch = globalThis.fetch;
  clearWarmState();
  const restore = installNetlifyEnv({
    RADAR_INTERNAL_ACCESS_SECRET:"team-secret",
    RADAR_LIVE_AI_ENABLED:"true",
    RADAR_PRODUCTION_SEARCH_ENABLED:"true",
    RADAR_PRODUCTION_SEARCH_MAX_USD:"0.50",
    RADAR_PRODUCTION_SEARCH_MAX_RESULTS:"6",
    OPENAI_API_KEY:"fake-test-key"
  });
  let openaiRequests = 0;
  let writes = 0;
  let releaseProvider;
  const providerGate = new Promise((resolve) => { releaseProvider = resolve; });
  globalThis.__RADAR_TEST_PAID_COORDINATOR__ = memoryPaidCoordinator();
  globalThis.__RADAR_TEST_STATE_REPOSITORY__ = {
    mergeSearchResultsWithStats: async (items) => ({ opportunities:items, new_count:1, updated_count:0, workspace_total:1 }),
    saveSearchRun: async () => { writes += 1; }
  };
  globalThis.fetch = async () => {
    openaiRequests += 1;
    await providerGate;
    return new Response(JSON.stringify(mockOpenAIResponse()), { status:200, headers:{ "content-type":"application/json" } });
  };
  const request = () => new Request("https://radar.test/api/search", {
    method:"POST",
    headers:{ authorization:"Bearer team-secret", "content-type":"application/json" },
    body:"{}"
  });
  try {
    const firstPromise = handler(request(), { deploy:{ context:"production" } });
    await new Promise((resolve) => setImmediate(resolve));
    const secondPromise = handler(request(), { deploy:{ context:"production" } });
    await new Promise((resolve) => setImmediate(resolve));
    releaseProvider();
    const responses = await Promise.all([firstPromise, secondPromise]);
    const statuses = responses.map((response) => response.status).sort((a, b) => a - b);
    assert.deepEqual(statuses, [200, 409]);
    assert.equal(openaiRequests, 1);
    assert.equal(writes, 1);
  } finally {
    globalThis.fetch = oldFetch;
    restore();
    clearWarmState();
  }
});
