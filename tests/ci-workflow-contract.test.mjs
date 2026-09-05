import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workflow = await readFile(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");

test("CI checks out the exact PR head before testing and packaging", () => {
  assert.match(workflow, /uses: actions\/checkout@v4\n\s+with:\n\s+ref: \$\{\{ github\.event\.pull_request\.head\.sha \|\| github\.sha \}\}/);
  assert.match(workflow, /git archive --format=tar -o radar-source\.tar HEAD/);
  assert.doesNotMatch(workflow, /git archive[^\n]*\$COMMIT_REF/);
});
