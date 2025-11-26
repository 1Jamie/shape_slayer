# Shape Slayer - Game Design Specification

## Project Overview
A skill-based 2D top-down ARPG using HTML5 Canvas 2D and vanilla JavaScript. Players control geometric shapes, fight through rooms of enemies, collect gear, and level up in a fast-paced combat system. Supports both single-player and co-op multiplayer (up to 4 players).

**Genre:** Action Roguelike  
**Platform:** Web Browser (HTML5 Canvas)  
**Tech Stack:** Vanilla JavaScript (ES6+), Canvas 2D API, WebSockets (Node.js)  
**Target Session Length:** 10-15 minutes  
**Multiplayer:** Optional co-op system (host-authoritative architecture)  

---

## Core Concept: "Shape Slayer"

### Visual Design Philosophy
Simple geometric shapes with clear visual hierarchy. Every element should be easily recognizable at a glance.

---

## Player Classes

### Triangle (Rogue)
- **HP:** Low
- **Speed:** Fast
- **Playstyle:** High mobility, critical hits
- **Base Stats:**
  - HP: 75
  - Damage: 12
  - Speed: 250
  - Crit Chance: 25%

### Square (Warrior)
- **HP:** Medium
- **Speed:** Medium
- **Playstyle:** Balanced, defensive options
- **Base Stats:**
  - HP: 100
  - Damage: 14
  - Speed: 200
  - Defense: 10%

### Pentagon (Tank)
- **HP:** High
- **Speed:** Slow
- **Playstyle:** Area damage, damage soaking
- **Base Stats:**
  - HP: 150
  - Damage: 8
  - Speed: 150
  - Defense: 20%

### Hexagon (Mage)
- **HP:** Low
- **Speed:** Medium
- **Playstyle:** Ranged attacks, high damage
- **Base Stats:**
  - HP: 80
  - Damage: 20
  - Speed: 180
  - Projectile Range: 300

---

## Enemy Types

### Small Circles (Swarmer)
- **Behavior:** Chase player, lunge attacks
- **HP:** Low
- **Speed:** Medium
- **Attack:** Flash red before lunging forward
- **XP Value:** 10
- **Loot Chance:** 30%

### Diamonds (Assassin)
- **Behavior:** Circle around player, dash attacks
- **HP:** Low
- **Speed:** Fast
- **Attack:** Zigzag movement, telegraphs dash
- **XP Value:** 15
- **Loot Chance:** 35%

### Rectangles (Brute)
- **Behavior:** Slow movement, charging slams
- **HP:** Very High
- **Speed:** Slow
- **Attack:** Wind up (grow bigger) before slam with shockwave
- **XP Value:** 25
- **Loot Chance:** 40%

### Stars (Shooter)
- **Behavior:** Keep distance, ranged attacks
- **HP:** Medium
- **Speed:** Medium
- **Attack:** Spin before firing projectile
- **XP Value:** 20
- **Loot Chance:** 35%

### Octagons (Elite)
- **Behavior:** Combination attacks, summoning
- **HP:** High
- **Speed:** Medium
- **Attack:** Spin attacks, pulse to summon minions
- **XP Value:** 50
- **Loot Chance:** 60%

---

## Boss System

### Boss Architecture
Bosses extend `BossBase`, which extends `EnemyBase`. This inheritance pattern provides:
- Common boss functionality (phase system, weak points, environmental hazards)
- Base enemy systems (knockback, health bars, targeting, death logic)
- Unique boss implementations with specialized attacks and mechanics

### Boss Stat Scaling
All bosses are scaled relative to normal enemies:
- **HP:** 5x base HP × 1.3 (30% bonus) = 6.5x base HP (before room scaling)
- **Size:** 2x base size (visual and collision)
- **Damage:** 1.5x base damage
- **XP Value:** 3x normal enemy of same type

**Boss Base HP Values:**
- Swarm King: 195 base HP (final: 975 HP)
- Twin Prism: 156 base HP (final: 780 HP)
- Fortress: 234 base HP (final: 1,170 HP)
- Fractal Core: 195 base HP (final: 975 HP)
- Vortex: 260 base HP (final: 1,300 HP)

### 3-Phase Combat System
Each boss has three phases that change at HP thresholds:
- **Phase 1:** 100% - 50% HP - Opening moves, basic patterns
- **Phase 2:** 50% - 25% HP - Increased aggression, new attacks
- **Phase 3:** 25% - 0% HP - Maximum intensity, ultimate attacks

Phase transitions trigger visual/audio feedback and unlock new attack patterns.

### Weak Point System
- **Purpose:** Strategic targeting reward (not required to defeat boss)
- **Damage Multiplier:** 3x damage when hitting weak points
- **Visibility:** Weak points glow with cyan/white indicators
- **Accessibility:** Positioned in hard-to-reach locations (behind rotating body, at spike bases, center core behind pull field, etc.)
- **Collision Detection:** Weak points checked before normal body collision in damage calculations

### Environmental Hazards
Bosses create persistent environmental hazards during combat:
- **Shockwave:** Expanding rings from ground slams, persist 0.5-1s
- **Damage Zone:** Persistent area dealing damage (dash trails, spike zones)
- **Pull Field:** Constant force toward boss, reduces player movement speed
- **Debris:** Temporary collision zones from boss destruction/attacks

Hazards update each frame, check player collision, and auto-remove when expired.

### Boss Intro System
- **Trigger:** When boss room is entered and boss spawns
- **Duration:** 3 seconds total
- **Sequence:**
  - Dark overlay (80% opacity black)
  - Boss slides in from spawn position
  - Boss name displays with fade-in/scale-up text effect
  - "Press any key to continue" appears after 2 seconds
- **Skip:** Any key press after 2 seconds skips remaining intro time
- **State:** Boss frozen during intro, normal updates begin after intro completes

### Individual Boss Descriptions

#### Swarm King (Room 10)
- **Shape:** Large star (~60px radius) with concave inward-bending spikes
- **Weak Points:** 3 small glowing points at base of spikes (hard to hit during rotation)
- **Phase 1:** Spike barrage, chase lunge, minion spawn (2-3), spike slam with shockwave
- **Phase 2:** Faster attacks, spinning spike wheel, multi-barrage (3 waves), more minions (4-5)
- **Phase 3:** Constant rotation with extended spikes, explosive finale when HP < 10%
- **Environmental Hazards:** Shockwaves from spike slams, explosive spike particles

#### Twin Prism (Room 15)
- **Shape:** Two overlapping diamonds forming concave hourglass (~50px each)
- **Weak Points:** Single weak point at center connection (requires precise timing)
- **Phase 1:** Dual dash pattern, rotation attack, color swap position swap, synchronized strike
- **Phase 2:** Faster rotation, split attack (separate to edges), more frequent swaps
- **Phase 3:** Frenzy mode (constant spinning + dashing), merged form slam, orbital frenzy
- **Environmental Hazards:** Dash trails (damage zones), rotation barrier damage zone

