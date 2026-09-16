# Checkpoint: Focus workspace a kompaktní firemní adresář

Datum: 16. 9. 2026

## Problém

Hlavní pracovní plocha byla ve výchozím stavu příliš široká a informačně hustá. Historie firem se zobrazovala jako velká mřížka podobných karet nad samotnými výsledky a široká tabulka nutila uživatele současně horizontálně i vertikálně scrollovat.

## Implementované řešení

- Výchozí režim výsledků je `Focus view`: skenovatelný seznam příležitostí vlevo a detail vybrané příležitosti vpravo.
- Původní široká tabulka zůstává dostupná jako volitelný `Full table` režim.
- Hlavní navigace má čtyři jasné sekce: Opportunities, Companies & people, Search history a Rejected.
- B2B, Individual, Saved, Open, Potential leads a Competitors jsou nyní menší filtry uvnitř Opportunities.
- Companies & people používá kompaktní rozložení seznam + detail. Detail obsahuje kontakty, poslední outreach, poznámku a přímé odkazy na uložené příležitosti.
- Neznámé a anonymní firmy jsou řazené až za pojmenované firmy.
- V adresáři a historii se skrývají nerelevantní filtry, řazení a přepínače rozložení.
- Opraven kolizní DOM selektor, kvůli kterému se dříve skrýval technický pre-live panel namísto viditelných výsledkových filtrů.
- Historie hledání už nezobrazuje chybějící cenu jako `$0.0000`; používá poctivé `Cost unavailable`.
- Mobilní layout skládá seznam a detail pod sebe bez horizontálního přetečení.

## Ověření

- `npm test`: 497/497 testů prošlo.
- `npm run accept:fixture`: prošlo, cena `$0`.
- `npm run accept:http`: prošlo, 10 HTTP cest.
- `npm run accept:ultra`: 4/4 testy prošly bez placeného běhu.
- Lokální vizuální kontrola desktopového i mobilního breakpointu prošla bez chyb v konzoli.

## Bezpečnost a chování

Změna neupravuje search limity, placené operace, truth gates ani persistence kontrakt. ULTRA MAX zůstává jediným placeným vyhledávacím tokem a široká tabulka zůstává dostupná pro pokročilou kontrolu dat.
