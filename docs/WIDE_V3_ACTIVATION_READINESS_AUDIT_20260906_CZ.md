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

- `POST /api/official-source-canary` je dostupný pouze v `deploy-preview` contextu.
- Vyžaduje interní Bearer autorizaci, exact confirmation header a dočasný default-off gate.
- `BLUESKY_ONLY` dovolí přesně 1 source request.
- `BLUESKY_MASTODON` dovolí přesně 2 source requesty a vyžaduje skutečně připravený Mastodon origin + token.
- Endpoint nepoužívá OpenAI, hosted web search, Firecrawl ani persistence a neprovádí retry.
- Odpověď vrací pouze sanitizovaný summary a nejvýše 10 discovery-only, outreach-locked hintů na zdroj.
- X readiness nyní pravdivě hlásí chybějící runtime adaptér a nemůže se tvářit jako aktivovatelný.
- Signal bridge readiness nyní kontroluje společný ingest gate, HMAC secret a příslušné allowlisty/credentials.

## Doporučený aktivační sled

1. Deploy Preview nového exact HEADu a zero-cost locked acceptance.
2. Dočasně pouze pro Deploy Preview nastavit `RADAR_LIVE_AI_ENABLED=false`, canary gate, exact profil a exact request limit.
3. Nejprve jednou spustit `BLUESKY_ONLY`.
4. Pokud je k dispozici Mastodon `read:search` token a schválená instance, v novém samostatně potvrzeném cyklu lze jednou použít `BLUESKY_MASTODON`; nikdy ne jako automatický retry prvního běhu.
5. Okamžitě přečíst `/api/health` a canary výsledek, zkontrolovat počty a discovery-only zámky.
6. Odstranit dočasné canary proměnné a vrátit oba source gates do `false`.

Reddit a Upwork zůstávají další vrstvou až po uživatelem dokončeném oficiálním approval/OAuth procesu. LinkedIn zůstává pouze alert/public-index signál s povinným přechodem na originální buyer/ATS URL. Telegram a Discord pouze pro boty pozvané do explicitně allowlisted kanálů. X zůstává mimo aktivaci do samostatného cenového a implementačního schválení.
