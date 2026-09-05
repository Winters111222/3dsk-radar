import test from "node:test";
import assert from "node:assert/strict";
import { createBuildMetadata, resolveBuildCommit } from "../scripts/write-build-metadata.mjs";

const COMMIT = "a".repeat(40);

test("build metadata binds a deploy artifact to one exact commit", () => {
  const metadata = createBuildMetadata({ environment:{ COMMIT_REF:COMMIT, CONTEXT:"deploy-preview" }, nowIso:"2026-09-05T12:00:00.000Z" });
  assert.deepEqual(metadata, {
    schema_version:1,
    service:"3dsk-opportunity-radar",
    commit_ref:COMMIT,
    deploy_context:"deploy-preview",
    generated_at:"2026-09-05T12:00:00.000Z",
    acceptance_profile:"LOCKED_ZERO_COST"
  });
  assert.equal(resolveBuildCommit({}, COMMIT), COMMIT);
  assert.throws(() => resolveBuildCommit({}, "short"), /BUILD_COMMIT_REF_REQUIRED/);
});
