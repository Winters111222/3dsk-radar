# Search Phase A — datová pravdivost a měření

Datum: 2026-09-05

Stav: implementováno na navazující review branchi, bez produkčního deploye a bez placeného AI volání.

## Co je nyní vynucené

Každý nový kandidát musí mít:

- `commercial_role`: BUYER / EMPLOYER / SELLER / PARTNER / UNKNOWN,
- `notice_status`: OPEN / UPCOMING / CLOSED / AWARDED / CANCELLED / UNKNOWN,
- `studio_eligibility`: YES / NO / UNKNOWN a textový důvod,
- `scope_fit`: CORE / CHARACTER_ADJACENT / OUT_OF_SCOPE / EQUIPMENT,
- skutečné datum publikace nebo aktualizace,
- u starší položky přesný ověřený zdroj, který nyní potvrzuje přijímání.

Fail-closed rejection reasons:

- `seller_not_opportunity`,
- `unknown_commercial_role`,
- `inactive_notice`,
- `studio_ineligible`,
- `out_of_scope`,
- `stale_or_unverified`,
- stávající source/schema/category rejection reasons.

`OPEN_OPPORTUNITY` přežije pouze jako aktuální BUYER request se stavem OPEN a potvrzenou použitelností pro studio. Employment a partnership signály se mohou zobrazit pouze jako `POTENTIAL_LEAD`; nikdy se automaticky nevydávají za otevřenou zakázku.

## Freshness contract

Výchozí hard window je 30 kalendářních dní. Starší nebo nedatovaná položka projde pouze když:

1. `notice_status` je OPEN,
2. `acceptance_source_url` patří mezi skutečně navštívené web-search zdroje,
3. stejná URL je uvedená v source evidence s popisem aktuálního stavu.

Server potom uloží vlastní `acceptance_verified_at`. Search-engine crawl date, URL parametr ani `last_seen` nenahrazuje publikaci nebo aktuální acceptance evidence.

## Měření

Last-run record a UI rozlišují:

- ověřené source URL,
- kandidáty seen / verified / rejected,
- odstraněné duplicity,
- nové / aktualizované opportunities,
- celkový workspace.

Počítadla zdrojových služeb a list/detail stránek zůstávají u dnešního hosted-search režimu `null`, ne falešná nula. Naplní je až skutečné konektory a wide runner ve fázích B/C.

## Offline acceptance

Všech 11 výzkumných evidence cases je spárováno se sanitizovaným executable fixture testem. Testy neobsahují kopie cizích stránek ani neveřejné kontakty a nevolají internet/OpenAI.

Phase A nemění `RADAR_LIVE_AI_ENABLED=false`, Netlify environment, team data ani produkční deploy. Další krok je Phase B: první povolené konektory TED a následně Polycount/Unreal/Blender podle access review.
