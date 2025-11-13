// Base player class with shared functionality

// Class definitions (visual/identity properties only - gameplay values are in *_CONFIG objects)
// This ensures CONFIG objects are the single source of truth for all balance values
const CLASS_DEFINITIONS = {
    square: {
        name: 'Warrior',
        color: '#4a90e2',
        shape: 'square'
    },
    triangle: {
        name: 'Rogue',
        color: '#ff1493',
        shape: 'triangle'
    },
    pentagon: {
        name: 'Tank',
        color: '#c72525',
        shape: 'pentagon'
    },
    hexagon: {
        name: 'Mage',
        color: '#673ab7',
        shape: 'hexagon'
    }
};

class PlayerBase {
    constructor(x = 400, y = 300) {
        // Position
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        
        // Appearance
        this.size = 25;
        this.color = '#4a90e2';
        this.rotation = 0;
        
        // Player identification (for multiplayer damage attribution)
        this.playerId = null; // Will be set by Game when creating player instances
        
        // Health system
        this.maxHp = 100;
        this.baseMaxHp = 100; // Store base max HP for gear calculations
        this.hp = 100;
        this.level = 1;
        
        // XP system
        this.xp = 0;
        this.xpToNext = 100;
        this.lastLevelBonusesApplied = 1; // Track last level we applied bonuses for (prevent double application)
        
        // Attack system
        this.attackCooldown = 0;
        this.attackCooldownTime = 0.3; // 0.3 seconds
        this.attackDuration = 0.1; // How long attack hitbox exists
        this.isAttacking = false;
        this.attackHitboxes = [];
        
        // Dodge system
        this.dodgeCooldown = 0;
        this.dodgeCooldownTime = 2.0; // 2 seconds
        this.dodgeDuration = 0.3; // 0.3 seconds
        this.isDodging = false;
        this.dodgeElapsed = 0;
        this.lastShiftState = false;
        this.dodgeSpeedBoost = 500;
        this.dodgeVx = 0;
        this.dodgeVy = 0;
        this.dodgeHitEnemies = new Set(); // Track enemies hit during current dodge
        this.dodgeCharges = 1;
        this.maxDodgeCharges = 1;
        this.dodgeChargeCooldowns = [0]; // Track cooldown per charge
        
        // Dash visual animation state
        this.dashAnimActive = false;
        this.dashAnimTimer = 0;
        this.dashAnimDuration = this.dodgeDuration + 0.18;
        this.dashAnimDirX = 1;
        this.dashAnimDirY = 0;
        this.dashAnimHeadingX = 1;
        this.dashAnimHeadingY = 0;
        this.dashAnimRelaxTime = 0.18;
        this.dashAnimPath = [];
        this.dashAnimPathMaxPoints = 14;
        this.dashAnimLastPos = { x: this.x, y: this.y };
        this.dashTrail = [];
        this.dashTrailLifetime = 0.25;
        this.dashAnimCurveAmount = 0;
        this.dashAnimStretch = 1;
        this.dashAnimSqueeze = 1;
        this.dashAnimBurstPending = false;
        this.dashAnimPrevHeadingX = 1;
        this.dashAnimPrevHeadingY = 0;
        this._dashAnimAdvancedFrame = -1;
        this.dashAnimTravelPhase = 0;
        this.dashAnimRelaxPhase = 0;
        
        // Rare affix state tracking
        this.rampageStacks = 0;
        this.rampageStackDecay = 0; // Time until stack decay
        this.fortifyShield = 0; // Temporary shield amount
        this.fortifyShieldDecay = 0; // Time until shield decay
        
        // Enemy-inflicted status effects
        this.statusEffects = {
            bleed: null,
            guardBreak: null
        };
        this.guardBreakLockout = 0;
        this.guardBreakMovementScalar = 1;
        
        // Heavy attack system
        this.heavyAttackCooldown = 0;
        this.heavyAttackCooldownTime = 1.5; // 1.5 seconds
        this.heavyAttackWindup = 0.3; // 0.3 seconds windup
        this.isChargingHeavy = false;
        this.heavyChargeElapsed = 0;
        this.lastMouseRight = false;
        
        // State
        this.alive = true;
        this.dead = false;
        this.lastMouseLeft = false; // Track mouse button state for click detection
        this.invulnerable = false;
        this.invulnerabilityTime = 0;
        
        // Class (will be set by subclass)
        this.playerClass = null;
        
        // Equipment slots
        this.weapon = null;
        this.armor = null;
        this.accessory = null;
        
        // Base stats (before gear bonuses)
        this.baseDamage = 10;
        this.baseDefense = 0;
        this.baseMoveSpeed = 200;
        this.initialBaseMoveSpeed = 200; // Store original for level scaling calculations
        this.baseDamageBase = this.baseDamage;
        this.baseMaxHpBase = this.baseMaxHp;
        this.baseDefenseBase = this.baseDefense;
        
        // Special abilities
        this.specialCooldown = 0;
        this.specialCooldownTime = 5.0;
        this.lastSpacebar = false;
        
        // Heavy attack animations
        this.heavyChargeEffectActive = false;
        this.heavyChargeEffectElapsed = 0;
        this.heavyChargeEffectDuration = 0.3;
        
        // Pull force system (for boss effects like Vortex)
        this.pullForceVx = 0;
        this.pullForceVy = 0;
        this.pullDecay = 0.85; // Per second decay rate
        
        // Damage knockback system (receiving knockback from enemies)
        this.damageKnockbackVx = 0;
        this.damageKnockbackVy = 0;
        this.damageKnockbackDecay = 0.2125; // 15% faster decay than previous 0.25 (~78.75% reduction per second)
        this.knockbackResistance = 1.0; // Higher = less displacement from hits
        this.damageKnockbackMaxVelocity = 800; // Maximum knockback velocity (pixels per second)
        this.damageKnockbackMaxDuration = 2.0; // Maximum duration in seconds before forced stop
        this.damageKnockbackTimer = 0; // Track how long knockback has been active
        
        // Interpolation targets (for multiplayer client smoothing)
        this.targetX = null;
        this.targetY = null;
        this.targetRotation = null;
        
        // Initialize effective stats (will be calculated based on base + gear)
        this.damage = this.baseDamage;
        this.defense = this.baseDefense;
        this.moveSpeed = this.baseMoveSpeed;
        
        // Affix-derived stats (initialized to neutral values)
        this.critDamageMultiplier = 1.0;     // Base 100% crit damage
        this.attackSpeedMultiplier = 1.0;    // 1.0 = no bonus
        this.lifesteal = 0;                  // 0 = no lifesteal
        this.cooldownReduction = 0;          // 0-1 range, reduces all cooldowns
        this.aoeMultiplier = 1.0;            // 1.0 = no AoE bonus
        this.projectileSpeedMultiplier = 1.0; // 1.0 = normal speed
        this.knockbackMultiplier = 1.0;      // 1.0 = normal knockback
        this.bonusDodgeCharges = 0;          // Extra dodge charges from gear
        this.bonusMaxHealth = 0;             // Flat HP increase from gear
        
        // Initialize effective stats
        this.damageMultiplier = 1.0;
        this.defenseMultiplier = 1.0;
        this.healthMultiplier = 1.0;
        this.updateEffectiveStats();
    }
    
    
    update(deltaTime, input) {
        // Don't update if dead
        if (this.dead) {
            this.alive = false;
            return;
        }
        
        this.updateEnemyDebuffs(deltaTime);
        
        // Handle movement - skip if dodging or if subclass handles movement during special abilities
        if (!this.isDodging && !this.isInSpecialMovement()) {
            // Use unified movement input (works for both keyboard and touch)
            const moveInput = input.getMovementInput ? input.getMovementInput() : { x: 0, y: 0 };
            
            this.vx = moveInput.x * this.moveSpeed;
            this.vy = moveInput.y * this.moveSpeed;
        } else if (this.isDodging) {
            // During dodge, use dodge velocity
            this.vx = this.dodgeVx;
            this.vy = this.dodgeVy;
        }
        
        if (this.guardBreakMovementScalar !== 1) {
            this.vx *= this.guardBreakMovementScalar;
            this.vy *= this.guardBreakMovementScalar;
        }
        
        // Apply knockback from enemy hits before normal movement handling
        this.processDamageKnockback(deltaTime);
        
        // Process pull forces (apply before normal movement)
        this.processPullForces(deltaTime);
        
        // Update position (skip during special movement handled by subclass)
        if (!this.isInSpecialMovement()) {
            this.x += this.vx * deltaTime;
            this.y += this.vy * deltaTime;
        }
        
        // Note: Mage blink knockback moved to player-mage.js updateClassAbilities()
        // Note: Rogue dodge collision damage moved to player-rogue.js updateClassAbilities()
        
        // Keep player within room bounds (not canvas bounds)
        if (typeof currentRoom !== 'undefined' && currentRoom) {
            this.x = clamp(this.x, this.size, currentRoom.width - this.size);
            this.y = clamp(this.y, this.size, currentRoom.height - this.size);
        } else if (typeof Game !== 'undefined') {
            // Fallback to canvas bounds if room not available
            this.x = clamp(this.x, this.size, Game.canvas.width - this.size);
            this.y = clamp(this.y, this.size, Game.canvas.height - this.size);
        }
        
        // Calculate rotation to face aim direction (mouse or joystick)
        if (input.getAimDirection) {
            this.rotation = input.getAimDirection();
        } else if (input.mouse.x !== undefined && input.mouse.y !== undefined) {
            // Use world coordinates for mouse position
            const worldMouse = input.getWorldMousePos ? input.getWorldMousePos() : input.mouse;
            const dx = worldMouse.x - this.x;
            const dy = worldMouse.y - this.y;
            this.rotation = Math.atan2(dy, dx);
        }
        
        // Handle attacks
        this.handleAttack(input);
        
        // Handle heavy attacks
        this.handleHeavyAttack(input);
        
        // Handle dodge roll
        this.handleDodge(input);
        
        // Handle special abilities (calls subclass override)
        this.handleSpecialAbility(input);
        
        // Update class-specific abilities (called by subclass)
        this.updateClassAbilities(deltaTime, input);
        
        // Update attack cooldown
        if (this.attackCooldown > 0) {
            this.attackCooldown -= deltaTime;
        }
        
        // Update heavy attack cooldown
        if (this.heavyAttackCooldown > 0) {
            this.heavyAttackCooldown -= deltaTime;
        }
        
        // Update dodge cooldowns (supports both single and multi-charge systems)
        const usesChargeDodge = this.usesChargeBasedDodge();
        if (usesChargeDodge) {
            let readyCharges = 0;
            for (let i = 0; i < this.dodgeChargeCooldowns.length; i++) {
                if (this.dodgeChargeCooldowns[i] > 0) {
                    this.dodgeChargeCooldowns[i] = Math.max(0, this.dodgeChargeCooldowns[i] - deltaTime);
                }
                if (this.dodgeChargeCooldowns[i] <= 0) {
                    readyCharges++;
                }
            }
            this.dodgeCharges = readyCharges;
        } else {
            if (this.dodgeCooldown > 0) {
                this.dodgeCooldown = Math.max(0, this.dodgeCooldown - deltaTime);
            }
            if (this.dodgeChargeCooldowns && this.dodgeChargeCooldowns.length > 0) {
                this.dodgeChargeCooldowns[0] = this.dodgeCooldown;
            }
            this.dodgeCharges = this.dodgeCooldown <= 0 ? 1 : 0;
        }
        
        // Update attack hitboxes
        this.updateAttackHitboxes(deltaTime);
        
        // Update invulnerability
        if (this.invulnerabilityTime > 0) {
            this.invulnerabilityTime -= deltaTime;
            if (this.invulnerabilityTime <= 0) {
                this.invulnerable = false;
            }
        }
        
        // Update dodge state
        if (this.isDodging) {
            this.dodgeElapsed += deltaTime;
            if (this.dodgeElapsed >= this.dodgeDuration) {
                // End dodge
                this.isDodging = false;
                this.dodgeElapsed = 0;
                this.dodgeHitEnemies.clear(); // Reset hit tracking
                
                // Grant additional i-frames after dodge ends for safety
                this.invulnerable = true;
                this.invulnerabilityTime = 0.3; // 0.3s post-dodge i-frames
            }
        }
        
        // Update heavy attack charge
        if (this.isChargingHeavy) {
            // Check if this class uses joystick for heavy attack on mobile
            // Use INPUT PARAMETER not global Input (important for multiplayer remote players)
            const usesHeavyJoystick = input.isTouchMode && input.isTouchMode() &&
                input.getAbilityInputType && 
                input.getAbilityInputType(this.playerClass, 'heavyAttack') === 'joystick-press-release';
            
            if (usesHeavyJoystick && (this.playerClass === 'square' || this.playerClass === 'triangle')) {
                // Warrior/Triangle on mobile: for joystick-press-release mode, check for button release
                if (input.touchButtons && input.touchButtons.heavyAttack) {
                    const button = input.touchButtons.heavyAttack;
                    
                    // Rotation is already updated by getAimDirection() which checks heavy attack joystick first
                    // Update preview (subclass handles this)
                    this.updateHeavyAttackPreview(input);
                    
                    // Fire on release
                    if (button.justReleased) {
                        // Rotation already updated above, fire the attack immediately
                        this.createHeavyAttack();
                        this.applyHeavyAttackCooldown(); // Apply cooldown after firing
                        this.isChargingHeavy = false;
                        this.heavyChargeElapsed = 0;
                        // Clear previews (subclass handles this)
                        this.clearHeavyAttackPreview();
                    } else {
                        // Continue charging while button is held
                        this.heavyChargeElapsed += deltaTime;
                    }
                } else {
                    // Button not found, just continue charging (fallback)
                    this.heavyChargeElapsed += deltaTime;
                }
            } else {
                // Other classes: wait for windup
                this.heavyChargeElapsed += deltaTime;
                if (this.heavyChargeElapsed >= this.heavyAttackWindup) {
                    // Spawn heavy attack hitbox
                    this.createHeavyAttack();
                    this.applyHeavyAttackCooldown(); // Apply cooldown after firing
                    this.isChargingHeavy = false;
                    this.heavyChargeElapsed = 0;
                }
            }
        }
        
        // Update special ability cooldown
        if (this.specialCooldown > 0) {
            this.specialCooldown -= deltaTime;
        }
        
        // Update heavy charge effect animation
        if (this.heavyChargeEffectActive) {
            this.heavyChargeEffectElapsed += deltaTime;
            
            if (this.heavyChargeEffectElapsed >= this.heavyChargeEffectDuration) {
                this.heavyChargeEffectActive = false;
                this.heavyChargeEffectElapsed = 0;
            }
        }
        
        // Update rampage stacks (decay over time)
        if (this.rampageStacks > 0) {
            this.rampageStackDecay -= deltaTime;
            if (this.rampageStackDecay <= 0) {
                this.rampageStacks = Math.max(0, this.rampageStacks - 1);
                this.rampageStackDecay = 5.0; // 5 seconds per stack decay
            }
        }
        
        // Update fortify shield (decay over time)
        if (this.fortifyShield > 0) {
            this.fortifyShieldDecay -= deltaTime;
            if (this.fortifyShieldDecay <= 0) {
                const decayAmount = this.fortifyShield * 0.1; // 10% per second
                this.fortifyShield = Math.max(0, this.fortifyShield - decayAmount);
                this.fortifyShieldDecay = 0.1; // Decay check every 0.1s
            }
        }
        
        if (this.dashAnimActive) {
            this.sampleDashAnimation(this.x, this.y);
        }
        this.advanceDashAnimation(deltaTime, 'update');
    }
    
    // Check if player is in special movement state (override by subclass)
    isInSpecialMovement() {
        return false;
    }
    
    // Update class-specific abilities (override by subclass)
    updateClassAbilities(deltaTime, input) {
        // Override in subclass for class-specific ability updates
    }
    
    // Update heavy attack preview (override by subclass)
    updateHeavyAttackPreview(input) {
        // Override in subclass if needed
    }
    
    // Clear heavy attack preview (override by subclass)
    clearHeavyAttackPreview() {
        // Override in subclass if needed
    }
    
    handleAttack(input) {
        // Check for attack input (mouse click or touch joystick)
        let shouldAttack = false;
        
        if (input.isTouchMode && input.isTouchMode()) {
            // Touch mode: check if basic attack joystick is active with magnitude > threshold
            if (input.isAbilityPressed && input.isAbilityPressed('basicAttack')) {
                // Fire continuously while joystick is active and cooldown ready
                if (this.attackCooldown <= 0) {
                    shouldAttack = true;
                }
            }
        } else {
            // Keyboard/mouse mode: check for left click (once per press)
            const mouseJustClicked = input.mouseLeft && !this.lastMouseLeft;
            this.lastMouseLeft = input.mouseLeft;
            
            if (mouseJustClicked && this.attackCooldown <= 0) {
                shouldAttack = true;
            }
        }
        
        if (shouldAttack) {
            this.executeAttack(input);
        }
    }
    
    // Execute attack - override in subclass
    executeAttack(input) {
        // Subclass must override this
        throw new Error('executeAttack() must be implemented by subclass');
    }
    
