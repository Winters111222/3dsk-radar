import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = async (name) => JSON.parse(await readFile(new URL(`../config/${name}`, import.meta.url), "utf8"));
const [watchlist, queries, aliases, catalog] = await Promise.all([
  read("deep-research-watchlist.v1.json"),
  read("deep-research-query-shards.v1.json"),
  read("deep-research-source-aliases.v1.json"),
  read("opportunity-sources.v1.json")
]);

test("deep-research import is complete, unique and default-off", () => {
  assert.equal(watchlist.sources.length, 50);
  assert.equal(queries.queries.length, 52);
  assert.equal(aliases.aliases.length, 19);
  assert.equal(watchlist.sources.every((source) => source.enabled === false), true);
  assert.equal(queries.queries.every((query) => query.enabled === false), true);
  assert.equal(queries.scheduled_runs_enabled, false);
  assert.equal(queries.automatic_paid_execution_enabled, false);
  assert.equal(new Set(watchlist.sources.map((source) => source.id)).size, 50);
  assert.equal(new Set(watchlist.sources.flatMap((source) => source.watchlist_urls)).size, 71);
  assert.equal(new Set(queries.queries.map((query) => query.query_id)).size, 52);
});

test("MI-only research cannot masquerade as buyer demand", () => {
  const miOnly = watchlist.sources.filter((source) => source.activation_state === "MI_ONLY");
  assert.ok(miOnly.length > 0);
  assert.equal(miOnly.every((source) => source.buyer_only === false), true);
});

test("CZ/SK grant sources are funding leads, not enabled procurement feeds", () => {
  const grantIds = new Set(["mk_grant_results", "fpu_sk_heritage_grants", "mk_sr_heritage_grants", "eea_sk_culture_grants"]);
  const grants = watchlist.sources.filter((source) => grantIds.has(source.id));
  assert.equal(grants.length, 4);
  assert.equal(grants.every((source) => source.source_type === "GRANT_PORTAL"), true);
  assert.equal(grants.every((source) => source.activation_state === "NATIVE_PILOT_TOS_REVIEW"), true);
  assert.equal(grants.every((source) => source.enabled === false && source.buyer_only === false), true);
  const grantQueries = queries.queries.filter((query) => /^(?:cs|sk)_grant_/.test(query.query_id));
  assert.equal(grantQueries.length, 4);
  assert.equal(grantQueries.every((query) => grantIds.has(query.source_id) && query.enabled === false), true);
});

test("alias map prevents duplicate connectors for already catalogued sources", () => {
  const researchIds = new Set(watchlist.sources.map((source) => source.id));
  const canonicalIds = new Set(catalog.sources.map((source) => source.id));
  for (const alias of aliases.aliases) {
    assert.ok(researchIds.has(alias.research_source_id));
    assert.ok(canonicalIds.has(alias.canonical_source_id));
  }
  assert.equal(aliases.aliases.some((alias) => alias.research_source_id === "ted" && alias.canonical_source_id === "ted_eu"), true);
  assert.equal(aliases.aliases.some((alias) => alias.research_source_id === "upwork" && alias.canonical_source_id === "upwork"), true);
});
