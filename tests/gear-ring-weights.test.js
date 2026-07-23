'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const vm = require('vm');

function loadGearRingHelpers() {
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
                affixSlotsBasic: 0,
                affixSlotsAdvanced: 0,
                affixSlotsRare: 0
            })
        },
        Game: undefined
    };
    sandbox.window = sandbox;
    vm.runInNewContext(code, sandbox);
    const exports = sandbox.module.exports;
    return {
        AFFIX_RING_TIER_BIAS: exports.AFFIX_RING_TIER_BIAS || sandbox.AFFIX_RING_TIER_BIAS,
        getAffixRingWeight: exports.getAffixRingWeight || sandbox.getAffixRingWeight,
        buildWeightedAffixRingEntries: exports.buildWeightedAffixRingEntries || sandbox.buildWeightedAffixRingEntries,
        blendWeightedAffixRingColor: exports.blendWeightedAffixRingColor || sandbox.blendWeightedAffixRingColor,
        sampleWeightedAffixRingOffset: exports.sampleWeightedAffixRingOffset || sandbox.sampleWeightedAffixRingOffset,
        AFFIX_VISUAL_MAP: exports.AFFIX_VISUAL_MAP || sandbox.AFFIX_VISUAL_MAP
    };
}

function loadPlayerCalculateVisual(gearHelpers) {
    const playerPath = path.join(__dirname, '../src/game/entities/players/player-base.js');
    const source = fs.readFileSync(playerPath, 'utf8');
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
        Float32Array,
        Date,
        window: {},
        document: undefined,
        Game: undefined,
        ItemManager,
        buildWeightedAffixRingEntries: gearHelpers.buildWeightedAffixRingEntries,
        blendWeightedAffixRingColor: gearHelpers.blendWeightedAffixRingColor,
        sampleWeightedAffixRingOffset: gearHelpers.sampleWeightedAffixRingOffset,
        AFFIX_VISUAL_MAP: gearHelpers.AFFIX_VISUAL_MAP,
        AFFIX_RING_TIER_BIAS: gearHelpers.AFFIX_RING_TIER_BIAS
    };
    sandbox.window = sandbox;
    vm.runInNewContext(source + '\nthis.PlayerBase = PlayerBase;', sandbox);
    return sandbox.PlayerBase;
}

test('rare affix ring weight exceeds basic at equal normalized strength', () => {
    const {
        getAffixRingWeight,
        AFFIX_RING_TIER_BIAS
    } = loadGearRingHelpers();

    assert.ok(AFFIX_RING_TIER_BIAS.rare > AFFIX_RING_TIER_BIAS.advanced);
    assert.ok(AFFIX_RING_TIER_BIAS.advanced > AFFIX_RING_TIER_BIAS.basic);

    const basic = getAffixRingWeight({ type: 'movementSpeed', tier: 'basic', value: 0.12 });
    const rare = getAffixRingWeight({ type: 'pierce', tier: 'rare', value: 2 });
    assert.ok(rare > basic, `expected rare weight ${rare} > basic ${basic}`);
});

test('weighted blend color and entries favor rare over basic', () => {
    const {
        buildWeightedAffixRingEntries,
        blendWeightedAffixRingColor,
        AFFIX_VISUAL_MAP
    } = loadGearRingHelpers();

    const entries = buildWeightedAffixRingEntries([
        { type: 'movementSpeed', tier: 'basic', value: 0.12 },
        { type: 'execute', tier: 'rare', value: 0.4 }
    ]);
    assert.equal(entries.length, 2);
    assert.ok(!entries.some(e => e.synergyGroup));

    const rareEntry = entries.find(e => e.type === 'execute');
    const basicEntry = entries.find(e => e.type === 'movementSpeed');
    assert.ok(rareEntry.weight > basicEntry.weight);

    const color = blendWeightedAffixRingColor(entries);
    const rareColor = AFFIX_VISUAL_MAP.execute.color;
    const basicColor = AFFIX_VISUAL_MAP.movementSpeed.color;
    const distRare = Math.abs(color.r - rareColor.r) + Math.abs(color.g - rareColor.g) + Math.abs(color.b - rareColor.b);
    const distBasic = Math.abs(color.r - basicColor.r) + Math.abs(color.g - basicColor.g) + Math.abs(color.b - basicColor.b);
    assert.ok(distRare < distBasic, `blended color should be closer to rare (${distRare}) than basic (${distBasic})`);
});

test('sampleWeightedAffixRingOffset is finite for class affixes', () => {
    const { buildWeightedAffixRingEntries, sampleWeightedAffixRingOffset } = loadGearRingHelpers();
    const entries = buildWeightedAffixRingEntries([
        { type: 'whirlwindRadius', tier: 'advanced', value: 0.25 },
        { type: 'cleaveArea', tier: 'rare', value: 0.2 }
    ]);
    assert.equal(entries.length, 2);
    const offset = sampleWeightedAffixRingOffset(0.5, entries, 0, 0.15, null);
    assert.ok(Number.isFinite(offset));
});

test('calculateGearPieceVisual emits one weighted affix list without synergy groups', () => {
    const gearHelpers = loadGearRingHelpers();
    const PlayerBase = loadPlayerCalculateVisual(gearHelpers);
    const player = new PlayerBase(0, 0);

    const visual = player.calculateGearPieceVisual({
        tier: 'purple',
        color: '#aa55ff',
        stats: { damage: 20 },
        affixes: [
            { type: 'attackSpeed', tier: 'basic', value: 0.15 },
            { type: 'multishot', tier: 'rare', value: 1 }
        ],
        legendaryEffect: null
    });

    assert.ok(visual);
    assert.ok(Array.isArray(visual.affixes));
    assert.equal(visual.affixes.length, 2);
    assert.equal(visual.synergyGroups, undefined);
    assert.equal(typeof visual.tierStroke, 'number');
    assert.ok(visual.affixes.find(a => a.type === 'multishot').weight >
        visual.affixes.find(a => a.type === 'attackSpeed').weight);
});

test('three equipped pieces produce three slot visuals and no synergy keys', () => {
    const gearHelpers = loadGearRingHelpers();
    const PlayerBase = loadPlayerCalculateVisual(gearHelpers);
    const player = new PlayerBase(0, 0);

    player.weapon = {
        tier: 'blue',
        stats: { damage: 10 },
        affixes: [{ type: 'critChance', tier: 'advanced', value: 0.1 }]
    };
    player.armor = {
        tier: 'green',
        stats: { defense: 0.2 },
        affixes: [{ type: 'maxHealth', tier: 'basic', value: 25 }]
    };
    player.accessory = {
        tier: 'purple',
        stats: { speed: 0.1 },
        affixes: [{ type: 'overcharge', tier: 'rare', value: 0.2 }]
    };
    player.updateGearVisuals();

    const slots = player._getEquippedSlotVisuals();
    assert.equal(slots.filter(Boolean).length, 3);
    for (const visual of slots) {
        assert.ok(visual);
        assert.equal(visual.synergyGroups, undefined);
        assert.ok(Array.isArray(visual.affixes));
        assert.equal(visual.affixes.length, 1);
    }
});
