export const RECORD_KINDS = Object.freeze([
  "SALES_OPPORTUNITY",
  "COMPETITOR",
  "SOURCE_PLATFORM"
]);

const SOURCE_PLATFORM_DOMAINS = new Set([
  "outscal.com"
]);

const SOURCE_PLATFORM_IDENTITIES = Object.freeze([
  { domains:["greenhouse.io"], names:["greenhouse"] },
  { domains:["lever.co"], names:["lever"] },
  { domains:["ashbyhq.com"], names:["ashby"] },
  { domains:["smartrecruiters.com"], names:["smartrecruiters", "smart recruiters"] },
  { domains:["workable.com"], names:["workable"] },
  { domains:["teamtailor.com"], names:["teamtailor", "team tailor"] },
  { domains:["recruitee.com"], names:["recruitee"] },
  { domains:["upwork.com"], names:["upwork"] },
  { domains:["freelancer.com"], names:["freelancer"] },
  { domains:["peopleperhour.com"], names:["peopleperhour", "people per hour"] },
  { domains:["guru.com"], names:["guru"] }
]);

const PLATFORM_TEXT_PATTERNS = [
  /\bjob (?:board|aggregator|index|platform)\b/i,
  /\b(?:ats|applicant tracking) (?:harvester|platform|dataset|index)\b/i,
  /\bjobs? dataset\b/i,
  /\baggregates? (?:jobs?|vacancies|openings)\b/i,
  /\barchived? jobs? platform\b/i
];

const SERVICE_PATH_PATTERNS = [
  /\/(?:services?|solutions?|capabilities|portfolio|pricing)(?:\/|$)/i,
  /\/(?:what-we-do|our-work)(?:\/|$)/i
];

const SELLER_TEXT_PATTERNS = [
  /\b(?:we|our (?:studio|team|company)) (?:offer|provide|deliver|speciali[sz]e)\b/i,
  /\b(?:company|studio|agency|team) (?:offers?|provides?|delivers?|speciali[sz]es?)\b/i,
  /\b(?:outsourcing|external development|co-development) studio\b/i,
  /\b(?:our services|service portfolio|request (?:a )?quote|contact us for (?:a )?quote)\b/i,
  /\b(?:vendor|supplier) of (?:3d|game art|character|photogrammetry|digital human)/i
];

const CONCRETE_BUYER_PATTERNS = [
  /\b(?:seek(?:s|ing)?|looking for|need(?:s|ed)?|wanted) (?:an? |additional )?(?:external )?(?:vendor|supplier|partner|subcontractor|studio|team|capacity|support)\b/i,
  /\brequest for (?:proposal|quotation|information)\b/i,
  /\b(?:rfp|rfq|rfi)\b/i,
  /\b(?:vendor|supplier) (?:application|registration|onboarding|submission)s?\b/i,
  /\b(?:subcontracting|subcontractor|production overflow|overflow capacity|overflow support)\b/i,
  /\bapply (?:to become|as) (?:a |our )?(?:vendor|supplier|production partner)\b/i,
  /\b(?:procurement|tender|contract notice)\b/i
];

