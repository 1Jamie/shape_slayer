// Fortress Boss - Room 20
// Large rectangle with crenellations, slam attacks, shockwaves

class BossFortress extends BossBase {
    constructor(x, y) {
        super(x, y);
        this.bossName = 'Fortress';
        
        this.width = 100;
        this.height = 80;
        this.size = Math.max(this.width, this.height);
        this.maxHp = 234; // BossBase will multiply by 5 (180 * 1.3 = 234 for 30% increase)
        this.hp = this.maxHp;
        this.damage = 12;
        this.moveSpeed = 80; // Increased from 60 for better mobility
        this.color = '#8b4513';
        
        this.state = 'chase';
        this.stateTimer = 0;
        this.slamCooldown = 0;
        this.spikeCooldown = 0;
        this.wallPushCooldown = 0;
        this.summonCooldown = 0;
        this.cannonCooldown = 0;
        this.cannonTelegraphTimer = null;
        this.wallPushTelegraphTimer = null;
        
        this.chargingSlam = false;
        this.chargeElapsed = 0;
        this.cornerSpikes = [false, false, false, false]; // 4 corners
        this.spikeTimer = 0;
        
        // Telegraph tracking
        this.telegraphActive = false;
        this.telegraphTimer = 0;
        this.telegraphType = ''; // 'slam', 'spikes', 'cannon', 'wallPush'
        this.slamWindupTimer = 0;
        this.spikeWindupTimer = 0;
        
        // 2 weak points at top corners
        this.addWeakPoint(-this.width/2 + 15, -this.height/2 + 15, 8, 0);
        this.addWeakPoint(this.width/2 - 15, -this.height/2 + 15, 8, 0);
    }
    
    update(deltaTime, player) {
        if (!this.introComplete) return;
        if (!this.alive || !player || !player.alive) return;
        
        this.processKnockback(deltaTime);
        this.checkPhaseTransition();
        this.updateHazards(deltaTime);
        this.checkHazardCollisions(player, deltaTime);
        this.updateWeakPoints(deltaTime);
        
        this.slamCooldown -= deltaTime;
        this.spikeCooldown -= deltaTime;
        this.wallPushCooldown -= deltaTime;
        this.summonCooldown -= deltaTime;
        this.cannonCooldown -= deltaTime;
        this.stateTimer += deltaTime;
        this.spikeTimer -= deltaTime;
        
        // Update weak point visibility (hidden when spikes extended)
        const spikesExtended = this.cornerSpikes.some(s => s);
        this.weakPoints.forEach(wp => wp.visible = !spikesExtended);
        
        if (this.phase === 1) this.updatePhase1(deltaTime, player);
        else if (this.phase === 2) this.updatePhase2(deltaTime, player);
        else this.updatePhase3(deltaTime, player);
        
        this.keepInBounds();
    }
    
