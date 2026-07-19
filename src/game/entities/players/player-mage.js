// Mage class (Hexagon) - extends PlayerBase

// ============================================================================
// MAGE CONFIGURATION - Adjust these values for game balancing
// ============================================================================

const MAGE_CONFIG = {
    // Base Stats (from CLASS_DEFINITIONS)
    baseHp: 80,                    // Starting health points
    baseDamage: 12,                // Base damage per attack (parity with other classes)
    baseSpeed: 175,                // Movement speed (pixels/second)
    baseDefense: 0,                // Damage reduction (0-1 range)
    critChance: 0,                 // Critical hit chance (0 = 0%)

    // Level Up Bonuses (per upgrade level purchased in nexus)
    damagePerLevel: 0.5,           // Damage increase per level
    defensePerLevel: 0.005,        // Defense increase per level (0.005 = 0.5%)
    speedPerLevel: 2,              // Speed increase per level (pixels/second)
    cooldownPerLevel: 0.01,        // Cooldown reduction per level (0.01 = 1% per level)
    healthPerLevel: 5,             // Health increase per level (flat HP)
    attackSpeedPerLevel: 0.05,     // Attack speed increase per level (0.05 = 5% faster per level)

    // Basic Attack (Magic Bolt)
    boltSpeed: 400,                // Projectile speed (pixels/second)
    boltLifetime: 1.14,            // How long bolt travels (seconds) - reduced by 20% from 1.6
    boltSize: 10,                  // Bolt projectile size (pixels)
    boltSpreadAngle: Math.PI / 24, // Spread angle for multiple projectiles (7.5 degrees) - reduced for better accuracy
    multishotDamageMultiplier: 0.5, // Damage multiplier for multishot projectiles (50% damage per projectile)
    multishotRangeMultiplier: 0.75, // Range multiplier for multishot projectiles (75% range - shotgun-like)

    // Heavy Attack (Energy Beam)
    heavyAttackCooldown: 2,    // Cooldown for heavy attack (seconds) - increased by 5%
    beamDuration: 1.5,             // Total beam fire time (seconds)
    beamTickRate: 0.2,             // Time between damage ticks (seconds)
    beamDamagePerTick: 0.6,        // Damage multiplier per tick (~7 ticks over beamDuration)
    beamRange: 800,                // Beam range (pixels) - matches bolt range
    beamWidth: 30,                 // Beam hitbox width (pixels)
    beamMaxPenetration: 2,         // Max enemies beam can pass through
    beamCharges: 2,                // Number of beam charges available

    // Special Ability (Blink)
    specialCooldown: 5.0,          // Special ability cooldown (seconds)
    blinkRange: 250,               // Maximum blink distance (pixels)
    blinkHoldMaxTime: 0.6,         // Mobile/controller hold time to reach max blink range (seconds)
    blinkMinRange: 60,             // Mobile/controller tap minimum blink distance (pixels)
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
        let upgradeBonuses = { damage: 0, defense: 0, speed: 0, cooldown: 0, health: 0, attackSpeed: 0 };
        if (typeof SaveSystem !== 'undefined') {
            const upgrades = SaveSystem.getUpgrades('hexagon');
            // Calculate bonuses using config values
            upgradeBonuses.damage = upgrades.damage * MAGE_CONFIG.damagePerLevel;
            upgradeBonuses.defense = upgrades.defense * MAGE_CONFIG.defensePerLevel;
            upgradeBonuses.speed = upgrades.speed * MAGE_CONFIG.speedPerLevel;
            upgradeBonuses.cooldown = upgrades.cooldown * MAGE_CONFIG.cooldownPerLevel;
            upgradeBonuses.health = upgrades.health * MAGE_CONFIG.healthPerLevel;
            upgradeBonuses.attackSpeed = upgrades.attackSpeed * MAGE_CONFIG.attackSpeedPerLevel;
        }

        // Set base stats from CONFIG (single source of truth)
        this.baseDamage = MAGE_CONFIG.baseDamage + upgradeBonuses.damage;
        this.baseMoveSpeed = MAGE_CONFIG.baseSpeed + upgradeBonuses.speed;
        this.initialBaseMoveSpeed = this.baseMoveSpeed; // Store original for level scaling
        this.baseDefense = MAGE_CONFIG.baseDefense + upgradeBonuses.defense;
        this.baseMaxHp = MAGE_CONFIG.baseHp + upgradeBonuses.health; // Store base max HP for gear calculations
        this.maxHp = MAGE_CONFIG.baseHp + upgradeBonuses.health;
        this.hp = MAGE_CONFIG.baseHp + upgradeBonuses.health;

        // Apply cooldown and attack speed upgrades
        this.cooldownReduction = Math.min(0.75, upgradeBonuses.cooldown); // Cap at 75%
        this.attackSpeedMultiplier = 1.0 + upgradeBonuses.attackSpeed;
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

        // Heavy attack cooldown and charges - MUST be set BEFORE updateEffectiveStats is called
        // Follow EXACT same pattern as rogue dodge charges
        this.heavyAttackCooldownTime = MAGE_CONFIG.heavyAttackCooldown;
        this.heavyAttackWindup = 0; // Instant fire for beam (no windup)
        this.baseBeamCharges = MAGE_CONFIG.beamCharges; // Store base value (2) - same as baseDodgeCharges for rogue
        this.maxBeamCharges = MAGE_CONFIG.beamCharges; // Set max (2) - same as maxDodgeCharges for rogue
        this.beamCharges = MAGE_CONFIG.beamCharges; // Start with max charges (2) - same as dodgeCharges for rogue
        this.beamChargeCooldowns = new Array(this.maxBeamCharges).fill(0); // Track cooldown per charge - same as dodgeChargeCooldowns for rogue


        // Blink special ability - decoy system
        this.blinkDecoyActive = false;
        this.blinkDecoyX = 0;
        this.blinkDecoyY = 0;
        this.blinkDecoyHealth = 0;
        this.blinkDecoyMaxHealth = MAGE_CONFIG.blinkDecoyMaxHealth;
        this.blinkDecoyHealthDecay = MAGE_CONFIG.blinkDecoyHealthDecay;
        this.blinkDecoyEntity = null;

        // Blink explosion at destination
        this.blinkExplosionActive = false;
        this.blinkExplosionElapsed = 0;
        this.blinkExplosionDuration = MAGE_CONFIG.blinkExplosionDuration;
        this.blinkExplosionX = 0;
        this.blinkExplosionY = 0;

        // Blink knockback (from explosion)
        this.blinkKnockbackVx = 0;
        this.blinkKnockbackVy = 0;

        // Blink preview / hold-charge system (mobile/controller)
        this.blinkPreviewActive = false;
        this.blinkPreviewX = 0;
        this.blinkPreviewY = 0;
        this.blinkPreviewDistance = 0;
        this.blinkHoldElapsed = 0;
        this.blinkCharging = false;

        // Beam heavy-attack aim telegraph (mobile/controller)
        this.beamPreviewActive = false;
        this.beamPreviewAngle = 0;

        // Class modifier storage
        this.projectileCountBonus = 0;
        this.blinkRangeBonus = 0;
        this.blinkDamageMultiplier = 1.0;
        this.blinkChainBlink = false;
        this.blinkDamagingTrail = false;
        this.blinkResetOnKill = false;
        this.beamChargeBonus = 0;
        this.beamTickRateReduction = 0;
        this.beamDurationMultiplier = 0;
        this.beamPenetrationBonus = 0;
        this.beamSplitOnHit = false;
        this.aoeRadiusBonus = 0;

        // Beam heavy attack state - support multiple simultaneous beams
        this.activeBeams = []; // Array of active beam objects

        // Update effective stats (will adjust maxBeamCharges based on bonuses, same as dodge charges)
        this.updateEffectiveStats();

        // Reapply upgrade bonuses after updateEffectiveStats (which resets these values)
        this.cooldownReduction = Math.min(0.75, upgradeBonuses.cooldown); // Cap at 75%
        this.attackSpeedMultiplier = 1.0 + upgradeBonuses.attackSpeed;

        // After updateEffectiveStats, sync heavyAttackCooldown with charge system (same as dodge system)
        // Set to 0 if we have charges, otherwise use time until the next charge is ready
        this.heavyAttackCooldown = this.beamCharges > 0
            ? 0
            : this.getNextChargeReadyTime(this.beamChargeCooldowns);

    }

    // Override updateEffectiveStats to apply beam bonuses
    updateEffectiveStats() {
        // Reset class modifier storage
        this.projectileCountBonus = 0;
        this.blinkRangeBonus = 0;
        this.blinkDamageMultiplier = 1.0;
        this.blinkChainBlink = false;
        this.blinkDamagingTrail = false;
        this.blinkResetOnKill = false;
        this.beamChargeBonus = 0;
        this.beamTickRateReduction = 0;
        this.beamDurationMultiplier = 0;
        this.beamPenetrationBonus = 0;
        this.beamSplitOnHit = false;
        this.aoeRadiusBonus = 0;

        // Call parent first (applies stat modifiers from cards)
        super.updateEffectiveStats();

        // Apply beam charge bonuses and resize cooldown array - follow EXACT same pattern as dodge charges in base class
        // Use baseBeamCharges (set in constructor) like base class uses baseDodgeCharges
        const baseCharges = this.baseBeamCharges || MAGE_CONFIG.beamCharges; // Default to config value if not set

        // Match base class pattern: Math.max(1, baseCharges + bonusCharges)
        // Since baseCharges is 2 for mage, this will be Math.max(1, 2 + bonusBeamCharges) = at least 2
        this.maxBeamCharges = Math.max(1, baseCharges + (this.bonusBeamCharges || 0));

        // Resize cooldown array if needed (same pattern as dodge charges)
        if (!this.beamChargeCooldowns) {
            this.beamChargeCooldowns = [];
        }
        while (this.beamChargeCooldowns.length < this.maxBeamCharges) {
            this.beamChargeCooldowns.push(0);
        }
        while (this.beamChargeCooldowns.length > this.maxBeamCharges) {
            this.beamChargeCooldowns.pop();
        }

        // Calculate current charges based on ready cooldowns (EXACT same pattern as base class for dodge)
        // Use helper function to count ready charges, just like base class does with getReadyDodgeCharges()
        // IMPORTANT: During base class constructor, beamChargeCooldowns might be newly created with all 0s
        // In that case, all charges should be ready (just like dodge system)
        this.beamCharges = this.maxBeamCharges > 1 ? this.getReadyBeamCharges() : (this.heavyAttackCooldown <= 0 ? 1 : 0);

        // Apply tick rate and duration multipliers
        this.effectiveBeamTickRate = MAGE_CONFIG.beamTickRate * Math.max(0.1, this.beamTickRateMultiplier);
        this.effectiveBeamDuration = MAGE_CONFIG.beamDuration * this.beamDurationMultiplier;

        // Apply penetration bonus
        this.effectiveBeamMaxPenetration = MAGE_CONFIG.beamMaxPenetration + this.bonusBeamPenetration;
    }

    // Helper function to count ready beam charges (same pattern as getReadyDodgeCharges in base class)
    getReadyBeamCharges() {
        if (!this.beamChargeCooldowns || this.beamChargeCooldowns.length === 0) {
            return 0;
        }
        let ready = 0;
        for (let i = 0; i < this.beamChargeCooldowns.length; i++) {
            const cooldown = Number.isFinite(this.beamChargeCooldowns[i]) ? this.beamChargeCooldowns[i] : 0;
            if (cooldown <= 0) {
                ready++;
            }
        }
        return ready;
    }

    // Override to apply Mage-specific class modifiers
    applyClassModifier(modifier) {
        // Call parent for universal modifiers
        super.applyClassModifier(modifier);

        // Handle Mage-specific modifiers
        if (modifier.class === 'hexagon') {
            switch (modifier.type) {
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
        // No defensive checks needed - updateEffectiveStats handles maxBeamCharges and array sizing

        // Don't use base cooldown, use our charge system instead
        // Consume a charge
        this.beamCharges = Math.max(0, this.beamCharges - 1);
        const longestActive = this.getLongestActiveCooldown(this.beamChargeCooldowns);

        // Find the first available charge slot and start its cooldown
        for (let i = 0; i < this.maxBeamCharges; i++) {
            const cooldown = Number.isFinite(this.beamChargeCooldowns[i]) ? this.beamChargeCooldowns[i] : 0;
            if (cooldown <= 0) {
                // Apply attack speed and weapon type to heavy attack cooldown
                const weaponCooldownMult = this.weaponCooldownMultiplier || 1.0;
                const effectiveHeavyCooldown = this.heavyAttackCooldownTime * weaponCooldownMult / (1 + (this.attackSpeedMultiplier - 1));

                // Overcharge: Chance to refund charge
                if (this.overchargeChance && this.overchargeChance > 0 && Math.random() < this.overchargeChance) {
                    this.beamChargeCooldowns[i] = 0;
                    this.beamCharges++; // Refund the charge
                } else {
                    this.beamChargeCooldowns[i] = effectiveHeavyCooldown + longestActive;
                }
                break;
            }
        }

        this.heavyAttackCooldown = this.beamCharges > 0
            ? 0
            : this.getNextChargeReadyTime(this.beamChargeCooldowns);
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
        const hasVolley = (this.projectileCountBonus || 0) > 0; // Volley adds to projectileCountBonus

        // Apply multishot multipliers (damage and range reduction for shotgun-like behavior)
        // If Volley is active, use Volley's damage per projectile multiplier instead
        let damageMultiplier = 1.0;
        if (hasVolley && this.volleyDamagePerProjectile) {
            damageMultiplier = this.volleyDamagePerProjectile; // Volley's reduced damage per projectile
        } else if (isMultishot) {
            damageMultiplier = MAGE_CONFIG.multishotDamageMultiplier;
        }
        const rangeMultiplier = isMultishot ? MAGE_CONFIG.multishotRangeMultiplier : 1.0;
        const weaponReach = typeof getWeaponProjectileReachMult === 'function' ? getWeaponProjectileReachMult(this) : 1.0;

        for (let i = 0; i < numProjectiles; i++) {
            // Calculate angle for this projectile
            const angleOffset = numProjectiles > 1 ? (i - (numProjectiles - 1) / 2) * spreadAngle : 0;
            const angle = Math.atan2(dirY, dirX) + angleOffset;
            const projDirX = Math.cos(angle);
            const projDirY = Math.sin(angle);

            const projectile = {
                x: pos.x,
                y: pos.y,
                vx: projDirX * MAGE_CONFIG.boltSpeed * (this.projectileSpeedMultiplier || 1.0),
                vy: projDirY * MAGE_CONFIG.boltSpeed * (this.projectileSpeedMultiplier || 1.0),
                damage: this.damage * damageMultiplier,
                size: MAGE_CONFIG.boltSize,
                lifetime: MAGE_CONFIG.boltLifetime * rangeMultiplier * weaponReach,
                elapsed: 0,
                type: 'magic',
                color: this.color,
                playerId: this.playerId || (typeof Game !== 'undefined' && Game.getLocalPlayerId ? Game.getLocalPlayerId() : null), // For damage attribution
                lifestealBatchId: this._lifestealSwingId || 0
            };

            // Apply Volley pierce/chain bonuses if active
            if (hasVolley) {
                if (this.volleyPierceAll) {
                    projectile.pierceAll = true;
                } else if (this.volleyPierceChance && Math.random() < this.volleyPierceChance) {
                    projectile.pierce = true;
                }
                if (this.volleyChain) {
                    projectile.hasChainEffect = true; // Mark for chain lightning on hit
                }
            }

            Game.projectiles.push(projectile);
            if (typeof configureParallelPlayerProjectile === 'function') {
                const twin = configureParallelPlayerProjectile(this, projectile);
                if (twin) Game.projectiles.push(twin);
            }
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
        if (this._beamIdCounter == null) this._beamIdCounter = 0;
        const isParallel = typeof playerWeaponIsParallel === 'function' && playerWeaponIsParallel(this);
        const damageShare = isParallel
            ? (typeof getWeaponPerHitDamageShare === 'function' ? getWeaponPerHitDamageShare(this) : 0.5)
            : 1.0;
        const reachMult = typeof getWeaponMeleeReachMult === 'function'
            ? getWeaponMeleeReachMult(this)
            : (this.weaponRangeMultiplier || 1.0);

        const newBeam = {
            beamId: ++this._beamIdCounter,
            elapsed: 0,
            lastTickTime: 0,
            damageTickCount: 0,
            origin: { x: pos.x, y: pos.y },
            direction: {
                x: Math.cos(this.rotation),
                y: Math.sin(this.rotation)
            },
            hitEnemies: new Map(), // Track hit count per enemy for this beam
            playerId: this.playerId || (typeof Game !== 'undefined' && Game.getLocalPlayerId ? Game.getLocalPlayerId() : null), // For damage attribution
            damageShare,
            beamRangeMult: reachMult,
            isParallelSecond: false,
            activateAfter: 0
        };

        // Add to active beams array
        this.activeBeams.push(newBeam);

        // Parallel: delayed twin beam at half tick damage (parity total, denser status ticks)
        if (isParallel) {
            const twinDelay = typeof getWeaponDualStaggerSec === 'function' ? getWeaponDualStaggerSec(this) : 0.055;
            this.activeBeams.push({
                beamId: ++this._beamIdCounter,
                elapsed: 0,
                lastTickTime: 0,
                damageTickCount: 0,
                origin: { x: pos.x, y: pos.y },
                direction: {
                    x: Math.cos(this.rotation),
                    y: Math.sin(this.rotation)
                },
                hitEnemies: new Map(),
                playerId: newBeam.playerId,
                damageShare,
                beamRangeMult: reachMult,
                isParallelSecond: true,
                activateAfter: twinDelay,
                hasChainedLegendary: false
            });
        }

        this.isAttacking = true;

        // NOTE: applyHeavyAttackCooldown is called by the base class after createHeavyAttack returns
        // Do NOT call it here or it will be called twice!

        // Screen shake on heavy fire; hitpause waits for first connect
        if (typeof Game !== 'undefined') {
            Game.triggerScreenShake(0.3, 0.15);
        }
    }

    getBlinkMaxRange() {
        return 400 + (this.blinkRangeBonus || 0);
    }

    getBlinkHoldDistance() {
        const maxRange = this.getBlinkMaxRange();
        const minRange = MAGE_CONFIG.blinkMinRange;
        const holdMax = MAGE_CONFIG.blinkHoldMaxTime;
        const progress = holdMax > 0 ? Math.min(1, this.blinkHoldElapsed / holdMax) : 1;
        return minRange + progress * (maxRange - minRange);
    }

    resetBlinkHoldState() {
        this.blinkHoldElapsed = 0;
        this.blinkCharging = false;
        this.blinkPreviewActive = false;
    }

    // Override handleSpecialAbility for blink hold-scale (touch/pad) vs immediate cursor blink (M&K)
    handleSpecialAbility(input) {
        if (input.isTouchMode && input.isTouchMode()) {
            if (input.touchButtons && input.touchButtons.specialAbility) {
                const button = input.touchButtons.specialAbility;
                const specialType = (input.getAbilityInputType &&
                    input.getAbilityInputType(this.playerClass, 'specialAbility')) || 'joystick-press-release';

                if (specialType === 'button') {
                    // Tap: fire immediately along current facing (no drag / hold aim)
                    if (button.justPressed && this.specialCooldown <= 0 && !this.blinkDecoyActive) {
                        this.blinkCharging = false;
                        this.blinkHoldElapsed = 0;
                        this.blinkPreviewActive = false;
                        this.activateBlink(input);
                    }
                } else {
                    // Aim-then-release (or hold-aim adapted to press-release): hold scales distance
                    if (button.justPressed && this.specialCooldown <= 0 && !this.blinkDecoyActive) {
                        this.blinkCharging = true;
                        this.blinkHoldElapsed = 0;
                        this.updateBlinkPreview(input);
                    }
                    if (button.justReleased && this.specialCooldown <= 0 && this.blinkCharging && !this.blinkDecoyActive) {
                        this.updateBlinkPreview(input);
                        this.activateBlink(input);
                    }
                }
            }
        } else {
            // Keyboard/mouse: immediate blink toward cursor on spacebar press (no hold/release)
            const spaceJustPressed = input.getKeyState(' ') && !this.lastSpacebar;
            this.lastSpacebar = input.getKeyState(' ');
            if (spaceJustPressed && this.specialCooldown <= 0) {
                this.activateBlink(input);
            }
        }
    }

    // Override activateSpecialAbility for blink
    activateSpecialAbility(input) {
        this.activateBlink(input);
    }

    updateBlinkPreview(input) {
        this.blinkPreviewActive = true;

        const maxRange = this.getBlinkMaxRange();
        let targetX, targetY;
        let distance = maxRange;

        if (input.isTouchMode && input.isTouchMode()) {
            // Touch/controller: stick aims angle only; distance scales with hold time
            distance = this.getBlinkHoldDistance();
            let angle = this.rotation;

            const joystick = input.touchJoysticks && input.touchJoysticks.specialAbility;
            if (joystick && joystick.active && joystick.getMagnitude() > 0.1) {
                angle = joystick.getAngle ? joystick.getAngle() : Math.atan2(
                    joystick.getDirection().y,
                    joystick.getDirection().x
                );
            } else if (input.getAimDirection) {
                angle = input.getAimDirection();
            }

            targetX = this.x + Math.cos(angle) * distance;
            targetY = this.y + Math.sin(angle) * distance;
        } else {
            // Mouse mode: use world mouse position (accounts for camera)
            const worldMouse = Input.getWorldMousePos ? Input.getWorldMousePos() : input.mouse;
            const mouseX = worldMouse.x || this.x;
            const mouseY = worldMouse.y || this.y;
            const dx = mouseX - this.x;
            const dy = mouseY - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > 0) {
                distance = Math.min(maxRange, dist);
                const angle = Math.atan2(dy, dx);
                targetX = this.x + Math.cos(angle) * distance;
                targetY = this.y + Math.sin(angle) * distance;
            } else {
                targetX = this.x + Math.cos(this.rotation) * MAGE_CONFIG.blinkMinRange;
                targetY = this.y + Math.sin(this.rotation) * MAGE_CONFIG.blinkMinRange;
                distance = MAGE_CONFIG.blinkMinRange;
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
        // Track ability use for lifetime stats
        if (typeof window.trackLifetimeStat === 'function') {
            window.trackLifetimeStat('totalAbilityUses', 1);
        }

        // Play mage blink sound
        if (typeof AudioManager !== 'undefined' && AudioManager.sounds) {
            AudioManager.sounds.mageBlink();
        }

        // Save old position for decoy
        const oldX = this.x;
        const oldY = this.y;

        // Get target position (use hold-scaled preview on touch/pad; cursor on M&K)
        let targetX, targetY;

        if (input.isTouchMode && input.isTouchMode()) {
            if (this.blinkPreviewActive) {
                targetX = this.blinkPreviewX;
                targetY = this.blinkPreviewY;
            } else {
                // Fallback: facing direction at current hold distance (or min hop)
                const distance = this.blinkCharging ? this.getBlinkHoldDistance() : MAGE_CONFIG.blinkMinRange;
                targetX = this.x + Math.cos(this.rotation) * distance;
                targetY = this.y + Math.sin(this.rotation) * distance;
            }

            // Clear any stored joystick magnitude state — distance is hold-based now
            const button = input.touchButtons && input.touchButtons.specialAbility;
            if (button) {
                button.finalJoystickState = null;
            }
        } else {
            // Mouse mode: blink toward world mouse position
            const worldMouse = Input.getWorldMousePos ? Input.getWorldMousePos() : input.mouse;
            targetX = worldMouse.x || this.x;
            targetY = worldMouse.y || this.y;
        }

        // Clear preview / hold charge after using it
        this.resetBlinkHoldState();

        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        let newX, newY;
        const maxBlinkRange = this.getBlinkMaxRange();
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

        const blinkTravel = Math.sqrt((this.x - oldX) ** 2 + (this.y - oldY) ** 2);
        if (typeof LedgerManager !== 'undefined' && LedgerManager.recordEvent) {
            LedgerManager.recordEvent('blink', { distance: blinkTravel, player: this });
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
                            applyLifesteal(this, damageDealt, { enemy, source: 'ability' });
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
                        }
                        if (typeof hostBroadcastDamageNumber === 'function') {
                            hostBroadcastDamageNumber(enemy.x, enemy.y, damageDealt, {
                                enemyId: enemy.id,
                                isCrit
                            });
                        }

                        // Push enemies away from explosion
                        const pushForce = MAGE_CONFIG.blinkExplosionKnockback;
                        const pushDirX = (enemy.x - this.x) / distance;
                        const pushDirY = (enemy.y - this.y) / distance;
                        const sourceId = this.playerId || this.id || null;
                        if (typeof enemy.applyImpulse === 'function') {
                            enemy.applyImpulse(pushDirX * pushForce, pushDirY * pushForce, { sourceId });
                        } else if (typeof enemy.applyKnockback === 'function') {
                            enemy.applyKnockback(pushDirX * pushForce, pushDirY * pushForce, sourceId);
                        }
                    }
                }
            });
        }

        // Apply cooldown reduction
        const effectiveSpecialCooldown = this.specialCooldownTime * (1 - this.cooldownReduction);
        this.specialCooldown = effectiveSpecialCooldown;
        this.invulnerable = true;
        this.invulnerabilityTime = 1.2; // 1.2s post-teleport i-frames for safer dashing through enemies
        this.updateBlinkDecoyEntity();
    }

    updateBlinkDecoyEntity() {
        if (!this.blinkDecoyEntity) {
            this.blinkDecoyEntity = {
                owner: this,
                takeDamage: (amount = 0, options = {}) => this.applyBlinkDecoyDamage(amount, options),
                invulnerable: false
            };
        }

        const entity = this.blinkDecoyEntity;
        entity.x = this.blinkDecoyX;
        entity.y = this.blinkDecoyY;
        entity.size = this.size;
        entity.maxHp = this.blinkDecoyMaxHealth;
        entity.health = this.blinkDecoyHealth;
        entity.hp = this.blinkDecoyHealth;
        entity.alive = this.blinkDecoyActive && this.blinkDecoyHealth > 0;
        entity.dead = !entity.alive;
        entity.playerClass = this.playerClass;
        entity.ownerId = this.playerId || null;
        entity.applyKnockback = entity.applyKnockback || (() => { });

        return entity;
    }

    getBlinkDecoyTarget() {
        if (!this.blinkDecoyActive || this.blinkDecoyHealth <= 0) {
            if (this.blinkDecoyEntity) {
                this.blinkDecoyEntity.alive = false;
                this.blinkDecoyEntity.dead = true;
                this.blinkDecoyEntity.health = 0;
                this.blinkDecoyEntity.hp = 0;
            }
            return null;
        }
        return this.updateBlinkDecoyEntity();
    }

    applyBlinkDecoyDamage(amount = 0, options = {}) {
        if (!this.blinkDecoyActive || this.blinkDecoyHealth <= 0) {
            return 0;
        }

        const damage = Math.max(0, amount);
        if (damage <= 0) return 0;

        this.blinkDecoyHealth = Math.max(0, this.blinkDecoyHealth - damage);

        const {
            showNumber = true,
            particleColor = '#96c8ff',
            particleCount = 4
        } = options;

        if (showNumber && typeof createDamageNumber !== 'undefined') {
            createDamageNumber(this.blinkDecoyX, this.blinkDecoyY, damage, false, false);
        }

        if (particleColor && typeof createParticleBurst !== 'undefined') {
            createParticleBurst(this.blinkDecoyX, this.blinkDecoyY, particleColor, particleCount);
        }

        if (this.blinkDecoyHealth <= 0) {
            this.blinkDecoyHealth = 0;
            this.blinkDecoyActive = false;
        }

        this.updateBlinkDecoyEntity();
        return damage;
    }

    // Override updateClassAbilities for Mage-specific updates
    updateClassAbilities(deltaTime, input) {
        // Mobile/controller blink: tick hold charge, update aim preview, auto-fire at max hold
        // Charging is started on justPressed in handleSpecialAbility (so taps still get the min hop).
        if (input && input.isTouchMode && input.isTouchMode() &&
            input.touchButtons && input.touchButtons.specialAbility) {
            const button = input.touchButtons.specialAbility;
            const canCharge = this.blinkCharging && button.pressed &&
                this.specialCooldown <= 0 && !this.blinkDecoyActive;

            if (canCharge) {
                this.blinkHoldElapsed += deltaTime;
                this.updateBlinkPreview(input);

                if (this.blinkHoldElapsed >= MAGE_CONFIG.blinkHoldMaxTime) {
                    this.activateBlink(input);
                }
            } else if (this.blinkCharging && !button.pressed) {
                // Released without firing (blocked / cancelled) — clear charge state
                this.resetBlinkHoldState();
            }
        }

        // Update beam charge cooldowns - follow EXACT same pattern as dodge charges in base class update()
        // Tick down cooldowns for each charge
        for (let i = 0; i < this.maxBeamCharges; i++) {
            const rawValue = this.beamChargeCooldowns[i];
            let cooldown = Number.isFinite(rawValue) ? rawValue : 0;
            if (cooldown > 0) {
                cooldown = Math.max(0, cooldown - deltaTime);
                this.beamChargeCooldowns[i] = cooldown;
            } else {
                this.beamChargeCooldowns[i] = 0;
            }
        }

        // Update beamCharges count using helper function (same as dodge system)
        this.beamCharges = this.getReadyBeamCharges();

        // Sync heavyAttackCooldown with charge system for UI and base class checks
        // Set to 0 if we have charges, otherwise use time until the next charge is ready
        this.heavyAttackCooldown = this.beamCharges > 0
            ? 0
            : this.getNextChargeReadyTime(this.beamChargeCooldowns);

        // Override UIBus emission for Mage to send beam charge data instead of single heavy bar
        // This prevents the base class's single "Heavy" bar from overriding our segmented bars
        if (typeof window !== 'undefined' && window.UIBus && typeof window.UIBus.emit === 'function') {
            try {
                const bars = [];
                // Dodge bars (use base class logic)
                const dodgeMaxForUi = Math.max(0.0001, Number.isFinite(this.dodgeCooldownTime) ? this.dodgeCooldownTime : 2.0);
                if (this.dodgeChargeCooldowns && Array.isArray(this.dodgeChargeCooldowns) && this.dodgeChargeCooldowns.length > 0) {
                    for (let i = 0; i < this.dodgeChargeCooldowns.length; i++) {
                        const rem = Math.max(0, Number.isFinite(this.dodgeChargeCooldowns[i]) ? this.dodgeChargeCooldowns[i] : 0);
                        bars.push({ type: 'dodge', label: 'D', remaining: rem, max: dodgeMaxForUi });
                    }
                } else {
                    bars.push({ type: 'dodge', label: 'Dodge', remaining: this.cooldowns.dodge.remaining, max: dodgeMaxForUi });
                }
                // Special (blink)
                bars.push({ type: 'special', label: 'Special', remaining: this.cooldowns.special.remaining, max: this.cooldowns.special.max });
                // Beam charges (MAGE-SPECIFIC - send per-charge data instead of single heavy bar)
                const beamMaxForUi = Math.max(0.0001, Number.isFinite(this.heavyAttackCooldownTime) ? this.heavyAttackCooldownTime : 2.0);
                if (this.beamChargeCooldowns && Array.isArray(this.beamChargeCooldowns) && this.beamChargeCooldowns.length > 0) {
                    for (let i = 0; i < this.beamChargeCooldowns.length; i++) {
                        const rem = Math.max(0, Number.isFinite(this.beamChargeCooldowns[i]) ? this.beamChargeCooldowns[i] : 0);
                        bars.push({ type: 'beam', label: 'B', remaining: rem, max: beamMaxForUi });
                    }
                } else {
                    // Fallback to single bar if charge system not initialized
                    bars.push({ type: 'heavy', label: 'Heavy', remaining: this.cooldowns.heavy.remaining, max: this.cooldowns.heavy.max });
                }
                window.UIBus.emit('cooldowns:update', { bars });
                // Set flag to prevent base class from emitting and overwriting our beam charge data
                this._cooldownsAlreadyEmitted = true;
            } catch (e) {
                // Avoid spamming console on every frame
            }
        }

        // Update blink decoy - health decay system
        if (this.blinkDecoyActive) {
            this.blinkDecoyHealth = Math.max(0, this.blinkDecoyHealth - this.blinkDecoyHealthDecay * deltaTime);

            if (this.blinkDecoyHealth <= 0) {
                this.blinkDecoyHealth = 0;
                this.blinkDecoyActive = false;
            }

            this.updateBlinkDecoyEntity();
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
                    this.applyBlinkDecoyDamage(projectile.damage || 10, {
                        showNumber: false
                    });
                    projectile.lifetime = 0;
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

        // Blink self-knockback (if any) feeds the shared impulse channel
        if (this.blinkKnockbackVx || this.blinkKnockbackVy) {
            if (typeof this.applyImpulse === 'function') {
                this.applyImpulse(this.blinkKnockbackVx || 0, this.blinkKnockbackVy || 0, { resistance: 1 });
            }
            this.blinkKnockbackVx = 0;
            this.blinkKnockbackVy = 0;
        }

        // Update all active beams
        for (let i = this.activeBeams.length - 1; i >= 0; i--) {
            const beam = this.activeBeams[i];

            // Parallel twin: wait before becoming active (doesn't consume duration yet)
            if (beam.activateAfter != null && beam.activateAfter > 0) {
                beam.activateAfter -= deltaTime;
                continue;
            }

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
        const beamRange = MAGE_CONFIG.beamRange * (beam.beamRangeMult || this.weaponRangeMultiplier || 1.0);
        if (typeof Game === 'undefined' || !Game.enemies) {
            return {
                endX: beam.origin.x + beam.direction.x * beamRange,
                endY: beam.origin.y + beam.direction.y * beamRange,
                enemiesHit: 0
            };
        }

        const beamWidth = MAGE_CONFIG.beamWidth;
        const maxPenetration = this.effectiveBeamMaxPenetration || MAGE_CONFIG.beamMaxPenetration;

        // Find all enemies in beam path
        const hitCandidates = [];

        Game.enemies.forEach(enemy => {
            if (!enemy.alive) return;

            const beamHit = typeof getEnemyBeamHit === 'function'
                ? getEnemyBeamHit(enemy, beam.origin, beam.direction.x, beam.direction.y, beamRange, beamWidth)
                : null;
            if (!beamHit) {
                const dx = enemy.x - beam.origin.x;
                const dy = enemy.y - beam.origin.y;
                const projection = dx * beam.direction.x + dy * beam.direction.y;
                if (projection < 0 || projection > beamRange) return;
                const perpX = dx - projection * beam.direction.x;
                const perpY = dy - projection * beam.direction.y;
                const perpDist = Math.sqrt(perpX * perpX + perpY * perpY);
                if (perpDist > beamWidth / 2 + enemy.size) return;
                hitCandidates.push({ enemy, distance: projection, hitX: enemy.x, hitY: enemy.y });
                return;
            }
            hitCandidates.push({ enemy, distance: beamHit.distance, hitX: beamHit.hitX, hitY: beamHit.hitY });
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

        beam.damageTickCount = (beam.damageTickCount || 0) + 1;
        const beamPulseKey = `${beam.beamId}:${beam.damageTickCount}`;

        const beamRange = MAGE_CONFIG.beamRange * (beam.beamRangeMult || this.weaponRangeMultiplier || 1.0);
        const beamWidth = MAGE_CONFIG.beamWidth;
        const maxPenetration = this.effectiveBeamMaxPenetration || MAGE_CONFIG.beamMaxPenetration;
        const share = (beam.damageShare != null) ? beam.damageShare : 1.0;
        const baseTickDamage = this.damage * MAGE_CONFIG.beamDamagePerTick * share;
        const hitProxy = { isParallelSecond: !!beam.isParallelSecond };
        const allowProc = typeof shouldRollWeaponProcOnHit !== 'function'
            || shouldRollWeaponProcOnHit(this, hitProxy);
        const allowStatus = typeof shouldApplyWeaponStatusOnHit !== 'function'
            || shouldApplyWeaponStatusOnHit(this, hitProxy);

        // Find enemies in beam path, sorted by distance
        const hitCandidates = [];

        Game.enemies.forEach(enemy => {
            if (!enemy.alive) return;

            const beamHit = typeof getEnemyBeamHit === 'function'
                ? getEnemyBeamHit(enemy, beam.origin, beam.direction.x, beam.direction.y, beamRange, beamWidth)
                : null;
            if (!beamHit) {
                const dx = enemy.x - beam.origin.x;
                const dy = enemy.y - beam.origin.y;
                const projection = dx * beam.direction.x + dy * beam.direction.y;
                if (projection < 0 || projection > beamRange) return;
                const perpX = dx - projection * beam.direction.x;
                const perpY = dy - projection * beam.direction.y;
                const perpDist = Math.sqrt(perpX * perpX + perpY * perpY);
                if (perpDist > beamWidth / 2 + enemy.size) return;
                hitCandidates.push({ enemy, distance: projection, hitX: enemy.x, hitY: enemy.y });
                return;
            }
            hitCandidates.push({ enemy, distance: beamHit.distance, hitX: beamHit.hitX, hitY: beamHit.hitY });
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
            // Full damage at origin (0), softer reduction at max range so kite-range beams still hit hard
            // Linear falloff: 1.0 at 0px, 0.5 at max range (50% reduction at far end)
            const distanceRatio = candidate.distance / beamRange;
            const damageFalloff = 1.0 - (distanceRatio * 0.5); // 100% at origin, 50% at max range
            const tickDamage = baseTickDamage * Math.max(0.5, damageFalloff); // Minimum 50% damage at max range

            // Check for crit
            const isCrit = allowProc && Math.random() < (this.critChance || 0);
            const critMultiplier = isCrit ? (2.0 * (this.critDamageMultiplier || 1.0)) : 1.0;
            const finalDamage = tickDamage * critMultiplier;

            // Calculate actual damage dealt
            const damageDealt = Math.min(finalDamage, enemy.hp);

            // Get player ID from beam for damage attribution
            const attackerId = beam.playerId;

            if (enemy.isBoss && typeof enemy.takeDamage === 'function') {
                enemy.takeDamage(finalDamage, candidate.hitX, candidate.hitY, beamWidth / 2, attackerId);
            } else {
                enemy.takeDamage(finalDamage, attackerId);
            }

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

            // Track beam damage for lifetime stats
            if (typeof window.trackLifetimeStat === 'function') {
                window.trackLifetimeStat('totalBeamDamage', damageDealt);
            }

            // Apply lifesteal
            if (typeof applyLifesteal !== 'undefined') {
                applyLifesteal(this, damageDealt, { enemy, source: 'beam', pulseKey: beamPulseKey });
            }

            // Apply legendary effects (burn, freeze) and chain lightning
            if (allowStatus && typeof applyLegendaryEffects !== 'undefined') {
                applyLegendaryEffects(this, enemy, damageDealt, attackerId);
            }
            // Chain lightning (separate check to prevent multiple chains per beam)
            if (allowStatus && this.activeLegendaryEffects && !beam.hasChainedLegendary) {
                this.activeLegendaryEffects.forEach(effect => {
                    if (effect.type === 'chain_lightning' && typeof chainLightningAttack !== 'undefined') {
                        chainLightningAttack(this, enemy, effect, finalDamage);
                        beam.hasChainedLegendary = true;
                    }
                });
            }

            if (typeof createDamageNumber !== 'undefined') {
                createDamageNumber(enemy.x, enemy.y, damageDealt, isCrit, false);
            }
            if (typeof hostBroadcastDamageNumber === 'function') {
                hostBroadcastDamageNumber(enemy.x, enemy.y, damageDealt, {
                    enemyId: enemy.id,
                    isCrit
                });
            }

            hitCount++;
            if (hitCount >= maxPenetration) break;
        }
        if (hitCount > 0 && typeof LedgerManager !== 'undefined' && LedgerManager.recordEvent) {
            LedgerManager.recordEvent('beamPierce', { count: hitCount, player: this });
        }
    }

    // Beam aim telegraph (mobile/controller hold-to-aim)
    initHeavyAttackPreview() {
        this.beamPreviewActive = true;
        this.beamPreviewAngle = this.rotation;
    }

    updateHeavyAttackPreview(input) {
        if (!input || !input.isTouchMode || !input.isTouchMode()) return;

        this.beamPreviewActive = true;

        if (input.touchJoysticks && input.touchJoysticks.heavyAttack) {
            const joystick = input.touchJoysticks.heavyAttack;
            if (joystick.active && joystick.getMagnitude() > 0.1) {
                this.beamPreviewAngle = joystick.getAngle ? joystick.getAngle() : this.rotation;
            } else {
                this.beamPreviewAngle = this.rotation;
            }
        } else {
            this.beamPreviewAngle = this.rotation;
        }
    }

    clearHeavyAttackPreview() {
        this.beamPreviewActive = false;
    }

    // Override renderClassVisuals for Mage-specific visuals
    renderClassVisuals(ctx) {
        // Draw beam aim telegraph while charging heavy on mobile/controller
        if (this.beamPreviewActive) {
            ctx.save();

            const reachMult = typeof getWeaponMeleeReachMult === 'function'
                ? getWeaponMeleeReachMult(this)
                : (this.weaponRangeMultiplier || 1.0);
            const beamRange = MAGE_CONFIG.beamRange * reachMult;
            const beamWidth = MAGE_CONFIG.beamWidth;
            const halfW = beamWidth / 2;
            const angle = this.beamPreviewAngle;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            const px = -sin; // perpendicular
            const py = cos;

            const x1 = this.x + px * halfW;
            const y1 = this.y + py * halfW;
            const x2 = this.x - px * halfW;
            const y2 = this.y - py * halfW;
            const x3 = this.x + cos * beamRange - px * halfW;
            const y3 = this.y + sin * beamRange - py * halfW;
            const x4 = this.x + cos * beamRange + px * halfW;
            const y4 = this.y + sin * beamRange + py * halfW;

            const pulse = Math.sin(Date.now() / 150) * 0.2 + 0.8;

            // Soft fill corridor
            ctx.fillStyle = `rgba(156, 39, 176, ${0.12 * pulse})`;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x4, y4);
            ctx.lineTo(x3, y3);
            ctx.lineTo(x2, y2);
            ctx.closePath();
            ctx.fill();

            // Dashed corridor edges
            ctx.strokeStyle = `rgba(186, 104, 200, ${0.7 * pulse})`;
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x4, y4);
            ctx.moveTo(x2, y2);
            ctx.lineTo(x3, y3);
            ctx.stroke();

            // End cap
            ctx.strokeStyle = `rgba(225, 190, 231, ${0.55 * pulse})`;
            ctx.beginPath();
            ctx.moveTo(x4, y4);
            ctx.lineTo(x3, y3);
            ctx.stroke();

            // Center aim line
            ctx.strokeStyle = `rgba(206, 147, 216, ${0.5 * pulse})`;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.x + cos * beamRange, this.y + sin * beamRange);
            ctx.stroke();

            ctx.setLineDash([]);
            ctx.restore();
        }

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
            ctx.font = 'bold 12px Orbitron';
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
            if (beam.activateAfter != null && beam.activateAfter > 0) return;
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
            const degraded = typeof Game !== 'undefined' && Game.renderQuality &&
                Game.renderQuality.gearRingPoints <= 32;
            const numParticles = degraded ? 4 : 8;
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
            // Beam attack state (omit hitEnemies Map - clients raycast for visuals)
            activeBeams: (this.activeBeams || []).map(b => ({
                beamId: b.beamId,
                elapsed: b.elapsed,
                lastTickTime: b.lastTickTime,
                damageTickCount: b.damageTickCount,
                origin: b.origin ? { x: b.origin.x, y: b.origin.y } : null,
                direction: b.direction ? { x: b.direction.x, y: b.direction.y } : null,
                playerId: b.playerId || null,
                activateAfter: b.activateAfter || 0,
                beamRangeMult: b.beamRangeMult || 1,
                damageShare: b.damageShare != null ? b.damageShare : 1,
                isParallelSecond: !!b.isParallelSecond
            })),
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
        if (state.activeBeams !== undefined) {
            this.activeBeams = (state.activeBeams || []).map(b => ({
                ...b,
                origin: b.origin ? { ...b.origin } : { x: 0, y: 0 },
                direction: b.direction ? { ...b.direction } : { x: 1, y: 0 },
                hitEnemies: b.hitEnemies instanceof Map ? b.hitEnemies : new Map()
            }));
        }
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

