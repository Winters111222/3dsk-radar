# WIDE V3 — source acquisition pro marketplace a sociální signály

**Repository-only implementace · 6. září 2026**

## Cíl

WIDE V2 prohledá pět obecných okruhů, ale jeho výtěžnost omezuje závislost na
indexu třetí strany. WIDE V3 proto skládá více nezávislých cest:

1. oficiální marketplace/social API,
2. hosted web search nad přesnými doménami,
3. Firecrawl pro veřejné indexování a povolený render,
4. uživatelem autorizované alerty nebo bot eventy,
5. povinné ověření originální buyer/ATS/detail URL,
6. společná freshness, buyer, eligibility, dedupe a competitor klasifikace.

Neexistuje univerzální technika, která bezpečně a dlouhodobě „odemkne“ všechny
platformy. Systém místo toho používá pro každý zdroj jeho podporovaný transport
a explicitní fallback. Neobsahuje heslovou automatizaci, cookies, CAPTCHA bypass,
stealth proxy ani reverzně odvozené neveřejné endpointy.

## Implementované základy

- `src/server/wide-v3-source-plan.mjs`
  - osm oddělených vyhledávacích shardů,
  - nejvýše 8 OpenAI requestů a 24 hosted-search calls v budoucím WIDE V3,
  - seznam osmi source connectorů a sanitizovaný readiness stav,
  - signal-only domény nemohou být samy přijaty jako obchodní nabídka.
- `src/server/official-source-discovery.mjs`
  - Upwork GraphQL `marketplaceJobPostingsSearch`, OAuth2 a tenant header,
  - Reddit OAuth search omezený na `r/gameDevClassifieds`, poslední měsíc,
  - Bluesky veřejný `app.bsky.feed.searchPosts`, řazení `latest`,
  - Mastodon `/api/v2/search`, pouze `statuses`, čistý HTTPS origin,
  - jeden request na volání, žádný retry, 25 výsledků maximum, 2 MB odpověď,
  - normalizace pouze na discovery hints; žádný hint sám neodemkne outreach.
- `src/server/official-source-run.mjs`
  - nejvýše 4 official-source requesty, jeden na každý připravený adaptér,
  - paralelní izolace chyb bez retry,
  - rozdělení hintů do odpovídajících vyhledávacích shardů,
  - do durable run logu ukládá jen agregované stavy a počty, ne cizí text ani token.
- `src/server/source-signal-ingest.mjs` + `/api/source-signal-ingest`
  - HMAC-SHA256 podpis přes timestamp a přesné raw body,
  - pětiminutové časové okno, 64 KiB limit a idempotentní event identity,
  - Telegram/Discord channel allowlist a doménová kontrola source URL,
  - každý přijatý záznam zůstává `discovery_only` a `outreach_locked`,
  - příští WIDE V3 běh načte nejvýše 25 signálů mladších 30 dnů pouze do
    social/multilingual shardu; po ověření je nesmí vrátit se sociální URL jako
    výsledným sales zdrojem.

Lokální public Bluesky canary z CZ execution regionu vrátil 6. 9. 2026 HTTP
403 z CDN a adaptér správně skončil bez retry. Nejde o důvod zdroj zahodit:
produkční aktivace musí nejdřív provést read-only canary z Netlify regionu a při
stejném výsledku použít hosted-index fallback. Health proto nesmí odvozovat
živou dostupnost pouze z toho, že API nevyžaduje token.
- `/api/health`
  - vrací pouze `CONFIG_READY | LOCKED | CONFIG_REQUIRED`, access method a názvy
    chybějících proměnných,
  - nikdy nevrací credential hodnotu.

Produkční dispatcher zná WIDE V3, ale profil je default-off a fail-closed.
Aktivuje se pouze přesným nastavením 3 USD / 32 výsledků, osmi OpenAI requestů,
24 hosted-search calls a nejvýše čtyř official-source requestů. Používá
`gpt-5.6-sol`; volitelný Firecrawl zůstává na samostatném limitu 5 requestů a
26 kreditů. Celý běh sdílí jeden atomický daily claim a budget settlement, bez
retry. Tento commit nic z toho v Netlify nezapíná.

## Přístup po platformách

