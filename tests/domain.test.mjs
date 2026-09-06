import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { bandForScore, contactDisplay, sourceVerificationSatisfied, validateBudgetProvenance, validateOpportunity } from "../src/lib/domain.mjs";

const fixtures = JSON.parse(await readFile(new URL("../fixtures/opportunities.json", import.meta.url), "utf8"));

test("score bands follow 80/60 thresholds", () => {
  assert.equal(bandForScore(100), "HIGH");
  assert.equal(bandForScore(80), "HIGH");
  assert.equal(bandForScore(79), "MEDIUM");
  assert.equal(bandForScore(60), "MEDIUM");
  assert.equal(bandForScore(59), "LOW");
  assert.equal(bandForScore(0), "LOW");
});

test("every Stage 1 fixture satisfies the normalized opportunity contract", () => {
  for (const item of fixtures) assert.deepEqual(validateOpportunity(item), { ok:true, errors:[] }, item.id);
});

test("fixture set proves OPEN_OPPORTUNITY is distinct from POTENTIAL_LEAD", () => {
  assert.ok(fixtures.some((x) => x.opportunity_kind === "OPEN_OPPORTUNITY"));
  assert.ok(fixtures.some((x) => x.opportunity_kind === "POTENTIAL_LEAD"));
});

test("budget provenance fails closed", () => {
  assert.equal(validateBudgetProvenance({ budget_type:"PUBLISHED", budget_published:null }).ok, false);
  assert.equal(validateBudgetProvenance({ budget_type:"ESTIMATED", budget_estimated_min:1, budget_estimated_max:2, budget_reason:"fixture" }).ok, true);
  assert.equal(validateBudgetProvenance({ budget_type:"UNKNOWN", budget_published:null, budget_estimated_min:null, budget_estimated_max:null }).ok, true);
  assert.equal(validateBudgetProvenance({ budget_type:"UNKNOWN", budget_published:"$10", budget_estimated_min:null, budget_estimated_max:null }).ok, false);
});

test("missing public email never produces an inferred contact", () => {
  const missing = fixtures.find((x) => !x.contact_email);
  assert.equal(contactDisplay(missing), "Email not publicly available");
});

test("fixture email has explicit source provenance", () => {
  const withEmail = fixtures.find((x) => x.contact_email);
  assert.equal(withEmail.contact_email, "vendor-contact@example.com");
  assert.equal(withEmail.contact_email_source, "https://example.com/contact");
});

test("discovery opportunity requires exact persisted manual verification provenance", () => {
  const pending = {
    ...fixtures[0],
    discovery_mode:"INDEX_DISCOVERY_MANUAL_VERIFY",
    source_access_method:"OPENAI_HOSTED_WEB_SEARCH",
    discovery_source_id:"upwork",
    manual_verification_status:"REQUIRED_BEFORE_CONTACT",
    manual_verified_at:null,
    manual_verified_source_url:null,
    direct_source_requests:0
  };
  assert.equal(sourceVerificationSatisfied(pending), false);
  assert.equal(validateOpportunity(pending).ok, true);
  const verified = {
    ...pending,
    manual_verification_status:"VERIFIED_BEFORE_CONTACT",
    manual_verified_at:"2026-09-06T08:00:00.000Z",
    manual_verified_source_url:pending.source_url
  };
  assert.equal(sourceVerificationSatisfied(verified), true);
  assert.equal(validateOpportunity(verified).ok, true);
  assert.equal(validateOpportunity({...verified,manual_verified_source_url:"https://lookalike.example/item"}).ok, false);
});
