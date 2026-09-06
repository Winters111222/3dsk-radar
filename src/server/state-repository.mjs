import { companyKey, emptyCompanyState, setCompanyBookmark, markEmailSent, undoLastEmailSent } from "./company-memory.mjs";
import { mergeOpportunityHistory, opportunityFingerprint } from "./history.mjs";
import { normalizeBudget, normalizeUrl } from "./normalize.mjs";
import { isSalesOpportunityRecord, recordKindOf } from "./record-classification.mjs";
import { createHash } from "node:crypto";

const OP_PREFIX = "opportunities/";
const OP_SNAPSHOT_KEY = "metadata/opportunities-v1";
const COMPANY_PREFIX = "companies/";
const SOURCE_RUN_PREFIX = "source-runs/";
const SOURCE_RUN_REQUEST_PREFIX = "source-run-requests/";

function safeStateId(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{8,80}$/.test(value)) throw new Error("STATE_ID_INVALID");
  return value;
}

function sourceRunKey(runId, suffix) {
  return `${SOURCE_RUN_PREFIX}${safeStateId(runId)}/${suffix}`;
}

function dedupeIndexKey(runId, value) {
  const digest = createHash("sha256").update(String(value)).digest("hex");
  return sourceRunKey(runId, `candidate-index/${digest}`);
}

// Apply the same guard to previously saved results and reply inputs. Old records
// without buyer-budget evidence fail closed; reads do not rewrite stored history.
function safeSavedOpportunity(item) {
  if (!item) return item;
  const sources = new Set((item.source_evidence || []).map(x => normalizeUrl(x.url)).filter(Boolean));
  const safe = { ...item, record_kind:recordKindOf(item), ...normalizeBudget(item, sources) };
  if (isSalesOpportunityRecord(safe)) return { ...safe, outreach_locked:false };
  return {
    ...safe,
    contact_name:null,
    contact_role:null,
    contact_email:null,
    contact_email_source:null,
    reply_to:null,
    reply_subject:null,
    reply_body:null,
    reply_generated_at:null,
    reply_model:null,
    reply_response_id:null,
    outreach_locked:true
  };
}

function nonSalesActionError() {
  const error = new Error("Sales actions are locked for competitor and source-platform records.");
  error.code = "RECORD_NOT_SALES_OPPORTUNITY";
  error.status = 409;
  return error;
}

async function listJSON(store, prefix) {
  const result = await store.list({ prefix, directories:true });
  return Promise.all((result.blobs || []).map(({ key }) => {
    const fullKey = String(key || "").startsWith(prefix) ? key : `${prefix}${key}`;
    return store.get(fullKey, { type: "json" });
  }));
}

async function readOpportunitySnapshot(store) {
  const value = await store.get(OP_SNAPSHOT_KEY, { type:"json" });
  return Array.isArray(value) ? value : null;
}

async function writeOpportunitySnapshot(store, opportunities) {
  await store.setJSON(OP_SNAPSHOT_KEY, opportunities);
}

async function readStoredOpportunities(store) {
  const snapshot = await readOpportunitySnapshot(store);
  const items = snapshot ?? await listJSON(store, OP_PREFIX);
  return items.filter(Boolean);
}

async function readStoredOpportunity(store, id) {
  const direct = await store.get(`${OP_PREFIX}${id}`, { type:"json" });
  if (direct) return direct;
  return (await readStoredOpportunities(store)).find((item) => item?.id === id) || null;
}

function upsertOpportunity(items, next) {
  const index = items.findIndex((item) => item?.id === next.id);
  if (index === -1) return [...items, next];
  return items.map((item, itemIndex) => itemIndex === index ? next : item);
}

