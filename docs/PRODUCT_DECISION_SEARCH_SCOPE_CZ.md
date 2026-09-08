# Product decision — Search scope bez Visual / AI / Motion

Datum: 2026-09-05

Tento dokument je závazný doplněk `docs/PROJECT_BRIEF_CZ.md`. Novější explicitní rozhodnutí zde má přednost před původní volitelnou sekundární lane.

## Rozhodnutí

`VISUAL_AI_MOTION` není součást aktivního Search scope.

Radar nemá cíleně vyhledávat ani vracet samostatné příležitosti pro:

- Photoshop-only produkci,
- generativní AI visual production,
- motion design / After Effects,
- medical animation,
- immersive museum visual production.

Schopnost týmu tuto práci dodat může zůstat pravdivou součástí veřejně bezpečného company profilu. Nesmí však vytvářet Search intent, query pack, výstupní kategorii ani UI filtr.

Character rigging nebo animation může zůstat relevantní pouze tehdy, když je součástí skutečné human/character production zakázky.

## Zachované kategorie

- `FULL_PIPELINE`
- `CAPTURE`
- `PHOTOGRAMMETRY_PROCESSING`
- `SCAN_CLEANUP`
- `WRAP_BASEMESH`
- `FACIAL_FACS`
- `CHARACTER_FINISHING`
- `CHARACTER_OUTSOURCING`
- `EXTERNAL_DEVELOPMENT`
- `PRODUCTION_OVERFLOW`
- `PIPELINE_CONSULTING`
- `OTHER_RELEVANT`

`OTHER_RELEVANT` je bezpečný fallback pro ruční posouzení neznámé, ale potenciálně relevantní character/scan příležitosti. Nesmí sloužit k propašování vyloučené Visual / AI / Motion lane.

## Implementační contract

1. `VISUAL_AI_MOTION` nesmí být v runtime structured-output enumu ani persisted opportunity schema.
2. UI nesmí nabízet filtr `Visual / AI / Motion`.
3. Query katalog nesmí obsahovat `adjacent_visual`.
4. Search prompt musí vyloučení říkat explicitně.
5. Visual / AI / Motion-only kandidát se nesmí normalizovat na `OTHER_RELEVANT`.

Toto rozhodnutí samo neaktivuje crawler, nemění Netlify environment, nespouští placený Search a není souhlasem s produkčním deployem.

## Doplnění 2026-09-08 — CZ/SK granty pro kulturní dědictví

Aktivní česká nebo slovenská grantová výzva s explicitním 3D scope se může zobrazit jako `HERITAGE_FUNDING_PARTNERSHIP` / `POTENTIAL_LEAD`, pokud se 3D.SK může účastnit přímo nebo s oprávněnou muzeální či jinou institucí. Stejně se může zobrazit konkrétní nedávno podpořený příjemce, pokud jeho projekt explicitně obsahuje relevantní 3D produkci.

Grant není buyer objednávka: nikdy se neoznačí `OPEN_OPPORTUNITY` a grantová částka se nepoužije jako buyer project budget. `OPEN_OPPORTUNITY` vzniká až ze samostatné veřejné zakázky nebo konkrétní poptávky. Uzavřené výzvy, obecné grantové rozcestníky a projekty bez explicitního 3D deliverable se nezobrazují.

Toto doplnění nemění pravidlo, že fyzická digitalizace kulturních předmětů patří do aktivního scope pouze v Česku a na Slovensku; mimo CZ/SK je relevantní jen vzdálená postprodukce z buyer-supplied dat.
