// Base player class with shared functionality

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
            const usesHeavyJoystick = typeof Input !== 'undefined' && Input.isTouchMode && Input.isTouchMode() &&
                Input.getAbilityInputType && 
                Input.getAbilityInputType(this.playerClass, 'heavyAttack') === 'joystick-press-release';
            
            if (usesHeavyJoystick && (this.playerClass === 'square' || this.playerClass === 'triangle')) {
                // Warrior/Triangle on mobile: for joystick-press-release mode, check for button release
                if (Input.touchButtons && Input.touchButtons.heavyAttack) {
                    const button = Input.touchButtons.heavyAttack;
                    
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
            // Clear preview before starting dodge
            this.dashPreviewActive = false;
            this.startDodge(input);
        }
    }
    
    startDodge(input) {
        // Calculate dodge direction
        let dodgeDirX = 0;
        let dodgeDirY = 0;
        
        // Triangle (Rogue) uses joystick for directional dash on mobile
        if (this.playerClass === 'triangle') {
            if (input.isTouchMode && input.isTouchMode()) {
                // On mobile: use dodge joystick direction if available
                const button = input.touchButtons && input.touchButtons.dodge;
                if (button && button.finalJoystickState) {
                    // Use stored joystick state from button release
                    const state = button.finalJoystickState;
                    if (state.magnitude > 0.1) {
                        dodgeDirX = state.direction.x * this.dodgeSpeedBoost;
                        dodgeDirY = state.direction.y * this.dodgeSpeedBoost;
                        // Clear the stored state after using it
                        button.finalJoystickState = null;
                    } else {
                        // Magnitude too low, use facing direction
                        dodgeDirX = Math.cos(this.rotation) * this.dodgeSpeedBoost;
                        dodgeDirY = Math.sin(this.rotation) * this.dodgeSpeedBoost;
                    }
                } else if (input.touchJoysticks && input.touchJoysticks.dodge && input.touchJoysticks.dodge.active) {
                    // Joystick is still active (fallback)
                    const joystick = input.touchJoysticks.dodge;
                    const dir = joystick.getDirection();
                    dodgeDirX = dir.x * this.dodgeSpeedBoost;
                    dodgeDirY = dir.y * this.dodgeSpeedBoost;
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

