import test from "node:test";
import assert from "node:assert/strict";
import {
  OFFICIAL_SOURCE_MAX_REQUESTS,
  officialHintsForShard,
  officialSourceRunPlan,
  mergeStoredSourceSignals,
  runOfficialWideDiscovery,
  summarizeOfficialWideDiscovery
} from "../src/server/official-source-run.mjs";

const enabledEnv = (key) => ({
  RADAR_UPWORK_API_ENABLED:"true",
  UPWORK_OAUTH_ACCESS_TOKEN:"up-secret",
  UPWORK_API_TENANT_ID:"tenant",
  RADAR_REDDIT_API_ENABLED:"true",
  REDDIT_OAUTH_ACCESS_TOKEN:"rd-secret",
  RADAR_BLUESKY_SEARCH_ENABLED:"true",
  RADAR_MASTODON_SEARCH_ENABLED:"true",
  MASTODON_API_ORIGIN:"https://mastodon.social",
  MASTODON_ACCESS_TOKEN:"md-secret"
})[key] || "";

test("official discovery plan includes only ready free adapters and never returns credentials", () => {
  const plan = officialSourceRunPlan(enabledEnv);
  assert.equal(plan.length, OFFICIAL_SOURCE_MAX_REQUESTS);
  assert.deepEqual(plan.map((item) => item.source_id), ["upwork_official", "reddit_official", "bluesky_public", "mastodon_official"]);
  assert.equal(JSON.stringify(plan).includes("up-secret"), true);
  assert.equal(JSON.stringify(plan.map(({ config:ignored, ...item }) => item)).includes("secret"), false);
});

test("official discovery makes exactly one no-retry request per ready source and isolates failures", async () => {
  let calls = 0;
  const fetchImpl = async (url) => {
    calls += 1;
    const value = String(url);
    if (value.includes("oauth.reddit.com")) return new Response("blocked", { status:403 });
    if (value.includes("api.upwork.com")) return new Response(JSON.stringify({ data:{ marketplaceJobPostingsSearch:{ edges:[{ node:{ id:"u1", ciphertext:"~u1", title:"Character scan cleanup", description:"Paid vendor project" } }] } } }), { status:200 });
    if (value.includes("bsky")) return new Response(JSON.stringify({ posts:[{ uri:"at://did:plc:a/app.bsky.feed.post/p1", author:{handle:"buyer.bsky.social"}, record:{text:"Need a 3D team",createdAt:"2026-09-06T12:00:00Z"} }] }), { status:200 });
    return new Response(JSON.stringify({ statuses:[] }), { status:200 });
  };
  const result = await runOfficialWideDiscovery({ getEnv:enabledEnv, fetchImpl });
  assert.equal(calls, 4);
  assert.equal(result.requests, 4);
  assert.equal(result.status, "PARTIAL");
  assert.equal(result.sources.find((item) => item.source_id === "reddit_official").error_code, "OFFICIAL_SOURCE_HTTP_403");
  assert.equal(result.hints.length, 2);
  assert.equal(officialHintsForShard(result, "marketplaces_core").length, 1);
  assert.equal(officialHintsForShard(result, "social_signals").length, 1);
  const summary = summarizeOfficialWideDiscovery(result);
  assert.equal(summary.candidates_seen, 2);
  assert.equal(JSON.stringify(summary).includes("Paid vendor project"), false);
  assert.equal(JSON.stringify(summary).includes("secret"), false);
});

test("official discovery is a zero-request locked result without configured connectors", async () => {
  const result = await runOfficialWideDiscovery({ getEnv:() => "", fetchImpl:() => { throw new Error("must not call"); } });
  assert.equal(result.status, "LOCKED");
  assert.equal(result.requests, 0);
});

test("recent signed social signals join only social shards and stale signals are ignored", () => {
  const discovery = mergeStoredSourceSignals(null, [{
    source_id:"linkedin_alert_bridge",
    source_event_id:"li-1",
    source_url:"https://www.linkedin.com/jobs/view/123",
    text:"External character vendor signal",
    published_at:"2026-09-06T10:00:00Z",
    discovery_only:true,
    requires_original_verification:true
  }, {
    source_id:"linkedin_alert_bridge",
    source_event_id:"li-old",
    source_url:"https://www.linkedin.com/jobs/view/old",
    text:"Old signal",
    published_at:"2026-07-01T10:00:00Z",
    discovery_only:true,
    requires_original_verification:true
  }], "2026-09-06T12:00:00Z");
  assert.equal(discovery.requests, 0);
  assert.equal(discovery.stored_signal_count, 1);
  assert.equal(officialHintsForShard(discovery, "social_signals").length, 1);
  assert.equal(officialHintsForShard(discovery, "procurement").length, 0);
  assert.equal(summarizeOfficialWideDiscovery(discovery).stored_signal_count, 1);
});
