// Mage class (Hexagon) - extends PlayerBase

// ============================================================================
// MAGE CONFIGURATION - Adjust these values for game balancing
// ============================================================================

const MAGE_CONFIG = {
    // Base Stats (from CLASS_DEFINITIONS)
    baseHp: 80,                    // Starting health points
    baseDamage: 12,                // Base damage per attack
    baseSpeed: 207,                // Movement speed (pixels/second)
    baseDefense: 0,                // Damage reduction (0-1 range)
    critChance: 0,                 // Critical hit chance (0 = 0%)
    
    // Level Up Bonuses (per upgrade level purchased in nexus)
    damagePerLevel: 0.5,           // Damage increase per level
    defensePerLevel: 0.005,        // Defense increase per level (0.005 = 0.5%)
    speedPerLevel: 2,              // Speed increase per level (pixels/second)
    
    // Basic Attack (Magic Bolt)
    boltSpeed: 400,                // Projectile speed (pixels/second)
    boltLifetime: 1.28,            // How long bolt travels (seconds) - reduced by 20% from 1.6
    boltSize: 10,                  // Bolt projectile size (pixels)
    boltSpreadAngle: Math.PI / 24, // Spread angle for multiple projectiles (7.5 degrees) - reduced for better accuracy
    multishotDamageMultiplier: 0.5, // Damage multiplier for multishot projectiles (50% damage per projectile)
    multishotRangeMultiplier: 0.75, // Range multiplier for multishot projectiles (75% range - shotgun-like)
    
    // Heavy Attack (Energy Beam)
    heavyAttackCooldown: 2.415,    // Cooldown for heavy attack (seconds) - increased by 5%
    beamDuration: 1.5,             // Total beam fire time (seconds)
    beamTickRate: 0.2,             // Time between damage ticks (seconds)
    beamDamagePerTick: 0.4,        // Damage multiplier per tick (reduced from 0.5)
    beamRange: 800,                // Beam range (pixels) - matches bolt range
    beamWidth: 30,                 // Beam hitbox width (pixels)
    beamMaxPenetration: 2,         // Max enemies beam can pass through
    beamCharges: 2,                // Number of beam charges available
    
    // Special Ability (Blink)
    specialCooldown: 5.0,          // Special ability cooldown (seconds)
    blinkRange: 250,               // Maximum blink distance (pixels)
    blinkDecoyDuration: 2.0,       // How long decoy lasts (seconds) - NOT USED, decoy uses health
    blinkDecoyMaxHealth: 30,       // Starting health for decoy
    blinkDecoyHealthDecay: 8,      // HP lost per second for decoy
    blinkExplosionDuration: 0.3,   // Duration of explosion animation (seconds)
    blinkExplosionDamage: 2.0,     // Damage multiplier for blink explosion
    blinkExplosionRadius: 60,      // Radius of blink explosion (pixels)
    blinkExplosionKnockback: 250,  // Knockback force of blink explosion (pixels)
    blinkKnockbackDecay: 5.0,      // Knockback decay rate (per second)
    
    // Descriptions for UI (tooltips, character sheet)
    descriptions: {
        playstyle: "Ranged attacker with beam and mobility",
        basic: "Magic Bolt - Fast projectile attack",
        heavy: "Energy Beam (2 charges) - {beamRange}px range, {beamDamagePerTick|mult} tick rate.",
        special: "Blink + Nova - Teleport {blinkRange}px with i-frames, leaves decoy",
        passive: "Range Bonus - Increased damage at range",
        baseStats: "High Base Damage, Ranged Focus"
    }
};

class Mage extends PlayerBase {
    constructor(x = 400, y = 300) {
        super(x, y);
        
        // Set class identifier
        this.playerClass = 'hexagon';
        
        // Load class definition (visual properties only)
        const classDef = CLASS_DEFINITIONS.hexagon;
        
        // Load upgrades from save system
        let upgradeBonuses = { damage: 0, defense: 0, speed: 0 };
        if (typeof SaveSystem !== 'undefined') {
            const upgrades = SaveSystem.getUpgrades('hexagon');
            // Calculate bonuses using config values
            upgradeBonuses.damage = upgrades.damage * MAGE_CONFIG.damagePerLevel;
            upgradeBonuses.defense = upgrades.defense * MAGE_CONFIG.defensePerLevel;
            upgradeBonuses.speed = upgrades.speed * MAGE_CONFIG.speedPerLevel;
        }
        
        // Set base stats from CONFIG (single source of truth)
        this.baseDamage = MAGE_CONFIG.baseDamage + upgradeBonuses.damage;
        this.baseMoveSpeed = MAGE_CONFIG.baseSpeed + upgradeBonuses.speed;
        this.initialBaseMoveSpeed = this.baseMoveSpeed; // Store original for level scaling
        this.baseDefense = MAGE_CONFIG.baseDefense + upgradeBonuses.defense;
        this.baseMaxHp = MAGE_CONFIG.baseHp; // Store base max HP for gear calculations
        this.maxHp = MAGE_CONFIG.baseHp;
        this.hp = MAGE_CONFIG.baseHp;
        this.baseCritChance = MAGE_CONFIG.critChance || 0; // Store base for updateEffectiveStats
        this.critChance = MAGE_CONFIG.critChance || 0;
        this.color = classDef.color;
        this.shape = classDef.shape;
        this.syncBaseStatAnchors();
        
        // Standard single dodge for Mage
        this.baseDodgeCharges = 1; // Store base value for updateEffectiveStats
        this.dodgeCharges = 1;
        this.maxDodgeCharges = 1;
        this.dodgeChargeCooldowns = [0];
        
        // Heavy attack cooldown and charges
        this.heavyAttackCooldownTime = MAGE_CONFIG.heavyAttackCooldown;
        this.heavyAttackWindup = 0; // Instant fire for beam (no windup)
        this.beamCharges = MAGE_CONFIG.beamCharges;
        this.maxBeamCharges = MAGE_CONFIG.beamCharges;
        this.beamChargeCooldowns = [0, 0]; // Track cooldown per charge
        
        // Blink special ability - decoy system
        this.blinkDecoyActive = false;
        this.blinkDecoyX = 0;
        this.blinkDecoyY = 0;
        this.blinkDecoyHealth = 0;
        this.blinkDecoyMaxHealth = MAGE_CONFIG.blinkDecoyMaxHealth;
        this.blinkDecoyHealthDecay = MAGE_CONFIG.blinkDecoyHealthDecay;
        
        // Blink explosion at destination
        this.blinkExplosionActive = false;
        this.blinkExplosionElapsed = 0;
        this.blinkExplosionDuration = MAGE_CONFIG.blinkExplosionDuration;
        this.blinkExplosionX = 0;
        this.blinkExplosionY = 0;
        
        // Blink knockback (from explosion)
        this.blinkKnockbackVx = 0;
        this.blinkKnockbackVy = 0;
        
        // Blink preview system
        this.blinkPreviewActive = false;
        this.blinkPreviewX = 0;
        this.blinkPreviewY = 0;
        this.blinkPreviewDistance = 0;
        
        // Class modifier storage
        this.projectileCountBonus = 0;
        this.blinkRangeBonus = 0;
        this.blinkDamageMultiplier = 1.0;
        this.aoeRadiusBonus = 0;
        
        // Beam heavy attack state - support multiple simultaneous beams
        this.activeBeams = []; // Array of active beam objects
        
        // Update effective stats
        this.updateEffectiveStats();
        
        console.log('Mage class initialized');
    }
    
