# Předání pro Codex Desktop — ULTRA MAX Phase 1

Pracuješ jako implementační spolupracovník pro aktivní ChatGPT Work okno.
Komunikuj česky. Výsledek vrať uživateli jako přesnou předávací zprávu zpět do
Work okna; neprezentuj samostatnou alternativní roadmapu.

Repo: `Winters111222/3dsk-radar` (PUBLIC)

Autoritativní remote základ při zahájení:

- `main`: `528062e0b8d32f43d600bb5bb022e04e7686d99e`
- tree: `ed9ead9592df84a53000236b215dc7e35ba95109`
- Work branch: `feat/ultra-max-orchestrator-phase1`

Nejdřív načti `AGENTS.md` a autoritativní dokumenty, které vyžaduje. Potom
zkontroluj aktuální remote stav. Při změně base nebo nečistém/nejednoznačném
worktree skonči fail-closed a vrať diagnostiku do Work okna.

## Aktivní úkol

Pomoz dokončit první lokální code-only checkpoint M1 durable `ULTRA_MAX`
orchestrátoru. Work okno již připravuje čistý doménový kontrakt v
`src/server/ultra-max-run-contract.mjs`, testy a procentuální roadmapu.

Zkontroluj zejména:

1. zda sedm fází a jejich součty přesně drží root caps;
2. zda unikátní run identity nejsou vázané na UTC den;
3. zda stejný request půjde později idempotentně replaynout bez nového dispatch;
4. zda současný paid coordinator nelze nebezpečně znovu použít jako multi-stage
   root, protože dnes po jednom operation označuje run jako terminální;
5. jaký minimální repository/service slice má následovat;
6. které regresní testy jsou nutné před API/UI integrací.

## Povolený rozsah

- read-only audit nebo lokální code-only změny na výše uvedené branchi;
- lokální offline testy;
- návrh jednoho lokálního checkpointu.

## Zakázáno bez nového schválení ve Work okně

- push, PR, merge, preview nebo production deploy;
- změna `main`;
- Netlify environment/secrets/databáze;
- live source requests;
- placené OpenAI/Search;
- LinkedIn scraping nebo browser automation;
- automatické retry;
- jakýkoli secret či neveřejná data v public repu.

## Povinný výstup zpět do Work okna

- přesný branch/head/tree/parent;
- změněné soubory;
- výsledky cílených i kompletních testů;
- otevřená rizika a doporučený další slice;
- procento dokončení M1 i celého Ultra Radaru;
- realistický časový odhad dalšího kroku.
