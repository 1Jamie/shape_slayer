// Combat system - damage calculation and combat checks

// Circle collision detection helper
function checkCircleCollision(x1, y1, r1, x2, y2, r2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance < r1 + r2;
}

// Resolve positional overlap between an enemy and a player by pushing the enemy out
function resolveEnemyPlayerOverlap(enemy, player, extraBuffer = 0) {
    if (!enemy || !player) return;

    // Skip separation when either side is in a state that intentionally permits overlap (e.g., dodge roll, lunge)
    const playerAllowsOverlap =
        (player.isDodging === true) ||
        (typeof player.isInSpecialMovement === 'function' && player.isInSpecialMovement());
    
    const enemyState = enemy.state || null;
    const enemyAllowsOverlap =
        enemy.allowOverlapDuringAbility === true ||
        (enemyState && ['dash', 'charge', 'slam'].includes(enemyState));
    
    if (playerAllowsOverlap || enemyAllowsOverlap) {
        return;
    }

    const playerRadius = player.collisionRadius || player.size || 20;
    const enemyRadius = enemy.collisionRadius || enemy.size || 20;
    const minimumSeparation = playerRadius + enemyRadius + extraBuffer;

    let dx = enemy.x - player.x;
    let dy = enemy.y - player.y;
    let distanceSq = dx * dx + dy * dy;

    if (distanceSq === 0) {
        const angle = Math.random() * Math.PI * 2;
        dx = Math.cos(angle);
        dy = Math.sin(angle);
        distanceSq = 1;
    }

    const distance = Math.sqrt(distanceSq);
    if (distance >= minimumSeparation) {
        return;
    }

    const overlap = minimumSeparation - distance;
    const normalX = dx / distance;
    const normalY = dy / distance;
    const pushDistance = overlap;

    enemy.x += normalX * pushDistance;
    enemy.y += normalY * pushDistance;

    if (typeof enemy.keepInBounds === 'function') {
        enemy.keepInBounds();
    }

    if (enemy.vx !== undefined && enemy.vy !== undefined) {
        const relativeSpeed = enemy.vx * normalX + enemy.vy * normalY;
        if (relativeSpeed < 0) {
            enemy.vx -= relativeSpeed * normalX;
            enemy.vy -= relativeSpeed * normalY;
        }
    }

    if (enemy.knockbackVx !== undefined && enemy.knockbackVy !== undefined) {
        const relativeKnockback = enemy.knockbackVx * normalX + enemy.knockbackVy * normalY;
        if (relativeKnockback < 0) {
            enemy.knockbackVx -= relativeKnockback * normalX;
            enemy.knockbackVy -= relativeKnockback * normalY;
        }
    }
}

// Get a projected damage point in front of an enemy so contact damage applies without overlapping the player
function getEnemyDamagePoint(enemy, targetPlayer = null) {
    if (!enemy) {
        return { x: 0, y: 0, radius: 10 };
    }
    
    const enemyRadius = enemy.collisionRadius || enemy.size || 20;
    const projectionMultiplier = enemy.damageProjectionMultiplier || 0.9; // Distance out from enemy center
    const projectedRadius = enemy.damageProjectionRadius || Math.max(8, enemyRadius * 0.7);
    
    let dirX = 0;
    let dirY = 0;
    
    // Primary: use facing rotation if available
    if (typeof enemy.rotation === 'number') {
        dirX = Math.cos(enemy.rotation);
        dirY = Math.sin(enemy.rotation);
    }
    
    // Fallback: use velocity vector
    if (dirX === 0 && dirY === 0 && enemy.vx !== undefined && enemy.vy !== undefined) {
        const speedSq = enemy.vx * enemy.vx + enemy.vy * enemy.vy;
        if (speedSq > 0.001) {
            const speed = Math.sqrt(speedSq);
            dirX = enemy.vx / speed;
            dirY = enemy.vy / speed;
        }
    }
    
    // Fallback: aim directly at target player
    if ((dirX === 0 && dirY === 0) && targetPlayer) {
        const dx = targetPlayer.x - enemy.x;
        const dy = targetPlayer.y - enemy.y;
        const distSq = dx * dx + dy * dy;
        if (distSq > 0.001) {
            const dist = Math.sqrt(distSq);
            dirX = dx / dist;
            dirY = dy / dist;
        }
    }
    
    // Final fallback: point to the right
    if (dirX === 0 && dirY === 0) {
        dirX = 1;
        dirY = 0;
    }
    
    const projectionDistance = enemyRadius * projectionMultiplier;
    
    return {
        x: enemy.x + dirX * projectionDistance,
        y: enemy.y + dirY * projectionDistance,
        radius: projectedRadius
    };
}

// Calculate final damage with all modifiers
function calculateDamage(baseDamage, gearMultiplier = 1, defense = 0, critMultiplier = 1) {
    const mitigatedDamage = baseDamage * gearMultiplier * (1 - defense);
    return mitigatedDamage * critMultiplier;
}

// Apply lifesteal healing to player (host/solo only)
function applyLifesteal(player, damageDealt) {
    // Only apply on host/solo (not clients)
    const isClient = typeof Game !== 'undefined' && Game.isMultiplayerClient && Game.isMultiplayerClient();
    if (isClient) return;
    
    // Check if player has lifesteal
    if (!player || !player.lifesteal || player.lifesteal <= 0) return;
    
    // Calculate heal amount
    const healAmount = damageDealt * player.lifesteal;
    
    // Apply healing (clamped to maxHp)
    player.hp = Math.min(player.hp + healAmount, player.maxHp);
}

