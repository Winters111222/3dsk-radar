import { readFile } from "node:fs/promises";

const PROFILE_URL = new URL("../../config/company-profile.public.json", import.meta.url);

export async function loadPublicCompanyProfile() {
  const raw = await readFile(PROFILE_URL, "utf8");
  const profile = JSON.parse(raw);
  if (profile?.visibility !== "PUBLIC_SAFE") throw new Error("Company profile is not marked PUBLIC_SAFE");
  if (!Array.isArray(profile.capabilities) || !Array.isArray(profile.credentials)) throw new Error("Company profile contract is invalid");
  return profile;
}
