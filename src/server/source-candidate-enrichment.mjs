import { normalizeCandidate, normalizeUrl } from "./normalize.mjs";
import { OPPORTUNITY_CATEGORIES } from "./search-contract.mjs";
import { CONTRACTS_FINDER_SOURCE_ID } from "./collectors/contracts-finder.mjs";
import { FIND_TENDER_SOURCE_ID } from "./collectors/find-tender.mjs";
import { TED_SOURCE_ID } from "./collectors/ted.mjs";

const CORE_TERMS = [
  "human photogrammetry", "human scan", "scan cleanup", "character outsourcing", "character production",
  "3d character", "digital human", "digital double", "facial action coding system", "facial scan",
  "basemesh", "wrap3d", "r3ds wrap", "realistic character"
];
const EXCLUDED_TERMS = [
  "aerial photogrammetry", "topographic survey", "gis mapping", "building information model", "scan to bim",
  "laser scanner equipment", "medical animation", "museum immersive", "motion design", "after effects"
];
const EQUIPMENT_TERMS = ["purchase of scanner", "supply of scanner", "scanner equipment", "camera equipment", "hardware supply"];
const INDIVIDUAL_ONLY_TERMS = [
  "individual consultant", "individual contractor", "candidate must be an individual", "employment contract",
  "full-time employee", "part-time employee", "salary range", "payroll"
];

function values(value) {
  if (value == null) return [];
  if (["string", "number", "boolean"].includes(typeof value)) return [String(value).trim()].filter(Boolean);
  if (Array.isArray(value)) return value.flatMap(values);
  if (typeof value === "object") {
    if (Object.hasOwn(value, "value")) return values(value.value);
    const preferred = [value.ENG, value.eng, value.EN, value.en].flatMap(values);
    return preferred.length ? preferred : Object.values(value).flatMap(values);
  }
  return [];
}

function first(value) {
  return values(value)[0] || null;
}

function dateOnly(value) {
  const match = first(value)?.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function cleanText(value, max = 4_000) {
  return values(value).join(" ").replace(/\s+/g, " ").trim().slice(0, max);
}

function allText(detail, raw) {
  // Query-pack matches are discovery hints, not promotion evidence. Promotion
  // therefore evaluates the first-party detail plus its visible record identity,
  // never the phrase that caused the list collector to return the record.
  return cleanText([detail.document, raw?.title], 80_000).toLowerCase();
}

function scopeFitFor(text) {
  const core = CORE_TERMS.some((term) => text.includes(term));
  if (EQUIPMENT_TERMS.some((term) => text.includes(term)) && !core) return "EQUIPMENT";
  if (EXCLUDED_TERMS.some((term) => text.includes(term)) && !core) return "OUT_OF_SCOPE";
  if (core) return "CORE";
  if (/\b(character|facial|zbrush|retopolog|texture|3d art)\b/.test(text)) return "CHARACTER_ADJACENT";
  return "OUT_OF_SCOPE";
}

function categoryList(raw, text) {
  const categories = new Set((Array.isArray(raw?.suggested_categories) ? raw.suggested_categories : []).filter((item) => OPPORTUNITY_CATEGORIES.includes(item)));
  if (text.includes("photogrammetry")) categories.add("PHOTOGRAMMETRY_PROCESSING");
  if (text.includes("scan cleanup")) categories.add("SCAN_CLEANUP");
  if (text.includes("basemesh") || text.includes("wrap3d") || text.includes("r3ds wrap")) categories.add("WRAP_BASEMESH");
  if (text.includes("facial") || text.includes("facs")) categories.add("FACIAL_FACS");
  if (text.includes("character outsourcing") || text.includes("character production")) categories.add("CHARACTER_OUTSOURCING");
  return [...categories].slice(0, 6);
}

function email(value) {
  return values(value).map((item) => item.toLowerCase()).find((item) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item)) || null;
}

function latestRelease(releases) {
  return [...(Array.isArray(releases) ? releases : [])].sort((a, b) => String(b?.date || "").localeCompare(String(a?.date || "")))[0] || null;
}

function releaseHas(releases, pattern) {
  return (Array.isArray(releases) ? releases : []).some((release) => values([release?.tag, release?.tender?.status]).some((item) => pattern.test(item)));
}

