import test from "node:test";
import assert from "node:assert/strict";
import {
  FOCUSED_INDEX_DISCOVERY_ALLOWED_DOMAINS,
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
  ["https://polycount.com/discussion/239037/paid-freelance-character-artist", "polycount_paid"],
  ["https://blenderartists.org/t/paid-character-work/1234567", "blender_paid"],
  ["https://jobs.lever.co/studio/4d6d1713-f9d7-4d4f-96d2-827c5d140102", "lever"],
  ["https://www.find-tender.service.gov.uk/Notice/012345-2026", "find_tender_uk"],
  ["https://www.workwithindies.com/careers/promorte-games-3d-animator-character-technical-artist", "workwithindies"],
  ["https://www.peopleperhour.com/freelance-jobs/design/3d-design/3d-human-avatar-animation-motion-capture-20-exercise-vide-4516731", "peopleperhour"],
  ["https://gamejobs.co/Senior-Game-Engineer-Systems-Engine-at-Telescope-Games", "gamejobs_co"]
];

test("index discovery keeps the focused five while wide mode adds strict detail policies", () => {
  assert.equal(INDEX_DISCOVERY_SOURCE_POLICIES.length, 30);
  assert.deepEqual(FOCUSED_INDEX_DISCOVERY_ALLOWED_DOMAINS, [
    "upwork.com",
    "freelancer.com",
    "reddit.com",
    "forums.unrealengine.com",
    "polycount.com"
  ]);
  assert.equal(INDEX_DISCOVERY_ALLOWED_DOMAINS.length, 30);
  assert.equal(INDEX_DISCOVERY_ALLOWED_DOMAINS.includes("linkedin.com"), false);
  assert.equal(INDEX_DISCOVERY_ALLOWED_DOMAINS.includes("blenderartists.org"), true);
  assert.equal(INDEX_DISCOVERY_ALLOWED_DOMAINS.includes("ted.europa.eu"), true);
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
    "https://www.peopleperhour.com/freelance-jobs/design/3d-design",
    "https://reddit.com/r/gameDevClassifieds/",
    "https://reddit.com/r/other/comments/abc/job",
    "https://forums.unrealengine.com/search?q=character",
    "https://forums.unrealengine.com/t/latest",
    "https://polycount.com/categories/freelance-job-postings",
    "https://gamejobs.co/search?w=REMOTE",
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
    discovery_lane:"MARKETPLACE",
    manual_verification_status:INDEX_DISCOVERY_MANUAL_STATUS,
    manual_verified_at:null,
    manual_verified_source_url:null,
    direct_source_requests:0
  });
});
