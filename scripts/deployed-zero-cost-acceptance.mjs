import { pathToFileURL } from "node:url";

export const LOCKED_ACCEPTANCE_CONFIRMATION = "I_APPROVE_LOCKED_ZERO_COST_ACCEPTANCE";
const MAX_JSON_BYTES = 65_536;
export const ACCEPTANCE_HTTP_TIMEOUT_MS = 45_000;

export function normalizedAcceptanceBaseUrl(value) {
  let url;
  try { url = new URL(value); }
  catch { throw new Error("ACCEPTANCE_BASE_URL_INVALID"); }
  const hostname = url.hostname.toLowerCase();
  const approvedHost = hostname === "3dsk-opportunity-radar.netlify.app" || hostname.endsWith("--3dsk-opportunity-radar.netlify.app");
  if (url.protocol !== "https:" || !approvedHost || url.username || url.password || url.port || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("ACCEPTANCE_BASE_URL_NOT_APPROVED");
  }
  return url.origin;
}

function expectedCommit(value) {
  const commit = String(value || "").trim().toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(commit)) throw new Error("ACCEPTANCE_EXPECTED_COMMIT_INVALID");
  return commit;
}

async function responseJson(response) {
  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > MAX_JSON_BYTES) throw new Error("ACCEPTANCE_RESPONSE_TOO_LARGE");
  try { return JSON.parse(text); }
  catch { throw new Error("ACCEPTANCE_RESPONSE_INVALID_JSON"); }
}

async function requestJson(fetchImpl, url, options = {}) {
  let response;
  try {
    response = await fetchImpl(url, { ...options, redirect:"error", signal:AbortSignal.timeout(ACCEPTANCE_HTTP_TIMEOUT_MS) });
  } catch (error) {
    if (error?.name === "TimeoutError") throw new Error(`ACCEPTANCE_HTTP_TIMEOUT:${new URL(url).pathname}`);
    throw error;
  }
  return { status:response.status, payload:await responseJson(response) };
}

export async function runLockedDeployedAcceptance({ baseUrl, commitRef, accessCode, fetchImpl = fetch, onProgress = () => {} } = {}) {
  const base = normalizedAcceptanceBaseUrl(baseUrl);
  const commit = expectedCommit(commitRef);
  if (typeof accessCode !== "string" || !accessCode.trim()) throw new Error("ACCEPTANCE_ACCESS_CODE_REQUIRED");

  let requestCount = 0;
  const request = async (path, options = {}) => {
    const requestIndex = ++requestCount;
    const method = options.method || "GET";
    onProgress({ request_index:requestIndex, method, path, state:"started" });
    try {
      const result = await requestJson(fetchImpl, `${base}${path}`, options);
      onProgress({ request_index:requestIndex, method, path, state:"completed", status:result.status });
      return result;
    } catch (error) {
      onProgress({ request_index:requestIndex, method, path, state:"failed", error_code:String(error?.message || "ACCEPTANCE_HTTP_FAILED").slice(0,120) });
      throw error;
    }
  };

  const metadata = await request("/build-metadata.json");
  if (metadata.status !== 200 || metadata.payload?.schema_version !== 2 || metadata.payload?.service !== "3dsk-opportunity-radar" || metadata.payload?.commit_ref !== commit || metadata.payload?.acceptance_profile !== "LOCKED_ZERO_COST" || metadata.payload?.artifact_provenance !== "CI_TESTED_SOURCE") {
    throw new Error("ACCEPTANCE_DEPLOY_IDENTITY_MISMATCH");
  }
  const health = await request("/api/health");
  if (health.status !== 200 || health.payload?.service !== "3dsk-opportunity-radar" || health.payload?.paid_ai_state !== "LOCKED" || health.payload?.live_ai_enabled !== false || health.payload?.source_collection !== "LOCKED" || health.payload?.access_configured !== true) {
    throw new Error("ACCEPTANCE_HEALTH_BOUNDARY_FAILED");
  }

  const headers = { authorization:`Bearer ${accessCode.trim()}`, "content-type":"application/json" };
  const checks = [];
  for (const [path, body, expectedCode] of [
    ["/api/search", {}, "LIVE_AI_LOCKED"],
    ["/api/generate-response", {}, "LIVE_AI_LOCKED"],
    ["/api/source-runs", { action:"START", profile_id:"FOCUSED", request_id:"deployed_lock_check" }, "SOURCE_COLLECTION_LOCKED"]
  ]) {
    const result = await request(path, { method:"POST", headers, body:JSON.stringify(body) });
    if (result.status !== 423 || result.payload?.error?.code !== expectedCode) throw new Error(`ACCEPTANCE_LOCK_FAILED:${path}`);
    checks.push({ path, status:result.status, code:expectedCode });
  }
  return {
    ok:true,
    base_url:base,
    commit_ref:commit,
    deploy_context:metadata.payload.deploy_context || null,
    paid_ai_state:"LOCKED",
    source_collection:"LOCKED",
    network_requests:requestCount,
    source_requests:0,
    openai_requests:0,
    writes:0,
    retries:0,
    checks
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  if (process.env.RADAR_LOCKED_ACCEPTANCE_CONFIRMATION !== LOCKED_ACCEPTANCE_CONFIRMATION) throw new Error("LOCKED_ACCEPTANCE_CONFIRMATION_REQUIRED");
  const result = await runLockedDeployedAcceptance({
    baseUrl:process.env.RADAR_ACCEPTANCE_BASE_URL,
    commitRef:process.env.RADAR_EXPECTED_COMMIT,
    accessCode:process.env.RADAR_ACCEPTANCE_ACCESS_CODE,
    onProgress:event => console.error(`[acceptance] ${JSON.stringify(event)}`)
  });
  console.log(JSON.stringify(result, null, 2));
}
