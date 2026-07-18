const WebSocket = require('ws');
const os = require('os');
const config = require('./config');
const { LobbyDirectory } = require('./redis-directory');

const ALLOWED_MESSAGE_TYPES = new Set([
    'create_lobby',
    'join_lobby',
    'leave_lobby',
    'game_state',
    'player_state',
    'player_state_batch',
    'game_start',
    'return_to_nexus',
    'room_transition',
    'enemy_damaged',
    'enemy_state_update',
    'player_damaged',
    'loot_pickup',
    'gear_dropped',
    'item_pylon_interact',
    'item_pylon_interact_request',
    'upgrade_purchase',
    'upgrade_purchased',
    'currency_update',
    'damage_number',
    'combat_fx',
    'resync_request',
    'player_leveled_up',
    'final_stats',
    'revive_players',
    'shards_update',
    'heartbeat',
    'kick_player',
    'update_player_name'
]);

if (process.env.ALLOW_TEST_MIGRATION === 'true') {
    ALLOWED_MESSAGE_TYPES.add('test_migrate_lobby');
}

// Worker process - handles WebSocket connections and lobbies
class WorkerProcess {
    constructor() {
        this.wss = null;
        this.lobbies = new Map(); // code -> lobby object
        this.playerToLobby = new Map(); // ws -> lobby code
        this.directory = null;
        this.endpointInfo = config.resolveWorkerEndpoint();
        this.metrics = {
            connections: 0,
            messagesPerSecond: 0,
            messageCount: 0,
            lastMessageReset: Date.now()
        };
        this.eventLoopStart = Date.now();
        
        // Pending lobby lookup requests
        this.pendingLookups = new Map(); // requestId -> callback
        this.lookupRequestId = 0;

        this.telemetry = {
            messageStats: new Map(),
            rawBytes: 0,
            lastLog: Date.now()
        };
    }
    
    async start() {
        const cluster = require('cluster');
        const workerId = cluster.worker ? cluster.worker.id : 'standalone';

        if (config.redis.enabled) {
            this.directory = new LobbyDirectory({
                ttlSeconds: config.redis.lobbyTtlSeconds
            });
            await this.directory.connect({
                host: config.redis.host,
                port: config.redis.port,
                password: config.redis.password
            });
            console.log(
                `[Worker ${workerId}] Redis directory connected at ${config.redis.host}:${config.redis.port}`
            );
        }
        
        // Create WebSocket server - bind to 0.0.0.0 to accept connections from any network interface
        this.wss = new WebSocket.Server({ 
            port: this.endpointInfo.workerPort,
            host: config.host,
            maxPayload: config.limits.maxPayloadBytes
        });
        
        console.log(
            `[Worker ${workerId}] Started on port ${this.endpointInfo.workerPort} endpoint=${this.endpointInfo.endpoint}`
        );
        
        this.wss.on('connection', (ws) => this.handleConnection(ws));
        
        // Setup IPC handlers
        if (process.send) {
            process.on('message', (msg) => this.handleMasterMessage(msg));
        }
        
        // Start health monitoring
        this.startHealthMonitoring();
        
        // Start lobby cleanup
        this.startLobbyCleanup();

        // Start telemetry logging
        this.startTelemetryReporting();

        if (this.directory) {
            this.startDirectoryHeartbeat();
        }
    }

    startDirectoryHeartbeat() {
        setInterval(() => {
            for (const code of this.lobbies.keys()) {
                this.directory.refresh(code).catch(() => {});
            }
        }, Math.max(5000, Math.floor((config.redis.lobbyTtlSeconds * 1000) / 3)));
    }
    
    handleConnection(ws) {
        this.metrics.connections++;
        ws._msgWindowStart = Date.now();
        ws._msgWindowCount = 0;
        
        if (config.logging.level === 'debug') {
            console.log(`[Worker ${this.getWorkerId()}] New client connected (total: ${this.metrics.connections})`);
        }
        
        ws.on('message', (message) => {
            this.metrics.messageCount++;

            const now = Date.now();
            if (now - ws._msgWindowStart >= 1000) {
                ws._msgWindowStart = now;
                ws._msgWindowCount = 0;
            }
            ws._msgWindowCount += 1;
            if (ws._msgWindowCount > config.limits.maxMessagesPerSocketPerSecond) {
                console.warn(`[Worker ${this.getWorkerId()}] Rate limit exceeded; closing socket`);
                ws.close(1008, 'Rate limit exceeded');
                return;
            }
            
            const rawSize = typeof message === 'string'
                ? Buffer.byteLength(message, 'utf8')
                : (message ? message.length : 0);
            if (!Number.isNaN(rawSize)) {
                this.telemetry.rawBytes += rawSize;
            }

            try {
                const msg = JSON.parse(message.toString());
                if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string') {
                    return;
                }
                if (!ALLOWED_MESSAGE_TYPES.has(msg.type)) {
                    console.warn('[Warning] Unknown message type:', msg.type);
                    return;
                }
                this.handleMessage(ws, msg, rawSize);
            } catch (err) {
                console.error('[Error] Failed to parse message:', err);
            }
        });
        
        ws.on('close', () => {
            this.metrics.connections--;
            this.handleDisconnect(ws);
        });
        
