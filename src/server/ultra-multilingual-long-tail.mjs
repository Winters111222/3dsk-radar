import { createUltraHostedDiscoveryExecutor } from "./ultra-hosted-discovery.mjs";
import {
  ULTRA_MULTILINGUAL_LONG_TAIL_MAX_CONCURRENCY,
  ULTRA_MULTILINGUAL_LONG_TAIL_MAX_RESULTS,
  ULTRA_MULTILINGUAL_LONG_TAIL_RESULTS_PER_SHARD,
  ULTRA_MULTILINGUAL_LONG_TAIL_SHARDS,
  ULTRA_MULTILINGUAL_LONG_TAIL_TOOL_CALLS_PER_SHARD,
  validateUltraMultilingualLongTailPlan
} from "./ultra-multilingual-long-tail-plan.mjs";

export function createUltraMultilingualLongTailExecutor(dependencies={}) {
  return createUltraHostedDiscoveryExecutor({
    ...dependencies,
    phaseId:"MULTILINGUAL_LONG_TAIL",
    searchProfile:"ULTRA_MULTILINGUAL_LONG_TAIL",
    budgetCapMicrousd:2_500_000,
    shards:ULTRA_MULTILINGUAL_LONG_TAIL_SHARDS,
    maxResults:ULTRA_MULTILINGUAL_LONG_TAIL_MAX_RESULTS,
    resultsPerShard:ULTRA_MULTILINGUAL_LONG_TAIL_RESULTS_PER_SHARD,
    toolCallsPerShard:ULTRA_MULTILINGUAL_LONG_TAIL_TOOL_CALLS_PER_SHARD,
    maxConcurrency:ULTRA_MULTILINGUAL_LONG_TAIL_MAX_CONCURRENCY,
    validatePlan:validateUltraMultilingualLongTailPlan
  });
}
