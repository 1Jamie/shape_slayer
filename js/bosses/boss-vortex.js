// Vortex Boss - Room 30 (Final Boss)
// Circle with pull mechanics, rotating teeth, center core weak point

class BossVortex extends BossBase {
    constructor(x, y) {
        super(x, y);
        this.bossName = 'Vortex';
        
        this.size = 80;
        this.maxHp = 260; // With 30% increase from base 200
        this.hp = this.maxHp;
        this.damage = 16;
        this.moveSpeed = 110; // Increased from 90 for better mobility
        this.color = '#00ced1';
        
        this.rotationAngle = 0;
        this.rotationSpeed = Math.PI * 0.5;
        this.teethCount = 8;
        this.teethExtended = 0; // 0-1 for extension amount
        this.toothLength = 20;
        
        this.pullFieldActive = false;
        this.pullFieldStrength = 70; // Phase 1 (increased from 50)
        
        this.state = 'chase';
        this.stateTimer = 0;
        this.teethCooldown = 0;
        this.projectileCooldown = 0;
        this.summonCooldown = 0;
        this.crushCooldown = 0;
        this.orbitalCrushTimer = 0;
        
        // Telegraph tracking
        this.telegraphActive = false;
        this.telegraphTimer = 0;
        this.telegraphType = ''; // 'teeth', 'projectile', 'crush', 'expansion', 'vortex', 'spiral'
        this.teethTelegraphTimer = null;
        this.projectileTelegraphTimer = null;
        this.crushTelegraphTimer = null;
        
        this.orbitMinions = [];
        
        // Single center core weak point
        this.addWeakPoint(0, 0, 10, 0);
        this.weakPoints[0].visible = true;
    }
    
    update(deltaTime, player) {
        if (!this.introComplete) return;
        if (!this.alive || !player || !player.alive) return;
        
        this.processKnockback(deltaTime);
        this.checkPhaseTransition();
        this.updateHazards(deltaTime);
        this.checkHazardCollisions(player, deltaTime);
        this.updateWeakPoints(deltaTime);
        
        this.rotationAngle += this.rotationSpeed * deltaTime;
        this.teethCooldown -= deltaTime;
        this.projectileCooldown -= deltaTime;
        this.summonCooldown -= deltaTime;
        this.crushCooldown -= deltaTime;
        this.orbitalCrushTimer += deltaTime;
        this.stateTimer += deltaTime;
        
        // Update pull field (always active)
        if (!this.pullFieldActive) {
            this.createPullField(this.x, this.y, 300, this.pullFieldStrength);
            this.pullFieldActive = true;
        } else {
            // Update existing pull field strength
            this.environmentalHazards.forEach(hazard => {
                if (hazard.type === 'pullField' && !hazard.expired) {
                    hazard.strength = this.pullFieldStrength;
                }
            });
        }
        
        // Update weak point visibility (hard to see when rotating fast)
        const rotatingFast = this.rotationSpeed > Math.PI * 3;
        this.weakPoints[0].visible = !rotatingFast;
        
        if (this.phase === 1) {
            this.updatePhase1(deltaTime, player);
        } else if (this.phase === 2) {
            this.updatePhase2(deltaTime, player);
        } else {
            this.updatePhase3(deltaTime, player);
        }
        
        // Check teeth contact damage
        if (this.teethExtended > 0.3) {
            const distance = Math.sqrt((player.x - this.x) ** 2 + (player.y - this.y) ** 2);
            const teethRadius = this.size + (this.teethExtended * this.toothLength);
            if (distance < teethRadius + player.size && distance > this.size) {
                player.takeDamage(this.damage * 0.8);
            }
        }
        
        // Update orbiting minions
        this.orbitMinions = this.orbitMinions.filter(m => m && m.alive);
        
        this.keepInBounds();
    }
    
