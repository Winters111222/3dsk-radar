# Upwork a LinkedIn — bezpečný alert bridge

**Repository-only návrh a normalizátor · 8. září 2026**

## Výsledek

Radar může sledovat uživatelem vlastněné Upwork a LinkedIn alerty bez login
automatizace, cookies, browser scrapingu, CAPTCHA bypassu nebo reverzního
inženýrství neveřejných endpointů. Alert, který platforma sama doručí do
uživatelovy schránky, se zpracuje pouze jako discovery signál. Radar z něj
nesmí automaticky oslovovat kupujícího ani jej vydat za ověřenou zakázku.

Preferovaná Upwork cesta zůstává schválené GraphQL API. Alert bridge je
nízkofrekvenční fallback v době čekání na schválení API a neprovádí žádný
request vůči Upworku. LinkedIn nemá veřejné API pro globální čtení Jobs;
oficiální Job Posting API slouží schváleným partnerům k publikování nabídek.
Proto LinkedIn zůstává signal-only vrstvou.

## Tok dat

1. Uživatel si přímo v Upworku nebo LinkedInu vytvoří nativní job alert.
2. Platforma doručí alert do uživatelovy vlastní vyhrazené schránky, labelu
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

## Gaty pro budoucí preview canary

Žádný gate se tímto commitem nezapíná. Pro samostatný Deploy Preview canary bude
později potřeba dočasně a izolovaně nakonfigurovat:

- `RADAR_SOURCE_SIGNAL_INGEST_ENABLED=true`;
- `RADAR_GMAIL_ALERT_COLLECTION_ENABLED=true`;
- read-only `GMAIL_ALERT_OAUTH_ACCESS_TOKEN` a `GMAIL_ALERT_LABEL`;
- `RADAR_UPWORK_SIGNAL_ENABLED=true` nebo `RADAR_LINKEDIN_SIGNAL_ENABLED=true`;
- `RADAR_SOURCE_INGEST_SECRET`;
- existující interní access secret;
- read-only mailbox credential; collector aplikačně vynutí jediný vyhrazený
  label/folder, i když samotný Gmail OAuth grant není label-scoped.

Canary musí nejprve dostat samostatný autorizovaný Netlify entrypoint. Poté smí
read-only přečíst již doručený alert z vyhrazeného labelu, ověřit přesně jeden
signal-ingest write/readback/replay a dočasnou konfiguraci odstranit. Do Gmailu
nesmí zapisovat. Nesmí zapnout globální
`RADAR_SOURCE_COLLECTION_ENABLED` ani provést placený search.

## Detailní truth gate

Upwork signal lze povýšit pouze po ověření přesného buyer job detailu: aktivní
stav, deliverable, studio/team eligibility, budget provenance a funkční apply
cesta. LinkedIn signal musí být podle názvu, firmy a veřejných údajů převeden na
originální employer/ATS/buyer detail. Pokud takový originál neexistuje, zůstává
watchlist signálem a nesmí do sales workspace.

## Externí předpoklady

Repozitář nyní obsahuje Gmail transportní knihovnu a read-only readiness, nikoli
veřejný nebo plánovaný collector endpoint. Produkční spojení vyžaduje samostatné
schválení OAuth konfigurace a canary entrypointu. Token se nikdy nesmí předat do
browseru, logu, URL nebo repozitáře.

Oficiální podklady:

- [Upwork — Use bots and other automation properly](https://support.upwork.com/hc/en-us/articles/43342677368467-Use-bots-and-other-automation-properly)
- [Upwork — API key application](https://www.upwork.com/developer/keys/apply)
- [Upwork GraphQL API](https://www.upwork.com/developer/documentation/graphql/api/docs/index.html)
- [LinkedIn Talent API catalog](https://developer.linkedin.com/product-catalog/talent)
- [LinkedIn Job Posting API](https://learn.microsoft.com/en-us/linkedin/talent/job-postings/api/overview?view=li-lts-2026-04)
- [Gmail API — users.messages.list](https://developers.google.com/gmail/api/reference/rest/v1/users.messages/list)
- [Gmail API — OAuth scopes](https://developers.google.com/workspace/gmail/api/auth/scopes)
