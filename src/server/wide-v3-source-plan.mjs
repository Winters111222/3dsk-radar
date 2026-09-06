const connector = (id, label, accessMethod, gate, requiredEnv, options = {}) => Object.freeze({
  id,
  label,
  access_method:accessMethod,
  gate,
  required_env:Object.freeze(requiredEnv),
  paid:Boolean(options.paid),
  runtime_available:options.runtimeAvailable !== false,
  required_gates:Object.freeze(options.requiredGates || []),
  stores_raw_content:Boolean(options.storesRawContent),
  retention_hours:options.retentionHours ?? null,
  notes:options.notes || null
});

// These connectors deliberately avoid password automation, cookies, CAPTCHA
// bypasses and reverse-engineered private endpoints. A configured credential is
// treated as evidence that the operator completed the platform approval flow.
export const WIDE_V3_SOURCE_CONNECTORS = Object.freeze([
  connector(
    "upwork_official",
    "Upwork Marketplace",
    "OFFICIAL_GRAPHQL_OAUTH2",
    "RADAR_UPWORK_API_ENABLED",
    ["UPWORK_OAUTH_ACCESS_TOKEN", "UPWORK_API_TENANT_ID"],
    { retentionHours:24, notes:"Requires approved Read marketplace Job Postings scope; raw API payloads must expire within 24 hours." }
  ),
  connector(
    "reddit_official",
    "Reddit r/gameDevClassifieds",
    "OFFICIAL_DATA_API_OAUTH2",
    "RADAR_REDDIT_API_ENABLED",
    ["REDDIT_OAUTH_ACCESS_TOKEN"],
    { retentionHours:24, notes:"Commercial use requires Reddit approval; only the approved subreddit is queried." }
  ),
  connector(
    "bluesky_public",
    "Bluesky public posts",
    "OFFICIAL_PUBLIC_ATPROTO_API",
    "RADAR_BLUESKY_SEARCH_ENABLED",
    [],
    { notes:"Public search is discovery-only until a buyer brief or first-party destination is verified; run a deploy-region canary before enablement because CDN policy can vary by region." }
  ),
  connector(
    "mastodon_official",
    "Mastodon public posts",
    "OFFICIAL_FEDERATED_SEARCH_API",
    "RADAR_MASTODON_SEARCH_ENABLED",
    ["MASTODON_API_ORIGIN", "MASTODON_ACCESS_TOKEN"],
    { notes:"Full-text status search depends on the selected instance and an authorized read:search token." }
  ),
  connector(
    "linkedin_alert_bridge",
    "LinkedIn alerts and public index",
    "USER_AUTHORIZED_ALERT_OR_PUBLIC_INDEX",
    "RADAR_LINKEDIN_SIGNAL_ENABLED",
    ["RADAR_SOURCE_INGEST_SECRET"],
    { requiredGates:["RADAR_SOURCE_SIGNAL_INGEST_ENABLED"], notes:"No LinkedIn browser scraping. A LinkedIn URL is a discovery signal and must resolve to an original employer, ATS or buyer source." }
  ),
  connector(
    "telegram_authorized_channels",
    "Telegram authorized channels",
    "OFFICIAL_BOT_WEBHOOK",
    "RADAR_TELEGRAM_SOURCE_ENABLED",
    ["RADAR_SOURCE_INGEST_SECRET", "TELEGRAM_SOURCE_BOT_TOKEN", "TELEGRAM_SOURCE_ALLOWED_CHATS"],
    { requiredGates:["RADAR_SOURCE_SIGNAL_INGEST_ENABLED"], notes:"Receives only posts visible to a bot explicitly added to allowlisted channels or groups." }
  ),
  connector(
    "discord_authorized_channels",
    "Discord authorized channels",
    "OFFICIAL_BOT_EVENTS",
    "RADAR_DISCORD_SOURCE_ENABLED",
    ["RADAR_SOURCE_INGEST_SECRET", "DISCORD_SOURCE_BOT_TOKEN", "DISCORD_SOURCE_ALLOWED_CHANNELS"],
    { requiredGates:["RADAR_SOURCE_SIGNAL_INGEST_ENABLED"], notes:"Receives only events from allowlisted servers/channels where the bot was invited." }
  ),
  connector(
    "x_official",
    "X public posts",
    "OFFICIAL_X_SEARCH_API",
    "RADAR_X_SEARCH_ENABLED",
    ["X_API_BEARER_TOKEN"],
    { paid:true, runtimeAvailable:false, notes:"Consumption-billed official API only; the runtime adapter is intentionally not implemented until separately approved and budgeted." }
  )
]);

const truthy = (value) => String(value || "").trim().toLowerCase() === "true";

export function sourceConnectorReadiness(getEnv = (key) => process.env[key]) {
  return WIDE_V3_SOURCE_CONNECTORS.map((item) => {
    const enabled = truthy(getEnv(item.gate));
    const missing = item.required_env.filter((key) => !String(getEnv(key) || "").trim());
    missing.push(...item.required_gates.filter((key) => !truthy(getEnv(key))).map((key) => `${key}=true`));
    if (!item.runtime_available) missing.push("OFFICIAL_SOURCE_ADAPTER_NOT_IMPLEMENTED");
    return {
      id:item.id,
      label:item.label,
      access_method:item.access_method,
      paid:item.paid,
      runtime_available:item.runtime_available,
      status:enabled ? (missing.length ? "CONFIG_REQUIRED" : "CONFIG_READY") : "LOCKED",
      missing_configuration:enabled ? missing : [],
      retention_hours:item.retention_hours,
      notes:item.notes
    };
  });
}

