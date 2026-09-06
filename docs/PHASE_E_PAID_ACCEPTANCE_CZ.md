# Phase E — jediný placený FOCUSED acceptance run

Stav k 5. 9. 2026: **placený request zatím neproběhl**. První živý deploy pokus `6a9c7c00b4f573e981ae6d7c` skončil před publikací a odhalil chybný předpoklad v deploy postupu; podrobnosti jsou níže. Dočasné environment proměnné byly po failu odstraněné.

## Výchozí evidence

Phase D skončila PASS na immutable preview `6a9c6ac2f058893e7b937e9e` z exact commitu `6c1516d44d835080d44e8282a233ce26d0cc5f36`: přesně pět HTTP requestů, nula source requestů, nula OpenAI requestů, nula write a nula retry.

Uživatel zvolil existující serverový `OPENAI_API_KEY`. Klíč zůstává jen v Netlify environment; jeho hodnota se nečte, neloguje, nekopíruje do repozitáře a nemění.

## Fail-closed hranice

Paid Search je dostupný jen když současně platí:

1. globální `RADAR_LIVE_AI_ENABLED=false`, takže Generate Response a obecná paid cesta zůstávají zamčené,
2. `RADAR_PAID_ACCEPTANCE_ENABLED=true`,
3. request nese přesný jednorázový `RADAR_PAID_ACCEPTANCE_RUN_ID`,
4. `operation_id` je přesně `focused-search`,
5. request potvrzuje `no_retry:true` a přesný cap `$0.50`,
6. atomický coordinator nad Netlify Database hlásí všechny povinné capability flags.

Jakákoli chybějící nebo odlišná podmínka končí před OpenAI dispatch. Phase E gate je jediná výjimka pro přesně identifikovaný Search request; production environment a production data se nemění.

## Atomický coordinator

Provider používá PostgreSQL transakce `SERIALIZABLE`, durable primary keys pro operation a reservation, monotónní fencing token a transakční budget reservation. Netlify **Deploy Preview** dostane izolovanou Netlify Database branch; výsledky Search se ukládají do deploy-scoped Netlify Blobs. Phase E proto nesmí běžet v `production` ani `branch-deploy` kontextu. Search i coordinator probe tuto podmínku kontrolují server-side ještě před přístupem k OpenAI nebo databázi.

Netlify dokumentace garantuje automatické databázové branche a automatické migrace pro Deploy Previews. Naproti tomu CLI `deploy --alias` vytváří pouze draft URL alias a výslovně nevytváří branch deploy. Phase E proto používá Git-based continuous-deployment cestu existujícího Draft PR; manual upload, MCP ZIP upload a CLI alias jsou zakázané.

Build přijme provenance `NETLIFY_GIT_DEPLOY` jen tehdy, když read-only Netlify metadata současně potvrzují `NETLIFY=true`, `CONTEXT=deploy-preview`, `PULL_REQUEST=true`, neprázdné `REPOSITORY_URL` a `REVIEW_ID` a validní čtyřicetiznakový `COMMIT_REF`. Manual upload tyto podmínky nesplní.

Před placeným requestem musí deployed zero-cost probe proti reálné preview DB prokázat:

- právě jednoho vítěze ze dvou souběžných claimů,
- právě jednoho vítěze ze dvou souběžných rezervací plného budgetu,
- idempotentní settlement,
- nula OpenAI a source requestů.

Po dispatch se operation dokončí jako `COMPLETED`, nebo fail-closed jako `UNCERTAIN`. Stav `CLAIMED`, `COMPLETED` i `UNCERTAIN` zakazuje automatický druhý dispatch. Opakování dokončeného requestu pouze vrátí uložený výsledek.

## Jediný povolený run

Runner `npm run accept:deployed:paid` nemá retry a přijme jen 24znakový immutable deploy subdomain pro site `3dsk-opportunity-radar.netlify.app`. Udělá přesně čtyři operační HTTP requesty:

1. `GET /build-metadata.json` — exact commit, `deploy-preview` context a `NETLIFY_GIT_DEPLOY`,
2. `GET /api/health` — placený acceptance je armed, source collection zůstává locked,
3. `POST /api/paid-coordinator-acceptance` — zero-cost souběžný DB test,
4. `POST /api/search` — jediný placený FOCUSED run.

