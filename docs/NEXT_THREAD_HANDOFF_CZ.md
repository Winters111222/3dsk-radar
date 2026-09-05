# 3D.SK Opportunity Radar — NEXT THREAD HANDOFF CZ

## Aktuální doplnění — Phase B UK OCDS + community access review, 5. 9. 2026

Nejnovější navazující práce je ve stacked Draft PR #15:

- PR: `https://github.com/Winters111222/3dsk-radar/pull/15`
- branch: `feat/phase-b-uk-ocds-20260905`
- base: Draft PR #14 / `feat/ted-source-collector-20260905`
- exact base HEAD: `7bbb77fd3962a3a7512778abc8c2d5d9d77fc614`
- první plně otestovaný implementation HEAD PR #15: `a28da7b51c475dcc0b11eafb606e000f11db056b`
- PR #15 ani PR #14 nemergovat bez explicitního souhlasu vlastníka; `main` neměnit.

Phase B nyní obsahuje tři samostatné runtime collectory za společným default-off gate:

1. TED Search API v3,
2. Find a Tender OCDS release packages,
3. Contracts Finder OCDS Search.

Všechny používají pevné upstream URL, čtyři schválené query packs bez Visual / AI / Motion, nejvýše 50 records na stránku, timeout, měřené counters, `openai_requests: 0`, `cost_usd: 0` a `persistence: NONE`. Oba UK adaptery mají serverem vytvořené 30denní okno, validovaný cursor a lokální stale/inactive/deadline/scope filtry. Contracts Finder přijímá canonical provenance pouze z first-party `tenderNotice` URL. Upstream tender value je jen raw pole a není zatím `PUBLISHED` budget.

Access review Polycount, Unreal a Blender Artists je dokončený. Všechny tři zdroje zůstávají `BLOCKED_ACCESS_REVIEW`; nepřidávat HTML fallback. Unreal a Blender publikovaným robots zakazují category RSS. U Polycount není přes existující first-party RSS dostatečně potvrzené komerční automatizované reuse user content. Přesné důvody: [PHASE_B_ACCESS_REVIEW_CZ.md](PHASE_B_ACCESS_REVIEW_CZ.md).

Síťové ověření k tomuto checkpointu:

- TED: 2 malé anonymní canary requesty, HTTP 200,
- Find a Tender: 1 malý anonymní canary s `limit=1`, HTTP 200,
- Contracts Finder: 1 malý anonymní canary s `limit=1`, HTTP 200,
- celkem OpenAI requests: 0,
- celková cena: `$0`.

Offline acceptance implementation HEADu:

- `npm test` → 107/107 PASS,
- `npm run accept:collector` → PASS pro 3 mock collectory, network/OpenAI/cost = 0,
- `npm run accept:fixture` → PASS,
- `npm run accept:http` → PASS,
- `npm run sources:check` → PASS,
- `git diff --check` → PASS.

Aktuální orientační roadmapa:

- původní V0.1: přibližně 96 %,
- výzkum a katalog: 100 %,
- odstranění Visual / AI / Motion: 100 %,
- Phase A: 100 %,
- Phase B: přibližně 88 %,
- Phase C: 0 %,
- Phase D: 0 %,
- celý rozšířený Radar: přibližně 81 %.

Další doporučený krok: na další stacked branchi dokončit Phase B měřením výtěžnosti všech čtyř packs bez AI a podle výsledků rozhodnout, zda před Phase C přidat CanadaBuys. Potom Phase C: multi-source run state, chunky/cursors, persistence, leases/idempotence, cancel, cross-source + tender revision dedupe, 500-page simulace a 403/429/timeout/interruption testy. Žádný placený OpenAI Search před dokončením B/C a zelenou deployed zero-cost částí D.

Bez změny zůstává:

```text
RADAR_LIVE_AI_ENABLED=false
RADAR_SOURCE_COLLECTION_ENABLED=false
```

V tomto kroku nebyl proveden deploy, merge, změna Netlify environment, zápis do team state ani placený OpenAI request.

## Aktuální doplnění — výzkum širokého Search, 5. 9. 2026

Níže uvedený původní handoff PR #6 je historický. Pro tento výzkumný krok byl znovu ověřen aktuální PR #10 head `e57912f1c42544493912120228a15ea4b0d54112`; navazující review branch je `research/source-catalog-20260905`. Před další prací ověř aktuální head této větve a jejího draft PR. Produktový stav odvozuj od exact heads, nikoli od čísel uvedených v historickém předání.

