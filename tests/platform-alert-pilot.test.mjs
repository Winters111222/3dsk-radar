import test from "node:test";
import assert from "node:assert/strict";
import pilot from "../config/platform-alert-pilot.v1.json" with {type:"json"};

test("platform alert pilot stays within official counts and default-off", () => {
  assert.equal(pilot.status, "OPERATOR_SETUP_REQUIRED_RUNTIME_LOCKED");
  assert.equal(pilot.linkedin_job_alerts.length, 8);
  assert.equal(pilot.upwork_saved_searches.length, 8);
  assert.ok(pilot.linkedin_job_alerts.length <= pilot.official_limits.linkedin.maximum_job_alerts);
  assert.ok(pilot.upwork_saved_searches.length <= pilot.official_limits.upwork.maximum_saved_searches);
  assert.equal([...pilot.linkedin_job_alerts, ...pilot.upwork_saved_searches].every((item) => item.enabled === false), true);
  assert.deepEqual([
    pilot.scheduled_collection_enabled,
    pilot.automatic_account_changes_enabled,
    pilot.production_import_enabled
  ], [false, false, false]);
});

test("Upwork saved searches cannot masquerade as configured email monitoring", () => {
  assert.equal(pilot.official_limits.upwork.saved_search_email_delivery_guaranteed, false);
  assert.equal(pilot.official_limits.upwork.instant_alert_basis, "INDIVIDUAL_PROPOSAL_HISTORY");
  assert.deepEqual(pilot.official_limits.upwork.instant_alert_requirements, [
    "FREELANCER_PLUS",
    "AT_LEAST_ONE_ACTIVE_INDIVIDUAL_PROPOSAL"
  ]);
  assert.equal(pilot.upwork_saved_searches.every((item) => item.delivery_expectation === "MANUAL_FEED_UNLESS_ACCOUNT_ALERT_ELIGIBLE"), true);
});

test("every pilot result remains signal-only until exact buyer verification", () => {
  assert.equal(pilot.truth_contract.outreach_locked_until_verified, true);
  assert.deepEqual(pilot.truth_contract.required_final_verification, [
    "ORIGINAL_DETAIL", "ACTIVE_STATUS", "BUYER_IDENTITY", "STUDIO_ELIGIBILITY",
    "DELIVERABLE", "BUDGET_PROVENANCE", "APPLICATION_ROUTE"
  ]);
  assert.equal(pilot.truth_contract.linkedin_role, "SIGNAL_ONLY_EMPLOYMENT_BIASED");
  assert.equal(pilot.truth_contract.upwork_saved_search_role, "OPERATOR_REVIEW_FEED");
});