#### Fortress (Room 20)
- **Shape:** Large rectangle (~100px × 80px) with concave crenellations
- **Weak Points:** 2 weak points at top corners (protected by spike attacks)
- **Phase 1:** Charging slam (1.5s windup), corner spikes (cardinal directions), wall push, summon guards
- **Phase 2:** Multiple slams (2-3 chain), full spike burst (all corners), room division
- **Phase 3:** Rampage mode (constant charging), fortress storm (projectiles while moving), collapse attack (splits into 4), earthquake (repeated slams)
- **Environmental Hazards:** Persistent shockwaves from slams (grow then fade 1s), spike damage zones, crumbling debris

#### Fractal Core (Room 25)
- **Shape:** Octagon (~70px) with inward-bending concave sides
- **Weak Points:** 4 weak points at concave indentations (only visible when fragments separate)
- **Phase 1:** Fragment spawn (4 orbiting octagons), phase dash teleport, rotation blast, summon elite
- **Phase 2:** Multi-fragment (6 fragments), phase chain (3 teleports), expanding pulse ring, fragment barrage
- **Phase 3:** Chaos mode (constant splitting/reforming), super fragment storm (8 fragments), core explosion, final blast (screen-wide)
- **Environmental Hazards:** Phase dash damage trails, expanding pulse rings, fragment collision zones

#### Vortex (Room 30)
- **Shape:** Circle (~80px) with concave indentations (gear-like)
- **Weak Points:** 1 weak point at center core (requires getting past pull effect)
- **Phase 1:** Vortex pull (suction reduces movement), rotating teeth (contact damage), spin projectiles (spiral pattern), swarm summon (orbiting enemies)
- **Phase 2:** Stronger pull effect, tooth barrage (rapid extend/retract), double spin (opposite spirals), more orbiting minions
- **Phase 3:** Maximum pull (very strong suction), teeth expansion (all teeth extend max), final vortex (contracts then explosive burst), death spiral (rapid contraction then explosion)
- **Environmental Hazards:** Pull force field (constant velocity toward boss), tooth damage zones, explosion debris

---

## Combat System

### Control Scheme
- **WASD:** Move in 8 directions
- **Mouse:** Player rotates to face cursor
- **Left Click:** Basic attack (~0.3s cooldown)
- **Right Click:** Heavy attack (~1.5s cooldown)
- **Spacebar:** Class special ability (~5s cooldown)
- **Shift:** Dodge roll with i-frames (~2s cooldown)
- **ESC:** Pause menu (different behavior in multiplayer)
- **G:** Interact with portal in Nexus (host only in multiplayer)

### Input Handling (Multiplayer)

#### Client Input Snapshotting
- **Critical Timing:** Input state must be snapshotted BEFORE `Input.update()` resets flags
- **Purpose:** Preserve `justPressed` and `justReleased` flags for host simulation
- **When:** In Nexus and during gameplay, clients snapshot input before each frame update
- **Storage:** Cached in `multiplayerManager.cachedInputSnapshot` for serialization

#### Host Input Simulation
- **Input Adapter:** Host creates `Input` interface adapter from serialized client input
- **Adapter Functionality:**
  - Converts raw input data (keys, mouse, touch) to `Input` interface
  - Handles touch controls (joysticks, buttons) for mobile clients
  - Preserves `justPressed`/`justReleased` flags for abilities
  - Maintains `lastAimAngle` for touch controls
- **Remote Player Instances:** Host creates full player instances for each client
- **Simulation:** Host calls `playerInstance.update(deltaTime, inputAdapter)` with adapted input

#### Input Serialization
- **Keyboard:** WASD, arrow keys, space, shift, mouse buttons
- **Mouse:** Position (x, y) for aiming
- **Touch Controls:** Joysticks (movement, aim) and buttons (attack, abilities)
  - Serializes `active`, `magnitude`, `direction`, `justReleased` states
  - Includes `finalJoystickState` for press-and-release abilities
- **Timestamp:** Client timestamp included for RTT calculation

### Combat Philosophy
"Dark Souls meets Geometry" - Every action has commitment and can be punished.

### Attack System
- **Basic Attack:** Quick damage, short cooldown
- **Heavy Attack:** Higher damage, knockback, longer windup
  - **Charge Indicator:** Pulsing circle shows during 0.3s windup
  - **Class-Specific Effects:** 
    - Rogue: Pink/purple pulsing circle
    - Tank: Red circular indicator for ground smash area
    - Mage: Purple magical buildup circles
    - Warrior: Yellow pulsing circle
  - **Post-Attack Effects:**
    - Tank: Orange shockwave ring at 120px radius
    - Mage: Expanding purple circles showing AoE range
- **Windup Animation:** Shape scales up slightly before attack
- **Positioning Matters:** Enemy positioning affects effectiveness
- **Visual Feedback:** Hitboxes turn green when they successfully hit enemies

### Class Abilities

#### Triangle (Rogue)
- **Basic:** Quick stab (small triangle projectile)
- **Heavy:** Fan of Knives (throw 7 knives in a 60° spread pattern, 2x damage per knife, 2s cooldown)
- **Special:** Shadow clones (2 decoys for 3s)
- **Passive:** Backstab bonus (2x damage from behind)
- **Dodge System:** 3 dodge charges with individual cooldowns, deals 50% damage on collision. **Dashes in facing direction** (not movement direction) for offensive positioning

#### Square (Warrior)
- **Basic:** Sword swing (4 hitboxes in a line, spread out for wide coverage)
- **Heavy:** Forward Thrust (animated rush 300px forward over 0.12s, dealing 2x damage to enemies along the path and knocking them sideways, 2.5s cooldown)
- **Special:** Whirlwind (spinning blades rotate around player, 2s duration)
- **Passive:** Block stance (50% damage reduction when standing still)

#### Pentagon (Tank)
- **Basic:** Cone slam (wide cone attack in front, multiple hitboxes)
- **Heavy:** Ground Smash (AoE ring around player, 1.1x damage + persistent knockback for crowd control, 2.5s cooldown)
- **Special:** Shield Defense (1.5s thin wide shield blocks enemies, then creates advancing wave pulse that damages and knocks back)
- **Passive:** Slow but high HP

#### Hexagon (Mage)
- **Basic:** Magic bolt (fast projectile)
- **Heavy:** AoE Blast (expanding circle, 125px radius, 2.7x damage, applies persistent knockback, 2.3s cooldown)
- **Special:** Blink + Nova (teleport up to 400px, 1.2s i-frames, leaves decoy at origin that enemies target for 2s, creates visual explosion at destination with damage and knockback)
- **Passive:** Range bonus damage

### Dodge Roll System
- **Input:** Shift key
- **Direction:** 
  - Movement direction or toward mouse if standing (all classes except Triangle)
  - **Facing direction only** (Triangle/Rogue class for offensive positioning)
