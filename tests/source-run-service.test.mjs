import test from "node:test";
import assert from "node:assert/strict";
import { CollectorError } from "../src/server/collectors/collector-contract.mjs";
import { createStateRepository } from "../src/server/state-repository.mjs";
import { mergeSourceCandidate } from "../src/server/source-run-contract.mjs";
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

function enrichmentRecord(overrides = {}) {
  return {
    collector_record_id:"record-enrich-1",
    source_id:"find_tender_uk",
    query_pack_id:"external_development",
    source_item_id:"release-enrich-1",
    tender_identity:"ocds-h6vhtk-enrich01",
    source_revision:"release-enrich-1",
    source_updated_date:"2026-09-04",
    title:"Digital human character production services",
    buyer_names:["Public Buyer"],
    canonical_url:"https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-enrich01",
    fetched_at:NOW,
    ...overrides
  };
}

function enrichmentDetail(overrides = {}) {
  const release = {
    ocid:"ocds-h6vhtk-enrich01",
    date:"2026-09-04T10:00:00Z",
    buyer:{ name:"Public Buyer", contactPoint:{ email:"buyer@example.gov.uk" } },
    tender:{ title:"Digital human character production services", description:"Character production services for realistic digital humans.", status:"active", tenderPeriod:{ endDate:"2026-09-20T12:00:00Z" } },
    ...overrides
  };
  return { source_id:"find_tender_uk", source_identity:release.ocid, fetched_at:NOW, document:release, releases:[release] };
}

