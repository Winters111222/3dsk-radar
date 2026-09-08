import test from "node:test";
import assert from "node:assert/strict";
import {
  ULTRA_MAX_PHASES,
  ULTRA_MAX_PROFILE,
  beginUltraMaxPhase,
  cancelUltraMaxRun,
  completeUltraMaxPhase,
  createUltraMaxRun,
  recordUltraMaxUsage
} from "../src/server/ultra-max-run-contract.mjs";

const NOW = "2026-09-08T16:00:00.000Z";
const LATER = "2026-09-08T16:01:00.000Z";

test("ULTRA_MAX snapshots seven bounded phases under one root budget", () => {
  const run = createUltraMaxRun({requestId:"request_ultra_001",runId:"ultra_run_001",nowIso:NOW});
  assert.equal(run.profile_id, "ULTRA_MAX");
  assert.equal(run.plan_snapshot.phases.length, 7);
  assert.equal(run.plan_snapshot.phases[0].phase_id, "NATIVE_COLLECTION");
  assert.equal(ULTRA_MAX_PHASES.reduce((sum, item) => sum + item.max_openai_requests, 0), 100);
  assert.equal(ULTRA_MAX_PHASES.reduce((sum, item) => sum + item.max_web_search_calls, 0), 300);
  assert.equal(ULTRA_MAX_PHASES.reduce((sum, item) => sum + item.budget_cap_microusd, 0), 15_000_000);
  assert.equal(ULTRA_MAX_PROFILE.max_candidates, 200);
  assert.equal(ULTRA_MAX_PROFILE.max_results, 100);
  assert.equal(run.retry_allowed, false);
  assert.equal(new Set(run.plan_snapshot.phases.map((item) => item.operation_id)).size, 7);
});

test("each intentional click gets a distinct root identity even in the same UTC window", () => {
  const first = createUltraMaxRun({requestId:"request_ultra_001",runId:"ultra_run_001",nowIso:NOW});
  const second = createUltraMaxRun({requestId:"request_ultra_002",runId:"ultra_run_002",nowIso:NOW});
  assert.notEqual(first.run_id, second.run_id);
  assert.notEqual(first.plan_snapshot.phases[1].operation_id, second.plan_snapshot.phases[1].operation_id);
  assert.doesNotMatch(first.run_id, /20260908/);
});

test("phases advance only in exact order and persist bounded usage", () => {
  let run = createUltraMaxRun({requestId:"request_ultra_001",runId:"ultra_run_001",nowIso:NOW});
  assert.throws(() => beginUltraMaxPhase(run, "CORE_DISCOVERY", LATER), /ULTRA_MAX_PHASE_ORDER_VIOLATION/);
  run = beginUltraMaxPhase(run, "NATIVE_COLLECTION", LATER);
  run = recordUltraMaxUsage(run, "NATIVE_COLLECTION", {source_requests:12,candidates_seen:4}, LATER);
  assert.equal(run.usage.source_requests, 12);
  assert.equal(run.plan_snapshot.phases[0].usage.candidates_seen, 4);
  run = completeUltraMaxPhase(run, "NATIVE_COLLECTION", LATER);
  run = beginUltraMaxPhase(run, "CORE_DISCOVERY", LATER);
  assert.equal(run.current_phase_id, "CORE_DISCOVERY");
});

test("phase and root hard caps fail before usage can be recorded", () => {
  let run = createUltraMaxRun({requestId:"request_ultra_001",runId:"ultra_run_001",nowIso:NOW});
  run = beginUltraMaxPhase(run, "NATIVE_COLLECTION", LATER);
  assert.throws(() => recordUltraMaxUsage(run, "NATIVE_COLLECTION", {source_requests:201}, LATER), /ULTRA_MAX_HARD_CAP_EXCEEDED/);
  run = recordUltraMaxUsage(run, "NATIVE_COLLECTION", {source_requests:200,candidates_seen:200,results_accepted:100}, LATER);
  assert.equal(run.usage.source_requests, 200);
  assert.equal(run.usage.candidates_seen, 200);
  assert.equal(run.usage.results_accepted, 100);
});

test("cancel is terminal and blocks every later phase", () => {
  let run = createUltraMaxRun({requestId:"request_ultra_001",runId:"ultra_run_001",nowIso:NOW});
  run = beginUltraMaxPhase(run, "NATIVE_COLLECTION", LATER);
  run = cancelUltraMaxRun(run, LATER);
  assert.equal(run.status, "CANCELLED");
  assert.equal(run.completion_reason, "USER_CANCELLED");
  assert.throws(() => beginUltraMaxPhase(run, "NATIVE_COLLECTION", LATER), /ULTRA_MAX_RUN_NOT_ACTIVE/);
});
