// Tank class (Pentagon) - extends PlayerBase

// ============================================================================
// TANK CONFIGURATION - Adjust these values for game balancing
// ============================================================================

const TANK_CONFIG = {
    // Base Stats (from CLASS_DEFINITIONS)
    baseHp: 150,                   // Starting health points
    baseDamage: 12,                 // Base damage per attack
    baseSpeed: 167.5,              // Movement speed (pixels/second)
    baseDefense: 0.15,              // Damage reduction (0.15 = 15%)
    critChance: 0,                 // Critical hit chance (0 = 0%)
    
    // Level Up Bonuses (per upgrade level purchased in nexus)
    damagePerLevel: 0.5,           // Damage increase per level
    defensePerLevel: 0.005,        // Defense increase per level (0.005 = 0.5%)
    speedPerLevel: 2,              // Speed increase per level (pixels/second)
    
    // Basic Attack (Hammer Swing)
    hammerDistance: 81,            // Distance from player center to hammer (pixels) - increased 15%
    hammerArcWidth: 130,           // Arc width in degrees
    hammerSwingDuration: 0.3,      // Duration of hammer swing animation (seconds)
    hammerHitboxRadius: 35,        // Radius of hammer hitbox (pixels) - increased 15%
    hammerHealOnHit: 0.05,         // Heal 5% of damage dealt with hammer attacks
    
    // Heavy Attack (Shout)
    heavyAttackCooldown: 2.5,      // Cooldown for heavy attack (seconds)
    shoutDamage: 0.975,            // Damage multiplier for shout (reduced by 25% from 1.3)
    shoutRadius: 140,              // Radius of shout AoE (increased from 120)
    shoutHitboxCount: 8,           // Number of hitboxes in ring
    shoutHitboxDistance: 70,       // Distance from player to hitboxes (increased for coverage)
    shoutHitboxRadius: 50,         // Radius of each hitbox (increased for coverage)
    shoutStunDuration: 1.5,        // Stun duration on enemies hit (seconds)
    shoutSlowAmount: 0.5,          // Slow percentage after stun (0.5 = 50% slow)
    shoutSlowDuration: 2.0,        // Slow duration after stun expires (seconds)
    shoutAggroMultiplier: 3.0,     // Aggro threat multiplier (false damage spike)
    
    // Special Ability (Shield)
    specialCooldown: 5.0,          // Special ability cooldown (seconds)
    shieldDuration: 2.1,           // How long shield lasts when held (seconds)
    shieldDamageReduction: 0.5,    // Damage reduction while shield is active (0.5 = 50%)
    shieldInvulnTime: 0.2,         // Invulnerability duration on activation (seconds)
    shieldWaveDuration: 0.5,       // Duration of shield wave animation (seconds)
    shieldWaveDamage: 2.5,         // Damage multiplier for shield wave
    shieldWaveRange: 200,          // Maximum range of shield wave (pixels)
    shieldWaveWidth: 150,          // Width of shield wave (pixels)
    shieldWaveKnockback: 300,      // Knockback force of shield wave (pixels)
    shieldDistance: 25,             // Distance shield starts from player (pixels)
    shieldDepth: 20,               // Forward extent of shield (pixels)
    shieldWidth: 120,              // Lateral width of shield (pixels)
    shieldKnockbackDistance: 15,   // Knockback distance per frame (pixels)
    
    // Passive Ability (Retaliatory Knockback)
    passiveKnockbackRadius: 80,    // Radius for passive knockback (small)
    passiveKnockbackForce: 200,    // Knockback force (small)
    passiveKnockbackCooldown: 3.0, // Cooldown between passive triggers (seconds)
    
    // Descriptions for UI (tooltips, character sheet)
    descriptions: {
        playstyle: "Crowd control tank with sustain and aggro management",
        basic: "Hammer Slam - Wide cone attack with life steal on hit",
        heavy: "Shout - AoE stun + slow, {shoutDamage|mult} damage + aggro spike",
        special: "Shield Defense - Block for {shieldDuration}s, then wave pulse attack",
        passive: "Retaliatory Knockback - Small knockback when hit",
        baseStats: "{baseDefense|percent} Base Defense, {baseHp} HP"
    }
};

