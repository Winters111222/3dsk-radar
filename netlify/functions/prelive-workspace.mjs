import { envValue } from "../../src/server/runtime.mjs";
import { readFile } from "node:fs/promises";
import { authorizeRequest } from "../../src/server/auth.mjs";
import { acceptanceEnabled, getStateRepository } from "../../src/server/netlify-state.mjs";
const json=(body,status=200)=>Response.json(body,{status,headers:{"cache-control":"no-store"}});
export default async function handler(request, context){
  if(request.method!=="POST")return json({ok:false,error:{code:"METHOD_NOT_ALLOWED"}},405);
  const auth=authorizeRequest(request,envValue("RADAR_INTERNAL_ACCESS_SECRET"));
  if(!auth.ok)return json({ok:false,error:{code:auth.code}},auth.status);
  if(!acceptanceEnabled() || request.headers.get("x-radar-workspace")!=="acceptance")return json({ok:false,error:{code:"PRELIVE_WORKSPACE_DISABLED"}},423);
  try{
    const repo=await getStateRepository(request, context);
    const before=await repo.snapshot();
    if(!before.opportunities.length){
      const fixtures=JSON.parse(await readFile(new URL("../../fixtures/opportunities.json",import.meta.url),"utf8"));
      const now=new Date().toISOString();
      await repo.mergeSearchResults(fixtures,now);
      await repo.saveSearchRun({mode:"ZERO_COST_ACCEPTANCE",completed_at:now,estimated_cost_usd:0,model:"FIXTURE",web_search_call_count:0,usage:{total_tokens:0}});
    }
    return json({ok:true,workspace:"ISOLATED_ACCEPTANCE",cost_usd:0,...await repo.snapshot()});
  }catch{ return json({ok:false,error:{code:"PRELIVE_STORAGE_FAILED",message:"Could not initialize isolated shared test data."}},500); }
}
export const config={path:"/api/prelive-workspace"};
