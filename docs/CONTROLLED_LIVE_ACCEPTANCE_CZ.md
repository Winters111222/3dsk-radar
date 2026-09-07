# Controlled live acceptance — 2026-09-05

## Ověřený běh

- Zdroj: exact PR #9 head `bac185ca2b316852024fafd832e6acca23128c08`; GitHub CI `33965476625` SUCCESS.
- Navazuje na PR #6 `e7419e2ecee0d9f29489b6d854ff279dc97e37ba` (ancestor, bez divergentních commitů).
- Před placením dokončena deployed zero-cost acceptance; protokol je v `docs/DEPLOYED_ZERO_COST_ACCEPTANCE_CZ.md` na větvi `checkpoint/work-deploy-20260905`.
- Uživatel ručně uložil OPENAI_API_KEY jako Netlify secret; hodnota nebyla čtena, commitována ani vložena do klienta.
- Modely a pricing ověřeny v oficiálních OpenAI docs: https://developers.openai.com/api/docs/models/gpt-5.6-luna, https://developers.openai.com/api/docs/models/gpt-5.6-sol, https://developers.openai.com/api/docs/pricing.
- Search model Luna, reply Sol, max results 12, cooldown 30 s, jeden povolený structured retry, unknown model pricing N/A.
- Live deploy `6a9c17663835f527e67c1a93`, exact PR #9, published `2026-09-05T13:22:02.373Z`.
- Přesně jedna UI akce FIND NEW OPPORTUNITIES, dokončena kolem 13:23 UTC. Žádné opakování Search ani Regenerate.
- 5 výsledků / 5 firem, všechny POTENTIAL_LEAD, bez duplicit v tomto běhu. 2 výsledky FIT 80+; WIN označen jako HEURISTIC.
- LAST SEARCH COST přešel z `$0.0000` na `$0.0155` EST. COST: model `gpt-5.6-luna`, 1 web-search call, 16 500 total tokens, web-search fee `$0.0100`, token cost `$0.0055`. Odhad, nikoli faktura.
- Přesně jedna UI akce GENERATE RESPONSE pro Kabum, dokončena kolem 13:25 UTC, model `gpt-5.6-sol`.
- Odpověď personalizovaná podle https://www.kabum.it/game/; partnerství formulované jako možnost, nikoli existující poptávka. Claims odpovídají approved public company profilu; žádné vymyšlené reference, cena, termín či dostupnost.
- TO zůstal prázdný: Email not publicly available. Subject: Digital-human and photogrammetry production partnership.
- COPY SUBJECT i COPY RESPONSE: skutečný obsah přečten ze schránky prohlížeče a odpovídal zobrazenému textu. První okamžité čtení subjectu bylo prázdné; čtení po dokončení asynchronního zápisu uspělo.
- Žádný e-mail nebyl odeslán; MARK EMAIL SENT se na skutečných leadech nepoužilo.
- Po obou autorizovaných placených akcích RADAR_LIVE_AI_ENABLED=false, readback potvrzen. Locked deploy `6a9c190263666a3a2cadd2e2`, exact PR #9, published `2026-09-05T13:28:59.865Z`.
- Reload potvrdil Live AI locked, 5 saved team results a zachovaný náklad `$0.0155`.

## Obsahový výsledek: dosud NEPROŠLO

- UneeQ: https://aws.amazon.com/marketplace/pp/prodview-ccbbx2fzo4mps skutečně zveřejňuje roční licenci 240 000 USD a support kontakt. Tato částka ale není rozpočtem kupujícího pro outsourcing. Původní PUBLISHED v poli budget bylo nesprávně. Veřejný support e-mail není ověřený nákupčí.
- Digital Reality Lab: původní `/game-production` při nezávislém otevření vracelo 404; firemní homepage existuje. Původní source truth tedy není plný PASS.
- Kabum: veřejná nabídka game art, digital humans a fotogrammetrie potvrzena; samotná shoda schopností nedokládá aktuální nákupní potřebu.
- Quantic Dream: použit agregátor, originální aktivní poptávka nebyla nezávisle potvrzena. Emerald Wizard Studios: individuální kontrakt; správně pouze POTENTIAL_LEAD, nikoli B2B vendor request.
- Žádný OPEN_OPPORTUNITY nebyl nalezen. Pipeline technicky funguje, ale nákupní relevance výsledků ještě nesplňuje finální kvalitu.

## Oprava bez dalšího placení

- Structured schema nově rozlišuje budget_basis BUYER_PROJECT / SELLER_PRICE / EMPLOYEE_COMPENSATION / UNKNOWN a vyžaduje budget_source_url.
- PUBLISHED/ESTIMATED přežije jen s BUYER_PROJECT a zdrojem vráceným hosted search. Chybějící či nevhodný původ znamená UNKNOWN, částky null.
- Stejná ochrana se aplikuje při čtení uložené historie i podkladu odpovědi. Legacy záznamy bez důkazu buyer budget se zobrazí konzervativně jako UNKNOWN, bez přepisu uložené historie při čtení.
- Odhad vyžaduje skutečné číselné hranice; null se již nekonvertuje na nulu.
- Search instrukce upřednostňují poptávku kupujících, požadují otevřít originální zdroj a nepovažovat pouhou nabídku dodavatele za doložený obchodní signál.
- 73/73 lokálních testů PASS, fixture acceptance cost_usd 0, HTTP smoke cost_usd 0.

## Zbývá

Ověřit CI a nasadit opravu budget guardu v LOCKED režimu, potvrdit UneeQ UNKNOWN a zachování odpovědi/historie. Nová kvalita modelového vyhledávání potřebuje další výslovně schválený live Search: původní limit jedné Search a jedné Generate již byl vyčerpán. Žádné další paid akce automaticky. Celkově přibližně 99 %. Main a stacked PR zůstávají bez merge; release zatím nedoporučen.
