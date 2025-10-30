// Base enemy class with common functionality

class EnemyBase {
    constructor(x, y) {
        // Position
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        
        // Knockback system
        this.knockbackVx = 0;
        this.knockbackVy = 0;
        this.knockbackDecay = 0.5; // Per second decay rate (faster decay = shorter knockback)
        
        // Common properties
        this.alive = true;
        
        // Squad system
        this.squad = null;
        this.squadId = null;
        this.desiredFormationPos = null;
        this.isAttacking = false; // Track if currently attacking (for squad queue)
        
        // Default stats (will be overridden by subclasses)
        this.size = 20;
        this.maxHp = 30;
        this.hp = 30;
        this.damage = 5;
        this.moveSpeed = 100;
        this.color = '#ff6b6b';
        this.xpValue = 10;
        this.lootChance = 0.3;
    }
    
    // Apply knockback force
    applyKnockback(forceX, forceY) {
        this.knockbackVx = forceX;
        this.knockbackVy = forceY;
    }
    
    // Find the target to chase (handles decoy/clone logic)
    findTarget(player) {
        if (!player || !player.alive) return { x: this.x, y: this.y };
        
        let targetX = player.x;
        let targetY = player.y;
        
        // Check if player has a blink decoy or shadow clones active - target decoy/clone instead of player
        if (player.blinkDecoyActive) {
            targetX = player.blinkDecoyX;
            targetY = player.blinkDecoyY;
        } else if (player.shadowClonesActive && player.shadowClones && player.shadowClones.length > 0) {
            // Target the nearest shadow clone instead of the player
            let nearestDist = Infinity;
            let nearestClone = null;
            
            player.shadowClones.forEach(clone => {
                const dist = Math.sqrt((clone.x - this.x) ** 2 + (clone.y - this.y) ** 2);
                if (dist < nearestDist) {
                    nearestDist = dist;
                    nearestClone = clone;
                }
            });
            
            if (nearestClone) {
                targetX = nearestClone.x;
                targetY = nearestClone.y;
            }
        }
        
        return { x: targetX, y: targetY };
    }
    
    // Process knockback (should be called before AI movement in update)
    processKnockback(deltaTime) {
        if (this.knockbackVx !== 0 || this.knockbackVy !== 0) {
            this.x += this.knockbackVx * deltaTime;
            this.y += this.knockbackVy * deltaTime;
            
            // Decay knockback over time
            this.knockbackVx *= Math.pow(this.knockbackDecay, deltaTime);
            this.knockbackVy *= Math.pow(this.knockbackDecay, deltaTime);
            
            // Stop if knockback is very small
            if (Math.abs(this.knockbackVx) < 1) this.knockbackVx = 0;
            if (Math.abs(this.knockbackVy) < 1) this.knockbackVy = 0;
        }
    }
    
    // Take damage
    takeDamage(damage) {
        this.hp -= damage;
        
        if (this.hp <= 0) {
            this.die();
        }
    }
    
    // Die and handle death logic
    die() {
        this.alive = false;
        
        // Release attack slot if in squad
        if (this.squad) {
            this.squad.releaseAttack(this);
            this.squad.removeMember(this);
        }
        
        // Emit particles on death
        if (typeof createParticleBurst !== 'undefined') {
            createParticleBurst(this.x, this.y, this.color, 12);
        }
        
        // Give player XP when enemy dies
        if (typeof Game !== 'undefined' && Game.player && !Game.player.dead) {
            Game.player.addXP(this.xpValue);
        }
        
        // Drop loot based on lootChance
        if (typeof generateGear !== 'undefined' && typeof groundLoot !== 'undefined') {
            if (Math.random() < this.lootChance) {
                const gear = generateGear(this.x, this.y);
                groundLoot.push(gear);
            }
        }
    }
    
    // Request attack permission from squad
    requestAttackPermission() {
        if (!this.squad) {
            return true; // No squad = can always attack (early rooms)
        }
        
        return this.squad.requestAttack(this);
    }
    
    // Check if can attack (for squad coordination)
    canAttack() {
        if (!this.squad) {
            return true; // No squad = can always attack
        }
        
        return this.squad.canAttack(this);
    }
    
    // Release attack slot (call when attack ends)
    releaseAttackPermission() {
        if (this.squad) {
            this.squad.releaseAttack(this);
        }
        this.isAttacking = false;
    }
    
    // Keep enemy within canvas bounds
    keepInBounds() {
        if (typeof Game !== 'undefined') {
            this.x = clamp(this.x, this.size, Game.canvas.width - this.size);
            this.y = clamp(this.y, this.size, Game.canvas.height - this.size);
        }
    }
    
    // Render health bar
    renderHealthBar(ctx) {
        const barWidth = this.size * 2;
        const barHeight = 3;
        const barX = this.x - barWidth / 2;
        const barY = this.y - this.size - 10;
        
        // Draw background (total HP bar in red)
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(barX, barY, barWidth, barHeight);
        
        // Draw foreground (current HP bar in green)
        const hpPercent = this.hp / this.maxHp;
        ctx.fillStyle = '#00ff00';
        ctx.fillRect(barX, barY, barWidth * hpPercent, barHeight);
        
        // Draw border
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barWidth, barHeight);
    }
    
    // Abstract methods - subclasses must implement
    update(deltaTime, player) {
        throw new Error('EnemyBase.update() must be implemented by subclass');
    }
    
    render(ctx) {
        throw new Error('EnemyBase.render() must be implemented by subclass');
    }
}

