import { authorizeRequest } from "../../src/server/auth.mjs";
import { collectSourcePage } from "../../src/server/collectors/dispatch.mjs";
import { getStateRepository } from "../../src/server/netlify-state.mjs";
import { envValue, sourceCollectionEnabled } from "../../src/server/runtime.mjs";
import { anyRuntimeSourceEligible, runtimeQualificationSummary } from "../../src/server/source-qualification.mjs";
import { fetchSourceDetail } from "../../src/server/source-detail-adapters.mjs";
import { ultraMaxNextOperationId } from "../../src/server/ultra-max-run-contract.mjs";
import { executeUltraMaxPhase, requestUltraMaxCancel, startUltraMaxRun } from "../../src/server/ultra-max-run-service.mjs";
import { createUltraNativeCollectionExecutor } from "../../src/server/ultra-native-collection.mjs";
import { validClientId } from "../../src/server/source-run-contract.mjs";

function json(payload, status = 200) {
  return Response.json(payload, { status, headers:{ "cache-control":"no-store" } });
}

function enabled(key) {
  return envValue(key).toLowerCase() === "true";
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
  const code = String(error?.code || error?.message || "ULTRA_MAX_REQUEST_FAILED").split(":")[0];
  const known = /^(?:ULTRA_MAX|ULTRA_NATIVE|SOURCE_RUN|HERITAGE_GRANT|STATE_ID)_[A-Z0-9_]+$/.test(code);
  return { code:known ? code : "ULTRA_MAX_REQUEST_FAILED", status:Number(error?.status) || (known ? 400 : 500) };
}

function nextOperation(run) {
  const phaseId = run.current_phase_id || run.plan_snapshot.phases.find((item) => item.status === "PENDING")?.phase_id;
  return phaseId ? { phase_id:phaseId, operation_id:ultraMaxNextOperationId(run, phaseId) } : null;
}

export default async function handler(request, context) {
  if (!["GET", "POST"].includes(request.method)) return json({ ok:false, error:{ code:"METHOD_NOT_ALLOWED", message:"Use GET or POST /api/ultra-max-runs." } }, 405);
  const auth = authorizeRequest(request, envValue("RADAR_INTERNAL_ACCESS_SECRET"));
  if (!auth.ok) return json({ ok:false, error:{ code:auth.code, message:"ULTRA MAX authorization failed." } }, auth.status);
  const body = request.method === "POST" ? await request.json().catch(() => null) : null;
  if (request.method === "POST" && !body) return json({ ok:false, error:{ code:"ULTRA_MAX_JSON_INVALID", message:"Request body must be valid JSON." } }, 400);
  const action = request.method === "POST" ? String(body.action || "").toUpperCase() : "GET";

  try {
    const repository = await getStateRepository(request, context);
    if (request.method === "GET") {
      const runId = new URL(request.url).searchParams.get("run_id");
      if (runId && !validClientId(runId)) return json({ ok:false, error:{ code:"ULTRA_MAX_ID_INVALID", message:"run_id is invalid." } }, 400);
      const run = runId ? await repository.getUltraMaxRun(runId) : await repository.lastUltraMaxRun();
      if (!run) return json({ ok:false, error:{ code:"ULTRA_MAX_RUN_NOT_FOUND", message:"ULTRA MAX run was not found." } }, 404);
      return json({ ok:true, run, next_operation:nextOperation(run) });
    }

    const nowIso = globalThis.__RADAR_TEST_NOW_ISO__ || new Date().toISOString();
    if (action === "CANCEL") {
      const result = await requestUltraMaxCancel({ repository, runId:body.run_id, operationId:body.operation_id, nowIso });
      return json({ ok:true, replayed:result.replayed, run:result.run, next_operation:null });
    }
    if (!enabled("RADAR_ULTRA_MAX_ENABLED")) return json({ ok:false, error:{ code:"ULTRA_MAX_LOCKED", message:"ULTRA MAX is disabled." } }, 423);
    if (!sourceCollectionEnabled()) return json({ ok:false, error:{ code:"SOURCE_COLLECTION_LOCKED", message:"Native source collection is disabled." } }, 423);
    if (!anyRuntimeSourceEligible()) return json({ ok:false, qualification:runtimeQualificationSummary(), error:{ code:"SOURCE_RELEVANCE_LOCKED", message:"No source is runtime-qualified." } }, 423);

    if (action === "START") {
      const result = await startUltraMaxRun({ repository, requestId:body.request_id, nowIso });
      return json({ ok:true, replayed:result.replayed, run:result.run, next_operation:nextOperation(result.run) }, result.replayed ? 200 : 201);
    }
    if (action !== "CONTINUE_NATIVE") return json({ ok:false, error:{ code:"ULTRA_MAX_ACTION_INVALID", message:"Choose START, CONTINUE_NATIVE or CANCEL." } }, 400);
    if (!validClientId(body.run_id) || !validClientId(body.operation_id)) return json({ ok:false, error:{ code:"ULTRA_MAX_ID_INVALID", message:"run_id and operation_id are required." } }, 400);
    const grantRecords = Array.isArray(body.grant_records) ? body.grant_records : [];
    if (grantRecords.length && !enabled("RADAR_HERITAGE_GRANT_IMPORT_ENABLED")) {
      return json({ ok:false, error:{ code:"HERITAGE_GRANT_IMPORT_LOCKED", message:"Grant import is disabled." } }, 423);
    }
    const executor = createUltraNativeCollectionExecutor({
      repository,
      nowIso,
      grantRecords,
      collectPage:({sourceId,queryPackId,position,nowIso:at,limit}) => collectSourcePage({sourceId,queryPackId,position,nowIso:at,limit,fetchImpl:sourceFetch(sourceId)}),
      fetchDetail:({candidate,nowIso:at}) => fetchSourceDetail({candidate,nowIso:at,fetchImpl:sourceDetailFetch(candidate?.primary_record?.source_id)})
    });
    const result = await executeUltraMaxPhase({repository,runId:body.run_id,phaseId:"NATIVE_COLLECTION",operationId:body.operation_id,nowIso,execute:executor});
    return json({ok:true,replayed:result.replayed,run:result.run,next_operation:nextOperation(result.run),result:result.result});
  } catch (error) {
    const safe = safeError(error);
    console.error("[radar-ultra-max]", safe.code);
    return json({ok:false,error:{code:safe.code,message:"ULTRA MAX request failed safely."}}, safe.status);
  }
}

export const config = { path:"/api/ultra-max-runs" };
