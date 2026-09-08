import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const raw = await readFile(new URL("../config/semantic-research-derived.v1.json", import.meta.url), "utf8");
const research = JSON.parse(raw);

test("Astra semantic research is imported as a locked, provenance-bound artifact", () => {
  assert.equal(research.source_manifest_sha256, "a5c8f7dafc5c845668b5dbaa0e30dcb9422b1bf2f7266ed9a495d55426605470");
  assert.equal(research.status, "RESEARCH_ONLY_RUNTIME_LOCKED");
  assert.equal(research.scheduled_collection_enabled, false);
  assert.equal(research.automatic_paid_execution_enabled, false);
  assert.equal(research.production_import_enabled, false);
  assert.deepEqual(research.counts, { sources:47, queries:64, candidates:107, partners:5, watchlist:32, rejected:70, A:0, B:0, C:5, D:32 });
});

test("semantic query matrix has eight categories in eight languages and stays disabled", () => {
  assert.equal(research.queries.length, 64);
  assert.deepEqual([...new Set(research.queries.map((item) => item.language))].sort(), ["CS","DE","EN","ES","FR","IT","PL","SK"]);
  assert.deepEqual([...new Set(research.queries.map((item) => item.category))].sort(), [
    "AI_DATASET_CAPTURE", "HERITAGE_FUNDED", "HUMAN_DIGITAL_DOUBLE", "MUSEUM_DIGITISATION",
    "PHOTOGRAMMETRY_ASSETS", "REMOTE_OVERFLOW", "SCAN_CLEANUP_WRAP", "TENDER_PLAN_AWARD"
  ]);
  assert.equal(research.queries.every((item) => item.enabled === false), true);
});

test("five C records remain outreach-locked partner watch items, never open sales", () => {
  assert.equal(research.partner_watchlist.length, 5);
  for (const item of research.partner_watchlist) {
    assert.equal(item.class, "C");
    assert.equal(item.accepting_external_bids_verified, false);
    assert.equal(item.outreach_locked, true);
    assert.equal(item.sales_use, "PARTNER_QUALIFICATION_AFTER_MANUAL_REVIEW");
  }
  assert.doesNotMatch(raw, /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
});

test("all 107 evaluation labels are preserved without promoting D or rejects", () => {
  const counts = Object.groupBy(research.evaluation_cases, (item) => item.class);
  assert.equal(counts.C.length, 5);
  assert.equal(counts.D.length, 32);
  assert.equal(counts.REJECT.length, 70);
  assert.equal(research.evaluation_cases.some((item) => ["A","B"].includes(item.class)), false);
  assert.equal(research.evaluation_cases.filter((item) => item.class === "C").every((item) => item.accepting_external_bids_verified === false), true);
});
