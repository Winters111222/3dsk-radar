# Review odmítnutých kandidátů

## Účel

Radar zachovává odmítnuté kandidáty v oddělené záložce `REJECTED`, aby je operátor mohl ručně otevřít a posoudit. Tyto záznamy nejsou sales příležitosti a nejsou zahrnuté do B2B, Individual, High Fit ani opportunity součtů.

## Bezpečnostní kontrakt

- Odmítnutí nikdy automaticky neobchází truth gates.
- `KEEP` znamená pouze „ponechat k ruční kontrole“.
- Odmítnutý záznam nemůže generovat odpověď, evidovat outreach ani být automaticky propagován do sales workspace.
- Neukládají se kontaktní osoby, e-maily ani koncepty odpovědí.
- Nový sales záznam může vzniknout pouze z budoucího discovery výsledku, který znovu projde standardními truth gates a exact-URL detail verification.

## Uložené údaje

Pro budoucí běhy se uchovává sanitizovaný titul, deklarovaný kupující, krátké raw shrnutí, veřejná URL, source ID, deklarovaná větev B2B/Individual, raw skóre, fáze a konkrétní důvod odmítnutí. Stav týmové kontroly je `PENDING`, `KEEP` nebo `DISMISSED`.

## Historický běh 2026-09-10

Root run `d5bba9f1-0666-4e36-a0d2-dee8f5aecbe2` měl 22 kandidátů, sedm průběžně přijatých a nula finálně detailně ověřených sales výsledků. Původní schéma zachovalo exact-URL accepted ledger pro sedm detailně odmítnutých kandidátů; ty lze zpětně zobrazit a při prvním rozhodnutí materializovat do review perzistence.

Zbývajících patnáct kandidátů bylo odmítnuto před detailní fází. Předchozí schéma ukládalo jen agregované součty a neuchovalo jejich identity, proto je nelze pravdivě rekonstruovat. Nové schéma tuto ztrátu pro další běhy odstraňuje.
