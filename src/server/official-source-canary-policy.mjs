import { sourceConnectorReadiness } from "./wide-v3-source-plan.mjs";
import { bearerToken, constantTimeEqual } from "./auth.mjs";
import { readBuildMetadata } from "./runtime.mjs";

export const OFFICIAL_SOURCE_CANARY_CONFIRMATION = "RUN_WIDE_V3_FREE_SOURCE_CANARY_ONCE";
export const OFFICIAL_SOURCE_CANARY_ACCESS_TOKEN_MIN_LENGTH = 32;
const OFFICIAL_SOURCE_CANARY_CONTEXT = "deploy-preview";
const OFFICIAL_SOURCE_CANARY_BRANCH_CONTEXT = "branch-deploy";

const PROFILES = Object.freeze({
  BLUESKY_ONLY:Object.freeze({ source_ids:Object.freeze(["bluesky_public"]), request_limit:1 }),
  BLUESKY_MASTODON:Object.freeze({ source_ids:Object.freeze(["bluesky_public", "mastodon_official"]), request_limit:2 })
});

const enabled = (value) => String(value || "").trim().toLowerCase() === "true";
const normalized = (value) => String(value || "").trim();
const exactCommit = (value) => /^[0-9a-f]{40}$/.test(value);
const exactDeployId = (value) => /^[0-9a-f]{24}$/.test(value);
const RADAR_REPOSITORY_URL = "https://github.com/winters111222/3dsk-radar";
const RADAR_SITE_NAME = "3dsk-opportunity-radar";

function expectedImmutableDeployUrl(deployId) {
  return `https://${deployId}--${RADAR_SITE_NAME}.netlify.app`;
}

function normalizeRuntimeUrl(value) {
  return normalized(value).replace(/\/$/, "");
}

function canonicalizeCanaryMetadata(metadata = {}) {
  return {
    service: normalized(metadata.service),
    schema_version: Number(metadata.schema_version),
    commit_ref: normalized(metadata.commit_ref).toLowerCase(),
    deploy_context: normalized(metadata.deploy_context),
    repository_url: normalized(metadata.repository_url).replace(/\.git$/, "").toLowerCase(),
    branch: normalized(metadata.branch),
    site_name: normalized(metadata.site_name),
    site_id: normalized(metadata.site_id),
    artifact_provenance: normalized(metadata.artifact_provenance)
  };
}

function validCanaryMetadata(metadata) {
  if (!metadata || typeof metadata !== "object") return null;
  const normalizedMetadata = canonicalizeCanaryMetadata(metadata);
  if (normalizedMetadata.schema_version !== 2 || normalizedMetadata.service !== "3dsk-opportunity-radar" || !exactCommit(normalizedMetadata.commit_ref)) return null;
  if (normalizedMetadata.repository_url !== RADAR_REPOSITORY_URL) return null;
  if (!normalizedMetadata.site_name || !normalizedMetadata.site_id) return null;
  return normalizedMetadata;
}

