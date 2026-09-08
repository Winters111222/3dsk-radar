# Deep Research: source gap, grantová lane a bezpečná aktivace

Datum: 2026-09-08
Výchozí checkpoint: PR #42, commit `2ca3699b02a1fcc11689c553843fb8c8f6bf391a`

## Výsledek

Deep Research potvrzuje, že hlavní omezení Radaru není rozpočet jednoho placeného běhu, ale kvalita zdrojové vrstvy: pokrytí přesných detailních URL, správné rozlišení buyer/seller/zdrojové platformy, aktuálnost a přístupová pravidla jednotlivých webů.

Importovaná vrstva proto zůstává výzkumným, default-off podkladem:

- 50 zdrojů a 71 watchlist URL;
- 52 lokalizovaných query shardů;
- 19 explicitních aliasů na již existující katalogové zdroje;
- 0 povolených crawlerů, 0 naplánovaných běhů a 0 automatických placených operací.

Výzkum není připojen jako nový přímý crawler. Použitelné veřejné detailní cesty jsou přidány do stávajícího `INDEX_DISCOVERY_MANUAL_VERIFY`, kde hledání provádí hosted web index a každý nalezený výsledek vyžaduje ruční otevření originálního zdroje před kontaktem.

## Co je pro Radar relevantní teď

### 1. CZ/SK institucionální poptávky

Největší praktická mezera byla v lokálních veřejných zakázkách. Hosted-index allowlist nyní pokrývá vedle TED, NEN a ÚVO také:

- Zakázky GOV;
- ověřené E-ZAK instance pro Jihomoravský a Středočeský kraj;
- JOSEPHINE.

Přijatelný výsledek musí být přesný detail aktivní zakázky na 3D skenování, fotogrammetrii nebo 3D digitalizaci sbírkových předmětů. Dokumentové/filmové skenování, nákup skeneru, GIS, BIM, budovy a obecná digitalizační strategie zůstávají mimo scope.

### 2. České a slovenské granty

Grant je obchodně relevantní dříve než samotná zakázka, ale není totožný s buyer objednávkou. Radar proto zavádí samostatnou kategorii `HERITAGE_FUNDING_PARTNERSHIP` a UI štítek `FUNDING / PARTNERSHIP`.

Výsledek se může zobrazit jako `POTENTIAL_LEAD`, pouze když:

- jde o stále otevřenou českou nebo slovenskou výzvu, která explicitně podporuje 3D digitalizaci, 3D skenování, fotogrammetrii nebo související 3D postprodukci kulturních předmětů; a
- 3D.SK se může účastnit přímo nebo s oprávněným muzeem či jinou institucí; nebo
- jde o nedávno jmenovaného příjemce podpory a jeho konkrétní projekt explicitně obsahuje relevantní 3D produkci.

Grant se nikdy neoznačí `OPEN_OPPORTUNITY`. Tím se stane až samostatná veřejná zakázka nebo konkrétní buyer poptávka. Grantová částka se nikdy nepřenese do buyer project budgetu.

Sledované oficiální vstupy:

- [MK ČR — Digitalizace kulturních statků a národních kulturních památek](https://www.mk.gov.cz/digitalizace-kulturnich-statku-a-narodnich-kulturnich-pamatek-cs-2941)
- [MK ČR — granty a dotace](https://www.mk.gov.cz/granty-a-dotace-cs-1234)
- [MK ČR — Integrovaný systém ochrany movitého kulturního dědictví](https://www.mk.gov.cz/integrovany-system-ochrany-moviteho-kulturniho-dedictvi-cs-525)
- [Fond na podporu umenia — výzvy](https://www.fpu.sk/sk/vyzvy/)
- [Ministerstvo kultúry SR — dotácie 2026](https://www.culture.gov.sk/sk/dotacie-2026)
- [EEA/Norway Grants Slovakia — kultura a místní rozvoj](https://eeagrants.org/sk/slovakia/programmes/culture-local-development/news/nove-vyzvy-v-oblasti-kultury-vyhlasene)

Stav stránky se musí kontrolovat při každém vyhledání. Například výzva FPU 9/2026 měla na oficiální stránce stav uzavřený 7. 9. 2026 a nesmí se vrátit jako aktivní. Program ISO MK ČR uvádí výzvy 2026 jako uzavřené a další výzvy pro rok 2027 očekává na podzim 2026; dokud neexistuje konkrétní otevřená výzva s relevantním 3D scope, jde pouze o watchlist signál.

### 3. Marketplace a komunitní buyer kanály

Do přísných detail-URL politik byly doplněny Unity Discussions a Codeur. Výzkum dále doporučuje CGTrader, Useme, Twine, Workana a další marketplace zdroje, ale ty zůstávají default-off, dokud neprojdou source-specific access/ToS kontrolou a měřením precision.

Upwork zůstává nejsilněji doložený buyer kanál, ale výzkum neposkytuje oprávnění zapnout jeho přímé API nebo automatizaci. Používá se pouze stávající hosted-index režim s ruční verifikací.

## Deduplikace proti stávajícímu katalogu

Výzkum opakovaně pojmenovává zdroje, které už v repozitáři existují pod jiným ID. Machine-readable mapa v `config/deep-research-source-aliases.v1.json` brání vzniku druhého konektoru pro stejný web. Patří sem zejména TED, NEN, VVZ/ISVZ, Upwork, Freelancer, Polycount, Blender Artists, Unreal fórum, EEN, SAM.gov, UNDP, UNGM, Find a Tender, PeoplePerHour a Guru.

## Aktivační pořadí

| Vrstva | Co se může udělat | Stav |
|---|---|---|
| Hosted-index detail policies | Přesné veřejné URL, ruční source verification | Implementováno v kódu; runtime zůstává pod existujícími placenými/produkčními gates |
| Grantový watchlist | Aktivní výzvy a konkrétní příjemci jako `POTENTIAL_LEAD` | Logika implementována; všechny importované záznamy default-off |
| Dokumentované veřejné API | TED a další již známé official-source collectory | Jen existující canary/qualification proces |
| Native web/API pilot | Marketplace, E-ZAK, ÚVO/JOSEPHINE, grantové portály | Vyžaduje samostatný ToS/access review a měření precision |
| Permission-required zdroje | Upwork a další omezené kanály | HOLD do doloženého oprávnění |
| Market intelligence | CORDIS, dodavatelské seznamy, konkurenti | Nikdy nezapočítávat jako buyer objednávky |

## Co tato změna nedělá

- neaktivuje přímé scrapování ani přihlášený browser;
- nemění Netlify environment;
- nespouští placený Search;
- nemění denní limity, retry pravidla ani produkční kill switch;
- nepovoluje automatický outreach;
- není souhlasem s deployem nebo mergem.
