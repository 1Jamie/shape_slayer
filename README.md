# Shape Slayer

A skill-based 2D top-down Action Roguelike (ARPG) built with HTML5 Canvas and vanilla JavaScript. Control geometric shapes, fight through rooms of enemies, collect gear, and level up in fast-paced combat.

## 🎮 Game Overview

**Genre:** Action Roguelike  
**Platform:** Web Browser (HTML5 Canvas)  
**Tech Stack:** Vanilla JavaScript (ES6+), Canvas 2D API  
**Target Session Length:** 10-15 minutes

## ✨ Features

- **Co-op Multiplayer** - Play with up to 4 players online:
  - Lobby-based system with 6-character join codes
  - Host-authoritative architecture for consistent gameplay
  - Real-time synchronization of players, enemies, and projectiles
  - Client-side interpolation for smooth 60 FPS rendering
  - Automatic reconnection and host migration
  - Optional feature - single-player works perfectly without multiplayer server

- **4 Player Classes** - Each with unique abilities and playstyles:
  - **Warrior** (Square) - Balanced melee with cleaving attacks
  - **Rogue** (Triangle) - High mobility with dash attacks and critical hits
  - **Tank** (Pentagon) - High HP with shield defense and crowd control
  - **Mage** (Hexagon) - Ranged attacks with AoE abilities

- **Dynamic Combat System** - Fast-paced action with:
  - Basic and heavy attacks
  - Dodge roll with invincibility frames
  - Class-specific special abilities
  - Screen shake and hit pause effects
  - Damage numbers and particle effects

- **Progression System** - Level up and collect gear:
  - XP-based leveling with stat increases
  - Gear drops with tier-based bonuses
  - Room-based progression with scaling difficulty

- **Enemy Variety** - Fight through multiple enemy types:
  - Swarmers (Circles)
  - Assassins (Diamonds)
  - Brutes (Rectangles)
  - Shooters (Stars)
  - Elites (Octagons)

- **Epic Boss Battles** - Challenging boss encounters every 5 rooms:
  - **Swarm King** (Room 10) - Star-shaped boss with spike attacks and minion summons
  - **Twin Prism** (Room 15) - Dual diamond boss with synchronized attacks
  - **Fortress** (Room 20) - Massive rectangular boss with defensive spikes and shockwaves
  - **Fractal Core** (Room 25) - Octagonal boss that fragments into multiple parts
  - **Vortex** (Room 30) - Final boss with powerful pull effects and rotating teeth
  - Each boss features 3 combat phases that change at 50% and 25% HP
  - Weak points offer 3x damage multiplier for skilled players
  - Boss intro sequences with epic presentations
  - Guaranteed rare+ loot drops (2-3 items)

- **Advanced Combat Mechanics**:
  - **Weak Point System** - Hit specific glowing areas on bosses for 3x damage
  - **Environmental Hazards** - Dynamic battlefield elements:
    - Shockwaves (expanding damage rings)
    - Damage zones (persistent area threats)
    - Pull fields (suction effects affecting movement)
    - Debris hazards (temporary collision zones)
  - **Pull Force System** - Bosses can apply physics-based pull effects
  - **Phase Transitions** - Bosses become more dangerous as HP drops

- **Testing Infrastructure** - Quality assurance tools:
  - Automated test suite using Puppeteer
  - Damage numbers multiplayer sync verification
  - Debug flag system for troubleshooting (DebugFlags.DAMAGE_NUMBERS)
  - Screenshot-based visual testing
  - Test documentation in `tests/README.md`
  - Easy to run: `cd tests && npm test`

- **Class Configuration System** - Easy game balancing:
  - Centralized configuration objects (ROGUE_CONFIG, WARRIOR_CONFIG, TANK_CONFIG, MAGE_CONFIG)
  - All stats, cooldowns, and abilities configurable in one place
  - No code changes needed for balance adjustments
  - Clear separation of game design values from implementation
  - Makes testing different balance scenarios simple

- **Mobile-Friendly UI** - Responsive design:
  - Responsive scaling for health bar, XP bar, and room display
  - Scrollable character sheet optimized for mobile
  - Touch-friendly controls with visual feedback
  - Responsive death screens with proper font scaling
  - World-to-screen coordinate conversion for accurate tooltips

## 🚀 Getting Started

### Prerequisites

- Node.js (for multiplayer server and optional development server)
- Modern web browser with JavaScript enabled

### Installation

1. Clone the repository:
```bash
git clone https://github.com/1jamie/shape_slayer.git
cd shape_slayer
```