function ocdsFacts(detail, raw, nowIso) {
  const release = detail.document || latestRelease(detail.releases) || {};
  const tender = release.tender || {};
  const buyers = [release.buyer?.name, ...(Array.isArray(release.parties) ? release.parties.filter((party) => party?.roles?.includes("buyer")).map((party) => party?.name) : [])].map(first).filter(Boolean);
  const buyerParty = (Array.isArray(release.parties) ? release.parties : []).find((party) => party?.roles?.includes("buyer"));
  const deadline = dateOnly(tender?.tenderPeriod?.endDate);
  const today = dateOnly(nowIso);
  const status = String(tender.status || "").toLowerCase();
  let noticeStatus = "UNKNOWN";
  if (releaseHas(detail.releases, /cancel|withdraw/i) || /cancel|withdraw/.test(status)) noticeStatus = "CANCELLED";
  else if (releaseHas(detail.releases, /award|contract/i) && status !== "active") noticeStatus = "AWARDED";
  else if (status === "active") noticeStatus = !deadline || deadline >= today ? "OPEN" : "CLOSED";
  else if (["planned", "planning"].includes(status)) noticeStatus = "UPCOMING";
  else if (["complete", "closed", "unsuccessful"].includes(status)) noticeStatus = "CLOSED";
  const contactEmail = email([release.buyer?.contactPoint?.email, buyerParty?.contactPoint?.email]);
  const location = first([release.buyer?.address?.countryName, buyerParty?.address?.countryName, raw.buyer_countries]) || "Not stated";
  const summary = cleanText([tender.description, release.description, ...(Array.isArray(tender.lots) ? tender.lots.map((lot) => lot?.description) : [])]);
  return { release, tender, buyers:[...new Set(buyers)], deadline, noticeStatus, contactEmail, location, summary };
}

function tedFacts(detail, raw, nowIso) {
  const notice = detail.document || {};
  const deadline = dateOnly(notice["deadline-receipt-tender-date-lot"] || notice.deadline);
  const today = dateOnly(nowIso);
  const form = cleanText([notice["form-type"], notice["notice-type"]]).toLowerCase();
  let noticeStatus = "UNKNOWN";
  if (values(notice["competition-termination-proc"]).length || /cancel|withdraw|termination/.test(form)) noticeStatus = "CANCELLED";
  else if (/result|award/.test(form)) noticeStatus = "AWARDED";
  else if (deadline) noticeStatus = deadline >= today ? "OPEN" : "CLOSED";
  const buyers = [...new Set(values(notice["buyer-name"]))];
  return {
    notice,
    buyers,
    deadline,
    noticeStatus,
    contactEmail:email([notice["buyer-email"], notice["buyer-touchpoint-email"]]),
    location:first(notice["buyer-country"] || raw.buyer_countries) || "Not stated",
    summary:cleanText([notice["description-proc"], notice["description-lot"], raw.summary])
  };
}

function serviceContract(detail, raw) {
  const text = allText(detail, raw);
  return /\b(service|services|consulting|production|outsourc)/.test(text) && !/\b(goods only|supplies only)\b/.test(text);
}

function individualOnlyContract(detail, raw) {
  const text = allText(detail, raw);
  return INDIVIDUAL_ONLY_TERMS.some((term) => text.includes(term));
}

function budgetCandidate(detail, facts, sourceUrl) {
  if (detail.source_id === TED_SOURCE_ID) {
    const amounts = values([facts.notice["estimated-value-lot"], facts.notice["estimated-value-proc"]]).map(Number).filter((item) => Number.isFinite(item) && item >= 0);
    const currencies = values([facts.notice["estimated-value-cur-lot"], facts.notice["estimated-value-cur-proc"]]).filter((item) => /^[A-Z]{3}$/.test(item));
    if (amounts.length === 1 && currencies.length === 1) return { budget_type:"PUBLISHED", budget_basis:"BUYER_PROJECT", budget_source_url:sourceUrl, budget_published:`${currencies[0]} ${amounts[0].toLocaleString("en-US")} published procurement estimate`, budget_currency:currencies[0], budget_reason:"Single published procurement estimate in the official TED notice." };
    return {};
  }
  const value = facts.tender?.value;
  const amount = Number(value?.amount);
  const currency = String(value?.currency || "");
  const lots = Array.isArray(facts.tender?.lots) ? facts.tender.lots : [];
  const framework = Boolean(facts.tender?.techniques?.hasFrameworkAgreement);
  if (Number.isFinite(amount) && amount >= 0 && /^[A-Z]{3}$/.test(currency) && lots.length <= 1 && !framework) {
    return { budget_type:"PUBLISHED", budget_basis:"BUYER_PROJECT", budget_source_url:sourceUrl, budget_published:`${currency} ${amount.toLocaleString("en-US")} published procurement value`, budget_currency:currency, budget_reason:"Single-scope tender value in the official OCDS record." };
  }
  return {};
}

function scores(scopeFit, noticeStatus, studioEligibility, contactEmail, budgetType, publishedDate, nowIso) {
  const fit = scopeFit === "CORE" ? 90 : scopeFit === "CHARACTER_ADJACENT" ? 68 : 0;
  let win = Math.round(fit * 0.5);
  if (noticeStatus === "OPEN") win += 20;
  if (studioEligibility === "YES") win += 15;
  if (contactEmail) win += 5;
  if (budgetType === "PUBLISHED") win += 5;
  const age = (Date.parse(nowIso) - Date.parse(`${publishedDate || "1970-01-01"}T00:00:00Z`)) / 86_400_000;
  if (age >= 0 && age <= 7) win += 5;
  return { fit_score:Math.min(100, fit), win_score:Math.min(100, win) };
}

