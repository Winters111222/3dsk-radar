import test from "node:test";
import assert from "node:assert/strict";
import pilot from "../config/platform-alert-pilot.v1.json" with {type:"json"};
import { evaluatePlatformAlertPrecision } from "../src/server/platform-alert-precision.mjs";

const accepted = (id, overrides = {}) => ({
  id,
  platform:"upwork",
  pilot_query_id:"upwork_scan_repair",
  engagement_track:"INDIVIDUAL_FREELANCE",
  signal_url:`https://www.upwork.com/jobs/~${id}`,
  original_url:`https://www.upwork.com/jobs/~${id}`,
  reviewed_at:"2026-09-08T22:00:00Z",
  decision:"ACCEPT_A",
  opportunity_kind:"OPEN_OPPORTUNITY",
  budget_provenance:"UNKNOWN",
  original_detail_verified:true,
  active_status_verified:true,
  buyer_identity_verified:true,
  studio_eligibility_verified:false,
  individual_eligibility_verified:true,
  deliverable_verified:true,
  application_route_verified:true,
  human_subject_verified:true,
  outreach_locked:false,
  rejection_reason:"",
  ...overrides
});

const rejected = (id, overrides = {}) => accepted(id, {
  decision:"REJECT",
  opportunity_kind:"POTENTIAL_LEAD",
  original_detail_verified:false,
  outreach_locked:true,
  rejection_reason:"EMPLOYMENT_ONLY",
  ...overrides
});

test("precision passes only with at least 30 reviews and 80 percent verified A/B", () => {
  const candidates = [
    ...Array.from({length:24}, (_, index) => accepted(`a${index}`)),
    ...Array.from({length:6}, (_, index) => rejected(`r${index}`))
  ];
  const report = evaluatePlatformAlertPrecision({schema_version:1,candidates}, pilot);
  assert.equal(report.status, "SOURCE_SPECIFIC_PRECISION_PASSED");
  assert.deepEqual(report.totals, {
    reviewed_candidates:30,
    accepted_relevant_hits:24,
    accepted_a:24,
    accepted_b:0,
    measured_precision:0.8,
    partner_c:0,
    signal_d:0,
    rejected:6
  });
  assert.equal(report.runtime_activation, "LOCKED");
  assert.equal(report.outreach_automation_enabled, false);
  assert.equal(report.source_gates.upwork.status, "PRECISION_PASSED");
  assert.equal(report.source_gates.linkedin.status, "PRECISION_NOT_PASSED");
  assert.equal(report.source_gates.freelancer.status, "PRECISION_NOT_PASSED");
});

test("small or noisy samples stay locked and expose per-source and per-query yield", () => {
  const candidates = [
    accepted("one"),
    rejected("two", {platform:"linkedin",pilot_query_id:"linkedin_character_artist",engagement_track:"B2B_STUDIO",signal_url:"https://www.linkedin.com/jobs/view/2/",original_url:"https://www.linkedin.com/jobs/view/2/"})
  ];
  const report = evaluatePlatformAlertPrecision({schema_version:1,candidates}, pilot);
  assert.equal(report.status, "SOURCE_SPECIFIC_PRECISION_NOT_PASSED");
  assert.equal(report.gates.sample_size_passed, false);
  assert.equal(report.gates.precision_passed, false);
  assert.equal(report.source_breakdown.linkedin.measured_precision, 0);
  assert.equal(report.source_breakdown.upwork.measured_precision, 1);
  assert.equal(report.source_gates.upwork.sample_size_passed, false);
  assert.equal(report.track_breakdown.INDIVIDUAL_FREELANCE.measured_precision, 1);
  assert.equal(report.track_breakdown.B2B_STUDIO.reviewed_candidates, 1);
  assert.equal(report.track_breakdown.B2B_STUDIO.measured_precision, 0);
  assert.equal(report.query_breakdown.linkedin_character_artist.reviewed_candidates, 1);
});

