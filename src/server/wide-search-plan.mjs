const shard = (id, label, allowedDomains, focus) => Object.freeze({
  id,
  label,
  allowed_domains:Object.freeze(allowedDomains),
  focus
});

export const WIDE_SEARCH_SHARDS = Object.freeze([
  shard("direct_marketplaces", "Direct marketplaces",
    ["upwork.com", "freelancer.com", "peopleperhour.com", "guru.com"],
    "Find current buyer-posted freelance or studio-scale projects for human photogrammetry, scan cleanup, realistic characters, digital doubles, facial/FACS work, Wrap/basemesh work, character finishing or production overflow. Reject seller profiles and services for sale."),
  shard("artist_communities", "3D and game communities",
    ["reddit.com", "forums.unrealengine.com", "polycount.com", "blenderartists.org"],
    "Find current PAID or HIRING posts where a buyer needs relevant character-production work. On Reddit, only r/gameDevClassifieds detail posts qualify. Reject FOR HIRE, unpaid, rev-share-only and portfolio posts."),
  shard("contract_and_ats", "Contract jobs and public ATS",
    ["workwithindies.com", "remotegamejobs.com", "hitmarker.net", "gamesjobsdirect.com", "artstation.com", "gamejobs.co", "vfxengine.com", "greenhouse.io", "lever.co", "ashbyhq.com", "smartrecruiters.com", "workable.com", "teamtailor.com", "recruitee.com"],
    "Find current worldwide/remote contract, freelance, external-development, outsourcing, vendor-management or art-production-overflow signals. Ordinary employee jobs are POTENTIAL_LEAD only, never OPEN_OPPORTUNITY, and only when unusually relevant to external character-production capacity."),
  shard("public_procurement", "Public procurement",
    ["ted.europa.eu", "find-tender.service.gov.uk", "contractsfinder.service.gov.uk", "sam.gov", "canadabuys.canada.ca", "ungm.org", "procurement-notices.undp.org", "worldbank.org"],
    "Find open public tenders/RFPs/RFQs for human or character 3D scanning, photogrammetry processing, digital humans, facial capture, character modeling/animation production or closely relevant external content production. Reject equipment procurement, GIS, BIM, mapping and building/site scanning."),
  shard("worldwide_multilingual", "Worldwide multilingual sweep",
    ["upwork.com", "freelancer.com", "peopleperhour.com", "guru.com", "reddit.com", "forums.unrealengine.com", "polycount.com", "blenderartists.org", "workwithindies.com", "remotegamejobs.com", "greenhouse.io", "lever.co", "ashbyhq.com", "smartrecruiters.com", "workable.com", "teamtailor.com", "recruitee.com", "ted.europa.eu", "find-tender.service.gov.uk", "contractsfinder.service.gov.uk", "sam.gov", "canadabuys.canada.ca", "ungm.org", "procurement-notices.undp.org", "worldbank.org"],
    "Run a final worldwide freshness sweep using English plus Czech, German, French, Spanish, Italian, Polish, Portuguese and Japanese demand terms. Prioritize opportunities missed by English-only searches and keep the same strict buyer, scope, freshness and studio-eligibility rules.")
]);

export const WIDE_SEARCH_MAX_OPENAI_REQUESTS = WIDE_SEARCH_SHARDS.length;
export const WIDE_SEARCH_MAX_TOOL_CALLS_PER_SHARD = 3;
export const WIDE_SEARCH_MAX_TOTAL_TOOL_CALLS = WIDE_SEARCH_MAX_OPENAI_REQUESTS * WIDE_SEARCH_MAX_TOOL_CALLS_PER_SHARD;

export function validateWideSearchPlan(shards = WIDE_SEARCH_SHARDS) {
  const ids = new Set();
  for (const item of shards) {
    if (!item?.id || ids.has(item.id) || !item?.label || !item?.focus || !item.allowed_domains?.length) return false;
    ids.add(item.id);
  }
  return true;
}
