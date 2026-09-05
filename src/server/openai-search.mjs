import { buildOpenAIRequest } from "./search-contract.mjs";
import { normalizeSearchResponse } from "./normalize.mjs";

export const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

function safeApiError(payload, status) {
  const code = payload?.error?.code || payload?.error?.type || `HTTP_${status}`;
  const message = payload?.error?.message || "OpenAI request failed";
  return { code: String(code).slice(0, 120), message: String(message).slice(0, 500) };
}

export async function callOpenAIResponses({ apiKey, body, fetchImpl = fetch, timeoutMs = 52000 }) {
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
  const response = await fetchImpl(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs)
  });

  let payload = null;
  try { payload = await response.json(); } catch { payload = null; }
  if (!response.ok) {
    const safe = safeApiError(payload, response.status);
    const error = new Error(safe.message);
    error.code = safe.code;
    error.status = response.status;
    throw error;
  }
  return payload;
}

export async function runOpportunitySearch({
  apiKey,
  model,
  profile,
  nowIso,
  maxResults = 12,
  fetchImpl = fetch,
  allowStructuredRetry = true
}) {
  let lastError;
  const attempts = allowStructuredRetry ? 2 : 1;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const requestBody = buildOpenAIRequest({
      profile,
      nowIso,
      maxResults,
      model,
      retry: attempt === 1
    });
    const raw = await callOpenAIResponses({ apiKey, body: requestBody, fetchImpl });
    try {
      const normalized = normalizeSearchResponse(raw, { nowIso, maxResults });
      return {
        ...normalized,
        model: raw?.model || model,
        response_id: raw?.id || null,
        usage: raw?.usage || null,
        attempts: attempt + 1
      };
    } catch (error) {
      lastError = error;
      if (attempt + 1 >= attempts) break;
    }
  }

  const error = new Error(`Structured search validation failed: ${lastError?.message || "unknown error"}`);
  error.code = "SEARCH_SCHEMA_VALIDATION_FAILED";
  throw error;
}
