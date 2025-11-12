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
    telegraphDuration: 0.6,        // Base telegraph warning duration (seconds, increased from 0.5)
    quickTelegraphDuration: 0.4,   // Quick lunge telegraph (rooms 2+)
    delayedTelegraphDuration: 0.8, // Delayed lunge telegraph (rooms 2+)
    lungeDuration: 0.4,            // Duration of lunge attack (seconds, increased from 0.2)
    lungeSpeed: 400,               // Speed during lunge (pixels/second, increased from 300)
    lungeDistance: 120,            // Maximum distance lunge can travel (pixels)
    attackRange: 80,               // Distance to initiate attack (pixels, increased from 50)
    attackRangeVariance: 10,       // Random variance for attack timing (±pixels)
    attackRecoveryDuration: 0.3,    // Duration of recovery after lunge (seconds)
    
    // Movement Behavior
    separationRadius: 50,          // Minimum distance from other enemies (pixels, increased)
    separationStrength: 200,       // Force strength for separation (pixels, increased)
    groupRadius: 150,              // Radius to find group center (pixels)
    pathAvoidanceRadius: 35,       // Radius to check for path obstacles (pixels)
    pathLookAhead: 100,            // How far ahead to check for obstacles (pixels)
    lateralSpreadRadius: 120,      // Radius for lateral spread detection (pixels)
    lateralSpreadStrength: 80,     // Strength of lateral spread force (pixels, reduced for subtlety)
    
    // Intelligence scaling thresholds (basic features from room 1)
    intelligenceThresholds: {
        advancedPatterns: 1,       // Room when quick/delayed lunge patterns unlock
        feintAttacks: 1,           // Feints available from the start (scaled by intelligence)
        playerReactions: 1,        // Player reaction system unlocks immediately
        coordination: 1,           // Coordination unlocked immediately
        comboLunge: 5,             // Combo lunges unlock room 5+
        waveAttacks: 3,            // Wave attacks unlock room 3+
        surroundFormation: 4,      // Surround formation unlocks room 4+
        retreatBehavior: 8         // Retreat behavior unlocks room 8+
    },
    
    // Feint attack behavior
    feintChanceBase: 0.10,         // Base feint chance at room 2
    feintChanceMax: 0.20,          // Max feint chance at room 5+
    
    // Combo lunge behavior
    comboLungeChanceBase: 0.15,    // Base combo chance at room 4
    comboLungeChanceMax: 0.30,     // Max combo chance at room 7+
    
    // Retreat behavior
    retreatHpThreshold: 0.3,      // HP % below which enemy considers retreating
    retreatChance: 0.3             // Chance to retreat when low HP (scales with intelligence)
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
        this.state = 'chase'; // 'chase', 'telegraph', 'lunge', 'cooldown', 'retreat', 'recovery'
        this.attackCooldown = 0;
        this.attackCooldownTime = BASIC_ENEMY_CONFIG.attackCooldown;
        this.telegraphDuration = BASIC_ENEMY_CONFIG.telegraphDuration;
        this.lungeDuration = BASIC_ENEMY_CONFIG.lungeDuration;
        this.telegraphElapsed = 0;
        this.lungeElapsed = 0;
        this.recoveryElapsed = 0;
        this.originalSpeed = this.moveSpeed;
        this.lungeSpeed = BASIC_ENEMY_CONFIG.lungeSpeed;
        this.lungeDistance = BASIC_ENEMY_CONFIG.lungeDistance;
        this.baseLungeSpeed = BASIC_ENEMY_CONFIG.lungeSpeed;
        this.baseLungeDuration = BASIC_ENEMY_CONFIG.lungeDuration;
        this.attackRange = BASIC_ENEMY_CONFIG.attackRange;
        this.attackRangeVariance = BASIC_ENEMY_CONFIG.attackRangeVariance;
        this.attackRecoveryDuration = BASIC_ENEMY_CONFIG.attackRecoveryDuration;
        
        // Locked lunge direction (set during telegraph, used during lunge)
        this.lockedLungeDirX = 0;
        this.lockedLungeDirY = 0;
        this.lungeStartX = 0;
        this.lungeStartY = 0;
        
        // Attack pattern variation (scales with room)
        this.attackPattern = 'simple'; // 'simple', 'quick', 'delayed'
        this.currentTelegraphDuration = this.telegraphDuration;
        
        // Feint attack system (rooms 2+)
        this.isFeinting = false;
        this.feintTimer = 0;
        
        // Combo lunge system (rooms 4+)
        this.comboLungeReady = false;
        this.comboLungeWaitTimer = 0;
        this.lastPlayerDodgeTime = 0;
        this.lastPlayerDodgePosition = null;
        this.counterAttackPending = false;
        this.attackBranch = 'commit'; // 'commit' | 'feint' | 'counter'
        
        // Player reaction tracking
        this.playerAttackReactionTimer = 0;
        this.lastPlayerAttackTime = 0;
        
        // Group coordination (enabled from room 1)
        this.coordinationEnabled = this.roomNumber >= BASIC_ENEMY_CONFIG.intelligenceThresholds.coordination;
        this.coordinationRole = null; // 'attacker', 'positioner', null
        this.coordinationTimer = 0;
        this.waveAttackReady = false; // For coordinated wave attacks (room 3+)
        
        // Retreat behavior
        this.retreatTimer = 0;
        this.retreatTarget = null;
        
        // Intelligence systems (base features from room 1)
        this.usePredictivePositioning = true; // Always enabled from room 1 (with lower weight)
        this.optimalDistance = this.attackRange * 1.2; // Preferred engagement distance (increased from 0.9)
        this.patternRecognitionEnabled = this.roomNumber >= 6; // Enable pattern recognition room 6+
        this.environmentalAwarenessEnabled = this.roomNumber >= 8; // Enable environmental awareness room 8+
        
        // Orbital movement
        this.orbitAngle = Math.random() * Math.PI * 2; // Random starting orbit angle
        this.orbitSpeed = 0.5; // Rotation speed around player (radians/second)
        
        // Shared telegraph descriptors
        this.telegraphProfile = {
            lunge: {
                type: 'lunge',
                duration: this.telegraphDuration,
                color: '#ff4141',
                intensity: 1.0,
                projectRadius: this.damageProjectionRadius || this.size * 1.2
            },
            feint: {
                type: 'feint',
                duration: 0.35,
                color: '#ffa94d',
                intensity: 0.75,
                projectRadius: this.damageProjectionRadius || this.size
            },
            counter: {
                type: 'counter',
                duration: 0.45,
                color: '#ffdf5d',
                intensity: 1.2,
                projectRadius: (this.damageProjectionRadius || this.size) * 1.1
            }
        };
        
        // Initialize attack range variance for this instance
        this.currentAttackRange = this.attackRange + (Math.random() - 0.5) * this.attackRangeVariance * 2;
        this.currentAttackRange += 30; // Slightly longer reach to account for projected damage
        
        // Minimum distance before entering telegraph (ensures lunge fires before collision-based damage takes over)
        this.minTelegraphRange = Math.max(60, this.currentAttackRange * 0.9);
        
        // Contact knockback tuning
        this.contactKnockback = 100;
        this.damageProjectionMultiplier = 1.05;
        this.damageProjectionRadius = this.size * 0.9;
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
        
        // Update shared animation signals
        this.updateTelegraph(deltaTime);
        this.updateRecoveryWindow(deltaTime);
        
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
        
        // Get target player for pattern recognition and intelligence systems
        const targetPlayer = this.getPlayerById(this.currentTarget) || this.getNearestPlayer();
        
        // Update player patterns (rooms 6+)
        if (this.patternRecognitionEnabled && targetPlayer && targetPlayer.alive) {
            this.updatePlayerPatterns(targetPlayer);
        }
        
        // Get target (handles decoy/clone logic, uses internal getAllAlivePlayers)
        let target = this.findTarget(null);
        let targetX = target.x;
        let targetY = target.y;
        
        // Use predictive positioning (always enabled from room 1, with lower weight)
        if (this.usePredictivePositioning && targetPlayer && targetPlayer.alive) {
            // Store original target for validation
            const originalTargetX = targetX;
            const originalTargetY = targetY;
            
            // Blend between current position and predicted position based on intelligence
            // Lower weight for base intelligence (0.3 max) vs advanced (0.6 max)
            const predicted = this.getPredictedTargetPosition(targetPlayer);
            const baseWeight = 0.3; // Base weight from room 1
            const advancedWeight = 0.6; // Advanced weight (room 3+)
            const weightScale = Math.min(1.0, (this.roomNumber - 1) / 2); // Scale from room 1 to 3
            const predictionWeight = (baseWeight + (advancedWeight - baseWeight) * weightScale) * this.intelligenceLevel;
            targetX = targetX * (1 - predictionWeight) + predicted.x * predictionWeight;
            targetY = targetY * (1 - predictionWeight) + predicted.y * predictionWeight;
            
            // Use pattern-based prediction if available (rooms 6+)
            if (this.patternRecognitionEnabled && this.playerPatterns.movementHistory.length >= 3) {
                const patternPredicted = this.predictFromPatterns(targetPlayer);
                
                // Validate pattern prediction doesn't cause backward movement
                const patternDx = patternPredicted.x - this.x;
                const patternDy = patternPredicted.y - this.y;
                const patternDist = Math.sqrt(patternDx * patternDx + patternDy * patternDy);
                
                if (patternDist > 0) {
                    const toOriginalX = originalTargetX - this.x;
                    const toOriginalY = originalTargetY - this.y;
                    const toOriginalDist = Math.sqrt(toOriginalX * toOriginalX + toOriginalY * toOriginalY);
                    
                    if (toOriginalDist > 0) {
                        const toOriginalNormX = toOriginalX / toOriginalDist;
                        const toOriginalNormY = toOriginalY / toOriginalDist;
                        const patternNormX = patternDx / patternDist;
                        const patternNormY = patternDy / patternDist;
                        
                        // Check if pattern prediction would cause backward movement
                        const patternDot = toOriginalNormX * patternNormX + toOriginalNormY * patternNormY;
                        if (patternDot >= 0) {
                            // Safe to use pattern prediction
                            const patternWeight = this.intelligenceLevel * 0.3; // Max 30% pattern prediction
                            targetX = targetX * (1 - patternWeight) + patternPredicted.x * patternWeight;
                            targetY = targetY * (1 - patternWeight) + patternPredicted.y * patternWeight;
                        }
                    }
                }
            }
            
            // Final validation: ensure target is not causing backward movement
            const finalDx = targetX - this.x;
            const finalDy = targetY - this.y;
            const finalDist = Math.sqrt(finalDx * finalDx + finalDy * finalDy);
            
            if (finalDist > 0) {
                const toOriginalX = originalTargetX - this.x;
                const toOriginalY = originalTargetY - this.y;
                const toOriginalDist = Math.sqrt(toOriginalX * toOriginalX + toOriginalY * toOriginalY);
                
                if (toOriginalDist > 0) {
                    const toOriginalNormX = toOriginalX / toOriginalDist;
                    const toOriginalNormY = toOriginalY / toOriginalDist;
                    const finalNormX = finalDx / finalDist;
                    const finalNormY = finalDy / finalDist;
                    
                    // If final target would cause backward movement, use original
                    const finalDot = toOriginalNormX * finalNormX + toOriginalNormY * finalNormY;
                    if (finalDot < 0) {
                        targetX = originalTargetX;
                        targetY = originalTargetY;
                    }
                }
            }
        }
        
        // Calculate direction from enemy to target
        let dx = targetX - this.x;
        let dy = targetY - this.y;
        let distance = Math.sqrt(dx * dx + dy * dy);
        
        // Avoid division by zero
        if (distance <= 0) return;
        
        // Apply knockback first (before any AI movement)
        this.processKnockback(deltaTime);
        
        // Get enemies array for AI behaviors
        const enemies = (typeof Game !== 'undefined' && Game.enemies) ? Game.enemies : [];
        
        // Check for tactical retreat (situational and intelligent, room 10+)
        if (this.state !== 'retreat' && targetPlayer && targetPlayer.alive && this.intelligenceLevel >= 0.7) {
            this.retreatCooldown = Math.max(0, this.retreatCooldown - deltaTime);
            this.retreatHeat = Math.max(0, this.retreatHeat - this.retreatHeatDecay * deltaTime);
            if (this.canAttemptRetreat()) {
                const localGroupSize = this.getNearbyAlliesCount(enemies, this.retreatGroupRadius, true);
                const contextPressure = Math.min(1, Math.max(0, localGroupSize - 1) * 0.2);
                const retreatChance = this.computeRetreatChance({
                    extraPressure: contextPressure,
                    groupRadius: this.retreatGroupRadius,
                    localGroupSize,
                    groupSizeClamp: 8
                });
                if (this.shouldRetreat(targetPlayer, enemies)) {
                    if (Math.random() < retreatChance) {
                        this.recordRetreatAttempt(true);
                        const retreatDistance = this.getAdaptiveRetreatDistance(localGroupSize) + Math.random() * 25;
                        const retreatPos = this.getRetreatPosition(targetPlayer, retreatDistance);
                        this.state = 'retreat';
                        const baseRetreatTime = 0.35 + 0.05 * Math.min(localGroupSize, 6);
                        this.retreatTimer = baseRetreatTime + Math.random() * 0.25; // dynamic reposition
                        this.retreatTarget = retreatPos;
                    } else {
                        this.recordRetreatAttempt(false);
                    }
                }
            }
        }
        
        // Check for player actions and react (enabled from room 1)
        if (this.roomNumber >= BASIC_ENEMY_CONFIG.intelligenceThresholds.playerReactions) {
            const allPlayers = this.getAllAlivePlayers();
            allPlayers.forEach(({ player: p }) => {
                const reaction = this.shouldReactToPlayerAttack(p, {
                    expansion: 1.1,
                    padding: 8,
                    baseChance: 0.08 + this.intelligenceLevel * 0.12,
                    proximityWeight: 0.4,
                    maxChance: 0.25,
                    cooldownMs: 250
                });
                if (reaction.shouldReact) {
                    this.reactToPlayerAction('attack', p);
                    this.lastPlayerAttackTime = Date.now();
                }
                if (p.isDodging) {
                    this.reactToPlayerAction('dodge', p);
                    this.lastPlayerDodgeTime = Date.now();
                    this.lastPlayerDodgePosition = { x: p.x, y: p.y };
                }
            });
        }
        
        // Old HP-based retreat behavior removed - now handled by intelligent shouldRetreat() method
        // This ensures retreat is situational and tactical, not just based on HP threshold
        
        // Group coordination (rooms 13+)
        // Enhanced group coordination (rooms 8+)
        if (this.coordinationEnabled && this.state === 'chase') {
            this.coordinationTimer += deltaTime;
            const allies = this.coordinateWithAllies(enemies);
            if (allies && allies.length > 0) {
                // Count allies in different states
                let alliesAttacking = 0;
                let alliesPositioning = 0;
                let alliesReady = 0;
                
                allies.forEach(({ enemy: ally }) => {
                    if (ally.state === 'telegraph' || ally.state === 'lunge') {
                        alliesAttacking++;
                    } else if (ally.coordinationRole === 'positioner') {
                        alliesPositioning++;
                    } else if (ally.state === 'chase' && ally.attackCooldown <= 0) {
                        alliesReady++;
                    }
                });
                
                // Enhanced coordination logic - allow multiple simultaneous attacks
                // Calculate max simultaneous attackers based on total enemy count
                const totalEnemies = enemies.filter(e => e.alive && e.shape === 'circle').length;
                const maxSimultaneousAttackers = Math.min(Math.max(2, Math.floor(totalEnemies / 5)), 5); // 2-5 attackers at once
                
                // Only restrict attacks if we're at the limit
                if (alliesAttacking >= maxSimultaneousAttackers) {
                    // Too many attacking - position to flank or distract
                    if (this.coordinationRole !== 'attacker') {
                        this.coordinationRole = 'positioner';
                    }
                } else if (alliesAttacking > 0 && alliesAttacking < maxSimultaneousAttackers) {
                    // Some allies attacking but not at limit - can join attack
                    // Higher chance to attack if fewer are attacking
                    const attackChance = (1 - (alliesAttacking / maxSimultaneousAttackers)) * 0.7; // 70% chance when 0 attacking, decreases as more attack
                    if (Math.random() < attackChance * this.intelligenceLevel) {
                        this.coordinationRole = 'attacker';
                    } else {
                        this.coordinationRole = 'positioner';
                    }
                } else if (alliesPositioning >= 2 && alliesReady === 0) {
                    // Multiple allies positioning, none ready - this one should attack
                    if (Math.random() < 0.7 * this.intelligenceLevel) {
                        this.coordinationRole = 'attacker';
                    }
                } else if (alliesReady > 0 && this.coordinationRole !== 'positioner') {
                    // Other allies ready - allow simultaneous attacks (less restrictive)
                    const attackChance = 0.6 * this.intelligenceLevel; // Increased from 0.4
                    if (Math.random() < attackChance) {
                        this.coordinationRole = 'attacker';
                    } else {
                        this.coordinationRole = 'positioner';
                    }
                } else if (!this.coordinationRole) {
                    // No role assigned - favor attacker role (increased chance)
                    if (Math.random() < 0.5 * this.intelligenceLevel) { // Increased from 0.3
                        this.coordinationRole = 'attacker';
                    } else {
                        this.coordinationRole = 'positioner';
                    }
                }
                
                // Wave attack coordination (room 3+) - more aggressive, easier to trigger
                if (this.roomNumber >= BASIC_ENEMY_CONFIG.intelligenceThresholds.waveAttacks && 
                    this.attackCooldown <= 0) {
                    // Check if enough allies are ready for wave attack
                    let readyAllies = 0;
                    allies.forEach(({ enemy: ally }) => {
                        if (ally.state === 'chase' && ally.attackCooldown <= 0) {
                            // Count all ready allies, not just attackers
                            readyAllies++;
                        }
                    });
                    
                    // Lower threshold for wave attacks - trigger with 2+ ready allies
                    // Higher chance when more allies are ready
                    if (readyAllies >= 2) {
                        const waveChance = Math.min(0.8, 0.3 + (readyAllies - 2) * 0.1); // 30% with 2 allies, up to 80% with 7+
                        if (Math.random() < waveChance * this.intelligenceLevel) {
                            // Coordinate wave attack - commit to simultaneous attack
                            this.waveAttackReady = true;
                            this.coordinationRole = 'attacker'; // Ensure attacker role
                        }
                    }
                }
            }
        }
        
        // AI behavior based on state
        if (this.state === 'chase') {
            // Check for player attack reaction (rooms 9+)
            let shouldDelayAttack = false;
            if (this.roomNumber >= BASIC_ENEMY_CONFIG.intelligenceThresholds.playerReactions) {
                const timeSincePlayerAttack = (Date.now() - this.lastPlayerAttackTime) / 1000;
                const reactionDelay = this.getReactionSpeed(0.3, 0.1, 0.5);
                if (timeSincePlayerAttack < reactionDelay && this.lastPlayerAttackTime > 0) {
                    shouldDelayAttack = true;
                }
            }
            
            // Normal chase behavior with separation and swarming
            // Check attack timing (enabled from room 1)
            let goodTiming = true;
            if (this.roomNumber >= BASIC_ENEMY_CONFIG.intelligenceThresholds.playerReactions && targetPlayer) {
                goodTiming = this.isGoodAttackTiming(targetPlayer);
                if (!goodTiming) {
                    shouldDelayAttack = true;
                }
            }
            
            if (distance < this.currentAttackRange && this.attackCooldown <= 0 && !shouldDelayAttack && goodTiming) {
                // Check coordination role - only prevent attack if we're at simultaneous attacker limit
                if (this.coordinationEnabled && this.coordinationRole === 'positioner') {
                    // Check if we're at the simultaneous attacker limit
                    const allies = this.coordinateWithAllies(enemies);
                    if (allies && allies.length > 0) {
                        let alliesAttacking = 0;
                        allies.forEach(({ enemy: ally }) => {
                            if (ally.state === 'telegraph' || ally.state === 'lunge') {
                                alliesAttacking++;
                            }
                        });
                        
                        const totalEnemies = enemies.filter(e => e.alive && e.shape === 'circle').length;
                        const maxSimultaneousAttackers = Math.min(Math.max(2, Math.floor(totalEnemies / 5)), 5);
                        
                        // Only prevent attack if we're at the limit
                        if (alliesAttacking >= maxSimultaneousAttackers) {
                            shouldDelayAttack = true;
                        } else {
                            // Not at limit - allow this enemy to attack even if role is positioner
                            this.coordinationRole = 'attacker';
                        }
                    }
                }
                
                if (!shouldDelayAttack) {
                    // Check for combo lunge opportunity (rooms 4+)
                    if (this.roomNumber >= BASIC_ENEMY_CONFIG.intelligenceThresholds.comboLunge && this.comboLungeReady && this.comboLungeWaitTimer <= 0) {
                        // Player dodged last lunge, follow up after wait period
                        this.comboLungeReady = false;
                        this.comboLungeWaitTimer = 0;
                        // Lock in lunge direction immediately (no telegraph for combo)
                        const comboDx = targetX - this.x;
                        const comboDy = targetY - this.y;
                        const comboDist = Math.sqrt(comboDx * comboDx + comboDy * comboDy);
                        if (comboDist > 0) {
                            this.lockedLungeDirX = comboDx / comboDist;
                            this.lockedLungeDirY = comboDy / comboDist;
                        } else {
                            // Fallback to stored direction
                            this.lockedLungeDirX = this.lockedLungeDirX || 1;
                            this.lockedLungeDirY = this.lockedLungeDirY || 0;
                        }
                        this.lungeStartX = this.x;
                        this.lungeStartY = this.y;
                        this.state = 'lunge';
                        this.lungeElapsed = 0;
                        this.telegraphElapsed = 0;
                    } else {
                        // Choose attack branch (commit, feint, counter)
                        this.selectAttackBranch(targetPlayer);
                        
                        // Choose attack pattern (enabled from room 1)
                        if (this.roomNumber >= BASIC_ENEMY_CONFIG.intelligenceThresholds.advancedPatterns) {
                            const quickWeight = this.getPatternWeight('advancedPatterns', BASIC_ENEMY_CONFIG.intelligenceThresholds, 0.6);
                            const delayedWeight = this.getPatternWeight('advancedPatterns', BASIC_ENEMY_CONFIG.intelligenceThresholds, 0.6);
                            const totalWeight = quickWeight + delayedWeight + 0.25;
                            
                            const rand = Math.random() * totalWeight;
                            if (rand < quickWeight) {
                                this.attackPattern = 'quick';
                                this.currentTelegraphDuration = BASIC_ENEMY_CONFIG.quickTelegraphDuration;
                            } else if (rand < quickWeight + delayedWeight) {
                                this.attackPattern = 'delayed';
                                this.currentTelegraphDuration = BASIC_ENEMY_CONFIG.delayedTelegraphDuration;
                            } else {
                                this.attackPattern = 'simple';
                                this.currentTelegraphDuration = BASIC_ENEMY_CONFIG.telegraphDuration;
                            }
                        } else {
                            this.attackPattern = 'simple';
                            this.currentTelegraphDuration = BASIC_ENEMY_CONFIG.telegraphDuration;
                        }
                        
                        // Adjust telegraph duration by branch type
                        if (this.attackBranch === 'feint') {
                            this.currentTelegraphDuration = this.telegraphProfile.feint.duration;
                        } else if (this.attackBranch === 'counter') {
                            this.currentTelegraphDuration = this.telegraphProfile.counter.duration;
                        }
                        
                        // Lock in lunge direction at telegraph start
                        const telegraphDx = targetX - this.x;
                        const telegraphDy = targetY - this.y;
                        const telegraphDist = Math.sqrt(telegraphDx * telegraphDx + telegraphDy * telegraphDy);
                        if (telegraphDist > 0) {
                            this.lockedLungeDirX = telegraphDx / telegraphDist;
                            this.lockedLungeDirY = telegraphDy / telegraphDist;
                        } else {
                            this.lockedLungeDirX = 1;
                            this.lockedLungeDirY = 0;
                        }
                        
                        // Minimum telegraph range enforcement
                        if (distance > this.minTelegraphRange) {
                            this.state = 'telegraph';
                            this.telegraphElapsed = 0;
                            const telegraphProfile = this.attackBranch === 'feint'
                                ? this.telegraphProfile.feint
                                : this.attackBranch === 'counter'
                                    ? this.telegraphProfile.counter
                                    : this.telegraphProfile.lunge;
                            this.beginTelegraph(telegraphProfile.type || this.attackBranch, {
                                duration: this.currentTelegraphDuration,
                                intensity: telegraphProfile.intensity,
                                color: telegraphProfile.color,
                                projectRadius: telegraphProfile.projectRadius,
                                screenShake: this.attackBranch === 'counter'
                            });
                        } else {
                            const pushDistance = (this.minTelegraphRange - distance) + 1;
                            const pushX = (this.x - targetX) / distance * pushDistance;
                            const pushY = (this.y - targetY) / distance * pushDistance;
                            
                            this.x += pushX;
                            this.y += pushY;
                            
                            if (this.keepInBounds) {
                                this.keepInBounds();
                            }
                        }
                    }
                }
            }
            
            // Movement logic
            if (shouldDelayAttack || distance >= this.currentAttackRange || this.attackCooldown > 0) {
                // Calculate optimal/strategic target position
                let moveTargetX = targetX;
                let moveTargetY = targetY;
                
                // Use optimal engagement distance (always enabled from room 1)
                if (this.usePredictivePositioning) {
                    const optimalPos = this.getOptimalPosition(targetX, targetY, this.optimalDistance);
                    moveTargetX = optimalPos.x;
                    moveTargetY = optimalPos.y;
                }
                
                // Add orbital movement when at engagement distance (room 1+)
                const currentDist = Math.sqrt((targetX - this.x) * (targetX - this.x) + (targetY - this.y) * (targetY - this.y));
                if (currentDist >= this.optimalDistance * 0.8 && currentDist <= this.optimalDistance * 1.2) {
                    // At engagement distance - orbit player slightly
                    this.orbitAngle += deltaTime * this.orbitSpeed;
                    const orbitRadius = this.optimalDistance;
                    const orbitX = targetX + Math.cos(this.orbitAngle) * orbitRadius;
                    const orbitY = targetY + Math.sin(this.orbitAngle) * orbitRadius;
                    
                    // Blend orbital movement with direct approach
                    const orbitWeight = 0.3; // 30% orbital, 70% direct
                    moveTargetX = moveTargetX * (1 - orbitWeight) + orbitX * orbitWeight;
                    moveTargetY = moveTargetY * (1 - orbitWeight) + orbitY * orbitWeight;
                }
                
                // Add approach angle variation (room 1+)
                // Vary approach angle slightly to prevent straight-line charges
                if (currentDist > this.optimalDistance) {
                    const approachAngle = Math.atan2(dy, dx);
                    const angleVariation = (Math.random() - 0.5) * 0.3; // ±15 degrees variation
                    const variedAngle = approachAngle + angleVariation;
                    const variedX = targetX + Math.cos(variedAngle) * currentDist;
                    const variedY = targetY + Math.sin(variedAngle) * currentDist;
                    
                    // Blend varied approach (subtle)
                    const variationWeight = 0.2; // 20% variation
                    moveTargetX = moveTargetX * (1 - variationWeight) + variedX * variationWeight;
                    moveTargetY = moveTargetY * (1 - variationWeight) + variedY * variationWeight;
                }
                
                // Use environmental awareness for strategic positioning (rooms 8+)
                if (this.environmentalAwarenessEnabled && this.intelligenceLevel > 0.6) {
                    const strategicPos = this.getStrategicPosition(targetX, targetY, this.optimalDistance);
                    const strategicWeight = this.intelligenceLevel * 0.4; // Max 40% strategic
                    moveTargetX = moveTargetX * (1 - strategicWeight) + strategicPos.x * strategicWeight;
                    moveTargetY = moveTargetY * (1 - strategicWeight) + strategicPos.y * strategicWeight;
                }
                
                // Recalculate direction to strategic target
                dx = moveTargetX - this.x;
                dy = moveTargetY - this.y;
                distance = Math.sqrt(dx * dx + dy * dy);
                if (distance <= 0) distance = 1;
                
                // Apply separation force to avoid crowding (stronger)
                const separation = this.getSeparationForce(enemies, BASIC_ENEMY_CONFIG.separationRadius, BASIC_ENEMY_CONFIG.separationStrength);
                
                // Check for obstacles in direct path and avoid them (subtle, only when needed)
                const pathAvoidance = this.getPathAvoidance(moveTargetX, moveTargetY, enemies, 180);
                
                // Calculate lateral spread to break formations (subtle)
                const lateralSpread = this.getLateralSpreadForce(moveTargetX, moveTargetY, enemies, 
                    BASIC_ENEMY_CONFIG.lateralSpreadRadius, BASIC_ENEMY_CONFIG.lateralSpreadStrength);
                
                // Base movement direction toward strategic target
                let moveX = dx / distance;
                let moveY = dy / distance;
                
                // Blend all movement forces smoothly and naturally
                // Base: 70% toward player (primary goal)
                // Separation: 20% (when close to other enemies)
                // Path avoidance: 8% (only when obstacle directly in path)
                // Lateral spread: 2% (very subtle formation breaking)
                
                const sepDist = Math.sqrt(separation.x * separation.x + separation.y * separation.y);
                const pathAvoidDist = Math.sqrt(pathAvoidance.x * pathAvoidance.x + pathAvoidance.y * pathAvoidance.y);
                const lateralDist = Math.sqrt(lateralSpread.x * lateralSpread.x + lateralSpread.y * lateralSpread.y);
                
                let finalMoveX = moveX * 0.70;
                let finalMoveY = moveY * 0.70;
                
                // Apply separation (stronger when enemies are close, but smooth)
                if (sepDist > 0) {
                    const sepNormX = separation.x / sepDist;
                    const sepNormY = separation.y / sepDist;
                    // Smooth strength curve - only significant when very close
                    const sepStrength = Math.min(sepDist / 150, 1.0) * 0.5; // Max 50% influence
                    finalMoveX += sepNormX * 0.20 * sepStrength;
                    finalMoveY += sepNormY * 0.20 * sepStrength;
                }
                
                // Apply path avoidance (only when obstacle is directly blocking, subtle)
                if (pathAvoidDist > 0) {
                    const pathNormX = pathAvoidance.x / pathAvoidDist;
                    const pathNormY = pathAvoidance.y / pathAvoidDist;
                    // Only apply when obstacle is close and directly in path
                    const pathStrength = Math.min(pathAvoidDist / 300, 1.0) * 0.3; // Max 30% influence, scaled down
                    finalMoveX += pathNormX * 0.08 * pathStrength;
                    finalMoveY += pathNormY * 0.08 * pathStrength;
                }
                
                // Apply lateral spread (very subtle, only when formation is tight)
                if (lateralDist > 0) {
                    const lateralNormX = lateralSpread.x / lateralDist;
                    const lateralNormY = lateralSpread.y / lateralDist;
                    // Only apply when there's a clear imbalance
                    const lateralStrength = Math.min(lateralDist / 150, 1.0) * 0.2; // Max 20% influence
                    finalMoveX += lateralNormX * 0.02 * lateralStrength;
                    finalMoveY += lateralNormY * 0.02 * lateralStrength;
                }
                
                // Normalize final direction
                const finalDist = Math.sqrt(finalMoveX * finalMoveX + finalMoveY * finalMoveY);
                if (finalDist > 0) {
                    finalMoveX /= finalDist;
                    finalMoveY /= finalDist;
                }
                
                // Flanking behavior (room 2+)
                if (this.roomNumber >= BASIC_ENEMY_CONFIG.intelligenceThresholds.feintAttacks && this.coordinationEnabled) {
                    const allies = this.coordinateWithAllies(enemies);
                    if (allies && allies.length > 0) {
                        // Try to position on side/behind player
                        const allPlayers = this.getAllAlivePlayers();
                        allPlayers.forEach(({ player: p }) => {
                            if (p && p.alive) {
                                const playerAngle = Math.atan2(p.vy || 0, p.vx || 0);
                                const toPlayerX = p.x - this.x;
                                const toPlayerY = p.y - this.y;
                                const toPlayerAngle = Math.atan2(toPlayerY, toPlayerX);
                                
                                // Try to position at 90 degrees to player's facing direction
                                const flankAngle = playerAngle + Math.PI / 2 + (Math.random() - 0.5) * Math.PI / 2;
                                const flankX = p.x + Math.cos(flankAngle) * this.optimalDistance;
                                const flankY = p.y + Math.sin(flankAngle) * this.optimalDistance;
                                
                                // Blend flanking position
                                const flankWeight = 0.25 * this.intelligenceLevel;
                                moveTargetX = moveTargetX * (1 - flankWeight) + flankX * flankWeight;
                                moveTargetY = moveTargetY * (1 - flankWeight) + flankY * flankWeight;
                            }
                        });
                    }
                }
                
                // Improved swarming: try to surround player from multiple angles (rooms 5+)
                if (this.roomNumber >= BASIC_ENEMY_CONFIG.intelligenceThresholds.surroundFormation) {
                    // Find nearby allies of same type
                    const nearbyAllies = [];
                    enemies.forEach(other => {
                        if (other !== this && other.alive && other.shape === 'circle') {
                            const otherDx = other.x - this.x;
                            const otherDy = other.y - this.y;
                            const otherDist = Math.sqrt(otherDx * otherDx + otherDy * otherDy);
                            if (otherDist < BASIC_ENEMY_CONFIG.groupRadius) {
                                nearbyAllies.push({ enemy: other, distance: otherDist });
                            }
                        }
                    });
                    
                    if (nearbyAllies.length > 0) {
                        // Calculate average angle of allies relative to player
                        let avgAngle = 0;
                        nearbyAllies.forEach(({ enemy: ally }) => {
                            const allyDx = ally.x - targetX;
                            const allyDy = ally.y - targetY;
                            avgAngle += Math.atan2(allyDy, allyDx);
                        });
                        avgAngle /= nearbyAllies.length;
                        
                        // Try to position at different angle (90 degrees offset)
                        const desiredAngle = avgAngle + Math.PI / 2;
                        const desiredX = targetX + Math.cos(desiredAngle) * (this.attackRange * 0.8);
                        const desiredY = targetY + Math.sin(desiredAngle) * (this.attackRange * 0.8);
                        
                        const toDesiredX = desiredX - this.x;
                        const toDesiredY = desiredY - this.y;
                        const toDesiredDist = Math.sqrt(toDesiredX * toDesiredX + toDesiredY * toDesiredY);
                        
                        if (toDesiredDist > 10) {
                            // Blend surround positioning into final movement
                            const surroundX = toDesiredX / toDesiredDist;
                            const surroundY = toDesiredY / toDesiredDist;
                            finalMoveX = finalMoveX * 0.7 + surroundX * 0.3;
                            finalMoveY = finalMoveY * 0.7 + surroundY * 0.3;
                            const finalDist = Math.sqrt(finalMoveX * finalMoveX + finalMoveY * finalMoveY);
                            if (finalDist > 0) {
                                finalMoveX /= finalDist;
                                finalMoveY /= finalDist;
                            }
                        }
                    }
                }
                
                // If reacting to player attack, move slightly away (enabled from room 1)
                if (shouldDelayAttack && this.roomNumber >= BASIC_ENEMY_CONFIG.intelligenceThresholds.playerReactions) {
                    const awayX = -dx / distance;
                    const awayY = -dy / distance;
                    finalMoveX = finalMoveX * 0.5 + awayX * 0.5;
                    finalMoveY = finalMoveY * 0.5 + awayY * 0.5;
                    const finalDist = Math.sqrt(finalMoveX * finalMoveX + finalMoveY * finalMoveY);
                    if (finalDist > 0) {
                        finalMoveX /= finalDist;
                        finalMoveY /= finalDist;
                    }
                }
                
                // Wave attack coordination (room 3+)
                if (this.roomNumber >= BASIC_ENEMY_CONFIG.intelligenceThresholds.waveAttacks && this.coordinationEnabled && this.waveAttackReady) {
                    // Ready for coordinated wave attack - commit to attack
                    if (distance < this.currentAttackRange && this.attackCooldown <= 0) {
                        // Lock direction and start telegraph for wave attack
                        const waveDx = targetX - this.x;
                        const waveDy = targetY - this.y;
                        const waveDist = Math.sqrt(waveDx * waveDx + waveDy * waveDy);
                        if (waveDist > 0) {
                            this.lockedLungeDirX = waveDx / waveDist;
                            this.lockedLungeDirY = waveDy / waveDist;
                        }
                        this.state = 'telegraph';
                        this.telegraphElapsed = 0;
                        this.beginTelegraph('wave', {
                            duration: this.currentTelegraphDuration,
                            intensity: 1.2,
                            color: '#ff8c42',
                            projectRadius: this.damageProjectionRadius ? this.damageProjectionRadius * 1.2 : this.size * 1.4
                        });
                        this.waveAttackReady = false;
                    }
                }
                
                // Move with calculated direction
                this.applySmoothedDirectionalMovement(finalMoveX, finalMoveY, this.moveSpeed, deltaTime, 0.3);
            }
        } else if (this.state === 'retreat') {
            // Tactical reposition state - short, smart reposition
            this.retreatTimer -= deltaTime;
            
            // Check if we should cancel retreat early (player stopped attacking, allies arrived, etc.)
            let shouldCancelRetreat = false;
            if (targetPlayer && targetPlayer.alive) {
                // Cancel if player stopped attacking
                if (!this.isPlayerAttackThreatening(targetPlayer, { expansion: 1.05, padding: 6, includeEnemySize: false })) {
                    if (this.retreatTimer < 0.2) { // Only cancel if we've retreated a bit
                        shouldCancelRetreat = true;
                    }
                }
                
                // Cancel if we've moved far enough from player
                const dx = targetPlayer.x - this.x;
                const dy = targetPlayer.y - this.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > 100) {
                    shouldCancelRetreat = true; // Far enough, resume normal behavior
                }
            }
            
            if (this.retreatTimer <= 0 || !this.retreatTarget || shouldCancelRetreat) {
                this.state = 'chase';
                this.retreatTimer = 0;
                this.retreatTarget = null;
            } else {
                const retreatDx = this.retreatTarget.x - this.x;
                const retreatDy = this.retreatTarget.y - this.y;
                const retreatDist = Math.sqrt(retreatDx * retreatDx + retreatDy * retreatDy);
                
                if (retreatDist > 5) {
                    // Move toward retreat position
                    const retreatX = retreatDx / retreatDist;
                    const retreatY = retreatDy / retreatDist;
                    this.applySmoothedDirectionalMovement(retreatX, retreatY, this.moveSpeed * 1.1, deltaTime, 0.35);
                } else {
                    // Reached retreat position, cancel early
                    this.state = 'chase';
                    this.retreatTimer = 0;
                    this.retreatTarget = null;
                }
            }
        } else if (this.state === 'telegraph') {
            this.telegraphElapsed += deltaTime;
            
            // Counter branch: continually refine aim toward predicted dodge vector
            if (this.attackBranch === 'counter' && targetPlayer && targetPlayer.x !== undefined) {
                const predictiveWeight = this.getPredictiveWeight(0.25, 0.45);
                const playerVx = targetPlayer.vx || 0;
                const playerVy = targetPlayer.vy || 0;
                const predictionTime = predictiveWeight * (1 + this.intelligenceLevel * 0.35);
                const predictedX = targetPlayer.x + playerVx * predictionTime;
                const predictedY = targetPlayer.y + playerVy * predictionTime;
                const predDx = predictedX - this.x;
                const predDy = predictedY - this.y;
                const predDist = Math.sqrt(predDx * predDx + predDy * predDy);
                if (predDist > 0.001) {
                    this.lockedLungeDirX = predDx / predDist;
                    this.lockedLungeDirY = predDy / predDist;
                }
            }
            
            if (this.attackBranch === 'feint') {
                if (this.telegraphElapsed >= this.currentTelegraphDuration) {
                    if (this.activeTelegraph) this.endTelegraph();
                    this.comboLungeReady = true;
                    this.comboLungeWaitTimer = 0.2;
                    this.attackCooldown = Math.max(this.attackCooldown, this.attackCooldownTime * 0.35);
                    this.state = 'recovery';
                    this.recoveryElapsed = 0;
                    this.enterRecoveryWindow(this.attackRecoveryDuration * 0.7, 'feint', {
                        modifier: 1.15
                    });
                    this.attackBranch = 'commit';
                    this.counterAttackPending = false;
                    // Reposition slightly to one side to bait players
                    this.orbitAngle += (Math.random() > 0.5 ? 1 : -1) * Math.PI / 3;
                }
                return;
            }
            
            if (this.telegraphElapsed >= this.currentTelegraphDuration) {
                if (this.activeTelegraph) this.endTelegraph();
                
                if (typeof AudioManager !== 'undefined' && AudioManager.sounds) {
                    AudioManager.sounds.enemyLunge();
                }
                
                this.lungeStartX = this.x;
                this.lungeStartY = this.y;
                
                if (this.attackBranch === 'counter') {
                    this.lungeDuration = Math.max(0.25, this.baseLungeDuration * 0.85);
                    this.lungeSpeed = this.baseLungeSpeed * 1.1;
                } else {
                    this.lungeDuration = this.baseLungeDuration;
                    this.lungeSpeed = this.baseLungeSpeed;
                }
                
                this.state = 'lunge';
                this.lungeElapsed = 0;
                this.isFeinting = false;
            }
        } else if (this.state === 'lunge') {
            // Lunge in locked direction (linear, no reaiming)
            // Direction was locked when telegraph started, so lunge is predictable
            this.lungeElapsed += deltaTime;
            
            // Use locked direction (set during telegraph) - LINEAR, NO REAIMING
            const lungeDirX = this.lockedLungeDirX;
            const lungeDirY = this.lockedLungeDirY;
            
            // Calculate distance traveled from lunge start
            const lungeTravelX = this.x - this.lungeStartX;
            const lungeTravelY = this.y - this.lungeStartY;
            const lungeTravelDist = Math.sqrt(lungeTravelX * lungeTravelX + lungeTravelY * lungeTravelY);
            
            // Move in locked direction, but cap at maximum lunge distance
            const moveDistance = this.lungeSpeed * deltaTime;
            const remainingDistance = Math.max(0, this.lungeDistance - lungeTravelDist);
            const actualMove = Math.min(moveDistance, remainingDistance);
            
            this.x += lungeDirX * actualMove;
            this.y += lungeDirY * actualMove;
            
            // Update rotation to face lunge direction
            this.rotation = Math.atan2(lungeDirY, lungeDirX);
            this.movementHeading = this.rotation;
            
            // Check if lunge duration expired or max distance reached
            if (this.lungeElapsed >= this.lungeDuration || lungeTravelDist >= this.lungeDistance) {
                // Check for combo lunge opportunity (rooms 4+)
                if (this.roomNumber >= BASIC_ENEMY_CONFIG.intelligenceThresholds.comboLunge) {
                    const timeSinceDodge = (Date.now() - this.lastPlayerDodgeTime) / 1000;
                    const dodgeCooldown = 2.0; // Standard dodge cooldown
                    
                    // If player dodged recently, check for combo chance
                    if (timeSinceDodge < dodgeCooldown && this.lastPlayerDodgeTime > 0) {
                        const roomsPastThreshold = Math.max(0, this.roomNumber - BASIC_ENEMY_CONFIG.intelligenceThresholds.comboLunge);
                        const comboScale = Math.min(1.0, roomsPastThreshold / 3); // Scales over 3 rooms
                        const comboChance = BASIC_ENEMY_CONFIG.comboLungeChanceBase + 
                                          (BASIC_ENEMY_CONFIG.comboLungeChanceMax - BASIC_ENEMY_CONFIG.comboLungeChanceBase) * comboScale;
                        
                        if (Math.random() < comboChance * this.intelligenceLevel) {
                            // Set up combo lunge with wait timer
                            this.comboLungeReady = true;
                            this.comboLungeWaitTimer = 0.25; // 250ms wait before combo lunge
                            this.state = 'recovery';
                            this.recoveryElapsed = 0;
                            this.attackCooldown = this.attackCooldownTime;
                            this.telegraphElapsed = 0;
                            this.lungeElapsed = 0;
                            this.coordinationRole = null; // Reset coordination role
                            this.enterRecoveryWindow(this.attackRecoveryDuration * 0.6, 'comboPrime', {
                                modifier: 1.1
                            });
                            return; // Skip rest of lunge logic
                        }
                    }
                }
                
                // End lunge - enter recovery state
                this.state = 'recovery';
                this.recoveryElapsed = 0;
                this.attackCooldown = this.attackCooldownTime;
                this.telegraphElapsed = 0;
                this.lungeElapsed = 0;
                this.coordinationRole = null; // Reset coordination role
                this.enterRecoveryWindow(this.attackRecoveryDuration, this.attackBranch === 'counter' ? 'counter' : 'standard', {
                    modifier: this.attackBranch === 'counter' ? 1.35 : 1.0
                });
                this.counterAttackPending = false;
                this.attackBranch = 'commit';
                this.lungeSpeed = this.baseLungeSpeed;
                this.lungeDuration = this.baseLungeDuration;
            }
        } else if (this.state === 'recovery') {
            // Recovery state - brief backoff after lunge
            this.recoveryElapsed += deltaTime;
            
            // Update combo lunge wait timer
            if (this.comboLungeWaitTimer > 0) {
                this.comboLungeWaitTimer -= deltaTime;
            }
            
            // Move away from player slightly during recovery
            const recoveryDx = this.x - targetX;
            const recoveryDy = this.y - targetY;
            const recoveryDist = Math.sqrt(recoveryDx * recoveryDx + recoveryDy * recoveryDy);
            
            if (recoveryDist > 0) {
                const recoveryDirX = recoveryDx / recoveryDist;
                const recoveryDirY = recoveryDy / recoveryDist;
                const targetX = this.x + recoveryDirX * this.moveSpeed * 0.3 * deltaTime;
                const targetY = this.y + recoveryDirY * this.moveSpeed * 0.3 * deltaTime;
                this.smoothMoveTo(targetX, targetY, 0.35);
                this.smoothRotateTo(Math.atan2(recoveryDirY, recoveryDirX));
            }
            
            if (this.recoveryElapsed >= this.attackRecoveryDuration) {
                // Check if combo lunge is ready and wait timer expired
                if (this.comboLungeReady && this.comboLungeWaitTimer <= 0) {
                    // Combo lunge ready - transition to lunge (direction already locked in chase state)
                    this.comboLungeReady = false;
                    this.comboLungeWaitTimer = 0;
                    this.lungeStartX = this.x;
                    this.lungeStartY = this.y;
                    this.state = 'lunge';
                    this.lungeElapsed = 0;
                    this.telegraphElapsed = 0;
                } else {
                    // Normal recovery finished
                    this.state = 'cooldown';
                }
            }
        } else if (this.state === 'cooldown') {
            // Cooldown state - maintain distance and resume normal chase
            // Update combo lunge wait timer
            if (this.comboLungeWaitTimer > 0) {
                this.comboLungeWaitTimer -= deltaTime;
            }
            
            if (this.attackCooldown <= 0) {
                // Check if combo lunge is ready and wait timer expired
                if (this.comboLungeReady && this.comboLungeWaitTimer <= 0) {
                    // Combo lunge ready - transition to lunge (direction already locked in chase state)
                    this.comboLungeReady = false;
                    this.comboLungeWaitTimer = 0;
                    this.lungeStartX = this.x;
                    this.lungeStartY = this.y;
                    this.state = 'lunge';
                    this.lungeElapsed = 0;
                    this.telegraphElapsed = 0;
                } else {
                    // Normal cooldown finished
                    this.state = 'chase';
                    this.coordinationRole = null; // Reset coordination role
                }
            } else {
                // Maintain distance during cooldown (back off slightly)
                const cooldownDx = this.x - targetX;
                const cooldownDy = this.y - targetY;
                const cooldownDist = Math.sqrt(cooldownDx * cooldownDx + cooldownDy * cooldownDy);
                
                // Try to maintain optimal distance during cooldown
                if (cooldownDist < this.optimalDistance) {
                    // Too close - back off
                    const backoffX = cooldownDx / cooldownDist;
                    const backoffY = cooldownDy / cooldownDist;
                    const desiredX = this.x + backoffX * this.moveSpeed * 0.5 * deltaTime;
                    const desiredY = this.y + backoffY * this.moveSpeed * 0.5 * deltaTime;
                    this.smoothMoveTo(desiredX, desiredY, 0.3);
                    this.smoothRotateTo(Math.atan2(backoffY, backoffX));
                } else {
                    // Apply separation during cooldown
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
                    
                    this.applySmoothedDirectionalMovement(moveX, moveY, this.moveSpeed, deltaTime, 0.3);
                }
            }
        }
        
        // Resolve stacking with other enemies
        if (enemies.length > 0) {
            this.resolveStacking(enemies);
        }
        
        // Keep enemy within canvas bounds
        this.keepInBounds();
    }
    
    selectAttackBranch(targetPlayer) {
        const thresholds = BASIC_ENEMY_CONFIG.intelligenceThresholds;
        const canFeint = this.canUsePattern('feintAttacks', thresholds);
        const canCounter = this.intelligenceLevel > 0.55;
        const playerThreat = targetPlayer ? this.assessThreat(targetPlayer) : 0;
        
        let commitWeight = 0.55;
        let feintWeight = canFeint ? (0.15 + 0.25 * this.intelligenceLevel) : 0.05;
        let counterWeight = canCounter ? (0.1 + playerThreat * 0.25 + this.intelligenceLevel * 0.2) : 0.05;
        
        // Normalize distribution
        const total = commitWeight + feintWeight + counterWeight;
        const roll = Math.random() * total;
        if (roll <= commitWeight) {
            this.attackBranch = 'commit';
            this.isFeinting = false;
            this.counterAttackPending = false;
        } else if (roll <= commitWeight + feintWeight) {
            this.attackBranch = 'feint';
            this.isFeinting = true;
            this.counterAttackPending = false;
            this.feintTimer = this.telegraphProfile.feint.duration;
        } else {
            this.attackBranch = 'counter';
            this.isFeinting = false;
            this.counterAttackPending = true;
        }
    }
    
    moveTowardPlayer(deltaTime, dx, dy, distance) {
        this.applySmoothedDirectionalMovement(dx, dy, this.moveSpeed, deltaTime, 0.4);
    }
    
    render(ctx) {
        // Draw enemy with different colors and effects based on state
        let drawColor = this.color;
        let drawSize = this.size;
        
        const telegraphData = this.activeTelegraph;
        if (telegraphData) {
            const progress = telegraphData.progress !== undefined
                ? telegraphData.progress
                : Math.min(1, this.telegraphElapsed / Math.max(0.05, telegraphData.duration || this.currentTelegraphDuration || 0.5));
            const pulsePhase = Math.sin(progress * Math.PI * 4);
            const pulseIntensity = 0.6 + pulsePhase * 0.4;
            drawColor = telegraphData.color || '#ff4141';
            drawSize = this.size * (1 + (telegraphData.intensity || 1) * 0.12 * pulseIntensity);
        } else if (this.state === 'telegraph') {
            const pulsePhase = Math.sin(this.telegraphElapsed * 15);
            const pulseIntensity = (pulsePhase + 1) / 2;
            drawColor = `rgb(${255}, ${107 + pulseIntensity * 148}, ${107 + pulseIntensity * 148})`;
            drawSize = this.size * (1 + pulseIntensity * 0.15);
        } else if (this.state === 'lunge') {
            drawColor = '#ff3333'; // Bright red during lunge
            drawSize = this.size * 1.1; // Slightly larger during lunge
        } else if (this.state === 'recovery') {
            drawColor = '#ff9999'; // Lighter red during recovery
        } else if (this.state === 'cooldown') {
            drawColor = '#ff8888'; // Medium red during cooldown
        }
        
        // Draw lunge trail effect during lunge
        if (this.state === 'lunge') {
            // Draw trail behind enemy
            ctx.save();
            ctx.globalAlpha = 0.3;
            ctx.fillStyle = '#ff0000';
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size * 0.8, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
        
        ctx.fillStyle = drawColor;
        ctx.beginPath();
        ctx.arc(this.x, this.y, drawSize, 0, Math.PI * 2);
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
            this.x + Math.cos(this.rotation) * (drawSize + 5),
            this.y + Math.sin(this.rotation) * (drawSize + 5),
            5, 0, Math.PI * 2
        );
        ctx.fill();
        
        // Draw telegraph warning indicator (room 1+)
        if (telegraphData) {
            ctx.save();
            const telegraphRadius = telegraphData.projectRadius || (drawSize + 5);
            const alpha = 0.35 + (telegraphData.intensity || 1) * 0.35;
            ctx.strokeStyle = telegraphData.color || '#ff0000';
            ctx.lineWidth = 2 + (telegraphData.intensity || 1) * 1.2;
            ctx.globalAlpha = Math.min(0.8, alpha);
            ctx.beginPath();
            ctx.arc(this.x, this.y, telegraphRadius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        } else if (this.state === 'telegraph') {
            ctx.save();
            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.5;
            ctx.beginPath();
            ctx.arc(this.x, this.y, drawSize + 5, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }
    }
}

