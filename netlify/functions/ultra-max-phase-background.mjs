import { authorizeRequest } from "../../src/server/auth.mjs";
import { getStateRepository } from "../../src/server/netlify-state.mjs";
import { envValue } from "../../src/server/runtime.mjs";
import {
  executePreparedUltraMaxPaidPhase,
  prepareUltraMaxPaidPhase
} from "./_shared/ultra-max-paid-phase.mjs";

function json(payload,status=200) {
  return Response.json(payload,{status,headers:{"cache-control":"no-store"}});
}

function safeError(error) {
  const code=String(error?.code||error?.message||"ULTRA_MAX_PAID_REQUEST_FAILED").split(":")[0];
  return {code:/^(?:ULTRA_MAX|ULTRA_PAID|PAID_COORDINATOR|OPENAI|STATE)_[A-Z0-9_]+$/.test(code)?code:"ULTRA_MAX_PAID_REQUEST_FAILED",status:Number(error?.status)||500};
}

export async function runUltraMaxPhaseBackground(request,context) {
  if (request.method!=="POST") return json({ok:false,error:{code:"METHOD_NOT_ALLOWED"}},405);
  const auth=authorizeRequest(request,envValue("RADAR_INTERNAL_ACCESS_SECRET"));
  if (!auth.ok) return json({ok:false,error:{code:auth.code}},auth.status);
  const body=await request.json().catch(()=>null);
  if (!body) return json({ok:false,error:{code:"ULTRA_MAX_JSON_INVALID"}},400);
  try {
    const repository=await getStateRepository(request,context);
    const prepared=await prepareUltraMaxPaidPhase({body,context,repository});
    const nowIso=globalThis.__RADAR_TEST_NOW_ISO__||new Date().toISOString();
    const result=await executePreparedUltraMaxPaidPhase({prepared,body,repository,nowIso});
    return json({ok:true,replayed:result.replayed,run:result.run,result:result.result});
  } catch (error) {
    const safe=safeError(error);
    console.error("[radar-ultra-paid]",safe.code);
    return json({ok:false,error:{code:safe.code,message:"ULTRA MAX paid phase failed safely."}},safe.status);
  }
}

export default async function handler(request,context) {
  const response=await runUltraMaxPhaseBackground(request,context);
  if (!response.ok) console.error("[radar-ultra-paid-background]",(await response.clone().json().catch(()=>null))?.error?.code||`HTTP_${response.status}`);
}

export const config={path:"/api/ultra-max-phase-background"};
