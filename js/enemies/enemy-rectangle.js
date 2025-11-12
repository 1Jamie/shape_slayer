// Rectangle enemy - brute type

// ============================================================================
// RECTANGLE ENEMY CONFIGURATION - Adjust these values for game balancing
// ============================================================================

const RECTANGLE_CONFIG = {
    // Base Stats
    size: 25,                      // Enemy size (pixels, width)
    height: 40,                    // Enemy height (pixels)
    maxHp: 100,                    // Maximum health points
    damage: 8,                     // Damage per hit
    moveSpeed: 60,                 // Movement speed (pixels/second)
    xpValue: 25,                   // XP awarded when killed
    lootChance: 0.18,              // Chance to drop loot (0.18 = 18%)
    
    // Attack Behavior
    attackCooldown: 3.0,           // Time between attacks (seconds)
    chargeDurationBase: 1.2,       // Base charge duration (seconds)
    chargeDurationMin: 0.8,        // Minimum charge duration (rooms 11+)
    chargeDurationMax: 1.5,        // Maximum charge duration (rooms 11+)
    slamDuration: 0.3,             // Duration of slam attack (seconds)
    attackRange: 100,              // Distance to initiate attack (pixels)
    slamRadius: 100,               // Radius of slam AoE (pixels)
    
    // Intelligence scaling thresholds (lowered for faster ramp-up)
    intelligenceThresholds: {
        variableTiming: 7,         // Room when variable charge timing unlocks (was 11)
        fakeOutCharges: 10,        // Room when fake-out charges unlock (was 16)
        comboAttacks: 13,          // Room when combo attacks unlock (was 21)
        defensiveStance: 13,       // Room when defensive stance unlocks (was 21)
        roarAbility: 13            // Room when roar ability unlocks (was 21)
    },
    
    // Fake-out charge behavior
    fakeOutChanceBase: 0.15,       // Base fake-out chance at room 10 (increased from 0.10)
    fakeOutChanceMax: 0.25,        // Max fake-out chance at room 13+ (increased from 0.20)
    
    // Defensive stance
    defensiveHpThreshold: 0.4,     // HP % below which defensive stance activates
    defensiveDuration: 1.0,        // Duration of defensive stance (seconds)
    defensiveDamageReduction: 0.5, // Damage reduction during stance (50%)
    
    // Roar ability
    roarSlowAmount: 0.2,           // Slow amount applied by roar (20%)
    roarSlowDuration: 0.5,         // Duration of roar slow (seconds)
    roarRadius: 120                // Radius of roar effect (pixels)
};

class RectangleEnemy extends EnemyBase {
    constructor(x, y, inheritedTarget = null) {
        super(x, y, inheritedTarget);
        
        // Stats (from config)
        this.width = RECTANGLE_CONFIG.size;
        this.height = RECTANGLE_CONFIG.height;
        this.size = Math.max(this.width, this.height);
        this.maxHp = RECTANGLE_CONFIG.maxHp;
        this.hp = RECTANGLE_CONFIG.maxHp;
        this.damage = RECTANGLE_CONFIG.damage;
        this.moveSpeed = RECTANGLE_CONFIG.moveSpeed;
        this.baseMoveSpeed = RECTANGLE_CONFIG.moveSpeed; // Store for stun system
        
        // Properties
        this.color = '#cd7f32'; // Bronze
        this.shape = 'rectangle';
        this.xpValue = RECTANGLE_CONFIG.xpValue;
        this.lootChance = RECTANGLE_CONFIG.lootChance;
        
        // Attack system
        this.state = 'chase'; // 'chase', 'charge', 'slam', 'cooldown', 'defensive', 'fakeout'
        this.attackCooldown = 0;
        this.chargeDuration = RECTANGLE_CONFIG.chargeDurationBase;
        this.currentChargeDuration = this.chargeDuration; // May vary based on room
        this.slamDuration = RECTANGLE_CONFIG.slamDuration;
        this.chargeElapsed = 0;
        this.slamElapsed = 0;
        this.attackRange = RECTANGLE_CONFIG.attackRange;
        this.slamRadius = RECTANGLE_CONFIG.slamRadius;
        this.sizeMultiplier = 1.0;
        
        // Variable charge timing (rooms 11+)
        this.useVariableTiming = this.roomNumber >= RECTANGLE_CONFIG.intelligenceThresholds.variableTiming;
        
        // Fake-out charge system (rooms 16+)
        this.fakeOutTimer = 0;
        this.isFakingOut = false;
        
        // Combo attack system (rooms 21+)
        this.comboReady = false;
        this.comboChargeDuration = 0.15; // Quick shoulder charge
        
        // Defensive stance (rooms 21+)
        this.defensiveTimer = 0;
        this.defensiveActive = false;
        
        // Roar ability (rooms 21+)
        this.roarTimer = 0;
        this.roarCooldown = 0;
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
        
        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance <= 0) return;
        
