const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');

function loadCombatScaling() {
    const source = fs.readFileSync(path.join(ROOT, 'src/game/simulation/combat-scaling.js'), 'utf8');
    const ctx = { console, Math, Game: { gameMode: 'gear', difficulty: 'normal', multiplayerEnabled: false } };
    ctx.window = ctx;
    ctx.globalThis = ctx;
    vm.createContext(ctx);
    vm.runInContext(`${source}\nif (typeof CombatScaling !== 'undefined') globalThis.CombatScaling = CombatScaling;`, ctx);
    return ctx.CombatScaling;
}

function factorsAtRoom(CombatScaling, roomNumber) {
    const ctx = CombatScaling.createContext({ roomNumber, gameMode: 'gear', roomType: 'normal', difficulty: 'normal', playerCount: 1 });
    return CombatScaling.computeScalingFactors(ctx);
}

test('computeScalingFactors is monotonic across rooms 1/10/20/30', () => {
    const CombatScaling = loadCombatScaling();
    const rooms = [1, 10, 20, 30];
    const series = rooms.map(r => factorsAtRoom(CombatScaling, r));

    for (let i = 1; i < series.length; i++) {
        assert.ok(series[i].roomHp > series[i - 1].roomHp, `roomHp should increase at room ${rooms[i]}`);
        assert.ok(series[i].roomDamage > series[i - 1].roomDamage, `roomDamage should increase at room ${rooms[i]}`);
        assert.ok(series[i].roomMobility > series[i - 1].roomMobility, `roomMobility should increase at room ${rooms[i]}`);
        assert.ok(series[i].intelligence >= series[i - 1].intelligence, `intelligence should not decrease at room ${rooms[i]}`);
        assert.ok(series[i].roomTempo < series[i - 1].roomTempo, `roomTempo should decrease (faster attacks) at room ${rooms[i]}`);
    }
    assert.ok(series[0].intelligence < series[2].intelligence, 'intelligence should increase before cap');
});

test('tempo uses inverse divisor - room 20 faster than room 1', () => {
    const CombatScaling = loadCombatScaling();
    const f1 = factorsAtRoom(CombatScaling, 1);
    const f20 = factorsAtRoom(CombatScaling, 20);

    assert.ok(f20.roomTempo < f1.roomTempo);
    assert.ok(f20.roomTempoDivisor > f1.roomTempoDivisor);
    const expected = 1 / (1 + CombatScaling.ENEMY_TEMPO_GROWTH_PER_ROOM * 19);
    assert.ok(Math.abs(f20.roomTempo - expected) < 0.0001);
});

test('easy difficulty reduces HP and slows tempo vs normal', () => {
    const CombatScaling = loadCombatScaling();
    const normal = CombatScaling.computeScalingFactors(
        CombatScaling.createContext({ roomNumber: 15, difficulty: 'normal', playerCount: 1 })
    );
    const easy = CombatScaling.computeScalingFactors(
        CombatScaling.createContext({ roomNumber: 15, difficulty: 'easy', playerCount: 1 })
    );

    assert.ok(easy.roomHp < normal.roomHp);
    assert.ok(easy.timingMult > normal.timingMult, 'easy should have longer cooldowns (higher timing mult)');
});

test('gear vs cards multiplayer tables differ', () => {
    const CombatScaling = loadCombatScaling();
    const gear2p = CombatScaling.getMultiplayerScaling({ gameMode: 'gear', playerCount: 2 });
    const cards2p = CombatScaling.getMultiplayerScaling({ gameMode: 'cards', playerCount: 2 });

    assert.ok(cards2p.enemyCount > gear2p.enemyCount);
    assert.ok(cards2p.enemyHP < gear2p.enemyHP);
});

test('scaleBossConfig preserves geometric constants', () => {
    const CombatScaling = loadCombatScaling();
    const template = {
        arcVolley: {
            telegraphDuration: 1.05,
            rotationStep: Math.PI / 32,
            spread: 0.08
        }
    };
    const ctx = CombatScaling.createContext({ roomNumber: 20, gameMode: 'gear' });
    const scaled = CombatScaling.scaleBossConfig(template, ctx, 1, 'boss_fortress');

    assert.ok(scaled.arcVolley.telegraphDuration < template.arcVolley.telegraphDuration);
    assert.equal(scaled.arcVolley.rotationStep, template.arcVolley.rotationStep);
    assert.equal(scaled.arcVolley.spread, template.arcVolley.spread);
});

