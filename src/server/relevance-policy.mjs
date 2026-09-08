const EXCLUDED_WORKFLOW_PATTERNS = Object.freeze([
  /\breallusion\b/i,
  /\biclone\b/i,
  /\bcharacter\s+creator\s*(?:3|4|cc3|cc4)\b/i,
  /\bdaz(?:\s*3d|\s+studio)\b/i
]);

const EXTERNAL_VENDOR_PATTERNS = Object.freeze([
  /\b(?:contract|freelance|outsourc(?:e|ing)|external\s+development|vendor|supplier|subcontract|production\s+overflow|rfp|rfq)\b/i,
  /\b(?:zak[aá]zk(?:a|y)|popt[aá]vk(?:a|y)|dodavatel|extern[ií]\s+t[yý]m|ve[řr]ejn[aá]\s+zak[aá]zka)\b/i,
  /\b(?:z[aá]kazk(?:a|y)|dopyt|dod[aá]vate[ľl]|extern[yý]\s+t[ií]m|verejn[eé]\s+obstar[aá]vanie)\b/i
]);

const HERITAGE_PATTERNS = Object.freeze([
  /\bcultural\s+heritage\b/i,
  /\bmuse(?:um|ums|al)\b/i,
  /\barchive\s+collection\b/i,
  /\bcollection\s+objects?\b/i,
  /\b(?:artefacts?|artifacts?|historic(?:al)?\s+objects?|costumes?|textiles?)\b/i,
  /\b(?:kulturn[ií]\s+d[eě]dictv[ií]|muze(?:um|a|jn[ií])|sb[ií]rkov(?:[yý]|[eé])\s+p[řr]edm[eě]t|kroj(?:e|ů)?|pam[aá]tk(?:a|y|ov[yý]))\b/i,
  /\b(?:kult[uú]rne\s+dedi[cč]stvo|m[uú]ze(?:um|jn[eé])|zbierkov(?:[yý]|[eé])\s+predmet|kroj(?:e|ov)?|pamiatk(?:a|y|ov[yý]))\b/i
]);

const PHYSICAL_CAPTURE_PATTERNS = Object.freeze([
  /\b(?:3d\s+)?scan(?:ning)?\b/i,
  /\bphotogrammetr(?:y|ic)\b/i,
  /\bdigitization\s+capture\b/i,
  /\b(?:3d\s+)?skenov[aá]n[ií]\b/i,
  /\bfotogrammetr(?:ie|ick[éa])\b/i,
  /\b(?:3d\s+)?skenovanie\b/i,
  /\bfotogrametri(?:a|ck[ée])\b/i
]);

const PROVIDED_DATA_PATTERNS = Object.freeze([
  /\b(?:provided|existing|supplied|pre-captured)\s+(?:photos?|images?|scans?|meshes?|data)\b/i,
  /\b(?:client|museum)\s+(?:provides?|supplies?)\s+(?:photos?|images?|scans?|meshes?|data)\b/i,
  /\b(?:dodan[éea]|existuj[ií]c[ií])\s+(?:fotografie|sn[ií]mky|skeny|data|modely)\b/i,
  /\b(?:dodan[éea]|existuj[uú]ce)\s+(?:fotografie|sn[ií]mky|skeny|d[aá]ta|modely)\b/i
]);

const CZ_SK_LOCATION_PATTERNS = Object.freeze([
  /\b(?:czechia|czech\s+republic|slovakia|slovak\s+republic|cz|sk)\b/i,
  /\b(?:česko|česk[aá]\s+republika|slovensko)\b/i,
  /\b(?:praha|prague|brno|ostrava|plze[nň]|olomouc|zl[ií]n|hradec\s+kr[aá]lov[eé]|pardubice|liberec|česk[eé]\s+bud[eě]jovice|uhersk[eé]\s+hradi[sš]t[eě])\b/i,
  /\b(?:bratislava|ko[sš]ice|pre[sš]ov|[zž]ilina|nitra|bansk[aá]\s+bystrica|trnava|tren[cč][ií]n)\b/i
]);

function candidateText(candidate) {
  return [
    candidate?.title,
    candidate?.summary,
    candidate?.eligibility_reason,
    candidate?.location,
    ...(Array.isArray(candidate?.why_it_fits) ? candidate.why_it_fits : []),
    ...(Array.isArray(candidate?.risks) ? candidate.risks : []),
    ...(Array.isArray(candidate?.missing_requirements) ? candidate.missing_requirements : [])
  ].filter(Boolean).join(" \n ");
}

function matchesAny(patterns, value) {
  return patterns.some((pattern) => pattern.test(value));
}

export function freshnessConfidence(freshnessBasis) {
  if (freshnessBasis === "PUBLISHED_DATE") return "high";
  if (freshnessBasis === "SOURCE_UPDATED_DATE") return "medium";
  if (freshnessBasis === "ACTIVE_ACCEPTANCE_EVIDENCE") return "low";
  return null;
}

export function evaluateCandidateRelevance(candidate) {
  const text = candidateText(candidate);
  if (matchesAny(EXCLUDED_WORKFLOW_PATTERNS, text)) {
    return { ok:false, rejection:"excluded_workflow" };
  }
  if (String(candidate?.commercial_role || "").toUpperCase() === "EMPLOYER"
    && !matchesAny(EXTERNAL_VENDOR_PATTERNS, text)) {
    return { ok:false, rejection:"individual_employment" };
  }

  const categories = new Set(Array.isArray(candidate?.categories) ? candidate.categories : []);
  const heritage = categories.has("CULTURAL_HERITAGE_3D") || matchesAny(HERITAGE_PATTERNS, text);
  const physicalCapture = categories.has("CAPTURE") || matchesAny(PHYSICAL_CAPTURE_PATTERNS, text);
  const remotePostprocess = categories.has("HERITAGE_POSTPROCESSING")
    || ((categories.has("PHOTOGRAMMETRY_PROCESSING") || categories.has("SCAN_CLEANUP"))
      && matchesAny(PROVIDED_DATA_PATTERNS, text));
  const czSkLocation = matchesAny(CZ_SK_LOCATION_PATTERNS, text);

  if (heritage && physicalCapture && !remotePostprocess && !czSkLocation) {
    return { ok:false, rejection:"heritage_capture_outside_cz_sk" };
  }

  return { ok:true, rejection:null };
}
