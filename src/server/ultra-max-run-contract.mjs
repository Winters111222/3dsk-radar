import { createHash, randomUUID } from "node:crypto";
import { validClientId } from "./source-run-contract.mjs";

export const ULTRA_MAX_RUN_SCHEMA_VERSION = 2;
export const ULTRA_MAX_RUN_STATUSES = Object.freeze(["READY", "RUNNING", "PAUSED", "COMPLETED", "CANCELLED", "UNCERTAIN"]);
export const ULTRA_MAX_CHECKPOINT_MAX_BYTES = 65_536;

const phase = (sequence, phaseId, kind, limits) => Object.freeze({
  sequence,
  phase_id:phaseId,
  kind,
  retry_policy:"NO_AUTOMATIC_RETRY",
  ...limits
});

export const ULTRA_MAX_PHASES = Object.freeze([
  phase(1, "NATIVE_COLLECTION", "ZERO_COST_SOURCE", {
    max_source_requests:200,
    max_openai_requests:0,
    max_web_search_calls:0,
    budget_cap_microusd:0
  }),
  phase(2, "CORE_DISCOVERY", "PAID_HOSTED_SEARCH", {
    max_source_requests:0,
    max_openai_requests:20,
    max_web_search_calls:60,
    budget_cap_microusd:3_000_000
  }),
  phase(3, "PROCUREMENT_FUNDING", "PAID_HOSTED_SEARCH", {
    max_source_requests:0,
    max_openai_requests:16,
    max_web_search_calls:48,
    budget_cap_microusd:2_500_000
  }),
  phase(4, "MULTILINGUAL_LONG_TAIL", "PAID_HOSTED_SEARCH", {
    max_source_requests:0,
    max_openai_requests:16,
    max_web_search_calls:48,
    budget_cap_microusd:2_500_000
  }),
  phase(5, "SIGNAL_EXPANSION", "PAID_HOSTED_SEARCH", {
    max_source_requests:0,
    max_openai_requests:8,
    max_web_search_calls:24,
    budget_cap_microusd:1_000_000
  }),
  phase(6, "ADAPTIVE_FOLLOWUP", "PAID_HOSTED_SEARCH", {
    max_source_requests:0,
    max_openai_requests:20,
    max_web_search_calls:60,
    budget_cap_microusd:3_000_000
  }),
  phase(7, "DETAIL_VERIFICATION", "PAID_DETAIL_VERIFY", {
    max_source_requests:0,
    max_openai_requests:20,
    max_web_search_calls:60,
    budget_cap_microusd:3_000_000
  })
]);

export const ULTRA_MAX_PROFILE = Object.freeze({
  profile_id:"ULTRA_MAX",
  max_cost_microusd:15_000_000,
  max_openai_requests:100,
  max_web_search_calls:300,
  max_source_requests:200,
  max_candidates:200,
  max_results:100,
  phases:ULTRA_MAX_PHASES
});

function integer(value, code) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(code);
  return parsed;
}

function operationSuffix(runId) {
  return createHash("sha256").update(runId).digest("hex").slice(0, 20);
}

function emptyUsage() {
  return { source_requests:0, openai_requests:0, web_search_calls:0, cost_microusd:0, candidates_seen:0, results_accepted:0 };
}

function withStatus(run, status, nowIso, extra = {}) {
  return { ...run, status, updated_at:nowIso, ...extra };
}

function validateTimestamp(nowIso) {
  if (!nowIso || !Number.isFinite(Date.parse(nowIso))) throw new Error("ULTRA_MAX_TIMESTAMP_INVALID");
}

