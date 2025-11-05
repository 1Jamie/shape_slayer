// Octagon enemy - elite type

// ============================================================================
// OCTAGON ENEMY CONFIGURATION - Adjust these values for game balancing
// ============================================================================

const OCTAGON_CONFIG = {
    // Base Stats
    size: 22,                      // Enemy size (pixels)
    maxHp: 110,                    // Maximum health points
    damage: 12,                    // Damage per hit
    moveSpeed: 110,                // Movement speed (pixels/second)
    xpValue: 50,                   // XP awarded when killed
    lootChance: 0.20,              // Chance to drop loot (0.20 = 20%, reduced for larger rooms)
    
    // Attack Behavior
    attackCooldown: 3.0,           // Time between melee attacks (seconds)
    shootCooldown: 1.5,            // Time between projectile attacks (seconds)
    spinDuration: 1.0,             // Duration of spin attack (seconds)
    chargeDuration: 0.5,           // Duration of charge attack (seconds)
    attackRange: 75,               // Distance to initiate melee attack (pixels)
    postAttackPause: 0.3,          // Pause after attacks (seconds)
    
    // Minion Summoning
    minionSummonCooldown: 8.0,     // Time between summons (seconds)
    minionMinCount: 2,             // Minimum minions to summon
    minionMaxCount: 3,             // Maximum minions to summon
    maxMinionLimit: 5,             // Maximum minions allowed at one time
    minionSpawnDistance: 60,       // Base spawn distance from octagon (pixels)
    minionSpawnVariance: 40,       // Random variance in spawn distance (pixels)
    minionHealthMultiplier: 0.2,   // Minion health as % of basic enemy (0.2 = 20%)
    minionDamageMultiplier: 0.5,   // Minion damage as % of basic enemy (0.5 = 50%)
    minionXpMultiplier: 0.5,       // Minion XP as % of basic enemy (0.5 = 50%)
    
    // Projectile Attack
    projectileCount: 3,            // Number of projectiles per volley
    projectileSpeed: 250,          // Speed of projectiles (pixels/second)
    projectileSize: 6,             // Size of projectiles (pixels)
    projectileLifetime: 2.0,       // How long projectiles live (seconds)
    projectileSpread: 0.2,         // Spread angle between projectiles (radians)
    projectileDamageMultiplier: 0.7, // Damage multiplier for projectiles
    
    // Movement Behavior
    separationRadius: 50,          // Minimum distance from other enemies (pixels)
    separationStrength: 120,       // Force strength for separation (pixels)
};

