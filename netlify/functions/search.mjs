import { envValue, paidAcceptanceContextAllowed, workspaceAllowed } from "../../src/server/runtime.mjs";
import { authorizeRequest } from "../../src/server/auth.mjs";
import { loadPublicCompanyProfile } from "../../src/server/profile.mjs";
import { runOpportunitySearch } from "../../src/server/openai-search.mjs";
import { estimateSearchCost } from "../../src/server/search-cost.mjs";
import { getStateRepository } from "../../src/server/netlify-state.mjs";
import { paidCoordinatorReadiness } from "../../src/server/paid-run-coordinator-contract.mjs";
import { getNetlifyPaidCoordinator } from "../../src/server/paid-run-coordinator-netlify-db.mjs";

function json(payload, status = 200, extraHeaders = {}) {
  return Response.json(payload, { status, headers:{ "cache-control":"no-store", ...extraHeaders } });
}
function boundedInt(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
}
function liveAIEnabled() { return envValue("RADAR_LIVE_AI_ENABLED").toLowerCase() === "true"; }
function paidAcceptanceEnabled() { return envValue("RADAR_PAID_ACCEPTANCE_ENABLED").toLowerCase() === "true"; }
function configuredCapMicrousd() {
  const usd = Number(envValue("RADAR_PAID_ACCEPTANCE_MAX_USD") || "0.50");
  return Number.isFinite(usd) && usd > 0 && usd <= 0.50 ? Math.round(usd * 1_000_000) : null;
}

function paidError(error) {
  const known = String(error?.code || error?.message || "");
  if (known.startsWith("PAID_COORDINATOR_")) {
    return { code:known, status:Number(error?.status) || 409, message:"Paid execution coordinator rejected the operation safely." };
  }
  return null;
}

