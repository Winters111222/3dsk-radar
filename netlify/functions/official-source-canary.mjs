import { authorizeRequest } from "../../src/server/auth.mjs";
import { envValue } from "../../src/server/runtime.mjs";
import { OFFICIAL_SOURCE_CANARY_CONFIRMATION, officialSourceCanaryConfiguration } from "../../src/server/official-source-canary-policy.mjs";
import { runOfficialWideDiscovery, summarizeOfficialWideDiscovery } from "../../src/server/official-source-run.mjs";

function json(payload, status = 200) {
  return Response.json(payload, { status, headers:{ "cache-control":"no-store" } });
}

export default async function handler(request, context) {
  if (request.method !== "POST") return json({ ok:false, error:{ code:"METHOD_NOT_ALLOWED", message:"Use POST /api/official-source-canary." } }, 405);
  const auth = authorizeRequest(request, envValue("RADAR_INTERNAL_ACCESS_SECRET"));
  if (!auth.ok) return json({ ok:false, error:{ code:auth.code, message:"Official source canary authorization failed." } }, auth.status);
  if (request.headers.get("x-radar-official-source-confirmation") !== OFFICIAL_SOURCE_CANARY_CONFIRMATION) {
    return json({ ok:false, error:{ code:"OFFICIAL_SOURCE_CANARY_CONFIRMATION_REQUIRED", message:"Exact source canary confirmation is required." } }, 409);
  }
  const configuration = officialSourceCanaryConfiguration({ context, getEnv:envValue });
  if (!configuration.ok) return json({ ok:false, error:{ code:configuration.code, message:"Official source canary is not ready.", blocked_sources:configuration.blocked_sources || [] } }, 423);
  let result;
  try {
    result = await runOfficialWideDiscovery({
      getEnv:envValue,
      fetchImpl:globalThis.__RADAR_TEST_OFFICIAL_SOURCE_FETCH__ || fetch,
      limitPerSource:configuration.max_results_per_source,
      sourceIds:configuration.source_ids
    });
    if (result.requests > configuration.request_limit) throw Object.assign(new Error("OFFICIAL_SOURCE_CANARY_REQUEST_BOUNDARY_EXCEEDED"), { code:"OFFICIAL_SOURCE_CANARY_REQUEST_BOUNDARY_EXCEEDED" });
  } catch (error) {
    console.error("[official-source-canary]", String(error?.code || "OFFICIAL_SOURCE_CANARY_FAILED").slice(0, 100));
    return json({ ok:false, error:{ code:String(error?.code || "OFFICIAL_SOURCE_CANARY_FAILED").slice(0, 100), message:"Official source canary failed without retry." }, counters:{ source_requests:0, openai_requests:0, hosted_search_calls:0, writes:0, retries:0, cost_usd:0 } }, 502);
  }
  return json({
    ok:true,
    profile:configuration.profile,
    source_ids:configuration.source_ids,
    request_limit:configuration.request_limit,
    summary:summarizeOfficialWideDiscovery(result),
    discovery_hints:result.hints.slice(0, configuration.request_limit * configuration.max_results_per_source).map((item) => ({
      source_id:item.source_id,
      source_url:item.source_url,
      title:item.title,
      published_at:item.published_at,
      discovery_only:true,
      outreach_locked:true,
      requires_original_verification:true
    })),
    counters:{ source_requests:result.requests, openai_requests:0, hosted_search_calls:0, writes:0, retries:0, cost_usd:0 }
  });
}

export const config = { path:"/api/official-source-canary" };
