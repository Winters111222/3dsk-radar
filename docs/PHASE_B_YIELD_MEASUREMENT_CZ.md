# Phase B — zero-cost měření výtěžnosti

Datum měření: **5. 9. 2026**. Stav: **Phase B acceptance dokončena; pozitivní výtěžnost zatím neprokázána**.

## Bezpečný měřicí contract

Repo obsahuje explicitní příkaz:

```bash
npm run measure:collector:live -- --confirm-live-read-only
```

Bez přesného argumentu `--confirm-live-read-only` příkaz skončí ještě před sítí. Jeden běh má pevně:

- tři povolené first-party upstream adresy,
- čtyři TED query requesty a jednu společnou stránku každého UK OCDS zdroje,
- nejvýše **6 network requestů**,
- nejvýše **50 záznamů na stránku**,
- žádný automatický retry,
- `openai_requests: 0`,
- `cost_usd: 0`,
- `persistence: NONE`,
- pouze agregované counters ve výstupu; žádné automatické publikování opportunities.

## Co odhalil první měřený průchod

První omezená diagnostika odhalila dva konkrétní false-positive problémy TED full-text dotazů:

1. samotný akronym `FACS` vrátil 18 nesouvisejících aktivních notices; samostatné dotazy `pipeline consulting`, `character pipeline` a `facial rig` vrátily nulu,
2. obecné `photogrammetry services` vrátilo 7 převážně leteckých, mapových, lesnických a archeologických zakázek, které jsou podle product decision mimo scope 3D.sk.

Runtime pack byl proto zpřesněn:

- `FACS` → `facial action coding system`,
- `photogrammetry services` → `human photogrammetry services`,
- `scan processing` → `human scan processing`.

Kategorie `FACIAL_FACS`, lidské skenování ani character služby se neodstraňují. Opravena byla pouze nejednoznačná upstream vyhledávací fráze. Regresní test zakazuje návrat holého `FACS` a obecných GIS-fotogrammetrických frází do runtime packu.

## Autoritativní post-fix běh

Čas: `2026-09-05T16:55:01.676Z`.

| Zdroj | Rozsah | Viděno | Vráceno | Výsledek |
|---|---|---:|---:|---|
| TED | External Development | 0 | 0 | OK |
| TED | Production Overflow | 0 | 0 | OK |
| TED | Pipeline Consulting | 0 | 0 | OK |
| TED | Other Relevant | 0 | 0 | OK |
| Find a Tender | jedna stránka sdílená pro 4 packy | 50 | 0 | 1 inactive, 49 mimo lokální scope |
| Contracts Finder | jedna stránka sdílená pro 4 packy | 50 | 0 | 10 inactive, 40 mimo lokální scope |

Run dokončil všech 6 plánovaných requestů, bez retry, OpenAI, ceny nebo persistence. Nula relevantních records je měřený výsledek tohoto malého časového vzorku; **není to důkaz, že na zdrojích neexistují žádné relevantní nabídky**. UK endpointy nemají keyword parametr v použitém OCDS contractu, takže jejich skutečná výtěžnost vyžaduje bezpečné stránkování a cross-source klasifikaci v Phase C.

V celém tomto yield-review kroku proběhlo 25 source requestů: bounded měření, dva cílené diagnostické průchody, izolace čtyř TED termů a finální post-fix run. Spolu se čtyřmi dřívějšími canary requesty je kumulativně evidováno 29 source requestů, 0 OpenAI requestů a cena `$0`.

## Rozhodnutí CanadaBuys

CanadaBuys nyní **nepřidáváme do malého runtime collector contractu**. Oficiální zdroje potvrzují volně stahované datasety tender notices a jejich refresh, ale nebyl potvrzen dokumentovaný stránkovaný search API endpoint kompatibilní s limitem 50, cursorem a krátkým requestem.

- oficiální přehled dat: <https://canadabuys.canada.ca/en/procurement-and-contracting-data>,
- oficiální tender dataset: <https://open.canada.ca/data/en/dataset/6abd20d4-7a1c-4b38-baa2-9525d0bb2fd2>,
- oficiální vysvětlení struktury a refreshů: <https://donnees-data.tpsgc-pwgsc.gc.ca/ba2/ac-cb/soutien-support-eng.html>.

`New tender notices` se podle PSPC aktualizuje každé dvě hodiny a ostatní soubory denně. Jde ale o bulk soubory, nikoli potvrzený malý cursor contract. Případný CanadaBuys adapter proto patří až do samostatně navržené bulk-ingest větve s limitem stažených bajtů, maximem zpracovaných řádků, kontrolou `Open` + closing deadline a testem schema driftu. HTML scraping ani nezdokumentovaný frontend endpoint se nepoužije.

## Závěr Phase B

Phase B je z hlediska implementace a zero-cost acceptance **100 %**:

- tři oficiální collectory mají ověřený contract,
- komunitní access review je uzavřený fail-closed,
- měření všech čtyř runtime packů je reprodukovatelné a omezené,
- dva nalezené zdroje šumu byly odstraněny regresními testy,
- CanadaBuys má explicitní odůvodněné rozhodnutí místo nebezpečného improvizovaného adapteru.

Pozitivní obchodní výtěžnost zůstává neprokázaná. Další práce už je Phase C: cursor/chunky, run state, průběžná persistence, retry policy bez duplikace, cancel, tender revision identity, cross-source dedupe a detailní truth klasifikace.
