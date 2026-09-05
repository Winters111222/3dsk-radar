import { spawn } from "node:child_process";

const base = "http://127.0.0.1:4173";
const child = spawn(process.execPath, ["scripts/serve.mjs"], {
  stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, PORT: "4173" }
});

let output = "";
child.stdout.on("data", (chunk) => { output += chunk.toString(); });
child.stderr.on("data", (chunk) => { output += chunk.toString(); });

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${base}/`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Preview server did not start. ${output.slice(-500)}`);
}

async function check(path, expectedType, requiredText) {
  const response = await fetch(`${base}${path}`);
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  const type = response.headers.get("content-type") || "";
  if (!type.includes(expectedType)) throw new Error(`${path} content-type ${type} does not include ${expectedType}`);
  const text = await response.text();
  for (const marker of requiredText) {
    if (!text.includes(marker)) throw new Error(`${path} missing marker: ${marker}`);
  }
  return text;
}

try {
  await waitForServer();
  await check("/", "text/html", [
    "3D.SK Opportunity Radar",
    "FIND NEW OPPORTUNITIES",
    "BOOKMARKED",
    "/src/styles.css",
    "/src/stage3.css",
    "/src/stage4.css"
  ]);
  await check("/src/app.js", "text/javascript", ["GENERATE RESPONSE", "MARK EMAIL SENT", "company_bookmarked"]);
  await check("/src/styles.css", "text/css", [".results-layout", ".detail-panel"]);
  await check("/src/stage3.css", "text/css", [".star-button", ".repeat-warning", ".outreach.recent"]);
  await check("/src/stage4.css", "text/css", [".reply-section", ".reply-body"]);
  const fixtureText = await check("/fixtures/opportunities.json", "application/json", ["OPEN_OPPORTUNITY", "POTENTIAL_LEAD"]);
  const fixtures = JSON.parse(fixtureText);
  if (!Array.isArray(fixtures) || fixtures.length < 2) throw new Error("fixture dataset is unexpectedly small");
  console.log(JSON.stringify({ ok: true, cost_usd: 0, http_paths_checked: 6, fixture_records: fixtures.length }, null, 2));
} finally {
  child.kill("SIGTERM");
}
