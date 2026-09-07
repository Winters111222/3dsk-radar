import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  TED_QUERY_PACKS,
  TED_RETURN_FIELDS,
  TED_SEARCH_URL,
  buildTedExpertQuery,
  buildTedSearchRequest,
  collectTedNotices,
  parseTedSearchResponse,
  tedFreshnessCutoff
} from "../src/server/collectors/ted.mjs";

const NOW = "2026-09-05T12:00:00.000Z";
const fixture = JSON.parse(await readFile(new URL("../fixtures/collectors/ted-search-response.json", import.meta.url), "utf8"));

test("TED request is fixed to the anonymous public API, ACTIVE notices and a hard 30-day window", () => {
  assert.equal(tedFreshnessCutoff(NOW), "20260806");
  const request = buildTedSearchRequest({ queryPackId:"other_relevant", nowIso:NOW, page:2, limit:500 });
  const body = JSON.parse(request.options.body);
  assert.equal(request.url, TED_SEARCH_URL);
  assert.equal(request.options.method, "POST");
  assert.deepEqual(Object.keys(request.options.headers).sort(), ["accept", "content-type"]);
  assert.equal(body.scope, "ACTIVE");
  assert.equal(body.page, 2);
  assert.equal(body.limit, 50);
  assert.equal(body.paginationMode, "PAGE_NUMBER");
  assert.match(body.query, /publication-date>=20260806/);
  assert.match(body.query, /SORT BY publication-date DESC$/);
  assert.deepEqual(body.fields, TED_RETURN_FIELDS);
});

test("all TED query packs are approved groups and Visual / AI / Motion cannot leak back in", () => {
  assert.deepEqual(Object.keys(TED_QUERY_PACKS), ["external_development", "production_overflow", "pipeline_consulting", "other_relevant"]);
  const serialized = JSON.stringify(TED_QUERY_PACKS);
  assert.doesNotMatch(serialized, /VISUAL_AI_MOTION|generative|motion design/i);
  assert.match(buildTedExpertQuery("external_development", NOW), /external development/);
});

test("TED parser preserves provenance and tolerates documented field-shape variants", () => {
  const parsed = parseTedSearchResponse(fixture, { queryPackId:"other_relevant", fetchedAt:NOW });
  assert.equal(parsed.records.length, 2);
  assert.equal(parsed.upstream_total, 2);
  assert.deepEqual(parsed.records[0], {
    collector_record_id: parsed.records[0].collector_record_id,
    source_id: "ted_eu",
    query_pack_id: "other_relevant",
    suggested_categories: ["OTHER_RELEVANT", "CAPTURE", "PHOTOGRAMMETRY_PROCESSING", "SCAN_CLEANUP"],
    publication_number: "612345-2026",
    publication_date: "2026-09-01",
    title: "Human photogrammetry and digital-double production services",
    buyer_names: ["Synthetic European Museum Buyer"],
    buyer_countries: ["DEU"],
    notice_type: "cn-standard",
    form_type: "competition",
    procedure_identifier: "11111111-2222-3333-4444-555555555555",
    canonical_url: "https://ted.europa.eu/en/notice/-/detail/612345-2026",
    fetched_at: NOW
  });
  assert.equal(parsed.records[1].canonical_url, "https://ted.europa.eu/en/notice/-/detail/612346-2026");
  assert.deepEqual(parsed.records[1].buyer_names, ["Synthetic Public Media Buyer"]);
});

test("TED collector performs one zero-AI request and emits measurable counters", async () => {
  let seen;
  const result = await collectTedNotices({
    queryPackId:"production_overflow",
    nowIso:NOW,
    limit:2,
    fetchImpl:async (url, options) => {
      seen = { url, options };
      return Response.json(fixture);
    }
  });
  assert.equal(seen.url, TED_SEARCH_URL);
  assert.equal(JSON.parse(seen.options.body).limit, 2);
  assert.equal(result.records.length, 2);
  assert.deepEqual(result.counters, {
    source_services_planned:1,
    source_services_completed:1,
    source_services_blocked:0,
    source_services_failed:0,
    list_pages_fetched:1,
    detail_pages_fetched:0,
    records_seen:2,
    records_returned:2,
    records_rejected_stale_or_undated:0,
    openai_requests:0,
    cost_usd:0
  });
});

test("TED collector fails closed on unknown packs, upstream errors and schema drift", async () => {
  assert.throws(() => buildTedExpertQuery("visual_ai_motion", NOW), { code:"TED_QUERY_PACK_UNKNOWN" });
  await assert.rejects(
    collectTedNotices({ queryPackId:"other_relevant", nowIso:NOW, fetchImpl:async () => new Response("bad query", { status:400 }) }),
    (error) => error.code === "TED_UPSTREAM_FAILED" && error.upstreamStatus === 400 && /bad query/.test(error.message)
  );
  assert.throws(() => parseTedSearchResponse({ notices:{} }, { queryPackId:"other_relevant", fetchedAt:NOW }), { code:"TED_SCHEMA_MISMATCH" });
});

test("TED parser independently removes stale, future and undated records even if upstream returns them", () => {
  const notices = [
    { "publication-number":"old-2026", "publication-date":"2026-08-05" },
    { "publication-number":"boundary-2026", "publication-date":"2026-08-06" },
    { "publication-number":"future-2026", "publication-date":"2026-09-06" },
    { "publication-number":"undated-2026" }
  ];
  const parsed = parseTedSearchResponse({ notices }, { queryPackId:"other_relevant", fetchedAt:NOW });
  assert.deepEqual(parsed.records.map((record) => record.publication_number), ["boundary-2026"]);
  assert.equal(parsed.rejected_stale_or_undated, 3);
});