// Apply legendary effects to an enemy (host/solo only)
function applyLegendaryEffects(player, enemy, damageDealt, attackerId) {
    // Only apply on host/solo (not clients)
    const isClient = typeof Game !== 'undefined' && Game.isMultiplayerClient && Game.isMultiplayerClient();
    if (isClient) return;
    
    if (!player || !player.activeLegendaryEffects || !enemy) return;
    
    player.activeLegendaryEffects.forEach(effect => {
        if (effect.type === 'incendiary') {
            // Apply burn DoT
            if (enemy.applyBurn) {
                const burnDPS = damageDealt * effect.burnDPS; // DPS as percentage of damage dealt
                enemy.applyBurn(burnDPS, effect.burnDuration, attackerId);
            }
        } else if (effect.type === 'freezing') {
            // Apply slow with chance
            if (enemy.applySlow && Math.random() < effect.slowChance) {
                enemy.applySlow(effect.slowAmount, effect.slowDuration);
            }
        } else if (effect.type === 'chain_lightning') {
            // Note: chain lightning is applied separately from this function
            // to prevent duplicate chains (controlled by hasChained flags)
        }
    });
}

// Check attacks vs enemies and handle collisions
function checkAttacksVsEnemies(player, enemies, playerId = null) {
    player.attackHitboxes.forEach((hitbox) => {
        // Initialize hitEnemies set if it doesn't exist (for existing hitboxes created before this change)
        if (!hitbox.hitEnemies) {
            hitbox.hitEnemies = new Set();
        }
        
        enemies.forEach(enemy => {
            if (!enemy.alive || hitbox.hitEnemies.has(enemy)) return;
            
            // Check body collision first
            const bodyCollision = checkCircleCollision(hitbox.x, hitbox.y, hitbox.radius, enemy.x, enemy.y, enemy.size);
            
            if (bodyCollision) {
                // Check for weak point hit (for bosses only)
                let hitWeakPoint = false;
                if (enemy.isBoss && enemy.checkWeakPointHit) {
                    const weakPoint = enemy.checkWeakPointHit(hitbox.x, hitbox.y, hitbox.radius);
                    hitWeakPoint = !!weakPoint;
                }
                
                // Check for backstab (Rogue passive: player must be behind enemy)
                let isBackstab = false;
                if (player.playerClass === 'triangle') {
                    // Calculate vector from enemy to player
                    const enemyToPlayerX = player.x - enemy.x;
                    const enemyToPlayerY = player.y - enemy.y;
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
                        isBackstab = dot < 0; // Player is behind enemy
                    }
                }
                
                // Apply crit multiplier if applicable
                let critMultiplier = 1.0;
                if (hitbox.crit || (player.critChance && Math.random() < player.critChance)) {
                    critMultiplier = 2.0 * (player.critDamageMultiplier || 1.0); // Use affix crit damage
                    hitbox.displayCrit = true;
                }
                
                // Card effects: Momentum and Overcharge multipliers
                let cardMultiplier = 1.0;
                if (typeof CardEffects !== 'undefined') {
                    const momentumMult = CardEffects.getMomentumMultiplier ? CardEffects.getMomentumMultiplier(player) : 1.0;
                    const overchargeMult = CardEffects.getOverchargeMultiplier ? CardEffects.getOverchargeMultiplier(player) : 1.0;
                    cardMultiplier = momentumMult * overchargeMult;
                    // Reset overcharge after use (one attack only)
                    if (overchargeMult > 1.0 && player._cardEffects) {
                        player._cardEffects.overchargeActive = false;
                        // Restart timer
                        if (typeof DeckState !== 'undefined' && Array.isArray(DeckState.hand)) {
                            const condEffects = CardEffects.getConditionalEffects ? CardEffects.getConditionalEffects(DeckState.hand) : null;
                            if (condEffects && condEffects.overcharge) {
                                player._cardEffects.overchargeTimer = condEffects.overcharge.interval || 5;
                            }
                        }
                    }
                }
                
                // Calculate final damage with backstab and crit multipliers
                let finalDamage = hitbox.damage * critMultiplier * cardMultiplier;
                if (isBackstab) {
                    const backstabMultiplier = 2 + (player.backstabMultiplierBonus || 0); // Apply class modifier
                    finalDamage *= backstabMultiplier;
                    
                    // Track backstab damage for lifetime stats (track the extra damage from backstab)
                    if (!isClient && typeof window.trackLifetimeStat === 'function') {
                        const backstabExtraDamage = hitbox.damage * critMultiplier * cardMultiplier * (backstabMultiplier - 1);
                        window.trackLifetimeStat('totalBackstabDamage', backstabExtraDamage);
                    }
                }
                
                // Card Execute: instant kill at threshold (replaces old executeBonus)
                let executeTriggered = false;
                if (typeof CardEffects !== 'undefined' && CardEffects.getConditionalEffects && typeof DeckState !== 'undefined') {
                    const handCards = Array.isArray(DeckState.hand) ? DeckState.hand : [];
                    const condEffects = CardEffects.getConditionalEffects(handCards);
                    if (condEffects.execute && !isClient) {
                        const hpPercent = enemy.hp / (enemy.maxHp || enemy.hp);
                        const threshold = enemy.isBoss ? condEffects.execute.bossThreshold : condEffects.execute.threshold;
                        if (hpPercent <= threshold) {
                            // Instant kill
                            finalDamage = enemy.hp;
                            executeTriggered = true;
                            hitbox.displayExecute = true;
                            // Apply movement speed bonus if available
                            if (condEffects.execute.moveSpeedOnExecute && typeof player.applyTemporarySpeedBoost === 'function') {
                                player.applyTemporarySpeedBoost(condEffects.execute.moveSpeedOnExecute.value, condEffects.execute.moveSpeedOnExecute.duration);
                            }
                        }
                    }
                }
                
                // Legacy execute bonus (fallback if no card Execute)
                if (!executeTriggered && player.executeBonus && player.executeBonus > 0) {
                    const hpPercent = enemy.hp / (enemy.maxHp || enemy.hp);
                    if (hpPercent < 0.3) {
                        finalDamage *= (1 + player.executeBonus);
                        hitbox.displayExecute = true;
                    }
                }
                
                // Rampage bonus: apply stacking damage
                if (player.rampageStacks && player.rampageStacks > 0 && player.rampageBonus) {
                    const rampageMultiplier = 1 + (player.rampageStacks * player.rampageBonus);
                    finalDamage *= rampageMultiplier;
                }
                
                // Get attacker ID for aggro system
                // Use provided playerId (for remote players) or fall back to local player ID
                const attackerId = playerId || (typeof Game !== 'undefined' && Game.getLocalPlayerId ? Game.getLocalPlayerId() : null);
                
                // Only apply damage if we're the host or in solo mode
                // Clients send damage events and wait for host's authoritative response
                const isClient = typeof Game !== 'undefined' && Game.isMultiplayerClient && Game.isMultiplayerClient();
                
                // Calculate actual damage dealt BEFORE applying damage (accounting for weak point multiplier)
                let damageDealt = hitWeakPoint ? finalDamage * 3 : finalDamage;
                // Don't cap by enemy.hp on clients since they don't have authoritative HP
                if (!isClient) {
                    damageDealt = Math.min(damageDealt, enemy.hp);
                }
                
                if (!isClient) {
                    // Host or solo: Apply damage locally
                    if (enemy.isBoss && typeof enemy.takeDamage === 'function') {
                        // Bosses: pass position/radius for weak point detection + attacker ID
                        enemy.takeDamage(finalDamage, hitbox.x, hitbox.y, hitbox.radius, attackerId);
                    } else {
                        // Normal enemies: pass damage (with backstab multiplier if applicable) + attacker ID
                        enemy.takeDamage(finalDamage, attackerId);
                    }
                }
                
                if (!isClient && typeof Telemetry !== 'undefined' && attackerId) {
                    const enemyId = enemy.enemyId || enemy.id || enemy.bossName || enemy.type || null;
                    const enemyType = enemy.isBoss ? 'boss' : (enemy.type || (enemy.constructor && enemy.constructor.name) || 'enemy');
                    const roomNumber = typeof Game !== 'undefined' && typeof Game.roomNumber === 'number'
                        ? Game.roomNumber
                        : null;
                    
                    Telemetry.recordDamage({
                        playerId: attackerId,
                        amount: damageDealt,
                        enemyId,
                        enemyType,
                        roomNumber,
                        isBoss: !!enemy.isBoss
                    });
                }
                
                // Apply hammer-specific effects (knockback and stun)
                if (hitbox.type === 'hammer') {
                    // Calculate knockback direction (away from player center)
                    const knockbackDx = enemy.x - player.x;
                    const knockbackDy = enemy.y - player.y;
                    const knockbackDist = Math.sqrt(knockbackDx * knockbackDx + knockbackDy * knockbackDy);
                    
                    if (knockbackDist > 0) {
                        // Moderate knockback force (120-150) with player's knockback multiplier
                        const knockbackForce = 135 * (player.knockbackMultiplier || 1.0);
                        const knockbackX = (knockbackDx / knockbackDist) * knockbackForce;
                        const knockbackY = (knockbackDy / knockbackDist) * knockbackForce;
                        enemy.applyKnockback(knockbackX, knockbackY);
                    }
                    
                    // Apply light stun (0.5-0.8 seconds)
                    const stunDuration = 0.65;
                    enemy.applyStun(stunDuration);
                    
                    // Tank heal on hit (host/solo only)
                    if (!isClient && player.playerClass === 'pentagon') {
                        const healPercent = typeof TANK_CONFIG !== 'undefined' ? TANK_CONFIG.hammerHealOnHit : 0.075;
                        const healAmount = damageDealt * healPercent;
                        player.hp = Math.min(player.hp + healAmount, player.maxHp);
                        
                        // Visual feedback for heal
                        if (typeof createHealNumber !== 'undefined') {
                            createHealNumber(player.x, player.y, healAmount);
                        }
                    }
                }
                
                // Track damage stats (host/solo only for consistency)
                if (!isClient) {
                    // Track lifetime damage stat
                    if (typeof window.trackLifetimeStat === 'function') {
                        window.trackLifetimeStat('totalDamageDealt', damageDealt);
                    }
                    
                    if (typeof Game !== 'undefined' && Game.getPlayerStats && attackerId) {
                        const stats = Game.getPlayerStats(attackerId);
                        if (stats) {
                            stats.addStat('damageDealt', damageDealt);
                        }
                    }
                    
                    // Track damage toward XP (on kill)
                    if (enemy.hp <= 0) {
                        // Track lifetime kills stat
                        if (typeof window.trackLifetimeStat === 'function') {
                            window.trackLifetimeStat('totalKills', 1);
                        }
                        
                        const stats = typeof Game !== 'undefined' && Game.getPlayerStats ? Game.getPlayerStats(attackerId) : null;
                        if (stats) {
                            stats.addStat('kills', 1);
                        }
                    }
                    
                    // Phoenix Down recharge: track damage toward next charge
                    if (player.hasPhoenixDown && player.phoenixDownCharges < 1) {
                        player.phoenixDownDamageProgress += damageDealt;
                        if (player.phoenixDownDamageProgress >= player.phoenixDownDamageThreshold) {
                            player.phoenixDownCharges = 1;
                            player.phoenixDownDamageProgress = 0;
                            console.log('Phoenix Down recharged!');
                            // Visual effect for recharge
                            if (typeof createParticleBurst !== 'undefined') {
                                createParticleBurst(player.x, player.y, '#ffaa00', 15);
                            }
                        }
                    }
                }
                
                // Apply lifesteal if player has it (host/solo only for consistency)
                if (!isClient && player.lifesteal && player.lifesteal > 0) {
                    const healAmount = damageDealt * player.lifesteal;
                    player.hp = Math.min(player.hp + healAmount, player.maxHp);
                }
                
                // Fortify: Convert damage to shield (host/solo only)
                if (!isClient && player.fortifyPercent && player.fortifyPercent > 0) {
                    const shieldGain = damageDealt * player.fortifyPercent;
                    player.fortifyShield = (player.fortifyShield || 0) + shieldGain;
                    player.fortifyShieldDecay = 0.1; // Reset decay timer
                }
                
                // Card Momentum: Gain stack on kill (host/solo only)
                if (!isClient && typeof CardEffects !== 'undefined' && CardEffects.getConditionalEffects && typeof DeckState !== 'undefined' && enemy.hp <= 0) {
                    const handCards = Array.isArray(DeckState.hand) ? DeckState.hand : [];
                    const condEffects = CardEffects.getConditionalEffects(handCards);
                    if (condEffects.momentum && player._cardEffects) {
                        const momentum = condEffects.momentum;
                        // Cap the total multiplier value, not stack count
                        const newStacks = Math.min((player._cardEffects.momentumStacks || 0) + momentum.perKill, momentum.cap);
                        player._cardEffects.momentumStacks = newStacks;
                        player._cardEffects.momentumTimer = momentum.duration;
                        if (momentum.extendOnKill) {
                            player._cardEffects.momentumTimer += momentum.extendOnKill;
                        }
                        // Apply movement speed bonus if available
                        if (momentum.moveSpeedOnKill && typeof player.applyTemporarySpeedBoost === 'function') {
                            player.applyTemporarySpeedBoost(momentum.moveSpeedOnKill, momentum.duration);
                        }
                    }
                }
                
                // Rampage: Gain stack on kill (host/solo only) - legacy affix
                if (!isClient && player.rampageBonus && player.rampageBonus > 0 && enemy.hp <= 0) {
                    const maxStacks = 5;
                    if (player.rampageStacks < maxStacks) {
                        player.rampageStacks++;
                        player.rampageStackDecay = 5.0; // 5 seconds until decay
                    }
                }
                
                // Card Fractal Conduit: Chain lightning on hit (host/solo only)
                if (!isClient && typeof CardEffects !== 'undefined' && CardEffects.getConditionalEffects && typeof DeckState !== 'undefined' && !hitbox.hasChainedCard) {
                    const handCards = Array.isArray(DeckState.hand) ? DeckState.hand : [];
                    const condEffects = CardEffects.getConditionalEffects(handCards);
                    if (condEffects.fractalConduit) {
                        const conduit = condEffects.fractalConduit;
                        const chainRange = conduit.rangeBoost ? 400 : 300;
                        chainLightningCard(player, enemy, conduit.chainCount, hitbox.damage * conduit.chainDamage, enemies, chainRange, conduit.lifeOnChain);
                        hitbox.hasChainedCard = true;
                    }
                }
                
                // Card Detonating Vertex: Chance to explode on hit (host/solo only)
                if (!isClient && typeof CardEffects !== 'undefined' && CardEffects.getConditionalEffects && typeof DeckState !== 'undefined') {
                    const handCards = Array.isArray(DeckState.hand) ? DeckState.hand : [];
                    const condEffects = CardEffects.getConditionalEffects(handCards);
                    if (condEffects.detonatingVertex && Math.random() < condEffects.detonatingVertex.chance) {
                        const vertex = condEffects.detonatingVertex;
                        createExplosion(enemy.x, enemy.y, 60, hitbox.damage * vertex.aoe, player, enemies);
                        // Cluster bombs at orange tier
                        if (vertex.clusters && vertex.clusters.count > 0) {
                            for (let i = 0; i < vertex.clusters.count; i++) {
                                const angle = (Math.PI * 2 * i) / vertex.clusters.count;
                                const offsetX = Math.cos(angle) * 40;
                                const offsetY = Math.sin(angle) * 40;
                                createExplosion(enemy.x + offsetX, enemy.y + offsetY, 40, hitbox.damage * vertex.clusters.multiplier, player, enemies);
                            }
                        }
                    }
                }
                
                // Chain Lightning affix (host/solo only) - legacy affix
                if (!isClient && player.chainLightningCount && player.chainLightningCount > 0 && !hitbox.hasChainedAffix) {
                    chainLightningAffix(player, enemy, player.chainLightningCount, hitbox.damage * 0.5, enemies);
                    hitbox.hasChainedAffix = true;
                }
                
                // Explosive Attacks: Chance to create AoE (host/solo only) - legacy affix
                if (!isClient && player.explosiveChance && player.explosiveChance > 0 && Math.random() < player.explosiveChance) {
                    createExplosion(enemy.x, enemy.y, 40, hitbox.damage * 0.5, player, enemies);
                }
                
                // Check for chain lightning legendary effect (host/solo only)
                if (!isClient && player.activeLegendaryEffects && !hitbox.hasChained) {
                    player.activeLegendaryEffects.forEach(effect => {
                        if (effect.type === 'chain_lightning') {
                            chainLightningAttack(player, enemy, effect, hitbox.damage);
                            hitbox.hasChained = true;
                        }
                    });
                }
                
                // Multiplayer: Send damage event to host (clients send for host to process)
                if (isClient) {
                    const enemyIndex = Game.getEnemyIndex(enemy);
                    if (enemyIndex !== -1) {
                        // Send raw finalDamage, not capped by HP, so host can calculate correctly
                        Game.sendEnemyDamageEvent(enemyIndex, finalDamage, hitbox.x, hitbox.y, hitbox.radius, hitWeakPoint);
                    }
                }
                
                // Create damage number (host only - clients receive via damage_number event)
                if (!isClient && typeof createDamageNumber !== 'undefined') {
                    const isCrit = hitbox.displayCrit || false;
                    // Position damage number at weak point if hit, otherwise at enemy center
                    let damageX = enemy.x;
                    let damageY = enemy.y;
                    if (hitWeakPoint && enemy.weakPoints && enemy.weakPoints.length > 0) {
                        // Use first hit weak point position
                        damageX = enemy.x + enemy.weakPoints[0].offsetX;
                        damageY = enemy.y + enemy.weakPoints[0].offsetY;
                    }
                    createDamageNumber(damageX, damageY, damageDealt, isCrit, hitWeakPoint);
                    
                    // In multiplayer, send damage number event to clients
                    if (typeof Game !== 'undefined' && Game.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager) {
                        if (typeof DebugFlags !== 'undefined' && DebugFlags.DAMAGE_NUMBERS) {
                            console.log(`[Host/Melee] Sending damage_number to clients: enemyId=${enemy.id}, coords=(${damageX}, ${damageY}), damage=${Math.floor(damageDealt)}, isCrit=${isCrit}`);
                        }
                        
                        multiplayerManager.send({
                            type: 'damage_number',
                            data: {
                                enemyId: enemy.id,
                                x: damageX,
                                y: damageY,
                                damage: Math.floor(damageDealt),
                                isCrit: isCrit,
                                isWeakPoint: hitWeakPoint
                            }
                        });
                    }
                }
                
                // Play impact sound based on hit type
                if (typeof AudioManager !== 'undefined' && AudioManager.sounds) {
                    // Normalize damage for intensity (assuming typical damage ranges from 10-100)
                    const intensity = Math.min(damageDealt / 50, 2.0);
                    
                    if (hitWeakPoint) {
                        AudioManager.sounds.hitWeakPoint(intensity);
                    } else if (hitbox.displayCrit) {
                        AudioManager.sounds.hitCritical(intensity);
                    } else if (isBackstab) {
                        AudioManager.sounds.hitBackstab(intensity);
                    } else {
                        AudioManager.sounds.hitNormal(intensity);
                    }
                    
                    // Play death sound if enemy died
                    if (!isClient && enemy.hp <= 0) {
                        setTimeout(() => {
                            if (AudioManager.sounds) {
                                AudioManager.sounds.enemyDeath();
                            }
                        }, 50);
                    }
                }
                
                // Track that we hit this enemy so we don't hit it again with this hitbox
                hitbox.hitEnemies.add(enemy);
            }
        });
    });
}

