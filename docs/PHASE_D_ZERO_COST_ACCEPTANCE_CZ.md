# Phase D — deployed zero-cost acceptance

Stav k 5. 9. 2026: **pre-deploy code a offline contract jsou připravené; žádný nový deploy nebyl proveden**.

## Cíl a hranice

Phase D nesmí začít placeným Search ani live source collection. První deployed krok pouze prokáže, že přesný artifact běží se všemi placenými a source dispatch cestami zamčenými.

Povinný výchozí stav:

```text
RADAR_LIVE_AI_ENABLED=false
RADAR_SOURCE_COLLECTION_ENABLED=false
paid_execution=LOCKED
```

Bez samostatného explicitního souhlasu se nesmí vytvořit preview ani production deploy, změnit Netlify environment, spustit live source request nebo OpenAI request.

## D0 — offline readiness

Netlify build nyní vytváří ignorovaný `build-metadata.json`, který váže deploy artifact na přesný 40znakový commit. CI balí exact PR head, ne implicitní merge ref, a metadata přidá do testovaného source archivu.

Runner `npm run accept:deployed:locked` je jednorázový a bez retry. Nejdřív ověří:

1. HTTPS host patří přesně site family `3dsk-opportunity-radar.netlify.app`,
2. `build-metadata.json` odpovídá očekávanému commitu a profilu `LOCKED_ZERO_COST`,
3. `/api/health` hlásí správnou službu, nakonfigurovaný access, `live_ai_enabled:false`, `paid_ai_state:LOCKED` a `source_collection:LOCKED`.

Teprve potom provede tři autentizované POST lock probes. `/api/search` a `/api/generate-response` musí vrátit `423 LIVE_AI_LOCKED`; `/api/source-runs` musí vrátit `423 SOURCE_COLLECTION_LOCKED`. Tyto větve končí před OpenAI, source transportem i repository write.

Runner:

- vyžaduje přesnou confirmation hodnotu `I_APPROVE_LOCKED_ZERO_COST_ACCEPTANCE`,
- bere access code pouze z `RADAR_ACCEPTANCE_ACCESS_CODE`, ne z CLI argumentu,
- secret nevrací ve výsledku,
- udělá přesně pět HTTP requestů, nula source requestů, nula OpenAI requestů, nula write a nula retry.

## D1 — první povolený deployed krok

Nejmenší bezpečný krok je přesně jeden Netlify **preview deploy** z finálního remote headu této Phase D branche, bez environment změn. Po dokončení se spustí právě jeden locked acceptance run proti vrácené preview URL. Production alias ani production Blobs se tím nemění.

Před deployem je nutné read-only ověřit aktuální site, předchozí produkční deploy a oba serverové gates. Pokud kterýkoli gate není `false`, krok se zastaví před deployem. Neprovádět automatický retry.

Schvalovací věta bude doplněna finálním remote SHA po zeleném CI a musí přesně vymezit jeden preview deploy, jeden locked acceptance run, bez env změn, live source/OpenAI requestů a bez merge.

## D2 — až po zeleném D1

Samostatný další souhlas může povolit production locked deploy nebo kontrolovaný zero-cost source test. Tyto dvě akce se nespojují automaticky. Zapnutí `RADAR_SOURCE_COLLECTION_ENABLED` je environment změna a live source dispatch; vyžaduje vlastní přesný scope, request cap, rollback a bez-retry pravidlo.

Paid AI zůstává mimo Phase D. První budoucí FOCUSED placený test vyžaduje implementovaný atomický coordinator provider, zelenou deployed zero-cost acceptance a samostatný explicitní souhlas s capem `$0.50`.
