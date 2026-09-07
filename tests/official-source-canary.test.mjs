import test from "node:test";
import assert from "node:assert/strict";
import handler from "../netlify/functions/official-source-canary.mjs";
import { OFFICIAL_SOURCE_CANARY_CONFIRMATION, officialSourceCanaryConfiguration } from "../src/server/official-source-canary-policy.mjs";

const EPHEMERAL_TOKEN = "temporary-canary-token-0123456789abcdef";
const BRANCH = "audit/wide-v3-runtime-provenance-20260907";
const COMMIT = "6".repeat(40);
const DEPLOY_ID = "1234567890abcdef12345678";
const RADAR_SITE_NAME = "3dsk-opportunity-radar";
const RADAR_SITE_ID = "f390f4e9-12f5-4074-946e-c83f2d7fe20d";
const DEPLOY_URL = `https://${DEPLOY_ID}--${RADAR_SITE_NAME}.netlify.app`;
const CANARY_URL = `${DEPLOY_URL}/api/official-source-canary`;
const MAIN_SITE_URL = `https://${RADAR_SITE_NAME}.netlify.app`;
const TEST_METADATA_BASE = {
  schema_version:2,
  service:"3dsk-opportunity-radar",
  commit_ref:COMMIT,
  deploy_context:"branch-deploy",
  repository_url:"https://github.com/winters111222/3dsk-radar",
  branch:BRANCH,
  site_name:RADAR_SITE_NAME,
  site_id:RADAR_SITE_ID,
  artifact_provenance:"NETLIFY_GIT_DEPLOY"
};

function values(overrides = {}) {
  const env = {
    RADAR_INTERNAL_ACCESS_SECRET:"team-secret",
    RADAR_LIVE_AI_ENABLED:"false",
    RADAR_OFFICIAL_SOURCE_CANARY_ENABLED:"true",
    RADAR_OFFICIAL_SOURCE_CANARY_PROFILE:"BLUESKY_ONLY",
    RADAR_OFFICIAL_SOURCE_CANARY_MAX_REQUESTS:"1",
    RADAR_BLUESKY_SEARCH_ENABLED:"true",
    SITE_NAME:RADAR_SITE_NAME,
    SITE_ID:RADAR_SITE_ID,
    ...overrides
  };
  return (key) => env[key] || "";
}

function request(token = "team-secret", confirmation = OFFICIAL_SOURCE_CANARY_CONFIRMATION, url = CANARY_URL) {
  const headers = { "x-radar-official-source-confirmation":confirmation };
  if (token !== null) headers.authorization = `Bearer ${token}`;
  return new Request(url, {
    method:"POST",
    headers
  });
}

function branchDeployValues(overrides = {}) {
  return values({
    RADAR_OFFICIAL_SOURCE_CANARY_ACCESS_TOKEN:EPHEMERAL_TOKEN,
    RADAR_OFFICIAL_SOURCE_CANARY_BRANCH_DEPLOY_ENABLED:"true",
    RADAR_OFFICIAL_SOURCE_CANARY_EXPECTED_BRANCH:BRANCH,
    RADAR_OFFICIAL_SOURCE_CANARY_EXPECTED_COMMIT:COMMIT,
    ...overrides
  });
}

function functionRuntimeContext(overrides = {}) {
  const deployId = overrides.DEPLOY_ID || overrides.deploy?.id || DEPLOY_ID;
  const siteName = overrides.SITE_NAME || overrides.site?.name || RADAR_SITE_NAME;
  const siteId = overrides.SITE_ID || overrides.site?.id || RADAR_SITE_ID;
  return {
    ...overrides,
    deploy:{ context:"branch-deploy", id:deployId, ...overrides.deploy },
    site:{
      name:siteName,
      id:siteId,
      url:MAIN_SITE_URL,
      ...overrides.site
    }
  };
}

function previewContext(deployId = DEPLOY_ID, siteName = RADAR_SITE_NAME, siteId = RADAR_SITE_ID) {
  return {
    deploy:{ context:"deploy-preview", id:deployId },
    site:{ name:siteName, id:siteId, url:MAIN_SITE_URL }
  };
}

