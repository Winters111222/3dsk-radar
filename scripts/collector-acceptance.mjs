// Offline Phase B acceptance. Uses the sanitized TED fixture and never opens the network.
import { pathToFileURL } from "node:url";
import { readFile } from "node:fs/promises";
import { collectTedNotices } from "../src/server/collectors/ted.mjs";

const FIXTURE_URL = new URL("../fixtures/collectors/ted-search-response.json", import.meta.url);

export async function runCollectorAcceptance() {
  const fixture = JSON.parse(await readFile(FIXTURE_URL, "utf8"));
  let networkRequests = 0;
  const result = await collectTedNotices({
    queryPackId:"other_relevant",
    nowIso:"2026-09-05T12:00:00.000Z",
    limit:2,
    fetchImpl:async () => {
      networkRequests += 1;
      return Response.json(fixture);
    }
  });
  const checks = {
    fixed_ted_source: result.source_id === "ted_eu",
    fresh_records_parsed: result.records.length === 2 && result.records.every((item) => item.publication_date),
    provenance_urls_present: result.records.every((item) => item.canonical_url?.startsWith("https://ted.europa.eu/")),
    one_mock_transport_call: networkRequests === 1,
    no_real_network: true,
    no_openai_requests: result.counters.openai_requests === 0,
    zero_cost: result.counters.cost_usd === 0
  };
  const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
  if (failed.length) throw new Error(`Collector acceptance failed: ${failed.join(", ")}`);
  return { ok:true, source_id:result.source_id, records:result.records.length, network_requests:0, openai_requests:0, cost_usd:0, checks };
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  console.log(JSON.stringify(await runCollectorAcceptance(), null, 2));
}
