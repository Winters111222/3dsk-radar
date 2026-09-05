# Pre-live zero-cost acceptance — 3D.SK Opportunity Radar

Datum: 2026-09-05

Tato fáze nastává po Stage 0–4 a před úplně prvním placeným OpenAI testem.

## Závazná hranice

`RADAR_LIVE_AI_ENABLED=false`

Dokud není celý tento checklist splněný, nesmí se přepínač změnit na `true`.

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
- uloží company outreach timestamp,
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

- Netlify projekt existuje,
- health endpoint hlásí `paid_ai_state: LOCKED`,
- CI testy jsou zelené,
- static/fixture UI je nasazené a otevřitelné přes link,
- server-side access a shared state jsou ověřené bez OpenAI requestu.

## Úplně poslední krok

Až po splnění výše uvedeného:

1. uložit `OPENAI_API_KEY` pouze do Netlify server-side environment,
2. zkontrolovat cost limits/model config,
3. změnit `RADAR_LIVE_AI_ENABLED=true`,
4. provést přesně jeden kontrolovaný live search,
5. zkontrolovat source truth / relevance / budget / contact / dedupe,
6. na jedné vybrané položce provést jeden live Generate Response,
7. po acceptance rozhodnout o merge/release.

Žádný placený test se nemá používat k objevování běžných implementačních chyb, které lze odhalit fixture/mock testem.
