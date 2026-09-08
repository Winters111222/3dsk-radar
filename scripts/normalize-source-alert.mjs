#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { normalizeUserOwnedAlert } from "../src/server/user-owned-alert-normalizer.mjs";

const file = process.argv[2];
if (!file || process.argv.length !== 3) {
  console.error("Usage: node scripts/normalize-source-alert.mjs <alert.json>");
  process.exitCode = 2;
} else {
  try {
    const payload = JSON.parse(await readFile(file, "utf8"));
    const signals = normalizeUserOwnedAlert(payload);
    process.stdout.write(`${JSON.stringify({ ok:true, count:signals.length, signals }, null, 2)}\n`);
  } catch (error) {
    console.error(JSON.stringify({ ok:false, error:String(error?.code || error?.message || "ALERT_NORMALIZATION_FAILED") }));
    process.exitCode = 1;
  }
}