        // Apply knockback
        this.processKnockback(deltaTime);
        
        // Get enemies array for AI behaviors
        const enemies = (typeof Game !== 'undefined' && Game.enemies) ? Game.enemies : [];
        
        // Defensive stance check (rooms 21+)
        if (this.roomNumber >= RECTANGLE_CONFIG.intelligenceThresholds.defensiveStance && 
            this.state !== 'defensive' && !this.defensiveActive) {
            const hpPercent = this.hp / this.maxHp;
            if (hpPercent < RECTANGLE_CONFIG.defensiveHpThreshold && Math.random() < 0.3 * this.intelligenceLevel) {
                this.state = 'defensive';
                this.defensiveTimer = RECTANGLE_CONFIG.defensiveDuration;
                this.defensiveActive = true;
            }
        }
        
        // Update defensive timer
        if (this.defensiveActive) {
            this.defensiveTimer -= deltaTime;
            if (this.defensiveTimer <= 0) {
                this.defensiveActive = false;
                this.defensiveTimer = 0;
                if (this.state === 'defensive') {
                    this.state = 'chase';
                }
            }
        }
        
        // Update roar cooldown
        if (this.roarCooldown > 0) {
            this.roarCooldown -= deltaTime;
        }
        
        // AI behavior
        if (this.state === 'chase' || this.state === 'defensive') {
            // Defensive stance: reduce incoming damage
            if (this.defensiveActive && this.state === 'defensive') {
                // Stay in place, brace for impact
                // Damage reduction handled in takeDamage override (would need to add)
                return;
            }
            
            // Check if in range and cooldown ready
            if (distance < this.attackRange && this.attackCooldown <= 0) {
                // Check for fake-out charge (rooms 16+)
                let shouldFakeOut = false;
                if (this.roomNumber >= RECTANGLE_CONFIG.intelligenceThresholds.fakeOutCharges) {
                    const roomsPastThreshold = Math.max(0, this.roomNumber - RECTANGLE_CONFIG.intelligenceThresholds.fakeOutCharges);
                    const fakeOutScale = Math.min(1.0, roomsPastThreshold / 3); // Scales over 3 rooms (was 4)
                    const fakeOutChance = RECTANGLE_CONFIG.fakeOutChanceBase + 
                                        (RECTANGLE_CONFIG.fakeOutChanceMax - RECTANGLE_CONFIG.fakeOutChanceBase) * fakeOutScale;
                    
                    if (Math.random() < fakeOutChance * this.intelligenceLevel) {
                        shouldFakeOut = true;
                        this.state = 'fakeout';
                        this.fakeOutTimer = this.chargeDuration * 0.4; // Shorter fake-out
                        this.isFakingOut = true;
                    }
                }
                
                if (!shouldFakeOut) {
                // Avoid starting charge if player is actively attacking (gives player time to react)
                // Check all alive players for attacks
                let avoidance = { x: 0, y: 0 };
                const allPlayers = this.getAllAlivePlayers();
                allPlayers.forEach(({ player: p }) => {
                    const playerAvoidance = this.avoidPlayerAttacks(p, 100);
                    avoidance.x += playerAvoidance.x;
                    avoidance.y += playerAvoidance.y;
                });
                const avoidDist = Math.sqrt(avoidance.x * avoidance.x + avoidance.y * avoidance.y);
                
                // If player is attacking nearby, wait and move away instead of charging
                if (avoidDist > 50) {
                    // Move away slightly to avoid interrupting player's attack
                    const dirX = dx / distance;
                    const dirY = dy / distance;
                    const avoidNormX = avoidance.x / avoidDist;
                    const avoidNormY = avoidance.y / avoidDist;
                    
                    // Blend movement with avoidance
                    let moveX = dirX * 0.7 + avoidNormX * 0.3;
                    let moveY = dirY * 0.7 + avoidNormY * 0.3;
                    const moveDist = Math.sqrt(moveX * moveX + moveY * moveY);
                    if (moveDist > 0) {
                        moveX /= moveDist;
                        moveY /= moveDist;
                    }
                    
                    this.x += moveX * this.moveSpeed * deltaTime;
                    this.y += moveY * this.moveSpeed * deltaTime;
                    
                    // Update rotation to face movement direction
                    if (moveX !== 0 || moveY !== 0) {
                        this.rotation = Math.atan2(moveY, moveX);
                    }
                } else {
                        // Roar before charging (rooms 21+)
                        if (this.roomNumber >= RECTANGLE_CONFIG.intelligenceThresholds.roarAbility && 
                            this.roarCooldown <= 0) {
                            // Apply roar slow to nearby players
                            const allPlayers = this.getAllAlivePlayers();
                            allPlayers.forEach(({ player: p }) => {
                                if (p.x && p.y) {
                                    const distToPlayer = Math.sqrt((p.x - this.x) ** 2 + (p.y - this.y) ** 2);
                                    if (distToPlayer < RECTANGLE_CONFIG.roarRadius && p.applySlow) {
                                        p.applySlow(RECTANGLE_CONFIG.roarSlowAmount, RECTANGLE_CONFIG.roarSlowDuration);
                                    }
                                }
                            });
                            this.roarCooldown = 5.0; // 5 second cooldown
                        }
                        
                    // Play slam charge sound
                    if (typeof AudioManager !== 'undefined' && AudioManager.sounds) {
                        AudioManager.sounds.enemySlam();
                    }
                        
                        // Variable charge timing (rooms 11+)
                        if (this.useVariableTiming) {
                            const variance = (RECTANGLE_CONFIG.chargeDurationMax - RECTANGLE_CONFIG.chargeDurationMin) * this.intelligenceLevel;
                            this.currentChargeDuration = RECTANGLE_CONFIG.chargeDurationMin + 
                                                       Math.random() * variance;
                        } else {
                            this.currentChargeDuration = this.chargeDuration;
                        }
                    
                    // No player attacks nearby (or very weak), start charge normally
                    this.state = 'charge';
                    this.chargeElapsed = 0;
                    this.sizeMultiplier = 1.0;
                    }
                }
            } else {
                // Slow chase toward player with separation
                const separation = this.getSeparationForce(enemies, 45, 100);
                const dirX = dx / distance;
                const dirY = dy / distance;
                
                let moveX = dirX;
                let moveY = dirY;
                
                // Apply separation
                const sepDist = Math.sqrt(separation.x * separation.x + separation.y * separation.y);
                if (sepDist > 0) {
                    const sepNormX = separation.x / sepDist;
                    const sepNormY = separation.y / sepDist;
                    const sepStrength = Math.min(sepDist, 80) / 80;
                    
                    moveX = moveX * 0.9 + sepNormX * 0.1 * sepStrength;
                    moveY = moveY * 0.9 + sepNormY * 0.1 * sepStrength;
                    
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
            }
        } else if (this.state === 'fakeout') {
            // Fake-out state: start charge but cancel
            this.fakeOutTimer -= deltaTime;
            this.sizeMultiplier = 1.0 + (1 - this.fakeOutTimer / (this.chargeDuration * 0.4)) * 0.3;
            
            if (this.fakeOutTimer <= 0) {
                // Cancel fake-out and reposition
                this.isFakingOut = false;
                this.fakeOutTimer = 0;
                this.sizeMultiplier = 1.0;
                this.state = 'chase';
                // Move away slightly
                const awayX = -dx / distance;
                const awayY = -dy / distance;
                this.x += awayX * this.moveSpeed * 0.5 * deltaTime;
                this.y += awayY * this.moveSpeed * 0.5 * deltaTime;
            }
        } else if (this.state === 'charge') {
            // Grow larger during charge
            this.chargeElapsed += deltaTime;
            this.sizeMultiplier = 1.0 + (this.chargeElapsed / this.currentChargeDuration) * 0.5;
            
            // Try to corner player (rooms 21+)
            if (this.roomNumber >= RECTANGLE_CONFIG.intelligenceThresholds.comboAttacks) {
                // Check if player is near wall/corner (simplified check)
                const allPlayers = this.getAllAlivePlayers();
                allPlayers.forEach(({ player: p }) => {
                    if (p.x && p.y && typeof currentRoom !== 'undefined' && currentRoom) {
                        const margin = 50;
                        const nearWall = p.x < margin || p.x > currentRoom.width - margin ||
                                       p.y < margin || p.y > currentRoom.height - margin;
                        if (nearWall) {
                            // Adjust charge direction slightly toward corner
                            const toCornerX = (p.x < currentRoom.width / 2 ? -1 : 1);
                            const toCornerY = (p.y < currentRoom.height / 2 ? -1 : 1);
                            // This influences positioning, not direct charge direction
                        }
                    }
                });
            }
            
            if (this.chargeElapsed >= this.currentChargeDuration) {
                // Perform slam - damage all players in radius
                if (typeof Game !== 'undefined') {
                    const allPlayers = this.getAllAlivePlayers();
                    allPlayers.forEach(({ id, player: p }) => {
                        // Skip clones/decoys (they don't have x/y properties or takeDamage)
                        if (!p.x || !p.y || typeof p.takeDamage !== 'function') return;
                        
                        const distToPlayer = Math.sqrt((p.x - this.x) ** 2 + (p.y - this.y) ** 2);
                        if (distToPlayer < this.slamRadius && !p.invulnerable) {
                            // Use takeDamage directly for local player, or damageRemotePlayer for remote players
                            if (typeof Game.getLocalPlayerId !== 'undefined' && Game.getLocalPlayerId() === id) {
                                p.takeDamage(this.damage);
                            } else if (typeof Game.damageRemotePlayer !== 'undefined' && id && !id.startsWith('local-')) {
                                Game.damageRemotePlayer(id, this.damage);
                            } else {
                                // Fallback for solo mode or local player
                                if (typeof p.takeDamage === 'function') {
                                    p.takeDamage(this.damage);
                                }
                            }
                        }
                    });
                }
                
                // Check for combo attack (rooms 21+)
                if (this.roomNumber >= RECTANGLE_CONFIG.intelligenceThresholds.comboAttacks && 
                    distance < this.attackRange * 1.2) {
                    const comboChance = 0.4 * this.intelligenceLevel;
                    if (Math.random() < comboChance) {
                        // Immediate combo shoulder charge
                        this.comboReady = true;
                        this.state = 'charge';
                        this.chargeElapsed = 0;
                        this.currentChargeDuration = this.comboChargeDuration;
                        this.sizeMultiplier = 1.0;
                        return; // Skip cooldown
                    }
                }
                
                this.state = 'cooldown';
                this.attackCooldown = RECTANGLE_CONFIG.attackCooldown;
                this.chargeElapsed = 0;
                this.sizeMultiplier = 1.0;
                this.comboReady = false;
            }
        } else if (this.state === 'cooldown') {
            if (this.attackCooldown <= 0) {
                this.state = 'chase';
            }
        }
        
        // Resolve stacking with other enemies
        if (enemies.length > 0) {
            this.resolveStacking(enemies);
        }
        
        // Safety check: ensure position is valid (prevent NaN/Infinity)
        if (!isFinite(this.x) || !isFinite(this.y)) {
            // Reset to a safe position if invalid
            if (typeof Game !== 'undefined') {
                this.x = isFinite(this.x) ? Math.max(50, Math.min(Game.canvas.width - 50, this.x)) : 400;
                this.y = isFinite(this.y) ? Math.max(50, Math.min(Game.canvas.height - 50, this.y)) : 300;
            } else {
                this.x = isFinite(this.x) ? this.x : 400;
                this.y = isFinite(this.y) ? this.y : 300;
            }
        }
        
        // Keep within bounds
        this.keepInBounds();
    }
    
