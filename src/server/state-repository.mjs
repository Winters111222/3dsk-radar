import { companyKey, emptyCompanyState, setCompanyBookmark, markEmailSent, undoLastEmailSent } from "./company-memory.mjs";
import { mergeOpportunityHistory, opportunityFingerprint } from "./history.mjs";
import { normalizeBudget, normalizeUrl } from "./normalize.mjs";
import { createHash } from "node:crypto";

const OP_PREFIX = "opportunities/";
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
  return { ...item, ...normalizeBudget(item, sources) };
}

async function listJSON(store, prefix) {
  const result = await store.list({ prefix });
  return Promise.all((result.blobs || []).map(({ key }) => store.get(key, { type: "json" })));
}

export function createStateRepository(store) {
  return {
    async listOpportunities() {
      return (await listJSON(store, OP_PREFIX)).filter(Boolean).map(safeSavedOpportunity);
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
      return safeSavedOpportunity(await store.get(`${OP_PREFIX}${id}`, { type: "json" }));
    },

    async saveOpportunity(item) {
      await store.setJSON(`${OP_PREFIX}${item.id}`, item);
      return item;
    },

    async setOpportunityStatus(id, status, nowIso) {
      const current = await this.getOpportunity(id);
      if (!current) return null;
      const next = { ...current, status, updated_at: nowIso };
      await this.saveOpportunity(next);
      return next;
    },

    async saveReply(id, reply, nowIso) {
      const current = await this.getOpportunity(id);
      if (!current) return null;
      const next = { ...current, reply_to: reply.to || null, reply_subject: reply.subject, reply_body: reply.body, reply_generated_at: nowIso, reply_model: reply.model || null, reply_response_id: reply.response_id || null, updated_at: nowIso };
      await this.saveOpportunity(next);
      return next;
    },

    async mergeSearchResults(incoming, nowIso) {
      return (await this.mergeSearchResultsWithStats(incoming, nowIso)).opportunities;
    },

    async mergeSearchResultsWithStats(incoming, nowIso) {
      const existing = await this.listOpportunities();
      const companies = await this.listCompanies();
      const byKey = Object.fromEntries(companies.map((item) => [item.company_key, item]));
      const merged = mergeOpportunityHistory(existing, incoming, byKey, nowIso);
      for (const item of merged) await this.saveOpportunity(item);
      const workspaceFingerprints = new Set([...existing, ...merged].map(opportunityFingerprint));
      return {
        opportunities: merged,
        new_count: merged.filter((item) => item.is_new).length,
        updated_count: merged.filter((item) => !item.is_new).length,
        workspace_total: workspaceFingerprints.size
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
      return {
        last_search: await this.lastSearchRun(),
        opportunities: opportunities.map((item) => {
          const company = byKey[companyKey(item.company)] || emptyCompanyState(item.company);
          return { ...item, company_key: company.company_key, company_bookmarked: company.bookmarked, company_last_contacted_at: company.last_contacted_at, company_contact_count: company.contact_count };
        }),
        companies
      };
    }
  };
}
