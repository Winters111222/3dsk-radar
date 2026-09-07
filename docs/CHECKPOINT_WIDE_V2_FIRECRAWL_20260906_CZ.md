# Checkpoint — WIDE v2 Firecrawl pre-discovery

**Stav k 6. září 2026: implementováno a lokálně ověřeno; produkčně zamčeno.**

## Co je hotové

`WIDE_INDEX` má volitelnou serverovou Firecrawl pre-discovery vrstvu. Před
pěti existujícími OpenAI hosted-search shardy provede právě pět paralelních,
serverem vlastněných Firecrawl Search requestů:

1. direct marketplaces — index-only,
2. 3D/game communities — index-only,
3. contract portály a veřejné ATS — search + public render,
4. veřejné procurement zdroje — search + public render,
5. vícejazyčný worldwide sweep — index-only.

Firecrawl nápovědy se předají stejnému strukturovanému klasifikátoru. Kandidát
z Firecrawl renderu může projít provenance gate jen při přesné detail URL z
existujících 30 source policies, HTTP 2xx/304, neprázdném markdownu a bez
challenge/login obsahu. Search-only nápověda sama o sobě důkazem není a musí ji
znovu ověřit OpenAI hosted web search.

## Tvrdé hranice

| Hranice | Hodnota |
|---|---:|
| Firecrawl requesty | přesně 5 |
| Firecrawl výsledky na request | nejvýše 8 |
| Firecrawl kredity | nejvýše 26 |
| Firecrawl retry | 0 |
| Časové okno | posledních 30 dní |
| OpenAI WIDE requesty | beze změny, přesně 5 |
| OpenAI hosted web-search calls | beze změny, nejvýše 15 |
| OpenAI rozpočtová rezervace | beze změny, přesně 2 USD |

Klíč se posílá jen v `Authorization: Bearer` headeru. Browser bundle nezná
název ani hodnotu secretu. Po atomickém operation claimu se Firecrawl ani
OpenAI request neopakuje; nejasné přerušení zůstává `UNCERTAIN`.

## Co se neposílá

- login, cookies, formuláře nebo actions,
- CAPTCHA řešení nebo challenge bypass,
- proxy/stealth/fingerprint volby,
- screenshoty, JSON extraction nebo PDF parser,
- libovolná klientem dodaná URL,
- LinkedIn,
- přímý render Upworku, Redditu, Unreal, Polycountu, Blender Artists,
  ArtStation nebo dalších index-only zdrojů.

## Diagnostika

`/api/health` po přesné aktivaci vrací:

- `cloud_browser=FIRECRAWL_READY`,
- `cloud_browser_request_limit=5`,
- `cloud_browser_credit_cap=26`.

Uložený run vrací skutečné `cloud_browser_requests`,
`cloud_pages_rendered`, `firecrawl_credits_used` a per-shard stav. Selhání
jednoho Firecrawl shardu je viditelný `PARTIAL` bez retry; OpenAI WIDE část
může pokračovat. Firecrawl-ověřený záznam nese
`source_access_method=FIRECRAWL_SEARCH_PUBLIC_RENDER` a stále vyžaduje ruční
ověření před kontaktem.

## Ověření

- `npm test` — 263/263 PASS,
- `npm run build` — PASS,
- `npm run sources:check` — PASS, 0 network/OpenAI requestů,
- `npm run accept:fixture` — PASS, 0 USD.

Mock test dokládá přesně 5 Firecrawl + 5 OpenAI requestů, 26 Firecrawl kreditů,
0 retry a jediný perzistentní merged dataset. Živý Firecrawl ani OpenAI request
v tomto checkpointu spuštěn nebyl.

## Produkční stav a další acceptance

Kód sám nic neaktivuje. Default zůstává:

```text
RADAR_FIRECRAWL_WIDE_ENABLED=false
```

Pro samostatný Deploy Preview a později produkční acceptance budou potřeba
server-side `FIRECRAWL_API_KEY` a přesný gate
`RADAR_FIRECRAWL_MAX_CREDITS=26`. Tento dokument není souhlasem s merge,
produkčním deployem, změnou environmentu ani placeným během.
