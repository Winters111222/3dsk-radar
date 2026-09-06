import test from "node:test";
import assert from "node:assert/strict";
import { runFixtureAcceptance } from "../scripts/fixture-acceptance.mjs";

test("zero-cost fixture acceptance covers response, bookmark and outreach memory", async () => {
  const result = await runFixtureAcceptance();
  assert.equal(result.ok, true);
  assert.equal(result.cost_usd, 0);
  assert.equal(result.contact_count, 1);
  assert.equal(result.duplicate_warning_band, "RECENT");
  for (const [name, passed] of Object.entries(result.checks)) {
    assert.equal(passed, true, name);
  }
});