Placený krok smí vytvořit přesně jeden OpenAI Responses request, maximálně tři hosted `web_search` tool calls, maximálně šest vrácených výsledků, maximálně 8 000 output tokenů, nula přímých source-adapter requestů a nula retry. `store:false` zakazuje ukládání response u OpenAI.

## Cenový strop

Rozpočtová rezervace je přesně `$0.50`. Pro model `gpt-5.6-luna` se používá pricing snapshot z 5. 9. 2026: `$0.20 / 1M` input tokenů, `$0.02 / 1M` cached input tokenů, `$1.20 / 1M` output tokenů a `$0.01` za hosted web-search call. Nad 272 000 input tokenů se podle modelové dokumentace účtuje `2×` input a `1.5×` output. I nejhorší kontext přijatelný pro 1 050 000tokenové okno, maximálně 8 000 output tokenů a tři search calls vychází na `$0.4612`, tedy pod rezervací `$0.50`.

Po odpovědi se skutečná usage z provider response přepočítá stejným snapshotem a atomicky settle-ne. Překročení rezervace nebo chybějící usage/cost evidence ukončí běh jako `UNCERTAIN`; automatický retry je zakázán.

## Neúspěšný deploy cyklus a oprava kontraktu

Jednorázový upload deploy `6a9c7c00b4f573e981ae6d7c` skončil chybou build stage, měl `published_at:null`, `database_branch_id:null` a `database_migrations:null`. Netlify jej navíc označilo jako `context:production`, přestože URL nesla branch alias. Původní produkční deploy `6a9c2e57a312878fd4261bc6` zůstal publikovaný a beze změny. Nebyl proveden coordinator probe, OpenAI request, Blobs write ani databázový write; čtyři dočasné Phase E proměnné byly odstraněné a readbackem ověřené.

Příčina: použitý manual/MCP ZIP upload neměl parametr, který by mohl vytvořit Git-backed Deploy Preview. URL alias není důkaz deploy contextu. Opravený kontrakt:

1. preview smí vzniknout pouze přes Netlify continuous deployment z Draft PR,
2. build metadata musí uvést přesně `deploy-preview`,
3. deploy musí mít neprázdný `database_branch_id` a úspěšnou migraci,
4. runtime handler context musí být přesně `deploy-preview`, jinak health hlásí `CONTEXT_BLOCKED` a oba acceptance endpointy vrátí `PAID_ACCEPTANCE_PREVIEW_REQUIRED` před jakýmkoli write nebo placeným requestem,
5. acceptance používá až immutable permalink konkrétního úspěšného deploye.

Autoritativní Netlify dokumentace:

- https://docs.netlify.com/deploy/deploy-overview/#branches-and-deploys
- https://docs.netlify.com/api-and-cli-guides/cli-guides/get-started-with-cli/#draft-deploys
- https://docs.netlify.com/build/configure-builds/environment-variables/#git-metadata
- https://docs.netlify.com/build/data-and-storage/netlify-database/#database-branching
- https://docs.netlify.com/build/data-and-storage/netlify-database/#automatic-migrations

## Co vyžaduje další explicitní souhlas

Teprve zelené CI a exact commit mohou být podkladem pro jednu přesnou schvalovací větu zahrnující:

- deploy-preview-only nastavení `RADAR_ACCEPTANCE_PROFILE=PAID_FOCUSED`, placených acceptance flags a jednorázového run ID,
- zachování existujícího `OPENAI_API_KEY` a `RADAR_INTERNAL_ACCESS_SECRET` bez čtení, kopírování nebo změny jejich hodnot,
- právě jeden nový Git-backed Deploy Preview exact commitu z existujícího Draft PR,
- automatickou izolovanou preview DB branch a migraci,
- jeden zero-cost coordinator probe,
- právě jeden placený FOCUSED run v uvedených limitech,
- následné znovuzamčení deploy-preview acceptance flags.

Souhlas nesmí zahrnovat production deploy, merge, production data write, source collector dispatch, Generate Response ani odeslání e-mailu.
