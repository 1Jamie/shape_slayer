const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');

function loadSurgeRules(extra) {
    const sandbox = {
        console,
        Object,
        Array,
        String,
        Math,
        TypeError,
        Map,
        Set,
        Number,
        requestAnimationFrame: (cb) => cb()
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    Object.assign(sandbox, extra || {});
    vm.runInNewContext(
        fs.readFileSync(path.join(ROOT, 'src/game/game-bus.js'), 'utf8'),
        sandbox
    );
    vm.runInNewContext(
        fs.readFileSync(path.join(ROOT, 'src/modes/surge-arena/rules.js'), 'utf8'),
        sandbox
    );
    return sandbox;
}

test('SurgeArenaRules computeWavePlan escalates with wave even on fast clears', () => {
    const env = loadSurgeRules();
    const Rules = env.SurgeArenaRules;
    const world = {
        player: { totalXpEarned: 0 },
        waveNumber: 1,
        getLocalPlayerId: () => 'local',
        getPlayerStats: () => ({ getTimeAlive: () => 0 })
    };

    const first = Rules.planInitialWave(world);
    assert.equal(first.spawnBudget, Rules.FLOOR_BUDGET);
    assert.equal(first.allowedEnemyTiers.length, 1);
    assert.equal(first.allowedEnemyTiers[0], 'basic');

    // Zero XP / time — budget still climbs with wave number.
    const mid = Rules.computeWavePlan(world, { wave: 8 });
    assert.ok(mid.spawnBudget > first.spawnBudget);
    assert.equal(mid.spawnBudget, Rules.waveBaselineBudget(8));

    const late = Rules.computeWavePlan(world, { wave: 16 });
    assert.ok(late.spawnBudget > mid.spawnBudget);
    assert.ok(late.spawnBudget >= Rules.FLOOR_BUDGET + 15 * Rules.WAVE_BUDGET_STEP);

    world.player.totalXpEarned = 10000;
    world.getPlayerStats = () => ({ getTimeAlive: () => 100 });
    const pressured = Rules.computeWavePlan(world, { wave: 6 });
    assert.ok(pressured.spawnBudget >= Rules.waveBaselineBudget(6));
    assert.ok(pressured.allowedEnemyTiers.includes('octagon'));

    world.arenaPrevSpawnBudget = 200;
    world.player.totalXpEarned = 0;
    world.getPlayerStats = () => ({ getTimeAlive: () => 10 });
    // Wave cadence alone unlocks star on wave 3 even with 0 XP
    const waveTwo = Rules.computeWavePlan(world, { wave: 2 });
    assert.ok(!waveTwo.allowedEnemyTiers.includes('star'));

    const waveThree = Rules.computeWavePlan(world, { wave: 3 });
    assert.ok(waveThree.allowedEnemyTiers.includes('star'));
    assert.ok(!waveThree.allowedEnemyTiers.includes('diamond'));

    world.arenaPrevSpawnBudget = Rules.FLOOR_BUDGET;
    world.player.totalXpEarned = 0;
    world.getPlayerStats = () => ({ getTimeAlive: () => 0 });
    // Wave 1 stays at floor baseline with no pressure
    const third = Rules.computeWavePlan(world, { wave: 1 });
    assert.equal(third.spawnBudget, Rules.FLOOR_BUDGET);
    assert.ok(!third.allowedEnemyTiers.includes('star'));
});

test('SurgeArenaRules unlocks enemy tiers on wave cadence', () => {
    const env = loadSurgeRules();
    const Rules = env.SurgeArenaRules;
    assert.equal(Rules.allowedEnemyTiersForProgress(0, 1).join(','), 'basic');
    assert.ok(!Rules.allowedEnemyTiersForProgress(0, 2).includes('star'));
    assert.ok(Rules.allowedEnemyTiersForProgress(0, 3).includes('star'));
    assert.ok(!Rules.allowedEnemyTiersForProgress(0, 4).includes('diamond'));
    assert.ok(Rules.allowedEnemyTiersForProgress(0, 5).includes('diamond'));
    assert.ok(!Rules.allowedEnemyTiersForProgress(0, 6).includes('rectangle'));
    assert.ok(Rules.allowedEnemyTiersForProgress(0, 7).includes('rectangle'));
    assert.ok(!Rules.allowedEnemyTiersForProgress(0, 8).includes('octagon'));
    assert.ok(Rules.allowedEnemyTiersForProgress(0, 9).includes('octagon'));
    // XP accelerator without wave progress
    assert.ok(Rules.allowedEnemyTiersForProgress(151, 1).includes('star'));
    assert.ok(!Rules.allowedEnemyTiersForProgress(151, 1).includes('diamond'));
});

test('SurgeArenaRules 5-tier style effects, soft bleed, recovery, and S crash', () => {
    const env = loadSurgeRules();
    const Rules = env.SurgeArenaRules;
    const world = {
        player: { cooldownRegenMult: 1, x: 0, y: 0, size: 20, alive: true },
        state: 'PLAYING',
        arenaPhase: 'waiting',
        awardRunCredits() {},
        runCredits: 100
    };
    env.Game = world;

    const events = [];
    env.GameBus.on('combo:tierChanged', (d) => events.push(['tier', d.tier, d.comboCount]));
    env.GameBus.on('combo:bleedApplied', (d) => events.push(['bleed', d.amountLost, d.comboCount, d.recoveryWindow]));
    env.GameBus.on('combo:styleRecovered', (d) => events.push(['recover', d.restored, d.comboCount]));
    env.GameBus.on('combo:styleCrashed', (d) => events.push(['crash', d.fromTier, d.toTier]));
    env.GameBus.on('combo:varietyBonus', (d) => events.push(['variety', d.bonus, !!d.monotone]));
    env.GameBus.on('combo:apexPulse', () => events.push(['apex']));

    const teardown = Rules.attach(env.GameBus);
    const combo = Rules.getComboState();

    // Thresholds: 5 / 15 / 30 / 50
    for (let i = 0; i < 5; i++) combo.onKill(world, { styleTag: 'primary' });
    assert.equal(combo.comboTier, 1);
    assert.equal(world.player.styleMoveSpeedMult, 1.1);
    assert.equal(world.player.cooldownRegenMult, 1.1);

    for (let i = 0; i < 10; i++) combo.onKill(world, { styleTag: 'heavy' });
    assert.equal(combo.comboTier, 2);
    assert.equal(world.comboCreditMultiplier, 1.5);
    assert.equal(world.player.styleCritBonus, 0.1);
    assert.ok(world.styleRageAura);

    for (let i = 0; i < 15; i++) combo.onKill(world, { styleTag: 'special' });
    assert.equal(combo.comboTier, 3);
    assert.equal(world.comboCreditMultiplier, 2);
    assert.equal(world.player.styleDashIFramesBonus, 0.1);
    assert.ok(world.styleMotionTrails);

    for (let i = 0; i < 20; i++) combo.onKill(world, { styleTag: 'dashAttack' });
    assert.equal(combo.comboTier, 4);
    assert.equal(world.comboCreditMultiplier, 3);
    assert.equal(world.player.cooldownRegenMult, 1.4);
    assert.ok(world.styleKillShatter);
    assert.ok(world.styleDirectorOverdrive);

    // Soft bleed 15% + recovery window (not at S crash path if we drop first... we're at S)
    // S hit: crash to tier 2, then soft bleed
    const beforeHit = combo.comboCount;
    combo.onPhysicalDamage(world);
    assert.ok(events.some((e) => e[0] === 'crash' && e[1] === 4 && e[2] === 2));
    assert.equal(combo.comboTier, 2);
    assert.ok(combo.recoveryWindow > 0);
    assert.ok(events.some((e) => e[0] === 'bleed' && e[3] > 0));

    // Style Recovery via heavy
    const lost = combo.recoveryLost;
    const mid = combo.comboCount;
    combo.onEnemyDamaged({ styleTag: 'heavy', enemy: {}, isBoss: false }, world);
    assert.ok(events.some((e) => e[0] === 'recover'));
    assert.equal(combo.recoveryWindow, 0);
    assert.ok(combo.comboCount > mid);
    assert.equal(combo.comboCount, mid + Math.max(1, Math.floor(lost * 0.75)));

    // Variety: alternating tags bonus
    events.length = 0;
    combo.lastStyleTag = 'primary';
    combo.varietyStreak = 1;
    combo.onKill(world, { styleTag: 'special' });
    assert.ok(events.some((e) => e[0] === 'variety' && e[1] === 1));

    // Apex EMP continues for tier >= 3
    combo.comboCount = 35;
    combo.recomputeTier(world);
    assert.equal(combo.comboTier, 3);
    combo.apexHoldTimer = Rules.APEX_EMP_HOLD;
    combo.update(0.01, world);
    assert.ok(events.some((e) => e[0] === 'apex'));

    // Climb into S without resetting apex — hold continues at S
    combo.comboCount = 50;
    combo.recomputeTier(world);
    assert.equal(combo.comboTier, 4);
    combo.apexHoldTimer = Rules.APEX_EMP_HOLD - 1;
    events.length = 0;
    combo.update(1.05, world);
    assert.ok(events.some((e) => e[0] === 'apex'), 'Apex EMP still fires while at S');

    // Timer wipe still clears
    combo.comboTimer = 0.01;
    Rules.update(0.02);
    assert.equal(combo.comboCount, 0);
    assert.equal(combo.comboTier, 0);

    // Soft bleed alone (not S): 15%
    for (let i = 0; i < 20; i++) combo.onKill(world);
    assert.equal(combo.comboTier, 2);
    const c0 = combo.comboCount;
    combo.onPhysicalDamage(world);
    assert.equal(combo.comboCount, Math.floor(c0 - c0 * 0.15));
    assert.ok(combo.recoveryWindow > 0);

    void beforeHit;
    teardown();
});

test('SurgeArenaRules boss hits sustain timer; thresholds build count; adds pause decay', () => {
    const env = loadSurgeRules();
    const Rules = env.SurgeArenaRules;
    const world = { player: { cooldownRegenMult: 1 }, state: 'PLAYING' };
    env.Game = world;
    const teardown = Rules.attach(env.GameBus);
    const combo = Rules.getComboState();

    combo.onKill(world);
    assert.equal(combo.comboCount, 1);
    combo.comboTimer = 1.0;

    // Boss hit: refresh timer, no +1
    combo.onEnemyDamaged({ isBoss: true, enemy: { isBoss: true } }, world);
    assert.equal(combo.comboCount, 1);
    assert.equal(combo.comboTimer, Rules.COMBO_TIMER);

    // Threshold pseudo-kill: +1
    combo.onBossThreshold(world);
    assert.equal(combo.comboCount, 2);

    // Trash hit: decay hold pauses timer
    combo.comboTimer = 2.0;
    combo.onEnemyDamaged({ isBoss: false, enemy: {} }, world);
    assert.ok(combo.decayHold > 0);
    const before = combo.comboTimer;
    Rules.update(0.2);
    assert.equal(combo.comboTimer, before, 'decay paused while hold active');
    assert.ok(combo.decayHold < Rules.ADD_HIT_DECAY_HOLD);

    // After hold expires, timer ticks again
    combo.decayHold = 0;
    Rules.update(0.25);
    assert.ok(combo.comboTimer < before);

    teardown();
});

test('GameKillRewards emits boss thresholds every 10% maxHp', () => {
    const sandbox = {
        console,
        Object,
        Array,
        String,
        Math,
        TypeError,
        Map,
        Set,
        Number
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    sandbox.Game = {};
    vm.runInNewContext(
        fs.readFileSync(path.join(ROOT, 'src/game/game-bus.js'), 'utf8'),
        sandbox
    );
    vm.runInNewContext(
        fs.readFileSync(path.join(ROOT, 'src/game/simulation/kill-rewards.js'), 'utf8'),
        sandbox
    );

    const thresholds = [];
    sandbox.GameBus.on('combat:bossThresholdReached', (d) => thresholds.push(d.bucket));
    sandbox.GameBus.on('combat:enemyDamaged', () => {});

    const boss = { isBoss: true, maxHp: 1000, hp: 1000, lastAttacker: 'p1' };
    // 10% of 1000 = 100. One big hit of 250 → buckets 1 and 2
    sandbox.GameKillRewards.emitEnemyDamaged(boss, 250);
    assert.deepEqual(thresholds, [1, 2]);
    // Status ticks ignored
    boss._damageCause = 'status';
    sandbox.GameKillRewards.emitEnemyDamaged(boss, 500);
    assert.equal(thresholds.length, 2);
});

test('WaveDirector spends Modes-supplied budget and never spawns locked tiers', () => {
    function Enemy(x, y) {
        this.x = x;
        this.y = y;
        this.alive = true;
        this.maxHp = 10;
        this.hp = 10;
        this.state = 'standby';
        this.detectionRange = 100;
        this.activated = false;
        this.shape = 'basic';
    }
    const room = {
        width: 1280,
        height: 720,
        enemies: [],
        layout: { width: 1280, height: 720 },
        arenaFloor: { x: 640, y: 400, w: 900, h: 500 }
    };
    const world = {
        enemies: room.enemies,
        arenaPhase: 'combat',
        arenaWavePhase: 'horde',
        player: { x: 640, y: 600 },
        getLocalPlayerId: () => 'p1',
        currentRoom: room
    };
    const sandbox = { console, Object, Array, String, Math, TypeError, Map, Set };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    vm.runInNewContext(
        fs.readFileSync(path.join(ROOT, 'src/engine/director.js'), 'utf8'),
        sandbox
    );
    Object.assign(sandbox, {
        Enemy,
        Game: world,
        currentRoom: room,
        GameWorld: { resolveWorld: () => world }
    });
    vm.runInNewContext(
        fs.readFileSync(path.join(ROOT, 'src/game/simulation/wave-director.js'), 'utf8'),
        sandbox
    );

    assert.equal(typeof sandbox.WaveDirector.computeBudget, 'undefined');

    const dir = sandbox.WaveDirector.attachDirector(world, 2, {
        spawnBudget: 100,
        allowedEnemyTiers: ['basic', 'star']
    });
    assert.equal(dir.budgetTotal, 100);
    assert.ok(dir.pending.length > 0);
    assert.ok(dir.pending.every((t) => t === 'basic' || t === 'star'));

    const queue = sandbox.WaveDirector.buildSpawnQueue(200, ['octagon']);
    assert.ok(queue.length > 0);
    assert.ok(queue.every((t) => t === 'octagon'));
});

test('SurgeArenaRules awards +2 combo points for elite kills and extended decay hold for elite hits', () => {
    const env = loadSurgeRules();
    const Rules = env.SurgeArenaRules;
    const world = {
        player: { cooldownRegenMult: 1, x: 0, y: 0, size: 20, alive: true },
        runCredits: 100,
        awardRunCredits: () => {}
    };

    const state = Rules.createState(world);
    assert.equal(state.comboCount, 0);

    // Hitting elite sets 0.75s decay hold vs 0.4s for trash
    state.comboCount = 5;
    state.onEnemyDamaged({ isElite: true }, world);
    assert.equal(state.decayHold, 0.75);

    state.onEnemyDamaged({ isElite: false }, world);
    assert.equal(state.decayHold, 0.4);

    // Elite kill awards +2 combo points
    state.comboCount = 0;
    state.onKill(world, { isElite: true });
    assert.equal(state.comboCount, 2, 'elite kill awards +2 combo points');
});

