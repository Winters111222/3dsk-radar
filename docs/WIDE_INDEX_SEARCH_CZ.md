# Worldwide WIDE_INDEX Search

**Implementační kontrakt · 6. září 2026**

## Výsledek

`WIDE_INDEX` odstraňuje hlavní slabinu původního placeného Search: jeden obecný modelový request už nemůže libovolně přeskočit celé třídy zdrojů. Server vždy odešle právě pět paralelních Responses requestů, každý s povinným hosted web search a vlastním allowlistem:

1. přímé marketplaces,
2. 3D/game komunity,
3. contract portály a veřejné ATS,
4. veřejné tendry,
5. vícejazyčný worldwide sweep.

Výsledky se normalizují společně, projdou stávajícími truth/freshness/buyer/scope/budget/contact pravidly, odduplikují se a až potom se uloží do Netlify Blobs. UI ukazuje stav každého okruhu, počet konzultovaných URL, web-search calls a počet povolených domén. Selhání jednoho okruhu vede k viditelnému `PARTIAL`; selhání všech okruhů neuloží žádný výsledek.

## Tvrdé hranice

| Hranice | `FOCUSED` | `WIDE_INDEX` |
|---|---:|---:|
| OpenAI Responses requests | 1 | přesně 5 |
| Hosted web-search calls | nejvýše 3 | nejvýše 15 (3 na okruh) |
| Výstup | nejvýše 6 | přesně konfigurovaný strop 24 |
| Rozpočtová rezervace | přesně 0,50 USD | přesně 2,00 USD |
| Retry | 0 | 0 |
| Přímé HTTP crawl requesty | 0 | 0 |
| Frekvence | 1 run za UTC den | 1 run za UTC den |

Profil je server-owned. Klient jej nemůže změnit requestem. Chybějící `RADAR_PRODUCTION_SEARCH_PROFILE` znamená `FOCUSED`, takže samotné sloučení kódu nemění běžící produkci. `WIDE_INDEX` je připraven teprve při přesné trojici:

```text
RADAR_PRODUCTION_SEARCH_PROFILE=WIDE_INDEX
RADAR_PRODUCTION_SEARCH_MAX_USD=2.00
RADAR_PRODUCTION_SEARCH_MAX_RESULTS=24
```

Jiná kombinace se uzamkne jako `CONFIG_BLOCKED`.

FOCUSED a WIDE_INDEX používají rozdílné denní `run_id`, `operation_id` i
`reservation_id`. Již dokončený FOCUSED běh proto nemůže změnit budget cap ani
zablokovat první WIDE_INDEX běh ve stejném UTC dni; oba profily přitom zůstávají
samostatně omezené na jeden koordinovaný běh za den.

## Pokrytí

Runtime přijímá jen konkrétní veřejné detail URL z 30 serverových politik. Patří sem Upwork, Freelancer, PeoplePerHour, Guru, Reddit r/gameDevClassifieds, Unreal, Polycount, Blender Artists, specializované game/contract portály, veřejné ATS (Greenhouse, Lever, Ashby, SmartRecruiters, Workable, Teamtailor, Recruitee) a vybrané oficiální procurement portály (TED, UK, SAM.gov, CanadaBuys, UNGM, UNDP a World Bank).

Allowlist domény není automatické přijetí výsledku. Home/search/profile/category URL se mohou objevit mezi konzultovanými zdroji, ale nemohou být uloženy jako opportunity. Každý přijatý záznam musí mít source URL mezi skutečně vrácenými hosted-search sources a musí projít přesným path patternem.

## LinkedIn, Upwork a cloud browser

WIDE_INDEX nepřihlašuje cloudový browser, nepoužívá cookies, neřeší CAPTCHA a neobchází ochrany. LinkedIn je z automatického allowlistu výslovně vynechán, protože jeho aktuální User Agreement zakazuje scraping/copy přes crawlers, browser plugins a podobnou automatizaci. Upwork a Reddit se hledají pouze zprostředkovaně přes veřejný webový index; nejde o přímý HTML scraper. Schválené oficiální API lze později přidat jako samostatný adapter po získání potřebného přístupu a vyřešení komerčních podmínek.

Hosted web search není důkaz kompletního procházení každé stránky dané platformy. Nový režim garantuje provedení všech pěti vyhledávacích okruhů a měří jejich výtěžnost; negarantuje indexovou úplnost třetí strany ani pevný počet kvalitních zakázek.

## Competitor a source-platform gate

Každý ověřený kandidát prochází před sales truth gate serverovou klasifikací
`SALES_OPPORTUNITY | COMPETITOR | SOURCE_PLATFORM`. Generic seller/service
page se uloží nanejvýš jako competitor intelligence; agregátor nebo ATS
identita jako source-platform provenance. Ani jeden druh nezabírá strop 24
sales výsledků, nevstupuje do sales summary a nemůže odemknout reply nebo
outreach. Originální employer/ATS detail s doloženým buyer signálem zůstává
sales kandidát.

## Aktivace a ověření

Před produkční aktivací:

1. nasadit exact commit přes Git-backed Deploy Preview,
2. bez placeného requestu ověřit build metadata, health a UI,
3. nastavit pouze produkční profil a přesné hranice výše,
4. vytvořit jeden Git-backed production redeploy stejného commitu,
5. teprve po `production_search=READY` a `production_search_profile=WIDE_INDEX`
   spustit jeden ruční placený Search; browser použije `/api/search-background`
   a dostane okamžité HTTP 202,
6. pollovat read-only `/api/search-status` do `COMPLETED` nebo `UNCERTAIN`,
7. po `COMPLETED` ověřit pět coverage karet, náklad, persistence přes
   `GET /api/opportunities` a UI refresh,
8. ihned vrátit produkční profil na FOCUSED a nasadit exact Git-backed commit.

Po request dispatchi se nesmí automaticky retryovat. Nejisté přerušení přejde
přes existující atomický coordinator do `UNCERTAIN`. Stav, který po maximálním
15minutovém background okně zůstane bez dokončení, UI po 16 minutách rovněž
vyhodnotí jako `UNCERTAIN`; status endpoint je read-only a sám nic
neredispatchuje.
