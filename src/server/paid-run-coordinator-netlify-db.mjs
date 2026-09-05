import { PAID_COORDINATOR_REQUIRED_CAPABILITIES } from "./paid-run-coordinator-contract.mjs";

const ID_PATTERN = /^[A-Za-z0-9_-]{8,80}$/;

export class PaidCoordinatorError extends Error {
  constructor(code, status = 409) {
    super(code);
    this.name = "PaidCoordinatorError";
    this.code = code;
    this.status = status;
  }
}

function validId(value) {
  if (typeof value !== "string" || !ID_PATTERN.test(value)) {
    throw new PaidCoordinatorError("PAID_COORDINATOR_ID_INVALID", 400);
  }
  return value;
}

function integer(value, code, { min = 0 } = {}) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min) throw new PaidCoordinatorError(code, 400);
  return parsed;
}

async function transaction(pool, work) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    if (error?.code === "40001" || error?.code === "23505") {
      throw new PaidCoordinatorError("PAID_COORDINATOR_CONFLICT", 409);
    }
    throw error;
  } finally {
    client.release();
  }
}

function first(result) {
  return result?.rows?.[0] || null;
}

export function createPostgresPaidCoordinator({ pool, capMicrousd = 500_000 } = {}) {
  if (!pool?.connect) throw new Error("PAID_COORDINATOR_POOL_REQUIRED");
  const fixedCap = integer(capMicrousd, "PAID_COORDINATOR_CAP_INVALID", { min:1 });
  const capabilities = Object.freeze(Object.fromEntries(
    PAID_COORDINATOR_REQUIRED_CAPABILITIES.map((name) => [name, true])
  ));

  return {
    capabilities,

    async claimOperation(runId, operationId, expectedVersion) {
      validId(runId);
      validId(operationId);
      const expected = integer(expectedVersion, "PAID_COORDINATOR_VERSION_INVALID");
      return transaction(pool, async (client) => {
        await client.query(
          `INSERT INTO radar_paid_runs (run_id, cap_microusd)
           VALUES ($1, $2)
           ON CONFLICT (run_id) DO NOTHING`,
          [runId, fixedCap]
        );
        const run = first(await client.query(
          "SELECT * FROM radar_paid_runs WHERE run_id = $1 FOR UPDATE",
          [runId]
        ));
        if (Number(run.cap_microusd) !== fixedCap) {
          throw new PaidCoordinatorError("PAID_COORDINATOR_CAP_MISMATCH", 409);
        }
        const existing = first(await client.query(
          "SELECT * FROM radar_paid_operations WHERE run_id = $1 AND operation_id = $2",
          [runId, operationId]
        ));
        if (existing) {
          return {
            replayed:true,
            run_id:runId,
            operation_id:operationId,
            status:existing.status,
            version:Number(existing.version),
            fence_token:Number(existing.fence_token),
            result:existing.result_json || null
          };
        }
        if (["COMPLETED", "CANCELLED", "UNCERTAIN"].includes(run.status)) {
          throw new PaidCoordinatorError("PAID_COORDINATOR_RUN_TERMINAL", 409);
        }
        if (Number(run.version) !== expected) {
          throw new PaidCoordinatorError("PAID_COORDINATOR_VERSION_CONFLICT", 409);
        }
        const version = expected + 1;
        const fenceToken = Number(run.fence_token) + 1;
        await client.query(
          `INSERT INTO radar_paid_operations
             (run_id, operation_id, status, version, fence_token)
           VALUES ($1, $2, 'CLAIMED', $3, $4)`,
          [runId, operationId, version, fenceToken]
        );
        await client.query(
          `UPDATE radar_paid_runs
           SET status = 'CLAIMED', version = $2, fence_token = $3, updated_at = NOW()
           WHERE run_id = $1`,
          [runId, version, fenceToken]
        );
        return { replayed:false, run_id:runId, operation_id:operationId, status:"CLAIMED", version, fence_token:fenceToken, result:null };
      });
    },

    async reserveBudget(runId, reservationId, maxMicrousd, expectedVersion) {
      validId(runId);
      validId(reservationId);
      const amount = integer(maxMicrousd, "PAID_COORDINATOR_RESERVATION_INVALID", { min:1 });
      const expected = integer(expectedVersion, "PAID_COORDINATOR_VERSION_INVALID");
      return transaction(pool, async (client) => {
        const run = first(await client.query(
          "SELECT * FROM radar_paid_runs WHERE run_id = $1 FOR UPDATE",
          [runId]
        ));
        if (!run) throw new PaidCoordinatorError("PAID_COORDINATOR_RUN_NOT_FOUND", 404);
        const existing = first(await client.query(
          "SELECT * FROM radar_paid_reservations WHERE run_id = $1 AND reservation_id = $2",
          [runId, reservationId]
        ));
        if (existing) {
          if (Number(existing.max_microusd) !== amount) {
            throw new PaidCoordinatorError("PAID_COORDINATOR_RESERVATION_MISMATCH", 409);
          }
          return {
            replayed:true,
            run_id:runId,
            reservation_id:reservationId,
            status:existing.status,
            version:Number(run.version),
            fence_token:Number(existing.fence_token),
            max_microusd:Number(existing.max_microusd),
            actual_microusd:existing.actual_microusd === null ? null : Number(existing.actual_microusd)
          };
        }
        if (Number(run.version) !== expected || run.status !== "CLAIMED") {
          throw new PaidCoordinatorError("PAID_COORDINATOR_VERSION_CONFLICT", 409);
        }
        if (Number(run.reserved_microusd) + Number(run.settled_microusd) + amount > Number(run.cap_microusd)) {
          throw new PaidCoordinatorError("PAID_COORDINATOR_BUDGET_CAP_EXCEEDED", 409);
        }
        const version = expected + 1;
        const fenceToken = Number(run.fence_token);
        await client.query(
          `INSERT INTO radar_paid_reservations
             (run_id, reservation_id, status, max_microusd, fence_token)
           VALUES ($1, $2, 'RESERVED', $3, $4)`,
          [runId, reservationId, amount, fenceToken]
        );
        await client.query(
          `UPDATE radar_paid_runs
           SET status = 'RESERVED', version = $2,
               reserved_microusd = reserved_microusd + $3, updated_at = NOW()
           WHERE run_id = $1`,
          [runId, version, amount]
        );
        return { replayed:false, run_id:runId, reservation_id:reservationId, status:"RESERVED", version, fence_token:fenceToken, max_microusd:amount, actual_microusd:null };
      });
    },

    async settleBudget(runId, reservationId, actualMicrousd, fenceToken) {
      validId(runId);
      validId(reservationId);
      const actual = integer(actualMicrousd, "PAID_COORDINATOR_SETTLEMENT_INVALID");
      const fence = integer(fenceToken, "PAID_COORDINATOR_FENCE_INVALID", { min:1 });
      return transaction(pool, async (client) => {
        const run = first(await client.query(
          "SELECT * FROM radar_paid_runs WHERE run_id = $1 FOR UPDATE",
          [runId]
        ));
        const reservation = first(await client.query(
          "SELECT * FROM radar_paid_reservations WHERE run_id = $1 AND reservation_id = $2 FOR UPDATE",
          [runId, reservationId]
        ));
        if (!run || !reservation) throw new PaidCoordinatorError("PAID_COORDINATOR_RESERVATION_NOT_FOUND", 404);
        if (Number(reservation.fence_token) !== fence || Number(run.fence_token) !== fence) {
          throw new PaidCoordinatorError("PAID_COORDINATOR_STALE_FENCE", 409);
        }
        if (reservation.status === "SETTLED") {
          if (Number(reservation.actual_microusd) !== actual) {
            throw new PaidCoordinatorError("PAID_COORDINATOR_SETTLEMENT_MISMATCH", 409);
          }
          return { replayed:true, run_id:runId, reservation_id:reservationId, status:"SETTLED", version:Number(run.version), fence_token:fence, actual_microusd:Number(reservation.actual_microusd) };
        }
        if (actual > Number(reservation.max_microusd)) {
          throw new PaidCoordinatorError("PAID_COORDINATOR_RESERVATION_EXCEEDED", 409);
        }
        const version = Number(run.version) + 1;
        await client.query(
          `UPDATE radar_paid_reservations
           SET status = 'SETTLED', actual_microusd = $3, settled_at = NOW()
           WHERE run_id = $1 AND reservation_id = $2`,
          [runId, reservationId, actual]
        );
        await client.query(
          `UPDATE radar_paid_runs
           SET status = 'SETTLED', version = $2,
               reserved_microusd = reserved_microusd - $3,
               settled_microusd = settled_microusd + $4,
               updated_at = NOW()
           WHERE run_id = $1`,
          [runId, version, Number(reservation.max_microusd), actual]
        );
        return { replayed:false, run_id:runId, reservation_id:reservationId, status:"SETTLED", version, fence_token:fence, actual_microusd:actual };
      });
    },

    async completeOperation(runId, operationId, result, fenceToken) {
      validId(runId);
      validId(operationId);
      const fence = integer(fenceToken, "PAID_COORDINATOR_FENCE_INVALID", { min:1 });
      return transaction(pool, async (client) => {
        const run = first(await client.query("SELECT * FROM radar_paid_runs WHERE run_id = $1 FOR UPDATE", [runId]));
        const operation = first(await client.query(
          "SELECT * FROM radar_paid_operations WHERE run_id = $1 AND operation_id = $2 FOR UPDATE",
          [runId, operationId]
        ));
        if (!run || !operation) throw new PaidCoordinatorError("PAID_COORDINATOR_OPERATION_NOT_FOUND", 404);
        if (Number(run.fence_token) !== fence || Number(operation.fence_token) !== fence) {
          throw new PaidCoordinatorError("PAID_COORDINATOR_STALE_FENCE", 409);
        }
        if (operation.status === "COMPLETED") return { replayed:true, result:operation.result_json };
        if (run.status !== "SETTLED" || operation.status !== "CLAIMED") {
          throw new PaidCoordinatorError("PAID_COORDINATOR_OPERATION_STATE_INVALID", 409);
        }
        const version = Number(run.version) + 1;
        const encoded = JSON.stringify(result);
        await client.query(
          `UPDATE radar_paid_operations
           SET status = 'COMPLETED', result_json = $3::jsonb, version = $4, completed_at = NOW()
           WHERE run_id = $1 AND operation_id = $2`,
          [runId, operationId, encoded, version]
        );
        await client.query(
          "UPDATE radar_paid_runs SET status = 'COMPLETED', version = $2, updated_at = NOW() WHERE run_id = $1",
          [runId, version]
        );
        return { replayed:false, result };
      });
    },

    async markUncertain(runId, operationId, code, fenceToken) {
      validId(runId);
      validId(operationId);
      const fence = integer(fenceToken, "PAID_COORDINATOR_FENCE_INVALID", { min:1 });
      return transaction(pool, async (client) => {
        const run = first(await client.query("SELECT * FROM radar_paid_runs WHERE run_id = $1 FOR UPDATE", [runId]));
        if (!run) throw new PaidCoordinatorError("PAID_COORDINATOR_RUN_NOT_FOUND", 404);
        if (Number(run.fence_token) !== fence) throw new PaidCoordinatorError("PAID_COORDINATOR_STALE_FENCE", 409);
        const version = Number(run.version) + 1;
        await client.query(
          `UPDATE radar_paid_operations
           SET status = 'UNCERTAIN', error_code = $3, version = $4, completed_at = NOW()
           WHERE run_id = $1 AND operation_id = $2`,
          [runId, operationId, String(code || "PAID_DISPATCH_UNCERTAIN").slice(0, 120), version]
        );
        await client.query(
          "UPDATE radar_paid_runs SET status = 'UNCERTAIN', version = $2, updated_at = NOW() WHERE run_id = $1",
          [runId, version]
        );
        return { status:"UNCERTAIN", version, fence_token:fence };
      });
    }
  };
}

export async function getNetlifyPaidCoordinator({ capMicrousd = 500_000 } = {}) {
  if (globalThis.__RADAR_TEST_PAID_COORDINATOR__) return globalThis.__RADAR_TEST_PAID_COORDINATOR__;
  const { getDatabase } = await import("@netlify/database");
  const database = getDatabase();
  return createPostgresPaidCoordinator({ pool:database.pool, capMicrousd });
}
