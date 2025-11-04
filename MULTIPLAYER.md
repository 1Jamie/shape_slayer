# Shape Slayer - Multiplayer System

## Overview

Shape Slayer now supports co-op multiplayer for up to 4 players using a lobby-based system with join codes.

### Key Features

- **Modular Design**: Multiplayer is an optional add-on that doesn't affect single-player gameplay
- **Lobby System**: Create or join lobbies with 6-character codes (e.g., "A3X9K2")
- **Host Authority**: Host player runs game logic; clients receive and render state
- **Full Sync**: All player animations, enemies, projectiles, and effects are synchronized
- **Class Flexibility**: Multiple players can use the same class
- **Graceful Fallback**: Game works 100% offline without a server

## Architecture

### Server
- **Location**: `server/mp-server.js` (entry point), `server/mp-server-master.js` (clustering), `server/mp-server-worker.js` (workers)
- **Port**: 4000 (WebSocket, configurable)
- **Role**: Lobby management and message relay
- **Protocol**: Native WebSockets (ws library)
- **Deployment Modes**: Single-threaded (default), Multi-worker (clustering), Slave (multi-server)
- **Detailed Documentation**: See `server/README.md` for complete server architecture, clustering, and deployment guides

### Client
- **Configuration**: `js/mp-config.js` (easily change server URL)
- **Module**: `js/multiplayer.js` (dynamically loaded)
- **Integration**: UI, Main, and Nexus modified to support multiplayer

## Setup & Testing

### 1. Install Server Dependencies

```bash
cd server
npm install
```

### 2. Start the Multiplayer Server

**Simple Setup (Recommended for most users)**:
```bash
cd server
npm start
```

The server will start in single-threaded mode on port 4000. You should see:
```
========================================
  Shape Slayer Multiplayer Server
  SINGLE-THREADED MODE
========================================
  Local:    ws://localhost:4000
  Network:  ws://YOUR_IP:4000
  Status:   Running
========================================
```

**Advanced Setup (High Performance)**:

For high-traffic deployments with clustering support:
```bash
cd server
SERVER_MODE=multi WORKER_COUNT=4 npm start
```

For multi-server cluster (requires master server):
```bash
cd server
SERVER_MODE=slave MASTER_SERVER_IP=10.0.0.100 WORKER_COUNT=4 npm start
```

**Configuration Options**:
- Single-threaded mode: 100-1,000 concurrent players (default)
- Multi-worker mode: 1,000-5,000+ concurrent players (requires Docker for Redis)
- Slave mode: 10,000+ concurrent players (multi-server horizontal scaling)

For complete server setup documentation, deployment modes, clustering configuration, and troubleshooting, see **`server/README.md`**.

### 3. Start the Game Server

In a separate terminal:

```bash
# From project root
node server.js
```

The game will be accessible at `http://localhost:3000`

### 4. Test Multiplayer

#### Creating a Lobby (Player 1 - Host)

1. Open `http://localhost:3000` in your browser
2. Navigate to the Nexus (main hub area)
3. Press `ESC` to open pause menu
4. Click "Multiplayer" button
5. Click "Create Lobby"
6. Note the 6-character lobby code (e.g., "A3X9K2")
7. Select a class in the Nexus
8. Other players can now join

#### Joining a Lobby (Player 2-4 - Clients)

1. Open `http://localhost:3000` in a **new browser window/tab** (or different browser)
2. Navigate to the Nexus
3. Press `ESC` to open pause menu
4. Click "Multiplayer" button
5. Enter the 6-character lobby code
6. Click "Join Lobby"
7. Select a class in the Nexus
8. Wait for host to start the game

#### Starting the Game

1. Only the **host** can start the game
2. Host walks to the portal in the Nexus center
3. Press `G` when near the portal
4. All connected players will transition to the game together
5. You should see all players moving, attacking, and taking damage

### 5. What to Test

#### Basic Functionality
- [ ] Create lobby and get join code
- [ ] Join lobby with code
- [ ] See other players in lobby list
- [ ] Host can start game from portal
- [ ] Non-host cannot start game (shows "Only host can start")

#### In-Game Sync
- [ ] See all players moving in real-time
- [ ] See all player animations (attacking, dodging, abilities)
- [ ] See player health bars above remote players
- [ ] See class-specific effects (warrior shield, mage orbs, etc.)
- [ ] All players see the same enemies
- [ ] All players see the same projectiles
- [ ] Damage numbers appear correctly

