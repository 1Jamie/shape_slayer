/**
 * Loads live game balance data from js/ sources for Node-based simulations.
 * Scripts are evaluated in a vm context; symbols are exported via globalThis.
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '../..');

const SCRIPT_EXPORTS = {
    'src/js/gear.js': [
        'getGearScaling',
        'calculateTierProbabilities',
        'generateGear',
        'FLAT_STAT_RANGES',
        'WEAPON_TYPES',
        'ARMOR_TYPES',
        'ENEMY_DIFFICULTY',
        'TIER_BONUSES',
        'GEAR_TIERS',
        'rollBossTrophyTier'
    ],
    'src/js/enemies/telegraph/telegraph-manager.js': ['TelegraphSystem'],
    'src/js/enemies/enemy-base.js': ['EnemyBase'],
    'src/js/enemies/enemy-basic.js': ['Enemy', 'BASIC_ENEMY_CONFIG'],
    'src/js/enemies/enemy-star.js': ['StarEnemy', 'STAR_CONFIG'],
    'src/js/enemies/enemy-diamond.js': ['DiamondEnemy', 'DIAMOND_CONFIG'],
    'src/js/enemies/enemy-octagon.js': ['OctagonEnemy', 'OCTAGON_CONFIG'],
    'src/js/enemies/enemy-rectangle.js': ['RectangleEnemy', 'RECTANGLE_CONFIG'],
    'src/js/bosses/boss-base.js': ['BossBase'],
    'src/js/bosses/boss-swarmking.js': ['BossSwarmKing'],
    'src/js/bosses/boss-twinprism.js': ['BossTwinPrism'],
    'src/js/bosses/boss-fortress.js': ['BossFortress'],
    'src/js/bosses/boss-fractalcore.js': ['BossFractalCore'],
    'src/js/bosses/boss-vortex.js': ['BossVortex'],
    'src/js/combat-scaling.js': ['CombatScaling', 'BossScaling'],
    'src/js/bosses/boss-scaling.js': ['BossScaling'],
    'src/js/players/player-warrior.js': ['WARRIOR_CONFIG'],
    'src/js/items/item-definitions.js': ['ITEM_DEFINITIONS', 'getRandomItem', 'logarithmicScale', 'ITEM_RARITY_WEIGHTS', 'BOSS_ITEM_RARITY_WEIGHTS'],
    'src/js/items/item-manager.js': ['ItemManager']
};

/** Maps sim enemy type keys to constructor.name used in enemy-base item drop table. */
const ENEMY_DROP_CLASS_NAMES = {
    basic: 'Enemy',
    star: 'StarEnemy',
    diamond: 'DiamondEnemy',
    rectangle: 'RectangleEnemy',
    octagon: 'OctagonEnemy'
};

/** @deprecated Use BossScaling from boss-scaling.js - kept for test imports. */
const GEAR_BOSS_CYCLE = ['swarmKing', 'twinPrism', 'fortress', 'fractalCore', 'vortex'];
const GEAR_FIRST_BOSS_ROOM = 10;
const GEAR_BOSS_ROOM_INTERVAL = 10;
const CARD_BOSS_ROOMS = { 12: 'swarmKing', 22: 'fortress', 32: 'vortex' };
const BOSS_DISPLAY_NAMES = {
    swarmKing: 'Swarm King',
    twinPrism: 'Twin Prism',
    fortress: 'Fortress',
    fractalCore: 'Fractal Core',
    vortex: 'Vortex'
};

function isGearBossRoom(roomNumber) {
    return roomNumber >= GEAR_FIRST_BOSS_ROOM &&
        roomNumber <= 50 &&
        (roomNumber - GEAR_FIRST_BOSS_ROOM) % GEAR_BOSS_ROOM_INTERVAL === 0;
}

function getGearBossKey(roomNumber) {
    const index = Math.floor((roomNumber - GEAR_FIRST_BOSS_ROOM) / GEAR_BOSS_ROOM_INTERVAL) % GEAR_BOSS_CYCLE.length;
    return GEAR_BOSS_CYCLE[index];
}

