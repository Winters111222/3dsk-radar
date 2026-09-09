# Upwork a LinkedIn — bezpečný alert bridge

**Repository-only návrh a normalizátor · 8. září 2026**

## Výsledek

Radar může sledovat uživatelem vlastněné Upwork a LinkedIn alerty bez login
automatizace, cookies, browser scrapingu, CAPTCHA bypassu nebo reverzního
inženýrství neveřejných endpointů. Alert, který platforma sama doručí do
uživatelovy schránky, se zpracuje pouze jako discovery signál. Radar z něj
nesmí automaticky oslovovat kupujícího ani jej vydat za ověřenou zakázku.

Preferovaná Upwork cesta zůstává schválené GraphQL API. Uložené Upwork searches
jsou užitečné jako ručně kontrolované feedy, ale negarantují e-mail pro každý
dotaz. Podle aktuální oficiální dokumentace jsou instantní alerty dostupné pro
Freelancer Plus, vyžadují alespoň jednu aktivní individuální proposal a vycházejí
z historie individuálních proposals. Gmail bridge je proto pouze oportunistický
fallback, pokud Upwork e-mail skutečně doručí. LinkedIn nemá veřejné API pro globální čtení Jobs;
oficiální Job Posting API slouží schváleným partnerům k publikování nabídek.
Proto LinkedIn zůstává signal-only vrstvou.

## Tok dat

1. Uživatel vytvoří LinkedIn job alert. V Upworku uloží search feed; samostatně
   může povolit historie-proposals instant alerts, pouze pokud je účet způsobilý.
2. Pokud platforma podporovaný alert doručí, přijde do uživatelovy vlastní schránky, labelu
   nebo folderu, například `3dsk-radar`.
3. Budoucí mailbox relay používá pouze oficiální read-only API poskytovatele
   e-mailu a aplikačně čte jen tento label/folder. Gmail OAuth scope nelze
   omezit na jediný label, proto musí být token omezen alespoň na
   `gmail.readonly`, odděleně revokovatelný a použitý pouze server-side.
4. Relay předá normalizátoru Message-ID, čas přijetí, předmět, text a odkazy.
   Gmail adaptér navíc vyžaduje ověřeného platformního odesílatele a
   `DMARC=pass` pro odpovídající doménu.
5. `user-owned-alert-normalizer.mjs` přijme jen přesné job/post URL, odstraní
   tracking query a vytvoří stabilní event ID. Seller/profile/service URL zahodí.
6. Relay podepíše každý normalizovaný JSON existujícím HMAC kontraktem a pošle
   jej na `/api/source-signal-ingest`.
7. Endpoint ověří interní Bearer auth, timestamp, HMAC, gate, URL politiku a
   replay. Záznam uloží jako `discovery_only`, `requires_original_verification`
   a `outreach_locked`.
8. Při dalším běhu se Upwork signál zařadí do marketplace shardu a LinkedIn
   signál do social shardu. Před přijetím musí být otevřen originální detail.

## Co se neukládá a neprovádí

- žádné heslo, cookies ani browser session Upworku nebo LinkedInu;
- žádné automatické přihlášení nebo otevírání alert linků;
- žádný raw HTML e-mail ani tracking parametr;
- žádný automatický apply, zpráva nebo outreach;
- žádný pokus obejít rate limit, challenge, login nebo CAPTCHA;
- žádná domnělá buyer identita, rozpočet, deadline nebo kontaktní adresa.

## Implementovaný kontrakt

Lokální vstup pro `npm run alert:normalize -- <alert.json>`:

```json
{
  "platform": "linkedin",
  "message_id": "<provider-message-id>",
  "subject": "New jobs matching your alert",
  "body_text": "Short alert text",
  "received_at": "2026-09-08T18:00:00Z",
  "links": ["https://www.linkedin.com/jobs/view/123456/"]
}
```

Normalizátor je offline a nic neodesílá. Jeden alert přijme nejvýše 25 odkazů.
Duplicity v rámci zprávy odstraní a event identity odvozuje z Message-ID a ID
zakázky. Přijímá jen:

