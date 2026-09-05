import { envValue } from "../../src/server/runtime.mjs";
import { authorizeRequest } from "../../src/server/auth.mjs";
import { paidCoordinatorReadiness } from "../../src/server/paid-run-coordinator-contract.mjs";
import { getNetlifyPaidCoordinator } from "../../src/server/paid-run-coordinator-netlify-db.mjs";

function json(payload, status = 200) {
  return Response.json(payload, { status, headers:{ "cache-control":"no-store" } });
}

function validTestId(value) {
  return typeof value === "string" && /^[A-Za-z0-9_-]{8,48}$/.test(value);
}

function conflict(result) {
  return result.status === "rejected" && String(result.reason?.code || result.reason?.message || "").startsWith("PAID_COORDINATOR_");
}

export default async function handler(request) {
  if (request.method !== "POST") return json({ ok:false, error:{ code:"METHOD_NOT_ALLOWED", message:"Use POST." } }, 405);
  const auth = authorizeRequest(request, envValue("RADAR_INTERNAL_ACCESS_SECRET"));
  if (!auth.ok) return json({ ok:false, error:{ code:auth.code, message:"Unauthorized." } }, auth.status);
  if (envValue("RADAR_PAID_ACCEPTANCE_ENABLED").toLowerCase() !== "true") {
    return json({ ok:false, error:{ code:"PAID_ACCEPTANCE_LOCKED", message:"Paid acceptance is not armed." } }, 423);
  }
  const body = await request.json().catch(() => ({}));
  if (!validTestId(body.test_id)) return json({ ok:false, error:{ code:"TEST_ID_INVALID", message:"test_id is invalid." } }, 400);

  const capMicrousd = 500_000;
  const coordinator = await getNetlifyPaidCoordinator({ capMicrousd });
  const readiness = paidCoordinatorReadiness(coordinator);
  if (!readiness.ready) return json({ ok:false, error:{ code:"PAID_COORDINATOR_NOT_READY", message:"Coordinator contract is incomplete." } }, 423);

  const runId = `preflight-${body.test_id}`;
  const claims = await Promise.allSettled([
    coordinator.claimOperation(runId, "concurrent-a", 0),
    coordinator.claimOperation(runId, "concurrent-b", 0)
  ]);
  const claimWinners = claims.filter((item) => item.status === "fulfilled" && item.value.replayed === false);
  const claimLosers = claims.filter(conflict);
  if (claimWinners.length !== 1 || claimLosers.length !== 1) throw new Error("COORDINATOR_CONCURRENT_CLAIM_FAILED");

  const claim = claimWinners[0].value;
  const reservations = await Promise.allSettled([
    coordinator.reserveBudget(runId, "reservation-a", 500_000, claim.version),
    coordinator.reserveBudget(runId, "reservation-b", 500_000, claim.version)
  ]);
  const reservationWinners = reservations.filter((item) => item.status === "fulfilled" && item.value.replayed === false);
  const reservationLosers = reservations.filter(conflict);
  if (reservationWinners.length !== 1 || reservationLosers.length !== 1) throw new Error("COORDINATOR_CONCURRENT_RESERVATION_FAILED");

  const reservation = reservationWinners[0].value;
  const settled = await coordinator.settleBudget(runId, reservation.reservation_id, 0, reservation.fence_token);
  const settlementReplay = await coordinator.settleBudget(runId, reservation.reservation_id, 0, reservation.fence_token);
  if (settled.replayed || !settlementReplay.replayed) throw new Error("COORDINATOR_IDEMPOTENT_SETTLEMENT_FAILED");
  await coordinator.completeOperation(runId, claim.operation_id, { preflight:true }, reservation.fence_token);

  return json({
    ok:true,
    coordinator:"NETLIFY_DATABASE",
    contract_version:readiness.contract_version,
    concurrent_claim_winners:1,
    concurrent_budget_winners:1,
    idempotent_settlement:true,
    paid_requests:0,
    openai_requests:0,
    source_requests:0,
    cost_usd:0
  });
}

export const config = { path:"/api/paid-coordinator-acceptance" };
