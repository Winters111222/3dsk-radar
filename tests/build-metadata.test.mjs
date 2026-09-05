import test from "node:test";
import assert from "node:assert/strict";
import { createBuildMetadata, resolveBuildCommit } from "../scripts/write-build-metadata.mjs";

const COMMIT = "a".repeat(40);

test("build metadata binds a deploy artifact to one exact commit", () => {
  const metadata = createBuildMetadata({ environment:{ COMMIT_REF:COMMIT, CONTEXT:"ci", RADAR_ARTIFACT_PROVENANCE:"CI_TESTED_SOURCE" }, nowIso:"2026-09-05T12:00:00.000Z" });
  assert.deepEqual(metadata, {
    schema_version:2,
    service:"3dsk-opportunity-radar",
    commit_ref:COMMIT,
    deploy_context:"ci",
    generated_at:"2026-09-05T12:00:00.000Z",
    acceptance_profile:"LOCKED_ZERO_COST",
    artifact_provenance:"CI_TESTED_SOURCE"
  });
  assert.equal(resolveBuildCommit({}, COMMIT), COMMIT);
  assert.throws(() => resolveBuildCommit({}, "short"), /BUILD_COMMIT_REF_REQUIRED/);
  assert.equal(createBuildMetadata({ environment:{ COMMIT_REF:COMMIT } }).artifact_provenance, "DIRECT_BUILD");
});

test("Netlify cannot replace sealed tested-source identity with its unrelated COMMIT_REF", () => {
  const packagedCommit = "b".repeat(40);
  const netlifyCommit = "c".repeat(40);
  const existingMetadata = {
    schema_version:2,
    service:"3dsk-opportunity-radar",
    commit_ref:packagedCommit,
    acceptance_profile:"LOCKED_ZERO_COST",
    artifact_provenance:"CI_TESTED_SOURCE"
  };
  const metadata = createBuildMetadata({
    environment:{ NETLIFY:"true", COMMIT_REF:netlifyCommit, CONTEXT:"branch-deploy" },
    existingMetadata,
    nowIso:"2026-09-05T19:00:00.000Z"
  });
  assert.equal(metadata.commit_ref, packagedCommit);
  assert.equal(metadata.deploy_context, "branch-deploy");
  assert.equal(metadata.artifact_provenance, "CI_TESTED_SOURCE");
});

test("Phase E CI profile survives the later Netlify branch build", () => {
  const packagedCommit = "d".repeat(40);
  const packaged = createBuildMetadata({
    environment:{ COMMIT_REF:packagedCommit, CONTEXT:"ci", RADAR_ARTIFACT_PROVENANCE:"CI_TESTED_SOURCE", RADAR_ACCEPTANCE_PROFILE:"PAID_FOCUSED" }
  });
  assert.equal(packaged.acceptance_profile, "PAID_FOCUSED");
  const deployed = createBuildMetadata({
    environment:{ NETLIFY:"true", COMMIT_REF:"e".repeat(40), CONTEXT:"branch-deploy" },
    existingMetadata:packaged
  });
  assert.equal(deployed.commit_ref, packagedCommit);
  assert.equal(deployed.acceptance_profile, "PAID_FOCUSED");
  assert.equal(deployed.artifact_provenance, "CI_TESTED_SOURCE");
});