function withRuntime(getEnv, fetchImpl, callback, buildMetadata = null) {
  const previousNetlify = globalThis.Netlify;
  const previousFetch = globalThis.__RADAR_TEST_OFFICIAL_SOURCE_FETCH__;
  const previousMetadata = globalThis.__RADAR_TEST_OFFICIAL_SOURCE_CANARY_METADATA__;
  globalThis.Netlify = { env:{ get:getEnv } };
  if (buildMetadata) globalThis.__RADAR_TEST_OFFICIAL_SOURCE_CANARY_METADATA__ = buildMetadata;
  else if (previousMetadata === undefined) delete globalThis.__RADAR_TEST_OFFICIAL_SOURCE_CANARY_METADATA__;
  globalThis.__RADAR_TEST_OFFICIAL_SOURCE_FETCH__ = fetchImpl;
  try {
    return callback();
  } finally {
    if (previousNetlify === undefined) delete globalThis.Netlify;
    else globalThis.Netlify = previousNetlify;
    if (previousFetch === undefined) delete globalThis.__RADAR_TEST_OFFICIAL_SOURCE_FETCH__;
    else globalThis.__RADAR_TEST_OFFICIAL_SOURCE_FETCH__ = previousFetch;
    if (previousMetadata === undefined) delete globalThis.__RADAR_TEST_OFFICIAL_SOURCE_CANARY_METADATA__;
    else globalThis.__RADAR_TEST_OFFICIAL_SOURCE_CANARY_METADATA__ = previousMetadata;
  }
}

test("canary policy is preview-only, exact-cap and live-AI locked", () => {
  assert.equal(officialSourceCanaryConfiguration({
    context:previewContext(),
    getEnv:values(),
    getBuildMetadata:() => ({ ...TEST_METADATA_BASE, deploy_context:"deploy-preview", artifact_provenance:"DIRECT_BUILD" })
  }).ok, true);
  assert.equal(officialSourceCanaryConfiguration({
    context:previewContext(),
    getEnv:values({ RADAR_LIVE_AI_ENABLED:"true" }),
    getBuildMetadata:() => ({ ...TEST_METADATA_BASE, deploy_context:"deploy-preview", artifact_provenance:"DIRECT_BUILD" })
  }).code, "OFFICIAL_SOURCE_CANARY_LIVE_AI_MUST_BE_LOCKED");
  assert.equal(officialSourceCanaryConfiguration({ context:{deploy:{context:"production"}, site:{name:RADAR_SITE_NAME,id:RADAR_SITE_ID}}, getEnv:values(), getBuildMetadata:() => TEST_METADATA_BASE }).code, "OFFICIAL_SOURCE_CANARY_PREVIEW_REQUIRED");
});

test("runtime provenance is sourced from build metadata and Function context", () => {
  const malformedMetadata = { ...TEST_METADATA_BASE, branch:"other" };
  assert.equal(officialSourceCanaryConfiguration({
    context:functionRuntimeContext(),
    requestUrl:CANARY_URL,
    getEnv:branchDeployValues({
      RADAR_OFFICIAL_SOURCE_CANARY_EXPECTED_BRANCH:BRANCH,
      RADAR_OFFICIAL_SOURCE_CANARY_EXPECTED_COMMIT:COMMIT,
      BRANCH:"wrong-branch-from-runtime",
      COMMIT_REF:"7".repeat(40),
      DEPLOY_ID:"bbbbbbbbbbbbbbbbbbbbbbbb",
      DEPLOY_URL:"https://wrong-site.netlify.app"
    }),
    getBuildMetadata:() => TEST_METADATA_BASE
  }).ok, true);
  assert.equal(officialSourceCanaryConfiguration({
    context:functionRuntimeContext(),
    requestUrl:CANARY_URL,
    getEnv:branchDeployValues({
      RADAR_OFFICIAL_SOURCE_CANARY_EXPECTED_BRANCH:BRANCH,
      RADAR_OFFICIAL_SOURCE_CANARY_EXPECTED_COMMIT:COMMIT,
      BRANCH:"wrong-branch-from-runtime",
      COMMIT_REF:COMMIT,
      DEPLOY_ID:"bbbbbbbbbbbbbbbbbbbbbbbb",
      DEPLOY_URL:"https://wrong-site.netlify.app"
    }),
    getBuildMetadata:() => malformedMetadata
  }).code, "OFFICIAL_SOURCE_CANARY_BRANCH_MISMATCH");
});

