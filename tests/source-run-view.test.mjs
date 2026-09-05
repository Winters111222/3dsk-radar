import test from "node:test";
import assert from "node:assert/strict";
import { continueSourceRunLoop, isTerminalSourceRun, sourceCandidateView, sourceRunProgress } from "../src/lib/source-run-view.mjs";

function run(overrides = {}) {
  return {
    run_id:"run_view_001",
    status:"PAUSED",
    completion_reason:"CHUNK_LIMIT_REACHED",
    counters:{ source_services_planned:12, source_services_completed:3, source_services_failed:1, source_services_blocked:0, total_pages_fetched:20, candidates_accepted:45 },
    plan_snapshot:{ max_total_pages:120, max_candidates:45 },
    ...overrides
  };
}

test("source run progress uses measured counters and hard profile caps", () => {
  const progress = sourceRunProgress(run());
  assert.deepEqual(progress.services, { value:4, maximum:12, ratio:1 / 3 });
  assert.deepEqual(progress.pages, { value:20, maximum:120, ratio:1 / 6 });
  assert.deepEqual(progress.candidates, { value:45, maximum:45, ratio:1 });
  assert.equal(isTerminalSourceRun(run({ status:"UNCERTAIN" })), true);
  assert.equal(isTerminalSourceRun(run()), false);
});

test("raw candidate view never labels a source record as an opportunity", () => {
  const view = sourceCandidateView({
    candidate_id:"candidate-1",
    primary_record:{ title:"Character capture services", buyer_names:["Example Buyer"], source_id:"ted_eu", canonical_url:"https://ted.europa.eu/detail/1", suggested_categories:["CAPTURE"] },
    source_references:[{}, {}]
  });
  assert.equal(view.review_state, "RAW_CANDIDATE");
  assert.equal(view.title, "Character capture services");
  assert.equal(view.reference_count, 2);
  assert.equal(sourceCandidateView({ primary_record:{ canonical_url:"javascript:alert(1)" } }).source_url, null);
});

test("one-click loop advances chunks and stops on a terminal run", async () => {
  let calls = 0;
  const operations = [];
  const result = await continueSourceRunLoop({
    initialRun:run(),
    makeOperationId:() => `operation_${operations.length + 1}`,
    continueChunk:async (_runId, operationId) => {
      operations.push(operationId);
      calls += 1;
      return { run:run({ status:calls === 3 ? "COMPLETED" : "PAUSED", completion_reason:calls === 3 ? "PLAN_EXHAUSTED" : "CHUNK_LIMIT_REACHED" }) };
    }
  });
  assert.equal(result.reason, "COMPLETED");
  assert.equal(result.chunks, 3);
  assert.deepEqual(operations, ["operation_1", "operation_2", "operation_3"]);
});

test("transient HTTP retry reuses the same operation id", async () => {
  const operations = [];
  let attempts = 0;
  const waits = [];
  const result = await continueSourceRunLoop({
    initialRun:run(),
    makeOperationId:() => "operation_stable",
    wait:async (milliseconds) => waits.push(milliseconds),
    continueChunk:async (_runId, operationId) => {
      operations.push(operationId);
      attempts += 1;
      if (attempts === 1) throw Object.assign(new Error("cooldown"), { code:"SOURCE_RUN_RATE_LIMITED", retryAfterSeconds:7 });
      return { run:run({ status:"COMPLETED", completion_reason:"PLAN_EXHAUSTED" }) };
    }
  });
  assert.equal(result.reason, "COMPLETED");
  assert.deepEqual(operations, ["operation_stable", "operation_stable"]);
  assert.deepEqual(waits, [7000]);
});

test("loop pauses instead of spinning while source retries wait", async () => {
  let calls = 0;
  const result = await continueSourceRunLoop({
    initialRun:run({ completion_reason:"RETRY_WAIT" }),
    makeOperationId:() => "operation_unused",
    continueChunk:async () => { calls += 1; throw new Error("must not dispatch"); }
  });
  assert.equal(result.reason, "RETRY_WAIT");
  assert.equal(result.chunks, 0);
  assert.equal(calls, 0);
});

test("loop resumes a persisted detail retry after next_retry_at", async () => {
  let calls = 0;
  const result = await continueSourceRunLoop({
    initialRun:run({ completion_reason:"RETRY_WAIT", next_retry_at:"2026-09-05T12:01:00.000Z", work_items:[] }),
    now:() => Date.parse("2026-09-05T12:02:00.000Z"),
    makeOperationId:() => "operation_detail_retry",
    continueChunk:async () => { calls += 1; return { run:run({ status:"COMPLETED", completion_reason:"ENRICHMENT_COMPLETE" }) }; }
  });
  assert.equal(result.reason, "COMPLETED");
  assert.equal(calls, 1);
});
