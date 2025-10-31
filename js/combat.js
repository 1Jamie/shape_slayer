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
                
                // Pass position and radius for weak point detection (bosses will use this, others will ignore)
                if (enemy.isBoss && typeof enemy.takeDamage === 'function') {
                    // Bosses: pass position/radius for weak point detection
                    enemy.takeDamage(finalDamage, hitbox.x, hitbox.y, hitbox.radius);
                } else {
                    // Normal enemies: pass damage (with backstab multiplier if applicable)
                    enemy.takeDamage(finalDamage);
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
                damageDealt = Math.min(damageDealt, enemy.hp);
                
                // Create damage number (show different color for weak point hits and backstab)
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
                    // Show backstab with special color (purple/pink) - pass backstab flag if we add support
                    createDamageNumber(damageX, damageY, damageDealt, isHeavyAttack, hitWeakPoint);
                }
                
                // Track that we hit this enemy so we don't hit it again with this hitbox
                hitbox.hitEnemies.add(enemy);
            }
        });
    });
}

// Check enemies vs player
function checkEnemiesVsPlayer(player, enemies) {
    if (!player.alive || player.invulnerable) return;
    
    enemies.forEach(enemy => {
        if (!enemy.alive) return;
        
        if (checkCircleCollision(enemy.x, enemy.y, enemy.size, player.x, player.y, player.size)) {
            // Player takes damage
            player.takeDamage(enemy.damage);
        }
    });
}

