import test from "node:test";
import assert from "node:assert/strict";
import { createStateRepository } from "../src/server/state-repository.mjs";
import { createUltraNativeCollectionExecutor } from "../src/server/ultra-native-collection.mjs";
import { executeUltraMaxPhase, startUltraMaxRun } from "../src/server/ultra-max-run-service.mjs";
import { ultraMaxNextOperationId } from "../src/server/ultra-max-run-contract.mjs";
import { memoryStore } from "./helpers/memory-store.mjs";

const NOW = "2026-09-08T16:00:00.000Z";

function emptyPage({sourceId, queryPackId}) {
  return {
    source_id:sourceId,
    query_pack_id:queryPackId,
    upstream_total:0,
    next_cursor:null,
    records:[],
    counters:{records_seen:0,openai_requests:0,cost_usd:0}
  };
}

test("ULTRA native phase resumes the existing zero-cost source run across bounded chunks", async () => {
  const repository = createStateRepository(memoryStore());
  let calls = 0;
  const executor = createUltraNativeCollectionExecutor({
    repository,
    nowIso:NOW,
    collectPage:async (input) => { calls += 1; return emptyPage(input); }
  });
  let root = (await startUltraMaxRun({repository,requestId:"request_native_001",runId:"ultra_native_001",nowIso:NOW})).run;
  const operationIds = [];
  for (let chunk = 1; chunk <= 4; chunk += 1) {
    const operationId = ultraMaxNextOperationId(root, "NATIVE_COLLECTION");
    operationIds.push(operationId);
    const result = await executeUltraMaxPhase({repository,runId:root.run_id,phaseId:"NATIVE_COLLECTION",operationId,nowIso:NOW,execute:executor});
    root = result.run;
    if (chunk < 4) {
      assert.equal(root.status, "PAUSED");
      assert.match(root.plan_snapshot.phases[0].checkpoint.child_run_id, /^native-run-/);
    }
  }
  assert.equal(root.plan_snapshot.phases[0].status, "COMPLETED");
  assert.equal(root.usage.source_requests, 12);
  assert.equal(calls, 12);
  assert.equal(new Set(operationIds).size, 4);

  const replay = await executeUltraMaxPhase({repository,runId:root.run_id,phaseId:"NATIVE_COLLECTION",operationId:operationIds[0],nowIso:NOW,execute:executor});
  assert.equal(replay.replayed, true);
  assert.equal(calls, 12);
});

test("native phase can import a verified grant once while source chunks continue", async () => {
  const repository = createStateRepository(memoryStore());
  const grant = {
    source_id:"mk_cz_heritage_grants",
    source_url:"https://www.mk.gov.cz/digitalizace-kulturnich-statku-a-narodnich-kulturnich-pamatek-cs-2941",
    title:"Výzva pro 3D digitalizaci kulturních statků",
    institution:"Ministerstvo kultury ČR",
    summary:"Podpora fotogrammetrie a 3D skenování sbírkových předmětů muzeí.",
    published_date:"2026-09-01",
    deadline:"2026-10-31",
    grant_state:"OPEN_CALL",
    participation_route:"INSTITUTION_PARTNER",
    eligibility_evidence:"Dodavatel může realizovat odborné 3D práce pro oprávněnou muzeální instituci."
  };
  const executor = createUltraNativeCollectionExecutor({repository,nowIso:NOW,grantRecords:[grant],collectPage:async (input) => emptyPage(input)});
  let root = (await startUltraMaxRun({repository,requestId:"request_native_002",runId:"ultra_native_002",nowIso:NOW})).run;
  for (let chunk = 0; chunk < 2; chunk += 1) {
    const operationId = ultraMaxNextOperationId(root, "NATIVE_COLLECTION");
    root = (await executeUltraMaxPhase({repository,runId:root.run_id,phaseId:"NATIVE_COLLECTION",operationId,nowIso:NOW,execute:executor})).run;
  }
  assert.equal((await repository.listOpportunities()).length, 1);
  assert.equal(root.usage.results_accepted, 1);
});
