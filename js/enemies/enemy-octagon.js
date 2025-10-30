// Octagon enemy - elite type

class OctagonEnemy extends EnemyBase {
    constructor(x, y) {
        super(x, y);
        
        // Stats
        this.size = 22;
        this.maxHp = 80;
        this.hp = 80;
        this.damage = 12;
        this.moveSpeed = 110;
        
        // Properties
        this.color = '#ffd700'; // Gold
        this.xpValue = 50;
        this.lootChance = 0.6;
        
        // Attack system
        this.state = 'chase'; // 'chase', 'spin', 'charge', 'shoot'
        this.attackCooldown = 0;
        this.attackCooldownTime = 3.0;
        this.spinDuration = 1.0;
        this.spinElapsed = 0;
        this.chargeDuration = 0.5;
        this.chargeElapsed = 0;
        this.shootCooldown = 0;
        this.shootCooldownTime = 1.5;
        this.minionSummonCooldown = 5.0;
        this.minionSummonElapsed = 0;
        this.attackRange = 75;
        this.postAttackPause = 0; // Brief pause after attacks
        this.postAttackPauseTime = 0.3;
    }
    
    update(deltaTime, player) {
        if (!this.alive || !player.alive) return;
        
        if (this.attackCooldown > 0) {
            this.attackCooldown -= deltaTime;
        }
        if (this.shootCooldown > 0) {
            this.shootCooldown -= deltaTime;
        }
        
        if (this.postAttackPause > 0) {
            this.postAttackPause -= deltaTime;
        }
        
        this.minionSummonElapsed += deltaTime;
        
        // Get target (handles decoy/clone logic)
        const target = this.findTarget(player);
        const targetX = target.x;
        const targetY = target.y;
        
        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance <= 0) return;
        
        // Apply knockback
        this.processKnockback(deltaTime);
        
        // Get enemies array for AI behaviors
        const enemies = (typeof Game !== 'undefined' && Game.enemies) ? Game.enemies : [];
        
        // AI behavior - state-based priority system
        if (this.state === 'chase') {
            // Skip decision making during post-attack pause
            if (this.postAttackPause > 0) {
                // Just move with separation during pause
                const separation = this.getSeparationForce(enemies, 50, 120);
                const dirX = dx / distance;
                const dirY = dy / distance;
                
                let moveX = dirX;
                let moveY = dirY;
                
                // Apply separation
                const sepDist = Math.sqrt(separation.x * separation.x + separation.y * separation.y);
                if (sepDist > 0) {
                    const sepNormX = separation.x / sepDist;
                    const sepNormY = separation.y / sepDist;
                    const sepStrength = Math.min(sepDist, 100) / 100;
                    
                    moveX = moveX * 0.85 + sepNormX * 0.15 * sepStrength;
                    moveY = moveY * 0.85 + sepNormY * 0.15 * sepStrength;
                    
                    const finalDist = Math.sqrt(moveX * moveX + moveY * moveY);
                    if (finalDist > 0) {
                        moveX /= finalDist;
                        moveY /= finalDist;
                    }
                }
                
                this.x += moveX * this.moveSpeed * deltaTime;
                this.y += moveY * this.moveSpeed * deltaTime;
                return;
            }
            
            // State-based priority decision making
            const healthPercent = this.hp / this.maxHp;
            const playerAttacking = player.attackHitboxes && player.attackHitboxes.length > 0;
            
            // Count nearby enemies (same type) for group tactics
            let nearbyEnemyCount = 0;
            enemies.forEach(other => {
                if (other !== this && other.alive && other.constructor === this.constructor) {
                    const otherDx = other.x - this.x;
                    const otherDy = other.y - this.y;
                    const otherDist = Math.sqrt(otherDx * otherDx + otherDy * otherDy);
                    if (otherDist < 100) {
                        nearbyEnemyCount++;
                    }
                }
            });
            
            // Priority 1: Low HP → prioritize summoning
            if (healthPercent < 0.4 && this.minionSummonElapsed >= this.minionSummonCooldown) {
                this.summonMinions();
                this.minionSummonElapsed = 0;
                this.postAttackPause = this.postAttackPauseTime;
                return;
            }
            
            // Priority 2: Player attacking → prioritize shooting (safer)
            if (playerAttacking && this.shootCooldown <= 0) {
                this.shootRapidProjectiles(targetX, targetY);
                this.shootCooldown = this.shootCooldownTime;
                this.postAttackPause = this.postAttackPauseTime;
                return;
            }
            
            // Priority 3: Multiple nearby enemies → use spin attack (group coordination)
            if (nearbyEnemyCount >= 2 && distance < this.attackRange && this.attackCooldown <= 0) {
                this.state = 'spin';
                this.spinElapsed = 0;
                return;
            }
            
            // Priority 4: Close range → spin attack
            if (distance < this.attackRange && this.attackCooldown <= 0) {
                this.state = 'spin';
                this.spinElapsed = 0;
                return;
            }
            
            // Priority 5: Can summon and not in danger → summon
            if (this.minionSummonElapsed >= this.minionSummonCooldown && healthPercent > 0.5) {
                this.summonMinions();
                this.minionSummonElapsed = 0;
                this.postAttackPause = this.postAttackPauseTime;
                return;
            }
            
            // Priority 6: Can shoot → shoot
            if (this.shootCooldown <= 0) {
                this.shootRapidProjectiles(targetX, targetY);
                this.shootCooldown = this.shootCooldownTime;
                this.postAttackPause = this.postAttackPauseTime;
                return;
            }
            
            // Normal chase with separation
            const separation = this.getSeparationForce(enemies, 50, 120);
            const dirX = dx / distance;
            const dirY = dy / distance;
            
            let moveX = dirX;
            let moveY = dirY;
            
            // Apply separation
            const sepDist = Math.sqrt(separation.x * separation.x + separation.y * separation.y);
            if (sepDist > 0) {
                const sepNormX = separation.x / sepDist;
                const sepNormY = separation.y / sepDist;
                const sepStrength = Math.min(sepDist, 100) / 100;
                
                moveX = moveX * 0.85 + sepNormX * 0.15 * sepStrength;
                moveY = moveY * 0.85 + sepNormY * 0.15 * sepStrength;
                
                const finalDist = Math.sqrt(moveX * moveX + moveY * moveY);
                if (finalDist > 0) {
                    moveX /= finalDist;
                    moveY /= finalDist;
                }
            }
            
            this.x += moveX * this.moveSpeed * deltaTime;
            this.y += moveY * this.moveSpeed * deltaTime;
        } else if (this.state === 'spin') {
            this.spinElapsed += deltaTime;
            
            // Spin in place
            this.x += Math.cos(this.spinElapsed * 10) * this.size * deltaTime * 2;
            this.y += Math.sin(this.spinElapsed * 10) * this.size * deltaTime * 2;
            
            if (this.spinElapsed >= this.spinDuration) {
                this.state = 'charge';
                this.chargeElapsed = 0;
            }
        } else if (this.state === 'charge') {
            this.chargeElapsed += deltaTime;
            // Charge toward player
            const dirX = dx / distance;
            const dirY = dy / distance;
            
            this.x += dirX * this.moveSpeed * 2 * deltaTime;
            this.y += dirY * this.moveSpeed * 2 * deltaTime;
            
            if (this.chargeElapsed >= this.chargeDuration) {
                this.state = 'cooldown';
                this.attackCooldown = this.attackCooldownTime;
                this.spinElapsed = 0;
                this.chargeElapsed = 0;
                this.postAttackPause = this.postAttackPauseTime;
            }
        } else if (this.state === 'cooldown') {
            // Chase during cooldown
            const dirX = dx / distance;
            const dirY = dy / distance;
            
            this.x += dirX * this.moveSpeed * deltaTime;
            this.y += dirY * this.moveSpeed * deltaTime;
            
            if (this.attackCooldown <= 0) {
                this.state = 'chase';
            }
        }
        
