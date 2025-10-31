// Basic enemy - Circle (Swarmer)

class Enemy extends EnemyBase {
    constructor(x, y) {
        super(x, y);
        
        // Stats
        this.size = 20;
        this.maxHp = 40;
        this.hp = 40;
        this.damage = 5;
        this.moveSpeed = 100;
        this.baseMoveSpeed = 100; // Store for stun system
        
        // Properties
        this.color = '#ff6b6b';
        this.xpValue = 10;
        this.lootChance = 0.3;
        
        // Initialize attack range variance for this instance
        this.currentAttackRange = this.attackRange + (Math.random() - 0.5) * this.attackRangeVariance * 2;
        
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
        this.attackRangeVariance = 10; // ±10px variance to prevent synchronized attacks
        this.currentAttackRange = this.attackRange; // Varies per enemy instance
    }
    
    update(deltaTime, player) {
        if (!this.alive || !player.alive) return;
        
        // Process stun first
        this.processStun(deltaTime);
        
        // Apply stun slow factor to movement speed
        if (this.stunned) {
            this.moveSpeed = this.baseMoveSpeed * this.stunSlowFactor;
        } else {
            this.moveSpeed = this.baseMoveSpeed;
        }
        
        // Update attack cooldown (slower when stunned)
        if (this.attackCooldown > 0) {
            const cooldownDelta = this.stunned ? deltaTime * this.stunSlowFactor : deltaTime;
            this.attackCooldown -= cooldownDelta;
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
        
        // AI behavior based on state
        if (this.state === 'chase') {
            // Normal chase behavior with separation and swarming
            if (distance < this.currentAttackRange && this.attackCooldown <= 0) {
                // Start telegraph
                this.state = 'telegraph';
                this.telegraphElapsed = 0;
            } else {
                // Apply separation force to avoid crowding
                const separation = this.getSeparationForce(enemies, 40, 150);
                
                // Optional: Get group center for swarming behavior
                const groupCenter = this.getGroupCenter(enemies, 150, true); // Same type only
                
                // Calculate movement direction
                let moveX = dx / distance;
                let moveY = dy / distance;
                
                // Blend toward group center if in a swarm
                if (groupCenter) {
                    const toGroupX = groupCenter.x - this.x;
                    const toGroupY = groupCenter.y - this.y;
                    const toGroupDist = Math.sqrt(toGroupX * toGroupX + toGroupY * toGroupY);
                    if (toGroupDist > 0) {
                        // Blend 70% toward player, 30% toward group center
                        moveX = moveX * 0.7 + (toGroupX / toGroupDist) * 0.3;
                        moveY = moveY * 0.7 + (toGroupY / toGroupDist) * 0.3;
                        const moveDist = Math.sqrt(moveX * moveX + moveY * moveY);
                        if (moveDist > 0) {
                            moveX /= moveDist;
                            moveY /= moveDist;
                        }
                    }
                }
                
                // Apply separation force (normalized and blended)
                const sepDist = Math.sqrt(separation.x * separation.x + separation.y * separation.y);
                if (sepDist > 0) {
                    const sepNormX = separation.x / sepDist;
                    const sepNormY = separation.y / sepDist;
                    const sepStrength = Math.min(sepDist, 100) / 100; // Normalize to 0-1
                    
                    // Blend movement with separation (80% movement, 20% separation)
                    moveX = moveX * 0.8 + sepNormX * 0.2 * sepStrength;
                    moveY = moveY * 0.8 + sepNormY * 0.2 * sepStrength;
                    
                    // Renormalize
                    const finalDist = Math.sqrt(moveX * moveX + moveY * moveY);
                    if (finalDist > 0) {
                        moveX /= finalDist;
                        moveY /= finalDist;
                    }
                }
                
                // Move with calculated direction
                this.vx = moveX * this.moveSpeed;
                this.vy = moveY * this.moveSpeed;
                this.x += this.vx * deltaTime;
                this.y += this.vy * deltaTime;
                
                // Update rotation to face movement direction
                if (this.vx !== 0 || this.vy !== 0) {
                    this.rotation = Math.atan2(this.vy, this.vx);
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
            
            // Update rotation to face lunge direction
            this.rotation = Math.atan2(lungeDirY, lungeDirX);
            
            if (this.lungeElapsed >= this.lungeDuration) {
                // End lunge
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
                // Apply separation during cooldown too
                const separation = this.getSeparationForce(enemies, 40, 150);
                const sepDist = Math.sqrt(separation.x * separation.x + separation.y * separation.y);
                
                let moveX = dx / distance;
                let moveY = dy / distance;
                
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
                
                this.vx = moveX * this.moveSpeed;
                this.vy = moveY * this.moveSpeed;
                this.x += this.vx * deltaTime;
                this.y += this.vy * deltaTime;
            }
        }
        
        // Resolve stacking with other enemies
        if (enemies.length > 0) {
            this.resolveStacking(enemies);
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
        
        // Draw facing direction indicator (white dot)
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(
            this.x + Math.cos(this.rotation) * (this.size + 5),
            this.y + Math.sin(this.rotation) * (this.size + 5),
            5, 0, Math.PI * 2
        );
        ctx.fill();
    }
}

