import test from "node:test";
import assert from "node:assert/strict";
import { normalizeGmailPlatformAlert } from "../src/server/gmail-alert-adapter.mjs";

function gmailMessage(overrides = {}) {
  return {
    internalDate:String(Date.parse("2026-09-08T18:00:00Z")),
    payload:{
      mimeType:"multipart/alternative",
      headers:[
        { name:"From", value:'"LinkedIn Job Alerts" <jobalerts-noreply@linkedin.com>' },
        { name:"Message-ID", value:"<synthetic-linkedin-alert@example.test>" },
        { name:"Subject", value:'“3D artist”: two new jobs' },
        { name:"Date", value:"Tue, 8 Sep 2026 18:00:00 +0000" },
        { name:"Authentication-Results", value:"mx.google.com; dkim=pass header.i=@linkedin.com; spf=pass; dmarc=pass header.from=linkedin.com" }
      ],
      parts:[{
        mimeType:"text/plain",
        body:{ data:Buffer.from([
          "External Character Vendor\nBuyer Studio\nRemote\nView job: https://www.linkedin.com/comm/jobs/view/12345/?trackingId=private",
          "Photogrammetry Cleanup Lead\nMuseum Lab\nEurope\nView job: https://www.linkedin.com/comm/jobs/view/67890/?midToken=private",
          "View all: https://www.linkedin.com/comm/jobs/search?savedSearchId=42"
        ].join("\n\n")).toString("base64url") }
      }, {
        mimeType:"text/html",
        body:{ data:Buffer.from('<a href="https://www.linkedin.com/comm/jobs/view/99999/">duplicate HTML copy</a>').toString("base64url") }
      }]
    },
    ...overrides
  };
}

test("authenticated Gmail LinkedIn digest yields exact per-job signals without trackers or HTML duplicates", () => {
  const signals = normalizeGmailPlatformAlert(gmailMessage());
  assert.equal(signals.length, 2);
  assert.deepEqual(signals.map((item) => item.source_url), [
    "https://www.linkedin.com/jobs/view/12345/",
    "https://www.linkedin.com/jobs/view/67890/"
  ]);
  assert.match(signals[0].text, /External Character Vendor/);
  assert.match(signals[1].text, /Photogrammetry Cleanup Lead/);
  assert.equal(signals.some((item) => item.text.includes("private")), false);
});

test("Gmail adapter rejects spoofed senders, failed DMARC and HTML-only messages", () => {
  const spoofed = gmailMessage();
  spoofed.payload.headers.find((item) => item.name === "From").value = "alerts@evil.example";
  assert.throws(() => normalizeGmailPlatformAlert(spoofed), /GMAIL_ALERT_SENDER_UNSUPPORTED/);
  const failed = gmailMessage();
  failed.payload.headers.find((item) => item.name === "Authentication-Results").value = "dmarc=fail header.from=linkedin.com";
  assert.throws(() => normalizeGmailPlatformAlert(failed), /GMAIL_ALERT_DMARC_REQUIRED/);
  const htmlOnly = gmailMessage();
  htmlOnly.payload.parts = htmlOnly.payload.parts.filter((part) => part.mimeType === "text/html");
  assert.throws(() => normalizeGmailPlatformAlert(htmlOnly), /GMAIL_ALERT_TEXT_REQUIRED/);
});
