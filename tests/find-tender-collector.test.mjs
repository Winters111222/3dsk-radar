import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  FIND_TENDER_API_URL,
  FIND_TENDER_QUERY_PACKS,
  buildFindTenderRequest,
  collectFindTenderNotices,
  findTenderFreshnessBounds,
  parseFindTenderResponse
} from "../src/server/collectors/find-tender.mjs";

const NOW = "2026-09-05T12:00:00.000Z";
const fixture = JSON.parse(await readFile(new URL("../fixtures/collectors/find-tender-release-package.json", import.meta.url), "utf8"));

test("Find a Tender request is fixed to the official OCDS API, tender stage and a hard 30-day update window", () => {
  assert.deepEqual(findTenderFreshnessBounds(NOW), {
    updatedFrom:"2026-08-06T12:00:00",
    updatedTo:"2026-09-05T12:00:00"
  });
  const request = buildFindTenderRequest({ queryPackId:"other_relevant", nowIso:NOW, limit:500, cursor:"MTAwM=" });
  const url = new URL(request.url);
  assert.equal(`${url.origin}${url.pathname}`, FIND_TENDER_API_URL);
  assert.equal(request.options.method, "GET");
  assert.deepEqual(request.options.headers, { accept:"application/json" });
  assert.equal(url.searchParams.get("updatedFrom"), "2026-08-06T12:00:00");
  assert.equal(url.searchParams.get("updatedTo"), "2026-09-05T12:00:00");
  assert.equal(url.searchParams.get("stages"), "tender");
  assert.equal(url.searchParams.get("limit"), "50");
  assert.equal(url.searchParams.get("cursor"), "MTAwM=");
  assert.throws(() => buildFindTenderRequest({ queryPackId:"other_relevant", nowIso:NOW, cursor:"https://attacker.example" }), { code:"FIND_TENDER_CURSOR_INVALID" });
});

test("Find a Tender exposes only approved query packs and cannot leak Visual / AI / Motion", () => {
  assert.deepEqual(Object.keys(FIND_TENDER_QUERY_PACKS), ["external_development", "production_overflow", "pipeline_consulting", "other_relevant"]);
  assert.doesNotMatch(JSON.stringify(FIND_TENDER_QUERY_PACKS), /VISUAL_AI_MOTION|generative|motion design/i);
  assert.throws(() => buildFindTenderRequest({ queryPackId:"visual_ai_motion", nowIso:NOW }), { code:"FIND_TENDER_QUERY_PACK_UNKNOWN" });
});

test("Find a Tender parser preserves OCDS identity and locally rejects stale, inactive and unrelated releases", () => {
  const parsed = parseFindTenderResponse(fixture, { queryPackId:"other_relevant", fetchedAt:NOW });
  assert.equal(parsed.records.length, 1);
  assert.equal(parsed.rejected_stale_or_undated, 1);
  assert.equal(parsed.rejected_inactive, 1);
  assert.equal(parsed.rejected_scope, 1);
  assert.equal(parsed.rejected_invalid, 0);
  assert.equal(parsed.iteration_next_token, "MTAwM=");
  assert.deepEqual(parsed.records[0], {
    collector_record_id:parsed.records[0].collector_record_id,
    source_id:"find_tender_uk",
    query_pack_id:"other_relevant",
    suggested_categories:["OTHER_RELEVANT", "CAPTURE", "PHOTOGRAMMETRY_PROCESSING", "SCAN_CLEANUP"],
    source_item_id:"070001-2026",
    tender_identity:"ocds-h6vhtk-0a0001",
    source_revision:"070001-2026",
    source_updated_date:"2026-09-01",
    title:"Human photogrammetry and digital double production services",
    summary:"A synthetic public buyer seeks batch capture, scan cleanup and digital-double delivery.",
    buyer_names:["Synthetic UK Museum Buyer"],
    tender_status:"active",
    tender_deadline:"2026-09-25",
    classification_id:"72200000",
    classification_description:"Software programming and consultancy services",
    upstream_tender_value:{ amount:120000, currency:"GBP" },
    matched_phrases:["human photogrammetry", "digital double"],
    canonical_url:"https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-0a0001",
    fetched_at:NOW
  });
});

test("Find a Tender collector performs one zero-AI request and emits cursor plus measured counters", async () => {
  let seen;
  const result = await collectFindTenderNotices({
    queryPackId:"other_relevant",
    nowIso:NOW,
    limit:4,
    fetchImpl:async (url, options) => {
      seen = { url, options };
      return Response.json(fixture);
    }
  });
  assert.equal(new URL(seen.url).origin, "https://www.find-tender.service.gov.uk");
  assert.equal(seen.options.method, "GET");
  assert.equal(result.records.length, 1);
  assert.equal(result.next_cursor, "MTAwM=");
  assert.deepEqual(result.counters, {
    source_services_planned:1,
    source_services_completed:1,
    source_services_blocked:0,
    source_services_failed:0,
    list_pages_fetched:1,
    detail_pages_fetched:0,
    records_seen:4,
    records_returned:1,
    records_rejected_stale_or_undated:1,
    records_rejected_inactive:1,
    records_rejected_scope:1,
    records_rejected_invalid:0,
    openai_requests:0,
    cost_usd:0
  });
});

test("Find a Tender collector fails closed on upstream limits, timeouts and schema drift", async () => {
  await assert.rejects(
    collectFindTenderNotices({ queryPackId:"other_relevant", nowIso:NOW, fetchImpl:async () => new Response("slow down", { status:429, headers:{ "retry-after":"17" } }) }),
    (error) => error.code === "FIND_TENDER_UPSTREAM_RATE_LIMITED" && error.status === 429 && error.retryAfterSeconds === 17
  );
  await assert.rejects(
    collectFindTenderNotices({ queryPackId:"other_relevant", nowIso:NOW, fetchImpl:async () => { throw new DOMException("timed out", "TimeoutError"); } }),
    { code:"FIND_TENDER_TIMEOUT" }
  );
  assert.throws(() => parseFindTenderResponse({ releases:{} }, { queryPackId:"other_relevant", fetchedAt:NOW }), { code:"FIND_TENDER_SCHEMA_MISMATCH" });
  assert.throws(
    () => parseFindTenderResponse({ releases:[], links:{ next:"https://attacker.example/?cursor=MTAwM=" } }, { queryPackId:"other_relevant", fetchedAt:NOW }),
    { code:"FIND_TENDER_SCHEMA_MISMATCH" }
  );
});
