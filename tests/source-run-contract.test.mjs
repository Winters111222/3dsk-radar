import test from "node:test";
import assert from "node:assert/strict";
import {
  SOURCE_RUN_PROFILES,
  applyCandidateOutcome,
  buildSourceRunPlan,
  canFetchPage,
  createSourceRun,
  mergeSourceCandidate,
  recordFetchedPage,
  rejectCandidateAtCap,
  reserveRunCost,
  settleRunCost
} from "../src/server/source-run-contract.mjs";

const NOW = "2026-09-05T12:00:00.000Z";

function record(index, overrides = {}) {
  return {
    collector_record_id:`record-${index}`,
    source_id:"find_tender_uk",
    source_item_id:`release-${index}`,
    tender_identity:`ocds-${index}`,
    source_revision:`revision-${index}`,
    source_updated_date:"2026-09-05",
    title:`Character digitisation ${index}`,
    buyer_names:[`Buyer ${index}`],
    canonical_url:`https://www.find-tender.service.gov.uk/procurement/ocds-${index}`,
    fetched_at:NOW,
    ...overrides
  };
}

test("Phase C plans are immutable-profile snapshots with all 12 fixed source packs", () => {
  const plan = buildSourceRunPlan();
  assert.equal(plan.length, 12);
  assert.equal(new Set(plan.map((item) => item.source_id)).size, 3);
  assert.deepEqual(new Set(plan.map((item) => item.query_pack_id)), new Set(["external_development", "production_overflow", "pipeline_consulting", "other_relevant"]));
  const focused = createSourceRun({ profileId:"FOCUSED", requestId:"request_0001", nowIso:NOW, runId:"run_00000001" });
  assert.equal(focused.plan_snapshot.max_candidates, 45);
  assert.equal(focused.plan_snapshot.max_total_pages, 120);
  assert.equal(focused.paid_execution, "LOCKED");
  assert.equal(focused.counters.openai_requests, 0);
  assert.equal(SOURCE_RUN_PROFILES.WIDE.max_candidates, 180);
});

test("Wide profile hard-stops a simulation offering more than 500 pages", () => {
  let run = createSourceRun({ profileId:"WIDE", requestId:"request_0501", nowIso:NOW, runId:"run_00000501" });
  for (let index = 0; index < 140; index += 1) run = recordFetchedPage(run, { pageKind:"list" }).run;
  for (let index = 0; index < 360; index += 1) run = recordFetchedPage(run, { pageKind:"detail" }).run;
  assert.equal(run.counters.list_pages_fetched, 140);
  assert.equal(run.counters.detail_pages_fetched, 360);
  assert.equal(run.counters.total_pages_fetched, 500);
  assert.deepEqual(canFetchPage(run, "detail"), { ok:false, code:"TOTAL_PAGE_CAP_REACHED" });
  assert.equal(recordFetchedPage(run, { pageKind:"detail" }).ok, false);
});

test("candidate cap accepts exactly 180 records from a larger candidate stream", () => {
  let run = createSourceRun({ profileId:"WIDE", requestId:"request_0180", nowIso:NOW, runId:"run_00000180" });
  for (let index = 0; index < 215; index += 1) {
    if (run.counters.candidates_accepted >= run.plan_snapshot.max_candidates) run = rejectCandidateAtCap(run);
    else run = applyCandidateOutcome(run, mergeSourceCandidate(null, record(index), NOW).outcome);
  }
  assert.equal(run.counters.candidates_seen, 215);
  assert.equal(run.counters.candidates_accepted, 180);
  assert.equal(run.counters.candidates_rejected_cap, 35);
});

test("dedupe distinguishes exact repeats, tender revisions and cross-source matches", () => {
  const first = mergeSourceCandidate(null, record(1), NOW);
  assert.equal(first.outcome, "NEW");
  assert.equal(mergeSourceCandidate(first.candidate, record(1), NOW).outcome, "DUPLICATE");
  const revision = mergeSourceCandidate(first.candidate, record(1, { collector_record_id:"record-1b", source_item_id:"release-1b", source_revision:"revision-2", source_updated_date:"2026-09-06" }), "2026-09-06T12:00:00.000Z");
  assert.equal(revision.outcome, "REVISION");
  assert.equal(revision.candidate.primary_record.source_revision, "revision-2");
  const otherSource = record(1, { source_id:"ted_eu", source_item_id:"ted-1", tender_identity:"ted-procedure-1", source_revision:"ted-1", canonical_url:"https://ted.europa.eu/en/notice/-/detail/1-2026" });
  assert.equal(mergeSourceCandidate(revision.candidate, otherSource, NOW).outcome, "CROSS_SOURCE_DUPLICATE");
});

test("cost reservations are idempotent and cannot exceed the profile cap", () => {
  let run = createSourceRun({ profileId:"FOCUSED", requestId:"request_cost", nowIso:NOW, runId:"run_cost_001" });
  let reserved = reserveRunCost(run, { reservationId:"reserve_0001", maxCostUsd:0.30 });
  run = reserved.run;
  assert.equal(reserved.replayed, false);
  reserved = reserveRunCost(run, { reservationId:"reserve_0001", maxCostUsd:0.30 });
  assert.equal(reserved.replayed, true);
  assert.throws(() => reserveRunCost(run, { reservationId:"reserve_0002", maxCostUsd:0.21 }), /SOURCE_RUN_BUDGET_CAP_EXCEEDED/);
  const settled = settleRunCost(run, { reservationId:"reserve_0001", actualCostUsd:0.24 });
  assert.equal(settled.run.budget.reserved_microusd, 0);
  assert.equal(settled.run.budget.settled_microusd, 240000);
  assert.equal(settleRunCost(settled.run, { reservationId:"reserve_0001", actualCostUsd:0.24 }).replayed, true);
});
