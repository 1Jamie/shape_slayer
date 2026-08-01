'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const vm = require('node:vm');

function loadGearLoot(gameOverrides = {}) {
    const gearPath = path.join(__dirname, '../src/game/content/gear.js');
    const code = fs.readFileSync(gearPath, 'utf8');
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
                rarityChanceGreen: 0,
                rarityChanceBlue: 0,
                rarityChancePurple: 0,
                rarityChanceOrange: 0,
                affixSlotsBasic: 0,
                affixSlotsAdvanced: 0,
                affixSlotsRare: 0
            })
        },
        Game: {
            gameMode: 'gear',
            roomNumber: 1,
            ...gameOverrides
        }
    };
    sandbox.window = sandbox;
    vm.runInNewContext(code, sandbox);
    const exports = sandbox.module.exports;
    return {
        Game: sandbox.Game,
        getGearScaling: exports.getGearScaling || sandbox.getGearScaling,
        calculateTierProbabilities: exports.calculateTierProbabilities || sandbox.calculateTierProbabilities,
        getArenaLootScalingRoom: exports.getArenaLootScalingRoom || sandbox.getArenaLootScalingRoom,
        isSurgeArenaLootContext: exports.isSurgeArenaLootContext || sandbox.isSurgeArenaLootContext
    };
}

test('Gear Mode room rarity and scaling are unchanged without surge session', () => {
    const gear = loadGearLoot({ gameMode: 'gear', activeSessionId: null });
    assert.equal(gear.isSurgeArenaLootContext(), false);

    const scale10 = gear.getGearScaling(10);
    assert.ok(Math.abs(scale10 - (1 + 10 * 0.035)) < 1e-9);

    const probs = gear.calculateTierProbabilities(20, 'basic');
    assert.ok(probs.gray > 0.70, `Gear Mode W/R20 should stay gray-heavy, got gray=${probs.gray}`);
    assert.ok(probs.blue < 0.05, `Gear Mode R20 blue should stay rare, got blue=${probs.blue}`);
});

test('Surge Arena wave N is stronger and rarer than Gear Mode room N', () => {
    const gearMode = loadGearLoot({ gameMode: 'gear', activeSessionId: null });
    const arena = loadGearLoot({
        gameMode: 'gear',
        activeSessionId: 'surge-arena',
        modeId: 'surge-arena'
    });
    assert.equal(arena.isSurgeArenaLootContext(), true);

    for (const n of [10, 20, 30, 40]) {
        const gearScale = gearMode.getGearScaling(n);
        const arenaScale = arena.getGearScaling(n);
        assert.ok(
            arenaScale > gearScale,
            `arena scale should exceed gear at ${n}: ${arenaScale} vs ${gearScale}`
        );

        const gearProbs = gearMode.calculateTierProbabilities(n, 'basic');
        const arenaProbs = arena.calculateTierProbabilities(n, 'basic');
        const gearBluePlus = gearProbs.blue + gearProbs.purple + gearProbs.orange;
        const arenaBluePlus = arenaProbs.blue + arenaProbs.purple + arenaProbs.orange;
        assert.ok(
            arenaBluePlus > gearBluePlus,
            `arena blue+ should exceed gear at wave ${n}: ${arenaBluePlus} vs ${gearBluePlus}`
        );
    }

    // Spot-check target feel anchors from the plan
    const w15 = arena.calculateTierProbabilities(15, 'basic');
    const w25 = arena.calculateTierProbabilities(25, 'basic');
    const w40 = arena.calculateTierProbabilities(40, 'basic');
    assert.ok(w15.blue > 0.08, `W15 blue should be meaningful, got ${w15.blue}`);
    assert.ok(w25.blue > 0.18, `W25 blue should be common, got ${w25.blue}`);
    assert.ok(w40.purple > 0.12, `W40 purple should be regular, got ${w40.purple}`);
    assert.ok(w40.gray < 0.25, `W40 gray should no longer dominate, got ${w40.gray}`);
});

test('arena lootRoom remap matches combat-style acceleration after wave 15', () => {
    const arena = loadGearLoot({ activeSessionId: 'surge-arena' });
    assert.equal(arena.getArenaLootScalingRoom(15), 15);
    assert.ok(arena.getArenaLootScalingRoom(20) > 20);
    assert.ok(arena.getArenaLootScalingRoom(40) > 40);
});
