# Mobilní UI, řazení a kategorie — 2026-09-05

Navazuje na WORK_DEPLOY_CHECKPOINT_20260905_CZ.md. Backend acceptance blokery zůstávají beze změny.

- Draft PR #7: https://github.com/Winters111222/3dsk-radar/pull/7
- Branch feature/mobile-sort-category-20260905
- Exact remote head d9bcb308ddccf1dfe6cbf84f6b575410771552a0
- Radar CI SUCCESS, run 33964751151.
- 62/62 tests PASS; fixture acceptance cost_usd=0. CI a Netlify build obsahují HTTP smoke.
- Published production deploy 6a9c0432518d435dfd0743dd, šest Functions.
- https://3dsk-opportunity-radar.netlify.app/
- Netlify production branch nyní feature/mobile-sort-category-20260905. Build command guard nyní vyžaduje d9bcb308ddccf1dfe6cbf84f6b575410771552a0 před npm test, accept:fixture, accept:http. Budoucí změna headu vyžaduje vědomou aktualizaci guardu po testech.

## Změny

Mobilní karty místo široké tabulky, dotykové ovládání, mobilní detail. Řazení sloupců oběma směry a samostatný sort selector na mobilu. Budget řadí dle provenance, ne dle neporovnatelných částek/měn/jednotek. Neznámá data poslední v obou směrech. Kategorie multi-select OR, kombinované s ostatními filtry pomocí AND; zahrnuty i sekundární kategorie. Clear categories vrací všechny kategorie. Filtrovaný detail nezůstává na skryté nabídce.

## Browser acceptance

tests/responsive-preview.html hostuje aplikaci v iframe pro skutečné CSS viewporty 320/390/768/1440. Ověřené body clientWidth = scrollWidth: 305, 375, 753 px (15px scrollbar); desktop 1348=1348. Screenshoty 390/320 bez horizontálního přetečení. Photogrammetry => 1 fixture (Atlas); plus Full Character Pipeline => 2 fixtures. Company ASC/DESC ověřeno přes mobilní select i desktop hlavičku; aria-sort odpovídá. Výběr detailu a reset kategorií fungují.

Žádný paid AI run, žádné změny serverového kódu nebo secretů v této UI fázi. PR #1–#7 a main nesloučeny. Předchozí runtime/Blobs/paid acceptance zbývají. Tento UI požadavek hotový, celá V0.1 přibližně 97 %.
