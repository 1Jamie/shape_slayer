// Fractal Core Boss - Room 25
// Octagon with fragment splitting, teleportation, concave weak points

class BossFractalCore extends BossBase {
    constructor(x, y) {
        super(x, y);
        this.bossName = 'Fractal Core';
        
        this.size = 70;
        this.maxHp = 195; // With 30% increase from base 150 = 150 * 1.3
        this.hp = this.maxHp;
        this.damage = 14;
        this.moveSpeed = 100;
        this.color = '#9b59b6';
        
        this.fragmented = false;
        this.fragmentCount = 4;
        this.fragments = [];
        this.fragmentOrbitRadius = 80;
        this.fragmentOrbitAngle = 0;
        
        this.state = 'chase';
        this.stateTimer = 0;
        this.fragmentCooldown = 0;
        this.phaseDashCooldown = 0;
        this.rotationBlastCooldown = 0;
        this.summonCooldown = 0;
        this.pulseCooldown = 0;
        
        this.teleportActive = false;
        this.teleportTimer = 0;
        this.teleportPositions = [];
        this.teleportIndex = 0;
        
        // 4 weak points at concave indentations
        const angleStep = Math.PI * 2 / 8; // 8 sides of octagon
        for (let i = 0; i < 4; i++) {
            const angle = angleStep * i * 2; // Space them out
            const dist = this.size * 0.6; // At concave indentations
            this.addWeakPoint(
                Math.cos(angle) * dist,
                Math.sin(angle) * dist,
                8, angle
            );
        }
    }
    
    update(deltaTime, player) {
        if (!this.introComplete) return;
        if (!this.alive || !player || !player.alive) return;
        
        this.processKnockback(deltaTime);
        this.checkPhaseTransition();
        this.updateHazards(deltaTime);
        this.checkHazardCollisions(player, deltaTime);
        this.updateWeakPoints(deltaTime);
        
        this.fragmentCooldown -= deltaTime;
        this.phaseDashCooldown -= deltaTime;
        this.rotationBlastCooldown -= deltaTime;
        this.summonCooldown -= deltaTime;
        this.pulseCooldown -= deltaTime;
        this.stateTimer += deltaTime;
        this.fragmentOrbitAngle += deltaTime * 2;
        
        // Update weak point visibility (only when fragments separated)
        this.weakPoints.forEach(wp => wp.visible = this.fragmented);
        
        if (this.phase === 1) {
            this.updatePhase1(deltaTime, player);
        } else if (this.phase === 2) {
            this.updatePhase2(deltaTime, player);
        } else {
            this.updatePhase3(deltaTime, player);
        }
        
        // Update fragment positions if fragmented
        if (this.fragmented) {
            this.updateFragments(deltaTime);
        }
        
        // Update phase chain teleport
        if (this.teleportActive) {
            this.teleportTimer += deltaTime;
            if (this.teleportTimer >= 0.3 && this.teleportIndex < this.teleportPositions.length) {
                const pos = this.teleportPositions[this.teleportIndex];
                this.createDamageZone(pos.x, pos.y, 50, 0.8, this.damage * 0.8);
                this.x = Math.max(50, Math.min(750, pos.x));
                this.y = Math.max(50, Math.min(550, pos.y));
                this.teleportIndex++;
                this.teleportTimer = 0;
                
                if (this.teleportIndex >= 3) {
                    this.teleportActive = false;
                    this.teleportTimer = 0;
                }
            }
        }
        
        this.keepInBounds();
    }
    
    updateFragments(deltaTime) {
        // Fragments orbit around boss center
        this.fragments = [];
        for (let i = 0; i < this.fragmentCount; i++) {
            const angle = (Math.PI * 2 / this.fragmentCount) * i + this.fragmentOrbitAngle;
            const fragX = this.x + Math.cos(angle) * this.fragmentOrbitRadius;
            const fragY = this.y + Math.sin(angle) * this.fragmentOrbitRadius;
            this.fragments.push({ x: fragX, y: fragY, angle: angle });
        }
    }
    
    updatePhase1(deltaTime, player) {
        const distance = Math.sqrt((player.x - this.x) ** 2 + (player.y - this.y) ** 2);
        
        if (this.state === 'chase') {
            const dx = player.x - this.x;
            const dy = player.y - this.y;
            if (distance > 0) {
                this.x += (dx / distance) * this.moveSpeed * deltaTime * 0.4;
                this.y += (dy / distance) * this.moveSpeed * deltaTime * 0.4;
            }
            
            if (this.fragmentCooldown <= 0) {
                this.fragmentSpawn();
                this.fragmentCooldown = 8.0;
            } else if (this.phaseDashCooldown <= 0 && distance < 200) {
                this.phaseDash();
                this.phaseDashCooldown = 6.0;
            } else if (this.rotationBlastCooldown <= 0) {
                this.rotationBlast();
                this.rotationBlastCooldown = 5.0;
            } else if (this.summonCooldown <= 0) {
                this.summonElite();
                this.summonCooldown = 12.0;
            }
            
            // Reform fragments after delay
            if (this.fragmented && this.fragmentCooldown < 6.0) {
                this.fragmented = false;
                this.fragments = [];
            }
        }
    }
    