- **Duration:** 0.3s active dodge + 0.3s post-dodge i-frames (total 0.6s invulnerability)
- **i-frames:** Invulnerable during roll and briefly after
- **Cooldown:** 2 seconds (standard), 3 charges with 1s cooldown each (Triangle class)
- **Visual:** Trail effect

### Enemy Attack Patterns
All attacks are telegraphed:
- **Flash red** before attacks
- **Windup animations** before big attacks
- **Color changes** indicate attack type
- **Audio cues** (optional)

### Knockback System
- Enemies have a knockback system that persists across frames
- Knockback velocity decays over time (50% per second for quick recovery)
- Applied by heavy attacks (Ground Smash, AoE Blast) and special abilities
- Prevents enemies from immediately recovering from powerful attacks

### Strategic Combat Elements
- Positioning matters (tight corridors vs open rooms)
- Enemy combinations create dynamic encounters
- Telegraphed attacks allow skill-based dodging
- Perfect dodge rewards (optional slow-mo + damage buff)

---

## Gear System

### Color Tiers
- **Gray (Common):** 0% bonus
- **Green (Uncommon):** +20% to stat
- **Blue (Rare):** +40% to stat
- **Purple (Epic):** +70% to stat
- **Orange (Legendary):** +100% to stat

### Gear Slots
- **Weapon:** Small orbiting shape - affects damage
- **Armor:** Outline thickness/glow - affects defense
- **Accessory:** Small dot following player - affects speed or crit

### Gear Types

#### Weapon Types
- **Blade (Triangle):** Faster attack speed
- **Hammer (Square):** More knockback
- **Staff (Star):** Longer range
- **Gauntlets (Pentagon):** More AoE, shorter range

#### Armor Types
- **Light:** Faster dodge roll, more i-frames
- **Medium:** Balanced
- **Heavy:** Slower dodge, more damage reduction

#### Accessories
- **Speed:** Trailing dots - move faster
- **Cooldown:** Orbiting dots - abilities recharge faster
- **Lifesteal:** Pulsing dot - heal on hit

### Loot Generation
- **Drop Chance:** Per enemy (varies by type)
- **Tier Distribution (base):**
  - Gray: 50%
  - Green: 30%
  - Blue: 15%
  - Purple: 4%
  - Orange: 1%
- **Scaling:** Higher room numbers = better loot chances
- **Boss Drops:** Guaranteed rare+ drop

---

## Progression System

### Experience & Leveling
- Enemies drop XP on death
- XP fills the level bar
- **Level Up:** +10% to all base stats (HP, damage, speed, defense)
- Level up triggers full heal + visual effect
- **XP Formula:** `xpToNext = 100 * (level ^ 1.5)`

### Stat System
**Base Player Stats:**
- Level
- HP / Max HP
- Base Damage
- Move Speed
- Defense (damage reduction %)

### Scaling
- **Enemy HP:** `baseHP * (1 + roomNumber * 0.15)`
- **Enemy Damage:** `baseDamage * (1 + roomNumber * 0.1)`
- **Enemy Count:** `baseCount + (roomNumber * 0.5)`

---

## Room System

### Room Structure
- Grid-based rooms
- Each room is a self-contained canvas
- **Clear Condition:** All enemies must be defeated
- Door appears when room is cleared
- Walk through door to progress

### Room Types

#### Normal Room
- Mixed enemy types
- Standard layout

#### Arena Room
- Large open space
- Many enemies at once

#### Boss Room (Every 5 rooms, starting at room 10)
- Boss rooms spawn when: `roomNumber % 5 === 0 AND roomNumber >= 10`
- Single unique boss enemy with 3-phase combat system
- **5 Unique Bosses:**
  - Room 10: Swarm King (Large star, spike attacks, minion spawning)
  - Room 15: Twin Prism (Two overlapping diamonds, alternating dash patterns)
  - Room 20: Fortress (Large rectangle, slam attacks, shockwaves)
  - Room 25: Fractal Core (Octagon, fragment splitting, teleportation)
  - Room 30: Vortex (Circle with indentations, pull mechanics, rotating teeth)
- Boss scaling: 5x HP, 2x size, 1.5x damage vs normal enemies
- Multiple attack phases (Phase 1: 100-50% HP, Phase 2: 50-25% HP, Phase 3: 25-0% HP)
- Weak point system (3x damage multiplier for strategic targeting)
- Environmental hazards (shockwaves, damage zones, pull fields, debris)
- Guaranteed rare+ loot drop (2-3 items per boss)
- Boss XP = 3x normal enemy of same type
- Boss intro screen (3 second sequence, skippable after 2s)

### Room Progression
- Room number displays on screen
- Each room increases difficulty
- Enemies scale in HP, damage, and count
- Loot quality improves with room number

### Room Generation
```javascript
enemyCount = baseCount + Math.floor(roomNumber * 0.5)
enemyHP = baseHP * (1 + roomNumber * 0.15)
enemyDamage = baseDamage * (1 + roomNumber * 0.1)
```

---

## Multiplayer System

### Overview
Shape Slayer supports co-op multiplayer for up to 4 players using a lobby-based system with join codes. Multiplayer is completely optional - the game works perfectly in single-player mode without any server.

### Architecture

#### Host-Authoritative Design
- **Host** (first player to create lobby) runs all game logic:
  - Enemy AI and behavior
  - Combat calculations and damage validation
  - Loot generation and distribution
  - Room transitions and door state
  - Game state management
  - Player instance simulation (for remote players)
  
- **Clients** (other players) send input and render state:
  - Send input state (movement, attacks, abilities) to host at 30 FPS
  - Receive full game state from host at 30 FPS
  - Render at 60 FPS using client-side interpolation
  - Handle their own visual effects and UI
  - Local input prediction for responsive feel

#### State Synchronization
- **Update Rate:** 30 updates/second (network), 60 FPS (client rendering)
- **Host sends:** Complete game state including:
  - All player positions, HP, animations, states
  - All enemy positions, HP, states, AI state
  - All projectiles (position, velocity, lifetime)
  - Room number, door state, door waiting state
  - Ground loot (ID-based sync)
  - Death state (all players dead flag, dead players set)
  
- **Clients send:** Local player input state:
  - Position, HP, rotation (for validation)
  - Input state (keys, mouse, touch controls)
  - Animation states
  - Class-specific states
  - Client timestamp (for RTT calculation)

#### Interpolation System
- **Purpose:** Smooth 60 FPS rendering despite 30 FPS network updates
- **State Buffering:** Stores up to 15 state snapshots per entity
- **Adaptive Delay:** Adjusts interpolation delay based on network latency (100-200ms)
- **Extrapolation:** Predicts movement when updates are delayed (max 100ms)
- **Lerp Speed:** Adaptive speed (5-20) based on distance to target
- **Snap Distance:** 100px threshold - snap instead of interpolate if too far

