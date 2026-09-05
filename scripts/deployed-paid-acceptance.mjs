import { pathToFileURL } from "node:url";

export const PAID_ACCEPTANCE_CONFIRMATION = "I_APPROVE_SINGLE_PAID_FOCUSED_ACCEPTANCE";
export const PAID_ACCEPTANCE_MAX_USD = 0.50;
const MAX_JSON_BYTES = 1_048_576;

export function normalizedPaidAcceptanceBaseUrl(value) {
  let url;
  try { url = new URL(value); }
  catch { throw new Error("PAID_ACCEPTANCE_BASE_URL_INVALID"); }
  const approvedHost = /^[0-9a-f]{24}--3dsk-opportunity-radar\.netlify\.app$/i.test(url.hostname);
  if (url.protocol !== "https:" || !approvedHost || url.username || url.password || url.port || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("PAID_ACCEPTANCE_IMMUTABLE_PREVIEW_REQUIRED");
  }
  return url.origin;
}

function exactCommit(value) {
  const commit = String(value || "").trim().toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(commit)) throw new Error("PAID_ACCEPTANCE_EXPECTED_COMMIT_INVALID");
  return commit;
}

function exactId(value, code) {
  const id = String(value || "").trim();
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(id)) throw new Error(code);
  return id;
}

async function responseJson(response) {
  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > MAX_JSON_BYTES) throw new Error("PAID_ACCEPTANCE_RESPONSE_TOO_LARGE");
  try { return JSON.parse(text); }
  catch { throw new Error("PAID_ACCEPTANCE_RESPONSE_INVALID_JSON"); }
}