class Tank extends PlayerBase {
    constructor(x = 400, y = 300) {
        super(x, y);
        
        // Set class identifier
        this.playerClass = 'pentagon';
        
        // Load class definition (visual properties only)
        const classDef = CLASS_DEFINITIONS.pentagon;
        
        // Load upgrades from save system
        let upgradeBonuses = { damage: 0, defense: 0, speed: 0 };
        if (typeof SaveSystem !== 'undefined') {
            const upgrades = SaveSystem.getUpgrades('pentagon');
            // Calculate bonuses using config values
            upgradeBonuses.damage = upgrades.damage * TANK_CONFIG.damagePerLevel;
            upgradeBonuses.defense = upgrades.defense * TANK_CONFIG.defensePerLevel;
            upgradeBonuses.speed = upgrades.speed * TANK_CONFIG.speedPerLevel;
        }
        
        // Set base stats from CONFIG (single source of truth)
        this.baseDamage = TANK_CONFIG.baseDamage + upgradeBonuses.damage;
        this.baseMoveSpeed = TANK_CONFIG.baseSpeed + upgradeBonuses.speed;
        this.initialBaseMoveSpeed = this.baseMoveSpeed; // Store original for level scaling
        this.baseDefense = TANK_CONFIG.baseDefense + upgradeBonuses.defense;
        this.baseMaxHp = TANK_CONFIG.baseHp; // Store base max HP for gear calculations
        this.maxHp = TANK_CONFIG.baseHp;
        this.hp = TANK_CONFIG.baseHp;
        this.baseCritChance = TANK_CONFIG.critChance || 0; // Store base for updateEffectiveStats
        this.critChance = TANK_CONFIG.critChance || 0;
        this.color = classDef.color;
        this.shape = classDef.shape;
        this.syncBaseStatAnchors();
        
        // Standard single dodge for Tank
        this.baseDodgeCharges = 1; // Store base value for updateEffectiveStats
        this.dodgeCharges = 1;
        this.maxDodgeCharges = 1;
        this.dodgeChargeCooldowns = [0];
        
        // Heavy attack cooldown
        this.heavyAttackCooldownTime = TANK_CONFIG.heavyAttackCooldown;
        
        // Shield special ability
        this.shieldActive = false;
        this.shieldElapsed = 0;
        this.shieldDuration = TANK_CONFIG.shieldDuration;
        this.shieldWaveActive = false;
        this.shieldWaveElapsed = 0;
        this.shieldWaveDuration = TANK_CONFIG.shieldWaveDuration;
        this.shieldDirection = 0; // Store shield direction for wave
        this.shieldWaveHitEnemies = null; // Set of enemies hit by wave
        
        // Hammer swing attack
        this.hammerSwingDirection = 1; // Alternates between 1 (right) and -1 (left)
        
        // Passive ability (retaliatory knockback)
        this.passiveKnockbackCooldown = 0;
        
        // Class modifier storage
        this.shieldDurationBonus = 0;
        this.shieldWaveDamageMultiplier = 1.0;
        this.shieldLargerWaveRadius = false;
        this.shieldDamageReductionWhileShielding = false;
        this.shieldExplodeOnBreak = false;
        this.shoutRadiusBonus = 0;
        this.hammerRadiusBonus = 0;
        this.hammerKnockbackMultiplier = 1.0;
        this.hammerStunEffect = false;
        this.hammerDamageZone = false;
        this.hammerShockwave = false;
        this.shieldReductionBonus = 0;
        
        // Update effective stats
        this.updateEffectiveStats();
        
        console.log('Tank class initialized');
    }
    
    // Override updateEffectiveStats to reset class modifiers
    updateEffectiveStats() {
        // Reset class modifier storage
        this.shieldDurationBonus = 0;
        this.shieldWaveDamageMultiplier = 1.0;
        this.shieldLargerWaveRadius = false;
        this.shieldDamageReductionWhileShielding = false;
        this.shieldExplodeOnBreak = false;
        this.shoutRadiusBonus = 0;
        this.hammerRadiusBonus = 0;
        this.hammerKnockbackMultiplier = 1.0;
        this.hammerStunEffect = false;
        this.hammerDamageZone = false;
        this.hammerShockwave = false;
        this.shieldReductionBonus = 0;
        
        // Call parent (applies stat modifiers from cards)
        super.updateEffectiveStats();
        
        // Apply ability mutator card effects
        if (typeof DeckState !== 'undefined' && typeof CardEffects !== 'undefined' && CardEffects.getAbilityModifiers) {
            const handCards = Array.isArray(DeckState.hand) ? DeckState.hand : [];
            const abilityMods = CardEffects.getAbilityModifiers(this, handCards);
            
            if (abilityMods.shield) {
                if (abilityMods.shield.durationBonus) {
                    this.shieldDurationBonus += abilityMods.shield.durationBonus;
                }
                if (abilityMods.shield.waveDamageMultiplier) {
                    this.shieldWaveDamageMultiplier += abilityMods.shield.waveDamageMultiplier;
                }
                if (abilityMods.shield.largerWaveRadius) {
                    this.shieldLargerWaveRadius = true;
                }
                if (abilityMods.shield.damageReductionWhileShielding) {
                    this.shieldDamageReductionWhileShielding = true;
                }
                if (abilityMods.shield.explodeOnBreak) {
                    this.shieldExplodeOnBreak = true;
                }
            }
            
            if (abilityMods.hammer) {
                if (abilityMods.hammer.radiusBonus) {
                    this.hammerRadiusBonus += abilityMods.hammer.radiusBonus;
                }
                if (abilityMods.hammer.knockbackMultiplier) {
                    this.hammerKnockbackMultiplier += abilityMods.hammer.knockbackMultiplier;
                }
                if (abilityMods.hammer.stunEffect) {
                    this.hammerStunEffect = true;
                }
                if (abilityMods.hammer.damageZone) {
                    this.hammerDamageZone = true;
                }
                if (abilityMods.hammer.shockwave) {
                    this.hammerShockwave = true;
                }
            }
        }
    }
    
