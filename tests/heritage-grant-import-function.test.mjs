import test from "node:test";
import assert from "node:assert/strict";

const NOW = "2026-09-08T16:00:00.000Z";

function record(overrides = {}) {
  return {
    source_id:"mk_cz_heritage_grants",
    source_url:"https://www.mk.gov.cz/digitalizace-kulturnich-statku-a-narodnich-kulturnich-pamatek-cs-2941",
    title:"Výzva pro 3D digitalizaci kulturních statků",
    institution:"Ministerstvo kultury ČR",
    summary:"Podpora fotogrammetrie a 3D skenování sbírkových předmětů muzeí.",
    published_date:"2026-09-01",
    deadline:"2026-10-31",
    grant_state:"OPEN_CALL",
    participation_route:"INSTITUTION_PARTNER",
    eligibility_evidence:"Dodavatel může realizovat odborné 3D práce pro oprávněnou muzeální instituci.",
    ...overrides
  };
}

function request(records, token = "team-secret") {
  return new Request("https://radar.test/api/heritage-grant-import", {
    method:"POST",
    headers:{ authorization:`Bearer ${token}`, "content-type":"application/json" },
    body:JSON.stringify({ records })
  });
}

async function load(tag) {
  return (await import(`../netlify/functions/heritage-grant-import.mjs?${tag}=${Date.now()}`)).default;
}

function install(t, enabled = "true") {
  const values = { RADAR_INTERNAL_ACCESS_SECRET:"team-secret", RADAR_HERITAGE_GRANT_IMPORT_ENABLED:enabled };
  globalThis.Netlify = { env:{ get:(key) => values[key] || "" } };
  globalThis.__RADAR_TEST_NOW_ISO__ = NOW;
  t.after(() => {
    delete globalThis.Netlify;
    delete globalThis.__RADAR_TEST_NOW_ISO__;
    delete globalThis.__RADAR_TEST_STATE_REPOSITORY__;
  });
}

test("endpoint authenticates before its default-off import gate", async (t) => {
  install(t, "false");
  let repositoryReads = 0;
  globalThis.__RADAR_TEST_STATE_REPOSITORY__ = { listOpportunities:async () => { repositoryReads += 1; return []; } };
  const handler = await load("locked");
  assert.equal((await handler(request([record()], "wrong"), {})).status, 401);
  const locked = await handler(request([record()]), {});
  assert.equal(locked.status, 423);
  assert.equal((await locked.json()).error.code, "HERITAGE_GRANT_IMPORT_LOCKED");
  assert.equal(repositoryReads, 0);
});

test("enabled endpoint persists a verified funding lead and replays it", async (t) => {
  install(t);
  const { createStateRepository } = await import("../src/server/state-repository.mjs");
  const { memoryStore } = await import("./helpers/memory-store.mjs");
  const repository = createStateRepository(memoryStore());
  globalThis.__RADAR_TEST_STATE_REPOSITORY__ = repository;
  const handler = await load("success");
  const first = await handler(request([record()]), {});
  const replay = await handler(request([record()]), {});
  assert.equal(first.status, 202);
  assert.equal((await first.json()).imported_count, 1);
  assert.equal(replay.status, 200);
  assert.equal((await replay.json()).replayed_count, 1);
  assert.equal((await repository.listOpportunities()).length, 1);
});

test("invalid source fails closed without storing a result", async (t) => {
  install(t);
  const { createStateRepository } = await import("../src/server/state-repository.mjs");
  const { memoryStore } = await import("./helpers/memory-store.mjs");
  const repository = createStateRepository(memoryStore());
  globalThis.__RADAR_TEST_STATE_REPOSITORY__ = repository;
  const handler = await load("invalid");
  const response = await handler(request([record({ source_url:"https://attacker.example/grant" })]), {});
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, "HERITAGE_GRANT_SOURCE_URL_INVALID");
  assert.equal((await repository.listOpportunities()).length, 0);
});
