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

const PLAYER_INTEGRATE_MOVE_FN = (dx, dy, entity, out) => {
    const startX = entity.x;
    const startY = entity.y;
    entity.x += dx;
    entity.y += dy;
    const collided = entity.resolveWorldCollision(startX, startY);
    const actualDx = entity.x - startX;
    const actualDy = entity.y - startY;
    const actualMoved = Math.sqrt(actualDx * actualDx + actualDy * actualDy);
    const intendedMoved = Math.sqrt(dx * dx + dy * dy);
    const blocked = !!collided && actualMoved < intendedMoved * 0.3;
    // Also treat significant axis clamping as contact even if resolve returned false
    // (e.g. room-bound clamp that still left some progress).
    const lostContact = intendedMoved > 0.001 && actualMoved < intendedMoved * 0.92;

    out.ok = !collided || actualMoved > 0.001;
    out.blocked = blocked || (collided && lostContact);
    out.actualMoved = actualMoved;
    out.intendedMoved = intendedMoved;
    out.actualDx = actualDx;
    out.actualDy = actualDy;
    out.normalX = null;
    out.normalY = null;
    return out;
};

const PLAYER_INTEGRATE_AFTER_DECAY = (entity) => {
    if (entity.pullForceDampFrames > 0) {
        entity.impulseVx *= entity.pullForceDampFactor || 0.85;
        entity.impulseVy *= entity.pullForceDampFactor || 0.85;
        entity.pullForceDampFrames--;
        const stopThreshold = entity.pullForceDampThreshold || 0.5;
        if (Math.abs(entity.impulseVx) < stopThreshold) entity.impulseVx = 0;
        if (Math.abs(entity.impulseVy) < stopThreshold) entity.impulseVy = 0;
        if (entity.impulseVx === 0 && entity.impulseVy === 0) {
            entity.pullForceDampFrames = 0;
        }
    }
};

class PlayerBase {
    constructor(x = 400, y = 300) {
        // Position
        this.x = x;
        this.y = y;
        this.prevX = x;
        this.prevY = y;
        this.lastSafeX = x;
        this.lastSafeY = y;
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
        this.anchorHp = 100; // Max recoverable HP anchor (HP before damage episode)
        this.scratch = 0; // Renewable scratch damage buffer
        this.scratchGraceTimer = 0; // Delay before scratch conversion starts (3.5s flat)
        this.scratchPulseTimer = 0; // Visual cue duration when grace period begins
        this.scratchBurnTimer = 0; // Visual cue duration when scratch is burned on re-hit
        this.level = 1;

        // XP system
        this.xp = 0;
        this.xpToNext = 100;
        this.totalXpEarned = 0;
        this.lastLevelBonusesApplied = 1; // Track last level we applied bonuses for (prevent double application)
        this.cooldownRegenMult = 1;

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
        this.queuedDodgeTime = 0; // Timestamp buffer for dodge during active attack frames
        this.attackRecoveryRemaining = 0;
        this.turnRateMultiplier = 1.0;
        this.weaponRecoveryScale = 1.0;
        this.weaponHitpauseScale = 1.0;
        this.weaponPerHitDamageShare = 1.0;
        this.weaponDualStaggerMs = 0;
        this.weaponProjectileRangeBonus = 0;
        this.weaponOnHitPolicy = { status: 'perSwing', proc: 'perSwing', sustain: 'perSwing' };
        this._wasAttacking = false;

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
        this._maintainDashTrail = false;
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

        // Item system
        this.itemManager = new ItemManager(this);

        // Item-derived stats (applied by items)
        this.itemDamageBonus = 0;
        this.itemCritChance = 0;
        this.itemCritDamage = 0;
        this.itemSpeedBonus = 0;
        this.itemShieldPercent = 0;
        this.itemHpRegenPercent = 0;
        this.itemReflectPercent = 0;

        // Offensive item effects
        this.itemChainReactionDamage = 0;
        this.itemChainReactionRadius = 0;
        this.itemBleedDamagePercent = 0;
        this.itemBleedDuration = 0;
        this.itemBleedMaxStacks = 0;
        this.itemExecuteDamagePercent = 0;
        this.itemExecuteThreshold = 0;
        this.itemVolatileChance = 0;
        this.itemVolatileDamagePercent = 0;
        this.itemVolatileRadius = 0;
        this.itemPierceCount = 0;
        this.itemPierceDamagePercent = 0;

        // Shield system (from items)
        this.shieldHealth = 0;
        this.maxShieldHealth = 0;
        this.shieldRegenTimer = 0;
        this.shieldRegenDelay = 5.0; // 5 seconds without damage before regen starts
        this.lastDamageTime = 0;
        this.lastDamageAmount = 0; // Track damage amount from last hit for visual effects
        this.reactiveArmorValue = 0;
        this.reactiveArmorMaxCap = 0;
        this.reactiveArmorDuration = 0;
        this.reactiveArmorStacks = 0;
        this.reactiveArmorTimer = 0;

        // Heavy attack animations
        this.heavyChargeEffectActive = false;
        this.heavyChargeEffectElapsed = 0;
        this.heavyChargeEffectDuration = 0.3;

        // Unified impulse system (knockback + pull share one velocity)
        this.impulseVx = 0;
        this.impulseVy = 0;
        this.impulseDecay = 0.2125; // ~78.75% reduction per second
        this.impulseMaxSpeed = 800;
        this.impulseCutoff = 12.0;
        this.impulseMaxDuration = 2.0;
        this.impulseTimer = 0;
        this.lastImpulseSourceId = null;
        this.knockbackResistance = 1.0; // Higher = less displacement from hits
        this.hasKnockbackImmunity = false;

        // Pull damp helpers (still applied during impulse integrate)
        this.pullDecay = 0.85;
        this.pullForceDampFrames = 0;
        this.pullForceDampFactor = 0.85;
        this.pullForceDampThreshold = 0.1;

        // Legacy aliases kept for call sites / serialization that still use old names
        Object.defineProperties(this, {
            pullForceVx: {
                get() { return this.impulseVx; },
                set(v) { this.impulseVx = v || 0; },
                enumerable: true,
                configurable: true
            },
            pullForceVy: {
                get() { return this.impulseVy; },
                set(v) { this.impulseVy = v || 0; },
                enumerable: true,
                configurable: true
            },
            damageKnockbackVx: {
                get() { return this.impulseVx; },
                set(v) { this.impulseVx = v || 0; },
                enumerable: true,
                configurable: true
            },
            damageKnockbackVy: {
                get() { return this.impulseVy; },
                set(v) { this.impulseVy = v || 0; },
                enumerable: true,
                configurable: true
            },
            damageKnockbackDecay: {
                get() { return this.impulseDecay; },
                set(v) { this.impulseDecay = v; },
                enumerable: true,
                configurable: true
            },
            damageKnockbackMaxVelocity: {
                get() { return this.impulseMaxSpeed; },
                set(v) { this.impulseMaxSpeed = v; },
                enumerable: true,
                configurable: true
            },
            damageKnockbackMaxDuration: {
                get() { return this.impulseMaxDuration; },
                set(v) { this.impulseMaxDuration = v; },
                enumerable: true,
                configurable: true
            },
            damageKnockbackTimer: {
                get() { return this.impulseTimer; },
                set(v) { this.impulseTimer = v || 0; },
                enumerable: true,
                configurable: true
            }
        });

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

        // Temporary speed boost system (for card bonuses)
        this.temporarySpeedBoost = 0;        // Current temporary speed multiplier
        this.temporarySpeedBoostTimer = 0;   // Time remaining for speed boost

        // Initialize effective stats
        this.damageMultiplier = 1.0;
        this.defenseMultiplier = 1.0;
        this.healthMultiplier = 1.0;
        this.updateEffectiveStats();
    }

    savePreviousPosition() {
        this.prevX = Number.isFinite(this.x) ? this.x : 0;
        this.prevY = Number.isFinite(this.y) ? this.y : 0;
    }

    getRenderX(alpha = 1) {
        const prev = Number.isFinite(this.prevX) ? this.prevX : this.x;
        const a = Math.max(0, Math.min(1, alpha));
        return prev + (this.x - prev) * a;
    }

    getRenderY(alpha = 1) {
        const prev = Number.isFinite(this.prevY) ? this.prevY : this.y;
        const a = Math.max(0, Math.min(1, alpha));
        return prev + (this.y - prev) * a;
    }

    resolveWorldCollision(previousX = this.lastSafeX, previousY = this.lastSafeY) {
        if (typeof currentRoom !== 'undefined' && currentRoom) {
            this.x = clamp(this.x, this.size, currentRoom.width - this.size);
            this.y = clamp(this.y, this.size, currentRoom.height - this.size);
            if (currentRoom.layout && typeof RoomLayoutGenerator !== 'undefined') {
                if (RoomLayoutGenerator.isPointWalkable(currentRoom.layout, this.x, this.y, this.size)) {
                    this.lastSafeX = this.x;
                    this.lastSafeY = this.y;
                    return false;
                }

                const resolved = RoomLayoutGenerator.resolveCircleCollision(
                    currentRoom.layout,
                    this.x,
                    this.y,
                    this.size,
                    previousX,
                    previousY
                );
                this.x = resolved.x;
                this.y = resolved.y;

                // Zero out velocity component along blocked axis so player slides smoothly
                // without sticking or rubberbanding against walls at high move speeds
                if (resolved.collided) {
                    if (this.x === previousX && this.vx !== 0) this.vx = 0;
                    if (this.y === previousY && this.vy !== 0) this.vy = 0;
                }

                if (this.thrustActive && resolved.collided) {
                    this.thrustActive = false;
                    this.thrustElapsed = 0;
                }
                return resolved.collided;
            }

            this.lastSafeX = this.x;
            this.lastSafeY = this.y;
            return false;
        } else if (typeof Game !== 'undefined') {
            // Fallback to canvas bounds if room not available
            this.x = clamp(this.x, this.size, Game.canvas.width - this.size);
            this.y = clamp(this.y, this.size, Game.canvas.height - this.size);
        }
        return false;
    }

    updateScratch(deltaTime) {
        if (this.scratchBurnTimer > 0) {
            this.scratchBurnTimer -= deltaTime;
        }
        if (this.scratchPulseTimer > 0) {
            this.scratchPulseTimer -= deltaTime;
        }

        if (this.anchorHp == null || Number.isNaN(this.anchorHp) || this.anchorHp < this.hp) {
            this.anchorHp = this.hp;
        }

        if (this.scratch <= 0) {
            this.scratch = 0;
            this.scratchGraceTimer = 0;
            this.anchorHp = this.hp;
            return;
        }

        // Grace period logic: flat 3.5s delay before conversion starts
        if (this.scratchGraceTimer > 0) {
            this.scratchGraceTimer -= deltaTime;
            if (this.scratchGraceTimer <= 0) {
                this.scratchGraceTimer = 0;
                // Grace period ends, conversion begins! Pulse cue & audio chime
                this.scratchPulseTimer = 0.5;
                if (typeof GameAudio !== 'undefined' && GameAudio.sounds && typeof GameAudio.sounds.scratchGraceStart === 'function') {
                    GameAudio.sounds.scratchGraceStart();
                }
            }
        } else {
            // Conversion rate: 20% of current scratch per second continuous
            const drainAmount = Math.min(this.scratch, this.scratch * 0.20 * deltaTime);
            this.scratch -= drainAmount;

            // Heal Real HP up to anchorHp (capped at maxHp)
            const targetCap = Math.min(this.maxHp, this.anchorHp || this.maxHp);
            if (this.hp < targetCap) {
                this.hp = Math.min(targetCap, this.hp + drainAmount);
            }

            if (this.scratch <= 0.001) {
                this.scratch = 0;
                this.anchorHp = this.hp;
            }
        }
    }

