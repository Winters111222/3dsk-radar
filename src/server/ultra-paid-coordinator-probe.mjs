import { ultraPaidCoordinatorReadiness } from "./paid-run-coordinator-contract.mjs";

export async function probeUltraPaidCoordinator(coordinator,{runId="ultra-readiness-probe",operationId="ultra-readiness-operation",expectedCapMicrousd=null}={}) {
  const readiness=ultraPaidCoordinatorReadiness(coordinator);
  if (!readiness.ready
    || (expectedCapMicrousd!==null&&coordinator?.cap_microusd!==expectedCapMicrousd)
    || typeof coordinator?.readOperation!=="function"
    || typeof coordinator?.completeOperation!=="function"
    || typeof coordinator?.markUncertain!=="function") return {ready:false,code:"ULTRA_PAID_COORDINATOR_LOCKED"};
  try {
    await coordinator.readOperation(runId,operationId);
    return {ready:true,code:"READY"};
  } catch {
    return {ready:false,code:"ULTRA_PAID_COORDINATOR_UNAVAILABLE"};
  }
}
