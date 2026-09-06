# Předání pro nové vlákno — WIDE_INDEX a competitor classification

> Aktualizace 6. 9. 2026: competitor/source-platform balík níže byl
> implementován v commitu `221562f12dff7d61984d845efd9f5b30c2127aaf`.
> Nejdřív načti
> `docs/CHECKPOINT_COMPETITOR_CLASSIFICATION_IMPLEMENTED_20260906_CZ.md`.
> Produkční audit sedmi records byl po autorizovaném read-only načtení dokončen:
> 3 sales, 3 competitors, 1 source platform, 0 manual review a 0 writes.
> Následná obecná legacy-regression oprava má 240/240 testů. Produkční
> reclassification write, placený Search, env změna a merge nebyly provedeny.

Navazuj na projekt **3D.SK Opportunity Radar** v PUBLIC repozitáři:

<https://github.com/Winters111222/3dsk-radar>

Komunikuj s vlastníkem česky. Postupuj autonomně ve vývoji, mock testech,
dokumentaci a Draft PR. Bez nového výslovného souhlasu nic nemerguj do
produkční branche, neměň Netlify environment/secrets a nespouštěj placené
OpenAI volání.

## Autoritativní stav

- aktivní Draft PR: <https://github.com/Winters111222/3dsk-radar/pull/30>
- branch: `feat/worldwide-broad-search-20260906`
- base branch: `fix/buyer-budget-provenance-20260905`
- base SHA: `015d28ac2e0673db1fe1d182e4619a447ccc5750`
- původní wide-search commit: `5be14cde585a96426ccd35b87b97c30f69874988`
- PR je Draft, otevřený a mergeable
- GitHub Actions `Radar CI`: SUCCESS
- automatický Netlify Deploy Preview: SUCCESS
- production site: <https://3dsk-opportunity-radar.netlify.app>
- production site id: `f390f4e9-12f5-4074-946e-c83f2d7fe20d`

Po načtení branche ověř aktuální remote HEAD, protože tento handoff je do PR
přidán následným dokumentačním commitem a přesný nový HEAD bude uveden v
závěrečné zprávě vlákna.

## Povinně načti

1. `AGENTS.md`
2. `README.md`
3. `docs/PROJECT_BRIEF_CZ.md`
4. `docs/PRODUCT_DECISION_SEARCH_SCOPE_CZ.md`
5. `docs/WIDE_INDEX_SEARCH_CZ.md`
6. `docs/CHECKPOINT_COMPETITOR_CLASSIFICATION_20260906_CZ.md`
7. tento handoff

## Co je v PR #30 hotové

Volitelný server-owned profil `WIDE_INDEX`:

- pět paralelních hosted-web-search shardů,
- nejvýše pět OpenAI Responses requestů,
- nejvýše 15 hosted web-search calls,
- nejvýše 24 přijatých výsledků,
- přesná rezervace 2 USD,
- bez retry,
- jeden ručně spuštěný běh za UTC den,
- 30 přísných detail-URL source policies,
- cross-shard dedupe, společné truth/freshness/budget/contact gates,
- viditelná per-shard coverage diagnostika a stav `PARTIAL`,
- žádný login, CAPTCHA bypass, přímý platform crawl ani LinkedIn scraping.

Produkční FOCUSED režim se touto změnou automaticky nemění. WIDE_INDEX se
odemkne jen samostatným přesným environment contractem:

```text
RADAR_PRODUCTION_SEARCH_PROFILE=WIDE_INDEX
RADAR_PRODUCTION_SEARCH_MAX_USD=2.00
RADAR_PRODUCTION_SEARCH_MAX_RESULTS=24
```

Tento environment zatím nenastavuj.

## Nový ruční nález vlastníka

V produkčním workspace je sedm uložených záznamů, ale část starších
`POTENTIAL_LEAD` výsledků jsou zřejmě false positives.

### Kabum