    updatePhase1(deltaTime, player) {
        const distance = Math.sqrt((player.x - this.x) ** 2 + (player.y - this.y) ** 2);
        
        if (this.state === 'chase') {
            const dx = player.x - this.x;
            const dy = player.y - this.y;
            if (distance > 0) {
                this.x += (dx / distance) * this.moveSpeed * deltaTime * 0.5; // Increased from 0.3
                this.y += (dy / distance) * this.moveSpeed * deltaTime * 0.5;
            }
            
            // Vortex Crush when player gets too close with telegraph
            if (this.crushCooldown <= 0 && distance < 120) {
                if (!this.crushTelegraphTimer) {
                    this.crushTelegraphTimer = 0.8; // 0.8s telegraph
                    this.telegraphActive = true;
                    this.telegraphTimer = 0;
                    this.telegraphType = 'crush';
                }
                this.crushTelegraphTimer -= deltaTime;
                if (this.crushTelegraphTimer <= 0) {
                    this.vortexCrush();
                    this.crushCooldown = 5.0; // Increased from 4.0
                    this.telegraphActive = false;
                    this.crushTelegraphTimer = null;
                }
            } else if (this.teethCooldown <= 0 && distance < 150) {
                // Rotating teeth with telegraph
                if (!this.teethTelegraphTimer) {
                    this.teethTelegraphTimer = 0.7; // 0.7s telegraph
                    this.telegraphActive = true;
                    this.telegraphTimer = 0;
                    this.telegraphType = 'teeth';
                }
                this.teethTelegraphTimer -= deltaTime;
                if (this.teethTelegraphTimer <= 0) {
                    this.rotatingTeeth();
                    this.teethCooldown = 5.0; // Increased from 4.0
                    this.telegraphActive = false;
                    this.teethTelegraphTimer = null;
                }
            } else if (this.projectileCooldown <= 0) {
                // Spin projectiles with telegraph
                if (!this.projectileTelegraphTimer) {
                    this.projectileTelegraphTimer = 0.6; // 0.6s telegraph
                    this.telegraphActive = true;
                    this.telegraphTimer = 0;
                    this.telegraphType = 'projectile';
                }
                this.projectileTelegraphTimer -= deltaTime;
                if (this.projectileTelegraphTimer <= 0) {
                    this.spinProjectiles();
                    this.projectileCooldown = 4.0; // Increased from 3.0
                    this.telegraphActive = false;
                    this.projectileTelegraphTimer = null;
                }
            } else if (this.summonCooldown <= 0 && this.orbitMinions.length < 3) {
                this.swarmSummon();
                this.summonCooldown = 10.0;
            } else {
                this.telegraphActive = false;
            }
        }
        
        // Orbital Crush - minions dash inward periodically
        if (this.orbitalCrushTimer >= 3.0 && this.orbitMinions.length > 0) {
            this.orbitalCrush();
            this.orbitalCrushTimer = 0;
        }
    }
    
    updatePhase2(deltaTime, player) {
        this.pullFieldStrength = 100; // Stronger pull (increased from 80)
        
        const distance = Math.sqrt((player.x - this.x) ** 2 + (player.y - this.y) ** 2);
        
        if (this.crushCooldown <= 0 && distance < 120) {
            // Vortex crush with telegraph
            if (!this.crushTelegraphTimer) {
                this.crushTelegraphTimer = 0.7; // 0.7s telegraph
                this.telegraphActive = true;
                this.telegraphTimer = 0;
                this.telegraphType = 'crush';
            }
            this.crushTelegraphTimer -= deltaTime;
            if (this.crushTelegraphTimer <= 0) {
                this.vortexCrush();
                this.crushCooldown = 4.0; // Increased from 3.0
                this.telegraphActive = false;
                this.crushTelegraphTimer = null;
            }
        } else if (this.teethCooldown <= 0) {
            // Tooth barrage with telegraph
            if (!this.teethTelegraphTimer) {
                this.teethTelegraphTimer = 0.6; // 0.6s telegraph
                this.telegraphActive = true;
                this.telegraphTimer = 0;
                this.telegraphType = 'teeth';
            }
            this.teethTelegraphTimer -= deltaTime;
            if (this.teethTelegraphTimer <= 0) {
                this.toothBarrage();
                this.teethCooldown = 3.0; // Increased from 2.0
                this.telegraphActive = false;
                this.teethTelegraphTimer = null;
            }
        } else if (this.projectileCooldown <= 0) {
            // Double spin with telegraph
            if (!this.projectileTelegraphTimer) {
                this.projectileTelegraphTimer = 0.6; // 0.6s telegraph
                this.telegraphActive = true;
                this.telegraphTimer = 0;
                this.telegraphType = 'projectile';
            }
            this.projectileTelegraphTimer -= deltaTime;
            if (this.projectileTelegraphTimer <= 0) {
                this.doubleSpin();
                this.projectileCooldown = 3.5; // Increased from 2.5
                this.telegraphActive = false;
                this.projectileTelegraphTimer = null;
            }
        } else if (this.summonCooldown <= 0 && this.orbitMinions.length < 5) {
            this.swarmSummon();
            this.summonCooldown = 7.0;
        } else {
            this.telegraphActive = false;
        }
        
        // Chase player
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        if (distance > 0) {
            this.x += (dx / distance) * this.moveSpeed * deltaTime * 0.6; // Increased from 0.4
            this.y += (dy / distance) * this.moveSpeed * deltaTime * 0.6;
        }
        
        // Orbital Crush more frequent
        if (this.orbitalCrushTimer >= 2.5 && this.orbitMinions.length > 0) {
            this.orbitalCrush();
            this.orbitalCrushTimer = 0;
        }
    }
    