test('applyEnemyScaling resolves CONFIG and scales HP', () => {
    const ctx = { console, Math, Game: { gameMode: 'gear', difficulty: 'normal', multiplayerEnabled: false, roomNumber: 1 } };
    ctx.window = ctx;
    ctx.globalThis = ctx;
    vm.createContext(ctx);
    const telegraph = fs.readFileSync(path.join(ROOT, 'src/game/entities/enemies/telegraph/telegraph-manager.js'), 'utf8');
    const enemyBase = fs.readFileSync(path.join(ROOT, 'src/game/entities/enemies/enemy-base.js'), 'utf8');
    const enemyBasic = fs.readFileSync(path.join(ROOT, 'src/game/entities/enemies/enemy-basic.js'), 'utf8');
    const combatScaling = fs.readFileSync(path.join(ROOT, 'src/game/simulation/combat-scaling.js'), 'utf8');
    vm.runInContext(`${telegraph}\nif (typeof TelegraphSystem !== 'undefined') globalThis.TelegraphSystem = TelegraphSystem;`, ctx);
    vm.runInContext(`${enemyBase}\nif (typeof EnemyBase !== 'undefined') globalThis.EnemyBase = EnemyBase;`, ctx);
    vm.runInContext(`${enemyBasic}\nif (typeof Enemy !== 'undefined') globalThis.Enemy = Enemy;\nif (typeof BASIC_ENEMY_CONFIG !== 'undefined') globalThis.BASIC_ENEMY_CONFIG = BASIC_ENEMY_CONFIG;`, ctx);
    vm.runInContext(`${combatScaling}\nif (typeof CombatScaling !== 'undefined') globalThis.CombatScaling = CombatScaling;`, ctx);

    const enemy = new ctx.Enemy(100, 100);
    const scalingCtx = ctx.CombatScaling.createContext({ roomNumber: 1, gameMode: 'gear', roomType: 'normal' });
    ctx.CombatScaling.applyEnemyScaling(enemy, 'enemy_basic', scalingCtx);

    assert.ok(enemy.maxHp > 0, 'enemy should have scaled HP');
    assert.ok(enemy.hp > 0, 'enemy should have current HP');
    assert.ok(enemy.damage > 0, 'enemy should have damage');
    assert.ok(enemy.moveSpeed > 0, 'enemy should have move speed');
});

test('pre-boss rooms have higher enemy count and XP than standard curve', () => {
    const CombatScaling = loadCombatScaling();
    const preBossCtx = CombatScaling.createContext({ roomNumber: 5, gameMode: 'gear', roomType: 'normal', playerCount: 1 });

    const preBossCount = CombatScaling.computeEnemyCount(5, 'normal', preBossCtx);
    const standardCount = 6 + Math.floor(5 * 1.05);
    assert.ok(preBossCount > standardCount, 'room 5 pre-boss count should exceed legacy formula');

    const preBossFactors = CombatScaling.computeScalingFactors(preBossCtx);
    const preBossXp = CombatScaling.resolveEnemyStats('enemy_basic', { maxHp: 100, damage: 10, xpValue: 10, moveSpeed: 100 }, preBossCtx, preBossFactors).xpValue;
    const preBossBonusXp = Math.floor(10 * preBossFactors.roomHp * CombatScaling.EARLY_RUN_XP_BONUS);
    const preBossXpNoBonus = Math.floor(10 * preBossFactors.roomHp);
    assert.equal(preBossXp, preBossBonusXp);
    assert.ok(preBossXp > preBossXpNoBonus, 'pre-boss XP bonus should increase trash rewards');

    const preBossHp = CombatScaling.resolveEnemyStats('enemy_basic', { maxHp: 100, damage: 10, xpValue: 10, moveSpeed: 100 }, preBossCtx, preBossFactors).maxHp;
    const preBossHpNoBonus = Math.floor(100 * preBossFactors.roomHp);
    assert.ok(preBossHp > preBossHpNoBonus, 'pre-boss HP bonus should thicken trash');
    assert.equal(preBossHp, Math.floor(100 * preBossFactors.roomHp * CombatScaling.EARLY_RUN_HP_BONUS));
});

