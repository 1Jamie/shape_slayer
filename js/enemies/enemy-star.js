// Star enemy - ranged enemy type

class StarEnemy extends EnemyBase {
    constructor(x, y) {
        super(x, y);
        
        // Stats
        this.size = 22;
        this.maxHp = 40;
        this.hp = 40;
        this.damage = 8;
        this.moveSpeed = 80;
        
        // Properties
        this.color = '#ffcc00'; // Yellow
        this.xpValue = 20;
        this.lootChance = 0.35;
        
        // Shooting system
        this.attackCooldown = 0;
        this.attackCooldownTime = 2.0;
        this.shootRange = 175; // Ideal distance (150-200)
        this.minRange = 100;
        this.maxRange = 200;
        this.strafeTimer = Math.random() * Math.PI * 2; // Random starting phase for strafing
        this.strafeSpeed = 2.0; // Speed of strafing motion
        this.strafeAmplitude = 40; // How far to strafe
    }
    
    update(deltaTime, player) {
        if (!this.alive || !player.alive) return;
        
        // Update attack cooldown
        if (this.attackCooldown > 0) {
            this.attackCooldown -= deltaTime;
        }
        
        // Get target (handles decoy/clone logic)
        const target = this.findTarget(player);
        const targetX = target.x;
        const targetY = target.y;
        
        // Calculate direction from enemy to target
        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Avoid division by zero
        if (distance <= 0) return;
        
        // Apply knockback first (before any AI movement)
        this.processKnockback(deltaTime);
        
        // Get enemies array for AI behaviors
        const enemies = (typeof Game !== 'undefined' && Game.enemies) ? Game.enemies : [];
        
        // Update strafe timer
        this.strafeTimer += deltaTime * this.strafeSpeed;
        
        // Distance-based AI with strafing and separation
        if (distance < this.minRange) {
            // Too close - move away with strafing
            const awayDirX = -dx / distance;
            const awayDirY = -dy / distance;
            
            // Add perpendicular strafing
            const perpX = -awayDirY;
            const perpY = awayDirX;
            const strafeOffset = Math.sin(this.strafeTimer) * this.strafeAmplitude;
            
            // Apply separation from other enemies
            const separation = this.getSeparationForce(enemies, 50, 120);
            const sepDist = Math.sqrt(separation.x * separation.x + separation.y * separation.y);
            
            let moveX = awayDirX;
            let moveY = awayDirY;
            
            if (sepDist > 0) {
                const sepNormX = separation.x / sepDist;
                const sepNormY = separation.y / sepDist;
                const sepStrength = Math.min(sepDist, 100) / 100;
                
                // Blend movement with separation (75% away, 25% separation)
                moveX = moveX * 0.75 + sepNormX * 0.25 * sepStrength;
                moveY = moveY * 0.75 + sepNormY * 0.25 * sepStrength;
                
                const finalDist = Math.sqrt(moveX * moveX + moveY * moveY);
                if (finalDist > 0) {
                    moveX /= finalDist;
                    moveY /= finalDist;
                }
            }
            
            this.x += moveX * this.moveSpeed * deltaTime;
            this.y += moveY * this.moveSpeed * deltaTime;
            
            // Add strafing offset
            this.x += perpX * strafeOffset * deltaTime * 0.4;
            this.y += perpY * strafeOffset * deltaTime * 0.4;
        } else if (distance > this.maxRange) {
            // Too far - move closer with separation
            const towardDirX = dx / distance;
            const towardDirY = dy / distance;
            
            // Apply separation
            const separation = this.getSeparationForce(enemies, 50, 120);
            const sepDist = Math.sqrt(separation.x * separation.x + separation.y * separation.y);
            
            let moveX = towardDirX;
            let moveY = towardDirY;
            
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
        } else {
            // Right distance - strafe and shoot
            // Strafing movement (perpendicular to player)
            const towardDirX = dx / distance;
            const towardDirY = dy / distance;
            const perpX = -towardDirY;
            const perpY = towardDirX;
            const strafeOffset = Math.sin(this.strafeTimer) * this.strafeAmplitude;
            
            // Apply separation
            const separation = this.getSeparationForce(enemies, 50, 120);
            const sepDist = Math.sqrt(separation.x * separation.x + separation.y * separation.y);
            
            // Strafing movement with separation
            let moveX = perpX;
            let moveY = perpY;
            
            if (sepDist > 0) {
                const sepNormX = separation.x / sepDist;
                const sepNormY = separation.y / sepDist;
                const sepStrength = Math.min(sepDist, 100) / 100;
                
                moveX = moveX * 0.8 + sepNormX * 0.2 * sepStrength;
                moveY = moveY * 0.8 + sepNormY * 0.2 * sepStrength;
                
                const finalDist = Math.sqrt(moveX * moveX + moveY * moveY);
                if (finalDist > 0) {
                    moveX /= finalDist;
                    moveY /= finalDist;
                }
            }
            
            this.x += moveX * this.moveSpeed * deltaTime * 0.6; // Slower strafing
            this.y += moveY * this.moveSpeed * deltaTime * 0.6;
            
            // Add slight adjustment toward ideal range
            const rangeDiff = distance - this.shootRange;
            if (Math.abs(rangeDiff) > 10) {
                const adjustDirX = (rangeDiff > 0 ? -towardDirX : towardDirX) * 0.3;
                const adjustDirY = (rangeDiff > 0 ? -towardDirY : towardDirY) * 0.3;
                this.x += adjustDirX * this.moveSpeed * deltaTime;
                this.y += adjustDirY * this.moveSpeed * deltaTime;
            }
            
            // Try to shoot
            if (this.attackCooldown <= 0) {
                this.shoot(player);
                this.attackCooldown = this.attackCooldownTime;
            }
        }
        
        // Resolve stacking with other enemies
        if (enemies.length > 0) {
            this.resolveStacking(enemies);
        }
        
        // Keep enemy within canvas bounds
        this.keepInBounds();
    }
    
    shoot(player) {
        if (typeof Game === 'undefined') return;
        
        // Predict where player will be when projectile reaches them
        const projectileSpeed = 200;
        const distance = Math.sqrt((player.x - this.x) ** 2 + (player.y - this.y) ** 2);
        const timeToReach = distance / projectileSpeed;
        
        // Predict player position
        const predictedPos = this.predictPlayerPosition(player, timeToReach);
        
        // Calculate direction to predicted position
        const dx = predictedPos.x - this.x;
        const dy = predictedPos.y - this.y;
        const predDist = Math.sqrt(dx * dx + dy * dy);
        
        if (predDist <= 0) return;
        
        // Base direction
        let dirX = dx / predDist;
        let dirY = dy / predDist;
        
        // Add slight spread variation (±5 degrees)
        const spreadAngle = (Math.random() - 0.5) * 0.175; // ~5 degrees in radians
        const cos = Math.cos(spreadAngle);
        const sin = Math.sin(spreadAngle);
        const newDirX = dirX * cos - dirY * sin;
        const newDirY = dirX * sin + dirY * cos;
        dirX = newDirX;
        dirY = newDirY;
        
        // Spawn projectile
        Game.projectiles.push({
            x: this.x,
            y: this.y,
            vx: dirX * projectileSpeed,
            vy: dirY * projectileSpeed,
            damage: this.damage,
            size: 5,
            lifetime: 3.0,
            elapsed: 0
        });
    }
    
    render(ctx) {
        // Draw star enemy (as circle for now, could be upgraded later)
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw outline
        ctx.strokeStyle = '#ffaa00';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.stroke();
        
        // Draw health bar
        this.renderHealthBar(ctx);
    }
}

