// Universal combat scaling - single source of truth for runtime difficulty.
//
// ARCHITECTURE
//   Phase 1: computeScalingFactors(ctx) once per room batch
//   Phase 2: resolveEntityStats(profileId, config, factors) per entity
//
// STAT GROUPS (per archetype - see ENTITY_PROFILES)
//   durability  - maxHp, shield HP (+ pre-boss HP bonus through first boss room)
//   offense     - damage (+ per-type trim e.g. diamond damageScalingMultiplier)
//   mobility    - moveSpeed, lungeSpeed, projectileSpeed, dashSpeed
//   tempo       - attackCooldown, telegraph*, recovery*, shootCooldown (inverse room growth)
//   cognition   - intelligenceLevel 0–1 (room curve + difficulty offset)
//   density     - enemyCount, minion spawn counts (room-gen only)
//   xp          - xpValue (room HP scaling + pre-boss bonus through first boss room)
//
// TEMPO MATH (sign-error guard)
//   roomTempoDivisor = 1 + ENEMY_TEMPO_GROWTH_PER_ROOM * roomIndex
//   roomTempo = 1 / roomTempoDivisor  → later rooms = shorter cooldowns
//   WRONG: baseCooldown * (1 + GROWTH * roomIndex) - slows attacks in later rooms
//
// CONFIG stays in entity files; ENTITY_PROFILES links archetypes to stat groups.

// --- Growth constants (migrated from level.js) ---
const ENEMY_HP_GROWTH_PER_ROOM = 0.10;
const ENEMY_DAMAGE_GROWTH_PER_ROOM = 0.15;
const BOSS_HP_GROWTH_PER_ROOM = 0.09;
const BOSS_DAMAGE_GROWTH_PER_ROOM = 0.14;
const ENEMY_TEMPO_GROWTH_PER_ROOM = 0.03;
const ENEMY_MOBILITY_GROWTH_PER_ROOM = 0.02;
const ENEMY_COUNT_CAP_ROOM = 18;
const CAPPED_ROOM_ENEMY_COUNT = 26;

// Pre-boss buildup (trash rooms only - boss encounter tuning unchanged)
const EARLY_RUN_COUNT_BASE = 8;
const EARLY_RUN_COUNT_PER_ROOM = 1.35;
const EARLY_RUN_XP_BONUS = 1.4;
const EARLY_RUN_HP_BONUS = 1.35;
const CARDS_FIRST_BOSS_ROOM = 12;

const DIFFICULTY_PRESETS = {
    easy: { hp: 0.80, damage: 0.85, count: 0.90, tempo: 0.90, intelligence: -0.08 },
    normal: { hp: 1.00, damage: 1.00, count: 1.00, tempo: 1.00, intelligence: 0.00 },
    hard: { hp: 1.20, damage: 1.15, count: 1.10, tempo: 1.10, intelligence: 0.08 }
};

const MULTIPLAYER_SCALING = {
    gear: {
        1: { enemyCount: 1.0, enemyHP: 1.0, enemyDamage: 1.0, bossHP: 1.0, bossDamage: 1.0 },
        2: { enemyCount: 1.5, enemyHP: 1.35, enemyDamage: 1.04, bossHP: 1.40, bossDamage: 1.10 },
        3: { enemyCount: 2.0, enemyHP: 1.40, enemyDamage: 1.04, bossHP: 1.80, bossDamage: 1.15 },
        4: { enemyCount: 2.5, enemyHP: 1.50, enemyDamage: 1.04, bossHP: 2.20, bossDamage: 1.18 }
    },
    cards: {
        1: { enemyCount: 1.0, enemyHP: 1.0, enemyDamage: 1.0, bossHP: 1.0, bossDamage: 1.0 },
        2: { enemyCount: 1.6, enemyHP: 1.20, enemyDamage: 1.04, bossHP: 1.35, bossDamage: 1.10 },
        3: { enemyCount: 2.1, enemyHP: 1.25, enemyDamage: 1.04, bossHP: 1.70, bossDamage: 1.15 },
        4: { enemyCount: 2.6, enemyHP: 1.30, enemyDamage: 1.04, bossHP: 2.00, bossDamage: 1.18 }
    }
};

const ROOM_TYPE_MODIFIERS = {
    elite: { hp: 1.15, damage: 1.15, count: 1.0 },
    challenge: { hp: 1.30, damage: 1.30, count: 1.12 },
    truncation: { hp: 0.50, damage: 1.0, count: 0.80 },
    rest: { hp: 0.80, damage: 0.80, count: 1.0 },
    purification: { hp: 1.25, damage: 1.25, count: 1.0 },
    bonus_slot: { hp: 1.50, damage: 1.50, count: 1.0 },
    normal: { hp: 1.0, damage: 1.0, count: 1.0 },
    safe: { hp: 1.0, damage: 1.0, count: 1.0 },
    treasure: { hp: 1.0, damage: 1.0, count: 1.0 },
    boss: { hp: 1.0, damage: 1.0, count: 1.0 }
};

// --- Boss scaling (migrated from boss-scaling.js) ---
const BOSS_SCALING_PROFILES = {
    swarmKing: { id: 'swarmKing', name: 'Swarm King', hpWeight: 0.88, damageWeight: 0.90, templateDamage: 8 },
    twinPrism: { id: 'twinPrism', name: 'Twin Prism', hpWeight: 1.05, damageWeight: 1.10, templateDamage: 10 },
    fortress: { id: 'fortress', name: 'Fortress', hpWeight: 1.10, damageWeight: 1.20, templateDamage: 11 },
    fractalCore: { id: 'fractalCore', name: 'Fractal Core', hpWeight: 1.05, damageWeight: 1.35, templateDamage: 14 },
    vortex: { id: 'vortex', name: 'Vortex', hpWeight: 1.20, damageWeight: 1.55, templateDamage: 16 }
};

