import test from "node:test";
import assert from "node:assert/strict";
import { persistUltraMaxVerifiedResults } from "../src/server/ultra-max-finalize.mjs";

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
