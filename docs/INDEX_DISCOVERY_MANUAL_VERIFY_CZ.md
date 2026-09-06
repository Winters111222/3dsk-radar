# INDEX_DISCOVERY_MANUAL_VERIFY

**Bezpečný zprostředkovaný discovery režim · 6. září 2026**

Tento režim dává Radaru omezenou cestu k veřejně indexovaným nabídkám na pěti historicky relevantních Tier A platformách bez přímého crawleru, přihlášení, cookies, session, proxy nebo obcházení technických omezení.

Nejde o schválené API napojení platforem a režim neuděluje právo automatizovat jejich weby ani znovu používat jejich obsah. Je to pouze discovery vrstva: Radar přes OpenAI hosted web search najde odkaz, server ověří doménu a tvar URL a člověk musí před kontaktem otevřít původní stránku a potvrdit, že nabídka stále platí.

## Dvě nezávislé pojistky

1. Responses API dostane `web_search.filters.allowed_domains`, takže hosted search je omezený na pět domén. Aktuální syntaxe filtru je doložená v [oficiální dokumentaci OpenAI Web search](https://developers.openai.com/api/docs/guides/tools-web-search).
2. Backend přijme záznam jen tehdy, když jeho normalizovaný `source_url` pochází ze skutečných výsledků hosted web search a zároveň odpovídá přesnému source-specific detail patternu. Domovské stránky, profily, kategorie, search stránky a lookalike domény se odmítají.

| Zdroj | Povolená doména pro hosted search | Povolený detail nabídky |
|---|---|---|
| Upwork | `upwork.com` | `/freelance-jobs/apply/…` |
| Freelancer | `freelancer.com` | `/projects/…` |
| Reddit | `reddit.com` | `/r/gameDevClassifieds/comments/…` |
| Unreal Engine Forums | `forums.unrealengine.com` | `/t/…` |
| Polycount | `polycount.com` | `/discussion/…` |

Subdomény jako `www` nebo `old` jsou povolené, ale podobně vypadající cizí doména typu `upwork.com.example.org` nikoli.

## Provenance každého výsledku

Server, nikoli model, doplní:

- `discovery_mode: INDEX_DISCOVERY_MANUAL_VERIFY`
- `source_access_method: OPENAI_HOSTED_WEB_SEARCH`
- `discovery_source_id`
- `manual_verification_status: REQUIRED_BEFORE_CONTACT`
- `manual_verified_at: null`
- `direct_source_requests: 0`

UI ukáže `VERIFY SOURCE` a výrazné `MANUAL SOURCE CHECK REQUIRED` s klikacím originálním odkazem. Před oslovením nebo generováním odpovědi má operátor zkontrolovat aktivitu nabídky, scope, remote/B2B eligibility a kontaktní postup přímo na platformě.

## Co režim záměrně nedělá

- nepřihlašuje se k Upworku, Freelanceru, Redditu ani fórům;
- nepoužívá cizí účet, cookies, session, rezidenční proxy ani vzdálený browser;
- neposílá přímé requesty na zdrojové platformy z našeho backendu;
- neobchází robots pravidla, paywall, CAPTCHA ani rate limit;
- neprohlašuje výsledky vyhledávače za právní povolení agregace;
- neaktivuje 49zdrojový WIDE crawl a nemění `runtime_eligible:false` v historickém katalogu.

## Provozní stav

Implementace a testy jsou zero-cost a používají jen mockované Responses API. Žádný nový placený OpenAI běh, Netlify environment změna, produkční deploy ani merge nejsou součástí této změny. Skutečné ověření výtěžnosti vyžaduje nový Git-backed Deploy Preview a samostatné výslovné schválení placeného testu.

Pokud později získáme schválené API nebo písemné povolení konkrétní platformy, dostane samostatný source adapter a vlastní precision benchmark. Tento discovery režim takové povolení nenahrazuje.