test('BossScaling shim exposes full public surface', () => {
    const ctx = { console, Math, Game: { gameMode: 'gear' } };
    ctx.window = ctx;
    ctx.globalThis = ctx;
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'src/game/simulation/combat-scaling.js'), 'utf8'), ctx);
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'src/game/entities/bosses/boss-scaling.js'), 'utf8'), ctx);

    const required = [
        'BOSS_SCALING_PROFILES', 'BOSS_MODE_CONFIG', 'GEAR_BOSS_CYCLE', 'GEAR_FIRST_BOSS_ROOM',
        'GEAR_BOSS_INTERVAL', 'CARD_BOSS_ROOMS', 'getGameMode', 'isGearBossRoom', 'getGearBossKey',
        'getBossKeyForRoom', 'getBossEncounterIndex', 'getBossGrowthConstants',
        'computeBossStats', 'applyBossScaling'
    ];

    const objectKeys = new Set(['BOSS_SCALING_PROFILES', 'BOSS_MODE_CONFIG', 'GEAR_BOSS_CYCLE', 'CARD_BOSS_ROOMS']);
    const numberKeys = new Set(['GEAR_FIRST_BOSS_ROOM', 'GEAR_BOSS_INTERVAL']);

    required.forEach(key => {
        assert.ok(ctx.BossScaling[key] != null, `missing BossScaling.${key}`);
        if (objectKeys.has(key)) {
            assert.equal(typeof ctx.BossScaling[key], 'object', key);
        } else if (numberKeys.has(key)) {
            assert.equal(typeof ctx.BossScaling[key], 'number', key);
        } else {
            assert.equal(typeof ctx.BossScaling[key], 'function', key);
        }
    });
});

test('rooms 1/30/50 keep pre-canonical exponential formulas', () => {
    const CombatScaling = loadCombatScaling();
    for (const room of [1, 30, 50]) {
        const f = factorsAtRoom(CombatScaling, room);
        const i = room - 1;
        const expectedHp = Math.pow(1 + CombatScaling.ENEMY_HP_GROWTH_PER_ROOM, i);
        const expectedDmg = Math.pow(1 + CombatScaling.ENEMY_DAMAGE_GROWTH_PER_ROOM, i);
        const expectedMob = Math.pow(1 + CombatScaling.ENEMY_MOBILITY_GROWTH_PER_ROOM, i);
        const expectedTempo = 1 / (1 + CombatScaling.ENEMY_TEMPO_GROWTH_PER_ROOM * i);

        assert.ok(Math.abs(f.roomHp - expectedHp) < 1e-9, `room ${room} HP identity`);
        assert.ok(Math.abs(f.roomDamage - expectedDmg) < 1e-9, `room ${room} damage identity`);
        assert.ok(Math.abs(f.roomMobility - expectedMob) < 1e-9, `room ${room} mobility identity`);
        assert.ok(Math.abs(f.roomTempo - expectedTempo) < 1e-9, `room ${room} tempo identity`);
    }
});

