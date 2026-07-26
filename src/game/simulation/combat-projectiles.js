/**
 * Combat projectile sim — extracted from Game world piece for package consumption.
 * Methods expect `this` to be a world with projectiles/enemies/player (Game or session).
 */
const GameCombatProjectiles = {
    releasePooledProjectile(projectile) {
        if (!projectile || !projectile._fromProjectilePool) return;
        if (!this._projectilePool) this._projectilePool = [];
        this._projectilePool.push(projectile);
    },

    acquireProjectile(spec) {
        const pool = this._projectilePool || (this._projectilePool = []);
        const projectile = pool.pop() || {};
        Object.assign(projectile, spec);
        projectile._fromProjectilePool = true;
        return projectile;
    },

    // Update projectiles
    updateProjectiles(deltaTime) {
        const isMultiplayerClient = this.multiplayerEnabled &&
            typeof multiplayerManager !== 'undefined' &&
            multiplayerManager &&
            !multiplayerManager.isHost;

        const projectiles = this.projectiles;
        const roomWidth = (typeof currentRoom !== 'undefined' && currentRoom) ? currentRoom.width : 2400;
        const roomHeight = (typeof currentRoom !== 'undefined' && currentRoom) ? currentRoom.height : 1350;
        let writeIndex = 0;

        for (let readIndex = 0; readIndex < projectiles.length; readIndex++) {
            const projectile = projectiles[readIndex];
            const previousX = projectile.x;
            const previousY = projectile.y;
            let keep = true;

            // Parallel twin: stay dormant until activateAfter elapses
            if (projectile.activateAfter != null && projectile.activateAfter > 0) {
                projectile.activateAfter -= deltaTime;
                if (writeIndex !== readIndex) projectiles[writeIndex] = projectile;
                writeIndex++;
                continue;
            }

            if (projectile.waveAmplitude && projectile.baseAngle !== undefined) {
                projectile.waveClock = (projectile.waveClock || 0) + deltaTime;
                const baseSpeed = projectile.baseSpeed || Math.sqrt(projectile.vx * projectile.vx + projectile.vy * projectile.vy) || 1;
                const wave = Math.sin(projectile.waveClock * (projectile.waveFrequency || 7) + (projectile.wavePhase || 0)) * projectile.waveAmplitude;
                const forwardX = Math.cos(projectile.baseAngle);
                const forwardY = Math.sin(projectile.baseAngle);
                const perpX = -forwardY;
                const perpY = forwardX;
                projectile.vx = forwardX * baseSpeed + perpX * wave;
                projectile.vy = forwardY * baseSpeed + perpY * wave;
            }

            if (isMultiplayerClient && projectile.id) {
                projectile.x += projectile.vx * deltaTime;
                projectile.y += projectile.vy * deltaTime;

                if (projectile.targetX !== undefined && projectile.targetY !== undefined) {
                    const dx = projectile.targetX - projectile.x;
                    const dy = projectile.targetY - projectile.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    const projectileSnapDistance = MultiplayerConfig.SNAP_DISTANCE * 3;

                    if (distance > projectileSnapDistance) {
                        projectile.x = projectile.targetX;
                        projectile.y = projectile.targetY;
                    } else if (distance > 15) {
                        const correctionSpeed = MultiplayerConfig.BASE_LERP_SPEED * 0.15;
                        const t = Math.min(1, deltaTime * correctionSpeed);
                        projectile.x += dx * t;
                        projectile.y += dy * t;
                    }
                }
            } else if (isMultiplayerClient && projectile.targetX !== undefined && projectile.targetY !== undefined) {
                projectile.x += projectile.vx * deltaTime;
                projectile.y += projectile.vy * deltaTime;

                const dx = projectile.targetX - projectile.x;
                const dy = projectile.targetY - projectile.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const projectileSnapDistance = MultiplayerConfig.SNAP_DISTANCE * 2;

                if (distance > projectileSnapDistance) {
                    projectile.x = projectile.targetX;
                    projectile.y = projectile.targetY;
                } else if (distance > 10) {
                    const correctionSpeed = MultiplayerConfig.BASE_LERP_SPEED * 0.2;
                    const t = Math.min(1, deltaTime * correctionSpeed);
                    projectile.x += dx * t;
                    projectile.y += dy * t;
                }
            } else {
                projectile.x += projectile.vx * deltaTime;
                projectile.y += projectile.vy * deltaTime;
            }

            if (keep && !projectile.ignoresWorldCollision &&
                typeof currentRoom !== 'undefined' &&
                currentRoom &&
                currentRoom.layout &&
                typeof RoomLayoutGenerator !== 'undefined' &&
                !RoomLayoutGenerator.isProjectilePathClear(
                    currentRoom.layout,
                    { x: previousX, y: previousY },
                    { x: projectile.x, y: projectile.y },
                    projectile.size || 4
                )) {
                keep = false;
            }

            projectile.elapsed += deltaTime;

            if (keep && projectile.elapsed >= projectile.lifetime) keep = false;
            if (keep && (projectile.x < -50 || projectile.x > roomWidth + 50)) keep = false;
            if (keep && (projectile.y < -50 || projectile.y > roomHeight + 50)) keep = false;

            if (!keep) {
                this.releasePooledProjectile(projectile);
                continue;
            }

            if (writeIndex !== readIndex) projectiles[writeIndex] = projectile;
            writeIndex++;
        }

        projectiles.length = writeIndex;
    },

    // Check projectiles vs player and player projectiles vs enemies
    checkProjectilesVsPlayer() {
        if (!this.player || !this.player.alive) return;

        const projectilesToRemove = [];

        this.projectiles.forEach((projectile, index) => {
            // Player projectiles (knife, magic bolt) hit enemies
            // ONLY HOST checks player projectile collisions (thin client architecture)
            if ((projectile.type === 'knife' || projectile.type === 'magic') &&
                (this.isHost() || !this.multiplayerEnabled)) {
                if (projectile.activateAfter != null && projectile.activateAfter > 0) {
                    return;
                }
                let hitEnemy = false;

                // Get projectile owner ID and shooter player ONCE (outside enemy loop)
                let projectileOwnerId = null;
                if (projectile.playerId) {
                    projectileOwnerId = projectile.playerId;
                } else {
                    projectileOwnerId = this.getLocalPlayerId ? this.getLocalPlayerId() : null;
                }

                let shooterPlayer = null;
                if (projectileOwnerId === (this.getLocalPlayerId ? this.getLocalPlayerId() : 'local')) {
                    shooterPlayer = this.player;
                } else if (this.remotePlayerInstances && this.remotePlayerInstances.has(projectileOwnerId)) {
                    shooterPlayer = this.remotePlayerInstances.get(projectileOwnerId);
                }

                this.enemies.forEach(enemy => {
                    if (!enemy.alive) return;

                    // Skip if this projectile already hit this enemy (for pierce)
                    if (projectile.hitEnemies && projectile.hitEnemies.has(enemy)) {
                        return;
                    }

                    const attackHit = typeof resolveEnemyAttackHit === 'function'
                        ? resolveEnemyAttackHit(projectile.x, projectile.y, projectile.size, enemy)
                        : (typeof checkEnemyCircleCollision === 'function'
                            ? checkEnemyCircleCollision(projectile.x, projectile.y, projectile.size, enemy)
                            : { hit: checkCircleCollision(
                                projectile.x, projectile.y, projectile.size,
                                enemy.x, enemy.y, enemy.size
                            ) });

                    if (attackHit.hit) {
                        // Check for backstab (Rogue passive: player must be behind enemy when projectile hits)
                        let isBackstab = false;
                        let finalDamage = projectile.damage;

                        // Check for range bonus (Mage passive: increased damage at range)
                        if (projectile.type === 'magic' && shooterPlayer && shooterPlayer.playerClass === 'hexagon') {
                            // Calculate distance from shooter to enemy
                            const dx = enemy.x - shooterPlayer.x;
                            const dy = enemy.y - shooterPlayer.y;
                            const distance = Math.sqrt(dx * dx + dy * dy);

                            // Apply range-based damage multiplier
                            // 1.0x at 0-100px, 1.5x at 100-200px, 2.0x at 200px+
                            let rangeMultiplier = 1.0;
                            if (distance >= 200) {
                                rangeMultiplier = 2.0;
                            } else if (distance >= 100) {
                                // Linear interpolation between 100 and 200
                                rangeMultiplier = 1.0 + ((distance - 100) / 100) * 1.0; // 1.0 to 2.0
                            }

                            finalDamage = projectile.damage * rangeMultiplier;
                        }

                        if (projectile.type === 'knife' && projectile.playerClass === 'triangle') {
                            // Use stored player position when projectile was created
                            const playerX = projectile.playerX !== undefined ? projectile.playerX : this.player.x;
                            const playerY = projectile.playerY !== undefined ? projectile.playerY : this.player.y;

                            // Calculate vector from enemy to player (when knife was thrown)
                            const enemyToPlayerX = playerX - enemy.x;
                            const enemyToPlayerY = playerY - enemy.y;
                            const enemyToPlayerDist = Math.sqrt(enemyToPlayerX * enemyToPlayerX + enemyToPlayerY * enemyToPlayerY);

                            if (enemyToPlayerDist > 0) {
                                // Normalize enemy-to-player vector
                                const enemyToPlayerNormX = enemyToPlayerX / enemyToPlayerDist;
                                const enemyToPlayerNormY = enemyToPlayerY / enemyToPlayerDist;

                                // Enemy forward direction
                                const enemyForwardX = Math.cos(enemy.rotation);
                                const enemyForwardY = Math.sin(enemy.rotation);

                                // Dot product: negative means player is behind enemy
                                const dot = enemyToPlayerNormX * enemyForwardX + enemyToPlayerNormY * enemyForwardY;
                                isBackstab = dot < 0; // Player was behind enemy

                                if (isBackstab) {
                                    finalDamage *= 2; // 2x damage for backstab
                                }
                            }
                        }

                        // Apply crit multiplier if applicable (shooterPlayer already defined above)
                        let isCrit = false;
                        const styleCrit = shooterPlayer ? (shooterPlayer.styleCritBonus || 0) : 0;
                        const effectiveCrit = ((shooterPlayer && shooterPlayer.critChance) || 0) + styleCrit;
                        if (shooterPlayer && effectiveCrit && Math.random() < effectiveCrit) {
                            const critMultiplier = 2.0 * (shooterPlayer.critDamageMultiplier || 1.0);
                            finalDamage *= critMultiplier;
                            isCrit = true;

                        }

                        // Apply vulnerability debuff multiplier (Precision Orange bonus)
                        if (enemy.vulnerable && enemy.vulnerabilityMultiplier && enemy.vulnerabilityMultiplier > 1.0) {
                            finalDamage *= enemy.vulnerabilityMultiplier;
                        }

                        // Check for shield reflection (Shielded Brood modifier - Purple+)
                        if (enemy.hasShield && enemy.shieldReflects && enemy.shieldHealth > 0) {
                            // Reflect projectile back at player
                            const reflectDamage = finalDamage * 0.75; // 75% of original damage

                            // Create reflected projectile
                            const toPlayerX = shooterPlayer.x - enemy.x;
                            const toPlayerY = shooterPlayer.y - enemy.y;
                            const dist = Math.sqrt(toPlayerX * toPlayerX + toPlayerY * toPlayerY);
                            if (dist > 0) {
                                const reflectVx = (toPlayerX / dist) * 400;
                                const reflectVy = (toPlayerY / dist) * 400;

                                this.projectiles.push({
                                    x: enemy.x,
                                    y: enemy.y,
                                    vx: reflectVx,
                                    vy: reflectVy,
                                    size: projectile.size,
                                    damage: reflectDamage,
                                    type: 'enemy_reflected',
                                    color: '#ff6600',
                                    lifetime: 2.0,
                                    elapsed: 0
                                });

                                // Visual feedback for reflection
                                if (typeof createParticleBurst !== 'undefined') {
                                    createParticleBurst(enemy.x, enemy.y, '#ffaa00', 12);
                                }

                                // Remove original projectile
                                projectilesToRemove.push(index);
                                hitEnemy = true;
                                return; // Skip damage application - shield reflected it
                            }
                        }
                        // If we get here, shield didn't reflect (maybe no shooterPlayer), continue with normal damage

                        // Calculate damage dealt BEFORE applying damage (so enemy.hp is still valid)
                        const damageDealt = Math.min(finalDamage, enemy.hp);

                        // HOST ONLY: Apply damage (clients don't run this code path)
                        if (!projectile.styleTag) {
                            projectile.styleTag = (typeof resolvePlayerStyleTag === 'function')
                                ? resolvePlayerStyleTag(shooterPlayer, projectile)
                                : (projectile.isHeavy ? 'heavy' : (projectile.fromSpecial ? 'special' : 'primary'));
                            projectile.fromPlayer = true;
                        }
                        if (typeof stampEnemyStyleTag === 'function') {
                            stampEnemyStyleTag(enemy, projectile.styleTag);
                        } else {
                            enemy.lastStyleTag = projectile.styleTag;
                        }
                        if (enemy.isBoss && typeof enemy.takeDamage === 'function') {
                            enemy.takeDamage(finalDamage, projectile.x, projectile.y, projectile.size, projectileOwnerId);
                        } else {
                            const vArchetype = projectile.type === 'knife' ? 'pierce' : 'magic';
                            enemy.takeDamage(finalDamage, projectileOwnerId, projectile.x, projectile.y, vArchetype);
                        }
                        if (typeof applyStyleLifeSteal === 'function' && shooterPlayer) {
                            applyStyleLifeSteal(shooterPlayer, finalDamage);
                        }

                        // Track lifetime damage stat
                        if (typeof window.trackLifetimeStat === 'function') {
                            window.trackLifetimeStat('totalDamageDealt', damageDealt);
                        }

                        if (this.getPlayerStats && projectileOwnerId) {
                            const stats = this.getPlayerStats(projectileOwnerId);
                            if (stats) {
                                stats.addStat('damageDealt', damageDealt);
                            }
                        }

                        // Apply lifesteal if shooter has it
                        if (shooterPlayer && typeof applyLifesteal !== 'undefined') {
                            applyLifesteal(shooterPlayer, damageDealt, {
                                enemy,
                                source: 'projectile',
                                batchId: projectile.lifestealBatchId
                            });
                        }

                        // Apply legendary effects if shooter has them (Parallel: respect on-hit policy)
                        const projHitProxy = typeof projectileHitboxProxy === 'function'
                            ? projectileHitboxProxy(projectile)
                            : { isParallelSecond: !!projectile.isParallelSecond };
                        if (shooterPlayer && shooterPlayer.activeLegendaryEffects
                            && (!shouldApplyWeaponStatusOnHit || shouldApplyWeaponStatusOnHit(shooterPlayer, projHitProxy))) {
                            shooterPlayer.activeLegendaryEffects.forEach(effect => {
                                if (effect.type === 'incendiary') {
                                    // Apply burn DoT
                                    if (enemy.applyBurn) {
                                        const burnDPS = finalDamage * effect.burnDPS; // DPS as percentage of damage dealt
                                        enemy.applyBurn(burnDPS, effect.burnDuration, projectileOwnerId);
                                    }
                                } else if (effect.type === 'freezing') {
                                    // Apply slow with chance
                                    if (enemy.applySlow && Math.random() < effect.slowChance) {
                                        enemy.applySlow(effect.slowAmount, effect.slowDuration);
                                    }
                                } else if (effect.type === 'chain_lightning') {
                                    // Apply chain lightning (only once per projectile)
                                    if (!projectile.hasChainedLegendary && typeof chainLightningAttack !== 'undefined') {
                                        chainLightningAttack(shooterPlayer, enemy, effect, finalDamage);
                                        projectile.hasChainedLegendary = true;
                                    }
                                }
                            });
                        }

                        // Fractal/endless echo from real projectile hits only
                        if (enemy.biomeFlags && enemy.biomeFlags.echoOnHit
                            && typeof BiomeEnemyMods !== 'undefined' && BiomeEnemyMods.scheduleEcho) {
                            BiomeEnemyMods.scheduleEcho(enemy, enemy.biomeEchoDelay || 0.28);
                        }

                        // Damage numbers for player projectiles (rogue knives, mage bolts)
                        if (typeof createDamageNumber !== 'undefined') {
                            createDamageNumber(enemy.x, enemy.y, Math.floor(damageDealt), isCrit, false);
                        }
                        if (typeof hostBroadcastDamageNumber === 'function') {
                            hostBroadcastDamageNumber(enemy.x, enemy.y, damageDealt, {
                                enemyId: enemy.id,
                                isCrit
                            });
                        }

                        // Track pierce hits
                        if (!projectile.hitEnemies) {
                            projectile.hitEnemies = new Set();
                        }
                        projectile.hitEnemies.add(enemy);

                        hitEnemy = true;
                    }
                });

                // Pierce mechanics: Remove projectile only if pierce limit reached
                if (hitEnemy) {
                    // Get pierce count from shooter
                    let pierceCount = 0;
                    if (shooterPlayer && shooterPlayer.pierceCount) {
                        pierceCount = shooterPlayer.pierceCount;
                    }

                    // Check if projectile has pierced too many enemies
                    const enemiesPierced = projectile.hitEnemies ? projectile.hitEnemies.size : 0;
                    if (enemiesPierced > pierceCount) {
                        // Pierce limit reached, remove projectile
                        projectilesToRemove.push(index);
                    } else {
                        // Still has pierce charges, reduce damage for next hit
                        // Use item pierce damage percent if available, otherwise default 25% reduction per pierce
                        if (shooterPlayer && shooterPlayer.itemPierceDamagePercent > 0) {
                            // Item pierce: second target takes itemPierceDamagePercent of original damage
                            // Store original damage if not already stored
                            if (!projectile.originalDamage) {
                                projectile.originalDamage = projectile.damage;
                            }
                            projectile.damage = projectile.originalDamage * shooterPlayer.itemPierceDamagePercent;
                        } else {
                            // Default: 25% damage reduction per pierce
                            const damageReduction = 0.25 * enemiesPierced;
                            projectile.damage = projectile.damage * (1 - damageReduction);
                        }
                    }
                }
            } else {
                // Enemy projectiles - check all players (host only) or just local player (client/solo)

                // Only host checks remote players
                if (this.isHost() || !this.multiplayerEnabled) {
                    // Get all players to check
                    const playersToCheck = [];

                    // Add local player
                    if (this.player && this.player.alive) {
                        playersToCheck.push({
                            id: this.getLocalPlayerId ? this.getLocalPlayerId() : 'local',
                            player: this.player,
                            isLocal: true
                        });
                    }

                    // Add remote players (multiplayer only) - use simulated instances, not lobby snapshots
                    if (this.remotePlayerInstances && this.remotePlayerInstances.size > 0) {
                        this.remotePlayerInstances.forEach((instance, id) => {
                            if (instance && instance.alive && instance.hp > 0) {
                                playersToCheck.push({
                                    id,
                                    player: instance,
                                    isLocal: false
                                });
                            }
                        });
                    }

                    // Check projectile against each player
                    let projectileHit = false;

                    // Handle reflected projectiles (from shielded enemies)
                    if (projectile.type === 'enemy_reflected') {
                        playersToCheck.forEach(({ id, player: p, isLocal }) => {
                            if (projectileHit) return;

                            if (checkCircleCollision(
                                projectile.x, projectile.y, projectile.size,
                                p.x, p.y, p.size || 20
                            )) {
                                // Hit player with reflected projectile
                                if (isLocal && this.player) {
                                    this.player.takeDamage(projectile.damage);
                                } else if (!isLocal) {
                                    this.damageRemotePlayer(id, projectile.damage);
                                }

                                // Visual feedback
                                if (typeof createParticleBurst !== 'undefined') {
                                    createParticleBurst(projectile.x, projectile.y, '#ff6600', 8);
                                }

                                projectilesToRemove.push(index);
                                projectileHit = true;
                            }
                        });
                        return; // Skip normal enemy projectile handling for reflected projectiles
                    }

                    playersToCheck.forEach(({ id, player: p, isLocal }) => {
                        if (projectileHit) return; // Projectile already hit someone

                        // Check shield blocking (local and remote tank instances)
                        let isBlocked = false;

                        if (p.shieldActive || p.shieldWaveActive) {
                            let shieldStart, shieldDepth, shieldWidth, dirX, dirY;
                            if (p.shieldActive) {
                                shieldStart = p.size + 5;
                                shieldDepth = 20;
                                shieldWidth = 60;
                                dirX = Math.cos(p.rotation);
                                dirY = Math.sin(p.rotation);
                            } else {
                                shieldStart = p.size + 5;
                                const waveProgress = p.shieldWaveElapsed / p.shieldWaveDuration;
                                const waveMaxDistance = (typeof TANK_CONFIG !== 'undefined' ? TANK_CONFIG.shieldWaveRange : 200);
                                shieldDepth = waveMaxDistance * waveProgress;
                                shieldWidth = (typeof TANK_CONFIG !== 'undefined' ? TANK_CONFIG.shieldWaveWidth : 150) / 2;
                                const shieldDir = p.shieldDirection !== undefined ? p.shieldDirection : p.rotation;
                                dirX = Math.cos(shieldDir);
                                dirY = Math.sin(shieldDir);
                            }

                            const toPlayerX = projectile.x - p.x;
                            const toPlayerY = projectile.y - p.y;
                            const toPlayerDist = Math.sqrt(toPlayerX * toPlayerX + toPlayerY * toPlayerY);
                            if (toPlayerDist > 0) {
                                const toPlayerNormX = toPlayerX / toPlayerDist;
                                const toPlayerNormY = toPlayerY / toPlayerDist;

                                const dot = toPlayerNormX * dirX + toPlayerNormY * dirY;

                                if (dot > 0 && toPlayerDist < shieldStart + shieldDepth) {
                                    const perpendicularX = -dirY;
                                    const perpendicularY = dirX;
                                    const lateralDist = Math.abs(toPlayerX * perpendicularX + toPlayerY * perpendicularY);

                                    if (lateralDist < shieldWidth) {
                                        isBlocked = true;

                                        // Play shield block sound (local feedback on host)
                                        if (isLocal && typeof GameAudio !== 'undefined' && GameAudio.sounds) {
                                            GameAudio.sounds.tankShieldHit();
                                        }

                                        if (typeof createParticleBurst !== 'undefined') {
                                            createParticleBurst(projectile.x, projectile.y, '#0099ff', 5);
                                        }
                                        if (typeof hostBroadcastCombatFx === 'function') {
                                            hostBroadcastCombatFx({
                                                kind: 'particle_burst',
                                                x: projectile.x,
                                                y: projectile.y,
                                                color: '#0099ff',
                                                count: 5
                                            });
                                        }
                                    }
                                }
                            }
                        }

                        if (isBlocked) {
                            projectilesToRemove.push(index);
                            projectileHit = true;
                        } else if (checkCircleCollision(
                            projectile.x, projectile.y, projectile.size,
                            p.x, p.y, p.size || 20
                        )) {
                            // Check if player is dodging/invulnerable - if so, count as successful dodge
                            if (p.invulnerable || p.isDodging) {
                                // Track successful dodge (projectile would have hit, but player dodged it)
                                // Only track for local player to avoid double-counting in multiplayer
                                if (isLocal && typeof window.trackLifetimeStat === 'function') {
                                    // Use a cooldown to prevent counting the same projectile multiple times
                                    const dodgeTrackKey = `dodge_projectile_${projectile.id || index}_${id}`;
                                    if (!this.projectileDodgeTrackCooldowns) {
                                        this.projectileDodgeTrackCooldowns = new Map();
                                    }
                                    const currentTime = Date.now();
                                    const lastDodgeTrack = this.projectileDodgeTrackCooldowns.get(dodgeTrackKey) || 0;
                                    const damageCooldownMs = 350; // Same cooldown as melee attacks
                                    if (currentTime - lastDodgeTrack >= damageCooldownMs) {
                                        window.trackLifetimeStat('totalDodges', 1);
                                        this.projectileDodgeTrackCooldowns.set(dodgeTrackKey, currentTime);
                                    }
                                }
                                // Skip damage application but remove projectile
                                projectilesToRemove.push(index);
                                projectileHit = true;
                                return; // Skip to next player
                            }

                            // Play projectile hit sound
                            if (typeof GameAudio !== 'undefined' && GameAudio.sounds) {
                                GameAudio.sounds.projectileHit();
                            }

                            // Hit player
                            if (isLocal) {
                                // Local player - apply damage directly
                                this.player.takeDamage(projectile.damage);
                            } else {
                                // Remote player - apply damage to host's state tracking
                                // HP syncs to clients via game_state, not individual damage events
                                this.damageRemotePlayer(id, projectile.damage);
                            }
                            projectilesToRemove.push(index);
                            projectileHit = true;
                        }
                    });
                } else {
                    // Client in multiplayer - still check local player for visual consistency
                    // (Host will send authoritative damage event)
                    // Just check for blocking
                    let isBlocked = false;

                    if (this.player && (this.player.shieldActive || this.player.shieldWaveActive)) {
                        let shieldStart, shieldDepth, shieldWidth, dirX, dirY;
                        if (this.player.shieldActive) {
                            shieldStart = this.player.size + 5;
                            shieldDepth = 20;
                            shieldWidth = 60;
                            dirX = Math.cos(this.player.rotation);
                            dirY = Math.sin(this.player.rotation);
                        } else {
                            shieldStart = this.player.size + 5;
                            const waveProgress = this.player.shieldWaveElapsed / this.player.shieldWaveDuration;
                            const waveMaxDistance = (typeof TANK_CONFIG !== 'undefined' ? TANK_CONFIG.shieldWaveRange : 200);
                            shieldDepth = waveMaxDistance * waveProgress;
                            shieldWidth = (typeof TANK_CONFIG !== 'undefined' ? TANK_CONFIG.shieldWaveWidth : 150) / 2;
                            const shieldDir = this.player.shieldDirection !== undefined ? this.player.shieldDirection : this.player.rotation;
                            dirX = Math.cos(shieldDir);
                            dirY = Math.sin(shieldDir);
                        }

                        const toPlayerX = projectile.x - this.player.x;
                        const toPlayerY = projectile.y - this.player.y;
                        const toPlayerDist = Math.sqrt(toPlayerX * toPlayerX + toPlayerY * toPlayerY);
                        if (toPlayerDist > 0) {
                            const toPlayerNormX = toPlayerX / toPlayerDist;
                            const toPlayerNormY = toPlayerY / toPlayerDist;

                            const dot = toPlayerNormX * dirX + toPlayerNormY * dirY;

                            if (dot > 0 && toPlayerDist < shieldStart + shieldDepth) {
                                const perpendicularX = -dirY;
                                const perpendicularY = dirX;
                                const lateralDist = Math.abs(toPlayerX * perpendicularX + toPlayerY * perpendicularY);

                                if (lateralDist < shieldWidth) {
                                    isBlocked = true;
                                    if (typeof createParticleBurst !== 'undefined') {
                                        createParticleBurst(projectile.x, projectile.y, '#0099ff', 5);
                                    }
                                }
                            }
                        }
                    }

                    // Note: Damage will be sent by host, client just shows visual feedback
                    if (isBlocked) {
                        projectilesToRemove.push(index);
                    }
                }
            }
        });

        // Remove projectiles that hit (in reverse order)
        for (let i = projectilesToRemove.length - 1; i >= 0; i--) {
            const removed = this.projectiles[projectilesToRemove[i]];
            this.projectiles.splice(projectilesToRemove[i], 1);
            this.releasePooledProjectile(removed);
        }
    },
};

if (typeof window !== 'undefined') {
    window.GameCombatProjectiles = GameCombatProjectiles;
}
