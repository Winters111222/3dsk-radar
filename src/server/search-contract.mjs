import { COMMERCIAL_ROLES, NOTICE_STATUSES, SCOPE_FITS, STUDIO_ELIGIBILITY_VALUES } from "../lib/source-truth.mjs";
import { INDEX_DISCOVERY_ALLOWED_DOMAINS, INDEX_DISCOVERY_MODE, indexDiscoveryPolicySummary } from "./index-discovery.mjs";

export const SEARCH_INTENTS = [
  "game studio seeking external character art vendor RFP",
  "looking for human scan cleanup outsourcing partner",
  "character production request for proposal contract",
  "studio external development supplier applications characters",
  "human photogrammetry outsourcing",
  "R3DS Wrap contract",
  "Wrap3D production outsourcing",
  "digital human vendor game development",
  "digital double outsourcing",
  "realistic character outsourcing game studio",
  "AAA character outsourcing vendor",
  "character art external development",
  "facial scan processing contract",
  "FACS character outsourcing",
  "human scan cleanup contract",
  "basemesh conforming character",
  "photogrammetry production partner",
  "character production overflow",
  "realistic NPC outsourcing",
  "actor likeness character production",
  "photogrammetry vendor game development",
  "facial capture vendor games",
  "character co-development partner"
];

export const OPPORTUNITY_CATEGORIES = [
  "FULL_PIPELINE",
  "CAPTURE",
  "PHOTOGRAMMETRY_PROCESSING",
  "SCAN_CLEANUP",
  "WRAP_BASEMESH",
  "FACIAL_FACS",
  "CHARACTER_FINISHING",
  "CHARACTER_OUTSOURCING",
  "EXTERNAL_DEVELOPMENT",
  "PRODUCTION_OVERFLOW",
  "PIPELINE_CONSULTING",
  "OTHER_RELEVANT"
];

export const REMOTE_SCOPES = [
  "WORLDWIDE_VENDOR",
  "GLOBAL_REMOTE",
  "REMOTE_REGION",
  "LOCATION_RESTRICTED",
  "ONSITE",
  "NOT_STATED"
];

const EXCLUDED_SEARCH_CAPABILITY_IDS = new Set(["visual_ai_motion"]);

const nullableString = { type: ["string", "null"] };
const nullableNumber = { type: ["number", "null"] };

function evidenceSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["type", "url", "note"],
    properties: {
      type: { enum: ["PRIMARY_SOURCE", "SECONDARY_SOURCE", "CONTACT_SOURCE", "SIGNAL_SOURCE"] },
      url: { type: "string" },
      note: { type: "string" }
    }
  };
}

function candidateSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: [
      "title", "company", "summary", "opportunity_kind", "categories", "location", "remote_scope",
      "commercial_role", "notice_status", "studio_eligibility", "eligibility_reason", "scope_fit",
      "published_date", "source_updated_date", "acceptance_source_url", "source_url", "apply_url", "fit_score", "win_score", "budget_type",
      "budget_published", "budget_estimated_min", "budget_estimated_max", "budget_currency",
      "budget_confidence", "budget_reason", "budget_basis", "budget_source_url", "contact_name", "contact_role", "contact_email",
      "contact_email_source", "why_it_fits", "risks", "missing_requirements", "source_evidence"
    ],
    properties: {
      title: { type: "string", minLength: 1 },
      company: { type: "string", minLength: 1 },
      summary: { type: "string", minLength: 1 },
      opportunity_kind: { enum: ["OPEN_OPPORTUNITY", "POTENTIAL_LEAD"] },
      commercial_role: { enum: COMMERCIAL_ROLES },
      notice_status: { enum: NOTICE_STATUSES },
      studio_eligibility: { enum: STUDIO_ELIGIBILITY_VALUES },
      eligibility_reason: { type: "string" },
      scope_fit: { enum: SCOPE_FITS },
      categories: {
        type: "array",
        minItems: 1,
        maxItems: 6,
        items: { enum: OPPORTUNITY_CATEGORIES }
      },
      location: { type: "string" },
      remote_scope: { enum: REMOTE_SCOPES },
      published_date: nullableString,
      source_updated_date: nullableString,
      acceptance_source_url: nullableString,
      source_url: { type: "string" },
      apply_url: nullableString,
      fit_score: { type: "integer", minimum: 0, maximum: 100 },
      win_score: { type: "integer", minimum: 0, maximum: 100 },
      budget_type: { enum: ["PUBLISHED", "ESTIMATED", "UNKNOWN"] },
      budget_published: nullableString,
      budget_estimated_min: nullableNumber,
      budget_estimated_max: nullableNumber,
      budget_currency: nullableString,
      budget_confidence: { type: ["string", "null"], enum: ["high", "medium", "low", null] },
      budget_reason: { type: "string" },
      budget_basis: { enum: ["BUYER_PROJECT", "SELLER_PRICE", "EMPLOYEE_COMPENSATION", "UNKNOWN"] },
      budget_source_url: nullableString,
      contact_name: nullableString,
      contact_role: nullableString,
      contact_email: nullableString,
      contact_email_source: nullableString,
      why_it_fits: { type: "array", maxItems: 8, items: { type: "string" } },
      risks: { type: "array", maxItems: 8, items: { type: "string" } },
      missing_requirements: { type: "array", maxItems: 8, items: { type: "string" } },
      source_evidence: { type: "array", minItems: 1, maxItems: 8, items: evidenceSchema() }
    }
  };
}

