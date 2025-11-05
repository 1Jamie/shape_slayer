// Star enemy - ranged enemy type

// ============================================================================
// STAR ENEMY CONFIGURATION - Adjust these values for game balancing
// ============================================================================

const STAR_CONFIG = {
    // Base Stats
    size: 22,                      // Enemy size (pixels)
    maxHp: 55,                     // Maximum health points
    damage: 8,                     // Damage per hit
    moveSpeed: 80,                 // Movement speed (pixels/second)
    xpValue: 20,                   // XP awarded when killed
    lootChance: 0.12,              // Chance to drop loot (0.12 = 12%, reduced for larger rooms)
    
    // Combat Behavior
    attackCooldown: 2.0,           // Time between attacks (seconds)
    shootRange: 175,               // Ideal shooting distance (pixels)
    minRange: 100,                 // Minimum distance before retreating (pixels)
    maxRange: 200,                 // Maximum distance before advancing (pixels)
    
    // Movement Behavior
    strafeSpeed: 2.0,              // Speed of strafing motion
    strafeAmplitude: 40,           // How far to strafe (pixels)
    separationRadius: 50,          // Minimum distance from other enemies (pixels)
    separationStrength: 120,       // Force strength for separation (pixels)
    
    // Projectile Properties
    projectileSpeed: 200,          // Speed of projectiles (pixels/second)
    projectileSize: 5,             // Size of projectile (pixels)
    projectileLifetime: 3.0,       // How long projectiles live (seconds)
    projectileSpreadAngle: 0.175,  // Random spread angle in radians (±5 degrees)
};

class StarEnemy extends EnemyBase {
    constructor(x, y) {
        super(x, y);
        
        // Stats (from config)
        this.size = STAR_CONFIG.size;
        this.maxHp = STAR_CONFIG.maxHp;
        this.hp = STAR_CONFIG.maxHp;
        this.damage = STAR_CONFIG.damage;
        this.moveSpeed = STAR_CONFIG.moveSpeed;
        this.baseMoveSpeed = STAR_CONFIG.moveSpeed; // Store for stun system
        
        // Properties
        this.color = '#ffcc00'; // Yellow
        this.shape = 'star';
        this.xpValue = STAR_CONFIG.xpValue;
        this.lootChance = STAR_CONFIG.lootChance;
        
        // Shooting system
        this.attackCooldown = 0;
        this.attackCooldownTime = STAR_CONFIG.attackCooldown;
        this.shootRange = STAR_CONFIG.shootRange;
        this.minRange = STAR_CONFIG.minRange;
        this.maxRange = STAR_CONFIG.maxRange;
        this.strafeTimer = Math.random() * Math.PI * 2; // Random starting phase for strafing
        this.strafeSpeed = STAR_CONFIG.strafeSpeed;
        this.strafeAmplitude = STAR_CONFIG.strafeAmplitude;
    }
    
    update(deltaTime) {
        if (!this.alive) return;
        
        // Check detection range - only activate when player is nearby
        if (!this.checkDetection()) {
            // Enemy is in standby, don't update AI
            return;
        }
        
        // Process stun first
        this.processStun(deltaTime);
        
        // Update target lock timer
        this.updateTargetLock(deltaTime);
        
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
                const separation = this.getSeparationForce(enemies, STAR_CONFIG.separationRadius, STAR_CONFIG.separationStrength);
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
            
            // Update rotation to face movement direction (toward player for shooter)
            this.rotation = Math.atan2(dy, dx);
        } else if (distance > this.maxRange) {
            // Too far - move closer with separation
            const towardDirX = dx / distance;
            const towardDirY = dy / distance;
            
            // Apply separation
            const separation = this.getSeparationForce(enemies, STAR_CONFIG.separationRadius, STAR_CONFIG.separationStrength);
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
            
            // Update rotation to face movement direction
            if (moveX !== 0 || moveY !== 0) {
                this.rotation = Math.atan2(moveY, moveX);
            }
        } else {
            // Right distance - strafe and shoot
            // Strafing movement (perpendicular to player)
            const towardDirX = dx / distance;
            const towardDirY = dy / distance;
            const perpX = -towardDirY;
            const perpY = towardDirX;
            const strafeOffset = Math.sin(this.strafeTimer) * this.strafeAmplitude;
            
            // Apply separation
            const separation = this.getSeparationForce(enemies, STAR_CONFIG.separationRadius, STAR_CONFIG.separationStrength);
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
            
            // Update rotation to face player (shooter faces target)
            this.rotation = Math.atan2(dy, dx);
            
            // Add slight adjustment toward ideal range
            const rangeDiff = distance - this.shootRange;
            if (Math.abs(rangeDiff) > 10) {
                const adjustDirX = (rangeDiff > 0 ? -towardDirX : towardDirX) * 0.3;
                const adjustDirY = (rangeDiff > 0 ? -towardDirY : towardDirY) * 0.3;
                this.x += adjustDirX * this.moveSpeed * deltaTime;
                this.y += adjustDirY * this.moveSpeed * deltaTime;
            }
            
            // Try to shoot (use target position, not player position, to account for clones/decoys)
            if (this.attackCooldown <= 0) {
                this.shoot(targetX, targetY);
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
    
    // Override die() to use star difficulty for loot
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
                const gear = generateGear(this.x, this.y, roomNum, 'star');
                groundLoot.push(gear);
                console.log(`Dropped star loot at (${Math.floor(this.x)}, ${Math.floor(this.y)})`);
            }
        }
    }
    
    shoot(targetX, targetY) {
        if (typeof Game === 'undefined') return;
        
        // Calculate direction to target (which may be clone/decoy position from findTarget)
        const projectileSpeed = STAR_CONFIG.projectileSpeed;
        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance <= 0) return;
        
        // Base direction
        let dirX = dx / distance;
        let dirY = dy / distance;
        
        // Add slight spread variation
        const spreadAngle = (Math.random() - 0.5) * STAR_CONFIG.projectileSpreadAngle;
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
            size: STAR_CONFIG.projectileSize,
            lifetime: STAR_CONFIG.projectileLifetime,
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