// Check enemies vs player (and all remote players in multiplayer)
function checkEnemiesVsPlayer(player, enemies) {
    // Only run on host in multiplayer (host simulates all collisions)
    if (typeof Game !== 'undefined' && Game.isMultiplayerClient && Game.isMultiplayerClient()) {
        return;
    }
    
    // Initialize damage cooldown tracking if not exists
    if (!checkEnemiesVsPlayer.damageCooldowns) {
        checkEnemiesVsPlayer.damageCooldowns = new Map();
    }
    
    const currentTime = Date.now();
    const damageCooldownMs = 350; // Brief debounce window between contact hits
    
    const playersToCheck = [];
    
    // Add local player if alive (check invulnerability later to track successful dodges)
    if (player && player.alive) {
        // Get local player ID for consistent identification
        const localPlayerId = typeof Game !== 'undefined' && Game.getLocalPlayerId ? Game.getLocalPlayerId() : 'local';
        
        playersToCheck.push({
            id: localPlayerId,
            player: player,
            isPlayerInstance: true
        });
    }
    
    // Add remote player INSTANCES (host simulates these)
    if (typeof Game !== 'undefined' && Game.remotePlayerInstances) {
        Game.remotePlayerInstances.forEach((playerInstance, playerId) => {
            if (playerInstance && playerInstance.alive) {
                playersToCheck.push({
                    id: playerId,
                    player: playerInstance,
                    isPlayerInstance: true
                });
            }
        });
    }
    
    // Check each enemy against each player
    enemies.forEach(enemy => {
        if (!enemy.alive) return;
        
        playersToCheck.forEach(({ id, player: p, isPlayerInstance }) => {
            const playerRadius = p.collisionRadius || p.size || 20;
            const enemyRadius = enemy.collisionRadius || enemy.size || 20;
            
            // Project damage point in front of enemy
            const damagePoint = getEnemyDamagePoint(enemy, p);
            const hasProjectedHit = checkCircleCollision(damagePoint.x, damagePoint.y, damagePoint.radius,
                                                         p.x, p.y, playerRadius);
            
            if (hasProjectedHit) {
                // Check if player is dodging/invulnerable - if so, count as successful dodge
                if (p.invulnerable || p.isDodging) {
                    // Track successful dodge (attack would have hit, but player dodged it)
                    // Only track for local player to avoid double-counting in multiplayer
                    const localPlayerId = typeof Game !== 'undefined' && Game.getLocalPlayerId ? Game.getLocalPlayerId() : 'local';
                    if (id === localPlayerId && typeof window.trackLifetimeStat === 'function') {
                        // Use a cooldown to prevent counting the same attack multiple times
                        const dodgeTrackKey = `dodge_${enemy.id}_${id}`;
                        if (!checkEnemiesVsPlayer.dodgeTrackCooldowns) {
                            checkEnemiesVsPlayer.dodgeTrackCooldowns = new Map();
                        }
                        const lastDodgeTrack = checkEnemiesVsPlayer.dodgeTrackCooldowns.get(dodgeTrackKey) || 0;
                        if (currentTime - lastDodgeTrack >= damageCooldownMs) {
                            window.trackLifetimeStat('totalDodges', 1);
                            checkEnemiesVsPlayer.dodgeTrackCooldowns.set(dodgeTrackKey, currentTime);
                        }
                    }
                    // Skip damage application but still resolve overlap
                    resolveEnemyPlayerOverlap(enemy, p);
                    return; // Skip to next player
                }
                
                // For diamond enemies, check if dash has already hit (prevents continuous damage)
                // Check dashHasHit flag regardless of current state (dash or cooldown after dash)
                if (enemy.shape === 'diamond' && enemy.dashHasHit === true) {
                    // Dash already hit, skip damage to prevent continuous hits
                    resolveEnemyPlayerOverlap(enemy, p);
                    return; // Skip to next player
                }
                
                const cooldownKey = `${enemy.id}-${id}`;
                const lastDamageTime = checkEnemiesVsPlayer.damageCooldowns.get(cooldownKey) || 0;
                
                if (currentTime - lastDamageTime >= damageCooldownMs) {
                    // For diamond enemies in dash state, mark that dash has hit
                    // This prevents multiple hits from the same dash attack
                    if (enemy.shape === 'diamond' && (enemy.state === 'dash' || enemy.state === 'cooldown')) {
                        enemy.dashHasHit = true;
                    }
                    // Get local player ID for comparison
                    const localPlayerId = Game.getLocalPlayerId ? Game.getLocalPlayerId() : 'local';
                    
                    // Distinguish between local and remote players
                    if (id === localPlayerId) {
                        // Local player: call takeDamage directly (pass enemy for thorns)
                        p.takeDamage(enemy.damage, enemy);
                    } else {
                        // Remote player: use damageRemotePlayer to track on host
                        // HP syncs to clients via game_state, not individual damage events
                        if (typeof Game !== 'undefined' && Game.damageRemotePlayer) {
                            Game.damageRemotePlayer(id, enemy.damage);
                        }
                    }
                    
                    checkEnemiesVsPlayer.damageCooldowns.set(cooldownKey, currentTime);
                    
                    // Apply directional knockback to the player based on enemy momentum
                    if (typeof p.applyDamageKnockback === 'function') {
                        let impactDirX;
                        let impactDirY;
                        
                        if (typeof enemy.rotation === 'number') {
                            impactDirX = Math.cos(enemy.rotation);
                            impactDirY = Math.sin(enemy.rotation);
                        }
                        
                        if ((impactDirX === undefined || impactDirY === undefined) ||
                            (impactDirX === 0 && impactDirY === 0)) {
                            const dirX = p.x - enemy.x;
                            const dirY = p.y - enemy.y;
                            const dirDist = Math.sqrt(dirX * dirX + dirY * dirY);
                            if (dirDist > 0) {
                                impactDirX = dirX / dirDist;
                                impactDirY = dirY / dirDist;
                            } else {
                                impactDirX = 1;
                                impactDirY = 0;
                            }
                        }
                        
                        const knockbackStrength = enemy.contactKnockback || 120;
                        p.applyDamageKnockback(impactDirX * knockbackStrength, impactDirY * knockbackStrength);
                    }
                }
                
                resolveEnemyPlayerOverlap(enemy, p);
            }
        });
    });
    
    // Clean up old cooldown entries
    const cleanupThreshold = currentTime - 2000;
    for (const [key, time] of checkEnemiesVsPlayer.damageCooldowns.entries()) {
        if (time < cleanupThreshold) {
            checkEnemiesVsPlayer.damageCooldowns.delete(key);
        }
    }
    
    // Clean up old dodge tracking cooldown entries
    if (checkEnemiesVsPlayer.dodgeTrackCooldowns) {
        for (const [key, time] of checkEnemiesVsPlayer.dodgeTrackCooldowns.entries()) {
            if (time < cleanupThreshold) {
                checkEnemiesVsPlayer.dodgeTrackCooldowns.delete(key);
            }
        }
    }
}

