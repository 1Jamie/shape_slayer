#!/usr/bin/env node
/**
 * Economy balance: credits (trash/elite/boss) vs class/safe-room costs,
 * and shards vs nexus meta upgrade costs.
 *
 * Usage:
 *   node tests/economy-balance-sim.js
 *   node tests/economy-balance-sim.js --end-room 50
 *   npm run balance:economy
 */

const { CombatEconomy } = require('../src/game/simulation/combat-economy.js');

function parseArgs(argv) {
    const options = {
        endRoom: 50,
        firstSafeRoom: 5,
        firstBossRoom: 10,
        playerLevelAtBoss: 8,
        help: false
    };
    for (let i = 2; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--end-room') options.endRoom = Number(argv[++i]);
        else if (arg === '--first-safe') options.firstSafeRoom = Number(argv[++i]);
        else if (arg === '--help' || arg === '-h') options.help = true;
    }
    return options;
}

// Mirrors js/combat-scaling.js enemy-count curve (solo, normal, gear mode).
const EARLY_RUN_COUNT_BASE = 8;
const EARLY_RUN_COUNT_PER_ROOM = 1.35;
const ENEMY_COUNT_CAP_ROOM = 24;
const CAPPED_ROOM_ENEMY_COUNT = 28;
const ENEMY_COUNT_POST_CAP_PER_ROOM = 0.4;
const GEAR_FIRST_BOSS_ROOM = 10;

function enemyCountForRoom(roomNumber) {
    const preBossLast = GEAR_FIRST_BOSS_ROOM - 1;
    let base;
    if (roomNumber <= preBossLast) {
        base = EARLY_RUN_COUNT_BASE + Math.floor(roomNumber * EARLY_RUN_COUNT_PER_ROOM);
    } else if (roomNumber <= ENEMY_COUNT_CAP_ROOM) {
        base = 6 + Math.floor(roomNumber * 1.05);
    } else {
        base = CAPPED_ROOM_ENEMY_COUNT + Math.floor((roomNumber - ENEMY_COUNT_CAP_ROOM) * ENEMY_COUNT_POST_CAP_PER_ROOM);
    }
    return Math.floor(base);
}

/** Nexus shard upgrades (mirrors ui/components/gearUpgradeMenu.js early tracks). */
const META_SHARD_UPGRADES = [
    { id: 'affixSlotsBasic', name: 'Basic Track', baseCost: 60, costMultiplier: 1.6, maxLevel: 5 },
    { id: 'rarityChanceGreen', name: 'Green Luck', baseCost: 60, costMultiplier: 1.6, maxLevel: 5 },
    { id: 'safeLevelUpCount', name: 'Level-Up Capacity', baseCost: 120, costMultiplier: 1.7, maxLevel: 3 }
];

const SAFE_ROOM = {
    gearLevel0: () => CombatEconomy.gearLevelUpCost(0),
    gearLevel1: () => CombatEconomy.gearLevelUpCost(1),
    reroll: () => CombatEconomy.affixRerollCost(),
    rarityGray: 150
};

function isBossRoom(roomNumber) {
    return roomNumber >= 10 && roomNumber <= 50 && (roomNumber - 10) % 10 === 0;
}

function simulateRun(endRoom) {
    let credits = 0;
    let kills = 0;
    const milestones = {};
    const perRoom = [];

    for (let room = 1; room <= endRoom; room++) {
        const roomType = isBossRoom(room) ? 'boss' : 'normal';
        let roomCredits = 0;
        let roomKills = 0;

        if (roomType === 'boss') {
            roomCredits += CombatEconomy.estimateCreditsFromMix({ boss: 1 }, room);
            // Boss rooms still spawn some adds - use half of normal count as a conservative add estimate
            const addCount = Math.max(4, Math.floor(enemyCountForRoom(room) * 0.45));
            roomCredits += CombatEconomy.estimateRoomCredits(room, addCount, 'normal');
            roomKills += 1 + addCount;
        } else {
            const enemyCount = enemyCountForRoom(room);
            roomCredits += CombatEconomy.estimateRoomCredits(room, enemyCount, 'normal');
            roomKills += enemyCount;
        }

        credits += roomCredits;
        kills += roomKills;
        perRoom.push({ room, roomCredits, roomKills, cumulativeCredits: credits, cumulativeKills: kills });

        if (room === 5 || room === 10 || room === 15 || room === 20 || room === 30 || room === endRoom) {
            milestones[room] = {
                credits,
                kills,
                shards: CombatEconomy.estimateShardsGear(room, kills, Math.max(1, Math.floor(room * 0.7)))
            };
        }
    }

    return { credits, kills, milestones, perRoom };
}

