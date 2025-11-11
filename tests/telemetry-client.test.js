const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadTelemetry() {
    const scriptPath = path.join(__dirname, '..', 'js', 'telemetry.js');
    const source = fs.readFileSync(scriptPath, 'utf-8');
    global.window = global;
    global.Game = {
        VERSION: '1.2.3',
        multiplayerEnabled: false,
        getLocalPlayerId: () => 'local',
        roomNumber: 1,
        isHost: () => true
    };
    vm.runInThisContext(source, { filename: 'telemetry.js' });
    return global.Telemetry;
}

test('Telemetry serializes run metrics', () => {
    const Telemetry = loadTelemetry();

    const playerState = {
        playerClass: 'warrior',
        damage: 42,
        defense: 0.2,
        moveSpeed: 300,
        attackSpeedMultiplier: 1.1,
        critChance: 0.15,
        critDamageMultiplier: 2,
        hp: 95,
        maxHp: 100,
        lifesteal: 0.05,
        cooldownReduction: 0.1,
        level: 4,
        xp: 120,
        xpToNext: 200,
        weapon: {
            id: 'sword-01',
            name: 'Test Sword',
            tier: 'blue',
            weaponType: 'fast',
            affixes: [{ type: 'attackSpeed', value: 0.12, tier: 'basic' }]
        },
        armor: {
            id: 'armor-01',
            name: 'Test Armor',
            tier: 'green',
            armorType: 'medium',
            affixes: [{ type: 'maxHealth', value: 30, tier: 'basic' }]
        },
        accessory: {
            id: 'ring-01',
            name: 'Test Ring',
            tier: 'purple',
            affixes: [{ type: 'critChance', value: 0.07, tier: 'advanced' }]
        }
    };

    const players = [
        { player: playerState, playerId: 'local' }
    ];

    Telemetry.startRun({
        mode: 'singleplayer',
        hostPlayerId: 'local',
        players
    });

    Telemetry.recordRoomEnter(1, 'combat', players);
    Telemetry.recordDamage({
        playerId: 'local',
        amount: 250,
        enemyId: 'enemy-1',
        enemyType: 'basic',
        roomNumber: 1,
        isBoss: false
    });

    Telemetry.recordPlayerHit({
        playerId: 'local',
        amount: 42,
        roomNumber: 1,
        sourceId: 'enemy-1',
        sourceType: 'basic'
    });

    Telemetry.recordRoomCleared(1, players);

    const payload = Telemetry.serialize();
    assert.ok(payload, 'payload generated');
    assert.ok(payload.run, 'run present');
    assert.strictEqual(payload.run.mode, 'singleplayer');
    assert.strictEqual(payload.run.players.length, 1);

    const player = payload.run.players[0];
    assert.strictEqual(player.totalDamageDealt, 250);
    assert.strictEqual(player.totalDamageTaken, 42);

    const room = payload.run.rooms[0];
    assert.strictEqual(room.roomNumber, 1);
    assert.strictEqual(room.damageDealtByPlayer.local, 250);
    assert.strictEqual(room.damageTakenByPlayer.local, 42);
    assert.ok(Array.isArray(room.playerStatsStart), 'playerStatsStart present');
    assert.ok(Array.isArray(room.playerStatsEnd), 'playerStatsEnd present');
    assert.strictEqual(room.playerStatsStart[0].stats.damage, playerState.damage);
    assert.strictEqual(room.playerStatsStart[0].gear.weapon.tier, 'blue');

    const submits = [];
    Telemetry.submit = payloadArg => submits.push(payloadArg);
    Telemetry.completeRun({ result: 'success', finalPlayers: players });

    assert.strictEqual(submits.length, 1);
    assert.strictEqual(submits[0].run.result, 'success');
    assert.ok(submits[0].run.metadata.finalPlayerStats, 'final player stats captured');
});

