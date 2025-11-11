# Metrics Dashboard GUI

Express-based dashboard for exploring the telemetry captured by the metrics ingestion service.

## Requirements

- Node.js 18+
- The ingestion service (`metrics/server`) running locally to populate `metrics.sqlite`.

## Getting Started

```bash
cd metrics/gui
npm install
npm run dev
```

By default the dashboard binds to port `5000`. Set `METRICS_GUI_PORT` to override.

The server reads from the shared SQLite database at `../server/data/metrics.sqlite`. Ensure the ingestion service has created the database before launching the GUI.

## API Endpoints

All endpoints return JSON and are served from the same origin as the dashboard:

- `GET /api/summary` – Global aggregates (run counts, modes, affixes, boss metrics).
- `GET /api/runs?limit=50` – Recent runs including total damage and hits.
- `GET /api/runs/:runId` – Detailed telemetry for a single run (players, rooms, bosses, affixes).

## Frontend

- Served from `metrics/gui/public`.
- Uses Chart.js (via CDN) for visualizing room-by-room damage.
- Responsive layout with dark theme to match the game's aesthetic.