    // Override to apply Tank-specific class modifiers
    applyClassModifier(modifier) {
        // Call parent for universal modifiers
        super.applyClassModifier(modifier);
        
        // Handle Tank-specific modifiers
        if (modifier.class === 'pentagon') {
            switch(modifier.type) {
                case 'shield_duration':
                    this.shieldDurationBonus += modifier.value;
                    break;
                case 'shield_wave_damage':
                    this.shieldWaveDamageMultiplier += modifier.value;
                    break;
                case 'shout_radius':
                case 'smash_radius': // Keep old name for backward compatibility
                    this.shoutRadiusBonus += modifier.value;
                    break;
                case 'hammer_knockback':
                    this.hammerKnockbackMultiplier += modifier.value;
                    break;
                case 'shield_reduction':
                    this.shieldReductionBonus += modifier.value;
                    break;
            }
        }
    }
    
    // Override takeDamage for passive knockback
    takeDamage(damage, sourceEnemy = null) {
        // Call parent takeDamage first
        super.takeDamage(damage, sourceEnemy);
        
        // Trigger passive knockback if cooldown is ready and not dead
        if (this.passiveKnockbackCooldown <= 0 && this.alive && !this.dead) {
            this.triggerPassiveKnockback();
            this.passiveKnockbackCooldown = TANK_CONFIG.passiveKnockbackCooldown;
        }
    }
    
    // Trigger passive knockback (when hit)
    triggerPassiveKnockback() {
        if (typeof Game === 'undefined' || !Game.enemies) return;
        
        const knockbackRadius = TANK_CONFIG.passiveKnockbackRadius;
        const knockbackForce = TANK_CONFIG.passiveKnockbackForce;
        
        Game.enemies.forEach(enemy => {
            if (enemy.alive) {
                const dx = enemy.x - this.x;
                const dy = enemy.y - this.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < knockbackRadius + enemy.size) {
                    // Push enemy away from tank
                    const pushDirX = dx / distance;
                    const pushDirY = dy / distance;
                    enemy.applyKnockback(pushDirX * knockbackForce, pushDirY * knockbackForce);
                }
            }
        });
        