const GEAR_BOSS_CYCLE = ['swarmKing', 'twinPrism', 'fortress', 'fractalCore', 'vortex'];
const GEAR_FIRST_BOSS_ROOM = 10;
const GEAR_BOSS_INTERVAL = 5;

const CARD_BOSS_ROOMS = {
    12: 'swarmKing',
    22: 'fortress',
    32: 'vortex'
};

const BOSS_MODE_CONFIG = {
    gear: {
        canonicalEndRoom: 30,
        anchorBaseHp: 17350,
        anchorBaseDamage: 8,
        bossesPerCycle: GEAR_BOSS_CYCLE.length,
        firstBossRoom: GEAR_FIRST_BOSS_ROOM,
        bossInterval: GEAR_BOSS_INTERVAL,
        encounterHpMultipliers: [1.00, 1.05, 1.10, 1.14, 1.19],
        encounterDamageMultipliers: [1.00, 1.10, 1.18, 1.26, 1.34],
        endlessEncounterHpGrowth: 1.16,
        endlessEncounterDamageGrowth: 1.10,
        endlessHpGrowthPerRoom: 0.04,
        endlessDamageGrowthPerRoom: 0.03,
        endlessCycleHpGrowth: 0.22,
        endlessCycleDamageGrowth: 0.10,
        eliteSpawnHpMultiplier: 0.92
    },
    cards: {
        canonicalEndRoom: 32,
        anchorBaseHp: 14200,
        anchorBaseDamage: 8,
        bossesPerCycle: 3,
        encounterHpMultipliers: [1.00, 1.50, 1.85],
        encounterDamageMultipliers: [1.00, 1.18, 1.42],
        endlessEncounterHpGrowth: 1.20,
        endlessEncounterDamageGrowth: 1.12,
        bossHpWeights: { swarmKing: 0.88, fortress: 1.00, vortex: 1.00 },
        bossDamageWeights: { swarmKing: 0.90, fortress: 1.00, vortex: 1.00 },
        endlessHpGrowthPerRoom: 0.05,
        endlessDamageGrowthPerRoom: 0.035,
        endlessCycleHpGrowth: 0.28,
        endlessCycleDamageGrowth: 0.12,
        eliteSpawnHpMultiplier: 0.90
    }
};

const TEMPO_FIELD_NAMES = new Set([
    'attackCooldown', 'shootCooldown', 'telegraphDuration', 'quickTelegraphDuration',
    'delayedTelegraphDuration', 'lungeDuration', 'attackRecoveryDuration',
    'dashDuration', 'burstFireDelay', 'projectileLifetime', 'roarCooldown',
    'chargeCooldown', 'slamCooldown', 'spinDuration', 'chargeDuration',
    'recoveryDuration', 'postAttackPause', 'predictiveLeadTime'
]);

const MOBILITY_FIELD_NAMES = new Set([
    'moveSpeed', 'lungeSpeed', 'projectileSpeed', 'dashSpeed', 'strafeSpeed', 'strafeAmplitude'
]);

const CONFIG_FIELD_TAGS = {
    boss_fortress: {
        rotationStep: 'geometry',
        spread: 'geometry',
        laneConeWidth: 'geometry',
        frontWidth: 'geometry',
        coverSafePadding: 'geometry',
        hpThresholdRatio: 'ratio',
        minionHpMultiplier: 'ratio',
        minionDamageMultiplier: 'ratio',
        damageMultiplier: 'damage',
        knockbackForce: 'damage',
        force: 'damage',
        chipDamageMultiplier: 'damage',
        projectileSpeed: 'mobility',
        speed: 'mobility',
        telegraphDuration: 'timing',
        attackDuration: 'timing',
        waveInterval: 'timing',
        shotInterval: 'timing',
        sweepDuration: 'timing',
        cooldown: 'timing',
        proximityDelay: 'timing',
        weakPointWindow: 'timing',
        weakPointWindowP3: 'timing',
        barrageDuration: 'timing',
        sortieDuration: 'timing',
        totalDuration: 'timing',
        stateCooldown: 'timing',
        occupancyWindow: 'timing',
        phase1: 'timing',
        phase2: 'timing',
        phase3: 'timing',
        phaseTelegraph: 'timing',
        phaseAttack: 'timing',
        phaseProjectiles: 'count',
        phaseWaves: 'count',
        shotsPerTurret: 'count',
        laneCount: 'count',
        minionGuards: 'count',
        minionSkirmishers: 'count',
        guards: 'count',
        skirmishers: 'count'
    },
    boss_vortex: {
        telegraph: 'timing',
        cooldown: 'timing',
        phaseScale: 'ratio',
        damage: 'damage',
        projectileSpeed: 'mobility',
        moveSpeed: 'mobility'
    }
};

