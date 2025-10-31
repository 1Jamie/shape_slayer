// Player class and mechanics

// Class definitions
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
        color: '#ff1493', // Deep pink/hot pink - more distinct from mage
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
        color: '#673ab7', // Purple-blue - more distinct from rogue pink
        shape: 'hexagon'
    }
};

class Player {
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
        
        // Tank hammer swing system
        this.hammerSwingDirection = -1; // -1 for left, 1 for right (alternates each attack)
        
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
        
        // Class
        this.playerClass = null; // Will be set via setClass()
        
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
        
        // Pentagon shield
        this.shieldActive = false;
        this.shieldElapsed = 0;
        this.shieldDuration = 2.1; // Increased from 1.5 (90% longer)
        this.shieldWaveActive = false;
        this.shieldWaveElapsed = 0;
        this.shieldWaveDuration = 0.5;
        this.shieldDirection = 0; // Store shield direction for wave
        
        // Square block stance
        this.blockStanceActive = false;
        this.blockStanceTimer = 0;
        this.blockStanceActivationTime = 0.25; // Must stand still for 0.25 seconds to activate
        
        // Heavy attack animations
        this.heavyChargeEffectActive = false;
        this.heavyChargeEffectElapsed = 0;
        this.heavyChargeEffectDuration = 0.3;
        
        // Square whirlwind
        this.whirlwindActive = false;
        this.whirlwindElapsed = 0;
        this.whirlwindDuration = 2.0;
        this.whirlwindHitTimer = 0;
        
        // Square forward thrust
        this.thrustActive = false;
        this.thrustElapsed = 0;
        this.thrustDuration = 0.12; // How long the rush takes (faster)
        this.thrustStartX = 0;
        this.thrustStartY = 0;
        this.thrustTargetX = 0;
        this.thrustTargetY = 0;
        
        // Triangle shadow clones
        this.shadowClonesActive = false;
        this.shadowClonesElapsed = 0;
        this.shadowClonesDuration = 3.0;
        this.shadowClones = []; // Array of {x, y} for each clone
        
        // Triangle dash preview (similar to blink preview)
        this.dashPreviewActive = false; // Show preview while aiming dash
        this.dashPreviewX = 0;
        this.dashPreviewY = 0;
        this.dashPreviewDistance = 0;
        
        // Triangle heavy attack preview (fan of knives cone)
        this.heavyAttackPreviewActive = false; // Show preview while aiming heavy attack
        this.heavyAttackPreviewAngle = 0; // Center direction of cone
        this.heavyAttackPreviewSpread = Math.PI / 3; // 60 degree spread
        
        // Square/Warrior heavy attack preview (forward thrust)
        this.thrustPreviewActive = false; // Show preview while aiming thrust
        this.thrustPreviewX = 0;
        this.thrustPreviewY = 0;
        this.thrustPreviewDistance = 0;
        
        // Hexagon blink blast
        this.blinkCooldown = 5.0;
        this.blinkDecoyActive = false;
        this.blinkDecoyElapsed = 0;
        this.blinkDecoyDuration = 2.0;
        this.blinkDecoyX = 0;
        this.blinkDecoyY = 0;
        this.blinkExplosionActive = false;
        this.blinkExplosionElapsed = 0;
        this.blinkExplosionDuration = 0.3;
        this.blinkExplosionX = 0;
        this.blinkExplosionY = 0;
        this.blinkKnockbackVx = 0;
        this.blinkKnockbackVy = 0;
        this.blinkPreviewActive = false; // Show preview while aiming
        this.blinkPreviewX = 0;
        this.blinkPreviewY = 0;
        this.blinkPreviewDistance = 0;
        
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
    
    // Set player class
    setClass(classType) {
        if (!CLASS_DEFINITIONS[classType]) {
            console.error('Invalid class:', classType);
            return;
        }
        
        this.playerClass = classType;
        const classDef = CLASS_DEFINITIONS[classType];
        
        // Load upgrades from save system
        let upgradeBonuses = { damage: 0, defense: 0, speed: 0 };
        if (typeof SaveSystem !== 'undefined') {
            const upgrades = SaveSystem.getUpgrades(classType);
            // Calculate bonuses: damage +0.5/level, defense +0.005/level, speed +2/level
            upgradeBonuses.damage = upgrades.damage * 0.5;
            upgradeBonuses.defense = upgrades.defense * 0.005;
            upgradeBonuses.speed = upgrades.speed * 2;
        }
        
        // Set base stats (class stats + upgrade bonuses)
        this.baseDamage = classDef.damage + upgradeBonuses.damage;
        this.baseMoveSpeed = classDef.speed + upgradeBonuses.speed;
        this.baseDefense = classDef.defense + upgradeBonuses.defense;
        this.maxHp = classDef.hp;
        this.hp = classDef.hp;
        this.critChance = classDef.critChance;
        this.color = classDef.color;
        this.shape = classDef.shape;
        
        // Triangle enhanced dodge
        if (classType === 'triangle') {
            this.dodgeCooldownTime = classDef.dodgeCooldown || 2.0;
            this.dodgeSpeedBoost = classDef.dodgeSpeed || 500;
            this.dodgeCharges = classDef.dodgeCharges || 1;
            this.maxDodgeCharges = classDef.dodgeCharges || 1;
            this.dodgeChargeCooldowns = new Array(this.maxDodgeCharges).fill(0); // Track cooldown per charge
        } else {
            // Non-Triangle classes use standard single charge
            this.dodgeCharges = 1;
            this.maxDodgeCharges = 1;
            this.dodgeChargeCooldowns = [0];
        }
        
        // Adjust heavy attack cooldown based on class (balance with power)
        if (classType === 'triangle') {
            this.heavyAttackCooldownTime = 2.0; // Rogue - shorter cooldown, medium power
        } else if (classType === 'square') {
            this.heavyAttackCooldownTime = 2.5; // Warrior - forward thrust has longer cooldown
        } else if (classType === 'pentagon') {
            this.heavyAttackCooldownTime = 2.5; // Tank - longest cooldown, highest power
        } else if (classType === 'hexagon') {
            this.heavyAttackCooldownTime = 2.3; // Mage - 2.3s cooldown (15% increase from 2.0)
        }
        
        // Update effective stats
        this.updateEffectiveStats();
        
        console.log(`Class set to ${classDef.name}`);
    }
    
