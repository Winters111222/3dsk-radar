import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const envExample = await readFile(new URL("../.env.example", import.meta.url), "utf8");
const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
const searchFunction = await readFile(new URL("../netlify/functions/search.mjs", import.meta.url), "utf8");
const healthFunction = await readFile(new URL("../netlify/functions/health.mjs", import.meta.url), "utf8");
const profile = await readFile(new URL("../config/company-profile.public.json", import.meta.url), "utf8");

test("env example contains secret names but no secret values", () => {
  assert.match(envExample, /^OPENAI_API_KEY=$/m);
  assert.match(envExample, /^RADAR_INTERNAL_ACCESS_SECRET=$/m);
  assert.doesNotMatch(envExample, /sk-[A-Za-z0-9_-]{10,}/);
});

test("browser bundle does not reference server secret environment names", () => {
  assert.doesNotMatch(app, /OPENAI_API_KEY/);
  assert.doesNotMatch(app, /RADAR_INTERNAL_ACCESS_SECRET/);
});

test("Netlify Functions read environment only through Netlify.env and never print secret values", () => {
  assert.match(searchFunction, /Netlify\.env\.get\(key\)/);
  assert.match(healthFunction, /Netlify\.env\.get\("OPENAI_API_KEY"\)/);
  assert.match(healthFunction, /Netlify\.env\.get\("RADAR_INTERNAL_ACCESS_SECRET"\)/);
  assert.doesNotMatch(searchFunction, /process\.env/);
  assert.doesNotMatch(healthFunction, /process\.env/);
  assert.doesNotMatch(searchFunction, /console\.(log|error)\([^\n]*(apiKey|RADAR_INTERNAL_ACCESS_SECRET)/);
});

test("public company profile contains no credential placeholders presented as real credits", () => {
  const parsed = JSON.parse(profile);
  assert.deepEqual(parsed.credentials, []);
});
