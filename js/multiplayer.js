// Multiplayer client module
// This module is dynamically loaded only when accessing multiplayer features

class MultiplayerManager {
    constructor() {
        this.ws = null;
        this.connected = false;
        this.connecting = false;
        this.lobbyCode = null;
        this.playerId = null;
        this.isHost = false;
        this.players = []; // All players in lobby
        this.remotePlayers = []; // Other players (excluding local)
        this.reconnectAttempts = 0;
        this.heartbeatInterval = null;
        this.lastStateUpdate = 0;
        this.stateUpdateRate = 1000 / 30; // 30 updates per second
        
        // Latency tracking
        this.rttSamples = []; // Array of RTT measurements
        this.currentRTT = 0; // Current estimated RTT
        this.pendingStateRequests = new Map(); // Map<timestamp, clientSendTime> for RTT calculation
        this.maxRttSamples = 10; // Keep last 10 RTT samples for averaging
    }
    
    // Connect to multiplayer server
    connect() {
        return new Promise((resolve, reject) => {
            if (this.connected || this.connecting) {
                resolve();
                return;
            }
            
            this.connecting = true;
            
            try {
                this.ws = new WebSocket(MultiplayerConfig.SERVER_URL);
                
                this.ws.onopen = () => {
                    console.log('[Multiplayer] Connected to server');
                    this.connected = true;
                    this.connecting = false;
                    this.reconnectAttempts = 0;
                    this.startHeartbeat();
                    resolve();
                };
                
                this.ws.onmessage = (event) => {
                    this.handleMessage(event.data);
                };
                
                this.ws.onerror = (error) => {
                    console.error('[Multiplayer] WebSocket error:', error);
                    this.connecting = false;
                    reject(new Error('Failed to connect to multiplayer server'));
                };
                
                this.ws.onclose = () => {
                    console.log('[Multiplayer] Disconnected from server');
                    this.connected = false;
                    this.connecting = false;
                    this.stopHeartbeat();
                    this.handleDisconnect();
                };
            } catch (err) {
                console.error('[Multiplayer] Connection error:', err);
                this.connecting = false;
                reject(err);
            }
        });
    }
    
    // Start heartbeat to keep connection alive
    startHeartbeat() {
        this.heartbeatInterval = setInterval(() => {
            if (this.connected && this.ws.readyState === WebSocket.OPEN) {
                this.send({ type: 'heartbeat' });
            }
        }, MultiplayerConfig.HEARTBEAT_INTERVAL);
    }
    
