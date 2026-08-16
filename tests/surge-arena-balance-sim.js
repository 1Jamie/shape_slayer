#!/usr/bin/env node
/**
 * Surge Arena scaling and balance simulation (Monte Carlo).
 * Sources all formulas, enemy configs, and scaling mechanics from live game files.
 *
 * Usage:
 *   node tests/surge-arena-balance-sim.js
 *   node tests/surge-arena-balance-sim.js --runs 200 --waves 40 --players 1
 */

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createBalanceRuntime, createSimPlayer, syncSimPlayerCombatStats } = require('./lib/balance-runtime');

function parseArgs(argv) {
    const options = {
        runs: 100,
        waves: 40,
        players: 1,
        targetSeconds: 60,
        weakpointRate: 0.3,
        cleaveHits: 2.5,
        seed: 20260702
    };

    for (let i = 2; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--runs') options.runs = Number(argv[++i]);
        else if (arg === '--waves') options.waves = Number(argv[++i]);
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

const THREAT = {
    basic: 10,
    star: 14,
    diamond: 18,
    rectangle: 22,
    octagon: 38
};

function buildSpawnQueue(budget, allowedTiers, rng) {
    const queue = [];
    let rem = budget;
    const allowed = allowedTiers && allowedTiers.length ? allowedTiers : ['basic'];

    let minCost = Infinity;
    for (const tier of allowed) {
        const cost = THREAT[tier] || 10;
        if (cost < minCost) minCost = cost;
    }

    while (rem >= minCost) {
        const tier = allowed[Math.floor(rng() * allowed.length)];
        const cost = THREAT[tier] || 10;
        if (cost <= rem) {
            queue.push(tier);
            rem -= cost;
        } else {
            let cheapest = null;
            let cheapestCost = Infinity;
            for (const t of allowed) {
                const c = THREAT[t] || 10;
                if (c <= rem && c < cheapestCost) {
                    cheapest = t;
                    cheapestCost = c;
                }
            }
            if (cheapest) {
                queue.push(cheapest);
                rem -= cheapestCost;
            } else {
                break;
            }
        }
    }
    return queue;
}

function applyXp(player, rawXp, progression) {
    const gained = rawXp * 0.35;
    player.xp += gained;
    player.totalXpEarned = (player.totalXpEarned || 0) + gained;
    while (player.xp >= progression.xpToNext(player.level)) {
        player.xp -= progression.xpToNext(player.level);
        player.level += 1;
        player.baseDamage *= progression.LEVEL_DAMAGE_MULTIPLIER;
        player.baseMaxHp *= progression.LEVEL_HP_MULTIPLIER;
    }
}

function estimateWarriorBossDps(player, runtime, options, bossHp) {
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
        bleedDps = Math.min(bleedDps, cleaveDps * 0.35);
    }

    const effectiveDps = cleaveDps + auraDps + bleedDps;

    return {
        effectiveDps,
        cleaveDps,
        auraDps,
        bleedDps
    };
}

function emptyTierCounts() {
    return { gray: 0, green: 0, blue: 0, purple: 0, orange: 0, total: 0 };
}

function simulateRun(runtime, options, rng) {
    const player = createSimPlayer(runtime);
    player.totalXpEarned = 0;
    player.credits = 0;

    // Equip starting gray broadsword
    player.loadout.weapon = {
        id: 'weapon_init',
        slot: 'weapon',
        tier: 'gray',
        level: 1,
        weaponType: 'broadsword',
        stats: { damage: 15 },
        upgradesApplied: 0,
        rarityStepsApplied: 0,
        affixes: []
    };
    syncSimPlayerCombatStats(player);

    const wavesData = [];
    const groundDropTiers = emptyTierCounts();
    const groundDropByBand = {
        '1-10': emptyTierCounts(),
        '11-20': emptyTierCounts(),
        '21-30': emptyTierCounts(),
        '31-40': emptyTierCounts()
    };

    for (let wave = 1; wave <= options.waves; wave++) {
        // Live Surge Arena: contentGameMode is 'gear'; session id gates arena loot curves.
        runtime.ctx.Game.gameMode = 'gear';
        runtime.ctx.Game.activeSessionId = 'surge-arena';
        runtime.ctx.Game.modeId = 'surge-arena';
        runtime.ctx.Game.waveNumber = wave;
        runtime.ctx.Game.roomNumber = wave; // Sync for scaling selectors
        runtime.ctx.Game.itemsDroppedThisRoom = 0;

        // Mock functions in VM context to query local state
        runtime.ctx.getTotalPlayerXP = () => player.totalXpEarned;
        runtime.ctx.getSessionTimeAlive = () => wave * 60; // 60s per wave

        // Compute Wave Plan
        const plan = runtime.ctx.SurgeArenaRules.computeWavePlan(runtime.ctx.Game, { wave });
        const queue = buildSpawnQueue(plan.spawnBudget, plan.allowedEnemyTiers, rng);

        let comboCount = 0;
        const waveDropTiers = emptyTierCounts();

        // Simulate Combat Phase
        for (const tier of queue) {
            const config = runtime.enemyConfigs[tier];
            const scaled = runtime.scaleEnemyStats(config, wave, { gameMode: 'surge-arena' });

            // Add XP
            applyXp(player, scaled.xpValue, runtime.playerProgression);
            syncSimPlayerCombatStats(player);

            // Dynamic combo tracker
            const isElite = (tier === 'octagon');
            comboCount += isElite ? 2 : 1;

            let comboMult = 1.0;
            if (comboCount >= 120) comboMult = 6.0;
            else if (comboCount >= 80) comboMult = 4.5;
            else if (comboCount >= 50) comboMult = 3.0;
            else if (comboCount >= 30) comboMult = 2.0;
            else if (comboCount >= 15) comboMult = 1.5;

            // Roll credit rewards
            const baseCredit = isElite ? 15 : 1;
            const creditGained = Math.floor(baseCredit * comboMult * 0.35);
            player.credits += creditGained;

            // Roll standard gear drops
            if (rng() < scaled.lootChance) {
                const gearDifficulty = runtime.enemyGearDifficulty[tier] || 'basic';
                const gear = runtime.rollGear(wave, gearDifficulty, rng);
                if (gear) {
                    const dropTier = gear.tier || 'gray';
                    groundDropTiers[dropTier] = (groundDropTiers[dropTier] || 0) + 1;
                    groundDropTiers.total += 1;
                    waveDropTiers[dropTier] = (waveDropTiers[dropTier] || 0) + 1;
                    waveDropTiers.total += 1;

                    let bandKey = null;
                    if (wave <= 10) bandKey = '1-10';
                    else if (wave <= 20) bandKey = '11-20';
                    else if (wave <= 30) bandKey = '21-30';
                    else if (wave <= 40) bandKey = '31-40';
                    if (bandKey && groundDropByBand[bandKey]) {
                        groundDropByBand[bandKey][dropTier] = (groundDropByBand[bandKey][dropTier] || 0) + 1;
                        groundDropByBand[bandKey].total += 1;
                    }

                    // Equip if better primary stats
                    if (!player.loadout.weapon || (gear.slot === 'weapon' && (gear.stats.damage || 0) > (player.loadout.weapon.stats.damage || 0))) {
                        player.loadout.weapon = gear;
                        syncSimPlayerCombatStats(player);
                    }
                }
            }

            // Roll standard item drops
            const itemDropChance = runtime.getItemDropChance(
                tier,
                wave,
                runtime.ctx.Game.itemsDroppedThisRoom,
                queue.length
            );
            if (rng() < itemDropChance) {
                const itemDef = runtime.rollRandomItem(rng);
                if (itemDef && player.itemManager.addItem(itemDef.id)) {
                    runtime.ctx.Game.itemsDroppedThisRoom += 1;
                }
            }
        }

        // Downtime Upgrades Phase
        const weapon = player.loadout.weapon;
        if (weapon) {
            // Normalize fields
            if (typeof runtime.ctx.normalizeGearProgressFields === 'function') {
                runtime.ctx.normalizeGearProgressFields(weapon);
            }

            // 1. Try to upgrade Weapon Rarity
            const nextTier = typeof runtime.ctx.getNextGearTier === 'function' ? runtime.ctx.getNextGearTier(weapon.tier) : null;
            const rarityCost = typeof runtime.ctx.getRarityUpgradeBaseCost === 'function' ? runtime.ctx.getRarityUpgradeBaseCost(weapon.tier) : null;
            if (nextTier && rarityCost && player.credits >= rarityCost) {
                player.credits -= rarityCost;
                if (typeof runtime.ctx.raiseGearRarity === 'function') {
                    runtime.ctx.raiseGearRarity(weapon);
                } else {
                    weapon.tier = nextTier;
                }
                syncSimPlayerCombatStats(player);
            }

            // 2. Try to Upgrade Weapon Level (Max 3 times per downtime)
            for (let i = 0; i < 3; i++) {
                const currentLevel = weapon.level || 1;
                const levelCost = Math.floor(50 * Math.pow(1.15, currentLevel));
                if (player.credits >= levelCost && currentLevel < player.level) {
                    player.credits -= levelCost;
                    for (let statName in weapon.stats) {
                        weapon.stats[statName] *= 1.04;
                    }
                    if (weapon.affixes) {
                        weapon.affixes.forEach(affix => {
                            affix.value *= 1.04;
                        });
                    }
                    weapon.level = currentLevel + 1;
                    weapon.upgradesApplied = (weapon.upgradesApplied || 0) + 1;
                }
            }
            syncSimPlayerCombatStats(player);
        }

        // Get basic enemy stats for this wave
        const basicConfig = runtime.enemyConfigs.basic;
        const basicScaled = runtime.scaleEnemyStats(basicConfig, wave, { gameMode: 'surge-arena' });

        // Analyze Boss Battle metrics if it is a Surge/Hard Wave
        const hardWave = wave === 8 || (wave >= 15 && wave % 5 === 0);
        let bossHp = 0;
        let bossDamage = 0;
        let bossTtk = 0;

        if (hardWave) {
            const bossCount = runtime.ctx.GameArena.getArenaBossCount(wave);
            const scaleRoom = runtime.ctx.GameArena.arenaBossScalingRoom(wave);
            const boss = runtime.createUnscaledBoss('swarmKing');
            runtime.applyBossRoomScaling(boss, scaleRoom, options.players, { gameMode: 'gear' });

            const hpMult = runtime.ctx.GameArena.arenaBossHpMult(wave, bossCount);
            const dmgMult = runtime.ctx.GameArena.arenaBossDamageMult(wave, bossCount);

            bossHp = Math.max(1, Math.floor(boss.maxHp * hpMult));
            bossDamage = boss.damage * dmgMult;

            const dps = estimateWarriorBossDps(player, runtime, options, bossHp);
            bossTtk = bossHp / Math.max(1, dps.effectiveDps);
        }

        const currentDps = estimateWarriorBossDps(player, runtime, options, 0).effectiveDps;

        wavesData.push({
            wave,
            playerLevel: player.level,
            weaponTier: weapon?.tier || 'none',
            weaponLevel: weapon?.level || 1,
            weaponDamage: weapon?.stats?.damage || 0,
            playerDps: currentDps,
            credits: player.credits,
            itemStacks: player.itemManager.getTotalItemCount(),
            basicHp: basicScaled.maxHp,
            basicDamage: basicScaled.damage,
            bossHp,
            bossDamage,
            bossTtk,
            groundDrops: waveDropTiers
        });
    }

    return { waves: wavesData, groundDropTiers, groundDropByBand };
}

function main() {
    const options = parseArgs(process.argv);
    if (options.help) {
        console.log(`Surge Arena Balance Simulation

Options:
  --runs <n>             Number of Monte Carlo runs (default 100)
  --waves <n>            Number of waves to simulate (default 40)
  --players <n>          Player count for boss scaling (default 1)
  --target-seconds <n>   Target boss battle fight length (default 60)
  --seed <n>             RNG seed (default 20260702)
`);
        return;
    }

    // Suppress console logs during simulations
    const originalLog = console.log;
    console.log = (...args) => {
        if (typeof args[0] === 'string') {
            if (args[0].startsWith('[LEGENDARY]') || args[0].startsWith('[ItemManager]') || args[0].startsWith('[Item Drop]')) return;
        }
        originalLog(...args);
    };

    // contentGameMode is gear; activeSessionId is set per-wave in simulateRun
    const runtime = createBalanceRuntime({ gameMode: 'gear' });
    runtime.ctx.Game.activeSessionId = 'surge-arena';
    runtime.ctx.Game.modeId = 'surge-arena';

    // Load game bus and rules into context
    const ROOT = path.resolve(__dirname, '..');
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'src/game/game-bus.js'), 'utf8'), runtime.ctx);
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'src/modes/surge-arena/rules.js'), 'utf8'), runtime.ctx);
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'src/game/simulation/arena-mode.js'), 'utf8'), runtime.ctx);

    const rng = mulberry32(options.seed);
    const allRuns = [];

    for (let i = 0; i < options.runs; i++) {
        allRuns.push(simulateRun(runtime, options, rng));
    }

    console.log = originalLog;

    // Summarize across runs for each wave
    console.log('=== Surge Arena Scaling Simulation (Monte Carlo) ===');
    console.log(`Runs: ${options.runs} | Total Waves: ${options.waves} | Players: ${options.players}`);
    console.log('');
    console.log(
        'Wave | Lvl | Wpn Tier/Lvl | Player DPS | Items | Credits | Basic HP/Dmg  | Boss HP      | Boss Dmg | Boss TTK'
    );
    console.log(
        '-----|-----|--------------|------------|-------|---------|---------------|--------------|----------|---------'
    );

    const tierAbbr = { gray: 'Gry', green: 'Grn', blue: 'Blu', purple: 'Pur', orange: 'Org' };
    const tierKeys = ['gray', 'green', 'blue', 'purple', 'orange'];

    for (let wIdx = 0; wIdx < options.waves; wIdx++) {
        const wave = wIdx + 1;
        const runsAtWave = allRuns.map(run => run.waves[wIdx]);

        const level = summarize(runsAtWave.map(r => r.playerLevel)).median;
        const dps = summarize(runsAtWave.map(r => r.playerDps)).median;
        const items = summarize(runsAtWave.map(r => r.itemStacks)).median;
        const credits = summarize(runsAtWave.map(r => r.credits)).median;
        const weaponLvl = summarize(runsAtWave.map(r => r.weaponLevel)).median;

        // Weapon tier (most common)
        const tiers = runsAtWave.map(r => r.weaponTier);
        const tierCounts = {};
        tiers.forEach(t => { tierCounts[t] = (tierCounts[t] || 0) + 1; });
        const topTier = Object.entries(tierCounts).sort((a, b) => b[1] - a[1])[0][0];
        const tierStr = `${tierAbbr[topTier] || topTier} L${Math.round(weaponLvl)}`;

        const basicHp = runsAtWave[0].basicHp;
        const basicDmg = runsAtWave[0].basicDamage;

        const isBossWave = wave === 8 || (wave >= 15 && wave % 5 === 0);
        let bossHpStr = '-';
        let bossDmgStr = '-';
        let bossTtkStr = '-';

        if (isBossWave) {
            const bossHp = summarize(runsAtWave.map(r => r.bossHp)).median;
            const bossDmg = summarize(runsAtWave.map(r => r.bossDamage)).median;
            const bossTtk = summarize(runsAtWave.map(r => r.bossTtk)).median;

            bossHpStr = Math.round(bossHp).toLocaleString();
            bossDmgStr = Math.round(bossDmg).toLocaleString();
            bossTtkStr = bossTtk.toFixed(1) + 's';
        }

        console.log(
            `${wave.toString().padEnd(4)} | ` +
            `${Math.round(level).toString().padEnd(3)} | ` +
            `${tierStr.padEnd(12)} | ` +
            `${Math.round(dps).toString().padEnd(10)} | ` +
            `${Math.round(items).toString().padEnd(5)} | ` +
            `${Math.round(credits).toString().padEnd(7)} | ` +
            `${Math.round(basicHp)}/${Math.round(basicDmg)}`.padEnd(13) + ' | ' +
            `${bossHpStr.padEnd(12)} | ` +
            `${bossDmgStr.padEnd(8)} | ` +
            `${bossTtkStr}`
        );
    }
    console.log('');

    function formatTierShare(counts) {
        const total = counts.total || 0;
        if (!total) return 'no drops';
        return tierKeys
            .map(k => `${tierAbbr[k]} ${((counts[k] || 0) / total * 100).toFixed(1)}%`)
            .join('  ');
    }

    const mergedBands = {
        '1-10': emptyTierCounts(),
        '11-20': emptyTierCounts(),
        '21-30': emptyTierCounts(),
        '31-40': emptyTierCounts()
    };
    const mergedAll = emptyTierCounts();
    for (const run of allRuns) {
        for (const band of Object.keys(mergedBands)) {
            const src = run.groundDropByBand[band] || emptyTierCounts();
            for (const k of tierKeys) mergedBands[band][k] += src[k] || 0;
            mergedBands[band].total += src.total || 0;
        }
        for (const k of tierKeys) mergedAll[k] += run.groundDropTiers[k] || 0;
        mergedAll.total += run.groundDropTiers.total || 0;
    }

    console.log('=== Ground Drop Tier Histogram (excludes safe-room upgrades) ===');
    console.log(`All waves: n=${mergedAll.total}  ${formatTierShare(mergedAll)}`);
    for (const band of Object.keys(mergedBands)) {
        const c = mergedBands[band];
        console.log(`W${band.padEnd(6)} n=${String(c.total).padEnd(6)}  ${formatTierShare(c)}`);
    }
    console.log('');
}

if (require.main === module) {
    main();
}
