// Mage class (Hexagon) - extends PlayerBase

class Mage extends PlayerBase {
    constructor(x = 400, y = 300) {
        super(x, y);
        
        // Set class identifier
        this.playerClass = 'hexagon';
        
        // Load class definition
        const classDef = CLASS_DEFINITIONS.hexagon;
        
        // Load upgrades from save system
        let upgradeBonuses = { damage: 0, defense: 0, speed: 0 };
        if (typeof SaveSystem !== 'undefined') {
            const upgrades = SaveSystem.getUpgrades('hexagon');
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
        
        // Standard single dodge for Mage
        this.dodgeCharges = 1;
        this.maxDodgeCharges = 1;
        this.dodgeChargeCooldowns = [0];
        
        // Heavy attack cooldown
        this.heavyAttackCooldownTime = 2.3;
        
        // Blink special ability - decoy system
        this.blinkDecoyActive = false;
        this.blinkDecoyElapsed = 0;
        this.blinkDecoyDuration = 2.0;
        this.blinkDecoyX = 0;
        this.blinkDecoyY = 0;
        
        // Blink explosion at destination
        this.blinkExplosionActive = false;
        this.blinkExplosionElapsed = 0;
        this.blinkExplosionDuration = 0.3;
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
        
        // Update effective stats
        this.updateEffectiveStats();
        
        console.log('Mage class initialized');
    }
    
    // Override executeAttack for Mage projectile
    executeAttack(input) {
        this.shootProjectile(input);
        
        // Reset cooldown and set attacking state
        this.attackCooldown = this.attackCooldownTime;
        this.isAttacking = true;
        
        // Clear attacking state after duration
        setTimeout(() => {
            this.isAttacking = false;
        }, this.attackDuration * 1000);
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
    
    // Override createHeavyAttack for AoE blast
    createHeavyAttack() {
        this.createAoEBlast();
        
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
        
        // Clamp to bounds
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
                        
                        if (typeof createDamageNumber !== 'undefined') {
                            createDamageNumber(enemy.x, enemy.y, damageDealt, true);
                        }
                        
                        // Push enemies away from explosion
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
    
    // Override updateClassAbilities for Mage-specific updates
    updateClassAbilities(deltaTime, input) {
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
    }
    
    // Override renderClassVisuals for Mage-specific visuals
    renderClassVisuals(ctx) {
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
        
        // Draw AoE blast expanding effect (only during heavy attacks)
        const hasHeavyHitbox = this.attackHitboxes.some(h => h.heavy);
        if (this.isAttacking && hasHeavyHitbox && !this.heavyChargeEffectActive) {
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
    }
}

