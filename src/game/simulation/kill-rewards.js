/**
 * Kill reward verbs — HOW to grant XP/credits/loot when a mode decides a kill matters.
 * Packages emit combat:enemyKilled; Island rules call these. Never auto-invoke from die().
 */
(function (root) {
    'use strict';

    function resolveWorld(explicit) {
        if (explicit) return explicit;
        if (typeof GameWorld !== 'undefined' && GameWorld.resolveWorld) {
            return GameWorld.resolveWorld();
        }
        return typeof Game !== 'undefined' ? Game : null;
    }

    function isTutorialContext(enemy, world) {
        if (enemy && enemy.isTutorialDummy) return true;
        if (typeof currentRoom !== 'undefined' && currentRoom
            && (currentRoom.type === 'tutorial' || currentRoom.number === 0)) {
            return true;
        }
        return !!(world && world.roomNumber === 0);
    }

    function awardDeathCredits(enemy, world) {
        const w = resolveWorld(world);
        if (!w || (w.isMultiplayerClient && w.isMultiplayerClient())) return;
        if (isTutorialContext(enemy, w)) return;
        if (typeof w.awardRunCredits !== 'function') return;

        const typeName = (enemy.constructor && enemy.constructor.name) || 'Enemy';
        if (typeName === 'OctagonEnemy') {
            w.elitesKilled = (typeof w.elitesKilled === 'number' ? w.elitesKilled : 0) + 1;
        }

        const room = w.roomNumber || 1;
        let amount;
        let reason;
        if (typeof CombatEconomy !== 'undefined' && CombatEconomy.getCreditReward) {
            amount = CombatEconomy.getCreditReward(enemy, room);
            reason = CombatEconomy.getCreditReason
                ? CombatEconomy.getCreditReason(enemy)
                : 'combat';
        } else {
            amount = typeName === 'OctagonEnemy'
                ? (w.ELITE_CREDIT_REWARD || 15)
                : 1;
            reason = typeName === 'OctagonEnemy' ? 'elite' : `trash:${typeName}`;
        }
        if (amount > 0) {
            const mult = (w && w.comboCreditMultiplier > 0) ? w.comboCreditMultiplier : 1;
            const isArena = (typeof GameRunRewards !== 'undefined' && GameRunRewards.isArenaMode)
                ? GameRunRewards.isArenaMode(w)
                : (w && (w.gameMode === 'arena' || w.activeSessionId === 'surge-arena' || (w.modeProfile && w.modeProfile.id === 'surge-arena')));
            const arenaScale = isArena
                ? ((typeof GameRunRewards !== 'undefined' && GameRunRewards.ARENA_CREDIT_SCALE) ? GameRunRewards.ARENA_CREDIT_SCALE : 0.5625)
                : 1;
            w.awardRunCredits(Math.floor(amount * mult * arenaScale), reason);
        }
    }

    function grantItemDrop(enemy, world) {
        const w = resolveWorld(world);
        if (!w || isTutorialContext(enemy, w)) return;
        if (typeof ITEM_DEFINITIONS === 'undefined' || typeof getRandomItem !== 'function') return;

        const dropChances = {
            Enemy: 0.040,
            StarEnemy: 0.050,
            DiamondEnemy: 0.060,
            RectangleEnemy: 0.070,
            OctagonEnemy: 0.200
        };
        const enemyType = (enemy.constructor && enemy.constructor.name) || 'Enemy';
        let baseDropChance = dropChances[enemyType] || 0.040;
        const roomNumber = w.roomNumber || 1;
        const roomScale = Math.max(0.4, 1.0 - (roomNumber - 1) * 0.012);
        const itemsDropped = w.itemsDroppedThisRoom || 0;
        let itemCountScale = 1.0;
        if (itemsDropped >= 2) {
            const excessItems = itemsDropped - 1;
            itemCountScale = Math.max(0.1, 1.0 / (1.0 + excessItems * 0.5));
        }
        let enemyCountScale = 1.0;
        if (typeof currentRoom !== 'undefined' && currentRoom && currentRoom.enemies) {
            const initialEnemyCount = currentRoom.enemies.length;
            if (initialEnemyCount >= 30) {
                const excessEnemies = initialEnemyCount - 30;
                enemyCountScale = Math.max(0.6, 1.0 - (excessEnemies / 30) * 0.4);
            }
        }
        const lootBonus = (w && w.styleLootBonus > 0) ? w.styleLootBonus : 1;
        const finalDropChance = baseDropChance * roomScale * itemCountScale * enemyCountScale * lootBonus;
        if (Math.random() < finalDropChance && typeof spawnItemDrop === 'function') {
            const itemDef = getRandomItem();
            spawnItemDrop(enemy.x, enemy.y, itemDef);
        }

        // Style B+: small heal orbs (relative +25% already in styleLootBonus path uses separate roll).
        maybeSpawnStyleHealOrb(enemy, w);
    }

    function maybeSpawnStyleHealOrb(enemy, world) {
        const w = resolveWorld(world);
        if (!w || !enemy) return;
        if (!(w.styleLootBonus > 1) && !(w.styleEnemyLevel >= 2)) return;
        const base = 0.03;
        const chance = base * (w.styleLootBonus || 1.25);
        if (Math.random() >= chance) return;
        if (!Array.isArray(w.styleHealOrbs)) w.styleHealOrbs = [];
        w.styleHealOrbs.push({
            x: enemy.x + (Math.random() * 20 - 10),
            y: enemy.y + (Math.random() * 20 - 10),
            life: 10,
            radius: 16,
            healFrac: 0.04
        });
    }

    function grantGearDrop(enemy, world, lootDifficulty) {
        if (typeof generateGear === 'undefined' || typeof groundLoot === 'undefined') return;
        if (!enemy || !(enemy.lootChance > 0)) return;
        if (Math.random() >= enemy.lootChance) return;
        const w = resolveWorld(world);
        const roomNum = (w && w.roomNumber) || 1;
        let dropX = enemy.x;
        let dropY = enemy.y;
        if (typeof GameArena !== 'undefined' && GameArena.displaceLootFromWavePad) {
            const moved = GameArena.displaceLootFromWavePad(dropX, dropY, { world: w });
            dropX = moved.x;
            dropY = moved.y;
        }
        const gear = generateGear(dropX, dropY, roomNum, lootDifficulty || 'basic');
        if (gear) {
            groundLoot.push(gear);
        }
    }

    /**
     * Standard trash/elite kill rewards (Gear Mode progression).
     * @param {object} payload - { enemy, world?, lootDifficulty? }
     */
    function grantStandardKill(payload) {
        const enemy = payload && payload.enemy;
        if (!enemy) return;
        const world = resolveWorld(payload.world);
        if (isTutorialContext(enemy, world)) return;

        awardDeathCredits(enemy, world);

        if (world && typeof world.distributeXPToAllPlayers === 'function' && enemy.xpValue) {
            world.distributeXPToAllPlayers(enemy.xpValue);
        }

        grantItemDrop(enemy, world);
        grantGearDrop(enemy, world, payload.lootDifficulty || enemy.lootDifficulty || 'basic');
    }

    /**
     * Boss kill rewards — credits/XP/loot/trophy stay as package verbs modes invoke.
     * Payload may include skipFlags from the boss die path.
     */
    function grantBossKill(payload) {
        const enemy = payload && payload.enemy;
        if (!enemy) return;
        const world = resolveWorld(payload.world);
        if (!world) return;

        if (typeof world.distributeXPToAllPlayers === 'function' && enemy.xpValue) {
            world.distributeXPToAllPlayers(enemy.xpValue);
        }
        // Boss-specific loot remains in BossBase until further peel; modes can
        // call enemy.grantBossLoot?.() if present.
        if (typeof enemy.grantBossLootRewards === 'function') {
            enemy.grantBossLootRewards();
        }
    }

    function isBossEntity(enemy) {
        return !!(enemy && (enemy.isBoss || enemy.bossName
            || (enemy.constructor && /Boss/i.test(enemy.constructor.name))));
    }

    function emitEnemyKilled(enemy, extra) {
        if (typeof GameBus === 'undefined' || !GameBus.emit) return 0;
        const world = resolveWorld(extra && extra.world);

        if (world && enemy && !enemy._countedForKills && !isTutorialContext(enemy, world)) {
            enemy._countedForKills = true;
            world.enemiesKilled = (world.enemiesKilled || 0) + 1;

            const killerId = (extra && extra.killerId) || (enemy && enemy.lastAttacker)
                || (typeof world.getLocalPlayerId === 'function' ? world.getLocalPlayerId() : null);

            const creditedPlayerIds = new Set();
            if (killerId) {
                creditedPlayerIds.add(killerId);
            }
            if (enemy && enemy._damageContributors) {
                Object.keys(enemy._damageContributors).forEach(id => {
                    const pct = enemy._damageContributors[id] / Math.max(1, enemy.maxHp);
                    if (pct >= 0.25) {
                        creditedPlayerIds.add(id);
                    }
                });
            }

            creditedPlayerIds.forEach(playerId => {
                if (typeof world.getPlayerStats === 'function') {
                    const stats = world.getPlayerStats(playerId);
                    if (stats && typeof stats.addStat === 'function') {
                        stats.addStat('kills', 1);
                    }
                }
            });
        }

        return GameBus.emit('combat:enemyKilled', Object.assign({
            enemy,
            world,
            killerId: enemy && enemy.lastAttacker,
            contributors: enemy && enemy._damageContributors ? Object.keys(enemy._damageContributors).map(id => ({
                id,
                damage: enemy._damageContributors[id],
                pct: enemy._damageContributors[id] / Math.max(1, enemy.maxHp)
            })) : [],
            styleTag: (extra && extra.styleTag)
                || (enemy && enemy.lastStyleTag)
                || null,
            lootDifficulty: (extra && extra.lootDifficulty)
                || (enemy && enemy.lootDifficulty)
                || 'basic',
            isBoss: isBossEntity(enemy)
        }, extra || {}));
    }

    /**
     * Discrete hit notification for combo sustain (not DoT ticks).
     * Also emits combat:bossThresholdReached every BOSS_THRESHOLD_FRAC of maxHp lost.
     */
    const BOSS_THRESHOLD_FRAC = 0.10;

    function emitEnemyDamaged(enemy, damage, extra) {
        if (!enemy || !(damage > 0)) return 0;
        if (enemy._damageCause === 'status') return 0;
        if (typeof Game !== 'undefined' && Game.isMultiplayerClient && Game.isMultiplayerClient()) {
            return 0;
        }
        if (typeof GameBus === 'undefined' || !GameBus.emit) return 0;

        const world = resolveWorld(extra && extra.world);
        const isBoss = isBossEntity(enemy);
        const emitted = GameBus.emit('combat:enemyDamaged', Object.assign({
            enemy,
            damage,
            isBoss,
            world,
            killerId: enemy.lastAttacker || null,
            styleTag: (extra && extra.styleTag)
                || enemy.lastStyleTag
                || null
        }, extra || {}));

        if (isBoss && enemy.maxHp > 0) {
            const bucketSize = Math.max(1, enemy.maxHp * BOSS_THRESHOLD_FRAC);
            enemy._comboDamageTaken = (enemy._comboDamageTaken || 0) + damage;
            enemy._comboHpBuckets = enemy._comboHpBuckets || 0;
            const buckets = Math.floor(enemy._comboDamageTaken / bucketSize);
            while (enemy._comboHpBuckets < buckets) {
                enemy._comboHpBuckets += 1;
                GameBus.emit('combat:bossThresholdReached', {
                    enemy,
                    bucket: enemy._comboHpBuckets,
                    thresholdFrac: BOSS_THRESHOLD_FRAC,
                    world
                });
            }
        }
        return emitted;
    }

    root.GameKillRewards = {
        grantStandardKill,
        grantBossKill,
        awardDeathCredits,
        emitEnemyKilled,
        emitEnemyDamaged,
        isBossEntity,
        BOSS_THRESHOLD_FRAC,
        isTutorialContext
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = root.GameKillRewards;
    }
})(typeof globalThis !== 'undefined' ? globalThis : window);
