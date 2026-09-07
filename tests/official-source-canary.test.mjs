import test from "node:test";
import assert from "node:assert/strict";
import handler from "../netlify/functions/official-source-canary.mjs";
import { OFFICIAL_SOURCE_CANARY_CONFIRMATION, officialSourceCanaryConfiguration } from "../src/server/official-source-canary-policy.mjs";

const EPHEMERAL_TOKEN = "temporary-canary-token-0123456789abcdef";
const BRANCH = "audit/wide-v3-ephemeral-canary-auth-20260907";
const COMMIT = "6".repeat(40);
const DEPLOY_ID = "1234567890abcdef12345678";

function values(overrides = {}) {
  const env = {
    RADAR_INTERNAL_ACCESS_SECRET:"team-secret",
    RADAR_LIVE_AI_ENABLED:"false",
    RADAR_OFFICIAL_SOURCE_CANARY_ENABLED:"true",
    RADAR_OFFICIAL_SOURCE_CANARY_PROFILE:"BLUESKY_ONLY",
    RADAR_OFFICIAL_SOURCE_CANARY_MAX_REQUESTS:"1",
    RADAR_BLUESKY_SEARCH_ENABLED:"true",
    ...overrides
  };
  return (key) => env[key] || "";
}

function request(token = "team-secret", confirmation = OFFICIAL_SOURCE_CANARY_CONFIRMATION) {
  const headers = { "x-radar-official-source-confirmation":confirmation };
  if (token !== null) headers.authorization = `Bearer ${token}`;
  return new Request("https://radar.test/api/official-source-canary", {
    method:"POST",
    headers
  });
}

function branchDeployValues(overrides = {}) {
  return values({
    RADAR_OFFICIAL_SOURCE_CANARY_ACCESS_TOKEN:EPHEMERAL_TOKEN,
    RADAR_OFFICIAL_SOURCE_CANARY_BRANCH_DEPLOY_ENABLED:"true",
    NETLIFY:"true",
    CONTEXT:"branch-deploy",
    REPOSITORY_URL:"https://github.com/Winters111222/3dsk-radar",
    SITE_NAME:"3dsk-opportunity-radar",
    SITE_ID:"f390f4e9-12f5-4074-946e-c83f2d7fe20d",
    RADAR_OFFICIAL_SOURCE_CANARY_EXPECTED_BRANCH:BRANCH,
    RADAR_OFFICIAL_SOURCE_CANARY_EXPECTED_COMMIT:COMMIT,
    BRANCH,
    COMMIT_REF:COMMIT,
    DEPLOY_ID,
    DEPLOY_URL:`https://${DEPLOY_ID}--3dsk-opportunity-radar.netlify.app`,
    ...overrides
  });
}

async function withRuntime(getEnv, fetchImpl, callback) {
  const previousNetlify = globalThis.Netlify;
  const previousFetch = globalThis.__RADAR_TEST_OFFICIAL_SOURCE_FETCH__;
  globalThis.Netlify = { env:{ get:getEnv } };
  globalThis.__RADAR_TEST_OFFICIAL_SOURCE_FETCH__ = fetchImpl;
  try {
    return await callback();
  } finally {
    if (previousNetlify === undefined) delete globalThis.Netlify;
    else globalThis.Netlify = previousNetlify;
    if (previousFetch === undefined) delete globalThis.__RADAR_TEST_OFFICIAL_SOURCE_FETCH__;
    else globalThis.__RADAR_TEST_OFFICIAL_SOURCE_FETCH__ = previousFetch;
  }
}

test("canary policy is preview-only, exact-cap and live-AI locked", () => {
  assert.equal(officialSourceCanaryConfiguration({ context:{deploy:{context:"production"}}, getEnv:values() }).code, "OFFICIAL_SOURCE_CANARY_PREVIEW_REQUIRED");
  assert.equal(officialSourceCanaryConfiguration({ context:{deploy:{context:"deploy-preview"}}, getEnv:values({RADAR_LIVE_AI_ENABLED:"true"}) }).code, "OFFICIAL_SOURCE_CANARY_LIVE_AI_MUST_BE_LOCKED");
  assert.equal(officialSourceCanaryConfiguration({ context:{deploy:{context:"deploy-preview"}}, getEnv:values({RADAR_OFFICIAL_SOURCE_CANARY_MAX_REQUESTS:"2"}) }).code, "OFFICIAL_SOURCE_CANARY_REQUEST_LIMIT_INVALID");
});

