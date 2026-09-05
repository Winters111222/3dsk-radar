import test from "node:test";
import assert from "node:assert/strict";
import { CollectorError } from "../src/server/collectors/collector-contract.mjs";
import { createStateRepository } from "../src/server/state-repository.mjs";
import { cancelSourceRun, continueSourceRun, startSourceRun } from "../src/server/source-run-service.mjs";
import { memoryStore } from "./helpers/memory-store.mjs";

const NOW = "2026-09-05T12:00:00.000Z";

function result({ sourceId, queryPackId, position, index, next = null } = {}) {
  return {
    source_id:sourceId,
    query_pack_id:queryPackId,
    upstream_total:null,
    next_cursor:next,
    records:[{
      collector_record_id:`record-${index}`,
      source_id:sourceId,
      query_pack_id:queryPackId,
      source_item_id:`item-${index}`,
      tender_identity:`tender-${index}`,
      source_revision:`revision-${index}`,
      source_updated_date:"2026-09-05",
      title:`3D character services ${index}`,
      buyer_names:[`Buyer ${index}`],
      canonical_url:`https://example.test/notices/${index}`,
      fetched_at:NOW,
      input_position:position
    }],
    counters:{ records_seen:1, openai_requests:0, cost_usd:0 }
  };
}

test("start and continue persist chunks, cursors and idempotent operation results", async () => {
  const repository = createStateRepository(memoryStore());
  const started = await startSourceRun({ repository, profileId:"FOCUSED", requestId:"request_start_01", nowIso:NOW, runId:"run_chunk_001" });
  const planSnapshot = structuredClone(started.run.plan_snapshot);
  assert.equal(started.replayed, false);
  assert.equal((await startSourceRun({ repository, profileId:"FOCUSED", requestId:"request_start_01", nowIso:NOW, runId:"ignored_run_1" })).run.run_id, "run_chunk_001");
  await assert.rejects(() => startSourceRun({ repository, profileId:"WIDE", requestId:"request_start_01", nowIso:NOW, runId:"ignored_run_2" }), /SOURCE_RUN_REQUEST_CONFLICT/);
  let calls = 0;
  const collectPage = async (input) => {
    calls += 1;
    return result({ ...input, index:calls, next:input.sourceId === "find_tender_uk" && calls === 5 ? "NEXT01" : null });
  };
  const continued = await continueSourceRun({ repository, runId:"run_chunk_001", operationId:"operation_0001", nowIso:NOW, collectPage });
  assert.equal(calls, 4);
  assert.equal(continued.run.status, "PAUSED");
  assert.equal(continued.run.counters.list_pages_fetched, 4);
  assert.deepEqual(continued.run.plan_snapshot, planSnapshot);
  assert.equal((await repository.listSourceRunCandidates("run_chunk_001")).length, 4);
  const replay = await continueSourceRun({ repository, runId:"run_chunk_001", operationId:"operation_0001", nowIso:NOW, collectPage });
  assert.equal(replay.replayed, true);
  assert.equal(calls, 4);
  const cursorChunk = await continueSourceRun({ repository, runId:"run_chunk_001", operationId:"operation_0002", nowIso:NOW, maxPages:1, collectPage });
  assert.equal(calls, 5);
  assert.equal(cursorChunk.run.work_items.find((item) => item.source_id === "find_tender_uk" && item.query_pack_id === "external_development").position.cursor, "NEXT01");
});

test("403/429 and timeout boundaries do not retry inside one chunk operation", async () => {
  const repository = createStateRepository(memoryStore());
  await startSourceRun({ repository, profileId:"FOCUSED", requestId:"request_retry_01", nowIso:NOW, runId:"run_retry_001" });
  let calls = 0;
  const collectPage = async () => {
    calls += 1;
    if (calls % 2) throw new CollectorError("CONTRACTS_FINDER_UPSTREAM_RATE_LIMITED", "rate", { status:429, upstreamStatus:403, retryAfterSeconds:60 });
    throw new CollectorError("FIND_TENDER_TIMEOUT", "timeout", { status:504 });
  };
  const first = await continueSourceRun({ repository, runId:"run_retry_001", operationId:"operation_retry1", nowIso:NOW, collectPage });
  assert.equal(calls, 4);
  assert.equal(first.run.work_items.filter((item) => item.status === "RETRYABLE").length, 4);
  await continueSourceRun({ repository, runId:"run_retry_001", operationId:"operation_retry1", nowIso:NOW, collectPage });
  assert.equal(calls, 4);
  const second = await continueSourceRun({ repository, runId:"run_retry_001", operationId:"operation_retry2", nowIso:"2026-09-05T12:02:00.000Z", collectPage });
  assert.equal(calls, 8);
  assert.equal(second.run.work_items.filter((item) => item.status === "FAILED").length, 4);
});

test("unknown interruption becomes UNCERTAIN and the same operation never dispatches again", async () => {
  const repository = createStateRepository(memoryStore());
  await startSourceRun({ repository, profileId:"FOCUSED", requestId:"request_break_01", nowIso:NOW, runId:"run_break_001" });
  let calls = 0;
  const collectPage = async () => { calls += 1; throw new Error("process lost after dispatch"); };
  await assert.rejects(() => continueSourceRun({ repository, runId:"run_break_001", operationId:"operation_break1", nowIso:NOW, collectPage }), /process lost/);
  assert.equal((await repository.getSourceRun("run_break_001")).status, "UNCERTAIN");
  const replay = await continueSourceRun({ repository, runId:"run_break_001", operationId:"operation_break1", nowIso:NOW, collectPage });
  assert.equal(replay.run.status, "UNCERTAIN");
  assert.equal(calls, 1);
});

test("cancel is persisted and preserves completed candidate work", async () => {
  const repository = createStateRepository(memoryStore());
  await startSourceRun({ repository, profileId:"FOCUSED", requestId:"request_cancel1", nowIso:NOW, runId:"run_cancel_001" });
  await continueSourceRun({ repository, runId:"run_cancel_001", operationId:"operation_work01", nowIso:NOW, maxPages:1, collectPage:async (input) => result({ ...input, index:1 }) });
  const cancelled = await cancelSourceRun({ repository, runId:"run_cancel_001", operationId:"operation_stop01", nowIso:"2026-09-05T12:01:00.000Z" });
  assert.equal(cancelled.run.status, "CANCELLED");
  assert.equal(cancelled.run.counters.candidates_accepted, 1);
  assert.equal((await repository.listSourceRunCandidates("run_cancel_001")).length, 1);
});

test("cancel requested during a fetch cannot be overwritten by the completing chunk", async () => {
  const repository = createStateRepository(memoryStore());
  await startSourceRun({ repository, profileId:"FOCUSED", requestId:"request_race_001", nowIso:NOW, runId:"run_cancel_race" });
  const continued = await continueSourceRun({
    repository,
    runId:"run_cancel_race",
    operationId:"operation_race1",
    nowIso:NOW,
    maxPages:1,
    collectPage:async (input) => {
      await cancelSourceRun({ repository, runId:"run_cancel_race", operationId:"operation_race_cancel", nowIso:"2026-09-05T12:00:01.000Z" });
      return result({ ...input, index:77 });
    }
  });
  assert.equal(continued.run.status, "CANCELLED");
  assert.equal(continued.run.cancel_requested_at, "2026-09-05T12:00:01.000Z");
  assert.equal(continued.run.counters.list_pages_fetched, 1);
  assert.equal((await repository.listSourceRunCandidates("run_cancel_race")).length, 1);
});
