import { authorizeRequest } from "../../src/server/auth.mjs";
import { getStateRepository } from "../../src/server/netlify-state.mjs";
import { envValue, workspaceAllowed } from "../../src/server/runtime.mjs";
import { verifyAndNormalizeSourceSignal } from "../../src/server/source-signal-ingest.mjs";

function json(payload, status = 200) {
  return Response.json(payload, { status, headers:{ "cache-control":"no-store" } });
}

export default async function handler(request, context) {
  if (request.method !== "POST") return json({ ok:false, error:{ code:"METHOD_NOT_ALLOWED", message:"Use POST /api/source-signal-ingest." } }, 405);
  const auth = authorizeRequest(request, envValue("RADAR_INTERNAL_ACCESS_SECRET"));
  if (!auth.ok) return json({ ok:false, error:{ code:auth.code, message:"Source signal ingest authorization failed." } }, auth.status);
  if (!workspaceAllowed(request)) return json({ ok:false, error:{ code:"PRELIVE_WORKSPACE_DISABLED", message:"Pre-live workspace is disabled." } }, 423);
  const rawBody = await request.text();
  let signal;
  try {
    signal = verifyAndNormalizeSourceSignal({
      rawBody,
      timestamp:request.headers.get("x-radar-source-timestamp"),
      signature:request.headers.get("x-radar-source-signature"),
      secret:envValue("RADAR_SOURCE_INGEST_SECRET"),
      getEnv:envValue
    });
  } catch (error) {
    return json({ ok:false, error:{ code:error?.code || "SOURCE_SIGNAL_REJECTED", message:"Source signal was rejected by the signed-ingest boundary." } }, Number(error?.status) || 400);
  }
  const repository = await getStateRepository(request, context);
  const existing = await repository.getSourceSignal(signal.signal_id);
  if (existing) return json({ ok:true, replayed:true, signal:existing });
  await repository.saveSourceSignal(signal);
  const readback = await repository.getSourceSignal(signal.signal_id);
  if (!readback) return json({ ok:false, error:{ code:"SOURCE_SIGNAL_WRITE_FAILED", message:"Source signal could not be verified after persistence." } }, 500);
  return json({ ok:true, replayed:false, signal:readback }, 202);
}

export const config = { path:"/api/source-signal-ingest" };
