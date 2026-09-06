import searchHandler from "./search.mjs";
import { productionSearchConfiguration } from "../../src/server/production-search-policy.mjs";

export async function runBackgroundSearch(request, context) {
  const execution = productionSearchConfiguration();
  if (!execution.ok || execution.search_profile !== "WIDE_INDEX") {
    return Response.json({ ok:false, error:{ code:"WIDE_BACKGROUND_NOT_ARMED", message:"The background endpoint is available only for an armed WIDE_INDEX production search." } }, { status:423 });
  }
  return searchHandler(request, context);
}

export default async function handler(request, context) {
  const response = await runBackgroundSearch(request, context);
  if (!response.ok) {
    const payload = await response.clone().json().catch(() => ({}));
    console.error("[radar-search-background]", payload?.error?.code || `HTTP_${response.status}`);
  }
}

export const config = { path:"/api/search-background" };
