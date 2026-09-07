import test from "node:test";
import assert from "node:assert/strict";
import handler from "../netlify/functions/official-source-canary.mjs";
import { OFFICIAL_SOURCE_CANARY_CONFIRMATION, officialSourceCanaryConfiguration } from "../src/server/official-source-canary-policy.mjs";

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
  return new Request("https://radar.test/api/official-source-canary", {
    method:"POST",
    headers:{ authorization:`Bearer ${token}`, "x-radar-official-source-confirmation":confirmation }
  });
}

test("canary policy is preview-only, exact-cap and live-AI locked", () => {
  assert.equal(officialSourceCanaryConfiguration({ context:{deploy:{context:"production"}}, getEnv:values() }).code, "OFFICIAL_SOURCE_CANARY_PREVIEW_REQUIRED");
  assert.equal(officialSourceCanaryConfiguration({ context:{deploy:{context:"deploy-preview"}}, getEnv:values({RADAR_LIVE_AI_ENABLED:"true"}) }).code, "OFFICIAL_SOURCE_CANARY_LIVE_AI_MUST_BE_LOCKED");
  assert.equal(officialSourceCanaryConfiguration({ context:{deploy:{context:"deploy-preview"}}, getEnv:values({RADAR_OFFICIAL_SOURCE_CANARY_MAX_REQUESTS:"2"}) }).code, "OFFICIAL_SOURCE_CANARY_REQUEST_LIMIT_INVALID");
});

test("branch-deploy fallback requires exact branch, commit and immutable deploy URL", () => {
  const context = {deploy:{context:"branch-deploy"}};
  const commit = "6".repeat(40);
  const branch = "audit/wide-v3-git-branch-canary-fallback-20260907";
  const deployUrl = "https://1234567890abcdef12345678--3dsk-opportunity-radar.netlify.app";
  assert.equal(officialSourceCanaryConfiguration({ context, getEnv:values() }).code, "OFFICIAL_SOURCE_CANARY_BRANCH_DEPLOY_LOCKED");
  const base = {
    RADAR_OFFICIAL_SOURCE_CANARY_BRANCH_DEPLOY_ENABLED:"true",
    NETLIFY:"true",
    CONTEXT:"branch-deploy",
    REPOSITORY_URL:"https://github.com/Winters111222/3dsk-radar",
    RADAR_OFFICIAL_SOURCE_CANARY_EXPECTED_BRANCH:branch,
    RADAR_OFFICIAL_SOURCE_CANARY_EXPECTED_COMMIT:commit,
    RADAR_OFFICIAL_SOURCE_CANARY_EXPECTED_DEPLOY_URL:deployUrl,
    BRANCH:branch,
    COMMIT_REF:commit,
    DEPLOY_URL:deployUrl
  };
  assert.equal(officialSourceCanaryConfiguration({ context, getEnv:values({...base, REPOSITORY_URL:""}) }).code, "OFFICIAL_SOURCE_CANARY_GIT_PROVENANCE_REQUIRED");
  assert.equal(officialSourceCanaryConfiguration({ context, getEnv:values({...base, BRANCH:"wrong"}) }).code, "OFFICIAL_SOURCE_CANARY_BRANCH_MISMATCH");
  assert.equal(officialSourceCanaryConfiguration({ context, getEnv:values({...base, COMMIT_REF:"7".repeat(40)}) }).code, "OFFICIAL_SOURCE_CANARY_COMMIT_MISMATCH");
  assert.equal(officialSourceCanaryConfiguration({ context, getEnv:values({...base, DEPLOY_URL:"https://branch--3dsk-opportunity-radar.netlify.app"}) }).code, "OFFICIAL_SOURCE_CANARY_DEPLOY_URL_MISMATCH");
  const ready = officialSourceCanaryConfiguration({ context, getEnv:values(base) });
  assert.equal(ready.ok, true);
  assert.deepEqual({context:ready.deploy_context, branch:ready.branch, commit_ref:ready.commit_ref, deploy_url:ready.deploy_url, repository_url:ready.repository_url}, {context:"branch-deploy", branch, commit_ref:commit, deploy_url:deployUrl, repository_url:"https://github.com/Winters111222/3dsk-radar"});
});

test("Bluesky plus Mastodon profile requires an actually ready Mastodon adapter", () => {
  const configuration = officialSourceCanaryConfiguration({
    context:{deploy:{context:"deploy-preview"}},
    getEnv:values({ RADAR_OFFICIAL_SOURCE_CANARY_PROFILE:"BLUESKY_MASTODON", RADAR_OFFICIAL_SOURCE_CANARY_MAX_REQUESTS:"2" })
  });
  assert.equal(configuration.code, "OFFICIAL_SOURCE_CANARY_CONNECTOR_NOT_READY");
  assert.deepEqual(configuration.blocked_sources, ["mastodon_official"]);
});

test("endpoint performs one read-only Bluesky request and reports zero AI, writes and retries", async () => {
  const previousNetlify = globalThis.Netlify;
  const previousFetch = globalThis.__RADAR_TEST_OFFICIAL_SOURCE_FETCH__;
  globalThis.Netlify = { env:{ get:values() } };
  let calls = 0;
  globalThis.__RADAR_TEST_OFFICIAL_SOURCE_FETCH__ = async (url) => {
    calls += 1;
    assert.match(String(url), /public\.api\.bsky\.app/);
    return new Response(JSON.stringify({ posts:[{
      uri:"at://did:plc:buyer/app.bsky.feed.post/p1",
      author:{handle:"buyer.bsky.social"},
      record:{text:"Need a paid photogrammetry cleanup team", createdAt:"2026-09-06T12:00:00Z"}
    }] }), { status:200 });
  };
  try {
    assert.equal((await handler(request("wrong"), {deploy:{context:"deploy-preview"}})).status, 401);
    assert.equal((await handler(request("team-secret", "wrong"), {deploy:{context:"deploy-preview"}})).status, 409);
    const response = await handler(request(), {deploy:{context:"deploy-preview"}});
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(calls, 1);
    assert.deepEqual(payload.counters, { source_requests:1, openai_requests:0, hosted_search_calls:0, writes:0, retries:0, cost_usd:0 });
    assert.equal(payload.discovery_hints[0].outreach_locked, true);
    assert.equal(JSON.stringify(payload).includes("team-secret"), false);
  } finally {
    if (previousNetlify === undefined) delete globalThis.Netlify;
    else globalThis.Netlify = previousNetlify;
    if (previousFetch === undefined) delete globalThis.__RADAR_TEST_OFFICIAL_SOURCE_FETCH__;
    else globalThis.__RADAR_TEST_OFFICIAL_SOURCE_FETCH__ = previousFetch;
  }
});
