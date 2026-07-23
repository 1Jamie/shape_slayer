// Multiplayer client module
// This module is dynamically loaded only when accessing multiplayer features

class MultiplayerManager {
    constructor() {
        this.ws = null;
        this.connected = false;
        this.connecting = false;
        this.lobbyCode = null;
        this.playerId = null;
        this.persistentPlayerId = this.getOrCreatePersistentPlayerId(); // Persistent ID for reconnection
        this.isHost = false;
        this.players = []; // All players in lobby
        this.remotePlayers = []; // Other players (excluding local)
        this.reconnectAttempts = 0;
        this.heartbeatInterval = null;
        this.lastStateUpdate = 0;
        // Use configurable update rate, default to 30 Hz
        const targetHz = typeof MultiplayerConfig !== 'undefined' && MultiplayerConfig.STATE_UPDATE_RATE 
            ? MultiplayerConfig.STATE_UPDATE_RATE 
            : 30;
        this.stateUpdateRate = 1000 / targetHz;
        this.gameStateFullInterval = 1000; // send full state every 1s
        this.lastFullGameStateSentAt = 0;
        this.lastSentGameState = null;
        this.lastProjectileSnapshot = null;
        this.projectileBroadcastInterval = 100; // limit projectile updates to 10 Hz
        this.lastProjectileBroadcast = 0;
        this.latestGameState = null;
        this.forceFullState = false; // Host: next sendGameState must be a full snapshot
        
        // Latency tracking
        this.rttSamples = []; // Array of RTT measurements
        this.currentRTT = 0; // Current estimated RTT
        this.pendingStateRequests = new Map(); // Map<timestamp, clientSendTime> for RTT calculation
        this.maxRttSamples = 10; // Keep last 10 RTT samples for averaging

        // Player state batching
        this.playerStateSeq = 0;
        this.lastPlayerStateSnapshot = null;
        this.playerStateBuffer = [];
        this.playerStateBatchInterval = 80; // Flush every ~80ms
        this.lastPlayerBatchFlush = 0;
        this.playerLastUpdateTimes = new Map();
        
        // Sequence number tracking for game_state (host only)
        this.gameStateSequence = 0; // Increments on each game_state send, wraps at 32-bit max
        
        // Client-side sequence tracking and packet loss detection
        this.expectedSequence = null; // Next expected sequence number
        this.sequenceBuffer = new Map(); // Buffer for out-of-order packets: Map<sequence, {data, timestamp}>
        this.lastResyncRequest = 0; // Timestamp of last resync request
        this.packetLossCount = 0; // Count of detected packet losses
        this.packetArrivalTimes = []; // Array of packet arrival timestamps for jitter calculation
        this.maxPacketArrivalSamples = 20; // Keep last 20 arrival times for jitter calculation
        
        // Client-side prediction with rollback
        this.inputHistory = []; // Array of { inputSeq, input, dt, timestamp }
        this.maxInputHistorySize = (typeof MultiplayerConfig !== 'undefined' && MultiplayerConfig.INPUT_HISTORY_SIZE)
            ? MultiplayerConfig.INPUT_HISTORY_SIZE
            : 90;
        this.lastConfirmedState = null; // { inputSeq, x, y, rotation, vx, vy }
        this.predictionEnabled = (typeof MultiplayerConfig !== 'undefined')
            ? MultiplayerConfig.PREDICTION_ENABLED !== false
            : true;
        this.lastSentInputSeq = 0; // Latest inputSeq attached to outbound input

        // Prediction divergence / drift self-correction (clients)
        this.predictionStats = this.createEmptyPredictionStats();
        this.driftSamples = []; // { dx, dy, mag } recent reconcile corrections
        this.driftBiasX = 0;
        this.driftBiasY = 0;
        this.driftCoherence = 0;

        // Class is only selectable in Nexus - freeze for the whole run
        this.runClassLocks = new Map(); // playerId -> classKey

        // Host pause / stall tracking
        this.hostIsPaused = false;
        this.hostIsHidden = false;
        this.lastGameStateReceivedAt = 0;
    }

    createEmptyPredictionStats() {
        return {
            reconciles: 0,
            softIgnores: 0,
            mediumBlends: 0,
            hardSnaps: 0,
            significantDivergences: 0,
            lastDivergencePx: 0,
            maxDivergencePx: 0,
            avgDivergencePx: 0,
            divergenceSum: 0,
            lastReplaySteps: 0,
            lastMode: 'none',
            driftBiasMag: 0,
            driftCoherence: 0,
            driftActive: false
        };
    }

    isRunClassLocked() {
        return this.runClassLocks && this.runClassLocks.size > 0;
    }

    getRunClass(playerId, fallback = null) {
        if (playerId != null && this.runClassLocks && this.runClassLocks.has(playerId)) {
            return this.runClassLocks.get(playerId);
        }
        return fallback;
    }

    /**
     * Snapshot every player's class at run start. Class can only change in Nexus,
     * so mid-run network noise must not recreate people as pink squares.
     */
    lockRunClasses() {
        if (!this.runClassLocks) this.runClassLocks = new Map();
        this.runClassLocks.clear();

        const remember = (playerId, classKey) => {
            if (!playerId || !classKey) return;
            if (!this.runClassLocks.has(playerId)) {
                this.runClassLocks.set(playerId, classKey);
            }
        };

        if (typeof Game !== 'undefined') {
            if (this.playerId) {
                remember(this.playerId, Game.selectedClass || (Game.player && Game.player.playerClass));
            }
            if (Game.player && Game.player.playerId) {
                remember(Game.player.playerId, Game.player.playerClass);
            }
            if (Game.remotePlayerInstances) {
                Game.remotePlayerInstances.forEach((inst, id) => {
                    remember(id, inst && inst.playerClass);
                });
            }
            if (Game.remotePlayerShadowInstances) {
                Game.remotePlayerShadowInstances.forEach((inst, id) => {
                    remember(id, inst && inst.playerClass);
                });
            }
        }

        if (this.remotePlayers) {
            this.remotePlayers.forEach(rp => remember(rp.id, rp.class || rp.playerClass));
        }
        if (this.players) {
            this.players.forEach(p => remember(p.id, p.class));
        }

        console.log('[Multiplayer] Locked run classes:', Array.from(this.runClassLocks.entries()));
    }

    clearRunClassLocks() {
        if (this.runClassLocks) this.runClassLocks.clear();
    }

    resolvePlayerClass(playerId, claimedClass = null) {
        const locked = this.getRunClass(playerId, null);
        if (locked) return locked;
        if (claimedClass) return claimedClass;
        if (playerId === this.playerId && typeof Game !== 'undefined') {
            return Game.selectedClass || (Game.player && Game.player.playerClass) || 'square';
        }
        return 'square';
    }
    
    // Connect to multiplayer server
    connect(targetUrl = null, redirectHops = 0) {
        return new Promise((resolve, reject) => {
            if (typeof Game !== 'undefined' && Game.localSplitEnabled) {
                reject(new Error('Online multiplayer is unavailable during a local split session.'));
                return;
            }
            if (this.connected || this.connecting) {
                resolve();
                return;
            }

            if (redirectHops > (MultiplayerConfig.MAX_REDIRECT_HOPS || 2)) {
                const err = new Error('Multiplayer connection halted: maximum redirect depth reached');
                console.error('[Multiplayer]', err.message);
                reject(err);
                return;
            }
            
            this.connecting = true;
            this._redirectHops = redirectHops;
            const url = targetUrl || MultiplayerConfig.SERVER_URL;

            console.log(`[Multiplayer] Connecting to ${url}${redirectHops ? ` (redirect hop ${redirectHops})` : ''}`);

            try {
                this.ws = new WebSocket(url);
                
                this.ws.onopen = () => {
                    console.log('[Multiplayer] Connected to server');
                    this.connected = true;
                    this.connecting = false;
                    this.reconnectAttempts = 0;
                    this._activeServerUrl = url;
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
                    if (this._suppressDisconnectHandler) {
                        this._suppressDisconnectHandler = false;
                        return;
                    }
                    this.handleDisconnect();
                };
            } catch (err) {
                console.error('[Multiplayer] Connection error:', err);
                this.connecting = false;
                reject(err);
            }
        });
    }

    async followRedirect(data) {
        const hops = (this._redirectHops || 0) + 1;
        if (hops > (MultiplayerConfig.MAX_REDIRECT_HOPS || 2)) {
            console.error('[Multiplayer] Maximum redirect depth reached.');
            return;
        }
        const nextUrl = data && data.url;
        if (!nextUrl) return;

        const pendingJoin = this._pendingJoinPayload || null;
        this._suppressDisconnectHandler = true;
        try {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.close();
            }
        } catch (_e) {}
        this.connected = false;
        this.connecting = false;
        this.stopHeartbeat();

        await this.connect(nextUrl, hops);
        if (pendingJoin) {
            this._pendingJoinPayload = null;
            this.send({ type: 'join_lobby', data: pendingJoin });
        }
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
                case 'redirect':
                    this.followRedirect(msg.data).catch((err) => {
                        console.error('[Multiplayer] Redirect follow failed:', err);
                    });
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
                case 'host_status':
                    this.handleHostStatus(msg.data);
                    break;
                case 'game_state':
                    this.handleGameState(msg.data);
                    break;
                case 'player_state':
                    this.handlePlayerState(msg.data);
                    break;
            case 'player_state_batch':
                this.handlePlayerStateBatch(msg.data);
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
                    // Legacy: thin clients no longer send this; host still accepts for old clients
                    this.handleEnemyDamaged(msg.data);
                    break;
                case 'enemy_state_update':
                    this.handleEnemyStateUpdate(msg.data);
                    break;
                case 'revive_players':
                    this.handleRevivePlayers(msg.data);
                    break;
                case 'player_damaged':
                    // Deprecated: HP syncs via game_state
                    this.handlePlayerDamaged(msg.data);
                    break;
                case 'loot_pickup':
                    this.handleLootPickup(msg.data);
                    break;
                case 'gear_dropped':
                    this.handleGearDropped(msg.data);
                    break;
                case 'upgrade_purchase':
                    this.handleUpgradePurchase(msg.data);
                    break;
                case 'upgrade_purchased':
                    this.handleUpgradePurchased(msg.data);
                    break;
                case 'currency_update':
                    this.handleCurrencyUpdate(msg.data);
                    break;
                case 'shards_update':
                    this.handleShardsUpdate(msg.data);
                    break;
                case 'upgrades_sync':
                    // Unused: upgrades ride on game_state / player_state. Kept for forward-compat.
                    this.handleUpgradesSync(msg.data);
                    break;
                case 'damage_number':
                    this.handleDamageNumber(msg.data);
                    break;
                case 'combat_fx':
                    this.handleCombatFx(msg.data);
                    break;
                case 'resync_request':
                    this.handleResyncRequest(msg.data);
                    break;
                case 'final_stats':
                    this.handleFinalStats(msg.data);
                    break;
                case 'item_pylon_interact':
                    this.handleItemPylonInteract(msg.data);
                    break;
                case 'item_pylon_interact_request':
                    this.handleItemPylonInteractRequest(msg.data);
                    break;
                case 'arena_next_wave_request':
                    this.handleArenaNextWaveRequest(msg.data);
                    break;
                case 'player_leveled_up':
                    this.handlePlayerLeveledUp(msg.data);
                    break;
                case 'player_list_update':
                    this.handlePlayerListUpdate(msg.data);
                    break;
                case 'kicked_from_lobby':
                    this.handleKickedFromLobby(msg.data);
                    break;
                case 'lobby_migrating':
                    this.handleLobbyMigrating(msg.data);
                    break;
                case 'player_disconnected':
                    this.handlePlayerDisconnected(msg.data);
                    break;
                case 'player_reconnected':
                    this.handlePlayerReconnected(msg.data);
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
    
    // Create empty upgrade structure for all classes
    createEmptyUpgradeSet() {
        return {
            square: { damage: 0, defense: 0, speed: 0 },
            triangle: { damage: 0, defense: 0, speed: 0 },
            pentagon: { damage: 0, defense: 0, speed: 0 },
            hexagon: { damage: 0, defense: 0, speed: 0 }
        };
    }
    
    // Deep clone upgrade data ensuring all fields exist
    cloneUpgradeSet(upgrades) {
        const base = this.createEmptyUpgradeSet();
        if (!upgrades) {
            return base;
        }
        
        const clone = {};
        for (const classType of Object.keys(base)) {
            const source = upgrades[classType] || {};
            clone[classType] = {
                damage: source.damage || 0,
                defense: source.defense || 0,
                speed: source.speed || 0
            };
        }
        return clone;
    }
    