const ENTITY_PROFILES = {
    enemy_basic: {
        tier: 'trash',
        configGlobal: 'BASIC_ENEMY_CONFIG',
        groups: ['durability', 'offense', 'mobility', 'tempo', 'cognition', 'xp']
    },
    enemy_star: {
        tier: 'trash',
        configGlobal: 'STAR_CONFIG',
        groups: ['durability', 'offense', 'mobility', 'tempo', 'cognition', 'xp']
    },
    enemy_diamond: {
        tier: 'trash',
        configGlobal: 'DIAMOND_CONFIG',
        groups: ['durability', 'offense', 'mobility', 'tempo', 'cognition', 'xp'],
        damageTrimField: 'damageScalingMultiplier',
        mobilityRoomSteps: [
            { aboveRoom: 0, mult: 1.05 },
            { aboveRoom: 15, mult: 1.15 },
            { aboveRoom: 20, mult: 1.20 }
        ],
        attackRangeRoomSteps: [{ aboveRoom: 20, mult: 1.10 }]
    },
    enemy_rectangle: {
        tier: 'trash',
        configGlobal: 'RECTANGLE_CONFIG',
        groups: ['durability', 'offense', 'mobility', 'tempo', 'cognition', 'xp']
    },
    enemy_octagon: {
        tier: 'elite',
        configGlobal: 'OCTAGON_CONFIG',
        groups: ['durability', 'offense', 'mobility', 'tempo', 'cognition', 'xp']
    },
    boss_swarmKing: {
        tier: 'boss',
        bossScalingId: 'swarmKing',
        groups: ['durability', 'offense', 'mobility', 'tempo'],
        mobilityFields: ['moveSpeed']
    },
    boss_twinPrism: {
        tier: 'boss',
        bossScalingId: 'twinPrism',
        groups: ['durability', 'offense', 'mobility', 'tempo'],
        mobilityFields: ['moveSpeed']
    },
    boss_fortress: {
        tier: 'boss',
        bossScalingId: 'fortress',
        groups: ['durability', 'offense'],
        abilityConfigKey: 'FORTRESS_CONFIG_TEMPLATE',
        configFieldTags: 'boss_fortress'
    },
    boss_fractalCore: {
        tier: 'boss',
        bossScalingId: 'fractalCore',
        groups: ['durability', 'offense', 'mobility', 'tempo'],
        mobilityFields: ['moveSpeed']
    },
    boss_vortex: {
        tier: 'boss',
        bossScalingId: 'vortex',
        groups: ['durability', 'offense', 'mobility', 'tempo'],
        configFieldTags: 'boss_vortex'
    },
    minion: {
        tier: 'minion',
        groups: ['durability', 'offense', 'xp']
    }
};

const _unknownConfigKeysLogged = new Set();

function resolveDifficulty(difficulty) {
    const key = difficulty || 'normal';
    return DIFFICULTY_PRESETS[key] || DIFFICULTY_PRESETS.normal;
}

function getGameMode() {
    if (typeof Game !== 'undefined' && Game.gameMode) {
        return Game.gameMode;
    }
    return 'gear';
}

function getRunDifficulty() {
    if (typeof Game !== 'undefined' && Game.difficulty) {
        return Game.difficulty;
    }
    return 'normal';
}

function setRunDifficulty(difficulty) {
    const preset = resolveDifficulty(difficulty);
    if (!preset) return false;
    if (typeof Game !== 'undefined') {
        Game.difficulty = difficulty in DIFFICULTY_PRESETS ? difficulty : 'normal';
    }
    return true;
}

function getPlayerCount() {
    if (typeof Game !== 'undefined' && Game.multiplayerEnabled &&
        typeof multiplayerManager !== 'undefined' && multiplayerManager &&
        multiplayerManager.players) {
        return multiplayerManager.players.length;
    }
    return 1;
}

function getMultiplayerScaling(options = {}) {
    const defaultScaling = {
        enemyCount: 1.0,
        enemyHP: 1.0,
        enemyDamage: 1.0,
        bossHP: 1.0,
        bossDamage: 1.0
    };

    const playerCount = options.playerCount || getPlayerCount();
    if (playerCount <= 1) {
        return defaultScaling;
    }

    const gameMode = options.gameMode || getGameMode();
    const table = MULTIPLAYER_SCALING[gameMode] || MULTIPLAYER_SCALING.gear;
    const capped = Math.min(playerCount, 4);
    return table[capped] || table[4] || defaultScaling;
}

function createContext(options = {}) {
    const roomNumber = options.roomNumber ||
        (typeof Game !== 'undefined' ? (Game.roomNumber || 1) : 1);
    const gameMode = options.gameMode || getGameMode();
    const roomType = options.roomType || 'normal';
    const difficulty = options.difficulty || getRunDifficulty();
    const playerCount = options.playerCount || getPlayerCount();

    return {
        roomNumber,
        gameMode,
        roomType,
        difficulty,
        playerCount,
        nextRoomModifiers: options.nextRoomModifiers || null,
        isEliteBossSpawn: options.isEliteBossSpawn === true,
        enemyHpMod: options.enemyHpMod != null ? options.enemyHpMod : 1.0,
        enemySpeedMod: options.enemySpeedMod != null ? options.enemySpeedMod : 1.0,
        doubleEnemies: options.doubleEnemies === true
    };
}

function computeIntelligence(roomNumber, difficulty) {
    const preset = resolveDifficulty(difficulty);
    let intel;
    if (roomNumber <= 3) {
        intel = 0.5 + (roomNumber / 3) * 0.15;
    } else if (roomNumber <= 10) {
        intel = 0.65 + ((roomNumber - 3) / 7) * 0.2;
    } else {
        intel = 0.85 + Math.min((roomNumber - 10) / 10, 0.15);
    }
    return Math.max(0, Math.min(1, intel + preset.intelligence));
}

function getTelegraphScale(intelligence, baseTelegraph) {
    const base = baseTelegraph != null ? baseTelegraph : 1.0;
    return Math.max(0.2, base * (1 - intelligence * 0.25));
}

function getAttackCadenceScale(intelligence) {
    return Math.max(0.35, intelligence);
}

function getPreBossLastRoom(gameMode) {
    const mode = gameMode || getGameMode();
    if (mode === 'cards') {
        return CARDS_FIRST_BOSS_ROOM - 1;
    }
    const cfg = BOSS_MODE_CONFIG[mode] || BOSS_MODE_CONFIG.gear;
    return (cfg.firstBossRoom || GEAR_FIRST_BOSS_ROOM) - 1;
}

function computeBaseEnemyCount(roomNumber, gameMode) {
    const preBossLast = getPreBossLastRoom(gameMode);
    if (roomNumber <= preBossLast) {
        return EARLY_RUN_COUNT_BASE + Math.floor(roomNumber * EARLY_RUN_COUNT_PER_ROOM);
    }
    if (roomNumber <= ENEMY_COUNT_CAP_ROOM) {
        return 6 + Math.floor(roomNumber * 1.05);
    }
    return CAPPED_ROOM_ENEMY_COUNT + Math.floor((roomNumber - ENEMY_COUNT_CAP_ROOM) * 1.0);
}

