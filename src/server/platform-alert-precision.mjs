const DECISIONS = new Set(["ACCEPT_A", "ACCEPT_B", "PARTNER_C", "SIGNAL_D", "REJECT"]);
const PLATFORMS = new Set(["linkedin", "upwork"]);
const BUDGET_PROVENANCE = new Set(["PUBLISHED", "ESTIMATED", "UNKNOWN"]);
const REQUIRED_TRUTH = [
  "original_detail_verified",
  "active_status_verified",
  "buyer_identity_verified",
  "studio_eligibility_verified",
  "deliverable_verified",
  "application_route_verified"
];

function assert(condition, code) {
  if (!condition) throw Object.assign(new Error(code), { code });
}

function isPlatformUrl(value, platform) {
  let url;
  try { url = new URL(value); } catch { return false; }
  const root = platform === "linkedin" ? "linkedin.com" : "upwork.com";
  return url.protocol === "https:" && (url.hostname === root || url.hostname.endsWith(`.${root}`));
}

function isPublicHttpsUrl(value) {
  let url;
  try { url = new URL(value); } catch { return false; }
  return url.protocol === "https:" && !url.username && !url.password
    && url.hostname.includes(".")
    && !/^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|\[)/.test(url.hostname);
}

export function evaluatePlatformAlertPrecision(review, pilot, policy = {}) {
  assert(review?.schema_version === 1, "PLATFORM_ALERT_REVIEW_SCHEMA_INVALID");
  assert(Array.isArray(review?.candidates), "PLATFORM_ALERT_REVIEW_CANDIDATES_REQUIRED");
  const minimumReviewed = Number(policy.minimum_reviewed_candidates ?? 30);
  const minimumPrecision = Number(policy.minimum_precision ?? 0.8);
  assert(Number.isSafeInteger(minimumReviewed) && minimumReviewed > 0, "PLATFORM_ALERT_POLICY_REVIEW_COUNT_INVALID");
  assert(Number.isFinite(minimumPrecision) && minimumPrecision > 0 && minimumPrecision <= 1, "PLATFORM_ALERT_POLICY_PRECISION_INVALID");

  const queryPlatform = new Map([
    ...pilot.linkedin_job_alerts.map((item) => [item.id, "linkedin"]),
    ...pilot.upwork_saved_searches.map((item) => [item.id, "upwork"])
  ]);
  const humanRequiredQueries = new Set(pilot.upwork_saved_searches
    .filter((item) => item.human_subject_required === true)
    .map((item) => item.id));
  const ids = new Set();
  const rows = review.candidates.map((candidate) => {
    assert(candidate && typeof candidate === "object", "PLATFORM_ALERT_CANDIDATE_INVALID");
    assert(typeof candidate.id === "string" && candidate.id.trim(), "PLATFORM_ALERT_CANDIDATE_ID_REQUIRED");
    assert(!ids.has(candidate.id), "PLATFORM_ALERT_CANDIDATE_ID_DUPLICATE");
    ids.add(candidate.id);
    assert(PLATFORMS.has(candidate.platform), "PLATFORM_ALERT_PLATFORM_INVALID");
    assert(queryPlatform.get(candidate.pilot_query_id) === candidate.platform, "PLATFORM_ALERT_QUERY_INVALID");
    assert(isPlatformUrl(candidate.signal_url, candidate.platform), "PLATFORM_ALERT_SIGNAL_URL_INVALID");
    assert(isPublicHttpsUrl(candidate.original_url), "PLATFORM_ALERT_ORIGINAL_URL_INVALID");
    assert(DECISIONS.has(candidate.decision), "PLATFORM_ALERT_DECISION_INVALID");
    assert(typeof candidate.reviewed_at === "string" && !Number.isNaN(Date.parse(candidate.reviewed_at)), "PLATFORM_ALERT_REVIEW_DATE_INVALID");
    assert(BUDGET_PROVENANCE.has(candidate.budget_provenance), "PLATFORM_ALERT_BUDGET_PROVENANCE_INVALID");
    assert(typeof candidate.rejection_reason === "string", "PLATFORM_ALERT_REJECTION_REASON_REQUIRED");

    const accepted = candidate.decision === "ACCEPT_A" || candidate.decision === "ACCEPT_B";
    if (accepted) {
      for (const field of REQUIRED_TRUTH) assert(candidate[field] === true, `PLATFORM_ALERT_ACCEPTED_${field.toUpperCase()}_REQUIRED`);
      assert(candidate.opportunity_kind === "OPEN_OPPORTUNITY", "PLATFORM_ALERT_ACCEPTED_OPEN_OPPORTUNITY_REQUIRED");
      if (humanRequiredQueries.has(candidate.pilot_query_id)) {
        assert(candidate.human_subject_verified === true, "PLATFORM_ALERT_ACCEPTED_HUMAN_SUBJECT_VERIFIED_REQUIRED");
      }
      if (candidate.platform === "linkedin") assert(!isPlatformUrl(candidate.original_url, "linkedin"), "PLATFORM_ALERT_LINKEDIN_ORIGINAL_BUYER_SOURCE_REQUIRED");
      assert(candidate.rejection_reason === "", "PLATFORM_ALERT_ACCEPTED_REJECTION_REASON_FORBIDDEN");
    } else {
      assert(candidate.outreach_locked === true, "PLATFORM_ALERT_NONSALES_OUTREACH_LOCK_REQUIRED");
      assert(candidate.rejection_reason.trim(), "PLATFORM_ALERT_NONSALES_REASON_REQUIRED");
    }
    return { ...candidate, accepted };
  });

  const summarize = (items) => {
    const accepted = items.filter((item) => item.accepted).length;
    return {
      reviewed_candidates:items.length,
      accepted_relevant_hits:accepted,
      measured_precision:items.length ? accepted / items.length : null,
      partner_c:items.filter((item) => item.decision === "PARTNER_C").length,
      signal_d:items.filter((item) => item.decision === "SIGNAL_D").length,
      rejected:items.filter((item) => item.decision === "REJECT").length
    };
  };
  const totals = summarize(rows);
  const source_breakdown = Object.fromEntries([...PLATFORMS].map((platform) => [platform, summarize(rows.filter((item) => item.platform === platform))]));
  const query_breakdown = Object.fromEntries([...queryPlatform.keys()].map((queryId) => [queryId, summarize(rows.filter((item) => item.pilot_query_id === queryId))]));
  const precisionPassed = totals.measured_precision !== null && totals.measured_precision >= minimumPrecision;
  const samplePassed = totals.reviewed_candidates >= minimumReviewed;

  return {
    status:samplePassed && precisionPassed ? "SOURCE_SPECIFIC_PRECISION_PASSED" : "SOURCE_SPECIFIC_PRECISION_NOT_PASSED",
    runtime_activation:"LOCKED",
    outreach_automation_enabled:false,
    policy:{ minimum_reviewed_candidates:minimumReviewed, minimum_precision:minimumPrecision, precision_definition:"accepted_relevant_hits / reviewed_candidates" },
    totals,
    source_breakdown,
    query_breakdown,
    gates:{ sample_size_passed:samplePassed, precision_passed:precisionPassed }
  };
}
