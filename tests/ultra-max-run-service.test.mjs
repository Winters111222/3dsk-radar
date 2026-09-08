import test from "node:test";
import assert from "node:assert/strict";
import { createStateRepository } from "../src/server/state-repository.mjs";
import { executeUltraMaxPhase, requestUltraMaxCancel, startUltraMaxRun } from "../src/server/ultra-max-run-service.mjs";
import { memoryStore } from "./helpers/memory-store.mjs";

const NOW = "2026-09-08T16:00:00.000Z";
const LATER = "2026-09-08T16:01:00.000Z";

test("start is request-idempotent and persists the latest root run", async () => {
  const repository = createStateRepository(memoryStore());
  const first = await startUltraMaxRun({ repository, requestId:"request_ultra_001", runId:"ultra_run_001", nowIso:NOW });
  const replay = await startUltraMaxRun({ repository, requestId:"request_ultra_001", runId:"ultra_run_ignored", nowIso:LATER });
  assert.equal(first.replayed, false);
  assert.equal(replay.replayed, true);
  assert.equal(replay.run.run_id, "ultra_run_001");
  assert.equal((await repository.lastUltraMaxRun()).run_id, "ultra_run_001");
});

test("a phase dispatches once, records bounded usage and replays its stored result", async () => {
  const repository = createStateRepository(memoryStore());
  const started = await startUltraMaxRun({ repository, requestId:"request_ultra_002", runId:"ultra_run_002", nowIso:NOW });
  const operationId = started.run.plan_snapshot.phases[0].operation_id;
  let calls = 0;
  const execute = async () => {
    calls += 1;
    return { usage:{ source_requests:12, candidates_seen:9 }, payload:{ collected:9 } };
  };
  const first = await executeUltraMaxPhase({ repository, runId:started.run.run_id, phaseId:"NATIVE_COLLECTION", operationId, nowIso:LATER, execute });
  const replay = await executeUltraMaxPhase({ repository, runId:started.run.run_id, phaseId:"NATIVE_COLLECTION", operationId, nowIso:LATER, execute });
  assert.equal(first.run.plan_snapshot.phases[0].status, "COMPLETED");
  assert.equal(first.run.usage.source_requests, 12);
  assert.deepEqual(first.result.payload, { collected:9 });
  assert.equal(replay.replayed, true);
  assert.deepEqual(replay.result.payload, { collected:9 });
  assert.equal(calls, 1);
});

test("only the exact snapshotted operation can execute a phase", async () => {
  const repository = createStateRepository(memoryStore());
  await startUltraMaxRun({ repository, requestId:"request_ultra_003", runId:"ultra_run_003", nowIso:NOW });
  await assert.rejects(() => executeUltraMaxPhase({
    repository,
    runId:"ultra_run_003",
    phaseId:"NATIVE_COLLECTION",
    operationId:"operation_wrong_001",
    nowIso:LATER,
    execute:async () => ({})
  }), /ULTRA_MAX_OPERATION_ID_MISMATCH/);
});

test("unknown failure is terminal uncertain and the same phase never redispatches", async () => {
  const repository = createStateRepository(memoryStore());
  const started = await startUltraMaxRun({ repository, requestId:"request_ultra_004", runId:"ultra_run_004", nowIso:NOW });
  const operationId = started.run.plan_snapshot.phases[0].operation_id;
  let calls = 0;
  const execute = async () => { calls += 1; throw new Error("transport lost after dispatch"); };
  await assert.rejects(() => executeUltraMaxPhase({ repository, runId:"ultra_run_004", phaseId:"NATIVE_COLLECTION", operationId, nowIso:LATER, execute }), /transport lost/);
  const replay = await executeUltraMaxPhase({ repository, runId:"ultra_run_004", phaseId:"NATIVE_COLLECTION", operationId, nowIso:LATER, execute });
  assert.equal(replay.run.status, "UNCERTAIN");
  assert.equal(replay.replayed, true);
  assert.equal(calls, 1);
});

test("cancel is durable and prevents later phase execution", async () => {
  const repository = createStateRepository(memoryStore());
  const started = await startUltraMaxRun({ repository, requestId:"request_ultra_005", runId:"ultra_run_005", nowIso:NOW });
  const cancelled = await requestUltraMaxCancel({ repository, runId:"ultra_run_005", operationId:"operation_cancel_005", nowIso:LATER });
  let calls = 0;
  const phase = await executeUltraMaxPhase({
    repository,
    runId:"ultra_run_005",
    phaseId:"NATIVE_COLLECTION",
    operationId:started.run.plan_snapshot.phases[0].operation_id,
    nowIso:LATER,
    execute:async () => { calls += 1; return {}; }
  });
  assert.equal(cancelled.run.status, "CANCELLED");
  assert.equal(phase.run.status, "CANCELLED");
  assert.equal(calls, 0);
});
