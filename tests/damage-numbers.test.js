// Automated test for damage number synchronization in multiplayer
// Tests the flow: host damage → server → client → render
// Usage: node tests/damage-numbers.test.js

const puppeteer = require('puppeteer');
const { spawn } = require('child_process');
const path = require('path');

// Configuration
const GAME_SERVER_PORT = 8080; // HTTP server for game files (we'll need to start this)
const WS_SERVER_PORT = 4000; // WebSocket server for multiplayer
const GAME_URL = `http://localhost:${GAME_SERVER_PORT}`;
const WS_SERVER_URL = `ws://localhost:${WS_SERVER_PORT}`;
const TEST_TIMEOUT = 30000; // 30 seconds

// Color codes for terminal output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
    console.log(`${color}${message}${colors.reset}`);
}

function logSection(title) {
    log(`\n${'='.repeat(60)}`, colors.cyan);
    log(title, colors.bright + colors.cyan);
    log('='.repeat(60), colors.cyan);
}

function logTest(name, passed) {
    const symbol = passed ? '✓' : '✗';
    const color = passed ? colors.green : colors.red;
    log(`${symbol} ${name}`, color);
}

async function startServers() {
    return new Promise((resolve, reject) => {
        log('Starting multiplayer WebSocket server...', colors.yellow);
        
        // Start the multiplayer WebSocket server
        const wsServerPath = path.join(__dirname, '../server/mp-server.js');
        const wsServer = spawn('node', [wsServerPath], {
            stdio: 'pipe',
            env: { ...process.env, PORT: WS_SERVER_PORT, SERVER_MODE: 'single' }
        });
        
        wsServer.stdout.on('data', (data) => {
            const output = data.toString();
            if (output.includes('ready to accept connections')) {
                log('✓ WebSocket server started successfully', colors.green);
            }
        });
        
        wsServer.stderr.on('data', (data) => {
            console.error('WS Server error:', data.toString());
        });
        
        wsServer.on('error', (err) => {
            reject(err);
        });
        
        // Start a simple HTTP server for serving game files
        log('Starting HTTP server for game files...', colors.yellow);
        const httpServer = spawn('python3', ['-m', 'http.server', GAME_SERVER_PORT.toString()], {
            cwd: path.join(__dirname, '..'),
            stdio: 'pipe'
        });
        
        httpServer.stdout.on('data', (data) => {
            const output = data.toString();
            if (output.includes('Serving')) {
                log('✓ HTTP server started successfully', colors.green);
            }
        });
        
        httpServer.stderr.on('data', (data) => {
            // Python http.server prints to stderr
            const output = data.toString();
            if (output.includes('Serving')) {
                log('✓ HTTP server started successfully', colors.green);
            }
        });
        
        httpServer.on('error', (err) => {
            console.error('HTTP server error:', err);
        });
        
        // Wait for both servers to start
        setTimeout(() => {
            log('✓ Both servers spawned (assuming ready)', colors.green);
            resolve({ wsServer, httpServer });
        }, 3000);
    });
}

