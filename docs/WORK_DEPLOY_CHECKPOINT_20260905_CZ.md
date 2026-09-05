# Work deployed checkpoint — 2026-09-05

## Autorita a hranice

- main ověřen: b51a7282889aa0d99139d49b3f344f2cd3c8cd43; nezměněn.
- Draft PR #6 head: e7419e2ecee0d9f29489b6d854ff279dc97e37ba; nezměněn.
- Runtime-changing head: b2a7f5270731a3122ab5f6e42047d3cbe7b8f28f.
- Radar CI na exact PR headu SUCCESS; run 33962321706.
- PR #1–#6 nebyly sloučeny.
- Tento checkpoint je pouze dokumentace na samostatné branchi.
- Žádný live OpenAI request nebyl v této session spuštěn. OPENAI_API_KEY nebyl nastaven ani použit. RADAR_LIVE_AI_ENABLED zůstává false.

## Skutečný deploy dokončen

Existující site f390f4e9-12f5-4074-946e-c83f2d7fe20d, 3dsk-opportunity-radar.

Web: https://3dsk-opportunity-radar.netlify.app/

Cloud Browser login do Netlify uspěl přes GitHub. Existující projekt byl propojen s Winters111222/3dsk-radar a produkční branchí feature/search-cost-panel-20260905. Main nebyl vybrán ani změněn.

Build command v Netlify UI:

```sh
test "$COMMIT_REF" = "e7419e2ecee0d9f29489b6d854ff279dc97e37ba" && npm test && npm run accept:fixture && npm run accept:http
```

Publish directory ".", Functions directory "netlify/functions"; source netlify.toml zachován.
Tento exact-SHA build guard úmyslně odmítne budoucí jiný head, dokud není nová verze prověřena a guard vědomě aktualizován.
Auto publishing je zapnuté pro výše uvedenou feature branch; pozor před dalšími runtime commity nebo přepnutím branche.

1. První production deploy: 6a9bfebb2b9919354ff03f59, ready, commit_ref přesně e7419e2ecee0d9f29489b6d854ff279dc97e37ba. Šest Functions, Node 22.
2. Po opravě přístupového nastavení nový production deploy: 6a9c007e20b5a9d32bd40099. Netlify UI potvrdilo "Your deploy completed successfully", Published, stejný commit e7419e2, šest Functions.
   https://app.netlify.com/projects/3dsk-opportunity-radar/deploys/6a9c007e20b5a9d32bd40099

## Rozdíl proti starému předání — access secret

Při prvním aktuálním readbacku a v Netlify UI RADAR_INTERNAL_ACCESS_SECRET chyběl. Pouhé historické tvrzení o jeho uložení nebylo správnou authority.

Konektor dvakrát vrátil "Environment variable upserted", ale následný readback ani UI proměnnou neobsahovaly. Neopakovat toto tvrzení jako ověřený úspěch.

Secret byl následně vytvořen přes Netlify UI:
- key RADAR_INTERNAL_ACCESS_SECRET,
- kryptograficky náhodná hodnota, nikdy necommitovaná,
- Contains secret values,
- neprázdná hodnota pouze pro production,
- UI automaticky přiřadilo Builds, Functions, Runtime,
- ostatní kontexty ponechány prázdné.

UI i následný connector readback nyní potvrzují existenci proměnné a is_secret=true. Toto samo o sobě ještě není runtime auth acceptance.
Hodnota není v tomto checkpointu ani repozitáři. Pro owner/team použití ji bude potřeba bezpečně předat z původní session, nebo nastavit nový owner-known kód; nečíst tajnou hodnotu do logů.

Ostatní env readback:
- RADAR_LIVE_AI_ENABLED=false
- OPENAI_SEARCH_MODEL=gpt-5.6-luna
- OPENAI_REPLY_MODEL=gpt-5.6-sol
- RADAR_SEARCH_MAX_RESULTS=12
- RADAR_SEARCH_COOLDOWN_SECONDS=30
- OPENAI_API_KEY nepřidán

## Co je skutečně ověřeno

- GitHub exact-head Radar CI SUCCESS.
- Lokálně znovu npm test: 58/58 PASS.
- Lokálně npm run accept:fixture: PASS, cost_usd=0.
- Lokální HTTP smoke zde nebyl dokončen: execution hlásilo zrušené network approval. Nenahrazovat tím doložený předchozí CI PASS.
- Produkční web otevřen přes Cloud Browser, DOM i screenshot zkontrolovány.
- LAST SEARCH COST před live runem: $0.0000, EST. COST.
- Nasazené synthetic fixture UI: company bookmark, BOOKMARKED filtr, fixture Generate Response, MARK EMAIL SENT, company history, recent-outreach warning.
- Žádný skutečný e-mail nebyl odeslán.
- COPY SUBJECT bylo kliknuto, ale clipboard API v tomto browseru vracelo prázdný řetězec. Copy acceptance proto není PASS; browser console obsahovala chyby jeho extension. Není prokázáno, že jde o chybu aplikace.

## Co není ověřeno a proč

Přímá navigace Cloud Browseru na /api/health skončila net::ERR_BLOCKED_BY_CLIENT.
Standardní lokální curl pokusy skončily "network approval was cancelled before a decision was returned".
Web open endpoint nepovolil jako safe URL.
Neobcházet síťové či browserové restrikce alternativními IP, proxy nebo únikem credentialů.

Proto dosud NENÍ deployed-runtime PASS:
- /api/health paid_ai_state=LOCKED a access_configured=true,
- server-side team authentication,
- skutečná Netlify Blobs persistence,
- company bookmark/status/CONTACTED/outreach across reloads přes Functions,
- POST /api/search -> LIVE_AI_LOCKED,
- POST /api/generate-response -> LIVE_AI_LOCKED,
- clipboard copy readback.

Fixture UI nemá seed cestu do shared state: LOAD TEAM STATE při prázdném store zachovává fixtures a jejich změny jsou lokální. Před první placenou akcí bude nutná bezpečná izolovaná serverová fixture acceptance/seed cesta nebo odpovídající testovací setup. Netvrdit, že proklikání fixtures ověřilo Blobs.

## Další postup

1. Dokončit přístup k nasazenému API podporovanou autorizovanou cestou a runtime zero-cost acceptance.
2. Ověřit runtime skutečnou volbu production site-wide store a oddělení preview dat.
3. Případné runtime chyby opravit na nové stacked branchi, mock/fixture testy před novým deployem.
4. Zachovat false až do úplného zero-cost PASS.
5. Teprve potom server-side OpenAI key a model/cost preflight; přesně jeden controlled Search a jedna Generate Response dle owner zadání.
6. Bez automatického sendu, bez automatického merge PR #1–#6.

Celkový stav V0.1 přibližně 97 %. Deploy a UI dostupnost hotové; deployed server acceptance a finální paid acceptance zbývají.
