# Prospektivní 30denní měření B2B a Individual výtěžnosti

## Účel

Historický backfill Astry přesně popsal šum, ale sám neměří, kolik nových
zakázek skutečně přichází v čase. Proto je připraven default-off plán
`config/prospective-yield-plan.v1.json`. Měření se nezačne pouhým mergem nebo
deployem: `started_at` a `ends_at` zůstávají `null`, dokud operátor výslovně
nezvolí začátek.

## Sledované kanály

| Platforma | Aktuální cesta | Stav automatizace |
| --- | --- | --- |
| LinkedIn | jeden uživatelem vytvořený denní e-mailový alert | zamčeno; LinkedIn je signal-only |
| Upwork | pět uživatelem vytvořených saved searches | ruční feed; automatické přihlášení zakázáno |
| Freelancer | dva manuální research watchlisty | vyžaduje písemné povolení; nebylo uděleno |

Výchozí Freelancer B `fl_unity_realistic` se do nového období automaticky
nepočítá. Má stav `REVERIFY_BEFORE_COUNTING`, protože aktivitu, rozsah a bid
cestu je nutné znovu potvrdit na originálním detailu.

### Aktuální Upwork B watch item — 10. 9. 2026

Přesný veřejný detail `3D Scan Cleanup — Full-Body Human Photogrammetry
(Ongoing)` byl 10. 9. 2026 znovu dostupný. Uváděl worldwide remote práci,
RealityCapture raw output, opravy rukou, prstů, vlasů, obličeje a děr, dávky
20–50 modelů z jedné akce, placený test a buyer rate 12–30 USD/h.

Jde o velmi silnou shodu pro `INDIVIDUAL_FREELANCE`, ale zůstává ve stavu
`REVERIFY_LOGGED_IN_APPLICATION_ROUTE_AND_CLIENT`. Před započtením je nutné v
uživatelově Upwork session ověřit, že lze stále podat proposal, stav platby a
riziko nového klienta, aktuální buyer response a realistickou požadovanou
rychlost. Konfigurace sama nabídku nepodá a nezapisuje ji do sales workspace.

## Povinné údaje review

Každý kandidát obsahuje platformu, ID konkrétního alertu/search/watchlistu,
`engagement_track`, signal URL, originální URL, čas kontroly a rozhodnutí
`ACCEPT_A`, `ACCEPT_B`, `PARTNER_C`, `SIGNAL_D` nebo `REJECT`.

Pro A/B musí být pravdivé:

- `original_detail_verified`;
- `active_status_verified`;
- `buyer_identity_verified`;
- `deliverable_verified`;
- `application_route_verified`;
- `studio_eligibility_verified` pro B2B, nebo
  `individual_eligibility_verified` pro individuální zakázku;
- `human_subject_verified` u human microtask dotazů.

LinkedIn A/B navíc potřebuje originální buyer/ATS zdroj mimo LinkedIn. C, D a
odmítnutí musí mít důvod a `outreach_locked=true`.

## Vyhodnocení

Offline příkaz:

```sh
npm run report:alerts:precision -- <manual-review.json>
```

Výstup uvádí A, B, C, D a odmítnutí celkem, podle platformy, podle konkrétního
dotazu a odděleně pro `B2B_STUDIO` a `INDIVIDUAL_FREELANCE`. Každá platforma
má vlastní gate: nejméně 30 ručně zkontrolovaných kandidátů a precision alespoň
80 %. Globální součet proto nemůže skrýt nevýtěžný zdroj.

## Bezpečnostní hranice

Plán nemění produkční data a nezapíná sběr, přihlášení, outreach, placený search
ani import. Nepoužívá cookies a neobchází login, CAPTCHA, robots nebo neveřejné
endpointy. Výsledek reportu vždy ponechává `runtime_activation: LOCKED`; případná
aktivace je samostatné budoucí rozhodnutí.