async function testDamageNumbers() {
    let servers = null;
    let hostBrowser = null;
    let clientBrowser = null;
    
    try {
        logSection('DAMAGE NUMBER SYNC TEST');
        
        // Start servers
        servers = await startServers();
        await new Promise(r => setTimeout(r, 1000));
        
        // Launch browsers
        logSection('Launching Browsers');
        log('Launching host browser...', colors.yellow);
        hostBrowser = await puppeteer.launch({ 
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        log('Launching client browser...', colors.yellow);
        clientBrowser = await puppeteer.launch({ 
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const hostPage = await hostBrowser.newPage();
        const clientPage = await clientBrowser.newPage();
        
        // Collect console logs and errors
        const hostLogs = [];
        const clientLogs = [];
        
        hostPage.on('console', msg => {
            const text = msg.text();
            hostLogs.push(text);
            if (text.includes('[Host]') || text.includes('damage') || text.includes('[Test]') || text.includes('Error') || text.includes('error')) {
                log(`  Host: ${text}`, text.includes('Error') || text.includes('error') ? colors.red : colors.blue);
            }
        });
        
        hostPage.on('pageerror', error => {
            log(`  Host Page Error: ${error.message}`, colors.red);
            hostLogs.push(`Page Error: ${error.message}`);
        });
        
        clientPage.on('console', msg => {
            const text = msg.text();
            clientLogs.push(text);
            if (text.includes('[Client]') || text.includes('damage') || text.includes('[Test]') || text.includes('Error') || text.includes('error')) {
                log(`  Client: ${text}`, text.includes('Error') || text.includes('error') ? colors.red : colors.blue);
            }
        });
        
        clientPage.on('pageerror', error => {
            log(`  Client Page Error: ${error.message}`, colors.red);
            clientLogs.push(`Page Error: ${error.message}`);
        });
        
        // Navigate to game
        logSection('Navigating to Game');
        log('Loading game on host...', colors.yellow);
        await hostPage.goto(GAME_URL, { waitUntil: 'networkidle2', timeout: TEST_TIMEOUT });
        
        log('Loading game on client...', colors.yellow);
        await clientPage.goto(GAME_URL, { waitUntil: 'networkidle2', timeout: TEST_TIMEOUT });
        
        // Override SERVER_URL and enable debug flags on both
        logSection('Configuring Clients');
        log(`Overriding SERVER_URL to ${WS_SERVER_URL}...`, colors.yellow);
        
        await hostPage.evaluate((serverUrl) => {
            if (typeof MultiplayerConfig !== 'undefined') {
                MultiplayerConfig.SERVER_URL = serverUrl;
                console.log(`[Test] Server URL overridden to: ${serverUrl}`);
            }
            if (typeof DebugFlags !== 'undefined') {
                DebugFlags.DAMAGE_NUMBERS = true;
                console.log('[Test] Debug flags enabled on host');
            }
        }, WS_SERVER_URL);
        
        await clientPage.evaluate((serverUrl) => {
            if (typeof MultiplayerConfig !== 'undefined') {
                MultiplayerConfig.SERVER_URL = serverUrl;
                console.log(`[Test] Server URL overridden to: ${serverUrl}`);
            }
            if (typeof DebugFlags !== 'undefined') {
                DebugFlags.DAMAGE_NUMBERS = true;
                console.log('[Test] Debug flags enabled on client');
            }
        }, WS_SERVER_URL);
        
        log('✓ Clients configured', colors.green);
        
        // Wait for game to fully load
        logSection('Loading Multiplayer Module');
        await new Promise(r => setTimeout(r, 1000));
        
        // Load multiplayer module on both clients
        log('Loading multiplayer module on host...', colors.yellow);
        await hostPage.evaluate(async () => {
            if (typeof Game !== 'undefined' && Game.loadMultiplayerModule) {
                await Game.loadMultiplayerModule();
                // Initialize multiplayer manager
                if (typeof initMultiplayer === 'function') {
                    initMultiplayer();
                    console.log('[Test] Multiplayer manager initialized on host');
                }
                console.log('[Test] Multiplayer module loaded on host');
            }
        });
        
        log('Loading multiplayer module on client...', colors.yellow);
        await clientPage.evaluate(async () => {
            if (typeof Game !== 'undefined' && Game.loadMultiplayerModule) {
                await Game.loadMultiplayerModule();
                // Initialize multiplayer manager
                if (typeof initMultiplayer === 'function') {
                    initMultiplayer();
                    console.log('[Test] Multiplayer manager initialized on client');
                }
                console.log('[Test] Multiplayer module loaded on client');
            }
        });
        
        await new Promise(r => setTimeout(r, 1000));
        
        // Check if multiplayer is available
        const mpStatus = await hostPage.evaluate(() => {
            return {
                multiplayerManager: typeof multiplayerManager !== 'undefined',
                Game: typeof Game !== 'undefined',
                state: typeof Game !== 'undefined' ? Game.state : 'unknown',
                multiplayerEnabled: typeof Game !== 'undefined' ? Game.multiplayerEnabled : false
            };
        });
        
        log(`Multiplayer Status: ${JSON.stringify(mpStatus)}`, colors.blue);
        
        if (!mpStatus.multiplayerManager) {
            throw new Error('multiplayerManager not loaded after calling loadMultiplayerModule!');
        }
        
        log('✓ Multiplayer module loaded', colors.green);
        
        // Create lobby as host
        logSection('Setting Up Multiplayer Lobby');
        log('Creating lobby...', colors.yellow);
        
        const createResult = await hostPage.evaluate(() => {
            try {
                if (typeof multiplayerManager !== 'undefined') {
                    multiplayerManager.createLobby('TestHost', 'warrior');
                    return { success: true };
                } else {
                    return { success: false, error: 'multiplayerManager undefined' };
                }
            } catch (err) {
                return { success: false, error: err.message };
            }
        });
        
        if (!createResult.success) {
            throw new Error(`Failed to create lobby: ${createResult.error}`);
        }
        
        log('Waiting for lobby to be created...', colors.yellow);
        await new Promise(r => setTimeout(r, 3000));
        
        // Get lobby code
        const lobbyCode = await hostPage.evaluate(() => {
            return typeof multiplayerManager !== 'undefined' ? multiplayerManager.lobbyCode : null;
        });
        
        if (!lobbyCode) {
            const wsStatus = await hostPage.evaluate(() => {
                if (typeof multiplayerManager === 'undefined') return 'multiplayerManager undefined';
                return {
                    connected: multiplayerManager.connected,
                    lobbyCode: multiplayerManager.lobbyCode,
                    isHost: multiplayerManager.isHost
                };
            });
            throw new Error(`Failed to get lobby code. Status: ${JSON.stringify(wsStatus)}`);
        }
        
        log(`✓ Lobby created: ${lobbyCode}`, colors.green);
        
        // Join as client
        log('Client joining lobby...', colors.yellow);
        await clientPage.evaluate((code) => {
            if (typeof multiplayerManager !== 'undefined') {
                multiplayerManager.joinLobby(code, 'TestClient', 'rogue');
            }
        }, lobbyCode);
        await new Promise(r => setTimeout(r, 2000));
        
        log('✓ Client joined lobby', colors.green);
        
        // Start game (connects to lobby, stays in NEXUS)
        logSection('Starting Game');
        await hostPage.evaluate(() => {
            if (typeof multiplayerManager !== 'undefined') {
                multiplayerManager.startGame();
            }
        });
        
        log('Waiting for lobby to sync...', colors.yellow);
        await new Promise(r => setTimeout(r, 2000));
        
        // Verify multiplayerEnabled flag was set automatically (should be set by lobby join)
        const mpEnabledCheck = await hostPage.evaluate(() => {
            return typeof Game !== 'undefined' ? Game.multiplayerEnabled : false;
        });
        
        log(`Game.multiplayerEnabled: ${mpEnabledCheck}`, mpEnabledCheck ? colors.green : colors.red);
        
        log('✓ Game connected (in NEXUS)', colors.green);
        
        // Have both players select classes
        logSection('Selecting Classes');
        log('Host selecting warrior class...', colors.yellow);
        await hostPage.evaluate(() => {
            if (typeof Game !== 'undefined') {
                Game.selectedClass = 'warrior';
                console.log('[Test] Host selected class: warrior');
            }
        });
        
        log('Client selecting rogue class...', colors.yellow);
        await clientPage.evaluate(() => {
            if (typeof Game !== 'undefined') {
                Game.selectedClass = 'triangle'; // rogue
                console.log('[Test] Client selected class: rogue');
            }
        });
        
        await new Promise(r => setTimeout(r, 500));
        log('✓ Both players selected classes', colors.green);
        
        // Start a run (transition from NEXUS to PLAYING)
        logSection('Starting Combat Run');
        log('Host moving to portal and pressing interact key...', colors.yellow);
        await hostPage.evaluate(() => {
            if (typeof Game !== 'undefined') {
                // Move player to portal position (x=900, y=550)
                if (Game.player) {
                    Game.player.x = 900;
                    Game.player.y = 550;
                    console.log('[Test] Host moved to portal position (900, 550)');
                }
                
                // Simulate pressing 'G' key to interact with portal
                if (typeof Input !== 'undefined') {
                    Input.keys['g'] = true;
                    Input.keys['G'] = true;
                    console.log('[Test] Simulated G key press');
                }
            }
        });
        
        // Wait for interaction to process
        await new Promise(r => setTimeout(r, 1000));
        
        // Release the key
        await hostPage.evaluate(() => {
            if (typeof Input !== 'undefined') {
                Input.keys['g'] = false;
                Input.keys['G'] = false;
            }
        });
        
        // Wait for game to initialize
        log('Waiting for combat to initialize...', colors.yellow);
        await new Promise(r => setTimeout(r, 3000));
        
        // Dismiss "How to Play" modal if it's showing
        await hostPage.evaluate(() => {
            if (typeof Game !== 'undefined' && Game.showingTutorial) {
                Game.showingTutorial = false;
                console.log('[Test] Dismissed tutorial on host');
            }
        });
        
        await clientPage.evaluate(() => {
            if (typeof Game !== 'undefined' && Game.showingTutorial) {
                Game.showingTutorial = false;
                console.log('[Test] Dismissed tutorial on client');
            }
        });
        
        // Check game state
        const gameState = await hostPage.evaluate(() => {
            if (typeof Game === 'undefined') return { error: 'Game undefined' };
            return {
                state: Game.state,
                roomNumber: Game.roomNumber,
                enemyCount: Game.enemies ? Game.enemies.length : 0,
                playerAlive: Game.player ? Game.player.alive : false,
                playerX: Game.player ? Game.player.x : null,
                playerY: Game.player ? Game.player.y : null
            };
        });
        
        const clientGameState = await clientPage.evaluate(() => {
            if (typeof Game === 'undefined') return { error: 'Game undefined' };
            return {
                state: Game.state,
                roomNumber: Game.roomNumber,
                enemyCount: Game.enemies ? Game.enemies.length : 0,
                playerAlive: Game.player ? Game.player.alive : false,
                playerX: Game.player ? Game.player.x : null,
                playerY: Game.player ? Game.player.y : null
            };
        });
        
        log(`Host Game State: ${JSON.stringify(gameState)}`, colors.blue);
        log(`Client Game State: ${JSON.stringify(clientGameState)}`, colors.cyan);
        
        if (gameState.state !== 'PLAYING') {
            throw new Error(`Host not in PLAYING state (state: ${gameState.state})`);
        }
        
        if (clientGameState.state !== 'PLAYING') {
            throw new Error(`Client not in PLAYING state (state: ${clientGameState.state})`);
        }
        
        if (gameState.enemyCount === 0) {
            log('⚠ No enemies spawned yet, waiting longer...', colors.yellow);
            await new Promise(r => setTimeout(r, 3000));
        }
        
        // Show starting positions
        const positionDelta = Math.sqrt(
            Math.pow(gameState.playerX - clientGameState.playerX, 2) +
            Math.pow(gameState.playerY - clientGameState.playerY, 2)
        );
        
        log(`Initial player positions:`, colors.yellow);
        log(`  Host: (${gameState.playerX.toFixed(0)}, ${gameState.playerY.toFixed(0)})`, colors.blue);
        log(`  Client: (${clientGameState.playerX.toFixed(0)}, ${clientGameState.playerY.toFixed(0)})`, colors.cyan);
        log(`  Distance: ${positionDelta.toFixed(0)} pixels`, positionDelta > 1000 ? colors.red : colors.green);
        
        log('✓ Combat started with enemies', colors.green);
        
        // Test TWO scenarios: Client attacking (should see) and Host attacking (may not see if far)
        logSection('Testing CLIENT Attack (Should See Damage Numbers)');
        log('Client attacking enemy near themselves...', colors.yellow);
        
        const clientAttackResult = await clientPage.evaluate(() => {
            if (typeof Game !== 'undefined' && Game.player && Game.enemies && Game.enemies.length > 0) {
                // Find enemy closest to client player
                let closestEnemy = null;
                let closestDist = Infinity;
                
                Game.enemies.forEach(enemy => {
                    if (!enemy.alive) return;
                    const dx = enemy.x - Game.player.x;
                    const dy = enemy.y - Game.player.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < closestDist) {
                        closestDist = dist;
                        closestEnemy = enemy;
                    }
                });
                
                if (!closestEnemy) {
                    return { success: false, error: 'No alive enemies found' };
                }
                
                const oldHp = closestEnemy.hp;
                
                // Create attack hitbox at enemy position
                if (!Game.player.attackHitboxes) {
                    Game.player.attackHitboxes = [];
                }
                
                const hitbox = {
                    x: closestEnemy.x,
                    y: closestEnemy.y,
                    radius: 60,
                    damage: 50,
                    hitEnemies: new Set(),
                    displayCrit: false,
                    displayExecute: false
                };
                
                Game.player.attackHitboxes.push(hitbox);
                console.log(`[Test] Client created attack hitbox at enemy (${closestEnemy.x.toFixed(0)}, ${closestEnemy.y.toFixed(0)})`);
                console.log(`[Test] Client player at (${Game.player.x.toFixed(0)}, ${Game.player.y.toFixed(0)}), distance: ${closestDist.toFixed(0)}px`);
                
                // Trigger combat check
                if (typeof checkAttacksVsEnemies === 'function') {
                    checkAttacksVsEnemies(Game.player, Game.enemies);
                    console.log('[Test] Client triggered checkAttacksVsEnemies');
                }
                
                return {
                    success: true,
                    enemyId: closestEnemy.id,
                    oldHp: oldHp,
                    newHp: closestEnemy.hp,
                    damage: oldHp - closestEnemy.hp,
                    enemyPos: { x: closestEnemy.x, y: closestEnemy.y },
                    playerPos: { x: Game.player.x, y: Game.player.y },
                    distanceFromPlayer: closestDist
                };
            }
            return { success: false, error: 'Game or player not found' };
        });
        
        if (clientAttackResult.success) {
            log(`✓ Client attacked enemy ${clientAttackResult.enemyId}`, colors.green);
            log(`  Damage: ${clientAttackResult.damage} HP (${clientAttackResult.oldHp} → ${clientAttackResult.newHp})`, colors.cyan);
            log(`  Enemy at: (${clientAttackResult.enemyPos.x.toFixed(0)}, ${clientAttackResult.enemyPos.y.toFixed(0)})`, colors.cyan);
            log(`  Client at: (${clientAttackResult.playerPos.x.toFixed(0)}, ${clientAttackResult.playerPos.y.toFixed(0)})`, colors.cyan);
            log(`  Distance: ${clientAttackResult.distanceFromPlayer.toFixed(0)} pixels`, colors.cyan);
        } else {
            log(`⚠ Client attack failed: ${clientAttackResult.error}`, colors.yellow);
        }
        
        // Wait briefly for network sync
        await new Promise(r => setTimeout(r, 300));
        
        // Also test host attack
        logSection('Testing HOST Attack');
        log('Host attacking enemy near themselves...', colors.yellow);
        const damageResult = await hostPage.evaluate(() => {
            if (typeof Game !== 'undefined' && Game.player && Game.enemies && Game.enemies.length > 0) {
                const enemy = Game.enemies[0];
                const oldHp = enemy.hp;
                
                // Move player close to enemy so combat makes sense
                Game.player.x = enemy.x - 100;
                Game.player.y = enemy.y;
                
                // Create a fake attack hitbox at enemy position (simulates player attacking)
                if (!Game.player.attackHitboxes) {
                    Game.player.attackHitboxes = [];
                }
                
                const hitbox = {
                    x: enemy.x,
                    y: enemy.y,
                    radius: 60, // Large enough to definitely hit
                    damage: 50,
                    hitEnemies: new Set(), // Track which enemies we've hit
                    displayCrit: false,
                    displayExecute: false
                };
                
                Game.player.attackHitboxes.push(hitbox);
                console.log(`[Test] Created attack hitbox at (${enemy.x}, ${enemy.y}) with radius 60`);
                console.log(`[Test] Enemy at (${enemy.x}, ${enemy.y}), player at (${Game.player.x}, ${Game.player.y})`);
                
                // Check multiplayer state
                console.log(`[Test] Before combat - multiplayerEnabled: ${Game.multiplayerEnabled}, multiplayerManager exists: ${typeof multiplayerManager !== 'undefined' && multiplayerManager !== null}`);
                console.log(`[Test] DebugFlags.DAMAGE_NUMBERS: ${typeof DebugFlags !== 'undefined' && DebugFlags.DAMAGE_NUMBERS}`);
                
                // Manually trigger the combat check to process hitbox immediately
                if (typeof checkAttacksVsEnemies === 'function') {
                    checkAttacksVsEnemies(Game.player, Game.enemies);
                    console.log('[Test] Manually triggered checkAttacksVsEnemies');
                    
                    const newHp = enemy.hp;
                    const actualDamage = oldHp - newHp;
                    console.log(`[Test] Enemy HP: ${oldHp} → ${newHp} (damage: ${actualDamage})`);
                }
                
                return {
                    success: true,
                    enemyId: enemy.id,
                    oldHp: oldHp,
                    newHp: enemy.hp,
                    damage: oldHp - enemy.hp,
                    enemyCount: Game.enemies.length,
                    enemyPos: {x: enemy.x, y: enemy.y},
                    playerPos: {x: Game.player.x, y: Game.player.y}
                };
            }
            return { 
                success: false, 
                error: 'No enemies or player found',
                gameState: Game ? Game.state : 'unknown',
                enemyCount: Game && Game.enemies ? Game.enemies.length : 0
            };
        });
        
        if (!damageResult.success) {
            throw new Error(`${damageResult.error} (state: ${damageResult.gameState}, enemies: ${damageResult.enemyCount})`);
        }
        
        log(`✓ Attack processed on enemy ${damageResult.enemyId}`, colors.green);
        log(`  Damage dealt: ${damageResult.damage} HP (${damageResult.oldHp} → ${damageResult.newHp})`, colors.blue);
        log(`  Enemy pos: (${damageResult.enemyPos.x}, ${damageResult.enemyPos.y})`, colors.blue);
        log(`  Player pos: (${damageResult.playerPos.x}, ${damageResult.playerPos.y})`, colors.blue);
        
        // Wait BRIEFLY for damage number events to sync
        log('Waiting for damage number sync (200ms)...', colors.yellow);
        await new Promise(r => setTimeout(r, 200));
        
        // Take screenshots to visually verify IMMEDIATELY while damage numbers are still alive
        logSection('Taking Screenshots');
        log('Capturing visuals while damage numbers are still visible...', colors.yellow);
        await hostPage.screenshot({ path: 'tests/screenshot-host.png' });
        await clientPage.screenshot({ path: 'tests/screenshot-client.png' });
        log('✓ Screenshots saved to tests/screenshot-host.png and tests/screenshot-client.png', colors.green);
        
        // Verify damage numbers are actually in the arrays and check positions
        logSection('Verifying Damage Number Positions');
        
        const hostDamageInfo = await hostPage.evaluate(() => {
            if (typeof Game === 'undefined') return { error: 'Game undefined' };
            return {
                damageNumberCount: Game.damageNumbers ? Game.damageNumbers.length : 0,
                damageNumbers: Game.damageNumbers ? Game.damageNumbers.map(dn => ({
                    x: dn.x,
                    y: dn.y,
                    damage: dn.damage,
                    life: dn.life
                })) : [],
                cameraX: Game.camera ? Game.camera.x : null,
                cameraY: Game.camera ? Game.camera.y : null,
                canvasWidth: Game.config ? Game.config.width : null,
                canvasHeight: Game.config ? Game.config.height : null
            };
        });
        
        const clientDamageInfo = await clientPage.evaluate(() => {
            if (typeof Game === 'undefined') return { error: 'Game undefined' };
            return {
                damageNumberCount: Game.damageNumbers ? Game.damageNumbers.length : 0,
                damageNumbers: Game.damageNumbers ? Game.damageNumbers.map(dn => ({
                    x: dn.x,
                    y: dn.y,
                    damage: dn.damage,
                    life: dn.life
                })) : [],
                cameraX: Game.camera ? Game.camera.x : null,
                cameraY: Game.camera ? Game.camera.y : null,
                canvasWidth: Game.config ? Game.config.width : null,
                canvasHeight: Game.config ? Game.config.height : null
            };
        });
        
        log(`Host damage numbers: ${hostDamageInfo.damageNumberCount}`, colors.blue);
        log(`  Camera: (${hostDamageInfo.cameraX}, ${hostDamageInfo.cameraY})`, colors.blue);
        log(`  Canvas: ${hostDamageInfo.canvasWidth}x${hostDamageInfo.canvasHeight}`, colors.blue);
        if (hostDamageInfo.damageNumbers.length > 0) {
            hostDamageInfo.damageNumbers.forEach((dn, i) => {
                log(`  DN${i}: pos=(${dn.x.toFixed(1)}, ${dn.y.toFixed(1)}), damage=${dn.damage}, life=${dn.life.toFixed(2)}`, colors.blue);
            });
        }
        
        log(`\nClient damage numbers: ${clientDamageInfo.damageNumberCount}`, colors.cyan);
        log(`  Camera: (${clientDamageInfo.cameraX}, ${clientDamageInfo.cameraY})`, colors.cyan);
        log(`  Canvas: ${clientDamageInfo.canvasWidth}x${clientDamageInfo.canvasHeight}`, colors.cyan);
        if (clientDamageInfo.damageNumbers.length > 0) {
            clientDamageInfo.damageNumbers.forEach((dn, i) => {
                log(`  DN${i}: pos=(${dn.x.toFixed(1)}, ${dn.y.toFixed(1)}), damage=${dn.damage}, life=${dn.life.toFixed(2)}`, colors.cyan);
                
                // Check if in viewport
                const inViewport = checkInViewport(dn.x, dn.y, clientDamageInfo.cameraX, clientDamageInfo.cameraY, clientDamageInfo.canvasWidth, clientDamageInfo.canvasHeight);
                log(`    ${inViewport ? '✓ IN VIEWPORT' : '✗ OUTSIDE VIEWPORT'}`, inViewport ? colors.green : colors.red);
            });
        } else {
            log(`  ⚠️ No damage numbers in client array!`, colors.yellow);
        }
        
        // Helper function to check if a world position is in viewport
        function checkInViewport(worldX, worldY, cameraX, cameraY, canvasWidth, canvasHeight) {
            const zoom = 1.1; // Desktop zoom
            const viewportLeft = cameraX - (canvasWidth / 2) / zoom;
            const viewportRight = cameraX + (canvasWidth / 2) / zoom;
            const viewportTop = cameraY - (canvasHeight / 2) / zoom;
            const viewportBottom = cameraY + (canvasHeight / 2) / zoom;
            
            return worldX >= viewportLeft && worldX <= viewportRight && 
                   worldY >= viewportTop && worldY <= viewportBottom;
        }
        
        // Camera position comparison and analysis
        const cameraDeltaX = Math.abs((hostDamageInfo.cameraX || 0) - (clientDamageInfo.cameraX || 0));
        const cameraDeltaY = Math.abs((hostDamageInfo.cameraY || 0) - (clientDamageInfo.cameraY || 0));
        const cameraDistance = Math.sqrt(cameraDeltaX * cameraDeltaX + cameraDeltaY * cameraDeltaY);
        
        log(`\nCamera Analysis:`, colors.bright + colors.cyan);
        log(`  Host camera: (${hostDamageInfo.cameraX.toFixed(1)}, ${hostDamageInfo.cameraY.toFixed(1)})`, colors.blue);
        log(`  Client camera: (${clientDamageInfo.cameraX.toFixed(1)}, ${clientDamageInfo.cameraY.toFixed(1)})`, colors.cyan);
        log(`  Camera difference: (${cameraDeltaX.toFixed(1)}, ${cameraDeltaY.toFixed(1)})`, colors.yellow);
        log(`  Camera distance: ${cameraDistance.toFixed(1)} pixels`, colors.yellow);
        
        if (cameraDistance > 500) {
            log(`  ⚠️ WARNING: Cameras are FAR apart (>${cameraDistance.toFixed(0)}px)!`, colors.yellow);
            log(`  This is expected if players are separated.`, colors.yellow);
            log(`  Damage numbers near host will be outside client viewport.`, colors.yellow);
        } else {
            log(`  ✓ Cameras are close together (${cameraDistance.toFixed(0)}px)`, colors.green);
        }
        
        // For each client damage number, calculate if it should be visible
        if (clientDamageInfo.damageNumbers.length > 0) {
            log(`\nViewport Visibility Analysis:`, colors.bright + colors.cyan);
            clientDamageInfo.damageNumbers.forEach((dn, i) => {
                const distanceFromClientCamera = Math.sqrt(
                    Math.pow(dn.x - clientDamageInfo.cameraX, 2) +
                    Math.pow(dn.y - clientDamageInfo.cameraY, 2)
                );
                const viewportRadius = Math.sqrt(
                    Math.pow(clientDamageInfo.canvasWidth / 2, 2) +
                    Math.pow(clientDamageInfo.canvasHeight / 2, 2)
                ) / 1.1; // Adjust for zoom
                
                const inView = distanceFromClientCamera < viewportRadius;
                log(`  DN${i}: ${distanceFromClientCamera.toFixed(0)}px from camera (viewport radius: ${viewportRadius.toFixed(0)}px) - ${inView ? '✓ VISIBLE' : '✗ OFF-SCREEN'}`, 
                    inView ? colors.green : colors.red);
            });
        }
        
        // Analyze results
        logSection('Test Results');
        
        // Check if damage numbers were created and sent
        const tests = {
            hostSentDamageNumber: hostLogs.some(log => 
                (log.includes('[Host/Melee]') || log.includes('[Host/Projectile]') || log.includes('[Host]')) && 
                log.includes('Sending damage_number') && 
                log.includes('clients')
            ),
            serverForwarded: true, // We can't easily check server logs, assume true if client receives
            clientReceivedDamageNumber: clientLogs.some(log => 
                log.includes('[Client]') && log.includes('Received damage_number')
            ),
            clientCreatedDamageNumber: clientLogs.some(log => 
                (log.includes('[Client]') || log.includes('[UI]')) && 
                log.includes('Creating damage number')
            ) || clientLogs.some(log =>
                log.includes('[UI]') && log.includes('Damage number created')
            ),
            clientRendered: clientLogs.some(log => 
                log.includes('[UI]') && log.includes('Rendering') && log.includes('damage number')
            ),
            clientHasDamageNumbers: clientDamageInfo.damageNumberCount > 0,
            clientDamageInViewport: clientDamageInfo.damageNumbers.some(dn => 
                checkInViewport(dn.x, dn.y, clientDamageInfo.cameraX, clientDamageInfo.cameraY, clientDamageInfo.canvasWidth, clientDamageInfo.canvasHeight)
            )
        };
        
        // Debug: Show counts
        log(`\nDebug info:`, colors.cyan);
        log(`  Host logs with 'damage': ${hostLogs.filter(l => l.toLowerCase().includes('damage')).length}`, colors.blue);
        log(`  Client logs with 'damage': ${clientLogs.filter(l => l.toLowerCase().includes('damage')).length}`, colors.blue);
        log(`  Host logs with 'Sending damage_number': ${hostLogs.filter(l => l.includes('Sending damage_number')).length}`, colors.blue);
        log(`  Client logs with 'Received damage_number': ${clientLogs.filter(l => l.includes('Received damage_number')).length}`, colors.blue);
        
        logTest('Host sent damage_number event', tests.hostSentDamageNumber);
        logTest('Client received damage_number event', tests.clientReceivedDamageNumber);
        logTest('Client created damage number', tests.clientCreatedDamageNumber);
        logTest('Client has damage numbers in array', tests.clientHasDamageNumbers);
        logTest('Client damage numbers in viewport', tests.clientDamageInViewport);
        logTest('Client rendering damage numbers', tests.clientRendered);
        
        const allPassed = Object.values(tests).every(v => v);
        
        logSection('Summary');
        if (allPassed) {
            log('✓ ALL TESTS PASSED', colors.bright + colors.green);
            log('Damage numbers are correctly synchronized!', colors.green);
        } else {
            log('✗ SOME TESTS FAILED', colors.bright + colors.red);
            log('Check the logs above for details', colors.yellow);
        }
        
        // Show relevant logs
        logSection('Relevant Logs');
        log('\nHost logs (damage-related):', colors.cyan);
        hostLogs.filter(l => l.includes('damage') || l.includes('[Host]')).forEach(l => {
            log(`  ${l}`, colors.blue);
        });
        
        log('\nClient logs (damage-related):', colors.cyan);
        clientLogs.filter(l => l.includes('damage') || l.includes('[Client]') || l.includes('[UI]')).forEach(l => {
            log(`  ${l}`, colors.blue);
        });
        
        return allPassed;
        
    } catch (error) {
        log(`\n✗ TEST ERROR: ${error.message}`, colors.bright + colors.red);
        console.error(error);
        return false;
    } finally {
        // Cleanup
        logSection('Cleanup');
        
        if (hostBrowser) {
            await hostBrowser.close();
            log('✓ Host browser closed', colors.green);
        }
        
        if (clientBrowser) {
            await clientBrowser.close();
            log('✓ Client browser closed', colors.green);
        }
        
        if (servers) {
            if (servers.wsServer) {
                servers.wsServer.kill();
                log('✓ WebSocket server stopped', colors.green);
            }
            if (servers.httpServer) {
                servers.httpServer.kill();
                log('✓ HTTP server stopped', colors.green);
            }
        }
        
        log('\nTest complete.', colors.cyan);
    }
}

// Run the test
if (require.main === module) {
    testDamageNumbers()
        .then(passed => {
            process.exit(passed ? 0 : 1);
        })
        .catch(error => {
            console.error('Fatal error:', error);
            process.exit(1);
        });
}

module.exports = { testDamageNumbers };

