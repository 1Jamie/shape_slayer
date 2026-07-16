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
| `METRICS_ALLOWED_ORIGIN` | CORS policy for browser / Electron uploads. Use `*` for fully open, `default` / unset for the built-in play-surface allowlist, or a comma-separated list of origins / patterns. | built-in play allowlist |

### CORS play surfaces

Telemetry is posted from several clients. The default allowlist accepts:

| Source | Example Origin |
| --- | --- |
| Production / gpe.pet | `https://shape-slayer.gpe.pet`, any `https://*.gpe.pet` |
| GitHub Pages | `https://1jamie.github.io`, any `https://*.github.io` |
| Local static server | `http://localhost:*`, `http://127.0.0.1:*` |
| Electron / `file://` | literal Origin `null` |

Patterns supported in `METRICS_ALLOWED_ORIGIN`:

- `*` – allow any origin
- exact origins – `https://shape-slayer.gpe.pet`
- host wildcards – `https://*.gpe.pet`, `https://*.github.io`
- localhost any port – `http://localhost:*`
- Electron null origin – `null`

Examples:

```bash
# Fully open (any website can POST ingest)
METRICS_ALLOWED_ORIGIN=*

# Strict custom list
METRICS_ALLOWED_ORIGIN=https://shape-slayer.gpe.pet,https://1jamie.github.io,null,http://localhost:*
```

Clients send credential-less `fetch` (`credentials: 'omit'`) with `Content-Type: application/json`. No cookies are involved.

The service stores data in `metrics.sqlite` under `metrics/server/data`. Migrations run automatically on startup.

## Production (Caddy reverse proxy)

In production the metrics service and multiplayer server sit behind Caddy auto-HTTPS on `gpe.pet`, for example:

| Public URL | Upstream |
| --- | --- |
| `https://metrics.gpe.pet` → `/ingest`, `/health`, `/status` | Node metrics on `localhost:4001` |
| `wss://shape-slayer.gpe.pet` | Node MP on `localhost:4000` |

Clients always post to the **public** ingest URL (`https://metrics.gpe.pet/ingest`), including GitHub Pages and Electron. They never talk to `:4001` directly.

CORS is decided by the **browser request `Origin`** (e.g. `https://1jamie.github.io`, `https://shape-slayer.gpe.pet`, or `null` for Electron/`file://`), not by the Caddy hostname. The metrics app emits `Access-Control-*` and `Cross-Origin-Resource-Policy` on responses.

Caddy should reverse-proxy HTTP (including `OPTIONS` preflight) through to Node and **not** inject its own conflicting CORS headers. A minimal site block:

```caddyfile
metrics.gpe.pet {
    reverse_proxy 127.0.0.1:4001
}
```

After deploying metrics-server changes, confirm with:

```bash
curl -si -X OPTIONS https://metrics.gpe.pet/ingest \
  -H 'Origin: https://1jamie.github.io' \
  -H 'Access-Control-Request-Method: POST' | grep -i access-control
```

You want a reflected `access-control-allow-origin: https://1jamie.github.io` (or `*` if you set `METRICS_ALLOWED_ORIGIN=*`), and `cross-origin-resource-policy: cross-origin`.

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
