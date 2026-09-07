import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const envExample = await readFile(new URL("../.env.example", import.meta.url), "utf8");
const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
const searchFunction = await readFile(new URL("../netlify/functions/search.mjs", import.meta.url), "utf8");
const replyFunction = await readFile(new URL("../netlify/functions/generate-response.mjs", import.meta.url), "utf8");
const healthFunction = await readFile(new URL("../netlify/functions/health.mjs", import.meta.url), "utf8");
const sourceCollectionFunction = await readFile(new URL("../netlify/functions/source-collection.mjs", import.meta.url), "utf8");
const runtime = await readFile(new URL("../src/server/runtime.mjs", import.meta.url), "utf8");
const profile = await readFile(new URL("../config/company-profile.public.json", import.meta.url), "utf8");

test("env example contains secret names but no secret values", () => {
  assert.match(envExample, /^OPENAI_API_KEY=$/m);
  assert.match(envExample, /^RADAR_INTERNAL_ACCESS_SECRET=$/m);
  assert.match(envExample, /^RADAR_SOURCE_COLLECTION_ENABLED=false$/m);
  assert.doesNotMatch(envExample, /sk-[A-Za-z0-9_-]{10,}/);
});

test("browser bundle does not reference server secret environment names", () => {
  assert.doesNotMatch(app, /OPENAI_API_KEY/);
  assert.doesNotMatch(app, /RADAR_INTERNAL_ACCESS_SECRET/);
});

test("Netlify Functions use the server runtime adapter and never print secret values", () => {
  for (const source of [searchFunction, replyFunction, healthFunction, sourceCollectionFunction]) {
    assert.match(source, /from "..\/..\/src\/server\/runtime.mjs"/);
    assert.doesNotMatch(source, /process\.env/);
    assert.doesNotMatch(source, /console\.(log|error)\([^\n]*(apiKey|RADAR_INTERNAL_ACCESS_SECRET)/);
  }
  assert.doesNotMatch(runtime, /console\.(log|error)/);
  assert.doesNotMatch(healthFunction, /OPENAI_API_KEY/);
});

test("public company profile contains no credential placeholders presented as real credits", () => {
  const parsed = JSON.parse(profile);
  assert.deepEqual(parsed.credentials, []);
});
