# OpenAI key provisioning checkpoint — 2026-09-05

Navazuje na DEPLOYED_ZERO_COST_ACCEPTANCE_CZ.md (PASS). Runtime PR #9 bac185ca2b316852024fafd832e6acca23128c08 a locked production deploy 6a9c0f35e6e7a0354936e625 se nezměnily; main nebyl změněn.

Uživatel výslovně schválil vytvoření nového samostatného OpenAI API klíče pro Radar, přenos pouze server-side do Netlify a dočasné uložení do git-ignored .env.local s následným odstraněním. Tato oprávnění přetrvávají; při pokračování je nevyžadovat znovu.

Bezpečný lokální potvrzovací formulář opakovaně selhal na targetPath must be a non-empty string i s platnými parametry. Uživatel pak stejnou konkrétní dočasnou cestu potvrdil textově.

Přes oficiální helper byl připraven RSA public JWK. Jeden pokus create_encrypted_openai_api_key (name 3dsk-radar-acceptance-20260905, fallback bez konkrétních organization/project IDs) vrátil:
OpenAI Platform rejected the API key request.

Následná diagnostika list_openai_api_key_targets vrátila:
OpenAI Platform rejected the API key target request.

Konektor nevydal ciphertext ani API key; konkrétní důvod odmítnutí nebyl poskytnut. Nelze tvrdit, že je problém v kreditech či oprávněních. Nebyl proveden žádný Responses/Search/Generate model request. OPENAI_API_KEY nebyl uložen do .env.local ani Netlify; live AI zůstalo vypnuté. Pomocné dočasné RSA soubory byly odstraněny.

Další krok: obnovit funkční připojení OpenAI Platform / OpenAI Developers a opakovat bezpečné provisioning kroky podle skillu. Nepoužívat browser jako náhradu nefunkčního konektoru, nevkládat klíč do chatu. Po úspěšném přenosu klíče do Netlify odstranit schválenou lokální kopii; potom model/cost preflight a již schválený přesně jeden Search + jedna Response. Main/PR stack nemergovat před finální acceptance. V0.1: přibližně 99 %.