// Check enemies vs clones/decoys (shadow clones and blink decoys)
function checkEnemiesVsClones(player, enemies) {
    // Only run on host in multiplayer (host simulates all collisions)
    if (typeof Game !== 'undefined' && Game.isMultiplayerClient && Game.isMultiplayerClient()) {
        return; // Clients don't check enemy collisions, host does
    }
    
    if (!enemies || enemies.length === 0) return;
    
    // Get all players to check their clones
    const playersToCheck = [];
    
    // Add local player
    if (player && player.alive) {
        playersToCheck.push(player);
    }
    
    // Add remote player INSTANCES (host simulates these)
    if (typeof Game !== 'undefined' && Game.remotePlayerInstances) {
        Game.remotePlayerInstances.forEach((playerInstance, playerId) => {
            if (playerInstance && playerInstance.alive) {
                playersToCheck.push(playerInstance);
            }
        });
    }
    
    // Initialize damage cooldown tracking if not exists
    if (!checkEnemiesVsClones.damageCooldowns) {
        checkEnemiesVsClones.damageCooldowns = new Map();
    }
    
    const currentTime = Date.now();
    const damageCooldownMs = 500; // 0.5 second cooldown between damage ticks
    
    playersToCheck.forEach(p => {
        // Check shadow clones (Rogue)
        if (p.shadowClonesActive && p.shadowClones && p.shadowClones.length > 0) {
            p.shadowClones.forEach((clone, cloneIndex) => {
                if (clone && clone.alive !== false && (clone.health === undefined || clone.health > 0)) {
                    enemies.forEach(enemy => {
                        if (!enemy.alive) return;
                        
                        // Check collision
                        if (checkCircleCollision(enemy.x, enemy.y, enemy.size, 
                                                clone.x, clone.y, p.size || 20)) {
                            // Create unique key for this enemy-clone pair
                            const cooldownKey = `${enemy.id}-clone-${cloneIndex}`;
                            const lastDamageTime = checkEnemiesVsClones.damageCooldowns.get(cooldownKey) || 0;
                            
                            // Only apply damage if cooldown has passed
                            if (currentTime - lastDamageTime >= damageCooldownMs) {
                                // Clone takes damage from enemy
                                const damageAmount = enemy.damage || 5;
                                if (clone.takeDamage) {
                                    clone.takeDamage(damageAmount, {
                                        particleColor: '#666666'
                                    });
                                } else if (clone.health !== undefined) {
                                    clone.health = Math.max(0, clone.health - damageAmount);
                                    clone.hp = clone.health;
                                    if (clone.health <= 0) {
                                        clone.alive = false;
                                        clone.dead = true;
                                    }
                                }
                                
                                // Update cooldown
                                checkEnemiesVsClones.damageCooldowns.set(cooldownKey, currentTime);
                                
                                if (!clone.takeDamage) {
                                    if (typeof createDamageNumber !== 'undefined') {
                                        createDamageNumber(clone.x, clone.y, damageAmount, false, false);
                                    }
                                    if (typeof createParticleBurst !== 'undefined') {
                                        createParticleBurst(clone.x, clone.y, '#666666', 4);
                                    }
                                }
                            }
                        }
                    });
                }
            });
        }
        
        // Check blink decoy (Mage)
        if (p.blinkDecoyActive && p.blinkDecoyHealth !== undefined) {
            enemies.forEach(enemy => {
                if (!enemy.alive) return;
                
                // Check collision
                if (checkCircleCollision(enemy.x, enemy.y, enemy.size, 
                                        p.blinkDecoyX, p.blinkDecoyY, p.size || 20)) {
                    // Create unique key for this enemy-decoy pair
                    const cooldownKey = `${enemy.id}-decoy`;
                    const lastDamageTime = checkEnemiesVsClones.damageCooldowns.get(cooldownKey) || 0;
                    
                    // Only apply damage if cooldown has passed
                    if (currentTime - lastDamageTime >= damageCooldownMs) {
                        // Decoy takes damage from enemy
                        const damageAmount = enemy.damage || 5;
                        if (typeof p.applyBlinkDecoyDamage === 'function') {
                            p.applyBlinkDecoyDamage(damageAmount, {
                                particleColor: '#96c8ff'
                            });
                        } else {
                            p.blinkDecoyHealth -= damageAmount;
                            
                            // Create damage number if available
                            if (typeof createDamageNumber !== 'undefined') {
                                createDamageNumber(p.blinkDecoyX, p.blinkDecoyY, damageAmount, false, false);
                            }
                            
                            // Visual feedback: particles
                            if (typeof createParticleBurst !== 'undefined') {
                                createParticleBurst(p.blinkDecoyX, p.blinkDecoyY, '#96c8ff', 4);
                            }
                            
                            if (p.blinkDecoyHealth <= 0) {
                                p.blinkDecoyActive = false;
                                p.blinkDecoyHealth = 0;
                            }
                        }
                        
                        // Update cooldown
                        checkEnemiesVsClones.damageCooldowns.set(cooldownKey, currentTime);
                    }
                }
            });
        }
    });
    
    // Clean up old cooldown entries (older than 5 seconds)
    const cleanupThreshold = currentTime - 5000;
    for (const [key, time] of checkEnemiesVsClones.damageCooldowns.entries()) {
        if (time < cleanupThreshold) {
            checkEnemiesVsClones.damageCooldowns.delete(key);
        }
    }
}

