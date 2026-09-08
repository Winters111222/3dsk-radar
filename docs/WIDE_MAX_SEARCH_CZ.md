# WIDE_MAX — maximum hosted-index search

**Implementační kontrakt · 8. září 2026**

## Účel

`WIDE_MAX` je ručně spouštěný nejširší profil Radaru pro situaci, kdy je
prioritou nezmeškat relevantní veřejnou nabídku v definovaném scope 3D.SK.
Nenahrazuje `WIDE_INDEX`; přidává samostatnou denní identitu a výrazně větší
discovery rozpočet.

Profil používá pouze OpenAI hosted web search nad serverovým allowlistem.
Neaktivuje Firecrawl, Bluesky, sociální konektory, přímé platformové API,
přihlášení ani vlastní HTTP crawl.

## Pevné hranice

| Hranice | WIDE_MAX |
|---|---:|
| Tematické/source/language shardy | přesně 25 |
| OpenAI Responses requesty | nejvýše 25 |
| Hosted web-search calls | nejvýše 75 |
| Web-search calls na shard | nejvýše 3 |
| Kandidáti z jednoho shardu | nejvýše 6 |
| Kandidáti před společnou normalizací | nejvýše 150 |
| Přijaté uložené výsledky | nejvýše 100 |
| Souběžné OpenAI requesty | nejvýše 5 |
| Rozpočtová rezervace | přesně 5 USD |
| Automatický retry | 0 |
| Frekvence | jeden koordinovaný run za UTC den |

Pět souběžných workerů zpracuje 25 shardů v nejvýše pěti vlnách. Selhání se
nezopakuje a zůstane viditelné v coverage diagnostice. Úspěšné shardy se
sloučí, projdou společnou deduplikací a relevance/truth/freshness pravidly.

## Rozdělení pokrytí

Shardy nejsou pětadvacet kopií stejného dotazu. Oddělují:

- human face/body capture,
- casting + capture a human AI/computer-vision datasety,
- RealityCapture rekonstrukci,
- Faceform Wrap3D/R3DS Wrap práci,
- ZBrush scan cleanup,
- Substance Painter scan texturing,
- batch scan postprodukci,
- realistic-human vendor a digital-double poptávky,
- community production overflow,
- tři skupiny veřejných ATS,
- TED, Czech NEN a Slovak ÚVO cultural-heritage procurement,
- globální a UN procurement,
- UK remote heritage postprocessing,
- samostatné anglické, německo-francouzské,
  španělsko-italsko-portugalské, polsko-česko-slovenské a japonské sweepy.

## Scope a relevance

Autoritativní workflow zůstává:

`RealityCapture → ZBrush → Substance Painter → Faceform Wrap3D / R3DS Wrap`

Blender může být doplňkový. Reallusion Character Creator/CC3/CC4, iClone a
Daz3D/Daz Studio jsou vyloučené workflow. Běžné zaměstnanecké pozice bez
explicitní contract/vendor/outsourcing cesty se nepřijímají.

Worldwide je povolené human capture/casting, AI dataset capture a remote scan
postprocessing. Fyzické skenování muzejních předmětů a kulturního dědictví je
omezené na Česko a Slovensko; mimo CZ/SK lze přijmout pouze vzdálené zpracování
dat výslovně dodaných kupujícím.

## Aktivace

Profil je READY pouze pro přesnou trojici:

```text
RADAR_PRODUCTION_SEARCH_PROFILE=WIDE_MAX
RADAR_PRODUCTION_SEARCH_MAX_USD=5.00
RADAR_PRODUCTION_SEARCH_MAX_RESULTS=100
```

Jakýkoli jiný limit vede k `CONFIG_BLOCKED`. `RADAR_FIRECRAWL_WIDE_ENABLED`
musí být pro `WIDE_MAX` false. Search musí být ručně spuštěný a produkční
`Generate Response` zůstává samostatný.

## Omezení úplnosti

Vyšší počet specializovaných dotazů výrazně rozšiřuje pokrytí, ale žádný
hosted web index negarantuje úplný seznam celého internetu. Dlouhodobou
úplnost zvyšují hlavně opakované denní běhy, deduplikace a pozdější samostatně
schválené oficiální zdroje; nejsou součástí tohoto profilu.
