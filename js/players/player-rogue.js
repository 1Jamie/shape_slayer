// Rogue class (Triangle) - extends PlayerBase

// ============================================================================
// ROGUE CONFIGURATION - Adjust these values for game balancing
// ============================================================================

const ROGUE_CONFIG = {
    // Base Stats (from CLASS_DEFINITIONS)
    baseHp: 75,                    // Starting health points
    baseDamage: 12,                // Base damage per attack
    baseSpeed: 267.5,              // Movement speed (pixels/second)
    baseDefense: 0,                // Damage reduction (0-1 range)
    critChance: 0.15,              // Critical hit chance (0.15 = 15%)
    
    // Level Up Bonuses (per upgrade level purchased in nexus)
    damagePerLevel: 0.5,           // Damage increase per level
    defensePerLevel: 0.005,        // Defense increase per level (0.005 = 0.5%)
    speedPerLevel: 2,              // Speed increase per level (pixels/second)
    
    // Dodge System
    dodgeCharges: 2,               // Number of dodge charges available
    dodgeCooldown: 2.0,            // Cooldown per charge (seconds)
    dodgeSpeed: 720,               // Dash speed (pixels/second)
    dodgeDuration: 0.3,            // Duration of dodge (seconds)
    dodgeDamage: 0.775,            // Damage multiplier during dodge collision
    
    // Basic Attack (Knife Throw)
    knifeSpeed: 350,               // Projectile speed (pixels/second)
    knifeLifetime: 1.5,            // How long knife travels (seconds)
    knifeSize: 8,                  // Knife projectile size (pixels)
    
    // Heavy Attack (Fan of Knives)
    heavyAttackCooldown: 3.0,      // Cooldown for heavy attack (seconds)
    fanKnifeCount: 7,              // Number of knives in fan
    fanSpreadAngle: Math.PI / 3,   // Spread angle in radians (60 degrees)
    fanKnifeSpeed: 400,            // Fan knife speed (pixels/second)
    fanKnifeDamage: 1.8,           // Damage multiplier for fan knives
    fanKnifeSize: 10,              // Fan knife size (pixels)
    fanKnifeLifetime: 1.5,         // Fan knife lifetime (seconds)
    
    // Special Ability (Shadow Clones)
    specialCooldown: 5.0,          // Special ability cooldown (seconds)
    shadowCloneCount: 2,           // Number of shadow clones
    shadowCloneDuration: 3.0,      // How long clones last (seconds)
    shadowCloneMaxHealth: 50,      // Starting health for each clone
    shadowCloneHealthDecay: 10,    // HP lost per second per clone
    shadowCloneDistance: 100,      // Distance from player (pixels)
    shadowCloneSpawnAngle: Math.PI / 3, // Angle offset for clone positioning (radians)
    shadowCloneInvulnTime: 0.3,    // Invulnerability duration on activation (seconds)
    
    // Heavy Attack Preview (Mobile)
    heavyPreviewSpread: Math.PI / 3, // Preview spread angle (60 degrees)
    
    // Descriptions for UI (tooltips, character sheet)
    descriptions: {
        playstyle: "High mobility assassin with critical hits",
        basic: "Quick Stab - Fast triangle projectile",
        heavy: "Fan of Knives - {fanKnifeCount} knives in {fanSpreadAngle|degrees} spread, {fanKnifeDamage|mult} damage each",
        special: "Shadow Clones - Creates {shadowCloneCount} decoys for {shadowCloneDuration}s",
        passive: "Backstab - 2x damage from behind, {dodgeCharges} dodge charges",
        baseStats: "{critChance|percent} Base Crit Chance, High Speed"
    }
};