        // Resolve stacking with other enemies
        if (enemies.length > 0) {
            this.resolveStacking(enemies);
        }
        
        // Keep within bounds
        this.keepInBounds();
    }
    
    summonMinions() {
        if (typeof Game === 'undefined') return;
        
        // Summon 2-3 minions
        const count = 2 + Math.floor(Math.random() * 2);
        
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 / count) * i;
            const distance = 60 + Math.random() * 40;
            
            const minionX = this.x + Math.cos(angle) * distance;
            const minionY = this.y + Math.sin(angle) * distance;
            
            const minion = new Enemy(minionX, minionY);
            minion.maxHp = Math.floor(minion.maxHp * 0.2); // 20% HP
            minion.hp = minion.maxHp;
            minion.damage = Math.floor(minion.damage * 0.5); // 50% damage
            minion.xpValue = Math.floor(minion.xpValue * 0.5); // 50% XP
            minion.lootChance = 0.0; // No loot from minions
            
            if (typeof currentRoom !== 'undefined' && currentRoom) {
                currentRoom.enemies.push(minion);
            }
            if (typeof Game !== 'undefined') {
                Game.enemies.push(minion);
            }
        }
    }
    
    shootRapidProjectiles(targetX, targetY) {
        if (typeof Game === 'undefined') return;
        
        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance <= 0) return;
        
        // Shoot 3 projectiles in quick succession
        for (let i = 0; i < 3; i++) {
            const offsetAngle = (i - 1) * 0.2; // Spread projectiles
            const angle = Math.atan2(dy, dx) + offsetAngle;
            
            Game.projectiles.push({
                x: this.x,
                y: this.y,
                vx: Math.cos(angle) * 250,
                vy: Math.sin(angle) * 250,
                damage: this.damage * 0.7,
                size: 6,
                lifetime: 2.0,
                elapsed: i * 0.1 // Stagger shots
            });
        }
    }
    
    render(ctx) {
        let drawColor = this.color;
        
        if (this.state === 'spin' || this.state === 'charge') {
            drawColor = '#ff6b00'; // Orange when attacking
        }
        
        // Draw octagon shape
        ctx.save();
        ctx.translate(this.x, this.y);
        
        if (this.state === 'spin') {
            ctx.rotate(this.spinElapsed * 2); // Rotate when spinning
        }
        
        ctx.fillStyle = drawColor;
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
            const angle = (Math.PI / 4) * i;
            const px = Math.cos(angle) * this.size;
            const py = Math.sin(angle) * this.size;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        
        // Draw outline
        ctx.strokeStyle = '#ffaa00';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.restore();
        
        this.renderHealthBar(ctx);
    }
}

