# Metrics Ingestion Service

Node/Express service that accepts gameplay telemetry from Shape Slayer clients and persists it into an embedded SQLite database.

## Requirements

- Node.js 18+
- npm
- C++ build toolchain for `better-sqlite3` (usually `gcc-c++` / `make` on Linux, Xcode CLI tools on macOS)

## Getting Started

From the repo root:

```bash
npm run metrics:install
npm run metrics:start
```

Or manually:

```bash
cd metrics/server
npm install
npm start
```

The dashboard GUI lives in `metrics/gui` and starts alongside ingestion when using `npm run metrics:start`.

Environment variables:

| Variable | Description | Default |
| --- | --- | --- |
| `METRICS_PORT` | HTTP port for the ingestion service | `4001` |
| `METRICS_DB_PATH` | Override SQLite file location | `metrics/server/data/metrics.sqlite` |
| `METRICS_INGEST_TOKEN` | Shared secret for uploads. Clients send `x-metrics-token` or `Authorization: Bearer`. | _(unset)_ |
| `METRICS_ALLOWED_ORIGIN` | CORS origin for browser uploads | `*` |

The service stores data in `metrics.sqlite` under `metrics/server/data`. Migrations run automatically on startup.

## Client configuration

In the game page, optional globals:

```html
<script>
  window.METRICS_ENDPOINT = 'http://127.0.0.1:4001/ingest';
  window.METRICS_INGEST_TOKEN = 'change-me';
</script>
```

Telemetry is host-only in multiplayer and requires the player opt-in in privacy settings.

## API

- `GET /health` – Simple readiness probe
- `GET /status` – Uptime and version
- `POST /ingest` – Accepts telemetry payloads following `metrics/docs/schema.md`

### POST /ingest

```json
{
  "run": { /* run payload */ },
  "submittedAt": "2025-11-10T12:00:00.000Z",
  "clientVersion": "1.2.3",
  "authToken": "optional"
}
```

Responses:

- `201 Created` – Run ingested
- `200 OK` – Run already ingested (idempotent)
- `400 Bad Request` – Validation failed
- `401 Unauthorized` – Missing or invalid ingest token
- `500 Internal Server Error` – Failed to persist data

## Testing

```bash
npm test --prefix metrics/server
npm run metrics:test
```
