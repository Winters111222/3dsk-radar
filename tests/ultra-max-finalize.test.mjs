import test from "node:test";
import assert from "node:assert/strict";
import { persistUltraMaxVerifiedResults } from "../src/server/ultra-max-finalize.mjs";
import { ULTRA_DETAIL_OBSERVED_PHASE_IDS } from "../src/server/ultra-detail-verification-plan.mjs";

test("ULTRA finalization retains a partial outcome and final zero rather than discovery counts", async()=>{
  const phases=ULTRA_DETAIL_OBSERVED_PHASE_IDS.map(phase_id=>({phase_id,status:"COMPLETED",operation_id:phase_id,next_chunk_index:1}));
  let saved,merged;
  const run={run_id:"ultra-partial-test",usage:{web_search_calls:20,cost_microusd:1200000},plan_snapshot:{phases}};
  const repository={
    getUltraMaxRunOperation:async(_run,id)=>({status:"COMPLETED",result:{payload:{phase_id:phases.find(p=>id.startsWith(p.phase_id)).phase_id,records:[],rejected_candidates:[],search_status:"PARTIAL",coverage:[{status:"FAILED",error_code:"WIDE_SEARCH_TOOL_BOUNDARY_INVALID"}],diagnostics:{source_yield:[{returned:3}]}}}}),
    mergeSearchResultsWithStats:async records=>{merged=records;return{new_count:0,updated_count:0,workspace_total:16};},
    saveSearchRun:async value=>{saved=value;}
  };
  await persistUltraMaxVerifiedResults({repository,run,detailOutput:{payload:{records:[],verification:{candidate_results:[]}},usage:{}},nowIso:"2026-10-20T12:00:00Z"});
  assert.deepEqual(merged,[]);
  assert.equal(saved.search_status,"PARTIAL");
  assert.equal(saved.failed_shards,5);
  assert.equal(saved.returned_count,0);
  assert.equal(saved.counters.source_urls_verified,0);
  assert.equal(saved.counters.workspace_total,16);
  assert.equal(saved.diagnostics.source_yield_scope,"DISCOVERY_INTERMEDIATE");
});

test("ULTRA final persistence obeys a cancel marker written during detail verification", async () => {
  let writes=0;
  const repository={
    mergeSearchResultsWithStats:async()=>{writes+=1;throw new Error("must not merge");},
    saveSearchRun:async()=>{writes+=1;throw new Error("must not save");},
    getUltraMaxRunCancel:async()=>({requested_at:"2026-09-08T23:59:00.000Z"})
  };
  const result=await persistUltraMaxVerifiedResults({
    repository,
    run:{run_id:"ultra-cancelled"},
    detailOutput:{payload:{records:[{id:"candidate"}]},usage:{}},
    nowIso:"2026-09-08T23:59:01.000Z"
  });
  assert.deepEqual(result,{cancelled:true});
  assert.equal(writes,0);
});
