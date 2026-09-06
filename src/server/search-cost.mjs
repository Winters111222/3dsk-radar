export const SEARCH_PRICING_BASIS = "OpenAI public API pricing snapshot 2026-09-05";
export const WEB_SEARCH_USD_PER_CALL = 0.01;

// USD per 1M text tokens. Update this single table when OpenAI pricing changes.
export const MODEL_PRICING_USD_PER_1M = Object.freeze({
  "gpt-5.6-luna": Object.freeze({ input: 0.20, cached_input: 0.02, output: 1.20, long_context_threshold:272_000, long_input_multiplier:2, long_output_multiplier:1.5 }),
  "gpt-5.6-terra": Object.freeze({ input: 2.00, cached_input: 0.20, output: 12.00 }),
  "gpt-5.6-sol": Object.freeze({ input: 4.00, cached_input: 0.40, output: 20.00 })
});

function nonNegativeInt(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

export function normalizedUsage(usage) {
  const inputTokens = nonNegativeInt(usage?.input_tokens);
  const cachedTokens = Math.min(inputTokens, nonNegativeInt(usage?.input_tokens_details?.cached_tokens));
  const outputTokens = nonNegativeInt(usage?.output_tokens);
  return {
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    total_tokens: inputTokens + outputTokens,
    input_tokens_details: { cached_tokens: cachedTokens }
  };
}

export function addUsage(total, usage) {
  const left = normalizedUsage(total);
  const right = normalizedUsage(usage);
  return {
    input_tokens: left.input_tokens + right.input_tokens,
    output_tokens: left.output_tokens + right.output_tokens,
    total_tokens: left.total_tokens + right.total_tokens,
    input_tokens_details: {
      cached_tokens: left.input_tokens_details.cached_tokens + right.input_tokens_details.cached_tokens
    }
  };
}

export function countWebSearchCalls(response) {
  return Array.isArray(response?.output)
    ? response.output.filter((item) => item?.type === "web_search_call").length
    : 0;
}

export function estimateSearchCost({ model, usage, webSearchCalls = 0 }) {
  const pricing = MODEL_PRICING_USD_PER_1M[model];
  if (!pricing) return null;

  const normalized = normalizedUsage(usage);
  const cachedTokens = normalized.input_tokens_details.cached_tokens;
  const uncachedTokens = Math.max(0, normalized.input_tokens - cachedTokens);
  const webCalls = nonNegativeInt(webSearchCalls);
  const longContext = Number.isFinite(pricing.long_context_threshold) && normalized.input_tokens > pricing.long_context_threshold;
  const inputMultiplier = longContext ? pricing.long_input_multiplier : 1;
  const outputMultiplier = longContext ? pricing.long_output_multiplier : 1;

  const uncachedInputUsd = uncachedTokens * pricing.input * inputMultiplier / 1_000_000;
  const cachedInputUsd = cachedTokens * pricing.cached_input * inputMultiplier / 1_000_000;
  const outputUsd = normalized.output_tokens * pricing.output * outputMultiplier / 1_000_000;
  const webSearchUsd = webCalls * WEB_SEARCH_USD_PER_CALL;
  const tokenUsd = uncachedInputUsd + cachedInputUsd + outputUsd;
  const totalUsd = tokenUsd + webSearchUsd;

  return {
    is_estimate: true,
    currency: "USD",
    total_usd: Number(totalUsd.toFixed(6)),
    token_usd: Number(tokenUsd.toFixed(6)),
    web_search_usd: Number(webSearchUsd.toFixed(6)),
    web_search_call_count: webCalls,
    input_tokens: normalized.input_tokens,
    cached_input_tokens: cachedTokens,
    output_tokens: normalized.output_tokens,
    total_tokens: normalized.total_tokens,
    pricing_tier: longContext ? "LONG_CONTEXT" : "SHORT_CONTEXT",
    pricing_basis: SEARCH_PRICING_BASIS
  };
}
