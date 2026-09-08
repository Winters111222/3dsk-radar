import test from "node:test";
import assert from "node:assert/strict";
import { normalizeCandidate } from "../src/server/normalize.mjs";
import { normalizeHeritageGrantBatch, normalizeHeritageGrantRecord } from "../src/server/heritage-grant-import.mjs";
import { importHeritageGrantBatch } from "../src/server/heritage-grant-import-service.mjs";
import { createStateRepository } from "../src/server/state-repository.mjs";
import { memoryStore } from "./helpers/memory-store.mjs";

const NOW = "2026-09-08T16:00:00.000Z";

function openCall(overrides = {}) {
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

test("verified Czech open call becomes a funding lead and never a buyer budget", () => {
  const imported = normalizeHeritageGrantRecord(openCall(), { nowIso:NOW });
  const normalized = normalizeCandidate(imported.candidate, new Set([imported.verified_source_url]), NOW);
  assert.equal(normalized.rejection, null);
  assert.equal(normalized.opportunity.opportunity_kind, "POTENTIAL_LEAD");
  assert.equal(normalized.opportunity.commercial_role, "PARTNER");
  assert.ok(normalized.opportunity.categories.includes("HERITAGE_FUNDING_PARTNERSHIP"));
  assert.equal(normalized.opportunity.budget_type, "UNKNOWN");
  assert.equal(normalized.opportunity.budget_published, null);
});

test("funded Slovak recipient remains a partnership lead, not an open procurement", () => {
  const imported = normalizeHeritageGrantRecord(openCall({
    source_id:"mk_sr_heritage_grants",
    source_url:"https://www.culture.gov.sk/sk/dotacie-2026/digitalizacia-zbierok",
    title:"Podporená 3D digitalizácia zbierok",
    institution:"Slovenské múzeum",
    summary:"Projekt zahŕňa fotogrametriu a 3D skenovanie zbierkových predmetov múzea.",
    grant_state:"FUNDED_RECIPIENT",
    deadline:null,
    participation_route:"DIRECT"
  }), { nowIso:NOW });
  assert.equal(imported.candidate.notice_status, "AWARDED");
  assert.equal(imported.candidate.opportunity_kind, "POTENTIAL_LEAD");
  const normalized = normalizeCandidate(imported.candidate, new Set([imported.verified_source_url]), NOW);
  assert.equal(normalized.rejection, null);
  assert.equal(normalized.opportunity.opportunity_kind, "POTENTIAL_LEAD");
});

test("generic indexes, expired calls and missing explicit 3D scope fail closed", () => {
  assert.throws(() => normalizeHeritageGrantRecord(openCall({ source_url:"https://www.mk.gov.cz/granty-a-dotace-cs-1234" }), { nowIso:NOW }), /HERITAGE_GRANT_SOURCE_URL_INVALID/);
  assert.throws(() => normalizeHeritageGrantRecord(openCall({ deadline:"2026-09-07" }), { nowIso:NOW }), /HERITAGE_GRANT_CALL_EXPIRED/);
  assert.throws(() => normalizeHeritageGrantRecord(openCall({ title:"Digitalizace archivu", summary:"Podpora OCR dokumentů kulturní instituce." }), { nowIso:NOW }), /HERITAGE_GRANT_SCOPE_NOT_EXPLICIT/);
});

test("participation evidence is mandatory and batch size is bounded", () => {
  assert.throws(() => normalizeHeritageGrantRecord(openCall({ eligibility_evidence:"" }), { nowIso:NOW }), /HERITAGE_GRANT_PARTICIPATION_UNPROVEN/);
  assert.throws(() => normalizeHeritageGrantBatch(Array.from({ length:51 }, () => openCall()), { nowIso:NOW }), /HERITAGE_GRANT_BATCH_INVALID/);
});

test("manual research import persists once and becomes visible in the Radar workspace", async () => {
  const repository = createStateRepository(memoryStore());
  const first = await importHeritageGrantBatch({ repository, records:[openCall()], nowIso:NOW });
  const replay = await importHeritageGrantBatch({ repository, records:[openCall()], nowIso:NOW });
  const workspace = await repository.listOpportunities();
  assert.equal(first.imported_count, 1);
  assert.equal(first.replayed_count, 0);
  assert.equal(replay.imported_count, 0);
  assert.equal(replay.replayed_count, 1);
  assert.equal(workspace.length, 1);
  assert.equal(workspace[0].opportunity_kind, "POTENTIAL_LEAD");
  assert.ok(workspace[0].categories.includes("HERITAGE_FUNDING_PARTNERSHIP"));
  assert.equal(workspace[0].budget_type, "UNKNOWN");
});

test("an invalid batch writes no opportunity or import marker", async () => {
  const store = memoryStore();
  const repository = createStateRepository(store);
  await assert.rejects(() => importHeritageGrantBatch({
    repository,
    records:[openCall(), openCall({ source_url:"https://attacker.example/grant" })],
    nowIso:NOW
  }), /HERITAGE_GRANT_SOURCE_URL_INVALID/);
  assert.equal((await repository.listOpportunities()).length, 0);
  assert.equal([...store.data.keys()].filter((key) => key.startsWith("heritage-grant-imports/")).length, 0);
});
