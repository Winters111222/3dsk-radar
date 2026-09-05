import { createStateRepository } from "./state-repository.mjs";
export function storeOptions({context, acceptance=false}) {
  return { name: acceptance ? "radar-prelive-acceptance" : "radar-state", consistency:"strong", production:context === "production" };
}
export function acceptanceEnabled() {
  const env=globalThis.Netlify?.env;
  return env?.get("RADAR_PRELIVE_ACCEPTANCE_ENABLED") === "true" && env?.get("RADAR_LIVE_AI_ENABLED") !== "true";
}
export async function getStateRepository(request, functionContext) {
  if (globalThis.__RADAR_TEST_STATE_REPOSITORY__) return globalThis.__RADAR_TEST_STATE_REPOSITORY__;
  const acceptance=request?.headers.get("x-radar-workspace") === "acceptance";
  if(acceptance && !acceptanceEnabled()) throw new Error("Pre-live workspace is disabled.");
  const { getStore, getDeployStore } = await import("@netlify/blobs");
  const context = functionContext?.deploy?.context || globalThis.Netlify?.env?.get("CONTEXT") || "dev";
  const options=storeOptions({context,acceptance});
  const store=options.production ? getStore({name:options.name,consistency:options.consistency}) : getDeployStore({name:options.name,consistency:options.consistency});
  return createStateRepository(store);
}