| Zdroj | Primární cesta | Fallback | Přijetí do sales výsledků |
|---|---|---|---|
| Upwork | Schválené GraphQL API + OAuth2 | Hosted index detailů | Pouze buyer job detail; raw API cache nejvýše 24 h |
| Reddit | Schválené Data API OAuth | Veřejný index konkrétního subredditu | Pouze aktuální paid/hiring post, nikdy `FOR HIRE` |
| LinkedIn | Uživatelův job/post alert + veřejný index | Přechod na employer/ATS URL | LinkedIn post je jen signal; originál je povinný |
| Bluesky | Veřejné AT Protocol search API | Hosted public index | Signal do ruční/originální verifikace |
| Mastodon | Instance API + `read:search` token | Vybrané veřejné hashtag/feed URL | Signal do ruční/originální verifikace |
| X | Oficiální consumption-billed search API | Veřejný index | Default-off paid signal; samostatný budget |
| Telegram | Bot přidaný do allowlisted kanálu/skupiny | Ruční forward do ingestu | Jen zprávy skutečně doručené autorizovanému botovi |
| Discord | Bot pozvaný do allowlisted serveru/kanálu | Ruční webhook/forward | Jen autorizované eventy, žádné procházení cizích serverů |

## Proč LinkedIn neřešíme crawlerem

Oficiální LinkedIn Talent Job Posting API slouží partnerům k publikování nabídek
z ATS; není to veřejné API pro globální stažení LinkedIn Jobs. WIDE V3 proto
LinkedIn používá jako discovery vrstvu. Kandidát musí být dohledán na originálním
webu firmy, ATS, marketplace nebo v přímo doloženém buyer briefu. Tím získáme
většinu obchodní hodnoty bez závislosti na login session a bez rizika, že se
scraper ze dne na den zablokuje.

## Modelová strategie

Samotná výměna Luna za dražší model nezpřístupní chybějící platformní data.
Doporučený pipeline je:

1. deterministic/API discovery bez AI,
2. levná deduplikace a freshness filtr,
3. `gpt-5.6-sol` ověří jednotlivé WIDE V3 coverage shards nad malým počtem hintů,
4. signal-only domény jsou serverem z výsledků znovu odstraněny,
5. přijetí nastane jen při doloženém buyer směru a originálním zdroji.

Tato hybridní varianta zvyšuje recall i precision a neutratí Sol tokeny za
navigaci, seller profily a duplicity.

## Co ještě vyžaduje externí konfiguraci

Před live aktivací je potřeba získat a vložit pouze podporované přístupy:

1. schválený Upwork API OAuth token a tenant ID,
2. schválený Reddit OAuth token pro daný účel,
3. Mastodon `read:search` token a vybranou instanci,
4. pozvat vlastní boty do konkrétních Telegram/Discord kanálů a nastavit jejich
   ID do allowlistu,
5. připojit LinkedIn alert relay k podepsanému ingestu,
6. provést zero-cost Deploy Preview acceptance a až potom samostatně schválit
   Git-backed produkční deploy, environment a jeden placený WIDE V3 běh.

Raw Upwork/Reddit payloady se neukládají; pipeline je používá pouze v paměti
aktuálního běhu a do historie zapíše agregované počty. Tím je jejich životnost
kratší než 24hodinový limit.

Tato repository-only implementace není souhlasem s merge, produkčním deployem,
změnou environmentu ani placeným search během.

## Ověřené primární podklady

- [Upwork API documentation](https://www.upwork.com/developer/documentation/graphql/api/docs/index.html)
- [Upwork API key application](https://www.upwork.com/developer/keys/apply)
- [Reddit Data API Terms](https://redditinc.com/policies/data-api-terms)
- [LinkedIn Talent API catalog](https://developer.linkedin.com/product-catalog/talent)
- [LinkedIn Job Posting API](https://learn.microsoft.com/en-us/linkedin/talent/job-postings/api/overview?view=li-lts-2026-04)
- [Bluesky feed API documentation](https://docs.bsky.app/docs/tutorials/viewing-feeds)
- [Mastodon search API](https://docs.joinmastodon.org/methods/search/)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [Discord API reference](https://docs.discord.com/developers/reference)
- [X Developer Platform](https://developer.x.com/)
