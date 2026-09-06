import test from "node:test";
import assert from "node:assert/strict";
import { loadSourceReadinessReport } from "../scripts/source-readiness-report.mjs";

test("Tier A readiness report is offline, evidence-complete and fail-closed", async () => {
  const report = await loadSourceReadinessReport();

  assert.equal(report.ok, true);
  assert.deepEqual(report.summary, {
    tier_a_sources:5,
    historical_evidence_ready:5,
    access_ready:0,
    yield_ready:0,
    runtime_eligible:0
  });
  assert.equal(report.network_requests, 0);
  assert.equal(report.openai_requests, 0);
  assert.equal(report.cost_usd, 0);
  assert.equal(report.policy.minimum_reviewed_candidates, 30);
  assert.equal(report.policy.minimum_precision, 0.8);
  assert.ok(report.sources.every((source) => source.positive_examples >= 2));
  assert.ok(report.sources.every((source) => source.activation_blockers.includes("NOT_MEASURED")));
  assert.ok(report.sources.every((source) => source.runtime_eligible === false));
});
