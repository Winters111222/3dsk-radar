# 3D.SK Opportunity Radar — NEXT THREAD HANDOFF CZ

Navaž na nový projekt v repozitáři:

`Winters111222/3dsk-radar`

Neber produktové zadání z předchozích chatů. Jako autoritu použij aktuální repository.

## Povinně nejdřív načti

1. aktuální `main`
2. `README.md`
3. `AGENTS.md`
4. `docs/PROJECT_BRIEF_CZ.md`

Kanonický detailní brief byl založen commitem:

`6854c15cac7d04dfe3ffe24acfef91ae25550305`

Po načtení samozřejmě pracuj z aktuálního HEAD, ne ze starého commitu.

## Cíl produktu

Postavit co nejjednodušší interní webovou aplikaci **3D.SK Opportunity Radar**, dostupnou týmu přes jeden link.

Primární flow:

`SEARCH → EXTRACT → SCORE → DISPLAY → SELECT → GENERATE RESPONSE → COPY TO OUTLOOK`

Uživatel má na jeden klik najít aktuální worldwide B2B/freelance/outsourcing příležitosti relevantní pro capability 3D.sk, vidět jejich fit, opportunity/win score, budget s jasným provenance, veřejný kontakt a zdroj. Pro vybranou příležitost má na další klik vzniknout konkrétní anglický obchodní e-mail, který uživatel ručně copy/paste odešle z Outlooku.

## Důležitý capability kontext

3D.sk nechápej jako jednoho 3D freelancera. Jde o studio/vendor schopné podle scope pokrýt celý nebo dílčí human/AAA character pipeline:

- human photogrammetry capture,
- talent/commercial rights workflow dle projektu,
- RealityCapture reconstruction,
- scan cleaning,
- ZBrush cleanup,
- R3DS Wrap / Wrap3D,
- conforming na klientem dodaný production basemesh,
- AAA neutral preparation,
- facial/FACS/expression processing dle klientovy pipeline,
- ZBrush delivery,
- Substance/texture finishing přes specialisty týmu,
- podle scope kompletní AAA game character production,
- batch / overflow production,
- pipeline přizpůsobený klientským požadavkům.

Přesné outbound claims se musí řídit autoritativním company profilem a PUBLIC_APPROVED credentials.

## Bezpečnost

Repo je při založení PUBLIC.

- Necommituj secrets.
- Necommituj NDA data.
- Nezapisuj neveřejné klienty/projekty do veřejného repa.
- `OPENAI_API_KEY` pouze server-side env.
- Nikdy nevymýšlej kontaktní e-mail.
- Budget musí být `PUBLISHED`, `ESTIMATED` nebo `UNKNOWN`.
- `WIN SCORE` je heuristický opportunity score, ne statistická pravděpodobnost výhry.

## Scope V0.1

Musí umět:

1. jednoduchý interní access,
2. ruční `FIND NEW OPPORTUNITIES`,
3. worldwide search,
4. dedupe + historie,
5. fit score,
6. win score + green/yellow/red band,
7. budget + provenance,
8. source link,
9. veřejný contact e-mail + Copy, pokud existuje,
10. opportunity detail,
11. status `NEW / INTERESTING / CONTACTED / IGNORE`,
12. `GENERATE RESPONSE` jen pro vybranou položku,
13. anglický subject + body,
14. Copy subject / Copy response.

## Do V0.1 NEPATŘÍ

- automatické odesílání e-mailů,
- Outlook/Gmail OAuth,
- plné CRM,
- follow-up sequences,
- LinkedIn scraping/obcházení loginu,
- Supabase bez prokázané potřeby,
- multi-tenant auth,
- billing,
- background paid AI scans,
- zbytečný admin panel.

## Doporučený stack

Drž jednoduchost:

`GitHub → Netlify → malý frontend → Netlify Functions → OpenAI API + jednoduchá persistence`

Před implementací aktuálního OpenAI/Netlify API ověř oficiální současnou dokumentaci; nepoužívej zastaralé endpointy jen podle starého promptu.

## První krok

Nezačínej placeným live search runem.

Nejdřív na nové feature branchi vytvoř **Stage 0 + Stage 1**:

- minimální frontend skeleton,
- company-profile schema,
- fixture/mock opportunities,
- statický dashboard,
- detail nabídky,
- Fit / Win bands,
- budget provenance UI,
- contact provenance UI,
- Copy buttons,
- status UX,
- základní testy,
- env example bez secret hodnot.

Ověř, že UI a datový model pokrývají celý acceptance contract z `docs/PROJECT_BRIEF_CZ.md`.

Teprve potom připojuj paid AI/web search backend.

## Práce v GitHubu

Pracuj na reviewable feature branchi a přes PR. Nemerguj do `main` jen proto, že statický skeleton funguje; nejdřív shrň změny, testy, bezpečnostní dopad a další krok.

Hlavní priorita:

**co nejkratší cesta od jednoho kliku k reálné relevantní příležitosti a kvalitní obchodní odpovědi — ne technologická komplexita.**
