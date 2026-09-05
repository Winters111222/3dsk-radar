const TERMINAL_STATUSES = new Set(["COMPLETED", "CANCELLED", "UNCERTAIN"]);

function finite(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function ratio(value, maximum) {
  return maximum > 0 ? Math.max(0, Math.min(1, value / maximum)) : 0;
}

export function isTerminalSourceRun(run) {
  return TERMINAL_STATUSES.has(run?.status);
}

export function sourceRunProgress(run) {
  if (!run) return {
    services:{ value:0, maximum:0, ratio:0 },
    pages:{ value:0, maximum:0, ratio:0 },
    candidates:{ value:0, maximum:0, ratio:0 },
    reviews:{ value:0, maximum:0, ratio:0 }
  };
  const counters = run.counters || {};
  const plan = run.plan_snapshot || {};
  const services = finite(counters.source_services_completed) + finite(counters.source_services_failed) + finite(counters.source_services_blocked);
  const serviceMaximum = finite(counters.source_services_planned);
  const pages = finite(counters.total_pages_fetched);
  const pageMaximum = finite(plan.max_total_pages);
  const candidates = finite(counters.candidates_accepted);
  const candidateMaximum = finite(plan.max_candidates);
  const reviews = finite(counters.candidates_promoted) + finite(counters.candidates_rejected_truth) + finite(counters.candidates_blocked_detail);
  return {
    services:{ value:services, maximum:serviceMaximum, ratio:ratio(services, serviceMaximum) },
    pages:{ value:pages, maximum:pageMaximum, ratio:ratio(pages, pageMaximum) },
    candidates:{ value:candidates, maximum:candidateMaximum, ratio:ratio(candidates, candidateMaximum) },
    reviews:{ value:reviews, maximum:candidates, ratio:ratio(reviews, candidates) }
  };
}

export function sourceCandidateView(candidate) {
  const record = candidate?.primary_record || {};
  return {
    candidate_id:candidate?.candidate_id || null,
    title:record.title || "Untitled source record",
    buyers:Array.isArray(record.buyer_names) ? record.buyer_names.filter(Boolean) : [],
    source_id:record.source_id || "unknown",
    source_url:typeof record.canonical_url === "string" && record.canonical_url.startsWith("https://") ? record.canonical_url : null,
    observed_date:record.source_updated_date || record.publication_date || record.published_date || null,
    suggested_categories:Array.isArray(record.suggested_categories) ? record.suggested_categories.filter(Boolean).slice(0, 6) : [],
    reference_count:Array.isArray(candidate?.source_references) ? candidate.source_references.length : 0,
    review_state:candidate?.review_state || "RAW_CANDIDATE",
    rejection_reason:candidate?.rejection_reason || null,
    promoted_opportunity_id:candidate?.promoted_opportunity_id || null
  };
}

export async function continueSourceRunLoop({
  initialRun,
  continueChunk,
  onUpdate = async () => {},
  shouldStop = () => false,
  wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  makeOperationId,
  maxChunks = 25,
  maxTransientRetries = 3,
  now = () => Date.now()
} = {}) {
  if (!initialRun?.run_id || typeof continueChunk !== "function" || typeof makeOperationId !== "function") {
    throw new Error("SOURCE_RUN_UI_DEPENDENCY_MISSING");
  }
  let run = initialRun;
  let chunks = 0;
  while (!isTerminalSourceRun(run) && chunks < maxChunks && !shouldStop()) {
    if (run.completion_reason === "RETRY_WAIT") {
      const detailRetryReady = run.next_retry_at && Date.parse(run.next_retry_at) <= now();
      const retryReady = detailRetryReady || (run.work_items || []).some((item) => item.status === "PENDING" || (item.status === "RETRYABLE" && Date.parse(item.not_before || 0) <= now()));
      if (!retryReady) return { run, chunks, reason:"RETRY_WAIT" };
    }
    const operationId = makeOperationId();
    let transientRetries = 0;
    let payload;
    while (true) {
      try {
        payload = await continueChunk(run.run_id, operationId);
        break;
      } catch (error) {
        const transient = error?.code === "SOURCE_RUN_RATE_LIMITED" || error?.code === "SOURCE_RUN_OPERATION_IN_PROGRESS";
        if (!transient || transientRetries >= maxTransientRetries || shouldStop()) throw error;
        transientRetries += 1;
        await wait(Math.max(1, finite(error.retryAfterSeconds) || 2) * 1000);
      }
    }
    run = payload.run;
    chunks += 1;
    await onUpdate(payload, chunks);
  }
  const reason = shouldStop() ? "STOP_REQUESTED" : isTerminalSourceRun(run) ? run.status : "UI_CHUNK_CAP_REACHED";
  return { run, chunks, reason };
}
