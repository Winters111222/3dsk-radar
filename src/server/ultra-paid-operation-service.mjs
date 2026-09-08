import { ultraPaidCoordinatorReadiness } from "./paid-run-coordinator-contract.mjs";
import { ultraMaxNextOperationId } from "./ultra-max-run-contract.mjs";

function integer(value, code, {min = 0} = {}) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min) throw new Error(code);
  return parsed;
}

function paidPhase(run, phaseId) {
  const phase = run?.plan_snapshot?.phases?.find((item) => item.phase_id === phaseId);
  if (!phase || !["PAID_HOSTED_SEARCH","PAID_DETAIL_VERIFY"].includes(phase.kind)) throw new Error("ULTRA_PAID_PHASE_INVALID");
  if (!phase.reservation_id || phase.budget_cap_microusd < 1) throw new Error("ULTRA_PAID_PHASE_BUDGET_INVALID");
  if (!['PENDING','PAUSED','RUNNING'].includes(phase.status)) throw new Error("ULTRA_PAID_PHASE_NOT_EXECUTABLE");
  return phase;
}

function childReservationId(phase, operationId) {
  const chunk = operationId.match(/-chunk-(\d{4})$/)?.[1];
  if (!chunk) throw new Error("ULTRA_PAID_OPERATION_ID_INVALID");
  return `${phase.reservation_id}-chunk-${chunk}`;
}

function replayResult(claim) {
  if (claim.status === "COMPLETED" && claim.result) return {replayed:true, result:claim.result, coordinator_version:claim.version};
  const error = new Error("ULTRA_PAID_OPERATION_REPLAY_UNCERTAIN");
  error.code = "ULTRA_PAID_OPERATION_REPLAY_UNCERTAIN";
  throw error;
}

function boundedUsage(value, phase) {
  const usage = {
    source_requests:integer(value?.source_requests||0,"ULTRA_PAID_USAGE_INVALID"),
    openai_requests:integer(value?.openai_requests||0,"ULTRA_PAID_USAGE_INVALID"),
    web_search_calls:integer(value?.web_search_calls||0,"ULTRA_PAID_USAGE_INVALID"),
    cost_microusd:integer(value?.cost_microusd,"ULTRA_PAID_USAGE_INVALID"),
    candidates_seen:integer(value?.candidates_seen||0,"ULTRA_PAID_USAGE_INVALID"),
    results_accepted:integer(value?.results_accepted||0,"ULTRA_PAID_USAGE_INVALID")
  };
  if (usage.source_requests > phase.max_source_requests
    || usage.openai_requests > phase.max_openai_requests
    || usage.web_search_calls > phase.max_web_search_calls
    || usage.cost_microusd > phase.budget_cap_microusd) throw new Error("ULTRA_PAID_PHASE_CAP_EXCEEDED");
  return usage;
}

export async function executeUltraPaidChild({coordinator,run,phaseId,operationId,expectedVersion,dispatch} = {}) {
  const readiness = ultraPaidCoordinatorReadiness(coordinator);
  if (!readiness.ready) throw new Error("ULTRA_PAID_COORDINATOR_LOCKED");
  if (typeof dispatch !== "function") throw new Error("ULTRA_PAID_DISPATCH_REQUIRED");
  if (coordinator.cap_microusd !== run?.plan_snapshot?.max_cost_microusd) throw new Error("ULTRA_PAID_ROOT_CAP_MISMATCH");
  const phase = paidPhase(run,phaseId);
  if (ultraMaxNextOperationId(run,phaseId) !== operationId) throw new Error("ULTRA_PAID_OPERATION_ID_MISMATCH");
  const version = integer(expectedVersion,"ULTRA_PAID_VERSION_INVALID");
  const reservationId = childReservationId(phase,operationId);
  const claim = await coordinator.claimOperation(run.run_id,operationId,version);
  if (claim.replayed) return replayResult(claim);
  let reservation;
  try {
    reservation = await coordinator.reserveBudget(run.run_id,reservationId,phase.budget_cap_microusd,claim.version);
    if (reservation.replayed) throw new Error("ULTRA_PAID_RESERVATION_REPLAY_UNCERTAIN");
  } catch (error) {
    await coordinator.markUncertain(run.run_id,operationId,error?.code||error?.message||"ULTRA_PAID_RESERVATION_FAILED",claim.fence_token).catch(()=>{});
    const failed = new Error("ULTRA_PAID_RESERVATION_FAILED");
    failed.code = "ULTRA_PAID_RESERVATION_FAILED";
    failed.cause = error;
    throw failed;
  }
  let output;
  try {
    output = await dispatch({run:structuredClone(run),phase:structuredClone(phase),operationId,reservationId});
    const usage = boundedUsage(output?.usage,phase);
    const settlement = await coordinator.settleBudget(run.run_id,reservationId,usage.cost_microusd,reservation.fence_token);
    const stored = {payload:output?.payload ?? null,usage};
    const completed = await coordinator.completeOperation(run.run_id,operationId,stored,settlement.fence_token);
    return {replayed:false,result:stored,coordinator_version:completed.version,run_status:completed.run_status};
  } catch (error) {
    await coordinator.markUncertain(run.run_id,operationId,error?.code||"ULTRA_PAID_DISPATCH_UNCERTAIN",reservation.fence_token).catch(()=>{});
    const uncertain = new Error("ULTRA_PAID_DISPATCH_UNCERTAIN");
    uncertain.code = "ULTRA_PAID_DISPATCH_UNCERTAIN";
    uncertain.cause = error;
    throw uncertain;
  }
}