test("branch-deploy derives immutable origin from deploy id and sealed site name, not context.site.url", () => {
  const context = functionRuntimeContext();
  const base = branchDeployValues();
  const validMetadata = TEST_METADATA_BASE;

  assert.equal(officialSourceCanaryConfiguration({ context, requestUrl:CANARY_URL, getEnv:base, getBuildMetadata:() => validMetadata }).ok, true);
  assert.equal(officialSourceCanaryConfiguration({ context:functionRuntimeContext({ site:{ url:"https://custom.example" } }), requestUrl:CANARY_URL, getEnv:base, getBuildMetadata:() => validMetadata }).ok, true);
  assert.equal(officialSourceCanaryConfiguration({ context, requestUrl:CANARY_URL, getEnv:branchDeployValues({ RADAR_OFFICIAL_SOURCE_CANARY_BRANCH_DEPLOY_ENABLED:"false" }), getBuildMetadata:() => validMetadata }).code, "OFFICIAL_SOURCE_CANARY_BRANCH_DEPLOY_LOCKED");
  assert.equal(officialSourceCanaryConfiguration({ context, requestUrl:CANARY_URL, getEnv:branchDeployValues({ RADAR_OFFICIAL_SOURCE_CANARY_EXPECTED_BRANCH:"wrong-branch" }), getBuildMetadata:() => validMetadata }).code, "OFFICIAL_SOURCE_CANARY_BRANCH_MISMATCH");
  assert.equal(officialSourceCanaryConfiguration({ context, requestUrl:CANARY_URL, getEnv:branchDeployValues({ RADAR_OFFICIAL_SOURCE_CANARY_EXPECTED_COMMIT:"7".repeat(40) }), getBuildMetadata:() => validMetadata }).code, "OFFICIAL_SOURCE_CANARY_COMMIT_MISMATCH");
  assert.equal(officialSourceCanaryConfiguration({ context, requestUrl:CANARY_URL, getEnv:branchDeployValues(), getBuildMetadata:() => ({ ...validMetadata, repository_url:"https://github.com/other/repo" }) }).code, "OFFICIAL_SOURCE_CANARY_GIT_PROVENANCE_REQUIRED");
  assert.equal(officialSourceCanaryConfiguration({
    context:{ ...functionRuntimeContext(), site:{ ...functionRuntimeContext().site, name:"wrong-site" } },
    requestUrl:CANARY_URL,
    getEnv:base,
    getBuildMetadata:() => validMetadata
  }).code, "OFFICIAL_SOURCE_CANARY_GIT_PROVENANCE_REQUIRED");
  const ready = officialSourceCanaryConfiguration({ context, requestUrl:CANARY_URL, getEnv:base, getBuildMetadata:() => validMetadata });
  assert.equal(ready.ok, true);
  assert.equal(ready.deploy_context, "branch-deploy");
  assert.equal(ready.repository_url, "https://github.com/winters111222/3dsk-radar");
  assert.equal(ready.artifact_provenance, "NETLIFY_GIT_DEPLOY");
  assert.equal(ready.deploy_url, DEPLOY_URL);
});

test("branch-deploy request target rejects aliases, mismatches and unsafe URL forms", () => {
  const inputs = [
    [MAIN_SITE_URL + "/api/official-source-canary", "OFFICIAL_SOURCE_CANARY_DEPLOY_URL_MISMATCH"],
    [`https://audit--${RADAR_SITE_NAME}.netlify.app/api/official-source-canary`, "OFFICIAL_SOURCE_CANARY_DEPLOY_URL_MISMATCH"],
    [`https://${"a".repeat(24)}--${RADAR_SITE_NAME}.netlify.app/api/official-source-canary`, "OFFICIAL_SOURCE_CANARY_DEPLOY_URL_MISMATCH"],
    [`https://${DEPLOY_ID}--wrong-site.netlify.app/api/official-source-canary`, "OFFICIAL_SOURCE_CANARY_DEPLOY_URL_MISMATCH"],
    [`http://${DEPLOY_ID}--${RADAR_SITE_NAME}.netlify.app/api/official-source-canary`, "OFFICIAL_SOURCE_CANARY_DEPLOY_URL_MISMATCH"],
    [`https://${DEPLOY_ID}--${RADAR_SITE_NAME}.netlify.app:443/api/official-source-canary`, "OFFICIAL_SOURCE_CANARY_DEPLOY_URL_MISMATCH"],
    [`https://user:password@${DEPLOY_ID}--${RADAR_SITE_NAME}.netlify.app/api/official-source-canary`, "OFFICIAL_SOURCE_CANARY_DEPLOY_URL_MISMATCH"],
    [`${DEPLOY_URL}/api/other`, "OFFICIAL_SOURCE_CANARY_REQUEST_PATH_MISMATCH"],
    [`${CANARY_URL}?attempt=1`, "OFFICIAL_SOURCE_CANARY_REQUEST_PATH_MISMATCH"],
    [`${CANARY_URL}#fragment`, "OFFICIAL_SOURCE_CANARY_REQUEST_PATH_MISMATCH"],
    ["not a url", "OFFICIAL_SOURCE_CANARY_DEPLOY_URL_MISMATCH"],
    [undefined, "OFFICIAL_SOURCE_CANARY_DEPLOY_URL_MISMATCH"]
  ];
  for (const [requestUrl, expectedCode] of inputs) {
    const result = officialSourceCanaryConfiguration({
      context:functionRuntimeContext(),
      requestUrl,
      getEnv:branchDeployValues(),
      getBuildMetadata:() => TEST_METADATA_BASE
    });
    assert.equal(result.ok, false, String(requestUrl));
    assert.equal(result.code, expectedCode, String(requestUrl));
  }
});

