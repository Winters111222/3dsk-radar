// Product-facing source collection groups approved for Search.
// Visual / AI / Motion is intentionally absent and must not be reintroduced via Other Relevant.
export const SOURCE_QUERY_PACKS = Object.freeze({
  external_development: {
    label: "External Development",
    categories: ["EXTERNAL_DEVELOPMENT", "CHARACTER_OUTSOURCING"],
    phrases: ["external development", "3D character production", "character outsourcing", "digital human"]
  },
  production_overflow: {
    label: "Production Overflow",
    categories: ["PRODUCTION_OVERFLOW", "CHARACTER_FINISHING"],
    phrases: ["production overflow", "3D character services", "photogrammetry services", "scan processing"]
  },
  pipeline_consulting: {
    label: "Pipeline Consulting",
    categories: ["PIPELINE_CONSULTING", "FACIAL_FACS"],
    phrases: ["pipeline consulting", "character pipeline", "facial rig", "FACS"]
  },
  other_relevant: {
    label: "Other Relevant",
    categories: ["OTHER_RELEVANT", "CAPTURE", "PHOTOGRAMMETRY_PROCESSING", "SCAN_CLEANUP"],
    phrases: ["human photogrammetry", "3D scanning services", "digital double", "human scan cleanup"]
  }
});