function computeEnemyCount(roomNumber, roomType, ctx, factors) {
    const gameMode = ctx && ctx.gameMode ? ctx.gameMode : getGameMode();
    let baseEnemyCount = computeBaseEnemyCount(roomNumber, gameMode);

    const roomMod = ROOM_TYPE_MODIFIERS[roomType] || ROOM_TYPE_MODIFIERS.normal;
    baseEnemyCount = Math.floor(baseEnemyCount * roomMod.count);

    if (ctx && ctx.doubleEnemies) {
        baseEnemyCount *= 2;
    }

    const mp = factors ? factors.mp : getMultiplayerScaling(ctx || {});
    const diff = factors ? factors.difficulty : resolveDifficulty(getRunDifficulty());
    return Math.floor(baseEnemyCount * mp.enemyCount * diff.count);
}

function computeScalingFactors(ctx) {
    const roomNumber = ctx.roomNumber || 1;
    const roomIndex = Math.max(0, roomNumber - 1);
    const roomType = ctx.roomType || 'normal';
    const difficulty = resolveDifficulty(ctx.difficulty);
    const mp = getMultiplayerScaling(ctx);
    const roomMod = ROOM_TYPE_MODIFIERS[roomType] || ROOM_TYPE_MODIFIERS.normal;

    const roomHp = Math.pow(1 + ENEMY_HP_GROWTH_PER_ROOM, roomIndex) * roomMod.hp * difficulty.hp;
    const roomDamage = Math.pow(1 + ENEMY_DAMAGE_GROWTH_PER_ROOM, roomIndex) * roomMod.damage * difficulty.damage;
    const roomMobility = Math.pow(1 + ENEMY_MOBILITY_GROWTH_PER_ROOM, roomIndex);
    const roomTempoDivisor = 1 + ENEMY_TEMPO_GROWTH_PER_ROOM * roomIndex;
    const roomTempo = 1 / roomTempoDivisor;
    const difficultyTempo = difficulty.tempo;
    const timingMult = roomTempo / difficultyTempo;
    const intelligence = computeIntelligence(roomNumber, ctx.difficulty);
    const telegraphScale = getTelegraphScale(intelligence);

    let enemyHpMod = ctx.enemyHpMod != null ? ctx.enemyHpMod : 1.0;
    let enemySpeedMod = ctx.enemySpeedMod != null ? ctx.enemySpeedMod : 1.0;

    if (ctx.nextRoomModifiers) {
        const mods = ctx.nextRoomModifiers;
        if (Number.isFinite(mods.hpPct) && mods.hpPct !== 0) {
            enemyHpMod *= (1 + mods.hpPct);
        }
        if (Number.isFinite(mods.speedPct) && mods.speedPct !== 0) {
            enemySpeedMod *= (1 + mods.speedPct);
        }
    }

    const enemyCount = computeEnemyCount(roomNumber, roomType, ctx, {
        mp, difficulty
    });

    return {
        roomNumber,
        roomIndex,
        roomHp,
        roomDamage,
        roomMobility,
        roomTempo,
        roomTempoDivisor,
        difficultyTempo,
        timingMult,
        intelligence,
        telegraphScale,
        mp,
        difficulty,
        roomTypeMod: roomMod,
        enemyHpMod,
        enemySpeedMod,
        enemyCount,
        bossHpGrowth: BOSS_HP_GROWTH_PER_ROOM,
        bossDamageGrowth: BOSS_DAMAGE_GROWTH_PER_ROOM
    };
}

function resolveConfigForProfile(profileId, baseConfig) {
    if (baseConfig) return baseConfig;
    const profile = ENTITY_PROFILES[profileId];
    if (!profile || !profile.configGlobal) return {};

    const name = profile.configGlobal;
    if (!/^[A-Z][A-Z0-9_]*$/.test(name)) return {};

    // Node/vm tests attach CONFIG to globalThis
    if (typeof globalThis !== 'undefined' && globalThis[name]) {
        return globalThis[name];
    }

    // Browser classic scripts: CONFIG consts are global lexical bindings, not window properties
    try {
        const resolver = new Function(`return typeof ${name} !== 'undefined' ? ${name} : null;`);
        const config = resolver();
        if (config) return config;
    } catch (e) {
        // ignore invalid lookup
    }

    return {};
}

function buildBaseConfigFromEnemy(enemy, profileId) {
    const config = resolveConfigForProfile(profileId, null);
    if (config.maxHp) return config;

    if (!enemy) return config;

    let baseDamage = enemy.damage;
    if (typeof enemy.damageScalingMultiplier === 'number') {
        baseDamage = enemy.damage / enemy.damageScalingMultiplier;
    }

    return {
        maxHp: enemy.maxHp,
        damage: baseDamage,
        xpValue: enemy.xpValue,
        moveSpeed: enemy.moveSpeed || enemy.baseMoveSpeed,
        attackCooldown: enemy.attackCooldownTime,
        telegraphDuration: enemy.telegraphDuration,
        shootCooldown: enemy.shootCooldownTime,
        damageScalingMultiplier: profileId === 'enemy_diamond' ? enemy.damageScalingMultiplier : undefined
    };
}

function applyMobilityRoomSteps(roomNumber, baseValue, steps) {
    if (!steps || !steps.length) return baseValue;
    let mult = 1.0;
    for (let i = 0; i < steps.length; i++) {
        if (roomNumber > steps[i].aboveRoom) {
            mult = steps[i].mult;
        }
    }
    return baseValue * mult;
}

