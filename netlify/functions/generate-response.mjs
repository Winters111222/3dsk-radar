import { envValue, workspaceAllowed } from "../../src/server/runtime.mjs";
import { authorizeRequest } from "../../src/server/auth.mjs";
import { loadPublicCompanyProfile } from "../../src/server/profile.mjs";
import { runReplyGeneration } from "../../src/server/openai-reply.mjs";
import { getStateRepository } from "../../src/server/netlify-state.mjs";

const json=(payload,status=200)=>Response.json(payload,{status,headers:{"cache-control":"no-store"}});

const liveAIEnabled=()=>envValue("RADAR_LIVE_AI_ENABLED").toLowerCase()==="true";

export default async function handler(request, context){
  if(request.method!=="POST")return json({ok:false,error:{code:"METHOD_NOT_ALLOWED",message:"Use POST /api/generate-response."}},405);
  const auth=authorizeRequest(request,envValue("RADAR_INTERNAL_ACCESS_SECRET"));
  if(!auth.ok)return json({ok:false,error:{code:auth.code,message:auth.status===503?"Internal access is not configured on the server.":"Invalid internal access code."}},auth.status);
  if(!liveAIEnabled())return json({ok:false,error:{code:"LIVE_AI_LOCKED",message:"Live AI is intentionally locked until final acceptance."}},423);
  if(!workspaceAllowed(request))return json({ok:false,error:{code:"PRELIVE_WORKSPACE_DISABLED",message:"Pre-live workspace is disabled."}},423);const apiKey=envValue("OPENAI_API_KEY");if(!apiKey)return json({ok:false,error:{code:"OPENAI_NOT_CONFIGURED",message:"OPENAI_API_KEY is not configured on the server."}},503);
  const body=await request.json().catch(()=>({}));if(!body.opportunity_id)return json({ok:false,error:{code:"OPPORTUNITY_REQUIRED",message:"opportunity_id is required."}},400);
  try{
    const repo=await getStateRepository(request, context);const opportunity=await repo.getOpportunity(body.opportunity_id);if(!opportunity)return json({ok:false,error:{code:"OPPORTUNITY_NOT_FOUND",message:"Opportunity was not found in shared history."}},404);
    const profile=await loadPublicCompanyProfile();const model=envValue("OPENAI_REPLY_MODEL")||"gpt-5.6-sol";
    const runner=globalThis.__RADAR_TEST_REPLY_RUNNER__||runReplyGeneration;
    const generated=await runner({apiKey,model,profile,opportunity,allowStructuredRetry:true});
    const nowIso=new Date().toISOString();const reply={to:opportunity.contact_email||null,subject:generated.subject,body:generated.body,model:generated.model,response_id:generated.response_id};
    const saved=await repo.saveReply(opportunity.id,reply,nowIso);
    return json({ok:true,reply:{to:saved.reply_to,subject:saved.reply_subject,body:saved.reply_body,generated_at:saved.reply_generated_at},opportunity:saved,run:{model:generated.model,response_id:generated.response_id,attempts:generated.attempts,usage:generated.usage}});
  }catch(error){const timeout=error?.name==="TimeoutError"||error?.name==="AbortError";const code=timeout?"REPLY_TIMEOUT":error?.code||"REPLY_FAILED";const status=timeout?504:Number.isInteger(error?.status)&&error.status>=400&&error.status<600?error.status:502;console.error("[radar-reply]",code);return json({ok:false,error:{code,message:timeout?"Response generation exceeded the function time budget.":String(error?.message||"Response generation failed").slice(0,500)}},status);}
}
export const config={path:"/api/generate-response"};
