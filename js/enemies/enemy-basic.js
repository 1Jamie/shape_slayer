// Basic enemy - Circle (Swarmer)

class Enemy extends EnemyBase {
    constructor(x, y) {
        super(x, y);
        
        // Stats
        this.size = 20;
        this.maxHp = 30;
        this.hp = 30;
        this.damage = 5;
        this.moveSpeed = 100;
        
        // Properties
        this.color = '#ff6b6b';
        this.xpValue = 10;
        this.lootChance = 0.3;
        
        // Attack system
        this.state = 'chase'; // 'chase', 'telegraph', 'lunge', 'cooldown'
        this.attackCooldown = 0;
        this.attackCooldownTime = 2.0;
        this.telegraphDuration = 0.5;
        this.lungeDuration = 0.2;
        this.telegraphElapsed = 0;
        this.lungeElapsed = 0;
        this.originalSpeed = this.moveSpeed;
        this.lungeSpeed = 300;
        this.attackRange = 50;
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
        
        // AI behavior based on state
        if (this.state === 'chase') {
            // Normal chase behavior
            if (distance < this.attackRange && this.attackCooldown <= 0) {
                // Request attack permission from squad
                if (this.requestAttackPermission()) {
                    // Start telegraph
                    this.state = 'telegraph';
                    this.telegraphElapsed = 0;
                    this.isAttacking = true;
                } else {
                    // Can't attack yet, back off slightly or maintain position
                    // Move toward formation position if in squad
                    if (this.squad && this.desiredFormationPos) {
                        const formDx = this.desiredFormationPos.x - this.x;
                        const formDy = this.desiredFormationPos.y - this.y;
                        const formDist = Math.sqrt(formDx * formDx + formDy * formDy);
                        if (formDist > 10) {
                            this.x += (formDx / formDist) * this.moveSpeed * 0.5 * deltaTime;
                            this.y += (formDy / formDist) * this.moveSpeed * 0.5 * deltaTime;
                        }
                    } else {
                        // Back off slightly if can't attack
                        const backOffX = -dx / distance;
                        const backOffY = -dy / distance;
                        this.x += backOffX * this.moveSpeed * 0.3 * deltaTime;
                        this.y += backOffY * this.moveSpeed * 0.3 * deltaTime;
                    }
                }
            } else {
                // Continue chasing or move to formation
                if (this.squad && this.desiredFormationPos) {
                    const formDx = this.desiredFormationPos.x - this.x;
                    const formDy = this.desiredFormationPos.y - this.y;
                    const formDist = Math.sqrt(formDx * formDx + formDy * formDy);
                    if (formDist > 20) {
                        // Blend between formation and direct chase
                        const towardPlayer = 0.3; // 30% toward player, 70% toward formation
                        const chaseDx = dx / distance;
                        const chaseDy = dy / distance;
                        const blendX = (chaseDx * towardPlayer) + (formDx / formDist * (1 - towardPlayer));
                        const blendY = (chaseDy * towardPlayer) + (formDy / formDist * (1 - towardPlayer));
                        const blendDist = Math.sqrt(blendX * blendX + blendY * blendY);
                        this.x += (blendX / blendDist) * this.moveSpeed * deltaTime;
                        this.y += (blendY / blendDist) * this.moveSpeed * deltaTime;
                    } else {
                        // Close enough to formation, just face player
                        this.moveTowardPlayer(deltaTime, dx, dy, distance);
                    }
                } else {
                    // Continue chasing
                    this.moveTowardPlayer(deltaTime, dx, dy, distance);
                }
            }
        } else if (this.state === 'telegraph') {
            // Telegraph state - flash red
            this.telegraphElapsed += deltaTime;
            if (this.telegraphElapsed >= this.telegraphDuration) {
                // Enter lunge state
                this.state = 'lunge';
                this.lungeElapsed = 0;
            }
        } else if (this.state === 'lunge') {
            // Lunge toward player
            this.lungeElapsed += deltaTime;
            const lungeDirX = (dx / distance) * this.lungeSpeed;
            const lungeDirY = (dy / distance) * this.lungeSpeed;
            
            this.x += lungeDirX * deltaTime;
            this.y += lungeDirY * deltaTime;
            
            if (this.lungeElapsed >= this.lungeDuration) {
                // End lunge - release attack permission
                this.releaseAttackPermission();
                this.state = 'cooldown';
                this.attackCooldown = this.attackCooldownTime;
                this.telegraphElapsed = 0;
                this.lungeElapsed = 0;
            }
        } else if (this.state === 'cooldown') {
            // Cooldown state - resume normal chase
            if (this.attackCooldown <= 0) {
                this.state = 'chase';
            } else {
                this.moveTowardPlayer(deltaTime, dx, dy, distance);
            }
        }
        
        // Keep enemy within canvas bounds
        this.keepInBounds();
    }
    
    moveTowardPlayer(deltaTime, dx, dy, distance) {
        // Normalize direction
        this.vx = (dx / distance) * this.moveSpeed;
        this.vy = (dy / distance) * this.moveSpeed;
        
        // Update position
        this.x += this.vx * deltaTime;
        this.y += this.vy * deltaTime;
    }
    
    render(ctx) {
        // Draw enemy with different colors based on state
        let drawColor = this.color;
        
        if (this.state === 'telegraph') {
            // Flash red during telegraph
            const flash = Math.sin(this.telegraphElapsed * 20) > 0;
            drawColor = flash ? '#ff0000' : '#ff6b6b';
        } else if (this.state === 'lunge') {
            drawColor = '#ff3333'; // Bright red during lunge
        }
        
        ctx.fillStyle = drawColor;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw health bar
        this.renderHealthBar(ctx);
    }
}

