# 3D.SK Opportunity Radar — NEXT THREAD HANDOFF CZ

Repo:

`Winters111222/3dsk-radar`

Neber produktové zadání ze starých chatů. Jako autoritu používej repository.

## Povinně nejdřív načti

1. aktuální `main`,
2. `README.md`,
3. `AGENTS.md`,
4. `docs/PROJECT_BRIEF_CZ.md`,
5. `docs/PRODUCT_DECISION_COMPANY_MEMORY_CZ.md`,
6. `docs/PRELIVE_ACCEPTANCE_CZ.md`,
7. tento handoff.

## Produkční main

`main` nebyl během implementace změněn ani mergnut.

Při vytvoření tohoto handoffu:

`b51a7282889aa0d99139d49b3f344f2cd3c8cd43`

Main zatím **NEMERGUJ**.

## Review stack

Implementace je záměrně rozdělená do stacked Draft PR:

1. Draft PR #1 — Stage 0 + Stage 1
   - branch `feature/stage0-stage1-static-radar-20260905`
   - head `f55bc0a2cd4392f8902a83318b61630ad405e086`
2. Draft PR #2 — Stage 2 Search backend
   - branch `feature/stage2-search-backend-20260905`
   - head `af91c382f9e6ba8dc41c69b844159e528d91493b`
3. Draft PR #3 — Stage 3 company memory / persistence
   - branch `feature/stage3-company-memory-20260905`
   - head `a5aef34365a20f3c48eff67e8880b6af3d8767ba`
4. Draft PR #4 — Stage 4 Generate Response
   - branch `feature/stage4-generate-response-20260905`
   - head `9cd6a90584dcff1c56c65ba0f543438939f710e9`
5. Draft PR #5 — pre-live zero-cost acceptance
   - branch `feature/prelive-zero-cost-acceptance-20260905`
   - při posledním potvrzeném checkpointu před aktualizací tohoto handoffu byl head `00ef5328095b2ca2e6aca99c6e847fe3ba433d8f`
   - vždy si načti aktuální head PR #5, protože dokumentační checkpoint může head posunout.

PR #1–#5 zatím **NEMERGUJ**.

## Produktový stav

Stage 0–4 jsou systémově implementované.

Primární flow:

`SEARCH → EXTRACT → SCORE → DISPLAY → SELECT → GENERATE RESPONSE → COPY TO OUTLOOK`

Navíc je implementované company-level memory UX:

- samostatný sloupec `Company`,
- `☆ / ★` bookmark firmy,
- pohled `BOOKMARKED`,
- `last_contacted_at`,
- `contact_count`,
- company outreach history,
- `RECENT OUTREACH` upozornění do 30 dnů,
- manuální `MARK EMAIL SENT`,
- opportunity se po této akci označí `CONTACTED`,
- historie zůstává viditelná i u nové opportunity stejné firmy.

Radar **nikdy neposílá e-mail automaticky**.

## Stage 2 — Search

Implementováno server-side:

- `POST /api/search`,
- OpenAI Responses API,
- hosted `web_search`,
- strict Structured Outputs / JSON Schema,
- default search model `gpt-5.6-luna`,
- max jeden structured retry,
- canonical URL normalization,
- source allowlist z reálně vrácených `web_search_call` sources,
- unverified opportunity source se zahodí,
- e-mail přežije jen pokud má veřejný source URL skutečně vrácený web search,
- budget fail-closed na `UNKNOWN`,
- dedupe + server-owned identity/timestamps,
- Search je za hard kill-switchem.

## Stage 3 — persistence / company memory

Používá nejjednodušší variantu podle briefu: **Netlify Blobs**, ne Supabase.

Ukládá:

- opportunities,
- first_seen / last_seen,
- shared statuses,
- company bookmark,
- company contact history,
- last_contacted_at,
- contact_count,
- generated response fields.

Production store používá strong consistency; non-production je izolovaný deploy-scoped store.

## Stage 4 — Generate Response

Implementováno:

- `POST /api/generate-response`,
- browser posílá pouze `opportunity_id`,
- server načte source facts z persistence,
- model dostává jen APPROVED outbound-safe capabilities a PUBLIC_APPROVED credentials,
- strict Structured Output,
- max jeden retry,
- default reply model `gpt-5.6-sol`,
- AI **neurčuje TO**,
- `TO` nastavuje server pouze z source-gated veřejného `contact_email`,
- `SUBJECT`, `BODY`,
- Copy Subject / Copy Response,
- response persistence,
- endpoint je za stejným hard kill-switchem jako Search.

## Zero-cost acceptance

Poslední potvrzený exact-code CI checkpoint:

