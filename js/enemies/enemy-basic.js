// Basic enemy - Circle (Swarmer)

// ============================================================================
// BASIC ENEMY CONFIGURATION - Adjust these values for game balancing
// ============================================================================

const BASIC_ENEMY_CONFIG = {
    // Base Stats
    size: 20,                      // Enemy size (pixels)
    maxHp: 40,                     // Maximum health points
    damage: 5,                     // Damage per hit
    moveSpeed: 100,                // Movement speed (pixels/second)
    xpValue: 10,                   // XP awarded when killed
    lootChance: 0.10,              // Chance to drop loot (0.10 = 10%, reduced for larger rooms)
    
    // Attack Behavior
    attackCooldown: 2.0,           // Time between attacks (seconds)
    telegraphDuration: 0.5,        // Telegraph warning duration (seconds)
    lungeDuration: 0.2,            // Duration of lunge attack (seconds)
    lungeSpeed: 300,               // Speed during lunge (pixels/second)
    attackRange: 50,               // Distance to initiate attack (pixels)
    attackRangeVariance: 10,       // Random variance for attack timing (±pixels)
    
    // Movement Behavior
    separationRadius: 40,          // Minimum distance from other enemies (pixels)
    separationStrength: 150,       // Force strength for separation (pixels)
    groupRadius: 150,              // Radius to find group center (pixels)
};

class Enemy extends EnemyBase {
    constructor(x, y, inheritedTarget = null) {
        super(x, y, inheritedTarget);
        
        // Stats (from config)
        this.size = BASIC_ENEMY_CONFIG.size;
        this.maxHp = BASIC_ENEMY_CONFIG.maxHp;
        this.hp = BASIC_ENEMY_CONFIG.maxHp;
        this.damage = BASIC_ENEMY_CONFIG.damage;
        this.moveSpeed = BASIC_ENEMY_CONFIG.moveSpeed;
        this.baseMoveSpeed = BASIC_ENEMY_CONFIG.moveSpeed; // Store for stun system
        
        // Properties
        this.color = '#ff6b6b';
        this.shape = 'circle';
        this.xpValue = BASIC_ENEMY_CONFIG.xpValue;
        this.lootChance = BASIC_ENEMY_CONFIG.lootChance;
        
        // Attack system
        this.state = 'chase'; // 'chase', 'telegraph', 'lunge', 'cooldown'
        this.attackCooldown = 0;
        this.attackCooldownTime = BASIC_ENEMY_CONFIG.attackCooldown;
        this.telegraphDuration = BASIC_ENEMY_CONFIG.telegraphDuration;
        this.lungeDuration = BASIC_ENEMY_CONFIG.lungeDuration;
        this.telegraphElapsed = 0;
        this.lungeElapsed = 0;
        this.originalSpeed = this.moveSpeed;
        this.lungeSpeed = BASIC_ENEMY_CONFIG.lungeSpeed;
        this.attackRange = BASIC_ENEMY_CONFIG.attackRange;
        this.attackRangeVariance = BASIC_ENEMY_CONFIG.attackRangeVariance;
        
        // Initialize attack range variance for this instance
        this.currentAttackRange = this.attackRange + (Math.random() - 0.5) * this.attackRangeVariance * 2;
    }
    
    update(deltaTime) {
        if (!this.alive) return;
        
        // Check detection range - only activate when any player is nearby
        if (!this.checkDetection()) {
            // Enemy is in standby, don't update AI
            return;
        }
        
        // Process stun first
        this.processStun(deltaTime);
        
        // Process slow timer
        this.processSlow(deltaTime);
        
        // Process burn DoT
        this.processBurn(deltaTime);
        
        // Update target lock timer
        this.updateTargetLock(deltaTime);
        
        // Update aggro target based on sliding window threat calculation
        this.updateAggroTarget();
        
        // Apply stun/slow to movement speed using base class helper
        this.moveSpeed = this.getEffectiveMoveSpeed();
        
        // Update attack cooldown (slower when stunned)
        if (this.attackCooldown > 0) {
            const cooldownDelta = this.stunned ? deltaTime * this.stunSlowFactor : deltaTime;
            this.attackCooldown -= cooldownDelta;
        }
        
        // Get target (handles decoy/clone logic, uses internal getAllAlivePlayers)
        const target = this.findTarget(null);
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
                const separation = this.getSeparationForce(enemies, BASIC_ENEMY_CONFIG.separationRadius, BASIC_ENEMY_CONFIG.separationStrength);
                
                // Optional: Get group center for swarming behavior
                const groupCenter = this.getGroupCenter(enemies, BASIC_ENEMY_CONFIG.groupRadius, true); // Same type only
                
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
                // Play lunge sound
                if (typeof AudioManager !== 'undefined' && AudioManager.sounds) {
                    AudioManager.sounds.enemyLunge();
                }
                
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
                const separation = this.getSeparationForce(enemies, BASIC_ENEMY_CONFIG.separationRadius, BASIC_ENEMY_CONFIG.separationStrength);
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
        
        // Draw status effects (burn, freeze)
        if (typeof renderBurnEffect !== 'undefined') {
            renderBurnEffect(ctx, this);
        }
        if (typeof renderFreezeEffect !== 'undefined') {
            renderFreezeEffect(ctx, this);
        }
        
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

