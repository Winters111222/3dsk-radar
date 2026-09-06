import { CATEGORIES, SORTS, visibleResults } from "./lib/result-view.mjs";
import { bandForScore, contactDisplay, STATUS_VALUES } from "./lib/domain.mjs";
import { continueSourceRunLoop, isTerminalSourceRun, sourceCandidateView, sourceRunProgress } from "./lib/source-run-view.mjs";

const acceptanceWorkspace = new URLSearchParams(location.search).get("workspace") === "acceptance";
const STATUS_STORAGE_KEY = "3dsk-radar-fixture-status-v2";
const ACCESS_SESSION_KEY = "3dsk-radar-access-v2";
const state = { opportunities:[], companies:new Map(), selectedId:null, view:"ALL", status:"ALL", minFit:0, datasetMode:"DISCONNECTED", lastRun:null, categories:[], sortKey:"win_score", sortDirection:"desc", sourceRun:null, sourceCandidates:[], sourceRunBusy:false, sourceRunStop:false, sourceRunMessage:null, collectionEnabled:false, searchEnabled:false, searchProfile:null, replyEnabled:false };
const els = {
  body:document.querySelector("#opportunity-body"), detail:document.querySelector("#detail-panel"), summary:document.querySelector("#summary-grid"), count:document.querySelector("#result-count"),
  find:document.querySelector("#find-button"), connect:document.querySelector("#connect-button"), scanNote:document.querySelector("#scan-note"), statusFilter:document.querySelector("#status-filter"), fitFilter:document.querySelector("#fit-filter"),
  toast:document.querySelector("#toast"), accessCode:document.querySelector("#access-code"), datasetPill:document.querySelector("#dataset-pill"),
  runCounters:document.querySelector("#run-counters"), runCounterGrid:document.querySelector("#run-counter-grid"), runCounterMode:document.querySelector("#run-counter-mode"),
  searchDiagnostics:document.querySelector("#search-diagnostics"), searchCoverageGrid:document.querySelector("#search-coverage-grid"), sourceYieldGrid:document.querySelector("#source-yield-grid"), searchDiagnosticState:document.querySelector("#search-diagnostic-state"), searchDiagnosticSummary:document.querySelector("#search-diagnostic-summary"), searchRejectionSummary:document.querySelector("#search-rejection-summary"),
  sourceRunPanel:document.querySelector("#source-run-panel"), sourceRunStatus:document.querySelector("#source-run-status"), sourceRunProgress:document.querySelector("#source-run-progress"), sourceRunCandidates:document.querySelector("#source-run-candidates"), sourceRunButton:document.querySelector("#source-run-button"), sourceRunCancel:document.querySelector("#source-run-cancel"), sourceRunProfile:document.querySelector("#source-run-profile"), sourceRunNote:document.querySelector("#source-run-note")
};
const escapeHtml = (value) => String(value ?? "").replace(/[&<>'\"]/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
const companyMapKey = (company) => String(company || "").trim().toLowerCase();

function readFixtureStatuses(){ try{return JSON.parse(localStorage.getItem(STATUS_STORAGE_KEY)||"{}");}catch{return {};} }
function hydrateFixtureStatuses(items){ const saved=readFixtureStatuses(); return items.map((item)=>({...item,status:STATUS_VALUES.includes(saved[item.id])?saved[item.id]:item.status,company_bookmarked:false,company_last_contacted_at:null,company_contact_count:0})); }
function saveFixtureStatus(id,status){ localStorage.setItem(STATUS_STORAGE_KEY,JSON.stringify({...readFixtureStatuses(),[id]:status})); }
function companyStateFor(item){ return state.companies.get(item.company_key || companyMapKey(item.company)) || { company:item.company, bookmarked:Boolean(item.company_bookmarked), last_contacted_at:item.company_last_contacted_at||null, contact_count:item.company_contact_count||0, contact_history:[] }; }
function applyCompanyState(company){ state.companies.set(company.company_key || companyMapKey(company.company),company); for(const item of state.opportunities){ if((item.company_key&&company.company_key&&item.company_key===company.company_key)||companyMapKey(item.company)===companyMapKey(company.company)){ item.company_key=company.company_key||item.company_key; item.company_bookmarked=Boolean(company.bookmarked); item.company_last_contacted_at=company.last_contacted_at||null; item.company_contact_count=company.contact_count||0; } } }
function accessCode(){ return els.accessCode.value.trim(); }
function authHeaders(){ return {...(acceptanceWorkspace?{"x-radar-workspace":"acceptance"}:{}),"content-type":"application/json","authorization":`Bearer ${accessCode()}`}; }
async function api(path,options={}){ const response=await fetch(path,{...options,headers:{...authHeaders(),...(options.headers||{})}}); const payload=await response.json().catch(()=>({})); if(!response.ok||!payload.ok){const error=new Error(payload?.error?.message||`${path} failed (${response.status})`);error.code=payload?.error?.code||"API_FAILED";error.status=response.status;error.retryAfterSeconds=payload?.error?.retry_after_seconds||null;throw error;} return payload; }

function filtered(){ return visibleResults(state.opportunities,state); }
function formatDate(value){ if(!value)return"Date unknown"; const date=new Date(`${value}T00:00:00Z`); return Number.isNaN(date.getTime())?"Date unknown":new Intl.DateTimeFormat("en",{month:"short",day:"numeric",year:"numeric"}).format(date); }
function formatTimestamp(value){ if(!value)return"Never"; const date=new Date(value); return Number.isNaN(date.getTime())?"Unknown":new Intl.DateTimeFormat("en",{month:"short",day:"numeric",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(date); }
function daysSince(value){ if(!value)return null; const ts=new Date(value).getTime(); return Number.isFinite(ts)?Math.max(0,Math.floor((Date.now()-ts)/86400000)):null; }
function freshness(value){ const days=value?daysSince(`${value}T00:00:00Z`):null; if(days===null)return"date unknown"; if(days===0)return"today"; if(days===1)return"1 day ago"; return`${days} days ago`; }
function budgetView(item){ if(item.budget_type==="PUBLISHED")return{value:item.budget_published,meta:"PUBLISHED",cls:"published"}; if(item.budget_type==="ESTIMATED")return{value:`${item.budget_currency||""} ${Number(item.budget_estimated_min).toLocaleString("en-US")}–${Number(item.budget_estimated_max).toLocaleString("en-US")}`,meta:`ESTIMATED · ${item.budget_confidence||"unknown"} confidence`,cls:"estimated"}; return{value:"Budget unknown",meta:"UNKNOWN",cls:"unknown"}; }
function kindBadge(item){ const open=item.opportunity_kind==="OPEN_OPPORTUNITY"; return`<span class="kind-badge ${open?"open":"lead"}">${open?"OPEN OPPORTUNITY":"POTENTIAL LEAD"}</span>`; }
function manualVerificationRequired(item){ return item.manual_verification_status==="REQUIRED_BEFORE_CONTACT"; }
function manualVerificationComplete(item){ return item.manual_verification_status==="VERIFIED_BEFORE_CONTACT"&&Boolean(item.manual_verified_at)&&item.manual_verified_source_url===item.source_url; }
function scoreMarkup(label,score){ const band=bandForScore(score); return`<span class="score ${band.toLowerCase()}"><strong>${score}</strong><small>${escapeHtml(label)} · ${band}</small></span>`; }
function statusOptions(selected){ return STATUS_VALUES.map((s)=>`<option value="${s}" ${s===selected?"selected":""}>${s}</option>`).join(""); }
function outreachMarkup(item){ const company=companyStateFor(item); if(!company.last_contacted_at)return'<span class="outreach none">NOT EMAILED</span>'; const days=daysSince(company.last_contacted_at); const recent=days!==null&&days<=30; return`<span class="outreach ${recent?"recent":"past"}">EMAILED ${days===0?"TODAY":`${days}D AGO`}</span><span class="company">${company.contact_count||1}× total</span>`; }

function renderSummary(){ const all=state.opportunities; const uniqueCompanies=new Set(all.map((x)=>companyMapKey(x.company))).size; const bookmarked=new Set(all.filter((x)=>x.company_bookmarked).map((x)=>companyMapKey(x.company))).size; const contacted=new Set(all.filter((x)=>x.company_last_contacted_at).map((x)=>companyMapKey(x.company))).size; const cards=[["OPPORTUNITIES",all.length,state.datasetMode.toLowerCase()],["COMPANIES",uniqueCompanies,"unique buyers"],["BOOKMARKED",bookmarked,"companies"],["EMAILED",contacted,"companies with history"],["HIGH FIT",all.filter((x)=>x.fit_score>=80).length,"FIT 80+"]]; els.summary.innerHTML=cards.map(([l,v,s])=>`<article class="summary-card"><span class="label">${escapeHtml(l)}</span><strong class="value">${escapeHtml(v)}</strong><span class="sub">${escapeHtml(s)}</span></article>`).join(""); }
function renderRunCounters(){ const counters=state.lastRun?.counters; if(!counters){els.runCounters.hidden=true;els.runCounterGrid.innerHTML="";return;} const value=(number)=>Number.isFinite(number)?number:"—"; const cards=[["SOURCE URLS",counters.source_urls_verified,"verified originals"],["CANDIDATES",counters.candidates_seen,"seen"],["VERIFIED",counters.candidates_verified,"after truth gates"],["REJECTED",counters.candidates_rejected,"with reason"],["DUPLICATES",counters.duplicates_removed,"removed"],["NEW",counters.new_opportunities,"first seen"],["UPDATED",counters.updated_opportunities,"known records"],["WORKSPACE",counters.workspace_total,"saved total"]]; els.runCounterMode.textContent=counters.collector_mode||"UNKNOWN MODE";els.runCounterGrid.innerHTML=cards.map(([label,number,note])=>`<article class="run-counter"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value(number))}</strong><small>${escapeHtml(note)}</small></article>`).join("");els.runCounters.hidden=false; }
function diagnosticReasonLabel(code){return({unverified_source_url:"source URL not verified",source_not_allowed_for_index_discovery:"URL was not an allowed opportunity detail",missing_core_identity:"missing title, company or summary",invalid_opportunity_kind:"invalid opportunity type",seller_not_opportunity:"seller, not buyer demand",unknown_commercial_role:"buyer role not established",inactive_notice:"closed, awarded or cancelled",studio_ineligible:"studio/vendor not eligible",out_of_scope:"outside 3D.SK scope",stale_or_unverified:"older than 30 days without active proof",excluded_search_category:"excluded Visual / AI / Motion-only work",normalized_contract:"normalized data contract failed",other_validation_failure:"other validation failure"})[code]||code;}
function renderSearchDiagnostics(){
  const diagnostics=state.lastRun?.diagnostics;
  if(!diagnostics||!Array.isArray(diagnostics.source_yield)){els.searchDiagnostics.hidden=true;els.searchCoverageGrid.innerHTML="";els.sourceYieldGrid.innerHTML="";return;}
  const totals=diagnostics.source_yield.reduce((sum,item)=>({consulted:sum.consulted+Number(item.consulted_urls||0),details:sum.details+Number(item.eligible_detail_urls||0),seen:sum.seen+Number(item.candidates_seen||0),rejected:sum.rejected+Number(item.candidates_rejected||0),returned:sum.returned+Number(item.returned||0)}),{consulted:0,details:0,seen:0,rejected:0,returned:0});
  const coverage=Array.isArray(state.lastRun?.coverage)?state.lastRun.coverage:[];
  els.searchCoverageGrid.innerHTML=coverage.map((item)=>`<article class="run-counter coverage-${escapeHtml(String(item.status||"unknown").toLowerCase())}"><span>${escapeHtml(item.shard_label)}</span><strong>${escapeHtml(item.status)}</strong><small>${escapeHtml(item.consulted_urls)} consulted URLs · ${escapeHtml(item.web_search_calls)} web searches · ${escapeHtml(item.allowed_domain_count)} allowed domains${item.error_code?` · ${escapeHtml(item.error_code)}`:""}</small></article>`).join("");
  const activeSources=diagnostics.source_yield.filter((item)=>Number(item.consulted_urls||0)||Number(item.candidates_seen||0)||Number(item.returned||0));
  els.sourceYieldGrid.innerHTML=activeSources.map((item)=>`<article class="run-counter"><span>${escapeHtml(item.source_label)}</span><strong>${escapeHtml(item.returned)} returned</strong><small>${escapeHtml(item.consulted_urls)} consulted URLs · ${escapeHtml(item.eligible_detail_urls)} detail URLs · ${escapeHtml(item.candidates_seen)} candidates · ${escapeHtml(item.candidates_rejected)} rejected</small></article>`).join("");
  const zeroMessages={NO_STRUCTURED_CANDIDATES:`ZERO RESULT · Hosted search consulted ${totals.consulted} allowlisted URLs (${totals.details} valid detail URLs), but produced no structured candidates.`,ALL_CANDIDATES_REJECTED:`ZERO RESULT · ${totals.seen} structured candidates were evaluated and all ${totals.rejected} failed a truth or relevance gate.`,ALL_ACCEPTED_CANDIDATES_DEDUPLICATED:"ZERO RESULT · every accepted candidate was already present after deduplication."};
  els.searchDiagnosticState.textContent=totals.returned?`${totals.returned} RETURNED`:"ZERO RESULT";
  els.searchDiagnosticSummary.textContent=zeroMessages[diagnostics.zero_result_reason]||`${totals.returned} opportunities returned from ${totals.consulted} consulted URLs.`;
  const reasons=Object.entries(diagnostics.rejection_reasons||{}).sort((a,b)=>Number(b[1])-Number(a[1]));
  els.searchRejectionSummary.textContent=reasons.length?`Rejection reasons: ${reasons.map(([code,count])=>`${diagnosticReasonLabel(code)} · ${count}`).join(" | ")}`:"No candidate rejection reasons were recorded.";
  els.searchDiagnostics.hidden=false;
}
function sourceName(id){return({ted_eu:"TED",find_tender_uk:"Find a Tender",contracts_finder_uk:"Contracts Finder",upwork:"Upwork",freelancer:"Freelancer",reddit_gamedevclassifieds:"Reddit r/gameDevClassifieds",unreal_job_offerings:"Unreal Engine Forums",polycount_paid:"Polycount"})[id]||id;}
function progressCard(label,metric){const percent=Math.round(metric.ratio*100);return`<article class="source-progress-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(metric.value)} / ${escapeHtml(metric.maximum)}</strong><div class="source-progress-track"><i style="width:${percent}%"></i></div></article>`;}
function renderSourceRun(){
  const run=state.sourceRun,progress=sourceRunProgress(run),terminal=isTerminalSourceRun(run),active=Boolean(run&&!terminal);
  els.sourceRunStatus.textContent=!state.collectionEnabled?"LOCKED":run?.status||"READY";
  els.sourceRunStatus.dataset.state=!state.collectionEnabled?"LOCKED":run?.status||"READY";
  els.sourceRunProgress.innerHTML=[progressCard("SERVICES",progress.services),progressCard("PAGES",progress.pages),progressCard("RAW CANDIDATES",progress.candidates),progressCard("TRUTH REVIEW",progress.reviews)].join("");
  const candidates=state.sourceCandidates.map(sourceCandidateView).slice(0,24);
  const reviewLabels={RAW_CANDIDATE:"RAW · NEEDS TRUTH REVIEW",DETAIL_FETCH_IN_PROGRESS:"DETAIL · VERIFYING",RETRYABLE:"DETAIL · RETRY WAIT",PROMOTED:"PROMOTED · VERIFIED",REJECTED:"REJECTED · FAIL CLOSED",BLOCKED:"BLOCKED · DETAIL CAP",ENRICHED:"ENRICHED · CANCELLED BEFORE PROMOTION"};
  els.sourceRunCandidates.innerHTML=candidates.length?candidates.map((item)=>`<li><div><span class="raw-candidate-badge" data-review-state="${escapeHtml(item.review_state)}">${escapeHtml(reviewLabels[item.review_state]||item.review_state)}</span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.buyers.join(", ")||"Buyer not stated")} · ${escapeHtml(sourceName(item.source_id))}${item.observed_date?` · ${escapeHtml(item.observed_date)}`:""}${item.reference_count>1?` · ${escapeHtml(item.reference_count)} sources/revisions`:""}${item.rejection_reason?` · ${escapeHtml(item.rejection_reason)}`:""}</small></div>${item.source_url?`<a href="${escapeHtml(item.source_url)}" target="_blank" rel="noreferrer">OPEN SOURCE</a>`:""}</li>`).join(""):'<li class="source-candidate-empty">No persisted source candidates yet.</li>';
  els.sourceRunButton.disabled=state.sourceRunBusy||!state.collectionEnabled;
  els.sourceRunButton.textContent=state.sourceRunBusy?"COLLECTING…":active?"RESUME SOURCE RUN":"START ZERO-COST SOURCE RUN";
  els.sourceRunCancel.disabled=state.sourceRunBusy?false:!active;
  els.sourceRunProfile.disabled=state.sourceRunBusy||active;
  els.sourceRunNote.textContent=state.sourceRunMessage||(!state.collectionEnabled?"Source collection is server-locked. Enabling it later requires deployed zero-cost acceptance; this UI cannot change environment settings.":run?`Run ${run.run_id} · ${run.phase||"COLLECTION"} · ${run.completion_reason||"ready"} · only truth-gated records are promoted.`:"Choose a bounded profile. One click collects, enriches and truth-reviews through up to 25 persisted chunks; long runs can be resumed safely.");
}
function renderTable(){ const items=filtered(); if(!items.some(x=>x.id===state.selectedId))state.selectedId=items[0]?.id||null; renderSort(); renderDetail(); els.count.textContent=`${items.length} shown · ${state.opportunities.length} total`; if(!items.length){els.body.innerHTML=`<tr class="empty-row"><td colspan="15">${state.datasetMode==="DISCONNECTED"?"Enter your team access code to load saved opportunities.":state.opportunities.length?"No opportunities match these filters. Clear categories or adjust Status and Minimum fit.":"No saved opportunities yet. New searches will be saved here."}</td></tr>`;return;} els.body.innerHTML=items.map((item)=>{const budget=budgetView(item);return`<tr data-id="${escapeHtml(item.id)}" class="${item.id===state.selectedId?"is-selected":""}">
<td data-label="Select"><input class="select-radio" type="radio" name="selected-opportunity" aria-label="Select ${escapeHtml(item.title)}" ${item.id===state.selectedId?"checked":""}></td>
<td data-label="Bookmark"><button class="star-button ${item.company_bookmarked?"is-starred":""}" data-bookmark-company="${escapeHtml(item.company)}" type="button" title="${item.company_bookmarked?"Remove company bookmark":"Bookmark company"}">${item.company_bookmarked?"★":"☆"}</button></td>
<td data-label="Fit">${scoreMarkup("FIT",item.fit_score)}</td><td data-label="Win">${scoreMarkup("WIN",item.win_score)}</td>
<td data-label="Opportunity"><span class="opportunity-title">${escapeHtml(item.title)}</span></td>
<td data-label="Company"><span class="company-name">${escapeHtml(item.company)}</span>${item.company_bookmarked?'<span class="bookmarked-label">BOOKMARKED</span>':""}</td>
<td data-label="Type">${kindBadge(item)}${manualVerificationRequired(item)?'<span class="manual-verify-badge">VERIFY SOURCE</span>':manualVerificationComplete(item)?'<span class="manual-verify-badge verified">SOURCE VERIFIED</span>':""}<div class="minor-line">${item.categories.map(x=>escapeHtml(CATEGORIES[x]||x)).join(" · ")}</div><div class="minor-line">${escapeHtml(item.commercial_role||"LEGACY")} · ${escapeHtml(item.notice_status||"UNKNOWN")} · STUDIO ${escapeHtml(item.studio_eligibility||"UNKNOWN")}</div></td>
<td data-label="Budget" class="budget-cell"><span class="budget-value">${escapeHtml(budget.value)}</span><span class="provenance ${budget.cls}">${escapeHtml(budget.meta)}</span></td>
<td data-label="Date">${escapeHtml(formatDate(item.published_date))}<span class="company">${escapeHtml(freshness(item.published_date))}</span></td>
<td data-label="Found">${escapeHtml(formatTimestamp(item.first_seen))}</td><td data-label="Last found">${escapeHtml(formatTimestamp(item.last_seen))}</td>
<td data-label="Outreach">${outreachMarkup(item)}</td>
<td data-label="Contact" class="${item.contact_email?"contact-yes":"contact-no"}">${escapeHtml(contactDisplay(item))}</td>
<td data-label="Status"><select class="status-select" aria-label="Status for ${escapeHtml(item.company)}" data-status-id="${escapeHtml(item.id)}">${statusOptions(item.status)}</select></td>
<td data-label="Source"><a class="source-link" href="${escapeHtml(item.source_url)}" target="_blank" rel="noreferrer">OPEN</a></td></tr>`;}).join(""); }
function bullets(items,empty){ return items?.length?`<ul>${items.map((x)=>`<li>${escapeHtml(x)}</li>`).join("")}</ul>`:`<p>${escapeHtml(empty)}</p>`; }
function evidenceMarkup(item){ return item.source_evidence?.length?`<ul class="evidence-list">${item.source_evidence.map((e)=>`<li><a href="${escapeHtml(e.url)}" target="_blank" rel="noreferrer">${escapeHtml(e.type)}</a><span>${escapeHtml(e.note)}</span></li>`).join("")}</ul>`:"<p>No source evidence recorded.</p>"; }
function historyMarkup(company){ if(!company.contact_history?.length)return"<p>Never contacted.</p>"; return`<ul class="history-list">${company.contact_history.slice(0,5).map((x)=>`<li><strong>${escapeHtml(formatTimestamp(x.sent_at))}</strong><span>${escapeHtml(x.recipient||"Recipient not recorded")}${x.subject?` · ${escapeHtml(x.subject)}`:""}</span></li>`).join("")}</ul>`; }
function replyMarkup(item){if(!item.reply_subject||!item.reply_body)return"";const to=item.reply_to||item.contact_email||"Email not publicly available";return`<div class="detail-section reply-section"><h4>GENERATED RESPONSE</h4><div class="reply-field"><span>TO</span><strong>${escapeHtml(to)}</strong></div><div class="reply-field"><span>SUBJECT</span><strong>${escapeHtml(item.reply_subject)}</strong></div><div class="reply-body">${escapeHtml(item.reply_body).replace(/\n/g,"<br>")}</div><p class="muted reply-meta">Generated ${escapeHtml(formatTimestamp(item.reply_generated_at))}${item.reply_model?` · ${escapeHtml(item.reply_model)}`:""}</p></div>`;}
function renderDetail(){ const item=state.opportunities.find((x)=>x.id===state.selectedId); if(!item){els.detail.innerHTML='<div class="detail-empty">Select an opportunity.</div>';return;} const budget=budgetView(item),company=companyStateFor(item),days=daysSince(company.last_contacted_at),recent=days!==null&&days<=30,replyLocked=state.datasetMode!=="FIXTURE"&&!state.replyEnabled; const contact=item.contact_email?`<p><strong>${escapeHtml(item.contact_email)}</strong><br><span class="muted">Public source verified.</span></p>`:'<p><strong>Email not publicly available</strong><br><span class="muted">No address will be inferred.</span></p>'; els.detail.innerHTML=`
<div class="detail-head"><div class="detail-title-row"><div><p class="eyebrow">${item.opportunity_kind==="OPEN_OPPORTUNITY"?"OPEN OPPORTUNITY":"POTENTIAL LEAD · NOT AN ACTIVE REQUEST"}</p><h3>${escapeHtml(item.title)}</h3><p class="detail-company">${escapeHtml(item.company)} · ${escapeHtml(item.location)}</p></div><button class="star-button detail-star ${item.company_bookmarked?"is-starred":""}" data-bookmark-company="${escapeHtml(item.company)}" type="button">${item.company_bookmarked?"★":"☆"}</button></div><div class="detail-tags">${kindBadge(item)}${item.categories.slice(0,5).map((x)=>`<span class="tag">${escapeHtml(x)}</span>`).join("")}</div></div>
<div class="detail-body">${recent?`<div class="repeat-warning"><strong>RECENT OUTREACH</strong><span>This company was emailed ${days===0?"today":`${days} days ago`}. Review history before sending again.</span></div>`:""}${manualVerificationRequired(item)?`<div class="manual-source-warning"><strong>MANUAL SOURCE CHECK REQUIRED</strong><span>Found through allowlisted hosted web search (${escapeHtml(item.discovery_source_id||"approved source")}). Open the original source and confirm that it is active, relevant and accepts a studio before continuing. Radar did not log in, use cookies, or directly crawl this platform.</span><div class="manual-source-actions"><a href="${escapeHtml(item.source_url)}" target="_blank" rel="noreferrer">OPEN ORIGINAL SOURCE</a><button type="button" data-verify-source="1">I CHECKED IT · MARK VERIFIED</button></div></div>`:manualVerificationComplete(item)?`<div class="manual-source-verified"><strong>SOURCE MANUALLY VERIFIED</strong><span>Checked ${escapeHtml(formatTimestamp(item.manual_verified_at))} against this exact source URL.</span></div>`:""}
<div class="score-pair"><div class="score-card"><span>FIT SCORE</span><strong>${item.fit_score}</strong><span>${bandForScore(item.fit_score)} MATCH</span></div><div class="score-card"><span>WIN SCORE</span><strong>${item.win_score}</strong><span>${item.win_band} · HEURISTIC</span></div></div>
<div class="detail-section"><h4>SOURCE STATUS</h4><p><strong>${escapeHtml(item.commercial_role||"LEGACY")} · ${escapeHtml(item.notice_status||"UNKNOWN")}</strong><br>Studio eligibility: ${escapeHtml(item.studio_eligibility||"UNKNOWN")}<br><span class="muted">${escapeHtml(item.eligibility_reason||"Legacy record; eligibility was not measured.")}</span></p></div>
<div class="detail-section"><h4>DISCOVERY HISTORY</h4><p>First found: ${escapeHtml(formatTimestamp(item.first_seen))}<br>Last found: ${escapeHtml(formatTimestamp(item.last_seen))}<br>Published: ${escapeHtml(formatDate(item.published_date))}<br>Source updated: ${escapeHtml(formatDate(item.source_updated_date))}<br>Freshness proof: ${escapeHtml(item.freshness_basis||"LEGACY / UNKNOWN")}${item.acceptance_verified_at?` · active acceptance checked ${escapeHtml(formatTimestamp(item.acceptance_verified_at))}`:""}</p><p class="muted">Saved history remains available, but only truth-gated records enter new Search results.</p></div><div class="detail-section"><h4>SUMMARY</h4><p>${escapeHtml(item.summary)}</p></div><div class="detail-section"><h4>WHY IT FITS</h4>${bullets(item.why_it_fits,"No fit rationale available.")}</div><div class="detail-section"><h4>RISKS / GAPS</h4>${bullets([...(item.risks||[]),...(item.missing_requirements||[])],"No recorded gaps.")}</div>
<div class="detail-section"><h4>BUDGET</h4><p><strong>${escapeHtml(budget.value)}</strong> · ${escapeHtml(budget.meta)}<br><span class="muted">${escapeHtml(item.budget_reason)}</span></p></div><div class="detail-section"><h4>CONTACT</h4>${contact}</div>
<div class="detail-section"><h4>COMPANY OUTREACH HISTORY</h4><p><strong>${company.contact_count||0} email${company.contact_count===1?"":"s"} recorded</strong>${company.last_contacted_at?` · last ${escapeHtml(formatTimestamp(company.last_contacted_at))}`:""}</p>${historyMarkup(company)}</div>
<div class="detail-section"><h4>SOURCE EVIDENCE</h4>${evidenceMarkup(item)}</div>
${replyMarkup(item)}<div class="detail-actions">${manualVerificationRequired(item)?'<button class="action-button" type="button" disabled>CONTACT LOCKED</button>':item.contact_email?'<button class="action-button" data-copy="email" type="button">COPY EMAIL</button>':`<a class="action-button" href="${escapeHtml(item.apply_url)}" target="_blank" rel="noreferrer">OPEN CONTACT / APPLY</a>`}<a class="action-button" href="${escapeHtml(item.source_url)}" target="_blank" rel="noreferrer">${manualVerificationRequired(item)?"OPEN SOURCE · VERIFY":"OPEN SOURCE"}</a><button class="action-button sent full" data-mark-sent="1" type="button" ${manualVerificationRequired(item)?"disabled":""}>✓ MARK EMAIL SENT</button><button class="action-button primary full" data-generate-response="1" type="button" ${manualVerificationRequired(item)||replyLocked?"disabled":""}>${replyLocked?"GENERATE RESPONSE · PAID LOCKED":item.reply_body?"REGENERATE RESPONSE":"GENERATE RESPONSE"}</button><button class="action-button" data-copy-subject="1" type="button" ${item.reply_subject&&!manualVerificationRequired(item)?"":"disabled"}>COPY SUBJECT</button><button class="action-button" data-copy-response="1" type="button" ${item.reply_body&&!manualVerificationRequired(item)?"":"disabled"}>COPY RESPONSE</button></div></div>`; }
function renderAll(){renderSummary();renderRunCounters();renderSearchDiagnostics();renderSourceRun();renderTable();renderDetail();}
function selectOpportunity(id){state.selectedId=id;renderTable();renderDetail();if(window.matchMedia("(max-width: 760px)").matches){els.detail.scrollIntoView({behavior:"smooth",block:"start"});els.detail.focus({preventScroll:true});}}
let toastTimer; function showToast(text){clearTimeout(toastTimer);els.toast.textContent=text;els.toast.classList.add("is-visible");toastTimer=setTimeout(()=>els.toast.classList.remove("is-visible"),2400);}
async function copyText(value,label){try{await navigator.clipboard.writeText(value);showToast(`${label} copied`);}catch{showToast("Clipboard unavailable");}}

async function setStatus(id,status){ const item=state.opportunities.find((x)=>x.id===id); if(!item||!STATUS_VALUES.includes(status))return; const old=item.status; item.status=status; renderAll(); try{ if(state.datasetMode==="FIXTURE"){saveFixtureStatus(id,status);showToast(`Fixture status: ${status}`);return;} if(!accessCode())throw new Error("Enter team access code first."); await api("/api/opportunity-status",{method:"POST",body:JSON.stringify({opportunity_id:id,status})}); showToast(`Shared status saved: ${status}`);}catch(error){item.status=old;renderAll();showToast(error.message);} }
async function verifySource(){const item=state.opportunities.find((x)=>x.id===state.selectedId);if(!item||!manualVerificationRequired(item))return;if(!accessCode()){showToast("Enter team access code first.");return;}const button=els.detail.querySelector("[data-verify-source]");if(button){button.disabled=true;button.textContent="SAVING VERIFICATION…";}try{const payload=await api("/api/opportunity-status",{method:"POST",body:JSON.stringify({action:"VERIFY_SOURCE",opportunity_id:item.id,source_url:item.source_url})});Object.assign(item,payload.opportunity||{});renderAll();showToast("Source verification saved for the team");}catch(error){renderDetail();showToast(error.message);}}
async function toggleBookmark(companyName){ const items=state.opportunities.filter((x)=>companyMapKey(x.company)===companyMapKey(companyName)); const next=!items.some((x)=>x.company_bookmarked); if(state.datasetMode==="FIXTURE"){ const company={...companyStateFor(items[0]),company:companyName,bookmarked:next,bookmarked_at:next?new Date().toISOString():null}; applyCompanyState(company); renderAll(); showToast(next?"Fixture company bookmarked":"Fixture bookmark removed"); return;} if(!accessCode()){showToast("Enter team access code first.");return;} try{const payload=await api("/api/company-state",{method:"POST",body:JSON.stringify({action:"SET_BOOKMARK",company:companyName,bookmarked:next})});applyCompanyState(payload.company);renderAll();showToast(next?"Company bookmarked for team":"Company bookmark removed");}catch(error){showToast(error.message);} }
async function markEmailSent(){ const item=state.opportunities.find((x)=>x.id===state.selectedId); if(!item)return;if(manualVerificationRequired(item)){showToast("Verify the original source before recording outreach.");return;} if(state.datasetMode==="FIXTURE"){const now=new Date().toISOString(),current=companyStateFor(item);const company={...current,company:item.company,last_contacted_at:now,contact_count:(current.contact_count||0)+1,contact_history:[{sent_at:now,recipient:item.contact_email||null,subject:item.reply_subject||null,opportunity_id:item.id},...(current.contact_history||[])]};applyCompanyState(company);item.status="CONTACTED";saveFixtureStatus(item.id,"CONTACTED");renderAll();showToast("Fixture outreach recorded — preview only");return;} if(!accessCode()){showToast("Enter team access code first.");return;} try{const payload=await api("/api/company-state",{method:"POST",body:JSON.stringify({action:"MARK_EMAIL_SENT",company:item.company,opportunity_id:item.id})});applyCompanyState(payload.company);Object.assign(item,payload.opportunity||{});renderAll();showToast("Email marked as sent · company history updated");}catch(error){showToast(error.message);} }
function buildFixtureReply(item){const subject=`${item.company} — realistic character production support`;const capability=item.categories.includes("WRAP_BASEMESH")?"scan cleanup, Wrap to a client-provided basemesh and downstream character preparation":"realistic human character production and scan-based asset finishing";const body=`Hello,\n\nI’m reaching out from 3D.sk regarding your ${item.title}. The scope looks closely aligned with our human-character production pipeline, particularly ${capability}. We can support either a defined part of the pipeline or a broader batch workflow, adapting the handoff to the topology and production requirements you already use.\n\nWhat stood out in your brief is the need for consistent production-ready human assets rather than isolated modeling work. That is the kind of repeatable scan/character workflow our team is set up around.\n\nIf useful, we can review a small sample of your source data and confirm the most efficient handoff point before you define the full batch or request a quotation.\n\nBest regards,\n3D.sk`;return{to:item.contact_email||null,subject,body,generated_at:new Date().toISOString(),model:"FIXTURE_PREVIEW"};}
async function generateResponse(){const item=state.opportunities.find((x)=>x.id===state.selectedId);if(!item)return;if(manualVerificationRequired(item)){showToast("Verify the original source before generating a response.");return;}if(state.datasetMode==="FIXTURE"){const reply=buildFixtureReply(item);Object.assign(item,{reply_to:reply.to,reply_subject:reply.subject,reply_body:reply.body,reply_generated_at:reply.generated_at,reply_model:reply.model});renderDetail();showToast("Fixture response generated · $0 API cost");return;}if(!state.replyEnabled){showToast("Production response generation is still paid-locked.");return;}if(!accessCode()){showToast("Enter team access code first.");return;}const button=els.detail.querySelector("[data-generate-response]");if(button){button.disabled=true;button.textContent="GENERATING…";}try{const payload=await api("/api/generate-response",{method:"POST",body:JSON.stringify({opportunity_id:item.id})});Object.assign(item,payload.opportunity||{});renderDetail();showToast("Personalized response generated");}catch(error){renderDetail();showToast(error.message);}}
function clientOperationId(prefix){return`${prefix}_${crypto.randomUUID()}`;}
function applySourceRunSnapshot(payload){state.sourceRun=payload?.run||null;state.sourceCandidates=Array.isArray(payload?.candidates)?payload.candidates:state.sourceCandidates;if(typeof payload?.collection_enabled==="boolean")state.collectionEnabled=payload.collection_enabled;renderSourceRun();}
async function loadSourceRunSnapshot(){
  if(!accessCode())return;
  try{applySourceRunSnapshot(await api("/api/source-runs"));}
  catch(error){if(error.code==="SOURCE_RUN_NOT_FOUND"){state.sourceRun=null;state.sourceCandidates=[];renderSourceRun();return;}throw error;}
}
async function sourceRunWait(milliseconds){const seconds=Math.max(1,Math.ceil(milliseconds/1000));state.sourceRunMessage=`Server cooldown · continuing in ${seconds}s. Progress is already persisted.`;renderSourceRun();await new Promise(resolve=>setTimeout(resolve,milliseconds));state.sourceRunMessage=null;}
async function runSourceCollection(){
  if(!accessCode()){showToast("Enter team access code first.");els.accessCode.focus();return;}
  if(!state.collectionEnabled){showToast("Source collection is server-locked.");return;}
  if(state.sourceRunBusy)return;
  sessionStorage.setItem(ACCESS_SESSION_KEY,accessCode());state.sourceRunBusy=true;state.sourceRunStop=false;state.sourceRunMessage=null;renderSourceRun();
  try{
    if(!state.sourceRun||isTerminalSourceRun(state.sourceRun)){
      const started=await api("/api/source-runs",{method:"POST",body:JSON.stringify({action:"START",profile_id:els.sourceRunProfile.value,request_id:clientOperationId("request")})});
      state.sourceRun=started.run;state.sourceCandidates=[];renderSourceRun();
    }
    const result=await continueSourceRunLoop({
      initialRun:state.sourceRun,
      makeOperationId:()=>clientOperationId("operation"),
      shouldStop:()=>state.sourceRunStop,
      wait:sourceRunWait,
      maxChunks:25,
      continueChunk:(runId,operationId)=>api("/api/source-runs",{method:"POST",body:JSON.stringify({action:"CONTINUE",run_id:runId,operation_id:operationId})}),
      onUpdate:async(payload)=>{state.sourceRun=payload.run;renderSourceRun();await loadSourceRunSnapshot();}
    });
    state.sourceRun=result.run;await loadSourceRunSnapshot();
    const messages={COMPLETED:"Source collection completed.",CANCELLED:"Source collection cancelled; completed work was preserved.",UNCERTAIN:"Source run stopped in UNCERTAIN state; no automatic redispatch.",RETRY_WAIT:"Sources requested a retry delay. Resume later.",UI_CHUNK_CAP_REACHED:"25 chunks completed. Progress is saved; resume when ready.",STOP_REQUESTED:"Cancel requested; completed work is preserved."};
    state.sourceRunMessage=messages[result.reason]||`Source run paused · ${result.reason}`;showToast(messages[result.reason]||"Source run progress saved");
  }catch(error){state.sourceRunMessage=`Source run paused safely · ${error.message}`;showToast(error.message);}
  finally{state.sourceRunBusy=false;renderSourceRun();}
}
async function cancelSourceCollection(){
  if(!state.sourceRun||isTerminalSourceRun(state.sourceRun)||!accessCode())return;
  state.sourceRunStop=true;state.sourceRunMessage="Cancel requested…";renderSourceRun();
  try{const payload=await api("/api/source-runs",{method:"POST",body:JSON.stringify({action:"CANCEL",run_id:state.sourceRun.run_id,operation_id:clientOperationId("cancel")})});state.sourceRun=payload.run;await loadSourceRunSnapshot();showToast("Cancel marker persisted");}
  catch(error){showToast(error.message);}
}
function applyTeamSnapshot(payload){
  state.opportunities=payload.opportunities;state.selectedId=state.opportunities[0]?.id||null;state.companies=new Map();
  for(const c of payload.companies||[])applyCompanyState(c);
  state.datasetMode="TEAM";state.lastRun=payload.last_search||null;
  els.datasetPill.textContent=`${acceptanceWorkspace?"ISOLATED TEST WORKSPACE":"Saved team results"} · ${state.opportunities.length}`;
  document.querySelector("#last-search").textContent=state.lastRun?`Last search: ${formatTimestamp(state.lastRun.completed_at)}${state.lastRun.mode==="ZERO_COST_ACCEPTANCE"?" · test data · $0":""}`:"No saved search yet";
  window.dispatchEvent(new CustomEvent("radar:search-history",{detail:state.lastRun}));
  renderAll();
}
async function loadTeamState(){
  if(!accessCode()){showToast("Enter team access code first.");els.accessCode.focus();return;}
  sessionStorage.setItem(ACCESS_SESSION_KEY,accessCode());els.connect.disabled=true;
  try{applyTeamSnapshot(await api("/api/opportunities"));await loadSourceRunSnapshot();els.scanNote.textContent="Saved results loaded. Reloading this page does not start a paid search.";}
  catch(error){showToast(error.message);els.scanNote.textContent=`Saved results could not be loaded: ${error.message}`;}
  finally{els.connect.disabled=false;}
}
async function runLiveSearch(){ if(!state.searchEnabled){showToast("Production search is still paid-locked.");return;}if(!accessCode()){showToast("Enter team access code first.");return;} sessionStorage.setItem(ACCESS_SESSION_KEY,accessCode()); const old=els.find.textContent;els.find.disabled=true;els.find.textContent="SEARCHING…";try{const payload=await api("/api/search",{method:"POST",body:"{}"});state.opportunities=payload.opportunities;state.datasetMode="TEAM";state.lastRun=payload.run;await loadTeamState();els.scanNote.textContent=payload.replayed?`Today's UTC search already completed · saved result loaded · $0 new cost`:`Live search complete · ${payload.run.returned_count} records`;showToast(payload.replayed?"Today's search loaded without a second charge":"Live search complete");}catch(error){els.scanNote.textContent=`Search not run · ${error.message}`;showToast(error.message);}finally{els.find.disabled=!state.searchEnabled;els.find.textContent=old;} }

els.body.addEventListener("click",(event)=>{const star=event.target.closest("[data-bookmark-company]");if(star){event.stopPropagation();toggleBookmark(star.dataset.bookmarkCompany);return;}if(event.target.closest("select,a,button,input"))return;const row=event.target.closest("tr[data-id]");if(row)selectOpportunity(row.dataset.id);});
els.body.addEventListener("change",(event)=>{if(event.target.matches(".status-select"))setStatus(event.target.dataset.statusId,event.target.value);if(event.target.matches(".select-radio"))selectOpportunity(event.target.closest("tr").dataset.id);});
els.detail.addEventListener("click",(event)=>{const star=event.target.closest("[data-bookmark-company]");if(star){toggleBookmark(star.dataset.bookmarkCompany);return;}const item=state.opportunities.find((x)=>x.id===state.selectedId);if(event.target.dataset.copy==="email"&&item?.contact_email)copyText(item.contact_email,"Email");if(event.target.dataset.copySubject&&item?.reply_subject)copyText(item.reply_subject,"Subject");if(event.target.dataset.copyResponse&&item?.reply_body)copyText(item.reply_body,"Response");if(event.target.dataset.verifySource)verifySource();if(event.target.dataset.markSent)markEmailSent();if(event.target.dataset.generateResponse)generateResponse();});
document.querySelectorAll("[data-view]").forEach((button)=>button.addEventListener("click",()=>{document.querySelectorAll("[data-view]").forEach((x)=>x.classList.remove("is-active"));button.classList.add("is-active");state.view=button.dataset.view;renderTable();}));
els.statusFilter.addEventListener("change",()=>{state.status=els.statusFilter.value;renderTable();}); els.fitFilter.addEventListener("change",()=>{state.minFit=Number(els.fitFilter.value);renderTable();}); els.connect.addEventListener("click",loadTeamState);els.find.addEventListener("click",runLiveSearch);els.sourceRunButton.addEventListener("click",runSourceCollection);els.sourceRunCancel.addEventListener("click",cancelSourceCollection);


const sortSelect=document.querySelector("#sort-select"), sortDirection=document.querySelector("#sort-direction"), categoryOptions=document.querySelector("#category-options");
sortSelect.innerHTML=Object.entries(SORTS).map(([key,label])=>`<option value="${key}">${label}</option>`).join("");
categoryOptions.innerHTML=Object.entries(CATEGORIES).map(([key,label])=>`<label class="category-choice"><input type="checkbox" value="${key}"><span>${label}</span></label>`).join("");
function renderSort(){
  sortSelect.value=state.sortKey;
  sortDirection.textContent=state.sortDirection==="desc"?"↓ Descending":"↑ Ascending";
  document.querySelectorAll("[data-sort]").forEach(button=>{
    const active=button.dataset.sort===state.sortKey;
    button.closest("th").setAttribute("aria-sort",active?(state.sortDirection==="asc"?"ascending":"descending"):"none");
    button.querySelector("span").textContent=active?(state.sortDirection==="asc"?" ↑":" ↓"):" ↕";
  });
}
document.querySelectorAll("[data-sort]").forEach(button=>button.addEventListener("click",()=>{
  const key=button.dataset.sort;
  state.sortDirection=state.sortKey===key?(state.sortDirection==="asc"?"desc":"asc"):["fit_score","win_score","published_date","company_last_contacted_at","company_bookmarked"].includes(key)?"desc":"asc";
  state.sortKey=key;renderTable();
}));
sortSelect.addEventListener("change",()=>{state.sortKey=sortSelect.value;renderTable();});
sortDirection.addEventListener("click",()=>{state.sortDirection=state.sortDirection==="asc"?"desc":"asc";renderTable();});
function updateCategories(){
  state.categories=[...categoryOptions.querySelectorAll("input:checked")].map(input=>input.value);
  document.querySelector("#category-count").textContent=state.categories.length?`${state.categories.length} selected · match any`:"All categories";
  renderTable();
}
categoryOptions.addEventListener("change",updateCategories);
document.querySelector("#clear-categories").addEventListener("click",()=>{categoryOptions.querySelectorAll("input").forEach(input=>input.checked=false);updateCategories();});

async function loadDemo(){
  const response=await fetch("/fixtures/opportunities.json");
  if(!response.ok)throw new Error("Demo could not be loaded.");
  state.opportunities=hydrateFixtureStatuses(await response.json());state.companies=new Map();state.datasetMode="FIXTURE";state.lastRun=null;
  state.selectedId=state.opportunities[0]?.id||null;els.datasetPill.textContent="DEMO · not saved to team";
  document.querySelector("#last-search").textContent="Demo data · no paid search";
  window.dispatchEvent(new CustomEvent("radar:search-history",{detail:null}));renderAll();
}
document.querySelector("#demo-button").addEventListener("click",()=>loadDemo().catch(e=>showToast(e.message)));
document.querySelector("#signout-button").addEventListener("click",()=>{sessionStorage.removeItem(ACCESS_SESSION_KEY);els.accessCode.value="";state.opportunities=[];state.companies=new Map();state.datasetMode="DISCONNECTED";state.selectedId=null;state.sourceRun=null;state.sourceCandidates=[];state.sourceRunStop=true;state.sourceRunMessage=null;els.datasetPill.textContent="Team access required";document.querySelector("#last-search").textContent="Connect to view saved search history";window.dispatchEvent(new CustomEvent("radar:search-history",{detail:null}));renderAll();});
document.querySelector("#seed-test-button").addEventListener("click",async()=>{try{applyTeamSnapshot(await api("/api/prelive-workspace",{method:"POST",body:"{}"}));showToast("Isolated shared test data loaded · $0");}catch(e){showToast(e.message);}});
document.querySelector("#check-locks-button").addEventListener("click",async()=>{
  const output=document.querySelector("#system-check-result");
  try{
    const health=await (await fetch("/api/health")).json();
    if(health.paid_ai_state!=="LOCKED")throw new Error("Live AI is not locked. No POST checks were attempted.");
    if(!accessCode()){output.textContent=JSON.stringify({health,message:"Enter team access code to check protected endpoints."},null,2);return;}
    const checks=[];
    for(const path of ["/api/search","/api/generate-response"]){
      const response=await fetch(path,{method:"POST",headers:authHeaders(),body:"{}"});const payload=await response.json();
      checks.push({path,status:response.status,code:payload.error?.code});
    }
    if(health.source_collection==="LOCKED"){
      const response=await fetch("/api/source-runs",{method:"POST",headers:authHeaders(),body:JSON.stringify({action:"START",profile_id:"FOCUSED",request_id:"prelive_lock_check"})});const payload=await response.json();
      checks.push({path:"/api/source-runs",status:response.status,code:payload.error?.code});
    }
    const paidChecks=checks.filter(c=>c.path!=="/api/source-runs");const sourceChecks=checks.filter(c=>c.path==="/api/source-runs");
    const passed=health.access_configured&&paidChecks.every(c=>c.status===423&&c.code==="LIVE_AI_LOCKED")&&sourceChecks.every(c=>c.status===423&&c.code==="SOURCE_COLLECTION_LOCKED");
    output.textContent=JSON.stringify({passed,health,checks},null,2);
  }catch(e){output.textContent=e.message;}
});
async function init(){
  els.accessCode.value=sessionStorage.getItem(ACCESS_SESSION_KEY)||"";
  renderAll();
  document.querySelector("#prelive-tools").hidden=!acceptanceWorkspace;
  try{const h=await(await fetch("/api/health")).json();state.collectionEnabled=h.source_collection==="ENABLED";state.searchEnabled=h.production_search==="READY";state.searchProfile=h.production_search_profile||null;state.replyEnabled=h.production_reply==="READY";document.querySelector("#ai-state").textContent=state.searchEnabled?`${state.searchProfile==="WIDE_INDEX"?"Worldwide wide search":"Production search"} ready · one paid run per UTC day`:h.paid_ai_state==="LOCKED"?"Live AI locked until final acceptance":"Live AI enabled · production search locked";els.find.disabled=!state.searchEnabled;els.find.textContent=state.searchEnabled?(state.searchProfile==="WIDE_INDEX"?"FIND WORLDWIDE OPPORTUNITIES":"FIND NEW OPPORTUNITIES"):"FIND NEW OPPORTUNITIES · PAID LOCKED";renderSourceRun();renderDetail();}catch{document.querySelector("#ai-state").textContent="Server status unavailable";}
  if(els.accessCode.value)await loadTeamState();
  else if(new URLSearchParams(location.search).get("demo")==="1")await loadDemo();
}
init();
