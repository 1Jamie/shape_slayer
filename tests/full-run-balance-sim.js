#!/usr/bin/env node
/**
 * Full-run GEAR mode balance synthesis - simulates an entire run (room 1 through
 * the last requested boss room) with continuous player progression (XP, gear,
 * items) carried across every boss encounter, not just a single snapshot.
 *
 * All formulas/constants are sourced live from js/ (see tests/lib/balance-runtime.js).
 *
 * Usage:
 *   node tests/full-run-balance-sim.js
 *   node tests/full-run-balance-sim.js --runs 200 --end-room 30 --players 1
 *   node tests/full-run-balance-sim.js --target-seconds 75 --weakpoint-rate 0.35
 */

const { createBalanceRuntime, createSimPlayer, syncSimPlayerCombatStats } = require('./lib/balance-runtime');

function parseArgs(argv) {
    const options = {
        runs: 150,
        gameMode: 'gear',
        endRoom: 50,
        players: 1,
        difficulty: 'normal',
        targetSeconds: 75,
        targetSecondsGrowthPerBoss: 0,
        weakpointRate: 0.3,
        cleaveHits: 2.5,
        seed: 20260702
    };

    for (let i = 2; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--runs') options.runs = Number(argv[++i]);
        else if (arg === '--game-mode') options.gameMode = argv[++i];
        else if (arg === '--end-room') options.endRoom = Number(argv[++i]);
        else if (arg === '--players') options.players = Number(argv[++i]);
        else if (arg === '--difficulty') options.difficulty = argv[++i];
        else if (arg === '--target-seconds') options.targetSeconds = Number(argv[++i]);
        else if (arg === '--target-seconds-growth') options.targetSecondsGrowthPerBoss = Number(argv[++i]);
        else if (arg === '--weakpoint-rate') options.weakpointRate = Number(argv[++i]);
        else if (arg === '--cleave-hits') options.cleaveHits = Number(argv[++i]);
        else if (arg === '--seed') options.seed = Number(argv[++i]);
        else if (arg === '--help' || arg === '-h') options.help = true;
    }
    return options;
}

