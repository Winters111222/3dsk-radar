import test from "node:test";
import assert from "node:assert/strict";
import {
  CONTRACTS_FINDER_RECORD_URL,
  FIND_TENDER_RECORD_URL,
  buildSourceDetailRequest,
  fetchSourceDetail
} from "../src/server/source-detail-adapters.mjs";
import { TED_SEARCH_URL } from "../src/server/collectors/ted.mjs";

const NOW = "2026-09-05T12:00:00.000Z";

function candidate(sourceId, overrides = {}) {
  const records = {
    ted_eu:{ source_id:"ted_eu", publication_number:"543210-2026", source_item_id:"543210-2026", canonical_url:"https://ted.europa.eu/en/notice/-/detail/543210-2026" },
    find_tender_uk:{ source_id:"find_tender_uk", tender_identity:"ocds-h6vhtk-012345", canonical_url:"https://www.find-tender.service.gov.uk/procurement/ocds-h6vhtk-012345" },
    contracts_finder_uk:{ source_id:"contracts_finder_uk", tender_identity:"ocds-b5fd17-abcdef", canonical_url:"https://www.contractsfinder.service.gov.uk/Notice/00000000-0000-0000-0000-000000000000" }
  };
  return { primary_record:{ ...records[sourceId], ...overrides } };
}

test("detail requests are fixed to approved first-party endpoints and ignore record URLs", () => {
  const ted = buildSourceDetailRequest(candidate("ted_eu", { canonical_url:"https://attacker.test/path" }));
  assert.equal(ted.url, TED_SEARCH_URL);
  assert.equal(ted.options.method, "POST");
  assert.deepEqual(JSON.parse(ted.options.body).query, 'publication-number="543210-2026"');

  const fts = buildSourceDetailRequest(candidate("find_tender_uk", { canonical_url:"https://attacker.test/path" }));
  assert.equal(fts.url, `${FIND_TENDER_RECORD_URL}/ocds-h6vhtk-012345`);
  const cfs = buildSourceDetailRequest(candidate("contracts_finder_uk", { canonical_url:"https://attacker.test/path" }));
  assert.equal(cfs.url, `${CONTRACTS_FINDER_RECORD_URL}/ocds-b5fd17-abcdef`);

  assert.throws(() => buildSourceDetailRequest(candidate("find_tender_uk", { tender_identity:"../../secret?x=1" })), (error) => error.code === "FIND_TENDER_DETAIL_ID_INVALID");
  assert.throws(() => buildSourceDetailRequest(candidate("ted_eu", { publication_number:"1 OR *" })), (error) => error.code === "TED_DETAIL_ID_INVALID");
});

test("TED detail adapter verifies identity, schema and zero-AI counters", async () => {
  let observed;
  const detail = await fetchSourceDetail({
    candidate:candidate("ted_eu"),
    nowIso:NOW,
    fetchImpl:async (url, options) => {
      observed = { url, options };
      return Response.json({ notices:[{ "publication-number":"543210-2026", "notice-title":"Digital human production services" }] });
    }
  });
  assert.equal(observed.url, TED_SEARCH_URL);
  assert.equal(observed.options.redirect, "error");
  assert.equal(detail.source_identity, "543210-2026");
  assert.equal(detail.counters.openai_requests, 0);
  assert.equal(detail.counters.cost_usd, 0);
  await assert.rejects(
    () => fetchSourceDetail({ candidate:candidate("ted_eu"), nowIso:NOW, fetchImpl:async () => Response.json({ notices:[] }) }),
    (error) => error.code === "TED_DETAIL_IDENTITY_MISMATCH"
  );
});

test("OCDS detail adapters select the matching process and reject schema drift", async () => {
  for (const sourceId of ["find_tender_uk", "contracts_finder_uk"]) {
    const input = candidate(sourceId);
    const ocid = input.primary_record.tender_identity;
    const detail = await fetchSourceDetail({
      candidate:input,
      nowIso:NOW,
      fetchImpl:async () => Response.json({ records:[{ ocid, compiledRelease:{ ocid, date:NOW, tender:{ title:"Character services" } }, releases:[] }] })
    });
    assert.equal(detail.document.ocid, ocid);
    assert.equal(detail.source_identity, ocid);
  }
  await assert.rejects(
    () => fetchSourceDetail({ candidate:candidate("find_tender_uk"), nowIso:NOW, fetchImpl:async () => Response.json({ releases:[] }) }),
    (error) => error.code === "OCDS_DETAIL_SCHEMA_MISMATCH"
  );
});

test("detail transport fails closed on rate limits, oversized bodies and timeouts", async () => {
  await assert.rejects(
    () => fetchSourceDetail({ candidate:candidate("find_tender_uk"), nowIso:NOW, fetchImpl:async () => new Response("limited", { status:429, headers:{ "retry-after":"17" } }) }),
    (error) => error.code === "SOURCE_DETAIL_RATE_LIMITED" && error.retryAfterSeconds === 17
  );
  await assert.rejects(
    () => fetchSourceDetail({ candidate:candidate("find_tender_uk"), nowIso:NOW, maxBytes:8, fetchImpl:async () => new Response("123456789") }),
    (error) => error.code === "SOURCE_DETAIL_RESPONSE_TOO_LARGE"
  );
  await assert.rejects(
    () => fetchSourceDetail({ candidate:candidate("find_tender_uk"), nowIso:NOW, fetchImpl:async () => { throw Object.assign(new Error("late"), { name:"TimeoutError" }); } }),
    (error) => error.code === "SOURCE_DETAIL_TIMEOUT" && error.status === 504
  );
});
