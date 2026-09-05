# Phase B — read-only sběr zdrojů

Stav k 5. 9. 2026: **první implementační řez a produkční API canary hotové; endpoint aplikace zatím není nasazený**.

## Co je implementované

- samostatný autentizovaný endpoint `GET/POST /api/source-collection`,
- read-only adaptér pro oficiální TED Search API `POST /v3/notices/search`,
- čtyři schválené query skupiny: External Development, Production Overflow, Pipeline Consulting a Other Relevant,
- hard filtr `scope: ACTIVE` a publikační okno posledních 30 dnů,
- pevný upstream endpoint a předem definované query packs; klient nemůže dodat vlastní URL ani libovolný dotaz,
- limit nejvýše 50 záznamů na jednu stránku, serverový cap a cooldown,
- parser variant polí TED, původní TED detail URL a měřené counters,
- fixture/mock acceptance bez sítě, bez OpenAI a s cenou `$0`,
- produkční TED API canary: relevantní query HTTP 200 / 0 notices a kontrolní recent ACTIVE query HTTP 200 / 1 notice,
- Polycount, Unreal a Blender jsou v runtime registru viditelné jako `BLOCKED_ACCESS_REVIEW`.

Oficiální dokumentace potvrzuje, že TED Search API zpřístupňuje publikované procurement notices pro analýzu a reuse, nevyžaduje autentizaci a používá `POST /v3/notices/search`: [TED Search API](https://docs.ted.europa.eu/api/latest/search.html). Request/response boundary byl navíc porovnán s klientem v oficiálním repozitáři EU Publications Office: [OP-TED open-data explorer](https://github.com/OP-TED/ted-open-data-explorer/blob/a562458e94b55f46e58bb483cbb11a75a9330298/src/js/services/tedAPI.js).

## Bezpečnostní hranice

Collector není napojený na dnešní placený `POST /api/search`. Má vlastní gate:

```text
RADAR_SOURCE_COLLECTION_ENABLED=false
```

Výchozí hodnota je `false`. `RADAR_LIVE_AI_ENABLED` může a má zůstat `false`; TED collector nepoužívá `OPENAI_API_KEY`. `GET` pouze vrací registry/status. `POST` při vypnutém gate skončí `SOURCE_COLLECTION_LOCKED` ještě před sítí.

Výsledek collector endpointu je surový read-only dataset a `persistence: NONE`. Není automaticky uložen mezi opportunities, protože ještě neprošel Phase C klasifikací, detailovým ověřením, deduplikací a pravdivostními gates z Phase A.

## Co ještě není hotové

1. měření výtěžnosti všech čtyř packs a případná úprava termů,
2. kurzor/chunky, retry a idempotentní průběžné ukládání,
3. detail/revision dedupe tenderů,
4. napojení collector records do kandidátního pipeline,
5. access review a teprve potom implementace Polycount/Unreal/Blender,
6. nasazená acceptance samotného `/api/source-collection` endpointu.

Canary poslal 5. 9. 2026 do veřejného produkčního TED API dva malé anonymní read-only requesty s `limit: 1`. Přesný relevantní `other_relevant` dotaz byl syntakticky přijat a v daném okamžiku vrátil 0 notices; širší pouze validační dotaz vrátil 1 recent ACTIVE notice a potvrdil reálný field shape. Nebyl použit klíč, login, OpenAI ani placená služba. To ověřuje transport/kontrakt, ne relevanci nebo dostatečnou výtěžnost query packs.

## Offline ověření

```bash
npm test
npm run accept:collector
npm run sources:check
```

`accept:collector` používá sanitizovaný fixture transport. Jeho `network_requests: 0`, `openai_requests: 0` a `cost_usd: 0` jsou assertions, ne odhad.

## Roadmap a první placený Search

| Oblast | Stav |
|---|---:|
| Výzkum a katalog zdrojů | 100 % |
| Odstranění Visual / AI / Motion | 100 % |
| Phase A — pravdivost, freshness, counters | 100 % |
| Phase B — první funkční sběr | přibližně 50 % |
| Phase C — široký řízený run | 0 % |
| Phase D — deployed zero-cost acceptance + controlled live | 0 % |
| Revidovaný celý Radar | přibližně 74 % |

Původní V0.1 zůstává přibližně na 96 %, ale toto číslo nezahrnuje nově schválený široký crawler. První placený OpenAI Search je povolen až po dokončení B a C a po zelené **zero-cost** části D. Potom se spustí právě jeden Focused acceptance run s předem nastaveným stropem `$0.50`; Wide run dostane maximálně `$1.00` teprve po ruční kontrole kvality Focused výsledků.
