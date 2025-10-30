// Rectangle enemy - brute type

class RectangleEnemy extends EnemyBase {
    constructor(x, y) {
        super(x, y);
        
        // Stats
        this.width = 25;
        this.height = 40;
        this.size = Math.max(this.width, this.height);
        this.maxHp = 60;
        this.hp = 60;
        this.damage = 8;
        this.moveSpeed = 60;
        
        // Properties
        this.color = '#cd7f32'; // Bronze
        this.xpValue = 25;
        this.lootChance = 0.4;
        
        // Attack system
        this.state = 'chase'; // 'chase', 'charge', 'slam'
        this.attackCooldown = 0;
        this.chargeDuration = 1.2; // Slightly longer telegraph for clarity
        this.slamDuration = 0.3;
        this.chargeElapsed = 0;
        this.slamElapsed = 0;
        this.attackRange = 80;
        this.slamRadius = 80;
        this.sizeMultiplier = 1.0;
    }
    
    update(deltaTime, player) {
        if (!this.alive || !player.alive) return;
        
        if (this.attackCooldown > 0) {
            this.attackCooldown -= deltaTime;
        }
        
        // Get target (handles decoy/clone logic)
        const target = this.findTarget(player);
        const targetX = target.x;
        const targetY = target.y;
        
        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance <= 0) return;
        
        // Apply knockback
        this.processKnockback(deltaTime);
        
        // Get enemies array for AI behaviors
        const enemies = (typeof Game !== 'undefined' && Game.enemies) ? Game.enemies : [];
        
        // AI behavior
        if (this.state === 'chase') {
            // Check if in range and cooldown ready
            if (distance < this.attackRange && this.attackCooldown <= 0) {
                // Avoid starting charge if player is actively attacking (gives player time to react)
                const avoidance = this.avoidPlayerAttacks(player, 100);
                const avoidDist = Math.sqrt(avoidance.x * avoidance.x + avoidance.y * avoidance.y);
                
                // If player is attacking nearby, wait and move away instead of charging
                if (avoidDist > 50) {
                    // Move away slightly to avoid interrupting player's attack
                    const dirX = dx / distance;
                    const dirY = dy / distance;
                    const avoidNormX = avoidance.x / avoidDist;
                    const avoidNormY = avoidance.y / avoidDist;
                    
                    // Blend movement with avoidance
                    let moveX = dirX * 0.7 + avoidNormX * 0.3;
                    let moveY = dirY * 0.7 + avoidNormY * 0.3;
                    const moveDist = Math.sqrt(moveX * moveX + moveY * moveY);
                    if (moveDist > 0) {
                        moveX /= moveDist;
                        moveY /= moveDist;
                    }
                    
                    this.x += moveX * this.moveSpeed * deltaTime;
                    this.y += moveY * this.moveSpeed * deltaTime;
                } else {
                    // No player attacks nearby (or very weak), start charge normally
                    this.state = 'charge';
                    this.chargeElapsed = 0;
                    this.sizeMultiplier = 1.0;
                }
            } else {
                // Slow chase toward player with separation
                const separation = this.getSeparationForce(enemies, 45, 100);
                const dirX = dx / distance;
                const dirY = dy / distance;
                
                let moveX = dirX;
                let moveY = dirY;
                
                // Apply separation
                const sepDist = Math.sqrt(separation.x * separation.x + separation.y * separation.y);
                if (sepDist > 0) {
                    const sepNormX = separation.x / sepDist;
                    const sepNormY = separation.y / sepDist;
                    const sepStrength = Math.min(sepDist, 80) / 80;
                    
                    moveX = moveX * 0.9 + sepNormX * 0.1 * sepStrength;
                    moveY = moveY * 0.9 + sepNormY * 0.1 * sepStrength;
                    
                    const finalDist = Math.sqrt(moveX * moveX + moveY * moveY);
                    if (finalDist > 0) {
                        moveX /= finalDist;
                        moveY /= finalDist;
                    }
                }
                
                this.x += moveX * this.moveSpeed * deltaTime;
                this.y += moveY * this.moveSpeed * deltaTime;
            }
        } else if (this.state === 'charge') {
            // Grow larger during charge
            this.chargeElapsed += deltaTime;
            this.sizeMultiplier = 1.0 + (this.chargeElapsed / this.chargeDuration) * 0.5;
            
            if (this.chargeElapsed >= this.chargeDuration) {
                // Perform slam - damage enemies in radius
                if (typeof Game !== 'undefined') {
                    const distToPlayer = Math.sqrt((player.x - this.x) ** 2 + (player.y - this.y) ** 2);
                    if (distToPlayer < this.slamRadius && !player.invulnerable) {
                        player.takeDamage(this.damage);
                    }
                }
                this.state = 'cooldown';
                this.attackCooldown = 3.0;
                this.chargeElapsed = 0;
                this.sizeMultiplier = 1.0;
            }
        } else if (this.state === 'cooldown') {
            if (this.attackCooldown <= 0) {
                this.state = 'chase';
            }
        }
        
