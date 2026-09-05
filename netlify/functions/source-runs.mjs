import { authorizeRequest } from "../../src/server/auth.mjs";
import { boundedCollectorInteger, CollectorError } from "../../src/server/collectors/collector-contract.mjs";
import { collectSourcePage } from "../../src/server/collectors/dispatch.mjs";
import { getStateRepository } from "../../src/server/netlify-state.mjs";
import { envValue, sourceCollectionEnabled } from "../../src/server/runtime.mjs";
import { fetchSourceDetail } from "../../src/server/source-detail-adapters.mjs";
import { cancelSourceRun, continueSourceRun, startSourceRun } from "../../src/server/source-run-service.mjs";
import { SOURCE_RUN_PROFILES, validClientId } from "../../src/server/source-run-contract.mjs";

function json(payload, status = 200, extraHeaders = {}) {
  return Response.json(payload, { status, headers:{ "cache-control":"no-store", ...extraHeaders } });
}

function runtimeState() {
  const key = "__3DSK_RADAR_SOURCE_RUN_STATE__";
  if (!globalThis[key]) globalThis[key] = { inFlight:new Set(), lastStartedAt:new Map() };
  return globalThis[key];
}

function cooldownMs() {
  return boundedCollectorInteger(envValue("RADAR_SOURCE_COLLECTION_COOLDOWN_SECONDS"), 10, 0, 600) * 1000;
}

function sourceFetch(sourceId) {
  return {
    ted_eu:globalThis.__RADAR_TEST_TED_FETCH__,
    find_tender_uk:globalThis.__RADAR_TEST_FIND_TENDER_FETCH__,
    contracts_finder_uk:globalThis.__RADAR_TEST_CONTRACTS_FINDER_FETCH__
  }[sourceId] || fetch;
}

function sourceDetailFetch(sourceId) {
  return {
    ted_eu:globalThis.__RADAR_TEST_TED_DETAIL_FETCH__,
    find_tender_uk:globalThis.__RADAR_TEST_FIND_TENDER_DETAIL_FETCH__,
    contracts_finder_uk:globalThis.__RADAR_TEST_CONTRACTS_FINDER_DETAIL_FETCH__
  }[sourceId] || sourceFetch(sourceId);
}

function safeError(error) {
  const code = String(error?.message || "");
  const statuses = {
    SOURCE_RUN_NOT_FOUND:404,
    SOURCE_RUN_PROFILE_INVALID:400,
    SOURCE_RUN_REQUEST_ID_INVALID:400,
    SOURCE_RUN_REQUEST_CONFLICT:409,
    SOURCE_RUN_ID_INVALID:400,
    SOURCE_RUN_OPERATION_IN_PROGRESS:409,
    STATE_ID_INVALID:400
  };
  return {
    code:statuses[code] ? code : (error instanceof CollectorError ? error.code : "SOURCE_RUN_FAILED"),
    status:statuses[code] || (error instanceof CollectorError ? error.status : 500),
    message:statuses[code] ? code.replaceAll("_", " ").toLowerCase() + "." : "Source run could not be completed safely."
  };
}

