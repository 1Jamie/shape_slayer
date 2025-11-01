const WebSocket = require('ws');
const os = require('os');

const PORT = 4000;

// Lobby storage
const lobbies = new Map(); // code -> lobby object
const playerToLobby = new Map(); // ws -> lobby code

// Get local network IP address
function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

// Generate random 6-character lobby code
function generateLobbyCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid confusing chars like O/0, I/1
    let code;
    do {
        code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
    } while (lobbies.has(code)); // Ensure unique
    return code;
}

const IP = getLocalIP();

// Create WebSocket server - bind to 0.0.0.0 to accept connections from any network interface
const wss = new WebSocket.Server({ 
    port: PORT,
    host: '0.0.0.0'
});

console.log(`\n========================================`);
console.log(`  Shape Slayer Multiplayer Server`);
console.log(`========================================`);
console.log(`  Local:    ws://localhost:${PORT}`);
console.log(`  Network:  ws://${IP}:${PORT}`);
console.log(`  Status:   Running`);
console.log(`========================================\n`);

wss.on('connection', (ws) => {
    console.log('[Connection] New client connected');
    
    ws.on('message', (message) => {
        try {
            const msg = JSON.parse(message.toString());
            handleMessage(ws, msg);
        } catch (err) {
            console.error('[Error] Failed to parse message:', err);
        }
    });
    
    ws.on('close', () => {
        handleDisconnect(ws);
    });
    
    ws.on('error', (err) => {
        console.error('[Error] WebSocket error:', err);
    });
});

function handleMessage(ws, msg) {
    const { type, data } = msg;
    
    switch (type) {
        case 'create_lobby':
            handleCreateLobby(ws, data);
            break;
        case 'join_lobby':
            handleJoinLobby(ws, data);
            break;
        case 'leave_lobby':
            handleLeaveLobby(ws);
            break;
        case 'game_state':
            handleGameState(ws, data);
            break;
        case 'player_state':
            handlePlayerState(ws, data);
            break;
        case 'game_start':
            handleGameStart(ws, data);
            break;
        case 'return_to_nexus':
            handleReturnToNexus(ws, data);
            break;
        case 'room_transition':
            handleRoomTransition(ws, data);
            break;
        case 'enemy_damaged':
            handleEnemyDamaged(ws, data);
            break;
        case 'enemy_state_update':
            handleEnemyStateUpdate(ws, data);
            break;
        case 'player_damaged':
            handlePlayerDamaged(ws, data);
            break;
        case 'loot_pickup':
            handleLootPickup(ws, data);
            break;
        case 'upgrade_purchase':
            handleUpgradePurchase(ws, data);
            break;
        case 'currency_update':
            handleCurrencyUpdate(ws, data);
            break;
        case 'heartbeat':
            // Respond to heartbeat
            ws.send(JSON.stringify({ type: 'heartbeat_ack' }));
            break;
        default:
            console.warn('[Warning] Unknown message type:', type);
    }
}

function handleCreateLobby(ws, data) {
    const code = generateLobbyCode();
    const playerId = generatePlayerId();
    
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
        maxPlayers: 4,
        createdAt: Date.now()
    };
    
    lobbies.set(code, lobby);
    playerToLobby.set(ws, code);
    
    console.log(`[Lobby] Created lobby ${code} by ${data.playerName || 'Player 1'}`);
    
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

