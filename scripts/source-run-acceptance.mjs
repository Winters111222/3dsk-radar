// Offline Phase C acceptance. Simulates limits and persistence without external network or OpenAI.
import { pathToFileURL } from "node:url";
import { continueSourceRunLoop, sourceCandidateView } from "../src/lib/source-run-view.mjs";
import { createStateRepository } from "../src/server/state-repository.mjs";
import { applyCandidateOutcome, canFetchPage, createSourceRun, mergeSourceCandidate, recordFetchedPage, rejectCandidateAtCap } from "../src/server/source-run-contract.mjs";
import { continueSourceRun, startSourceRun } from "../src/server/source-run-service.mjs";

const NOW = "2026-09-05T12:00:00.000Z";

function memoryStore() {
  const data = new Map();
  return {
    async setJSON(key, value) { data.set(key, structuredClone(value)); },
    async get(key) { return data.has(key) ? structuredClone(data.get(key)) : null; },
    async list({ prefix } = {}) { return { blobs:[...data.keys()].filter((key) => !prefix || key.startsWith(prefix)).map((key) => ({ key })), directories:[] }; }
  };
}

function candidate(index) {
  return {
    collector_record_id:`accept-${index}`,
    source_id:"find_tender_uk",
    source_item_id:`release-${index}`,
    tender_identity:`ocds-${index}`,
    source_revision:`release-${index}`,
    source_updated_date:"2026-09-05",
    title:`Character services ${index}`,
    buyer_names:[`Buyer ${index}`],
    canonical_url:`https://www.find-tender.service.gov.uk/procurement/ocds-${index}`,
    fetched_at:NOW
  };
}

