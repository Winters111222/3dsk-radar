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
7. výběr nabídky
8. `Generate response`
9. personalizovaný obchodní e-mail + Copy

Bez automatického odesílání mailů, CRM a zbytečně složité infrastruktury.

## Bezpečnost

Tento repozitář je při založení **public**. Nikdy necommitovat:

- `OPENAI_API_KEY` ani jiné secrets,
- NDA informace,
- neveřejná jména klientů/projektů,
- interní ceníky nebo citlivé obchodní informace,
- osobní údaje skenovaných lidí.

Secrets patří pouze do server-side environment variables. Konkrétní credentials smí aplikace používat v outbound copy pouze tehdy, jsou-li v autoritativním profilu označené jako `PUBLIC_APPROVED`.

Detailní zadání: [`docs/PROJECT_BRIEF_CZ.md`](docs/PROJECT_BRIEF_CZ.md)

Instrukce pro další vývojové boty: [`AGENTS.md`](AGENTS.md)
