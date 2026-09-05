export const PAID_COORDINATOR_CONTRACT_VERSION = 1;

export const PAID_COORDINATOR_REQUIRED_CAPABILITIES = Object.freeze([
  "atomic_compare_and_swap",
  "durable_unique_operation_keys",
  "transactional_budget_reservation",
  "monotonic_fencing_tokens",
  "idempotent_settlement"
]);

export function paidCoordinatorReadiness(coordinator) {
  const capabilities = coordinator?.capabilities || {};
  const missing = PAID_COORDINATOR_REQUIRED_CAPABILITIES.filter((name) => capabilities[name] !== true);
  if (typeof coordinator?.claimOperation !== "function") missing.push("claimOperation(runId, operationId, expectedVersion)");
  if (typeof coordinator?.reserveBudget !== "function") missing.push("reserveBudget(runId, reservationId, maxMicrousd, expectedVersion)");
  if (typeof coordinator?.settleBudget !== "function") missing.push("settleBudget(runId, reservationId, actualMicrousd, fenceToken)");
  return {
    contract_version:PAID_COORDINATOR_CONTRACT_VERSION,
    ready:missing.length === 0,
    paid_execution:missing.length === 0 ? "READY_FOR_INTEGRATION" : "LOCKED",
    missing
  };
}
