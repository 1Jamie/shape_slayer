// Environmental Hazard System
// Base class and specific hazard types for boss battles

// Base Environmental Hazard class
class EnvironmentalHazard {
    constructor(x, y, radius, maxRadius, damage, lifetime, type) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.maxRadius = maxRadius || radius;
        this.damage = damage;
        this.lifetime = lifetime;
        this.elapsed = 0;
        this.expired = false;
        this.type = type;
        this.hasHitPlayer = false;
        this.lastDamageTime = 0;
    }
    
    update(deltaTime) {
        this.elapsed += deltaTime;
        
        if (this.elapsed >= this.lifetime) {
            this.expired = true;
        }
    }
    
    render(ctx) {
        // Base rendering - subclasses override
    }
    
    checkCollision(player) {
        if (!player || !player.alive || player.invulnerable) return false;
        
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        return dist < (this.radius + player.size);
    }
}

// Shockwave Hazard - Expanding ring, one-time damage
class ShockwaveHazard extends EnvironmentalHazard {
    constructor(x, y, maxRadius, duration, damage) {
        super(x, y, 0, maxRadius, damage, duration, 'shockwave');
    }
    
    update(deltaTime) {
        super.update(deltaTime);
        
        // Expand radius over lifetime
        if (this.radius < this.maxRadius) {
            const expandRate = this.maxRadius / this.lifetime;
            this.radius = Math.min(this.maxRadius, this.radius + expandRate * deltaTime);
        }
    }
    
    render(ctx) {
        ctx.save();
        
        // Expanding ring shockwave
        ctx.strokeStyle = '#ffaa00';
        ctx.lineWidth = 3;
        ctx.globalAlpha = 1.0 - (this.elapsed / this.lifetime);
        
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.restore();
    }
    
    // One-time damage on contact
    applyDamage(player) {
        if (this.hasHitPlayer) return false;
        if (this.checkCollision(player)) {
            player.takeDamage(this.damage);
            this.hasHitPlayer = true;
            return true;
        }
        return false;
    }
}

// Damage Zone Hazard - Static area, optional per-second damage
class DamageZoneHazard extends EnvironmentalHazard {
    constructor(x, y, radius, duration, damage, persistent = false) {
        super(x, y, radius, radius, damage, duration, 'damageZone');
        this.persistent = persistent; // If true, deals damage per second
    }
    
    render(ctx) {
        ctx.save();
        
        // Static damage zone
        ctx.fillStyle = '#ff0000';
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = '#ff6666';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.6;
        ctx.stroke();
        
        ctx.restore();
    }
    
    applyDamage(player) {
        if (!this.checkCollision(player)) return false;
        
        if (this.persistent) {
            // Deal damage per second
            const timeSinceLastDamage = this.elapsed - this.lastDamageTime;
            if (timeSinceLastDamage >= 1.0) {
                player.takeDamage(this.damage);
                this.lastDamageTime = this.elapsed;
                return true;
            }
        } else {
            // One-time damage
            if (!this.hasHitPlayer) {
                player.takeDamage(this.damage);
                this.hasHitPlayer = true;
                return true;
            }
        }
        return false;
    }
}

// Pull Field Hazard - Constant pull force toward center
class PullFieldHazard extends EnvironmentalHazard {
    constructor(x, y, radius, strength) {
        super(x, y, radius, radius, 0, Infinity, 'pullField');
        this.strength = strength || 50;
    }
    
    render(ctx) {
        ctx.save();
        
        // Pull field (subtle spiral effect)
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.4;
        
        const spiralAngle = Date.now() / 100; // Rotating spiral
        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius * (0.3 + i * 0.3), 
                    spiralAngle + i * Math.PI, spiralAngle + i * Math.PI + Math.PI * 1.5);
            ctx.stroke();
        }
        
        ctx.restore();
    }
    
    applyPull(player) {
        if (!this.checkCollision(player)) return false;
        
        // Apply pull force each frame
        if (player.applyPullForce) {
            player.applyPullForce(this.x, this.y, this.strength, this.radius);
            return true;
        }
        return false;
    }
}

// Debris Hazard - Temporary collision zones
class DebrisHazard extends EnvironmentalHazard {
    constructor(x, y, radius, duration, damage) {
        super(x, y, radius, radius, damage, duration, 'debris');
    }
    
    render(ctx) {
        ctx.save();
        
        // Debris (smaller, darker)
        ctx.fillStyle = '#666666';
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = '#888888';
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.7;
        ctx.stroke();
        
        ctx.restore();
    }
    
    applyDamage(player) {
        if (this.hasHitPlayer) return false;
        if (this.checkCollision(player)) {
            player.takeDamage(this.damage);
            this.hasHitPlayer = true;
            return true;
        }
        return false;
    }
}

