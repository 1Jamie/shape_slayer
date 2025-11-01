// Diamond enemy - assassin type

class DiamondEnemy extends EnemyBase {
    constructor(x, y) {
        super(x, y);
        
        // Stats
        this.size = 18;
        this.maxHp = 35;
        this.hp = 35;
        this.damage = 6;
        this.moveSpeed = 100; // Slower movement
        this.baseMoveSpeed = 100; // Store for stun system
        
        // Properties
        this.color = '#00ffff'; // Cyan
        this.shape = 'diamond';
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
        this.weaveTimer = Math.random() * Math.PI * 2; // Random starting phase for weaving
        this.weaveSpeed = 3.0; // Speed of F weaving motion
        this.weaveAmplitude = 30; // How far to weave perpendicular to movement
    }
    
    update(deltaTime, player) {
        if (!this.alive || !player.alive) return;
        
        // Process stun first
        this.processStun(deltaTime);
        
        // Apply stun slow factor to movement speed
        if (this.stunned) {
            this.moveSpeed = this.baseMoveSpeed * this.stunSlowFactor;
        } else {
            this.moveSpeed = this.baseMoveSpeed;
        }
        
        // Update attack cooldown (slower when stunned)
        if (this.attackCooldown > 0) {
            const cooldownDelta = this.stunned ? deltaTime * this.stunSlowFactor : deltaTime;
            this.attackCooldown -= cooldownDelta;
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
        
        // Get enemies array for AI behaviors
        const enemies = (typeof Game !== 'undefined' && Game.enemies) ? Game.enemies : [];
        
        // AI behavior based on state
        if (this.state === 'circle') {
            // Check if close enough to attack
            if (distance < this.attackRange && this.attackCooldown <= 0) {
                // Stop moving and start telegraph
                this.state = 'telegraph';
                this.telegraphElapsed = 0;
            } else {
                // Circle around player with zigzag weaving and attack avoidance
                this.circleAngle += deltaTime * 0.8; // Slower rotation around player
                this.weaveTimer += deltaTime * this.weaveSpeed; // Update weaving timer
                
                const orbitDistance = 150; // Orbit further from player
                const angle = this.circleAngle;
                
                // Calculate desired orbit position
                const desiredX = targetX + Math.cos(angle) * orbitDistance;
                const desiredY = targetY + Math.sin(angle) * orbitDistance;
                
                // Move toward the orbit position
                const toOrbitX = desiredX - this.x;
                const toOrbitY = desiredY - this.y;
                const toOrbitDist = Math.sqrt(toOrbitX * toOrbitX + toOrbitY * toOrbitY);
                
                if (toOrbitDist > 1) {
                    // Base movement toward orbit
                    let moveX = toOrbitX / toOrbitDist;
                    let moveY = toOrbitY / toOrbitDist;
                    
                    // Add perpendicular weaving (sine wave perpendicular to movement direction)
                    const perpX = -moveY; // Perpendicular vector
                    const perpY = moveX;
                    const weaveOffset = Math.sin(this.weaveTimer) * this.weaveAmplitude;
                    
                    // Apply attack avoidance
                    const avoidance = this.avoidPlayerAttacks(player, 80);
                    const avoidDist = Math.sqrt(avoidance.x * avoidance.x + avoidance.y * avoidance.y);
                    
                    if (avoidDist > 0) {
                        const avoidNormX = avoidance.x / avoidDist;
                        const avoidNormY = avoidance.y / avoidDist;
                        const avoidStrength = Math.min(avoidDist, 150) / 150;
                        
                        // Blend movement with avoidance (70% movement, 30% avoidance)
                        moveX = moveX * 0.7 + avoidNormX * 0.3 * avoidStrength;
                        moveY = moveY * 0.7 + avoidNormY * 0.3 * avoidStrength;
                        
                        // Renormalize
                        const moveDist = Math.sqrt(moveX * moveX + moveY * moveY);
                        if (moveDist > 0) {
                            moveX /= moveDist;
                            moveY /= moveDist;
                        }
                    }
                    
                    // Apply movement with weaving
                    this.x += moveX * this.moveSpeed * deltaTime;
                    this.y += moveY * this.moveSpeed * deltaTime;
                    
                    // Add perpendicular weaving offset
                    this.x += perpX * weaveOffset * deltaTime * 0.3;
                    this.y += perpY * weaveOffset * deltaTime * 0.3;
                    
                    // Update rotation to face movement direction
                    if (moveX !== 0 || moveY !== 0) {
                        this.rotation = Math.atan2(moveY, moveX);
                    }
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
            // Dash toward predicted player position
            this.dashElapsed += deltaTime;
            
            // Predict where player will be when dash completes
            const timeToReach = this.dashDuration - this.dashElapsed;
            const predictedPos = this.predictPlayerPosition(player, timeToReach);
            
            // Calculate direction to predicted position
            const predDx = predictedPos.x - this.x;
            const predDy = predictedPos.y - this.y;
            const predDist = Math.sqrt(predDx * predDx + predDy * predDy);
            
            // Use predicted direction, fallback to current direction if invalid
            let dashDirX, dashDirY;
            if (predDist > 0) {
                dashDirX = predDx / predDist;
                dashDirY = predDy / predDist;
            } else {
                dashDirX = dx / distance;
                dashDirY = dy / distance;
            }
            
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
            
            // Update rotation to face dash direction
            this.rotation = Math.atan2(dashDirY, dashDirX);
            
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
                
                // Update rotation to face movement direction
                this.rotation = Math.atan2(awayDirY, awayDirX);
            }
        }
        
        // Resolve stacking with other enemies
        if (enemies.length > 0) {
            this.resolveStacking(enemies);
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
        
        // Draw facing direction indicator (white dot)
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(
            this.x + Math.cos(this.rotation) * (this.size + 5),
            this.y + Math.sin(this.rotation) * (this.size + 5),
            5, 0, Math.PI * 2
        );
        ctx.fill();
    }
}

