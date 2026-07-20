// Warrior class (Square) - extends PlayerBase

const WARRIOR_CONFIG = {
    // Base Stats (from CLASS_DEFINITIONS)
    baseHp: 100,                   // Starting health points
    baseDamage: 12,                // Base damage per attack
    baseSpeed: 175,                // Movement speed (pixels/second)
    baseDefense: 0.1,              // Damage reduction (0.1 = 10%)
    critChance: 0,                 // Critical hit chance (0 = 0%)

    // Level Up Bonuses (per upgrade level purchased in nexus)
    damagePerLevel: 0.5,           // Damage increase per level
    defensePerLevel: 0.005,        // Defense increase per level (0.005 = 0.5%)
    speedPerLevel: 2,              // Speed increase per level (pixels/second)
    cooldownPerLevel: 0.01,        // Cooldown reduction per level (0.01 = 1% per level)
    healthPerLevel: 5,             // Health increase per level (flat HP)
    attackSpeedPerLevel: 0.05,     // Attack speed increase per level (0.05 = 5% faster per level)

    // Basic Attack (Melee Cleave)
    cleaveHitboxCount: 4,          // Number of hitboxes in cleave line
    cleaveBaseDistance: 10,        // Distance from player to first hitbox (pixels)
    cleaveSpacing: 45,             // Spacing between hitboxes (pixels)
    cleaveHitboxRadius: 20,        // Radius of each hitbox (pixels)
    cleaveDamage: 1,             // Damage multiplier for cleave

    // Heavy Attack (Forward Thrust)
    heavyAttackCooldown: 3.5,      // Cooldown for heavy attack (seconds)
    thrustDistance: 275,           // Distance of forward thrust (pixels)
    thrustDuration: 0.12,          // How long the thrust takes (seconds)
    thrustDamage: 2.2,             // Damage multiplier for thrust (once per contact; was multi-frame)
    thrustHitRadius: 13,           // Hit detection radius around thrust path (pixels)
    thrustKnockback: 120,          // Knockback force applied to hit enemies

    // Special Ability (Whirlwind)
    specialCooldown: 5.5,          // Special ability cooldown (seconds)
    whirlwindDuration: 2.1,        // How long whirlwind lasts (seconds)
    whirlwindDamage: 1.8,          // Damage multiplier per hit
    whirlwindRadius: 90,           // Radius from player edge (pixels)
    whirlwindHitInterval: 0.2,     // Time between damage ticks (seconds)
    whirlwindRotationSpeed: Math.PI * 0.5, // Visual rotation speed (radians/second)
    whirlwindInvulnTime: 0.3,      // Invulnerability duration on activation (seconds)

    // Block Stance (Passive)
    blockActivationTime: 0.5,     // Time standing still to activate block (seconds)
    blockDamageReduction: 0.25,     // Damage reduction when blocking (0.5 = 50%)
    blockMinVelocity: 10,          // Velocity threshold for standing still (pixels/second)

    // Descriptions for UI (tooltips, character sheet)
    descriptions: {
        playstyle: "Balanced melee fighter with defensive options",
        basic: "Sword Swing - Wide coverage with {cleaveHitboxCount} hitboxes",
        heavy: "Forward Thrust - Rush forward, {thrustDamage|mult} damage + knockback",
        special: "Whirlwind - Spinning blades rotate around player for {whirlwindDuration}s",
        passive: "Block Stance - 50% damage reduction when standing still",
        baseStats: "{baseDefense|percent} Base Defense, Balanced Stats"
    },

    // Room 0 combat tutorial coach copy + special completion rules
    room0Tutorial: {
        specialCompletesOnCast: false,
        dash: {
            title: 'Dash',
            body: 'Dash across the line{hint} to dodge through danger.'
        },
        primary: {
            title: 'Sword Swing',
            body: 'Swing your sword{hint} and hit the dummy.'
        },
        heavy: {
            title: 'Forward Thrust',
            body: 'Thrust forward{hint} through the dummy.'
        },
        special: {
            title: 'Whirlwind',
            body: 'Activate Whirlwind{hint} near the dummy so it takes damage.'
        }
    }
};

const warriorBlockBubbleCache = (() => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(64, 64, 40, 64, 64, 64);
    grad.addColorStop(0, 'rgba(100, 150, 255, 1)');
    grad.addColorStop(0.5, 'rgba(150, 200, 255, 0.6)');
    grad.addColorStop(1, 'rgba(200, 250, 255, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(64, 64, 64, 0, Math.PI * 2);
    ctx.fill();
    return canvas;
})();