    // Get or create persistent player ID from localStorage
    getOrCreatePersistentPlayerId() {
        const STORAGE_KEY = 'shape_slayer_persistent_player_id';
        try {
            let persistentId = localStorage.getItem(STORAGE_KEY);
            if (!persistentId) {
                // Generate a new persistent ID
                persistentId = `persistent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                localStorage.setItem(STORAGE_KEY, persistentId);
                console.log('[Multiplayer] Generated new persistent player ID:', persistentId);
            } else {
                console.log('[Multiplayer] Using existing persistent player ID:', persistentId);
            }
            return persistentId;
        } catch (e) {
            // Fallback if localStorage is not available
            console.warn('[Multiplayer] localStorage not available, generating temporary persistent ID');
            return `persistent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        }
    }
    
    // Apply upgrade values to a player instance (host-side simulation)
    applyUpgradesToInstance(playerInstance, classType, classUpgrades) {
        if (!playerInstance || !classType || !classUpgrades) return;
        
        let config = null;
        if (classType === 'square' && typeof WARRIOR_CONFIG !== 'undefined') {
            config = WARRIOR_CONFIG;
        } else if (classType === 'triangle' && typeof ROGUE_CONFIG !== 'undefined') {
            config = ROGUE_CONFIG;
        } else if (classType === 'pentagon' && typeof TANK_CONFIG !== 'undefined') {
            config = TANK_CONFIG;
        } else if (classType === 'hexagon' && typeof MAGE_CONFIG !== 'undefined') {
            config = MAGE_CONFIG;
        }
        
        if (!config) return;
        
        const damageBonus = (classUpgrades.damage || 0) * (config.damagePerLevel || 0);
        const defenseBonus = (classUpgrades.defense || 0) * (config.defensePerLevel || 0);
        const speedBonus = (classUpgrades.speed || 0) * (config.speedPerLevel || 0);
        const cooldownBonus = (classUpgrades.cooldown || 0) * (config.cooldownPerLevel || 0);
        const healthBonus = (classUpgrades.health || 0) * (config.healthPerLevel || 0);
        const attackSpeedBonus = (classUpgrades.attackSpeed || 0) * (config.attackSpeedPerLevel || 0);
        
        if (typeof playerInstance.baseDamage !== 'undefined') {
            playerInstance.baseDamage = config.baseDamage + damageBonus;
        }
        if (typeof playerInstance.baseDefense !== 'undefined') {
            playerInstance.baseDefense = config.baseDefense + defenseBonus;
        }
        if (typeof playerInstance.baseMoveSpeed !== 'undefined') {
            playerInstance.baseMoveSpeed = config.baseSpeed + speedBonus;
        }
        if (typeof playerInstance.baseMaxHp !== 'undefined') {
            playerInstance.baseMaxHp = config.baseHp + healthBonus;
        }
        if (typeof playerInstance.cooldownReduction !== 'undefined') {
            playerInstance.cooldownReduction = Math.min(0.75, cooldownBonus); // Cap at 75%
        }
        if (typeof playerInstance.attackSpeedMultiplier !== 'undefined') {
            playerInstance.attackSpeedMultiplier = 1.0 + attackSpeedBonus;
        }
        if (typeof playerInstance.syncBaseStatAnchors === 'function') {
            playerInstance.syncBaseStatAnchors();
        }
        
        if (typeof playerInstance.updateEffectiveStats === 'function') {
            playerInstance.updateEffectiveStats();
        }
    }
    
    // Get player's upgrade levels for all classes
    getAllUpgrades() {
        if (typeof SaveSystem === 'undefined') {
            return {
                square: { damage: 0, defense: 0, speed: 0 },
                triangle: { damage: 0, defense: 0, speed: 0 },
                pentagon: { damage: 0, defense: 0, speed: 0 },
                hexagon: { damage: 0, defense: 0, speed: 0 }
            };
        }
        
        return {
            square: SaveSystem.getUpgrades('square'),
            triangle: SaveSystem.getUpgrades('triangle'),
            pentagon: SaveSystem.getUpgrades('pentagon'),
            hexagon: SaveSystem.getUpgrades('hexagon')
        };
    }
    
    // Get player's current currency
    getCurrency() {
        if (typeof SaveSystem === 'undefined') {
            return 0;
        }
        return Math.floor(SaveSystem.getCurrency());
    }
    
    // Create a new lobby
    async createLobby(playerName, playerClass) {
        if (!this.connected) {
            await this.connect();
        }
        
        const currency = this.getCurrency();
        const upgrades = this.getAllUpgrades();
        const safeRoomMeta = (typeof SaveSystem !== 'undefined' && SaveSystem.getSafeRoomUpgradeBlob)
            ? SaveSystem.getSafeRoomUpgradeBlob()
            : {};
        
        // Ensure persistent ID is set
        if (!this.persistentPlayerId) {
            this.persistentPlayerId = this.getOrCreatePersistentPlayerId();
        }
        
        this.send({
            type: 'create_lobby',
            data: {
                playerName: playerName || 'Player 1',
                class: playerClass || Game.selectedClass || 'square',
                currency: currency,
                upgrades: upgrades,
                safeRoomMeta: safeRoomMeta,
                persistentPlayerId: this.persistentPlayerId // Send persistent ID for reconnection
            }
        });
    }
    
    // Join existing lobby
    async joinLobby(code, playerName, playerClass) {
        if (!this.connected) {
            await this.connect();
        }
        
        const currency = this.getCurrency();
        const upgrades = this.getAllUpgrades();
        const safeRoomMeta = (typeof SaveSystem !== 'undefined' && SaveSystem.getSafeRoomUpgradeBlob)
            ? SaveSystem.getSafeRoomUpgradeBlob()
            : {};
        
        // Ensure persistent ID is set
        if (!this.persistentPlayerId) {
            this.persistentPlayerId = this.getOrCreatePersistentPlayerId();
        }
        
        const joinPayload = {
                code: code.toUpperCase(),
                playerName: playerName || 'Player',
                playerClass: playerClass || Game.selectedClass || 'square',
                currency: currency,
                upgrades: upgrades,
                safeRoomMeta: safeRoomMeta,
                persistentPlayerId: this.persistentPlayerId // Send persistent ID for reconnection
            };
        // Kept for hop-limited owner redirects (directory model).
        this._pendingJoinPayload = joinPayload;
        this._redirectHops = 0;

        this.send({
            type: 'join_lobby',
            data: joinPayload
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
    startGame(modeId = 'roguelike') {
        if (!this.isHost) {
            console.warn('[Multiplayer] Only host can start game');
            return;
        }
        
        this.send({
            type: 'game_start',
            data: {
                roomNumber: 1,
                timestamp: Date.now(),
                modeId: modeId,
                runSeed: Game.runSeed
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
        const payload = this.buildGameStatePayload(state, now);
        if (!payload) {
            return;
        }
        
        // Increment sequence number for this game_state (wraps at 32-bit max)
        this.gameStateSequence = (this.gameStateSequence + 1) & 0xFFFFFFFF;
        payload.sequence = this.gameStateSequence;
        
        this.send({
            type: 'game_state',
            data: payload
        });
    }
    
    // Broadcast host status (paused / tab hidden)
    sendHostStatus() {
        const wsOpen = this.ws && (this.ws.readyState === 1 || (typeof WebSocket !== 'undefined' && this.ws.readyState === WebSocket.OPEN));
        if (!this.isHost || !this.connected || !wsOpen) return;
        const isHidden = typeof document !== 'undefined' ? document.hidden : false;
        const isPaused = typeof Game !== 'undefined' ? (Game.showPauseMenu || Game.state === 'PAUSED' || !!window.multiplayerMenuVisible) : false;
        this.send({
            type: 'host_status',
            data: {
                isPaused,
                isHidden,
                timestamp: Date.now()
            }
        });
    }

    handleHostStatus(data) {
        if (!data || this.isHost) return;
        this.hostIsPaused = !!data.isPaused;
        this.hostIsHidden = !!data.isHidden;
    }

    isHostStalledOrPaused() {
        if (this.isHost || !this.lobbyCode || !this.connected) return false;
        if (this.hostIsPaused || this.hostIsHidden) return true;
        const now = Date.now();
        if (this.lastGameStateReceivedAt > 0 && (now - this.lastGameStateReceivedAt > 600)) {
            return true;
        }
        return false;
    }
    
    // Send player state (clients only)
    sendPlayerState() {
        if (this.isHost || !Game.player) return;
        
        const state = this.serializePlayerState();
        if (!state) {
            return;
        }
        
        const now = Date.now();
        if (this.playerStateBuffer.length > 0 && now - this.lastPlayerBatchFlush >= this.playerStateBatchInterval) {
            this.flushPlayerStateBuffer();
        }
        
        const delta = this.buildPlayerStateDelta(state);
        if (!delta) {
            return;
        }
        
        this.playerStateBuffer.push(delta);
        const immediateFlush = delta.inputChanged || delta.immediateFlush;
        
        const shouldFlush = immediateFlush ||
            now - this.lastPlayerBatchFlush >= this.playerStateBatchInterval ||
            this.playerStateBuffer.length >= 4;
        
        if (shouldFlush) {
            this.flushPlayerStateBuffer();
        }
    }
    
    buildPlayerStateDelta(state) {
        const prev = this.lastPlayerStateSnapshot;
        const now = Date.now();
        // Prefer seq from prediction frame this tick; otherwise allocate for send-only paths
        const seq = (this.lastSentInputSeq && this.lastSentInputSeq >= this.playerStateSeq)
            ? this.lastSentInputSeq
            : ++this.playerStateSeq;
        this.playerStateSeq = Math.max(this.playerStateSeq, seq);
        this.lastSentInputSeq = seq;
        const delta = {
            sequence: seq,
            inputSeq: seq,
            id: state.id,
            clientTimestamp: state.clientTimestamp
        };
        
        const transformChanged = !prev ||
            Math.abs(prev.x - state.x) > 0.1 ||
            Math.abs(prev.y - state.y) > 0.1 ||
            Math.abs((prev.rotation || 0) - (state.rotation || 0)) > 0.01;
        
        const lastTransformSent = this.playerLastUpdateTimes.get('transform') || 0;
        const transformTimedOut = now - lastTransformSent > 200;
        
        if (transformChanged || transformTimedOut) {
            delta.transform = {
                x: state.x,
                y: state.y,
                rotation: state.rotation
            };
            this.playerLastUpdateTimes.set('transform', now);
        }
        
        const inputChanged = !prev || !this.inputsEqual(prev.input, state.input);
        if (!prev || inputChanged) {
            delta.input = state.input;
            if (delta.input && typeof delta.input === 'object') {
                delta.input.inputSeq = delta.inputSeq;
            }
            this.lastSentInputSeq = delta.inputSeq;
        }
        
        const classChanged = !prev || prev.class !== state.class;
        if (classChanged) {
            delta.class = state.class;
        }
        
        const currencyChanged = !prev || prev.currency !== state.currency;
        if (currencyChanged) {
            delta.currency = state.currency;
        }
        
        const upgradesChanged = !prev || !this.valuesEqual(prev.upgrades, state.upgrades);
        if (upgradesChanged) {
            delta.upgrades = state.upgrades;
        }
        
        // Attach flags used internally for batching decisions
        delta.inputChanged = inputChanged;
        delta.immediateFlush = inputChanged || transformChanged;
        
        const hasPayload =
            delta.transform ||
            delta.input ||
            delta.class !== undefined ||
            delta.currency !== undefined ||
            delta.upgrades !== undefined;
        
        if (!hasPayload) {
            return null;
        }
        
        this.lastPlayerStateSnapshot = this.deepClone(state);
        return delta;
    }
    
    flushPlayerStateBuffer() {
        if (this.playerStateBuffer.length === 0) return;
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            this.playerStateBuffer.length = 0;
            return;
        }
        
        const frames = this.playerStateBuffer.map(frame => {
            const { inputChanged, immediateFlush, ...rest } = frame;
            if (rest.input) {
                rest.input = this.deepClone(rest.input);
            }
            if (rest.upgrades) {
                rest.upgrades = this.deepClone(rest.upgrades);
            }
            if (rest.transform) {
                rest.transform = { ...rest.transform };
            }
            return rest;
        });
        
        this.playerStateBuffer.length = 0;
        this.lastPlayerBatchFlush = Date.now();
        
        this.send({
            type: 'player_state_batch',
            data: {
                playerId: this.playerId,
                frames
            }
        });
    }
    
    // Serialize full game state (host)
    serializeGameState() {
        const state = {
            timestamp: Date.now(),
            gameState: Game.state || 'NEXUS', // Include current game state (NEXUS, PLAYING, etc.)
            roomNumber: Game.roomNumber || 1,
            doorOpen: (typeof currentRoom !== 'undefined' && currentRoom) ? currentRoom.doorOpen : false,
            roomType: (typeof currentRoom !== 'undefined' && currentRoom) ? currentRoom.type : 'normal',
            roomLayout: ((Game.state === 'PLAYING' || Game.state === 'ENTERING_ROOM') && typeof currentRoom !== 'undefined' && currentRoom && currentRoom.layout && typeof RoomLayoutGenerator !== 'undefined')
                ? RoomLayoutGenerator.serializeLayout(currentRoom.layout)
                : null,
            
            // Door waiting state (for multiplayer UI)
            playersOnDoor: Game.playersOnDoor || [],
            totalAlivePlayers: Game.totalAlivePlayers || 0,
            
            // Death state synchronization
            allPlayersDead: Game.allPlayersDead || false,
            deadPlayers: Array.from(Game.deadPlayers || []),
            
            // Player stats synchronization (for death screen)
            playerStats: this.serializePlayerStats(),
            
            // Serialize all players
            players: this.serializeAllPlayers(),
            
            // Serialize enemies (only if in PLAYING state)
            // Let each enemy serialize itself! (clean architecture)
            enemies: (Game.state === 'PLAYING') ? Game.enemies.map(enemy => 
                enemy.serialize ? enemy.serialize() : {}
            ) : [],
            
            // Serialize projectiles (only if in PLAYING state)
            // Ensure stable IDs on the live objects so clients can match across snapshots
            projectiles: (Game.state === 'PLAYING')
                ? Game.projectiles.map(proj => serializeProjectileForNetwork(proj))
                : [],

            // Fractal/endless biome echo hitboxes (display sync; host owns damage)
            biomeEchoes: (Game.state === 'PLAYING' && typeof BiomeEnemyMods !== 'undefined'
                && typeof BiomeEnemyMods.serializeEchoes === 'function')
                ? BiomeEnemyMods.serializeEchoes()
                : [],
            
            // Serialize ground loot (only if in PLAYING state)
            groundLoot: (Game.state === 'PLAYING' && typeof groundLoot !== 'undefined')
                ? groundLoot.map(gear => this.serializeGearForNetwork(gear))
                : [],
            
            // Serialize item pylons (only if in PLAYING state and multiplayer)
            // Each player gets a random item of the pylon's rarity
            itemPylons: (Game.state === 'PLAYING' && Game.itemPylons && Array.isArray(Game.itemPylons))
                ? Game.itemPylons.map(pylon => serializeItemPylonForNetwork(pylon))
                : [],

            // Surge Arena specific state serialization
            playerCombos: (Game.state === 'PLAYING' && Game.activeSessionId === 'surge-arena') ? Game.playerCombos : null,
            styleCrashPickups: (Game.state === 'PLAYING' && Game.activeSessionId === 'surge-arena') ? Game.styleCrashPickups : null,
            styleHealOrbs: (Game.state === 'PLAYING' && Game.activeSessionId === 'surge-arena') ? Game.styleHealOrbs : null
        };
        
        return this.roundDeep(state, 2);
    }
    
    buildGameStatePayload(state, now) {
        const baseline = this.lastSentGameState;
        this.latestGameState = this.deepClone(state);
        
        const needsFull = this.forceFullState || !baseline || (now - this.lastFullGameStateSentAt >= this.gameStateFullInterval);
        
        if (needsFull) {
            this.forceFullState = false;
            const fullState = this.deepClone(state);
            this.lastFullGameStateSentAt = now;
            this.lastProjectileBroadcast = now;
            this.lastProjectileSnapshot = this.deepClone(fullState.projectiles || []);
            this.lastSentGameState = this.deepClone(fullState);
            return {
                full: true,
                state: fullState
            };
        }
        
        const payload = {
            full: false,
            timestamp: state.timestamp
        };
        
        let hasChanges = false;
        const meta = {};
        
        // Players
        const playerDiff = this.diffById(state.players, baseline.players || [], 'id', { numericTolerance: 0.05 });
        if (playerDiff.changed.length) {
            payload.players = playerDiff.changed;
            hasChanges = true;
        }
        if (playerDiff.removed.length) {
            payload.removedPlayers = playerDiff.removed;
            hasChanges = true;
        }
        
        // Enemies - use tighter tolerance for position accuracy (0.1px)
        const enemyDiff = this.diffById(state.enemies, baseline.enemies || [], 'id', { 
            numericTolerance: 0.1,
            ignoreKeys: [] // Don't ignore any keys - ensure all state changes are detected
        });
        if (enemyDiff.changed.length) {
            payload.enemies = enemyDiff.changed;
            hasChanges = true;
        }
        if (enemyDiff.removed.length) {
            payload.removedEnemies = enemyDiff.removed;
            hasChanges = true;
        }
        
        // Ground loot
        const lootDiff = this.diffById(state.groundLoot, baseline.groundLoot || [], 'id', { numericTolerance: 0.1 });
        if (lootDiff.changed.length) {
            payload.groundLoot = lootDiff.changed;
            hasChanges = true;
        }
        if (lootDiff.removed.length) {
            payload.removedGroundLoot = lootDiff.removed;
            hasChanges = true;
        }
        
        // Item pylons
        const pylonDiff = this.diffById(state.itemPylons || [], baseline.itemPylons || [], 'id', { numericTolerance: 0.1 });
        if (pylonDiff.changed.length) {
            payload.itemPylons = pylonDiff.changed;
            hasChanges = true;
        }
        if (pylonDiff.removed.length) {
            payload.removedItemPylons = pylonDiff.removed;
            hasChanges = true;
        }
        
        // Projectiles (throttled full updates)
        const shouldSendProjectiles = !this.lastProjectileSnapshot ||
            now - this.lastProjectileBroadcast >= this.projectileBroadcastInterval;
        if (shouldSendProjectiles && !this.valuesEqual(state.projectiles, this.lastProjectileSnapshot, 0.1)) {
            payload.projectiles = state.projectiles;
            payload.projectilesFull = true;
            hasChanges = true;
            this.lastProjectileBroadcast = now;
            this.lastProjectileSnapshot = this.deepClone(state.projectiles || []);
        }

        // Biome echoes (full replace when changed; short-lived VFX)
        if (!this.valuesEqual(state.biomeEchoes, baseline.biomeEchoes, 0.1)) {
            payload.biomeEchoes = state.biomeEchoes || [];
            hasChanges = true;
        }
        
        // Player stats (send only when changed)
        if (!this.valuesEqual(state.playerStats, baseline.playerStats)) {
            payload.playerStats = state.playerStats;
            hasChanges = true;
        }
        
        if (state.roomNumber !== baseline.roomNumber) meta.roomNumber = state.roomNumber;
        if (state.gameState !== baseline.gameState) meta.gameState = state.gameState;
        if (state.doorOpen !== baseline.doorOpen) meta.doorOpen = state.doorOpen;
        if (state.roomType !== baseline.roomType) meta.roomType = state.roomType;
        if ((state.roomLayout && state.roomLayout.hash) !== (baseline.roomLayout && baseline.roomLayout.hash)) meta.roomLayout = state.roomLayout;
        if (!this.valuesEqual(state.playersOnDoor, baseline.playersOnDoor)) meta.playersOnDoor = state.playersOnDoor;
        if (state.totalAlivePlayers !== baseline.totalAlivePlayers) meta.totalAlivePlayers = state.totalAlivePlayers;
        if (state.allPlayersDead !== baseline.allPlayersDead) meta.allPlayersDead = state.allPlayersDead;
        if (!this.valuesEqual(state.deadPlayers, baseline.deadPlayers)) meta.deadPlayers = state.deadPlayers;
        if (Object.keys(meta).length) {
            payload.meta = meta;
            hasChanges = true;
        }
        
        if (!hasChanges) {
            return null;
        }
        
        this.lastSentGameState = this.deepClone(state);
        return payload;
    }
    
    roundNumber(value, decimals = 2) {
        if (typeof value !== 'number' || !Number.isFinite(value)) return value;
        const factor = Math.pow(10, decimals);
        return Math.round(value * factor) / factor;
    }
    
    roundDeep(value, decimals = 2, seen = new WeakSet()) {
        if (value && typeof value === 'object') {
            if (seen.has(value)) {
                return value;
            }
            seen.add(value);
        }
        if (Array.isArray(value)) {
            return value.map(item => this.roundDeep(item, decimals, seen));
        }
        if (value && typeof value === 'object') {
            const clone = {};
            Object.keys(value).forEach(key => {
                const child = value[key];
                if (typeof child === 'number') {
                    clone[key] = this.roundNumber(child, decimals);
                } else {
                    clone[key] = this.roundDeep(child, decimals, seen);
                }
            });
            return clone;
        }
        if (typeof value === 'number') {
            return this.roundNumber(value, decimals);
        }
        return value;
    }
    
    diffById(currentList = [], previousList = [], key = 'id', options = {}) {
        const opts = Object.assign({
            criticalFields: ['hp', 'maxHp', 'alive', 'state', 'phase', 'attacking']
        }, options || {});
        return Engine.Net.diffById(currentList, previousList, key, opts);
    }
    
    computeObjectDiff(current, previous, options = {}, keyName) {
        const opts = Object.assign({
            criticalFields: ['hp', 'maxHp', 'alive', 'state', 'phase', 'attacking']
        }, options || {});
        return Engine.Net.computeObjectDiff(current, previous, opts, keyName);
    }
    
    deepClone(value, seen = new WeakMap()) {
        return Engine.Net.deepClone(value, seen);
    }
    
    valuesEqual(a, b, tolerance = 0) {
        return Engine.Net.valuesEqual(a, b, tolerance);
    }
    
    inputsEqual(a, b) {
        return this.valuesEqual(a, b);
    }
    
    // Serialize player stats for all players (host only)
    serializePlayerStats() {
        if (typeof Game === 'undefined' || !Game.playerStats) return {};
        
        const statsObject = {};
        Game.playerStats.forEach((stats, playerId) => {
            statsObject[playerId] = {
                damageDealt: stats.damageDealt,
                kills: stats.kills,
                damageTaken: stats.damageTaken,
                roomsCleared: stats.roomsCleared,
                timeAlive: stats.getTimeAlive() // Get current time alive
            };
        });
        
        return statsObject;
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
        
        // Determine class - locked for runs; Nexus may use selectedClass for local
        let playerClass = this.resolvePlayerClass(playerId, player.playerClass);
        if (!this.isRunClassLocked() && typeof Game !== 'undefined' && Game.state === 'NEXUS') {
            if (playerId === this.playerId) {
                playerClass = Game.selectedClass || player.playerClass || playerClass;
            }
        }
        
        // Get currency and upgrades from host tracking
        let currency = null;
        let upgrades = null;
        if (typeof Game !== 'undefined' && this.isHost) {
            currency = Game.playerCurrencies.get(playerId);
            upgrades = Game.playerUpgrades.get(playerId);
        }
        
        return {
            id: playerId,
            name: 'Player', // TODO: Add player name selection
            currency: currency,
            upgrades: upgrades,
            ...playerState, // All player state from player.serialize()
            // Class is authoritative / run-locked - always win over serialize() fields
            class: playerClass,
            playerClass: playerClass,
            lastProcessedInputSeq: player.lastProcessedInputSeq != null
                ? player.lastProcessedInputSeq
                : (playerState.lastProcessedInputSeq != null ? playerState.lastProcessedInputSeq : null)
        };
    }
    
    // Serialize local player state (clients send inputs to host)
    serializePlayerState() {
        if (!Game.player) return null;
        
        const clientTimestamp = Date.now();
        
        // Use cached input snapshot if available (preserves justPressed/justReleased flags)
        // Otherwise serialize fresh input (for initial states)
        const inputState = this.cachedInputSnapshot || this.serializeInput();
        if (typeof Game !== 'undefined' && Game.pendingDoorReadyToggle) {
            inputState.doorInteractJustPressed = true;
            Game.pendingDoorReadyToggle = false;
        }
        
        // Store input history for rollback (client-side prediction) - also recorded in predict loop with dt
        // Serialize still tags seq for host ack; history with dt is owned by recordPredictionFrame()
        
        // Debug: Log when sending button releases for abilities
        if (inputState.isTouchMode && inputState.touchButtons) {
            for (const [name, button] of Object.entries(inputState.touchButtons)) {
                if (button.justReleased) {
                    console.log(`[Client] Sending ${name} justReleased to host, finalJoystickState:`, button.finalJoystickState);
                }
            }
        }
        
        // Include currency and upgrades for sync
        const currency = typeof SaveSystem !== 'undefined' ? Math.floor(SaveSystem.getCurrency()) : Math.floor(Game.currentCurrency || 0);
        const upgrades = this.getAllUpgrades();
        const safeRoomMeta = (typeof SaveSystem !== 'undefined' && SaveSystem.getSafeRoomUpgradeBlob)
            ? SaveSystem.getSafeRoomUpgradeBlob()
            : {};
        
        return {
            id: this.playerId,
            // Position (for validation/interpolation)
            x: Game.player.x,
            y: Game.player.y,
            rotation: Game.player.rotation,
            
            // Current class (locked for runs; otherwise selected / local)
            class: this.resolvePlayerClass(this.playerId, Game.selectedClass || Game.player.playerClass),
            playerClass: this.resolvePlayerClass(this.playerId, Game.selectedClass || Game.player.playerClass),
            
            // Currency and upgrades (for host tracking)
            currency: currency,
            upgrades: upgrades,
            safeRoomMeta: safeRoomMeta,
            
            // Client timestamp for RTT calculation
            clientTimestamp: clientTimestamp,
            
            // INPUT STATE - This is what host needs to simulate the player
            input: inputState
        };
    }
    
    // Serialize current input state
    serializeInput() {
        if ((typeof Engine === 'undefined' || !Engine.Input)) {
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
        if (Engine.Input.touchJoysticks) {
            for (const [name, joystick] of Object.entries(Engine.Input.touchJoysticks)) {
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
        if (Engine.Input.touchButtons) {
            for (const [name, button] of Object.entries(Engine.Input.touchButtons)) {
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
        const isTouchMode = Engine.Input.isTouchMode ? Engine.Input.isTouchMode() : false;
        
        // Debug: Log touch mode state (only once per second to avoid spam)
        if (!this._lastTouchModeLog || Date.now() - this._lastTouchModeLog > 1000) {
            if (isTouchMode) {
                console.log(`[Client] Serializing input - isTouchMode: ${isTouchMode}`);
            }
            this._lastTouchModeLog = Date.now();
        }

        // Suppress inputs when pause menu or UI modals are visible
        if (typeof Game !== 'undefined' && (Game.showPauseMenu || Game.state === 'PAUSED' || !!window.multiplayerMenuVisible)) {
            return {
                up: false,
                down: false,
                left: false,
                right: false,
                mouse: Engine.Input.getWorldMousePos ? Engine.Input.getWorldMousePos() : { x: 0, y: 0 },
                mouseLeft: false,
                mouseRight: false,
                space: false,
                shift: false,
                isTouchMode: isTouchMode,
                touchJoysticks: {},
                touchButtons: {},
                keys: {}
            };
        }
        
        return {
            // Movement keys
            up: Engine.Input.getKeyState('w'),
            down: Engine.Input.getKeyState('s'),
            left: Engine.Input.getKeyState('a'),
            right: Engine.Input.getKeyState('d'),
            
            // Mouse/aim - send WORLD coordinates (accounting for camera)
            mouse: Engine.Input.getWorldMousePos ? Engine.Input.getWorldMousePos() : { x: 0, y: 0 },
            mouseLeft: Engine.Input.mouseLeft || false,
            mouseRight: Engine.Input.mouseRight || false,
            
            // Abilities
            space: Engine.Input.getKeyState(' '),
            shift: Engine.Input.getKeyState('shift'),
            
            // Touch controls (if applicable)
            isTouchMode: isTouchMode,
            touchJoysticks: serializedJoysticks,
            touchButtons: serializedButtons,
            
            // All keys (for any special bindings)
            keys: Engine.Input.keys || {}
        };
    }
    
    // Handle lobby created
    handleLobbyCreated(data) {
        this.lobbyCode = data.code;
        this.playerId = data.playerId;
        this.isHost = data.isHost;
        this.predictionEnabled = false; // Host is authoritative; no self-prediction
        this.players = data.players;
        this.updateRemotePlayers();
        
        // Enable multiplayer mode in the game
        if (typeof Game !== 'undefined') {
            Game.multiplayerEnabled = true;
        }
        
        // Force roguelike mode in multiplayer (multiplayer only supports roguelike mode)
        if (typeof nexusRoom !== 'undefined' && nexusRoom) {
            nexusRoom.portalMode = 'roguelike';
            console.log('[Multiplayer] Switched to roguelike mode (required for multiplayer)');
        }
        
        // Set game mode to gear (multiplayer only supports gear mode)
        if (typeof Game !== 'undefined') {
            Game.gameMode = 'gear';
            Game.selectedModeId = 'roguelike';
            console.log('[Multiplayer] Set game mode to gear (required for multiplayer)');
        }
        
        console.log(`[Multiplayer] Lobby created: ${this.lobbyCode}`);
        if (typeof window !== 'undefined' && window.UIBus && UIBus.emit) {
            UIBus.emit('mp:lobby:created', { code: this.lobbyCode, isHost: !!this.isHost, players: (this.players || []).slice() });
        }

        if (typeof Onboarding !== 'undefined' && Onboarding.suspendForMultiplayer) {
            Onboarding.suspendForMultiplayer();
        }
        
        // Initialize host-side currency and upgrade tracking
        if (typeof Game !== 'undefined' && this.isHost && data.players) {
            data.players.forEach(player => {
                // Initialize currency tracking
                if (player.currency !== undefined) {
                    Game.playerCurrencies.set(player.id, player.currency);
                }
                // Initialize upgrade tracking
                if (player.upgrades) {
                    Game.playerUpgrades.set(player.id, player.upgrades);
                }
                if (player.safeRoomMeta) {
                    if (!Game.playerSafeRoomMeta) Game.playerSafeRoomMeta = new Map();
                    Game.playerSafeRoomMeta.set(player.id, player.safeRoomMeta);
                }
            });
        }
        
        // Sync currency on client side (host sends authoritative value)
        if (typeof Game !== 'undefined' && data.players) {
            const localPlayer = data.players.find(p => p.id === this.playerId);
            if (localPlayer && localPlayer.currency !== undefined) {
                // Update local currency to match host's authoritative value
                if (typeof SaveSystem !== 'undefined') {
                    const currentLocalCurrency = SaveSystem.getCurrency();
                    const flooredCurrency = Math.floor(localPlayer.currency);
                    if (currentLocalCurrency !== flooredCurrency) {
                        SaveSystem.setCurrency(flooredCurrency);
                        Game.currentCurrency = flooredCurrency;
                        console.log(`[Multiplayer] Synced currency: ${flooredCurrency}`);
                    }
                }
            }
        }
        
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
        this.predictionEnabled = this.isHost
            ? false
            : ((typeof MultiplayerConfig !== 'undefined') ? MultiplayerConfig.PREDICTION_ENABLED !== false : true);
        this.players = data.players;
        this.updateRemotePlayers();
        
        // Enable multiplayer mode in the game
        if (typeof Game !== 'undefined') {
            Game.multiplayerEnabled = true;
        }
        
        // Force roguelike mode in multiplayer (multiplayer only supports roguelike mode)
        if (typeof nexusRoom !== 'undefined' && nexusRoom) {
            nexusRoom.portalMode = 'roguelike';
            console.log('[Multiplayer] Switched to roguelike mode (required for multiplayer)');
        }
        
        // Set game mode to gear (multiplayer only supports gear mode)
        if (typeof Game !== 'undefined') {
            Game.gameMode = 'gear';
            Game.selectedModeId = 'roguelike';
            console.log('[Multiplayer] Set game mode to gear (required for multiplayer)');
        }
        
        // If this is a reconnection, log it
        if (data.isReconnection) {
            console.log(`[Multiplayer] Reconnected to lobby ${this.lobbyCode} with player ID ${this.playerId}`);
        } else {
            console.log(`[Multiplayer] Joined lobby: ${this.lobbyCode}`);
        }
        if (typeof window !== 'undefined' && window.UIBus && UIBus.emit) {
            UIBus.emit('mp:lobby:joined', { code: this.lobbyCode, isHost: !!this.isHost, players: (this.players || []).slice() });
        }

        if (typeof Onboarding !== 'undefined' && Onboarding.suspendForMultiplayer) {
            Onboarding.suspendForMultiplayer();
        }
        
        // Initialize host-side currency and upgrade tracking
        if (typeof Game !== 'undefined' && this.isHost && data.players) {
            data.players.forEach(player => {
                // Initialize currency tracking
                if (player.currency !== undefined) {
                    Game.playerCurrencies.set(player.id, player.currency);
                }
                // Initialize upgrade tracking
                if (player.upgrades) {
                    Game.playerUpgrades.set(player.id, player.upgrades);
                }
                if (player.safeRoomMeta) {
                    if (!Game.playerSafeRoomMeta) Game.playerSafeRoomMeta = new Map();
                    Game.playerSafeRoomMeta.set(player.id, player.safeRoomMeta);
                }
            });
        }
        
        // Sync currency on client side (host sends authoritative value)
        if (typeof Game !== 'undefined' && data.players) {
            const localPlayer = data.players.find(p => p.id === this.playerId);
            if (localPlayer && localPlayer.currency !== undefined) {
                // Update local currency to match host's authoritative value
                if (typeof SaveSystem !== 'undefined') {
                    const currentLocalCurrency = SaveSystem.getCurrency();
                    const flooredCurrency = Math.floor(localPlayer.currency);
                    if (currentLocalCurrency !== flooredCurrency) {
                        SaveSystem.setCurrency(flooredCurrency);
                        Game.currentCurrency = flooredCurrency;
                        console.log(`[Multiplayer] Synced currency: ${flooredCurrency}`);
                    }
                }
            }
        }
        
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
        if (typeof window !== 'undefined' && window.UIBus && UIBus.emit) {
            UIBus.emit('mp:lobby:error', { message: data.message || 'Unknown error' });
        }
        
        // Notify game
        if (typeof onLobbyError === 'function') {
            onLobbyError(data);
        }
    }
    
    // Handle being kicked from lobby
    handleKickedFromLobby(data) {
        console.log('[Multiplayer] Kicked from lobby:', data.reason || 'Kicked by host');
        
        // Clean up connection
        this.cleanup();
        
        // Notify UI
        if (typeof window !== 'undefined' && window.UIBus && UIBus.emit) {
            UIBus.emit('mp:lobby:error', { message: 'Kicked from lobby' });
        }
        
        // Show toast notification
        if (typeof window !== 'undefined' && window.showToast) {
            window.showToast('Kicked from Lobby', 3000);
        }
        
        // Notify game
        if (typeof onLobbyError === 'function') {
            onLobbyError({ message: 'Kicked from lobby' });
        }
    }
    
    // Handle player joined
    handlePlayerJoined(data) {
        this.players = data.players;
        this.updateRemotePlayers();
        
        console.log(`[Multiplayer] Player joined: ${data.player.name}`);
        
        // Initialize host-side currency and upgrade tracking for new player
        if (typeof Game !== 'undefined' && this.isHost && data.player) {
            // Initialize currency tracking
            if (data.player.currency !== undefined) {
                Game.playerCurrencies.set(data.player.id, data.player.currency);
            }
            // Initialize upgrade tracking
            if (data.player.upgrades) {
                Game.playerUpgrades.set(data.player.id, data.player.upgrades);
            }
            if (data.player.safeRoomMeta) {
                if (!Game.playerSafeRoomMeta) Game.playerSafeRoomMeta = new Map();
                Game.playerSafeRoomMeta.set(data.player.id, data.player.safeRoomMeta);
            }
        }
        
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
    
    // Handle player list update (for reconnections)
    handlePlayerListUpdate(data) {
        if (!data.players) return;

        const prevDisconnected = new Set();
        (this.players || []).forEach(p => {
            if (p && p.disconnected) prevDisconnected.add(p.id);
        });
        
        // Update players list
        this.players = data.players;
        this.updateRemotePlayers();
        
        console.log('[Multiplayer] Player list updated:', this.players.map(p => `${p.name} (${p.id})${p.disconnected ? ' [offline]' : ''}`));
        if (typeof window !== 'undefined' && window.UIBus && UIBus.emit) {
            UIBus.emit('mp:lobby:players', { players: (this.players || []).slice() });
            UIBus.emit('mp:player_list_update', { players: (this.players || []).slice() });
        }
        
        if (typeof Game !== 'undefined') {
            Game.remotePlayers = this.remotePlayers;
        }

        if (this.isHost && typeof Game !== 'undefined' && Game.state === 'PLAYING') {
            data.players.forEach(p => {
                if (!p || p.id === this.playerId) return;
                if (prevDisconnected.has(p.id) && !p.disconnected && typeof Game.handlePlayerReconnectedMidRun === 'function') {
                    Game.handlePlayerReconnectedMidRun(p.id);
                }
            });
        }
    }
    
    // Handle player left
    handlePlayerLeft(data) {
        this.players = data.players;
        this.updateRemotePlayers();
        
        console.log(`[Multiplayer] Player left`);
        if (typeof window !== 'undefined' && window.UIBus && UIBus.emit) {
            UIBus.emit('mp:lobby:players', { players: (this.players || []).slice() });
        }

        if (data && data.playerId && typeof Game !== 'undefined' && typeof Game.handlePlayerRemovedFromLobby === 'function') {
            Game.handlePlayerRemovedFromLobby(data.playerId);
        }
        
        // Notify game
        if (typeof onPlayerLeft === 'function') {
            onPlayerLeft(data);
        }
    }
    
    // Handle host migration
    handleHostMigrated(data) {
        const wasHost = this.isHost;
        this.isHost = data.newHostId === this.playerId;
        
        console.log(`[Multiplayer] Host migrated. Am I host? ${this.isHost} (new host: ${data.newHostId})${data.provisional ? ' (provisional)' : ''}`);

        // Sequence space resets when a new host starts sending game_state
        this.expectedSequence = null;
        this.sequenceBuffer.clear();
        this.lastSentGameState = null;
        this.packetLossCount = 0;

        if (this.isHost) {
            // Promoted: stop predicting self; clear history
            this.resetPredictionState({ clearHistory: true, reenableIfClient: false });
            this.predictionEnabled = false;
            this.forceFullState = true;
            this.gameStateSequence = 0;
        } else if (wasHost && !this.isHost) {
            // Demoted: re-enable prediction after clearing host-side buffers
            this.resetPredictionState({ clearHistory: true, reenableIfClient: true });
            this.latestGameState = null;
        } else {
            // Stayed client under a new host: keep input history, clear confirm until new acks
            this.lastConfirmedState = null;
        }
        
        if (typeof Game !== 'undefined' && typeof Game.handleHostMigration === 'function') {
            Game.handleHostMigration({
                wasHost,
                isHost: this.isHost,
                newHostId: data.newHostId,
                previousHostId: data.previousHostId || null,
                provisional: !!data.provisional
            });
        }
        
        // Notify game UI
        if (typeof onHostMigrated === 'function') {
            onHostMigrated(data, wasHost, this.isHost);
        }
    }
    
    // Handle game state update from host
    handleGameState(data) {
        if (this.isHost) return; // Host doesn't need to receive their own state
        
        this.lastGameStateReceivedAt = Date.now();
        this.hostIsHidden = false;
        
        // Initialize interpolation manager if needed
        if (typeof initInterpolation !== 'undefined' && !interpolationManager) {
            interpolationManager = initInterpolation();
        }
        
        const now = Date.now();
        const sequence = data.sequence;
        
        // Track packet arrival time for jitter calculation
        if (sequence !== undefined) {
            this.packetArrivalTimes.push(now);
            if (this.packetArrivalTimes.length > this.maxPacketArrivalSamples) {
                this.packetArrivalTimes.shift();
            }
        }
        
        // Handle sequence tracking
        if (sequence !== undefined) {
            if (this.expectedSequence === null) {
                // First packet - initialize expected sequence
                this.expectedSequence = sequence + 1;
            } else {
                // Check for sequence gaps or out-of-order packets
                const sequenceDiff = this.sequenceDifference(sequence, this.expectedSequence - 1);
                
                if (sequenceDiff < 0) {
                    // Out-of-order packet (arrived late) - buffer it
                    if (this.sequenceBuffer.size < (MultiplayerConfig.SEQUENCE_BUFFER_SIZE || 10)) {
                        this.sequenceBuffer.set(sequence, { data, timestamp: now });
                    }
                    // Don't process out-of-order packets immediately
                    return;
                } else if (sequenceDiff > 0) {
                    // Gap detected - missing packets
                    const gapSize = sequenceDiff;
                    this.packetLossCount += gapSize;
                    
                    // Check if gap exceeds threshold
                    const maxGap = MultiplayerConfig.MAX_SEQUENCE_GAP || 3;
                    if (gapSize > maxGap && (now - this.lastResyncRequest) > (MultiplayerConfig.RESYNC_REQUEST_COOLDOWN || 1000)) {
                        console.warn(`[Multiplayer] Sequence gap detected: expected ${this.expectedSequence}, got ${sequence} (gap: ${gapSize}). Requesting resync.`);
                        this.requestResync();
                        this.lastResyncRequest = now;
                    }
                }
                
                // Update expected sequence
                this.expectedSequence = sequence + 1;
                
                // Process any buffered packets that are now in order
                this.processBufferedPackets();
            }
        }
        
        // Calculate RTT using server timestamps for accurate measurement
        let rtt = null;
        
        // Use server timestamps if available (more accurate)
        if (data.serverReceiveTime && data.serverSendTime) {
            // One-way latency: (client receive - server send) + (server send - server receive) / 2
            // Simplified: client receive - server receive gives us round-trip time
            // But we want one-way latency, so we use: (client receive - server send)
            const clientReceiveTime = now;
            const serverLatency = data.serverSendTime - data.serverReceiveTime;
            // RTT = time from server receive to client receive, minus server processing time
            rtt = (clientReceiveTime - data.serverReceiveTime) - serverLatency;
        } else if (data.serverSendTime) {
            // Fallback: use server send time if receive time not available
            rtt = now - data.serverSendTime;
        } else if (data.timestamp) {
            // Legacy: use host timestamp (less accurate)
            rtt = now - data.timestamp;
        }
        
        if (rtt !== null && rtt > 0 && rtt < 10000) { // Sanity check: 0-10 seconds
            // Update RTT samples
            this.rttSamples.push(rtt);
            if (this.rttSamples.length > this.maxRttSamples) {
                this.rttSamples.shift();
            }
            
            // Calculate average RTT
            const avgRtt = this.rttSamples.reduce((a, b) => a + b, 0) / this.rttSamples.length;
            this.currentRTT = avgRtt;
            
            // Update interpolation manager with latency and jitter
            if (typeof interpolationManager !== 'undefined' && interpolationManager) {
                interpolationManager.updateLatency(this.currentRTT);
                
                // Calculate and update jitter
                const metrics = this.getPacketMetrics();
                if (metrics.jitter !== undefined) {
                    interpolationManager.updateJitter(metrics.jitter);
                }
            }
        }
        
        // Apply game state
        if (!data) return;
        
        if (data.full === true || data.state) {
            const fullState = data.state || data;
            this.latestGameState = this.deepClone(fullState);
            // Reset sequence tracking on full state
            if (sequence !== undefined) {
                this.expectedSequence = sequence + 1;
                this.sequenceBuffer.clear();
            }
            // Reset prediction state on full sync
            this.lastConfirmedState = null;
            this.applyGameState(fullState);
            return;
        }
        
        if (!this.latestGameState) {
            console.warn('[Multiplayer] Received delta game_state without baseline');
            return;
        }
        
        const merged = this.mergeGameStateDelta(data);
        if (merged) {
            this.applyGameState(merged);
        }
    }
    
    // Calculate sequence difference handling wraparound (32-bit)
    sequenceDifference(seq1, seq2) {
        const diff = (seq1 - seq2) & 0xFFFFFFFF;
        // Convert to signed 32-bit integer
        if (diff > 0x7FFFFFFF) {
            return diff - 0x100000000;
        }
        return diff;
    }
    
    // Process buffered packets that are now in order
    processBufferedPackets() {
        const processed = [];
        const now = Date.now();
        
        // Find packets that are now in order
        for (const [seq, packet] of this.sequenceBuffer.entries()) {
            const diff = this.sequenceDifference(seq, this.expectedSequence - 1);
            if (diff === 0) {
                // This packet is now in order
                processed.push(seq);
                // Process it (recursive call, but with sequence already validated)
                const data = packet.data;
                
                // Update expected sequence
                this.expectedSequence = seq + 1;
                
                // Apply the buffered state
                if (data.full === true || data.state) {
                    const fullState = data.state || data;
                    this.latestGameState = this.deepClone(fullState);
                    this.applyGameState(fullState);
                } else if (this.latestGameState) {
                    const merged = this.mergeGameStateDelta(data);
                    if (merged) {
                        this.applyGameState(merged);
                    }
                }
            } else if (diff < 0) {
                // This packet is still out of order, but might be too old
                const age = now - packet.timestamp;
                if (age > 1000) {
                    // Packet is too old, discard it
                    processed.push(seq);
                }
            }
        }
        
        // Remove processed packets from buffer
        processed.forEach(seq => this.sequenceBuffer.delete(seq));
    }
    
    // Request resync from host (request full state)
    requestResync() {
        const now = Date.now();
        const cooldown = (typeof MultiplayerConfig !== 'undefined' && MultiplayerConfig.RESYNC_REQUEST_COOLDOWN)
            ? MultiplayerConfig.RESYNC_REQUEST_COOLDOWN
            : 1000;
        if (now - this.lastResyncRequest < cooldown) {
            return;
        }
        this.lastResyncRequest = now;

        console.log('[Multiplayer] Requesting resync from host');
        // Clear local sequence tracking so we re-baseline on the next full state
        this.latestGameState = null;
        this.expectedSequence = null;
        this.sequenceBuffer.clear();

        if (!this.isHost && this.connected) {
            this.send({
                type: 'resync_request',
                data: {
                    playerId: this.playerId,
                    timestamp: now
                }
            });
        }
    }

    // Host: client asked for a full game_state snapshot
    handleResyncRequest(data) {
        if (!this.isHost) return;
        console.log('[Multiplayer] Host received resync_request', data && data.playerId ? `from ${data.playerId}` : '');
        this.forceFullState = true;
        // Bypass throttle so the full state goes out ASAP
        this.lastStateUpdate = 0;
        this.sendGameState();
    }
    
    // Get packet loss and jitter metrics
    getPacketMetrics() {
        // Calculate packet loss rate (packets lost / total expected)
        const totalExpected = this.packetLossCount + (this.expectedSequence !== null ? this.expectedSequence : 0);
        const packetLossRate = totalExpected > 0 ? (this.packetLossCount / totalExpected) : 0;
        
        // Calculate jitter (variance in packet arrival times)
        let jitter = 0;
        if (this.packetArrivalTimes.length >= 2) {
            const intervals = [];
            for (let i = 1; i < this.packetArrivalTimes.length; i++) {
                intervals.push(this.packetArrivalTimes[i] - this.packetArrivalTimes[i - 1]);
            }
            
            if (intervals.length > 0) {
                const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
                const variance = intervals.reduce((sum, interval) => {
                    const diff = interval - avgInterval;
                    return sum + (diff * diff);
                }, 0) / intervals.length;
                jitter = Math.sqrt(variance); // Standard deviation
            }
        }
        
        return {
            packetLossCount: this.packetLossCount,
            packetLossRate: packetLossRate,
            jitter: jitter,
            currentRTT: this.currentRTT,
            expectedSequence: this.expectedSequence,
            bufferedPackets: this.sequenceBuffer.size
        };
    }
    
    // Handle prediction rollback when host correction arrives
    handlePredictionRollback(hostState) {
        this.reconcilePrediction(hostState);
    }

    /**
     * Record a predicted frame for later rewind/replay.
     * Owns the monotonic inputSeq shared with outbound player_state.
     */
    recordPredictionFrame(deltaTime, inputState) {
        if (!this.predictionEnabled || this.isHost || !Game.player) return null;
        const inputSeq = ++this.playerStateSeq;
        this.lastSentInputSeq = inputSeq;
        const clonedInput = this.deepClone(inputState || this.serializeInput());
        if (clonedInput) {
            clonedInput.inputSeq = inputSeq;
            // Strip edge-trigger flags so rewind/replay cannot re-fire dodges/abilities
            if (clonedInput.touchButtons) {
                for (const btn of Object.values(clonedInput.touchButtons)) {
                    if (btn && typeof btn === 'object') {
                        btn.justPressed = false;
                        btn.justReleased = false;
                    }
                }
            }
            if (clonedInput.keys) {
                for (const key of Object.values(clonedInput.keys)) {
                    if (key && typeof key === 'object') {
                        key.justPressed = false;
                        key.justReleased = false;
                    }
                }
            }
        }
        this.inputHistory.push({
            inputSeq,
            input: clonedInput,
            dt: deltaTime,
            timestamp: Date.now()
        });
        while (this.inputHistory.length > this.maxInputHistorySize) {
            this.inputHistory.shift();
        }
        return inputSeq;
    }

    /**
     * Reconcile local prediction against host-authoritative pose + lastProcessedInputSeq.
     * Small errors ignored; medium errors soft-blended + visual correction; large errors hard-snap.
     * Tracks divergence for debug, learns coherent drift bias, caps replay length.
     * Replay never starts new predicted dodges and does not apply drift bias.
     */
    reconcilePrediction(hostState) {
        if (!Game.player || !hostState) return;
        if (!this.predictionEnabled || this.isHost) return;

        const softDist = (typeof MultiplayerConfig !== 'undefined' && MultiplayerConfig.RECONCILE_SOFT_DISTANCE != null)
            ? MultiplayerConfig.RECONCILE_SOFT_DISTANCE
            : 5;
        const snapDist = (typeof MultiplayerConfig !== 'undefined' && MultiplayerConfig.RECONCILE_SNAP_DISTANCE != null)
            ? MultiplayerConfig.RECONCILE_SNAP_DISTANCE
            : 80;
        let blendFactor = (typeof MultiplayerConfig !== 'undefined' && MultiplayerConfig.RECONCILE_BLEND_FACTOR != null)
            ? MultiplayerConfig.RECONCILE_BLEND_FACTOR
            : 0.35;
        const divergenceThreshold = (typeof MultiplayerConfig !== 'undefined' && MultiplayerConfig.PREDICTION_DIVERGENCE_THRESHOLD != null)
            ? MultiplayerConfig.PREDICTION_DIVERGENCE_THRESHOLD
            : 8;
        const maxReplaySteps = (typeof MultiplayerConfig !== 'undefined' && MultiplayerConfig.PREDICTION_MAX_REPLAY_STEPS != null)
            ? MultiplayerConfig.PREDICTION_MAX_REPLAY_STEPS
            : 45;

        const authX = hostState.x;
        const authY = hostState.y;
        if (typeof authX !== 'number' || typeof authY !== 'number') return;

        // Align movement flags with host before measuring error / replaying
        if (typeof Game.player.syncPredictedMovementFromHost === 'function') {
            Game.player.syncPredictedMovementFromHost(hostState);
        }

        const lastProcessed = hostState.lastProcessedInputSeq;
        if (lastProcessed != null) {
            this.inputHistory = this.inputHistory.filter(entry => entry.inputSeq > lastProcessed);
        }
        if (this.inputHistory.length > maxReplaySteps) {
            this.inputHistory = this.inputHistory.slice(this.inputHistory.length - maxReplaySteps);
        }

        const preX = Game.player.x;
        const preY = Game.player.y;
        const visualX = preX + (Game.player._predictionCorrectionX || 0);
        const visualY = preY + (Game.player._predictionCorrectionY || 0);

        const dx = authX - preX;
        const dy = authY - preY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        const stats = this.predictionStats || this.createEmptyPredictionStats();
        this.predictionStats = stats;
        stats.reconciles++;

        // Tiny error and nothing to replay - leave predicted pose alone
        if (distance <= softDist && this.inputHistory.length === 0) {
            stats.softIgnores++;
            stats.lastMode = 'soft';
            stats.lastDivergencePx = distance;
            stats.lastReplaySteps = 0;
            this.updateDriftEstimator(dx, dy);
            this.lastConfirmedState = {
                inputSeq: lastProcessed != null ? lastProcessed : (this.lastConfirmedState && this.lastConfirmedState.inputSeq) || 0,
                x: authX,
                y: authY,
                rotation: hostState.rotation,
                vx: hostState.vx,
                vy: hostState.vy
            };
            return;
        }

        // When drift is coherent, blend a bit harder toward host (still soft - not a snap)
        if (stats.driftActive && this.driftCoherence > 0.55 && distance > softDist && distance <= snapDist) {
            blendFactor = Math.min(0.72, blendFactor + 0.18 * this.driftCoherence);
        }

        let baseX;
        let baseY;
        let mode = 'replay';
        if (distance > snapDist) {
            mode = 'hard';
            stats.hardSnaps++;
            baseX = authX;
            baseY = authY;
            if (hostState.vx !== undefined) Game.player.vx = hostState.vx;
            if (hostState.vy !== undefined) Game.player.vy = hostState.vy;
            if (hostState.rotation !== undefined) {
                Game.player.rotation = hostState.rotation;
            }
        } else if (distance > softDist) {
            mode = 'medium';
            stats.mediumBlends++;
            baseX = Game.player.x + dx * blendFactor;
            baseY = Game.player.y + dy * blendFactor;
            if (hostState.vx !== undefined) {
                Game.player.vx = Game.player.vx * (1 - blendFactor) + hostState.vx * blendFactor;
            }
            if (hostState.vy !== undefined) {
                Game.player.vy = Game.player.vy * (1 - blendFactor) + hostState.vy * blendFactor;
            }
        } else {
            mode = 'soft-replay';
            stats.softIgnores++;
            baseX = Game.player.x;
            baseY = Game.player.y;
        }

        Game.player.x = baseX;
        Game.player.y = baseY;
        Game.player.targetX = authX;
        Game.player.targetY = authY;
        if (hostState.rotation !== undefined) {
            Game.player.targetRotation = hostState.rotation;
        }

        // Replay unacked inputs: host moveSpeed, no new dodges, no forces, no drift bias
        const hostMoveSpeed = (typeof hostState.moveSpeed === 'number') ? hostState.moveSpeed : undefined;
        let replaySteps = 0;
        if (typeof Game.player.predictMovementStep === 'function' && typeof Game.createRemoteInputAdapter === 'function') {
            for (let i = 0; i < this.inputHistory.length; i++) {
                const entry = this.inputHistory[i];
                const adapter = Game.createRemoteInputAdapter(entry.input, Game.player);
                Game.player.predictMovementStep(entry.dt || (1 / 60), adapter, {
                    allowPredictedDodge: false,
                    applyForces: false,
                    applyAim: false,
                    applyDriftBias: false,
                    moveSpeedOverride: hostMoveSpeed
                });
                replaySteps++;
            }
        }

        // Post-replay divergence vs pre-reconcile pose (how far we actually moved the sim)
        const postDx = Game.player.x - preX;
        const postDy = Game.player.y - preY;
        const correctionPx = Math.sqrt(postDx * postDx + postDy * postDy);
        stats.lastDivergencePx = correctionPx;
        stats.lastReplaySteps = replaySteps;
        stats.lastMode = mode;
        stats.divergenceSum += correctionPx;
        stats.avgDivergencePx = stats.divergenceSum / Math.max(1, stats.reconciles);
        if (correctionPx > stats.maxDivergencePx) {
            stats.maxDivergencePx = correctionPx;
        }
        if (correctionPx > divergenceThreshold) {
            stats.significantDivergences++;
            if (typeof DebugFlags !== 'undefined' && DebugFlags.PREDICTION_DIVERGENCE) {
                console.log(
                    `[Prediction] divergence ${correctionPx.toFixed(1)}px mode=${mode} ` +
                    `replay=${replaySteps} bias=${Math.hypot(this.driftBiasX, this.driftBiasY).toFixed(1)}`
                );
            }
        }

        // Feed error pattern (auth - predicted) into drift estimator
        this.updateDriftEstimator(dx, dy);

        // Hide remaining visual discontinuity by decaying correction offset
        Game.player._predictionCorrectionX = visualX - Game.player.x;
        Game.player._predictionCorrectionY = visualY - Game.player.y;
        const maxCorr = snapDist;
        const corrMag = Math.sqrt(
            Game.player._predictionCorrectionX * Game.player._predictionCorrectionX +
            Game.player._predictionCorrectionY * Game.player._predictionCorrectionY
        );
        if (corrMag > maxCorr) {
            const s = maxCorr / corrMag;
            Game.player._predictionCorrectionX *= s;
            Game.player._predictionCorrectionY *= s;
        }

        this.lastConfirmedState = {
            inputSeq: lastProcessed != null ? lastProcessed : 0,
            x: Game.player.x,
            y: Game.player.y,
            rotation: Game.player.rotation,
            vx: Game.player.vx,
            vy: Game.player.vy
        };
    }

    /**
     * Detect coherent directional reconcile error and maintain a gentle drift bias
     * for live prediction self-correction.
     */
    updateDriftEstimator(errorDx, errorDy) {
        const windowSize = (typeof MultiplayerConfig !== 'undefined' && MultiplayerConfig.PREDICTION_DRIFT_WINDOW != null)
            ? MultiplayerConfig.PREDICTION_DRIFT_WINDOW
            : 12;
        const coherenceMin = (typeof MultiplayerConfig !== 'undefined' && MultiplayerConfig.PREDICTION_DRIFT_COHERENCE != null)
            ? MultiplayerConfig.PREDICTION_DRIFT_COHERENCE
            : 0.62;
        const minMean = (typeof MultiplayerConfig !== 'undefined' && MultiplayerConfig.PREDICTION_DRIFT_MIN_MEAN != null)
            ? MultiplayerConfig.PREDICTION_DRIFT_MIN_MEAN
            : 4;
        const strength = (typeof MultiplayerConfig !== 'undefined' && MultiplayerConfig.PREDICTION_DRIFT_STRENGTH != null)
            ? MultiplayerConfig.PREDICTION_DRIFT_STRENGTH
            : 0.45;
        const maxBias = (typeof MultiplayerConfig !== 'undefined' && MultiplayerConfig.PREDICTION_DRIFT_MAX != null)
            ? MultiplayerConfig.PREDICTION_DRIFT_MAX
            : 28;
        const decay = (typeof MultiplayerConfig !== 'undefined' && MultiplayerConfig.PREDICTION_DRIFT_DECAY != null)
            ? MultiplayerConfig.PREDICTION_DRIFT_DECAY
            : 0.92;

        const mag = Math.sqrt(errorDx * errorDx + errorDy * errorDy);
        if (!this.driftSamples) this.driftSamples = [];
        this.driftSamples.push({ dx: errorDx, dy: errorDy, mag });
        while (this.driftSamples.length > windowSize) {
            this.driftSamples.shift();
        }

        let coherence = 0;
        if (this.driftSamples.length >= 3) {
            let sumX = 0;
            let sumY = 0;
            let sumMag = 0;
            for (let i = 0; i < this.driftSamples.length; i++) {
                sumX += this.driftSamples[i].dx;
                sumY += this.driftSamples[i].dy;
                sumMag += this.driftSamples[i].mag;
            }
            const n = this.driftSamples.length;
            const meanX = sumX / n;
            const meanY = sumY / n;
            const meanMag = Math.sqrt(meanX * meanX + meanY * meanY);
            const avgMag = sumMag / n;
            coherence = meanMag / (avgMag + 1e-6);
            this.driftCoherence = coherence;

            if (meanMag >= minMean && coherence >= coherenceMin) {
                this.driftBiasX += (meanX - this.driftBiasX) * strength;
                this.driftBiasY += (meanY - this.driftBiasY) * strength;
                const biasMag = Math.sqrt(this.driftBiasX * this.driftBiasX + this.driftBiasY * this.driftBiasY);
                if (biasMag > maxBias) {
                    const s = maxBias / biasMag;
                    this.driftBiasX *= s;
                    this.driftBiasY *= s;
                }
            } else {
                this.driftBiasX *= decay;
                this.driftBiasY *= decay;
                if (Math.abs(this.driftBiasX) < 0.4) this.driftBiasX = 0;
                if (Math.abs(this.driftBiasY) < 0.4) this.driftBiasY = 0;
            }
        } else {
            this.driftCoherence = 0;
        }

        const biasMag = Math.sqrt(this.driftBiasX * this.driftBiasX + this.driftBiasY * this.driftBiasY);
        const stats = this.predictionStats || this.createEmptyPredictionStats();
        this.predictionStats = stats;
        stats.driftBiasMag = biasMag;
        stats.driftCoherence = this.driftCoherence;
        stats.driftActive = biasMag > 1.25 && this.driftCoherence >= coherenceMin * 0.85;
    }

    getPredictionDebugStats() {
        const stats = this.predictionStats || this.createEmptyPredictionStats();
        return {
            ...stats,
            historyLen: this.inputHistory ? this.inputHistory.length : 0,
            driftBiasX: this.driftBiasX || 0,
            driftBiasY: this.driftBiasY || 0,
            lastSentInputSeq: this.lastSentInputSeq || 0,
            predictionEnabled: !!this.predictionEnabled,
            isHost: !!this.isHost
        };
    }

    resetPredictionState({ clearHistory = true, reenableIfClient = true } = {}) {
        if (clearHistory) {
            this.inputHistory = [];
        }
        this.lastConfirmedState = null;
        this.driftSamples = [];
        this.driftBiasX = 0;
        this.driftBiasY = 0;
        this.driftCoherence = 0;
        this.predictionStats = this.createEmptyPredictionStats();
        if (typeof Game !== 'undefined' && Game.player) {
            Game.player._predictionCorrectionX = 0;
            Game.player._predictionCorrectionY = 0;
            Game.player._predictedDodgeActive = false;
        }
        if (reenableIfClient && !this.isHost) {
            this.predictionEnabled = (typeof MultiplayerConfig !== 'undefined')
                ? MultiplayerConfig.PREDICTION_ENABLED !== false
                : true;
        } else if (this.isHost) {
            this.predictionEnabled = false;
        }
    }
    
    // Handle player state update (host receives from clients)
    handlePlayerState(data) {
        if (!this.isHost) return; // Only host processes player states
        
        const playerId = data.id || data.playerId;
        if (!playerId) return;
        data.id = playerId;
        
        // Sync currency and upgrades from client (authoritative on host, but sync for validation)
        if (typeof Game !== 'undefined') {
            if (data.currency !== undefined) {
                // Update host tracking if needed (client's currency should match host's)
                const hostCurrency = Game.playerCurrencies.get(data.id);
                if (hostCurrency === undefined || Math.abs(hostCurrency - data.currency) > 0.01) {
                    // Currency mismatch - use host's authoritative value, but log it
                    console.log(`[Host] Currency sync: Player ${data.id} reported ${data.currency}, host has ${hostCurrency || 'undefined'}`);
                    // Host maintains authoritative state, so we don't update from client
                }
            }
            
            if (data.upgrades) {
                // Update upgrades if class changed (client sends updated upgrades for new class)
                const hostUpgrades = Game.playerUpgrades.get(data.id);
                if (!hostUpgrades || data.class) {
                    // Update if class changed or if we don't have upgrades yet
                    Game.playerUpgrades.set(data.id, data.upgrades);
                    console.log(`[Host] Updated upgrades for player ${data.id}`);
                }
            }

            if (data.safeRoomMeta) {
                if (!Game.playerSafeRoomMeta) Game.playerSafeRoomMeta = new Map();
                Game.playerSafeRoomMeta.set(data.id, data.safeRoomMeta);
            }
        }
        
        // Class changes only apply in Nexus. During a run, use the locked class.
        if (typeof Game !== 'undefined') {
            const lockedClass = this.getRunClass(data.id, null);
            const claimedClass = data.class || null;
            const targetClass = lockedClass || claimedClass;

            if (this.isRunClassLocked()) {
                // Ignore mid-run class chatter; keep roster/meta on the lock
                if (lockedClass) {
                    data.class = lockedClass;
                    const playerEntry = this.players.find(p => p.id === data.id);
                    if (playerEntry) playerEntry.class = lockedClass;
                    const remotePlayer = this.remotePlayers.find(rp => rp.id === data.id);
                    if (remotePlayer) remotePlayer.class = lockedClass;
                }
            }

            if (targetClass) {
                const currentInstance = Game.remotePlayerInstances.get(data.id);

                // Only create/recreate when missing, or (Nexus) when class actually changed
                const shouldRecreate = !currentInstance || (
                    !this.isRunClassLocked() && currentInstance.playerClass !== targetClass
                );

                if (shouldRecreate) {
                    console.log(`[Host] Recreating player instance for ${data.id} as ${targetClass}`);
                    const newInstance = createPlayer(targetClass, data.x, data.y);
                    newInstance.lastAimAngle = 0; // Initialize rotation state for touch controls
                    
                    // Apply upgrades from host tracking
                    // Note: Player instance already has base stats from its CONFIG
                    // We just need to apply the upgrade bonuses
                    const upgrades = Game.playerUpgrades.get(data.id);
                    if (upgrades && upgrades[targetClass]) {
                        const classUpgrades = upgrades[targetClass];
                        
                        // Get the config for this class to calculate upgrade bonuses
                        let config = null;
                        if (targetClass === 'square' && typeof WARRIOR_CONFIG !== 'undefined') {
                            config = WARRIOR_CONFIG;
                        } else if (targetClass === 'triangle' && typeof ROGUE_CONFIG !== 'undefined') {
                            config = ROGUE_CONFIG;
                        } else if (targetClass === 'pentagon' && typeof TANK_CONFIG !== 'undefined') {
                            config = TANK_CONFIG;
                        } else if (targetClass === 'hexagon' && typeof MAGE_CONFIG !== 'undefined') {
                            config = MAGE_CONFIG;
                        }
                        
                        if (config) {
                            // Calculate upgrade bonuses using config values
                            const upgradeBonuses = {
                                damage: classUpgrades.damage * config.damagePerLevel,
                                defense: classUpgrades.defense * config.defensePerLevel,
                                speed: classUpgrades.speed * config.speedPerLevel
                            };
                            
                            // Apply upgrades to base stats (config values already loaded in constructor)
                            newInstance.baseDamage = config.baseDamage + upgradeBonuses.damage;
                            newInstance.baseMoveSpeed = config.baseSpeed + upgradeBonuses.speed;
                            newInstance.baseDefense = config.baseDefense + upgradeBonuses.defense;
                            
                            // Recalculate effective stats
                            newInstance.updateEffectiveStats();
                        }
                    }
                    
                    Game.remotePlayerInstances.set(data.id, newInstance);
                    
                    // Update the player entry in our players list
                    const playerEntry = this.players.find(p => p.id === data.id);
                    if (playerEntry) {
                        playerEntry.class = targetClass;
                    }
                }
            }
        }
        
        // Store player's selected class (for NEXUS rendering) - never overwrite a lock
        if (data.class) {
            const remotePlayer = this.remotePlayers.find(rp => rp.id === data.id);
            if (remotePlayer) {
                remotePlayer.class = this.resolvePlayerClass(data.id, data.class);
                if (!this.isRunClassLocked()) {
                    console.log(`[Host] Updated remote player ${data.id} class to ${remotePlayer.class}`);
                }
            }
        }
        
        // Store the client's input state for simulation
        if (data.input && typeof Game !== 'undefined' && Game.storeRemotePlayerInput) {
            const inputPayload = data.input;
            if (data.inputSeq != null && inputPayload && inputPayload.inputSeq == null) {
                inputPayload.inputSeq = data.inputSeq;
            } else if (data.sequence != null && inputPayload && inputPayload.inputSeq == null) {
                inputPayload.inputSeq = data.sequence;
            }
            Game.storeRemotePlayerInput(data.id, inputPayload);
        } else if ((data.inputSeq != null || data.sequence != null) && typeof Game !== 'undefined' && Game.remotePlayerInstances) {
            // Transform-only / heartbeat frame still advances ack seq for prediction reconcile
            const instance = Game.remotePlayerInstances.get(data.id);
            if (instance) {
                const seq = data.inputSeq != null ? data.inputSeq : data.sequence;
                if (seq != null && (instance.lastProcessedInputSeq == null || seq >= instance.lastProcessedInputSeq)) {
                    instance.lastProcessedInputSeq = seq;
                }
            }
        }
        
        // Update remote player in our game state (for rendering)
        this.updateRemotePlayer(data);
    }
    
    handlePlayerStateBatch(batch) {
        if (!this.isHost) return;
        if (!batch || !Array.isArray(batch.frames) || batch.frames.length === 0) return;
        
        const playerId = batch.playerId;
        batch.frames.forEach(frame => {
            const payload = {
                id: frame.id || playerId,
                clientTimestamp: frame.clientTimestamp,
                input: frame.input
            };
            if (frame.transform) {
                payload.x = frame.transform.x;
                payload.y = frame.transform.y;
                payload.rotation = frame.transform.rotation;
            }
            if (frame.class !== undefined) payload.class = frame.class;
            if (frame.currency !== undefined) payload.currency = frame.currency;
            if (frame.upgrades !== undefined) payload.upgrades = frame.upgrades;
            if (frame.sequence !== undefined) payload.sequence = frame.sequence;
            if (frame.inputSeq !== undefined) payload.inputSeq = frame.inputSeq;
            else if (frame.sequence !== undefined) payload.inputSeq = frame.sequence;
            
            this.handlePlayerState(payload);
        });
    }
    
    // Handle game start
    handleGameStart(data) {
        console.log('[Multiplayer] Game starting');

        // Freeze classes for the run (Nexus is the only place they can change)
        this.lockRunClasses();
        
        // Ensure game mode is set correctly
        if (typeof Game !== 'undefined') {
            const modeId = data && data.modeId ? data.modeId : 'roguelike';
            Game.gameMode = modeId === 'surge-arena' ? 'surge-arena' : 'gear';
            Game.selectedModeId = modeId;
            if (typeof nexusRoom !== 'undefined' && nexusRoom) {
                nexusRoom.portalMode = modeId;
            }
            if (data && data.runSeed) {
                Game.runSeed = data.runSeed;
            }
            
            // Initialize item pylons array if it doesn't exist (for both host and clients)
            if (!Game.itemPylons) {
                Game.itemPylons = [];
                console.log('[Multiplayer] Initialized Game.itemPylons array');
            }
        }
        
        // FIRST: Reset all remote players to game start position BEFORE any rendering
        if (this.remotePlayers && this.remotePlayers.length > 0) {
            this.remotePlayers.forEach(rp => {
                rp.x = 100;
                rp.y = 360;
                const locked = this.getRunClass(rp.id, rp.class);
                if (locked) rp.class = locked;
            });
            
            if (typeof Game !== 'undefined') {
                Game.remotePlayers = this.remotePlayers;
            }
        }
        
        // THEN: Notify game to transition to PLAYING state
        if (typeof onGameStart === 'function') {
            onGameStart(data);
        }

        // Host startGame path may have created instances - lock again with freshest data
        this.lockRunClasses();
    }
    
    // Handle return to nexus
    handleReturnToNexus(data) {
        console.log('[Multiplayer] Host returned to nexus, following...');

        this.clearRunClassLocks();
        
        // Clear waiting flag - host has signaled return
        if (typeof Game !== 'undefined') {
            Game.waitingForHostReturn = false;
        }
        
        // FIRST: Reset all remote players to nexus spawn BEFORE any rendering
        if (this.remotePlayers && this.remotePlayers.length > 0) {
            this.remotePlayers.forEach((rp, index) => {
                rp.x = 300;
                rp.y = 360;
                
                // Make sure remote players are marked alive for the new run
                rp.dead = false;
                rp.alive = true;
                rp.invulnerable = false;
                rp.invulnerabilityTime = 0;
                
                if (rp.maxHp !== undefined) {
                    rp.hp = rp.maxHp;
                } else {
                    rp.hp = rp.hp !== undefined ? rp.hp : 100;
                }
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
        if (typeof Game !== 'undefined') {
            let reviveTargets = [];
            if (Array.isArray(data.reviveePlayers)) {
                reviveTargets = data.reviveePlayers;
            } else if (data.reviveePlayers) {
                const localIdFallback = Game.getLocalPlayerId ? Game.getLocalPlayerId() : null;
                if (localIdFallback) {
                    reviveTargets = [localIdFallback];
                }
            }
            
            if (reviveTargets.length > 0) {
                if (typeof Game.reviveDeadPlayers === 'function') {
                    Game.reviveDeadPlayers({
                        reason: 'room_transition',
                        broadcast: false,
                        targetPlayerIds: reviveTargets,
                        respawnStrategy: 'safe'
                    });
                } else {
                    const localPlayerId = Game.getLocalPlayerId ? Game.getLocalPlayerId() : null;
                    if (localPlayerId && reviveTargets.includes(localPlayerId) && Game.player && Game.player.dead && Game.deadPlayers && Game.deadPlayers.has(localPlayerId)) {
                        Game.player.dead = false;
                        Game.player.alive = true;
                        Game.player.hp = Game.player.maxHp * 0.5;
                        Game.deadPlayers.delete(localPlayerId);
                        Game.allPlayersDead = false;
                        Game.spectateMode = false;
                        
                        if (Game.getPlayerStats) {
                            const stats = Game.getPlayerStats(localPlayerId);
                            if (stats && typeof stats.onRevive === 'function') {
                                stats.onRevive();
                            }
                        }
                        
                        console.log(`[Multiplayer Revival] Player revived at 50% HP (${Math.floor(Game.player.hp)}/${Math.floor(Game.player.maxHp)})`);
                    }
                }
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

        if (data.roomLayout) {
            this.applySyncedRoomLayout(data.roomNumber, data.roomType || 'normal', data.roomLayout);
            const spawnZone = data.roomLayout.spawnZone || { x: 140, y: 675 };
            if (typeof Game !== 'undefined' && Game.player) {
                Game.player.x = spawnZone.x;
                Game.player.y = spawnZone.y;
            }
            if (this.remotePlayers && this.remotePlayers.length > 0) {
                this.remotePlayers.forEach(rp => {
                    rp.x = spawnZone.x;
                    rp.y = spawnZone.y;
                });
                if (typeof Game !== 'undefined') {
                    Game.remotePlayers = this.remotePlayers;
                }
            }
        }
        
        // Notify game
        if (typeof onRoomTransition === 'function') {
            onRoomTransition(data);
        }
    }
    
    handleRevivePlayers(data) {
        if (this.isHost) {
            // Host already applied the revival locally
            return;
        }
        
        if (!data || !Array.isArray(data.playerIds) || data.playerIds.length === 0) {
            return;
        }
        
        if (typeof Game === 'undefined' || !Game) {
            return;
        }
        
        const localPlayerId = Game.getLocalPlayerId ? Game.getLocalPlayerId() : null;
        if (!localPlayerId || !data.playerIds.includes(localPlayerId)) {
            return;
        }
        
        if (typeof Game.reviveDeadPlayers === 'function') {
            Game.reviveDeadPlayers({
                reason: data.reason || 'network',
                broadcast: false,
                targetPlayerIds: data.playerIds,
                respawnStrategy: 'safe'
            });
        } else if (Game.player && Game.player.dead && Game.deadPlayers && Game.deadPlayers.has(localPlayerId)) {
            Game.player.dead = false;
            Game.player.alive = true;
            Game.player.hp = Game.player.maxHp * 0.5;
            Game.deadPlayers.delete(localPlayerId);
            Game.allPlayersDead = false;
            Game.spectateMode = false;
            
            if (Game.getPlayerStats) {
                const stats = Game.getPlayerStats(localPlayerId);
                if (stats && typeof stats.onRevive === 'function') {
                    stats.onRevive();
                }
            }
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
        
        // Calculate actual damage dealt (capped by enemy HP)
        const damageDealt = Math.min(damage, oldHp);
        
        // For bosses with weak points, pass hitbox info for proper detection
        if (enemy.isBoss && hitboxX !== undefined && hitboxY !== undefined && hitboxRadius !== undefined) {
            enemy.takeDamage(damage, hitboxX, hitboxY, hitboxRadius, attackerId);
        } else {
            const mpArchetype = hitboxRadius > 80 ? 'blast' : (hitboxRadius > 35 ? 'slash' : 'pierce');
            enemy.takeDamage(damage, attackerId, hitboxX ?? null, hitboxY ?? null, mpArchetype);
        }
        
        // Track last attacker (already done in takeDamage, but ensure it's set)
        enemy.lastAttacker = attackerId;
        
        // Track damage stats for the attacker (includes remote players)
        // NOTE: For local player (host), stats are tracked in combat.js
        // For remote players, this is the ONLY place stats are tracked
        const localPlayerId = typeof Game !== 'undefined' && Game.getLocalPlayerId ? Game.getLocalPlayerId() : null;
        if (attackerId !== localPlayerId && typeof Game !== 'undefined' && Game.getPlayerStats) {
            // Track lifetime damage stat for remote players
            if (typeof window.trackLifetimeStat === 'function') {
                window.trackLifetimeStat('totalDamageDealt', damageDealt);
            }
            
            const stats = Game.getPlayerStats(attackerId);
            if (stats) {
                stats.addStat('damageDealt', damageDealt);
                
                // Track kill if enemy died
                if (oldHp > 0 && enemy.hp <= 0) {
                    // Track lifetime kills stat for remote players
                    if (typeof window.trackLifetimeStat === 'function') {
                        window.trackLifetimeStat('totalKills', 1);
                    }
                    stats.addStat('kills', 1);
                }
            }
        }
        
        // Track telemetry for remote player damage (host only, same as local player tracking)
        if (typeof Telemetry !== 'undefined' && attackerId) {
            const enemyId = enemy.enemyId || enemy.id || enemy.bossName || enemy.type || null;
            const enemyType = enemy.isBoss ? 'boss' : (enemy.type || (enemy.constructor && enemy.constructor.name) || 'enemy');
            const roomNumber = typeof Game !== 'undefined' && typeof Game.roomNumber === 'number'
                ? Game.roomNumber
                : null;
            
            Telemetry.recordDamage({
                playerId: attackerId,
                amount: damageDealt,
                enemyId,
                enemyType,
                roomNumber,
                isBoss: !!enemy.isBoss
            });
        }
        
        // Check if enemy died
        const died = enemy.hp <= 0 || !enemy.alive;
        
        console.log(`[Multiplayer Host] Enemy ${enemyIndex} took ${damage} damage from ${attackerId}. HP: ${oldHp} → ${enemy.hp}${died ? ' (DIED)' : ''}`);
        
        // Create damage number locally (host sees remote player damage)
        if (typeof createDamageNumber !== 'undefined') {
            const damageToDisplay = Math.floor(damageDealt);
            createDamageNumber(enemy.x, enemy.y, damageToDisplay, false, hitWeakPoint || false);
            
            if (typeof DebugFlags !== 'undefined' && DebugFlags.DAMAGE_NUMBERS) {
                console.log(`[Host] Created local damage number for remote attack: (${enemy.x}, ${enemy.y}), damage=${damageToDisplay}`);
            }
        }
        
        // Broadcast damage number event to all clients for visual feedback
        this.sendDamageNumber({
            enemyId: enemy.id,
            x: enemy.x,
            y: enemy.y,
            damage: damageDealt,
            isCrit: false,
            isWeakPoint: hitWeakPoint || false
        });
        
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
        
        // If enemy just died, trigger visual effects only
        // XP and loot are handled by host and synced via game_state
        if (died && !enemy.alive) {
            console.log(`[Multiplayer Client] Enemy ${enemyIndex} died (killed by ${lastAttacker})`);

            if (!enemy.lastKillContext && typeof storeKillContext === 'function') {
                storeKillContext(enemy, enemy.maxHp || 100, enemy.x, enemy.y, 'slash');
            }
            if (typeof enemy.triggerDeathVisuals === 'function') {
                enemy.triggerDeathVisuals();
            } else if (typeof createParticleBurst !== 'undefined') {
                createParticleBurst(enemy.x, enemy.y, enemy.color, 12);
            }
            
            if (typeof GameAudio !== 'undefined' && GameAudio.sounds && typeof Engine !== 'undefined' && Engine.Audio && Engine.Audio.initialized && GameAudio.sounds.enemyDeath) {
                setTimeout(() => {
                    if (GameAudio.sounds && GameAudio.sounds.enemyDeath) {
                        GameAudio.sounds.enemyDeath();
                    }
                }, 50);
            }
        }
    }
    
    // Handle player damaged event (clients only)
    handlePlayerDamaged(data) {
        // NOTE: This handler is now DEPRECATED - HP syncs via game_state instead
        // Kept for backwards compatibility but does nothing
        // Damage is applied on host and HP is synced to clients via game_state
        // This prevents double damage application
        console.log('[Multiplayer] Received player_damaged event (deprecated - HP syncs via game_state)');
    }
    
    // Handle loot pickup (from any player)
    handleLootPickup(data) {
        if (typeof Game === 'undefined' || typeof groundLoot === 'undefined') return;
        
        const { playerId, lootId, gear } = data;
        const localPlayerId = Game.getLocalPlayerId ? Game.getLocalPlayerId() : null;
        
        // Sender already applied pickup locally before broadcasting
        if (playerId === localPlayerId) {
            return;
        }
        
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
                    const oldGear = remotePlayer.equipGear(gear);
                    console.log(`[Host] Equipped ${gear.tier} ${gear.slot} on remote player ${playerId}`);

                    if (typeof Telemetry !== 'undefined' && Telemetry.recordGearEquipped) {
                        Telemetry.recordGearEquipped({
                            playerId,
                            gear,
                            oldGear,
                            roomNumber: Game.roomNumber || 1
                        });
                    }
                    
                    if (oldGear) {
                        this.spawnDroppedGear(oldGear, remotePlayer, playerId);
                    }
                }
            }
        }
    }
    
    // Handle gear dropped (when player swaps gear)
    handleGearDropped(data) {
        if (typeof Game === 'undefined' || typeof groundLoot === 'undefined') return;
        
        const { playerId, gear } = data;
        
        // Add the dropped gear to ground loot for all clients
        if (gear) {
            // Prevent duplicate gear items from being added
            if (groundLoot.some(g => g.id === gear.id)) {
                console.log(`[Multiplayer] Ignored duplicate gear drop ${gear.id}`);
                return;
            }
            // Ensure gear has all required properties for rendering
            const fullGear = {
                ...gear,
                size: gear.size || 15,
                pulse: gear.pulse || 0
            };
            if (typeof normalizeGearProgressFields === 'function') {
                normalizeGearProgressFields(fullGear);
            } else if (typeof window !== 'undefined' && typeof window.normalizeGearProgressFields === 'function') {
                window.normalizeGearProgressFields(fullGear);
            }
            if (typeof ensureGearDropMetadata === 'function') {
                ensureGearDropMetadata(fullGear);
            }
            groundLoot.push(fullGear);
            console.log(`[Multiplayer] Player ${playerId} dropped ${gear.tier} ${gear.slot} at (${gear.x.toFixed(0)}, ${gear.y.toFixed(0)})`);
        }
    }
    
    // Handle item pylon interaction (received from server - updates pylon state on clients)
    handleItemPylonInteract(data) {
        // This is called when receiving a broadcast from server (after host processed it)
        const { pylonId, playerId, itemId } = data;
        if (!pylonId || !playerId || !itemId || !Game.itemPylons) return;
        
        const pylon = Game.itemPylons.find(p => p.id === pylonId);
        if (!pylon) return;
        
        // Update pylon state (mark player as having interacted)
        if (!pylon.interactedPlayers) {
            pylon.interactedPlayers = [];
        }
        
        const isLocalPlayer = playerId === this.playerId;
        const alreadyInteracted = pylon.interactedPlayers.includes(playerId);
        
        if (!alreadyInteracted) {
            pylon.interactedPlayers.push(playerId);
        }
        
        // Local player feedback - game_state can sync interactedPlayers before this
        // broadcast arrives, so always show pickup UI when the grant message is for us.
        if (isLocalPlayer && Game.player && Game.player.itemManager) {
            if (!alreadyInteracted) {
                Game.player.itemManager.addItem(itemId);
            }
            this.notifyItemPylonPickup(itemId, pylonId, playerId);
        }
        
        // Check if all players have interacted
        const totalPlayers = typeof getItemPylonExpectedClaims === 'function'
            ? getItemPylonExpectedClaims()
            : (this.players ? this.players.length : 1);
        if (pylon.interactedPlayers.length >= totalPlayers) {
            pylon.disappearing = true;
            pylon.disappearProgress = 0;
        }
    }
    
    notifyItemPylonPickup(itemId, pylonId, playerId) {
        if (!this._pylonPickupNotified) {
            this._pylonPickupNotified = new Set();
        }
        const notifyKey = `${pylonId}:${playerId}`;
        if (this._pylonPickupNotified.has(notifyKey)) {
            return;
        }
        this._pylonPickupNotified.add(notifyKey);
        
        let itemName = 'Item';
        let itemRarity = 'common';
        if (typeof ITEM_DEFINITIONS !== 'undefined' && ITEM_DEFINITIONS[itemId]) {
            itemName = ITEM_DEFINITIONS[itemId].name || 'Item';
            itemRarity = ITEM_DEFINITIONS[itemId].rarity || 'common';
        }
        
        if (typeof showItemPickupMessage === 'function') {
            showItemPickupMessage(itemName, itemRarity);
        }
        
        if (typeof GameAudio !== 'undefined' && GameAudio.sounds && GameAudio.sounds.pickupChime) {
            GameAudio.sounds.pickupChime();
        }
        
        console.log(`[Multiplayer] Pylon pickup: ${itemId} from ${pylonId}`);
    }
    
    // Handle item pylon interaction request (from client to host)
    handleItemPylonInteractRequest(data) {
        if (!this.isHost) return; // Only host processes requests
        
        const { pylonId, playerId } = data;
        if (!pylonId || !playerId || !Game.itemPylons) return;
        
        const pylon = Game.itemPylons.find(p => p.id === pylonId);
        if (!pylon) return;
        
        // Check if player already interacted
        if (!pylon.interactedPlayers) {
            pylon.interactedPlayers = [];
        }
        
        if (pylon.interactedPlayers.includes(playerId)) {
            return; // Already interacted
        }
        
        // Find the player instance
        let playerInstance = null;
        if (playerId === this.playerId && Game.player) {
            playerInstance = Game.player;
        } else if (Game.remotePlayerInstances) {
            playerInstance = Game.remotePlayerInstances.get(playerId);
        }
        
        if (!playerInstance || !playerInstance.itemManager) {
            return; // Player not found or no item manager
        }
        
        // Generate a random item of the pylon's rarity for this player
        // Each player gets their own random item, but all items will be of the same rarity
        const pylonRarity = pylon.rarity || 'common';
        let randomItemId = null;
        let randomItemDef = null;
        
        if (typeof ITEM_DEFINITIONS !== 'undefined') {
            // Get all items of the pylon's rarity
            const itemsOfRarity = Object.values(ITEM_DEFINITIONS).filter(item => item.rarity === pylonRarity);
            if (itemsOfRarity.length > 0) {
                // Pick a random item from items of this rarity
                randomItemDef = itemsOfRarity[Math.floor(Math.random() * itemsOfRarity.length)];
                randomItemId = randomItemDef.id;
            } else {
                // Fallback: if no items of this rarity exist, use common
                const commonItems = Object.values(ITEM_DEFINITIONS).filter(item => item.rarity === 'common');
                if (commonItems.length > 0) {
                    randomItemDef = commonItems[Math.floor(Math.random() * commonItems.length)];
                    randomItemId = randomItemDef.id;
                }
            }
        }
        
        if (!randomItemId || !randomItemDef) {
            console.warn(`[Host] Cannot generate random ${pylonRarity} item for player ${playerId} from pylon ${pylonId}`);
            return;
        }
        
        // Add random item to player
        const success = playerInstance.itemManager.addItem(randomItemId);
        
        if (success) {
            // Mark player as having interacted
            pylon.interactedPlayers.push(playerId);
            if (typeof Telemetry !== 'undefined') {
                Telemetry.recordEvent('itemPylonInteracted', {
                    roomNumber: typeof Game !== 'undefined' && Game.roomNumber ? Game.roomNumber : 1,
                    playerId,
                    targetId: pylonId,
                    metadata: {
                        pylonId,
                        pylonRarity,
                        itemId: randomItemId,
                        itemName: randomItemDef.name || null,
                        itemRarity: randomItemDef.rarity || null,
                        interactedCount: pylon.interactedPlayers.length
                    }
                });
            }
            
            // If this is the local player, show pickup message and play sound
            if (playerId === this.playerId) {
                this.notifyItemPylonPickup(randomItemId, pylonId, playerId);
            }
            
            // Check if all players have interacted
            const totalPlayers = typeof getItemPylonExpectedClaims === 'function'
                ? getItemPylonExpectedClaims()
                : (this.players ? this.players.length : 1);
            if (pylon.interactedPlayers.length >= totalPlayers) {
                // Start disappear animation
                pylon.disappearing = true;
                pylon.disappearProgress = 0;
            }
            
            // Send interaction to server (server will broadcast to all clients)
            // Include the itemId so clients know what item was given
            this.send({
                type: 'item_pylon_interact',
                data: {
                    pylonId: pylonId,
                    playerId: playerId,
                    itemId: randomItemId  // Send the random item ID to the client
                }
            });
            
            console.log(`[Host] Player ${playerId} interacted with pylon ${pylonId} and received ${randomItemDef.name} (${randomItemDef.rarity})`);
        }
    }

    handleArenaNextWaveRequest(data) {
        if (!this.isHost) return;
        console.log('[Multiplayer] Client requested next wave start');
        
        if (typeof Game !== 'undefined' && Game.state === 'PLAYING') {
            if (Game.arenaPhase === 'waiting') {
                const room = (typeof currentRoom !== 'undefined' && currentRoom) || Game.currentRoom;
                const pylon = room && room.wavePylon;
                if (pylon && pylon.active) {
                    if (typeof GameBus !== 'undefined' && GameBus.emit) {
                        GameBus.emit('arena:startNextWave', {
                            world: Game
                        });
                    } else if (typeof GameArena !== 'undefined' && GameArena.triggerNextWave) {
                        GameArena.triggerNextWave(Game);
                    }
                }
            }
        }
    }
    
    spawnDroppedGear(oldGear, playerInstance, playerId) {
        if (typeof groundLoot === 'undefined' || !oldGear) return;
        const drop = this.prepareGearDrop(oldGear, playerInstance);
        groundLoot.push(drop);
        
        this.send({
            type: 'gear_dropped',
            data: {
                playerId,
                gear: this.serializeGearForNetwork(drop)
            }
        });
    }
    
    prepareGearDrop(gear, playerInstance) {
        const drop = this.deepClone(gear) || {};
        drop.id = drop.id || `gear-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        drop.size = drop.size || 15;
        drop.pulse = 0;
        drop.color = drop.color || this.getGearTierColor(drop.tier);
        
        const baseX = (playerInstance && playerInstance.x !== undefined) ? playerInstance.x : (gear.x || 0);
        const baseY = (playerInstance && playerInstance.y !== undefined) ? playerInstance.y : (gear.y || 0);
        const offsetX = (Math.random() - 0.5) * 20;
        const offsetY = (Math.random() - 0.5) * 20;
        
        let dropX = baseX + offsetX;
        let dropY = baseY + offsetY;
        const margin = 50;
        const roomWidth = (typeof currentRoom !== 'undefined' && currentRoom) ? currentRoom.width : 3000;
        const roomHeight = (typeof currentRoom !== 'undefined' && currentRoom) ? currentRoom.height : 1700;
        dropX = Math.max(margin, Math.min(roomWidth - margin, dropX));
        dropY = Math.max(margin, Math.min(roomHeight - margin, dropY));
        if (typeof GameArena !== 'undefined' && GameArena.displaceLootFromWavePad) {
            const moved = GameArena.displaceLootFromWavePad(dropX, dropY);
            dropX = moved.x;
            dropY = moved.y;
        }
        if (typeof currentRoom !== 'undefined' && currentRoom && currentRoom.layout && typeof RoomLayoutGenerator !== 'undefined' &&
            !RoomLayoutGenerator.isPointWalkable(currentRoom.layout, dropX, dropY, drop.size || 15)) {
            const safePoint = RoomLayoutGenerator.findSafeSpawnPoint(currentRoom.layout, {
                radius: drop.size || 15,
                margin,
                minDistanceFrom: [{ x: currentRoom.layout.spawnZone.x, y: currentRoom.layout.spawnZone.y, distance: 120 }],
                maxAttempts: 80
            });
            if (safePoint) {
                dropX = safePoint.x;
                dropY = safePoint.y;
            }
        }
        
        drop.x = dropX;
        drop.y = dropY;
        drop.roomNumber = (typeof Game !== 'undefined' && Game.roomNumber !== undefined) ? Game.roomNumber : gear.roomNumber;
        
        return drop;
    }
    
    normalizeGroundLootFromNetwork(lootData) {
        const tierColors = {
            gray: '#999999',
            green: '#4caf50',
            blue: '#2196f3',
            purple: '#9c27b0',
            orange: '#ff9800'
        };
        const gear = {
            id: lootData.id,
            x: lootData.x,
            y: lootData.y,
            slot: lootData.slot,
            tier: lootData.tier,
            stats: lootData.stats || {},
            affixes: lootData.affixes || [],
            weaponType: lootData.weaponType || null,
            armorType: lootData.armorType || null,
            classModifier: lootData.classModifier || null,
            legendaryEffect: lootData.legendaryEffect || null,
            name: lootData.name || '',
            bonus: lootData.bonus,
            scaling: lootData.scaling,
            roomNumber: lootData.roomNumber,
            size: lootData.size || 15,
            color: lootData.color || tierColors[lootData.tier] || '#999999',
            pulse: lootData.pulse || 0,
            level: lootData.level,
            upgradesApplied: lootData.upgradesApplied,
            originalTier: lootData.originalTier,
            rarityStepsApplied: lootData.rarityStepsApplied,
            rarityUpgradedThisVisit: lootData.rarityUpgradedThisVisit,
            rerollIndex: lootData.rerollIndex,
            rerollCount: lootData.rerollCount
        };
        if (typeof normalizeGearProgressFields === 'function') {
            normalizeGearProgressFields(gear);
        } else if (typeof window !== 'undefined' && typeof window.normalizeGearProgressFields === 'function') {
            window.normalizeGearProgressFields(gear);
        }
        if (typeof ensureGearDropMetadata === 'function') {
            ensureGearDropMetadata(gear);
        }
        return gear;
    }

    serializeGearForNetwork(gear) {
        return window.serializeGearForNetwork(gear, { includeWorld: true });
    }

    hydrateGearFromNetwork(data) {
        if (!data) return null;
        const gear = Object.assign({}, data);
        if (typeof normalizeGearProgressFields === 'function') {
            normalizeGearProgressFields(gear);
        } else if (typeof window !== 'undefined' && typeof window.normalizeGearProgressFields === 'function') {
            window.normalizeGearProgressFields(gear);
        }
        return gear;
    }
    
    getGearTierColor(tier) {
        if (!tier) return '#999999';
        const map = {
            gray: '#999999',
            green: '#4caf50',
            blue: '#2196f3',
            purple: '#9c27b0',
            orange: '#ff9800'
        };
        return map[tier] || '#999999';
    }
    
    // Handle upgrade purchase request (host only - processes and validates)
    handleUpgradePurchase(data) {
        if (!this.isHost || typeof Game === 'undefined' || typeof SaveSystem === 'undefined') return;
        
        const { playerId, classType, statType } = data;
        
        // Get player's current currency and upgrades
        const currentCurrency = Game.playerCurrencies.get(playerId) || 0;
        const storedUpgrades = Game.playerUpgrades.get(playerId);
        const upgradesBase = storedUpgrades ? storedUpgrades : this.createEmptyUpgradeSet();
        
        // Get current upgrade level
        const currentLevel = (upgradesBase[classType] && upgradesBase[classType][statType]) || 0;
        
        // Calculate cost
        const cost = SaveSystem.getUpgradeCost(statType, currentLevel);
        
        // Validate purchase
        if (currentCurrency < cost) {
            console.warn(`[Host] Player ${playerId} attempted upgrade purchase but insufficient currency: ${currentCurrency} < ${cost}`);
            return;
        }
        
        // Update host-side tracking
        const newLevel = currentLevel + 1;
        const newCurrency = Math.floor(currentCurrency - cost);
        
        // Update upgrades (clone to avoid mutating shared references)
        const updatedUpgrades = this.cloneUpgradeSet(upgradesBase);
        if (!updatedUpgrades[classType]) {
            updatedUpgrades[classType] = { damage: 0, defense: 0, speed: 0 };
        }
        updatedUpgrades[classType][statType] = newLevel;
        Game.playerUpgrades.set(playerId, updatedUpgrades);
        
        // Update currency
        Game.playerCurrencies.set(playerId, newCurrency);
        
        console.log(`[Host] Processed upgrade purchase: Player ${playerId}, ${classType} ${statType} level ${newLevel}, currency: ${newCurrency}`);
        
        // Send confirmation to the purchasing player
        const player = this.players.find(p => p.id === playerId);
        const upgradesSnapshot = this.cloneUpgradeSet(updatedUpgrades);
        if (player) {
            // Keep lobby roster data up to date for subsequent syncs/new joins
            player.currency = newCurrency;
            player.upgrades = upgradesSnapshot;
        }
        
        // If this is the local player (host), also update local SaveSystem and recreate player
        const localPlayerId = Game.getLocalPlayerId ? Game.getLocalPlayerId() : null;
        if (playerId === localPlayerId) {
            SaveSystem.setUpgrade(classType, statType, newLevel);
            SaveSystem.setCurrency(newCurrency);
            Game.currentCurrency = newCurrency;
            
            // Recreate player if this is the current class
            if (Game.player && Game.selectedClass === classType) {
                const currentX = Game.player.x;
                const currentY = Game.player.y;
                Game.player = createPlayer(classType, currentX, currentY);
                Game.player.playerId = localPlayerId; // Preserve player ID
                console.log(`[Host] Recreated local player to apply upgrade stats`);
            }
        }
        
        // Apply upgrades to remote player instance (host simulating remote players)
        if (playerId !== localPlayerId && Game.remotePlayerInstances && Game.remotePlayerInstances.has(playerId)) {
            const instance = Game.remotePlayerInstances.get(playerId);
            this.applyUpgradesToInstance(instance, classType, upgradesSnapshot[classType]);
        }
        
        // Update remote player cache for rendering in lobby/overlays
        const remotePlayer = this.remotePlayers.find(rp => rp.id === playerId);
        if (remotePlayer) {
            remotePlayer.currency = newCurrency;
            remotePlayer.upgrades = upgradesSnapshot;
        }
        if (typeof Game !== 'undefined') {
            Game.remotePlayers = this.remotePlayers;
        }
        
        // Notify server so it can forward confirmation to the purchasing client
        this.send({
            type: 'upgrade_purchased',
            data: {
                playerId: playerId,
                classType: classType,
                statType: statType,
                newLevel: newLevel,
                newCurrency: newCurrency,
                upgrades: upgradesSnapshot
            }
        });
    }
    
    // Handle upgrade purchase confirmation (from host)
    handleUpgradePurchased(data) {
        if (typeof Game === 'undefined' || typeof SaveSystem === 'undefined') return;
        
        const { classType, statType, newLevel, newCurrency, upgrades } = data;
        const localPlayerId = Game.getLocalPlayerId ? Game.getLocalPlayerId() : null;
        
        // Only process if this is for the local player
        if (data.playerId && data.playerId !== localPlayerId) return;
        
        // Update local SaveSystem
        const flooredCurrency = Math.floor(newCurrency);
        if (upgrades) {
            Object.keys(upgrades).forEach(classKey => {
                const classUpgrades = upgrades[classKey] || {};
                SaveSystem.setUpgrade(classKey, 'damage', classUpgrades.damage || 0);
                SaveSystem.setUpgrade(classKey, 'defense', classUpgrades.defense || 0);
                SaveSystem.setUpgrade(classKey, 'speed', classUpgrades.speed || 0);
            });
        } else {
            SaveSystem.setUpgrade(classType, statType, newLevel);
        }
        SaveSystem.setCurrency(flooredCurrency);
        Game.currentCurrency = flooredCurrency;
        
        console.log(`[Multiplayer] Upgrade purchased: ${classType} ${statType} level ${newLevel}, currency: ${flooredCurrency}`);
        
        // If this is the current class, recreate player to apply stats
        if (Game.player && Game.selectedClass === classType) {
            const currentX = Game.player.x;
            const currentY = Game.player.y;
            const currentPlayerId = Game.player.playerId; // Preserve player ID
            Game.player = createPlayer(classType, currentX, currentY);
            Game.player.playerId = currentPlayerId; // Restore player ID
            console.log(`[Multiplayer] Recreated player to apply upgrade stats`);
        }
    }
    
    // Handle currency update (from host)
    handleCurrencyUpdate(data) {
        if (typeof Game === 'undefined' || typeof SaveSystem === 'undefined') return;
        
        const { newCurrency, reason } = data;
        const localPlayerId = Game.getLocalPlayerId ? Game.getLocalPlayerId() : null;
        
        // Only process if this is for the local player
        if (data.playerId && data.playerId !== localPlayerId) return;
        
        // Update local currency
        const flooredCurrency = Math.floor(newCurrency);
        SaveSystem.setCurrency(flooredCurrency);
        Game.currentCurrency = flooredCurrency;
        
        console.log(`[Multiplayer] Currency updated: ${flooredCurrency} (reason: ${reason || 'unknown'})`);
    }
    
    // Handle shards update (from host)
    handleShardsUpdate(data) {
        if (typeof Game === 'undefined' || typeof SaveSystem === 'undefined') return;
        
        const { shardsEarned, reason } = data;
        const localPlayerId = Game.getLocalPlayerId ? Game.getLocalPlayerId() : null;
        
        // Only process if this is for the local player
        if (data.targetPlayerId && data.targetPlayerId !== localPlayerId) return;
        
        // Award shards
        if (shardsEarned > 0 && SaveSystem.addCardShards) {
            SaveSystem.addCardShards(shardsEarned);
            console.log(`[Multiplayer] Shards updated: +${shardsEarned} (reason: ${reason || 'unknown'})`);
        }
    }
    
    // Handle upgrades sync (from host)
    handleUpgradesSync(data) {
        if (typeof Game === 'undefined' || typeof SaveSystem === 'undefined') return;
        
        const { upgrades } = data;
        const localPlayerId = Game.getLocalPlayerId ? Game.getLocalPlayerId() : null;
        
        // Only process if this is for the local player
        if (data.playerId && data.playerId !== localPlayerId) return;
        
        // Update local SaveSystem with all upgrade levels
        if (upgrades) {
            Object.keys(upgrades).forEach(classType => {
                const classUpgrades = upgrades[classType];
                if (classUpgrades) {
                    SaveSystem.setUpgrade(classType, 'damage', classUpgrades.damage || 0);
                    SaveSystem.setUpgrade(classType, 'defense', classUpgrades.defense || 0);
                    SaveSystem.setUpgrade(classType, 'speed', classUpgrades.speed || 0);
                }
            });
            console.log(`[Multiplayer] Upgrades synced from host`);
        }
    }
    
    // Host helpers: broadcast combat visuals to clients
    sendDamageNumber({ enemyId = null, x, y, damage, isCrit = false, isWeakPoint = false } = {}) {
        if (!this.isHost || !this.connected) return;
        if (typeof x !== 'number' || typeof y !== 'number' || typeof damage !== 'number') return;
        this.send({
            type: 'damage_number',
            data: {
                enemyId,
                x,
                y,
                damage: Math.floor(damage),
                isCrit: !!isCrit,
                isWeakPoint: !!isWeakPoint
            }
        });
    }

    sendCombatFx(fx) {
        if (!this.isHost || !this.connected || !fx || !fx.kind) return;
        this.send({
            type: 'combat_fx',
            data: fx
        });
    }

    // Handle damage number event (from host)
    handleDamageNumber(data) {
        if (this.isHost) return; // Host doesn't need to receive their own damage numbers
        
        // Validate data object
        if (!data) {
            console.error('[Client] Received damage_number event with no data');
            return;
        }
        
        const { enemyId, x, y, damage, isCrit, isWeakPoint } = data;
        
        // Validate required fields
        if (typeof x !== 'number' || typeof y !== 'number' || typeof damage !== 'number') {
            console.error(`[Client] Invalid damage_number data: x=${x}, y=${y}, damage=${damage}`);
            return;
        }
        
        if (typeof DebugFlags !== 'undefined' && DebugFlags.DAMAGE_NUMBERS) {
            console.log(`[Client] Received damage_number: enemyId=${enemyId}, coords=(${x}, ${y}), damage=${damage}, isCrit=${isCrit}, isWeakPoint=${isWeakPoint}`);
        }
        
        // Use coordinates from host (accurate at damage time)
        // Don't override with client's enemy position (may be interpolated/stale)
        const displayX = x;
        const displayY = y;
        
        // Optional: Verify enemy exists for validation (but don't use its position)
        if (typeof DebugFlags !== 'undefined' && DebugFlags.DAMAGE_NUMBERS) {
            if (enemyId && typeof Game !== 'undefined' && Game.enemies) {
                const enemy = Game.enemies.find(e => e.id === enemyId);
                if (enemy) {
                    console.log(`[Client] Enemy ${enemyId} found at (${enemy.x}, ${enemy.y}), using host coords (${x}, ${y}) instead`);
                } else {
                    console.log(`[Client] Enemy ${enemyId} not found (may have died), using host coords (${x}, ${y})`);
                }
            }
        }
        
        // Create damage number on client
        if (typeof createDamageNumber !== 'undefined') {
            if (typeof DebugFlags !== 'undefined' && DebugFlags.DAMAGE_NUMBERS) {
                console.log(`[Client] Creating damage number at (${displayX}, ${displayY}) with damage=${damage}`);
            }
            createDamageNumber(displayX, displayY, damage, isCrit, isWeakPoint);
        } else {
            console.warn('[Client] createDamageNumber function not available!');
        }

        // Trigger local visual voxel fracture on clients
        if (enemyId && typeof Game !== 'undefined' && Game.enemies) {
            const enemy = Game.enemies.find(e => e.id === enemyId);
            if (enemy && enemy._voxelGrid) {
                const mpArchetype = isWeakPoint ? 'pierce' : (isCrit ? 'blast' : 'slash');
                if (typeof storeKillContext === 'function') {
                    storeKillContext(enemy, damage, displayX, displayY, mpArchetype, { isCrit, isWeakPoint });
                }
                if (typeof flagVoxelDamage === 'function') {
                    flagVoxelDamage(enemy, damage, displayX, displayY, mpArchetype);
                }
            }
        }
        
        if (typeof GameAudio !== 'undefined' && GameAudio.sounds && typeof Engine !== 'undefined' && Engine.Audio && Engine.Audio.initialized) {
            const intensity = Math.min(Math.max(damage / 50, 0.2), 2.0);
            if (isWeakPoint && GameAudio.sounds.hitWeakPoint) {
                GameAudio.sounds.hitWeakPoint(intensity);
            } else if (isCrit && GameAudio.sounds.hitCritical) {
                GameAudio.sounds.hitCritical(intensity);
            } else if (GameAudio.sounds.hitNormal) {
                GameAudio.sounds.hitNormal(intensity);
            }
        }
    }

    // Handle combat FX (particles, lightning, explosions) from host - display-only client simulation
    handleCombatFx(data) {
        if (this.isHost) return;
        if (!data || !data.kind) return;

        switch (data.kind) {
            case 'particle_burst':
                if (typeof createParticleBurst === 'function') {
                    createParticleBurst(data.x, data.y, data.color || '#ffffff', data.count || 10);
                }
                break;
            case 'lightning_arc':
                if (typeof createLightningArc === 'function') {
                    createLightningArc(data.x1, data.y1, data.x2, data.y2);
                }
                break;
            case 'explosion':
                if (typeof Game !== 'undefined') {
                    if (!Game.explosions) Game.explosions = [];
                    Game.explosions.push({
                        x: data.x,
                        y: data.y,
                        radius: data.radius || 40,
                        maxRadius: data.maxRadius || data.radius || 40,
                        life: data.life || 0.4,
                        maxLife: data.maxLife || data.life || 0.4,
                        color: data.color || '#ff6600',
                        alpha: 1
                    });
                }
                if (typeof createParticleBurst === 'function') {
                    createParticleBurst(data.x, data.y, data.color || '#ff6600', data.count || 15);
                }
                break;
            default:
                break;
        }
    }
    
    // Handle final stats message (from host when all players die)
    handleFinalStats(data) {
        if (this.isHost) return; // Host doesn't need to receive their own stats
        
        if (typeof Game === 'undefined') return;
        
        // Stop all timers on client to freeze values (match host behavior)
        if (Game.playerStats) {
            Game.playerStats.forEach((stats, playerId) => {
                stats.stopTimer();
            });
        }
        
        // Store final stats for death screen
        Game.finalStats = data.playerStats;
        
        console.log('[Multiplayer] Received final stats from host:', data.playerStats);
    }
    
    // Handle player level up event (from host)
    handlePlayerLeveledUp(data) {
        if (typeof Game === 'undefined') return;
        
        const { playerId, level } = data;
        const localPlayerId = Game.getLocalPlayerId ? Game.getLocalPlayerId() : null;
        
        console.log(`[Multiplayer] Player ${playerId} leveled up to level ${level}`);
        
        // If this is the local player, apply stat bonuses and trigger level up effects
        if (playerId === localPlayerId && Game.player) {
            console.log(`[Multiplayer] Applying level up bonuses and effects for local player (level ${level})`);
            // Ensure level is set correctly (in case event arrives before game_state)
            if (Game.player.level < level) {
                Game.player.level = level;
            }
            // Apply stat bonuses (damage, health, speed)
            // The applyLevelUpBonuses function has a guard to prevent double application
            if (typeof Game.player.applyLevelUpBonuses === 'function') {
                Game.player.applyLevelUpBonuses();
            }
            // Trigger visual effects
            Game.player.triggerLevelUpEffects();
            return;
        }
        
        // If this is a remote player, trigger effects on their instance
        // Host uses remotePlayerInstances, clients use remotePlayerShadowInstances
        const isClient = Game.multiplayerEnabled && Game.isMultiplayerClient && Game.isMultiplayerClient();
        
        if (isClient && Game.remotePlayerShadowInstances) {
            // CLIENT: Use shadow instances for remote players
            const remotePlayer = Game.remotePlayerShadowInstances.get(playerId);
            if (remotePlayer && typeof remotePlayer.triggerLevelUpEffects === 'function') {
                console.log(`[Multiplayer] Triggering level up effects for remote player ${playerId} (client shadow instance)`);
                remotePlayer.triggerLevelUpEffects();
            } else {
                console.warn(`[Multiplayer] Could not find shadow instance for remote player ${playerId}`);
            }
        } else if (!isClient && Game.remotePlayerInstances) {
            // HOST: Use remote player instances
            const remotePlayer = Game.remotePlayerInstances.get(playerId);
            if (remotePlayer && typeof remotePlayer.triggerLevelUpEffects === 'function') {
                console.log(`[Multiplayer] Triggering level up effects for remote player ${playerId} (host instance)`);
                remotePlayer.triggerLevelUpEffects();
            } else {
                console.warn(`[Multiplayer] Could not find instance for remote player ${playerId}`);
            }
        }
    }
    
    // Apply full game state (clients)
    mergeGameStateDelta(delta) {
        const base = this.latestGameState ? this.deepClone(this.latestGameState) : null;
        if (!base) return null;
        
        if (delta.meta) {
            if (delta.meta.roomNumber !== undefined) base.roomNumber = delta.meta.roomNumber;
            if (delta.meta.doorOpen !== undefined) base.doorOpen = delta.meta.doorOpen;
            if (delta.meta.gameState !== undefined) base.gameState = delta.meta.gameState;
            if (delta.meta.roomType !== undefined) base.roomType = delta.meta.roomType;
            if (delta.meta.roomLayout !== undefined) base.roomLayout = this.deepClone(delta.meta.roomLayout);
            if (delta.meta.playersOnDoor !== undefined) base.playersOnDoor = this.deepClone(delta.meta.playersOnDoor);
            if (delta.meta.totalAlivePlayers !== undefined) base.totalAlivePlayers = delta.meta.totalAlivePlayers;
            if (delta.meta.allPlayersDead !== undefined) base.allPlayersDead = delta.meta.allPlayersDead;
            if (delta.meta.deadPlayers !== undefined) base.deadPlayers = this.deepClone(delta.meta.deadPlayers);
        }
        
        if (delta.playerStats) {
            base.playerStats = base.playerStats || {};
            Object.keys(delta.playerStats).forEach(playerId => {
                base.playerStats[playerId] = this.deepClone(delta.playerStats[playerId]);
            });
        }
        
        if (!Array.isArray(base.players)) {
            base.players = [];
        }
        if (delta.players) {
            const playerMap = new Map(base.players.map(p => [p.id, p]));
            delta.players.forEach(playerUpdate => {
                if (!playerUpdate || playerUpdate.id === undefined) return;
                const existing = playerMap.get(playerUpdate.id);
                if (existing) {
                    Object.assign(existing, this.deepClone(playerUpdate));
                } else {
                    const clone = this.deepClone(playerUpdate);
                    base.players.push(clone);
                    playerMap.set(playerUpdate.id, clone);
                }
            });
        }
        if (delta.removedPlayers && delta.removedPlayers.length) {
            const removedSet = new Set(delta.removedPlayers);
            base.players = base.players.filter(p => !removedSet.has(p.id));
        }
        
        if (!Array.isArray(base.enemies)) {
            base.enemies = [];
        }
        if (delta.enemies) {
            const enemyMap = new Map(base.enemies.map(e => [e.id, e]));
            delta.enemies.forEach(enemyUpdate => {
                if (!enemyUpdate || enemyUpdate.id === undefined) return;
                const existing = enemyMap.get(enemyUpdate.id);
                if (existing) {
                    Object.assign(existing, this.deepClone(enemyUpdate));
                } else {
                    const clone = this.deepClone(enemyUpdate);
                    base.enemies.push(clone);
                    enemyMap.set(enemyUpdate.id, clone);
                }
            });
        }
        if (delta.removedEnemies && delta.removedEnemies.length) {
            const removedSet = new Set(delta.removedEnemies);
            base.enemies = base.enemies.filter(e => !removedSet.has(e.id));
        }
        
        if (!Array.isArray(base.groundLoot)) {
            base.groundLoot = [];
        }
        if (delta.groundLoot) {
            const lootMap = new Map(base.groundLoot.map(l => [l.id, l]));
            delta.groundLoot.forEach(lootUpdate => {
                if (!lootUpdate || lootUpdate.id === undefined) return;
                const existing = lootMap.get(lootUpdate.id);
                if (existing) {
                    Object.assign(existing, this.deepClone(lootUpdate));
                } else {
                    const clone = this.deepClone(lootUpdate);
                    base.groundLoot.push(clone);
                    lootMap.set(lootUpdate.id, clone);
                }
            });
        }
        if (delta.removedGroundLoot && delta.removedGroundLoot.length) {
            const removedSet = new Set(delta.removedGroundLoot);
            base.groundLoot = base.groundLoot.filter(l => !removedSet.has(l.id));
        }
        
        // Item pylons
        if (!Array.isArray(base.itemPylons)) {
            base.itemPylons = [];
        }
        if (delta.itemPylons) {
            const pylonMap = new Map(base.itemPylons.map(p => [p.id, p]));
            delta.itemPylons.forEach(pylonUpdate => {
                const existing = pylonMap.get(pylonUpdate.id);
                if (existing) {
                    // Update existing pylon
                    Object.assign(existing, this.deepClone(pylonUpdate));
                } else {
                    // Add new pylon
                    const clone = this.deepClone(pylonUpdate);
                    base.itemPylons.push(clone);
                    pylonMap.set(pylonUpdate.id, clone);
                }
            });
        }
        if (delta.removedItemPylons && delta.removedItemPylons.length) {
            const removedSet = new Set(delta.removedItemPylons);
            base.itemPylons = base.itemPylons.filter(p => !removedSet.has(p.id));
        }
        
        if (delta.projectiles) {
            base.projectiles = this.deepClone(delta.projectiles);
        }

        if (delta.biomeEchoes) {
            base.biomeEchoes = this.deepClone(delta.biomeEchoes);
        }
        
        if (delta.timestamp) {
            base.timestamp = delta.timestamp;
        }
        
        this.latestGameState = this.deepClone(base);
        return base;
    }

    beginClientRoomEnterTransition(roomNumber) {
        if (typeof Game === 'undefined' || !Game || typeof Game.beginRoomEnterTransition !== 'function') {
            return;
        }
        Game.beginRoomEnterTransition({
            roomNumber: roomNumber || Game.roomNumber || 1,
            onComplete: () => {
                if (typeof Game.maybeStartBossIntroForCurrentRoom === 'function') {
                    Game.maybeStartBossIntroForCurrentRoom();
                }
            }
        });
    }
    
    applySyncedRoomLayout(roomNumber, roomType, roomLayout) {
        if (!roomLayout || typeof RoomLayoutGenerator === 'undefined' || typeof Room === 'undefined') return;
        const layout = RoomLayoutGenerator.hydrateLayout(roomLayout);
        if (!layout) return;

        if (layout.hash && typeof RoomLayoutGenerator.computeLayoutHash === 'function') {
            const localHash = RoomLayoutGenerator.computeLayoutHash(layout);
            if (localHash !== layout.hash) {
                console.warn(`[Multiplayer] Room layout hash mismatch for room ${roomNumber}; using host layout (${layout.hash})`);
            }
        }

        const targetRoomNumber = roomNumber || (typeof Game !== 'undefined' ? Game.roomNumber : null) || 1;
        const existing = (typeof currentRoom !== 'undefined' && currentRoom) ? currentRoom : null;
        const sameRoom = existing && existing.number === targetRoomNumber;
        const sameLayout = sameRoom && (
            (layout.hash && existing.layoutHash === layout.hash) ||
            (existing.layout && existing.layout.hash && existing.layout.hash === layout.hash)
        );

        // Full/delta game_state always carries roomLayout once known - only re-enter on real changes
        if (sameLayout) {
            return;
        }

        let room = sameRoom ? existing : new Room(targetRoomNumber);

        room.type = roomType || layout.roomType || room.type || 'normal';
        room.number = targetRoomNumber;
        room.seed = layout.seed;
        room.biomeId = layout.biomeId;
        room.bossTheme = layout.bossTheme;
        room.layoutVersion = layout.layoutVersion;
        room.layoutHash = layout.hash;
        room.layout = layout;
        room.width = layout.width;
        room.height = layout.height;
        room.walkableGrid = layout.grid;
        room.obstacles = layout.obstacles || [];
        room.spawnZones = [layout.spawnZone];
        room.exitZones = [layout.exitZone];
        room.visualMotifs = layout.visualMotifs || [];
        room.paths = layout.paths || [];
        room.landmarks = layout.landmarks || [];
        room.encounterZones = layout.encounterZones || [];
        room.decorationSeed = layout.decorationSeed || null;
        room.decorationProfile = layout.decorationProfile || null;
        room.archetype = layout.archetype || null;
        room.entranceVariant = layout.entranceVariant || null;

        if (typeof currentRoom !== 'undefined' && currentRoom && currentRoom !== room && typeof releaseRoomRenderCaches === 'function') {
            releaseRoomRenderCaches(currentRoom);
        }
        currentRoom = room;
        if (typeof window !== 'undefined') {
            window.currentRoom = currentRoom;
        }
        if (typeof Game !== 'undefined' && typeof Game.syncInSafeRoomFromCurrentRoom === 'function') {
            Game.syncInSafeRoomFromCurrentRoom(currentRoom);
        }
        this.beginClientRoomEnterTransition(targetRoomNumber);
    }

    applyGameState(state) {
        if (!state) return;
        
        // Update game state if provided (but don't override local state changes)
        // This is informational only - actual state transitions are controlled by messages
        
        // Update room number
        if (state.roomNumber) {
            const previousRoomNumber = Game.roomNumber;
            Game.roomNumber = state.roomNumber;
            if (previousRoomNumber !== state.roomNumber && typeof Game.updateMusicForCurrentRoom === 'function') {
                Game.updateMusicForCurrentRoom();
            }
        }

        if (state.roomLayout) {
            this.applySyncedRoomLayout(state.roomNumber || Game.roomNumber || 1, state.roomType || 'normal', state.roomLayout);
        }
        
        // Sync player stats from host (authoritative for all stats)
        if (state.playerStats && typeof Game !== 'undefined' && Game.playerStats) {
            Object.keys(state.playerStats).forEach(playerId => {
                const statsData = state.playerStats[playerId];
                let stats = Game.playerStats.get(playerId);
                
                // Create stats object if it doesn't exist
                if (!stats) {
                    stats = Game.getPlayerStats(playerId);
                    console.log(`[Client] Created missing stats for ${playerId}`);
                }
                
                // Update stats from host
                stats.damageDealt = statsData.damageDealt || 0;
                stats.kills = statsData.kills || 0;
                stats.damageTaken = statsData.damageTaken || 0;
                stats.roomsCleared = statsData.roomsCleared || 0;
                stats.timeAlive = statsData.timeAlive || 0;
                // Note: lastAliveTimestamp and isAlive are managed locally
            });
        }
        
        // Update door state (only if in PLAYING state)
        if (Game.state === 'PLAYING' && typeof currentRoom !== 'undefined' && currentRoom) {
            currentRoom.doorOpen = state.doorOpen;
        }
        
        // Update door waiting state (for UI)
        if (state.playersOnDoor !== undefined) {
            Game.playersOnDoor = state.playersOnDoor;
            if (typeof Game.ensureDoorReadySet === 'function') {
                Game.doorReadyPlayers = new Set(state.playersOnDoor);
            }
        }
        if (state.totalAlivePlayers !== undefined) {
            Game.totalAlivePlayers = state.totalAlivePlayers;
        }
        
        // Update death state synchronization
        if (state.allPlayersDead !== undefined) {
            const prevAllDead = Game.allPlayersDead;
            Game.allPlayersDead = state.allPlayersDead;
            if (!prevAllDead && Game.allPlayersDead) {
                // Set death screen start time when all players die
                if (!Game.deathScreenStartTime) {
                    Game.deathScreenStartTime = Date.now();
                }
                if (!Game.endTime) {
                    Game.endTime = Date.now();
                }
                if (typeof Game.triggerGameOverMusic === 'function') {
                    Game.triggerGameOverMusic();
                }
                // Pre-emptively/fallback credit rewards on clients as soon as all players die
                if (typeof Game.creditRewards === 'function') {
                    Game.creditRewards();
                }
            }
        }
        if (state.deadPlayers !== undefined) {
            // Rebuild deadPlayers Set from array
            Game.deadPlayers = new Set(state.deadPlayers);
        }
        
        // Update remote players (works in both NEXUS and PLAYING)
        if (state.players) {
            state.players.forEach(playerData => {
                if (playerData.id === this.playerId) {
                    // Local player: apply non-transform host fields, then reconcile prediction
                    if (typeof Game !== 'undefined' && Game.player && Game.player.applyState) {
                        const skipTransform = this.predictionEnabled && !this.isHost;
                        Game.player.applyState(playerData, { skipTransform });
                    }

                    if (this.predictionEnabled && !this.isHost) {
                        this.reconcilePrediction(playerData);
                    } else if (typeof Game !== 'undefined' && Game.player) {
                        // No prediction: keep prior interpolate behavior via applyState targets
                        if (playerData.x !== undefined) {
                            Game.player.targetX = playerData.x;
                            Game.player.targetY = playerData.y;
                        }
                    }
                    
                    // Sync currency and upgrades from host (authoritative)
                    if (typeof Game !== 'undefined' && typeof SaveSystem !== 'undefined') {
                        if (playerData.currency !== undefined) {
                            const currentLocalCurrency = SaveSystem.getCurrency();
                            const flooredCurrency = Math.floor(playerData.currency);
                            if (Math.abs(currentLocalCurrency - flooredCurrency) > 0.01) {
                                SaveSystem.setCurrency(flooredCurrency);
                                Game.currentCurrency = flooredCurrency;
                                console.log(`[Client] Synced currency from host: ${flooredCurrency}`);
                            }
                        }
                        
                        if (playerData.upgrades) {
                            // Update upgrades from host
                            Object.keys(playerData.upgrades).forEach(classType => {
                                const classUpgrades = playerData.upgrades[classType];
                                if (classUpgrades) {
                                    SaveSystem.setUpgrade(classType, 'damage', classUpgrades.damage || 0);
                                    SaveSystem.setUpgrade(classType, 'defense', classUpgrades.defense || 0);
                                    SaveSystem.setUpgrade(classType, 'speed', classUpgrades.speed || 0);
                                }
                            });
                        }
                    }
                }
            });
            
            // Store remote players for rendering
            this.remotePlayers = state.players.filter(p => p.id !== this.playerId);
            if (typeof Game !== 'undefined') {
                Game.remotePlayers = this.remotePlayers;
                
                // CLIENT: Create or update shadow instances for rendering
                if (!this.isHost) {
                    // Build set of current player IDs (excluding self)
                    const currentPlayerIds = new Set();
                    state.players.forEach(playerData => {
                        if (playerData.id !== this.playerId) {
                            currentPlayerIds.add(playerData.id);
                        }
                    });
                    
                    // Remove shadow instances for players no longer in game
                    Game.remotePlayerShadowInstances.forEach((shadowInstance, playerId) => {
                        if (!currentPlayerIds.has(playerId)) {
                            Game.remotePlayerShadowInstances.delete(playerId);
                            console.log(`[Client] Removed stale shadow instance for ${playerId}`);
                        }
                    });
                    
                    // Create or update shadow instances
                    state.players.forEach(playerData => {
                        if (playerData.id !== this.playerId) {
                            // Get or create shadow instance
                            let shadowInstance = Game.remotePlayerShadowInstances.get(playerData.id);
                            const lockedClass = this.resolvePlayerClass(
                                playerData.id,
                                playerData.class || playerData.playerClass || null
                            );

                            // Never recreate mid-run from missing/wrong class chatter
                            const needsCreate = !shadowInstance;
                            const needsClassFix = shadowInstance &&
                                !this.isRunClassLocked() &&
                                playerData.class &&
                                shadowInstance.playerClass !== playerData.class;
                            const lockedMismatch = shadowInstance &&
                                this.isRunClassLocked() &&
                                shadowInstance.playerClass !== lockedClass;

                            if (needsCreate || needsClassFix || lockedMismatch) {
                                if (typeof createPlayer !== 'undefined') {
                                    shadowInstance = createPlayer(lockedClass, playerData.x, playerData.y);
                                    shadowInstance.playerId = playerData.id;
                                    shadowInstance.lobbyName = playerData.name || null;
                                    Game.remotePlayerShadowInstances.set(playerData.id, shadowInstance);
                                    console.log(`[Client] Created shadow instance for ${playerData.id} (${lockedClass})`);
                                }
                            } else if (!shadowInstance.playerId) {
                                shadowInstance.playerId = playerData.id;
                            }

                            // Keep meta class aligned with lock
                            playerData.class = lockedClass;
                            playerData.playerClass = lockedClass;
                            
                            // Update shadow instance with host state
                            if (shadowInstance && Game.updateShadowInstance) {
                                Game.updateShadowInstance(shadowInstance, playerData);
                            }
                        }
                    });
                }
                
                // Verify remote player classes (prefer run lock)
                this.remotePlayers.forEach(rp => {
                    const locked = this.getRunClass(rp.id, rp.class || rp.playerClass);
                    if (locked) {
                        rp.class = locked;
                    } else if (!rp.class) {
                        console.warn(`[Client] Remote player ${rp.id} missing class! Using square as fallback.`);
                        rp.class = 'square';
                    }
                });
            }
        }
        
        // Only update enemies/projectiles/loot if in PLAYING or preparing the room
        if (Game.state === 'PLAYING' || Game.state === 'ENTERING_ROOM') {
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
                state.enemies.forEach(enemyUpdate => {
                    let enemy = Game.enemies.find(e => e.id === enemyUpdate.id);
                    
                    // Add timestamp from game state to enemy data for proper interpolation
                    if (!enemyUpdate.timestamp && state.timestamp) {
                        enemyUpdate.timestamp = state.timestamp;
                    }
                    if (!enemyUpdate.serverSendTime && state.serverSendTime) {
                        enemyUpdate.serverSendTime = state.serverSendTime;
                    }
                    
                    if (!enemy) {
                        // New enemy from host - create it from data
                        if (typeof createEnemyFromData !== 'undefined') {
                            enemy = createEnemyFromData(enemyUpdate);
                            if (enemy) {
                                Game.enemies.push(enemy);
                                console.log(`[Client] Created enemy ${enemyUpdate.id} (${enemyUpdate.shape}) from host data`);
                                // Apply full serialized state (boss attacks/phases/hazards, telegraphs, etc.)
                                if (enemy.applyState) {
                                    enemy.applyState(enemyUpdate);
                                }
                            }
                        }
                        return;
                    }
                    
                    // Let the enemy apply its own state! (clean architecture)
                    if (enemy.applyState) {
                        enemy.applyState(enemyUpdate);
                    }
                });
            }
            
            // Update projectiles with interpolation support - ID-based matching
            if (state.projectiles) {
                // Initialize interpolation manager if needed
                if (typeof initInterpolation !== 'undefined' && !interpolationManager) {
                    interpolationManager = initInterpolation();
                }
                
                // Build map of existing projectiles by ID
                const projectileMap = new Map();
                Game.projectiles.forEach(proj => {
                    if (proj.id) {
                        projectileMap.set(proj.id, proj);
                    }
                });
                
                // Build set of host projectile IDs
                const hostProjectileIds = new Set(state.projectiles.map(p => p.id).filter(id => id));
                
                // Get timestamp from game state for interpolation
                const stateTimestamp = state.timestamp || state.serverSendTime || Date.now();
                
                // Update projectiles from host state - match by ID
                const newProjectiles = [];
                state.projectiles.forEach(hostProj => {
                    if (!hostProj.id) {
                        if (typeof generateProjectileId === 'function') {
                            hostProj.id = generateProjectileId();
                        } else {
                            hostProj.id = `proj-fallback-${Date.now()}`;
                        }
                    }
                    
                    let matchingProj = projectileMap.get(hostProj.id);
                    
                    if (matchingProj) {
                        // Update existing projectile - use interpolation for smooth updates
                        // Add to interpolation buffer for smooth movement
                        if (typeof interpolationManager !== 'undefined' && interpolationManager) {
                            interpolationManager.addEntityState(hostProj.id, stateTimestamp, {
                                x: hostProj.x,
                                y: hostProj.y,
                                vx: hostProj.vx,
                                vy: hostProj.vy,
                                timestamp: stateTimestamp
                            });
                        }
                        
                        // Update targets for interpolation (don't snap immediately)
                        matchingProj.targetX = hostProj.x;
                        matchingProj.targetY = hostProj.y;
                        matchingProj.color = hostProj.color;
                        matchingProj.trailLength = hostProj.trailLength;
                        matchingProj.trailColor = hostProj.trailColor;
                        matchingProj.baseAngle = hostProj.baseAngle;
                        matchingProj.baseSpeed = hostProj.baseSpeed;
                        matchingProj.waveAmplitude = hostProj.waveAmplitude;
                        matchingProj.waveFrequency = hostProj.waveFrequency;
                        matchingProj.wavePhase = hostProj.wavePhase;
                        matchingProj.waveClock = hostProj.waveClock;
                        if (hostProj.playerId != null) matchingProj.playerId = hostProj.playerId;
                        if (hostProj.ownerId != null) matchingProj.ownerId = hostProj.ownerId;
                        if (hostProj.activateAfter !== undefined) matchingProj.activateAfter = hostProj.activateAfter;
                        if (hostProj.isParallelSecond !== undefined) matchingProj.isParallelSecond = !!hostProj.isParallelSecond;
                        if (hostProj.isParallelPrimary !== undefined) matchingProj.isParallelPrimary = !!hostProj.isParallelPrimary;
                        
                        // Only update velocity if it's significantly different (prevent rewinds)
                        const currentSpeed = Math.sqrt(matchingProj.vx * matchingProj.vx + matchingProj.vy * matchingProj.vy);
                        const hostSpeed = Math.sqrt(hostProj.vx * hostProj.vx + hostProj.vy * hostProj.vy);
                        const speedDiff = Math.abs(currentSpeed - hostSpeed);
                        
                        // Calculate direction difference to detect backwards movement
                        const currentDir = currentSpeed > 0 ? {
                            x: matchingProj.vx / currentSpeed,
                            y: matchingProj.vy / currentSpeed
                        } : { x: 0, y: 0 };
                        const hostDir = hostSpeed > 0 ? {
                            x: hostProj.vx / hostSpeed,
                            y: hostProj.vy / hostSpeed
                        } : { x: 0, y: 0 };
                        const dotProduct = currentDir.x * hostDir.x + currentDir.y * hostDir.y;
                        const directionSimilarity = dotProduct; // 1 = same direction, -1 = opposite
                        
                        // Only update velocity if:
                        // 1. Speed difference is significant (>10% or >50px/s), AND
                        // 2. Direction is similar (not backwards) - dot product > 0.5 means similar direction
                        if ((speedDiff > currentSpeed * 0.1 || speedDiff > 50) && directionSimilarity > 0.5) {
                            // Smooth velocity transition to prevent sudden direction changes
                            const velocityLerp = 0.2; // Gradual velocity update (slower for projectiles)
                            matchingProj.vx = matchingProj.vx * (1 - velocityLerp) + hostProj.vx * velocityLerp;
                            matchingProj.vy = matchingProj.vy * (1 - velocityLerp) + hostProj.vy * velocityLerp;
                        } else if (directionSimilarity <= 0.5 && speedDiff > 20) {
                            // Direction changed significantly - might be a collision or special case
                            // Only update if speed difference is large (likely a real change, not desync)
                            if (speedDiff > 100) {
                                // Major change - update velocity but very gradually
                                const velocityLerp = 0.1; // Very gradual for direction changes
                                matchingProj.vx = matchingProj.vx * (1 - velocityLerp) + hostProj.vx * velocityLerp;
                                matchingProj.vy = matchingProj.vy * (1 - velocityLerp) + hostProj.vy * velocityLerp;
                            }
                            // Otherwise, don't update velocity - likely desync, let position correction handle it
                        }
                        
                        matchingProj.lastUpdateTime = Date.now();
                        // Preserve other properties that might have been modified locally
                        newProjectiles.push(matchingProj);
                    } else {
                        // New projectile - create with interpolation target
                        const newProj = {
                            ...hostProj,
                            targetX: hostProj.x,
                            targetY: hostProj.y,
                            lastUpdateTime: Date.now()
                        };
                        
                        // Add to interpolation buffer
                        if (typeof interpolationManager !== 'undefined' && interpolationManager) {
                            interpolationManager.addEntityState(hostProj.id, stateTimestamp, {
                                x: hostProj.x,
                                y: hostProj.y,
                                vx: hostProj.vx,
                                vy: hostProj.vy,
                                timestamp: stateTimestamp
                            });
                        }
                        
                        newProjectiles.push(newProj);
                    }
                });
                
                // Remove projectiles that no longer exist on host (by ID)
                // Clean up interpolation buffers for removed projectiles
                Game.projectiles.forEach(proj => {
                    if (proj.id && !hostProjectileIds.has(proj.id)) {
                        if (typeof interpolationManager !== 'undefined' && interpolationManager) {
                            interpolationManager.removeEntity(proj.id);
                        }
                    }
                });
                
                Game.projectiles = (typeof createProjectileList === 'function')
                    ? createProjectileList(newProjectiles)
                    : newProjectiles;
            }

            // Biome echo VFX (host-authoritative; clients display only)
            if (state.biomeEchoes !== undefined
                && typeof BiomeEnemyMods !== 'undefined'
                && typeof BiomeEnemyMods.applyEchoesFromHost === 'function') {
                BiomeEnemyMods.applyEchoesFromHost(state.biomeEchoes);
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
                        const gear = this.normalizeGroundLootFromNetwork(lootData);
                        groundLoot.push(gear);
                        console.log(`[Client] New loot ${gear.id} (${gear.tier} ${gear.slot}) with ${gear.affixes.length} affixes`);
                    } else {
                        // Update existing (position and properties might change)
                        const normalized = this.normalizeGroundLootFromNetwork({
                            ...existingGear,
                            ...lootData
                        });
                        Object.assign(existingGear, normalized);
                    }
                });
            }
            
            // Sync item pylons (clients only - host is authoritative)
            if (state.itemPylons !== undefined && !this.isHost) {
                // Ensure Game.itemPylons exists
                if (!Game.itemPylons) {
                    Game.itemPylons = [];
                    console.log('[Client] Initialized Game.itemPylons array');
                }
                
                if (Array.isArray(state.itemPylons) && state.itemPylons.length > 0) {
                    console.log(`[Client] Syncing ${state.itemPylons.length} pylons from host`);
                }
                
                const hostPylonIds = new Set(state.itemPylons.map(p => p.id));
                
                // Remove pylons that no longer exist on host
                for (let i = Game.itemPylons.length - 1; i >= 0; i--) {
                    if (!hostPylonIds.has(Game.itemPylons[i].id)) {
                        Game.itemPylons.splice(i, 1);
                    }
                }
                
                // Add or update pylons by ID
                state.itemPylons.forEach(pylonData => {
                    let existingPylon = Game.itemPylons.find(p => p.id === pylonData.id);
                    
                    if (!existingPylon) {
                        // New pylon from host - create it
                        // Each player will get a random item of the pylon's rarity
                        const pylon = {
                            id: pylonData.id,
                            x: pylonData.x,
                            y: pylonData.y,
                            size: 20,
                            pulse: 0,
                            rarity: pylonData.rarity || 'common', // Store the rarity
                            interactedPlayers: pylonData.interactedPlayers ? pylonData.interactedPlayers.slice() : [],
                            disappearing: pylonData.disappearing || false,
                            disappearProgress: pylonData.disappearProgress || 0
                        };
                        
                        Game.itemPylons.push(pylon);
                        console.log(`[Client] New ${pylon.rarity} rarity pylon ${pylon.id} at (${pylon.x.toFixed(1)}, ${pylon.y.toFixed(1)}) - each player will get a random ${pylon.rarity} item`);
                    } else {
                        // Update existing pylon (sync interaction state and position)
                        existingPylon.x = pylonData.x;
                        existingPylon.y = pylonData.y;
                        existingPylon.rarity = pylonData.rarity || existingPylon.rarity || 'common';
                        existingPylon.interactedPlayers = pylonData.interactedPlayers ? pylonData.interactedPlayers.slice() : [];
                        existingPylon.disappearing = pylonData.disappearing || false;
                        existingPylon.disappearProgress = pylonData.disappearProgress || 0;
                    }
                });
            }

            // Sync Surge Arena specific pickups, orbs, and combos
            if (state.playerCombos && !this.isHost) {
                Game.playerCombos = state.playerCombos;
                if (typeof SurgeArenaRules !== 'undefined' && SurgeArenaRules.syncComboFromNetwork) {
                    Object.keys(state.playerCombos).forEach(playerId => {
                        SurgeArenaRules.syncComboFromNetwork(playerId, state.playerCombos[playerId]);
                    });
                }
            }
            if (state.styleCrashPickups !== undefined && !this.isHost) {
                Game.styleCrashPickups = state.styleCrashPickups;
            }
            if (state.styleHealOrbs !== undefined && !this.isHost) {
                Game.styleHealOrbs = state.styleHealOrbs;
            }
        }

        if (typeof Game !== 'undefined' && typeof Game.updateMusicForCurrentRoom === 'function') {
            Game.updateMusicForCurrentRoom();
        }
    }
    
    // Update remote player (host only)
    updateRemotePlayer(playerState) {
        if (!playerState || !playerState.id) return;

        const lockedClass = this.resolvePlayerClass(playerState.id, playerState.class || playerState.playerClass || null);
        if (lockedClass) {
            playerState.class = lockedClass;
            playerState.playerClass = lockedClass;
        }

        // Find or create remote player in our list
        let remotePlayer = this.remotePlayers.find(p => p.id === playerState.id);
        
        if (!remotePlayer) {
            this.remotePlayers.push(playerState);
        } else {
            // Update existing player
            Object.assign(remotePlayer, playerState);
            if (lockedClass) remotePlayer.class = lockedClass;
        }
        
        // Also update in players list for lobby display
        const playerInList = this.players.find(p => p.id === playerState.id);
        if (playerInList) {
            Object.assign(playerInList, playerState);
            if (lockedClass) playerInList.class = lockedClass;
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
                class: this.resolvePlayerClass(player.id, player.class || (existing && existing.class) || 'square'),
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
    
    handlePlayerDisconnected(data) {
        if (!data || !data.playerId) return;
        const playerId = data.playerId;
        console.log(`[Multiplayer] Player ${playerId} disconnected (kick-only lobby removal)`);

        if (data.players) {
            this.players = data.players;
            this.updateRemotePlayers();
            if (typeof Game !== 'undefined') {
                Game.remotePlayers = this.remotePlayers;
            }
            if (typeof window !== 'undefined' && window.UIBus && UIBus.emit) {
                UIBus.emit('mp:lobby:players', { players: (this.players || []).slice() });
            }
        } else {
            const p = (this.players || []).find(pl => pl.id === playerId);
            if (p) p.disconnected = true;
        }

        if (this.isHost && typeof Game !== 'undefined' && typeof Game.handlePlayerDisconnectedMidRun === 'function') {
            Game.handlePlayerDisconnectedMidRun(playerId);
        }
    }

    handlePlayerReconnected(data) {
        if (!data) return;
        if (data.players) {
            this.handlePlayerListUpdate({ players: data.players });
            return;
        }
        if (data.playerId && this.isHost && typeof Game !== 'undefined' &&
            typeof Game.handlePlayerReconnectedMidRun === 'function') {
            Game.handlePlayerReconnectedMidRun(data.playerId);
        }
    }
    
    handleLobbyMigrating(data) {
        const code = (data && data.lobbyCode) || this.lobbyCode;
        if (!code) return;
        
        console.log('[Multiplayer] Server rebalancing, reconnecting...');
        this._migrating = true;
        this.lobbyCode = code;
        this.reconnectAttempts = 0;
        
        this.connected = false;
        this.connecting = false;
        this.stopHeartbeat();
        
        if (this.ws) {
            this.ws.onclose = null;
            if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
                this.ws.close();
            }
            this.ws = null;
        }
        
        const localPlayer = (this.players || []).find(p => p.id === this.playerId);
        const playerName = localPlayer ? localPlayer.name : 'Player';
        const playerClass = (typeof Game !== 'undefined' && Game.selectedClass) || 'square';
        
        setTimeout(() => {
            this.connect().then(() => {
                this._migrating = false;
                return this.joinLobby(code, playerName, playerClass);
            }).catch(err => {
                this._migrating = false;
                console.error('[Multiplayer] Migration reconnect failed:', err);
                this.handleDisconnect();
            });
        }, MultiplayerConfig.RECONNECT_DELAY);
    }
    
    // Handle disconnect
    handleDisconnect() {
        if (this._migrating) return;
        
        // Try to reconnect
        if (this.lobbyCode && this.reconnectAttempts < MultiplayerConfig.RECONNECT_ATTEMPTS) {
            this.reconnectAttempts++;
            console.log(`[Multiplayer] Reconnecting... (${this.reconnectAttempts}/${MultiplayerConfig.RECONNECT_ATTEMPTS})`);
            
            const localPlayer = (this.players || []).find(p => p.id === this.playerId);
            const playerName = localPlayer ? localPlayer.name : 'Player';
            const playerClass = (typeof Game !== 'undefined' && Game.selectedClass) || 'square';
            const code = this.lobbyCode;
            
            setTimeout(() => {
                this.connect().then(() => {
                    return this.joinLobby(code, playerName, playerClass);
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
            Game.multiplayerEnabled = false;
        }

        if (typeof Onboarding !== 'undefined' && Onboarding.resumeFromMultiplayer) {
            Onboarding.resumeFromMultiplayer();
        }
        
        this.stopHeartbeat();
        
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        
        this.connected = false;
        this.connecting = false;

        this.lastSentGameState = null;
        this.latestGameState = null;
        this.lastFullGameStateSentAt = 0;
        this.lastProjectileSnapshot = null;
        this.lastPlayerStateSnapshot = null;
        this.playerStateBuffer = [];
        this.playerLastUpdateTimes.clear();
        this.clearRunClassLocks();
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
    // Ensure it's on window for global access
    if (typeof window !== 'undefined') {
        window.multiplayerManager = multiplayerManager;
    }
    return multiplayerManager;
}

// Export for global access
if (typeof window !== 'undefined') {
    window.MultiplayerManager = MultiplayerManager;
    window.multiplayerManager = null;
    window.initMultiplayer = initMultiplayer;
}