    updatePhase3(deltaTime, player) {
        this.pullFieldStrength = 120; // Maximum pull
        
        // Maximum intensity
        this.rotationSpeed = Math.PI * 4; // Very fast
        
        // More frequent teeth expansion with telegraph
        const expansionCycle = this.stateTimer % 2.0;
        if (expansionCycle < 0.9) {
            // Telegraph before expansion
            this.telegraphActive = true;
            this.telegraphTimer = expansionCycle;
            this.telegraphType = 'expansion';
        } else if (expansionCycle < 1.2) {
            // Teeth expansion
            if (expansionCycle < 0.91) {
                this.teethExpansion();
            }
        } else if (this.hp / this.maxHp < 0.15) {
            // Final vortex with telegraph
            const vortexCycle = this.stateTimer % 4.0;
            if (vortexCycle < 0.8) {
                // Telegraph before final vortex
                this.telegraphActive = true;
                this.telegraphTimer = vortexCycle;
                this.telegraphType = 'vortex';
            } else if (vortexCycle < 0.9) {
                this.telegraphActive = false;
                if (vortexCycle < 0.81) {
                    this.finalVortex();
                }
            } else if (vortexCycle < 1.7) {
                // Telegraph before death spiral
                this.telegraphActive = true;
                this.telegraphTimer = vortexCycle - 0.9;
                this.telegraphType = 'spiral';
            } else if (vortexCycle < 1.8) {
                this.telegraphActive = false;
                if (vortexCycle < 1.71) {
                    this.deathSpiral();
                }
            } else {
                this.telegraphActive = false;
            }
        } else {
            this.telegraphActive = false;
        }
        
        // Constant projectile spam with telegraph
        if (this.projectileCooldown <= 0) {
            if (!this.projectileTelegraphTimer) {
                this.projectileTelegraphTimer = 0.5; // 0.5s telegraph
                this.telegraphActive = true;
                this.telegraphTimer = 0;
                this.telegraphType = 'projectile';
            }
            this.projectileTelegraphTimer -= deltaTime;
            if (this.projectileTelegraphTimer <= 0) {
                this.spinProjectiles();
                this.projectileCooldown = 2.0; // Increased from 1.5
                this.telegraphActive = false;
                this.projectileTelegraphTimer = null;
            }
        }
        
        // Chase player aggressively
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > 0) {
            this.x += (dx / distance) * this.moveSpeed * deltaTime * 0.8;
            this.y += (dy / distance) * this.moveSpeed * deltaTime * 0.8;
        }
        
        // Vortex Crush more frequent with telegraph
        if (this.crushCooldown <= 0 && distance < 120) {
            if (!this.crushTelegraphTimer) {
                this.crushTelegraphTimer = 0.7; // 0.7s telegraph
                this.telegraphActive = true;
                this.telegraphTimer = 0;
                this.telegraphType = 'crush';
            }
            this.crushTelegraphTimer -= deltaTime;
            if (this.crushTelegraphTimer <= 0) {
                this.vortexCrush();
                this.crushCooldown = 3.5; // Increased from 2.5
                this.telegraphActive = false;
                this.crushTelegraphTimer = null;
            }
        }
        
