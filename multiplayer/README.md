# Shape Slayer Multiplayer Relay

The multiplayer service is a WebSocket relay for Shape Slayer game lobbies.
Combat and world simulation remain host-authoritative; the relay manages lobby
membership, routes gameplay frames, supports host reconnection/failover, and
optionally uses Redis as a cross-worker lobby directory.

It does not receive telemetry. Metrics ingestion and storage live under
`metrics/`.

## Quick start

Single-process mode needs no Redis:

```bash
cd multiplayer
npm install
npm start
```

The relay listens on `ws://localhost:4000` by default.

## Runtime modes

### `SERVER_MODE=single`

One relay process owns every lobby. This is the default and is the simplest
choice for development and modest deployments.

```bash
cd multiplayer
SERVER_MODE=single npm start
```

### `SERVER_MODE=multi`

The master forks `WORKER_COUNT` workers. Each worker listens on a distinct
port beginning at `PORT`:

- worker 0: `PORT`
- worker 1: `PORT + 1`
- worker 2: `PORT + 2`

Redis stores only the lobby ownership directory. A lobby remains on one relay
worker during normal play; Redis is not used as a gameplay pub/sub bus.

```bash
# From repository root; harness bootstraps Redis when possible.
SERVER_MODE=multi WORKER_COUNT=2 REDIS_AUTO_MANAGE=true \
  PUBLIC_HOST=127.0.0.1 npm run server -- --only=mp

# Or use Redis that is already running.
SERVER_MODE=multi WORKER_COUNT=2 REDIS_AUTO_MANAGE=false \
  REDIS_HOST=127.0.0.1 REDIS_PORT=6379 PUBLIC_HOST=127.0.0.1 \
  npm run server -- --only=mp
```

### `SERVER_MODE=slave`

Slave mode starts workers that use a remote Redis directory. Set
`MASTER_SERVER_IP` to the Redis host and ensure every worker's advertised
`PUBLIC_HOST` and port are reachable by clients.

```bash
cd multiplayer
SERVER_MODE=slave MASTER_SERVER_IP=10.0.0.100 \
  WORKER_COUNT=2 SERVER_ID=relay-b PUBLIC_HOST=relay-b.example.com \
  npm start
```

This mode shares lobby ownership through Redis; it is not a complete
control-plane or global load-balancer. The deployment must expose and route
the advertised per-worker WebSocket endpoints.

## Redis directory and routing

Lobby creation uses:

```text
SET lobby:<CODE> <ownership-json> EX <ttl> NX
```

`NX` makes code claims atomic across simultaneous workers. Ownership records
include the server ID, worker ID, and public WebSocket endpoint. The owner
refreshes the key TTL while the lobby exists.

When a client joins through the wrong worker, that worker returns:

```json
{
  "type": "redirect",
  "data": {
    "url": "ws://relay.example.com:4001",
    "code": "A3X9K2",
    "reason": "lobby_owner"
  }
}
```

The browser reconnects to `data.url` and retries the join. Redirect depth is
connection-scoped and capped by `MAX_REDIRECT_HOPS` in
`src/game/networking/mp-config.js` (default: `2`); it is not stored on `window`.

`PUBLIC_HOST` must be a hostname or address clients can reach. For TLS
deployments set `PUBLIC_WS_SCHEME=wss` and arrange TLS termination/routing for
every advertised worker endpoint.

## Lobby migration

Cross-worker migration is disabled unless both clustering and
`ENABLE_LOBBY_MIGRATION=true` are enabled.

The migration sequence is:

1. Source worker serializes the lobby roster.
2. Master forwards the snapshot to the target worker.
3. Target imports the lobby and replaces its Redis ownership record.
4. Master confirms the import before removing the source copy.
5. Source sends redirect frames and closes the old sockets.
6. Clients reconnect with `persistentPlayerId`.

The snapshot preserves:

- player and persistent IDs
- host identity
- names and classes
- ready/disconnected status
- currency and upgrades
- safe-room metadata

The server does not persist a complete authoritative in-flight world snapshot
in Redis. Gameplay remains host-authoritative, so migration relies on client
reconnection/state restoration for the active run.

`ALLOW_TEST_MIGRATION=true` enables the internal
`test_migrate_lobby` frame used only by `tests/mp-cluster-smoke.js`. Do not
enable it in production.

## Redis on Atomic/Bazzite with distrobox

The harness tries container CLIs in this order:

1. Docker
2. local Podman
3. `host-spawn podman`
4. `distrobox-host-exec podman`

Manual host-Podman setup:

```bash
host-spawn podman run -d --name shapeslayer-redis --replace \
  -p 6379:6379 docker.io/library/redis:alpine

SERVER_MODE=multi WORKER_COUNT=2 REDIS_AUTO_MANAGE=false \
  PUBLIC_HOST=127.0.0.1 npm run server -- --only=mp
```

