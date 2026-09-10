#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const EXPECTED_SHA256 = "24ebea09ade45e4b169da72fca7f7a3c9dbf6efb6ce1065b6d262e709edc89b2";
const SUPPORTING_ARTIFACT_SHA256 = Object.freeze({
  evidence_xlsx:"005e49e8189c9d3fbce10d8c0df6bfa7cf538167a8e4f88f50625d9e8573dbe4",
  report_docx:"83bb18cfdc9c7cd5dd33b4d998281a63237e94217516151faf5dc6a7fe7ac7fe"
});
const EXPECTED = Object.freeze({
  sources:54, queries:96, candidates:133, priorities:20,
  baseline:107, new_candidates:26, detail_reviews:30,
  A:0, B:1, C:4, D:34, REJECT:94
});
const TRACKS = Object.freeze(["B2B_STUDIO", "INDIVIDUAL_FREELANCE"]);
const CLASSES = Object.freeze(["A", "B", "C", "D", "REJECT"]);
const SOURCE_ALIASES = Object.freeze({
  upwork_public:"upwork",
  ted:"ted_eu",
  nen_culture:"nen_cz",
  vvz_isvz:"isvz_vvz_cz",
  freelancer:"freelancer_3d",
  polycount_paid:"polycount_paid",
  blender_artists_paid:"blender_paid",
  epic_contract:"unreal_job_offerings",
  een_requests:"een_requests",
  public_contracts_scotland:"pcs_scotland",
  sam_gov:"sam_us",
  undp_notices:"undp",
  ungm:"ungm",
  find_a_tender_uk:"find_tender_uk",
  contracts_finder:"contracts_finder_uk",
  peopleperhour:"peopleperhour_3d",
  guru:"guru_3d",
  eu_partner_search:"eu_funding_partner_search",
  sony_pictures_suppliers:"sony_pictures_supplier",
  reddit_buyer_communities:"reddit_gamedevclassifieds"
});

function fail(code) {
  throw Object.assign(new Error(code), { code });
}

function exactCount(value, expected, code) {
  if (!Array.isArray(value) || value.length !== expected) fail(code);
}

function countBy(items, key) {
  return Object.fromEntries(CLASSES.map((value) => [value, items.filter((item) => item[key] === value).length]));
}

function cleanUrl(value) {
  const url = new URL(String(value || ""));
  if (url.protocol !== "https:" || url.username || url.password) fail("DUAL_TRACK_RESEARCH_URL_INVALID");
  return url.toString();
}

function cleanUrls(values) {
  if (values == null) return [];
  const list = Array.isArray(values) ? values : [values];
  return [...new Set(list.filter(Boolean).map(cleanUrl))];
}

function eligibility(value) {
  const status = String(value?.status || "UNKNOWN").toUpperCase();
  if (!["PROVEN", "NO", "UNKNOWN"].includes(status)) fail("DUAL_TRACK_RESEARCH_ELIGIBILITY_INVALID");
  return { status, evidence:value?.evidence || null };
}

const input = process.argv[2];
const output = process.argv[3];
if (!input || !output || process.argv.length !== 4) {
  console.error("Usage: node scripts/import-dual-track-research.mjs <manifest.json> <derived.json>");
  process.exit(2);
}