    updatePhase1(deltaTime, player) {
        const distance = Math.sqrt((player.x - this.x) ** 2 + (player.y - this.y) ** 2);
        
        if (this.chargingSlam) {
            this.chargeElapsed += deltaTime;
            this.slamWindupTimer += deltaTime;
            this.telegraphActive = true;
            this.telegraphTimer = this.chargeElapsed;
            this.telegraphType = 'slam';
            
            if (this.chargeElapsed >= 1.5) { // Increased windup from 1.2s for better telegraph
                this.chargingSlam = false;
                this.chargeElapsed = 0;
                this.slamWindupTimer = 0;
                this.telegraphActive = false;
                this.createShockwave(this.x, this.y, 200, 1.2, this.damage * 2); // Increased duration from 1.0 to 1.2
                if (typeof Game !== 'undefined') Game.triggerScreenShake(8, 0.4);
                this.slamCooldown = 8.0;
            }
        } else if (this.state === 'chase') {
            const dx = player.x - this.x;
            const dy = player.y - this.y;
            if (distance > 0) {
                this.x += (dx / distance) * this.moveSpeed * deltaTime * 0.5;
                this.y += (dy / distance) * this.moveSpeed * deltaTime * 0.5;
            }
            
            if (this.slamCooldown <= 0 && distance < 120) {
                this.chargingSlam = true;
                this.slamWindupTimer = 0;
            } else if (this.cannonCooldown <= 0 && distance > 150) {
                // Cannon barrage with telegraph
                this.telegraphActive = true;
                this.telegraphTimer = 0;
                this.telegraphType = 'cannon';
                // Delay actual firing for telegraph
                if (!this.cannonTelegraphTimer) {
                    this.cannonTelegraphTimer = 0.6; // 0.6s telegraph
                }
                this.cannonTelegraphTimer -= deltaTime;
                if (this.cannonTelegraphTimer <= 0) {
                    this.cannonBarrage(player);
                    this.cannonCooldown = 5.0; // Increased from 4.0
                    this.telegraphActive = false;
                    this.cannonTelegraphTimer = null;
                }
            } else if (this.spikeCooldown <= 0) {
                // Spikes with telegraph
                if (!this.spikeWindupTimer) {
                    this.spikeWindupTimer = 0.8; // 0.8s telegraph
                    this.telegraphActive = true;
                    this.telegraphTimer = 0;
                    this.telegraphType = 'spikes';
                }
                this.spikeWindupTimer -= deltaTime;
                if (this.spikeWindupTimer <= 0) {
                    this.activateCornerSpikes();
                    this.spikeCooldown = 7.0; // Increased from 6.0
                    this.telegraphActive = false;
                    this.spikeWindupTimer = null;
                }
            } else if (this.wallPushCooldown <= 0 && distance < 200) {
                // Wall push with telegraph
                if (!this.wallPushTelegraphTimer) {
                    this.wallPushTelegraphTimer = 0.7; // 0.7s telegraph
                    this.telegraphActive = true;
                    this.telegraphTimer = 0;
                    this.telegraphType = 'wallPush';
                }
                this.wallPushTelegraphTimer -= deltaTime;
                if (this.wallPushTelegraphTimer <= 0) {
                    this.wallPush();
                    this.wallPushCooldown = 10.0;
                    this.telegraphActive = false;
                    this.wallPushTelegraphTimer = null;
                }
            } else if (this.summonCooldown <= 0) {
                this.summonGuards();
                this.summonCooldown = 12.0;
            } else {
                this.telegraphActive = false;
            }
        }
    }
    
