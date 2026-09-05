// Offline Phase C acceptance. Simulates limits and persistence without external network or OpenAI.
import { pathToFileURL } from "node:url";
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

  const checks = {
    page_500_accepted:limitRun.counters.total_pages_fetched === 500,
    page_501_blocked:canFetchPage(limitRun, "detail").ok === false,
    candidates_capped_at_180:candidateRun.counters.candidates_accepted === 180 && candidateRun.counters.candidates_rejected_cap === 35,
    chunk_persisted:first.run.counters.list_pages_fetched === 1 && (await repository.listSourceRunCandidates("accept_run_state")).length === 1,
    operation_replayed_without_dispatch:replay.replayed === true && mockCalls === 1,
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