export async function runPaidDeployedAcceptance({
  baseUrl,
  commitRef,
  accessCode,
  runId,
  testId,
  fetchImpl = fetch,
  onProgress = () => {}
} = {}) {
  const base = normalizedPaidAcceptanceBaseUrl(baseUrl);
  const commit = exactCommit(commitRef);
  const authorizedRunId = exactId(runId, "PAID_ACCEPTANCE_RUN_ID_INVALID");
  const coordinatorTestId = exactId(testId, "PAID_ACCEPTANCE_TEST_ID_INVALID");
  if (typeof accessCode !== "string" || !accessCode.trim()) throw new Error("PAID_ACCEPTANCE_ACCESS_CODE_REQUIRED");

  const requests = [];
  const request = async (path, options = {}) => {
    const index = requests.length + 1;
    const method = options.method || "GET";
    onProgress({ request_index:index, method, path, state:"started" });
    let response;
    try {
      response = await fetchImpl(`${base}${path}`, {
        ...options,
        redirect:"error",
        signal:AbortSignal.timeout(method === "POST" && path === "/api/search" ? 70_000 : 45_000)
      });
    } catch (error) {
      onProgress({ request_index:index, method, path, state:"failed", error_code:String(error?.message || "PAID_ACCEPTANCE_HTTP_FAILED").slice(0, 120) });
      throw error;
    }
    requests.push({ index, method, path, status:response.status });
    onProgress({ request_index:index, method, path, state:"completed", status:response.status });
    return { status:response.status, payload:await responseJson(response) };
  };

  const metadata = await request("/build-metadata.json");
  if (metadata.status !== 200 || metadata.payload?.schema_version !== 2 || metadata.payload?.service !== "3dsk-opportunity-radar" || metadata.payload?.commit_ref?.toLowerCase() !== commit || metadata.payload?.deploy_context !== "deploy-preview" || metadata.payload?.acceptance_profile !== "PAID_FOCUSED" || metadata.payload?.artifact_provenance !== "NETLIFY_GIT_DEPLOY") {
    throw new Error("PAID_ACCEPTANCE_DEPLOY_IDENTITY_MISMATCH");
  }

  const health = await request("/api/health");
  if (health.status !== 200 || health.payload?.service !== "3dsk-opportunity-radar" || health.payload?.stage !== "phase-e-paid-acceptance" || health.payload?.live_ai_enabled !== false || health.payload?.paid_ai_state !== "LOCKED" || health.payload?.paid_acceptance !== "ARMED" || health.payload?.paid_coordinator !== "NETLIFY_DATABASE" || health.payload?.source_collection !== "LOCKED" || health.payload?.access_configured !== true) {
    throw new Error("PAID_ACCEPTANCE_HEALTH_BOUNDARY_FAILED");
  }

  const headers = { authorization:`Bearer ${accessCode.trim()}`, "content-type":"application/json" };
  const coordinator = await request("/api/paid-coordinator-acceptance", {
    method:"POST",
    headers,
    body:JSON.stringify({ test_id:coordinatorTestId })
  });
  if (coordinator.status !== 200 || coordinator.payload?.ok !== true || coordinator.payload?.concurrent_claim_winners !== 1 || coordinator.payload?.concurrent_budget_winners !== 1 || coordinator.payload?.idempotent_settlement !== true || coordinator.payload?.openai_requests !== 0 || coordinator.payload?.source_requests !== 0 || coordinator.payload?.cost_usd !== 0) {
    throw new Error("PAID_COORDINATOR_DEPLOYED_ACCEPTANCE_FAILED");
  }

  const search = await request("/api/search", {
    method:"POST",
    headers,
    body:JSON.stringify({ run_id:authorizedRunId, operation_id:"focused-search", max_cost_usd:PAID_ACCEPTANCE_MAX_USD, no_retry:true })
  });
  if (search.status !== 200 || search.payload?.ok !== true) {
    throw new Error(`PAID_SEARCH_FAILED:${search.payload?.error?.code || search.status}`);
  }

  const paid = search.payload?.run?.paid_acceptance;
  if (search.payload?.replayed !== false || search.payload?.run?.model !== "gpt-5.6-luna" || search.payload?.run?.attempts !== 1 || paid?.openai_requests !== 1 || paid?.source_requests !== 0 || paid?.retries !== 0 || search.payload?.run?.web_search_call_count > 3 || Number(search.payload?.run?.estimated_cost_usd) > PAID_ACCEPTANCE_MAX_USD) {
    throw new Error("PAID_ACCEPTANCE_RESULT_BOUNDARY_FAILED");
  }

  return {
    ok:true,
    base_url:base,
    commit_ref:commit,
    deploy_context:metadata.payload.deploy_context,
    operational_http_requests:requests.length,
    openai_requests:1,
    hosted_web_search_calls:search.payload.run.web_search_call_count,
    direct_source_requests:0,
    writes:{ coordinator:"ISOLATED_PREVIEW_DATABASE", opportunities:"ISOLATED_PREVIEW_BLOBS" },
    retries:0,
    max_cost_usd:PAID_ACCEPTANCE_MAX_USD,
    estimated_cost_usd:search.payload.run.estimated_cost_usd,
    returned_count:search.payload.run.returned_count,
    verified_source_count:search.payload.run.verified_source_count,
    opportunities:search.payload.opportunities.map((item) => ({
      title:item.title,
      company:item.company,
      opportunity_kind:item.opportunity_kind,
      fit_score:item.fit_score,
      win_score:item.win_score,
      source_url:item.source_url
    }))
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  if (process.env.RADAR_PAID_ACCEPTANCE_CONFIRMATION !== PAID_ACCEPTANCE_CONFIRMATION) throw new Error("PAID_ACCEPTANCE_CONFIRMATION_INVALID");
  const result = await runPaidDeployedAcceptance({
    baseUrl:process.env.RADAR_ACCEPTANCE_BASE_URL,
    commitRef:process.env.RADAR_EXPECTED_COMMIT,
    accessCode:process.env.RADAR_ACCEPTANCE_ACCESS_CODE,
    runId:process.env.RADAR_PAID_ACCEPTANCE_RUN_ID,
    testId:process.env.RADAR_PAID_ACCEPTANCE_TEST_ID,
    onProgress:event => console.error(`[paid-acceptance] ${JSON.stringify(event)}`)
  });
  console.log(JSON.stringify(result, null, 2));
}
