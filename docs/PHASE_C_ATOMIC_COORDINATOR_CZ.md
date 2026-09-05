# Phase C — atomický coordinator pro budoucí paid run

Stav k 5. 9. 2026: **přesný kontrakt je navržen; implementace poskytovatele ani paid dispatch nejsou zapnuté**. `paid_execution` proto zůstává `LOCKED`.

## Proč nestačí Netlify Blobs

Současné persisted operation records, leases a idempotency keys chrání běžný single-writer průchod, ale neposkytují atomický compare-and-swap přes více instancí. Dvě souběžné Functions by bez distribuované transakce mohly obě přečíst volný budget a obě otevřít placený request. In-process zámek ani následný zápis tuto hranici nedokazují.

## Povinný provider contract

Budoucí coordinator musí poskytovat všech pět capability flags z `src/server/paid-run-coordinator-contract.mjs` a tři serverové operace:

1. `claimOperation(runId, operationId, expectedVersion)` atomicky vytvoří unikátní operation claim, zvýší monotónní verzi runu a vrátí fencing token. Stejný klíč vrací původní výsledek; jiný claim se zastaralou verzí nesmí uspět.
2. `reserveBudget(runId, reservationId, maxMicrousd, expectedVersion)` v jedné transakci ověří `settled + reserved + max <= cap`, vytvoří unikátní rezervaci a zvýší verzi. Externí paid request se smí spustit až po potvrzeném commitu rezervace.
3. `settleBudget(runId, reservationId, actualMicrousd, fenceToken)` idempotentně přesune rezervaci do settled částky. Překročení rezervace, neznámý reservation ID nebo starý fencing token failne bez zápisu.

Provider dále musí garantovat:

- durable unique constraint pro `(run_id, operation_id)` a `(run_id, reservation_id)`,
- serializable transakci nebo ekvivalentní podmíněný atomický write,
- monotónní fencing token, který zastaví opožděnou instanci,
- atomický přechod cancel/terminal stavu, po kterém nelze získat nový paid claim,
- auditní záznam bez secretů a bez payloadu obsahujícího credentials,
- rekonciliační stav `UNCERTAIN` pro transportní ztrátu po dispatch; automatický druhý paid dispatch je zakázán.

## Unlock gate

Paid cestu lze integrovat teprve když:

- `paidCoordinatorReadiness(provider).ready === true`,
- contract test proběhne proti reálnému provideru se dvěma souběžnými writery,
- test prokáže jediný vítězný claim a jedinou budget rezervaci,
- deployed zero-cost Phase D acceptance je zelená,
- uživatel výslovně povolí první jediný FOCUSED test s capem `$0.50`.

Pouhé nastavení environment flagu nikdy nesmí obejít coordinator readiness. Do té doby se `RADAR_LIVE_AI_ENABLED=false` nemění a každý run vrací `paid_execution: LOCKED`.
