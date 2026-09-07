import test from "node:test";
import assert from "node:assert/strict";
import { enrichSourceCandidate } from "../src/server/source-candidate-enrichment.mjs";

const NOW = "2026-09-05T12:00:00.000Z";
const URL = "https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-012345";

function candidate(overrides = {}) {
  return {
    primary_record:{
      source_id:"find_tender_uk",
      tender_identity:"ocds-h6vhtk-012345",
      source_item_id:"release-1",
      source_revision:"release-1",
      source_updated_date:"2026-09-04",
      title:"Digital human character production services",
      summary:"Discovery summary must not be sufficient evidence.",
      matched_phrases:["human photogrammetry"],
      buyer_names:["Public Buyer"],
      suggested_categories:["CHARACTER_OUTSOURCING"],
      canonical_url:URL,
      fetched_at:NOW,
      ...overrides
    }
  };
}

function detail(overrides = {}) {
  const release = {
    ocid:"ocds-h6vhtk-012345",
    date:"2026-09-04T10:00:00Z",
    buyer:{ name:"Public Buyer", address:{ countryName:"United Kingdom" }, contactPoint:{ email:"procurement@example.gov.uk" } },
    parties:[{ name:"Public Buyer", roles:["buyer"], contactPoint:{ email:"procurement@example.gov.uk" } }],
    tender:{
      title:"Digital human character production services",
      description:"Production services for realistic 3D characters and digital humans.",
      status:"active",
      tenderPeriod:{ endDate:"2026-09-20T12:00:00Z" },
      value:{ amount:250000, currency:"GBP" },
      lots:[]
    },
    ...overrides
  };
  return { source_id:"find_tender_uk", source_identity:release.ocid, fetched_at:NOW, document:release, releases:[release] };
}

test("official open buyer detail passes Phase A gates with contact and budget provenance", () => {
  const result = enrichSourceCandidate(candidate(), detail(), { nowIso:NOW });
  assert.equal(result.rejection, null);
  assert.equal(result.opportunity.opportunity_kind, "OPEN_OPPORTUNITY");
  assert.equal(result.opportunity.commercial_role, "BUYER");
  assert.equal(result.opportunity.notice_status, "OPEN");
  assert.equal(result.opportunity.studio_eligibility, "YES");
  assert.equal(result.opportunity.contact_email, "procurement@example.gov.uk");
  assert.equal(result.opportunity.contact_email_source, URL);
  assert.equal(result.opportunity.budget_type, "PUBLISHED");
  assert.equal(result.opportunity.budget_source_url, URL);
  assert.equal(result.enrichment.scope_fit, "CORE");
});

test("query-pack phrase alone cannot promote an unrelated detail record", () => {
  const unrelated = detail({ tender:{ title:"Office furniture", description:"Supply of desks and chairs.", status:"active", tenderPeriod:{ endDate:"2026-09-20T12:00:00Z" } } });
  const result = enrichSourceCandidate(candidate({ title:"Office furniture", suggested_categories:[] }), unrelated, { nowIso:NOW });
  assert.equal(result.opportunity, null);
  assert.ok(["studio_ineligible", "out_of_scope"].includes(result.rejection));
});

test("enrichment independently rejects a mismatched detail identity", () => {
  const mismatched = detail();
  mismatched.source_identity = "ocds-h6vhtk-other";
  const result = enrichSourceCandidate(candidate(), mismatched, { nowIso:NOW });
  assert.equal(result.opportunity, null);
  assert.equal(result.rejection, "detail_contract_mismatch");
});

test("inactive, missing-buyer and visual-motion-only detail fail closed", () => {
  const closed = enrichSourceCandidate(candidate(), detail({ tender:{ title:"Digital human character production services", description:"Character production services", status:"complete", tenderPeriod:{ endDate:"2026-08-20T12:00:00Z" } } }), { nowIso:NOW });
  assert.equal(closed.opportunity, null);
  assert.equal(closed.rejection, "inactive_notice");

  const noBuyerRelease = detail();
  delete noBuyerRelease.document.buyer;
  noBuyerRelease.document.parties = [];
  const noBuyer = enrichSourceCandidate(candidate(), noBuyerRelease, { nowIso:NOW });
  assert.equal(noBuyer.rejection, "detail_buyer_missing");

  const motion = enrichSourceCandidate(candidate({ title:"Motion design campaign", suggested_categories:[] }), detail({ tender:{ title:"Motion design campaign", description:"After Effects motion design services", status:"active", tenderPeriod:{ endDate:"2026-09-20T12:00:00Z" } } }), { nowIso:NOW });
  assert.equal(motion.opportunity, null);
  assert.ok(["studio_ineligible", "out_of_scope"].includes(motion.rejection));
});

test("an individual-only procurement cannot become a studio opportunity", () => {
  const individual = enrichSourceCandidate(candidate(), detail({ tender:{ title:"Digital human individual consultant", description:"Candidate must be an individual contractor for 3D character production services.", status:"active", tenderPeriod:{ endDate:"2026-09-20T12:00:00Z" } } }), { nowIso:NOW });
  assert.equal(individual.opportunity, null);
  assert.equal(individual.rejection, "studio_ineligible");
  assert.equal(individual.enrichment.studio_eligibility, "NO");
});

test("ambiguous multi-lot budget remains UNKNOWN", () => {
  const ambiguous = detail();
  ambiguous.document.tender.lots = [{ id:"1" }, { id:"2" }];
  const result = enrichSourceCandidate(candidate(), ambiguous, { nowIso:NOW });
  assert.equal(result.opportunity.budget_type, "UNKNOWN");
  assert.equal(result.opportunity.budget_source_url, null);
});