    // Stop heartbeat
    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }
    
    // Handle incoming messages
    handleMessage(data) {
        try {
            const msg = JSON.parse(data);
            
            switch (msg.type) {
                case 'lobby_created':
                    this.handleLobbyCreated(msg.data);
                    break;
                case 'lobby_joined':
                    this.handleLobbyJoined(msg.data);
                    break;
                case 'lobby_error':
                    this.handleLobbyError(msg.data);
                    break;
                case 'player_joined':
                    this.handlePlayerJoined(msg.data);
                    break;
                case 'player_left':
                    this.handlePlayerLeft(msg.data);
                    break;
                case 'host_migrated':
                    this.handleHostMigrated(msg.data);
                    break;
                case 'game_state':
                    this.handleGameState(msg.data);
                    break;
                case 'player_state':
                    this.handlePlayerState(msg.data);
                    break;
                case 'game_start':
                    this.handleGameStart(msg.data);
                    break;
                case 'return_to_nexus':
                    this.handleReturnToNexus(msg.data);
                    break;
                case 'room_transition':
                    this.handleRoomTransition(msg.data);
                    break;
                case 'enemy_damaged':
                    this.handleEnemyDamaged(msg.data);
                    break;
                case 'enemy_state_update':
                    this.handleEnemyStateUpdate(msg.data);
                    break;
                case 'player_damaged':
                    this.handlePlayerDamaged(msg.data);
                    break;
                case 'loot_pickup':
                    this.handleLootPickup(msg.data);
                    break;
                case 'heartbeat_ack':
                    // Heartbeat acknowledged
                    break;
                default:
                    console.warn('[Multiplayer] Unknown message type:', msg.type);
            }
        } catch (err) {
            console.error('[Multiplayer] Failed to handle message:', err);
        }
    }
    
    // Send message to server
    send(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const msgStr = JSON.stringify(message);
            this.ws.send(msgStr);
        } else {
            console.warn('[Multiplayer] Cannot send message - not connected', message.type);
        }
    }
    
    // Create a new lobby
    async createLobby(playerName, playerClass) {
        if (!this.connected) {
            await this.connect();
        }
        
        this.send({
            type: 'create_lobby',
            data: {
                playerName: playerName || 'Player 1',
                class: playerClass || Game.selectedClass || 'square'
            }
        });
    }
    
    // Join existing lobby
    async joinLobby(code, playerName, playerClass) {
        if (!this.connected) {
            await this.connect();
        }
        
        this.send({
            type: 'join_lobby',
            data: {
                code: code.toUpperCase(),
                playerName: playerName || 'Player',
                playerClass: playerClass || Game.selectedClass || 'square'
            }
        });
    }
    
    // Leave current lobby
    leaveLobby() {
        if (this.connected) {
            this.send({ type: 'leave_lobby' });
        }
        this.cleanup();
    }
    
    // Start game (host only)
    startGame() {
        if (!this.isHost) {
            console.warn('[Multiplayer] Only host can start game');
            return;
        }
        
        this.send({
            type: 'game_start',
            data: {
                roomNumber: 1,
                timestamp: Date.now()
            }
        });
    }
    
    // Send game state (host only)
    sendGameState() {
        if (!this.isHost || !Game.player) return;
        
        // Throttle updates
        const now = Date.now();
        if (now - this.lastStateUpdate < this.stateUpdateRate) {
            return;
        }
        this.lastStateUpdate = now;
        
        const state = this.serializeGameState();
        this.send({
            type: 'game_state',
            data: state
        });
    }
    
    // Send player state (clients only)
    sendPlayerState() {
        if (this.isHost || !Game.player) return;
        
        const state = this.serializePlayerState();
        this.send({
            type: 'player_state',
            data: state
        });
    }
    
    // Serialize full game state (host)
    serializeGameState() {
        const state = {
            timestamp: Date.now(),
            gameState: Game.state || 'NEXUS', // Include current game state (NEXUS, PLAYING, etc.)
            roomNumber: Game.roomNumber || 1,
            doorOpen: (typeof currentRoom !== 'undefined' && currentRoom) ? currentRoom.doorOpen : false,
            
            // Door waiting state (for multiplayer UI)
            playersOnDoor: Game.playersOnDoor || [],
            totalAlivePlayers: Game.totalAlivePlayers || 0,
            
            // Death state synchronization
            allPlayersDead: Game.allPlayersDead || false,
            deadPlayers: Array.from(Game.deadPlayers || []),
            
            // Serialize all players
            players: this.serializeAllPlayers(),
            
            // Serialize enemies (only if in PLAYING state)
            // Let each enemy serialize itself! (clean architecture)
            enemies: (Game.state === 'PLAYING') ? Game.enemies.map(enemy => 
                enemy.serialize ? enemy.serialize() : {}
            ) : [],
            
            // Serialize projectiles (only if in PLAYING state)
            projectiles: (Game.state === 'PLAYING') ? Game.projectiles.map(proj => ({
                x: proj.x,
                y: proj.y,
                vx: proj.vx,
                vy: proj.vy,
                size: proj.size,
                type: proj.type,
                color: proj.color,
                damage: proj.damage,
                lifetime: proj.lifetime,
                elapsed: proj.elapsed
            })) : [],
            
            // Serialize ground loot (only if in PLAYING state)
            groundLoot: (Game.state === 'PLAYING' && typeof groundLoot !== 'undefined') ? groundLoot.map(gear => ({
                id: gear.id, // Unique ID for sync
                x: gear.x,
                y: gear.y,
                slot: gear.slot,
                tier: gear.tier,
                stats: gear.stats
            })) : []
        };
        
        return state;
    }
    
    // Serialize all players in lobby
    serializeAllPlayers() {
        const players = [];
        
        // Add local player (host's player)
        if (Game.player) {
            players.push(this.serializePlayerInstance(Game.player, this.playerId));
        }
        
        // Add remote player instances (host simulates these in PLAYING state)
        if (this.isHost && typeof Game !== 'undefined' && Game.remotePlayerInstances) {
            Game.remotePlayerInstances.forEach((playerInstance, playerId) => {
                players.push(this.serializePlayerInstance(playerInstance, playerId));
            });
        } else if (this.isHost && this.remotePlayers && this.remotePlayers.length > 0) {
            // In NEXUS or before instances are created, use remote player data
            this.remotePlayers.forEach(rp => {
                players.push(rp);
            });
        }
        
        return players;
    }
    
    // Serialize a player instance (used by host to send authoritative state)
    serializePlayerInstance(player, playerId) {
        // Let the player serialize itself! (clean architecture)
        const playerState = player.serialize ? player.serialize() : {};
        
        // Determine class - use selectedClass in NEXUS, playerClass in PLAYING
        let playerClass = player.playerClass;
        if (typeof Game !== 'undefined' && Game.state === 'NEXUS') {
            // In NEXUS, use selectedClass if this is the local player
            if (playerId === this.playerId) {
                playerClass = Game.selectedClass || player.playerClass;
            }
        }
        
        return {
            id: playerId,
            class: playerClass,
            name: 'Player', // TODO: Add player name selection
            ...playerState // All player state from player.serialize()
        };
    }
    
    // Serialize local player state (clients send inputs to host)
    serializePlayerState() {
        if (!Game.player) return null;
        
        const clientTimestamp = Date.now();
        
        // Use cached input snapshot if available (preserves justPressed/justReleased flags)
        // Otherwise serialize fresh input (for initial states)
        const inputState = this.cachedInputSnapshot || this.serializeInput();
        
        // Debug: Log when sending button releases for abilities
        if (inputState.isTouchMode && inputState.touchButtons) {
            for (const [name, button] of Object.entries(inputState.touchButtons)) {
                if (button.justReleased) {
                    console.log(`[Client] Sending ${name} justReleased to host, finalJoystickState:`, button.finalJoystickState);
                }
            }
        }
        
        return {
            id: this.playerId,
            // Position (for validation/interpolation)
            x: Game.player.x,
            y: Game.player.y,
            rotation: Game.player.rotation,
            
            // Current class (important for nexus class changes)
            class: Game.selectedClass || Game.player.playerClass,
            
            // Client timestamp for RTT calculation
            clientTimestamp: clientTimestamp,
            
            // INPUT STATE - This is what host needs to simulate the player
            input: inputState
        };
    }
    
    // Serialize current input state
    serializeInput() {
        if (typeof Input === 'undefined') {
            return { 
                keys: {}, 
                mouse: { x: 0, y: 0 }, 
                mouseLeft: false, 
                mouseRight: false,
                isTouchMode: false
            };
        }
        
        // Serialize touch joysticks (extract needed properties)
        const serializedJoysticks = {};
        if (Input.touchJoysticks) {
            for (const [name, joystick] of Object.entries(Input.touchJoysticks)) {
                // Call getDirection() and getMagnitude() methods instead of accessing properties directly
                const direction = joystick.getDirection ? joystick.getDirection() : { x: 0, y: 0 };
                const magnitude = joystick.getMagnitude ? joystick.getMagnitude() : (joystick.magnitude || 0);
                
                serializedJoysticks[name] = {
                    active: joystick.active || false,
                    magnitude: magnitude,
                    direction: {
                        x: direction.x || 0,
                        y: direction.y || 0
                    },
                    justReleased: joystick.justReleased || false
                };
            }
        }
        
        // Serialize touch buttons (extract needed properties)
        const serializedButtons = {};
        if (Input.touchButtons) {
            for (const [name, button] of Object.entries(Input.touchButtons)) {
                // Debug: Log when button has finalJoystickState
                if (button.finalJoystickState) {
                    console.log(`[Client] Button ${name} has finalJoystickState - mag: ${button.finalJoystickState.magnitude}, dir: (${button.finalJoystickState.direction.x.toFixed(2)}, ${button.finalJoystickState.direction.y.toFixed(2)})`);
                }
                
                serializedButtons[name] = {
                    pressed: button.pressed || false,
                    justPressed: button.justPressed || false,
                    justReleased: button.justReleased || false,
                    // Include finalJoystickState for press-and-release abilities
                    finalJoystickState: button.finalJoystickState ? {
                        direction: button.finalJoystickState.direction || { x: 0, y: 0 },
                        magnitude: button.finalJoystickState.magnitude || 0,
                        angle: button.finalJoystickState.angle || 0
                    } : null
                };
            }
        }
        
        // Check if in touch mode
        const isTouchMode = Input.isTouchMode ? Input.isTouchMode() : false;
        
        // Debug: Log touch mode state (only once per second to avoid spam)
        if (!this._lastTouchModeLog || Date.now() - this._lastTouchModeLog > 1000) {
            if (isTouchMode) {
                console.log(`[Client] Serializing input - isTouchMode: ${isTouchMode}`);
            }
            this._lastTouchModeLog = Date.now();
        }
        
        return {
            // Movement keys
            up: Input.getKeyState('w') || Input.getKeyState('ArrowUp'),
            down: Input.getKeyState('s') || Input.getKeyState('ArrowDown'),
            left: Input.getKeyState('a') || Input.getKeyState('ArrowLeft'),
            right: Input.getKeyState('d') || Input.getKeyState('ArrowRight'),
            
            // Mouse/aim
            mouse: { 
                x: Input.mouse ? Input.mouse.x : 0, 
                y: Input.mouse ? Input.mouse.y : 0 
            },
            mouseLeft: Input.mouseLeft || false,
            mouseRight: Input.mouseRight || false,
            
            // Abilities
            space: Input.getKeyState(' '),
            shift: Input.getKeyState('shift'),
            
            // Touch controls (if applicable)
            isTouchMode: isTouchMode,
            touchJoysticks: serializedJoysticks,
            touchButtons: serializedButtons,
            
            // All keys (for any special bindings)
            keys: Input.keys || {}
        };
    }
    
    // Handle lobby created
    handleLobbyCreated(data) {
        this.lobbyCode = data.code;
        this.playerId = data.playerId;
        this.isHost = data.isHost;
        this.players = data.players;
        this.updateRemotePlayers();
        
        console.log(`[Multiplayer] Lobby created: ${this.lobbyCode}`);
        
        // Initialize player instances for any existing players (usually just us when creating)
        if (typeof Game !== 'undefined' && data.players) {
            data.players.forEach(player => {
                if (player.id !== this.playerId && this.isHost) {
                    if (Game.initializeRemotePlayerInstance) {
                        Game.initializeRemotePlayerInstance(player.id, player.class);
                    }
                    if (Game.initializeRemotePlayerState) {
                        Game.initializeRemotePlayerState(player.id);
                    }
                }
            });
        }
        
        // Immediately send game state as host
        setTimeout(() => {
            if (this.isHost) {
                this.sendGameState();
            }
        }, 100);
        
        // Notify game
        if (typeof onLobbyCreated === 'function') {
            onLobbyCreated(data);
        }
    }
    
    // Handle lobby joined
    handleLobbyJoined(data) {
        this.lobbyCode = data.code;
        this.playerId = data.playerId;
        this.isHost = data.isHost;
        this.players = data.players;
        this.updateRemotePlayers();
        
        console.log(`[Multiplayer] Joined lobby: ${this.lobbyCode}`);
        
        // Immediately update Game.remotePlayers for rendering
        if (typeof Game !== 'undefined') {
            Game.remotePlayers = this.remotePlayers;
            
            // Initialize player instances for all existing players in lobby
            if (data.players) {
                data.players.forEach(player => {
                    if (player.id !== this.playerId) {
                        // Host: Create actual player instances for simulation
                        if (this.isHost) {
                            if (Game.initializeRemotePlayerInstance) {
                                Game.initializeRemotePlayerInstance(player.id, player.class);
                            }
                            if (Game.initializeRemotePlayerState) {
                                Game.initializeRemotePlayerState(player.id);
                            }
                            if (Game.getPlayerStats) {
                                Game.getPlayerStats(player.id);
                            }
                            console.log(`[Host] Initialized player instance for ${player.id} (${player.class})`);
                        }
                        
                        // All players: Ensure class is set for rendering
                        const remotePlayer = this.remotePlayers.find(rp => rp.id === player.id);
                        if (remotePlayer) {
                            remotePlayer.class = player.class;
                            console.log(`[Client] Set remote player ${player.id} class to ${player.class}`);
                        }
                    }
                });
            }
        }
        
        // Immediately send our player state to host
        setTimeout(() => {
            if (!this.isHost) {
                this.sendPlayerState();
            }
        }, 100);
        
        // Notify game
        if (typeof onLobbyJoined === 'function') {
            onLobbyJoined(data);
        }
    }
    
    // Handle lobby error
    handleLobbyError(data) {
        console.error('[Multiplayer] Lobby error:', data.message);
        
        // Notify game
        if (typeof onLobbyError === 'function') {
            onLobbyError(data);
        }
    }
    
    // Handle player joined
    handlePlayerJoined(data) {
        this.players = data.players;
        this.updateRemotePlayers();
        
        console.log(`[Multiplayer] Player joined: ${data.player.name}`);
        
        // Immediately update Game.remotePlayers for rendering
        if (typeof Game !== 'undefined') {
            Game.remotePlayers = this.remotePlayers;
            
            // If we're the host, create player instance for the new player
            if (this.isHost && data.player && data.player.id !== this.playerId) {
                if (Game.initializeRemotePlayerInstance) {
                    Game.initializeRemotePlayerInstance(data.player.id, data.player.class);
                }
                if (Game.initializeRemotePlayerState) {
                    Game.initializeRemotePlayerState(data.player.id);
                }
                if (Game.getPlayerStats) {
                    Game.getPlayerStats(data.player.id);
                }
            }
        }
        
        // If we're the host, immediately send current game state to help new player sync
        if (this.isHost) {
            setTimeout(() => {
                this.sendGameState();
            }, 50);
            
            // Send multiple times to ensure they catch up
            setTimeout(() => {
                this.sendGameState();
            }, 200);
        }
        
        // Notify game
        if (typeof onPlayerJoined === 'function') {
            onPlayerJoined(data);
        }
    }
    
    // Handle player left
    handlePlayerLeft(data) {
        this.players = data.players;
        this.updateRemotePlayers();
        
        console.log(`[Multiplayer] Player left`);
        
        // Notify game
        if (typeof onPlayerLeft === 'function') {
            onPlayerLeft(data);
        }
    }
    
    // Handle host migration
    handleHostMigrated(data) {
        const wasHost = this.isHost;
        this.isHost = data.newHostId === this.playerId;
        
        console.log(`[Multiplayer] Host migrated. Am I host? ${this.isHost}`);
        
        // Notify game
        if (typeof onHostMigrated === 'function') {
            onHostMigrated(data, wasHost, this.isHost);
        }
    }
    
    // Handle game state update from host
    handleGameState(data) {
        if (this.isHost) return; // Host doesn't need to receive their own state
        
        // Initialize interpolation manager if needed
        if (typeof initInterpolation !== 'undefined' && !interpolationManager) {
            interpolationManager = initInterpolation();
        }
        
        // Calculate RTT if we have timestamp data
        if (data.timestamp) {
            const now = Date.now();
            const rtt = now - data.timestamp;
            
            // Update RTT samples
            this.rttSamples.push(rtt);
            if (this.rttSamples.length > this.maxRttSamples) {
                this.rttSamples.shift();
            }
            
            // Calculate average RTT
            const avgRtt = this.rttSamples.reduce((a, b) => a + b, 0) / this.rttSamples.length;
            this.currentRTT = avgRtt;
            
            // Update interpolation manager with latency
            if (typeof interpolationManager !== 'undefined' && interpolationManager) {
                interpolationManager.updateLatency(this.currentRTT);
            }
        }
        
        // Apply game state
        this.applyGameState(data);
    }
    
    // Handle player state update (host receives from clients)
    handlePlayerState(data) {
        if (!this.isHost) return; // Only host processes player states
        
        // Check if player changed class (in nexus)
        if (data.class && typeof Game !== 'undefined') {
            // Check if we have an instance for this player
            const currentInstance = Game.remotePlayerInstances.get(data.id);
            
            // If class changed or no instance exists, recreate it
            if (!currentInstance || currentInstance.playerClass !== data.class) {
                console.log(`[Host] Recreating player instance for ${data.id} as ${data.class}`);
                const newInstance = createPlayer(data.class, data.x, data.y);
                newInstance.lastAimAngle = 0; // Initialize rotation state for touch controls
                Game.remotePlayerInstances.set(data.id, newInstance);
                
                // Update the player entry in our players list
                const playerEntry = this.players.find(p => p.id === data.id);
                if (playerEntry) {
                    playerEntry.class = data.class;
                }
            }
        }
        
        // Store player's selected class (for NEXUS rendering)
        if (data.class) {
            const remotePlayer = this.remotePlayers.find(rp => rp.id === data.id);
            if (remotePlayer) {
                remotePlayer.class = data.class;
                console.log(`[Host] Updated remote player ${data.id} class to ${data.class}`);
            }
        }
        
        // Store the client's input state for simulation
        if (data.input && typeof Game !== 'undefined' && Game.storeRemotePlayerInput) {
            Game.storeRemotePlayerInput(data.id, data.input);
        }
        
        // Update remote player in our game state (for rendering)
        this.updateRemotePlayer(data);
    }
    
    // Handle game start
    handleGameStart(data) {
        console.log('[Multiplayer] Game starting');
        
        // FIRST: Reset all remote players to game start position BEFORE any rendering
        if (this.remotePlayers && this.remotePlayers.length > 0) {
            this.remotePlayers.forEach(rp => {
                rp.x = 100;
                rp.y = 360;
            });
            
            if (typeof Game !== 'undefined') {
                Game.remotePlayers = this.remotePlayers;
            }
        }
        
        // THEN: Notify game to transition to PLAYING state
        if (typeof onGameStart === 'function') {
            onGameStart(data);
        }
    }
    
    // Handle return to nexus
    handleReturnToNexus(data) {
        console.log('[Multiplayer] Host returned to nexus, following...');
        
        // FIRST: Reset all remote players to nexus spawn BEFORE any rendering
        if (this.remotePlayers && this.remotePlayers.length > 0) {
            this.remotePlayers.forEach(rp => {
                rp.x = 300;
                rp.y = 360;
            });
            
            if (typeof Game !== 'undefined') {
                Game.remotePlayers = this.remotePlayers;
            }
        }
        
        // THEN: Notify game to return to nexus
        if (typeof onReturnToNexus === 'function') {
            onReturnToNexus(data);
        }
    }
    
    // Handle room transition
    handleRoomTransition(data) {
        // Handle revival if signaled by host
        if (data.reviveePlayers && typeof Game !== 'undefined') {
            const localPlayerId = Game.getLocalPlayerId ? Game.getLocalPlayerId() : null;
            
            // Revive local player if dead
            if (Game.player && Game.player.dead && localPlayerId && Game.deadPlayers && Game.deadPlayers.has(localPlayerId)) {
                Game.player.dead = false;
                Game.player.alive = true;
                Game.player.hp = Game.player.maxHp * 0.5; // Revive at 50% HP
                
                // Update stats - restart alive timer
                if (Game.getPlayerStats) {
                    const stats = Game.getPlayerStats(localPlayerId);
                    stats.onRevive();
                }
                
                // Remove from dead players
                Game.deadPlayers.delete(localPlayerId);
                Game.allPlayersDead = false;
                Game.spectateMode = false;
                
                console.log(`[Multiplayer Revival] Player revived at 50% HP (${Math.floor(Game.player.hp)}/${Math.floor(Game.player.maxHp)})`);
            }
        }
        
        // FIRST: Reset all remote players to start position BEFORE any rendering
        if (this.remotePlayers && this.remotePlayers.length > 0) {
            this.remotePlayers.forEach(rp => {
                rp.x = 50;
                rp.y = 300;
            });
            
            if (typeof Game !== 'undefined') {
                Game.remotePlayers = this.remotePlayers;
            }
        }
        
        // THEN: Update room number
        if (typeof Game !== 'undefined') {
            Game.roomNumber = data.roomNumber;
        }
        
        // Notify game
        if (typeof onRoomTransition === 'function') {
            onRoomTransition(data);
        }
    }
    
    // Handle enemy damaged event (host only)
    handleEnemyDamaged(data) {
        if (!this.isHost) return; // Only host processes damage
        
        if (typeof Game === 'undefined' || !Game.enemies) return;
        
        const { enemyIndex, damage, attackerId, hitboxX, hitboxY, hitboxRadius, hitWeakPoint } = data;
        
        // Validate enemy index
        if (enemyIndex < 0 || enemyIndex >= Game.enemies.length) {
            console.warn(`[Multiplayer] Invalid enemy index: ${enemyIndex}`);
            return;
        }
        
        const enemy = Game.enemies[enemyIndex];
        
        // Validate enemy is alive
        if (!enemy || !enemy.alive) {
            console.warn(`[Multiplayer] Enemy ${enemyIndex} is not alive`);
            return;
        }
        
        // Apply damage on host
        const oldHp = enemy.hp;
        
        // For bosses with weak points, pass hitbox info for proper detection
        if (enemy.isBoss && hitboxX !== undefined && hitboxY !== undefined && hitboxRadius !== undefined) {
            enemy.takeDamage(damage, hitboxX, hitboxY, hitboxRadius, attackerId);
        } else {
            enemy.takeDamage(damage, attackerId);
        }
        
        // Track last attacker (already done in takeDamage, but ensure it's set)
        enemy.lastAttacker = attackerId;
        
        // Track damage in stats for the attacker
        if (typeof Game !== 'undefined' && Game.getPlayerStats && attackerId) {
            const damageDealt = Math.min(damage, oldHp);
            const stats = Game.getPlayerStats(attackerId);
            if (stats) {
                stats.addStat('damageDealt', damageDealt);
            }
        }
        
        // Check if enemy died
        const died = enemy.hp <= 0 || !enemy.alive;
        
        console.log(`[Multiplayer Host] Enemy ${enemyIndex} took ${damage} damage from ${attackerId}. HP: ${oldHp} → ${enemy.hp}${died ? ' (DIED)' : ''}`);
        
        // Broadcast state update to all clients (including the attacker for validation)
        this.send({
            type: 'enemy_state_update',
            data: {
                enemyIndex: enemyIndex,
                hp: enemy.hp,
                alive: enemy.alive,
                lastAttacker: enemy.lastAttacker,
                died: died
            }
        });
    }
    
    // Handle enemy state update (clients only)
    handleEnemyStateUpdate(data) {
        if (this.isHost) return; // Host doesn't need to receive their own updates
        
        if (typeof Game === 'undefined' || !Game.enemies) return;
        
        const { enemyIndex, hp, alive, lastAttacker, died } = data;
        
        // Validate enemy index
        if (enemyIndex < 0 || enemyIndex >= Game.enemies.length) {
            console.warn(`[Multiplayer Client] Invalid enemy index: ${enemyIndex}`);
            return;
        }
        
        const enemy = Game.enemies[enemyIndex];
        if (!enemy) return;
        
        // Update enemy state from host (authoritative)
        enemy.hp = hp;
        enemy.alive = alive;
        if (lastAttacker) {
            enemy.lastAttacker = lastAttacker;
        }
        
        // If enemy just died, trigger death effects
        if (died && !enemy.alive) {
            console.log(`[Multiplayer Client] Enemy ${enemyIndex} died (killed by ${lastAttacker})`);
            
            // Trigger visual effects (particles)
            if (typeof createParticleBurst !== 'undefined') {
                createParticleBurst(enemy.x, enemy.y, enemy.color, 12);
            }
            
            // Give XP to local player if still alive
            if (typeof Game !== 'undefined' && Game.player && !Game.player.dead) {
                Game.player.addXP(enemy.xpValue);
            }
            
            // DON'T drop loot on client - loot comes from host via game_state
            // Host is authoritative for loot generation
        }
    }
    
    // Handle player damaged event (clients only)
    handlePlayerDamaged(data) {
        if (typeof Game === 'undefined' || !Game.player) return;
        
        const { targetPlayerId, damage } = data;
        
        // Check if this damage is for local player
        const localPlayerId = Game.getLocalPlayerId ? Game.getLocalPlayerId() : null;
        
        if (localPlayerId === targetPlayerId) {
            // Apply damage to local player
            Game.player.takeDamage(damage);
            console.log(`[Multiplayer] Received damage from enemy: ${damage}`);
        }
    }
    
    // Handle loot pickup (from any player)
    handleLootPickup(data) {
        if (typeof Game === 'undefined' || typeof groundLoot === 'undefined') return;
        
        const { playerId, lootId, gear } = data;
        
        // Find and remove the loot by ID
        const index = groundLoot.findIndex(g => g.id === lootId);
        if (index !== -1) {
            groundLoot.splice(index, 1);
            console.log(`[Multiplayer] Player ${playerId} picked up loot ${lootId}`);
        }
        
        // If we're the host and this is a remote player's pickup, equip gear on their instance
        if (Game.isHost && Game.isHost() && gear) {
            const localPlayerId = Game.getLocalPlayerId ? Game.getLocalPlayerId() : null;
            
            // Only equip on remote player instance if this pickup was from a client (not host)
            if (playerId !== localPlayerId && Game.remotePlayerInstances) {
                const remotePlayer = Game.remotePlayerInstances.get(playerId);
                if (remotePlayer && remotePlayer.equipGear) {
                    remotePlayer.equipGear(gear);
                    console.log(`[Host] Equipped ${gear.tier} ${gear.slot} on remote player ${playerId}`);
                }
            }
        }
    }
    
    // Apply full game state (clients)
    applyGameState(state) {
        if (!state) return;
        
        // Update game state if provided (but don't override local state changes)
        // This is informational only - actual state transitions are controlled by messages
        
        // Update room number
        if (state.roomNumber) {
            Game.roomNumber = state.roomNumber;
        }
        
        // Update door state (only if in PLAYING state)
        if (Game.state === 'PLAYING' && typeof currentRoom !== 'undefined' && currentRoom) {
            currentRoom.doorOpen = state.doorOpen;
        }
        
        // Update door waiting state (for UI)
        if (state.playersOnDoor !== undefined) {
            Game.playersOnDoor = state.playersOnDoor;
        }
        if (state.totalAlivePlayers !== undefined) {
            Game.totalAlivePlayers = state.totalAlivePlayers;
        }
        
        // Update death state synchronization
        if (state.allPlayersDead !== undefined) {
            Game.allPlayersDead = state.allPlayersDead;
        }
        if (state.deadPlayers !== undefined) {
            // Rebuild deadPlayers Set from array
            Game.deadPlayers = new Set(state.deadPlayers);
        }
        
        // Update remote players (works in both NEXUS and PLAYING)
        if (state.players) {
            state.players.forEach(playerData => {
                if (playerData.id === this.playerId) {
                    // This is our player - apply authoritative state from host
                    // Let the player apply its own state! (clean architecture)
                    if (typeof Game !== 'undefined' && Game.player && Game.player.applyState) {
                        Game.player.applyState(playerData);
                    }
                }
            });
            
            // Store remote players for rendering
            this.remotePlayers = state.players.filter(p => p.id !== this.playerId);
            if (typeof Game !== 'undefined') {
                Game.remotePlayers = this.remotePlayers;
                
                // CLIENT: Create or update shadow instances for rendering
                if (!this.isHost) {
                    state.players.forEach(playerData => {
                        if (playerData.id !== this.playerId) {
                            // Get or create shadow instance
                            let shadowInstance = Game.remotePlayerShadowInstances.get(playerData.id);
                            
                            if (!shadowInstance || shadowInstance.playerClass !== playerData.class) {
                                // Create new shadow instance
                                if (typeof createPlayer !== 'undefined') {
                                    shadowInstance = createPlayer(playerData.class, playerData.x, playerData.y);
                                    Game.remotePlayerShadowInstances.set(playerData.id, shadowInstance);
                                    console.log(`[Client] Created shadow instance for ${playerData.id} (${playerData.class})`);
                                }
                            }
                            
                            // Update shadow instance with host state
                            if (shadowInstance && Game.updateShadowInstance) {
                                Game.updateShadowInstance(shadowInstance, playerData);
                            }
                        }
                    });
                }
                
                // Verify and log remote player classes
                this.remotePlayers.forEach(rp => {
                    if (!rp.class) {
                        console.warn(`[Client] Remote player ${rp.id} missing class! Using square as fallback.`);
                        rp.class = 'square';
                    }
                });
            }
        }
        
        // Only update enemies/projectiles/loot if in PLAYING state
        if (Game.state === 'PLAYING') {
            // Update enemies - ID-based sync (robust and clean)
            if (state.enemies && Game.enemies) {
                // Build set of current enemy IDs from host
                const hostEnemyIds = new Set(state.enemies.map(e => e.id));
                
                // Remove enemies that no longer exist on host
                Game.enemies = Game.enemies.filter(enemy => {
                    if (!hostEnemyIds.has(enemy.id)) {
                        // Enemy removed on host - trigger death effects if still alive
                        if (enemy.alive) {
                            enemy.alive = false;
                            if (typeof createParticleBurst !== 'undefined') {
                                createParticleBurst(enemy.x, enemy.y, enemy.color, 12);
                            }
                            console.log(`[Client] Enemy ${enemy.id} removed by host`);
                        }
                        return false; // Remove from array
                    }
                    return true; // Keep
                });
                
                // Update or create enemies by ID
                state.enemies.forEach(enemyData => {
                    let enemy = Game.enemies.find(e => e.id === enemyData.id);
                    
                    if (!enemy) {
                        // New enemy from host - create it from data
                        if (typeof createEnemyFromData !== 'undefined') {
                            enemy = createEnemyFromData(enemyData);
                            if (enemy) {
                                Game.enemies.push(enemy);
                                console.log(`[Client] Created enemy ${enemyData.id} (${enemyData.shape}) from host data`);
                            }
                        }
                        return; // Enemy is already fully initialized from data
                    }
                    
                    // Let the enemy apply its own state! (clean architecture)
                    if (enemy.applyState) {
                        enemy.applyState(enemyData);
                    }
                });
            }
            
            // Update projectiles with interpolation support
            if (state.projectiles) {
                // Store previous state for interpolation
                Game.previousProjectiles = Game.projectiles.map(p => ({
                    x: p.x,
                    y: p.y,
                    vx: p.vx,
                    vy: p.vy
                }));
                
                // Update projectiles from host state
                // Match by index (host sends in same order) or create new
                const newProjectiles = [];
                state.projectiles.forEach((hostProj, index) => {
                    // Try to find matching projectile by position/velocity (fuzzy match)
                    let matchingProj = Game.projectiles[index];
                    
                    if (matchingProj && 
                        Math.abs(matchingProj.x - hostProj.x) < 100 &&
                        Math.abs(matchingProj.y - hostProj.y) < 100) {
                        // Update existing projectile
                        matchingProj.targetX = hostProj.x;
                        matchingProj.targetY = hostProj.y;
                        matchingProj.vx = hostProj.vx;
                        matchingProj.vy = hostProj.vy;
                        matchingProj.lastUpdateTime = Date.now();
                        newProjectiles.push(matchingProj);
                    } else {
                        // New projectile - create with interpolation target
                        const newProj = {
                            ...hostProj,
                            targetX: hostProj.x,
                            targetY: hostProj.y,
                            lastUpdateTime: Date.now()
                        };
                        newProjectiles.push(newProj);
                    }
                });
                
                Game.projectiles = newProjectiles;
            }
            
            // Update ground loot (authoritative from host)
            if (state.groundLoot !== undefined && typeof groundLoot !== 'undefined') {
                // ID-based loot sync (same as enemies)
                const hostLootIds = new Set(state.groundLoot.map(l => l.id));
                
                // Remove loot that no longer exists on host
                for (let i = groundLoot.length - 1; i >= 0; i--) {
                    if (!hostLootIds.has(groundLoot[i].id)) {
                        console.log(`[Client] Loot ${groundLoot[i].id} removed by host`);
                        groundLoot.splice(i, 1);
                    }
                }
                
                // Add or update loot by ID
                state.groundLoot.forEach(lootData => {
                    let existingGear = groundLoot.find(g => g.id === lootData.id);
                    
                    if (!existingGear) {
                        // New loot from host - create it
                        const tierColors = {
                            'gray': '#999999',
                            'green': '#4caf50',
                            'blue': '#2196f3',
                            'purple': '#9c27b0',
                            'orange': '#ff9800'
                        };
                        
                        const gear = {
                            id: lootData.id,
                            x: lootData.x,
                            y: lootData.y,
                            slot: lootData.slot,
                            tier: lootData.tier,
                            stats: lootData.stats,
                            size: 15,
                            color: tierColors[lootData.tier] || '#999999',
                            pulse: 0
                        };
                        groundLoot.push(gear);
                        console.log(`[Client] New loot ${gear.id} (${gear.tier} ${gear.slot})`);
                    } else {
                        // Update existing (position might change)
                        existingGear.x = lootData.x;
                        existingGear.y = lootData.y;
                    }
                });
            }
        }
    }
    
    // Update remote player (host only)
    updateRemotePlayer(playerState) {
        // Find or create remote player in our list
        let remotePlayer = this.remotePlayers.find(p => p.id === playerState.id);
        
        if (!remotePlayer) {
            this.remotePlayers.push(playerState);
        } else {
            // Update existing player
            Object.assign(remotePlayer, playerState);
        }
        
        // Also update in players list for lobby display
        const playerInList = this.players.find(p => p.id === playerState.id);
        if (playerInList) {
            Object.assign(playerInList, playerState);
        }
        
        // Store in Game object for rendering
        if (typeof Game !== 'undefined') {
            Game.remotePlayers = this.remotePlayers;
        }
    }
    
    // Update remote players list (exclude local player)
    updateRemotePlayers() {
        const newRemotePlayers = this.players.filter(p => p.id !== this.playerId).map(player => {
            // Find existing remote player to preserve state
            const existing = this.remotePlayers.find(rp => rp.id === player.id);
            
            console.log(`[updateRemotePlayers] Player ${player.id} class: ${player.class}`);
            
            // Merge player data from lobby with existing state
            return {
                id: player.id,
                name: player.name,
                class: player.class || 'square', // CRITICAL: Copy class from lobby data
                ready: player.ready,
                // Preserve position if it exists
                x: existing ? existing.x : (player.x !== undefined ? player.x : 300),
                y: existing ? existing.y : (player.y !== undefined ? player.y : 360),
                rotation: existing ? existing.rotation : (player.rotation || 0),
                hp: existing ? existing.hp : (player.hp || 100),
                maxHp: existing ? existing.maxHp : (player.maxHp || 100),
                level: existing ? existing.level : (player.level || 1)
            };
        });
        
        this.remotePlayers = newRemotePlayers;
        
        // Store in Game object
        if (typeof Game !== 'undefined') {
            Game.remotePlayers = this.remotePlayers;
            
            // Log for debugging
            console.log(`[updateRemotePlayers] Updated ${this.remotePlayers.length} remote players`);
            this.remotePlayers.forEach(rp => {
                console.log(`  - ${rp.id}: ${rp.class}`);
            });
        }
    }
    
    // Handle disconnect
    handleDisconnect() {
        // Try to reconnect
        if (this.lobbyCode && this.reconnectAttempts < MultiplayerConfig.RECONNECT_ATTEMPTS) {
            this.reconnectAttempts++;
            console.log(`[Multiplayer] Reconnecting... (${this.reconnectAttempts}/${MultiplayerConfig.RECONNECT_ATTEMPTS})`);
            
            setTimeout(() => {
                this.connect().then(() => {
                    // Rejoin lobby
                    this.joinLobby(this.lobbyCode, 'Player', Game.selectedClass);
                }).catch(err => {
                    console.error('[Multiplayer] Reconnect failed:', err);
                });
            }, MultiplayerConfig.RECONNECT_DELAY);
        } else {
            console.log('[Multiplayer] Disconnected from multiplayer');
            this.cleanup();
            
            // Notify game
            if (typeof onMultiplayerDisconnect === 'function') {
                onMultiplayerDisconnect();
            }
        }
    }
    
    // Cleanup
    cleanup() {
        this.lobbyCode = null;
        this.playerId = null;
        this.isHost = false;
        this.players = [];
        this.remotePlayers = [];
        
        if (typeof Game !== 'undefined') {
            Game.remotePlayers = [];
        }
        
        this.stopHeartbeat();
        
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        
        this.connected = false;
        this.connecting = false;
    }
    
    // Disconnect
    disconnect() {
        this.leaveLobby();
        this.cleanup();
    }
}

// Global multiplayer manager instance
let multiplayerManager = null;

// Initialize multiplayer manager
function initMultiplayer() {
    if (!multiplayerManager) {
        multiplayerManager = new MultiplayerManager();
        console.log('[Multiplayer] Module loaded');
    }
    return multiplayerManager;
}

// Export for global access
if (typeof window !== 'undefined') {
    window.MultiplayerManager = MultiplayerManager;
    window.multiplayerManager = null;
    window.initMultiplayer = initMultiplayer;
}