test("branch-deploy fallback derives the immutable URL from read-only Netlify deploy provenance", () => {
  const context = {deploy:{context:"branch-deploy"}};
  const commit = "6".repeat(40);
  const branch = "audit/wide-v3-git-branch-canary-fallback-20260907";
  const deployId = "1234567890abcdef12345678";
  const deployUrl = `https://${deployId}--3dsk-opportunity-radar.netlify.app`;
  assert.equal(officialSourceCanaryConfiguration({ context, getEnv:values() }).code, "OFFICIAL_SOURCE_CANARY_BRANCH_DEPLOY_LOCKED");
  const base = {
    RADAR_OFFICIAL_SOURCE_CANARY_BRANCH_DEPLOY_ENABLED:"true",
    NETLIFY:"true",
    CONTEXT:"branch-deploy",
    REPOSITORY_URL:"https://github.com/Winters111222/3dsk-radar",
    SITE_NAME:"3dsk-opportunity-radar",
    SITE_ID:"f390f4e9-12f5-4074-946e-c83f2d7fe20d",
    RADAR_OFFICIAL_SOURCE_CANARY_EXPECTED_BRANCH:branch,
    RADAR_OFFICIAL_SOURCE_CANARY_EXPECTED_COMMIT:commit,
    BRANCH:branch,
    COMMIT_REF:commit,
    DEPLOY_ID:deployId,
    DEPLOY_URL:deployUrl
  };
  assert.equal(officialSourceCanaryConfiguration({ context, getEnv:values({...base, REPOSITORY_URL:""}) }).code, "OFFICIAL_SOURCE_CANARY_GIT_PROVENANCE_REQUIRED");
  assert.equal(officialSourceCanaryConfiguration({ context, getEnv:values({...base, SITE_ID:"wrong"}) }).code, "OFFICIAL_SOURCE_CANARY_GIT_PROVENANCE_REQUIRED");
  assert.equal(officialSourceCanaryConfiguration({ context, getEnv:values({...base, BRANCH:"wrong"}) }).code, "OFFICIAL_SOURCE_CANARY_BRANCH_MISMATCH");
  assert.equal(officialSourceCanaryConfiguration({ context, getEnv:values({...base, COMMIT_REF:"7".repeat(40)}) }).code, "OFFICIAL_SOURCE_CANARY_COMMIT_MISMATCH");
  assert.equal(officialSourceCanaryConfiguration({ context, getEnv:values({...base, DEPLOY_ID:""}) }).code, "OFFICIAL_SOURCE_CANARY_DEPLOY_URL_MISMATCH");
  assert.equal(officialSourceCanaryConfiguration({ context, getEnv:values({...base, DEPLOY_ID:"z".repeat(24)}) }).code, "OFFICIAL_SOURCE_CANARY_DEPLOY_URL_MISMATCH");
  assert.equal(officialSourceCanaryConfiguration({ context, getEnv:values({...base, DEPLOY_ID:"abcdefabcdefabcdefabcdef"}) }).code, "OFFICIAL_SOURCE_CANARY_DEPLOY_URL_MISMATCH");
  assert.equal(officialSourceCanaryConfiguration({ context, getEnv:values({...base, DEPLOY_URL:"https://branch--3dsk-opportunity-radar.netlify.app"}) }).code, "OFFICIAL_SOURCE_CANARY_DEPLOY_URL_MISMATCH");
  assert.equal(officialSourceCanaryConfiguration({ context, getEnv:values({...base, DEPLOY_URL:`https://${deployId}--wrong-site.netlify.app`}) }).code, "OFFICIAL_SOURCE_CANARY_DEPLOY_URL_MISMATCH");
  const ready = officialSourceCanaryConfiguration({ context, getEnv:values(base) });
  assert.equal(ready.ok, true);
  assert.deepEqual({context:ready.deploy_context, branch:ready.branch, commit_ref:ready.commit_ref, deploy_id:ready.deploy_id, deploy_url:ready.deploy_url, repository_url:ready.repository_url}, {context:"branch-deploy", branch, commit_ref:commit, deploy_id:deployId, deploy_url:deployUrl, repository_url:"https://github.com/Winters111222/3dsk-radar"});
});

test("Bluesky plus Mastodon profile requires an actually ready Mastodon adapter", () => {
  const configuration = officialSourceCanaryConfiguration({
    context:{deploy:{context:"deploy-preview"}},
    getEnv:values({ RADAR_OFFICIAL_SOURCE_CANARY_PROFILE:"BLUESKY_MASTODON", RADAR_OFFICIAL_SOURCE_CANARY_MAX_REQUESTS:"2" })
  });
  assert.equal(configuration.code, "OFFICIAL_SOURCE_CANARY_CONNECTOR_NOT_READY");
  assert.deepEqual(configuration.blocked_sources, ["mastodon_official"]);
});

