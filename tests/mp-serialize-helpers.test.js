const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const PROJECTILE_KEYS = [
    'id', 'x', 'y', 'vx', 'vy', 'size', 'type', 'color', 'damage',
    'lifetime', 'elapsed', 'trailLength', 'trailColor', 'baseAngle',
    'baseSpeed', 'waveAmplitude', 'waveFrequency', 'wavePhase', 'waveClock',
    'playerId', 'ownerId', 'activateAfter', 'isParallelSecond', 'isParallelPrimary'
];

const GEAR_SHARED_KEYS = [
    'id', 'slot', 'tier', 'color', 'bonus', 'affixes', 'classModifier',
    'weaponType', 'armorType', 'legendaryEffect', 'roomNumber', 'scaling',
    'level', 'upgradesApplied', 'originalTier', 'rarityStepsApplied',
    'rarityUpgradedThisVisit', 'rerollIndex', 'rerollCount', 'stats', 'name'
];

const GEAR_WORLD_KEYS = ['x', 'y', 'size', 'pulse'];

const PYLON_KEYS = [
    'id', 'x', 'y', 'rarity', 'interactedPlayers', 'disappearing', 'disappearProgress'
];

function loadGearSerialize() {
    const code = fs.readFileSync(path.join(__dirname, '..', 'src', 'game', 'content', 'gear.js'), 'utf8');
    const sandbox = {
        console,
        Math,
        Object,
        Array,
        String,
        Number,
        Boolean,
        JSON,
        Set,
        Map,
        window: {},
        module: { exports: {} },
        exports: {},
        SaveSystem: {
            getGearUpgrades: () => ({
                affixSlotsBasic: 0,
                affixSlotsAdvanced: 0,
                affixSlotsRare: 0
            })
        },
        Game: undefined
    };
    sandbox.window = sandbox;
    vm.runInNewContext(code, sandbox);
    return sandbox.module.exports.serializeGearForNetwork
        || sandbox.window.serializeGearForNetwork
        || sandbox.serializeGearForNetwork;
}

function loadPylonSerialize() {
    const code = fs.readFileSync(path.join(__dirname, '..', 'src', 'game', 'entities', 'items', 'item-pylon.js'), 'utf8');
    const sandbox = {
        console,
        Math,
        Object,
        Array,
        String,
        Number,
        Boolean,
        JSON,
        window: {},
        Game: { itemPylons: [] },
        ITEM_RARITY_COLORS: {},
        multiplayerManager: null
    };
    sandbox.window = sandbox;
    vm.runInNewContext(code, sandbox);
    return sandbox.window.serializeItemPylonForNetwork
        || sandbox.serializeItemPylonForNetwork;
}

const {
    serializeProjectileForNetwork
} = require('../src/game/entities/projectiles-util.js');

test('serializeProjectileForNetwork emits expected keys and parallel flags', () => {
    const proj = {
        x: 10,
        y: 20,
        vx: 1,
        vy: 2,
        size: 8,
        type: 'knife',
        color: '#abc',
        damage: 5,
        lifetime: 1.5,
        elapsed: 0.25,
        trailLength: 3,
        trailColor: '#fff',
        baseAngle: 0.5,
        baseSpeed: 200,
        waveAmplitude: 1,
        waveFrequency: 2,
        wavePhase: 0,
        waveClock: 0.1,
        playerId: 'p1',
        activateAfter: 0.2,
        isParallelSecond: true,
        isParallelPrimary: false
    };
    const snap = serializeProjectileForNetwork(proj);
    assert.ok(snap.id, 'assigns stable id');
    assert.equal(proj.id, snap.id, 'mutates live projectile id');
    for (const key of PROJECTILE_KEYS) {
        assert.ok(Object.prototype.hasOwnProperty.call(snap, key), `missing key ${key}`);
    }
    assert.equal(snap.playerId, 'p1');
    assert.equal(snap.ownerId, 'p1');
    assert.equal(snap.activateAfter, 0.2);
    assert.equal(snap.isParallelSecond, true);
    assert.equal(snap.isParallelPrimary, false);
    assert.equal(serializeProjectileForNetwork(null), null);
});

