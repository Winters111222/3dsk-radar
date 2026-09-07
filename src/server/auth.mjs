import { createHash, timingSafeEqual } from "node:crypto";

export function bearerToken(request) {
  const header = request.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

export function constantTimeEqual(left, right) {
  if (typeof left !== "string" || typeof right !== "string" || !left || !right) return false;
  const a = createHash("sha256").update(left, "utf8").digest();
  const b = createHash("sha256").update(right, "utf8").digest();
  return timingSafeEqual(a, b);
}

export function authorizeRequest(request, configuredSecret) {
  if (!configuredSecret) return { ok: false, status: 503, code: "RADAR_ACCESS_NOT_CONFIGURED" };
  const token = bearerToken(request);
  if (!constantTimeEqual(token, configuredSecret)) return { ok: false, status: 401, code: "UNAUTHORIZED" };
  return { ok: true };
}
