// Explicit, bounded live measurement. It prints aggregate counters only and
// never persists source records or calls OpenAI.
import { pathToFileURL } from "node:url";
import { measureCollectorYield } from "../src/server/collectors/yield-measurement.mjs";

export const LIVE_YIELD_CONFIRMATION = "--confirm-live-read-only";

export async function runLiveYieldMeasurement(args = process.argv.slice(2)) {
  if (!args.includes(LIVE_YIELD_CONFIRMATION)) {
    throw new Error(`Live source measurement is locked. Re-run with ${LIVE_YIELD_CONFIRMATION}.`);
  }
  return measureCollectorYield();
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  try {
    const result = await runLiveYieldMeasurement();
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) process.exitCode = 1;
  } catch (error) {
    console.error(String(error?.message || error));
    process.exitCode = 2;
  }
}