function deploymentProvenance(context, getEnv, getBuildMetadata = readBuildMetadata) {
  const deployContext = normalized(context?.deploy?.context);
  if (![OFFICIAL_SOURCE_CANARY_CONTEXT, OFFICIAL_SOURCE_CANARY_BRANCH_CONTEXT].includes(deployContext)) return { ok:false, code:"OFFICIAL_SOURCE_CANARY_PREVIEW_REQUIRED" };

  const sealedMetadata = validCanaryMetadata(getBuildMetadata());
  if (!sealedMetadata) return { ok:false, code:"OFFICIAL_SOURCE_CANARY_GIT_PROVENANCE_REQUIRED" };

  if (deployContext === OFFICIAL_SOURCE_CANARY_CONTEXT) {
    return {
      ok:true,
      deploy_context:OFFICIAL_SOURCE_CANARY_CONTEXT,
      branch:sealedMetadata.branch,
      commit_ref:sealedMetadata.commit_ref,
      repository_url:sealedMetadata.repository_url,
      artifact_provenance:sealedMetadata.artifact_provenance,
      deploy_id: normalized(context?.deploy?.id).toLowerCase(),
      deploy_url: normalizeRuntimeUrl(context?.site?.url)
    };
  }

  if (!enabled(getEnv("RADAR_OFFICIAL_SOURCE_CANARY_BRANCH_DEPLOY_ENABLED"))) return { ok:false, code:"OFFICIAL_SOURCE_CANARY_BRANCH_DEPLOY_LOCKED" };
  if (!exactDeployId(normalized(context?.deploy?.id).toLowerCase())) return { ok:false, code:"OFFICIAL_SOURCE_CANARY_DEPLOY_URL_MISMATCH" };

  const expectedSiteName = sealedMetadata.site_name;
  const expectedSiteId = sealedMetadata.site_id;
  if (normalized(context?.site?.name) !== expectedSiteName || normalized(context?.site?.id) !== expectedSiteId) {
    return { ok:false, code:"OFFICIAL_SOURCE_CANARY_GIT_PROVENANCE_REQUIRED" };
  }

  const expectedBranch = normalized(getEnv("RADAR_OFFICIAL_SOURCE_CANARY_EXPECTED_BRANCH"));
  const expectedCommit = normalized(getEnv("RADAR_OFFICIAL_SOURCE_CANARY_EXPECTED_COMMIT")).toLowerCase();
  const actualBranch = sealedMetadata.branch;
  const actualCommit = sealedMetadata.commit_ref;
  const actualDeployId = normalized(context?.deploy?.id).toLowerCase();
  const actualDeployUrl = normalizeRuntimeUrl(context?.site?.url);
  const expectedDeployUrl = expectedImmutableDeployUrl(actualDeployId);

  if (!expectedBranch || actualBranch !== expectedBranch) return { ok:false, code:"OFFICIAL_SOURCE_CANARY_BRANCH_MISMATCH" };
  if (!exactCommit(expectedCommit) || actualCommit !== expectedCommit) return { ok:false, code:"OFFICIAL_SOURCE_CANARY_COMMIT_MISMATCH" };
  if (sealedMetadata.artifact_provenance !== "NETLIFY_GIT_DEPLOY") {
    return { ok:false, code:"OFFICIAL_SOURCE_CANARY_GIT_PROVENANCE_REQUIRED" };
  }
  if (expectedDeployUrl !== actualDeployUrl) {
    return { ok:false, code:"OFFICIAL_SOURCE_CANARY_DEPLOY_URL_MISMATCH" };
  }
  return {
    ok:true,
    deploy_context:deployContext,
    branch:actualBranch,
    commit_ref:actualCommit,
    artifact_provenance:sealedMetadata.artifact_provenance,
    deploy_id:actualDeployId,
    deploy_url:actualDeployUrl,
    repository_url:RADAR_REPOSITORY_URL
  };
}

export function officialSourceCanaryConfiguration({ context, getEnv = (key) => process.env[key], getBuildMetadata = readBuildMetadata } = {}) {
  const provenance = deploymentProvenance(context, getEnv, getBuildMetadata);
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

export function authorizeOfficialSourceCanaryRequest({ request, configuration, getEnv = (key) => process.env[key] } = {}) {
  const token = bearerToken(request);
  const internalSecret = String(getEnv("RADAR_INTERNAL_ACCESS_SECRET") || "");
  if (constantTimeEqual(token, internalSecret)) return { ok:true, mechanism:"internal" };

  const canaryAccessToken = String(getEnv("RADAR_OFFICIAL_SOURCE_CANARY_ACCESS_TOKEN") || "");
  if (!configuration?.ok) return { ok:false, status:401, code:"UNAUTHORIZED" };
  if (canaryAccessToken && canaryAccessToken.length < OFFICIAL_SOURCE_CANARY_ACCESS_TOKEN_MIN_LENGTH) {
    return { ok:false, status:503, code:"OFFICIAL_SOURCE_CANARY_ACCESS_TOKEN_INVALID" };
  }
  if (constantTimeEqual(token, canaryAccessToken)) return { ok:true, mechanism:"ephemeral_canary" };
  if (!internalSecret && !canaryAccessToken) return { ok:false, status:503, code:"RADAR_ACCESS_NOT_CONFIGURED" };
  return { ok:false, status:401, code:"UNAUTHORIZED" };
}
