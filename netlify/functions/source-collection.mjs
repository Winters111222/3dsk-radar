import { authorizeRequest } from "../../src/server/auth.mjs";
import { boundedCollectorInteger, CollectorError } from "../../src/server/collectors/collector-contract.mjs";
import { collectorRegistry } from "../../src/server/collectors/registry.mjs";
import { collectTedNotices, TED_QUERY_PACKS, TED_SOURCE_ID } from "../../src/server/collectors/ted.mjs";
import { envValue, sourceCollectionEnabled } from "../../src/server/runtime.mjs";

function json(payload, status = 200, extraHeaders = {}) {
  return Response.json(payload, { status, headers:{ "cache-control":"no-store", ...extraHeaders } });
}

function runtimeState() {
  const key = "__3DSK_RADAR_SOURCE_COLLECTION_STATE__";
  if (!globalThis[key]) globalThis[key] = { inFlight:false, lastStartedAt:0 };
  return globalThis[key];
}

function cooldownMs() {
  return boundedCollectorInteger(envValue("RADAR_SOURCE_COLLECTION_COOLDOWN_SECONDS"), 10, 0, 600) * 1000;
}

function maxResults() {
  return boundedCollectorInteger(envValue("RADAR_SOURCE_COLLECTION_MAX_RESULTS"), 25, 1, 50);
}

export default async function handler(request) {
  if (!["GET", "POST"].includes(request.method)) {
    return json({ ok:false, error:{ code:"METHOD_NOT_ALLOWED", message:"Use GET or POST /api/source-collection." } }, 405, { allow:"GET, POST" });
  }
  const auth = authorizeRequest(request, envValue("RADAR_INTERNAL_ACCESS_SECRET"));
  if (!auth.ok) {
    return json({ ok:false, error:{ code:auth.code, message:auth.status === 503 ? "Internal access is not configured on the server." : "Invalid internal access code." } }, auth.status);
  }

  const enabled = sourceCollectionEnabled();
  if (request.method === "GET") {
    return json({ ok:true, collection_enabled:enabled, openai_requests:0, estimated_cost_usd:0, collectors:collectorRegistry({ collectionEnabled:enabled }) });
  }
  if (!enabled) {
    return json({ ok:false, error:{ code:"SOURCE_COLLECTION_LOCKED", message:"Read-only source collection is intentionally locked until its zero-cost canary is approved." } }, 423);
  }

  const body = await request.json().catch(() => ({}));
  if (body.source_id !== TED_SOURCE_ID) {
    return json({ ok:false, error:{ code:"COLLECTOR_NOT_AVAILABLE", message:"Only the TED public API collector is implemented in this checkpoint." } }, 400);
  }
  if (!Object.hasOwn(TED_QUERY_PACKS, body.query_pack_id)) {
    return json({ ok:false, error:{ code:"TED_QUERY_PACK_UNKNOWN", message:"Choose one of the approved TED query packs." } }, 400);
  }

  const state = runtimeState();
  const now = Date.now();
  const remaining = Math.max(0, cooldownMs() - (now - state.lastStartedAt));
  if (state.inFlight || remaining > 0) {
    return json({ ok:false, error:{ code:"SOURCE_COLLECTION_RATE_LIMITED", message:state.inFlight ? "A source collection is already running." : "Source collection cooldown is active.", retry_after_seconds:state.inFlight ? 10 : Math.ceil(remaining / 1000) } }, 429);
  }
  state.inFlight = true;
  state.lastStartedAt = now;

  try {
    const nowIso = new Date().toISOString();
    const result = await collectTedNotices({
      queryPackId: body.query_pack_id,
      nowIso,
      page: boundedCollectorInteger(body.page, 1, 1, 20),
      limit: boundedCollectorInteger(body.limit, maxResults(), 1, maxResults()),
      fetchImpl: globalThis.__RADAR_TEST_TED_FETCH__ || fetch
    });
    return json({
      ok:true,
      records:result.records,
      run:{
        mode:"READ_ONLY_SOURCE_COLLECTION",
        completed_at:nowIso,
        source_id:result.source_id,
        query_pack_id:result.query_pack_id,
        upstream_total:result.upstream_total,
        returned_count:result.records.length,
        persistence:"NONE",
        estimated_cost_usd:0,
        counters:result.counters
      }
    });
  } catch (error) {
    const known = error instanceof CollectorError;
    const code = known ? error.code : "SOURCE_COLLECTION_FAILED";
    const status = known ? error.status : 502;
    console.error("[radar-collector]", code);
    return json({ ok:false, error:{ code, message:String(error?.message || "Source collection failed.").slice(0, 500) } }, status);
  } finally {
    state.inFlight = false;
  }
}

export const config = { path:"/api/source-collection" };
