# ULTRA MAX — forenzní audit prvního produkčního běhu

Datum: 2026-09-08  
Root run: `542a342a-1b95-4777-bcac-057d28ad23fc`  
Code authority: merge commit `7fad53126771f8a22415de9644b207c3cd28531a`

## Ověřený výsledek

- run skončil `COMPLETED`, bez retry a redispatch;
- native source requesty: `0`;
- strukturovaní kandidáti před truth gates: `10`;
- phase-accepted výskyty: `4`;
- detailně ověřené a nově uložené sales výsledky: `1`;
- workspace sales: `12 → 13`;
- naměřený odhad ceny: `$1.25`.

Jediný nový výsledek je **Create Ultra-Realistic 3D MetaHuman**, Freelancer,
anonymní kupující z Turecka, buyer-published budget `$750–1,500`, fit `84`, win
`57`. Před oslovením stále vyžaduje ruční otevření stejné originální URL.

## Účetnictví devíti nefinálních kandidátů

| Přechod | Počet | Co je prokázáno |
|---|---:|---|
| Kandidáti před truth gates | 10 | Root usage counter |
| Nepřijatí do phase records | 6 | `10 - 4`; odmítnutí normalizací/provenance/truth gates |
| Přijaté phase výskyty | 4 | Součet `results_accepted` discovery fází; není to nutně počet unikátních URL |
| Finální nový sales záznam | 1 | Detail verification + persistence |
| Ostatní nefinální výskyty | 3 | Součet cross-phase duplicit a exact-URL detail rejection |
| Celkem nefinální | 9 | `6 + 3`; bez oslabení truth gates |

Současný produkční snapshot neumožňuje poslední tři pravdivě rozdělit na
duplicity a detail rejecty. Phase payloady jsou v operation Blobs, ale finální
`metadata/last-search` dosud uložil pouze sloučený `source_yield` a prázdný
`rejection_reasons`. Raw kandidáti odmítnutí před normalizací se z důvodu
minimalizace cizího obsahu neukládají. Proto nelze po skončení běhu zpětně
vypsat jejich devět přesných URL a individuální důvody. Jakékoli přesnější
pojmenování by bylo domyšlené.

## Proč výtěžnost klesla

1. Native fáze byla úmyslně přeskočena: katalog neměl jediný
   `runtime_eligible` source. Celý běh tedy závisel na hosted indexu.
2. Šest z deseti modelových kandidátů neprošlo stávajícími truth/provenance
   gates. Gates správně odmítají mimo jiné neověřenou detail URL, employment,
   neaktivní notice, nedoloženou studio eligibility, seller/source-platform,
   software-only práci, vyloučené workflow a geograficky nepřípustný physical
   heritage capture. Historický snapshot ale nezachoval přesné rozdělení těchto
   šesti důvodů.
3. `results_accepted=4` sčítá výskyty napříč discovery fázemi. Opakování stejné
   URL se proto může započítat vícekrát, zatímco detail plan je deduplikuje.
4. Detail verification znovu otevírá přesnou URL a vrátí záznam jen tehdy, když
   stránka aktuálně prokáže buyer identitu, stav, studio eligibility, scope,
   application route a budget provenance. Chybějící nebo rozporuplný údaj
   znamená reject, nikoli doplnění odhadem.
5. Finální persistence ukládá jen detailně ověřené sales records. Competitor,
   source-platform a neověřené potential signals nemohou uměle doplnit kvótu.

## Implementovaná oprava observability

`src/server/ultra-forensic-audit.mjs` nově při finalizaci vytvoří sanitizovaný
forenzní ledger:

- funnel po fázích;
- agregované rejection reasons a source yield;
- accepted URL occurrences a cross-phase duplicity;
- selected / rejected / verified detail kandidáty;
- new / updated persistence;
- matematický `accounting_complete` guard.

Ledger ukládá pouze již přijaté přesné URL a agregované rejecty. Nezačne
uchovávat raw text nebo URL odmítnutých kandidátů. Tato změna opraví příští běh;
nepřepisuje ani nedomýšlí historický produkční run.

## Bezpečnostní závěr

Nízký yield není důvod oslabit truth gates. Následující zlepšení musí přijít z
lepší source vrstvy a z přesnějšího měření, nikoli z přijetí employmentu,
sellerů, expired pages nebo neověřitelných URL.

