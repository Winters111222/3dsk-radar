# Checkpoint — produkční klasifikace a WIDE_INDEX

Datum: 2026-09-06

## Aktuální bezpečný stav

- Draft PR #30 je otevřený a nebyl mergnut do `main`.
- Async oprava je v exact commitu
  `76d58c9be5a62a73e525ab92410e90c12c672124`; feature i produkční Git branch
  na něj byly fast-forwardnuty bez merge do `main`.
- Produkční site běží v profilu `FOCUSED`, s přesným stropem 0,50 USD a šesti
  sales výsledky.
- Paid acceptance, source collection a production reply zůstávají zamčené.
- Produkční workspace obsahuje 7 records: 3 sales, 3 competitors a
  1 source platform.

## Dokončená jednorázová reklasifikace

Po shodě exact `COMMIT_REF`, snapshot digestu a preflight counters proběhl
právě jeden schválený apply:

- 4 změněné record blobs,
- 1 autoritativní workspace snapshot,
- 0 smazaných records,
- okamžitý strong-consistency readback,
- konečný stav 3 / 3 / 1,
- zachované `first_seen`, `last_seen`, status, bookmark, contact history a
  historická reply pole.

## První WIDE_INDEX produkční pokus

Před placeným během byly dočasně nastaveny přesné WIDE hranice: 2,00 USD,
24 sales výsledků, pět OpenAI Responses requestů, nejvýše 15 hosted-search
calls a nula retry.

První preflight bezpečně odhalil, že FOCUSED a WIDE sdílely denní `run_id`.
Coordinator vrátil `PAID_COORDINATOR_CAP_MISMATCH` ještě před OpenAI dispatch;
náklad byl 0 a workspace se nezměnil. Identita WIDE byla následně oddělena na
`prod-wide-index-search-YYYYMMDD`.

Po této opravě byl odeslán právě jeden reálný WIDE request. Netlify synchronous
gateway ukončila čekání HTTP 504 dříve, než funkce vrátila strukturovaný
výsledek. Request mohl být k OpenAI odeslán, proto je jeho náklad a coordinator
stav veden jako **UNCERTAIN**. Nebyl proveden retry. Okamžitý i pozdější
readback potvrdil, že workspace a poslední uložený search nebyly změněny.

Produkční environment byl ihned vrácen na FOCUSED a exact Git-backed deploy
`6a9d7610fd65e3f317763539` potvrdil commit
`239660f2a6b0281f691e201b415dee7a59bf9fc0`, profil FOCUSED, limit 6 a
0,50 USD.

## Oprava synchronous timeoutu

WIDE se nově spouští explicitním kliknutím přes Netlify Background Function:

- `/api/search-background` přijímá pouze serverově aktivovaný `WIDE_INDEX`,
- background runtime má až 15 minut a klient dostane okamžité HTTP 202,
- existující atomický coordinator stále provádí claim, budget reservation,
  settlement, completion a fail-closed `UNCERTAIN`,
- `/api/search-status` pouze čte server-owned denní identitu a neumožňuje
  retry,
- browser polluje stav a po `COMPLETED` načte autoritativní Blobs snapshot,
- neukončený stav starší než 16 minut se zobrazuje jako `UNCERTAIN` a nic
  automaticky znovu neodesílá,
- FOCUSED běh zůstává jednoduchý synchronní request.

## Ověření a další krok

Async acceptance:

- `npm test` → 253/253 PASS,
- `npm run build` → PASS,
- `npm run accept:fixture` → PASS, 0 USD,
- `npm run accept:http` → PASS,
- Netlify production-context build a bundling 13 functions → PASS,
- syntax checks a `git diff --check` → PASS,
- GitHub Actions `Radar CI` run 114 → SUCCESS,
- Git-backed Deploy Preview `6a9d79818142de00085adf54` → READY na exact
  commitu `76d58c9…`, 13 functions,
- Netlify metadata potvrzuje `search-background` v invocation mode
  `background` a `search-status` v běžném stream mode,
- preview health potvrzuje zamčený Search, paid acceptance, source collection
  i production reply; nebyl odeslán žádný placený request.

Automatický production deploy `6a9d797f2ba8c100077a23da` byl Netlify odmítnut
před buildem hláškou `Skipped due to account credit usage exceeded`.
Publikovaná produkce se proto nezměnila a nadále běží na bezpečném deployi
`6a9d7610fd65e3f317763539`, exact commit `239660f…`, FOCUSED 0,50 USD / 6.
Nebyl použit ruční upload bez `COMMIT_REF` a nebyla změněna data ani environment.

Zbývá doplnit/obnovit Netlify build kredit a znovu výslovně schválit jeden
Git-backed production deploy exact commitu `76d58c9…`. Další placený WIDE pokus
se nesmí provést ve stejném UTC dni jako timeoutovaný request. V novém UTC
okně lze po samostatném přesném schválení dočasně aktivovat exact WIDE
contract, provést jeden background run bez retry, vyčkat na
`COMPLETED | UNCERTAIN` a hned obnovit FOCUSED.

Merge PR #30 zůstává samostatné produktové rozhodnutí až po vyhodnocení
skutečného WIDE výstupu.