export default async function handler(request, context) {
  if (!["GET", "POST"].includes(request.method)) {
    return json({ ok:false, error:{ code:"METHOD_NOT_ALLOWED", message:"Use GET or POST /api/source-runs." } }, 405, { allow:"GET, POST" });
  }
  const auth = authorizeRequest(request, envValue("RADAR_INTERNAL_ACCESS_SECRET"));
  if (!auth.ok) {
    return json({ ok:false, error:{ code:auth.code, message:auth.status === 503 ? "Internal access is not configured on the server." : "Invalid internal access code." } }, auth.status);
  }

  const body = request.method === "POST" ? await request.json().catch(() => ({})) : null;
  const action = request.method === "POST" ? String(body.action || "").toUpperCase() : null;
  if (request.method === "POST" && action !== "CANCEL" && !sourceCollectionEnabled()) {
    return json({ ok:false, error:{ code:"SOURCE_COLLECTION_LOCKED", message:"Source runs are intentionally locked until deployed zero-cost acceptance explicitly enables collection." } }, 423);
  }

  try {
    const repository = await getStateRepository(request, context);
    if (request.method === "GET") {
      const url = new URL(request.url);
      const runId = url.searchParams.get("run_id");
      if (runId && !validClientId(runId)) return json({ ok:false, error:{ code:"SOURCE_RUN_ID_INVALID", message:"run_id is invalid." } }, 400);
      const run = runId ? await repository.getSourceRun(runId) : await repository.lastSourceRun();
      if (!run) return json({ ok:false, error:{ code:"SOURCE_RUN_NOT_FOUND", message:"Source run was not found." } }, 404);
      const candidates = await repository.listSourceRunCandidates(run.run_id);
      return json({ ok:true, collection_enabled:sourceCollectionEnabled(), run, candidates, candidate_count:candidates.length, openai_requests:0, cost_usd:0 });
    }

    const nowIso = globalThis.__RADAR_TEST_NOW_ISO__ || new Date().toISOString();
    if (action === "CANCEL") {
      const result = await cancelSourceRun({ repository, runId:body.run_id, operationId:body.operation_id, nowIso });
      return json({ ok:true, ...result.result, run:result.run });
    }
    if (action === "START") {
      if (!SOURCE_RUN_PROFILES[body.profile_id]) return json({ ok:false, error:{ code:"SOURCE_RUN_PROFILE_INVALID", message:"Choose FOCUSED or WIDE." } }, 400);
      if (!validClientId(body.request_id)) return json({ ok:false, error:{ code:"SOURCE_RUN_REQUEST_ID_INVALID", message:"request_id is invalid." } }, 400);
      const runtime = runtimeState();
      const lockKey = `start:${body.request_id}`;
      if (runtime.inFlight.has(lockKey)) return json({ ok:false, error:{ code:"SOURCE_RUN_START_IN_PROGRESS", message:"This start request is already running." } }, 409);
      runtime.inFlight.add(lockKey);
      try {
        const result = await startSourceRun({ repository, profileId:body.profile_id, requestId:body.request_id, nowIso });
        return json({ ok:true, replayed:result.replayed, run:result.run, openai_requests:0, cost_usd:0 }, result.replayed ? 200 : 201);
      } finally {
        runtime.inFlight.delete(lockKey);
      }
    }
    if (action !== "CONTINUE") return json({ ok:false, error:{ code:"SOURCE_RUN_ACTION_INVALID", message:"Choose START, CONTINUE or CANCEL." } }, 400);
    if (!validClientId(body.run_id) || !validClientId(body.operation_id)) return json({ ok:false, error:{ code:"SOURCE_RUN_ID_INVALID", message:"run_id and operation_id are required." } }, 400);

    const runtime = runtimeState();
    const remaining = Math.max(0, cooldownMs() - (Date.now() - (runtime.lastStartedAt.get(body.run_id) || 0)));
    if (runtime.inFlight.has(body.run_id) || remaining > 0) {
      return json({ ok:false, error:{ code:"SOURCE_RUN_RATE_LIMITED", message:runtime.inFlight.has(body.run_id) ? "This source run is already continuing." : "Source run cooldown is active.", retry_after_seconds:runtime.inFlight.has(body.run_id) ? 10 : Math.ceil(remaining / 1000) } }, 429);
    }
    runtime.inFlight.add(body.run_id);
    runtime.lastStartedAt.set(body.run_id, Date.now());
    try {
      const result = await continueSourceRun({
        repository,
        runId:body.run_id,
        operationId:body.operation_id,
        nowIso,
        collectPage:({ sourceId, queryPackId, position, nowIso:at, limit }) => collectSourcePage({ sourceId, queryPackId, position, nowIso:at, limit, fetchImpl:sourceFetch(sourceId) }),
        fetchDetail:({ candidate, nowIso:at }) => fetchSourceDetail({ candidate, nowIso:at, fetchImpl:sourceDetailFetch(candidate?.primary_record?.source_id) })
      });
      return json({ ok:true, ...result.result, replayed:result.replayed, run:result.run });
    } finally {
      runtime.inFlight.delete(body.run_id);
    }
  } catch (error) {
    const safe = safeError(error);
    console.error("[radar-source-run]", safe.code);
    return json({ ok:false, error:{ code:safe.code, message:safe.message } }, safe.status);
  }
}

export const config = { path:"/api/source-runs" };