class Warrior extends PlayerBase {
    constructor(x = 400, y = 300) {
        super(x, y);

        // Set class identifier
        this.playerClass = 'square';
        this.room0Tutorial = WARRIOR_CONFIG.room0Tutorial;

        // Load class definition (visual properties only)
        const classDef = CLASS_DEFINITIONS.square;

        // Load upgrades from save system
        let upgradeBonuses = { damage: 0, defense: 0, speed: 0, cooldown: 0, health: 0, attackSpeed: 0 };
        if (typeof SaveSystem !== 'undefined') {
            const upgrades = SaveSystem.getUpgrades('square');
            // Calculate bonuses using config values
            upgradeBonuses.damage = upgrades.damage * WARRIOR_CONFIG.damagePerLevel;
            upgradeBonuses.defense = upgrades.defense * WARRIOR_CONFIG.defensePerLevel;
            upgradeBonuses.speed = upgrades.speed * WARRIOR_CONFIG.speedPerLevel;
            upgradeBonuses.cooldown = upgrades.cooldown * WARRIOR_CONFIG.cooldownPerLevel;
            upgradeBonuses.health = upgrades.health * WARRIOR_CONFIG.healthPerLevel;
            upgradeBonuses.attackSpeed = upgrades.attackSpeed * WARRIOR_CONFIG.attackSpeedPerLevel;
        }

        // Set base stats from CONFIG (single source of truth)
        this.baseDamage = WARRIOR_CONFIG.baseDamage + upgradeBonuses.damage;
        this.baseMoveSpeed = WARRIOR_CONFIG.baseSpeed + upgradeBonuses.speed;
        this.initialBaseMoveSpeed = this.baseMoveSpeed; // Store original for level scaling
        this.baseDefense = WARRIOR_CONFIG.baseDefense + upgradeBonuses.defense;
        this.baseMaxHp = WARRIOR_CONFIG.baseHp + upgradeBonuses.health; // Store base max HP for gear calculations
        this.maxHp = WARRIOR_CONFIG.baseHp + upgradeBonuses.health;
        this.hp = WARRIOR_CONFIG.baseHp + upgradeBonuses.health;
        
        // Apply cooldown and attack speed upgrades
        this.cooldownReduction = Math.min(0.75, upgradeBonuses.cooldown); // Cap at 75%
        this.attackSpeedMultiplier = 1.0 + upgradeBonuses.attackSpeed;
        this.baseCritChance = WARRIOR_CONFIG.critChance || 0; // Store base for updateEffectiveStats
        this.critChance = WARRIOR_CONFIG.critChance || 0;
        this.color = classDef.color;
        this.shape = classDef.shape;
        this.syncBaseStatAnchors();

        // Standard single charge dodge for Warrior
        this.baseDodgeCharges = 1; // Store base value for updateEffectiveStats
        this.dodgeCharges = 1;
        this.maxDodgeCharges = 1;
        this.dodgeChargeCooldowns = [0];

        // Heavy attack cooldown
        this.heavyAttackCooldownTime = WARRIOR_CONFIG.heavyAttackCooldown;

        // Block stance passive
        this.blockStanceActive = false;
        this.blockStanceTimer = 0;
        this.blockStanceActivationTime = WARRIOR_CONFIG.blockActivationTime;

        // Whirlwind special ability
        this.whirlwindActive = false;
        this.whirlwindElapsed = 0;
        this.whirlwindStartTime = 0; // Timestamp for smooth visual rotation
        this.whirlwindDuration = WARRIOR_CONFIG.whirlwindDuration;
        this.whirlwindHitTimer = 0;

        // Forward thrust heavy attack
        this.thrustActive = false;
        this.thrustElapsed = 0;
        this.thrustDuration = WARRIOR_CONFIG.thrustDuration;
        this.thrustStartX = 0;
        this.thrustStartY = 0;
        this.thrustTargetX = 0;
        this.thrustTargetY = 0;

        // Forward thrust preview (for mobile)
        this.thrustPreviewActive = false;
        this.thrustPreviewX = 0;
        this.thrustPreviewY = 0;
        this.thrustPreviewDistance = 0;

        // Class modifier storage
        this.whirlwindDamageMultiplier = 1.0;
        this.thrustDistanceBonus = 0;
        this.thrustDamageMultiplier = 1.0;
        this.blockReductionBonus = 0;

        // Update effective stats
        this.updateEffectiveStats();
        
        // Reapply upgrade bonuses after updateEffectiveStats (which resets these values)
        this.cooldownReduction = Math.min(0.75, upgradeBonuses.cooldown); // Cap at 75%
        this.attackSpeedMultiplier = 1.0 + upgradeBonuses.attackSpeed;

        console.log('Warrior class initialized');
    }

    // Override updateEffectiveStats to reset class modifiers
    updateEffectiveStats() {
        // Reset class modifier storage
        this.whirlwindDamageMultiplier = 1.0;
        this.whirlwindDurationBonus = 0;
        this.whirlwindPullEffect = false;
        this.whirlwindDamageAura = false;
        this.whirlwindResetOnKill = false;
        this.thrustDistanceBonus = 0;
        this.thrustDamageMultiplier = 1.0;
        this.thrustKnockback = false;
        this.thrustPierce = false;
        this.thrustInfiniteRange = false;
        this.thrustPierceAll = false;
        this.thrustBurningTrail = false;
        this.blockReductionBonus = 0;
        this.blockDamageBoostOnBlock = 0;
        this.blockReflectOnBlock = false;

        // Call parent (applies stat modifiers from cards)
        super.updateEffectiveStats();

    }

    // Override to apply Warrior-specific class modifiers
    applyClassModifier(modifier) {
        // Call parent for universal modifiers
        super.applyClassModifier(modifier);

        // Handle Warrior-specific modifiers
        if (modifier.class === 'square') {
            switch (modifier.type) {
                case 'whirlwind_duration':
                    this.whirlwindDuration += modifier.value;
                    break;
                case 'whirlwind_damage':
                    this.whirlwindDamageMultiplier += modifier.value;
                    break;
                case 'thrust_distance':
                    this.thrustDistanceBonus += modifier.value;
                    break;
                case 'thrust_damage':
                    this.thrustDamageMultiplier += modifier.value;
                    break;
                case 'block_reduction':
                    this.blockReductionBonus += modifier.value;
                    break;
            }
        }
    }

    // Override to check for thrust movement
    isInSpecialMovement() {
        return this.thrustActive;
    }

