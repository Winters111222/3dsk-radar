# Kde má 3D.SK Opportunity Radar hledat skutečné zakázky

**Rozhodovací studie a implementační katalog · 5. září 2026**

Pro vlastníka 3D.SK a implementaci Search backendu. Worldwide B2B zakázky v character production, human capture, scan processing, Wrap, facial/FACS a souvisejících službách.

> **Doporučení:** přejít od jednoho obecného AI vyhledání k ručně spuštěnému, omezenému sběru z konkrétních zdrojů. Nejdřív získat kandidátní odkazy, ověřit originály a směr obchodní poptávky, potom pomocí AI extrahovat a hodnotit. Počet načtených stránek musí být viditelný odděleně od počtu skutečných zakázek.

Tento výstup obsahuje **49 zdrojových záznamů, 54 vstupních URL, 4 návrhy ATS adapterů, 44 vyhledávacích šablon v 9 jazycích a 11 evidenčních příkladů**. Nejde o 49 nasazených crawlerů. Výzkumný katalog zůstává záměrně celý `crawl_enabled: false`; runtime collector registry je oddělený a nyní obsahuje TED + Find a Tender + Contracts Finder za společným default-off gate. Žádný nový placený aplikační Search ani Generate Response nebyl během této analýzy spuštěn. Původní balíček `adjacent_visual` byl podle rozhodnutí vlastníka odstraněn.

> **Pozdější kvalifikační audit zpřísňuje tento katalog:** pouze 5 z 49 zdrojů má doloženou konkrétní historickou buyer nabídku v relevantním scope, 5 dalších je pouze nepřímý signál a žádný zdroj zatím nesplňuje podmínky runtime aktivace. P1/P2 je výzkumné pořadí, nikoli důkaz relevance. Před jakýmkoli WIDE během platí fail-closed pravidla v [auditu historické relevance](SOURCE_HISTORICAL_RELEVANCE_AUDIT_CZ.md).

## 1. Proč dnes uživatel vidí málo — nebo nic

Na dodaném screenshotu je prázdný TEAM ACCESS CODE, stav disconnected a požadavek na připojení. Takový pohled neprokazuje prázdnou serverovou databázi. Vyplnění týmového kódu a **LOAD TEAM STATE** načte uložené výsledky bez placeného vyhledávání. Cloud Browser a osobní prohlížeč mají oddělené session; načtení stránky nemá samo spustit Search.

Samostatný problém je rozsah dnešního Search. Na exact PR #10 head `e57912f1c42544493912120228a15ea4b0d54112` runner sestaví jeden Responses request na pokus, s jedním možným structured retry. Seznam 23 intentů je součástí promptu, nikoli 23 garantovaných rešeršních úloh. Výchozí limit je 12 výsledků a vstup se omezuje nejvýše na 20. Není zde katalog konektorů, kurzor po stránkách zdroje ani evidence povinného pokrytí. To vysvětluje, proč změna jedné fráze nebo zvýšení limitu z 12 na 20 nestačí. [Runner na exact SHA](https://github.com/Winters111222/3dsk-radar/blob/e57912f1c42544493912120228a15ea4b0d54112/src/server/openai-search.mjs), [search contract](https://github.com/Winters111222/3dsk-radar/blob/e57912f1c42544493912120228a15ea4b0d54112/src/server/search-contract.mjs).

**Systémové dokončení UI a persistence není totéž co obchodní kvalita vyhledávání.** Úspěch měřit počtem nových, ověřených, dostupných příležitostí vhodných pro 3D.SK; počet domén je jen vstupní kapacita.

## 2. Kde začít a proč

| Pořadí | Skupina | Co z ní chceme | Počáteční podíl práce — návrh |
|---|---|---|---|
| 1 | Placená odborná fóra a klientské projekty | Konkrétní buyer brief, externí kapacita, scope a možnost reakce | 60 % |
| 2 | Oficiální tendry a skutečné business requests | Poptávka služeb s identitou kupujícího a stavem řízení | 25 % |
| 3 | Oficiální studia, jejich ATS a vendor portály | Doložený signál využívání externí produkce; samostatné potenciální leady | 15 % |

