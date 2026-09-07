# Product decision — company bookmarks + outreach memory

Datum: 2026-09-05

Tento dokument je závazný doplněk `docs/PROJECT_BRIEF_CZ.md` pro V0.1.

## Nový UX contract

Opportunity tabulka musí mít samostatný sloupec `Company`. Firma nesmí být schovaná pouze pod názvem nabídky.

U firmy je hvězdička:

- `☆` = firma není bookmarked,
- `★` = firma je bookmarked.

Bookmark je **company-level**, ne opportunity-level. Pokud stejná firma později vytvoří jinou nabídku, stále je bookmarked.

Toolbar obsahuje pohled `BOOKMARKED`, který rychle ukáže nabídky bookmarked firem.

## Outreach history

Status `CONTACTED` na jednotlivé nabídce nestačí. Radar musí mít company-level historii oslovení.

Minimum company state:

```text
company_key
company
bookmarked
bookmarked_at
last_contacted_at
contact_count
contact_history[]
```

Po skutečném ručním odeslání e-mailu v Outlooku uživatel klikne `MARK EMAIL SENT`.

Tím se:

1. konkrétní opportunity označí `CONTACTED`,
2. do company history přidá timestamp,
3. aktualizuje `last_contacted_at`,
4. zvýší `contact_count`.

Radar sám e-mail nikdy neposílá.

## Duplicate-outreach warning

Pokud se později objeví jiná opportunity téže firmy, musí být vidět, že firma již byla kontaktována.

Do 30 dnů zobraz výrazné varování typu:

`RECENT OUTREACH · emailed 18 days ago · 2× total`

Není to hard block. Nová veřejná poptávka může legitimně vyžadovat novou odpověď. Uživatel ale nesmí snadno přehlédnout předchozí oslovení.

## Persistence

Company bookmarks, opportunity statusy, outreach history a cross-run dedupe jsou sdílený team state.

Pro MVP použít Netlify Blobs. Nezavádět Supabase bez nové prokázané potřeby.

Production data musí používat site-wide storage; preview/non-production data nesmí kontaminovat production store.

## Paid AI build order

Nové závazné pořadí:

1. dokončit Stage 0–4 systémově,
2. dokončit shared persistence, bookmarks a outreach history,
3. dokončit Generate Response backend + UI s mockovanými testy,
4. nasadit a provést zero-cost acceptance,
5. teprve jako úplně poslední krok povolit `RADAR_LIVE_AI_ENABLED=true`,
6. provést první kontrolovaný placený API test.

Default musí být `RADAR_LIVE_AI_ENABLED=false`.
