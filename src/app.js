import { CATEGORIES, SORTS, visibleRejectedResults, visibleResults } from "./lib/result-view.mjs";
import { searchFootprint } from "./lib/search-footprint.mjs";
import { bandForScore, contactDisplay, STATUS_VALUES } from "./lib/domain.mjs";
import { continueSourceRunLoop, isTerminalSourceRun, sourceCandidateView, sourceRunProgress } from "./lib/source-run-view.mjs";
import { continueUltraMaxLoop, isUltraMaxTerminal, ultraNativePhase, ultraNativeProgress } from "./lib/ultra-max-view.mjs";
import { isSalesOpportunityRecord, recordKindOf } from "./server/record-classification.mjs";

const acceptanceWorkspace = new URLSearchParams(location.search).get("workspace") === "acceptance";
const STATUS_STORAGE_KEY = "3dsk-radar-fixture-status-v2";
const ACCESS_SESSION_KEY = "3dsk-radar-access-v2";
const state = { opportunities:[], rejectedCandidates:[], companies:new Map(), selectedId:null, view:"ALL", status:"ALL", minFit:0, datasetMode:"DISCONNECTED", lastRun:null, categories:[], sortKey:"win_score", sortDirection:"desc", sourceRun:null, sourceCandidates:[], sourceRunBusy:false, sourceRunStop:false, sourceRunMessage:null, collectionEnabled:false, ultraRun:null, ultraNextOperation:null, ultraBusy:false, ultraStop:false, ultraMessage:null, ultraEnabled:false, ultraPaidEnabled:false, searchEnabled:false, searchProfile:null, replyEnabled:false };
const ULTRA_PAID_CONFIRMATION="RUN_ULTRA_MAX_15_USD_NO_RETRY";
const els = {
  body:document.querySelector("#opportunity-body"), detail:document.querySelector("#detail-panel"), summary:document.querySelector("#summary-grid"), count:document.querySelector("#result-count"),
  find:document.querySelector("#find-button"), connect:document.querySelector("#connect-button"), scanNote:document.querySelector("#scan-note"), statusFilter:document.querySelector("#status-filter"), fitFilter:document.querySelector("#fit-filter"),
  toast:document.querySelector("#toast"), accessCode:document.querySelector("#access-code"), datasetPill:document.querySelector("#dataset-pill"),
  runCounters:document.querySelector("#run-counters"), runCounterGrid:document.querySelector("#run-counter-grid"), runCounterMode:document.querySelector("#run-counter-mode"),
  searchDiagnostics:document.querySelector("#search-diagnostics"), searchCoverageGrid:document.querySelector("#search-coverage-grid"), sourceYieldGrid:document.querySelector("#source-yield-grid"), searchDiagnosticState:document.querySelector("#search-diagnostic-state"), searchDiagnosticSummary:document.querySelector("#search-diagnostic-summary"), searchRejectionSummary:document.querySelector("#search-rejection-summary"),
  sourceRunPanel:document.querySelector("#source-run-panel"), sourceRunStatus:document.querySelector("#source-run-status"), sourceRunProgress:document.querySelector("#source-run-progress"), sourceRunCandidates:document.querySelector("#source-run-candidates"), sourceRunButton:document.querySelector("#source-run-button"), sourceRunCancel:document.querySelector("#source-run-cancel"), sourceRunProfile:document.querySelector("#source-run-profile"), sourceRunNote:document.querySelector("#source-run-note"),
  ultraMaxStatus:document.querySelector("#ultra-max-status"), ultraMaxProgress:document.querySelector("#ultra-max-progress"), ultraMaxButton:document.querySelector("#ultra-max-button"), ultraMaxCancel:document.querySelector("#ultra-max-cancel"), ultraMaxNote:document.querySelector("#ultra-max-note")
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

function filtered(){ return state.view==="REJECTED"?visibleRejectedResults(state.rejectedCandidates,state):visibleResults(state.opportunities,state); }
function selectedRecord(){return state.view==="REJECTED"?state.rejectedCandidates.find((item)=>item.id===state.selectedId):state.opportunities.find((item)=>item.id===state.selectedId);}
function formatDate(value){ if(!value)return"Date unknown"; const date=new Date(`${value}T00:00:00Z`); return Number.isNaN(date.getTime())?"Date unknown":new Intl.DateTimeFormat("en",{month:"short",day:"numeric",year:"numeric"}).format(date); }
function formatTimestamp(value){ if(!value)return"Never"; const date=new Date(value); return Number.isNaN(date.getTime())?"Unknown":new Intl.DateTimeFormat("en",{month:"short",day:"numeric",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(date); }
function daysSince(value){ if(!value)return null; const ts=new Date(value).getTime(); return Number.isFinite(ts)?Math.max(0,Math.floor((Date.now()-ts)/86400000)):null; }
function freshness(value){ const days=value?daysSince(`${value}T00:00:00Z`):null; if(days===null)return"date unknown"; if(days===0)return"today"; if(days===1)return"1 day ago"; return`${days} days ago`; }
function budgetView(item){ if(item.budget_type==="PUBLISHED")return{value:item.budget_published,meta:"PUBLISHED",cls:"published"}; if(item.budget_type==="ESTIMATED")return{value:`${item.budget_currency||""} ${Number(item.budget_estimated_min).toLocaleString("en-US")}–${Number(item.budget_estimated_max).toLocaleString("en-US")}`,meta:`ESTIMATED · ${item.budget_confidence||"unknown"} confidence`,cls:"estimated"}; return{value:"Budget unknown",meta:"UNKNOWN",cls:"unknown"}; }
function isFundingLead(item){ return item.opportunity_kind==="POTENTIAL_LEAD"&&item.categories?.includes("HERITAGE_FUNDING_PARTNERSHIP"); }
function engagementTrack(item){return item.engagement_track||"B2B_STUDIO";}
function trackLabel(item){return engagementTrack(item)==="INDIVIDUAL_FREELANCE"?"INDIVIDUAL":"B2B";}
function kindBadge(item){ if(recordKindOf(item)==="COMPETITOR")return'<span class="kind-badge competitor">COMPETITOR</span>'; const open=item.opportunity_kind==="OPEN_OPPORTUNITY"; const funding=isFundingLead(item); return`<span class="kind-badge ${open?"open":funding?"funding":"lead"}">${open?"OPEN OPPORTUNITY":funding?"FUNDING / PARTNERSHIP":"POTENTIAL LEAD"}</span><span class="kind-badge">${trackLabel(item)}</span>`; }
function manualVerificationRequired(item){ return isSalesOpportunityRecord(item)&&item.manual_verification_status==="REQUIRED_BEFORE_CONTACT"; }
function manualVerificationComplete(item){ return isSalesOpportunityRecord(item)&&item.manual_verification_status==="VERIFIED_BEFORE_CONTACT"&&Boolean(item.manual_verified_at)&&item.manual_verified_source_url===item.source_url; }
function scoreMarkup(label,score){ const band=bandForScore(score); return`<span class="score ${band.toLowerCase()}"><strong>${score}</strong><small>${escapeHtml(label)} · ${band}</small></span>`; }
function statusOptions(selected){ return STATUS_VALUES.map((s)=>`<option value="${s}" ${s===selected?"selected":""}>${s}</option>`).join(""); }
function outreachMarkup(item){ const company=companyStateFor(item); if(!company.last_contacted_at)return'<span class="outreach none">NOT EMAILED</span>'; const days=daysSince(company.last_contacted_at); const recent=days!==null&&days<=30; return`<span class="outreach ${recent?"recent":"past"}">EMAILED ${days===0?"TODAY":`${days}D AGO`}</span><span class="company">${company.contact_count||1}× total</span>`; }

function renderSummary(){ const all=state.opportunities,sales=all.filter(isSalesOpportunityRecord),competitors=all.filter((item)=>recordKindOf(item)==="COMPETITOR"); const b2b=sales.filter((item)=>engagementTrack(item)==="B2B_STUDIO"),individual=sales.filter((item)=>engagementTrack(item)==="INDIVIDUAL_FREELANCE"); const bookmarked=new Set(sales.filter((x)=>x.company_bookmarked).map((x)=>companyMapKey(x.company))).size; const contacted=new Set(sales.filter((x)=>x.company_last_contacted_at).map((x)=>companyMapKey(x.company))).size; const cards=[["OPPORTUNITIES",sales.length,state.datasetMode.toLowerCase()],["B2B",b2b.length,"studio / vendor"],["INDIVIDUAL",individual.length,"freelance projects"],["REJECTED",state.rejectedCandidates.length,"manual review only"],["BOOKMARKED",bookmarked,"buyer companies"],["EMAILED",contacted,"buyer companies"],["HIGH FIT",sales.filter((x)=>x.fit_score>=80).length,"sales FIT 80+"],["COMPETITORS",competitors.length,"intelligence only"]]; els.summary.innerHTML=cards.map(([l,v,s])=>`<article class="summary-card"><span class="label">${escapeHtml(l)}</span><strong class="value">${escapeHtml(v)}</strong><span class="sub">${escapeHtml(s)}</span></article>`).join(""); }
function renderRunCounters(){ const counters=state.lastRun?.counters; if(!counters){els.runCounters.hidden=true;els.runCounterGrid.innerHTML="";return;} const value=(number)=>Number.isFinite(number)?number:"—"; const cards=[["SOURCE URLS",counters.source_urls_verified,"verified originals"],["CANDIDATES",counters.candidates_seen,"seen"],["SALES VERIFIED",counters.candidates_verified,"after truth gates"],["COMPETITORS",counters.competitors_classified,"intelligence only"],["SOURCE PLATFORMS",counters.source_platforms_classified,"diagnostics only"],["REJECTED",counters.candidates_rejected,"with reason"],["DUPLICATES",counters.duplicates_removed,"sales removed"],["NEW",counters.new_opportunities,"sales first seen"],["UPDATED",counters.updated_opportunities,"known sales"],["SALES WORKSPACE",counters.workspace_total,"saved sales total"]]; els.runCounterMode.textContent=counters.collector_mode||"UNKNOWN MODE";els.runCounterGrid.innerHTML=cards.map(([label,number,note])=>`<article class="run-counter"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value(number))}</strong><small>${escapeHtml(note)}</small></article>`).join("");els.runCounters.hidden=false; }
function diagnosticReasonLabel(code){return({unverified_source_url:"source URL not verified",source_not_allowed_for_index_discovery:"URL was not an allowed opportunity detail",missing_core_identity:"missing title, company or summary",invalid_opportunity_kind:"invalid opportunity type",partner_without_buyer_signal:"partner label lacked a current subcontract/vendor signal",unknown_commercial_role:"buyer role not established",inactive_notice:"closed, awarded or cancelled",engagement_track_unproven:"B2B / individual track not proven",studio_ineligible:"studio/vendor not eligible",studio_eligibility_unproven:"studio/vendor eligibility not proven",individual_buyer_unproven:"individual task is not a proven buyer request",individual_contractor_ineligible:"independent specialist is not eligible",individual_eligibility_unproven:"independent-specialist eligibility not proven",out_of_scope:"outside 3D.SK scope",stale_or_unverified:"older than 30 days without active proof",excluded_search_category:"excluded Visual / AI / Motion-only work",excluded_workflow:"excluded Reallusion / Character Creator / iClone / Daz3D workflow",individual_employment:"employee role, not a freelance project",heritage_capture_outside_cz_sk:"physical heritage capture outside CZ/SK",normalized_contract:"normalized data contract failed",other_validation_failure:"other validation failure"})[code]||code;}
function renderSearchDiagnostics(){
  const diagnostics=state.lastRun?.diagnostics;
  if(!diagnostics||!Array.isArray(diagnostics.source_yield)){els.searchDiagnostics.hidden=true;els.searchCoverageGrid.innerHTML="";els.sourceYieldGrid.innerHTML="";return;}
  const totals=diagnostics.source_yield.reduce((sum,item)=>({consulted:sum.consulted+Number(item.consulted_urls||0),details:sum.details+Number(item.eligible_detail_urls||0),seen:sum.seen+Number(item.candidates_seen||0),rejected:sum.rejected+Number(item.candidates_rejected||0),competitors:sum.competitors+Number(item.competitors_detected||0),platforms:sum.platforms+Number(item.source_platforms_detected||0),returned:sum.returned+Number(item.returned||0)}),{consulted:0,details:0,seen:0,rejected:0,competitors:0,platforms:0,returned:0});
  const coverage=Array.isArray(state.lastRun?.coverage)?state.lastRun.coverage:[];
  els.searchCoverageGrid.innerHTML=coverage.map((item)=>`<article class="run-counter coverage-${escapeHtml(String(item.status||"unknown").toLowerCase())}"><span>${escapeHtml(item.shard_label)}</span><strong>${escapeHtml(item.status)}</strong><small>${escapeHtml(item.consulted_urls)} consulted URLs · ${escapeHtml(item.web_search_calls)} web searches · ${escapeHtml(item.allowed_domain_count)} allowed domains${item.error_code?` · ${escapeHtml(item.error_code)}`:""}</small></article>`).join("");
  const activeSources=diagnostics.source_yield.filter((item)=>Number(item.consulted_urls||0)||Number(item.candidates_seen||0)||Number(item.returned||0));
  els.sourceYieldGrid.innerHTML=activeSources.map((item)=>`<article class="run-counter"><span>${escapeHtml(item.source_label)}</span><strong>${escapeHtml(item.returned)} sales returned</strong><small>${escapeHtml(item.consulted_urls)} consulted · ${escapeHtml(item.candidates_seen)} candidates · ${escapeHtml(item.competitors_detected||0)} competitors · ${escapeHtml(item.source_platforms_detected||0)} platforms · ${escapeHtml(item.candidates_rejected)} rejected</small></article>`).join("");
  const zeroMessages={NO_STRUCTURED_CANDIDATES:`ZERO RESULT · Hosted search consulted ${totals.consulted} allowlisted URLs (${totals.details} valid detail URLs), but produced no structured candidates.`,ALL_CANDIDATES_REJECTED:`ZERO RESULT · ${totals.seen} structured candidates were evaluated and all ${totals.rejected} failed a truth or relevance gate.`,NO_SALES_RECORDS_AFTER_CLASSIFICATION:`ZERO SALES RESULT · ${totals.competitors} competitors and ${totals.platforms} source platforms were classified outside the sales list.`,ALL_ACCEPTED_CANDIDATES_DEDUPLICATED:"ZERO RESULT · every accepted sales candidate was already present after deduplication."};
  els.searchDiagnosticState.textContent=totals.returned?`${totals.returned} RETURNED`:"ZERO RESULT";
  els.searchDiagnosticSummary.textContent=zeroMessages[diagnostics.zero_result_reason]||`${totals.returned} sales opportunities returned from ${totals.consulted} consulted URLs · ${totals.competitors} competitors · ${totals.platforms} source platforms.`;
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
function renderUltraMax(){
  const run=state.ultraRun,progress=ultraNativeProgress(run),native=ultraNativePhase(run),terminal=isUltraMaxTerminal(run),active=Boolean(run&&!terminal),phase=run?.plan_snapshot?.phases?.find((item)=>item.phase_id===(run.current_phase_id||state.ultraNextOperation?.phase_id))||native;
  const available=state.ultraEnabled||(active&&state.ultraPaidEnabled),status=!available?"LOCKED":phase?.status||run?.status||"READY";
  els.ultraMaxStatus.textContent=status;
  els.ultraMaxStatus.dataset.state=status;
  els.ultraMaxProgress.innerHTML=[progressCard("NATIVE CHUNKS",progress.chunks),progressCard("SOURCE REQUESTS",progress.sourceRequests),progressCard("CANDIDATES",progress.candidates),progressCard("ACCEPTED",progress.accepted)].join("");
  els.ultraMaxButton.disabled=state.ultraBusy||!available;
  els.ultraMaxButton.textContent=state.ultraBusy?"RUNNING ULTRA MAX…":active?"RESUME ULTRA MAX":state.ultraPaidEnabled?"RUN ULTRA MAX · UP TO $15":"RUN ULTRA MAX · NATIVE";
  els.ultraMaxCancel.disabled=!run||terminal;
  els.ultraMaxNote.textContent=state.ultraMessage||(!available?"ULTRA MAX is server-locked. The browser cannot enable sources, paid phases or environment settings.":run?`Root ${run.run_id} · ${phase?.phase_id||"complete"} ${phase?.status||run.status} · ${run.usage?.openai_requests||0}/100 OpenAI · ${run.usage?.web_search_calls||0}/300 web · $${((run.usage?.cost_microusd||0)/1_000_000).toFixed(4)}/$15 cap.`:state.ultraPaidEnabled?"One click runs seven persisted phases through background execution. Every paid phase is no-retry and the exact source is reverified before persistence.":"One click completes native collection and pauses before independently locked paid phases.");
}
function reviewStatusOptions(selected){return ["PENDING","KEEP","DISMISSED"].map((status)=>`<option value="${status}" ${status===selected?"selected":""}>${status}</option>`).join("");}
function renderRejectedTable(items){
  document.querySelector("#results-title").textContent="Rejected candidates · manual review";
  els.count.textContent=`${items.length} rejected candidates · review only · outreach locked`;
  if(!items.length){els.body.innerHTML='<tr class="empty-row"><td colspan="15">No candidate-level rejection records are available. The 15 pre-truth rejections from the last production run were not persisted by the previous schema.</td></tr>';return;}
  els.body.innerHTML=items.map((item)=>`<tr data-id="${escapeHtml(item.id)}" class="rejected-row ${item.id===state.selectedId?"is-selected":""}">
<td data-label="Select"><input class="select-radio" type="radio" name="selected-opportunity" aria-label="Select ${escapeHtml(item.title)}" ${item.id===state.selectedId?"checked":""}></td>
<td data-label="Bookmark">—</td><td data-label="Fit">${scoreMarkup("RAW FIT",item.fit_score||0)}</td><td data-label="Win">${scoreMarkup("RAW WIN",item.win_score||0)}</td>
<td data-label="Opportunity"><span class="opportunity-title">${escapeHtml(item.title)}</span><span class="manual-verify-badge">REJECTED</span></td>
<td data-label="Company"><span class="company-name">${escapeHtml(item.company||"Buyer not established")}</span></td>
<td data-label="Type"><span class="kind-badge rejected">${escapeHtml(diagnosticReasonLabel(item.rejection_reason))}</span><div class="minor-line">${escapeHtml(item.rejection_stage||"UNKNOWN STAGE")} · ${escapeHtml(item.engagement_track||"UNKNOWN TRACK")}</div></td>
<td data-label="Budget"><span class="budget-value">Not verified</span><span class="provenance unknown">REVIEW ONLY</span></td>
<td data-label="Date">${escapeHtml(formatDate(item.published_date))}</td><td data-label="Found">${escapeHtml(formatTimestamp(item.first_seen))}</td><td data-label="Last found">${escapeHtml(formatTimestamp(item.last_seen))}</td>
<td data-label="Outreach"><span class="outreach none">LOCKED</span></td><td data-label="Contact">NOT RETAINED</td>
<td data-label="Status"><select class="rejected-status-select" aria-label="Review status for ${escapeHtml(item.title)}" data-rejected-status-id="${escapeHtml(item.id)}">${reviewStatusOptions(item.review_status||"PENDING")}</select></td>
<td data-label="Source">${item.source_url?`<a class="source-link" href="${escapeHtml(item.source_url)}" target="_blank" rel="noreferrer">OPEN</a>`:'<span class="company">UNVERIFIED URL</span>'}</td></tr>`).join("");
}
function renderTable(){ const items=filtered(),salesTotal=state.opportunities.filter(isSalesOpportunityRecord).length,competitorTotal=state.opportunities.filter((item)=>recordKindOf(item)==="COMPETITOR").length; if(!items.some(x=>x.id===state.selectedId))state.selectedId=items[0]?.id||null; renderSort(); renderDetail(); if(state.view==="REJECTED"){renderRejectedTable(items);return;} document.querySelector("#results-title").textContent="Sales opportunities & competitor intelligence"; els.count.textContent=`${items.length} shown · ${salesTotal} sales · ${competitorTotal} competitors`; if(!items.length){els.body.innerHTML=`<tr class="empty-row"><td colspan="15">${state.datasetMode==="DISCONNECTED"?"Enter your team access code to load saved opportunities.":state.opportunities.length?"No records match these filters. Clear categories or adjust Status and Minimum fit.":"No saved opportunities yet. New searches will be saved here."}</td></tr>`;return;} els.body.innerHTML=items.map((item)=>{const budget=budgetView(item),sales=isSalesOpportunityRecord(item);return`<tr data-id="${escapeHtml(item.id)}" class="${item.id===state.selectedId?"is-selected":""}">
<td data-label="Select"><input class="select-radio" type="radio" name="selected-opportunity" aria-label="Select ${escapeHtml(item.title)}" ${item.id===state.selectedId?"checked":""}></td>
<td data-label="Bookmark"><button class="star-button ${item.company_bookmarked?"is-starred":""}" data-bookmark-company="${escapeHtml(item.company)}" type="button" title="${item.company_bookmarked?"Remove company bookmark":"Bookmark company"}">${item.company_bookmarked?"★":"☆"}</button></td>
<td data-label="Fit">${scoreMarkup(sales?"FIT":"OVERLAP",item.fit_score)}</td><td data-label="Win">${sales?scoreMarkup("WIN",item.win_score):'<span class="company">N/A · intelligence</span>'}</td>
<td data-label="Opportunity"><span class="opportunity-title">${escapeHtml(item.title)}</span></td>
<td data-label="Company"><span class="company-name">${escapeHtml(item.company)}</span>${item.company_bookmarked?'<span class="bookmarked-label">BOOKMARKED</span>':""}</td>
<td data-label="Type">${kindBadge(item)}${manualVerificationRequired(item)?'<span class="manual-verify-badge">VERIFY SOURCE</span>':manualVerificationComplete(item)?'<span class="manual-verify-badge verified">SOURCE VERIFIED</span>':""}<div class="minor-line">${item.categories.map(x=>escapeHtml(CATEGORIES[x]||x)).join(" · ")}</div><div class="minor-line">${escapeHtml(item.commercial_role||"LEGACY")} · ${escapeHtml(item.notice_status||"UNKNOWN")} · ${escapeHtml(trackLabel(item))} ${escapeHtml(engagementTrack(item)==="INDIVIDUAL_FREELANCE"?(item.individual_eligibility||"UNKNOWN"):(item.studio_eligibility||"UNKNOWN"))}</div></td>
<td data-label="Budget" class="budget-cell">${sales?`<span class="budget-value">${escapeHtml(budget.value)}</span><span class="provenance ${budget.cls}">${escapeHtml(budget.meta)}</span>`:'<span class="budget-value">Not applicable</span><span class="provenance unknown">INTELLIGENCE</span>'}</td>
<td data-label="Date">${escapeHtml(formatDate(item.published_date))}<span class="company">${escapeHtml(freshness(item.published_date))}</span></td>
<td data-label="Found">${escapeHtml(formatTimestamp(item.first_seen))}</td><td data-label="Last found">${escapeHtml(formatTimestamp(item.last_seen))}</td>
<td data-label="Outreach">${sales?outreachMarkup(item):'<span class="outreach none">INTELLIGENCE ONLY</span>'}</td>
<td data-label="Contact" class="${sales&&item.contact_email?"contact-yes":"contact-no"}">${sales?escapeHtml(contactDisplay(item)):"OUTREACH LOCKED"}</td>
<td data-label="Status"><select class="status-select" aria-label="Status for ${escapeHtml(item.company)}" data-status-id="${escapeHtml(item.id)}">${statusOptions(item.status)}</select></td>
<td data-label="Source"><a class="source-link" href="${escapeHtml(item.source_url)}" target="_blank" rel="noreferrer">OPEN</a></td></tr>`;}).join(""); }
function bullets(items,empty){ return items?.length?`<ul>${items.map((x)=>`<li>${escapeHtml(x)}</li>`).join("")}</ul>`:`<p>${escapeHtml(empty)}</p>`; }
function evidenceMarkup(item){ return item.source_evidence?.length?`<ul class="evidence-list">${item.source_evidence.map((e)=>`<li><a href="${escapeHtml(e.url)}" target="_blank" rel="noreferrer">${escapeHtml(e.type)}</a><span>${escapeHtml(e.note)}</span></li>`).join("")}</ul>`:"<p>No source evidence recorded.</p>"; }
function historyMarkup(company){ if(!company.contact_history?.length)return"<p>Never contacted.</p>"; return`<ul class="history-list">${company.contact_history.slice(0,5).map((x)=>`<li><strong>${escapeHtml(formatTimestamp(x.sent_at))}</strong><span>${escapeHtml(x.recipient||"Recipient not recorded")}${x.subject?` · ${escapeHtml(x.subject)}`:""}</span></li>`).join("")}</ul>`; }
function replyMarkup(item){if(!item.reply_subject||!item.reply_body)return"";const to=item.reply_to||item.contact_email||"Email not publicly available";return`<div class="detail-section reply-section"><h4>GENERATED RESPONSE</h4><div class="reply-field"><span>TO</span><strong>${escapeHtml(to)}</strong></div><div class="reply-field"><span>SUBJECT</span><strong>${escapeHtml(item.reply_subject)}</strong></div><div class="reply-body">${escapeHtml(item.reply_body).replace(/\n/g,"<br>")}</div><p class="muted reply-meta">Generated ${escapeHtml(formatTimestamp(item.reply_generated_at))}${item.reply_model?` · ${escapeHtml(item.reply_model)}`:""}</p></div>`;}
function renderIntelligenceDetail(item){const historyCount=Array.isArray(item.classification_history)?item.classification_history.length:0;els.detail.innerHTML=`
<div class="detail-head"><div class="detail-title-row"><div><p class="eyebrow">COMPETITOR INTELLIGENCE · NOT A SALES LEAD</p><h3>${escapeHtml(item.title)}</h3><p class="detail-company">${escapeHtml(item.company)} · ${escapeHtml(item.location)}</p></div><button class="star-button detail-star ${item.company_bookmarked?"is-starred":""}" data-bookmark-company="${escapeHtml(item.company)}" type="button">${item.company_bookmarked?"★":"☆"}</button></div><div class="detail-tags">${kindBadge(item)}${item.categories.slice(0,5).map((x)=>`<span class="tag">${escapeHtml(x)}</span>`).join("")}</div></div>
<div class="detail-body"><div class="intelligence-lock"><strong>ALL SALES ACTIONS LOCKED</strong><span>This record describes a seller/service provider. It is excluded from Opportunities, buyer-company and High Fit totals. Contact, Generate Response and MARK EMAIL SENT remain disabled.</span></div>
<div class="score-pair"><div class="score-card"><span>CAPABILITY OVERLAP</span><strong>${item.fit_score}</strong><span>INTELLIGENCE ONLY</span></div><div class="score-card"><span>SALES WIN SCORE</span><strong>—</strong><span>NOT APPLICABLE</span></div></div>
<div class="detail-section"><h4>CLASSIFICATION</h4><p><strong>${escapeHtml(item.record_kind_reason||"COMPETITOR")}</strong><br>Commercial role: ${escapeHtml(item.commercial_role||"SELLER")}<br>Classified: ${escapeHtml(formatTimestamp(item.classified_at))}<br><span class="muted">${historyCount} classification history event${historyCount===1?"":"s"} retained.</span></p></div>
<div class="detail-section"><h4>SUMMARY</h4><p>${escapeHtml(item.summary)}</p></div><div class="detail-section"><h4>MARKET OVERLAP</h4>${bullets(item.why_it_fits,"No overlap rationale available.")}</div><div class="detail-section"><h4>RISKS / NOTES</h4>${bullets([...(item.risks||[]),...(item.missing_requirements||[])],"No recorded notes.")}</div>
<div class="detail-section"><h4>DISCOVERY HISTORY</h4><p>First found: ${escapeHtml(formatTimestamp(item.first_seen))}<br>Last found: ${escapeHtml(formatTimestamp(item.last_seen))}</p></div><div class="detail-section"><h4>SOURCE EVIDENCE</h4>${evidenceMarkup(item)}</div>
<div class="detail-actions"><a class="action-button full" href="${escapeHtml(item.source_url)}" target="_blank" rel="noreferrer">OPEN SOURCE</a><button class="action-button full" type="button" disabled>OUTREACH & RESPONSE LOCKED</button></div></div>`;}
function renderRejectedDetail(item){els.detail.innerHTML=`
<div class="detail-head rejected-detail"><div><p class="eyebrow">REJECTED CANDIDATE · MANUAL REVIEW ONLY</p><h3>${escapeHtml(item.title)}</h3><p class="detail-company">${escapeHtml(item.company||"Buyer not established")}</p></div><div class="detail-tags"><span class="kind-badge rejected">${escapeHtml(diagnosticReasonLabel(item.rejection_reason))}</span><span class="tag">${escapeHtml(item.review_status||"PENDING")}</span></div></div>
<div class="detail-body"><div class="rejected-lock"><strong>TRUTH GATE REMAINS FAILED</strong><span>This candidate is visible so you can inspect it manually. It is not counted as a sales opportunity, cannot generate outreach and cannot be contacted from Radar. KEEP means keep it on the review list; it does not override verification.</span></div>
<div class="score-pair"><div class="score-card"><span>RAW FIT SCORE</span><strong>${escapeHtml(item.fit_score||0)}</strong><span>UNVERIFIED</span></div><div class="score-card"><span>RAW WIN SCORE</span><strong>${escapeHtml(item.win_score||0)}</strong><span>UNVERIFIED</span></div></div>
<div class="detail-section"><h4>REJECTION</h4><p><strong>${escapeHtml(diagnosticReasonLabel(item.rejection_reason))}</strong><br>Stage: ${escapeHtml(item.rejection_stage||"UNKNOWN")}<br>Track: ${escapeHtml(item.engagement_track||"UNKNOWN")}<br>Source: ${escapeHtml(item.source_id||"unattributed")}</p></div>
<div class="detail-section"><h4>RAW CANDIDATE SUMMARY</h4><p>${escapeHtml(item.summary||"No summary retained.")}</p></div>
<div class="detail-section"><h4>SAFETY</h4><p>No contact data is retained. Manual review status never promotes this record into sales. A future verified discovery must pass all normal truth gates.</p></div>
<div class="detail-actions">${item.source_url?`<a class="action-button full" href="${escapeHtml(item.source_url)}" target="_blank" rel="noreferrer">OPEN ORIGINAL SOURCE · MANUAL CHECK</a>`:'<button class="action-button full" type="button" disabled>ORIGINAL URL NOT VERIFIED</button>'}<button class="action-button" data-rejected-decision="KEEP" type="button">KEEP FOR REVIEW</button><button class="action-button" data-rejected-decision="DISMISSED" type="button">DISMISS</button><button class="action-button full" type="button" disabled>OUTREACH & PROMOTION LOCKED</button></div></div>`;}
function renderDetail(){
  renderDetailContent();
  const body=els.detail.querySelector(".detail-body");if(!body)return;
  const sections=[...body.querySelectorAll(":scope > .detail-section")];
  const lookup=title=>sections.find(section=>section.querySelector("h4")?.textContent===title);
  const score=body.querySelector(".score-pair");
  if(score){const note=document.createElement("p");note.className="microcopy";note.textContent="Fit = capability match. Win = heuristic attractiveness, not a probability of winning.";score.after(note);}
  const anchor=lookup("SOURCE STATUS")||sections[0];
  if(anchor)for(const title of ["SUMMARY","BUDGET","WHY IT FITS","RISKS / GAPS"]){const section=lookup(title);if(section&&section!==anchor)body.insertBefore(section,anchor);}
  for(const title of ["SOURCE STATUS","DISCOVERY HISTORY","COMPANY OUTREACH HISTORY","SOURCE EVIDENCE"]){
    const section=lookup(title);if(!section)continue;
    const drawer=document.createElement("details"),summary=document.createElement("summary");drawer.className="detail-disclosure";summary.textContent=title.toLowerCase().replace(/^./,letter=>letter.toUpperCase());
    section.before(drawer);drawer.append(summary,section);
  }
  const actions=body.querySelector(".detail-actions"),reply=body.querySelector(".reply-section");
  const firstDisclosure=body.querySelector(".detail-disclosure");
  if(actions&&firstDisclosure)body.insertBefore(actions,firstDisclosure);
  if(reply&&firstDisclosure)body.insertBefore(reply,firstDisclosure);
}
function renderDetailContent(){ const item=selectedRecord(); if(!item){els.detail.innerHTML='<div class="detail-empty">Select a record.</div>';return;} if(state.view==="REJECTED"){renderRejectedDetail(item);return;} if(!isSalesOpportunityRecord(item)){renderIntelligenceDetail(item);return;} const budget=budgetView(item),company=companyStateFor(item),days=daysSince(company.last_contacted_at),recent=days!==null&&days<=30,replyLocked=state.datasetMode!=="FIXTURE"&&!state.replyEnabled; const contact=item.contact_email?`<p><strong>${escapeHtml(item.contact_email)}</strong><br><span class="muted">Public source verified.</span></p>`:'<p><strong>Email not publicly available</strong><br><span class="muted">No address will be inferred.</span></p>'; els.detail.innerHTML=`
<div class="detail-head"><div class="detail-title-row"><div><p class="eyebrow">${item.opportunity_kind==="OPEN_OPPORTUNITY"?"OPEN OPPORTUNITY":isFundingLead(item)?"FUNDING / PARTNERSHIP · VERIFY ELIGIBILITY":"POTENTIAL LEAD · NOT AN ACTIVE REQUEST"}</p><h3>${escapeHtml(item.title)}</h3><p class="detail-company">${escapeHtml(item.company)} · ${escapeHtml(item.location)}</p></div><button class="star-button detail-star ${item.company_bookmarked?"is-starred":""}" data-bookmark-company="${escapeHtml(item.company)}" type="button">${item.company_bookmarked?"★":"☆"}</button></div><div class="detail-tags">${kindBadge(item)}${item.categories.slice(0,5).map((x)=>`<span class="tag">${escapeHtml(x)}</span>`).join("")}</div></div>
<div class="detail-body">${recent?`<div class="repeat-warning"><strong>RECENT OUTREACH</strong><span>This company was emailed ${days===0?"today":`${days} days ago`}. Review history before sending again.</span></div>`:""}${manualVerificationRequired(item)?`<div class="manual-source-warning"><strong>MANUAL SOURCE CHECK REQUIRED</strong><span>Found through allowlisted hosted web search (${escapeHtml(item.discovery_source_id||"approved source")}). Open the original source and confirm that it is active, relevant and accepts the declared ${escapeHtml(trackLabel(item))} delivery mode before continuing. Radar did not log in, use cookies, or directly crawl this platform.</span><div class="manual-source-actions"><a href="${escapeHtml(item.source_url)}" target="_blank" rel="noreferrer">OPEN ORIGINAL SOURCE</a><button type="button" data-verify-source="1">I CHECKED IT · MARK VERIFIED</button></div></div>`:manualVerificationComplete(item)?`<div class="manual-source-verified"><strong>SOURCE MANUALLY VERIFIED</strong><span>Checked ${escapeHtml(formatTimestamp(item.manual_verified_at))} against this exact source URL.</span></div>`:""}
<div class="score-pair"><div class="score-card"><span>FIT SCORE</span><strong>${item.fit_score}</strong><span>${bandForScore(item.fit_score)} MATCH</span></div><div class="score-card"><span>WIN SCORE</span><strong>${item.win_score}</strong><span>${item.win_band} · HEURISTIC</span></div></div>
<div class="detail-section"><h4>SOURCE STATUS</h4><p><strong>${escapeHtml(item.commercial_role||"LEGACY")} · ${escapeHtml(item.notice_status||"UNKNOWN")} · ${escapeHtml(trackLabel(item))}</strong><br>${engagementTrack(item)==="INDIVIDUAL_FREELANCE"?`Individual eligibility: ${escapeHtml(item.individual_eligibility||"UNKNOWN")}<br><span class="muted">${escapeHtml(item.individual_eligibility_reason||"Individual eligibility was not measured.")}</span>`:`Studio eligibility: ${escapeHtml(item.studio_eligibility||"UNKNOWN")}<br><span class="muted">${escapeHtml(item.eligibility_reason||"Legacy record; eligibility was not measured.")}</span>`}</p></div>
<div class="detail-section"><h4>DISCOVERY HISTORY</h4><p>First found: ${escapeHtml(formatTimestamp(item.first_seen))}<br>Last found: ${escapeHtml(formatTimestamp(item.last_seen))}<br>Published: ${escapeHtml(formatDate(item.published_date))}<br>Source updated: ${escapeHtml(formatDate(item.source_updated_date))}<br>Freshness proof: ${escapeHtml(item.freshness_basis||"LEGACY / UNKNOWN")} · confidence ${escapeHtml(item.freshness_confidence||"unknown")}${item.acceptance_verified_at?` · active acceptance checked ${escapeHtml(formatTimestamp(item.acceptance_verified_at))}`:""}</p><p class="muted">Saved history remains available, but only truth-gated records enter new Search results.</p></div><div class="detail-section"><h4>SUMMARY</h4><p>${escapeHtml(item.summary)}</p></div><div class="detail-section"><h4>WHY IT FITS</h4>${bullets(item.why_it_fits,"No fit rationale available.")}</div><div class="detail-section"><h4>RISKS / GAPS</h4>${bullets([...(item.risks||[]),...(item.missing_requirements||[])],"No recorded gaps.")}</div>
<div class="detail-section"><h4>BUDGET</h4><p><strong>${escapeHtml(budget.value)}</strong> · ${escapeHtml(budget.meta)}<br><span class="muted">${escapeHtml(item.budget_reason)}</span></p></div><div class="detail-section"><h4>CONTACT</h4>${contact}</div>
<div class="detail-section"><h4>COMPANY OUTREACH HISTORY</h4><p><strong>${company.contact_count||0} email${company.contact_count===1?"":"s"} recorded</strong>${company.last_contacted_at?` · last ${escapeHtml(formatTimestamp(company.last_contacted_at))}`:""}</p>${historyMarkup(company)}</div>
<div class="detail-section"><h4>SOURCE EVIDENCE</h4>${evidenceMarkup(item)}</div>
${replyMarkup(item)}<div class="detail-actions">${manualVerificationRequired(item)?'<button class="action-button" type="button" disabled>CONTACT LOCKED</button>':item.contact_email?'<button class="action-button" data-copy="email" type="button">COPY EMAIL</button>':`<a class="action-button" href="${escapeHtml(item.apply_url)}" target="_blank" rel="noreferrer">OPEN CONTACT / APPLY</a>`}<a class="action-button" href="${escapeHtml(item.source_url)}" target="_blank" rel="noreferrer">${manualVerificationRequired(item)?"OPEN SOURCE · VERIFY":"OPEN SOURCE"}</a><button class="action-button sent full" data-mark-sent="1" type="button" ${manualVerificationRequired(item)?"disabled":""}>✓ MARK EMAIL SENT</button><button class="action-button primary full" data-generate-response="1" type="button" ${manualVerificationRequired(item)||replyLocked?"disabled":""}>${replyLocked?"GENERATE RESPONSE · PAID LOCKED":item.reply_body?"REGENERATE RESPONSE":"GENERATE RESPONSE"}</button><button class="action-button" data-copy-subject="1" type="button" ${item.reply_subject&&!manualVerificationRequired(item)?"":"disabled"}>COPY SUBJECT</button><button class="action-button" data-copy-response="1" type="button" ${item.reply_body&&!manualVerificationRequired(item)?"":"disabled"}>COPY RESPONSE</button></div></div>`; }
function renderSearchFootprint(){
  const report=searchFootprint(state.lastRun), output=document.querySelector("#search-footprint-content"), metric=value=>value===null?"not recorded":String(value);
  const domains=new Map(); for(const item of report.links){if(!domains.has(item.domain))domains.set(item.domain,[]);domains.get(item.domain).push(item);}
  output.innerHTML=`<p class="microcopy">${report.completedAt?`Last saved search: ${escapeHtml(formatTimestamp(report.completedAt))}.`:"No saved search history loaded."} Hosted-index consultation does not mean Radar directly crawled a website. Counts can include repeated URL consultations across phases.</p>
  <details open><summary>1. Search topics (${report.topics.length})</summary>${report.topics.length?`<ul>${report.topics.map(item=>`<li><strong>${escapeHtml(item.label)}</strong><span>${escapeHtml(item.status)} · ${metric(item.calls)} web calls · ${metric(item.consulted)} URL consultations${item.error?` · ${escapeHtml(item.error)}`:""}</span></li>`).join("")}</ul>`:'<p class="microcopy">Search topics were not recorded for this run.</p>'}</details>
  <details><summary>2. Websites with recorded activity (${report.sources.length})</summary>${report.sources.length?`<ul>${report.sources.map(item=>`<li><strong>${escapeHtml(item.label)}</strong><span>${metric(item.consulted)} URL consultations · ${metric(item.candidates)} candidates · ${metric(item.rejected)} rejected · ${metric(item.returned)} returned at discovery stage (not necessarily final sales)</span></li>`).join("")}</ul>`:'<p class="microcopy">No per-website activity was recorded.</p>'}</details>
  <details><summary>3. Retained candidate URLs (${report.links.length})</summary><p class="microcopy">Only URLs retained in this run’s candidate ledger. This is not a complete browsing history; an included URL is not proof of an active or verified opportunity.</p>${[...domains].map(([domain,items])=>`<details class="footprint-domain"><summary>${escapeHtml(domain)} (${items.length})</summary><ul>${items.map(item=>`<li><a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">${escapeHtml(item.title)}</a><span>Detail result: ${escapeHtml(item.status)}</span></li>`).join("")}</ul></details>`).join("")||'<p class="microcopy">No candidate-level URLs were retained in this run.</p>'}</details>`;
}
function renderAll(){renderSummary();renderRunCounters();renderSearchDiagnostics();renderSearchFootprint();renderSourceRun();renderUltraMax();renderTable();renderDetail();}
function selectOpportunity(id){state.selectedId=id;renderTable();renderDetail();if(window.matchMedia("(max-width: 760px)").matches){els.detail.scrollIntoView({behavior:"smooth",block:"start"});els.detail.focus({preventScroll:true});}}
let toastTimer; function showToast(text){clearTimeout(toastTimer);els.toast.textContent=text;els.toast.classList.add("is-visible");toastTimer=setTimeout(()=>els.toast.classList.remove("is-visible"),2400);}
async function copyText(value,label){try{await navigator.clipboard.writeText(value);showToast(`${label} copied`);}catch{showToast("Clipboard unavailable");}}

async function setStatus(id,status){ const item=state.opportunities.find((x)=>x.id===id); if(!item||!STATUS_VALUES.includes(status))return; const old=item.status; item.status=status; renderAll(); try{ if(state.datasetMode==="FIXTURE"){saveFixtureStatus(id,status);showToast(`Fixture status: ${status}`);return;} if(!accessCode())throw new Error("Enter team access code first."); await api("/api/opportunity-status",{method:"POST",body:JSON.stringify({opportunity_id:id,status})}); showToast(`Shared status saved: ${status}`);}catch(error){item.status=old;renderAll();showToast(error.message);} }
async function setRejectedDecision(id,reviewStatus){const item=state.rejectedCandidates.find((candidate)=>candidate.id===id);if(!item||!["PENDING","KEEP","DISMISSED"].includes(reviewStatus))return;const old=item.review_status;item.review_status=reviewStatus;renderAll();try{if(!accessCode())throw new Error("Enter team access code first.");const payload=await api("/api/rejected-candidate-status",{method:"POST",body:JSON.stringify({candidate_id:id,review_status:reviewStatus})});Object.assign(item,payload.candidate||{});renderAll();showToast(`Rejected candidate review: ${reviewStatus}`);}catch(error){item.review_status=old;renderAll();showToast(error.message);}}
async function verifySource(){const item=state.opportunities.find((x)=>x.id===state.selectedId);if(!item||!manualVerificationRequired(item))return;if(!accessCode()){showToast("Enter team access code first.");return;}const button=els.detail.querySelector("[data-verify-source]");if(button){button.disabled=true;button.textContent="SAVING VERIFICATION…";}try{const payload=await api("/api/opportunity-status",{method:"POST",body:JSON.stringify({action:"VERIFY_SOURCE",opportunity_id:item.id,source_url:item.source_url})});Object.assign(item,payload.opportunity||{});renderAll();showToast("Source verification saved for the team");}catch(error){renderDetail();showToast(error.message);}}
async function toggleBookmark(companyName){ const items=state.opportunities.filter((x)=>companyMapKey(x.company)===companyMapKey(companyName)); const next=!items.some((x)=>x.company_bookmarked); if(state.datasetMode==="FIXTURE"){ const company={...companyStateFor(items[0]),company:companyName,bookmarked:next,bookmarked_at:next?new Date().toISOString():null}; applyCompanyState(company); renderAll(); showToast(next?"Fixture company bookmarked":"Fixture bookmark removed"); return;} if(!accessCode()){showToast("Enter team access code first.");return;} try{const payload=await api("/api/company-state",{method:"POST",body:JSON.stringify({action:"SET_BOOKMARK",company:companyName,bookmarked:next})});applyCompanyState(payload.company);renderAll();showToast(next?"Company bookmarked for team":"Company bookmark removed");}catch(error){showToast(error.message);} }
async function markEmailSent(){ const item=state.opportunities.find((x)=>x.id===state.selectedId); if(!item)return;if(!isSalesOpportunityRecord(item)){showToast("Outreach is locked for competitor intelligence.");return;}if(manualVerificationRequired(item)){showToast("Verify the original source before recording outreach.");return;} if(state.datasetMode==="FIXTURE"){const now=new Date().toISOString(),current=companyStateFor(item);const company={...current,company:item.company,last_contacted_at:now,contact_count:(current.contact_count||0)+1,contact_history:[{sent_at:now,recipient:item.contact_email||null,subject:item.reply_subject||null,opportunity_id:item.id},...(current.contact_history||[])]};applyCompanyState(company);item.status="CONTACTED";saveFixtureStatus(item.id,"CONTACTED");renderAll();showToast("Fixture outreach recorded — preview only");return;} if(!accessCode()){showToast("Enter team access code first.");return;} try{const payload=await api("/api/company-state",{method:"POST",body:JSON.stringify({action:"MARK_EMAIL_SENT",company:item.company,opportunity_id:item.id})});applyCompanyState(payload.company);Object.assign(item,payload.opportunity||{});renderAll();showToast("Email marked as sent · company history updated");}catch(error){showToast(error.message);} }
function buildFixtureReply(item){const subject=`${item.company} — realistic character production support`;const capability=item.categories.includes("WRAP_BASEMESH")?"scan cleanup, Wrap to a client-provided basemesh and downstream character preparation":"realistic human character production and scan-based asset finishing";const body=`Hello,\n\nI’m reaching out from 3D.sk regarding your ${item.title}. The scope looks closely aligned with our human-character production pipeline, particularly ${capability}. We can support either a defined part of the pipeline or a broader batch workflow, adapting the handoff to the topology and production requirements you already use.\n\nWhat stood out in your brief is the need for consistent production-ready human assets rather than isolated modeling work. That is the kind of repeatable scan/character workflow our team is set up around.\n\nIf useful, we can review a small sample of your source data and confirm the most efficient handoff point before you define the full batch or request a quotation.\n\nBest regards,\n3D.sk`;return{to:item.contact_email||null,subject,body,generated_at:new Date().toISOString(),model:"FIXTURE_PREVIEW"};}
async function generateResponse(){const item=state.opportunities.find((x)=>x.id===state.selectedId);if(!item)return;if(!isSalesOpportunityRecord(item)){showToast("Response generation is locked for competitor intelligence.");return;}if(manualVerificationRequired(item)){showToast("Verify the original source before generating a response.");return;}if(state.datasetMode==="FIXTURE"){const reply=buildFixtureReply(item);Object.assign(item,{reply_to:reply.to,reply_subject:reply.subject,reply_body:reply.body,reply_generated_at:reply.generated_at,reply_model:reply.model});renderDetail();showToast("Fixture response generated · $0 API cost");return;}if(!state.replyEnabled){showToast("Production response generation is still paid-locked.");return;}if(!accessCode()){showToast("Enter team access code first.");return;}const button=els.detail.querySelector("[data-generate-response]");if(button){button.disabled=true;button.textContent="GENERATING…";}try{const payload=await api("/api/generate-response",{method:"POST",body:JSON.stringify({opportunity_id:item.id})});Object.assign(item,payload.opportunity||{});renderDetail();showToast("Personalized response generated");}catch(error){renderDetail();showToast(error.message);}}
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
function applyUltraSnapshot(payload){
  state.ultraRun=payload?.run||null;
  state.ultraNextOperation=payload?.next_operation||null;
  renderUltraMax();
}
function rejectedCandidatesFromSnapshot(payload){
  const items=[...(payload.rejected_candidates||[]),...(payload.last_search?.rejected_candidates||[])],byId=new Map();
  for(const item of items)if(item?.id)byId.set(item.id,item);
  for(const entry of payload.last_search?.forensic_audit?.accepted_candidate_ledger||[]){
    if(entry?.detail_status!=="REJECTED"||!entry?.candidate_id||byId.has(entry.candidate_id))continue;
    byId.set(entry.candidate_id,{id:entry.candidate_id,review_record_kind:"REJECTED_CANDIDATE",title:entry.title||"Rejected candidate",company:"Buyer not established",summary:"The discovery candidate passed preliminary gates but failed exact-URL detail verification.",source_url:entry.source_url||null,source_id:entry.source_id||null,published_date:null,engagement_track:"UNKNOWN",categories:[],fit_score:0,win_score:0,rejection_reason:entry.rejection_reason||"detail_verification_failed",rejection_stage:"DETAIL_VERIFICATION",review_status:"PENDING",outreach_locked:true,first_seen:payload.last_search?.completed_at||null,last_seen:payload.last_search?.completed_at||null});
  }
  return [...byId.values()].sort((a,b)=>String(b.last_seen||"").localeCompare(String(a.last_seen||"")));
}
async function loadUltraSnapshot(){
  if(!accessCode())return;
  try{applyUltraSnapshot(await api("/api/ultra-max-runs"));}
  catch(error){if(error.code==="ULTRA_MAX_RUN_NOT_FOUND"){state.ultraRun=null;state.ultraNextOperation=null;renderUltraMax();return;}throw error;}
}
async function waitForUltraPaidPhase(runId,phaseId){
  const startedAt=Date.now(),deadline=startedAt+16*60*1000;
  while(Date.now()<deadline){
    await new Promise(resolve=>setTimeout(resolve,2000));
    const payload=await api(`/api/ultra-max-runs?run_id=${encodeURIComponent(runId)}`);
    applyUltraSnapshot(payload);
    const phase=payload.run?.plan_snapshot?.phases?.find((item)=>item.phase_id===phaseId);
    if(isUltraMaxTerminal(payload.run)||phase?.status==="COMPLETED")return payload;
    if(phase?.status==="PENDING"&&Date.now()-startedAt>30_000)throw new Error("ULTRA background phase did not start. It was not dispatched again.");
  }
  throw new Error("ULTRA background phase timed out. It was not dispatched again.");
}
async function continueUltraPaid(runId,next){
  const body={action:"PREPARE_PAID",run_id:runId,phase_id:next.phase_id,operation_id:next.operation_id,paid_confirmation:ULTRA_PAID_CONFIRMATION};
  const prepared=await api("/api/ultra-max-runs",{method:"POST",body:JSON.stringify(body)});
  const response=await fetch(prepared.background_path,{method:"POST",headers:{...authHeaders(),"content-type":"application/json"},body:JSON.stringify({...body,action:undefined})});
  if(!response.ok){const payload=await response.json().catch(()=>({}));const error=new Error(payload?.error?.message||`ULTRA background dispatch failed (${response.status})`);error.code=payload?.error?.code||"ULTRA_BACKGROUND_DISPATCH_FAILED";throw error;}
  return waitForUltraPaidPhase(runId,next.phase_id);
}
async function runUltraMax(){
  if(!accessCode()){showToast("Enter team access code first.");els.accessCode.focus();return;}
  if(!state.ultraEnabled&&!(state.ultraRun&&!isUltraMaxTerminal(state.ultraRun)&&state.ultraPaidEnabled)){showToast("ULTRA MAX is server-locked.");return;}
  if(state.ultraBusy)return;
  sessionStorage.setItem(ACCESS_SESSION_KEY,accessCode());state.ultraBusy=true;state.ultraStop=false;state.ultraMessage=null;renderUltraMax();
  try{
    let initial={run:state.ultraRun,next_operation:state.ultraNextOperation};
    if(!state.ultraRun||isUltraMaxTerminal(state.ultraRun)){
      initial=await api("/api/ultra-max-runs",{method:"POST",body:JSON.stringify({action:"START",request_id:clientOperationId("ultra_request")})});
      applyUltraSnapshot(initial);
    }
    const result=await continueUltraMaxLoop({
      initialPayload:initial,
      shouldStop:()=>state.ultraStop,
      maxOperations:56,
      paidReady:()=>state.ultraPaidEnabled,
      continueNative:(runId,operationId)=>api("/api/ultra-max-runs",{method:"POST",body:JSON.stringify({action:"CONTINUE_NATIVE",run_id:runId,operation_id:operationId})}),
      continuePaid:continueUltraPaid,
      onUpdate:async(payload)=>applyUltraSnapshot(payload)
    });
    applyUltraSnapshot(result);
    const messages={COMPLETED:"ULTRA MAX completed. Only detail-verified results were saved.",CANCELLED:"ULTRA run cancelled; completed phases were preserved.",UNCERTAIN:"ULTRA stopped in UNCERTAIN state; the failed operation was not retried.",UI_OPERATION_CAP_REACHED:"56 operations completed. Progress is saved; resume manually.",STOP_REQUESTED:"Cancel requested; completed operations are preserved.",PAID_PHASE_LOCKED:"Native collection completed. Paid ULTRA phases remain independently locked.",NEXT_OPERATION_UNAVAILABLE:"ULTRA paused because the server did not issue a next operation."};
    state.ultraMessage=messages[result.reason]||`ULTRA progress saved · ${result.reason}`;
    if(result.reason==="COMPLETED")applyTeamSnapshot(await api("/api/opportunities"));
    showToast(messages[result.reason]||"ULTRA progress saved");
  }catch(error){state.ultraMessage=`ULTRA stopped safely · ${error.message} · no automatic retry`;showToast(error.message);}
  finally{state.ultraBusy=false;renderUltraMax();}
}
async function cancelUltraMax(){
  if(!state.ultraRun||isUltraMaxTerminal(state.ultraRun)||!accessCode())return;
  state.ultraStop=true;state.ultraMessage="Cancel requested…";renderUltraMax();
  try{const payload=await api("/api/ultra-max-runs",{method:"POST",body:JSON.stringify({action:"CANCEL",run_id:state.ultraRun.run_id,operation_id:clientOperationId("ultra_cancel")})});applyUltraSnapshot(payload);state.ultraMessage="ULTRA cancel marker persisted.";showToast("ULTRA run cancelled");}
  catch(error){showToast(error.message);}
}
function applyTeamSnapshot(payload){
  state.opportunities=payload.records||payload.opportunities;state.rejectedCandidates=rejectedCandidatesFromSnapshot(payload);state.selectedId=(state.view==="REJECTED"?state.rejectedCandidates:state.opportunities)[0]?.id||null;state.companies=new Map();
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
  try{applyTeamSnapshot(await api("/api/opportunities"));document.querySelector("#search-tools").open=false;await Promise.all([loadSourceRunSnapshot(),loadUltraSnapshot()]);els.scanNote.textContent="Saved results loaded. Reloading this page does not start a paid search.";}
  catch(error){showToast(error.message);els.scanNote.textContent=`Saved results could not be loaded: ${error.message}`;}
  finally{els.connect.disabled=false;}
}
async function waitForWideSearch(){
  const startedAt=Date.now(),deadline=startedAt+16*60*1000;
  while(Date.now()<deadline){
    const status=await api("/api/search-status");
    if(status.status==="COMPLETED")return status;
    if(status.status==="UNCERTAIN"){const error=new Error("Wide search ended in an uncertain state. It will not retry automatically.");error.code=status.error_code||"PAID_DISPATCH_UNCERTAIN";throw error;}
    if(status.status==="NOT_STARTED"&&Date.now()-startedAt>30_000)throw new Error("Wide search did not start. No automatic retry was attempted.");
    els.scanNote.textContent=status.status==="NOT_STARTED"?"Worldwide search queued…":"Worldwide search running in the background…";
    await new Promise(resolve=>setTimeout(resolve,Math.max(1,Number(status.poll_after_seconds)||2)*1000));
  }
  throw new Error("Wide search status timed out. No automatic retry was attempted.");
}
async function runWideSearchInBackground(){
  const response=await fetch("/api/search-background",{method:"POST",headers:authHeaders(),body:"{}"});
  if(response.status!==202){const payload=await response.json().catch(()=>({}));const error=new Error(payload?.error?.message||`Background search failed (${response.status})`);error.code=payload?.error?.code||"BACKGROUND_SEARCH_FAILED";throw error;}
  await waitForWideSearch();
  await loadTeamState();
  els.scanNote.textContent=`Worldwide search complete · ${state.lastRun?.returned_count||0} records`;
  showToast("Worldwide search complete");
}
async function runLiveSearch(){ if(!state.searchEnabled){showToast("Production search is still paid-locked.");return;}if(!accessCode()){showToast("Enter team access code first.");return;} sessionStorage.setItem(ACCESS_SESSION_KEY,accessCode()); const wide=["WIDE_INDEX","WIDE_MAX","WIDE_V3"].includes(state.searchProfile);const old=els.find.textContent;els.find.disabled=true;els.find.textContent=wide?"SEARCHING WORLDWIDE…":"SEARCHING…";try{if(wide){await runWideSearchInBackground();return;}const payload=await api("/api/search",{method:"POST",body:"{}"});state.opportunities=payload.opportunities;state.datasetMode="TEAM";state.lastRun=payload.run;await loadTeamState();els.scanNote.textContent=payload.replayed?`Today's UTC search already completed · saved result loaded · $0 new cost`:`Live search complete · ${payload.run.returned_count} records`;showToast(payload.replayed?"Today's search loaded without a second charge":"Live search complete");}catch(error){els.scanNote.textContent=`Search not run · ${error.message}`;showToast(error.message);}finally{els.find.disabled=!state.searchEnabled;els.find.textContent=old;} }

els.body.addEventListener("click",(event)=>{const star=event.target.closest("[data-bookmark-company]");if(star){event.stopPropagation();toggleBookmark(star.dataset.bookmarkCompany);return;}if(event.target.closest("select,a,button,input"))return;const row=event.target.closest("tr[data-id]");if(row)selectOpportunity(row.dataset.id);});
els.body.addEventListener("change",(event)=>{if(event.target.matches(".status-select"))setStatus(event.target.dataset.statusId,event.target.value);if(event.target.matches(".rejected-status-select"))setRejectedDecision(event.target.dataset.rejectedStatusId,event.target.value);if(event.target.matches(".select-radio"))selectOpportunity(event.target.closest("tr").dataset.id);});
els.detail.addEventListener("click",(event)=>{const star=event.target.closest("[data-bookmark-company]");if(star){toggleBookmark(star.dataset.bookmarkCompany);return;}const item=selectedRecord(),sales=item&&state.view!=="REJECTED"&&isSalesOpportunityRecord(item);if(event.target.dataset.rejectedDecision&&state.view==="REJECTED")setRejectedDecision(item.id,event.target.dataset.rejectedDecision);if(event.target.dataset.copy==="email"&&sales&&item.contact_email)copyText(item.contact_email,"Email");if(event.target.dataset.copySubject&&sales&&item.reply_subject)copyText(item.reply_subject,"Subject");if(event.target.dataset.copyResponse&&sales&&item.reply_body)copyText(item.reply_body,"Response");if(event.target.dataset.verifySource&&sales)verifySource();if(event.target.dataset.markSent)markEmailSent();if(event.target.dataset.generateResponse)generateResponse();});
document.querySelectorAll("[data-view]").forEach((button)=>button.addEventListener("click",()=>{document.querySelectorAll("[data-view]").forEach((x)=>x.classList.remove("is-active"));button.classList.add("is-active");state.view=button.dataset.view;state.selectedId=null;renderTable();}));
els.statusFilter.addEventListener("change",()=>{state.status=els.statusFilter.value;renderTable();}); els.fitFilter.addEventListener("change",()=>{state.minFit=Number(els.fitFilter.value);renderTable();}); els.connect.addEventListener("click",loadTeamState);els.find.addEventListener("click",runLiveSearch);els.sourceRunButton.addEventListener("click",runSourceCollection);els.sourceRunCancel.addEventListener("click",cancelSourceCollection);els.ultraMaxButton.addEventListener("click",runUltraMax);els.ultraMaxCancel.addEventListener("click",cancelUltraMax);


const sortSelect=document.querySelector("#sort-select"), sortDirection=document.querySelector("#sort-direction"), categoryOptions=document.querySelector("#category-options");
sortSelect.innerHTML=Object.entries(SORTS).map(([key,label])=>`<option value="${key}">${label}</option>`).join("");
categoryOptions.innerHTML=Object.entries(CATEGORIES).map(([key,label])=>`<label class="category-choice"><input type="checkbox" value="${key}"><span>${label}</span></label>`).join("");
function renderSort(){
  els.statusFilter.disabled=state.view==="REJECTED";
  els.fitFilter.disabled=state.view==="REJECTED";
  document.querySelectorAll("[data-view]").forEach(button=>button.setAttribute("aria-pressed",String(button.dataset.view===state.view)));
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
const savedSearch=document.querySelector("#opportunity-search"),searchTools=document.querySelector("#search-tools");
savedSearch.addEventListener("input",()=>{state.query=savedSearch.value;renderTable();});
document.querySelector("#open-search-tools").addEventListener("click",()=>{searchTools.open=!searchTools.open;if(searchTools.open)searchTools.scrollIntoView({behavior:"smooth",block:"start"});});
searchTools.addEventListener("toggle",()=>document.querySelector("#open-search-tools").setAttribute("aria-expanded",String(searchTools.open)));
const footprintDrawer=document.querySelector("#search-footprint");
document.querySelector("#open-search-footprint").addEventListener("click",()=>{footprintDrawer.open=true;footprintDrawer.scrollIntoView({behavior:"smooth",block:"start"});});
footprintDrawer.addEventListener("toggle",()=>document.querySelector("#open-search-footprint").setAttribute("aria-expanded",String(footprintDrawer.open)));
for(const mode of ["list","table"])document.querySelector(`#${mode}-layout`).addEventListener("click",()=>{
  document.querySelector(".results-layout").classList.toggle("cards-mode",mode==="list");
  for(const option of ["list","table"])document.querySelector(`#${option}-layout`).setAttribute("aria-pressed",String(option===mode));
});
document.querySelector("#reset-filters").addEventListener("click",()=>{
  savedSearch.value="";state.query="";state.status="ALL";state.minFit=0;els.statusFilter.value="ALL";els.fitFilter.value="0";
  categoryOptions.querySelectorAll("input").forEach(input=>input.checked=false);updateCategories();
});

async function loadDemo(){
  const response=await fetch("/fixtures/opportunities.json");
  if(!response.ok)throw new Error("Demo could not be loaded.");
  state.opportunities=hydrateFixtureStatuses(await response.json());state.rejectedCandidates=[];state.companies=new Map();state.datasetMode="FIXTURE";state.lastRun=null;
  state.selectedId=state.opportunities[0]?.id||null;els.datasetPill.textContent="DEMO · not saved to team";
  document.querySelector("#last-search").textContent="Demo data · no paid search";
  window.dispatchEvent(new CustomEvent("radar:search-history",{detail:null}));renderAll();
}
document.querySelector("#demo-button").addEventListener("click",()=>loadDemo().catch(e=>showToast(e.message)));
document.querySelector("#signout-button").addEventListener("click",()=>{sessionStorage.removeItem(ACCESS_SESSION_KEY);els.accessCode.value="";state.opportunities=[];state.rejectedCandidates=[];state.companies=new Map();state.datasetMode="DISCONNECTED";state.selectedId=null;state.sourceRun=null;state.sourceCandidates=[];state.sourceRunStop=true;state.sourceRunMessage=null;state.ultraRun=null;state.ultraNextOperation=null;state.ultraStop=true;state.ultraMessage=null;els.datasetPill.textContent="Team access required";document.querySelector("#last-search").textContent="Connect to view saved search history";window.dispatchEvent(new CustomEvent("radar:search-history",{detail:null}));renderAll();});
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
  try{const h=await(await fetch("/api/health")).json();state.collectionEnabled=h.source_collection==="ENABLED";state.ultraEnabled=h.ultra_max_native==="READY";state.ultraPaidEnabled=h.ultra_max_paid==="READY";state.searchEnabled=h.production_search==="READY";state.searchProfile=h.production_search_profile||null;state.replyEnabled=h.production_reply==="READY";const wide=["WIDE_INDEX","WIDE_MAX","WIDE_V3"].includes(state.searchProfile);document.querySelector("#ai-state").textContent=state.searchEnabled?`${wide?(state.searchProfile==="WIDE_V3"?"Worldwide source + social search":state.searchProfile==="WIDE_MAX"?"Worldwide maximum search":"Worldwide wide search"):"Production search"} ready · duplicate-charge protection active`:h.paid_ai_state==="LOCKED"?"Live AI locked until final acceptance":"Live AI enabled · production search locked";els.find.disabled=!state.searchEnabled;els.find.textContent=state.searchEnabled?(wide?"FIND WORLDWIDE OPPORTUNITIES":"FIND NEW OPPORTUNITIES"):"FIND NEW OPPORTUNITIES · PAID LOCKED";renderSourceRun();renderUltraMax();renderDetail();}catch{document.querySelector("#ai-state").textContent="Server status unavailable";}
  if(els.accessCode.value)await loadTeamState();
  else if(new URLSearchParams(location.search).get("demo")==="1")await loadDemo();
}
init();