Nejvyšší obsahovou prioritu mají **Polycount Paid Freelance, Unreal Job Offerings a Blender Artists Paid Work**. Jde o přímé autorské nabídky, ale každé téma musí projít filtrem: placené vs revshare, kupující vs prodávající, aktuální vs closed a podmínky země. Kategorie ani `[PAID]` nejsou samy o sobě dostatečný důkaz. [Polycount](https://polycount.com/categories/freelance-job-postings), [Unreal](https://forums.unrealengine.com/c/community/got-skills-looking-for-talent/job-offerings/76), [Blender Artists](https://blenderartists.org/c/jobs/paid-work/53).

**Upwork má výborný obsahový potenciál**, ale vlastní automatický scraper není vhodná integrační cesta. Oficiální pravidla požadují schválení konkrétního API použití a klíč sám nedovoluje libovolný scraping. V katalogu je proto podmíněný API/manuální zdroj, nikoli zapnutý HTML konektor. Mezitím pokračovat veřejně dokumentovanými datovými cestami ostatních zdrojů. [Pravidla automatizace Upwork](https://support.upwork.com/hc/en-us/articles/43342677368467-Use-bots-and-other-automation-properly).

Pro tendry preferovat **TED**, UK OCDS a následně CanadaBuys a určená česká open data. TED nabízí anonymní Search API přímo pro opětovné využití dat. U českého NIPEZ použít určené XML/open data, nikoli reverzně odvozené frontend API. [TED API](https://docs.ted.europa.eu/api/latest/search.html), [GOV.UK Open Contracting](https://www.gov.uk/government/publications/open-contracting), [CanadaBuys dataset](https://open.canada.ca/data/en/dataset/6abd20d4-7a1c-4b38-baa2-9525d0bb2fd2), [NIPEZ strojové rozhraní](https://podpora.nipez.cz/cs/pravidla-pouziti-sluzeb-nipez/latest/pravidla-pro-pouzivani-api-systemu-nipez).

Pracovní portály a studia rozšiřují obzor, ale **nábor zaměstnance není prokázaná objednávka externího týmu**. Outsourcing manager může být silný signál pro budoucí obchod; obyčejná onsite art role je mnohem slabší. Supplier registration, například Sony Pictures, je cesta k registraci, nikoli objednávka. [Příklad role Riot](https://www.riotgames.com/en/work-with-us/job/8003925/senior-art-outsourcing-manager-weapon-concept-valorant-skins-mercer-island-usa), [Sony Pictures Suppliers](https://supplier.sonypictures.com/).

## 3. Konkrétní důkazy, které musí změnit extrakci

| Ověřený příklad | Co lze říci | Co se nesmí automaticky tvrdit |
|---|---|---|
| [Upwork — full-body scan cleanup](https://www.upwork.com/freelance-jobs/apply/Scan-Cleanup-Full-Body-Human-Photogrammetry-Ongoing_~022093482015133487827/) | Poptávka čištění lidských skenů, opakované dávky 20–50, otázka na týmovou kapacitu, $12–30/h. Obsahově velmi dobrý match, sazba může být nízká. | Firma není veřejně identifikována; žádný domyšlený email. Datum 28. 8. je založení klientského účtu; publikace je jen relativní „Posted last week“. Před reakcí znovu ověřit přijímání nabídek. |
| [Unreal — MetaHuman assembly](https://forums.unrealengine.com/t/paid-metahuman-expert-needed-for-character-assembly-and-wardrobe-setup/2734270) | Původní zadavatel 8. 7. 2026 žádá placené sestavení a opravy wardrobe/materials; budget není uveden. | Červencový post bez čerstvého potvrzení není automaticky stále otevřený. Kontakt z odpovědi dodavatele nepatří zadavateli. |
| [Polycount — stylized characters](https://polycount.com/discussion/239037/paid-freelance-stylized-game-artist-s-characters-animation-environment-art) | Placený projekt ze srpna 2026. | USA-only podmínka jej činí pro český tým pravděpodobně nepoužitelným; vysoký character fit nesmí přebít eligibility. |
| [Unfold Games — humanoid animator](https://remotegamejobs.com/jobs/unfold-games-3d-character-animator-humanoid-animation-remote-job) | Relevantní contract recruitment; přijetí studia není doloženo. | $55–70/h v Related Jobs patří jiné firmě. Budget této nabídky zůstává UNKNOWN. |
| [Freelancer — realistic Unity character](https://www.freelancer.com/projects/unity/unity-realistic-character-animation) | Model, rig a animace odpovídají části pipeline. | Average bid $114 není publikovaný rozpočet zadavatele. |
| [GeBIZ — NHB 3D/media panel](https://www.gebiz.gov.sg/ptn/opportunity/opportunityDetails.xhtml?OPPORTUNITY_ID=1000000000000523257&code=NHB000ETT26000003&origin=rss&status=RELEASED&type=TT) | Skutečný institucionální kupující 3D služeb. | CLOSED 4. 5. 2026 / PENDING AWARD. Parametr RELEASED v URL není aktuální stav. Omezení reuse vyžaduje vyřešení před hromadným ingestem. |
| [EEN — engineering SME offers scanning](https://een.ec.europa.eu/partnering-opportunities/polish-engineering-sme-offers-reverse-engineering-metrology-grade-3d) | Dodavatel nabízí vlastní služby. | Slovo outsourcing agreement z něj neudělá kupujícího. |

Další negativní příklady v evidenčním souboru: closed role Kindred z roku 2024, historické 3D modely lokalit UNDP a nákup scanneru PCS. Nejsou vloženy do produkčních výsledků a nejsou vydávány za úspěšně provedené testy klasifikátoru.

## 4. Rozsah jednoho běhu

Následující čísla jsou **návrhové stropy**, ne naměřená výtěžnost ani aktivní konfigurace. Použitelné zdroje se vybírají jen z implementovaných a přístupově schválených adapterů; čekající zdroje nesmí nafouknout vykázané pokrytí.

| Limit | Focused | Wide — doporučený cílový režim |
|---|---:|---:|
| Zdrojové služby | až 15 | až 45 |
| Načtené seznamové stránky/API stránky | až 40 | až 140 |
| Načtené originální detaily | až 80 | až 360 |
| Celkem stránky | až 120 | až 500 |
| Kandidáti posouzení AI | až 45 | až 180 |
| Hosted web-search volání | nejvýše 12 | nejvýše 40 |
| Navrhovaný AI rozpočtový strop | $0.50 | $1.00 |

AI zpracovávat v dávkách po 15 kandidátech. Omezit náklady a načtení, nikoli svévolně zahodit všechny relevantní výsledky nad 12. Výstup rozdělit na **ověřené otevřené poptávky**, **potenciální kupující** a **partnerské/hiring signály**; počet každé skupiny ukazovat samostatně. Desítky až stovky kandidátů jsou realistický kapacitní cíl implementace. **Desítky nových kvalitních B2B zakázek na každý běh zatím doložené nejsou.** Při častém opakování budou nové výsledky přirozeně ubývat kvůli dedupe.

Cenu v návrhu nepřevádět na slib faktury. Při implementaci použít aktuálně ověřený pricing snapshot a existující `EST. COST`, sčítat všechny pokusy i neúspěšné extrakce. Počet web-search calls není počet navštívených stránek. Před každým placeným krokem rezervovat konzervativní horní odhad vstupu, maximálního výstupu i povolených tool calls; částky už spotřebované a rezervované společně nesmí překročit schválený limit. Neznámé ceny musí blokovat další paid krok. Hosting, případné licencované zdroje a daně nejsou součástí AI odhadu.

## 5. Jednoduchá technická cesta

1. **Explicitní start uživatelem.** Autentizovaný start vytvoří `run_id`, neměnný snapshot katalogu, query plánu, rozsahu a budgetu. Žádný plánovač nočních placených runů.
2. **Sběr přes vhodnou cestu zdroje.** Oficiální API/feed tam, kde je doložen; veřejné HTML až po kontrole pravidel a zvoleného adapteru. Index discovery je samostatný způsob nalezení URL, nikoli důkaz kompletního crawlu domény. Nezkoušet obcházet login, CAPTCHA nebo nepovolené API.
3. **Levné předzpracování bez modelu.** Oddělit hlavní brief od navigace, Related Jobs a odpovědí prodejců. Uložit source item ID, canonical URL, skutečné datum a změnu obsahu. Filtrovat evidentní closed/hardware/BIM/seller data, ne však slepě podle jediného slova.
4. **Ověření a AI extrakce.** Pro každý přijatý kandidát uložit přesné podklady k roli kupujícího, scope, dostupnosti, ceně a kontaktu. Hodnotit source content jako data, nikoli jako instrukce. Není-li originál přístupný, zobrazit důvod; nevydávat snippet za ověření.
5. **Merge do existujícího workspace.** Zachovat company bookmark, status, outreach history a recent-outreach warning. Převzít stávající provenance a server-owned TO. Každá nabídka má více source referencí, ale jednu identitu.
6. **Průběžný pokrok a dokončení.** Browser čte stav runu a přijaté výsledky; refresh pokračuje ve čtení a nikdy nespouští nový paid run. Cancel zastaví další kroky, už dokončené zachová.

Na stovky stránek se nehodí jeden synchronní request s dnešním 52sekundovým timeoutem OpenAI volání. Pro explicitně spuštěnou úlohu lze po ověření dostupnosti na konkrétním Netlify plánu použít Background Function; dokumentace uvádí 202 a limit 15 minut. Opakované invokace mohou retryovat, proto **idempotence a rozpočtové rezervace musí předcházet placeným krokům**. Alternativa s menším zásahem jsou krátké pokračovací chunky stejného runu; i ty potřebují trvalý stav, lease a ochranu proti dvojímu zpracování. Netlify Blobs ponechat, dokud se neprokáže jiná potřeba. [Aktuální Netlify dokumentace](https://docs.netlify.com/build/functions/background-functions/).

Návrh není autonomní obchodní agent ani nový CRM. Jde o spolehlivé provedení uživatelem vyžádaného Search. Při výpadku po odeslání AI requestu a před uložením výsledku musí stav přejít do explicitního `UNCERTAIN`, ne automaticky znovu utrácet. Operace se stejným `run_id/chunk_id` nesmí bez kontroly zopakovat paid request.

## 6. Co doplnit do dat a UI

| Pole / počítadlo | Význam |
|---|---|
| `commercial_role` | BUYER / EMPLOYER / SELLER / PARTNER / UNKNOWN s důkazem |
| `notice_status` | OPEN / UPCOMING / CLOSED / AWARDED / CANCELLED / UNKNOWN |
| `studio_eligibility` | YES / NO / UNKNOWN; země, onsite, individuální role, vendor přístup |
| `published_at`, `source_updated_at`, `acceptance_verified_at` | Tři různé časové skutečnosti; `last_seen` je nenahrazuje |
| `source_id`, `source_item_id`, `source_revision`, `lot_id` | Dedupe původu a verzí |
| `budget_scope` | Konkrétní služba/lot vs framework ceiling, grant, salary, seller price, equipment |
| `sources_planned/completed/blocked/failed` | Pokrytí zdrojů; index-only uvádět zvlášť |
| `list_pages_fetched/detail_pages_fetched` | Skutečně načtené stránky, nikoli počet tool calls |
| `candidates_seen/rejected/verified` | Odmítací důvody: closed, seller, duplicate, ineligible, source unavailable… |
| `new_opportunities/updated_opportunities/workspace_total` | Nové nálezy, změny a celková historie jsou oddělené |

Teprve ověřená aktuální kupující poptávka může být `OPEN_OPPORTUNITY`. `UNKNOWN` dostupnost nelze změnit na OPEN kvůli vysokému FIT. `POTENTIAL_LEAD` může být doložený budoucí kupující, ale čisté portfolio prodávajícího nemá plnit obchodní seznam. Partner signály musí mít jasný štítek a nepřispívat do počtu otevřených zakázek.

Dedupe: canonical detail URL + native source ID; syndikované job boards spojit podle employer requisition. U tendrů issuer/reference/lot/revision, ne jen název. Nová revision aktualizuje existující příležitost. Company identita má vycházet z doložené domény/jména; anonymní klienti z jedné platformy nejsou jedna společná firma.

Pro empty state doporučuji rozlišit **nepřipojeno**, **historie skutečně prázdná**, **běh probíhá**, **zdroje nedostupné**, **filtr skryl výsledky** a **nalezeno 0 vyhovujících**. Tím zmizí současná nejasnost „nic nevidím“ bez automatického spuštění placené akce.

## 7. Jazyky, stáří a rotace

Query soubor obsahuje 28 anglických šablon a 16 doplňkových v češtině, němčině, francouzštině, španělštině, italštině, polštině, portugalštině a japonštině. Jsou to **návrhy neotestované na plošné výtěžnosti**, nikoli záruka devítijazyčného pokrytí. Vybrat kombinace podle zdroje, ne spustit kartézský součin všech slov, webů a jazyků.

Core: human/body/face scan, cleanup, retopology, Wrap/basemesh, digital double, realistic character, facial/FACS. Druhá vlna: rigging, character animation v rámci character production a external art/overflow. Samostatné Photoshop / generative-AI visual / motion-design / After Effects / medical-animation / immersive-museum příležitosti jsou ze Search vyloučené. Procurement vyžaduje službu, ne nákup scanneru ani GIS mapování.

Časová okna 24 hodin → 7 dnů → 30 dnů; starší jen s novým důkazem dostupnosti. `refresh_after_hours` v katalogu je návrh stáří cache pro další **ruční** run, ne zapnutý scheduler. Rotovat méně výnosné P2/P3 zdroje, preferovat nové/změněné položky podle kurzoru a obsahu. Rozšiřování nesmí opakovaně vykazovat stejné staré nabídky jako nové.

## 8. Pořadí implementace a acceptance

**A — datová pravdivost a měření — IMPLEMENTOVÁNO NA NAVAZUJÍCÍ REVIEW BRANCHI.** Doplněny role/status/eligibility/scope/freshness a oddělené counters. Všech 11 evidenčních příkladů je pokryto sanitizovaným fixture/mock testem; budget/contact gates zůstávají. Implementace je fail-closed pro seller, inactive, studio-ineligible, out-of-scope a neověřeně staré položky. Dokud navazující PR není sloučený a nasazený, nejde o produkční funkci.

**B — první funkční sběr — HOTOVO, 100 %.** TED, UK Find a Tender a Contracts Finder read adaptery, samostatný autentizovaný endpoint, pevné query packs, 30denní filtry, caps/cooldown/timeout, cursor boundary, parsers, counters a offline mock acceptance jsou implementované za `RADAR_SOURCE_COLLECTION_ENABLED=false`. Bounded live měření má hard cap 6 requestů, žádné retry, AI ani persistence. Diagnostika odstranila holé `FACS` a obecnou photogrammetry frázi poté, co vracely 25 irelevantních TED notices. Finální post-fix vzorek vrátil 0 relevantních records; skutečnou širokou výtěžnost proto musí změřit Phase C stránkováním a klasifikací, ne marketingovým příslibem. Access review Polycount/Unreal/Blender je dokončený a všechny tři zdroje zůstávají explicitně `BLOCKED_ACCESS_REVIEW`. CanadaBuys zůstává odložený jako bulk dataset bez potvrzeného stránkovaného API contractu. Stav popisují [Phase B](PHASE_B_SOURCE_COLLECTION_CZ.md), [yield measurement](PHASE_B_YIELD_MEASUREMENT_CZ.md) a [access review](PHASE_B_ACCESS_REVIEW_CZ.md).

**C — široký run — PŘIBLIŽNĚ 80 %.** Implementovaný je autentizovaný multi-source run state, immutable plán, cursory/chunky, průběžné oddělené ukládání kandidátů, retry/idempotency contract, cancel, cross-source/tender-revision dedupe, hard profily, cost reservation ledger a responzivní one-click operator UI s progress/resume/cancel. Offline acceptance nabízí 501 stran / 215 kandidátů a prokáže hard stop na 500 / 180; samostatné testy kryjí 403/429/timeout, přerušení bez redispatch a browser transient retry se stejným operation ID. `paid_execution` je zamčené: Netlify Blobs contract nemá atomický compare-and-swap, takže před placenou cestou zbývá coordinator, detailní enrichment a Phase A promotion. Podrobnosti: [Phase C run engine](PHASE_C_RUN_ENGINE_CZ.md).

**D — zero-cost deployed acceptance a teprve následně controlled live měření.** Nejdřív fixture transport oddělený od produkčních dat. Ověřit source counters, původ výsledků, historii, autentizaci a LOCKED gate. Rozšířený placený experiment musí mít předem odsouhlasený rozsah a budget; žádné placené dotazy nebyly tímto výzkumem spuštěny.

Navržené kvalitativní brány: všechny OPEN mají dostupný originál a podporu stavu; žádný známý seller/closed/geo-ineligible se nevydává za otevřenou zakázku; všechny ceny a kontakty mají správný původ. V ručně posouzeném vzorku nejméně 30 přijatých nálezů cílit na ≥80 % skutečně relevantních položek. Pokud je nálezů méně, vyhodnotit všechny a přiznat malý vzorek. Je to **budoucí acceptance cíl, ne dosažená metrika**.

## 9. Limity a otevřené otázky

- Výzkum ověřuje zdroje a příklady k 5. 9. 2026. Nezměřil recall celého internetu, skutečnou výtěžnost 500stránkového běhu ani objem denních nových B2B poptávek.
- Pokrytí je nejsilnější pro anglické komunity a evropské/severoamerické instituce. UN/World Bank a globální platformy přidávají mezinárodní dosah, ale lokální Asie, Latinská Amerika, Afrika a MENA nejsou tímto katalogem vyčerpány. Další expanzi řídit naměřenou výtěžností a jazyky, ne přidáváním neověřených domén.
- HTML načtené výzkumným nástrojem není ověřený produkční HTTP adapter ani schválení automatizace. FTS docs byly částečně blokované; některé studio stránky nečitelné. Stav je zachován v katalogu.
- Firemní veřejná kariéra obvykle neodhalí neveřejné vendor RFP. Vysoké počty skutečně otevřených AAA outsourcing briefů proto nelze garantovat. Lead generation a otevřené poptávky musí zůstat rozlišeny.
- Nejistota SmartRecruiters auth/public rozsahu je zachována. Aktuální dokumentace zmiňuje i interní postings; nepoužívat interní scope ani netvrdit anonymní veřejný přístup bez ověření. [Oficiální Posting API](https://developers.smartrecruiters.com/docs/posting-api).

Výzkum skončil po cíleném ověření komunit, procurement, employer zdrojů a relevantních API. Zásadní tvrzení byla kontrolována na originálech včetně vyvrácení domnělého publikačního data Upwork. Další přínos teď přinese implementovaný konektor a měření výtěžnosti více než další seznam podobných webů.

## 10. Kompletní katalog a stav napojení

**Čtení tabulek:** P1 = první implementační vlna, P2 = rozšíření, P3 = nízká priorita/podmíněný zdroj. „HTML“ znamená výzkumně přečtený obsah, „dokumentace“ ověřenou datovou cestu bez runtime testu, „index“ pouze discovery. Žádný řádek neznamená nasazený crawler. P1 označuje prioritu, nikoli prokázaný objem zakázek.

### Přímé poptávky — 10 zdrojů

| Zdroj / priorita | Přístup a návrh | Praktické omezení |
|---|---|---|
| [Polycount — paid freelance](https://polycount.com/categories/freelance-job-postings) · P1 | RSS dostupné; `BLOCKED_ACCESS_REVIEW` | Feed je first-party a robots jej nezakazuje, ale Terms nepotvrzují komerční automatizovaný ingest user content. Bez výslovného povolení nezapínat. |
| [Unreal — Job Offerings](https://forums.unrealengine.com/c/community/got-skills-looking-for-talent/job-offerings/76) · P1 | RSS dostupné; `BLOCKED_ACCESS_REVIEW` | Publikované robots zakazuje `/c/*.rss`. Žádný HTML fallback. MetaHuman/character obsah navíc vyžaduje buyer/seller/revshare filtr. |
| [Blender Artists — Paid Work](https://blenderartists.org/c/jobs/paid-work/53) · P1 | RSS dostupné; `BLOCKED_ACCESS_REVIEW` | Publikované robots zakazuje `/c/*.rss` a blokuje GPTBot/ChatGPT-User. Žádný HTML fallback. |
| [Upwork — human scanning / photogrammetry](https://www.upwork.com/freelance-jobs/photogrammetry/) · P1 | HTML; `APPROVED_API_OR_MANUAL` | Velmi relevantní opakované human scan cleanup zakázky. Jen schválený konkrétní API use case; žádný automatický HTML scraper. Public read neprokazuje oprávnění automatizace. [Evidence 1](https://www.upwork.com/freelance-jobs/photogrammetry/), [Evidence 2](https://support.upwork.com/hc/en-us/articles/43342677368467-Use-bots-and-other-automation-properly). |
| [Freelancer — 3D Modelling](https://www.freelancer.com/jobs/3d-modelling/) · P2 | HTML; `APPROVED_API_OR_INDEX` | Projektové briefy; Average bid není buyer budget. Detail může být nedostupný; API/podmínky ověřit před adapterem. |
| [PeoplePerHour — 3D Design](https://www.peopleperhour.com/freelance-jobs/design/3d-design) · P2 | HTML; `HTML_AFTER_REVIEW` | Veřejné briefy a budgety; kontrolovat deadline. /hourlie jsou prodávané služby, nikoli poptávky. |
| [Guru — 3D Modeling / Design & Art](https://www.guru.com/m/find/freelance-jobs/3d-modeling/) · P2 | HTML; `HTML_AFTER_REVIEW` | Projektové zakázky, anatomy/animation adjunct. /hire/freelancers/ je seller katalog. |
| [Behance Jobs](https://www.behance.net/joblist/) · P2 | Částečný přístup; `INDEX_OR_MANUAL` | Freelance briefy i nábor; aplikace a některé detaily za Pro. Bez identity zadavatele nepřisuzovat firmu ani email. |
| [Reddit — gameDevClassifieds](https://www.reddit.com/r/gameDevClassifieds/) · P2 | Index; `APPROVED_API_OR_INDEX` | Silný mix HIRING / FOR HIRE. Flair může odporovat textu. API/licence a limity zatím neověřeny; žádný browser scraper. |
| [Contra Opportunities](https://contra.com/opportunities) · P3 | Neověřený obsah; `INDEX_OR_MANUAL` | Žádný čitelný list při direct open; marketing landing page není důkaz živého feedu. /hire/ obsahuje dodavatele. |

### Veřejné tendry — 16 zdrojů

| Zdroj / priorita | Přístup a návrh | Praktické omezení |
|---|---|---|
| [TED — EU tenders](https://ted.europa.eu/) · P1 | Dokumentace; `PUBLIC_API` | Anonymní Search API pro reuse; notice type, lot, latest revision a deadline. CPV samo nestačí. [Evidence 1](https://docs.ted.europa.eu/api/latest/search.html). |
| [Find a Tender](https://www.find-tender.service.gov.uk/) · P1 | Dokumentace + canary; `OCDS_API_IMPLEMENTED` | Read-only OCDS release adapter implementován s updated window, `stages=tender`, capem 50, validovaným cursorem a lokálními active/deadline/scope filtry. Produkční canary HTTP 200 / 1 release. [Evidence 1](https://www.gov.uk/government/publications/open-contracting), [Evidence 2](https://www.find-tender.service.gov.uk/Developer/Documentation). |
| [Contracts Finder](https://www.contractsfinder.service.gov.uk/) · P1 | Dokumentace + canary; `OCDS_API_IMPLEMENTED` | Veřejný OCDS Search adapter implementován s published window, `stages=tender`, capem 50, validovaným cursorem, first-party notice provenance a lokálními filtry. Canary HTTP 200 / 1 release. Překryv s FTS později deduplikovat podle procurement identity. [Evidence 1](https://www.contractsfinder.service.gov.uk/apidocumentation/Notices/1/GET-Published-Notice-OCDS-Search). |
| [SAM.gov Contract Opportunities](https://sam.gov/) · P2 | Dokumentace; `KEYED_PUBLIC_API` | SAM API key nutný; role-specific limity. postedFrom/To interval nejvýše rok, page limit 1000. active:Yes může být i award. [Evidence 1](https://open.gsa.gov/api/get-opportunities-public-api/). |
| [CanadaBuys](https://canadabuys.canada.ca/en/tender-opportunities) · P1 | Dokumentace; `DEFERRED_BULK_DATASET` | Oficiální CSV datasety a jejich refresh jsou potvrzené, ale ne stránkované search API kompatibilní s malým runtime contractem. Nepoužívat HTML ani odvozený frontend endpoint; případný adapter musí mít byte/row cap a deadline filtr. [Evidence 1](https://open.canada.ca/data/en/dataset/6abd20d4-7a1c-4b38-baa2-9525d0bb2fd2), [Evidence 2](https://canadabuys.canada.ca/en/procurement-and-contracting-data), [rozhodnutí](PHASE_B_YIELD_MEASUREMENT_CZ.md). |
| [AusTender — Approaches to Market](https://www.tenders.gov.au/atm) · P2 | Index; `HTML_OR_FEED_AFTER_REVIEW` | Hledat current ATM. Contract Notice OCDS award data nejsou feed otevřených poptávek. RSS pending. [Evidence 1](https://www.finance.gov.au/government/procurement), [Evidence 2](https://www.tenders.gov.au/). |
| [UN Global Marketplace](https://www.ungm.org/public/notice) · P1 | HTML; `INDEX_OR_HTML_AFTER_REVIEW` | UN notices; prázdná JS šablona není 0 zakázek. RFQ/RFP/EOI detail. Registrace URL s 3D%3D nesmí spustit keyword match. |
| [UNDP Procurement Notices](https://procurement-notices.undp.org/) · P2 | Index; `INDEX_OR_HTML_AFTER_REVIEW` | Notice → Quantum, dedupe UNGM agency/ref/lot/revision. Žádné automatické účty. [Evidence 1](https://www.ungm.org/Public/Notice/224847). |
| [NEN — designated XML](https://nen.nipez.cz/verejne-zakazky) · P1 | Dokumentace; `DESIGNATED_XML` | Frontend API nelze používat jako crawler. NEN XML profilu zadavatele je určená strojová cesta; konkrétní endpoint pending. [Evidence 1](https://podpora.nipez.cz/cs/pravidla-pouziti-sluzeb-nipez/latest/pravidla-pro-pouzivani-api-systemu-nipez). |
| [ISVZ open data / VVZ](https://isvz.nipez.cz/opendata) · P1 | Dokumentace; `OPEN_DATA` | Jedna česká datová větev, VVZ detail jako provenance. Přesný dataset ověřit; NEN/VVZ/TED mohou být stejná zakázka. [Evidence 1](https://podpora.nipez.cz/cs/pravidla-pouziti-sluzeb-nipez/latest/pravidla-pro-pouzivani-api-systemu-nipez). |
| [GETS New Zealand](https://www.gets.govt.nz/ExternalIndex.htm) · P2 | HTML; `PUBLIC_FEED_PENDING` | Homepage nabízí RSS/Atom; konkrétní feed URL ověřit. Registrace pro další dokumenty/odpověď. Future/closed oddělit. [Evidence 1](https://www.gets.govt.nz/). |
| [GeBIZ Singapore](https://www.gebiz.gov.sg/) · P2 | HTML; `MANUAL_PERMISSION_PENDING` | Relevantní 3D služby existují, ale notice omezuje reuse/republication na přípravu bids. Žádný automaticky enabled ingest. [Evidence 1](https://www.gebiz.gov.sg/ptn/opportunity/opportunityDetails.xhtml?OPPORTUNITY_ID=1000000000000523257&code=NHB000ETT26000003&origin=rss&status=RELEASED&type=TT). |
| [Public Contracts Scotland](https://www.publiccontractsscotland.gov.uk/) · P2 | HTML; `INDEX_OR_HTML_AFTER_REVIEW` | Scan-to-BIM a scanner equipment jsou časté false positives. Pouze relevantní service deliverables a current status. [Evidence 1](https://www.publiccontractsscotland.gov.uk/search/show/search_view.aspx?ID=AUG486557). |
| [eTenders Ireland](https://www.etenders.gov.ie/) · P2 | HTML; `INDEX_OR_HTML_AFTER_REVIEW` | Public CfT search, JS/response login. Dedupe TED překryv. |
| [World Bank procurement notices](https://projects.worldbank.org/en/projects-operations/procurement) · P2 | Dokumentace; `PUBLIC_API_PENDING` | Oficiální dataset uvádí search.worldbank.org/api/procnotices přes HTTP; ověřit HTTPS a schema před použitím. Vysoký GIS noise. [Evidence 1](https://financesone.worldbank.org/procurement-notice/DS00979), [Evidence 2](https://financesone.worldbank.org/procurement-notices-kenya/DS01594). |
| [EBRD / ECEPP](https://ecepp.ebrd.com/delta/noticeSearchResults.html) · P3 | Index; `INDEX_OR_HTML_AFTER_REVIEW` | Doplňkové consultancy/digitisation; nízký core character fit. Část notices jen na EBRD; účast login. [Evidence 1](https://www.ebrd.com/home/work-with-us/project-procurement/procurement-notices.html). |

### Hiring a studio signály — 16 zdrojů

| Zdroj / priorita | Přístup a návrh | Praktické omezení |
|---|---|---|
| [Work With Indies](https://workwithindies.com/) · P1 | HTML; `HTML_AFTER_REVIEW` | Art/animation, contract/freelance. Individuální pracovní smlouva není automaticky zakázka pro studio. Ověřit CLOSED a původní datum. |
| [Remote Game Jobs — Contract / Art](https://remotegamejobs.com/remote-contract-game-jobs) · P1 | HTML; `HTML_AFTER_REVIEW` | Worldwide contract příležitosti; studio eligibility musí potvrdit brief. Related Jobs nesmí dodat cenu ani kontakt k hlavní nabídce. |
| [Hitmarker](https://hitmarker.net/) · P2 | HTML; `INDEX_TO_EMPLOYER` | Dohledat původní employer source; fixed-term contract může být zaměstnání. Dedupe employer requisition ID. |
| [Games Jobs Direct](https://www.gamesjobsdirect.com/) · P2 | Index; `INDEX_TO_EMPLOYER` | Konkrétní detaily nalezeny indexem, homepage načtení selhalo. Provozní crawl není potvrzen. [Evidence 1](https://www.gamesjobsdirect.com/job/keywords-studios/technical-artist-d3t-12-month-contract/355728). |
| [ArtStation Jobs](https://www.artstation.com/jobs) · P2 | Částečný přístup; `INDEX_TO_EMPLOYER` | Indexované role; přímá stránka převážně signup shell. Portfolia nejsou buyer nabídky. Žádné obcházení přístupu. |
| [GameJobs.co](https://gamejobs.co/search?w=REMOTE) · P2 | HTML; `INDEX_TO_EMPLOYER` | Agregované kariérní role; následovat originál a odstranit duplicitní syndikace. |
| [VFXengine Jobs](https://www.vfxengine.com/jobs) · P2 | HTML; `INDEX_TO_EMPLOYER` | VFX/animation hiring; vendor poptávka potřebuje důkaz navíc. Tvrzení updated daily není ověřená latence dat. |
| [Global animation jobs sheet](https://docs.google.com/spreadsheets/d/1eR2oAXOuflr8CZeGoz3JTrsgNj3KuefbdXJOmNtjEVM/edit) · P2 | HTML; `FEED_PERMISSION_PENDING` | Studio discovery a source odkazy; remote/hybrid nejisté podle tabulky. Export/API a reuse práva pending, vždy ověřit originál. |
| [Riot Games](https://www.riotgames.com/en/work-with-us/jobs) · P2 | HTML; `EMPLOYER_HTML_OR_ATS_AFTER_REVIEW` | Externí art production / outsourcing management signály existují; mzda zaměstnance není project budget. |
| [Ubisoft](https://www.ubisoft.com/en-us/company/careers/locations) · P2 | HTML; `EMPLOYER_HTML_OR_ATS_AFTER_REVIEW` | Oficiální seznam studií; follow Open Positions a skutečnou ATS adresu, token nehádáme. |
| [Remedy Entertainment](https://www.remedygames.com/careers) · P2 | HTML; `EMPLOYER_HTML_OR_ATS_AFTER_REVIEW` | Realistic game production hiring; externí studio musí mít konkrétní buying signal, ne pouze volnou pozici. |
| [Framestore](https://www.framestore.com/careers) · P2 | HTML; `EMPLOYER_HTML_OR_ATS_AFTER_REVIEW` | Oficiální careers odkazuje framestore.recruitee.com. VFX zaměstnání není potvrzený outsourcing. |
| [DNEG](https://www.dneg.com/join-us) · P2 | HTML; `EMPLOYER_HTML_OR_ATS_AFTER_REVIEW` | VFX career discovery. Dodavatelská firma může sama hledat práci; overflow nákup vyžaduje důkaz. |
| [Wētā FX](https://careers.wetafx.co.nz) · P2 | HTML; `EMPLOYER_HTML_OR_ATS_AFTER_REVIEW` | Oficiální kariéra, i onsite expressions of interest. Dostupnost českého externího týmu nelze předpokládat. |
| [Naughty Dog](https://www.naughtydog.com/careers) · P2 | HTML; `EMPLOYER_HTML_OR_ATS_AFTER_REVIEW` | Oficiální art/3D role; follow employer detail, dedupe ATS ID. Pouze hiring signal bez B2B briefu. |
| [Guerrilla](https://www.guerrilla-games.com/join) · P2 | HTML; `EMPLOYER_HTML_OR_ATS_AFTER_REVIEW` | Oficiální studio career source; outsourcing eligibility a employer detail pending. |

### Partnerství a supplier přístup — 3 zdroje

| Zdroj / priorita | Přístup a návrh | Praktické omezení |
|---|---|---|
| [Enterprise Europe Network — requests](https://een.ec.europa.eu/partnering-opportunities) · P1 | HTML; `HTML_AFTER_REVIEW` | Prioritně Business Request / Technology Request; offer může být konkurent hledající zákazníky. R&D zvlášť. Anonymní firmu nepojmenovávat. |
| [EU Funding & Tenders — partner search](https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/how-to-participate/partner-search) · P3 | Index; `INDEX_OR_MANUAL` | Konsorcia/R&D, nikoli automaticky placená zakázka. Grantový budget není vendor budget. |
| [Sony Pictures — supplier information](https://supplier.sonypictures.com/) · P2 | HTML; `SUPPLIER_PORTAL_MANUAL` | Ověřená cesta pro prospective suppliers; registrace dodavatele není zveřejněná objednávka. Nepodávat přihlášku automaticky. |

### Nyní nezařazovat do aktivního pokrytí — 4 zdroje

| Zdroj / priorita | Přístup a návrh | Praktické omezení |
|---|---|---|
| [EA Careers](https://jobs.ea.com/en_US/careers) · P3 | Neověřený obsah; `DISABLED` | Direct open selhal; aktuální vstup/redirect ověřit před zařazením do coverage. |
| [Rockstar Careers](https://www.rockstargames.com/careers) · P3 | Neověřený obsah; `DISABLED` | Při načtení 0 řádků; JS/index přístup pending, ne potvrzený crawler. |
| [Bungie Careers](https://www.bungie.net/7/en/careers) · P3 | Neověřený obsah; `DISABLED` | Direct open selhal. Záznam je čekající kandidát zdroje, nikoli ověřená datová integrace. |
| [CreativeHeads](https://www.creativeheads.net/) · P3 | Nedostupný board; `DISABLED` | Under Reconstruction / We are rebuilding. Nepočítat jako aktivní job databázi. |


## 11. Strojově čitelné podklady

- [Katalog zdrojů](../config/opportunity-sources.v1.json): stabilní ID, vstupní URL, typ, region, jazyk, priorita, metoda, přístup, omezení a evidence. Obsahuje také 4 ATS šablony; ty se nepočítají jako další zdroje.
- [Query packs a návrh limitů](../config/search-query-packs.v1.json): 7 tematických balíčků, jazykové varianty, Focused/Wide.
- [Evidenční příklady](../config/source-evidence-cases.v1.json): 11 veřejných příkladů pro budoucí acceptance. Specifikace očekávaného chování, nikoli hotový klasifikátor.
- [Historická kvalifikace zdrojů](../config/source-historical-qualification.v1.json): všech 49 zdrojů přesně jednou, Tier A/B/C/DISABLED, pozitivní důkazy a fail-closed runtime rozhodnutí.
- `npm run report:sources:readiness`: offline přehled tří samostatných bran Tier A — historické evidence, povoleného přístupu a source-specific yieldu. Precision vyžaduje nejméně 30 ručně zkontrolovaných kandidátů na zdroj; kurátorované pozitivní příklady nejsou benchmark.
- `npm run sources:check`: offline kontrola integrity katalogu. Nevolá internet ani OpenAI.

Tento PR přidává výzkum, data a jejich offline validační CI krok. **Nemění runtime Search, neaktivuje nové zdroje, nemění produkční Netlify env, nic nemerguje a neposílá email.** Následující implementace má být menší navazující PR podle kroků A–D, ne neověřená přestavba v jednom deployi.