class Rogue extends PlayerBase {
    constructor(x = 400, y = 300) {
        super(x, y);
        
        // Set class identifier
        this.playerClass = 'triangle';
        
        // Load class definition (visual properties only)
        const classDef = CLASS_DEFINITIONS.triangle;
        
        // Load upgrades from save system
        let upgradeBonuses = { damage: 0, defense: 0, speed: 0 };
        if (typeof SaveSystem !== 'undefined') {
            const upgrades = SaveSystem.getUpgrades('triangle');
            // Calculate bonuses using config values
            upgradeBonuses.damage = upgrades.damage * ROGUE_CONFIG.damagePerLevel;
            upgradeBonuses.defense = upgrades.defense * ROGUE_CONFIG.defensePerLevel;
            upgradeBonuses.speed = upgrades.speed * ROGUE_CONFIG.speedPerLevel;
        }
        
        // Set base stats from CONFIG (single source of truth)
        this.baseDamage = ROGUE_CONFIG.baseDamage + upgradeBonuses.damage;
        this.baseMoveSpeed = ROGUE_CONFIG.baseSpeed + upgradeBonuses.speed;
        this.initialBaseMoveSpeed = this.baseMoveSpeed; // Store original for level scaling
        this.baseDefense = ROGUE_CONFIG.baseDefense + upgradeBonuses.defense;
        this.baseMaxHp = ROGUE_CONFIG.baseHp; // Store base max HP for gear calculations
        this.maxHp = ROGUE_CONFIG.baseHp;
        this.hp = ROGUE_CONFIG.baseHp;
        this.baseCritChance = ROGUE_CONFIG.critChance; // Store base for updateEffectiveStats
        this.critChance = ROGUE_CONFIG.critChance;
        this.color = classDef.color;
        this.shape = classDef.shape;
        this.syncBaseStatAnchors();
        
        // Dodge system from CONFIG (single source of truth)
        this.baseDodgeCharges = ROGUE_CONFIG.dodgeCharges; // Store base value for updateEffectiveStats
        this.dodgeCharges = ROGUE_CONFIG.dodgeCharges;
        this.maxDodgeCharges = ROGUE_CONFIG.dodgeCharges;
        this.dodgeChargeCooldowns = new Array(this.maxDodgeCharges).fill(0);
        this.dodgeCooldownTime = ROGUE_CONFIG.dodgeCooldown;
        this.dodgeSpeedBoost = ROGUE_CONFIG.dodgeSpeed;
        
        // Heavy attack cooldown
        this.heavyAttackCooldownTime = ROGUE_CONFIG.heavyAttackCooldown;
        
        // Shadow clones special ability
        this.shadowClonesActive = false;
        this.shadowClonesElapsed = 0;
        this.shadowClonesDuration = ROGUE_CONFIG.shadowCloneDuration;
        this.shadowClones = []; // Array of {x, y, rotation} for each clone
        
        // Dash preview system (mobile)
        this.dashPreviewActive = false;
        this.dashPreviewX = 0;
        this.dashPreviewY = 0;
        this.dashPreviewDistance = 0;
        
        // Heavy attack preview system (mobile)
        this.heavyAttackPreviewActive = false;
        this.heavyAttackPreviewAngle = 0;
        this.heavyAttackPreviewSpread = ROGUE_CONFIG.heavyPreviewSpread;
        
        // Class modifier storage
        this.dodgeDamageMultiplier = 1.0;
        this.knifeCountBonus = 0;
        this.shadowCloneCountBonus = 0;
        this.backstabMultiplierBonus = 0;
        
        // Update effective stats
        this.updateEffectiveStats();
        
        console.log('Rogue class initialized');
    }
    
    // Override updateEffectiveStats to reset class modifiers
    updateEffectiveStats() {
        // Reset class modifier storage
        this.dodgeDamageMultiplier = 1.0;
        this.knifeCountBonus = 0;
        this.shadowCloneCountBonus = 0;
        this.backstabMultiplierBonus = 0;
        
        // Call parent
        super.updateEffectiveStats();
    }
    
    // Override to apply Rogue-specific class modifiers
    applyClassModifier(modifier) {
        // Call parent for universal modifiers
        super.applyClassModifier(modifier);
        
        // Handle Rogue-specific modifiers
        if (modifier.class === 'triangle') {
            switch(modifier.type) {
                case 'dodge_damage':
                    this.dodgeDamageMultiplier += modifier.value;
                    break;
                case 'dodge_charges':
                    this.bonusDodgeCharges += modifier.value;
                    break;
                case 'knife_count':
                    this.knifeCountBonus += modifier.value;
                    break;
                case 'shadow_clone_count':
                    this.shadowCloneCountBonus += modifier.value;
                    break;
                case 'backstab_multiplier':
                    this.backstabMultiplierBonus += modifier.value;
                    break;
            }
        }
    }
    