        // Orbital Crush very frequent
        if (this.orbitalCrushTimer >= 2.0 && this.orbitMinions.length > 0) {
            this.orbitalCrush();
            this.orbitalCrushTimer = 0;
        }
    }
    
    rotatingTeeth() {
        // Teeth extend during rotation (faster extension)
        this.teethExtended = 1.0;
        this.rotationSpeed = Math.PI * 2.5; // Faster rotation
        
        // Create tooth damage zones (larger, more threatening, longer duration)
        for (let i = 0; i < this.teethCount; i++) {
            const angle = this.rotationAngle + (Math.PI * 2 / this.teethCount) * i;
            const toothX = this.x + Math.cos(angle) * (this.size + this.toothLength);
            const toothY = this.y + Math.sin(angle) * (this.size + this.toothLength);
            this.createDamageZone(toothX, toothY, 30, 1.5, this.damage * 1.0); // Increased duration from 1.2 to 1.5
        }
    }
    
    toothBarrage() {
        // Rapid extend/retract
        if (this.stateTimer % 0.5 < 0.25) {
            this.teethExtended = 0.8;
            this.rotationSpeed = Math.PI * 5;
        } else {
            this.teethExtended = 0.2;
            this.rotationSpeed = Math.PI * 2;
        }
    }
    
    teethExpansion() {
        // All teeth extend to maximum (more dangerous)
        this.teethExtended = 1.0;
        this.toothLength = 45; // Extended length (increased from 40)
        this.rotationSpeed = Math.PI * 5; // Very fast rotation during expansion
        
        // Large danger zone (more damage, longer duration)
        this.createDamageZone(this.x, this.y, this.size + this.toothLength, 2.2, this.damage * 1.4); // Increased duration from 1.8 to 2.2
    }
    
    spinProjectiles() {
        if (typeof Game === 'undefined') return;
        
        // Tighter, faster spiral pattern
        const spiralAngle = Date.now() / 150; // Faster spiral (was 200)
        const projectileSpeed = 240; // Faster projectiles (increased from 200)
        
        for (let i = 0; i < 8; i++) {
            const angle = spiralAngle + (Math.PI * 2 / 8) * i + (spiralAngle * 0.2); // Tighter spiral
            Game.projectiles.push({
                x: this.x,
                y: this.y,
                vx: Math.cos(angle) * projectileSpeed,
                vy: Math.sin(angle) * projectileSpeed,
                damage: this.damage * 0.8,
                size: 8,
                lifetime: 3.0,
                elapsed: 0
            });
        }
    }
    
    doubleSpin() {
        if (typeof Game === 'undefined') return;
        
        // Two waves in opposite spirals (tighter, faster)
        const spiralAngle = Date.now() / 150; // Faster spiral (was 200)
        const projectileSpeed = 260; // Faster projectiles (increased from 220)
        
        for (let wave = 0; wave < 2; wave++) {
            const offset = wave * Math.PI;
            for (let i = 0; i < 8; i++) {
                const angle = spiralAngle + (Math.PI * 2 / 8) * i + offset + (spiralAngle * 0.2); // Tighter spiral
                Game.projectiles.push({
                    x: this.x,
                    y: this.y,
                    vx: Math.cos(angle) * projectileSpeed,
                    vy: Math.sin(angle) * projectileSpeed,
                    damage: this.damage * 0.9,
                    size: 9,
                    lifetime: 3.0,
                    elapsed: 0
                });
            }
        }
    }
    
    swarmSummon() {
        if (typeof Game === 'undefined' || typeof currentRoom === 'undefined') return;
        
        const count = this.phase === 1 ? 2 + Math.floor(Math.random() * 2) :
                     this.phase === 2 ? 4 + Math.floor(Math.random() * 2) : 5;
        
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 / count) * i;
            const distance = 200;
            const minion = new Enemy(
                this.x + Math.cos(angle) * distance,
                this.y + Math.sin(angle) * distance
            );
            minion.maxHp = Math.floor(minion.maxHp * 0.25);
            minion.hp = minion.maxHp;
            minion.damage *= 0.6;
            minion.xpValue = Math.floor(minion.xpValue * 0.3);
            minion.lootChance = 0.0;
            
            if (currentRoom) currentRoom.enemies.push(minion);
            if (Game.enemies) Game.enemies.push(minion);
            this.orbitMinions.push(minion);
        }
    }
    
    finalVortex() {
        // Contracts, then explosive burst
        if (this.stateTimer % 4.0 < 0.3) {
            // Contract
            this.size *= 0.95;
        } else if (this.stateTimer % 4.0 < 0.5) {
            // Explosive burst
            this.size = 80; // Reset
            this.createShockwave(this.x, this.y, 250, 1.4, this.damage * 2.5); // Increased duration from 1.0 to 1.4
            
            if (typeof Game !== 'undefined') {
                Game.triggerScreenShake(8, 0.4);
                if (typeof createParticleBurst !== 'undefined') {
                    createParticleBurst(this.x, this.y, this.color, 40);
                }
            }
        }
    }
    
    deathSpiral() {
        // Rapid contraction then explosion
        if (this.stateTimer % 4.0 < 0.2) {
            this.size *= 0.9; // Rapid contraction
        } else {
            this.size = 80;
            // Large explosion (longer duration)
            this.createShockwave(this.x, this.y, 300, 2.0, this.damage * 3); // Increased duration from 1.5 to 2.0
            
            // Fire projectiles in all directions
            if (typeof Game !== 'undefined') {
                for (let i = 0; i < 16; i++) {
                    const angle = (Math.PI * 2 / 16) * i;
                    Game.projectiles.push({
                        x: this.x,
                        y: this.y,
                        vx: Math.cos(angle) * 250,
                        vy: Math.sin(angle) * 250,
                        damage: this.damage * 1.2,
                        size: 10,
                        lifetime: 3.0,
                        elapsed: 0
                    });
                }
                
                Game.triggerScreenShake(10, 0.5);
            }
        }
    }
    
    // Vortex Crush - aggressive melee when player gets too close
    vortexCrush() {
        // Rapidly extend all teeth and rotate fast
        this.teethExtended = 1.0;
        this.toothLength = 35; // Extended length
        this.rotationSpeed = Math.PI * 6; // Very fast rotation
        
        // Create large dangerous zone (longer duration)
        this.createDamageZone(this.x, this.y, this.size + this.toothLength, 1.5, this.damage * 1.5); // Increased duration from 1.0 to 1.5
        
        // Screen shake
        if (typeof Game !== 'undefined') {
            Game.triggerScreenShake(5, 0.3);
        }
    }
    
    // Orbital Crush - orbiting minions dash inward toward boss
    orbitalCrush() {
        if (this.orbitMinions.length === 0) return;
        
        // Make all orbiting minions dash toward boss center
        this.orbitMinions.forEach((minion) => {
            if (!minion || !minion.alive) return;
            
            const dx = this.x - minion.x;
            const dy = this.y - minion.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist > 0) {
                // Dash minion toward boss
                const dashSpeed = 400;
                minion.x += (dx / dist) * dashSpeed * 0.15;
                minion.y += (dy / dist) * dashSpeed * 0.15;
                
                // Create damage zone along path (longer duration)
                this.createDamageZone(minion.x, minion.y, 40, 1.0, this.damage * 0.7); // Increased duration from 0.6 to 1.0
            }
        });
    }
    
    render(ctx) {
        if (!this.alive) return;
        
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotationAngle);
        
        // Draw gear-like circle with indentations
        const visualSize = this.size / 2; // BossBase doubles size
        const teethSize = visualSize + (this.teethExtended * this.toothLength);
        
        // Telegraph visual effects
        let baseColor = this.color;
        let strokeColor = '#ffffff';
        if (this.telegraphActive) {
            const pulse = Math.sin(this.telegraphTimer * Math.PI * 6) * 0.5 + 0.5;
            const redIntensity = 0.5 + pulse * 0.5;
            baseColor = `rgb(${Math.floor(0 * (1 - redIntensity))}, ${Math.floor(206 * (1 - redIntensity * 0.5))}, ${Math.floor(209 * (1 - redIntensity * 0.5))})`;
            strokeColor = `rgb(255, ${Math.floor(255 * (1 - redIntensity))}, ${Math.floor(255 * (1 - redIntensity))})`;
            
            // Pulsing glow effect
            const glowSize = visualSize * (1 + pulse * 0.2);
            ctx.globalAlpha = pulse * 0.3;
            ctx.fillStyle = '#ff0000';
            ctx.beginPath();
            ctx.arc(0, 0, glowSize, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1.0;
        }
        
        ctx.fillStyle = baseColor;
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 4;
        
        // Draw main circle
        ctx.beginPath();
        ctx.arc(0, 0, visualSize, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // Draw teeth/indentations
        ctx.fillStyle = '#00ffff';
        for (let i = 0; i < this.teethCount; i++) {
            const angle = (Math.PI * 2 / this.teethCount) * i;
            const toothX = Math.cos(angle) * teethSize;
            const toothY = Math.sin(angle) * teethSize;
            const indentX = Math.cos(angle) * (visualSize * 0.7);
            const indentY = Math.sin(angle) * (visualSize * 0.7);
            
            // Draw tooth extension
            if (this.teethExtended > 0) {
                ctx.beginPath();
                ctx.moveTo(indentX, indentY);
                ctx.lineTo(toothX, toothY);
                ctx.strokeStyle = '#ff0000';
                ctx.lineWidth = 6;
                ctx.stroke();
            }
            
            // Draw indentation
            ctx.beginPath();
            ctx.arc(indentX, indentY, visualSize * 0.15, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.restore();
        
        // Render telegraph indicators
        if (this.telegraphActive) {
            this.renderTelegraph(ctx);
        }
        
        // Render center weak point (when not rotating fast)
        if (this.weakPoints[0].visible) {
            this.renderWeakPoints(ctx);
        }
        
        // Render hazards
        this.renderHazards(ctx);
        
        // Render health bar
        this.renderHealthBar(ctx);
    }
    
    renderTelegraph(ctx) {
        const pulse = Math.sin(this.telegraphTimer * Math.PI * 6) * 0.5 + 0.5;
        const visualSize = this.size / 2;
        
        if (this.telegraphType === 'teeth' || this.telegraphType === 'expansion' || this.telegraphType === 'crush') {
            // Show expanding ring indicating teeth will extend
            let maxRadius;
            if (this.telegraphType === 'expansion') {
                maxRadius = this.size + 45; // Full expansion size
            } else if (this.telegraphType === 'crush') {
                maxRadius = this.size + 35; // Crush size
            } else {
                maxRadius = this.size + 20; // Normal teeth size
            }
            
            const progress = this.telegraphTimer / (this.telegraphType === 'expansion' ? 0.9 : 
                                                   this.telegraphType === 'crush' ? 0.8 : 0.7);
            const currentRadius = maxRadius * progress;
            
            ctx.save();
            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = 4;
            ctx.globalAlpha = 0.7 + pulse * 0.3;
            ctx.beginPath();
            ctx.arc(this.x, this.y, currentRadius, 0, Math.PI * 2);
            ctx.stroke();
            
            // Draw tooth indicators
            for (let i = 0; i < this.teethCount; i++) {
                const angle = this.rotationAngle + (Math.PI * 2 / this.teethCount) * i;
                const toothX = this.x + Math.cos(angle) * currentRadius;
                const toothY = this.y + Math.sin(angle) * currentRadius;
                ctx.beginPath();
                ctx.arc(toothX, toothY, 8, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        } else if (this.telegraphType === 'projectile') {
            // Show spiral pattern indicators
            ctx.save();
            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.6 + pulse * 0.4;
            
            const spiralAngle = Date.now() / 150;
            for (let i = 0; i < 8; i++) {
                const angle = spiralAngle + (Math.PI * 2 / 8) * i + (spiralAngle * 0.2);
                const lineLength = 100;
                ctx.beginPath();
                ctx.moveTo(this.x, this.y);
                ctx.lineTo(this.x + Math.cos(angle) * lineLength, this.y + Math.sin(angle) * lineLength);
                ctx.stroke();
            }
            ctx.restore();
        } else if (this.telegraphType === 'vortex' || this.telegraphType === 'spiral') {
            // Show expanding warning rings
            const progress = this.telegraphTimer / (this.telegraphType === 'vortex' ? 0.8 : 0.8);
            const maxRadius = this.telegraphType === 'spiral' ? 300 : 250;
            const currentRadius = maxRadius * progress;
            
            ctx.save();
            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = 5;
            ctx.globalAlpha = 0.8 + pulse * 0.2;
            ctx.beginPath();
            ctx.arc(this.x, this.y, currentRadius, 0, Math.PI * 2);
            ctx.stroke();
            
            // Inner ring
            ctx.beginPath();
            ctx.arc(this.x, this.y, currentRadius * 0.6, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }
    }
}

