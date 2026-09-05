import {
  CONTRACTS_FINDER_DOCUMENTATION_URL,
  CONTRACTS_FINDER_QUERY_PACKS,
  CONTRACTS_FINDER_SOURCE_ID
} from "./contracts-finder.mjs";
import {
  FIND_TENDER_DOCUMENTATION_URL,
  FIND_TENDER_QUERY_PACKS,
  FIND_TENDER_SOURCE_ID
} from "./find-tender.mjs";
import { TED_DOCUMENTATION_URL, TED_QUERY_PACKS, TED_SOURCE_ID } from "./ted.mjs";
import { sourceQualification, sourceRuntimeEligible } from "../source-qualification.mjs";

const blockedCommunityCollectors = Object.freeze([
  {
    source_id:"polycount_paid",
    name:"Polycount — paid freelance",
    method:"PUBLIC_RSS_PERMISSION_UNCONFIRMED",
    access_review_reason:"COMMERCIAL_REUSE_NOT_CONFIRMED",
    access_review_url:"https://polycount.com/discussion/193727/terms-of-service"
  },
  {
    source_id:"unreal_job_offerings",
    name:"Unreal — Job Offerings",
    method:"RSS_BLOCKED_BY_PUBLISHED_ROBOTS_POLICY",
    access_review_reason:"ROBOTS_DISALLOW_CATEGORY_RSS",
    access_review_url:"https://forums.unrealengine.com/robots.txt"
  },
  {
    source_id:"blender_paid",
    name:"Blender Artists — Paid Work",
    method:"RSS_BLOCKED_BY_PUBLISHED_ROBOTS_POLICY",
    access_review_reason:"ROBOTS_DISALLOW_CATEGORY_RSS",
    access_review_url:"https://blenderartists.org/robots.txt"
  }
]);

function queryPacks(packs) {
  return Object.entries(packs).map(([id, pack]) => ({ id, label:pack.label, categories:[...pack.categories] }));
}

function runtimeStatus(sourceId, collectionEnabled) {
  if (!collectionEnabled) return "LOCKED";
  return sourceRuntimeEligible(sourceId) ? "READY" : "BLOCKED_RELEVANCE_REVIEW";
}

function relevance(sourceId) {
  const item = sourceQualification(sourceId);
  return {
    historical_tier:item?.tier || null,
    historical_status:item?.historical_status || "UNQUALIFIED",
    runtime_eligible:sourceRuntimeEligible(sourceId)
  };
}

export function collectorRegistry({ collectionEnabled = false } = {}) {
  return [
    {
      source_id: TED_SOURCE_ID,
      name: "TED — EU tenders",
      status:runtimeStatus(TED_SOURCE_ID, collectionEnabled),
      method: "PUBLIC_API",
      authentication: "NONE",
      ai_cost_usd: 0,
      network_verified: true,
      network_verified_at: "2026-09-05",
      deployed_endpoint_verified: false,
      documentation_url: TED_DOCUMENTATION_URL,
      query_packs:queryPacks(TED_QUERY_PACKS),
      ...relevance(TED_SOURCE_ID)
    },
    {
      source_id:FIND_TENDER_SOURCE_ID,
      name:"Find a Tender — UK OCDS",
      status:runtimeStatus(FIND_TENDER_SOURCE_ID, collectionEnabled),
      method:"OCDS_API",
      authentication:"NONE",
      ai_cost_usd:0,
      network_verified:true,
      network_verified_at:"2026-09-05",
      deployed_endpoint_verified:false,
      documentation_url:FIND_TENDER_DOCUMENTATION_URL,
      query_packs:queryPacks(FIND_TENDER_QUERY_PACKS),
      ...relevance(FIND_TENDER_SOURCE_ID)
    },
    {
      source_id:CONTRACTS_FINDER_SOURCE_ID,
      name:"Contracts Finder — UK OCDS",
      status:runtimeStatus(CONTRACTS_FINDER_SOURCE_ID, collectionEnabled),
      method:"OCDS_API",
      authentication:"NONE",
      ai_cost_usd:0,
      network_verified:true,
      network_verified_at:"2026-09-05",
      deployed_endpoint_verified:false,
      documentation_url:CONTRACTS_FINDER_DOCUMENTATION_URL,
      query_packs:queryPacks(CONTRACTS_FINDER_QUERY_PACKS),
      ...relevance(CONTRACTS_FINDER_SOURCE_ID)
    },
    ...blockedCommunityCollectors.map((collector) => ({
      ...collector,
      status: "BLOCKED_ACCESS_REVIEW",
      authentication: "NONE",
      ai_cost_usd: 0,
      network_verified: false,
      network_verified_at: null,
      deployed_endpoint_verified: false,
      access_review_status:"COMPLETED_BLOCKED",
      access_reviewed_at:"2026-09-05",
      query_packs: []
    }))
  ];
}
