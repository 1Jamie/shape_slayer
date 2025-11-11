# Metrics Ingestion Service

Node/Express service that accepts gameplay telemetry from Shape Slayer clients and persists it into an embedded SQLite database.

## Requirements

- Node.js 18+
- npm

## Getting Started

```bash
cd metrics/server
npm install
npm run dev
```

Environment variables:

| Variable | Description | Default |
| --- | --- | --- |
| `METRICS_PORT` | HTTP port for the ingestion service | `4001` |
| `METRICS_INGEST_TOKEN` | Shared secret for uploads. If set, clients must send `x-metrics-token` or `Authorization: Bearer` headers. | _(unset)_ |

The service stores data in `metrics.sqlite` under `metrics/server/data`. Migrations run automatically on startup.

## API

- `GET /health` – Simple readiness probe
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


