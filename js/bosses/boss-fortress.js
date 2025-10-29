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
        this.moveSpeed = 60;
        this.color = '#8b4513';
        
        this.state = 'chase';
        this.stateTimer = 0;
        this.slamCooldown = 0;
        this.spikeCooldown = 0;
        this.wallPushCooldown = 0;
        this.summonCooldown = 0;
        
        this.chargingSlam = false;
        this.chargeElapsed = 0;
        this.cornerSpikes = [false, false, false, false]; // 4 corners
        this.spikeTimer = 0;
        
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
            if (this.chargeElapsed >= 1.5) {
                this.chargingSlam = false;
                this.chargeElapsed = 0;
                this.createShockwave(this.x, this.y, 150, 1.0, this.damage * 2);
                if (typeof Game !== 'undefined') Game.triggerScreenShake(8, 0.4);
                this.slamCooldown = 8.0;
            }
        } else if (this.state === 'chase') {
            const dx = player.x - this.x;
            const dy = player.y - this.y;
            if (distance > 0) {
                this.x += (dx / distance) * this.moveSpeed * deltaTime * 0.3;
                this.y += (dy / distance) * this.moveSpeed * deltaTime * 0.3;
            }
            
            if (this.slamCooldown <= 0 && distance < 120) {
                this.chargingSlam = true;
            } else if (this.spikeCooldown <= 0) {
                this.cornerSpikes();
                this.spikeCooldown = 6.0;
            } else if (this.wallPushCooldown <= 0 && distance < 200) {
                this.wallPush();
                this.wallPushCooldown = 10.0;
            } else if (this.summonCooldown <= 0) {
                this.summonGuards();
                this.summonCooldown = 12.0;
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
            if (this.chargeElapsed >= 1.2) {
                this.createShockwave(this.x, this.y, 180, 1.2, this.damage * 2.2);
                if (typeof Game !== 'undefined') Game.triggerScreenShake(8, 0.4);
                this.chargeElapsed = 0;
                if (this.stateTimer % 2.0 >= 1.5) {
                    this.chargingSlam = false;
                    this.slamCooldown = 5.0;
                }
            }
        }
        
        if (this.spikeCooldown <= 0) {
            this.fullSpikeBurst();
            this.spikeCooldown = 5.0;
        }
        
        // Chase player
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > 0) {
            this.x += (dx / distance) * this.moveSpeed * deltaTime * 0.4;
            this.y += (dy / distance) * this.moveSpeed * deltaTime * 0.4;
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
        } else if (this.stateTimer % 3.0 < 0.5) {
            // Fortress storm - shoot projectiles while moving
            if (typeof Game !== 'undefined' && typeof Game.player !== 'undefined') {
                const dx = Game.player.x - this.x;
                const dy = Game.player.y - this.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > 0 && this.stateTimer % 0.3 < 0.05) {
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
    
    cornerSpikes() {
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
                corner.x + dir.x * 60,
                corner.y + dir.y * 60,
                40, 0.8, this.damage * 1.2
            );
        });
    }
    
    fullSpikeBurst() {
        this.cornerSpikes();
        // All spikes extend and spin
        for (let i = 0; i < 8; i++) {
            const angle = (Math.PI * 2 / 8) * i;
            const dist = 100;
            this.createDamageZone(
                this.x + Math.cos(angle) * dist,
                this.y + Math.sin(angle) * dist,
                35, 1.0, this.damage * 1.0
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
        // Create push damage zone
        this.createDamageZone(this.x, this.y, 80, 2.0, this.damage * 1.5);
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
    
    render(ctx) {
        if (!this.alive) return;
        
        ctx.save();
        ctx.translate(this.x, this.y);
        
        // Draw rectangle with crenellations
        const w = this.width;
        const h = this.height;
        const notchSize = 10;
        
        ctx.fillStyle = this.color;
        ctx.strokeStyle = '#ffffff';
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
        
        this.renderWeakPoints(ctx);
        this.renderHazards(ctx);
        this.renderHealthBar(ctx);
    }
}