function getBossKeyForRoom(gameMode, roomNumber) {
    if (gameMode === 'gear') {
        return isGearBossRoom(roomNumber) ? getGearBossKey(roomNumber) : null;
    }
    return CARD_BOSS_ROOMS[roomNumber] || null;
}

function parseEnemyItemDropChances(enemyBaseSource) {
    const match = enemyBaseSource.match(/const dropChances = (\{[\s\S]*?\n\s*\});/);
    if (!match) {
        throw new Error('Could not parse item dropChances from enemy-base.js');
    }
    return Function(`"use strict"; return (${match[1]});`)();
}

/**
 * Mirrors enemy-base.js on-death item drop chance (room cap, diminishing returns, enemy count).
 */
function computeItemDropChance(dropChances, enemyClassName, roomNumber, itemsDroppedThisRoom, initialEnemyCount) {
    let baseDropChance = dropChances[enemyClassName] || 0.040;

    const roomScale = Math.max(0.4, 1.0 - (roomNumber - 1) * 0.012);

    let itemCountScale = 1.0;
    if (itemsDroppedThisRoom >= 2) {
        const excessItems = itemsDroppedThisRoom - 1;
        itemCountScale = Math.max(0.1, 1.0 / (1.0 + excessItems * 0.5));
    }

    let enemyCountScale = 1.0;
    if (initialEnemyCount >= 30) {
        const excessEnemies = initialEnemyCount - 30;
        enemyCountScale = Math.max(0.6, 1.0 - (excessEnemies / 30) * 0.4);
    }

    return baseDropChance * roomScale * itemCountScale * enemyCountScale;
}

function readGameConstant(source, constName) {
    const match = source.match(new RegExp(`const ${constName}\\s*=\\s*([\\d.]+)`));
    if (!match) {
        throw new Error(`Could not read const ${constName} from game source`);
    }
    return Number(match[1]);
}

function readGameFunction(source, functionName) {
    const match = source.match(new RegExp(`function ${functionName}\\(\\)[\\s\\S]*?^}`, 'm'));
    if (!match) {
        throw new Error(`Could not read function ${functionName} from game source`);
    }
    return match[0];
}

function loadGameScript(ctx, relativePath) {
    const absolutePath = path.join(ROOT, relativePath);
    const source = fs.readFileSync(absolutePath, 'utf8');
    const exportNames = SCRIPT_EXPORTS[relativePath] || [];
    const exportLines = exportNames
        .map(name => `if (typeof ${name} !== 'undefined') globalThis.${name} = ${name};`)
        .join('\n');
    vm.runInContext(`${source}\n${exportLines}`, ctx, absolutePath);
}

function createVmContext(options = {}) {
    const ctx = {
        console,
        Math,
        Date,
        setTimeout,
        clearTimeout,
        performance: { now: () => Date.now() },
        createParticleBurst: () => {},
        AudioManager: { sounds: { bossSpawn: () => {} } },
        document: {
            createElement: () => ({
                getContext: () => ({
                    createRadialGradient: () => ({
                        addColorStop: () => {}
                    }),
                    beginPath: () => {},
                    arc: () => {},
                    fill: () => {}
                }),
                width: 0,
                height: 0
            })
        },
        Game: {
            gameMode: options.gameMode || 'gear',
            roomNumber: options.roomNumber || 1,
            difficulty: options.difficulty || 'normal',
            multiplayerEnabled: options.playerCount > 1 || options.multiplayerEnabled === true,
            isMultiplayerClient: () => false,
            player: { playerClass: options.playerClass || 'square' },
            encounteredBosses: {}
        },
        SaveSystem: {
            getUpgrades: () => ({
                damage: 0,
                defense: 0,
                speed: 0,
                cooldown: 0,
                health: 0,
                attackSpeed: 0
            })
        },
        multiplayerManager: options.multiplayerManager || null
    };
    ctx.window = ctx;
    ctx.globalThis = ctx;
    vm.createContext(ctx);
    return ctx;
}

