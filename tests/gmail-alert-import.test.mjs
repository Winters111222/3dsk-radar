import test from "node:test";
import assert from "node:assert/strict";
import { gmailAlertImportReadiness, importGmailAlertSignals } from "../src/server/gmail-alert-import.mjs";

const NOW = Date.parse("2026-09-08T20:00:00Z");
const context = { deploy:{ context:"deploy-preview" } };

function environment(overrides = {}) {
  const values = {
    RADAR_GMAIL_ALERT_COLLECTION_ENABLED:"true",
    GMAIL_ALERT_OAUTH_ACCESS_TOKEN:"private-token",
    GMAIL_ALERT_LABEL:"3dsk-radar",
    RADAR_SOURCE_SIGNAL_INGEST_ENABLED:"true",
    RADAR_SOURCE_INGEST_SECRET:"private-ingest-secret",
    RADAR_LINKEDIN_SIGNAL_ENABLED:"true",
    RADAR_UPWORK_SIGNAL_ENABLED:"false",
    ...overrides
  };
  return (name) => values[name] || "";
}

function linkedinMessage() {
  return {
    id:"a1",
    internalDate:String(NOW),
    payload:{
      mimeType:"text/plain",
      headers:[
        { name:"From", value:"LinkedIn Job Alerts <jobalerts-noreply@linkedin.com>" },
        { name:"Message-ID", value:"<digest@example.test>" },
        { name:"Subject", value:"External realistic character opportunities" },
        { name:"Authentication-Results", value:"dkim=pass; spf=pass; dmarc=pass header.from=linkedin.com" }
      ],
      body:{ data:Buffer.from("External studio\nBuyer\nView job: https://www.linkedin.com/comm/jobs/view/12345/?trackingId=private").toString("base64url") }
    }
  };
}

function repository() {
  const records = new Map();
  return {
    records,
    getSourceSignal:async (id) => records.get(id) || null,
    saveSourceSignal:async (signal) => { records.set(signal.signal_id, signal); return signal; }
  };
}

test("Gmail import is preview-only and fails before Gmail requests", async () => {
  assert.equal(gmailAlertImportReadiness({ context:{deploy:{context:"production"}}, getEnv:environment() }).status, "CONTEXT_BLOCKED");
  let calls = 0;
  const result = await importGmailAlertSignals({
    context:{deploy:{context:"production"}},
    getEnv:environment(),
    fetchImpl:async () => { calls += 1; throw new Error("must not run"); }
  });
  assert.equal(result.status, "CONTEXT_BLOCKED");
  assert.equal(result.requests, 0);
  assert.equal(calls, 0);
});

test("Gmail import reports every missing gate without secret values", () => {
  const getEnv = environment({
    RADAR_SOURCE_SIGNAL_INGEST_ENABLED:"false",
    RADAR_SOURCE_INGEST_SECRET:"",
    RADAR_LINKEDIN_SIGNAL_ENABLED:"false"
  });
  const readiness = gmailAlertImportReadiness({ context, getEnv });
  assert.equal(readiness.status, "CONFIG_REQUIRED");
  assert.deepEqual(readiness.missing_configuration, [
    "RADAR_SOURCE_SIGNAL_INGEST_ENABLED",
    "RADAR_SOURCE_INGEST_SECRET",
    "RADAR_LINKEDIN_SIGNAL_ENABLED_OR_RADAR_UPWORK_SIGNAL_ENABLED"
  ]);
  assert.equal(JSON.stringify(readiness).includes("private-token"), false);
});

test("Gmail import persists a locked discovery signal once and replays it", async () => {
  const state = repository();
  let calls = 0;
  const fetchImpl = async (url) => {
    calls += 1;
    return String(url).includes("/messages?") ? Response.json({messages:[{id:"a1"}]}) : Response.json(linkedinMessage());
  };
  const args = { context, getEnv:environment(), fetchImpl, repository:state, nowMs:NOW };
  const first = await importGmailAlertSignals(args);
  const second = await importGmailAlertSignals(args);
  assert.equal(first.status, "COMPLETE");
  assert.equal(first.requests, 2);
  assert.equal(first.request_cap, 2);
  assert.equal(first.signals_imported, 1);
  assert.equal(first.signals_replayed, 0);
  assert.equal(second.signals_imported, 0);
  assert.equal(second.signals_replayed, 1);
  assert.equal(calls, 4);
  assert.equal(state.records.size, 1);
  const [saved] = state.records.values();
  assert.equal(saved.source_url, "https://www.linkedin.com/jobs/view/12345/");
  assert.equal(saved.discovery_only, true);
  assert.equal(saved.requires_original_verification, true);
  assert.equal(saved.outreach_locked, true);
  assert.equal(JSON.stringify(first).includes("trackingId"), false);
  assert.equal(JSON.stringify(first).includes("private-token"), false);
});

test("signals for a disabled platform are counted but never persisted", async () => {
  const state = repository();
  const result = await importGmailAlertSignals({
    context,
    getEnv:environment({ RADAR_LINKEDIN_SIGNAL_ENABLED:"false", RADAR_UPWORK_SIGNAL_ENABLED:"true" }),
    fetchImpl:async (url) => String(url).includes("/messages?") ? Response.json({messages:[{id:"a1"}]}) : Response.json(linkedinMessage()),
    repository:state,
    nowMs:NOW
  });
  assert.equal(result.signals_collected, 1);
  assert.equal(result.signals_source_locked, 1);
  assert.equal(result.signals_deferred, 0);
  assert.equal(result.signals_imported, 0);
  assert.equal(state.records.size, 0);
});

test("one digest cannot make the canary import more than one signal", async () => {
  const state = repository();
  const digest = linkedinMessage();
  digest.payload.body.data = Buffer.from([
    "External studio — https://www.linkedin.com/comm/jobs/view/12345/?trackingId=private",
    "Second buyer — https://www.linkedin.com/comm/jobs/view/67890/?trackingId=private"
  ].join("\n")).toString("base64url");
  const result = await importGmailAlertSignals({
    context,
    getEnv:environment(),
    fetchImpl:async (url) => String(url).includes("/messages?") ? Response.json({messages:[{id:"a1"},{id:"b2"}]}) : Response.json(digest),
    repository:state,
    nowMs:NOW
  });
  assert.equal(result.requests, 2);
  assert.equal(result.signals_collected, 2);
  assert.equal(result.signals_imported, 1);
  assert.equal(result.signals_deferred, 1);
  assert.equal(state.records.size, 1);
});
