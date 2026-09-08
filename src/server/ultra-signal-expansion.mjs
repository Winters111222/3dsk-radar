import { mergeStoredSourceSignals } from "./official-source-run.mjs";
import { createUltraHostedDiscoveryExecutor } from "./ultra-hosted-discovery.mjs";
import {
  ULTRA_SIGNAL_EXPANSION_MAX_CONCURRENCY,
  ULTRA_SIGNAL_EXPANSION_MAX_RESULTS,
  ULTRA_SIGNAL_EXPANSION_MAX_STORED_SIGNALS,
  ULTRA_SIGNAL_EXPANSION_RESULTS_PER_SHARD,
  ULTRA_SIGNAL_EXPANSION_SHARDS,
  ULTRA_SIGNAL_EXPANSION_TOOL_CALLS_PER_SHARD,
  validateUltraSignalExpansionPlan
} from "./ultra-signal-expansion-plan.mjs";

export function createUltraSignalExpansionExecutor({repository,...dependencies}={}) {
  if (!repository||typeof repository.listSourceSignals!=="function") throw new Error("ULTRA_SIGNAL_REPOSITORY_REQUIRED");
  return createUltraHostedDiscoveryExecutor({
    ...dependencies,
    phaseId:"SIGNAL_EXPANSION",
    searchProfile:"ULTRA_SIGNAL_EXPANSION",
    budgetCapMicrousd:1_000_000,
    shards:ULTRA_SIGNAL_EXPANSION_SHARDS,
    maxResults:ULTRA_SIGNAL_EXPANSION_MAX_RESULTS,
    resultsPerShard:ULTRA_SIGNAL_EXPANSION_RESULTS_PER_SHARD,
    toolCallsPerShard:ULTRA_SIGNAL_EXPANSION_TOOL_CALLS_PER_SHARD,
    maxConcurrency:ULTRA_SIGNAL_EXPANSION_MAX_CONCURRENCY,
    validatePlan:validateUltraSignalExpansionPlan,
    prepareSearchInput:async()=>({
      officialDiscovery:mergeStoredSourceSignals(null,await repository.listSourceSignals(),dependencies.nowIso,ULTRA_SIGNAL_EXPANSION_MAX_STORED_SIGNALS)
    })
  });
}