function loadLevelModule(ctx) {
    const levelSource = fs.readFileSync(path.join(ROOT, 'src/js/level.js'), 'utf8');
    const cs = ctx.CombatScaling;
    if (!cs) {
        throw new Error('CombatScaling must be loaded before loadLevelModule');
    }

    const constants = {
        ENEMY_HP_GROWTH_PER_ROOM: cs.ENEMY_HP_GROWTH_PER_ROOM,
        ENEMY_DAMAGE_GROWTH_PER_ROOM: cs.ENEMY_DAMAGE_GROWTH_PER_ROOM,
        BOSS_HP_GROWTH_PER_ROOM: cs.BOSS_HP_GROWTH_PER_ROOM,
        BOSS_DAMAGE_GROWTH_PER_ROOM: cs.BOSS_DAMAGE_GROWTH_PER_ROOM,
        ENEMY_COUNT_CAP_ROOM: cs.ENEMY_COUNT_CAP_ROOM,
        CAPPED_ROOM_ENEMY_COUNT: cs.CAPPED_ROOM_ENEMY_COUNT,
        ENEMY_COUNT_POST_CAP_PER_ROOM: cs.ENEMY_COUNT_POST_CAP_PER_ROOM
    };

    ctx.getMultiplayerScaling = cs.getMultiplayerScaling.bind(cs);

    return { levelSource, constants, getMultiplayerScaling: ctx.getMultiplayerScaling, CombatScaling: cs };
}

function loadPlayerProgressionConstants() {
    const playerBaseSource = fs.readFileSync(path.join(ROOT, 'src/js/players/player-base.js'), 'utf8');
    const xpBonusMatch = playerBaseSource.match(/const bonusXP = amount \* ([\d.]+)/);
    const levelDamageMatch = playerBaseSource.match(/this\.baseDamageBase = \(this\.baseDamageBase \|\| this\.baseDamage\) \* ([\d.]+)/);
    const levelHpMatch = playerBaseSource.match(/this\.baseMaxHpBase = \(this\.baseMaxHpBase \|\| this\.baseMaxHp\) \* ([\d.]+)/);
    const attackCooldownMatch = playerBaseSource.match(/this\.attackCooldownTime = ([\d.]+)/);

    if (!xpBonusMatch || !levelDamageMatch || !levelHpMatch || !attackCooldownMatch) {
        throw new Error('Could not parse player progression constants from player-base.js');
    }

    return {
        XP_BONUS_MULTIPLIER: Number(xpBonusMatch[1]),
        LEVEL_DAMAGE_MULTIPLIER: Number(levelDamageMatch[1]),
        LEVEL_HP_MULTIPLIER: Number(levelHpMatch[1]),
        ATTACK_COOLDOWN_SECONDS: Number(attackCooldownMatch[1]),
        xpToNext(level) {
            return Math.floor(100 * Math.pow(level, 1.5));
        }
    };
}

/**
 * Enemy type picker copied from js/level.js generateRoom spawn logic (normal rooms).
 */
function pickEnemyTypeKey(roomNumber, roomType, rand, constants) {
    const isEliteOrChallenge = roomType === 'elite' || roomType === 'challenge' || roomType === 'bonus_slot';
    const effectiveRoomNumber = isEliteOrChallenge ? Math.max(9, roomNumber) : roomNumber;

    if (effectiveRoomNumber < 3) return 'basic';
    if (effectiveRoomNumber < 5) return rand < 0.6 ? 'basic' : 'star';
    if (effectiveRoomNumber < 7) {
        if (rand < 0.35) return 'basic';
        if (rand < 0.7) return 'star';
        return 'diamond';
    }
    if (effectiveRoomNumber < 9) {
        if (rand < 0.25) return 'basic';
        if (rand < 0.5) return 'star';
        if (rand < 0.75) return 'diamond';
        return 'rectangle';
    }

    let octagonChance = 0.05;
    if (roomType === 'elite') octagonChance = 0.25;
    else if (roomType === 'challenge') octagonChance = 0.35;
    else if (roomType === 'bonus_slot') octagonChance = 0.45;

    if (rand < octagonChance) return 'octagon';
    if (rand < octagonChance + 0.25) return 'basic';
    if (rand < octagonChance + 0.5) return 'star';
    if (rand < octagonChance + 0.75) return 'diamond';
    return 'rectangle';
}

