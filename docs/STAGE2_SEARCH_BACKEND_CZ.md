# 3D.SK Opportunity Radar — Stage 2 Search Backend

Datum checkpointu: 2026-09-05

Branch base: `f55bc0a2cd4392f8902a83318b61630ad405e086` (`feature/stage0-stage1-static-radar-20260905`)

## Stav

Stage 2 server-side search path je implementovaný a otestovaný **bez skutečného placeného OpenAI/web-search runu**.

Statický Stage 1 fixture režim zůstává jako nulově nákladný regression fallback. Kliknutí `FIND NEW OPPORTUNITIES` je ve Stage 2 připojeno na server-side `POST /api/search`, ale request proběhne pouze po explicitním kliknutí uživatele a s platným interním access kódem.

## Implementovaný flow

```text
USER CLICKS FIND NEW OPPORTUNITIES
→ browser sends Bearer team access code to /api/search
→ Netlify Function validates server-side access gate
→ function loads PUBLIC_SAFE 3D.sk company profile
→ OpenAI Responses API
→ hosted web_search
→ strict JSON Schema output
→ source URL allowlist from actual web_search_call sources
→ fail-closed normalization
→ canonical URL + within-run dedupe
→ deterministic WIN band
→ DISPLAY in existing Stage 1 UI
```

## OpenAI contract

Ověřeno proti aktuální oficiální dokumentaci dne 2026-09-05.

- Responses API
- hosted web search tool
- Structured Outputs přes `text.format.type = json_schema` a `strict = true`
- default cost-sensitive model: `gpt-5.6-luna`
- model je přepsatelný přes `OPENAI_SEARCH_MODEL`
- `store: false`
- `reasoning.effort: low`
- maximálně jeden structured retry, pouze pokud první odpověď neprojde server-side validačním kontraktem

Relevantní oficiální dokumentace:

- https://developers.openai.com/api/docs/models/gpt-5.6-luna
- https://developers.openai.com/api/reference/

## Netlify contract

Secrets nejsou v `netlify.toml` ani browser bundle.

Server-side environment variables:

```text
OPENAI_API_KEY
RADAR_INTERNAL_ACCESS_SECRET
```

Nesecret tuning:

```text
OPENAI_SEARCH_MODEL=gpt-5.6-luna
RADAR_SEARCH_MAX_RESULTS=12
RADAR_SEARCH_COOLDOWN_SECONDS=30
```

`config/company-profile.public.json` je přibalen do Function bundle přes `included_files`, aby zůstal jedinou autoritou pro public-safe capability/credential data.

Oficiální Netlify dokumentace ověřená 2026-09-05:

- https://docs.netlify.com/build/functions/environment-variables/
- https://docs.netlify.com/build/functions/configuration/

Synchronní Netlify Function má aktuálně 60s execution limit. OpenAI HTTP request má proto fail-closed timeout 52s. Background paid run se nepoužívá.

## Source truth / anti-hallucination gate

Modelový JSON sám o sobě není považovaný za důkaz.

Backend nejdřív z `web_search_call` získá URL skutečně vrácené hosted web searchem. Potom:

1. `source_url` musí po normalizaci přesně existovat v tomto source allowlistu, jinak se opportunity zahodí.
2. Tracking parametry se odstraní, ale destination path se nevymýšlí.
3. `contact_email` přežije pouze pokud má `contact_email_source` a tato URL je také v source allowlistu.
4. Pokud contact provenance neprojde, e-mail se nastaví na `null`.
5. `apply_url`, který není ověřený, se nahradí ověřeným `source_url`.
6. Nevalidní `ESTIMATED` nebo `PUBLISHED` budget failne na `UNKNOWN`, ne na odhadovanou realitu.
7. WIN band se nebere od modelu; server ho deterministicky odvodí z `win_score`.
8. `id`, `canonical_url`, `source_domain`, `first_seen`, `last_seen`, `is_new` a `status` nastavuje server.

## Deduplikace Stage 2

Stage 2 deduplikuje uvnitř jednoho search runu:

1. canonical URL,
2. fallback fingerprint `company + title + source_domain`.

Historická/team-wide deduplikace mezi runy patří do Stage 3.

## Access / rate protection

- interní access code se kontroluje pouze server-side,
- browser ho drží jen v `sessionStorage` daného tabu,
- žádný secret není zadrátovaný do JS,
- endpoint je POST-only,
- Function má jednoduchý warm-instance in-flight lock a cooldown jako základní Stage 2 ochranu.

Tento cooldown není distribuovaný persistentní rate limiter; tvrdší site-wide stav patří do Stage 3 persistence.

## Error handling

- failed search nepřepíše aktuální dataset v UI,
- 401 = invalid internal access code,
- 503 = chybějící server-side access/OpenAI konfigurace,
- 429 = search in flight / cooldown,
- 504 = synchronní timeout,
- invalid source/schema = safe failure, maximálně jeden structured retry.

## UI změny

- Stage 2 label místo fixture-only labelu,
- `TEAM ACCESS CODE`,
- live search status a verified-source count,
- `LAST SCAN` summary card,
- explicitní source evidence v detailu,
- fixture data se zobrazují do prvního úspěšného live runu,
- `GENERATE RESPONSE` zůstává disabled pro Stage 4,
- status zůstává browser-local do Stage 3.

## Test evidence

Lokální ověření před push:

- `node --test tests/*.test.mjs` → **34/34 PASS**
- `node --check` pro browser/server/function/test JS → PASS
- `POST /api/search` end-to-end test přes mockovaný Responses API response → PASS
- test source allowlistu → PASS
- test no-hallucinated-contact → PASS
- test budget fail-closed → PASS
- test max-one-retry → PASS
- test auth-before-paid-path → PASS
- test API key only in Authorization header → PASS

Žádný test neposlal request na OpenAI API.

## Co Stage 2 ještě neprokazuje

Dokud neproběhne první kontrolovaný live acceptance run, není ověřeno:

- reálné chování hosted web search na tomto promptu,
- skutečná relevance nalezených opportunities,
- kvalita OPEN_OPPORTUNITY vs POTENTIAL_LEAD klasifikace v provozu,
- source allowlist shape na reálné Responses API odpovědi,
- reálná latency vůči 60s Netlify Function limitu,
- skutečný počet web-search tool calls / náklad jednoho runu.

Proto je tento checkpoint **Stage 2 implementation-ready, live-acceptance pending**.

## Přesně další krok

1. vytvořit/ověřit Netlify site pro tento repo/branch,
2. nastavit `RADAR_INTERNAL_ACCESS_SECRET` a `OPENAI_API_KEY` pouze server-side,
3. deploynout review branch / preview bez merge do `main`,
4. ověřit `/api/health`,
5. provést přesně jeden kontrolovaný live search run,
6. ručně zkontrolovat source truth, relevance, contact provenance, budget provenance a latency,
7. podle výsledku buď Stage 2 uzavřít, nebo opravit kontrakt bez rozšiřování scope,
8. potom Stage 3: shared persistence, first_seen/last_seen/status/history a cross-run dedupe.
