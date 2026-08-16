const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');

function loadPlayerBase() {
    const source = fs.readFileSync(
        path.join(ROOT, 'src/game/entities/players/player-base.js'),
        'utf8'
    );
    function ItemManager() {}
    const sandbox = {
        console,
        Math,
        Object,
        Array,
        String,
        Number,
        Boolean,
        JSON,
        Map,
        Set,
        Float32Array,
        Uint8Array,
        Date,
        window: {},
        document: undefined,
        Game: undefined,
        ItemManager,
        GameAudio: {
            sounds: {
                levelUp: () => {}
            }
        },
        normalizeGearProgressFields: (gear) => {
            gear.stats = gear.stats || {};
            gear.affixes = gear.affixes || [];
        },
        WEAPON_TYPES: {},
        ARMOR_TYPES: {}
    };
    sandbox.window = sandbox;
    vm.runInNewContext(source + '\nthis.PlayerBase = PlayerBase;', sandbox);
    return { PlayerBase: sandbox.PlayerBase, sandbox };
}

test('applyLevelUpBonuses handles level jumps iteratively and compounds correctly', () => {
    const { PlayerBase } = loadPlayerBase();
    const player = new PlayerBase(0, 0);
    player.playerClass = 'square';
    player.baseDamage = 10;
    player.baseMaxHp = 100;
    player.hp = 100;
    player.level = 1;
    player.lastLevelBonusesApplied = 1;

    // Simulate jumping from level 1 to level 3
    player.level = 3;
    player.applyLevelUpBonuses();

    // Damage compound scaling: 10 * 1.09 * 1.09 = 11.881
    assert.ok(Math.abs(player.baseDamage - 11.881) < 1e-5, `Expected ~11.881 damage, got ${player.baseDamage}`);

    // HP compound scaling: 100 * 1.12 * 1.12 = 125.44
    assert.ok(Math.abs(player.baseMaxHp - 125.44) < 1e-5, `Expected ~125.44 max HP, got ${player.baseMaxHp}`);
    assert.equal(player.lastLevelBonusesApplied, 3);
});

test('applyState on host/solo triggers applyLevelUpBonuses when level increases', () => {
    const { PlayerBase, sandbox } = loadPlayerBase();
    
    // Stub Game to represent host/solo (isMultiplayerClient = false)
    sandbox.Game = {
        multiplayerEnabled: true,
        getLocalPlayerId: () => 'local',
        isMultiplayerClient: () => false
    };
    sandbox.multiplayerManager = {
        isHost: true
    };

    const player = new PlayerBase(0, 0);
    player.playerClass = 'square';
    player.baseDamage = 10;
    player.baseMaxHp = 100;
    player.hp = 100;
    player.level = 1;
    player.lastLevelBonusesApplied = 1;

    // Call applyState with a level increase (from 1 to 2)
    player.applyState({ level: 2 });

    assert.equal(player.level, 2);
    // Damage scaled by 1.09 once
    assert.ok(Math.abs(player.baseDamage - 10.9) < 1e-5, `Expected 10.9 damage, got ${player.baseDamage}`);
    assert.equal(player.lastLevelBonusesApplied, 2);
});

test('applyState skipLevelUp restores level without heal or stat re-scaling', () => {
    const { PlayerBase, sandbox } = loadPlayerBase();
    sandbox.Game = {
        multiplayerEnabled: true,
        getLocalPlayerId: () => 'local',
        isMultiplayerClient: () => false
    };
    sandbox.multiplayerManager = { isHost: true };

    const player = new PlayerBase(0, 0);
    player.playerClass = 'square';
    player.baseDamage = 10;
    player.baseMaxHp = 100;
    player.maxHp = 100;
    player.hp = 40;
    player.level = 1;
    player.lastLevelBonusesApplied = 1;

    player.applyState({
        level: 5,
        lastLevelBonusesApplied: 5,
        hp: 40,
        maxHp: 100,
        baseDamage: 10,
        baseMaxHp: 100
    }, { skipLevelUp: true });

    assert.equal(player.level, 5);
    assert.equal(player.lastLevelBonusesApplied, 5);
    assert.equal(player.hp, 40);
    assert.equal(player.baseDamage, 10);
});

test('applyState with lastLevelBonusesApplied already caught up skips level-up heal', () => {
    const { PlayerBase, sandbox } = loadPlayerBase();
    sandbox.Game = {
        multiplayerEnabled: true,
        getLocalPlayerId: () => 'host',
        isMultiplayerClient: () => true
    };
    sandbox.multiplayerManager = { isHost: false };

    const player = new PlayerBase(0, 0);
    player.playerClass = 'square';
    player.playerId = 'client';
    player.baseDamage = 10;
    player.baseMaxHp = 100;
    player.maxHp = 100;
    player.hp = 40;
    player.level = 1;
    player.lastLevelBonusesApplied = 1;

    player.applyState({
        level: 4,
        lastLevelBonusesApplied: 4,
        hp: 40,
        maxHp: 157
    });

    assert.equal(player.level, 4);
    assert.equal(player.lastLevelBonusesApplied, 4);
    assert.equal(player.hp, 40);
});