    // Override updateEffectiveStats to apply beam bonuses
    updateEffectiveStats() {
        // Reset class modifier storage
        this.projectileCountBonus = 0;
        this.blinkRangeBonus = 0;
        this.blinkDamageMultiplier = 1.0;
        this.aoeRadiusBonus = 0;
        
        // Call parent first
        super.updateEffectiveStats();
        
        // Apply beam charge bonuses and resize cooldown array if needed
        const newMaxBeamCharges = MAGE_CONFIG.beamCharges + this.bonusBeamCharges;
        if (newMaxBeamCharges !== this.maxBeamCharges) {
            const oldMaxBeamCharges = this.maxBeamCharges;
            this.maxBeamCharges = newMaxBeamCharges;
            
            // Resize cooldown array
            const oldCooldowns = this.beamChargeCooldowns || [];
            this.beamChargeCooldowns = new Array(this.maxBeamCharges).fill(0);
            
            // Copy over existing cooldowns
            for (let i = 0; i < Math.min(oldCooldowns.length, this.maxBeamCharges); i++) {
                this.beamChargeCooldowns[i] = oldCooldowns[i];
            }
            
            // Grant extra charges when max increases (e.g., from 2 to 3, grant 1 charge)
            const chargeIncrease = this.maxBeamCharges - oldMaxBeamCharges;
            if (chargeIncrease > 0) {
                this.beamCharges = Math.min((this.beamCharges || 0) + chargeIncrease, this.maxBeamCharges);
            } else {
                // If max decreased, clamp current charges
                this.beamCharges = Math.min(this.beamCharges || 0, this.maxBeamCharges);
            }
        }
        
        // Apply tick rate and duration multipliers
        this.effectiveBeamTickRate = MAGE_CONFIG.beamTickRate * Math.max(0.1, this.beamTickRateMultiplier);
        this.effectiveBeamDuration = MAGE_CONFIG.beamDuration * this.beamDurationMultiplier;
        
        // Apply penetration bonus
        this.effectiveBeamMaxPenetration = MAGE_CONFIG.beamMaxPenetration + this.bonusBeamPenetration;
    }
    
    // Override to apply Mage-specific class modifiers
    applyClassModifier(modifier) {
        // Call parent for universal modifiers
        super.applyClassModifier(modifier);
        
        // Handle Mage-specific modifiers
        if (modifier.class === 'hexagon') {
            switch(modifier.type) {
                case 'projectile_count':
                    this.projectileCountBonus += modifier.value;
                    break;
                case 'blink_range':
                    this.blinkRangeBonus += modifier.value;
                    break;
                case 'blink_damage':
                    this.blinkDamageMultiplier += modifier.value;
                    break;
                case 'aoe_radius':
                    this.aoeRadiusBonus += modifier.value;
                    break;
                case 'beam_charges':
                    this.bonusBeamCharges += modifier.value;
                    break;
                case 'beam_tick_rate':
                    this.beamTickRateMultiplier -= modifier.value;
                    break;
                case 'beam_duration':
                    this.beamDurationMultiplier += modifier.value;
                    break;
                case 'beam_penetration':
                    this.bonusBeamPenetration += modifier.value;
                    break;
            }
        }
    }
    
    // Override applyHeavyAttackCooldown to use charge system
    applyHeavyAttackCooldown() {
        // Don't use base cooldown, use our charge system instead
        // Consume a charge
        this.beamCharges--;
        
        // Find the first available charge slot and start its cooldown
        for (let i = 0; i < this.maxBeamCharges; i++) {
            if (this.beamChargeCooldowns[i] <= 0) {
                // Apply attack speed and weapon type to heavy attack cooldown
                const weaponCooldownMult = this.weaponCooldownMultiplier || 1.0;
                const effectiveHeavyCooldown = this.heavyAttackCooldownTime * weaponCooldownMult / (1 + (this.attackSpeedMultiplier - 1));
                
                // Overcharge: Chance to refund charge
                if (this.overchargeChance && this.overchargeChance > 0 && Math.random() < this.overchargeChance) {
                    console.log('[Overcharge] Beam charge refunded!');
                    this.beamChargeCooldowns[i] = 0;
                    this.beamCharges++; // Refund the charge
                } else {
                    this.beamChargeCooldowns[i] = effectiveHeavyCooldown;
                }
                break;
            }
        }
    }
    
    // Override executeAttack for Mage projectile
    executeAttack(input) {
        this.shootProjectile(input);
        
        // Reset cooldown and set attacking state with attack speed and weapon type
        const weaponCooldownMult = this.weaponCooldownMultiplier || 1.0;
        const effectiveAttackCooldown = this.attackCooldownTime * weaponCooldownMult / (1 + (this.attackSpeedMultiplier - 1));
        this.attackCooldown = effectiveAttackCooldown;
        this.isAttacking = true;
        
        // Clear attacking state after duration
        setTimeout(() => {
            this.isAttacking = false;
        }, this.attackDuration * 1000);
    }
    
    shootProjectile(input) {
        // Play mage basic attack sound
        if (typeof AudioManager !== 'undefined' && AudioManager.sounds) {
            AudioManager.sounds.mageBasicAttack();
        }
        
        // Mage: Shoot magic bolt
        if (typeof Game === 'undefined') return;
        
        // Get gameplay position (authoritative position in multiplayer)
        const pos = this.getGameplayPosition();
        
        // Use character rotation (already correctly calculated from mouse/joystick)
        const dirX = Math.cos(this.rotation);
        const dirY = Math.sin(this.rotation);
        
        // Fire multiple projectiles if projectile count bonus is active
        const numProjectiles = 1 + this.projectileCountBonus + (this.multishotCount || 0);
        const spreadAngle = MAGE_CONFIG.boltSpreadAngle;
        const isMultishot = numProjectiles > 1;
        
        // Apply multishot multipliers (damage and range reduction for shotgun-like behavior)
        const damageMultiplier = isMultishot ? MAGE_CONFIG.multishotDamageMultiplier : 1.0;
        const rangeMultiplier = isMultishot ? MAGE_CONFIG.multishotRangeMultiplier : 1.0;
        
        for (let i = 0; i < numProjectiles; i++) {
            // Calculate angle for this projectile
            const angleOffset = numProjectiles > 1 ? (i - (numProjectiles - 1) / 2) * spreadAngle : 0;
            const angle = Math.atan2(dirY, dirX) + angleOffset;
            const projDirX = Math.cos(angle);
            const projDirY = Math.sin(angle);
            
            Game.projectiles.push({
                x: pos.x,
                y: pos.y,
                vx: projDirX * MAGE_CONFIG.boltSpeed * (this.projectileSpeedMultiplier || 1.0),
                vy: projDirY * MAGE_CONFIG.boltSpeed * (this.projectileSpeedMultiplier || 1.0),
                damage: this.damage * damageMultiplier,
                size: MAGE_CONFIG.boltSize,
                lifetime: MAGE_CONFIG.boltLifetime * rangeMultiplier,
                elapsed: 0,
                type: 'magic',
                color: this.color,
                playerId: this.playerId || (typeof Game !== 'undefined' && Game.getLocalPlayerId ? Game.getLocalPlayerId() : null) // For damage attribution
            });
        }
    }
    
