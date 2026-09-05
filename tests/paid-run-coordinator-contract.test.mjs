import test from "node:test";
import assert from "node:assert/strict";
import { PAID_COORDINATOR_REQUIRED_CAPABILITIES, paidCoordinatorReadiness } from "../src/server/paid-run-coordinator-contract.mjs";

test("paid coordinator stays locked without every atomic capability", () => {
  const readiness = paidCoordinatorReadiness({ capabilities:{ atomic_compare_and_swap:true } });
  assert.equal(readiness.ready, false);
  assert.equal(readiness.paid_execution, "LOCKED");
  assert.ok(readiness.missing.includes("transactional_budget_reservation"));
  assert.ok(readiness.missing.includes("claimOperation(runId, operationId, expectedVersion)"));
});

test("coordinator contract requires CAS, fencing, uniqueness and transactional budget settlement", () => {
  const capabilities = Object.fromEntries(PAID_COORDINATOR_REQUIRED_CAPABILITIES.map((name) => [name, true]));
  const readiness = paidCoordinatorReadiness({
    capabilities,
    claimOperation() {},
    reserveBudget() {},
    settleBudget() {}
  });
  assert.deepEqual(readiness, { contract_version:1, ready:true, paid_execution:"READY_FOR_INTEGRATION", missing:[] });
});
