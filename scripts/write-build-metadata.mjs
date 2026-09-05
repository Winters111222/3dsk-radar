import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export function resolveBuildCommit(environment = process.env, gitFallback = null) {
  const candidates = [environment.COMMIT_REF, environment.GITHUB_SHA, gitFallback];
  const commit = candidates.map((value) => String(value || "").trim().toLowerCase()).find((value) => /^[0-9a-f]{40}$/.test(value));
  if (!commit) throw new Error("BUILD_COMMIT_REF_REQUIRED");
  return commit;
}

export function createBuildMetadata({ environment = process.env, gitFallback = null, nowIso = new Date().toISOString() } = {}) {
  return {
    schema_version:1,
    service:"3dsk-opportunity-radar",
    commit_ref:resolveBuildCommit(environment, gitFallback),
    deploy_context:String(environment.CONTEXT || "local"),
    generated_at:nowIso,
    acceptance_profile:"LOCKED_ZERO_COST"
  };
}

function localGitHead() {
  try { return execFileSync("git", ["rev-parse", "HEAD"], { encoding:"utf8", stdio:["ignore", "pipe", "ignore"] }).trim(); }
  catch {
    try { return JSON.parse(readFileSync(new URL("../build-metadata.json", import.meta.url), "utf8")).commit_ref || null; }
    catch { return null; }
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  const metadata = createBuildMetadata({ gitFallback:localGitHead() });
  await writeFile(new URL("../build-metadata.json", import.meta.url), `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
  console.log(`Built locked acceptance metadata for ${metadata.commit_ref}.`);
}
