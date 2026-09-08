# ULTRA MAX Radar — roadmapa a měřitelné milníky

Datum: 2026-09-08

## Cíl

Jedno explicitní kliknutí uživatele vytvoří nový root run a provede několik
perzistentních kol: nativní zdroje, core hosted discovery, procurement a granty,
multijazyčný long tail, schválené social/alert signály, adaptivní follow-up a
detailní ověření. Pravdivost výsledků má přednost před umělým splněním počtu.

LinkedIn zůstává discovery-only přes uživatelský alert nebo ručně předanou URL.
Žádný login scraping ani obcházení přístupových omezení.

## Procentuální roadmapa

| Rozsah | Váha | Stav při založení roadmapy |
|---|---:|---:|
| Existující relevance, provenance, persistence a WIDE_MAX baseline | 35 % | 35 % |
| M1 — durable ULTRA_MAX root-run orchestrátor | 15 % | lokální code-only checkpoint dokončen |
| M2 — nativní CZ/SK/EU procurement a grant collectory | 18 % | 0 % |
| M3 — marketplace a account/permission zdroje | 12 % | 0 % |
| M4 — LinkedIn alert relay a schválené social signály | 8 % | 0 % |
| M5 — adaptivní vícekolový discovery/detail engine | 7 % | 0 % |
| M6 — operator UI, benchmark a produkční acceptance | 5 % | 0 % |

## M1 — durable ULTRA_MAX orchestrátor

Code-only checkpoint zavádí neměnný snapshot sedmi fází, unikátní identitu
každého potvrzeného kliknutí, přesné pořadí, společné hard caps, no-auto-retry
kontrakt, perzistentní request/operation replay, měření usage, terminální cancel
a `UNCERTAIN` hranici po nejasném dispatchi. Neaktivuje endpoint, síť ani placené
AI. Další slice napojí konkrétní zero-cost collectory; autentizované API a operator
UI patří až do samostatně ověřených kroků.

Výchozí hard maximum pro budoucí samostatně schvalovaný produkční run:

- 100 OpenAI requestů,
- 300 hosted web-search calls,
- 200 nativních source requestů,
- 200 kandidátů,
- 100 přijatých radarových výsledků včetně pravdivě označených funding leads,
- 15 USD společný root cap,
- bez automatického retry placeného nebo nejasně přerušeného requestu.

Tyto limity jsou code contract, nikoli souhlas s placeným během nebo aktivací
produkce.

Aktuální Blobs persistence je single-writer checkpoint, nikoli atomický
produkční zámek. Před souběžným nebo placeným provozem musí root run získat
transakční claim, fencing a společnou budget reservation; bez nich zůstane
produkční dispatcher fail-closed.

## Definition of done

- Jeden klik vytvoří právě jeden nový root run.
- Dvojklik stejného request ID pouze načte existující run.
- Každá fáze má vlastní operation/reservation identity a immutable limity.
- Fáze nelze přeskočit ani spustit souběžně v nesprávném pořadí.
- Root budget nelze překročit součtem dílčích kol.
- Přerušený placený krok není automaticky redispatchován.
- Průběžné kandidáty a dokončené fáze lze po reloadu obnovit.
- UI odděluje `THIS RUN`, aktualizace, review, odmítnutí a historii workspace.
