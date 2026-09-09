import test from "node:test";
import assert from "node:assert/strict";
import { SEMANTIC_INTENT_CATEGORIES, semanticIntentCoverage, semanticIntentHintForShard } from "../src/server/semantic-intent-taxonomy.mjs";
import { WIDE_MAX_PLAN_VERSION, WIDE_MAX_SEARCH_SHARDS } from "../src/server/wide-max-search-plan.mjs";

test("semantic taxonomy covers the baseline and dual-track buyer-intent categories", () => {
  assert.deepEqual([...SEMANTIC_INTENT_CATEGORIES].sort(), [
    "AI_DATASET_CAPTURE", "CHARACTER_FINISHING", "HERITAGE_FUNDED", "HUMAN_DIGITAL_DOUBLE",
    "LIKENESS_CLEANUP", "MUSEUM_DIGITISATION", "PHOTOGRAMMETRY_ASSETS", "REMOTE_OVERFLOW",
    "SCAN_CLEANUP_WRAP", "SINGLE_ASSET_HANDOFF", "SUPPLIED_SCAN_REPAIR", "TENDER_PLAN_AWARD"
  ]);
});

test("every WIDE_MAX shard receives latent buyer language without changing hard limits", () => {
  const coverage = semanticIntentCoverage();
  assert.equal(WIDE_MAX_PLAN_VERSION, "dual-engagement-track-v4");
  assert.equal(WIDE_MAX_SEARCH_SHARDS.length, 25);
  for (const shard of WIDE_MAX_SEARCH_SHARDS) {
    assert.ok(coverage[shard.id]?.length > 0, shard.id);
    assert.match(shard.focus, /SEMANTIC_BUYER_INTENT:/);
    assert.ok(semanticIntentHintForShard(shard.id).length > 30, shard.id);
  }
});

test("semantic hints preserve funding and active-buyer truth boundaries", () => {
  assert.match(semanticIntentHintForShard("cz_sk_heritage_funding"), /Funding alone is signal-only/);
  assert.match(semanticIntentHintForShard("heritage_ted"), /Only an active buyer request may become an open opportunity/);
  assert.match(semanticIntentHintForShard("wrap3d_face_pipeline"), /tool names are optional/);
  assert.match(semanticIntentHintForShard("zbrush_scan_cleanup"), /one human head, face or body/);
  assert.match(semanticIntentHintForShard("marketplace_paid_tests_batches"), /Small scope is valid/);
});
