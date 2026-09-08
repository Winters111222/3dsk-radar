# Ranked source-gap report po prvním ULTRA MAX běhu

Autoritativní strojová data: `config/source-gap-report.v1.json`  
Offline validace: `npm run report:sources:gaps`

## Rozhodnutí

První bezpečný balík je **instrumentace + access qualification**, nikoli tiché
odemčení collection. Tři hotové bezplatné collectory mají doloženou strojovou
cestu, ale zatím nesplňují source-specific precision. Všechny proto zůstávají
`runtime_eligible=false` a globální source collection zůstává zamčená.

| Pořadí | Zdroj | Očekávaný přínos | Přístup | Credential | Stav |
|---:|---|---|---|---|---|
| 1 | Upwork | vysoký | schválené GraphQL API | OAuth2 + tenant ID | čeká na platformní approval |
| 2 | TED EU | střední, nízká frekvence / vysoká hodnota | anonymní Search API | žádný | bounded precision sample |
| 3 | NEN | vysoký lokální, nízký objem | určené XML / ISVZ open data | podle potvrzeného exportu žádný | endpoint contract review |
| 4 | E-ZAK muzea/kraje | vysoký lokální, nízký objem | nativní e-mail alert / schválený feed | free account nebo povolení | alert pilot |
| 5 | ÚVO | střední lokální | oficiální open data | žádný po ověření distribuce | dataset contract review |
| 6 | JOSEPHINE | střední lokální | nativní alert / dokumentovaný feed | free account nebo povolení | access review |
| 7 | Find a Tender | nízký–střední | anonymní OCDS API | žádný | 0/50; měřit dál, nezapínat |
| 8 | Contracts Finder | nízký–střední | anonymní OCDS API | žádný | 0/50; měřit dál, nezapínat |
| 9 | CZ/SK heritage funding | partner leads | oficiální výzvy, příjemci a operator import | žádný | jen POTENTIAL_LEAD |
| 10 | LinkedIn alerts | signal-only | autorizovaný alert relay | uživatelův alert + HMAC | bez login scrapingu |
| 11 | Reddit | střední, nižší precision | official OAuth Data API | approval + agreement | čeká na approval |
| 12 | Bluesky/Mastodon | nízký signal-only | oficiální autentizované API | revocable app password / read token | autorizovaný pilot |
| 13 | Telegram/Discord | neznámý, channel-specific | pozvaný bot v allowlistu | bot + channel IDs | pouze autorizované kanály |

Kompletní registry obsahuje u každého zdroje také implementační náročnost,
ToS/právní omezení a přesný způsob detailního ověření.

## Kvalifikace již implementovaných bezplatných zdrojů

- **TED**: aktuální oficiální dokumentace potvrzuje anonymní `POST
  /v3/notices/search` pro analýzu a reuse publikovaných notices, včetně použití
  komerčními organizacemi. Access gate je tedy `AUTOMATION_APPROVED`; pozitivní
  source-specific yield však dosud nebyl naměřen.
- **Find a Tender**: implementovaný anonymní OCDS collector a předchozí canary
  jsou access-ready; poslední 50record sample měl `0` relevantních výsledků.
- **Contracts Finder**: implementovaný anonymní OCDS read collector a předchozí
  canary jsou access-ready; poslední 50record sample měl `0` relevantních
  výsledků.
- **NEN**: pravidla NIPEZ výslovně zakazují strojové používání frontendového API,
  ale označují NEN profilové XML a ISVZ open data jako určené strojové cesty.
  Implementace musí počkat na ověření konkrétního export endpointu a jeho limitů.

Access-ready neznamená runtime-ready. Stávající politika stále vyžaduje nejméně
30 ručně posouzených kandidátů, precision alespoň 0,8 a relevantní pozitivní
důkazy. Žádný zdroj tuto kombinaci nyní nesplňuje.

## Grantová lane

Radar musí odděleně hledat:

- otevřené výzvy s explicitním 3D scope;
- jmenované financované příjemce a konkrétní 3D projekt;
- plánované zakázky financovaných muzeí/institucí;
- doložitelnou subdodavatelskou nebo partnerskou cestu.

Obecný grantový program, uzavřená výzva nebo příjemce bez konkrétního 3D
deliverable se nesmí zobrazit. Grant nikdy není buyer budget a zůstává
`POTENTIAL_LEAD`, dokud neexistuje samostatný procurement/buyer detail.

## První navazující runtime kandidát

Nejbezpečnější další měřený krok je bounded zero-cost TED sample s novým
heritage/buyer query packem. Není součástí tohoto checkpointu, protože současná
autorizační hranice zakazuje zapnutí `RADAR_SOURCE_COLLECTION_ENABLED` a změnu
produkčního environmentu. Lokální měření musí zůstat explicitně potvrzené,
read-only, bez retry, bez AI a bez persistence.

