# 3D.SK Opportunity Radar — detailní zadání MVP

## 0. Účel dokumentu

Toto je hlavní zadání pro vývoj interního nástroje **3D.SK Opportunity Radar**. Nový vývojový bot má být schopný po načtení tohoto dokumentu pokračovat bez rekonstruování původní konverzace.

Cílem není postavit velký sales systém. Cílem je co nejjednodušší chytrý vyhledávač obchodních příležitostí šitý na míru schopnostem 3D.sk.

Primární produktová věta:

> Otevřu jeden link, kliknu na „Find opportunities“, dostanu aktuální worldwide poptávky relevantní pro 3D.sk, rychle poznám jejich hodnotu a fit, zkopíruju kontakt a u vybrané nabídky si jedním klikem nechám vytvořit perfektně personalizovanou obchodní odpověď, kterou ručně vložím do Outlooku.

---

# 1. Hlavní princip

MVP musí zůstat maximálně jednoduché:

```text
SEARCH
  ↓
DISCOVER CURRENT OPPORTUNITIES
  ↓
EXTRACT FACTS + SOURCE
  ↓
COMPARE WITH 3D.SK PROFILE
  ↓
SCORE
  ↓
DISPLAY
  ↓
USER SELECTS ONE OPPORTUNITY
  ↓
GENERATE PERSONALIZED RESPONSE
  ↓
COPY TO OUTLOOK
```

Žádné automatické posílání e-mailů.

Žádné složité CRM.

Žádná nutnost instalovat aplikaci do PC.

Celý tým má aplikaci používat přes jeden webový link.

---

# 2. Uživatel a způsob použití

Primární uživatel je management / produkce 3D.sk. Aplikaci mohou používat další členové týmu.

Typická session:

1. Uživatel otevře web.
2. Přihlásí se jednoduchou interní ochranou.
3. Klikne `FIND NEW OPPORTUNITIES`.
4. Backend provede aktuální worldwide search.
5. Uživatel dostane jen relevantní nové nebo aktualizované příležitosti.
6. V tabulce rychle vidí:
   - název,
   - firmu,
   - datum,
   - typ příležitosti,
   - fit,
   - win score,
   - budget,
   - kontakt,
   - zdroj.
7. Rozklikne detail.
8. Pokud ho příležitost zajímá, klikne `GENERATE RESPONSE`.
9. AI vygeneruje obchodní e-mail přesně pro danou poptávku.
10. Uživatel zkopíruje e-mail / subject do Outlooku a odešle ručně.
11. Nabídku označí například `CONTACTED`.

---

# 3. Co 3D.sk umí — capability model

Vyhledávač nesmí chápat 3D.sk jako běžného „3D artista“. Jde o **end-to-end human photogrammetry + AAA character production vendor** schopný dodat celý workflow nebo jen konkrétní část pipeline.

## 3.1 Capture / talent / rights

3D.sk umí podle konkrétní zakázky pokrýt:

- profesionální multi-camera human photogrammetry capture,
- scanning reálných lidí,
- organizaci capture procesu,
- talent / model approval workflow,
- zajištění potřebných commercial usage rights / licencování reálných lidí dle konkrétní smlouvy a projektu,
- high-volume / batch capture.

Pozor: právní model a přesný rozsah licence je vždy projektově závislý. AI nesmí slibovat konkrétní právní podmínky bez potvrzení člověkem.

## 3.2 Reconstruction / scan processing

- RealityCapture / photogrammetry reconstruction,
- scan calculation / reconstruction workflow,
- scan cleanup,
- ZBrush cleanup,
- příprava dat pro downstream character pipeline,
- batch processing většího počtu lidských scanů.

## 3.3 Wrap / topology transfer

- R3DS Wrap / Wrap3D,
- conforming human scans na klientem dodaný production basemesh,
- práce s custom topology klienta,
- konzistentní batch wrapping,
- neutral head / neutral character preparation,
- production QC před předáním dalšímu stupni.

## 3.4 Facial / FACS

Dle konkrétního scope je tým schopný pokrýt:

