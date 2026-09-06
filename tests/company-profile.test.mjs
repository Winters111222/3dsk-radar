import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const profile = JSON.parse(await readFile(new URL("../config/company-profile.public.json", import.meta.url), "utf8"));

test("public profile contains no unapproved credentials", () => {
  assert.equal(profile.visibility, "PUBLIC_SAFE");
  for (const credential of profile.credentials) {
    assert.equal(credential.status, "PUBLIC_APPROVED");
    assert.equal(credential.outbound_safe, true);
    assert.ok(credential.verification_url);
  }
});

test("all outbound-safe capabilities are explicitly approved", () => {
  assert.ok(profile.capabilities.length > 0);
  for (const capability of profile.capabilities) {
    if (capability.outbound_safe) assert.equal(capability.status, "APPROVED");
  }
});

test("win scoring weights add to 100", () => {
  const sum = Object.values(profile.scoring_weights).reduce((a,b) => a + b, 0);
  assert.equal(sum, 100);
});

test("profile has explicit restricted claims", () => {
  assert.ok(profile.restricted_claims.length >= 3);
});

test("profile explicitly excludes Visual AI Motion from Search", () => {
  assert.ok(profile.excluded_opportunities.includes("VISUAL_AI_MOTION_SEARCH"));
  assert.equal(profile.preferred_opportunities.includes("VISUAL_AI_MOTION"), false);
});
