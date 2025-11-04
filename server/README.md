# Shape Slayer Multiplayer Server

WebSocket-based multiplayer relay server for Shape Slayer game lobbies.

## Quick Start

```bash
cd server
npm install
npm start
```

Server runs on `ws://localhost:4000` (single-threaded by default).

### Configuration

Configure via `.env` file (easiest):

```bash
cp .env.example .env
# Edit .env with your preferred settings
nano .env
npm start
```

All settings in `.env` can also be set via environment variables:

```bash
SERVER_MODE=multi WORKER_COUNT=4 npm start
```

## Features

- **Lobby Management**: Create/join lobbies with 6-character codes
- **Host Authority**: First player controls game logic, server relays messages
- **Host Migration**: Automatic failover if host disconnects
- **Message Relay**: Low-latency forwarding between clients
- **Auto Cleanup**: Removes lobbies older than 1 hour
- **Multi-Core Support**: Optional clustering for high-scale deployments

## Configuration

### Basic Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Port | `4000` | WebSocket server port |
| Max Players | `4` | Players per lobby |
| Lobby Code | `6 chars` | Alphanumeric (no O/0, I/1) |
| Lobby TTL | `1 hour` | Auto-delete inactive lobbies |

### Environment Variables

```bash
# Server Mode (choose one)
SERVER_MODE=single                  # 'single' | 'multi' | 'slave' (default: single)

# Master server IP (required for slave mode)
MASTER_SERVER_IP=10.0.0.100         # IP of master server

# Worker configuration (multi/slave modes)
WORKER_COUNT=4                      # Number of workers (default: 2)
MAX_CONNECTIONS_PER_WORKER=1000     # Overload threshold (default: 500)
MAX_LOBBIES_PER_WORKER=200          # Overload threshold (default: 100)

# Server settings
PORT=4000                           # WebSocket port (default: 4000)
SERVER_ID=server-1                  # Unique server identifier
LOG_LEVEL=debug                     # debug | info | warn | error
LOG_HEALTH_METRICS=true             # Show worker stats (default: false)

# Redis settings (multi/slave modes)
REDIS_PORT=6379                     # Redis port (default: 6379)
REDIS_PASSWORD=yourpassword         # Optional password
REDIS_AUTO_MANAGE=true              # Auto-manage Docker (default: true)
```

## Scaling - Three Simple Modes

### Mode 1: Single Server, Single Thread (Default)

```bash
npm start
# or explicitly:
SERVER_MODE=single npm start
```

**Capacity**: 100-1,000 concurrent players  
**Requirements**: None  
**Best for**: Most deployments, development, small-medium scale

**How it works**: One process handles everything. Simple, reliable, no external dependencies.

---

### Mode 2: Single Server, Multi-Core (High Performance)

```bash
SERVER_MODE=multi WORKER_COUNT=4 npm start
```

**Capacity**: 1,000-5,000+ concurrent players  
**Requirements**: Docker installed (for Redis)  
**Best for**: High-traffic single server, production deployments

**How it works**: 
- Automatically creates Redis container in Docker
- Spawns 4 worker processes (configure with WORKER_COUNT)
- All workers share lobby state via Redis
- No sticky sessions needed - Redis handles coordination
- Acts as "master" ready to accept slave servers

**Note**: This is the same as "master" mode but without any slaves connected yet.

---

### Mode 3: Multi-Server Cluster (Massive Scale)

**Master Server** (10.0.0.100):
```bash
SERVER_MODE=multi \
WORKER_COUNT=4 \
SERVER_ID=master \
npm start
```

**Slave Servers** (connect to master):
```bash
# Slave Server 1 (10.0.0.101)
SERVER_MODE=slave \
MASTER_SERVER_IP=10.0.0.100 \
WORKER_COUNT=4 \
SERVER_ID=slave-1 \
npm start

# Slave Server 2 (10.0.0.102)
SERVER_MODE=slave \
MASTER_SERVER_IP=10.0.0.100 \
WORKER_COUNT=4 \
SERVER_ID=slave-2 \
npm start
```

**Capacity**: 10,000+ concurrent players (scale horizontally)  
**Requirements**: Docker on master, network connectivity between servers  
**Best for**: Massive scale, geographic distribution

**How it works**: 
- Master runs Redis + game server
- Slaves connect to master's Redis
- All servers share lobby state
- Players stay on original server (no transfers)
- Load balancer distributes new connections

**Load Balancer** (Caddy):
```caddyfile
yourdomain.com {
    reverse_proxy 10.0.0.100:4000 10.0.0.101:4000 10.0.0.102:4000 {
        lb_policy least_conn
    }
}
```

## Reverse Proxy Setup

### Caddy (Recommended)

```caddyfile
yourdomain.com {
    reverse_proxy localhost:4000 {
        lb_policy ip_hash    # Sticky sessions
    }
}
```

### Nginx