- facial scan processing,
- neutral facial asset preparation,
- FACS expression processing,
- napojení / přenos blendshape nebo expression dat podle klientovy pipeline,
- přípravu vyčištěných facial dat pro další rig / animation pipeline.

AI nesmí bez explicitního potvrzení tvrdit, že 3D.sk dodává konkrétní proprietary rigging systém nebo konkrétní runtime facial solution.

## 3.5 Character finishing

Tým má specialisty schopné navázat na scan/wrap část a dodat podle scope i další AAA character production kroky:

- ZBrush finishing,
- character cleanup,
- Substance / texture cleanup a texturing,
- production textures,
- asset finishing,
- kompletní AAA game character delivery podle požadavků klienta.

Konkrétní součásti typu hair, rigging, cloth simulation, engine integration, shader authoring apod. nejsou automaticky považované za garantované. Musí být explicitně potvrzené v autoritativním company profilu předtím, než se použijí v obchodním e-mailu.

## 3.6 Photoshop / visual / AI

Vedle core photogrammetry pipeline existuje i silná vizuální kompetence:

- high-end Photoshop production,
- dlouholetá expert-level zkušenost s Photoshopem v týmu,
- generativní AI workflows,
- kombinace AI + Photoshop + další 2D/3D nástroje,
- motion / After Effects může být sekundární opportunity category, ale není hlavním cílem V1.

## 3.7 Produkční model

Klíčová obchodní výhoda:

3D.sk může přijmout **jen část pipeline** nebo **celý pipeline**.

Příklady:

```text
RAW SCANS
→ CLEANUP
→ WRAP TO CLIENT BASEMESH
→ QC
→ DELIVERY
```

nebo:

```text
TALENT / RIGHTS
→ CAPTURE
→ RECONSTRUCTION
→ CLEANUP
→ WRAP
→ NEUTRAL
→ FACS / EXPRESSIONS
→ TEXTURES / FINISHING
→ AAA CHARACTER DELIVERY
```

Proto search engine nesmí filtrovat jen nabídky obsahující slovo `photogrammetry`. Relevantní může být i obecnější poptávka po realistic character outsourcingu, digital humans, external development nebo character production overflow.

---

# 4. Credentials a claims

## 4.1 Zásada

Outbound text smí používat pouze:

1. capability, která je explicitně schválená v company profilu,
2. credential označený jako `PUBLIC_APPROVED`.

Nikdy nevymýšlet klienty, názvy projektů, přesné počty lidí, hardware nebo produkční fakta.

## 4.2 Public vs confidential

Repo je při založení PUBLIC.

Do git historie nepatří:

- NDA projekty,
- neveřejné klientské vztahy,
- neveřejné produkční počty,
- neveřejné technické parametry zařízení,
- interní ceník,
- smlouvy,
- osobní údaje modelů / talentů,
- API klíče.

Pokud je potřeba používat neveřejné interní informace pro scoring, musí být řešeny server-side/private konfigurací a nikdy se nesmí propsat do veřejného UI nebo outbound textu bez approval.

## 4.3 Shipped/public credits

Systém má podporovat veřejně ověřitelné shipped credits jako velmi silný signál credibility, ale každý konkrétní titul musí být v company profilu označen `PUBLIC_APPROVED`.

Pro první implementaci stačí datový model; není nutné commitovat seznam všech klientů.

Doporučené pole:

```json
{
  "name": "Example shipped AAA title",
  "type": "shipped_credit",
  "status": "PUBLIC_APPROVED",
  "role": "Senior Photogrammetry Artist",
  "verification_url": "https://..."
}
```

---

# 5. Co má Radar hledat

Radar nehledá jen pracovní pozice. Hledá **obchodní příležitosti pro studio/vendor tým**.

## 5.1 Nejvyšší priorita

- human photogrammetry outsourcing,
- realistic human character outsourcing,
- digital human production,
- digital double production,
- character scan processing,
- R3DS Wrap / Wrap3D production,
- basemesh conforming,
- facial scan processing,
- FACS processing,
- realistic character vendor,
- AAA character outsourcing,
- external development — character art,
- art outsourcing — realistic characters,
- character production overflow,
- co-development character production,
- photogrammetry vendor,
- scanning vendor,
- facial capture vendor,
- batch scan cleanup,
- realistic NPC production,
- actor / likeness character production.

