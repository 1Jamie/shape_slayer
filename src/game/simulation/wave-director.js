/**
 * Escalating Wave Director — Gatekeeper-style spawn budget for Surge Arena.
 * Packages own HOW (threat costs, pacing curves, spawn construction).
 * Modes call beginWave / update(dt) / query isComplete.
 */
(function (root) {
    'use strict';

    const THREAT = Object.freeze({
        basic: 10,
        star: 14,
        diamond: 18,
        rectangle: 22,
        octagon: 38
    });
    const MIN_THREAT = THREAT.basic;
    const ARENA_AGGRO_RANGE = 99999;

    function resolveWorld(explicit) {
        if (explicit) return explicit;
        if (typeof GameWorld !== 'undefined' && GameWorld.resolveWorld) {
            return GameWorld.resolveWorld();
        }
        return typeof Game !== 'undefined' ? Game : null;
    }

    function resolveRoom(world) {
        if (typeof currentRoom !== 'undefined' && currentRoom) return currentRoom;
        if (world && world.currentRoom) return world.currentRoom;
        if (typeof window !== 'undefined') return window.currentRoom || null;
        return null;
    }

    function countAlive(world, room) {
        // Prefer room list (persistent across Game.enemies culls of corpses).
        const list = (room && room.enemies)
            || (world && world.enemies)
            || [];
        let n = 0;
        for (let i = 0; i < list.length; i++) {
            if (list[i] && list[i].alive) n++;
        }
        return n;
    }

    function computeMaxActive(wave) {
        // Keep the field dense as waves escalate — old cap (22) emptied too fast for late budgets.
        return Math.min(36, 8 + Math.floor(Math.max(1, wave) * 1.15));
    }

    /**
     * Within-wave mix among Modes-supplied allowed tiers only.
     * Unlock gating lives in Island Rules (XP thresholds), not here.
     */
    const _pickTierWeights = { basic: 0, star: 0, diamond: 0, rectangle: 0, octagon: 0 };

    function pickTier(allowedEnemyTiers, progress) {
        const p = Math.max(0, Math.min(1, progress));
        const allowed = Array.isArray(allowedEnemyTiers) && allowedEnemyTiers.length
            ? allowedEnemyTiers
            : ['basic'];

        let hasBasic = false, hasStar = false, hasDiamond = false, hasRectangle = false, hasOctagon = false;
        for (let i = 0; i < allowed.length; i++) {
            const id = allowed[i];
            if (id === 'basic') hasBasic = true;
            else if (id === 'star') hasStar = true;
            else if (id === 'diamond') hasDiamond = true;
            else if (id === 'rectangle') hasRectangle = true;
            else if (id === 'octagon') hasOctagon = true;
        }

        _pickTierWeights.basic = hasBasic ? Math.max(0.18, 0.52 - p * 0.28) : 0;
        _pickTierWeights.star = hasStar ? (0.20 + p * 0.1) : 0;
        _pickTierWeights.diamond = hasDiamond ? Math.max(0.04, p * 0.32) : 0;
        _pickTierWeights.rectangle = hasRectangle ? Math.max(0.03, Math.max(0, p - 0.12) * 0.38) : 0;
        _pickTierWeights.octagon = hasOctagon ? Math.max(0.03, Math.max(0, p - 0.3) * 0.32) : 0;

        return _pickTierWeights;
    }

    function cheapestFitting(rem, allowedEnemyTiers) {
        const order = ['basic', 'star', 'diamond', 'rectangle', 'octagon'];
        const allowed = Array.isArray(allowedEnemyTiers) && allowedEnemyTiers.length
            ? allowedEnemyTiers
            : order;

        let best = null;
        for (let i = 0; i < order.length; i++) {
            const tier = order[i];
            if (allowed.indexOf(tier) < 0) continue;
            const cost = THREAT[tier];
            if (cost <= rem) best = tier;
        }
        return best;
    }

    function rollTier(weights) {
        const wBasic = Math.max(0, weights.basic || 0);
        const wStar = Math.max(0, weights.star || 0);
        const wDiamond = Math.max(0, weights.diamond || 0);
        const wRectangle = Math.max(0, weights.rectangle || 0);
        const wOctagon = Math.max(0, weights.octagon || 0);
        const sum = wBasic + wStar + wDiamond + wRectangle + wOctagon;
        if (sum <= 0) return 'basic';

        let r = Math.random() * sum;
        if ((r -= wBasic) <= 0) return 'basic';
        if ((r -= wStar) <= 0) return 'star';
        if ((r -= wDiamond) <= 0) return 'diamond';
        if ((r -= wRectangle) <= 0) return 'rectangle';
        if ((r -= wOctagon) <= 0) return 'octagon';
        return 'basic';
    }

    /**
     * Convert threat budget into a concrete spawn queue so remaining enemies
     * are countable and leftover points cannot stall the wave.
     * @param {number} budget
     * @param {string[]} allowedEnemyTiers
     */
    function buildSpawnQueue(budget, allowedEnemyTiers) {
        const allowed = Array.isArray(allowedEnemyTiers) && allowedEnemyTiers.length
            ? allowedEnemyTiers
            : ['basic'];
        const minAllowed = allowed.reduce((min, tier) => {
            const cost = THREAT[tier] || MIN_THREAT;
            return cost < min ? cost : min;
        }, Infinity);

        const queue = [];
        let rem = Math.max(0, budget | 0);
        const total = Math.max(1, rem);
        while (rem >= minAllowed) {
            const progress = 1 - (rem / total);
            let tier = rollTier(pickTier(allowed, progress));
            let cost = THREAT[tier] || MIN_THREAT;
            if (cost > rem) {
                tier = cheapestFitting(rem, allowed);
                if (!tier) break;
                cost = THREAT[tier];
            }
            queue.push(tier);
            rem -= cost;
        }
        return queue;
    }

    function activateArenaEnemy(enemy, world) {
        if (!enemy) return;
        enemy.detectionRange = ARENA_AGGRO_RANGE;
        enemy.activated = true;
        enemy.arenaFullAgro = true;
        if (enemy.state === 'standby') {
            if (enemy.shape === 'diamond') enemy.state = 'circle';
            else enemy.state = 'chase';
        }
        if (!enemy.currentTarget && world) {
            if (typeof enemy.assignInitialTarget === 'function') {
                enemy.assignInitialTarget();
            } else if (typeof world.getLocalPlayerId === 'function') {
                enemy.currentTarget = world.getLocalPlayerId();
            } else if (world.player) {
                enemy.currentTarget = 'local';
            }
        }
    }

    function constructEnemy(tier, x, y, wave, world) {
        let enemy = null;
        if (tier === 'star' && typeof StarEnemy !== 'undefined') enemy = new StarEnemy(x, y);
        else if (tier === 'diamond' && typeof DiamondEnemy !== 'undefined') enemy = new DiamondEnemy(x, y);
        else if (tier === 'rectangle' && typeof RectangleEnemy !== 'undefined') enemy = new RectangleEnemy(x, y);
        else if (tier === 'octagon' && typeof OctagonEnemy !== 'undefined') enemy = new OctagonEnemy(x, y);
        else if (typeof Enemy !== 'undefined') enemy = new Enemy(x, y);
        else if (typeof CircleEnemy !== 'undefined') enemy = new CircleEnemy(x, y);
        if (!enemy) return null;

        if (typeof CombatScaling !== 'undefined' && CombatScaling.createContext) {
            const modeId = (world && (world.activeSessionId || world.modeId || world.gameMode)) || 'surge-arena';
            const ctx = CombatScaling.createContext({
                roomNumber: wave,
                roomType: 'normal',
                gameMode: modeId,
                enemyHpMod: 1,
                enemySpeedMod: 1
            });
            ctx._factors = CombatScaling.computeScalingFactors(ctx);
            if (CombatScaling.applyEnemyScaling) {
                CombatScaling.applyEnemyScaling(
                    enemy,
                    CombatScaling.getEnemyProfileIdForInstance
                        ? CombatScaling.getEnemyProfileIdForInstance(enemy)
                        : 'basic',
                    ctx
                );
            }
        }

        const biomeId = (typeof currentRoom !== 'undefined' && currentRoom && currentRoom.biomeId)
            || 'swarm';
        if (typeof BiomeEnemyMods !== 'undefined' && BiomeEnemyMods.apply) {
            BiomeEnemyMods.apply(enemy, biomeId);
        }
        if (typeof EliteEnemyAffixes !== 'undefined' && EliteEnemyAffixes.applyEliteAffix) {
            EliteEnemyAffixes.applyEliteAffix(enemy, biomeId, wave);
        }
        if (typeof Game !== 'undefined' && Game.styleEliteBonusAffix
            && typeof EliteEnemyAffixes !== 'undefined' && EliteEnemyAffixes.forceEliteAffix) {
            EliteEnemyAffixes.forceEliteAffix(enemy, biomeId, { styleTemp: true });
        }
        if (enemy.hasShield) {
            enemy.maxShieldHealth = Math.floor(enemy.maxHp * 0.5);
            enemy.shieldHealth = enemy.maxShieldHealth;
        }
        enemy.arenaThreatCost = THREAT[tier] || THREAT.basic;
        activateArenaEnemy(enemy, world);
        return enemy;
    }

    /**
     * @param {number} wave
     * @param {{ spawnBudget?: number, allowedEnemyTiers?: string[] }} [options]
     * Modes supply spawnBudget + allowedEnemyTiers; Director only spends them.
     */
    function createDirectorState(wave, options) {
        const opts = options || {};
        const budget = opts.spawnBudget != null
            ? Math.max(0, opts.spawnBudget | 0)
            : 70;
        const allowed = Array.isArray(opts.allowedEnemyTiers) && opts.allowedEnemyTiers.length
            ? opts.allowedEnemyTiers.slice()
            : ['basic'];
        const pending = buildSpawnQueue(budget, allowed);
        return {
            wave: Math.max(1, wave || 1),
            budgetTotal: budget,
            budgetRemaining: 0,
            budgetSpent: budget,
            allowedEnemyTiers: allowed,
            pending,
            pendingIndex: 0,
            enemiesPlanned: pending.length,
            maxActive: computeMaxActive(wave),
            baseMaxActive: computeMaxActive(wave),
            styleSpawnFloor: null,
            spawnTimer: 0.2,
            active: true,
            complete: false,
            pausedForCap: false,
            spawnFailStreak: 0
        };
    }

    function attachDirector(world, wave, options) {
        const w = resolveWorld(world);
        if (!w) return null;
        w.waveDirector = createDirectorState(wave, options);
        w.arenaSpawnBudgetRemaining = 0;
        return w.waveDirector;
    }

    function stopDirector(world) {
        const w = resolveWorld(world);
        if (!w) return;
        if (w.waveDirector) {
            w.waveDirector.active = false;
            w.waveDirector.pending = [];
            w.waveDirector.pendingIndex = 0;
        }
        w.arenaSpawnBudgetRemaining = 0;
    }

    function isBudgetExhausted(world) {
        const w = resolveWorld(world);
        const dir = w && w.waveDirector;
        if (!dir || !dir.pending) return true;
        return (dir.pendingIndex || 0) >= dir.pending.length;
    }

    function isComplete(world) {
        const w = resolveWorld(world);
        if (!w || !w.waveDirector) return false;
        return !!w.waveDirector.complete;
    }

    function getEnemiesRemaining(world) {
        const w = resolveWorld(world);
        if (!w || !w.waveDirector) return 0;
        const room = resolveRoom(w);
        const dir = w.waveDirector;
        const pendingCount = dir.pending ? Math.max(0, dir.pending.length - (dir.pendingIndex || 0)) : 0;
        return countAlive(w, room) + pendingCount;
    }

    function isInLockedMachineBay(room, x, y, pad) {
        if (!room || room.machinesAccessible) return false;
        const bay = room.machineBay;
        if (!bay) return false;
        const p = pad != null ? pad : 12;
        return x >= bay.x - p
            && x <= bay.x + bay.w + p
            && y >= bay.y - p
            && y <= bay.y + bay.h + p;
    }

    function isWalkableAt(layout, x, y, radius, room) {
        if (room && isInLockedMachineBay(room, x, y, (radius || 28) + 8)) {
            return false;
        }
        if (!layout || typeof RoomLayoutGenerator === 'undefined' || !RoomLayoutGenerator.isPointWalkable) {
            return true;
        }
        return RoomLayoutGenerator.isPointWalkable(layout, x, y, radius || 28);
    }

    function fallbackSpawnPoints(room) {
        const floor = room && room.arenaFloor;
        const width = (room && room.width) || 1280;
        const height = (room && room.height) || 720;
        const cx = floor ? floor.x : width * 0.5;
        const cy = floor ? floor.y : height * 0.55;
        const rx = floor ? floor.w * 0.35 : Math.min(width, height) * 0.28;
        const ry = floor ? floor.h * 0.35 : Math.min(width, height) * 0.22;
        return [
            { x: cx + rx, y: cy },
            { x: cx - rx, y: cy },
            { x: cx, y: cy + ry },
            { x: cx, y: cy - ry },
            { x: cx + rx * 0.7, y: cy + ry * 0.7 },
            { x: cx - rx * 0.7, y: cy + ry * 0.7 },
            { x: cx + rx * 0.7, y: cy - ry * 0.7 },
            { x: cx - rx * 0.7, y: cy - ry * 0.7 },
            { x: cx, y: cy }
        ];
    }

    function querySpawnPoint(world, room, avoidExtra) {
        const layout = room && room.layout;
        const width = (room && room.width) || (layout && layout.width) || 1280;
        const height = (room && room.height) || (layout && layout.height) || 720;
        const player = world && world.player;
        const avoid = [];
        if (player) {
            avoid.push({ x: player.x, y: player.y, distance: 220 });
        }
        if (room && room.machineBay && !room.machinesAccessible) {
            const b = room.machineBay;
            // Circle covering the bay AABB (half-diagonal + margin) — Director only does circles.
            const cover = Math.hypot(b.w * 0.5, b.h * 0.5) + 80;
            avoid.push({
                x: b.x + b.w * 0.5,
                y: b.y + b.h * 0.5,
                distance: cover
            });
        }
        if (Array.isArray(avoidExtra)) {
            for (let i = 0; i < avoidExtra.length; i++) avoid.push(avoidExtra[i]);
        }

        const Director = (typeof Engine !== 'undefined' && Engine.Director) ? Engine.Director : null;
        const floor = room && room.arenaFloor;
        const preferRing = floor
            ? { x: floor.x, y: floor.y, radius: Math.min(floor.w, floor.h) * 0.32 }
            : { x: width * 0.5, y: height * 0.55, radius: Math.min(width, height) * 0.3 };

        const walkable = (x, y, r) => isWalkableAt(layout, x, y, r, room);

        if (Director && Director.findSpawnPoint) {
            const pt = Director.findSpawnPoint({
                width,
                height,
                margin: 100,
                radius: 30,
                isWalkable: walkable,
                avoid,
                preferRing,
                maxAttempts: 40
            });
            if (pt && walkable(pt.x, pt.y, 28) && !isInLockedMachineBay(room, pt.x, pt.y, 20)) {
                return pt;
            }
        }

        // Guaranteed-ish fallbacks on the fighting floor so empty fields cannot soft-lock.
        const fallbacks = fallbackSpawnPoints(room);
        for (let i = 0; i < fallbacks.length; i++) {
            const f = fallbacks[i];
            if (!walkable(f.x, f.y, 28)) continue;
            if (isInLockedMachineBay(room, f.x, f.y, 20)) continue;
            if (player) {
                const dx = f.x - player.x;
                const dy = f.y - player.y;
                if (dx * dx + dy * dy < 140 * 140) continue;
            }
            return f;
        }
        for (let i = 0; i < fallbacks.length; i++) {
            if (walkable(fallbacks[i].x, fallbacks[i].y, 20)
                && !isInLockedMachineBay(room, fallbacks[i].x, fallbacks[i].y, 12)) {
                return fallbacks[i];
            }
        }
        return fallbacks[fallbacks.length - 1] || null;
    }

    function spawnOne(world, room, tier) {
        const dir = world.waveDirector;
        if (!dir) return false;

        const pt = querySpawnPoint(world, room);
        if (!pt) {
            dir.spawnFailStreak = (dir.spawnFailStreak || 0) + 1;
            return false;
        }

        const enemy = constructEnemy(tier, pt.x, pt.y, dir.wave, world);
        if (!enemy) {
            dir.spawnFailStreak = (dir.spawnFailStreak || 0) + 1;
            return false;
        }

        if (!room.enemies) room.enemies = [];
        if (!world.enemies) world.enemies = room.enemies;
        room.enemies.push(enemy);
        if (world.enemies !== room.enemies) {
            world.enemies.push(enemy);
        }

        dir.spawnFailStreak = 0;
        return true;
    }

    function markComplete(world, dir) {
        dir.complete = true;
        dir.active = false;
        dir.pending = [];
        world.arenaSpawnBudgetRemaining = 0;
        return true;
    }

    /**
     * Tick the director. Returns true when the wave just completed
     * (spawn queue empty + 0 alive).
     */
    function update(world, dt) {
        const w = resolveWorld(world);
        if (!w || !w.waveDirector || !w.waveDirector.active || w.waveDirector.complete) return false;
        if (w.arenaPhase && w.arenaPhase !== 'combat') return false;
        if (w.arenaWavePhase === 'boss') return false;

        const room = resolveRoom(w);
        if (!room) return false;

        // Cull any unit that slipped into the sealed machine bay (spawn race / soft lock).
        if (room.machineBay && !room.machinesAccessible && Array.isArray(room.enemies)) {
            for (let i = 0; i < room.enemies.length; i++) {
                const e = room.enemies[i];
                if (!e || e.alive === false) continue;
                if (isInLockedMachineBay(room, e.x, e.y, 4)) {
                    e.alive = false;
                    e.hp = 0;
                }
            }
        }

        const dir = w.waveDirector;
        if (!Array.isArray(dir.pending)) dir.pending = [];

        let pIndex = dir.pendingIndex || 0;
        let alive = countAlive(w, room);
        const pendingCount = Math.max(0, dir.pending.length - pIndex);
        const progress = dir.enemiesPlanned > 0
            ? 1 - (pendingCount / dir.enemiesPlanned)
            : 1;

        if (pendingCount > 0 && alive >= dir.maxActive) {
            dir.pausedForCap = true;
        } else {
            dir.pausedForCap = false;
        }

        if (pendingCount > 0 && !dir.pausedForCap) {
            dir.spawnTimer -= Math.max(0, dt || 0);
            if (dir.spawnTimer <= 0) {
                let cluster = 1;
                if (progress > 0.2) cluster = 2;
                if (progress > 0.45) cluster = 2 + (Math.random() < 0.55 ? 1 : 0);
                if (progress > 0.7) cluster = 3 + (Math.random() < 0.5 ? 1 : 0);
                // Higher waves dump denser packs so long queues don't trickle forever.
                if (dir.wave >= 10 && progress > 0.35) {
                    cluster = Math.max(cluster, 3);
                }
                if (dir.wave >= 16 && progress > 0.5) {
                    cluster = Math.max(cluster, 4);
                }
                cluster = Math.min(cluster, Math.max(1, dir.maxActive - alive), pendingCount);

                let spawned = 0;
                for (let i = 0; i < cluster; i++) {
                    if (pIndex >= dir.pending.length) break;
                    if (alive >= dir.maxActive) break;
                    const tier = dir.pending[pIndex];
                    if (spawnOne(w, room, tier)) {
                        pIndex++;
                        alive++;
                        spawned++;
                    } else {
                        break;
                    }
                }
                dir.pendingIndex = pIndex;

                // Soft-lock breaker: field empty, queue stuck → drop units / force complete.
                if (spawned === 0 && (dir.pending.length - pIndex) > 0 && alive === 0) {
                    if (dir.spawnFailStreak >= 6) {
                        dir.pending.length = 0;
                        dir.pendingIndex = 0;
                        pIndex = 0;
                    } else if (dir.spawnFailStreak >= 3) {
                        pIndex++;
                        dir.pendingIndex = pIndex;
                    }
                }

                const base = 1.45 - progress * 0.85;
                const waveTighten = Math.min(0.35, dir.wave * 0.012);
                const floor = (typeof dir.styleSpawnFloor === 'number')
                    ? dir.styleSpawnFloor
                    : Math.max(0.22, 0.34 - Math.min(0.1, dir.wave * 0.004));
                dir.spawnTimer = Math.max(floor, base - waveTighten);
            }
        }

        if ((dir.pending.length - (dir.pendingIndex || 0)) <= 0 && alive === 0) {
            return markComplete(w, dir);
        }
        return false;
    }

    root.WaveDirector = {
        THREAT,
        computeMaxActive,
        pickTier,
        attachDirector,
        stopDirector,
        isBudgetExhausted,
        isComplete,
        getEnemiesRemaining,
        update,
        querySpawnPoint,
        isInLockedMachineBay,
        createDirectorState,
        buildSpawnQueue,
        activateArenaEnemy
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = root.WaveDirector;
    }
})(typeof globalThis !== 'undefined' ? globalThis : window);