The harness verifies readiness with a raw RESP `PING`/`PONG`; it does not add
a Redis framework client to the harness. The relay itself uses `ioredis`.

## Configuration

Copy the example file for direct relay launches:

```bash
cd multiplayer
cp .env.example .env
npm start
```

Important environment variables:

```bash
# Runtime
SERVER_MODE=single               # single | multi | slave
PORT=4000                        # first worker's port
WORKER_COUNT=2
SERVER_ID=server-1
PUBLIC_HOST=localhost            # embedded in redirect URLs
PUBLIC_WS_SCHEME=ws              # ws | wss

# Redis (multi/slave)
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_AUTO_MANAGE=true           # harness container bootstrap
REDIS_CONTAINER_NAME=shapeslayer-redis
REDIS_IMAGE=redis:alpine
LOBBY_DIRECTORY_TTL_SECONDS=60

# Migration/load monitoring
ENABLE_LOAD_BALANCING=true
ENABLE_LOBBY_MIGRATION=false

# Limits
MAX_PLAYERS_PER_LOBBY=4
WS_MAX_PAYLOAD_BYTES=262144
MAX_MESSAGES_PER_SOCKET_PER_SECOND=120

# Logging
LOG_LEVEL=info
LOG_HEALTH_METRICS=false
LOG_LOAD_BALANCING=false
```

See `config.js` and `.env.example` for the full set.

## Protocol essentials

Create a lobby:

```json
{
  "type": "create_lobby",
  "data": {
    "playerName": "Player1",
    "class": "square",
    "persistentPlayerId": "stable-client-id"
  }
}
```

Join a lobby:

```json
{
  "type": "join_lobby",
  "data": {
    "code": "A3X9K2",
    "playerName": "Player2",
    "playerClass": "hexagon",
    "persistentPlayerId": "stable-client-id"
  }
}
```

Successful create/join frames include the lobby code, player ID, host status,
and serialized player roster. Clustered joins may first receive the redirect
frame shown above.

Inbound frame types are explicitly allowlisted. WebSocket payload size and
per-socket message rate are capped through configuration.

## Reverse proxy requirements

Single mode can use a conventional WebSocket reverse proxy to port `4000`.

Directory mode does not depend on sticky sessions for correctness. Initial
connections may reach any worker because the Redis directory redirects joins
to the owner. However, every endpoint placed in Redis must be externally
reachable. A proxy that exposes only port `4000` is insufficient if redirects
advertise `4001`, `4002`, and so on.

Example for a single relay:

```caddyfile
relay.example.com {
    reverse_proxy localhost:4000
}
```

For multi mode, expose each worker endpoint directly or configure distinct
public routes/hosts that map to each worker and ensure `PUBLIC_HOST` plus the
advertised ports match that topology.

## Testing

Unit and boundary tests from the repository root:

```bash
npm run test:boundaries
npm run test:redis-directory
npm run test:redis-ready
npm test
```

Basic direct-relay test:

```bash
cd multiplayer
npm start
# another terminal
node test-server.js
```

Live two-worker Redis smoke:

```bash
# Start Redis first, then:
SERVER_MODE=multi WORKER_COUNT=2 REDIS_AUTO_MANAGE=false \
  PUBLIC_HOST=127.0.0.1 ALLOW_TEST_MIGRATION=true \
  npm run server -- --only=mp

# Another terminal:
node tests/mp-cluster-smoke.js
```

The smoke stays intentionally small. It checks:

- Redis ownership after create
- wrong-worker redirects in both directions
- redirected join and host notification
- four concurrent `SET NX` claims with exactly one winner
- migration redirect and Redis ownership transfer
- host and peer reconnection on the target worker
- preserved two-player roster
- routing through the old worker after migration

## Troubleshooting

### Redis is unavailable

Multi/slave modes require Redis. Verify `REDIS_HOST`/`REDIS_PORT`, or use
`REDIS_AUTO_MANAGE=true` through the root harness.

### Lobby not found on owner worker

This indicates a stale or incorrect directory record, or an interrupted
migration. Confirm the endpoint stored in Redis matches the worker currently
holding the lobby.

### Redirect loop

Confirm:

- each worker listens on a distinct port
- `PUBLIC_HOST` is client-reachable
- all advertised worker ports/routes are exposed
- a stale Redis ownership key is not pointing at the wrong worker

The client stops after the configured redirect-hop limit.

### Port already in use

```bash
PORT=4100 SERVER_MODE=single npm start
```

In multi mode reserve `WORKER_COUNT` consecutive ports beginning at `PORT`.

## Files

- `mp-server.js` — selects single or clustered startup
- `mp-server-master.js` — worker lifecycle, health monitoring, migration coordination
- `mp-server-worker.js` — WebSocket connections, lobbies, relay, migration import/export
- `redis-directory.js` — atomic claims and Redis ownership records
- `config.js` — environment configuration and validation
- `test-server.js` — basic direct-relay smoke
- `package.json` — relay dependencies and scripts

## License

MIT
