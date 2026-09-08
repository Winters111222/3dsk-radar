const shard = (id, label, allowedDomains, focus) => Object.freeze({
  id,
  label,
  allowed_domains:Object.freeze(allowedDomains),
  focus
});

const MARKETPLACES = ["upwork.com", "freelancer.com", "peopleperhour.com", "guru.com"];
const COMMUNITIES = ["reddit.com", "forums.unrealengine.com", "polycount.com", "blenderartists.org"];
const INDIE_JOBS = ["workwithindies.com", "remotegamejobs.com", "hitmarker.net", "gamesjobsdirect.com", "artstation.com", "gamejobs.co", "vfxengine.com"];
const ATS_A = ["greenhouse.io", "lever.co"];
const ATS_B = ["ashbyhq.com", "workable.com"];
const ATS_C = ["smartrecruiters.com", "teamtailor.com", "recruitee.com"];
const GLOBAL_PROCUREMENT = ["sam.gov", "canadabuys.canada.ca", "worldbank.org"];
const UN_PROCUREMENT = ["ungm.org", "procurement-notices.undp.org"];

const rejectNoise = "Require explicit current buyer, external-vendor, contract, freelance-team, outsourcing, subcontract, RFP/RFQ or production-overflow demand. Reject permanent employment, sellers, portfolios, training, hardware, unpaid/rev-share work, Reallusion Character Creator/CC3/CC4, iClone and Daz3D.";

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
  shard("realistic_humans_indie", "Realistic humans · indie/contract", INDIE_JOBS,
    `Find explicit contract-studio or external-vendor demand for realistic humans, scanned characters, facial assets, FACS/expression processing or digital doubles. Reject ordinary Character Artist employment and stylized-only work. ${rejectNoise}`),
  shard("digital_doubles_vfx", "Digital doubles · VFX", ["vfxengine.com", "artstation.com", "gamesjobsdirect.com", "hitmarker.net", "gamejobs.co"],
    `Find current outsourced digital-double, photoreal human, face replacement source asset, facial scan or VFX human-character production briefs suitable for a studio vendor. ${rejectNoise}`),
  shard("character_overflow_communities", "Character overflow · communities", ["reddit.com", "forums.unrealengine.com", "polycount.com"],
    `Find current HIRING or PAID posts seeking an external team for realistic-human character overflow, scan cleanup, digital doubles or facial production. Reject FOR HIRE posts and individual permanent jobs. ${rejectNoise}`),
  shard("character_vendor_greenhouse_lever", "Character vendors · Greenhouse/Lever", ATS_A,
    `Find exact ATS detail pages that explicitly allow contract, freelance, vendor, outsourcing or external-development delivery for realistic human or scan-based character work. Ordinary employee vacancies are irrelevant. ${rejectNoise}`),
  shard("character_vendor_ashby_workable", "Character vendors · Ashby/Workable", ATS_B,
    `Find exact ATS detail pages that explicitly allow contract, freelance, vendor, outsourcing or external-development delivery for realistic human or scan-based character work. Ordinary employee vacancies are irrelevant. ${rejectNoise}`),
  shard("character_vendor_recruiting_ats", "Character vendors · recruiting ATS", ATS_C,
    `Find exact ATS detail pages that explicitly allow contract, freelance, vendor, outsourcing or external-development delivery for realistic human or scan-based character work. Ordinary employee vacancies are irrelevant. ${rejectNoise}`),
  shard("heritage_ted", "Cultural heritage · TED", ["ted.europa.eu"],
    `Find active TED notices for photogrammetric 3D digitisation of museum objects, costumes, textiles, artefacts, sculptures or collections. Physical capture qualifies only in Czechia or Slovakia; elsewhere require buyer-supplied photos/scans for remote processing. Reject document scanning, equipment, GIS, BIM and buildings. ${rejectNoise}`),
  shard("heritage_nen_cz", "Cultural heritage · Czech NEN", ["nen.nipez.cz"],
    `Search Czech NEN exact notice details in Czech for active public contracts covering 3D skenování, fotogrammetrie or 3D digitalizace of museum collection objects, kroje, textiles, artefacts or cultural heritage in Czechia. Reject 2D document/film scanning, scanner purchases, websites, GIS and BIM. ${rejectNoise}`),
  shard("heritage_uvo_sk", "Cultural heritage · Slovak ÚVO", ["uvo.gov.sk"],
    `Search Slovak ÚVO exact notice details in Slovak for active public contracts covering 3D skenovanie, fotogrametria or 3D digitalizácia of museum collection objects, kroje, textiles, artefacts or cultural heritage in Slovakia. Reject 2D document/film scanning, scanner purchases, websites, GIS and BIM. ${rejectNoise}`),
  shard("human_capture_global_procurement", "Human capture · global procurement", GLOBAL_PROCUREMENT,
    `Find active SAM.gov, CanadaBuys or World Bank buyer notices for human 3D capture, photogrammetry, digital-human datasets, face/body scanning or outsourced processing of supplied human scan data. ${rejectNoise}`),
  shard("human_capture_un_procurement", "Human capture · UN procurement", UN_PROCUREMENT,
    `Find active UNGM or UNDP buyer notices for human 3D capture, photogrammetry, digital-human datasets, face/body scanning or outsourced processing of supplied human scan data. ${rejectNoise}`),
  shard("heritage_uk_remote_processing", "Heritage remote processing · UK", ["find-tender.service.gov.uk", "contractsfinder.service.gov.uk"],
    `Find active UK procurement whose buyer supplies existing heritage photos, scans, meshes or capture data for remote 3D reconstruction, cleanup or texturing. Do not include physical capture outside Czechia or Slovakia. ${rejectNoise}`),
  shard("english_marketplace_freshness", "English buyer sweep", MARKETPLACES,
    `Search fresh English-language buyer briefs from the last 30 days for human scanning, photogrammetry processing, scan cleanup, Wrap3D-style conforming, realistic digital humans and character production overflow. ${rejectNoise}`),
  shard("german_french_buyer_sweep", "German/French buyer sweep", [...MARKETPLACES, "ted.europa.eu"],
    `Search German and French buyer terminology for current external 3D human scanning, photogrammetry processing, scan cleanup, digital doubles and supplied-data post-production. Return normalized English summaries. ${rejectNoise}`),
  shard("romance_buyer_sweep", "Spanish/Italian/Portuguese buyer sweep", [...MARKETPLACES, "ted.europa.eu"],
    `Search Spanish, Italian and Portuguese buyer terminology for current external 3D human scanning, photogrammetry processing, scan cleanup, digital doubles and supplied-data post-production. Return normalized English summaries. ${rejectNoise}`),
  shard("central_europe_buyer_sweep", "Polish/Czech/Slovak buyer sweep", [...MARKETPLACES, "ted.europa.eu", "nen.nipez.cz", "uvo.gov.sk"],
    `Search Polish, Czech and Slovak buyer terminology for current external human scanning, photogrammetry processing, scan cleanup, realistic humans and CZ/SK cultural-heritage 3D procurement. Return normalized English summaries. ${rejectNoise}`),
  shard("japanese_global_freshness", "Japanese/global freshness sweep", [...MARKETPLACES, ...INDIE_JOBS, ...ATS_A, ...ATS_B, ...ATS_C, "ted.europa.eu"],
    `Run a final Japanese and English freshness sweep for explicit current buyer demand missed by other shards: human capture/casting, supplied-scan post-production, digital doubles and realistic-human vendor overflow. Return normalized English summaries and omit weak or undated pages without current acceptance evidence. ${rejectNoise}`)
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