    updateAttackHitboxes(deltaTime) {
        // Update each hitbox and remove expired ones
        this.attackHitboxes = this.attackHitboxes.filter(hitbox => {
            hitbox.elapsed += deltaTime;
            
            // Handle hammer swing (for Tank class)
            if (hitbox.type === 'hammer') {
                const progress = hitbox.elapsed / hitbox.duration; // 0 to 1
                
                // Calculate current angle - sweep through the arc
                if (hitbox.swingDirection === -1) {
                    // Swinging left: start from right, sweep to left (decrease angle)
                    hitbox.currentAngle = hitbox.startAngle - (hitbox.arcWidth * progress);
                } else {
                    // Swinging right: start from left, sweep to right (increase angle)
                    hitbox.currentAngle = hitbox.startAngle + (hitbox.arcWidth * progress);
                }
                
                // Update hammer position (use gameplay position for authoritative positioning)
                const pos = this.getGameplayPosition();
                hitbox.x = pos.x + Math.cos(hitbox.currentAngle) * hitbox.hammerDistance;
                hitbox.y = pos.y + Math.sin(hitbox.currentAngle) * hitbox.hammerDistance;
                
                // Add current position to trail (for visual effect)
                const trailAge = 0.25; // Trail lasts 0.25 seconds
                hitbox.trail.push({
                    x: hitbox.x,
                    y: hitbox.y,
                    time: hitbox.elapsed
                });
                
                // Remove old trail entries
                hitbox.trail = hitbox.trail.filter(trailPoint => {
                    return (hitbox.elapsed - trailPoint.time) < trailAge;
                });
            }
            
            // Handle expanding AoE (for Mage class)
            if (hitbox.expanding) {
                const progress = hitbox.elapsed / hitbox.duration;
                const currentRadius = hitbox.startRadius + (hitbox.endRadius - hitbox.startRadius) * progress;
                hitbox.radius = currentRadius;
            }
            
            return hitbox.elapsed < hitbox.duration;
        });
    }
    
    handleDodge(input) {
        if (this.isDodging) return; // Already dodging
        
        // Check for dodge input (Shift key or touch button/joystick)
        let dodgeJustPressed = false;
        let dodgeButtonPressed = false;
        
        if (input.isTouchMode && input.isTouchMode()) {
            // Touch mode: check for dodge button
            if (input.touchButtons && input.touchButtons.dodge) {
                const button = input.touchButtons.dodge;
                dodgeButtonPressed = button.pressed;
                
                // Triangle uses joystick: fire on release (press-and-hold-to-aim, release-to-fire)
                if (this.playerClass === 'triangle') {
                    dodgeJustPressed = button.justReleased;
                    
                    if (button.justReleased) {
                        console.log(`[${this.playerClass}] Detected dodge justReleased, finalJoystickState:`, button.finalJoystickState);
                    }
                    
                    // Update dash preview and rotation while button is pressed and joystick is active
                    if (button.pressed && input.touchJoysticks && input.touchJoysticks.dodge) {
                        const joystick = input.touchJoysticks.dodge;
                        if (joystick.active && joystick.getMagnitude() > 0.1) {
                            // Update rotation to face joystick direction while aiming
                            this.rotation = joystick.getAngle();
                            // Show preview
                            this.dashPreviewActive = true;
                        } else {
                            // Joystick not active, hide preview
                            this.dashPreviewActive = false;
                        }
                    } else if (!button.pressed) {
                        // Button released, hide preview
                        this.dashPreviewActive = false;
                    }
                } else {
                    // Other classes: fire on press
                    dodgeJustPressed = button.justPressed;
                }
            }
        } else {
            // Keyboard mode: check for Shift key press
            const shiftJustPressed = input.getKeyState('shift') && !this.lastShiftState;
            this.lastShiftState = input.getKeyState('shift');
            dodgeJustPressed = shiftJustPressed;
        }
        
        // Check if dodge is available
        let canDodge = false;
        const usesChargeDodge = this.usesChargeBasedDodge();
        
        if (usesChargeDodge) {
            canDodge = this.getReadyDodgeCharges() > 0;
        } else {
            canDodge = this.dodgeCooldown <= 0;
        }
        
        if (this.guardBreakLockout > 0) {
            canDodge = false;
        }
        
        // If dodge pressed/released and available
        if (dodgeJustPressed && canDodge) {
            console.log(`[${this.playerClass}] Starting dodge! justReleased: ${dodgeJustPressed}, canDodge: ${canDodge}`);
            // Clear preview before starting dodge
            this.dashPreviewActive = false;
            this.startDodge(input);
        } else if (dodgeJustPressed && !canDodge) {
            console.log(`[${this.playerClass}] Dodge on cooldown!`);
        }
    }
    
    usesChargeBasedDodge() {
        return (this.maxDodgeCharges || 0) > 1 || (this.dodgeChargeCooldowns && this.dodgeChargeCooldowns.length > 1);
    }
    
    getReadyDodgeCharges() {
        if (!this.dodgeChargeCooldowns || this.dodgeChargeCooldowns.length === 0) return 0;
        let ready = 0;
        for (let i = 0; i < this.dodgeChargeCooldowns.length; i++) {
            if (this.dodgeChargeCooldowns[i] <= 0) {
                ready++;
            }
        }
        return ready;
    }
    
    consumeDodgeCharge() {
        if (this.usesChargeBasedDodge()) {
            this.dodgeCooldown = 0;
            for (let i = 0; i < this.dodgeChargeCooldowns.length; i++) {
                if (this.dodgeChargeCooldowns[i] <= 0) {
                    this.dodgeChargeCooldowns[i] = this.dodgeCooldownTime;
                    break;
                }
            }
            this.dodgeCharges = this.getReadyDodgeCharges();
        } else {
            this.dodgeCooldown = this.dodgeCooldownTime;
            if (this.dodgeChargeCooldowns && this.dodgeChargeCooldowns.length > 0) {
                this.dodgeChargeCooldowns[0] = this.dodgeCooldown;
            }
            this.dodgeCharges = 0;
        }
    }
    
    startDodge(input) {
        console.log(`[DODGE START] playerClass: ${this.playerClass}, rotation: ${this.rotation}`);
        console.log(`[DODGE START] input object:`, input);
        console.log(`[DODGE START] input.touchButtons:`, input.touchButtons);
        console.log(`[DODGE START] input.touchButtons.dodge:`, input.touchButtons?.dodge);
        console.log(`[DODGE START] isTouchMode:`, input.isTouchMode ? input.isTouchMode() : 'NO FUNCTION');
        
        // Calculate dodge direction
        let dodgeDirX = 0;
        let dodgeDirY = 0;
        
        // Triangle (Rogue) uses joystick for directional dash on mobile
        if (this.playerClass === 'triangle') {
            console.log(`[DODGE] Triangle path - checking touch mode`);
            
            if (input.isTouchMode && input.isTouchMode()) {
                console.log(`[DODGE] Touch mode confirmed!`);
                // On mobile: use dodge joystick direction if available
                const button = input.touchButtons && input.touchButtons.dodge;
                console.log(`[DODGE] button:`, button, 'finalJoystickState:', button?.finalJoystickState);
                
                if (button && button.finalJoystickState) {
                    // Use stored joystick state from button release
                    const state = button.finalJoystickState;
                    console.log(`[${this.playerClass}] Using finalJoystickState - mag: ${state.magnitude}, dir: (${state.direction.x.toFixed(2)}, ${state.direction.y.toFixed(2)}), angle: ${state.angle}`);
                    
                    if (state.magnitude > 0.1) {
                        dodgeDirX = state.direction.x * this.dodgeSpeedBoost;
                        dodgeDirY = state.direction.y * this.dodgeSpeedBoost;
                        console.log(`[${this.playerClass}] Dodge direction from finalState: (${dodgeDirX.toFixed(2)}, ${dodgeDirY.toFixed(2)})`);
                        // Clear the stored state after using it
                        button.finalJoystickState = null;
                    } else {
                        // Magnitude too low, use facing direction
                        dodgeDirX = Math.cos(this.rotation) * this.dodgeSpeedBoost;
                        dodgeDirY = Math.sin(this.rotation) * this.dodgeSpeedBoost;
                        console.log(`[${this.playerClass}] Magnitude too low, using rotation: ${this.rotation}`);
                    }
                } else if (input.touchJoysticks && input.touchJoysticks.dodge && input.touchJoysticks.dodge.active) {
                    // Joystick is still active (fallback)
                    const joystick = input.touchJoysticks.dodge;
                    const dir = joystick.getDirection();
                    dodgeDirX = dir.x * this.dodgeSpeedBoost;
                    dodgeDirY = dir.y * this.dodgeSpeedBoost;
                    console.log(`[${this.playerClass}] Using active joystick: (${dodgeDirX.toFixed(2)}, ${dodgeDirY.toFixed(2)})`);
                } else {
                    // Fallback: use movement joystick direction
                    const moveInput = input.getMovementInput ? input.getMovementInput() : { x: 0, y: 0 };
                    const inputLength = Math.sqrt(moveInput.x * moveInput.x + moveInput.y * moveInput.y);
                    
                    if (inputLength > 0) {
                        dodgeDirX = moveInput.x * this.dodgeSpeedBoost;
                        dodgeDirY = moveInput.y * this.dodgeSpeedBoost;
                    } else {
                        dodgeDirX = Math.cos(this.rotation) * this.dodgeSpeedBoost;
                        dodgeDirY = Math.sin(this.rotation) * this.dodgeSpeedBoost;
                    }
                }
            } else {
                // Desktop: always dash in facing direction
                dodgeDirX = Math.cos(this.rotation) * this.dodgeSpeedBoost;
                dodgeDirY = Math.sin(this.rotation) * this.dodgeSpeedBoost;
            }
        } else {
            // Other classes dodge based on movement input
            const moveInput = input.getMovementInput ? input.getMovementInput() : { x: 0, y: 0 };
            const inputLength = Math.sqrt(moveInput.x * moveInput.x + moveInput.y * moveInput.y);
            
            if (inputLength > 0) {
                // If player is moving, dodge in movement direction
                dodgeDirX = moveInput.x * this.dodgeSpeedBoost;
                dodgeDirY = moveInput.y * this.dodgeSpeedBoost;
            } else {
                // If standing still, dodge forward (toward mouse/aiming direction)
                dodgeDirX = Math.cos(this.rotation) * this.dodgeSpeedBoost;
                dodgeDirY = Math.sin(this.rotation) * this.dodgeSpeedBoost;
            }
        }
        
        // Store dodge velocity
        this.dodgeVx = dodgeDirX;
        this.dodgeVy = dodgeDirY;
        
        this.beginDashAnimation(dodgeDirX, dodgeDirY, { seedTrail: true });
        
        // Update rotation to face dodge direction
        if (dodgeDirX !== 0 || dodgeDirY !== 0) {
            this.rotation = Math.atan2(dodgeDirY, dodgeDirX);
            this.lastAimAngle = this.rotation; // Store for mobile aim retention
        }
        
        // Set dodge state
        this.isDodging = true;
        this.invulnerable = true;
        this.dodgeElapsed = 0;
        this.dodgeHitEnemies.clear(); // Reset hit tracking for new dodge
        
        // Play dodge sound (generic whoosh - can be overridden by subclasses)
        if (typeof AudioManager !== 'undefined' && AudioManager.sounds) {
            AudioManager.sounds.dodge();
        }
        
        this.consumeDodgeCharge();
    }
    
    beginDashAnimation(dirX, dirY, options = {}) {
        let normX = this.dashAnimHeadingX;
        let normY = this.dashAnimHeadingY;
        const magnitude = Math.sqrt(dirX * dirX + dirY * dirY);
        if (magnitude > 0.0001) {
            normX = dirX / magnitude;
            normY = dirY / magnitude;
        } else if (this.dashAnimDirX && this.dashAnimDirY) {
            normX = this.dashAnimDirX;
            normY = this.dashAnimDirY;
        } else {
            normX = Math.cos(this.rotation || 0);
            normY = Math.sin(this.rotation || 0);
        }
        
        this.dashAnimDirX = normX;
        this.dashAnimDirY = normY;
        this.dashAnimHeadingX = normX;
        this.dashAnimHeadingY = normY;
        this.dashAnimPrevHeadingX = normX;
        this.dashAnimPrevHeadingY = normY;
        this.dashAnimActive = true;
        this.dashAnimTimer = options.timer !== undefined ? options.timer : 0;
        this.dashAnimStretch = 1;
        this.dashAnimSqueeze = 1;
        this.dashAnimCurveAmount = 0;
        this.dashAnimPath = [];
        this.dashAnimLastPos = { x: this.x, y: this.y };
        this.dashTrail = [];
        this.dashAnimBurstPending = true;
        this._dashAnimAdvancedFrame = -1;
        this.dashAnimTravelPhase = 0;
        this.dashAnimRelaxPhase = 0;
        
        if (options.seedTrail) {
            this.sampleDashAnimation(this.x, this.y, true);
        }
    }
    
    endDashAnimation({ clearTrail = false } = {}) {
        if (!this.dashAnimActive) return;
        this.dashAnimActive = false;
        this.dashAnimTimer = 0;
        this.dashAnimStretch = 1;
        this.dashAnimSqueeze = 1;
        this.dashAnimCurveAmount = 0;
        this.dashAnimBurstPending = false;
        this.dashAnimLastPos = { x: this.x, y: this.y };
        this.dashAnimPrevHeadingX = this.dashAnimHeadingX;
        this.dashAnimPrevHeadingY = this.dashAnimHeadingY;
        this.dashAnimTravelPhase = 0;
        this.dashAnimRelaxPhase = 0;
        if (clearTrail) {
            this.dashTrail = [];
        }
    }
    
    advanceDashAnimation(deltaTime, source = 'update') {
        if (!deltaTime || deltaTime <= 0) {
            return;
        }
        
        const hasFrameCounter = typeof Game !== 'undefined' && Game && typeof Game.frameCount === 'number';
        let shouldProcess = true;
        if (hasFrameCounter) {
            if (this._dashAnimAdvancedFrame === Game.frameCount && source === 'interpolate') {
                shouldProcess = false;
            } else {
                this._dashAnimAdvancedFrame = Game.frameCount;
            }
        }
        
        if (!shouldProcess) {
            return;
        }
        
        const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
        const easeOutBack = (t) => {
            const c1 = 1.70158;
            const c3 = c1 + 1;
            const x = t - 1;
            return 1 + c3 * x * x * x + c1 * x * x;
        };
        
        if (this.dashAnimActive) {
            const safeDuration = Math.max(this.dodgeDuration, 0.0001);
            this.dashAnimTimer += deltaTime;
            const travelPhase = Math.min(this.dashAnimTimer / safeDuration, 1);
            this.dashAnimTravelPhase = travelPhase;
            const travelStretch = 1 + 0.35 * easeOutCubic(travelPhase);
            let stretch = travelStretch;
            let squeeze = Math.max(0.55, 1 - (travelStretch - 1) * 0.6);
            
            if (!this.isDodging) {
                const relaxDuration = Math.max(this.dashAnimRelaxTime, 0.0001);
                const relaxRaw = Math.max(this.dashAnimTimer - this.dodgeDuration, 0) / relaxDuration;
                const relaxPhase = Math.min(relaxRaw, 1);
                this.dashAnimRelaxPhase = relaxPhase;
                const snapEase = easeOutBack(relaxPhase);
                const overshoot = 0.2;
                stretch = 1 + (travelStretch - 1 + overshoot) * (1 - snapEase);
                squeeze = Math.max(0.6, 1 - (stretch - 1) * 0.7);
                
                if (relaxPhase >= 1) {
                    this.endDashAnimation();
                }
            } else {
                this.dashAnimRelaxPhase = 0;
            }
            
            this.dashAnimStretch = stretch;
            this.dashAnimSqueeze = squeeze;
        } else {
            this.dashAnimStretch = 1;
            this.dashAnimSqueeze = 1;
            this.dashAnimTravelPhase = 0;
            this.dashAnimRelaxPhase = 0;
        }
        
        if (this.dashAnimBurstPending && !this.isDodging) {
            this.spawnDashBurst();
            this.dashAnimBurstPending = false;
        }
        
        this.dashAnimCurveAmount *= Math.pow(0.5, deltaTime * 6);
        
        if (this.dashTrail.length > 0) {
            this.dashTrail = this.dashTrail.filter(point => {
                point.age += deltaTime;
                return point.age < this.dashTrailLifetime;
            });
        }
    }
    
    sampleDashAnimation(x, y, force = false) {
        if (!this.dashAnimActive) {
            return;
        }
        
        if (!this.dashAnimLastPos) {
            this.dashAnimLastPos = { x, y };
        }
        
        let dx = x - this.dashAnimLastPos.x;
        let dy = y - this.dashAnimLastPos.y;
        let distSq = dx * dx + dy * dy;
        
        if (!force && distSq < 0.25) {
            return;
        }
        
        let dirX = this.dashAnimHeadingX;
        let dirY = this.dashAnimHeadingY;
        if (distSq >= 0.0001) {
            const dist = Math.sqrt(distSq);
            dirX = dx / dist;
            dirY = dy / dist;
        }
        
        const blend = 0.35;
        const prevHX = this.dashAnimHeadingX;
        const prevHY = this.dashAnimHeadingY;
        let newHX = prevHX * (1 - blend) + dirX * blend;
        let newHY = prevHY * (1 - blend) + dirY * blend;
        const newMag = Math.sqrt(newHX * newHX + newHY * newHY);
        if (newMag > 0.0001) {
            newHX /= newMag;
            newHY /= newMag;
        } else {
            newHX = dirX;
            newHY = dirY;
        }
        
        this.dashAnimPrevHeadingX = this.dashAnimHeadingX;
        this.dashAnimPrevHeadingY = this.dashAnimHeadingY;
        this.dashAnimHeadingX = newHX;
        this.dashAnimHeadingY = newHY;
        
        const cross = this.dashAnimPrevHeadingX * newHY - this.dashAnimPrevHeadingY * newHX;
        this.dashAnimCurveAmount = this.dashAnimCurveAmount * 0.7 + cross * 0.3;
        
        this.dashAnimLastPos = { x, y };
        this.dashAnimPath.push({ x, y });
        if (this.dashAnimPath.length > this.dashAnimPathMaxPoints) {
            this.dashAnimPath.shift();
        }
        
        const pointStrength = Math.min(Math.sqrt(distSq), this.dodgeSpeedBoost * 0.016);
        this.dashTrail.push({
            x,
            y,
            dirX: newHX,
            dirY: newHY,
            age: 0,
            strength: pointStrength
        });
        if (this.dashTrail.length > this.dashAnimPathMaxPoints) {
            this.dashTrail.shift();
        }
    }
    
