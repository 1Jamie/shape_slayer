// Rectangle enemy - brute type

class RectangleEnemy extends EnemyBase {
    constructor(x, y) {
        super(x, y);
        
        // Stats
        this.width = 25;
        this.height = 40;
        this.size = Math.max(this.width, this.height);
        this.maxHp = 60;
        this.hp = 60;
        this.damage = 8;
        this.moveSpeed = 60;
        
        // Properties
        this.color = '#cd7f32'; // Bronze
        this.xpValue = 25;
        this.lootChance = 0.4;
        
        // Attack system
        this.state = 'chase'; // 'chase', 'charge', 'slam'
        this.attackCooldown = 0;
        this.chargeDuration = 1.0;
        this.slamDuration = 0.3;
        this.chargeElapsed = 0;
        this.slamElapsed = 0;
        this.attackRange = 80;
        this.slamRadius = 80;
        this.sizeMultiplier = 1.0;
    }
    
    update(deltaTime, player) {
        if (!this.alive || !player.alive) return;
        
        if (this.attackCooldown > 0) {
            this.attackCooldown -= deltaTime;
        }
        
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
        
        // AI behavior
        if (this.state === 'chase') {
            if (distance < this.attackRange && this.attackCooldown <= 0) {
                // Request attack permission from squad
                if (this.requestAttackPermission()) {
                    this.state = 'charge';
                    this.chargeElapsed = 0;
                    this.sizeMultiplier = 1.0;
                    this.isAttacking = true;
                } else {
                    // Can't attack yet, maintain position or move to formation
                    if (this.squad && this.desiredFormationPos) {
                        const formDx = this.desiredFormationPos.x - this.x;
                        const formDy = this.desiredFormationPos.y - this.y;
                        const formDist = Math.sqrt(formDx * formDx + formDy * formDy);
                        if (formDist > 10) {
                            this.x += (formDx / formDist) * this.moveSpeed * 0.3 * deltaTime;
                            this.y += (formDy / formDist) * this.moveSpeed * 0.3 * deltaTime;
                        }
                    }
                }
            } else {
                // Slow chase toward player or formation
                if (this.squad && this.desiredFormationPos) {
                    const formDx = this.desiredFormationPos.x - this.x;
                    const formDy = this.desiredFormationPos.y - this.y;
                    const formDist = Math.sqrt(formDx * formDx + formDy * formDy);
                    if (formDist > 20) {
                        const blendX = (dx / distance * 0.3) + (formDx / formDist * 0.7);
                        const blendY = (dy / distance * 0.3) + (formDy / formDist * 0.7);
                        const blendDist = Math.sqrt(blendX * blendX + blendY * blendY);
                        this.x += (blendX / blendDist) * this.moveSpeed * deltaTime;
                        this.y += (blendY / blendDist) * this.moveSpeed * deltaTime;
                    } else {
                        const dirX = dx / distance;
                        const dirY = dy / distance;
                        this.x += dirX * this.moveSpeed * deltaTime;
                        this.y += dirY * this.moveSpeed * deltaTime;
                    }
                } else {
                    // Slow chase toward player
                    const dirX = dx / distance;
                    const dirY = dy / distance;
                    this.x += dirX * this.moveSpeed * deltaTime;
                    this.y += dirY * this.moveSpeed * deltaTime;
                }
            }
        } else if (this.state === 'charge') {
            // Grow larger during charge
            this.chargeElapsed += deltaTime;
            this.sizeMultiplier = 1.0 + (this.chargeElapsed / this.chargeDuration) * 0.5;
            
            if (this.chargeElapsed >= this.chargeDuration) {
                // Perform slam - damage enemies in radius
                if (typeof Game !== 'undefined') {
                    const distToPlayer = Math.sqrt((player.x - this.x) ** 2 + (player.y - this.y) ** 2);
                    if (distToPlayer < this.slamRadius && !player.invulnerable) {
                        player.takeDamage(this.damage);
                    }
                }
                // Release attack permission
                this.releaseAttackPermission();
                this.state = 'cooldown';
                this.attackCooldown = 3.0;
                this.chargeElapsed = 0;
                this.sizeMultiplier = 1.0;
            }
        } else if (this.state === 'cooldown') {
            if (this.attackCooldown <= 0) {
                this.state = 'chase';
            }
        }
        
        // Keep within bounds
        this.keepInBounds();
    }
    
    render(ctx) {
        // Draw rectangle shape
        ctx.save();
        ctx.translate(this.x, this.y);
        
        let drawColor = this.color;
        if (this.state === 'charge') {
            drawColor = '#8b0000'; // Dark red when charging
        }
        
        ctx.fillStyle = drawColor;
        ctx.beginPath();
        ctx.rect(-this.width * this.sizeMultiplier * 0.8, -this.height * this.sizeMultiplier * 0.8, 
                 this.width * this.sizeMultiplier * 1.6, this.height * this.sizeMultiplier * 1.6);
        ctx.fill();
        
        ctx.restore();
        
        // Draw slam AoE indicator
        if (this.state === 'charge') {
            ctx.save();
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.slamRadius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }
        
        this.renderHealthBar(ctx);
    }
}

