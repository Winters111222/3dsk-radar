export default async () => Response.json({
  ok: true,
  service: "3dsk-opportunity-radar",
  stage: "stage2-search-backend",
  search_configured: Boolean(Netlify.env.get("OPENAI_API_KEY") && Netlify.env.get("RADAR_INTERNAL_ACCESS_SECRET")),
  persistence: "stage3-pending",
  response_generation: "stage4-pending"
}, { headers: { "cache-control": "no-store" } });

export const config = { path: "/api/health" };
