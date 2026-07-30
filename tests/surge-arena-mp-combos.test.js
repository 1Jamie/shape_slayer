const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');

// Helper to load SurgeArenaRules
function loadSurgeRules(extra) {
    const sandbox = {
        console,
        Object,
        Array,
        String,
        Math,
        TypeError,
        Map,
        Set,
        Number,
        Date,
        requestAnimationFrame: (cb) => cb()
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    Object.assign(sandbox, extra || {});
    vm.runInNewContext(
        fs.readFileSync(path.join(ROOT, 'src/game/game-bus.js'), 'utf8'),
        sandbox
    );
    vm.runInNewContext(
        fs.readFileSync(path.join(ROOT, 'src/modes/surge-arena/rules.js'), 'utf8'),
        sandbox
    );
    return sandbox;
}

// Helper to load CombatScaling
function loadCombatScaling() {
    const source = fs.readFileSync(path.join(ROOT, 'src/game/simulation/combat-scaling.js'), 'utf8');
    const ctx = { console, Math, Game: { gameMode: 'gear', difficulty: 'normal', multiplayerEnabled: false } };
    ctx.window = ctx;
    ctx.globalThis = ctx;
    vm.createContext(ctx);
    vm.runInContext(`${source}\nif (typeof CombatScaling !== 'undefined') globalThis.CombatScaling = CombatScaling;`, ctx);
    return ctx.CombatScaling;
}

// Helper to load EnemyBase class partially or mock it to test our targeted player logic
function loadEnemyBase(sandboxExtra) {
    const sandbox = {
        console,
        Object,
        Array,
        String,
        Math,
        TypeError,
        Map,
        Set,
        Number,
        Date,
        ...sandboxExtra
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    
    // Stub global functions/constructs needed by enemy-base.js
    sandbox.Vector2 = class {
        constructor(x, y) { this.x = x; this.y = y; }
    };
    sandbox.TelegraphSystem = {
        TelegraphManager: class {
            constructor() {}
        }
    };
    
    const source = fs.readFileSync(path.join(ROOT, 'src/game/entities/enemies/enemy-base.js'), 'utf8');
    vm.runInNewContext(
        `${source}\nif (typeof EnemyBase !== 'undefined') globalThis.EnemyBase = EnemyBase;`,
        sandbox
    );
    return sandbox;
}

test('CombatScaling: Surge Arena Scaling and Presets', () => {
    const CS = loadCombatScaling();
    
    // Verify surge-arena registration
    assert.ok(CS.MULTIPLAYER_SCALING['surge-arena'], 'surge-arena scaling rules should be registered');
    
    const rules = CS.MULTIPLAYER_SCALING['surge-arena'];
    assert.ok(rules[2], 'surge-arena scaling rules should contain entry for 2 players');
    assert.equal(rules[2].enemyHP, 1.35, 'surge-arena base HP scale multiplier should be 1.35');
    assert.equal(rules[2].enemyDamage, 1.0, 'surge-arena base damage scale multiplier should be 1.0');
    assert.equal(rules[2].bossHP, 1.40, 'surge-arena boss HP scale factor multiplier should be 1.40');

    // Test scaling output
    const hostCtx = CS.createContext({
        roomNumber: 5,
        gameMode: 'surge-arena',
        playerCount: 3,
        difficulty: 'normal'
    });
    const hostFactors = CS.computeScalingFactors(hostCtx);
    
    const soloCtx = CS.createContext({
        roomNumber: 5,
        gameMode: 'surge-arena',
        playerCount: 1,
        difficulty: 'normal'
    });
    const soloFactors = CS.computeScalingFactors(soloCtx);

    assert.ok(hostFactors.mp.enemyHP > soloFactors.mp.enemyHP, 'multiplayer hp should be scaled up');
    assert.ok(hostFactors.mp.enemyDamage >= soloFactors.mp.enemyDamage, 'multiplayer damage should be scaled up or equal');
});

test('SurgeArenaRules: Separate combo managers per player and next wave trigger', () => {
    const sandbox = loadSurgeRules();
    const Rules = sandbox.SurgeArenaRules;
    const GameBus = sandbox.GameBus;

    const mockWorld = {
        player: { alive: true, cooldownRegenMult: 1 },
        getLocalPlayerId: () => 'local',
        multiplayerEnabled: true,
        waveNumber: 1
    };
    sandbox.Game = mockWorld;

    // Attach GameBus
    Rules.attach(GameBus);

    // Attributing kills to different players
    GameBus.emit('combat:enemyKilled', {
        enemy: { id: 'e1' },
        attackerId: 'player-1',
        styleTag: 'light'
    });

    GameBus.emit('combat:enemyKilled', {
        enemy: { id: 'e2' },
        attackerId: 'player-2',
        styleTag: 'heavy'
    });

    const combo1 = Rules.getComboState('player-1');
    const combo2 = Rules.getComboState('player-2');

    assert.equal(combo1.comboCount, 1, 'Player 1 should have 1 combo point');
    assert.equal(combo2.comboCount, 1, 'Player 2 should have 1 combo point');

    // Client next wave start triggers next_wave_request
    let sentMsg = null;
    sandbox.multiplayerManager = {
        lobbyCode: 'XYZ',
        isHost: false,
        players: [{ id: 'player-1' }, { id: 'player-2' }],
        send: (msg) => { sentMsg = msg; }
    };

    GameBus.emit('arena:startNextWave', { world: mockWorld });
    assert.ok(sentMsg, 'Client should have sent next wave request message');
    assert.equal(sentMsg.type, 'arena_next_wave_request', 'Message type should be arena_next_wave_request');
});

test('EnemyBase: Target-driven dynamic speed/CDR style multipliers and transitions', () => {
    const rulesSandbox = loadSurgeRules();
    
    const gameMock = {
        activeSessionId: 'surge-arena',
        multiplayerEnabled: true,
        getLocalPlayerId: () => 'player-1',
        player: { id: 'player-1', x: 0, y: 0, alive: true },
        remotePlayerInstances: new Map([
            ['player-2', { id: 'player-2', x: 100, y: 100, alive: true }]
        ])
    };

    rulesSandbox.Game = gameMock;

    // Prepare fake Game / SurgeArenaRules for enemy-base loader
    const sandbox = loadEnemyBase({
        SurgeArenaRules: rulesSandbox.SurgeArenaRules,
        Game: gameMock
    });

    const Rules = rulesSandbox.SurgeArenaRules;
    const GameBus = rulesSandbox.GameBus;
    Rules.attach(GameBus);

    // Let player-1 be S-rank (tier 4), player-2 be D-rank (tier 0)
    const combo1 = Rules.getComboState('player-1');
    for (let i = 0; i < 60; i++) {
        combo1.onKill(gameMock, { styleTag: i % 2 === 0 ? 'light' : 'heavy' });
    }
    assert.equal(combo1.comboTier, 4, 'player-1 should be S rank');

    const combo2 = Rules.getComboState('player-2');
    assert.equal(combo2.comboTier, 0, 'player-2 should be D rank');

    // Setup an enemy instance
    const enemy = new sandbox.EnemyBase({
        id: 'enemy-1',
        x: 50,
        y: 50,
        shape: 'basic',
        profileId: 'enemy_basic'
    });

    // Case 1: Target player-1 (S rank) -> High style speed multipliers
    enemy.targetLock = { playerRef: gameMock.player };
    const mults1 = enemy.getStyleMultipliers();
    assert.ok(mults1.enemyMoveMult > 1.0, 'Speed multiplier targeting S rank player should be > 1.0');
    assert.ok(mults1.telegraphMult < 1.0, 'Cooldown/telegraph multiplier targeting S rank player should be < 1.0 (faster windups)');

    // Case 2: Target player-2 (D rank) -> baseline style speed multipliers
    enemy.targetLock = { playerRef: gameMock.remotePlayerInstances.get('player-2') };
    const mults2 = enemy.getStyleMultipliers();
    assert.equal(mults2.enemyMoveMult, 1.0, 'Speed multiplier targeting D rank player should be 1.0');
    assert.equal(mults2.telegraphMult, 1.0, 'Cooldown/telegraph multiplier targeting D rank player should be 1.0');

    // Case 3: Target construct/decoy (shadow clone) -> inherits creator style
    const clone = { isConstruct: true, playerRef: gameMock.player };
    enemy.targetLock = clone;
    const mults3 = enemy.getStyleMultipliers();
    assert.ok(mults3.enemyMoveMult > 1.0, 'Targeting clone of player-1 should inherit player-1 S rank difficulty');

    // Case 4: Target transitions/threat drop fallback
    enemy.targetLock = null;
    enemy.currentTarget = 'player-2';
    const mults4 = enemy.getStyleMultipliers();
    assert.equal(mults4.enemyMoveMult, 1.0, 'Fallback to currentTarget (D-rank player-2) should result in 1.0 speed multiplier');
});