// Chain Lightning legendary effect - chains to nearby enemies
function chainLightningAttack(player, sourceEnemy, effect, damage) {
    if (!effect || typeof Game === 'undefined' || !Game.enemies) return;
    
    const enemies = Game.enemies;
    const chainCount = effect.chainCount || 2;
    const chainDamageMultiplier = effect.chainDamage || 0.7;
    const chainRange = effect.chainRange || 150;
    
    // Get player ID for damage attribution
    const attackerId = player ? (player.playerId || (typeof Game !== 'undefined' && Game.getLocalPlayerId ? Game.getLocalPlayerId() : null)) : null;
    
    const hitEnemies = new Set([sourceEnemy]);
    let currentTarget = sourceEnemy;
    
    for (let i = 0; i < chainCount; i++) {
        // Find nearest enemy within range that hasn't been hit
        let nearestEnemy = null;
        let nearestDist = chainRange;
        
        enemies.forEach(enemy => {
            if (!enemy.alive || hitEnemies.has(enemy)) return;
            
            const dx = enemy.x - currentTarget.x;
            const dy = enemy.y - currentTarget.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < nearestDist) {
                nearestDist = dist;
                nearestEnemy = enemy;
            }
        });
        
        if (nearestEnemy) {
            // Apply reduced damage per chain
            const chainDamage = damage * Math.pow(chainDamageMultiplier, i + 1);
            const damageDealt = Math.min(chainDamage, nearestEnemy.hp);
            
            nearestEnemy.takeDamage(chainDamage, attackerId);
            hitEnemies.add(nearestEnemy);
            
            // Track stats (host/solo only)
            const isClient = typeof Game !== 'undefined' && Game.isMultiplayerClient && Game.isMultiplayerClient();
            if (!isClient) {
                // Track lifetime damage stat
                if (typeof window.trackLifetimeStat === 'function') {
                    window.trackLifetimeStat('totalDamageDealt', damageDealt);
                }
                
                if (typeof Game !== 'undefined' && Game.getPlayerStats && attackerId) {
                    const stats = Game.getPlayerStats(attackerId);
                    if (stats) {
                        stats.addStat('damageDealt', damageDealt);
                    }
                    
                    // Track kill if enemy died
                    if (nearestEnemy.hp <= 0) {
                        const killStats = Game.getPlayerStats(attackerId);
                        if (killStats) {
                            killStats.addStat('kills', 1);
                        }
                    }
                }
            }
            
            // Apply lifesteal
            if (player) {
                applyLifesteal(player, damageDealt);
            }
            
            // Create visual arc
            if (typeof createLightningArc !== 'undefined') {
                createLightningArc(currentTarget.x, currentTarget.y, nearestEnemy.x, nearestEnemy.y);
            }
            
            // Damage number
            if (typeof createDamageNumber !== 'undefined') {
                createDamageNumber(nearestEnemy.x, nearestEnemy.y, Math.floor(chainDamage), false, false);
            }
            
            currentTarget = nearestEnemy;
        } else {
            break; // No more enemies in range
        }
    }
}

