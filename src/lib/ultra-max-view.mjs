const TERMINAL_STATUSES = new Set(["COMPLETED", "CANCELLED", "UNCERTAIN"]);

function finite(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function ratio(value, maximum) {
  return maximum > 0 ? Math.max(0, Math.min(1, value / maximum)) : 0;
}

export function ultraNativePhase(run) {
  return run?.plan_snapshot?.phases?.find((phase) => phase.phase_id === "NATIVE_COLLECTION") || null;
}

export function isUltraNativeTerminal(run) {
  const phase = ultraNativePhase(run);
  return TERMINAL_STATUSES.has(run?.status) || phase?.status === "COMPLETED";
}

export function isUltraMaxTerminal(run) {
  return TERMINAL_STATUSES.has(run?.status);
}

export function ultraNativeProgress(run) {
  const phase = ultraNativePhase(run);
  const usage = run?.usage || {};
  const plan = run?.plan_snapshot || {};
  const chunks = finite(phase?.chunks_completed);
  const sourceRequests = finite(usage.source_requests);
  const candidates = finite(usage.candidates_seen);
  const accepted = finite(usage.results_accepted);
  return {
    chunks:{ value:chunks, maximum:50, ratio:ratio(chunks, 50) },
    sourceRequests:{ value:sourceRequests, maximum:finite(plan.max_source_requests), ratio:ratio(sourceRequests, finite(plan.max_source_requests)) },
    candidates:{ value:candidates, maximum:finite(plan.max_candidates), ratio:ratio(candidates, finite(plan.max_candidates)) },
    accepted:{ value:accepted, maximum:finite(plan.max_results), ratio:ratio(accepted, finite(plan.max_results)) }
  };
}

export async function continueUltraNativeLoop({
  initialPayload,
  continueChunk,
  onUpdate = async () => {},
  shouldStop = () => false,
  maxChunks = 50
} = {}) {
  if (!initialPayload?.run?.run_id || typeof continueChunk !== "function") throw new Error("ULTRA_MAX_UI_DEPENDENCY_MISSING");
  let payload = initialPayload;
  let chunks = 0;
  while (!isUltraNativeTerminal(payload.run) && chunks < maxChunks && !shouldStop()) {
    const next = payload.next_operation;
    if (next?.phase_id !== "NATIVE_COLLECTION" || !next.operation_id) {
      return { ...payload, chunks, reason:"NATIVE_PHASE_UNAVAILABLE" };
    }
    payload = await continueChunk(payload.run.run_id, next.operation_id);
    chunks += 1;
    await onUpdate(payload, chunks);
  }
  const reason = shouldStop()
    ? "STOP_REQUESTED"
    : isUltraNativeTerminal(payload.run)
      ? ultraNativePhase(payload.run)?.status === "COMPLETED" ? "NATIVE_COMPLETED" : payload.run.status
      : "UI_CHUNK_CAP_REACHED";
  return { ...payload, chunks, reason };
}

export async function continueUltraMaxLoop({
  initialPayload,
  continueNative,
  continuePaid,
  onUpdate=async()=>{},
  shouldStop=()=>false,
  paidReady=()=>false,
  maxOperations=56
}={}) {
  if (!initialPayload?.run?.run_id||typeof continueNative!=="function"||typeof continuePaid!=="function") throw new Error("ULTRA_MAX_UI_DEPENDENCY_MISSING");
  let payload=initialPayload;
  let operations=0;
  while (!isUltraMaxTerminal(payload.run)&&operations<maxOperations&&!shouldStop()) {
    const next=payload.next_operation;
    if (!next?.phase_id||!next.operation_id) return {...payload,operations,reason:"NEXT_OPERATION_UNAVAILABLE"};
    if (next.phase_id==="NATIVE_COLLECTION") payload=await continueNative(payload.run.run_id,next.operation_id);
    else {
      if (!paidReady()) return {...payload,operations,reason:"PAID_PHASE_LOCKED"};
      payload=await continuePaid(payload.run.run_id,next);
    }
    operations+=1;
    await onUpdate(payload,operations);
  }
  const reason=shouldStop()?"STOP_REQUESTED":isUltraMaxTerminal(payload.run)?payload.run.status:"UI_OPERATION_CAP_REACHED";
  return {...payload,operations,reason};
}
