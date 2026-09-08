#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import pilot from "../config/platform-alert-pilot.v1.json" with {type:"json"};
import { evaluatePlatformAlertPrecision } from "../src/server/platform-alert-precision.mjs";

const file = process.argv[2];
if (!file || process.argv.length !== 3) {
  console.error("Usage: npm run report:alerts:precision -- <manual-review.json>");
  process.exitCode = 2;
} else {
  try {
    const review = JSON.parse(await readFile(file, "utf8"));
    process.stdout.write(`${JSON.stringify(evaluatePlatformAlertPrecision(review, pilot), null, 2)}\n`);
  } catch (error) {
    console.error(JSON.stringify({ status:"INVALID_REVIEW", runtime_activation:"LOCKED", error:String(error?.code || error?.message || "PLATFORM_ALERT_REVIEW_FAILED") }));
    process.exitCode = 1;
  }
}

