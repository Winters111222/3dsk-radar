# Persistent history and pre-live acceptance

- Refresh and return load saved team state after team access. A new access session requires the team code again; saved data are not deleted.
- Demo is explicit (EXPLORE DEMO) and never presented as saved team state.
- First found, last found and published dates are separate. A saved listing is not proof it is still active.
- Search upserts incoming records, keeps previously saved records, statuses, reply subject/body and company history.
- Last successful search timestamp and estimated cost are stored server-side and restored with the snapshot.
- Unknown model pricing remains N/A, never coerced from null to zero.

## Isolated deployed zero-cost acceptance

Temporarily set RADAR_PRELIVE_ACCEPTANCE_ENABLED=true while RADAR_LIVE_AI_ENABLED=false.
Open /?workspace=acceptance, authenticate with the production team access code, expand Pre-live system checks, and LOAD SHARED TEST DATA.
This seeds only radar-prelive-acceptance, never radar-state. Empty test stores are initialized; existing test records are not reset.
Exercise bookmark, BOOKMARKED, status, fixture contact recording and history through the same deployed Functions with the x-radar-workspace header. The acceptance workspace is rejected if its explicit gate is off or live AI is on.
CHECK AI LOCKS reads health then performs exactly one POST each to Search and Generate only when health is LOCKED; expect 423 LIVE_AI_LOCKED. No OpenAI request is intended or needed.
Reload, reopen in a fresh authenticated session and redeploy the same source to confirm test records survive, then disable RADAR_PRELIVE_ACCEPTANCE_ENABLED and redeploy before any paid acceptance.
Production opportunities remain empty until the first explicitly approved paid search; never seed real data with synthetic test records.

See WORK_DEPLOY_CHECKPOINT_20260905_CZ.md on checkpoint/work-deploy-20260905 for earlier environment limitations. Main and existing PRs remain unmerged pending final acceptance.
