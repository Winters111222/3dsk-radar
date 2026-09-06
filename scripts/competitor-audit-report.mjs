import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { classifyRecordCandidate, recordKindOf } from "../src/server/record-classification.mjs";

function recordsFromPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.records)) return payload.records;
  if (Array.isArray(payload?.opportunities)) return payload.opportunities;
  throw new Error("AUDIT_INPUT_INVALID: expected an opportunities array or API snapshot");
}

export function buildCompetitorAuditReport(payload) {
  const records = recordsFromPayload(payload);
  const rows = records.map((record) => {
    const classification = classifyRecordCandidate(record);
    const proposed = classification.record_kind || recordKindOf(record);
    return {
      id:String(record.id || ""),
      company:String(record.company || ""),
      source_url:String(record.source_url || record.canonical_url || ""),
      current_record_kind:recordKindOf(record),
      proposed_record_kind:proposed,
      classification_reason:classification.reason,
      requires_manual_review:!classification.record_kind,
      sales_actions_locked:proposed !== "SALES_OPPORTUNITY"
    };
  });
  return {
    mode:"READ_ONLY",
    input_record_count:records.length,
    proposed_counts:{
      sales_opportunities:rows.filter((row) => row.proposed_record_kind === "SALES_OPPORTUNITY").length,
      competitors:rows.filter((row) => row.proposed_record_kind === "COMPETITOR").length,
      source_platforms:rows.filter((row) => row.proposed_record_kind === "SOURCE_PLATFORM").length,
      manual_review:rows.filter((row) => row.requires_manual_review).length
    },
    writes_performed:0,
    rows
  };
}

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath) throw new Error("Usage: npm run report:competitors -- /path/to/read-only-opportunities-snapshot.json");
  const payload = JSON.parse(await readFile(inputPath, "utf8"));
  const report = buildCompetitorAuditReport(payload);
  console.log(JSON.stringify(report, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