test("LinkedIn A/B requires resolution beyond the employment-platform signal", () => {
  assert.throws(
    () => evaluatePlatformAlertPrecision({schema_version:1,candidates:[accepted("li", {
      platform:"linkedin",
      pilot_query_id:"linkedin_character_artist",
      signal_url:"https://www.linkedin.com/jobs/view/1/",
      original_url:"https://www.linkedin.com/jobs/view/1/"
    })]}, pilot),
    /PLATFORM_ALERT_LINKEDIN_ORIGINAL_BUYER_SOURCE_REQUIRED/
  );
});

test("A/B cannot pass without every truth gate", () => {
  assert.throws(
    () => evaluatePlatformAlertPrecision({schema_version:1,candidates:[accepted("bad", {buyer_identity_verified:false})]}, pilot),
    /PLATFORM_ALERT_ACCEPTED_BUYER_IDENTITY_VERIFIED_REQUIRED/
  );
});

test("selected engagement track requires its own eligibility proof", () => {
  assert.throws(
    () => evaluatePlatformAlertPrecision({schema_version:1,candidates:[accepted("individual", {individual_eligibility_verified:false})]}, pilot),
    /PLATFORM_ALERT_ACCEPTED_INDIVIDUAL_ELIGIBILITY_VERIFIED_REQUIRED/
  );
  const b2b = accepted("b2b", {
    engagement_track:"B2B_STUDIO",
    studio_eligibility_verified:true,
    individual_eligibility_verified:false
  });
  assert.equal(evaluatePlatformAlertPrecision({schema_version:1,candidates:[b2b]}, pilot).track_breakdown.B2B_STUDIO.accepted_relevant_hits, 1);
});

test("Freelancer is a manual review lane and not an automated connector", () => {
  const item = accepted("freelancer", {
    platform:"freelancer",
    pilot_query_id:"freelancer_human_scan_cleanup",
    signal_url:"https://www.freelancer.com/projects/zbrush/example-human-scan-cleanup",
    original_url:"https://www.freelancer.com/projects/zbrush/example-human-scan-cleanup"
  });
  const report = evaluatePlatformAlertPrecision({schema_version:1,candidates:[item]}, pilot);
  assert.equal(report.source_breakdown.freelancer.accepted_relevant_hits, 1);
  assert.equal(report.runtime_activation, "LOCKED");
});

test("non-sales outcomes require an outreach lock and explicit reason", () => {
  assert.throws(
    () => evaluatePlatformAlertPrecision({schema_version:1,candidates:[rejected("bad", {outreach_locked:false})]}, pilot),
    /PLATFORM_ALERT_NONSALES_OUTREACH_LOCK_REQUIRED/
  );
});

test("generic mesh-repair microtasks cannot become A/B without verified human subject evidence", () => {
  assert.throws(
    () => evaluatePlatformAlertPrecision({schema_version:1,candidates:[accepted("object-mesh", {
      pilot_query_id:"upwork_3d_mesh_repair",
      human_subject_verified:false
    })]}, pilot),
    /PLATFORM_ALERT_ACCEPTED_HUMAN_SUBJECT_VERIFIED_REQUIRED/
  );
});

test("live-calibrated pilot records only created alerts and keeps runtime locked", () => {
  assert.deepEqual(pilot.operator_observations.linkedin.created_alert_ids, ["linkedin_character_artist"]);
  assert.deepEqual(pilot.operator_observations.upwork.created_saved_search_ids, [
    "upwork_scan_repair",
    "upwork_human_scans",
    "upwork_3d_mesh_repair",
    "upwork_zbrush_scan_cleanup",
    "upwork_3d_scan_retopology"
  ]);
  assert.equal(pilot.operator_observations.upwork.upwork_scan_repair_observed_results, 8);
  assert.equal(pilot.operator_observations.upwork.upwork_human_scans_direct_matches, 1);
  assert.equal(pilot.operator_observations.upwork.upwork_wrap_fitting_observed_results, 0);
  assert.equal(pilot.linkedin_job_alerts.find((item) => item.id === "linkedin_character_artist").enabled, false);
  assert.equal(pilot.upwork_saved_searches.find((item) => item.id === "upwork_scan_repair").enabled, false);
  assert.equal(pilot.upwork_saved_searches.find((item) => item.id === "upwork_human_scans").enabled, false);
  assert.equal(pilot.production_import_enabled, false);
});