        // Resolve stacking with other enemies
        if (enemies.length > 0) {
            this.resolveStacking(enemies);
        }
        
        // Safety check: ensure position is valid (prevent NaN/Infinity)
        if (!isFinite(this.x) || !isFinite(this.y)) {
            // Reset to a safe position if invalid
            if (typeof Game !== 'undefined') {
                this.x = isFinite(this.x) ? Math.max(50, Math.min(Game.canvas.width - 50, this.x)) : 400;
                this.y = isFinite(this.y) ? Math.max(50, Math.min(Game.canvas.height - 50, this.y)) : 300;
            } else {
                this.x = isFinite(this.x) ? this.x : 400;
                this.y = isFinite(this.y) ? this.y : 300;
            }
        }
        
        // Keep within bounds
        this.keepInBounds();
    }
    
    render(ctx) {
        // Draw rectangle shape
        ctx.save();
        ctx.translate(this.x, this.y);
        
        let drawColor = this.color;
        if (this.state === 'charge') {
            drawColor = '#8b0000'; // Dark red when charging
        }
        
        ctx.fillStyle = drawColor;
        ctx.beginPath();
        ctx.rect(-this.width * this.sizeMultiplier * 0.8, -this.height * this.sizeMultiplier * 0.8, 
                 this.width * this.sizeMultiplier * 1.6, this.height * this.sizeMultiplier * 1.6);
        ctx.fill();
        
        ctx.restore();
        
        // Draw slam AoE indicator with pulsing effect
        if (this.state === 'charge') {
            ctx.save();
            
            // Calculate pulse intensity (0 to 1 based on charge progress)
            const chargeProgress = this.chargeElapsed / this.chargeDuration;
            const pulseIntensity = 0.3 + (Math.sin(chargeProgress * Math.PI * 8) * 0.5 + 0.5) * 0.7; // Pulse faster as charge progresses
            
            // Outer warning ring (bright red, pulsing)
            ctx.strokeStyle = `rgba(255, 0, 0, ${pulseIntensity * 0.8})`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.slamRadius, 0, Math.PI * 2);
            ctx.stroke();
            
            // Inner fill (semi-transparent red, pulsing)
            ctx.fillStyle = `rgba(255, 0, 0, ${pulseIntensity * 0.2})`;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.slamRadius, 0, Math.PI * 2);
            ctx.fill();
            
            // Additional bright flash at high charge
            if (chargeProgress > 0.7) {
                const flashAlpha = (chargeProgress - 0.7) / 0.3;
                ctx.strokeStyle = `rgba(255, 255, 0, ${flashAlpha * 0.9})`;
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.slamRadius, 0, Math.PI * 2);
                ctx.stroke();
            }
            
            ctx.restore();
        }
        
        this.renderHealthBar(ctx);
    }
}

