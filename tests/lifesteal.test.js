const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');

function loadCombat() {
    const source = fs.readFileSync(path.join(ROOT, 'src/game/simulation/combat.js'), 'utf8');
    const ctx = {
        console,
        Math,
        performance: { now: () => ctx._nowMs },
        Game: { isMultiplayerClient: () => false },
        _nowMs: 0
    };
    ctx.window = ctx;
    ctx.globalThis = ctx;
    vm.createContext(ctx);
    vm.runInContext(source, ctx);
    return ctx;
}

function makePlayer(overrides = {}) {
    return {
        hp: 100,
        maxHp: 265,
        lifesteal: 0.07,
        _lifestealSwingId: 1,
        ...overrides
    };
}

function makeEnemy(overrides = {}) {
    return { id: 'boss-1', isBoss: true, x: 10, y: 10, ...overrides };
}

test('lifesteal procs once per enemy per melee swing', () => {
    const ctx = loadCombat();
    const player = makePlayer();
    const enemy = makeEnemy({ isBoss: false, id: 'grunt-1' });

    const first = ctx.applyLifesteal(player, 40, { enemy, source: 'melee' });
    const second = ctx.applyLifesteal(player, 40, { enemy, source: 'melee' });

    assert.ok(first > 0);
    assert.equal(second, 0);
    assert.ok(player.hp > 100);
});

test('lifesteal respects per-second heal cap', () => {
    const ctx = loadCombat();
    const player = makePlayer({ lifesteal: 0.10 });
    const enemy = makeEnemy({ isBoss: false, id: 'a' });

    ctx.beginLifestealAttackSwing(player);
    let total = 0;
    for (let i = 0; i < 20; i++) {
        player._lifestealSwingId += 1;
        total += ctx.applyLifesteal(player, 50, { enemy: { ...enemy, id: `e-${i}` }, source: 'melee' });
    }

    const cap = ctx.getLifestealHealCapPerSec(player);
    assert.ok(total <= cap + 0.001);
    assert.ok(total > 0);
});

test('lifesteal is reduced against bosses', () => {
    const ctx = loadCombat();
    const bossPlayer = makePlayer({ lifesteal: 0.07, hp: 150, maxHp: 400 });
    const mobPlayer = makePlayer({ lifesteal: 0.07, hp: 150, maxHp: 400 });
    const boss = makeEnemy({ isBoss: true, id: 'boss-a' });
    const mob = makeEnemy({ isBoss: false, id: 'mob-1' });

    ctx.beginLifestealAttackSwing(bossPlayer);
    const bossHeal = ctx.applyLifesteal(bossPlayer, 50, { enemy: boss, source: 'melee' });

    ctx.beginLifestealAttackSwing(mobPlayer);
    const mobHeal = ctx.applyLifesteal(mobPlayer, 50, { enemy: mob, source: 'melee' });

    assert.ok(bossHeal > 0);
    assert.ok(mobHeal > 0);
    assert.ok(bossHeal < mobHeal);
    assert.ok(Math.abs(bossHeal / mobHeal - 0.30) < 0.02);
});

test('stacked lifesteal above soft cap has diminishing returns', () => {
    const ctx = loadCombat();
    const player = makePlayer({ lifesteal: 0.11, hp: 150, maxHp: 311 });
    const enemy = makeEnemy({ isBoss: false, id: 'mob-1' });
    const expectedRate = 0.05 + (0.11 - 0.05) * 0.35;

    ctx.beginLifestealAttackSwing(player);
    const heal = ctx.applyLifesteal(player, 40, { enemy, source: 'melee' });

    assert.ok(Math.abs(heal - 40 * expectedRate) < 0.01);
});

test('whirlwind lifesteal is heavily reduced', () => {
    const ctx = loadCombat();
    const player = makePlayer({ lifesteal: 0.11, hp: 150, maxHp: 311 });
    const boss = makeEnemy({ isBoss: true });

    const melee = ctx.applyLifesteal(player, 100, { enemy: boss, source: 'melee', pulseKey: 'm1' });
    player.hp = 150;
    player._lifestealHealBudget = null;
    player._sustainProcs = {};
    const whirl = ctx.applyLifesteal(player, 100, { enemy: boss, source: 'whirlwind', pulseKey: 'w1' });

    assert.ok(whirl < melee);
    assert.ok(whirl <= melee * 0.20);
});

test('new attack swing resets per-enemy proc tracking', () => {
    const ctx = loadCombat();
    const player = makePlayer();
    const enemy = makeEnemy({ isBoss: false, id: 'grunt-1' });

    ctx.beginLifestealAttackSwing(player);
    assert.ok(ctx.applyLifesteal(player, 40, { enemy, source: 'melee' }) > 0);

    ctx.beginLifestealAttackSwing(player);
    assert.ok(ctx.applyLifesteal(player, 40, { enemy, source: 'melee' }) > 0);
});

test('projectile batch dedupes lifesteal from multishot on same enemy', () => {
    const ctx = loadCombat();
    const player = makePlayer({ hp: 150, maxHp: 400 });
    const enemy = makeEnemy({ isBoss: false, id: 'mob-1' });
    const batchId = 42;

    const first = ctx.applyLifesteal(player, 30, { enemy, source: 'projectile', batchId });
    const second = ctx.applyLifesteal(player, 30, { enemy, source: 'projectile', batchId });

    assert.ok(first > 0);
    assert.equal(second, 0);
});

test('hammer heal shares sustain budget with lifesteal', () => {
    const ctx = loadCombat();
    const player = makePlayer({ hp: 150, maxHp: 400, lifesteal: 0.10, playerClass: 'pentagon' });
    const enemy = makeEnemy({ isBoss: false, id: 'mob-1' });

    ctx.beginLifestealAttackSwing(player);
    ctx.applyLifesteal(player, 100, { enemy, source: 'hammer' });
    const hammerHeal = ctx.applyHammerHeal(player, 100, { enemy });

    assert.ok(hammerHeal >= 0);
    const cap = ctx.getLifestealHealCapPerSec(player);
    assert.ok(player.hp - 150 <= cap + 0.001);
});

test('shout hitboxes dedupe lifesteal per enemy per swing', () => {
    const ctx = loadCombat();
    const player = makePlayer({ hp: 150, maxHp: 400 });
    const enemy = makeEnemy({ isBoss: false, id: 'mob-1' });

    ctx.beginLifestealAttackSwing(player);
    const first = ctx.applyLifesteal(player, 25, { enemy, source: 'shout' });
    const second = ctx.applyLifesteal(player, 25, { enemy, source: 'shout' });

    assert.ok(first > 0);
    assert.equal(second, 0);
});
