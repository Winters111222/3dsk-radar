import { createUltraAdaptiveFollowupExecutor } from "./ultra-adaptive-followup.mjs";
import { createUltraCoreDiscoveryExecutor } from "./ultra-core-discovery.mjs";
import { createUltraDetailVerificationExecutor } from "./ultra-detail-verification.mjs";
import { persistUltraMaxVerifiedResults } from "./ultra-max-finalize.mjs";
import { createUltraMultilingualLongTailExecutor } from "./ultra-multilingual-long-tail.mjs";
import { createUltraProcurementFundingExecutor } from "./ultra-procurement-funding.mjs";
import { createUltraSignalExpansionExecutor } from "./ultra-signal-expansion.mjs";

const FACTORIES=Object.freeze({
  CORE_DISCOVERY:createUltraCoreDiscoveryExecutor,
  PROCUREMENT_FUNDING:createUltraProcurementFundingExecutor,
  MULTILINGUAL_LONG_TAIL:createUltraMultilingualLongTailExecutor,
  SIGNAL_EXPANSION:createUltraSignalExpansionExecutor,
  ADAPTIVE_FOLLOWUP:createUltraAdaptiveFollowupExecutor,
  DETAIL_VERIFICATION:createUltraDetailVerificationExecutor
});

export const ULTRA_MAX_PAID_PHASE_IDS=Object.freeze(Object.keys(FACTORIES));

export function createUltraMaxPaidPhaseExecutor({phaseId,repository,...dependencies}={}) {
  const factory=FACTORIES[phaseId];
  if (!factory) throw new Error("ULTRA_PAID_PHASE_INVALID");
  const base=factory({repository,...dependencies});
  if (phaseId!=="DETAIL_VERIFICATION") return base;
  return async (context)=>{
    const output=await base(context);
    const persisted=await persistUltraMaxVerifiedResults({repository,run:context.run,detailOutput:output,nowIso:dependencies.nowIso});
    return {...output,payload:{...output.payload,persistence:{status:persisted.cancelled?"SKIPPED_CANCELLED":"VERIFIED",...persisted}}};
  };
}
