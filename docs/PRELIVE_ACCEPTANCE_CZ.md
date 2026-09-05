# Pre-live zero-cost acceptance — 3D.SK Opportunity Radar

Datum: 2026-09-05

Tato fáze nastává po Stage 0–4 a před úplně prvním placeným OpenAI testem.

## Závazná hranice

`RADAR_LIVE_AI_ENABLED=false`

Dokud není celý tento checklist splněný, nesmí se přepínač změnit na `true`.

## Aktuální stav

Pre-live source authority po posledním zero-cost acceptance runu:

`356a3cdb8aea5b1d05252f7d4b166517e599510d`

Na tomto exact headu GitHub Actions `Radar CI` skončil `SUCCESS`.

Ověřeno:

- `npm ci` z committed `package-lock.json` → PASS,
- **54/54 testů PASS**,
- explicitní `npm run accept:fixture` → PASS,
- fixture acceptance hlásí `cost_usd: 0`,
- `SELECT → GENERATE RESPONSE → bookmark company → MARK EMAIL SENT → CONTACTED → repeat-outreach warning` → PASS,
- syntax check frontend/server/functions/scripts → PASS,
- testovaný source artifact vytvořen,
- izolovaný Netlify deploy-helper artifact vytvořen,
- žádný live OpenAI request nebyl spuštěn.

Node runtime je pinovaný přes `.nvmrc` na major `22`; `package.json` vyžaduje minimálně Node `22.12.0`, což odpovídá požadavku použitého `@netlify/blobs`.

## Co musí fungovat bez placeného AI

### UI / rozhodování

- samostatný sloupec Company,
- `☆ / ★` bookmark firmy,
- pohled `BOOKMARKED`,
- `OPEN_OPPORTUNITY` vs `POTENTIAL_LEAD`,
- FIT a WIN score odděleně,
- HIGH / MEDIUM / LOW,
- budget provenance,
- public-contact provenance,
- status `NEW / INTERESTING / CONTACTED / IGNORE`,
- source detail a risks/gaps.

### Company memory

- bookmark je na úrovni firmy,
- shared statusy a company history používají Netlify Blobs,
- `MARK EMAIL SENT` označí opportunity `CONTACTED`,
- uloží company outreach timestamp a subject odpovědi, pokud existuje,
- nová opportunity stejné firmy zdědí viditelnou outreach historii,
- kontakt do 30 dnů ukáže výrazné `RECENT OUTREACH` varování.

### Response UX

Fixture mode musí bez sítě projít:

`SELECT → GENERATE RESPONSE → COPY SUBJECT → COPY RESPONSE → MARK EMAIL SENT`

Produkční Generate Response je implementovaný, ale zamčený stejným server-side kill switchem jako Search.

### Safety

- žádný secret v repu/browser bundle,
- žádný vymyšlený e-mail,
- `TO` v produkční reply určuje server z ověřeného kontaktu,
- model dostává jen approved capabilities a PUBLIC_APPROVED credentials,
- žádný auto-send,
- Search i Reply vrací `LIVE_AI_LOCKED`, dokud není finální paid acceptance.

### Infrastructure

- Netlify projekt `3dsk-opportunity-radar` existuje,
- Netlify env readback autoritativně potvrdil `RADAR_LIVE_AI_ENABLED=false` pro Functions/runtime,
- `OPENAI_API_KEY` zatím není potřeba a placený AI zůstává mimo pre-live acceptance,
- CI testy jsou zelené,
- testovaný source/deploy artifacts existují.

Zbývá ověřit po prvním zero-cost deployi:

- `/api/health` hlásí `paid_ai_state: LOCKED`,
- static/fixture UI je otevřitelné přes link,
- server-side access funguje,
- shared Netlify Blobs bookmark/status/outreach state funguje přes nasazené Functions,
- `/api/search` a `/api/generate-response` vrací `LIVE_AI_LOCKED` bez OpenAI requestu.

## Aktuální infrastrukturní blocker

Execution sandbox použitý v tomto vlákně nemá funkční DNS/odchozí síť pro `netlify-mcp.netlify.app` ani `api.netlify.com`. Netlify MCP proto dokáže vytvořit projekt, spravovat env a vydat jednorázový deploy proxy příkaz, ale lokální upload z tohoto sandboxu nemůže dokončit.

To není runtime/test chyba aplikace. Source artifact a deploy-helper artifact byly vytvořeny z úspěšného CI a jejich předchozí lokální kopie byly ověřeny digestem. Neobcházet tento limit commitováním deploy tokenu/secretem do public repa.

## Úplně poslední placený krok

Až po dokončení zero-cost deploy acceptance výše:

1. uložit `OPENAI_API_KEY` pouze do Netlify server-side environment,
2. zkontrolovat cost limits/model config,
3. změnit `RADAR_LIVE_AI_ENABLED=true`,
4. provést přesně jeden kontrolovaný live search,
5. zkontrolovat source truth / relevance / budget / contact / dedupe,
6. na jedné vybrané položce provést jeden live Generate Response,
7. po acceptance rozhodnout o merge/release.

Žádný placený test se nemá používat k objevování běžných implementačních chyb, které lze odhalit fixture/mock testem.
