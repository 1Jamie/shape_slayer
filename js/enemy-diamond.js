// Diamond enemy - assassin type

class DiamondEnemy extends EnemyBase {
    constructor(x, y) {
        super(x, y);
        
        // Stats
        this.size = 18;
        this.maxHp = 25;
        this.hp = 25;
        this.damage = 6;
        this.moveSpeed = 100; // Slower movement
        
        // Properties
        this.color = '#00ffff'; // Cyan
        this.xpValue = 15;
        this.lootChance = 0.35;
        
        // Attack system
        this.state = 'circle'; // 'circle', 'telegraph', 'dash', 'cooldown'
        this.attackCooldown = 0;
        this.attackCooldownTime = 2.0;
        this.telegraphDuration = 0.15; // Shorter telegraph
        this.dashDuration = 0.35; // Longer dash to reach from 180px away
        this.telegraphElapsed = 0;
        this.dashElapsed = 0;
        this.attackRange = 180; // Dash when within this range (10% less)
        this.dashSpeed = 600; // Faster dash
        this.circleAngle = 0; // Angle for circling movement
    }
    
    update(deltaTime, player) {
        if (!this.alive || !player.alive) return;
        
        // Update attack cooldown
        if (this.attackCooldown > 0) {
            this.attackCooldown -= deltaTime;
        }
        
        // Get target (handles decoy/clone logic)
        const target = this.findTarget(player);
        const targetX = target.x;
        const targetY = target.y;
        
        // Calculate direction and distance
        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance <= 0) return;
        
        // Apply knockback first
        this.processKnockback(deltaTime);
        
        // AI behavior based on state
        if (this.state === 'circle') {
            // Check if close enough to attack
            if (distance < this.attackRange && this.attackCooldown <= 0) {
                // Stop moving and start telegraph
                this.state = 'telegraph';
                this.telegraphElapsed = 0;
            } else {
                // Circle around player - move smoothly toward orbit position
                this.circleAngle += deltaTime * 0.8; // Slower rotation around player
                
                const orbitDistance = 150; // Orbit further from player
                const angle = this.circleAngle;
                
                // Calculate desired orbit position
                const desiredX = targetX + Math.cos(angle) * orbitDistance;
                const desiredY = targetY + Math.sin(angle) * orbitDistance;
                
                // Move toward the orbit position smoothly but slower
                const toOrbitX = desiredX - this.x;
                const toOrbitY = desiredY - this.y;
                const toOrbitDist = Math.sqrt(toOrbitX * toOrbitX + toOrbitY * toOrbitY);
                
                if (toOrbitDist > 1) {
                    this.x += (toOrbitX / toOrbitDist) * this.moveSpeed * deltaTime;
                    this.y += (toOrbitY / toOrbitDist) * this.moveSpeed * deltaTime;
                }
            }
        } else if (this.state === 'telegraph') {
            // Stay in place during telegraph (acts as visual telegraph)
            this.telegraphElapsed += deltaTime;
            if (this.telegraphElapsed >= this.telegraphDuration) {
                this.state = 'dash';
                this.dashElapsed = 0;
            }
        } else if (this.state === 'dash') {
            // Dash toward player
            this.dashElapsed += deltaTime;
            const dashDirX = dx / distance;
            const dashDirY = dy / distance;
            
            // Check if player has active shield blocking the dash
            let newX = this.x + dashDirX * this.dashSpeed * deltaTime;
            let newY = this.y + dashDirY * this.dashSpeed * deltaTime;
            
            if (typeof Game !== 'undefined' && Game.player && Game.player.shieldActive) {
                const shieldStart = Game.player.size + 5;
                const shieldDepth = 20;
                const shieldWidth = 60; // Half width
                
                // Raycast from current position to new position
                const hit = Game.raycastCheckShield(
                    this.x, this.y, newX, newY,
                    shieldStart, shieldDepth, shieldWidth,
                    Game.player.x, Game.player.y, Game.player.rotation
                );
                
                if (hit) {
                    // Shield blocked the dash, stop at intersection
                    newX = hit.x;
                    newY = hit.y;
                    
                    // End dash early
                    this.state = 'cooldown';
                    this.attackCooldown = this.attackCooldownTime;
                    this.telegraphElapsed = 0;
                    this.dashElapsed = 0;
                    
                    // Create impact particle effect
                    if (typeof createParticleBurst !== 'undefined') {
                        createParticleBurst(hit.x, hit.y, '#00ffff', 8);
                    }
                }
            }
            
            this.x = newX;
            this.y = newY;
            
            if (this.dashElapsed >= this.dashDuration) {
                this.state = 'cooldown';
                this.attackCooldown = this.attackCooldownTime;
                this.telegraphElapsed = 0;
                this.dashElapsed = 0;
            }
        } else if (this.state === 'cooldown') {
            // Move away from player during cooldown
            if (this.attackCooldown <= 0) {
                this.state = 'circle';
            } else {
                // Move away from player during cooldown
                const awayDirX = -dx / distance;
                const awayDirY = -dy / distance;
                this.x += awayDirX * this.moveSpeed * 0.5 * deltaTime;
                this.y += awayDirY * this.moveSpeed * 0.5 * deltaTime;
            }
        }
        
        // Keep within bounds
        this.keepInBounds();
    }
    
    render(ctx) {
        let drawColor = this.color;
        
        if (this.state === 'telegraph') {
            const flash = Math.sin(this.telegraphElapsed * 20) > 0;
            drawColor = flash ? '#ff0000' : '#00ffff';
        } else if (this.state === 'dash') {
            drawColor = '#ffffff';
        }
        
        // Draw diamond shape (rotated square)
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(Math.PI / 4); // Rotate 45 degrees
        
        ctx.fillStyle = drawColor;
        ctx.beginPath();
        ctx.rect(-this.size * 0.8, -this.size * 0.8, this.size * 1.6, this.size * 1.6);
        ctx.fill();
        
        ctx.restore();
        
        this.renderHealthBar(ctx);
    }
}

