const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');

function loadArenaModule() {
    const arenaSrc = fs.readFileSync(path.join(ROOT, 'src/game/simulation/arena-mode.js'), 'utf8');
    const combatScalingSrc = fs.readFileSync(path.join(ROOT, 'src/game/simulation/combat-scaling.js'), 'utf8');

    const ctx = {
        console,
        Math,
        Game: { gameMode: 'surge-arena', activeSessionId: 'surge-arena' },
        globalThis: {}
    };
    ctx.window = ctx;
    ctx.globalThis = ctx;
    vm.createContext(ctx);

    vm.runInContext(combatScalingSrc, ctx);
    vm.runInContext(arenaSrc, ctx);

    return {
        GameArena: ctx.GameArena || ctx.globalThis.GameArena,
        CombatScaling: ctx.CombatScaling || ctx.globalThis.CombatScaling
    };
}

test('Arena damage scaling constants scaled 2% faster for all enemies', () => {
    const { CombatScaling } = loadArenaModule();
    assert.equal(CombatScaling.ARENA_ENEMY_DAMAGE_GROWTH_PER_WAVE, 0.145, 'Pre-split arena damage growth should be 14.5% (was 12.5%)');
    assert.equal(CombatScaling.ARENA_ENEMY_DAMAGE_GROWTH_PER_WAVE_POST, 0.115, 'Post-split arena damage growth should be 11.5% (was 9.5%)');
});

test('getArenaBossCount follows 1, 2, 3, RNG 3-5, then absurd wave scaling', () => {
    const { GameArena } = loadArenaModule();

    assert.equal(GameArena.getArenaBossCount(5), 1, 'Surge 1 (wave 5) should spawn 1 boss');
    assert.equal(GameArena.getArenaBossCount(10), 2, 'Surge 2 (wave 10) should spawn 2 bosses');
    assert.equal(GameArena.getArenaBossCount(15), 3, 'Surge 3 (wave 15) should spawn 3 bosses');

    // Surges 4 to 7 (waves 20 to 35) should be between 3 and 5
    for (const wave of [20, 25, 30, 35]) {
        for (let i = 0; i < 20; i++) {
            const c = GameArena.getArenaBossCount(wave);
            assert.ok(c >= 3 && c <= 5, `Wave ${wave} should spawn 3-5 bosses, got ${c}`);
        }
    }

    // Absurd waves (Surge 8+ / wave 40+) should scale upward
    const wave40Counts = new Set();
    for (let i = 0; i < 50; i++) wave40Counts.add(GameArena.getArenaBossCount(40));
    assert.ok(Array.from(wave40Counts).every(c => c >= 3 && c <= 5), 'Wave 40 should be 3..5');

    const wave60Counts = new Set();
    for (let i = 0; i < 50; i++) wave60Counts.add(GameArena.getArenaBossCount(60));
    assert.ok(Array.from(wave60Counts).every(c => c >= 5 && c <= 7), 'Wave 60 (Surge 12) should scale to 5..7');

    const wave100Counts = new Set();
    for (let i = 0; i < 50; i++) wave100Counts.add(GameArena.getArenaBossCount(100));
    assert.ok(Array.from(wave100Counts).every(c => c >= 8 && c <= 10), 'Wave 100 (Surge 20) should scale to 8..10');
});

test('arenaBossScalingRoom accelerates past surge 3 to prevent player outscaling', () => {
    const { GameArena } = loadArenaModule();

    assert.equal(GameArena.arenaBossScalingRoom(5), 1, 'Surge 1 baseline room');
    assert.equal(GameArena.arenaBossScalingRoom(10), 3, 'Surge 2 baseline room');
    assert.equal(GameArena.arenaBossScalingRoom(15), 5, 'Surge 3 room 5');

    assert.ok(GameArena.arenaBossScalingRoom(20) > 10, 'Surge 4 scale room should accelerate past 10');
    assert.ok(GameArena.arenaBossScalingRoom(25) > 16, 'Surge 5 scale room should accelerate past 16');
    assert.ok(GameArena.arenaBossScalingRoom(50) > 50, 'Surge 10 scale room should exceed 50');
});

test('arenaBossHpMult and arenaBossDamageMult grow past surge 3', () => {
    const { GameArena } = loadArenaModule();

    const hp3 = GameArena.arenaBossHpMult(15, 3);
    const hp5 = GameArena.arenaBossHpMult(25, 3);
    assert.ok(hp5 > hp3, 'Boss HP mult should grow past surge 3');

    const dmg3 = GameArena.arenaBossDamageMult(15, 3);
    const dmg5 = GameArena.arenaBossDamageMult(25, 3);
    assert.ok(dmg5 > dmg3, 'Boss damage mult should grow past surge 3');
});

test('pickArenaBosses handles count > pool.length with duplicates', () => {
    const { GameArena } = loadArenaModule();
    const picks5 = GameArena.pickArenaBosses(25, 5);
    assert.equal(picks5.length, 5, 'Should pick 5 bosses');

    const picks8 = GameArena.pickArenaBosses(50, 8);
    assert.equal(picks8.length, 8, 'Should pick 8 bosses');
});
