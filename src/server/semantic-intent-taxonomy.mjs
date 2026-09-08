const HINTS = Object.freeze({
  HUMAN_DIGITAL_DOUBLE:"Search buyer language about actor or customer likeness, recognisable faces, digital doubles, scan-derived hero humans, interchangeable heads/bodies/hair and modular realistic casts; tool names are optional.",
  AI_DATASET_CAPTURE:"Search paid supplier demand for participant capture, multi-person face/body datasets and coordinated image or 3D acquisition; reject participant recruitment without a production contract.",
  SCAN_CLEANUP_WRAP:"Search production problems such as fused or missing fingers, holes, damaged hair, noisy surfaces, inconsistent topology, basemesh fitting, deformation-ready heads and supplied scans needing repair; tool names are optional.",
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
  wrap3d_face_pipeline:["SCAN_CLEANUP_WRAP"],
  zbrush_scan_cleanup:["SCAN_CLEANUP_WRAP"],
  substance_scan_texturing:["PHOTOGRAMMETRY_ASSETS"],
  batch_scan_postproduction:["SCAN_CLEANUP_WRAP", "REMOTE_OVERFLOW"],
  realistic_human_marketplace_projects:["HUMAN_DIGITAL_DOUBLE", "REMOTE_OVERFLOW"],
  digital_double_marketplace_projects:["HUMAN_DIGITAL_DOUBLE"],
  character_overflow_communities:["REMOTE_OVERFLOW"],
  marketplace_paid_tests_batches:["REMOTE_OVERFLOW"],
  een_business_requests:["REMOTE_OVERFLOW"],
  een_technology_requests:["PHOTOGRAMMETRY_ASSETS"],
  heritage_ted:["MUSEUM_DIGITISATION", "TENDER_PLAN_AWARD"],
  heritage_nen_cz:["MUSEUM_DIGITISATION", "TENDER_PLAN_AWARD"],
  heritage_uvo_sk:["MUSEUM_DIGITISATION", "TENDER_PLAN_AWARD"],
  human_capture_global_procurement:["AI_DATASET_CAPTURE", "TENDER_PLAN_AWARD"],
  cz_sk_heritage_funding:["HERITAGE_FUNDED"],
  heritage_uk_remote_processing:["MUSEUM_DIGITISATION", "PHOTOGRAMMETRY_ASSETS"],
  english_marketplace_freshness:["HUMAN_DIGITAL_DOUBLE", "SCAN_CLEANUP_WRAP", "REMOTE_OVERFLOW"],
  german_french_buyer_sweep:["HUMAN_DIGITAL_DOUBLE", "SCAN_CLEANUP_WRAP", "REMOTE_OVERFLOW"],
  romance_buyer_sweep:["HUMAN_DIGITAL_DOUBLE", "SCAN_CLEANUP_WRAP", "REMOTE_OVERFLOW"],
  central_europe_buyer_sweep:["HUMAN_DIGITAL_DOUBLE", "MUSEUM_DIGITISATION", "REMOTE_OVERFLOW"],
  active_backfill_31_90_days:["HUMAN_DIGITAL_DOUBLE", "SCAN_CLEANUP_WRAP", "REMOTE_OVERFLOW"]
});

export const SEMANTIC_INTENT_CATEGORIES = Object.freeze(Object.keys(HINTS));

export function semanticIntentHintForShard(shardId) {
  const categories = SHARD_CATEGORIES[shardId] || [];
  return categories.map((category) => HINTS[category]).join(" ");
}

export function semanticIntentCoverage() {
  return Object.fromEntries(Object.entries(SHARD_CATEGORIES).map(([id,categories]) => [id,[...categories]]));
}
