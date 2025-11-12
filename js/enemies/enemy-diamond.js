// Diamond enemy - assassin type

// ============================================================================
// DIAMOND ENEMY CONFIGURATION - Adjust these values for game balancing
// ============================================================================

const DIAMOND_CONFIG = {
    // Base Stats
    size: 18,                      // Enemy size (pixels)
    maxHp: 35,                     // Maximum health points
    damage: 6,                     // Damage per hit
    damageScalingMultiplier: 0.65, // Additional reduction applied after global scaling
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
    
    // Intelligence scaling thresholds (lowered for faster ramp-up)
    intelligenceThresholds: {
        feintAttacks: 5,           // Room when feint attacks unlock (was 9)
        comboDashes: 8,            // Room when combo dashes unlock (was 13)
        dodgeTracking: 8,          // Room when dodge tracking unlocks (was 13)
        backstabPositioning: 12    // Room when backstab positioning unlocks (was 19)
    },
    
    // Feint attack behavior
    feintChanceBase: 0.15,        // Base feint chance at room 5 (increased from 0.10)
    feintChanceMax: 0.30,         // Max feint chance at room 9+ (increased from 0.25)
    
    // Combo dash behavior
    comboDashChanceBase: 0.25,    // Base combo chance at room 8 (increased from 0.20)
    comboDashChanceMax: 0.35,     // Max combo chance at room 11+ (increased from 0.30)
};

class DiamondEnemy extends EnemyBase {
    constructor(x, y, inheritedTarget = null) {
        super(x, y, inheritedTarget);
        
        // Get current room number for scaling
        const roomNumber = typeof Game !== 'undefined' ? (Game.roomNumber || 1) : 1;
        
        // Calculate speed multiplier based on room progression
        // Base: +5% (1.05)
        // After room 15: +10% more (total 1.15)
        // After room 20: +5% more (total 1.20)
        let speedMultiplier = 1.05; // Base 5% increase
        if (roomNumber > 15) {
            speedMultiplier = 1.15; // 15% total after room 15
        }
        if (roomNumber > 20) {
            speedMultiplier = 1.20; // 20% total after room 20
        }
        
        // Calculate attack range multiplier (only after room 20)
        const attackRangeMultiplier = roomNumber > 20 ? 1.10 : 1.0;
        
        // Stats (from config)
        this.size = DIAMOND_CONFIG.size;
        this.maxHp = DIAMOND_CONFIG.maxHp;
        this.hp = DIAMOND_CONFIG.maxHp;
        this.damage = DIAMOND_CONFIG.damage;
        this.damageScalingMultiplier = DIAMOND_CONFIG.damageScalingMultiplier;
        this.moveSpeed = DIAMOND_CONFIG.moveSpeed * speedMultiplier;
        this.baseMoveSpeed = DIAMOND_CONFIG.moveSpeed * speedMultiplier; // Store for stun system
        
        // Properties
        this.color = '#00ffff'; // Cyan
        this.shape = 'diamond';
        this.xpValue = DIAMOND_CONFIG.xpValue;
        this.lootChance = DIAMOND_CONFIG.lootChance;
        
        // Attack system
        this.state = 'circle'; // 'circle', 'telegraph', 'dash', 'cooldown', 'feint'
        this.attackCooldown = 0;
        this.attackCooldownTime = DIAMOND_CONFIG.attackCooldown;
        this.telegraphDuration = DIAMOND_CONFIG.telegraphDuration;
        // Increase dash duration proportionally with attack range to ensure dash can reach from increased range
        this.dashDuration = DIAMOND_CONFIG.dashDuration * attackRangeMultiplier;
        this.telegraphElapsed = 0;
        this.dashElapsed = 0;
        this.attackRange = DIAMOND_CONFIG.attackRange * attackRangeMultiplier;
        this.dashSpeed = DIAMOND_CONFIG.dashSpeed;
        this.circleAngle = 0; // Angle for circling movement
        this.weaveTimer = Math.random() * Math.PI * 2; // Random starting phase for weaving
        this.weaveSpeed = DIAMOND_CONFIG.weaveSpeed;
        this.weaveAmplitude = DIAMOND_CONFIG.weaveAmplitude;
        
        // Feint attack system (rooms 9+)
        this.feintTimer = 0;
        this.isFeinting = false;
        
        // Combo dash system (rooms 13+)
        this.comboDashReady = false;
        this.comboDashWaitTimer = 0; // Wait timer between combo dashes (250ms)
        this.lastDashTarget = null;
        this.playerDodgeTracked = false;
        this.lastPlayerDodgeTime = 0;
        
        // Locked dash direction (set during telegraph, used during dash)
        this.lockedDashDirX = 0;
        this.lockedDashDirY = 0;
        
        // Backstab positioning (rooms 19+)
        this.backstabAngle = null;
        
        // Dash hit tracking - prevents multiple hits per dash
        this.dashHasHit = false;
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
        
        // Calculate direction and distance
        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance <= 0) return;
        