    spawnDashBurst() {
        const dirX = this.dashAnimHeadingX;
        const dirY = this.dashAnimHeadingY;
        
        if (typeof createDirectionalParticleBurst === 'function') {
            createDirectionalParticleBurst(this.x, this.y, dirX, dirY, this.color, {
                count: 12,
                spread: Math.PI / 6,
                speed: 220,
                size: 4
            });
        } else if (typeof createParticleBurst === 'function') {
            createParticleBurst(this.x, this.y, this.color, 10);
        }
    }
    
    handleHeavyAttack(input) {
        // Check for heavy attack input (right click or touch button/joystick)
        let heavyJustPressed = false;
        let heavyPressed = false;
        
        if (input.isTouchMode && input.isTouchMode()) {
            // Check if this class uses joystick for heavy attack
            const usesHeavyJoystick = typeof Input !== 'undefined' && 
                Input.getAbilityInputType && 
                Input.getAbilityInputType(this.playerClass, 'heavyAttack') === 'joystick-press-release';
            
            if (usesHeavyJoystick && (this.playerClass === 'square' || this.playerClass === 'triangle')) {
                // Warrior/Triangle: use joystick for directional charge attack (press and hold to aim, release to fire)
                if (input.touchButtons && input.touchButtons.heavyAttack) {
                    const button = input.touchButtons.heavyAttack;
                    heavyPressed = button.pressed;
                    
                    // Start charging when button is pressed (only if not already charging)
                    if (button.justPressed && this.heavyAttackCooldown <= 0 && !this.isChargingHeavy) {
                        this.startHeavyAttack();
                        // Initialize preview based on class
                        this.initHeavyAttackPreview();
                    }
                    
                    // Rotation is already updated by getAimDirection() which checks heavy attack joystick first
                    // Just update preview
                    if (this.isChargingHeavy && button.pressed) {
                        this.updateHeavyAttackPreview(input);
                    } else if (this.isChargingHeavy && !button.pressed) {
                        // Button released, hide preview
                        this.clearHeavyAttackPreview();
                    }
                }
                // Note: Fire on release is handled in the charge update loop
                return; // Heavy attack is handled above for these classes
            } else {
                // Other classes: check for heavy attack button release (press-and-release)
                if (input.touchButtons && input.touchButtons.heavyAttack) {
                    heavyJustPressed = input.touchButtons.heavyAttack.justReleased;
                }
            }
        } else {
            // Keyboard/mouse mode: check for right click (once per press)
            const rightJustClicked = input.mouseRight && !this.lastMouseRight;
            this.lastMouseRight = input.mouseRight;
            heavyJustPressed = rightJustClicked;
        }
        
        // If heavy attack triggered and cooldown ready (for non-warrior/triangle classes)
        if (heavyJustPressed && this.heavyAttackCooldown <= 0 && !this.isChargingHeavy) {
            this.startHeavyAttack();
        }
    }
    
    // Initialize heavy attack preview (override by subclass)
    initHeavyAttackPreview() {
        // Override in subclass if needed
    }
    
    handleSpecialAbility(input) {
        // Check for special ability input (Spacebar or touch button)
        let specialJustPressed = false;
        let specialPressed = false;
        
        if (input.isTouchMode && input.isTouchMode()) {
            // Touch mode: check for special ability button
            if (input.touchButtons && input.touchButtons.specialAbility) {
                const button = input.touchButtons.specialAbility;
                specialPressed = button.pressed;
                
                // Different behavior based on ability type - handled by subclasses
                // Most classes: press-and-release (non-directional)
                specialJustPressed = button.justReleased;
            }
        } else {
            // Keyboard/mouse mode: check for Spacebar
            const spaceJustPressed = input.getKeyState(' ') && !this.lastSpacebar;
            this.lastSpacebar = input.getKeyState(' ');
            specialJustPressed = spaceJustPressed;
            specialPressed = input.getKeyState(' ');
            
            // Class-specific special ability handling moved to subclasses
        }
        
        // Check if cooldown ready
        if (specialJustPressed && this.specialCooldown <= 0) {
            // Call subclass-specific special ability activation
            this.activateSpecialAbility(input);
        }
    }
    
    // Activate special ability - override in subclass
    activateSpecialAbility(input) {
        // Subclass must override this
        throw new Error('activateSpecialAbility() must be implemented by subclass');
    }
    
    startHeavyAttack() {
        // Start charging
        this.isChargingHeavy = true;
        this.heavyChargeElapsed = 0;
        // NOTE: Cooldown is now set when the attack is actually fired (in applyHeavyAttackCooldown)
    }
    
    // Create heavy attack - override in subclass
    createHeavyAttack() {
        // Subclass must override this
        throw new Error('createHeavyAttack() must be implemented by subclass');
    }
    
    // Apply heavy attack cooldown after attack is fired
    applyHeavyAttackCooldown() {
        // Apply attack speed and weapon type to heavy attack cooldown
        const weaponCooldownMult = this.weaponCooldownMultiplier || 1.0;
        const effectiveHeavyCooldown = this.heavyAttackCooldownTime * weaponCooldownMult / (1 + (this.attackSpeedMultiplier - 1));
        
        // Overcharge: Chance to refund cooldown
        if (this.overchargeChance && this.overchargeChance > 0 && Math.random() < this.overchargeChance) {
            console.log('[Overcharge] Heavy attack cooldown refunded!');
            this.heavyAttackCooldown = 0;
        } else {
            this.heavyAttackCooldown = effectiveHeavyCooldown;
        }
    }
    
    // Set special cooldown with overcharge check
    setSpecialCooldown(cooldownTime) {
        // Overcharge: Chance to refund cooldown
        if (this.overchargeChance && this.overchargeChance > 0 && Math.random() < this.overchargeChance) {
            console.log('[Overcharge] Special ability cooldown refunded!');
            this.specialCooldown = 0;
        } else {
            this.specialCooldown = cooldownTime;
        }
    }
    
    takeDamage(damage, sourceEnemy = null) {
        if (this.invulnerable || this.dead) return;
        
        // Phasing: Chance to negate damage
        if (this.phasingChance && this.phasingChance > 0 && Math.random() < this.phasingChance) {
            // Phased through the attack!
            if (typeof createParticleBurst !== 'undefined') {
                createParticleBurst(this.x, this.y, '#aaaaff', 8);
            }
            console.log('[Phasing] Avoided damage!');
            return; // Completely negate damage
        }
        
        // Fortify shield: absorb damage first
        if (this.fortifyShield && this.fortifyShield > 0) {
            if (this.fortifyShield >= damage) {
                // Shield absorbs all damage
                this.fortifyShield -= damage;
                console.log(`[Fortify] Shield absorbed ${damage.toFixed(1)} damage`);
                return; // No damage to HP
            } else {
                // Shield absorbs partial damage
                damage -= this.fortifyShield;
                console.log(`[Fortify] Shield absorbed ${this.fortifyShield.toFixed(1)} damage, ${damage.toFixed(1)} remaining`);
                this.fortifyShield = 0;
            }
        }
        
        // Apply damage reduction from defense and class-based sources
        const reduction = this.computeDamageReduction();
        damage = damage * (1 - reduction);
        
        // Track damage taken in player stats
        if (typeof Game !== 'undefined' && Game.getPlayerStats && Game.getLocalPlayerId) {
            const playerId = Game.getLocalPlayerId();
            const stats = Game.getPlayerStats(playerId);
            stats.addStat('damageTaken', damage);
            
            if (typeof Telemetry !== 'undefined') {
                const sourceType = sourceEnemy && sourceEnemy.isBoss
                    ? 'boss'
                    : (sourceEnemy && sourceEnemy.type) ? sourceEnemy.type : 'enemy';
                const sourceId = sourceEnemy && (sourceEnemy.id || sourceEnemy.enemyId || sourceEnemy.bossName)
                    ? (sourceEnemy.id || sourceEnemy.enemyId || sourceEnemy.bossName)
                    : null;
                
                Telemetry.recordPlayerHit({
                    playerId,
                    amount: damage,
                    roomNumber: Game.roomNumber,
                    sourceId,
                    sourceType
                });
            }
        }
        
        // Apply thorns damage reflection (if we have thorns and know the source)
        if (this.thornsReflect && sourceEnemy && sourceEnemy.alive && typeof sourceEnemy.takeDamage === 'function') {
            const reflectedDamage = damage * this.thornsReflect;
            
            // Calculate damage dealt BEFORE applying damage
            const damageDealt = Math.min(reflectedDamage, sourceEnemy.hp);
            
            // Get player ID for damage attribution
            const attackerId = this.playerId || (typeof Game !== 'undefined' && Game.getLocalPlayerId ? Game.getLocalPlayerId() : null);
            
            sourceEnemy.takeDamage(reflectedDamage, attackerId);
            
            // Track stats (host/solo only)
            const isClient = typeof Game !== 'undefined' && Game.isMultiplayerClient && Game.isMultiplayerClient();
            if (!isClient && typeof Game !== 'undefined' && Game.getPlayerStats && attackerId) {
                const stats = Game.getPlayerStats(attackerId);
                if (stats) {
                    stats.addStat('damageDealt', damageDealt);
                }
                
                // Track kill if enemy died
                if (sourceEnemy.hp <= 0) {
                    const killStats = Game.getPlayerStats(attackerId);
                    if (killStats) {
                        killStats.addStat('kills', 1);
                    }
                }
            }
            
            // Visual feedback for thorns
            if (typeof createDamageNumber !== 'undefined') {
                createDamageNumber(sourceEnemy.x, sourceEnemy.y, damageDealt, false, false);
            }
        }
        
        // Subtract damage from HP
        this.hp -= damage;
        
        // Trigger screen shake on taking damage
        if (typeof Game !== 'undefined') {
            Game.triggerScreenShake(0.3, 0.15);
        }
        
        // Set invulnerability
        this.invulnerable = true;
        this.invulnerabilityTime = 0.5; // 0.5 seconds of invulnerability
        
        // Check if dead
        if (this.hp <= 0) {
            // Check for phoenix down legendary effect (charge-based system)
            if (this.hasPhoenixDown && this.phoenixDownCharges > 0) {
                this.phoenixDownCharges--;
                this.hp = this.maxHp * this.phoenixDownHealth;
                this.invulnerable = true;
                this.invulnerabilityTime = 2.0; // 2s immunity after revival
                console.log('Phoenix Down activated! Revived at ' + (this.phoenixDownHealth * 100) + '% HP. Charges remaining: ' + this.phoenixDownCharges);
                
                // Visual effect for revival (if createParticleBurst exists)
                if (typeof createParticleBurst !== 'undefined') {
                    createParticleBurst(this.x, this.y, '#ff9800', 20);
                }
                
                return; // Don't actually die
            }
            
            // Play player death sound
            if (typeof AudioManager !== 'undefined' && AudioManager.sounds) {
                AudioManager.sounds.playerDeath();
            }
            
            this.hp = 0;
            this.dead = true;
            this.alive = false;
            
            if (typeof Telemetry !== 'undefined') {
                const playerId = this.playerId || (typeof Game !== 'undefined' && Game.getLocalPlayerId ? Game.getLocalPlayerId() : 'local');
                Telemetry.recordPlayerDeath(playerId);
            }
            
            // In multiplayer as a client, execute minimal death logic
            // Host will track stats and currency, but client needs to show death screen
            const isMultiplayerClient = typeof Game !== 'undefined' && 
                                         Game.multiplayerEnabled && 
                                         typeof multiplayerManager !== 'undefined' && 
                                         multiplayerManager && 
                                         multiplayerManager.lobbyCode &&
                                         !multiplayerManager.isHost;
            
            if (isMultiplayerClient) {
                // Clients: Mark as dead locally for death screen, host confirms via game_state
                if (typeof Game !== 'undefined' && Game.getPlayerStats && Game.getLocalPlayerId) {
                    const playerId = Game.getLocalPlayerId();
                    const stats = Game.getPlayerStats(playerId);
                    stats.onDeath();
                    
                    // Add to dead players set
                    Game.deadPlayers.add(playerId);
                    
                    // Record end time for death screen
                    Game.endTime = Date.now();
                    Game.deathScreenStartTime = Date.now(); // Initialize death screen timer
                    Game.currencyEarned = Game.calculateCurrency();
                    
                    // Set waiting flag - client must wait for host to signal return
                    Game.waitingForHostReturn = true;
                }
                
                console.log('[Client] Died - HP reached 0, waiting for host signal');
                return;
            }
            
            // Host or solo: Execute full death logic
            
            // Track death in stats (stop counting alive time)
            if (typeof Game !== 'undefined' && Game.getPlayerStats && Game.getLocalPlayerId) {
                const playerId = Game.getLocalPlayerId();
                const stats = Game.getPlayerStats(playerId);
                stats.onDeath();
                
                // Add to dead players set
                Game.deadPlayers.add(playerId);
                
                // Check if all players are dead
                if (Game.checkAllPlayersDead) {
                    Game.allPlayersDead = Game.checkAllPlayersDead();
                    
                    // If all players just died, send final stats to clients (host only)
                    if (Game.allPlayersDead && Game.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.isHost) {
                        if (Game.sendFinalStats) {
                            Game.sendFinalStats();
                        }
                    }
                    
                    if ((!Game.multiplayerEnabled || Game.allPlayersDead) && typeof Game.triggerGameOverMusic === 'function') {
                        Game.triggerGameOverMusic();
                    }
                }
            }
            
            // Record end time for death screen and calculate currency
            if (typeof Game !== 'undefined') {
                Game.endTime = Date.now();
                Game.deathScreenStartTime = Date.now(); // Initialize death screen timer
                Game.currencyEarned = Game.calculateCurrency();
            }
            
            console.log('Player died!');
        } else {
            console.log(`Player took ${damage} damage! HP: ${this.hp}/${this.maxHp}`);
        }
    }
    
    applyBleed(dps, duration, sourceEnemy = null) {
        if (!dps || dps <= 0 || !duration || duration <= 0) return;
        if (!this.statusEffects) {
            this.statusEffects = { bleed: null, guardBreak: null };
        }
        const existing = this.statusEffects.bleed;
        if (existing) {
            existing.dps = Math.max(existing.dps, dps);
            existing.duration = Math.max(existing.duration, duration);
            existing.elapsed = 0;
            existing.sourceEnemy = sourceEnemy || existing.sourceEnemy || null;
        } else {
            this.statusEffects.bleed = {
                dps,
                duration,
                elapsed: 0,
                accumulator: 0,
                tickRate: 0.5,
                sourceEnemy: sourceEnemy || null
            };
        }
    }
    
    clearBleed() {
        if (this.statusEffects) {
            this.statusEffects.bleed = null;
        }
    }
    
    applyGuardBreak(duration, options = {}) {
        if (!duration || duration <= 0) return;
        if (!this.statusEffects) {
            this.statusEffects = { bleed: null, guardBreak: null };
        }
        const movementPenalty = clamp(options.movementPenalty !== undefined ? options.movementPenalty : 0.55, 0.2, 1);
        const dodgeLockout = Math.max(0, options.dodgeLockout !== undefined ? options.dodgeLockout : duration);
        this.statusEffects.guardBreak = {
            duration,
            elapsed: 0,
            movementPenalty,
            appliedAt: Date.now()
        };
        this.guardBreakLockout = Math.max(this.guardBreakLockout || 0, duration + dodgeLockout);
        if (typeof createParticleBurst !== 'undefined') {
            createParticleBurst(this.x, this.y, '#ffb347', 10);
        }
    }
    
    isGuardBroken() {
        return !!(this.statusEffects && this.statusEffects.guardBreak) || (this.guardBreakLockout > 0);
    }
    
    updateEnemyDebuffs(deltaTime) {
        if (!this.statusEffects) {
            this.statusEffects = { bleed: null, guardBreak: null };
        }
        
        this.guardBreakMovementScalar = 1;
        
        const isClient = typeof Game !== 'undefined' && Game.isMultiplayerClient && Game.isMultiplayerClient();
        const bleed = this.statusEffects.bleed;
        if (bleed) {
            bleed.elapsed += deltaTime;
            bleed.accumulator = (bleed.accumulator || 0) + deltaTime;
            const tickRate = bleed.tickRate || 0.5;
            if (!isClient && !this.dead) {
                while (bleed.accumulator >= tickRate) {
                    bleed.accumulator -= tickRate;
                    const tickDamage = bleed.dps * tickRate;
                    this.takeDamage(tickDamage, bleed.sourceEnemy || null);
                }
            }
            if (bleed.elapsed >= bleed.duration || this.dead) {
                this.statusEffects.bleed = null;
            }
        }
        
        const guardBreak = this.statusEffects.guardBreak;
        if (guardBreak) {
            guardBreak.elapsed += deltaTime;
            this.guardBreakMovementScalar = guardBreak.movementPenalty;
            if (guardBreak.elapsed >= guardBreak.duration || this.dead) {
                this.statusEffects.guardBreak = null;
                this.guardBreakMovementScalar = 1;
            }
        }
        
        if (this.guardBreakLockout > 0) {
            this.guardBreakLockout = Math.max(0, this.guardBreakLockout - deltaTime);
        }
    }
    
