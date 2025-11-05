// Swarm King Boss - Room 10
// Large star with inward-bending spikes, rotation attacks, minion spawning

class BossSwarmKing extends BossBase {
    constructor(x, y) {
        super(x, y);
        
        // Boss name
        this.bossName = 'Swarm King';
        
        // Star shape properties
        this.spikeCount = 8; // 8 spikes for star
        this.rotationAngle = 0; // Current rotation
        this.rotationSpeed = 0; // Rotation speed (radians per second)
        this.spikeExtension = 0; // Current spike extension (0-1)
        this.maxSpikeExtension = 30; // Max spike extension in pixels
        
        // State machine
        this.state = 'chase'; // 'chase', 'barrage', 'lunge', 'slam', 'spinning'
        this.stateTimer = 0;
        
        // Attack cooldowns
        this.barrageCooldown = 0;
        this.lungeCooldown = 0;
        this.slamCooldown = 0;
        this.spawnCooldown = 0;
        
        // Minions spawned
        this.minions = [];
        this.maxMinions = 3; // Phase 1: 2-3, Phase 2: 4-5, Phase 3: more aggressive
        
        // Multi-barrage tracking
        this.multiBarrageTimer = 0;
        this.multiBarrageWaves = 0;
        
        // Override base stats for star boss (before BossBase multiplies them)
        this.size = 60; // Large star (BossBase will multiply by 2, so final size is 120)
        this.maxHp = 1510; // BossBase will multiply by 5 (increased from 195 for more health)
        this.hp = this.maxHp;
        this.damage = 8; // BossBase will multiply by 1.5
        this.moveSpeed = 90.95; // Increased from 80 for better speed
        this.color = '#ff6b00'; // Orange-red
        
        // Add weak points at spike bases (3 weak points)
        // Use this.size (after BossBase multiplies it) for positioning
        const angleStep = (Math.PI * 2) / this.spikeCount;
        for (let i = 0; i < 3; i++) {
            const angle = angleStep * i * 2.67; // Space them out
            const dist = this.size * 0.4; // At base of spikes (now using actual size)
            this.addWeakPoint(
                Math.cos(angle) * dist,
                Math.sin(angle) * dist,
                8, // Weak point radius
                angle
            );
        }
    }
    
    update(deltaTime, player) {
        if (!this.introComplete) return; // Don't update during intro
        if (!this.alive || !player || !player.alive) return;
        
        // Process knockback first
        this.processKnockback(deltaTime);
        
        // Check phase transitions
        this.checkPhaseTransition();
        
        // Update hazards
        this.updateHazards(deltaTime);
        
        // Check hazard collisions with player
        this.checkHazardCollisions(player, deltaTime);
        
        // Update weak points animation
        this.updateWeakPoints(deltaTime);
        
        // Update attack cooldowns
        this.barrageCooldown -= deltaTime;
        this.lungeCooldown -= deltaTime;
        this.slamCooldown -= deltaTime;
        this.spawnCooldown -= deltaTime;
        this.stateTimer += deltaTime;
        
        // Update rotation
        this.rotationAngle += this.rotationSpeed * deltaTime;
        
        // Phase-based behavior
        if (this.phase === 1) {
            this.updatePhase1(deltaTime, player);
        } else if (this.phase === 2) {
            this.updatePhase2(deltaTime, player);
        } else {
            this.updatePhase3(deltaTime, player);
        }
        
        // Keep in bounds
        this.keepInBounds();
        
        // Update minions list (remove dead ones)
        this.minions = this.minions.filter(m => m && m.alive);
    }
    
    updatePhase1(deltaTime, player) {
        const distance = Math.sqrt((player.x - this.x) ** 2 + (player.y - this.y) ** 2);
        
        // State machine
        if (this.state === 'chase') {
            // Chase player
            const dx = player.x - this.x;
            const dy = player.y - this.y;
            if (distance > 0) {
                this.x += (dx / distance) * this.moveSpeed * deltaTime * 0.5;
                this.y += (dy / distance) * this.moveSpeed * deltaTime * 0.5;
            }
            
            // Decide next attack
            if (this.barrageCooldown <= 0 && distance > 150) {
                this.state = 'barrage';
                this.stateTimer = 0;
            } else if (this.lungeCooldown <= 0 && distance < 200) {
                this.state = 'lunge';
                this.stateTimer = 0;
            } else if (this.slamCooldown <= 0 && distance < 100) {
                this.state = 'slam';
                this.stateTimer = 0;
            } else if (this.spawnCooldown <= 0 && this.minions.length < 3) {
                this.spawnMinions();
                this.spawnCooldown = 8.0;
            }
        } else if (this.state === 'barrage') {
            // Spike barrage attack
            if (this.stateTimer < 0.5) {
                // Windup: rotate slowly
                this.rotationSpeed = Math.PI * 0.5;
            } else if (this.stateTimer < 1.0) {
                // Fire projectiles
                if (this.stateTimer < 0.6) {
                    this.spikeBarrage();
                }
                this.rotationSpeed = Math.PI * 2;
            } else {
                // End attack
                this.state = 'chase';
                this.rotationSpeed = 0;
                this.barrageCooldown = 4.0;
            }
        } else if (this.state === 'lunge') {
            // Chase lunge
            if (this.stateTimer < 0.3) {
                // Windup
                const dx = player.x - this.x;
                const dy = player.y - this.y;
                if (distance > 0) {
                    this.x += (dx / distance) * this.moveSpeed * deltaTime * 2;
                    this.y += (dy / distance) * this.moveSpeed * deltaTime * 2;
                }
            } else {
                // End
                this.state = 'chase';
                this.lungeCooldown = 5.0;
            }
        } else if (this.state === 'slam') {
            // Spike slam
            if (this.stateTimer < 0.5) {
                // Windup: extend spikes
                this.spikeExtension = Math.min(1.0, this.stateTimer * 2);
            } else if (this.stateTimer < 0.6) {
                // Slam: create shockwave
                if (this.stateTimer < 0.51) {
                    this.spikeSlam();
                }
                this.spikeExtension = 1.0;
            } else {
                // End
                this.spikeExtension = 0;
                this.state = 'chase';
                this.slamCooldown = 6.0;
            }
        }
    }
    
