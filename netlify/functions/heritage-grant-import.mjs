import { authorizeRequest } from "../../src/server/auth.mjs";
import { importHeritageGrantBatch } from "../../src/server/heritage-grant-import-service.mjs";
import { getStateRepository } from "../../src/server/netlify-state.mjs";
import { envValue, workspaceAllowed } from "../../src/server/runtime.mjs";

function json(payload, status = 200) {
  return Response.json(payload, { status, headers:{ "cache-control":"no-store" } });
}

function enabled() {
  return envValue("RADAR_HERITAGE_GRANT_IMPORT_ENABLED").toLowerCase() === "true";
}

export default async function handler(request, context) {
  if (request.method !== "POST") return json({ ok:false, error:{ code:"METHOD_NOT_ALLOWED", message:"Use POST /api/heritage-grant-import." } }, 405);
  const auth = authorizeRequest(request, envValue("RADAR_INTERNAL_ACCESS_SECRET"));
  if (!auth.ok) return json({ ok:false, error:{ code:auth.code, message:"Heritage grant import authorization failed." } }, auth.status);
  if (!enabled()) return json({ ok:false, error:{ code:"HERITAGE_GRANT_IMPORT_LOCKED", message:"Heritage grant import is disabled." } }, 423);
  if (!workspaceAllowed(request)) return json({ ok:false, error:{ code:"PRELIVE_WORKSPACE_DISABLED", message:"Pre-live workspace is disabled." } }, 423);
  const body = await request.json().catch(() => null);
  if (!body) return json({ ok:false, error:{ code:"HERITAGE_GRANT_JSON_INVALID", message:"Request body must be valid JSON." } }, 400);
  try {
    const repository = await getStateRepository(request, context);
    const result = await importHeritageGrantBatch({
      repository,
      records:body.records,
      nowIso:globalThis.__RADAR_TEST_NOW_ISO__ || new Date().toISOString()
    });
    return json({ ok:true, ...result }, result.imported_count ? 202 : 200);
  } catch (error) {
    const code = String(error?.code || error?.message || "HERITAGE_GRANT_IMPORT_FAILED").split(":")[0];
    const safeCode = /^HERITAGE_GRANT_[A-Z0-9_]+$/.test(code) ? code : "HERITAGE_GRANT_IMPORT_FAILED";
    return json({ ok:false, error:{ code:safeCode, message:"Heritage grant import was rejected." } }, Number(error?.status) || 400);
  }
}

export const config = { path:"/api/heritage-grant-import" };
