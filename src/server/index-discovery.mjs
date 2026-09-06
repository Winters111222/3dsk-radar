export const INDEX_DISCOVERY_MODE = "INDEX_DISCOVERY_MANUAL_VERIFY";
export const INDEX_DISCOVERY_ACCESS_METHOD = "OPENAI_HOSTED_WEB_SEARCH";
export const INDEX_DISCOVERY_MANUAL_STATUS = "REQUIRED_BEFORE_CONTACT";

export const INDEX_DISCOVERY_SOURCE_POLICIES = Object.freeze([
  Object.freeze({
    id:"upwork",
    label:"Upwork",
    domain:"upwork.com",
    path_description:"/freelance-jobs/apply/…",
    path_pattern:/^\/freelance-jobs\/apply\/[^/]+\/?$/i
  }),
  Object.freeze({
    id:"freelancer",
    label:"Freelancer",
    domain:"freelancer.com",
    path_description:"/projects/…",
    path_pattern:/^\/projects\/[^/]+\/[^/]+\/?$/i
  }),
  Object.freeze({
    id:"reddit_gamedevclassifieds",
    label:"Reddit r/gameDevClassifieds",
    domain:"reddit.com",
    path_description:"/r/gameDevClassifieds/comments/…",
    path_pattern:/^\/r\/gamedevclassifieds\/comments\/[a-z0-9]+(?:\/[^/]+)?\/?$/i
  }),
  Object.freeze({
    id:"unreal_job_offerings",
    label:"Unreal Engine Forums",
    domain:"forums.unrealengine.com",
    path_description:"/t/…",
    path_pattern:/^\/t\/[^/]+\/\d+\/?$/i
  }),
  Object.freeze({
    id:"polycount_paid",
    label:"Polycount",
    domain:"polycount.com",
    path_description:"/discussion/…",
    path_pattern:/^\/discussion\/\d+(?:\/[^/]+)?\/?$/i
  })
]);

export const INDEX_DISCOVERY_ALLOWED_DOMAINS = Object.freeze(
  INDEX_DISCOVERY_SOURCE_POLICIES.map((policy) => policy.domain)
);

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
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
  const hostname = url.hostname.toLowerCase();
  return INDEX_DISCOVERY_SOURCE_POLICIES.find((policy) => hostnameMatches(hostname, policy.domain)) || null;
}

export function indexDiscoveryPolicyForUrl(value) {
  const domainPolicy = indexDiscoveryDomainPolicyForUrl(value);
  if (!domainPolicy) return null;
  const url = new URL(value.trim());
  return domainPolicy.path_pattern.test(url.pathname) ? domainPolicy : null;
}

export function indexDiscoveryMetadata(sourceUrl) {
  const policy = indexDiscoveryPolicyForUrl(sourceUrl);
  if (!policy) return null;
  return {
    discovery_mode:INDEX_DISCOVERY_MODE,
    source_access_method:INDEX_DISCOVERY_ACCESS_METHOD,
    discovery_source_id:policy.id,
    manual_verification_status:INDEX_DISCOVERY_MANUAL_STATUS,
    manual_verified_at:null,
    direct_source_requests:0
  };
}

export function indexDiscoveryPolicySummary() {
  return INDEX_DISCOVERY_SOURCE_POLICIES.map((policy) =>
    `${policy.label}: ${policy.domain}${policy.path_description}`
  ).join("; ");
}
