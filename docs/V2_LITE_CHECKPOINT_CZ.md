# V2 Lite — checkpoint 2026-10-20

## Rozsah

1. Finalizace ULTRA označuje běh s chybujícími částmi jako PARTIAL. Finální počet výsledků (včetně nuly) má přednost před mezikandidáty. Chybějící měření není prezentováno jako nula.
2. Nedestruktivní pohledy All saved, Recent / checked, Needs checking a History / signals. Stáří vychází z publikace, ne z opětovného nalezení; ruční kontrola musí odpovídat přesné URL. Recent není příslib otevřené zakázky.
3. Oddělené projekty, možné spolupráce a zaměstnanecké signály. Varování nízkého rozpočtu vychází z uloženého posouzení, bez měnových přepočtů a bez přepisování skóre.
4. Přehled posledního běhu, čitelné štítky aktuálnosti, viditelnější poznámky a stručné vysvětlení v detailu. Adresář firem a jeho abecední řazení zůstávají zachované.
5. Regresní testy zachování historie, poznámek, company memory a limitů. Žádná migrace ani mazání uložených dat.

## Ověření před vydáním

- 505 / 505 automatických testů PASS.
- Fixture acceptance, HTTP smoke, source catalog a ULTRA offline acceptance PASS.
- Syntax všech JS/MJS a git diff --check PASS.
- Desktop náhled s fixture daty zkontrolován v prohlížeči. Mobilní screenshot se kvůli timeoutu prohlížeče nepodařilo potvrdit; dočasné rozměry resetovány.
- Žádné placené vyhledávání ani generování. Existující klíč a prostředí beze změn. Testy nezapisovaly do produkčních dat.

## Omezení a bezpečné pokračování

Historická chyba WIDE_SEARCH_TOOL_BOUNDARY_INVALID odpovídá překročení rozpočtu volání nástroje (4 místo 3). Instrukce rozpočtu v promptu je nyní explicitní; ochrana nadlimitní odpověď nadále odmítne a nezkouší automatické placené opakování. Regrese tuto situaci ověřuje offline. Bez dalšího placeného běhu nelze tvrdit, že poskytovatel limit vždy dodrží; další search smí spustit vlastník sám.

Tento dokument potvrzuje lokální acceptance, nikoli sám o sobě nasazení. Stav CI a nasazení je nutné ověřit proti přesné vydané revizi.
