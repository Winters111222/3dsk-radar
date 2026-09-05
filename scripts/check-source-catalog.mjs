// Offline integrity gate for research artifacts. No HTTP, credentials or paid AI.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = async (name) => JSON.parse(await readFile(new URL(`../config/${name}`, import.meta.url), "utf8"));
const [catalog, queries, evidence, qualification] = await Promise.all([
  read("opportunity-sources.v1.json"),
  read("search-query-packs.v1.json"),
  read("source-evidence-cases.v1.json"),
  read("source-historical-qualification.v1.json")
]);
const lanes = new Set(["DIRECT_BUYER", "HIRING_SIGNAL", "PROCUREMENT", "PARTNERSHIP", "DISABLED"]);
const observations = new Set(["HTML_OBSERVED", "DOCUMENTATION_OBSERVED", "INDEX_ONLY", "PARTIAL_ACCESS", "UNVERIFIED", "UNAVAILABLE"]);
const qualificationTiers = new Set(["A", "B", "C", "DISABLED"]);
const historicalStatuses = new Set([
  "PROVEN_DIRECT_BUYER",
  "PROVEN_HIRING_SIGNAL",
  "PROVEN_ADJACENT_PROCUREMENT",
  "PROVEN_OUTSOURCING_SIGNAL",
  "PROVEN_SUPPLIER_ACCESS_PATH",
  "PROVEN_NONCORE_ONLY",
  "WRONG_DIRECTION_ONLY",
  "NO_RELEVANT_HIT_IN_SAMPLE",
  "UNPROVEN",
  "UNAVAILABLE"
]);
const qualificationActions = new Set([
  "HOLD_ACCESS_BLOCKED",
  "HOLD_FOR_APPROVED_API",
  "HOLD_FOR_SOURCE_SPECIFIC_YIELD",
  "DISCOVERY_ONLY",
  "MANUAL_ONLY",
  "DISABLED_UNTIL_POSITIVE_EVIDENCE",
  "DISABLED"
]);
const unique = (items, label) => assert.equal(new Set(items).size, items.length, `Duplicate ${label}`);
const publicUrl = (value) => {
  const url = new URL(value);
  assert.equal(url.protocol, "https:", `HTTPS required: ${value}`);
  assert.ok(!url.username && !url.password, "Credentials must not appear in source URLs");
  assert.ok(url.hostname.includes(".") && !/^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|\[)/.test(url.hostname), "Expected a public named source");
};
for (const artifact of [catalog, queries, evidence, qualification]) assert.equal(artifact.schema_version, 1);
assert.equal(catalog.status, "RESEARCH_CATALOG_NOT_RUNTIME_CONFIG");
assert.match(catalog.based_on_sha, /^[a-f0-9]{40}$/);
assert.equal(queries.status, "PROPOSED_NOT_RUNTIME_CONFIG");
assert.equal(queries.scheduled_runs_enabled, false);
assert.equal(queries.automatic_paid_execution_enabled, false);
assert.equal(qualification.status, "HISTORICAL_QUALIFICATION_COMPLETE_RUNTIME_LOCKED");
assert.equal(qualification.runtime_policy.default_runtime_eligible, false);
assert.equal(qualification.runtime_policy.required_access_status, "AUTOMATION_APPROVED");
assert.equal(qualification.runtime_policy.required_yield_status, "SOURCE_SPECIFIC_PRECISION_PASSED");
assert.ok(qualification.runtime_policy.minimum_positive_examples >= 2);
assert.ok(qualification.runtime_policy.minimum_precision >= 0.8);
assert.ok(qualification.runtime_policy.minimum_reviewed_accepted_hits >= 30);
unique(catalog.sources.map(x => x.id), "source ID");
unique(qualification.sources.map(x => x.source_id), "qualified source ID");
unique(catalog.sources.flatMap(x => x.seed_urls), "source seed URL");
unique(catalog.adapter_templates.map(x => x.id), "adapter ID");
unique(queries.packs.map(x => x.id), "query pack ID");
unique(evidence.cases.map(x => x.id), "evidence case ID");
const packIds = new Set(queries.packs.map(x => x.id));
const catalogSourceIds = new Set(catalog.sources.map(x => x.id));
const qualifiedSourceIds = new Set(qualification.sources.map(x => x.source_id));
assert.deepEqual([...qualifiedSourceIds].sort(), [...catalogSourceIds].sort(), "Historical qualification must cover every catalog source exactly once");
assert.equal(packIds.has("adjacent_visual"), false, "Visual / AI / Motion query pack is excluded by product decision");
for (const source of catalog.sources) {
  assert.match(source.id, /^[a-z0-9_]+$/);
  assert.ok(lanes.has(source.lane), `Unknown lane: ${source.id}`);
  assert.ok(observations.has(source.observed_access), `Unknown observation: ${source.id}`);
  assert.ok(["P1", "P2", "P3"].includes(source.priority));
  assert.ok(source.seed_urls.length > 0 && source.evidence_urls.length > 0);
  [...source.seed_urls, ...source.evidence_urls].forEach(publicUrl);
  assert.ok(source.notes_cz && source.automation_review && source.pagination);
  assert.match(source.review_date, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(source.regions.length > 0 && source.content_languages.length > 0);
  source.query_pack_ids.forEach(id => assert.ok(packIds.has(id), `Missing pack ${id}`));
  // Turning research into a connector requires a separate implementation review.
  assert.equal(source.crawl_enabled, false, `Research entry cannot enable network: ${source.id}`);
  assert.equal(source.adapter_status, "NOT_IMPLEMENTED");
  if (source.lane === "DISABLED") {
    assert.equal(source.proposed_method, "DISABLED");
    assert.deepEqual(source.query_pack_ids, []);
  }
}
for (const adapter of catalog.adapter_templates) {
  publicUrl(adapter.documentation_url);
  assert.equal(adapter.runtime_tested, false);
  assert.equal(adapter.adapter_status, "NOT_IMPLEMENTED");
}
for (const pack of queries.packs) {
  assert.ok(pack.queries.length > 0 && pack.terms.length > 0);
  pack.queries.forEach(query => assert.ok(typeof query === "string" && query.trim()));
}
queries.localized_queries.forEach(query => {
  assert.ok(packIds.has(query.pack_id));
  assert.equal(query.validation, "UNBENCHMARKED_QUERY_DRAFT");
});
for (const profile of queries.run_profiles) {
  for (const key of ["max_sources", "max_list_pages", "max_detail_pages", "max_ai_candidates", "max_hosted_web_search_calls"]) {
    assert.ok(Number.isSafeInteger(profile[key]) && profile[key] > 0, `${profile.id}.${key}`);
  }
  assert.ok(profile.max_sources <= catalog.sources.filter(s => s.lane !== "DISABLED").length);
  assert.ok(profile.max_ai_candidates <= profile.max_detail_pages);
  assert.ok(profile.proposed_ai_budget_usd > 0 && Number.isFinite(profile.proposed_ai_budget_usd));
}
for (const sample of evidence.cases) {
  publicUrl(sample.source_url);
  assert.ok(sample.note && sample.expected_role && sample.expected_disposition && sample.expected_budget);
}
for (const source of qualification.sources) {
  assert.ok(catalogSourceIds.has(source.source_id));
  assert.ok(qualificationTiers.has(source.tier), `Unknown qualification tier: ${source.source_id}`);
  assert.ok(historicalStatuses.has(source.historical_status), `Unknown historical status: ${source.source_id}`);
  assert.ok(qualificationActions.has(source.action), `Unknown qualification action: ${source.source_id}`);
  assert.equal(typeof source.runtime_eligible, "boolean");
  assert.ok(Array.isArray(source.positive_evidence_urls));
  source.positive_evidence_urls.forEach(publicUrl);
  assert.ok(source.rationale_cz && source.rationale_cz.trim());
  if (["A", "B"].includes(source.tier)) {
    assert.ok(source.positive_evidence_urls.length > 0, `Tier ${source.tier} requires positive evidence: ${source.source_id}`);
  }
  if (source.tier === "A") assert.equal(source.historical_status, "PROVEN_DIRECT_BUYER");
  if (source.tier === "DISABLED") assert.equal(source.action, "DISABLED");
  if (source.runtime_eligible) {
    assert.equal(source.tier, "A", `Only Tier A may become runtime eligible: ${source.source_id}`);
    assert.ok(source.positive_evidence_urls.length >= qualification.runtime_policy.minimum_positive_examples);
    assert.equal(source.access_status, qualification.runtime_policy.required_access_status);
    assert.equal(source.yield_status, qualification.runtime_policy.required_yield_status);
    assert.ok(source.measured_precision >= qualification.runtime_policy.minimum_precision);
    assert.ok(source.reviewed_accepted_hits >= qualification.runtime_policy.minimum_reviewed_accepted_hits);
  }
}
const runtimeEligible = qualification.sources.filter(source => source.runtime_eligible);
assert.equal(runtimeEligible.length, 0, "Qualification artifact is intentionally runtime locked");
console.log(JSON.stringify({
  status: "PASS", sources: catalog.sources.length,
  seed_urls: catalog.sources.reduce((n, s) => n + s.seed_urls.length, 0),
  lanes: Object.fromEntries([...lanes].map(lane => [lane, catalog.sources.filter(s => s.lane === lane).length])),
  adapter_templates: catalog.adapter_templates.length,
  query_packs: queries.packs.length,
  query_templates: queries.packs.reduce((n, p) => n + p.queries.length, 0) + queries.localized_queries.length,
  evidence_cases: evidence.cases.length,
  historical_qualification: Object.fromEntries([...qualificationTiers].map(tier => [tier, qualification.sources.filter(source => source.tier === tier).length])),
  runtime_eligible_sources: runtimeEligible.length,
  enabled_crawlers: 0, network_requests: 0, openai_requests: 0
}, null, 2));
