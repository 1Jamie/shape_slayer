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
    outOfRangeDistance: 400,       // Distance threshold for out-of-range behavior (pixels)
    outOfRangeSummonCooldown: 6.0, // Cooldown for out-of-range summons (seconds, faster than normal)
    
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
    
    // Intelligence scaling thresholds (lowered for faster ramp-up)
    intelligenceThresholds: {
        adaptivePriorities: 8,     // Room when adaptive priorities unlock (was 13)
        comboSequences: 8,         // Room when combo sequences unlock (was 13)
        tacticalSummoning: 12,     // Room when tactical summoning unlocks (was 19)
        playerActionCounters: 12,  // Room when player action counters unlock (was 19)
        advancedMinionTactics: 16  // Room when advanced minion tactics unlock (was 26)
    },
    
    // Adaptive priority system
    adaptivePriorityWeight: 0.5,  // How much to weight player behavior patterns
    
    // Combo sequences
    comboChanceBase: 0.30,         // Base combo chance at room 8 (increased from 0.20)
    comboChanceMax: 0.60,          // Max combo chance at room 11+ (increased from 0.50)
    
    // Tactical summoning
    tacticalSummonFlankAngle: Math.PI / 3, // Angle for flanking minions (60 degrees)
    tacticalSummonDistance: 150,   // Distance to spawn flanking minions
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
        this.color = '#9b59b6'; // Purple (distinct from yellow rangers)
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
        
        // Initial summon tracking (spawn minions when first activated)
        this.hasPerformedInitialSummon = false;
        
        // Out-of-range summon tracking (spawn when player is far away)
        this.outOfRangeSummonElapsed = 0;
        
        // Adaptive priority system (rooms 13+)
        this.playerBehaviorPatterns = {
            dodgeFrequency: 0,     // Track how often player dodges projectiles
            meleePreference: 0,     // Track if player prefers melee range
            attackFrequency: 0      // Track how often player attacks
        };
        this.behaviorSampleCount = 0;
        
        // Combo sequence system (rooms 13+)
        this.comboSequence = [];
        this.comboIndex = 0;
        this.lastComboTime = 0;
        
        // Player action counter tracking (rooms 12+)
        this.lastPlayerHeavyAttack = 0;
        this.lastPlayerDodge = 0;
        this.predictedDodgeLocation = null;
        
        // Predictive aiming system (ALWAYS enabled from room 1)
        this.usePredictiveAiming = true; // Always use predictive aiming
        this.lastPlayerVelocity = { x: 0, y: 0 };
        this.lastPlayerPosition = null; // Initialize as null to detect first frame
        this.velocityHistory = []; // Track velocity over time for better prediction
    }
    
    update(deltaTime) {
        if (!this.alive) return;
        
        // Check detection range - only activate when any player is nearby
        if (!this.checkDetection()) {
            // Enemy is in standby, don't update AI
            return;
        }
        
        // Perform initial summon when first activated (spawn 2 minions immediately)
        if (this.activated && !this.hasPerformedInitialSummon) {
            this.hasPerformedInitialSummon = true;
            // Summon exactly 2 minions as initial bodyguards
            this.summonInitialMinions();
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
        this.outOfRangeSummonElapsed += deltaTime;
        
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
        
        // Track player behavior patterns (rooms 8+)
        if (this.roomNumber >= OCTAGON_CONFIG.intelligenceThresholds.adaptivePriorities) {
            allPlayers.forEach(({ player: p }) => {
                if (p.isDodging) {
                    this.lastPlayerDodge = Date.now();
                    this.playerBehaviorPatterns.dodgeFrequency += 1;
                }
                if (this.isPlayerAttackThreatening(p, { expansion: 1.1, padding: 8, includeEnemySize: false })) {
                    this.playerBehaviorPatterns.attackFrequency += 1;
                    // Check if heavy attack
                    if (p.heavyAttackActive || (p.heavyAttackCooldown !== undefined && p.heavyAttackCooldown < p.heavyAttackCooldownTime * 0.9)) {
                        this.lastPlayerHeavyAttack = Date.now();
                    }
                }
                // Track melee preference (distance-based)
                if (distance < this.attackRange * 1.5) {
                    this.playerBehaviorPatterns.meleePreference += 1;
                }
                this.behaviorSampleCount++;
            });
        }
        
        // Player action counters (rooms 19+)
        if (this.roomNumber >= OCTAGON_CONFIG.intelligenceThresholds.playerActionCounters) {
            const allPlayers = this.getAllAlivePlayers();
            allPlayers.forEach(({ player: p }) => {
                // Counter heavy attacks with spin interrupt
                const timeSinceHeavyAttack = (Date.now() - this.lastPlayerHeavyAttack) / 1000;
                if (timeSinceHeavyAttack < 0.5 && this.lastPlayerHeavyAttack > 0 && 
                    this.state === 'chase' && distance < this.attackRange * 1.5 && this.attackCooldown <= 0) {
                    // Interrupt with spin
                    this.state = 'spin';
                    this.spinElapsed = 0;
                    return;
                }
                
                // Predict dodge location and shoot there
                if (p.isDodging) {
                    const dodgeDirX = Math.cos(p.rotation || 0);
                    const dodgeDirY = Math.sin(p.rotation || 0);
                    const dodgeDistance = 100; // Approximate dodge distance
                    this.predictedDodgeLocation = {
                        x: p.x + dodgeDirX * dodgeDistance,
                        y: p.y + dodgeDirY * dodgeDistance
                    };
                }
            });
        }
        
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
            
            // Out-of-range behavior: Only summon when far away, don't use combat moveset
            if (distance > OCTAGON_CONFIG.outOfRangeDistance) {
                // When out of range, only summon minions (no combat abilities)
                if (this.outOfRangeSummonElapsed >= OCTAGON_CONFIG.outOfRangeSummonCooldown) {
                    this.summonMinions();
                    this.outOfRangeSummonElapsed = 0;
                    this.postAttackPause = this.postAttackPauseTime;
                }
                
                // Continue chasing player (handled below), but don't use combat abilities
                // Skip all combat priority checks when out of range
            } else {
                // In-range combat behavior: Use normal moveset, don't use out-of-range summon
                const healthPercent = this.hp / this.maxHp;
                
                // Check if any player is attacking
                let playerAttacking = false;
                const allPlayers = this.getAllAlivePlayers();
                for (const { player: p } of allPlayers) {
                    if (this.isPlayerAttackThreatening(p, { expansion: 1.15, padding: 10 })) {
                        playerAttacking = true;
                        break;
                    }
                }
            
                
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
                
                // Adaptive priority system (rooms 13+)
                let adjustedPriorities = {
                    summon: 1.0,
                    shoot: 1.0,
                    spin: 1.0
                };
                
                if (this.roomNumber >= OCTAGON_CONFIG.intelligenceThresholds.adaptivePriorities && this.behaviorSampleCount > 10) {
                    const avgDodgeFreq = this.playerBehaviorPatterns.dodgeFrequency / this.behaviorSampleCount;
                    const avgMeleePref = this.playerBehaviorPatterns.meleePreference / this.behaviorSampleCount;
                    
                    // If player dodges projectiles often, prioritize melee
                    if (avgDodgeFreq > 0.3) {
                        adjustedPriorities.shoot *= 0.5;
                        adjustedPriorities.spin *= 1.5;
                    }
                    
                    // If player prefers melee, prioritize ranged attacks
                    if (avgMeleePref > 0.6) {
                        adjustedPriorities.shoot *= 1.5;
                        adjustedPriorities.spin *= 0.7;
                    }
                }
                
                // Combo sequence check (rooms 13+)
                let useCombo = false;
                if (this.roomNumber >= OCTAGON_CONFIG.intelligenceThresholds.comboSequences && 
                    this.comboSequence.length === 0) {
                    const roomsPastThreshold = Math.max(0, this.roomNumber - OCTAGON_CONFIG.intelligenceThresholds.comboSequences);
                    const comboScale = Math.min(1.0, roomsPastThreshold / 3); // Scales over 3 rooms (was 5)
                    const comboChance = OCTAGON_CONFIG.comboChanceBase + 
                                      (OCTAGON_CONFIG.comboChanceMax - OCTAGON_CONFIG.comboChanceBase) * comboScale;
                    
                    if (Math.random() < comboChance * this.intelligenceLevel) {
                        // Choose combo sequence based on situation
                        if (distance < this.attackRange) {
                            this.comboSequence = ['spin', 'charge', 'shoot'];
                        } else {
                            this.comboSequence = ['shoot', 'spin', 'charge'];
                        }
                        this.comboIndex = 0;
                        useCombo = true;
                    }
                }
                
                // Execute combo sequence
                if (this.comboSequence.length > 0 && this.comboIndex < this.comboSequence.length) {
                    const nextAction = this.comboSequence[this.comboIndex];
                    if (nextAction === 'spin' && distance < this.attackRange && this.attackCooldown <= 0) {
                        this.state = 'spin';
                        this.spinElapsed = 0;
                        this.comboIndex++;
                        return;
                    } else if (nextAction === 'shoot' && this.shootCooldown <= 0) {
                        const shootTarget = this.predictedDodgeLocation || { x: targetX, y: targetY };
                        this.shootRapidProjectiles(shootTarget.x, shootTarget.y);
                        this.shootCooldown = this.shootCooldownTime;
                        this.postAttackPause = this.postAttackPauseTime;
                        this.comboIndex++;
                        this.predictedDodgeLocation = null;
                        return;
                    } else if (nextAction === 'charge' && distance < this.attackRange * 1.5) {
                        // Charge will be triggered after spin completes
                        this.comboIndex++;
                    }
                    
                    // Reset combo if all actions completed
                    if (this.comboIndex >= this.comboSequence.length) {
                        this.comboSequence = [];
                        this.comboIndex = 0;
                        this.lastComboTime = Date.now();
                    }
                }
                
                // Priority 1: Low HP → prioritize summoning
                if (healthPercent < 0.4 && this.minionSummonElapsed >= this.minionSummonCooldown) {
                    if (this.roomNumber >= OCTAGON_CONFIG.intelligenceThresholds.tacticalSummoning) {
                        this.summonTacticalMinions(targetX, targetY);
                    } else {
                        this.summonMinions();
                    }
                    this.minionSummonElapsed = 0;
                    this.postAttackPause = this.postAttackPauseTime;
                    return;
                }
                
                // Priority 2: Player attacking → prioritize shooting (safer) - adjusted by adaptive system
                if (playerAttacking && this.shootCooldown <= 0 && adjustedPriorities.shoot >= 0.8) {
                    const shootTarget = this.predictedDodgeLocation || { x: targetX, y: targetY };
                    this.shootRapidProjectiles(shootTarget.x, shootTarget.y);
                    this.shootCooldown = this.shootCooldownTime;
                    this.postAttackPause = this.postAttackPauseTime;
                    this.predictedDodgeLocation = null;
                    return;
                }
                
                // Priority 3: Multiple nearby enemies → use spin attack (group coordination) - adjusted
                if (nearbyEnemyCount >= 2 && distance < this.attackRange && this.attackCooldown <= 0 && 
                    adjustedPriorities.spin >= 0.8) {
                    this.state = 'spin';
                    this.spinElapsed = 0;
                    return;
                }
                
                // Priority 4: Close range → spin attack - adjusted
                if (distance < this.attackRange && this.attackCooldown <= 0 && adjustedPriorities.spin >= 0.8) {
                    this.state = 'spin';
                    this.spinElapsed = 0;
                    return;
                }
                
                // Priority 5: Can summon and not in danger → summon (tactical if available)
                if (this.minionSummonElapsed >= this.minionSummonCooldown && healthPercent > 0.5 && 
                    adjustedPriorities.summon >= 0.8) {
                    if (this.roomNumber >= OCTAGON_CONFIG.intelligenceThresholds.tacticalSummoning) {
                        this.summonTacticalMinions(targetX, targetY);
                    } else {
                        this.summonMinions();
                    }
                    this.minionSummonElapsed = 0;
                    this.postAttackPause = this.postAttackPauseTime;
                    return;
                }
                
                // Priority 6: Can shoot → shoot - adjusted
                if (this.shootCooldown <= 0 && adjustedPriorities.shoot >= 0.8) {
                    const shootTarget = this.predictedDodgeLocation || { x: targetX, y: targetY };
                    this.shootRapidProjectiles(shootTarget.x, shootTarget.y);
                    this.shootCooldown = this.shootCooldownTime;
                    this.postAttackPause = this.postAttackPauseTime;
                    this.predictedDodgeLocation = null;
                    return;
                }
            } // End of in-range combat behavior
            
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
    
    summonInitialMinions() {
        if (typeof Game === 'undefined') return;
        
        // Always spawn exactly 2 minions as initial bodyguards
        const count = 2;
        
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 / count) * i;
            const distance = OCTAGON_CONFIG.minionSpawnDistance + Math.random() * OCTAGON_CONFIG.minionSpawnVariance;
            
            const minionX = this.x + Math.cos(angle) * distance;
            const minionY = this.y + Math.sin(angle) * distance;
            
            // Pass parent's currentTarget to minion constructor for aggro inheritance
            const minion = new Enemy(minionX, minionY, this.currentTarget);
            // Use helper function to scale minion stats based on current room progression
            if (typeof scaleMinionStats !== 'undefined') {
                scaleMinionStats(minion, OCTAGON_CONFIG.minionHealthMultiplier, 
                                OCTAGON_CONFIG.minionDamageMultiplier, 
                                OCTAGON_CONFIG.minionXpMultiplier);
            } else {
                // Fallback if helper not available (shouldn't happen)
                minion.maxHp = Math.floor(minion.maxHp * OCTAGON_CONFIG.minionHealthMultiplier);
                minion.hp = minion.maxHp;
                minion.damage = Math.floor(minion.damage * OCTAGON_CONFIG.minionDamageMultiplier);
                minion.xpValue = Math.floor(minion.xpValue * OCTAGON_CONFIG.minionXpMultiplier);
            }
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
            // Use helper function to scale minion stats based on current room progression
            if (typeof scaleMinionStats !== 'undefined') {
                scaleMinionStats(minion, OCTAGON_CONFIG.minionHealthMultiplier, 
                                OCTAGON_CONFIG.minionDamageMultiplier, 
                                OCTAGON_CONFIG.minionXpMultiplier);
            } else {
                // Fallback if helper not available (shouldn't happen)
                minion.maxHp = Math.floor(minion.maxHp * OCTAGON_CONFIG.minionHealthMultiplier);
                minion.hp = minion.maxHp;
                minion.damage = Math.floor(minion.damage * OCTAGON_CONFIG.minionDamageMultiplier);
                minion.xpValue = Math.floor(minion.xpValue * OCTAGON_CONFIG.minionXpMultiplier);
            }
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
    
    summonTacticalMinions(targetX, targetY) {
        if (typeof Game === 'undefined') return;
        
        // Clean up dead minions
        this.minions = this.minions.filter(minion => minion.alive);
        const currentMinionCount = this.minions.length;
        const availableSlots = OCTAGON_CONFIG.maxMinionLimit - currentMinionCount;
        
        if (availableSlots <= 0) return;
        
        const count = Math.min(2, availableSlots);
        const angleToPlayer = Math.atan2(targetY - this.y, targetX - this.x);
        
        // Spawn minions to flank player
        for (let i = 0; i < count; i++) {
            // Alternate sides for flanking
            const flankAngle = angleToPlayer + (i % 2 === 0 ? 1 : -1) * OCTAGON_CONFIG.tacticalSummonFlankAngle;
            const spawnX = targetX + Math.cos(flankAngle) * OCTAGON_CONFIG.tacticalSummonDistance;
            const spawnY = targetY + Math.sin(flankAngle) * OCTAGON_CONFIG.tacticalSummonDistance;
            
            const minion = new Enemy(spawnX, spawnY, this.currentTarget);
            if (typeof scaleMinionStats !== 'undefined') {
                scaleMinionStats(minion, OCTAGON_CONFIG.minionHealthMultiplier, 
                                OCTAGON_CONFIG.minionDamageMultiplier, 
                                OCTAGON_CONFIG.minionXpMultiplier);
            }
            minion.lootChance = 0.0;
            
            if (typeof currentRoom !== 'undefined' && currentRoom) {
                currentRoom.enemies.push(minion);
            }
            if (typeof Game !== 'undefined') {
                Game.enemies.push(minion);
            }
            
            this.minions.push(minion);
        }
    }
    
    shootRapidProjectiles(targetX, targetY) {
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
        
        const projectileSpeed = OCTAGON_CONFIG.projectileSpeed;
        let dx = targetX - this.x;
        let dy = targetY - this.y;
        let distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance <= 0) return;
        
        // Enhanced predictive aiming - ALWAYS enabled from room 1
        if (this.usePredictiveAiming && targetPlayer && targetPlayer.x !== undefined && targetPlayer.y !== undefined) {
            // Accuracy scales with room number: starts at 70% in room 1, reaches 95% by room 11+
            const accuracyScale = Math.min(1.0, (this.roomNumber - 1) / 10); // Scales over 10 rooms (room 1-11)
            const accuracy = 0.7 + (0.95 - 0.7) * accuracyScale; // 70% to 95% accuracy
            
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
            
            // Calculate proper intercept time (time for projectile to reach player)
            // Use actual player position, not target (which might be clone)
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
            
            // Use predicted position for aiming
            dx = predictedX - this.x;
            dy = predictedY - this.y;
            distance = Math.sqrt(dx * dx + dy * dy);
            if (distance <= 0) return;
        }
        
        // Shoot multiple projectiles in quick succession with predictive aiming
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
            drawColor = '#bb86fc'; // Light purple when attacking (still distinct from rangers)
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
        
        // Draw outline with purple glow effect
        ctx.strokeStyle = '#dda0dd'; // Light purple outline
        ctx.lineWidth = 3;
        ctx.stroke();
        
        // Add subtle inner glow for elite distinction
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();
        
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