    // Combine defense stat with class-specific reductions
    computeDamageReduction() {
        const defenseReduction = clamp(this.defense || 0, 0, 0.95);
        const classReduction = clamp(this.getDamageReduction() || 0, 0, 0.95);
        const combinedReduction = 1 - (1 - defenseReduction) * (1 - classReduction);
        return clamp(combinedReduction, 0, 0.95);
    }
    
    // Get additional damage reduction factor (0-1) from class mechanics - override in subclass
    getDamageReduction() {
        // Default: no class-based reduction (subclasses can override for block stance, shield, etc.)
        return 0;
    }
    
    // Add XP and check for level up
    addXP(amount) {
        // 10% bonus XP for faster leveling
        const bonusXP = amount * 1.1;
        this.xp += bonusXP;
        
        // Check if enough XP to level up
        while (this.xp >= this.xpToNext) {
            this.levelUp();
        }
    }
    
    // Apply level up stat bonuses (extracted for multiplayer clients)
    // This applies damage, health, and speed bonuses based on current level
    applyLevelUpBonuses() {
        // Prevent double application - only apply bonuses once per level
        if (this.lastLevelBonusesApplied >= this.level) {
            console.log(`[Player] Bonuses already applied for level ${this.level}, skipping`);
            return;
        }
        
        // Increase base stats (damage 7%, HP 10%)
        this.baseDamageBase = (this.baseDamageBase || this.baseDamage) * 1.07;
        this.baseDamage = this.baseDamageBase;
        this.baseMaxHpBase = (this.baseMaxHpBase || this.baseMaxHp) * 1.1;
        this.baseMaxHp = this.baseMaxHpBase;
        this.maxHp = this.baseMaxHp;
        
        // Apply class-specific speed scaling with cap
        let speedBoost = 0;
        
        // Levels 1-5: All classes get +5% per level
        if (this.level >= 2 && this.level <= 5) {
            const levelsCompleted = this.level - 1; // Level 2 = 1 boost, Level 5 = 4 boosts
            speedBoost = this.initialBaseMoveSpeed * 0.05 * levelsCompleted;
        } else if (this.level > 5) {
            // After level 5, base boost is 4 * 5% = 20%
            speedBoost = this.initialBaseMoveSpeed * 0.20;
            
            // Rogue gets additional boosts on levels 6, 8, 10
            if (this.playerClass === 'triangle') {
                let rogueExtraBoosts = 0;
                if (this.level >= 6) rogueExtraBoosts++;
                if (this.level >= 8) rogueExtraBoosts++;
                if (this.level >= 10) rogueExtraBoosts++;
                
                speedBoost += this.initialBaseMoveSpeed * 0.08 * rogueExtraBoosts;
            }
        }
        
        // Apply speed boost with cap
        this.baseMoveSpeed = this.initialBaseMoveSpeed + speedBoost;
        
        // Cap at 450 pixels/second or 1.5x initial speed, whichever is higher
        const maxSpeedCap = Math.max(450, this.initialBaseMoveSpeed * 1.5);
        if (this.baseMoveSpeed > maxSpeedCap) {
            this.baseMoveSpeed = maxSpeedCap;
        }
        
        // Recalculate effective stats with gear bonuses
        this.updateEffectiveStats();
        
        // Heal to full HP
        this.hp = this.maxHp;
        
        // Mark that we've applied bonuses for this level
        this.lastLevelBonusesApplied = this.level;
    }
    
    // Level up function
    levelUp() {
        // Play level up sound
        if (typeof AudioManager !== 'undefined' && AudioManager.sounds) {
            AudioManager.sounds.levelUp();
        }
        
        this.level++;
        
        // Apply stat bonuses
        this.applyLevelUpBonuses();
        
        // Multiplayer: Send level up event and sync state
        if (typeof Game !== 'undefined' && Game.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager) {
            if (multiplayerManager.isHost) {
                // Send level up event to all clients so they can show the animation
                multiplayerManager.send({
                    type: 'player_leveled_up',
                    data: {
                        playerId: this.playerId,
                        level: this.level,
                        timestamp: Date.now()
                    }
                });
                // Also sync game state
                multiplayerManager.sendGameState();
            } else {
                multiplayerManager.sendPlayerState();
            }
        }
        
        // Reset XP
        this.xp = 0;
        
        // Calculate new XP requirement
        this.xpToNext = Math.floor(100 * Math.pow(this.level, 1.5));
        
        // Create level up particles and screen effects
        if (typeof Game !== 'undefined') {
            this.triggerLevelUpEffects();
        }
        
        console.log(`Level Up! Now level ${this.level}`);
    }
    
    // Trigger level up visual effects (can be called by levelUp or by network event)
    triggerLevelUpEffects() {
        if (typeof Game === 'undefined') return;
        
        Game.triggerScreenShake(0.4, 0.3);
        
        // Show level up message
        Game.levelUpMessageActive = true;
        Game.levelUpMessageTime = 2.0; // Show for 2 seconds
        
        // Create celebratory particle burst
        if (typeof createParticleBurst !== 'undefined') {
            for (let i = 0; i < 3; i++) {
                const angle = Math.random() * Math.PI * 2;
                const offsetX = Math.cos(angle) * 50;
                const offsetY = Math.sin(angle) * 50;
                createParticleBurst(this.x + offsetX, this.y + offsetY, '#00ffff', 8);
            }
        }
    }
    
    // Calculate effective stats with gear bonuses
    updateEffectiveStats() {
        // Reset base stats to stored anchors before applying modifiers
        if (this.baseDamageBase !== undefined) {
            this.baseDamage = this.baseDamageBase;
        }
        if (this.baseMaxHpBase !== undefined) {
            this.baseMaxHp = this.baseMaxHpBase;
        }
        if (this.baseDefenseBase !== undefined) {
            this.baseDefense = this.baseDefenseBase;
        }
        
        // Reset affix-based stats to defaults
        this.critDamageMultiplier = 1.0;
        this.attackSpeedMultiplier = 1.0;
        this.lifesteal = 0;
        this.cooldownReduction = 0;
        this.aoeMultiplier = 1.0;
        this.projectileSpeedMultiplier = 1.0;
        this.knockbackMultiplier = 1.0;
        this.bonusDodgeCharges = 0;
        this.bonusMaxHealth = 0;
        this.pierceCount = 0;
        this.chainLightningCount = 0;
        this.executeBonus = 0;
        this.rampageBonus = 0;
        this.multishotCount = 0;
        this.phasingChance = 0;
        this.explosiveChance = 0;
        this.fortifyPercent = 0;
        this.overchargeChance = 0;
        // Mage beam-specific affixes
        this.bonusBeamCharges = 0;
        this.beamTickRateMultiplier = 1.0;
        this.beamDurationMultiplier = 1.0;
        this.bonusBeamPenetration = 0;
        this.damageMultiplier = 1.0;
        this.defenseMultiplier = 1.0;
        this.healthMultiplier = 1.0;
        
        // Reset crit chance to base class value stored during construction
        this.critChance = this.baseCritChance || 0;
        
        let weaponFlatDamage = 0; // Changed to flat bonus
        let armorFlatDefense = 0; // Changed to flat bonus
        let speedBonus = 1;
        
        // Process weapon affixes
        if (this.weapon) {
            if (this.weapon.affixes) {
                this.weapon.affixes.forEach(affix => {
                    this.applyAffix(affix, 'speedBonus', () => {
                        speedBonus *= (1 + affix.value);
                    });
                });
            }
            if (this.weapon.stats && this.weapon.stats.damage !== undefined) {
                weaponFlatDamage = this.weapon.stats.damage; // Flat value now
            }
        }
        
        // Process armor affixes
        if (this.armor) {
            if (this.armor.affixes) {
                this.armor.affixes.forEach(affix => {
                    this.applyAffix(affix, 'speedBonus', () => {
                        speedBonus *= (1 + affix.value);
                    });
                });
            }
            if (this.armor.stats && this.armor.stats.defense !== undefined) {
                armorFlatDefense = this.armor.stats.defense; // Flat value now
            }
        }
        
        // Process accessory affixes
        if (this.accessory) {
            if (this.accessory.affixes) {
                this.accessory.affixes.forEach(affix => {
                    this.applyAffix(affix, 'speedBonus', () => {
                        speedBonus *= (1 + affix.value);
                    });
                });
            }
            if (this.accessory.stats && this.accessory.stats.speed !== undefined) {
                speedBonus = 1 + this.accessory.stats.speed;
            }
        }
        
        // Apply weapon type effects
        if (this.weapon && this.weapon.weaponType) {
            const type = WEAPON_TYPES[this.weapon.weaponType];
            if (type) {
                this.weaponCooldownMultiplier = type.cooldownMultiplier || 1.0;
                if (type.movementSpeedBonus) {
                    speedBonus *= (1 + type.movementSpeedBonus);
                }
                if (type.critBonus) {
                    this.critChance = (this.critChance || 0) + type.critBonus;
                }
                // Store for use in attack creation
                this.weaponRangeMultiplier = type.rangeMultiplier || 1.0;
                this.weaponHitCount = type.hitCount || 1;
                this.weaponKnockbackBonus = type.knockbackBonus || 0;
                this.weaponStunChance = type.stunChance || 0;
            }
        } else {
            // No weapon type, reset to defaults
            this.weaponCooldownMultiplier = 1.0;
            this.weaponRangeMultiplier = 1.0;
            this.weaponHitCount = 1;
            this.weaponKnockbackBonus = 0;
            this.weaponStunChance = 0;
        }
        
        // Apply armor type effects
        if (this.armor && this.armor.armorType) {
            const type = ARMOR_TYPES[this.armor.armorType];
            if (type) {
                if (type.movementSpeedBonus) {
                    speedBonus *= (1 + type.movementSpeedBonus);
                }
                if (type.movementSpeedPenalty) {
                    speedBonus *= (1 + type.movementSpeedPenalty);
                }
                if (type.healthBonus) {
                    this.bonusMaxHealth += this.baseMaxHp * type.healthBonus;
                }
                if (type.dodgeBonus) {
                    this.bonusDodgeCharges += type.dodgeBonus;
                }
                if (type.cooldownReduction) {
                    this.cooldownReduction = Math.min(0.75, this.cooldownReduction + type.cooldownReduction); // Cap at 75%
                }
                if (type.projectileSpeedBonus) {
                    this.projectileSpeedMultiplier += type.projectileSpeedBonus;
                }
                if (type.dodgeDamageReduction) {
                    this.dodgeDamageReduction = type.dodgeDamageReduction;
                }
                // Store flags
                this.hasInterruptImmunity = type.interruptImmune || false;
                this.hasKnockbackImmunity = type.knockbackImmune || false;
            }
        } else {
            // No armor type, reset to defaults
            this.hasInterruptImmunity = false;
            this.hasKnockbackImmunity = false;
            this.dodgeDamageReduction = 0;
        }
        
        // Apply legendary effects from all equipped gear
        this.activeLegendaryEffects = []; // Reset active legendary effects
        [this.weapon, this.armor, this.accessory].forEach(gear => {
            if (gear && gear.legendaryEffect) {
                this.applyLegendaryEffect(gear.legendaryEffect);
            }
        });
        
        // Apply class modifiers from all equipped gear
        [this.weapon, this.armor, this.accessory].forEach(gear => {
            if (gear && gear.classModifier) {
                this.applyClassModifier(gear.classModifier);
            }
        });
        
        // Calculate final stats
        // Damage and defense are now ADDITIVE (flat values from gear)
        const baseDamageWithMultiplier = this.baseDamage * this.damageMultiplier;
        const baseDefenseWithMultiplier = this.baseDefense * this.defenseMultiplier;
        const baseMaxHpWithMultiplier = this.baseMaxHp * this.healthMultiplier;
        
        this.damage = baseDamageWithMultiplier + weaponFlatDamage;
        this.defense = baseDefenseWithMultiplier + armorFlatDefense;
        this.moveSpeed = this.baseMoveSpeed * speedBonus;
        
        // Apply bonus health (clamping current HP if needed)
        const oldMaxHp = this.maxHp;
        this.maxHp = baseMaxHpWithMultiplier + this.bonusMaxHealth;
        if (this.hp > this.maxHp) this.hp = this.maxHp;
        
        // Apply bonus dodge charges (using baseDodgeCharges set by subclass constructor)
        const baseCharges = this.baseDodgeCharges || 1; // Default to 1 if not set
        this.maxDodgeCharges = Math.max(1, baseCharges + this.bonusDodgeCharges);
        // Resize cooldown array if needed
        while (this.dodgeChargeCooldowns.length < this.maxDodgeCharges) {
            this.dodgeChargeCooldowns.push(0);
        }
        while (this.dodgeChargeCooldowns.length > this.maxDodgeCharges) {
            this.dodgeChargeCooldowns.pop();
        }
        this.dodgeCharges = this.usesChargeBasedDodge() ? this.getReadyDodgeCharges() : (this.dodgeCooldown <= 0 ? 1 : 0);
    }

    // Store current base stats as anchors for future recalculations (used after config changes)
    syncBaseStatAnchors() {
        this.baseDamageBase = this.baseDamage;
        this.baseMaxHpBase = this.baseMaxHp;
        this.baseDefenseBase = this.baseDefense;
    }
    
    // Apply individual affix to player stats
    applyAffix(affix, contextVar, contextCallback) {
        switch(affix.type) {
            case 'critChance': 
                this.critChance = (this.critChance || 0) + affix.value; 
                break;
            case 'critDamage': 
                this.critDamageMultiplier += affix.value; 
                break;
            case 'attackSpeed': 
                this.attackSpeedMultiplier += affix.value; 
                break;
            case 'lifesteal': 
                this.lifesteal += affix.value; 
                break;
            case 'movementSpeed': 
                // Handle movementSpeed via callback
                if (contextCallback) contextCallback();
                break;
            case 'cooldownReduction': 
                this.cooldownReduction += affix.value; 
                break;
            case 'areaOfEffect': 
                this.aoeMultiplier += affix.value; 
                break;
            case 'projectileSpeed': 
                this.projectileSpeedMultiplier += affix.value; 
                break;
            case 'knockbackPower': 
                this.knockbackMultiplier += affix.value; 
                break;
            case 'dodgeCharges': 
                this.bonusDodgeCharges += Math.floor(affix.value); 
                break;
            case 'maxHealth': 
                this.bonusMaxHealth += affix.value; 
                break;
            case 'pierce':
                this.pierceCount += Math.floor(affix.value);
                break;
            case 'chainLightning':
                this.chainLightningCount += Math.floor(affix.value);
                break;
            case 'execute':
                this.executeBonus += affix.value;
                break;
            case 'rampage':
                this.rampageBonus += affix.value;
                break;
            case 'multishot':
                this.multishotCount += Math.floor(affix.value);
                break;
            case 'phasing':
                this.phasingChance += affix.value;
                break;
            case 'explosiveAttacks':
                this.explosiveChance += affix.value;
                break;
            case 'fortify':
                this.fortifyPercent += affix.value;
                break;
            case 'overcharge':
                this.overchargeChance += affix.value;
                break;
            case 'beamCharges':
                this.bonusBeamCharges += Math.floor(affix.value);
                break;
            case 'beamTickRate':
                // Reduction - subtract from multiplier (e.g., 0.25 = 25% faster = 0.75x multiplier)
                this.beamTickRateMultiplier -= affix.value;
                break;
            case 'beamDuration':
                // Increase - add to multiplier (e.g., 0.3 = 30% longer = 1.3x multiplier)
                this.beamDurationMultiplier += affix.value;
                break;
            case 'beamPenetration':
                this.bonusBeamPenetration += Math.floor(affix.value);
                break;
        }
    }
    
    // Apply class modifier to player stats
    applyClassModifier(modifier) {
        // Universal modifiers apply to all classes
        if (modifier.class === 'universal') {
            switch(modifier.type) {
                case 'heavy_cooldown':
                    this.heavyAttackCooldownTime = Math.max(0.1, this.heavyAttackCooldownTime + modifier.value);
                    break;
                case 'special_cooldown':
                    this.specialCooldownTime = Math.max(0.1, this.specialCooldownTime + modifier.value);
                    break;
                case 'dodge_cooldown':
                    this.dodgeCooldownTime = Math.max(0.1, this.dodgeCooldownTime + modifier.value);
                    break;
                case 'basic_damage':
                    this.damageMultiplier *= (1 + modifier.value);
                    break;
            }
        }
        // Class-specific modifiers handled in subclasses
    }
    
    // Apply legendary effect to player
    applyLegendaryEffect(effect) {
        switch(effect.type) {
            case 'vampiric':
                this.lifesteal += effect.lifesteal;
                break;
            case 'berserker_rage':
                this.damageMultiplier *= (1 + effect.damageBonus);
                this.defenseMultiplier *= Math.max(0, 1 + effect.defensePenalty);
                break;
            case 'glass_cannon':
                this.damageMultiplier *= (1 + effect.damageBonus);
                this.healthMultiplier *= Math.max(0.1, 1 + effect.healthPenalty);
                break;
            case 'phoenix_down':
                this.hasPhoenixDown = true;
                this.phoenixDownHealth = effect.reviveHealth;
                this.phoenixDownCharges = 1; // Start with 1 charge
                this.phoenixDownDamageThreshold = 1000; // Damage needed to recharge
                this.phoenixDownDamageProgress = 0; // Track damage toward next charge
                break;
            case 'thorns':
                this.thornsReflect = effect.reflectPercent;
                break;
            // Store combat effects for application during attacks
            case 'incendiary':
            case 'freezing':
            case 'chain_lightning':
            case 'time_dilation':
                this.activeLegendaryEffects.push(effect);
                break;
        }
    }
    