test('room 146 soft-caps readability stats and keeps HP/damage climbing', () => {
    const CombatScaling = loadCombatScaling();
    const f50 = factorsAtRoom(CombatScaling, 50);
    const f100 = factorsAtRoom(CombatScaling, 100);
    const f146 = factorsAtRoom(CombatScaling, 146);

    assert.ok(f146.roomMobility <= CombatScaling.ENEMY_MOBILITY_SOFT_MAX + 1e-9, 'mobility soft-max');
    assert.ok(f146.roomMobility > f50.roomMobility, 'mobility still grows past 50 toward soft-max');
    assert.ok(f146.roomTempo + 1e-9 >= CombatScaling.ENEMY_TEMPO_SOFT_FLOOR, 'tempo soft-floor');
    assert.ok(f146.roomTempo < f50.roomTempo, 'tempo still tightens past 50 toward floor');

    assert.ok(f100.roomHp > f50.roomHp && f146.roomHp > f100.roomHp, 'HP keeps climbing');
    assert.ok(f100.roomDamage > f50.roomDamage && f146.roomDamage > f100.roomDamage, 'damage keeps climbing');

    const uncappedDmg = Math.pow(1 + CombatScaling.ENEMY_DAMAGE_GROWTH_PER_ROOM, 145);
    assert.ok(f146.roomDamage < uncappedDmg, 'post-50 damage rate is gentler than uncapped');

    const count146 = CombatScaling.computeEnemyCount(
        146, 'normal',
        CombatScaling.createContext({ roomNumber: 146, gameMode: 'gear', playerCount: 1 })
    );
    assert.ok(count146 <= CombatScaling.ENEMY_COUNT_SOFT_MAX, 'density soft-cap');

    const stats = CombatScaling.resolveEnemyStats(
        'enemy_basic',
        { maxHp: 100, damage: 10, xpValue: 10, moveSpeed: 135, lungeSpeed: 400, projectileSpeed: 200 },
        CombatScaling.createContext({ roomNumber: 146, gameMode: 'gear' }),
        f146
    );
    assert.ok(stats.moveSpeed <= CombatScaling.MOBILITY_MOVE_SPEED_ABS_CAP);
    assert.ok(stats.lungeSpeed <= CombatScaling.MOBILITY_LUNGE_SPEED_ABS_CAP);
});

test('boss room scales use tapered post-canonical growth', () => {
    const CombatScaling = loadCombatScaling();
    const at50 = CombatScaling.computeBossStats('vortex', 50, { gameMode: 'gear', difficulty: 'normal' });
    const at146 = CombatScaling.computeBossStats('vortex', 146, { gameMode: 'gear', difficulty: 'normal' });

    assert.ok(at146.maxHp > at50.maxHp, 'boss HP grows into endless');
    assert.ok(at146.damage > at50.damage, 'boss damage grows into endless');

    const uncappedRoomHp = Math.pow(1 + CombatScaling.BOSS_HP_GROWTH_PER_ROOM, 145);
    assert.ok(at146.roomHpScale < uncappedRoomHp, 'boss room HP scale uses post rate');
    assert.ok(
        CombatScaling.BOSS_MODE_CONFIG.gear.endlessHpGrowthPerRoom < 0.02,
        'gear endless per-room extra stays mild'
    );
});

test('surge-arena mode scales HP and defense faster than campaign and respects defense caps', () => {
    const CombatScaling = loadCombatScaling();

    const gearWave10 = CombatScaling.computeScalingFactors(
        CombatScaling.createContext({ roomNumber: 10, gameMode: 'gear' })
    );
    const arenaWave10 = CombatScaling.computeScalingFactors(
        CombatScaling.createContext({ roomNumber: 10, gameMode: 'surge-arena' })
    );

    assert.ok(arenaWave10.roomHp > gearWave10.roomHp, 'surge-arena wave 10 HP scaling is higher than gear room 10');
    assert.ok(arenaWave10.roomDamage > gearWave10.roomDamage, 'surge-arena wave 10 damage scaling is higher than gear room 10');
    assert.ok(arenaWave10.roomDefenseAdd > gearWave10.roomDefenseAdd, 'surge-arena wave 10 defense addition is higher than gear');

    const basicStatsW20 = CombatScaling.resolveEnemyStats(
        'enemy_basic',
        { maxHp: 100, damage: 10, xpValue: 10 },
        CombatScaling.createContext({ roomNumber: 50, gameMode: 'surge-arena' }),
        CombatScaling.computeScalingFactors(CombatScaling.createContext({ roomNumber: 50, gameMode: 'surge-arena' }))
    );
    assert.ok(basicStatsW20.defense <= 0.45, 'trash defense is capped at 0.45');

    const octagonStatsW20 = CombatScaling.resolveEnemyStats(
        'enemy_octagon',
        { maxHp: 300, damage: 20, xpValue: 30 },
        CombatScaling.createContext({ roomNumber: 50, gameMode: 'surge-arena' }),
        CombatScaling.computeScalingFactors(CombatScaling.createContext({ roomNumber: 50, gameMode: 'surge-arena' }))
    );
    assert.ok(octagonStatsW20.defense <= 0.60, 'elite defense is capped at 0.60');
    assert.ok(octagonStatsW20.defense > basicStatsW20.defense, 'elite base defense exceeds trash defense');
});

