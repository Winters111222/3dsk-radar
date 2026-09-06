import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { evaluateSourceTruth } from "../src/lib/source-truth.mjs";

const evidence = JSON.parse(await readFile(new URL("../config/source-evidence-cases.v1.json", import.meta.url), "utf8"));
const NOW = "2026-09-05T10:00:00.000Z";
const defaults = {
  requestedKind:"OPEN_OPPORTUNITY", commercialRole:"BUYER", noticeStatus:"OPEN",
  studioEligibility:"YES", scopeFit:"CORE", publishedDate:"2026-09-01",
  sourceUpdatedDate:null, acceptanceVerified:false, nowIso:NOW
};

const fixtures = {
  human_scan_batch:{ expected:"OPEN_OPPORTUNITY", publishedDate:"2026-08-29" },
  metahuman_old:{ expected:"stale_or_unverified", publishedDate:"2026-07-08" },
  polycount_us_only:{ expected:"studio_ineligible", studioEligibility:"NO", scopeFit:"CHARACTER_ADJACENT", publishedDate:"2026-08-22" },
  freelancer_bid:{ expected:"POTENTIAL_LEAD", noticeStatus:"UNKNOWN" },
  unfold_related_price:{ expected:"POTENTIAL_LEAD", commercialRole:"EMPLOYER", studioEligibility:"UNKNOWN" },
  kindred_closed:{ expected:"inactive_notice", commercialRole:"EMPLOYER", noticeStatus:"CLOSED", studioEligibility:"NO", publishedDate:"2024-08-14" },
  gebiz_closed:{ expected:"inactive_notice", noticeStatus:"AWARDED", scopeFit:"CHARACTER_ADJACENT", publishedDate:"2026-05-04" },
  ungm_sites:{ expected:"inactive_notice", noticeStatus:"CLOSED", scopeFit:"OUT_OF_SCOPE", publishedDate:"2024-02-27" },
  pcs_hardware:{ expected:"out_of_scope", noticeStatus:"UNKNOWN", scopeFit:"EQUIPMENT" },
  een_seller:{ expected:"seller_not_opportunity", commercialRole:"SELLER", scopeFit:"OUT_OF_SCOPE" },
  riot_outsourcing_job:{ expected:"POTENTIAL_LEAD", commercialRole:"EMPLOYER", studioEligibility:"UNKNOWN", scopeFit:"CHARACTER_ADJACENT" }
};

test("all 11 research evidence cases have a sanitized executable truth fixture", () => {
  assert.deepEqual(Object.keys(fixtures).sort(), evidence.cases.map((item) => item.id).sort());
  assert.equal(evidence.cases.length, 11);
  for (const item of evidence.cases) {
    const fixture = fixtures[item.id];
    assert.equal(fixture.commercialRole || defaults.commercialRole, item.expected_role, `${item.id}: commercial role`);
    const result = evaluateSourceTruth({...defaults,...fixture});
    const actual = result.ok ? result.opportunityKind : result.rejection;
    assert.equal(actual, fixture.expected, item.id);
  }
});