function resolveEnemyStats(profileId, baseConfig, ctx, factors, options = {}) {
    const profile = ENTITY_PROFILES[profileId];
    if (!profile) {
        throw new Error(`Unknown enemy profile: ${profileId}`);
    }

    const config = resolveConfigForProfile(profileId, baseConfig);
    const f = factors || computeScalingFactors(ctx);
    const roomNumber = ctx.roomNumber || 1;

    let hpMult = f.roomHp * f.mp.enemyHP * f.enemyHpMod;
    if (roomNumber <= getPreBossLastRoom(ctx.gameMode)) {
        hpMult *= EARLY_RUN_HP_BONUS;
    }
    const dmgMult = f.roomDamage * f.mp.enemyDamage;
    const mobMult = f.roomMobility * f.enemySpeedMod;
    const timingMult = f.timingMult;

    let damage = (config.damage || 0) * dmgMult;
    if (profile.damageTrimField && config[profile.damageTrimField] != null) {
        damage *= config[profile.damageTrimField];
    }

    let xpMult = f.roomHp;
    if (roomNumber <= getPreBossLastRoom(ctx.gameMode)) {
        xpMult *= EARLY_RUN_XP_BONUS;
    }

    const stats = {
        maxHp: Math.floor((config.maxHp || 0) * hpMult),
        damage,
        xpValue: Math.floor((config.xpValue || 0) * xpMult),
        moveSpeed: applyMobilityRoomSteps(roomNumber, config.moveSpeed || 0, profile.mobilityRoomSteps) * mobMult,
        intelligenceLevel: f.intelligence,
        telegraphScale: f.telegraphScale,
        attackCadenceScale: getAttackCadenceScale(f.intelligence),
        profileId,
        factors: f
    };

    if (profile.attackRangeRoomSteps) {
        let rangeMult = 1.0;
        for (let i = 0; i < profile.attackRangeRoomSteps.length; i++) {
            const step = profile.attackRangeRoomSteps[i];
            if (roomNumber > step.aboveRoom) rangeMult = step.mult;
        }
        if (config.attackRange != null) {
            stats.attackRange = config.attackRange * rangeMult;
        }
    }

    Object.keys(config).forEach(key => {
        if (TEMPO_FIELD_NAMES.has(key) && typeof config[key] === 'number') {
            stats[key] = config[key] * timingMult;
        } else if (MOBILITY_FIELD_NAMES.has(key) && typeof config[key] === 'number') {
            stats[key] = config[key] * mobMult;
        }
    });

    if (options.includeConfigFields) {
        stats._config = config;
    }

    return stats;
}

function applyEnemyScaling(enemy, profileId, ctx, options = {}) {
    if (!enemy) return null;

    const factors = ctx._factors || computeScalingFactors(ctx);
    const baseConfig = options.baseConfig || buildBaseConfigFromEnemy(enemy, profileId);
    const stats = resolveEnemyStats(profileId, baseConfig, ctx, factors, options);

    if (!stats.maxHp || stats.maxHp <= 0) {
        console.warn('[CombatScaling] applyEnemyScaling produced zero HP for', profileId, '- check CONFIG lookup');
    }

    enemy.maxHp = stats.maxHp;
    enemy.hp = stats.maxHp;
    enemy.damage = stats.damage;
    enemy.xpValue = stats.xpValue;
    enemy.intelligenceLevel = stats.intelligenceLevel;
    enemy.scaledStats = stats;

    if (stats.moveSpeed != null) {
        enemy.moveSpeed = stats.moveSpeed;
        enemy.baseMoveSpeed = stats.moveSpeed;
    }
    if (stats.attackRange != null) {
        enemy.attackRange = stats.attackRange;
    }
    if (stats.attackCooldown != null) {
        enemy.attackCooldownTime = stats.attackCooldown;
    }
    if (stats.telegraphDuration != null) {
        enemy.telegraphDuration = stats.telegraphDuration;
    }
    if (stats.shootCooldown != null) {
        enemy.shootCooldownTime = stats.shootCooldown;
    }
    if (typeof enemy.damageScalingMultiplier === 'number' && stats.damage !== enemy.damage) {
        // Constructor may have set trim; scaling already applied in resolveEnemyStats
        delete enemy.damageScalingMultiplier;
    }
    if (Number.isFinite(factors.enemySpeedMod) && factors.enemySpeedMod !== 1.0) {
        enemy.globalSpeedMultiplier = (enemy.globalSpeedMultiplier || 1.0) * factors.enemySpeedMod;
    }

    return stats;
}

function getEnemyProfileIdForInstance(enemy) {
    if (!enemy) return 'enemy_basic';
    if (enemy.shape === 'octagon' || enemy.constructor.name === 'OctagonEnemy') return 'enemy_octagon';
    if (enemy.shape === 'star' || enemy.constructor.name === 'StarEnemy') return 'enemy_star';
    if (enemy.shape === 'diamond' || enemy.constructor.name === 'DiamondEnemy') return 'enemy_diamond';
    if (enemy.shape === 'rectangle' || enemy.constructor.name === 'RectangleEnemy') return 'enemy_rectangle';
    return 'enemy_basic';
}

// --- Boss helpers ---
function getEncounterStatMultiplier(modeConfig, encounterIndex, table, endlessGrowth) {
    const multipliers = table || [1.0];
    if (encounterIndex < multipliers.length) {
        return multipliers[encounterIndex];
    }
    const last = multipliers[multipliers.length - 1];
    const extraSteps = encounterIndex - multipliers.length + 1;
    return last * Math.pow(endlessGrowth || 1.15, extraSteps);
}

function isGearBossRoom(roomNumber) {
    return roomNumber >= GEAR_FIRST_BOSS_ROOM &&
        roomNumber <= BOSS_MODE_CONFIG.gear.canonicalEndRoom &&
        (roomNumber - GEAR_FIRST_BOSS_ROOM) % GEAR_BOSS_INTERVAL === 0;
}

