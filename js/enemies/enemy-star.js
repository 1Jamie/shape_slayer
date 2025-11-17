// Star enemy - ranged enemy type (actually a triangle but i havent renamed it yet)

// ============================================================================
// STAR ENEMY CONFIGURATION - Adjust these values for game balancing
// ============================================================================

const STAR_CONFIG = {
    // Base Stats
    size: 22,                      // Enemy size (pixels)
    maxHp: 55,                     // Maximum health points
    damage: 8,                     // Damage per hit
    moveSpeed: 110,                 // Movement speed (pixels/second)
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
    
    // Intelligence scaling thresholds (lowered for faster ramp-up)
    intelligenceThresholds: {
        burstFire: 4,              // Room when burst fire mode unlocks (was 7)
        predictiveAiming: 8,        // Room when predictive aiming unlocks (was 13)
        pressureBehavior: 12,       // Room when pressure behavior unlocks (was 19)
        volleyAttacks: 12           // Room when volley attacks unlock (was 19)
    },
    
    // Burst fire behavior
    burstFireChanceBase: 0.15,     // Base burst fire chance at room 4 (increased from 0.10)
    burstFireChanceMax: 0.30,      // Max burst fire chance at room 7+ (increased from 0.25)
    burstFireCount: 3,              // Number of projectiles in burst
    burstFireDelay: 0.2,           // Delay between burst shots (seconds)
    
    // Predictive aiming
    predictiveAccuracyBase: 0.8,   // Base accuracy at room 8 (80% - was 50%, too low!)
    predictiveAccuracyMax: 0.95,     // Max accuracy at room 11+ (95% - was 90%)
    predictiveLeadTime: 0.3,       // How far ahead to aim (seconds)
    
    // Volley attack
    volleyCount: 5,                 // Number of projectiles in volley
    volleySpread: 0.4,              // Spread angle for volley (radians)
    volleyChance: 0.3               // Chance to use volley (scales with intelligence)
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
        this.color = '#ffaa00'; // Orange-yellow (distinct from purple elites)
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
        
        this.telegraphProfile = {
            single: {
                type: 'star-single',
                duration: 0.28,
                color: '#66d9ff',
                intensity: 1.05,
                projectRadius: this.size * 1.2
            },
            volley: {
                type: 'star-volley',
                duration: 0.4,
                color: '#ffd166',
                intensity: 1.2,
                projectRadius: this.size * 1.4
            }
        };
        this.pendingShot = null;
        this.suppressionCooldown = 0;

        // Burst fire system (rooms 7+)
        this.burstFireActive = false;
        this.burstFireCount = 0;
        this.burstFireTimer = 0;
        
        // Predictive aiming (ALWAYS enabled from room 1)
        this.usePredictiveAiming = true; // Always use predictive aiming
        this.lastPlayerVelocity = { x: 0, y: 0 };
        this.lastPlayerPosition = null; // Initialize as null to detect first frame
        this.velocityHistory = []; // Track velocity over time for better prediction
        
        // Pressure behavior (rooms 19+)
        this.pressureMode = false;
        
        // Complex retreat (rooms 19+)
        this.retreatPattern = 'straight'; // 'straight', 'zigzag'
        this.zigzagTimer = 0;
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
        
        // Process slow timer (star enemy doesn't call this yet, but should)
        this.processSlow(deltaTime);
        
        // Process burn DoT
        this.processBurn(deltaTime);
        
        this.updateTelegraph(deltaTime);
        this.updateRecoveryWindow(deltaTime);
        if (this.suppressionCooldown > 0) {
            this.suppressionCooldown = Math.max(0, this.suppressionCooldown - deltaTime);
        }
        
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
        const targetPlayerRef = this.getPlayerById(this.currentTarget);
        
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
        const projectileAvoidance = this.projectileDodgeEnabled ? this.getProjectileAvoidanceForce(deltaTime) : null;
        const dodgeSpeedMultiplier = projectileAvoidance && projectileAvoidance.speedMultiplier
            ? projectileAvoidance.speedMultiplier
            : 1.0;
        
        // Update strafe timer
        this.strafeTimer += deltaTime * this.strafeSpeed;
        
        // Pressure behavior: check if player is low HP (rooms 19+)
        if (this.roomNumber >= STAR_CONFIG.intelligenceThresholds.pressureBehavior) {
            const allPlayers = this.getAllAlivePlayers();
            let playerLowHp = false;
            allPlayers.forEach(({ player: p }) => {
                if (p.hp && p.maxHp) {
                    const hpPercent = p.hp / p.maxHp;
                    if (hpPercent < 0.3) {
                        playerLowHp = true;
                    }
                }
            });
            
            // Reset to base values first
            this.minRange = STAR_CONFIG.minRange;
            this.attackCooldownTime = STAR_CONFIG.attackCooldown;
            
            if (playerLowHp) {
                this.pressureMode = true;
                // Move closer and fire more aggressively
                this.minRange *= 0.7;
                this.attackCooldownTime *= 0.8;
            } else {
                this.pressureMode = false;
            }
        }
        
        // Track player velocity for predictive aiming (ALWAYS track, use when enabled)
        const allPlayers = this.getAllAlivePlayers();
        allPlayers.forEach(({ player: p }) => {
            if (p && p.x !== undefined && p.y !== undefined) {
                // Calculate velocity - prefer direct velocity, fall back to position change
                let currentVx = 0;
                let currentVy = 0;
                
                // Try to get direct velocity first
                if (p.vx !== undefined && p.vy !== undefined) {
                    currentVx = p.vx;
                    currentVy = p.vy;
                } else if (this.lastPlayerPosition !== null) {
                    // Estimate velocity from position change
                    const dt = deltaTime || 0.016; // Default to ~60fps
                    if (dt > 0 && dt < 1.0) { // Sanity check: dt should be reasonable
                        const dx = p.x - this.lastPlayerPosition.x;
                        const dy = p.y - this.lastPlayerPosition.y;
                        currentVx = dx / dt;
                        currentVy = dy / dt;
                    }
                }
                
                // Update velocity (always update, even if zero)
                this.lastPlayerVelocity = { x: currentVx, y: currentVy };
                
                // Store position for next frame
                this.lastPlayerPosition = { x: p.x, y: p.y };
                
                // Store velocity history for smoothing (always track - predictive aiming always enabled)
                this.velocityHistory.push({
                    vx: currentVx,
                    vy: currentVy,
                    timestamp: Date.now()
                });
                // Keep only recent history (last 0.2 seconds)
                const now = Date.now();
                this.velocityHistory = this.velocityHistory.filter(v => now - v.timestamp < 200);
            }
        });
        
        // Update burst fire timer
        if (this.burstFireActive) {
            this.burstFireTimer += deltaTime;
            if (this.burstFireTimer >= STAR_CONFIG.burstFireDelay) {
                this.burstFireTimer = 0;
                this.burstFireCount--;
                if (this.burstFireCount <= 0) {
                    this.burstFireActive = false;
                }
            }
        }
        
        // Distance-based AI with strafing and separation
        if (distance < this.minRange) {
            // Too close - move away with strafing
            let awayDirX = -dx / distance;
            let awayDirY = -dy / distance;
            
            // Complex retreat patterns (rooms 19+)
            if (this.roomNumber >= STAR_CONFIG.intelligenceThresholds.pressureBehavior) {
                this.zigzagTimer += deltaTime * 3.0;
                const zigzagOffset = Math.sin(this.zigzagTimer) * 30;
                const zigzagPerpX = -awayDirY;
                const zigzagPerpY = awayDirX;
                awayDirX += zigzagPerpX * zigzagOffset * 0.3;
                awayDirY += zigzagPerpY * zigzagOffset * 0.3;
                const awayDist = Math.sqrt(awayDirX * awayDirX + awayDirY * awayDirY);
                if (awayDist > 0) {
                    awayDirX /= awayDist;
                    awayDirY /= awayDist;
                }
            }
            
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
            
            if (projectileAvoidance) {
                moveX += projectileAvoidance.x;
                moveY += projectileAvoidance.y;
                const moveLen = Math.sqrt(moveX * moveX + moveY * moveY);
                if (moveLen > 0.0001) {
                    moveX /= moveLen;
                    moveY /= moveLen;
                }
            }
            
            let desiredVelX = moveX * this.moveSpeed * dodgeSpeedMultiplier + perpX * strafeOffset * 0.4;
            let desiredVelY = moveY * this.moveSpeed * dodgeSpeedMultiplier + perpY * strafeOffset * 0.4;
            const desiredSpeed = Math.sqrt(desiredVelX * desiredVelX + desiredVelY * desiredVelY);
            if (desiredSpeed > 0) {
                this.applySmoothedDirectionalMovement(desiredVelX, desiredVelY, desiredSpeed, deltaTime, 0.4, false);
            }
            this.smoothRotateTo(Math.atan2(dy, dx));
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
            
            if (projectileAvoidance) {
                moveX += projectileAvoidance.x;
                moveY += projectileAvoidance.y;
                const moveLen = Math.sqrt(moveX * moveX + moveY * moveY);
                if (moveLen > 0.0001) {
                    moveX /= moveLen;
                    moveY /= moveLen;
                }
            }
            
            this.applySmoothedDirectionalMovement(moveX, moveY, this.moveSpeed * dodgeSpeedMultiplier, deltaTime, 0.35);
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
            
            if (projectileAvoidance) {
                moveX += projectileAvoidance.x;
                moveY += projectileAvoidance.y;
                const moveLen = Math.sqrt(moveX * moveX + moveY * moveY);
                if (moveLen > 0.0001) {
                    moveX /= moveLen;
                    moveY /= moveLen;
                }
            }
            
            this.applySmoothedDirectionalMovement(moveX, moveY, this.moveSpeed * 0.6 * dodgeSpeedMultiplier, deltaTime, 0.4, false);
            this.smoothRotateTo(Math.atan2(dy, dx));
            
            if (targetPlayerRef && targetPlayerRef.isDodging && this.suppressionCooldown <= 0 && !this.pendingShot) {
                this.queueShot('single', targetX, targetY, { quick: true });
                this.attackCooldown = this.attackCooldownTime * 0.6;
                this.suppressionCooldown = 1.2;
            }
            
            // Add slight adjustment toward ideal range
            const rangeDiff = distance - this.shootRange;
            if (Math.abs(rangeDiff) > 10) {
                const adjustDirX = (rangeDiff > 0 ? -towardDirX : towardDirX);
                const adjustDirY = (rangeDiff > 0 ? -towardDirY : towardDirY);
                this.applySmoothedDirectionalMovement(adjustDirX, adjustDirY, this.moveSpeed * 0.3 * dodgeSpeedMultiplier, deltaTime, 0.4, false);
                this.smoothRotateTo(Math.atan2(dy, dx));
            }
            
            // Try to shoot (pass raw target position - shoot method will handle all prediction)
            if (this.attackCooldown <= 0 && (!this.pendingShot || this.burstFireActive)) {
                let nextCooldown = this.attackCooldownTime;
                if (this.roomNumber >= STAR_CONFIG.intelligenceThresholds.volleyAttacks && 
                    Math.random() < STAR_CONFIG.volleyChance * this.intelligenceLevel) {
                    this.queueShot('volley', targetX, targetY);
                } else if (this.burstFireActive && this.burstFireCount > 0) {
                    this.shoot(targetX, targetY, true, true);
                    nextCooldown = Math.min(nextCooldown, STAR_CONFIG.burstFireDelay);
                } else {
                    if (this.roomNumber >= STAR_CONFIG.intelligenceThresholds.burstFire) {
                        const roomsPastThreshold = Math.max(0, this.roomNumber - STAR_CONFIG.intelligenceThresholds.burstFire);
                        const burstScale = Math.min(1.0, roomsPastThreshold / 3);
                        const burstChance = STAR_CONFIG.burstFireChanceBase + 
                                          (STAR_CONFIG.burstFireChanceMax - STAR_CONFIG.burstFireChanceBase) * burstScale;
                        
                        if (Math.random() < burstChance * this.intelligenceLevel) {
                            this.burstFireActive = true;
                            this.burstFireCount = STAR_CONFIG.burstFireCount;
                            this.burstFireTimer = 0;
                            this.shoot(targetX, targetY, true, true);
                            nextCooldown = Math.min(nextCooldown, STAR_CONFIG.burstFireDelay);
                        } else {
                            this.queueShot('single', targetX, targetY);
                        }
                    } else {
                        this.queueShot('single', targetX, targetY);
                    }
                }
                this.attackCooldown = nextCooldown;
            }
        }
        
        // Resolve stacking with other enemies
        if (enemies.length > 0) {
            this.resolveStacking(enemies);
        }
        
        if (this.pendingShot) {
            this.pendingShot.timer -= deltaTime;
            if (this.pendingShot.timer <= 0) {
                if (this.activeTelegraph) this.endTelegraph();
                const shot = this.pendingShot;
                this.pendingShot = null;
                if (shot.type === 'volley') {
                    this.shootVolley(shot.x, shot.y, true);
                } else {
                    this.shoot(shot.x, shot.y, false, true);
                }
            }
        }
        
        // Keep enemy within canvas bounds
        this.keepInBounds();
    }
    
    // Override die() to use star difficulty for loot
    // NOTE: Only called on host or in solo mode. Clients receive death via game_state sync.
    die() {
        this.alive = false;
        
        // Track kill for the last attacker
        if (this.lastAttacker) {
            // Track lifetime kills stat
            const isClient = typeof Game !== 'undefined' && Game.isMultiplayerClient && Game.isMultiplayerClient();
            if (!isClient && typeof window.trackLifetimeStat === 'function') {
                window.trackLifetimeStat('totalKills', 1);
            }
            
            if (typeof Game !== 'undefined' && Game.getPlayerStats) {
                const stats = Game.getPlayerStats(this.lastAttacker);
                if (stats) {
                    stats.addStat('kills', 1);
                }
            }
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
                if (gear) {
                    groundLoot.push(gear);
                    console.log(`Dropped star loot at (${Math.floor(this.x)}, ${Math.floor(this.y)})`);
                }
            }
        }
    }
    
    queueShot(type, targetX, targetY, options = {}) {
        const profile = this.telegraphProfile[type] || this.telegraphProfile.single;
        const quickFactor = options.quick ? 0.6 : (1 - this.intelligenceLevel * 0.2);
        const duration = Math.max(0.15, profile.duration * quickFactor);
        this.pendingShot = {
            type,
            x: targetX,
            y: targetY,
            timer: duration
        };
        this.beginTelegraph(profile.type, {
            duration,
            intensity: profile.intensity,
            color: profile.color,
            projectRadius: profile.projectRadius
        });
    }
    
    shoot(targetX, targetY, isBurstFire = false, skipTelegraph = false) {
        if (!skipTelegraph) {
            this.queueShot('single', targetX, targetY, { quick: false });
            return;
        }
        if (typeof Game === 'undefined') return;
        
        // Get actual player for better prediction (not clone/decoy)
        // Try to get the actual player object with velocity properties
        let targetPlayer = this.getPlayerById(this.currentTarget);
        if (!targetPlayer || !targetPlayer.vx) {
            // Fallback: get from getAllAlivePlayers to ensure we have velocity
            const allPlayers = this.getAllAlivePlayers();
            if (allPlayers.length > 0) {
                // Find the player matching currentTarget, or use nearest
                const matching = allPlayers.find(({ id }) => id === this.currentTarget);
                targetPlayer = matching ? matching.player : allPlayers[0].player;
            }
        }
        
        // Calculate direction to target (targetX/targetY may already include prediction from update method)
        const projectileSpeed = STAR_CONFIG.projectileSpeed;
        let dx = targetX - this.x;
        let dy = targetY - this.y;
        let distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance <= 0) return;
        
        // Enhanced predictive aiming - ALWAYS enabled from room 1
        // Use actual player position and velocity for accurate prediction
        if (this.usePredictiveAiming && targetPlayer && targetPlayer.x !== undefined && targetPlayer.y !== undefined) {
            // Accuracy scales with room number: starts at 70% in room 1, reaches 95% by room 11+
            const accuracyScale = Math.min(1.0, (this.roomNumber - 1) / 10); // Scales over 10 rooms (room 1-11)
            const accuracy = 0.7 + (STAR_CONFIG.predictiveAccuracyMax - 0.7) * accuracyScale; // 70% to 95%
            
            // Use smoothed velocity from history if available
            let avgVx = this.lastPlayerVelocity.x;
            let avgVy = this.lastPlayerVelocity.y;
            if (this.velocityHistory.length > 0) {
                // Average velocity over history for smoother prediction
                let totalVx = 0;
                let totalVy = 0;
                let count = 0;
                this.velocityHistory.forEach(v => {
                    totalVx += v.vx;
                    totalVy += v.vy;
                    count++;
                });
                if (count > 0) {
                    avgVx = totalVx / count;
                    avgVy = totalVy / count;
                }
            }
            
            // Use actual player position for accurate intercept calculation
            const playerX = targetPlayer.x;
            const playerY = targetPlayer.y;
            const playerDx = playerX - this.x;
            const playerDy = playerY - this.y;
            const playerDist = Math.sqrt(playerDx * playerDx + playerDy * playerDy);
            
            if (playerDist > 0) {
                // ALWAYS apply prediction when enabled - calculate intercept time
                let timeToIntercept = playerDist / projectileSpeed;
                
                // Use iterative prediction if player has meaningful velocity
                if (Math.abs(avgVx) > 1 || Math.abs(avgVy) > 1) {
                    // Iterate to find better intercept point (3 iterations for accuracy)
                    for (let i = 0; i < 3; i++) {
                        // Predict where player will be at this time
                        const predictedX = playerX + avgVx * timeToIntercept;
                        const predictedY = playerY + avgVy * timeToIntercept;
                        
                        // Calculate distance to predicted position
                        const predDx = predictedX - this.x;
                        const predDy = predictedY - this.y;
                        const predDist = Math.sqrt(predDx * predDx + predDy * predDy);
                        
                        // Update time based on distance to predicted position
                        if (predDist > 0) {
                            timeToIntercept = predDist / projectileSpeed;
                        } else {
                            break;
                        }
                    }
                }
                
                // ALWAYS apply prediction with accuracy scaling
                const predictedX = playerX + avgVx * timeToIntercept * accuracy;
                const predictedY = playerY + avgVy * timeToIntercept * accuracy;
                
                // Use predicted position for aiming (override targetX/targetY with accurate prediction)
                dx = predictedX - this.x;
                dy = predictedY - this.y;
                distance = Math.sqrt(dx * dx + dy * dy);
                if (distance <= 0) return;
            }
        }
        
        // Base direction
        let dirX = dx / distance;
        let dirY = dy / distance;
        
        // Add slight spread variation (reduced for predictive aiming)
        const spreadMultiplier = this.usePredictiveAiming ? (1 - this.intelligenceLevel * 0.5) : 1.0;
        const spreadAngle = (Math.random() - 0.5) * STAR_CONFIG.projectileSpreadAngle * spreadMultiplier;
        const cos = Math.cos(spreadAngle);
        const sin = Math.sin(spreadAngle);
        const newDirX = dirX * cos - dirY * sin;
        const newDirY = dirX * sin + dirY * cos;
        dirX = newDirX;
        dirY = newDirY;
        
        // Play projectile shoot sound
        if (typeof AudioManager !== 'undefined' && AudioManager.sounds) {
            AudioManager.sounds.enemyShoot();
        }
        
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
    
    shootVolley(targetX, targetY, skipTelegraph = false) {
        if (!skipTelegraph) {
            this.queueShot('volley', targetX, targetY);
            return;
        }
        if (typeof Game === 'undefined') return;
        
        // Get actual player for better prediction - ensure we have velocity properties
        let targetPlayer = this.getPlayerById(this.currentTarget);
        if (!targetPlayer || !targetPlayer.vx) {
            const allPlayers = this.getAllAlivePlayers();
            if (allPlayers.length > 0) {
                const matching = allPlayers.find(({ id }) => id === this.currentTarget);
                targetPlayer = matching ? matching.player : allPlayers[0].player;
            }
        }
        
        const projectileSpeed = STAR_CONFIG.projectileSpeed;
        let dx = targetX - this.x;
        let dy = targetY - this.y;
        let distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance <= 0) return;
        
        // Use predictive aiming for volley - ALWAYS enabled from room 1
        if (this.usePredictiveAiming && targetPlayer && targetPlayer.x !== undefined && targetPlayer.y !== undefined) {
            // Accuracy scales with room number: starts at 70% in room 1, reaches 95% by room 11+
            const accuracyScale = Math.min(1.0, (this.roomNumber - 1) / 10); // Scales over 10 rooms (room 1-11)
            const accuracy = 0.7 + (STAR_CONFIG.predictiveAccuracyMax - 0.7) * accuracyScale; // 70% to 95%
            
            // Use smoothed velocity
            let avgVx = this.lastPlayerVelocity.x;
            let avgVy = this.lastPlayerVelocity.y;
            if (this.velocityHistory.length > 0) {
                let totalVx = 0;
                let totalVy = 0;
                let count = 0;
                this.velocityHistory.forEach(v => {
                    totalVx += v.vx;
                    totalVy += v.vy;
                    count++;
                });
                if (count > 0) {
                    avgVx = totalVx / count;
                    avgVy = totalVy / count;
                }
            }
            
            // Calculate intercept time using actual player position
            const playerX = targetPlayer.x;
            const playerY = targetPlayer.y;
            const playerDx = playerX - this.x;
            const playerDy = playerY - this.y;
            const playerDist = Math.sqrt(playerDx * playerDx + playerDy * playerDy);
            
            // ALWAYS apply prediction when enabled
            let timeToIntercept = playerDist / projectileSpeed;
            
            // Use iterative prediction if player has meaningful velocity
            if (Math.abs(avgVx) > 1 || Math.abs(avgVy) > 1) {
                for (let i = 0; i < 3; i++) {
                    const predictedX = playerX + avgVx * timeToIntercept;
                    const predictedY = playerY + avgVy * timeToIntercept;
                    const predDx = predictedX - this.x;
                    const predDy = predictedY - this.y;
                    const predDist = Math.sqrt(predDx * predDx + predDy * predDy);
                    if (predDist > 0) {
                        timeToIntercept = predDist / projectileSpeed;
                    } else {
                        break;
                    }
                }
            }
            
            // ALWAYS apply prediction with accuracy scaling
            const predictedX = playerX + avgVx * timeToIntercept * accuracy;
            const predictedY = playerY + avgVy * timeToIntercept * accuracy;
            
            // Use predicted position for aiming (override targetX/targetY)
            dx = predictedX - this.x;
            dy = predictedY - this.y;
            distance = Math.sqrt(dx * dx + dy * dy);
            if (distance <= 0) return;
        }
        
        const baseAngle = Math.atan2(dy, dx);
        const spread = STAR_CONFIG.volleySpread;
        
        // Play projectile shoot sound
        if (typeof AudioManager !== 'undefined' && AudioManager.sounds) {
            AudioManager.sounds.enemyShoot();
        }
        
        // Fire multiple projectiles in spread pattern
        for (let i = 0; i < STAR_CONFIG.volleyCount; i++) {
            const offsetAngle = (i / (STAR_CONFIG.volleyCount - 1) - 0.5) * spread;
            const angle = baseAngle + offsetAngle;
            
            Game.projectiles.push({
                x: this.x,
                y: this.y,
                vx: Math.cos(angle) * projectileSpeed,
                vy: Math.sin(angle) * projectileSpeed,
                damage: this.damage,
                size: STAR_CONFIG.projectileSize,
                lifetime: STAR_CONFIG.projectileLifetime,
                elapsed: 0
            });
        }
    }
    
    render(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        
        let drawColor = this.color;
        const telegraphData = this.activeTelegraph;
        let scaleMultiplier = 1;
        if (telegraphData) {
            const progress = telegraphData.progress !== undefined ? telegraphData.progress : 0.5;
            const pulse = 0.6 + Math.sin(progress * Math.PI * 3) * 0.4;
            drawColor = telegraphData.color || this.color;
            scaleMultiplier = 1 + (telegraphData.intensity || 1) * 0.08 * pulse;
        }
        
        ctx.fillStyle = drawColor;
        ctx.beginPath();
        
        // Draw equilateral triangle pointing in the direction of movement
        const height = this.size * 1.5 * scaleMultiplier;
        const base = this.size * 1.3 * scaleMultiplier;
        
        // Triangle vertices (pointing right/forward)
        ctx.moveTo(height * 0.6, 0);  // Front point
        ctx.lineTo(-height * 0.4, base * 0.5);  // Bottom back
        ctx.lineTo(-height * 0.4, -base * 0.5); // Top back
        ctx.closePath();
        ctx.fill();
        
        // Draw outline
        ctx.strokeStyle = '#ff8800'; // Darker orange outline
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.restore();
        
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
        
        if (telegraphData) {
            ctx.save();
            ctx.strokeStyle = telegraphData.color || this.color;
            ctx.lineWidth = 2.5;
            ctx.globalAlpha = 0.6;
            const radius = telegraphData.projectRadius || this.size * 1.4;
            ctx.beginPath();
            ctx.arc(this.x, this.y, radius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }
    }
}