    update(deltaTime, input) {
        // Don't update if dead
        if (this.dead) {
            this.alive = false;
            return;
        }
        
        // Handle movement - skip if dodging or thrusting
        if (!this.isDodging && !this.thrustActive) {
            // Use unified movement input (works for both keyboard and touch)
            const moveInput = input.getMovementInput ? input.getMovementInput() : { x: 0, y: 0 };
            
            this.vx = moveInput.x * this.moveSpeed;
            this.vy = moveInput.y * this.moveSpeed;
        } else if (this.isDodging) {
            // During dodge, use dodge velocity
            this.vx = this.dodgeVx;
            this.vy = this.dodgeVy;
        } else if (this.thrustActive) {
            // During thrust, no velocity (position is controlled by thrust animation)
            this.vx = 0;
            this.vy = 0;
        }
        
        // Process pull forces (apply before normal movement)
        this.processPullForces(deltaTime);
        
        // Update position (skip during thrust as it's handled by thrust animation)
        // NOTE: Apply normal movement BEFORE blink knockback to avoid position conflicts
        if (!this.thrustActive) {
            this.x += this.vx * deltaTime;
            this.y += this.vy * deltaTime;
        }
        
        // Apply blink knockback if active (after normal movement)
        if (this.blinkKnockbackVx !== 0 || this.blinkKnockbackVy !== 0) {
            this.x += this.blinkKnockbackVx * deltaTime;
            this.y += this.blinkKnockbackVy * deltaTime;
            
            // Decay knockback
            this.blinkKnockbackVx *= 0.85;
            this.blinkKnockbackVy *= 0.85;
            
            if (Math.abs(this.blinkKnockbackVx) < 1) this.blinkKnockbackVx = 0;
            if (Math.abs(this.blinkKnockbackVy) < 1) this.blinkKnockbackVy = 0;
        }
        
        // Check for dodge collision with enemies (for Triangle class)
        if (this.isDodging && this.playerClass === 'triangle' && typeof Game !== 'undefined') {
            const dodgeDamage = this.damage * 0.575; // 15% more than 0.5x
            
            Game.enemies.forEach(enemy => {
                if (enemy.alive && !this.dodgeHitEnemies.has(enemy)) {
                    const dx = enemy.x - this.x;
                    const dy = enemy.y - this.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance < this.size + enemy.size) {
                        // Collision during dodge - deal damage
                        const damageDealt = Math.min(dodgeDamage, enemy.hp);
                        enemy.takeDamage(dodgeDamage);
                        // Show damage number for rogue dodge damage
                        if (typeof createDamageNumber !== 'undefined') {
                            createDamageNumber(enemy.x, enemy.y, damageDealt, true);
                        }
                        this.dodgeHitEnemies.add(enemy); // Mark as hit
                    }
                }
            });
        }
        
        // Keep player within canvas bounds
        if (typeof Game !== 'undefined') {
            this.x = clamp(this.x, this.size, Game.canvas.width - this.size);
            this.y = clamp(this.y, this.size, Game.canvas.height - this.size);
        }
        
        // Calculate rotation to face aim direction (mouse or joystick)
        // Both basic attack and heavy attack joysticks update the same rotation variable
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
        
        // Handle special abilities (Spacebar)
        this.handleSpecialAbility(input);
        