function getGearBossKey(roomNumber) {
    const index = Math.floor((roomNumber - GEAR_FIRST_BOSS_ROOM) / GEAR_BOSS_INTERVAL) % GEAR_BOSS_CYCLE.length;
    return GEAR_BOSS_CYCLE[index];
}

function getBossKeyForRoom(gameMode, roomNumber) {
    if (gameMode === 'gear') {
        return isGearBossRoom(roomNumber) ? getGearBossKey(roomNumber) : null;
    }
    return CARD_BOSS_ROOMS[roomNumber] || null;
}

function getBossEncounterIndex(gameMode, roomNumber) {
    if (gameMode === 'gear') {
        if (roomNumber >= GEAR_FIRST_BOSS_ROOM && roomNumber % GEAR_BOSS_INTERVAL === 0) {
            return Math.floor((roomNumber - GEAR_FIRST_BOSS_ROOM) / GEAR_BOSS_INTERVAL);
        }
        return 0;
    }

    const cardRooms = Object.keys(CARD_BOSS_ROOMS).map(Number).sort((a, b) => a - b);
    for (let i = cardRooms.length - 1; i >= 0; i--) {
        if (roomNumber >= cardRooms[i]) {
            return i + (roomNumber > BOSS_MODE_CONFIG.cards.canonicalEndRoom && roomNumber % 5 === 0
                ? Math.floor((roomNumber - 35) / 5) + 1
                : 0);
        }
    }
    return 0;
}

function getBossGrowthConstants() {
    return { hpGrowth: BOSS_HP_GROWTH_PER_ROOM, damageGrowth: BOSS_DAMAGE_GROWTH_PER_ROOM };
}

function resolveBossProfile(boss) {
    if (boss.bossScalingId && BOSS_SCALING_PROFILES[boss.bossScalingId]) {
        return BOSS_SCALING_PROFILES[boss.bossScalingId];
    }
    const byName = Object.values(BOSS_SCALING_PROFILES).find(p => p.name === boss.bossName);
    return byName || BOSS_SCALING_PROFILES.swarmKing;
}

function resolveModeWeights(modeConfig, profile, gameMode) {
    let hpWeight = profile.hpWeight;
    let damageWeight = profile.damageWeight;

    if (gameMode === 'cards') {
        if (modeConfig.bossHpWeights && modeConfig.bossHpWeights[profile.id] !== undefined) {
            hpWeight = modeConfig.bossHpWeights[profile.id];
        }
        if (modeConfig.bossDamageWeights && modeConfig.bossDamageWeights[profile.id] !== undefined) {
            damageWeight = modeConfig.bossDamageWeights[profile.id];
        }
    }

    return { hpWeight, damageWeight };
}

function computeBossStats(bossScalingId, roomNumber, options = {}) {
    const gameMode = options.gameMode || getGameMode();
    const modeConfig = BOSS_MODE_CONFIG[gameMode] || BOSS_MODE_CONFIG.gear;
    const profile = BOSS_SCALING_PROFILES[bossScalingId] || BOSS_SCALING_PROFILES.swarmKing;
    const growth = options.growth || getBossGrowthConstants();
    const mpScaling = options.mpScaling || getMultiplayerScaling(options);
    const difficulty = resolveDifficulty(options.difficulty || getRunDifficulty());
    const isEliteSpawn = options.isEliteSpawn === true;

    const { hpWeight, damageWeight } = resolveModeWeights(modeConfig, profile, gameMode);
    const roomIndex = Math.max(0, roomNumber - 1);
    const encounterIndex = getBossEncounterIndex(gameMode, roomNumber);

    const encounterHpMult = getEncounterStatMultiplier(
        modeConfig, encounterIndex, modeConfig.encounterHpMultipliers, modeConfig.endlessEncounterHpGrowth
    );
    const encounterDamageMult = getEncounterStatMultiplier(
        modeConfig, encounterIndex, modeConfig.encounterDamageMultipliers, modeConfig.endlessEncounterDamageGrowth
    );

    let constructorHp = modeConfig.anchorBaseHp * hpWeight * encounterHpMult;
    let constructorDamage = modeConfig.anchorBaseDamage * damageWeight * encounterDamageMult;
    if (roomNumber > modeConfig.canonicalEndRoom) {
        const roomsPastEnd = roomNumber - modeConfig.canonicalEndRoom;
        constructorHp *= Math.pow(1 + modeConfig.endlessHpGrowthPerRoom, roomsPastEnd);
        constructorDamage *= Math.pow(1 + modeConfig.endlessDamageGrowthPerRoom, roomsPastEnd);
    }

    const cycleIndex = Math.floor(encounterIndex / modeConfig.bossesPerCycle);
    if (cycleIndex > 0) {
        constructorHp *= Math.pow(1 + modeConfig.endlessCycleHpGrowth, cycleIndex);
        constructorDamage *= Math.pow(1 + modeConfig.endlessCycleDamageGrowth, cycleIndex);
    }

    if (isEliteSpawn) {
        constructorHp *= modeConfig.eliteSpawnHpMultiplier;
        constructorDamage *= modeConfig.eliteSpawnHpMultiplier;
    }

    const roomHpScale = Math.pow(1 + growth.hpGrowth, roomIndex) * difficulty.hp;
    const roomDamageScale = Math.pow(1 + growth.damageGrowth, roomIndex) * difficulty.damage;

    return {
        bossScalingId: profile.id,
        bossName: profile.name,
        gameMode,
        roomNumber,
        encounterIndex,
        cycleIndex,
        constructorHp,
        constructorDamage,
        maxHp: Math.floor(constructorHp * roomHpScale * mpScaling.bossHP),
        damage: constructorDamage * roomDamageScale * mpScaling.bossDamage,
        roomHpScale,
        roomDamageScale,
        isEndless: roomNumber > modeConfig.canonicalEndRoom,
        isEliteSpawn
    };
}

