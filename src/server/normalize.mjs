import { createHash } from "node:crypto";
import { bandForScore, validateOpportunity } from "../lib/domain.mjs";
import { COMMERCIAL_ROLES, NOTICE_STATUSES, SCOPE_FITS, STUDIO_ELIGIBILITY_VALUES, evaluateSourceTruth, normalizeSourceDate } from "../lib/source-truth.mjs";
import { OPPORTUNITY_CATEGORIES, REMOTE_SCOPES } from "./search-contract.mjs";
import {
  INDEX_DISCOVERY_SOURCE_POLICIES,
  indexDiscoveryDomainPolicyForUrl,
  indexDiscoveryMetadata,
  indexDiscoveryPolicyForUrl
} from "./index-discovery.mjs";

const TRACKING_PARAMS = new Set([
  "fbclid", "gclid", "mc_cid", "mc_eid", "ref", "referrer", "source"
]);

function isTrackingParam(key) {
  const lower = key.toLowerCase();
  return lower.startsWith("utm_") || TRACKING_PARAMS.has(lower);
}

export function normalizeUrl(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    if (url.username || url.password) return null;
    url.hash = "";
    url.hostname = url.hostname.toLowerCase();
    if ((url.protocol === "https:" && url.port === "443") || (url.protocol === "http:" && url.port === "80")) url.port = "";
    for (const key of [...url.searchParams.keys()]) {
      if (isTrackingParam(key)) url.searchParams.delete(key);
    }
    url.searchParams.sort();
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString();
  } catch {
    return null;
  }
}

function collectUrlsDeep(value, set) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item) => collectUrlsDeep(item, set));
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (key === "url" && typeof child === "string") {
      const normalized = normalizeUrl(child);
      if (normalized) set.add(normalized);
    } else {
      collectUrlsDeep(child, set);
    }
  }
}

export function extractWebSourceUrls(response) {
  const urls = new Set();
  for (const item of response?.output || []) {
    if (item?.type === "web_search_call") collectUrlsDeep(item, urls);
  }
  return urls;
}

export function extractOutputText(response) {
  if (typeof response?.output_text === "string" && response.output_text.trim()) return response.output_text.trim();
  const chunks = [];
  for (const item of response?.output || []) {
    if (item?.type !== "message") continue;
    for (const content of item.content || []) {
      if (content?.type === "output_text" && typeof content.text === "string") chunks.push(content.text);
    }
  }
  return chunks.join("\n").trim();
}

export function parseStructuredSearchResponse(response) {
  const text = extractOutputText(response);
  if (!text) throw new Error("OpenAI response contained no structured output text");
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("OpenAI structured output was not valid JSON");
  }
  if (!parsed || !Array.isArray(parsed.opportunities)) throw new Error("OpenAI structured output is missing opportunities[]");
  return parsed;
}

function safeString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function safeList(value, max = 8) {
  return Array.isArray(value)
    ? value.filter((item) => typeof item === "string" && item.trim()).slice(0, max).map((item) => item.trim())
    : [];
}

function safeScore(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(100, Math.round(number)));
}