function enemyCountForRoom(roomNumber, constants, combatScaling, options = {}) {
    if (combatScaling) {
        const ctx = combatScaling.createContext({
            roomNumber,
            gameMode: options.gameMode || 'gear',
            roomType: options.roomType || 'normal',
            difficulty: options.difficulty || 'normal',
            playerCount: options.playerCount || 1
        });
        return combatScaling.computeEnemyCount(roomNumber, options.roomType || 'normal', ctx);
    }
    if (roomNumber <= constants.ENEMY_COUNT_CAP_ROOM) {
        return 6 + Math.floor(roomNumber * 1.05);
    }
    const postCap = constants.ENEMY_COUNT_POST_CAP_PER_ROOM != null
        ? constants.ENEMY_COUNT_POST_CAP_PER_ROOM
        : 0.4;
    const cappedBase = constants.CAPPED_ROOM_ENEMY_COUNT != null
        ? constants.CAPPED_ROOM_ENEMY_COUNT
        : 28;
    return cappedBase + Math.floor((roomNumber - constants.ENEMY_COUNT_CAP_ROOM) * postCap);
}

function createBalanceRuntime(options = {}) {
    const ctx = createVmContext(options);

    loadGameScript(ctx, 'src/js/enemies/telegraph/telegraph-manager.js');
    loadGameScript(ctx, 'src/js/enemies/enemy-base.js');
    loadGameScript(ctx, 'src/js/enemies/enemy-basic.js');
    loadGameScript(ctx, 'src/js/enemies/enemy-star.js');
    loadGameScript(ctx, 'src/js/enemies/enemy-diamond.js');
    loadGameScript(ctx, 'src/js/enemies/enemy-rectangle.js');
    loadGameScript(ctx, 'src/js/enemies/enemy-octagon.js');
    loadGameScript(ctx, 'src/js/bosses/boss-base.js');
    loadGameScript(ctx, 'src/js/bosses/boss-swarmking.js');
    loadGameScript(ctx, 'src/js/bosses/boss-twinprism.js');
    loadGameScript(ctx, 'src/js/bosses/boss-fortress.js');
    loadGameScript(ctx, 'src/js/bosses/boss-fractalcore.js');
    loadGameScript(ctx, 'src/js/bosses/boss-vortex.js');
    vm.runInContext(
        `globalThis.BOSS_HP_GROWTH_PER_ROOM = ${readGameConstant(fs.readFileSync(path.join(ROOT, 'src/js/combat-scaling.js'), 'utf8'), 'BOSS_HP_GROWTH_PER_ROOM')};
         globalThis.BOSS_DAMAGE_GROWTH_PER_ROOM = ${readGameConstant(fs.readFileSync(path.join(ROOT, 'src/js/combat-scaling.js'), 'utf8'), 'BOSS_DAMAGE_GROWTH_PER_ROOM')};`,
        ctx
    );
    loadGameScript(ctx, 'src/js/combat-scaling.js');
    loadGameScript(ctx, 'src/js/bosses/boss-scaling.js');
    loadGameScript(ctx, 'src/js/gear.js');
    loadGameScript(ctx, 'src/js/items/item-definitions.js');
    loadGameScript(ctx, 'src/js/items/item-manager.js');
    vm.runInContext('class PlayerBase { constructor() {} }', ctx);
    loadGameScript(ctx, 'src/js/players/player-warrior.js');

    const enemyBaseSource = fs.readFileSync(path.join(ROOT, 'src/js/enemies/enemy-base.js'), 'utf8');
    const itemDropChances = parseEnemyItemDropChances(enemyBaseSource);

    const level = loadLevelModule(ctx);
    const playerProgression = loadPlayerProgressionConstants();

    const enemyConfigs = {
        basic: { ...ctx.BASIC_ENEMY_CONFIG, gearDifficulty: 'basic' },
        star: { ...ctx.STAR_CONFIG, gearDifficulty: 'star' },
        diamond: { ...ctx.DIAMOND_CONFIG, gearDifficulty: 'diamond' },
        rectangle: { ...ctx.RECTANGLE_CONFIG, gearDifficulty: 'basic' },
        octagon: { ...ctx.OCTAGON_CONFIG, gearDifficulty: 'elite' }
    };

    const enemyGearDifficulty = {
        basic: 'basic',
        star: 'star',
        diamond: 'diamond',
        rectangle: 'basic',
        octagon: 'elite'
    };

    function scaleEnemyStats(config, roomNumber, scalingOptions = {}) {
        const profileMap = {
            basic: 'enemy_basic',
            star: 'enemy_star',
            diamond: 'enemy_diamond',
            rectangle: 'enemy_rectangle',
            octagon: 'enemy_octagon'
        };
        const profileId = scalingOptions.profileId ||
            profileMap[scalingOptions.typeKey] || 'enemy_basic';
        const scalingCtx = level.CombatScaling.createContext({
            roomNumber,
            gameMode: scalingOptions.gameMode || ctx.Game.gameMode || 'gear',
            roomType: scalingOptions.roomType || 'normal',
            difficulty: scalingOptions.difficulty || ctx.Game.difficulty || 'normal',
            playerCount: scalingOptions.playerCount || 1
        });
        const stats = level.CombatScaling.resolveEnemyStats(profileId, config, scalingCtx);
        return {
            maxHp: stats.maxHp,
            damage: stats.damage,
            xpValue: stats.xpValue,
            lootChance: config.lootChance
        };
    }

    function computeScalingFactorsForRoom(roomNumber, scalingOptions = {}) {
        const scalingCtx = level.CombatScaling.createContext({
            roomNumber,
            gameMode: scalingOptions.gameMode || ctx.Game.gameMode || 'gear',
            roomType: scalingOptions.roomType || 'normal',
            difficulty: scalingOptions.difficulty || ctx.Game.difficulty || 'normal',
            playerCount: scalingOptions.playerCount || 1
        });
        return level.CombatScaling.computeScalingFactors(scalingCtx);
    }

    const BOSS_CONSTRUCTORS = {
        swarmKing: () => new ctx.BossSwarmKing(1200, 675),
        twinPrism: () => new ctx.BossTwinPrism(1200, 675),
        fortress: () => new ctx.BossFortress(1200, 675),
        fractalCore: () => new ctx.BossFractalCore(1200, 675),
        vortex: () => new ctx.BossVortex(1200, 675)
    };

    function createUnscaledBoss(bossKey = 'swarmKing') {
        const factory = BOSS_CONSTRUCTORS[bossKey];
        if (!factory) {
            throw new Error(`Boss "${bossKey}" is not wired in balance-runtime yet`);
        }
        return factory();
    }

    function applyBossRoomScaling(boss, roomNumber, playerCount = 1, scalingOptions = {}) {
        ctx.Game.multiplayerEnabled = playerCount > 1;
        ctx.Game.gameMode = scalingOptions.gameMode || ctx.Game.gameMode || 'gear';
        ctx.Game.difficulty = scalingOptions.difficulty || ctx.Game.difficulty || 'normal';
        ctx.multiplayerManager = playerCount > 1
            ? { players: Array.from({ length: playerCount }, (_, index) => ({ id: `p${index}` })) }
            : null;
        const mpScaling = ctx.getMultiplayerScaling();

        return ctx.BossScaling.applyBossScaling(boss, roomNumber, {
            gameMode: ctx.Game.gameMode,
            mpScaling,
            difficulty: ctx.Game.difficulty,
            growth: {
                hpGrowth: level.constants.BOSS_HP_GROWTH_PER_ROOM,
                damageGrowth: level.constants.BOSS_DAMAGE_GROWTH_PER_ROOM
            },
            isEliteSpawn: scalingOptions.isEliteSpawn === true
        });
    }

    function computeBossStats(bossKey, roomNumber, scalingOptions = {}) {
        return ctx.BossScaling.computeBossStats(bossKey, roomNumber, {
            gameMode: scalingOptions.gameMode || ctx.Game.gameMode || 'gear',
            growth: {
                hpGrowth: level.constants.BOSS_HP_GROWTH_PER_ROOM,
                damageGrowth: level.constants.BOSS_DAMAGE_GROWTH_PER_ROOM
            },
            isEliteSpawn: scalingOptions.isEliteSpawn === true
        });
    }

    function getBossKeyForRoomFromScaling(roomNumber) {
        return ctx.BossScaling.getBossKeyForRoom(ctx.Game.gameMode || 'gear', roomNumber);
    }

    function rollTier(roomNumber, enemyDifficulty, rng) {
        const probabilities = ctx.calculateTierProbabilities(roomNumber, enemyDifficulty);
        const tiers = ['gray', 'green', 'blue', 'purple', 'orange'];
        const roll = rng();
        let cumulative = 0;
        let tier = tiers[tiers.length - 1];
        for (const name of tiers) {
            cumulative += probabilities[name] || 0;
            if (roll < cumulative) {
                tier = name;
                break;
            }
        }
        // Mirror generateGear boss floor (never trash)
        if (enemyDifficulty === 'boss') {
            const minIdx = tiers.indexOf('blue');
            if (tiers.indexOf(tier) < minIdx) tier = 'blue';
        }
        return tier;
    }

    function rollGear(roomNumber, enemyDifficulty, rng) {
        const originalRandom = Math.random;
        Math.random = rng;
        try {
            ctx.Game.roomNumber = roomNumber;
            return ctx.generateGear(0, 0, roomNumber, enemyDifficulty);
        } finally {
            Math.random = originalRandom;
        }
    }

    /** Forced-tier gear (boss trophy purple/orange). */
    function rollForcedTierGear(tier, rng) {
        const originalRandom = Math.random;
        Math.random = rng;
        try {
            return ctx.generateGear(0, 0, tier);
        } finally {
            Math.random = originalRandom;
        }
    }

    function rollRandomItem(rng, rarityWeights = null) {
        const originalRandom = Math.random;
        Math.random = rng;
        try {
            return ctx.getRandomItem(rarityWeights);
        } finally {
            Math.random = originalRandom;
        }
    }

    function getItemDropChance(typeKey, roomNumber, itemsDroppedThisRoom, initialEnemyCount) {
        const className = ENEMY_DROP_CLASS_NAMES[typeKey] || 'Enemy';
        return computeItemDropChance(
            itemDropChances,
            className,
            roomNumber,
            itemsDroppedThisRoom,
            initialEnemyCount
        );
    }

    /** Boss extras after the trophy piece (2 or 3), mirrors boss-base.js die(). */
    function rollBossGearDropCount(rng) {
        return 2 + Math.floor(rng() * 2);
    }

    /** Boss trophy tier scales with room (mirrors gear.js rollBossTrophyTier). */
    function rollBossTrophyTier(roomNumber, rng) {
        if (typeof ctx.rollBossTrophyTier === 'function') {
            return ctx.rollBossTrophyTier(roomNumber, rng);
        }
        return rng() < 0.18 ? 'purple' : 'blue';
    }

    /** Boss item drop chance is a flat 75%, exempt from room/count scaling (boss-base.js). */
    function rollBossItemDrop(rng) {
        return rng() < 0.75;
    }

    return {
        root: ROOT,
        ctx,
        level,
        playerProgression,
        enemyConfigs,
        enemyGearDifficulty,
        pickEnemyTypeKey,
        enemyCountForRoom: (roomNumber, scalingOptions = {}) =>
            enemyCountForRoom(roomNumber, level.constants, level.CombatScaling, scalingOptions),
        scaleEnemyStats,
        createUnscaledBoss,
        applyBossRoomScaling,
        computeBossStats,
        BossScaling: ctx.BossScaling,
        CombatScaling: level.CombatScaling,
        computeScalingFactorsForRoom,
        rollTier,
        rollGear,
        rollForcedTierGear,
        rollRandomItem,
        getItemDropChance,
        rollBossGearDropCount,
        rollBossTrophyTier,
        rollBossItemDrop,
        getBossKeyForRoom: roomNumber => getBossKeyForRoomFromScaling(roomNumber),
        bossDisplayName: bossKey => BOSS_DISPLAY_NAMES[bossKey] || bossKey,
        itemDropChances,
        ITEM_DEFINITIONS: ctx.ITEM_DEFINITIONS,
        BOSS_ITEM_RARITY_WEIGHTS: ctx.BOSS_ITEM_RARITY_WEIGHTS,
        ItemManager: ctx.ItemManager,
        getGearScaling: ctx.getGearScaling,
        calculateTierProbabilities: ctx.calculateTierProbabilities,
        FLAT_STAT_RANGES: ctx.FLAT_STAT_RANGES,
        WEAPON_TYPES: ctx.WEAPON_TYPES,
        WARRIOR_CONFIG: ctx.WARRIOR_CONFIG,
        BossSwarmKing: ctx.BossSwarmKing,
        BossTwinPrism: ctx.BossTwinPrism,
        BossFortress: ctx.BossFortress,
        BossFractalCore: ctx.BossFractalCore,
        BossVortex: ctx.BossVortex
    };
}

