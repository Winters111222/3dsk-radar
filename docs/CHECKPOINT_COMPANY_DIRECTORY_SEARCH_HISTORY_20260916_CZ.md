# Checkpoint — historický adresář firem a historie hledání

Datum: 2026-09-16  
Větev: `main`

## Výsledek

Radar má dvě nové uživatelské záložky:

- **Companies & people** seskupuje všechny historicky uložené sales příležitosti podle firmy. Ukazuje počet příležitostí, první a poslední nalezení, veřejně doložené osoby/kontakty, poslední outreach kanál a poznámku. Z firmy lze jedním kliknutím přejít na její příležitosti.
- **Search history** ukazuje nejnovější běhy hledání, cenu a souhrn nových, aktualizovaných a vrácených výsledků.

## Persistence a kompatibilita

- Existující `metadata/last-search` zůstává beze změny kvůli kompatibilitě diagnostiky.
- Nové běhy ukládají kompaktní souhrn do `metadata/search-history-v1`.
- Archiv je deduplikovaný podle identity běhu, řazený od nejnovějšího a omezený na 100 záznamů.
- Do historie se nekopíruje forensic audit ani kandidátní ledger, takže archiv zbytečně nezvětšuje uložiště.
- Pokud nový archiv ještě neexistuje, API nabídne poslední známý search jako zpětně kompatibilní první položku.
- Adresář firem se počítá z již existujícího persistentního workspace; není potřeba datová migrace ani placený search.

## Bezpečnostní hranice

- Konkurenti a source-platform records se do adresáře potenciálních zákazníků nezahrnují.
- Kontakty jsou pouze dříve uložené veřejně doložené hodnoty; žádný e-mail se nedopočítává.
- Funkce nic automaticky nekontaktuje a nespouští placené hledání.
- Stávající source verification a outreach locks zůstávají zachované.

## Ověření

- Node syntax check pro frontend a repository.
- Kompletní test suite.
- HTTP, fixture a ULTRA acceptance bez placeného volání.
- Produkční deploy se ověřuje podle exact commit identity, přítomnosti nových UI markerů a zdraví `/api/health`.

