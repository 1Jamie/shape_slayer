// Tank class (Pentagon) - extends PlayerBase

class Tank extends PlayerBase {
    constructor(x = 400, y = 300) {
        super(x, y);
        
        // Set class identifier
        this.playerClass = 'pentagon';
        
        // Load class definition
        const classDef = CLASS_DEFINITIONS.pentagon;
        
        // Load upgrades from save system
        let upgradeBonuses = { damage: 0, defense: 0, speed: 0 };
        if (typeof SaveSystem !== 'undefined') {
            const upgrades = SaveSystem.getUpgrades('pentagon');
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
        
        // Standard single dodge for Tank
        this.dodgeCharges = 1;
        this.maxDodgeCharges = 1;
        this.dodgeChargeCooldowns = [0];
        
        // Heavy attack cooldown
        this.heavyAttackCooldownTime = 2.5; // Tank - ground smash has longer cooldown
        
        // Shield special ability
        this.shieldActive = false;
        this.shieldElapsed = 0;
        this.shieldDuration = 2.1; // Increased from 1.5 (90% longer)
        this.shieldWaveActive = false;
        this.shieldWaveElapsed = 0;
        this.shieldWaveDuration = 0.5;
        this.shieldDirection = 0; // Store shield direction for wave
        this.shieldWaveHitEnemies = null; // Set of enemies hit by wave
        
        // Hammer swing attack
        this.hammerSwingDirection = 1; // Alternates between 1 (right) and -1 (left)
        
        // Update effective stats
        this.updateEffectiveStats();
        
        console.log('Tank class initialized');
    }
    
    // Override executeAttack for Tank hammer swing
    executeAttack(input) {
        this.hammerSwingAttack();
        
        // Reset cooldown and set attacking state
        this.attackCooldown = this.attackCooldownTime;
        this.isAttacking = true;
        
        // Clear attacking state after duration
        setTimeout(() => {
            this.isAttacking = false;
        }, this.attackDuration * 1000);
    }
    
    hammerSwingAttack() {
        // Tank: Hammer swing in 130-degree arc
        const hammerDamage = this.damage;
        const hammerDistance = 70; // Distance from player center to hammer
        const arcWidth = (130 * Math.PI) / 180; // 130 degrees in radians
        const arcHalf = arcWidth / 2; // 65 degrees on each side
        
        // Calculate start angle based on swing direction
        // For right swing (1): start at -65° and sweep to +65°
        // For left swing (-1): start at +65° and sweep to -65°
        const startAngle = this.rotation + (this.hammerSwingDirection * -arcHalf);
        
        // Initial hammer position
        const hammerX = this.x + Math.cos(startAngle) * hammerDistance;
        const hammerY = this.y + Math.sin(startAngle) * hammerDistance;
        
        this.attackHitboxes.push({
            x: hammerX,
            y: hammerY,
            radius: 30,
            damage: hammerDamage,
            duration: 0.3, // Slower swing for visualization
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
    
    // Override createHeavyAttack for ground smash
    createHeavyAttack() {
        this.createGroundSmash();
        
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
        this.shieldActive = true;
        this.shieldElapsed = 0;
        this.specialCooldown = this.specialCooldownTime;
        this.invulnerable = true;
        this.invulnerabilityTime = 0.2; // 0.2s windup i-frames
        this.shieldDirection = this.rotation; // Store initial direction
        console.log('Shield activated!');
    }
    
    // Override getDamageReduction for shield
    getDamageReduction() {
        // Shield (Tank passive: 50% damage reduction when shield is active)
        if (this.shieldActive) {
            return 0.5; // 50% damage reduction
        }
        return 0;
    }
    
    // Override updateClassAbilities for Tank-specific updates
    updateClassAbilities(deltaTime, input) {
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
    }
    
    // Override renderClassVisuals for Tank-specific visuals
    renderClassVisuals(ctx) {
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
                const segmentDistance = i * segmentLength;
                
                // Only draw segments that have been reached by the wave
                if (segmentDistance <= currentWaveDistance) {
                    // Fade out segments that are behind the wave front
                    const distanceFromFront = currentWaveDistance - segmentDistance;
                    const fadeProgress = distanceFromFront / (waveMaxDistance * 0.3); // Fade over 30% of distance
                    const alpha = Math.max(0, 1 - fadeProgress);
                    
                    // Draw segment
                    const x = this.size + 5 + segmentDistance;
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
        
        // Draw heavy charge effect - Tank ground smash indicator
        if (this.heavyChargeEffectActive) {
            const chargeProgress = this.heavyChargeEffectElapsed / this.heavyChargeEffectDuration;
            const pulseSize = 1.0 + Math.sin(chargeProgress * Math.PI * 4) * 0.1;
            
            ctx.save();
            ctx.globalAlpha = 0.6;
            
            // Tank: Circular ground smash indicator
            const smashRadius = 120;
            ctx.strokeStyle = '#ff6666';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(this.x, this.y, smashRadius * pulseSize, 0, Math.PI * 2);
            ctx.stroke();
            
            ctx.restore();
        }
        
        // Draw ground smash shockwave (only during heavy attacks)
        const hasHeavyHitbox = this.attackHitboxes.some(h => h.heavy);
        if (this.isAttacking && hasHeavyHitbox && !this.heavyChargeEffectActive) {
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
    }
}