try {
  const raw = await readFile(input);
  const sha256 = createHash("sha256").update(raw).digest("hex");
  if (sha256 !== EXPECTED_SHA256) fail("DUAL_TRACK_RESEARCH_SHA_MISMATCH");
  const source = JSON.parse(raw);
  if (source.schema_version !== 1 || source.schema_profile !== "3dsk_dual_track_research_v1") fail("DUAL_TRACK_RESEARCH_CONTRACT_INVALID");
  if (source.enabled !== false || source.runtime_locked !== true || source.automation_activated !== false || source.outreach_locked !== true) fail("DUAL_TRACK_RESEARCH_LOCK_MISMATCH");
  if (JSON.stringify(source.scope?.engagement_tracks) !== JSON.stringify(TRACKS)) fail("DUAL_TRACK_RESEARCH_TRACK_MISMATCH");
  exactCount(source.sources, EXPECTED.sources, "DUAL_TRACK_RESEARCH_SOURCE_COUNT_MISMATCH");
  exactCount(source.queries, EXPECTED.queries, "DUAL_TRACK_RESEARCH_QUERY_COUNT_MISMATCH");
  exactCount(source.candidate_ledger, EXPECTED.candidates, "DUAL_TRACK_RESEARCH_CANDIDATE_COUNT_MISMATCH");
  exactCount(source.top20, EXPECTED.priorities, "DUAL_TRACK_RESEARCH_PRIORITY_COUNT_MISMATCH");
  exactCount(source.active_opportunities, EXPECTED.B, "DUAL_TRACK_RESEARCH_ACTIVE_COUNT_MISMATCH");
  exactCount(source.partner_signals, EXPECTED.C, "DUAL_TRACK_RESEARCH_PARTNER_COUNT_MISMATCH");
  exactCount(source.watchlist, EXPECTED.D, "DUAL_TRACK_RESEARCH_WATCHLIST_COUNT_MISMATCH");

  const classes = countBy(source.candidate_ledger, "classification");
  for (const key of CLASSES) if (classes[key] !== EXPECTED[key]) fail(`DUAL_TRACK_RESEARCH_${key}_COUNT_MISMATCH`);
  if (source.funnel?.baseline_candidates !== EXPECTED.baseline || source.funnel?.new_candidates_this_run !== EXPECTED.new_candidates || source.funnel?.fresh_original_detail_reviews_this_run !== EXPECTED.detail_reviews) fail("DUAL_TRACK_RESEARCH_COHORT_COUNT_MISMATCH");
  if (source.sources.some((item) => item.enabled !== false || item.automation_activated !== false || item.outreach_locked !== true)) fail("DUAL_TRACK_RESEARCH_SOURCE_UNLOCKED");
  if (source.queries.some((item) => item.enabled !== false || !TRACKS.includes(item.engagement_track))) fail("DUAL_TRACK_RESEARCH_QUERY_UNLOCKED");
  if (source.top20.some((item) => item.enabled !== false)) fail("DUAL_TRACK_RESEARCH_PRIORITY_UNLOCKED");
  if (source.candidate_ledger.some((item) => item.enabled !== false || item.outreach_locked !== true || !TRACKS.includes(item.engagement_track))) fail("DUAL_TRACK_RESEARCH_CANDIDATE_UNLOCKED");

  const active = source.active_opportunities[0];
  if (active?.classification !== "B" || active?.engagement_track !== "INDIVIDUAL_FREELANCE" || active?.accepting_applications_verified !== true || active?.active_opportunity_countable !== true || eligibility(active.individual_eligibility).status !== "PROVEN") fail("DUAL_TRACK_RESEARCH_B_TRUTH_MISMATCH");
  if (source.partner_signals.some((item) => item.classification !== "C" || item.accepting_applications_verified !== false || item.active_opportunity_countable !== false)) fail("DUAL_TRACK_RESEARCH_PARTNER_TRUTH_MISMATCH");

  const derived = {
    schema_version:1,
    schema_profile:"3dsk_dual_track_research_derived_v1",
    generated_at:source.generated_at,
    as_of_date:source.as_of_date,
    source_artifact_sha256:{ manifest_json:sha256, ...SUPPORTING_ARTIFACT_SHA256 },
    status:"RESEARCH_ONLY_RUNTIME_LOCKED",
    runtime_locked:true,
    scheduled_collection_enabled:false,
    automatic_paid_execution_enabled:false,
    production_import_enabled:false,
    outreach_enabled:false,
    scope:{
      engagement_tracks:[...TRACKS],
      mandatory_pipeline:[...source.scope.mandatory_pipeline],
      optional_tools:[...source.scope.optional_tools],
      geography_rule:source.scope.geography_rule,
      excluded_scope:[...source.scope.excluded_scope],
      classification_semantics:{...source.scope.classification_semantics}
    },
    counts:{
      ...EXPECTED,
      active_opportunity_watchlist:EXPECTED.B,
      partner_watchlist:EXPECTED.C,
      watchlist:EXPECTED.D,
      rejected:EXPECTED.REJECT,
      by_track:source.funnel.by_track,
      by_cohort:source.funnel.by_cohort
    },
    sources:source.sources.map((item) => ({
      id:item.id,
      canonical_source_id:SOURCE_ALIASES[item.id] || item.id,
      name:item.name || item.source_name,
      engagement_tracks:[...(item.engagement_track || [])],
      lane:item.lane || item.coverage_lane,
      source_type:item.source_type,
      watchlist_urls:cleanUrls(item.watchlist_urls || item.watchlist_url),
      access_method:item.access_method,
      verification_status:item.verification_status,
      activation_state:item.activation_state,
      credential_required:item.credential_required,
      api_approval_required:item.api_approval_required,
      buyer_only:Boolean(item.buyer_only),
      expected_relevance:item.expected_relevance,
      expected_volume:item.expected_volume,
      implementation_difficulty:item.implementation_difficulty,
      recommended_priority:item.recommended_priority,
      enabled:false,
      runtime_eligible:false
    })),
    queries:source.queries.map((item) => ({
      query_id:item.query_id,
      language:item.language,
      engagement_track:item.engagement_track,
      category:item.category,
      source_id:item.source_id,
      canonical_source_id:SOURCE_ALIASES[item.source_id] || item.source_id,
      native_query:item.native_query,
      web_discovery_query:item.web_discovery_query,
      followup_query:item.followup_query,
      native_filters:item.native_filters,
      query_syntax_note:item.query_syntax_note,
      geography_rule:item.geography_rule,
      wrap_refinement:item.wrap_refinement || null,
      enabled:false
    })),
    integration_priorities:source.top20.map((item) => ({
      rank:item.rank,
      name:item.name,
      source_ids:[...item.source_ids],
      canonical_source_ids:item.source_ids.map((id) => SOURCE_ALIASES[id] || id),
      expected_gain:item.expected_gain,
      expected_relevance:item.expected_relevance,
      confidence:item.confidence,
      access_method:item.access_method,
      technical_difficulty:item.technical_difficulty,
      noise_risk:item.noise_risk,
      works_without_login_for_discovery:item.works_without_login_for_discovery,
      login_note:item.login_note,
      api_approval:item.api_approval,
      watchlist_urls:cleanUrls(item.watchlist_urls),
      documentation_and_onboarding_urls:cleanUrls(item.documentation_and_onboarding_urls),
      enabled:false
    })),
    active_opportunity_watchlist:source.active_opportunities.map((item) => ({
      id:item.id,
      source_id:item.source_id,
      canonical_source_id:SOURCE_ALIASES[item.source_id] || item.source_id,
      title:item.title,
      organization:item.organization,
      class:"B",
      engagement_track:item.engagement_track,
      original_url:cleanUrl(item.original_url),
      evidence_urls:cleanUrls(item.evidence_urls),
      active_state:item.active_state,
      accepting_applications_verified:true,
      individual_eligibility:eligibility(item.individual_eligibility),
      studio_eligibility:eligibility(item.studio_eligibility),
      budget_min:item.budget_min,
      budget_max:item.budget_max,
      budget_currency:item.budget_currency,
      budget_basis:item.budget_basis,
      budget_provenance_url:item.budget_provenance_url ? cleanUrl(item.budget_provenance_url) : null,
      production_problem:item.production_problem,
      missing_truth:item.missing_truth,
      application_route:item.application_route,
      manual_verification:item.manual_verification,
      sales_use:"MANUAL_TECHNICAL_QUALIFICATION_ONLY",
      outreach_locked:true,
      production_import_enabled:false
    })),
    partner_watchlist:source.partner_signals.map((item) => ({
      id:item.id,
      source_id:item.source_id,
      title:item.title,
      organization:item.organization,
      class:"C",
      engagement_track:item.engagement_track,
      original_url:cleanUrl(item.original_url),
      evidence_urls:cleanUrls(item.evidence_urls),
      reason_code:item.reason_code,
      verified_fact:item.verified_fact,
      reasoned_inference:item.reasoned_inference,
      unverified_hypothesis:item.unverified_hypothesis,
      production_problem:item.production_problem,
      service_mapping:item.service_mapping,
      project_end:item.project_end || null,
      accepting_applications_verified:false,
      sales_use:"PARTNER_QUALIFICATION_AFTER_MANUAL_REVIEW",
      outreach_locked:true,
      production_import_enabled:false,
      manual_verification:item.manual_verification
    })),
    evaluation_cases:source.candidate_ledger.map((item) => ({
      id:item.id,
      source_id:item.source_id,
      canonical_source_id:SOURCE_ALIASES[item.source_id] || item.source_id,
      engagement_track:item.engagement_track,
      class:item.classification,
      cohort:item.cohort,
      reason_code:item.reason_code,
      basic_relevance_pass:Boolean(item.basic_relevance_pass),
      original_url:cleanUrl(item.original_url),
      active_state:item.active_state,
      accepting_applications_verified:Boolean(item.accepting_applications_verified),
      active_opportunity_countable:Boolean(item.active_opportunity_countable),
      sales_use:item.sales_use,
      evaluation:item.evaluation,
      outreach_locked:true
    })),
    classification_rules:source.classification_rules.map((item) => ({...item,enabled:false})),
    source_yield:source.source_yield,
    forecast:source.forecast,
    limitations:[...source.limitations],
    target_10_A_B_met:false
  };

  await writeFile(output, `${JSON.stringify(derived, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ ok:true, output, sha256, counts:derived.counts }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok:false, error:String(error?.code || error?.message || "DUAL_TRACK_RESEARCH_IMPORT_FAILED") }));
  process.exitCode = 1;
}
