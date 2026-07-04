#!/usr/bin/env node
/**
 * GEAR mode balance synthesis - sources all formulas/constants from live game files.
 *
 * Usage:
 *   node tests/gear-mode-balance-sim.js
 *   node tests/gear-mode-balance-sim.js --runs 200 --room 10 --players 1
 *   node tests/gear-mode-balance-sim.js --target-seconds 75 --weakpoint-rate 0.35
 */

const { createBalanceRuntime, createSimPlayer, syncSimPlayerCombatStats } = require('./lib/balance-runtime');

function parseArgs(argv) {
    const options = {
        runs: 150,
        room: 10,
        players: 1,
        targetSeconds: 75,
        weakpointRate: 0.3,
        cleaveHits: 2.5,
        seed: 20260702
    };

    for (let i = 2; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--runs') options.runs = Number(argv[++i]);
        else if (arg === '--room') options.room = Number(argv[++i]);
        else if (arg === '--players') options.players = Number(argv[++i]);
        else if (arg === '--target-seconds') options.targetSeconds = Number(argv[++i]);
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

function createEmptyLoadout() {
    return { weapon: null, armor: null, accessory: null };
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

function estimateWarriorBossDps(player, runtime, options) {
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

    // volatile_core: explosion is % of damage dealt per hit (combat.js)
    const volatilePerHit = (player.itemVolatileChance || 0)
        * (player.itemVolatileDamagePercent || 0) / 100
        * cleaveDamage;
    cleaveDps += (volatilePerHit * options.cleaveHits) / cycleSeconds;

    // executioner's mark: ~45% of boss HP spent below threshold in a typical burn
    const executeFrac = player.itemExecuteThreshold > 0
        ? Math.min(0.65, (player.itemExecuteThreshold / 100) * 0.5 + 0.25)
        : 0;
    const executeMult = 1 + (player.itemExecuteDamagePercent || 0) / 100 * executeFrac;
    cleaveDps *= executeMult;

    // damage_aura: continuous % of player.damage per second while in range
    const auraDps = player.itemDamageAuraPercent > 0
        ? player.damage * (player.itemDamageAuraPercent / 100)
        : 0;

    // bleeding_edge: sustained max bleed stacks on boss
    let bleedDps = 0;
    if (player.itemBleedDamagePercent > 0 && options.bossHp > 0) {
        const bleedStacks = player.itemBleedMaxStacks || 1;
        bleedDps = options.bossHp * (player.itemBleedDamagePercent / 100) * bleedStacks;
        bleedDps = Math.min(bleedDps, cleaveDps * 0.35);
    }

    const effectiveDps = cleaveDps + auraDps + bleedDps;

    return {
        totalDamage: player.damage,
        cleaveDamage,
        cycleSeconds,
        normalDps,
        weakpointDps,
        cleaveDps,
        auraDps,
        bleedDps,
        effectiveDps,
        critMult,
        executeMult
    };
}

function simulateRun(runtime, options, rng) {
    const player = createSimPlayer(runtime);

    for (let roomNumber = 1; roomNumber < options.room; roomNumber++) {
        runtime.ctx.Game.roomNumber = roomNumber;
        runtime.ctx.Game.itemsDroppedThisRoom = 0;

        const enemyCount = runtime.enemyCountForRoom(roomNumber);
        for (let i = 0; i < enemyCount; i++) {
            const typeKey = runtime.pickEnemyTypeKey(roomNumber, 'normal', rng(), runtime.level.constants);
            const config = runtime.enemyConfigs[typeKey];
            const scaled = runtime.scaleEnemyStats(config, roomNumber);
            applyXp(player, scaled.xpValue, runtime.playerProgression);
            syncSimPlayerCombatStats(player);

            if (rng() < scaled.lootChance) {
                const gearDifficulty = runtime.enemyGearDifficulty[typeKey] || 'basic';
                const gear = runtime.rollGear(roomNumber, gearDifficulty, rng);
                if (gear) {
                    player.gearDrops += 1;
                    equipIfBetter(player.loadout, gear);
                    syncSimPlayerCombatStats(player);
                }
            }

            const itemDropChance = runtime.getItemDropChance(
                typeKey,
                roomNumber,
                runtime.ctx.Game.itemsDroppedThisRoom,
                enemyCount
            );
            if (rng() < itemDropChance) {
                const itemDef = runtime.rollRandomItem(rng);
                if (itemDef && player.itemManager.addItem(itemDef.id)) {
                    player.itemDrops += 1;
                    runtime.ctx.Game.itemsDroppedThisRoom += 1;
                }
            }
        }
    }

    const boss = runtime.createUnscaledBoss('swarmKing');
    runtime.ctx.Game.gameMode = 'gear';
    const bossStats = runtime.applyBossRoomScaling(boss, options.room, options.players, { gameMode: 'gear' });
    const dpsOptions = { ...options, bossHp: boss.maxHp };
    const dps = estimateWarriorBossDps(player, runtime, dpsOptions);
    const timeToKill = boss.maxHp / dps.effectiveDps;

    const itemStacks = player.itemManager.getTotalItemCount();
    const uniqueItems = player.itemManager.getUniqueItemCount();
    const offensiveStacks = {};
    for (const [itemId, entry] of Object.entries(player.itemManager.items)) {
        if (entry.definition.category === 'offensive') {
            offensiveStacks[itemId] = entry.stacks;
        }
    }

    return {
        level: player.level,
        xp: player.xp,
        baseDamage: player.baseDamage,
        weaponDamage: player.loadout.weapon?.stats?.damage || 0,
        weaponTier: player.loadout.weapon?.tier || 'none',
        armorDefense: player.loadout.armor?.stats?.defense || 0,
        gearDrops: player.gearDrops,
        itemDrops: player.itemDrops,
        itemStacks,
        uniqueItems,
        offensiveStacks,
        itemDamageBonus: player.itemDamageBonus,
        dps: dps.effectiveDps,
        cleaveDps: dps.cleaveDps,
        auraDps: dps.auraDps,
        bleedDps: dps.bleedDps,
        bossUnscaledHp: bossStats.constructorHp,
        bossHp: boss.maxHp,
        bossDamage: boss.damage,
        timeToKill
    };
}

function formatNumber(value, digits = 1) {
    return Number(value).toLocaleString('en-US', {
        maximumFractionDigits: digits,
        minimumFractionDigits: digits
    });
}

function printHelp() {
    console.log(`GEAR mode balance synthesis

Simulates rooms 1..N-1 using live enemy/gear/XP formulas, then estimates
room-N Swarm King time-to-kill from sourced warrior damage math.

Options:
  --runs <n>             Monte Carlo runs (default 150)
  --room <n>             Boss room number (default 10)
  --players <n>          Player count for boss HP scaling (default 1)
  --target-seconds <n>   Desired median boss fight length (default 75)
  --weakpoint-rate <n>   Fraction of hits on weak points (default 0.30)
  --cleave-hits <n>      Average cleave hitboxes connecting on boss (default 2.5)
  --seed <n>             RNG seed (default 20260702)
`);
}

function main() {
    const options = parseArgs(process.argv);
    if (options.help) {
        printHelp();
        return;
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

    const runtime = createBalanceRuntime({ gameMode: 'gear', roomNumber: options.room });
    const rng = mulberry32(options.seed);
    const results = [];

    for (let i = 0; i < options.runs; i++) {
        results.push(simulateRun(runtime, options, rng));
    }

    console.log = originalLog;

    const levels = summarize(results.map(result => result.level));
    const weaponDamage = summarize(results.map(result => result.weaponDamage));
    const totalDamage = summarize(results.map(result => result.baseDamage + result.weaponDamage));
    const dps = summarize(results.map(result => result.dps));
    const ttk = summarize(results.map(result => result.timeToKill));
    const gearDrops = summarize(results.map(result => result.gearDrops));
    const itemDrops = summarize(results.map(result => result.itemDrops));
    const itemStacks = summarize(results.map(result => result.itemStacks));
    const itemDamageBonus = summarize(results.map(result => result.itemDamageBonus * 100));

    const sampleBoss = results[0];
    const medianDps = dps.median;
    const recommendedHp = Math.round(medianDps * options.targetSeconds);
    const currentHp = sampleBoss.bossHp;
    const hpMultiplier = recommendedHp / currentHp;
    const recommendedBaseHp = Math.round(sampleBoss.bossUnscaledHp * hpMultiplier);

    const tierCounts = {};
    const offensiveItemTotals = {};
    results.forEach(result => {
        tierCounts[result.weaponTier] = (tierCounts[result.weaponTier] || 0) + 1;
        for (const [itemId, stacks] of Object.entries(result.offensiveStacks)) {
            offensiveItemTotals[itemId] = (offensiveItemTotals[itemId] || 0) + stacks;
        }
    });

    console.log('=== GEAR Mode Balance Synthesis ===');
    console.log(`Source: live files under ${runtime.root}/js`);
    console.log(`Runs: ${options.runs} | Target boss room: ${options.room} | Players: ${options.players}`);
    console.log('');

    console.log('--- Game scaling constants (from js/combat-scaling.js) ---');
    console.log(`ENEMY_HP_GROWTH_PER_ROOM:     ${runtime.level.constants.ENEMY_HP_GROWTH_PER_ROOM}`);
    console.log(`ENEMY_DAMAGE_GROWTH_PER_ROOM: ${runtime.level.constants.ENEMY_DAMAGE_GROWTH_PER_ROOM}`);
    console.log(`BOSS_HP_GROWTH_PER_ROOM:      ${runtime.level.constants.BOSS_HP_GROWTH_PER_ROOM}`);
    console.log(`BOSS_DAMAGE_GROWTH_PER_ROOM:  ${runtime.level.constants.BOSS_DAMAGE_GROWTH_PER_ROOM}`);
    console.log('');

    console.log('--- Swarm King @ room', options.room, '---');
    console.log(`Unscaled constructor HP: ${formatNumber(sampleBoss.bossUnscaledHp, 0)}`);
    console.log(`Room+MP scaled HP:       ${formatNumber(currentHp, 0)}`);
    console.log(`Room+MP scaled damage:   ${formatNumber(sampleBoss.bossDamage, 1)}`);
    console.log(`Boss armor/defense:      none (bosses take full player damage)`);
    console.log('');

    console.log('--- Player state entering boss (rooms 1-' + (options.room - 1) + ', warrior, no nexus upgrades) ---');
    console.log(`Level        p25 ${levels.p25} | median ${levels.median} | p75 ${levels.p75}`);
    console.log(`Weapon dmg   p25 ${formatNumber(weaponDamage.p25)} | median ${formatNumber(weaponDamage.median)} | p75 ${formatNumber(weaponDamage.p75)}`);
    console.log(`Total dmg    p25 ${formatNumber(totalDamage.p25)} | median ${formatNumber(totalDamage.median)} | p75 ${formatNumber(totalDamage.p75)}`);
    console.log(`Gear drops   mean ${formatNumber(gearDrops.mean, 1)} per run`);
    console.log(`Item drops   mean ${formatNumber(itemDrops.mean, 1)} | median ${itemDrops.median} | p75 ${itemDrops.p75}`);
    console.log(`Item stacks  mean ${formatNumber(itemStacks.mean, 1)} total stacks per run`);
    console.log(`Item dmg bonus (median): +${formatNumber(itemDamageBonus.median, 0)}%`);
    const topOffensive = Object.entries(offensiveItemTotals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([id, stacks]) => {
            const name = runtime.ITEM_DEFINITIONS[id]?.name || id;
            return `${name}:${formatNumber(stacks / options.runs, 1)}`;
        });
    if (topOffensive.length) {
        console.log('Top offensive items (avg stacks/run):', topOffensive.join(', '));
    }
    console.log('Weapon tiers:', Object.entries(tierCounts).sort((a, b) => b[1] - a[1]).map(([tier, count]) => `${tier}:${count}`).join(', '));
    console.log('');

    console.log('--- Estimated boss DPS / TTK ---');
    console.log(`Assumptions: cleave hits=${options.cleaveHits}, weakpoint rate=${options.weakpointRate}, all item drops collected`);
    const sampleDps = results[Math.floor(results.length / 2)];
    console.log(`DPS breakdown (median run): cleave ${formatNumber(sampleDps.cleaveDps)} + aura ${formatNumber(sampleDps.auraDps)} + bleed ${formatNumber(sampleDps.bleedDps)}`);
    console.log(`DPS          p25 ${formatNumber(dps.p25)} | median ${formatNumber(dps.median)} | p75 ${formatNumber(dps.p75)}`);
    console.log(`TTK (sec)     p25 ${formatNumber(ttk.p25)} | median ${formatNumber(ttk.median)} | p75 ${formatNumber(ttk.p75)}`);
    console.log('');

    console.log('--- Recommendations ---');
    console.log(`Target fight length: ~${options.targetSeconds}s (median skilled clear with gear)`);
    console.log(`Recommended room ${options.room} HP (median DPS): ~${formatNumber(recommendedHp, 0)}`);
    console.log(`Current room ${options.room} HP:                    ${formatNumber(currentHp, 0)}`);
    console.log(`HP multiplier needed:                         ~${formatNumber(hpMultiplier, 2)}x`);
    console.log(`Suggested SwarmKing constructor maxHp:          ~${formatNumber(recommendedBaseHp, 0)} (currently ${formatNumber(sampleBoss.bossUnscaledHp, 0)})`);
    console.log('');
    console.log('Notes:');
    console.log('- Boss HP/damage from js/combat-scaling.js (not hardcoded per-boss constructor maxHp).');
    console.log('- Item drops use live enemy-base.js chances, room scaling, and per-room diminishing returns.');
    console.log('- Items applied via live ItemManager; DPS includes crit, attack speed, aura, bleed, volatile, execute.');
    console.log('- DPS model is warrior cleave-primary; specials/heavy/affixes not fully simulated.');
    console.log('- For longer fights, tune BOSS_MODE_CONFIG in js/combat-scaling.js (encounter multipliers, anchorBaseHp).');
}

if (require.main === module) {
    main();
}

module.exports = {
    parseArgs,
    simulateRun,
    estimateWarriorBossDps,
    summarize
};
