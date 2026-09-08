import test from "node:test";
import assert from "node:assert/strict";
import { continueUltraNativeLoop, isUltraNativeTerminal, ultraNativeProgress } from "../src/lib/ultra-max-view.mjs";

function snapshot({status = "READY", phaseStatus = "PENDING", chunks = 0, next = 1} = {}) {
  return {
    ok:true,
    run:{
      run_id:"ultra_ui_test",
      status,
      usage:{source_requests:chunks * 4,candidates_seen:chunks,results_accepted:Math.floor(chunks / 2)},
      plan_snapshot:{max_source_requests:200,max_candidates:200,max_results:100,phases:[{phase_id:"NATIVE_COLLECTION",status:phaseStatus,chunks_completed:chunks}]}
    },
    next_operation:phaseStatus === "COMPLETED" ? {phase_id:"CORE_DISCOVERY",operation_id:"paid-not-allowed"} : {phase_id:"NATIVE_COLLECTION",operation_id:`native-${next}`}
  };
}

test("ULTRA native progress exposes hard-cap denominators", () => {
  const progress = ultraNativeProgress(snapshot({chunks:2}).run);
  assert.deepEqual(progress.chunks,{value:2,maximum:50,ratio:0.04});
  assert.deepEqual(progress.sourceRequests,{value:8,maximum:200,ratio:0.04});
  assert.equal(progress.candidates.value,2);
  assert.equal(progress.accepted.value,1);
});

test("one UI action consumes server-issued native operation IDs until native completion", async () => {
  const called = [];
  const result = await continueUltraNativeLoop({
    initialPayload:snapshot(),
    maxChunks:50,
    continueChunk:async (_runId, operationId) => {
      called.push(operationId);
      return called.length === 3 ? snapshot({phaseStatus:"COMPLETED",chunks:3,next:4}) : snapshot({status:"PAUSED",phaseStatus:"PAUSED",chunks:called.length,next:called.length + 1});
    }
  });
  assert.deepEqual(called,["native-1","native-2","native-3"]);
  assert.equal(result.reason,"NATIVE_COMPLETED");
  assert.equal(result.chunks,3);
  assert.equal(isUltraNativeTerminal(result.run),true);
});

test("ULTRA UI never retries an ambiguous failed chunk", async () => {
  let calls = 0;
  await assert.rejects(() => continueUltraNativeLoop({
    initialPayload:snapshot(),
    continueChunk:async () => { calls += 1; const error = new Error("network uncertain"); error.code = "API_FAILED"; throw error; }
  }), /network uncertain/);
  assert.equal(calls,1);
});

test("ULTRA UI stops before a paid phase and obeys its local chunk cap", async () => {
  const unavailable = await continueUltraNativeLoop({initialPayload:{...snapshot(),next_operation:{phase_id:"CORE_DISCOVERY",operation_id:"paid"}},continueChunk:async()=>assert.fail("must not dispatch")});
  assert.equal(unavailable.reason,"NATIVE_PHASE_UNAVAILABLE");
  let calls = 0;
  const capped = await continueUltraNativeLoop({
    initialPayload:snapshot(),
    maxChunks:2,
    continueChunk:async () => snapshot({status:"PAUSED",phaseStatus:"PAUSED",chunks:++calls,next:calls + 1})
  });
  assert.equal(calls,2);
  assert.equal(capped.reason,"UI_CHUNK_CAP_REACHED");
});
