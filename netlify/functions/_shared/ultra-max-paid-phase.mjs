import { loadPublicCompanyProfile } from "../../../src/server/profile.mjs";
import { getNetlifyPaidCoordinator } from "../../../src/server/paid-run-coordinator-netlify-db.mjs";
import { envValue } from "../../../src/server/runtime.mjs";
import { ultraMaxNextOperationId } from "../../../src/server/ultra-max-run-contract.mjs";
import { executeUltraMaxPhase } from "../../../src/server/ultra-max-run-service.mjs";
import { createUltraMaxPaidPhaseExecutor, ULTRA_MAX_PAID_PHASE_IDS } from "../../../src/server/ultra-max-paid-executor.mjs";
import {
  ultraMaxPaidConfiguration,
  ultraMaxPaidConfirmationValid
} from "../../../src/server/ultra-max-paid-policy.mjs";
import { validClientId } from "../../../src/server/source-run-contract.mjs";
import { probeUltraPaidCoordinator } from "../../../src/server/ultra-paid-coordinator-probe.mjs";

function fail(code,status=400) {
  const error=new Error(code);
  error.code=code;
  error.status=status;
  throw error;
}

export async function prepareUltraMaxPaidPhase({body,context,repository}={}) {
  if (!validClientId(body?.run_id)||!validClientId(body?.operation_id)) fail("ULTRA_MAX_ID_INVALID");
  if (!ultraMaxPaidConfirmationValid(body?.paid_confirmation)) fail("ULTRA_MAX_PAID_CONFIRMATION_REQUIRED",403);
  const config=ultraMaxPaidConfiguration({context,getEnv:envValue});
  if (!config.ok) fail(`ULTRA_MAX_PAID_${config.state}`,config.state==="OPENAI_NOT_CONFIGURED"?503:423);
  const run=await repository.getUltraMaxRun(body.run_id);
  if (!run) fail("ULTRA_MAX_RUN_NOT_FOUND",404);
  const phaseId=String(body.phase_id||"");
  if (!ULTRA_MAX_PAID_PHASE_IDS.includes(phaseId)) fail("ULTRA_PAID_PHASE_INVALID");
  const phase=run.plan_snapshot.phases.find((item)=>item.phase_id===phaseId);
  if (!phase||!["PAID_HOSTED_SEARCH","PAID_DETAIL_VERIFY"].includes(phase.kind)) fail("ULTRA_PAID_PHASE_INVALID");
  if (ultraMaxNextOperationId(run,phaseId)!==body.operation_id) fail("ULTRA_MAX_OPERATION_ID_MISMATCH",409);
  const pending=run.current_phase_id||run.plan_snapshot.phases.find((item)=>item.status==="PENDING")?.phase_id;
  if (pending!==phaseId) fail("ULTRA_MAX_PHASE_ORDER_VIOLATION",409);
  const coordinator=await getNetlifyPaidCoordinator({capMicrousd:config.cap_microusd,lifecycleMode:"MULTI_OPERATION"});
  const readiness=await probeUltraPaidCoordinator(coordinator,{runId:run.run_id,operationId:body.operation_id,expectedCapMicrousd:config.cap_microusd});
  if (!readiness.ready) fail(readiness.code,readiness.code.endsWith("UNAVAILABLE")?503:423);
  return {config,run,phase,coordinator};
}

export async function executePreparedUltraMaxPaidPhase({prepared,body,repository,nowIso}={}) {
  const profile=await loadPublicCompanyProfile();
  const executor=createUltraMaxPaidPhaseExecutor({
    phaseId:prepared.phase.phase_id,
    repository,
    coordinator:prepared.coordinator,
    apiKey:envValue("OPENAI_API_KEY"),
    model:prepared.config.model,
    profile,
    nowIso,
    searchRunner:globalThis.__RADAR_TEST_ULTRA_SEARCH_RUNNER__,
    fetchImpl:globalThis.__RADAR_TEST_OPENAI_FETCH__||fetch
  });
  return executeUltraMaxPhase({
    repository,
    runId:body.run_id,
    phaseId:prepared.phase.phase_id,
    operationId:body.operation_id,
    nowIso,
    execute:executor
  });
}
