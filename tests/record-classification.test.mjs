import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyRecordCandidate,
  isSalesOpportunityRecord,
  reclassifyStoredRecord,
  recordKindOf
} from "../src/server/record-classification.mjs";

function record(overrides = {}) {
  return {
    id:"legacy-seller",
    source_url:"https://seller.example/services/game-art",
    title:"Synthetic game-art production services",
    company:"Synthetic Capture Works",
    summary:"Our studio provides outsourced character production and human capture services.",
    opportunity_kind:"POTENTIAL_LEAD",
    commercial_role:"SELLER",
    first_seen:"2026-08-20T08:00:00Z",
    last_seen:"2026-09-06T08:00:00Z",
    status:"INTERESTING",
    reply_subject:"Historic draft",
    ...overrides
  };
}

test("Kabum-like seller capability page is deterministically a competitor", () => {
  const result = classifyRecordCandidate(record());
  assert.equal(result.record_kind, "COMPETITOR");
  assert.equal(result.reason, "SELLER_CAPABILITY_PAGE");
});

test("generic service page remains a competitor even when a model labels it buyer", () => {
  const result = classifyRecordCandidate(record({commercial_role:"BUYER",summary:"A studio provides outsourced character production services."}));
  assert.equal(result.record_kind, "COMPETITOR");
  assert.equal(result.effective_commercial_role, "SELLER");
});

test("a speculative subcontracting label does not turn a seller offer into buyer demand", () => {
  const result = classifyRecordCandidate(record({
    source_url:"https://seller.example/game",
    commercial_role:"BUYER",
    summary:"An outsourcing company publicly offering digital-human production and scan services. Potential subcontracting or reciprocal overflow lead."
  }));
  assert.equal(result.record_kind, "COMPETITOR");
  assert.equal(result.reason, "GENERIC_SERVICE_OR_PORTFOLIO_PAGE");
});

test("a game-production service page is a competitor without explicit buyer demand", () => {
  const result = classifyRecordCandidate(record({
    source_url:"https://seller.example/game-production",
    commercial_role:"BUYER",
    summary:"Commercial service offering for outsourced 3D scanning and digital-human production."
  }));
  assert.equal(result.record_kind, "COMPETITOR");
});

test("a third-party marketplace product listing is a seller record, not buyer demand", () => {
  const result = classifyRecordCandidate(record({
    source_url:"https://aws.amazon.com/marketplace/pp/prodview-synthetic",
    company:"Synthetic Digital Human Vendor",
    commercial_role:"BUYER",
    summary:"Enterprise digital-human product offering for customer-facing experiences."
  }));
  assert.equal(result.record_kind, "COMPETITOR");
});

test("Outscal-like archived aggregator is a source platform, never a buyer", () => {
  const result = classifyRecordCandidate(record({
    source_url:"https://jobs-index.example/archive",
    company:"Synthetic Jobs Index",
    commercial_role:"UNKNOWN",
    summary:"An archived job aggregator and ATS dataset of collected vacancies."
  }));
  assert.equal(result.record_kind, "SOURCE_PLATFORM");
});

test("an ATS employee detail is not a sales candidate without concrete vendor procurement", () => {
  const result = classifyRecordCandidate(record({
    source_url:"https://jobs.lever.co/buyer-studio/abc123",
    company:"Buyer Studio",
    commercial_role:"EMPLOYER",
    title:"Character production contract",
    summary:"The employer needs external character production support."
  }));
  assert.equal(result.record_kind, null);
  assert.equal(result.rejection, "individual_employment");
});

test("a competitor with a concrete current subcontract signal can become a lead", () => {
  const result = classifyRecordCandidate(record({
    source_url:"https://seller.example/partners/subcontract-brief",
    summary:"Our studio is seeking an external subcontractor for production overflow support."
  }));
  assert.equal(result.record_kind, "SALES_OPPORTUNITY");
  assert.equal(result.effective_commercial_role, "PARTNER");
  assert.equal(result.reason, "CONCRETE_SUBCONTRACT_OR_VENDOR_SIGNAL");
});

test("generic partner label without a current buyer signal is rejected", () => {
  const result = classifyRecordCandidate(record({commercial_role:"PARTNER",summary:"A general co-development partnership announcement."}));
  assert.equal(result.record_kind, null);
  assert.equal(result.rejection, "partner_without_buyer_signal");
});

