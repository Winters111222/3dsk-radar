import { callOpenAIResponses } from "./openai-search.mjs";
import { extractOutputText } from "./normalize.mjs";
import { approvedProfile, buildReplyRequest } from "./reply-contract.mjs";

export function parseReplyResponse(response, profile) {
  const text = extractOutputText(response);
  if (!text) throw new Error("OpenAI response contained no reply output");
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error("Reply structured output was not valid JSON"); }
  if (!parsed?.subject || !parsed?.body || !Array.isArray(parsed.used_capability_ids) || !Array.isArray(parsed.used_credential_ids)) throw new Error("Reply output is missing required fields");
  const safe = approvedProfile(profile);
  const capabilityIds = new Set(safe.capabilities.map((x) => x.id));
  const credentialIds = new Set(safe.credentials.map((x) => x.id));
  for (const id of parsed.used_capability_ids) if (!capabilityIds.has(id)) throw new Error(`Reply referenced unapproved capability: ${id}`);
  for (const id of parsed.used_credential_ids) if (!credentialIds.has(id)) throw new Error(`Reply referenced unapproved credential: ${id}`);
  const words = parsed.body.trim().split(/\s+/).filter(Boolean).length;
  if (words < 80 || words > 280) throw new Error(`Reply body length out of safe range: ${words} words`);
  return { subject: parsed.subject.trim(), body: parsed.body.trim(), used_capability_ids: parsed.used_capability_ids, used_credential_ids: parsed.used_credential_ids };
}

export async function runReplyGeneration({ apiKey, model, profile, opportunity, fetchImpl = fetch, allowStructuredRetry = true }) {
  let lastError;
  const attempts = allowStructuredRetry ? 2 : 1;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const raw = await callOpenAIResponses({ apiKey, body: buildReplyRequest({ profile, opportunity, model, retry: attempt === 1 }), fetchImpl, timeoutMs: 52000 });
    try {
      const reply = parseReplyResponse(raw, profile);
      return { ...reply, model: raw?.model || model, response_id: raw?.id || null, usage: raw?.usage || null, attempts: attempt + 1 };
    } catch (error) { lastError = error; }
  }
  const error = new Error(`Structured reply validation failed: ${lastError?.message || "unknown error"}`);
  error.code = "REPLY_SCHEMA_VALIDATION_FAILED";
  throw error;
}
