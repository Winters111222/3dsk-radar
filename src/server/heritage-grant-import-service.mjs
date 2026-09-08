import { normalizeCandidate } from "./normalize.mjs";
import { normalizeHeritageGrantBatch } from "./heritage-grant-import.mjs";

export async function importHeritageGrantBatch({ repository, records, nowIso } = {}) {
  if (!repository) throw new Error("HERITAGE_GRANT_REPOSITORY_REQUIRED");
  const imported = normalizeHeritageGrantBatch(records, { nowIso });
  const prepared = imported.map((item) => {
    const normalized = normalizeCandidate(item.candidate, new Set([item.verified_source_url]), nowIso);
    if (!normalized.opportunity) {
      const failure = new Error(`HERITAGE_GRANT_NORMALIZATION_FAILED:${normalized.rejection}`);
      failure.code = "HERITAGE_GRANT_NORMALIZATION_FAILED";
      failure.status = 400;
      throw failure;
    }
    return { ...item, opportunity:normalized.opportunity };
  });

  const fresh = [];
  const replayed = [];
  for (const item of prepared) {
    const marker = await repository.getHeritageGrantImport(item.import_id);
    if (marker?.opportunity_id) replayed.push({ item, marker });
    else fresh.push(item);
  }

  let merge = null;
  if (fresh.length) {
    merge = await repository.mergeSearchResultsWithStats(fresh.map((item) => item.opportunity), nowIso);
    for (const item of fresh) {
      await repository.saveHeritageGrantImport({
        import_id:item.import_id,
        source_id:item.source_id,
        source_url:item.verified_source_url,
        opportunity_id:item.opportunity.id,
        imported_at:nowIso
      });
    }
  }

  return {
    imported_count:fresh.length,
    replayed_count:replayed.length,
    workspace_total:merge?.workspace_total ?? (await repository.listOpportunities()).length,
    opportunity_ids:prepared.map((item) => item.opportunity.id),
    opportunities:prepared.map((item) => item.opportunity)
  };
}