        // Visual feedback
        if (typeof createParticleBurst !== 'undefined') {
            createParticleBurst(this.x, this.y, '#ff6666', 8);
        }
    }
    
    // Override executeAttack for Tank hammer swing
    executeAttack(input) {
        this.hammerSwingAttack();
        
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
    
    hammerSwingAttack() {
        // Track ability use for lifetime stats
        if (typeof window.trackLifetimeStat === 'function') {
            window.trackLifetimeStat('totalAbilityUses', 1);
        }
        
        // Play tank basic attack sound
        if (typeof AudioManager !== 'undefined' && AudioManager.sounds) {
            AudioManager.sounds.tankBasicAttack();
        }
        
        // Tank: Hammer swing in arc
        const hammerDamage = this.damage;
        const hammerDistance = TANK_CONFIG.hammerDistance;
        const arcWidth = (TANK_CONFIG.hammerArcWidth * Math.PI) / 180; // Convert degrees to radians
        const arcHalf = arcWidth / 2;
        
        // Get gameplay position (authoritative position in multiplayer)
        const pos = this.getGameplayPosition();
        
        // Calculate start angle based on swing direction
        // For right swing (1): start at -65° and sweep to +65°
        // For left swing (-1): start at +65° and sweep to -65°
        const startAngle = this.rotation + (this.hammerSwingDirection * -arcHalf);
        
        // Initial hammer position
        const hammerX = pos.x + Math.cos(startAngle) * hammerDistance;
        const hammerY = pos.y + Math.sin(startAngle) * hammerDistance;
        
        this.attackHitboxes.push({
            x: hammerX,
            y: hammerY,
            radius: TANK_CONFIG.hammerHitboxRadius * (this.aoeMultiplier || 1.0), // Apply AoE multiplier
            damage: hammerDamage,
            duration: TANK_CONFIG.hammerSwingDuration,
            elapsed: 0,
            hitEnemies: new Set(),
            
            // Hammer-specific properties
            type: 'hammer',
            startAngle: startAngle,
            currentAngle: startAngle,
            swingDirection: this.hammerSwingDirection,
            arcWidth: arcWidth,
            hammerDistance: hammerDistance,
            trail: [] // Array of {x, y, time} for trail effect
        });
        
        // Alternate swing direction for next attack
        this.hammerSwingDirection *= -1;
    }
    
    // Override createHeavyAttack for shout
    createHeavyAttack() {
        this.createShout();
        
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
        
        // Apply standardized heavy cooldown for UI parity
        if (this.applyHeavyAttackCooldown) {
            this.applyHeavyAttackCooldown();
        }
    }
    
    createShout() {
        // Play tank heavy attack sound
        if (typeof AudioManager !== 'undefined' && AudioManager.sounds) {
            AudioManager.sounds.tankHeavyAttack();
        }
        
        // Tank shout - AoE around player that stuns, slows, and generates massive aggro
        const shoutDamage = this.damage * TANK_CONFIG.shoutDamage;
        const shoutRadius = TANK_CONFIG.shoutRadius + this.shoutRadiusBonus; // Apply class modifier
        
        // Get gameplay position (authoritative position in multiplayer)
        const pos = this.getGameplayPosition();
        
        // Create hitboxes in a ring around the player
        const numHitboxes = TANK_CONFIG.shoutHitboxCount;
        for (let i = 0; i < numHitboxes; i++) {
            const angle = (Math.PI * 2 / numHitboxes) * i;
            const distance = this.size + TANK_CONFIG.shoutHitboxDistance;
            
            const hitboxX = pos.x + Math.cos(angle) * distance;
            const hitboxY = pos.y + Math.sin(angle) * distance;
        
            this.attackHitboxes.push({
                x: hitboxX,
                y: hitboxY,
                radius: TANK_CONFIG.shoutHitboxRadius,
                damage: shoutDamage,
                duration: this.attackDuration,
                elapsed: 0,
                heavy: true,
                type: 'shout', // Mark as shout for special handling
                hitEnemies: new Set()
            });
        }
        
        // Apply stun, slow, and aggro spike to enemies in range
        if (typeof Game !== 'undefined' && Game.enemies) {
            // Get player ID for aggro attribution
            const attackerId = this.playerId || (typeof Game !== 'undefined' && Game.getLocalPlayerId ? Game.getLocalPlayerId() : null);
            
            Game.enemies.forEach(enemy => {
                if (enemy.alive) {
                    const dx = enemy.x - this.x;
                    const dy = enemy.y - this.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance < shoutRadius) {
                        // Apply stun
                        if (enemy.applyStun) {
                            enemy.applyStun(TANK_CONFIG.shoutStunDuration);
                        }
                        
                        // Apply slow (will activate after stun expires)
                        if (enemy.applySlow) {
                            enemy.applySlow(TANK_CONFIG.shoutSlowAmount, TANK_CONFIG.shoutSlowDuration);
                        }
                        
                        // Add massive aggro spike (false damage for threat)
                        if (enemy.addThreat && attackerId) {
                            const aggroSpike = shoutDamage * TANK_CONFIG.shoutAggroMultiplier;
                            enemy.addThreat(attackerId, aggroSpike);
                        }
                    }
                }
            });
        }
    }
    
    // Override handleSpecialAbility for shield press-and-hold behavior
    handleSpecialAbility(input) {
        // Check for special ability input (Spacebar or touch button)
        let specialJustPressed = false;
        let specialPressed = false;
        
        if (input.isTouchMode && input.isTouchMode()) {
            // Touch mode: check for special ability button
            if (input.touchButtons && input.touchButtons.specialAbility) {
                const button = input.touchButtons.specialAbility;
                specialPressed = button.pressed;
                
                // Shield: press-and-hold (directional, continuous)
                if (button.justPressed && this.specialCooldown <= 0 && !this.shieldActive) {
                    this.activateShield(input);
                }
                // Deactivate shield when button is released
                if (button.justReleased && this.shieldActive) {
                    this.shieldActive = false;
                    this.shieldElapsed = 0;
                    // Start wave animation
                    this.shieldWaveActive = true;
                    this.shieldWaveElapsed = 0;
                }
            }
        } else {
            // Keyboard/mouse mode: check for Spacebar
            const spaceJustPressed = input.getKeyState(' ') && !this.lastSpacebar;
            this.lastSpacebar = input.getKeyState(' ');
            specialJustPressed = spaceJustPressed;
            specialPressed = input.getKeyState(' ');
            
            // Handle shield (pentagon) - press and hold
            if (spaceJustPressed && this.specialCooldown <= 0 && !this.shieldActive) {
                this.activateShield(input);
            }
            // Deactivate shield when spacebar released
            if (!specialPressed && this.shieldActive) {
                this.shieldActive = false;
                this.shieldElapsed = 0;
                // Start wave animation
                this.shieldWaveActive = true;
                this.shieldWaveElapsed = 0;
            }
        }
    }
    
    // Override activateSpecialAbility for shield
    activateSpecialAbility(input) {
        this.activateShield(input);
    }
    
    activateShield(input) {
        // Track ability use for lifetime stats
        if (typeof window.trackLifetimeStat === 'function') {
            window.trackLifetimeStat('totalAbilityUses', 1);
        }
        // Play tank shield activation sound
        if (typeof AudioManager !== 'undefined' && AudioManager.sounds) {
            AudioManager.sounds.tankShieldStart();
        }
        
        this.shieldActive = true;
        this.shieldElapsed = 0;
        // Apply cooldown reduction
        const effectiveSpecialCooldown = this.specialCooldownTime * (1 - this.cooldownReduction);
        this.specialCooldown = effectiveSpecialCooldown;
        this.invulnerable = true;
        this.invulnerabilityTime = TANK_CONFIG.shieldInvulnTime;
        this.shieldDirection = this.rotation; // Store initial direction
        console.log('Shield activated!');
    }
    
    // Override getDamageReduction for shield
    getDamageReduction() {
        // Shield (Tank passive: damage reduction when shield is active)
        if (this.shieldActive) {
            return TANK_CONFIG.shieldDamageReduction + this.shieldReductionBonus; // Apply class modifier
        }
        return 0;
    }
    
    // Override updateClassAbilities for Tank-specific updates
    updateClassAbilities(deltaTime, input) {
        // Update passive knockback cooldown
        if (this.passiveKnockbackCooldown > 0) {
            this.passiveKnockbackCooldown -= deltaTime;
        }
        
        // Update shield ability
        if (this.shieldActive) {
            this.shieldElapsed += deltaTime;
            
            // Rotation is already updated by getAimDirection() which checks special ability joystick
            // Shield always faces forward (front of character) - just use this.rotation
            // Store shield direction for wave (captured when shield ends)
            this.shieldDirection = this.rotation;
            
            // Block enemies from passing through shield
            if (typeof Game !== 'undefined' && Game.enemies) {
                const shieldDistance = this.size + TANK_CONFIG.shieldDistance;
                const shieldDepth = TANK_CONFIG.shieldDepth;
                const shieldWidth = TANK_CONFIG.shieldWidth;
                const shieldVisualStart = this.size + TANK_CONFIG.shieldDistance - (shieldDepth / 2);
                
                Game.enemies.forEach(enemy => {
                    if (enemy.alive) {
                        // Calculate relative position to player
                        const dx = enemy.x - this.x;
                        const dy = enemy.y - this.y;
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        
                        if (distance < shieldDistance + shieldDepth + enemy.size) {
                            // Check if enemy is in front of player
                            const relX = dx / distance;
                            const relY = dy / distance;
                            const playerDirX = Math.cos(this.rotation);
                            const playerDirY = Math.sin(this.rotation);
                            
                            const dot = relX * playerDirX + relY * playerDirY;
                            
                            if (dot > 0 && distance > shieldDistance) {
                                // Enemy is in front, check if within shield bounds
                                const perpendicularX = -playerDirY;
                                const perpendicularY = playerDirX;
                                const lateralDist = Math.abs(dx * perpendicularX + dy * perpendicularY);
                                
                                if (lateralDist < shieldWidth / 2 + enemy.size) {
                                    // Enemy is hitting the shield, push them back
                                    const knockbackDistance = TANK_CONFIG.shieldKnockbackDistance;
                                    const knockbackDir = {
                                        x: (enemy.x - this.x) / distance,
                                        y: (enemy.y - this.y) / distance
                                    };
                                    
                                    enemy.x += knockbackDir.x * knockbackDistance * deltaTime * 10;
                                    enemy.y += knockbackDir.y * knockbackDistance * deltaTime * 10;
                                    
                                    // Reduce enemy movement speed
                                    enemy.vx *= 0.5;
                                    enemy.vy *= 0.5;
                                }
                            }
                        }
                    }
                });
            }
            
            // End shield and start wave animation after duration
            const effectiveShieldDuration = this.shieldDuration + this.shieldDurationBonus; // Apply class modifier
            if (this.shieldElapsed >= effectiveShieldDuration) {
                this.shieldActive = false;
                this.shieldElapsed = 0;
                // Start wave animation
                this.shieldWaveActive = true;
                this.shieldWaveElapsed = 0;
            }
        }
        
        // Update shield wave animation
        if (this.shieldWaveActive) {
            this.shieldWaveElapsed += deltaTime;
            
            // Initialize hit enemies set if it doesn't exist
            if (!this.shieldWaveHitEnemies) {
                this.shieldWaveHitEnemies = new Set();
            }
            
            if (this.shieldWaveElapsed >= this.shieldWaveDuration) {
                this.shieldWaveActive = false;
                this.shieldWaveElapsed = 0;
                this.shieldWaveHitEnemies = null;
            } else {
                // Push enemies back as the wave advances
                if (typeof Game !== 'undefined' && Game.enemies) {
                    const waveDamage = this.damage * TANK_CONFIG.shieldWaveDamage * this.shieldWaveDamageMultiplier; // Apply class modifier
                    const waveMaxDistance = TANK_CONFIG.shieldWaveRange;
                    const waveWidth = TANK_CONFIG.shieldWaveWidth;
                    
                    // Calculate current wave front distance
                    const waveProgress = this.shieldWaveElapsed / this.shieldWaveDuration;
                    const currentWaveDistance = waveMaxDistance * waveProgress;
                    // Use stored shield direction instead of current rotation (which might be changed by basic attack)
                    const playerDirX = Math.cos(this.shieldDirection);
                    const playerDirY = Math.sin(this.shieldDirection);
                    
                    Game.enemies.forEach(enemy => {
                        if (enemy.alive) {
                            // Calculate relative position to player
                            const dx = enemy.x - this.x;
                            const dy = enemy.y - this.y;
                            const distance = Math.sqrt(dx * dx + dy * dy);
                            
                            // Check if enemy is in front of player
                            const relX = dx / distance;
                            const relY = dy / distance;
                            const dot = relX * playerDirX + relY * playerDirY;
                            
                            if (dot > 0) {
                                // Enemy is in front, check if at wave front
                                const perpendicularX = -playerDirY;
                                const perpendicularY = playerDirX;
                                const lateralDist = Math.abs(dx * perpendicularX + dy * perpendicularY);
                                
                                // Check if enemy is at the current wave front (± a small margin for hit detection)
                                const forwardDistance = distance * dot;
                                const shieldStart = shieldVisualStart;
                                const waveFrontPosition = shieldStart + currentWaveDistance;
                                const waveFrontTolerance = 15; // Small margin for hit detection
                                
                                // Check if enemy is within tolerance of the wave front
                                const distanceFromWaveFront = Math.abs(forwardDistance - waveFrontPosition);
                                if (forwardDistance >= shieldStart && 
                                    distanceFromWaveFront <= enemy.size + waveFrontTolerance &&
                                    lateralDist < waveWidth / 2 + enemy.size) {
                                    
                                    // Deal damage and apply knockback when hit by wave
                                    if (!this.shieldWaveHitEnemies.has(enemy)) {
                                        const damageDealt = Math.min(waveDamage, enemy.hp);
                                        
                                        // Get player ID for damage attribution
                                        const attackerId = this.playerId || (typeof Game !== 'undefined' && Game.getLocalPlayerId ? Game.getLocalPlayerId() : null);
                                        
                                        enemy.takeDamage(waveDamage, attackerId);
                                        this.shieldWaveHitEnemies.add(enemy);
                                        
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
                                                }
                                            }
                                        }
                                        
                                        // Create damage number for special ability
                                        if (typeof createDamageNumber !== 'undefined') {
                                            createDamageNumber(enemy.x, enemy.y, damageDealt, true);
                                        }
                                        
                                        // Apply knockback (wave pushes enemies forward)
                                        const knockbackForce = TANK_CONFIG.shieldWaveKnockback;
                                        enemy.applyKnockback(playerDirX * knockbackForce, playerDirY * knockbackForce);
                                    }
                                }
                            }
                        }
                    });
                }
            }
        }
    }
    
    // Override renderClassVisuals for Tank-specific visuals
    renderClassVisuals(ctx) {
        const shieldVisualStart = this.size + TANK_CONFIG.shieldDistance - (TANK_CONFIG.shieldDepth / 2);
        const shieldVisualDepth = TANK_CONFIG.shieldDepth;
        const shieldVisualHalfWidth = TANK_CONFIG.shieldWidth / 2;
        
        // Draw hammer attack hitboxes with trail
        this.attackHitboxes.forEach(hitbox => {
            if (hitbox.type === 'hammer') {
                // Check if this hitbox has successfully hit enemies
                const hasHitEnemies = hitbox.hitEnemies && hitbox.hitEnemies.size > 0;
                
                // Draw hammer trail first (oldest to newest for proper layering)
                hitbox.trail.forEach((trailPoint, index) => {
                    const trailAge = hitbox.elapsed - trailPoint.time;
                    const trailMaxAge = 0.25;
                    const alpha = 1 - (trailAge / trailMaxAge); // Fade from 1 to 0
                    
                    ctx.fillStyle = `rgba(139, 90, 43, ${alpha * 0.3})`; // Brown with fading opacity
                    ctx.beginPath();
                    ctx.arc(trailPoint.x, trailPoint.y, hitbox.radius * 0.6, 0, Math.PI * 2);
                    ctx.fill();
                });
                
                // Draw hammer handle/staff (line from player to hammer)
                ctx.strokeStyle = hasHitEnemies ? 'rgba(80, 50, 20, 0.8)' : 'rgba(101, 67, 33, 0.7)';
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.moveTo(this.x, this.y);
                ctx.lineTo(hitbox.x, hitbox.y);
                ctx.stroke();
                
                // Draw hammer head at current position
                ctx.save();
                ctx.translate(hitbox.x, hitbox.y);
                ctx.rotate(hitbox.currentAngle + Math.PI / 2); // Rotate hammer perpendicular to swing direction
                
                // Hammer head (large rectangle)
                const hammerWidth = 25;
                const hammerHeight = 35;
                ctx.fillStyle = hasHitEnemies ? 'rgba(180, 120, 60, 0.9)' : 'rgba(139, 90, 43, 0.9)';
                ctx.fillRect(-hammerWidth / 2, -hammerHeight / 2, hammerWidth, hammerHeight);
                
                // Hammer head outline
                ctx.strokeStyle = hasHitEnemies ? 'rgba(255, 200, 0, 0.9)' : 'rgba(101, 67, 33, 0.9)';
                ctx.lineWidth = 2;
                ctx.strokeRect(-hammerWidth / 2, -hammerHeight / 2, hammerWidth, hammerHeight);
                
                // Hammer head details (dark edge)
                ctx.fillStyle = 'rgba(80, 50, 20, 0.8)';
                ctx.fillRect(-hammerWidth / 2, -hammerHeight / 2, hammerWidth, 8);
                
                ctx.restore();
                
                // Draw hitbox circle (semi-transparent, for debug/collision visualization)
                ctx.fillStyle = hasHitEnemies ? 'rgba(100, 255, 100, 0.2)' : 'rgba(139, 90, 43, 0.15)';
                ctx.beginPath();
                ctx.arc(hitbox.x, hitbox.y, hitbox.radius, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.strokeStyle = hasHitEnemies ? 'rgba(0, 255, 0, 0.6)' : 'rgba(101, 67, 33, 0.5)';
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        });
        
        // Draw shield visual - wide thin shield in front of player
        if (this.shieldActive) {
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(this.rotation);
            
            // Draw wide thin shield (thin in depth, wide laterally)
            ctx.fillStyle = 'rgba(150, 200, 255, 0.3)';
            ctx.beginPath();
            ctx.rect(shieldVisualStart, -shieldVisualHalfWidth, shieldVisualDepth, TANK_CONFIG.shieldWidth);
            ctx.fill();
            
            ctx.strokeStyle = 'rgba(150, 200, 255, 0.8)';
            ctx.lineWidth = 4;
            ctx.strokeRect(shieldVisualStart, -shieldVisualHalfWidth, shieldVisualDepth, TANK_CONFIG.shieldWidth);
            
            ctx.restore();
        }
        
        // Draw shield wave animation - pulsed line extending forward
        if (this.shieldWaveActive) {
            ctx.save();
            ctx.translate(this.x, this.y);
            // Use stored shield direction instead of current rotation
            ctx.rotate(this.shieldDirection);
            
            // Animate wave progress (0 to 1)
            const waveProgress = this.shieldWaveElapsed / this.shieldWaveDuration;
            const waveMaxDistance = 200;
            const currentWaveDistance = waveMaxDistance * waveProgress;
            const waveWidth = 150; // Width of the wave
            
            // Draw wave segments as they progress
            const numSegments = 20; // How many segments to draw
            const segmentLength = waveMaxDistance / numSegments;
            
            for (let i = 0; i < numSegments; i++) {
                const segmentDistance = i * segmentLength;
                
                // Only draw segments that have been reached by the wave
                if (segmentDistance <= currentWaveDistance) {
                    // Fade out segments that are behind the wave front
                    const distanceFromFront = currentWaveDistance - segmentDistance;
                    const fadeProgress = distanceFromFront / (waveMaxDistance * 0.3); // Fade over 30% of distance
                    const alpha = Math.max(0, 1 - fadeProgress);
                    
                    // Draw segment
                    const x = shieldVisualStart + segmentDistance;
                    const y1 = -waveWidth / 2;
                    const y2 = waveWidth / 2;
                    
                    ctx.strokeStyle = `rgba(150, 200, 255, ${0.8 * alpha})`;
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.moveTo(x, y1);
                    ctx.lineTo(x, y2);
                    ctx.stroke();
                }
            }
            
            ctx.restore();
        }
        
        // Draw heavy charge effect - Tank shout indicator
        if (this.heavyChargeEffectActive) {
            const chargeProgress = this.heavyChargeEffectElapsed / this.heavyChargeEffectDuration;
            const pulseSize = 1.0 + Math.sin(chargeProgress * Math.PI * 4) * 0.1;
            
            ctx.save();
            ctx.globalAlpha = 0.6;
            
            // Tank: Circular shout indicator (expanding sound waves)
            const shoutRadius = TANK_CONFIG.shoutRadius;
            
            // Draw multiple expanding rings for sound wave effect
            for (let i = 0; i < 3; i++) {
                const ringOffset = i * 30;
                const ringPhase = (chargeProgress * Math.PI * 4 + i * Math.PI / 1.5) % (Math.PI * 2);
                const ringAlpha = 0.4 + Math.sin(ringPhase) * 0.2;
                
                ctx.globalAlpha = ringAlpha;
                ctx.strokeStyle = '#ff6666';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(this.x, this.y, (shoutRadius - ringOffset) * pulseSize, 0, Math.PI * 2);
                ctx.stroke();
            }
            
            ctx.restore();
        }
        
        // Draw shout sound waves (only during heavy attacks)
        const hasHeavyHitbox = this.attackHitboxes.some(h => h.heavy);
        if (this.isAttacking && hasHeavyHitbox && !this.heavyChargeEffectActive) {
            ctx.save();
            
            // Draw multiple expanding sound wave rings
            const shoutRadius = TANK_CONFIG.shoutRadius;
            for (let i = 0; i < 4; i++) {
                const ringRadius = shoutRadius * (0.3 + i * 0.25);
                const alpha = 0.5 - i * 0.1;
                
                ctx.globalAlpha = alpha;
                ctx.strokeStyle = '#ff8844';
                ctx.lineWidth = 4 - i;
                ctx.beginPath();
                ctx.arc(this.x, this.y, ringRadius, 0, Math.PI * 2);
                ctx.stroke();
            }
            
            ctx.restore();
        }
        
        // Draw passive knockback visual (small shockwave when triggered)
        // Note: Particle burst is already created in triggerPassiveKnockback()
        // This adds a brief ring visual
        if (this.passiveKnockbackCooldown >= TANK_CONFIG.passiveKnockbackCooldown - 0.2) {
            const elapsed = TANK_CONFIG.passiveKnockbackCooldown - this.passiveKnockbackCooldown;
            const progress = elapsed / 0.2; // 0.2 second visual duration
            
            ctx.save();
            ctx.globalAlpha = 0.6 * (1 - progress);
            ctx.strokeStyle = '#ff6666';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(this.x, this.y, TANK_CONFIG.passiveKnockbackRadius * (0.5 + progress * 0.5), 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }
    }
    
    // Override serialize to include Tank-specific state
    serialize() {
        const baseState = super.serialize();
        return {
            ...baseState,
            // Tank-specific abilities
            shieldActive: this.shieldActive,
            shieldElapsed: this.shieldElapsed,
            shieldDirection: this.shieldDirection,
            shieldWaveActive: this.shieldWaveActive,
            shieldWaveElapsed: this.shieldWaveElapsed,
            shieldWaveDuration: this.shieldWaveDuration,
            groundSmashActive: this.groundSmashActive
        };
    }
    
    // Override applyState to handle Tank-specific state
    applyState(state) {
        super.applyState(state);
        // Tank-specific properties
        if (state.shieldActive !== undefined) this.shieldActive = state.shieldActive;
        if (state.shieldElapsed !== undefined) this.shieldElapsed = state.shieldElapsed;
        if (state.shieldDirection !== undefined) this.shieldDirection = state.shieldDirection;
        if (state.shieldWaveActive !== undefined) this.shieldWaveActive = state.shieldWaveActive;
        if (state.shieldWaveElapsed !== undefined) this.shieldWaveElapsed = state.shieldWaveElapsed;
        if (state.shieldWaveDuration !== undefined) this.shieldWaveDuration = state.shieldWaveDuration;
        if (state.groundSmashActive !== undefined) this.groundSmashActive = state.groundSmashActive;
    }

    getAdditionalAudioTrackedFields(state) {
        return {
            shieldActive: state && state.shieldActive !== undefined ? state.shieldActive : !!this.shieldActive
        };
    }

    getAdditionalAudioTrackedFieldsFromInstance() {
        return {
            shieldActive: !!this.shieldActive
        };
    }

    onClientAttackStarted() {
        if (this.canPlayClientAudio() && AudioManager.sounds && AudioManager.sounds.tankBasicAttack) {
            AudioManager.sounds.tankBasicAttack();
        }
    }

    onClientHeavyAttackTriggered() {
        if (!this.canPlayClientAudio() || !AudioManager.sounds || !AudioManager.sounds.tankHeavyAttack) {
            return false;
        }
        AudioManager.sounds.tankHeavyAttack();
        return true;
    }

    handleSubclassClientAudio(prevState, currentState) {
        if (!this.canPlayClientAudio() || !AudioManager.sounds) {
            return;
        }
        
        if (!prevState.shieldActive && currentState.shieldActive && AudioManager.sounds.tankShieldStart) {
            AudioManager.sounds.tankShieldStart();
        }
    }
}

