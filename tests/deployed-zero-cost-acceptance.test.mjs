import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { normalizedAcceptanceBaseUrl, runLockedDeployedAcceptance } from "../scripts/deployed-zero-cost-acceptance.mjs";

const BASE = "https://deploy-preview-20--3dsk-opportunity-radar.netlify.app";
const COMMIT = "b".repeat(40);

function transport({ commit = COMMIT, provenance = "CI_TESTED_SOURCE", live = false, source = "LOCKED" } = {}) {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, options });
    const path = new URL(url).pathname;
    if (path === "/build-metadata.json") return Response.json({ schema_version:2, service:"3dsk-opportunity-radar", commit_ref:commit, deploy_context:"deploy-preview", acceptance_profile:"LOCKED_ZERO_COST", artifact_provenance:provenance });
    if (path === "/api/health") return Response.json({ service:"3dsk-opportunity-radar", paid_ai_state:live ? "ENABLED" : "LOCKED", live_ai_enabled:live, source_collection:source, access_configured:true });
    const code = path === "/api/source-runs" ? "SOURCE_COLLECTION_LOCKED" : "LIVE_AI_LOCKED";
    return Response.json({ ok:false, error:{ code } }, { status:423 });
  };
  return { calls, fetchImpl };
}

test("locked deployed acceptance verifies identity before three non-dispatching lock probes", async () => {
  const mock = transport();
  const progress = [];
  const result = await runLockedDeployedAcceptance({ baseUrl:BASE, commitRef:COMMIT, accessCode:"secret-never-returned", fetchImpl:mock.fetchImpl, onProgress:event => progress.push(event) });
  assert.equal(result.ok, true);
  assert.equal(result.source_requests, 0);
  assert.equal(result.openai_requests, 0);
  assert.equal(result.writes, 0);
  assert.equal(result.retries, 0);
  assert.equal(mock.calls.length, 5);
  assert.equal(progress.filter(event => event.state === "started").length, 5);
  assert.equal(progress.filter(event => event.state === "completed").length, 5);
  assert.equal(mock.calls[0].options.method, undefined);
  assert.equal(mock.calls[1].options.method, undefined);
  assert.ok(mock.calls.slice(2).every((call) => call.options.headers.authorization === "Bearer secret-never-returned"));
  assert.doesNotMatch(JSON.stringify(result), /secret-never-returned/);
});

test("timeout reports the exact path and initiated request count without retry", async () => {
  const progress = [];
  const fetchImpl = async () => { throw new DOMException("timed out", "TimeoutError"); };
  await assert.rejects(
    () => runLockedDeployedAcceptance({ baseUrl:BASE, commitRef:COMMIT, accessCode:"secret", fetchImpl, onProgress:event => progress.push(event) }),
    /ACCEPTANCE_HTTP_TIMEOUT:\/build-metadata\.json/
  );
  assert.deepEqual(progress, [
    { request_index:1, method:"GET", path:"/build-metadata.json", state:"started" },
    { request_index:1, method:"GET", path:"/build-metadata.json", state:"failed", error_code:"ACCEPTANCE_HTTP_TIMEOUT:/build-metadata.json" }
  ]);
});

test("identity or unlocked health fails before any protected POST", async () => {
  const wrongCommit = transport({ commit:"c".repeat(40) });
  await assert.rejects(() => runLockedDeployedAcceptance({ baseUrl:BASE, commitRef:COMMIT, accessCode:"secret", fetchImpl:wrongCommit.fetchImpl }), /ACCEPTANCE_DEPLOY_IDENTITY_MISMATCH/);
  assert.equal(wrongCommit.calls.length, 1);

  const unsealed = transport({ provenance:"DIRECT_BUILD" });
  await assert.rejects(() => runLockedDeployedAcceptance({ baseUrl:BASE, commitRef:COMMIT, accessCode:"secret", fetchImpl:unsealed.fetchImpl }), /ACCEPTANCE_DEPLOY_IDENTITY_MISMATCH/);
  assert.equal(unsealed.calls.length, 1);

  const unlocked = transport({ live:true });
  await assert.rejects(() => runLockedDeployedAcceptance({ baseUrl:BASE, commitRef:COMMIT, accessCode:"secret", fetchImpl:unlocked.fetchImpl }), /ACCEPTANCE_HEALTH_BOUNDARY_FAILED/);
  assert.equal(unlocked.calls.length, 2);
});

test("acceptance URL is restricted to the exact Radar Netlify site family", () => {
  assert.equal(normalizedAcceptanceBaseUrl("https://3dsk-opportunity-radar.netlify.app/"), "https://3dsk-opportunity-radar.netlify.app");
  assert.equal(normalizedAcceptanceBaseUrl(`${BASE}/`), BASE);
  for (const value of ["http://3dsk-opportunity-radar.netlify.app/", "https://evil.example/", "https://3dsk-opportunity-radar.netlify.app/path", "https://user:pass@3dsk-opportunity-radar.netlify.app/"]) {
    assert.throws(() => normalizedAcceptanceBaseUrl(value), /ACCEPTANCE_BASE_URL_NOT_APPROVED/);
  }
});

test("CLI refuses to open the network without the exact one-time confirmation", () => {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL("../scripts/deployed-zero-cost-acceptance.mjs", import.meta.url))], {
    encoding:"utf8",
    env:{ ...process.env, RADAR_LOCKED_ACCEPTANCE_CONFIRMATION:"NOT_APPROVED", RADAR_ACCEPTANCE_BASE_URL:BASE, RADAR_EXPECTED_COMMIT:COMMIT, RADAR_ACCEPTANCE_ACCESS_CODE:"fixture-secret" }
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /LOCKED_ACCEPTANCE_CONFIRMATION_REQUIRED/);
});