    // Override executeAttack for Rogue throw knife
    executeAttack(input) {
        this.throwKnife(input);
        
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
    
    throwKnife(input) {
        // Play rogue basic attack sound
        if (typeof AudioManager !== 'undefined' && AudioManager.sounds) {
            AudioManager.sounds.rogueBasicAttack();
        }
        
        // Rogue: Throw knife as projectile
        if (typeof Game === 'undefined') return;
        
        // Get gameplay position (authoritative position in multiplayer)
        const pos = this.getGameplayPosition();
        
        // Use character rotation (already correctly calculated from mouse/joystick)
        const dirX = Math.cos(this.rotation);
        const dirY = Math.sin(this.rotation);
        
        const baseKnife = {
            x: pos.x,
            y: pos.y,
            vx: dirX * ROGUE_CONFIG.knifeSpeed * (this.projectileSpeedMultiplier || 1.0),
            vy: dirY * ROGUE_CONFIG.knifeSpeed * (this.projectileSpeedMultiplier || 1.0),
            damage: this.damage,
            size: ROGUE_CONFIG.knifeSize,
            lifetime: ROGUE_CONFIG.knifeLifetime,
            elapsed: 0,
            type: 'knife',
            color: this.color,
            playerX: this.x, // Store player position for backstab detection
            playerY: this.y,
            playerClass: this.playerClass, // Store class for backstab check
            playerId: this.playerId || (typeof Game !== 'undefined' && Game.getLocalPlayerId ? Game.getLocalPlayerId() : null) // For damage attribution
        };
        
        Game.projectiles.push(baseKnife);
        
        // Multishot: Create additional projectiles at angles
        if (this.multishotCount && this.multishotCount > 0) {
            for (let i = 0; i < this.multishotCount; i++) {
                const angleOffset = ((i + 1) % 2 === 0 ? 1 : -1) * (Math.ceil((i + 1) / 2) * 0.15); // Alternate ±0.15, ±0.3 radians
                const multishotAngle = Math.atan2(dirY, dirX) + angleOffset;
                
                Game.projectiles.push({
                    ...baseKnife,
                    vx: Math.cos(multishotAngle) * ROGUE_CONFIG.knifeSpeed * (this.projectileSpeedMultiplier || 1.0),
                    vy: Math.sin(multishotAngle) * ROGUE_CONFIG.knifeSpeed * (this.projectileSpeedMultiplier || 1.0),
                    damage: this.damage * 0.5 // 50% damage for multishot projectiles
                });
            }
        }
    }
    
    // Override createHeavyAttack for fan of knives
    createHeavyAttack() {
        this.createFanOfKnives();
        
        this.isAttacking = true;
        setTimeout(() => {
            this.isAttacking = false;
        }, this.attackDuration * 1000);
        
        // Start charge effect animation
        this.heavyChargeEffectActive = true;
        this.heavyChargeEffectElapsed = 0;
        
        // Trigger screen shake for heavy attacks
        if (typeof Game !== 'undefined') {
            Game.triggerScreenShake(0.5, 0.2);
            Game.triggerHitPause(0.08); // Brief freeze on heavy attack
        }
        
        // Clear preview when attack fires
        this.clearHeavyAttackPreview();
    }
    
    createFanOfKnives() {
        // Play rogue heavy attack sound
        if (typeof AudioManager !== 'undefined' && AudioManager.sounds) {
            AudioManager.sounds.rogueHeavyAttack();
        }
        
        // Rogue: Fan of knives - throw multiple knives in a spread pattern
        const knifeDamage = this.damage * ROGUE_CONFIG.fanKnifeDamage;
        const numKnives = ROGUE_CONFIG.fanKnifeCount + this.knifeCountBonus; // Apply class modifier
        const spreadAngle = ROGUE_CONFIG.fanSpreadAngle;
        const knifeSpeed = ROGUE_CONFIG.fanKnifeSpeed;
        
        // Get gameplay position (authoritative position in multiplayer)
        const pos = this.getGameplayPosition();
        
        if (typeof Game !== 'undefined') {
            for (let i = 0; i < numKnives; i++) {
                // Calculate angle for this knife
                const angle = this.rotation + (i / (numKnives - 1) - 0.5) * spreadAngle;
                const dirX = Math.cos(angle);
                const dirY = Math.sin(angle);
                
                // Create knife projectile
                Game.projectiles.push({
                    x: pos.x,
                    y: pos.y,
                    vx: dirX * knifeSpeed * (this.projectileSpeedMultiplier || 1.0),
                    vy: dirY * knifeSpeed * (this.projectileSpeedMultiplier || 1.0),
                    damage: knifeDamage,
                    size: ROGUE_CONFIG.fanKnifeSize,
                    lifetime: ROGUE_CONFIG.fanKnifeLifetime,
                    elapsed: 0,
                    type: 'knife',
                    color: this.color,
                    playerX: this.x, // Store for backstab detection
                    playerY: this.y,
                    playerClass: this.playerClass
                });
            }
        }
    }
    
    // Override activateSpecialAbility for shadow clones
    activateSpecialAbility(input) {
        this.activateShadowClones();
    }
    
    activateShadowClones() {
        // Play shadow clones sound
        if (typeof AudioManager !== 'undefined' && AudioManager.sounds) {
            AudioManager.sounds.rogueShadowClones();
        }
        
        this.shadowClonesActive = true;
        this.shadowClonesElapsed = 0;
        // Apply cooldown reduction
        const effectiveSpecialCooldown = this.specialCooldownTime * (1 - this.cooldownReduction);
        this.specialCooldown = effectiveSpecialCooldown;
        
        // Create shadow clones positioned around the player
        this.shadowClones = [];
        const numClones = ROGUE_CONFIG.shadowCloneCount + this.shadowCloneCountBonus; // Apply class modifier
        const cloneMaxHealth = ROGUE_CONFIG.shadowCloneMaxHealth;
        const cloneHealthDecayRate = ROGUE_CONFIG.shadowCloneHealthDecay;
        
        for (let i = 0; i < numClones; i++) {
            const clone = this.createShadowCloneEntity({
                angleOffset: (i * 2 - 1) * ROGUE_CONFIG.shadowCloneSpawnAngle,
                distance: ROGUE_CONFIG.shadowCloneDistance,
                maxHealth: cloneMaxHealth,
                healthDecayRate: cloneHealthDecayRate
            });
            if (clone) {
                this.shadowClones.push(clone);
            }
        }
        
        // Clear enemy target locks for enemies within detection range of ANY clone
        // This provides proximity-based aggro for clones
        if (typeof Game !== 'undefined' && Game.enemies) {
            Game.enemies.forEach(enemy => {
                if (!enemy.alive) return;
                
                // Check if enemy is within detection range of ANY clone
                let withinRange = false;
                for (const clone of this.shadowClones) {
                    const dx = clone.x - enemy.x;
                    const dy = clone.y - enemy.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance <= enemy.detectionRange) {
                        withinRange = true;
                        break;
                    }
                }
                
                // Only clear lock if nearby AND enemy was targeting this player
                if (withinRange && enemy.targetLock && enemy.targetLock.playerRef === this) {
                    enemy.targetLock = null;
                    enemy.targetLockTimer = 0;
                }
            });
        }
        
        this.invulnerable = true;
        this.invulnerabilityTime = ROGUE_CONFIG.shadowCloneInvulnTime;
        console.log('Shadow clones activated!');
    }
    
