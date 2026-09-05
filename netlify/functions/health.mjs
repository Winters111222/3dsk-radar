export default async () => Response.json({
  ok: true,
  service: "3dsk-opportunity-radar",
  stage: "stage0-stage1-static"
});

export const config = { path: "/api/health" };