function greedyClassLevels(budget) {
    let spent = 0;
    let level = 0;
    while (true) {
        const cost = CombatEconomy.classUpgradeCost(level);
        if (spent + cost > budget) break;
        spent += cost;
        level += 1;
        if (level > 40) break;
    }
    return { levels: level, spent, remaining: budget - spent };
}

function greedyGearLevels(budget) {
    let spent = 0;
    let gearLevel = 0;
    while (true) {
        const cost = CombatEconomy.gearLevelUpCost(gearLevel);
        if (spent + cost > budget) break;
        spent += cost;
        gearLevel += 1;
        if (gearLevel > 40) break;
    }
    return { levels: gearLevel, spent, remaining: budget - spent };
}

function greedyMetaLevels(shards, upgrade) {
    let spent = 0;
    let level = 0;
    while (level < upgrade.maxLevel) {
        const cost = CombatEconomy.shardUpgradeCost(upgrade.baseCost, upgrade.costMultiplier, level);
        if (spent + cost > shards) break;
        spent += cost;
        level += 1;
    }
    return { levels: level, spent, remaining: shards - spent };
}

function evaluate(options, run) {
    const atSafe = run.perRoom.find(r => r.room === options.firstSafeRoom);
    const atBoss = run.perRoom.find(r => r.room === options.firstBossRoom);
    const safeCredits = atSafe ? atSafe.cumulativeCredits : 0;
    const bossCredits = atBoss ? atBoss.cumulativeCredits : 0;
    const bossKills = atBoss ? atBoss.cumulativeKills : 0;
    const bossShards = CombatEconomy.estimateShardsGear(
        options.firstBossRoom,
        bossKills,
        options.playerLevelAtBoss
    );

    const classAtSafe = greedyClassLevels(safeCredits);
    const gearAtSafe = greedyGearLevels(safeCredits);
    const classAtBoss = greedyClassLevels(bossCredits);
    const splitAtSafe = (() => {
        // Prefer 1 class + remainder toward gear
        const classCost = CombatEconomy.classUpgradeCost(0);
        if (safeCredits < classCost) return { classLevels: 0, gearLevels: greedyGearLevels(safeCredits).levels };
        const rem = safeCredits - classCost;
        return { classLevels: 1, gearLevels: greedyGearLevels(rem).levels };
    })();

    const checks = [
        {
            id: 'safe_room_class_L0',
            ok: safeCredits >= CombatEconomy.classUpgradeCost(0),
            detail: `credits@R${options.firstSafeRoom}=${safeCredits} vs class L0=${CombatEconomy.classUpgradeCost(0)}`
        },
        {
            id: 'safe_room_gear_L0',
            ok: safeCredits >= SAFE_ROOM.gearLevel0(),
            detail: `credits@R${options.firstSafeRoom}=${safeCredits} vs gear L0=${SAFE_ROOM.gearLevel0()}`
        },
        {
            id: 'safe_room_meaningful_choice',
            ok: safeCredits >= CombatEconomy.classUpgradeCost(0) + Math.floor(SAFE_ROOM.gearLevel0() * 0.4),
            detail: `credits@R${options.firstSafeRoom}=${safeCredits} should fund class L0 + ~40% toward gear`
        },
        {
            id: 'boss10_two_class_levels',
            ok: classAtBoss.levels >= 2,
            detail: `credits@R${options.firstBossRoom}=${bossCredits} → ${classAtBoss.levels} class levels`
        },
        {
            id: 'boss10_shards_first_meta',
            ok: bossShards >= META_SHARD_UPGRADES[0].baseCost,
            detail: `shards@R${options.firstBossRoom}=${bossShards} vs meta L0=${META_SHARD_UPGRADES[0].baseCost}`
        },
        {
            id: 'late_credit_not_exploding',
            ok: (() => {
                const r10 = run.perRoom.find(r => r.room === 10);
                const r30 = run.perRoom.find(r => r.room === Math.min(30, options.endRoom));
                if (!r10 || !r30 || r10.roomCredits <= 0) return true;
                const ratio = r30.roomCredits / r10.roomCredits;
                return ratio <= 4.5;
            })(),
            detail: (() => {
                const r10 = run.perRoom.find(r => r.room === 10);
                const r30 = run.perRoom.find(r => r.room === Math.min(30, options.endRoom));
                if (!r10 || !r30) return 'n/a';
                return `R10 roomCredits=${r10.roomCredits}, R${r30.room} roomCredits=${r30.roomCredits}, ratio=${(r30.roomCredits / r10.roomCredits).toFixed(2)}`
            })()
        }
    ];

    return {
        safeCredits,
        bossCredits,
        bossShards,
        classAtSafe,
        gearAtSafe,
        splitAtSafe,
        classAtBoss,
        checks,
        passed: checks.every(c => c.ok)
    };
}