export function normalizeBudget(candidate, verifiedSourceUrls = new Set()) {
  const claimedType = ["PUBLISHED", "ESTIMATED", "UNKNOWN"].includes(candidate.budget_type) ? candidate.budget_type : "UNKNOWN";
  const source = normalizeUrl(candidate.budget_source_url);
  const buyerBudget = candidate.budget_basis === "BUYER_PROJECT" && source && verifiedSourceUrls.has(source);
  const type = buyerBudget ? claimedType : "UNKNOWN";
  const reason = !buyerBudget && claimedType !== "UNKNOWN"
    ? "No verified buyer project budget. Seller prices, product licenses and employee compensation are not an outsourcing budget."
    : safeString(candidate.budget_reason) || "Insufficient validated public commercial data.";
  if (type === "PUBLISHED") {
    const published = safeString(candidate.budget_published);
    if (published) {
      return {
        budget_type: "PUBLISHED",
        budget_basis: "BUYER_PROJECT",
        budget_source_url: source,
        budget_published: published,
        budget_estimated_min: null,
        budget_estimated_max: null,
        budget_currency: safeString(candidate.budget_currency),
        budget_confidence: safeString(candidate.budget_confidence),
        budget_reason: reason
      };
    }
  }
  if (type === "ESTIMATED") {
    const min = candidate.budget_estimated_min;
    const max = candidate.budget_estimated_max;
    if (Number.isFinite(min) && Number.isFinite(max) && min >= 0 && max >= min && safeString(candidate.budget_currency)) {
      return {
        budget_type: "ESTIMATED",
        budget_basis: "BUYER_PROJECT",
        budget_source_url: source,
        budget_published: null,
        budget_estimated_min: min,
        budget_estimated_max: max,
        budget_currency: safeString(candidate.budget_currency),
        budget_confidence: ["high", "medium", "low"].includes(candidate.budget_confidence) ? candidate.budget_confidence : "low",
        budget_reason: reason
      };
    }
  }
  return {
    budget_type: "UNKNOWN",
    budget_basis: "UNKNOWN",
    budget_source_url: null,
    budget_published: null,
    budget_estimated_min: null,
    budget_estimated_max: null,
    budget_currency: null,
    budget_confidence: null,
    budget_reason: type === "UNKNOWN" ? reason : "Budget evidence failed provenance validation; treated as UNKNOWN."
  };
}