    updatePhase2(deltaTime, player) {
        // Faster versions of Phase 1, plus new attacks
        const distance = Math.sqrt((player.x - this.x) ** 2 + (player.y - this.y) ** 2);
        
        if (this.state === 'chase') {
            const dx = player.x - this.x;
            const dy = player.y - this.y;
            if (distance > 0) {
                this.x += (dx / distance) * this.moveSpeed * deltaTime * 0.6;
                this.y += (dy / distance) * this.moveSpeed * deltaTime * 0.6;
            }
            
            if (this.barrageCooldown <= 0 && distance > 150) {
                this.state = 'barrage';
                this.stateTimer = 0;
            } else if (this.barrageCooldown <= 0 && this.stateTimer > 1.0) {
                // Multi-barrage
                this.state = 'barrage';
                this.stateTimer = 0;
            } else if (this.slamCooldown <= 0 && distance < 120) {
                this.state = 'spinning'; // Spinning spike wheel
                this.stateTimer = 0;
            } else if (this.spawnCooldown <= 0 && this.minions.length < 5) {
                this.spawnMinions();
                this.spawnCooldown = 6.0;
            }
        } else if (this.state === 'barrage') {
            if (this.stateTimer < 0.3) {
                this.rotationSpeed = Math.PI;
            } else if (this.stateTimer < 1.5) {
                if (this.stateTimer < 0.35 && this.multiBarrageWaves === 0) {
                    // Start multi-barrage
                    this.multiBarrageWaves = 2; // 2 more waves after first
                    this.multiBarrageTimer = 0.3;
                    this.multiBarrage();
                }
                // Update multi-barrage waves
                if (this.multiBarrageTimer > 0) {
                    this.multiBarrageTimer -= deltaTime;
                    if (this.multiBarrageTimer <= 0 && this.multiBarrageWaves > 0) {
                        this.multiBarrage();
                        this.multiBarrageWaves--;
                        this.multiBarrageTimer = 0.3;
                    }
                }
                this.rotationSpeed = Math.PI * 3;
            } else {
                this.state = 'chase';
                this.rotationSpeed = 0;
                this.barrageCooldown = 3.0;
            }
        } else if (this.state === 'spinning') {
            if (this.stateTimer < 2.0) {
                // Rapid rotation with contact damage
                this.rotationSpeed = Math.PI * 6;
                this.spikeExtension = 0.7;
                
                // Check contact damage with player
                if (distance < this.size + player.size) {
                    player.takeDamage(this.damage * 0.5); // Half damage per frame during spin
                }
            } else {
                this.state = 'chase';
                this.rotationSpeed = 0;
                this.spikeExtension = 0;
                this.slamCooldown = 4.0;
            }
        }
    }
    
    updatePhase3(deltaTime, player) {
        // Maximum intensity
        this.rotationSpeed = Math.PI * 2; // Constant rotation
        
        const distance = Math.sqrt((player.x - this.x) ** 2 + (player.y - this.y) ** 2);
        
        // Extended spikes
        if (this.hp / this.maxHp < 0.1) {
            // Explosive finale
            this.spikeExtension = 1.0;
            this.explosiveFinale();
            this.spikeExtension = 0.8;
        } else {
            this.spikeExtension = 0.6;
        }
        
        // Aggressive attacks
        if (this.barrageCooldown <= 0) {
            this.spikeBarrage();
            this.barrageCooldown = 2.0;
        }
        
        if (this.spawnCooldown <= 0 && this.minions.length < 6) {
            this.spawnMinions();
            this.spawnCooldown = 4.0;
        }
        
        // Chase player
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        if (distance > 0) {
            this.x += (dx / distance) * this.moveSpeed * deltaTime * 0.8;
            this.y += (dy / distance) * this.moveSpeed * deltaTime * 0.8;
        }
    }
    
