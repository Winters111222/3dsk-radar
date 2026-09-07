# Produkční Search — rozpočtový a idempotentní kontrakt

Datum: 2026-09-06

## Stav této změny

Tato změna pouze připravuje produkční cestu v kódu a mockovaných testech. Sama:

- nemění Netlify environment ani secrets,
- nespouští OpenAI ani přímé requesty na platformy,
- nenasazuje production,
- neodemkne Generate Response,
- nemerguje review branch.

Výchozí hodnoty zůstávají `RADAR_LIVE_AI_ENABLED=false`, `RADAR_PRODUCTION_SEARCH_ENABLED=false` a `RADAR_PRODUCTION_REPLY_ENABLED=false`.

## Produkční Search gate

Placený Search může projít jen pokud současně platí:

1. request je autentizovaný interním team kódem;
2. Netlify runtime context je přesně `production`;
3. `RADAR_LIVE_AI_ENABLED=true`;
4. `RADAR_PRODUCTION_SEARCH_ENABLED=true`;
5. `RADAR_PRODUCTION_SEARCH_MAX_USD` je přesně `0.50` jako rezervace pokrývající doložený worst-case request;
6. `RADAR_PRODUCTION_SEARCH_MAX_RESULTS` je celé číslo `1–6`;
7. atomický Netlify Database coordinator hlásí kompletní readiness;
8. server před OpenAI requestem úspěšně rezervuje celý povolený budget.

Chybějící nebo nebezpečná konfigurace končí před OpenAI dispatch.

## Jeden placený běh za UTC den

Server, nikoli browser, odvodí identitu z UTC data:

```text
run_id         = prod-search-YYYYMMDD
operation_id   = daily-focused-search
reservation_id = daily-focused-budget
```

První platný klik v daném UTC dni může získat atomický claim a budget rezervaci. Další stejné nebo souběžné kliknutí:

- nikdy neotevře druhý OpenAI request;
- po dokončení vrátí uložený výsledek s `replayed:true`;
- během rozpracovaného nebo `UNCERTAIN` běhu failne bez redispatch;
- nemůže podvrhnout vlastní run ID, operation ID ani vyšší budget v request body.

Jde o kalendářní UTC okno, ne klouzavých 24 hodin. Maximální technický strop při konfiguraci `0.50` je jeden rezervovaný běh za UTC den.

## Pevné request hranice

Jeden produkční běh používá:

- model `gpt-5.6-luna` s lokálním pricing snapshotem;
- právě jeden OpenAI Responses request;
- nula structured retry;
- maximálně tři hosted `web_search` tool cally;
- maximálně šest výsledků;
- maximálně 8 000 output tokenů;
- `store:false`;
- přesný allowlist pěti Tier A domén;
- nula přímých source-adapter requestů.

Po odpovědi se usage přepočítá lokálním cenovým modelem. Neznámý model, chybějící pricing nebo odhad nad rezervací skončí jako `UNCERTAIN` bez automatického retry.

## Persistence a source truth

Úspěšné výsledky se merge-nou do site-wide produkčních Netlify Blobs a zachovají cross-run deduplikaci, `first_seen`, `last_seen`, statusy, bookmarky a company outreach historii. Hosted-search výsledky nadále vyžadují ruční ověření přesné originální URL před Generate Response nebo `MARK EMAIL SENT`.

## Generate Response zůstává oddělený

Globální live-AI flag už sám nestačí k odemčení odpovědí. Endpoint navíc vyžaduje `RADAR_PRODUCTION_REPLY_ENABLED=true` a přesný production context. Tento flag má zůstat `false`, dokud nebude pro Generate Response doplněný a samostatně přijatý rozpočtový/idempotentní limit.

## Budoucí produkční aktivace

Po zeleném review a explicitním schválení exact commitu lze provést Git-backed production deploy a nastavit pouze:

```text
RADAR_LIVE_AI_ENABLED=true
RADAR_PRODUCTION_SEARCH_ENABLED=true
RADAR_PRODUCTION_SEARCH_MAX_USD=0.50
RADAR_PRODUCTION_SEARCH_MAX_RESULTS=6
RADAR_PRODUCTION_REPLY_ENABLED=false
```

Poté se nejdřív provede read-only health kontrola. První produkční klik je samostatná placená akce a nesmí být spuštěný automaticky deployem ani acceptance skriptem bez nového přesného souhlasu.