function createEmptyItemStatFields() {
    return {
        itemDamageBonus: 0,
        itemCritChance: 0,
        itemCritDamage: 0,
        itemAttackSpeedBonus: 0,
        itemDamageAuraRadius: 0,
        itemDamageAuraPercent: 0,
        itemVolatileChance: 0,
        itemVolatileDamagePercent: 0,
        itemVolatileRadius: 0,
        itemBleedDamagePercent: 0,
        itemBleedDuration: 0,
        itemBleedMaxStacks: 0,
        itemExecuteDamagePercent: 0,
        itemExecuteThreshold: 0,
        critChance: 0,
        critDamageMultiplier: 1.0,
        attackSpeedMultiplier: 1.0,
        damageMultiplier: 1.0,
        damage: 0
    };
}

/**
 * Subset of player-base updateEffectiveStats for sim DPS (gear + level + items).
 */
function syncSimPlayerCombatStats(player) {
    player.critChance = 0;
    player.critDamageMultiplier = 1.0;
    player.attackSpeedMultiplier = 1.0;

    if (player.itemCritChance) {
        player.critChance = (player.critChance || 0) + player.itemCritChance;
    }
    if (player.itemCritDamage) {
        player.critDamageMultiplier += player.itemCritDamage;
    }
    if (player.itemAttackSpeedBonus) {
        player.attackSpeedMultiplier += player.itemAttackSpeedBonus;
    }

    const weaponFlat = player.loadout?.weapon?.stats?.damage || 0;
    const baseDamageWithMultiplier = player.baseDamage * (player.damageMultiplier || 1);
    const baseDamage = baseDamageWithMultiplier + weaponFlat;
    player.damage = baseDamage * (1 + (player.itemDamageBonus || 0));
}

