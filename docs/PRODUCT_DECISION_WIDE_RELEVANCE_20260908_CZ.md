# Product decision — široká relevance Human Capture + Cultural Heritage

Datum: 2026-09-08

Tento dokument doplňuje `PRODUCT_DECISION_SEARCH_SCOPE_CZ.md`. Rozšiřuje
aktivní Search o doložené obecné capability typy bez zveřejnění neveřejných
klientských referencí.

## Autoritativní workflow

Centrální produkční stack 3D.SK je:

`RealityCapture → ZBrush → Substance Painter → Faceform Wrap3D / R3DS Wrap`

Poptávka nemusí jmenovat konkrétní software, pokud požadovaný výstup zjevně
odpovídá této pipeline. Blender je doplňkový nástroj a Blender-only generalist
práce sama o sobě není relevantní. Reallusion Character Creator (CC3/CC4),
iClone a Daz3D/Daz Studio jsou hard reject; obecné profesní spojení „character
creator“ bez vazby na tento software se automaticky nevyřazuje.

## Pět runtime shardů WIDE_INDEX

1. `human_data_capture_worldwide` — worldwide face/body photogrammetry,
   multi-person a multi-ethnicity datasets, casting + scanning a AI/computer
   vision source capture.
2. `scan_postproduction_worldwide` — vzdálené RealityCapture/ZBrush/Substance
   Painter/Wrap3D zpracování dodaných lidských nebo objektových dat.
3. `character_vendor_pipeline` — jen explicitní vendor, outsourcing,
   subcontract a production-overflow realistic-human poptávky.
4. `cultural_heritage_cz_sk` — fyzická 3D digitalizace muzejních předmětů,
   krojů, textilií, artefaktů a sbírek pouze v ČR/SR; zdroje TED, NEN a ÚVO.
5. `worldwide_multilingual_buyer_sweep` — buyer-demand doplnění v EN, CS, SK,
   DE, FR, ES, IT, PL, PT a JA.

## Povinné odmítnutí

- permanentní nebo běžná zaměstnanecká pozice bez explicitní vendor/contract
  cesty,
- generický Character Artist nebo Blender generalist,
- Reallusion / Character Creator / iClone / Daz3D,
- seller, portfolio, služba k prodeji nebo zdrojová platforma vydávaná za
  kupujícího,
- recruitment účastníků výzkumu nebo samotných modelů bez production-vendor
  scope,
- biometrický dohled a nákup capture hardware,
- document/film scanning, GIS, BIM, budovy, terén a infrastruktura,
- grant nebo strategie bez aktuální poptávky,
- immersive exhibition nebo web bez explicitního 3D capture/postprocess scope.

## Geografický kontrakt kulturního dědictví

Fyzický capture muzejních a kulturních objektů smí projít pouze s místem plnění
v ČR/SR. Worldwide kulturní zakázka smí projít jen jako vzdálená postprodukce,
pokud kupující explicitně dodá existující fotografie, skeny, meshe nebo capture
data.

## Freshness

- aktuální `published_date` → `freshness_confidence: high`,
- aktuální `source_updated_date` → `medium`,
- chybějící/staré datum s ověřeným současným acceptance evidence → `low` a
  serverový Win Score strop 69,
- bez data i bez současného acceptance evidence → reject.

## Provozní hranice

Změna nemění produkční env ani sama nespouští Search. WIDE_INDEX zachovává
nejvýše 5 OpenAI Responses requestů, 15 hosted web-search calls, 24 sales
výsledků, 2 USD, jeden ruční běh za UTC den a žádný retry. Nový acceptance run
nepoužije Firecrawl, Bluesky ani jiné official-source konektory.
