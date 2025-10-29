// Star enemy - ranged enemy type

class StarEnemy extends EnemyBase {
    constructor(x, y) {
        super(x, y);
        
        // Stats
        this.size = 22;
        this.maxHp = 40;
        this.hp = 40;
        this.damage = 8;
        this.moveSpeed = 80;
        
        // Properties
        this.color = '#ffcc00'; // Yellow
        this.xpValue = 20;
        this.lootChance = 0.35;
        
        // Shooting system
        this.attackCooldown = 0;
        this.attackCooldownTime = 2.0;
        this.shootRange = 175; // Ideal distance (150-200)
        this.minRange = 100;
        this.maxRange = 200;
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
        
        // Calculate direction from enemy to target
        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Avoid division by zero
        if (distance <= 0) return;
        
        // Apply knockback first (before any AI movement)
        this.processKnockback(deltaTime);
        
        // Distance-based AI
        if (distance < this.minRange) {
            // Too close - move away
            const awayDirX = -dx / distance;
            const awayDirY = -dy / distance;
            this.x += awayDirX * this.moveSpeed * deltaTime;
            this.y += awayDirY * this.moveSpeed * deltaTime;
        } else if (distance > this.maxRange) {
            // Too far - move closer
            const towardDirX = dx / distance;
            const towardDirY = dy / distance;
            this.x += towardDirX * this.moveSpeed * deltaTime;
            this.y += towardDirY * this.moveSpeed * deltaTime;
        } else {
            // Right distance - try to shoot
            if (this.attackCooldown <= 0) {
                this.shoot(player);
                this.attackCooldown = this.attackCooldownTime;
            }
        }
        
        // Keep enemy within canvas bounds
        this.keepInBounds();
    }
    
    shoot(player) {
        // Calculate direction to player
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance <= 0) return;
        
        // Normalize direction
        const dirX = dx / distance;
        const dirY = dy / distance;
        
        // Spawn projectile
        const projectileSpeed = 200;
        Game.projectiles.push({
            x: this.x,
            y: this.y,
            vx: dirX * projectileSpeed,
            vy: dirY * projectileSpeed,
            damage: this.damage,
            size: 5,
            lifetime: 3.0,
            elapsed: 0
        });
    }
    
    render(ctx) {
        // Draw star enemy (as circle for now, could be upgraded later)
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw outline
        ctx.strokeStyle = '#ffaa00';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.stroke();
        
        // Draw health bar
        this.renderHealthBar(ctx);
    }
}

