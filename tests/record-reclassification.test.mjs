import test from "node:test";
import assert from "node:assert/strict";
import { createStateRepository } from "../src/server/state-repository.mjs";
import {
  applyRecordReclassification,
  buildRecordReclassificationPlan,
  classificationSnapshotDigest,
  createRecordReclassificationContract,
  verifyRecordReclassificationReadback
} from "../src/server/record-reclassification.mjs";

function records() {
  const sales = Array.from({length:3}, (_, index) => ({
    id:`sales-${index}`,
    company:`Buyer ${index}`,
    source_url:`https://buyer.example/rfp/${index}`,
    title:"External vendor request",
    summary:"Request for proposal for an external vendor.",
    commercial_role:"BUYER",
    opportunity_kind:"OPEN_OPPORTUNITY",
    first_seen:"2026-09-01T00:00:00Z",
    last_seen:"2026-09-06T00:00:00Z",
    status:"NEW"
  }));
  const competitors = Array.from({length:3}, (_, index) => ({
    id:`competitor-${index}`,
    company:`Seller ${index}`,
    source_url:`https://seller.example/services/${index}`,
    title:"Production services",
    summary:"Our studio provides outsourced character production services.",
    commercial_role:"BUYER",
    opportunity_kind:"POTENTIAL_LEAD",
    first_seen:"2026-09-01T00:00:00Z",
    last_seen:"2026-09-06T00:00:00Z",
    status:"INTERESTING",
    company_bookmarked:true,
    contact_history:[{sent_at:"2026-09-02T00:00:00Z"}],
    reply_body:"Historic body"
  }));
  const platform = {
    id:"platform-0",
    company:"Archived Index",
    source_url:"https://outscal.com/job/synthetic",
    title:"Archived job",
    summary:"Archived job platform entry.",
    opportunity_kind:"POTENTIAL_LEAD",
    first_seen:"2026-09-01T00:00:00Z",
    last_seen:"2026-09-06T00:00:00Z",
    status:"NEW"
  };
  return [...sales, ...competitors, platform];
}

function contractFor(items) {
  return createRecordReclassificationContract(classificationSnapshotDigest(items));
}

function memoryStore() {
  const data = new Map();
  return {
    data,
    async setJSON(key, value) { data.set(key, structuredClone(value)); },
    async get(key) { return data.has(key) ? structuredClone(data.get(key)) : null; },
    async list({prefix} = {}) { return { blobs:[...data.keys()].filter((key) => !prefix || key.startsWith(prefix)).map((key) => ({key,etag:"x"})), directories:[] }; }
  };
}

test("exact migration rejects any snapshot drift before writing", () => {
  const items = records();
  const contract = contractFor(items);
  const changed = items.map((item, index) => index === 0 ? {...item,status:"IGNORE"} : item);
  assert.throws(
    () => applyRecordReclassification(changed, "2026-09-06T14:00:00Z", contract),
    (error) => error.code === "RECLASSIFICATION_PREFLIGHT_MISMATCH"
  );
});

test("an empty or unrelated snapshot is never mistaken for an applied migration", () => {
  const items = records();
  const contract = contractFor(items);
  const plan = buildRecordReclassificationPlan([], contract);
  assert.equal(plan.already_applied, false);
  assert.equal(plan.preflight_ok, false);
});

test("exact migration changes only four non-sales records and preserves history", () => {
  const items = records();
  const contract = contractFor(items);
  const result = applyRecordReclassification(items, "2026-09-06T14:00:00Z", contract);
  assert.equal(result.mode, "APPLIED");
  assert.equal(result.changed_records.length, 4);
  assert.deepEqual(result.records.slice(0, 3), items.slice(0, 3));
  const competitor = result.records.find((item) => item.id === "competitor-0");
  assert.equal(competitor.record_kind, "COMPETITOR");
  assert.equal(competitor.opportunity_kind, null);
  assert.equal(competitor.first_seen, "2026-09-01T00:00:00Z");
  assert.equal(competitor.last_seen, "2026-09-06T00:00:00Z");
  assert.equal(competitor.status, "INTERESTING");
  assert.equal(competitor.company_bookmarked, true);
  assert.deepEqual(competitor.contact_history, items[3].contact_history);
  assert.equal(competitor.reply_body, "Historic body");
  assert.equal(competitor.classification_history[0].migration_id, contract.migration_id);
  assert.equal(verifyRecordReclassificationReadback(result.records, contract), true);
});

test("repository writes four records plus one authoritative snapshot and replay is idempotent", async () => {
  const items = records();
  const contract = contractFor(items);
  const store = memoryStore();
  const repo = createStateRepository(store);
  for (const item of items) await repo.saveOpportunity(item);
  await repo.setBookmark("Seller 0", true, "2026-09-05T12:00:00Z");
  const companyBefore = await repo.getCompany("Seller 0");
  const before = structuredClone(items);
  const first = await repo.runRecordReclassification({nowIso:"2026-09-06T14:00:00Z",contract});
  assert.equal(first.mode, "APPLIED");
  assert.equal(first.records_written, 4);
  assert.equal(first.snapshot_writes, 1);
  assert.equal(first.readback_verified, true);
  const second = await repo.runRecordReclassification({nowIso:"2026-09-06T14:01:00Z",contract});
  assert.equal(second.mode, "ALREADY_APPLIED");
  assert.equal(second.records_written, 0);
  assert.equal(second.snapshot_writes, 0);
  const snapshot = await store.get("metadata/opportunities-v1");
  assert.equal(snapshot.length, before.length);
  assert.deepEqual(snapshot.slice(0, 3), before.slice(0, 3));
  assert.deepEqual(await repo.getCompany("Seller 0"), companyBefore);
});

test("migration plan reports the exact 3/3/1 split", () => {
  const items = records();
  const plan = buildRecordReclassificationPlan(items, contractFor(items));
  assert.equal(plan.preflight_ok, true);
  assert.equal(plan.transition_count, 4);
  assert.deepEqual(plan.proposed_counts, {sales_opportunities:3,competitors:3,source_platforms:1,manual_review:0});
});
