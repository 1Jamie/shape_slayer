// Combat system - damage calculation and combat checks

// Circle collision detection helper
function checkCircleCollision(x1, y1, r1, x2, y2, r2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance < r1 + r2;
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
                
                // Calculate final damage with backstab and crit multipliers
                let finalDamage = hitbox.damage * critMultiplier;
                if (isBackstab) {
                    const backstabMultiplier = 2 + (player.backstabMultiplierBonus || 0); // Apply class modifier
                    finalDamage *= backstabMultiplier;
                }
                
                // Execute bonus: extra damage to low HP enemies
                if (player.executeBonus && player.executeBonus > 0) {
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
                    if (typeof Game !== 'undefined' && Game.getPlayerStats && attackerId) {
                        const stats = Game.getPlayerStats(attackerId);
                        if (stats) {
                            stats.addStat('damageDealt', damageDealt);
                        }
                    }
                    
                    // Track damage toward XP (on kill)
                    if (enemy.hp <= 0) {
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
                
                // Rampage: Gain stack on kill (host/solo only)
                if (!isClient && player.rampageBonus && player.rampageBonus > 0 && enemy.hp <= 0) {
                    const maxStacks = 5;
                    if (player.rampageStacks < maxStacks) {
                        player.rampageStacks++;
                        player.rampageStackDecay = 5.0; // 5 seconds until decay
                    }
                }
                
                // Chain Lightning affix (host/solo only)
                if (!isClient && player.chainLightningCount && player.chainLightningCount > 0 && !hitbox.hasChainedAffix) {
                    chainLightningAffix(player, enemy, player.chainLightningCount, hitbox.damage * 0.5, enemies);
                    hitbox.hasChainedAffix = true;
                }
                
                // Explosive Attacks: Chance to create AoE (host/solo only)
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
    
    // Add local player if alive and not invulnerable
    if (player && player.alive && !player.invulnerable) {
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
            if (playerInstance && playerInstance.alive && !playerInstance.invulnerable) {
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
            if (checkCircleCollision(enemy.x, enemy.y, enemy.size, 
                                     p.x, p.y, p.size || 20)) {
                const cooldownKey = `${enemy.id}-${id}`;
                const lastDamageTime = checkEnemiesVsPlayer.damageCooldowns.get(cooldownKey) || 0;
                
                if (currentTime - lastDamageTime < damageCooldownMs) {
                    return;
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
                if (clone.health > 0) {
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
                                clone.health -= damageAmount;
                                
                                // Update cooldown
                                checkEnemiesVsClones.damageCooldowns.set(cooldownKey, currentTime);
                                
                                // Create damage number if available
                                if (typeof createDamageNumber !== 'undefined') {
                                    createDamageNumber(clone.x, clone.y, damageAmount, false, false);
                                }
                                
                                // Visual feedback: particles
                                if (typeof createParticleBurst !== 'undefined') {
                                    createParticleBurst(clone.x, clone.y, '#666666', 4);
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
                        p.blinkDecoyHealth -= damageAmount;
                        
                        // Update cooldown
                        checkEnemiesVsClones.damageCooldowns.set(cooldownKey, currentTime);
                        
                        // Create damage number if available
                        if (typeof createDamageNumber !== 'undefined') {
                            createDamageNumber(p.blinkDecoyX, p.blinkDecoyY, damageAmount, false, false);
                        }
                        
                        // Visual feedback: particles
                        if (typeof createParticleBurst !== 'undefined') {
                            createParticleBurst(p.blinkDecoyX, p.blinkDecoyY, '#96c8ff', 4);
                        }
                        
                        // Deactivate decoy if health depleted
                        if (p.blinkDecoyHealth <= 0) {
                            p.blinkDecoyActive = false;
                            p.blinkDecoyHealth = 0;
                        }
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

// Chain Lightning affix - chains to nearby enemies
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
