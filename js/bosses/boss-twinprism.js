// Twin Prism Boss - Room 15
// Two overlapping diamonds forming hourglass, alternating dash patterns

class BossTwinPrism extends BossBase {
    constructor(x, y) {
        super(x, y);
        
        // Boss name
        this.bossName = 'Twin Prism';
        
        // Twin diamond properties
        this.diamond1 = { x: x - 30, y: y, angle: 0 };
        this.diamond2 = { x: x + 30, y: y, angle: Math.PI / 2 };
        this.centerX = x;
        this.centerY = y;
        this.diamondSize = 50; // Size of each diamond
        this.rotationAngle = 0; // Rotation around center
        this.separation = 60; // Distance between diamonds
        
        // State machine
        this.state = 'chase'; // 'chase', 'dash', 'rotate', 'swap', 'sync', 'split', 'merge'
        this.stateTimer = 0;
        
        // Attack cooldowns
        this.dashCooldown = 0;
        this.rotateCooldown = 0;
        this.swapCooldown = 0;
        this.syncCooldown = 0;
        
        // Color swap tracking
        this.colorSwapActive = false;
        this.colorSwapTimer = 0;
        
        // Merge slam tracking
        this.mergeSlamActive = false;
        this.mergeSlamTimer = 0;
        this.oldSeparation = 60;
        
        // Override base stats
        this.size = 50; // Each diamond is 50px (doubled to 100 for collision)
        this.maxHp = 156; // BossBase will multiply by 5 (120 * 1.3 = 156 for 30% increase)
        this.hp = this.maxHp;
        this.damage = 10;
        this.moveSpeed = 150;
        this.color = '#ff00ff'; // Magenta
        
        // Add weak point at center connection
        this.addWeakPoint(0, 0, 10, 0);
    }
    
    update(deltaTime, player) {
        if (!this.introComplete) return;
        if (!this.alive || !player || !player.alive) return;
        
        this.processKnockback(deltaTime);
        this.checkPhaseTransition();
        this.updateHazards(deltaTime);
        this.checkHazardCollisions(player, deltaTime);
        this.updateWeakPoints(deltaTime);
        
        // Update center position (boss position is center)
        this.centerX = this.x;
        this.centerY = this.y;
        
        // Update cooldowns
        this.dashCooldown -= deltaTime;
        this.rotateCooldown -= deltaTime;
        this.swapCooldown -= deltaTime;
        this.syncCooldown -= deltaTime;
        this.stateTimer += deltaTime;
        
        // Update color swap
        if (this.colorSwapActive) {
            this.colorSwapTimer += deltaTime;
            if (this.colorSwapTimer >= 0.3) {
                this.colorSwapActive = false;
                this.colorSwapTimer = 0;
            }
        }
        
        // Phase-based behavior
        if (this.phase === 1) {
            this.updatePhase1(deltaTime, player);
        } else if (this.phase === 2) {
            this.updatePhase2(deltaTime, player);
        } else {
            this.updatePhase3(deltaTime, player);
        }
        
        // Update diamond positions
        this.updateDiamondPositions(deltaTime);
        
        this.keepInBounds();
    }
    
    updateDiamondPositions(deltaTime) {
        // Diamonds orbit around center
        const angle1 = this.rotationAngle;
        const angle2 = this.rotationAngle + Math.PI;
        
        this.diamond1.x = this.centerX + Math.cos(angle1) * (this.separation / 2);
        this.diamond1.y = this.centerY + Math.sin(angle1) * (this.separation / 2);
        this.diamond1.angle = angle1;
        
        this.diamond2.x = this.centerX + Math.cos(angle2) * (this.separation / 2);
        this.diamond2.y = this.centerY + Math.sin(angle2) * (this.separation / 2);
        this.diamond2.angle = angle2;
    }
    
