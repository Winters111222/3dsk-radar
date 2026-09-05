import test from "node:test";
import assert from "node:assert/strict";
import handler from "../netlify/functions/search.mjs";

const SOURCE = "https://buyer.example/vendor-request";

function candidate() {
  return {
    title:"Human scan cleanup vendor",
    company:"Buyer Studio",
    summary:"Public external vendor request for scan cleanup and basemesh conforming.",
    opportunity_kind:"OPEN_OPPORTUNITY",
    categories:["SCAN_CLEANUP","WRAP_BASEMESH"],
    location:"Worldwide",
    remote_scope:"WORLDWIDE_VENDOR",
    published_date:"2026-09-05",
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

test("search function rejects non-POST without touching paid path", async () => {
  const response = await handler(new Request("https://radar.test/api/search"));
  assert.equal(response.status, 405);
  const payload = await response.json();
  assert.equal(payload.error.code, "METHOD_NOT_ALLOWED");
});

test("search function rejects invalid access before checking OpenAI config", async () => {
  const oldSecret = process.env.RADAR_INTERNAL_ACCESS_SECRET;
  const oldKey = process.env.OPENAI_API_KEY;
  process.env.RADAR_INTERNAL_ACCESS_SECRET = "right-secret";
  delete process.env.OPENAI_API_KEY;
  try {
    const response = await handler(new Request("https://radar.test/api/search", {method:"POST",headers:{authorization:"Bearer wrong-secret"}}));
    assert.equal(response.status, 401);
    const payload = await response.json();
    assert.equal(payload.error.code, "UNAUTHORIZED");
  } finally {
    if (oldSecret === undefined) delete process.env.RADAR_INTERNAL_ACCESS_SECRET; else process.env.RADAR_INTERNAL_ACCESS_SECRET = oldSecret;
    if (oldKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = oldKey;
  }
});

test("authorized search function normalizes a mocked hosted-search response end to end", async () => {
  const oldFetch = globalThis.fetch;
  const oldSecret = process.env.RADAR_INTERNAL_ACCESS_SECRET;
  const oldKey = process.env.OPENAI_API_KEY;
  const oldCooldown = process.env.RADAR_SEARCH_COOLDOWN_SECONDS;
  process.env.RADAR_INTERNAL_ACCESS_SECRET = "team-secret";
  process.env.OPENAI_API_KEY = "fake-test-key";
  process.env.RADAR_SEARCH_COOLDOWN_SECONDS = "0";
  globalThis.fetch = async () => new Response(JSON.stringify(mockOpenAIResponse()), {status:200,headers:{"content-type":"application/json"}});
  try {
    const response = await handler(new Request("https://radar.test/api/search", {method:"POST",headers:{authorization:"Bearer team-secret","content-type":"application/json"},body:"{}"}));
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.ok, true);
    assert.equal(payload.opportunities.length, 1);
    assert.equal(payload.opportunities[0].source_url, SOURCE);
    assert.equal(payload.opportunities[0].win_band, "HIGH");
    assert.equal(payload.run.returned_count, 1);
    assert.equal(payload.run.persistence, "STAGE_3_PENDING");
  } finally {
    globalThis.fetch = oldFetch;
    if (oldSecret === undefined) delete process.env.RADAR_INTERNAL_ACCESS_SECRET; else process.env.RADAR_INTERNAL_ACCESS_SECRET = oldSecret;
    if (oldKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = oldKey;
    if (oldCooldown === undefined) delete process.env.RADAR_SEARCH_COOLDOWN_SECONDS; else process.env.RADAR_SEARCH_COOLDOWN_SECONDS = oldCooldown;
  }
});