test("active CZ/SK 3D heritage funding is a partner lead, never buyer demand", () => {
  const result = classifyRecordCandidate(record({
    source_url:"https://www.mk.gov.cz/digitalizace-kulturnich-statku-a-narodnich-kulturnich-pamatek-cs-2941",
    company:"Ministerstvo kultury ČR",
    commercial_role:"PARTNER",
    categories:["CULTURAL_HERITAGE_3D", "HERITAGE_FUNDING_PARTNERSHIP"],
    summary:"Active grant call for 3D digitisation of museum collections and national cultural monuments."
  }));
  assert.equal(result.record_kind, "SALES_OPPORTUNITY");
  assert.equal(result.effective_commercial_role, "PARTNER");
  assert.equal(result.concrete_buyer_signal, false);
  assert.equal(result.reason, "ACTIVE_HERITAGE_FUNDING_OR_PARTNERSHIP_SIGNAL");
});

test("generic heritage grant information without a concrete call or recipient stays rejected", () => {
  const result = classifyRecordCandidate(record({
    commercial_role:"PARTNER",
    categories:["CULTURAL_HERITAGE_3D", "HERITAGE_FUNDING_PARTNERSHIP"],
    summary:"General information about cultural policy and digitisation strategy."
  }));
  assert.equal(result.record_kind, null);
  assert.equal(result.rejection, "partner_without_buyer_signal");
});

test("a funding label without explicit 3D scope or an approved CZ/SK funding source stays rejected", () => {
  const no3d = classifyRecordCandidate(record({
    source_url:"https://www.fpu.sk/sk/vyzvy/",
    commercial_role:"PARTNER",
    categories:["HERITAGE_FUNDING_PARTNERSHIP"],
    summary:"Active grant call for general museum operations."
  }));
  assert.equal(no3d.rejection, "partner_without_buyer_signal");
  const wrongSource = classifyRecordCandidate(record({
    source_url:"https://example.com/grants/3d-museum",
    commercial_role:"PARTNER",
    categories:["HERITAGE_FUNDING_PARTNERSHIP"],
    summary:"Active grant call for museum 3D digitisation."
  }));
  assert.equal(wrongSource.rejection, "partner_without_buyer_signal");
});

test("Czech and Slovak inflections for 3D heritage work count as explicit grant scope", () => {
  for (const summary of [
    "Aktivní dotační výzva podporuje 3D digitalizaci sbírkových předmětů.",
    "Otvorená dotačná výzva podporuje fotogrametriu zbierkových predmetov."
  ]) {
    const source_url = summary.startsWith("Aktivní") ? "https://www.mk.gov.cz/digitalizace-kulturnich-statku-a-narodnich-kulturnich-pamatek-cs-2941" : "https://www.fpu.sk/sk/vyzvy/";
    assert.equal(classifyRecordCandidate(record({source_url,commercial_role:"PARTNER",categories:["HERITAGE_FUNDING_PARTNERSHIP"],summary})).record_kind, "SALES_OPPORTUNITY");
  }
});

test("legacy records fall back to sales until an explicit reclassification is applied", () => {
  const legacy = record();
  assert.equal(recordKindOf(legacy), "SALES_OPPORTUNITY");
  assert.equal(isSalesOpportunityRecord(legacy), true);
});

test("mock reclassification is idempotent and preserves historical fields", () => {
  const legacy = record({
    canonical_url:"https://seller.example/services/game-art",
    company_bookmarked:true,
    bookmark_note:"keep",
    contact_history:[{sent_at:"2026-08-22T10:00:00Z"}]
  });
  const first = reclassifyStoredRecord(legacy, "2026-09-06T12:00:00Z");
  assert.equal(first.changed, true);
  assert.equal(first.record.record_kind, "COMPETITOR");
  assert.equal(first.record.opportunity_kind, null);
  assert.equal(first.record.first_seen, legacy.first_seen);
  assert.equal(first.record.last_seen, legacy.last_seen);
  assert.equal(first.record.status, legacy.status);
  assert.equal(first.record.reply_subject, legacy.reply_subject);
  assert.equal(first.record.company_bookmarked, true);
  assert.deepEqual(first.record.contact_history, legacy.contact_history);
  assert.equal(first.record.classification_history[0].previous_opportunity_kind, "POTENTIAL_LEAD");

  const second = reclassifyStoredRecord(first.record, "2026-09-07T12:00:00Z");
  assert.equal(second.changed, false);
  assert.deepEqual(second.record, first.record);
});