function main() {
    const options = parseArgs(process.argv);
    if (options.help) {
        console.log('Usage: node tests/economy-balance-sim.js [--end-room N] [--first-safe N]');
        process.exit(0);
    }

    const run = simulateRun(options.endRoom);
    const evalResult = evaluate(options, run);

    console.log('\n=== CombatEconomy credit tiers ===');
    console.log(JSON.stringify(CombatEconomy.CREDIT_BASE, null, 2));
    console.log(`Boss base: ${CombatEconomy.BOSS_CREDIT_BASE} (+${CombatEconomy.BOSS_DECADE_BONUS}/decade)`);
    console.log(`Trash decade bonus: +${CombatEconomy.TRASH_DECADE_BONUS}/decade`);

    console.log('\n=== Cost reference ===');
    console.log(`Class L0–L4: ${[0, 1, 2, 3, 4].map(l => CombatEconomy.classUpgradeCost(l)).join(', ')}`);
    console.log(`Gear level-up L0–L3: ${[0, 1, 2, 3].map(l => CombatEconomy.gearLevelUpCost(l)).join(', ')}`);
    console.log(`Affix reroll: ${SAFE_ROOM.reroll()}, Rarity gray→green: ${SAFE_ROOM.rarityGray}`);
    META_SHARD_UPGRADES.forEach(u => {
        console.log(`Meta ${u.name} L0–L2: ${[0, 1, 2].map(l => CombatEconomy.shardUpgradeCost(u.baseCost, u.costMultiplier, l)).join(', ')}`);
    });

    console.log('\n=== Expected room credits (cumulative) ===');
    for (const row of run.perRoom) {
        if (row.room <= 12 || row.room % 10 === 0 || row.room % 5 === 0) {
            const bossTag = isBossRoom(row.room) ? ' [BOSS]' : '';
            console.log(
                `R${String(row.room).padStart(2)}  +${String(row.roomCredits).padStart(4)}  ` +
                `cum=${String(row.cumulativeCredits).padStart(5)}  kills=${row.cumulativeKills}${bossTag}`
            );
        }
    }

    console.log('\n=== Progression affordability ===');
    console.log(`First safe (R${options.firstSafeRoom}): ${evalResult.safeCredits} credits`);
    console.log(`  → class-only: ${evalResult.classAtSafe.levels} levels (spent ${evalResult.classAtSafe.spent})`);
    console.log(`  → gear-only: ${evalResult.gearAtSafe.levels} levels`);
    console.log(`  → split (1 class + gear): class ${evalResult.splitAtSafe.classLevels}, gear ${evalResult.splitAtSafe.gearLevels}`);
    console.log(`First boss (R${options.firstBossRoom}): ${evalResult.bossCredits} credits, ~${evalResult.bossShards} shards`);
    console.log(`  → class-only: ${evalResult.classAtBoss.levels} levels`);
    META_SHARD_UPGRADES.forEach(u => {
        const g = greedyMetaLevels(evalResult.bossShards, u);
        console.log(`  → meta ${u.name}: ${g.levels} levels (spent ${g.spent})`);
    });

    console.log('\n=== Gate checks ===');
    for (const check of evalResult.checks) {
        console.log(`${check.ok ? 'PASS' : 'FAIL'}  ${check.id}: ${check.detail}`);
    }

    if (!evalResult.passed) {
        console.error('\nEconomy balance checks FAILED - retune CombatEconomy or costs.');
        process.exit(1);
    }
    console.log('\nAll economy balance checks passed.');
}

main();