    createShadowCloneEntity(config = {}) {
        const {
            angleOffset = 0,
            distance = ROGUE_CONFIG.shadowCloneDistance,
            maxHealth = ROGUE_CONFIG.shadowCloneMaxHealth,
            health = null,
            healthDecayRate = ROGUE_CONFIG.shadowCloneHealthDecay,
            x = null,
            y = null,
            rotation = this.rotation
        } = config;
        
        let cloneX = x;
        let cloneY = y;
        
        if (cloneX === null || cloneY === null) {
            const spawnAngle = this.rotation + angleOffset;
            cloneX = this.x + Math.cos(spawnAngle) * distance;
            cloneY = this.y + Math.sin(spawnAngle) * distance;
        }
        
        const boundsWidth = (typeof currentRoom !== 'undefined' && currentRoom) ? currentRoom.width : (Game && Game.canvas ? Game.canvas.width : 2400);
        const boundsHeight = (typeof currentRoom !== 'undefined' && currentRoom) ? currentRoom.height : (Game && Game.canvas ? Game.canvas.height : 1350);
        
        const clampedX = Game ? clamp(cloneX, this.size, boundsWidth - this.size) : cloneX;
        const clampedY = Game ? clamp(cloneY, this.size, boundsHeight - this.size) : cloneY;
        
        const initialHealth = health !== null ? health : maxHealth;
        
        const clone = {
            x: clampedX,
            y: clampedY,
            rotation,
            health: initialHealth,
            hp: initialHealth,
            maxHealth,
            healthDecayRate,
            size: this.size,
            alive: initialHealth > 0,
            dead: initialHealth <= 0,
            owner: this,
            ownerId: this.playerId || null,
            playerClass: this.playerClass,
            isShadowClone: true,
            invulnerable: false
        };
        
        clone.takeDamage = (amount = 0, options = {}) => {
            if (!clone.alive) return 0;
            const damage = Math.max(0, amount);
            if (damage <= 0) return 0;
            
            clone.health = Math.max(0, clone.health - damage);
            clone.hp = clone.health;
            
            const {
                showNumber = true,
                particleColor = '#666666',
                particleCount = 4
            } = options;
            
            if (showNumber && typeof createDamageNumber !== 'undefined') {
                createDamageNumber(clone.x, clone.y, damage, false, false);
            }
            
            if (particleColor && typeof createParticleBurst !== 'undefined') {
                createParticleBurst(clone.x, clone.y, particleColor, particleCount);
            }
            
            if (clone.health <= 0) {
                clone.alive = false;
                clone.dead = true;
            }
            
            return damage;
        };
        
        clone.applyKnockback = () => {};
        
        return clone;
    }
    
