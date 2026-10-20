# Oprava aktuálnosti a historie — 2026-10-20

## Příčina a změny

- Původní acceptance gate uznávala jakoukoliv neprázdnou poznámku u otevřeného odkazu. U staré/undated OPEN_OPPORTUNITY nyní nestačí existence stránky ani čerstvá návštěva. Vyžaduje se explicitní aktuální přijímání na stejné původní URL, datum aktivity ze zdroje v posledních 14 dnech a odpovídající datovaná evidence. Zdrojová aktualizace sama bez acceptance nestačí. Datum publikování do 30 dní dál podléhá ostatním open/buyer/scope gates. Nejde o nezávislé automatické procházení; model stále musí pravdivě extrahovat zdrojová fakta.
- Merge zachovává platné známé published_date a source_updated_date, pokud další nález dodá null, prázdné, neplatné nebo budoucí datum. Kalendářní validace odmítá i neexistující den.
- Každý nový kompaktní běh ukládá doložený stav, počet selhání a verzi evidence. Před nahrazením posledního plného běhu se jeho coverage zachová v historii. Staré COMPLETE bez retained coverage/evidence se zobrazí UNVERIFIED s vysvětlením; historie se nemaže a minulý úspěch se nedohaduje.

## Ověření bez placeného AI

Regrese pokrývají konkrétní podobu starého Reddit nálezu, chybějící datum, crawl timestamp bez acceptance, prošlou aktivitu, datovanou přípustnou aktivitu, uchování data/poznámky/lidské historie a PARTIAL po následném běhu. Ověření produkce je read-only; žádné placené AI ani změny klíčů.

## Omezení

Již ztracené datum nebo coverage nelze automaticky obnovit bez zachovaného důkazu. Tato změna nezapisuje do historických produkčních nabídek: dřívější chybně přijatý Reddit záznam zůstává v archivu s původním IGNORE a poznámkami. Opravený gate jej při stejné nepodložené evidenci v dalším hledání nepřijme. Dřívější datum publikování nebylo touto změnou retroaktivně doplněno. Historický COMPLETE bez evidence není nově vydáván za prokázaný úspěch.
