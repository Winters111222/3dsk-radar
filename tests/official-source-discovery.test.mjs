import test from "node:test";
import assert from "node:assert/strict";
import {
  BLUESKY_PUBLIC_API_ORIGIN,
  OFFICIAL_SOURCE_MAX_RESULTS,
  REDDIT_API_ORIGIN,
  UPWORK_GRAPHQL_URL,
  buildBlueskySearchRequest,
  buildMastodonSearchRequest,
  buildRedditSearchRequest,
  buildUpworkSearchRequest,
  collectOfficialSource,
  parseBlueskySearch,
  parseMastodonSearch,
  parseRedditSearch,
  parseUpworkSearch
} from "../src/server/official-source-discovery.mjs";

test("Upwork uses approved GraphQL search and keeps credentials out of its body", () => {
  const request = buildUpworkSearchRequest({ accessToken:"up-secret", tenantId:"tenant-1", query:"photogrammetry", limit:99 });
  assert.equal(request.url, UPWORK_GRAPHQL_URL);
  assert.equal(request.options.headers.authorization, "Bearer up-secret");
  assert.equal(request.options.headers["x-upwork-api-tenantid"], "tenant-1");
  assert.equal(request.options.body.includes("up-secret"), false);
  const body = JSON.parse(request.options.body);
  assert.equal(body.query.includes("marketplaceJobPostingsSearch"), true);
  assert.equal(body.variables.filter.searchExpression_eq, "photogrammetry");
  assert.equal(body.variables.filter.pagination_eq.first, OFFICIAL_SOURCE_MAX_RESULTS);
});

test("Reddit is limited to the approved subreddit and last month", () => {
  const request = buildRedditSearchRequest({ accessToken:"rd-secret", query:"[HIRING] character", limit:12 });
  const url = new URL(request.url);
  assert.equal(url.origin, REDDIT_API_ORIGIN);
  assert.equal(url.pathname, "/r/gameDevClassifieds/search");
  assert.equal(url.searchParams.get("restrict_sr"), "1");
  assert.equal(url.searchParams.get("sort"), "new");
  assert.equal(url.searchParams.get("t"), "month");
  assert.equal(request.url.includes("rd-secret"), false);
});

test("Bluesky uses the public latest-post search endpoint", () => {
  const request = buildBlueskySearchRequest({ query:"3D character artist contract", limit:7 });
  const url = new URL(request.url);
  assert.equal(url.origin, BLUESKY_PUBLIC_API_ORIGIN);
  assert.equal(url.pathname, "/xrpc/app.bsky.feed.searchPosts");
  assert.equal(url.searchParams.get("sort"), "latest");
  assert.equal(url.searchParams.get("limit"), "7");
  assert.equal(request.options.headers.authorization, undefined);
  assert.match(request.options.headers["user-agent"], /3dsk-opportunity-radar/);
});

test("Mastodon accepts only a clean HTTPS server origin", () => {
  const request = buildMastodonSearchRequest({ origin:"https://mastodon.social", accessToken:"md-secret", query:"photogrammetry hiring" });
  const url = new URL(request.url);
  assert.equal(url.pathname, "/api/v2/search");
  assert.equal(url.searchParams.get("type"), "statuses");
  assert.throws(() => buildMastodonSearchRequest({ origin:"http://localhost:3000", accessToken:"x", query:"x" }), /MASTODON_ORIGIN_INVALID/);
  assert.throws(() => buildMastodonSearchRequest({ origin:"https://mastodon.social/path", accessToken:"x", query:"x" }), /MASTODON_ORIGIN_INVALID/);
});

test("official payloads normalize to discovery-only hints", () => {
  const upwork = parseUpworkSearch({ data:{ marketplaceJobPostingsSearch:{ edges:[{node:{id:"job-1",ciphertext:"~0123",title:"Scan cleanup",description:"Need a vendor"}}] } } });
  const reddit = parseRedditSearch({ data:{ children:[
    {data:{id:"abc",name:"t3_abc",subreddit:"gameDevClassifieds",permalink:"/r/gameDevClassifieds/comments/abc/hiring/",title:"[HIRING] Character team",selftext:"Paid project",created_utc:1788700000,author:"buyer"}},
    {data:{id:"no",subreddit:"other",title:"irrelevant"}}
  ] } });
  const bluesky = parseBlueskySearch({ posts:[{uri:"at://did:plc:abc/app.bsky.feed.post/3xyz",author:{handle:"buyer.bsky.social"},record:{text:"Looking for a paid 3D character team",createdAt:"2026-09-06T10:00:00Z"}}] });
  const mastodon = parseMastodonSearch({ statuses:[{id:"42",url:"https://mastodon.social/@buyer/42",content:"<p>Need a photogrammetry vendor</p>",created_at:"2026-09-06T11:00:00Z",account:{acct:"buyer"}}] });
  for (const item of [upwork[0], reddit[0], bluesky[0], mastodon[0]]) {
    assert.equal(item.discovery_only, true);
    assert.equal(item.requires_original_verification, true);
  }
  assert.equal(reddit.length, 1);
  assert.equal(upwork[0].source_url, "https://www.upwork.com/jobs/~0123");
  assert.equal(bluesky[0].source_url, "https://bsky.app/profile/buyer.bsky.social/post/3xyz");
  assert.equal(mastodon[0].title, "Need a photogrammetry vendor");
});

test("one official source collection makes one request, zero AI calls and zero retries", async () => {
  let calls = 0;
  const fakeFetch = async (_url, options) => {
    calls += 1;
    assert.equal(options.method, "GET");
    return new Response(JSON.stringify({ posts:[{uri:"at://did:plc:abc/app.bsky.feed.post/3xyz",author:{handle:"buyer.bsky.social"},record:{text:"Paid character contract",createdAt:"2026-09-06T10:00:00Z"}}] }), {status:200,headers:{"content-type":"application/json"}});
  };
  const result = await collectOfficialSource({ sourceId:"bluesky_public", query:"character contract", fetchImpl:fakeFetch });
  assert.equal(calls, 1);
  assert.equal(result.status, "COMPLETE");
  assert.equal(result.items.length, 1);
  assert.deepEqual(result.counters, { source_requests:1, candidates_seen:1, openai_requests:0, retries:0, cost_usd:0 });
});

test("invalid schemas and credentials fail closed", () => {
  assert.throws(() => buildUpworkSearchRequest({ accessToken:"", tenantId:"x", query:"x" }), /UPWORK_OAUTH_TOKEN_REQUIRED/);
  assert.throws(() => parseUpworkSearch({}), /UPWORK_SCHEMA_MISMATCH/);
  assert.throws(() => parseRedditSearch({}), /REDDIT_SCHEMA_MISMATCH/);
  assert.throws(() => parseBlueskySearch({}), /BLUESKY_SCHEMA_MISMATCH/);
  assert.throws(() => parseMastodonSearch({}), /MASTODON_SCHEMA_MISMATCH/);
});
