import test from "node:test";
import assert from "node:assert/strict";
import health from "../netlify/functions/health.mjs";
import search from "../netlify/functions/search.mjs";
import reply from "../netlify/functions/generate-response.mjs";
import updateStatus from "../netlify/functions/opportunity-status.mjs";
import { getStateRepository } from "../src/server/netlify-state.mjs";

function runtime(t, values = {}) {
  const previousGlobal = globalThis.Netlify;
  delete globalThis.Netlify;
  const previous = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
  Object.assign(process.env, values);
  t.after(() => {
    if (previousGlobal === undefined) delete globalThis.Netlify;
    else globalThis.Netlify = previousGlobal;
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
}

const request = (path, workspace) => new Request(`https://radar.test/api/${path}`, {
  method: "POST",
  headers: { authorization: "Bearer fixture-secret", "content-type": "application/json", ...(workspace ? { "x-radar-workspace": workspace } : {}) },
  body: JSON.stringify({ opportunity_id: "fixture-opportunity" })
});

test("Node runtime without Netlify global reports configured access and locks both AI endpoints without fetch", async t => {
  runtime(t, { RADAR_INTERNAL_ACCESS_SECRET: "fixture-secret", RADAR_LIVE_AI_ENABLED: "false" });
  const network = t.mock.method(globalThis, "fetch", () => { throw new Error("Network forbidden in locked acceptance"); });
  const status = await (await health()).json();
  assert.equal(status.access_configured, true);
  assert.equal(status.paid_ai_state, "LOCKED");
  for (const [handler, path] of [[search, "search"], [reply, "generate-response"]]) {
    const response = await handler(request(path));
    assert.equal(response.status, 423);
    assert.equal((await response.json()).error.code, "LIVE_AI_LOCKED");
  }
  assert.equal(network.mock.callCount(), 0);
});

test("an acceptance request cannot enter the paid path after live AI is enabled", async t => {
  runtime(t, { RADAR_INTERNAL_ACCESS_SECRET: "fixture-secret", RADAR_LIVE_AI_ENABLED: "TRUE", RADAR_PRELIVE_ACCEPTANCE_ENABLED: "true", OPENAI_API_KEY: "fixture-not-a-key" });
  const network = t.mock.method(globalThis, "fetch", () => { throw new Error("Acceptance must never call OpenAI"); });
  assert.equal((await (await health()).json()).prelive_acceptance_enabled, false);
  for (const [handler, path] of [[search, "search"], [reply, "generate-response"]]) {
    const response = await handler(request(path, "acceptance"));
    assert.equal(response.status, 423);
    assert.equal((await response.json()).error.code, "PRELIVE_WORKSPACE_DISABLED");
  }
  assert.equal(network.mock.callCount(), 0);
});

test("real Blobs SDK keeps production data across deploy IDs and isolates preview/acceptance", async t => {
  runtime(t, { RADAR_INTERNAL_ACCESS_SECRET: "fixture-secret", RADAR_LIVE_AI_ENABLED: "false", RADAR_PRELIVE_ACCEPTANCE_ENABLED: "true" });
  const oldContext = globalThis.netlifyBlobsContext;
  t.after(() => { if (oldContext === undefined) delete globalThis.netlifyBlobsContext; else globalThis.netlifyBlobsContext = oldContext; });
  const data = new Map();
  const paths = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    const parsed = new URL(url);
    assert.equal(parsed.hostname, "strong.blobs.example");
    paths.push(parsed.pathname);
    if (options.method.toLowerCase() === "put") { data.set(parsed.pathname, options.body); return new Response(null, { status: 200 }); }
    return data.has(parsed.pathname) ? new Response(data.get(parsed.pathname), { headers: { "content-type": "application/json" } }) : new Response(null, { status: 404 });
  });
  const setDeploy = id => { globalThis.netlifyBlobsContext = Buffer.from(JSON.stringify({ siteID: "fixture-site", token: "fixture-token", deployID: id, primaryRegion: "us-east-2", edgeURL: "https://cached.blobs.example", uncachedEdgeURL: "https://strong.blobs.example" })).toString("base64"); };
  const req = new Request("https://radar.test/api/opportunities");
  setDeploy("aaaaaaaaaaaaaaaaaaaaaaaa");
  const first = await getStateRepository(req, { deploy: { context: "production" } });
  await first.saveOpportunity({ id: "fixture-opportunity", company: "Synthetic Buyer", status: "CONTACTED" });
  setDeploy("bbbbbbbbbbbbbbbbbbbbbbbb");
  const next = await getStateRepository(req, { deploy: { context: "production" } });
  assert.equal((await next.getOpportunity("fixture-opportunity"))?.status, "CONTACTED");
  const preview = await getStateRepository(req, { deploy: { context: "deploy-preview" } });
  assert.equal(await preview.getOpportunity("fixture-opportunity"), null);
  const acceptance = await getStateRepository(request("opportunities", "acceptance"), { deploy: { context: "production" } });
  assert.equal(await acceptance.getOpportunity("fixture-opportunity"), null);
  assert.equal(paths[0], paths[1], "production reads must target the same store after a deploy");
  assert.notEqual(paths[1], paths[2]);
  assert.notEqual(paths[1], paths[3]);
  const change = new Request("https://radar.test/api/opportunity-status", {
    method: "POST", headers: { authorization: "Bearer fixture-secret", "content-type": "application/json" },
    body: JSON.stringify({ opportunity_id: "fixture-opportunity", status: "INTERESTING" })
  });
  assert.equal((await updateStatus(change, { deploy: { context: "production" } })).status, 200);
  assert.equal((await next.getOpportunity("fixture-opportunity")).status, "INTERESTING", "the deployed handler must forward its context");
});