    // Override startDodge for Rogue directional dodge
    startDodge(input) {
        // Play rogue-specific dodge sound (replaces generic dodge sound)
        if (typeof AudioManager !== 'undefined' && AudioManager.sounds) {
            AudioManager.sounds.rogueDodge();
        }
        
        console.log('[ROGUE DODGE] startDodge called, isTouchMode:', input.isTouchMode ? input.isTouchMode() : false);
        console.log('[ROGUE DODGE] input.touchButtons:', input.touchButtons);
        
        let dodgeDirX = 0;
        let dodgeDirY = 0;
        
        // Mobile: Use joystick direction if available
        if (input.isTouchMode && input.isTouchMode()) {
            const button = input.touchButtons && input.touchButtons.dodge;
            console.log('[ROGUE DODGE] button:', button, 'finalJoystickState:', button?.finalJoystickState);
            
            if (button && button.finalJoystickState) {
                // Use stored joystick direction from button release
                const state = button.finalJoystickState;
                console.log('[ROGUE DODGE] Using finalJoystickState - mag:', state.magnitude, 'dir:', state.direction, 'angle:', state.angle);
                
                if (state.magnitude > 0.1) {
                    dodgeDirX = state.direction.x * this.dodgeSpeedBoost;
                    dodgeDirY = state.direction.y * this.dodgeSpeedBoost;
                    console.log('[ROGUE DODGE] Direction from joystick:', dodgeDirX, dodgeDirY);
                    // Clear the stored state after using it
                    button.finalJoystickState = null;
                } else {
                    // Magnitude too low, use facing direction
                    dodgeDirX = Math.cos(this.rotation) * this.dodgeSpeedBoost;
                    dodgeDirY = Math.sin(this.rotation) * this.dodgeSpeedBoost;
                    console.log('[ROGUE DODGE] Magnitude too low, using rotation:', this.rotation);
                }
            } else if (input.touchJoysticks && input.touchJoysticks.dodge && input.touchJoysticks.dodge.active) {
                // Joystick still active (fallback)
                const joystick = input.touchJoysticks.dodge;
                const dir = joystick.getDirection();
                dodgeDirX = dir.x * this.dodgeSpeedBoost;
                dodgeDirY = dir.y * this.dodgeSpeedBoost;
                console.log('[ROGUE DODGE] Using active joystick:', dodgeDirX, dodgeDirY);
            } else {
                // No joystick data, use facing direction
                dodgeDirX = Math.cos(this.rotation) * this.dodgeSpeedBoost;
                dodgeDirY = Math.sin(this.rotation) * this.dodgeSpeedBoost;
                console.log('[ROGUE DODGE] No joystick, using rotation:', this.rotation);
            }
        } else {
            // Desktop: Always dash in facing direction
            dodgeDirX = Math.cos(this.rotation) * this.dodgeSpeedBoost;
            dodgeDirY = Math.sin(this.rotation) * this.dodgeSpeedBoost;
            console.log('[ROGUE DODGE] Desktop mode, using rotation:', this.rotation);
        }
        
        // Store dodge velocity
        this.dodgeVx = dodgeDirX;
        this.dodgeVy = dodgeDirY;
        
        this.beginDashAnimation(dodgeDirX, dodgeDirY, { seedTrail: true });
        
        // Update rotation to face dodge direction
        this.rotation = Math.atan2(dodgeDirY, dodgeDirX);
        this.lastAimAngle = this.rotation; // Store for mobile aim retention
        
        console.log('[ROGUE DODGE] Final dodge velocity:', this.dodgeVx, this.dodgeVy, 'rotation:', this.rotation);
        
        // Set dodge state
        this.isDodging = true;
        this.invulnerable = true;
        this.dodgeElapsed = 0;
        this.dodgeHitEnemies.clear(); // Reset hit tracking for new dodge
        this.dodgeHasChainedLegendary = false; // Reset chain flag for this dodge
        
        this.consumeDodgeCharge();
        
        // Note: Rogue dodge sound is played at the start of this function (overrides base class sound)
    }
    
    // Override updateClassAbilities for Rogue-specific updates
    updateClassAbilities(deltaTime, input) {
        // Update shadow clones animation and health
        if (this.shadowClonesActive) {
            this.shadowClones = this.shadowClones.filter(clone => {
                if (!clone || clone.alive === false) {
                    return false;
                }
                
                // Health decay over time
                clone.health = Math.max(0, clone.health - clone.healthDecayRate * deltaTime);
                clone.hp = clone.health;
                
                // Random rotation for illusory movement
                clone.rotation += deltaTime * 0.5;
                
                if (clone.health <= 0) {
                    clone.alive = false;
                    clone.dead = true;
                    return false;
                }
                return true;
            });
            
            if (this.shadowClones.length === 0) {
                this.shadowClonesActive = false;
                this.shadowClones = [];
            }
        }
        
        // Check for damage to shadow clones from enemy projectiles
        if (this.shadowClonesActive && typeof Game !== 'undefined' && Game.projectiles) {
            Game.projectiles.forEach(projectile => {
                // Skip player projectiles
                if (projectile.type === 'knife' || projectile.playerClass) return;
                
                this.shadowClones.forEach(clone => {
                    const dx = projectile.x - clone.x;
                    const dy = projectile.y - clone.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    // Check collision with clone (use player size as clone size)
                    if (distance < this.size + (projectile.size || 5)) {
                        if (clone && clone.takeDamage) {
                            clone.takeDamage(projectile.damage || 10, {
                                showNumber: false,
                                particleColor: '#666666'
                            });
                        }
                        // Mark projectile as hit so it gets removed
                        projectile.lifetime = 0;
                    }
                });
            });
        }
        
        // Rogue dodge collision damage (Triangle-specific: deals damage during dodge)
        if (this.isDodging && typeof Game !== 'undefined') {
            const baseDodgeDamage = this.damage * ROGUE_CONFIG.dodgeDamage * this.dodgeDamageMultiplier; // Apply class modifier
            
            Game.enemies.forEach(enemy => {
                if (enemy.alive && !this.dodgeHitEnemies.has(enemy)) {
                    const dx = enemy.x - this.x;
                    const dy = enemy.y - this.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance < this.size + enemy.size) {
                        // Check for crit
                        const isCrit = Math.random() < this.critChance;
                        const critMultiplier = isCrit ? (2.0 * (this.critDamageMultiplier || 1.0)) : 1.0;
                        const dodgeDamage = baseDodgeDamage * critMultiplier;
                        
                        // Calculate damage dealt BEFORE applying damage
                        const damageDealt = Math.min(dodgeDamage, enemy.hp);
                        
                        // Get player ID for damage attribution
                        const attackerId = this.playerId || (typeof Game !== 'undefined' && Game.getLocalPlayerId ? Game.getLocalPlayerId() : null);
                        
                        // Collision during dodge - deal damage
                        enemy.takeDamage(dodgeDamage, attackerId);
                        
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
                        // Chain lightning (only once per dodge)
                        if (this.activeLegendaryEffects && !this.dodgeHasChainedLegendary) {
                            this.activeLegendaryEffects.forEach(effect => {
                                if (effect.type === 'chain_lightning' && typeof chainLightningAttack !== 'undefined') {
                                    chainLightningAttack(this, enemy, effect, dodgeDamage);
                                    this.dodgeHasChainedLegendary = true;
                                }
                            });
                        }
                        
                        // Show damage number for rogue dodge damage
                        if (typeof createDamageNumber !== 'undefined') {
                            createDamageNumber(enemy.x, enemy.y, damageDealt, isCrit, false);
                        }
                        this.dodgeHitEnemies.add(enemy); // Mark as hit
                    }
                }
            });
        }
        
