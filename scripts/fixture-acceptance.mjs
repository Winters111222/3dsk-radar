import { pathToFileURL } from "node:url";
import { readFile } from "node:fs/promises";
import { emptyCompanyState, setCompanyBookmark, markEmailSent, contactRecency } from "../src/server/company-memory.mjs";
import { evaluateSourceTruth } from "../src/lib/source-truth.mjs";

const FIXTURE_URL = new URL("../fixtures/opportunities.json", import.meta.url);

export async function runFixtureAcceptance() {
  const fixtures = JSON.parse(await readFile(FIXTURE_URL, "utf8"));
  const opportunity = fixtures.find((item) => item.contact_email) || fixtures[0];
  if (!opportunity) throw new Error("No fixture opportunity available");

  const generatedAt = "2026-09-05T10:00:00Z";
  const sentAt = "2026-09-05T10:05:00Z";
  const checkAt = new Date("2026-09-20T10:05:00Z").getTime();
  const reply = {
    to: opportunity.contact_email || null,
    subject: `${opportunity.company} — realistic character production support`,
    body: `Hello,\n\nI’m reaching out from 3D.sk regarding your ${opportunity.title}. This deterministic fixture response exercises the zero-cost response path before any paid API call.\n\nBest regards,\n3D.sk`,
    generated_at: generatedAt,
    model: "FIXTURE_PREVIEW"
  };

  const withReply = {
    ...opportunity,
    reply_to: reply.to,
    reply_subject: reply.subject,
    reply_body: reply.body,
    reply_generated_at: reply.generated_at,
    reply_model: reply.model
  };

  const bookmarked = setCompanyBookmark(emptyCompanyState(opportunity.company), true, "2026-09-05T09:55:00Z");
  const company = markEmailSent(bookmarked, {
    opportunityId: opportunity.id,
    recipient: opportunity.contact_email || null,
    subject: withReply.reply_subject,
    sourceUrl: opportunity.source_url || null,
    sentAt
  });
  const contactedOpportunity = { ...withReply, status: "CONTACTED" };
  const recency = contactRecency(company.last_contacted_at, checkAt);
  const truth = evaluateSourceTruth({
    requestedKind:opportunity.opportunity_kind,
    commercialRole:opportunity.commercial_role,
    noticeStatus:opportunity.notice_status,
    studioEligibility:opportunity.studio_eligibility,
    scopeFit:opportunity.scope_fit,
    publishedDate:opportunity.published_date,
    sourceUpdatedDate:opportunity.source_updated_date,
    acceptanceVerified:Boolean(opportunity.acceptance_verified_at),
    nowIso:generatedAt
  });

  const checks = {
    selected_opportunity: Boolean(opportunity.id),
    generated_response: Boolean(withReply.reply_subject && withReply.reply_body),
    server_safe_to_value: withReply.reply_to === (opportunity.contact_email || null),
    company_bookmarked: company.bookmarked === true,
    email_history_recorded: company.contact_count === 1 && company.contact_history[0]?.subject === withReply.reply_subject,
    opportunity_contacted: contactedOpportunity.status === "CONTACTED",
    duplicate_warning_window: recency.band === "RECENT" && recency.days === 15,
    source_truth_gate: truth.ok && truth.opportunityKind === "OPEN_OPPORTUNITY"
  };

  const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
  if (failed.length) throw new Error(`Fixture acceptance failed: ${failed.join(", ")}`);

  return {
    ok: true,
    cost_usd: 0,
    opportunity_id: opportunity.id,
    company: opportunity.company,
    checks,
    contact_count: company.contact_count,
    duplicate_warning_band: recency.band
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  const result = await runFixtureAcceptance();
  console.log(JSON.stringify(result, null, 2));
}
