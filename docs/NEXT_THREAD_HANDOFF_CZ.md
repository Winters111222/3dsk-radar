# 3D.SK Opportunity Radar — NEXT THREAD HANDOFF CZ

Repo:

`Winters111222/3dsk-radar`

Neber produktové zadání ze starých chatů. Jako autoritu používej aktuální repository.

## Povinně nejdřív načti

1. aktuální `main`,
2. `README.md`,
3. `AGENTS.md`,
4. `docs/PROJECT_BRIEF_CZ.md`,
5. `docs/PRODUCT_DECISION_COMPANY_MEMORY_CZ.md`,
6. `docs/PRELIVE_ACCEPTANCE_CZ.md`,
7. tento handoff,
8. aktuální Draft PR #5 a jeho head.

## Main

`main` nebyl během implementace změněn ani mergnut.

Při posledním ověření:

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
5. Draft PR #5 — pre-live zero-cost acceptance
   - `feature/prelive-zero-cost-acceptance-20260905`
   - vždy načti aktuální head, protože checkpoint docs mohou branch posunout.

PR #1–#5 zatím **NEMERGUJ**.

## Finální zero-cost code authority

Poslední head, který mění pre-live runtime/test code a prošel kompletním zero-cost CI:

`efc27f8edf1cfe36cbfe14b0c8cf4238ac48aeee`

Na tomto exact headu `Radar CI` = **SUCCESS**.

Ověřeno:

- committed `package-lock.json`,
- `.nvmrc` = Node 22,
- `package.json` Node `>=22.12.0`,
- `npm ci` PASS,
- **54/54 tests PASS**,
- `npm run accept:fixture` PASS / `cost_usd: 0`,
- `npm run accept:http` PASS,
- syntax PASS,
- source artifact PASS,
- isolated Netlify deploy-helper artifact PASS.

HTTP smoke skutečně servíruje a kontroluje:

- `/`,
- `/src/app.js`,
- `/src/styles.css`,
- `/src/stage3.css`,
- `/src/stage4.css`,
- `/fixtures/opportunities.json`.

Fixture E2E bez sítě prokazuje:

`SELECT → GENERATE RESPONSE → BOOKMARK COMPANY → MARK EMAIL SENT → CONTACTED → RECENT OUTREACH WARNING`

## Produktový stav

Stage 0–4 jsou systémově implementované.

Primární flow:

`SEARCH → EXTRACT → SCORE → DISPLAY → SELECT → GENERATE RESPONSE → COPY TO OUTLOOK`

Navíc:

- samostatný `Company` sloupec,
- `☆ / ★` company bookmark,
- `BOOKMARKED` view,
- company-level `last_contacted_at`,
- `contact_count`,
- outreach history,
- 30denní `RECENT OUTREACH` warning,
- manuální `MARK EMAIL SENT`,
- opportunity → `CONTACTED`,
- historie se propíše i na novou opportunity stejné firmy.

Radar **nikdy neposílá e-mail automaticky**.

## Search backend

Implementováno:

- `POST /api/search`,
- OpenAI Responses API + hosted `web_search`,
- strict JSON Schema,
- default `gpt-5.6-luna`,
- max jeden structured retry,
- source allowlist pouze z reálných web-search sources,
- unverified opportunity source se zahodí,
- contact e-mail přežije jen s přesným veřejným source URL,
- budget provenance fail-closed,
- canonical URL / dedupe / server timestamps,
- paid Search je za hard kill-switchem.

## Persistence / company memory

Používá **Netlify Blobs**, ne Supabase.

Ukládá shared:

- opportunities,
- first_seen / last_seen,
- statuses,
- company bookmark,
- company contact history,
- last_contacted_at,
- contact_count,
- reply fields.

Production store používá strong consistency; non-production je deploy-scoped.

## Generate Response

Implementováno:

- `POST /api/generate-response`,
- browser posílá jen `opportunity_id`,
- server načte fakta z persistence,
- prompt dostane pouze APPROVED outbound-safe capabilities + PUBLIC_APPROVED credentials,
- strict Structured Output,
- max jeden retry,
- default `gpt-5.6-sol`,
- AI **neurčuje TO**,
- server nastavuje TO pouze z source-gated `contact_email`,
- SUBJECT + BODY + Copy,
- reply persistence,
- paid Generate je za hard kill-switchem.

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

Při posledním readbacku Netlify project ještě neměl completed/current deploy.

## Jediný zbývající pre-paid blocker

Execution sandbox tohoto vlákna nedokáže DNS/networkově dosáhnout:

- `netlify-mcp.netlify.app`,
- `api.netlify.com`.

Netlify connector dokáže projekt vytvořit, nastavit env a vydat scoped one-time deploy proxy, ale lokální upload leg z tohoto sandboxu selže na DNS.

GitHub connector současně neumí bezpečně zapisovat Actions secrets; secrets API je mimo scope. Proto z tohoto vlákna nelze bezpečně předat scoped deploy credential do online GitHub runneru.

**Neobcházej to** commitnutím Netlify tokenu, proxy URL nebo jiného credentialu do PUBLIC repa.

## Co udělat dál — stále $0

1. deploynout exact CI-tested source vycházející z code authority `efc27f8e...` na existující Netlify project,
2. `/api/health` → `paid_ai_state: LOCKED`,
3. otevřít fixture UI přes Netlify link,
4. ověřit server-side team access,
5. ověřit shared Netlify Blobs:
   - bookmark,
   - status,
   - MARK EMAIL SENT,
   - outreach history,
6. `/api/search` musí vrátit `LIVE_AI_LOCKED`,
7. `/api/generate-response` musí vrátit `LIVE_AI_LOCKED`,
8. potvrdit, že žádný OpenAI request neproběhl.

## Až úplně nakonec — placená acceptance

Teprve po výše uvedeném:

1. bezpečně uložit `OPENAI_API_KEY` pouze server-side v Netlify,
2. ověřit model/cost gate,
3. `RADAR_LIVE_AI_ENABLED=true`,
4. přesně **jeden** controlled worldwide Search,
5. ověřit source truth / relevance / contact / budget / dedupe,
6. přesně **jeden** live Generate Response na jedné vybrané opportunity,
7. zkontrolovat claims + personalization + TO/SUBJECT/BODY,
8. až potom rozhodnout o merge/release.

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
- neposílej mail automaticky.

Hlavní priorita:

**nejkratší cesta od jednoho kliknutí k reálné relevantní obchodní příležitosti a kvalitní obchodní odpovědi — ne technologická komplexita.**
