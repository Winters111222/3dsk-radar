import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html, app, styles, responsive] = await Promise.all([
  readFile(new URL("../index.html", import.meta.url), "utf8"),
  readFile(new URL("../src/app.js", import.meta.url), "utf8"),
  readFile(new URL("../src/styles.css", import.meta.url), "utf8"),
  readFile(new URL("../src/responsive.css", import.meta.url), "utf8")
]);

test("Phase C operator UI exposes bounded start, resume, progress and cancel controls", () => {
  for (const marker of [
    "source-run-panel",
    "source-run-profile",
    "START ZERO-COST SOURCE RUN",
    "CANCEL RUN",
    "Source candidate collection",
    "RAW · NEEDS TRUTH REVIEW"
  ]) assert.match(`${html}\n${app}`, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(app, /maxChunks:25/);
  assert.match(html, /FIND NEW OPPORTUNITIES · PAID LOCKED/);
  assert.match(app, /action:"START"/);
  assert.match(app, /action:"CONTINUE"/);
  assert.match(app, /action:"CANCEL"/);
});

test("candidate panel permits only truth-gated promotion", () => {
  assert.match(html, /fixed first-party detail adapter/i);
  assert.match(html, /only records that pass Phase A buyer, status, studio eligibility, scope, freshness, provenance and dedupe gates become opportunities/i);
  assert.match(app, /only truth-gated records are promoted/i);
  assert.doesNotMatch(app, /state\.opportunities\s*=\s*state\.sourceCandidates/);
});

test("operator controls have responsive layouts and the collection lock is acceptance-tested", () => {
  assert.match(styles, /\.source-run-controls/);
  assert.match(responsive, /\.source-run-controls,.source-run-progress \{ grid-template-columns:1fr; \}/);
  assert.match(app, /SOURCE_COLLECTION_LOCKED/);
  assert.match(app, /prelive_lock_check/);
});

test("paid search diagnostics expose required-shard coverage, per-source yield and rejection reasons", () => {
  for (const marker of ["Search yield diagnostics","search-coverage-grid","source-yield-grid","search-rejection-summary","ZERO RESULT"]) {
    assert.match(`${html}\n${app}`,new RegExp(marker));
  }
  assert.match(app,/diagnostics\.source_yield/);
  assert.match(app,/diagnostics\.rejection_reasons/);
  assert.match(app,/state\.lastRun\?\.coverage/);
  assert.match(app,/web_search_calls/);
  assert.match(html,/AGGREGATED COUNTS ONLY/);
});