2. **Single-Player Mode** (No server required):
   - Simply open `index.html` directly in your browser
   - The game works completely offline for single-player gameplay

3. **Multiplayer Mode** (Optional):
   - Install multiplayer server dependencies:
   ```bash
   cd server
   npm install
   ```
   - Start the multiplayer WebSocket server (choose deployment mode):
   
   **Single-Threaded (Default, Recommended for most users)**:
   ```bash
   npm start
   # or explicitly: SERVER_MODE=single npm start
   ```
   - Supports 100-1,000 concurrent players
   - No additional dependencies
   - Perfect for development and small-medium deployments
   
   **Multi-Worker (High Performance)**:
   ```bash
   SERVER_MODE=multi WORKER_COUNT=4 npm start
   ```
   - Supports 1,000-5,000+ concurrent players
   - Requires Docker (auto-manages Redis)
   - Spawns multiple worker processes
   - Advanced load balancing
   
   **Slave Mode (Multi-Server Cluster)**:
   ```bash
   SERVER_MODE=slave MASTER_SERVER_IP=10.0.0.100 WORKER_COUNT=4 npm start
   ```
   - Supports 10,000+ concurrent players
   - Requires master server and network connectivity
   - For massive scale deployments
   
   - The server will run on port 4000 (WebSocket) by default
   - Configuration via `.env` file (see `server/.env.example`)
   - See `server/README.md` for detailed server documentation
   - See the [Multiplayer](#-multiplayer) section for gameplay instructions

4. **Development Server** (Optional, for testing):
   - From the project root, start the HTTP server:
   ```bash
   node server.js
   ```
   - The game will be accessible at `http://localhost:3000`
   - Useful for testing with proper HTTP headers and avoiding CORS issues

## 🎯 Controls

- **WASD** - Move in 8 directions
- **Mouse** - Player rotates to face cursor
- **Left Click** - Basic attack (~0.3s cooldown)
- **Right Click** - Heavy attack (~1.5-2.5s cooldown)
- **Shift** - Dodge roll with i-frames (~2s cooldown)
- **Spacebar** - Class special ability (~5s cooldown)
- **ESC** - Pause menu (opens multiplayer menu in Nexus)
- **R** - Restart game
- **M** - Return to main menu
- **Skip/Click** - Skip boss intro sequences during presentation
- **Ctrl+D** - Toggle debug panel (for testing)

### Multiplayer Controls

- Controls are identical to single-player mode
- **Host-only actions:**
  - Only the host can start the game from the Nexus portal (press **G** near portal)
  - Host runs authoritative game logic; clients send input and render state
- **G** - Interact with portal in Nexus (host only to start game)

## 🌐 Multiplayer

Shape Slayer supports co-op multiplayer for up to 4 players using a lobby-based system with join codes. Multiplayer is completely optional - the game works perfectly in single-player mode without any server.

### Features

- **Lobby System** - Create or join lobbies with 6-character codes (e.g., "A3X9K2")
- **Host Authority** - Host player runs game logic; clients receive and render state
- **Full Synchronization** - All player animations, enemies, projectiles, and effects are synchronized
- **Class Flexibility** - Multiple players can use the same class
- **Graceful Fallback** - Game works 100% offline without a server for single-player
- **Automatic Reconnection** - Up to 3 reconnection attempts with 2-second delay
- **Host Migration** - If host disconnects, next player becomes host automatically

### Architecture

#### Host-Authoritative Design
- The **host** (first player to create lobby) runs all game logic:
  - Enemy AI and behavior
  - Combat calculations
  - Loot generation
  - Room transitions
  - Game state management
  
- **Clients** (other players) send input and render state:
  - Send input state (movement, attacks, abilities) to host
  - Receive full game state from host at 30 FPS
  - Render at 60 FPS using client-side interpolation
  - Handle their own visual effects and UI

#### State Synchronization
- **Host sends** (30 updates/second):
  - All player positions, HP, animations, states
  - All enemy positions, HP, states
  - All projectiles
  - Room number, door state
  - Ground loot
  
- **Clients send** (as needed):
  - Local player position, HP, rotation
  - Animation states
  - Class-specific states
  - Input state (for host simulation)

### Setup

#### 1. Install Server Dependencies

```bash
cd server
npm install
```

This installs the `ws` WebSocket library required for the multiplayer server.

#### 2. Start the Multiplayer Server

```bash
cd server
npm start
```

The server will start on port 4000 (WebSocket). You should see:
```
========================================
  Shape Slayer Multiplayer Server
========================================
  Local:    ws://localhost:4000
  Network:  ws://YOUR_IP:4000
  Status:   Running
========================================
```

#### 3. Start the Game Server (Optional)

In a separate terminal, from the project root:

```bash
node server.js
```

The game will be accessible at `http://localhost:3000`. This is optional - you can also open `index.html` directly, but the HTTP server helps avoid CORS issues during development.

#### 4. Configure Server URL (If Needed)

Edit `js/mp-config.js` to change the multiplayer server URL:

```javascript
const MultiplayerConfig = {
    // For local testing
    SERVER_URL: 'ws://localhost:4000',
    
    // For production with SSL
    // SERVER_URL: 'wss://yourdomain.com',
    
    // For LAN testing
    // SERVER_URL: 'ws://192.168.1.100:4000',
    
    // ... other settings
};
```

**Default production server:** `wss://shape-slayer.goodgirl.software`

### How to Play Multiplayer

#### Creating a Lobby (Host)

1. Open the game in your browser
2. Navigate to the Nexus (main hub area)
3. Press `ESC` to open pause menu
4. Click "Multiplayer" button
5. Click "Create Lobby"
6. Note the 6-character lobby code (e.g., "A3X9K2")
7. Select a class in the Nexus
8. Share the lobby code with friends
9. Other players can now join using the code

#### Joining a Lobby (Clients)

1. Open the game in a **new browser window/tab** (or different browser)
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
5. All players see synchronized gameplay

### Technical Details

#### Interpolation System

The client uses a sophisticated interpolation system for smooth rendering:

- **State Buffering** - Stores up to 15 state snapshots
- **Adaptive Delay** - Adjusts interpolation delay based on network latency (100-200ms)
- **Extrapolation** - Predicts movement when updates are delayed
- **Smooth Rendering** - Clients render at 60 FPS despite 30 FPS network updates

#### Network Performance

- State updates throttled to 30/sec to reduce bandwidth
- Only active game state is synced (no unnecessary data)
- Heartbeat every 30 seconds to keep connection alive
- Automatic reconnection (up to 3 attempts, 2 second delay)

#### Message Types

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

### Configuration

The multiplayer system is configured in `js/mp-config.js`:

```javascript
const MultiplayerConfig = {
    SERVER_URL: 'wss://shape-slayer.goodgirl.software',
    
    // Connection settings
    RECONNECT_ATTEMPTS: 3,
    RECONNECT_DELAY: 2000, // milliseconds
    HEARTBEAT_INTERVAL: 30000, // milliseconds (30 seconds)
    
    // Lobby settings
    MAX_PLAYERS: 4,
    CODE_LENGTH: 6,
    
    // Interpolation settings
    INTERPOLATION_DELAY: 100, // milliseconds
    MAX_INTERPOLATION_DELAY: 200,
    EXTRAPOLATION_LIMIT: 100,
    STATE_BUFFER_SIZE: 15,
    BASE_LERP_SPEED: 10,
    MIN_LERP_SPEED: 5,
    MAX_LERP_SPEED: 20,
    SNAP_DISTANCE: 100 // pixels
};
```

### Production Deployment

#### Server Hosting

1. Deploy `server/mp-server.js` to your hosting provider
2. Ensure WebSocket support (most providers support this)
3. Configure SSL for `wss://` (recommended for production)
4. Use process manager (PM2, Forever) for auto-restart
5. Update `js/mp-config.js` with production server URL

#### Security Considerations

- Add rate limiting to prevent abuse
- Implement authentication if needed
- Validate all client inputs on server
- Monitor server logs for suspicious activity

For more detailed multiplayer documentation, see [MULTIPLAYER.md](MULTIPLAYER.md).

## 🏗️ Project Structure

```
shape_slayer/
├── index.html          # Main HTML file
├── server.js           # Local HTTP development server (port 3000)
├── css/
│   └── style.css       # Game styling
├── js/
│   ├── main.js         # Game loop and core logic
│   ├── player.js       # Player class and mechanics
│   ├── combat.js       # Combat system
│   ├── level.js        # Room generation
│   ├── gear.js         # Loot and equipment
│   ├── ui.js           # HUD and menus
│   ├── input.js        # Input handling
│   ├── render.js       # Rendering and effects
│   ├── utils.js        # Helper functions
│   ├── debug.js        # Debug panel for testing
│   ├── version.js      # Version tracking
│   ├── nexus.js        # Nexus hub area
│   ├── mp-config.js    # Multiplayer configuration (server URL, settings)
│   ├── multiplayer.js  # Multiplayer client module (lobby, sync, state management)
│   ├── interpolation.js # Client-side interpolation for smooth rendering
│   ├── enemies/        # Enemy classes
│   │   ├── enemy-base.js      # Base enemy class
│   │   ├── enemy-basic.js     # Circle enemy (Swarmer)
│   │   ├── enemy-star.js      # Star enemy (Ranged)
│   │   ├── enemy-diamond.js   # Diamond enemy (Assassin)
│   │   ├── enemy-rectangle.js # Rectangle enemy (Brute)
│   │   └── enemy-octagon.js   # Octagon enemy (Elite)
│   ├── players/        # Player classes
│   │   ├── player-base.js     # Base player class
│   │   ├── player-warrior.js  # Warrior class
│   │   ├── player-rogue.js    # Rogue class
│   │   ├── player-tank.js     # Tank class
│   │   └── player-mage.js     # Mage class
│   └── bosses/         # Boss classes and systems
│       ├── boss-base.js        # Base boss class
│       ├── hazards.js          # Environmental hazard system
│       ├── boss-swarmking.js   # Swarm King (Room 10)
│       ├── boss-twinprism.js   # Twin Prism (Room 15)
│       ├── boss-fortress.js    # Fortress (Room 20)
│       ├── boss-fractalcore.js # Fractal Core (Room 25)
│       └── boss-vortex.js      # Vortex (Room 30)
├── server/             # Multiplayer server
│   ├── mp-server.js    # Main entry point (routing to master or worker)
│   ├── mp-server-master.js # Master process (cluster coordinator)
│   ├── mp-server-worker.js # Worker process (handles WebSocket connections)
│   ├── config.js       # Server configuration (modes, Redis, clustering)
│   ├── .env.example    # Environment variable template
│   └── package.json    # Server dependencies (ws, dotenv)
├── tests/              # Automated testing
│   ├── damage-numbers.test.js # Damage sync verification test
│   ├── README.md       # Testing documentation
│   └── package.json    # Test dependencies (Puppeteer)
├── MULTIPLAYER.md      # Detailed multiplayer documentation
├── spec_sheet.md       # Game design specification
├── implementation_plan.md # Development roadmap
├── DAMAGE_NUMBERS_FIX.md # Technical documentation for damage sync fix
└── DAMAGE_NUMBERS_FINAL_REPORT.md # Final report on damage sync fix
```

## 🛠️ Technologies Used

- **HTML5 Canvas 2D** - Rendering
- **Vanilla JavaScript (ES6+)** - Game logic
- **Node.js** - Development server and multiplayer server
- **WebSockets (ws library)** - Multiplayer networking
- **No external client dependencies** - Game runs entirely in browser with vanilla JS

## 🎮 Boss System Details

### Boss Encounters
Bosses spawn every 5 rooms starting at Room 10. Each boss features:

- **Massive Health Pools** - 5x normal enemy HP (scaled by room)
- **3-Phase Combat** - Bosses change behavior at 50% and 25% HP
- **Weak Points** - Glowing areas that take 3x damage when hit
- **Environmental Hazards** - Dynamic battlefield threats
- **Guaranteed Rare+ Loot** - Bosses always drop 2-3 high-quality items
- **Epic Intro Sequences** - Dramatic boss introductions (skippable)

### Individual Bosses

#### 🟡 Swarm King (Room 10)
- **Shape:** Star with inward-bending spikes
- **Weak Points:** 3 at spike bases
- **Phase 1:** Spike barrages, chase lunge attacks
- **Phase 2:** Spawns minions, spinning spike wheel
- **Phase 3:** Multi-barrage attacks, explosive finale

#### 🟠 Twin Prism (Room 15)
- **Shape:** Two overlapping diamonds
- **Weak Point:** 1 at center connection
- **Phase 1:** Dual dash patterns, rotation attacks
- **Phase 2:** Synchronized strikes, split attacks
- **Phase 3:** Frenzy mode, merged form slams

#### 🟤 Fortress (Room 20)
- **Shape:** Large rectangle with crenellations
- **Weak Points:** 2 at top corners
- **Phase 1:** Charging slams, corner spikes, wall pushes
- **Phase 2:** Multiple slams, full spike bursts
- **Phase 3:** Rampage mode, fortress storm, collapse attacks

#### 🔵 Fractal Core (Room 25)
- **Shape:** Octagon with concave sides, fragments
- **Weak Points:** 4 at indentations
- **Phase 1:** Fragment spawning, phase dashes, rotation blasts
- **Phase 2:** Multi-fragment attacks, phase chains, expanding pulses
- **Phase 3:** Chaos mode, super fragment storms, core explosion

#### 🔴 Vortex (Room 30) - Final Boss
- **Shape:** Gear-like circle with rotating teeth
- **Weak Point:** 1 at center core
- **Phase 1:** Vortex pull, rotating teeth, spin projectiles
- **Phase 2:** Stronger pull effects, tooth barrages, double spins
- **Phase 3:** Maximum pull, teeth expansion, final vortex explosion

### Environmental Hazards
Bosses create dynamic battlefield hazards:

- **Shockwaves** - Expanding rings that deal one-time damage
- **Damage Zones** - Persistent areas dealing damage over time
- **Pull Fields** - Areas that apply physics-based pull forces
- **Debris** - Temporary collision zones from explosions

### Weak Point System
- Weak points appear as glowing, pulsing areas on bosses
- Hitting weak points deals **3x damage** instead of normal damage
- Weak points may be hidden or protected during certain boss attacks
- Optional mechanic - skilled players are rewarded with faster boss kills

## 🔧 Troubleshooting

### Multiplayer Connection Issues

#### "Failed to connect to server"
- **Check server is running:** Ensure the multiplayer server is running (`cd server && npm start`)
- **Verify server URL:** Check `js/mp-config.js` matches your setup:
  - Local: `ws://localhost:4000`
  - Production: `wss://shape-slayer.goodgirl.software`
- **Check firewall/port forwarding:** Ensure port 4000 is open (for WebSocket connections)
- **Network connectivity:** Test if you can reach the server URL in your browser's developer console

#### "Lobby not found"
- **Case sensitivity:** Lobby codes are case-sensitive - enter exactly as provided
- **Lobby expiration:** Lobbies expire after 1 hour of inactivity
- **Server restart:** If the server restarted, all lobbies are cleared (they don't persist)
- **Double-check code:** Verify you entered the correct 6-character code

#### "Lobby is full"
- Maximum of 4 players per lobby
- Wait for a player to leave or create a new lobby

#### Players not syncing properly
- **Check browser console:** Open developer tools (F12) and look for errors
- **Verify connection:** Ensure all players successfully connected (check lobby list)
- **Server logs:** Check server console output for disconnection messages
- **Network lag:** High latency may cause delays (system uses adaptive interpolation)
- **Firewall issues:** Ensure WebSocket connections aren't blocked

#### "Only host can start"
- This is intentional - only the first player (host) can start the game
- If host left, the next player automatically becomes host
- Check lobby list to see who is host (indicated with "(Host)")

### Server Setup Problems

#### Server won't start
- **Check Node.js:** Ensure Node.js is installed (`node --version`)
- **Install dependencies:** Run `cd server && npm install`
- **Port in use:** Check if port 4000 is already in use by another application
- **Permissions:** On Linux/Mac, ensure you have permission to bind to port 4000

#### Server starts but clients can't connect
- **Network binding:** Server binds to `0.0.0.0` by default (accepts connections from any interface)
- **Localhost vs Network:** Use `ws://localhost:4000` for local testing, `ws://YOUR_IP:4000` for LAN
- **Firewall:** Ensure firewall allows incoming connections on port 4000
- **Router/NAT:** For internet connections, configure port forwarding for port 4000

### General Game Issues

#### Game doesn't load
- **Browser compatibility:** Use a modern browser (Chrome, Firefox, Edge, Safari)
- **JavaScript enabled:** Ensure JavaScript is enabled in your browser
- **File protocol:** If opening `index.html` directly, some features may not work - use HTTP server instead
- **CORS errors:** Use the HTTP development server (`node server.js`) instead of opening file directly

#### Performance issues
- **Frame rate:** Check FPS in debug panel (`Ctrl+D`)
- **Too many players:** Reduce number of players in lobby (performance scales with player count)
- **Network latency:** High latency may cause stuttering (check connection quality)
- **Browser resources:** Close other tabs/applications to free up resources

For additional help, check the browser console (F12 → Console) and server logs for error messages.

## 🐛 Debug Tools

### Debug Panel
Accessible via `DebugPanel.toggle()` in the browser console or `Ctrl+D`:
- Warp to specific rooms instantly (rooms 10, 15, 20, 25, 30 highlighted for bosses)
- Custom room input (1-100)
- Current room display
- Perfect for testing boss encounters without playing through earlier rooms

For questions or feedback, please open an issue on GitHub.

---

**Note:** This game is currently in development. Features and mechanics may change.