    updatePhase2(deltaTime, player) {
        this.fragmentCount = 6;
        const distance = Math.sqrt((player.x - this.x) ** 2 + (player.y - this.y) ** 2);
        
        if (this.fragmentCooldown <= 0) {
            this.multiFragment();
            this.fragmentCooldown = 7.0;
        } else if (this.phaseDashCooldown <= 0 && distance < 220) {
            this.phaseChain();
            this.phaseDashCooldown = 5.0;
        } else if (this.pulseCooldown <= 0) {
            this.expandingPulse();
            this.pulseCooldown = 5.0;
        } else if (this.fragmented && this.fragmentCooldown < 5.0) {
            this.fragmentBarrage();
            this.fragmented = false;
        }
        
        // Chase player
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        if (distance > 0) {
            this.x += (dx / distance) * this.moveSpeed * deltaTime * 0.5;
            this.y += (dy / distance) * this.moveSpeed * deltaTime * 0.5;
        }
    }
    
    updatePhase3(deltaTime, player) {
        this.fragmentCount = 8;
        
        // Chaos mode: constant splitting/reforming
        if (this.stateTimer % 3.0 < 1.5) {
            // Fragment mode
            if (!this.fragmented) {
                this.fragmented = true;
            } else {
                // Super fragment storm (fragments chase player)
                this.superFragmentStorm(player, deltaTime);
            }
        } else {
            // Solid mode
            if (this.fragmented) {
                this.fragmented = false;
                this.fragments = [];
            } else {
                // Core explosion
                if (Math.floor(this.stateTimer) % 4 === 0 && this.stateTimer % 4.0 < 0.3) {
                    this.coreExplosion();
                }
                // Final blast
                if (this.hp / this.maxHp < 0.15 && Math.floor(this.stateTimer) % 6 === 0 && this.stateTimer % 6.0 < 0.2) {
                    this.finalBlast();
                }
            }
        }
        
        // Aggressive chase
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > 0) {
            this.x += (dx / distance) * this.moveSpeed * deltaTime * 0.7;
            this.y += (dy / distance) * this.moveSpeed * deltaTime * 0.7;
        }
    }
    
    fragmentSpawn() {
        this.fragmented = true;
        this.fragmentCount = 4;
        this.fragmentOrbitRadius = 80;
    }
    
    multiFragment() {
        this.fragmented = true;
        this.fragmentCount = 6;
        this.fragmentOrbitRadius = 100;
    }
    
    phaseDash() {
        // Teleport short distance
        const angle = Math.random() * Math.PI * 2;
        const distance = 150 + Math.random() * 100;
        const newX = this.x + Math.cos(angle) * distance;
        const newY = this.y + Math.sin(angle) * distance;
        
        // Spawn projectiles at origin
        if (typeof Game !== 'undefined') {
            for (let i = 0; i < 4; i++) {
                const projAngle = (Math.PI * 2 / 4) * i;
                Game.projectiles.push({
                    x: this.x,
                    y: this.y,
                    vx: Math.cos(projAngle) * 200,
                    vy: Math.sin(projAngle) * 200,
                    damage: this.damage * 0.7,
                    size: 7,
                    lifetime: 2.5,
                    elapsed: 0
                });
            }
            
            // Create damage trail at origin
            this.createDamageZone(this.x, this.y, 50, 0.8, this.damage * 0.8);
        }
        
        // Teleport
        this.x = Math.max(50, Math.min(750, newX));
        this.y = Math.max(50, Math.min(550, newY));
        
        // Screen shake
        if (typeof Game !== 'undefined') {
            Game.triggerScreenShake(4, 0.2);
        }
    }
    
    phaseChain() {
        // 3 teleports in sequence
        this.teleportActive = true;
        this.teleportIndex = 0;
        this.teleportTimer = 0;
        this.teleportPositions = [];
        
        for (let i = 0; i < 3; i++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = 120;
            this.teleportPositions.push({
                x: Math.max(50, Math.min(750, this.x + Math.cos(angle) * distance)),
                y: Math.max(50, Math.min(550, this.y + Math.sin(angle) * distance))
            });
        }
    }
    
    rotationBlast() {
        if (typeof Game === 'undefined') return;
        
        const projectileSpeed = 220;
        for (let i = 0; i < 8; i++) {
            const angle = (Math.PI * 2 / 8) * i;
            Game.projectiles.push({
                x: this.x,
                y: this.y,
                vx: Math.cos(angle) * projectileSpeed,
                vy: Math.sin(angle) * projectileSpeed,
                damage: this.damage * 0.9,
                size: 8,
                lifetime: 3.0,
                elapsed: 0
            });
        }
    }
    
    fragmentBarrage() {
        if (typeof Game === 'undefined' || !Game.player) return;
        
        // All fragments shoot before reforming
        this.fragments.forEach((frag, i) => {
            const dx = Game.player.x - frag.x;
            const dy = Game.player.y - frag.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 0) {
                Game.projectiles.push({
                    x: frag.x,
                    y: frag.y,
                    vx: (dx / dist) * 250,
                    vy: (dy / dist) * 250,
                    damage: this.damage * 0.6,
                    size: 6,
                    lifetime: 2.5,
                    elapsed: 0
                });
            }
        });
    }
    
    expandingPulse() {
        // Ring of energy every 5 seconds
        this.createShockwave(this.x, this.y, 200, 1.0, this.damage * 1.5);
    }
    
    superFragmentStorm(player, deltaTime) {
        // 8 fragments aggressively chase player
        if (this.fragments.length === 8) {
            this.fragments.forEach((frag, i) => {
                const dx = player.x - frag.x;
                const dy = player.y - frag.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > 0) {
                    // Move fragment toward player
                    frag.x += (dx / dist) * 300 * deltaTime;
                    frag.y += (dy / dist) * 300 * deltaTime;
                    
                    // Create collision zone
                    this.createDamageZone(frag.x, frag.y, 35, 0.1, this.damage * 0.5);
                }
            });
        }
    }
    
    coreExplosion() {
        // Inner core detaches, independent attacks
        if (typeof Game === 'undefined') return;
        
        // Spawn projectiles in all directions
        for (let i = 0; i < 12; i++) {
            const angle = (Math.PI * 2 / 12) * i;
            Game.projectiles.push({
                x: this.x,
                y: this.y,
                vx: Math.cos(angle) * 250,
                vy: Math.sin(angle) * 250,
                damage: this.damage * 1.1,
                size: 10,
                lifetime: 2.5,
                elapsed: 0
            });
        }
        
        // Large shockwave
        this.createShockwave(this.x, this.y, 180, 1.2, this.damage * 2);
    }
    
    finalBlast() {
        // Screen-wide danger zone explosion
        this.createShockwave(this.x, this.y, 400, 1.5, this.damage * 3);
        
        if (typeof Game !== 'undefined') {
            Game.triggerScreenShake(10, 0.5);
            if (typeof createParticleBurst !== 'undefined') {
                createParticleBurst(this.x, this.y, this.color, 50);
            }
        }
    }
    
    summonElite() {
        if (typeof Game === 'undefined' || typeof currentRoom === 'undefined') return;
        
        const elite = new OctagonEnemy(
            this.x + (Math.random() - 0.5) * 150,
            this.y + (Math.random() - 0.5) * 150
        );
        elite.maxHp = Math.floor(elite.maxHp * 0.5);
        elite.hp = elite.maxHp;
        elite.damage *= 0.7;
        elite.lootChance = 0.1;
        
        if (currentRoom) currentRoom.enemies.push(elite);
        if (Game.enemies) Game.enemies.push(elite);
    }
    
    render(ctx) {
        if (!this.alive) return;
        
        if (this.fragmented) {
            // Render fragments
            this.fragments.forEach((frag, i) => {
                this.renderOctagon(ctx, frag.x, frag.y, this.size * 0.4, this.color);
            });
            // Render weak points only when fragmented
            this.renderWeakPoints(ctx);
        } else {
            // Render main octagon
            this.renderOctagon(ctx, this.x, this.y, this.size, this.color);
        }
        
        
        this.renderHazards(ctx);
        this.renderHealthBar(ctx);
    }
    
    renderOctagon(ctx, x, y, size, color) {
        ctx.save();
        ctx.translate(x, y);
        
        ctx.fillStyle = color;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
            const angle = (Math.PI * 2 / 8) * i - Math.PI / 2;
            const px = Math.cos(angle) * size;
            const py = Math.sin(angle) * size;
            if (i === 0) {
                ctx.moveTo(px, py);
            } else {
                ctx.lineTo(px, py);
            }
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        ctx.restore();
    }
}

