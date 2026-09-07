export const INDEX_DISCOVERY_MODE = "INDEX_DISCOVERY_MANUAL_VERIFY";
export const INDEX_DISCOVERY_ACCESS_METHOD = "OPENAI_HOSTED_WEB_SEARCH";
export const INDEX_DISCOVERY_MANUAL_STATUS = "REQUIRED_BEFORE_CONTACT";

function policy(id, label, domain, pathDescription, pathPattern, lane) {
  return Object.freeze({ id, label, domain, path_description:pathDescription, path_pattern:pathPattern, lane });
}

// Candidate URLs must be public detail records. Listing, profile, search and home
// pages may be consulted by hosted search, but can never become opportunities.
export const INDEX_DISCOVERY_SOURCE_POLICIES = Object.freeze([
  policy("upwork", "Upwork", "upwork.com", "/freelance-jobs/apply/...", /^\/freelance-jobs\/apply\/[^/]+\/?$/i, "MARKETPLACE"),
  policy("freelancer", "Freelancer", "freelancer.com", "/projects/.../...", /^\/projects\/[^/]+\/[^/]+\/?$/i, "MARKETPLACE"),
  policy("peopleperhour", "PeoplePerHour", "peopleperhour.com", "/freelance-jobs/<category>/<subcategory>/<project-id>", /^\/freelance-jobs\/[^/]+\/[^/]+\/[^/]+-\d+\/?$/i, "MARKETPLACE"),
  policy("guru", "Guru", "guru.com", "/jobs/.../...", /^\/jobs\/[^/]+\/[^/]+\/?$/i, "MARKETPLACE"),

  policy("reddit_gamedevclassifieds", "Reddit r/gameDevClassifieds", "reddit.com", "/r/gameDevClassifieds/comments/...", /^\/r\/gamedevclassifieds\/comments\/[a-z0-9]+(?:\/[^/]+)?\/?$/i, "COMMUNITY"),
  policy("unreal_job_offerings", "Unreal Engine Forums", "forums.unrealengine.com", "/t/.../<id>", /^\/t\/[^/]+\/\d+\/?$/i, "COMMUNITY"),
  policy("polycount_paid", "Polycount", "polycount.com", "/discussion/<id>/...", /^\/discussion\/\d+(?:\/[^/]+)?\/?$/i, "COMMUNITY"),
  policy("blender_paid", "Blender Artists", "blenderartists.org", "/t/.../<id>", /^\/t\/[^/]+\/\d+\/?$/i, "COMMUNITY"),

  policy("workwithindies", "Work With Indies", "workwithindies.com", "/careers/...", /^\/careers\/[^/]+\/?$/i, "CONTRACT_JOBS"),
  policy("remote_game_jobs", "Remote Game Jobs", "remotegamejobs.com", "/jobs/...", /^\/jobs\/[^/]+\/?$/i, "CONTRACT_JOBS"),
  policy("hitmarker", "Hitmarker", "hitmarker.net", "/jobs/...", /^\/jobs\/(?!search\/?$)[^/]+(?:\/[^/]+)?\/?$/i, "CONTRACT_JOBS"),
  policy("gamesjobsdirect", "Games Jobs Direct", "gamesjobsdirect.com", "/job/.../<id>", /^\/job\/[^/]+\/[^/]+\/\d+\/?$/i, "CONTRACT_JOBS"),
  policy("artstation_jobs", "ArtStation Jobs", "artstation.com", "/jobs/...", /^\/jobs\/(?!search\/?$)[^/]+\/?$/i, "CONTRACT_JOBS"),
  policy("gamejobs_co", "GameJobs.co", "gamejobs.co", "/<role>-at-<company>", /^\/[^/]+-at-[^/]+\/?$/i, "CONTRACT_JOBS"),
  policy("vfxengine", "VFXengine", "vfxengine.com", "/jobs/...", /^\/jobs\/(?!search\/?$)[^/]+\/?$/i, "CONTRACT_JOBS"),
  policy("greenhouse", "Greenhouse job boards", "greenhouse.io", "/.../jobs/<id>", /^\/(?:embed\/job_app|[^/]+\/jobs\/\d+)\/?$/i, "CONTRACT_JOBS"),
  policy("lever", "Lever job boards", "lever.co", "/<company>/<posting-id>", /^\/[^/]+\/[a-f0-9-]{20,}\/?$/i, "CONTRACT_JOBS"),
  policy("ashby", "Ashby job boards", "ashbyhq.com", "/<company>/<posting-id>", /^\/[^/]+\/[a-f0-9-]{20,}\/?$/i, "CONTRACT_JOBS"),
  policy("smartrecruiters", "SmartRecruiters", "smartrecruiters.com", "/<company>/<job-id>", /^\/[^/]+\/\d+-[^/]+\/?$/i, "CONTRACT_JOBS"),
  policy("workable", "Workable job boards", "workable.com", "/j/<posting-id>", /^\/j\/[a-z0-9]+\/?$/i, "CONTRACT_JOBS"),
  policy("teamtailor", "Teamtailor job boards", "teamtailor.com", "/jobs/<id>-...", /^\/jobs\/\d+-[^/]+\/?$/i, "CONTRACT_JOBS"),
  policy("recruitee", "Recruitee job boards", "recruitee.com", "/o/...", /^\/o\/[^/]+\/?$/i, "CONTRACT_JOBS"),

  policy("ted_eu", "TED EU tenders", "ted.europa.eu", "/.../notice/-/detail/...", /^\/(?:[a-z]{2}\/)?notice\/-\/detail\/\d+-\d+\/?$/i, "PROCUREMENT"),
  policy("find_tender_uk", "Find a Tender", "find-tender.service.gov.uk", "/Notice/...", /^\/Notice\/\d+-\d+\/?$/i, "PROCUREMENT"),
  policy("contracts_finder_uk", "Contracts Finder", "contractsfinder.service.gov.uk", "/Notice/...", /^\/Notice\/[a-f0-9-]+\/?$/i, "PROCUREMENT"),
  policy("sam_gov", "SAM.gov", "sam.gov", "/opp/.../view", /^\/opp\/[a-f0-9-]+\/view\/?$/i, "PROCUREMENT"),
  policy("canadabuys", "CanadaBuys", "canadabuys.canada.ca", "/.../tender-notice/...", /^\/(?:en|fr)\/tender-opportunities\/tender-notice\/[^/]+\/?$/i, "PROCUREMENT"),
  policy("ungm", "UN Global Marketplace", "ungm.org", "/Public/Notice/<id>", /^\/Public\/Notice\/\d+\/?$/i, "PROCUREMENT"),
  policy("undp", "UNDP Procurement Notices", "procurement-notices.undp.org", "/view_negotiation.cfm?nego_id=...", /^\/view_negotiation\.cfm$/i, "PROCUREMENT"),
  policy("world_bank", "World Bank Procurement", "worldbank.org", "/.../procurement-detail/...", /^\/en\/projects-operations\/procurement-detail\/[^/]+\/?$/i, "PROCUREMENT")
]);