function resolveBossStats(bossScalingId, ctx) {
    const factors = ctx._factors || computeScalingFactors(ctx);
    return computeBossStats(bossScalingId, ctx.roomNumber, {
        gameMode: ctx.gameMode,
        mpScaling: factors.mp,
        difficulty: ctx.difficulty,
        isEliteSpawn: ctx.isEliteBossSpawn
    });
}

function applyBossScaling(boss, roomNumber, options = {}) {
    if (!boss) return null;

    const profile = resolveBossProfile(boss);
    const isEliteSpawn = options.isEliteSpawn === true || boss.isEliteEnemy === true;
    const mpScaling = options.mpScaling || getMultiplayerScaling(options);

    const stats = computeBossStats(profile.id, roomNumber, {
        gameMode: options.gameMode,
        mpScaling,
        growth: options.growth,
        difficulty: options.difficulty || getRunDifficulty(),
        isEliteSpawn
    });

    boss.bossScalingId = profile.id;
    boss.maxHp = stats.maxHp;
    boss.hp = stats.maxHp;
    boss.damage = stats.damage;
    boss.bossScalingMeta = {
        gameMode: stats.gameMode,
        encounterIndex: stats.encounterIndex,
        cycleIndex: stats.cycleIndex,
        isEndless: stats.isEndless,
        isEliteSpawn: stats.isEliteSpawn,
        constructorHp: stats.constructorHp,
        constructorDamage: stats.constructorDamage
    };

    const ctx = createContext({
        roomNumber,
        gameMode: options.gameMode || getGameMode(),
        difficulty: options.difficulty || getRunDifficulty(),
        isEliteBossSpawn: isEliteSpawn
    });
    const factors = computeScalingFactors(ctx);
    const profileId = `boss_${profile.id}`;

    if (ENTITY_PROFILES[profileId] && ENTITY_PROFILES[profileId].mobilityFields) {
        ENTITY_PROFILES[profileId].mobilityFields.forEach(field => {
            if (typeof boss[field] === 'number' && boss[field] > 0) {
                boss[field] *= factors.roomMobility;
            }
        });
    }

    return stats;
}

function inferConfigFieldCategory(key, tagMap) {
    if (tagMap && tagMap[key]) return tagMap[key];

    const lower = key.toLowerCase();
    if (/telegraph|cooldown|duration|interval|pause|delay|window|recovery/.test(lower)) return 'timing';
    if (/projectilespeed|movespeed|dashspeed/.test(lower)) return 'mobility';
    if (lower === 'speed' && !lower.includes('amplitude')) return 'mobility';
    if (/damage|knockback|force/.test(lower) && !/multiplier/.test(lower)) return 'damage';
    if (/damagemultiplier|chipdamage/.test(lower)) return 'damage';
    if (/rotationstep|spread|width|padding|cone|offset|angle|ratio|threshold|phasescale|weight|probability/.test(lower)) {
        return 'geometry';
    }
    if (/multiplier|ratio|scale|weight/.test(lower)) return 'ratio';
    if (/count|guards|skirmishers|shots|waves|projectiles|lanes/.test(lower)) return 'count';

    return 'skip';
}

function scaleNumericByCategory(value, category, factors) {
    switch (category) {
        case 'timing':
            return value * factors.timingMult;
        case 'damage':
            return value * factors.roomDamage * factors.mp.enemyDamage;
        case 'mobility':
            return value * factors.roomMobility;
        case 'count':
            return value;
        case 'geometry':
        case 'ratio':
        case 'skip':
        default:
            return value;
    }
}

function scaleBossConfigValue(value, key, path, tagMap, factors, phase) {
    if (value == null) return value;

    if (typeof value === 'number') {
        const category = inferConfigFieldCategory(key, tagMap);
        if (category === 'skip' && !_unknownConfigKeysLogged.has(path)) {
            _unknownConfigKeysLogged.add(path);
        }
        return scaleNumericByCategory(value, category, factors);
    }

    if (Array.isArray(value)) {
        return value.map((item, index) => scaleBossConfigValue(item, String(index), `${path}[${index}]`, tagMap, factors, phase));
    }

    if (typeof value === 'object') {
        const result = {};
        Object.keys(value).forEach(childKey => {
            const childPath = path ? `${path}.${childKey}` : childKey;
            let childValue = value[childKey];

            if (typeof childValue === 'object' && childValue !== null && !Array.isArray(childValue)) {
                if (phase != null && Object.prototype.hasOwnProperty.call(childValue, phase)) {
                    childValue = childValue[phase];
                } else if (phase != null && Object.prototype.hasOwnProperty.call(childValue, String(phase))) {
                    childValue = childValue[String(phase)];
                }
            }

            result[childKey] = scaleBossConfigValue(childValue, childKey, childPath, tagMap, factors, null);
        });
        return result;
    }

    return value;
}

function scaleBossConfig(template, ctx, phase, profileId) {
    if (!template) return template;
    const factors = ctx._factors || computeScalingFactors(ctx);
    const profile = ENTITY_PROFILES[profileId] || {};
    const tagKey = profile.configFieldTags;
    const tagMap = tagKey ? CONFIG_FIELD_TAGS[tagKey] : null;
    const cloned = JSON.parse(JSON.stringify(template));
    return scaleBossConfigValue(cloned, '', '', tagMap, factors, phase);
}

