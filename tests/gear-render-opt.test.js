'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

function buildGearSpriteCacheKey(gear) {
    const affixKey = (gear.affixes || [])
        .map(a => `${a.type}:${a.tier || ''}:${typeof a.value === 'number' ? a.value.toFixed(3) : ''}`)
        .sort()
        .join(',');
    return [
        gear.tier || 'gray',
        gear.slot || '',
        gear.weaponType || '',
        gear.armorType || '',
        affixKey,
        gear.legendaryEffect ? 'L' : '',
        gear.classModifier ? 'C' : ''
    ].join('_');
}

test('gear sprite cache key is order-independent for affix types', () => {
    const gearA = {
        tier: 'blue',
        slot: 'weapon',
        weaponType: 'fast',
        affixes: [{ type: 'critChance', value: 0.1 }, { type: 'pierce', value: 1 }]
    };
    const gearB = {
        tier: 'blue',
        slot: 'weapon',
        weaponType: 'fast',
        affixes: [{ type: 'pierce', value: 1 }, { type: 'critChance', value: 0.1 }]
    };
    assert.equal(buildGearSpriteCacheKey(gearA), buildGearSpriteCacheKey(gearB));
});

test('gear sprite cache key includes legendary and class modifier flags', () => {
    const base = buildGearSpriteCacheKey({ tier: 'orange', slot: 'armor', affixes: [] });
    const legendary = buildGearSpriteCacheKey({
        tier: 'orange',
        slot: 'armor',
        affixes: [],
        legendaryEffect: { type: 'test' }
    });
    const classMod = buildGearSpriteCacheKey({
        tier: 'orange',
        slot: 'armor',
        affixes: [],
        classModifier: { class: 'square' }
    });
    assert.notEqual(base, legendary);
    assert.notEqual(base, classMod);
    assert.match(legendary, /_L/);
    assert.match(classMod, /_C/);
});

test('gear sprite cache key distinguishes affix values', () => {
    const low = buildGearSpriteCacheKey({
        tier: 'blue',
        slot: 'weapon',
        affixes: [{ type: 'critChance', value: 0.05 }]
    });
    const high = buildGearSpriteCacheKey({
        tier: 'blue',
        slot: 'weapon',
        affixes: [{ type: 'critChance', value: 0.15 }]
    });
    assert.notEqual(low, high);
});
