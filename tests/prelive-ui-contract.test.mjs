import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
const search = await readFile(new URL("../netlify/functions/search.mjs", import.meta.url), "utf8");
const reply = await readFile(new URL("../netlify/functions/generate-response.mjs", import.meta.url), "utf8");

const requiredUi = [
  "Company",
  "BOOKMARKED",
  "Outreach",
  "MARK EMAIL SENT",
  "GENERATE RESPONSE",
  "COPY SUBJECT",
  "COPY RESPONSE",
  "Search truth counters",
  "Studio eligibility",
  "MANUAL SOURCE CHECK REQUIRED",
  "OPEN ORIGINAL SOURCE",
  "I CHECKED IT · MARK VERIFIED",
  "SOURCE MANUALLY VERIFIED",
  "CONTACT LOCKED"
];

test("pre-live UI contains the complete V0.1 decision and response flow", () => {
  for (const marker of requiredUi) assert.match(`${html}\n${app}`, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(app, /FIXTURE_PREVIEW/);
});

test("company memory is company-level and repeat outreach is visible", () => {
  assert.match(app, /company_bookmarked/);
  assert.match(app, /company_last_contacted_at/);
  assert.match(app, /RECENT OUTREACH/);
});

test("there is no automatic send endpoint in the browser flow", () => {
  assert.doesNotMatch(app, /\/api\/(send|send-email|outlook|gmail)/i);
  assert.doesNotMatch(html, /AUTO.?SEND/i);
});

test("both paid API endpoints remain locked before key use", () => {
  for (const source of [search, reply]) {
    assert.match(source, /LIVE_AI_LOCKED/);
    assert.ok(source.indexOf("LIVE_AI_LOCKED") < source.indexOf("OPENAI_API_KEY"));
  }
});