export function buildSearchOutputSchema(maxResults = 12) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["opportunities"],
    properties: {
      opportunities: {
        type: "array",
        maxItems: Math.max(1, Math.min(20, maxResults)),
        items: candidateSchema()
      }
    }
  };
}

export function buildSearchInstructions({ profile, nowIso, maxResults = 12, retry = false }) {
  const publicCapabilities = profile.capabilities.filter((item) =>
    item.status === "APPROVED" && item.outbound_safe && !EXCLUDED_SEARCH_CAPABILITY_IDS.has(item.id));
  const publicCredentials = profile.credentials.filter((item) => item.status === "PUBLIC_APPROVED" && item.outbound_safe);

  return [
    "You are the discovery and scoring engine for the internal 3D.SK Opportunity Radar.",
    `Current server timestamp: ${nowIso}.`,
    `Return at most ${maxResults} normalized opportunities.`,
    `Discovery mode: ${INDEX_DISCOVERY_MODE}.`,
    "You MUST use web search. Prefer original primary sources over aggregators.",
    `Search only these allowlisted opportunity sources and paths: ${indexDiscoveryPolicySummary()}.`,
    "Return only an exact public opportunity/detail URL matching one of those paths. Never return a home page, profile, category, tag, feed or search-results page.",
    "Do not sign in, use cookies or sessions, automate a browser, solve access controls, or claim that hosted discovery grants API, crawling or content-reuse permission.",
    "Every returned item requires a person to open the original source and verify that it is still active before any contact or response generation.",
    "Prioritize explicit current B2B/vendor/outsourcing/contract/freelance opportunities worldwide, especially the last 24h, then 7 days, then 30 days.",
    "Search buyer-side demand first: studios seeking vendors, RFPs, supplier applications and production overflow requests. Generic supplier catalogs and service pages are not buyer demand. Include a supplier as POTENTIAL_LEAD only with a concrete public partnership or subcontracting signal; capability overlap alone is insufficient. Return fewer results or an empty list when evidence is weak.",
    "Do not treat a normal employee job as a studio/vendor opportunity unless the source explicitly permits contract/vendor/external development. If relevant only as a business signal, classify it POTENTIAL_LEAD.",
    "OPEN_OPPORTUNITY means an explicit public request, contract, vendor need, RFP, outsourcing request or external-development opportunity. POTENTIAL_LEAD means only a commercial signal with no explicit public request. Never blur them.",
    "Classify commercial_role as BUYER, EMPLOYER, SELLER, PARTNER or UNKNOWN from the direction of the public evidence. SELLER offers must not be returned as opportunities.",
    "Classify notice_status as OPEN, UPCOMING, CLOSED, AWARDED, CANCELLED or UNKNOWN from the current original source. URL parameters and search-engine crawl dates never override the visible current status.",
    "studio_eligibility is YES only when the brief supports a Czech/European external studio or vendor. A country-only, onsite-only or individual-employment restriction is NO or UNKNOWN, never assumed YES.",
    "scope_fit is CORE or CHARACTER_ADJACENT only for relevant human/character production. Equipment purchases, GIS/BIM/site scanning and unrelated visual production are OUT_OF_SCOPE or EQUIPMENT.",
    "3D.sk is a studio/vendor, not one freelance artist. Match the requested work against the approved capability profile below.",
    "Do not search for or return Photoshop-only work, generative-AI visual production, motion-design/After Effects work, medical animation or immersive-museum production. Character rigging or animation may remain only when it is part of a relevant human/character production scope.",
    "Never invent a contact email. Only output contact_email when the exact address is publicly visible in a web source you actually consulted; contact_email_source must be that public URL. Otherwise both fields must be null.",
    "Budget provenance is strict: PUBLISHED only for source-stated terms, ESTIMATED only when you can justify a conservative range from public scope context, UNKNOWN when evidence is insufficient. Prefer UNKNOWN over false precision.",
    "Budget means money the prospective buyer can spend on the relevant outsourced production scope. Set budget_basis BUYER_PROJECT only for that scope and budget_source_url to the consulted source establishing it. A seller's product price, marketplace annual license, subscription, rate card, revenue, funding, or individual employee salary is NOT the buyer's outsourcing budget: classify SELLER_PRICE, EMPLOYEE_COMPENSATION or UNKNOWN and set budget_type UNKNOWN with all amount fields null. For estimates the source must establish a concrete buyer project scope; capability overlap is not enough.",
    "Do not invent client names, project names, credentials, capacity, prices, deadlines, legal guarantees or proprietary systems.",
    "WIN SCORE is a heuristic opportunity attractiveness/competitiveness score, never a probability of winning.",
    "Use source_evidence to record the URLs that support the opportunity. source_url must be the best primary/original source you consulted.",
    "Open and inspect each original source before including a result. Do not rely only on snippets or a returned URL. If the page is unavailable, unrelated or no longer supports the claim, omit the result. Label aggregators SECONDARY_SOURCE; they are not the original employer's procurement page.",
    "Freshness is mandatory: provide a real published_date or source_updated_date. If both are missing or older than 30 days, set acceptance_source_url only when an original source you opened currently and explicitly proves the opportunity is still accepting. Otherwise omit it.",
    retry ? "This is the single allowed structured retry. Be especially strict about the required JSON schema and source provenance." : "",
    `Approved public-safe capabilities: ${JSON.stringify(publicCapabilities)}`,
    `PUBLIC_APPROVED credentials only: ${JSON.stringify(publicCredentials)}`,
    `Restricted claims: ${JSON.stringify(profile.restricted_claims)}`,
    `Scoring weights: ${JSON.stringify(profile.scoring_weights)}`,
    `Search intents to cover broadly, not as literal-only filters: ${JSON.stringify(SEARCH_INTENTS)}`
  ].filter(Boolean).join("\n\n");
}

export function buildOpenAIRequest({
  profile,
  nowIso,
  maxResults = 12,
  model = "gpt-5.6-luna",
  retry = false,
  maxToolCalls = 3,
  maxOutputTokens = 8000
}) {
  return {
    model,
    store: false,
    reasoning: { effort: "low" },
    tools: [{
      type: "web_search",
      search_context_size: "medium",
      filters: { allowed_domains:[...INDEX_DISCOVERY_ALLOWED_DOMAINS] }
    }],
    tool_choice: "required",
    max_tool_calls: Math.max(1, Math.min(3, Number(maxToolCalls) || 3)),
    include: ["web_search_call.action.sources"],
    instructions: buildSearchInstructions({ profile, nowIso, maxResults, retry }),
    input: "Search the current public web now and return only the structured Radar opportunity dataset. Do not add prose outside the schema.",
    max_output_tokens: Math.max(2000, Math.min(8000, Number(maxOutputTokens) || 8000)),
    text: {
      verbosity: "low",
      format: {
        type: "json_schema",
        name: "radar_search_results",
        strict: true,
        schema: buildSearchOutputSchema(maxResults)
      }
    }
  };
}