#### Disconnection Handling
- [ ] Player disconnects mid-game (remove from lobby)
- [ ] Host disconnects (migrate to next player OR end session)
- [ ] Server offline (graceful fallback, no crash)
- [ ] Reconnection attempts (up to 3 tries)

#### Edge Cases
- [ ] 4 players in one lobby (max capacity)
- [ ] Try to join full lobby (error message)
- [ ] Invalid lobby code (error message)
- [ ] Leave lobby mid-game
- [ ] Multiple classes (different players with different classes)
- [ ] Same classes (multiple players as same class)

## Configuration

### Changing Server URL

Edit `js/mp-config.js`:

```javascript
const MultiplayerConfig = {
    // For local testing
    SERVER_URL: 'ws://localhost:4000',
    
    // For production with SSL
    // SERVER_URL: 'wss://yourdomain.com',
    
    // For LAN testing
    // SERVER_URL: 'ws://192.168.1.100:4000',
};
```

### Server Port

Edit `server/mp-server.js`:

```javascript
const PORT = 4000; // Change to your desired port
```

## Troubleshooting

### "Failed to connect to server"

- Check that multiplayer server is running (`cd server && npm start`)
- Verify server URL in `js/mp-config.js` matches your setup
- Check firewall/port forwarding (port 4000)

### "Lobby not found"

- Lobby codes are case-sensitive
- Lobbies expire after 1 hour
- Server may have restarted (lobbies don't persist)

### Players not syncing

- Check browser console for errors
- Verify all players connected successfully
- Check server logs for disconnection messages
- Network lag may cause delay (throttled to 30 updates/sec)

### "Only host can start"

- This is intentional - only the first player (host) can start
- If host left, next player becomes host
- Check lobby list to see who is host (indicated with "(Host)")

## Technical Details

### Message Types

**Client → Server:**
- `create_lobby` - Create new lobby
- `join_lobby` - Join existing lobby
- `leave_lobby` - Leave current lobby
- `game_state` - Full game state (host only)
- `player_state` - Local player state (clients only)
- `game_start` - Start game (host only)
- `heartbeat` - Keep connection alive

**Server → Client:**
- `lobby_created` - Lobby created successfully
- `lobby_joined` - Joined lobby successfully
- `lobby_error` - Error (lobby full, not found, etc.)
- `player_joined` - Another player joined
- `player_left` - Player left lobby
- `host_migrated` - New host assigned
- `game_state` - Full game state from host
- `player_state` - Player state from client
- `game_start` - Game starting

### State Synchronization

**Host sends (30 FPS):**
- All player positions, HP, animations, states
- All enemy positions, HP, states
- All projectiles
- Room number, door state
- Ground loot

**Clients send (as needed):**
- Local player position, HP, rotation
- Animation states
- Class-specific states

### Performance

- State updates throttled to 30/sec to reduce bandwidth
- Only active game state is synced (no unnecessary data)
- Heartbeat every 30 seconds to keep connection alive
- Automatic reconnection (up to 3 attempts, 2 second delay)

## Production Deployment

### Server Hosting

1. Deploy `server/mp-server.js` to your hosting provider
2. Ensure WebSocket support (most providers support this)
3. Configure SSL for wss:// (recommended for production)
4. Set environment variables for configuration
5. Use process manager (PM2, Forever) for auto-restart

### Client Configuration

1. Update `js/mp-config.js` with production server URL
2. Use `wss://` for secure WebSocket connection
3. Test with multiple users before launch

### Security Considerations

- Add rate limiting to prevent abuse
- Implement authentication if needed
- Validate all client inputs on server
- Add lobby password option (future feature)
- Monitor server logs for suspicious activity

## Future Enhancements

Potential improvements for the multiplayer system:

- [ ] Persistent lobbies (database storage)
- [ ] Lobby passwords/private lobbies
- [ ] Player kick/ban (host controls)
- [ ] Spectator mode
- [ ] Voice chat integration
- [ ] Leaderboards/stats
- [ ] Custom game modes (PvP, survival, etc.)
- [ ] Cross-platform support (mobile)

## Support

For issues or questions:
1. Check server logs (`server/mp-server.js` console output)
2. Check browser console (F12 → Console)
3. Verify network connectivity
4. Test single-player first to isolate multiplayer issues








