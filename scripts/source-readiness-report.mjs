// Offline Tier A readiness report. It never opens the network or calls OpenAI.
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export function buildSourceReadinessReport(qualification) {
  const policy = qualification.runtime_policy;
  const sources = qualification.sources
    .filter((source) => source.tier === "A")
    .map((source) => {
      const evidenceReady = source.positive_evidence_urls.length >= policy.minimum_positive_examples;
      const accessReady = source.access_status === policy.required_access_status;
      const yieldReady = source.yield_status === policy.required_yield_status
        && source.reviewed_candidates >= policy.minimum_reviewed_candidates
        && source.measured_precision >= policy.minimum_precision;
      const activationBlockers = [];
      if (!evidenceReady) activationBlockers.push("HISTORICAL_EVIDENCE_INCOMPLETE");
      if (!accessReady) activationBlockers.push(source.access_status);
      if (!yieldReady) activationBlockers.push(source.yield_status);

      return {
        source_id:source.source_id,
        historical_evidence:evidenceReady ? "PASS" : "FAIL",
        positive_examples:source.positive_evidence_urls.length,
        access_status:source.access_status,
        yield_status:source.yield_status,
        reviewed_candidates:source.reviewed_candidates,
        accepted_relevant_hits:source.accepted_relevant_hits,
        measured_precision:source.measured_precision,
        runtime_eligible:source.runtime_eligible,
        activation_blockers:activationBlockers
      };
    });

  const zeroCostCollectorIds = new Set(["ted_eu", "find_tender_uk", "contracts_finder_uk"]);
  const zeroCostCollectors = qualification.sources
    .filter((source) => zeroCostCollectorIds.has(source.source_id))
    .map((source) => ({
      source_id:source.source_id,
      access_status:source.access_status || "UNREVIEWED",
      access_ready:source.access_status === policy.required_access_status,
      yield_status:source.yield_status || "NOT_MEASURED",
      reviewed_candidates:Number(source.reviewed_candidates || 0),
      accepted_relevant_hits:Number(source.accepted_relevant_hits || 0),
      measured_precision:Number.isFinite(source.measured_precision) ? source.measured_precision : null,
      runtime_eligible:source.runtime_eligible === true,
      decision:source.runtime_eligible ? "RUNTIME_ELIGIBLE" : "MEASURE_MORE_KEEP_LOCKED"
    }));

  return {
    ok:sources.every((source) => source.runtime_eligible === false),
    mode:"OFFLINE_TIER_A_READINESS",
    policy:{
      minimum_positive_examples:policy.minimum_positive_examples,
      required_access_status:policy.required_access_status,
      minimum_reviewed_candidates:policy.minimum_reviewed_candidates,
      minimum_precision:policy.minimum_precision,
      precision_definition:policy.precision_definition
    },
    summary:{
      tier_a_sources:sources.length,
      historical_evidence_ready:sources.filter((source) => source.historical_evidence === "PASS").length,
      access_ready:sources.filter((source) => source.access_status === policy.required_access_status).length,
      yield_ready:sources.filter((source) => source.yield_status === policy.required_yield_status).length,
      runtime_eligible:sources.filter((source) => source.runtime_eligible).length
    },
    zero_cost_collectors:zeroCostCollectors,
    network_requests:0,
    openai_requests:0,
    cost_usd:0,
    sources
  };
}

export async function loadSourceReadinessReport() {
  const qualification = JSON.parse(await readFile(
    new URL("../config/source-historical-qualification.v1.json", import.meta.url),
    "utf8"
  ));
  return buildSourceReadinessReport(qualification);
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  console.log(JSON.stringify(await loadSourceReadinessReport(), null, 2));
}
