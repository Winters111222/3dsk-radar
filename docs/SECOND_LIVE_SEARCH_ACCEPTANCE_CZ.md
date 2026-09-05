# Druhý controlled live Search — 2026-09-05

Navazuje na docs/PR10_DEPLOYED_ACCEPTANCE_CZ.md. Uživatel výslovně schválil jeden další Search bez dalšího Generate Response.

## Identita a průběh
- Exact PR #10 head e57912f1c42544493912120228a15ea4b0d54112, Draft/open/unmerged; CI 33969314795 znovu ověřeno SUCCESS.
- Předběžný readback: Search gpt-5.6-luna, Reply gpt-5.6-sol, max results12, cooldown30, serverový API secret přítomen; acceptance gate nepřítomný.
- Live deploy 6a9c1d01efff48caed3ae7ff, READY, exact head, published 2026-09-05T13:46:02.811Z.
- Jedno kliknutí FIND NEW OPPORTUNITIES, dokončeno kolem 13:47 UTC. Žádné opakování Search, žádný nový Generate ani Regenerate, žádný send.
- Nový běh vrátil 1 záznam; původních 5 zachováno, celkem 6 výsledků a 6 firem.
- LAST SEARCH COST $0.0257 EST. COST; 2 web-search calls, 25 090 total tokens, model gpt-5.6-luna; search fee $0.0200 + tokens $0.0057. Jde o odhad tohoto běhu, ne kumulativní cenu ani fakturu.
- Počty hosted calls nejsou počtem kliknutí Search; povolený interní structured retry nebyl nezávisle měřen.

## Nezávislé obsahové ověření
Zdroj: https://een.ec.europa.eu/partnering-opportunities/b2b-search-and-technology-offer-3d-art-photogrammetry-pipeline-specialist

- Oficiální EEN profile TOIT20260702028 načten; existuje a odpovídá popsanému partnerství.
- Publikováno 2. 7. 2026, platnost do 2. 7. 2027 potvrzena. Starší než 30 dní, ale zdroj výslovně potvrzuje aktuální platnost.
- Firma veřejně nepojmenovaná, uvedeno Italy. App název otevřeně říká name undisclosed.
- POTENTIAL_LEAD je správně: jde o Technology offer a co-development partnerství, nikoli doloženou buyer-funded zakázku.
- BUDGET UNKNOWN odpovídá absenci outsourcingového rozpočtu. Žádná seller license není označena jako PUBLISHED budget.
- E-mail chybí ve zdroji; aplikace ho nevymyslela. Kontakt vede přes EEN.
- FIT78 odpovídá tematickému překryvu, ale source preferuje mimo jiné architekturu, heritage a product scanning; human-character scope není potvrzen. WIN61 je v UI výslovně HEURISTIC.
- Zdroj hledá partnery poskytující raw scans, kterým nabídne zpracování. Není potvrzeným kupcem služeb 3D.sk. Toto omezuje přímou obchodní relevanci výsledku.
- Nový výsledek není duplicitou původní pětice. Cross-run dedupe stejného záznamu tento běh neexercisoval; původní zero-cost dedupe testy platí.

## Finální locked stav
- RADAR_LIVE_AI_ENABLED=false, authoritative env readback potvrzen.
- Current deploy 6a9c1dceefff48ccff3ae813, READY, exact PR #10, published 2026-09-05T13:49:18.754Z.
- Deployed CHECK AI LOCKS passed true: health LOCKED, live_ai_enabled false, access_configured true, acceptance false, persistence NETLIFY_BLOBS.
- POST /api/search i POST /api/generate-response -> 423 LIVE_AI_LOCKED bez dalšího provider requestu.
- Browser vrácen do normálního týmového prostoru. Po redeployi 6 uložených výsledků a $0.0257 zachováno.
- Main a PR stack nezměněny. OPENAI_API_KEY zůstává serverovým Netlify secretem.

## Rozhodnutí
Technické Search/cost/persistence i source a budget kontrola tohoto výsledku prošly. Přímá nákupní relevance je stále omezená; finální release jako spolehlivého radaru poptávek zatím nedoporučen. Přibližně 99 % V0.1. Další práci zaměřit na rozlišení, kdo nabízí práci a kdo shání dodavatele, a kalibraci FIT/WIN; nejprve na již získaných datech bez dalšího placení. Oba schválené Search běhy jsou spotřebované; další paid run vyžaduje nový souhlas. Původní jediný Generate Response zůstává odpověď pro Kabum; nepřegenerovávat automaticky.
