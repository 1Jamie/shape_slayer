const WebSocket = require('ws');
const os = require('os');
const config = require('./config');

// Worker process - handles WebSocket connections and lobbies
class WorkerProcess {
    constructor() {
        this.wss = null;
        this.lobbies = new Map(); // code -> lobby object
        this.playerToLobby = new Map(); // ws -> lobby code
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
    
    start() {
        const cluster = require('cluster');
        const workerId = cluster.worker ? cluster.worker.id : 'standalone';
        
        // Create WebSocket server - bind to 0.0.0.0 to accept connections from any network interface
        this.wss = new WebSocket.Server({ 
            port: config.port,
            host: config.host
        });
        
        console.log(`[Worker ${workerId}] Started on port ${config.port}`);
        
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
    }
    
    handleConnection(ws) {
        this.metrics.connections++;
        
        if (config.logging.level === 'debug') {
            console.log(`[Worker ${this.getWorkerId()}] New client connected (total: ${this.metrics.connections})`);
        }
        
        ws.on('message', (message) => {
            this.metrics.messageCount++;
            
            const rawSize = typeof message === 'string'
                ? Buffer.byteLength(message, 'utf8')
                : (message ? message.length : 0);
            if (!Number.isNaN(rawSize)) {
                this.telemetry.rawBytes += rawSize;
            }

            try {
                const msg = JSON.parse(message.toString());
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
            case 'player_leveled_up':
                this.handlePlayerLeveledUp(ws, data);
                break;
            case 'final_stats':
                this.handleFinalStats(ws, data);
                break;
            case 'heartbeat':
                ws.send(JSON.stringify({ type: 'heartbeat_ack' }));
                break;
            default:
                console.warn('[Warning] Unknown message type:', type);
        }
    }
    
    handleCreateLobby(ws, data) {
        const code = this.generateLobbyCode();
        const playerId = this.generatePlayerId();
        
        const lobby = {
            code,
            host: ws,
            players: [{
                ws,
                id: playerId,
                name: data.playerName || 'Player 1',
                class: data.class || 'square',
                ready: false,
                currency: data.currency || 0,
                upgrades: data.upgrades || {
                    square: { damage: 0, defense: 0, speed: 0 },
                    triangle: { damage: 0, defense: 0, speed: 0 },
                    pentagon: { damage: 0, defense: 0, speed: 0 },
                    hexagon: { damage: 0, defense: 0, speed: 0 }
                }
            }],
            maxPlayers: config.lobby.maxPlayers,
            createdAt: Date.now()
        };
        
        this.lobbies.set(code, lobby);
        this.playerToLobby.set(ws, code);
        
        // Notify master of new lobby
        this.notifyMaster('lobby_created', { code });
        
        console.log(`[Worker ${this.getWorkerId()}] Created lobby ${code} by ${data.playerName || 'Player 1'}`);
        
        ws.send(JSON.stringify({
            type: 'lobby_created',
            data: {
                code,
                playerId,
                isHost: true,
                players: lobby.players.map(p => ({
                    id: p.id,
                    name: p.name,
                    class: p.class,
                    ready: p.ready,
                    currency: p.currency,
                    upgrades: p.upgrades
                }))
            }
        }));
    }
    
    handleJoinLobby(ws, data) {
        const { code, playerName, playerClass } = data;
        
        // Check if lobby exists locally
        let lobby = this.lobbies.get(code);
        
        if (!lobby) {
            // Lobby might be on another worker, check with master
            this.lookupLobby(code, (found, workerId) => {
                if (!found) {
                    ws.send(JSON.stringify({
                        type: 'lobby_error',
                        data: { message: 'Lobby not found' }
                    }));
                } else if (workerId !== this.getWorkerId()) {
                    // Lobby is on another worker - send error (client needs to reconnect)
                    // In a production system, we could handle cross-worker joins
                    ws.send(JSON.stringify({
                        type: 'lobby_error',
                        data: { message: 'Lobby on different server, please retry' }
                    }));
                }
            });
            return;
        }
        
        if (lobby.players.length >= lobby.maxPlayers) {
            ws.send(JSON.stringify({
                type: 'lobby_error',
                data: { message: 'Lobby is full' }
            }));
            return;
        }
        
        const playerId = this.generatePlayerId();
        const player = {
            ws,
            id: playerId,
            name: playerName || `Player ${lobby.players.length + 1}`,
            class: playerClass || 'square',
            ready: false,
            currency: data.currency || 0,
            upgrades: data.upgrades || {
                square: { damage: 0, defense: 0, speed: 0 },
                triangle: { damage: 0, defense: 0, speed: 0 },
                pentagon: { damage: 0, defense: 0, speed: 0 },
                hexagon: { damage: 0, defense: 0, speed: 0 }
            }
        };
        
        lobby.players.push(player);
        this.playerToLobby.set(ws, code);
        
        console.log(`[Worker ${this.getWorkerId()}] ${player.name} joined lobby ${code} (${lobby.players.length}/${lobby.maxPlayers})`);
        
        // Send confirmation to joining player
        ws.send(JSON.stringify({
            type: 'lobby_joined',
            data: {
                code,
                playerId,
                isHost: false,
                players: lobby.players.map(p => ({
                    id: p.id,
                    name: p.name,
                    class: p.class,
                    ready: p.ready,
                    currency: p.currency,
                    upgrades: p.upgrades
                }))
            }
        }));
        
        // Notify all other players in lobby
        this.broadcastToLobby(lobby, {
            type: 'player_joined',
            data: {
                player: {
                    id: playerId,
                    name: player.name,
                    class: player.class,
                    ready: player.ready,
                    currency: player.currency,
                    upgrades: player.upgrades
                },
                players: lobby.players.map(p => ({
                    id: p.id,
                    name: p.name,
                    class: p.class,
                    ready: p.ready,
                    currency: p.currency,
                    upgrades: p.upgrades
                }))
            }
        }, ws);
    }
    
    handleLeaveLobby(ws) {
        const code = this.playerToLobby.get(ws);
        if (!code) return;
        
        const lobby = this.lobbies.get(code);
        if (!lobby) return;
        
        const playerIndex = lobby.players.findIndex(p => p.ws === ws);
        if (playerIndex === -1) return;
        
        const player = lobby.players[playerIndex];
        lobby.players.splice(playerIndex, 1);
        this.playerToLobby.delete(ws);
        
        console.log(`[Worker ${this.getWorkerId()}] ${player.name} left lobby ${code} (${lobby.players.length}/${lobby.maxPlayers})`);
        
        // If lobby is empty, delete it
        if (lobby.players.length === 0) {
            this.lobbies.delete(code);
            this.notifyMaster('lobby_deleted', { code });
            console.log(`[Worker ${this.getWorkerId()}] Deleted empty lobby ${code}`);
            return;
        }
        
        // If host left, migrate to next player
        if (lobby.host === ws && lobby.players.length > 0) {
            lobby.host = lobby.players[0].ws;
            lobby.players[0].ws.send(JSON.stringify({
                type: 'host_migrated',
                data: { newHostId: lobby.players[0].id }
            }));
            console.log(`[Worker ${this.getWorkerId()}] Host migrated to ${lobby.players[0].name} in lobby ${code}`);
        }
        
        // Notify remaining players
        this.broadcastToLobby(lobby, {
            type: 'player_left',
            data: {
                playerId: player.id,
                players: lobby.players.map(p => ({
                    id: p.id,
                    name: p.name,
                    class: p.class,
                    ready: p.ready,
                    currency: p.currency,
                    upgrades: p.upgrades
                }))
            }
        });
    }
    
    handleDisconnect(ws) {
        if (config.logging.level === 'debug') {
            console.log(`[Worker ${this.getWorkerId()}] Client disconnected`);
        }
        this.handleLeaveLobby(ws);
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
        });
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
        } else if (lobby.host === ws) {
            ws.send(JSON.stringify({
                type: 'upgrade_purchase',
                data: {
                    ...data,
                    playerId: lobby.players.find(p => p.ws === ws).id
                }
            }));
        }
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
        const { lobbyCode, targetWorkerId } = data;
        const lobby = this.lobbies.get(lobbyCode);
        
        if (!lobby) {
            console.error(`[Worker ${this.getWorkerId()}] Cannot migrate non-existent lobby ${lobbyCode}`);
            return;
        }
        
        console.log(`[Worker ${this.getWorkerId()}] Migrating lobby ${lobbyCode} to worker ${targetWorkerId}`);
        
        // Notify all players in lobby that they need to reconnect
        this.broadcastToLobby(lobby, {
            type: 'lobby_migrating',
            data: {
                message: 'Server rebalancing, reconnecting...',
                lobbyCode
            }
        });
        
        // Close all connections gracefully
        lobby.players.forEach(player => {
            if (player.ws.readyState === WebSocket.OPEN) {
                player.ws.close(1000, 'Server rebalancing');
            }
            this.playerToLobby.delete(player.ws);
        });
        
        // Remove lobby
        this.lobbies.delete(lobbyCode);
        
        // Note: Clients will automatically reconnect and rejoin the lobby
        // The lobby will be recreated on the target worker when the host reconnects
    }
    
    broadcastToLobby(lobby, message, excludeWs = null) {
        // Add server send timestamp for game_state messages
        if (message.type === 'game_state' && message.data) {
            message.data.serverSendTime = Date.now();
        }
        
        const msgStr = JSON.stringify(message);
        lobby.players.forEach(player => {
            if (player.ws !== excludeWs && player.ws.readyState === WebSocket.OPEN) {
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
                        this.playerToLobby.delete(p.ws);
                        if (p.ws.readyState === WebSocket.OPEN) {
                            p.ws.close(1000, 'Lobby expired');
                        }
                    });
                    
                    this.lobbies.delete(code);
                    this.notifyMaster('lobby_deleted', { code });
                }
            }
        }, config.lobby.cleanupInterval);
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
worker.start();

module.exports = worker;

