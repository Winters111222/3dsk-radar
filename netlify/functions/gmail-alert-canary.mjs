import { authorizeRequest } from "../../src/server/auth.mjs";
import { GMAIL_ALERT_CANARY_CONFIRMATION, gmailAlertImportReadiness, importGmailAlertSignals } from "../../src/server/gmail-alert-import.mjs";
import { getStateRepository } from "../../src/server/netlify-state.mjs";
import { envValue, workspaceAllowed } from "../../src/server/runtime.mjs";

const json = (payload, status = 200) => Response.json(payload, { status, headers:{ "cache-control":"no-store" } });

export default async function handler(request, context) {
  if (request.method !== "POST") return json({ ok:false, error:{ code:"METHOD_NOT_ALLOWED", message:"Use POST /api/gmail-alert-canary." } }, 405);
  const auth = authorizeRequest(request, envValue("RADAR_INTERNAL_ACCESS_SECRET"));
  if (!auth.ok) return json({ ok:false, error:{ code:auth.code, message:"Gmail alert canary authorization failed." } }, auth.status);
  if (!workspaceAllowed(request)) return json({ ok:false, error:{ code:"PRELIVE_WORKSPACE_DISABLED", message:"Pre-live workspace is disabled." } }, 423);
  if (request.headers.get("x-radar-gmail-alert-confirmation") !== GMAIL_ALERT_CANARY_CONFIRMATION) {
    return json({ ok:false, error:{ code:"GMAIL_ALERT_CANARY_CONFIRMATION_REQUIRED", message:"Exact Gmail alert canary confirmation is required." } }, 400);
  }
  const readiness = gmailAlertImportReadiness({ context, getEnv:envValue });
  if (readiness.status !== "READY") {
    const status = readiness.status === "CONTEXT_BLOCKED" || readiness.status === "LOCKED" ? 423 : 503;
    return json({ ok:false, result:{ ...readiness, requests:0 } }, status);
  }
  const result = await importGmailAlertSignals({
    context,
    getEnv:envValue,
    repository:await getStateRepository(request, context)
  });
  return json({ ok:true, result });
}

export const config = { path:"/api/gmail-alert-canary" };
