// Fractal Core Boss - Room 25
// Octagon with fragment splitting, teleportation, concave weak points

class BossFractalCore extends BossBase {
    constructor(x, y) {
        super(x, y);
        this.bossName = 'Fractal Core';
        
        this.size = 70;
        this.maxHp = 750; // BossBase will multiply by 12
        this.hp = this.maxHp;
        this.damage = 14;
        this.moveSpeed = 141.24; // Increased by 10% from 128.4 for faster movement
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
        this.burstCooldown = 0;
        this.fragmentDashTimer = 0;
        
        this.teleportActive = false;
        this.teleportTimer = 0;
        this.teleportPositions = [];
        this.teleportIndex = 0;
        
        // Telegraph tracking
        this.telegraphActive = false;
        this.telegraphTimer = 0;
        this.telegraphType = ''; // 'fragment', 'dash', 'blast', 'burst', 'pulse', 'explosion', 'chain'
        this.fragmentTelegraphTimer = null;
        this.dashTelegraphTimer = null;
        this.blastTelegraphTimer = null;
        this.burstTelegraphTimer = null;
        
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
        // Get player from getAllAlivePlayers if not provided
        if (!player) {
            const nearestPlayer = this.getNearestPlayer();
            if (!nearestPlayer || !nearestPlayer.alive) return;
            player = nearestPlayer;
        }
        if (!this.alive || !player || !player.alive) return;
        
        this.processKnockback(deltaTime);
        this.checkPhaseTransition();
        this.updateHazards(deltaTime, player);
        this.checkHazardCollisions(player, deltaTime);
        this.updateWeakPoints(deltaTime);
        
        this.fragmentCooldown -= deltaTime;
        this.phaseDashCooldown -= deltaTime;
        this.rotationBlastCooldown -= deltaTime;
        this.summonCooldown -= deltaTime;
        this.pulseCooldown -= deltaTime;
        this.burstCooldown -= deltaTime;
        this.fragmentDashTimer += deltaTime;
        this.stateTimer += deltaTime;
        this.fragmentOrbitAngle += deltaTime * 2.2; // Increased by 10% from 2.0
        
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
                this.x += (dx / distance) * this.moveSpeed * deltaTime * 0.5; // Increased from 0.4
                this.y += (dy / distance) * this.moveSpeed * deltaTime * 0.5;
            }
            
            // Fractal Burst when player too close with telegraph
            if (this.burstCooldown <= 0 && distance < 100) {
                if (!this.burstTelegraphTimer) {
                    this.burstTelegraphTimer = 0.7; // 0.7s telegraph
                    this.telegraphActive = true;
                    this.telegraphTimer = 0;
                    this.telegraphType = 'burst';
                }
                this.burstTelegraphTimer -= deltaTime;
                if (this.burstTelegraphTimer <= 0) {
                    this.fractalBurst();
                    this.burstCooldown = 4.0; // Increased from 3.0
                    this.telegraphActive = false;
                    this.burstTelegraphTimer = null;
                }
            } else if (this.fragmentCooldown <= 0) {
                // Fragment spawn with telegraph
                if (!this.fragmentTelegraphTimer) {
                    this.fragmentTelegraphTimer = 0.8; // 0.8s telegraph
                    this.telegraphActive = true;
                    this.telegraphTimer = 0;
                    this.telegraphType = 'fragment';
                }
                this.fragmentTelegraphTimer -= deltaTime;
                if (this.fragmentTelegraphTimer <= 0) {
                    this.fragmentSpawn();
                    this.fragmentCooldown = 9.0; // Increased from 8.0
                    this.telegraphActive = false;
                    this.fragmentTelegraphTimer = null;
                }
            } else if (this.phaseDashCooldown <= 0 && distance < 200) {
                // Phase dash with telegraph
                if (!this.dashTelegraphTimer) {
                    this.dashTelegraphTimer = 0.7; // 0.7s telegraph
                    this.telegraphActive = true;
                    this.telegraphTimer = 0;
                    this.telegraphType = 'dash';
                }
                this.dashTelegraphTimer -= deltaTime;
                if (this.dashTelegraphTimer <= 0) {
                    this.phaseDash();
                    this.phaseDashCooldown = 5.5; // Increased from 4.5
                    this.telegraphActive = false;
                    this.dashTelegraphTimer = null;
                }
            } else if (this.rotationBlastCooldown <= 0) {
                // Rotation blast with telegraph
                if (!this.blastTelegraphTimer) {
                    this.blastTelegraphTimer = 0.6; // 0.6s telegraph
                    this.telegraphActive = true;
                    this.telegraphTimer = 0;
                    this.telegraphType = 'blast';
                }
                this.blastTelegraphTimer -= deltaTime;
                if (this.blastTelegraphTimer <= 0) {
                    this.rotationBlast();
                    this.rotationBlastCooldown = 6.0; // Increased from 5.0
                    this.telegraphActive = false;
                    this.blastTelegraphTimer = null;
                }
            } else if (this.summonCooldown <= 0) {
                this.summonElite();
                this.summonCooldown = 12.0;
            } else {
                this.telegraphActive = false;
            }
            