Nejdřív načti [výzkum a plán](SEARCH_SOURCE_STRATEGY_CZ.md), `config/opportunity-sources.v1.json`, `config/search-query-packs.v1.json` a `config/source-evidence-cases.v1.json`. Nový požadavek vlastníka: široké procházení mnoha zdrojů s větším počtem relevantních výsledků.

Hotovo: 49 zdrojových záznamů / 54 vstupních URL, 4 ATS šablony, 44 query šablon v 9 jazycích, 11 evidenčních příkladů a offline validační CI krok. `Visual / AI / Motion` bylo rozhodnutím vlastníka odstraněno z aktivního Search scope, runtime enumu, UI filtru a query katalogu; ostatní kategorie zůstávají. V tomto kroku nebyl proveden aplikační OpenAI request, změna Netlify env ani merge. Výzkumný katalog má stále všechny `crawl_enabled: false`; runtime však nově obsahuje první samostatný TED collector za default-off gate.

Následuje implementace kroků A–D v analýze: buyer/status/eligibility a counters → první povolené konektory → ruční široký run s kurzory, budgetem a idempotencí → zero-cost acceptance před novým controlled live ověřením. Zachovat company memory a všechny provenance gates. MAIN ani starší PR automaticky nemergovat.

Aktuální navazující implementace: branch `feat/search-truth-measurement-20260905` stojí na exact PR #12 headu `d5d1a501d875f9a86939d74444756a06c446cfad`; stejné Phase A změny jsou publikované v draft PR #13 na headu `a1b437ce5a204392529116ddb9e36e588f83f7e0` a GitHub CI je SUCCESS. Phase A je 100 %. Lokální navazující Phase B checkpoint přidává TED read adapter a `/api/source-collection` za `RADAR_SOURCE_COLLECTION_ENABLED=false`. Dva malé anonymní TED API canary requesty skončily HTTP 200 a potvrdily contract/response shape za `$0`; relevantní query vrátila 0 výsledků, takže výtěžnost ještě není ověřená. Polycount/Unreal/Blender zůstávají `BLOCKED_ACCESS_REVIEW`. Podrobnosti: [PHASE_B_SOURCE_COLLECTION_CZ.md](PHASE_B_SOURCE_COLLECTION_CZ.md). Žádný placený Search před dokončením B, C a zero-cost části D.

---

## Původní handoff PR #6 — historický záznam

Repo:

`Winters111222/3dsk-radar`

Neber stav ze starých chatů. Jako autoritu používej repository a aktuální stacked PR.

## Povinně nejdřív načti

1. aktuální `main`,
2. `README.md`,
3. `AGENTS.md`,
4. `docs/PROJECT_BRIEF_CZ.md`,
5. `docs/PRODUCT_DECISION_COMPANY_MEMORY_CZ.md`,
6. `docs/PRELIVE_ACCEPTANCE_CZ.md`,
7. tento handoff,
8. aktuální Draft PR #6 a jeho head.

## Main

`main` zatím nebyl během implementace změněn ani mergnut.

Poslední ověřený main:

`b51a7282889aa0d99139d49b3f344f2cd3c8cd43`

Main zatím **NEMERGUJ**.

## Review stack

1. Draft PR #1 — Stage 0 + Stage 1
   - `feature/stage0-stage1-static-radar-20260905`
   - `f55bc0a2cd4392f8902a83318b61630ad405e086`
2. Draft PR #2 — Stage 2 Search backend
   - `feature/stage2-search-backend-20260905`
   - `af91c382f9e6ba8dc41c69b844159e528d91493b`
3. Draft PR #3 — Stage 3 company memory / persistence
   - `feature/stage3-company-memory-20260905`
   - `a5aef34365a20f3c48eff67e8880b6af3d8767ba`
4. Draft PR #4 — Stage 4 Generate Response
   - `feature/stage4-generate-response-20260905`
   - `9cd6a90584dcff1c56c65ba0f543438939f710e9`
5. Draft PR #5 — zero-cost pre-live acceptance
   - `feature/prelive-zero-cost-acceptance-20260905`
   - poslední docs head před PR #6: `49fc8e975871a98a71a859ce54939668abbd45c0`
