# Ředitelský přehled — UI review candidate

Base: `c36bff95af4d43b0a10828172841c0ddc0248fe7` (main, PR #48).
Base tree: `4342142e5eda01f990e23a869df31d043ef6ebbc`.
Branch: `feat/director-ui-20260910`.

## Rozhodnutí vlastníka

Radar slouží především řediteli: hlavní obrazovka má usnadnit rychlé posouzení
obchodních příležitostí, nikoli zobrazovat stovky technických diagnostických karet.
Vlastník dále vyžaduje osnovitý, rozklikávací seznam toho, co radar prohledal.

## Implementace

- Světlý přehled, čitelnější typografie a červený hlavní akční prvek.
- Primární tlačítko pouze otevře nastavení hledání; samo nevolá placené API.
- Existující přístupový kód a search/run ovladače zůstávají uvnitř rozbalovací sekce.
- B2B, Individual, uložené firmy, otevřené příležitosti, leads, konkurenti a Rejected
  zůstávají oddělené; žádná změna klasifikace nebo serverových truth gates.
- Defaultně karty s názvem, samostatně zobrazenou firmou, fit/win, rozpočtem,
  stavem, bookmarkem a originálním zdrojem. Plná tabulka uchovává všechny sloupce.
- Lokální textové filtrování podle titulku, firmy, shrnutí a čitelných názvů kategorií.
- Dlouhý detail je uspořádaný podle obchodního rozhodnutí; historie a evidence
  jsou dostupné po rozbalení. Varování před oslovením zůstávají viditelná.
- Fit a Win jsou nadále oddělené; Win není pravděpodobnost získání zakázky.
- `What did Radar search?` otevře 1) vyhledávací okruhy, 2) zdroje se zaznamenanou
  aktivitou a 3) dochované candidate URL seskupené podle domény.

## Důkazní hranice seznamu prohledávání

Přehled čte pouze poslední uložený run: `coverage`, `diagnostics.source_yield`
a `forensic_audit.accepted_candidate_ledger`. Nespojuje s ním historický sales
workspace ani konfigurační katalog zdrojů. Chybějící metrika není nula.

Počet konzultací není počet unikátních webů a může obsahovat opakování mezi
fázemi. Hosted-index consultation není přímý crawl. Průběžné discovery `returned`
není finální sales výsledek. Dochované URL nejsou kompletní browsing historie ani
důkaz, že nabídka zůstává aktivní. Historicky neuložené URL se nerekonstruují.

## Logo

Oficiální hlavičkové SVG dohledané na https://www.3d.sk/ dne 2026-09-10:
https://www.3d.sk/images/v2/3D.svg

Soubor `assets/3dsk-logo.svg` je místní kopie, bez přebarvení a bez změny geometrie.
SHA-256: `cc8b8f49fbc86470c04b3c2c1f8d276bfe32ce123fbc016b0de9bcc179b0e149`.
Nenačítá skripty, externí obrázky ani cizí fonty. Jde o značku vlastníkovy firmy,
nikoli o nové tvrzení o licenci pro další použití mimo tento interní nástroj.

## Testování a release gate

- Offline unit/contract testy a DOM interakce běží bez produkčních credentials.
- DOM test používá `linkedom` jen jako vývojovou závislost; nejde o vizuální renderer.
- Testuje se filtrování, reset, přepnutí layoutu, výběr Rejected, uzamčené outreach
  akce, bezpečné URL a oddělení průběžného yield od finálních výsledků.
- HTTP smoke kontroluje také nové CSS, evidence modul a SVG.
- Výsledek lokální regrese: 487/487 testů PASS; fixture acceptance PASS ($0),
  HTTP smoke 10/10 cest PASS a samostatná ULTRA offline acceptance PASS.
- Cloud browser odmítl localhost náhled (`ERR_BLOCKED_BY_CLIENT`). Nebyla provedena
  náhradní cesta přes síťové omezení. Vizuální desktop/mobile acceptance je PENDING.
- Před označením za finální UI ověřit autorizovaný preview na 1440, 1024 a 390 px:
  logo/kontrast, karty, full table scroll, dlouhé titulky, detail, keyboard navigation,
  ovladače rozbalení, nulové výsledky a velký run report.

Žádný merge, produkční deploy, změna environmentu, zapnutí zdrojů ani placený run
nejsou součástí této UI změny. První nasazení musí následovat samostatné schválení.