## 5.2 Střední priorita

- broader 3D character outsourcing,
- realistic character art contracts,
- ZBrush character production,
- scan cleanup contracts,
- texture/character finishing outsource,
- digital human consulting,
- photogrammetry pipeline consulting,
- capture rig / scanning workflow consulting.

## 5.3 Sekundární opportunity lane

Volitelně lze ve V1/V1.1 zachytit:

- Photoshop-heavy visual production,
- generative AI visual workflows,
- After Effects / AI motion work,
- creative production, pokud využívá kombinaci AI + Photoshop + 3D.

Tyto výsledky musí být oddělené od hlavní AAA character/photogrammetry kategorie.

---

# 6. Opportunity types

Každý výsledek klasifikuj alespoň do jedné z kategorií:

- `FULL_PIPELINE`
- `CAPTURE`
- `PHOTOGRAMMETRY_PROCESSING`
- `SCAN_CLEANUP`
- `WRAP_BASEMESH`
- `FACIAL_FACS`
- `CHARACTER_FINISHING`
- `CHARACTER_OUTSOURCING`
- `EXTERNAL_DEVELOPMENT`
- `PRODUCTION_OVERFLOW`
- `PIPELINE_CONSULTING`
- `VISUAL_AI_MOTION`
- `OTHER_RELEVANT`

A dále rozlišuj zdroj příležitosti:

- `OPEN_OPPORTUNITY` — explicitní veřejná poptávka / kontrakt / vendor request,
- `POTENTIAL_LEAD` — firma pravděpodobně může potřebovat externí kapacitu, ale veřejně nic explicitně nepoptává.

UI musí tyto dvě věci jasně oddělit. Potential lead se nesmí prezentovat jako skutečný inzerát.

---

# 7. Search strategie

## 7.1 Search se spouští ručně

MVP nemá dělat automatické placené search runy na pozadí.

Uživatel klikne:

`FIND NEW OPPORTUNITIES`

Teprve potom backend zavolá search/AI.

## 7.2 Worldwide

Default:

- worldwide,
- remote / vendor-friendly,
- B2B / contract / freelance / outsourcing / external development,
- bez omezení na Kypr.

Příležitosti omezené na konkrétní stát lze zobrazit pouze pokud jsou mimořádně relevantní, ale musí být výrazně označené `LOCATION RESTRICTED`.

## 7.3 Freshness

Priorita:

1. dnes / posledních 24 h,
2. posledních 7 dní,
3. posledních 30 dní.

Starší nabídky zobrazuj jen pokud jsou stále prokazatelně aktivní.

## 7.4 Search intents

Backend nemá použít jeden obecný dotaz. Má použít balík intentů, např.:

```text
human photogrammetry outsourcing
R3DS Wrap contract
Wrap3D production outsourcing
digital human vendor game development
digital double outsourcing
realistic character outsourcing game studio
AAA character outsourcing vendor
character art external development
facial scan processing contract
FACS character outsourcing
human scan cleanup contract
basemesh conforming character
photogrammetry production partner
character production overflow
realistic NPC outsourcing
actor likeness character production
photogrammetry vendor game development
facial capture vendor games
character co-development partner
```

Search terms mají být konfigurovatelné.

## 7.5 Source quality

Preferovat primární zdroj:

- oficiální careers/vendor/procurement stránku,
- původní job post,
- oficiální LinkedIn/company post, pokud je dostupný,
- důvěryhodný specializovaný marketplace.

Agregátor může pomoci objevit příležitost, ale pokud existuje originální zdroj, výsledná karta má odkazovat primárně na originál.

---

# 8. Povinná data u každé nabídky

Každý normalizovaný opportunity record má obsahovat minimálně:

```text
id
canonical_url
source_url
source_domain
title
company
summary
opportunity_kind
categories[]
location
remote_scope
published_date
first_seen
last_seen
is_new
status
fit_score
win_score
win_band
budget_type
budget_published
budget_estimated_min
budget_estimated_max
budget_currency
budget_confidence
budget_reason
contact_name
contact_role
contact_email
contact_email_source
apply_url
why_it_fits[]
risks[]
missing_requirements[]
source_evidence[]
```

Volitelně:

```text
estimated_scope
estimated_hours
estimated_asset_count
buyer_type
company_size
competition_signal
reply_subject
reply_body
reply_generated_at
```

---

# 9. Fit score vs Win score

Je důležité mít dva různé koncepty.

## 9.1 FIT SCORE

`FIT SCORE 0–100`

Odpovídá otázce:

> Jak přesně tato poptávka sedí na capability 3D.sk?

Příklad faktorů:

- požadovaná pipeline přesně odpovídá 3D.sk,
- realistic humans místo stylized environmentu,
- klient dodává vlastní basemesh,
- potřebuje Wrap / scan / FACS / full character,
- batch produkce,
- vendor/B2B spolupráce,
- remote/worldwide.

## 9.2 WIN SCORE

`WIN SCORE 0–100`

Není to statistická pravděpodobnost výhry.

Je to heuristický **opportunity attractiveness / competitiveness score**.

UI musí vysvětlovat:

> Win Score is a heuristic opportunity score, not a guaranteed probability of winning.

Doporučená orientační váha:

- capability match: 25 %
- relevant proof / credentials: 15 %
- ability to cover requested scope end-to-end: 15 %
- buyer fit (studio/vendor/B2B): 10 %
- remote/worldwide eligibility: 10 %
- commercial attractiveness / budget: 10 %
- freshness: 5 %
- contactability: 5 %
- competition / friction: 5 %

Váhy držet konfigurovatelné.

## 9.3 Barvy

Doporučené MVP pásmo:

- `80–100` → 🟢 HIGH
- `60–79` → 🟡 MEDIUM
- `0–59` → 🔴 LOW

Fit a Win Score zobrazuj odděleně.

---

# 10. Budget

Budget je důležitý, ale aplikace nesmí prezentovat hallucinated částky jako realitu.

Každý budget musí mít provenance:

## `PUBLISHED`

Zdroj skutečně uvádí konkrétní cenu / rate / range.

UI:

`$60–80/h · PUBLISHED`

## `ESTIMATED`

Budget není zveřejněn. Model odhadne rozumné rozpětí podle:

- scope,
- typu assetu,
- seniority,
- počtu assetů,
- typu klienta,
- industry benchmark kontextu,
- dostupných veřejných údajů.

UI:

`Estimated €8k–15k · ESTIMATED · medium confidence`

Musí být k dispozici krátké `budget_reason`.

## `UNKNOWN`

Pokud je dat příliš málo, napiš `Budget unknown`.

Raději UNKNOWN než falešně přesný odhad.

---

# 11. Kontaktní e-mail

U každého výsledku je ideálně:

```text
contact@company.com    [COPY]
```

Pravidla:

1. používat jen veřejně publikovaný e-mail,
2. uložit URL, odkud byl kontakt získán,
3. nikdy neodvozovat e-mail ze vzoru `firstname.lastname@company.com`,
4. nikdy nevymýšlet adresu,
5. pokud není veřejný e-mail:

`Email not publicly available`

A nabídnout:

`OPEN APPLY PAGE` / `OPEN CONTACT PAGE`.

Kontaktní osoba a role jsou bonus, pokud jsou spolehlivě doložené.

---

# 12. Generování obchodní odpovědi

Generování je samostatná placená akce:

`GENERATE RESPONSE`

Nespouštět automaticky pro všechny search results.

## 12.1 Vstup

Model dostane:

- autoritativní 3D.sk company profile,
- pouze schválené credentials,
- celý dostupný text poptávky,
- normalizovaná fakta,
- company/context data ze zdrojů,
- explicitní seznam zakázaných claims.

## 12.2 Výstup

Minimálně:

```text
TO
SUBJECT
BODY
```

TO jen pokud je veřejný e-mail známý.