// Chain Lightning affix - chains to nearby enemies
// Card-based chain lightning (Fractal Conduit)
function chainLightningCard(player, sourceEnemy, chainCount, damage, enemies, range, lifeOnChain) {
    if (!enemies || enemies.length === 0) return;
    
    const attackerId = player ? (player.playerId || (typeof Game !== 'undefined' && Game.getLocalPlayerId ? Game.getLocalPlayerId() : null)) : null;
    const chainRange = range || 300;
    const hitEnemies = new Set([sourceEnemy]);
    let currentTarget = sourceEnemy;
    const isClient = typeof Game !== 'undefined' && Game.isMultiplayerClient && Game.isMultiplayerClient();
    
    for (let i = 0; i < chainCount; i++) {
        let nearestEnemy = null;
        let nearestDist = chainRange;
        
        enemies.forEach(enemy => {
            if (!enemy.alive || hitEnemies.has(enemy)) return;
            
            const dx = enemy.x - currentTarget.x;
            const dy = enemy.y - currentTarget.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < nearestDist) {
                nearestDist = dist;
                nearestEnemy = enemy;
            }
        });
        
        if (nearestEnemy) {
            const chainDamage = damage; // Already reduced by card's chainDamage multiplier
            const damageDealt = Math.min(chainDamage, nearestEnemy.hp);
            
            nearestEnemy.takeDamage(chainDamage, attackerId);
            hitEnemies.add(nearestEnemy);
            
            // Lifesteal on chain if available
            if (!isClient && lifeOnChain && lifeOnChain > 0 && player) {
                const healAmount = damageDealt * lifeOnChain;
                player.hp = Math.min(player.hp + healAmount, player.maxHp);
            }
            
            // Track stats (host/solo only)
            if (!isClient) {
                // Track lifetime damage stat
                if (typeof window.trackLifetimeStat === 'function') {
                    window.trackLifetimeStat('totalDamageDealt', damageDealt);
                }
                
                if (typeof Game !== 'undefined' && Game.getPlayerStats && attackerId) {
                    const stats = Game.getPlayerStats(attackerId);
                    if (stats) {
                        stats.addStat('damageDealt', damageDealt);
                        if (nearestEnemy.hp <= 0) {
                            // Track lifetime kills stat
                            if (typeof window.trackLifetimeStat === 'function') {
                                window.trackLifetimeStat('totalKills', 1);
                            }
                            stats.addStat('kills', 1);
                        }
                    }
                }
            }
            
            currentTarget = nearestEnemy;
        } else {
            break; // No more targets in range
        }
    }
}

