import test from "node:test";
import assert from "node:assert/strict";
import handler from "../netlify/functions/source-signal-ingest.mjs";
import { signSourceSignal, verifyAndNormalizeSourceSignal } from "../src/server/source-signal-ingest.mjs";

const NOW = 1788696000000;
const TS = Math.floor(NOW / 1000);
const SECRET = "ingest-secret";

function env(overrides = {}) {
  const values = {
    RADAR_SOURCE_SIGNAL_INGEST_ENABLED:"true",
    RADAR_LINKEDIN_SIGNAL_ENABLED:"true",
    RADAR_TELEGRAM_SOURCE_ENABLED:"true",
    TELEGRAM_SOURCE_ALLOWED_CHATS:"-100123,design-jobs",
    ...overrides
  };
  return (key) => values[key] || "";
}

function body(overrides = {}) {
  return JSON.stringify({
    source_id:"telegram_authorized_channels",
    event_id:"message-42",
    channel_id:"-100123",
    source_url:"https://t.me/design_jobs/42",
    author:"buyer",
    text:"Paid photogrammetry cleanup project",
    published_at:"2026-09-06T12:00:00Z",
    ...overrides
  });
}

test("signed source signal is normalized as outreach-locked discovery only", () => {
  const rawBody = body();
  const signal = verifyAndNormalizeSourceSignal({ rawBody, timestamp:TS, signature:signSourceSignal(rawBody, TS, SECRET), secret:SECRET, getEnv:env(), nowMs:NOW });
  assert.match(signal.signal_id, /^signal-[a-f0-9]{40}$/);
  assert.equal(signal.discovery_only, true);
  assert.equal(signal.requires_original_verification, true);
  assert.equal(signal.outreach_locked, true);
});

test("ingest rejects stale signatures, wrong domains and non-allowlisted channels", () => {
  const valid = body();
  assert.throws(() => verifyAndNormalizeSourceSignal({ rawBody:valid, timestamp:TS - 301, signature:signSourceSignal(valid, TS - 301, SECRET), secret:SECRET, getEnv:env(), nowMs:NOW }), /SOURCE_SIGNAL_TIMESTAMP_INVALID/);
  for (const rawBody of [body({channel_id:"other"}), body({source_url:"https://evil.example/42"})]) {
    assert.throws(() => verifyAndNormalizeSourceSignal({ rawBody, timestamp:TS, signature:signSourceSignal(rawBody, TS, SECRET), secret:SECRET, getEnv:env(), nowMs:NOW }));
  }
});

test("endpoint authenticates first, persists once and replays the same event", async () => {
  const old = globalThis.Netlify;
  globalThis.Netlify = { env:{ get:(key) => ({
    RADAR_INTERNAL_ACCESS_SECRET:"team-secret",
    RADAR_SOURCE_SIGNAL_INGEST_ENABLED:"true",
    RADAR_SOURCE_INGEST_SECRET:SECRET,
    RADAR_LINKEDIN_SIGNAL_ENABLED:"true"
  })[key] } };
  const signals = new Map();
  globalThis.__RADAR_TEST_STATE_REPOSITORY__ = {
    getSourceSignal:async (id) => signals.get(id) || null,
    saveSourceSignal:async (signal) => signals.set(signal.signal_id, signal)
  };
  const rawBody = body({ source_id:"linkedin_alert_bridge", channel_id:null, source_url:"https://www.linkedin.com/jobs/view/123" });
  const makeRequest = (token = "team-secret") => {
    const timestamp = Math.floor(Date.now() / 1000);
    return new Request("https://radar.test/api/source-signal-ingest", {
      method:"POST",
      headers:{
        authorization:`Bearer ${token}`,
        "x-radar-source-timestamp":String(timestamp),
        "x-radar-source-signature":signSourceSignal(rawBody, timestamp, SECRET)
      },
      body:rawBody
    });
  };
  try {
    assert.equal((await handler(makeRequest("wrong"), {deploy:{context:"production"}})).status, 401);
    const first = await handler(makeRequest(), {deploy:{context:"production"}});
    const second = await handler(makeRequest(), {deploy:{context:"production"}});
    assert.equal(first.status, 202);
    assert.equal((await first.json()).replayed, false);
    assert.equal(second.status, 200);
    assert.equal((await second.json()).replayed, true);
    assert.equal(signals.size, 1);
  } finally {
    delete globalThis.__RADAR_TEST_STATE_REPOSITORY__;
    if (old === undefined) delete globalThis.Netlify;
    else globalThis.Netlify = old;
  }
});