## 12.3 Styl

Default:

- anglicky,
- profesionální,
- stručný,
- konkrétní,
- bez marketingového balastu,
- ukázat, že jsme četli jejich skutečné zadání,
- zmínit jen ty capabilities, které jsou pro jejich scope relevantní,
- jasně nabídnout další krok.

Ideální délka první odpovědi přibližně 120–220 slov, pokud konkrétní kontext nevyžaduje jinak.

## 12.4 Zakázané chování

AI nesmí:

- vymyslet klienta/reference,
- tvrdit, že 3D.sk něco dělá, pokud to není v profile authority,
- tvrdit konkrétní cenu, která nebyla schválena,
- slibovat konkrétní deadline bez lidského potvrzení,
- tvrdit dostupnost kapacity bez lidského potvrzení,
- zveřejnit NDA projekt,
- tvrdit právní garance mimo skutečně schválený capability text,
- vytvářet falešný personal contact.

## 12.5 CTA

Preferované CTA:

- short call,
- review sample data,
- receive a small test batch,
- discuss pipeline requirements,
- provide scope for quotation.

Např.:

> If useful, we can review a small sample of your source data and confirm the most efficient handoff point in your pipeline before quoting the full batch.

---

# 13. UI MVP

## 13.1 Home

Header:

`3D.SK OPPORTUNITY RADAR`

Primární tlačítko:

`FIND NEW OPPORTUNITIES`

Summary:

```text
Last scan: ...
New: ...
High fit: ...
Contactable: ...
```

## 13.2 Tabulka / cards

Minimální řádek:

```text
[checkbox]
Fit
Win
Title
Company
Type
Budget
Date
Contact
Status
Open
```

Barvy:

- zelená = high,
- žlutá = medium,
- červená = low.

Nepřehánět design. Funkčnost > grafické efekty.

## 13.3 Detail

Detail musí ukázat:

- title,
- company,
- source,
- published/first seen,
- raw/normalized summary,
- `FIT SCORE`,
- `WIN SCORE`,
- `WHY IT FITS`,
- `RISKS / GAPS`,
- budget + provenance,
- location/eligibility,
- contact,
- apply/source link,
- status.

Tlačítka:

- `COPY EMAIL`
- `OPEN SOURCE`
- `GENERATE RESPONSE`
- `COPY SUBJECT`
- `COPY RESPONSE`
- `INTERESTING`
- `CONTACTED`
- `IGNORE`

## 13.4 Statusy

MVP:

- `NEW`
- `INTERESTING`
- `CONTACTED`
- `IGNORE`

Volitelně později:

- `WON`
- `LOST`

---

# 14. Deduplikace a historie

Search nesmí při každém spuštění tvrdit, že všechno je nové.

Uchovávej:

- canonical URL,
- fingerprint title/company/source,
- first_seen,
- last_seen,
- status.

Doporučený fingerprint fallback:

```text
normalized(company + title + source_domain)
```

Pokud se stejná nabídka objeví na pěti agregátorech, preferuj originální zdroj a zobraz ji jen jednou.

---

# 15. Doporučená architektura

Priorita je jednoduchost.

```text
PRIVATE/PUBLIC GITHUB SOURCE REPO
        ↓
      NETLIFY
        ↓
      FRONTEND
        ↓
  NETLIFY FUNCTIONS
     ↙       ↘
OpenAI API   persistent store
+ web search / retrieval
```

## Frontend

Může být velmi malý vanilla/Vite frontend nebo jiná lehká varianta. Nezavádět framework jen kvůli módě.

## Backend

Server-side functions:

- `POST /api/search`
- `POST /api/generate-response`
- `POST /api/opportunity-status`
- `GET /api/opportunities`
- volitelně `GET /api/opportunity/:id`

## Persistence

Použít nejjednodušší site-wide persistentní storage podporované zvoleným Netlify setupem, např. Netlify Blobs, pokud je pro použitý runtime aktuálně vhodné.

Nezavádět Supabase do MVP, pokud se neukáže skutečná potřeba.

---

# 16. OpenAI / AI orchestrace

