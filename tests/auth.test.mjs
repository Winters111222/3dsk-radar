import test from "node:test";
import assert from "node:assert/strict";
import { authorizeRequest, bearerToken, constantTimeEqual } from "../src/server/auth.mjs";

test("bearer token parser accepts only Bearer auth", () => {
  const good = new Request("https://radar.test/api/search", { headers: { authorization: "Bearer team-secret" } });
  const bad = new Request("https://radar.test/api/search", { headers: { authorization: "Basic abc" } });
  assert.equal(bearerToken(good), "team-secret");
  assert.equal(bearerToken(bad), "");
});

test("constant-time helper fails closed on empty or mismatched values", () => {
  assert.equal(constantTimeEqual("abc", "abc"), true);
  assert.equal(constantTimeEqual("abc", "abd"), false);
  assert.equal(constantTimeEqual("abc", "abcd"), false);
  assert.equal(constantTimeEqual("", ""), false);
});

test("access guard distinguishes missing configuration from invalid code", () => {
  const request = new Request("https://radar.test/api/search", { headers: { authorization: "Bearer wrong" } });
  assert.deepEqual(authorizeRequest(request, ""), { ok:false, status:503, code:"RADAR_ACCESS_NOT_CONFIGURED" });
  assert.deepEqual(authorizeRequest(request, "right"), { ok:false, status:401, code:"UNAUTHORIZED" });
});
