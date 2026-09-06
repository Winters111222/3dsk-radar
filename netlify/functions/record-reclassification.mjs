import { authorizeRequest } from "../../src/server/auth.mjs";
import { getStateRepository } from "../../src/server/netlify-state.mjs";
import { PRODUCTION_RECORD_RECLASSIFICATION } from "../../src/server/record-reclassification.mjs";
import { envValue } from "../../src/server/runtime.mjs";

const json = (payload, status = 200) => Response.json(payload, { status, headers:{ "cache-control":"no-store" } });

export default async function handler(request, context) {
  if (request.method !== "POST") return json({ ok:false, error:{ code:"METHOD_NOT_ALLOWED", message:"Use POST /api/record-reclassification." } }, 405);
  const auth = authorizeRequest(request, envValue("RADAR_INTERNAL_ACCESS_SECRET"));
  if (!auth.ok) return json({ ok:false, error:{ code:auth.code, message:auth.status === 503 ? "Internal access is not configured on the server." : "Invalid internal access code." } }, auth.status);
  if (context?.deploy?.context !== "production") {
    return json({ ok:false, error:{ code:"PRODUCTION_CONTEXT_REQUIRED", message:"The exact record reclassification can only run in production context." } }, 409);
  }
  const body = await request.json().catch(() => ({}));
  const contract = PRODUCTION_RECORD_RECLASSIFICATION;
  if (body.migration_id !== contract.migration_id
    || body.confirmation !== contract.confirmation
    || body.expected_preflight_digest !== contract.expected_preflight_digest) {
    return json({ ok:false, error:{ code:"RECLASSIFICATION_CONFIRMATION_INVALID", message:"The exact migration id, confirmation and preflight digest are required." } }, 400);
  }
  try {
    const repository = await getStateRepository(request, context);
    const result = await repository.runRecordReclassification({ nowIso:new Date().toISOString() });
    return json({ ok:true, ...result });
  } catch (error) {
    const status = Number(error?.status) || 500;
    const code = error?.code || "RECLASSIFICATION_FAILED";
    console.error(`[radar-state] ${code}`);
    return json({ ok:false, error:{ code, message:String(error?.message || "Record reclassification failed.").slice(0, 300) } }, status);
  }
}

export const config = { path:"/api/record-reclassification" };
