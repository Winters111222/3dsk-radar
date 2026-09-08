import { createUltraHostedDiscoveryExecutor } from "./ultra-hosted-discovery.mjs";
import {
  ULTRA_CORE_DISCOVERY_SHARDS,
  ULTRA_CORE_MAX_CONCURRENCY,
  ULTRA_CORE_MAX_RESULTS,
  ULTRA_CORE_RESULTS_PER_SHARD,
  ULTRA_CORE_TOOL_CALLS_PER_SHARD,
  validateUltraCoreDiscoveryPlan
} from "./ultra-core-discovery-plan.mjs";

export function createUltraCoreDiscoveryExecutor(dependencies={}) {
  return createUltraHostedDiscoveryExecutor({
    ...dependencies,
    phaseId:"CORE_DISCOVERY",
    searchProfile:"ULTRA_CORE_DISCOVERY",
    budgetCapMicrousd:3_000_000,
    shards:ULTRA_CORE_DISCOVERY_SHARDS,
    maxResults:ULTRA_CORE_MAX_RESULTS,
    resultsPerShard:ULTRA_CORE_RESULTS_PER_SHARD,
    toolCallsPerShard:ULTRA_CORE_TOOL_CALLS_PER_SHARD,
    maxConcurrency:ULTRA_CORE_MAX_CONCURRENCY,
    validatePlan:validateUltraCoreDiscoveryPlan
  });
}
