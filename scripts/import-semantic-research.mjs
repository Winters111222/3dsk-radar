#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const EXPECTED_SHA256 = "a5c8f7dafc5c845668b5dbaa0e30dcb9422b1bf2f7266ed9a495d55426605470";
const EXPECTED_COUNTS = Object.freeze({ sources:47, queries:64, candidates:107, partners:5, watchlist:32, rejected:70 });
const SOURCE_ALIASES = Object.freeze({
  upwork_public:"upwork",
  ted:"ted_eu",
  nen_culture:"nen_cz",
  vvz_isvz:"isvz_vvz_cz",
  freelancer:"freelancer_3d",
  polycount_paid:"polycount_paid",
  blender_artists_paid:"blender_paid",
  epic_contract:"unreal_job_offerings",
  find_a_tender_uk:"find_tender_uk",
  contracts_finder:"contracts_finder_uk",
  public_contracts_scotland:"pcs_scotland",
  uvo_evo:"uvo_sk",
  eu_partner_search:"eu_funding_partner_search",
  sam_gov:"sam_us",
  undp_notices:"undp"
});

function fail(code) {
  throw Object.assign(new Error(code), { code });
}

function exactCount(actual, expected, code) {
  if (!Array.isArray(actual) || actual.length !== expected) fail(code);
}

function cleanUrl(value) {
  const url = new URL(String(value || ""));
  if (url.protocol !== "https:" || url.username || url.password) fail("SEMANTIC_RESEARCH_URL_INVALID");
  return url.toString();
}

const input = process.argv[2];
const output = process.argv[3];
if (!input || !output || process.argv.length !== 4) {
  console.error("Usage: node scripts/import-semantic-research.mjs <manifest.json> <derived.json>");
  process.exit(2);
}

try {
  const raw = await readFile(input);
  const sha256 = createHash("sha256").update(raw).digest("hex");
  if (sha256 !== EXPECTED_SHA256) fail("SEMANTIC_RESEARCH_SHA_MISMATCH");
  const source = JSON.parse(raw);
  if (source.schema_version !== 1 || source.scope !== "SEMANTIC_BUYER_INTENT_EVENT_DRIVEN" || source.automation_activated !== false) {
    fail("SEMANTIC_RESEARCH_CONTRACT_INVALID");
  }
  exactCount(source.sources, EXPECTED_COUNTS.sources, "SEMANTIC_RESEARCH_SOURCE_COUNT_MISMATCH");
  exactCount(source.queries, EXPECTED_COUNTS.queries, "SEMANTIC_RESEARCH_QUERY_COUNT_MISMATCH");
  exactCount(source.candidate_ledger, EXPECTED_COUNTS.candidates, "SEMANTIC_RESEARCH_CANDIDATE_COUNT_MISMATCH");
  exactCount(source.usable_results, EXPECTED_COUNTS.partners, "SEMANTIC_RESEARCH_PARTNER_COUNT_MISMATCH");
  exactCount(source.watchlist, EXPECTED_COUNTS.watchlist, "SEMANTIC_RESEARCH_WATCHLIST_COUNT_MISMATCH");
  const rejected = source.candidate_ledger.filter((item) => !["C", "D"].includes(item.class));
  exactCount(rejected, EXPECTED_COUNTS.rejected, "SEMANTIC_RESEARCH_REJECT_COUNT_MISMATCH");
  if (source.usable_results.some((item) => item.class !== "C" || item.accepting_external_bids_verified !== false)) {
    fail("SEMANTIC_RESEARCH_PARTNER_TRUTH_MISMATCH");
  }

  const derived = {
    schema_version:1,
    generated_at:source.generated_at,
    as_of_date:source.as_of_date,
    source_manifest_sha256:sha256,
    status:"RESEARCH_ONLY_RUNTIME_LOCKED",
    scheduled_collection_enabled:false,
    automatic_paid_execution_enabled:false,
    production_import_enabled:false,
    mandatory_pipeline:[...source.mandatory_pipeline],
    geography_rule:source.geography_rule,
    counts:{...EXPECTED_COUNTS,A:0,B:0,C:EXPECTED_COUNTS.partners,D:EXPECTED_COUNTS.watchlist},
    sources:source.sources.map((item) => ({
      id:item.id,
      canonical_source_id:SOURCE_ALIASES[item.id] || item.id,
      name:item.name,
      lane:item.lane,
      source_type:item.source_type,
      watchlist_urls:(item.watchlist_urls || []).map(cleanUrl),
      access_method:item.access_method,
      verification_status:item.verification_status,
      activation_state:item.activation_state,
      credential_required:item.credential_required,
      api_approval_required:item.api_approval_required
    })),
    queries:source.queries.map((item) => ({
      query_id:item.query_id,
      language:item.language,
      category:item.category,
      source_id:item.source_id,
      canonical_source_id:SOURCE_ALIASES[item.source_id] || item.source_id,
      native_query:item.native_query,
      web_discovery_query:item.web_discovery_query,
      followup_query:item.followup_query,
      native_filters:item.native_filters,
      geography_rule:item.geography_rule,
      wrap_refinement:item.wrap_refinement || null,
      enabled:false
    })),
    classification_rules:source.classification_rules,
    verification_gates:source.verification_gates,
    partner_watchlist:source.usable_results.map((item) => ({
      id:item.id,
      source_id:item.source_id,
      title:item.title,
      organization:item.organization,
      class:"C",
      original_url:cleanUrl(item.original_url),
      evidence_urls:item.evidence_urls.map(cleanUrl),
      reason_code:item.reason_code,
      verified_fact:item.verified_fact,
      reasoned_inference:item.reasoned_inference,
      unverified_hypothesis:item.unverified_hypothesis,
      production_problem:item.production_problem,
      service_mapping:item.service_mapping,
      project_end:item.project_end || null,
      accepting_external_bids_verified:false,
      sales_use:"PARTNER_QUALIFICATION_AFTER_MANUAL_REVIEW",
      outreach_locked:true,
      manual_verification:item.manual_verification
    })),
    evaluation_cases:source.candidate_ledger.map((item) => ({
      id:item.id,
      source_id:item.source_id,
      class:item.class || "REJECT",
      reason_code:item.reason_code,
      basic_relevance_pass:Boolean(item.basic_relevance_pass),
      original_url:cleanUrl(item.original_url),
      accepting_external_bids_verified:Boolean(item.accepting_external_bids_verified),
      sales_use:item.sales_use,
      evaluation:item.evaluation
    }))
  };
  await writeFile(output, `${JSON.stringify(derived, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ ok:true, output, sha256, counts:derived.counts }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok:false, error:String(error?.code || error?.message || "SEMANTIC_RESEARCH_IMPORT_FAILED") }));
  process.exitCode = 1;
}
