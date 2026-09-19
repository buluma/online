# Online

Online is a live uptime comparison of Claude, OpenAI, and GitHub, built with Vite and vanilla JavaScript.

A GitHub Action fetches status data every 3 hours from public Statuspage APIs and commits the result. GitHub Pages picks up the push and redeploys.

## How It Works

The site pulls a 90-day rolling window of per-service status from `status.claude.com`, `status.openai.com`, and `githubstatus.com`. Daily statuses are normalized into compact status strings and turned into:

- aggregate health bars
- per-category comparison cards
- weighted daily winners
- streaks, ties, and comeback moments

Historical cells are day-bucketed. Today's cell is refreshed from the current component summary so the live page and the latest bar stay aligned.

API and chat products are weighted more heavily than coding products.

## Methodology

- Claude source: `status.claude.com`
- OpenAI source: `status.openai.com`
- GitHub source: `githubstatus.com`
- Window: 90 days (rolling)
- Status classes: operational, degraded, partial outage, major outage, maintenance
- Daily scoring:
  - operational = 100%
  - degraded = 60%
  - partial outage = 30%
  - major outage = 0%
  - maintenance = 80%

## Repo Structure

```
index.html              page structure and metadata
src/
  main.js               app logic, scoring, rendering
  styles.css            layout, theme, responsive styles
  data.js               offline fallback data (generated, see below)
public/
  data/status.json      live status (committed by CI)
  og.png, favicon.svg   static assets
scripts/
  fetch-status.js       fetches APIs, normalizes, writes status.json
  openai-groups.js      maps OpenAI status components to tracked groups
  provider-status.js    parses provider pages and feeds
  refresh-seed.js       regenerates src/data.js from status.json
  smoke-test.js         validates status.json (--offline skips live checks)
.github/workflows/
  fetch-status.yml      3-hourly cron action
  ci.yml                unit tests and offline smoke test
  deploy.yml            GitHub Pages deployment
```

## Data Pipeline

1. `fetch-status.yml` runs every 3 hours (or manually) and writes `public/data/status.json`.
2. The full smoke test compares that file against the live provider pages. If it fails, nothing is committed.
3. On success the file is committed to `master` and a Pages deploy is triggered.
4. If a run fails, the workflow opens a `fetch-failure` issue and closes it when a later run succeeds. The site also shows a banner when the data is more than 12 hours old.

`src/data.js` is the fallback shown when `status.json` and the browser cache are both unavailable. It is a snapshot and does not update itself. Refresh it occasionally with `npm run fetch && npm run seed`, then commit.

If OpenAI adds a status component, the smoke test warns that it is unassigned. Add it to `OPENAI_COMPONENT_GROUPS` in `scripts/openai-groups.js`.

## Running Locally

```bash
npm install
npm run fetch   # pull latest status data
npm run dev     # start Vite dev server
```

## Testing

```bash
npm test            # unit tests + offline smoke test (no network)
npm run test:live   # also compares status.json to the live provider pages
```

`npm test` validates structure and internal consistency, so it does not depend on live provider state. `npm run test:live` additionally checks history alignment and real-time status against the providers, and is only meaningful right after `npm run fetch`.

## Limitations

- Daily rollups compress incidents into a simpler comparison model.
- Some source systems expose richer data than others, so the comparison involves normalization.
- This is an independent interpretation of public status data, not an official benchmark.
- GitHub Pages doesn't support custom caching headers, so `status.json` is fetched on every page load.

## License

MIT. See [`LICENSE`](./LICENSE).
