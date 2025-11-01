// Warrior class (Square) - extends PlayerBase

class Warrior extends PlayerBase {
    constructor(x = 400, y = 300) {
        super(x, y);
        
        // Set class identifier
        this.playerClass = 'square';
        
        // Load class definition
        const classDef = CLASS_DEFINITIONS.square;
        
        // Load upgrades from save system
        let upgradeBonuses = { damage: 0, defense: 0, speed: 0 };
        if (typeof SaveSystem !== 'undefined') {
            const upgrades = SaveSystem.getUpgrades('square');
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
        
        // Standard single charge dodge for Warrior
        this.dodgeCharges = 1;
        this.maxDodgeCharges = 1;
        this.dodgeChargeCooldowns = [0];
        
        // Heavy attack cooldown
        this.heavyAttackCooldownTime = 2.5; // Warrior - forward thrust has longer cooldown
        
        // Block stance passive
        this.blockStanceActive = false;
        this.blockStanceTimer = 0;
        this.blockStanceActivationTime = 0.25; // Must stand still for 0.25 seconds to activate
        
        // Whirlwind special ability
        this.whirlwindActive = false;
        this.whirlwindElapsed = 0;
        this.whirlwindStartTime = 0; // Timestamp for smooth visual rotation
        this.whirlwindDuration = 2.0;
        this.whirlwindHitTimer = 0;
        
        // Forward thrust heavy attack
        this.thrustActive = false;
        this.thrustElapsed = 0;
        this.thrustDuration = 0.12; // How long the rush takes (faster)
        this.thrustStartX = 0;
        this.thrustStartY = 0;
        this.thrustTargetX = 0;
        this.thrustTargetY = 0;
        
        // Forward thrust preview (for mobile)
        this.thrustPreviewActive = false;
        this.thrustPreviewX = 0;
        this.thrustPreviewY = 0;
        this.thrustPreviewDistance = 0;
        
        // Update effective stats
        this.updateEffectiveStats();
        
        console.log('Warrior class initialized');
    }
    
    // Override to check for thrust movement
    isInSpecialMovement() {
        return this.thrustActive;
    }
    
    // Override to update class-specific abilities
    updateClassAbilities(deltaTime, input) {
        // Update block stance timer (Warrior passive)
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
        
        // Update thrust preview if active (warrior on mobile)
        if (this.thrustPreviewActive) {
            this.updateThrustPreview(input);
        }
    }
    
    // Override executeAttack for Warrior melee cleave
    executeAttack(input) {
        this.meleeAttack();
        
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
    
    // Override createHeavyAttack for forward thrust
    createHeavyAttack() {
        this.createForwardThrust();
        
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
    
    createForwardThrust() {
        // Warrior forward thrust - rush forward while dealing damage along the path
        const thrustDistance = 300; // How far forward to rush
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
    
    // Override activateSpecialAbility for whirlwind
    activateSpecialAbility(input) {
        this.activateWhirlwind();
    }
    
    activateWhirlwind() {
        this.whirlwindActive = true;
        this.whirlwindElapsed = 0;
        this.whirlwindStartTime = Date.now(); // Track start time for smooth visual rotation
        this.specialCooldown = this.specialCooldownTime;
        this.invulnerable = true;
        this.invulnerabilityTime = 0.3; // 0.3s startup i-frames
        console.log('Whirlwind activated!');
    }
    
    // Override getDamageReduction for block stance
    getDamageReduction() {
        // Block stance (Warrior passive: 50% damage reduction when standing still and active)
        if (this.blockStanceActive) {
            return 0.5; // 50% damage reduction
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
            ctx.font = 'bold 12px Arial';
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
}

