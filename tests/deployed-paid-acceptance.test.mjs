import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { normalizedPaidAcceptanceBaseUrl, runPaidDeployedAcceptance } from "../scripts/deployed-paid-acceptance.mjs";

const BASE = "https://a1b2c3d4e5f60718293a4b5c--3dsk-opportunity-radar.netlify.app";
const COMMIT = "a".repeat(40);

function transport({ commit = COMMIT, deployContext = "deploy-preview" } = {}) {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, options });
    const path = new URL(url).pathname;
    if (path === "/build-metadata.json") return Response.json({ schema_version:2, service:"3dsk-opportunity-radar", commit_ref:commit, deploy_context:deployContext, acceptance_profile:"PAID_FOCUSED", artifact_provenance:"NETLIFY_GIT_DEPLOY" });
    if (path === "/api/health") return Response.json({ service:"3dsk-opportunity-radar", stage:"phase-e-paid-acceptance", live_ai_enabled:false, paid_ai_state:"LOCKED", paid_acceptance:"ARMED", paid_coordinator:"NETLIFY_DATABASE", source_collection:"LOCKED", access_configured:true });
    if (path === "/api/paid-coordinator-acceptance") return Response.json({ ok:true, concurrent_claim_winners:1, concurrent_budget_winners:1, idempotent_settlement:true, openai_requests:0, source_requests:0, cost_usd:0 });
    return Response.json({
      ok:true,
      replayed:false,
      opportunities:[{ title:"Safe opportunity", company:"Buyer", opportunity_kind:"OPEN_OPPORTUNITY", fit_score:90, win_score:80, source_url:"https://buyer.example/opportunity" }],
      run:{
        model:"gpt-5.6-luna",
        attempts:1,
        web_search_call_count:1,
        estimated_cost_usd:0.02,
        returned_count:1,
        verified_source_count:1,
        diagnostics:{
          schema_version:1,
          privacy:"AGGREGATED_COUNTS_ONLY",
          zero_result_reason:null,
          rejection_reasons:{},
          source_yield:["upwork","freelancer","reddit_gamedevclassifieds","unreal_job_offerings","polycount_paid"].map((source_id,index)=>({source_id,source_label:source_id,consulted_urls:index===0?1:0,eligible_detail_urls:index===0?1:0,candidates_seen:index===0?1:0,candidates_accepted:index===0?1:0,candidates_rejected:0,duplicates_removed:0,returned:index===0?1:0}))
        },
        paid_acceptance:{ openai_requests:1, source_requests:0, retries:0 }
      }
    });
  };
  return { calls, fetchImpl };
}

test("paid deployed acceptance makes exactly four bounded requests and returns no access code", async () => {
  const mock = transport();
  const progress = [];
  const result = await runPaidDeployedAcceptance({
    baseUrl:BASE,
    commitRef:COMMIT,
    accessCode:"secret-never-returned",
    runId:"paid-run-001",
    testId:"atomic-test-001",
    fetchImpl:mock.fetchImpl,
    onProgress:event => progress.push(event)
  });
  assert.equal(result.ok, true);
  assert.equal(result.operational_http_requests, 4);
  assert.equal(result.openai_requests, 1);
  assert.equal(result.hosted_web_search_calls, 1);
  assert.equal(result.direct_source_requests, 0);
  assert.equal(result.retries, 0);
  assert.equal(result.diagnostics.privacy,"AGGREGATED_COUNTS_ONLY");
  assert.equal(result.diagnostics.source_yield.find((item)=>item.source_id==="upwork").returned,1);
  assert.equal(mock.calls.length, 4);
  assert.equal(progress.filter((event) => event.state === "started").length, 4);
  assert.ok(mock.calls.slice(2).every((call) => call.options.headers.authorization === "Bearer secret-never-returned"));
  assert.doesNotMatch(JSON.stringify(result), /secret-never-returned/);
});

test("paid deployed acceptance stops on identity mismatch before authenticated requests", async () => {
  const mock = transport({ commit:"b".repeat(40) });
  await assert.rejects(() => runPaidDeployedAcceptance({ baseUrl:BASE, commitRef:COMMIT, accessCode:"secret", runId:"paid-run-001", testId:"atomic-test-001", fetchImpl:mock.fetchImpl }), /PAID_ACCEPTANCE_DEPLOY_IDENTITY_MISMATCH/);
  assert.equal(mock.calls.length, 1);
});

test("paid deployed acceptance rejects branch-deploy metadata before authenticated requests", async () => {
  const mock = transport({ deployContext:"branch-deploy" });
  await assert.rejects(() => runPaidDeployedAcceptance({ baseUrl:BASE, commitRef:COMMIT, accessCode:"secret", runId:"paid-run-001", testId:"atomic-test-001", fetchImpl:mock.fetchImpl }), /PAID_ACCEPTANCE_DEPLOY_IDENTITY_MISMATCH/);
  assert.equal(mock.calls.length, 1);
});

test("paid acceptance URL accepts only an immutable Radar deploy subdomain", () => {
  assert.equal(normalizedPaidAcceptanceBaseUrl(`${BASE}/`), BASE);
  for (const value of ["https://3dsk-opportunity-radar.netlify.app/", "https://deploy-preview-20--3dsk-opportunity-radar.netlify.app/", "http://a1b2c3d4e5f60718293a4b5c--3dsk-opportunity-radar.netlify.app/", `${BASE}/path`]) {
    assert.throws(() => normalizedPaidAcceptanceBaseUrl(value), /PAID_ACCEPTANCE_IMMUTABLE_PREVIEW_REQUIRED/);
  }
});

test("paid CLI refuses to open the network without exact one-time confirmation", () => {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL("../scripts/deployed-paid-acceptance.mjs", import.meta.url))], {
    encoding:"utf8",
    env:{ ...process.env, RADAR_PAID_ACCEPTANCE_CONFIRMATION:"NOT_APPROVED", RADAR_ACCEPTANCE_BASE_URL:BASE, RADAR_EXPECTED_COMMIT:COMMIT, RADAR_ACCEPTANCE_ACCESS_CODE:"fixture-secret", RADAR_PAID_ACCEPTANCE_RUN_ID:"paid-run-001", RADAR_PAID_ACCEPTANCE_TEST_ID:"atomic-test-001" }
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /PAID_ACCEPTANCE_CONFIRMATION_INVALID/);
});