    // Override createHeavyAttack for energy beam
    createHeavyAttack() {
        // Play mage heavy attack beam sound
        if (typeof AudioManager !== 'undefined' && AudioManager.sounds) {
            AudioManager.sounds.mageHeavyAttackBeam();
        }
        
        // Get gameplay position (authoritative position in multiplayer)
        const pos = this.getGameplayPosition();
        
        // Create a new beam object
        const newBeam = {
            elapsed: 0,
            lastTickTime: 0,
            origin: { x: pos.x, y: pos.y },
            direction: {
                x: Math.cos(this.rotation),
                y: Math.sin(this.rotation)
            },
            hitEnemies: new Map(), // Track hit count per enemy for this beam
            playerId: this.playerId || (typeof Game !== 'undefined' && Game.getLocalPlayerId ? Game.getLocalPlayerId() : null) // For damage attribution
        };
        
        // Add to active beams array
        this.activeBeams.push(newBeam);
        
        this.isAttacking = true;
        
        // Trigger screen shake
        if (typeof Game !== 'undefined') {
            Game.triggerScreenShake(0.3, 0.15);
        }
    }
    
    // Override handleSpecialAbility for blink preview behavior
    handleSpecialAbility(input) {
        // Check for special ability input (Spacebar or touch button)
        let specialJustPressed = false;
        let specialPressed = false;
        
        if (input.isTouchMode && input.isTouchMode()) {
            // Touch mode: check for special ability button
            if (input.touchButtons && input.touchButtons.specialAbility) {
                const button = input.touchButtons.specialAbility;
                specialPressed = button.pressed;
                
                // Blink: press-and-release (directional, one-time)
                specialJustPressed = button.justReleased;
                
                // Show preview while holding
                if (button.pressed && this.specialCooldown <= 0 && !this.blinkDecoyActive) {
                    this.updateBlinkPreview(input);
                }
                // Don't clear preview on release - it will be cleared in activateBlink after use
            }
        } else {
            // Keyboard/mouse mode: check for Spacebar
            const spaceJustPressed = input.getKeyState(' ') && !this.lastSpacebar;
            this.lastSpacebar = input.getKeyState(' ');
            specialJustPressed = spaceJustPressed;
            specialPressed = input.getKeyState(' ');
            
            // Show preview for blink while spacebar held
            if (specialPressed && this.specialCooldown <= 0 && !this.blinkDecoyActive) {
                this.updateBlinkPreview(input);
            } else if (!specialPressed && !specialJustPressed) {
                // Only clear preview if spacebar was released earlier (not on the frame it's released)
                this.blinkPreviewActive = false;
            }
        }
        
        // Check if cooldown ready and not already using another ability
        if (specialJustPressed && this.specialCooldown <= 0) {
            // For hexagon blink, update preview one last time before activating
            if (input.isTouchMode && input.isTouchMode()) {
                this.updateBlinkPreview(input);
            }
            
            // Activate blink
            this.activateBlink(input);
        }
    }
    
    // Override activateSpecialAbility for blink
    activateSpecialAbility(input) {
        this.activateBlink(input);
    }
    
    updateBlinkPreview(input) {
        this.blinkPreviewActive = true;
        
        // Get target position based on input method
        let targetX, targetY;
        let distance = 400; // Max blink range
        
        if (input.isTouchMode && input.isTouchMode() && input.touchJoysticks && input.touchJoysticks.specialAbility) {
            // Touch mode: use joystick direction and magnitude
            const joystick = input.touchJoysticks.specialAbility;
            if (joystick.active && joystick.getMagnitude() > 0.1) {
                const dir = joystick.getDirection();
                const mag = joystick.getMagnitude();
                // Distance scales with magnitude: 0.2 magnitude = 80px, 1.0 magnitude = 400px
                distance = 80 + (mag * 320); // Range from 80px to 400px
                targetX = this.x + dir.x * distance;
                targetY = this.y + dir.y * distance;
            } else {
                // Joystick not active, use facing direction with minimum distance
                targetX = this.x + Math.cos(this.rotation) * 200;
                targetY = this.y + Math.sin(this.rotation) * 200;
                distance = 200;
            }
        } else {
            // Mouse mode: use world mouse position (accounts for camera)
            const worldMouse = Input.getWorldMousePos ? Input.getWorldMousePos() : input.mouse;
            const mouseX = worldMouse.x || this.x;
            const mouseY = worldMouse.y || this.y;
            const dx = mouseX - this.x;
            const dy = mouseY - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist > 0) {
                distance = Math.min(400, dist);
                const angle = Math.atan2(dy, dx);
                targetX = this.x + Math.cos(angle) * distance;
                targetY = this.y + Math.sin(angle) * distance;
            } else {
                targetX = this.x + Math.cos(this.rotation) * 200;
                targetY = this.y + Math.sin(this.rotation) * 200;
                distance = 200;
            }
        }
        
        // Clamp to bounds
        if (typeof Game !== 'undefined' && Game.canvas) {
            // Use room bounds instead of canvas bounds
            const roomWidth = (typeof currentRoom !== 'undefined' && currentRoom) ? currentRoom.width : Game.canvas.width;
            const roomHeight = (typeof currentRoom !== 'undefined' && currentRoom) ? currentRoom.height : Game.canvas.height;
            targetX = clamp(targetX, this.size, roomWidth - this.size);
            targetY = clamp(targetY, this.size, roomHeight - this.size);
        }
        
