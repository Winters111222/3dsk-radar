# Phase B — read-only sběr zdrojů

Stav k 5. 9. 2026: **Phase B implementace a zero-cost acceptance jsou 100 %; endpoint aplikace zatím není nasazený**.

## Co je implementované

- samostatný autentizovaný endpoint `GET/POST /api/source-collection`,
- read-only adaptér pro oficiální TED Search API `POST /v3/notices/search`,
- read-only adaptér pro oficiální Find a Tender OCDS API `GET /api/1.0/ocdsReleasePackages`,
- read-only adaptér pro oficiální Contracts Finder OCDS API `GET /Published/Notices/OCDS/Search`,
- čtyři schválené query skupiny: External Development, Production Overflow, Pipeline Consulting a Other Relevant,
- u TED hard filtr `scope: ACTIVE` a publikační okno posledních 30 dnů,
- u Find a Tender hard `stages=tender`, 30denní okno aktualizací, lokální active/deadline/freshness/scope filtry a validovaný cursor,
- pevný upstream endpoint a předem definované query packs; klient nemůže dodat vlastní URL ani libovolný dotaz,
- limit nejvýše 50 záznamů na jednu stránku, serverový cap a cooldown,
- parser variant polí TED, původní TED detail URL a měřené counters,
- fixture/mock acceptance bez sítě, bez OpenAI a s cenou `$0`,
- produkční TED API canary: relevantní query HTTP 200 / 0 notices a kontrolní recent ACTIVE query HTTP 200 / 1 notice,
- produkční Find a Tender API canary: HTTP 200 / 1 OCDS release / `links.next`,
- produkční Contracts Finder API canary: HTTP 200 / 1 OCDS release / first-party notice URL / `links.next`,
- dokončený access review Polycount, Unreal a Blender Artists; všechny tři zdroje zůstávají v runtime registru `BLOCKED_ACCESS_REVIEW` s konkrétním reason code.
- bounded live yield nástroj pro všechny čtyři packy: přesně 6 requestů, max 50 records, bez retry, OpenAI a persistence,
- regresní oprava TED šumu: holé `FACS`, obecné `photogrammetry services` a `scan processing` byly nahrazeny jednoznačnými human/character frázemi,
- zdokumentované rozhodnutí nepřidávat CanadaBuys bulk CSV do stránkovaného 50-record contractu.