export function createStateRepository(store) {
  return {
    async listOpportunities() {
      return (await readStoredOpportunities(store)).map(safeSavedOpportunity);
    },

    async listCompanies() {
      return (await listJSON(store, COMPANY_PREFIX)).filter(Boolean);
    },

    async getCompany(company) {
      const key = companyKey(company);
      return (await store.get(`${COMPANY_PREFIX}${key}`, { type: "json" })) || emptyCompanyState(company);
    },

    async saveCompany(state) {
      await store.setJSON(`${COMPANY_PREFIX}${state.company_key}`, state);
      return state;
    },

    async setBookmark(company, bookmarked, nowIso) {
      const current = await this.getCompany(company);
      return this.saveCompany(setCompanyBookmark(current, bookmarked, nowIso));
    },

    async markEmailSent(company, payload) {
      if (payload.opportunityId) {
        const opportunity = await readStoredOpportunity(store, payload.opportunityId);
        if (!opportunity || !isSalesOpportunityRecord(opportunity)) throw nonSalesActionError();
      }
      const current = await this.getCompany(company);
      const next = markEmailSent(current, payload);
      await this.saveCompany(next);
      if (payload.opportunityId) await this.setOpportunityStatus(payload.opportunityId, "CONTACTED", payload.sentAt);
      return next;
    },

    async undoLastEmailSent(company, nowIso) {
      const current = await this.getCompany(company);
      return this.saveCompany(undoLastEmailSent(current, nowIso));
    },

    async getOpportunity(id) {
      return safeSavedOpportunity(await readStoredOpportunity(store, id));
    },

    async saveOpportunity(item) {
      const existing = await readStoredOpportunities(store);
      await store.setJSON(`${OP_PREFIX}${item.id}`, item);
      await writeOpportunitySnapshot(store, upsertOpportunity(existing, item));
      return item;
    },

    async setOpportunityStatus(id, status, nowIso) {
      const current = await readStoredOpportunity(store, id);
      if (!current) return null;
      const next = { ...current, status, updated_at: nowIso };
      await this.saveOpportunity(next);
      return safeSavedOpportunity(next);
    },

    async verifyOpportunitySource(id, confirmedSourceUrl, nowIso) {
      const current = await readStoredOpportunity(store, id);
      if (!current) return null;
      if (!isSalesOpportunityRecord(current)) throw nonSalesActionError();
      if (current.discovery_mode !== "INDEX_DISCOVERY_MANUAL_VERIFY") {
        const error = new Error("Source verification is not required for this opportunity.");
        error.code = "SOURCE_VERIFICATION_NOT_REQUIRED";
        throw error;
      }
      const currentUrl = normalizeUrl(current.source_url);
      const confirmedUrl = normalizeUrl(confirmedSourceUrl);
      if (!currentUrl || !confirmedUrl || current.source_url !== confirmedSourceUrl) {
        const error = new Error("The confirmed source does not match the saved opportunity source.");
        error.code = "SOURCE_VERIFICATION_URL_MISMATCH";
        throw error;
      }
      if (current.manual_verification_status === "VERIFIED_BEFORE_CONTACT"
        && current.manual_verified_source_url === current.source_url
        && current.manual_verified_at) return current;
      const next = {
        ...current,
        manual_verification_status:"VERIFIED_BEFORE_CONTACT",
        manual_verified_at:nowIso,
        manual_verified_source_url:current.source_url,
        updated_at:nowIso
      };
      await this.saveOpportunity(next);
      return safeSavedOpportunity(next);
    },

    async saveReply(id, reply, nowIso) {
      const current = await readStoredOpportunity(store, id);
      if (!current) return null;
      if (!isSalesOpportunityRecord(current)) throw nonSalesActionError();
      const next = { ...current, reply_to: reply.to || null, reply_subject: reply.subject, reply_body: reply.body, reply_generated_at: nowIso, reply_model: reply.model || null, reply_response_id: reply.response_id || null, updated_at: nowIso };
      await this.saveOpportunity(next);
      return safeSavedOpportunity(next);
    },

    async mergeSearchResults(incoming, nowIso) {
      return (await this.mergeSearchResultsWithStats(incoming, nowIso)).opportunities;
    },

    async mergeSearchResultsWithStats(incoming, nowIso) {
      const existing = await readStoredOpportunities(store);
      const companies = await this.listCompanies();
      const byKey = Object.fromEntries(companies.map((item) => [item.company_key, item]));
      const merged = mergeOpportunityHistory(existing, incoming, byKey, nowIso);
      let workspace = existing;
      for (const item of merged) {
        const fingerprint = opportunityFingerprint(item);
        const previous = workspace.find((entry) => opportunityFingerprint(entry) === fingerprint);
        workspace = previous
          ? workspace.map((entry) => opportunityFingerprint(entry) === fingerprint ? item : entry)
          : [...workspace, item];
        await store.setJSON(`${OP_PREFIX}${item.id}`, item);
      }
      await writeOpportunitySnapshot(store, workspace);
      const persisted = await readOpportunitySnapshot(store);
      if (!persisted || !merged.every((item) => persisted.some((saved) => saved?.id === item.id))) {
        throw new Error("STATE_WRITE_VERIFICATION_FAILED");
      }
      const mergedSales = merged.filter(isSalesOpportunityRecord);
      const workspaceSales = workspace.filter(isSalesOpportunityRecord);
      const workspaceCompetitors = workspace.filter((item) => recordKindOf(item) === "COMPETITOR");
      const workspacePlatforms = workspace.filter((item) => recordKindOf(item) === "SOURCE_PLATFORM");
      const workspaceFingerprints = new Set(workspaceSales.map(opportunityFingerprint));
      return {
        opportunities: merged,
        new_count: mergedSales.filter((item) => item.is_new).length,
        updated_count: mergedSales.filter((item) => !item.is_new).length,
        competitor_count:merged.filter((item) => recordKindOf(item) === "COMPETITOR").length,
        source_platform_count:merged.filter((item) => recordKindOf(item) === "SOURCE_PLATFORM").length,
        workspace_total: workspaceFingerprints.size,
        workspace_record_total:workspace.length,
        workspace_competitor_total:workspaceCompetitors.length,
        workspace_source_platform_total:workspacePlatforms.length
      };
    },

    async saveSearchRun(run) {
      await store.setJSON("metadata/last-search", run);
    },
    async lastSearchRun() {
      return store.get("metadata/last-search", {type:"json"});
    },

    async getSourceRun(runId) {
      return store.get(sourceRunKey(runId, "state"), { type:"json" });
    },

    async saveSourceRun(run) {
      await store.setJSON(sourceRunKey(run.run_id, "state"), run);
      await store.setJSON("metadata/last-source-run", { run_id:run.run_id, updated_at:run.updated_at });
      return run;
    },

    async lastSourceRun() {
      const pointer = await store.get("metadata/last-source-run", { type:"json" });
      return pointer?.run_id ? this.getSourceRun(pointer.run_id) : null;
    },

    async getSourceRunRequest(requestId) {
      return store.get(`${SOURCE_RUN_REQUEST_PREFIX}${safeStateId(requestId)}`, { type:"json" });
    },

    async saveSourceRunRequest(requestId, value) {
      await store.setJSON(`${SOURCE_RUN_REQUEST_PREFIX}${safeStateId(requestId)}`, value);
      return value;
    },

    async getSourceRunOperation(runId, operationId) {
      return store.get(sourceRunKey(runId, `operations/${safeStateId(operationId)}`), { type:"json" });
    },

    async saveSourceRunOperation(runId, operation) {
      await store.setJSON(sourceRunKey(runId, `operations/${safeStateId(operation.operation_id)}`), operation);
      return operation;
    },

    async getSourceRunCancel(runId) {
      return store.get(sourceRunKey(runId, "cancel"), { type:"json" });
    },

    async saveSourceRunCancel(runId, marker) {
      await store.setJSON(sourceRunKey(runId, "cancel"), marker);
      return marker;
    },

    async listSourceRunCandidates(runId) {
      return (await listJSON(store, sourceRunKey(runId, "candidates/"))).filter(Boolean);
    },

    async getSourceRunCandidate(runId, candidateId) {
      return store.get(sourceRunKey(runId, `candidates/${safeStateId(candidateId)}`), { type:"json" });
    },

    async findSourceRunCandidate(runId, dedupeKeys) {
      for (const key of dedupeKeys) {
        const pointer = await store.get(dedupeIndexKey(runId, key), { type:"json" });
        if (!pointer?.candidate_id) continue;
        const candidate = await this.getSourceRunCandidate(runId, pointer.candidate_id);
        if (candidate) return candidate;
      }
      return null;
    },

    async saveSourceRunCandidate(runId, candidate) {
      await store.setJSON(sourceRunKey(runId, `candidates/${safeStateId(candidate.candidate_id)}`), candidate);
      for (const key of candidate.dedupe_keys || []) {
        await store.setJSON(dedupeIndexKey(runId, key), { candidate_id:candidate.candidate_id });
      }
      return candidate;
    },

    async snapshot() {
      const opportunities = await this.listOpportunities();
      const companies = await this.listCompanies();
      const byKey = Object.fromEntries(companies.map((item) => [item.company_key, item]));
      const hydrated = opportunities.map((item) => {
        const company = byKey[companyKey(item.company)] || emptyCompanyState(item.company);
        return { ...item, company_key: company.company_key, company_bookmarked: company.bookmarked, company_last_contacted_at: company.last_contacted_at, company_contact_count: company.contact_count };
      });
      const sales = hydrated.filter(isSalesOpportunityRecord);
      return {
        last_search: await this.lastSearchRun(),
        summary:{
          opportunities:sales.length,
          companies:new Set(sales.map((item) => companyKey(item.company))).size,
          high_fit:sales.filter((item) => item.fit_score >= 80).length,
          competitors:hydrated.filter((item) => item.record_kind === "COMPETITOR").length,
          source_platforms:hydrated.filter((item) => item.record_kind === "SOURCE_PLATFORM").length
        },
        records:hydrated,
        // Backward-compatible alias for clients created before record_kind existed.
        opportunities: hydrated,
        companies
      };
    }
  };
}
