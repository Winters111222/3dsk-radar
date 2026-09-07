import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  CONTRACTS_FINDER_API_URL,
  CONTRACTS_FINDER_QUERY_PACKS,
  buildContractsFinderRequest,
  collectContractsFinderNotices,
  parseContractsFinderResponse
} from "../src/server/collectors/contracts-finder.mjs";

const NOW = "2026-09-05T12:00:00.000Z";
const fixture = JSON.parse(await readFile(new URL("../fixtures/collectors/contracts-finder-release-package.json", import.meta.url), "utf8"));

test("Contracts Finder request is fixed to its public OCDS endpoint and hard-capped", () => {
  const request = buildContractsFinderRequest({ queryPackId:"other_relevant", nowIso:NOW, limit:500, cursor:"MTAwM=" });
  const url = new URL(request.url);
  assert.equal(`${url.origin}${url.pathname}`, CONTRACTS_FINDER_API_URL);
  assert.equal(url.searchParams.get("publishedFrom"), "2026-08-06T12:00:00");
  assert.equal(url.searchParams.get("publishedTo"), "2026-09-05T12:00:00");
  assert.equal(url.searchParams.get("stages"), "tender");
  assert.equal(url.searchParams.get("limit"), "50");
  assert.equal(url.searchParams.get("cursor"), "MTAwM=");
  assert.deepEqual(request.options, { method:"GET", headers:{ accept:"application/json" } });
});

test("Contracts Finder has only the four approved query packs", () => {
  assert.deepEqual(Object.keys(CONTRACTS_FINDER_QUERY_PACKS), ["external_development", "production_overflow", "pipeline_consulting", "other_relevant"]);
  assert.doesNotMatch(JSON.stringify(CONTRACTS_FINDER_QUERY_PACKS), /VISUAL_AI_MOTION|generative|motion design/i);
  assert.throws(() => buildContractsFinderRequest({ queryPackId:"visual_ai_motion", nowIso:NOW }), { code:"CONTRACTS_FINDER_QUERY_PACK_UNKNOWN" });
});

test("Contracts Finder parser preserves publication and first-party notice provenance", () => {
  const parsed = parseContractsFinderResponse(fixture, { queryPackId:"other_relevant", fetchedAt:NOW });
  assert.equal(parsed.records.length, 1);
  assert.equal(parsed.rejected_stale_or_undated, 1);
  assert.equal(parsed.rejected_inactive, 1);
  assert.equal(parsed.rejected_scope, 1);
  assert.equal(parsed.rejected_invalid, 0);
  assert.equal(parsed.iteration_next_token, "MTAwM=");
  assert.equal(parsed.records[0].source_id, "contracts_finder_uk");
  assert.equal(parsed.records[0].published_date, "2026-09-01");
  assert.equal(parsed.records[0].source_updated_date, "2026-09-01");
  assert.equal(parsed.records[0].tender_identity, "ocds-b5fd17-00000000-0000-4000-8000-000000000001");
  assert.deepEqual(parsed.records[0].upstream_tender_value, { amount:75000, currency:"GBP" });
  assert.equal(parsed.records[0].canonical_url, "https://www.contractsfinder.service.gov.uk/Notice/00000000-0000-4000-8000-000000000001");
});

test("Contracts Finder collector remains cursor-aware, zero-AI and measurable", async () => {
  let seen;
  const result = await collectContractsFinderNotices({
    queryPackId:"other_relevant",
    nowIso:NOW,
    limit:4,
    fetchImpl:async (url, options) => {
      seen = { url, options };
      return Response.json(fixture);
    }
  });
  assert.equal(new URL(seen.url).origin, "https://www.contractsfinder.service.gov.uk");
  assert.equal(seen.options.method, "GET");
  assert.equal(result.records.length, 1);
  assert.equal(result.next_cursor, "MTAwM=");
  assert.equal(result.counters.records_seen, 4);
  assert.equal(result.counters.records_returned, 1);
  assert.equal(result.counters.openai_requests, 0);
  assert.equal(result.counters.cost_usd, 0);
});

test("Contracts Finder converts its documented rate-limit 403 into a no-retry boundary", async () => {
  await assert.rejects(
    collectContractsFinderNotices({ queryPackId:"other_relevant", nowIso:NOW, fetchImpl:async () => new Response("Request forbidden", { status:403 }) }),
    (error) => error.code === "CONTRACTS_FINDER_UPSTREAM_RATE_LIMITED"
      && error.status === 429
      && error.upstreamStatus === 403
      && error.retryAfterSeconds === 300
  );
  await assert.rejects(
    collectContractsFinderNotices({ queryPackId:"other_relevant", nowIso:NOW, fetchImpl:async () => { throw new DOMException("timed out", "TimeoutError"); } }),
    { code:"CONTRACTS_FINDER_TIMEOUT" }
  );
  assert.throws(
    () => parseContractsFinderResponse({ releases:[], links:{ next:"https://attacker.example/?cursor=MTAwM=" } }, { queryPackId:"other_relevant", fetchedAt:NOW }),
    { code:"CONTRACTS_FINDER_SCHEMA_MISMATCH" }
  );
});