    render(ctx) {
        // Draw rectangle shape
        ctx.save();
        ctx.translate(this.x, this.y);
        
        let drawColor = this.color;
        if (this.state === 'charge') {
            drawColor = '#8b0000'; // Dark red when charging
        }
        
        ctx.fillStyle = drawColor;
        ctx.beginPath();
        ctx.rect(-this.width * this.sizeMultiplier * 0.8, -this.height * this.sizeMultiplier * 0.8, 
                 this.width * this.sizeMultiplier * 1.6, this.height * this.sizeMultiplier * 1.6);
        ctx.fill();
        
        ctx.restore();
        
        // Draw status effects (burn, freeze)
        if (typeof renderBurnEffect !== 'undefined') {
            renderBurnEffect(ctx, this);
        }
        if (typeof renderFreezeEffect !== 'undefined') {
            renderFreezeEffect(ctx, this);
        }
        
        // Draw slam AoE indicator with pulsing effect
        if (this.state === 'charge') {
            ctx.save();
            
            // Calculate pulse intensity (0 to 1 based on charge progress)
            const chargeProgress = this.chargeElapsed / this.chargeDuration;
            const pulseIntensity = 0.3 + (Math.sin(chargeProgress * Math.PI * 8) * 0.5 + 0.5) * 0.7; // Pulse faster as charge progresses
            
            // Outer warning ring (bright red, pulsing)
            ctx.strokeStyle = `rgba(255, 0, 0, ${pulseIntensity * 0.8})`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.slamRadius, 0, Math.PI * 2);
            ctx.stroke();
            
            // Inner fill (semi-transparent red, pulsing)
            ctx.fillStyle = `rgba(255, 0, 0, ${pulseIntensity * 0.2})`;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.slamRadius, 0, Math.PI * 2);
            ctx.fill();
            
            // Additional bright flash at high charge
            if (chargeProgress > 0.7) {
                const flashAlpha = (chargeProgress - 0.7) / 0.3;
                ctx.strokeStyle = `rgba(255, 255, 0, ${flashAlpha * 0.9})`;
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.slamRadius, 0, Math.PI * 2);
                ctx.stroke();
            }
            
            ctx.restore();
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

