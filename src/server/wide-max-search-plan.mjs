const shard = (id, label, allowedDomains, focus) => Object.freeze({
  id,
  label,
  allowed_domains:Object.freeze(allowedDomains),
  focus
});

const MARKETPLACES = ["upwork.com", "freelancer.com", "peopleperhour.com", "guru.com"];
const COMMUNITIES = ["reddit.com", "forums.unrealengine.com", "polycount.com", "blenderartists.org", "discussions.unity.com"];
const GLOBAL_PROCUREMENT = ["sam.gov", "canadabuys.canada.ca", "worldbank.org"];
const UN_PROCUREMENT = ["ungm.org", "procurement-notices.undp.org"];
const EEN_REQUESTS = ["een.ec.europa.eu"];
const CZECH_HERITAGE = ["nen.nipez.cz", "zakazky.gov.cz", "zakazky.krajbezkorupce.cz", "zakazky.kr-stredocesky.cz"];
const SLOVAK_HERITAGE = ["uvo.gov.sk", "josephine.proebiz.com"];
const FRENCH_BUYER_MARKETPLACES = ["codeur.com"];
const CZ_SK_HERITAGE_FUNDING = ["mk.gov.cz", "fpu.sk", "culture.gov.sk", "eeagrants.org"];

const rejectNoise = "Require an active buyer purchasing a concrete production deliverable that a Czech/European external studio or team can deliver. Reject every employee vacancy even if it says contract, B2B or external development; also reject sellers, portfolios, training, hardware, unpaid/rev-share work, software/pipeline development, Reallusion Character Creator/CC3/CC4, iClone and Daz3D.";

// Bump this whenever the deployed shard set or its acceptance semantics change.
// Paid-operation identity includes this version so a newly released plan cannot
// replay results produced by an older plan on the same UTC date.
export const WIDE_MAX_PLAN_VERSION = "deep-source-layer-v2";