        // Apply knockback first
        this.processKnockback(deltaTime);
        
        // Get enemies array for AI behaviors
        const enemies = (typeof Game !== 'undefined' && Game.enemies) ? Game.enemies : [];
        
        // Track player dodge (rooms 13+)
        if (this.roomNumber >= DIAMOND_CONFIG.intelligenceThresholds.dodgeTracking) {
            const allPlayers = this.getAllAlivePlayers();
            allPlayers.forEach(({ player: p }) => {
                if (p.isDodging) {
                    this.lastPlayerDodgeTime = Date.now();
                    this.reactToPlayerAction('dodge', p);
                }
            });
        }
        
        // AI behavior based on state
        if (this.state === 'circle') {
            // Backstab positioning (rooms 19+)
            if (this.roomNumber >= DIAMOND_CONFIG.intelligenceThresholds.backstabPositioning) {
                const allPlayers = this.getAllAlivePlayers();
                allPlayers.forEach(({ player: p }) => {
                    if (this.isPlayerAttackThreatening(p, { expansion: 1.05, padding: 10 })) {
                        // Player is attacking, try to position behind
                        const playerAngle = Math.atan2(p.vy || 0, p.vx || 0);
                        const toPlayerX = p.x - this.x;
                        const toPlayerY = p.y - this.y;
                        const toPlayerAngle = Math.atan2(toPlayerY, toPlayerX);
                        
                        // Desired angle is opposite of player's facing direction
                        this.backstabAngle = playerAngle + Math.PI;
                    }
                });
            }
            
            // Check if close enough to attack
            if (distance < this.attackRange && this.attackCooldown <= 0) {
                // Check for feint attack (rooms 5+)
                let shouldFeint = false;
                if (this.roomNumber >= DIAMOND_CONFIG.intelligenceThresholds.feintAttacks) {
                    // Calculate feint chance based on room progression
                    const roomsPastThreshold = Math.max(0, this.roomNumber - DIAMOND_CONFIG.intelligenceThresholds.feintAttacks);
                    const feintScale = Math.min(1.0, roomsPastThreshold / 4); // Scales over 4 rooms (was 6)
                    const feintChance = DIAMOND_CONFIG.feintChanceBase + 
                                       (DIAMOND_CONFIG.feintChanceMax - DIAMOND_CONFIG.feintChanceBase) * feintScale;
                    
                    if (Math.random() < feintChance * this.intelligenceLevel) {
                        shouldFeint = true;
                        this.state = 'feint';
                        this.feintTimer = this.telegraphDuration * 0.5; // Shorter feint telegraph
                        this.isFeinting = true;
                    }
                }
                
                if (!shouldFeint) {
                    // Check for combo dash opportunity (rooms 13+)
                    if (this.roomNumber >= DIAMOND_CONFIG.intelligenceThresholds.comboDashes && this.comboDashReady && this.comboDashWaitTimer <= 0) {
                        // Player dodged last dash, follow up after wait period
                        this.comboDashReady = false;
                        this.comboDashWaitTimer = 0;
                        // Lock in dash direction immediately (no telegraph for combo)
                        const comboDx = targetX - this.x;
                        const comboDy = targetY - this.y;
                        const comboDist = Math.sqrt(comboDx * comboDx + comboDy * comboDy);
                        if (comboDist > 0) {
                            this.lockedDashDirX = comboDx / comboDist;
                            this.lockedDashDirY = comboDy / comboDist;
                        } else {
                            // Fallback to stored direction
                            this.lockedDashDirX = this.lockedDashDirX || 1;
                            this.lockedDashDirY = this.lockedDashDirY || 0;
                        }
                        this.state = 'dash';
                        this.dashElapsed = 0;
                        this.telegraphElapsed = 0;
                        this.dashHasHit = false; // Reset hit flag for combo dash
                    } else {
                        // Normal telegraph - lock in aim direction NOW
                        const telegraphDx = targetX - this.x;
                        const telegraphDy = targetY - this.y;
                        const telegraphDist = Math.sqrt(telegraphDx * telegraphDx + telegraphDy * telegraphDy);
                        if (telegraphDist > 0) {
                            // Lock in dash direction at telegraph start
                            this.lockedDashDirX = telegraphDx / telegraphDist;
                            this.lockedDashDirY = telegraphDy / telegraphDist;
                        } else {
                            // Fallback direction
                            this.lockedDashDirX = 1;
                            this.lockedDashDirY = 0;
                        }
                        this.state = 'telegraph';
                        this.telegraphElapsed = 0;
                    }
                }
            } else {
                // Circle around player with zigzag weaving and attack avoidance
                this.circleAngle += deltaTime * DIAMOND_CONFIG.circleSpeed;
                this.weaveTimer += deltaTime * this.weaveSpeed; // Update weaving timer
                
                // Improved orbit behavior: vary distance based on player actions (rooms 19+)
                let orbitDistance = DIAMOND_CONFIG.orbitDistance;
                if (this.roomNumber >= DIAMOND_CONFIG.intelligenceThresholds.backstabPositioning) {
                    const allPlayers = this.getAllAlivePlayers();
                    allPlayers.forEach(({ player: p }) => {
                        if (this.isPlayerAttackThreatening(p, { expansion: 1.1, padding: 8, includeEnemySize: false })) {
                            // Player attacking: orbit closer for backstab opportunity
                            orbitDistance *= 0.8;
                        } else if (p.isDodging || (p.vx === 0 && p.vy === 0)) {
                            // Player ready/dodging: orbit further for safety
                            orbitDistance *= 1.2;
                        }
                    });
                }
                
                // Use backstab angle if available (rooms 19+)
                let angle = this.circleAngle;
                if (this.backstabAngle !== null && this.roomNumber >= DIAMOND_CONFIG.intelligenceThresholds.backstabPositioning) {
                    // Blend toward backstab angle
                    const angleDiff = normalizeAngle(this.backstabAngle - this.circleAngle);
                    angle = this.circleAngle + angleDiff * 0.3;
                    this.backstabAngle = null; // Clear after use
                }
                
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
                    
                    // Apply attack avoidance (check all alive players)
                    let avoidance = { x: 0, y: 0 };
                    const allPlayers = this.getAllAlivePlayers();
                    allPlayers.forEach(({ player: p }) => {
                        const playerAvoidance = this.avoidPlayerAttacks(p, DIAMOND_CONFIG.avoidanceRadius);
                        avoidance.x += playerAvoidance.x;
                        avoidance.y += playerAvoidance.y;
                    });
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
        } else if (this.state === 'feint') {
            // Feint state: start telegraph but cancel and reposition
            this.feintTimer -= deltaTime;
            if (this.feintTimer <= 0) {
                // Cancel feint and reposition
                this.isFeinting = false;
                this.feintTimer = 0;
                this.state = 'circle';
                // Reposition by changing orbit angle
                this.circleAngle += Math.PI / 2 + (Math.random() - 0.5) * Math.PI / 4;
            }
        } else if (this.state === 'telegraph') {
            // Stay in place during telegraph (acts as visual telegraph)
            // Dash direction is already locked in from when telegraph started
            this.telegraphElapsed += deltaTime;
            if (this.telegraphElapsed >= this.telegraphDuration) {
                // Play dash sound
                if (typeof AudioManager !== 'undefined' && AudioManager.sounds) {
                    AudioManager.sounds.enemyDash();
                }
                
                // Store dash target for combo detection
                this.lastDashTarget = { x: targetX, y: targetY };
                
                this.state = 'dash';
                this.dashElapsed = 0;
                this.dashHasHit = false; // Reset hit flag for new dash
            }
        } else if (this.state === 'dash') {
            // Dash in locked direction (linear, no curving/chasing)
            // Direction was locked when telegraph started, so dash is predictable
            this.dashElapsed += deltaTime;
            
            // Use locked direction (set during telegraph) - LINEAR, NO REAIMING
            const dashDirX = this.lockedDashDirX;
            const dashDirY = this.lockedDashDirY;
            
            // Calculate intended new position
            let newX = this.x + dashDirX * this.dashSpeed * deltaTime;
            let newY = this.y + dashDirY * this.dashSpeed * deltaTime;
            
            // Check for player collision before moving (if not already hit)
            if (!this.dashHasHit) {
                const allPlayers = this.getAllAlivePlayers();
                for (const { player: p } of allPlayers) {
                    if (!p || !p.alive || p.invulnerable) continue;
                    
                    const playerRadius = p.collisionRadius || p.size || 20;
                    const enemyRadius = this.collisionRadius || this.size || 18;
                    
                    // Check if new position would collide with player
                    const dx = newX - p.x;
                    const dy = newY - p.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    const minSeparation = playerRadius + enemyRadius;
                    
                    if (dist < minSeparation) {
                        // Impact detected - stop dash early
                        // Calculate collision normal (direction from player to enemy)
                        const normalX = dist > 0 ? dx / dist : 1;
                        const normalY = dist > 0 ? dy / dist : 0;
                        
                        // Apply damage directly on impact (host/solo only)
                        const isClient = typeof Game !== 'undefined' && Game.isMultiplayerClient && Game.isMultiplayerClient();
                        if (!isClient && !p.invulnerable) {
                            // Get player ID for damage attribution
                            const localPlayerId = typeof Game !== 'undefined' && Game.getLocalPlayerId ? Game.getLocalPlayerId() : 'local';
                            const playerId = p.playerId || localPlayerId;
                            
                            if (playerId === localPlayerId) {
                                // Local player: apply damage directly
                                p.takeDamage(this.damage, this);
                            } else {
                                // Remote player: use damageRemotePlayer
                                if (typeof Game !== 'undefined' && Game.damageRemotePlayer) {
                                    Game.damageRemotePlayer(playerId, this.damage);
                                }
                            }
                            
                            // Apply knockback
                            if (typeof p.applyDamageKnockback === 'function') {
                                const knockbackStrength = this.contactKnockback || 120;
                                p.applyDamageKnockback(normalX * knockbackStrength, normalY * knockbackStrength);
                            }
                        }
                        
                        // Mark that dash has hit to prevent continuous damage
                        this.dashHasHit = true;
                        
                        // Position enemy at collision point (just touching player)
                        newX = p.x + normalX * minSeparation;
                        newY = p.y + normalY * minSeparation;
                        
                        // End dash early and transition to cooldown
                        this.state = 'cooldown';
                        this.attackCooldown = this.attackCooldownTime;
                        this.telegraphElapsed = 0;
                        this.dashElapsed = 0;
                        this.comboDashReady = false;
                        
                        // Create impact particle effect
                        if (typeof createParticleBurst !== 'undefined') {
                            createParticleBurst(newX, newY, '#00ffff', 8);
                        }
                        
                        break; // Only handle first collision
                    }
                }
            }
            
            // Check if player has active shield blocking the dash
            if (typeof Game !== 'undefined' && Game.player && Game.player.shieldActive && !this.dashHasHit) {
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
                // Check for combo dash opportunity (rooms 13+)
                if (this.roomNumber >= DIAMOND_CONFIG.intelligenceThresholds.comboDashes) {
                    const timeSinceDodge = (Date.now() - this.lastPlayerDodgeTime) / 1000;
                    const dodgeCooldown = 2.0; // Standard dodge cooldown
                    
                    // If player dodged recently, check for combo chance
                    if (timeSinceDodge < dodgeCooldown && this.lastPlayerDodgeTime > 0) {
                        const roomsPastThreshold = Math.max(0, this.roomNumber - DIAMOND_CONFIG.intelligenceThresholds.comboDashes);
                        const comboScale = Math.min(1.0, roomsPastThreshold / 3); // Scales over 3 rooms (was 5)
                        const comboChance = DIAMOND_CONFIG.comboDashChanceBase + 
                                          (DIAMOND_CONFIG.comboDashChanceMax - DIAMOND_CONFIG.comboDashChanceBase) * comboScale;
                        
                        if (Math.random() < comboChance * this.intelligenceLevel) {
                            // Set up combo dash with 250ms wait timer
                            this.comboDashReady = true;
                            this.comboDashWaitTimer = 0.25; // 250ms wait before combo dash
                            this.state = 'cooldown';
                            this.attackCooldown = this.attackCooldownTime;
                            this.telegraphElapsed = 0;
                            this.dashElapsed = 0;
                            this.dashHasHit = false; // Reset hit flag for combo dash
                            
                            // Push enemy out if still overlapping player after dash ends
                            this.resolvePlayerOverlap(2); // Extra buffer to ensure separation
                            return; // Skip rest of cooldown logic
                        }
                    }
                }
                
                this.state = 'cooldown';
                this.attackCooldown = this.attackCooldownTime;
                this.telegraphElapsed = 0;
                this.dashElapsed = 0;
                this.comboDashReady = false;
                this.comboDashWaitTimer = 0;
                
                // Push enemy out if still overlapping player after dash ends
                this.resolvePlayerOverlap(2); // Extra buffer to ensure separation
            }
        } else if (this.state === 'cooldown') {
            // Update combo dash wait timer
            if (this.comboDashWaitTimer > 0) {
                this.comboDashWaitTimer -= deltaTime;
            }
            
            // Move away from player during cooldown
            if (this.attackCooldown <= 0) {
                // Check if combo dash is ready and wait timer expired
                if (this.comboDashReady && this.comboDashWaitTimer <= 0) {
                    // Combo dash ready - transition to dash (direction already locked in circle state)
                    this.comboDashReady = false;
                    this.comboDashWaitTimer = 0;
                    // Lock in dash direction for combo
                    const comboDx = targetX - this.x;
                    const comboDy = targetY - this.y;
                    const comboDist = Math.sqrt(comboDx * comboDx + comboDy * comboDy);
                    if (comboDist > 0) {
                        this.lockedDashDirX = comboDx / comboDist;
                        this.lockedDashDirY = comboDy / comboDist;
                    } else {
                        // Fallback to stored direction
                        this.lockedDashDirX = this.lockedDashDirX || 1;
                        this.lockedDashDirY = this.lockedDashDirY || 0;
                    }
                    this.state = 'dash';
                    this.dashElapsed = 0;
                    this.telegraphElapsed = 0;
                    this.dashHasHit = false;
                } else {
                    // Normal cooldown finished
                    this.state = 'circle';
                }
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
        
        // Draw status effects (burn, freeze)
        if (typeof renderBurnEffect !== 'undefined') {
            renderBurnEffect(ctx, this);
        }
        if (typeof renderFreezeEffect !== 'undefined') {
            renderFreezeEffect(ctx, this);
        }
        
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

