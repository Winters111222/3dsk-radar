import { randomUUID } from "node:crypto";
import { CollectorError } from "./collectors/collector-contract.mjs";
import {
  applyCandidateOutcome,
  candidateDedupeKeys,
  canFetchPage,
  createSourceRun,
  isTerminalRun,
  mergeSourceCandidate,
  recordFetchedPage,
  rejectCandidateAtCap,
  validClientId
} from "./source-run-contract.mjs";

function operationResult(run, replayed = false) {
  return {
    run_id:run.run_id,
    status:run.status,
    completion_reason:run.completion_reason,
    replayed,
    counters:run.counters,
    paid_execution:run.paid_execution
  };
}

function addSeconds(nowIso, seconds) {
  return new Date(new Date(nowIso).getTime() + Math.max(1, Number(seconds) || 30) * 1000).toISOString();
}

function leaseIsFresh(startedAt, nowIso, leaseSeconds = 120) {
  const age = new Date(nowIso).getTime() - new Date(startedAt || 0).getTime();
  return Number.isFinite(age) && age >= 0 && age < leaseSeconds * 1000;
}

function isRetryable(error) {
  if (!(error instanceof CollectorError)) return false;
  return error.status === 429 || error.status === 503 || error.status === 504 || /TIMEOUT|RATE_LIMITED|NETWORK_FAILED/.test(error.code);
}

function terminalizeIfDone(run, nowIso) {
  const items = run.work_items;
  if (!items.every((item) => ["COMPLETED", "FAILED", "BLOCKED"].includes(item.status))) return run;
  const failed = items.filter((item) => item.status === "FAILED").length;
  return {
    ...run,
    status:"COMPLETED",
    completion_reason:failed ? "COMPLETED_WITH_SOURCE_ERRORS" : "PLAN_EXHAUSTED",
    completed_at:nowIso,
    active_operation_id:null,
    counters:{ ...run.counters, source_services_failed:failed }
  };
}

function blockRemainingAtCap(run, reason, nowIso) {
  let blocked = 0;
  const workItems = run.work_items.map((item) => {
    if (["COMPLETED", "FAILED", "BLOCKED"].includes(item.status)) return item;
    blocked += 1;
    return { ...item, status:"BLOCKED", last_error:{ code:reason, at:nowIso } };
  });
  return {
    ...run,
    status:"COMPLETED",
    completion_reason:reason,
    completed_at:nowIso,
    active_operation_id:null,
    work_items:workItems,
    counters:{ ...run.counters, source_services_blocked:run.counters.source_services_blocked + blocked }
  };
}

function replaceWorkItem(run, workItemId, update) {
  return {
    ...run,
    work_items:run.work_items.map((item) => item.work_item_id === workItemId ? { ...item, ...update } : item)
  };
}

function nextEligibleWorkItem(run, nowIso, attemptedIds) {
  return run.work_items.find((item) => {
    if (attemptedIds.has(item.work_item_id)) return false;
    if (item.status === "PENDING") return true;
    return item.status === "RETRYABLE" && (!item.not_before || item.not_before <= nowIso) && item.attempts < item.max_attempts;
  }) || null;
}

function nextPosition(workItem, result, pageSize) {
  if (workItem.source_id === "ted_eu") {
    const current = Number(workItem.position?.page) || 1;
    const hasNext = Number.isFinite(result.upstream_total) && current * pageSize < result.upstream_total && current < 20;
    return hasNext ? { page:current + 1, cursor:null } : null;
  }
  if (result.next_cursor && result.next_cursor !== workItem.position?.cursor) return { page:null, cursor:result.next_cursor };
  return null;
}

async function persistRecords(repository, run, records, nowIso) {
  let nextRun = run;
  for (const record of records) {
    const keys = candidateDedupeKeys(record);
    const existing = await repository.findSourceRunCandidate(run.run_id, keys);
    if (!existing && nextRun.counters.candidates_accepted >= nextRun.plan_snapshot.max_candidates) {
      nextRun = rejectCandidateAtCap(nextRun);
      continue;
    }
    const merged = mergeSourceCandidate(existing, record, nowIso);
    await repository.saveSourceRunCandidate(run.run_id, merged.candidate);
    nextRun = applyCandidateOutcome(nextRun, merged.outcome);
  }
  return nextRun;
}