export function createUltraMaxRun({ requestId, nowIso, runId = randomUUID() } = {}) {
  if (!validClientId(requestId)) throw new Error("ULTRA_MAX_REQUEST_ID_INVALID");
  if (!validClientId(runId)) throw new Error("ULTRA_MAX_RUN_ID_INVALID");
  validateTimestamp(nowIso);
  const suffix = operationSuffix(runId);
  return {
    schema_version:ULTRA_MAX_RUN_SCHEMA_VERSION,
    run_id:runId,
    request_id:requestId,
    profile_id:ULTRA_MAX_PROFILE.profile_id,
    status:"READY",
    current_phase_id:null,
    created_at:nowIso,
    updated_at:nowIso,
    started_at:null,
    completed_at:null,
    cancel_requested_at:null,
    completion_reason:null,
    retry_allowed:false,
    plan_snapshot:{
      ...ULTRA_MAX_PROFILE,
      phases:ULTRA_MAX_PHASES.map((item) => ({
        ...item,
        operation_id:`ultra-${item.sequence}-${suffix}`,
        reservation_id:item.budget_cap_microusd ? `ultra-budget-${item.sequence}-${suffix}` : null,
        status:"PENDING",
        started_at:null,
        completed_at:null,
        chunks_completed:0,
        next_chunk_index:1,
        checkpoint:null,
        usage:emptyUsage()
      }))
    },
    usage:emptyUsage()
  };
}

export function beginUltraMaxPhase(run, phaseId, nowIso) {
  validateTimestamp(nowIso);
  if (!["READY", "RUNNING", "PAUSED"].includes(run?.status)) throw new Error("ULTRA_MAX_RUN_NOT_ACTIVE");
  if (run.cancel_requested_at) throw new Error("ULTRA_MAX_RUN_CANCELLED");
  const index = run.plan_snapshot.phases.findIndex((item) => item.phase_id === phaseId);
  if (index < 0) throw new Error("ULTRA_MAX_PHASE_INVALID");
  const target = run.plan_snapshot.phases[index];
  if (target.status === "RUNNING") return run;
  if (!["PENDING", "PAUSED"].includes(target.status)) throw new Error("ULTRA_MAX_PHASE_ALREADY_TERMINAL");
  if (run.plan_snapshot.phases.slice(0, index).some((item) => item.status !== "COMPLETED")) {
    throw new Error("ULTRA_MAX_PHASE_ORDER_VIOLATION");
  }
  return withStatus(run, "RUNNING", nowIso, {
    current_phase_id:phaseId,
    started_at:run.started_at || nowIso,
    plan_snapshot:{
      ...run.plan_snapshot,
      phases:run.plan_snapshot.phases.map((item) => item.phase_id === phaseId ? { ...item, status:"RUNNING", started_at:item.started_at || nowIso } : item)
    }
  });
}

export function ultraMaxNextOperationId(run, phaseId) {
  const target = run?.plan_snapshot?.phases?.find((item) => item.phase_id === phaseId);
  if (!target) throw new Error("ULTRA_MAX_PHASE_INVALID");
  const index = integer(target.next_chunk_index || 1, "ULTRA_MAX_CHUNK_INDEX_INVALID");
  if (index < 1) throw new Error("ULTRA_MAX_CHUNK_INDEX_INVALID");
  return `${target.operation_id}-chunk-${String(index).padStart(4, "0")}`;
}

function safeCheckpoint(value) {
  if (value === undefined || value === null) return null;
  let serialized;
  try { serialized = JSON.stringify(value); }
  catch { throw new Error("ULTRA_MAX_CHECKPOINT_INVALID"); }
  if (!serialized || Buffer.byteLength(serialized, "utf8") > ULTRA_MAX_CHECKPOINT_MAX_BYTES) {
    throw new Error("ULTRA_MAX_CHECKPOINT_INVALID");
  }
  return JSON.parse(serialized);
}

export function pauseUltraMaxPhase(run, phaseId, checkpoint, nowIso) {
  validateTimestamp(nowIso);
  if (run?.status !== "RUNNING" || run.current_phase_id !== phaseId) throw new Error("ULTRA_MAX_PHASE_NOT_RUNNING");
  const savedCheckpoint = safeCheckpoint(checkpoint);
  return withStatus(run, "PAUSED", nowIso, {
    current_phase_id:phaseId,
    active_operation_id:null,
    completion_reason:"PHASE_CHUNK_COMPLETE",
    plan_snapshot:{
      ...run.plan_snapshot,
      phases:run.plan_snapshot.phases.map((item) => item.phase_id === phaseId ? {
        ...item,
        status:"PAUSED",
        chunks_completed:item.chunks_completed + 1,
        next_chunk_index:item.next_chunk_index + 1,
        checkpoint:savedCheckpoint
      } : item)
    }
  });
}