export const INDEX_DISCOVERY_ALLOWED_DOMAINS = Object.freeze(
  [...new Set(INDEX_DISCOVERY_SOURCE_POLICIES.map((item) => item.domain))]
);

export const FOCUSED_INDEX_DISCOVERY_ALLOWED_DOMAINS = Object.freeze([
  "upwork.com",
  "freelancer.com",
  "reddit.com",
  "forums.unrealengine.com",
  "polycount.com"
]);

function hostnameMatches(hostname, domain) {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

export function indexDiscoveryDomainPolicyForUrl(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
  const hostname = url.hostname.toLowerCase();
  return INDEX_DISCOVERY_SOURCE_POLICIES.find((item) => hostnameMatches(hostname, item.domain)) || null;
}

export function indexDiscoveryPolicyForUrl(value) {
  const domainPolicy = indexDiscoveryDomainPolicyForUrl(value);
  if (!domainPolicy) return null;
  const url = new URL(value.trim());
  return domainPolicy.path_pattern.test(url.pathname) ? domainPolicy : null;
}

export function indexDiscoveryMetadata(sourceUrl) {
  const sourcePolicy = indexDiscoveryPolicyForUrl(sourceUrl);
  if (!sourcePolicy) return null;
  return {
    discovery_mode:INDEX_DISCOVERY_MODE,
    source_access_method:INDEX_DISCOVERY_ACCESS_METHOD,
    discovery_source_id:sourcePolicy.id,
    discovery_lane:sourcePolicy.lane,
    manual_verification_status:INDEX_DISCOVERY_MANUAL_STATUS,
    manual_verified_at:null,
    manual_verified_source_url:null,
    direct_source_requests:0
  };
}

export function indexDiscoveryPolicySummary(allowedDomains = INDEX_DISCOVERY_ALLOWED_DOMAINS) {
  const allowed = new Set(allowedDomains);
  return INDEX_DISCOVERY_SOURCE_POLICIES
    .filter((item) => allowed.has(item.domain))
    .map((item) => `${item.label}: ${item.domain}${item.path_description}`)
    .join("; ");
}