Před implementací ověř aktuální oficiální OpenAI dokumentaci a používej aktuálně podporovaný endpoint/model/tooling.

Princip:

## Search stage

- web discovery,
- extraction,
- source capture,
- normalizace,
- dedupe,
- initial relevance.

## Scoring stage

- company-profile comparison,
- fit score,
- win score,
- risks,
- budget handling.

## Reply stage

Spustit pouze na požádání pro vybranou nabídku.

Použij strukturovaný output/schema, aby backend nemusel parsovat volný text.

---

# 17. Cost control

MVP má být levné.

Pravidla:

- žádné automatické background search runy,
- žádné automatické generování e-mailu pro každý výsledek,
- cache/deduplicate staré opportunities,
- levnější model pro extraction/scoring, pokud kvalita stačí,
- kvalitnější model až pro top-level reasoning / reply, pokud je to potřeba,
- uchovávat usage/error telemetry bez secrets.

UI může později zobrazit orientační náklady posledního search runu, ale není to podmínka V1.

---

# 18. Authentication / security

Protože tlačítko SEARCH utrácí API credits, aplikace nesmí být volně zneužitelná veřejností.

MVP nepotřebuje plné user accounts.

Stačí jednoduchá rozumná interní ochrana pro malý tým, implementovaná server-side.

Nikdy neposílej `OPENAI_API_KEY` do browseru.

Všechny placené AI requesty jdou přes server-side function.

Rate limituj search/generation endpointy alespoň základním způsobem.

Repo je při založení PUBLIC. Pokud se později rozhodne ukládat company-private data přímo v repu, nejdřív změnit repository visibility / architekturu. Nikdy nepředpokládej, že přepnutí visibility zpětně odstraní již publikovanou git historii.

---

# 19. Co do V1 NEPATŘÍ

Bez explicitního požadavku neimplementovat:

- Outlook API,
- Gmail API,
- automatické SEND,
- automatické follow-upy,
- kompletní CRM,
- pipeline pro sales sequences,
- LinkedIn browser scraping,
- browser automation obcházející login/ToS,
- multi-tenant auth,
- billing,
- Supabase,
- komplexní role/permissions,
- Slack/Teams integraci,
- automatické každodenní background runy,
- mobilní native app,
- rozsáhlý admin panel.

V1 má dělat jednu věc velmi dobře.

---

# 20. Datový profil 3D.sk

Implementuj autoritativní profile schema oddělené od promptů.

Doporučený koncept:

```json
{
  "company": "3D.sk",
  "capabilities": [],
  "credentials": [],
  "restricted_claims": [],
  "preferred_opportunities": [],
  "excluded_opportunities": [],
  "reply_rules": {},
  "scoring_weights": {}
}
```

Každý capability item může mít:

```json
{
  "id": "wrap_client_basemesh",
  "label": "R3DS Wrap to client-provided production basemesh",
  "status": "APPROVED",
  "outbound_safe": true
}
```

Credential:

```json
{
  "id": "credit_example",
  "label": "Example public AAA credit",
  "status": "PUBLIC_APPROVED",
  "verification_url": "https://...",
  "outbound_safe": true
}
```

Restricted claim:

```json
{
  "id": "unapproved_current_project",
  "rule": "Never mention unless explicitly promoted to PUBLIC_APPROVED"
}
```

---

# 21. Error handling

Fail safely.

Pokud search selže:

- zobraz skutečnou chybu v lidsky čitelné podobě,
- nevymaž staré výsledky,
- neoznač failed run jako úspěšný.

Pokud AI vrátí invalid schema:

- maximálně jeden bezpečný structured retry, pokud dává ekonomický smysl,
- jinak fail a zobraz chybu.

Pokud není contact:

- žádná hallucinated adresa.

Pokud není budget:

- `UNKNOWN` nebo jasně `ESTIMATED`.

Pokud není jisté datum:

- zobraz `date unknown` místo vymyšleného data.

---

# 22. Acceptance criteria V0.1

Release je přijatelný, když z jednoho webového linku lze:

### A. Access