function chainLightningAffix(player, sourceEnemy, chainCount, damage, enemies) {
    if (!enemies || enemies.length === 0) return;
    
    // Get player ID for damage attribution
    const attackerId = player ? (player.playerId || (typeof Game !== 'undefined' && Game.getLocalPlayerId ? Game.getLocalPlayerId() : null)) : null;
    
    const chainRange = 150;
    const hitEnemies = new Set([sourceEnemy]);
    let currentTarget = sourceEnemy;
    
    for (let i = 0; i < chainCount; i++) {
        // Find nearest enemy within range that hasn't been hit
        let nearestEnemy = null;
        let nearestDist = chainRange;
        
        enemies.forEach(enemy => {
            if (!enemy.alive || hitEnemies.has(enemy)) return;
            
            const dx = enemy.x - currentTarget.x;
            const dy = enemy.y - currentTarget.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < nearestDist) {
                nearestDist = dist;
                nearestEnemy = enemy;
            }
        });
        
        if (nearestEnemy) {
            // Apply reduced damage
            const chainDamage = damage * Math.pow(0.7, i + 1); // 70% per chain
            const damageDealt = Math.min(chainDamage, nearestEnemy.hp);
            
            nearestEnemy.takeDamage(chainDamage, attackerId);
            hitEnemies.add(nearestEnemy);
            
            // Track stats (host/solo only)
            const isClient = typeof Game !== 'undefined' && Game.isMultiplayerClient && Game.isMultiplayerClient();
            if (!isClient && typeof Game !== 'undefined' && Game.getPlayerStats && attackerId) {
                const stats = Game.getPlayerStats(attackerId);
                if (stats) {
                    stats.addStat('damageDealt', damageDealt);
                }
                
                // Track kill if enemy died
                if (nearestEnemy.hp <= 0) {
                    const killStats = Game.getPlayerStats(attackerId);
                    if (killStats) {
                        killStats.addStat('kills', 1);
                    }
                }
            }
            
            // Apply lifesteal
            if (player) {
                applyLifesteal(player, damageDealt);
            }
            
            // Create visual arc
            if (typeof createLightningArc !== 'undefined') {
                createLightningArc(currentTarget.x, currentTarget.y, nearestEnemy.x, nearestEnemy.y);
            }
            
            // Damage number
            if (typeof createDamageNumber !== 'undefined') {
                createDamageNumber(nearestEnemy.x, nearestEnemy.y, Math.floor(chainDamage), false, false);
            }
            
            currentTarget = nearestEnemy;
        } else {
            break; // No more enemies in range
        }
    }
}

