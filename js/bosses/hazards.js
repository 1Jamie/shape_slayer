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

    serialize() {
        return {
            type: this.type,
            x: this.x,
            y: this.y,
            radius: this.radius,
            maxRadius: this.maxRadius,
            damage: this.damage,
            lifetime: this.lifetime,
            elapsed: this.elapsed,
            expired: this.expired,
            hasHitPlayer: this.hasHitPlayer,
            lastDamageTime: this.lastDamageTime
        };
    }
}

function hydrateEnvironmentalHazard(hazard, state) {
    if (!state || !hazard) return hazard;
    if (state.radius !== undefined) hazard.radius = state.radius;
    if (state.elapsed !== undefined) hazard.elapsed = state.elapsed;
    if (state.expired !== undefined) hazard.expired = state.expired;
    if (state.hasHitPlayer !== undefined) hazard.hasHitPlayer = state.hasHitPlayer;
    if (state.lastDamageTime !== undefined) hazard.lastDamageTime = state.lastDamageTime;
    return hazard;
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

    static fromState(state) {
        const hazard = new ShockwaveHazard(
            state.x,
            state.y,
            state.maxRadius,
            state.lifetime,
            state.damage
        );
        return hydrateEnvironmentalHazard(hazard, state);
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

    serialize() {
        const base = super.serialize();
        return {
            ...base,
            persistent: this.persistent
        };
    }

    static fromState(state) {
        const hazard = new DamageZoneHazard(
            state.x,
            state.y,
            state.radius,
            state.lifetime,
            state.damage,
            state.persistent
        );
        return hydrateEnvironmentalHazard(hazard, state);
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

    serialize() {
        const base = super.serialize();
        return {
            ...base,
            strength: this.strength
        };
    }

    static fromState(state) {
        const hazard = new PullFieldHazard(
            state.x,
            state.y,
            state.radius,
            state.strength
        );
        return hydrateEnvironmentalHazard(hazard, state);
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

    static fromState(state) {
        const hazard = new DebrisHazard(
            state.x,
            state.y,
            state.radius,
            state.lifetime,
            state.damage
        );
        return hydrateEnvironmentalHazard(hazard, state);
    }
}

// Beam Hazard - Continuous beam attack (line segment with width)
class BeamHazard extends EnvironmentalHazard {
    constructor(x, y, options = {}) {
        const width = options.width || 60;
        const damagePerTick = options.damagePerTick !== undefined ? options.damagePerTick : (options.damage || 0);
        const lifetime = options.lifetime !== undefined ? options.lifetime :
            (options.duration !== undefined ? options.duration : 2.0);

        super(x, y, width / 2, width / 2, damagePerTick, lifetime, 'beam');

        this.length = options.length || 600;
        this.width = width;
        this.angle = options.angle !== undefined ? options.angle : 0;
        this.tickInterval = Math.max(0.016, options.tickInterval || 0.1);
        this.damagePerTick = damagePerTick;
        this.turnRate = options.turnRate !== undefined ? options.turnRate : Math.PI;
        this.followSource = options.followSource !== undefined ? options.followSource : true;
        this.trackPlayer = options.trackPlayer !== undefined ? options.trackPlayer : true;
        this.pendingTicks = 0;
        this.tickAccumulator = 0;
        this.sourceId = options.sourceId || null;
        this.originOffsetX = options.originOffsetX || 0;
        this.originOffsetY = options.originOffsetY || 0;
        this.lengthGrowthSpeed = options.lengthGrowthSpeed || 0;
        this.maxLength = options.maxLength || this.length;
    }

    update(deltaTime, context = {}) {
        super.update(deltaTime);

        const boss = context && context.boss ? context.boss : null;
        const targetPlayer = context && context.targetPlayer ? context.targetPlayer : null;

        if (boss && this.followSource) {
            this.x = boss.x + this.originOffsetX;
            this.y = boss.y + this.originOffsetY;
        }

        if (this.lengthGrowthSpeed !== 0 && this.length < this.maxLength) {
            this.length = Math.min(this.maxLength, this.length + this.lengthGrowthSpeed * deltaTime);
        }

        if (targetPlayer && this.trackPlayer) {
            const targetAngle = Math.atan2(targetPlayer.y - this.y, targetPlayer.x - this.x);
            let angleDiff = targetAngle - this.angle;
            angleDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));
            const maxTurn = this.turnRate * deltaTime;
            if (angleDiff > maxTurn) {
                angleDiff = maxTurn;
            } else if (angleDiff < -maxTurn) {
                angleDiff = -maxTurn;
            }
            this.angle += angleDiff;
        }

        this.tickAccumulator += deltaTime;
        while (this.tickAccumulator >= this.tickInterval) {
            this.tickAccumulator -= this.tickInterval;
            this.pendingTicks++;
        }
        if (this.pendingTicks > 5) {
            this.pendingTicks = 5;
        }
    }

    applyDamage(player) {
        if (this.pendingTicks <= 0) return false;
        if (!player || !player.alive || player.invulnerable) return false;
        if (!this.intersectsPlayer(player)) return false;

        this.pendingTicks--;
        player.takeDamage(this.damagePerTick);
        this.lastDamageTime = this.elapsed;
        return true;
    }

    intersectsPlayer(player) {
        if (!player) return false;
        const dirX = Math.cos(this.angle);
        const dirY = Math.sin(this.angle);

        const relX = player.x - this.x;
        const relY = player.y - this.y;
        const projection = relX * dirX + relY * dirY;

        if (projection < -player.size || projection > this.length + player.size) {
            return false;
        }

        const perpX = relX - projection * dirX;
        const perpY = relY - projection * dirY;
        const perpendicularDistance = Math.sqrt(perpX * perpX + perpY * perpY);
        return perpendicularDistance <= (this.width / 2 + player.size);
    }

    render(ctx) {
        if (!ctx) return;

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        const lifeProgress = this.lifetime > 0 ? Math.min(1, this.elapsed / this.lifetime) : 0;
        const outerAlpha = 0.5 * (1 - lifeProgress * 0.5);
        const innerAlpha = 0.85 * (1 - lifeProgress * 0.3);

        ctx.globalAlpha = outerAlpha;
        ctx.fillStyle = '#ff8c00';
        ctx.fillRect(0, -this.width / 2, this.length, this.width);

        ctx.globalAlpha = innerAlpha;
        ctx.fillStyle = '#ffe9a6';
        ctx.fillRect(0, -this.width * 0.3, this.length, this.width * 0.6);

        ctx.globalAlpha = Math.min(1, innerAlpha + 0.2);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, -this.width * 0.15, this.length, this.width * 0.3);

        ctx.restore();
        ctx.globalAlpha = 1.0;
    }

    serialize() {
        const base = super.serialize();
        return {
            ...base,
            length: this.length,
            width: this.width,
            angle: this.angle,
            tickInterval: this.tickInterval,
            damagePerTick: this.damagePerTick,
            turnRate: this.turnRate,
            followSource: this.followSource,
            trackPlayer: this.trackPlayer,
            pendingTicks: this.pendingTicks,
            tickAccumulator: this.tickAccumulator,
            sourceId: this.sourceId,
            originOffsetX: this.originOffsetX,
            originOffsetY: this.originOffsetY,
            lengthGrowthSpeed: this.lengthGrowthSpeed,
            maxLength: this.maxLength
        };
    }

    static fromState(state) {
        const hazard = new BeamHazard(state.x, state.y, {
            width: state.width,
            length: state.length,
            angle: state.angle,
            tickInterval: state.tickInterval,
            damagePerTick: state.damagePerTick,
            turnRate: state.turnRate,
            followSource: state.followSource,
            trackPlayer: state.trackPlayer,
            lifetime: state.lifetime,
            duration: state.lifetime,
            sourceId: state.sourceId,
            originOffsetX: state.originOffsetX,
            originOffsetY: state.originOffsetY,
            lengthGrowthSpeed: state.lengthGrowthSpeed,
            maxLength: state.maxLength
        });
        hazard.tickAccumulator = state.tickAccumulator || 0;
        hazard.pendingTicks = state.pendingTicks || 0;
        return hydrateEnvironmentalHazard(hazard, state);
    }
}

function createHazardFromState(state) {
    if (!state || !state.type) return null;
    switch (state.type) {
        case 'shockwave':
            return ShockwaveHazard.fromState(state);
        case 'damageZone':
            return DamageZoneHazard.fromState(state);
        case 'pullField':
            return PullFieldHazard.fromState(state);
        case 'debris':
            return DebrisHazard.fromState(state);
        case 'beam':
            return BeamHazard.fromState(state);
        default:
            return null;
    }
}

const hazardExports = {
    EnvironmentalHazard,
    ShockwaveHazard,
    DamageZoneHazard,
    PullFieldHazard,
    DebrisHazard,
    BeamHazard,
    createHazardFromState
};

if (typeof window !== 'undefined') {
    Object.assign(window, hazardExports);
} else if (typeof global !== 'undefined') {
    Object.assign(global, hazardExports);
}