        // Update dash preview if active (mobile)
        if (this.dashPreviewActive && input.isTouchMode && input.isTouchMode()) {
            this.updateDashPreview(input);
        }
    }
    
    // Update dash preview (shows dash destination while aiming - mobile)
    updateDashPreview(input) {
        if (!input.isTouchMode || !input.isTouchMode()) return;
        
        this.dashPreviewActive = true;
        
        // Get target position based on joystick direction
        let targetX, targetY;
        let distance = this.dodgeSpeedBoost * this.dodgeDuration; // Dash distance
        
        if (input.touchJoysticks && input.touchJoysticks.dodge) {
            // Touch mode: use joystick direction and magnitude
            const joystick = input.touchJoysticks.dodge;
            if (joystick.active && joystick.getMagnitude() > 0.1) {
                const dir = joystick.getDirection();
                // Distance scales with magnitude: minimum 50% of max distance, up to full distance
                const mag = joystick.getMagnitude();
                const scaledDistance = distance * (0.5 + mag * 0.5); // Range from 50% to 100% of dash distance
                targetX = this.x + dir.x * scaledDistance;
                targetY = this.y + dir.y * scaledDistance;
                this.dashPreviewDistance = scaledDistance;
            } else {
                // Joystick not active, use facing direction with minimum distance
                targetX = this.x + Math.cos(this.rotation) * distance * 0.5;
                targetY = this.y + Math.sin(this.rotation) * distance * 0.5;
                this.dashPreviewDistance = distance * 0.5;
            }
        } else {
            // Fallback: use facing direction
            targetX = this.x + Math.cos(this.rotation) * distance * 0.5;
            targetY = this.y + Math.sin(this.rotation) * distance * 0.5;
            this.dashPreviewDistance = distance * 0.5;
        }
        
        // Clamp to bounds
        if (typeof Game !== 'undefined' && Game.canvas) {
            // Use room bounds instead of canvas bounds
            const roomWidth = (typeof currentRoom !== 'undefined' && currentRoom) ? currentRoom.width : Game.canvas.width;
            const roomHeight = (typeof currentRoom !== 'undefined' && currentRoom) ? currentRoom.height : Game.canvas.height;
            targetX = clamp(targetX, this.size, roomWidth - this.size);
            targetY = clamp(targetY, this.size, roomHeight - this.size);
        }
        
        this.dashPreviewX = targetX;
        this.dashPreviewY = targetY;
    }
    
    // Override initHeavyAttackPreview for Rogue
    initHeavyAttackPreview() {
        this.heavyAttackPreviewActive = true;
    }
    
    // Override updateHeavyAttackPreview for Rogue
    updateHeavyAttackPreview(input) {
        if (!input.isTouchMode || !input.isTouchMode()) return;
        
        this.heavyAttackPreviewActive = true;
        
        // Get direction from joystick
        if (input.touchJoysticks && input.touchJoysticks.heavyAttack) {
            const joystick = input.touchJoysticks.heavyAttack;
            if (joystick.active && joystick.getMagnitude() > 0.1) {
                // Update preview angle to match joystick
                this.heavyAttackPreviewAngle = joystick.getAngle();
            } else {
                // Joystick not active, use current rotation
                this.heavyAttackPreviewAngle = this.rotation;
            }
        } else {
            // Fallback: use current rotation
            this.heavyAttackPreviewAngle = this.rotation;
        }
    }
    
    // Override clearHeavyAttackPreview for Rogue
    clearHeavyAttackPreview() {
        this.heavyAttackPreviewActive = false;
    }
    
    // Override renderClassVisuals for Rogue-specific visuals
    renderClassVisuals(ctx) {
        // Draw dash preview - shows dash destination while aiming (mobile)
        if (this.dashPreviewActive) {
            ctx.save();
            
            // Draw line from player to destination
            ctx.strokeStyle = 'rgba(226, 74, 206, 0.6)'; // Pink color matching triangle/rogue
            ctx.lineWidth = 3;
            ctx.setLineDash([5, 5]); // Dashed line
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.dashPreviewX, this.dashPreviewY);
            ctx.stroke();
            ctx.setLineDash([]); // Reset dash
            
            // Draw destination indicator (pulsing circle)
            const pulse = Math.sin(Date.now() / 150) * 0.3 + 0.7; // Pulse between 0.4 and 1.0
            const indicatorRadius = 12 * pulse;
            
            // Outer glow
            ctx.fillStyle = `rgba(226, 74, 206, ${0.4 * pulse})`;
            ctx.beginPath();
            ctx.arc(this.dashPreviewX, this.dashPreviewY, indicatorRadius + 5, 0, Math.PI * 2);
            ctx.fill();
            
            // Inner circle
            ctx.fillStyle = `rgba(255, 150, 230, ${0.8 * pulse})`;
            ctx.beginPath();
            ctx.arc(this.dashPreviewX, this.dashPreviewY, indicatorRadius, 0, Math.PI * 2);
            ctx.fill();
            
            // Border
            ctx.strokeStyle = `rgba(255, 255, 255, ${pulse})`;
            ctx.lineWidth = 2;
            ctx.stroke();
            
            ctx.restore();
        }
        
        // Draw heavy attack preview - shows fan of knives cone (mobile)
        if (this.heavyAttackPreviewActive) {
            ctx.save();
            ctx.translate(this.x, this.y);
            
            const previewRange = 250; // How far the preview extends
            const numKnives = ROGUE_CONFIG.fanKnifeCount; // Same as actual fan of knives
            const spreadAngle = this.heavyAttackPreviewSpread;
            const pulse = Math.sin(Date.now() / 150) * 0.2 + 0.8; // Pulse between 0.6 and 1.0
            
            // Draw cone outline (outer edges)
            ctx.strokeStyle = `rgba(226, 74, 206, ${0.6 * pulse})`; // Pink color matching triangle/rogue
            ctx.lineWidth = 2;
            ctx.setLineDash([3, 3]); // Dashed line
            
            // Left edge of cone
            const leftAngle = this.heavyAttackPreviewAngle - spreadAngle / 2;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(leftAngle) * previewRange, Math.sin(leftAngle) * previewRange);
            ctx.stroke();
            
            // Right edge of cone
            const rightAngle = this.heavyAttackPreviewAngle + spreadAngle / 2;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(rightAngle) * previewRange, Math.sin(rightAngle) * previewRange);
            ctx.stroke();
            
            // Draw lines for each knife direction
            ctx.strokeStyle = `rgba(255, 150, 230, ${0.5 * pulse})`;
            ctx.lineWidth = 1.5;
            for (let i = 0; i < numKnives; i++) {
                const angle = this.heavyAttackPreviewAngle + (i / (numKnives - 1) - 0.5) * spreadAngle;
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(Math.cos(angle) * previewRange, Math.sin(angle) * previewRange);
                ctx.stroke();
            }
            
            // Draw arc at the end showing spread
            ctx.strokeStyle = `rgba(226, 74, 206, ${0.4 * pulse})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, previewRange, leftAngle, rightAngle);
            ctx.stroke();
            
            ctx.setLineDash([]); // Reset dash
            ctx.restore();
        }
        
        // Draw shadow clones
        if (this.shadowClonesActive && this.shadowClones && this.shadowClones.length > 0) {
            this.shadowClones.forEach(clone => {
                // Calculate alpha based on clone health (health-based fade)
                const healthPercent = clone.health / clone.maxHealth;
                const alpha = 0.6 * healthPercent; // Fade out as health depletes
                
                ctx.save();
                ctx.globalAlpha = alpha;
                ctx.translate(clone.x, clone.y);
                ctx.rotate(clone.rotation);
                
                // Draw clone as triangle (matching player class)
                ctx.fillStyle = '#666666'; // Gray color for clones
                ctx.strokeStyle = '#999999';
                ctx.lineWidth = 2;
                
                ctx.beginPath();
                ctx.moveTo(this.size, 0);  // Tip pointing right
                ctx.lineTo(-this.size * 0.5, -this.size * 0.866);  // Top back
                ctx.lineTo(-this.size * 0.5, this.size * 0.866);  // Bottom back
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                
                // Draw semi-transparent outline to make it look like a shadow
                ctx.globalAlpha = alpha * 0.3;
                ctx.strokeStyle = '#000000';
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.moveTo(this.size, 0);  // Tip pointing right
                ctx.lineTo(-this.size * 0.5, -this.size * 0.866);  // Top back
                ctx.lineTo(-this.size * 0.5, this.size * 0.866);  // Bottom back
                ctx.closePath();
                ctx.stroke();
                
                ctx.restore();
                
                // Draw health bar above clone (not rotated)
                ctx.save();
                ctx.globalAlpha = alpha;
                
                // healthPercent already defined above in this scope
                const barWidth = this.size * 2;
                const barHeight = 4;
                const barX = clone.x - barWidth / 2;
                const barY = clone.y - this.size - 10;
                
                // Background (red)
                ctx.fillStyle = '#ff0000';
                ctx.fillRect(barX, barY, barWidth, barHeight);
                
                // Foreground (green, scaled by health)
                ctx.fillStyle = healthPercent > 0.5 ? '#00ff00' : (healthPercent > 0.25 ? '#ffaa00' : '#ff0000');
                ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);
                
                // Border
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1;
                ctx.strokeRect(barX, barY, barWidth, barHeight);
                
                ctx.restore();
            });
        }
        
        // Draw heavy charge effect - Rogue pink/purple pulsing effect
        if (this.heavyChargeEffectActive) {
            const chargeProgress = this.heavyChargeEffectElapsed / this.heavyChargeEffectDuration;
            const pulseSize = 1.0 + Math.sin(chargeProgress * Math.PI * 4) * 0.1;
            
            ctx.save();
            ctx.globalAlpha = 0.6;
            
            // Rogue: Pink/purple pulsing effect
            ctx.strokeStyle = '#ff1493';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size * pulseSize, 0, Math.PI * 2);
            ctx.stroke();
            
            ctx.restore();
        }
    }
    
    // Override serialize to include Rogue-specific state
    serialize() {
        const baseState = super.serialize();
        return {
            ...baseState,
            // Rogue-specific abilities
            shadowClonesActive: this.shadowClonesActive,
            shadowClones: (this.shadowClones || []).map(clone => ({
                x: clone.x,
                y: clone.y,
                rotation: clone.rotation,
                health: clone.health,
                maxHealth: clone.maxHealth,
                healthDecayRate: clone.healthDecayRate
            }))
        };
    }
    
    // Override applyState to handle Rogue-specific state
    applyState(state) {
        super.applyState(state);
        // Rogue-specific properties
        if (state.shadowClonesActive !== undefined) {
            this.shadowClonesActive = state.shadowClonesActive;
        }
        if (state.shadowClones !== undefined) {
            this.shadowClones = state.shadowClones
                .map(cloneState => this.createShadowCloneEntity({
                    x: cloneState.x,
                    y: cloneState.y,
                    rotation: cloneState.rotation,
                    maxHealth: cloneState.maxHealth !== undefined ? cloneState.maxHealth : ROGUE_CONFIG.shadowCloneMaxHealth,
                    health: cloneState.health !== undefined ? cloneState.health : cloneState.maxHealth,
                    healthDecayRate: cloneState.healthDecayRate !== undefined ? cloneState.healthDecayRate : ROGUE_CONFIG.shadowCloneHealthDecay
                }))
                .filter(clone => clone && clone.alive);
        }
    }

    getAdditionalAudioTrackedFields(state) {
        return {
            shadowClonesActive: state && state.shadowClonesActive !== undefined ? state.shadowClonesActive : !!this.shadowClonesActive
        };
    }

    getAdditionalAudioTrackedFieldsFromInstance() {
        return {
            shadowClonesActive: !!this.shadowClonesActive
        };
    }

    playDodgeSound() {
        if (this.canPlayClientAudio() && AudioManager.sounds && AudioManager.sounds.rogueDodge) {
            AudioManager.sounds.rogueDodge();
        }
    }

    onClientAttackStarted() {
        if (this.canPlayClientAudio() && AudioManager.sounds && AudioManager.sounds.rogueBasicAttack) {
            AudioManager.sounds.rogueBasicAttack();
        }
    }

    onClientHeavyAttackTriggered() {
        if (!this.canPlayClientAudio() || !AudioManager.sounds || !AudioManager.sounds.rogueHeavyAttack) {
            return false;
        }
        AudioManager.sounds.rogueHeavyAttack();
        return true;
    }

    onClientSpecialAbilityTriggered() {
        if (this.canPlayClientAudio() && AudioManager.sounds && AudioManager.sounds.rogueShadowClones) {
            AudioManager.sounds.rogueShadowClones();
        }
    }

    handleSubclassClientAudio(prevState, currentState) {
        if (!this.canPlayClientAudio() || !AudioManager.sounds) {
            return;
        }
        
        if (!prevState.shadowClonesActive && currentState.shadowClonesActive && AudioManager.sounds.rogueShadowClones) {
            AudioManager.sounds.rogueShadowClones();
        }
    }
}