function handleJoinLobby(ws, data) {
    const { code, playerName, playerClass } = data;
    const lobby = lobbies.get(code);
    
    if (!lobby) {
        ws.send(JSON.stringify({
            type: 'lobby_error',
            data: { message: 'Lobby not found' }
        }));
        return;
    }
    
    if (lobby.players.length >= lobby.maxPlayers) {
        ws.send(JSON.stringify({
            type: 'lobby_error',
            data: { message: 'Lobby is full' }
        }));
        return;
    }
    
    const playerId = generatePlayerId();
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
    playerToLobby.set(ws, code);
    
    console.log(`[Lobby] ${player.name} joined lobby ${code} (${lobby.players.length}/${lobby.maxPlayers})`);
    
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
    broadcastToLobby(lobby, {
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

function handleLeaveLobby(ws) {
    const code = playerToLobby.get(ws);
    if (!code) return;
    
    const lobby = lobbies.get(code);
    if (!lobby) return;
    
    const playerIndex = lobby.players.findIndex(p => p.ws === ws);
    if (playerIndex === -1) return;
    
    const player = lobby.players[playerIndex];
    lobby.players.splice(playerIndex, 1);
    playerToLobby.delete(ws);
    
    console.log(`[Lobby] ${player.name} left lobby ${code} (${lobby.players.length}/${lobby.maxPlayers})`);
    
    // If lobby is empty, delete it
    if (lobby.players.length === 0) {
        lobbies.delete(code);
        console.log(`[Lobby] Deleted empty lobby ${code}`);
        return;
    }
    
    // If host left, migrate to next player
    if (lobby.host === ws && lobby.players.length > 0) {
        lobby.host = lobby.players[0].ws;
        lobby.players[0].ws.send(JSON.stringify({
            type: 'host_migrated',
            data: { newHostId: lobby.players[0].id }
        }));
        console.log(`[Lobby] Host migrated to ${lobby.players[0].name} in lobby ${code}`);
    }
    
    // Notify remaining players
    broadcastToLobby(lobby, {
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

function handleDisconnect(ws) {
    console.log('[Connection] Client disconnected');
    handleLeaveLobby(ws);
}

function handleGameState(ws, data) {
    const code = playerToLobby.get(ws);
    if (!code) return;
    
    const lobby = lobbies.get(code);
    if (!lobby || lobby.host !== ws) return; // Only host can send game state
    
    // Broadcast game state to all clients except host
    broadcastToLobby(lobby, {
        type: 'game_state',
        data
    }, ws);
}

function handlePlayerState(ws, data) {
    const code = playerToLobby.get(ws);
    if (!code) return;
    
    const lobby = lobbies.get(code);
    if (!lobby) return;
    
    // Update player's class in lobby data (for when new players join)
    const player = lobby.players.find(p => p.ws === ws);
    if (player && data.class) {
        player.class = data.class;
    }
    
    // Send player state to host only
    if (lobby.host && lobby.host !== ws && lobby.host.readyState === WebSocket.OPEN) {
        lobby.host.send(JSON.stringify({
            type: 'player_state',
            data
        }));
    }
}

function handleGameStart(ws, data) {
    const code = playerToLobby.get(ws);
    if (!code) return;
    
    const lobby = lobbies.get(code);
    if (!lobby || lobby.host !== ws) return; // Only host can start game
    
    console.log(`[Lobby] Game starting in lobby ${code}`);
    
    // Broadcast game start to all clients
    broadcastToLobby(lobby, {
        type: 'game_start',
        data
    });
}

function handleReturnToNexus(ws, data) {
    const code = playerToLobby.get(ws);
    if (!code) return;
    
    const lobby = lobbies.get(code);
    if (!lobby || lobby.host !== ws) return;
    
    console.log(`[Lobby] Host returning to nexus in lobby ${code}`);
    
    // Broadcast return to nexus to all clients (except host)
    broadcastToLobby(lobby, {
        type: 'return_to_nexus',
        data
    }, ws);
}

function handleRoomTransition(ws, data) {
    const code = playerToLobby.get(ws);
    if (!code) return;
    
    const lobby = lobbies.get(code);
    if (!lobby || lobby.host !== ws) return; // Only host can trigger room transitions
    
    // Broadcast room transition to all clients (except host)
    broadcastToLobby(lobby, {
        type: 'room_transition',
        data
    }, ws);
}

function handleEnemyDamaged(ws, data) {
    const code = playerToLobby.get(ws);
    if (!code) return;
    
    const lobby = lobbies.get(code);
    if (!lobby) return;
    
    // Forward to host only (host is authoritative for enemy HP)
    if (lobby.host && lobby.host !== ws && lobby.host.readyState === WebSocket.OPEN) {
        lobby.host.send(JSON.stringify({
            type: 'enemy_damaged',
            data
        }));
    }
}

function handleEnemyStateUpdate(ws, data) {
    const code = playerToLobby.get(ws);
    if (!code) return;
    
    const lobby = lobbies.get(code);
    if (!lobby || lobby.host !== ws) return; // Only host can send enemy state updates
    
    // Broadcast enemy state update to all clients (except host)
    broadcastToLobby(lobby, {
        type: 'enemy_state_update',
        data
    }, ws);
}

function handlePlayerDamaged(ws, data) {
    const code = playerToLobby.get(ws);
    if (!code) return;
    
    const lobby = lobbies.get(code);
    if (!lobby || lobby.host !== ws) return; // Only host can send player damage
    
    // Find target player and send damage event to them
    const targetPlayer = lobby.players.find(p => p.id === data.targetPlayerId);
    if (targetPlayer && targetPlayer.ws.readyState === WebSocket.OPEN) {
        targetPlayer.ws.send(JSON.stringify({
            type: 'player_damaged',
            data
        }));
    }
}

function handleLootPickup(ws, data) {
    const code = playerToLobby.get(ws);
    if (!code) return;
    
    const lobby = lobbies.get(code);
    if (!lobby) return;
    
    // Broadcast loot pickup to all players (including sender for confirmation)
    broadcastToLobby(lobby, {
        type: 'loot_pickup',
        data
    });
}

function handleUpgradePurchase(ws, data) {
    const code = playerToLobby.get(ws);
    if (!code) return;
    
    const lobby = lobbies.get(code);
    if (!lobby) return;
    
    // Forward upgrade purchase request to host only (host is authoritative)
    if (lobby.host && lobby.host !== ws && lobby.host.readyState === WebSocket.OPEN) {
        // Include player ID from sender
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
        // Host sent it directly, process locally (will be handled by client-side handler)
        // Actually, this shouldn't happen - host processes it locally via nexus.js
        // But if it does, we'll just echo it back for consistency
        ws.send(JSON.stringify({
            type: 'upgrade_purchase',
            data: {
                ...data,
                playerId: lobby.players.find(p => p.ws === ws).id
            }
        }));
    }
}

function handleCurrencyUpdate(ws, data) {
    const code = playerToLobby.get(ws);
    if (!code) return;
    
    const lobby = lobbies.get(code);
    if (!lobby || lobby.host !== ws) return; // Only host can send currency updates
    
    // Forward currency update to target player
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

function broadcastToLobby(lobby, message, excludeWs = null) {
    const msgStr = JSON.stringify(message);
    lobby.players.forEach(player => {
        if (player.ws !== excludeWs && player.ws.readyState === WebSocket.OPEN) {
            player.ws.send(msgStr);
        }
    });
}

function generatePlayerId() {
    return `player-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Cleanup old lobbies (older than 1 hour)
setInterval(() => {
    const now = Date.now();
    const maxAge = 60 * 60 * 1000; // 1 hour
    
    for (const [code, lobby] of lobbies.entries()) {
        if (now - lobby.createdAt > maxAge) {
            console.log(`[Lobby] Cleaning up old lobby ${code}`);
            lobbies.delete(code);
            lobby.players.forEach(p => playerToLobby.delete(p.ws));
        }
    }
}, 5 * 60 * 1000); // Check every 5 minutes