    // Equip gear
    equipGear(gear) {
        const oldGear = this[gear.slot];
        this[gear.slot] = gear;
        
        // Update effective stats
        this.updateEffectiveStats();
        
        // Update gear visuals
        this.updateGearVisuals();
        
        return oldGear;
    }
    
    // Apply pull force from boss/environmental hazard
    applyPullForce(sourceX, sourceY, strength, radius) {
        const dx = sourceX - this.x;
        const dy = sourceY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < radius && distance > 0) {
            // Inverse square law: stronger when closer
            const pullPower = strength * (1 - (distance / radius));
            const dirX = dx / distance;
            const dirY = dy / distance;
            
            this.pullForceVx += dirX * pullPower;
            this.pullForceVy += dirY * pullPower;
        }
    }
    
    // Process pull forces each frame (similar to knockback)
    processPullForces(deltaTime) {
        if (this.pullForceVx !== 0 || this.pullForceVy !== 0) {
            this.x += this.pullForceVx * deltaTime;
            this.y += this.pullForceVy * deltaTime;
            
            // Decay pull forces over time
            this.pullForceVx *= Math.pow(this.pullDecay, deltaTime);
            this.pullForceVy *= Math.pow(this.pullDecay, deltaTime);
            
            // Stop if very small
            if (Math.abs(this.pullForceVx) < 0.1) this.pullForceVx = 0;
            if (Math.abs(this.pullForceVy) < 0.1) this.pullForceVy = 0;
        }
    }
    
    // Apply immediate knockback impulse from enemy damage
    applyDamageKnockback(forceX, forceY) {
        // Higher resistance = less knockback received
        const resistance = Math.max(0.1, this.knockbackResistance || 1.0);
        const newVx = this.damageKnockbackVx + (forceX || 0) / resistance;
        const newVy = this.damageKnockbackVy + (forceY || 0) / resistance;
        
        // Clamp to maximum velocity to prevent extreme launches
        const maxVel = this.damageKnockbackMaxVelocity || 800;
        const currentSpeed = Math.sqrt(newVx * newVx + newVy * newVy);
        if (currentSpeed > maxVel) {
            const scale = maxVel / currentSpeed;
            this.damageKnockbackVx = newVx * scale;
            this.damageKnockbackVy = newVy * scale;
        } else {
            this.damageKnockbackVx = newVx;
            this.damageKnockbackVy = newVy;
        }
        
        // Reset timer when new knockback is applied
        this.damageKnockbackTimer = 0;
    }
    
    processDamageKnockback(deltaTime) {
        if (this.damageKnockbackVx !== 0 || this.damageKnockbackVy !== 0) {
            // Update timer
            this.damageKnockbackTimer += deltaTime;
            
            // Force stop if knockback has been active too long
            const maxDuration = this.damageKnockbackMaxDuration || 2.0;
            if (this.damageKnockbackTimer >= maxDuration) {
                this.damageKnockbackVx = 0;
                this.damageKnockbackVy = 0;
                this.damageKnockbackTimer = 0;
                return;
            }
            
            this.x += this.damageKnockbackVx * deltaTime;
            this.y += this.damageKnockbackVy * deltaTime;
            
            // Decay knockback over time (faster decay = quicker recovery)
            const decayFactor = Math.pow(this.damageKnockbackDecay, deltaTime);
            this.damageKnockbackVx *= decayFactor;
            this.damageKnockbackVy *= decayFactor;
            
            // Stop if knockback is below threshold (higher threshold prevents drift)
            const cutoffThreshold = 12.0; // Increased to reduce low-speed drift before stopping
            if (Math.abs(this.damageKnockbackVx) < cutoffThreshold) this.damageKnockbackVx = 0;
            if (Math.abs(this.damageKnockbackVy) < cutoffThreshold) this.damageKnockbackVy = 0;
            
            // Reset timer if knockback has stopped
            if (this.damageKnockbackVx === 0 && this.damageKnockbackVy === 0) {
                this.damageKnockbackTimer = 0;
            }
        } else {
            // Reset timer when no knockback is active
            this.damageKnockbackTimer = 0;
        }
    }
    
    // Get current stats as object
    getCurrentStats() {
        return {
            damage: this.damage,
            defense: this.defense,
            moveSpeed: this.moveSpeed,
            maxHp: this.maxHp,
            hp: this.hp
        };
    }
    
    // Get equipped gear by slot
    getEquippedGear(slot) {
        return this[slot];
    }
    
    // Helper to convert hex color to RGB
    hexToRgb(hex) {
        // Handle null/undefined
        if (!hex) return { r: 150, g: 150, b: 150 };
        
        // Remove # if present
        hex = hex.replace('#', '');
        
        // Parse hex string
        const r = parseInt(hex.substring(0, 2), 16) || 150;
        const g = parseInt(hex.substring(2, 4), 16) || 150;
        const b = parseInt(hex.substring(4, 6), 16) || 150;
        
        return { r, g, b };
    }
    
    static getBaseShapeVertices(shape, size) {
        switch (shape) {
            case 'triangle':
                return [
                    { x: size, y: 0 },
                    { x: -size * 0.5, y: -size * 0.8660254038 },
                    { x: -size * 0.5, y: size * 0.8660254038 }
                ];
            case 'hexagon': {
                const vertices = [];
                for (let i = 0; i < 6; i++) {
                    const angle = (Math.PI / 3) * i;
                    vertices.push({
                        x: Math.cos(angle) * size,
                        y: Math.sin(angle) * size
                    });
                }
                return vertices;
            }
            case 'pentagon': {
                const rotationOffset = 18 * Math.PI / 180;
                const vertices = [];
                for (let i = 0; i < 5; i++) {
                    const angle = (Math.PI * 2 / 5) * i - Math.PI / 2 + rotationOffset;
                    vertices.push({
                        x: Math.cos(angle) * size,
                        y: Math.sin(angle) * size
                    });
                }
                return vertices;
            }
            default:
                return [
                    { x: -size * 0.8, y: -size * 0.8 },
                    { x: size * 0.8, y: -size * 0.8 },
                    { x: size * 0.8, y: size * 0.8 },
                    { x: -size * 0.8, y: size * 0.8 }
                ];
        }
    }
    
    // Wave pattern generation functions - all designed to loop seamlessly at 2π
    // freq parameter represents number of complete cycles around the circle
    static generateSquareWave(angle, freq, phase) {
        // Square wave - creates freq complete on/off cycles
        const t = (freq * angle + phase) / (Math.PI * 2);
        const cycle = t - Math.floor(t); // 0 to 1 within each cycle
        return cycle < 0.5 ? 1 : -1;
    }
    
    static generateSawtoothWave(angle, freq, phase) {
        // Sawtooth - linear ramp that resets
        const t = (freq * angle + phase) / (Math.PI * 2);
        const cycle = t - Math.floor(t);
        return (cycle * 2) - 1; // -1 to 1
    }
    
    static generateTriangleWave(angle, freq, phase) {
        // Triangle - goes up then down linearly
        const t = (freq * angle + phase) / (Math.PI * 2);
        const cycle = t - Math.floor(t);
        return cycle < 0.5 ? (cycle * 4 - 1) : (3 - cycle * 4);
    }
    
    static generateDigitalWave(angle, freq, phase) {
        // Digital - quantized steps
        const t = (freq * angle + phase) / (Math.PI * 2);
        const cycle = t - Math.floor(t);
        return Math.floor(cycle * 4) / 2 - 1; // 4 steps: -1, -0.5, 0, 0.5
    }
    
    static generatePulseWave(angle, freq, phase) {
        // Pulse - sharp spikes at regular intervals
        const t = (freq * angle + phase) / (Math.PI * 2);
        const cycle = t - Math.floor(t);
        return (cycle > 0.15 && cycle < 0.25) ? 1 : 
               (cycle > 0.65 && cycle < 0.75) ? -1 : 0;
    }
    
    static generateSteppedWave(angle, freq, phase) {
        // Stepped - staircase pattern
        const t = (freq * angle + phase) / (Math.PI * 2);
        const cycle = t - Math.floor(t);
        return Math.floor(cycle * 6) / 3 - 1; // 6 steps
    }
    
    static generateRadialWave(angle, freq, phase) {
        // Radial - smooth sine wave (always works because sin is periodic)
        return Math.abs(Math.sin(freq * angle + phase));
    }
    
    static generateLinearWave(angle, freq, phase) {
        // Linear ramp (same as sawtooth but more aggressive)
        const t = (freq * angle + phase) / (Math.PI * 2);
        const cycle = t - Math.floor(t);
        return (cycle * 2) - 1;
    }
    
    static generateShockwave(angle, freq, phase) {
        // Shockwave - exponential burst that decays
        const t = (freq * angle + phase) / (Math.PI * 2);
        const cycle = t - Math.floor(t);
        return cycle < 0.35 ? Math.pow(1 - cycle / 0.35, 2) : 0;
    }
    
    static generatePhaseWave(angle, freq, phase) {
        // Phase - combination of two sine waves (always periodic)
        return Math.sin(freq * angle + phase) * 0.5 + Math.cos(freq * angle * 2 + phase) * 0.5;
    }
    
    static getWaveValue(waveType, angle, freq, phase) {
        switch(waveType) {
            case 'square': return PlayerBase.generateSquareWave(angle, freq, phase);
            case 'sawtooth': return PlayerBase.generateSawtoothWave(angle, freq, phase);
            case 'triangle': return PlayerBase.generateTriangleWave(angle, freq, phase);
            case 'digital': return PlayerBase.generateDigitalWave(angle, freq, phase);
            case 'pulse': return PlayerBase.generatePulseWave(angle, freq, phase);
            case 'stepped': return PlayerBase.generateSteppedWave(angle, freq, phase);
            case 'radial': return PlayerBase.generateRadialWave(angle, freq, phase);
            case 'linear': return PlayerBase.generateLinearWave(angle, freq, phase);
            case 'shockwave': return PlayerBase.generateShockwave(angle, freq, phase);
            case 'phase': return PlayerBase.generatePhaseWave(angle, freq, phase);
            default: return Math.sin(freq * angle + phase); // Fallback to sine
        }
    }
    
    // Render affix-specific shape
    static renderAffixShape(ctx, x, y, size, shapeType, color, alpha) {
        // Clamp size to minimum
        size = Math.max(5, size || 10);
        
        // Validate color and alpha
        if (!color || typeof color.r === 'undefined') {
            color = { r: 150, g: 150, b: 150 };
        }
        alpha = isNaN(alpha) ? 0.8 : Math.max(0, Math.min(1, alpha));
        
        ctx.save();
        ctx.translate(x, y);
        ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
        ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${Math.min(1, alpha + 0.2)})`;
        ctx.lineWidth = 2;
        
        switch(shapeType) {
            case 'triangle':
                ctx.beginPath();
                ctx.moveTo(size, 0);
                ctx.lineTo(-size * 0.5, -size * 0.866);
                ctx.lineTo(-size * 0.5, size * 0.866);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                break;
                
            case 'star':
                ctx.beginPath();
                for (let i = 0; i < 10; i++) {
                    const radius = (i % 2 === 0) ? size : size * 0.4;
                    const angle = (i * Math.PI / 5) - Math.PI / 2;
                    const px = Math.cos(angle) * radius;
                    const py = Math.sin(angle) * radius;
                    if (i === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                }
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                break;
                
            case 'zigzag':
                ctx.beginPath();
                ctx.moveTo(-size, -size * 0.5);
                ctx.lineTo(-size * 0.3, size * 0.5);
                ctx.lineTo(size * 0.3, -size * 0.5);
                ctx.lineTo(size, size * 0.5);
                ctx.lineWidth = 3;
                ctx.stroke();
                break;
                
            case 'cross':
            case 'plus':
                ctx.beginPath();
                ctx.moveTo(0, -size);
                ctx.lineTo(0, size);
                ctx.moveTo(-size, 0);
                ctx.lineTo(size, 0);
                ctx.lineWidth = 3;
                ctx.stroke();
                break;
                
            case 'wave':
                ctx.beginPath();
                for (let i = 0; i <= 20; i++) {
                    const t = i / 20;
                    const px = (t - 0.5) * size * 2;
                    const py = Math.sin(t * Math.PI * 2) * size * 0.5;
                    if (i === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                }
                ctx.lineWidth = 3;
                ctx.stroke();
                break;
                
            case 'hexagon':
                ctx.beginPath();
                for (let i = 0; i < 6; i++) {
                    const angle = (Math.PI / 3) * i;
                    const px = Math.cos(angle) * size;
                    const py = Math.sin(angle) * size;
                    if (i === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                }
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                break;
                
            case 'circle':
                ctx.beginPath();
                ctx.arc(0, 0, size, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                break;
                
            case 'chevron':
                ctx.beginPath();
                ctx.moveTo(-size, size * 0.5);
                ctx.lineTo(0, -size * 0.5);
                ctx.lineTo(size, size * 0.5);
                ctx.lineWidth = 3;
                ctx.stroke();
                break;
                
            case 'burst':
                for (let i = 0; i < 8; i++) {
                    const angle = (i * Math.PI / 4);
                    ctx.beginPath();
                    ctx.moveTo(0, 0);
                    ctx.lineTo(Math.cos(angle) * size, Math.sin(angle) * size);
                    ctx.lineWidth = 2;
                    ctx.stroke();
                }
                break;
                
            case 'diamond':
                ctx.beginPath();
                ctx.moveTo(0, -size);
                ctx.lineTo(size, 0);
                ctx.lineTo(0, size);
                ctx.lineTo(-size, 0);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                break;
                
            case 'arrow':
                ctx.beginPath();
                ctx.moveTo(size, 0);
                ctx.lineTo(-size * 0.5, -size * 0.7);
                ctx.lineTo(-size * 0.3, 0);
                ctx.lineTo(-size * 0.5, size * 0.7);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                break;
                
            case 'fork':
                // Branching zigzag for chain lightning
                ctx.beginPath();
                ctx.moveTo(-size, 0);
                ctx.lineTo(-size * 0.3, -size * 0.5);
                ctx.lineTo(size * 0.3, size * 0.5);
                ctx.lineTo(size, 0);
                // Branch 1
                ctx.moveTo(size * 0.3, size * 0.5);
                ctx.lineTo(size * 0.8, size);
                // Branch 2
                ctx.moveTo(size * 0.3, size * 0.5);
                ctx.lineTo(size * 0.8, size * 0.2);
                ctx.lineWidth = 3;
                ctx.stroke();
                break;
                
            case 'skull':
                // X mark for execute
                ctx.beginPath();
                ctx.moveTo(-size, -size);
                ctx.lineTo(size, size);
                ctx.moveTo(size, -size);
                ctx.lineTo(-size, size);
                ctx.lineWidth = 3;
                ctx.stroke();
                break;
                
            case 'stairs':
                // Ascending steps for rampage
                ctx.beginPath();
                for (let i = 0; i < 4; i++) {
                    const x = -size + (i * size / 2);
                    const y = size - (i * size / 2);
                    ctx.rect(x, y, size / 2, size / 2);
                }
                ctx.fill();
                ctx.stroke();
                break;
                
            case 'splitarrow':
                // Diverging arrows for multishot
                ctx.beginPath();
                // Center arrow
                ctx.moveTo(0, -size);
                ctx.lineTo(0, size);
                // Left arrow
                ctx.moveTo(-size * 0.7, -size * 0.5);
                ctx.lineTo(-size * 0.7, size * 0.5);
                // Right arrow
                ctx.moveTo(size * 0.7, -size * 0.5);
                ctx.lineTo(size * 0.7, size * 0.5);
                ctx.lineWidth = 2;
                ctx.stroke();
                break;
                
            case 'ghost':
                // Wavy ethereal form for phasing
                ctx.beginPath();
                for (let i = 0; i <= 20; i++) {
                    const angle = (i / 20) * Math.PI * 2;
                    const r = size * (0.8 + Math.sin(i * 3) * 0.2);
                    const px = Math.cos(angle) * r;
                    const py = Math.sin(angle) * r;
                    if (i === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                }
                ctx.closePath();
                ctx.globalAlpha = alpha * 0.6;
                ctx.fill();
                ctx.stroke();
                ctx.globalAlpha = 1.0;
                break;
                
            case 'explosion':
                // Starburst for explosive attacks
                for (let i = 0; i < 12; i++) {
                    const angle = (i * Math.PI / 6);
                    const innerR = size * 0.3;
                    const outerR = size;
                    ctx.beginPath();
                    ctx.moveTo(Math.cos(angle) * innerR, Math.sin(angle) * innerR);
                    ctx.lineTo(Math.cos(angle) * outerR, Math.sin(angle) * outerR);
                    ctx.lineWidth = 2;
                    ctx.stroke();
                }
                break;
                
            case 'shield':
                // Pentagon shield for fortify
                ctx.beginPath();
                for (let i = 0; i < 5; i++) {
                    const angle = (Math.PI * 2 / 5) * i - Math.PI / 2;
                    const px = Math.cos(angle) * size;
                    const py = Math.sin(angle) * size;
                    if (i === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                }
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                break;
                
            case 'lightning':
                // Lightning bolt for overcharge
                ctx.beginPath();
                ctx.moveTo(size * 0.2, -size);
                ctx.lineTo(-size * 0.2, -size * 0.2);
                ctx.lineTo(size * 0.4, -size * 0.1);
                ctx.lineTo(-size * 0.3, size * 0.5);
                ctx.lineTo(size * 0.1, size * 0.3);
                ctx.lineTo(-size * 0.4, size);
                ctx.lineWidth = 2;
                ctx.stroke();
                break;
                
            default: // Fallback to circle
                ctx.beginPath();
                ctx.arc(0, 0, size, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                break;
        }
        
        ctx.restore();
    }
    
    // Affix synergy detection - groups that work well together
    static getAffixSynergies() {
        return {
            offensive: ['critChance', 'critDamage', 'attackSpeed', 'pierce', 'chainLightning', 'execute', 'rampage', 'multishot', 'explosiveAttacks'],
            defensive: ['maxHealth', 'lifesteal', 'dodgeCharges', 'phasing', 'fortify'],
            mobility: ['movementSpeed', 'dodgeCharges', 'phasing'],
            utility: ['cooldownReduction', 'projectileSpeed', 'areaOfEffect', 'overcharge'],
            impact: ['knockbackPower', 'areaOfEffect', 'pierce', 'explosiveAttacks']
        };
    }
    
    // Determine which synergy group an affix belongs to
    static getAffixSynergyGroup(affixType) {
        const synergies = PlayerBase.getAffixSynergies();
        for (const [group, affixes] of Object.entries(synergies)) {
            if (affixes.includes(affixType)) {
                return group;
            }
        }
        return 'misc'; // No specific group
    }
    
    // Calculate visual pattern for a single gear piece using multi-wave interference
    calculateGearPieceVisual(gearPiece) {
        if (!gearPiece) return null;
        
        const waves = [];
        let baseColor = { r: 150, g: 150, b: 150 }; // Default gray
        
        // Assign wave parameters based on stat type (deterministic based on type and value)
        const statTypeMap = {
            damage: { freq: 3.0, colorChannel: 'r', baseColor: { r: 255, g: 100, b: 100 } },
            defense: { freq: 1.5, colorChannel: 'b', baseColor: { r: 100, g: 150, b: 255 } },
            speed: { freq: 4.5, colorChannel: 'g', baseColor: { r: 150, g: 255, b: 100 } }
        };
        
        const affixTypeMap = {
            critChance: { 
                freq: 5.0, 
                shape: 'triangle', 
                waveType: 'square',
                modR: 255, modG: 50, modB: 50 
            },
            critDamage: { 
                freq: 4.0, 
                shape: 'star', 
                waveType: 'sawtooth',
                modR: 255, modG: 0, modB: 100 
            },
            attackSpeed: { 
                freq: 6.0, 
                shape: 'zigzag', 
                waveType: 'digital',
                modR: 255, modG: 255, modB: 0 
            },
            lifesteal: { 
                freq: 2.5, 
                shape: 'cross', 
                waveType: 'pulse',
                modR: 200, modG: 0, modB: 0 
            },
            movementSpeed: { 
                freq: 5.5, 
                shape: 'wave', 
                waveType: 'triangle',
                modR: 0, modG: 255, modB: 255 
            },
            cooldownReduction: { 
                freq: 3.5, 
                shape: 'hexagon', 
                waveType: 'stepped',
                modR: 100, modG: 100, modB: 255 
            },
            areaOfEffect: { 
                freq: 2.0, 
                shape: 'circle', 
                waveType: 'radial',
                modR: 255, modG: 150, modB: 0 
            },
            projectileSpeed: { 
                freq: 7.0, 
                shape: 'chevron', 
                waveType: 'linear',
                modR: 100, modG: 255, modB: 100 
            },
            knockbackPower: { 
                freq: 3.0, 
                shape: 'burst', 
                waveType: 'shockwave',
                modR: 200, modG: 0, modB: 255 
            },
            dodgeCharges: { 
                freq: 4.0, 
                shape: 'diamond', 
                waveType: 'phase',
                modR: 255, modG: 255, modB: 255 
            },
            maxHealth: { 
                freq: 1.8, 
                shape: 'plus', 
                waveType: 'pulse',
                modR: 0, modG: 255, modB: 0 
            },
            pierce: { 
                freq: 3.0, 
                shape: 'arrow', 
                waveType: 'linear',
                modR: 100, modG: 255, modB: 255 
            },
            chainLightning: { 
                freq: 4.0, 
                shape: 'fork', 
                waveType: 'digital',
                modR: 150, modG: 200, modB: 255 
            },
            execute: { 
                freq: 2.0, 
                shape: 'skull', 
                waveType: 'pulse',
                modR: 255, modG: 50, modB: 50 
            },
            rampage: { 
                freq: 3.0, 
                shape: 'stairs', 
                waveType: 'sawtooth',
                modR: 255, modG: 100, modB: 0 
            },
            multishot: { 
                freq: 3.0, 
                shape: 'splitarrow', 
                waveType: 'triangle',
                modR: 200, modG: 255, modB: 100 
            },
            phasing: { 
                freq: 4.0, 
                shape: 'ghost', 
                waveType: 'phase',
                modR: 200, modG: 200, modB: 255 
            },
            explosiveAttacks: { 
                freq: 2.0, 
                shape: 'explosion', 
                waveType: 'radial',
                modR: 255, modG: 200, modB: 0 
            },
            fortify: { 
                freq: 2.0, 
                shape: 'shield', 
                waveType: 'stepped',
                modR: 150, modG: 150, modB: 255 
            },
            overcharge: { 
                freq: 4.0, 
                shape: 'lightning', 
                waveType: 'digital',
                modR: 255, modG: 255, modB: 150 
            },
            beamCharges: {
                freq: 3.5,
                shape: 'charge',
                waveType: 'pulse',
                modR: 150, modG: 100, modB: 255
            },
            beamTickRate: {
                freq: 6.0,
                shape: 'pulse',
                waveType: 'digital',
                modR: 255, modG: 150, modB: 200
            },
            beamDuration: {
                freq: 2.5,
                shape: 'extend',
                waveType: 'linear',
                modR: 200, modG: 100, modB: 255
            },
            beamPenetration: {
                freq: 3.0,
                shape: 'penetrate',
                waveType: 'linear',
                modR: 100, modG: 200, modB: 255
            }
        };
        
        // Add waves from base stats
        if (gearPiece.stats) {
            for (const [statType, statValue] of Object.entries(gearPiece.stats)) {
                if (statTypeMap[statType] && statValue > 0) {
                    const config = statTypeMap[statType];
                    // Normalize value: damage 0-50, defense 0-0.5, speed 0-0.3
                    let normalizedValue = statType === 'damage' ? statValue / 50 : 
                                        statType === 'defense' ? statValue / 0.5 :
                                        statValue / 0.3;
                    normalizedValue = Math.min(1, normalizedValue);
                    
                    waves.push({
                        frequency: config.freq,
                        phase: normalizedValue * Math.PI * 2,
                        amplitude: 0.3 + normalizedValue * 0.4
                    });
                    
                    // Blend base color
                    baseColor.r = (baseColor.r + config.baseColor.r) / 2;
                    baseColor.g = (baseColor.g + config.baseColor.g) / 2;
                    baseColor.b = (baseColor.b + config.baseColor.b) / 2;
                }
            }
        }
        
        // Store affix visual metadata and group by synergy
        const affixVisuals = [];
        const synergyGroups = {}; // Group affixes by synergy
        
        if (gearPiece.affixes && gearPiece.affixes.length > 0) {
            gearPiece.affixes.forEach((affix, index) => {
                if (affixTypeMap[affix.type]) {
                    const config = affixTypeMap[affix.type];
                    // Normalize affix value (most are 0-0.5 range)
                    const normalizedValue = Math.min(1, affix.value / 0.5);
                    
                    // Limit frequencies to 1-4 for smooth, non-epileptic patterns
                    const safeFreq = Math.max(1, Math.min(4, Math.round(config.freq)));
                    
                    const waveData = {
                        frequency: safeFreq,
                        phase: normalizedValue * Math.PI * 2,
                        amplitude: 0.25 + normalizedValue * 0.25, // Reduced amplitude
                        waveType: config.waveType || 'sine',
                        affixType: affix.type
                    };
                    
                    waves.push(waveData);
                    
                    // Determine synergy group
                    const synergyGroup = PlayerBase.getAffixSynergyGroup(affix.type);
                    if (!synergyGroups[synergyGroup]) {
                        synergyGroups[synergyGroup] = [];
                    }
                    synergyGroups[synergyGroup].push({
                        type: affix.type,
                        shape: config.shape || 'circle',
                        waveType: config.waveType || 'sine',
                        color: { r: config.modR, g: config.modG, b: config.modB },
                        value: normalizedValue,
                        wave: waveData
                    });
                    
                    // Store affix visual data
                    affixVisuals.push({
                        type: affix.type,
                        shape: config.shape || 'circle',
                        waveType: config.waveType || 'sine',
                        color: { r: config.modR, g: config.modG, b: config.modB },
                        value: normalizedValue,
                        synergyGroup: synergyGroup
                    });
                    
                    // Blend color contributions
                    baseColor.r = (baseColor.r + config.modR) / 2;
                    baseColor.g = (baseColor.g + config.modG) / 2;
                    baseColor.b = (baseColor.b + config.modB) / 2;
                }
            });
        }
        
        // Get tier-based complexity settings
        const tierSettings = {
            gray: { opacity: 0.5, layers: 1, glow: 0 },
            green: { opacity: 0.7, layers: 1, glow: 5 },
            blue: { opacity: 0.9, layers: 2, glow: 10 },
            purple: { opacity: 1.0, layers: 3, glow: 15 },
            orange: { opacity: 1.0, layers: 4, glow: 25 }
        };
        
        const tier = gearPiece.tier || 'gray';
        const tierConfig = tierSettings[tier] || tierSettings.gray;
        
        return {
            waves: waves,
            baseColor: baseColor,
            tierColor: gearPiece.color || '#999999',
            intensity: waves.length > 0 ? Math.min(1, waves.length * 0.15) : 0.3,
            affixVisuals: affixVisuals,
            synergyGroups: synergyGroups, // Grouped affixes
            tier: tier,
            tierOpacity: tierConfig.opacity,
            tierLayers: tierConfig.layers,
            tierGlow: tierConfig.glow,
            hasLegendary: !!gearPiece.legendaryEffect
        };
    }
    
    // Update gear visuals when gear changes
    updateGearVisuals() {
        this.weaponVisual = this.calculateGearPieceVisual(this.weapon);
        this.armorVisual = this.calculateGearPieceVisual(this.armor);
        this.accessoryVisual = this.calculateGearPieceVisual(this.accessory);
    }
    
    render(ctx) {
        // Draw attack hitboxes first (behind player)
        // Note: Class-specific hitbox types (like hammer) are rendered by renderClassVisuals
        this.attackHitboxes.forEach(hitbox => {
            // Skip class-specific hitbox types - they're rendered by subclasses
            if (hitbox.type === 'hammer') {
                return; // Tank class will render this
            }
            
            const hasHitEnemies = hitbox.hitEnemies && hitbox.hitEnemies.size > 0;
            
            if (hitbox.heavy) {
                // Heavy attack
                ctx.fillStyle = hasHitEnemies ? 'rgba(100, 255, 100, 0.4)' : 'rgba(255, 100, 0, 0.4)';
                ctx.beginPath();
                ctx.arc(hitbox.x, hitbox.y, hitbox.radius, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.strokeStyle = hasHitEnemies ? 'rgba(0, 255, 0, 0.9)' : 'rgba(255, 50, 0, 0.9)';
                ctx.lineWidth = 3;
                ctx.stroke();
            } else {
                // Basic attack
                ctx.fillStyle = hasHitEnemies ? 'rgba(100, 255, 100, 0.4)' : 'rgba(255, 255, 255, 0.3)';
                ctx.beginPath();
                ctx.arc(hitbox.x, hitbox.y, hitbox.radius, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.strokeStyle = hasHitEnemies ? 'rgba(0, 255, 0, 0.9)' : 'rgba(255, 255, 255, 0.8)';
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        });
        
        const dashEffectActive = !!this.dashAnimActive;
        
        ctx.save();
        
        if (this.isDodging) {
            ctx.globalAlpha = 0.5;
        }
        
        let scale = 1.0;
        if (this.isChargingHeavy) {
            scale = 1.0 + (this.heavyChargeElapsed / this.heavyAttackWindup) * 0.3;
        }
        
        const time = Date.now() * 0.0003;
        
        // Collect all synergy groups from all equipped gear
        const allSynergyGroups = {};
        const gearPieces = [this.weaponVisual, this.armorVisual, this.accessoryVisual].filter(v => v);
        
        gearPieces.forEach(visual => {
            if (visual && visual.synergyGroups) {
                Object.entries(visual.synergyGroups).forEach(([group, affixes]) => {
                    if (!allSynergyGroups[group]) {
                        allSynergyGroups[group] = [];
                    }
                    allSynergyGroups[group].push(...affixes);
                });
            }
        });
        
        // Render rings based on synergy groups
        const synergyGroupNames = Object.keys(allSynergyGroups);
        const numRings = synergyGroupNames.length;
        
        if (numRings > 0) {
            // Apply glow based on highest tier
            const maxTierGlow = Math.max(...gearPieces.map(v => v ? v.tierGlow : 0));
            if (maxTierGlow > 0) {
                const maxTierColor = gearPieces.find(v => v && v.tierGlow === maxTierGlow)?.tierColor;
                ctx.shadowBlur = maxTierGlow * 0.7;
                ctx.shadowColor = maxTierColor || '#999999';
            }
            
            // Render each synergy group as a ring
            synergyGroupNames.forEach((groupName, groupIndex) => {
                const affixesInGroup = allSynergyGroups[groupName];
                
                // Calculate ring radius with proper spacing (8px between rings)
                const baseRadius = this.size + 8 + (groupIndex * 8);
                const numPoints = 64;
                
                // Calculate average color for this synergy group
                let avgR = 0, avgG = 0, avgB = 0;
                affixesInGroup.forEach(affix => {
                    avgR += affix.color.r;
                    avgG += affix.color.g;
                    avgB += affix.color.b;
                });
                avgR = Math.floor(avgR / affixesInGroup.length);
                avgG = Math.floor(avgG / affixesInGroup.length);
                avgB = Math.floor(avgB / affixesInGroup.length);
                
                // Draw wave-deformed ring using constructive interference
                ctx.beginPath();
                for (let i = 0; i <= numPoints; i++) {
                    const angle = (i / numPoints) * Math.PI * 2;
                    
                    // PROPER WAVE ADDITION: Sum all waves in this group
                    let totalOffset = 0;
                    affixesInGroup.forEach(affix => {
                        const wave = affix.wave;
                        const smoothPhase = wave.phase + (time * (0.5 + groupIndex * 0.15));
                        
                        const waveValue = PlayerBase.getWaveValue(
                            wave.waveType,
                            angle,
                            wave.frequency,
                            smoothPhase
                        );
                        
                        // Add waves (constructive/destructive interference)
                        totalOffset += waveValue * wave.amplitude * 6; // Reduced amplitude
                    });
                    
                    const radius = baseRadius + totalOffset;
                    const px = this.x + Math.cos(angle) * radius;
                    const py = this.y + Math.sin(angle) * radius;
                    
                    if (i === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                }
                ctx.closePath();
                
                // Get max tier opacity from this group's affixes
                const maxOpacity = Math.max(...gearPieces.map(v => v ? v.tierOpacity : 0.5));
                const maxLayers = Math.max(...gearPieces.map(v => v ? v.tierLayers : 1));
                
                // Stroke the ring
                ctx.strokeStyle = `rgba(${avgR}, ${avgG}, ${avgB}, ${maxOpacity * 0.85})`;
                ctx.lineWidth = 2 + maxLayers * 0.5;
                ctx.stroke();
            });
            
            ctx.shadowBlur = 0;
        }
        
        // Legendary effects rendering (independent of ring system)
        const hasLegendary = gearPieces.some(v => v && v.hasLegendary);
        if (hasLegendary) {
            // Pulsing legendary aura
            const legendaryPulse = Math.sin(time * 3) * 0.5 + 0.5;
            const maxRadius = this.size + 8 + (numRings * 8);
            const legendaryRadius = maxRadius + 4 + legendaryPulse * 4;
            ctx.strokeStyle = `rgba(255, 200, 0, ${0.5 * legendaryPulse})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(this.x, this.y, legendaryRadius, 0, Math.PI * 2);
            ctx.stroke();
            
            // Sparkles
            for (let i = 0; i < 4; i++) {
                const sparkleAngle = time * 4 + (i * Math.PI * 0.5);
                const sparkleRadius = legendaryRadius + Math.sin(time * 5 + i) * 3;
                const sx = this.x + Math.cos(sparkleAngle) * sparkleRadius;
                const sy = this.y + Math.sin(sparkleAngle) * sparkleRadius;
                const sparkleAlpha = (Math.sin(time * 6 + i) * 0.5 + 0.5) * 0.7;
                
                ctx.fillStyle = `rgba(255, 255, 100, ${sparkleAlpha})`;
                ctx.beginPath();
                ctx.arc(sx, sy, 2, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        
        // Legacy rendering for gear without affixes
        if (this.armorVisual && (!allSynergyGroups || Object.keys(allSynergyGroups).length === 0)) {
            const visual = this.armorVisual;
            
            // Apply tier-based glow effect
            if (visual.tierGlow > 0) {
                ctx.shadowBlur = visual.tierGlow;
                ctx.shadowColor = visual.tierColor;
            }
            
            // Calculate base color once (for use in layers and legendary effect)
            let baseR = 150, baseG = 150, baseB = 150;
            if (visual.affixVisuals && visual.affixVisuals.length > 0) {
                let r = 0, g = 0, b = 0;
                visual.affixVisuals.forEach(affix => {
                    r += affix.color.r;
                    g += affix.color.g;
                    b += affix.color.b;
                });
                baseR = Math.floor(r / visual.affixVisuals.length);
                baseG = Math.floor(g / visual.affixVisuals.length);
                baseB = Math.floor(b / visual.affixVisuals.length);
            } else {
                const rgb = this.hexToRgb(visual.tierColor);
                baseR = rgb.r;
                baseG = rgb.g;
                baseB = rgb.b;
            }
            
            // Draw single wave-deformed ring (simplified from multiple layers)
            const baseRadius = this.size + 10;
            const numPoints = 64; // High resolution for smooth waves
            
            ctx.beginPath();
            for (let i = 0; i <= numPoints; i++) {
                const angle = (i / numPoints) * Math.PI * 2;
                
                // Combine wave patterns - but limit to avoid messiness
                let totalOffset = 0;
                
                if (visual.waves && visual.waves.length > 0) {
                    // Use up to 3 most prominent waves
                    const wavesToUse = Math.min(3, visual.waves.length);
                    for (let w = 0; w < wavesToUse; w++) {
                        const wave = visual.waves[w];
                        // Smooth time-based phase shift (slow oscillation)
                        const smoothPhase = wave.phase + (time * (0.5 + w * 0.2));
                        
                        const waveValue = PlayerBase.getWaveValue(
                            wave.waveType, 
                            angle, 
                            wave.frequency,
                            smoothPhase
                        );
                        // Stronger amplitude for more visibility
                        totalOffset += waveValue * wave.amplitude * 12;
                    }
                }
                
                const radius = baseRadius + totalOffset;
                const px = this.x + Math.cos(angle) * radius;
                const py = this.y + Math.sin(angle) * radius;
                
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
                
            // Stroke with tier-based thickness
            ctx.strokeStyle = `rgba(${baseR}, ${baseG}, ${baseB}, ${visual.tierOpacity})`;
            ctx.lineWidth = 2 + visual.tierLayers;
            ctx.stroke();
            
            // Add inner glow for higher tiers
            if (visual.tierLayers >= 2) {
                ctx.strokeStyle = `rgba(${baseR}, ${baseG}, ${baseB}, ${visual.tierOpacity * 0.3})`;
                ctx.lineWidth = 4 + visual.tierLayers * 2;
                ctx.stroke();
            }
            
            // Legendary aura - extra pulsing ring
            if (visual.hasLegendary) {
                const legendaryPulse = Math.sin(time * 3) * 0.5 + 0.5;
                const legendaryRadius = this.size + 15 + legendaryPulse * 5;
                ctx.strokeStyle = `rgba(255, 200, 0, ${0.6 * legendaryPulse})`;
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(this.x, this.y, legendaryRadius, 0, Math.PI * 2);
                ctx.stroke();
            }
            
            ctx.shadowBlur = 0;
        }
        
        const shape = this.shape || 'square';
        const baseVertices = PlayerBase.getBaseShapeVertices(shape, this.size);
        let minForward = Infinity;
        let maxForward = -Infinity;
        baseVertices.forEach(v => {
            if (v.x < minForward) minForward = v.x;
            if (v.x > maxForward) maxForward = v.x;
        });
        if (!isFinite(minForward)) minForward = -this.size;
        if (!isFinite(maxForward)) maxForward = this.size;
        const span = Math.max(maxForward - minForward, 0.0001);
        
        const travelPhase = dashEffectActive ? (this.dashAnimTravelPhase || 0) : 0;
        const relaxPhase = dashEffectActive ? (this.dashAnimRelaxPhase || 0) : 0;
        const tailLockPortion = dashEffectActive ? Math.max(0, Math.min(0.8, 0.45 - travelPhase * 0.35)) : 0;
        const curveShear = this.dashAnimCurveAmount * 0.6;
        
        const transformedVertices = [];
        let deformedMin = Infinity;
        let deformedMax = -Infinity;
        baseVertices.forEach(v => {
            const normalized = (v.x - minForward) / span;
            let influence = dashEffectActive ? 0 : 1;
            if (dashEffectActive) {
                if (normalized > tailLockPortion) {
                    influence = (normalized - tailLockPortion) / (1 - tailLockPortion);
                } else {
                    influence = 0;
                }
                influence = Math.max(0, Math.min(1, influence));
                if (relaxPhase > 0) {
                    const frontEase = Math.pow(normalized, 1.4);
                    influence *= Math.max(0, 1 - frontEase * relaxPhase);
                }
            }
            
            const stretchMultiplier = dashEffectActive
                ? 1 + (this.dashAnimStretch - 1) * influence
                : 1;
            const squeezeMultiplier = dashEffectActive
                ? 1 / (1 + 0.8 * (stretchMultiplier - 1))
                : 1;
            
            const distanceFromRear = (v.x - minForward) * stretchMultiplier;
            let newX = minForward + distanceFromRear;
            let newY = v.y * squeezeMultiplier;
            newX += curveShear * newY;
            
            if (newX < deformedMin) deformedMin = newX;
            if (newX > deformedMax) deformedMax = newX;
            
            transformedVertices.push({ x: newX, y: newY });
        });
        
        if (!isFinite(deformedMin)) deformedMin = minForward;
        if (!isFinite(deformedMax)) deformedMax = maxForward;
        const deformedSpan = Math.max(deformedMax - deformedMin, 0.0001);
        
        const renderRotation = dashEffectActive
            ? Math.atan2(this.dashAnimHeadingY, this.dashAnimHeadingX)
            : this.rotation;
        
        ctx.save();
        ctx.translate(this.x, this.y);
        if (scale !== 1) {
            ctx.scale(scale, scale);
        }
        ctx.rotate(renderRotation);
        
        ctx.beginPath();
        transformedVertices.forEach((v, index) => {
            if (index === 0) ctx.moveTo(v.x, v.y);
            else ctx.lineTo(v.x, v.y);
        });
        ctx.closePath();
        ctx.fillStyle = this.color;
        ctx.fill();
        
        const indicatorRadius = Math.min(5, Math.max(2, deformedSpan * 0.08));
        const indicatorX = deformedMax - indicatorRadius * 1.5;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(indicatorX, 0, indicatorRadius, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
        ctx.restore();
        const orbitSpeedFactor = 0.2;
        
        // Draw weapon orbiting visual (simple indicator, not the wave rings)
        if (this.weapon) {
            const weaponTime = Date.now() * 0.001 * orbitSpeedFactor;
            const weaponRadius = this.size + 10;
            const weaponX = this.x + Math.cos(weaponTime * 2) * weaponRadius;
            const weaponY = this.y + Math.sin(weaponTime * 2) * weaponRadius;
            
            ctx.fillStyle = this.weapon.color;
            ctx.beginPath();
            ctx.arc(weaponX, weaponY, 8, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Draw accessory trailing dots
        if (this.accessory) {
            const accTime = Date.now() * 0.002 * orbitSpeedFactor;
            const accRadius = this.size - 5;
            const accX = this.x + Math.cos(accTime * 2 + Math.PI) * accRadius;
            const accY = this.y + Math.sin(accTime * 2 + Math.PI) * accRadius;
            
            ctx.fillStyle = this.accessory.color;
            ctx.beginPath();
            ctx.arc(accX, accY, 5, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Render class-specific visuals (override by subclass)
        this.renderClassVisuals(ctx);
    }
    
    // Render class-specific visuals - override in subclass
    renderClassVisuals(ctx) {
        // Override in subclass for class-specific rendering
    }
    
    // Serialize player state for multiplayer sync (base properties)
    serialize() {
        return {
            // Position and movement
            x: this.x,
            y: this.y,
            rotation: this.rotation,
            
            // Health and progression
            hp: this.hp,
            maxHp: this.maxHp,
            level: this.level,
            xp: this.xp,
            xpToNext: this.xpToNext, // Fixed: was xpToNextLevel
            
            // Equipped gear (full objects with all affix system properties)
            weapon: this.weapon ? {
                id: this.weapon.id,
                slot: this.weapon.slot,
                tier: this.weapon.tier,
                color: this.weapon.color,
                stats: this.weapon.stats || {},
                affixes: this.weapon.affixes || [],
                weaponType: this.weapon.weaponType || null,
                classModifier: this.weapon.classModifier || null,
                legendaryEffect: this.weapon.legendaryEffect || null,
                name: this.weapon.name || ''
            } : null,
            armor: this.armor ? {
                id: this.armor.id,
                slot: this.armor.slot,
                tier: this.armor.tier,
                color: this.armor.color,
                stats: this.armor.stats || {},
                affixes: this.armor.affixes || [],
                armorType: this.armor.armorType || null,
                classModifier: this.armor.classModifier || null,
                legendaryEffect: this.armor.legendaryEffect || null,
                name: this.armor.name || ''
            } : null,
            accessory: this.accessory ? {
                id: this.accessory.id,
                slot: this.accessory.slot,
                tier: this.accessory.tier,
                color: this.accessory.color,
                stats: this.accessory.stats || {},
                affixes: this.accessory.affixes || [],
                classModifier: this.accessory.classModifier || null,
                legendaryEffect: this.accessory.legendaryEffect || null,
                name: this.accessory.name || ''
            } : null,
            
            // Gear visuals (deterministic patterns for consistent appearance in multiplayer)
            weaponVisual: this.weaponVisual,
            armorVisual: this.armorVisual,
            accessoryVisual: this.accessoryVisual,
            
            // Animation states
            isDodging: this.isDodging,
            dodgeElapsed: this.dodgeElapsed,
            isAttacking: this.isAttacking,
            isChargingHeavy: this.isChargingHeavy,
            heavyChargeElapsed: this.heavyChargeElapsed,
            dashAnimActive: !!this.dashAnimActive,
            dashAnimTimer: this.dashAnimTimer,
            dashAnimDirX: this.dashAnimDirX,
            dashAnimDirY: this.dashAnimDirY,
            dashAnimHeadingX: this.dashAnimHeadingX,
            dashAnimHeadingY: this.dashAnimHeadingY,
            dashAnimCurveAmount: this.dashAnimCurveAmount,
            
            // Cooldowns
            attackCooldown: this.attackCooldown,
            heavyAttackCooldown: this.heavyAttackCooldown,
            dodgeCooldown: this.dodgeCooldown,
            specialCooldown: this.specialCooldown,
            dodgeCharges: this.dodgeCharges,
            maxDodgeCharges: this.maxDodgeCharges,
            dodgeChargeCooldowns: this.dodgeChargeCooldowns || [],
            
            // Derived stats from gear/affixes (needed for remote player display)
            damage: this.damage,
            defense: this.defense,
            moveSpeed: this.moveSpeed,
            critChance: this.critChance,
            critDamageMultiplier: this.critDamageMultiplier,
            attackSpeedMultiplier: this.attackSpeedMultiplier,
            lifesteal: this.lifesteal,
            cooldownReduction: this.cooldownReduction,
            aoeMultiplier: this.aoeMultiplier,
            projectileSpeedMultiplier: this.projectileSpeedMultiplier,
            knockbackMultiplier: this.knockbackMultiplier,
            bonusDodgeCharges: this.bonusDodgeCharges,
            bonusMaxHealth: this.bonusMaxHealth,
            pierceCount: this.pierceCount,
            chainLightningCount: this.chainLightningCount,
            executeBonus: this.executeBonus,
            rampageBonus: this.rampageBonus,
            rampageStacks: this.rampageStacks || 0,
            multishotCount: this.multishotCount,
            phasingChance: this.phasingChance,
            explosiveChance: this.explosiveChance,
            fortifyPercent: this.fortifyPercent,
            fortifyShield: this.fortifyShield || 0,
            overchargeChance: this.overchargeChance,
            
            // Attack hitboxes (authoritative from host)
            attackHitboxes: this.attackHitboxes.map(h => ({
                x: h.x,
                y: h.y,
                radius: h.radius,
                damage: h.damage,
                lifetime: h.lifetime,
                elapsed: h.elapsed,
                type: h.type,
                heavy: h.heavy,
                trail: h.trail || [],
                hitEnemies: h.hitEnemies ? Array.from(h.hitEnemies) : []
            })),
            
            // Life state
            dead: this.dead,
            alive: this.alive,
            invulnerable: this.invulnerable,
            invulnerabilityTime: this.invulnerabilityTime
        };
    }
    
    // Apply state from host/network (base properties)
    applyState(state) {
        // Check if we're a multiplayer client (not host, not solo)
        const isMultiplayerClient = typeof Game !== 'undefined' && 
                                     Game.multiplayerEnabled && 
                                     typeof multiplayerManager !== 'undefined' && 
                                     multiplayerManager && 
                                     !multiplayerManager.isHost;
        
        let prevClientAudioState = null;
        if (isMultiplayerClient) {
            prevClientAudioState = this.getClientAudioStateFromInstance();
        }
        
        const prevDashAnimActive = this.dashAnimActive;
        
        // Position and movement - use interpolation for clients, direct update for host/solo
        if (state.x !== undefined && state.y !== undefined) {
            if (isMultiplayerClient) {
                // Add state to interpolation buffer for smooth rendering
                if (typeof interpolationManager !== 'undefined' && interpolationManager && this.playerId) {
                    interpolationManager.addEntityState(this.playerId, Date.now(), {
                        x: state.x,
                        y: state.y,
                        rotation: state.rotation,
                        timestamp: Date.now()
                    });
                }
                
                // Set interpolation targets
                this.targetX = state.x;
                this.targetY = state.y;
            } else {
                // Host or solo: direct update
                this.x = state.x;
                this.y = state.y;
            }
        }
        
        if (state.rotation !== undefined) {
            if (isMultiplayerClient) {
                this.targetRotation = state.rotation;
            } else {
                this.rotation = state.rotation;
            }
        }
        
        if (state.dashAnimDirX !== undefined && state.dashAnimDirY !== undefined) {
            const dirMag = Math.sqrt(state.dashAnimDirX * state.dashAnimDirX + state.dashAnimDirY * state.dashAnimDirY);
            if (dirMag > 0.0001) {
                this.dashAnimDirX = state.dashAnimDirX / dirMag;
                this.dashAnimDirY = state.dashAnimDirY / dirMag;
            } else {
                this.dashAnimDirX = state.dashAnimDirX;
                this.dashAnimDirY = state.dashAnimDirY;
            }
        }
        if (state.dashAnimHeadingX !== undefined && state.dashAnimHeadingY !== undefined) {
            const headingMag = Math.sqrt(state.dashAnimHeadingX * state.dashAnimHeadingX + state.dashAnimHeadingY * state.dashAnimHeadingY);
            if (headingMag > 0.0001) {
                this.dashAnimHeadingX = state.dashAnimHeadingX / headingMag;
                this.dashAnimHeadingY = state.dashAnimHeadingY / headingMag;
            } else {
                this.dashAnimHeadingX = state.dashAnimHeadingX;
                this.dashAnimHeadingY = state.dashAnimHeadingY;
            }
        }
        if (state.dashAnimTimer !== undefined) {
            this.dashAnimTimer = state.dashAnimTimer;
        }
        if (state.dashAnimActive !== undefined) {
            if (isMultiplayerClient) {
                if (state.dashAnimActive && !prevDashAnimActive) {
                    this.beginDashAnimation(
                        state.dashAnimDirX ?? this.dashAnimDirX,
                        state.dashAnimDirY ?? this.dashAnimDirY,
                        { timer: state.dashAnimTimer || 0, seedTrail: true }
                    );
                } else if (!state.dashAnimActive && prevDashAnimActive) {
                    this.endDashAnimation();
                }
            } else {
                this.dashAnimActive = state.dashAnimActive;
            }
        }
        if (state.dashAnimCurveAmount !== undefined) {
            this.dashAnimCurveAmount = state.dashAnimCurveAmount;
        }
        
        // Health and progression (with level up detection)
        const oldLevel = this.level;
        
        // IMPORTANT: For multiplayer clients, DON'T overwrite our own HP/XP from host's game state
        // The host sends what it THINKS our stats are, but we maintain our own authoritative HP/XP
        // We only update HP from damage events, and XP from kill events
        // This prevents the "instant heal" bug where host state overwrites damage before we see it
        if (!isMultiplayerClient) {
            // Host or solo: apply HP/XP directly
            if (state.hp !== undefined) this.hp = state.hp;
            if (state.maxHp !== undefined) this.maxHp = state.maxHp;
            if (state.level !== undefined) this.level = state.level;
            if (state.xp !== undefined) this.xp = state.xp;
            if (state.xpToNext !== undefined) this.xpToNext = state.xpToNext; // Fixed property name
            
            // Trigger level up message if level increased
            if (state.level !== undefined && state.level > oldLevel && typeof showLevelUpMessage === 'function') {
                showLevelUpMessage(this.level);
            }
        } else {
            // Client: Accept HP from host (authoritative) to avoid damage desync
            // Host tracks all damage and syncs HP via game_state
            if (state.hp !== undefined) this.hp = state.hp;
            if (state.maxHp !== undefined) this.maxHp = state.maxHp;
            
            // Sync XP values from host (XP is shared among all players, host is authoritative)
            if (state.xp !== undefined) this.xp = state.xp;
            if (state.xpToNext !== undefined) this.xpToNext = state.xpToNext;
            
            // Only update level if it actually increased (from our own leveling)
            if (state.level !== undefined && state.level > this.level) {
                const levelIncreased = state.level > this.level;
                this.level = state.level;
                
                // Apply level up bonuses when level increases (for multiplayer clients)
                // This ensures bonuses are applied even if player_leveled_up event arrives out of order
                if (levelIncreased && typeof this.applyLevelUpBonuses === 'function') {
                    console.log(`[Client] Level increased to ${this.level}, applying bonuses via applyState`);
                    this.applyLevelUpBonuses();
                }
                
                if (typeof showLevelUpMessage === 'function') {
                    showLevelUpMessage(this.level);
                }
            }
            
            // CRITICAL: Sync death status from host (authoritative)
            // When host confirms death, client must apply it
            if (state.dead !== undefined && state.dead && !this.dead) {
                this.dead = true;
                this.alive = false;
                this.hp = 0;
                
                // Track death in local stats
                if (typeof Game !== 'undefined' && Game.getPlayerStats && Game.getLocalPlayerId) {
                    const playerId = Game.getLocalPlayerId();
                    const stats = Game.getPlayerStats(playerId);
                    stats.onDeath();
                    
                    // Add to dead players set
                    Game.deadPlayers.add(playerId);
                    
                    // Check if all players are dead
                    if (Game.checkAllPlayersDead) {
                        Game.allPlayersDead = Game.checkAllPlayersDead();
                    }
                }
                
                // Record end time for death screen
                if (typeof Game !== 'undefined') {
                    Game.endTime = Date.now();
                    Game.currencyEarned = Game.calculateCurrency();
                }
                
                console.log('[Client] Death confirmed by host');
        } else if ((state.dead === false && this.dead) ||
                   (state.hp !== undefined && state.hp > 0 && this.dead)) {
            // Host signalled that we're alive again (revived or otherwise)
            this.dead = false;
            this.alive = true;
            if (state.hp !== undefined) {
                this.hp = state.hp;
            } else if (this.hp <= 0) {
                this.hp = Math.max(1, this.maxHp * 0.5);
            }
            this.invulnerable = state.invulnerable !== undefined ? state.invulnerable : this.invulnerable;
            this.invulnerabilityTime = state.invulnerabilityTime !== undefined ? state.invulnerabilityTime : this.invulnerabilityTime;
            
            if (typeof Game !== 'undefined') {
                const playerId = Game.getLocalPlayerId ? Game.getLocalPlayerId() : null;
                if (playerId && Game.deadPlayers && Game.deadPlayers.has(playerId)) {
                    Game.deadPlayers.delete(playerId);
                }
                Game.allPlayersDead = false;
                Game.spectateMode = false;
                Game.spectatedPlayerId = null;
                Game.deathScreenStartTime = 0;
                Game.endTime = 0;
                
                if (Game.getPlayerStats && playerId) {
                    const stats = Game.getPlayerStats(playerId);
                    if (stats && typeof stats.onRevive === 'function') {
                        stats.onRevive();
                    }
                }
            }
            
            if (typeof this.resetDashAnimation === 'function') {
                this.resetDashAnimation();
            }
            if (typeof this.resetHeavyCharge === 'function') {
                this.resetHeavyCharge();
            }
            this.attackCooldown = Math.min(this.attackCooldown, 0);
            this.heavyAttackCooldown = Math.min(this.heavyAttackCooldown, 0);
            this.specialCooldown = Math.max(this.specialCooldown || 0, 0);
            this.isDodging = false;
            this.isChargingHeavy = false;
            this.isAttacking = false;
            this.vx = 0;
            this.vy = 0;
            
            console.log('[Client] Revival confirmed by host');
            }
        }
        
        // Equipped gear (apply and recalculate stats)
        if (state.weapon !== undefined) this.weapon = state.weapon;
        if (state.armor !== undefined) this.armor = state.armor;
        if (state.accessory !== undefined) this.accessory = state.accessory;
        
        // Recalculate effective stats based on new gear
        if (state.weapon !== undefined || state.armor !== undefined || state.accessory !== undefined) {
            this.updateEffectiveStats();
        }
        
        // Animation states
        if (state.isDodging !== undefined) this.isDodging = state.isDodging;
        if (state.dodgeElapsed !== undefined) this.dodgeElapsed = state.dodgeElapsed;
        if (state.isAttacking !== undefined) {
            this.isAttacking = state.isAttacking;
            this.attacking = state.isAttacking; // Alias
        }
        if (state.isChargingHeavy !== undefined) this.isChargingHeavy = state.isChargingHeavy;
        if (state.heavyChargeElapsed !== undefined) this.heavyChargeElapsed = state.heavyChargeElapsed;
        
        // Cooldowns
        if (state.attackCooldown !== undefined) this.attackCooldown = state.attackCooldown;
        if (state.heavyAttackCooldown !== undefined) this.heavyAttackCooldown = state.heavyAttackCooldown;
        if (state.dodgeCooldown !== undefined) this.dodgeCooldown = state.dodgeCooldown;
        if (state.specialCooldown !== undefined) this.specialCooldown = state.specialCooldown;
        if (state.dodgeCharges !== undefined) this.dodgeCharges = state.dodgeCharges;
        if (state.maxDodgeCharges !== undefined) this.maxDodgeCharges = state.maxDodgeCharges;
        if (state.dodgeChargeCooldowns !== undefined) this.dodgeChargeCooldowns = state.dodgeChargeCooldowns;
        
        // Derived stats from gear/affixes (only apply if provided by host)
        if (state.damage !== undefined) this.damage = state.damage;
        if (state.defense !== undefined) this.defense = state.defense;
        if (state.moveSpeed !== undefined) this.moveSpeed = state.moveSpeed;
        if (state.critChance !== undefined) this.critChance = state.critChance;
        if (state.critDamageMultiplier !== undefined) this.critDamageMultiplier = state.critDamageMultiplier;
        if (state.attackSpeedMultiplier !== undefined) this.attackSpeedMultiplier = state.attackSpeedMultiplier;
        if (state.lifesteal !== undefined) this.lifesteal = state.lifesteal;
        if (state.cooldownReduction !== undefined) this.cooldownReduction = state.cooldownReduction;
        if (state.aoeMultiplier !== undefined) this.aoeMultiplier = state.aoeMultiplier;
        if (state.projectileSpeedMultiplier !== undefined) this.projectileSpeedMultiplier = state.projectileSpeedMultiplier;
        if (state.knockbackMultiplier !== undefined) this.knockbackMultiplier = state.knockbackMultiplier;
        if (state.bonusDodgeCharges !== undefined) this.bonusDodgeCharges = state.bonusDodgeCharges;
        if (state.bonusMaxHealth !== undefined) this.bonusMaxHealth = state.bonusMaxHealth;
        if (state.pierceCount !== undefined) this.pierceCount = state.pierceCount;
        if (state.chainLightningCount !== undefined) this.chainLightningCount = state.chainLightningCount;
        if (state.executeBonus !== undefined) this.executeBonus = state.executeBonus;
        if (state.rampageBonus !== undefined) this.rampageBonus = state.rampageBonus;
        if (state.rampageStacks !== undefined) this.rampageStacks = state.rampageStacks;
        if (state.multishotCount !== undefined) this.multishotCount = state.multishotCount;
        if (state.phasingChance !== undefined) this.phasingChance = state.phasingChance;
        if (state.explosiveChance !== undefined) this.explosiveChance = state.explosiveChance;
        if (state.fortifyPercent !== undefined) this.fortifyPercent = state.fortifyPercent;
        if (state.fortifyShield !== undefined) this.fortifyShield = state.fortifyShield;
        if (state.overchargeChance !== undefined) this.overchargeChance = state.overchargeChance;
        
        // Attack hitboxes
        if (state.attackHitboxes !== undefined) this.attackHitboxes = state.attackHitboxes;
        
        // Life state (only for non-clients or if host is explicitly updating remote player instances)
        // Clients handle death status separately above to avoid flickering
        if (!isMultiplayerClient) {
            if (state.dead !== undefined) this.dead = state.dead;
            if (state.alive !== undefined) this.alive = state.alive;
        } else {
            // Client safeguard: if our HP is 0 or below, stay dead regardless of host state
            // This prevents flickering while waiting for host confirmation
            if (this.hp <= 0) {
                this.dead = true;
                this.alive = false;
            }
        }
        if (state.invulnerable !== undefined) this.invulnerable = state.invulnerable;
        if (state.invulnerabilityTime !== undefined) this.invulnerabilityTime = state.invulnerabilityTime;
        
        // Gear (update if changed)
        let gearChanged = false;
        if (state.weapon !== undefined) {
            // Deep compare to detect actual changes
            const weaponChanged = !this.weapon || JSON.stringify(this.weapon) !== JSON.stringify(state.weapon);
            if (weaponChanged) {
                this.weapon = state.weapon;
                gearChanged = true;
            }
        }
        if (state.armor !== undefined) {
            const armorChanged = !this.armor || JSON.stringify(this.armor) !== JSON.stringify(state.armor);
            if (armorChanged) {
                this.armor = state.armor;
                gearChanged = true;
            }
        }
        if (state.accessory !== undefined) {
            const accessoryChanged = !this.accessory || JSON.stringify(this.accessory) !== JSON.stringify(state.accessory);
            if (accessoryChanged) {
                this.accessory = state.accessory;
                gearChanged = true;
            }
        }
        
        // If gear changed, recalculate all stats with affixes
        if (gearChanged && this.updateEffectiveStats) {
            this.updateEffectiveStats();
            console.log(`[Remote Player] Gear changed, recalculated stats with affixes`);
        }
        
        // Gear visuals (receive from host or recalculate if gear changed)
        if (state.weaponVisual !== undefined) {
            this.weaponVisual = state.weaponVisual;
        } else if (gearChanged && this.weapon) {
            this.weaponVisual = this.calculateGearPieceVisual(this.weapon);
        }
        if (state.armorVisual !== undefined) {
            this.armorVisual = state.armorVisual;
        } else if (gearChanged && this.armor) {
            this.armorVisual = this.calculateGearPieceVisual(this.armor);
        }
        if (state.accessoryVisual !== undefined) {
            this.accessoryVisual = state.accessoryVisual;
        } else if (gearChanged && this.accessory) {
            this.accessoryVisual = this.calculateGearPieceVisual(this.accessory);
        }
        
        if (isMultiplayerClient) {
            const currentClientAudioState = this.getClientAudioTrackedFields(state);
            this.playClientAudioFromState(prevClientAudioState, currentClientAudioState, state);
        }
    }
    
    getClientAudioTrackedFields(state) {
        const baseState = {
            isAttacking: state && state.isAttacking !== undefined ? state.isAttacking : !!this.isAttacking,
            isDodging: state && state.isDodging !== undefined ? state.isDodging : !!this.isDodging,
            isChargingHeavy: state && state.isChargingHeavy !== undefined ? state.isChargingHeavy : !!this.isChargingHeavy,
            attackCooldown: state && state.attackCooldown !== undefined ? state.attackCooldown : (this.attackCooldown || 0),
            heavyAttackCooldown: state && state.heavyAttackCooldown !== undefined ? state.heavyAttackCooldown : (this.heavyAttackCooldown || 0),
            specialCooldown: state && state.specialCooldown !== undefined ? state.specialCooldown : (this.specialCooldown || 0),
            dodgeCharges: state && state.dodgeCharges !== undefined ? state.dodgeCharges : (this.dodgeCharges !== undefined ? this.dodgeCharges : 0),
            dead: state && state.dead !== undefined ? state.dead : !!this.dead,
            alive: state && state.alive !== undefined ? state.alive : !!this.alive
        };
        return {
            ...baseState,
            ...this.getAdditionalAudioTrackedFields(state)
        };
    }
    
    getClientAudioStateFromInstance() {
        const baseState = {
            isAttacking: !!this.isAttacking,
            isDodging: !!this.isDodging,
            isChargingHeavy: !!this.isChargingHeavy,
            attackCooldown: this.attackCooldown || 0,
            heavyAttackCooldown: this.heavyAttackCooldown || 0,
            specialCooldown: this.specialCooldown || 0,
            dodgeCharges: this.dodgeCharges !== undefined ? this.dodgeCharges : 0,
            dead: !!this.dead,
            alive: !!this.alive
        };
        return {
            ...baseState,
            ...this.getAdditionalAudioTrackedFieldsFromInstance()
        };
    }
    
    // Subclasses can override to track additional properties for audio detection
    getAdditionalAudioTrackedFields(state) {
        return {};
    }
    
    getAdditionalAudioTrackedFieldsFromInstance() {
        return {};
    }
    
    canPlayClientAudio() {
        return typeof AudioManager !== 'undefined' && 
               AudioManager.sounds && 
               AudioManager.initialized && 
               !AudioManager.muted;
    }
    
    playClientAudioFromState(prevState, currentState, rawState) {
        if (!prevState || !currentState || !this.canPlayClientAudio()) {
            return;
        }
        
        if (!prevState.isDodging && currentState.isDodging) {
            this.playDodgeSound();
        }
        
        let heavyTriggered = false;
        if (this.didHeavyAttackTrigger(prevState, currentState)) {
            heavyTriggered = this.onClientHeavyAttackTriggered(prevState, currentState, rawState) === true;
        }
        
        if (!prevState.isAttacking && currentState.isAttacking && !heavyTriggered) {
            this.onClientAttackStarted(prevState, currentState, rawState);
        }
        
        if (this.didSpecialAbilityTrigger(prevState, currentState)) {
            this.onClientSpecialAbilityTriggered(prevState, currentState, rawState);
        }
        
        if (!prevState.dead && currentState.dead) {
            this.onClientDeath(rawState);
        }
        
        this.handleSubclassClientAudio(prevState, currentState, rawState);
    }
    
    didHeavyAttackTrigger(prevState, currentState) {
        if (prevState.heavyAttackCooldown === undefined || currentState.heavyAttackCooldown === undefined) {
            return false;
        }
        return currentState.heavyAttackCooldown > prevState.heavyAttackCooldown + 0.05;
    }
    
    didSpecialAbilityTrigger(prevState, currentState) {
        if (prevState.specialCooldown === undefined || currentState.specialCooldown === undefined) {
            return false;
        }
        return currentState.specialCooldown > prevState.specialCooldown + 0.05;
    }
    
    playDodgeSound() {
        if (this.canPlayClientAudio() && AudioManager.sounds.dodge) {
            AudioManager.sounds.dodge();
        }
    }
    
    // Hooks for subclasses to customise audio behaviour
    onClientAttackStarted(_prevState, _currentState, _rawState) {
        // Default: subclasses implement if needed
    }
    
    onClientHeavyAttackTriggered(_prevState, _currentState, _rawState) {
        return false;
    }
    
    onClientSpecialAbilityTriggered(_prevState, _currentState, _rawState) {
        // Default: subclasses implement if needed
    }
    
    onClientDeath(_rawState) {
        if (this.canPlayClientAudio() && AudioManager.sounds.playerDeath) {
            AudioManager.sounds.playerDeath();
        }
    }
    
    handleSubclassClientAudio(_prevState, _currentState, _rawState) {
        // Default: subclasses can override for additional events
    }
    
    // Get gameplay position (authoritative position for multiplayer clients, visual position otherwise)
    // Use this for attack creation, collision detection, etc.
    getGameplayPosition() {
        // Check if we're a multiplayer client (not host, not solo)
        const isMultiplayerClient = typeof Game !== 'undefined' && 
                                     Game.multiplayerEnabled && 
                                     typeof multiplayerManager !== 'undefined' && 
                                     multiplayerManager && 
                                     !multiplayerManager.isHost;
        
        if (isMultiplayerClient && this.targetX !== null && this.targetY !== null) {
            // Use authoritative position from host
            return { x: this.targetX, y: this.targetY };
        }
        
        // Use current visual position
        return { x: this.x, y: this.y };
    }
    
    // Interpolate position toward target (for multiplayer clients)
    interpolatePosition(deltaTime) {
        // Only interpolate if we have targets set
        if (this.targetX === null || this.targetY === null) return;
        
        // Use InterpolationManager for smooth interpolation with velocity-based extrapolation
        if (typeof interpolationManager !== 'undefined' && interpolationManager && this.playerId) {
            const smoothed = interpolationManager.getSmoothedPosition(
                this.playerId,
                this.x,
                this.y,
                this.rotation,
                this.targetX,
                this.targetY,
                this.targetRotation,
                deltaTime
            );
            
            this.x = smoothed.x;
            this.y = smoothed.y;
            this.rotation = smoothed.rotation;
        } else {
            // Fallback: simple lerp if InterpolationManager not available
            const snapDistance = typeof MultiplayerConfig !== 'undefined' 
                ? MultiplayerConfig.SNAP_DISTANCE 
                : 100;
            const dx = this.targetX - this.x;
            const dy = this.targetY - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > snapDistance) {
                this.x = this.targetX;
                this.y = this.targetY;
                if (this.targetRotation !== null) {
                    this.rotation = this.targetRotation;
                }
            } else if (distance > 0.5) {
                const smoothingFactor = 0.15;
                const t = 1 - Math.pow(1 - smoothingFactor, deltaTime * 60);
                this.x += dx * t;
                this.y += dy * t;
                
                if (this.targetRotation !== null) {
                    let rotDiff = this.targetRotation - this.rotation;
                    while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
                    while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
                    this.rotation += rotDiff * t;
                }
            } else {
                this.x = this.targetX;
                this.y = this.targetY;
                if (this.targetRotation !== null) {
                    this.rotation = this.targetRotation;
                }
            }
        }
        
        if (this.dashAnimActive) {
            this.sampleDashAnimation(this.x, this.y);
        }
        this.advanceDashAnimation(deltaTime, 'interpolate');
    }
}

// Factory function to create player instances
function createPlayer(classType, x, y) {
    // Check if classes are defined (safety check for script loading)
    if (typeof Warrior === 'undefined' || typeof Rogue === 'undefined' || 
        typeof Tank === 'undefined' || typeof Mage === 'undefined') {
        console.error('Player classes not loaded yet! Ensure all player-*.js files are loaded before calling createPlayer.');
        return null;
    }
    
    switch(classType) {
        case 'square':
            return new Warrior(x, y);
        case 'triangle':
            return new Rogue(x, y);
        case 'pentagon':
            return new Tank(x, y);
        case 'hexagon':
            return new Mage(x, y);
        default:
            console.error('Unknown class type:', classType);
            return new Warrior(x, y); // Fallback to Warrior
    }
}

