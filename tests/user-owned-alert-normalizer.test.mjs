import test from "node:test";
import assert from "node:assert/strict";
import { normalizeUserOwnedAlert } from "../src/server/user-owned-alert-normalizer.mjs";

const base = {
  message_id:"<alert-42@example.test>",
  subject:"New opportunity",
  body_text:"A buyer may need a realistic character team",
  received_at:"2026-09-08T18:00:00Z"
};

test("LinkedIn owned alerts become deduplicated canonical discovery signals", () => {
  const signals = normalizeUserOwnedAlert({ ...base, platform:"linkedin", links:[
    "https://www.linkedin.com/jobs/view/12345/?trackingId=secret",
    "https://www.linkedin.com/comm/jobs/view/67890?midToken=secret",
    "https://linkedin.com/jobs/view/12345/#fragment",
    "https://www.linkedin.com/in/seller-profile",
    "https://evil.example/jobs/view/12345"
  ] });
  assert.equal(signals.length, 2);
  assert.equal(signals[0].source_id, "linkedin_alert_bridge");
  assert.equal(signals[0].source_url, "https://www.linkedin.com/jobs/view/12345/");
  assert.equal(signals[1].source_url, "https://www.linkedin.com/jobs/view/67890/");
  assert.match(signals[0].event_id, /^mail-[a-f0-9]{40}$/);
  assert.equal(JSON.stringify(signals).includes("trackingId"), false);
});

test("Upwork owned alerts accept only exact buyer job routes", () => {
  const signals = normalizeUserOwnedAlert({ ...base, platform:"upwork", links:[
    "https://www.upwork.com/freelance-jobs/apply/Scan-Cleanup_~012345/?source=alert",
    "https://www.upwork.com/jobs/~abcdef/",
    "https://www.upwork.com/ab/feed/jobs/details/~fedcba?utm_source=email",
    "https://www.upwork.com/services/product/seller-offer"
  ] });
  assert.deepEqual(signals.map((item) => item.source_url), [
    "https://www.upwork.com/freelance-jobs/apply/Scan-Cleanup_~012345/",
    "https://www.upwork.com/jobs/~abcdef/",
    "https://www.upwork.com/jobs/~fedcba/"
  ]);
  assert.equal(new Set(signals.map((item) => item.event_id)).size, 3);
});

test("normalizer fails closed on unsupported or malformed alert envelopes", () => {
  assert.throws(() => normalizeUserOwnedAlert({ ...base, platform:"facebook", links:[] }), /ALERT_PLATFORM_UNSUPPORTED/);
  assert.throws(() => normalizeUserOwnedAlert({ ...base, platform:"linkedin", links:new Array(26).fill("https://www.linkedin.com/jobs/view/1") }), /ALERT_PAYLOAD_INVALID/);
  assert.throws(() => normalizeUserOwnedAlert({ ...base, platform:"linkedin", received_at:"not-a-date", links:[] }), /ALERT_PAYLOAD_INVALID/);
});