test("Bluesky only profile requires ready adapters and exact request limit", () => {
  const configuration = officialSourceCanaryConfiguration({
    context:previewContext(),
    getEnv:values({ RADAR_OFFICIAL_SOURCE_CANARY_PROFILE:"BLUESKY_MASTODON", RADAR_OFFICIAL_SOURCE_CANARY_MAX_REQUESTS:"2" }),
    getBuildMetadata:() => ({ ...TEST_METADATA_BASE, deploy_context:"deploy-preview", commit_ref:COMMIT, artifact_provenance:"DIRECT_BUILD" })
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
      const response = await handler(request(EPHEMERAL_TOKEN), functionRuntimeContext());
      const payload = await response.json();
      assert.equal(response.status, 200);
      assert.equal(calls, 1);
      assert.deepEqual(payload.counters, { source_requests:1, openai_requests:0, hosted_search_calls:0, writes:0, retries:0, cost_usd:0 });
      assert.equal(payload.deployment_provenance.artifact_provenance, "NETLIFY_GIT_DEPLOY");
      assert.equal(payload.discovery_hints[0].outreach_locked, true);
      assert.equal(payload.deployment_provenance.context, "branch-deploy");
      assert.equal(payload.deployment_provenance.deploy_id, DEPLOY_ID);
      assert.equal(payload.deployment_provenance.deploy_url, DEPLOY_URL);
      assert.equal(JSON.stringify(payload).includes(EPHEMERAL_TOKEN), false);
      assert.equal(JSON.stringify(payload).includes("team-secret"), false);
      assert.equal(logs.join("\n").includes(EPHEMERAL_TOKEN), false);
      assert.equal(logs.join("\n").includes("team-secret"), false);
    }, TEST_METADATA_BASE);
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
    const response = await handler(request("team-secret"), previewContext());
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(calls, 1);
    assert.deepEqual(payload.counters, { source_requests:1, openai_requests:0, hosted_search_calls:0, writes:0, retries:0, cost_usd:0 });
    assert.equal(JSON.stringify(payload).includes("team-secret"), false);
  }, { ...TEST_METADATA_BASE, deploy_context:"deploy-preview", artifact_provenance:"DIRECT_BUILD" });
});

test("missing, wrong and too-short temporary tokens fail before source dispatch", async () => {
  let calls = 0;
  const neverFetch = async () => { calls += 1; throw new Error("source dispatch must remain locked"); };
  await withRuntime(branchDeployValues(), neverFetch, async () => {
    assert.equal((await handler(request(null), functionRuntimeContext())).status, 401);
    assert.equal((await handler(request("wrong-token"), functionRuntimeContext())).status, 401);
  }, TEST_METADATA_BASE);
  await withRuntime(branchDeployValues({ RADAR_INTERNAL_ACCESS_SECRET:"", RADAR_OFFICIAL_SOURCE_CANARY_ACCESS_TOKEN:"too-short" }), neverFetch, async () => {
    const response = await handler(request("too-short"), functionRuntimeContext());
    const payload = await response.json();
    assert.equal(response.status, 503);
    assert.equal(payload.error.code, "OFFICIAL_SOURCE_CANARY_ACCESS_TOKEN_INVALID");
  }, { ...TEST_METADATA_BASE, artifact_provenance:"NETLIFY_GIT_DEPLOY" });
  assert.equal(calls, 0);
});

