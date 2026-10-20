# Výtěžnost a pravdivost diagnostiky — 2026-10-21

Rozsah: vlastníkem schválený malý balík po auditu nulového běhu. Lokální implementace; tento dokument sám nepotvrzuje nasazení.

## Změny

- Úzké explicitní negace zaměstnání a heritage capture nezpůsobují odmítnutí. Pozitivní požadavek ve zbytku věty a role EMPLOYER dál mají přednost.
- Scan artifact removal je oprava mesh artefaktů, nikoli muzejní artefakt. Varianta „buyer will send the scan files“ umožňuje posoudit remote postprocessing; explicitní onsite požadavek nepřebije.
- Podle schváleného V2 se ruší blanket zákaz Character Creatoru/CC3/CC4 a stylizovaných postav; relevantní Blender character assets nejsou odmítnuté jen podle nástroje. iClone a Daz zůstávají mimo scope. Schválené outbound capabilities a credentials se nemění; přijetí leadu není slib dodání konkrétní technologie.
- Detailní ověřovací request má bounded enum důvodů odmítnutí v existujícím volání. Důvod se váže na přesnou kandidátní URL, nesmí přijmout kandidáta a při rozporné odpovědi se kandidát nepřijme. Chybějící/neplatný důvod je detail_evidence_missing, nikoli domyšlené uzavření.
- UI označuje důvody detailního odmítnutí jako modelové posouzení, ne nezávislou HTTP kontrolu. Historické detail_verification_failed zůstává explicitně bez přesné příčiny.
- Datum odmítnutého kandidáta je UNVERIFIED DATE / Claimed publication, odděleně od first/last found. Žádné přepisování historických údajů.
- Diagnostika vysvětluje, že čítač kandidátů počítá strukturované výstupy, může opakovat URL a neobsahuje modelově vynechané položky. Konzultovaná URL není důkaz načteného živého detailu.
- Nová verze WIDE_MAX plánu v2-yield-quality-v5 odděluje identitu od starších semantik. Limity požadavků, retry politika ani ceny nebyly zvýšeny.

## Bezpečnost a omezení

Bez migrace, změny poznámek/statusů/historie, secrets nebo serverových přepínačů. Bez placeného testu, API profilů, scheduleru, nových zdrojů či automatického odesílání.

Nejde o plný nezávislý source verifier: modelový důvod i původní datum mohou být chybné. Finální URL/HTTP/content verification zůstává samostatná budoucí práce. Diagnostika nemůže zpětně rekonstruovat modelově vynechané kandidáty. Zlepšení reálné výtěžnosti není offline testem prokázáno.

## Ověření

Regrese pokrývají reprodukce falešných odmítnutí a opačné případy, změnu scope, důvody v přesné URL, neplatný enum, rozpor accepted/rejected, nulová dodatečná volání, přenos do detailního ledgeru a render skutečného UI s izolovanými daty. Stávající ochrany čerstvosti, poznámek a historie zůstávají součástí celé testovací sady.

Lokálně: 520/520 testů PASS, fixture acceptance PASS (0 USD), HTTP smoke PASS (10 cest), syntax změněných JS/MJS a diff whitespace PASS. DOM test ověřuje skutečný render štítků a zamčených sales akcí; vizuální browser acceptance ani produkční nasazení v tomto bloku neproběhly.
