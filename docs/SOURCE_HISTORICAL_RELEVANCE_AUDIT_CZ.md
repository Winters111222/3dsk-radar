# Audit historické relevance zdrojů

**Rozhodnutí vlastníka · 5. září 2026**

Radar nesmí plošně prohledávat obecné pracovní, procurement ani 3D weby jen proto, že jejich název vypadá relevantně. Zdroj se smí stát runtime kandidátem teprve po doložení konkrétních historických buyer nabídek odpovídajících schopnostem 3D.SK.

Strojově čitelným zdrojem pravdy je [`config/source-historical-qualification.v1.json`](../config/source-historical-qualification.v1.json). Audit pokrývá všech 49 položek výzkumného katalogu přesně jednou.

## Výsledek

| Tier | Počet | Význam | Smí se nyní automaticky prohledávat? |
|---|---:|---|---|
| A | 5 | Konkrétní historická buyer nabídka v core nebo těsně přilehlém scope | Ne |
| B | 5 | Hiring, outsourcing, supplier nebo přilehlý procurement signál | Ne |
| C | 35 | Kandidátní doména bez pozitivního zdrojově specifického důkazu | Ne |
| DISABLED | 4 | Nedostupný nebo již vyřazený zdroj | Ne |

**Aktuální počet runtime způsobilých zdrojů je 0.** Tier A potvrzuje obsahový potenciál, nikoli právo automatizovat ani dobrou výtěžnost. Příští robustní běh se proto nesmí rozběhnout přes všech 49 webů.

## Tier A — doložená buyer relevance

| Zdroj | Historický důkaz | Co ještě blokuje runtime |
|---|---|---|
| Upwork | [Ongoing full-body human photogrammetry scan cleanup](https://www.upwork.com/freelance-jobs/apply/Scan-Cleanup-Full-Body-Human-Photogrammetry-Ongoing_~022093482015133487827/) | Jen schválený API use case; žádný HTML scraper |
| Freelancer | [Photogrammetry heads a 3D athlete characters](https://www.freelancer.com/projects/3d-modelling/Character-Texture-Artist) | Starý uzavřený důkaz; schválená datová cesta a aktuální yield chybí |
| Unreal Job Offerings | [Placená MetaHuman assembly a wardrobe setup](https://forums.unrealengine.com/t/paid-metahuman-expert-needed-for-character-assembly-and-wardrobe-setup/2734270) | Access review blokuje automatizaci |
| Polycount Paid | [Placený character-art projekt](https://polycount.com/discussion/239037/paid-freelance-stylized-game-artist-s-characters-animation-environment-art) | Access review; příklad je USA-only |
| Reddit gameDevClassifieds | [Character artist](https://www.reddit.com/r/gameDevClassifieds/comments/1kktbal/hiring_3d_character_artist_webcomic_in_development/) a [character modelling/rigging/animation](https://www.reddit.com/r/gameDevClassifieds/comments/1fyhewr/paid_indie_developer_looking_for_3d_character/) | Směšuje HIRING/FOR HIRE; nutná schválená API cesta |

## Tier B — signál, nikoli přímá B2B objednávka

| Zdroj | Co bylo doloženo | Rozhodnutí |
|---|---|---|
| Work With Indies | Character role | Pouze discovery; nábor jednotlivce není zakázka pro studio |
| Remote Game Jobs | Contract humanoid character animator | Pouze discovery; B2B eligibility není potvrzena |
| Riot Games | Art outsourcing manager | Pouze obchodní signál, ne zveřejněný buyer brief |
| GeBIZ Singapore | Přilehlý photogrammetry/media procurement | Access/reuse omezení; scope není jistý core fit |
| Sony Pictures Suppliers | Oficiální supplier cesta | Jen ručně; registrace není objednávka |

## Zbytek katalogu

- **Tier C — 35:** Blender Artists Paid Work, PeoplePerHour, Guru, Hitmarker, Games Jobs Direct, ArtStation Jobs, GameJobs.co, VFXengine, Global animation jobs sheet, Behance Jobs, Contra, TED, Find a Tender, Contracts Finder, SAM.gov, CanadaBuys, AusTender, UNGM, UNDP, NEN, ISVZ/VVZ, EEN requests, EU partner search, GETS, Public Contracts Scotland, eTenders Ireland, World Bank procurement, EBRD/ECEPP, Ubisoft, Remedy, Framestore, DNEG, Wētā FX, Naughty Dog a Guerrilla.
- **DISABLED — 4:** EA Careers, Rockstar Careers, Bungie Careers a CreativeHeads.

Tier C neznamená, že se na daném webu nikdy nemůže objevit relevantní práce. Znamená pouze, že pro automatické utrácení času a requestů zatím chybí pozitivní důkaz. U TED, Find a Tender a Contracts Finder navíc malý dosavadní live vzorek nepřinesl relevantní výsledek; existence funkčního API nebo collector adapteru proto nesmí být zaměněna za obchodní výtěžnost.

## Fail-closed aktivační pravidlo

Zdroj lze navrhnout k runtime aktivaci pouze tehdy, když současně:

1. je Tier A a má nejméně dva konkrétní pozitivní historické buyer příklady;
2. má výslovně schválenou automatizační cestu (`AUTOMATION_APPROVED`);
3. v odděleném source-specific benchmarku dosáhne precision alespoň 80 %;
4. benchmark obsahuje nejméně 30 ručně zkontrolovaných přijatých hitů;
5. runtime změna projde samostatnou implementací, testy a schválením.

Dokud všechny podmínky neplatí, `runtime_eligible` musí zůstat `false`. `npm run sources:check` kontroluje úplnost auditu, povolené hodnoty a tento fail-closed kontrakt bez sítě a bez OpenAI.

Runtime endpointy navíc načítají stejný kvalifikační artefakt a vracejí `SOURCE_RELEVANCE_LOCKED`, pokud zdroj není způsobilý. Samotné nastavení `RADAR_SOURCE_COLLECTION_ENABLED=true` tedy pojistku relevance neobejde.

## Praktický další krok

Nejrozumnější další fáze není WIDE crawl. Je to levný source-specific benchmark Tier A cest, které lze používat legálně a technicky bezpečně. Každý zdroj se změří zvlášť, aby široký šum z procurementu nebo job boardů nemohl zakrýt nulovou výtěžnost.
