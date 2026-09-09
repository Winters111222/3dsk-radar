import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const raw = await readFile(new URL("../config/dual-track-research-derived.v1.json", import.meta.url), "utf8");
const research = JSON.parse(raw);

test("Astra dual-track research is provenance-bound and cannot activate runtime", () => {
  assert.deepEqual(research.source_artifact_sha256, {
    manifest_json:"24ebea09ade45e4b169da72fca7f7a3c9dbf6efb6ce1065b6d262e709edc89b2",
    evidence_xlsx:"005e49e8189c9d3fbce10d8c0df6bfa7cf538167a8e4f88f50625d9e8573dbe4",
    report_docx:"83bb18cfdc9c7cd5dd33b4d998281a63237e94217516151faf5dc6a7fe7ac7fe"
  });
  assert.equal(research.status, "RESEARCH_ONLY_RUNTIME_LOCKED");
  assert.equal(research.runtime_locked, true);
  assert.equal(research.scheduled_collection_enabled, false);
  assert.equal(research.automatic_paid_execution_enabled, false);
  assert.equal(research.production_import_enabled, false);
  assert.equal(research.outreach_enabled, false);
});

test("all three Astra artifacts reconcile to the exact dual-track funnel", () => {
  assert.equal(research.counts.sources, 54);
  assert.equal(research.counts.queries, 96);
  assert.equal(research.counts.candidates, 133);
  assert.equal(research.counts.priorities, 20);
  assert.equal(research.counts.baseline, 107);
  assert.equal(research.counts.new_candidates, 26);
  assert.equal(research.counts.detail_reviews, 30);
  assert.deepEqual(
    Object.fromEntries(["A","B","C","D","REJECT"].map((value) => [value,research.evaluation_cases.filter((item) => item.class === value).length])),
    {A:0,B:1,C:4,D:34,REJECT:94}
  );
  assert.deepEqual(research.counts.by_track, {
    B2B_STUDIO:{A:0,B:0,C:4,D:20,REJECT:61},
    INDIVIDUAL_FREELANCE:{A:0,B:1,C:0,D:14,REJECT:33}
  });
  assert.equal(research.target_10_A_B_met, false);
});

test("96 query drafts preserve both tracks, twelve intents and eight languages while disabled", () => {
  assert.deepEqual([...new Set(research.queries.map((item) => item.engagement_track))].sort(), ["B2B_STUDIO","INDIVIDUAL_FREELANCE"]);
  assert.deepEqual([...new Set(research.queries.map((item) => item.language))].sort(), ["CS","DE","EN","ES","FR","IT","PL","SK"]);
  assert.deepEqual([...new Set(research.queries.map((item) => item.category))].sort(), [
    "AI_DATASET_CAPTURE", "CHARACTER_FINISHING", "HERITAGE_FUNDED", "HUMAN_DIGITAL_DOUBLE",
    "LIKENESS_CLEANUP", "MUSEUM_DIGITISATION", "PHOTOGRAMMETRY_ASSETS", "REMOTE_OVERFLOW",
    "SCAN_CLEANUP_WRAP", "SINGLE_ASSET_HANDOFF", "SUPPLIED_SCAN_REPAIR", "TENDER_PLAN_AWARD"
  ]);
  assert.equal(research.queries.filter((item) => item.engagement_track === "B2B_STUDIO").length, 64);
  assert.equal(research.queries.filter((item) => item.engagement_track === "INDIVIDUAL_FREELANCE").length, 32);
  assert.equal(research.queries.every((item) => item.enabled === false), true);
});

test("the single B remains a manual individual watch item rather than a sales import", () => {
  assert.equal(research.active_opportunity_watchlist.length, 1);
  const item = research.active_opportunity_watchlist[0];
  assert.equal(item.id, "fl_unity_realistic");
  assert.equal(item.class, "B");
  assert.equal(item.engagement_track, "INDIVIDUAL_FREELANCE");
  assert.equal(item.accepting_applications_verified, true);
  assert.equal(item.individual_eligibility.status, "PROVEN");
  assert.equal(item.studio_eligibility.status, "UNKNOWN");
  assert.equal(item.budget_min, 1500);
  assert.equal(item.budget_max, 12500);
  assert.equal(item.budget_currency, "INR");
  assert.equal(item.outreach_locked, true);
  assert.equal(item.production_import_enabled, false);
  assert.equal(item.sales_use, "MANUAL_TECHNICAL_QUALIFICATION_ONLY");
});

test("C, D and rejects remain locked and no public contact is promoted", () => {
  assert.equal(research.partner_watchlist.length, 4);
  assert.equal(research.partner_watchlist.every((item) => item.class === "C" && item.outreach_locked && !item.production_import_enabled), true);
  assert.equal(research.evaluation_cases.every((item) => item.outreach_locked), true);
  assert.equal(research.sources.every((item) => item.enabled === false && item.runtime_eligible === false), true);
  assert.equal(research.integration_priorities.every((item) => item.enabled === false), true);
  assert.doesNotMatch(raw, /(?:contact_email|email_address|\"email\")/i);
});
