# Phase B — access review komunit a UK OCDS

Datum kontroly: 5. 9. 2026

Účel: rozhodnout, které zdroje mají pro Radar doloženou bezpečnou automatizační cestu. Samotná technická dostupnost URL nestačí. Preferuje se oficiální API nebo feed; pokud podmínky, licence nebo publikační pravidla nedávají dostatečnou jistotu, zdroj zůstane `BLOCKED_ACCESS_REVIEW`.

## Výsledek

| Zdroj | Ověřená cesta | Runtime verdikt | Důvod |
|---|---|---|---|
| Find a Tender | veřejné OCDS JSON API | `IMPLEMENTED_API_VERIFIED` | Služba výslovně nabízí notice data přes API, uvádí OCDS 1.1.5 a Open Government Licence. |
| Contracts Finder | veřejné OCDS JSON Search API | `IMPLEMENTED_API_VERIFIED` | Read endpoint je samostatně dokumentovaný, nevyžaduje token a vrací first-party notice URL. |
| Polycount Paid Freelance | první-party RSS technicky existuje | `BLOCKED_ACCESS_REVIEW` | Robots přesnou feed cestu nezakazuje, ale Terms označují user contributions licencí CC BY-NC-SA. Pro komerční interní ingest nebylo nalezeno výslovné povolení. |
| Unreal Job Offerings | kategorické RSS technicky existuje | `BLOCKED_ACCESS_REVIEW` | Publikované `robots.txt` pro `User-agent: *` zakazuje `/c/*.rss`. |
| Blender Artists Paid Work | kategorické RSS technicky existuje | `BLOCKED_ACCESS_REVIEW` | Publikované `robots.txt` zakazuje `/c/*.rss`; navíc samostatně blokuje GPTBot a ChatGPT-User. |

Blokované komunitní zdroje nejsou vydávány za aktivní collectory a Radar z nich nedělá HTML scraping. Mohou být znovu posouzeny po získání výslovného povolení nebo po zveřejnění vhodného oficiálního API/feed contractu.

## Find a Tender contract

Autoritativní dokumentace:

- [Data and API documentation](https://www.find-tender.service.gov.uk/Developer/Documentation)
- [GET OCDS release package](https://www.find-tender.service.gov.uk/apidocumentation/1.0/GET-ocdsReleasePackages)

Dokumentované chování použité v collector adapteru:

- pevný `GET /api/1.0/ocdsReleasePackages`,
- `updatedFrom` a `updatedTo` ve formátu `YYYY-MM-DDTHH:MM:SS`,
- `stages=tender`,
- dokumentovaný serverový limit nejvýše 100; Radar používá přísnější cap 50,
- neprůhledný `cursor` nejvýše 300 znaků,
- při HTTP 429 nebo 503 respektovat `Retry-After` a automaticky request neopakovat,
- výstup je OCDS release package; `releases[].ocid` je identita procurement procesu a `releases[].id` identita konkrétní release/revision.

## Contracts Finder contract

Autoritativní dokumentace:

- [Contracts Finder API](https://www.contractsfinder.service.gov.uk/apidocumentation)
- [GET Published/Notices/OCDS/Search](https://www.contractsfinder.service.gov.uk/apidocumentation/Notices/1/GET-Published-Notice-OCDS-Search)

Adapter používá pevný `GET /Published/Notices/OCDS/Search`, 30denní `publishedFrom/publishedTo`, `stages=tender`, serverový cap 50 a stejnou validaci cursoru. Zdroj dokumentuje při překročení rate limitu HTTP 403 a pětiminutovou pauzu; Radar tuto odpověď převede na vlastní 429 s `retry_after_seconds: 300` a request automaticky neopakuje. Canonical provenance se přijme pouze z first-party `tenderNotice` dokumentu na `www.contractsfinder.service.gov.uk/Notice/...`.

Adapter používá jen data aktualizovaná v posledních 30 dnech, ale stáří aktualizace samo o sobě nedokazuje původní datum celé zakázky. Proto ukládá `source_updated_date`, nikoli vymyšlené `published_date`. Lokálně odmítá neaktivní/ukončené tendry, vypršené deadline, nedatované nebo staré release a položky bez shody s jedním ze čtyř schválených query packs. Hodnota z `tender.value` se nese jen jako surové `upstream_tender_value`; nesmí se vydat za použitelný `PUBLISHED` budget bez Phase C kontroly lotu a rozsahu. Finální obchodní klasifikace a detailové ověření zůstávají Phase C.

## Síťové ověření

Proběhl jeden malý anonymní read-only canary request do produkčního Find a Tender API s `limit=1`, 30denním `updatedFrom/updatedTo` a `stages=tender`:

- HTTP 200,
- jedna reálná OCDS release,
- potvrzené top-level `releases[]` a `links.next`,
- potvrzené `ocid`, release `id`, `date`, `tender.status`, `tenderPeriod`, buyer a canonical procurement detail,
- autentizace: žádná,
- OpenAI requests: 0,
- cena: `$0`.

Stejným způsobem proběhl jeden Contracts Finder canary s `limit=1`, `publishedFrom/publishedTo` a `stages=tender`:

- HTTP 200,
- jedna reálná OCDS release,
- potvrzené `tender.datePublished`, status/deadline, buyer, `links.next` a first-party `tenderNotice` URL,
- autentizace: žádná,
- OpenAI requests: 0,
- cena: `$0`.

Kontrola komunitních zdrojů pouze načetla jejich veřejné `robots.txt`, první-party feed boundary a podmínky. Nebyl proveden plošný crawl, obcházení přístupu, login ani zápis.

## Bezpečnostní hranice

Oba UK OCDS collectory sdílí stejný endpoint `/api/source-collection` a stejný default-off gate jako TED:

```text
RADAR_SOURCE_COLLECTION_ENABLED=false
RADAR_LIVE_AI_ENABLED=false
```

Klient nemůže dodat vlastní upstream URL ani libovolný textový dotaz. Může vybrat pouze pevný `source_id`, jeden ze čtyř schválených query packs, limit v serverovém capu a serverem vydaný validovaný cursor. Collector nic neukládá a vrací `persistence: NONE`, `openai_requests: 0`, `estimated_cost_usd: 0`.
