import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { callOpenAIResponses, runOpportunitySearch } from "../src/server/openai-search.mjs";

const profile = JSON.parse(await readFile(new URL("../config/company-profile.public.json", import.meta.url), "utf8"));
const NOW = "2026-09-05T10:00:00.000Z";
const SOURCE = "https://buyer.example/vendor-request";

function validCandidate() {
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
});
