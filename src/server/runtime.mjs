import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Netlify's current Node runtime exposes process.env. Retain the legacy
// Netlify.env interface for existing deployments and deterministic fixtures.
export function envValue(key) {
  return globalThis.Netlify?.env?.get(key) ?? process.env[key] ?? "";
}

function resolveBuildMetadataPath() {
  const candidates = [
    fileURLToPath(new URL("../../build-metadata.json", import.meta.url)),
    path.resolve(process.cwd(), "build-metadata.json")
  ];
  return candidates.find((candidate) => existsSync(candidate));
}

let buildMetadataCache = null;
let buildMetadataLoaded = false;

export function readBuildMetadata() {
  if (globalThis.__RADAR_TEST_OFFICIAL_SOURCE_CANARY_METADATA__) return globalThis.__RADAR_TEST_OFFICIAL_SOURCE_CANARY_METADATA__;
  if (buildMetadataLoaded) return buildMetadataCache;
  buildMetadataLoaded = true;
  const metadataPath = resolveBuildMetadataPath();
  if (!metadataPath) return null;
  try {
    buildMetadataCache = JSON.parse(readFileSync(metadataPath, "utf8"));
  } catch {
    buildMetadataCache = null;
  }
  return buildMetadataCache;
}

export function liveAIEnabled() {
  return envValue("RADAR_LIVE_AI_ENABLED").toLowerCase() === "true";
}

export function acceptanceEnabled() {
  return envValue("RADAR_PRELIVE_ACCEPTANCE_ENABLED") === "true" && !liveAIEnabled();
}

export function sourceCollectionEnabled() {
  return envValue("RADAR_SOURCE_COLLECTION_ENABLED").toLowerCase() === "true";
}

export const PAID_ACCEPTANCE_DEPLOY_CONTEXT = "deploy-preview";

export function paidAcceptanceContextAllowed(runtimeContext) {
  return runtimeContext?.deploy?.context === PAID_ACCEPTANCE_DEPLOY_CONTEXT;
}

export function workspaceAllowed(request) {
  return request?.headers.get("x-radar-workspace") !== "acceptance" || acceptanceEnabled();
}
