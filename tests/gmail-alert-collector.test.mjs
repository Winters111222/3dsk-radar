import test from "node:test";
import assert from "node:assert/strict";
import {
  GMAIL_ALERT_MAX_MESSAGES,
  GMAIL_ALERT_MAX_REQUESTS,
  buildGmailAlertListRequest,
  buildGmailAlertMessageRequest,
  collectGmailAlertSignals,
  gmailAlertCollectionReadiness,
  runGmailAlertCollection
} from "../src/server/gmail-alert-collector.mjs";

function message(id, jobId = "12345") {
  return {
    id,
    internalDate:String(Date.parse("2026-09-08T18:00:00Z")),
    payload:{
      mimeType:"text/plain",
      headers:[
        { name:"From", value:"LinkedIn Job Alerts <jobalerts-noreply@linkedin.com>" },
        { name:"Message-ID", value:`<${id}@example.test>` },
        { name:"Subject", value:"New external character opportunity" },
        { name:"Authentication-Results", value:"dkim=pass; spf=pass; dmarc=pass header.from=linkedin.com" }
      ],
      body:{ data:Buffer.from(`Character vendor\nBuyer\nView job: https://www.linkedin.com/comm/jobs/view/${jobId}/?trackingId=private`).toString("base64url") }
    }
  };
}

test("Gmail list is label-scoped, 30-day bounded and token stays in Authorization", () => {
  const request = buildGmailAlertListRequest({ accessToken:"secret-token", label:"3dsk-radar", maxResults:999 });
  const url = new URL(request.url);
  assert.equal(url.origin, "https://gmail.googleapis.com");
  assert.equal(url.searchParams.get("maxResults"), String(GMAIL_ALERT_MAX_MESSAGES));
  assert.match(url.searchParams.get("q"), /label:"3dsk-radar" newer_than:30d/);
  assert.equal(request.options.headers.authorization, "Bearer secret-token");
  assert.equal(request.url.includes("secret-token"), false);
  assert.throws(() => buildGmailAlertListRequest({ accessToken:"x", label:'bad" OR from:anyone' }), /GMAIL_ALERT_LABEL_INVALID/);
  assert.throws(() => buildGmailAlertMessageRequest({ accessToken:"x", messageId:"../secret" }), /GMAIL_ALERT_MESSAGE_ID_INVALID/);
});

test("collector reads one bounded page, isolates rejected messages and stores no raw mail", async () => {
  let calls = 0;
  const result = await collectGmailAlertSignals({
    accessToken:"secret-token",
    fetchImpl:async (url) => {
      calls += 1;
      const value = String(url);
      if (value.includes("/messages?")) return Response.json({ messages:[{id:"a1"},{id:"b2"},{id:"a1"}] });
      if (value.includes("/a1?")) return Response.json(message("a1"));
      return Response.json({ ...message("b2", "67890"), payload:{ ...message("b2", "67890").payload, headers:[
        { name:"From", value:"spoof@evil.example" },
        { name:"Message-ID", value:"<b2@example.test>" },
        { name:"Subject", value:"Spoofed" },
        { name:"Authentication-Results", value:"dmarc=fail header.from=evil.example" }
      ] } });
    }
  });
  assert.equal(calls, 3);
  assert.equal(result.requests, 3);
  assert.equal(result.request_cap, GMAIL_ALERT_MAX_REQUESTS);
  assert.equal(result.status, "PARTIAL");
  assert.equal(result.messages_seen, 2);
  assert.equal(result.messages_accepted, 1);
  assert.equal(result.messages_rejected, 1);
  assert.equal(result.signals.length, 1);
  assert.equal(result.diagnostics[1].error_code, "GMAIL_ALERT_SENDER_UNSUPPORTED");
  assert.equal(JSON.stringify(result).includes("secret-token"), false);
  assert.equal(JSON.stringify(result).includes("trackingId"), false);
  assert.equal(JSON.stringify(result).includes("payload"), false);
});

test("collector performs one empty list request and no hidden retry", async () => {
  let calls = 0;
  const result = await collectGmailAlertSignals({ accessToken:"secret-token", fetchImpl:async () => { calls += 1; return Response.json({ resultSizeEstimate:0 }); } });
  assert.equal(calls, 1);
  assert.equal(result.requests, 1);
  assert.equal(result.messages_seen, 0);
  assert.equal(result.status, "COMPLETE");
});

test("Gmail collection remains fail-closed and reports only configuration names", async () => {
  const env = new Map();
  const getEnv = (name) => env.get(name) || "";
  assert.deepEqual(gmailAlertCollectionReadiness(getEnv), {
    status:"LOCKED",
    missing_configuration:[],
    max_messages:GMAIL_ALERT_MAX_MESSAGES,
    max_requests:GMAIL_ALERT_MAX_REQUESTS
  });
  env.set("RADAR_GMAIL_ALERT_COLLECTION_ENABLED", "true");
  assert.deepEqual(gmailAlertCollectionReadiness(getEnv).missing_configuration, [
    "GMAIL_ALERT_OAUTH_ACCESS_TOKEN",
    "GMAIL_ALERT_LABEL"
  ]);
  env.set("GMAIL_ALERT_OAUTH_ACCESS_TOKEN", "private-token");
  env.set("GMAIL_ALERT_LABEL", "3dsk-radar");
  const ready = gmailAlertCollectionReadiness(getEnv);
  assert.equal(ready.status, "CONFIG_READY");
  assert.equal(JSON.stringify(ready).includes("private-token"), false);
});

test("locked Gmail wrapper performs zero requests", async () => {
  let calls = 0;
  const result = await runGmailAlertCollection({
    getEnv:() => "",
    fetchImpl:async () => { calls += 1; throw new Error("must stay locked"); }
  });
  assert.equal(result.status, "LOCKED");
  assert.equal(result.requests, 0);
  assert.equal(result.signals.length, 0);
  assert.equal(calls, 0);
});
