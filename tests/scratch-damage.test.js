const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');

function loadPlayerBase() {
    const source = fs.readFileSync(path.join(ROOT, 'src/game/entities/players/player-base.js'), 'utf8');
    const ctx = {
        console,
        Math,
        Date,
        Set,
        Map,
        Object,
        Array,
        String,
        Number,
        Boolean,
        JSON,
        clamp: (val, min, max) => Math.max(min, Math.min(max, val)),
        CLASS_DEFINITIONS: {
            square: { name: 'Warrior', color: '#4a90e2', shape: 'square' }
        },
        ItemManager: function() {
            this.getTotalItemCount = () => 0;
            this.serialize = () => null;
            this.applyState = () => {};
        },
        GameAudio: { sounds: { scratchGraceStart() {}, scratchBurn() {}, avatarDefeat() {} } },
        GameBus: { emit() {} },
        Game: {
            isMultiplayerClient: () => false,
            triggerScreenShake: () => {},
            calculateCurrency: () => 0
        },
        DebugFlags: {}
    };
    ctx.window = ctx;
    ctx.globalThis = ctx;
    vm.runInNewContext(source + '\nthis.PlayerBase = PlayerBase;', ctx);
    return ctx.PlayerBase;
}

test('Damage Split & Anchor HP: Hit from 100 HP sets anchor at 100, HP to 90, Scratch to 10', () => {
    const PlayerBase = loadPlayerBase();
    const player = new PlayerBase();
    player.maxHp = 100;
    player.hp = 100;
    player.scratch = 0;
    player.computeDamageReduction = () => 0;

    // Hit 1: 40 damage -> HP 90, Anchor 100, Scratch 10
    player.takeDamage(40);

    assert.equal(player.hp, 90);
    assert.equal(player.anchorHp, 100);
    assert.equal(player.scratch, 10);
    assert.equal(player.scratchGraceTimer, 3.5);
});

test('Re-hit Anchor Erosion: 20% burn permanently lowers anchor HP on each hit', () => {
    const PlayerBase = loadPlayerBase();
    const player = new PlayerBase();
    player.maxHp = 100;
    player.hp = 100;
    player.scratch = 0;
    player.computeDamageReduction = () => 0;
    player.invulnerable = false;

    // Hit 1 (40 damage): HP 90, Anchor 100, Scratch 10
    player.takeDamage(40);
    assert.equal(player.hp, 90);
    assert.equal(player.anchorHp, 100);
    assert.equal(player.scratch, 10);

    // Hit 2 (40 damage):
    // Clear i-frames from hit 1
    player.invulnerable = false;
    // 20% burn of 10 scratch = 2 -> Anchor HP drops from 100 to 98
    // HP drops by 10 (90 -> 80)
    // Scratch = 98 - 80 = 18 (increases slower than HP drops!)
    player.takeDamage(40);
    assert.equal(player.hp, 80);
    assert.equal(player.anchorHp, 98);
    assert.equal(player.scratch, 18);

    // Hit 3 (40 damage):
    // Clear i-frames from hit 2
    player.invulnerable = false;
    // 20% burn of 18 scratch = 3.6 -> Anchor HP drops from 98 to 94.4
    // HP drops by 10 (80 -> 70)
    // Scratch = 94.4 - 70 = 24.4
    player.takeDamage(40);
    assert.equal(player.hp, 70);
    assert.equal(Math.round(player.anchorHp * 10) / 10, 94.4);
    assert.equal(Math.round(player.scratch * 10) / 10, 24.4);
});

test('Reset Anchor after Recovery & External Healing: Scratch regenerates properly on future damage', () => {
    const PlayerBase = loadPlayerBase();
    const player = new PlayerBase();
    player.maxHp = 100;
    player.hp = 100;
    player.scratch = 0;
    player.computeDamageReduction = () => 0;

    // Take hit 1: 40 damage -> HP 90, Scratch 10
    player.takeDamage(40);
    assert.equal(player.hp, 90);
    assert.equal(player.scratch, 10);

    // Fully convert scratch back to HP
    player.scratchGraceTimer = 0;
    player.updateScratch(10.0); // 10s elapses
    assert.equal(player.scratch, 0);
    assert.equal(player.hp, 100);
    assert.equal(player.anchorHp, 100);

    // Next damage episode: take 40 damage hit from 100 HP
    player.invulnerable = false;
    player.takeDamage(40);
    assert.equal(player.hp, 90);
    assert.equal(player.anchorHp, 100);
    assert.equal(player.scratch, 10);

    // External healing (e.g. potion / safe room) scales anchorHp up automatically
    player.hp = 100;
    player.updateScratch(0.1);
    assert.equal(player.anchorHp, 100);
});

test('Death Condition: Real HP <= 0 results in death regardless of scratch', () => {
    const PlayerBase = loadPlayerBase();
    const player = new PlayerBase();
    player.maxHp = 100;
    player.hp = 10;
    player.anchorHp = 100;
    player.scratch = 90;
    player.computeDamageReduction = () => 0;

    // Take 40 damage: 25% of 40 = 10 real HP lost -> HP drops to 0!
    player.takeDamage(40);
    assert.ok(player.hp <= 0);
});

test('State Serialization and Sync Roundtrip', () => {
    const PlayerBase = loadPlayerBase();
    const p1 = new PlayerBase();
    p1.scratch = 42.5;
    p1.anchorHp = 85.0;
    p1.scratchGraceTimer = 2.1;

    const serialized = p1.serialize();
    assert.equal(serialized.scratch, 42.5);
    assert.equal(serialized.anchorHp, 85.0);
    assert.equal(serialized.scratchGraceTimer, 2.1);

    const p2 = new PlayerBase();
    p2.applyState(serialized, true);
    assert.equal(p2.scratch, 42.5);
    assert.equal(p2.anchorHp, 85.0);
    assert.equal(p2.scratchGraceTimer, 2.1);
});
