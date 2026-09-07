# WIDE V3 — activation-readiness audit

Datum: 2026-09-06

## Autorita a rozsah

- stacked na Draft PR #31, exact base `416073d3e5192648e670bc15d2949911339ba5d9`,
- pouze repository hardening a mock/fixture testy,
- bez merge, produkčního deploye, změny Netlify environmentu, Blobs zápisu, OpenAI volání a live source requestu.

## Zjištění

Čtyři přímé adaptéry (Upwork, Reddit, Bluesky a Mastodon) už byly implementované jako discovery-only, jeden request na adaptér, bez retry a bez ukládání raw payloadu. Chyběl však samostatný zero-cost endpoint, takže produkční cesta spojovala official-source discovery až s placeným WIDE V3 OpenAI během.

Readiness pro LinkedIn, Telegram a Discord navíc neuváděla společný gate `RADAR_SOURCE_SIGNAL_INGEST_ENABLED`; Telegram a Discord nevyžadovaly ve svém sanitizovaném readiness výstupu společný podpisový secret. X mohl po vyplnění tokenu vypadat jako `CONFIG_READY`, přestože placený runtime adaptér záměrně není implementovaný.

## Repository-only oprava

- `POST /api/official-source-canary` je dostupný pouze v `deploy-preview` nebo v explicitně povoleném Git-backed `branch-deploy` contextu.
- Vyžaduje exact confirmation header, dočasný default-off gate a Bearer autorizaci. Vedle stávajícího interního secretu může pouze tato canary cesta použít dočasný `RADAR_OFFICIAL_SOURCE_CANARY_ACCESS_TOKEN` o délce nejméně 32 znaků.
- `BLUESKY_ONLY` dovolí přesně 1 source request.
- `BLUESKY_MASTODON` dovolí přesně 2 source requesty a vyžaduje skutečně připravený Mastodon origin + token.
- Endpoint nepoužívá OpenAI, hosted web search, Firecrawl ani persistence a neprovádí retry.
- Odpověď vrací pouze sanitizovaný summary a nejvýše 10 discovery-only, outreach-locked hintů na zdroj.
- X readiness nyní pravdivě hlásí chybějící runtime adaptér a nemůže se tvářit jako aktivovatelný.
- Signal bridge readiness nyní kontroluje společný ingest gate, HMAC secret a příslušné allowlisty/credentials.

## Git-backed branch-deploy fallback

Pokud Netlify PR webhook nevytvoří `deploy-preview`, lze použít výhradně Git-backed `branch-deploy` z explicitně zadané review větve. Fallback je samostatně default-off a server před jediným source requestem vyžaduje přesnou shodu read-only Netlify/Git provenance: `REPOSITORY_URL`, `SITE_ID`, `SITE_NAME`, `BRANCH` a čtyřicetiznakový `COMMIT_REF`. Dočasně se zadává pouze očekávaná větev a commit. Immutable URL se ověřuje bez kruhové závislosti přímo z read-only `DEPLOY_ID`: `DEPLOY_URL` musí být přesně `https://<DEPLOY_ID>--3dsk-opportunity-radar.netlify.app`. Produkční kontext, jiný web/repozitář, jiná větev, jiný commit, branch alias nebo manuální deploy bez Git provenance skončí fail-closed.

Fallback nepovoluje placenou Phase E acceptance, databázové zápisy ani obecnou source collection. Po jediném canary requestu se všechny dočasné `deploy-preview`/`branch-deploy` gates odstraní a readback musí znovu potvrdit `LOCKED`.

Dočasný canary token je timing-safe porovnán a je uznán až poté, co projde celý context, provenance, live-AI, enabled, profile, request-limit a connector-readiness policy. V produkčním contextu jej endpoint nikdy nepřijme. Token se nesmí objevit v odpovědi ani logu a musí být po jediném pokusu odstraněn spolu s ostatními dočasnými gates. Ostatní interní endpointy nadále přijímají výhradně `RADAR_INTERNAL_ACCESS_SECRET`.

## Doporučený aktivační sled

1. Deploy Preview nového exact HEADu a zero-cost locked acceptance.
2. Dočasně pouze pro Deploy Preview nebo povolený exact branch deploy nastavit `RADAR_LIVE_AI_ENABLED=false`, canary gate, exact profil, exact request limit a nový náhodný `RADAR_OFFICIAL_SOURCE_CANARY_ACCESS_TOKEN` s nejméně 32 znaky.
3. Nejprve jednou spustit `BLUESKY_ONLY`.
4. Pokud je k dispozici Mastodon `read:search` token a schválená instance, v novém samostatně potvrzeném cyklu lze jednou použít `BLUESKY_MASTODON`; nikdy ne jako automatický retry prvního běhu.
5. Okamžitě přečíst `/api/health` a canary výsledek, zkontrolovat počty a discovery-only zámky.
6. Odstranit dočasné canary proměnné a vrátit oba source gates do `false`.

Reddit a Upwork zůstávají další vrstvou až po uživatelem dokončeném oficiálním approval/OAuth procesu. LinkedIn zůstává pouze alert/public-index signál s povinným přechodem na originální buyer/ATS URL. Telegram a Discord pouze pro boty pozvané do explicitně allowlisted kanálů. X zůstává mimo aktivaci do samostatného cenového a implementačního schválení.

## Runtime provenance: build vs runtime split
- Build-time truth is sealed in `build-metadata.json` during build and includes `deploy_context`, `commit_ref`, `repository_url`, `branch`, `site_name`, `site_id` and `artifact_provenance`.
- Canary policy does not use runtime env variables `BRANCH`, `COMMIT_REF`, `DEPLOY_ID`, or `DEPLOY_URL` for branch-deploy/provenance checks.
- Runtime checks use `context.deploy.context/id` and `context.site.name/id`; `context.site.url` is the general site URL and is not treated as immutable deploy provenance.
- Immutable deploy origin is derived as `https://<deploy.id>--<sealed-site-name>.netlify.app` and compared with the actual incoming `request.url`.
- Branch deploy requests must use that exact HTTPS origin and `/api/official-source-canary` path; aliases, another deploy/site, HTTP, ports, credentials, query strings and fragments fail closed before source dispatch.
- Netlify Function custom route remains a literal string in the exported `config`; a source contract test prevents replacing it with an imported or dynamic expression that the deploy-time route discovery may not register.
- Temporary token is accepted only when all gates pass (preview/branch policy, live-AI lock, profile, limits, connector readiness).