### Lobby System

#### Lobby Creation
- **Code Generation:** 6-character codes (A-Z, 2-9, excludes confusing chars like O/0, I/1)
- **Capacity:** Maximum 4 players per lobby
- **Expiration:** Lobbies expire after 1 hour of inactivity
- **Host:** First player to create lobby becomes host

#### Lobby Management
- **Join Flow:** Enter code → connect to server → join lobby → select class → wait for host to start
- **Host Migration:** If host disconnects, next player automatically becomes host
- **Player Tracking:** Server maintains player list with IDs, names, classes, ready state

### Network Protocol

#### Message Types (Client → Server)
- `create_lobby` - Create new lobby
- `join_lobby` - Join existing lobby with code
- `leave_lobby` - Leave current lobby
- `game_state` - Full game state (host only, 30/sec)
- `player_state` - Local player input state (clients only)
- `game_start` - Start game from Nexus (host only)
- `enemy_damaged` - Client damage event (forwarded to host)
- `loot_pickup` - Loot pickup notification
- `heartbeat` - Keep connection alive (every 30s)

#### Message Types (Server → Client)
- `lobby_created` - Lobby created successfully
- `lobby_joined` - Joined lobby successfully
- `lobby_error` - Error (lobby full, not found, etc.)
- `player_joined` - Another player joined
- `player_left` - Player left lobby
- `host_migrated` - New host assigned
- `game_state` - Full game state from host
- `enemy_state_update` - Enemy HP/state update (from host)
- `player_damaged` - Player took damage (from host)
- `loot_pickup` - Loot picked up by any player
- `game_start` - Game starting (synchronized transition)
- `room_transition` - Room transition event (with revival data)
- `return_to_nexus` - Return to Nexus event

### Server Architecture

The multiplayer server supports three deployment modes for different scale requirements:

#### Deployment Modes

**Single-Threaded Mode (Default)**:
- **Capacity:** 100-1,000 concurrent players
- **Requirements:** Node.js only, no additional dependencies
- **Use Case:** Development, small-medium deployments, most users
- **Setup:** `npm start` or `SERVER_MODE=single npm start`
- **Architecture:** Single process handles all connections
- **Benefits:** Simple, reliable, no external dependencies
- **Files:** mp-server.js, mp-server-worker.js

**Multi-Worker Mode (Clustering)**:
- **Capacity:** 1,000-5,000+ concurrent players
- **Requirements:** Node.js + Docker (for Redis)
- **Use Case:** High-traffic single server, production deployments
- **Setup:** `SERVER_MODE=multi WORKER_COUNT=4 npm start`
- **Architecture:** 
  - Master process coordinates multiple worker processes
  - Workers share lobby state via Redis
  - Automatic Redis management via Docker
  - No sticky sessions needed (Redis handles coordination)
- **Benefits:** Utilizes multiple CPU cores, dynamic load balancing
- **Files:** mp-server.js, mp-server-master.js, mp-server-worker.js, config.js

**Slave Mode (Multi-Server Cluster)**:
- **Capacity:** 10,000+ concurrent players (horizontal scaling)
- **Requirements:** Network connectivity to master server
- **Use Case:** Massive scale, geographic distribution
- **Setup:** `SERVER_MODE=slave MASTER_SERVER_IP=10.0.0.100 WORKER_COUNT=4 npm start`
- **Architecture:**
  - Master server runs Redis + game server
  - Slave servers connect to master's Redis
  - All servers share lobby state
  - Players stay on original server (no transfers)
  - Load balancer distributes new connections
- **Benefits:** Horizontal scaling, geographic distribution
- **Files:** Same as multi-worker + master server coordination

#### Configuration System

**Environment Variables** (via `.env` file or direct export):
- `SERVER_MODE`: 'single' | 'multi' | 'slave' (default: single)
- `WORKER_COUNT`: Number of worker processes (default: 2)
- `PORT`: WebSocket port (default: 4000)
- `MASTER_SERVER_IP`: Master server IP (required for slave mode)
- `LOG_LEVEL`: 'debug' | 'info' | 'warn' | 'error'
- `ENABLE_CLUSTERING`: true/false (legacy, use SERVER_MODE instead)
- Redis settings (for multi/slave modes)

**Configuration File** (`server/config.js`):
- Centralized configuration management
- Validates environment variables
- Provides defaults for all settings
- Includes load balancing thresholds
- Worker health monitoring settings

#### Redis Integration (Multi/Slave Modes)

**Purpose**:
- Share lobby state across workers/servers
- Enable cross-worker lobby lookups
- Coordinate distributed game state

**Auto-Management**:
- Automatically creates Docker container for Redis
- Starts/stops Redis with server
- No manual Redis setup required for multi mode
- Slave mode connects to master's Redis

**Data Stored**:
- Lobby directory (code → workerId/serverId)
- Worker metrics and health status
- Lobby migration state

#### Worker Management (Multi Mode)

**Master Process** (`mp-server-master.js`):
- Forks and manages worker processes
- Maintains lobby directory (code → workerId)
- Monitors worker health metrics
- Handles dynamic load balancing
- Migrates lobbies between overloaded workers
- Automatically restarts crashed workers

**Worker Processes** (`mp-server-worker.js`):
- Handle WebSocket connections
- Manage lobby state and game messages
- Report health metrics to master
- Share lobby state via Redis

**Health Metrics**:
- Active connections per worker
- Lobbies managed per worker
- Event loop lag (performance indicator)
- Messages per second

**Load Balancing**:
- Master monitors worker health every 2 seconds
- Identifies overloaded workers (high connections, lag, etc.)
- Migrates lobbies to less-loaded workers
- Thresholds configurable via environment variables

#### WebSocket Server (All Modes)
- **Port:** 4000 (WebSocket, configurable)
- **Dependencies:** `ws` library (Node.js), `dotenv` for config
- **Binding:** `0.0.0.0` (accepts connections from any network interface)
- **Role:** Lobby management and message relay (NOT authoritative game server)
  - Server does NOT run game logic
  - Server does NOT validate game state
  - Server only routes messages between clients
  - Host is authoritative for all game logic

#### Server Data Structures
- **Lobbies Map:** `Map<code, lobby>` - Stores all active lobbies
- **Player-to-Lobby Map:** `Map<WebSocket, code>` - Quick lookup of player's lobby
- **Lobby Object:**
  ```javascript
  {
    code: 'A3X9K2',
    host: WebSocket,  // Reference to host's WebSocket connection
    players: [{ ws, id, name, class, ready }],
    maxPlayers: 4,
    createdAt: timestamp
  }
  ```

#### Server Message Routing

**Host → Server → Clients:**
- `game_state` - Broadcast to all clients (except host)
- `enemy_state_update` - Broadcast to all clients (except host)
- `player_damaged` - Forward to specific target player
- `game_start` - Broadcast to all clients
- `room_transition` - Broadcast to all clients (except host)
- `return_to_nexus` - Broadcast to all clients (except host)

