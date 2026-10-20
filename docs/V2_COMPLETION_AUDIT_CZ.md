# V2: rozsah dokončení — 2026-10-20

Podklad: původní OPPORTUNITY_RADAR_V2_IMPLEMENTATION_BRIEF.md dodaný vlastníkem, současný zdrojový kód a read-only kontrola produkce po V2 Lite. Dokument není pokynem k rozšíření scope.

## Schválená V2 Lite

Všech 5 oblastí má implementaci: pravdivé finální čítače/PARTIAL, aktuálnost a historie, obchodní typy a nízký rozpočet, UI/poznámky, regresní testy a nasazení. Live kontrola potvrdila 20 uložených záznamů, 16 obchodních příležitostí, 15 firem a 3 běhy. Poznámky zachované.

Acceptance: 4 oblasti ověřené v rozsahu Lite; search oprava částečně ověřená. Ochrana nadlimitní odpověď odmítá a neprovádí retry, ale dodržení limitu poskytovatelem ani výtěžnost nelze potvrdit bez placeného běhu. 505 automatických testů prošlo. Placený test nebyl spuštěn.

Následný audit opravil dva UI nedostatky: sjednocení klasifikace v detailu adresáře se seznamem a nápovědu prázdných výsledků zahrnující aktuálnost a reset filtrů. Testy kontrolují oba případy.

## Celý původní brief: přísné Definition of Done

Počítání níže hodnotí 10 závěrečných podmínek briefu, nikoli procento práce ani počet řádků kódu. Částečné splnění neznamená dokončení.

| Podmínka | Stav | Co chybí / důkaz |
|---|---|---|
| Hlavní seznam bez uzavřených a permanentních pozic | Částečně | Existují samostatné pohledy a štítky; All saved stále obsahuje historické záznamy i employment signály. |
| Tvrdé scope/geografické filtry | Částečně | Existují pravidla a regrese pro vyloučené workflow a capture mimo CZ/SK; není dokončena celá nová kulturní taxonomie a všechna acceptance briefu. |
| Najít a vysvětlit relevantní zakázky | Částečně | Existující hledání a FIT/WIN; nikoli nový pětisložkový scoring a prokázaná výtěžnost po změně. |
| Každý otevřený detail znovu ověřen před reportem | Nesplněno | Chybí kompletní reverify/report pipeline s finální URL a HTTP stavem. |
| Vlastní API profily | Nesplněno | Záměrně ponechán stávající serverový klíč; žádné BYO API UI. |
| Plán, timezone, limit a příjemci | Nesplněno | Žádný uživatelský plánovač pravidelných searchů. |
| Samostatně srozumitelný e-mailový digest | Nesplněno | Žádný HTML/plain-text digest ani odesílací workflow. |
| Všech 20 acceptance testů původního briefu | Nesplněno | 505 existujících regresí není totéž co kompletní acceptance nového briefu. |
| Zachování dat a týmové historie | Splněno v ověřeném rozsahu | Bez migrace; read-only live kontrola počtů, poznámek a historie, regresní testy. |
| Dokumentace API/scheduleru/e-mailu a chyb | Částečně | Existující dokumentace a Lite checkpoint; návody k neimplementovaným funkcím nejsou hotové. |

Součet: **1/10 splněno, 4/10 částečně, 5/10 nesplněno** při striktním hodnocení celého původního briefu. To není tvrzení, že aplikace je jen z 10 % hotová: původní brief popisuje výrazně větší produkt než schválené odpolední Lite.

Další mezery: úplný nový datový model, oddělené Strategic leads/Partnerships, úplná matice povinných zdrojů A/B, úplné filtry, reverify a false-positive workflow. Historický text o údajně mrtvé konkrétní Upwork URL není důvodem k trvalému blacklistu; rozhodovat má skutečný aktuální redirect/detail.

Bez nové dohody nerozšiřovat Lite na BYO klíče, automatické placené běhy ani odesílání reportů. V tomto auditu se produkční data ani credentials neměnily.