        this.blinkPreviewX = targetX;
        this.blinkPreviewY = targetY;
        this.blinkPreviewDistance = distance;
    }
    
    activateBlink(input) {
        // Play mage blink sound
        if (typeof AudioManager !== 'undefined' && AudioManager.sounds) {
            AudioManager.sounds.mageBlink();
        }
        
        // Save old position for decoy
        const oldX = this.x;
        const oldY = this.y;
        
        // Get target position (use preview if available, otherwise calculate)
        let targetX, targetY;
        let usedPreview = false;
        
        // For touch mode, prioritize stored joystick state from button release
        if (input.isTouchMode && input.isTouchMode()) {
            // Check if button has stored final joystick state (captured on release)
            const button = input.touchButtons && input.touchButtons.specialAbility;
            if (button && button.finalJoystickState) {
                // Use the stored joystick state from when button was released
                const state = button.finalJoystickState;
                if (state.magnitude > 0.1) {
                    const distance = 80 + (state.magnitude * 320);
                    targetX = this.x + state.direction.x * distance;
                    targetY = this.y + state.direction.y * distance;
                    // Clear the stored state after using it
                    button.finalJoystickState = null;
                } else {
                    // Magnitude too low, use preview or fallback
                    const previewDistance = Math.sqrt(
                        (this.blinkPreviewX - this.x) ** 2 + 
                        (this.blinkPreviewY - this.y) ** 2
                    );
                    if (this.blinkPreviewActive || previewDistance > 20) {
                        targetX = this.blinkPreviewX;
                        targetY = this.blinkPreviewY;
                        usedPreview = true;
                    } else {
                        targetX = this.x + Math.cos(this.rotation) * 200;
                        targetY = this.y + Math.sin(this.rotation) * 200;
                    }
                    button.finalJoystickState = null;
                }
            } else {
                // No stored state, check preview position
                const previewDistance = Math.sqrt(
                    (this.blinkPreviewX - this.x) ** 2 + 
                    (this.blinkPreviewY - this.y) ** 2
                );
                
                if (this.blinkPreviewActive || previewDistance > 20) {
                    // Use preview position
                    targetX = this.blinkPreviewX;
                    targetY = this.blinkPreviewY;
                    usedPreview = true;
                } else if (input.touchJoysticks && input.touchJoysticks.specialAbility) {
                    // Preview not active, try to use current joystick state
                    const joystick = input.touchJoysticks.specialAbility;
                    if (joystick.active && joystick.getMagnitude() > 0.1) {
                        const dir = joystick.getDirection();
                        const mag = joystick.getMagnitude();
                        const distance = 80 + (mag * 320);
                        targetX = this.x + dir.x * distance;
                        targetY = this.y + dir.y * distance;
                    } else {
                        // Fallback: use facing direction with default distance
                        targetX = this.x + Math.cos(this.rotation) * 200;
                        targetY = this.y + Math.sin(this.rotation) * 200;
                    }
                } else {
                    // Fallback: use facing direction
                    targetX = this.x + Math.cos(this.rotation) * 200;
                    targetY = this.y + Math.sin(this.rotation) * 200;
                }
            }
        } else {
            // Mouse mode: use preview if available, otherwise mouse position
            if (this.blinkPreviewActive) {
                targetX = this.blinkPreviewX;
                targetY = this.blinkPreviewY;
                usedPreview = true;
            } else {
                // Mouse mode: use world mouse position (accounts for camera)
                const worldMouse = Input.getWorldMousePos ? Input.getWorldMousePos() : input.mouse;
                const mouseX = worldMouse.x || this.x;
                const mouseY = worldMouse.y || this.y;
                targetX = mouseX;
                targetY = mouseY;
            }
        }
        
        // Clear preview after using it
        this.blinkPreviewActive = false;
        
        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        let newX, newY;
        const maxBlinkRange = 400 + this.blinkRangeBonus; // Apply class modifier
        if (distance > maxBlinkRange) {
            // Clamp to max range
            const angle = Math.atan2(dy, dx);
            newX = this.x + Math.cos(angle) * maxBlinkRange;
            newY = this.y + Math.sin(angle) * maxBlinkRange;
        } else {
            newX = targetX;
            newY = targetY;
        }
        
        // Clamp to bounds
        if (typeof Game !== 'undefined' && Game.canvas) {
            // Use room bounds instead of canvas bounds
            const roomWidth = (typeof currentRoom !== 'undefined' && currentRoom) ? currentRoom.width : Game.canvas.width;
            const roomHeight = (typeof currentRoom !== 'undefined' && currentRoom) ? currentRoom.height : Game.canvas.height;
            this.x = clamp(newX, this.size, roomWidth - this.size);
            this.y = clamp(newY, this.size, roomHeight - this.size);
        } else {
            this.x = newX;
            this.y = newY;
        }
        
        // Create decoy at old position with full health
        this.blinkDecoyActive = true;
        this.blinkDecoyX = oldX;
        this.blinkDecoyY = oldY;
        this.blinkDecoyHealth = this.blinkDecoyMaxHealth;
        
        // Clear enemy target locks for enemies within detection range of the decoy
        // This provides proximity-based aggro for the decoy
        if (typeof Game !== 'undefined' && Game.enemies) {
            Game.enemies.forEach(enemy => {
                if (!enemy.alive) return;
                
                // Check if enemy is within detection range of the decoy
                const dx = oldX - enemy.x;
                const dy = oldY - enemy.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                // Only clear lock if nearby AND enemy was targeting this player
                if (distance <= enemy.detectionRange && enemy.targetLock && enemy.targetLock.playerRef === this) {
                    enemy.targetLock = null;
                    enemy.targetLockTimer = 0;
                }
            });
        }
        
        // Create explosion at new position
        this.blinkExplosionActive = true;
        this.blinkExplosionElapsed = 0;
        this.blinkExplosionX = newX;
        this.blinkExplosionY = newY;
        this.blinkHasChainedLegendary = false; // Reset chain flag for this blink
        
        // Deal damage at destination
        if (typeof Game !== 'undefined' && Game.enemies) {
            const explosionRadius = MAGE_CONFIG.blinkExplosionRadius + this.aoeRadiusBonus; // Apply class modifier
            const baseExplosionDamage = this.damage * MAGE_CONFIG.blinkExplosionDamage * this.blinkDamageMultiplier; // Apply class modifier
            
            Game.enemies.forEach(enemy => {
                if (enemy.alive) {
                    const dx = enemy.x - this.x;
                    const dy = enemy.y - this.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance < explosionRadius) {
                        // Check for crit
                        const isCrit = Math.random() < this.critChance;
                        const critMultiplier = isCrit ? (2.0 * (this.critDamageMultiplier || 1.0)) : 1.0;
                        const explosionDamage = baseExplosionDamage * critMultiplier;
                        
                        // Calculate damage dealt BEFORE applying damage
                        const damageDealt = Math.min(explosionDamage, enemy.hp);
                        
                        // Get player ID for damage attribution
                        const attackerId = this.playerId || (typeof Game !== 'undefined' && Game.getLocalPlayerId ? Game.getLocalPlayerId() : null);
                        
                        enemy.takeDamage(explosionDamage, attackerId);
                        
                        // Track stats (host/solo only)
                        const isClient = typeof Game !== 'undefined' && Game.isMultiplayerClient && Game.isMultiplayerClient();
                        if (!isClient && typeof Game !== 'undefined' && Game.getPlayerStats && attackerId) {
                            const stats = Game.getPlayerStats(attackerId);
                            if (stats) {
                                stats.addStat('damageDealt', damageDealt);
                            }
                            
                            // Track kill if enemy died
                            if (enemy.hp <= 0) {
                                const killStats = Game.getPlayerStats(attackerId);
                                if (killStats) {
                                    killStats.addStat('kills', 1);
                                }
                            }
                        }
                        
                        // Apply lifesteal
                        if (typeof applyLifesteal !== 'undefined') {
                            applyLifesteal(this, damageDealt);
                        }
                        
                        // Apply legendary effects
                        if (typeof applyLegendaryEffects !== 'undefined') {
                            applyLegendaryEffects(this, enemy, damageDealt, attackerId);
                        }
                        // Chain lightning (only once per blink)
                        if (this.activeLegendaryEffects && !this.blinkHasChainedLegendary) {
                            this.activeLegendaryEffects.forEach(effect => {
                                if (effect.type === 'chain_lightning' && typeof chainLightningAttack !== 'undefined') {
                                    chainLightningAttack(this, enemy, effect, explosionDamage);
                                    this.blinkHasChainedLegendary = true;
                                }
                            });
                        }
                        
                        if (typeof createDamageNumber !== 'undefined') {
                            createDamageNumber(enemy.x, enemy.y, damageDealt, isCrit, false);
                            
                            // In multiplayer, send damage number event to clients
                            if (typeof Game !== 'undefined' && Game.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager) {
                                multiplayerManager.send({
                                    type: 'damage_number',
                                    data: {
                                        enemyId: enemy.id,
                                        x: enemy.x,
                                        y: enemy.y,
                                        damage: Math.floor(damageDealt),
                                        isCrit: isCrit,
                                        isWeakPoint: false
                                    }
                                });
                            }
                        }
                        
                        // Push enemies away from explosion
                        const pushForce = MAGE_CONFIG.blinkExplosionKnockback;
                        const pushDirX = (enemy.x - this.x) / distance;
                        const pushDirY = (enemy.y - this.y) / distance;
                        enemy.applyKnockback(pushDirX * pushForce, pushDirY * pushForce);
                    }
                }
            });
        }
        
        // Apply cooldown reduction
        const effectiveSpecialCooldown = this.specialCooldownTime * (1 - this.cooldownReduction);
        this.specialCooldown = effectiveSpecialCooldown;
        this.invulnerable = true;
        this.invulnerabilityTime = 1.2; // 1.2s post-teleport i-frames for safer dashing through enemies
        console.log('Blink activated!');
    }
    
    // Override updateClassAbilities for Mage-specific updates
    updateClassAbilities(deltaTime, input) {
        // Update beam charge cooldowns
        for (let i = 0; i < this.maxBeamCharges; i++) {
            if (this.beamChargeCooldowns[i] > 0) {
                this.beamChargeCooldowns[i] -= deltaTime;
                
                // Regenerate charge when cooldown expires
                if (this.beamChargeCooldowns[i] <= 0) {
                    this.beamChargeCooldowns[i] = 0;
                    if (this.beamCharges < this.maxBeamCharges) {
                        this.beamCharges++;
                    }
                }
            }
        }
        
        // Sync heavyAttackCooldown with charge system for UI and base class checks
        // Set to 0 if we have charges, otherwise use the longest active cooldown
        if (this.beamCharges > 0) {
            this.heavyAttackCooldown = 0;
        } else {
            // Find longest cooldown for UI display
            this.heavyAttackCooldown = Math.max(...this.beamChargeCooldowns);
        }
        
        // Update blink decoy - health decay system
        if (this.blinkDecoyActive) {
            // Health decay over time
            this.blinkDecoyHealth -= this.blinkDecoyHealthDecay * deltaTime;
            
            // Deactivate decoy if health depleted
            if (this.blinkDecoyHealth <= 0) {
                this.blinkDecoyActive = false;
                this.blinkDecoyHealth = 0;
            }
        }
        
        // Check for damage to blink decoy from enemy projectiles
        if (this.blinkDecoyActive && typeof Game !== 'undefined' && Game.projectiles) {
            Game.projectiles.forEach(projectile => {
                // Skip player projectiles
                if (projectile.type === 'magic' || projectile.playerClass) return;
                
                const dx = projectile.x - this.blinkDecoyX;
                const dy = projectile.y - this.blinkDecoyY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                // Check collision with decoy (use player size as decoy size)
                if (distance < this.size + (projectile.size || 5)) {
                    // Decoy takes damage from projectile
                    this.blinkDecoyHealth -= projectile.damage || 10;
                    // Mark projectile as hit so it gets removed
                    projectile.lifetime = 0;
                    
                    // Deactivate decoy if health depleted
                    if (this.blinkDecoyHealth <= 0) {
                        this.blinkDecoyActive = false;
                        this.blinkDecoyHealth = 0;
                    }
                }
            });
        }
        
        // Update blink explosion animation
        if (this.blinkExplosionActive) {
            this.blinkExplosionElapsed += deltaTime;
            
            if (this.blinkExplosionElapsed >= this.blinkExplosionDuration) {
                this.blinkExplosionActive = false;
                this.blinkExplosionElapsed = 0;
            }
        }
        
        // Apply blink knockback if active
        if (this.blinkKnockbackVx !== 0 || this.blinkKnockbackVy !== 0) {
            this.x += this.blinkKnockbackVx * deltaTime;
            this.y += this.blinkKnockbackVy * deltaTime;
            
            // Decay knockback
            this.blinkKnockbackVx *= 0.85;
            this.blinkKnockbackVy *= 0.85;
            
            if (Math.abs(this.blinkKnockbackVx) < 1) this.blinkKnockbackVx = 0;
            if (Math.abs(this.blinkKnockbackVy) < 1) this.blinkKnockbackVy = 0;
        }
        
        // Update all active beams
        for (let i = this.activeBeams.length - 1; i >= 0; i--) {
            const beam = this.activeBeams[i];
            beam.elapsed += deltaTime;
            beam.lastTickTime += deltaTime;
            
            // Use effective beam duration (with affixes)
            const effectiveDuration = this.effectiveBeamDuration || MAGE_CONFIG.beamDuration;
            const effectiveTickRate = this.effectiveBeamTickRate || MAGE_CONFIG.beamTickRate;
            
            // Check if beam duration expired
            if (beam.elapsed >= effectiveDuration) {
                // Remove expired beam
                this.activeBeams.splice(i, 1);
                // Update isAttacking state
                if (this.activeBeams.length === 0) {
                    this.isAttacking = false;
                }
            } else if (beam.lastTickTime >= effectiveTickRate) {
                // Process damage tick for this beam
                this.processBeamDamageTick(beam);
                beam.lastTickTime = 0;
            }
        }
    }
    
    // Calculate visual endpoint for beam based on penetration
    calculateBeamVisualEndpoint(beam) {
        if (typeof Game === 'undefined' || !Game.enemies) {
            return { 
                endX: beam.origin.x + beam.direction.x * MAGE_CONFIG.beamRange,
                endY: beam.origin.y + beam.direction.y * MAGE_CONFIG.beamRange,
                enemiesHit: 0
            };
        }
        
        const beamRange = MAGE_CONFIG.beamRange;
        const beamWidth = MAGE_CONFIG.beamWidth;
        const maxPenetration = this.effectiveBeamMaxPenetration || MAGE_CONFIG.beamMaxPenetration;
        
        // Find all enemies in beam path
        const hitCandidates = [];
        
        Game.enemies.forEach(enemy => {
            if (!enemy.alive) return;
            
            // Calculate point-to-line distance
            const dx = enemy.x - beam.origin.x;
            const dy = enemy.y - beam.origin.y;
            
            // Project enemy position onto beam direction
            const projection = dx * beam.direction.x + dy * beam.direction.y;
            
            // Check if enemy is in range
            if (projection < 0 || projection > beamRange) return;
            
            // Calculate perpendicular distance to beam line
            const perpX = dx - projection * beam.direction.x;
            const perpY = dy - projection * beam.direction.y;
            const perpDist = Math.sqrt(perpX * perpX + perpY * perpY);
            
            // Check if within beam width
            if (perpDist <= beamWidth / 2 + enemy.size) {
                hitCandidates.push({ enemy, distance: projection });
            }
        });
        
        // Sort by distance (closest first)
        hitCandidates.sort((a, b) => a.distance - b.distance);
        
        // Determine actual endpoint
        let actualEndDistance = beamRange;
        let enemiesHit = 0;
        
        if (hitCandidates.length > maxPenetration) {
            // More enemies than we can penetrate - stop at the last penetrated enemy
            actualEndDistance = hitCandidates[maxPenetration - 1].distance + 10; // Slight overshoot
            enemiesHit = maxPenetration;
        } else if (hitCandidates.length > 0) {
            // Fewer enemies than max penetration - beam goes through all
            enemiesHit = hitCandidates.length;
        }
        
        return {
            endX: beam.origin.x + beam.direction.x * actualEndDistance,
            endY: beam.origin.y + beam.direction.y * actualEndDistance,
            enemiesHit: enemiesHit
        };
    }
    
    processBeamDamageTick(beam) {
        if (typeof Game === 'undefined' || !Game.enemies) return;
        
        const beamRange = MAGE_CONFIG.beamRange;
        const beamWidth = MAGE_CONFIG.beamWidth;
        const maxPenetration = this.effectiveBeamMaxPenetration || MAGE_CONFIG.beamMaxPenetration;
        const baseTickDamage = this.damage * MAGE_CONFIG.beamDamagePerTick;
        
        // Find enemies in beam path, sorted by distance
        const hitCandidates = [];
        
        Game.enemies.forEach(enemy => {
            if (!enemy.alive) return;
            
            // Calculate point-to-line distance
            const dx = enemy.x - beam.origin.x;
            const dy = enemy.y - beam.origin.y;
            
            // Project enemy position onto beam direction
            const projection = dx * beam.direction.x + dy * beam.direction.y;
            
            // Check if enemy is in range
            if (projection < 0 || projection > beamRange) return;
            
            // Calculate perpendicular distance to beam line
            const perpX = dx - projection * beam.direction.x;
            const perpY = dy - projection * beam.direction.y;
            const perpDist = Math.sqrt(perpX * perpX + perpY * perpY);
            
            // Check if within beam width
            if (perpDist <= beamWidth / 2 + enemy.size) {
                hitCandidates.push({ enemy, distance: projection });
            }
        });
        
        // Sort by distance (closest first)
        hitCandidates.sort((a, b) => a.distance - b.distance);
        
        // Hit up to maxPenetration enemies
        let hitCount = 0;
        for (const candidate of hitCandidates) {
            const enemy = candidate.enemy;
            
            // Track how many times this enemy has been hit by this beam
            const currentHits = beam.hitEnemies.get(enemy) || 0;
            beam.hitEnemies.set(enemy, currentHits + 1);
            
            // Calculate distance-based damage falloff
            // Full damage at origin (0), reduced damage at max range
            // Linear falloff: 1.0 at 0px, ~0.1 at max range (90% reduction at far end)
            const distanceRatio = candidate.distance / beamRange;
            const damageFalloff = 1.0 - (distanceRatio * 0.9); // 100% at origin, 10% at max range
            const tickDamage = baseTickDamage * Math.max(0.1, damageFalloff); // Minimum 10% damage at max range
            
            // Check for crit
            const isCrit = Math.random() < this.critChance;
            const critMultiplier = isCrit ? (2.0 * (this.critDamageMultiplier || 1.0)) : 1.0;
            const finalDamage = tickDamage * critMultiplier;
            
            // Calculate actual damage dealt
            const damageDealt = Math.min(finalDamage, enemy.hp);
            
            // Get player ID from beam for damage attribution
            const attackerId = beam.playerId;
            
            enemy.takeDamage(finalDamage, attackerId);
            
            // Track damage stats for end scene (host/solo only)
            const isClient = typeof Game !== 'undefined' && Game.isMultiplayerClient && Game.isMultiplayerClient();
            if (!isClient && typeof Game !== 'undefined' && Game.getPlayerStats && attackerId) {
                const stats = Game.getPlayerStats(attackerId);
                if (stats) {
                    stats.addStat('damageDealt', damageDealt);
                }
                
                // Track kill if enemy died
                if (enemy.hp <= 0) {
                    const killStats = Game.getPlayerStats(attackerId);
                    if (killStats) {
                        killStats.addStat('kills', 1);
                    }
                }
            }
            
            // Apply lifesteal
            if (typeof applyLifesteal !== 'undefined') {
                applyLifesteal(this, damageDealt);
            }
            
            // Apply legendary effects (burn, freeze) and chain lightning
            if (typeof applyLegendaryEffects !== 'undefined') {
                applyLegendaryEffects(this, enemy, damageDealt, attackerId);
            }
            // Chain lightning (separate check to prevent multiple chains per beam)
            if (this.activeLegendaryEffects && !beam.hasChainedLegendary) {
                this.activeLegendaryEffects.forEach(effect => {
                    if (effect.type === 'chain_lightning' && typeof chainLightningAttack !== 'undefined') {
                        chainLightningAttack(this, enemy, effect, finalDamage);
                        beam.hasChainedLegendary = true;
                    }
                });
            }
            
            if (typeof createDamageNumber !== 'undefined') {
                createDamageNumber(enemy.x, enemy.y, damageDealt, isCrit, false);
                
                // In multiplayer, send damage number event to clients
                if (typeof Game !== 'undefined' && Game.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager) {
                    multiplayerManager.send({
                        type: 'damage_number',
                        data: {
                            enemyId: enemy.id,
                            x: enemy.x,
                            y: enemy.y,
                            damage: Math.floor(damageDealt),
                            isCrit: isCrit,
                            isWeakPoint: false
                        }
                    });
                }
            }
            
            hitCount++;
            if (hitCount >= maxPenetration) break;
        }
    }
    
    // Override renderClassVisuals for Mage-specific visuals
    renderClassVisuals(ctx) {
        // Draw blink decoy - semi-transparent clone at old position
        if (this.blinkDecoyActive) {
            // Calculate alpha based on decoy health (health-based fade)
            const healthPercent = this.blinkDecoyHealth / this.blinkDecoyMaxHealth;
            const decoyAlpha = 0.5 * healthPercent; // Fade out as health depletes
            const decoySize = this.size; // Keep constant size
            
            ctx.save();
            ctx.globalAlpha = decoyAlpha;
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.blinkDecoyX, this.blinkDecoyY, decoySize, 0, Math.PI * 2);
            ctx.fill();
            
            // Draw outline to make it more visible
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            ctx.restore();
            
            // Draw health bar above decoy (not rotated)
            ctx.save();
            ctx.globalAlpha = decoyAlpha;
            
            // healthPercent already defined above
            const barWidth = this.size * 2;
            const barHeight = 4;
            const barX = this.blinkDecoyX - barWidth / 2;
            const barY = this.blinkDecoyY - this.size - 10;
            
            // Background (red)
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(barX, barY, barWidth, barHeight);
            
            // Foreground (blue, scaled by health)
            ctx.fillStyle = healthPercent > 0.5 ? '#00aaff' : (healthPercent > 0.25 ? '#ffaa00' : '#ff0000');
            ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);
            
            // Border
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.strokeRect(barX, barY, barWidth, barHeight);
            
            ctx.restore();
        }
        
        // Draw blink preview - shows teleport destination while aiming
        if (this.blinkPreviewActive) {
            ctx.save();
            
            // Draw line from player to destination
            ctx.strokeStyle = 'rgba(150, 200, 255, 0.6)';
            ctx.lineWidth = 3;
            ctx.setLineDash([5, 5]); // Dashed line
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.blinkPreviewX, this.blinkPreviewY);
            ctx.stroke();
            ctx.setLineDash([]); // Reset dash
            
            // Draw destination indicator (pulsing circle)
            const pulse = Math.sin(Date.now() / 150) * 0.3 + 0.7; // Pulse between 0.4 and 1.0
            const indicatorRadius = 15 * pulse;
            
            // Outer glow
            ctx.fillStyle = `rgba(150, 200, 255, ${0.4 * pulse})`;
            ctx.beginPath();
            ctx.arc(this.blinkPreviewX, this.blinkPreviewY, indicatorRadius + 5, 0, Math.PI * 2);
            ctx.fill();
            
            // Inner circle
            ctx.fillStyle = `rgba(200, 220, 255, ${0.8 * pulse})`;
            ctx.beginPath();
            ctx.arc(this.blinkPreviewX, this.blinkPreviewY, indicatorRadius, 0, Math.PI * 2);
            ctx.fill();
            
            // Border
            ctx.strokeStyle = `rgba(255, 255, 255, ${pulse})`;
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Draw distance indicator (small text showing distance)
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(`${Math.round(this.blinkPreviewDistance)}px`, this.blinkPreviewX, this.blinkPreviewY + indicatorRadius + 8);
            
            ctx.restore();
        }
        
        // Draw blink explosion - expanding circle at destination
        if (this.blinkExplosionActive) {
            const explosionProgress = this.blinkExplosionElapsed / this.blinkExplosionDuration;
            const maxRadius = 80;
            
            ctx.save();
            
            // Multiple expanding rings for more dramatic effect
            for (let i = 0; i < 3; i++) {
                const offsetProgress = Math.max(0, explosionProgress - i * 0.2);
                const radius = maxRadius * offsetProgress;
                const alpha = (1 - explosionProgress) * 0.6;
                
                // Outer glow
                ctx.fillStyle = `rgba(150, 100, 255, ${alpha})`;
                ctx.beginPath();
                ctx.arc(this.blinkExplosionX, this.blinkExplosionY, radius, 0, Math.PI * 2);
                ctx.fill();
                
                // Inner core
                ctx.fillStyle = `rgba(255, 150, 255, ${alpha * 1.5})`;
                ctx.beginPath();
                ctx.arc(this.blinkExplosionX, this.blinkExplosionY, radius * 0.5, 0, Math.PI * 2);
                ctx.fill();
            }
            
            ctx.restore();
        }
        
        // Draw heavy charge effect - Mage magical build-up circles
        if (this.heavyChargeEffectActive) {
            const chargeProgress = this.heavyChargeEffectElapsed / this.heavyChargeEffectDuration;
            const pulseSize = 1.0 + Math.sin(chargeProgress * Math.PI * 4) * 0.1;
            
            ctx.save();
            ctx.globalAlpha = 0.6;
            
            // Mage: Magical build-up circles
            ctx.strokeStyle = '#673ab7';
            ctx.lineWidth = 3;
            for (let i = 0; i < 3; i++) {
                const offset = i * 15;
                ctx.beginPath();
                ctx.arc(this.x, this.y, (this.size + offset) * pulseSize, 0, Math.PI * 2);
                ctx.stroke();
            }
            
            ctx.restore();
        }
        
        // Draw all active energy beams
        this.activeBeams.forEach(beam => {
            ctx.save();
            
            const beamWidth = MAGE_CONFIG.beamWidth;
            
            // Calculate actual beam endpoint based on penetration
            const beamEndpoint = this.calculateBeamVisualEndpoint(beam);
            const endX = beamEndpoint.endX;
            const endY = beamEndpoint.endY;
            const enemiesHit = beamEndpoint.enemiesHit;
            
            // Pulsing effect based on elapsed time
            const pulse = Math.sin(beam.elapsed * 20) * 0.3 + 0.7;
            
            // Calculate intensity degradation based on enemies hit
            const maxPenetration = this.effectiveBeamMaxPenetration || MAGE_CONFIG.beamMaxPenetration;
            let intensityMultiplier = 1.0;
            if (enemiesHit > 0) {
                intensityMultiplier = 1.0 - (enemiesHit / maxPenetration) * 0.4;
                intensityMultiplier = Math.max(0.6, intensityMultiplier); // Never below 60%
            }
            
            // Draw outer glow with intensity degradation
            const gradient = ctx.createLinearGradient(
                beam.origin.x, beam.origin.y,
                endX, endY
            );
            gradient.addColorStop(0, `rgba(156, 39, 176, ${0.6 * pulse * intensityMultiplier})`);
            gradient.addColorStop(0.5, `rgba(156, 39, 176, ${0.4 * pulse * intensityMultiplier})`);
            gradient.addColorStop(1, 'rgba(156, 39, 176, 0)');
            
            ctx.strokeStyle = gradient;
            ctx.lineWidth = beamWidth * 1.5 * intensityMultiplier;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(beam.origin.x, beam.origin.y);
            ctx.lineTo(endX, endY);
            ctx.stroke();
            
            // Draw core beam with intensity degradation
            const coreGradient = ctx.createLinearGradient(
                beam.origin.x, beam.origin.y,
                endX, endY
            );
            coreGradient.addColorStop(0, `rgba(255, 255, 255, ${0.9 * pulse * intensityMultiplier})`);
            coreGradient.addColorStop(0.5, `rgba(200, 150, 255, ${0.7 * pulse * intensityMultiplier})`);
            coreGradient.addColorStop(1, 'rgba(156, 39, 176, 0)');
            
            ctx.strokeStyle = coreGradient;
            ctx.lineWidth = beamWidth * 0.5 * intensityMultiplier;
            ctx.beginPath();
            ctx.moveTo(beam.origin.x, beam.origin.y);
            ctx.lineTo(endX, endY);
            ctx.stroke();
            
            // Draw particle effects along beam (use actual endpoint distance)
            const beamLength = Math.sqrt((endX - beam.origin.x) ** 2 + (endY - beam.origin.y) ** 2);
            const numParticles = 8;
            for (let i = 0; i < numParticles; i++) {
                const t = (i / numParticles + beam.elapsed * 2) % 1;
                const px = beam.origin.x + (endX - beam.origin.x) * t;
                const py = beam.origin.y + (endY - beam.origin.y) * t;
                const particleAlpha = (1 - t) * 0.8 * intensityMultiplier;
                
                ctx.fillStyle = `rgba(255, 200, 255, ${particleAlpha})`;
                ctx.beginPath();
                ctx.arc(px, py, 4 * intensityMultiplier, 0, Math.PI * 2);
                ctx.fill();
            }
            
            ctx.restore();
        });
    }
    
    // Override serialize to include Mage-specific state
    serialize() {
        const baseState = super.serialize();
        return {
            ...baseState,
            // Mage-specific abilities
            arcaneFocusActive: this.arcaneFocusActive,
            blinkCooldown: this.blinkCooldown,
            blinkDecoyActive: this.blinkDecoyActive,
            blinkDecoyX: this.blinkDecoyX,
            blinkDecoyY: this.blinkDecoyY,
            blinkDecoyHealth: this.blinkDecoyHealth,
            blinkDecoyMaxHealth: this.blinkDecoyMaxHealth,
            blinkExplosionActive: this.blinkExplosionActive,
            blinkExplosionElapsed: this.blinkExplosionElapsed, // For correct explosion animation on clients
            blinkExplosionX: this.blinkExplosionX,
            blinkExplosionY: this.blinkExplosionY,
            // Beam attack state
            activeBeams: this.activeBeams,
            beamCharges: this.beamCharges,
            beamChargeCooldowns: this.beamChargeCooldowns
        };
    }
    
    // Override applyState to handle Mage-specific state
    applyState(state) {
        super.applyState(state);
        // Mage-specific properties
        if (state.arcaneFocusActive !== undefined) this.arcaneFocusActive = state.arcaneFocusActive;
        if (state.blinkCooldown !== undefined) this.blinkCooldown = state.blinkCooldown;
        if (state.blinkDecoyActive !== undefined) this.blinkDecoyActive = state.blinkDecoyActive;
        if (state.blinkDecoyX !== undefined) this.blinkDecoyX = state.blinkDecoyX;
        if (state.blinkDecoyY !== undefined) this.blinkDecoyY = state.blinkDecoyY;
        if (state.blinkDecoyHealth !== undefined) this.blinkDecoyHealth = state.blinkDecoyHealth;
        if (state.blinkDecoyMaxHealth !== undefined) this.blinkDecoyMaxHealth = state.blinkDecoyMaxHealth;
        if (state.blinkExplosionActive !== undefined) this.blinkExplosionActive = state.blinkExplosionActive;
        if (state.blinkExplosionElapsed !== undefined) this.blinkExplosionElapsed = state.blinkExplosionElapsed;
        if (state.blinkExplosionX !== undefined) this.blinkExplosionX = state.blinkExplosionX;
        if (state.blinkExplosionY !== undefined) this.blinkExplosionY = state.blinkExplosionY;
        // Beam attack state
        if (state.activeBeams !== undefined) this.activeBeams = state.activeBeams;
        if (state.beamCharges !== undefined) this.beamCharges = state.beamCharges;
        if (state.beamChargeCooldowns !== undefined) this.beamChargeCooldowns = state.beamChargeCooldowns;
    }

    getAdditionalAudioTrackedFields(state) {
        return {
            beamCharges: state && state.beamCharges !== undefined ? state.beamCharges : (this.beamCharges !== undefined ? this.beamCharges : 0)
        };
    }

    getAdditionalAudioTrackedFieldsFromInstance() {
        return {
            beamCharges: this.beamCharges !== undefined ? this.beamCharges : 0
        };
    }

    onClientAttackStarted() {
        if (this.canPlayClientAudio() && AudioManager.sounds && AudioManager.sounds.mageBasicAttack) {
            AudioManager.sounds.mageBasicAttack();
        }
    }

    onClientHeavyAttackTriggered() {
        if (!this.canPlayClientAudio() || !AudioManager.sounds || !AudioManager.sounds.mageHeavyAttackBeam) {
            return false;
        }
        AudioManager.sounds.mageHeavyAttackBeam();
        return true;
    }

    onClientSpecialAbilityTriggered() {
        if (this.canPlayClientAudio() && AudioManager.sounds && AudioManager.sounds.mageBlink) {
            AudioManager.sounds.mageBlink();
        }
    }

    handleSubclassClientAudio(prevState, currentState) {
        if (!this.canPlayClientAudio() || !AudioManager.sounds) {
            return;
        }
        
        const heavyTriggered = this.didHeavyAttackTrigger(prevState, currentState);
        if (prevState.beamCharges !== undefined && currentState.beamCharges !== undefined &&
            currentState.beamCharges < prevState.beamCharges &&
            !heavyTriggered &&
            AudioManager.sounds.mageHeavyAttackBeam) {
            AudioManager.sounds.mageHeavyAttackBeam();
        }
    }
}