export async function runSourceRunAcceptance() {
  let limitRun = createSourceRun({ profileId:"WIDE", requestId:"accept_pages_501", nowIso:NOW, runId:"accept_run_pages" });
  for (let page = 0; page < 140; page += 1) limitRun = recordFetchedPage(limitRun, { pageKind:"list" }).run;
  for (let page = 0; page < 360; page += 1) limitRun = recordFetchedPage(limitRun, { pageKind:"detail" }).run;

  let candidateRun = createSourceRun({ profileId:"WIDE", requestId:"accept_candidates", nowIso:NOW, runId:"accept_run_candidates" });
  for (let index = 0; index < 215; index += 1) {
    if (candidateRun.counters.candidates_accepted >= candidateRun.plan_snapshot.max_candidates) candidateRun = rejectCandidateAtCap(candidateRun);
    else candidateRun = applyCandidateOutcome(candidateRun, mergeSourceCandidate(null, candidate(index), NOW).outcome);
  }

  const repository = createStateRepository(memoryStore());
  await startSourceRun({ repository, profileId:"FOCUSED", requestId:"accept_persist_01", nowIso:NOW, runId:"accept_run_state" });
  let mockCalls = 0;
  const first = await continueSourceRun({
    repository,
    runId:"accept_run_state",
    operationId:"accept_operation_01",
    nowIso:NOW,
    maxPages:1,
    collectPage:async ({ sourceId, queryPackId }) => {
      mockCalls += 1;
      return { source_id:sourceId, query_pack_id:queryPackId, upstream_total:0, next_cursor:null, records:[candidate(999)], counters:{ records_seen:1, openai_requests:0, cost_usd:0 } };
    }
  });
  const replay = await continueSourceRun({ repository, runId:"accept_run_state", operationId:"accept_operation_01", nowIso:NOW, collectPage:async () => { throw new Error("replay must not dispatch"); } });
  const uiOperations = [];
  const ui = await continueSourceRunLoop({
    initialRun:{ ...first.run, status:"PAUSED", completion_reason:"CHUNK_LIMIT_REACHED" },
    makeOperationId:() => "accept_ui_operation",
    continueChunk:async (_runId, operationId) => {
      uiOperations.push(operationId);
      return { run:{ ...first.run, status:"COMPLETED", completion_reason:"PLAN_EXHAUSTED" } };
    }
  });
  const rawCandidate = sourceCandidateView((await repository.listSourceRunCandidates("accept_run_state"))[0]);

  const promotionRepository = createStateRepository(memoryStore());
  const promotionStart = await startSourceRun({ repository:promotionRepository, profileId:"FOCUSED", requestId:"accept_promote_01", nowIso:NOW, runId:"accept_run_promote" });
  const promotionCandidate = mergeSourceCandidate(null, candidate(1000), NOW).candidate;
  await promotionRepository.saveSourceRunCandidate("accept_run_promote", promotionCandidate);
  await promotionRepository.saveSourceRun({
    ...promotionStart.run,
    phase:"ENRICHMENT",
    status:"PAUSED",
    completion_reason:"COLLECTION_COMPLETE",
    work_items:promotionStart.run.work_items.map((item) => ({ ...item, status:"COMPLETED" })),
    counters:{ ...promotionStart.run.counters, source_services_completed:promotionStart.run.work_items.length, candidates_seen:1, candidates_accepted:1 }
  });
  const promoted = await continueSourceRun({
    repository:promotionRepository,
    runId:"accept_run_promote",
    operationId:"accept_promote_op",
    nowIso:NOW,
    maxPages:1,
    collectPage:async () => { throw new Error("collection must not resume during enrichment"); },
    fetchDetail:async () => {
      const document = {
        ocid:"ocds-1000",
        date:"2026-09-05T10:00:00Z",
        buyer:{ name:"Buyer 1000", contactPoint:{ email:"procurement@example.gov.uk" } },
        tender:{ title:"Character services 1000", description:"Realistic 3D character production services for digital humans.", status:"active", tenderPeriod:{ endDate:"2026-09-20T12:00:00Z" } }
      };
      return { source_id:"find_tender_uk", source_identity:"ocds-1000", fetched_at:NOW, document, releases:[document] };
    }
  });
  const promotedCandidate = sourceCandidateView((await promotionRepository.listSourceRunCandidates("accept_run_promote"))[0]);
  const promotedOpportunities = await promotionRepository.listOpportunities();

  const checks = {
    page_500_accepted:limitRun.counters.total_pages_fetched === 500,
    page_501_blocked:canFetchPage(limitRun, "detail").ok === false,
    candidates_capped_at_180:candidateRun.counters.candidates_accepted === 180 && candidateRun.counters.candidates_rejected_cap === 35,
    chunk_persisted:first.run.counters.list_pages_fetched === 1 && (await repository.listSourceRunCandidates("accept_run_state")).length === 1,
    operation_replayed_without_dispatch:replay.replayed === true && mockCalls === 1,
    operator_loop_completed:ui.reason === "COMPLETED" && uiOperations.length === 1,
    candidate_stays_raw:rawCandidate.review_state === "RAW_CANDIDATE",
    detail_truth_promoted:promoted.run.status === "COMPLETED" && promotedCandidate.review_state === "PROMOTED" && promotedOpportunities.length === 1,
    promotion_stays_zero_ai:promoted.run.counters.openai_requests === 0 && promoted.run.counters.cost_usd === 0,
    paid_execution_locked:first.run.paid_execution === "LOCKED",
    no_openai:first.run.counters.openai_requests === 0,
    zero_cost:first.run.counters.cost_usd === 0
  };
  const failed = Object.entries(checks).filter(([, value]) => !value).map(([key]) => key);
  if (failed.length) throw new Error(`Source run acceptance failed: ${failed.join(", ")}`);
  return { ok:true, simulated_pages:501, accepted_pages:500, offered_candidates:215, accepted_candidates:180, mock_transport_calls:mockCalls, network_requests:0, openai_requests:0, cost_usd:0, checks };
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  console.log(JSON.stringify(await runSourceRunAcceptance(), null, 2));
}