test('serializeGearForNetwork null returns null', () => {
    const serializeGearForNetwork = loadGearSerialize();
    assert.equal(typeof serializeGearForNetwork, 'function');
    assert.equal(serializeGearForNetwork(null), null);
});

test('serializeGearForNetwork equipped mode excludes world keys and uses equipped defaults', () => {
    const serializeGearForNetwork = loadGearSerialize();
    const gear = {
        id: 'g1',
        slot: 'weapon',
        tier: 'blue',
        color: '#2196f3',
        bonus: 1,
        affixes: [{ type: 'critChance', value: 0.1 }],
        roomNumber: 3,
        scaling: 1.2
    };
    const snap = serializeGearForNetwork(gear, { includeWorld: false });
    for (const key of GEAR_SHARED_KEYS) {
        assert.ok(Object.prototype.hasOwnProperty.call(snap, key), `missing shared key ${key}`);
    }
    for (const key of GEAR_WORLD_KEYS) {
        assert.equal(Object.prototype.hasOwnProperty.call(snap, key), false, `equipped should not include ${key}`);
    }
    assert.ok(snap.stats && typeof snap.stats === 'object');
    assert.equal(Object.keys(snap.stats).length, 0);
    assert.equal(snap.name, '');
    assert.equal(snap.level, 3);
});

test('serializeGearForNetwork world mode includes world keys and preserves ground defaults', () => {
    const serializeGearForNetwork = loadGearSerialize();
    const gear = {
        id: 'g2',
        x: 100,
        y: 200,
        slot: 'armor',
        tier: 'green',
        color: '#4caf50',
        bonus: 0,
        roomNumber: 2,
        name: 'Leaf Plate'
    };
    const snap = serializeGearForNetwork(gear, { includeWorld: true });
    for (const key of GEAR_SHARED_KEYS) {
        assert.ok(Object.prototype.hasOwnProperty.call(snap, key), `missing shared key ${key}`);
    }
    for (const key of GEAR_WORLD_KEYS) {
        assert.ok(Object.prototype.hasOwnProperty.call(snap, key), `world should include ${key}`);
    }
    assert.equal(snap.x, 100);
    assert.equal(snap.y, 200);
    assert.equal(snap.size, 15);
    assert.equal(snap.pulse, 0);
    assert.equal(snap.stats, undefined);
    assert.equal(snap.name, 'Leaf Plate');
});

test('serializeItemPylonForNetwork emits expected keys and copies interactedPlayers', () => {
    const serializeItemPylonForNetwork = loadPylonSerialize();
    assert.equal(typeof serializeItemPylonForNetwork, 'function');
    assert.equal(serializeItemPylonForNetwork(null), null);

    const interacted = ['a', 'b'];
    const pylon = {
        id: 'pylon-1',
        x: 50,
        y: 60,
        rarity: 'rare',
        interactedPlayers: interacted,
        disappearing: true,
        disappearProgress: 0.4
    };
    const snap = serializeItemPylonForNetwork(pylon);
    for (const key of PYLON_KEYS) {
        assert.ok(Object.prototype.hasOwnProperty.call(snap, key), `missing key ${key}`);
    }
    assert.ok(Array.isArray(snap.interactedPlayers));
    assert.equal(snap.interactedPlayers.length, 2);
    assert.equal(snap.interactedPlayers[0], 'a');
    assert.equal(snap.interactedPlayers[1], 'b');
    assert.notEqual(snap.interactedPlayers, interacted, 'should slice interactedPlayers');
    assert.equal(snap.rarity, 'rare');
    assert.equal(snap.disappearing, true);
    assert.equal(snap.disappearProgress, 0.4);

    const bare = serializeItemPylonForNetwork({ id: 'p2', x: 0, y: 0 });
    assert.equal(bare.rarity, 'common');
    assert.ok(Array.isArray(bare.interactedPlayers));
    assert.equal(bare.interactedPlayers.length, 0);
    assert.equal(bare.disappearing, false);
    assert.equal(bare.disappearProgress, 0);
});