test("temporary token performs exactly one mocked Bluesky request with exact branch-deploy provenance", async () => {
  let calls = 0;
  const logs = [];
  const previousConsoleError = console.error;
  const fetchImpl = async (url) => {
    calls += 1;
    assert.match(String(url), /public\.api\.bsky\.app/);
    return new Response(JSON.stringify({ posts:[{
      uri:"at://did:plc:buyer/app.bsky.feed.post/p1",
      author:{handle:"buyer.bsky.social"},
      record:{text:"Need a paid photogrammetry cleanup team", createdAt:"2026-09-06T12:00:00Z"}
    }] }), { status:200 });
  };
  console.error = (...items) => logs.push(items.join(" "));
  try {
    await withRuntime(branchDeployValues(), fetchImpl, async () => {
      const response = await handler(request(EPHEMERAL_TOKEN), {deploy:{context:"branch-deploy"}});
      const payload = await response.json();
      assert.equal(response.status, 200);
      assert.equal(calls, 1);
      assert.deepEqual(payload.counters, { source_requests:1, openai_requests:0, hosted_search_calls:0, writes:0, retries:0, cost_usd:0 });
      assert.equal(payload.discovery_hints[0].outreach_locked, true);
      assert.equal(payload.deployment_provenance.context, "branch-deploy");
      assert.equal(payload.deployment_provenance.deploy_id, DEPLOY_ID);
      assert.equal(JSON.stringify(payload).includes(EPHEMERAL_TOKEN), false);
      assert.equal(JSON.stringify(payload).includes("team-secret"), false);
      assert.equal(logs.join("\n").includes(EPHEMERAL_TOKEN), false);
      assert.equal(logs.join("\n").includes("team-secret"), false);
    });
  } finally {
    console.error = previousConsoleError;
  }
});

test("existing internal secret remains a supported canary authorization path", async () => {
  let calls = 0;
  await withRuntime(values({ RADAR_OFFICIAL_SOURCE_CANARY_ACCESS_TOKEN:"" }), async () => {
    calls += 1;
    return Response.json({ posts:[] });
  }, async () => {
    const response = await handler(request("team-secret"), {deploy:{context:"deploy-preview"}});
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(calls, 1);
    assert.deepEqual(payload.counters, { source_requests:1, openai_requests:0, hosted_search_calls:0, writes:0, retries:0, cost_usd:0 });
    assert.equal(JSON.stringify(payload).includes("team-secret"), false);
  });
});

test("missing, wrong and too-short temporary tokens fail before source dispatch", async () => {
  let calls = 0;
  const neverFetch = async () => { calls += 1; throw new Error("source dispatch must remain locked"); };
  await withRuntime(branchDeployValues(), neverFetch, async () => {
    assert.equal((await handler(request(null), {deploy:{context:"branch-deploy"}})).status, 401);
    assert.equal((await handler(request("wrong-token"), {deploy:{context:"branch-deploy"}})).status, 401);
  });
  await withRuntime(branchDeployValues({ RADAR_INTERNAL_ACCESS_SECRET:"", RADAR_OFFICIAL_SOURCE_CANARY_ACCESS_TOKEN:"too-short" }), neverFetch, async () => {
    const response = await handler(request("too-short"), {deploy:{context:"branch-deploy"}});
    const payload = await response.json();
    assert.equal(response.status, 503);
    assert.equal(payload.error.code, "OFFICIAL_SOURCE_CANARY_ACCESS_TOKEN_INVALID");
  });
  assert.equal(calls, 0);
});

test("temporary token cannot bypass production, provenance, live-AI, profile or request-limit gates", async () => {
  let calls = 0;
  const neverFetch = async () => { calls += 1; throw new Error("source dispatch must remain locked"); };
  const cases = [
    { context:{deploy:{context:"production"}}, env:branchDeployValues({ CONTEXT:"production" }) },
    { context:{deploy:{context:"branch-deploy"}}, env:branchDeployValues({ COMMIT_REF:"7".repeat(40) }) },
    { context:{deploy:{context:"branch-deploy"}}, env:branchDeployValues({ RADAR_LIVE_AI_ENABLED:"true" }) },
    { context:{deploy:{context:"branch-deploy"}}, env:branchDeployValues({ RADAR_OFFICIAL_SOURCE_CANARY_PROFILE:"INVALID" }) },
    { context:{deploy:{context:"branch-deploy"}}, env:branchDeployValues({ RADAR_OFFICIAL_SOURCE_CANARY_MAX_REQUESTS:"2" }) }
  ];
  for (const item of cases) {
    await withRuntime(item.env, neverFetch, async () => {
      const response = await handler(request(EPHEMERAL_TOKEN), item.context);
      assert.equal(response.status, 401);
      assert.equal((await response.json()).error.code, "UNAUTHORIZED");
    });
  }
  assert.equal(calls, 0);
});

test("confirmation remains mandatory and is checked before source dispatch", async () => {
  let calls = 0;
  await withRuntime(branchDeployValues(), async () => { calls += 1; return Response.json({ posts:[] }); }, async () => {
    const response = await handler(request(EPHEMERAL_TOKEN, "wrong"), {deploy:{context:"branch-deploy"}});
    assert.equal(response.status, 409);
  });
  assert.equal(calls, 0);
});
