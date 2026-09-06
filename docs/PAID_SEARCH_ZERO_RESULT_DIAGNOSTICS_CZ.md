# Diagnostika nulového placeného Search výsledku

Datum: 2026-09-06

## Proč tato změna vznikla

První jednorázová Phase E acceptance na commitu `3116a7414dc9d99f9361fce2a057a21e224f446d` proběhla bezpečně a za odhadovaných `$0.024955`. Jeden OpenAI Responses request použil dva hosted web-search tool cally, vrátil 29 ověřených source URL, ale žádnou nabídku, která by prošla do výsledků.

Původní run evidence uměla doložit `verified_source_count: 29` a `returned_count: 0`. Neumožňovala však v UI rozlišit dvě zásadně odlišné situace:

1. vyhledávač konzultoval zdroje, ale nevytvořil žádného strukturovaného kandidáta;
2. kandidáti vznikli, ale všichni selhali na konkrétním truth, freshness, scope nebo provenance gate.

Team access kód pouze načítá uložený workspace. Nespouští placené hledání ani nevytváří demo data. Izolované Deploy Preview navíc nesdílí výsledky mezi různými preview deployi.

## Nový uložený kontrakt

Každý nový `INDEX_DISCOVERY_MANUAL_VERIFY` run ukládá do `run.diagnostics`:

- `schema_version: 1`,
- `privacy: AGGREGATED_COUNTS_ONLY`,
- stabilní `zero_result_reason`,
- agregované `rejection_reasons`,
- `source_yield` pro Upwork, Freelancer, Reddit r/gameDevClassifieds, Unreal Engine Forums a Polycount.

Každý source yield obsahuje jen číselné metriky:

- `consulted_urls` — URL z allowlisted domény vrácené hosted search;
- `eligible_detail_urls` — URL odpovídající přesnému povolenému tvaru detailu nabídky;
- `candidates_seen` — strukturovaní kandidáti přiřazení platformě;
- `candidates_accepted` — kandidáti před deduplikací, kteří prošli truth gates;
- `candidates_rejected` — kandidáti odmítnutí backendem;
- `duplicates_removed` — přijaté duplicity odstraněné v rámci běhu;
- `returned` — výsledné příležitosti vrácené uživateli.

## Zero-result důvody

- `NO_STRUCTURED_CANDIDATES` — hosted search konzultoval URL, ale model nevrátil žádného kandidáta do strukturovaného datasetu;
- `ALL_CANDIDATES_REJECTED` — kandidáti existovali, ale žádný neprošel backendovými gates;
- `ALL_ACCEPTED_CANDIDATES_DEDUPLICATED` — přijaté kandidáty odstranila deduplikace.

Souhrnné rejection kódy jsou omezené na stabilní serverový seznam, například:

- `source_not_allowed_for_index_discovery`,
- `seller_not_opportunity`,
- `unknown_commercial_role`,
- `inactive_notice`,
- `studio_ineligible`,
- `out_of_scope`,
- `stale_or_unverified`,
- `excluded_search_category`,
- `normalized_contract`.

## Soukromí a přístupová hranice

Diagnostika záměrně neukládá:

- text odmítnuté nabídky,
- titul nebo firmu odmítnutého kandidáta,
- seznam odmítnutých URL,
- snippets nebo kopie cizích stránek,
- cookies, session, přihlašovací údaje ani obsah za přihlášením.

Nemění se přístupový model: Radar používá pouze OpenAI hosted web search omezený allowlistem, neposílá přímé requesty na platformy a každý přijatý výsledek stále vyžaduje ruční ověření přesné originální URL před Generate Response nebo `MARK EMAIL SENT`.

## Co tato změna nedělá

- nespouští nový placený Search;
- nemění Netlify environment;
- neaktivuje production ani source collection;
- nemerguje review PR;
- neslibuje, že další pilot vrátí nenulový počet příležitostí.

Přínos je měřitelný: pokud další omezený pilot znovu vrátí nulu, výsledek už nebude černá skříňka a další úprava query nebo gate bude vycházet z konkrétního agregovaného důvodu.