async function prepareEnrichment(repository, { runId, requestId, record = enrichmentRecord() }) {
  const started = await startSourceRun({ repository, profileId:"FOCUSED", requestId, nowIso:NOW, runId });
  const candidate = mergeSourceCandidate(null, record, NOW).candidate;
  await repository.saveSourceRunCandidate(runId, candidate);
  const run = {
    ...started.run,
    phase:"ENRICHMENT",
    status:"PAUSED",
    completion_reason:"COLLECTION_COMPLETE",
    work_items:started.run.work_items.map((item) => ({ ...item, status:"COMPLETED" })),
    counters:{ ...started.run.counters, source_services_completed:started.run.work_items.length, candidates_seen:1, candidates_accepted:1 }
  };
  await repository.saveSourceRun(run);
  return candidate;
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

test("detail enrichment promotes only a Phase A truth-gated candidate", async () => {
  const repository = createStateRepository(memoryStore());
  await prepareEnrichment(repository, { runId:"run_enrich_001", requestId:"request_enrich_01" });
  let detailCalls = 0;
  const continued = await continueSourceRun({
    repository,
    runId:"run_enrich_001",
    operationId:"operation_enrich1",
    nowIso:NOW,
    maxPages:1,
    collectPage:async () => { throw new Error("collection must not resume"); },
    fetchDetail:async () => { detailCalls += 1; return enrichmentDetail(); }
  });
  const candidates = await repository.listSourceRunCandidates("run_enrich_001");
  const opportunities = await repository.listOpportunities();
  assert.equal(detailCalls, 1);
  assert.equal(continued.run.status, "COMPLETED");
  assert.equal(continued.run.counters.detail_pages_fetched, 1);
  assert.equal(continued.run.counters.candidates_detail_verified, 1);
  assert.equal(continued.run.counters.candidates_promoted, 1);
  assert.equal(continued.run.counters.opportunities_new, 1);
  assert.equal(candidates[0].review_state, "PROMOTED");
  assert.equal(candidates[0].promoted_opportunity_id, opportunities[0].id);
  assert.equal(opportunities[0].opportunity_kind, "OPEN_OPPORTUNITY");
  assert.equal(continued.run.counters.openai_requests, 0);
  assert.equal(continued.run.counters.cost_usd, 0);
});

test("detail rate limits retry only in a new operation and replay never redispatches", async () => {
  const repository = createStateRepository(memoryStore());
  await prepareEnrichment(repository, { runId:"run_detail_retry", requestId:"request_detail_retry" });
  let calls = 0;
  const fetchDetail = async () => {
    calls += 1;
    if (calls === 1) throw new CollectorError("SOURCE_DETAIL_RATE_LIMITED", "limited", { status:429, upstreamStatus:429, retryAfterSeconds:60 });
    return enrichmentDetail();
  };
  const first = await continueSourceRun({ repository, runId:"run_detail_retry", operationId:"operation_detail1", nowIso:NOW, maxPages:1, collectPage:async () => null, fetchDetail });
  assert.equal(calls, 1);
  assert.equal((await repository.listSourceRunCandidates("run_detail_retry"))[0].review_state, "RETRYABLE");
  const replay = await continueSourceRun({ repository, runId:"run_detail_retry", operationId:"operation_detail1", nowIso:NOW, maxPages:1, collectPage:async () => null, fetchDetail });
  assert.equal(replay.replayed, true);
  assert.equal(calls, 1);
  const second = await continueSourceRun({ repository, runId:"run_detail_retry", operationId:"operation_detail2", nowIso:"2026-09-05T12:02:00.000Z", maxPages:1, collectPage:async () => null, fetchDetail });
  assert.equal(calls, 2);
  assert.equal(second.run.status, "COMPLETED");
  assert.equal(second.run.counters.detail_requests_attempted, 2);
});

test("detail schema drift rejects with an explicit reason and never creates an opportunity", async () => {
  const repository = createStateRepository(memoryStore());
  await prepareEnrichment(repository, { runId:"run_detail_schema", requestId:"request_detail_schema" });
  const continued = await continueSourceRun({
    repository,
    runId:"run_detail_schema",
    operationId:"operation_schema1",
    nowIso:NOW,
    maxPages:1,
    collectPage:async () => null,
    fetchDetail:async () => { throw new CollectorError("OCDS_DETAIL_SCHEMA_MISMATCH", "schema"); }
  });
  const candidate = (await repository.listSourceRunCandidates("run_detail_schema"))[0];
  assert.equal(continued.run.status, "COMPLETED");
  assert.equal(continued.run.counters.candidates_detail_verified, 0);
  assert.equal(candidate.review_state, "REJECTED");
  assert.equal(candidate.rejection_reason, "detail_ocds_detail_schema_mismatch");
  assert.equal(continued.run.counters.candidate_rejection_reasons.detail_ocds_detail_schema_mismatch, 1);
  assert.equal((await repository.listOpportunities()).length, 0);
});

test("unknown detail interruption becomes UNCERTAIN and the operation cannot dispatch again", async () => {
  const repository = createStateRepository(memoryStore());
  await prepareEnrichment(repository, { runId:"run_detail_break", requestId:"request_detail_break" });
  let calls = 0;
  const fetchDetail = async () => { calls += 1; throw new Error("detail transport lost"); };
  await assert.rejects(() => continueSourceRun({ repository, runId:"run_detail_break", operationId:"operation_detail_break", nowIso:NOW, maxPages:1, collectPage:async () => null, fetchDetail }), /detail transport lost/);
  const replay = await continueSourceRun({ repository, runId:"run_detail_break", operationId:"operation_detail_break", nowIso:NOW, maxPages:1, collectPage:async () => null, fetchDetail });
  assert.equal(replay.run.status, "UNCERTAIN");
  assert.equal(calls, 1);
});

test("cancel after detail fetch persists evidence but prevents promotion", async () => {
  const repository = createStateRepository(memoryStore());
  await prepareEnrichment(repository, { runId:"run_detail_cancel", requestId:"request_detail_cancel" });
  const continued = await continueSourceRun({
    repository,
    runId:"run_detail_cancel",
    operationId:"operation_detail_cancel",
    nowIso:NOW,
    maxPages:1,
    collectPage:async () => null,
    fetchDetail:async () => {
      await cancelSourceRun({ repository, runId:"run_detail_cancel", operationId:"operation_cancel_after_detail", nowIso:"2026-09-05T12:00:01.000Z" });
      return enrichmentDetail();
    }
  });
  const candidate = (await repository.listSourceRunCandidates("run_detail_cancel"))[0];
  assert.equal(continued.run.status, "CANCELLED");
  assert.equal(candidate.review_state, "ENRICHED");
  assert.equal((await repository.listOpportunities()).length, 0);
});