export async function startSourceRun({ repository, profileId, requestId, nowIso, runId = randomUUID() } = {}) {
  if (!repository) throw new Error("SOURCE_RUN_REPOSITORY_REQUIRED");
  if (!validClientId(requestId)) throw new Error("SOURCE_RUN_REQUEST_ID_INVALID");
  const previous = await repository.getSourceRunRequest(requestId);
  if (previous?.run_id) {
    if (previous.profile_id !== profileId) throw new Error("SOURCE_RUN_REQUEST_CONFLICT");
    const run = await repository.getSourceRun(previous.run_id);
    if (run) return { run, replayed:true };
  }
  const run = createSourceRun({ profileId, requestId, nowIso, runId });
  await repository.saveSourceRun(run);
  await repository.saveSourceRunRequest(requestId, { run_id:run.run_id, profile_id:run.profile_id, created_at:nowIso });
  return { run, replayed:false };
}

export async function continueSourceRun({ repository, runId, operationId, nowIso, collectPage, maxPages = null } = {}) {
  if (!repository || typeof collectPage !== "function") throw new Error("SOURCE_RUN_DEPENDENCY_MISSING");
  if (!validClientId(runId) || !validClientId(operationId)) throw new Error("SOURCE_RUN_ID_INVALID");
  let run = await repository.getSourceRun(runId);
  if (!run) throw new Error("SOURCE_RUN_NOT_FOUND");

  const previous = await repository.getSourceRunOperation(runId, operationId);
  if (previous?.status === "COMPLETED") return { run, result:previous.result, replayed:true };
  if (previous?.status === "IN_PROGRESS" && leaseIsFresh(previous.started_at, nowIso)) throw new Error("SOURCE_RUN_OPERATION_IN_PROGRESS");
  if (previous?.status === "IN_PROGRESS" || previous?.status === "UNCERTAIN") {
    run = { ...run, status:"UNCERTAIN", completion_reason:"INTERRUPTED_OPERATION_REPLAY", completed_at:nowIso, active_operation_id:null, updated_at:nowIso };
    await repository.saveSourceRun(run);
    return { run, result:operationResult(run, true), replayed:true };
  }
  if (isTerminalRun(run)) return { run, result:operationResult(run, true), replayed:true };
  if (run.status === "RUNNING" && run.active_operation_id && run.active_operation_id !== operationId) {
    if (leaseIsFresh(run.updated_at, nowIso)) throw new Error("SOURCE_RUN_OPERATION_IN_PROGRESS");
    run = { ...run, status:"UNCERTAIN", completion_reason:"STALE_ACTIVE_OPERATION", completed_at:nowIso, active_operation_id:null, updated_at:nowIso };
    await repository.saveSourceRun(run);
    return { run, result:operationResult(run, true), replayed:true };
  }

  const operation = { operation_id:operationId, action:"CONTINUE", status:"IN_PROGRESS", started_at:nowIso, completed_at:null, result:null };
  await repository.saveSourceRunOperation(runId, operation);
  run = { ...run, status:"RUNNING", started_at:run.started_at || nowIso, active_operation_id:operationId, updated_at:nowIso };
  await repository.saveSourceRun(run);

  const chunkLimit = Math.max(1, Math.min(Number(maxPages) || run.plan_snapshot.chunk_list_pages, run.plan_snapshot.chunk_list_pages));
  const attemptedIds = new Set();
  let requestsThisChunk = 0;
  try {
    while (requestsThisChunk < chunkLimit) {
      const cancelMarker = await repository.getSourceRunCancel(runId);
      if (cancelMarker?.requested_at) {
        run = { ...run, cancel_requested_at:cancelMarker.requested_at, status:"CANCELLED", completion_reason:"CANCEL_REQUESTED", completed_at:nowIso, active_operation_id:null, updated_at:nowIso };
        break;
      }
      if (run.counters.candidates_accepted >= run.plan_snapshot.max_candidates) {
        run = blockRemainingAtCap(run, "CANDIDATE_CAP_REACHED", nowIso);
        break;
      }
      const pageAllowed = canFetchPage(run, "list");
      if (!pageAllowed.ok) {
        run = blockRemainingAtCap(run, pageAllowed.code, nowIso);
        break;
      }
      const item = nextEligibleWorkItem(run, nowIso, attemptedIds);
      if (!item) {
        run = terminalizeIfDone(run, nowIso);
        if (!isTerminalRun(run)) run = { ...run, status:"PAUSED", completion_reason:"RETRY_WAIT", active_operation_id:null };
        break;
      }
      attemptedIds.add(item.work_item_id);
      requestsThisChunk += 1;
      run = replaceWorkItem(run, item.work_item_id, { status:"RUNNING", last_error:null });
      await repository.saveSourceRun({ ...run, updated_at:nowIso });

      let result;
      try {
        result = await collectPage({
          sourceId:item.source_id,
          queryPackId:item.query_pack_id,
          position:item.position,
          nowIso,
          limit:50
        });
      } catch (error) {
        if (!(error instanceof CollectorError)) throw error;
        const attempts = item.attempts + 1;
        const retryable = isRetryable(error) && attempts < item.max_attempts;
        run = replaceWorkItem(run, item.work_item_id, {
          status:retryable ? "RETRYABLE" : "FAILED",
          attempts,
          not_before:retryable ? addSeconds(nowIso, error.retryAfterSeconds) : null,
          last_error:{ code:error.code, status:error.status, upstream_status:error.upstreamStatus, at:nowIso }
        });
        if (!retryable) run = { ...run, counters:{ ...run.counters, source_services_failed:run.counters.source_services_failed + 1 } };
        await repository.saveSourceRun({ ...run, updated_at:nowIso });
        continue;
      }

      const recorded = recordFetchedPage(run, {
        pageKind:"list",
        recordsSeen:result.counters?.records_seen ?? result.records.length,
        recordsReturned:result.records.length
      });
      if (!recorded.ok) {
        run = blockRemainingAtCap(run, recorded.code, nowIso);
        break;
      }
      run = await persistRecords(repository, recorded.run, result.records, nowIso);
      const position = nextPosition(item, result, 50);
      run = replaceWorkItem(run, item.work_item_id, position
        ? { status:"PENDING", position, attempts:0, pages_fetched:item.pages_fetched + 1, not_before:null, last_error:null }
        : { status:"COMPLETED", attempts:0, pages_fetched:item.pages_fetched + 1, not_before:null, last_error:null });
      if (!position) run = { ...run, counters:{ ...run.counters, source_services_completed:run.counters.source_services_completed + 1 } };
      const cancelAfterFetch = await repository.getSourceRunCancel(runId);
      if (cancelAfterFetch?.requested_at) {
        run = { ...run, cancel_requested_at:cancelAfterFetch.requested_at, status:"CANCELLED", completion_reason:"CANCEL_REQUESTED", completed_at:nowIso, active_operation_id:null };
      }
      run = terminalizeIfDone({ ...run, updated_at:nowIso }, nowIso);
      await repository.saveSourceRun(run);
      if (isTerminalRun(run)) break;
    }

    if (!isTerminalRun(run)) run = { ...run, status:"PAUSED", completion_reason:requestsThisChunk >= chunkLimit ? "CHUNK_LIMIT_REACHED" : run.completion_reason, active_operation_id:null, updated_at:nowIso };
    else run = { ...run, active_operation_id:null, updated_at:nowIso };
    await repository.saveSourceRun(run);
    const result = operationResult(run, false);
    await repository.saveSourceRunOperation(runId, { ...operation, status:"COMPLETED", completed_at:nowIso, result });
    return { run, result, replayed:false };
  } catch (error) {
    run = { ...run, status:"UNCERTAIN", completion_reason:"INTERRUPTED_AFTER_OPERATION_START", completed_at:nowIso, active_operation_id:null, updated_at:nowIso };
    await repository.saveSourceRun(run);
    await repository.saveSourceRunOperation(runId, { ...operation, status:"UNCERTAIN", completed_at:nowIso, error_code:"SOURCE_RUN_INTERRUPTED" });
    throw error;
  }
}

