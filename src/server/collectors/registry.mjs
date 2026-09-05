import { TED_DOCUMENTATION_URL, TED_QUERY_PACKS, TED_SOURCE_ID } from "./ted.mjs";

const blockedCommunityCollectors = Object.freeze([
  { source_id:"polycount_paid", name:"Polycount — paid freelance", method:"HTML_AFTER_REVIEW" },
  { source_id:"unreal_job_offerings", name:"Unreal — Job Offerings", method:"HTML_OR_FEED_AFTER_REVIEW" },
  { source_id:"blender_paid", name:"Blender Artists — Paid Work", method:"HTML_OR_FEED_AFTER_REVIEW" }
]);

export function collectorRegistry({ collectionEnabled = false } = {}) {
  return [
    {
      source_id: TED_SOURCE_ID,
      name: "TED — EU tenders",
      status: collectionEnabled ? "READY" : "LOCKED",
      method: "PUBLIC_API",
      authentication: "NONE",
      ai_cost_usd: 0,
      network_verified: true,
      network_verified_at: "2026-09-05",
      deployed_endpoint_verified: false,
      documentation_url: TED_DOCUMENTATION_URL,
      query_packs: Object.entries(TED_QUERY_PACKS).map(([id, pack]) => ({ id, label:pack.label, categories:[...pack.categories] }))
    },
    ...blockedCommunityCollectors.map((collector) => ({
      ...collector,
      status: "BLOCKED_ACCESS_REVIEW",
      authentication: "PENDING_REVIEW",
      ai_cost_usd: 0,
      network_verified: false,
      network_verified_at: null,
      deployed_endpoint_verified: false,
      query_packs: []
    }))
  ];
}