            // Reform fragments after delay
            if (this.fragmented && this.fragmentCooldown < 6.0) {
                this.fragmented = false;
                this.fragments = [];
            }
        }
        
        // Make fragments dash toward player periodically
        if (this.fragmented && this.fragmentDashTimer >= 1.5) {
            this.fragmentDash(player);
            this.fragmentDashTimer = 0;
        }
    }
    
    updatePhase2(deltaTime, player) {
        this.fragmentCount = 6;
        const distance = Math.sqrt((player.x - this.x) ** 2 + (player.y - this.y) ** 2);
        
        if (this.fragmentCooldown <= 0) {
            // Multi fragment with telegraph
            if (!this.fragmentTelegraphTimer) {
                this.fragmentTelegraphTimer = 0.8; // 0.8s telegraph
                this.telegraphActive = true;
                this.telegraphTimer = 0;
                this.telegraphType = 'fragment';
            }
            this.fragmentTelegraphTimer -= deltaTime;
            if (this.fragmentTelegraphTimer <= 0) {
                this.multiFragment();
                this.fragmentCooldown = 8.0; // Increased from 7.0
                this.telegraphActive = false;
                this.fragmentTelegraphTimer = null;
            }
        } else if (this.phaseDashCooldown <= 0 && distance < 220) {
            // Phase chain with telegraph
            if (!this.dashTelegraphTimer) {
                this.dashTelegraphTimer = 0.9; // 0.9s telegraph
                this.telegraphActive = true;
                this.telegraphTimer = 0;
                this.telegraphType = 'chain';
            }
            this.dashTelegraphTimer -= deltaTime;
            if (this.dashTelegraphTimer <= 0) {
                this.phaseChain();
                this.phaseDashCooldown = 4.5; // Increased from 3.5
                this.telegraphActive = false;
                this.dashTelegraphTimer = null;
            }
        } else if (this.pulseCooldown <= 0) {
            // Expanding pulse with telegraph
            if (!this.burstTelegraphTimer) {
                this.burstTelegraphTimer = 0.8; // 0.8s telegraph
                this.telegraphActive = true;
                this.telegraphTimer = 0;
                this.telegraphType = 'pulse';
            }
            this.burstTelegraphTimer -= deltaTime;
            if (this.burstTelegraphTimer <= 0) {
                this.expandingPulse();
                this.pulseCooldown = 6.0; // Increased from 5.0
                this.telegraphActive = false;
                this.burstTelegraphTimer = null;
            }
        } else if (this.fragmented && this.fragmentCooldown < 4.0) {
            // Fragment barrage with telegraph
            if (!this.blastTelegraphTimer) {
                this.blastTelegraphTimer = 0.7; // 0.7s telegraph
                this.telegraphActive = true;
                this.telegraphTimer = 0;
                this.telegraphType = 'blast';
            }
            this.blastTelegraphTimer -= deltaTime;
            if (this.blastTelegraphTimer <= 0) {
                this.fragmentBarrage();
                this.fragmented = false;
                this.telegraphActive = false;
                this.blastTelegraphTimer = null;
            }
        } else {
            this.telegraphActive = false;
        }
        
        // Chase player
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        if (distance > 0) {
            this.x += (dx / distance) * this.moveSpeed * deltaTime * 0.6; // Increased from 0.5
            this.y += (dy / distance) * this.moveSpeed * deltaTime * 0.6;
        }
        
        // Make fragments dash toward player periodically
        if (this.fragmented && this.fragmentDashTimer >= 1.2) {
            this.fragmentDash(player);
            this.fragmentDashTimer = 0;
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
                    // Core explosion with telegraph
                    if (Math.floor(this.stateTimer) % 4 === 0) {
                        const explosionCycle = this.stateTimer % 4.0;
                        if (explosionCycle < 0.8) {
                            // Telegraph before explosion
                            this.telegraphActive = true;
                            this.telegraphTimer = explosionCycle;
                            this.telegraphType = 'explosion';
                        } else if (explosionCycle < 0.9) {
                            this.telegraphActive = false;
                            if (explosionCycle < 0.81) {
                                this.coreExplosion();
                            }
                        } else {
                            this.telegraphActive = false;
                        }
                    }
                    // Final blast with telegraph
                    if (this.hp / this.maxHp < 0.15 && Math.floor(this.stateTimer) % 6 === 0) {
                        const blastCycle = this.stateTimer % 6.0;
                        if (blastCycle < 1.0) {
                            // Long telegraph before final blast
                            this.telegraphActive = true;
                            this.telegraphTimer = blastCycle;
                            this.telegraphType = 'explosion';
                        } else if (blastCycle < 1.1) {
                            this.telegraphActive = false;
                            if (blastCycle < 1.01) {
                                this.finalBlast();
                            }
                        } else {
                            this.telegraphActive = false;
                        }
                    }
                }
            }
        
        // Aggressive chase
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > 0) {
            this.x += (dx / distance) * this.moveSpeed * deltaTime * 0.8; // Increased from 0.7
            this.y += (dy / distance) * this.moveSpeed * deltaTime * 0.8;
        }
        
        // Fragments actively chase player in Phase 3
        if (this.fragmented) {
            this.superFragmentStorm(player, deltaTime);
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
                    vx: Math.cos(projAngle) * 275, // Increased by 10% from 250
                    vy: Math.sin(projAngle) * 275,
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
        
        const projectileSpeed = 329.56; // Increased by 10% from 299.6
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
                    vx: (dx / dist) * 330, // Increased by 10% from 300
                    vy: (dy / dist) * 330,
                    damage: this.damage * 0.6,
                    size: 6,
                    lifetime: 2.5,
                    elapsed: 0
                });
            }
        });
    }
    
    expandingPulse() {
        // Ring of energy every 5 seconds (longer duration for visibility)
        this.createShockwave(this.x, this.y, 200, 1.4, this.damage * 1.5); // Increased from 1.0 to 1.4
    }
    
    superFragmentStorm(player, deltaTime) {
        // Fragments aggressively chase player (more intense in Phase 3)
        if (this.fragments.length > 0) {
            this.fragments.forEach((frag, i) => {
                const dx = player.x - frag.x;
                const dy = player.y - frag.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > 0) {
                    // Move fragment toward player (faster in Phase 3)
                    const chaseSpeed = this.phase === 3 ? 470.8 : 353.1; // Increased by 10% from 428 and 321
                    frag.x += (dx / dist) * chaseSpeed * deltaTime;
                    frag.y += (dy / dist) * chaseSpeed * deltaTime;
                    
                    // Create collision zone (longer duration for visibility)
                    this.createDamageZone(frag.x, frag.y, 35, 0.3, this.damage * 0.5); // Increased from 0.1 to 0.3
                }
            });
        }
    }
    
    // Fractal Burst - defensive pulse when player gets too close
    fractalBurst() {
        // Expanding pulse that pushes player back (longer duration for visibility)
        this.createShockwave(this.x, this.y, 150, 1.2, this.damage * 1.2); // Increased from 0.8 to 1.2
        
        // Screen shake
        if (typeof Game !== 'undefined') {
            Game.triggerScreenShake(4, 0.2);
        }
    }
    
    // Fragment Dash - fragments periodically dash toward player position
    fragmentDash(player) {
        if (!this.fragmented || this.fragments.length === 0) return;
        
        // Each fragment dashes toward player's current position
        this.fragments.forEach((frag) => {
            const dx = player.x - frag.x;
            const dy = player.y - frag.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 0) {
                // Dash forward
                const dashSpeed = 588.5; // Increased by 10% from 535
                frag.x += (dx / dist) * dashSpeed * 0.15;
                frag.y += (dy / dist) * dashSpeed * 0.15;
                
                // Create dash trail (longer duration for visibility)
                this.createDamageZone(frag.x, frag.y, 30, 0.8, this.damage * 0.6); // Increased from 0.4 to 0.8
            }
        });
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
                    vx: Math.cos(angle) * 330, // Increased by 10% from 300
                    vy: Math.sin(angle) * 330,
                    damage: this.damage * 1.1,
                    size: 10,
                    lifetime: 2.5,
                    elapsed: 0
                });
        }
        
        // Large shockwave (longer duration for visibility)
        this.createShockwave(this.x, this.y, 180, 1.5, this.damage * 2); // Increased from 1.2 to 1.5
    }
    
    finalBlast() {
        // Screen-wide danger zone explosion (longer duration for visibility)
        this.createShockwave(this.x, this.y, 400, 2.0, this.damage * 3); // Increased from 1.5 to 2.0
        
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
        
        // Inherit aggro target from spawner
        if (this.currentTarget) {
            elite.currentTarget = this.currentTarget;
        }
        
        if (currentRoom) currentRoom.enemies.push(elite);
        if (Game.enemies) Game.enemies.push(elite);
    }
    
    render(ctx) {
        if (!this.alive) return;
        
        // Determine color based on telegraph state
        let renderColor = this.color;
        if (this.telegraphActive && !this.fragmented) {
            const pulse = Math.sin(this.telegraphTimer * Math.PI * 6) * 0.5 + 0.5;
            const redIntensity = 0.5 + pulse * 0.5;
            renderColor = `rgb(${Math.floor(155 * (1 - redIntensity * 0.5))}, ${Math.floor(89 * (1 - redIntensity))}, ${Math.floor(182 * (1 - redIntensity))})`;
        }
        
        if (this.fragmented) {
            // Render fragments
            this.fragments.forEach((frag, i) => {
                this.renderOctagon(ctx, frag.x, frag.y, this.size * 0.4, this.color);
            });
            // Render weak points only when fragmented
            this.renderWeakPoints(ctx);
        } else {
            // Render main octagon with telegraph visual
            this.renderOctagon(ctx, this.x, this.y, this.size, renderColor, this.telegraphActive);
        }
        
        // Render telegraph indicators
        if (this.telegraphActive) {
            this.renderTelegraph(ctx);
        }
        
        this.renderHazards(ctx);
        this.renderHealthBar(ctx);
    }
    
    renderOctagon(ctx, x, y, size, color, isTelegraphing = false) {
        ctx.save();
        ctx.translate(x, y);
        
        // Telegraph pulsing glow
        if (isTelegraphing) {
            const pulse = Math.sin(this.telegraphTimer * Math.PI * 6) * 0.3 + 0.7;
            const glowSize = size * (1 + pulse * 0.2);
            
            ctx.globalAlpha = pulse * 0.4;
            ctx.fillStyle = '#ff0000';
            ctx.beginPath();
            for (let i = 0; i < 8; i++) {
                const angle = (Math.PI * 2 / 8) * i - Math.PI / 2;
                const px = Math.cos(angle) * glowSize;
                const py = Math.sin(angle) * glowSize;
                if (i === 0) {
                    ctx.moveTo(px, py);
                } else {
                    ctx.lineTo(px, py);
                }
            }
            ctx.closePath();
            ctx.fill();
            ctx.globalAlpha = 1.0;
        }
        
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
    
    renderTelegraph(ctx) {
        const pulse = Math.sin(this.telegraphTimer * Math.PI * 6) * 0.5 + 0.5;
        
        if (this.telegraphType === 'fragment') {
            // Show expanding rings indicating fragments will spawn
            const progress = this.telegraphTimer / 0.8;
            const maxRadius = this.fragmentOrbitRadius;
            const currentRadius = maxRadius * progress;
            
            ctx.save();
            ctx.strokeStyle = '#ff00ff';
            ctx.lineWidth = 3;
            ctx.globalAlpha = 0.7 + pulse * 0.3;
            
            // Draw fragment positions
            for (let i = 0; i < this.fragmentCount; i++) {
                const angle = (Math.PI * 2 / this.fragmentCount) * i;
                const fragX = this.x + Math.cos(angle) * currentRadius;
                const fragY = this.y + Math.sin(angle) * currentRadius;
                
                ctx.beginPath();
                ctx.arc(fragX, fragY, this.size * 0.4, 0, Math.PI * 2);
                ctx.stroke();
            }
            ctx.restore();
        } else if (this.telegraphType === 'dash' || this.telegraphType === 'chain') {
            // Show teleport destination indicators
            ctx.save();
            ctx.strokeStyle = '#ff00ff';
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.6 + pulse * 0.4;
            ctx.setLineDash([5, 5]);
            
            if (this.telegraphType === 'chain' && this.teleportPositions.length > 0) {
                // Show chain teleport destinations
                this.teleportPositions.forEach((pos, i) => {
                    ctx.beginPath();
                    ctx.arc(pos.x, pos.y, this.size * 0.8, 0, Math.PI * 2);
                    ctx.stroke();
                });
            } else {
                // Show single dash destination (circular area)
                const angle = Math.random() * Math.PI * 2;
                const distance = 150 + Math.random() * 100;
                const targetX = Math.max(50, Math.min(750, this.x + Math.cos(angle) * distance));
                const targetY = Math.max(50, Math.min(550, this.y + Math.sin(angle) * distance));
                
                ctx.beginPath();
                ctx.arc(targetX, targetY, this.size * 0.8, 0, Math.PI * 2);
                ctx.stroke();
            }
            ctx.setLineDash([]);
            ctx.restore();
        } else if (this.telegraphType === 'blast') {
            // Show projectile directions
            ctx.save();
            ctx.strokeStyle = '#ff00ff';
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.6 + pulse * 0.4;
            
            const count = this.fragmented ? this.fragments.length : 8;
            for (let i = 0; i < count; i++) {
                let startX, startY;
                if (this.fragmented && this.fragments.length > 0) {
                    startX = this.fragments[i].x;
                    startY = this.fragments[i].y;
                } else {
                    startX = this.x;
                    startY = this.y;
                }
                
                const angle = (Math.PI * 2 / count) * i;
                const lineLength = 120;
                ctx.beginPath();
                ctx.moveTo(startX, startY);
                ctx.lineTo(startX + Math.cos(angle) * lineLength, startY + Math.sin(angle) * lineLength);
                ctx.stroke();
            }
            ctx.restore();
        } else if (this.telegraphType === 'burst' || this.telegraphType === 'pulse') {
            // Show expanding ring
            const progress = this.telegraphTimer / (this.telegraphType === 'burst' ? 0.7 : 0.8);
            const maxRadius = this.telegraphType === 'burst' ? 150 : 200;
            const currentRadius = maxRadius * progress;
            
            ctx.save();
            ctx.strokeStyle = '#ff00ff';
            ctx.lineWidth = 4;
            ctx.globalAlpha = 0.7 + pulse * 0.3;
            ctx.beginPath();
            ctx.arc(this.x, this.y, currentRadius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        } else if (this.telegraphType === 'explosion') {
            // Show expanding warning rings
            const progress = this.telegraphTimer / (this.stateTimer % 6.0 < 1.0 ? 1.0 : 0.8);
            const maxRadius = this.stateTimer % 6.0 < 1.0 ? 400 : 180;
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

