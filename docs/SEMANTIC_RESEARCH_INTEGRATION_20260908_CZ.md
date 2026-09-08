# Integrace sémantického výzkumu Astry — 8. 9. 2026

## Výsledek

Druhý výzkumný balík zvyšuje pokrytí významů a nákupních událostí, ale nepotvrzuje, že je aktuálně dostupných deset otevřených zakázek. Ze 107 ručně prověřených kandidátů obsahuje 0 tříd A/B, 5 partnerských možností C, 32 signálů D a 70 odmítnutí. Všech pět C zůstává uzamčeno pro ruční kvalifikaci, protože externí rozsah, rozpočet a přijímání subdodávek nejsou potvrzené.

## Autoritativní vstup a reprodukovatelnost

- manifest SHA-256: `a5c8f7dafc5c845668b5dbaa0e30dcb9422b1bf2f7266ed9a495d55426605470`;
- report SHA-256: `cd65e0882122716f0b5806cd4b13432b4174a6c2c43f819c0c5f1cb2b5a42699`;
- evidence workbook SHA-256: `ead04004152714552366d380c47f048235842281fe519a16db5bad1b2c44cce4`;
- importér: `scripts/import-semantic-research.mjs`;
- odvozený, očištěný artefakt: `config/semantic-research-derived.v1.json`.

Importér přijme pouze přesný manifest podle SHA-256 a očekávané počty 47 zdrojů, 64 dotazů a 107 kandidátů. Odstraní kontaktní pole, normalizuje známé aliasy zdrojů a vynutí `scheduled_collection_enabled=false`, `automatic_paid_execution_enabled=false` a `production_import_enabled=false`.

## Co bylo začleněno do vyhledávání

Do existujících 25 WIDE_MAX shardů byla přidána významová vrstva osmi záměrů:

1. human digital double;
2. AI dataset capture;
3. scan cleanup a Wrap;
4. photogrammetry assets;
5. remote production overflow;
6. museum digitisation;
7. funded heritage;
8. tender lifecycle.

Vyhledávání proto nemusí čekat na názvy `RealityCapture`, `ZBrush`, `Substance Painter` nebo `Wrap3D`. Umí hledat i popis problému či nákupní události: například slité prsty, díry a poškozené vlasy ve skenu, konzistentní topologii, fitting na basemesh, de-lighting/PBR, dodaná fotografická data, placený art test, dávku assetů, backlog, vendor onboarding, award nebo plánovanou zakázku.

Adaptivní follow-up používá stejnou taxonomii. Tvrdé truth gates se nemění: financování samo není objednávka, nabídka služby není buyer demand, klasická pracovní pozice není studio zakázka a fyzický zahraniční scan bez vzdáleně oddělitelné postprodukce se nepřijímá.

## Vícejazyčné pokrytí

Výzkumná matice obsahuje osm kategorií v osmi jazycích: CS, DE, EN, ES, FR, IT, PL a SK. Runtime relevance nyní rozpozná vybrané vícejazyčné formulace poptávky po dodavateli i oznámení, že výzva či zakázka skončila. Všechny 64 konkrétní dotazy v odvozeném artefaktu však zůstávají `enabled=false`; slouží jako ověřená research/eval sada, nikoli jako skrytá aktivace crawleru.

## Upwork a LinkedIn

Tento blok nezapíná přímé obcházení platforem. Existující alert bridge umí bezpečně normalizovat upozornění doručené oprávněným kanálem a vyžaduje ruční kontrolu originálního detailu. Upwork může být sledován oficiálním přístupem nebo compliant veřejným indexem. LinkedIn zůstává bez schváleného automatického watchlistu vypnutý; vhodná cesta je uživatelem vytvořený alert a read-only zpracování jeho e-mailu. Login, CAPTCHA, robots pravidla ani anti-bot ochrany se neobcházejí.

## Bezpečnostní důsledek

`npm run sources:check` fail-closed ověřuje všechny počty, URL, jazyky, kategorie a zámky. Nepotvrzené C/D nejsou sales výsledky a nemohou povolit outreach. Integrace neprovádí síťové volání, placené hledání, retry, produkční zápis, deploy ani změnu environmentu.

## Co lze realisticky očekávat

Sémantická vrstva zvyšuje recall u nabídek, které popisují výsledek nebo problém místo konkrétního softwaru. Sama ale nevytvoří tržní poptávku ani přístup k uzavřeným platformám. Vyšší počet použitelných výsledků vyžaduje současně čerstvé event-driven zdroje, oprávněný Upwork/LinkedIn alert ingress a detailní ověření buyer identity, aktivity, rozsahu a vzdálené proveditelnosti.
