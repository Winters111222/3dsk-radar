import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildOpenAIRequest, buildSearchOutputSchema, OPPORTUNITY_CATEGORIES, SEARCH_INTENTS } from "../src/server/search-contract.mjs";
import { FOCUSED_INDEX_DISCOVERY_ALLOWED_DOMAINS } from "../src/server/index-discovery.mjs";

const profile = JSON.parse(await readFile(new URL("../config/company-profile.public.json", import.meta.url), "utf8"));

test("search contract uses current Responses web search + strict schema and cost-sensitive default", () => {
  const body = buildOpenAIRequest({ profile, nowIso:"2026-09-05T10:00:00.000Z", maxResults:12 });
  assert.equal(body.model, "gpt-5.6-luna");
  assert.deepEqual(body.tools, [{
    type:"web_search",
    search_context_size:"medium",
    filters:{ allowed_domains:[...FOCUSED_INDEX_DISCOVERY_ALLOWED_DOMAINS] }
  }]);
  assert.equal(body.max_tool_calls, 3);
  assert.equal(body.max_output_tokens, 8000);
  assert.equal(body.tool_choice, "required");
  assert.equal(body.store, false);
  assert.equal(body.reasoning.effort, "low");
  assert.equal(body.text.format.type, "json_schema");
  assert.equal(body.text.format.strict, true);
  assert.equal(body.text.format.schema.properties.opportunities.maxItems, 12);
  assert.ok(body.instructions.includes("OPEN_OPPORTUNITY"));
  assert.ok(body.instructions.includes("POTENTIAL_LEAD"));
  assert.ok(body.instructions.includes("Never invent a contact email"));
  assert.ok(body.instructions.includes("Do not search for or return Photoshop-only work"));
  assert.equal(body.instructions.includes("High-end Photoshop and generative-AI visual workflows; motion/After Effects as a secondary lane"), false);
  assert.equal(OPPORTUNITY_CATEGORIES.includes("VISUAL_AI_MOTION"), false);
  assert.equal(body.text.format.schema.properties.opportunities.items.properties.categories.items.enum.includes("VISUAL_AI_MOTION"), false);
  const candidate = body.text.format.schema.properties.opportunities.items;
  for (const field of ["commercial_role","notice_status","engagement_track","studio_eligibility","eligibility_reason","individual_eligibility","individual_eligibility_reason","scope_fit","source_updated_date","acceptance_source_url"]) {
    assert.ok(candidate.required.includes(field), field);
  }
  assert.ok(body.instructions.includes("Freshness is mandatory"));
  assert.ok(body.instructions.includes("INDEX_DISCOVERY_MANUAL_VERIFY"));
  assert.ok(body.instructions.includes("requires a person to open the original source"));
  assert.ok(body.instructions.includes("Do not sign in, use cookies or sessions"));
  assert.ok(body.instructions.includes("RealityCapture, ZBrush, Substance Painter and Faceform Wrap3D"));
  assert.ok(body.instructions.includes("Hard exclusions: omit every Reallusion"));
  assert.ok(body.instructions.includes("Search two distinct engagement tracks"));
  assert.ok(body.instructions.includes("INDIVIDUAL_FREELANCE requires an explicit buyer-posted freelance/project route"));
  assert.ok(body.instructions.includes("physical scanning of museum objects"));
  assert.ok(body.instructions.includes("LOW confidence"));
  for (const category of ["HUMAN_DATA_CAPTURE", "CULTURAL_HERITAGE_3D", "HERITAGE_POSTPROCESSING", "HERITAGE_FUNDING_PARTNERSHIP"]) {
    assert.ok(OPPORTUNITY_CATEGORIES.includes(category));
  }
  assert.ok(body.instructions.includes("Never call a grant OPEN_OPPORTUNITY"));
  assert.ok(body.instructions.includes("funding, or individual employee salary is NOT the buyer's outsourcing budget"));
});

test("search schema clamps result count and covers required opportunity kinds", () => {
  assert.equal(buildSearchOutputSchema(99).properties.opportunities.maxItems, 20);
  const kindEnum = buildSearchOutputSchema(5).properties.opportunities.items.properties.opportunity_kind.enum;
  assert.deepEqual(kindEnum, ["OPEN_OPPORTUNITY", "POTENTIAL_LEAD"]);
  assert.ok(SEARCH_INTENTS.includes("character production overflow"));
  assert.ok(SEARCH_INTENTS.includes("facial scan processing contract"));
  assert.ok(SEARCH_INTENTS.includes("single human scan mesh repair"));
  assert.ok(SEARCH_INTENTS.includes("AI human dataset photogrammetry capture vendor"));
  assert.ok(SEARCH_INTENTS.includes("3D digitalizace sbírkových předmětů veřejná zakázka"));
  assert.ok(SEARCH_INTENTS.includes("3D digitalizácia zbierkových predmetov verejné obstarávanie"));
  assert.ok(SEARCH_INTENTS.includes("aktivní grant 3D digitalizace kulturních statků Česko"));
  assert.ok(SEARCH_INTENTS.includes("otvorená výzva múzeá digitalizácia 3D Slovensko"));
});

test("instructions expose no credentials unless explicitly PUBLIC_APPROVED", () => {
  const unsafeProfile = structuredClone(profile);
  unsafeProfile.credentials.push({ id:"private", label:"Secret Project", status:"PRIVATE", outbound_safe:true });
  const body = buildOpenAIRequest({ profile:unsafeProfile, nowIso:"2026-09-05T10:00:00.000Z" });
  assert.equal(body.instructions.includes("Secret Project"), false);
});
