import { createUltraHostedDiscoveryExecutor } from "./ultra-hosted-discovery.mjs";
import {
  ULTRA_PROCUREMENT_FUNDING_MAX_CONCURRENCY,
  ULTRA_PROCUREMENT_FUNDING_MAX_RESULTS,
  ULTRA_PROCUREMENT_FUNDING_RESULTS_PER_SHARD,
  ULTRA_PROCUREMENT_FUNDING_SHARDS,
  ULTRA_PROCUREMENT_FUNDING_TOOL_CALLS_PER_SHARD,
  validateUltraProcurementFundingPlan
} from "./ultra-procurement-funding-plan.mjs";

export function createUltraProcurementFundingExecutor(dependencies={}) {
  return createUltraHostedDiscoveryExecutor({
    ...dependencies,
    phaseId:"PROCUREMENT_FUNDING",
    searchProfile:"ULTRA_PROCUREMENT_FUNDING",
    budgetCapMicrousd:2_500_000,
    shards:ULTRA_PROCUREMENT_FUNDING_SHARDS,
    maxResults:ULTRA_PROCUREMENT_FUNDING_MAX_RESULTS,
    resultsPerShard:ULTRA_PROCUREMENT_FUNDING_RESULTS_PER_SHARD,
    toolCallsPerShard:ULTRA_PROCUREMENT_FUNDING_TOOL_CALLS_PER_SHARD,
    maxConcurrency:ULTRA_PROCUREMENT_FUNDING_MAX_CONCURRENCY,
    validatePlan:validateUltraProcurementFundingPlan
  });
}