function createSimPlayer(runtime, loadout = null) {
    const player = {
        level: 1,
        xp: 0,
        baseDamage: runtime.WARRIOR_CONFIG.baseDamage,
        baseMaxHp: runtime.WARRIOR_CONFIG.baseHp,
        loadout: loadout || { weapon: null, armor: null, accessory: null },
        gearDrops: 0,
        itemDrops: 0,
        ...createEmptyItemStatFields(),
        updateEffectiveStats() {
            syncSimPlayerCombatStats(this);
        }
    };
    player.itemManager = new runtime.ItemManager(player);
    syncSimPlayerCombatStats(player);
    return player;
}

module.exports = {
    ROOT,
    createBalanceRuntime,
    pickEnemyTypeKey,
    enemyCountForRoom,
    loadPlayerProgressionConstants,
    readGameConstant,
    ENEMY_DROP_CLASS_NAMES,
    computeItemDropChance,
    createSimPlayer,
    syncSimPlayerCombatStats,
    createEmptyItemStatFields,
    GEAR_BOSS_CYCLE,
    GEAR_FIRST_BOSS_ROOM,
    GEAR_BOSS_ROOM_INTERVAL,
    CARD_BOSS_ROOMS,
    BOSS_DISPLAY_NAMES,
    isGearBossRoom,
    getGearBossKey,
    getBossKeyForRoom
};
