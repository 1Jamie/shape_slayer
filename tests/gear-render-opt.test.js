'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

function buildGearSpriteCacheKey(gear) {
    const affixTypes = (gear.affixes || []).map(a => a.type);
    return [
        gear.tier || 'gray',
        gear.slot || '',
        gear.weaponType || '',
        gear.armorType || '',
        [...affixTypes].sort().join(','),
        gear.legendaryEffect ? 'L' : '',
        gear.classModifier ? 'C' : ''
    ].join('_');
}

test('gear sprite cache key is order-independent for affix types', () => {
    const gearA = {
        tier: 'blue',
        slot: 'weapon',
        weaponType: 'fast',
        affixes: [{ type: 'critChance' }, { type: 'pierce' }]
    };
    const gearB = {
        tier: 'blue',
        slot: 'weapon',
        weaponType: 'fast',
        affixes: [{ type: 'pierce' }, { type: 'critChance' }]
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
