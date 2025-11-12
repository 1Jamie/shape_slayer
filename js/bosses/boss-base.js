// Base boss class extending EnemyBase

class BossBase extends EnemyBase {
    constructor(x, y) {
        super(x, y);
        
        // Boss identification
        this.isBoss = true;
        this.bossName = '';
        
        // Phase system
        this.phase = 1; // 1, 2, or 3
        this.lastPhase = 1;
        
        // Weak point system
        this.weakPoints = []; // Array of { x, y, radius, angle, visible }
        
        // Environmental hazards
        this.environmentalHazards = []; // Array of hazard objects
        
        // Intro system
        this.introComplete = false;
        this.introTime = 0;
        
        // Scale boss stats (12x HP, 2x size, 1.5x damage)
        this.maxHp = this.maxHp * 12;
        this.hp = this.maxHp;
        this.size = this.size * 2;
        this.damage = this.damage * 1.5;
        this.xpValue = this.xpValue * 3; // 3x XP
        
        // Boss-specific color (can be overridden by subclasses)
        this.color = '#ff0000'; // Bright red for bosses
    }
    
    isValidAggroTarget(target) {
        if (!target) return false;
        if (target.alive === false) return false;
        if (target.dead === true) return false;
        if (typeof target.hp === 'number' && target.hp <= 0) return false;
        if (typeof target.health === 'number' && target.health <= 0) return false;
        return true;
    }
    
    resolveAggroPlayer(deltaTime = 0, fallbackPlayer = null) {
        if (typeof this.updateTargetLock === 'function') {
            this.updateTargetLock(deltaTime);
        }
        if (typeof this.updateAggroTarget === 'function') {
            this.updateAggroTarget();
        }
        
        let targetPlayer = null;
        
        if (this.currentTarget) {
            const candidate = this.getPlayerById(this.currentTarget);
            if (this.isValidAggroTarget(candidate)) {
                targetPlayer = candidate;
            } else {
                this.currentTarget = null;
            }
        }
        
        if (!targetPlayer && this.isValidAggroTarget(fallbackPlayer)) {
            targetPlayer = fallbackPlayer;
        }
        
        if (!targetPlayer) {
            const nearestPlayer = this.getNearestPlayer();
            if (this.isValidAggroTarget(nearestPlayer)) {
                targetPlayer = nearestPlayer;
            }
        }
        
        return targetPlayer;
    }
    
    // Check and transition phases based on HP thresholds
    checkPhaseTransition() {
        const hpPercent = this.hp / this.maxHp;
        const previousPhase = this.phase;
        
        if (hpPercent <= 0.25 && this.phase < 3) {
            this.phase = 3;
        } else if (hpPercent <= 0.50 && this.phase < 2) {
            this.phase = 2;
        }
        
        // If phase changed, trigger phase transition effects
        if (this.phase !== previousPhase) {
            this.onPhaseTransition(previousPhase, this.phase);
        }
    }
    
    // Override to add phase transition effects (particles, screen shake, etc.)
    onPhaseTransition(oldPhase, newPhase) {
        // Trigger screen shake and particles
        if (typeof Game !== 'undefined') {
            Game.triggerScreenShake(5, 0.3);
            if (typeof createParticleBurst !== 'undefined') {
                createParticleBurst(this.x, this.y, this.color, 20);
            }
        }
        console.log(`${this.bossName} entering Phase ${newPhase}!`);
    }
    
