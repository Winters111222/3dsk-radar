import test from "node:test";
import assert from "node:assert/strict";
import { evaluateSourceTruth, isRecentSourceDate, normalizeSourceDate } from "../src/lib/source-truth.mjs";

const NOW = "2026-09-05T10:00:00.000Z";
const base = {
  requestedKind:"OPEN_OPPORTUNITY",
  commercialRole:"BUYER",
  noticeStatus:"OPEN",
  studioEligibility:"YES",
  scopeFit:"CORE",
  publishedDate:"2026-09-01",
  sourceUpdatedDate:null,
  acceptanceVerified:false,
  nowIso:NOW
};

test("30-day freshness boundary is deterministic and future dates fail", () => {
  assert.equal(isRecentSourceDate("2026-08-06", NOW), true);
  assert.equal(isRecentSourceDate("2026-08-05", NOW), false);
  assert.equal(normalizeSourceDate("2026-09-08", NOW), null);
});

test("old or undated records require current acceptance evidence", () => {
  assert.equal(evaluateSourceTruth({...base,publishedDate:"2026-07-08"}).rejection, "stale_or_unverified");
  assert.equal(evaluateSourceTruth({...base,publishedDate:null}).rejection, "stale_or_unverified");
  const active = evaluateSourceTruth({...base,publishedDate:"2026-07-08",acceptanceVerified:true});
  assert.equal(active.ok, true);
  assert.equal(active.freshnessBasis, "ACTIVE_ACCEPTANCE_EVIDENCE");
});

test("seller, inactive, ineligible and out-of-scope records fail closed", () => {
  assert.equal(evaluateSourceTruth({...base,commercialRole:"SELLER"}).rejection, "seller_not_opportunity");
  assert.equal(evaluateSourceTruth({...base,noticeStatus:"CLOSED"}).rejection, "inactive_notice");
  assert.equal(evaluateSourceTruth({...base,studioEligibility:"NO"}).rejection, "studio_ineligible");
  assert.equal(evaluateSourceTruth({...base,scopeFit:"EQUIPMENT"}).rejection, "out_of_scope");
});

test("employment and partnership signals cannot become open buyer requests", () => {
  for (const commercialRole of ["EMPLOYER","PARTNER"]) {
    const result = evaluateSourceTruth({...base,commercialRole});
    assert.equal(result.ok, true);
    assert.equal(result.opportunityKind, "POTENTIAL_LEAD");
  }
});
