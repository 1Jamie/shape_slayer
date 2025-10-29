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
            
            if (checkCircleCollision(hitbox.x, hitbox.y, hitbox.radius, enemy.x, enemy.y, enemy.size)) {
                // Enemy takes damage
                const damageDealt = Math.min(hitbox.damage, enemy.hp);
                enemy.takeDamage(hitbox.damage);
                
                // Create damage number
                if (typeof createDamageNumber !== 'undefined') {
                    const isHeavyAttack = hitbox.heavy || false;
                    createDamageNumber(enemy.x, enemy.y, damageDealt, isHeavyAttack);
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