test("temporary token cannot bypass request-origin, production, provenance, live-AI, profile, limit or readiness gates", async () => {
  let calls = 0;
  const neverFetch = async () => { calls += 1; throw new Error("source dispatch must remain locked"); };
  const cases = [
    { label:"production context", context:{deploy:{context:"production", id:DEPLOY_ID}, site:{name:RADAR_SITE_NAME,id:RADAR_SITE_ID,url:DEPLOY_URL}}, env:branchDeployValues({}), metadata:TEST_METADATA_BASE },
    { label:"invalid deploy id", context:{deploy:{context:"branch-deploy", id:"bad-deploy-id"}, site:{name:RADAR_SITE_NAME,id:RADAR_SITE_ID,url:MAIN_SITE_URL}}, env:branchDeployValues(), metadata:TEST_METADATA_BASE },
    { label:"main site request", context:functionRuntimeContext(), url:`${MAIN_SITE_URL}/api/official-source-canary`, env:branchDeployValues(), metadata:TEST_METADATA_BASE },
    { label:"branch alias request", context:functionRuntimeContext(), url:`https://audit--${RADAR_SITE_NAME}.netlify.app/api/official-source-canary`, env:branchDeployValues(), metadata:TEST_METADATA_BASE },
    { label:"other deploy request", context:functionRuntimeContext(), url:`https://${"a".repeat(24)}--${RADAR_SITE_NAME}.netlify.app/api/official-source-canary`, env:branchDeployValues(), metadata:TEST_METADATA_BASE },
    { label:"other site request", context:functionRuntimeContext(), url:`https://${DEPLOY_ID}--wrong-site.netlify.app/api/official-source-canary`, env:branchDeployValues(), metadata:TEST_METADATA_BASE },
    { label:"http request", context:functionRuntimeContext(), url:`http://${DEPLOY_ID}--${RADAR_SITE_NAME}.netlify.app/api/official-source-canary`, env:branchDeployValues(), metadata:TEST_METADATA_BASE },
    { label:"other path", context:functionRuntimeContext(), url:`${DEPLOY_URL}/api/other`, env:branchDeployValues(), metadata:TEST_METADATA_BASE },
    { label:"query string", context:functionRuntimeContext(), url:`${CANARY_URL}?attempt=1`, env:branchDeployValues(), metadata:TEST_METADATA_BASE },
    { label:"fragment", context:functionRuntimeContext(), url:`${CANARY_URL}#fragment`, env:branchDeployValues(), metadata:TEST_METADATA_BASE },
    { label:"context site name mismatch", context:functionRuntimeContext({ site:{ name:"wrong-site" } }), env:branchDeployValues(), metadata:TEST_METADATA_BASE },
    { label:"context site id mismatch", context:functionRuntimeContext({ site:{ id:"wrong-site-id" } }), env:branchDeployValues(), metadata:TEST_METADATA_BASE },
    { label:"sealed branch mismatch", context:functionRuntimeContext(), env:branchDeployValues(), metadata:{ ...TEST_METADATA_BASE, branch:"wrong-branch" } },
    { label:"sealed commit mismatch", context:functionRuntimeContext(), env:branchDeployValues(), metadata:{ ...TEST_METADATA_BASE, commit_ref:"7".repeat(40) } },
    { label:"sealed repository mismatch", context:functionRuntimeContext(), env:branchDeployValues(), metadata:{ ...TEST_METADATA_BASE, repository_url:"https://github.com/other/repo" } },
    { label:"sealed artifact provenance mismatch", context:functionRuntimeContext(), env:branchDeployValues(), metadata:{ ...TEST_METADATA_BASE, artifact_provenance:"DIRECT_BUILD" } },
    { label:"live AI enabled", context:functionRuntimeContext(), env:branchDeployValues({ RADAR_LIVE_AI_ENABLED:"true" }), metadata:TEST_METADATA_BASE },
    { label:"invalid profile", context:functionRuntimeContext(), env:branchDeployValues({ RADAR_OFFICIAL_SOURCE_CANARY_PROFILE:"INVALID" }), metadata:TEST_METADATA_BASE },
    { label:"invalid request limit", context:functionRuntimeContext(), env:branchDeployValues({ RADAR_OFFICIAL_SOURCE_CANARY_MAX_REQUESTS:"2" }), metadata:TEST_METADATA_BASE },
    { label:"Bluesky connector locked", context:functionRuntimeContext(), env:branchDeployValues({ RADAR_BLUESKY_SEARCH_ENABLED:"false" }), metadata:TEST_METADATA_BASE }
  ];
  for (const item of cases) {
    await withRuntime(item.env, neverFetch, async () => {
      const response = await handler(request(EPHEMERAL_TOKEN, OFFICIAL_SOURCE_CANARY_CONFIRMATION, item.url || CANARY_URL), item.context);
      assert.equal(response.status, 401, item.label);
      assert.equal((await response.json()).error.code, "UNAUTHORIZED", item.label);
    }, item.metadata);
  }
  assert.equal(calls, 0);
});

test("confirmation remains mandatory and is checked before source dispatch", async () => {
  let calls = 0;
  await withRuntime(branchDeployValues(), async () => { calls += 1; return Response.json({ posts:[] }); }, async () => {
    const response = await handler(request(EPHEMERAL_TOKEN, "wrong"), functionRuntimeContext());
    assert.equal(response.status, 409);
  }, TEST_METADATA_BASE);
  assert.equal(calls, 0);
});