    // Override to update class-specific abilities
    updateClassAbilities(deltaTime, input) {
        // Update block stance timer (Warrior passive)
        const velocityMagnitude = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        if (velocityMagnitude < WARRIOR_CONFIG.blockMinVelocity) {
            // Standing still - increase timer
            this.blockStanceTimer += deltaTime;
            if (this.blockStanceTimer >= this.blockStanceActivationTime) {
                this.blockStanceActive = true;
            }
        } else {
            // Moving - reset timer and deactivate
            this.blockStanceTimer = 0;
            this.blockStanceActive = false;
        }

        // Update whirlwind ability
        if (this.whirlwindActive) {
            this.whirlwindElapsed += deltaTime;
            this.whirlwindHitTimer += deltaTime;

            // Deal damage at regular intervals to nearby enemies
            if (this.whirlwindHitTimer >= WARRIOR_CONFIG.whirlwindHitInterval && typeof Game !== 'undefined' && Game.enemies) {
                // Play whirlwind hit sound
                if (typeof GameAudio !== 'undefined' && GameAudio.sounds) {
                    GameAudio.sounds.warriorWhirlwindHit();
                }

                this._whirlwindPulseIndex = (this._whirlwindPulseIndex || 0) + 1;
                const whirlwindPulseKey = `${this._whirlwindSessionId}:${this._whirlwindPulseIndex}`;

                const baseWhirlwindDamage = this.damage * WARRIOR_CONFIG.whirlwindDamage * this.whirlwindDamageMultiplier; // Apply class modifier
                const whirlwindRadius = (this.size + WARRIOR_CONFIG.whirlwindRadius) * (this.whirlwindRadiusMultiplier || 1.0);

                Game.enemies.forEach(enemy => {
                    if (enemy.alive) {
                        const whirlwindHit = typeof checkEnemyCircleCollision === 'function'
                            ? checkEnemyCircleCollision(this.x, this.y, whirlwindRadius, enemy)
                            : null;
                        const distance = whirlwindHit
                            ? (whirlwindHit.hit ? 0 : Infinity)
                            : Math.sqrt((enemy.x - this.x) ** 2 + (enemy.y - this.y) ** 2);

                        if (whirlwindHit ? whirlwindHit.hit : distance < whirlwindRadius) {
                            // Check for crit
                            const isCrit = Math.random() < this.critChance;
                            const critMultiplier = isCrit ? (2.0 * (this.critDamageMultiplier || 1.0)) : 1.0;
                            const whirlwindDamage = baseWhirlwindDamage * critMultiplier;

                            // Calculate damage dealt BEFORE applying damage
                            const damageDealt = Math.min(whirlwindDamage, enemy.hp);

                            // Get player ID for damage attribution
                            const attackerId = this.playerId || (typeof Game !== 'undefined' && Game.getLocalPlayerId ? Game.getLocalPlayerId() : null);

                            enemy.takeDamage(whirlwindDamage, attackerId);

                            // Track stats (host/solo only)
                            const isClient = typeof Game !== 'undefined' && Game.isMultiplayerClient && Game.isMultiplayerClient();
                            if (!isClient) {
                                // Track lifetime damage stat
                                if (typeof window.trackLifetimeStat === 'function') {
                                    window.trackLifetimeStat('totalDamageDealt', damageDealt);
                                }

                                if (typeof Game !== 'undefined' && Game.getPlayerStats && attackerId) {
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
                                        if (typeof LedgerManager !== 'undefined' && LedgerManager.recordEvent) {
                                            LedgerManager.recordEvent('whirlwindKill', { player: this, enemy });
                                        }
                                    }
                                }
                            }

                            // Create damage number for special ability
                            if (typeof createDamageNumber !== 'undefined') {
                                createDamageNumber(enemy.x, enemy.y, damageDealt, isCrit, false);
                            }
                            if (typeof hostBroadcastDamageNumber === 'function') {
                                hostBroadcastDamageNumber(enemy.x, enemy.y, damageDealt, {
                                    enemyId: enemy.id,
                                    isCrit
                                });
                            }

                            // Apply lifesteal once per enemy per whirlwind pulse
                            if (!isClient && typeof applyLifesteal !== 'undefined') {
                                applyLifesteal(this, damageDealt, {
                                    enemy,
                                    source: 'whirlwind',
                                    pulseKey: whirlwindPulseKey
                                });
                            }
                        }
                    }
                });

                this.whirlwindHitTimer = 0;
            }

            // End whirlwind after duration (includes kill-extension bonus, capped in LedgerManager)
            const effectiveWhirlwindDuration = WARRIOR_CONFIG.whirlwindDuration
                + (this.whirlwindDurationBonus || 0)
                + (this._whirlwindKillExtend || 0);
            if (typeof LedgerManager !== 'undefined' && LedgerManager.recordEvent) {
                LedgerManager.recordEvent('whirlwindTick', { elapsed: this.whirlwindElapsed, player: this });
            }
            if (this.whirlwindElapsed >= effectiveWhirlwindDuration) {
                this.whirlwindActive = false;
                this.whirlwindElapsed = 0;
                this.whirlwindHitTimer = 0;
                this._whirlwindKillExtend = 0;
                this._whirlwindKillCount = 0;
            }
        }

