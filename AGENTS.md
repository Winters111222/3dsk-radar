# AGENTS.md — 3D.SK Opportunity Radar

## Jazyk

S vlastníkem komunikuj česky. Veřejné obchodní e-maily generuj anglicky, pokud konkrétní poptávka nevyžaduje jiný jazyk.

## Autorita

Nejdřív načti:

1. `README.md`
2. `docs/PROJECT_BRIEF_CZ.md`
3. `docs/PRODUCT_DECISION_COMPANY_MEMORY_CZ.md`
4. `docs/PRELIVE_ACCEPTANCE_CZ.md`, pokud existuje
5. aktuální `main` a relevantní aktivní review branch/PR podle handoffu

Tyto soubory jsou autoritou pro scope MVP. Novější explicitní product decision doplňuje původní brief tam, kde byl scope později zpřesněn.

## Hlavní pravidlo

Projekt musí zůstat malý. Primární flow je:

`SEARCH → EXTRACT → SCORE → DISPLAY → SELECT → GENERATE RESPONSE → COPY TO OUTLOOK`

Nepřidávej bez výslovného požadavku vlastní CRM, automatické e-mailové odesílání, Gmail/Outlook OAuth, LinkedIn scraping, Supabase, komplexní auth, automatické sales kampaně ani background agenty.

## Bezpečnost / NDA

Repo je při založení PUBLIC.

Nikdy necommituj secrets ani neveřejné klientské informace. Nikdy nevymýšlej credentials. Outbound obchodní text smí použít pouze capability/credential explicitně označený jako veřejně schválený v autoritativním company profilu.

API klíče musí být pouze server-side env vars. Klíč se nesmí dostat do browser bundle, logu, odpovědi API ani repository.

Kontaktní e-mail se nesmí domýšlet. Pokud není veřejně dohledaný a doložený zdrojem, zobraz `Email not publicly available` a odkaz na apply/contact page.

`TO` pro generovanou odpověď nesmí vymýšlet model. Server ho může převzít pouze z již source-gated veřejného `contact_email`.

## Produktová zásada

`Win score` není statistická pravděpodobnost výhry. Je to heuristický opportunity score 0–100 založený na fitu a dostupných veřejných datech. UI to musí jasně označovat.

Budget musí mít původ:

- `PUBLISHED` — skutečně uvedený zdrojem,
- `ESTIMATED` — odhad modelu / heuristiky,
- `UNKNOWN` — není dost dat.

`OPEN_OPPORTUNITY` a `POTENTIAL_LEAD` nikdy nezaměňuj.

## Company memory / outreach

Bookmark a outreach memory jsou company-level, ne jen opportunity-level.

MVP musí zachovat:

- samostatný sloupec Company,
- `☆ / ★` bookmark firmy,
- pohled `BOOKMARKED`,
- `last_contacted_at`, `contact_count` a `contact_history`,
- `MARK EMAIL SENT` jako ruční záznam po skutečném odeslání,
- viditelné varování při recent outreach stejné firmě.

Radar nikdy sám e-mail neposílá.

## Technologie MVP

Preferovaný jednoduchý stack:

- statický web / velmi malý frontend,
- Netlify,
- Netlify Functions jako server-side API,
- server-side OpenAI API,
- Netlify Blobs pro jednoduchý shared team state,
- private/server-only configuration pro secrets a případné neveřejné obchodní údaje.

Nezaváděj Supabase, pokud se neprokáže skutečná potřeba.

Pokud současná Netlify/OpenAI dokumentace vyžaduje jiný minimální postup, ověř aktuální dokumentaci a zvol nejjednodušší podporované řešení.

## Vývoj

- Dělej malé, testovatelné změny.
- Zachovej jednoduché UI.
- Nezvyšuj scope bez jasného přínosu pro nalezení a rychlou reakci na příležitost.
- Search musí být explicitně spuštěný uživatelem v MVP; žádné automatické placené AI runy.
- Generování odpovědi musí být samostatné tlačítko.
- Deduplikuj podle canonical URL + rozumného fingerprintu nabídky.
- Uchovávej původní source URL a čas `first_seen`/`last_seen`.
- Shared status/bookmark/outreach stav ukládej server-side; preview data nesmí kontaminovat production state.

## Paid AI gate

Dokud není systémově dokončený Stage 0–4 a zero-cost pre-live acceptance, musí být:

`RADAR_LIVE_AI_ENABLED=false`

Search i Generate Response musí fail-closed skončit před použitím `OPENAI_API_KEY`.

Placené live AI volání je úplně poslední acceptance krok, ne způsob ladění běžných implementačních chyb.

## Minimum acceptance

MVP není hotové, dokud uživatel nemůže přes jeden webový link po interní ochraně:

1. spustit worldwide search,
2. dostat nové relevantní výsledky s původním zdrojem,
3. otevřít detail,
4. vidět fit score / win score / budget provenance / kontakt,
5. bookmarkovat firmu a zobrazit BOOKMARKED firmy,
6. vidět, zda a kdy už byla firma kontaktovaná,
7. zkopírovat veřejný e-mail, pokud existuje,
8. vybrat jednu nabídku,
9. jedním tlačítkem vygenerovat personalizovanou anglickou obchodní odpověď,
10. zkopírovat subject i body do Outlooku,
11. po ručním odeslání označit `MARK EMAIL SENT`,
12. změnit status `NEW / INTERESTING / CONTACTED / IGNORE`,
13. při dalším searchi nedostávat staré výsledky jako nové,
14. u nové nabídky stejné firmy vidět předchozí outreach history.
