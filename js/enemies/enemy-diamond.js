// Diamond enemy - assassin type

// ============================================================================
// DIAMOND ENEMY CONFIGURATION - Adjust these values for game balancing
// ============================================================================

const DIAMOND_CONFIG = {
    // Base Stats
    size: 18,                      // Enemy size (pixels)
    maxHp: 35,                     // Maximum health points
    damage: 6,                     // Damage per hit
    moveSpeed: 100,                // Movement speed (pixels/second)
    xpValue: 15,                   // XP awarded when killed
    lootChance: 0.12,              // Chance to drop loot (0.12 = 12%, reduced for larger rooms)
    
    // Attack Behavior
    attackCooldown: 2.0,           // Time between attacks (seconds)
    telegraphDuration: 0.15,       // Telegraph warning duration (seconds)
    dashDuration: 0.35,            // Duration of dash attack (seconds)
    dashSpeed: 600,                // Speed during dash (pixels/second)
    attackRange: 180,              // Distance to initiate attack (pixels)
    
    // Movement Behavior  
    orbitDistance: 150,            // Distance to orbit around player (pixels)
    circleSpeed: 0.8,              // Rotation speed around player (radians/second)
    weaveSpeed: 3.0,               // Speed of weaving motion
    weaveAmplitude: 30,            // How far to weave perpendicular (pixels)
    avoidanceRadius: 80,           // Radius to avoid player attacks (pixels)
};

class DiamondEnemy extends EnemyBase {
    constructor(x, y, inheritedTarget = null) {
        super(x, y, inheritedTarget);
        
        // Stats (from config)
        this.size = DIAMOND_CONFIG.size;
        this.maxHp = DIAMOND_CONFIG.maxHp;
        this.hp = DIAMOND_CONFIG.maxHp;
        this.damage = DIAMOND_CONFIG.damage;
        this.moveSpeed = DIAMOND_CONFIG.moveSpeed;
        this.baseMoveSpeed = DIAMOND_CONFIG.moveSpeed; // Store for stun system
        
        // Properties
        this.color = '#00ffff'; // Cyan
        this.shape = 'diamond';
        this.xpValue = DIAMOND_CONFIG.xpValue;
        this.lootChance = DIAMOND_CONFIG.lootChance;
        
        // Attack system
        this.state = 'circle'; // 'circle', 'telegraph', 'dash', 'cooldown'
        this.attackCooldown = 0;
        this.attackCooldownTime = DIAMOND_CONFIG.attackCooldown;
        this.telegraphDuration = DIAMOND_CONFIG.telegraphDuration;
        this.dashDuration = DIAMOND_CONFIG.dashDuration;
        this.telegraphElapsed = 0;
        this.dashElapsed = 0;
        this.attackRange = DIAMOND_CONFIG.attackRange;
        this.dashSpeed = DIAMOND_CONFIG.dashSpeed;
        this.circleAngle = 0; // Angle for circling movement
        this.weaveTimer = Math.random() * Math.PI * 2; // Random starting phase for weaving
        this.weaveSpeed = DIAMOND_CONFIG.weaveSpeed;
        this.weaveAmplitude = DIAMOND_CONFIG.weaveAmplitude;
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
        
        // Update attack cooldown (slower when stunned)
        if (this.attackCooldown > 0) {
            const cooldownDelta = this.stunned ? deltaTime * this.stunSlowFactor : deltaTime;
            this.attackCooldown -= cooldownDelta;
        }
        
        // Get target (handles decoy/clone logic, uses internal getAllAlivePlayers)
        const target = this.findTarget(null);
        const targetX = target.x;
        const targetY = target.y;
        
        // Calculate direction and distance
        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance <= 0) return;
        
        // Apply knockback first
        this.processKnockback(deltaTime);
        
        // Get enemies array for AI behaviors
        const enemies = (typeof Game !== 'undefined' && Game.enemies) ? Game.enemies : [];
        