        // Update block stance timer (Warrior passive)
        if (this.playerClass === 'square') {
            const velocityMagnitude = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
            if (velocityMagnitude < 10) {
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
        } else {
            // Not warrior class - reset block stance
            this.blockStanceTimer = 0;
            this.blockStanceActive = false;
        }
        
        // Update blink preview if active
        if (this.blinkPreviewActive && this.playerClass === 'hexagon') {
            this.updateBlinkPreview(input);
        }
        
        // Update dash preview if active (triangle on mobile)
        if (this.dashPreviewActive && this.playerClass === 'triangle') {
            this.updateDashPreview(input);
        }
        
        // Update heavy attack preview if active (triangle on mobile)
        if (this.heavyAttackPreviewActive && this.playerClass === 'triangle') {
            this.updateHeavyAttackPreview(input);
        }
        
        // Update thrust preview if active (square/warrior on mobile)
        if (this.thrustPreviewActive && this.playerClass === 'square') {
            this.updateThrustPreview(input);
        }
        
        // Update attack cooldown
        if (this.attackCooldown > 0) {
            this.attackCooldown -= deltaTime;
        }
        
        // Update heavy attack cooldown
        if (this.heavyAttackCooldown > 0) {
            this.heavyAttackCooldown -= deltaTime;
        }
        
        // Update dodge cooldown (for charge-based or single)
        if (this.playerClass === 'triangle') {
            // Charge-based cooldown system for Triangle
            this.dodgeChargeCooldowns = this.dodgeChargeCooldowns.map(cooldown => {
                if (cooldown > 0) {
                    return cooldown - deltaTime;
                }
                return cooldown;
            });
        } else {
            // Standard single cooldown
            if (this.dodgeCooldown > 0) {
                this.dodgeCooldown -= deltaTime;
            }
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
                    // Just update preview
                    if (this.playerClass === 'triangle') {
                        // Triangle: update preview angle
                        if (Input.touchJoysticks && Input.touchJoysticks.heavyAttack) {
                            const joystick = Input.touchJoysticks.heavyAttack;
                            if (joystick.active && joystick.getMagnitude() > 0.1) {
                                // Update preview angle to match rotation
                                this.heavyAttackPreviewAngle = this.rotation;
                            }
                        }
                    } else if (this.playerClass === 'square') {
                        // Warrior: show thrust preview
                        this.thrustPreviewActive = true;
                    }
                    
                    // Fire on release
                    if (button.justReleased) {
                        // Rotation already updated above, fire the attack immediately
                        this.createHeavyAttack();
                        this.isChargingHeavy = false;
                        this.heavyChargeElapsed = 0;
                        // Clear previews
                        if (this.playerClass === 'triangle') {
                            this.heavyAttackPreviewActive = false;
                        } else if (this.playerClass === 'square') {
                            this.thrustPreviewActive = false;
                        }
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
        
        // Update whirlwind ability
        if (this.whirlwindActive) {
            this.whirlwindElapsed += deltaTime;
            this.whirlwindHitTimer += deltaTime;
            
            // Deal damage every 0.2 seconds to nearby enemies
            if (this.whirlwindHitTimer >= 0.2 && typeof Game !== 'undefined' && Game.enemies) {
                const whirlwindDamage = this.damage * 2.0; // 2x base damage for powerful whirlwind
                const whirlwindRadius = this.size + 90; // 90px radius from player edge
                
                Game.enemies.forEach(enemy => {
                    if (enemy.alive) {
                        const dx = enemy.x - this.x;
                        const dy = enemy.y - this.y;
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        
                        if (distance < whirlwindRadius) {
                            const damageDealt = Math.min(whirlwindDamage, enemy.hp);
                            enemy.takeDamage(whirlwindDamage);
                            
                            // Create damage number for special ability
                            if (typeof createDamageNumber !== 'undefined') {
                                createDamageNumber(enemy.x, enemy.y, damageDealt, true);
                            }
                        }
                    }
                });
                
                this.whirlwindHitTimer = 0;
            }
            
            // End whirlwind after duration
            if (this.whirlwindElapsed >= this.whirlwindDuration) {
                this.whirlwindActive = false;
                this.whirlwindElapsed = 0;
                this.whirlwindHitTimer = 0;
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
                this.x = clamp(this.x, this.size, Game.canvas.width - this.size);
                this.y = clamp(this.y, this.size, Game.canvas.height - this.size);
            }
            
            // Deal damage to enemies along the rushing path (check every frame)
            if (typeof Game !== 'undefined' && Game.enemies) {
                const thrustDirX = Math.cos(this.rotation);
                const thrustDirY = Math.sin(this.rotation);
                const thrustDamage = this.damage * 2;
                
                Game.enemies.forEach(enemy => {
                    if (enemy.alive) {
                        // Check if enemy is in the rush path
                        const enemyDx = enemy.x - this.x;
                        const enemyDy = enemy.y - this.y;
                        
                        // Project enemy position onto rush direction
                        const dot = enemyDx * thrustDirX + enemyDy * thrustDirY;
                        const forwardDist = dot; // Distance along thrust direction
                        
                        // Check if enemy is along the thrust path (behind player, in the rushing area)
                        // Extended range to match 300px thrust distance
                        if (forwardDist >= -this.size - enemy.size - 10 && forwardDist <= 310) {
                            // Calculate perpendicular distance from thrust line
                            const perpX = enemyDx - thrustDirX * dot;
                            const perpY = enemyDy - thrustDirY * dot;
                            const perpDist = Math.sqrt(perpX * perpX + perpY * perpY);
                            
                            // Check if enemy is within hit radius
                            if (perpDist < this.size + enemy.size + 15) {
                                const damageDealt = Math.min(thrustDamage, enemy.hp);
                                enemy.takeDamage(thrustDamage);
                                
                                // Create damage number for heavy attack
                                if (typeof createDamageNumber !== 'undefined') {
                                    createDamageNumber(enemy.x, enemy.y, damageDealt, true);
                                }
                                
                                // Push enemy to the side (perpendicular to thrust direction)
                                const pushForce = 100;
                                const perpXNorm = perpX / (perpDist + 0.001);
                                const perpYNorm = perpY / (perpDist + 0.001);
                                enemy.applyKnockback(perpXNorm * pushForce, perpYNorm * pushForce);
                            }
                        }
                    }
                });
            }
            
            // End thrust after duration
            if (this.thrustElapsed >= this.thrustDuration) {
                this.thrustActive = false;
                this.thrustElapsed = 0;
            }
        }
        
        // Update shadow clones
        if (this.shadowClonesActive) {
            this.shadowClonesElapsed += deltaTime;
            
            // Make clones face randomly (creates illusory movement)
            this.shadowClones.forEach(clone => {
                clone.rotation += deltaTime * 0.5; // Slow random rotation
            });
            
            // End shadow clones after duration
            if (this.shadowClonesElapsed >= this.shadowClonesDuration) {
                this.shadowClonesActive = false;
                this.shadowClonesElapsed = 0;
                this.shadowClones = [];
            }
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
                const shieldDistance = this.size + 5; // Start of shield
                const shieldDepth = 20; // Depth (forward extent)
                const shieldWidth = 120; // Lateral width
                    
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
                                    const knockbackDistance = 30;
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
            if (this.shieldElapsed >= this.shieldDuration) {
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
                    const waveDamage = this.damage * 2.5; // Increased from 2x to 2.5x
                    const waveMaxDistance = 200; // 200px range
                    const waveWidth = 150; // Width of the wave
                    
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
                                const shieldStart = this.size + 5;
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
                                        enemy.takeDamage(waveDamage);
                                        this.shieldWaveHitEnemies.add(enemy);
                                        
                                        // Create damage number for special ability
                                        if (typeof createDamageNumber !== 'undefined') {
                                            createDamageNumber(enemy.x, enemy.y, damageDealt, true);
                                        }
                                        
                                        // Apply knockback (wave pushes enemies forward)
                                        const knockbackForce = 500; // Increased from 300
                                        enemy.applyKnockback(playerDirX * knockbackForce, playerDirY * knockbackForce);
                                    }
                                }
                            }
                        }
                    });
                }
            }
        }
        
        // Update blink decoy animation
        if (this.blinkDecoyActive) {
            this.blinkDecoyElapsed += deltaTime;
            
            if (this.blinkDecoyElapsed >= this.blinkDecoyDuration) {
                this.blinkDecoyActive = false;
                this.blinkDecoyElapsed = 0;
            }
        }
        
        // Update blink explosion animation
        if (this.blinkExplosionActive) {
            this.blinkExplosionElapsed += deltaTime;
            
            if (this.blinkExplosionElapsed >= this.blinkExplosionDuration) {
                this.blinkExplosionActive = false;
                this.blinkExplosionElapsed = 0;
            }
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
    
    executeAttack(input) {
        if (this.playerClass === 'hexagon') {
            // Mage: Shoot projectile
            this.shootProjectile(input);
        } else if (this.playerClass === 'triangle') {
            // Rogue: Throw knife
            this.throwKnife(input);
        } else if (this.playerClass === 'pentagon') {
            // Tank: Hammer swing attack
            this.hammerSwingAttack();
        } else {
            // Square (Warrior): Standard melee
            this.meleeAttack();
        }
        
        // Reset cooldown and set attacking state
        this.attackCooldown = this.attackCooldownTime;
        this.isAttacking = true;
        
        // Clear attacking state after duration
        setTimeout(() => {
            this.isAttacking = false;
        }, this.attackDuration * 1000);
    }
    
    meleeAttack() {
        // Warrior: Sword swing with hitboxes spread out in a line
        const hitboxRadius = 20; // Smaller radius to avoid overlap
        const cleaveDamage = this.damage * 1.2; // 20% more damage
        
        // Create 4 hitboxes in a straight line in front of the player
        // Spacing them out evenly with minimal overlap
        const baseDistance = this.size + 10;
        const spacing = 45; // Larger spacing between hitbox centers to prevent overlap
        
        for (let i = 0; i < 4; i++) {
            const distance = baseDistance + (i * spacing);
            const hitboxX = this.x + Math.cos(this.rotation) * distance;
            const hitboxY = this.y + Math.sin(this.rotation) * distance;
        
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
    
    hammerSwingAttack() {
        // Tank: Hammer swing in 130-degree arc
        const hammerDamage = this.damage;
        const hammerDistance = 70; // Distance from player center to hammer
        const arcWidth = (130 * Math.PI) / 180; // 130 degrees in radians
        const arcHalf = arcWidth / 2; // 65 degrees on each side
        
        // Calculate starting angle based on swing direction
        // If swinging left (direction = -1), start from right side of arc, sweep to left
        // If swinging right (direction = 1), start from left side of arc, sweep to right
        let startAngle;
        if (this.hammerSwingDirection === -1) {
            // Swinging left: start from right side (rotation + arcHalf), sweep to left
            startAngle = this.rotation + arcHalf;
        } else {
            // Swinging right: start from left side (rotation - arcHalf), sweep to right
            startAngle = this.rotation - arcHalf;
        }
        
        // Create sweeping hammer hitbox
        this.attackHitboxes.push({
            type: 'hammer',
            x: this.x, // Updated during attack
            y: this.y, // Updated during attack
            radius: 35, // Hammer head hitbox size
            damage: hammerDamage,
            duration: this.attackDuration,
            elapsed: 0,
            hitEnemies: new Set(),
            
            // Hammer-specific properties
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
    
    throwKnife(input) {
        // Rogue: Throw knife as projectile
        if (typeof Game === 'undefined') return;
        
        // Get direction from unified input
        let dirX, dirY;
        if (input.getAbilityDirection) {
            const dir = input.getAbilityDirection('basicAttack');
            dirX = dir.x;
            dirY = dir.y;
        } else {
            // Fallback to mouse
            const mouseX = input.mouse.x || this.x;
            const mouseY = input.mouse.y || this.y;
            const dx = mouseX - this.x;
            const dy = mouseY - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance > 0) {
                dirX = dx / distance;
                dirY = dy / distance;
            } else {
                dirX = Math.cos(this.rotation);
                dirY = Math.sin(this.rotation);
            }
        }
        
        Game.projectiles.push({
            x: this.x,
            y: this.y,
            vx: dirX * 350,
            vy: dirY * 350,
            damage: this.damage,
            size: 8,
            lifetime: 1.5,
            elapsed: 0,
            type: 'knife',
            color: this.color,
            playerX: this.x, // Store player position for backstab detection
            playerY: this.y,
            playerClass: this.playerClass // Store class for backstab check
        });
    }
    
    shootProjectile(input) {
        // Mage: Shoot magic bolt
        if (typeof Game === 'undefined') return;
        
        // Get direction from unified input
        let dirX, dirY;
        if (input.getAbilityDirection) {
            const dir = input.getAbilityDirection('basicAttack');
            dirX = dir.x;
            dirY = dir.y;
        } else {
            // Fallback to mouse
            const mouseX = input.mouse.x || this.x;
            const mouseY = input.mouse.y || this.y;
            const dx = mouseX - this.x;
            const dy = mouseY - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance > 0) {
                dirX = dx / distance;
                dirY = dy / distance;
            } else {
                dirX = Math.cos(this.rotation);
                dirY = Math.sin(this.rotation);
            }
        }
        
        Game.projectiles.push({
            x: this.x,
            y: this.y,
            vx: dirX * 400,
            vy: dirY * 400,
            damage: this.damage,
            size: 10,
            lifetime: 2.0,
            elapsed: 0,
            type: 'magic',
            color: this.color
        });
    }
    
    updateAttackHitboxes(deltaTime) {
        // Update each hitbox and remove expired ones
        this.attackHitboxes = this.attackHitboxes.filter(hitbox => {
            hitbox.elapsed += deltaTime;
            
            // Handle hammer swing
            if (hitbox.type === 'hammer') {
                const progress = hitbox.elapsed / hitbox.duration; // 0 to 1
                
                // Calculate current angle - sweep through the arc
                // Swing direction determines which way we sweep
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
            
            // Handle expanding AoE
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
                        if (this.playerClass === 'triangle') {
                            // Triangle: cone preview
                            this.heavyAttackPreviewAngle = this.rotation;
                            this.heavyAttackPreviewActive = true;
                        } else if (this.playerClass === 'square') {
                            // Warrior: thrust preview
                            this.thrustPreviewActive = true;
                        }
                    }
                    
                    // Rotation is already updated by getAimDirection() which checks heavy attack joystick first
                    // Just update preview
                    if (this.isChargingHeavy && button.pressed) {
                        if (this.playerClass === 'triangle') {
                            // Update preview angle to match current rotation (which is set by getAimDirection)
                            this.heavyAttackPreviewAngle = this.rotation;
                            this.heavyAttackPreviewActive = true;
                        } else if (this.playerClass === 'square') {
                            // Warrior: show thrust preview
                            this.thrustPreviewActive = true;
                        }
                    } else if (this.isChargingHeavy && !button.pressed) {
                        // Button released, hide preview
                        if (this.playerClass === 'triangle') {
                            this.heavyAttackPreviewActive = false;
                        } else if (this.playerClass === 'square') {
                            this.thrustPreviewActive = false;
                        }
                    }
                }
                // Note: Fire on release is handled in the charge update loop below
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
    
    handleSpecialAbility(input) {
        // Check for special ability input (Spacebar or touch button)
        let specialJustPressed = false;
        let specialPressed = false;
        
        if (input.isTouchMode && input.isTouchMode()) {
            // Touch mode: check for special ability button
            if (input.touchButtons && input.touchButtons.specialAbility) {
                const button = input.touchButtons.specialAbility;
                specialPressed = button.pressed;
                
                // Different behavior based on ability type
                if (this.playerClass === 'pentagon') {
                    // Shield: press-and-hold (directional, continuous)
                    // Activate on press, deactivate on release
                    if (button.justPressed && this.specialCooldown <= 0 && !this.shieldActive && !this.whirlwindActive && !this.shadowClonesActive && !this.blinkDecoyActive) {
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
                } else if (this.playerClass === 'hexagon') {
                    // Blink: press-and-release (directional, one-time)
                    specialJustPressed = button.justReleased;
                    
                    // Show preview while holding
                    if (button.pressed && this.specialCooldown <= 0 && !this.shieldActive && !this.whirlwindActive && !this.shadowClonesActive && !this.blinkDecoyActive) {
                        this.updateBlinkPreview(input);
                    }
                    // Don't clear preview on release - it will be cleared in activateBlink after use
                } else {
                    // Whirlwind and Shadow Clones: press-and-release (non-directional)
                    specialJustPressed = button.justReleased;
                }
            }
        } else {
            // Keyboard/mouse mode: check for Spacebar
            const spaceJustPressed = input.getKeyState(' ') && !this.lastSpacebar;
            this.lastSpacebar = input.getKeyState(' ');
            specialJustPressed = spaceJustPressed;
            specialPressed = input.getKeyState(' ');
            
            // Handle shield (pentagon) - press and hold
            if (this.playerClass === 'pentagon') {
                if (spaceJustPressed && this.specialCooldown <= 0 && !this.shieldActive && !this.whirlwindActive && !this.shadowClonesActive && !this.blinkDecoyActive) {
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
            
            // Show preview for blink while spacebar held
            if (this.playerClass === 'hexagon' && specialPressed && this.specialCooldown <= 0 && !this.blinkDecoyActive) {
                this.updateBlinkPreview(input);
            } else if (!specialPressed && !specialJustPressed) {
                // Only clear preview if spacebar was released earlier (not on the frame it's released)
                this.blinkPreviewActive = false;
            }
        }
        
        // Check if cooldown ready and not already using another ability
        // Note: Shield (pentagon) is handled above on justPressed, not here
        if (specialJustPressed && this.specialCooldown <= 0 && !this.shieldActive && !this.whirlwindActive && !this.shadowClonesActive) {
            // For hexagon blink, update preview one last time before activating
            // This ensures we capture the final joystick state right before release
            if (this.playerClass === 'hexagon' && input.isTouchMode && input.isTouchMode()) {
                // Update preview to capture current joystick state
                this.updateBlinkPreview(input);
            }
            
            if (this.playerClass === 'square') {
                this.activateWhirlwind();
            } else if (this.playerClass === 'hexagon') {
                this.activateBlink(input);
            } else if (this.playerClass === 'triangle') {
                this.activateShadowClones();
            }
            // Pentagon shield is handled above on button press, not here
        }
    }
    
    // Update dash preview (shows where player will dash - triangle on mobile)
    updateDashPreview(input) {
        if (this.playerClass !== 'triangle') return;
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
            targetX = clamp(targetX, this.size, Game.canvas.width - this.size);
            targetY = clamp(targetY, this.size, Game.canvas.height - this.size);
        }
        
        this.dashPreviewX = targetX;
        this.dashPreviewY = targetY;
    }
    
    // Update heavy attack preview (shows fan of knives cone - triangle on mobile)
    updateHeavyAttackPreview(input) {
        if (this.playerClass !== 'triangle') return;
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
    
    // Update thrust preview (shows forward thrust destination - square/warrior on mobile)
    updateThrustPreview(input) {
        if (this.playerClass !== 'square') return;
        if (!input.isTouchMode || !input.isTouchMode()) return;
        
        this.thrustPreviewActive = true;
        
        // Calculate thrust destination based on current rotation
        const thrustDistance = 300; // Same as actual thrust
        const thrustDirX = Math.cos(this.rotation);
        const thrustDirY = Math.sin(this.rotation);
        
        let targetX = this.x + thrustDirX * thrustDistance;
        let targetY = this.y + thrustDirY * thrustDistance;
        
        // Clamp to bounds
        if (typeof Game !== 'undefined' && Game.canvas) {
            targetX = clamp(targetX, this.size, Game.canvas.width - this.size);
            targetY = clamp(targetY, this.size, Game.canvas.height - this.size);
        }
        
        // Calculate actual distance (may be less if clamped)
        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const actualDistance = Math.sqrt(dx * dx + dy * dy);
        
        this.thrustPreviewX = targetX;
        this.thrustPreviewY = targetY;
        this.thrustPreviewDistance = actualDistance;
    }
    
    // Update blink preview (shows where player will teleport)
    updateBlinkPreview(input) {
        if (this.playerClass !== 'hexagon') return;
        
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
            // Mouse mode: use mouse position
            const mouseX = input.mouse.x || this.x;
            const mouseY = input.mouse.y || this.y;
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
            targetX = clamp(targetX, this.size, Game.canvas.width - this.size);
            targetY = clamp(targetY, this.size, Game.canvas.height - this.size);
        }
        
        this.blinkPreviewX = targetX;
        this.blinkPreviewY = targetY;
        this.blinkPreviewDistance = distance;
    }
    
    activateWhirlwind() {
        this.whirlwindActive = true;
        this.whirlwindElapsed = 0;
        this.specialCooldown = this.specialCooldownTime;
        this.invulnerable = true;
        this.invulnerabilityTime = 0.3; // 0.3s startup i-frames
        console.log('Whirlwind activated!');
    }
    
    activateShield(input) {
        this.shieldActive = true;
        this.shieldElapsed = 0;
        this.specialCooldown = this.specialCooldownTime;
        this.invulnerable = true;
        this.invulnerabilityTime = 0.2; // 0.2s windup i-frames
        
        // Rotation is already updated by getAimDirection() which checks special ability joystick
        // Shield always faces forward (front of character) - just use this.rotation
        // Store initial shield direction for wave
        this.shieldDirection = this.rotation;
        
        console.log('Shield activated!');
    }
    
    activateBlink(input) {
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
                const mouseX = input.mouse.x || this.x;
                const mouseY = input.mouse.y || this.y;
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
        if (distance > 400) {
            // Clamp to max range
            const angle = Math.atan2(dy, dx);
            newX = this.x + Math.cos(angle) * 400;
            newY = this.y + Math.sin(angle) * 400;
        } else {
            newX = targetX;
            newY = targetY;
        }
        
        // Calculate knockback direction (away from destination if enemies are there)
        let knockbackAngle = this.rotation; // Default to facing direction
        if (typeof Game !== 'undefined' && Game.enemies) {
            let closestEnemy = null;
            let closestDistance = Infinity;
            
            Game.enemies.forEach(enemy => {
                if (enemy.alive) {
                    const dx = enemy.x - newX;
                    const dy = enemy.y - newY;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < closestDistance) {
                        closestDistance = dist;
                        closestEnemy = enemy;
                    }
                }
            });
            
            if (closestEnemy) {
                // Knockback away from closest enemy
                const dx = newX - closestEnemy.x;
                const dy = newY - closestEnemy.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > 0) {
                    knockbackAngle = Math.atan2(dy, dx); // Fixed: should be dx, not dist
                }
            }
        }
        
        // Apply knockback velocity
        const knockbackSpeed = 150;
        this.blinkKnockbackVx = Math.cos(knockbackAngle) * knockbackSpeed;
        this.blinkKnockbackVy = Math.sin(knockbackAngle) * knockbackSpeed;
        
        // Teleport player (ensure valid position)
        // Clamp to bounds immediately to prevent out-of-bounds issues
        if (typeof Game !== 'undefined' && Game.canvas) {
            this.x = clamp(newX, this.size, Game.canvas.width - this.size);
            this.y = clamp(newY, this.size, Game.canvas.height - this.size);
        } else {
            this.x = newX;
            this.y = newY;
        }
        
        // Create decoy at old position
        this.blinkDecoyActive = true;
        this.blinkDecoyElapsed = 0;
        this.blinkDecoyX = oldX;
        this.blinkDecoyY = oldY;
        
        // Create explosion at new position
        this.blinkExplosionActive = true;
        this.blinkExplosionElapsed = 0;
        this.blinkExplosionX = newX;
        this.blinkExplosionY = newY;
        
        // Deal damage at destination
        if (typeof Game !== 'undefined' && Game.enemies) {
            const explosionRadius = 80;
            const explosionDamage = this.damage * 2.5;
            
            Game.enemies.forEach(enemy => {
                if (enemy.alive) {
                    const dx = enemy.x - this.x;
                    const dy = enemy.y - this.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance < explosionRadius) {
                        const damageDealt = Math.min(explosionDamage, enemy.hp);
                        enemy.takeDamage(explosionDamage);
                        
                        // Create damage number for special ability
                        if (typeof createDamageNumber !== 'undefined') {
                            createDamageNumber(enemy.x, enemy.y, damageDealt, true);
                        }
                        
                        // Push enemies back from explosion
                        const pushForce = 200;
                        const pushDirX = (enemy.x - this.x) / distance;
                        const pushDirY = (enemy.y - this.y) / distance;
                        enemy.applyKnockback(pushDirX * pushForce, pushDirY * pushForce);
                    }
                }
            });
        }
        
        this.specialCooldown = this.specialCooldownTime;
        this.invulnerable = true;
        this.invulnerabilityTime = 1.2; // 1.2s post-teleport i-frames for safer dashing through enemies
        console.log('Blink activated!');
    }
    
    activateShadowClones() {
        this.shadowClonesActive = true;
        this.shadowClonesElapsed = 0;
        this.specialCooldown = this.specialCooldownTime;
        
        // Create 2 shadow clones positioned around the player
        this.shadowClones = [];
        for (let i = 0; i < 2; i++) {
            // Position clones at angles offset from player
            const angle = this.rotation + (i * 2 - 1) * Math.PI / 3; // -60° and +60° from facing direction
            const distance = 100; // Distance from player
            const cloneX = this.x + Math.cos(angle) * distance;
            const cloneY = this.y + Math.sin(angle) * distance;
            
            // Keep clones in bounds
            const clone = {
                x: Game ? clamp(cloneX, this.size, Game.canvas.width - this.size) : cloneX,
                y: Game ? clamp(cloneY, this.size, Game.canvas.height - this.size) : cloneY,
                rotation: this.rotation
            };
            this.shadowClones.push(clone);
        }
        
        this.invulnerable = true;
        this.invulnerabilityTime = 0.3; // Brief i-frames on activation
        console.log('Shadow clones activated!');
    }
    
    startHeavyAttack() {
        // Start charging
        this.isChargingHeavy = true;
        this.heavyChargeElapsed = 0;
        this.heavyAttackCooldown = this.heavyAttackCooldownTime;
    }
    
    createHeavyAttack() {
        if (this.playerClass === 'triangle') {
            // Rogue: Fan of knives - throw knives in multiple directions
            this.createFanOfKnives();
        } else if (this.playerClass === 'pentagon') {
            // Tank: Ground smash - AoE that pushes enemies back
            this.createGroundSmash();
        } else if (this.playerClass === 'hexagon') {
            // Mage: AoE blast - expanding circle with range limit
            this.createAoEBlast();
        } else {
            // Square (Warrior): Forward thrust - rush forward with damage
            this.createForwardThrust();
        }
        
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
    }
    
    createFanOfKnives() {
        // Rogue: Fan of knives - throw 7 knives in a spread pattern
        const knifeDamage = this.damage * 2;
        const numKnives = 7;
        const spreadAngle = Math.PI / 3; // 60 degrees spread
        const knifeSpeed = 400;
        
        if (typeof Game !== 'undefined') {
            for (let i = 0; i < numKnives; i++) {
                // Calculate angle for this knife
                const angle = this.rotation + (i / (numKnives - 1) - 0.5) * spreadAngle;
                const dirX = Math.cos(angle);
                const dirY = Math.sin(angle);
                
                // Create knife projectile
                Game.projectiles.push({
                    x: this.x,
                    y: this.y,
                    vx: dirX * knifeSpeed,
                    vy: dirY * knifeSpeed,
                    damage: knifeDamage,
                    size: 10,
                    lifetime: 1.5,
                    elapsed: 0,
                    type: 'knife',
                    color: this.color
                });
            }
        }
    }
    
    createForwardThrust() {
        // Warrior forward thrust - rush forward while dealing damage along the path
        const thrustDistance = 300; // How far forward to rush (doubled for more range)
        const thrustDirX = Math.cos(this.rotation);
        const thrustDirY = Math.sin(this.rotation);
        
        // Clear preview when thrust starts
        this.thrustPreviewActive = false;
        
        // Save start position
        this.thrustStartX = this.x;
        this.thrustStartY = this.y;
        
        // Calculate target position
        const targetX = this.x + thrustDirX * thrustDistance;
        const targetY = this.y + thrustDirY * thrustDistance;
        
        // Keep target in bounds
        if (typeof Game !== 'undefined' && Game.canvas) {
            this.thrustTargetX = clamp(targetX, this.size, Game.canvas.width - this.size);
            this.thrustTargetY = clamp(targetY, this.size, Game.canvas.height - this.size);
        } else {
            this.thrustTargetX = targetX;
            this.thrustTargetY = targetY;
        }
        
        // Start thrust animation
        this.thrustActive = true;
        this.thrustElapsed = 0;
    }
    
    createGroundSmash() {
        // Tank ground smash - AoE around player that pushes enemies back
        const smashDamage = this.damage * 1.1; // Lower damage, focus on CC/knockback
        const smashRadius = 120;
        
        // Create hitboxes in a ring around the player
        const numHitboxes = 8;
        for (let i = 0; i < numHitboxes; i++) {
            const angle = (Math.PI * 2 / numHitboxes) * i;
            const distance = this.size + 40;
            
            const hitboxX = this.x + Math.cos(angle) * distance;
            const hitboxY = this.y + Math.sin(angle) * distance;
        
        this.attackHitboxes.push({
            x: hitboxX,
            y: hitboxY,
                radius: 25,
                damage: smashDamage,
            duration: this.attackDuration,
            elapsed: 0,
                heavy: true,
                hitEnemies: new Set()
            });
        }
        
        // Push enemies away from player
        if (typeof Game !== 'undefined' && Game.enemies) {
            Game.enemies.forEach(enemy => {
                if (enemy.alive) {
                    const dx = enemy.x - this.x;
                    const dy = enemy.y - this.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance < smashRadius) {
                        // Push away from player with increased force for more meaningful knockback
                        const pushForce = 375; // Increased from 250 to 375 (50% increase)
                        const pushDirX = dx / distance;
                        const pushDirY = dy / distance;
                        enemy.applyKnockback(pushDirX * pushForce, pushDirY * pushForce);
                    }
                }
            });
        }
    }
    
    createAoEBlast() {
        // Mage AoE blast - single expanding circle
        const blastDamage = this.damage * 1.5; // 1.5x damage (balanced)
        const blastMaxRadius = 125; // Increased from 100 to 125 (25% increase)
        const blastDuration = 0.4; // slower than normal attack
        
        // Create single expanding circle
        this.attackHitboxes.push({
            x: this.x,
            y: this.y,
            radius: blastMaxRadius,
            damage: blastDamage,
            duration: blastDuration,
            elapsed: 0,
            heavy: true,
            expanding: true, // Mark as expanding AoE
            startRadius: 0,
            endRadius: blastMaxRadius,
            hitEnemies: new Set()
        });
        
        // Knockback enemies in range
        if (typeof Game !== 'undefined' && Game.enemies) {
            Game.enemies.forEach(enemy => {
                if (enemy.alive) {
                    const dx = enemy.x - this.x;
                    const dy = enemy.y - this.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance < blastMaxRadius) {
                        // Push away from blast center
                        const pushForce = 252; // Increased from 180 to 252 (40% increase)
                        const pushDirX = dx / distance;
                        const pushDirY = dy / distance;
                        enemy.applyKnockback(pushDirX * pushForce, pushDirY * pushForce);
                    }
                }
            });
        }
    }
    
    render(ctx) {
        // Draw attack hitboxes first (behind player)
        this.attackHitboxes.forEach(hitbox => {
            // Check if this hitbox has successfully hit enemies
            const hasHitEnemies = hitbox.hitEnemies && hitbox.hitEnemies.size > 0;
            
            if (hitbox.type === 'hammer') {
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
            } else if (hitbox.heavy) {
                // Heavy attack - orange/red color, green if it hit
                ctx.fillStyle = hasHitEnemies ? 'rgba(100, 255, 100, 0.4)' : 'rgba(255, 100, 0, 0.4)';
                ctx.beginPath();
                ctx.arc(hitbox.x, hitbox.y, hitbox.radius, 0, Math.PI * 2);
                ctx.fill();
                
                // Draw outline
                ctx.strokeStyle = hasHitEnemies ? 'rgba(0, 255, 0, 0.9)' : 'rgba(255, 50, 0, 0.9)';
                ctx.lineWidth = 3;
                ctx.stroke();
            } else {
                // Basic attack - white color, green if it hit
                ctx.fillStyle = hasHitEnemies ? 'rgba(100, 255, 100, 0.4)' : 'rgba(255, 255, 255, 0.3)';
                ctx.beginPath();
                ctx.arc(hitbox.x, hitbox.y, hitbox.radius, 0, Math.PI * 2);
                ctx.fill();
                
                // Draw outline
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
        
        // Draw armor bonus visual (thicker outline)
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
            // Draw triangle with tip pointing right (forward direction)
            ctx.beginPath();
            ctx.moveTo(this.size, 0);  // Tip pointing right
            ctx.lineTo(-this.size * 0.5, -this.size * 0.866);  // Top back
            ctx.lineTo(-this.size * 0.5, this.size * 0.866);  // Bottom back
            ctx.closePath();
            ctx.fill();
        } else if (shape === 'hexagon') {
            // Draw hexagon
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
            // Draw pentagon - rotated clockwise by 18° so a vertex points forward (0°)
            // Vertex index 1 (originally at -18°) becomes 0° when rotated +18°
            // This means a vertex (not a flat edge) points forward - the base is rotated
            const rotationOffset = 18 * Math.PI / 180; // 18 degrees clockwise
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
        
        // Draw a small indicator showing facing direction
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        
        // For pentagon, align indicator with the front vertex (now at 0° after rotation)
        if (shape === 'pentagon') {
            // After rotating the pentagon by +18°, vertex index 1 is at 0° (forward/right)
            // Calculate the angle for vertex index 1: (2π/5) * 1 - π/2 + 18° = 0°
            const rotationOffset = 18 * Math.PI / 180; // Same rotation as pentagon
            const vertexIndex = 1; // The vertex that points forward after rotation
            const vertexAngle = (Math.PI * 2 / 5) * vertexIndex - Math.PI / 2 + rotationOffset;
            
            // Position indicator on the vertex, inside the shape at the tip
            const indicatorDistance = this.size * 0.7; // Inside the shape, at 70% of size
            const indicatorX = Math.cos(vertexAngle) * indicatorDistance;
            const indicatorY = Math.sin(vertexAngle) * indicatorDistance;
            ctx.arc(indicatorX, indicatorY, 5, 0, Math.PI * 2);
        } else {
            // For other shapes, use standard front position
            ctx.arc(this.size - 10, 0, 5, 0, Math.PI * 2);
        }
        
        ctx.fill();
        
        ctx.restore();
        
        // Restore global alpha from dodge transparency
        ctx.restore();
        
        // Draw block stance visual (Warrior passive) - light bubble when active
        // Draw after player shape so it's visible on top
        if (this.blockStanceActive && this.playerClass === 'square') {
            // Calculate activation progress for smooth appearance
            const activationProgress = Math.min(1.0, this.blockStanceTimer / this.blockStanceActivationTime);
            
            // Outer glow - pulsing light blue/white bubble
            const pulseTime = Date.now() * 0.005;
            const pulseAlpha = 0.3 + Math.sin(pulseTime) * 0.2;
            const bubbleRadius = this.size + 15 + Math.sin(pulseTime * 2) * 2;
            
            // Draw outer glow with gradient
            const gradient = ctx.createRadialGradient(
                this.x, this.y, this.size,
                this.x, this.y, bubbleRadius
            );
            gradient.addColorStop(0, `rgba(100, 150, 255, ${pulseAlpha * activationProgress})`);
            gradient.addColorStop(0.5, `rgba(150, 200, 255, ${pulseAlpha * 0.6 * activationProgress})`);
            gradient.addColorStop(1, `rgba(200, 250, 255, 0)`);
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(this.x, this.y, bubbleRadius, 0, Math.PI * 2);
            ctx.fill();
            
            // Draw border ring
            ctx.strokeStyle = `rgba(150, 200, 255, ${0.7 * activationProgress})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(this.x, this.y, bubbleRadius, 0, Math.PI * 2);
            ctx.stroke();
        }
        
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
        
        // Draw whirlwind visual - spinning blades that rotate around the player
        if (this.whirlwindActive) {
            ctx.save();
            ctx.translate(this.x, this.y);
            
            // Continuously rotating angle based on elapsed time
            const spinSpeed = 10; // Full rotation per second
            const spinAngle = this.whirlwindElapsed * Math.PI * 2 * spinSpeed;
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
        
        // Draw shield visual - wide thin shield in front of player
        if (this.shieldActive) {
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(this.rotation);
            
            // Draw wide thin shield (thin in depth, wide laterally)
            ctx.fillStyle = 'rgba(150, 200, 255, 0.3)';
            ctx.beginPath();
            ctx.rect(this.size + 5, -60, 20, 120);
            ctx.fill();
            
            ctx.strokeStyle = 'rgba(150, 200, 255, 0.8)';
            ctx.lineWidth = 4;
            ctx.strokeRect(this.size + 5, -60, 20, 120);
            
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
                const segmentStart = i * segmentLength;
                const segmentEnd = (i + 1) * segmentLength;
                
                // Only draw segments that are part of the current wave
                if (segmentEnd <= currentWaveDistance) {
                    ctx.fillStyle = 'rgba(150, 200, 255, 0.5)';
                    ctx.fillRect(this.size + 10 + segmentStart, -waveWidth / 2, segmentLength, waveWidth);
                    
                    ctx.strokeStyle = 'rgba(150, 200, 255, 0.9)';
                    ctx.lineWidth = 3;
                    ctx.strokeRect(this.size + 10 + segmentStart, -waveWidth / 2, segmentLength, waveWidth);
                }
            }
            
            ctx.restore();
        }
        
        // Draw blink decoy - semi-transparent clone at old position
        if (this.blinkDecoyActive) {
            const decoyAlpha = 0.5 * (1 - (this.blinkDecoyElapsed / this.blinkDecoyDuration)); // Fade out over time
            const decoySize = this.size * (1 + (this.blinkDecoyElapsed / this.blinkDecoyDuration) * 0.3); // Slightly grow over time
            
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
        }
        
        // Draw dash preview - shows dash destination while aiming (triangle on mobile)
        if (this.dashPreviewActive && this.playerClass === 'triangle') {
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
        
        // Draw heavy attack preview - shows fan of knives cone (triangle on mobile)
        if (this.heavyAttackPreviewActive && this.playerClass === 'triangle') {
            ctx.save();
            ctx.translate(this.x, this.y);
            
            const previewRange = 250; // How far the preview extends
            const numKnives = 7; // Same as actual fan of knives
            const spreadAngle = this.heavyAttackPreviewSpread; // 60 degrees
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
        
        // Draw thrust preview - shows forward thrust destination (square/warrior on mobile)
        if (this.thrustPreviewActive && this.playerClass === 'square') {
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
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(`${Math.round(this.thrustPreviewDistance)}px`, this.thrustPreviewX, this.thrustPreviewY + indicatorRadius + 8);
            
            ctx.restore();
        }
        
        // Draw blink preview - shows teleport destination while aiming
        if (this.blinkPreviewActive && this.playerClass === 'hexagon') {
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
        
        // Draw blink explosion - expanding circles at destination
        if (this.blinkExplosionActive) {
            const explosionProgress = this.blinkExplosionElapsed / this.blinkExplosionDuration;
            const maxRadius = 80;
            
            ctx.save();
            
            // Draw multiple expanding rings
            for (let i = 0; i < 3; i++) {
                const ringOffset = i * 0.33;
                const ringProgress = Math.max(0, Math.min(1, explosionProgress + ringOffset));
                const radius = maxRadius * ringProgress;
                const alpha = 0.6 * (1 - ringProgress);
                
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
        
        // Draw heavy charge effect
        if (this.heavyChargeEffectActive) {
            const chargeProgress = this.heavyChargeEffectElapsed / this.heavyChargeEffectDuration;
            const pulseSize = 1.0 + Math.sin(chargeProgress * Math.PI * 4) * 0.1;
            
            ctx.save();
            ctx.globalAlpha = 0.6;
            
            // Class-specific charge effects
            if (this.playerClass === 'triangle') {
                // Rogue: Pink/purple pulsing effect
                ctx.strokeStyle = '#ff1493';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size * pulseSize, 0, Math.PI * 2);
                ctx.stroke();
            } else if (this.playerClass === 'pentagon') {
                // Tank: Circular ground smash indicator
                const smashRadius = 120;
                ctx.strokeStyle = '#ff6666';
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.arc(this.x, this.y, smashRadius * pulseSize, 0, Math.PI * 2);
                ctx.stroke();
            } else if (this.playerClass === 'hexagon') {
                // Mage: Magical build-up circles
                ctx.strokeStyle = '#673ab7';
                ctx.lineWidth = 3;
                for (let i = 0; i < 3; i++) {
                    const offset = i * 15;
                    ctx.beginPath();
                    ctx.arc(this.x, this.y, (this.size + offset) * pulseSize, 0, Math.PI * 2);
                    ctx.stroke();
                }
            } else if (this.playerClass === 'square') {
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
            } else {
                // Default: Yellow pulsing circle
                ctx.strokeStyle = '#ffff00';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size * pulseSize, 0, Math.PI * 2);
                ctx.stroke();
            }
            
            ctx.restore();
        }
        
        // Draw ground smash shockwave effect (only during heavy attacks)
        const hasHeavyHitbox = this.attackHitboxes.some(hb => hb.heavy);
        if (this.isAttacking && hasHeavyHitbox && this.playerClass === 'pentagon' && !this.heavyChargeEffectActive) {
            ctx.save();
            ctx.globalAlpha = 0.4;
            
            // Draw expanding shockwave
            ctx.strokeStyle = '#ff8844';
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.arc(this.x, this.y, 120, 0, Math.PI * 2);
            ctx.stroke();
            
            ctx.restore();
        }
        
        // Draw AoE blast expanding effect (only during heavy attacks)
        if (this.isAttacking && hasHeavyHitbox && this.playerClass === 'hexagon' && !this.heavyChargeEffectActive) {
            ctx.save();
            ctx.globalAlpha = 0.5;
            
            // Draw expanding magical circles (125 radius max)
            for (let i = 0; i < 3; i++) {
                const radius = 125 * ((i + 1) / 3);
                ctx.strokeStyle = 'rgba(156, 39, 176, 0.6)';
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.arc(this.x, this.y, radius, 0, Math.PI * 2);
                ctx.stroke();
            }
            
            ctx.restore();
        }
        
        // Draw shadow clones
        if (this.shadowClonesActive && this.shadowClones && this.shadowClones.length > 0) {
            const fadeProgress = this.shadowClonesElapsed / this.shadowClonesDuration;
            const alpha = 0.6 * (1 - fadeProgress); // Fade out over duration
            
            this.shadowClones.forEach(clone => {
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
            });
        }
    }
    
    takeDamage(damage) {
        if (this.invulnerable || this.dead) return;
        
        // Apply block stance (Warrior passive: 50% damage reduction when standing still and active)
        if (this.playerClass === 'square' && this.blockStanceActive) {
            damage = damage * 0.5; // 50% damage reduction
        }
        
        // Apply shield damage reduction if active
        if (this.shieldActive) {
            damage = damage * 0.5; // 50% damage reduction
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
            
            // Record end time for death screen and calculate currency
            if (typeof Game !== 'undefined') {
                Game.endTime = Date.now();
                // Calculate currency earned from this run
                Game.currencyEarned = Game.calculateCurrency();
            }
            
            console.log('Player died!');
        } else {
            console.log(`Player took ${damage} damage! HP: ${this.hp}/${this.maxHp}`);
        }
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
}

