export class CollectorError extends Error {
  constructor(code, message, { status = 502, upstreamStatus = null, retryAfterSeconds = null } = {}) {
    super(message);
    this.name = "CollectorError";
    this.code = code;
    this.status = status;
    this.upstreamStatus = upstreamStatus;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export function boundedCollectorInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
}

export function assertCollectorResult(result) {
  if (!result || typeof result !== "object") throw new CollectorError("COLLECTOR_RESULT_INVALID", "Collector returned no result.");
  if (!Array.isArray(result.records)) throw new CollectorError("COLLECTOR_RESULT_INVALID", "Collector result is missing records[].");
  if (!result.counters || typeof result.counters !== "object") throw new CollectorError("COLLECTOR_RESULT_INVALID", "Collector result is missing counters.");
  if (result.counters.openai_requests !== 0 || result.counters.cost_usd !== 0) {
    throw new CollectorError("COLLECTOR_COST_BOUNDARY_FAILED", "Read-only collection must report zero OpenAI requests and zero AI cost.", { status:500 });
  }
  return result;
}
