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
        this.moveSpeed = 90;
        this.color = '#00ced1';
        
        this.rotationAngle = 0;
        this.rotationSpeed = Math.PI * 0.5;
        this.teethCount = 8;
        this.teethExtended = 0; // 0-1 for extension amount
        this.toothLength = 20;
        
        this.pullFieldActive = false;
        this.pullFieldStrength = 50; // Phase 1
        
        this.state = 'chase';
        this.stateTimer = 0;
        this.teethCooldown = 0;
        this.projectileCooldown = 0;
        this.summonCooldown = 0;
        
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
                this.x += (dx / distance) * this.moveSpeed * deltaTime * 0.3;
                this.y += (dy / distance) * this.moveSpeed * deltaTime * 0.3;
            }
            
            if (this.teethCooldown <= 0 && distance < 150) {
                this.rotatingTeeth();
                this.teethCooldown = 4.0;
            } else if (this.projectileCooldown <= 0) {
                this.spinProjectiles();
                this.projectileCooldown = 3.0;
            } else if (this.summonCooldown <= 0 && this.orbitMinions.length < 3) {
                this.swarmSummon();
                this.summonCooldown = 10.0;
            }
        }
    }
    
    updatePhase2(deltaTime, player) {
        this.pullFieldStrength = 80; // Stronger pull
        
        const distance = Math.sqrt((player.x - this.x) ** 2 + (player.y - this.y) ** 2);
        
        if (this.teethCooldown <= 0) {
            this.toothBarrage();
            this.teethCooldown = 2.5;
        } else if (this.projectileCooldown <= 0) {
            this.doubleSpin();
            this.projectileCooldown = 2.5;
        } else if (this.summonCooldown <= 0 && this.orbitMinions.length < 5) {
            this.swarmSummon();
            this.summonCooldown = 7.0;
        }
        
        // Chase player
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        if (distance > 0) {
            this.x += (dx / distance) * this.moveSpeed * deltaTime * 0.4;
            this.y += (dy / distance) * this.moveSpeed * deltaTime * 0.4;
        }
    }
    
    updatePhase3(deltaTime, player) {
        this.pullFieldStrength = 120; // Maximum pull
        
        // Maximum intensity
        this.rotationSpeed = Math.PI * 4; // Very fast
        
        if (this.stateTimer % 3.0 < 1.0) {
            // Teeth expansion
            this.teethExpansion();
        } else if (this.hp / this.maxHp < 0.15) {
            // Final vortex
            if (this.stateTimer % 4.0 < 0.5) {
                this.finalVortex();
            } else if (this.stateTimer % 4.0 < 1.0) {
                this.deathSpiral();
            }
        }
        
        // Constant projectile spam
        if (this.projectileCooldown <= 0) {
            this.spinProjectiles();
            this.projectileCooldown = 1.5;
        }
        
        // Chase player aggressively
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > 0) {
            this.x += (dx / distance) * this.moveSpeed * deltaTime * 0.6;
            this.y += (dy / distance) * this.moveSpeed * deltaTime * 0.6;
        }
    }
    
    rotatingTeeth() {
        // Teeth extend during rotation
        this.teethExtended = 1.0;
        this.rotationSpeed = Math.PI * 2;
        
        // Create tooth damage zones
        for (let i = 0; i < this.teethCount; i++) {
            const angle = this.rotationAngle + (Math.PI * 2 / this.teethCount) * i;
            const toothX = this.x + Math.cos(angle) * (this.size + this.toothLength);
            const toothY = this.y + Math.sin(angle) * (this.size + this.toothLength);
            this.createDamageZone(toothX, toothY, 25, 1.0, this.damage * 0.9);
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
        // All teeth extend to maximum
        this.teethExtended = 1.0;
        this.toothLength = 40; // Extended length
        
        // Large danger zone
        this.createDamageZone(this.x, this.y, this.size + this.toothLength, 1.5, this.damage * 1.2);
    }
    
    spinProjectiles() {
        if (typeof Game === 'undefined') return;
        
        // Spiral pattern
        const spiralAngle = Date.now() / 200;
        const projectileSpeed = 200;
        
        for (let i = 0; i < 8; i++) {
            const angle = spiralAngle + (Math.PI * 2 / 8) * i;
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
        
        // Two waves in opposite spirals
        const spiralAngle = Date.now() / 200;
        const projectileSpeed = 220;
        
        for (let wave = 0; wave < 2; wave++) {
            const offset = wave * Math.PI;
            for (let i = 0; i < 8; i++) {
                const angle = spiralAngle + (Math.PI * 2 / 8) * i + offset;
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
            this.createShockwave(this.x, this.y, 250, 1.0, this.damage * 2.5);
            
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
            // Large explosion
            this.createShockwave(this.x, this.y, 300, 1.5, this.damage * 3);
            
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
    
    render(ctx) {
        if (!this.alive) return;
        
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotationAngle);
        
        // Draw gear-like circle with indentations
        const visualSize = this.size / 2; // BossBase doubles size
        const teethSize = visualSize + (this.teethExtended * this.toothLength);
        
        ctx.fillStyle = this.color;
        ctx.strokeStyle = '#ffffff';
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
        
        // Render center weak point (when not rotating fast)
        if (this.weakPoints[0].visible) {
            this.renderWeakPoints(ctx);
        }
        
        // Render hazards
        this.renderHazards(ctx);
        
        // Render health bar
        this.renderHealthBar(ctx);
    }
}