    updatePhase2(deltaTime, player) {
        // Multiple slams, full spike burst
        if (this.slamCooldown <= 0 && !this.chargingSlam) {
            if (this.stateTimer % 2.0 < 0.5) {
                this.chargingSlam = true;
                this.chargeElapsed = 0;
            }
        }
        
        if (this.chargingSlam) {
            this.chargeElapsed += deltaTime;
            this.slamWindupTimer += deltaTime;
            this.telegraphActive = true;
            this.telegraphTimer = this.chargeElapsed;
            this.telegraphType = 'slam';
            
            if (this.chargeElapsed >= 1.3) { // Increased windup from 1.0s for better telegraph
                this.createShockwave(this.x, this.y, 240, 1.4, this.damage * 2.2); // Increased duration from 1.2 to 1.4
                if (typeof Game !== 'undefined') Game.triggerScreenShake(8, 0.4);
                this.chargeElapsed = 0;
                this.slamWindupTimer = 0;
                if (this.stateTimer % 2.0 >= 1.5) {
                    this.chargingSlam = false;
                    this.telegraphActive = false;
                    this.slamCooldown = 5.0;
                }
            }
        }
        
        if (this.spikeCooldown <= 0) {
            // Spikes with telegraph
            if (!this.spikeWindupTimer) {
                this.spikeWindupTimer = 0.8; // 0.8s telegraph
                this.telegraphActive = true;
                this.telegraphTimer = 0;
                this.telegraphType = 'spikes';
            }
            this.spikeWindupTimer -= deltaTime;
            if (this.spikeWindupTimer <= 0) {
                this.fullSpikeBurst();
                this.spikeCooldown = 6.0; // Increased from 5.0
                this.telegraphActive = false;
                this.spikeWindupTimer = null;
            }
        }
        
        // Cannon volley while moving (Phase 2) with telegraph
        if (this.cannonCooldown <= 0) {
            if (!this.cannonTelegraphTimer) {
                this.cannonTelegraphTimer = 0.5; // 0.5s telegraph
                this.telegraphActive = true;
                this.telegraphTimer = 0;
                this.telegraphType = 'cannon';
            }
            this.cannonTelegraphTimer -= deltaTime;
            if (this.cannonTelegraphTimer <= 0) {
                this.cannonVolley(player);
                this.cannonCooldown = 4.0; // Increased from 3.0
                this.telegraphActive = false;
                this.cannonTelegraphTimer = null;
            }
        }
        
        // Chase player
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > 0) {
            this.x += (dx / distance) * this.moveSpeed * deltaTime * 0.6; // Increased from 0.4
            this.y += (dy / distance) * this.moveSpeed * deltaTime * 0.6;
        }
    }
    
    updatePhase3(deltaTime, player) {
        // Rampage mode, earthquake
        this.chargingSlam = false;
        
        if (this.stateTimer % 2.0 < 0.3) {
            // Constant charging
            const dx = player.x - this.x;
            const dy = player.y - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance > 0) {
                this.x += (dx / distance) * this.moveSpeed * deltaTime * 1.2;
                this.y += (dy / distance) * this.moveSpeed * deltaTime * 1.2;
            }
            if (this.stateTimer % 1.0 < 0.1) {
                this.createShockwave(this.x, this.y, 120, 0.8, this.damage * 1.5);
            }
        } else if (this.stateTimer % 2.0 < 0.8) { // More frequent (was 3.0 < 0.5)
            // Fortress storm - shoot projectiles while moving (more frequent)
            if (typeof Game !== 'undefined' && typeof Game.player !== 'undefined') {
                const dx = Game.player.x - this.x;
                const dy = Game.player.y - this.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > 0 && this.stateTimer % 0.25 < 0.05) { // More frequent shots (was 0.3)
                    Game.projectiles.push({
                        x: this.x,
                        y: this.y,
                        vx: (dx / dist) * 200,
                        vy: (dy / dist) * 200,
                        damage: this.damage * 0.8,
                        size: 8,
                        lifetime: 2.0,
                        elapsed: 0
                    });
                }
            }
        }
    }
    
    activateCornerSpikes() {
        // Extend spikes from 4 corners
        this.cornerSpikes = [true, true, true, true];
        this.spikeTimer = 0.8;
        
        // Create damage zones
        const corners = [
            {x: this.x - this.width/2, y: this.y - this.height/2},
            {x: this.x + this.width/2, y: this.y - this.height/2},
            {x: this.x + this.width/2, y: this.y + this.height/2},
            {x: this.x - this.width/2, y: this.y + this.height/2}
        ];
        
        corners.forEach((corner, i) => {
            // Cardinal direction damage
            const dirs = [
                {x: 0, y: -1}, {x: 1, y: 0}, {x: 0, y: 1}, {x: -1, y: 0}
            ];
            const dir = dirs[i];
            this.createDamageZone(
                corner.x + dir.x * 90, // Increased from 60
                corner.y + dir.y * 90,
                40, 1.2, this.damage * 1.2 // Increased duration from 0.8 to 1.2
            );
        });
    }
    
    fullSpikeBurst() {
        this.activateCornerSpikes();
        // All spikes extend and spin
        for (let i = 0; i < 8; i++) {
            const angle = (Math.PI * 2 / 8) * i;
            const dist = 100;
            this.createDamageZone(
                this.x + Math.cos(angle) * dist,
                this.y + Math.sin(angle) * dist,
                35, 1.3, this.damage * 1.0 // Increased duration from 1.0 to 1.3
            );
        }
    }
    
    wallPush() {
        // Move to edge, push across screen
        if (this.x > 400) {
            this.x = 750;
        } else {
            this.x = 50;
        }
        // Create push damage zone (longer duration for visibility)
        this.createDamageZone(this.x, this.y, 80, 2.5, this.damage * 1.5); // Increased from 2.0 to 2.5
    }
    
    summonGuards() {
        if (typeof Game === 'undefined' || typeof currentRoom === 'undefined') return;
        for (let i = 0; i < 2; i++) {
            const angle = Math.PI * i;
            const guard = new RectangleEnemy(
                this.x + Math.cos(angle) * 100,
                this.y + Math.sin(angle) * 100
            );
            guard.maxHp = Math.floor(guard.maxHp * 0.4);
            guard.hp = guard.maxHp;
            guard.damage *= 0.6;
            guard.lootChance = 0;
            if (currentRoom) currentRoom.enemies.push(guard);
            if (Game.enemies) Game.enemies.push(guard);
        }
    }
    
    // Cannon Barrage - fires projectiles from crenellations
    cannonBarrage(player) {
        if (typeof Game === 'undefined') return;
        
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 0) {
            const projectileSpeed = 220;
            const count = 3 + Math.floor(Math.random() * 2); // 3-4 projectiles
            
            // Fire from different positions along top edge (crenellations)
            for (let i = 0; i < count; i++) {
                const offsetX = (i - count/2 + 0.5) * (this.width / count);
                const startX = this.x + offsetX;
                const startY = this.y - this.height/2;
                
                // Aim toward player with slight spread
                const angle = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.3;
                
                Game.projectiles.push({
                    x: startX,
                    y: startY,
                    vx: Math.cos(angle) * projectileSpeed,
                    vy: Math.sin(angle) * projectileSpeed,
                    damage: this.damage * 0.9,
                    size: 9,
                    lifetime: 2.5,
                    elapsed: 0
                });
            }
        }
    }
    
    // Cannon Volley - fires projectiles while moving (Phase 2)
    cannonVolley(player) {
        if (typeof Game === 'undefined') return;
        
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 0) {
            const projectileSpeed = 200;
            const angle = Math.atan2(dy, dx);
            
            // Fire 2 projectiles in quick succession
            for (let i = 0; i < 2; i++) {
                const spread = (i - 0.5) * 0.15; // Slight spread
                Game.projectiles.push({
                    x: this.x,
                    y: this.y,
                    vx: Math.cos(angle + spread) * projectileSpeed,
                    vy: Math.sin(angle + spread) * projectileSpeed,
                    damage: this.damage * 0.85,
                    size: 8,
                    lifetime: 2.0,
                    elapsed: 0
                });
            }
        }
    }
    
    render(ctx) {
        if (!this.alive) return;
        
        ctx.save();
        ctx.translate(this.x, this.y);
        
        // Draw rectangle with crenellations
        const w = this.width;
        const h = this.height;
        const notchSize = 10;
        
        // Telegraph visual effects
        let baseColor = this.color;
        let strokeColor = '#ffffff';
        if (this.telegraphActive) {
            const pulse = Math.sin(this.telegraphTimer * Math.PI * 6) * 0.5 + 0.5;
            const redIntensity = 0.5 + pulse * 0.5;
            baseColor = `rgb(${Math.floor(139 * (1 - redIntensity * 0.5))}, ${Math.floor(69 * (1 - redIntensity))}, ${Math.floor(19 * (1 - redIntensity))})`;
            strokeColor = `rgb(255, ${Math.floor(255 * (1 - redIntensity))}, ${Math.floor(255 * (1 - redIntensity))})`;
            
            // Pulsing glow effect
            const glowSize = 1 + pulse * 0.15;
            ctx.globalAlpha = pulse * 0.3;
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(-w/2 * glowSize, -h/2 * glowSize, w * glowSize, h * glowSize);
            ctx.globalAlpha = 1.0;
        }
        
        ctx.fillStyle = baseColor;
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 4;
        
        ctx.beginPath();
        // Top edge with notches
        ctx.moveTo(-w/2, -h/2);
        for (let i = -w/2 + notchSize; i < w/2; i += notchSize * 2) {
            ctx.lineTo(i, -h/2);
            ctx.lineTo(i, -h/2 - notchSize/2);
            ctx.lineTo(i + notchSize, -h/2 - notchSize/2);
            ctx.lineTo(i + notchSize, -h/2);
        }
        ctx.lineTo(w/2, -h/2);
        
        // Other edges
        ctx.lineTo(w/2, h/2);
        ctx.lineTo(-w/2, h/2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // Draw corner spikes if extended
        if (this.cornerSpikes.some(s => s)) {
            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = 6;
            const corners = [
                [-w/2, -h/2], [w/2, -h/2], [w/2, h/2], [-w/2, h/2]
            ];
            corners.forEach((corner, i) => {
                if (this.cornerSpikes[i]) {
                    ctx.beginPath();
                    ctx.moveTo(corner[0], corner[1]);
                    const dirs = [[0, -30], [30, 0], [0, 30], [-30, 0]];
                    ctx.lineTo(corner[0] + dirs[i][0], corner[1] + dirs[i][1]);
                    ctx.stroke();
                }
            });
        }
        
        ctx.restore();
        
        // Render telegraph indicators
        if (this.telegraphActive) {
            this.renderTelegraph(ctx);
        }
        
        this.renderWeakPoints(ctx);
        this.renderHazards(ctx);
        this.renderHealthBar(ctx);
    }
    
    renderTelegraph(ctx) {
        const pulse = Math.sin(this.telegraphTimer * Math.PI * 6) * 0.5 + 0.5;
        
        if (this.telegraphType === 'slam') {
            // Show expanding warning ring for slam
            const progress = this.telegraphTimer / (this.telegraphType === 'slam' ? 1.5 : 1.3);
            const maxRadius = 200;
            const currentRadius = maxRadius * progress;
            
            ctx.save();
            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = 4;
            ctx.globalAlpha = 0.7 + pulse * 0.3;
            ctx.beginPath();
            ctx.arc(this.x, this.y, currentRadius, 0, Math.PI * 2);
            ctx.stroke();
            
            // Inner ring
            ctx.beginPath();
            ctx.arc(this.x, this.y, currentRadius * 0.7, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        } else if (this.telegraphType === 'spikes') {
            // Show corner indicators for spikes
            const corners = [
                {x: this.x - this.width/2, y: this.y - this.height/2},
                {x: this.x + this.width/2, y: this.y - this.height/2},
                {x: this.x + this.width/2, y: this.y + this.height/2},
                {x: this.x - this.width/2, y: this.y + this.height/2}
            ];
            const dirs = [
                {x: 0, y: -1}, {x: 1, y: 0}, {x: 0, y: 1}, {x: -1, y: 0}
            ];
            
            ctx.save();
            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = 3;
            ctx.globalAlpha = 0.8 + pulse * 0.2;
            
            corners.forEach((corner, i) => {
                const dir = dirs[i];
                const lineLength = 90 * (0.5 + pulse * 0.5);
                ctx.beginPath();
                ctx.moveTo(corner.x, corner.y);
                ctx.lineTo(corner.x + dir.x * lineLength, corner.y + dir.y * lineLength);
                ctx.stroke();
            });
            ctx.restore();
        } else if (this.telegraphType === 'cannon') {
            // Show aiming lines for cannon
            if (typeof Game !== 'undefined' && Game.player) {
                const dx = Game.player.x - this.x;
                const dy = Game.player.y - this.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist > 0) {
                    ctx.save();
                    ctx.strokeStyle = '#ff0000';
                    ctx.lineWidth = 2;
                    ctx.globalAlpha = 0.6 + pulse * 0.4;
                    
                    // Draw lines from top edge (crenellations)
                    const count = 4;
                    for (let i = 0; i < count; i++) {
                        const offsetX = (i - count/2 + 0.5) * (this.width / count);
                        const startX = this.x + offsetX;
                        const startY = this.y - this.height/2;
                        
                        const angle = Math.atan2(dy, dx) + (i - count/2 + 0.5) * 0.15;
                        const lineLength = 150;
                        ctx.beginPath();
                        ctx.moveTo(startX, startY);
                        ctx.lineTo(startX + Math.cos(angle) * lineLength, startY + Math.sin(angle) * lineLength);
                        ctx.stroke();
                    }
                    ctx.restore();
                }
            }
        } else if (this.telegraphType === 'wallPush') {
            // Show where boss will teleport
            const targetX = this.x > 400 ? 750 : 50;
            ctx.save();
            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = 3;
            ctx.globalAlpha = 0.7 + pulse * 0.3;
            ctx.setLineDash([10, 5]);
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(targetX, this.y);
            ctx.stroke();
            ctx.setLineDash([]);
            
            // Show destination indicator
            ctx.fillStyle = '#ff0000';
            ctx.globalAlpha = 0.5;
            ctx.fillRect(targetX - this.width/2, this.y - this.height/2, this.width, this.height);
            ctx.restore();
        }
    }
}

