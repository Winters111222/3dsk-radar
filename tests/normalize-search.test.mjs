import test from "node:test";
import assert from "node:assert/strict";
import { extractWebSourceUrls, normalizeCandidate, normalizeSearchResponse, normalizeUrl } from "../src/server/normalize.mjs";

const NOW = "2026-09-05T10:00:00.000Z";
const PRIMARY = "https://studio.example/jobs/vendor?utm_source=test";
const CONTACT = "https://studio.example/contact";

function candidate(overrides = {}) {
  return {
    title:"Realistic human character outsourcing batch",
    company:"Example Studio",
    summary:"External vendor request for scanned realistic characters and production basemesh conforming.",
    opportunity_kind:"OPEN_OPPORTUNITY",
    categories:["WRAP_BASEMESH","CHARACTER_OUTSOURCING"],
    location:"Worldwide",
    remote_scope:"WORLDWIDE_VENDOR",
    published_date:"2026-09-05",
    source_url:PRIMARY,
    apply_url:PRIMARY,
    fit_score:92,
    win_score:84,
    budget_type:"UNKNOWN",
    budget_published:null,
    budget_estimated_min:null,
    budget_estimated_max:null,
    budget_currency:null,
    budget_confidence:null,
    budget_reason:"No public price found.",
    contact_name:null,
    contact_role:null,
    contact_email:null,
    contact_email_source:null,
    why_it_fits:["Direct Wrap/basemesh match."],
    risks:[],
    missing_requirements:[],
    source_evidence:[{type:"PRIMARY_SOURCE",url:PRIMARY,note:"Official source"}],
    ...overrides
  };
}

function response(candidates, sourceUrls = [PRIMARY, CONTACT]) {
  return {
    id:"resp_mock",
    model:"gpt-5.6-luna",
    usage:{input_tokens:100,output_tokens:50,total_tokens:150},
    output:[
      {type:"web_search_call",action:{sources:sourceUrls.map((url) => ({url,title:"source"}))}},
      {type:"message",content:[{type:"output_text",text:JSON.stringify({opportunities:candidates})}]}
    ]
  };
}

test("URL normalization strips trackers without inventing a different destination", () => {
  assert.equal(normalizeUrl(PRIMARY), "https://studio.example/jobs/vendor");
});

test("web source allowlist is extracted only from web_search_call items", () => {
  const urls = extractWebSourceUrls(response([candidate()]));
  assert.equal(urls.has("https://studio.example/jobs/vendor"), true);
  assert.equal(urls.has("https://studio.example/contact"), true);
});

test("unverified source URL rejects the whole opportunity", () => {
  const verified = new Set(["https://different.example/opportunity"]);
  const result = normalizeCandidate(candidate(), verified, NOW);
  assert.equal(result.opportunity, null);
  assert.equal(result.rejection, "unverified_source_url");
});

test("contact email is cleared unless its exact public source was returned by web search", () => {
  const verified = new Set(["https://studio.example/jobs/vendor"]);
  const result = normalizeCandidate(candidate({contact_email:"sales@studio.example",contact_email_source:CONTACT}), verified, NOW);
  assert.equal(result.opportunity.contact_email, null);
  assert.equal(result.opportunity.contact_email_source, null);
});

test("verified contact survives provenance gate", () => {
  const verified = new Set(["https://studio.example/jobs/vendor","https://studio.example/contact"]);
  const result = normalizeCandidate(candidate({contact_email:"sales@studio.example",contact_email_source:CONTACT}), verified, NOW);
  assert.equal(result.opportunity.contact_email, "sales@studio.example");
  assert.equal(result.opportunity.contact_email_source, "https://studio.example/contact");
});

test("invalid estimated budget fails closed to UNKNOWN", () => {
  const verified = new Set(["https://studio.example/jobs/vendor"]);
  const result = normalizeCandidate(candidate({budget_type:"ESTIMATED",budget_estimated_min:10000,budget_estimated_max:5000,budget_currency:"EUR"}), verified, NOW);
  assert.equal(result.opportunity.budget_type, "UNKNOWN");
  assert.equal(result.opportunity.budget_estimated_min, null);
});

test("normalizer deterministically sets score band, identity and server timestamps", () => {
  const normalized = normalizeSearchResponse(response([candidate()]), {nowIso:NOW,maxResults:12});
  assert.equal(normalized.opportunities.length, 1);
  const item = normalized.opportunities[0];
  assert.equal(item.win_band, "HIGH");
  assert.match(item.id, /^radar-[a-f0-9]{16}$/);
  assert.equal(item.first_seen, NOW);
  assert.equal(item.status, "NEW");
  assert.equal(item.canonical_url, "https://studio.example/jobs/vendor");
});

test("same normalized opportunity is deduplicated within one search run", () => {
  const normalized = normalizeSearchResponse(response([candidate(), candidate({win_score:89})]), {nowIso:NOW,maxResults:12});
  assert.equal(normalized.opportunities.length, 1);
  assert.equal(normalized.opportunities[0].win_score, 89);
});

test("seller license and missing buyer provenance never become an opportunity budget", () => {
  const sources = new Set([normalizeUrl(PRIMARY)]);
  for (const basis of [undefined, "SELLER_PRICE", "EMPLOYEE_COMPENSATION", "UNKNOWN"]) {
    const result = normalizeCandidate(candidate({budget_type:"PUBLISHED",budget_published:"$240,000 annual license",budget_basis:basis,budget_source_url:PRIMARY}), sources, NOW).opportunity;
    assert.equal(result.budget_type, "UNKNOWN");
    assert.equal(result.budget_published, null);
    assert.equal(result.budget_source_url, null);
  }
});

test("buyer budget requires a consulted source and survives with its provenance", () => {
  const sources = new Set([normalizeUrl(PRIMARY), CONTACT]);
  const input = candidate({budget_type:"PUBLISHED",budget_basis:"BUYER_PROJECT",budget_published:"USD 18,000 per batch",budget_source_url:CONTACT});
  const valid = normalizeCandidate(input, sources, NOW).opportunity;
  assert.equal(valid.budget_type, "PUBLISHED");
  assert.equal(valid.budget_published, input.budget_published);
  assert.ok(valid.source_evidence.some(x=>x.url===CONTACT));
  const invalid = normalizeCandidate({...input,budget_source_url:"https://unvisited.example/price"}, sources, NOW).opportunity;
  assert.equal(invalid.budget_type, "UNKNOWN");
});

test("estimated buyer budget needs numeric bounds and preserves ESTIMATED", () => {
  const sources = new Set([normalizeUrl(PRIMARY)]);
  const input = candidate({budget_type:"ESTIMATED",budget_basis:"BUYER_PROJECT",budget_source_url:PRIMARY,budget_estimated_min:1000,budget_estimated_max:3000,budget_currency:"EUR"});
  assert.equal(normalizeCandidate(input,sources,NOW).opportunity.budget_type,"ESTIMATED");
  for (const min of [null,undefined,"1000",-1,4000]) {
    const invalid=normalizeCandidate({...input,budget_estimated_min:min},sources,NOW).opportunity;
    assert.equal(invalid.budget_type,"UNKNOWN");
    assert.equal(invalid.budget_estimated_min,null);
  }
});
