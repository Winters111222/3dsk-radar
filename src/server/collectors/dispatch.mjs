import { boundedCollectorInteger, CollectorError } from "./collector-contract.mjs";
import {
  collectContractsFinderNotices,
  CONTRACTS_FINDER_QUERY_PACKS,
  CONTRACTS_FINDER_SOURCE_ID
} from "./contracts-finder.mjs";
import {
  collectFindTenderNotices,
  FIND_TENDER_QUERY_PACKS,
  FIND_TENDER_SOURCE_ID
} from "./find-tender.mjs";
import { collectTedNotices, TED_QUERY_PACKS, TED_SOURCE_ID } from "./ted.mjs";

export const IMPLEMENTED_COLLECTORS = Object.freeze({
  [TED_SOURCE_ID]:{
    queryPacks:TED_QUERY_PACKS,
    unknownPackCode:"TED_QUERY_PACK_UNKNOWN",
    collect:({ queryPackId, position, nowIso, limit, fetchImpl }) => collectTedNotices({
      queryPackId,
      nowIso,
      page:boundedCollectorInteger(position?.page, 1, 1, 20),
      limit,
      fetchImpl
    })
  },
  [FIND_TENDER_SOURCE_ID]:{
    queryPacks:FIND_TENDER_QUERY_PACKS,
    unknownPackCode:"FIND_TENDER_QUERY_PACK_UNKNOWN",
    collect:({ queryPackId, position, nowIso, limit, fetchImpl }) => collectFindTenderNotices({
      queryPackId,
      nowIso,
      cursor:position?.cursor,
      limit,
      fetchImpl
    })
  },
  [CONTRACTS_FINDER_SOURCE_ID]:{
    queryPacks:CONTRACTS_FINDER_QUERY_PACKS,
    unknownPackCode:"CONTRACTS_FINDER_QUERY_PACK_UNKNOWN",
    collect:({ queryPackId, position, nowIso, limit, fetchImpl }) => collectContractsFinderNotices({
      queryPackId,
      nowIso,
      cursor:position?.cursor,
      limit,
      fetchImpl
    })
  }
});

export function collectorDefinition(sourceId) {
  return IMPLEMENTED_COLLECTORS[sourceId] || null;
}

export async function collectSourcePage({ sourceId, queryPackId, position = {}, nowIso, limit, fetchImpl = fetch } = {}) {
  const collector = collectorDefinition(sourceId);
  if (!collector) {
    throw new CollectorError("COLLECTOR_NOT_AVAILABLE", "Choose an implemented read-only source collector.", { status:400 });
  }
  if (!Object.hasOwn(collector.queryPacks, queryPackId)) {
    throw new CollectorError(collector.unknownPackCode, "Choose one of the approved source query packs.", { status:400 });
  }
  return collector.collect({ queryPackId, position, nowIso, limit, fetchImpl });
}
