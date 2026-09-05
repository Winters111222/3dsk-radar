import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildOpenAIRequest, buildSearchOutputSchema, OPPORTUNITY_CATEGORIES, SEARCH_INTENTS } from "../src/server/search-contract.mjs";

const profile = JSON.parse(await readFile(new URL("../config/company-profile.public.json", import.meta.url), "utf8"));

test("search contract uses current Responses web search + strict schema and cost-sensitive default", () => {
  const body = buildOpenAIRequest({ profile, nowIso:"2026-09-05T10:00:00.000Z", maxResults:12 });
  assert.equal(body.model, "gpt-5.6-luna");
  assert.deepEqual(body.tools, [{ type:"web_search", search_context_size:"medium" }]);
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
  for (const field of ["commercial_role","notice_status","studio_eligibility","eligibility_reason","scope_fit","source_updated_date","acceptance_source_url"]) {
    assert.ok(candidate.required.includes(field), field);
  }
  assert.ok(body.instructions.includes("Freshness is mandatory"));
});

test("search schema clamps result count and covers required opportunity kinds", () => {
  assert.equal(buildSearchOutputSchema(99).properties.opportunities.maxItems, 20);
  const kindEnum = buildSearchOutputSchema(5).properties.opportunities.items.properties.opportunity_kind.enum;
  assert.deepEqual(kindEnum, ["OPEN_OPPORTUNITY", "POTENTIAL_LEAD"]);
  assert.ok(SEARCH_INTENTS.includes("character production overflow"));
  assert.ok(SEARCH_INTENTS.includes("facial scan processing contract"));
});

test("instructions expose no credentials unless explicitly PUBLIC_APPROVED", () => {
  const unsafeProfile = structuredClone(profile);
  unsafeProfile.credentials.push({ id:"private", label:"Secret Project", status:"PRIVATE", outbound_safe:true });
  const body = buildOpenAIRequest({ profile:unsafeProfile, nowIso:"2026-09-05T10:00:00.000Z" });
  assert.equal(body.instructions.includes("Secret Project"), false);
});
