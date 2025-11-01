// Base player class with shared functionality
// VERSION: 2024-11-01-DODGE-FIX-v6

console.log('[player-base.js] ============ LOADED VERSION 2024-11-01-DODGE-FIX-v6 ============');

// Class definitions (will be used by subclasses)
const CLASS_DEFINITIONS = {
    square: {
        name: 'Warrior',
        hp: 100,
        damage: 14,
        speed: 230,
        defense: 0.1,
        critChance: 0,
        color: '#4a90e2',
        shape: 'square'
    },
    triangle: {
        name: 'Rogue',
        hp: 75,
        damage: 12,
        speed: 287.5,
        defense: 0,
        critChance: 0.25,
        dodgeCharges: 3,
        dodgeCooldown: 1.0,
        dodgeSpeed: 720,
        color: '#ff1493',
        shape: 'triangle'
    },
    pentagon: {
        name: 'Tank',
        hp: 150,
        damage: 8,
        speed: 172.5,
        defense: 0.2,
        critChance: 0,
        color: '#c72525',
        shape: 'pentagon'
    },
    hexagon: {
        name: 'Mage',
        hp: 80,
        damage: 20,
        speed: 207,
        defense: 0,
        critChance: 0,
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
        
        // Health system
        this.maxHp = 100;
        this.hp = 100;
        this.level = 1;
        
        // XP system
        this.xp = 0;
        this.xpToNext = 100;
        
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
        
        // Interpolation targets (for multiplayer client smoothing)
        this.targetX = null;
        this.targetY = null;
        this.targetRotation = null;
        this.lastUpdateTime = 0;
        this.lastVelocityX = 0;
        this.lastVelocityY = 0;
        
        // Initialize effective stats (will be calculated based on base + gear)
        this.damage = this.baseDamage;
        this.defense = this.baseDefense;
        this.moveSpeed = this.baseMoveSpeed;
        
        // Initialize effective stats
        this.updateEffectiveStats();
    }
    
    
    update(deltaTime, input) {
        // Don't update if dead
        if (this.dead) {
            this.alive = false;
            return;
        }
        
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
        
        // Process pull forces (apply before normal movement)
        this.processPullForces(deltaTime);
        
        // Update position (skip during special movement handled by subclass)
        if (!this.isInSpecialMovement()) {
            this.x += this.vx * deltaTime;
            this.y += this.vy * deltaTime;
        }
        
        // Note: Mage blink knockback moved to player-mage.js updateClassAbilities()
        // Note: Rogue dodge collision damage moved to player-rogue.js updateClassAbilities()
        
        // Keep player within canvas bounds
        if (typeof Game !== 'undefined') {
            this.x = clamp(this.x, this.size, Game.canvas.width - this.size);
            this.y = clamp(this.y, this.size, Game.canvas.height - this.size);
        }
        
        // Calculate rotation to face aim direction (mouse or joystick)
        if (input.getAimDirection) {
            this.rotation = input.getAimDirection();
        } else if (input.mouse.x !== undefined && input.mouse.y !== undefined) {
            const dx = input.mouse.x - this.x;
            const dy = input.mouse.y - this.y;
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
        
        // Update dodge cooldown
        // Note: Triangle charge-based cooldown moved to player-rogue.js updateClassAbilities()
        if (this.dodgeCooldown > 0) {
            this.dodgeCooldown -= deltaTime;
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
                
                // Update hammer position
                hitbox.x = this.x + Math.cos(hitbox.currentAngle) * hitbox.hammerDistance;
                hitbox.y = this.y + Math.sin(hitbox.currentAngle) * hitbox.hammerDistance;
                
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
        
        if (this.playerClass === 'triangle') {
            // Charge-based system for Triangle
            const availableCharges = this.dodgeChargeCooldowns.filter(cooldown => cooldown <= 0).length;
            canDodge = availableCharges > 0;
        } else {
            // Standard cooldown for other classes
            canDodge = this.dodgeCooldown <= 0;
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
        
        // Handle cooldown based on class
        if (this.playerClass === 'triangle') {
            // Find first available charge and put it on cooldown
            for (let i = 0; i < this.dodgeChargeCooldowns.length; i++) {
                if (this.dodgeChargeCooldowns[i] <= 0) {
                    this.dodgeChargeCooldowns[i] = this.dodgeCooldownTime;
                    break;
                }
            }
        } else {
            // Standard single cooldown
            this.dodgeCooldown = this.dodgeCooldownTime;
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
        this.heavyAttackCooldown = this.heavyAttackCooldownTime;
    }
    
    // Create heavy attack - override in subclass
    createHeavyAttack() {
        // Subclass must override this
        throw new Error('createHeavyAttack() must be implemented by subclass');
    }
    
    takeDamage(damage) {
        if (this.invulnerable || this.dead) return;
        
        // Apply damage reduction (subclass can override getDamageReduction())
        const reduction = this.getDamageReduction();
        damage = damage * (1 - reduction);
        
        // Track damage taken in player stats
        if (typeof Game !== 'undefined' && Game.getPlayerStats && Game.getLocalPlayerId) {
            const playerId = Game.getLocalPlayerId();
            const stats = Game.getPlayerStats(playerId);
            stats.addStat('damageTaken', damage);
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
            this.hp = 0;
            this.dead = true;
            this.alive = false;
            
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
                }
            }
            
            // Record end time for death screen and calculate currency
            if (typeof Game !== 'undefined') {
                Game.endTime = Date.now();
                Game.currencyEarned = Game.calculateCurrency();
            }
            
            console.log('Player died!');
        } else {
            console.log(`Player took ${damage} damage! HP: ${this.hp}/${this.maxHp}`);
        }
    }
    
    // Get damage reduction factor (0-1) - override in subclass
    getDamageReduction() {
        // Default: no reduction (subclasses can override for block stance, shield, etc.)
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
    
    // Level up function
    levelUp() {
        this.level++;
        
        // Increase base stats by 10%
        this.baseDamage *= 1.1;
        this.baseMoveSpeed *= 1.1;
        this.maxHp *= 1.1;
        
        // Recalculate effective stats with gear bonuses
        this.updateEffectiveStats();
        
        // Heal to full HP
        this.hp = this.maxHp;
        
        // Multiplayer: Immediately sync health change
        if (typeof Game !== 'undefined' && Game.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager) {
            if (multiplayerManager.isHost) {
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
        
        console.log(`Level Up! Now level ${this.level}`);
    }
    
    // Calculate effective stats with gear bonuses
    updateEffectiveStats() {
        let damageBonus = 1;
        let defenseBonus = 0;
        let speedBonus = 1;
        
        // Apply weapon bonuses
        if (this.weapon) {
            damageBonus = 1 + this.weapon.stats.damage;
        }
        
        // Apply armor bonuses
        if (this.armor) {
            defenseBonus = this.armor.stats.defense;
        }
        
        // Apply accessory bonuses
        if (this.accessory) {
            speedBonus = 1 + this.accessory.stats.speed;
        }
        
        // Calculate effective stats
        this.damage = this.baseDamage * damageBonus;
        this.defense = this.baseDefense + defenseBonus;
        this.moveSpeed = this.baseMoveSpeed * speedBonus;
    }
    
    // Equip gear
    equipGear(gear) {
        const oldGear = this[gear.slot];
        this[gear.slot] = gear;
        
        // Update effective stats
        this.updateEffectiveStats();
        
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
        
        ctx.save();
        
        // Make player semi-transparent during dodge
        if (this.isDodging) {
            ctx.globalAlpha = 0.5;
        }
        
        // Grow player during heavy charge
        let scale = 1.0;
        if (this.isChargingHeavy) {
            scale = 1.0 + (this.heavyChargeElapsed / this.heavyAttackWindup) * 0.3;
        }
        
        // Draw armor bonus visual
        if (this.armor) {
            ctx.strokeStyle = this.armor.color;
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size + 3, 0, Math.PI * 2);
            ctx.stroke();
        }
        
        // Draw player shape based on class
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.fillStyle = this.color;
        
        const shape = this.shape || 'square';
        
        if (shape === 'triangle') {
            ctx.beginPath();
            ctx.moveTo(this.size, 0);
            ctx.lineTo(-this.size * 0.5, -this.size * 0.866);
            ctx.lineTo(-this.size * 0.5, this.size * 0.866);
            ctx.closePath();
            ctx.fill();
        } else if (shape === 'hexagon') {
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const angle = (Math.PI / 3) * i;
                const px = Math.cos(angle) * this.size;
                const py = Math.sin(angle) * this.size;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
        } else if (shape === 'pentagon') {
            const rotationOffset = 18 * Math.PI / 180;
            ctx.beginPath();
            for (let i = 0; i < 5; i++) {
                const angle = (Math.PI * 2 / 5) * i - Math.PI / 2 + rotationOffset;
                const px = Math.cos(angle) * this.size;
                const py = Math.sin(angle) * this.size;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
        } else {
            // Default to square/rectangle
            ctx.beginPath();
            ctx.rect(-this.size * 0.8, -this.size * 0.8, this.size * 1.6, this.size * 1.6);
            ctx.fill();
        }
        
        // Draw facing direction indicator
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        
        if (shape === 'pentagon') {
            const rotationOffset = 18 * Math.PI / 180;
            const vertexIndex = 1;
            const vertexAngle = (Math.PI * 2 / 5) * vertexIndex - Math.PI / 2 + rotationOffset;
            const indicatorDistance = this.size * 0.7;
            const indicatorX = Math.cos(vertexAngle) * indicatorDistance;
            const indicatorY = Math.sin(vertexAngle) * indicatorDistance;
            ctx.arc(indicatorX, indicatorY, 5, 0, Math.PI * 2);
        } else {
            ctx.arc(this.size - 10, 0, 5, 0, Math.PI * 2);
        }
        
        ctx.fill();
        ctx.restore();
        
        // Restore global alpha from dodge transparency
        ctx.restore();
        
        // Draw weapon orbiting visual
        if (this.weapon) {
            const weaponTime = Date.now() * 0.001;
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
            const accTime = Date.now() * 0.002;
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
            xpToNextLevel: this.xpToNextLevel,
            
            // Equipped gear (for visuals and stat calculations)
            weapon: this.weapon,
            armor: this.armor,
            accessory: this.accessory,
            
            // Animation states
            isDodging: this.isDodging,
            dodgeElapsed: this.dodgeElapsed,
            isAttacking: this.isAttacking,
            isChargingHeavy: this.isChargingHeavy,
            heavyChargeElapsed: this.heavyChargeElapsed,
            
            // Cooldowns
            attackCooldown: this.attackCooldown,
            heavyAttackCooldown: this.heavyAttackCooldown,
            dodgeCooldown: this.dodgeCooldown,
            specialCooldown: this.specialCooldown,
            dodgeCharges: this.dodgeCharges,
            
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
        
        // Position and movement - use interpolation for clients, direct update for host/solo
        if (state.x !== undefined) {
            if (isMultiplayerClient) {
                // Set interpolation target instead of direct position
                this.targetX = state.x;
                // Calculate velocity for extrapolation
                if (this.targetX !== null && this.x !== undefined) {
                    const dt = (Date.now() - this.lastUpdateTime) / 1000;
                    if (dt > 0 && dt < 1) { // Sanity check
                        this.lastVelocityX = (state.x - this.x) / dt;
                    }
                }
            } else {
                // Host or solo: direct update
                this.x = state.x;
            }
        }
        
        if (state.y !== undefined) {
            if (isMultiplayerClient) {
                this.targetY = state.y;
                if (this.targetY !== null && this.y !== undefined) {
                    const dt = (Date.now() - this.lastUpdateTime) / 1000;
                    if (dt > 0 && dt < 1) {
                        this.lastVelocityY = (state.y - this.y) / dt;
                    }
                }
            } else {
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
        
        // Update timestamp for velocity calculation
        if (isMultiplayerClient) {
            this.lastUpdateTime = Date.now();
        }
        
        // Health and progression (with level up detection)
        const oldLevel = this.level;
        if (state.hp !== undefined) this.hp = state.hp;
        if (state.maxHp !== undefined) this.maxHp = state.maxHp;
        if (state.level !== undefined) this.level = state.level;
        if (state.xp !== undefined) this.xp = state.xp;
        if (state.xpToNextLevel !== undefined) this.xpToNextLevel = state.xpToNextLevel;
        
        // Trigger level up message if level increased
        if (state.level !== undefined && state.level > oldLevel && typeof showLevelUpMessage === 'function') {
            showLevelUpMessage(this.level);
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
        
        // Attack hitboxes
        if (state.attackHitboxes !== undefined) this.attackHitboxes = state.attackHitboxes;
        
        // Life state
        if (state.dead !== undefined) this.dead = state.dead;
        if (state.alive !== undefined) this.alive = state.alive;
        if (state.invulnerable !== undefined) this.invulnerable = state.invulnerable;
        if (state.invulnerabilityTime !== undefined) this.invulnerabilityTime = state.invulnerabilityTime;
    }
    
    // Interpolate position toward target (for multiplayer clients)
    interpolatePosition(deltaTime) {
        // Only interpolate if we have targets set
        if (this.targetX === null || this.targetY === null) return;
        
        // Calculate distance to target
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // If very far from target, snap to prevent rubber-banding
        if (distance > MultiplayerConfig.SNAP_DISTANCE) {
            this.x = this.targetX;
            this.y = this.targetY;
            if (this.targetRotation !== null) {
                this.rotation = this.targetRotation;
            }
            return;
        }
        
        // Adaptive lerp speed based on distance
        // Closer to target = slower lerp (smoother), further = faster (catch up)
        const baseSpeed = MultiplayerConfig.BASE_LERP_SPEED;
        const distanceFactor = Math.min(distance / 50, 2); // Scale up to 2x speed when far
        const lerpSpeed = clamp(
            baseSpeed * (1 + distanceFactor),
            MultiplayerConfig.MIN_LERP_SPEED,
            MultiplayerConfig.MAX_LERP_SPEED
        );
        
        // Smooth lerp toward target
        const t = Math.min(1, deltaTime * lerpSpeed);
        this.x += dx * t;
        this.y += dy * t;
        
        // Interpolate rotation (handle wrapping)
        if (this.targetRotation !== null) {
            let rotDiff = this.targetRotation - this.rotation;
            // Normalize to [-PI, PI]
            while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
            while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
            this.rotation += rotDiff * t;
        }
        
        // Clear targets if very close (snap the last bit)
        if (distance < 0.1) {
            this.x = this.targetX;
            this.y = this.targetY;
            if (this.targetRotation !== null) {
                this.rotation = this.targetRotation;
            }
        }
    }
}

// Factory function to create player instances
function createPlayer(classType, x, y) {
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