    updatePhase1(deltaTime, player) {
        const distance = Math.sqrt((player.x - this.x) ** 2 + (player.y - this.y) ** 2);
        
        if (this.state === 'chase') {
            // Move center toward player
            const dx = player.x - this.x;
            const dy = player.y - this.y;
            if (distance > 0) {
                this.x += (dx / distance) * this.moveSpeed * deltaTime * 0.4;
                this.y += (dy / distance) * this.moveSpeed * deltaTime * 0.4;
            }
            
            // Choose attack
            if (this.dashCooldown <= 0 && distance < 250) {
                this.state = 'dash';
                this.stateTimer = 0;
            } else if (this.rotateCooldown <= 0 && distance < 200) {
                this.state = 'rotate';
                this.stateTimer = 0;
            } else if (this.swapCooldown <= 0) {
                this.state = 'swap';
                this.stateTimer = 0;
            } else if (this.syncCooldown <= 0 && distance < 180) {
                this.state = 'sync';
                this.stateTimer = 0;
            }
        } else if (this.state === 'dash') {
            // Alternating dash pattern
            if (this.stateTimer < 0.5) {
                // Dash diamond 1
                this.dualDashPattern(true);
            } else if (this.stateTimer < 1.0) {
                // Dash diamond 2
                this.dualDashPattern(false);
            } else {
                this.state = 'chase';
                this.dashCooldown = 5.0;
            }
        } else if (this.state === 'rotate') {
            // Rotation attack
            if (this.stateTimer < 2.0) {
                this.rotationAngle += Math.PI * 2 * deltaTime; // Full rotation per second
                // Both diamonds spin around center
            } else {
                this.state = 'chase';
                this.rotateCooldown = 6.0;
            }
        } else if (this.state === 'swap') {
            // Color swap (position swap)
            if (this.stateTimer < 0.2) {
                // Pause before swap
                this.colorSwapActive = true;
            } else if (this.stateTimer < 0.4) {
                // Swap positions
                const temp = { ...this.diamond1 };
                this.diamond1 = { ...this.diamond2 };
                this.diamond2 = temp;
                this.colorSwapActive = false;
            } else {
                this.state = 'chase';
                this.swapCooldown = 7.0;
            }
        } else if (this.state === 'sync') {
            // Synchronized strike (both dash simultaneously)
            if (this.stateTimer < 0.3) {
                this.synchronizedStrike(player);
            } else {
                this.state = 'chase';
                this.syncCooldown = 6.0;
            }
        }
    }
    
    updatePhase2(deltaTime, player) {
        // Faster rotation, split attack, more frequent swaps
        const distance = Math.sqrt((player.x - this.x) ** 2 + (player.y - this.y) ** 2);
        
        if (this.state === 'chase') {
            const dx = player.x - this.x;
            const dy = player.y - this.y;
            if (distance > 0) {
                this.x += (dx / distance) * this.moveSpeed * deltaTime * 0.5;
                this.y += (dy / distance) * this.moveSpeed * deltaTime * 0.5;
            }
            
            if (this.dashCooldown <= 0) {
                this.state = 'split';
                this.stateTimer = 0;
            } else if (this.swapCooldown <= 0) {
                this.state = 'swap';
                this.stateTimer = 0;
                this.swapCooldown = 4.0; // More frequent
            }
        } else if (this.state === 'split') {
            // Split attack: separate to edges, dash toward each other
            if (this.stateTimer < 0.5) {
                // Separate diamonds to edges
                this.separation = 300;
            } else if (this.stateTimer < 1.0) {
                // Dash toward center (and each other)
                const centerDx = this.x - this.diamond1.x;
                const centerDy = this.y - this.diamond1.y;
                const dist = Math.sqrt(centerDx * centerDx + centerDy * centerDy);
                if (dist > 0) {
                    this.diamond1.x += (centerDx / dist) * 400 * deltaTime;
                    this.diamond1.y += (centerDy / dist) * 400 * deltaTime;
                    this.diamond2.x -= (centerDx / dist) * 400 * deltaTime;
                    this.diamond2.y -= (centerDy / dist) * 400 * deltaTime;
                }
                // Create dash trail
                this.createDamageZone(this.diamond1.x, this.diamond1.y, 30, 0.5, this.damage * 0.5);
                this.createDamageZone(this.diamond2.x, this.diamond2.y, 30, 0.5, this.damage * 0.5);
            } else {
                this.state = 'chase';
                this.separation = 60;
                this.dashCooldown = 4.0;
            }
        }
        
        // Faster rotation when in rotate state
        if (this.state === 'rotate') {
            this.rotationAngle += Math.PI * 4 * deltaTime; // 2x faster
            if (this.stateTimer > 1.5) {
                this.state = 'chase';
                this.rotateCooldown = 4.0;
            }
        }
    }
    
