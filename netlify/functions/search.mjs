import { authorizeRequest } from "../../src/server/auth.mjs";
import { loadPublicCompanyProfile } from "../../src/server/profile.mjs";
import { runOpportunitySearch } from "../../src/server/openai-search.mjs";

let searchInFlight = false;
let lastSearchStartedAt = 0;

function json(payload, status = 200, extraHeaders = {}) {
  return Response.json(payload, {
    status,
    headers: {
      "cache-control": "no-store",
      ...extraHeaders
    }
  });
}

function boundedInt(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
}

function cooldownMs() {
  return boundedInt(process.env.RADAR_SEARCH_COOLDOWN_SECONDS, 30, 0, 600) * 1000;
}

export default async function handler(request) {
  if (request.method !== "POST") return json({ ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use POST /api/search." } }, 405, { allow: "POST" });

  const auth = authorizeRequest(request, process.env.RADAR_INTERNAL_ACCESS_SECRET);
  if (!auth.ok) {
    const message = auth.status === 503 ? "Internal access is not configured on the server." : "Invalid internal access code.";
    return json({ ok: false, error: { code: auth.code, message } }, auth.status);
  }

  if (!process.env.OPENAI_API_KEY) return json({ ok: false, error: { code: "OPENAI_NOT_CONFIGURED", message: "OPENAI_API_KEY is not configured on the server." } }, 503);

  const now = Date.now();
  const remaining = Math.max(0, cooldownMs() - (now - lastSearchStartedAt));
  if (searchInFlight || remaining > 0) {
    return json({
      ok: false,
      error: {
        code: "SEARCH_RATE_LIMITED",
        message: searchInFlight ? "A search is already running." : "Search cooldown is active.",
        retry_after_seconds: searchInFlight ? 15 : Math.ceil(remaining / 1000)
      }
    }, 429);
  }

  searchInFlight = true;
  lastSearchStartedAt = now;

  try {
    const profile = await loadPublicCompanyProfile();
    const nowIso = new Date().toISOString();
    const maxResults = boundedInt(process.env.RADAR_SEARCH_MAX_RESULTS, 12, 1, 20);
    const model = process.env.OPENAI_SEARCH_MODEL || "gpt-5.6-luna";

    const result = await runOpportunitySearch({
      apiKey: process.env.OPENAI_API_KEY,
      model,
      profile,
      nowIso,
      maxResults,
      allowStructuredRetry: true
    });

    return json({
      ok: true,
      opportunities: result.opportunities,
      run: {
        mode: "LIVE_SEARCH",
        completed_at: nowIso,
        model: result.model,
        response_id: result.response_id,
        attempts: result.attempts,
        verified_source_count: result.verified_source_count,
        rejected_candidate_count: result.rejections.length,
        returned_count: result.opportunities.length,
        usage: result.usage,
        persistence: "STAGE_3_PENDING"
      }
    });
  } catch (error) {
    const timeout = error?.name === "TimeoutError" || error?.name === "AbortError";
    const code = timeout ? "SEARCH_TIMEOUT" : error?.code || "SEARCH_FAILED";
    const status = timeout ? 504 : Number.isInteger(error?.status) && error.status >= 400 && error.status < 600 ? error.status : 502;
    console.error("[radar-search]", code);
    return json({
      ok: false,
      error: {
        code,
        message: timeout ? "Search exceeded the synchronous function time budget." : String(error?.message || "Search failed").slice(0, 500)
      }
    }, status);
  } finally {
    searchInFlight = false;
  }
}

export const config = { path: "/api/search" };