`356a3cdb8aea5b1d05252f7d4b166517e599510d`

Na něm:

- committed `package-lock.json`,
- `.nvmrc` = Node 22,
- `package.json` vyžaduje Node `>=22.12.0`,
- `npm ci` PASS,
- **54/54 tests PASS**, 
- `npm run accept:fixture` PASS,
- `cost_usd: 0`,
- syntax PASS,
- source artifact PASS,
- isolated Netlify deploy-helper artifact PASS.

Fixture E2E prokazuje bez sítě:

`SELECT → GENERATE RESPONSE → BOOKMARK COMPANY → MARK EMAIL SENT → CONTACTED → RECENT OUTREACH WARNING`

Kontroly explicitně ověřují:

- selected opportunity,
- generated response,
- server-safe TO semantics,
- company bookmark,
- email history včetně subjectu,
- CONTACTED status,
- 30-day repeat-outreach warning.

Pozdější dokumentační head `00ef5328095b2ca2e6aca99c6e847fe3ba433d8f` měl také GitHub `Radar CI` = `SUCCESS`.

## Netlify

Samostatný projekt byl vytvořen:

`3dsk-opportunity-radar`

Site id:

`f390f4e9-12f5-4074-946e-c83f2d7fe20d`

Autoritativní Netlify env readback potvrzuje:

- `RADAR_LIVE_AI_ENABLED=false`,
- `OPENAI_SEARCH_MODEL=gpt-5.6-luna`,
- `OPENAI_REPLY_MODEL=gpt-5.6-sol`,
- `RADAR_SEARCH_MAX_RESULTS=12`,
- `RADAR_SEARCH_COOLDOWN_SECONDS=30`.

Server-side team access secret byl uložen jako Netlify secret. Jeho hodnotu nevkládej do public repa ani logů.

`OPENAI_API_KEY` zatím není potřeba a nesmí být použit před final paid acceptance.

Netlify project při posledním readbacku ještě neměl completed/current deploy.

## Jediný zbývající pre-paid blocker

První Netlify deploy nebylo možné dokončit z execution sandboxu tohoto vlákna, protože jeho DNS/odchozí síť nedokáže dosáhnout:

- `netlify-mcp.netlify.app`,
- `api.netlify.com`.

To je limitation execution sandboxu, ne chyba aplikace, CI nebo Netlify projektu.

Neobcházej to commitnutím Netlify tokenu/proxy credentialu do PUBLIC repa.

## Co přesně udělat dál

Nejdřív dokonči **zero-cost deployed-runtime acceptance**, stále bez OpenAI placeného volání:

1. deployni exact CI-tested source na existující Netlify project `3dsk-opportunity-radar`,
2. ověř `/api/health` → `paid_ai_state: LOCKED`,
3. ověř, že UI jde otevřít přes Netlify link,
4. ověř server-side team access,
5. ověř shared Netlify Blobs:
   - bookmark,
   - status,
   - MARK EMAIL SENT,
   - company outreach history,
6. ověř, že `/api/search` vrací `LIVE_AI_LOCKED`,
7. ověř, že `/api/generate-response` vrací `LIVE_AI_LOCKED`,
8. zkontroluj, že žádný OpenAI request nebyl proveden.

Teprve potom smí přijít **úplně poslední placený acceptance krok**:

1. bezpečně uložit `OPENAI_API_KEY` pouze server-side v Netlify,
2. znovu ověřit modely/cost gates,
3. přepnout `RADAR_LIVE_AI_ENABLED=true`,
4. přesně jeden controlled live worldwide Search,
5. ručně/automaticky ověřit relevance, source truth, contact provenance, budget provenance, dedupe,
6. na přesně jedné vybrané opportunity jeden live Generate Response,
7. zkontrolovat claims, personalization, TO/SUBJECT/BODY,
8. až potom rozhodnout o merge/release.

Žádný paid run nepoužívej k hledání běžných implementačních bugů.

## Bezpečnostní invariants

Repo je PUBLIC.

Nikdy:

- necommituj API keys/tokens/secrets,
- necommituj NDA data nebo neveřejné klienty/projekty,
- nevymýšlej contact email,
- nepoužívej neověřené credential/claim v outbound copy,
- nezaměňuj `POTENTIAL_LEAD` za `OPEN_OPPORTUNITY`,
- neprezentuj `ESTIMATED` budget jako `PUBLISHED`,
- neprezentuj WIN SCORE jako statistickou pravděpodobnost,
- neposílej e-mail automaticky.

Hlavní priorita zůstává:

**nejkratší cesta od jednoho kliknutí k reálné relevantní obchodní příležitosti a kvalitní obchodní odpovědi — ne technologická komplexita.**