function mulberry32(seed) {
    let t = seed >>> 0;
    return function rng() {
        t += 0x6D2B79F5;
        let r = Math.imul(t ^ (t >>> 15), 1 | t);
        r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
}

function percentile(sorted, p) {
    if (!sorted.length) return 0;
    const index = (sorted.length - 1) * p;
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    if (lower === upper) return sorted[lower];
    const weight = index - lower;
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function summarize(values) {
    const sorted = values.slice().sort((a, b) => a - b);
    const total = sorted.reduce((sum, value) => sum + value, 0);
    return {
        min: sorted[0],
        p25: percentile(sorted, 0.25),
        median: percentile(sorted, 0.5),
        p75: percentile(sorted, 0.75),
        max: sorted[sorted.length - 1],
        mean: total / sorted.length
    };
}

function isBetterGear(slot, current, candidate) {
    if (!candidate) return false;
    if (!current) return true;
    if (slot === 'weapon') return (candidate.stats.damage || 0) > (current.stats.damage || 0);
    if (slot === 'armor') return (candidate.stats.defense || 0) > (current.stats.defense || 0);
    if (slot === 'accessory') return (candidate.stats.speed || 0) > (current.stats.speed || 0);
    return false;
}

function equipIfBetter(loadout, gear) {
    if (!gear) return;
    if (isBetterGear(gear.slot, loadout[gear.slot], gear)) {
        loadout[gear.slot] = gear;
    }
}

function applyXp(player, rawXp, progression) {
    const gained = rawXp * progression.XP_BONUS_MULTIPLIER;
    player.xp += gained;
    while (player.xp >= progression.xpToNext(player.level)) {
        player.xp -= progression.xpToNext(player.level);
        player.level += 1;
        player.baseDamage *= progression.LEVEL_DAMAGE_MULTIPLIER;
        player.baseMaxHp *= progression.LEVEL_HP_MULTIPLIER;
    }
}

function estimateWarriorDps(player, runtime, options, bossHp) {
    syncSimPlayerCombatStats(player);

    const cfg = runtime.WARRIOR_CONFIG;
    const cleaveDamage = player.damage * cfg.cleaveDamage;

    const weapon = player.loadout.weapon;
    const weaponType = weapon?.weaponType;
    const weaponDef = weaponType ? runtime.WEAPON_TYPES[weaponType] : null;
    const weaponCooldownMult = weaponDef && Number.isFinite(weaponDef.cooldownMultiplier)
        ? weaponDef.cooldownMultiplier
        : 1.0;

    const levelAttackSpeedBonus = player.level > 1
        ? 1 + Math.min(4, player.level - 1) * 0.05
        : 1.0;

    const cycleSeconds = (runtime.playerProgression.ATTACK_COOLDOWN_SECONDS * weaponCooldownMult)
        / (levelAttackSpeedBonus * (player.attackSpeedMultiplier || 1));

    const critMult = 1 + (player.critChance || 0) * ((player.critDamageMultiplier || 1) - 1);
    const hitDamage = cleaveDamage * options.cleaveHits * critMult;
    const normalDps = hitDamage / cycleSeconds;
    const weakpointDps = hitDamage * 3 / cycleSeconds;
    let cleaveDps = normalDps * (1 - options.weakpointRate) + weakpointDps * options.weakpointRate;

    const volatilePerHit = (player.itemVolatileChance || 0)
        * (player.itemVolatileDamagePercent || 0) / 100
        * cleaveDamage;
    cleaveDps += (volatilePerHit * options.cleaveHits) / cycleSeconds;

    const executeFrac = player.itemExecuteThreshold > 0
        ? Math.min(0.65, (player.itemExecuteThreshold / 100) * 0.5 + 0.25)
        : 0;
    const executeMult = 1 + (player.itemExecuteDamagePercent || 0) / 100 * executeFrac;
    cleaveDps *= executeMult;

    const auraDps = player.itemDamageAuraPercent > 0
        ? player.damage * (player.itemDamageAuraPercent / 100)
        : 0;

    let bleedDps = 0;
    if (player.itemBleedDamagePercent > 0 && bossHp > 0) {
        const bleedStacks = player.itemBleedMaxStacks || 1;
        bleedDps = bossHp * (player.itemBleedDamagePercent / 100) * bleedStacks;
        // Cap bleed estimate - avoids sim feedback loop at very high boss HP.
        bleedDps = Math.min(bleedDps, cleaveDps * 0.35);
    }

    return {
        cleaveDps,
        auraDps,
        bleedDps,
        effectiveDps: cleaveDps + auraDps + bleedDps
    };
}

function collectItemDrop(runtime, player, rng) {
    const itemDef = runtime.rollRandomItem(rng);
    if (itemDef && player.itemManager.addItem(itemDef.id)) {
        player.itemDrops += 1;
        return true;
    }
    return false;
}

function simulateNormalRoom(runtime, player, options, roomNumber, rng) {
    runtime.ctx.Game.roomNumber = roomNumber;
    runtime.ctx.Game.itemsDroppedThisRoom = 0;

    const enemyCount = runtime.enemyCountForRoom(roomNumber);
    for (let i = 0; i < enemyCount; i++) {
        const typeKey = runtime.pickEnemyTypeKey(roomNumber, 'normal', rng(), runtime.level.constants);
        const config = runtime.enemyConfigs[typeKey];
        const scaled = runtime.scaleEnemyStats(config, roomNumber);
        applyXp(player, scaled.xpValue, runtime.playerProgression);

        if (rng() < scaled.lootChance) {
            const gearDifficulty = runtime.enemyGearDifficulty[typeKey] || 'basic';
            const gear = runtime.rollGear(roomNumber, gearDifficulty, rng);
            if (gear) {
                player.gearDrops += 1;
                equipIfBetter(player.loadout, gear);
            }
        }

        const itemDropChance = runtime.getItemDropChance(
            typeKey,
            roomNumber,
            runtime.ctx.Game.itemsDroppedThisRoom,
            enemyCount
        );
        if (rng() < itemDropChance && collectItemDrop(runtime, player, rng)) {
            runtime.ctx.Game.itemsDroppedThisRoom += 1;
        }
    }
    syncSimPlayerCombatStats(player);
}

function simulateBossEncounter(runtime, player, options, roomNumber, bossKey, rng) {
    runtime.ctx.Game.roomNumber = roomNumber;
    runtime.ctx.Game.gameMode = options.gameMode || 'gear';
    const boss = runtime.createUnscaledBoss(bossKey);
    const bossStats = runtime.applyBossRoomScaling(boss, roomNumber, options.players, {
        gameMode: options.gameMode || 'gear'
    });

    const dps = estimateWarriorDps(player, runtime, options, boss.maxHp);
    const timeToKill = boss.maxHp / dps.effectiveDps;

    // Boss rewards (xpValue *3 baked into BossBase constructor already).
    applyXp(player, boss.xpValue || 0, runtime.playerProgression);

    // Trophy (purple/orange) + 2-3 rare+ extras - mirrors boss-base.js die()
    const trophy = runtime.rollForcedTierGear(runtime.rollBossTrophyTier(roomNumber, rng), rng);
    if (trophy) {
        player.gearDrops += 1;
        equipIfBetter(player.loadout, trophy);
    }
    const gearDropCount = runtime.rollBossGearDropCount(rng);
    for (let i = 0; i < gearDropCount; i++) {
        const gear = runtime.rollGear(roomNumber, 'boss', rng);
        if (gear) {
            player.gearDrops += 1;
            equipIfBetter(player.loadout, gear);
        }
    }
    if (runtime.rollBossItemDrop(rng)) {
        const itemDef = runtime.rollRandomItem(rng, runtime.BOSS_ITEM_RARITY_WEIGHTS);
        if (itemDef && player.itemManager.addItem(itemDef.id)) {
            player.itemDrops += 1;
        }
    }
    syncSimPlayerCombatStats(player);

    return {
        roomNumber,
        bossKey,
        bossName: runtime.bossDisplayName(bossKey),
        unscaledHp: bossStats.constructorHp,
        bossHp: boss.maxHp,
        bossDamage: boss.damage,
        isEndless: bossStats.isEndless,
        playerLevel: player.level,
        playerDamage: player.damage,
        itemStacks: player.itemManager.getTotalItemCount(),
        uniqueItems: player.itemManager.getUniqueItemCount(),
        cleaveDps: dps.cleaveDps,
        auraDps: dps.auraDps,
        bleedDps: dps.bleedDps,
        dps: dps.effectiveDps,
        timeToKill
    };
}

function simulateFullRun(runtime, options, rng) {
    const player = createSimPlayer(runtime);
    const bossResults = [];

    for (let roomNumber = 1; roomNumber <= options.endRoom; roomNumber++) {
        const bossKey = runtime.getBossKeyForRoom(roomNumber);
        if (bossKey) {
            bossResults.push(simulateBossEncounter(runtime, player, options, roomNumber, bossKey, rng));
        } else {
            simulateNormalRoom(runtime, player, options, roomNumber, rng);
        }
    }

    return { player, bossResults };
}

function formatNumber(value, digits = 1) {
    return Number(value).toLocaleString('en-US', {
        maximumFractionDigits: digits,
        minimumFractionDigits: digits
    });
}

function printHelp() {
    console.log(`Full-run GEAR mode balance synthesis

Simulates a full run (room 1..--end-room) with continuous player progression.
Canonical run ends at room 50 (gear) or 32 (cards); use --end-room beyond
that to model endless continuation (same run, extra scaling kicks in).

GEAR mode boss rooms: 10, 20, 30, 40, 50 (then mid-cycle elite spawns after 50).
CARDS mode boss rooms: 12, 22, 32.

Options:
  --runs <n>                 Monte Carlo runs (default 150)
  --game-mode <gear|cards>   Game mode boss schedule (default gear)
  --end-room <n>             Last room to simulate (default 50 = canonical gear run end)
  --players <n>              Player count for boss HP/damage scaling (default 1)
  --target-seconds <n>       Desired median boss fight length (default 75)
  --target-seconds-growth <n> Add N seconds of target per boss encountered (default 0)
  --weakpoint-rate <n>       Fraction of hits on weak points (default 0.30)
  --cleave-hits <n>          Average cleave hitboxes connecting on boss (default 2.5)
  --seed <n>                 RNG seed (default 20260702)
`);
}

function main() {
    const options = parseArgs(process.argv);
    if (options.help) {
        printHelp();
        return;
    }

    if (options.gameMode === 'cards') {
        console.log('Note: CARDS mode has no gear/item drops (Game.gameMode !== "gear" disables generateGear).');
        console.log('This sim models GEAR-mode-style progression; CARDS mode balance is driven by the deck system instead.');
        console.log('');
    }

    const originalLog = console.log;
    console.log = (...args) => {
        if (typeof args[0] === 'string') {
            if (args[0].startsWith('[LEGENDARY]')) return;
            if (args[0].startsWith('[ItemManager]')) return;
            if (args[0].startsWith('[Item Drop]')) return;
            if (args[0].startsWith('[Item Pylon]')) return;
        }
        originalLog(...args);
    };

    const runtime = createBalanceRuntime({
        gameMode: options.gameMode,
        playerCount: options.players,
        difficulty: options.difficulty
    });
    const rng = mulberry32(options.seed);
    const runs = [];

    for (let i = 0; i < options.runs; i++) {
        runs.push(simulateFullRun(runtime, options, rng));
    }

    console.log = originalLog;

    // Group boss results by room number across all runs.
    const byRoom = new Map();
    for (const run of runs) {
        for (const result of run.bossResults) {
            if (!byRoom.has(result.roomNumber)) byRoom.set(result.roomNumber, []);
            byRoom.get(result.roomNumber).push(result);
        }
    }

    console.log('=== Full-Run Balance Synthesis ===');
    console.log(`Source: live files under ${runtime.root}/js`);
    console.log(`Runs: ${options.runs} | Game mode: ${options.gameMode} | End room: ${options.endRoom} | Players: ${options.players} | Difficulty: ${options.difficulty}`);
    console.log('');

    console.log('--- Game scaling constants (from js/combat-scaling.js) ---');
    console.log(`ENEMY_HP_GROWTH_PER_ROOM:     ${runtime.level.constants.ENEMY_HP_GROWTH_PER_ROOM}`);
    console.log(`ENEMY_DAMAGE_GROWTH_PER_ROOM: ${runtime.level.constants.ENEMY_DAMAGE_GROWTH_PER_ROOM}`);
    console.log(`BOSS_HP_GROWTH_PER_ROOM:      ${runtime.level.constants.BOSS_HP_GROWTH_PER_ROOM}`);
    console.log(`BOSS_DAMAGE_GROWTH_PER_ROOM:  ${runtime.level.constants.BOSS_DAMAGE_GROWTH_PER_ROOM}`);
    console.log(`ENEMY_TEMPO_GROWTH_PER_ROOM:  ${runtime.CombatScaling.ENEMY_TEMPO_GROWTH_PER_ROOM}`);
    if (runtime.CombatScaling.EARLY_RUN_XP_BONUS) {
        console.log(`EARLY_RUN (pre-boss):         count ${runtime.CombatScaling.EARLY_RUN_COUNT_BASE}+floor(room×${runtime.CombatScaling.EARLY_RUN_COUNT_PER_ROOM}), XP×${runtime.CombatScaling.EARLY_RUN_XP_BONUS}, HP×${runtime.CombatScaling.EARLY_RUN_HP_BONUS}`);
    }
    console.log('');

    const firstBossRoom = options.gameMode === 'cards' ? 12 : 10;
    if (options.endRoom >= firstBossRoom) {
        let totalTrash = 0;
        const trashLines = [];
        for (let r = 1; r < firstBossRoom; r++) {
            const count = runtime.enemyCountForRoom(r, {
                gameMode: options.gameMode,
                playerCount: options.players,
                difficulty: options.difficulty
            });
            totalTrash += count;
            trashLines.push(`R${r}:${count}`);
        }
        console.log(`--- Pre-boss trash (${firstBossRoom - 1} rooms) ---`);
        console.log(`Enemies per room: ${trashLines.join(' ')} (total ${totalTrash})`);
        console.log('');
    }

    const bossRooms = [...byRoom.keys()].sort((a, b) => a - b);
    if (bossRooms.length) {
        console.log('--- Scaling factors at boss rooms (MP validation) ---');
        bossRooms.forEach(roomNumber => {
            const factors = runtime.computeScalingFactorsForRoom(roomNumber, {
                gameMode: options.gameMode,
                playerCount: options.players,
                difficulty: options.difficulty,
                roomType: 'boss'
            });
            const mp = factors.mp;
            console.log(
                `Room ${roomNumber}: HP×${factors.roomHp.toFixed(2)} DMG×${factors.roomDamage.toFixed(2)} ` +
                `tempo×${factors.roomTempo.toFixed(3)} intel=${factors.intelligence.toFixed(2)} ` +
                `MP(enemies ${mp.enemyCount}x HP ${mp.enemyHP}x bossHP ${mp.bossHP}x)`
            );
        });
        console.log('');
    }

    const sortedRooms = Array.from(byRoom.keys()).sort((a, b) => a - b);
    const recommendations = [];
    let bossIndex = 0;

    for (const roomNumber of sortedRooms) {
        const results = byRoom.get(roomNumber);
        const bossName = results[0].bossName;
        const targetSeconds = options.targetSeconds + bossIndex * options.targetSecondsGrowthPerBoss;
        bossIndex += 1;

        const level = summarize(results.map(r => r.playerLevel));
        const dps = summarize(results.map(r => r.dps));
        const ttk = summarize(results.map(r => r.timeToKill));
        const bossHp = summarize(results.map(r => r.bossHp));
        const itemStacks = summarize(results.map(r => r.itemStacks));

        const medianDps = dps.median;
        const recommendedHp = Math.round(medianDps * targetSeconds);
        const currentHp = results[0].bossHp;
        const hpMultiplier = recommendedHp / currentHp;
        const recommendedBaseHp = Math.round(results[0].unscaledHp * hpMultiplier);

        console.log(`--- Room ${roomNumber}: ${bossName} (target ~${formatNumber(targetSeconds, 0)}s) ---`);
        console.log(`Player level      p25 ${level.p25} | median ${level.median} | p75 ${level.p75}`);
        console.log(`Item stacks       mean ${formatNumber(itemStacks.mean, 1)}`);
        console.log(`Boss HP (scaled)  ${formatNumber(currentHp, 0)} (unscaled constructor: ${formatNumber(results[0].unscaledHp, 0)})`);
        console.log(`Boss damage       ${formatNumber(results[0].bossDamage, 1)}`);
        console.log(`DPS               p25 ${formatNumber(dps.p25)} | median ${formatNumber(dps.median)} | p75 ${formatNumber(dps.p75)}`);
        console.log(`TTK (sec)         p25 ${formatNumber(ttk.p25)} | median ${formatNumber(ttk.median)} | p75 ${formatNumber(ttk.p75)}`);
        console.log(`Recommended HP (scaled):        ~${formatNumber(recommendedHp, 0)}  (${formatNumber(hpMultiplier, 2)}x current)`);
        console.log(`Recommended constructor maxHp:  ~${formatNumber(recommendedBaseHp, 0)}  (currently ${formatNumber(results[0].unscaledHp, 0)})`);
        console.log('');

        recommendations.push({
            roomNumber,
            bossName,
            currentConstructorHp: results[0].unscaledHp,
            recommendedConstructorHp: recommendedBaseHp,
            medianTtk: ttk.median,
            targetSeconds
        });
    }

    console.log('--- Summary: recommended constructor maxHp by boss ---');
    for (const rec of recommendations) {
        const flag = Math.abs(rec.medianTtk - rec.targetSeconds) > rec.targetSeconds * 0.25 ? '  <-- OUT OF RANGE' : '';
        console.log(
            `Room ${rec.roomNumber} ${rec.bossName.padEnd(14)} current ${formatNumber(rec.currentConstructorHp, 0).padStart(9)}  ->  recommended ${formatNumber(rec.recommendedConstructorHp, 0).padStart(9)}  (median TTK ${formatNumber(rec.medianTtk, 1)}s vs target ${formatNumber(rec.targetSeconds, 0)}s)${flag}`
        );
    }
    console.log('');

    console.log('Notes:');
    console.log('- Player progression (XP, gear, items) is continuous across the whole run, including boss XP/gear/item rewards.');
    console.log('- Boss stats use js/combat-scaling.js (mode-specific anchors, endless ramp past canonical end).');
    console.log('- Trash tempo/intelligence scale via combat-scaling; sim TTK is still cleave-primary (no trash clear model).');
    console.log('- Canonical run end: room 30 (gear) / room 32 (cards). Endless = same run continuing past that.');
    console.log('- Item drops use live enemy-base.js chances; boss item/gear drops use live boss-base.js die() rates (trophy + rare+ extras).');
    console.log('- DPS model is warrior cleave-primary; specials/heavy/affixes and non-warrior classes are not simulated.');
    console.log('- CARDS mode has no gear/item drops; this script models GEAR-mode progression only.');
}

if (require.main === module) {
    main();
}

module.exports = {
    parseArgs,
    simulateFullRun,
    estimateWarriorDps,
    summarize
};
