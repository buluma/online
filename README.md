# The Nines

The Nines is a live uptime comparison of Claude and OpenAI, built with Vite and vanilla JavaScript.

A GitHub Action fetches status data every hour from public Statuspage APIs and commits the result. Vercel picks up the push and redeploys.

## How It Works

The site pulls a 90-day rolling window of per-service status from `status.claude.com` and `status.openai.com`. Daily statuses are normalized into compact status strings and turned into:

- aggregate health bars
- per-category comparison cards
- weighted daily winners
- streaks, ties, and comeback moments

Historical cells are day-bucketed. Today's cell is refreshed from the current component summary so the live page and the latest bar stay aligned.

API and chat products are weighted more heavily than coding products.

## Methodology

- Claude source: `status.claude.com`
- OpenAI source: `status.openai.com`
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
  data.js               seed/fallback data
public/
  data/status.json      live status (committed by CI)
  og.png, favicon.svg   static assets
scripts/
  fetch-status.js       fetches APIs, normalizes, writes status.json
  smoke-test.js         validates output against live APIs
.github/workflows/
  fetch-status.yml      hourly cron action
```

## Running Locally

```bash
npm install
npm run fetch   # pull latest status data
npm run dev     # start Vite dev server
```

## Testing

```bash
npm run fetch && npm test
```

The smoke test validates structure, uptime math, incident attribution, real-time status alignment, and component coverage.

## Limitations

- Daily rollups compress incidents into a simpler comparison model.
- Some source systems expose richer data than others, so the comparison involves normalization.
- This is an independent interpretation of public status data, not an official benchmark.

## License

MIT. See [`LICENSE`](./LICENSE).
