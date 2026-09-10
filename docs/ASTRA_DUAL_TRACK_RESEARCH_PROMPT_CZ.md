# Astra Deep Research — rozšíření Radaru o B2B a individuální projekty

Tento prompt je určený pro samostatné maximálně důkladné Deep Research vlákno.
Výstup bude následně importován do 3D.SK Opportunity Radaru jako code-only,
runtime-locked evidence. Research nemá nic programovat, nasazovat ani aktivovat.

## Prompt k předání Astře

Proveď maximálně důkladný worldwide Deep Research pro produkt **3D.SK
Opportunity Radar**. Radar nově musí hledat dvě oddělené obchodní koleje:

1. `B2B_STUDIO` — zakázky pro studio/vendor tým, outsourcing, external
   development, production overflow, subdodávky, RFP/RFQ, tendry, grantové
   příjemce a partnerství;
2. `INDIVIDUAL_FREELANCE` — skutečné buyer-posted freelance nebo project-based
   úkoly, které může realizovat jeden kvalifikovaný specialista, včetně jediného
   human scanu nebo malého počtu assetů.

Obě koleje pokrývají stejné schopnosti 3D.SK: human full-body/head/face/body
scanning, human photogrammetry, digital doubles, RealityCapture reconstruction,
ZBrush/Sculptris Pro scan cleanup, opravy rukou/prstů/vlasů/děr, Faceform
Wrap3D/R3DS Wrap a topology transfer, Substance Painter, texture cleanup a
reprojection, facial/FACS processing, realistic-human character finishing,
character outsourcing, pipeline consulting a vzdálenou postprodukci
kulturního dědictví. Povinná produkční pipeline je RealityCapture → ZBrush →
Substance Painter → Wrap3D od Faceformu; Blender je pouze doplňkový.

Nevyhledávej jen explicitní názvy nástrojů. Použij semantic buyer-intent a
event-driven discovery také pro zadání typu: supplied raw scan needs fixing,
repair fused/missing fingers, likeness cleanup, scan-to-production topology,
one avatar/character finishing, texture seam repair, head/face asset cleanup,
batch or single-asset handoff, artist needed for a defined paid deliverable.

Přísně odděluj individuální projekt od zaměstnání. Odmítni permanentní,
full-time, payroll, employee benefits, annual salary, visa/work authorization,
CV/resume recruitment a onsite práci mimo způsobilou geografii. Slovo
contractor, hourly nebo contract samo nestačí; originální detail musí prokázat
kupujícího, konkrétní deliverable, aktivní možnost přihlášení a způsobilost
nezávislého jednotlivce. U B2B musí originální detail prokázat studio/vendor
eligibility. Nevyřazuj individuální projekt pouze kvůli malému rozsahu nebo
jedinému assetu.

Zachovej stávající scope a odmítni Reallusion, Character Creator, iClone,
Daz3D, stylized-only/generalist práci, animation-only, software development bez
produkčních assetů, seller profily, outsourcingová studia vydávající se za
kupující, neaktivní nabídky, neověřitelné URL, domyšlené kontakty a fyzické
skenování mimo ČR/SR bez remote-postproduction možnosti. U širokých výrazů jako
3D mesh repair nebo retopology přijmi jen human/character práci nebo již
schválený kulturně-heritage scope; odmítni pneumatiky, stroje, produkty,
budovy, printing a miniatury.

Prozkoumej zejména Upwork přes oficiální přístup nebo compliant indexované
výsledky, Freelancer, PeoplePerHour, Guru, Contra, Malt, Useme, Polycount,
ArtStation, Unreal/Unity komunity, Work With Indies, Hitmarker, relevantní
Reddit přes official API a další legální marketplace/community zdroje. Dále
zachovej TED EU, NEN, E-ZAK, ÚVO, JOSEPHINE, Find a Tender, Contracts Finder a
CZ/SK grantové a heritage zdroje. Neobcházej login, CAPTCHA, robots ani ochrany
platforem.

Hledej v minimálně těchto jazycích: EN, DE, FR, ES, IT, PL, CS, SK. Navrhni
latentní buyer-intent dotazy i negativní filtry. U každého zdroje uveď:

- podporované koleje `B2B_STUDIO` / `INDIVIDUAL_FREELANCE`;
- očekávanou výtěžnost a confidence;
- přístupovou metodu;
- právní/ToS omezení;
- potřebnou autorizaci nebo credential;
- přesnou detail-verification metodu;
- zda lze získat alert/RSS/API bez scrapingu;
- typické false positives;
- alespoň dva pozitivní a dva negativní evidence příklady, pokud existují.

Každého konkrétního kandidáta klasifikuj jako:

- A: otevřená, detailně ověřená příležitost;
- B: otevřená příležitost s jasně označenou chybějící pravdou;
- C: partner/subcontract signal, nikoli otevřená zakázka;
- D: watch signal;
- REJECT.

U A/B povinně uveď `engagement_track`, originální URL, aktivní stav, buyer,
konkrétní deliverable, geografii/remote režim, studio nebo individual
eligibility, budget provenance a aplikační cestu. Neodhaduj e-maily. U C/D
ponech outreach locked.

Výstup připrav ve třech souborech:

1. detailní DOCX report;
2. XLSX evidence registr kandidátů, zdrojů, dotazů, pozitivních/negativních
   příkladů a source yield;
3. syntakticky validní JSON manifest připravený pro vývojáře, s oddělenými
   poli `engagement_track`, `studio_eligibility`, `individual_eligibility`,
   `access_method`, `verification_method`, `enabled:false` a provenance.

Na konci přesně spočítej počet A/B/C/D/REJECT zvlášť pro B2B a Individual a
navrhni seřazený implementační balík s nejvyšší očekávanou bezpečnou výtěžností.
Neprohlašuj cíl 10 použitelných výsledků za splněný, pokud není alespoň 10
skutečných A/B s ověřeným originálním detailem.
