// Base enemy class with common functionality

class EnemyBase {
    constructor(x, y) {
        // Position
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.rotation = 0; // Facing direction (in radians, 0 = right)
        
        // Knockback system
        this.knockbackVx = 0;
        this.knockbackVy = 0;
        this.knockbackDecay = 0.5; // Per second decay rate (faster decay = shorter knockback)
        
        // Stun system
        this.stunned = false;
        this.stunDuration = 0;
        this.stunSlowFactor = 0.5; // 50% speed reduction when stunned
        this.baseMoveSpeed = 100; // Store original move speed before stun
        
        // Common properties
        this.alive = true;
        
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
    
    // Apply stun effect
    applyStun(duration) {
        this.stunned = true;
        this.stunDuration = duration;
        // Store base move speed if not already stored
        if (this.baseMoveSpeed === undefined || this.baseMoveSpeed === null) {
            this.baseMoveSpeed = this.moveSpeed;
        }
    }
    
    // Process stun (should be called in update before movement)
    processStun(deltaTime) {
        if (this.stunned && this.stunDuration > 0) {
            this.stunDuration -= deltaTime;
            if (this.stunDuration <= 0) {
                this.stunned = false;
                this.stunDuration = 0;
            }
        }
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
    
    // AI Behavior Methods - Shared across all enemies
    
    // Calculate separation force to avoid crowding with other enemies
    getSeparationForce(enemies, separationRadius = 40, separationStrength = 150) {
        if (!enemies || enemies.length === 0) return { x: 0, y: 0 };
        
        let separationX = 0;
        let separationY = 0;
        let count = 0;
        
        enemies.forEach(other => {
            if (other === this || !other.alive) return;
            
            const dx = this.x - other.x;
            const dy = this.y - other.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist > 0 && dist < separationRadius) {
                const strength = separationStrength / (dist + 1);
                separationX += (dx / dist) * strength;
                separationY += (dy / dist) * strength;
                count++;
            }
        });
        
        if (count > 0) {
            return { x: separationX, y: separationY };
        }
        return { x: 0, y: 0 };
    }
    
    // Calculate avoidance force to dodge player attacks
    avoidPlayerAttacks(player, avoidanceRadius = 60) {
        if (!player || !player.attackHitboxes || player.attackHitboxes.length === 0) {
            return { x: 0, y: 0 };
        }
        
        let avoidanceX = 0;
        let avoidanceY = 0;
        
        player.attackHitboxes.forEach(hitbox => {
            const dx = this.x - hitbox.x;
            const dy = this.y - hitbox.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < avoidanceRadius && dist > 0) {
                const strength = (avoidanceRadius - dist) / avoidanceRadius * 200;
                avoidanceX += (dx / dist) * strength;
                avoidanceY += (dy / dist) * strength;
            }
        });
        
        return { x: avoidanceX, y: avoidanceY };
    }
    
    // Predict where player will be based on current velocity
    predictPlayerPosition(player, timeToReach) {
        if (!player || !player.alive) return { x: this.x, y: this.y };
        
        // If player isn't moving, return current position
        if (!player.vx && !player.vy) {
            return { x: player.x, y: player.y };
        }
        
        // Predict based on current velocity (with damping for accuracy)
        const predictedX = player.x + player.vx * timeToReach * 0.7;
        const predictedY = player.y + player.vy * timeToReach * 0.7;
        
        return { x: predictedX, y: predictedY };
    }
    
    // Find center of nearby group of enemies (for swarming behavior)
    getGroupCenter(enemies, maxRadius = 150, sameTypeOnly = false) {
        if (!enemies || enemies.length === 0) return null;
        
        let centerX = 0;
        let centerY = 0;
        let count = 0;
        
        enemies.forEach(other => {
            if (other === this || !other.alive) return;
            
            // Check if same type if required
            if (sameTypeOnly && other.constructor !== this.constructor) return;
            
            const dx = this.x - other.x;
            const dy = this.y - other.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < maxRadius) {
                centerX += other.x;
                centerY += other.y;
                count++;
            }
        });
        
        if (count > 0) {
            return { x: centerX / count, y: centerY / count };
        }
        return null;
    }
    
    // Resolve stacking/overlapping with other enemies (post-movement correction)
    resolveStacking(enemies, minDistance = null) {
        if (!enemies || enemies.length === 0) return;
        
        // Default minDistance is sum of radii + padding
        if (minDistance === null) {
            minDistance = this.size * 2 + 5; // 5px padding
        }
        
        enemies.forEach(other => {
            if (other === this || !other.alive) return;
            
            const dx = this.x - other.x;
            const dy = this.y - other.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            // If too close, push apart
            if (dist > 0 && dist < minDistance) {
                const overlap = minDistance - dist;
                const pushStrength = overlap * 0.5; // Gentle push to avoid jitter
                
                const pushX = (dx / dist) * pushStrength;
                const pushY = (dy / dist) * pushStrength;
                
                // Only move this enemy (other will handle its own separation)
                this.x += pushX;
                this.y += pushY;
            }
        });
    }
    
    // Abstract methods - subclasses must implement
    update(deltaTime, player) {
        throw new Error('EnemyBase.update() must be implemented by subclass');
    }
    
    render(ctx) {
        throw new Error('EnemyBase.render() must be implemented by subclass');
    }
}

