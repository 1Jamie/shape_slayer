// Rogue class (Triangle) - extends PlayerBase

class Rogue extends PlayerBase {
    constructor(x = 400, y = 300) {
        super(x, y);
        
        // Set class identifier
        this.playerClass = 'triangle';
        
        // Load class definition
        const classDef = CLASS_DEFINITIONS.triangle;
        
        // Load upgrades from save system
        let upgradeBonuses = { damage: 0, defense: 0, speed: 0 };
        if (typeof SaveSystem !== 'undefined') {
            const upgrades = SaveSystem.getUpgrades('triangle');
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
        
        // Triangle uses 3 dodge charges
        this.dodgeCharges = classDef.dodgeCharges || 3;
        this.maxDodgeCharges = classDef.dodgeCharges || 3;
        this.dodgeChargeCooldowns = new Array(this.maxDodgeCharges).fill(0);
        this.dodgeCooldownTime = classDef.dodgeCooldown || 1.0;
        this.dodgeSpeedBoost = classDef.dodgeSpeed || 720;
        
        // Heavy attack cooldown
        this.heavyAttackCooldownTime = 2.0;
        
        // Shadow clones special ability
        this.shadowClonesActive = false;
        this.shadowClonesElapsed = 0;
        this.shadowClonesDuration = 3.0;
        this.shadowClones = []; // Array of {x, y, rotation} for each clone
        
        // Dash preview system (mobile)
        this.dashPreviewActive = false;
        this.dashPreviewX = 0;
        this.dashPreviewY = 0;
        this.dashPreviewDistance = 0;
        
        // Heavy attack preview system (mobile)
        this.heavyAttackPreviewActive = false;
        this.heavyAttackPreviewAngle = 0;
        this.heavyAttackPreviewSpread = Math.PI / 3; // 60 degree spread
        
        // Update effective stats
        this.updateEffectiveStats();
        
        console.log('Rogue class initialized');
    }
    
    // Override executeAttack for Rogue throw knife
    executeAttack(input) {
        this.throwKnife(input);
        
        // Reset cooldown and set attacking state
        this.attackCooldown = this.attackCooldownTime;
        this.isAttacking = true;
        
        // Clear attacking state after duration
        setTimeout(() => {
            this.isAttacking = false;
        }, this.attackDuration * 1000);
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
    
    // Override startDodge for Rogue facing-direction-only dodge
    startDodge(input) {
        // Rogue: Always dash in facing direction (not movement direction)
        const dodgeDirX = Math.cos(this.rotation) * this.dodgeSpeedBoost;
        const dodgeDirY = Math.sin(this.rotation) * this.dodgeSpeedBoost;
        
        // Store dodge velocity
        this.dodgeVx = dodgeDirX;
        this.dodgeVy = dodgeDirY;
        
        // Set dodge state
        this.isDodging = true;
        this.invulnerable = true;
        this.dodgeElapsed = 0;
        this.dodgeHitEnemies.clear(); // Reset hit tracking for new dodge
        
        // Find first available charge and put it on cooldown
        for (let i = 0; i < this.dodgeChargeCooldowns.length; i++) {
            if (this.dodgeChargeCooldowns[i] <= 0) {
                this.dodgeChargeCooldowns[i] = this.dodgeCooldownTime;
                break;
            }
        }
    }
    
    // Override updateClassAbilities for Rogue-specific updates
    updateClassAbilities(deltaTime, input) {
        // Update shadow clones animation
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
        
        // Update dodge charge cooldowns (Rogue has 3 charges)
        this.dodgeChargeCooldowns = this.dodgeChargeCooldowns.map(cooldown => {
            if (cooldown > 0) {
                return cooldown - deltaTime;
            }
            return cooldown;
        });
        
        // Rogue dodge collision damage (Triangle-specific: deals damage during dodge)
        if (this.isDodging && typeof Game !== 'undefined') {
            const dodgeDamage = this.damage * 0.575; // 57.5% of base damage
            
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
            targetX = clamp(targetX, this.size, Game.canvas.width - this.size);
            targetY = clamp(targetY, this.size, Game.canvas.height - this.size);
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
}