        // Update forward thrust animation
        if (this.thrustActive) {
            this.thrustElapsed += deltaTime;

            // Interpolate player position between start and target
            const thrustProgress = Math.min(this.thrustElapsed / this.thrustDuration, 1.0);
            this.x = this.thrustStartX + (this.thrustTargetX - this.thrustStartX) * thrustProgress;
            this.y = this.thrustStartY + (this.thrustTargetY - this.thrustStartY) * thrustProgress;

            // Keep player in bounds
            if (typeof Game !== 'undefined' && Game.canvas) {
                // Use room bounds instead of canvas bounds
                const roomWidth = (typeof currentRoom !== 'undefined' && currentRoom) ? currentRoom.width : Game.canvas.width;
                const roomHeight = (typeof currentRoom !== 'undefined' && currentRoom) ? currentRoom.height : Game.canvas.height;
                this.x = clamp(this.x, this.size, roomWidth - this.size);
                this.y = clamp(this.y, this.size, roomHeight - this.size);
            }

            // Deal damage to enemies along the rushing path (once per contact; Parallel = twin contacts)
            if (typeof Game !== 'undefined' && Game.enemies) {
                const thrustDirX = Math.cos(this.rotation);
                const thrustDirY = Math.sin(this.rotation);
                const share = (this.thrustDamageShare != null) ? this.thrustDamageShare : 1.0;
                const baseThrustDamage = this.damage * WARRIOR_CONFIG.thrustDamage * this.thrustDamageMultiplier * share;
                const reachMult = typeof getWeaponMeleeReachMult === 'function' ? getWeaponMeleeReachMult(this) : (this.weaponRangeMultiplier || 1.0);
                const effectiveThrustDistance = (WARRIOR_CONFIG.thrustDistance + this.thrustDistanceBonus) * reachMult;
                const dualStagger = typeof getWeaponDualStaggerSec === 'function' ? getWeaponDualStaggerSec(this) : 0;
                const isParallel = !!this.thrustIsParallel;

                // Parallel contact-2: hit cached victims once more after stagger
                if (isParallel && !this.thrustParallelSecondFired && dualStagger > 0
                    && this.thrustElapsed >= dualStagger
                    && this.thrustParallelCachedIds && this.thrustParallelCachedIds.length) {
                    this.thrustParallelSecondFired = true;
                    this.thrustParallelCachedIds.forEach(id => {
                        const enemy = (typeof findEnemyByStableId === 'function')
                            ? findEnemyByStableId(Game.enemies, id)
                            : Game.enemies.find(e => e && (e.id === id || e.enemyId === id));
                        if (!enemy || !enemy.alive) return;
                        this.applyThrustHitToEnemy(enemy, baseThrustDamage, thrustDirX, thrustDirY, {
                            isParallelSecond: true
                        });
                    });
                }

                Game.enemies.forEach(enemy => {
                    if (!enemy.alive) return;
                    const sid = (typeof getEnemyStableId === 'function') ? getEnemyStableId(enemy) : (enemy.id || enemy.enemyId);
                    if (sid != null && this.thrustHitEnemies && this.thrustHitEnemies.has(sid)) return;

                    const bodies = typeof getEnemyCollisionBodies === 'function'
                        ? getEnemyCollisionBodies(enemy)
                        : [{ x: enemy.x, y: enemy.y, radius: enemy.size }];
                    let bodyHit = false;
                    let hitPerpX = 0;
                    let hitPerpY = 0;
                    let hitPerpDist = 1;
                    for (let b = 0; b < bodies.length; b++) {
                        const body = bodies[b];
                        const enemyDx = body.x - this.x;
                        const enemyDy = body.y - this.y;
                        const dot = enemyDx * thrustDirX + enemyDy * thrustDirY;
                        const forwardDist = dot;
                        if (forwardDist < -this.size - body.radius - 10 || forwardDist > effectiveThrustDistance + 10) {
                            continue;
                        }
                        const perpX = enemyDx - thrustDirX * dot;
                        const perpY = enemyDy - thrustDirY * dot;
                        const perpDist = Math.sqrt(perpX * perpX + perpY * perpY);
                        if (perpDist < this.size + body.radius + WARRIOR_CONFIG.thrustHitRadius) {
                            bodyHit = true;
                            hitPerpX = perpX;
                            hitPerpY = perpY;
                            hitPerpDist = perpDist;
                            break;
                        }
                    }
                    if (!bodyHit) return;

                    if (sid != null) {
                        if (!this.thrustHitEnemies) this.thrustHitEnemies = new Set();
                        this.thrustHitEnemies.add(sid);
                        if (isParallel && this.thrustParallelCachedIds
                            && this.thrustParallelCachedIds.indexOf(sid) === -1) {
                            this.thrustParallelCachedIds.push(sid);
                        }
                    }

                    this.applyThrustHitToEnemy(enemy, baseThrustDamage, thrustDirX, thrustDirY, {
                        isParallelSecond: false,
                        hitPerpX,
                        hitPerpY,
                        hitPerpDist
                    });
                });
            }

            // End thrust after duration
            if (this.thrustElapsed >= this.thrustDuration) {
                // Ensure Parallel contact-2 still lands if dash ended early
                if (this.thrustIsParallel && !this.thrustParallelSecondFired
                    && this.thrustParallelCachedIds && this.thrustParallelCachedIds.length
                    && typeof Game !== 'undefined' && Game.enemies) {
                    this.thrustParallelSecondFired = true;
                    const share = (this.thrustDamageShare != null) ? this.thrustDamageShare : 0.5;
                    const baseThrustDamage = this.damage * WARRIOR_CONFIG.thrustDamage * this.thrustDamageMultiplier * share;
                    const thrustDirX = Math.cos(this.rotation);
                    const thrustDirY = Math.sin(this.rotation);
                    this.thrustParallelCachedIds.forEach(id => {
                        const enemy = (typeof findEnemyByStableId === 'function')
                            ? findEnemyByStableId(Game.enemies, id)
                            : Game.enemies.find(e => e && (e.id === id || e.enemyId === id));
                        if (!enemy || !enemy.alive) return;
                        this.applyThrustHitToEnemy(enemy, baseThrustDamage, thrustDirX, thrustDirY, {
                            isParallelSecond: true
                        });
                    });
                }
                this.thrustActive = false;
                this.thrustElapsed = 0;
                this.thrustDuration = WARRIOR_CONFIG.thrustDuration; // Reset to base duration
            }
        }

