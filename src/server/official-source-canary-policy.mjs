import { sourceConnectorReadiness } from "./wide-v3-source-plan.mjs";

export const OFFICIAL_SOURCE_CANARY_CONFIRMATION = "RUN_WIDE_V3_FREE_SOURCE_CANARY_ONCE";

const PROFILES = Object.freeze({
  BLUESKY_ONLY:Object.freeze({ source_ids:Object.freeze(["bluesky_public"]), request_limit:1 }),
  BLUESKY_MASTODON:Object.freeze({ source_ids:Object.freeze(["bluesky_public", "mastodon_official"]), request_limit:2 })
});

const enabled = (value) => String(value || "").trim().toLowerCase() === "true";
const normalized = (value) => String(value || "").trim();
const exactCommit = (value) => /^[0-9a-f]{40}$/.test(value);
const immutableDeployUrl = (value) => /^https:\/\/[0-9a-f]{24}--3dsk-opportunity-radar\.netlify\.app\/?$/.test(value);
const RADAR_REPOSITORY_URL = "https://github.com/Winters111222/3dsk-radar";

function deploymentProvenance(context, getEnv) {
  const deployContext = normalized(context?.deploy?.context);
  if (deployContext === "deploy-preview") {
    return { ok:true, deploy_context:deployContext, branch:normalized(getEnv("BRANCH")), commit_ref:normalized(getEnv("COMMIT_REF")).toLowerCase(), deploy_url:normalized(getEnv("DEPLOY_URL")) };
  }
  if (deployContext !== "branch-deploy") return { ok:false, code:"OFFICIAL_SOURCE_CANARY_PREVIEW_REQUIRED" };
  if (!enabled(getEnv("RADAR_OFFICIAL_SOURCE_CANARY_BRANCH_DEPLOY_ENABLED"))) return { ok:false, code:"OFFICIAL_SOURCE_CANARY_BRANCH_DEPLOY_LOCKED" };
  if (!enabled(getEnv("NETLIFY")) || normalized(getEnv("CONTEXT")) !== "branch-deploy" || normalized(getEnv("REPOSITORY_URL")).replace(/\.git$/, "") !== RADAR_REPOSITORY_URL) {
    return { ok:false, code:"OFFICIAL_SOURCE_CANARY_GIT_PROVENANCE_REQUIRED" };
  }

  const expectedBranch = normalized(getEnv("RADAR_OFFICIAL_SOURCE_CANARY_EXPECTED_BRANCH"));
  const expectedCommit = normalized(getEnv("RADAR_OFFICIAL_SOURCE_CANARY_EXPECTED_COMMIT")).toLowerCase();
  const expectedDeployUrl = normalized(getEnv("RADAR_OFFICIAL_SOURCE_CANARY_EXPECTED_DEPLOY_URL"));
  const actualBranch = normalized(getEnv("BRANCH"));
  const actualCommit = normalized(getEnv("COMMIT_REF")).toLowerCase();
  const actualDeployUrl = normalized(getEnv("DEPLOY_URL"));

  if (!expectedBranch || actualBranch !== expectedBranch) return { ok:false, code:"OFFICIAL_SOURCE_CANARY_BRANCH_MISMATCH" };
  if (!exactCommit(expectedCommit) || actualCommit !== expectedCommit) return { ok:false, code:"OFFICIAL_SOURCE_CANARY_COMMIT_MISMATCH" };
  if (!immutableDeployUrl(expectedDeployUrl) || actualDeployUrl !== expectedDeployUrl) return { ok:false, code:"OFFICIAL_SOURCE_CANARY_DEPLOY_URL_MISMATCH" };
  return { ok:true, deploy_context:deployContext, branch:actualBranch, commit_ref:actualCommit, deploy_url:actualDeployUrl, repository_url:RADAR_REPOSITORY_URL };
}

export function officialSourceCanaryConfiguration({ context, getEnv = (key) => process.env[key] } = {}) {
  const provenance = deploymentProvenance(context, getEnv);
  if (!provenance.ok) return provenance;
  if (!enabled(getEnv("RADAR_OFFICIAL_SOURCE_CANARY_ENABLED"))) return { ok:false, code:"OFFICIAL_SOURCE_CANARY_LOCKED" };
  if (enabled(getEnv("RADAR_LIVE_AI_ENABLED"))) return { ok:false, code:"OFFICIAL_SOURCE_CANARY_LIVE_AI_MUST_BE_LOCKED" };
  const profileName = String(getEnv("RADAR_OFFICIAL_SOURCE_CANARY_PROFILE") || "").trim().toUpperCase();
  const profile = PROFILES[profileName];
  if (!profile) return { ok:false, code:"OFFICIAL_SOURCE_CANARY_PROFILE_INVALID" };
  const requestLimit = Number(String(getEnv("RADAR_OFFICIAL_SOURCE_CANARY_MAX_REQUESTS") || "").trim());
  if (!Number.isInteger(requestLimit) || requestLimit !== profile.request_limit) {
    return { ok:false, code:"OFFICIAL_SOURCE_CANARY_REQUEST_LIMIT_INVALID" };
  }
  const readiness = new Map(sourceConnectorReadiness(getEnv).map((item) => [item.id, item]));
  const blocked = profile.source_ids.filter((sourceId) => readiness.get(sourceId)?.status !== "CONFIG_READY");
  if (blocked.length) return { ok:false, code:"OFFICIAL_SOURCE_CANARY_CONNECTOR_NOT_READY", blocked_sources:blocked };
  return { ok:true, ...provenance, profile:profileName, source_ids:[...profile.source_ids], request_limit:profile.request_limit, max_results_per_source:10 };
}