Oficiální dokumentace potvrzuje, že TED Search API zpřístupňuje publikované procurement notices pro analýzu a reuse, nevyžaduje autentizaci a používá `POST /v3/notices/search`: [TED Search API](https://docs.ted.europa.eu/api/latest/search.html). Request/response boundary byl navíc porovnán s klientem v oficiálním repozitáři EU Publications Office: [OP-TED open-data explorer](https://github.com/OP-TED/ted-open-data-explorer/blob/a562458e94b55f46e58bb483cbb11a75a9330298/src/js/services/tedAPI.js).

Find a Tender výslovně publikuje notice data jako OCDS JSON pod Open Government Licence. Adapter používá jen dokumentované filtry a cursor a nastavuje přísnější limit 50 místo serverového maxima 100: [Data and API](https://www.find-tender.service.gov.uk/Developer/Documentation), [OCDS release package endpoint](https://www.find-tender.service.gov.uk/apidocumentation/1.0/GET-ocdsReleasePackages).

Contracts Finder má samostatný veřejný OCDS Search endpoint s publikačním oknem, stages, limitem a cursorem. Adapter navíc přijímá provenance jen z first-party `tenderNotice` URL a dokumentovaný rate-limit 403 mapuje na vlastní 429 bez automatického retry: [Contracts Finder API](https://www.contractsfinder.service.gov.uk/apidocumentation), [OCDS Search endpoint](https://www.contractsfinder.service.gov.uk/apidocumentation/Notices/1/GET-Published-Notice-OCDS-Search).

Přesný komunitní access review je v [PHASE_B_ACCESS_REVIEW_CZ.md](PHASE_B_ACCESS_REVIEW_CZ.md). Unreal a Blender publikovaným `robots.txt` zakazují kategorické RSS cesty. Polycount RSS existuje a robots jej nezakazuje, ale podmínky nedávají dostatečně jisté povolení pro komerční automatizovaný ingest uživatelského obsahu. Žádný z těchto tří zdrojů se proto neaktivoval a nebyl nahrazen HTML scrapingem.

## Bezpečnostní hranice

Collector není napojený na dnešní placený `POST /api/search`. Má vlastní gate:

```text
RADAR_SOURCE_COLLECTION_ENABLED=false
```

Výchozí hodnota je `false`. `RADAR_LIVE_AI_ENABLED` může a má zůstat `false`; TED collector nepoužívá `OPENAI_API_KEY`. `GET` pouze vrací registry/status. `POST` při vypnutém gate skončí `SOURCE_COLLECTION_LOCKED` ještě před sítí.

Výsledek collector endpointu je surový read-only dataset a `persistence: NONE`. Není automaticky uložen mezi opportunities, protože ještě neprošel Phase C klasifikací, detailovým ověřením, deduplikací a pravdivostními gates z Phase A.

## Co následuje mimo Phase B

1. napojení collector records do kandidátního pipeline v Phase C,
2. cursor/chunky, retry/idempotence, průběžné ukládání a tender revision dedupe v Phase C,
3. případný CanadaBuys bulk adapter až se samostatným byte/row cap contractem,
4. nasazená zero-cost acceptance samotného `/api/source-collection` endpointu v Phase D.

Canary poslal 5. 9. 2026 do veřejného produkčního TED API dva malé anonymní read-only requesty s `limit: 1`. Přesný relevantní `other_relevant` dotaz byl syntakticky přijat a v daném okamžiku vrátil 0 notices; širší pouze validační dotaz vrátil 1 recent ACTIVE notice a potvrdil reálný field shape. Další jeden anonymní Find a Tender request a jeden Contracts Finder request s `limit=1` potvrdily OCDS `releases[]`, tender status/deadline, cursor a first-party provenance. Nebyl použit klíč, login, OpenAI ani placená služba. To ověřuje transport/kontrakt, ne relevanci nebo dostatečnou výtěžnost query packs.

Navazující bounded měření odhalilo 18 false positives z nejednoznačného `FACS` a 7 převážně leteckých/GIS výsledků z obecné photogrammetry fráze. Po zpřesnění dotazů dokončil finální šestirequestový běh všechny zdroje a packy s 0 relevantními records v tomto malém vzorku. Přesné counters, request accounting a CanadaBuys rozhodnutí jsou v [Phase B yield measurement](PHASE_B_YIELD_MEASUREMENT_CZ.md).

## Offline ověření

```bash
npm test
npm run accept:collector
npm run sources:check
# explicitní live read-only měření, nespouští se v CI
npm run measure:collector:live -- --confirm-live-read-only
```

`accept:collector` používá sanitizovaný fixture transport. Jeho `network_requests: 0`, `openai_requests: 0` a `cost_usd: 0` jsou assertions, ne odhad.

## Roadmap a první placený Search

| Oblast | Stav |
|---|---:|
| Výzkum a katalog zdrojů | 100 % |
| Odstranění Visual / AI / Motion | 100 % |
| Phase A — pravdivost, freshness, counters | 100 % |
| Phase B — první funkční sběr | 100 % |
| Phase C — široký řízený run | 0 % |
| Phase D — deployed zero-cost acceptance + controlled live | 0 % |
| Revidovaný celý Radar | přibližně 83 % |

Původní V0.1 zůstává přibližně na 96 %, ale toto číslo nezahrnuje nově schválený široký crawler. První placený OpenAI Search je povolen až po dokončení B a C a po zelené **zero-cost** části D. Potom se spustí právě jeden Focused acceptance run s předem nastaveným stropem `$0.50`; Wide run dostane maximálně `$1.00` teprve po ruční kontrole kvality Focused výsledků.