        // Update thrust preview if active (warrior on mobile)
        if (this.thrustPreviewActive) {
            this.updateThrustPreview(input);
        }
    }

    // Override executeAttack for Warrior melee cleave
    executeAttack(input) {
        this.meleeAttack();

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

    meleeAttack() {
        // Play warrior basic attack sound
        if (typeof GameAudio !== 'undefined' && GameAudio.sounds) {
            GameAudio.sounds.warriorBasicAttack();
        }

        // Warrior: Sword swing with hitboxes spread out in a line
        const hitboxRadius = WARRIOR_CONFIG.cleaveHitboxRadius * (this.aoeMultiplier || 1.0) * (this.cleaveAreaMultiplier || 1.0); // Apply AoE multiplier
        const cleaveDamage = this.damage * WARRIOR_CONFIG.cleaveDamage;

        // Get gameplay position (authoritative position in multiplayer)
        const pos = this.getGameplayPosition();

        // Create hitboxes in a straight line in front of the player
        const rangeMult = this.weaponRangeMultiplier || 1.0;
        const baseDistance = (this.size + WARRIOR_CONFIG.cleaveBaseDistance) * rangeMult;
        const spacing = WARRIOR_CONFIG.cleaveSpacing * rangeMult;

        for (let i = 0; i < WARRIOR_CONFIG.cleaveHitboxCount; i++) {
            const distance = baseDistance + (i * spacing);
            const hitboxX = pos.x + Math.cos(this.rotation) * distance;
            const hitboxY = pos.y + Math.sin(this.rotation) * distance;

            this.attackHitboxes.push({
                x: hitboxX,
                y: hitboxY,
                radius: hitboxRadius,
                damage: cleaveDamage,
                duration: this.attackDuration,
                elapsed: 0,
                hitEnemies: new Set()
            });
        }
    }

    // Override createHeavyAttack for forward thrust
    createHeavyAttack() {
        if (typeof beginLifestealAttackSwing === 'function') {
            beginLifestealAttackSwing(this);
        }
        this.createForwardThrust();

        this.isAttacking = true;
        setTimeout(() => {
            this.isAttacking = false;
        }, this.attackDuration * 1000);

        // Start charge effect animation
        this.heavyChargeEffectActive = true;
        this.heavyChargeEffectElapsed = 0;

        // Screen shake on heavy fire; hitpause waits for first connect
        if (typeof Game !== 'undefined') {
            Game.triggerScreenShake(0.5, 0.2);
        }

        // Apply standardized heavy cooldown for UI parity
        if (this.applyHeavyAttackCooldown) {
            this.applyHeavyAttackCooldown();
        }
    }

    applyThrustHitToEnemy(enemy, baseThrustDamage, thrustDirX, thrustDirY, options) {
        options = options || {};
        const hitProxy = { isParallelSecond: !!options.isParallelSecond };
        const allowProc = typeof shouldRollWeaponProcOnHit !== 'function'
            || shouldRollWeaponProcOnHit(this, hitProxy);
        const allowStatus = typeof shouldApplyWeaponStatusOnHit !== 'function'
            || shouldApplyWeaponStatusOnHit(this, hitProxy);

        const isCrit = allowProc && Math.random() < (this.critChance || 0);
        const critMultiplier = isCrit ? (2.0 * (this.critDamageMultiplier || 1.0)) : 1.0;
        let thrustDamage = baseThrustDamage * critMultiplier;

        const isClient = typeof Game !== 'undefined' && Game.isMultiplayerClient && Game.isMultiplayerClient();

        if (enemy.vulnerable && enemy.vulnerabilityMultiplier && enemy.vulnerabilityMultiplier > 1.0) {
            thrustDamage *= enemy.vulnerabilityMultiplier;
        }

        const damageDealt = Math.min(thrustDamage, enemy.hp);
        const attackerId = this.playerId || (typeof Game !== 'undefined' && Game.getLocalPlayerId ? Game.getLocalPlayerId() : null);

        enemy.takeDamage(thrustDamage, attackerId);

        // First thrust connect only — same budget as melee hitpause
        if (!isClient && !options.isParallelSecond
            && (!this.thrustHitEnemies || this.thrustHitEnemies.size <= 1)
            && typeof Game !== 'undefined' && typeof Game.triggerHitPause === 'function') {
            const scale = this.weaponHitpauseScale != null ? this.weaponHitpauseScale : 1.0;
            if (scale > 0) Game.triggerHitPause(0.014 * scale);
        }

        if (!isClient) {
            if (typeof window.trackLifetimeStat === 'function') {
                window.trackLifetimeStat('totalDamageDealt', damageDealt);
            }
            if (typeof Game !== 'undefined' && Game.getPlayerStats && attackerId) {
                const stats = Game.getPlayerStats(attackerId);
                if (stats) {
                    stats.addStat('damageDealt', damageDealt);
                }
                if (enemy.hp <= 0) {
                    const killStats = Game.getPlayerStats(attackerId);
                    if (killStats) {
                        killStats.addStat('kills', 1);
                    }
                }
            }
        }

        if (typeof applyLifesteal !== 'undefined') {
            applyLifesteal(this, damageDealt, { enemy, source: 'melee' });
        }

        if (allowStatus && typeof applyLegendaryEffects !== 'undefined') {
            applyLegendaryEffects(this, enemy, damageDealt, attackerId);
        }
        if (allowStatus && this.activeLegendaryEffects && !this.thrustHasChainedLegendary) {
            this.activeLegendaryEffects.forEach(effect => {
                if (effect.type === 'chain_lightning' && typeof chainLightningAttack !== 'undefined') {
                    chainLightningAttack(this, enemy, effect, thrustDamage);
                    this.thrustHasChainedLegendary = true;
                }
            });
        }

        if (typeof createDamageNumber !== 'undefined') {
            createDamageNumber(enemy.x, enemy.y, damageDealt, isCrit, false);
        }

        let hitPerpX = options.hitPerpX;
        let hitPerpY = options.hitPerpY;
        let hitPerpDist = options.hitPerpDist;
        if (hitPerpX == null || hitPerpY == null) {
            const enemyDx = enemy.x - this.x;
            const enemyDy = enemy.y - this.y;
            const dot = enemyDx * thrustDirX + enemyDy * thrustDirY;
            hitPerpX = enemyDx - thrustDirX * dot;
            hitPerpY = enemyDy - thrustDirY * dot;
            hitPerpDist = Math.sqrt(hitPerpX * hitPerpX + hitPerpY * hitPerpY);
        }
        const kbMult = typeof getWeaponKnockbackMult === 'function' ? getWeaponKnockbackMult(this) : 1.0;
        const pushForce = WARRIOR_CONFIG.thrustKnockback * kbMult * (this.knockbackMultiplier || 1.0);
        const perpXNorm = hitPerpX / (hitPerpDist + 0.001);
        const perpYNorm = hitPerpY / (hitPerpDist + 0.001);
        const sourceId = this.playerId || this.id || null;
        if (typeof enemy.applyImpulse === 'function') {
            enemy.applyImpulse(perpXNorm * pushForce, perpYNorm * pushForce, { sourceId });
        } else if (enemy.applyKnockback) {
            enemy.applyKnockback(perpXNorm * pushForce, perpYNorm * pushForce, sourceId);
        }
    }

    createForwardThrust() {
        // Play warrior heavy attack sound
        if (typeof GameAudio !== 'undefined' && GameAudio.sounds) {
            GameAudio.sounds.warriorHeavyAttack();
        }

        // Warrior forward thrust - rush forward while dealing damage along the path
        const reachMult = typeof getWeaponMeleeReachMult === 'function' ? getWeaponMeleeReachMult(this) : (this.weaponRangeMultiplier || 1.0);
        const thrustDistance = (WARRIOR_CONFIG.thrustDistance + this.thrustDistanceBonus) * reachMult;
        const thrustDirX = Math.cos(this.rotation);
        const thrustDirY = Math.sin(this.rotation);

        // Get gameplay position (authoritative position in multiplayer)
        const pos = this.getGameplayPosition();

        // Clear preview when thrust starts
        this.thrustPreviewActive = false;

        // Save start position
        this.thrustStartX = pos.x;
        this.thrustStartY = pos.y;

        // Calculate target position
        const targetX = pos.x + thrustDirX * thrustDistance;
        const targetY = pos.y + thrustDirY * thrustDistance;

        // Keep target in bounds
        if (typeof Game !== 'undefined' && Game.canvas) {
            // Use room bounds instead of canvas bounds
            const roomWidth = (typeof currentRoom !== 'undefined' && currentRoom) ? currentRoom.width : Game.canvas.width;
            const roomHeight = (typeof currentRoom !== 'undefined' && currentRoom) ? currentRoom.height : Game.canvas.height;
            this.thrustTargetX = clamp(targetX, this.size, roomWidth - this.size);
            this.thrustTargetY = clamp(targetY, this.size, roomHeight - this.size);
        } else {
            this.thrustTargetX = targetX;
            this.thrustTargetY = targetY;
        }

        // Start thrust animation
        this.thrustActive = true;
        this.thrustElapsed = 0;
        this.thrustHasChainedLegendary = false; // Reset chain flag for this thrust
        this.thrustHitEnemies = new Set();
        this.thrustParallelCachedIds = [];
        this.thrustParallelSecondFired = false;
        this.thrustIsParallel = typeof playerWeaponIsParallel === 'function' && playerWeaponIsParallel(this);
        this.thrustDamageShare = this.thrustIsParallel
            ? (typeof getWeaponPerHitDamageShare === 'function' ? getWeaponPerHitDamageShare(this) : 0.5)
            : 1.0;

        // Track ability use for lifetime stats
        if (typeof window.trackLifetimeStat === 'function') {
            window.trackLifetimeStat('totalAbilityUses', 1);
        }

        // Scale thrust duration based on actual distance traveled (maintains constant speed)
        // Base: 300px in 0.12s, with +100 bonus: 400px in 0.16s
        const actualDistance = Math.sqrt(
            (this.thrustTargetX - this.thrustStartX) ** 2 +
            (this.thrustTargetY - this.thrustStartY) ** 2
        );
        const baseThrustDistance = WARRIOR_CONFIG.thrustDistance;
        const scaledThrustDuration = (WARRIOR_CONFIG.thrustDuration / (this.thrustSpeedMultiplier || 1.0)) * (actualDistance / baseThrustDistance);
        this.thrustDuration = scaledThrustDuration;

        // Grant invincibility during thrust (scaled with distance)
        this.invulnerable = true;
        this.invulnerabilityTime = scaledThrustDuration;
    }

    // Override activateSpecialAbility for whirlwind
    activateSpecialAbility(input) {
        this.activateWhirlwind();
    }

    activateWhirlwind() {
        this.notifyTutorialCombatAction('special');

        // Play whirlwind activation sound
        if (typeof GameAudio !== 'undefined' && GameAudio.sounds) {
            GameAudio.sounds.warriorWhirlwindStart();
        }

        this.whirlwindActive = true;
        this.whirlwindElapsed = 0;
        this.whirlwindHitTimer = 0;
        this._whirlwindSessionId = (this._whirlwindSessionId || 0) + 1;
        this._whirlwindPulseIndex = 0;
        this._whirlwindKillExtend = 0;
        this._whirlwindKillCount = 0;
        this.whirlwindStartTime = Date.now(); // Track start time for smooth visual rotation
        // Apply cooldown reduction
        const effectiveSpecialCooldown = this.specialCooldownTime * (1 - this.cooldownReduction);
        this.specialCooldown = effectiveSpecialCooldown;
        this.invulnerable = true;
        this.invulnerabilityTime = WARRIOR_CONFIG.whirlwindInvulnTime;
        console.log('Whirlwind activated!');
    }

    // Override getDamageReduction for block stance
    getDamageReduction() {
        // Block stance (Warrior passive: damage reduction when standing still and active)
        if (this.blockStanceActive) {
            return WARRIOR_CONFIG.blockDamageReduction + this.blockReductionBonus; // Apply class modifier
        }
        return 0;
    }

    // Override initHeavyAttackPreview
    initHeavyAttackPreview() {
        this.thrustPreviewActive = true;
    }

    // Override updateHeavyAttackPreview
    updateHeavyAttackPreview(input) {
        this.thrustPreviewActive = true;
    }

    // Override clearHeavyAttackPreview
    clearHeavyAttackPreview() {
        this.thrustPreviewActive = false;
    }

    // Update thrust preview (shows forward thrust destination - warrior on mobile)
    updateThrustPreview(input) {
        if (!input.isTouchMode || !input.isTouchMode()) return;

        this.thrustPreviewActive = true;

        // Calculate thrust destination based on current rotation
        const thrustDistance = WARRIOR_CONFIG.thrustDistance + this.thrustDistanceBonus; // Include bonus
        const thrustDirX = Math.cos(this.rotation);
        const thrustDirY = Math.sin(this.rotation);

        let targetX = this.x + thrustDirX * thrustDistance;
        let targetY = this.y + thrustDirY * thrustDistance;

        // Clamp to bounds
        if (typeof Game !== 'undefined' && Game.canvas) {
            // Use room bounds instead of canvas bounds
            const roomWidth = (typeof currentRoom !== 'undefined' && currentRoom) ? currentRoom.width : Game.canvas.width;
            const roomHeight = (typeof currentRoom !== 'undefined' && currentRoom) ? currentRoom.height : Game.canvas.height;
            targetX = clamp(targetX, this.size, roomWidth - this.size);
            targetY = clamp(targetY, this.size, roomHeight - this.size);
        }

        // Calculate actual distance (may be less if clamped)
        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const actualDistance = Math.sqrt(dx * dx + dy * dy);

        this.thrustPreviewX = targetX;
        this.thrustPreviewY = targetY;
        this.thrustPreviewDistance = actualDistance;
    }

    // Override renderClassVisuals for Warrior-specific visuals
    renderClassVisuals(ctx) {
        // Draw block stance visual (Warrior passive) - light bubble when active
        if (this.blockStanceActive) {
            // Calculate activation progress for smooth appearance
            const activationProgress = Math.min(1.0, this.blockStanceTimer / this.blockStanceActivationTime);

            // Outer glow - pulsing light blue/white bubble
            const pulseTime = Date.now() * 0.005;
            const pulseAlpha = 0.3 + Math.sin(pulseTime) * 0.2;
            const bubbleRadius = this.size + 15 + Math.sin(pulseTime * 2) * 2;

            ctx.save();
            ctx.globalAlpha = pulseAlpha * activationProgress;
            const drawSize = bubbleRadius * 2;
            ctx.drawImage(
                warriorBlockBubbleCache,
                this.x - bubbleRadius,
                this.y - bubbleRadius,
                drawSize,
                drawSize
            );
            ctx.globalAlpha = 1;
            ctx.restore();

            ctx.strokeStyle = `rgba(150, 200, 255, ${0.7 * activationProgress})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(this.x, this.y, bubbleRadius, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Draw whirlwind visual - spinning blades that rotate around the player
        if (this.whirlwindActive) {
            ctx.save();
            ctx.translate(this.x, this.y);

            // Continuously rotating angle based on elapsed time
            // Use local time for smooth 60fps rotation (not limited by network update rate)
            const spinSpeed = 10; // Full rotations per second
            const localElapsed = (Date.now() - this.whirlwindStartTime) / 1000;
            const spinAngle = localElapsed * Math.PI * 2 * spinSpeed;
            ctx.rotate(spinAngle);

            // Draw spinning blades
            for (let i = 0; i < 4; i++) {
                const bladeAngle = (Math.PI * 2 / 4) * i;
                ctx.fillStyle = 'rgba(255, 255, 100, 0.6)';
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(Math.cos(bladeAngle) * (this.size + 60), Math.sin(bladeAngle) * (this.size + 60));
                ctx.lineTo(Math.cos(bladeAngle + 0.3) * (this.size + 40), Math.sin(bladeAngle + 0.3) * (this.size + 40));
                ctx.closePath();
                ctx.fill();
            }

            ctx.restore();
        }

        // Draw forward thrust visual - speed lines/trail
        if (this.thrustActive) {
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(this.rotation);

            const thrustProgress = this.thrustElapsed / this.thrustDuration;
            const thrustAlpha = 0.6 * (1 - thrustProgress); // Fade out as thrust completes

            // Draw multiple speed lines behind player
            for (let i = 0; i < 5; i++) {
                const lineOffset = -this.size - 15 - i * 10;
                const lineLength = 15 + i * 3;
                const lineAlpha = thrustAlpha * (1 - i / 5);

                ctx.strokeStyle = `rgba(255, 255, 100, ${lineAlpha})`;
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(lineOffset, -this.size / 2 + (i - 2.5) * 5);
                ctx.lineTo(lineOffset - lineLength, -this.size / 2 + (i - 2.5) * 5);
                ctx.stroke();
            }

            // Draw glint on front of player
            ctx.fillStyle = `rgba(255, 255, 150, ${thrustAlpha})`;
            ctx.beginPath();
            ctx.arc(this.size + 5, 0, 8, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        }

        // Draw thrust preview - shows forward thrust destination (warrior on mobile)
        if (this.thrustPreviewActive) {
            ctx.save();

            // Draw line from player to destination
            ctx.strokeStyle = 'rgba(100, 150, 255, 0.6)'; // Blue color matching square/warrior
            ctx.lineWidth = 3;
            ctx.setLineDash([5, 5]); // Dashed line
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.thrustPreviewX, this.thrustPreviewY);
            ctx.stroke();
            ctx.setLineDash([]); // Reset dash

            // Draw destination indicator (pulsing circle)
            const pulse = Math.sin(Date.now() / 150) * 0.3 + 0.7; // Pulse between 0.4 and 1.0
            const indicatorRadius = 15 * pulse;

            // Outer glow
            ctx.fillStyle = `rgba(100, 150, 255, ${0.4 * pulse})`;
            ctx.beginPath();
            ctx.arc(this.thrustPreviewX, this.thrustPreviewY, indicatorRadius + 5, 0, Math.PI * 2);
            ctx.fill();

            // Inner circle
            ctx.fillStyle = `rgba(150, 200, 255, ${0.8 * pulse})`;
            ctx.beginPath();
            ctx.arc(this.thrustPreviewX, this.thrustPreviewY, indicatorRadius, 0, Math.PI * 2);
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
            ctx.fillText(`${Math.round(this.thrustPreviewDistance)}px`, this.thrustPreviewX, this.thrustPreviewY + indicatorRadius + 8);

            ctx.restore();
        }

        // Draw heavy charge effect - Warrior forward thrust indicator
        if (this.heavyChargeEffectActive) {
            const chargeProgress = this.heavyChargeEffectElapsed / this.heavyChargeEffectDuration;
            const pulseSize = 1.0 + Math.sin(chargeProgress * Math.PI * 4) * 0.1;

            ctx.save();
            ctx.globalAlpha = 0.6;

            // Warrior: Forward thrust indicator (arrow/line pointing forward)
            ctx.strokeStyle = '#ffff00';
            ctx.lineWidth = 3;
            const thrustLength = 300 * pulseSize; // Match the new 300px distance
            const thrustDirX = Math.cos(this.rotation);
            const thrustDirY = Math.sin(this.rotation);

            // Draw thrust line
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.x + thrustDirX * thrustLength, this.y + thrustDirY * thrustLength);
            ctx.stroke();

            // Draw arrow head
            const arrowSize = 15;
            const tipX = this.x + thrustDirX * thrustLength;
            const tipY = this.y + thrustDirY * thrustLength;
            const perpX = -thrustDirY * arrowSize * 0.5;
            const perpY = thrustDirX * arrowSize * 0.5;

            ctx.beginPath();
            ctx.moveTo(tipX, tipY);
            ctx.lineTo(tipX - thrustDirX * arrowSize + perpX, tipY - thrustDirY * arrowSize + perpY);
            ctx.lineTo(tipX - thrustDirX * arrowSize - perpX, tipY - thrustDirY * arrowSize - perpY);
            ctx.closePath();
            ctx.fill();

            ctx.restore();
        }
    }

    // Override serialize to include Warrior-specific state
    serialize() {
        const baseState = super.serialize();
        return {
            ...baseState,
            // Warrior-specific abilities
            whirlwindActive: this.whirlwindActive,
            whirlwindElapsed: this.whirlwindElapsed,
            whirlwindStartTime: this.whirlwindStartTime, // For smooth visual rotation
            blockStanceActive: this.blockStanceActive,
            blockStanceTimer: this.blockStanceTimer, // For correct shield visual progress on clients
            thrustActive: this.thrustActive,
            thrustElapsed: this.thrustElapsed // For correct thrust trail fade-out on clients
        };
    }

    // Override applyState to handle Warrior-specific state
    applyState(state) {
        super.applyState(state);
        // Warrior-specific properties
        if (state.whirlwindActive !== undefined) this.whirlwindActive = state.whirlwindActive;
        if (state.whirlwindElapsed !== undefined) this.whirlwindElapsed = state.whirlwindElapsed;
        if (state.whirlwindStartTime !== undefined) this.whirlwindStartTime = state.whirlwindStartTime;
        if (state.blockStanceActive !== undefined) this.blockStanceActive = state.blockStanceActive;
        if (state.blockStanceTimer !== undefined) this.blockStanceTimer = state.blockStanceTimer;
        if (state.thrustActive !== undefined) this.thrustActive = state.thrustActive;
        if (state.thrustElapsed !== undefined) this.thrustElapsed = state.thrustElapsed;
    }

    getAdditionalAudioTrackedFields(state) {
        return {
            thrustActive: state && state.thrustActive !== undefined ? state.thrustActive : !!this.thrustActive,
            whirlwindActive: state && state.whirlwindActive !== undefined ? state.whirlwindActive : !!this.whirlwindActive
        };
    }

    getAdditionalAudioTrackedFieldsFromInstance() {
        return {
            thrustActive: !!this.thrustActive,
            whirlwindActive: !!this.whirlwindActive
        };
    }

    onClientAttackStarted() {
        if (this.canPlayClientAudio() && GameAudio.sounds && GameAudio.sounds.warriorBasicAttack) {
            GameAudio.sounds.warriorBasicAttack();
        }
    }

    onClientHeavyAttackTriggered() {
        if (!this.canPlayClientAudio() || !GameAudio.sounds || !GameAudio.sounds.warriorHeavyAttack) {
            return false;
        }
        GameAudio.sounds.warriorHeavyAttack();
        return true;
    }

    handleSubclassClientAudio(prevState, currentState) {
        if (!this.canPlayClientAudio() || !GameAudio.sounds) {
            return;
        }

        const heavyTriggered = this.didHeavyAttackTrigger(prevState, currentState);
        if (!prevState.thrustActive && currentState.thrustActive && !heavyTriggered && GameAudio.sounds.warriorHeavyAttack) {
            GameAudio.sounds.warriorHeavyAttack();
        }

        if (!prevState.whirlwindActive && currentState.whirlwindActive && GameAudio.sounds.warriorWhirlwindStart) {
            GameAudio.sounds.warriorWhirlwindStart();
        }
    }
}