export async function cancelSourceRun({ repository, runId, operationId, nowIso } = {}) {
  if (!validClientId(runId) || !validClientId(operationId)) throw new Error("SOURCE_RUN_ID_INVALID");
  let run = await repository.getSourceRun(runId);
  if (!run) throw new Error("SOURCE_RUN_NOT_FOUND");
  const previous = await repository.getSourceRunOperation(runId, operationId);
  if (previous?.status === "COMPLETED") return { run, result:previous.result, replayed:true };
  if (!isTerminalRun(run)) {
    await repository.saveSourceRunCancel(runId, { requested_at:run.cancel_requested_at || nowIso, operation_id:operationId });
    const wasRunning = run.status === "RUNNING";
    run = {
      ...run,
      cancel_requested_at:run.cancel_requested_at || nowIso,
      status:wasRunning ? run.status : "CANCELLED",
      completion_reason:wasRunning ? run.completion_reason : "CANCEL_REQUESTED",
      completed_at:wasRunning ? run.completed_at : nowIso,
      updated_at:nowIso
    };
    await repository.saveSourceRun(run);
  }
  const result = operationResult(run, false);
  await repository.saveSourceRunOperation(runId, { operation_id:operationId, action:"CANCEL", status:"COMPLETED", started_at:nowIso, completed_at:nowIso, result });
  return { run, result, replayed:false };
}
