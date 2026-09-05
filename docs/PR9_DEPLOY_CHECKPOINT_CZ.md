# PR #9 – deployed runtime acceptance checkpoint

Datum: 2026-09-05. Tento checkpoint navazuje na TEAM_AUTH_BLOCKER_20260905_CZ.md a nahrazuje starší informaci o nasazeném PR #8.

- Main zůstává b51a7282889aa0d99139d49b3f344f2cd3c8cd43. PR #1–#9 nebyly mergovány.
- PR #9: https://github.com/Winters111222/3dsk-radar/pull/9
- Exact head: bac185ca2b316852024fafd832e6acca23128c08; base PR #8: 0fd3b0ad7ac6c310ad26704ba935f7ec2ee5a214.
- GitHub CI run 33965476625 completed/success na tomto exact headu.
- Skutečný production deploy: 6a9c0bc055b3f5b2dd485dd6, site f390f4e9-12f5-4074-946e-c83f2d7fe20d, published 2026-09-05T12:32:20.583Z.
- Netlify deploy API potvrdilo ready, production a exact commit bac185ca2b316852024fafd832e6acca23128c08. Sedm functions publikováno.
- Produkční větev: fix/deployed-runtime-acceptance-20260905. Netlify build command připouští pouze výše uvedený COMMIT_REF a spouští npm test, accept:fixture a accept:http.
- Skutečný Netlify build log: 68 testů, 68 pass, 0 fail; fixture i HTTP acceptance cost_usd 0.
- Živý web https://3dsk-opportunity-radar.netlify.app/ se načetl; LAST SEARCH COST $0.0000 / EST. COST.
- CHECK AI LOCKS v UI bez přihlášení načetl skutečné /api/health: ok true, access_configured true, paid_ai_state LOCKED, live_ai_enabled false, prelive_acceptance_enabled false, persistence NETLIFY_BLOBS. Chráněné POST testy správně neprovedl bez kódu.
- Netlify env readback: RADAR_LIVE_AI_ENABLED=false, Search gpt-5.6-luna, Reply gpt-5.6-sol, max results 12, cooldown 30. Týmový secret je nakonfigurován pro production. OPENAI_API_KEY není nakonfigurován; acceptance gate není povolená.
- Žádný OpenAI request, paid Search, paid Generate Response ani e-mail send nebyl v tomto pokračování proveden.
- Uživatel oznámil zastavení druhého okna; následný git fetch nezjistil nový checkpoint/head.
- Nový bezpečný browserAuth požadavek skončil declined. Přihlášení nebylo potvrzené; bez nové volby uživatele jej neopakovat. Žádné tajné hodnoty nebyly čteny ani uloženy do repozitáře.

## Zbývá

Správný produkční TEAM ACCESS CODE přes browserAuth. Po autentizaci dočasně povolit RADAR_PRELIVE_ACCEPTANCE_ENABLED při LIVE_AI=false, redeploy stejného headu, použít /?workspace=acceptance a ověřit skutečný oddělený Blobs store: seed, bookmark/BOOKMARKED, status, MARK EMAIL SENT/CONTACTED, historie, recent warning, refresh a přežití redeploye. Potvrdit oba autorizované POST -> 423 LIVE_AI_LOCKED. Potom acceptance gate opět vypnout a redeploy.

Teprve po 100% deployed zero-cost PASS bezpečně server-side nakonfigurovat OpenAI key a splnit uživatelem povolený jeden Search + jednu Response. Main ani stacked PR zatím nemergovat. Odhad V0.1: 97 %; deployment je hotový, chráněná persistence a paid acceptance zůstávají neověřené.


## Aktualizace po vyřešení týmového přístupu

Uživatel výslovně schválil náhradu týmového kódu a jeho sdělení v tomto soukromém chatu. Nový kód je uložen jako production Netlify secret, zde ani v repozitáři není uveden. Nepokoušet se jej získat z maskovaného Netlify readbacku. V tomto chatu je k dispozici uživateli; další credential entry pouze přes browserAuth.

Redeploy stejného PR #9 headu bac185ca2b316852024fafd832e6acca23128c08: 6a9c0d2a244eff921adf6677, Netlify UI Published/Completed, sedm functions.

browserAuth submitted a živý Radar potvrdil Saved team results · 0 / Saved results loaded. Týmová autentizace a načtení produkčního Blobs stavu PASS.

CHECK AI LOCKS přes skutečný frontend v autorizované session:
- health ok true, access_configured true, live_ai_enabled false, paid_ai_state LOCKED;
- POST /api/search -> 423 LIVE_AI_LOCKED;
- POST /api/generate-response -> 423 LIVE_AI_LOCKED;
- souhrn passed true; OpenAI key stále nenakonfigurován, žádný placený request.

Pokus o vytvoření RADAR_PRELIVE_ACCEPTANCE_ENABLED přes Netlify connector vrátil upserted, ale authoritative env readback proměnnou neobsahuje a deployed health potvrzuje prelive_acceptance_enabled false. Nelze považovat toto nastavení ani izolované Blobs zápisové testy za PASS. Zbývá zprovoznit acceptance gate podporovanou cestou a dokončit původní izolované persistence testy před paid acceptance. Předchozí auth blocker je vyřešen.
