import test from "node:test";
import assert from "node:assert/strict";
import { collectorRegistry } from "../src/server/collectors/registry.mjs";

test("collector registry exposes verified official APIs and keeps community automation blocked after review", () => {
  const locked = collectorRegistry({ collectionEnabled:false });
  assert.equal(locked.find((item) => item.source_id === "ted_eu").status, "LOCKED");
  assert.equal(locked.find((item) => item.source_id === "ted_eu").ai_cost_usd, 0);
  assert.equal(locked.find((item) => item.source_id === "ted_eu").network_verified, true);
  assert.equal(locked.find((item) => item.source_id === "ted_eu").deployed_endpoint_verified, false);
  assert.equal(locked.find((item) => item.source_id === "find_tender_uk").status, "LOCKED");
  assert.equal(locked.find((item) => item.source_id === "find_tender_uk").method, "OCDS_API");
  assert.equal(locked.find((item) => item.source_id === "find_tender_uk").network_verified, true);
  assert.equal(locked.find((item) => item.source_id === "contracts_finder_uk").status, "LOCKED");
  assert.equal(locked.find((item) => item.source_id === "contracts_finder_uk").method, "OCDS_API");
  assert.equal(locked.find((item) => item.source_id === "contracts_finder_uk").network_verified, true);
  for (const id of ["polycount_paid", "unreal_job_offerings", "blender_paid"]) {
    assert.equal(locked.find((item) => item.source_id === id).status, "BLOCKED_ACCESS_REVIEW");
    assert.equal(locked.find((item) => item.source_id === id).access_review_status, "COMPLETED_BLOCKED");
    assert.ok(locked.find((item) => item.source_id === id).access_review_reason);
  }
  assert.doesNotMatch(JSON.stringify(locked), /visual.ai.motion/i);
  assert.equal(collectorRegistry({ collectionEnabled:true }).find((item) => item.source_id === "ted_eu").status, "BLOCKED_RELEVANCE_REVIEW");
  assert.equal(collectorRegistry({ collectionEnabled:true }).find((item) => item.source_id === "find_tender_uk").status, "BLOCKED_RELEVANCE_REVIEW");
  assert.equal(collectorRegistry({ collectionEnabled:true }).find((item) => item.source_id === "contracts_finder_uk").status, "BLOCKED_RELEVANCE_REVIEW");
  assert.equal(collectorRegistry({ collectionEnabled:true }).find((item) => item.source_id === "ted_eu").historical_tier, "C");
  assert.equal(collectorRegistry({ collectionEnabled:true }).find((item) => item.source_id === "ted_eu").runtime_eligible, false);
});
