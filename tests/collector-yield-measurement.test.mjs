import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { LIVE_YIELD_CONFIRMATION, runLiveYieldMeasurement } from "../scripts/collector-yield-measurement.mjs";
import {
  YIELD_MEASUREMENT_MAX_REQUESTS,
  YIELD_MEASUREMENT_PACK_IDS,
  measureCollectorYield
} from "../src/server/collectors/yield-measurement.mjs";
import { SOURCE_QUERY_PACKS } from "../src/server/collectors/query-packs.mjs";

const NOW = "2026-09-05T12:00:00.000Z";
const fixtures = {
  ted:JSON.parse(await readFile(new URL("../fixtures/collectors/ted-search-response.json", import.meta.url), "utf8")),
  findTender:JSON.parse(await readFile(new URL("../fixtures/collectors/find-tender-release-package.json", import.meta.url), "utf8")),
  contractsFinder:JSON.parse(await readFile(new URL("../fixtures/collectors/contracts-finder-release-package.json", import.meta.url), "utf8"))
};

test("runtime query packs use the unambiguous FACS expansion", () => {
  assert.deepEqual(SOURCE_QUERY_PACKS.pipeline_consulting.phrases, [
    "pipeline consulting",
    "character pipeline",
    "facial rig",
    "facial action coding system"
  ]);
  assert.doesNotMatch(JSON.stringify(SOURCE_QUERY_PACKS.pipeline_consulting.phrases), /[\"']FACS[\"']/);
});

test("production overflow phrases cannot broaden into aerial or GIS photogrammetry", () => {
  assert.deepEqual(SOURCE_QUERY_PACKS.production_overflow.phrases, [
    "production overflow",
    "3D character services",
    "human photogrammetry services",
    "human scan processing"
  ]);
  assert.ok(SOURCE_QUERY_PACKS.production_overflow.phrases.every((phrase) => phrase !== "photogrammetry services" && phrase !== "scan processing"));
});

test("yield measurement is fixed to six zero-cost requests and all approved packs", async () => {
  const urls = [];
  const result = await measureCollectorYield({
    nowIso:NOW,
    delayMs:0,
    fetchImpl:async (url) => {
      urls.push(String(url));
      if (String(url).startsWith("https://api.ted.europa.eu/")) return Response.json(fixtures.ted);
      if (String(url).startsWith("https://www.find-tender.service.gov.uk/")) return Response.json(fixtures.findTender);
      if (String(url).startsWith("https://www.contractsfinder.service.gov.uk/")) return Response.json(fixtures.contractsFinder);
      throw new Error("Unexpected URL");
    }
  });
  assert.equal(result.ok, true);
  assert.equal(result.network_requests, YIELD_MEASUREMENT_MAX_REQUESTS);
  assert.equal(result.max_network_requests, 6);
  assert.equal(result.records_per_page, 50);
  assert.equal(result.automatic_retries, 0);
  assert.equal(result.openai_requests, 0);
  assert.equal(result.cost_usd, 0);
  assert.equal(result.persistence, "NONE");
  assert.deepEqual(Object.keys(result.sources.ted_eu), YIELD_MEASUREMENT_PACK_IDS);
  assert.deepEqual(Object.keys(result.sources.find_tender_uk), YIELD_MEASUREMENT_PACK_IDS);
  assert.deepEqual(Object.keys(result.sources.contracts_finder_uk), YIELD_MEASUREMENT_PACK_IDS);
  assert.equal(urls.length, 6);
  assert.ok(urls.every((url) => [
    "https://api.ted.europa.eu/v3/notices/search",
    "https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages",
    "https://www.contractsfinder.service.gov.uk/Published/Notices/OCDS/Search"
  ].some((fixed) => url.startsWith(fixed))));
});

test("live yield CLI refuses to open the network without the exact confirmation", async () => {
  await assert.rejects(runLiveYieldMeasurement([]), /locked/);
  assert.equal(LIVE_YIELD_CONFIRMATION, "--confirm-live-read-only");
});

test("yield measurement records a failed upstream without retries or hiding other sources", async () => {
  let calls = 0;
  const result = await measureCollectorYield({
    nowIso:NOW,
    delayMs:0,
    fetchImpl:async (url) => {
      calls += 1;
      if (String(url).startsWith("https://api.ted.europa.eu/") && calls === 1) throw new DOMException("timeout", "TimeoutError");
      if (String(url).startsWith("https://api.ted.europa.eu/")) return Response.json(fixtures.ted);
      if (String(url).startsWith("https://www.find-tender.service.gov.uk/")) return Response.json(fixtures.findTender);
      return Response.json(fixtures.contractsFinder);
    }
  });
  assert.equal(result.ok, false);
  assert.equal(result.network_requests, 6);
  assert.equal(result.sources.ted_eu.external_development.status, "ERROR");
  assert.equal(result.sources.ted_eu.production_overflow.status, "OK");
  assert.equal(result.sources.find_tender_uk.other_relevant.status, "OK");
  assert.equal(result.automatic_retries, 0);
});
