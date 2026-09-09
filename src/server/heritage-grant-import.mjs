import { createHash } from "node:crypto";

export const HERITAGE_GRANT_IMPORT_MAX_RECORDS = 50;

const SOURCE_RULES = Object.freeze({
  mk_cz_heritage_grants:{
    country:"Czech Republic",
    hosts:["mk.gov.cz", "www.mk.gov.cz"],
    paths:[
      /^\/digitalizace-kulturnich-statku-a-narodnich-kulturnich-pamatek-cs-2941\/?$/i,
      /^\/iniciativa-4-5-3-digitalizace-kks-[^/]+-cs-\d+\/?$/i,
      /^\/integrovany-system-ochrany-moviteho-kulturniho-dedictvi-cs-525\/?$/i
    ]
  },
  fpu_sk_heritage_grants:{
    country:"Slovakia",
    hosts:["fpu.sk", "www.fpu.sk"],
    paths:[/^\/sk\/vyzvy\/[^/]+\/?$/i]
  },
  mk_sr_heritage_grants:{
    country:"Slovakia",
    hosts:["culture.gov.sk", "www.culture.gov.sk"],
    paths:[/^\/sk\/dotacie-\d{4}(?:\/[^/]+)?\/?$/i]
  },
  eea_sk_culture_grants:{
    country:"Slovakia",
    hosts:["eeagrants.org", "www.eeagrants.org"],
    paths:[/^\/sk\/slovakia\/programmes\/culture-local-development\/(?:news|open-calls)\/[^/]+\/?$/i]
  }
});

const THREE_D = /(?:\b3d\b|3-d|trojrozm[eě]rn|trojrozmern|fotogrammetr|photogrammetr|3d\s*sken|3d\s*scan)/i;
const HERITAGE = /(?:muze|múze|gal[eé]ri|sb[ií]r|zbier|kulturn|kultúr|pam[aá]tk|pamiat|heritage|artefakt|předmět|predmet)/i;

function clean(value, max) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

function error(code) {
  return Object.assign(new Error(code), { code, status:400 });
}

function exactSourceUrl(value, rule) {
  try {
    const url = new URL(String(value || ""));
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) return null;
    if (!rule.hosts.includes(url.hostname.toLowerCase())) return null;
    if (!rule.paths.some((pattern) => pattern.test(url.pathname))) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function isoDate(value, code) {
  const parsed = Date.parse(String(value || ""));
  if (!Number.isFinite(parsed)) throw error(code);
  return new Date(parsed).toISOString().slice(0, 10);
}

function isOpen(deadline, nowIso) {
  return deadline >= new Date(nowIso).toISOString().slice(0, 10);
}

export function normalizeHeritageGrantRecord(record, { nowIso } = {}) {
  if (!Number.isFinite(Date.parse(nowIso))) throw error("HERITAGE_GRANT_NOW_INVALID");
  const sourceId = clean(record?.source_id, 80);
  const rule = SOURCE_RULES[sourceId];
  if (!rule) throw error("HERITAGE_GRANT_SOURCE_NOT_ALLOWED");
  const sourceUrl = exactSourceUrl(record?.source_url, rule);
  if (!sourceUrl) throw error("HERITAGE_GRANT_SOURCE_URL_INVALID");
  const title = clean(record?.title, 300);
  const institution = clean(record?.institution, 240);
  const summary = clean(record?.summary, 2000);
  const eligibilityEvidence = clean(record?.eligibility_evidence, 800);
  const participationRoute = clean(record?.participation_route, 40).toUpperCase();
  if (!title || !institution || !summary) throw error("HERITAGE_GRANT_IDENTITY_MISSING");
  if (!THREE_D.test(`${title} ${summary}`) || !HERITAGE.test(`${title} ${summary}`)) {
    throw error("HERITAGE_GRANT_SCOPE_NOT_EXPLICIT");
  }
  if (!["DIRECT", "INSTITUTION_PARTNER"].includes(participationRoute) || !eligibilityEvidence) {
    throw error("HERITAGE_GRANT_PARTICIPATION_UNPROVEN");
  }
  const publishedDate = isoDate(record?.published_date, "HERITAGE_GRANT_PUBLISHED_DATE_INVALID");
  const kind = clean(record?.grant_state, 30).toUpperCase();
  let deadline = null;
  let noticeStatus;
  if (kind === "OPEN_CALL") {
    deadline = isoDate(record?.deadline, "HERITAGE_GRANT_DEADLINE_INVALID");
    if (!isOpen(deadline, nowIso)) throw error("HERITAGE_GRANT_CALL_EXPIRED");
    noticeStatus = "OPEN";
  } else if (kind === "FUNDED_RECIPIENT") {
    noticeStatus = "AWARDED";
  } else {
    throw error("HERITAGE_GRANT_STATE_INVALID");
  }
  const identity = createHash("sha256").update(`${sourceId}:${sourceUrl}:${institution}:${title}`).digest("hex").slice(0, 24);
  const fundingSignal = noticeStatus === "OPEN"
    ? "Active grant call with explicit cultural-heritage 3D scope."
    : "Funded museum project with explicit cultural-heritage 3D scope.";
  return {
    import_id:`heritage-grant-${identity}`,
    source_id:sourceId,
    verified_source_url:sourceUrl,
    candidate:{
      title,
      company:institution,
      summary:`${fundingSignal} ${summary} Participation route: ${eligibilityEvidence}`,
      opportunity_kind:"POTENTIAL_LEAD",
      commercial_role:"PARTNER",
      notice_status:noticeStatus,
      engagement_track:"B2B_STUDIO",
      studio_eligibility:"YES",
      individual_eligibility:"UNKNOWN",
      individual_eligibility_reason:"Heritage funding and institutional partnership use the B2B track.",
      scope_fit:"CORE",
      categories:["CULTURAL_HERITAGE_3D", "CAPTURE", "HERITAGE_FUNDING_PARTNERSHIP"],
      location:rule.country,
      remote_scope:participationRoute === "DIRECT" ? "ONSITE_OR_REMOTE" : "PARTNER_REQUIRED",
      published_date:publishedDate,
      deadline,
      source_url:sourceUrl,
      apply_url:sourceUrl,
      acceptance_source_url:noticeStatus === "OPEN" ? sourceUrl : null,
      source_evidence:[{
        type:"SIGNAL_SOURCE",
        url:sourceUrl,
        note:noticeStatus === "OPEN"
          ? `Official open grant call; eligibility manually verified: ${eligibilityEvidence}`
          : `Official funded-recipient result; relevant 3D scope manually verified: ${eligibilityEvidence}`
      }],
      budget_type:"UNKNOWN",
      budget_published:null,
      budget_min:null,
      budget_max:null,
      budget_currency:null,
      budget_basis:"UNKNOWN",
      budget_reason:"Grant amount is funding evidence, not a buyer outsourcing budget.",
      fit_score:65,
      win_score:45,
      source_label:"OFFICIAL_HERITAGE_GRANT_MANUAL_VERIFY"
    }
  };
}

export function normalizeHeritageGrantBatch(records, options) {
  if (!Array.isArray(records) || records.length > HERITAGE_GRANT_IMPORT_MAX_RECORDS) {
    throw error("HERITAGE_GRANT_BATCH_INVALID");
  }
  return records.map((record) => normalizeHeritageGrantRecord(record, options));
}
