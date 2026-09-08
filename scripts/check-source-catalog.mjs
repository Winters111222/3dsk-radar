// Offline integrity gate for research artifacts. No HTTP, credentials or paid AI.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = async (name) => JSON.parse(await readFile(new URL(`../config/${name}`, import.meta.url), "utf8"));
const [catalog, queries, evidence, qualification, deepResearchWatchlist, deepResearchQueries, deepResearchAliases] = await Promise.all([
  read("opportunity-sources.v1.json"),
  read("search-query-packs.v1.json"),
  read("source-evidence-cases.v1.json"),
  read("source-historical-qualification.v1.json"),
  read("deep-research-watchlist.v1.json"),
  read("deep-research-query-shards.v1.json"),
  read("deep-research-source-aliases.v1.json")
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
  "HOLD_FOR_WRITTEN_API_PERMISSION",
  "HOLD_FOR_COMMERCIAL_API_AGREEMENT",
  "HOLD_FOR_SOURCE_SPECIFIC_YIELD",
  "DISCOVERY_ONLY",
  "MANUAL_ONLY",
  "DISABLED_UNTIL_POSITIVE_EVIDENCE",
  "DISABLED"
]);
const accessStatuses = new Set([
  "AUTOMATION_APPROVED",
  "APPROVED_API_REQUIRED",
  "WRITTEN_PERMISSION_REQUIRED",
  "COMMERCIAL_API_AGREEMENT_REQUIRED",
  "BLOCKED_BY_ROBOTS",
  "COMMERCIAL_PERMISSION_UNCONFIRMED"
]);
const yieldStatuses = new Set([
  "NOT_MEASURED",
  "SOURCE_SPECIFIC_PRECISION_PASSED",
  "SOURCE_SPECIFIC_PRECISION_FAILED"
]);
const deepResearchActivationStates = new Set([
  "ACCESS_PILOT",
  "DOCUMENTED_CHANNEL_CANARY",
  "ENDPOINT_VALIDATION_REQUIRED",
  "HOLD",
  "MI_ONLY",
  "NATIVE_PILOT_TOS_REVIEW",
  "PERMISSION_REQUIRED"
]);
const unique = (items, label) => assert.equal(new Set(items).size, items.length, `Duplicate ${label}`);
const publicUrl = (value) => {
  const url = new URL(value);
  assert.equal(url.protocol, "https:", `HTTPS required: ${value}`);
  assert.ok(!url.username && !url.password, "Credentials must not appear in source URLs");
  assert.ok(url.hostname.includes(".") && !/^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|\[)/.test(url.hostname), "Expected a public named source");
};
for (const artifact of [catalog, queries, evidence, qualification]) assert.equal(artifact.schema_version, 1);
for (const artifact of [deepResearchWatchlist, deepResearchQueries, deepResearchAliases]) assert.equal(artifact.schema_version, 1);
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
assert.ok(qualification.runtime_policy.minimum_reviewed_candidates >= 30);
assert.equal(qualification.runtime_policy.precision_definition, "accepted_relevant_hits / reviewed_candidates");
assert.equal(deepResearchWatchlist.sources.length, 50);
assert.equal(deepResearchQueries.status, "PROPOSED_NOT_RUNTIME_CONFIG");
assert.equal(deepResearchQueries.scheduled_runs_enabled, false);
assert.equal(deepResearchQueries.automatic_paid_execution_enabled, false);
assert.equal(deepResearchQueries.queries.length, 52);
assert.equal(deepResearchAliases.status, "RESEARCH_DEDUP_ONLY");
assert.equal(deepResearchAliases.aliases.length, 19);
unique(catalog.sources.map(x => x.id), "source ID");
unique(qualification.sources.map(x => x.source_id), "qualified source ID");
unique(catalog.sources.flatMap(x => x.seed_urls), "source seed URL");
unique(catalog.adapter_templates.map(x => x.id), "adapter ID");
unique(queries.packs.map(x => x.id), "query pack ID");
unique(evidence.cases.map(x => x.id), "evidence case ID");
unique(deepResearchWatchlist.sources.map(x => x.id), "deep research source ID");
unique(deepResearchWatchlist.sources.flatMap(x => x.watchlist_urls), "deep research watchlist URL");
unique(deepResearchQueries.queries.map(x => x.query_id), "deep research query ID");
unique(deepResearchAliases.aliases.map(x => x.research_source_id), "deep research alias source ID");
const packIds = new Set(queries.packs.map(x => x.id));
const catalogSourceIds = new Set(catalog.sources.map(x => x.id));
const qualifiedSourceIds = new Set(qualification.sources.map(x => x.source_id));
const deepResearchSourceIds = new Set(deepResearchWatchlist.sources.map(x => x.id));
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
for (const source of deepResearchWatchlist.sources) {
  assert.equal(source.enabled, false, `Deep research source must remain default-off: ${source.id}`);
  assert.ok(deepResearchActivationStates.has(source.activation_state), `Unknown deep research activation state: ${source.id}`);
  assert.ok(Number.isSafeInteger(source.priority) && source.priority >= 1);
  assert.ok(source.watchlist_urls.length > 0);
  source.watchlist_urls.forEach(publicUrl);
  source.evidence_urls.forEach(publicUrl);
  assert.ok(Array.isArray(source.include_terms) && source.include_terms.length > 0);
  assert.ok(Array.isArray(source.exclude_terms));
  if (source.activation_state === "MI_ONLY") assert.equal(source.buyer_only, false);
}
for (const query of deepResearchQueries.queries) {
  assert.equal(query.enabled, false, `Deep research query must remain default-off: ${query.query_id}`);
  assert.ok(deepResearchSourceIds.has(query.source_id), `Unknown deep research query source: ${query.source_id}`);
  assert.ok(query.native_query && query.web_discovery_query && query.native_filters && query.geography_rule);
}
for (const alias of deepResearchAliases.aliases) {
  assert.ok(deepResearchSourceIds.has(alias.research_source_id), `Unknown research alias source: ${alias.research_source_id}`);
  assert.ok(catalogSourceIds.has(alias.canonical_source_id), `Unknown canonical alias source: ${alias.canonical_source_id}`);
  assert.ok(["SAME_SOURCE", "BROADER_RESEARCH_SCOPE"].includes(alias.relation));
}
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
  if (source.tier === "A") {
    assert.equal(source.historical_status, "PROVEN_DIRECT_BUYER");
    assert.ok(source.positive_evidence_urls.length >= qualification.runtime_policy.minimum_positive_examples, `Tier A requires two buyer examples: ${source.source_id}`);
    assert.ok(accessStatuses.has(source.access_status), `Unknown access status: ${source.source_id}`);
    assert.ok(Array.isArray(source.access_evidence_urls) && source.access_evidence_urls.length > 0, `Tier A requires access evidence: ${source.source_id}`);
    source.access_evidence_urls.forEach(publicUrl);
    assert.ok(yieldStatuses.has(source.yield_status), `Unknown yield status: ${source.source_id}`);
    assert.ok(Number.isSafeInteger(source.reviewed_candidates) && source.reviewed_candidates >= 0);
    assert.ok(Number.isSafeInteger(source.accepted_relevant_hits) && source.accepted_relevant_hits >= 0);
    assert.ok(source.accepted_relevant_hits <= source.reviewed_candidates);
    const expectedPrecision = source.reviewed_candidates === 0
      ? null
      : source.accepted_relevant_hits / source.reviewed_candidates;
    assert.equal(source.measured_precision, expectedPrecision, `Precision mismatch: ${source.source_id}`);
  }
  if (source.tier === "DISABLED") assert.equal(source.action, "DISABLED");
  if (source.runtime_eligible) {
    assert.equal(source.tier, "A", `Only Tier A may become runtime eligible: ${source.source_id}`);
    assert.ok(source.positive_evidence_urls.length >= qualification.runtime_policy.minimum_positive_examples);
    assert.equal(source.access_status, qualification.runtime_policy.required_access_status);
    assert.equal(source.yield_status, qualification.runtime_policy.required_yield_status);
    assert.ok(source.measured_precision >= qualification.runtime_policy.minimum_precision);
    assert.ok(source.reviewed_candidates >= qualification.runtime_policy.minimum_reviewed_candidates);
    assert.ok(source.accepted_relevant_hits >= 0);
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
  deep_research_sources: deepResearchWatchlist.sources.length,
  deep_research_watchlist_urls: deepResearchWatchlist.sources.reduce((n, source) => n + source.watchlist_urls.length, 0),
  deep_research_query_shards: deepResearchQueries.queries.length,
  deep_research_aliases: deepResearchAliases.aliases.length,
  runtime_eligible_sources: runtimeEligible.length,
  enabled_crawlers: 0, network_requests: 0, openai_requests: 0
}, null, 2));
