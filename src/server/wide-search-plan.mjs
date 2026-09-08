const shard = (id, label, allowedDomains, focus) => Object.freeze({
  id,
  label,
  allowed_domains:Object.freeze(allowedDomains),
  focus
});

export const WIDE_SEARCH_SHARDS = Object.freeze([
  shard("human_data_capture_worldwide", "Worldwide human data capture",
    ["upwork.com", "freelancer.com", "peopleperhour.com", "guru.com", "ted.europa.eu", "sam.gov", "ungm.org", "procurement-notices.undp.org", "worldbank.org"],
    "Find current buyer requests worldwide for multi-person or multi-ethnicity human photogrammetry, face/body capture, AI or computer-vision human datasets, digital-human source capture, casting plus scanning, and batch talent/data acquisition. Require an external vendor, production supplier or contract request. Reject research participants, model-only casting notices, biometric-surveillance systems, capture hardware and ordinary jobs."),
  shard("scan_postproduction_worldwide", "Worldwide scan post-production",
    ["upwork.com", "freelancer.com", "peopleperhour.com", "guru.com", "reddit.com", "forums.unrealengine.com", "polycount.com", "blenderartists.org"],
    "Find current paid buyer requests worldwide for processing supplied human or object scans: RealityCapture reconstruction, ZBrush cleanup, Substance Painter texturing, Faceform Wrap3D/R3DS Wrap, topology transfer, texture reprojection and batch photogrammetry post-production. Blender may be supplementary but Blender-only generalist work is not sufficient. Reject FOR HIRE, portfolios, unpaid/rev-share work, Reallusion Character Creator software (CC3/CC4), iClone and Daz3D work."),
  shard("character_vendor_pipeline", "External character production",
    ["workwithindies.com", "remotegamejobs.com", "hitmarker.net", "gamesjobsdirect.com", "artstation.com", "gamejobs.co", "vfxengine.com", "greenhouse.io", "lever.co", "ashbyhq.com", "smartrecruiters.com", "workable.com", "teamtailor.com", "recruitee.com", "reddit.com", "forums.unrealengine.com", "polycount.com"],
    "Find explicit current B2B vendor, freelance-team, outsourcing, external-development, subcontract or production-overflow demand for realistic scanned humans, digital doubles, facial/FACS processing or delivery-ready human characters. Do not return permanent employee roles, generic Character Artist jobs, stylized character work, game-engine-only roles, Reallusion Character Creator software (CC3/CC4), iClone or Daz3D work."),
  shard("cultural_heritage_cz_sk", "CZ/SK cultural heritage 3D",
    ["ted.europa.eu", "nen.nipez.cz", "uvo.gov.sk"],
    "Search Czech and Slovak open tender detail pages for photogrammetric 3D digitisation of museum collection objects, costumes, textiles, artefacts, sculptures and cultural heritage for exhibitions, conservation records or online collections. Physical capture must take place only in Czechia or Slovakia. Worldwide work qualifies only when the buyer supplies already captured photos/scans for remote post-production. Reject document/film scanning, scanner purchases, websites without 3D capture, immersive exhibition production, GIS, BIM, buildings, terrain and infrastructure."),
  shard("worldwide_multilingual_buyer_sweep", "Worldwide multilingual buyer sweep",
    ["upwork.com", "freelancer.com", "peopleperhour.com", "guru.com", "reddit.com", "forums.unrealengine.com", "polycount.com", "blenderartists.org", "workwithindies.com", "remotegamejobs.com", "greenhouse.io", "lever.co", "ashbyhq.com", "smartrecruiters.com", "workable.com", "teamtailor.com", "recruitee.com", "ted.europa.eu", "find-tender.service.gov.uk", "contractsfinder.service.gov.uk", "sam.gov", "canadabuys.canada.ca", "ungm.org", "procurement-notices.undp.org", "worldbank.org", "een.ec.europa.eu"],
    "Run a final buyer-demand freshness sweep in English, Czech, Slovak, German, French, Spanish, Italian, Polish, Portuguese and Japanese. Cover worldwide human capture/casting, remote scan post-production and realistic-human vendor demand missed by the dedicated shards. Reject ordinary employment, seller/service pages, Reallusion Character Creator software (CC3/CC4), iClone, Daz3D and undated pages without explicit current acceptance evidence.")
]);

export const WIDE_SEARCH_MAX_OPENAI_REQUESTS = WIDE_SEARCH_SHARDS.length;
export const WIDE_SEARCH_MAX_TOOL_CALLS_PER_SHARD = 3;
export const WIDE_SEARCH_MAX_TOTAL_TOOL_CALLS = WIDE_SEARCH_MAX_OPENAI_REQUESTS * WIDE_SEARCH_MAX_TOOL_CALLS_PER_SHARD;

export function validateWideSearchPlan(shards = WIDE_SEARCH_SHARDS) {
  const ids = new Set();
  for (const item of shards) {
    if (!item?.id || ids.has(item.id) || !item?.label || !item?.focus || !item.allowed_domains?.length) return false;
    ids.add(item.id);
  }
  return true;
}
