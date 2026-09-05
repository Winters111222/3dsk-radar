import { bandForScore, contactDisplay, STATUS_VALUES } from "./lib/domain.mjs";

const STORAGE_KEY = "3dsk-radar-stage1-status-v1";
const state = { opportunities: [], selectedId: null, kind: "ALL", status: "ALL", minFit: 0 };

const els = {
  body: document.querySelector("#opportunity-body"),
  detail: document.querySelector("#detail-panel"),
  summary: document.querySelector("#summary-grid"),
  count: document.querySelector("#result-count"),
  find: document.querySelector("#find-button"),
  scanNote: document.querySelector("#scan-note"),
  statusFilter: document.querySelector("#status-filter"),
  fitFilter: document.querySelector("#fit-filter"),
  toast: document.querySelector("#toast")
};

const escapeHtml = (value) => String(value ?? "").replace(/[&<>'\"]/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
const bandClass = (score) => bandForScore(score).toLowerCase();

function readStatuses() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch { return {}; }
}
function persistStatus(id, status) {
  const next = { ...readStatuses(), [id]: status };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}
function hydrateStatuses(items) {
  const saved = readStatuses();
  return items.map((item) => ({ ...item, status: STATUS_VALUES.includes(saved[item.id]) ? saved[item.id] : item.status }));
}
function filtered() {
  return state.opportunities.filter((item) =>
    (state.kind === "ALL" || item.opportunity_kind === state.kind) &&
    (state.status === "ALL" || item.status === state.status) &&
    item.fit_score >= state.minFit
  ).sort((a,b) => b.win_score - a.win_score || b.fit_score - a.fit_score);
}
function formatDate(value) {
  if (!value) return "Date unknown";
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return "Date unknown";
  return new Intl.DateTimeFormat("en", { month:"short", day:"numeric", year:"numeric" }).format(date);
}
function freshness(value) {
  if (!value) return "date unknown";
  const d = new Date(`${value}T00:00:00Z`);
  const days = Math.max(0, Math.round((Date.now() - d.getTime()) / 86400000));
  if (days === 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}
function budgetView(item) {
  if (item.budget_type === "PUBLISHED") return { value:item.budget_published, meta:"PUBLISHED", cls:"published" };
  if (item.budget_type === "ESTIMATED") {
    const currency = item.budget_currency || "";
    const min = Number(item.budget_estimated_min).toLocaleString("en-US");
    const max = Number(item.budget_estimated_max).toLocaleString("en-US");
    return { value:`${currency} ${min}–${max}`, meta:`ESTIMATED · ${item.budget_confidence || "unknown"} confidence`, cls:"estimated" };
  }
  return { value:"Budget unknown", meta:"UNKNOWN", cls:"unknown" };
}
function kindBadge(item) {
  const open = item.opportunity_kind === "OPEN_OPPORTUNITY";
  return `<span class="kind-badge ${open ? "open" : "lead"}">${open ? "OPEN OPPORTUNITY" : "POTENTIAL LEAD"}</span>`;
}
function scoreMarkup(label, score) {
  const band = bandForScore(score);
  return `<span class="score ${band.toLowerCase()}"><strong>${score}</strong><small>${escapeHtml(label)} · ${band}</small></span>`;
}
function statusOptions(selected) {
  return STATUS_VALUES.map((status) => `<option value="${status}" ${status === selected ? "selected" : ""}>${status}</option>`).join("");
}
function renderSummary() {
  const all = state.opportunities;
  const open = all.filter((x) => x.opportunity_kind === "OPEN_OPPORTUNITY");
  const highFit = all.filter((x) => x.fit_score >= 80);
  const contactable = all.filter((x) => Boolean(x.contact_email));
  const cards = [
    ["NEW IN DATASET", all.filter((x) => x.is_new).length, "fixture records"],
    ["OPEN OPPORTUNITIES", open.length, `${all.length - open.length} potential lead`],
    ["HIGH FIT", highFit.length, "FIT 80+"],
    ["CONTACTABLE", contactable.length, "public-source email in fixture"]
  ];
  els.summary.innerHTML = cards.map(([label,value,sub]) => `<article class="summary-card"><span class="label">${label}</span><strong class="value">${value}</strong><span class="sub">${sub}</span></article>`).join("");
}
function renderTable() {
  const items = filtered();
  els.count.textContent = `${items.length} shown · ${state.opportunities.length} total fixture records`;
  if (!items.length) {
    els.body.innerHTML = `<tr><td colspan="10">No fixture opportunities match these filters.</td></tr>`;
    return;
  }
  els.body.innerHTML = items.map((item) => {
    const budget = budgetView(item);
    const selected = item.id === state.selectedId;
    return `<tr data-id="${escapeHtml(item.id)}" class="${selected ? "is-selected" : ""}">
      <td><input class="select-radio" type="radio" name="selected-opportunity" ${selected ? "checked" : ""} aria-label="Select ${escapeHtml(item.title)}"></td>
      <td>${scoreMarkup("FIT", item.fit_score)}</td>
      <td>${scoreMarkup("WIN", item.win_score)}</td>
      <td><span class="opportunity-title">${escapeHtml(item.title)}</span><span class="company">${escapeHtml(item.company)}</span></td>
      <td>${kindBadge(item)}<div style="margin-top:7px;color:#7c8997">${escapeHtml(item.categories[0])}</div></td>
      <td class="budget-cell"><span class="budget-value">${escapeHtml(budget.value)}</span><span class="provenance ${budget.cls}">${escapeHtml(budget.meta)}</span></td>
      <td>${escapeHtml(formatDate(item.published_date))}<span class="company">${escapeHtml(freshness(item.published_date))}</span>${item.remote_scope === "LOCATION_RESTRICTED" ? '<span class="location-badge" style="margin-top:7px;color:#f1c75b">LOCATION RESTRICTED</span>' : ""}</td>
      <td class="${item.contact_email ? "contact-yes" : "contact-no"}">${escapeHtml(contactDisplay(item))}</td>
      <td><select class="status-select" data-status-id="${escapeHtml(item.id)}">${statusOptions(item.status)}</select></td>
      <td><a class="source-link" href="${escapeHtml(item.source_url)}" target="_blank" rel="noreferrer">OPEN</a></td>
    </tr>`;
  }).join("");
}
function bullets(items, emptyText) {
  return items?.length ? `<ul>${items.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul>` : `<p>${escapeHtml(emptyText)}</p>`;
}
function renderDetail() {
  const item = state.opportunities.find((x) => x.id === state.selectedId);
  if (!item) {
    els.detail.innerHTML = `<div class="detail-empty"><div><p class="eyebrow">SELECT</p><strong>Choose one opportunity to inspect the evidence, fit and response path.</strong></div></div>`;
    return;
  }
  const budget = budgetView(item);
  const contact = item.contact_email
    ? `<p><strong>${escapeHtml(item.contact_email)}</strong><br><span style="color:#748291">Provenance: ${escapeHtml(item.contact_email_source)}</span></p>`
    : `<p><strong>Email not publicly available</strong><br><span style="color:#748291">No address will be inferred from a naming pattern.</span></p>`;
  const tags = item.categories.slice(0,5).map((x) => `<span class="tag">${escapeHtml(x)}</span>`).join("");
  els.detail.innerHTML = `
    <div class="detail-head">
      <p class="eyebrow">${item.opportunity_kind === "OPEN_OPPORTUNITY" ? "OPEN OPPORTUNITY" : "POTENTIAL LEAD · NOT AN ACTIVE REQUEST"}</p>
      <h3>${escapeHtml(item.title)}</h3>
      <p class="detail-company">${escapeHtml(item.company)} · ${escapeHtml(item.location)}</p>
      <div class="detail-tags">${kindBadge(item)}${tags}</div>
    </div>
    <div class="detail-body">
      <div class="score-pair">
        <div class="score-card"><span>FIT SCORE</span><strong>${item.fit_score}</strong><span>${bandForScore(item.fit_score)} MATCH</span></div>
        <div class="score-card"><span>WIN SCORE</span><strong>${item.win_score}</strong><span>${item.win_band} · HEURISTIC</span></div>
      </div>
      <div class="detail-section"><h4>SUMMARY</h4><p>${escapeHtml(item.summary)}</p></div>
      <div class="detail-section"><h4>WHY IT FITS</h4>${bullets(item.why_it_fits, "No fit rationale available.")}</div>
      <div class="detail-section"><h4>RISKS / GAPS</h4>${bullets([...item.risks, ...item.missing_requirements], "No recorded gaps.")}</div>
      <div class="detail-section"><h4>BUDGET</h4><p><strong>${escapeHtml(budget.value)}</strong> · ${escapeHtml(budget.meta)}<br><span style="color:#748291">${escapeHtml(item.budget_reason)}</span></p></div>
      <div class="detail-section"><h4>CONTACT</h4>${contact}</div>
      <div class="detail-section"><h4>SOURCE / FRESHNESS</h4><p>${escapeHtml(item.source_domain)} · ${escapeHtml(formatDate(item.published_date))} · first seen ${escapeHtml(new Date(item.first_seen).toLocaleString())}</p></div>
      <div class="detail-section"><h4>STATUS</h4><p>${escapeHtml(item.status)} · Stage 1 stores status only in this browser's localStorage. Shared team persistence arrives later.</p></div>
      <div class="detail-actions">
        ${item.contact_email ? '<button class="action-button" data-copy="email" type="button">COPY EMAIL</button>' : `<a class="action-button" href="${escapeHtml(item.apply_url)}" target="_blank" rel="noreferrer" style="text-align:center;text-decoration:none">OPEN CONTACT / APPLY</a>`}
        <a class="action-button" href="${escapeHtml(item.source_url)}" target="_blank" rel="noreferrer" style="text-align:center;text-decoration:none">OPEN SOURCE</a>
        <button class="action-button primary full" type="button" disabled title="Stage 4: server-side generation is intentionally not connected yet">GENERATE RESPONSE · STAGE 4</button>
        <button class="action-button" type="button" disabled>COPY SUBJECT</button>
        <button class="action-button" type="button" disabled>COPY RESPONSE</button>
      </div>
    </div>`;
}
function renderAll() { renderSummary(); renderTable(); renderDetail(); }
function selectOpportunity(id) { state.selectedId = id; renderTable(); renderDetail(); }
function setStatus(id, status) {
  const item = state.opportunities.find((x) => x.id === id);
  if (!item || !STATUS_VALUES.includes(status)) return;
  item.status = status; persistStatus(id, status); renderAll(); showToast(`Status saved locally: ${status}`);
}
async function copyText(value, label) {
  try {
    await navigator.clipboard.writeText(value);
    showToast(`${label} copied`);
  } catch {
    const area = document.createElement("textarea"); area.value = value; document.body.append(area); area.select(); document.execCommand("copy"); area.remove(); showToast(`${label} copied`);
  }
}
let toastTimer;
function showToast(text) {
  clearTimeout(toastTimer); els.toast.textContent = text; els.toast.classList.add("is-visible"); toastTimer = setTimeout(() => els.toast.classList.remove("is-visible"), 1800);
}

els.body.addEventListener("click", (event) => {
  if (event.target.closest("select, a")) return;
  const row = event.target.closest("tr[data-id]"); if (row) selectOpportunity(row.dataset.id);
});
els.body.addEventListener("change", (event) => {
  if (event.target.matches(".status-select")) setStatus(event.target.dataset.statusId, event.target.value);
  if (event.target.matches(".select-radio")) selectOpportunity(event.target.closest("tr").dataset.id);
});
els.detail.addEventListener("click", (event) => {
  if (event.target.dataset.copy === "email") {
    const item = state.opportunities.find((x) => x.id === state.selectedId);
    if (item?.contact_email) copyText(item.contact_email, "Email");
  }
});
document.querySelectorAll("[data-kind]").forEach((button) => button.addEventListener("click", () => {
  document.querySelectorAll("[data-kind]").forEach((x) => x.classList.remove("is-active")); button.classList.add("is-active"); state.kind = button.dataset.kind; renderTable();
}));
els.statusFilter.addEventListener("change", () => { state.status = els.statusFilter.value; renderTable(); });
els.fitFilter.addEventListener("change", () => { state.minFit = Number(els.fitFilter.value); renderTable(); });
els.find.addEventListener("click", () => {
  els.find.disabled = true; els.find.textContent = "CHECKING FIXTURE DATA…"; els.scanNote.textContent = "No web search or OpenAI request is being made.";
  setTimeout(() => { els.find.disabled = false; els.find.textContent = "FIND NEW OPPORTUNITIES"; els.scanNote.textContent = "Fixture refresh complete · $0 external API cost"; showToast("Stage 1 fixture refresh complete — no paid API call"); }, 450);
});

async function init() {
  try {
    const response = await fetch("/fixtures/opportunities.json");
    if (!response.ok) throw new Error(`Fixture load failed: ${response.status}`);
    state.opportunities = hydrateStatuses(await response.json());
    state.selectedId = state.opportunities[0]?.id || null;
    renderAll();
  } catch (error) {
    els.body.innerHTML = `<tr><td colspan="10">${escapeHtml(error.message)}</td></tr>`;
    els.detail.innerHTML = `<div class="detail-empty">Fixture load failed. Existing data was not replaced.</div>`;
  }
}

init();
