import test from 'node:test';
import assert from 'node:assert/strict';

// Load mock DOM / environment dependencies if needed
globalThis.window = globalThis;

// Load simulation modules
await import('../src/game/simulation/combat-economy.js');
await import('../src/game/simulation/run-rewards.js');
await import('../src/game/simulation/kill-rewards.js');

test('GameRunRewards.isArenaMode detection', (t) => {
    const gearGame = { gameMode: 'gear', activeSessionId: 'roguelike' };
    const arenaGame1 = { gameMode: 'arena' };
    const arenaGame2 = { activeSessionId: 'surge-arena' };
    const arenaGame3 = { modeProfile: { id: 'surge-arena' } };
    const arenaGame4 = { currentRoom: { archetype: 'surgeArena' } };

    assert.equal(globalThis.GameRunRewards.isArenaMode(gearGame), false);
    assert.equal(globalThis.GameRunRewards.isArenaMode(arenaGame1), true);
    assert.equal(globalThis.GameRunRewards.isArenaMode(arenaGame2), true);
    assert.equal(globalThis.GameRunRewards.isArenaMode(arenaGame3), true);
    assert.equal(globalThis.GameRunRewards.isArenaMode(arenaGame4), true);
    assert.equal(globalThis.GameRunRewards.isArenaMode(null), false);
});

test('Shard curve calculation - Gear Mode vs Arena Mode', (t) => {
    // Gear Mode run: 10 rooms cleared (room 11), 200 kills, player lvl 10
    const gearGame = {
        gameMode: 'gear',
        activeSessionId: 'roguelike',
        roomNumber: 11,
        enemiesKilled: 200,
        player: { level: 10 }
    };
    // Expected: 12 * 10 + 2.4 * 200 + 1.2 * 10 = 120 + 480 + 12 = 612 shards
    const gearShards = globalThis.GameRunRewards.calculateShards(gearGame);
    assert.equal(gearShards, 612);

    // Arena Mode run: 10 waves cleared (wave 11), 350 kills, player lvl 10
    const arenaGame = {
        gameMode: 'gear', // Even if gameMode defaults to 'gear', activeSessionId triggers Arena mode
        activeSessionId: 'surge-arena',
        waveNumber: 11,
        roomNumber: 11,
        enemiesKilled: 350,
        player: { level: 10 }
    };
    // Expected: 15 * 10 + 0.35 * 350 + 1.0 * 10 = 150 + 122.5 + 10 = 282 shards
    const arenaShards = globalThis.GameRunRewards.calculateShards(arenaGame);
    assert.equal(arenaShards, 282);
});

test('High-kill Arena run caps kill shard explosion', (t) => {
    // 1,000 kills in 15 waves of Arena mode
    const highKillArena = {
        activeSessionId: 'surge-arena',
        waveNumber: 16,
        roomNumber: 16,
        enemiesKilled: 1000,
        player: { level: 15 }
    };
    // Old un-scaled formula (2.4 * 1000) = 2,400 shards from kills alone!
    // New tuned formula: 15 * 15 + 0.35 * 1000 + 1.0 * 15 = 225 + 350 + 15 = 590 shards
    const shards = globalThis.GameRunRewards.calculateShards(highKillArena);
    assert.equal(shards, 590);
});

test('Instant-death / Wave 0 edge case', (t) => {
    const wave0Game = {
        activeSessionId: 'surge-arena',
        waveNumber: 1,
        roomNumber: 1,
        enemiesKilled: 0,
        player: { level: 1 }
    };
    // Expected: 15 * 0 + 0.35 * 0 + 1.0 * 1 = 1 shard
    const shards = globalThis.GameRunRewards.calculateShards(wave0Game);
    assert.equal(shards, 1);
});

test('Combat credit scaling with ARENA_CREDIT_SCALE and Style Engine', (t) => {
    const savedCurrency = [];
    const mockWorldGear = {
        gameMode: 'gear',
        activeSessionId: 'roguelike',
        roomNumber: 5,
        comboCreditMultiplier: 1.0,
        awardRunCredits(amount, reason) {
            savedCurrency.push(amount);
        }
    };

    const mockWorldArena = {
        activeSessionId: 'surge-arena',
        waveNumber: 5,
        roomNumber: 5,
        comboCreditMultiplier: 1.0, // D-Rank (1.0x)
        awardRunCredits(amount, reason) {
            savedCurrency.push(amount);
        }
    };

    const mockWorldArenaS = {
        activeSessionId: 'surge-arena',
        waveNumber: 5,
        roomNumber: 5,
        comboCreditMultiplier: 3.0, // S-Rank (3.0x)
        awardRunCredits(amount, reason) {
            savedCurrency.push(amount);
        }
    };

    const mockEnemy = { constructor: { name: 'Enemy' } }; // 1 base credit

    // 1. Gear Mode kill -> 1 credit
    globalThis.GameKillRewards.awardDeathCredits(mockEnemy, mockWorldGear);
    assert.equal(savedCurrency.pop(), 1);

    // 2. Arena Mode D-Rank kill (0.35 * 1.0) -> Math.floor(1 * 1.0 * 0.35) = 0 (or 0.35 floor)
    // For 3-credit mob (RectangleEnemy) in Arena D-Rank: Math.floor(3 * 1.0 * 0.35) = 1
    const mockRec = { constructor: { name: 'RectangleEnemy' } }; // 3 base credits
    globalThis.GameKillRewards.awardDeathCredits(mockRec, mockWorldArena);
    assert.equal(savedCurrency.pop(), 1);

    // 3. Arena Mode S-Rank kill (3.0x combo): Math.floor(3 * 3.0 * 0.35) = Math.floor(3.15) = 3 credits
    globalThis.GameKillRewards.awardDeathCredits(mockRec, mockWorldArenaS);
    assert.equal(savedCurrency.pop(), 3);
});

test('CombatEconomy shard estimators match mode curves', (t) => {
    const gearEst = globalThis.CombatEconomy.estimateShardsGear(10, 200, 10);
    assert.equal(gearEst, 612);

    const arenaEst = globalThis.CombatEconomy.estimateShardsArena(10, 350, 10);
    assert.equal(arenaEst, 282);
});
