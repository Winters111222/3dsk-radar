import { createHash } from "node:crypto";
import { importHeritageGrantBatch } from "./heritage-grant-import-service.mjs";
import { continueSourceRun, startSourceRun } from "./source-run-service.mjs";

function digest(value) {
  return createHash("sha256").update(String(value)).digest("hex").slice(0, 24);
}

function delta(after, before, key) {
  return Math.max(0, (Number(after?.[key]) || 0) - (Number(before?.[key]) || 0));
}

function childIdentity(rootRunId) {
  const suffix = digest(rootRunId);
  return {
    runId:`native-run-${suffix}`,
    requestId:`native-request-${suffix}`
  };
}

function childOperationId(rootRunId, chunkIndex) {
  return `native-chunk-${String(chunkIndex).padStart(4, "0")}-${digest(rootRunId)}`;
}

function terminalFailure(status) {
  const failure = new Error(`ULTRA_NATIVE_CHILD_${status}`);
  failure.code = `ULTRA_NATIVE_CHILD_${status}`;
  return failure;
}

export function createUltraNativeCollectionExecutor({ repository, nowIso, collectPage, fetchDetail = null, grantRecords = [], maxPages = 4 } = {}) {
  if (!repository || typeof collectPage !== "function") throw new Error("ULTRA_NATIVE_DEPENDENCY_MISSING");
  return async function executeNativeCollection({ run, phase }) {
    if (phase?.phase_id !== "NATIVE_COLLECTION") throw new Error("ULTRA_NATIVE_PHASE_INVALID");
    const identity = childIdentity(run.run_id);
    const checkpoint = phase.checkpoint || {};
    if (checkpoint.child_run_id && checkpoint.child_run_id !== identity.runId) throw new Error("ULTRA_NATIVE_CHILD_ID_MISMATCH");

    const started = await startSourceRun({
      repository,
      profileId:"WIDE",
      requestId:identity.requestId,
      runId:identity.runId,
      nowIso
    });
    const before = structuredClone(started.run.counters);
    let grantResult = { imported_count:0, replayed_count:0, opportunity_ids:[] };
    if (!checkpoint.grants_processed && grantRecords.length) {
      grantResult = await importHeritageGrantBatch({ repository, records:grantRecords, nowIso });
    }

    const chunkIndex = Number(phase.next_chunk_index) || 1;
    const continued = await continueSourceRun({
      repository,
      runId:identity.runId,
      operationId:childOperationId(run.run_id, chunkIndex),
      nowIso,
      maxPages,
      collectPage,
      fetchDetail
    });
    const child = continued.run;
    if (["CANCELLED", "UNCERTAIN"].includes(child.status)) throw terminalFailure(child.status);
    const completed = child.status === "COMPLETED";
    return {
      complete:completed,
      usage:{
        source_requests:delta(child.counters, before, "total_pages_fetched"),
        candidates_seen:delta(child.counters, before, "candidates_accepted"),
        results_accepted:delta(child.counters, before, "candidates_promoted") + grantResult.imported_count
      },
      checkpoint:completed ? null : {
        child_run_id:identity.runId,
        child_status:child.status,
        child_phase:child.phase,
        child_operation_index:chunkIndex,
        grants_processed:checkpoint.grants_processed || grantRecords.length > 0,
        next_retry_at:child.next_retry_at || null
      },
      payload:{
        child_run_id:identity.runId,
        child_status:child.status,
        grants_imported:grantResult.imported_count,
        grants_replayed:grantResult.replayed_count,
        grant_opportunity_ids:grantResult.opportunity_ids,
        source_counters:child.counters
      }
    };
  };
}
