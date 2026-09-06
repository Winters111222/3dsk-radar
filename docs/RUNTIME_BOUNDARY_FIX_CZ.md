# Oprava runtime hranic před placenou acceptance

Datum: 2026-09-05. Navazuje na PR #8, head `5d24a9529ab07d25c976be524e1e6c88cd8dfb6c`, a zachovává PR #7.

## Prokázané chyby a oprava

- Moderní Node runtime může poskytovat serverové proměnné přes `process.env` bez globálního `Netlify`. Původní kód v takovém runtime neviděl nastavený team secret. Sdílený serverový adapter podporuje současné i starší rozhraní. Secrets nejsou součástí odpovědí ani klientského bundle.
- Deploy context se získává z druhého argumentu Netlify handleru a předává do repository. `CONTEXT` je build proměnná, nelze ji považovat za garantovanou runtime autoritu. Bez explicitního produkčního kontextu se používá izolovaný deploy store.
- Testovací workspace se odmítá před použitím OpenAI klíče nebo spuštěním placeného runneru, pokud je live AI zapnuté. Vyhodnocení live přepínače je konzistentní i pro `TRUE`.

Oficiální reference:
- https://docs.netlify.com/build/functions/api/
- https://docs.netlify.com/build/functions/environment-variables/
- https://docs.netlify.com/build/data-and-storage/netlify-blobs/

## Ověření bez sítě a placených požadavků

Tři nové regresní testy na původním kódu selhaly a po opravě prošly.
Test persistence používá skutečný instalovaný `@netlify/blobs` SDK s mockovaným HTTP transportem. Ověřuje stejnou produkční storage adresu po změně deploy ID, izolaci preview a acceptance a předání kontextu přes skutečný status handler.

- 68/68 testů PASS.
- Fixture acceptance PASS, `cost_usd: 0`.
- HTTP smoke PASS, 7 cest.
- `git diff --check` PASS.
- Žádný live OpenAI request.

## Aktuální deploy boundary

Při kontrole běží produkční PR #7 `d9bcb308ddccf1dfe6cbf84f6b575410771552a0`, deploy `6a9c0432518d435dfd0743dd`.
Preview PR #8 `6a9c06231b06ac0008665075` selhalo na build pinu v Netlify UI, který povoluje pouze commit PR #7. Nešlo o selhání aplikačních testů.

Před dalším deployem znovu ověřit aktuální PR heads a konfiguraci. Zachovat exact-commit build guard a pouze jej navázat na ověřený release candidate; nesnižovat jej na neomezený build. Nemergovat main.

Cloud Browser načetl produkční UI a cost panel `$0.0000`, ale navigaci `/api/health` odmítl s `ERR_BLOCKED_BY_CLIENT`. To není důkaz aplikační chyby ani PASS endpointu. Chráněné API a reálná Blobs persistence zůstávají neověřené.

Dokončit postup z `PERSISTENT_HISTORY_CZ.md`: izolovaný deployed acceptance workspace, autentizace, zámky AI, bookmark/status/outreach, reload a ověření přežití deploye. Teprve poté vypnout acceptance workspace, provést serverový credential preflight a přesně jeden placený Search a jeden Generate Response dle zadání vlastníka. Bez automatického sendu.