function applyMinionScaling(minion, ctx, callerMults = {}) {
    if (!minion) return null;

    const roomNumber = ctx.roomNumber ||
        (typeof Game !== 'undefined' ? (Game.roomNumber || 1) : 1);
    const fullCtx = ctx.roomNumber ? ctx : createContext({ roomNumber });
    const factors = fullCtx._factors || computeScalingFactors(fullCtx);

    const healthMult = callerMults.healthMult != null ? callerMults.healthMult : 1.0;
    const damageMult = callerMults.damageMult != null ? callerMults.damageMult : 1.0;
    const xpMult = callerMults.xpMult;

    const hpScale = factors.roomHp * factors.mp.enemyHP;
    const dmgScale = factors.roomDamage * factors.mp.enemyDamage;

    minion.maxHp = Math.floor(minion.maxHp * hpScale * healthMult);
    minion.hp = minion.maxHp;
    minion.damage = minion.damage * dmgScale * damageMult;

    if (xpMult !== null && xpMult !== undefined) {
        minion.xpValue = Math.floor(minion.xpValue * factors.roomHp * xpMult);
    }

    return { factors, healthMult, damageMult };
}

/**
 * Scale a combat minion spawned mid-fight (boss/elite callers).
 * Applies room/MP scaling via applyMinionScaling, then caller-specific mults, then activation.
 */
function scaleMinionStats(minion, healthMultiplier, damageMultiplier, xpMultiplier = null) {
    if (!minion) return null;

    const roomNumber = typeof Game !== 'undefined' ? (Game.roomNumber || 1) :
        (typeof currentRoom !== 'undefined' && currentRoom ? currentRoom.number : 1);

    applyMinionScaling(minion, createContext({ roomNumber }), {
        healthMult: healthMultiplier,
        damageMult: damageMultiplier,
        xpMult: xpMultiplier
    });

    const isBossRoom = (typeof currentRoom !== 'undefined' && currentRoom && currentRoom.type === 'boss');

    if (minion.currentTarget) {
        if (minion.state === 'standby' || minion.state === undefined) {
            minion.state = 'chase';
        }
        minion.activated = true;
    } else if (isBossRoom && typeof minion.getAllAlivePlayers === 'function') {
        const allPlayers = minion.getAllAlivePlayers();
        if (allPlayers.length > 0) {
            const alivePlayers = allPlayers.filter(p => p.player && p.player.alive !== false);
            if (alivePlayers.length > 0) {
                const randomIndex = Math.floor(Math.random() * alivePlayers.length);
                minion.currentTarget = alivePlayers[randomIndex].id;
                if (minion.state === 'standby' || minion.state === undefined) {
                    minion.state = 'chase';
                }
                minion.activated = true;
            } else {
                if (minion.state === undefined) minion.state = 'standby';
                minion.activated = false;
            }
        } else {
            if (minion.state === undefined) minion.state = 'standby';
            minion.activated = false;
        }
    } else {
        if (minion.state === undefined) minion.state = 'standby';
        minion.activated = false;
    }

    return minion;
}

const CombatScaling = {
    ENEMY_HP_GROWTH_PER_ROOM,
    ENEMY_DAMAGE_GROWTH_PER_ROOM,
    BOSS_HP_GROWTH_PER_ROOM,
    BOSS_DAMAGE_GROWTH_PER_ROOM,
    ENEMY_TEMPO_GROWTH_PER_ROOM,
    ENEMY_MOBILITY_GROWTH_PER_ROOM,
    ENEMY_COUNT_CAP_ROOM,
    CAPPED_ROOM_ENEMY_COUNT,
    EARLY_RUN_COUNT_BASE,
    EARLY_RUN_COUNT_PER_ROOM,
    EARLY_RUN_XP_BONUS,
    EARLY_RUN_HP_BONUS,
    getPreBossLastRoom,
    DIFFICULTY_PRESETS,
    MULTIPLAYER_SCALING,
    ROOM_TYPE_MODIFIERS,
    ENTITY_PROFILES,
    CONFIG_FIELD_TAGS,
    BOSS_SCALING_PROFILES,
    BOSS_MODE_CONFIG,
    GEAR_BOSS_CYCLE,
    GEAR_FIRST_BOSS_ROOM,
    GEAR_BOSS_INTERVAL,
    CARD_BOSS_ROOMS,
    createContext,
    computeScalingFactors,
    computeIntelligence,
    getTelegraphScale,
    getAttackCadenceScale,
    computeEnemyCount,
    getMultiplayerScaling,
    getGameMode,
    getRunDifficulty,
    setRunDifficulty,
    resolveEnemyStats,
    applyEnemyScaling,
    getEnemyProfileIdForInstance,
    resolveBossStats,
    computeBossStats,
    applyBossScaling,
    scaleBossConfig,
    applyMinionScaling,
    scaleMinionStats,
    isGearBossRoom,
    getGearBossKey,
    getBossKeyForRoom,
    getBossEncounterIndex,
    getBossGrowthConstants
};

const BossScaling = {
    BOSS_SCALING_PROFILES,
    BOSS_MODE_CONFIG,
    GEAR_BOSS_CYCLE,
    GEAR_FIRST_BOSS_ROOM,
    GEAR_BOSS_INTERVAL,
    CARD_BOSS_ROOMS,
    getGameMode,
    isGearBossRoom,
    getGearBossKey,
    getBossKeyForRoom,
    getBossEncounterIndex,
    getBossGrowthConstants,
    computeBossStats,
    applyBossScaling
};

if (typeof window !== 'undefined') {
    window.CombatScaling = CombatScaling;
    window.BossScaling = BossScaling;
    window.getMultiplayerScaling = getMultiplayerScaling;
    window.scaleMinionStats = scaleMinionStats;
    window.ENEMY_HP_GROWTH_PER_ROOM = ENEMY_HP_GROWTH_PER_ROOM;
    window.ENEMY_DAMAGE_GROWTH_PER_ROOM = ENEMY_DAMAGE_GROWTH_PER_ROOM;
    window.BOSS_HP_GROWTH_PER_ROOM = BOSS_HP_GROWTH_PER_ROOM;
    window.BOSS_DAMAGE_GROWTH_PER_ROOM = BOSS_DAMAGE_GROWTH_PER_ROOM;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CombatScaling, BossScaling };
}