// Create explosion AoE from explosive attacks affix
function createExplosion(x, y, radius, damage, player, enemies) {
    if (!enemies || enemies.length === 0) return;
    
    // Get player ID for damage attribution
    const attackerId = player ? (player.playerId || (typeof Game !== 'undefined' && Game.getLocalPlayerId ? Game.getLocalPlayerId() : null)) : null;
    
    // Visual effect
    if (typeof createParticleBurst !== 'undefined') {
        createParticleBurst(x, y, '#ff9900', 12);
    }
    
    // Damage all enemies in radius
    enemies.forEach(enemy => {
        if (!enemy.alive) return;
        
        const dx = enemy.x - x;
        const dy = enemy.y - y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < radius + enemy.size) {
            const damageDealt = Math.min(damage, enemy.hp);
            
            enemy.takeDamage(damage, attackerId);
            
            // Track stats (host/solo only)
            const isClient = typeof Game !== 'undefined' && Game.isMultiplayerClient && Game.isMultiplayerClient();
            if (!isClient && typeof Game !== 'undefined' && Game.getPlayerStats && attackerId) {
                const stats = Game.getPlayerStats(attackerId);
                if (stats) {
                    stats.addStat('damageDealt', damageDealt);
                }
                
                // Track kill if enemy died
                if (enemy.hp <= 0) {
                    const killStats = Game.getPlayerStats(attackerId);
                    if (killStats) {
                        killStats.addStat('kills', 1);
                    }
                }
            }
            
            // Apply lifesteal
            if (player) {
                applyLifesteal(player, damageDealt);
            }
            
            // Damage number
            if (typeof createDamageNumber !== 'undefined') {
                createDamageNumber(enemy.x, enemy.y, Math.floor(damage), false, false);
            }
        }
    });
}
