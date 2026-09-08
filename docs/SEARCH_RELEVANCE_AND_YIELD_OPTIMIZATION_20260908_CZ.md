# Search relevance + yield optimalizace

**Implementační rozhodnutí · 8. září 2026**

## Naměřený problém

První produkční `WIDE_MAX` běh konzultoval 437 URL, ale vytvořil jen osm
kandidátů a dvě sales položky. Ruční audit potvrdil jedinou skutečně relevantní
aktivní zakázku: opakovaný full-body human photogrammetry cleanup. Šest položek
byly neaktivní nebo zaměstnanecké role a dvě stránky byly obchodní intelligence,
nikoli veřejná objednávka produkce.

Problém proto není limit 100 výsledků. Je jím nízký buyer-intent yield dotazů a
skutečnost, že server dříve připouštěl `EMPLOYER` jako sales record.

## Implementovaná změna

1. `EMPLOYER` se vždy odmítne jako `individual_employment`; slovo `contract`
   uvnitř pracovní nabídky z ní nedělá zakázku pro studio.
2. `studio_eligibility:UNKNOWN` se nepřijímá. Zdroj musí pozitivně doložit, že
   práci může dodat české/evropské externí studio nebo tým.
3. Text originálního zdroje s `no longer available`, `no longer accepting`,
   `applications closed`, `filled` nebo `archived` přebije optimistický modelový
   štítek a položku odmítne.
4. Software/API/automation/pipeline-development brief se odmítne, pokud nekupuje
   skutečné reconstruction, cleanup, Wrap, texture, human capture nebo character
   asset deliverables.
5. Pořadí rozhodování je závazně `ACTIVE SOURCE → BUYER → PRODUCTION DELIVERABLE
   → STUDIO ELIGIBILITY → SCOPE/GEOGRAPHY → SCORE`.
6. Společná normalizace WIDE_MAX už nezahazuje vše za prvním 30. kandidátem a
   nepoužívá starý finální strop 24: vyhodnotí až 150 shard kandidátů a vrátí až
   100 přijatých sales records podle nakonfigurovaného limitu.

## Přerozdělení WIDE_MAX

Pětadvacet requestů a limit 75 hosted calls se nezvyšují. Rozpočet se přesouvá z
employee-heavy ATS a obecných job boardů na:

- buyer project briefs na Upwork/Freelancer/PeoplePerHour/Guru,
- placené testy, recurring batches a production overflow,
- EEN `Business Request` a `Technology Request` detailní stránky,
- CZ/SK heritage procurement,
- stále explicitně otevřené buyer briefy staré 31–90 dnů.

Greenhouse, Lever, Ashby, Workable, SmartRecruiters, Teamtailor, Recruitee,
ArtStation a Hitmarker už ve WIDE_MAX plánovaný rozpočet nespotřebovávají.

## Realistická metrika

Deset nových relevantních zakázek každý den nelze v tomto úzkém veřejném trhu
garantovat. Pro první backfill běh je cílem nejméně 10 aktivních a studio-eligible
zakázek v 90denním okně. Pro každodenní běh je správná metrika počet nových nebo
aktualizovaných aktivních zakázek po deduplikaci; může být přirozeně nižší.

UI nesmí doplňovat kvótu employee rolemi, closed stránkami, seller offers ani
obecným partnerstvím. Pokud kvalitních zakázek není deset, musí zobrazit skutečný
nižší počet a diagnostiku chybějícího pokrytí.

## Chybějící zdrojové vrstvy

1. **Schválený Upwork API use case** — nejvyšší očekávaná výtěžnost a možnost
   chronologického průchodu místo závislosti na webovém indexu.
2. **Marketplace feeds/API nebo písemně povolený sběr** pro Freelancer,
   PeoplePerHour a Guru.
3. **Národní procurement data** pro NEN/VVZ a ÚVO s přesnými českými/slovenskými
   dotazy na 3D digitalizaci sbírkových předmětů.
4. **Buyer requests** z EEN; detailní URL jsou nyní povolené hosted-indexem, ale
   seller `Offer` zůstává competitor intelligence.
5. **Přímé vendor/RFP kanály herních a VFX studií.** Veřejné ATS nejsou jejich
   náhradou; skutečné vendor briefy často žijí v neveřejných supplier sítích a
   vyžadují obchodní registraci či přímý outreach, nikoli širší web search.

Twine byl 8. září veřejně ověřen jako freelance marketplace, ale jeho 3D Model
výpis měl právě nula otevřených položek. Cad Crowd měl 18 3D Modeling rolí, ale
převážně CAD/engineering, onsite a staré nabídky. Contra zpřístupňuje celý job
katalog až po účtu/placeném Pro přístupu. Tyto tři zdroje se proto nyní
nepřidávají do placeného WIDE_MAX plánu jen kvůli počtu domén.

Tato změna sama nic nenasazuje, nemění produkční env a nespouští placený Search.
