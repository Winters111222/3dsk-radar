# Phase C — perzistentní multi-source run engine

Stav k 5. 9. 2026: **orchestration slice je implementovaný a offline ověřený; Phase C celkem přibližně 70 %**. Endpoint není nasazený a default-off gate se nezměnil.

## Implementovaný contract

Nový autentizovaný `GET/POST /api/source-runs` řídí stejné tři first-party collectory jako Phase B. `START` vytvoří neměnný snapshot profilu a 12 work items: tři zdroje krát čtyři schválené query packs. `CONTINUE` zpracuje nejvýše čtyři upstream pokusy v jednom chunku a uloží stav po každé dokončené stránce. `CANCEL` je idempotentní a zůstává dostupný i po vypnutí collection gate, aby šel rozpracovaný run bezpečně zastavit.

Profily mají hard limity:

| Limit | FOCUSED | WIDE |
|---|---:|---:|
| Source services / work items | 15 | 45 |
| List pages | 40 | 140 |
| Detail pages | 80 | 360 |
| Všechny stránky | 120 | 500 |
| Kandidáti | 45 | 180 |
| Budoucí hosted web calls | 12 | 40 |
| Budoucí budget cap | $0.50 | $1.00 |

Aktivní run ukládá do Netlify Blobs odděleně:

- stav, immutable plán, cursory a counters,
- idempotentní start request a operation records,
- kandidáty a hashované dedupe indexy,
- cancel marker,
- cost reservation ledger v integer `microusd`.

Kandidáti se **neukládají do `opportunities/`**. Jsou raw source records čekající na detailní ověření a Phase A truth klasifikaci. Jejich existence proto není tvrzení, že jde o otevřenou buyer poptávku.

## Idempotence, retry a přerušení

Každý `START` vyžaduje klientský `request_id`; opakování vrací stejný run a změna profilu pod stejným ID končí konfliktem. Každý `CONTINUE` a `CANCEL` vyžaduje `operation_id`. Dokončená operace se pouze přehraje bez dalšího fetch. Fresh `IN_PROGRESS` lease blokuje konkurenční pokračování. Stará nebo nejasně přerušená operace přepne run do `UNCERTAIN` a stejný operation ID už síť znovu neotevře.

403 rate limit z Contracts Finder, 429/503 a timeout/network hranice jsou retryable nejvýše jednou v **nové** operaci po `not_before`; v tomtéž chunku se request neopakuje. Neočekávané přerušení failne do `UNCERTAIN`. Cancel zachová všechny už uložené stránky a kandidáty.

Netlify Blobs poskytuje strong-consistency čtení/zápis, ale používaný contract nemá compare-and-swap ani podmíněný atomický write. Per-instance lock, persisted leases a idempotency records výrazně omezují duplicitní dispatch, ale nejsou poctivou zárukou distribuované exactly-once exekuce při souběhu více function instancí. Proto:

- source run je zatím provozně single-writer,
- `paid_execution` zůstává `LOCKED`,
- cost reservation ledger je otestovaný contract, nikoli povolená placená cesta,
- před placeným dispatch je nutné doplnit atomický coordinator nebo jinou prokazatelnou serializaci.

## Deduplikace

Dedupe index používá kombinaci:

1. native identity `source + tender/procedure identity`,
2. normalizované first-party canonical URL,
3. normalizované `buyer + title` pro cross-source shodu.

Stejný source item/revision je exact duplicate. Nové release ID pod stejnou native tender identity je revision a může nahradit primary record pouze novějším datem. Stejná buyer/title kombinace z jiného zdroje se spojí jako cross-source duplicate a zachová obě provenance reference.

## Offline acceptance

```bash
npm test
npm run accept:run
```

Acceptance nabízí 501 stran a přijme přesně hard cap 500 (140 list + 360 detail), nabízí 215 kandidátů a přijme přesně 180. Samostatné testy kryjí 403/429/timeout, cursor/chunk persistence, exact replay bez dalšího fetch, cancel, tender revision, cross-source dedupe a neočekávané přerušení. Fixture transport hlásí `network_requests: 0`, `openai_requests: 0`, `cost_usd: 0`.

## Co zbývá do 100 % Phase C

1. detailní enrichment a napojení raw kandidátů na Phase A truth gates,
2. bezpečné řízení detail-page budgetu skutečným detail adaptérem,
3. atomický distribuovaný coordinator pro budoucí paid cost reservations,
4. UI řízení jednoho kliku přes více chunků včetně progress/cancel,
5. teprve po nasazení zero-cost části v Phase D ověřit reálnou multi-page výtěžnost.

Bez změny zůstává:

```text
RADAR_LIVE_AI_ENABLED=false
RADAR_SOURCE_COLLECTION_ENABLED=false
```

V tomto kroku nebyl proveden deploy, merge, změna Netlify environment, live source request ani OpenAI request.
