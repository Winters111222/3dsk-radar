import { createStateRepository } from "./state-repository.mjs";

export async function getStateRepository() {
  if (globalThis.__RADAR_TEST_STATE_REPOSITORY__) return globalThis.__RADAR_TEST_STATE_REPOSITORY__;
  const { getStore, getDeployStore } = await import("@netlify/blobs");
  const context = globalThis.Netlify?.context?.deploy?.context || "dev";
  const store = context === "production" ? getStore("radar-state", { consistency:"strong" }) : getDeployStore("radar-state");
  return createStateRepository(store);
}