        ws.on('error', (err) => {
            console.error('[Error] WebSocket error:', err);
        });
    }
    
    handleMessage(ws, msg, rawSize = 0) {
        const { type, data } = msg;

        this.recordMessageStat(type, rawSize);
        
        switch (type) {
            case 'create_lobby':
                this.handleCreateLobby(ws, data);
                break;
            case 'join_lobby':
                this.handleJoinLobby(ws, data);
                break;
            case 'leave_lobby':
                this.handleLeaveLobby(ws);
                break;
            case 'game_state':
                this.handleGameState(ws, data);
                break;
            case 'player_state':
                this.handlePlayerState(ws, data);
                break;
            case 'player_state_batch':
                this.handlePlayerStateBatch(ws, data);
                break;
            case 'game_start':
                this.handleGameStart(ws, data);
                break;
            case 'return_to_nexus':
                this.handleReturnToNexus(ws, data);
                break;
            case 'room_transition':
                this.handleRoomTransition(ws, data);
                break;
            case 'enemy_damaged':
                this.handleEnemyDamaged(ws, data);
                break;
            case 'enemy_state_update':
                this.handleEnemyStateUpdate(ws, data);
                break;
            case 'player_damaged':
                this.handlePlayerDamaged(ws, data);
                break;
            case 'loot_pickup':
                this.handleLootPickup(ws, data);
                break;
            case 'gear_dropped':
                this.handleGearDropped(ws, data);
                break;
            case 'item_pylon_interact':
                this.handleItemPylonInteract(ws, data);
                break;
            case 'item_pylon_interact_request':
                this.handleItemPylonInteractRequest(ws, data);
                break;
            case 'upgrade_purchase':
                this.handleUpgradePurchase(ws, data);
                break;
            case 'upgrade_purchased':
                this.handleUpgradePurchased(ws, data);
                break;
            case 'currency_update':
                this.handleCurrencyUpdate(ws, data);
                break;
            case 'damage_number':
                this.handleDamageNumber(ws, data);
                break;
            case 'combat_fx':
                this.handleCombatFx(ws, data);
                break;
            case 'resync_request':
                this.handleResyncRequest(ws, data);
                break;
            case 'player_leveled_up':
                this.handlePlayerLeveledUp(ws, data);
                break;
            case 'final_stats':
                this.handleFinalStats(ws, data);
                break;
            case 'revive_players':
                this.handleRevivePlayers(ws, data);
                break;
            case 'shards_update':
                this.handleShardsUpdate(ws, data);
                break;
            case 'heartbeat':
                ws.send(JSON.stringify({ type: 'heartbeat_ack' }));
                break;
            case 'kick_player':
                this.handleKickPlayer(ws, data);
                break;
            case 'update_player_name':
                this.handleUpdatePlayerName(ws, data);
                break;
            case 'test_migrate_lobby':
                this.handleTestMigrateLobby(ws, data);
                break;
            default:
                console.warn('[Warning] Unknown message type:', type);
        }
    }
    
    serializeLobbyPlayers(lobby) {
        return lobby.players.map(p => ({
            id: p.id,
            name: p.name,
            class: p.class,
            ready: p.ready,
            currency: p.currency,
            upgrades: p.upgrades,
            safeRoomMeta: p.safeRoomMeta || {},
            disconnected: !!p.disconnected
        }));
    }

    async handleCreateLobby(ws, data) {
        const playerId = this.generatePlayerId();
        const persistentPlayerId = data.persistentPlayerId || null;
        const playerName = (data.playerName && data.playerName.trim()) ? data.playerName.trim().slice(0, 20) : 'Player 1';

        let code = null;
        for (let attempt = 0; attempt < 12; attempt++) {
            const candidate = this.generateLobbyCode();
            if (this.lobbies.has(candidate)) continue;
            if (this.directory) {
                const claimed = await this.directory.claim(candidate, {
                    serverId: config.server.id,
                    workerId: this.getWorkerId(),
                    endpoint: this.endpointInfo.endpoint,
                    createdAt: Date.now()
                });
                if (!claimed) continue;
            }
            code = candidate;
            break;
        }

        if (!code) {
            ws.send(JSON.stringify({
                type: 'lobby_error',
                data: { message: 'Unable to allocate lobby code' }
            }));
            return;
        }
        
        const lobby = {
            code,
            host: ws,
            hostPlayerId: playerId,
            players: [{
                ws,
                id: playerId,
                persistentPlayerId: persistentPlayerId,
                name: playerName,
                class: data.class || 'square',
                ready: false,
                currency: data.currency || 0,
                upgrades: data.upgrades || {
                    square: { damage: 0, defense: 0, speed: 0 },
                    triangle: { damage: 0, defense: 0, speed: 0 },
                    pentagon: { damage: 0, defense: 0, speed: 0 },
                    hexagon: { damage: 0, defense: 0, speed: 0 }
                },
                safeRoomMeta: data.safeRoomMeta || {}
            }],
            maxPlayers: config.lobby.maxPlayers,
            createdAt: Date.now()
        };
        
        this.lobbies.set(code, lobby);
        this.playerToLobby.set(ws, code);
        
        this.notifyMaster('lobby_created', {
            code,
            endpoint: this.endpointInfo.endpoint
        });
        
        console.log(`[Worker ${this.getWorkerId()}] Created lobby ${code} by ${playerName}`);
        
        ws.send(JSON.stringify({
            type: 'lobby_created',
            data: {
                code,
                playerId,
                isHost: true,
                players: this.serializeLobbyPlayers(lobby),
                endpoint: this.endpointInfo.endpoint
            }
        }));
    }
    
    async handleJoinLobby(ws, data) {
        const { playerName, playerClass, persistentPlayerId } = data;
        const code = String(data.code || '').toUpperCase();

        if (this.directory) {
            const ownership = await this.directory.get(code);
            if (!ownership) {
                ws.send(JSON.stringify({
                    type: 'lobby_error',
                    data: { message: 'Lobby not found' }
                }));
                return;
            }
            if (ownership.endpoint && ownership.endpoint !== this.endpointInfo.endpoint) {
                ws.send(JSON.stringify({
                    type: 'redirect',
                    data: {
                        url: ownership.endpoint,
                        code,
                        reason: 'lobby_owner'
                    }
                }));
                try { ws.close(1000, 'Redirect to lobby owner'); } catch (_e) {}
                return;
            }
        }
        
        // Check if lobby exists locally
        let lobby = this.lobbies.get(code);
        
        if (!lobby) {
            if (this.directory) {
                ws.send(JSON.stringify({
                    type: 'lobby_error',
                    data: { message: 'Lobby not found on owner worker' }
                }));
                return;
            }
            // Lobby might be on another worker, check with master
            this.lookupLobby(code, (found, workerId) => {
                if (!found) {
                    ws.send(JSON.stringify({
                        type: 'lobby_error',
                        data: { message: 'Lobby not found' }
                    }));
                } else if (String(workerId) !== String(this.getWorkerId())) {
                    ws.send(JSON.stringify({
                        type: 'lobby_error',
                        data: { message: 'Lobby on different server, please retry' }
                    }));
                }
            });
            return;
        }
        
        // Check if player with persistent ID already exists (reconnection)
        let existingPlayerIndex = -1;
        let playerId;
        let isReconnection = false;
        
        if (persistentPlayerId) {
            existingPlayerIndex = lobby.players.findIndex(p => p.persistentPlayerId === persistentPlayerId);
            if (existingPlayerIndex !== -1) {
                // Player reconnecting - reuse existing player entry
                const existingPlayer = lobby.players[existingPlayerIndex];
                playerId = existingPlayer.id;
                isReconnection = true;
                
                // Remove old disconnected player entry (cleanup)
                const oldWs = existingPlayer.ws;
                if (oldWs && oldWs !== ws) {
                    // Close old connection if still open
                    if (oldWs.readyState === WebSocket.OPEN) {
                        oldWs.close(1000, 'Reconnected from another session');
                    }
                    this.playerToLobby.delete(oldWs);
                }
                
                // Update player entry with new WebSocket and data
                existingPlayer.ws = ws;
                existingPlayer.disconnected = false;
                if (existingPlayer.disconnectTimer) {
                    clearTimeout(existingPlayer.disconnectTimer);
                    existingPlayer.disconnectTimer = null;
                }
                // Restore host connection if this player is the designated host
                if (lobby.hostPlayerId === existingPlayer.id) {
                    lobby.host = ws;
                }
                // Update name if provided, otherwise keep existing name
                if (playerName && playerName.trim()) {
                    existingPlayer.name = playerName.trim().slice(0, 20);
                }
                existingPlayer.class = playerClass || existingPlayer.class;
                existingPlayer.currency = data.currency !== undefined ? data.currency : existingPlayer.currency;
                existingPlayer.upgrades = data.upgrades || existingPlayer.upgrades;
                if (data.safeRoomMeta) existingPlayer.safeRoomMeta = data.safeRoomMeta;
                // Keep ready state as-is (don't reset on reconnect)
                
                console.log(`[Worker ${this.getWorkerId()}] ${existingPlayer.name} reconnected to lobby ${code} (persistent ID: ${persistentPlayerId})`);
            }
        }
        
        // If not a reconnection, create new player
        if (!isReconnection) {
            // Check lobby capacity (excluding reconnecting player)
            if (lobby.players.length >= lobby.maxPlayers) {
                ws.send(JSON.stringify({
                    type: 'lobby_error',
                    data: { message: 'Lobby is full' }
                }));
                return;
            }
            
            playerId = this.generatePlayerId();
            // Use provided name if set, otherwise use player number
            const newPlayerName = (playerName && playerName.trim()) ? playerName.trim().slice(0, 20) : `Player ${lobby.players.length + 1}`;
            const player = {
                ws,
                id: playerId,
                persistentPlayerId: persistentPlayerId || null, // Store persistent ID for future reconnections
                name: newPlayerName,
                class: playerClass || 'square',
                ready: false,
                currency: data.currency || 0,
                upgrades: data.upgrades || {
                    square: { damage: 0, defense: 0, speed: 0 },
                    triangle: { damage: 0, defense: 0, speed: 0 },
                    pentagon: { damage: 0, defense: 0, speed: 0 },
                    hexagon: { damage: 0, defense: 0, speed: 0 }
                },
                safeRoomMeta: data.safeRoomMeta || {}
            };
            
            lobby.players.push(player);
            console.log(`[Worker ${this.getWorkerId()}] ${player.name} joined lobby ${code} (${lobby.players.length}/${lobby.maxPlayers})`);
        }
        
        this.playerToLobby.set(ws, code);
        
        // Send confirmation to joining/reconnecting player
        ws.send(JSON.stringify({
            type: 'lobby_joined',
            data: {
                code,
                playerId,
                isHost: isReconnection ? (lobby.hostPlayerId === playerId) : false,
                isReconnection: isReconnection,
                players: this.serializeLobbyPlayers(lobby)
            }
        }));
        
        // Only notify other players if this is a new join (not a reconnection)
        // On reconnection, we don't want to trigger player_joined events
        if (!isReconnection) {
            // Notify all other players in lobby
            this.broadcastToLobby(lobby, {
                type: 'player_joined',
                data: {
                    player: {
                        id: playerId,
                        name: playerName || `Player ${lobby.players.length}`,
                        class: playerClass || 'square',
                        ready: false,
                        currency: data.currency || 0,
                        upgrades: data.upgrades || {
                            square: { damage: 0, defense: 0, speed: 0 },
                            triangle: { damage: 0, defense: 0, speed: 0 },
                            pentagon: { damage: 0, defense: 0, speed: 0 },
                            hexagon: { damage: 0, defense: 0, speed: 0 }
                        },
                        safeRoomMeta: data.safeRoomMeta || {}
                    },
                    players: this.serializeLobbyPlayers(lobby)
                }
            }, ws);
        } else {
            // Reconnection: roster refresh + explicit signal so host restores run snapshot
            const roster = this.serializeLobbyPlayers(lobby);
            this.broadcastToLobby(lobby, {
                type: 'player_list_update',
                data: { players: roster }
            });
            this.broadcastToLobby(lobby, {
                type: 'player_reconnected',
                data: { playerId, players: roster }
            }, ws);
        }
    }
    
    handleUpdatePlayerName(ws, data) {
        const code = this.playerToLobby.get(ws);
        if (!code) return;
        
        const lobby = this.lobbies.get(code);
        if (!lobby) return;
        
        const player = lobby.players.find(p => p.ws === ws);
        if (!player) return;
        
        // Update player name - if name is provided and not empty, use it; otherwise use player number
        const newName = data.name && data.name.trim() ? data.name.trim().slice(0, 20) : null;
        const playerIndex = lobby.players.indexOf(player);
        player.name = newName || `Player ${playerIndex + 1}`;
        
        // Broadcast updated player list to all players (including the one who updated)
        this.broadcastToLobby(lobby, {
            type: 'player_list_update',
            data: {
                players: this.serializeLobbyPlayers(lobby)
            }
        });
        
        console.log(`[Worker ${this.getWorkerId()}] Player ${player.id} updated name to "${player.name}" in lobby ${code}`);
    }
    
    handleKickPlayer(ws, data) {
        const code = this.playerToLobby.get(ws);
        if (!code) return;
        
        const lobby = this.lobbies.get(code);
        if (!lobby || lobby.host !== ws) return; // Only host can kick
        
        const { playerId } = data;
        if (!playerId) return;
        
        // Find the player to kick
        const playerToKick = lobby.players.find(p => p.id === playerId);
        if (!playerToKick) return;
        
        // Don't allow host to kick themselves
        if (playerToKick.ws === ws) return;
        
        // Send kick message to the player being kicked
        if (playerToKick.ws && playerToKick.ws.readyState === WebSocket.OPEN) {
            playerToKick.ws.send(JSON.stringify({
                type: 'kicked_from_lobby',
                data: { reason: 'Kicked by host' }
            }));
        }
        
        // Remove player from lobby
        if (playerToKick.disconnectTimer) {
            clearTimeout(playerToKick.disconnectTimer);
            playerToKick.disconnectTimer = null;
        }
        
        const playerIndex = lobby.players.findIndex(p => p.id === playerId);
        if (playerIndex !== -1) {
            if (playerToKick.ws) {
                this.playerToLobby.delete(playerToKick.ws);
                
                if (playerToKick.ws.readyState === WebSocket.OPEN) {
                    playerToKick.ws.close();
                }
            }
            console.log(`[Worker ${this.getWorkerId()}] Player ${playerId} kicked from lobby ${code} by host`);
            this.removePlayerFromLobby(lobby, playerToKick);
        }
    }
    
    handleLeaveLobby(ws) {
        const code = this.playerToLobby.get(ws);
        if (!code) return;
        
        const lobby = this.lobbies.get(code);
        if (!lobby) return;
        
        const player = lobby.players.find(p => p.ws === ws);
        if (!player) return;
        
        this.removePlayerFromLobby(lobby, player);
    }
    
    handleDisconnect(ws) {
        const code = this.playerToLobby.get(ws);
        if (!code) {
            return;
        }
        
        const lobby = this.lobbies.get(code);
        if (!lobby) {
            this.playerToLobby.delete(ws);
            return;
        }
        
        const player = lobby.players.find(p => p.ws === ws);
        if (!player) {
            this.playerToLobby.delete(ws);
            return;
        }
        
        if (player.disconnectTimer) {
            clearTimeout(player.disconnectTimer);
        }
        
        player.ws = null;
        player.disconnected = true;
        player.disconnectedAt = Date.now();
        this.playerToLobby.delete(ws);
        
        const wasHost = lobby.host === ws || lobby.hostPlayerId === player.id;
        if (wasHost) {
            // Immediately assign a provisional host so game_state keeps flowing during reconnect grace
            const provisional = lobby.players.find(p =>
                p.id !== player.id && p.ws && p.ws.readyState === WebSocket.OPEN
            );
            if (provisional) {
                lobby.hostPlayerId = provisional.id;
                lobby.host = provisional.ws;
                this.broadcastToLobby(lobby, {
                    type: 'host_migrated',
                    data: {
                        newHostId: provisional.id,
                        previousHostId: player.id,
                        provisional: true
                    }
                });
                console.log(`[Worker ${this.getWorkerId()}] Provisional host ${provisional.name} after disconnect of ${player.name} in lobby ${code}`);
            } else {
                lobby.host = null;
                lobby.hostPlayerId = player.id;
            }
        }
        
        // Stay in lobby until host kicks - rejoin anytime; run continues without them
        this.broadcastToLobby(lobby, {
            type: 'player_disconnected',
            data: {
                playerId: player.id,
                players: this.serializeLobbyPlayers(lobby)
            }
        });
    }
    
    removePlayerFromLobby(lobby, player) {
        const code = lobby.code;
        const playerId = player.id;
        
        if (player.disconnectTimer) {
            clearTimeout(player.disconnectTimer);
            player.disconnectTimer = null;
        }
        
        const playerIndex = lobby.players.findIndex(p => p.id === playerId);
        if (playerIndex === -1) return;
        
        const wasHost = lobby.hostPlayerId === playerId || lobby.host === player.ws;
        lobby.players.splice(playerIndex, 1);
        
        if (player.ws) {
            this.playerToLobby.delete(player.ws);
        }
        
        console.log(`[Worker ${this.getWorkerId()}] ${player.name} left lobby ${code} (${lobby.players.length}/${lobby.maxPlayers})`);
        
        if (lobby.players.length === 0) {
            this.lobbies.delete(code);
            this.releaseDirectory(code);
            this.notifyMaster('lobby_deleted', { code });
            console.log(`[Worker ${this.getWorkerId()}] Deleted empty lobby ${code}`);
            return;
        }
        
        if (wasHost && lobby.players.length > 0) {
            const newHostPlayer = lobby.players.find(p => p.ws && p.ws.readyState === WebSocket.OPEN) || lobby.players[0];
            lobby.hostPlayerId = newHostPlayer.id;
            lobby.host = (newHostPlayer.ws && newHostPlayer.ws.readyState === WebSocket.OPEN) ? newHostPlayer.ws : null;
            
            if (lobby.host) {
                this.broadcastToLobby(lobby, {
                    type: 'host_migrated',
                    data: {
                        newHostId: newHostPlayer.id,
                        previousHostId: playerId
                    }
                });
                console.log(`[Worker ${this.getWorkerId()}] Host migrated to ${newHostPlayer.name} in lobby ${code}`);
            }
        }
        
        this.broadcastToLobby(lobby, {
            type: 'player_left',
            data: {
                playerId: playerId,
                players: this.serializeLobbyPlayers(lobby)
            }
        });
    }
    
    handleGameState(ws, data) {
        const code = this.playerToLobby.get(ws);
        if (!code) return;
        
        const lobby = this.lobbies.get(code);
        if (!lobby || lobby.host !== ws) return;
        
        // Add server receive timestamp
        const serverReceiveTime = Date.now();
        
        // Add server timestamp to data if it doesn't already have one
        if (!data.serverReceiveTime) {
            data.serverReceiveTime = serverReceiveTime;
        }
        
        this.broadcastToLobby(lobby, {
            type: 'game_state',
            data
        }, ws);
    }
    
    handlePlayerState(ws, data) {
        const code = this.playerToLobby.get(ws);
        if (!code) return;
        
        const lobby = this.lobbies.get(code);
        if (!lobby) return;
        
        const player = lobby.players.find(p => p.ws === ws);
        if (player && data.class) {
            player.class = data.class;
        }
        
        // Add server receive timestamp
        const serverReceiveTime = Date.now();
        if (!data.serverReceiveTime) {
            data.serverReceiveTime = serverReceiveTime;
        }
        
        if (lobby.host && lobby.host !== ws && lobby.host.readyState === WebSocket.OPEN) {
            lobby.host.send(JSON.stringify({
                type: 'player_state',
                data
            }));
        }
    }
    
    handlePlayerStateBatch(ws, data) {
        const code = this.playerToLobby.get(ws);
        if (!code) return;
        
        const lobby = this.lobbies.get(code);
        if (!lobby) return;
        
        const player = lobby.players.find(p => p.ws === ws);
        if (!player) return;
        
        if (!Array.isArray(data && data.frames) || data.frames.length === 0) return;

        // Keep lobby roster class in sync (batches are the normal client path now)
        for (let i = data.frames.length - 1; i >= 0; i--) {
            const frame = data.frames[i];
            if (frame && frame.class) {
                player.class = frame.class;
                break;
            }
        }
        
        // Add server receive timestamp
        const serverReceiveTime = Date.now();
        
        if (lobby.host && lobby.host !== ws && lobby.host.readyState === WebSocket.OPEN) {
            lobby.host.send(JSON.stringify({
                type: 'player_state_batch',
                data: {
                    playerId: player.id,
                    frames: data.frames,
                    ack: data.ack,
                    serverReceiveTime: serverReceiveTime
                }
            }));
        }
    }
    
    handleGameStart(ws, data) {
        const code = this.playerToLobby.get(ws);
        if (!code) return;
        
        const lobby = this.lobbies.get(code);
        if (!lobby || lobby.host !== ws) return;
        
        console.log(`[Worker ${this.getWorkerId()}] Game starting in lobby ${code}`);
        
        this.broadcastToLobby(lobby, {
            type: 'game_start',
            data
        });
    }
    
    handleReturnToNexus(ws, data) {
        const code = this.playerToLobby.get(ws);
        if (!code) return;
        
        const lobby = this.lobbies.get(code);
        if (!lobby || lobby.host !== ws) return;
        
        console.log(`[Worker ${this.getWorkerId()}] Host returning to nexus in lobby ${code}`);
        
        this.broadcastToLobby(lobby, {
            type: 'return_to_nexus',
            data
        }, ws);
    }
    
    handleRoomTransition(ws, data) {
        const code = this.playerToLobby.get(ws);
        if (!code) return;
        
        const lobby = this.lobbies.get(code);
        if (!lobby || lobby.host !== ws) return;
        
        this.broadcastToLobby(lobby, {
            type: 'room_transition',
            data
        }, ws);
    }
    
    handleEnemyDamaged(ws, data) {
        const code = this.playerToLobby.get(ws);
        if (!code) return;
        
        const lobby = this.lobbies.get(code);
        if (!lobby) return;
        
        if (lobby.host && lobby.host !== ws && lobby.host.readyState === WebSocket.OPEN) {
            lobby.host.send(JSON.stringify({
                type: 'enemy_damaged',
                data
            }));
        }
    }
    
    handleEnemyStateUpdate(ws, data) {
        const code = this.playerToLobby.get(ws);
        if (!code) return;
        
        const lobby = this.lobbies.get(code);
        if (!lobby || lobby.host !== ws) return;
        
        this.broadcastToLobby(lobby, {
            type: 'enemy_state_update',
            data
        }, ws);
    }
    
    handlePlayerDamaged(ws, data) {
        const code = this.playerToLobby.get(ws);
        if (!code) return;
        
        const lobby = this.lobbies.get(code);
        if (!lobby || lobby.host !== ws) return;
        
        const targetPlayer = lobby.players.find(p => p.id === data.targetPlayerId);
        if (targetPlayer && targetPlayer.ws.readyState === WebSocket.OPEN) {
            targetPlayer.ws.send(JSON.stringify({
                type: 'player_damaged',
                data
            }));
        }
    }
    
    handleLootPickup(ws, data) {
        const code = this.playerToLobby.get(ws);
        if (!code) return;
        
        const lobby = this.lobbies.get(code);
        if (!lobby) return;
        
        this.broadcastToLobby(lobby, {
            type: 'loot_pickup',
            data
        }, ws);
    }
    
    handleRevivePlayers(ws, data) {
        const code = this.playerToLobby.get(ws);
        if (!code) return;
        
        const lobby = this.lobbies.get(code);
        if (!lobby || lobby.host !== ws) return;
        
        this.broadcastToLobby(lobby, {
            type: 'revive_players',
            data
        }, ws);
    }
    
    handleShardsUpdate(ws, data) {
        const code = this.playerToLobby.get(ws);
        if (!code) return;
        
        const lobby = this.lobbies.get(code);
        if (!lobby || lobby.host !== ws) return;
        
        const targetId = data && data.targetPlayerId;
        if (targetId) {
            const targetPlayer = lobby.players.find(p => p.id === targetId);
            if (targetPlayer && targetPlayer.ws.readyState === WebSocket.OPEN) {
                targetPlayer.ws.send(JSON.stringify({
                    type: 'shards_update',
                    data
                }));
            }
            return;
        }
        
        this.broadcastToLobby(lobby, {
            type: 'shards_update',
            data
        }, ws);
    }
    
    handleGearDropped(ws, data) {
        const code = this.playerToLobby.get(ws);
        if (!code) return;
        
        const lobby = this.lobbies.get(code);
        if (!lobby || lobby.host !== ws) return;
        
        if (!data || !data.gear) return;
        
        if (config.logging.level === 'debug') {
            console.log(`[Worker ${this.getWorkerId()}] Broadcasting gear drop from player ${data.playerId} in lobby ${code}`);
        }
        
        this.broadcastToLobby(lobby, {
            type: 'gear_dropped',
            data
        }, ws);
    }
    
    handleItemPylonInteract(ws, data) {
        const code = this.playerToLobby.get(ws);
        if (!code) return;
        
        const lobby = this.lobbies.get(code);
        if (!lobby || lobby.host !== ws) return;
        
        // Host broadcasts pylon interaction to all clients
        if (config.logging.level === 'debug') {
            console.log(`[Worker ${this.getWorkerId()}] Broadcasting item pylon interaction from player ${data.playerId} in lobby ${code}`);
        }
        
        this.broadcastToLobby(lobby, {
            type: 'item_pylon_interact',
            data
        }, ws);
    }
    
    handleItemPylonInteractRequest(ws, data) {
        const code = this.playerToLobby.get(ws);
        if (!code) return;
        
        const lobby = this.lobbies.get(code);
        if (!lobby) return;
        
        // Forward interaction request to host
        if (lobby.host && lobby.host !== ws && lobby.host.readyState === WebSocket.OPEN) {
            const player = lobby.players.find(p => p.ws === ws);
            if (player) {
                lobby.host.send(JSON.stringify({
                    type: 'item_pylon_interact_request',
                    data: {
                        ...data,
                        playerId: player.id
                    }
                }));
            }
        }
    }
    
    handleUpgradePurchase(ws, data) {
        const code = this.playerToLobby.get(ws);
        if (!code) return;
        
        const lobby = this.lobbies.get(code);
        if (!lobby) return;
        
        if (lobby.host && lobby.host !== ws && lobby.host.readyState === WebSocket.OPEN) {
            const player = lobby.players.find(p => p.ws === ws);
            if (player) {
                lobby.host.send(JSON.stringify({
                    type: 'upgrade_purchase',
                    data: {
                        ...data,
                        playerId: player.id
                    }
                }));
            }
        }
        // Host processes upgrade purchases locally in nexus - no server echo needed
    }
    
    handleUpgradePurchased(ws, data) {
        const code = this.playerToLobby.get(ws);
        if (!code) return;
        
        const lobby = this.lobbies.get(code);
        if (!lobby || lobby.host !== ws) return;
        
        const targetPlayerId = data.playerId || data.targetPlayerId;
        if (!targetPlayerId) return;
        
        const targetPlayer = lobby.players.find(p => p.id === targetPlayerId);
        if (!targetPlayer) return;
        
        if (data.newCurrency !== undefined) {
            targetPlayer.currency = data.newCurrency;
        }
        
        if (data.upgrades) {
            targetPlayer.upgrades = data.upgrades;
        } else if (data.classType && data.statType !== undefined && data.newLevel !== undefined) {
            if (!targetPlayer.upgrades) {
                targetPlayer.upgrades = {};
            }
            if (!targetPlayer.upgrades[data.classType]) {
                targetPlayer.upgrades[data.classType] = { damage: 0, defense: 0, speed: 0 };
            }
            targetPlayer.upgrades[data.classType][data.statType] = data.newLevel;
        }
        
        if (targetPlayer.ws && targetPlayer.ws !== ws && targetPlayer.ws.readyState === WebSocket.OPEN) {
            targetPlayer.ws.send(JSON.stringify({
                type: 'upgrade_purchased',
                data: {
                    playerId: targetPlayer.id,
                    classType: data.classType,
                    statType: data.statType,
                    newLevel: data.newLevel,
                    newCurrency: data.newCurrency,
                    upgrades: data.upgrades || targetPlayer.upgrades
                }
            }));
        }
    }
    
    handleCurrencyUpdate(ws, data) {
        const code = this.playerToLobby.get(ws);
        if (!code) return;
        
        const lobby = this.lobbies.get(code);
        if (!lobby || lobby.host !== ws) return;
        
        const targetPlayer = lobby.players.find(p => p.id === data.targetPlayerId);
        if (targetPlayer && targetPlayer.ws.readyState === WebSocket.OPEN) {
            targetPlayer.ws.send(JSON.stringify({
                type: 'currency_update',
                data: {
                    playerId: data.targetPlayerId,
                    newCurrency: data.newCurrency,
                    reason: data.reason
                }
            }));
        }
    }
    
    handleDamageNumber(ws, data) {
        const code = this.playerToLobby.get(ws);
        if (!code) return;

        const lobby = this.lobbies.get(code);
        if (!lobby || lobby.host !== ws) return;

        // Broadcast damage number to all clients (not host)
        this.broadcastToLobby(lobby, {
            type: 'damage_number',
            data
        }, ws);
    }

    handleCombatFx(ws, data) {
        const code = this.playerToLobby.get(ws);
        if (!code) return;

        const lobby = this.lobbies.get(code);
        if (!lobby || lobby.host !== ws) return;

        this.broadcastToLobby(lobby, {
            type: 'combat_fx',
            data
        }, ws);
    }

    handleResyncRequest(ws, data) {
        const code = this.playerToLobby.get(ws);
        if (!code) return;

        const lobby = this.lobbies.get(code);
        if (!lobby) return;

        // Forward to host only (same routing as player_state)
        if (lobby.host && lobby.host !== ws && lobby.host.readyState === WebSocket.OPEN) {
            lobby.host.send(JSON.stringify({
                type: 'resync_request',
                data: {
                    ...(data || {}),
                    playerId: (data && data.playerId) || (ws.playerId || null)
                }
            }));
        }
    }

    handlePlayerLeveledUp(ws, data) {
        const code = this.playerToLobby.get(ws);
        if (!code) return;
        
        const lobby = this.lobbies.get(code);
        if (!lobby || lobby.host !== ws) return;
        
        if (!data || typeof data.playerId === 'undefined' || typeof data.level === 'undefined') return;
        
        if (config.logging.level === 'debug') {
            console.log(`[Worker ${this.getWorkerId()}] Broadcasting level up for player ${data.playerId} (level ${data.level}) in lobby ${code}`);
        }
        
        this.broadcastToLobby(lobby, {
            type: 'player_leveled_up',
            data
        }, ws);
    }
    
    handleFinalStats(ws, data) {
        const code = this.playerToLobby.get(ws);
        if (!code) return;
        
        const lobby = this.lobbies.get(code);
        if (!lobby || lobby.host !== ws) return;
        
        // Broadcast final stats to all clients (not host)
        this.broadcastToLobby(lobby, {
            type: 'final_stats',
            data
        }, ws);
    }
    
    handleMasterMessage(msg) {
        const { type, data } = msg;
        
        switch (type) {
            case 'lobby_lookup_response':
                this.handleLobbyLookupResponse(data);
                break;
                
            case 'migrate_lobby':
                this.handleLobbyMigration(data);
                break;

            case 'import_migrated_lobby':
                this.handleImportMigratedLobby(data);
                break;

            case 'finalize_lobby_migration':
                this.finalizeLobbyMigration(data);
                break;
                
            case 'least_loaded_worker_response':
                // Not used in current implementation but could be useful
                break;
                
            default:
                if (config.logging.level === 'debug') {
                    console.log(`[Worker ${this.getWorkerId()}] Unknown master message:`, type);
                }
        }
    }
    
    handleLobbyLookupResponse(data) {
        const { requestId, found, workerId } = data;
        const callback = this.pendingLookups.get(requestId);
        
        if (callback) {
            callback(found, workerId);
            this.pendingLookups.delete(requestId);
        }
    }
    
    handleLobbyMigration(data) {
        const { lobbyCode, targetWorkerId, targetEndpoint } = data;
        const lobby = this.lobbies.get(lobbyCode);
        
        if (!lobby) {
            console.error(`[Worker ${this.getWorkerId()}] Cannot migrate non-existent lobby ${lobbyCode}`);
            return;
        }
        
        console.log(`[Worker ${this.getWorkerId()}] Preparing migration of lobby ${lobbyCode} to worker ${targetWorkerId}`);

        const snapshot = {
            code: lobbyCode,
            hostPlayerId: lobby.hostPlayerId,
            maxPlayers: lobby.maxPlayers,
            createdAt: lobby.createdAt,
            players: lobby.players.map((p) => ({
                id: p.id,
                persistentPlayerId: p.persistentPlayerId || null,
                name: p.name,
                class: p.class,
                ready: !!p.ready,
                currency: p.currency || 0,
                upgrades: p.upgrades || {},
                safeRoomMeta: p.safeRoomMeta || {}
            }))
        };

        this.notifyMaster('lobby_migrate_payload', {
            lobbyCode,
            targetWorkerId,
            targetEndpoint,
            snapshot
        });
    }

    async handleImportMigratedLobby(data) {
        const { lobbyCode, snapshot, sourceWorkerId } = data || {};
        if (!lobbyCode || !snapshot) {
            console.error(`[Worker ${this.getWorkerId()}] import_migrated_lobby missing payload`);
            return;
        }
        if (this.lobbies.has(lobbyCode)) {
            console.warn(`[Worker ${this.getWorkerId()}] Lobby ${lobbyCode} already local during import`);
            this.notifyMaster('lobby_migrate_imported', { lobbyCode, sourceWorkerId, ok: true });
            return;
        }

        const lobby = {
            code: lobbyCode,
            host: null,
            hostPlayerId: snapshot.hostPlayerId,
            players: (snapshot.players || []).map((p) => ({
                ws: null,
                id: p.id,
                persistentPlayerId: p.persistentPlayerId || null,
                name: p.name,
                class: p.class || 'square',
                ready: !!p.ready,
                currency: p.currency || 0,
                upgrades: p.upgrades || {},
                safeRoomMeta: p.safeRoomMeta || {},
                disconnected: true
            })),
            maxPlayers: snapshot.maxPlayers || config.lobby.maxPlayers,
            createdAt: snapshot.createdAt || Date.now(),
            awaitingReconnect: true
        };

        this.lobbies.set(lobbyCode, lobby);

        if (this.directory) {
            try {
                await this.directory.transfer(lobbyCode, {
                    serverId: config.server.id,
                    workerId: this.getWorkerId(),
                    endpoint: this.endpointInfo.endpoint,
                    createdAt: Date.now(),
                    migratedFrom: sourceWorkerId || null
                });
            } catch (err) {
                console.error(`[Worker ${this.getWorkerId()}] Redis transfer failed for ${lobbyCode}:`, err.message);
                this.lobbies.delete(lobbyCode);
                this.notifyMaster('lobby_migrate_imported', {
                    lobbyCode,
                    sourceWorkerId,
                    ok: false,
                    error: err.message
                });
                return;
            }
        }

        this.notifyMaster('lobby_created', {
            code: lobbyCode,
            endpoint: this.endpointInfo.endpoint
        });
        this.notifyMaster('lobby_migrate_imported', { lobbyCode, sourceWorkerId, ok: true });
        console.log(
            `[Worker ${this.getWorkerId()}] Imported migrated lobby ${lobbyCode} (${lobby.players.length} players awaiting reconnect)`
        );
    }

    finalizeLobbyMigration(data) {
        const { lobbyCode, targetEndpoint } = data || {};
        const lobby = this.lobbies.get(lobbyCode);
        if (!lobby) {
            return;
        }

        console.log(`[Worker ${this.getWorkerId()}] Finalizing migration of lobby ${lobbyCode}`);

        const redirectUrl = targetEndpoint || null;
        if (redirectUrl) {
            this.broadcastToLobby(lobby, {
                type: 'redirect',
                data: {
                    url: redirectUrl,
                    code: lobbyCode,
                    reason: 'lobby_migrating'
                }
            });
        } else {
            this.broadcastToLobby(lobby, {
                type: 'lobby_migrating',
                data: {
                    message: 'Server rebalancing, reconnecting...',
                    lobbyCode
                }
            });
        }

        lobby.players.forEach((player) => {
            if (player.ws && player.ws.readyState === WebSocket.OPEN) {
                try {
                    player.ws.close(1000, 'Server rebalancing');
                } catch (_e) {}
            }
            if (player.ws) {
                this.playerToLobby.delete(player.ws);
            }
        });

        this.lobbies.delete(lobbyCode);
        // Redis ownership already transferred by target; do not release.
        this.notifyMaster('lobby_deleted', { code: lobbyCode });
    }

    handleTestMigrateLobby(ws, data) {
        if (process.env.ALLOW_TEST_MIGRATION !== 'true') {
            return;
        }
        const code = this.playerToLobby.get(ws) || (data && data.code);
        if (!code || !this.lobbies.has(code)) {
            ws.send(JSON.stringify({
                type: 'lobby_error',
                data: { message: 'No lobby to migrate' }
            }));
            return;
        }
        this.notifyMaster('request_test_migrate', { code: String(code).toUpperCase() });
    }
    
    broadcastToLobby(lobby, message, excludeWs = null) {
        // Add server send timestamp for game_state messages
        if (message.type === 'game_state' && message.data) {
            message.data.serverSendTime = Date.now();
        }
        
        const msgStr = JSON.stringify(message);
        lobby.players.forEach(player => {
            if (player.ws && player.ws !== excludeWs && player.ws.readyState === WebSocket.OPEN) {
                player.ws.send(msgStr);
            }
        });
    }
    
    lookupLobby(code, callback) {
        const requestId = `lookup-${this.getWorkerId()}-${this.lookupRequestId++}`;
        this.pendingLookups.set(requestId, callback);
        
        this.notifyMaster('lobby_lookup', { code, requestId });
        
        // Timeout after 5 seconds
        setTimeout(() => {
            if (this.pendingLookups.has(requestId)) {
                this.pendingLookups.delete(requestId);
                callback(false, null);
            }
        }, 5000);
    }
    
    notifyMaster(type, data) {
        if (process.send) {
            process.send({ type, data });
        }
    }
    
    startHealthMonitoring() {
        if (!config.loadBalancing.enabled) return;
        
        setInterval(() => {
            this.reportHealthMetrics();
        }, config.loadBalancing.healthCheckInterval);
    }
    
    reportHealthMetrics() {
        const now = Date.now();
        const timeSinceLastReset = now - this.metrics.lastMessageReset;
        const messagesPerSecond = Math.round((this.metrics.messageCount / timeSinceLastReset) * 1000);
        
        // Measure event loop lag
        const lagStart = Date.now();
        setImmediate(() => {
            const lag = Date.now() - lagStart;
            
            const metrics = {
                connections: this.metrics.connections,
                lobbies: this.lobbies.size,
                messagesPerSecond,
                eventLoopLag: lag
            };
            
            this.notifyMaster('health_metrics', metrics);
            
            // Reset message counter
            this.metrics.messageCount = 0;
            this.metrics.lastMessageReset = now;
        });
    }
    
    startLobbyCleanup() {
        setInterval(() => {
            const now = Date.now();
            const maxAge = config.lobby.maxAge;
            
            for (const [code, lobby] of this.lobbies.entries()) {
                if (now - lobby.createdAt > maxAge) {
                    console.log(`[Worker ${this.getWorkerId()}] Cleaning up old lobby ${code}`);
                    
                    // Close all connections
                    lobby.players.forEach(p => {
                        if (p.ws) {
                            this.playerToLobby.delete(p.ws);
                            if (p.ws.readyState === WebSocket.OPEN) {
                                p.ws.close(1000, 'Lobby expired');
                            }
                        }
                    });
                    
                    this.lobbies.delete(code);
                    this.releaseDirectory(code);
                    this.notifyMaster('lobby_deleted', { code });
                }
            }
        }, config.lobby.cleanupInterval);
    }

    releaseDirectory(code) {
        if (this.directory) {
            this.directory.release(code).catch((err) => {
                console.warn(`[Worker ${this.getWorkerId()}] Failed to release lobby ${code}:`, err.message);
            });
        }
    }

    recordMessageStat(type, rawSize) {
        if (!type) return;
        const entry = this.telemetry.messageStats.get(type) || { count: 0, bytes: 0 };
        entry.count += 1;
        if (rawSize && Number.isFinite(rawSize)) {
            entry.bytes += rawSize;
        }
        this.telemetry.messageStats.set(type, entry);
    }

    startTelemetryReporting() {
        const interval = config.metrics && config.metrics.telemetryInterval
            ? config.metrics.telemetryInterval
            : 5000;
        setInterval(() => this.logTelemetry(), interval);
    }

    logTelemetry() {
        const now = Date.now();
        const elapsed = now - this.telemetry.lastLog;
        if (elapsed <= 0) return;

        const entries = Array.from(this.telemetry.messageStats.entries());
        if (entries.length === 0) return;

        const sorted = entries.sort((a, b) => b[1].bytes - a[1].bytes);
        const top = sorted.slice(0, 5);

        const mbps = (this.telemetry.rawBytes * 8) / (elapsed / 1000) / 1_000_000;

        console.log(`[Worker ${this.getWorkerId()}] Message telemetry (${(elapsed / 1000).toFixed(1)}s window): total ${this.telemetry.rawBytes} bytes (${mbps.toFixed(2)} Mbps)`);
        top.forEach(([type, stats]) => {
            const avg = stats.count > 0 ? (stats.bytes / stats.count) : 0;
            console.log(`  - ${type}: ${stats.count} msgs, ${stats.bytes} bytes, avg ${avg.toFixed(1)} bytes`);
        });

        this.telemetry.messageStats.clear();
        this.telemetry.rawBytes = 0;
        this.telemetry.lastLog = now;
    }
    
    generateLobbyCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code;
        do {
            code = '';
            for (let i = 0; i < config.lobby.codeLength; i++) {
                code += chars.charAt(Math.floor(Math.random() * chars.length));
            }
        } while (this.lobbies.has(code));
        return code;
    }
    
    generatePlayerId() {
        return `player-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    
    getWorkerId() {
        return require('cluster').worker ? require('cluster').worker.id : 'standalone';
    }
}

// Start worker process
const worker = new WorkerProcess();
worker.start().catch((error) => {
    console.error('[Worker] Failed to start:', error);
    process.exit(1);
});

module.exports = worker;