<https://www.kabum.it/game/> je vlastní service page firmy, která nabízí B2B
3D game-art outsourcing, digital humans, photogrammetry a custom assets.
Kabum je `SELLER` / `COMPETITOR`, ne buyer lead. Samotnou stránku neoslovovat.

### Outscal

<https://outscal.com/> je nyní archiv. Jeho OpenJobs projekt je job/ATS
discovery dataset a harvester. Outscal je `SOURCE_PLATFORM`, nikoli buyer
company ani 3D outsourcing competitor. Job hit musí být kanonikalizován na
originální employer/ATS detail; bez něj se odmítne.

## Závazný návrh datového modelu

Nepřetěžuj `opportunity_kind`. Přidej backward-compatible server-owned osu:

```text
record_kind = SALES_OPPORTUNITY | COMPETITOR | SOURCE_PLATFORM
```

`opportunity_kind` (`OPEN_OPPORTUNITY` / `POTENTIAL_LEAD`) je validní pouze pro
`SALES_OPPORTUNITY`.

Konkurence a zdrojové platformy:

- nesmí vstupovat do Opportunities/Companies/High Fit counters,
- nesmí zabírat limit placených sales výsledků,
- nesmí mít odemčený Generate Response, contact ani `MARK EMAIL SENT`,
- mohou být vidět v oddělené záložce `COMPETITORS` pouze pro intelligence,
- musí zachovat source provenance a auditní historii.

## Nejrozumnější další balík

Implementuj do stejného Draft PR #30:

1. `record_kind` schema a legacy fallback `SALES_OPPORTUNITY`.
2. Deterministický seller/service-page gate. Generic portfolio/services/pricing
   stránka nesmí být `POTENTIAL_LEAD`; `PARTNER` vyžaduje konkrétní aktuální
   subcontract/vendor/overflow signal.
3. Source-platform gate: agregátor/ATS nesmí být uložen jako buyer company.
4. Sanitizované regresní fixtures pro Kabum a Outscal, bez kopírování jejich
   cizího textu.
5. `COMPETITORS` tab a samostatný competitor counter; source platforms raději
   zobraz pouze v diagnostics, ne v obchodní tabulce.
6. Backend enforcement, že competitor/source-platform record nikdy nevstoupí
   do reply/outreach endpointu ani sales summary.
7. Read-only auditní report všech sedmi produkčních záznamů. Bez přístupu k
   team secretu nehádej jejich klasifikaci ze screenshotu.
8. Mock migration test: starý Kabum-like lead se reklasifikuje bez smazání
   historie, bookmarků, `first_seen` a `last_seen`.
9. Spusť `npm test`, `npm run build` a `git diff --check`; aktualizuj PR body.

Tento balík je nyní včetně read-only produkčního auditu dokončen. Další krok je
pouze samostatně schválená, přesně omezená idempotentní reclassification
migrace tří competitor records a jednoho source-platform recordu s okamžitým
readbackem a zachováním historie. Bez takového souhlasu zůstanou produkční data
beze změny.

## Co nedělat

- nemazat produkční Blobs ani staré výsledky,
- neprovádět produkční reclassification write bez explicitního souhlasu,
- nespouštět WIDE_INDEX placený test,
- nemergovat PR #30,
- neměnit Netlify environment nebo secrets,
- nezavádět LinkedIn/cloud-browser scraping,
- nezařazovat každé outsourcing studio automaticky jako lead,
- nepovažovat vysoký FIT za buyer intent.

## Acceptance pro competitor balík

- Kabum-like seller page je deterministicky `COMPETITOR`, nikdy lead.
- Outscal-like aggregator je `SOURCE_PLATFORM`, nikdy buyer company.
- Skutečný buyer brief na marketplace/ATS nadále projde.
- Konkrétní doložený subcontracting signal konkurenta může vytvořit samostatný
  `POTENTIAL_LEAD`, ale generic capability overlap ne.
- Sales summary neobsahuje konkurenty ani platformy.
- Kontakt, reply a outreach jsou pro oba nesales druhy fail-closed.
- Staré údaje a company memory nejsou ztraceny.
