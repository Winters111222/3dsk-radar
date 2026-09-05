export function approvedProfile(profile) {
  return {
    company: profile.company,
    capabilities: (profile.capabilities || []).filter((item) => item.status === "APPROVED" && item.outbound_safe),
    credentials: (profile.credentials || []).filter((item) => item.status === "PUBLIC_APPROVED" && item.outbound_safe && item.verification_url),
    restricted_claims: profile.restricted_claims || [],
    reply_rules: profile.reply_rules || {}
  };
}

export function buildReplyOutputSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["subject", "body", "used_capability_ids", "used_credential_ids"],
    properties: {
      subject: { type: "string", minLength: 3, maxLength: 160 },
      body: { type: "string", minLength: 80, maxLength: 4000 },
      used_capability_ids: { type: "array", maxItems: 10, items: { type: "string" } },
      used_credential_ids: { type: "array", maxItems: 10, items: { type: "string" } }
    }
  };
}

export function buildReplyInstructions({ profile, opportunity, retry = false }) {
  const safe = approvedProfile(profile);
  const opportunityFacts = {
    title: opportunity.title,
    company: opportunity.company,
    summary: opportunity.summary,
    opportunity_kind: opportunity.opportunity_kind,
    categories: opportunity.categories,
    location: opportunity.location,
    remote_scope: opportunity.remote_scope,
    published_date: opportunity.published_date,
    why_it_fits: opportunity.why_it_fits,
    risks: opportunity.risks,
    missing_requirements: opportunity.missing_requirements,
    contact_name: opportunity.contact_name,
    contact_role: opportunity.contact_role,
    source_url: opportunity.source_url,
    source_evidence: opportunity.source_evidence
  };
  return [
    "You write the first-touch sales email for 3D.sk in response to one specific public opportunity.",
    "Write in English unless the opportunity clearly requires another language.",
    "The body should normally be 120–220 words, professional, concise and specific to the actual request.",
    "Show that 3D.sk read the scope. Mention only capabilities that materially match this opportunity.",
    "Use only capabilities and credentials in the approved lists below. Never invent a client, shipped title, project, capacity, price, deadline, legal guarantee, proprietary rigging system or availability promise.",
    "Do not quote or invent a price. Do not promise delivery timing. Do not claim current team availability.",
    "If contact_name is missing, do not invent a person's name. Use a neutral greeting.",
    "Prefer a concrete CTA: short call, review sample data, small test batch, pipeline requirements, or scope for quotation.",
    "Do not generate TO. The server owns the recipient from verified public contact data.",
    "Return only the strict structured object. used_capability_ids and used_credential_ids must exactly identify approved items actually relied on in the body.",
    retry ? "This is the single allowed structured retry. Fix schema/approval violations and stay conservative." : "",
    `Approved company profile: ${JSON.stringify(safe)}`,
    `Opportunity facts: ${JSON.stringify(opportunityFacts)}`
  ].filter(Boolean).join("\n\n");
}

export function buildReplyRequest({ profile, opportunity, model = "gpt-5.6-sol", retry = false }) {
  return {
    model,
    store: false,
    reasoning: { effort: "medium" },
    instructions: buildReplyInstructions({ profile, opportunity, retry }),
    input: "Create the personalized first-touch response now.",
    max_output_tokens: 1800,
    text: {
      verbosity: "low",
      format: { type: "json_schema", name: "radar_sales_reply", strict: true, schema: buildReplyOutputSchema() }
    }
  };
}