export function enrichSourceCandidate(candidate, detail, { nowIso } = {}) {
  const raw = candidate?.primary_record || {};
  const expectedIdentity = raw.source_id === TED_SOURCE_ID
    ? (raw.publication_number || raw.source_item_id)
    : raw.tender_identity;
  if (!nowIso || !detail || detail.source_id !== raw.source_id || !expectedIdentity || detail.source_identity !== expectedIdentity) {
    return { opportunity:null, rejection:"detail_contract_mismatch", enrichment:null };
  }
  const sourceUrl = normalizeUrl(raw.canonical_url);
  if (!sourceUrl) return { opportunity:null, rejection:"detail_source_url_invalid", enrichment:null };
  const facts = detail.source_id === TED_SOURCE_ID ? tedFacts(detail, raw, nowIso) : ocdsFacts(detail, raw, nowIso);
  const text = allText(detail, raw);
  const scopeFit = scopeFitFor(text);
  const categories = categoryList(raw, text);
  const company = facts.buyers[0] || null;
  if (!company) return { opportunity:null, rejection:"detail_buyer_missing", enrichment:{ source_id:detail.source_id, source_identity:detail.source_identity, fetched_at:detail.fetched_at } };
  const studioEligibility = scopeFit === "OUT_OF_SCOPE" || scopeFit === "EQUIPMENT" || individualOnlyContract(detail, raw)
    ? "NO"
    : (facts.noticeStatus === "OPEN" && serviceContract(detail, raw) ? "YES" : "UNKNOWN");
  const budget = budgetCandidate(detail, facts, sourceUrl);
  const publishedDate = dateOnly(raw.publication_date || (detail.source_id === TED_SOURCE_ID ? facts.notice?.["publication-date"] : facts.release?.date));
  const sourceUpdatedDate = dateOnly(raw.source_updated_date || facts.release?.date);
  const score = scores(scopeFit, facts.noticeStatus, studioEligibility, facts.contactEmail, budget.budget_type, publishedDate || sourceUpdatedDate, nowIso);
  const normalizedInput = {
    title:first(detail.source_id === TED_SOURCE_ID ? facts.notice?.["notice-title"] : facts.tender?.title) || raw.title,
    company,
    summary:facts.summary || raw.summary || raw.title,
    opportunity_kind:facts.noticeStatus === "OPEN" ? "OPEN_OPPORTUNITY" : "POTENTIAL_LEAD",
    commercial_role:"BUYER",
    notice_status:facts.noticeStatus,
    studio_eligibility:studioEligibility,
    eligibility_reason:studioEligibility === "YES" ? "Official public services procurement with no individual-employment signal; qualification requirements still require manual review." : "Studio eligibility was not proven by the official detail record.",
    scope_fit:scopeFit,
    categories,
    location:facts.location,
    remote_scope:"NOT_STATED",
    published_date:publishedDate,
    source_updated_date:sourceUpdatedDate,
    acceptance_source_url:facts.noticeStatus === "OPEN" ? sourceUrl : null,
    source_url:sourceUrl,
    apply_url:sourceUrl,
    ...score,
    budget_type:budget.budget_type || "UNKNOWN",
    budget_basis:budget.budget_basis || "UNKNOWN",
    budget_source_url:budget.budget_source_url || null,
    budget_published:budget.budget_published || null,
    budget_estimated_min:null,
    budget_estimated_max:null,
    budget_currency:budget.budget_currency || null,
    budget_confidence:null,
    budget_reason:budget.budget_reason || "No unambiguous single-scope buyer budget was proven by the official detail record.",
    contact_name:null,
    contact_role:null,
    contact_email:facts.contactEmail,
    contact_email_source:facts.contactEmail ? sourceUrl : null,
    why_it_fits:scopeFit === "CORE" ? ["Official buyer detail contains a direct human/character production signal."] : ["Official buyer detail contains a character-adjacent production signal."],
    risks:[studioEligibility === "YES" ? "Tender qualification and geographic eligibility still require manual review before contact." : "Studio eligibility is not proven."],
    missing_requirements:[facts.deadline ? `Response deadline: ${facts.deadline}.` : "A current response deadline was not proven."],
    source_evidence:[{ type:"PRIMARY_SOURCE", url:sourceUrl, note:`Official ${detail.source_id} detail fetched at ${detail.fetched_at}; identity ${detail.source_identity}.` }]
  };
  const normalized = normalizeCandidate(normalizedInput, new Set([sourceUrl]), nowIso);
  return {
    ...normalized,
    enrichment:{
      schema_version:1,
      source_id:detail.source_id,
      source_identity:detail.source_identity,
      fetched_at:detail.fetched_at,
      source_url:sourceUrl,
      notice_status:facts.noticeStatus,
      commercial_role:"BUYER",
      studio_eligibility:studioEligibility,
      scope_fit:scopeFit,
      categories,
      deadline:facts.deadline,
      buyer_names:facts.buyers,
      contact_email_provenance:facts.contactEmail ? sourceUrl : null,
      budget_provenance:budget.budget_type || "UNKNOWN"
    }
  };
}

export const IMPLEMENTED_DETAIL_SOURCES = Object.freeze([TED_SOURCE_ID, FIND_TENDER_SOURCE_ID, CONTRACTS_FINDER_SOURCE_ID]);
