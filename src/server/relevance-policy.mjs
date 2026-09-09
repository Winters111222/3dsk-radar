const EXCLUDED_WORKFLOW_PATTERNS = Object.freeze([
  /\breallusion\b/i,
  /\biclone\b/i,
  /\bcharacter\s+creator(?:\s*(?:3|4|cc3|cc4))?\b/i,
  /\bdaz(?:\s*3d|\s+studio)\b/i
]);

const EXCLUDED_WORKFLOW_NEGATION_PATTERNS = Object.freeze([
  /\b(?:do not|don't|without)\s+(?:use|require|accept)?\s*(?:reallusion|iclone|character\s+creator|daz(?:\s*3d|\s+studio)?)\b/i,
  /\b(?:replace|remove)\s+(?:the\s+)?(?:supplied\s+|existing\s+|current\s+)?(?:reallusion|iclone|character\s+creator|daz(?:\s*3d|\s+studio)?)\b/i,
  /\b(?:migrate|convert)\s+away\s+from\s+(?:reallusion|iclone|character\s+creator|daz(?:\s*3d|\s+studio)?)\b/i
]);

const INACTIVE_SOURCE_PATTERNS = Object.freeze([
  /\b(?:job|role|position|listing|opportunity)\s+is\s+no\s+longer\s+(?:available|accepting\s+applications)\b/i,
  /\bno\s+longer\s+accepting\s+applications\b/i,
  /\bapplications?\s+(?:are\s+)?closed\b/i,
  /\b(?:position|role|vacancy)\s+(?:has\s+been\s+)?filled\b/i,
  /\b(?:closed|archived)\s+(?:job|role|listing|opportunity|thread|post)\b/i
  ,/\b(?:geschlossen|besetzt|abgelaufen|archiviert)\b/i
  ,/\b(?:ferm[ée]|pourvu[e]?|expir[ée]|archiv[ée])\b/i
  ,/\b(?:cerrad[oa]|cubiert[oa]|expirad[oa]|archivad[oa])\b/i
  ,/\b(?:chius[oa]|scadut[oa]|archiviat[oa])\b/i
  ,/\b(?:zamkni[eę]t[ay]|obsadzon[ay]|wygas[łl][ay]?|archiwaln[ay])\b/i
  ,/\b(?:uzav[řr]en[oaé]|obsazen[oaé]|expirovan[oaé]|archivov[aá]n[oaé])\b/i
  ,/\b(?:uzavret[áýé]|obsaden[áýé]|expirovan[áýé]|archivovan[áýé])\b/i
]);

const HARD_EMPLOYMENT_PATTERNS = Object.freeze([
  /\b(?:full[- ]time|permanent|fixed[- ]term|contract[- ]to[- ]hire|employment|employee|staff position|entry[- ]level|payroll)\b/i,
  /\b(?:annual salary|salary range|employee benefits|health insurance|paid vacation|work authorization|visa sponsorship)\b/i,
  /\b(?:submit|send|upload) (?:your )?(?:cv|resume|r[eé]sum[eé])\b/i
]);

const EMPLOYMENT_ROLE_PATTERNS = Object.freeze([
  /\b(?:lead|senior|junior) (?:3d |character |technical )?(?:artist|producer|developer)\b/i
]);

const INDIVIDUAL_PROJECT_PATTERNS = Object.freeze([
  /\b(?:freelance|freelancer|independent contractor|contractor|project[- ]based|one[- ]off|short[- ]term)\b/i,
  /\b(?:fixed[- ]price|hourly|per asset|per model|per scan|single scan|one scan)\b/i,
  /\b(?:need|seeking|looking for|hire)\b.{0,100}\b(?:cleanup|clean up|repair|retopolog(?:y|ist)|wrap3d|zbrush|photogrammetr(?:y|ist)|texture|sculpt)\b/i,
  /\b(?:deliver|delivery|milestone|provided|supplied)\b.{0,100}\b(?:scan|mesh|model|head|face|body|character|texture)\b/i
]);

const STUDIO_BUYER_PATTERNS = Object.freeze([
  /\b(?:external|outsourcing|subcontract(?:or|ing)?|vendor|supplier|studio|agency|production overflow|overflow capacity)\b/i,
  /\b(?:rfp|rfq|request for proposal|request for quotation|tender|procurement)\b/i,
  /\b(?:batch|volume|recurring|ongoing) (?:human |face |body |character |3d )?(?:scans?|assets?|production|deliverables?)\b/i,
  /\bpaid (?:test|pilot)\b/i
  ,/\b(?:suchen|gesucht)\b.{0,80}\b(?:dienstleister|lieferant|partner|unterauftragnehmer)\b/i
  ,/\b(?:recherch(?:e|ons|ent|ez)|cherchons)\b.{0,80}\b(?:prestataire|fournisseur|partenaire|sous-traitant)\b/i
  ,/\b(?:buscamos|se busca)\b.{0,80}\b(?:proveedor|socio|subcontratista)\b/i
  ,/\b(?:cerchiamo|si cerca)\b.{0,80}\b(?:fornitore|partner|subappaltatore)\b/i
  ,/\b(?:szukamy|poszukiwany)\b.{0,80}\b(?:wykonawc|dostawc|partner|podwykonawc)/i
  ,/\b(?:hled[aá]me|popt[aá]v[aá]me)\b.{0,80}\b(?:dodavatel|partner|subdodavatel)/i
  ,/\b(?:h[ľl]ad[aá]me|dopytujeme)\b.{0,80}\b(?:dod[aá]vate[ľl]|partner|subdod[aá]vate[ľl])/i
]);

const SOFTWARE_PIPELINE_PATTERNS = Object.freeze([
  /\b(?:build|develop|adapt|automate|code|program) (?:an? |the |our )?(?:software|script|tool|app|application|pipeline|api)\b/i,
  /\b(?:software|pipeline|automation|computer vision|machine learning) engineer(?:ing)?\b/i,
  /\b(?:python|javascript|typescript|c\+\+) (?:application|script|tool|pipeline|developer|development|automation)\b/i
]);

const PRODUCTION_DELIVERABLE_PATTERNS = Object.freeze([
  /\b(?:scan cleanup|mesh cleanup|retopolog(?:y|ize)|basemesh|wrap3d|r3ds wrap|topology transfer)\b/i,
  /\b(?:reconstruct(?:ion)?|texture cleanup|texture reprojection|substance painter|zbrush)\b/i,
  /\b(?:facial scans?|body scans?|digital doubles?|realistic human characters?)\b/i,
  /\b(?:actor likeness|recognisable face|modular humans?|interchangeable (?:heads?|bodies|hair)|character roster)\b/i,
  /\b(?:animation-ready|deformation-ready|production-ready|game-ready)\s+(?:heads?|humans?|characters?|meshes?|assets?)\b/i,
  /\b(?:fused|missing|damaged)\s+(?:fingers?|hands?|hair)|\b(?:mesh )?holes?\b/i,
  /\b(?:consistent|shared|standardized)\s+topolog(?:y|ies)|\b(?:pbr maps?|de-lighting|texture seams?)\b/i,
  /\b(?:glb|usdz)\b.{0,60}\b(?:human|character|hair|asset)\b/i
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
  const commercialRole = String(candidate?.commercial_role || "").toUpperCase();
  const engagementTrack = String(candidate?.engagement_track || "B2B_STUDIO").toUpperCase();
  if (["BUYER", "PARTNER", "EMPLOYER"].includes(commercialRole) && matchesAny(INACTIVE_SOURCE_PATTERNS, text)) {
    return { ok:false, rejection:"inactive_source_evidence" };
  }
  const workflowEvidence = EXCLUDED_WORKFLOW_NEGATION_PATTERNS.reduce(
    (remaining, explicitException) => remaining.replace(explicitException, " "),
    text
  );
  if (matchesAny(EXCLUDED_WORKFLOW_PATTERNS, workflowEvidence)) {
    return { ok:false, rejection:"excluded_workflow" };
  }
  if (commercialRole === "EMPLOYER") {
    return { ok:false, rejection:"individual_employment" };
  }
  if (matchesAny(HARD_EMPLOYMENT_PATTERNS, text)) {
    return { ok:false, rejection:"individual_employment" };
  }
  if (matchesAny(EMPLOYMENT_ROLE_PATTERNS, text)
    && !(engagementTrack === "INDIVIDUAL_FREELANCE" && commercialRole === "BUYER" && matchesAny(INDIVIDUAL_PROJECT_PATTERNS, text))) {
    return { ok:false, rejection:"individual_employment" };
  }
  if (matchesAny(SOFTWARE_PIPELINE_PATTERNS, text) && !matchesAny(PRODUCTION_DELIVERABLE_PATTERNS, text)) {
    return { ok:false, rejection:"software_pipeline_project" };
  }

  const categories = new Set(Array.isArray(candidate?.categories) ? candidate.categories : []);
  const heritage = categories.has("CULTURAL_HERITAGE_3D")
    || categories.has("HERITAGE_FUNDING_PARTNERSHIP")
    || matchesAny(HERITAGE_PATTERNS, text);
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
