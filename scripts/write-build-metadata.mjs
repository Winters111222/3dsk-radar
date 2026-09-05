import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export const TESTED_SOURCE_PROVENANCE = "CI_TESTED_SOURCE";
export const DIRECT_BUILD_PROVENANCE = "DIRECT_BUILD";

function validCommit(value) {
  const commit = String(value || "").trim().toLowerCase();
  return /^[0-9a-f]{40}$/.test(commit) ? commit : null;
}

function sealedTestedSourceCommit(environment, existingMetadata) {
  if (String(environment.NETLIFY || "").trim().toLowerCase() !== "true") return null;
  if (existingMetadata?.schema_version !== 2 || existingMetadata?.service !== "3dsk-opportunity-radar" || existingMetadata?.acceptance_profile !== "LOCKED_ZERO_COST" || existingMetadata?.artifact_provenance !== TESTED_SOURCE_PROVENANCE) return null;
  return validCommit(existingMetadata.commit_ref);
}

export function resolveBuildCommit(environment = process.env, gitFallback = null, existingMetadata = null) {
  const candidates = [sealedTestedSourceCommit(environment, existingMetadata), environment.COMMIT_REF, environment.GITHUB_SHA, gitFallback];
  const commit = candidates.map((value) => String(value || "").trim().toLowerCase()).find((value) => /^[0-9a-f]{40}$/.test(value));
  if (!commit) throw new Error("BUILD_COMMIT_REF_REQUIRED");
  return commit;
}

export function createBuildMetadata({ environment = process.env, gitFallback = null, existingMetadata = null, nowIso = new Date().toISOString() } = {}) {
  const sealedCommit = sealedTestedSourceCommit(environment, existingMetadata);
  const requestedProvenance = String(environment.RADAR_ARTIFACT_PROVENANCE || "").trim();
  const provenance = sealedCommit || requestedProvenance === TESTED_SOURCE_PROVENANCE ? TESTED_SOURCE_PROVENANCE : DIRECT_BUILD_PROVENANCE;
  return {
    schema_version:2,
    service:"3dsk-opportunity-radar",
    commit_ref:resolveBuildCommit(environment, gitFallback, existingMetadata),
    deploy_context:String(environment.CONTEXT || "local"),
    generated_at:nowIso,
    acceptance_profile:"LOCKED_ZERO_COST",
    artifact_provenance:provenance
  };
}

function localGitHead() {
  try { return execFileSync("git", ["rev-parse", "HEAD"], { encoding:"utf8", stdio:["ignore", "pipe", "ignore"] }).trim(); }
  catch { return null; }
}

function existingBuildMetadata() {
  try { return JSON.parse(readFileSync(new URL("../build-metadata.json", import.meta.url), "utf8")); }
  catch { return null; }
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  const metadata = createBuildMetadata({ gitFallback:localGitHead(), existingMetadata:existingBuildMetadata() });
  await writeFile(new URL("../build-metadata.json", import.meta.url), `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
  console.log(`Built locked acceptance metadata for ${metadata.commit_ref}.`);
}
