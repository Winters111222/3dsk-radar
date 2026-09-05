# Stav nasazené V0.1 – historie, mobil a filtry

Datum: 2026-09-05. Produktovou autoritou zůstávají exact heads.

- Main b51a7282889aa0d99139d49b3f344f2cd3c8cd43 nezměněn; PR #1–#8 nemergovány.
- Draft PR #7: mobil, řazení sloupců a vícenásobné kategorie. Head d9bcb308ddccf1dfe6cbf84f6b575410771552a0.
- Draft PR #8: trvalá historie, data prvního/posledního nalezení, poslední search/cost, zachování odpovědí a oddělený testovací workspace.
- Poslední publikovaný head PR #8: 0fd3b0ad7ac6c310ad26704ba935f7ec2ee5a214.
- GitHub CI run 33965412884 SUCCESS; 65/65 lokálních testů PASS. Netlify build spustil npm test, accept:fixture a accept:http pod exact-SHA guardem a publikoval úspěšně.
- Netlify production deploy 6a9c077c108dd489f2bebb85, existující site f390f4e9-12f5-4074-946e-c83f2d7fe20d, https://3dsk-opportunity-radar.netlify.app/.
- Produkční větev feature/persistent-history-acceptance-20260905; build guard je poslední head výše. Push dalšího headu vyžaduje aktualizaci guardu.
- Cloud Browser ověřil reálný web, demo, sort a category filtry; mobil 320/390/768 px ověřen na PR #7, 390px vizuálně znovu na PR #8. LAST SEARCH COST před paid runem $0.0000.
- Health přes skutečný frontend fetch potvrdil paid_ai_state LOCKED, live_ai_enabled false, access_configured true.
- RADAR_PRELIVE_ACCEPTANCE_ENABLED byl po přípravě testu odstraněn (fail-closed false) a následoval výše uvedený deploy.
- Env readback: LIVE_AI false, Search gpt-5.6-luna, Reply gpt-5.6-sol, max results12, cooldown30. OPENAI_API_KEY není nakonfigurován. Žádný OpenAI request nebyl proveden.

## Zbývá před paid acceptance

Přihlásit se do Radaru přes bezpečný browserAuth pomocí produkčního týmového kódu. Netlify session není Radar session. Týmový secret byl při tomto worku vytvořen v Netlify; nesmí být publikován ani vložen do chatu. Browser skill vyžaduje browserAuth pro zadávání přihlašovacích údajů.

Poté dočasně povolit isolated acceptance gate a redeploy stejného headu, otevřít /?workspace=acceptance a LOAD SHARED TEST DATA. Ověřit skutečné Blobs bookmark/BOOKMARKED/status/MARK EMAIL SENT/CONTACTED/history/recent warning; refresh, novou autorizovanou session a přežití redeploye. Ověřit autorizované POST /api/search i /api/generate-response -> 423 LIVE_AI_LOCKED. Tyto deployed chráněné testy dosud nejsou PASS; lokální mock testy je nenahrazují. Vypnout gate a redeploy.

Teprve po všech PASS bezpečně nakonfigurovat API key a provést explicitně schválený jeden Search a jednu Response; neodesílat e-mail. Žádný merge bez finální acceptance. Odhad dokončení 97 %.
