# Deployed PR #10 — locked acceptance checkpoint

Datum: 2026-09-05. Tento záznam nahrazuje starší provisioning blocker: uživatel ručně nastavil API klíč jako Netlify secret. Klíč nečíst ani znovu nevytvářet.

- Main beze změny: b51a7282889aa0d99139d49b3f344f2cd3c8cd43.
- Draft PR #10: https://github.com/Winters111222/3dsk-radar/pull/10
- Exact head: e57912f1c42544493912120228a15ea4b0d54112.
- Base PR #9: bac185ca2b316852024fafd832e6acca23128c08.
- Source tree: 2c50518d7fed45624819f625ef7bf8aa1d27807b, shoda s lokálním testovaným indexem.
- GitHub CI 33969314795: SUCCESS, exact head, 73/73 testů PASS; fixture/HTTP cost_usd 0.
- Netlify site f390f4e9-12f5-4074-946e-c83f2d7fe20d / 3dsk-opportunity-radar.
- Current production deploy 6a9c1b438bf68d556d114051: READY, commit e57912f1c42544493912120228a15ea4b0d54112, published 2026-09-05T13:38:33.692Z.
- Produkční branch fix/buyer-budget-provenance-20260905.
- Build command: test "$COMMIT_REF" = "e57912f1c42544493912120228a15ea4b0d54112" && npm test && npm run accept:fixture && npm run accept:http
- LIVE_AI=false, prelive acceptance gate nepřítomný. API key zůstává Netlify secret. Search model gpt-5.6-luna, reply gpt-5.6-sol, max12, cooldown30.
- Produkční UneeQ detail nově skutečně ukazuje Budget unknown / UNKNOWN a vysvětlení, že seller price není buyer budget. Dřívější 240 000 USD licence již není v budget poli.
- Všech 5 výsledků zachováno. Kabum odpověď včetně původního timestampu a modelu přežila deploy. LAST SEARCH COST stále $0.0155.
- CHECK AI LOCKS na tomto deployi: passed true; /api/health paid_ai_state LOCKED, live_ai_enabled false, access_configured true, prelive_acceptance_enabled false, persistence NETLIFY_BLOBS.
- Autorizované POST /api/search a POST /api/generate-response obě 423 LIVE_AI_LOCKED. Nezpůsobily žádné další OpenAI volání.
- Browser vrácen do normálního týmového prostoru na https://3dsk-opportunity-radar.netlify.app/.

## Co již proběhlo placeně

Přesně jedna UI Search a přesně jedna UI Generate Response na PR #9. Search 5 potential leads, 1 hosted web-search call, 16 500 total tokens, odhad $0.0155 (web $0.0100 + tokens $0.0055). Kabum odpověď obsahově a actual clipboard subject/body PASS. Žádný automatický send. Podrobnosti: docs/CONTROLLED_LIVE_ACCEPTANCE_CZ.md v exact PR #10.

## Co zbývá a oprávnění

Finální paid acceptance dosud není PASS kvůli relevanci a source truth prvního Search. Chyba budgetu opravena fixture/mock cestou a deployed readbackem. Účinek nových instrukcí na skutečné hledání ještě není ověřen. Další paid Search vyžaduje nový konkrétní souhlas uživatele: původní limit jednoho Search a jednoho Generate byl vyčerpán. Nenahrazovat další Search opakovaným Generate, nerestartovat původní run. Main ani stacked PR nemergovat automaticky. Celkově přibližně 99 % V0.1; release zatím nedoporučen.