**Client → Server → Host:**
- `player_state` - Forward to host only
- `enemy_damaged` - Forward to host only (host validates damage)

**Client → Server → All Clients:**
- `loot_pickup` - Broadcast to all players (including sender)
- `player_joined` - Broadcast to all other players
- `player_left` - Broadcast to all remaining players
- `host_migrated` - Send to new host only

**Server-Generated Messages:**
- `lobby_created` - Sent to creator
- `lobby_joined` - Sent to joiner
- `lobby_error` - Sent to requester (not found, full, etc.)
- `heartbeat_ack` - Response to heartbeat

#### Server Operations

**Lobby Creation:**
1. Generate unique 6-character code
2. Generate unique player ID
3. Create lobby object with creator as host
4. Store in lobbies map
5. Send `lobby_created` confirmation

**Lobby Joining:**
1. Validate lobby code exists
2. Check lobby capacity (max 4 players)
3. Generate player ID for joiner
4. Add player to lobby.players array
5. Send `lobby_joined` to joiner
6. Broadcast `player_joined` to all other players

**Host Migration:**
1. Triggered when host disconnects
2. Next player in lobby.players array becomes host
3. Update lobby.host reference
4. Send `host_migrated` message to new host
5. Log migration event

**Message Validation:**
- Server validates sender is in a lobby
- Server validates host-only messages (game_state, game_start, etc.)
- Server checks WebSocket connection state before sending
- Server handles parsing errors gracefully

**Cleanup:**
- Old lobbies expire after 1 hour (checked every 5 minutes)
- Empty lobbies deleted immediately
- Disconnected players removed from lobby
- Player-to-lobby map cleaned up on disconnect

#### Client Configuration (`js/mp-config.js`)
- **Server URL:** Configurable (default: `wss://shape-slayer.goodgirl.software`)
- **Connection Settings:** Reconnect attempts (3), delay (2s), heartbeat (30s)
- **Lobby Settings:** Max players (4), code length (6)
- **Interpolation Settings:** Delay, buffer size, lerp speeds, snap distance

### Multiplayer Integration

#### Nexus Integration
- **Class Selection:** Each player selects class independently (can duplicate)
- **Portal Interaction:** Only host can start game (press G near portal)
- **Lobby UI:** Access via pause menu (ESC) in Nexus
- **Player Rendering:** All players visible in Nexus before game starts
- **Movement:** Host-authoritative (host simulates remote players in Nexus)
- **State Sync:** Host sends game state, clients send player state (same as gameplay)

#### Combat Integration
- **Damage Validation:** Host validates all damage (prevents cheating)
  - Clients send `enemy_damaged` events
  - Server forwards to host
  - Host validates and applies damage
  - Host broadcasts `enemy_state_update` to all clients
- **Enemy Sync:** Host simulates all enemies, clients render authoritative state
- **Projectile Sync:** Host creates and manages all projectiles
- **Loot Sync:** Host generates loot, clients render and notify on pickup
- **XP Sharing:** Each player gains XP independently when enemies die
- **Collision Detection:** Host checks all collisions (enemies vs all players)

#### Death System
- **Individual Death:** Players die independently (can spectate if others alive)
- **Revival:** Dead players revive at 50% HP when entering new room
  - Host signals revival in `room_transition` message
  - Clients revive local player if in `reviveePlayers` array
- **Game Over:** Only when all players are dead (host determines this)
- **Spectate Mode:** Dead players can spectate living players

### Communication Flow

#### Game Loop Communication

**Host (Every Frame):**
1. Update local player with `Input` object
2. Update remote player instances with input adapters
3. Update all enemies (AI, movement, attacks)
4. Update all projectiles
5. Check collisions (player attacks vs enemies, enemies vs players)
6. Serialize complete game state
7. Send `game_state` to server (throttled to 30/sec)
8. Receive `player_state` from clients (store for simulation)
9. Receive `enemy_damaged` events (validate and apply)
10. Broadcast `enemy_state_update` after damage

**Client (Every Frame):**
1. Snapshot input BEFORE `Input.update()` (preserves flags)
2. Update local player with `Input` object (for local prediction)
3. Serialize player state (position, input, class)
4. Send `player_state` to server (as needed)
5. Receive `game_state` from host (every ~33ms)
6. Apply game state (update enemies, projectiles, remote players)
7. Use interpolation for smooth rendering
8. Send `enemy_damaged` events when local player attacks

#### Message Flow Examples

**Starting Game:**
1. Host presses G near portal
2. Host sends `game_start` to server
3. Server broadcasts `game_start` to all clients
4. All clients transition to PLAYING state simultaneously

**Damage Event:**
1. Client detects attack hit enemy
2. Client sends `enemy_damaged` to server
3. Server forwards to host
4. Host validates and applies damage
5. Host sends `enemy_state_update` to server
6. Server broadcasts to all clients
7. All clients update enemy HP/state

**Loot Pickup:**
1. Client detects loot pickup
2. Client sends `loot_pickup` to server
3. Server broadcasts to all players
4. All clients remove loot from ground
5. Host equips gear on remote player instance (if host)

**Room Transition:**
1. Host detects all enemies dead
2. Host opens door and detects player on door
3. Host sends `room_transition` with `reviveePlayers` array
4. Server broadcasts to all clients
5. Clients revive dead players, reset positions
6. Host starts new room generation

### Damage Numbers Synchronization

**Purpose**: Display floating damage numbers to all players showing accurate damage dealt.

**Critical Requirement**: `Game.multiplayerEnabled` flag must be set to `true` when players join lobbies.

**Synchronization Flow**:

**Host Creates Damage** (3 paths):
1. **Melee attacks** (`combat.js:232`): Host deals damage → sends `damage_number` event
2. **Projectiles** (`main.js:3639`): Host projectile hits → sends `damage_number` event  
3. **Remote player attacks** (`multiplayer.js:1121`): Host validates client damage → creates local damage number + sends event

**Event Structure**:
```javascript
{
  type: 'damage_number',
  data: {
    enemyId: 'enemy-123',
    x: 450,        // World coordinates (accurate at damage time)
    y: 300,
    damage: 25,
    isCrit: false,
    isWeakPoint: false
  }
}
```

**Server Relay** (`mp-server-worker.js:526-538`):
- Validates sender is host
- Broadcasts to all clients (excluding host)
- No modification of data

