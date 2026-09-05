// Offline Phase B acceptance. Uses sanitized fixtures and never opens the network.
import { pathToFileURL } from "node:url";
import { readFile } from "node:fs/promises";
import { collectContractsFinderNotices } from "../src/server/collectors/contracts-finder.mjs";
import { collectFindTenderNotices } from "../src/server/collectors/find-tender.mjs";
import { collectTedNotices } from "../src/server/collectors/ted.mjs";

const TED_FIXTURE_URL = new URL("../fixtures/collectors/ted-search-response.json", import.meta.url);
const FIND_TENDER_FIXTURE_URL = new URL("../fixtures/collectors/find-tender-release-package.json", import.meta.url);
const CONTRACTS_FINDER_FIXTURE_URL = new URL("../fixtures/collectors/contracts-finder-release-package.json", import.meta.url);

export async function runCollectorAcceptance() {
  const [tedFixture, findTenderFixture, contractsFinderFixture] = await Promise.all([
    readFile(TED_FIXTURE_URL, "utf8").then(JSON.parse),
    readFile(FIND_TENDER_FIXTURE_URL, "utf8").then(JSON.parse),
    readFile(CONTRACTS_FINDER_FIXTURE_URL, "utf8").then(JSON.parse)
  ]);
  let mockTransportCalls = 0;
  const ted = await collectTedNotices({
    queryPackId:"other_relevant",
    nowIso:"2026-09-05T12:00:00.000Z",
    limit:2,
    fetchImpl:async () => {
      mockTransportCalls += 1;
      return Response.json(tedFixture);
    }
  });
  const findTender = await collectFindTenderNotices({
    queryPackId:"other_relevant",
    nowIso:"2026-09-05T12:00:00.000Z",
    limit:4,
    fetchImpl:async () => {
      mockTransportCalls += 1;
      return Response.json(findTenderFixture);
    }
  });
  const contractsFinder = await collectContractsFinderNotices({
    queryPackId:"other_relevant",
    nowIso:"2026-09-05T12:00:00.000Z",
    limit:4,
    fetchImpl:async () => {
      mockTransportCalls += 1;
      return Response.json(contractsFinderFixture);
    }
  });
  const checks = {
    fixed_ted_source:ted.source_id === "ted_eu",
    fixed_find_tender_source:findTender.source_id === "find_tender_uk",
    fixed_contracts_finder_source:contractsFinder.source_id === "contracts_finder_uk",
    fresh_records_parsed:ted.records.length === 2 && findTender.records.length === 1 && contractsFinder.records.length === 1,
    provenance_urls_present:
      ted.records.every((item) => item.canonical_url?.startsWith("https://ted.europa.eu/"))
      && findTender.records.every((item) => item.canonical_url?.startsWith("https://www.find-tender.service.gov.uk/procurement/"))
      && contractsFinder.records.every((item) => item.canonical_url?.startsWith("https://www.contractsfinder.service.gov.uk/Notice/")),
    three_mock_transport_calls:mockTransportCalls === 3,
    cursor_preserved:findTender.next_cursor === "MTAwM=" && contractsFinder.next_cursor === "MTAwM=",
    no_real_network: true,
    no_openai_requests:ted.counters.openai_requests === 0 && findTender.counters.openai_requests === 0 && contractsFinder.counters.openai_requests === 0,
    zero_cost:ted.counters.cost_usd === 0 && findTender.counters.cost_usd === 0 && contractsFinder.counters.cost_usd === 0
  };
  const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
  if (failed.length) throw new Error(`Collector acceptance failed: ${failed.join(", ")}`);
  return {
    ok:true,
    sources:[ted.source_id, findTender.source_id, contractsFinder.source_id],
    records:ted.records.length + findTender.records.length + contractsFinder.records.length,
    network_requests:0,
    openai_requests:0,
    cost_usd:0,
    checks
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  console.log(JSON.stringify(await runCollectorAcceptance(), null, 2));
}
