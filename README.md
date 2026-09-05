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

Pre-live acceptance: [`docs/PRELIVE_ACCEPTANCE_CZ.md`](docs/PRELIVE_ACCEPTANCE_CZ.md)

Instrukce pro další vývojové boty: [`AGENTS.md`](AGENTS.md)