    // Fire 8 projectiles in star pattern
    spikeBarrage() {
        if (typeof Game === 'undefined') return;
        
        const projectileSpeed = 214;
        for (let i = 0; i < 8; i++) {
            const angle = this.rotationAngle + (Math.PI * 2 / 8) * i;
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
    
    // 3 waves of 8 projectiles (call this multiple times with delays)
    multiBarrage() {
        // First wave
        this.spikeBarrage();
        // Store wave timer for subsequent waves
        if (!this.multiBarrageTimer) {
            this.multiBarrageTimer = 0;
        }
    }
    
    // Update multi-barrage waves (call in update)
    updateMultiBarrage(deltaTime) {
        if (this.multiBarrageTimer > 0) {
            this.multiBarrageTimer -= deltaTime;
            if (this.multiBarrageTimer <= 0) {
                // Fire next wave
                this.spikeBarrage();
                if (this.multiBarrageWaves > 0) {
                    this.multiBarrageWaves--;
                    this.multiBarrageTimer = 0.3; // Delay between waves
                }
            }
        }
    }
    
    // Spawn orbiting minions
    spawnMinions() {
        if (typeof Game === 'undefined' || typeof currentRoom === 'undefined') return;
        
        const count = this.phase === 1 ? 2 + Math.floor(Math.random() * 2) : 
                     this.phase === 2 ? 4 + Math.floor(Math.random() * 2) : 
                     5 + Math.floor(Math.random() * 2);
        
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 / count) * i;
            const distance = 150 + Math.random() * 50;
            const minionX = this.x + Math.cos(angle) * distance;
            const minionY = this.y + Math.sin(angle) * distance;
            
            // Pass parent's currentTarget to minion constructor for aggro inheritance
            const minion = new Enemy(minionX, minionY, this.currentTarget);
            minion.maxHp = Math.floor(minion.maxHp * 0.3);
            minion.hp = minion.maxHp;
            minion.damage = minion.damage * 0.7;
            minion.xpValue = Math.floor(minion.xpValue * 0.3);
            minion.lootChance = 0.0;
            
            if (currentRoom) {
                currentRoom.enemies.push(minion);
            }
            if (Game.enemies) {
                Game.enemies.push(minion);
            }
            this.minions.push(minion);
        }
    }
    
    // Spike slam creating shockwave
    spikeSlam() {
        this.createShockwave(this.x, this.y, 150, 0.5, this.damage * 1.5);
        
        // Screen shake
        if (typeof Game !== 'undefined') {
            Game.triggerScreenShake(6, 0.3);
        }
    }
    
    // Explosive finale when HP < 10%
    explosiveFinale() {
        if (typeof Game === 'undefined') return;
        
        // Fire projectiles in all directions
        const projectileSpeed = 267.5;
        for (let i = 0; i < 16; i++) {
            const angle = (Math.PI * 2 / 16) * i;
            Game.projectiles.push({
                x: this.x,
                y: this.y,
                vx: Math.cos(angle) * projectileSpeed,
                vy: Math.sin(angle) * projectileSpeed,
                damage: this.damage * 1.2,
                size: 10,
                lifetime: 2.5,
                elapsed: 0
            });
        }
        
        // Create large shockwave
        this.createShockwave(this.x, this.y, 200, 0.8, this.damage * 2);
        
        // Particles
        if (typeof createParticleBurst !== 'undefined') {
            createParticleBurst(this.x, this.y, this.color, 40);
        }
    }
    
    // Override phase transition
    onPhaseTransition(oldPhase, newPhase) {
        super.onPhaseTransition(oldPhase, newPhase);
        
        // Reset state on phase transition
        this.state = 'chase';
        this.stateTimer = 0;
        this.rotationSpeed = 0;
        this.spikeExtension = 0;
    }
    
    render(ctx) {
        if (!this.alive) return;
        
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotationAngle);
        
        // Draw star with inward-bending spikes
        ctx.fillStyle = this.color;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        
        ctx.beginPath();
        // Visual size should match hitbox size (no division)
        const visualSize = this.size; // Match the collision hitbox size
        const spikeLength = visualSize + (this.spikeExtension * this.maxSpikeExtension);
        const innerRadius = visualSize * 0.4; // Concave inward
        
        for (let i = 0; i < this.spikeCount; i++) {
            const outerAngle = (Math.PI * 2 / this.spikeCount) * i;
            const innerAngle = (Math.PI * 2 / this.spikeCount) * (i + 0.5);
            
            const outerX = Math.cos(outerAngle) * spikeLength;
            const outerY = Math.sin(outerAngle) * spikeLength;
            const innerX = Math.cos(innerAngle) * innerRadius;
            const innerY = Math.sin(innerAngle) * innerRadius;
            
            if (i === 0) {
                ctx.moveTo(outerX, outerY);
            } else {
                ctx.lineTo(outerX, outerY);
            }
            ctx.lineTo(innerX, innerY);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        ctx.restore();
        
        // Render weak points
        this.renderWeakPoints(ctx);
        
        // Render hazards
        this.renderHazards(ctx);
        
        // Render health bar
        this.renderHealthBar(ctx);
    }
}

