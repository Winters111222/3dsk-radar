import test from "node:test";
import assert from "node:assert/strict";
import { probeUltraPaidCoordinator } from "../src/server/ultra-paid-coordinator-probe.mjs";
import { memoryPaidCoordinator } from "./helpers/memory-paid-coordinator.mjs";

test("ULTRA readiness performs a read-only database probe before paid dispatch", async () => {
  const ready=await probeUltraPaidCoordinator(memoryPaidCoordinator({capMicrousd:15_000_000,lifecycleMode:"MULTI_OPERATION"}));
  assert.deepEqual(ready,{ready:true,code:"READY"});
  const capMismatch=await probeUltraPaidCoordinator(memoryPaidCoordinator({capMicrousd:500_000,lifecycleMode:"MULTI_OPERATION"}),{expectedCapMicrousd:15_000_000});
  assert.deepEqual(capMismatch,{ready:false,code:"ULTRA_PAID_COORDINATOR_LOCKED"});
  const unavailable=await probeUltraPaidCoordinator({
    capabilities:Object.fromEntries(["atomic_compare_and_swap","durable_unique_operation_keys","transactional_budget_reservation","monotonic_fencing_tokens","idempotent_settlement","multi_operation_root_budget"].map((key)=>[key,true])),
    lifecycle_mode:"MULTI_OPERATION",
    claimOperation(){},reserveBudget(){},settleBudget(){},completeOperation(){},markUncertain(){},
    async readOperation(){throw new Error("migration missing");}
  });
  assert.deepEqual(unavailable,{ready:false,code:"ULTRA_PAID_COORDINATOR_UNAVAILABLE"});
});
