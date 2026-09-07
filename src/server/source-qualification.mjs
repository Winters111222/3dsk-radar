import qualification from "../../config/source-historical-qualification.v1.json" with { type:"json" };

const bySourceId = new Map(qualification.sources.map((source) => [source.source_id, source]));

export function sourceQualification(sourceId) {
  return bySourceId.get(sourceId) || null;
}

export function sourceRuntimeEligible(sourceId) {
  const testIds = globalThis.__RADAR_TEST_RUNTIME_ELIGIBLE_SOURCE_IDS__;
  if (testIds instanceof Set) return testIds.has(sourceId);
  return sourceQualification(sourceId)?.runtime_eligible === true;
}

export function anyRuntimeSourceEligible() {
  const testIds = globalThis.__RADAR_TEST_RUNTIME_ELIGIBLE_SOURCE_IDS__;
  if (testIds instanceof Set) return testIds.size > 0;
  return qualification.sources.some((source) => source.runtime_eligible === true);
}

export function runtimeQualificationSummary() {
  return {
    status:qualification.status,
    eligible_source_ids:qualification.sources.filter((source) => source.runtime_eligible).map((source) => source.source_id)
  };
}
