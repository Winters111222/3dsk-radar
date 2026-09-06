import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html, app] = await Promise.all([
  readFile(new URL("../index.html", import.meta.url), "utf8"),
  readFile(new URL("../src/app.js", import.meta.url), "utf8")
]);

test("competitors have a dedicated intelligence view and counter", () => {
  assert.match(html, /data-view="COMPETITORS"/);
  assert.match(app, /"COMPETITORS",competitors\.length,"intelligence only"/);
  assert.match(app, /COMPETITOR INTELLIGENCE · NOT A SALES LEAD/);
});

test("browser keeps every competitor sales action visibly locked", () => {
  for (const marker of [
    "ALL SALES ACTIONS LOCKED",
    "OUTREACH & RESPONSE LOCKED",
    "Outreach is locked for competitor intelligence.",
    "Response generation is locked for competitor intelligence."
  ]) assert.ok(app.includes(marker), marker);
});
