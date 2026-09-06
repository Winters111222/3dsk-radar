import test from "node:test";
import assert from "node:assert/strict";
import {
  INDEX_DISCOVERY_ALLOWED_DOMAINS,
  INDEX_DISCOVERY_MANUAL_STATUS,
  INDEX_DISCOVERY_MODE,
  INDEX_DISCOVERY_SOURCE_POLICIES,
  indexDiscoveryDomainPolicyForUrl,
  indexDiscoveryMetadata,
  indexDiscoveryPolicyForUrl
} from "../src/server/index-discovery.mjs";

const validExamples = [
  ["https://www.upwork.com/freelance-jobs/apply/Scan-Cleanup_~0123/", "upwork"],
  ["https://www.freelancer.com/projects/3d-modelling/character-texture-artist", "freelancer"],
  ["https://old.reddit.com/r/gameDevClassifieds/comments/abc123/hiring_character_artist/", "reddit_gamedevclassifieds"],
  ["https://forums.unrealengine.com/t/paid-metahuman-expert-needed/2734270", "unreal_job_offerings"],
  ["https://polycount.com/discussion/239037/paid-freelance-character-artist", "polycount_paid"]
];

test("index discovery has exactly five narrow source policies", () => {
  assert.equal(INDEX_DISCOVERY_SOURCE_POLICIES.length, 5);
  assert.deepEqual(INDEX_DISCOVERY_ALLOWED_DOMAINS, [
    "upwork.com",
    "freelancer.com",
    "reddit.com",
    "forums.unrealengine.com",
    "polycount.com"
  ]);
});

test("exact Tier A opportunity paths map to a server-owned source id", () => {
  for (const [url, id] of validExamples) assert.equal(indexDiscoveryPolicyForUrl(url)?.id, id);
});

test("generic pages, lookalikes and non-web URLs fail closed", () => {
  for (const url of [
    "https://upwork.com/",
    "https://upwork.com/freelancers/example",
    "https://upwork.com.evil.example/freelance-jobs/apply/fake",
    "https://freelancer.com/projects/search",
    "https://reddit.com/r/gameDevClassifieds/",
    "https://reddit.com/r/other/comments/abc/job",
    "https://forums.unrealengine.com/search?q=character",
    "https://forums.unrealengine.com/t/latest",
    "https://polycount.com/categories/freelance-job-postings",
    "javascript:alert(1)"
  ]) assert.equal(indexDiscoveryPolicyForUrl(url), null, url);
});

test("domain gate allows platform evidence pages but rejects outside and lookalike hosts", () => {
  assert.equal(indexDiscoveryDomainPolicyForUrl("https://support.upwork.com/hc/en-us")?.id, "upwork");
  assert.equal(indexDiscoveryDomainPolicyForUrl("https://upwork.com.evil.example/anything"), null);
  assert.equal(indexDiscoveryDomainPolicyForUrl("https://example.com/anything"), null);
});

test("discovery provenance always requires manual source review and records zero direct requests", () => {
  const metadata = indexDiscoveryMetadata(validExamples[0][0]);
  assert.deepEqual(metadata, {
    discovery_mode:INDEX_DISCOVERY_MODE,
    source_access_method:"OPENAI_HOSTED_WEB_SEARCH",
    discovery_source_id:"upwork",
    manual_verification_status:INDEX_DISCOVERY_MANUAL_STATUS,
    manual_verified_at:null,
    manual_verified_source_url:null,
    direct_source_requests:0
  });
});
