import test from "node:test";
import assert from "node:assert/strict";
import handler from "../netlify/functions/gmail-alert-canary.mjs";
import { GMAIL_ALERT_CANARY_CONFIRMATION } from "../src/server/gmail-alert-import.mjs";
import { readFileSync } from "node:fs";

function runtime(t, overrides = {}) {
  const original = globalThis.Netlify;
  globalThis.Netlify = { env:{ get:(name) => ({ RADAR_INTERNAL_ACCESS_SECRET:"team-secret", ...overrides })[name] } };
  t.after(() => {
    delete globalThis.__RADAR_TEST_STATE_REPOSITORY__;
    if (original === undefined) delete globalThis.Netlify;
    else globalThis.Netlify = original;
  });
}

const request = (token = "team-secret", confirmation = GMAIL_ALERT_CANARY_CONFIRMATION) => new Request("https://radar.test/api/gmail-alert-canary", {
  method:"POST",
  headers:{ authorization:`Bearer ${token}`, "x-radar-gmail-alert-confirmation":confirmation }
});

test("Netlify can statically discover the Gmail alert canary route", () => {
  const source = readFileSync(new URL("../netlify/functions/gmail-alert-canary.mjs", import.meta.url), "utf8");
  assert.match(source, /export const config = \{ path:["']\/api\/gmail-alert-canary["'] \};/);
});

test("Gmail canary authenticates and checks preview context before network or repository", async t => {
  runtime(t, {
    RADAR_GMAIL_ALERT_COLLECTION_ENABLED:"true",
    GMAIL_ALERT_OAUTH_ACCESS_TOKEN:"private-token",
    GMAIL_ALERT_LABEL:"3dsk-radar",
    RADAR_SOURCE_SIGNAL_INGEST_ENABLED:"true",
    RADAR_SOURCE_INGEST_SECRET:"private-secret",
    RADAR_LINKEDIN_SIGNAL_ENABLED:"true"
  });
  let repositoryCalls = 0;
  globalThis.__RADAR_TEST_STATE_REPOSITORY__ = {
    getSourceSignal:async () => { repositoryCalls += 1; return null; },
    saveSourceSignal:async () => { repositoryCalls += 1; }
  };
  const network = t.mock.method(globalThis, "fetch", () => { throw new Error("must stay offline"); });
  assert.equal((await handler(request("wrong"), {deploy:{context:"deploy-preview"}})).status, 401);
  assert.equal((await handler(request("team-secret", "wrong"), {deploy:{context:"deploy-preview"}})).status, 400);
  const blocked = await handler(request(), {deploy:{context:"production"}});
  assert.equal(blocked.status, 423);
  assert.equal((await blocked.json()).result.requests, 0);
  assert.equal(network.mock.callCount(), 0);
  assert.equal(repositoryCalls, 0);
});

test("Gmail canary reports its default lock without network", async t => {
  runtime(t);
  const network = t.mock.method(globalThis, "fetch", () => { throw new Error("must stay offline"); });
  const response = await handler(request(), {deploy:{context:"deploy-preview"}});
  const body = await response.json();
  assert.equal(response.status, 423);
  assert.equal(body.result.status, "LOCKED");
  assert.equal(body.result.requests, 0);
  assert.equal(network.mock.callCount(), 0);
});