function isValidEmail(value) {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function fingerprint(value) {
  return String(value || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim();
}

function stableId(sourceUrl, company, title) {
  return `radar-${createHash("sha256").update(`${sourceUrl}|${fingerprint(company)}|${fingerprint(title)}`).digest("hex").slice(0, 16)}`;
}

const DIAGNOSTIC_REJECTION_CODES = new Set([
  "unverified_source_url",
  "source_not_allowed_for_index_discovery",
  "missing_core_identity",
  "invalid_opportunity_kind",
  "seller_not_opportunity",
  "unknown_commercial_role",
  "inactive_notice",
  "studio_ineligible",
  "out_of_scope",
  "stale_or_unverified",
  "excluded_search_category"
]);

function diagnosticRejectionCode(value) {
  const code = String(value || "");
  if (DIAGNOSTIC_REJECTION_CODES.has(code)) return code;
  if (code.startsWith("normalized_contract:")) return "normalized_contract";
  return "other_validation_failure";
}

function countBy(items, keyForItem) {
  const counts = new Map();
  for (const item of items) {
    const key = keyForItem(item);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

function sourceIdForCandidate(candidate) {
  const sourceUrl = normalizeUrl(candidate?.source_url);
  return indexDiscoveryDomainPolicyForUrl(sourceUrl)?.id || "unattributed";
}

function buildIndexDiscoveryDiagnostics({ verifiedSourceUrls, outcomes, accepted, returned }) {
  const consultedBySource = countBy(verifiedSourceUrls, (url) => indexDiscoveryDomainPolicyForUrl(url)?.id || "unattributed");
  const detailBySource = countBy(
    [...verifiedSourceUrls].filter((url) => indexDiscoveryPolicyForUrl(url)),
    (url) => indexDiscoveryPolicyForUrl(url)?.id || "unattributed"
  );
  const seenBySource = countBy(outcomes, (item) => item.source_id);
  const acceptedBySource = countBy(accepted, (item) => item.discovery_source_id || "unattributed");
  const returnedBySource = countBy(returned, (item) => item.discovery_source_id || "unattributed");
  const rejectedBySource = countBy(outcomes.filter((item) => item.rejection), (item) => item.source_id);
  const rejectionReasons = countBy(outcomes.filter((item) => item.rejection), (item) => item.rejection);
  const sourceIds = [
    ...INDEX_DISCOVERY_SOURCE_POLICIES.map((policy) => policy.id),
    ...(seenBySource.has("unattributed") || consultedBySource.has("unattributed") ? ["unattributed"] : [])
  ];
  const labels = new Map(INDEX_DISCOVERY_SOURCE_POLICIES.map((policy) => [policy.id, policy.label]));

  return {
    schema_version:1,
    privacy:"AGGREGATED_COUNTS_ONLY",
    zero_result_reason:returned.length
      ? null
      : outcomes.length === 0
        ? "NO_STRUCTURED_CANDIDATES"
        : accepted.length === 0
          ? "ALL_CANDIDATES_REJECTED"
          : "ALL_ACCEPTED_CANDIDATES_DEDUPLICATED",
    rejection_reasons:Object.fromEntries([...rejectionReasons.entries()].sort(([a], [b]) => a.localeCompare(b))),
    source_yield:sourceIds.map((sourceId) => {
      const acceptedCount = acceptedBySource.get(sourceId) || 0;
      const returnedCount = returnedBySource.get(sourceId) || 0;
      return {
        source_id:sourceId,
        source_label:labels.get(sourceId) || "Unattributed",
        consulted_urls:consultedBySource.get(sourceId) || 0,
        eligible_detail_urls:detailBySource.get(sourceId) || 0,
        candidates_seen:seenBySource.get(sourceId) || 0,
        candidates_accepted:acceptedCount,
        candidates_rejected:rejectedBySource.get(sourceId) || 0,
        duplicates_removed:Math.max(0, acceptedCount - returnedCount),
        returned:returnedCount
      };
    })
  };
}

export function normalizeCandidate(candidate, verifiedSourceUrls, nowIso, { indexDiscovery = false } = {}) {
  const usableSourceUrls = indexDiscovery
    ? new Set([...verifiedSourceUrls].filter((url) => indexDiscoveryDomainPolicyForUrl(url)))
    : verifiedSourceUrls;
  const sourceUrl = normalizeUrl(candidate?.source_url);
  if (!sourceUrl) return { opportunity: null, rejection: "unverified_source_url" };
  const discoveryMetadata = indexDiscovery ? indexDiscoveryMetadata(sourceUrl) : null;
  if (indexDiscovery && !discoveryMetadata) return { opportunity:null, rejection:"source_not_allowed_for_index_discovery" };
  if (!usableSourceUrls.has(sourceUrl)) return { opportunity: null, rejection: "unverified_source_url" };

  const title = safeString(candidate.title);
  const company = safeString(candidate.company);
  const summary = safeString(candidate.summary);
  if (!title || !company || !summary) return { opportunity: null, rejection: "missing_core_identity" };

  const requestedKind = candidate.opportunity_kind === "OPEN_OPPORTUNITY" ? "OPEN_OPPORTUNITY"
    : candidate.opportunity_kind === "POTENTIAL_LEAD" ? "POTENTIAL_LEAD" : null;
  if (!requestedKind) return { opportunity: null, rejection: "invalid_opportunity_kind" };

  const commercialRole = COMMERCIAL_ROLES.includes(candidate.commercial_role) ? candidate.commercial_role : "UNKNOWN";
  const noticeStatus = NOTICE_STATUSES.includes(candidate.notice_status) ? candidate.notice_status : "UNKNOWN";
  const studioEligibility = STUDIO_ELIGIBILITY_VALUES.includes(candidate.studio_eligibility) ? candidate.studio_eligibility : "UNKNOWN";
  const scopeFit = SCOPE_FITS.includes(candidate.scope_fit) ? candidate.scope_fit : "OUT_OF_SCOPE";
  const publishedDate = normalizeSourceDate(candidate.published_date, nowIso);
  const sourceUpdatedDate = normalizeSourceDate(candidate.source_updated_date, nowIso);
  const acceptanceSourceUrl = normalizeUrl(candidate.acceptance_source_url);
  const acceptanceEvidenceRecorded = (Array.isArray(candidate.source_evidence) ? candidate.source_evidence : []).some((item) =>
    normalizeUrl(item?.url) === acceptanceSourceUrl && Boolean(safeString(item?.note)));
  const acceptanceVerified = noticeStatus === "OPEN" && Boolean(acceptanceSourceUrl && usableSourceUrls.has(acceptanceSourceUrl) && acceptanceEvidenceRecorded);
  const truth = evaluateSourceTruth({
    requestedKind,
    commercialRole,
    noticeStatus,
    studioEligibility,
    scopeFit,
    publishedDate,
    sourceUpdatedDate,
    acceptanceVerified,
    nowIso
  });
  if (!truth.ok) return { opportunity:null, rejection:truth.rejection };
  const opportunityKind = truth.opportunityKind;

  const rawCategories = Array.isArray(candidate.categories) ? candidate.categories : [];
  const categories = [...new Set(rawCategories
    .filter((item) => OPPORTUNITY_CATEGORIES.includes(item)))].slice(0, 6);
  if (!categories.length && rawCategories.includes("VISUAL_AI_MOTION")) {
    return { opportunity: null, rejection: "excluded_search_category" };
  }
  if (!categories.length) categories.push("OTHER_RELEVANT");

  const fitScore = safeScore(candidate.fit_score);
  const winScore = safeScore(candidate.win_score);
  const budget = normalizeBudget(candidate, usableSourceUrls);

  let contactEmail = isValidEmail(candidate.contact_email) ? candidate.contact_email.trim() : null;
  let contactEmailSource = normalizeUrl(candidate.contact_email_source);
  if (!contactEmailSource || !usableSourceUrls.has(contactEmailSource)) {
    contactEmail = null;
    contactEmailSource = null;
  }

  let applyUrl = normalizeUrl(candidate.apply_url);
  if (!applyUrl || !usableSourceUrls.has(applyUrl)) applyUrl = sourceUrl;
  if (indexDiscovery && !indexDiscoveryMetadata(applyUrl)) applyUrl = sourceUrl;

  const evidence = (Array.isArray(candidate.source_evidence) ? candidate.source_evidence : []).map((item) => {
    const url = normalizeUrl(item?.url);
    if (!url || !usableSourceUrls.has(url)) return null;
    return {
      type: ["PRIMARY_SOURCE", "SECONDARY_SOURCE", "CONTACT_SOURCE", "SIGNAL_SOURCE"].includes(item.type)
        ? item.type
        : opportunityKind === "OPEN_OPPORTUNITY" ? "PRIMARY_SOURCE" : "SIGNAL_SOURCE",
      url,
      note: safeString(item.note) || "Verified source returned by hosted web search."
    };
  }).filter(Boolean);

  if (!evidence.some((item) => item.url === sourceUrl)) {
    evidence.unshift({
      type: opportunityKind === "OPEN_OPPORTUNITY" ? "PRIMARY_SOURCE" : "SIGNAL_SOURCE",
      url: sourceUrl,
      note: "Primary source URL verified against hosted web-search sources."
    });
  }

  if (budget.budget_source_url && !evidence.some(item => item.url === budget.budget_source_url)) {
    evidence.unshift({ type: "SIGNAL_SOURCE", url: budget.budget_source_url, note: "Buyer project budget or scope source returned by hosted web search." });
  }

  const sourceDomain = new URL(sourceUrl).hostname.replace(/^www\./, "");
  const opportunity = {
    id: stableId(sourceUrl, company, title),
    is_fixture: false,
    canonical_url: sourceUrl,
    source_url: sourceUrl,
    source_domain: sourceDomain,
    title,
    company,
    summary,
    opportunity_kind: opportunityKind,
    commercial_role: commercialRole,
    notice_status: noticeStatus,
    studio_eligibility: studioEligibility,
    eligibility_reason: safeString(candidate.eligibility_reason) || "Studio eligibility was not established by the source.",
    scope_fit: scopeFit,
    categories,
    location: safeString(candidate.location) || "Not stated",
    remote_scope: REMOTE_SCOPES.includes(candidate.remote_scope) ? candidate.remote_scope : "NOT_STATED",
    published_date: publishedDate,
    source_updated_date: sourceUpdatedDate,
    freshness_basis: truth.freshnessBasis,
    acceptance_source_url: acceptanceVerified ? acceptanceSourceUrl : null,
    acceptance_verified_at: acceptanceVerified ? nowIso : null,
    first_seen: nowIso,
    last_seen: nowIso,
    is_new: true,
    status: "NEW",
    fit_score: fitScore,
    win_score: winScore,
    win_band: bandForScore(winScore),
    ...budget,
    contact_name: safeString(candidate.contact_name),
    contact_role: safeString(candidate.contact_role),
    contact_email: contactEmail,
    contact_email_source: contactEmailSource,
    apply_url: applyUrl,
    why_it_fits: safeList(candidate.why_it_fits),
    risks: safeList(candidate.risks),
    missing_requirements: safeList(candidate.missing_requirements),
    source_evidence: evidence.slice(0, 8),
    ...(discoveryMetadata || {})
  };

  const validation = validateOpportunity(opportunity);
  return validation.ok
    ? { opportunity, rejection: null }
    : { opportunity: null, rejection: `normalized_contract:${validation.errors.join(",")}` };
}

export function dedupeOpportunities(items) {
  const byUrl = new Map();
  for (const item of items) {
    const current = byUrl.get(item.canonical_url);
    if (!current || item.win_score > current.win_score) byUrl.set(item.canonical_url, item);
  }

  const byFingerprint = new Map();
  for (const item of byUrl.values()) {
    const key = `${fingerprint(item.company)}|${fingerprint(item.title)}|${item.source_domain}`;
    const current = byFingerprint.get(key);
    if (!current || item.win_score > current.win_score) byFingerprint.set(key, item);
  }

  return [...byFingerprint.values()].sort((a, b) => b.win_score - a.win_score || b.fit_score - a.fit_score);
}

export function normalizeSearchResponse(response, { nowIso, maxResults = 12, indexDiscovery = false } = {}) {
  const extractedSourceUrls = extractWebSourceUrls(response);
  const verifiedSourceUrls = indexDiscovery
    ? new Set([...extractedSourceUrls].filter((url) => indexDiscoveryDomainPolicyForUrl(url)))
    : extractedSourceUrls;
  if (!verifiedSourceUrls.size) throw new Error("Hosted web search returned no verifiable source URLs");

  const parsed = parseStructuredSearchResponse(response);
  const opportunities = [];
  const rejections = [];
  const outcomes = [];
  const candidates = parsed.opportunities.slice(0, Math.max(1, Math.min(20, maxResults)));
  for (const candidate of candidates) {
    const normalized = normalizeCandidate(candidate, verifiedSourceUrls, nowIso, { indexDiscovery });
    if (normalized.opportunity) {
      opportunities.push(normalized.opportunity);
      outcomes.push({ source_id:normalized.opportunity.discovery_source_id || sourceIdForCandidate(candidate), rejection:null });
    } else {
      const rejection = diagnosticRejectionCode(normalized.rejection);
      rejections.push(rejection);
      outcomes.push({ source_id:sourceIdForCandidate(candidate), rejection });
    }
  }

  const deduped = dedupeOpportunities(opportunities);
  const rejection_reasons = Object.fromEntries([...new Set(rejections)].sort().map((reason) => [reason, rejections.filter((item) => item === reason).length]));
  return {
    opportunities: deduped,
    rejections,
    verified_source_count: verifiedSourceUrls.size,
    ...(indexDiscovery ? { diagnostics:buildIndexDiscoveryDiagnostics({ verifiedSourceUrls, outcomes, accepted:opportunities, returned:deduped }) } : {}),
    counters: {
      candidates_seen: candidates.length,
      candidates_verified: deduped.length,
      candidates_rejected: rejections.length,
      duplicates_removed: opportunities.length - deduped.length,
      rejection_reasons
    }
  };
}