- Upwork buyer-job cesty `/jobs/~…`, `/freelance-jobs/apply/…_~…` a e-mailovou
  variantu `/ab/feed/jobs/details/~…`, která se převede na `/jobs/~…`;
- LinkedIn `/jobs/view/<id>`, e-mailovou `/comm/jobs/view/<id>`, activity post
  a přímou post cestu.

Read-only kontrola skutečného Gmail vzorku potvrdila LinkedIn digest s
`text/plain` a `text/html`, ověřeným DKIM/SPF/DMARC a více
`/comm/jobs/view/<id>/` odkazy v jedné zprávě. Gmail adaptér používá pouze
plain-text část, každému jobu zachová jeho vlastní krátký textový kontext a HTML
kopii ignoruje. Skutečný e-mail ani jeho identifikátory nejsou součástí
repozitáře.

`gmail-alert-collector.mjs` připravuje skutečný read-only transport přes
oficiální Gmail API. Provede nejvýše jeden list request a dvacet detail requestů,
čte pouze jeden nakonfigurovaný label, používá pevné 30denní okno, nemá retry a
raw Gmail payload nevrací ani neukládá. Chybnou jednotlivou zprávu izoluje a do
diagnostiky zapíše jen bezpečný error code.

## Pilotní dotazy a skutečné platformní limity

Strojový plán `config/platform-alert-pilot.v1.json` obsahuje osm LinkedIn job
alertů a osm Upwork saved searches. Všechny jsou default-off a vyžadují ruční
založení vlastníkem účtu. LinkedIn oficiálně dovoluje nejvýše 20 job alertů a
jejich e-mailovou frekvenci daily/weekly. Upwork dovoluje nejvýše 30 saved
searches a podporuje `AND`, `OR`, `NOT`, závorky a wildcard `*`; nepodporuje
operátory `+`, `-` a `!`. Pilot používá pouze dokumentovanou syntaxi.

LinkedIn alerts jsou z principu employment-biased a zůstávají signal-only.
Upwork saved search je operator-review feed; nelze jej označit jako aktivní
e-mailový monitoring bez skutečně doručeného platformního alertu. Ani jedna
platforma se nestane runtime zdrojem pouhým vytvořením dotazu.

### Živá kalibrace 2026-09-09

Vlastník účtů ručně a přes oficiální UI vytvořil jeden globální LinkedIn alert
`\"character artist\"` a dva Upwork saved searches. LinkedIn ukázal 46 výsledků
a správce alertů potvrdil denní doručení e-mailem i notifikací. Upwork broad
scan-cleanup dotaz ukázal 8 výsledků; human-scan dotaz ukázal 2 výsledky, z
nichž jeden byl přímý ongoing full-body human photogrammetry cleanup. Samostatný
Wrap3D / topology-transfer dotaz měl 0 výsledků a nebyl uložen.

Pozorování neopravňuje runtime aktivaci: počty jsou pouze časově označený
kalibrační vzorek, nikoli garantovaná výtěžnost. MetaHuman byl z aktivního
Upwork pilotu odstraněn podle potvrzeného skutečného zaměření operátora na
cleanup skenů. Všechny nové signály nadále procházejí stejnými truth gates.

## Offline měření výtěžnosti

Ručně ověřené kandidáty lze bez sítě a bez AI vyhodnotit příkazem
`npm run report:alerts:precision -- <manual-review.json>`. Každý A/B výsledek
musí doložit originální detail, aktivní stav, kupujícího, způsobilost externího
studia, konkrétní deliverable, budget provenance a aplikační cestu. C, D a
odmítnuté položky musí zůstat outreach-locked a mít explicitní důvod.
LinkedIn A/B navíc musí být vyřešen na originální buyer/ATS zdroj mimo samotnou
LinkedIn job URL; platformní alert zůstává pouze `signal_url`.

Report ukáže precision celkem, po platformě i po jednotlivém pilotním dotazu.
Zdroj projde pouze při nejméně 30 ručně posouzených kandidátech a alespoň 80 %
ověřených A/B výsledků. Ani PASS automaticky neaktivuje runtime; výstup vždy
ponechá `runtime_activation: LOCKED`.

