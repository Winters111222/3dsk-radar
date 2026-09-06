# 3D.SK Opportunity Radar

Malý interní webový nástroj pro 3D.sk, který na požádání vyhledá aktuální worldwide B2B/freelance/outsourcing příležitosti relevantní pro 3D.sk, seřadí je podle fitu a připraví personalizovanou obchodní odpověď.

## Cíl MVP

Jedna jednoduchá webová stránka dostupná přes link:

1. `Find opportunities`
2. aktuální worldwide výsledky
3. fit / win score se zelená–žlutá–červená signalizací
4. zveřejněný nebo jasně označený odhadovaný budget
5. původní zdroj + detail nabídky
6. veřejně dohledaný kontaktní e-mail + Copy
7. company bookmark `☆ / ★` + `BOOKMARKED` pohled
8. company outreach historie a ochrana před nechtěným opakovaným oslovením
9. výběr nabídky
10. `Generate response`
11. personalizovaný obchodní e-mail + Copy Subject / Copy Response
12. ruční `MARK EMAIL SENT` po skutečném odeslání v Outlooku

Bez automatického odesílání mailů, CRM a zbytečně složité infrastruktury.

## Bezpečnost

Tento repozitář je při založení **public**. Nikdy necommitovat:

- `OPENAI_API_KEY` ani jiné secrets,
- NDA informace,
- neveřejná jména klientů/projektů,
- interní ceníky nebo citlivé obchodní informace,
- osobní údaje skenovaných lidí.

Secrets patří pouze do server-side environment variables. Konkrétní credentials smí aplikace používat v outbound copy pouze tehdy, jsou-li v autoritativním profilu označené jako `PUBLIC_APPROVED`.

Před úplně prvním placeným AI testem musí zůstat `RADAR_LIVE_AI_ENABLED=false` a aplikace musí projít zero-cost pre-live acceptance.

Detailní zadání: [`docs/PROJECT_BRIEF_CZ.md`](docs/PROJECT_BRIEF_CZ.md)

Závazné company-memory rozhodnutí: [`docs/PRODUCT_DECISION_COMPANY_MEMORY_CZ.md`](docs/PRODUCT_DECISION_COMPANY_MEMORY_CZ.md)

Závazný Search scope: [`docs/PRODUCT_DECISION_SEARCH_SCOPE_CZ.md`](docs/PRODUCT_DECISION_SEARCH_SCOPE_CZ.md)

Search Phase A — truth/freshness acceptance: [`docs/PHASE_A_SEARCH_TRUTH_ACCEPTANCE_CZ.md`](docs/PHASE_A_SEARCH_TRUTH_ACCEPTANCE_CZ.md)

Search Phase B — read-only source collection: [`docs/PHASE_B_SOURCE_COLLECTION_CZ.md`](docs/PHASE_B_SOURCE_COLLECTION_CZ.md)

Phase B access review — komunitní zdroje + UK OCDS: [`docs/PHASE_B_ACCESS_REVIEW_CZ.md`](docs/PHASE_B_ACCESS_REVIEW_CZ.md)

Phase B zero-cost yield measurement a CanadaBuys decision: [`docs/PHASE_B_YIELD_MEASUREMENT_CZ.md`](docs/PHASE_B_YIELD_MEASUREMENT_CZ.md)

Phase C — perzistentní multi-source run engine a operator UI: [`docs/PHASE_C_RUN_ENGINE_CZ.md`](docs/PHASE_C_RUN_ENGINE_CZ.md)

Phase C — atomický coordinator contract pro budoucí paid run: [`docs/PHASE_C_ATOMIC_COORDINATOR_CZ.md`](docs/PHASE_C_ATOMIC_COORDINATOR_CZ.md)

Phase D — deployed zero-cost acceptance: [`docs/PHASE_D_ZERO_COST_ACCEPTANCE_CZ.md`](docs/PHASE_D_ZERO_COST_ACCEPTANCE_CZ.md)

Phase E — single paid FOCUSED acceptance: [`docs/PHASE_E_PAID_ACCEPTANCE_CZ.md`](docs/PHASE_E_PAID_ACCEPTANCE_CZ.md)

Pre-live acceptance: [`docs/PRELIVE_ACCEPTANCE_CZ.md`](docs/PRELIVE_ACCEPTANCE_CZ.md)

Instrukce pro další vývojové boty: [`AGENTS.md`](AGENTS.md)

Výzkum zdrojů a návrh širokého Search (5. 9. 2026): [`docs/SEARCH_SOURCE_STRATEGY_CZ.md`](docs/SEARCH_SOURCE_STRATEGY_CZ.md). Obsahuje 49 zdrojových záznamů, přístupová omezení, query packs a implementační pořadí. Samostatné TED, Find a Tender a Contracts Finder collectory jsou implementované za default-off gate; výzkumný katalog zůstává oddělený od runtime registry. Phase C ukládá raw kandidáty, načítá jejich first-party detail a do opportunities promítá jen položky, které projdou Phase A truth gates. Integritu ověří `npm run sources:check`, `npm run report:sources:readiness`, `npm run accept:collector` a `npm run accept:run` bez externí sítě a AI. Readiness report drží odděleně historickou relevanci, oprávnění k automatizaci a source-specific precision; žádný z těchto stavů se neodvozuje z pouhého názvu webu.

Audit historické relevance: [`docs/SOURCE_HISTORICAL_RELEVANCE_AUDIT_CZ.md`](docs/SOURCE_HISTORICAL_RELEVANCE_AUDIT_CZ.md). Pouze 5 z 49 výzkumných zdrojů má doloženou konkrétní historickou buyer nabídku odpovídající scope 3D.SK; žádný zatím není runtime způsobilý. Robustní WIDE crawl přes celý katalog je proto zakázaný, dokud zdroj samostatně neprojde důkazem relevance, access review a měřením precision. Runtime tuto podmínku kontroluje nezávisle na obecném environment přepínači.

Bezpečný zprostředkovaný discovery režim: [`docs/INDEX_DISCOVERY_MANUAL_VERIFY_CZ.md`](docs/INDEX_DISCOVERY_MANUAL_VERIFY_CZ.md). Hosted web search je omezen na pět Tier A domén a backend přijme jen konkrétní opportunity URL. Neprobíhá přihlášení ani přímý crawl; každý výsledek vyžaduje trvale uložené ruční ověření přesné originální URL před generováním odpovědi nebo zápisem outreach. Tento režim není náhradou za schválené API nebo písemné povolení platformy.
