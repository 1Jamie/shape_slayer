// Combat system - collision detection and damage calculations

// Check collision between two circles
function checkCircleCollision(x1, y1, r1, x2, y2, r2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance < (r1 + r2);
}

// Calculate damage with modifiers
function calculateDamage(baseDamage, gearMultiplier = 1, defense = 0, critMultiplier = 1) {
    const damage = baseDamage * gearMultiplier;
    const mitigatedDamage = damage * (1 - defense);
    return mitigatedDamage * critMultiplier;
}

// Check attacks vs enemies and handle collisions
function checkAttacksVsEnemies(player, enemies) {
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
                
                // Calculate final damage with backstab multiplier
                let finalDamage = hitbox.damage;
                if (isBackstab) {
                    finalDamage *= 2; // 2x damage for backstab
                }
                
                // Get attacker ID for aggro system
                const attackerId = typeof Game !== 'undefined' && Game.getLocalPlayerId ? Game.getLocalPlayerId() : null;
                
                // Only apply damage if we're the host or in solo mode
                // Clients send damage events and wait for host's authoritative response
                const isClient = typeof Game !== 'undefined' && Game.isMultiplayerClient && Game.isMultiplayerClient();
                
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
                        // Moderate knockback force (120-150)
                        const knockbackForce = 135;
                        const knockbackX = (knockbackDx / knockbackDist) * knockbackForce;
                        const knockbackY = (knockbackDy / knockbackDist) * knockbackForce;
                        enemy.applyKnockback(knockbackX, knockbackY);
                    }
                    
                    // Apply light stun (0.5-0.8 seconds)
                    const stunDuration = 0.65;
                    enemy.applyStun(stunDuration);
                    
                    // Trigger screen shake on hammer hit
                    if (typeof Game !== 'undefined') {
                        Game.triggerScreenShake(0.25, 0.1);
                    }
                }
                
                // Calculate actual damage dealt (accounting for weak point and backstab multipliers)
                let damageDealt = hitWeakPoint ? finalDamage * 3 : finalDamage;
                // Don't cap by enemy.hp on clients since they don't have authoritative HP
                if (!isClient) {
                    damageDealt = Math.min(damageDealt, enemy.hp);
                }
                
                // Track damage dealt in player stats (host only, updated from authoritative damage)
                if (!isClient && typeof Game !== 'undefined' && Game.getPlayerStats && Game.getLocalPlayerId) {
                    const playerId = Game.getLocalPlayerId();
                    const stats = Game.getPlayerStats(playerId);
                    stats.addStat('damageDealt', damageDealt);
                }
                
                // Multiplayer: Send damage event to host (clients send for host to process)
                if (isClient) {
                    const enemyIndex = Game.getEnemyIndex(enemy);
                    if (enemyIndex !== -1) {
                        // Send raw finalDamage, not capped by HP, so host can calculate correctly
                        Game.sendEnemyDamageEvent(enemyIndex, finalDamage, hitbox.x, hitbox.y, hitbox.radius, hitWeakPoint);
                    }
                }
                
                // Create damage number (show different color for weak point hits and backstab)
                // Show on both clients (for feedback) and host (for accuracy)
                if (typeof createDamageNumber !== 'undefined') {
                    const isHeavyAttack = hitbox.heavy || false;
                    // Position damage number at weak point if hit, otherwise at enemy center
                    let damageX = enemy.x;
                    let damageY = enemy.y;
                    if (hitWeakPoint && enemy.weakPoints && enemy.weakPoints.length > 0) {
                        // Use first hit weak point position
                        damageX = enemy.x + enemy.weakPoints[0].offsetX;
                        damageY = enemy.y + enemy.weakPoints[0].offsetY;
                    }
                    // Show damage (estimated on clients, accurate on host)
                    const displayDamage = isClient ? Math.floor(damageDealt) : damageDealt;
                    createDamageNumber(damageX, damageY, displayDamage, isHeavyAttack, hitWeakPoint);
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
        return; // Clients don't check enemy collisions, host does
    }
    
    // Get all players to check
    const playersToCheck = [];
    
    // Add local player
    if (player && player.alive && !player.invulnerable) {
        playersToCheck.push({
            id: Game.getLocalPlayerId ? Game.getLocalPlayerId() : 'local',
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
                // Get local player ID for comparison
                const localPlayerId = Game.getLocalPlayerId ? Game.getLocalPlayerId() : 'local';
                
                // Distinguish between local and remote players
                if (id === localPlayerId) {
                    // Local player: call takeDamage directly
                    p.takeDamage(enemy.damage);
                } else {
                    // Remote player: use damageRemotePlayer to properly track death with correct player ID
                    if (typeof Game !== 'undefined' && Game.damageRemotePlayer) {
                        Game.damageRemotePlayer(id, enemy.damage);
                    }
                    
                    // Send damage event to that client
                    if (typeof Game !== 'undefined' && Game.sendPlayerDamageEvent) {
                        Game.sendPlayerDamageEvent(id, enemy.damage);
                    }
                }
            }
        });
    });
}

