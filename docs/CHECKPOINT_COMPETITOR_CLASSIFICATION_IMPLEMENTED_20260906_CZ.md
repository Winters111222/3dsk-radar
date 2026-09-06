# Checkpoint — implementovaná klasifikace konkurentů a zdrojových platforem

Datum: 2026-09-06

## Autorita

- Draft PR: <https://github.com/Winters111222/3dsk-radar/pull/30>
- branch: `feat/worldwide-broad-search-20260906`
- vstupní exact HEAD: `869a356e86af29c77d170e3d6171b3d4bca6b55a`
- implementační commit: `221562f12dff7d61984d845efd9f5b30c2127aaf`
- PR zůstává Draft a nebyl sloučen

Tento checkpoint popisuje pouze code/mock změny. Nebyl změněn Netlify
environment, produkční Blobs ani produkční Search profil a nebylo provedeno
žádné placené OpenAI volání.

## Implementovaný výsledek

### Samostatná serverová osa

Normalizovaný record má nově explicitní:

```text
record_kind = SALES_OPPORTUNITY | COMPETITOR | SOURCE_PLATFORM
```

`opportunity_kind` je nenulový pouze pro `SALES_OPPORTUNITY`. Starý uložený
record bez `record_kind` se při čtení zpětně kompatibilně považuje za
`SALES_OPPORTUNITY`; čtení samo žádnou produkční reklasifikaci nezapisuje.

### Deterministická klasifikace

Nový serverový klasifikátor běží před sales truth gate:

- `SELLER` nebo generic services/portfolio/pricing stránka bez konkrétního
  buyer signálu → `COMPETITOR`,
- job board/agregátor/ATS identita nebo popis platformy bez originální buyer
  poptávky → `SOURCE_PLATFORM`,
- generic `PARTNER` bez aktuálního subcontract/vendor/overflow signálu se
  odmítne,
- seller/partner s konkrétním aktuálním vendor, supplier, subcontracting,
  procurement nebo overflow signálem může pokračovat jako samostatný sales
  record s rolí `PARTNER`,
- originální employer detail na veřejném ATS zůstává možný sales kandidát;
  ATS samotné se nestane buyer company.

Klasifikace není převzata pouze z modelu. Runtime ji znovu určuje z role,
identity zdroje, URL typu stránky a omezeného souboru konkrétních textových
signálů.

### Search limity a persistence

Normalizer nyní odděluje:

- `records` — všechny auditovatelné klasifikované records,
- `opportunities` — pouze sales výsledky,
- `competitors` — intelligence records,
- `source_platforms` — provenance/diagnostické records.

Competitor ani source-platform record:

- nezabírá konfigurovaný sales `maxResults`,
- nevstupuje do Opportunities, buyer Companies, High Fit, New/Updated sales
  ani sales workspace counteru,
- má samostatné agregované diagnostické počty,
- zachovává source evidence, `first_seen`, `last_seen`, status, bookmark a
  existující historická pole.

API přidává obecné pole `records`, ale zachovává `opportunities` jako
backward-compatible alias pro dosavadní klienty.

### Fail-closed sales akce

Backend i browser nezávisle blokují pro `COMPETITOR` a `SOURCE_PLATFORM`:

- Generate Response,
- kontakt/copy kontaktu,
- `MARK EMAIL SENT`,
- ruční source verification určené k odemčení outreach.

Repository kontroluje `record_kind` znovu i při přímém interním volání. Čtení
nesales recordu skryje starý kontakt a starý reply draft, ale raw uloženou
historii nemaže. Změna intelligence statusu proto historická pole nezničí.

### UI

- přidána samostatná záložka `COMPETITORS`,
- přidán competitor counter,
- default `ALL`, `BOOKMARKED`, `OPEN OPPORTUNITIES` a `POTENTIAL LEADS`
  obsahují pouze sales records,
- source platforms nejsou v obchodní tabulce a jsou vidět jen agregovaně v
  Search diagnostics,
- competitor detail je zřetelně označen `INTELLIGENCE ONLY` a nemá aktivní
  sales tlačítka.

### Audit a budoucí migrace

Přidán čistě read-only příkaz:

```text
npm run report:competitors -- /path/to/read-only-opportunities-snapshot.json
```

Report nevykonává write a u každého záznamu vypíše současný/proposed
`record_kind`, klasifikační důvod a stav sales action locku.

Po dodání team kódu byl nad autentizovaným `GET /api/opportunities` proveden
read-only audit všech sedmi produkčních records. Snapshot nebyl uložen do
repozitáře a team kód nebyl zapsán do souboru, logu, dokumentace ani Git
historie. První audit odhalil legacy regresi: spekulativní text
`potential subcontracting / overflow lead` byl příliš volně považován za
konkrétní buyer demand a některé product/service stránky stále procházely jako
sales.

Klasifikátor byl proto zpřesněn obecnými pravidly, nikoli seznamem konkrétních
firem:

- subcontract/overflow je buyer signál jen při explicitním `seeking`, `need`,
  `request` nebo `invite` kontextu,
- game-production service page je seller signal,
- third-party marketplace product detail je seller record, pokud na něm není
  konkrétní buyer demand,
- commercial/enterprise product nebo service offering je seller signal.

Opakovaný read-only audit pak vrátil:

- 3 × `SALES_OPPORTUNITY`,
- 3 × `COMPETITOR`,
- 1 × `SOURCE_PLATFORM`,
- 0 × manual review,
- `writes_performed: 0`.

Chráněný produkční snapshot ani nově zjištěné neveřejné detaily nejsou v tomto
PUBLIC repozitáři zveřejněny. Produkční reclassification write nebyl proveden.

Čistá `reclassifyStoredRecord()` funkce a mock test dokazují, že budoucí
jednorázová migrace:

- je idempotentní,
- zapíše `classification_history`,
- zachová původní `opportunity_kind` v audit eventu,
- zachová `first_seen`, `last_seen`, status, bookmark metadata, contact history
  a staré reply pole.

Žádný produkční migrační endpoint ani automatický write nebyl přidán.

## Sanitizované regresní fixtures

Fixture dataset obsahuje:

- Kabum-like synthetic seller/service page → `COMPETITOR`,
- Outscal-like synthetic archived job aggregator/ATS dataset →
  `SOURCE_PLATFORM`,
- skutečný synthetic buyer brief na marketplace/ATS → nadále sales,
- synthetic competitor s konkrétním subcontract/overflow signálem → může být
  `POTENTIAL_LEAD`.

Fixtures nekopírují cizí text z Kabum ani Outscal.

## Ověření

Na implementačním stromu:

- `npm test` → **240/240 PASS**,
- `npm run build` → PASS,
- `npm run accept:fixture` → PASS, `cost_usd: 0`,
- `npm run accept:http` → PASS, 7 HTTP paths a 6 fixture records,
- `node --check src/app.js` → PASS,
- `git diff --check` → PASS,
- read-only fixture audit → 4 sales, 1 competitor, 1 source platform, 0 writes,
- read-only produkční audit → 3 sales, 3 competitors, 1 source platform,
  0 manual review, 0 writes.

## Co následuje

1. Ověřit GitHub CI a automatický Netlify Deploy Preview nového exact PR HEADu.
2. Teprve po samostatném explicitním souhlasu připravit přesně omezenou,
   idempotentní produkční reclassification migraci s readbackem a bez mazání.
3. WIDE_INDEX paid run, produkční env změna a merge PR #30 zůstávají mimo tento
   checkpoint.
