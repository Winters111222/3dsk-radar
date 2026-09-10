// A run's evidence, never the configured source catalog or all-time workspace.
export function searchFootprint(run) {
  const number = value => Number.isFinite(value) && value >= 0 ? value : null;
  const topics = (Array.isArray(run?.coverage) ? run.coverage : []).map(item => ({
    label: item.shard_label || item.shard_id || "Unnamed search topic",
    status: item.status || "UNKNOWN", calls: number(item.web_search_calls),
    consulted: number(item.consulted_urls), error: item.error_code || null
  }));
  const sources = (Array.isArray(run?.diagnostics?.source_yield) ? run.diagnostics.source_yield : [])
    .filter(item => [item.consulted_urls,item.candidates_seen,item.returned].some(value => Number(value) > 0))
    .map(item => ({ label:item.source_label || item.source_id || "Unnamed source",
      consulted:number(item.consulted_urls), candidates:number(item.candidates_seen),
      returned:number(item.returned), rejected:number(item.candidates_rejected) }));
  const ledger = Array.isArray(run?.forensic_audit?.accepted_candidate_ledger) ? run.forensic_audit.accepted_candidate_ledger : [];
  const links = new Map();
  for (const item of ledger) {
    try {
      const url = new URL(item.source_url);
      if (!['https:','http:'].includes(url.protocol) || url.username || url.password) continue;
      if (!links.has(url.href)) links.set(url.href,{ url:url.href, domain:url.hostname,
        title:item.title || url.hostname, status:item.detail_status || "NOT RECORDED" });
    } catch { /* Missing or malformed evidence is not a link. */ }
  }
  return { completedAt:run?.completed_at || null, topics, sources, links:[...links.values()] };
}
