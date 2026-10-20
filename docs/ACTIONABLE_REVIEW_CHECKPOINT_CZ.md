# Zakázky k řešení — 2026-10-20

Čtyři schválené změny nad V2 Lite:

1. Výchozí pohled To review / act vynechává IGNORE, známé uzavřené stavy, zaměstnanecké signály a negativní lidské kontroly. All saved / history zachovává přístup ke všem obchodním záznamům; žádné mazání. Aktuálnost zůstává samostatným filtrem, nikoli příslibem živé zakázky.
2. V detailu Review source / mark not relevant: otevřít originál, zvolit stále otevřené / uzavřené / nedostupné a potvrdit lidskou kontrolu. Server ukládá čas a přesnou URL. Označení otevřené platí pro zobrazení čerstvé kontroly 14 dní. Nejde o automatické ověření. U indexového nálezu potvrzení otevřeného zdroje plní také dosavadní ruční kontaktní gate.
3. Not relevant vyžaduje důvod (zaměstnání, rozpočet, scope, dodavatel, mrtvý zdroj, jiné). Clear review decision zruší aktuální omezení, ale nepřepíše původní IGNORE/CONTACTED ani nesmaže historii. Záznamy rozhodnutí jsou append-only a slouží pro další ruční ladění; žádné autonomní učení z volného textu.
4. Search instrukce zpřesňují kombinaci deliverable + nákupní úmysl a odmítání employment/seller/BIM/unpaid. Deterministické regrese přidávají closed bidding a explicitní FOR HIRE. Bez univerzálního odhadovaného rozpočtového limitu, bez blacklistu konkrétní URL, bez rozšíření placených limitů.

## Zachování dat

Nová pole manual_review a manual_review_history jsou volitelná. Žádná migrace. Poznámky, kanál, status, first_seen a historie jsou zachované; search merge nemůže přepsat lidské rozhodnutí ani poznámku modelovým obsahem. Změna přesné source URL zneplatní současné hodnocení pro novou URL, historie zůstává. Existující firemní outreach se nemění.

## Acceptance

- 511 automatických testů, včetně API auth, validace důvodu/URL, persistence/reload, merge preservation, zdrojové čerstvosti, archivace a návratu.
- Fixture acceptance a HTTP smoke PASS; placené volání nebylo spuštěno.
- Lokální browser fixture: nerelevantní položka snížila pracovní seznam 4→3, archiv zůstal 4; zrušení rozhodnutí obnovilo 4. Historie rozhodnutí viditelná.
- Produkční zápisy kontrol provádí až uživatel; při ověřování nasazení pouze read-only.

Rozsah není plný původní V2 brief: BYO API, scheduler, automatický reverify a e-mailové reporty zůstávají mimo tuto iteraci. Skutečnou výtěžnost zpřesněného hledání je možné ověřit až uživatelem spuštěným placeným během.
