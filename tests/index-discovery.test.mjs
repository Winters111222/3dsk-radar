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
  ["https://discussions.unity.com/t/paid-realistic-character-production/159933", "unity_commercial"],
  ["https://www.codeur.com/projects/123456-production-3d", "codeur"],
  ["https://jobs.lever.co/studio/4d6d1713-f9d7-4d4f-96d2-827c5d140102", "lever"],
  ["https://www.find-tender.service.gov.uk/Notice/012345-2026", "find_tender_uk"],
  ["https://www.workwithindies.com/careers/promorte-games-3d-animator-character-technical-artist", "workwithindies"],
  ["https://www.peopleperhour.com/freelance-jobs/design/3d-design/3d-human-avatar-animation-motion-capture-20-exercise-vide-4516731", "peopleperhour"],
  ["https://gamejobs.co/Senior-Game-Engineer-Systems-Engine-at-Telescope-Games", "gamejobs_co"],
  ["https://nen.nipez.cz/verejne-zakazky/detail-zakazky/N006-25-V00017990", "nen_cz"],
  ["https://zakazky.gov.cz/verejne-zakazky/detail-zakazky/RVZ123456", "zakazky_gov"],
  ["https://zakazky.krajbezkorupce.cz/contract_display_1234.html", "ezak_south_moravia"],
  ["https://zakazky.kr-stredocesky.cz/contract_display_9876.html", "ezak_central_bohemia"],
  ["https://www.uvo.gov.sk/vestnik/oznamenie/detail/373248", "uvo_sk"],
  ["https://www.uvo.gov.sk/vyhladavanie/vyhladavanie-zakaziek/detail/512345", "uvo_sk"],
  ["https://josephine.proebiz.com/sk/tender/12345/summary", "josephine"],
  ["https://www.mk.gov.cz/digitalizace-kulturnich-statku-a-narodnich-kulturnich-pamatek-cs-2941", "mk_cz_heritage_grants"],
  ["https://www.fpu.sk/sk/vyzvy/", "fpu_sk_heritage_grants"],
  ["https://www.culture.gov.sk/sk/dotacie-2026", "mk_sr_heritage_grants"],
  ["https://eeagrants.org/sk/slovakia/programmes/culture-local-development/news/nove-vyzvy-v-oblasti-kultury-vyhlasene", "eea_sk_culture_grants"],
  ["https://een.ec.europa.eu/partnering-opportunities/example-request", "een_requests"]
];

test("index discovery keeps the focused five while wide mode adds strict detail policies", () => {
  assert.equal(INDEX_DISCOVERY_SOURCE_POLICIES.length, 43);
  assert.deepEqual(FOCUSED_INDEX_DISCOVERY_ALLOWED_DOMAINS, [
    "upwork.com",
    "freelancer.com",
    "reddit.com",
    "forums.unrealengine.com",
    "polycount.com"
  ]);
  assert.equal(INDEX_DISCOVERY_ALLOWED_DOMAINS.length, 43);
  assert.equal(INDEX_DISCOVERY_ALLOWED_DOMAINS.includes("linkedin.com"), false);
  assert.equal(INDEX_DISCOVERY_ALLOWED_DOMAINS.includes("blenderartists.org"), true);
  assert.equal(INDEX_DISCOVERY_ALLOWED_DOMAINS.includes("ted.europa.eu"), true);
  assert.equal(INDEX_DISCOVERY_ALLOWED_DOMAINS.includes("nen.nipez.cz"), true);
  assert.equal(INDEX_DISCOVERY_ALLOWED_DOMAINS.includes("uvo.gov.sk"), true);
  for (const domain of [
    "discussions.unity.com",
    "codeur.com",
    "zakazky.gov.cz",
    "zakazky.krajbezkorupce.cz",
    "zakazky.kr-stredocesky.cz",
    "josephine.proebiz.com",
    "mk.gov.cz",
    "fpu.sk",
    "culture.gov.sk",
    "eeagrants.org"
  ]) assert.equal(INDEX_DISCOVERY_ALLOWED_DOMAINS.includes(domain), true, domain);
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
    "https://discussions.unity.com/tag/commercial-job-offering/159933",
    "https://www.codeur.com/projects",
    "https://zakazky.gov.cz/",
    "https://zakazky.krajbezkorupce.cz/profile_display_255.html",
    "https://josephine.proebiz.com/sk/public-tenders/list",
    "https://www.mk.gov.cz/",
    "https://www.mk.gov.cz/granty-a-dotace-cs-1234",
    "https://www.culture.gov.sk/sk/",
    "https://eeagrants.org/sk/slovakia/",
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