- otevřít aplikaci,
- projít jednoduchou interní ochranou,
- API key není viditelný v browseru/repu.

### B. Search

- ručně spustit worldwide search,
- najít reálné aktuální příležitosti,
- u každé uchovat původní source URL,
- zobrazit datum/freshness, pokud je dostupné,
- deduplikovat výsledky.

### C. Relevance

- výsledky jsou scored proti 3D.sk capability profile,
- `FIT SCORE` a `WIN SCORE` jsou odlišné,
- barvy fungují,
- hlavní relevantní kategorie zahrnují full character outsourcing i dílčí scan/Wrap/FACS práce.

### D. Commercial info

- published budget je správně označený,
- estimated budget je správně označený,
- unknown zůstane unknown,
- žádný vymyšlený e-mail.

### E. Detail

- lze otevřít originální zdroj,
- detail vysvětluje `WHY IT FITS`,
- detail ukazuje gaps/risks.

### F. Reply

- uživatel vybere nabídku,
- klikne `GENERATE RESPONSE`,
- vznikne konkrétní anglický subject + body,
- text používá jen schválené claims,
- text je přizpůsobený konkrétnímu inzerátu,
- subject i body lze jedním klikem kopírovat.

### G. History

- lze změnit status,
- druhý search nezobrazuje starou položku jako novou,
- stav je sdílený pro tým.

---

# 23. Doporučené pořadí implementace

## Stage 0 — Foundation

1. načti tento brief,
2. ověř repo/security stav,
3. založ minimální frontend/backend skeleton,
4. přidej env example bez secret hodnot,
5. přidej company profile schema,
6. přidej test fixture opportunities.

## Stage 1 — Static UX

Bez placeného AI:

1. dashboard,
2. opportunity table/cards,
3. detail,
4. fit/win colors,
5. copy buttons,
6. status handling proti mockům.

## Stage 2 — Search backend

1. server-side AI connection,
2. structured search results,
3. source capture,
4. normalization,
5. dedupe,
6. scoring.

## Stage 3 — Persistence

1. first_seen / last_seen,
2. statuses,
3. shared team state,
4. duplicate suppression.

## Stage 4 — Generate response

1. selected opportunity only,
2. approved profile claims only,
3. subject/body,
4. copy UX.

## Stage 5 — Live acceptance

Proveď několik reálných searches a ověř:

- relevance,
- source truth,
- no hallucinated contact,
- correct budget provenance,
- useful reply quality,
- dedupe.

Teprve potom označit V0.1 jako použitelnou.

---

# 24. Definition of success

MVP je úspěšné, pokud uživatel nemusí ručně procházet desítky webů a místo toho může udělat:

```text
OPEN RADAR
→ SEARCH
→ SEE TOP OPPORTUNITIES
→ OPEN ONE
→ COPY CONTACT
→ GENERATE RESPONSE
→ COPY TO OUTLOOK
```

v minimálním počtu kliknutí.

Nejdůležitější metrika není počet features.

Je to:

> Kolik skutečně relevantních a kontaktovatelných obchodních příležitostí systém dokáže najít s minimálním časem člověka.

---

# 25. Instrukce pro prvního implementačního bota

Po načtení repa:

1. neptej se znovu na již definovaný scope,
2. ověř aktuální `main`,
3. načti `AGENTS.md` a tento dokument,
4. zkontroluj aktuální oficiální dokumentaci zvoleného Netlify/OpenAI stacku,
5. nezačínej paid search runem,
6. nejdřív vytvoř bezpečný statický V0.1 skeleton s mock daty,
7. implementuj company-profile authority odděleně od prompt textu,
8. přidej tests pro scoring/provenance/no-hallucinated-contact,
9. pracuj na feature branchi a změny dávej do reviewable PR,
10. nemerguj produkční změny ani nespouštěj placené live AI runy bez toho, aby byl statický základ a cost/security path jasně ověřený.

Hlavní zásada:

**Neoptimalizuj pro technologickou komplexitu. Optimalizuj pro nejkratší cestu od jednoho kliku k reálné obchodní příležitosti a kvalitní odpovědi.**