    update(deltaTime, input) {
        // Don't update if dead
        if (this.dead) {
            this.alive = false;
            return;
        }

        this.updateEnemyDebuffs(deltaTime);
        this.updateScratch(deltaTime);

        // Apply item HP regeneration
        if (this.itemHpRegenPercent > 0 && this.hp < this.maxHp) {
            const regenAmount = this.maxHp * (this.itemHpRegenPercent / 100) * deltaTime;
            this.hp = Math.min(this.maxHp, this.hp + regenAmount);
        }

        // Update reactive armor stacks (decay over time)
        if (this.reactiveArmorTimer > 0) {
            this.reactiveArmorTimer -= deltaTime;
            if (this.reactiveArmorTimer <= 0) {
                // Timer expired, reset stacks
                this.reactiveArmorStacks = 0;
                this.reactiveArmorTimer = 0;
            }
        }

        // Update shield system
        this.updateShield(deltaTime);

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

        // Apply unified impulses (knockback + pull) before normal movement
        this._impulsesProcessedFrame = false;
        this.processImpulses(deltaTime);

        const previousX = this.x;
        const previousY = this.y;

        // Update position (skip during special movement handled by subclass)
        if (!this.isInSpecialMovement()) {
            this.x += this.vx * deltaTime;
            this.y += this.vy * deltaTime;
        }

        // Note: Rogue dodge collision damage moved to player-rogue.js updateClassAbilities()

        // Keep player within room bounds and generated scenery.
        this.resolveWorldCollision(previousX, previousY);

        // Calculate rotation to face aim direction (mouse or joystick)
        this.applyAimFromInput(input);

        // Handle combat inputs. Dodge runs first so same-frame dash+attack
        // prefers the escape (kit use must not soft-lock dodge).
        const room0Action = (typeof Room0Tutorial !== 'undefined' && Room0Tutorial.isActive && Room0Tutorial.isActive())
            ? Room0Tutorial.getAllowedAction()
            : 'all';

        if (room0Action === 'all' || room0Action === 'dash') {
            this.handleDodge(input);
        }

        if (room0Action === 'all' || room0Action === 'primary') {
            this.handleAttack(input);
        }

        if (room0Action === 'all' || room0Action === 'heavy') {
            this.handleHeavyAttack(input);
        }

        // Attack recovery (readable weight); dodge-cancelable
        if (this._wasAttacking && !this.isAttacking) {
            this.beginAttackRecovery();
            // Flush buffered dodge as soon as attack frames end (not after recovery).
            this.tryFlushQueuedDodge(input);
        }
        this._wasAttacking = !!this.isAttacking;
        this.updateAttackRecovery(deltaTime, input);

        // Handle special abilities (calls subclass override)
        if (room0Action === 'all' || room0Action === 'special') {
            this.handleSpecialAbility(input);
        }

        const beforeClassAbilityX = this.x;
        const beforeClassAbilityY = this.y;

        // Update class-specific abilities (called by subclass)
        this.updateClassAbilities(deltaTime, input);

        // Class-specific movement such as Warrior thrust runs after normal movement.
        this.resolveWorldCollision(beforeClassAbilityX, beforeClassAbilityY);

        // Update attack cooldown
        if (this.attackCooldown > 0) {
            this.attackCooldown -= deltaTime * (this.cooldownRegenMult || 1);
        }

        // Update heavy attack cooldown
        if (this.heavyAttackCooldown > 0) {
            this.heavyAttackCooldown -= deltaTime * (this.cooldownRegenMult || 1);
        }

        // Update dodge cooldowns (supports both single and multi-charge systems)
        const usesChargeDodge = this.usesChargeBasedDodge();
        if (usesChargeDodge) {
            // Sequential cooldown ticking: only regenerate the charge closest to finishing
            let minIndex = -1;
            let minVal = Infinity;
            for (let i = 0; i < this.dodgeChargeCooldowns.length; i++) {
                const rawValue = this.dodgeChargeCooldowns[i];
                const cooldown = Number.isFinite(rawValue) ? rawValue : 0;
                if (cooldown > 0 && cooldown < minVal) {
                    minVal = cooldown;
                    minIndex = i;
                }
            }

            // Decrement the single active charge
            if (minIndex !== -1) {
                const dec = deltaTime * (this.cooldownRegenMult || 1);
                this.dodgeChargeCooldowns[minIndex] = Math.max(0, this.dodgeChargeCooldowns[minIndex] - dec);
            }

            // Sync other charges to 0 if they finished, or ensure they don't go negative
            let readyCharges = 0;
            for (let i = 0; i < this.dodgeChargeCooldowns.length; i++) {
                const rawValue = this.dodgeChargeCooldowns[i];
                let cooldown = Number.isFinite(rawValue) ? rawValue : 0;
                if (cooldown <= 0) {
                    this.dodgeChargeCooldowns[i] = 0;
                    readyCharges++;
                }
            }
            this.dodgeCharges = readyCharges;
            this.dodgeCooldown = this.getNextChargeReadyTime(this.dodgeChargeCooldowns);
        } else {
            if (this.dodgeCooldown > 0) {
                this.dodgeCooldown = Math.max(0, this.dodgeCooldown - deltaTime * (this.cooldownRegenMult || 1));
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
                if (this.styleActionTag === 'dashAttack') this.styleActionTag = null;

                // Grant additional i-frames after dodge ends for safety
                this.invulnerable = true;
                this.invulnerabilityTime = 0.3 + (this.styleDashIFramesBonus || 0);

                // If a dash was buffered while charges/CD weren't ready, try now.
                this.tryFlushQueuedDodge(input);
            }
        }

        // Update heavy attack charge
        if (this.isChargingHeavy) {
            // Check if this class uses joystick for heavy attack on mobile
            // Use INPUT PARAMETER not global Input (important for multiplayer remote players)
            const usesHeavyJoystick = input.isTouchMode && input.isTouchMode() &&
                this.getAbilityInputType(input, 'heavyAttack') === 'joystick-press-release';

            if (usesHeavyJoystick) {
                // Aim mode: hold to aim, fire on release (any class — family decides preview/charge).
                if (input.touchButtons && input.touchButtons.heavyAttack) {
                    const button = input.touchButtons.heavyAttack;

                    this.updateHeavyAttackPreview(input);

                    if (button.justReleased) {
                        this.styleActionTag = 'heavy';
                        this.createHeavyAttack();
                        this.applyHeavyAttackCooldown();
                        this.isChargingHeavy = false;
                        this.heavyChargeElapsed = 0;
                        this.clearHeavyAttackPreview();
                    } else if (this.playerClass !== 'hexagon') {
                        // Warrior/Rogue retain charge timer; Mage indicator-only
                        this.heavyChargeElapsed += deltaTime;
                    }
                } else if (this.playerClass !== 'hexagon') {
                    this.heavyChargeElapsed += deltaTime;
                }
            } else {
                // Other classes / Mobile Tap mode: wait for windup (2.5x hold duration for mobile touch)
                const windupTime = (input.isTouchMode && input.isTouchMode()) ? this.heavyAttackWindup * 2.5 : this.heavyAttackWindup;
                this.heavyChargeElapsed += deltaTime;
                if (this.heavyChargeElapsed >= windupTime) {
                    // Spawn heavy attack hitbox
                    this.styleActionTag = 'heavy';
                    this.createHeavyAttack();
                    this.applyHeavyAttackCooldown(); // Apply cooldown after firing
                    this.isChargingHeavy = false;
                    this.heavyChargeElapsed = 0;
                }
            }
        }

        // Update special ability cooldown
        if (this.specialCooldown > 0) {
            this.specialCooldown -= deltaTime * (this.cooldownRegenMult || 1);
        }

        // Normalize cooldowns for UI consumers
        if (!this.cooldowns) this.cooldowns = { dodge: {}, heavy: {}, special: {} };
        // Dodge remaining time until at least one charge is ready
        const normalizedDodgeRemaining = Math.max(0, Number.isFinite(this.dodgeCooldown) ? this.dodgeCooldown : 0);
        const normalizedDodgeMax = Math.max(0.0001, Number.isFinite(this.dodgeCooldownTime) ? this.dodgeCooldownTime : 2.0);
        this.cooldowns.dodge.remaining = normalizedDodgeRemaining;
        this.cooldowns.dodge.max = normalizedDodgeMax;
        // Heavy
        const normalizedHeavyRemaining = Math.max(0, Number.isFinite(this.heavyAttackCooldown) ? this.heavyAttackCooldown : 0);
        const normalizedHeavyMax = Math.max(0.0001, Number.isFinite(this.heavyAttackCooldownTime) ? this.heavyAttackCooldownTime : 1.5);
        this.cooldowns.heavy.remaining = normalizedHeavyRemaining;
        this.cooldowns.heavy.max = normalizedHeavyMax;
        // Special
        const normalizedSpecialRemaining = Math.max(0, Number.isFinite(this.specialCooldown) ? this.specialCooldown : 0);
        const normalizedSpecialMax = Math.max(0.0001, Number.isFinite(this.specialCooldownTime) ? this.specialCooldownTime : 1.0);
        this.cooldowns.special.remaining = normalizedSpecialRemaining;
        this.cooldowns.special.max = normalizedSpecialMax;
        // Per-charge dodge array for UI (supports multi-charge dodge)
        if (this.dodgeChargeCooldowns && Array.isArray(this.dodgeChargeCooldowns)) {
            this.cooldowns.dodge.charges = this.dodgeChargeCooldowns.slice();
        } else {
            this.cooldowns.dodge.charges = [this.cooldowns.dodge.remaining];
        }

        // Only the local Game.player drives the HUD — remote MP sims must not overwrite it
        this.emitLocalCooldownHud();
        this._cooldownsAlreadyEmitted = false;

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

    getAbilityInputType(input, ability) {
        if (input && typeof input.getAbilityInputType === 'function') {
            return input.getAbilityInputType(this.playerClass, ability);
        }
        if (typeof GameInput !== 'undefined' && typeof GameInput.getAbilityInputType === 'function') {
            return GameInput.getAbilityInputType(this.playerClass, ability);
        }
        return 'button';
    }

    // Check if player is in special movement state (override by subclass)
    isInSpecialMovement() {
        return false;
    }

    applyAimFromInput(input) {
        if (!input) return;
        let desired = this.rotation;
        if (input.getAimDirection) {
            desired = input.getAimDirection();
        } else if (input.mouse && input.mouse.x !== undefined && input.mouse.y !== undefined) {
            const worldMouse = input.getWorldMousePos ? input.getWorldMousePos() : input.mouse;
            const dx = worldMouse.x - this.x;
            const dy = worldMouse.y - this.y;
            desired = Math.atan2(dy, dx);
        }
        const turnMult = (this.turnRateMultiplier != null) ? this.turnRateMultiplier : 1.0;
        if (turnMult >= 0.999 || this.attackRecoveryRemaining <= 0) {
            this.rotation = desired;
            return;
        }
        // Multiplicative damp against current turn rate (buff-safe): blend toward desired
        let delta = desired - this.rotation;
        while (delta > Math.PI) delta -= Math.PI * 2;
        while (delta < -Math.PI) delta += Math.PI * 2;
        this.rotation += delta * Math.max(0.15, Math.min(1, turnMult));
    }

    beginAttackRecovery() {
        const base = Math.max(0.05, this.attackDuration || 0.1);
        const scale = this.weaponRecoveryScale != null ? this.weaponRecoveryScale : 1.0;
        const as = Math.max(0.5, this.attackSpeedMultiplier || 1.0);
        this.attackRecoveryRemaining = (base * scale) / as;
        // Heavier weapons damp turn more; never zero (feels bricked)
        this.turnRateMultiplier = Math.max(0.25, Math.min(1, 1 / Math.max(0.5, scale)));
    }

    updateAttackRecovery(deltaTime, input) {
        if (this.attackRecoveryRemaining > 0) {
            this.attackRecoveryRemaining = Math.max(0, this.attackRecoveryRemaining - deltaTime);
            if (this.attackRecoveryRemaining <= 0) {
                this.turnRateMultiplier = 1.0;
            }
            // Keep trying the dodge buffer through recovery (not only on the last frame).
            this.tryFlushQueuedDodge(input);
        } else {
            this.turnRateMultiplier = 1.0;
        }
    }

    /** Max age for a buffered dodge press (ms). Covers attack frames + soft recovery. */
    static get QUEUED_DODGE_BUFFER_MS() { return 320; }

    canStartDodge() {
        if (this.isDodging || this.guardBreakLockout > 0) return false;
        if (this.usesChargeBasedDodge()) {
            return this.getReadyDodgeCharges() > 0;
        }
        return this.dodgeCooldown <= 0;
    }

    tryFlushQueuedDodge(input) {
        if (!this.queuedDodgeTime || !input) return false;
        if ((Date.now() - this.queuedDodgeTime) >= PlayerBase.QUEUED_DODGE_BUFFER_MS) {
            this.queuedDodgeTime = 0;
            return false;
        }
        if (!this.canStartDodge()) return false;
        this.queuedDodgeTime = 0;
        this.dashPreviewActive = false;
        this.startDodge(input);
        return true;
    }

    /**
     * Movement-only simulation step for client prediction / rollback replay.
     * Does not run attacks, abilities, items, or combat side effects.
     * @param {number} deltaTime
     * @param {object} input - Input or remote input adapter
     * @param {object} [options]
     * @param {number} [options.moveSpeedOverride] - Nexus etc.
     * @param {object} [options.bounds] - { width, height } clamp instead of world collision
     * @param {boolean} [options.allowPredictedDodge=true]
     */
    predictMovementStep(deltaTime, input, options = {}) {
        if (this.dead) {
            this.alive = false;
            return;
        }

        // Decay visual correction offset (hides remaining reconcile error)
        if (this._predictionCorrectionX || this._predictionCorrectionY) {
            const isMobile = (typeof Engine !== 'undefined' && Engine.Input)
                ? (typeof Engine.Input.isMobileUiMode === 'function' ? Engine.Input.isMobileUiMode() : (typeof Engine.Input.isMobileDevice === 'function' ? Engine.Input.isMobileDevice() : false))
                : false;
            const defaultDecay = isMobile
                ? (typeof MultiplayerConfig !== 'undefined' && MultiplayerConfig.MOBILE_PREDICTION_CORRECTION_DECAY != null ? MultiplayerConfig.MOBILE_PREDICTION_CORRECTION_DECAY : 0.70)
                : 0.85;
            const decay = (typeof MultiplayerConfig !== 'undefined' && MultiplayerConfig.PREDICTION_CORRECTION_DECAY != null)
                ? (isMobile ? defaultDecay : MultiplayerConfig.PREDICTION_CORRECTION_DECAY)
                : defaultDecay;
            this._predictionCorrectionX = (this._predictionCorrectionX || 0) * decay;
            this._predictionCorrectionY = (this._predictionCorrectionY || 0) * decay;
            if (Math.abs(this._predictionCorrectionX) < 0.15) this._predictionCorrectionX = 0;
            if (Math.abs(this._predictionCorrectionY) < 0.15) this._predictionCorrectionY = 0;
        }

        // Live predict only - never start a new dodge during rewind/replay
        const allowPredictedDodge = options.allowPredictedDodge === true;
        if (allowPredictedDodge && input) {
            this.tryBeginPredictedDodge(input);
        }

        // Advance dodge timer without combat/hit tracking side effects
        if (this.isDodging) {
            this.dodgeElapsed = (this.dodgeElapsed || 0) + deltaTime;
            const dodgeDuration = this.dodgeDuration || 0.2;
            if (this.dodgeElapsed >= dodgeDuration) {
                this.isDodging = false;
                this.dodgeElapsed = 0;
                this.dodgeVx = 0;
                this.dodgeVy = 0;
                if (this._predictedDodgeActive) {
                    this.invulnerable = false;
                    this._predictedDodgeActive = false;
                }
            }
        }

        const moveSpeed = (options.moveSpeedOverride != null) ? options.moveSpeedOverride : this.moveSpeed;

        if (!this.isDodging && !this.isInSpecialMovement()) {
            const moveInput = input && input.getMovementInput ? input.getMovementInput() : { x: 0, y: 0 };
            this.vx = moveInput.x * moveSpeed;
            this.vy = moveInput.y * moveSpeed;
        } else if (this.isDodging) {
            this.vx = this.dodgeVx;
            this.vy = this.dodgeVy;
        }

        if (this.guardBreakMovementScalar !== 1) {
            this.vx *= this.guardBreakMovementScalar;
            this.vy *= this.guardBreakMovementScalar;
        }

        // Skip host-only forces during replay unless explicitly enabled (avoids double-applying)
        if (options.applyForces !== false) {
            this._impulsesProcessedFrame = false;
            this.processImpulses(deltaTime);
        }

        const previousX = this.x;
        const previousY = this.y;

        if (!this.isInSpecialMovement()) {
            this.x += this.vx * deltaTime;
            this.y += this.vy * deltaTime;
        }

        // Live-only: gentle pull from detected systematic drift (never during reconcile replay)
        if (options.applyDriftBias !== false && options.allowPredictedDodge === true &&
            typeof multiplayerManager !== 'undefined' && multiplayerManager &&
            (multiplayerManager.driftBiasX || multiplayerManager.driftBiasY)) {
            const apply = (typeof MultiplayerConfig !== 'undefined' && MultiplayerConfig.PREDICTION_DRIFT_APPLY != null)
                ? MultiplayerConfig.PREDICTION_DRIFT_APPLY
                : 2.5;
            this.x += (multiplayerManager.driftBiasX || 0) * apply * deltaTime;
            this.y += (multiplayerManager.driftBiasY || 0) * apply * deltaTime;
        }

        if (options.bounds) {
            const size = this.size || 20;
            const clampFn = typeof clamp === 'function' ? clamp : (v, lo, hi) => Math.max(lo, Math.min(hi, v));
            this.x = clampFn(this.x, size, options.bounds.width - size);
            this.y = clampFn(this.y, size, options.bounds.height - size);
        } else {
            this.resolveWorldCollision(previousX, previousY);
        }

        if (options.applyAim !== false) {
            this.applyAimFromInput(input);
        }

        if (this.dashAnimActive && typeof this.advanceDashAnimation === 'function') {
            this.advanceDashAnimation(deltaTime, 'predict');
        }
    }

    /**
     * Align local movement-critical flags with host before reconcile/predict.
     * Clears stale predicted dodges the host rejected.
     */
    syncPredictedMovementFromHost(hostState) {
        if (!hostState) return;

        const hostDodging = !!hostState.isDodging;
        if (this._predictedDodgeActive && !hostDodging) {
            // Host never confirmed our predicted dodge - cancel it
            this._predictedDodgeActive = false;
            this.isDodging = false;
            this.dodgeElapsed = 0;
            this.dodgeVx = 0;
            this.dodgeVy = 0;
        } else if (hostDodging) {
            this.isDodging = true;
            if (hostState.dodgeElapsed !== undefined) this.dodgeElapsed = hostState.dodgeElapsed;
            if (hostState.dodgeVx !== undefined) this.dodgeVx = hostState.dodgeVx;
            if (hostState.dodgeVy !== undefined) this.dodgeVy = hostState.dodgeVy;
            this._predictedDodgeActive = false; // host owns the dodge now
        }

        if (hostState.thrustActive !== undefined) {
            this.thrustActive = hostState.thrustActive;
        }
        if (hostState.thrustElapsed !== undefined) {
            this.thrustElapsed = hostState.thrustElapsed;
        }
        if (hostState.guardBreakLockout !== undefined) {
            this.guardBreakLockout = hostState.guardBreakLockout;
        }
        if (hostState.guardBreakMovementScalar !== undefined) {
            this.guardBreakMovementScalar = hostState.guardBreakMovementScalar;
        }
        if (hostState.moveSpeed !== undefined) {
            this.moveSpeed = hostState.moveSpeed;
        }
        if (hostState.dodgeCooldown !== undefined) {
            this.dodgeCooldown = hostState.dodgeCooldown;
        }
        if (hostState.dodgeCharges !== undefined) {
            this.dodgeCharges = hostState.dodgeCharges;
        }
        if (hostState.dodgeChargeCooldowns !== undefined) {
            this.dodgeChargeCooldowns = hostState.dodgeChargeCooldowns;
        }
    }

    /** Visual pose including decaying reconcile correction (for camera/render). */
    getPredictedRenderPosition() {
        return {
            x: this.x + (this._predictionCorrectionX || 0),
            y: this.y + (this._predictionCorrectionY || 0)
        };
    }

    tryBeginPredictedDodge(input) {
        if (this.isDodging || this._predictedDodgeActive) return false;
        if (this.guardBreakLockout > 0) return false;

        let dodgeJustPressed = false;
        if (input.isTouchMode && typeof input.isTouchMode === 'function' && input.isTouchMode()) {
            const button = input.touchButtons && input.touchButtons.dodge;
            dodgeJustPressed = !!(button && (button.justReleased || button.justPressed));
        } else if (input.keys) {
            const shift = input.keys['Shift'] || input.keys['shift'];
            dodgeJustPressed = !!(shift && (shift.justPressed || shift.justReleased));
        } else if (input.getKeyJustPressed) {
            dodgeJustPressed = input.getKeyJustPressed('Shift') || input.getKeyJustPressed('shift');
        }

        if (!dodgeJustPressed) return false;

        const usesChargeDodge = this.usesChargeBasedDodge && this.usesChargeBasedDodge();
        let canDodge = false;
        if (usesChargeDodge) {
            canDodge = this.getReadyDodgeCharges() > 0;
        } else {
            canDodge = this.dodgeCooldown <= 0;
        }
        if (!canDodge) return false;

        this.startDodge(input, { predictOnly: true });
        this._predictedDodgeActive = true;
        return true;
    }

    // Only the locally-controlled Game.player should drive the primary cooldown HUD.
    // Host-simulated remote players also call update(); without this guard their bars overwrite the host HUD.
    isLocalHudPlayer() {
        return typeof Game !== 'undefined' && Game.player === this;
    }

    buildCooldownHudBars() {
        const bars = [];
        const dodgeMaxForUi = Math.max(0.0001, Number.isFinite(this.dodgeCooldownTime) ? this.dodgeCooldownTime : 2.0);
        if (this.dodgeChargeCooldowns && Array.isArray(this.dodgeChargeCooldowns) && this.dodgeChargeCooldowns.length > 0) {
            for (let i = 0; i < this.dodgeChargeCooldowns.length; i++) {
                const rem = Math.max(0, Number.isFinite(this.dodgeChargeCooldowns[i]) ? this.dodgeChargeCooldowns[i] : 0);
                bars.push({ type: 'dodge', label: 'D', remaining: rem, max: dodgeMaxForUi });
            }
        } else {
            const dodgeRem = (this.cooldowns && this.cooldowns.dodge && Number.isFinite(this.cooldowns.dodge.remaining))
                ? this.cooldowns.dodge.remaining
                : Math.max(0, Number.isFinite(this.dodgeCooldown) ? this.dodgeCooldown : 0);
            bars.push({ type: 'dodge', label: 'Dodge', remaining: dodgeRem, max: dodgeMaxForUi });
        }

        const specialRem = (this.cooldowns && this.cooldowns.special && Number.isFinite(this.cooldowns.special.remaining))
            ? this.cooldowns.special.remaining
            : Math.max(0, Number.isFinite(this.specialCooldown) ? this.specialCooldown : 0);
        const specialMax = (this.cooldowns && this.cooldowns.special && Number.isFinite(this.cooldowns.special.max))
            ? this.cooldowns.special.max
            : Math.max(0.0001, Number.isFinite(this.specialCooldownTime) ? this.specialCooldownTime : 1.0);
        bars.push({ type: 'special', label: 'Special', remaining: specialRem, max: specialMax });

        const heavyRem = (this.cooldowns && this.cooldowns.heavy && Number.isFinite(this.cooldowns.heavy.remaining))
            ? this.cooldowns.heavy.remaining
            : Math.max(0, Number.isFinite(this.heavyAttackCooldown) ? this.heavyAttackCooldown : 0);
        const heavyMax = (this.cooldowns && this.cooldowns.heavy && Number.isFinite(this.cooldowns.heavy.max))
            ? this.cooldowns.heavy.max
            : Math.max(0.0001, Number.isFinite(this.heavyAttackCooldownTime) ? this.heavyAttackCooldownTime : 1.5);
        bars.push({ type: 'heavy', label: 'Heavy', remaining: heavyRem, max: heavyMax });

        return bars;
    }

    emitLocalCooldownHud() {
        if (this._cooldownsAlreadyEmitted) return;
        if (!this.isLocalHudPlayer()) return;
        if (typeof window === 'undefined' || !window.UIBus || typeof window.UIBus.emit !== 'function') return;
        try {
            const bars = this.buildCooldownHudBars();
            if (bars && bars.length > 0) {
                window.UIBus.emit('cooldowns:update', { bars });
            }
        } catch (e) {
            // Avoid spamming console on every frame if something goes wrong
        }
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
        if (this.isDodging) return;

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
            // Keyboard/mouse mode: check for left click (hold to fire)
            // We still track lastMouseLeft for consistency, but we trigger attack on hold
            this.lastMouseLeft = input.mouseLeft;

            if (input.mouseLeft && this.attackCooldown <= 0) {
                shouldAttack = true;
            }
        }

        if (shouldAttack) {
            if (typeof beginLifestealAttackSwing === 'function') {
                beginLifestealAttackSwing(this);
            }
            this.executeAttack(input);
            if (typeof Room0Tutorial !== 'undefined' && Room0Tutorial.notifyCombatAction) {
                Room0Tutorial.notifyCombatAction('primary');
            }
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

        // Check for dodge input (Shift key, touch/gamepad button, or seat ability API)
        let dodgeJustPressed = false;

        if (input.isTouchMode && input.isTouchMode()) {
            if (input.touchButtons && input.touchButtons.dodge) {
                const button = input.touchButtons.dodge;

                // Triangle uses joystick: fire on release (press-and-hold-to-aim, release-to-fire)
                if (this.playerClass === 'triangle') {
                    dodgeJustPressed = !!button.justReleased;

                    // Update dash preview and rotation while button is pressed and joystick is active
                    if (button.pressed && input.touchJoysticks && input.touchJoysticks.dodge) {
                        const joystick = input.touchJoysticks.dodge;
                        if (joystick.active && joystick.getMagnitude() > 0.1) {
                            this.rotation = joystick.getAngle();
                            this.dashPreviewActive = true;
                        } else {
                            this.dashPreviewActive = false;
                        }
                    } else if (!button.pressed) {
                        this.dashPreviewActive = false;
                    }
                } else {
                    dodgeJustPressed = !!button.justPressed;
                }
            } else if (typeof input.isAbilityJustPressed === 'function') {
                // Local-split / pad seats expose ability edges but not touchButtons.
                if (this.playerClass === 'triangle' && typeof input.isAbilityJustReleased === 'function') {
                    dodgeJustPressed = !!input.isAbilityJustReleased('dodge')
                        || !!input.isAbilityJustPressed('dodge');
                } else {
                    dodgeJustPressed = !!input.isAbilityJustPressed('dodge');
                }
            }
        } else {
            // Keyboard mode: Shift rising edge (also honor seat ability edges)
            const shiftDown = !!(input.getKeyState && input.getKeyState('shift'));
            const shiftJustPressed = shiftDown && !this.lastShiftState;
            this.lastShiftState = shiftDown;
            dodgeJustPressed = shiftJustPressed;
            if (!dodgeJustPressed && typeof input.isAbilityJustPressed === 'function') {
                dodgeJustPressed = !!input.isAbilityJustPressed('dodge');
            }
        }

        const canDodge = this.canStartDodge();

        // Dodge-cancel attacks/recovery immediately. Only buffer when something
        // else briefly blocks (e.g. charge refresh); guard-break stays hard-locked.
        if (dodgeJustPressed && canDodge) {
            this.dashPreviewActive = false;
            this.startDodge(input);
        } else if (dodgeJustPressed && this.guardBreakLockout <= 0) {
            // Charge/cooldown miss: keep a short sticky buffer so a near-ready dash still fires.
            this.queuedDodgeTime = Date.now();
        }
    }

    usesChargeBasedDodge() {
        return (this.maxDodgeCharges || 0) > 1 || (this.dodgeChargeCooldowns && this.dodgeChargeCooldowns.length > 1);
    }

    getReadyDodgeCharges() {
        if (!this.dodgeChargeCooldowns || this.dodgeChargeCooldowns.length === 0) return 0;
        let ready = 0;
        for (let i = 0; i < this.dodgeChargeCooldowns.length; i++) {
            const cooldown = Number.isFinite(this.dodgeChargeCooldowns[i]) ? this.dodgeChargeCooldowns[i] : 0;
            if (cooldown <= 0) {
                ready++;
            }
        }
        return ready;
    }

    getLongestActiveCooldown(cooldownArray) {
        if (!cooldownArray || cooldownArray.length === 0) return 0;
        let longest = 0;
        for (let i = 0; i < cooldownArray.length; i++) {
            const rawValue = cooldownArray[i];
            const value = Number.isFinite(rawValue) ? rawValue : 0;
            if (value > longest) {
                longest = value;
            }
        }
        return longest;
    }

    getNextChargeReadyTime(cooldownArray) {
        if (!cooldownArray || cooldownArray.length === 0) return 0;
        let next = Infinity;
        for (let i = 0; i < cooldownArray.length; i++) {
            const rawValue = cooldownArray[i];
            const value = Number.isFinite(rawValue) ? rawValue : 0;
            if (value <= 0) {
                return 0;
            }
            if (value < next) {
                next = value;
            }
        }
        return next === Infinity ? 0 : next;
    }

    consumeDodgeCharge() {
        if (this.usesChargeBasedDodge()) {
            const effectiveDodgeCooldown = this.dodgeCooldownTime;
            for (let i = 0; i < this.dodgeChargeCooldowns.length; i++) {
                const cooldown = Number.isFinite(this.dodgeChargeCooldowns[i]) ? this.dodgeChargeCooldowns[i] : 0;
                if (cooldown <= 0) {
                    this.dodgeChargeCooldowns[i] = effectiveDodgeCooldown;
                    break;
                }
            }
            this.dodgeCharges = this.getReadyDodgeCharges();
            this.dodgeCooldown = this.getNextChargeReadyTime(this.dodgeChargeCooldowns);
        } else {
            this.dodgeCooldown = this.dodgeCooldownTime;
            if (this.dodgeChargeCooldowns && this.dodgeChargeCooldowns.length > 0) {
                this.dodgeChargeCooldowns[0] = this.dodgeCooldown;
            }
            this.dodgeCharges = 0;
        }
    }

    startDodge(input, options = {}) {
        const predictOnly = !!options.predictOnly;
        if (!predictOnly) {
            console.log(`[DODGE START] playerClass: ${this.playerClass}, rotation: ${this.rotation}`);
        }

        if (!predictOnly && typeof Room0Tutorial !== 'undefined' && Room0Tutorial.notifyCombatAction) {
            Room0Tutorial.notifyCombatAction('dash');
        }

        // Calculate dodge direction
        let dodgeDirX = 0;
        let dodgeDirY = 0;

        // Triangle (Rogue) uses joystick for directional dash on mobile
        if (this.playerClass === 'triangle') {
            if (input.isTouchMode && input.isTouchMode()) {
                const button = input.touchButtons && input.touchButtons.dodge;

                if (button && button.finalJoystickState) {
                    const state = button.finalJoystickState;
                    if (state.magnitude > 0.1) {
                        dodgeDirX = state.direction.x * this.dodgeSpeedBoost;
                        dodgeDirY = state.direction.y * this.dodgeSpeedBoost;
                        if (!predictOnly) {
                            button.finalJoystickState = null;
                        }
                    } else {
                        dodgeDirX = Math.cos(this.rotation) * this.dodgeSpeedBoost;
                        dodgeDirY = Math.sin(this.rotation) * this.dodgeSpeedBoost;
                    }
                } else if (input.touchJoysticks && input.touchJoysticks.dodge && input.touchJoysticks.dodge.active) {
                    const joystick = input.touchJoysticks.dodge;
                    const dir = joystick.getDirection ? joystick.getDirection() : (joystick.direction || { x: 0, y: 0 });
                    dodgeDirX = dir.x * this.dodgeSpeedBoost;
                    dodgeDirY = dir.y * this.dodgeSpeedBoost;
                } else {
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
                dodgeDirX = Math.cos(this.rotation) * this.dodgeSpeedBoost;
                dodgeDirY = Math.sin(this.rotation) * this.dodgeSpeedBoost;
            }
        } else {
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

        this.dodgeVx = dodgeDirX;
        this.dodgeVy = dodgeDirY;

        this.beginDashAnimation(dodgeDirX, dodgeDirY, { seedTrail: !predictOnly });

        if (dodgeDirX !== 0 || dodgeDirY !== 0) {
            this.rotation = Math.atan2(dodgeDirY, dodgeDirX);
            this.lastAimAngle = this.rotation;
        }

        this.isDodging = true;
        this.invulnerable = true;
        this.dodgeElapsed = 0;
        this.styleActionTag = 'dashAttack';
        // Dodge-cancel active attack frames + soft recovery
        this.isAttacking = false;
        this.attackRecoveryRemaining = 0;
        this.turnRateMultiplier = 1.0;
        this.queuedDodgeTime = 0;
        if (this.dodgeHitEnemies && this.dodgeHitEnemies.clear) {
            this.dodgeHitEnemies.clear();
        }

        if (!predictOnly) {
            if (typeof GameAudio !== 'undefined' && GameAudio.sounds) {
                if (this.playerClass === 'triangle' && typeof GameAudio.sounds.rogueDodge === 'function') {
                    GameAudio.sounds.rogueDodge();
                } else if (typeof GameAudio.sounds.dodge === 'function') {
                    GameAudio.sounds.dodge();
                }
            }
            this.consumeDodgeCharge();
        }
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

        if (this._maintainDashTrail && this.dashTrail.length > 0) {
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
        if (this._maintainDashTrail) {
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
        if (this.isDodging) return;

        // Check for heavy attack input (right click or touch button/joystick)
        let heavyJustPressed = false;
        let heavyPressed = false;

        if (input.isTouchMode && input.isTouchMode()) {
            // Check if this class uses joystick for heavy attack
            const usesHeavyJoystick = this.getAbilityInputType(input, 'heavyAttack') === 'joystick-press-release';

            if (usesHeavyJoystick) {
                // Aim mode for any class: hold to aim facing, release to fire
                if (input.touchButtons && input.touchButtons.heavyAttack) {
                    const button = input.touchButtons.heavyAttack;
                    heavyPressed = button.pressed;

                    if (button.justPressed && this.heavyAttackCooldown <= 0 && !this.isChargingHeavy) {
                        this.startHeavyAttack();
                        this.initHeavyAttackPreview();
                    }

                    if (this.isChargingHeavy && button.pressed) {
                        this.updateHeavyAttackPreview(input);
                    } else if (this.isChargingHeavy && !button.pressed) {
                        this.clearHeavyAttackPreview();
                    }
                }
                return;
            } else {
                // Tap: fire on release along current facing
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
            this.styleActionTag = 'special';
            this.activateSpecialAbility(input);
        }
    }

    notifyTutorialCombatAction(ability) {
        if (typeof Room0Tutorial !== 'undefined' && Room0Tutorial.notifyCombatAction) {
            Room0Tutorial.notifyCombatAction(ability);
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
        this.styleActionTag = 'heavy';
        // NOTE: Cooldown is now set when the attack is actually fired (in applyHeavyAttackCooldown)
    }

    // Create heavy attack - override in subclass
    createHeavyAttack() {
        this.styleActionTag = 'heavy';
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

        if (typeof Room0Tutorial !== 'undefined' && Room0Tutorial.notifyCombatAction) {
            Room0Tutorial.notifyCombatAction('heavy');
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

    takeDamage(damage, sourceEnemy = null, options = null) {
        if (typeof DebugFlags !== 'undefined' && DebugFlags.INVINCIBILITY) {
            return;
        }

        if (this.invulnerable || this.dead) {
            // Vanguard Thrust: phase through boss AoE during heavy thrust i-frames
            if (this.invulnerable && this.thrustActive && sourceEnemy && (sourceEnemy.isBoss || sourceEnemy.bossName)) {
                if (typeof LedgerManager !== 'undefined' && LedgerManager.recordEvent) {
                    LedgerManager.recordEvent('vanguardThrust', { player: this, enemy: sourceEnemy });
                }
            }
            return;
        }

        // Phasing: Chance to negate damage
        if (this.phasingChance && this.phasingChance > 0 && Math.random() < this.phasingChance) {
            // Phased through the attack!
            if (typeof createParticleBurst !== 'undefined') {
                createParticleBurst(this.x, this.y, '#aaaaff', 8);
            }
            console.log('[Phasing] Avoided damage!');
            return; // Completely negate damage
        }

        const damageCause = (options && options.cause) || 'physical';
        const isStatusDamage = damageCause === 'status';
        const isClient = typeof Game !== 'undefined' && Game.isMultiplayerClient && Game.isMultiplayerClient();

        // Discrete physical hit for mode rules (combo bleed). DoT/status excluded.
        if (!isStatusDamage && typeof GameBus !== 'undefined' && GameBus.emit) {
            const hitPlayerId = this.id || this.playerId || (typeof Game !== 'undefined' && Game.getLocalPlayerId ? Game.getLocalPlayerId() : 'local');
            GameBus.emit('combat:playerDamaged', {
                player: this,
                playerId: hitPlayerId,
                damage,
                sourceEnemy,
                physical: true,
                world: typeof Game !== 'undefined' ? Game : null
            });
        }

        // Item shield: absorb damage first (before fortify shield)
        if (this.shieldHealth > 0) {
            this.lastDamageTime = Date.now() / 1000; // Reset regen timer
            if (this.shieldHealth >= damage) {
                // Shield absorbs all damage
                this.shieldHealth -= damage;
                return; // No damage to HP
            } else {
                // Shield absorbs partial damage
                damage -= this.shieldHealth;
                this.shieldHealth = 0;
            }
        }

        // Fortify shield: absorb damage second
        if (this.fortifyShield && this.fortifyShield > 0) {
            if (this.fortifyShield >= damage) {
                // Shield absorbs all damage
                this.fortifyShield -= damage;
                return; // No damage to HP
            } else {
                // Shield absorbs partial damage
                damage -= this.fortifyShield;
                this.fortifyShield = 0;
            }
        }

        // Reactive Armor: Add stack on hit (before damage reduction calculation)
        if (this.reactiveArmorValue > 0 && this.reactiveArmorMaxCap > 0) {
            // Add a stack (each stack gives +5% reduction, capped at maxCap)
            const currentReduction = this.reactiveArmorStacks * this.reactiveArmorValue;
            const maxStacks = Math.floor(this.reactiveArmorMaxCap / this.reactiveArmorValue);
            if (currentReduction < this.reactiveArmorMaxCap && this.reactiveArmorStacks < maxStacks) {
                this.reactiveArmorStacks = Math.min(this.reactiveArmorStacks + 1, maxStacks);
                // Reset timer - stacks last for reactiveArmorDuration seconds
                this.reactiveArmorTimer = this.reactiveArmorDuration;
            }
        }

        // Apply damage reduction from defense and class-based sources
        const reduction = this.computeDamageReduction();
        const originalDamage = damage;
        damage = damage * (1 - reduction);

        // Track block if block stance reduced damage (Warrior-specific)
        const isBlocking = reduction > 0 && typeof this.blockStanceActive !== 'undefined' && this.blockStanceActive;
        if (isBlocking) {
            if (typeof window.trackLifetimeStat === 'function') {
                window.trackLifetimeStat('totalBlocks', 1);
            }
            if (typeof LedgerManager !== 'undefined' && LedgerManager.recordEvent) {
                LedgerManager.recordEvent('block', { player: this });
            }
        }

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
        // Combine card/gear thornsReflect with item itemReflectPercent
        const totalReflectPercent = (this.thornsReflect || 0) + (this.itemReflectPercent || 0);
        if (totalReflectPercent > 0 && sourceEnemy && sourceEnemy.alive && typeof sourceEnemy.takeDamage === 'function') {
            const reflectedDamage = damage * totalReflectPercent;

            // Calculate damage dealt BEFORE applying damage
            const damageDealt = Math.min(reflectedDamage, sourceEnemy.hp);

            // Get player ID for damage attribution
            const attackerId = this.playerId || (typeof Game !== 'undefined' && Game.getLocalPlayerId ? Game.getLocalPlayerId() : null);

            sourceEnemy.takeDamage(reflectedDamage, attackerId);

            // Track reflected damage for lifetime stats
            if (typeof window.trackLifetimeStat === 'function') {
                window.trackLifetimeStat('totalReflectedDamage', damageDealt);
            }

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

            // Visual feedback for thorns/reflect
            if (typeof createDamageNumber !== 'undefined') {
                createDamageNumber(sourceEnemy.x, sourceEnemy.y, damageDealt, false, false);
            }
            // Particle burst on player to show reflect activated
            if (typeof createParticleBurst !== 'undefined') {
                createParticleBurst(this.x, this.y, '#ff4444', 8); // Red/orange thorns effect
            }
        }

        // Scratch damage mechanics:
        // Initialize anchorHp to HP before taking damage if scratch is not active
        if (this.scratch <= 0 || this.anchorHp == null || Number.isNaN(this.anchorHp)) {
            this.anchorHp = this.hp;
        }

        // 1. Re-hit while scratch active: burn 20% of active scratch permanently (lowers max recoverable anchorHp)
        if (this.scratch > 0) {
            const burnAmount = this.scratch * 0.20;
            this.anchorHp = Math.max(this.hp, this.anchorHp - burnAmount);
            this.scratchBurnTimer = 0.3; // Brief flash on scratch burn
            if (typeof GameAudio !== 'undefined' && GameAudio.sounds && typeof GameAudio.sounds.scratchBurn === 'function') {
                GameAudio.sounds.scratchBurn();
            }
        }

        // 2. Real HP takes 25% of post-defense damage permanently
        const realHpDamage = damage * 0.25;
        this.hp = Math.max(0, this.hp - realHpDamage);

        // 3. Scratch buffer is the recoverable gap between anchorHp and Real HP
        this.scratch = Math.max(0, this.anchorHp - this.hp);

        // Reset grace period timer on hit (flat 3.5 seconds delay before conversion starts)
        this.scratchGraceTimer = 3.5;

        this.lastDamageTime = Date.now() / 1000; // Track damage time for visual effects
        this.lastDamageAmount = damage; // Track damage amount from this hit for visual effects

        // Track near-death experiences (HP drops below 20%)
        if (this.hp > 0 && this.hp <= (this.maxHp * 0.20)) {
            // Only track once per near-death episode (use a flag to prevent multiple counts)
            if (!this._nearDeathTracked) {
                const isClient = typeof Game !== 'undefined' && Game.isMultiplayerClient && Game.isMultiplayerClient();
                if (!isClient && typeof window.trackLifetimeStat === 'function') {
                    window.trackLifetimeStat('totalNearDeathExperiences', 1);
                }
                this._nearDeathTracked = true;
            }
        } else if (this.hp > (this.maxHp * 0.30)) {
            // Reset flag when HP recovers above 30%
            this._nearDeathTracked = false;
        }

        // Trigger screen shake on taking damage
        // Scale intensity based on damage amount from THIS hit (not total health lost)
        // Scale from 0% to 45% of max HP (45% = maximum effect)
        // Match the satisfying feel of boss weak point hits (intensity 3.0)
        if (typeof Game !== 'undefined') {
            // Calculate what percentage of max HP this hit represents
            const hitDamagePercentage = this.maxHp > 0
                ? damage / this.maxHp
                : 0;
            // Normalize to 0.1-1.0, capped at 45% of max HP (0.1 at 0% damage, 1.0 at 45%+ damage)
            const normalizedDamage = Math.min(hitDamagePercentage / 0.45, 1.0);
            const damagePercentage = 0.1 + (1.0 - 0.1) * normalizedDamage; // Scale from 0.1 to 1.0

            // Scale intensity from 0.5 (at 0% damage) to 3.0 (at 45% damage)
            // This matches boss weak point hit intensity (3.0) for maximum satisfaction
            const baseIntensity = 0.5; // Minimum intensity at full health
            const maxIntensity = 3.0; // Maximum intensity at 45% damage (matches boss weak point)
            const intensity = baseIntensity + (maxIntensity - baseIntensity) * damagePercentage;

            // Use longer duration (0.25s) for more satisfying, less "jittery" feel
            // 'player' direction gives vertical bias (staggered/hit feeling)
            Game.triggerScreenShake(intensity, 0.25, 'player');
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
            if (typeof GameAudio !== 'undefined' && GameAudio.sounds) {
                GameAudio.sounds.avatarDefeat();
            }

            this.hp = 0;
            this.dead = true;
            this.alive = false;

            if (typeof GameBus !== 'undefined' && GameBus.emit) {
                GameBus.emit('combat:playerDied', {
                    player: this,
                    world: typeof Game !== 'undefined' ? Game : null
                });
            }

            // Track death for lifetime stats
            const isClient = typeof Game !== 'undefined' && Game.isMultiplayerClient && Game.isMultiplayerClient();
            if (!isClient && typeof window.trackLifetimeStat === 'function') {
                window.trackLifetimeStat('totalDeaths', 1);
            }

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
                    Game.shardsEarned = Game.calculateShards ? Game.calculateShards() : 0;

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
                    const wasAllDead = Game.allPlayersDead;
                    Game.allPlayersDead = Game.checkAllPlayersDead();

                    // If all players just died, set death screen start time
                    if (!wasAllDead && Game.allPlayersDead) {
                        if (!Game.deathScreenStartTime) {
                            Game.deathScreenStartTime = Date.now();
                        }
                        if (!Game.endTime) {
                            Game.endTime = Date.now();
                        }
                        if (typeof Telemetry !== 'undefined') {
                            Telemetry.recordEvent('allPlayersDead', {
                                roomNumber: Game.roomNumber || 1,
                                metadata: {
                                    deadPlayers: Array.from(Game.deadPlayers || []),
                                    playerCount: Game.playerStats ? Game.playerStats.size : null
                                }
                            });
                        }
                    }

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

            // Record end time for death screen and calculate currency/shards
            if (typeof Game !== 'undefined') {
                Game.endTime = Date.now();
                Game.deathScreenStartTime = Date.now(); // Initialize death screen timer
                if (typeof LedgerManager !== 'undefined' && LedgerManager.recordEvent) {
                    LedgerManager.recordEvent('runEnded', {
                        now: Game.endTime,
                        roomNumber: Game.roomNumber || 0,
                        successfulClear: false
                    });
                }
                Game.currencyEarned = Game.calculateCurrency();
                Game.shardsEarned = Game.calculateShards ? Game.calculateShards() : 0;

                // Credit rewards immediately on game over screen
                if (!Game.multiplayerEnabled || Game.allPlayersDead) {
                    if (typeof Game.creditRewards === 'function') {
                        Game.creditRewards();
                    }
                }
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
                    this.takeDamage(tickDamage, bleed.sourceEnemy || null, { cause: 'status' });
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

    // Apply temporary speed boost (for card bonuses)
    applyTemporarySpeedBoost(multiplier, duration) {
        this.temporarySpeedBoost = multiplier;
        this.temporarySpeedBoostTimer = duration;
    }

    // Combine defense stat with class-specific reductions
    computeDamageReduction() {
        const defenseReduction = clamp(this.defense || 0, 0, 0.95);
        const classReduction = clamp(this.getDamageReduction() || 0, 0, 0.95);

        // Reactive Armor: Add damage reduction from stacks
        let reactiveArmorReduction = 0;
        if (this.reactiveArmorValue > 0 && this.reactiveArmorStacks > 0) {
            reactiveArmorReduction = clamp((this.reactiveArmorStacks * this.reactiveArmorValue) / 100, 0, this.reactiveArmorMaxCap / 100);
        }

        // Combine all reductions multiplicatively
        const combinedReduction = 1 - (1 - defenseReduction) * (1 - classReduction) * (1 - reactiveArmorReduction);
        return clamp(combinedReduction, 0, 0.95);
    }

    // Get additional damage reduction factor (0-1) from class mechanics - override in subclass
    getDamageReduction() {
        // Default: no class-based reduction (subclasses can override for block stance, shield, etc.)
        return 0;
    }

    // Add XP and check for level up
    addXP(amount) {
        // Surge Arena XP multiplier tuned up to 0.65x so player levels keep pace with wave scaling
        const isArena = typeof Game !== 'undefined' && (Game.gameMode === 'surge-arena' || Game.activeSessionId === 'surge-arena');
        const mult = isArena ? 0.65 : 1.5;
        const bonusXP = amount * mult;
        this.xp += bonusXP;
        this.totalXpEarned = (this.totalXpEarned || 0) + bonusXP;

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

        const targetLevel = this.level;
        // Apply bonuses level-by-level from lastLevelBonusesApplied + 1 to targetLevel
        for (let lvl = this.lastLevelBonusesApplied + 1; lvl <= targetLevel; lvl++) {
            // Increase base stats (damage 9% per level, HP 12% levels 1-10, 5% post-10)
            // Taper HP growth past level 10 to prevent infinite player health inflation
            const hpGrowthRate = lvl <= 10 ? 1.12 : 1.05;
            this.baseDamageBase = (this.baseDamageBase || this.baseDamage) * 1.09;
            this.baseDamage = this.baseDamageBase;
            this.baseMaxHpBase = (this.baseMaxHpBase || this.baseMaxHp) * hpGrowthRate;
            this.baseMaxHp = this.baseMaxHpBase;
            this.maxHp = this.baseMaxHp;

            // Apply class-specific speed scaling with cap
            let speedBoost = 0;

            // Levels 1-5: All classes get +5% per level
            if (lvl >= 2 && lvl <= 5) {
                const levelsCompleted = lvl - 1; // Level 2 = 1 boost, Level 5 = 4 boosts
                speedBoost = this.initialBaseMoveSpeed * 0.05 * levelsCompleted;
            } else if (lvl > 5) {
                // After level 5, base boost is 4 * 5% = 20%
                speedBoost = this.initialBaseMoveSpeed * 0.20;

                // Rogue gets additional boosts on levels 6, 8, 10
                if (this.playerClass === 'triangle') {
                    let rogueExtraBoosts = 0;
                    if (lvl >= 6) rogueExtraBoosts++;
                    if (lvl >= 8) rogueExtraBoosts++;
                    if (lvl >= 10) rogueExtraBoosts++;

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
        }

        // Recalculate effective stats with gear bonuses
        this.updateEffectiveStats();

        // Heal by 50% Max HP (instead of to full)
        this.hp = Math.min(this.maxHp, this.hp + Math.floor(this.maxHp * 0.5));

        // Mark that we've applied bonuses for this level
        this.lastLevelBonusesApplied = targetLevel;
    }

    // Level up function
    levelUp() {
        // Play level up sound
        if (typeof GameAudio !== 'undefined' && GameAudio.sounds) {
            GameAudio.sounds.levelUp();
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
        
        // Warrior affixes
        this.whirlwindRadiusMultiplier = 1.0;
        this.thrustSpeedMultiplier = 1.0;
        this.cleaveAreaMultiplier = 1.0;
        // Rogue affixes
        this.cloneDurationMultiplier = 1.0;
        this.dashCooldownMultiplier = 1.0;
        this.fanCountBonus = 0;
        // Tank affixes
        this.shieldWidthMultiplier = 1.0;
        this.shoutStunBonus = 0;
        this.hammerHealBonus = 0;
        
        this.damageMultiplier = 1.0;
        this.defenseMultiplier = 1.0;
        this.healthMultiplier = 1.0;

        // Reset crit chance to base class value stored during construction
        this.critChance = this.baseCritChance || 0;

        // Apply item crit chance (additive)
        if (this.itemCritChance) {
            this.critChance = (this.critChance || 0) + this.itemCritChance;
        }

        // Apply item crit damage (additive to multiplier)
        if (this.itemCritDamage) {
            this.critDamageMultiplier += this.itemCritDamage;
        }

        // Apply item attack speed bonus (additive to multiplier)
        if (this.itemAttackSpeedBonus) {
            this.attackSpeedMultiplier += this.itemAttackSpeedBonus;
        }

        // Apply item cooldown reduction (additive, capped at 75%)
        if (this.itemCooldownReduction) {
            this.cooldownReduction = Math.min(0.75, (this.cooldownReduction || 0) + this.itemCooldownReduction);
        }

        // Apply item pierce count (additive)
        if (this.itemPierceCount) {
            this.pierceCount = (this.pierceCount || 0) + this.itemPierceCount;
        }

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
                this.weaponProjectileRangeBonus = type.projectileRangeBonus || 0;
                this.weaponHitCount = type.hitCount || 1;
                this.weaponKnockbackBonus = type.knockbackBonus || 0;
                this.weaponStunChance = type.stunChance || 0;
                this.weaponRecoveryScale = type.recoveryScale != null ? type.recoveryScale : 1.0;
                this.weaponHitpauseScale = type.hitpauseScale != null ? type.hitpauseScale : 1.0;
                this.weaponPerHitDamageShare = type.perHitDamageShare != null ? type.perHitDamageShare : 1.0;
                this.weaponDualStaggerMs = type.dualStaggerMs || 0;
                this.weaponOnHitPolicy = type.onHitPolicy || { status: 'perSwing', proc: 'perSwing', sustain: 'perSwing' };
            }
        } else {
            // No weapon type, reset to defaults
            this.weaponCooldownMultiplier = 1.0;
            this.weaponRangeMultiplier = 1.0;
            this.weaponProjectileRangeBonus = 0;
            this.weaponHitCount = 1;
            this.weaponKnockbackBonus = 0;
            this.weaponStunChance = 0;
            this.weaponRecoveryScale = 1.0;
            this.weaponHitpauseScale = 1.0;
            this.weaponPerHitDamageShare = 1.0;
            this.weaponDualStaggerMs = 0;
            this.weaponOnHitPolicy = { status: 'perSwing', proc: 'perSwing', sustain: 'perSwing' };
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

        // Apply class card damage bonus (scales with level)
        let classCardDamageBonus = 0;
        if (typeof window.getClassCardDamageBonus === 'function') {
            classCardDamageBonus = window.getClassCardDamageBonus(this);
        }

        // Calculate final stats
        // Damage and defense are now ADDITIVE (flat values from gear)
        const baseDamageWithMultiplier = this.baseDamage * this.damageMultiplier;
        const baseDefenseWithMultiplier = this.baseDefense * this.defenseMultiplier;
        const baseMaxHpWithMultiplier = this.baseMaxHp * this.healthMultiplier;

        // Apply item damage bonus (multiplicative)
        const baseDamage = baseDamageWithMultiplier + weaponFlatDamage + classCardDamageBonus;
        this.damage = baseDamage * (1 + (this.itemDamageBonus || 0));

        this.defense = baseDefenseWithMultiplier + armorFlatDefense;

        // Apply item speed bonus (multiplicative), then hard-cap so deep-run
        // item stacks cannot outpace soft-capped enemy mobility.
        const PLAYER_MOVE_SPEED_CAP = 520;
        this.moveSpeed = Math.min(
            PLAYER_MOVE_SPEED_CAP,
            this.baseMoveSpeed * speedBonus * (1 + (this.itemSpeedBonus || 0)) * (this.styleMoveSpeedMult || 1)
        );

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

        // Update shield max health based on itemShieldPercent
        if (this.itemShieldPercent > 0) {
            this.maxShieldHealth = this.maxHp * (this.itemShieldPercent / 100);
            // If shield was at max and max increased, increase current shield too
            if (this.shieldHealth >= this.maxShieldHealth * 0.99) {
                this.shieldHealth = this.maxShieldHealth;
            }
            // Clamp shield to max
            if (this.shieldHealth > this.maxShieldHealth) {
                this.shieldHealth = this.maxShieldHealth;
            }
        } else {
            this.maxShieldHealth = 0;
            this.shieldHealth = 0;
        }

        if (typeof CompanionSync !== 'undefined' && typeof CompanionSync.broadcastNow === 'function') {
            CompanionSync.broadcastNow();
        }
    }

    // Update shield system (regeneration)
    updateShield(deltaTime) {
        if (this.maxShieldHealth <= 0) {
            this.shieldHealth = 0;
            return;
        }

        const currentTime = Date.now() / 1000;
        const timeSinceDamage = currentTime - (this.lastDamageTime || 0);

        // Start regenerating after 5 seconds without damage
        if (timeSinceDamage >= this.shieldRegenDelay && this.shieldHealth < this.maxShieldHealth) {
            // Regenerate shield (full regen in 2 seconds)
            const regenRate = this.maxShieldHealth / 2.0; // Full shield in 2 seconds
            this.shieldHealth = Math.min(this.maxShieldHealth, this.shieldHealth + regenRate * deltaTime);
        }
    }

    // Store current base stats as anchors for future recalculations (used after config changes)
    syncBaseStatAnchors() {
        this.baseDamageBase = this.baseDamage;
        this.baseMaxHpBase = this.baseMaxHp;
        this.baseDefenseBase = this.baseDefense;
    }

    // Apply individual affix to player stats
    applyAffix(affix, contextVar, contextCallback) {
        switch (affix.type) {
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
                // Cap so stacked gear affixes don't make the combined multiplier insane
                this.knockbackMultiplier = Math.min(this.knockbackMultiplier, 2.0);
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
            
            // Warrior affixes
            case 'whirlwindRadius':
                this.whirlwindRadiusMultiplier += affix.value;
                break;
            case 'thrustSpeed':
                this.thrustSpeedMultiplier += affix.value;
                break;
            case 'cleaveArea':
                this.cleaveAreaMultiplier += affix.value;
                break;
                
            // Rogue affixes
            case 'cloneDuration':
                this.cloneDurationMultiplier += affix.value;
                break;
            case 'dashCooldown':
                // Reduction - subtract from multiplier (e.g., 0.2 = 20% faster = 0.8x cooldown)
                this.dashCooldownMultiplier -= affix.value;
                break;
            case 'fanCount':
                this.fanCountBonus += Math.floor(affix.value);
                break;
                
            // Tank affixes
            case 'shieldWidth':
                this.shieldWidthMultiplier += affix.value;
                break;
            case 'shoutStun':
                this.shoutStunBonus += affix.value;
                break;
            case 'hammerHeal':
                this.hammerHealBonus += affix.value;
                break;
        }
    }

    // Apply class modifier to player stats
    applyClassModifier(modifier) {
        // Universal modifiers apply to all classes
        if (modifier.class === 'universal') {
            switch (modifier.type) {
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
        switch (effect.type) {
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

        // Track affix discoveries
        if (gear.affixes && Array.isArray(gear.affixes) && typeof SaveSystem !== 'undefined' && SaveSystem.discoverAffix) {
            gear.affixes.forEach(affix => {
                if (affix && affix.type) {
                    SaveSystem.discoverAffix(affix.type);
                }
            });
        }

        // Update effective stats
        this.updateEffectiveStats();

        // Update gear visuals
        this.updateGearVisuals();

        return oldGear;
    }

    // Strip run gear (weapon/armor/accessory) and refresh stats/visuals.
    // Used when abandoning a run or returning to the Nexus between runs.
    clearEquippedGear() {
        this.weapon = null;
        this.armor = null;
        this.accessory = null;
        if (typeof this.updateEffectiveStats === 'function') {
            this.updateEffectiveStats();
        }
        if (typeof this.updateGearVisuals === 'function') {
            this.updateGearVisuals();
        }
    }

    // Apply pull force from boss/environmental hazard into the shared impulse vector
    applyPullForce(sourceX, sourceY, strength, radius) {
        const dx = sourceX - this.x;
        const dy = sourceY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < radius && distance > 0) {
            const pullPower = strength * (1 - (distance / radius));
            const dirX = dx / distance;
            const dirY = dy / distance;
            this.applyImpulse(dirX * pullPower, dirY * pullPower, {
                resistance: 1,
                maxSpeed: this.impulseMaxSpeed
            });
        }
    }

    smoothDampPullForce(frames = 4, factor = 0.85) {
        this.pullForceDampFrames = Math.max(this.pullForceDampFrames || 0, frames);
        this.pullForceDampFactor = factor;
        this.pullForceDampThreshold = 0.1;
    }

    snapDampPullForce(maxVelocity = 45, frames = 4, factor = 0.4, threshold = 0.5) {
        const currentSpeed = Math.hypot(this.impulseVx || 0, this.impulseVy || 0);
        if (currentSpeed > maxVelocity && currentSpeed > 0) {
            const scale = maxVelocity / currentSpeed;
            this.impulseVx *= scale;
            this.impulseVy *= scale;
        }
        this.pullForceDampFrames = Math.max(this.pullForceDampFrames || 0, frames);
        this.pullForceDampFactor = factor;
        this.pullForceDampThreshold = threshold;
    }

    applyImpulse(forceX, forceY, options = {}) {
        if (!Engine.Physics) {
            this.impulseVx = (this.impulseVx || 0) + (forceX || 0);
            this.impulseVy = (this.impulseVy || 0) + (forceY || 0);
            return true;
        }
        return Engine.Physics.apply(this, forceX, forceY, {
            resistance: options.resistance != null ? options.resistance : this.knockbackResistance,
            maxSpeed: options.maxSpeed != null ? options.maxSpeed : this.impulseMaxSpeed,
            replace: !!options.replace,
            sourceId: options.sourceId
        });
    }

    // Apply immediate knockback impulse from enemy damage
    applyDamageKnockback(forceX, forceY, sourceId = null) {
        return this.applyImpulse(forceX, forceY, {
            resistance: this.knockbackResistance,
            maxSpeed: this.impulseMaxSpeed,
            sourceId
        });
    }

    processImpulses(deltaTime) {
        if (!Engine.Physics) {
            if (this.impulseVx || this.impulseVy) {
                this.x += (this.impulseVx || 0) * deltaTime;
                this.y += (this.impulseVy || 0) * deltaTime;
            }
            this._impulsesProcessedFrame = true;
            return;
        }

        Engine.Physics.integrate(this, deltaTime, {
            decay: this.impulseDecay,
            cutoff: this.impulseCutoff,
            maxDuration: this.impulseMaxDuration,
            moveFn: PLAYER_INTEGRATE_MOVE_FN,
            afterDecay: PLAYER_INTEGRATE_AFTER_DECAY
        });
        this._impulsesProcessedFrame = true;
    }

    // Compatibility wrappers — prefer processImpulses(); these exist for older callers.
    // They intentionally no-op on velocity integration if impulses were already processed this frame.
    processPullForces(deltaTime) {
        if (this._impulsesProcessedFrame === true) return;
        this.processImpulses(deltaTime);
    }

    processDamageKnockback(deltaTime) {
        if (this._impulsesProcessedFrame === true) return;
        this.processImpulses(deltaTime);
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
        if (!this._baseShapeVertexCache) {
            this._baseShapeVertexCache = new Map();
        }
        const cacheKey = `${shape || 'square'}:${size}`;
        if (this._baseShapeVertexCache.has(cacheKey)) {
            return this._baseShapeVertexCache.get(cacheKey);
        }

        let vertices;
        switch (shape) {
            case 'triangle':
                vertices = [
                    { x: size, y: 0 },
                    { x: -size * 0.5, y: -size * 0.8660254038 },
                    { x: -size * 0.5, y: size * 0.8660254038 }
                ];
                break;
            case 'hexagon': {
                vertices = [];
                for (let i = 0; i < 6; i++) {
                    const angle = (Math.PI / 3) * i;
                    vertices.push({
                        x: Math.cos(angle) * size,
                        y: Math.sin(angle) * size
                    });
                }
                break;
            }
            case 'pentagon': {
                const rotationOffset = 18 * Math.PI / 180;
                vertices = [];
                for (let i = 0; i < 5; i++) {
                    const angle = (Math.PI * 2 / 5) * i - Math.PI / 2 + rotationOffset;
                    vertices.push({
                        x: Math.cos(angle) * size,
                        y: Math.sin(angle) * size
                    });
                }
                break;
            }
            default:
                vertices = [
                    { x: -size * 0.8, y: -size * 0.8 },
                    { x: size * 0.8, y: -size * 0.8 },
                    { x: size * 0.8, y: size * 0.8 },
                    { x: -size * 0.8, y: size * 0.8 }
                ];
        }
        this._baseShapeVertexCache.set(cacheKey, vertices);
        return vertices;
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
        switch (waveType) {
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

        switch (shapeType) {
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

    // One ring per equipped gear piece; affix waves weighted by tier bias.
    calculateGearPieceVisual(gearPiece) {
        if (!gearPiece) return null;

        const waves = [];
        let baseColor = { r: 150, g: 150, b: 150 };

        const statTypeMap = {
            damage: { freq: 3.0, baseColor: { r: 255, g: 100, b: 100 } },
            defense: { freq: 1.5, baseColor: { r: 100, g: 150, b: 255 } },
            speed: { freq: 4.5, baseColor: { r: 150, g: 255, b: 100 } }
        };

        if (gearPiece.stats) {
            for (const [statType, statValue] of Object.entries(gearPiece.stats)) {
                if (statTypeMap[statType] && statValue > 0) {
                    const config = statTypeMap[statType];
                    let normalizedValue = statType === 'damage' ? statValue / 50 :
                        statType === 'defense' ? statValue / 0.5 :
                            statValue / 0.3;
                    normalizedValue = Math.min(1, normalizedValue);

                    waves.push({
                        frequency: Math.max(1, Math.min(4, Math.round(config.freq))),
                        phase: normalizedValue * Math.PI * 2,
                        amplitude: 0.3 + normalizedValue * 0.4,
                        waveType: 'sine'
                    });

                    baseColor.r = (baseColor.r + config.baseColor.r) / 2;
                    baseColor.g = (baseColor.g + config.baseColor.g) / 2;
                    baseColor.b = (baseColor.b + config.baseColor.b) / 2;
                }
            }
        }

        const affixes = (typeof buildWeightedAffixRingEntries === 'function')
            ? buildWeightedAffixRingEntries(gearPiece.affixes || [])
            : [];

        if (affixes.length > 0) {
            for (let i = 0; i < affixes.length; i++) {
                waves.push(affixes[i].wave);
            }
            const blended = (typeof blendWeightedAffixRingColor === 'function')
                ? blendWeightedAffixRingColor(affixes, baseColor)
                : baseColor;
            baseColor = blended;
        }

        const tierSettings = {
            gray: { opacity: 0.5, stroke: 2, glow: 0 },
            green: { opacity: 0.7, stroke: 2, glow: 5 },
            blue: { opacity: 0.9, stroke: 2.5, glow: 10 },
            purple: { opacity: 1.0, stroke: 3, glow: 15 },
            orange: { opacity: 1.0, stroke: 3.5, glow: 25 }
        };

        const tier = gearPiece.tier || 'gray';
        const tierConfig = tierSettings[tier] || tierSettings.gray;

        return {
            waves,
            baseColor,
            tierColor: gearPiece.color || '#999999',
            intensity: affixes.length > 0
                ? Math.min(1, affixes.length * 0.15)
                : (waves.length > 0 ? Math.min(1, waves.length * 0.15) : 0.3),
            affixes,
            affixVisuals: affixes,
            tier,
            tierOpacity: tierConfig.opacity,
            tierStroke: tierConfig.stroke,
            tierGlow: tierConfig.glow,
            hasLegendary: !!gearPiece.legendaryEffect
        };
    }

    updateGearVisuals() {
        this.weaponVisual = this.calculateGearPieceVisual(this.weapon);
        this.armorVisual = this.calculateGearPieceVisual(this.armor);
        this.accessoryVisual = this.calculateGearPieceVisual(this.accessory);
        this.gearVisualsVersion = (this.gearVisualsVersion || 0) + 1;
        const numPoints = this._getGearRingPointCount();
        if (numPoints > 0) {
            PlayerBase.getAngleLookup(numPoints);
        }
    }

    _getEquippedSlotVisuals() {
        return [
            this.weaponVisual,
            this.armorVisual,
            this.accessoryVisual
        ];
    }

    _getGearRingPointCount() {
        const defaultPoints = 64;
        if (typeof Game !== 'undefined' && Game.renderQuality && typeof Game.renderQuality.gearRingPoints === 'number') {
            return Game.renderQuality.gearRingPoints;
        }
        return defaultPoints;
    }

    static getAngleLookup(numPoints) {
        if (!PlayerBase._angleLookupCache) {
            PlayerBase._angleLookupCache = new Map();
        }
        if (PlayerBase._angleLookupCache.has(numPoints)) {
            return PlayerBase._angleLookupCache.get(numPoints);
        }
        const cos = new Float32Array(numPoints + 1);
        const sin = new Float32Array(numPoints + 1);
        for (let i = 0; i <= numPoints; i++) {
            const angle = (i / numPoints) * Math.PI * 2;
            cos[i] = Math.cos(angle);
            sin[i] = Math.sin(angle);
        }
        const lookup = { cos, sin };
        PlayerBase._angleLookupCache.set(numPoints, lookup);
        return lookup;
    }

    _renderSlotGearRings(ctx, time) {
        const slotVisuals = this._getEquippedSlotVisuals();
        const numPoints = this._getGearRingPointCount();
        if (numPoints <= 0) return 0;

        let drawn = 0;
        let maxGlow = 0;
        let maxGlowColor = '#999999';
        for (let i = 0; i < slotVisuals.length; i++) {
            const visual = slotVisuals[i];
            if (!visual) continue;
            if (visual.tierGlow > maxGlow) {
                maxGlow = visual.tierGlow;
                maxGlowColor = visual.tierColor || maxGlowColor;
            }
        }
        if (maxGlow > 0) {
            ctx.shadowBlur = maxGlow * 0.7;
            ctx.shadowColor = maxGlowColor;
        }

        for (let slotIndex = 0; slotIndex < slotVisuals.length; slotIndex++) {
            const visual = slotVisuals[slotIndex];
            if (!visual) continue;

            const baseRadius = this.size + 10 + (drawn * 10);
            const phaseBias = drawn * 0.15;
            const affixes = visual.affixes || [];
            let color = visual.baseColor || { r: 150, g: 150, b: 150 };
            if (affixes.length > 0 && typeof blendWeightedAffixRingColor === 'function') {
                color = blendWeightedAffixRingColor(affixes, color);
            }

            ctx.beginPath();
            for (let i = 0; i <= numPoints; i++) {
                const angle = (i / numPoints) * Math.PI * 2;
                let offset = 0;
                if (affixes.length > 0 && typeof sampleWeightedAffixRingOffset === 'function') {
                    offset = sampleWeightedAffixRingOffset(
                        angle,
                        affixes,
                        time,
                        phaseBias,
                        PlayerBase.getWaveValue.bind(PlayerBase)
                    );
                } else if (visual.waves && visual.waves.length > 0) {
                    const wave = visual.waves[0];
                    const smoothPhase = wave.phase + (time * (0.5 + phaseBias));
                    offset = PlayerBase.getWaveValue(
                        wave.waveType || 'sine',
                        angle,
                        wave.frequency,
                        smoothPhase
                    ) * wave.amplitude * 4;
                }
                const radius = baseRadius + offset;
                const px = this.x + Math.cos(angle) * radius;
                const py = this.y + Math.sin(angle) * radius;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();

            ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${visual.tierOpacity * 0.85})`;
            ctx.lineWidth = visual.tierStroke || 2;
            ctx.stroke();
            drawn++;
        }

        ctx.shadowBlur = 0;
        return drawn;
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

        // Smooth out reconcile snaps visually without changing sim pose
        const corrX = this._predictionCorrectionX || 0;
        const corrY = this._predictionCorrectionY || 0;
        if (corrX || corrY) {
            ctx.translate(corrX, corrY);
        }

        if (this.isDodging) {
            ctx.globalAlpha = 0.5;
        }

        let scale = 1.0;
        if (this.isChargingHeavy && this.playerClass !== 'hexagon') {
            const windup = Math.max(this.heavyAttackWindup, 0.0001);
            const chargeProgress = Math.min(this.heavyChargeElapsed / windup, 1);
            scale = 1.0 + chargeProgress * 0.3;
        }

        const time = Date.now() * 0.0003;
        const slotVisuals = this._getEquippedSlotVisuals();
        const equippedVisuals = slotVisuals.filter(v => v);
        const ringPoints = this._getGearRingPointCount();

        let numRings = 0;
        const drawGearRings = () => {
            if (ringPoints > 0 && equippedVisuals.length > 0) {
                numRings = this._renderSlotGearRings(ctx, time);
            }
        };

        if (typeof Game !== 'undefined' && typeof Game.trackRenderSection === 'function') {
            Game.trackRenderSection('gearRings', drawGearRings);
        } else {
            drawGearRings();
        }

        // Legendary effects rendering (independent of ring system)
        const hasLegendary = equippedVisuals.some(v => v && v.hasLegendary);
        if (hasLegendary) {
            const legendaryPulse = Math.sin(time * 3) * 0.5 + 0.5;
            const maxRadius = this.size + 10 + (Math.max(numRings, 1) * 10);
            const legendaryRadius = maxRadius + 4 + legendaryPulse * 4;
            ctx.strokeStyle = `rgba(255, 200, 0, ${0.5 * legendaryPulse})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(this.x, this.y, legendaryRadius, 0, Math.PI * 2);
            ctx.stroke();

            for (let i = 0; i < 2; i++) {
                const sparkleAngle = time * 4 + (i * Math.PI);
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

        let transformedVertices = baseVertices;
        let deformedMin = minForward;
        let deformedMax = maxForward;

        if (dashEffectActive) {
            transformedVertices = [];
            deformedMin = Infinity;
            deformedMax = -Infinity;
            baseVertices.forEach(v => {
                const normalized = (v.x - minForward) / span;
                let influence = 0;
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

                const stretchMultiplier = 1 + (this.dashAnimStretch - 1) * influence;
                const squeezeMultiplier = 1 / (1 + 0.8 * (stretchMultiplier - 1));

                const distanceFromRear = (v.x - minForward) * stretchMultiplier;
                let newX = minForward + distanceFromRear;
                let newY = v.y * squeezeMultiplier;
                newX += curveShear * newY;

                if (newX < deformedMin) deformedMin = newX;
                if (newX > deformedMax) deformedMax = newX;

                transformedVertices.push({ x: newX, y: newY });
            });
        }

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
        let bodyColor = this.color;
        if (typeof resolveCombatClarityDrawColor === 'function') {
            bodyColor = resolveCombatClarityDrawColor(this, bodyColor);
        }
        ctx.fillStyle = bodyColor;
        ctx.fill();

        // ------------------ STYLE OVERLAY PATTERN ------------------
        let comboTier = 0;
        if (typeof Game !== 'undefined' && Game.playerCombos && Game.playerCombos[this.id]) {
            comboTier = Game.playerCombos[this.id].comboTier || 0;
        } else if (typeof Game !== 'undefined' && typeof Game.getLocalPlayerId === 'function' && Game.getLocalPlayerId() === this.id) {
            comboTier = Game.comboTier || 0;
        }

        if (comboTier >= 3) {
            ctx.save();
            ctx.beginPath();
            transformedVertices.forEach((v, index) => {
                if (index === 0) ctx.moveTo(v.x, v.y);
                else ctx.lineTo(v.x, v.y);
            });
            ctx.closePath();
            ctx.clip();

            if (comboTier === 3) { // A: Apex
                ctx.strokeStyle = 'rgba(255, 0, 127, 0.4)';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(-this.size, -this.size);
                ctx.lineTo(this.size, this.size);
                ctx.moveTo(-this.size - 8, -this.size);
                ctx.lineTo(this.size - 8, this.size);
                ctx.moveTo(-this.size + 8, -this.size);
                ctx.lineTo(this.size + 8, this.size);
                ctx.stroke();
            } else if (comboTier === 4) { // S: Apocalypse
                ctx.strokeStyle = 'rgba(255, 204, 0, 0.5)';
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                for (let x = -this.size; x <= this.size; x += 10) {
                    ctx.moveTo(x, -this.size);
                    ctx.lineTo(x, this.size);
                    ctx.moveTo(-this.size, x);
                    ctx.lineTo(this.size, x);
                }
                ctx.stroke();
            } else if (comboTier === 5) { // S+: Calamity
                ctx.strokeStyle = 'rgba(255, 85, 0, 0.6)';
                ctx.lineWidth = 3;
                const tShift = (time * 80) % 15;
                ctx.beginPath();
                for (let r = tShift; r < this.size * 1.5; r += 15) {
                    ctx.arc(0, 0, r, 0, Math.PI * 2);
                }
                ctx.stroke();
            } else if (comboTier >= 6) { // S++: Armageddon
                ctx.strokeStyle = 'rgba(255, 0, 60, 0.7)';
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                const rot = time * 25;
                for (let i = 0; i < 2; i++) {
                    const startAngle = rot + i * Math.PI;
                    ctx.moveTo(0, 0);
                    for (let r = 0; r < this.size * 1.5; r += 2) {
                        const theta = startAngle + r * 0.15;
                        const px = Math.cos(theta) * r;
                        const py = Math.sin(theta) * r;
                        ctx.lineTo(px, py);
                    }
                }
                ctx.stroke();
            }
            ctx.restore();
        }

        const indicatorRadius = Math.min(5, Math.max(2, deformedSpan * 0.08));
        const indicatorX = deformedMax - indicatorRadius * 1.5;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(indicatorX, 0, indicatorRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        // Render item shield visual (glowing ring around player)
        this.renderItemShield(ctx);

        // Render status effect indicators (bleed, guard break)
        this.renderStatusEffects(ctx);

        // Render class-specific visuals (override by subclass)
        this.renderClassVisuals(ctx);

        ctx.restore();
    }

    // Render status effect indicators above player
    renderStatusEffects(ctx) {
        if (!this.statusEffects) return;

        const effects = [];
        const iconSize = 8;
        const iconSpacing = 12;
        const startY = this.y - this.size - 18; // Above player
        let currentX = this.x;

        // Bleed indicator (red drop icon)
        if (this.statusEffects.bleed) {
            effects.push({
                x: currentX,
                y: startY,
                type: 'bleed',
                stacks: this.statusEffects.bleed.stacks || 1,
                color: '#ff0000'
            });
            currentX += iconSpacing;
        }

        // Guard Break indicator (yellow/orange shield icon)
        if (this.statusEffects.guardBreak || this.guardBreakLockout > 0) {
            effects.push({
                x: currentX,
                y: startY,
                type: 'guardBreak',
                color: '#ffb347'
            });
            currentX += iconSpacing;
        }

        // Render all effects
        if (effects.length === 0) return;

        // Center the effects horizontally
        const totalWidth = (effects.length - 1) * iconSpacing;
        const startX = this.x - totalWidth / 2;

        effects.forEach((effect, index) => {
            const x = startX + index * iconSpacing;
            const y = effect.y;

            ctx.save();

            // Draw icon background circle
            ctx.fillStyle = effect.color;
            ctx.globalAlpha = 0.8;
            ctx.beginPath();
            ctx.arc(x, y, iconSize / 2 + 1, 0, Math.PI * 2);
            ctx.fill();

            // Draw icon border
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.globalAlpha = 1.0;
            ctx.stroke();

            // Draw icon symbol
            ctx.fillStyle = '#ffffff';
            ctx.globalAlpha = 1.0;
            ctx.beginPath();

            switch (effect.type) {
                case 'bleed':
                    // Draw drop shape
                    ctx.moveTo(x, y - iconSize / 2);
                    ctx.lineTo(x - iconSize / 3, y);
                    ctx.lineTo(x, y + iconSize / 2);
                    ctx.lineTo(x + iconSize / 3, y);
                    ctx.closePath();
                    ctx.fill();
                    // Draw stack count ABOVE the icon
                    if (effect.stacks > 1) {
                        ctx.fillStyle = '#ffffff';
                        ctx.font = 'bold 10px Arial';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'bottom';
                        // Add text shadow for better visibility
                        ctx.shadowColor = '#000000';
                        ctx.shadowBlur = 3;
                        ctx.fillText(effect.stacks.toString(), x, y - iconSize / 2 - 3);
                        ctx.shadowBlur = 0;
                    }
                    break;
                case 'guardBreak':
                    // Draw shield shape (simple rectangle with top curve)
                    ctx.moveTo(x - iconSize / 3, y + iconSize / 4);
                    ctx.lineTo(x - iconSize / 3, y - iconSize / 4);
                    ctx.quadraticCurveTo(x, y - iconSize / 2, x + iconSize / 3, y - iconSize / 4);
                    ctx.lineTo(x + iconSize / 3, y + iconSize / 4);
                    ctx.lineTo(x, y + iconSize / 3);
                    ctx.closePath();
                    ctx.fill();
                    break;
            }

            ctx.restore();
        });
    }

    // Render item shield visual (glowing ring around player)
    renderItemShield(ctx) {
        const shieldHealth = this.shieldHealth || 0;
        const maxShieldHealth = this.maxShieldHealth || 0;
        if (shieldHealth <= 0 || maxShieldHealth <= 0) return;

        ctx.save();
        ctx.translate(this.x, this.y);

        const shieldRadius = this.size + 8;
        const shieldAlpha = 0.6 + (shieldHealth / maxShieldHealth) * 0.4;

        // Outer glow - live radial gradient (cached square sprite looked axis-aligned)
        const gradient = ctx.createRadialGradient(0, 0, shieldRadius - 5, 0, 0, shieldRadius + 10);
        gradient.addColorStop(0, `rgba(0, 200, 255, ${shieldAlpha * 0.3})`);
        gradient.addColorStop(1, 'rgba(0, 200, 255, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, shieldRadius + 10, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = `rgba(0, 200, 255, ${shieldAlpha})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, shieldRadius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = `rgba(100, 255, 255, ${shieldAlpha * 0.5})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, 0, shieldRadius - 2, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
    }

    // Render class-specific visuals - override in subclass
    renderClassVisuals(ctx) {
        // Override in subclass for class-specific rendering
    }

    // Serialize equipped gear including safe-room progress fields (backward-compatible on read)
    serializeEquippedGear(gear) {
        if (!gear) return null;
        return window.serializeGearForNetwork(gear, { includeWorld: false });
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
            anchorHp: this.anchorHp,
            scratch: this.scratch,
            scratchGraceTimer: this.scratchGraceTimer,
            shieldHealth: this.shieldHealth,
            maxShieldHealth: this.maxShieldHealth,
            level: this.level,
            xp: this.xp,
            xpToNext: this.xpToNext, // Fixed: was xpToNextLevel
            // So reconnect/restore can rehydrate without re-firing level-up heals
            lastLevelBonusesApplied: this.lastLevelBonusesApplied != null
                ? this.lastLevelBonusesApplied
                : this.level,

            // Equipped gear (full objects with all affix system properties)
            weapon: this.weapon ? this.serializeEquippedGear(this.weapon) : null,
            armor: this.armor ? this.serializeEquippedGear(this.armor) : null,
            accessory: this.accessory ? this.serializeEquippedGear(this.accessory) : null,

            // Gear visuals (deterministic patterns for consistent appearance in multiplayer)
            weaponVisual: this.weaponVisual,
            armorVisual: this.armorVisual,
            accessoryVisual: this.accessoryVisual,

            // Status effects (for visual rendering on clients)
            statusEffects: this.statusEffects ? {
                bleed: this.statusEffects.bleed ? {
                    dps: this.statusEffects.bleed.dps,
                    duration: this.statusEffects.bleed.duration,
                    elapsed: this.statusEffects.bleed.elapsed,
                    stacks: this.statusEffects.bleed.stacks || 1
                } : null,
                guardBreak: this.statusEffects.guardBreak ? {
                    duration: this.statusEffects.guardBreak.duration,
                    elapsed: this.statusEffects.guardBreak.elapsed,
                    movementPenalty: this.statusEffects.guardBreak.movementPenalty
                } : null
            } : { bleed: null, guardBreak: null },
            guardBreakLockout: this.guardBreakLockout || 0,

            // Animation states
            isDodging: this.isDodging,
            dodgeElapsed: this.dodgeElapsed,
            dodgeVx: this.dodgeVx,
            dodgeVy: this.dodgeVy,
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
                // Serialize enemy ids (not object refs) so clients can rebuild a Set for hit-confirm VFX
                hitEnemies: h.hitEnemies
                    ? Array.from(h.hitEnemies).map(e => (e && typeof e === 'object' ? e.id : e)).filter(id => id != null)
                    : []
            })),

            // Life state
            dead: this.dead,
            alive: this.alive,
            invulnerable: this.invulnerable,
            invulnerabilityTime: this.invulnerabilityTime,

            // Items (for multiplayer sync)
            items: this.itemManager ? this.itemManager.serialize() : {},

            // Client prediction ack (host echoes last input seq processed for this player)
            lastProcessedInputSeq: this.lastProcessedInputSeq != null ? this.lastProcessedInputSeq : null,
            vx: this.vx,
            vy: this.vy
        };
    }

    // Apply state from host/network (base properties)
    // options.skipTransform: when true, do not overwrite x/y/rotation/vx/vy (prediction owns pose)
    // options.skipLevelUp: when true, restore level/XP without level-up heal/VFX (reconnect, hydrate)
    applyState(state, options = {}) {
        const skipTransform = !!options.skipTransform;
        const skipLevelUp = !!options.skipLevelUp;

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
        if (!skipTransform && state.x !== undefined && state.y !== undefined &&
            Number.isFinite(state.x) && Number.isFinite(state.y)) {
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

        if (!skipTransform && state.rotation !== undefined) {
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

        // Shield data should always be applied (for both local and remote players)
        // Apply even if 0 to ensure updates are received when shield is picked up
        if (state.shieldHealth !== undefined) {
            this.shieldHealth = state.shieldHealth;
        }
        if (state.maxShieldHealth !== undefined) {
            this.maxShieldHealth = state.maxShieldHealth;
        }

        // IMPORTANT: For multiplayer clients, DON'T overwrite our own HP/XP from host's game state
        // The host sends what it THINKS our stats are, but we maintain our own authoritative HP/XP
        // We only update HP from damage events, and XP from kill events
        // This prevents the "instant heal" bug where host state overwrites damage before we see it
        if (!isMultiplayerClient) {
            // Host or solo: apply HP/XP directly
            if (state.hp !== undefined) this.hp = state.hp;
            if (state.maxHp !== undefined) this.maxHp = state.maxHp;
            if (state.anchorHp !== undefined) this.anchorHp = state.anchorHp;
            if (state.scratch !== undefined) this.scratch = state.scratch;
            if (state.scratchGraceTimer !== undefined) this.scratchGraceTimer = state.scratchGraceTimer;
            
            const levelIncreased = !skipLevelUp && state.level !== undefined && state.level > this.level;
            if (state.level !== undefined) this.level = state.level;
            if (state.xp !== undefined) this.xp = state.xp;
            if (state.xpToNext !== undefined) this.xpToNext = state.xpToNext; // Fixed property name
            if (state.lastLevelBonusesApplied !== undefined) {
                this.lastLevelBonusesApplied = state.lastLevelBonusesApplied;
            } else if (skipLevelUp && state.level !== undefined) {
                // Restore path with legacy snapshot: bonuses already baked into stats/HP
                this.lastLevelBonusesApplied = state.level;
            }

            // Apply level up bonuses on host if level increased (not on reconnect/hydrate restore)
            if (levelIncreased && this.lastLevelBonusesApplied < this.level &&
                typeof this.applyLevelUpBonuses === 'function') {
                console.log(`[Host/Solo] Level increased to ${this.level}, applying bonuses`);
                this.applyLevelUpBonuses();
                if (typeof showLevelUpMessage === 'function') {
                    showLevelUpMessage(this.level);
                }
            }
        } else {
            // Client: Accept HP from host (authoritative) to avoid damage desync
            // Host tracks all damage and syncs HP via game_state
            const oldHp = this.hp;
            if (state.hp !== undefined) this.hp = state.hp;
            if (state.maxHp !== undefined) this.maxHp = state.maxHp;
            if (state.anchorHp !== undefined) this.anchorHp = state.anchorHp;
            if (state.scratch !== undefined) this.scratch = state.scratch;
            if (state.scratchGraceTimer !== undefined) this.scratchGraceTimer = state.scratchGraceTimer;

            // Detect damage taken (HP decreased) and trigger visual effects
            if (oldHp !== undefined && state.hp !== undefined && state.hp < oldHp) {
                const damageAmount = oldHp - state.hp;
                this.lastDamageTime = Date.now() / 1000;
                this.lastDamageAmount = damageAmount; // Track damage amount from this hit for visual effects

                // Trigger screen shake for this player (only if they're the local client's player)
                const isClient = typeof Game !== 'undefined' && Game.isMultiplayerClient && Game.isMultiplayerClient();
                if (isClient && typeof Game !== 'undefined' && typeof Game.getLocalPlayerId === 'function') {
                    const localPlayerId = Game.getLocalPlayerId();
                    if (this.playerId === localPlayerId && typeof Game.triggerScreenShake === 'function') {
                        // Calculate damage amount from this hit (HP change)
                        const damageAmount = oldHp - state.hp;
                        // Calculate what percentage of max HP this hit represents
                        const hitDamagePercentage = this.maxHp > 0
                            ? damageAmount / this.maxHp
                            : 0;
                        // Normalize to 0.1-1.0, capped at 45% of max HP (0.1 at 0% damage, 1.0 at 45%+ damage)
                        const normalizedDamage = Math.min(hitDamagePercentage / 0.45, 1.0);
                        const damagePercentage = 0.1 + (1.0 - 0.1) * normalizedDamage; // Scale from 0.1 to 1.0

                        const baseIntensity = 0.5;
                        const maxIntensity = 3.0;
                        const intensity = baseIntensity + (maxIntensity - baseIntensity) * damagePercentage;
                        Game.triggerScreenShake(intensity, 0.25, 'player');
                    }
                }
            }

            // Sync XP values from host (XP is shared among all players, host is authoritative)
            if (state.xp !== undefined) this.xp = state.xp;
            if (state.xpToNext !== undefined) this.xpToNext = state.xpToNext;

            // Sync bonus tracker before level-up detection so reconnect/full snapshots
            // do not re-apply heals that were already applied on the host.
            if (state.lastLevelBonusesApplied !== undefined) {
                this.lastLevelBonusesApplied = state.lastLevelBonusesApplied;
            }

            // Only update level if it actually increased (from our own leveling)
            if (state.level !== undefined && state.level > this.level) {
                this.level = state.level;

                // Apply level up bonuses when level increases (for multiplayer clients)
                // This ensures bonuses are applied even if player_leveled_up event arrives out of order.
                // Skip when restoring (skipLevelUp) or when host already applied bonuses for this level.
                if (!skipLevelUp && this.lastLevelBonusesApplied < this.level &&
                    typeof this.applyLevelUpBonuses === 'function') {
                    console.log(`[Client] Level increased to ${this.level}, applying bonuses via applyState`);
                    this.applyLevelUpBonuses();
                    if (typeof showLevelUpMessage === 'function') {
                        showLevelUpMessage(this.level);
                    }
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
                    Game.deathScreenStartTime = Date.now(); // Initialize death screen timer
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
        if (state.weapon !== undefined) {
            this.weapon = state.weapon;
            if (this.weapon && typeof normalizeGearProgressFields === 'function') normalizeGearProgressFields(this.weapon);
        }
        if (state.armor !== undefined) {
            this.armor = state.armor;
            if (this.armor && typeof normalizeGearProgressFields === 'function') normalizeGearProgressFields(this.armor);
        }
        if (state.accessory !== undefined) {
            this.accessory = state.accessory;
            if (this.accessory && typeof normalizeGearProgressFields === 'function') normalizeGearProgressFields(this.accessory);
        }

        // Recalculate effective stats based on new gear
        if (state.weapon !== undefined || state.armor !== undefined || state.accessory !== undefined) {
            this.updateEffectiveStats();
        }

        // Animation states
        if (state.isDodging !== undefined) this.isDodging = state.isDodging;
        if (state.dodgeElapsed !== undefined) this.dodgeElapsed = state.dodgeElapsed;
        if (state.dodgeVx !== undefined) this.dodgeVx = state.dodgeVx;
        if (state.dodgeVy !== undefined) this.dodgeVy = state.dodgeVy;
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

        // MP clients don't run full update(); refresh HUD bars from host-synced cooldowns
        if (this.isLocalHudPlayer()) {
            if (!this.cooldowns) this.cooldowns = { dodge: {}, heavy: {}, special: {} };
            this.cooldowns.dodge.remaining = Math.max(0, Number.isFinite(this.dodgeCooldown) ? this.dodgeCooldown : 0);
            this.cooldowns.dodge.max = Math.max(0.0001, Number.isFinite(this.dodgeCooldownTime) ? this.dodgeCooldownTime : 2.0);
            this.cooldowns.heavy.remaining = Math.max(0, Number.isFinite(this.heavyAttackCooldown) ? this.heavyAttackCooldown : 0);
            this.cooldowns.heavy.max = Math.max(0.0001, Number.isFinite(this.heavyAttackCooldownTime) ? this.heavyAttackCooldownTime : 1.5);
            this.cooldowns.special.remaining = Math.max(0, Number.isFinite(this.specialCooldown) ? this.specialCooldown : 0);
            this.cooldowns.special.max = Math.max(0.0001, Number.isFinite(this.specialCooldownTime) ? this.specialCooldownTime : 1.0);
            if (this.dodgeChargeCooldowns && Array.isArray(this.dodgeChargeCooldowns)) {
                this.cooldowns.dodge.charges = this.dodgeChargeCooldowns.slice();
            }
            this.emitLocalCooldownHud();
        }

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

        // Attack hitboxes - rebuild hitEnemies as Set for render hit-confirm (.size checks)
        if (state.attackHitboxes !== undefined) {
            this.attackHitboxes = state.attackHitboxes.map(h => ({
                ...h,
                hitEnemies: new Set(
                    Array.isArray(h.hitEnemies) ? h.hitEnemies :
                    (h.hitEnemies instanceof Set ? Array.from(h.hitEnemies) : [])
                )
            }));
        }

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

        // Status effects (for visual rendering on clients)
        if (state.statusEffects !== undefined) {
            if (!this.statusEffects) {
                this.statusEffects = { bleed: null, guardBreak: null };
            }
            if (state.statusEffects.bleed !== undefined) {
                this.statusEffects.bleed = state.statusEffects.bleed ? {
                    dps: state.statusEffects.bleed.dps || 0,
                    duration: state.statusEffects.bleed.duration || 0,
                    elapsed: state.statusEffects.bleed.elapsed || 0,
                    accumulator: 0, // Client doesn't process damage ticks
                    tickRate: 0.5,
                    stacks: state.statusEffects.bleed.stacks || 1,
                    sourceEnemy: null // Don't sync enemy reference
                } : null;
            }
            if (state.statusEffects.guardBreak !== undefined) {
                this.statusEffects.guardBreak = state.statusEffects.guardBreak ? {
                    duration: state.statusEffects.guardBreak.duration || 0,
                    elapsed: state.statusEffects.guardBreak.elapsed || 0,
                    movementPenalty: state.statusEffects.guardBreak.movementPenalty || 0.55,
                    appliedAt: Date.now()
                } : null;
            }
        }
        if (state.guardBreakLockout !== undefined) this.guardBreakLockout = state.guardBreakLockout;

        // Gear (update if changed)
        let gearChanged = false;
        if (state.weapon !== undefined) {
            // Deep compare to detect actual changes
            const weaponChanged = !this.weapon || JSON.stringify(this.weapon) !== JSON.stringify(state.weapon);
            if (weaponChanged) {
                this.weapon = state.weapon;
                if (this.weapon && typeof normalizeGearProgressFields === 'function') normalizeGearProgressFields(this.weapon);
                gearChanged = true;
            }
        }
        if (state.armor !== undefined) {
            const armorChanged = !this.armor || JSON.stringify(this.armor) !== JSON.stringify(state.armor);
            if (armorChanged) {
                this.armor = state.armor;
                if (this.armor && typeof normalizeGearProgressFields === 'function') normalizeGearProgressFields(this.armor);
                gearChanged = true;
            }
        }
        if (state.accessory !== undefined) {
            const accessoryChanged = !this.accessory || JSON.stringify(this.accessory) !== JSON.stringify(state.accessory);
            if (accessoryChanged) {
                this.accessory = state.accessory;
                if (this.accessory && typeof normalizeGearProgressFields === 'function') normalizeGearProgressFields(this.accessory);
                gearChanged = true;
            }
        }

        // Items (sync item inventory for multiplayer)
        let itemsChanged = false;
        if (state.items !== undefined && this.itemManager) {
            const currentItems = this.itemManager.serialize();
            itemsChanged = JSON.stringify(currentItems) !== JSON.stringify(state.items);
            if (itemsChanged) {
                this.itemManager.deserialize(state.items);
            }
        }

        // If gear or items changed, recalculate all stats with affixes
        if ((gearChanged || itemsChanged) && this.updateEffectiveStats) {
            this.updateEffectiveStats();
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
        return typeof Engine !== 'undefined' && Engine.Audio &&
            Engine.Audio.initialized &&
            !Engine.Audio.muted &&
            typeof GameAudio !== 'undefined' &&
            GameAudio.sounds;
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
        if (this.canPlayClientAudio() && GameAudio.sounds.dodge) {
            GameAudio.sounds.dodge();
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
        if (this.canPlayClientAudio() && GameAudio.sounds.avatarDefeat) {
            GameAudio.sounds.avatarDefeat();
        }
    }

    handleSubclassClientAudio(_prevState, _currentState, _rawState) {
        // Default: subclasses can override for additional events
    }

    // Get gameplay position (predicted pose for local client; host auth for remote shadows)
    getGameplayPosition() {
        const isMultiplayerClient = typeof Game !== 'undefined' &&
            Game.multiplayerEnabled &&
            typeof multiplayerManager !== 'undefined' &&
            multiplayerManager &&
            !multiplayerManager.isHost;

        const predictionOn = isMultiplayerClient &&
            multiplayerManager.predictionEnabled &&
            this === (typeof Game !== 'undefined' ? Game.player : null);

        if (predictionOn) {
            return { x: this.x, y: this.y };
        }

        if (isMultiplayerClient && this.targetX !== null && this.targetY !== null) {
            return { x: this.targetX, y: this.targetY };
        }

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

    switch (classType) {
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

