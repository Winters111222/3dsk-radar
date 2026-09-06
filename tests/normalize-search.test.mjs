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
    commercial_role:"BUYER",
    notice_status:"OPEN",
    studio_eligibility:"YES",
    eligibility_reason:"Worldwide external vendor request.",
    scope_fit:"CORE",
    categories:["WRAP_BASEMESH","CHARACTER_OUTSOURCING"],
    location:"Worldwide",
    remote_scope:"WORLDWIDE_VENDOR",
    published_date:"2026-09-05",
    source_updated_date:null,
    acceptance_source_url:null,
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

test("visual AI motion-only results are rejected instead of falling back to Other Relevant", () => {
  const verified = new Set([normalizeUrl(PRIMARY)]);
  const result = normalizeCandidate(candidate({categories:["VISUAL_AI_MOTION"]}), verified, NOW);
  assert.equal(result.opportunity, null);
  assert.equal(result.rejection, "excluded_search_category");
});

test("hard truth gates reject stale listings and accept old listings only with current source evidence", () => {
  const verified = new Set([normalizeUrl(PRIMARY)]);
  const stale = normalizeCandidate(candidate({published_date:"2026-07-08"}), verified, NOW);
  assert.equal(stale.rejection, "stale_or_unverified");
  const active = normalizeCandidate(candidate({published_date:"2026-07-08",acceptance_source_url:PRIMARY}), verified, NOW);
  assert.equal(active.opportunity.freshness_basis, "ACTIVE_ACCEPTANCE_EVIDENCE");
  assert.equal(active.opportunity.acceptance_verified_at, NOW);
});

test("normalizer rejects sellers and demotes employment signals to Potential Lead", () => {
  const verified = new Set([normalizeUrl(PRIMARY)]);
  assert.equal(normalizeCandidate(candidate({commercial_role:"SELLER"}), verified, NOW).rejection, "seller_not_opportunity");
  const employment = normalizeCandidate(candidate({commercial_role:"EMPLOYER",studio_eligibility:"UNKNOWN"}), verified, NOW).opportunity;
  assert.equal(employment.opportunity_kind, "POTENTIAL_LEAD");
});

test("normalization reports measured rejection and duplicate counters", () => {
  const payload = response([
    candidate(),
    candidate({win_score:89}),
    candidate({company:"Seller",source_url:CONTACT,apply_url:CONTACT,commercial_role:"SELLER",source_evidence:[{type:"SIGNAL_SOURCE",url:CONTACT,note:"Seller"}]})
  ]);
  const normalized = normalizeSearchResponse(payload,{nowIso:NOW,maxResults:12});
  assert.deepEqual(normalized.counters,{candidates_seen:3,candidates_verified:1,candidates_rejected:1,duplicates_removed:1,rejection_reasons:{seller_not_opportunity:1}});
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

test("index discovery rejects verified URLs outside narrow Tier A opportunity paths", () => {
  const outside = normalizeUrl(PRIMARY);
  const rejected = normalizeCandidate(candidate(), new Set([outside]), NOW, {indexDiscovery:true});
  assert.equal(rejected.opportunity, null);
  assert.equal(rejected.rejection, "source_not_allowed_for_index_discovery");

  const upwork = "https://www.upwork.com/freelance-jobs/apply/Human-Scan-Cleanup_~0123456789";
  const accepted = normalizeCandidate(candidate({source_url:upwork,apply_url:upwork,source_evidence:[{type:"PRIMARY_SOURCE",url:upwork,note:"Indexed detail"}]}), new Set([upwork]), NOW, {indexDiscovery:true});
  assert.equal(accepted.rejection, null);
  assert.equal(accepted.opportunity.discovery_source_id, "upwork");
  assert.equal(accepted.opportunity.manual_verification_status, "REQUIRED_BEFORE_CONTACT");
  assert.equal(accepted.opportunity.direct_source_requests, 0);
});

test("index discovery strips outside-domain evidence even when it appears in hosted sources", () => {
  const upwork = "https://www.upwork.com/freelance-jobs/apply/Human-Scan-Cleanup_~0123456789";
  const outside = "https://outside.example/contact";
  const input = candidate({
    source_url:upwork,
    apply_url:outside,
    contact_email:"person@outside.example",
    contact_email_source:outside,
    source_evidence:[
      {type:"PRIMARY_SOURCE",url:upwork,note:"Indexed detail"},
      {type:"CONTACT_SOURCE",url:outside,note:"Must not survive"}
    ]
  });
  const normalized = normalizeCandidate(input, new Set([upwork,outside]), NOW, {indexDiscovery:true}).opportunity;
  assert.equal(normalized.apply_url, upwork);
  assert.equal(normalized.contact_email, null);
  assert.equal(normalized.source_evidence.some((item) => item.url === outside), false);
});