export default async function handler(request, context) {
  if (request.method !== "POST") return json({ ok:false, error:{ code:"METHOD_NOT_ALLOWED", message:"Use POST /api/search." } }, 405, { allow:"POST" });
  const auth = authorizeRequest(request, envValue("RADAR_INTERNAL_ACCESS_SECRET"));
  if (!auth.ok) return json({ ok:false, error:{ code:auth.code, message:auth.status === 503 ? "Internal access is not configured on the server." : "Invalid internal access code." } }, auth.status);
  const paidAcceptance = paidAcceptanceEnabled();
  const globalLiveAI = liveAIEnabled();
  if (!globalLiveAI && !paidAcceptance) return json({ ok:false, error:{ code:"LIVE_AI_LOCKED", message:"Live AI is intentionally locked until final acceptance." } }, 423);
  if (!workspaceAllowed(request)) return json({ ok:false, error:{ code:"PRELIVE_WORKSPACE_DISABLED", message:"Pre-live workspace is disabled." } }, 423);
  if (!paidAcceptance) return json({ ok:false, error:{ code:"PAID_ACCEPTANCE_LOCKED", message:"Paid acceptance is not armed." } }, 423);
  if (globalLiveAI) return json({ ok:false, error:{ code:"PAID_ACCEPTANCE_REQUIRES_GLOBAL_AI_LOCK", message:"The isolated paid acceptance requires global live AI to remain locked." } }, 423);
  if (!paidAcceptanceContextAllowed(context)) return json({ ok:false, error:{ code:"PAID_ACCEPTANCE_PREVIEW_REQUIRED", message:"Paid acceptance is allowed only on a Netlify Deploy Preview." } }, 423);
  const apiKey = envValue("OPENAI_API_KEY");
  if (!apiKey) return json({ ok:false, error:{ code:"OPENAI_NOT_CONFIGURED", message:"OPENAI_API_KEY is not configured on the server." } }, 503);

  const body = await request.json().catch(() => ({}));
  const authorizedRunId = envValue("RADAR_PAID_ACCEPTANCE_RUN_ID");
  const capMicrousd = configuredCapMicrousd();
  const requestedMicrousd = Math.round(Number(body.max_cost_usd) * 1_000_000);
  if (!authorizedRunId || !capMicrousd) {
    return json({ ok:false, error:{ code:"PAID_ACCEPTANCE_CONFIG_INVALID", message:"Paid acceptance configuration is incomplete." } }, 503);
  }
  if (body.run_id !== authorizedRunId || body.operation_id !== "focused-search") {
    return json({ ok:false, error:{ code:"PAID_ACCEPTANCE_IDENTITY_MISMATCH", message:"Paid acceptance identity does not match the armed run." } }, 403);
  }
  if (body.no_retry !== true || requestedMicrousd !== capMicrousd) {
    return json({ ok:false, error:{ code:"PAID_ACCEPTANCE_BOUNDARY_INVALID", message:"Paid acceptance must use the exact no-retry budget boundary." } }, 400);
  }

  let coordinator;
  try {
    coordinator = await getNetlifyPaidCoordinator({ capMicrousd });
  } catch (error) {
    console.error("[radar-search] PAID_COORDINATOR_UNAVAILABLE");
    return json({ ok:false, error:{ code:"PAID_COORDINATOR_UNAVAILABLE", message:"Paid execution coordinator is unavailable." } }, 503);
  }
  const readiness = paidCoordinatorReadiness(coordinator);
  if (!readiness.ready || typeof coordinator.completeOperation !== "function" || typeof coordinator.markUncertain !== "function") {
    return json({ ok:false, error:{ code:"PAID_COORDINATOR_NOT_READY", message:"Paid execution remains locked until the atomic coordinator is ready." } }, 423);
  }

  const operationId = body.operation_id;
  const reservationId = "focused-budget";
  let claim;
  try {
    claim = await coordinator.claimOperation(authorizedRunId, operationId, 0);
    if (claim.replayed) {
      if (claim.status === "COMPLETED" && claim.result) return json({ ...claim.result, replayed:true });
      return json({ ok:false, error:{ code:`PAID_OPERATION_${claim.status}`, message:"This paid operation cannot dispatch again." } }, 409);
    }
  } catch (error) {
    const safe = paidError(error);
    if (safe) return json({ ok:false, error:{ code:safe.code, message:safe.message } }, safe.status);
    throw error;
  }

  let reservation;
  try {
    reservation = await coordinator.reserveBudget(authorizedRunId, reservationId, capMicrousd, claim.version);
  } catch (error) {
    const safe = paidError(error);
    if (safe) return json({ ok:false, error:{ code:safe.code, message:safe.message } }, safe.status);
    throw error;
  }

  let dispatched = false;
  try {
    const profile = await loadPublicCompanyProfile();
    const nowIso = new Date().toISOString();
    const maxResults = boundedInt(envValue("RADAR_PAID_ACCEPTANCE_MAX_RESULTS"), 6, 1, 6);
    const model = "gpt-5.6-luna";
    dispatched = true;
    const result = await runOpportunitySearch({
      apiKey,
      model,
      profile,
      nowIso,
      maxResults,
      allowStructuredRetry:false,
      maxToolCalls:3,
      maxOutputTokens:8000
    });
    if (result.attempts !== 1 || result.web_search_call_count > 3) throw new Error("PAID_ACCEPTANCE_REQUEST_BOUNDARY_EXCEEDED");
    const estimatedCost = estimateSearchCost({ model:result.model, usage:result.usage, webSearchCalls:result.web_search_call_count });
    if (!estimatedCost || Math.ceil(estimatedCost.total_usd * 1_000_000) > capMicrousd) throw new Error("PAID_ACCEPTANCE_COST_CAP_EXCEEDED");
    const settlement = await coordinator.settleBudget(
      authorizedRunId,
      reservationId,
      Math.ceil(estimatedCost.total_usd * 1_000_000),
      reservation.fence_token
    );
    const repo = await getStateRepository(request, context);
    const merge = await repo.mergeSearchResultsWithStats(result.opportunities, nowIso);
    const opportunities = merge.opportunities;
    const counters = {
      collector_mode:result.discovery_mode,
      source_services_planned:null,
      source_services_completed:null,
      source_services_blocked:null,
      source_services_failed:null,
      source_urls_verified:result.verified_source_count,
      list_pages_fetched:null,
      detail_pages_fetched:null,
      ...result.counters,
      source_requests:0,
      direct_source_requests:result.direct_source_requests,
      openai_requests:1,
      retries:0,
      new_opportunities:merge.new_count,
      updated_opportunities:merge.updated_count,
      workspace_total:merge.workspace_total
    };
    const run = {
      mode:result.discovery_mode,
      diagnostics:result.diagnostics,
      completed_at:nowIso,
      model:result.model,
      response_id:result.response_id,
      attempts:result.attempts,
      verified_source_count:result.verified_source_count,
      allowed_domains:result.allowed_domains,
      direct_source_requests:result.direct_source_requests,
      rejected_candidate_count:result.rejections.length,
      returned_count:opportunities.length,
      counters,
      usage:result.usage,
      web_search_call_count:result.web_search_call_count,
      estimated_cost_usd:estimatedCost?.total_usd ?? null,
      cost_breakdown:estimatedCost,
      persistence:"NETLIFY_BLOBS",
      paid_acceptance:{
        run_id:authorizedRunId,
        operation_id:operationId,
        reservation_id:reservationId,
        cap_usd:capMicrousd / 1_000_000,
        settled_usd:settlement.actual_microusd / 1_000_000,
        fence_token:reservation.fence_token,
        coordinator:"NETLIFY_DATABASE",
        openai_requests:1,
        source_requests:0,
        retries:0
      }
    };
    await repo.saveSearchRun(run);
    const payload = { ok:true, opportunities, run, replayed:false };
    await coordinator.completeOperation(authorizedRunId, operationId, payload, reservation.fence_token);
    return json(payload);
  } catch (error) {
    if (dispatched) {
      await coordinator.markUncertain(
        authorizedRunId,
        operationId,
        error?.code || error?.message || "PAID_DISPATCH_UNCERTAIN",
        reservation.fence_token
      ).catch(() => console.error("[radar-search] PAID_COORDINATOR_UNCERTAIN_WRITE_FAILED"));
    }
    const timeout = error?.name === "TimeoutError" || error?.name === "AbortError";
    const code = timeout ? "SEARCH_TIMEOUT" : error?.code || "SEARCH_FAILED";
    const status = timeout ? 504 : Number.isInteger(error?.status) && error.status >= 400 && error.status < 600 ? error.status : 502;
    console.error("[radar-search]", code);
    return json({ ok:false, error:{ code, message:timeout ? "Search exceeded the synchronous function time budget." : String(error?.message || "Search failed").slice(0, 500) } }, status);
  }
}
export const config={path:"/api/search"};
