import { collectOfficialSource } from "./official-source-discovery.mjs";
import { sourceConnectorReadiness } from "./wide-v3-source-plan.mjs";

export const OFFICIAL_SOURCE_MAX_REQUESTS = 4;

const SOURCE_ORDER = Object.freeze([
  "upwork_official",
  "reddit_official",
  "bluesky_public",
  "mastodon_official"
]);

const QUERY_BY_SOURCE = Object.freeze({
  upwork_official:'("3D character" OR photogrammetry OR "scan cleanup" OR "digital human" OR "R3DS Wrap") AND (contract OR project OR vendor OR freelance)',
  reddit_official:'(hiring OR paid) ("3D character" OR photogrammetry OR "scan cleanup" OR "digital human" OR "character artist")',
  bluesky_public:'("3D character" OR photogrammetry OR "digital human") (hiring OR contract OR vendor)',
  mastodon_official:'("3D character" OR photogrammetry OR "digital human") (hiring OR contract OR vendor)'
});

const SHARDS_BY_SOURCE = Object.freeze({
  upwork_official:Object.freeze(["marketplaces_core", "worldwide_multilingual"]),
  reddit_official:Object.freeze(["communities_paid", "social_signals", "worldwide_multilingual"]),
  bluesky_public:Object.freeze(["social_signals", "worldwide_multilingual"]),
  mastodon_official:Object.freeze(["social_signals"]),
  linkedin_alert_bridge:Object.freeze(["social_signals", "worldwide_multilingual"]),
  telegram_authorized_channels:Object.freeze(["social_signals", "worldwide_multilingual"]),
  discord_authorized_channels:Object.freeze(["social_signals", "worldwide_multilingual"])
});

function configForSource(sourceId, getEnv) {
  if (sourceId === "upwork_official") return {
    accessToken:getEnv("UPWORK_OAUTH_ACCESS_TOKEN"),
    tenantId:getEnv("UPWORK_API_TENANT_ID")
  };
  if (sourceId === "reddit_official") return { accessToken:getEnv("REDDIT_OAUTH_ACCESS_TOKEN") };
  if (sourceId === "mastodon_official") return {
    origin:getEnv("MASTODON_API_ORIGIN"),
    accessToken:getEnv("MASTODON_ACCESS_TOKEN")
  };
  return {};
}

export function officialSourceRunPlan(getEnv = (key) => process.env[key]) {
  const readiness = new Map(sourceConnectorReadiness(getEnv).map((item) => [item.id, item]));
  return SOURCE_ORDER.filter((sourceId) => readiness.get(sourceId)?.status === "CONFIG_READY")
    .slice(0, OFFICIAL_SOURCE_MAX_REQUESTS)
    .map((sourceId) => ({
      source_id:sourceId,
      query:QUERY_BY_SOURCE[sourceId],
      config:configForSource(sourceId, getEnv),
      shard_ids:SHARDS_BY_SOURCE[sourceId]
    }));
}

function safeErrorCode(error) {
  return String(error?.code || error?.message || "OFFICIAL_SOURCE_FAILED").slice(0, 100);
}

function dedupeHints(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = item.source_url || `${item.source_id}:${item.source_item_id}`;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function runOfficialWideDiscovery({ getEnv = (key) => process.env[key], fetchImpl = fetch, limitPerSource = 10 } = {}) {
  const plan = officialSourceRunPlan(getEnv);
  if (!plan.length) return {
    provider:"OFFICIAL_APIS",
    status:"LOCKED",
    requests:0,
    request_cap:OFFICIAL_SOURCE_MAX_REQUESTS,
    hints:[],
    sources:[]
  };

  const sources = await Promise.all(plan.map(async (item) => {
    try {
      const result = await collectOfficialSource({
        sourceId:item.source_id,
        config:item.config,
        query:item.query,
        limit:limitPerSource,
        fetchImpl
      });
      return { ...result, shard_ids:item.shard_ids, error_code:null };
    } catch (error) {
      return {
        source_id:item.source_id,
        status:"FAILED",
        requests:1,
        items:[],
        shard_ids:item.shard_ids,
        counters:{ source_requests:1, candidates_seen:0, openai_requests:0, retries:0, cost_usd:0 },
        error_code:safeErrorCode(error)
      };
    }
  }));
  const requests = sources.reduce((sum, item) => sum + item.requests, 0);
  if (requests > OFFICIAL_SOURCE_MAX_REQUESTS) throw Object.assign(new Error("OFFICIAL_SOURCE_REQUEST_CAP_EXCEEDED"), { code:"OFFICIAL_SOURCE_REQUEST_CAP_EXCEEDED" });
  const hints = dedupeHints(sources.flatMap((source) => source.items.map((item) => ({ ...item, shard_ids:source.shard_ids }))));
  return {
    provider:"OFFICIAL_APIS",
    status:sources.every((item) => item.status === "COMPLETE") ? "COMPLETE" : "PARTIAL",
    requests,
    request_cap:OFFICIAL_SOURCE_MAX_REQUESTS,
    hints,
    sources
  };
}

export function officialHintsForShard(discovery, shardId) {
  return (discovery?.hints || []).filter((item) => item.shard_ids?.includes(shardId)).map((item) => ({
    url:item.source_url,
    title:item.title,
    description:item.excerpt,
    excerpt:item.excerpt,
    rendered:false,
    discovery_source_id:item.source_id,
    discovery_only:true,
    requires_original_verification:true
  }));
}

export function mergeStoredSourceSignals(discovery, signals, nowIso, maxSignals = 25) {
  const cutoff = Date.parse(nowIso) - 30 * 24 * 60 * 60 * 1000;
  const normalized = (Array.isArray(signals) ? signals : []).filter((item) => {
    const published = Date.parse(String(item?.published_at || ""));
    return item?.discovery_only === true
      && item?.requires_original_verification === true
      && SHARDS_BY_SOURCE[item?.source_id]
      && Number.isFinite(published)
      && published >= cutoff
      && published <= Date.parse(nowIso);
  }).sort((left, right) => Date.parse(right.published_at) - Date.parse(left.published_at)).slice(0, Math.max(0, Math.min(25, Number(maxSignals) || 25)))
    .map((item) => ({
      source_id:item.source_id,
      source_item_id:item.source_event_id,
      source_url:item.source_url,
      title:item.text,
      excerpt:item.text,
      published_at:item.published_at,
      author:item.author || null,
      discovery_only:true,
      requires_original_verification:true,
      shard_ids:SHARDS_BY_SOURCE[item.source_id],
      stored_signal:true
    }));
  const base = discovery || { provider:"OFFICIAL_APIS", status:"LOCKED", requests:0, request_cap:OFFICIAL_SOURCE_MAX_REQUESTS, hints:[], sources:[] };
  return { ...base, hints:dedupeHints([...(base.hints || []), ...normalized]), stored_signal_count:normalized.length };
}

export function summarizeOfficialWideDiscovery(discovery) {
  if (!discovery) return null;
  return {
    provider:"OFFICIAL_APIS",
    status:discovery.status,
    requests:Number(discovery.requests || 0),
    request_cap:OFFICIAL_SOURCE_MAX_REQUESTS,
    candidates_seen:(discovery.hints || []).length,
    stored_signal_count:Number(discovery.stored_signal_count || 0),
    sources:(discovery.sources || []).map((item) => ({
      source_id:item.source_id,
      status:item.status,
      requests:Number(item.requests || 0),
      candidates_seen:Array.isArray(item.items) ? item.items.length : 0,
      error_code:item.error_code || null
    }))
  };
}
