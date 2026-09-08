import { randomUUID } from "node:crypto";
import { validClientId } from "./source-run-contract.mjs";
import {
  beginUltraMaxPhase,
  cancelUltraMaxRun,
  completeUltraMaxPhase,
  createUltraMaxRun,
  pauseUltraMaxPhase,
  ultraMaxNextOperationId,
  recordUltraMaxUsage
} from "./ultra-max-run-contract.mjs";

const TERMINAL = new Set(["COMPLETED", "CANCELLED", "UNCERTAIN"]);

function operationResult(run, phaseId, payload = null) {
  return {
    run_id:run.run_id,
    status:run.status,
    phase_id:phaseId,
    completion_reason:run.completion_reason,
    usage:run.usage,
    next_operation_id:["READY", "RUNNING", "PAUSED"].includes(run.status) && run.current_phase_id
      ? ultraMaxNextOperationId(run, run.current_phase_id)
      : null,
    payload
  };
}

function uncertain(run, phaseId, operationId, nowIso, reason) {
  return {
    ...run,
    status:"UNCERTAIN",
    current_phase_id:phaseId,
    active_operation_id:null,
    completion_reason:reason,
    completed_at:nowIso,
    updated_at:nowIso,
    plan_snapshot:{
      ...run.plan_snapshot,
      phases:run.plan_snapshot.phases.map((item) => item.phase_id === phaseId
        ? { ...item, status:"UNCERTAIN", last_operation_id:operationId, completed_at:nowIso }
        : item)
    }
  };
}

function validateDependencies(repository) {
  if (!repository) throw new Error("ULTRA_MAX_REPOSITORY_REQUIRED");
}

export async function startUltraMaxRun({ repository, requestId, nowIso, runId = randomUUID() } = {}) {
  validateDependencies(repository);
  if (!validClientId(requestId)) throw new Error("ULTRA_MAX_REQUEST_ID_INVALID");
  const previous = await repository.getUltraMaxRunRequest(requestId);
  if (previous?.run_id) {
    const run = await repository.getUltraMaxRun(previous.run_id);
    if (run) return { run, replayed:true };
  }
  const run = createUltraMaxRun({ requestId, nowIso, runId });
  await repository.saveUltraMaxRun(run);
  await repository.saveUltraMaxRunRequest(requestId, {
    run_id:run.run_id,
    profile_id:run.profile_id,
    created_at:nowIso
  });
  return { run, replayed:false };
}

export async function executeUltraMaxPhase({ repository, runId, phaseId, operationId, nowIso, execute } = {}) {
  validateDependencies(repository);
  if (typeof execute !== "function") throw new Error("ULTRA_MAX_EXECUTOR_REQUIRED");
  if (!validClientId(runId) || !validClientId(operationId)) throw new Error("ULTRA_MAX_ID_INVALID");
  let run = await repository.getUltraMaxRun(runId);
  if (!run) throw new Error("ULTRA_MAX_RUN_NOT_FOUND");
  const target = run.plan_snapshot.phases.find((item) => item.phase_id === phaseId);
  if (!target) throw new Error("ULTRA_MAX_PHASE_INVALID");

  const previous = await repository.getUltraMaxRunOperation(runId, operationId);
  if (previous?.status === "COMPLETED") {
    return { run, result:previous.result, replayed:true };
  }
  if (previous?.status === "IN_PROGRESS" || previous?.status === "UNCERTAIN") {
    run = uncertain(run, phaseId, operationId, nowIso, "INTERRUPTED_OPERATION_REPLAY");
    await repository.saveUltraMaxRun(run);
    return { run, result:operationResult(run, phaseId), replayed:true };
  }
  if (ultraMaxNextOperationId(run, phaseId) !== operationId) throw new Error("ULTRA_MAX_OPERATION_ID_MISMATCH");
  if (TERMINAL.has(run.status)) return { run, result:operationResult(run, phaseId), replayed:true };

  const cancelMarker = await repository.getUltraMaxRunCancel(runId);
  if (cancelMarker?.requested_at) {
    run = cancelUltraMaxRun(run, cancelMarker.requested_at);
    await repository.saveUltraMaxRun(run);
    return { run, result:operationResult(run, phaseId), replayed:true };
  }

  const begunRun = { ...beginUltraMaxPhase(run, phaseId, nowIso), active_operation_id:operationId };
  const operation = {
    operation_id:operationId,
    phase_id:phaseId,
    status:"IN_PROGRESS",
    started_at:nowIso,
    completed_at:null,
    result:null,
    error_code:null
  };
  await repository.saveUltraMaxRunOperation(runId, operation);
  run = begunRun;
  await repository.saveUltraMaxRun(run);

  try {
    const output = await execute({ run:structuredClone(run), phase:structuredClone(target), operationId });
    const usage = output?.usage || {};
    run = recordUltraMaxUsage(run, phaseId, usage, nowIso);
    const postDispatchCancel = await repository.getUltraMaxRunCancel(runId);
    run = postDispatchCancel?.requested_at
      ? cancelUltraMaxRun(run, postDispatchCancel.requested_at)
      : output?.complete === false
        ? pauseUltraMaxPhase(run, phaseId, output?.checkpoint ?? null, nowIso)
        : { ...completeUltraMaxPhase(run, phaseId, nowIso), active_operation_id:null };
    const result = operationResult(run, phaseId, output?.payload ?? null);
    await repository.saveUltraMaxRun(run);
    await repository.saveUltraMaxRunOperation(runId, {
      ...operation,
      status:"COMPLETED",
      completed_at:nowIso,
      result
    });
    return { run, result, replayed:false };
  } catch (error) {
    run = uncertain(run, phaseId, operationId, nowIso, "PHASE_EXECUTION_UNCERTAIN");
    await repository.saveUltraMaxRun(run);
    await repository.saveUltraMaxRunOperation(runId, {
      ...operation,
      status:"UNCERTAIN",
      completed_at:nowIso,
      error_code:error?.code || "ULTRA_MAX_PHASE_EXECUTION_FAILED"
    });
    throw error;
  }
}

export async function requestUltraMaxCancel({ repository, runId, operationId, nowIso } = {}) {
  validateDependencies(repository);
  if (!validClientId(runId) || !validClientId(operationId)) throw new Error("ULTRA_MAX_ID_INVALID");
  let run = await repository.getUltraMaxRun(runId);
  if (!run) throw new Error("ULTRA_MAX_RUN_NOT_FOUND");
  const previous = await repository.getUltraMaxRunOperation(runId, operationId);
  if (previous?.status === "COMPLETED") return { run, result:previous.result, replayed:true };
  await repository.saveUltraMaxRunCancel(runId, { operation_id:operationId, requested_at:nowIso });
  run = cancelUltraMaxRun(run, nowIso);
  const result = operationResult(run, run.current_phase_id);
  await repository.saveUltraMaxRun(run);
  await repository.saveUltraMaxRunOperation(runId, {
    operation_id:operationId,
    phase_id:run.current_phase_id,
    action:"CANCEL",
    status:"COMPLETED",
    started_at:nowIso,
    completed_at:nowIso,
    result,
    error_code:null
  });
  return { run, result, replayed:false };
}