```nginx
upstream websocket_backend {
    ip_hash;    # Sticky sessions
    server localhost:4000;
}

server {
    listen 80;
    location / {
        proxy_pass http://websocket_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

## WebSocket Protocol

### Client → Server

**Create Lobby**
```json
{
  "type": "create_lobby",
  "data": {
    "playerName": "Player1",
    "class": "square"
  }
}
```

**Join Lobby**
```json
{
  "type": "join_lobby",
  "data": {
    "code": "A3X9K2",
    "playerName": "Player2",
    "playerClass": "hexagon"
  }
}
```

**Game State (Host Only)**
```json
{
  "type": "game_state",
  "data": {
    "players": [...],
    "enemies": [...],
    "projectiles": [...],
    "roomNumber": 5
  }
}
```

**Other Messages**: `leave_lobby`, `player_state`, `game_start`, `return_to_nexus`, `room_transition`, `enemy_damaged`, `enemy_state_update`, `player_damaged`, `loot_pickup`, `upgrade_purchase`, `currency_update`, `heartbeat`

### Server → Client

**Lobby Created**
```json
{
  "type": "lobby_created",
  "data": {
    "code": "A3X9K2",
    "playerId": "player-123",
    "isHost": true,
    "players": [...]
  }
}
```

**Lobby Joined**
```json
{
  "type": "lobby_joined",
  "data": {
    "code": "A3X9K2",
    "playerId": "player-456",
    "isHost": false,
    "players": [...]
  }
}
```

**Other Messages**: `player_joined`, `player_left`, `host_migrated`, `lobby_error`, `game_state`, `player_state`, `game_start`, `heartbeat_ack`

## Testing

```bash
# Start server
npm start

# Run test suite (in another terminal)
node test-server.js
```

Expected output:
```
✅ Lobby created successfully
✅ Player joined lobby successfully  
✅ Heartbeat acknowledged
✅ Invalid lobby correctly rejected
```

## Architecture

### Single-Threaded Mode (Default)
```
Client 1 ─┐
Client 2 ─┼─→ Server Process (Port 4000) ─→ Relay messages
Client 3 ─┘
```

All clients connect to one process. Simple and reliable.

### Multi-Worker Mode (Optional)
```
                    ┌─→ Worker 1 (handles lobbies A-F)
Reverse Proxy ─────┼─→ Worker 2 (handles lobbies G-M)
(Sticky Sessions)   └─→ Worker 3 (handles lobbies N-Z)
```

Each worker handles subset of lobbies. Requires reverse proxy with sticky sessions (IP hash) to route clients consistently.

**Load Balancing**: Master process monitors worker health (connections, lobbies, event loop lag) and migrates lobbies between workers if one becomes overloaded.

## Troubleshooting

### Port already in use
```bash
PORT=4001 npm start
```

### "Lobby not found" with multiple workers
Using multi-worker without sticky sessions? Players connecting to different workers can't see each other's lobbies.

**Solution**: Use single-threaded mode or add reverse proxy with sticky sessions.

### High CPU usage
Reduce worker count:
```bash
ENABLE_CLUSTERING=true WORKER_COUNT=2 npm start
```

### Debug connection issues
```bash
LOG_LEVEL=debug npm start
```

### Test connectivity
```bash
# Check if server is running
curl -i -N -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: test" \
  http://localhost:4000
```

## Production Deployment

### Simple (Most Users)
```bash
# Single-threaded, behind Caddy/nginx
npm start
```

### High Scale
```bash
# Multi-worker with reverse proxy + sticky sessions
ENABLE_CLUSTERING=true WORKER_COUNT=4 npm start
```

### Using PM2
```bash
# Install PM2
npm install -g pm2

# Start server
pm2 start mp-server.js --name shapeslayer-mp

# Auto-restart on reboot
pm2 startup
pm2 save
```

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY server/package*.json ./
RUN npm install
COPY server/ ./
EXPOSE 4000
CMD ["node", "mp-server.js"]
```

```bash
docker build -t shapeslayer-mp .
docker run -p 4000:4000 shapeslayer-mp
```

## Performance

| Mode | Workers | Concurrent Players | CPU Cores |
|------|---------|-------------------|-----------|
| Single-threaded | 1 | 100-1,000 | 1 |
| Multi-worker (2) | 2 | 500-2,000 | 2 |
| Multi-worker (4) | 4 | 1,000-4,000 | 4 |
| Multi-worker (8) | 8 | 2,000-8,000 | 8 |

**Recommendation**: Start with single-threaded. Scale to multi-worker if you exceed 500 concurrent players.

## Files

- `mp-server.js` - Entry point (detects single/multi mode)
- `mp-server-worker.js` - Worker process (handles WebSocket connections)
- `mp-server-master.js` - Master process (coordinates workers)
- `config.js` - Configuration and environment variables
- `test-server.js` - Automated test suite
- `package.json` - Dependencies

## License

MIT
