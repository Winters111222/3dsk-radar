import { createHash, randomUUID } from "node:crypto";
import { STATUS_VALUES } from "../lib/domain.mjs";

const LEGAL_SUFFIXES = /\b(incorporated|inc|limited|ltd|llc|plc|gmbh|sro|s\.r\.o|a\.s|corp|corporation)\b/gi;

export function normalizeCompanyName(value) {
  return String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/&/g, " and ").replace(LEGAL_SUFFIXES, " ").replace(/[^a-zA-Z0-9]+/g, " ").trim().toLowerCase().replace(/\s+/g, " ");
}
export function companyKey(company) { const normalized = normalizeCompanyName(company); if (!normalized) throw new TypeError("company is required"); return createHash("sha256").update(normalized).digest("hex").slice(0, 24); }
export function emptyCompanyState(company) { return { company_key:companyKey(company), company:String(company).trim(), bookmarked:false, bookmarked_at:null, last_contacted_at:null, contact_count:0, contact_history:[], updated_at:null }; }
export function setCompanyBookmark(current, bookmarked, nowIso) { return { ...current, bookmarked:Boolean(bookmarked), bookmarked_at:bookmarked ? (current.bookmarked_at || nowIso) : null, updated_at:nowIso }; }
export function markEmailSent(current, { opportunityId, recipient=null, subject=null, sourceUrl=null, sentAt }) { if (!sentAt) throw new TypeError("sentAt is required"); const event={ id:randomUUID(), opportunity_id:opportunityId||null, sent_at:sentAt, recipient:recipient||null, subject:subject||null, source_url:sourceUrl||null }; const history=[event,...(current.contact_history||[])].slice(0,100); return { ...current, last_contacted_at:sentAt, contact_count:history.length, contact_history:history, updated_at:sentAt }; }
export function undoLastEmailSent(current, nowIso) { const [, ...rest] = current.contact_history || []; return { ...current, contact_history:rest, contact_count:rest.length, last_contacted_at:rest[0]?.sent_at||null, updated_at:nowIso }; }
export function contactRecency(lastContactedAt, now=Date.now()) { if (!lastContactedAt) return { contacted:false, days:null, band:"NONE" }; const ts=new Date(lastContactedAt).getTime(); if (!Number.isFinite(ts)) return { contacted:false, days:null, band:"NONE" }; const days=Math.max(0,Math.floor((now-ts)/86400000)); return { contacted:true, days, band:days<=30?"RECENT":"PAST" }; }
export function applyOpportunityState(opportunity, savedStatus, companyState) { return { ...opportunity, status:STATUS_VALUES.includes(savedStatus)?savedStatus:opportunity.status, company_key:companyState.company_key, company_bookmarked:Boolean(companyState.bookmarked), company_last_contacted_at:companyState.last_contacted_at||null, company_contact_count:Number(companyState.contact_count||0) }; }
