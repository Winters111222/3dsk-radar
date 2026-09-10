import test from "node:test";
import assert from "node:assert/strict";
import pilot from "../config/platform-alert-pilot.v1.json" with {type:"json"};
import prospective from "../config/prospective-yield-plan.v1.json" with {type:"json"};

test("platform alert pilot stays within official counts and default-off", () => {
  assert.equal(pilot.status, "OPERATOR_SETUP_REQUIRED_RUNTIME_LOCKED");
  assert.equal(pilot.linkedin_job_alerts.length, 8);
  assert.equal(pilot.upwork_saved_searches.length, 11);
  assert.equal(pilot.freelancer_manual_watchlists.length, 2);
  assert.ok(pilot.linkedin_job_alerts.length <= pilot.official_limits.linkedin.maximum_job_alerts);
  assert.ok(pilot.upwork_saved_searches.length <= pilot.official_limits.upwork.maximum_saved_searches);
  assert.equal(pilot.official_limits.freelancer.automation_permission_required, true);
  assert.equal(pilot.freelancer_manual_watchlists.every((item) => item.enabled === false && item.automation_permission === "REQUIRED_NOT_GRANTED"), true);
  assert.equal([...pilot.linkedin_job_alerts, ...pilot.upwork_saved_searches].every((item) => item.enabled === false), true);
  assert.deepEqual([
    pilot.scheduled_collection_enabled,
    pilot.automatic_account_changes_enabled,
    pilot.production_import_enabled
  ], [false, false, false]);
});

test("human scan microtasks include single assets but fail closed on generic object meshes", () => {
  const lane = pilot.acquisition_lanes.find((item) => item.id === "HUMAN_SCAN_MICROTASK");
  assert.equal(lane.single_asset_allowed, true);
  assert.equal(lane.generic_object_meshes_allowed, false);
  assert.equal(lane.runtime_activation, "LOCKED");
  const microtasks = pilot.upwork_saved_searches.filter((item) => item.lane === "HUMAN_SCAN_MICROTASK");
  assert.deepEqual(microtasks.map((item) => item.id), [
    "upwork_human_scans",
    "upwork_3d_mesh_repair",
    "upwork_zbrush_scan_cleanup",
    "upwork_3d_scan_retopology"
  ]);
  assert.equal(microtasks.every((item) => item.human_subject_required === true), true);
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
    "ORIGINAL_DETAIL", "ACTIVE_STATUS", "BUYER_IDENTITY", "SELECTED_TRACK_ELIGIBILITY",
    "DELIVERABLE", "BUDGET_PROVENANCE", "APPLICATION_ROUTE"
  ]);
  assert.equal(pilot.truth_contract.linkedin_role, "SIGNAL_ONLY_EMPLOYMENT_BIASED");
  assert.equal(pilot.truth_contract.upwork_saved_search_role, "OPERATOR_REVIEW_FEED");
});

test("30-day prospective plan starts only by operator action and preserves every lock", () => {
  assert.equal(prospective.duration_days, 30);
  assert.equal(prospective.started_at, null);
  assert.equal(prospective.ends_at, null);
  assert.equal(prospective.runtime_activation, "LOCKED");
  assert.equal(prospective.automatic_collection_enabled, false);
  assert.equal(prospective.automatic_platform_login_enabled, false);
  assert.equal(prospective.automatic_outreach_enabled, false);
  assert.equal(prospective.production_import_enabled, false);
  assert.equal(prospective.paid_search_enabled, false);
  assert.deepEqual(prospective.tracks.map((item) => item.id), ["B2B_STUDIO", "INDIVIDUAL_FREELANCE"]);
  assert.deepEqual(prospective.operator_sources.map((item) => item.platform), ["linkedin", "upwork", "freelancer"]);
  assert.equal(prospective.starting_watchlist.length, 3);
  const upwork = prospective.starting_watchlist.find((item) => item.id === "upwork_full_body_human_scan_cleanup_ongoing");
  assert.equal(upwork.track, "INDIVIDUAL_FREELANCE");
  assert.equal(upwork.status, "REVERIFY_LOGGED_IN_APPLICATION_ROUTE_AND_CLIENT");
  assert.match(upwork.original_url, /^https:\/\/www\.upwork\.com\/freelance-jobs\/apply\//);
  assert.ok(upwork.public_facts.includes("REALITYCAPTURE_RAW_OUTPUT"));
  assert.ok(upwork.public_facts.includes("PAID_TEST"));
  assert.equal(upwork.sales_import_enabled, false);
  assert.equal(upwork.outreach_locked, true);
  const likeness = prospective.starting_watchlist.find((item) => item.id === "upwork_two_photorealistic_children_busts");
  assert.equal(likeness.track, "INDIVIDUAL_FREELANCE");
  assert.equal(likeness.qualification, "SIGNAL_D");
  assert.equal(likeness.status, "VERIFIED_ACTIVE_WATCH_BUDGET_UNKNOWN");
  assert.match(likeness.original_url, /^https:\/\/www\.upwork\.com\/freelance-jobs\/apply\//);
  assert.ok(likeness.public_facts.includes("TWO_PHOTOREALISTIC_HUMAN_BUSTS"));
  assert.ok(likeness.operator_verified_facts.includes("PAYMENT_VERIFIED"));
  assert.ok(likeness.operator_verified_facts.includes("LOGGED_IN_APPLICATION_ROUTE_VISIBLE"));
  assert.ok(likeness.missing_truth.includes("BUYER_RATE_OR_FIXED_BUDGET"));
  assert.equal(likeness.sales_import_enabled, false);
  assert.equal(likeness.outreach_locked, true);
  assert.equal(prospective.starting_watchlist.find((item) => item.id === "fl_unity_realistic").status, "REVERIFY_BEFORE_COUNTING");
});