    // Check if a weak point was hit
    // Returns weak point object if hit, null otherwise
    checkWeakPointHit(x, y, radius) {
        for (let i = 0; i < this.weakPoints.length; i++) {
            const wp = this.weakPoints[i];
            if (!wp.visible) continue;
            
            // Calculate weak point world position
            const wpX = this.x + wp.offsetX;
            const wpY = this.y + wp.offsetY;
            
            // Check collision
            const dx = x - wpX;
            const dy = y - wpY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < (radius + wp.radius)) {
                return wp;
            }
        }
        return null;
    }
    
    // Add a weak point relative to boss center
    addWeakPoint(offsetX, offsetY, radius, angle = 0) {
        this.weakPoints.push({
            offsetX: offsetX, // Offset from boss center
            offsetY: offsetY,
            radius: radius,
            angle: angle, // Optional: rotation angle for visual
            visible: true,
            glowIntensity: 1.0
        });
    }
    
    // Update weak points (for animation, visibility toggling, etc.)
    updateWeakPoints(deltaTime) {
        // Subclasses can override to animate weak points
        // Default: just pulse the glow
        this.weakPoints.forEach(wp => {
            wp.glowIntensity = 0.7 + Math.sin(Date.now() / 200) * 0.3;
        });
    }
    
    // Add an environmental hazard
    addEnvironmentalHazard(hazard) {
        this.environmentalHazards.push(hazard);
    }
    
    // Create shockwave hazard (expanding ring)
    createShockwave(x, y, maxRadius, duration, damage) {
        if (typeof ShockwaveHazard !== 'undefined') {
            this.addEnvironmentalHazard(new ShockwaveHazard(x, y, maxRadius, duration, damage));
        } else {
            // Fallback to inline object if hazard classes not loaded
            this.addEnvironmentalHazard({
                x: x, y: y, radius: 0, maxRadius: maxRadius, damage: damage,
                damagePerSecond: false, lifetime: duration, elapsed: 0,
                expired: false, hasHitPlayer: false, type: 'shockwave'
            });
        }
    }
    
    // Create damage zone (static area)
    createDamageZone(x, y, radius, duration, damage, persistent = false) {
        if (typeof DamageZoneHazard !== 'undefined') {
            this.addEnvironmentalHazard(new DamageZoneHazard(x, y, radius, duration, damage, persistent));
        } else {
            // Fallback to inline object
            this.addEnvironmentalHazard({
                x: x, y: y, radius: radius, maxRadius: radius, damage: damage,
                damagePerSecond: persistent, lifetime: duration, elapsed: 0,
                expired: false, hasHitPlayer: false, lastDamageTime: 0,
                type: 'damageZone'
            });
        }
    }
    
    // Create pull field (affects player velocity)
    createPullField(x, y, radius, strength) {
        if (typeof PullFieldHazard !== 'undefined') {
            this.addEnvironmentalHazard(new PullFieldHazard(x, y, radius, strength));
        } else {
            // Fallback to inline object
            this.addEnvironmentalHazard({
                x: x, y: y, radius: radius, maxRadius: radius, strength: strength,
                lifetime: Infinity, elapsed: 0, expired: false, type: 'pullField'
            });
        }
    }
    
    // Create debris hazard
    createDebris(x, y, radius, duration, damage) {
        if (typeof DebrisHazard !== 'undefined') {
            this.addEnvironmentalHazard(new DebrisHazard(x, y, radius, duration, damage));
        } else {
            // Fallback
            this.addEnvironmentalHazard({
                x: x, y: y, radius: radius, maxRadius: radius, damage: damage,
                lifetime: duration, elapsed: 0, expired: false,
                hasHitPlayer: false, type: 'debris'
            });
        }
    }

    // Create beam hazard (continuous beam)
    createBeam(options = {}) {
        const beamX = options.x !== undefined ? options.x : this.x;
        const beamY = options.y !== undefined ? options.y : this.y;
        if (typeof BeamHazard !== 'undefined') {
            const hazard = new BeamHazard(beamX, beamY, {
                width: options.width,
                length: options.length,
                angle: options.angle,
                tickInterval: options.tickInterval,
                damagePerTick: options.damagePerTick !== undefined ? options.damagePerTick : options.damage,
                turnRate: options.turnRate,
                followSource: options.followSource !== undefined ? options.followSource : true,
                trackPlayer: options.trackPlayer !== undefined ? options.trackPlayer : true,
                lifetime: options.lifetime !== undefined ? options.lifetime : options.duration,
                originOffsetX: options.originOffsetX || 0,
                originOffsetY: options.originOffsetY || 0,
                lengthGrowthSpeed: options.lengthGrowthSpeed || 0,
                maxLength: options.maxLength,
                sourceId: this.id
            });
            this.addEnvironmentalHazard(hazard);
            return hazard;
        }
        const fallback = {
            type: 'beam',
            x: beamX,
            y: beamY,
            angle: options.angle || 0,
            length: options.length || 600,
            width: options.width || 60,
            tickInterval: options.tickInterval || 0.1,
            damagePerTick: options.damagePerTick !== undefined ? options.damagePerTick : (options.damage || this.damage),
            turnRate: options.turnRate !== undefined ? options.turnRate : Math.PI,
            followSource: options.followSource !== undefined ? options.followSource : true,
            trackPlayer: options.trackPlayer !== undefined ? options.trackPlayer : true,
            lifetime: options.lifetime !== undefined ? options.lifetime : (options.duration || 2.0),
            elapsed: 0,
            expired: false,
            pendingTicks: 0,
            tickAccumulator: 0,
            originOffsetX: options.originOffsetX || 0,
            originOffsetY: options.originOffsetY || 0
        };
        this.addEnvironmentalHazard(fallback);
        return fallback;
    }
    
    // Update all environmental hazards
    updateHazards(deltaTime, player = null) {
        // Update each hazard
        this.environmentalHazards.forEach(hazard => {
            if (hazard.update) {
                hazard.update(deltaTime, {
                    boss: this,
                    targetPlayer: player
                });
            } else {
                // Fallback for inline objects
                hazard.elapsed += deltaTime;
                if (hazard.type === 'shockwave' && hazard.radius < hazard.maxRadius) {
                    const expandRate = hazard.maxRadius / hazard.lifetime;
                    hazard.radius = Math.min(hazard.maxRadius, hazard.radius + expandRate * deltaTime);
                }
                if (hazard.elapsed >= hazard.lifetime) {
                    hazard.expired = true;
                }
            }
        });
        
        // Remove expired hazards
        this.environmentalHazards = this.environmentalHazards.filter(hazard => {
            return !hazard.expired;
        });
    }
    
    // Check player collision with hazards (called from boss update)
    checkHazardCollisions(player, deltaTime) {
        const isClient = typeof Game !== 'undefined' && Game.isMultiplayerClient && Game.isMultiplayerClient();
        if (isClient) return;

        const targets = new Set();
        if (player) {
            targets.add(player);
        }
        if (typeof this.getAllAlivePlayers === 'function') {
            const allPlayers = this.getAllAlivePlayers();
            allPlayers.forEach(entry => {
                if (entry && entry.player) {
                    targets.add(entry.player);
                }
            });
        }

        if (!targets.size) return;

        this.environmentalHazards.forEach(hazard => {
            if (!hazard || hazard.expired) return;

            targets.forEach(target => {
                if (!target) return;
                if (target.dead || target.alive === false) return;
                if (target.invulnerable && !(hazard && hazard.ignoreInvulnerability)) return;

                if (hazard.type === 'pullField') {
                    if (hazard.applyPull) {
                        hazard.applyPull(target);
                    } else if (target.applyPullForce) {
                        target.applyPullForce(hazard.x, hazard.y, hazard.strength || 50, hazard.radius);
                    }
                    return;
                }

                if (hazard.applyDamage) {
                    hazard.applyDamage(target);
                    return;
                }

                const size = target.size !== undefined ? target.size : 20;
                const dx = target.x - hazard.x;
                const dy = target.y - hazard.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < hazard.radius + size) {
                    if (hazard.damagePerSecond) {
                        const timeSinceLastDamage = hazard.elapsed - hazard.lastDamageTime;
                        if (timeSinceLastDamage >= 1.0 && typeof target.takeDamage === 'function') {
                            target.takeDamage(hazard.damage);
                            hazard.lastDamageTime = hazard.elapsed;
                        }
                    } else if (!hazard.hasHitPlayer && typeof target.takeDamage === 'function') {
                        target.takeDamage(hazard.damage);
                        hazard.hasHitPlayer = true;
                    }
                }
            });
        });
    }
    
    // Override takeDamage to check for weak point hits first
    takeDamage(damage, hitX = null, hitY = null, hitRadius = 0, attackerId = null) {
        // Check for weak point hit if position provided
        let weakPointHit = null;
        if (hitX !== null && hitY !== null && hitRadius > 0) {
            weakPointHit = this.checkWeakPointHit(hitX, hitY, hitRadius);
        }
        
        // Apply 3x damage multiplier if weak point hit
        const finalDamage = weakPointHit ? damage * 3 : damage;
        
        this.hp -= finalDamage;
        
        // Track who dealt the damage (for kill attribution and aggro)
        if (attackerId) {
            this.lastAttacker = attackerId;
            // Add threat for aggro system
            this.addThreat(attackerId, finalDamage);
        } else if (typeof Game !== 'undefined' && Game.getLocalPlayerId) {
            this.lastAttacker = Game.getLocalPlayerId();
            this.addThreat(Game.getLocalPlayerId(), finalDamage);
        }
        
        // Visual feedback for weak point hits
        if (weakPointHit) {
            // Extra particle effect for weak point hit
            if (typeof createParticleBurst !== 'undefined') {
                const wpX = this.x + weakPointHit.offsetX;
                const wpY = this.y + weakPointHit.offsetY;
                createParticleBurst(wpX, wpY, '#00ffff', 15);
            }
            if (typeof Game !== 'undefined') {
                Game.triggerScreenShake(3, 0.15);
            }
        }
        
        if (this.hp <= 0) {
            this.die();
        }
    }
    
    // Override die to drop guaranteed rare+ loot
    // NOTE: Only called on host or in solo mode. Clients receive death via game_state sync.
    die() {
        this.alive = false;
        
        // Track kill for the last attacker
        if (this.lastAttacker && typeof Game !== 'undefined' && Game.getPlayerStats) {
            const stats = Game.getPlayerStats(this.lastAttacker);
            stats.addStat('kills', 1);
        }
        
        // Emit particles on death
        if (typeof createParticleBurst !== 'undefined') {
            createParticleBurst(this.x, this.y, this.color, 30);
        }
        
        // Give XP to all alive players (multiplayer: host distributes; solo: local player)
        if (typeof Game !== 'undefined' && Game.distributeXPToAllPlayers && this.xpValue) {
            Game.distributeXPToAllPlayers(this.xpValue);
        }
        
        // Drop guaranteed rare+ loot (2-3 items) - syncs via game_state in multiplayer
        if (typeof generateGear !== 'undefined' && typeof groundLoot !== 'undefined') {
            const lootCount = 2 + Math.floor(Math.random() * 2); // 2 or 3 items
            const roomNum = typeof Game !== 'undefined' ? (Game.roomNumber || 1) : 1;
            
            for (let i = 0; i < lootCount; i++) {
                // Generate gear at slightly offset position using boss difficulty
                const offsetX = (Math.random() - 0.5) * 40;
                const offsetY = (Math.random() - 0.5) * 40;
                const gear = generateGear(this.x + offsetX, this.y + offsetY, roomNum, 'boss');
                groundLoot.push(gear);
                console.log(`Boss dropped ${gear.tier} loot`);
            }
        }
    }
    
    // Override renderHealthBar for bosses (enhanced version)
    renderHealthBar(ctx) {
        const barWidth = this.size * 2.5; // Larger for bosses
        const barHeight = 5; // Thicker for bosses
        const barX = this.x - barWidth / 2;
        const barY = this.y - this.size - 15; // More space above boss
        
        // Draw background (total HP bar in red)
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(barX, barY, barWidth, barHeight);
        
        // Draw foreground (current HP bar in green)
        const hpPercent = this.hp / this.maxHp;
        ctx.fillStyle = '#00ff00';
        ctx.fillRect(barX, barY, barWidth * hpPercent, barHeight);
        
        // Draw border
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(barX, barY, barWidth, barHeight);
        
        // Phase indicator
        const phaseColors = ['#00ff00', '#ffaa00', '#ff0000']; // Green, Orange, Red
        ctx.fillStyle = phaseColors[this.phase - 1] || '#ffffff';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`Phase ${this.phase}`, this.x, barY - 10);
    }
    
    // Render weak points as glowing circles
    renderWeakPoints(ctx) {
        this.weakPoints.forEach(wp => {
            if (!wp.visible) return;
            
            const wpX = this.x + wp.offsetX;
            const wpY = this.y + wp.offsetY;
            
            // Outer glow
            const glowRadius = wp.radius * (1 + wp.glowIntensity * 0.3);
            ctx.globalAlpha = 0.3 * wp.glowIntensity;
            ctx.fillStyle = '#00ffff';
            ctx.beginPath();
            ctx.arc(wpX, wpY, glowRadius, 0, Math.PI * 2);
            ctx.fill();
            
            // Core weak point
            ctx.globalAlpha = wp.glowIntensity;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(wpX, wpY, wp.radius, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.globalAlpha = 1.0;
        });
    }
    
    // Render environmental hazards
    renderHazards(ctx) {
        this.environmentalHazards.forEach(hazard => {
            if (hazard.expired) return;
            
            // Use hazard's render method if available
            if (hazard.render) {
                hazard.render(ctx);
            } else {
                // Fallback for inline objects
                ctx.save();
                
                if (hazard.type === 'shockwave') {
                    ctx.strokeStyle = '#ffaa00';
                    ctx.lineWidth = 3;
                    ctx.globalAlpha = 1.0 - (hazard.elapsed / hazard.lifetime);
                    ctx.beginPath();
                    ctx.arc(hazard.x, hazard.y, hazard.radius, 0, Math.PI * 2);
                    ctx.stroke();
                } else if (hazard.type === 'damageZone') {
                    ctx.fillStyle = '#ff0000';
                    ctx.globalAlpha = 0.3;
                    ctx.beginPath();
                    ctx.arc(hazard.x, hazard.y, hazard.radius, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.strokeStyle = '#ff6666';
                    ctx.lineWidth = 2;
                    ctx.globalAlpha = 0.6;
                    ctx.stroke();
                } else if (hazard.type === 'pullField') {
                    ctx.strokeStyle = '#00ffff';
                    ctx.lineWidth = 2;
                    ctx.globalAlpha = 0.4;
                    const spiralAngle = Date.now() / 100;
                    for (let i = 0; i < 3; i++) {
                        ctx.beginPath();
                        ctx.arc(hazard.x, hazard.y, hazard.radius * (0.3 + i * 0.3), 
                                spiralAngle + i * Math.PI, spiralAngle + i * Math.PI + Math.PI * 1.5);
                        ctx.stroke();
                    }
                } else if (hazard.type === 'beam') {
                    const width = hazard.width || 60;
                    const length = hazard.length || 600;
                    const angle = hazard.angle || 0;
                    ctx.translate(hazard.x || 0, hazard.y || 0);
                    ctx.rotate(angle);
                    ctx.globalAlpha = 0.5;
                    ctx.fillStyle = '#ff8c00';
                    ctx.fillRect(0, -width / 2, length, width);
                    ctx.globalAlpha = 0.85;
                    ctx.fillStyle = '#ffe9a6';
                    ctx.fillRect(0, -width * 0.3, length, width * 0.6);
                    ctx.globalAlpha = 1.0;
                }
                
                ctx.restore();
            }
        });
    }
    
    // Abstract methods - must be implemented by subclasses
    update(deltaTime, player) {
        throw new Error('BossBase.update() must be implemented by subclass');
    }
    
    render(ctx) {
        throw new Error('BossBase.render() must be implemented by subclass');
    }
    
    // Override serialize to include Boss-specific state
    serialize() {
        const baseState = super.serialize();
        const hazardStates = this.environmentalHazards.map(hazard => {
            if (!hazard) return null;
            if (typeof hazard.serialize === 'function') {
                return hazard.serialize();
            }
            // Fallback for plain objects
            return {
                ...hazard
            };
        }).filter(Boolean);
        return {
            ...baseState,
            // Boss-specific properties
            bossName: this.bossName,
            phase: this.phase,
            introComplete: this.introComplete,
            environmentalHazards: hazardStates
        };
    }
    
    // Override applyState to handle Boss-specific state  
    applyState(state) {
        super.applyState(state);
        // Boss-specific properties
        if (state.phase !== undefined) this.phase = state.phase;
        if (state.introComplete !== undefined) this.introComplete = state.introComplete;
        if (state.environmentalHazards !== undefined) {
            if (Array.isArray(state.environmentalHazards) && typeof createHazardFromState === 'function') {
                this.environmentalHazards = state.environmentalHazards.map(hazardState => {
                    const hazard = createHazardFromState(hazardState);
                    if (hazard) return hazard;
                    return {
                        ...hazardState
                    };
                }).filter(Boolean);
            } else if (Array.isArray(state.environmentalHazards)) {
                this.environmentalHazards = state.environmentalHazards.map(hazardState => ({
                    ...hazardState
                }));
            } else {
                this.environmentalHazards = [];
            }
        }
    }
}

