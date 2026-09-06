import { PAID_COORDINATOR_REQUIRED_CAPABILITIES } from "../../src/server/paid-run-coordinator-contract.mjs";

function conflict(code = "PAID_COORDINATOR_VERSION_CONFLICT") {
  const error = new Error(code);
  error.code = code;
  error.status = 409;
  return error;
}

export function memoryPaidCoordinator({ capMicrousd = 500_000 } = {}) {
  const runs = new Map();
  let queue = Promise.resolve();
  const serial = (work) => {
    const next = queue.then(work, work);
    queue = next.catch(() => {});
    return next;
  };
  const capabilities = Object.freeze(Object.fromEntries(PAID_COORDINATOR_REQUIRED_CAPABILITIES.map((name) => [name, true])));
  return {
    capabilities,
    runs,
    readOperation(runId, operationId) {
      return serial(() => {
        const run = runs.get(runId);
        if (!run) return null;
        const operation = run.operations.get(operationId);
        return {
          run_id:runId,
          operation_id:operationId,
          run_status:run.status,
          operation_status:operation?.status || null,
          version:run.version,
          fence_token:run.fence,
          cap_microusd:capMicrousd,
          reserved_microusd:run.reserved,
          settled_microusd:run.settled,
          error_code:operation?.error_code || null,
          updated_at:run.updated_at || new Date().toISOString(),
          completed_at:operation?.status === "COMPLETED" ? new Date().toISOString() : null
        };
      });
    },
    claimOperation(runId, operationId, expectedVersion) {
      return serial(() => {
        const run = runs.get(runId) || { version:0, fence:0, status:"READY", reserved:0, settled:0, operations:new Map(), reservations:new Map() };
        runs.set(runId, run);
        const existing = run.operations.get(operationId);
        if (existing) return { replayed:true, run_id:runId, operation_id:operationId, ...existing };
        if (["COMPLETED", "CANCELLED", "UNCERTAIN"].includes(run.status)) throw conflict("PAID_COORDINATOR_RUN_TERMINAL");
        if (run.version !== expectedVersion) throw conflict();
        run.version += 1;
        run.fence += 1;
        run.status = "CLAIMED";
        const operation = { status:"CLAIMED", version:run.version, fence_token:run.fence, result:null };
        run.operations.set(operationId, operation);
        return { replayed:false, run_id:runId, operation_id:operationId, ...operation };
      });
    },
    reserveBudget(runId, reservationId, maxMicrousd, expectedVersion) {
      return serial(() => {
        const run = runs.get(runId);
        if (!run || run.version !== expectedVersion || run.status !== "CLAIMED") throw conflict();
        const existing = run.reservations.get(reservationId);
        if (existing) {
          if (existing.max_microusd !== maxMicrousd) throw conflict("PAID_COORDINATOR_RESERVATION_MISMATCH");
          return { replayed:true, run_id:runId, reservation_id:reservationId, version:run.version, ...existing };
        }
        if (run.reserved + run.settled + maxMicrousd > capMicrousd) throw conflict("PAID_COORDINATOR_BUDGET_CAP_EXCEEDED");
        run.version += 1;
        run.status = "RESERVED";
        run.reserved += maxMicrousd;
        const reservation = { status:"RESERVED", max_microusd:maxMicrousd, actual_microusd:null, fence_token:run.fence };
        run.reservations.set(reservationId, reservation);
        return { replayed:false, run_id:runId, reservation_id:reservationId, version:run.version, ...reservation };
      });
    },
    settleBudget(runId, reservationId, actualMicrousd, fenceToken) {
      return serial(() => {
        const run = runs.get(runId);
        const reservation = run?.reservations.get(reservationId);
        if (!run || !reservation || run.fence !== fenceToken) throw conflict("PAID_COORDINATOR_STALE_FENCE");
        if (reservation.status === "SETTLED") {
          if (reservation.actual_microusd !== actualMicrousd) throw conflict("PAID_COORDINATOR_SETTLEMENT_MISMATCH");
          return { replayed:true, run_id:runId, reservation_id:reservationId, version:run.version, ...reservation };
        }
        if (actualMicrousd > reservation.max_microusd) throw conflict("PAID_COORDINATOR_RESERVATION_EXCEEDED");
        run.version += 1;
        run.status = "SETTLED";
        run.reserved -= reservation.max_microusd;
        run.settled += actualMicrousd;
        Object.assign(reservation, { status:"SETTLED", actual_microusd:actualMicrousd });
        return { replayed:false, run_id:runId, reservation_id:reservationId, version:run.version, ...reservation };
      });
    },
    completeOperation(runId, operationId, result, fenceToken) {
      return serial(() => {
        const run = runs.get(runId);
        const operation = run?.operations.get(operationId);
        if (!run || !operation || run.fence !== fenceToken) throw conflict("PAID_COORDINATOR_STALE_FENCE");
        if (run.status !== "SETTLED" || operation.status !== "CLAIMED") throw conflict("PAID_COORDINATOR_OPERATION_STATE_INVALID");
        run.version += 1;
        run.status = "COMPLETED";
        Object.assign(operation, { status:"COMPLETED", result, version:run.version });
        return { replayed:false, result };
      });
    },
    markUncertain(runId, operationId, code, fenceToken) {
      return serial(() => {
        const run = runs.get(runId);
        const operation = run?.operations.get(operationId);
        if (!run || !operation || run.fence !== fenceToken) throw conflict("PAID_COORDINATOR_STALE_FENCE");
        run.version += 1;
        run.status = "UNCERTAIN";
        Object.assign(operation, { status:"UNCERTAIN", error_code:code, version:run.version });
        return { status:"UNCERTAIN", version:run.version, fence_token:fenceToken };
      });
    }
  };
}
