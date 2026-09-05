# AGENTS.md — 3D.SK Opportunity Radar

## Jazyk

S vlastníkem komunikuj česky. Veřejné obchodní e-maily generuj anglicky, pokud konkrétní poptávka nevyžaduje jiný jazyk.

## Autorita

Nejdřív načti:

1. `README.md`
2. `docs/PROJECT_BRIEF_CZ.md`
3. aktuální `main`

Tyto soubory jsou autoritou pro scope MVP.

## Hlavní pravidlo

Projekt musí zůstat malý. Primární flow je:

`SEARCH → EXTRACT → SCORE → DISPLAY → GENERATE RESPONSE → COPY`

Nepřidávej bez výslovného požadavku vlastní CRM, automatické e-mailové odesílání, Gmail/Outlook OAuth, LinkedIn scraping, Supabase, komplexní auth, automatické sales kampaně ani background agenty.

## Bezpečnost / NDA

Repo je při založení PUBLIC.

Nikdy necommituj secrets ani neveřejné klientské informace. Nikdy nevymýšlej credentials. Outbound obchodní text smí použít pouze capability/credential explicitně označený jako veřejně schválený v autoritativním company profilu.

API klíče musí být pouze server-side env vars. Klíč se nesmí dostat do browser bundle, logu, odpovědi API ani repository.

Kontaktní e-mail se nesmí domýšlet. Pokud není veřejně dohledaný a doložený zdrojem, zobraz `Email not publicly available` a odkaz na apply/contact page.

## Produktová zásada

`Win score` není statistická pravděpodobnost výhry. Je to heuristický opportunity score 0–100 založený na fitu a dostupných veřejných datech. UI to musí jasně označovat.

Stejně tak budget musí mít původ:

- `PUBLISHED` — skutečně uvedený zdrojem,
- `ESTIMATED` — odhad modelu / heuristiky,
- `UNKNOWN` — není dost dat.

## Technologie MVP

Preferovaný jednoduchý stack:

- statický web / velmi malý frontend,
- Netlify,
- Netlify Functions jako server-side API,
- server-side OpenAI API,
- jednoduché persistentní site-wide úložiště pro deduplikaci a statusy (např. Netlify Blobs, pokud je vhodné a dostupné),
- private/server-only configuration pro secrets a případné neveřejné obchodní údaje.

Pokud současná Netlify/OpenAI dokumentace vyžaduje jiný minimální postup, ověř aktuální dokumentaci a zvol nejjednodušší podporované řešení.

## Vývoj

- Dělej malé, testovatelné změny.
- Zachovej jednoduché UI.
- Nezvyšuj scope bez jasného přínosu pro nalezení a rychlou reakci na příležitost.
- Search musí být explicitně spuštěný uživatelem v MVP; žádné automatické placené AI runy bez požadavku.
- Generování odpovědi musí být samostatné tlačítko, aby se AI náklady neutrácely pro každou nalezenou položku.
- Deduplikuj podle canonical URL + rozumného fingerprintu nabídky.
- Uchovávej původní source URL a čas `first_seen`/`last_seen`.

## Minimum acceptance

MVP není hotové, dokud uživatel nemůže přes veřejně dostupný link po autentizaci:

1. spustit worldwide search,
2. dostat nové relevantní výsledky s původním zdrojem,
3. otevřít detail,
4. vidět fit score / win score / budget provenance / kontakt,
5. zkopírovat veřejný e-mail, pokud existuje,
6. vybrat jednu nabídku,
7. jedním tlačítkem vygenerovat personalizovanou anglickou obchodní odpověď,
8. zkopírovat subject i body do Outlooku,
9. označit nabídku alespoň jako `NEW`, `INTERESTING`, `CONTACTED` nebo `IGNORE`,
10. při dalším searchi nedostávat staré výsledky jako nové.