class OctagonEnemy extends EnemyBase {
    constructor(x, y, inheritedTarget = null) {
        super(x, y, inheritedTarget);
        
        // Stats (from config)
        this.size = OCTAGON_CONFIG.size;
        this.maxHp = OCTAGON_CONFIG.maxHp;
        this.hp = OCTAGON_CONFIG.maxHp;
        this.damage = OCTAGON_CONFIG.damage;
        this.moveSpeed = OCTAGON_CONFIG.moveSpeed;
        this.baseMoveSpeed = OCTAGON_CONFIG.moveSpeed; // Store for stun system
        
        // Properties
        this.color = '#ffd700'; // Gold
        this.shape = 'octagon';
        this.xpValue = OCTAGON_CONFIG.xpValue;
        this.lootChance = OCTAGON_CONFIG.lootChance;
        
        // Attack system
        this.state = 'chase'; // 'chase', 'spin', 'charge', 'shoot'
        this.attackCooldown = 0;
        this.attackCooldownTime = OCTAGON_CONFIG.attackCooldown;
        this.spinDuration = OCTAGON_CONFIG.spinDuration;
        this.spinElapsed = 0;
        this.chargeDuration = OCTAGON_CONFIG.chargeDuration;
        this.chargeElapsed = 0;
        this.shootCooldown = 0;
        this.shootCooldownTime = OCTAGON_CONFIG.shootCooldown;
        this.minionSummonCooldown = OCTAGON_CONFIG.minionSummonCooldown;
        this.minionSummonElapsed = 0;
        this.attackRange = OCTAGON_CONFIG.attackRange;
        this.postAttackPause = 0; // Brief pause after attacks
        this.postAttackPauseTime = OCTAGON_CONFIG.postAttackPause;
        
        // Track spawned minions
        this.minions = [];
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
        
        // Update target lock timer
        this.updateTargetLock(deltaTime);
        
        // Update aggro target based on sliding window threat calculation
        this.updateAggroTarget();
        
        // Apply stun slow factor to movement speed
        if (this.stunned) {
            this.moveSpeed = this.baseMoveSpeed * this.stunSlowFactor;
        } else {
            this.moveSpeed = this.baseMoveSpeed;
        }
        
        // Update attack cooldowns (slower when stunned)
        const cooldownDelta = this.stunned ? deltaTime * this.stunSlowFactor : deltaTime;
        if (this.attackCooldown > 0) {
            this.attackCooldown -= cooldownDelta;
        }
        if (this.shootCooldown > 0) {
            this.shootCooldown -= cooldownDelta;
        }
        
        if (this.postAttackPause > 0) {
            this.postAttackPause -= deltaTime;
        }
        
        this.minionSummonElapsed += deltaTime;
        
        // Get target (handles decoy/clone logic, uses internal getAllAlivePlayers)
        const target = this.findTarget(null);
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
                const separation = this.getSeparationForce(enemies, OCTAGON_CONFIG.separationRadius, OCTAGON_CONFIG.separationStrength);
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
                
                // Update rotation to face movement direction
                if (moveX !== 0 || moveY !== 0) {
                    this.rotation = Math.atan2(moveY, moveX);
                }
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
            const separation = this.getSeparationForce(enemies, OCTAGON_CONFIG.separationRadius, OCTAGON_CONFIG.separationStrength);
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
            
            // Update rotation to face movement direction
            if (moveX !== 0 || moveY !== 0) {
                this.rotation = Math.atan2(moveY, moveX);
            }
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
            
            // Update rotation to face charge direction
            this.rotation = Math.atan2(dirY, dirX);
            
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
            
            // Update rotation to face movement direction
            if (dirX !== 0 || dirY !== 0) {
                this.rotation = Math.atan2(dirY, dirX);
            }
            
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
    
    // Override die() to use octagon (elite) difficulty for loot
    // NOTE: Only called on host or in solo mode. Clients receive death via game_state sync.
    die() {
        this.alive = false;
        
        // Track kill for the last attacker
        if (this.lastAttacker && typeof Game !== 'undefined' && Game.getPlayerStats) {
            const stats = Game.getPlayerStats(this.lastAttacker);
            stats.addStat('kills', 1);
        }
        
        // Emit particles on death
        if (typeof createParticleBurst !== 'undefined') {
            createParticleBurst(this.x, this.y, this.color, 12);
        }
        
        // Give XP to all alive players (multiplayer: host distributes; solo: local player)
        if (typeof Game !== 'undefined' && Game.distributeXPToAllPlayers && this.xpValue) {
            Game.distributeXPToAllPlayers(this.xpValue);
        }
        
        // Drop loot based on lootChance (loot syncs via game_state in multiplayer)
        if (typeof generateGear !== 'undefined' && typeof groundLoot !== 'undefined') {
            if (Math.random() < this.lootChance) {
                const roomNum = typeof Game !== 'undefined' ? (Game.roomNumber || 1) : 1;
                const gear = generateGear(this.x, this.y, roomNum, 'octagon');
                groundLoot.push(gear);
                console.log(`Dropped octagon loot at (${Math.floor(this.x)}, ${Math.floor(this.y)})`);
            }
        }
    }
    
    summonMinions() {
        if (typeof Game === 'undefined') return;
        
        // Clean up dead minions from tracking array
        this.minions = this.minions.filter(minion => minion.alive);
        
        // Check how many minions are currently alive
        const currentMinionCount = this.minions.length;
        
        // Calculate available slots
        const availableSlots = OCTAGON_CONFIG.maxMinionLimit - currentMinionCount;
        
        // Don't spawn if we're at the limit
        if (availableSlots <= 0) {
            return;
        }
        
        // Determine how many minions to spawn (respecting available slots)
        // Can only summon 2-3 minions per summon attempt, but never more than what fits
        const desiredCount = OCTAGON_CONFIG.minionMinCount + Math.floor(Math.random() * (OCTAGON_CONFIG.minionMaxCount - OCTAGON_CONFIG.minionMinCount + 1));
        const count = Math.min(desiredCount, availableSlots, 2); // Cap at 2 per summon
        
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 / count) * i;
            const distance = OCTAGON_CONFIG.minionSpawnDistance + Math.random() * OCTAGON_CONFIG.minionSpawnVariance;
            
            const minionX = this.x + Math.cos(angle) * distance;
            const minionY = this.y + Math.sin(angle) * distance;
            
            // Pass parent's currentTarget to minion constructor for aggro inheritance
            const minion = new Enemy(minionX, minionY, this.currentTarget);
            minion.maxHp = Math.floor(minion.maxHp * OCTAGON_CONFIG.minionHealthMultiplier);
            minion.hp = minion.maxHp;
            minion.damage = Math.floor(minion.damage * OCTAGON_CONFIG.minionDamageMultiplier);
            minion.xpValue = Math.floor(minion.xpValue * OCTAGON_CONFIG.minionXpMultiplier);
            minion.lootChance = 0.0; // No loot from minions
            
            if (typeof currentRoom !== 'undefined' && currentRoom) {
                currentRoom.enemies.push(minion);
            }
            if (typeof Game !== 'undefined') {
                Game.enemies.push(minion);
            }
            
            // Track the minion
            this.minions.push(minion);
        }
    }
    
    shootRapidProjectiles(targetX, targetY) {
        if (typeof Game === 'undefined') return;
        
        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance <= 0) return;
        
        // Shoot multiple projectiles in quick succession
        for (let i = 0; i < OCTAGON_CONFIG.projectileCount; i++) {
            const offsetAngle = (i - 1) * OCTAGON_CONFIG.projectileSpread;
            const angle = Math.atan2(dy, dx) + offsetAngle;
            
            Game.projectiles.push({
                x: this.x,
                y: this.y,
                vx: Math.cos(angle) * OCTAGON_CONFIG.projectileSpeed,
                vy: Math.sin(angle) * OCTAGON_CONFIG.projectileSpeed,
                damage: this.damage * OCTAGON_CONFIG.projectileDamageMultiplier,
                size: OCTAGON_CONFIG.projectileSize,
                lifetime: OCTAGON_CONFIG.projectileLifetime,
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