## Gaty pro preview canary

Code-only endpoint `/api/gmail-alert-canary` je implementovaný, ale funguje
výhradně v `deploy-preview`, vyžaduje interní autorizaci, pre-live workspace a
doslovné potvrzení `READ_ONE_GMAIL_ALERT_AND_IMPORT_ONE_LOCKED_SIGNAL`. Před
splněním všech gatů neotevře Gmail ani databázi. Jeden canary smí načíst nejvýše
jednu zprávu, importovat nejvýše jeden signál a provést nejvýše dva Gmail API
requesty bez retry. Žádný gate se tímto commitem nezapíná. Pro pozdější
samostatně schválený Deploy Preview canary bude potřeba dočasně a izolovaně
nakonfigurovat:

- `RADAR_SOURCE_SIGNAL_INGEST_ENABLED=true`;
- `RADAR_GMAIL_ALERT_COLLECTION_ENABLED=true`;
- read-only `GMAIL_ALERT_OAUTH_ACCESS_TOKEN` a `GMAIL_ALERT_LABEL`;
- `RADAR_UPWORK_SIGNAL_ENABLED=true` nebo `RADAR_LINKEDIN_SIGNAL_ENABLED=true`;
- `RADAR_SOURCE_INGEST_SECRET`;
- existující interní access secret;
- read-only mailbox credential; collector aplikačně vynutí jediný vyhrazený
  label/folder, i když samotný Gmail OAuth grant není label-scoped.

Canary smí read-only přečíst již doručený alert z vyhrazeného labelu, ověřit
nejvýše jeden signal-ingest write/readback a při opakovaném explicitním spuštění
idempotentní replay. Do Gmailu nesmí zapisovat. Nesmí zapnout globální
`RADAR_SOURCE_COLLECTION_ENABLED` ani provést placený search.

## Detailní truth gate

Upwork signal lze povýšit pouze po ověření přesného buyer job detailu: aktivní
stav, deliverable, studio/team eligibility, budget provenance a funkční apply
cesta. LinkedIn signal musí být podle názvu, firmy a veřejných údajů převeden na
originální employer/ATS/buyer detail. Pokud takový originál neexistuje, zůstává
watchlist signálem a nesmí do sales workspace.

## Externí předpoklady

Repozitář nyní obsahuje Gmail transportní knihovnu, read-only readiness a
preview-only canary endpoint. Produkční spojení stále neexistuje a vyžaduje
samostatné schválení po úspěšném izolovaném canary. Token se nikdy nesmí předat
do browseru, logu, URL nebo repozitáře.

Oficiální podklady:

- [Upwork — Use bots and other automation properly](https://support.upwork.com/hc/en-us/articles/43342677368467-Use-bots-and-other-automation-properly)
- [Upwork — API key application](https://www.upwork.com/developer/keys/apply)
- [Upwork GraphQL API](https://www.upwork.com/developer/documentation/graphql/api/docs/index.html)
- [Upwork — Search and saved searches](https://support.upwork.com/hc/en-us/articles/211063078-How-to-search-for-jobs-on-Upwork)
- [Upwork — Advanced Boolean search](https://support.upwork.com/hc/en-us/articles/1500007921782-How-to-use-advanced-search-techniques-to-find-jobs)
- [Upwork — Instant alert eligibility](https://support.upwork.com/hc/en-us/articles/36001273797907-How-to-get-instant-job-alerts)
- [LinkedIn — Job alerts](https://www.linkedin.com/help/linkedin/answer/a511279)
- [LinkedIn Talent API catalog](https://developer.linkedin.com/product-catalog/talent)
- [LinkedIn Job Posting API](https://learn.microsoft.com/en-us/linkedin/talent/job-postings/api/overview?view=li-lts-2026-04)
- [Gmail API — users.messages.list](https://developers.google.com/gmail/api/reference/rest/v1/users.messages/list)
- [Gmail API — OAuth scopes](https://developers.google.com/workspace/gmail/api/auth/scopes)