const shard = (id, label, domains, focus, signalOnlyDomains = []) => Object.freeze({
  id,
  label,
  allowed_domains:Object.freeze(domains),
  signal_only_domains:Object.freeze(signalOnlyDomains),
  focus
});

// WIDE V3 remains default-off. The production policy accepts it only with its
// separate exact budget, request caps and at least one ready official adapter.
export const WIDE_V3_SEARCH_SHARDS = Object.freeze([
  shard("marketplaces_core", "Direct marketplaces — core", ["upwork.com", "freelancer.com", "peopleperhour.com", "guru.com"],
    "Find buyer-posted, current human photogrammetry, scan cleanup, Wrap/basemesh, digital-human, facial/FACS or realistic-character production projects. Reject seller profiles and service listings."),
  shard("communities_paid", "Paid 3D and game communities", ["reddit.com", "forums.unrealengine.com", "polycount.com", "blenderartists.org"],
    "Find current paid or hiring posts with a real buyer brief. Reject FOR HIRE, unpaid, rev-share-only, portfolio and seller posts."),
  shard("contract_boards", "Contract and freelance boards", ["workwithindies.com", "remotegamejobs.com", "hitmarker.net", "gamesjobsdirect.com", "artstation.com", "gamejobs.co", "vfxengine.com"],
    "Find worldwide or remote contract/freelance work that can accept a studio vendor. Ordinary employee roles are signals, not open B2B opportunities."),
  shard("ats_external_development", "ATS external-development signals", ["greenhouse.io", "lever.co", "ashbyhq.com", "smartrecruiters.com", "workable.com", "teamtailor.com", "recruitee.com"],
    "Find vendor management, outsourcing, co-development, external development and production-overflow demand on original employer ATS details."),
  shard("procurement", "Public procurement", ["ted.europa.eu", "find-tender.service.gov.uk", "contractsfinder.service.gov.uk", "sam.gov", "canadabuys.canada.ca", "ungm.org", "procurement-notices.undp.org", "worldbank.org"],
    "Find open service tenders for human scanning, photogrammetry processing, digital humans, facial capture or character production. Reject equipment, GIS, BIM, mapping and building scans."),
  shard("social_signals", "Public social demand signals", ["linkedin.com", "reddit.com", "bsky.app", "mastodon.social", "x.com", "greenhouse.io", "lever.co", "ashbyhq.com", "smartrecruiters.com", "workable.com", "teamtailor.com", "recruitee.com"],
    "Find recent public posts from buyers, producers, art directors or outsourcing managers asking for vendors, external teams or paid character-production help. Resolve every signal to an original buyer, employer, ATS or marketplace detail before acceptance.",
    ["linkedin.com", "bsky.app", "mastodon.social", "x.com"]),
  shard("supplier_and_partner", "Supplier and partner routes", ["een.ec.europa.eu", "ec.europa.eu", "supplier.sonypictures.com"],
    "Find buyer requests, supplier onboarding and partnership calls relevant to the 3D.SK character pipeline. Seller offers and generic registration pages are not open opportunities."),
  shard("worldwide_multilingual", "Worldwide multilingual sweep", ["upwork.com", "freelancer.com", "reddit.com", "workwithindies.com", "greenhouse.io", "lever.co", "ashbyhq.com", "ted.europa.eu", "ungm.org", "linkedin.com", "bsky.app"],
    "Search English, Czech, German, French, Spanish, Italian, Polish, Portuguese and Japanese demand vocabulary while preserving buyer, freshness and studio-eligibility gates.",
    ["linkedin.com", "bsky.app"])
]);

export const WIDE_V3_MAX_OPENAI_REQUESTS = WIDE_V3_SEARCH_SHARDS.length;
export const WIDE_V3_MAX_HOSTED_SEARCH_CALLS = WIDE_V3_MAX_OPENAI_REQUESTS * 3;

export const WIDE_V3_FIRECRAWL_SHARD_IDS = Object.freeze([
  "marketplaces_core",
  "communities_paid",
  "contract_boards",
  "procurement",
  "worldwide_multilingual"
]);

export function wideV3FirecrawlShards(shards = WIDE_V3_SEARCH_SHARDS) {
  return WIDE_V3_FIRECRAWL_SHARD_IDS.map((id) => shards.find((item) => item.id === id)).filter(Boolean);
}

export function validateWideV3Plan(shards = WIDE_V3_SEARCH_SHARDS) {
  if (!Array.isArray(shards) || shards.length !== 8) return false;
  const ids = new Set();
  return shards.every((item) => {
    if (!item?.id || ids.has(item.id) || !item?.label || !item?.focus || !item.allowed_domains?.length) return false;
    ids.add(item.id);
    return item.signal_only_domains.every((domain) => item.allowed_domains.includes(domain));
  });
}
