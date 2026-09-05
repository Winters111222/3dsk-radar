import { createStateRepository } from "./state-repository.mjs";
import { acceptanceEnabled } from "./runtime.mjs";
export { acceptanceEnabled } from "./runtime.mjs";
export function storeOptions({context, acceptance=false}) {
  return { name: acceptance ? "radar-prelive-acceptance" : "radar-state", consistency:"strong", production:context === "production" };
}
export async function getStateRepository(request, runtimeContext) {
  if (globalThis.__RADAR_TEST_STATE_REPOSITORY__) return globalThis.__RADAR_TEST_STATE_REPOSITORY__;
  const acceptance=request?.headers.get("x-radar-workspace") === "acceptance";
  if(acceptance && !acceptanceEnabled()) throw new Error("Pre-live workspace is disabled.");
  const { getStore, getDeployStore } = await import("@netlify/blobs");
  // Only the server-supplied handler Context selects production storage.
  // CONTEXT is a build variable, not a guaranteed function runtime variable.
  const context = runtimeContext?.deploy?.context || "dev";
  const options=storeOptions({context,acceptance});
  const store=options.production ? getStore({name:options.name,consistency:options.consistency}) : getDeployStore({name:options.name,consistency:options.consistency});
  return createStateRepository(store);
}