**Client Reception** (`multiplayer.js:156-157`):
- Receives `damage_number` event
- Validates data (coordinates, damage value)
- **Uses provided coordinates** (NOT client's interpolated enemy position)
- Calls `createDamageNumber(x, y, damage, isCrit, isWeakPoint)`
- Damage number added to `Game.damageNumbers` array

**Rendering** (`ui.js:86-98`):
- Rendered inside camera transform (`main.js:2936`)
- Uses world coordinates (automatic screen conversion)
- Fades over 1.5 seconds
- Only visible if within player's viewport (~455px radius)

**Coordinate System**:
- Damage numbers use **world coordinates** (enemy position at damage time)
- Rendered **inside camera transform** for automatic conversion
- Each player has own camera following their player
- Prevents misalignment from network lag/interpolation

**Validation**:
- Coordinates validated as numbers (not NaN/undefined)
- Damage validated as positive number
- Invalid data logs error and returns early (no crash)

**Debug System**:
- Toggle verbose logging: `DebugFlags.DAMAGE_NUMBERS = true` (in console)
- Logs creation, transmission, reception, and rendering
- OFF by default to prevent log spam

**Common Issues Fixed**:
- ✓ `Game.multiplayerEnabled` not set → damage events never sent
- ✓ Using client's interpolated coordinates → misalignment
- ✓ Host not seeing remote player damage → local creation added
- ✓ Missing validation → crashes from bad data

### Testing Infrastructure

**Automated Test Suite** (`tests/damage-numbers.test.js`):

**Purpose**: Verify multiplayer damage number synchronization works correctly.

**Test Framework**: Puppeteer (headless Chrome automation)

**Test Flow**:
1. Start local WebSocket server (`ws://localhost:4000`)
2. Start HTTP server for game files (`http://localhost:8080`)
3. Launch two headless browsers (host + client)
4. Create lobby and join game
5. Simulate CLIENT attacking (should see damage in own viewport)
6. Simulate HOST attacking (sends to client)
7. Verify damage numbers created, synced, and rendered
8. Check viewport visibility based on camera positions
9. Take screenshots for visual verification
10. Report detailed results with color-coded output

**Test Verification**:
- ✓ Host sent `damage_number` event
- ✓ Client received `damage_number` event
- ✓ Client created damage number
- ✓ Client has damage numbers in array
- ✓ Client damage numbers in viewport
- ✓ Client rendering damage numbers

**Running Tests**:
```bash
cd tests
npm install  # First time only
npm test     # Run test suite
```

**Test Results**: Outputs colored pass/fail with detailed logs.

**Debug Flags System** (`js/debug.js`):

**Purpose**: Toggle verbose logging at runtime without code changes.

**Structure**:
```javascript
const DebugFlags = {
    DAMAGE_NUMBERS: false,  // Damage number sync logging
    // Future flags can be added here
    enable(flagName) { this[flagName] = true; },
    disable(flagName) { this[flagName] = false; }
};
```

**Usage**:
```javascript
// In browser console (F12)
DebugFlags.DAMAGE_NUMBERS = true   // Enable
DebugFlags.DAMAGE_NUMBERS = false  // Disable
```

**Benefits**:
- No code modification needed
- Toggle at runtime (no restart)
- Prevents log spam when disabled
- Easy to add new debug categories

**Test Documentation**: See `tests/README.md` for detailed testing guide.

### Performance Considerations

#### Network Optimization
- **Throttling:** State updates limited to 30/sec to reduce bandwidth
- **Minimal State:** Only sync active game state (no unnecessary data)
- **ID-Based Sync:** Enemies and loot synced by ID (robust to desync)
- **Input Compression:** Serialize only essential input data
- **Message Batching:** Multiple state updates in single message when possible

#### Client Performance
- **Interpolation:** Smooth rendering despite network jitter
- **Prediction:** Local input prediction for responsive controls
- **Cleanup:** Automatic cleanup of old state buffers
- **Latency Handling:** Adaptive interpolation delay based on RTT
- **Input Snapshotting:** Minimal overhead (just copying input state before update)

#### Host Performance
- **Player Simulation:** Host runs full player instances for all clients
- **Input Processing:** Host processes 4x input (one per player)
- **Collision Detection:** Host checks collisions for all players
- **State Serialization:** Host serializes complete game state every frame
- **Scaling:** Performance scales linearly with player count

### Connection Management

#### Reconnection
- **Automatic:** Up to 3 reconnection attempts
- **Delay:** 2 seconds between attempts
- **State Recovery:** Rejoin lobby on successful reconnect
- **Graceful Degradation:** Single-player continues if server unavailable

#### Heartbeat System
- **Interval:** Every 30 seconds
- **Purpose:** Keep WebSocket connection alive
- **Detection:** Server detects disconnections via missing heartbeats

### Data Structures

#### Lobby Object
```javascript
{
  code: 'A3X9K2',
  host: WebSocket,
  players: [
    {
      ws: WebSocket,
      id: 'player-123',
      name: 'Player 1',
      class: 'square',
      ready: false
    }
  ],
  maxPlayers: 4,
  createdAt: 1234567890
}
```

#### Player State (Serialized)
```javascript
{
  id: 'player-123',
  class: 'square',
  x: 400,
  y: 300,
  rotation: 0,
  hp: 100,
  maxHp: 100,
  level: 5,
  // ... all player properties from serialize()
}
```

#### Game State (Host → Clients)
```javascript
{
  timestamp: 1234567890,
  gameState: 'PLAYING', // or 'NEXUS'
  roomNumber: 5,
  doorOpen: false,
  playersOnDoor: ['player-123'],
  totalAlivePlayers: 3,
  allPlayersDead: false,
  deadPlayers: ['player-456'],
  players: [/* serialized player states */],
  enemies: [/* serialized enemy states */],
  projectiles: [/* projectile states */],
  groundLoot: [/* loot states */]
}
```

#### Input State (Client → Host)
```javascript
{
  id: 'player-123',
  x: 400, // current position for validation
  y: 300,
  rotation: 0,
  class: 'square',
  clientTimestamp: 1234567890,
  input: {
    up: false,
    down: false,
    left: false,
    right: false,
    mouse: { x: 500, y: 400 },
    mouseLeft: false,
    mouseRight: false,
    space: false,
    shift: false,
    isTouchMode: false,
    touchJoysticks: {/* ... */},
    touchButtons: {/* ... */}
  }
}
```

---

## UI Elements

### HUD (Heads-Up Display)
- **Health Bar:** Top left, shows current/max HP
- **XP Bar:** Bottom of screen, shows progress to next level
- **Level Display:** Current level number
- **Room Counter:** Current room number
- **Cooldown Indicators:** Small bars showing ability cooldowns (Dodge, Heavy Attack, Special Ability)
  - Green = Ready, Red = On cooldown, Orange = Heavy attack cooldown

### Menus
- **Main Menu:** Class selection screen
- **Pause Menu:** ESC to pause
  - **Single-Player:** Actually pauses game (stops updates, shows menu)
  - **Multiplayer:** Does NOT pause game (only shows/hides menu overlay)
    - Game continues running in background
    - Updates continue (host sends state, clients send input)
    - Only visual overlay is shown/hidden
    - Accessible from both NEXUS and PLAYING states
    - Shows different buttons based on state (multiplayer button only in Nexus)
- **Multiplayer Menu:** Submenu accessible from pause menu (Nexus only)
  - Create lobby (generates 6-character code)
  - Join lobby (enter code, supports paste with Ctrl+V)
  - View lobby list (shows all players, indicates host)
  - Copy lobby code to clipboard
  - Leave lobby
  - Input handling: Prevents game controls while typing join code
  - Blocks browser shortcuts (Shift+R, Ctrl+R) when menu visible
- **Death Screen:** Stats recap (enemies killed, rooms cleared, damage taken)
  - In multiplayer: Only shows when all players are dead
  - If local player dead but others alive: Spectate mode (no death screen overlay)
- **Inventory:** Show equipped gear (I or Tab)
- **Stats Screen:** Detailed stat breakdown

### Visual Feedback
- Screen shake on heavy hits
- Hit pause (brief freeze frame)
- Particle effects on hit/death
- Damage numbers float up
- Color flash on taking damage
- Combo counter (optional)
- Perfect dodge slow-mo (optional)

---

## Data Structures

### Player Object
```javascript
{
  class: 'square',
  x, y: 400, 300,
  vx, vy: 0,
  rotation: 0,
  size: 25,
  
  // Stats
  level: 1,
  xp: 0,
  xpToNext: 100,
  
  hp: 100,
  maxHp: 100,
  baseDamage: 10,
  defense: 0,
  moveSpeed: 200,
  
  // Gear
  weapon: {slot: 'weapon', tier: 'gray', bonus: 0},
  armor: null,
  accessory: null,
  
  // Cooldowns
  attackCooldown: 0,
  heavyCooldown: 0,
  dodgeCooldown: 0,
  specialCooldown: 0,
  
  // State
  isDodging: false,
  isAttacking: false,
  invulnerable: false
}
```

### Enemy Object
```javascript
{
  type: 'circle',
  x, y: 600, 200,
  vx, vy: 0,
  size: 20,
  
  hp: 30,
  maxHp: 30,
  damage: 5,
  moveSpeed: 100,
  
  xpValue: 10,
  lootChance: 0.3,
  
  // AI state
  state: 'chase', // chase, attack, retreat
  attackCooldown: 0,
  attackWindup: 0,
  
  // Visual
  color: '#ff6b6b',
  telegraphColor: '#ff0000'
}
```

### Gear Object
```javascript
{
  id: 'gear_123',
  slot: 'weapon', // weapon, armor, accessory
  tier: 'blue',   // gray, green, blue, purple, orange
  bonus: 0.4,     // 0, 0.2, 0.4, 0.7, 1.0
  
  // Display
  x: 500,
  y: 400,
  color: '#4dabf7'
}
```

### Room Object
```javascript
{
  number: 1,
  type: 'normal', // normal, arena, boss
  width: 800,
  height: 600,
  
  enemies: [],
  loot: [],
  
  cleared: false,
  doorOpen: false,
  doorPosition: {x: 750, y: 300}
}
```

---

## Key Formulas

### Scaling
```javascript
// Enemy HP scaling
enemyHP = baseHP * (1 + roomNumber * 0.15)

// Enemy damage scaling
enemyDamage = baseDamage * (1 + roomNumber * 0.1)

// XP to next level
xpToNext = 100 * (level ^ 1.5)
```

### Damage Calculation
```javascript
finalDamage = (baseDamage * gearMultiplier) * (1 - targetDefense) * critMultiplier
```

### Loot Tier Chances
- Gray: 50%
- Green: 30%
- Blue: 15%
- Purple: 4%
- Orange: 1%

### Gear Stat Bonuses
- Gray: 0%
- Green: +20%
- Blue: +40%
- Purple: +70%
- Orange: +100%

---

## Performance Requirements

### Single-Player
- Target: 60 FPS
- Smooth frame-independent movement (delta time)
- Limit particles on screen (pool & reuse)
- Clear dead enemies from array
- Object pooling for projectiles
- Spatial partitioning if 50+ entities
- Optimize render calls (batch similar shapes)

### Multiplayer
- **Network:** 30 updates/second (throttled to reduce bandwidth)
- **Client Rendering:** 60 FPS with interpolation
- **State Buffering:** Up to 15 snapshots per entity (memory consideration)
- **Latency Handling:** Adaptive interpolation delay (100-200ms)
- **Connection:** WebSocket with heartbeat (30s interval)
- **Reconnection:** Automatic (up to 3 attempts, 2s delay)
- **Performance Scaling:** Performance scales with player count (4 players = 4x input processing on host)

---

## Design Goals

### Must Have (MVP)
- Player movement & rotation
- Basic & heavy attacks
- Dodge roll with i-frames
- 2-3 enemy types
- Health & death
- XP & leveling
- Gear drops & equipping
- Room progression (5+ rooms)
- 2 playable classes

### Should Have
- 4 playable classes
- 5 enemy types
- Special abilities per class
- Boss encounters
- Visual effects & polish
- Death stats screen

### Nice to Have
- Sound effects
- Meta progression
- Achievements
- Multiple room layouts
- Advanced AI behaviors
- Combo system
- Multiplayer (✓ IMPLEMENTED)

---

## Engagement Hooks

1. **Satisfying Feedback:** Screen shake, particles, hit effects
2. **Clear Goals:** "Reach room 20" or "Defeat the Octagon King"
3. **Risk/Reward:** Harder rooms = better loot chances
4. **Build Variety:** Different classes encourage replays
5. **Quick Sessions:** 10-15 minute runs
6. **Skill Expression:** Perfect dodges, combos, positioning

---

## Technical Architecture

### Core Technologies
- HTML5 Canvas 2D for rendering
- Vanilla JavaScript (ES6+)
- WebSockets (ws library) for multiplayer networking
- Node.js for multiplayer server
- No external client dependencies (game runs entirely in browser)

### File Structure
```
/game
  index.html
  server.js           // HTTP development server (port 3000)
  /server             // Multiplayer server
    mp-server.js      // WebSocket multiplayer server (port 4000)
    package.json      // Server dependencies (ws library)
  /js
    main.js           // Game loop
    player.js         // Player class
    combat.js         // Combat system
    gear.js           // Loot & equipment
    level.js          // Room generation
    ui.js             // HUD & menus
    input.js          // Input handling
    render.js         // Drawing functions
    utils.js          // Helper functions
    version.js        // Version tracking
    nexus.js          // Nexus hub area
    mp-config.js      // Multiplayer configuration (server URL, settings)
    multiplayer.js    // Multiplayer client module (lobby, sync, state management)
    interpolation.js   // Client-side interpolation for smooth rendering
    /enemies          // Enemy classes
      enemy-base.js     // Base enemy class with shared functionality
      enemy-basic.js    // Basic circle enemy (Swarmer)
      enemy-star.js     // Star enemy (Ranged)
      enemy-diamond.js  // Diamond enemy (Assassin)
      enemy-rectangle.js // Rectangle enemy (Brute)
      enemy-octagon.js  // Octagon enemy (Elite)
    /players           // Player classes
      player-base.js    // Base player class
      player-warrior.js // Warrior class
      player-rogue.js   // Rogue class
      player-tank.js    // Tank class
      player-mage.js    // Mage class
    /bosses            // Boss classes and systems
      hazards.js        // Environmental hazard system
      boss-base.js      // Base boss class extending EnemyBase
      boss-swarmking.js // Swarm King boss (Room 10)
      boss-twinprism.js // Twin Prism boss (Room 15)
      boss-fortress.js  // Fortress boss (Room 20)
      boss-fractalcore.js // Fractal Core boss (Room 25)
      boss-vortex.js    // Vortex boss (Room 30)
    debug.js            // Debug panel for testing (warp to rooms)
  /css
    style.css
```

### Enemy Architecture
The enemy system uses a modular inheritance pattern:
- `EnemyBase`: Common functionality (knockback, health bars, targeting, death logic)
- Individual enemy files: Each enemy type extends the base class with unique AI and visuals
- `BossBase`: Extends `EnemyBase` with boss-specific systems (phases, weak points, environmental hazards)
- Individual boss files: Each boss extends `BossBase` with unique attacks and mechanics
- Benefits: Easy to add new enemies/bosses, reduce code duplication, maintainable structure

### Class Configuration System

**Purpose**: Centralize all game balance values in configuration objects for easy tuning without code modifications.

**Architecture**:

Each player class has a corresponding configuration object at the top of its file:
- `ROGUE_CONFIG` (`js/players/player-rogue.js`)
- `WARRIOR_CONFIG` (`js/players/player-warrior.js`)
- `TANK_CONFIG` (`js/players/player-tank.js`)
- `MAGE_CONFIG` (`js/players/player-mage.js`)

**Configuration Structure**:

```javascript
const ROGUE_CONFIG = {
    // Base Stats
    baseHp: 75,
    baseDamage: 12,
    baseSpeed: 287.5,
    baseDefense: 0,
    critChance: 0.15,
    
    // Level Up Bonuses (per upgrade level in nexus)
    damagePerLevel: 0.5,
    defensePerLevel: 0.005,
    speedPerLevel: 2,
    
    // Dodge System
    dodgeCharges: 2,
    dodgeCooldown: 2.0,
    dodgeSpeed: 720,
    dodgeDuration: 0.3,
    dodgeDamage: 0.775,
    
    // Basic Attack
    knifeSpeed: 350,
    knifeLifetime: 1.5,
    knifeSize: 8,
    
    // Heavy Attack
    heavyAttackCooldown: 3.0,
    fanKnifeCount: 7,
    fanSpreadAngle: Math.PI / 3,
    fanKnifeSpeed: 400,
    fanKnifeDamage: 1.8,
    
    // Special Ability
    specialCooldown: 5.0,
    shadowCloneCount: 2,
    shadowCloneDuration: 3.0,
    shadowCloneMaxHealth: 50,
    shadowCloneHealthDecay: 10,
    
    // Descriptions for UI
    descriptions: {
        playstyle: "High mobility assassin with critical hits",
        basic: "Quick Stab - Fast triangle projectile",
        heavy: "Fan of Knives - {fanKnifeCount} knives...",
        special: "Shadow Clones - Creates {shadowCloneCount} decoys...",
        passive: "Backstab - 2x damage from behind...",
        baseStats: "{critChance|percent} Base Crit Chance..."
    }
};
```

**Benefits**:

1. **Single Source of Truth**: All balance values in one place per class
2. **Easy Balance Changes**: Modify numbers without touching implementation code
3. **Clear Documentation**: Config serves as documentation of class mechanics
4. **Testing**: Easy to test different balance scenarios
5. **Upgrade Integration**: Bonus calculations use config values
6. **Class Modifiers**: Gear affixes reference config for class-specific bonuses

**Usage Pattern**:

```javascript
class Rogue extends PlayerBase {
    constructor(x, y) {
        super(x, y);
        
        // Load upgrade bonuses from save system
        const upgrades = SaveSystem.getUpgrades('triangle');
        const bonusDamage = upgrades.damage * ROGUE_CONFIG.damagePerLevel;
        
        // Set base stats from config
        this.baseDamage = ROGUE_CONFIG.baseDamage + bonusDamage;
        this.dodgeCharges = ROGUE_CONFIG.dodgeCharges;
        this.heavyAttackCooldownTime = ROGUE_CONFIG.heavyAttackCooldown;
        
        // Config values used throughout implementation
        this.throwKnife() {
            // Uses ROGUE_CONFIG.knifeSpeed, knifeLifetime, etc.
        }
    }
}
```

**Class Modifiers**:

Gear can have class-specific modifiers that reference config values:
- `dodgeDamageMultiplier`: Multiplies ROGUE_CONFIG.dodgeDamage
- `knifeCountBonus`: Adds to ROGUE_CONFIG.fanKnifeCount
- `shadowCloneCountBonus`: Adds to ROGUE_CONFIG.shadowCloneCount
- Similar modifiers exist for all classes

**Separation of Concerns**:
- **Config**: What the numbers are (game design)
- **Implementation**: How the mechanics work (code)
- **Modifiers**: How gear affects the class (affixes)

This makes it easy for game designers to balance without touching code, and for programmers to implement mechanics without hardcoding values.

---

## Art Style

### Visual Design
- Simple geometric shapes
- Clear shape recognition
- Color-coded systems (gear tiers, enemy types)
- Particle effects for feedback
- Minimal but polished aesthetic

### Color Schemes
- **Player Classes:** Distinct shapes + colors
- **Enemies:** Red-based danger palette
- **Loot Drops:** Tier-based colors
- **UI:** Clean, minimalist
- **Room Backgrounds:** Different colors per zone

---

## Debug Tools

### Debug Panel
A developer tool accessible from the browser console for testing and debugging:
- **Toggle:** `DebugPanel.toggle()` in console or `Ctrl+D` keyboard shortcut
- **Features:**
  - Current room number display
  - Quick warp buttons for rooms 1, 5, 10, 15, 20, 25, 30 (boss rooms highlighted in orange)
  - Custom room input field (1-100)
  - Warp button to jump to any room number
- **Usage:** Opens a panel in the top-right corner with green terminal-style UI
- **Purpose:** Quickly test boss encounters and room progression without playing through earlier rooms

## Testing Criteria

After each implementation phase:
- ✓ No console errors
- ✓ Smooth 60 FPS
- ✓ Accurate collision detection
- ✓ Readable UI elements
- ✓ Responsive controls
- ✓ Fair balance
- ✓ Clear visual feedback
- ✓ Clean state management


