# Hitboard

Live scores, props and hit rates for NFL, NBA, NCAAF and NCAAB. Installable web app. For entertainment and research only, not betting advice.

## DraftKings odds (The Odds API)
A scheduled GitHub Action (`.github/workflows/odds.yml`) runs `scripts/fetch-odds.mjs` four times a day, saves DraftKings spreads, totals and moneylines to `odds.json`, and the app reads that file.

Setup: get a free key at the-odds-api.com, then add it as a repository secret named `ODDS_API_KEY` (Settings > Secrets and variables > Actions). Run it once by hand from the Actions tab (Run workflow). The free plan is about 500 credits a month and each sport costs 3 credits per run, so the script skips sports with no games in the next 30 hours and stops when fewer than 25 credits remain.
