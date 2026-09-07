import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(new URL("../netlify/database/migrations/20260905220000_paid-run-coordinator/migration.sql", import.meta.url), "utf8");

test("paid coordinator migration has durable identities and database budget checks", () => {
  assert.match(migration, /PRIMARY KEY \(run_id, operation_id\)/);
  assert.match(migration, /PRIMARY KEY \(run_id, reservation_id\)/);
  assert.match(migration, /reserved_microusd \+ settled_microusd <= cap_microusd/);
  assert.match(migration, /actual_microusd <= max_microusd/);
  assert.match(migration, /status IN \('READY', 'CLAIMED', 'RESERVED', 'SETTLED', 'COMPLETED', 'CANCELLED', 'UNCERTAIN'\)/);
});
