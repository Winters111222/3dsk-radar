# Checkpoint — konkurenti a zdrojové platformy ve výsledcích Radaru

Datum: 2026-09-06

## Proč checkpoint vznikl

V produkčním workspace je po prvním placeném FOCUSED běhu sedm uložených
záznamů. Ruční kontrola ukázala, že část starších `POTENTIAL_LEAD` záznamů
nepředstavuje doloženou poptávku kupujícího. Zejména byla prověřena firma
Kabum a zdroj Outscal.

Tento dokument je produktové rozhodnutí pro navazující implementaci. Sám
nemění produkční Blobs, Netlify environment, placené AI ani deployment.

## Ověřené závěry

### Kabum

Prověřená stránka: <https://www.kabum.it/game/>

Kabum se na vlastním webu výslovně prezentuje jako B2B 3D game-art
outsourcing studio. Nabízí digital humans, custom assets, photogrammetry,
optimized assets, cinematics a další 3D produkční služby.

Verdikt:

- `record_kind = COMPETITOR`
- `commercial_role = SELLER`
- samotná service/portfolio stránka není `OPEN_OPPORTUNITY`
- samotný capability overlap není `POTENTIAL_LEAD`
- kontakt, Generate Response a `MARK EMAIL SENT` musí zůstat zamčené
- Kabum lze později oslovit jen tehdy, pokud vznikne jiný, aktuální a konkrétní
  buyer/subcontracting/partner signal; tento nový důkaz musí mít vlastní URL

### Outscal

Prověřené zdroje:

- <https://outscal.com/>
- <https://github.com/outscal/OpenJobs>

Outscal není firma poptávající 3D.SK služby ani přímý konkurent v 3D
outsourcingu. Aktuální homepage je archiv a původní gaming-jobs platforma je
publikována jako open-source ATS harvester/dataset.

Verdikt:

- `record_kind = SOURCE_PLATFORM`
- Outscal se nesmí uložit ani zobrazit jako buyer company
- případný Outscal job hit je pouze discovery provenance
- Radar musí dohledat originální zaměstnavatelskou/ATS detail URL
- bez aktivního originálního detailu se záznam odmítne

## Závazná klasifikační hranice

`opportunity_kind` zůstává pouze pro obchodní cíle:

- `OPEN_OPPORTUNITY` — doložená aktuální buyer poptávka
- `POTENTIAL_LEAD` — doložený budoucí buyer/partner signál bez otevřené poptávky

Nad tím má být přidána oddělená osa:

```text
record_kind = SALES_OPPORTUNITY | COMPETITOR | SOURCE_PLATFORM
```

Pravidla:

1. `SELLER` s překryvem schopností patří do `COMPETITOR`, ne do leadů.
2. Generic services, portfolio, pricing a „contact us for a quote“ nejsou buyer
   signál.
3. `PARTNER` smí být lead pouze s konkrétním aktuálním důkazem, že firma hledá
   dodavatele, subdodavatele, vendor partnera nebo overflow kapacitu.
4. Job board, agregátor a ATS jsou `SOURCE_PLATFORM`, nikdy buyer company.
5. `COMPETITOR` ani `SOURCE_PLATFORM` se nezapočítávají do Opportunities,
   Companies, High Fit ani výsledku placeného search runu.
6. U konkurence jsou outreach a reply akce defaultně zamčené. Samostatná
   budoucí `COMPETITORS` záložka může sloužit pouze pro market intelligence.
7. Reklasifikace starých záznamů nesmí mazat historii. Musí být idempotentní,
   auditovatelná a zachovat původní URL i `first_seen`/`last_seen`.

## Dopad na dosavadních sedm výsledků

Počet sedm nelze považovat za sedm obchodních příležitostí, dokud neproběhne
ruční audit všech uložených položek. Minimálně:

- Kabum je false positive pro sales seznam a má být konkurence.
- Outscal je zdrojová platforma/archiv; není cílová firma.
- jediný dříve ověřený Upwork brief na full-body scan cleanup zůstává doloženou
  `OPEN_OPPORTUNITY`, dokud je jeho originální detail stále aktivní.

## Bezprostřední další implementace

1. Přidat `record_kind` jako backward-compatible server-owned klasifikaci.
2. Přidat deterministic gate pro seller/service pages a source platforms.
3. Doplnit regresní fixture pro Kabum a Outscal.
4. Přidat `COMPETITORS` UI pohled s nulovým vlivem na sales summary.
5. Zamknout contact/reply/outreach pro competitor a source-platform records.
6. Připravit read-only audit sedmi produkčních záznamů.
7. Teprve po schválení připravit jednorázovou idempotentní reclassification
   migraci; nic automaticky nemazat.

## Stav WIDE_INDEX

- Draft PR: <https://github.com/Winters111222/3dsk-radar/pull/30>
- base: `fix/buyer-budget-provenance-20260905`
- base SHA: `015d28ac2e0673db1fe1d182e4619a447ccc5750`
- první wide-search head: `5be14cde585a96426ccd35b87b97c30f69874988`
- 217 testů PASS
- GitHub CI PASS
- automatický Netlify Deploy Preview PASS
- produkce stále používá dosavadní FOCUSED režim
- nebyl spuštěn nový placený běh ani změněn produkční environment

