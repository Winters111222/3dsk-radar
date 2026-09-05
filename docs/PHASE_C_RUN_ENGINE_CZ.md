# Phase C — perzistentní multi-source run engine

Stav k 5. 9. 2026: **Phase C code scope je implementovaný a offline ověřený (100 %)**. Endpoint ani UI změny nejsou nasazené a default-off gate se nezměnil. Budoucí paid dispatch zůstává zamčený; atomický provider je přesně specifikován, nikoli nasazen.

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

Raw kandidáti se **neukládají přímo do `opportunities/`**. Run engine pro každý z nich použije zdrojově specifický first-party detail adapter, uloží review stav a teprve výsledek, který projde existujícími Phase A gates, promítne přes dedupe/history repository. Zamítnutý nebo blokovaný kandidát zůstává mimo opportunities s explicitním důvodem.

Implementované detail endpointy jsou fixní a nepřebírají URL od kandidáta:

- TED Search API v3: přesné `publication-number`,
- Find a Tender: OCDS record package podle validovaného `ocid`,
- Contracts Finder: OCDS record podle validovaného `ocid`.

Detail response má byte cap, timeout, kontrolu schématu i identity. 403/429/503 a timeout mohou být zopakovány nejvýše jednou v nové operaci; schema drift, identity mismatch a jiné trvalé chyby failnou closed. Detail ani klasifikace nepoužívají OpenAI.

## Operator UI

Aplikace má samostatný responzivní panel `Source candidate collection`, který:

- zobrazuje FOCUSED/WIDE limity, fázi, services/pages/candidates/truth-review progress a maximálně 24 posledních kandidátů,
- rozlišuje raw, detail fetch, retry, promoted, rejected, blocked a cancel-after-enrichment stav,
- jedním kliknutím vytvoří nebo obnoví běh a postupně volá persisted chunky,
- při HTTP cooldownu opakuje pouze stejný bezpečný `operation_id`,
- zastaví se na `RETRY_WAIT`, `UNCERTAIN`, cancel nebo po 25 chunkech v jedné browser session,
- po refreshi načte poslední run a dovolí bezpečný resume,
- neumí a nesmí měnit Netlify environment ani odemknout collection/AI gate.

Původní placené `FIND NEW OPPORTUNITIES` je při `paid_ai_state: LOCKED` skutečně disabled a viditelně označené `PAID LOCKED`. Zero-cost source collection se zpřístupní pouze serverovým gate po budoucí deployed acceptance.

## Idempotence, retry a přerušení

Každý `START` vyžaduje klientský `request_id`; opakování vrací stejný run a změna profilu pod stejným ID končí konfliktem. Každý `CONTINUE` a `CANCEL` vyžaduje `operation_id`. Dokončená operace se pouze přehraje bez dalšího fetch. Fresh `IN_PROGRESS` lease blokuje konkurenční pokračování. Stará nebo nejasně přerušená operace přepne run do `UNCERTAIN` a stejný operation ID už síť znovu neotevře.

403 rate limit z Contracts Finder, 429/503 a timeout/network hranice list i detail adaptéru jsou retryable nejvýše jednou v **nové** operaci po `not_before`; v tomtéž chunku se request neopakuje. Neočekávané přerušení failne do `UNCERTAIN`. Cancel zachová všechny už uložené stránky a kandidáty; cancel zjištěný po detail fetch uloží enrichment evidence, ale neprovede promotion.

Netlify Blobs poskytuje strong-consistency čtení/zápis, ale používaný contract nemá compare-and-swap ani podmíněný atomický write. Per-instance lock, persisted leases a idempotency records výrazně omezují duplicitní dispatch, ale nejsou poctivou zárukou distribuované exactly-once exekuce při souběhu více function instancí. Přesný provider contract, fencing a unlock kritéria jsou v [`PHASE_C_ATOMIC_COORDINATOR_CZ.md`](PHASE_C_ATOMIC_COORDINATOR_CZ.md). Proto:

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

Acceptance nabízí 501 stran a přijme přesně hard cap 500 (140 list + 360 detail), nabízí 215 kandidátů a přijme přesně 180. Navíc provede offline detail → Phase A → promotion průchod. Samostatné testy kryjí fixní endpointy, URL/ID injection, identity mismatch, schema drift, response cap, 403/429/timeout, detail retry, cursor/chunk persistence, exact replay bez dalšího fetch, cancel před promotion, truth rejection, contact/budget provenance, tender revision, cross-source dedupe, operator-loop transient retry, mobile layout a neočekávané přerušení. Fixture transport hlásí `network_requests: 0`, `openai_requests: 0`, `cost_usd: 0`.

## Co zbývá mimo Phase C code scope

1. v Phase D nasadit a ověřit pouze zero-cost cestu v reálném prostředí,
2. před budoucím paid dispatch implementovat a souběžně otestovat provider přesně podle atomic coordinator contractu,
3. teprve po zelené Phase D a explicitním souhlasu provést jediný FOCUSED test s capem `$0.50`.

Bez změny zůstává:

```text
RADAR_LIVE_AI_ENABLED=false
RADAR_SOURCE_COLLECTION_ENABLED=false
```

V tomto kroku nebyl proveden deploy, merge, změna Netlify environment, live source request ani OpenAI request.
