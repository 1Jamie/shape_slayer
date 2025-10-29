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
                
                // Pass position and radius for weak point detection (bosses will use this, others will ignore)
                if (enemy.isBoss && typeof enemy.takeDamage === 'function') {
                    // Bosses: pass position/radius for weak point detection
                    enemy.takeDamage(hitbox.damage, hitbox.x, hitbox.y, hitbox.radius);
                } else {
                    // Normal enemies: just pass damage
                    enemy.takeDamage(hitbox.damage);
                }
                
                // Calculate actual damage dealt (accounting for weak point multiplier)
                const damageDealt = hitWeakPoint ? Math.min(hitbox.damage * 3, enemy.hp) : Math.min(hitbox.damage, enemy.hp);
                
                // Create damage number (show different color for weak point hits)
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