    updatePhase3(deltaTime, player) {
        // Frenzy mode: constant spinning + dashing
        this.rotationAngle += Math.PI * 6 * deltaTime; // Very fast rotation
        
        const distance = Math.sqrt((player.x - this.x) ** 2 + (player.y - this.y) ** 2);
        
        if (this.stateTimer % 1.0 < 0.3) {
            // Frequent dashes
            this.dualDashPattern(this.stateTimer % 2.0 < 1.0);
        }
        
        // Occasionally merge form for slam (every 5 seconds)
        if (Math.floor(this.stateTimer) % 5 === 0 && this.stateTimer % 5.0 < 0.2 && !this.mergeSlamActive) {
            this.mergedFormSlam(player);
        }
        
        // Update merge slam if active
        if (this.mergeSlamActive) {
            this.mergeSlamTimer += deltaTime;
            if (this.mergeSlamTimer >= 0.2) {
                this.createShockwave(this.x, this.y, 120, 0.6, this.damage * 1.5);
                this.separation = this.oldSeparation;
                this.mergeSlamActive = false;
                this.mergeSlamTimer = 0;
            }
        }
        
        // Chase player
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        if (distance > 0) {
            this.x += (dx / distance) * this.moveSpeed * deltaTime * 0.6;
            this.y += (dy / distance) * this.moveSpeed * deltaTime * 0.6;
        }
    }
    
    // Alternating dash pattern
    dualDashPattern(diamond1) {
        if (typeof Game === 'undefined' || !Game.player) return;
        
        const target = diamond1 ? this.diamond1 : this.diamond2;
        const player = Game.player;
        
        const dx = player.x - target.x;
        const dy = player.y - target.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 0) {
            const dashSpeed = 500;
            const dashX = (dx / distance) * dashSpeed;
            const dashY = (dy / distance) * dashSpeed;
            
            // Update diamond position (dash)
            if (diamond1) {
                this.diamond1.x += dashX * 0.2; // Dash distance
                this.diamond1.y += dashY * 0.2;
            } else {
                this.diamond2.x += dashX * 0.2;
                this.diamond2.y += dashY * 0.2;
            }
            
            // Create dash trail
            this.createDamageZone(target.x, target.y, 40, 0.6, this.damage * 0.8);
        }
    }
    
    // Synchronized strike (both dash simultaneously)
    synchronizedStrike(player) {
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 0) {
            const dirX = dx / distance;
            const dirY = dy / distance;
            
            // Both diamonds dash toward player, converging
            this.diamond1.x += dirX * 100;
            this.diamond1.y += dirY * 100;
            this.diamond2.x -= dirX * 100;
            this.diamond2.y -= dirY * 100;
            
            // Create converging damage zones
            this.createDamageZone(this.diamond1.x, this.diamond1.y, 50, 0.4, this.damage * 1.2);
            this.createDamageZone(this.diamond2.x, this.diamond2.y, 50, 0.4, this.damage * 1.2);
        }
    }
    
    // Merged form slam
    mergedFormSlam(player) {
        // Brief merge into large shape
        this.mergeSlamActive = true;
        this.mergeSlamTimer = 0;
        this.oldSeparation = this.separation;
        this.separation = 0; // Merge
    }
    
    render(ctx) {
        if (!this.alive) return;
        
        // Render two diamonds
        this.renderDiamond(ctx, this.diamond1, '#ff00ff');
        this.renderDiamond(ctx, this.diamond2, '#ff88ff');
        
        // Render center weak point (visible when separated)
        if (this.separation > 40) {
            this.renderWeakPoints(ctx);
        } else if (this.colorSwapActive) {
            // Glow brighter during color swap
            const wp = this.weakPoints[0];
            if (wp) {
                ctx.save();
                const wpX = this.x + wp.offsetX;
                const wpY = this.y + wp.offsetY;
                const glow = Math.sin(Date.now() / 50) * 0.5 + 1.0;
                
                ctx.globalAlpha = 0.5 * glow;
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(wpX, wpY, wp.radius * 1.5, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.restore();
            }
        }
        
        // Render hazards
        this.renderHazards(ctx);
        
        // Render health bar
        this.renderHealthBar(ctx);
    }
    
    renderDiamond(ctx, diamond, color) {
        ctx.save();
        ctx.translate(diamond.x, diamond.y);
        ctx.rotate(diamond.angle);
        
        const visualSize = this.diamondSize; // Visual size
        
        ctx.fillStyle = this.colorSwapActive ? '#ffff00' : color;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        
        ctx.beginPath();
        // Draw diamond (rotated square)
        ctx.moveTo(0, -visualSize);
        ctx.lineTo(visualSize, 0);
        ctx.lineTo(0, visualSize);
        ctx.lineTo(-visualSize, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        ctx.restore();
    }
}

