# Audit historické relevance zdrojů

**Rozhodnutí vlastníka · 5. září 2026 · evidence a access review aktualizovány 6. září 2026**

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

| Zdroj | Dva historické buyer důkazy | Co ještě blokuje runtime |
|---|---|---|
| Upwork | [Ongoing full-body scan cleanup](https://www.upwork.com/freelance-jobs/apply/Scan-Cleanup-Full-Body-Human-Photogrammetry-Ongoing_~022093482015133487827/) · [MetaHuman technical artist](https://www.upwork.com/freelance-jobs/apply/Unreal-Engine-MetaHuman-Technical-Artist_~022095854476309693425/) | [Schválený API use case](https://support.upwork.com/hc/en-us/articles/43342677368467-Use-bots-and-other-automation-properly); žádný HTML scraper |
| Freelancer | [Photogrammetry heads a 3D athlete characters](https://www.freelancer.com/projects/3d-modelling/Character-Texture-Artist) · [Full-body scan cleanup](https://www.freelancer.com/projects/photoshop/provide-human-body-scan-model) | [Výslovné písemné povolení](https://www.freelancer.com/about/terms) pro agregaci listings z více webů |
| Unreal Job Offerings | [MetaHuman assembly a wardrobe setup](https://forums.unrealengine.com/t/paid-metahuman-expert-needed-for-character-assembly-and-wardrobe-setup/2734270) · [Placené low-poly characters](https://forums.unrealengine.com/t/low-poly-character-modeller-needed/43032) | [Robots pravidla](https://forums.unrealengine.com/robots.txt) blokují search a topic/category RSS |
| Polycount Paid | [Placený character-art projekt](https://polycount.com/discussion/239037/paid-freelance-stylized-game-artist-s-characters-animation-environment-art) · [Placený test a sada 20+ real-time účesů](https://polycount.com/discussion/238763/paid-real-time-character-hair-artist-mens-hairstyles-for-ios-ar-app-usdz-glb) | [User content má NonCommercial licenci](https://polycount.com/discussion/193727/terms-of-service); komerční reuse není potvrzen |
| Reddit gameDevClassifieds | [Character artist](https://www.reddit.com/r/gameDevClassifieds/comments/1kktbal/hiring_3d_character_artist_webcomic_in_development/) a [character modelling/rigging/animation](https://www.reddit.com/r/gameDevClassifieds/comments/1fyhewr/paid_indie_developer_looking_for_3d_character/) | Směšuje HIRING/FOR HIRE; [komerční Data API použití vyžaduje samostatnou dohodu](https://www.redditinc.com/policies/data-api-terms) |

Všech pět Tier A zdrojů nyní splňuje pouze historickou část podmínky. Access review je zdrojově specifický: Upwork vyžaduje schválený API use case, Freelancer písemné povolení pro multi-site agregaci, Reddit samostatnou dohodu pro komerční API použití a Unreal/Polycount zatím nemají povolenou automatizační cestu. Tyto blokace jsou záměrně uložené ve stejném strojovém artefaktu jako evidence.

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
4. benchmark obsahuje nejméně 30 ručně zkontrolovaných kandidátů z daného zdroje; precision se počítá jako `accepted_relevant_hits / reviewed_candidates`, takže se do jmenovatele započítají i nerelevantní výsledky;
5. runtime změna projde samostatnou implementací, testy a schválením.

Dokud všechny podmínky neplatí, `runtime_eligible` musí zůstat `false`. `npm run sources:check` kontroluje úplnost auditu, povolené hodnoty a tento fail-closed kontrakt bez sítě a bez OpenAI. `npm run report:sources:readiness` navíc vytiskne stav evidence, access a yieldu každého Tier A zdroje; také bez sítě a bez OpenAI.

Runtime endpointy navíc načítají stejný kvalifikační artefakt a vracejí `SOURCE_RELEVANCE_LOCKED`, pokud zdroj není způsobilý. Samotné nastavení `RADAR_SOURCE_COLLECTION_ENABLED=true` tedy pojistku relevance neobejde.

## Praktický další krok

Nejrozumnější další fáze není WIDE crawl. Pro veřejně indexované odkazy je připraven oddělený [`INDEX_DISCOVERY_MANUAL_VERIFY`](INDEX_DISCOVERY_MANUAL_VERIFY_CZ.md): hosted web search s pětidoménovým allowlistem, serverovou kontrolou detail URL, nulovým počtem přímých source requestů a povinným ručním otevřením originálu před kontaktem. Tento režim nemění `runtime_eligible:false` a nenahrazuje schválené API ani písemné povolení platformy.

Pro skutečný source adapter je stále nutné získat oprávněnou datovou cestu alespoň pro jeden Tier A zdroj. Teprve nad ní lze sestavit náhodný či chronologický vzorek nejméně 30 kandidátů a ručně změřit source-specific precision. Kurátorované pozitivní historické příklady se do tohoto benchmarku nesmějí vydávat za reprezentativní vzorek.
