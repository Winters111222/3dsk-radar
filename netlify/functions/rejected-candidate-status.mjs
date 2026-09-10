import { authorizeRequest } from "../../src/server/auth.mjs";
import { envValue } from "../../src/server/runtime.mjs";
import { REJECTED_REVIEW_STATUSES } from "../../src/server/state-repository.mjs";
import { getStateRepository } from "../../src/server/netlify-state.mjs";

const json=(payload,status=200)=>Response.json(payload,{status,headers:{"cache-control":"no-store"}});

export default async function handler(request,context) {
  if (request.method!=="POST") return json({ok:false,error:{code:"METHOD_NOT_ALLOWED",message:"Use POST /api/rejected-candidate-status."}},405);
  const auth=authorizeRequest(request,envValue("RADAR_INTERNAL_ACCESS_SECRET"));
  if (!auth.ok) return json({ok:false,error:{code:auth.code,message:"Invalid internal access code."}},auth.status);
  const body=await request.json().catch(()=>({}));
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(String(body.candidate_id||""))) return json({ok:false,error:{code:"REJECTED_CANDIDATE_ID_INVALID",message:"candidate_id is invalid."}},400);
  if (!REJECTED_REVIEW_STATUSES.includes(body.review_status)) return json({ok:false,error:{code:"REJECTED_REVIEW_STATUS_INVALID",message:"Choose PENDING, KEEP or DISMISSED."}},400);
  try {
    const repository=await getStateRepository(request,context);
    const candidate=await repository.setRejectedCandidateReviewStatus(body.candidate_id,body.review_status,new Date().toISOString());
    if (!candidate) return json({ok:false,error:{code:"REJECTED_CANDIDATE_NOT_FOUND",message:"Rejected candidate was not found."}},404);
    return json({ok:true,candidate});
  } catch (error) {
    console.error("[radar-state] REJECTED_CANDIDATE_STATUS_WRITE_FAILED");
    return json({ok:false,error:{code:"REJECTED_CANDIDATE_STATUS_WRITE_FAILED",message:String(error?.message||"Could not save review status.").slice(0,300)}},500);
  }
}

export const config={path:"/api/rejected-candidate-status"};
