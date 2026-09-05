# Stage 0 + Stage 1 — implementation checkpoint

Tato větev implementuje pouze bezpečný statický základ. Neprovádí žádný placený OpenAI ani live web-search request.

## Implementováno

- vanilla statický frontend bez frameworku a bez runtime dependencies,
- Netlify Functions health skeleton (`/api/health`) bez secrets a bez externích callů,
- `.env.example` pouze s prázdnými server-side názvy proměnných,
- autoritativní `config/company-profile.public.json` oddělený od budoucích promptů,
- company-profile a opportunity JSON Schema,
- čtyři explicitně syntetické fixture opportunities na rezervované `example.com` doméně,
- UI pro `OPEN_OPPORTUNITY` vs `POTENTIAL_LEAD`,
- FIT SCORE a WIN SCORE s HIGH/MEDIUM/LOW pásmy,
- budget provenance `PUBLISHED / ESTIMATED / UNKNOWN`,
- contact provenance a fail-closed text `Email not publicly available`,
- detail s WHY IT FITS, RISKS/GAPS, source/freshness a location restriction,
- statusy `NEW / INTERESTING / CONTACTED / IGNORE`, zatím pouze browser-local preview persistence,
- Copy Email pouze tam, kde fixture obsahuje explicitní source provenance,
- viditelné, ale záměrně disabled `GENERATE RESPONSE`, `COPY SUBJECT`, `COPY RESPONSE`,
- testy pro score bands, datový contract, budget provenance, contact safety, public-safe company profile a env/browser secret hygiene.

## Záměrně neimplementováno

- skutečný worldwide search,
- OpenAI API request,
- response generation,
- site-wide shared persistence/dedupe,
- produkční server-side internal access,
- jakékoli automatické e-mailové odesílání.

Klientský fake-login nebyl přidán, protože by vytvářel falešný pocit bezpečnosti. Produkční access musí být server-side před zapnutím placených endpointů.

## Acceptance mapping

Statické UI a model již reprezentují pole a stavy potřebné pro V0.1 acceptance contract. Reálné acceptance body A/B/F/G vyžadující autentizaci, live search, server-side reply a shared team persistence zůstávají pro následující backend stages.

## Stage 2 exact scope

1. server-side interní access gate před placenými endpointy,
2. `POST /api/search` přes aktuální OpenAI Responses API,
3. hosted `web_search` pouze po explicitním kliknutí uživatele,
4. Structured Outputs / JSON Schema pro normalizované opportunities,
5. source capture + canonical URL normalization,
6. dedupe funkce a první server-side scoring pass proti `company-profile.public.json`,
7. max jeden bezpečný structured retry při invalidním schema,
8. žádné background paid runy,
9. bez response generation — ta zůstává samostatný pozdější stage/cost boundary.

Stage 2 musí zachovat existující fixture mode pro levné regresní testování UI bez API nákladů.
