import { authorizeRequest } from "../../src/server/auth.mjs";
import { envValue } from "../../src/server/runtime.mjs";
import { getNetlifyPaidCoordinator } from "../../src/server/paid-run-coordinator-netlify-db.mjs";
import {
  productionSearchConfiguration,
  productionSearchContextAllowed,
  productionSearchEnabled
} from "../../src/server/production-search-policy.mjs";

const BACKGROUND_STALE_AFTER_MS = 16 * 60 * 1000;

function json(payload, status = 200, extraHeaders = {}) {
  return Response.json(payload, { status, headers:{ "cache-control":"no-store", ...extraHeaders } });
}

export default async function handler(request, context) {
  if (request.method !== "GET") return json({ ok:false, error:{ code:"METHOD_NOT_ALLOWED", message:"Use GET /api/search-status." } }, 405, { allow:"GET" });
  const auth = authorizeRequest(request, envValue("RADAR_INTERNAL_ACCESS_SECRET"));
  if (!auth.ok) return json({ ok:false, error:{ code:auth.code, message:auth.status === 503 ? "Internal access is not configured on the server." : "Invalid internal access code." } }, auth.status);
  if (!productionSearchEnabled()) return json({ ok:false, error:{ code:"PRODUCTION_SEARCH_LOCKED", message:"Production search is not enabled." } }, 423);
  if (!productionSearchContextAllowed(context)) return json({ ok:false, error:{ code:"PRODUCTION_SEARCH_PRODUCTION_REQUIRED", message:"Production search status is available only in the Netlify production context." } }, 423);
  const execution = productionSearchConfiguration();
  if (!execution.ok) return json({ ok:false, error:{ code:"PRODUCTION_SEARCH_CONFIG_INVALID", message:"Production search cost or result limits are missing or unsafe." } }, 503);

  let coordinator;
  try {
    coordinator = await getNetlifyPaidCoordinator({ capMicrousd:execution.cap_microusd });
  } catch {
    return json({ ok:false, error:{ code:"PAID_COORDINATOR_UNAVAILABLE", message:"Paid execution coordinator is unavailable." } }, 503);
  }
  if (typeof coordinator.readOperation !== "function") {
    return json({ ok:false, error:{ code:"PAID_COORDINATOR_STATUS_UNAVAILABLE", message:"Paid operation status is unavailable." } }, 503);
  }

  const operation = await coordinator.readOperation(execution.run_id, execution.operation_id);
  const common = {
    ok:true,
    search_profile:execution.search_profile,
    window_utc:execution.window_utc,
    run_id:execution.run_id,
    operation_id:execution.operation_id,
    retry_allowed:false
  };
  if (!operation) return json({ ...common, status:"NOT_STARTED", poll_after_seconds:2 });
  if (operation.operation_status === "COMPLETED") {
    return json({ ...common, status:"COMPLETED", completed_at:operation.completed_at, settled_usd:operation.settled_microusd / 1_000_000 });
  }
  if (operation.operation_status === "UNCERTAIN" || operation.run_status === "UNCERTAIN") {
    return json({ ...common, status:"UNCERTAIN", error_code:operation.error_code || "PAID_DISPATCH_UNCERTAIN" });
  }
  const updatedAt = Date.parse(operation.updated_at || "");
  const stale = Number.isFinite(updatedAt) && Date.now() - updatedAt > BACKGROUND_STALE_AFTER_MS;
  return json({
    ...common,
    status:stale ? "UNCERTAIN" : "RUNNING",
    coordinator_status:operation.run_status,
    started_at:operation.updated_at,
    error_code:stale ? "BACKGROUND_EXECUTION_STALE" : null,
    poll_after_seconds:stale ? null : 2
  });
}

export const config = { path:"/api/search-status" };