export function recordUltraMaxUsage(run, phaseId, delta = {}, nowIso) {
  validateTimestamp(nowIso);
  if (run?.status !== "RUNNING" || run.current_phase_id !== phaseId) throw new Error("ULTRA_MAX_PHASE_NOT_RUNNING");
  const values = {
    source_requests:integer(delta.source_requests || 0, "ULTRA_MAX_USAGE_INVALID"),
    openai_requests:integer(delta.openai_requests || 0, "ULTRA_MAX_USAGE_INVALID"),
    web_search_calls:integer(delta.web_search_calls || 0, "ULTRA_MAX_USAGE_INVALID"),
    cost_microusd:integer(delta.cost_microusd || 0, "ULTRA_MAX_USAGE_INVALID"),
    candidates_seen:integer(delta.candidates_seen || 0, "ULTRA_MAX_USAGE_INVALID"),
    results_accepted:integer(delta.results_accepted || 0, "ULTRA_MAX_USAGE_INVALID")
  };
  const target = run.plan_snapshot.phases.find((item) => item.phase_id === phaseId);
  if (!target || target.status !== "RUNNING") throw new Error("ULTRA_MAX_PHASE_NOT_RUNNING");
  const phaseUsage = Object.fromEntries(Object.keys(values).map((key) => [key, target.usage[key] + values[key]]));
  const rootUsage = Object.fromEntries(Object.keys(values).map((key) => [key, run.usage[key] + values[key]]));
  const phaseExceeded = phaseUsage.source_requests > target.max_source_requests
    || phaseUsage.openai_requests > target.max_openai_requests
    || phaseUsage.web_search_calls > target.max_web_search_calls
    || phaseUsage.cost_microusd > target.budget_cap_microusd;
  const rootExceeded = rootUsage.source_requests > run.plan_snapshot.max_source_requests
    || rootUsage.openai_requests > run.plan_snapshot.max_openai_requests
    || rootUsage.web_search_calls > run.plan_snapshot.max_web_search_calls
    || rootUsage.cost_microusd > run.plan_snapshot.max_cost_microusd
    || rootUsage.candidates_seen > run.plan_snapshot.max_candidates
    || rootUsage.results_accepted > run.plan_snapshot.max_results;
  if (phaseExceeded || rootExceeded) throw new Error("ULTRA_MAX_HARD_CAP_EXCEEDED");
  return withStatus(run, "RUNNING", nowIso, {
    usage:rootUsage,
    plan_snapshot:{
      ...run.plan_snapshot,
      phases:run.plan_snapshot.phases.map((item) => item.phase_id === phaseId ? { ...item, usage:phaseUsage } : item)
    }
  });
}

export function completeUltraMaxPhase(run, phaseId, nowIso) {
  validateTimestamp(nowIso);
  if (run?.status !== "RUNNING" || run.current_phase_id !== phaseId) throw new Error("ULTRA_MAX_PHASE_NOT_RUNNING");
  const phases = run.plan_snapshot.phases.map((item) => item.phase_id === phaseId ? {
    ...item,
    status:"COMPLETED",
    completed_at:nowIso,
    chunks_completed:item.chunks_completed + 1,
    checkpoint:null
  } : item);
  const complete = phases.every((item) => item.status === "COMPLETED");
  return withStatus(run, complete ? "COMPLETED" : "RUNNING", nowIso, {
    current_phase_id:null,
    completed_at:complete ? nowIso : null,
    completion_reason:complete ? "ALL_PHASES_COMPLETE" : "PHASE_COMPLETE",
    plan_snapshot:{ ...run.plan_snapshot, phases }
  });
}

export function cancelUltraMaxRun(run, nowIso) {
  validateTimestamp(nowIso);
  if (["COMPLETED", "CANCELLED", "UNCERTAIN"].includes(run?.status)) return run;
  return withStatus(run, "CANCELLED", nowIso, {
    cancel_requested_at:run.cancel_requested_at || nowIso,
    completed_at:nowIso,
    current_phase_id:null,
    completion_reason:"USER_CANCELLED"
  });
}