export const WIDE_MAX_SEARCH_SHARDS = Object.freeze([
  shard("human_face_body_marketplaces", "Human face/body capture · marketplaces", MARKETPLACES,
    `Find worldwide paid requests for face, head, body or full-person photogrammetry and 3D scanning, including multi-person capture. ${rejectNoise}`),
  shard("human_ai_dataset_marketplaces", "Human AI datasets · marketplaces", MARKETPLACES,
    `Find worldwide paid buyer requests for diverse or multi-ethnicity human image/3D datasets, digital-human source capture and computer-vision data production that require casting plus capture or scanning. Reject research participants, model-only casting and biometric surveillance. ${rejectNoise}`),
  shard("human_casting_capture_procurement", "Casting + capture · procurement", ["ted.europa.eu", ...GLOBAL_PROCUREMENT, ...UN_PROCUREMENT],
    `Find public procurement for casting, recruiting or coordinating people together with face/body imaging, photogrammetry, 3D capture or human-data acquisition. Casting without capture is irrelevant. ${rejectNoise}`),
  shard("realitycapture_processing", "RealityCapture processing", [...MARKETPLACES, ...COMMUNITIES],
    `Find paid requests for RealityCapture reconstruction, alignment, mesh generation, texture reprojection or batch photogrammetry processing from supplied imagery. Blender may be supplementary. ${rejectNoise}`),
  shard("wrap3d_face_pipeline", "Wrap3D face pipeline", [...MARKETPLACES, ...COMMUNITIES],
    `Find paid requests matching Faceform Wrap3D or R3DS Wrap work: scan-to-basemesh conforming, topology transfer, landmark-based wrapping, facial scan processing or production basemesh delivery. The listing need not name Wrap when the deliverable clearly matches. ${rejectNoise}`),
  shard("zbrush_scan_cleanup", "ZBrush scan cleanup", [...MARKETPLACES, ...COMMUNITIES],
    `Find paid human or object scan-cleanup requests involving holes, fingers, hair, surface repair, sculpt cleanup, high-poly cleanup or production-ready mesh finishing suitable for ZBrush. ${rejectNoise}`),
  shard("substance_scan_texturing", "Substance Painter scan texturing", [...MARKETPLACES, ...COMMUNITIES],
    `Find paid scan-texturing requests involving texture cleanup, reprojection, PBR material creation, Substance Painter finishing or delivery-ready texture sets from photogrammetry data. ${rejectNoise}`),
  shard("batch_scan_postproduction", "Batch scan post-production", [...MARKETPLACES, ...COMMUNITIES],
    `Find recurring, ongoing, volume or production-overflow requests for processing batches of human or object scans through reconstruction, cleanup, wrapping and texturing. ${rejectNoise}`),
  shard("realistic_human_marketplace_projects", "Realistic humans · buyer projects", MARKETPLACES,
    `Find current buyer project briefs commissioning realistic human characters, scan-derived humans, facial assets, FACS/expression processing or digital doubles from a production team. Reject individual vacancies, stylized-only work and animation-only work. ${rejectNoise}`),
  shard("digital_double_marketplace_projects", "Digital doubles · buyer projects", MARKETPLACES,
    `Find current client projects buying digital-double, photoreal human, likeness, facial scan or scan-derived human-character assets. Require asset deliverables rather than an employee, programmer or realtime technical artist. ${rejectNoise}`),
  shard("character_overflow_communities", "Character overflow · communities", ["reddit.com", "forums.unrealengine.com", "polycount.com"],
    `Find current HIRING or PAID posts seeking an external team for realistic-human character overflow, scan cleanup, digital doubles or facial production. Reject FOR HIRE posts and individual permanent jobs. ${rejectNoise}`),
  shard("marketplace_paid_tests_batches", "Paid tests and batches · marketplaces", MARKETPLACES,
    `Find current paid tests, pilots, batches, recurring volumes or overflow packages for human scans, heads, bodies, realistic characters, retopology, wrapping, cleanup or texturing. Prefer briefs that explicitly ask about team capacity. ${rejectNoise}`),
  shard("een_business_requests", "EEN · business requests", EEN_REQUESTS,
    `Find exact current Enterprise Europe Network Business Request detail pages where a buyer seeks an outsourcing supplier, subcontractor or production partner for human 3D capture, photogrammetry processing, museum-object 3D work, digital humans or realistic characters. Reject Business Offers, Technology Offers and unfunded generic networking. ${rejectNoise}`),
  shard("een_technology_requests", "EEN · technology requests", EEN_REQUESTS,
    `Find exact current Enterprise Europe Network Technology Request detail pages buying or subcontracting production services for photogrammetry, 3D reconstruction, scan cleanup, human datasets, digital humans or museum-object digitisation. Reject Technology Offers, software-only R&D and generic consortium recruitment. ${rejectNoise}`),
  shard("heritage_ted", "Cultural heritage · TED", ["ted.europa.eu"],
    `Find active TED notices for photogrammetric 3D digitisation of museum objects, costumes, textiles, artefacts, sculptures or collections. Physical capture qualifies only in Czechia or Slovakia; elsewhere require buyer-supplied photos/scans for remote processing. Reject document scanning, equipment, GIS, BIM and buildings. ${rejectNoise}`),
  shard("heritage_nen_cz", "Cultural heritage · Czech institutional procurement", CZECH_HERITAGE,
    `Search exact Czech NEN, Zakázky GOV and verified E-ZAK museum notice details in Czech for active public contracts covering 3D skenování, fotogrammetrie or 3D digitalizace of museum collection objects, kroje, textiles, artefacts or cultural heritage in Czechia. Reject 2D document/film scanning, scanner purchases, websites, GIS and BIM. ${rejectNoise}`),
  shard("heritage_uvo_sk", "Cultural heritage · Slovak institutional procurement", SLOVAK_HERITAGE,
    `Search exact Slovak ÚVO and JOSEPHINE notice details in Slovak for active public contracts covering 3D skenovanie, fotogrametria or 3D digitalizácia of museum collection objects, kroje, textiles, artefacts or cultural heritage in Slovakia. Reject 2D document/film scanning, scanner purchases, websites, GIS and BIM. ${rejectNoise}`),
  shard("human_capture_global_procurement", "Human capture · global/UN procurement", [...GLOBAL_PROCUREMENT, ...UN_PROCUREMENT],
    `Find active SAM.gov, CanadaBuys or World Bank buyer notices for human 3D capture, photogrammetry, digital-human datasets, face/body scanning or outsourced processing of supplied human scan data. ${rejectNoise}`),
  shard("cz_sk_heritage_funding", "CZ/SK heritage grants and funded recipients", CZ_SK_HERITAGE_FUNDING,
    "Find current Czech or Slovak grant calls explicitly supporting 3D digitisation, 3D scanning or photogrammetry of museum objects, collections, costumes, artefacts or cultural heritage. Also allow a named funded recipient as a POTENTIAL_LEAD only when the awarded project explicitly includes relevant 3D production. Never label a grant as OPEN_OPPORTUNITY; never treat the grant amount as buyer project budget; reject expired calls, generic funding pages, 2D/OCR-only digitisation and building restoration without a 3D deliverable."),
  shard("heritage_uk_remote_processing", "Heritage remote processing · UK", ["find-tender.service.gov.uk", "contractsfinder.service.gov.uk"],
    `Find active UK procurement whose buyer supplies existing heritage photos, scans, meshes or capture data for remote 3D reconstruction, cleanup or texturing. Do not include physical capture outside Czechia or Slovakia. ${rejectNoise}`),
  shard("english_marketplace_freshness", "English buyer sweep", MARKETPLACES,
    `Search fresh English-language buyer briefs from the last 30 days for human scanning, photogrammetry processing, scan cleanup, Wrap3D-style conforming, realistic digital humans and character production overflow. ${rejectNoise}`),
  shard("german_french_buyer_sweep", "German/French buyer sweep", [...MARKETPLACES, ...FRENCH_BUYER_MARKETPLACES, "ted.europa.eu"],
    `Search German and French buyer terminology for current external 3D human scanning, photogrammetry processing, scan cleanup, digital doubles and supplied-data post-production. Return normalized English summaries. ${rejectNoise}`),
  shard("romance_buyer_sweep", "Spanish/Italian/Portuguese buyer sweep", [...MARKETPLACES, "ted.europa.eu"],
    `Search Spanish, Italian and Portuguese buyer terminology for current external 3D human scanning, photogrammetry processing, scan cleanup, digital doubles and supplied-data post-production. Return normalized English summaries. ${rejectNoise}`),
  shard("central_europe_buyer_sweep", "Polish/Czech/Slovak buyer sweep", [...MARKETPLACES, "ted.europa.eu", "nen.nipez.cz", "uvo.gov.sk"],
    `Search Polish, Czech and Slovak buyer terminology for current external human scanning, photogrammetry processing, scan cleanup, realistic humans and CZ/SK cultural-heritage 3D procurement. Return normalized English summaries. ${rejectNoise}`),
  shard("active_backfill_31_90_days", "Active buyer backfill · 31–90 days", [...MARKETPLACES, ...COMMUNITIES, ...EEN_REQUESTS, "ted.europa.eu"],
    `Search buyer briefs published 31 to 90 days ago only when the exact original page explicitly proves that proposals are still accepted now. Focus on human capture, supplied-scan post-production, digital doubles, realistic-human batches and character production overflow. Omit anything merely indexed, archived, filled or undated. ${rejectNoise}`)
]);

export const WIDE_MAX_OPENAI_REQUEST_LIMIT = WIDE_MAX_SEARCH_SHARDS.length;
export const WIDE_MAX_TOOL_CALLS_PER_SHARD = 3;
export const WIDE_MAX_TOTAL_TOOL_CALL_LIMIT = WIDE_MAX_OPENAI_REQUEST_LIMIT * WIDE_MAX_TOOL_CALLS_PER_SHARD;
export const WIDE_MAX_RESULTS_PER_SHARD = 6;
export const WIDE_MAX_MAX_CONCURRENCY = 5;

export function validateWideMaxPlan(shards = WIDE_MAX_SEARCH_SHARDS) {
  if (!Array.isArray(shards) || shards.length !== 25) return false;
  const ids = new Set();
  for (const item of shards) {
    if (!item?.id || ids.has(item.id) || !item?.label || !item?.focus || !item.allowed_domains?.length) return false;
    ids.add(item.id);
  }
  return true;
}
