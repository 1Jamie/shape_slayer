// Biome-driven modulation of the five base enemy classes (0.8.2)
// Tunable tables - apply after spawn + CombatScaling.
(function (global) {
    const ECHO_POOL_SIZE = 48;
    const echoHitboxPool = [];
    const activeEchoes = [];
    let nextEchoId = 1;

    function acquireEcho() {
        const echo = echoHitboxPool.length > 0 ? echoHitboxPool.pop() : {
            active: false,
            id: null,
            x: 0,
            y: 0,
            radius: 20,
            damage: 0,
            lifetime: 0,
            elapsed: 0,
            vx: 0,
            vy: 0,
            alpha: 1,
            attackerId: null,
            color: '#ff66ff',
            displayOnly: false
        };
        echo.active = true;
        echo.displayOnly = false;
        if (!echo.id) {
            echo.id = `echo-${Date.now()}-${nextEchoId++}`;
        }
        return echo;
    }

    function releaseEcho(echo) {
        echo.active = false;
        echo.displayOnly = false;
        echo.id = null;
        if (echoHitboxPool.length < ECHO_POOL_SIZE) {
            echoHitboxPool.push(echo);
        }
    }

    const BIOME_ENEMY_MODS = {
        swarm: {
            separationMult: 0.75,
            moveSpeedMult: 1.06,
            attackCooldownMult: 0.92,
            flags: { packPressure: true }
        },
        prism: {
            projectileSpreadMult: 1.35,
            volleyChanceBonus: 0.12,
            telegraphColorBias: '#88aaff',
            flags: { widerVolley: true }
        },
        fortress: {
            maxHpMult: 1.12,
            telegraphDurationMult: 1.18,
            attackDamageMult: 1.08,
            flags: { braced: true }
        },
        fractal: {
            flags: { echoOnHit: true, echoOnDeath: true },
            echoDamageMult: 0.35,
            echoDelay: 0.28,
            echoLifetime: 0.35,
            echoRadiusMult: 1.0
        },
        vortex: {
            flags: { pullDuringTelegraph: true, aggressiveTrack: true },
            pullStrength: 180,
            pullRadius: 220,
            projectileSpeedMult: 1.08
        },
        endless: {
            // Mild mix of prior biomes
            moveSpeedMult: 1.03,
            maxHpMult: 1.05,
            flags: { echoOnHit: true, pullDuringTelegraph: true },
            echoDamageMult: 0.25,
            echoDelay: 0.32,
            pullStrength: 120,
            pullRadius: 180
        }
    };

    function apply(enemy, biomeId) {
        if (!enemy || !biomeId) return enemy;
        const mods = BIOME_ENEMY_MODS[biomeId] || BIOME_ENEMY_MODS.endless;
        enemy.biomeId = biomeId;
        enemy.biomeMods = mods;
        enemy.biomeFlags = Object.assign({}, mods.flags || {});

        if (mods.moveSpeedMult && enemy.moveSpeed) {
            enemy.moveSpeed *= mods.moveSpeedMult;
            if (enemy.baseMoveSpeed) enemy.baseMoveSpeed *= mods.moveSpeedMult;
        }
        if (mods.maxHpMult && enemy.maxHp) {
            enemy.maxHp = Math.round(enemy.maxHp * mods.maxHpMult);
            enemy.hp = enemy.maxHp;
        }
        if (mods.attackCooldownMult && enemy.attackCooldownTime) {
            enemy.attackCooldownTime *= mods.attackCooldownMult;
        }
        if (mods.telegraphDurationMult) {
            if (enemy.telegraphDuration) enemy.telegraphDuration *= mods.telegraphDurationMult;
            if (enemy.chargeDuration) enemy.chargeDuration *= mods.telegraphDurationMult;
        }
        if (mods.attackDamageMult && enemy.damage) {
            enemy.damage *= mods.attackDamageMult;
        }
        if (mods.separationMult != null) {
            enemy.biomeSeparationMult = mods.separationMult;
        }
        if (mods.projectileSpreadMult) {
            enemy.biomeProjectileSpreadMult = mods.projectileSpreadMult;
        }
        if (mods.projectileSpeedMult) {
            enemy.biomeProjectileSpeedMult = mods.projectileSpeedMult;
        }
        if (mods.pullStrength) {
            enemy.biomePullStrength = mods.pullStrength;
            enemy.biomePullRadius = mods.pullRadius || 200;
        }
        if (mods.echoDamageMult) {
            enemy.biomeEchoDamageMult = mods.echoDamageMult;
            enemy.biomeEchoDelay = mods.echoDelay || 0.3;
            enemy.biomeEchoLifetime = mods.echoLifetime || 0.35;
        }
        return enemy;
    }

    function spawnEchoHitbox(sourceEnemy, options = {}) {
        if (!sourceEnemy) return null;
        const echo = acquireEcho();
        const angle = options.angle != null ? options.angle : (sourceEnemy.rotation || 0);
        const dist = options.distance != null ? options.distance : (sourceEnemy.size || 20) * 1.2;
        echo.x = (options.x != null ? options.x : sourceEnemy.x) + Math.cos(angle) * dist;
        echo.y = (options.y != null ? options.y : sourceEnemy.y) + Math.sin(angle) * dist;
        echo.radius = (sourceEnemy.size || 20) * (sourceEnemy.biomeMods && sourceEnemy.biomeMods.echoRadiusMult || 1);
        echo.damage = (sourceEnemy.damage || 5) * (sourceEnemy.biomeEchoDamageMult || 0.35);
        echo.lifetime = sourceEnemy.biomeEchoLifetime || 0.35;
        echo.elapsed = 0;
        echo.vx = Math.cos(angle) * 40;
        echo.vy = Math.sin(angle) * 40;
        echo.alpha = 0.85;
        echo.color = '#ff66ff';
        echo.attackerId = null;
        activeEchoes.push(echo);
        return echo;
    }

    function scheduleEcho(sourceEnemy, delaySec, options) {
        if (!sourceEnemy || !sourceEnemy.biomeFlags) return;
        if (!sourceEnemy.biomeFlags.echoOnHit && !sourceEnemy.biomeFlags.echoOnDeath) return;

        const opts = options || {};
        const force = !!opts.force;

        // Prevent echo storms from multi-hit / DoT / Parallel (one pending echo per enemy)
        const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
        if (!force && sourceEnemy._lastEchoScheduleAt && (now - sourceEnemy._lastEchoScheduleAt) < 280) {
            return;
        }
        if (!global._pendingBiomeEchoes) global._pendingBiomeEchoes = [];
        if (!force && global._pendingBiomeEchoes.length >= 24) return; // hard cap
        const eid = sourceEnemy.id;
        if (!force && eid != null && global._pendingBiomeEchoes.some(p => p.enemyId === eid)) {
            return;
        }
        // Death echo: replace any pending on-hit echo for this enemy
        if (force && eid != null) {
            for (let i = global._pendingBiomeEchoes.length - 1; i >= 0; i--) {
                if (global._pendingBiomeEchoes[i].enemyId === eid) {
                    global._pendingBiomeEchoes.splice(i, 1);
                }
            }
        }
        sourceEnemy._lastEchoScheduleAt = now;

        const delay = delaySec != null ? delaySec : (sourceEnemy.biomeEchoDelay || 0.28);
        global._pendingBiomeEchoes.push({
            delay,
            elapsed: 0,
            enemyId: eid,
            enemyRef: sourceEnemy,
            x: sourceEnemy.x,
            y: sourceEnemy.y,
            rotation: sourceEnemy.rotation || 0,
            damage: (sourceEnemy.damage || 5) * (sourceEnemy.biomeEchoDamageMult || 0.35),
            size: sourceEnemy.size || 20,
            lifetime: sourceEnemy.biomeEchoLifetime || 0.35,
            options: opts
        });
    }

    function updateEchoes(deltaTime, players) {
        if (global._pendingBiomeEchoes && global._pendingBiomeEchoes.length) {
            for (let i = global._pendingBiomeEchoes.length - 1; i >= 0; i--) {
                const pending = global._pendingBiomeEchoes[i];
                pending.elapsed += deltaTime;
                if (pending.elapsed >= pending.delay) {
                    const echo = acquireEcho();
                    echo.x = pending.x + Math.cos(pending.rotation) * pending.size * 1.2;
                    echo.y = pending.y + Math.sin(pending.rotation) * pending.size * 1.2;
                    echo.radius = pending.size;
                    echo.damage = pending.damage;
                    echo.lifetime = pending.lifetime;
                    echo.elapsed = 0;
                    echo.vx = Math.cos(pending.rotation) * 50;
                    echo.vy = Math.sin(pending.rotation) * 50;
                    echo.alpha = 0.8;
                    echo.color = '#ff66ff';
                    activeEchoes.push(echo);
                    global._pendingBiomeEchoes.splice(i, 1);
                }
            }
        }

        for (let i = activeEchoes.length - 1; i >= 0; i--) {
            const echo = activeEchoes[i];
            echo.elapsed += deltaTime;
            echo.x += echo.vx * deltaTime;
            echo.y += echo.vy * deltaTime;
            echo.alpha = Math.max(0, 0.85 * (1 - echo.elapsed / echo.lifetime));

            if (players && !echo.displayOnly) {
                const list = players instanceof Map ? Array.from(players.values()) : (Array.isArray(players) ? players : [players]);
                list.forEach(p => {
                    if (!p || p.dead || p.invulnerable || p.isDodging) return;
                    const dx = p.x - echo.x;
                    const dy = p.y - echo.y;
                    const r = (p.size || 20) + echo.radius;
                    if (dx * dx + dy * dy < r * r) {
                        if (typeof p.takeDamage === 'function') {
                            p.takeDamage(echo.damage, null);
                        }
                        echo.elapsed = echo.lifetime; // consume
                    }
                });
            }

            if (echo.elapsed >= echo.lifetime) {
                activeEchoes.splice(i, 1);
                releaseEcho(echo);
            }
        }
    }

    function serializeEchoes() {
        return activeEchoes.map(echo => ({
            id: echo.id,
            x: echo.x,
            y: echo.y,
            radius: echo.radius,
            lifetime: echo.lifetime,
            elapsed: echo.elapsed,
            vx: echo.vx,
            vy: echo.vy,
            alpha: echo.alpha,
            color: echo.color || '#ff66ff'
        }));
    }

    function applyEchoesFromHost(list) {
        // Release current display echoes, then rebuild from host snapshot
        while (activeEchoes.length > 0) {
            releaseEcho(activeEchoes.pop());
        }
        if (!Array.isArray(list) || list.length === 0) return;
        for (let i = 0; i < list.length; i++) {
            const data = list[i];
            if (!data) continue;
            const echo = acquireEcho();
            echo.id = data.id || echo.id;
            echo.x = data.x || 0;
            echo.y = data.y || 0;
            echo.radius = data.radius || 20;
            echo.lifetime = data.lifetime || 0.35;
            echo.elapsed = data.elapsed || 0;
            echo.vx = data.vx || 0;
            echo.vy = data.vy || 0;
            echo.alpha = data.alpha != null ? data.alpha : 0.85;
            echo.color = data.color || '#ff66ff';
            echo.damage = 0;
            echo.displayOnly = true;
            activeEchoes.push(echo);
        }
    }

    function renderEchoes(ctx) {
        if (!ctx) return;
        activeEchoes.forEach(echo => {
            ctx.save();
            ctx.globalAlpha = echo.alpha;
            ctx.strokeStyle = echo.color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(echo.x, echo.y, echo.radius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        });
    }

    function applyVortexPullToPlayers(enemy, players, deltaTime) {
        if (!enemy || !enemy.biomeFlags || !enemy.biomeFlags.pullDuringTelegraph) return;
        if (!enemy.activeTelegraph && enemy.state !== 'telegraph') return;

        // Surge Arena packs dozens of aggro'd trash: every telegraph pull stacks into
        // "random force while I swing." Keep the suck for Gear vortex rooms only.
        if (typeof currentRoom !== 'undefined' && currentRoom
            && (currentRoom.archetype === 'surgeArena' || currentRoom.isArenaComplex)) {
            return;
        }

        // Arena: enemies sealed in the machine bay must not yank the player through the gate.
        if (typeof currentRoom !== 'undefined' && currentRoom
            && currentRoom.machineBay && !currentRoom.machinesAccessible) {
            const b = currentRoom.machineBay;
            if (enemy.x >= b.x && enemy.x <= b.x + b.w && enemy.y >= b.y && enemy.y <= b.y + b.h) {
                return;
            }
        }

        const strength = enemy.biomePullStrength || 160;
        const radius = enemy.biomePullRadius || 200;
        const list = players instanceof Map ? Array.from(players.values()) : (Array.isArray(players) ? players : [players]);
        list.forEach(p => {
            if (!p || p.dead || typeof p.applyPullForce !== 'function') return;
            p.applyPullForce(enemy.x, enemy.y, strength * (deltaTime || 0.016) * 60, radius);
        });
    }

    global.BiomeEnemyMods = {
        definitions: BIOME_ENEMY_MODS,
        apply,
        scheduleEcho,
        spawnEchoHitbox,
        updateEchoes,
        serializeEchoes,
        applyEchoesFromHost,
        renderEchoes,
        applyVortexPullToPlayers,
        clearEchoes() {
            if (global._pendingBiomeEchoes) global._pendingBiomeEchoes.length = 0;
            while (activeEchoes.length > 0) {
                releaseEcho(activeEchoes.pop());
            }
        }
    };
})(typeof window !== 'undefined' ? window : globalThis);