        // AI behavior based on state
        if (this.state === 'circle') {
            // Check if close enough to attack
            if (distance < this.attackRange && this.attackCooldown <= 0) {
                // Stop moving and start telegraph
                this.state = 'telegraph';
                this.telegraphElapsed = 0;
            } else {
                // Circle around player with zigzag weaving and attack avoidance
                this.circleAngle += deltaTime * DIAMOND_CONFIG.circleSpeed;
                this.weaveTimer += deltaTime * this.weaveSpeed; // Update weaving timer
                
                const orbitDistance = DIAMOND_CONFIG.orbitDistance;
                const angle = this.circleAngle;
                
                // Calculate desired orbit position
                const desiredX = targetX + Math.cos(angle) * orbitDistance;
                const desiredY = targetY + Math.sin(angle) * orbitDistance;
                
                // Move toward the orbit position
                const toOrbitX = desiredX - this.x;
                const toOrbitY = desiredY - this.y;
                const toOrbitDist = Math.sqrt(toOrbitX * toOrbitX + toOrbitY * toOrbitY);
                
                if (toOrbitDist > 1) {
                    // Base movement toward orbit
                    let moveX = toOrbitX / toOrbitDist;
                    let moveY = toOrbitY / toOrbitDist;
                    
                    // Add perpendicular weaving (sine wave perpendicular to movement direction)
                    const perpX = -moveY; // Perpendicular vector
                    const perpY = moveX;
                    const weaveOffset = Math.sin(this.weaveTimer) * this.weaveAmplitude;
                    
                    // Apply attack avoidance
                    const avoidance = this.avoidPlayerAttacks(player, DIAMOND_CONFIG.avoidanceRadius);
                    const avoidDist = Math.sqrt(avoidance.x * avoidance.x + avoidance.y * avoidance.y);
                    
                    if (avoidDist > 0) {
                        const avoidNormX = avoidance.x / avoidDist;
                        const avoidNormY = avoidance.y / avoidDist;
                        const avoidStrength = Math.min(avoidDist, 150) / 150;
                        
                        // Blend movement with avoidance (70% movement, 30% avoidance)
                        moveX = moveX * 0.7 + avoidNormX * 0.3 * avoidStrength;
                        moveY = moveY * 0.7 + avoidNormY * 0.3 * avoidStrength;
                        
                        // Renormalize
                        const moveDist = Math.sqrt(moveX * moveX + moveY * moveY);
                        if (moveDist > 0) {
                            moveX /= moveDist;
                            moveY /= moveDist;
                        }
                    }
                    
                    // Apply movement with weaving
                    this.x += moveX * this.moveSpeed * deltaTime;
                    this.y += moveY * this.moveSpeed * deltaTime;
                    
                    // Add perpendicular weaving offset
                    this.x += perpX * weaveOffset * deltaTime * 0.3;
                    this.y += perpY * weaveOffset * deltaTime * 0.3;
                    
                    // Update rotation to face movement direction
                    if (moveX !== 0 || moveY !== 0) {
                        this.rotation = Math.atan2(moveY, moveX);
                    }
                }
            }
        } else if (this.state === 'telegraph') {
            // Stay in place during telegraph (acts as visual telegraph)
            this.telegraphElapsed += deltaTime;
            if (this.telegraphElapsed >= this.telegraphDuration) {
                this.state = 'dash';
                this.dashElapsed = 0;
            }
        } else if (this.state === 'dash') {
            // Dash toward target position (player or clone/decoy)
            this.dashElapsed += deltaTime;
            
            // Get current target position (handles clones/decoys)
            const currentTarget = this.findTarget(player);
            const dashTargetX = currentTarget.x;
            const dashTargetY = currentTarget.y;
            
            // Calculate direction to target
            const predDx = dashTargetX - this.x;
            const predDy = dashTargetY - this.y;
            const predDist = Math.sqrt(predDx * predDx + predDy * predDy);
            
            // Use target direction, fallback to current direction if invalid
            let dashDirX, dashDirY;
            if (predDist > 0) {
                dashDirX = predDx / predDist;
                dashDirY = predDy / predDist;
            } else {
                dashDirX = dx / distance;
                dashDirY = dy / distance;
            }
            
            // Check if player has active shield blocking the dash
            let newX = this.x + dashDirX * this.dashSpeed * deltaTime;
            let newY = this.y + dashDirY * this.dashSpeed * deltaTime;
            
            if (typeof Game !== 'undefined' && Game.player && Game.player.shieldActive) {
                const shieldStart = Game.player.size + 5;
                const shieldDepth = 20;
                const shieldWidth = 60; // Half width
                
                // Raycast from current position to new position
                const hit = Game.raycastCheckShield(
                    this.x, this.y, newX, newY,
                    shieldStart, shieldDepth, shieldWidth,
                    Game.player.x, Game.player.y, Game.player.rotation
                );
                
                if (hit) {
                    // Shield blocked the dash, stop at intersection
                    newX = hit.x;
                    newY = hit.y;
                    
                    // End dash early
                    this.state = 'cooldown';
                    this.attackCooldown = this.attackCooldownTime;
                    this.telegraphElapsed = 0;
                    this.dashElapsed = 0;
                    
                    // Create impact particle effect
                    if (typeof createParticleBurst !== 'undefined') {
                        createParticleBurst(hit.x, hit.y, '#00ffff', 8);
                    }
                }
            }
            
            this.x = newX;
            this.y = newY;
            
            // Update rotation to face dash direction
            this.rotation = Math.atan2(dashDirY, dashDirX);
            
            if (this.dashElapsed >= this.dashDuration) {
                this.state = 'cooldown';
                this.attackCooldown = this.attackCooldownTime;
                this.telegraphElapsed = 0;
                this.dashElapsed = 0;
            }
        } else if (this.state === 'cooldown') {
            // Move away from player during cooldown
            if (this.attackCooldown <= 0) {
                this.state = 'circle';
            } else {
                // Move away from player during cooldown
                const awayDirX = -dx / distance;
                const awayDirY = -dy / distance;
                this.x += awayDirX * this.moveSpeed * 0.5 * deltaTime;
                this.y += awayDirY * this.moveSpeed * 0.5 * deltaTime;
                
                // Update rotation to face movement direction
                this.rotation = Math.atan2(awayDirY, awayDirX);
            }
        }
        
        // Resolve stacking with other enemies
        if (enemies.length > 0) {
            this.resolveStacking(enemies);
        }
        
        // Keep within bounds
        this.keepInBounds();
    }
    
    // Override die() to use diamond difficulty for loot
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
                const gear = generateGear(this.x, this.y, roomNum, 'diamond');
                groundLoot.push(gear);
                console.log(`Dropped diamond loot at (${Math.floor(this.x)}, ${Math.floor(this.y)})`);
            }
        }
    }
    
    render(ctx) {
        let drawColor = this.color;
        
        if (this.state === 'telegraph') {
            const flash = Math.sin(this.telegraphElapsed * 20) > 0;
            drawColor = flash ? '#ff0000' : '#00ffff';
        } else if (this.state === 'dash') {
            drawColor = '#ffffff';
        }
        
        // Draw diamond shape (rotated square)
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(Math.PI / 4); // Rotate 45 degrees
        
        ctx.fillStyle = drawColor;
        ctx.beginPath();
        ctx.rect(-this.size * 0.8, -this.size * 0.8, this.size * 1.6, this.size * 1.6);
        ctx.fill();
        
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

