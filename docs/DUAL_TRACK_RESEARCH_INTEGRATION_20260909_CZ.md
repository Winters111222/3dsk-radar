# Integrace dvoukolejného výzkumu Astry — 9. 9. 2026

## Rozhodnutí

Výzkum potvrzuje, že radar musí vést dvě oddělené obchodní koleje:

- `B2B_STUDIO` pro větší outsourcing, overflow, partnerství, veřejné zakázky a kulturní dědictví;
- `INDIVIDUAL_FREELANCE` pro jeden scan, jednu postavu, placený test nebo jiný jasně ohraničený human-asset handoff.

Malá zakázka není automaticky nekvalitní. Do A/B však může vstoupit jen tehdy, když originální detail prokazuje aktivní buyer demand, konkrétní human deliverable, možnost podat nabídku jako jednotlivec, rozpočet nebo jeho původ a vzdálenou proveditelnost. Generic object cleanup, animation-only práce, pracovní poměr a neověřený agregát zůstávají mimo sales výsledky.

## Ověřený funnel

| Kolej | A | B | C | D | Odmítnuto | Celkem |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| B2B studio | 0 | 0 | 4 | 20 | 61 | 85 |
| Individuální freelance | 0 | 1 | 0 | 14 | 33 | 48 |
| Celkem | 0 | 1 | 4 | 34 | 94 | 133 |

Výzkum tedy nesplnil cíl deseti A/B. Přinesl jednu B, čtyři C a přesnější obraz o tom, kde vzniká šum. Z 133 kandidátů je 26 nových a 107 překlasifikovaných; 30 původních detailů bylo nově nebo opakovaně přečteno.

Jediná B je Freelancer projekt `Unity Realistic 3D Character Animation` (`fl_unity_realistic`). Je aktivní pro individuální nabídku, ale před použitím vyžaduje ručně potvrdit reference, technické limity, pipeline, odpovědnost za rig/animaci a ochotu kupujícího oddělit modelovací a texturovací balík. Proto zůstává pouze v `MANUAL_TECHNICAL_QUALIFICATION_ONLY`, nikoli v produkčním sales importu.

Čtyři C jsou partnerské signály bez potvrzené otevřené objednávky. Zůstávají uzamčené, dokud partner nepotvrdí externí rozsah, rozpočet a přijímání subdodavatelů.

## Autoritativní vstupy

- manifest SHA-256: `24ebea09ade45e4b169da72fca7f7a3c9dbf6efb6ce1065b6d262e709edc89b2`;
- evidence workbook SHA-256: `005e49e8189c9d3fbce10d8c0df6bfa7cf538167a8e4f88f50625d9e8573dbe4`;
- report SHA-256: `83bb18cfdc9c7cd5dd33b4d998281a63237e94217516151faf5dc6a7fe7ac7fe`;
- importér: `scripts/import-dual-track-research.mjs`;
- očištěný artefakt: `config/dual-track-research-derived.v1.json`.

Importér přijme pouze přesný manifest podle SHA-256, kontroluje všechny funnel součty a vynucuje vypnuté zdroje, dotazy, priority, automatický import i outreach. Do odvozené konfigurace nepřenáší kontaktní pole.

## Co se mění ve vyhledávání

Původních osm sémantických záměrů se rozšiřuje o čtyři kategorie:

1. `SUPPLIED_SCAN_REPAIR` — kupující už dodal fotografie, raw mesh nebo scan a potřebuje opravit lidskou hlavu, obličej či tělo;
2. `LIKENESS_CLEANUP` — podobnost, asymetrie, expression-ready topologie a zachování detailu pokožky bez nutnosti uvést název nástroje;
3. `CHARACTER_FINISHING` — dokončení rozpracovaného realistického člověka v modelování, UV, PBR, texturách nebo topologii;
4. `SINGLE_ASSET_HANDOFF` — jednorázový fixed-price, per-model, per-scan nebo placený test.

Tyto významy jsou přidány do relevantních WIDE_MAX shardů a adaptivních promptů. Výzkumných 96 konkrétních dotazů v osmi jazycích zůstává samostatnou default-off eval a source-planning sadou; jejich import nezapíná crawler ani platformní účet.

## Seřazené integrační směry

Prvních deset priorit výzkumu je: Freelancer, Upwork saved search, NEN + Zakázky GOV, E-ZAK profilové zdroje, TED, ÚVO + JOSEPHINE, Blender Artists Paid Work, Polycount Freelance, PeoplePerHour a Useme.

Pořadí není automatizační souhlas. Freelancer vyžaduje před automatizací výslovné písemné povolení; Upwork se má používat přes nativní saved searches nebo schválené API; NEN a další portály se nesmí číst přes neveřejné frontend endpointy. Login, CAPTCHA, robots ochrany a limity platforem se neobcházejí.

## Doporučený další provozní krok

Další placený backfill by nyní nepřinesl důkaz, že se zlepšila průběžná výtěžnost. Nejdříve je vhodné:

1. ručně doověřit jedinou B na originálním Freelancer detailu;
2. po dobu 30 dní sbírat čerstvé výsledky z již založených Upwork saved searches a LinkedIn alertu;
3. měřit zvlášť B2B a individual funnel, včetně důvodů odmítnutí a stáří detailu;
4. u každého A/B zachovat originální URL, buyer truth, aktivitu, eligibility, deliverable, budget provenance a aplikační cestu;
5. až podle prospektivní precision rozhodnout, který compliant konektor má skutečnou návratnost.

Tento checkpoint neprovádí síťové volání, placený search, retry, produkční zápis, deploy, změnu environmentu ani aktivaci `RADAR_SOURCE_COLLECTION_ENABLED`.
