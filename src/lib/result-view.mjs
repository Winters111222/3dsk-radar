export const CATEGORIES = {
  FULL_PIPELINE: "Full Character Pipeline", CAPTURE: "Capture / Scanning",
  PHOTOGRAMMETRY_PROCESSING: "Photogrammetry", SCAN_CLEANUP: "Scan Cleanup",
  WRAP_BASEMESH: "Wrap / Basemesh", FACIAL_FACS: "Facial / FACS",
  CHARACTER_FINISHING: "Character Finishing", CHARACTER_OUTSOURCING: "Character Outsourcing",
  EXTERNAL_DEVELOPMENT: "External Development", PRODUCTION_OVERFLOW: "Production Overflow",
  PIPELINE_CONSULTING: "Pipeline Consulting", OTHER_RELEVANT: "Other Relevant"
};
export const SORTS = {
  fit_score: "Fit", win_score: "Win", title: "Opportunity", company: "Company",
  opportunity_kind: "Type", budget_type: "Budget provenance", published_date: "Date",
  first_seen: "First found", last_seen: "Last found", company_last_contacted_at: "Last outreach", contact_email: "Contact", status: "Status",
  company_bookmarked: "Bookmark", source_url: "Source"
};
const dates = new Set(["published_date", "company_last_contacted_at", "first_seen", "last_seen"]);
const numbers = new Set(["fit_score", "win_score", "company_bookmarked"]);
export function visibleResults(items, filters) {
  const {view="ALL", status="ALL", minFit=0, categories=[], sortKey="win_score", sortDirection="desc"} = filters;
  const key = Object.hasOwn(SORTS, sortKey) ? sortKey : "win_score";
  const value = (item) => {
    const raw = item[key];
    if (raw === null || raw === undefined || raw === "") return null;
    if (dates.has(key)) { const n = Date.parse(raw); return Number.isFinite(n) ? n : null; }
    if (numbers.has(key)) return Number.isFinite(Number(raw)) ? Number(raw) : null;
    return String(raw);
  };
  return items.filter(item =>
    (view === "ALL" || (view === "BOOKMARKED" ? item.company_bookmarked : item.opportunity_kind === view)) &&
    (status === "ALL" || item.status === status) && item.fit_score >= minFit &&
    (!categories.length || categories.some(category => item.categories?.includes(category)))
  ).sort((a,b) => {
    const av=value(a), bv=value(b);
    if (av === null && bv !== null) return 1;
    if (bv === null && av !== null) return -1;
    const comparison = av === null ? 0 : typeof av === "number" ? av-bv : av.localeCompare(bv, "en", {numeric:true,sensitivity:"base"});
    return comparison * (sortDirection === "asc" ? 1 : -1) || b.fit_score-a.fit_score || String(a.id).localeCompare(String(b.id));
  });
}