function normalizedText(value) {
  return String(value || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim();
}

function hostname(value) {
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function domainMatches(host, domain) {
  return host === domain || host.endsWith(`.${domain}`);
}

function matchesAny(patterns, text) {
  return patterns.some((pattern) => pattern.test(text));
}

function sourcePlatformIdentity(candidate, host, company) {
  if ([...SOURCE_PLATFORM_DOMAINS].some((domain) => domainMatches(host, domain))) return true;
  return SOURCE_PLATFORM_IDENTITIES.some((identity) =>
    identity.domains.some((domain) => domainMatches(host, domain))
      && identity.names.some((name) => company === normalizedText(name)));
}

export function recordKindOf(record) {
  return RECORD_KINDS.includes(record?.record_kind) ? record.record_kind : "SALES_OPPORTUNITY";
}

export function isSalesOpportunityRecord(record) {
  return recordKindOf(record) === "SALES_OPPORTUNITY";
}

export function salesActionAllowed(record) {
  return isSalesOpportunityRecord(record);
}

export function classifyRecordCandidate(candidate) {
  const sourceHost = hostname(candidate?.source_url || candidate?.canonical_url);
  const company = normalizedText(candidate?.company);
  const combined = [candidate?.title, candidate?.summary, candidate?.eligibility_reason]
    .map((value) => String(value || ""))
    .join(" \n ");
  const sourcePath = (() => {
    try { return new URL(candidate?.source_url || candidate?.canonical_url).pathname; }
    catch { return ""; }
  })();
  const concreteBuyerSignal = matchesAny(CONCRETE_BUYER_PATTERNS, combined);
  const platformSignal = matchesAny(PLATFORM_TEXT_PATTERNS, combined);
  const servicePageSignal = matchesAny(SERVICE_PATH_PATTERNS, sourcePath);
  const sellerSignal = matchesAny(SELLER_TEXT_PATTERNS, combined);
  const role = String(candidate?.commercial_role || "UNKNOWN").toUpperCase();

  if (sourcePlatformIdentity(candidate, sourceHost, company) || (platformSignal && !concreteBuyerSignal)) {
    return {
      record_kind:"SOURCE_PLATFORM",
      reason:sourcePlatformIdentity(candidate, sourceHost, company)
        ? "SOURCE_PLATFORM_IDENTITY"
        : "SOURCE_PLATFORM_DESCRIPTION",
      effective_commercial_role:"UNKNOWN",
      concrete_buyer_signal:false
    };
  }

  if (concreteBuyerSignal && ["SELLER", "PARTNER"].includes(role)) {
    return {
      record_kind:"SALES_OPPORTUNITY",
      reason:"CONCRETE_SUBCONTRACT_OR_VENDOR_SIGNAL",
      effective_commercial_role:"PARTNER",
      concrete_buyer_signal:true
    };
  }

  if (role === "PARTNER" && !concreteBuyerSignal) {
    return {
      record_kind:null,
      rejection:"partner_without_buyer_signal",
      reason:"PARTNER_WITHOUT_CURRENT_BUYER_SIGNAL",
      effective_commercial_role:"PARTNER",
      concrete_buyer_signal:false
    };
  }

  if (role === "SELLER" || ((servicePageSignal || sellerSignal) && !concreteBuyerSignal)) {
    return {
      record_kind:"COMPETITOR",
      reason:role === "SELLER" ? "SELLER_CAPABILITY_PAGE" : "GENERIC_SERVICE_OR_PORTFOLIO_PAGE",
      effective_commercial_role:"SELLER",
      concrete_buyer_signal:false
    };
  }

  return {
    record_kind:"SALES_OPPORTUNITY",
    reason:"BUYER_OR_EMPLOYER_SIGNAL",
    effective_commercial_role:role,
    concrete_buyer_signal:concreteBuyerSignal
  };
}

export function reclassifyStoredRecord(record, nowIso) {
  const classification = classifyRecordCandidate(record);
  if (!classification.record_kind) {
    return { record:{ ...record, record_kind:recordKindOf(record) }, changed:false, classification };
  }
  const previousKind = recordKindOf(record);
  if (previousKind === classification.record_kind
    && record.record_kind === classification.record_kind
    && record.record_kind_reason === classification.reason) {
    return { record:{ ...record }, changed:false, classification };
  }
  const history = Array.isArray(record.classification_history) ? [...record.classification_history] : [];
  if (previousKind !== classification.record_kind) {
    history.push({
      changed_at:nowIso,
      from_record_kind:previousKind,
      to_record_kind:classification.record_kind,
      previous_opportunity_kind:record.opportunity_kind ?? null,
      reason:classification.reason
    });
  }
  return {
    record:{
      ...record,
      record_kind:classification.record_kind,
      opportunity_kind:classification.record_kind === "SALES_OPPORTUNITY" ? record.opportunity_kind : null,
      commercial_role:classification.effective_commercial_role,
      record_kind_reason:classification.reason,
      classified_at:nowIso,
      classification_history:history
    },
    changed:true,
    classification
  };
}
