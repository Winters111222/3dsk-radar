# Stage 4 — Generate Response

Stage 4 dokončuje poslední placenou produktovou akci, ale před final acceptance zůstává fyzicky zamčená přes `RADAR_LIVE_AI_ENABLED=false`.

## Contract

Uživatel vybere jednu opportunity a klikne `GENERATE RESPONSE`.

Server načte opportunity ze shared persistence podle ID. Browser tedy neposílá volný text, kterým by mohl podvrhnout source facts.

Server načte autoritativní company profile a modelu předá pouze:

- capability `APPROVED + outbound_safe`,
- credential `PUBLIC_APPROVED + outbound_safe + verification_url`,
- restricted claims,
- normalizovaná fakta a source evidence konkrétní opportunity.

Model generuje pouze:

- `subject`,
- `body`,
- ID použitých approved capabilities/credentials.

`TO` model negeneruje. Server nastaví `TO = opportunity.contact_email`, pouze pokud byl kontakt už source-gated v search pipeline. Jinak zůstává `null`.

## Reply quality

Default reply model je `gpt-5.6-sol`, protože reply je samostatná uživatelem spuštěná akce a kvalita má vyšší prioritu než minimální token cost. Search zůstává cost-sensitive na Luna.

Default text:

- English,
- cca 120–220 slov,
- konkrétní na poptávku,
- bez marketingového balastu,
- bez ceny/deadline/capacity promise,
- CTA: call / sample data / test batch / pipeline requirements / scope for quotation.

## Persistence

Po úspěšném generování se do opportunity uloží:

```text
reply_to
reply_subject
reply_body
reply_generated_at
reply_model
reply_response_id
```

Díky tomu reply nezmizí po reloadu a `MARK EMAIL SENT` může do company outreach historie uložit použitý subject.

## Zero-cost acceptance

Fixture dataset má lokální `FIXTURE_PREVIEW` generator pouze pro ověření celého UI flow:

`SELECT → GENERATE RESPONSE → COPY SUBJECT → COPY RESPONSE → MARK EMAIL SENT`

Tento fixture generator není produkční obchodní AI a nic nevolá ven.

První skutečné OpenAI volání se smí provést až po dokončení celé aplikace a explicitním zapnutí `RADAR_LIVE_AI_ENABLED=true` jako poslední acceptance krok.