6. Draft PR #6 — visual paid Search cost panel
   - `feature/search-cost-panel-20260905`
   - poslední plně otestovaný runtime head před aktualizací tohoto handoffu: `b2a7f5270731a3122ab5f6e42047d3cbe7b8f28f`
   - vždy načti aktuální head PR #6, protože dokumentační checkpoint může branch posunout.

PR #1–#6 zatím **NEMERGUJ**.

## Produktový stav

Stage 0–4 jsou systémově implementované a zero-cost acceptance je zelená.

Primární flow:

`SEARCH → EXTRACT → SCORE → DISPLAY → SELECT → GENERATE RESPONSE → COPY TO OUTLOOK`

Navíc je hotové:

- samostatný `Company` sloupec,
- `☆ / ★` bookmark firmy,
- `BOOKMARKED` view,
- company-level `last_contacted_at`,
- `contact_count`,
- outreach history,
- `RECENT OUTREACH` warning do 30 dnů,
- manuální `MARK EMAIL SENT`,
- opportunity → `CONTACTED`,
- historie se propíše i na novou opportunity stejné firmy,
- `GENERATE / REGENERATE RESPONSE`,
- Copy Subject / Copy Response,
- server-owned `TO`,
- žádné automatické odesílání mailu.

## Search backend

Implementováno server-side:

- `POST /api/search`,
- OpenAI Responses API + hosted `web_search`,
- strict JSON Schema,
- default Search model `gpt-5.6-luna`,
- max jeden structured retry,
- source allowlist pouze z reálných `web_search_call` sources,
- unverified opportunity source se zahodí,
- contact email přežije jen s doloženým veřejným source URL,
- budget provenance fail-closed,
- canonical URL / dedupe / server timestamps,
- paid Search je za hard kill-switchem.

## Search Cost panel — PR #6

Owner chtěl vizuálně vidět cenu každého placeného Search runu.

Implementováno:

- samostatný `LAST SEARCH COST` panel,
- fixture / no-paid-run stav: `$0.0000`,
- po live Searchi např. `$0.0128`,
- `EST. COST` label — není vydáván za definitivní fakturu,
- model,
- počet `web_search` callů,
- total tokeny,
- rozpad `web search fee + token cost`,
- last successful cost snapshot drží browser session,
- selhání cost UI nesmí rozbít Search.

Pricing snapshot ověřený při implementaci 2026-09-05:

- Web Search: `$0.01` / web-search run,
- GPT-5.6 Luna: `$0.20/M` uncached input, `$0.02/M` cached input, `$1.20/M` output.

Cost výpočet zároveň zná aktuální Terra/Sol rates; neznámý model fail-closed → `N/A`.

Pokud proběhne povolený structured retry, cost agreguje **všechny pokusy**, takže první neúspěšný pokus nezmizí z odhadu.

## Persistence / company memory

Používá **Netlify Blobs**, ne Supabase.

Shared state obsahuje:

- opportunities,
- first_seen / last_seen,
- statuses,
- company bookmark,
- company contact history,
- last_contacted_at,
- contact_count,
- generated reply fields.

Production store používá strong consistency; non-production je deploy-scoped.

## Generate Response

Implementováno:

- `POST /api/generate-response`,
- browser posílá pouze `opportunity_id`,
- server načítá fakta z persistence,
- prompt dostane pouze APPROVED outbound-safe capabilities + PUBLIC_APPROVED credentials,
- strict Structured Output,
- max jeden retry,
- default reply model `gpt-5.6-sol`,
- AI **neurčuje TO**,
- server nastavuje TO pouze z source-gated veřejného `contact_email`,
- SUBJECT + BODY + Copy,
- response persistence,
- paid Generate je za stejným hard kill-switchem jako Search.

## Zero-cost acceptance — aktuální authority

PR #6 runtime head:

`b2a7f5270731a3122ab5f6e42047d3cbe7b8f28f`

GitHub `Radar CI` na tomto exact headu = **SUCCESS**.

Ověřeno:

- `npm ci` PASS,
- **58/58 tests PASS**,
- `npm run accept:fixture` PASS, `cost_usd: 0`,
- `npm run accept:http` PASS,
- HTTP smoke kontroluje 7 servírovaných cest včetně cost-panel JS,
- syntax PASS,
- tested source artifact PASS,
- isolated Netlify deploy-helper artifact PASS.

PR #6 source artifact:

- artifact id: `9968201506`,
- SHA-256: `5ca36f5c32d7950a009f9e8b0150cac60d989f2322db42d4af5b3f6b75647c19`,
- lokálně stažená kopie byla ověřena proti tomuto digestu a seděla přesně.

Žádný paid OpenAI request nebyl během implementace nebo acceptance spuštěn.

## Netlify

Projekt:

`3dsk-opportunity-radar`

Site id:

`f390f4e9-12f5-4074-946e-c83f2d7fe20d`

Autoritativní env readback potvrzuje:

- `RADAR_LIVE_AI_ENABLED=false`,
- `OPENAI_SEARCH_MODEL=gpt-5.6-luna`,
- `OPENAI_REPLY_MODEL=gpt-5.6-sol`,
- `RADAR_SEARCH_MAX_RESULTS=12`,
- `RADAR_SEARCH_COOLDOWN_SECONDS=30`.

Server-side team access secret je uložen jako Netlify secret.

`OPENAI_API_KEY` zatím nepoužívej.

Netlify project při posledním readbacku stále neměl completed/current deploy.

## Jediný zbývající pre-paid blocker

První Netlify deploy nejde z execution sandboxu tohoto vlákna dokončit.

Ověřeno dvěma způsoby:

1. sandbox DNS nedokáže resolve `netlify-mcp.netlify.app` ani `api.netlify.com`,
2. ani při ručním použití veřejných Netlify IP adres a `curl --resolve` sandbox nedokáže navázat TCP/443 spojení.

Jde tedy o outbound network policy execution prostředí, ne o chybu aplikace nebo Netlify projektu.

Netlify connector dokáže vytvořit 30minutový scoped deploy proxy handoff, ale upload část musí provést prostředí, které skutečně dosáhne na Netlify HTTPS.

GitHub connector neumí bezpečně zapisovat Actions secrets/repository variables pro předání tohoto credentialu online runneru.

**Neobcházej to** commitnutím Netlify tokenu, proxy URL nebo jiného credentialu do PUBLIC repa.

## Co přesně udělat dál — stále $0

1. deploynout exact CI-tested PR #6 source na existující Netlify project,
2. `/api/health` → `paid_ai_state: LOCKED`,
3. otevřít UI přes Netlify URL,
4. ověřit Search Cost panel v no-paid-run stavu `$0.0000`,
5. ověřit server-side team access,
6. ověřit shared Netlify Blobs:
   - bookmark,
   - status,
   - MARK EMAIL SENT,
   - outreach history,
7. `/api/search` musí vrátit `LIVE_AI_LOCKED`,
8. `/api/generate-response` musí vrátit `LIVE_AI_LOCKED`,
9. potvrdit, že žádný OpenAI request neproběhl.

## Až úplně nakonec — placená acceptance

Teprve po $0 deployed-runtime acceptance:

1. bezpečně uložit `OPENAI_API_KEY` pouze server-side v Netlify,
2. ověřit model/cost gate,
3. `RADAR_LIVE_AI_ENABLED=true`,
4. přesně **jeden** controlled worldwide Search,
5. ověřit source truth / relevance / contact / budget / dedupe,
6. ověřit, že `LAST SEARCH COST` ukazuje smysluplný estimate a usage breakdown,
7. přesně **jeden** live Generate Response na jedné vybrané opportunity,
8. zkontrolovat claims + personalization + TO/SUBJECT/BODY,
9. až potom rozhodnout o merge/release.

Žádný paid run nepoužívej k hledání běžných implementačních chyb.

## Security invariants

Repo je PUBLIC.

Nikdy:

- necommituj secrets/tokens/API keys,
- necommituj NDA nebo neveřejné klienty/projekty,
- nevymýšlej contact email,
- nepoužívej neověřený claim/credential v outbound copy,
- nezaměňuj `POTENTIAL_LEAD` za `OPEN_OPPORTUNITY`,
- nezaměňuj `ESTIMATED` budget za `PUBLISHED`,
- neprezentuj WIN SCORE jako statistickou pravděpodobnost,
- neprezentuj Search Cost estimate jako definitivní fakturovanou částku,
- neposílej mail automaticky.

Hlavní priorita:

**nejkratší cesta od jednoho kliknutí k reálné relevantní obchodní příležitosti a kvalitní obchodní odpovědi — ne technologická komplexita.**
