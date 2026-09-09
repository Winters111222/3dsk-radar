const HINTS = Object.freeze({
  HUMAN_DIGITAL_DOUBLE:"Search buyer language about actor or customer likeness, recognisable faces, digital doubles, scan-derived hero humans, interchangeable heads/bodies/hair and modular realistic casts; tool names are optional.",
  AI_DATASET_CAPTURE:"Search paid supplier demand for participant capture, multi-person face/body datasets and coordinated image or 3D acquisition; reject participant recruitment without a production contract.",
  SCAN_CLEANUP_WRAP:"Search production problems such as fused or missing fingers, holes, damaged hair, noisy surfaces, inconsistent topology, basemesh fitting, deformation-ready heads and supplied scans needing repair; tool names are optional.",
  SUPPLIED_SCAN_REPAIR:"Search buyer briefs where photos, raw meshes or scans are already supplied and one human head, face or body needs holes, fused fingers, hair, likeness or surface damage repaired as a paid deliverable.",
  LIKENESS_CLEANUP:"Search face or head work described through recognisable likeness, portrait fidelity, expression-ready topology, asymmetry correction, skin detail preservation or cleanup of a supplied scan rather than named tools.",
  CHARACTER_FINISHING:"Search buyers who have a partly completed realistic human and need a bounded modeling, UV, texture, PBR, topology or final-delivery package; reject animation-only and software-only briefs.",
  SINGLE_ASSET_HANDOFF:"Search one-off, fixed-price, per-model, per-scan and paid-test handoffs for one realistic human asset. Small scope is valid when the buyer, deliverable, active application route and individual eligibility are proven.",
  PHOTOGRAMMETRY_ASSETS:"Search buyers who already have photos, scans or meshes and need alignment, reconstruction, de-lighting, PBR maps, texture reprojection, optimization or game/XR-ready derivatives.",
  REMOTE_OVERFLOW:"Search buyer events such as backlog, milestone pressure, vertical-slice-to-production transition, paid art tests, per-asset quotes, recurring batches, vendor onboarding and external capacity.",
  MUSEUM_DIGITISATION:"Search concrete 3D collection objects, digital exhibitions, virtual reconstructions and processing of existing museum data; reject 2D archives, hardware and foreign physical capture without a local partner.",
  HERITAGE_FUNDED:"Search open calls, positive award amounts, named recipients, active pilots, planned purchases and award-to-subcontract events. Funding alone is signal-only until a remaining external asset package is proven.",
  TENDER_PLAN_AWARD:"Search the full lifecycle: prior information, market consultation, RFI, planned procurement, active lot, amendment, award and re-tender. Only an active buyer request may become an open opportunity."
});

const SHARD_CATEGORIES = Object.freeze({
  human_face_body_marketplaces:["HUMAN_DIGITAL_DOUBLE"],
  human_ai_dataset_marketplaces:["AI_DATASET_CAPTURE"],
  human_casting_capture_procurement:["AI_DATASET_CAPTURE", "TENDER_PLAN_AWARD"],
  realitycapture_processing:["PHOTOGRAMMETRY_ASSETS"],
  wrap3d_face_pipeline:["SCAN_CLEANUP_WRAP", "LIKENESS_CLEANUP", "SUPPLIED_SCAN_REPAIR"],
  zbrush_scan_cleanup:["SCAN_CLEANUP_WRAP", "SUPPLIED_SCAN_REPAIR", "SINGLE_ASSET_HANDOFF"],
  substance_scan_texturing:["PHOTOGRAMMETRY_ASSETS", "CHARACTER_FINISHING"],
  batch_scan_postproduction:["SCAN_CLEANUP_WRAP", "SUPPLIED_SCAN_REPAIR", "REMOTE_OVERFLOW"],
  realistic_human_marketplace_projects:["HUMAN_DIGITAL_DOUBLE", "CHARACTER_FINISHING", "SINGLE_ASSET_HANDOFF", "REMOTE_OVERFLOW"],
  digital_double_marketplace_projects:["HUMAN_DIGITAL_DOUBLE", "LIKENESS_CLEANUP", "CHARACTER_FINISHING"],
  character_overflow_communities:["REMOTE_OVERFLOW"],
  marketplace_paid_tests_batches:["SINGLE_ASSET_HANDOFF", "CHARACTER_FINISHING", "REMOTE_OVERFLOW"],
  een_business_requests:["REMOTE_OVERFLOW"],
  een_technology_requests:["PHOTOGRAMMETRY_ASSETS"],
  heritage_ted:["MUSEUM_DIGITISATION", "TENDER_PLAN_AWARD"],
  heritage_nen_cz:["MUSEUM_DIGITISATION", "TENDER_PLAN_AWARD"],
  heritage_uvo_sk:["MUSEUM_DIGITISATION", "TENDER_PLAN_AWARD"],
  human_capture_global_procurement:["AI_DATASET_CAPTURE", "TENDER_PLAN_AWARD"],
  cz_sk_heritage_funding:["HERITAGE_FUNDED"],
  heritage_uk_remote_processing:["MUSEUM_DIGITISATION", "PHOTOGRAMMETRY_ASSETS"],
  english_marketplace_freshness:["HUMAN_DIGITAL_DOUBLE", "SCAN_CLEANUP_WRAP", "SUPPLIED_SCAN_REPAIR", "SINGLE_ASSET_HANDOFF", "REMOTE_OVERFLOW"],
  german_french_buyer_sweep:["HUMAN_DIGITAL_DOUBLE", "SCAN_CLEANUP_WRAP", "LIKENESS_CLEANUP", "CHARACTER_FINISHING", "REMOTE_OVERFLOW"],
  romance_buyer_sweep:["HUMAN_DIGITAL_DOUBLE", "SCAN_CLEANUP_WRAP", "LIKENESS_CLEANUP", "CHARACTER_FINISHING", "REMOTE_OVERFLOW"],
  central_europe_buyer_sweep:["HUMAN_DIGITAL_DOUBLE", "MUSEUM_DIGITISATION", "SUPPLIED_SCAN_REPAIR", "SINGLE_ASSET_HANDOFF", "REMOTE_OVERFLOW"],
  active_backfill_31_90_days:["HUMAN_DIGITAL_DOUBLE", "SCAN_CLEANUP_WRAP", "SUPPLIED_SCAN_REPAIR", "CHARACTER_FINISHING", "REMOTE_OVERFLOW"]
});

export const SEMANTIC_INTENT_CATEGORIES = Object.freeze(Object.keys(HINTS));

export function semanticIntentHintForShard(shardId) {
  const categories = SHARD_CATEGORIES[shardId] || [];
  return categories.map((category) => HINTS[category]).join(" ");
}

export function semanticIntentCoverage() {
  return Object.fromEntries(Object.entries(SHARD_CATEGORIES).map(([id,categories]) => [id,[...categories]]));
}
