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
        
        // Placeholder defaults - applyBossScaling() overwrites maxHp/damage at spawn.
        this.maxHp = this.maxHp * 12;
        this.hp = this.maxHp;
        this.size = this.size * 2;
        this.damage = this.damage * 1.5;
        this.xpValue = this.xpValue * 3; // 3x XP

        if (typeof refreshEntityVoxelGrid === 'function') {
            refreshEntityVoxelGrid(this);
        }
        
        // Boss-specific color (can be overridden by subclasses)
        this.color = '#ff0000'; // Bright red for bosses

        // Running peak hit damage - used to normalize boss hit screen shake over the fight
        this.peakHitDamage = 0;
        this._lastHitShakeTime = 0;
    }

    getNavigationRadius() {
        return (this.size || 40) * 1.12 + 16;
    }

    getPathfindingRadius() {
        const navRadius = this.getNavigationRadius();
        const layout = typeof currentRoom !== 'undefined' && currentRoom && currentRoom.layout
            ? currentRoom.layout
            : null;
        const cellPad = layout ? Math.max(8, layout.cellSize * 0.14) : 10;
        return navRadius + cellPad;
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

    moveTowardPoint(targetX, targetY, speedMultiplier = 1, deltaTime = 0, smoothing = 0.35) {
        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance <= 0) return;
        this.applySmoothedDirectionalMovement(dx, dy, this.moveSpeed * speedMultiplier, deltaTime, smoothing);
    }

    clampToRoom(x, y) {
        const roomWidth = (typeof currentRoom !== 'undefined' && currentRoom) ? currentRoom.width : 2400;
        const roomHeight = (typeof currentRoom !== 'undefined' && currentRoom) ? currentRoom.height : 1350;
        return {
            x: Math.max(this.size, Math.min(roomWidth - this.size, x)),
            y: Math.max(this.size, Math.min(roomHeight - this.size, y))
        };
    }

    findSafeBossPosition(x, y) {
        const clamped = this.clampToRoom(x, y);
        if (typeof currentRoom === 'undefined' || !currentRoom || !currentRoom.layout || typeof RoomLayoutGenerator === 'undefined') {
            return clamped;
        }

        if (RoomLayoutGenerator.isPointWalkable(currentRoom.layout, clamped.x, clamped.y, this.getNavigationRadius())) {
            return clamped;
        }

        const safePoint = RoomLayoutGenerator.findSafeSpawnPoint(currentRoom.layout, {
            radius: this.getNavigationRadius(),
            margin: Math.max(100, this.size),
            minDistanceFrom: currentRoom.layout.spawnZone
                ? [{ x: currentRoom.layout.spawnZone.x, y: currentRoom.layout.spawnZone.y, distance: 240 }]
                : [],
            maxAttempts: 160
        });

        return safePoint || {
            x: this.lastSafeX || clamped.x,
            y: this.lastSafeY || clamped.y
        };
    }

    teleportToSafePosition(x, y) {
        const safe = this.findSafeBossPosition(x, y);
        this.x = safe.x;
        this.y = safe.y;
        this.lastSafeX = safe.x;
        this.lastSafeY = safe.y;
    }

    getCurrentBossLayout() {
        const room = typeof currentRoom !== 'undefined' ? currentRoom : null;
        const layout = room && room.layout ? room.layout : null;
        if (!room || !layout) return null;
        return {
            room,
            layout,
            biomeId: layout.biomeId || room.biomeId || null,
            centerX: layout.width ? layout.width / 2 : (room.width || 0) / 2,
            centerY: layout.height ? layout.height / 2 : (room.height || 0) / 2
        };
    }

    getLayoutAnchorCache(layout) {
        if (!layout) return null;
        if (!layout.__bossAnchorCache || layout.__bossAnchorCache.hash !== layout.hash || layout.__bossAnchorCache.obstacleCount !== (layout.obstacles || []).length) {
            layout.__bossAnchorCache = {
                hash: layout.hash || null,
                obstacleCount: (layout.obstacles || []).length,
                motifPoints: Object.create(null),
                arenaAnchors: Object.create(null)
            };
        }
        return layout.__bossAnchorCache;
    }

    getObstacleAnchorPoint(obstacle, index = 0) {
        if (!obstacle) return null;
        let x = obstacle.x || 0;
        let y = obstacle.y || 0;
        if (obstacle.shape === 'rect') {
            x += (obstacle.width || 0) / 2;
            y += (obstacle.height || 0) / 2;
        }
        const radius = obstacle.radius || Math.max(obstacle.width || 0, obstacle.height || 0) / 2 || 0;
        return {
            x,
            y,
            radius,
            shape: obstacle.shape || 'point',
            motif: obstacle.motif || null,
            structure: obstacle.structure || null,
            preset: obstacle.preset || null,
            destructible: !!obstacle.destructible,
            obstacleIndex: index,
            obstacle
        };
    }

    getLayoutMotifPoints(motif) {
        const context = this.getCurrentBossLayout();
        if (!context || !motif) return [];
        const cache = this.getLayoutAnchorCache(context.layout);
        if (!cache) return [];
        if (cache.motifPoints[motif]) return cache.motifPoints[motif];

        const points = (context.layout.obstacles || [])
            .map((obstacle, index) => {
                if (!obstacle || obstacle.destroyed || obstacle.motif !== motif) return null;
                return this.getObstacleAnchorPoint(obstacle, index);
            })
            .filter(Boolean);
        cache.motifPoints[motif] = points;
        return points;
    }

    coalesceAnchorPoints(points, radius = 180) {
        if (!Array.isArray(points) || points.length === 0) return [];
        const clusters = [];
        points.forEach(point => {
            let match = null;
            for (let i = 0; i < clusters.length; i++) {
                const cluster = clusters[i];
                if (Math.hypot(point.x - cluster.x, point.y - cluster.y) <= radius) {
                    match = cluster;
                    break;
                }
            }
            if (!match) {
                clusters.push({
                    x: point.x,
                    y: point.y,
                    radius: point.radius || 0,
                    points: [point],
                    motif: point.motif,
                    structure: point.structure,
                    destructible: !!point.destructible
                });
                return;
            }
            match.points.push(point);
            const count = match.points.length;
            match.x += (point.x - match.x) / count;
            match.y += (point.y - match.y) / count;
            match.radius = Math.max(match.radius || 0, point.radius || 0);
            match.destructible = match.destructible || !!point.destructible;
        });
        return clusters;
    }

    getBossArenaAnchors(type) {
        const context = this.getCurrentBossLayout();
        if (!context || !type) return [];
        const cache = this.getLayoutAnchorCache(context.layout);
        if (!cache) return [];
        if (cache.arenaAnchors[type]) return cache.arenaAnchors[type];

        const anchorConfig = {
            swarmNest: { motifs: ['swarmNest'], coalesceRadius: 190 },
            prismAnchor: { motifs: ['prismAnchor'], coalesceRadius: 190 },
            prismShard: { motifs: ['prismShard'], coalesceRadius: 150 },
            fortressCover: { motifs: ['fortressCover'], coalesceRadius: 170 },
            fortressWall: { motifs: ['fortressWall'], coalesceRadius: 90 },
            fractalIsland: { motifs: ['fractalIsland', 'outerFractalIsland'], coalesceRadius: 170 },
            fractalFragment: { motifs: ['fractalFragment'], coalesceRadius: 140 },
            vortexAnchor: { motifs: ['vortexAnchor'], coalesceRadius: 150 }
        };
        const config = anchorConfig[type] || { motifs: [type], coalesceRadius: 160 };
        const points = config.motifs.flatMap(motif => this.getLayoutMotifPoints(motif));
        const anchors = this.coalesceAnchorPoints(points, config.coalesceRadius);
        cache.arenaAnchors[type] = anchors;
        return anchors;
    }

    resolveAnchorToWalkable(anchor, radius = 24, preferredFrom = null) {
        const context = this.getCurrentBossLayout();
        const layout = context && context.layout ? context.layout : null;
        if (!anchor || !layout || typeof RoomLayoutGenerator === 'undefined') return anchor;
        if (RoomLayoutGenerator.isPointWalkable(layout, anchor.x, anchor.y, radius)) {
            return { ...anchor, walkableX: anchor.x, walkableY: anchor.y };
        }

        const cellSize = layout.cellSize || 60;
        const awayAngle = preferredFrom
            ? Math.atan2(anchor.y - preferredFrom.y, anchor.x - preferredFrom.x)
            : Math.atan2(anchor.y - (layout.height || 0) / 2, anchor.x - (layout.width || 0) / 2);
        const samples = 16;
        const maxRings = 5;
        for (let ring = 1; ring <= maxRings; ring++) {
            const distance = Math.max(cellSize * 0.7, (anchor.radius || cellSize) * 0.8) + ring * cellSize * 0.45;
            for (let i = 0; i < samples; i++) {
                const offset = i === 0 ? 0 : ((i % 2 === 0 ? 1 : -1) * Math.ceil(i / 2) * (Math.PI * 2 / samples));
                const angle = awayAngle + offset;
                const x = Math.max(radius, Math.min((layout.width || 2400) - radius, anchor.x + Math.cos(angle) * distance));
                const y = Math.max(radius, Math.min((layout.height || 1350) - radius, anchor.y + Math.sin(angle) * distance));
                if (RoomLayoutGenerator.isPointWalkable(layout, x, y, radius)) {
                    return { ...anchor, walkableX: x, walkableY: y };
                }
            }
        }
        const fallback = this.findSafeBossPosition(anchor.x, anchor.y);
        return { ...anchor, walkableX: fallback.x, walkableY: fallback.y };
    }

    getWalkableArenaAnchors(type, radius = 24, preferredFrom = null) {
        return this.getBossArenaAnchors(type).map(anchor => this.resolveAnchorToWalkable(anchor, radius, preferredFrom));
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
            Game.triggerScreenShake(5, 0.3, 'boss');
            if (typeof createParticleBurst !== 'undefined') {
                createParticleBurst(this.x, this.y, this.color, 20);
            }
        }
        console.log(`${this.bossName} entering Phase ${newPhase}!`);
        if (typeof Telemetry !== 'undefined') {
            const roomNumber = (typeof Game !== 'undefined' && Game.roomNumber) ? Game.roomNumber : 1;
            Telemetry.recordEvent('bossPhase', {
                roomNumber,
                targetId: this.bossName || this.constructor.name,
                value: newPhase,
                metadata: {
                    bossId: this.bossName || this.constructor.name,
                    oldPhase,
                    newPhase,
                    hp: this.hp,
                    maxHp: this.maxHp
                }
            });
        }

        if (typeof triggerBossPhaseFracture === 'function') {
            triggerBossPhaseFracture(this, oldPhase, newPhase);
        }
    }

    getVoxelBodyDrawFn() {
        const size = this.size || 40;
        return (oCtx) => {
            oCtx.beginPath();
            oCtx.arc(0, 0, size, 0, Math.PI * 2);
            oCtx.fill();
        };
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

    getDamageCollisionBodies() {
        return [{ x: this.x, y: this.y, radius: this.size }];
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
    
    shouldTriggerLocalBossHitShake(attackerId = null) {
        if (typeof Game === 'undefined' || typeof Game.getLocalPlayerId !== 'function') {
            return true;
        }
        const localPlayerId = Game.getLocalPlayerId();
        return !attackerId || attackerId === localPlayerId;
    }

    // Scale screen shake from damage relative to the biggest hit landed so far this fight.
    triggerBossHitScreenShake(finalDamage, options = {}) {
        if (typeof Game === 'undefined' || typeof Game.triggerScreenShake !== 'function') return;
        if (!Number.isFinite(finalDamage) || finalDamage <= 0) return;

        const isWeakPoint = !!options.weakPoint;
        const now = (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
        if (this._lastHitShakeTime && now - this._lastHitShakeTime < 0.045) return;
        this._lastHitShakeTime = now;

        // Seed with a modest floor so early hits don't immediately feel like max shake.
        const seedPeak = Math.max(1, (this.maxHp || 1) * 0.012);
        if (!this.peakHitDamage || this.peakHitDamage < seedPeak) {
            this.peakHitDamage = seedPeak;
        }

        if (finalDamage >= this.peakHitDamage * 0.98) {
            this.peakHitDamage = Math.max(this.peakHitDamage, finalDamage);
        }

        const referencePeak = this.peakHitDamage * 1.25;
        const ratio = Math.min(finalDamage / referencePeak, 1);
        const curved = Math.pow(ratio, 1.55);

        const minIntensity = 0.1;
        const maxIntensity = isWeakPoint ? 1.15 : 0.95;
        const intensity = minIntensity + (maxIntensity - minIntensity) * curved;

        const minDuration = 0.07;
        const maxDuration = 0.16;
        const duration = minDuration + (maxDuration - minDuration) * Math.pow(ratio, 1.2);

        Game.triggerScreenShake(intensity, duration, 'boss');
    }

    // Override takeDamage to check for weak point hits first
    takeDamage(damage, hitX = null, hitY = null, hitRadius = 0, attackerId = null, weaponArchetype = 'blast') {
        // Check for weak point hit if position provided
        let weakPointHit = null;
        if (hitX !== null && hitY !== null && hitRadius > 0) {
            weakPointHit = this.checkWeakPointHit(hitX, hitY, hitRadius);
        }
        
        // Apply weak point damage multiplier if weak point hit
        const weakPointMultiplier = this.weakPointDamageMultiplier || 3;
        const finalDamage = weakPointHit ? damage * weakPointMultiplier : damage;

        this._lastHitWeakPoint = !!weakPointHit;
        
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
        
        if (this.shouldTriggerLocalBossHitShake(attackerId)) {
            this.triggerBossHitScreenShake(finalDamage, { weakPoint: !!weakPointHit });
        }

        // Visual feedback for weak point hits
        if (weakPointHit) {
            // Extra particle effect for weak point hit
            if (typeof createParticleBurst !== 'undefined') {
                const wpX = this.x + weakPointHit.offsetX;
                const wpY = this.y + weakPointHit.offsetY;
                createParticleBurst(wpX, wpY, '#00ffff', 15);
            }
        }
        
        // Voxel damage hook - visual response
        const arch = weaponArchetype || 'blast';
        if (typeof storeKillContext === 'function') {
            storeKillContext(this, finalDamage, hitX, hitY, arch, { isWeakPoint: !!weakPointHit });
        }
        if (typeof flagVoxelDamage === 'function' && this._voxelGrid) {
            flagVoxelDamage(this, finalDamage, hitX, hitY, arch);
        }

        if (this.hp <= 0) {
            this.die();
        }
    }
    
    // Override die to drop guaranteed rare+ loot
    // NOTE: Only called on host or in solo mode. Clients receive death via game_state sync.
    die() {
        this.alive = false;
        this.deathTime = Date.now();
        
        // Track kill for the last attacker
        if (this.lastAttacker) {
            // Track lifetime kills stat
            const isClient = typeof Game !== 'undefined' && Game.isMultiplayerClient && Game.isMultiplayerClient();
            if (!isClient && typeof window.trackLifetimeStat === 'function') {
                window.trackLifetimeStat('totalKills', 1);
            }
            
            if (typeof Game !== 'undefined' && Game.getPlayerStats) {
                const stats = Game.getPlayerStats(this.lastAttacker);
                if (stats) {
                    stats.addStat('kills', 1);
                }
            }
        }
        
        // Death visuals (voxel shatter + juice)
        if (typeof this.triggerDeathVisuals === 'function') {
            this.triggerDeathVisuals();
        } else if (typeof createParticleBurst !== 'undefined') {
            createParticleBurst(this.x, this.y, this.color, 30);
        }
        // Track boss kill - bank persistent credits immediately (CombatEconomy tier)
        const isClient = typeof Game !== 'undefined' && Game.isMultiplayerClient && Game.isMultiplayerClient();
        if (!isClient && typeof Game !== 'undefined') {
            if (typeof Game.bossesKilled === 'number') {
                Game.bossesKilled++;
            } else {
                Game.bossesKilled = 1;
            }
            if (typeof Game.awardRunCredits === 'function') {
                const room = Game.roomNumber || 1;
                const amount = (typeof CombatEconomy !== 'undefined' && CombatEconomy.getCreditReward)
                    ? CombatEconomy.getCreditReward(this, room)
                    : (Game.BOSS_CREDIT_REWARD || 50);
                Game.awardRunCredits(amount, 'boss');
            }
        }
        // Persist unique boss defeat for nexus machine gates
        if (!isClient && typeof SaveSystem !== 'undefined' && SaveSystem.recordBossDefeated) {
            SaveSystem.recordBossDefeated(this.bossName || this.constructor.name);
        }
        if (!isClient && typeof Telemetry !== 'undefined') {
            const bossId = this.bossName || this.constructor.name;
            const roomNumber = (typeof Game !== 'undefined' && Game.roomNumber) ? Game.roomNumber : 1;
            Telemetry.recordEvent('bossDefeated', {
                roomNumber,
                targetId: bossId,
                metadata: {
                    bossId,
                    lastAttacker: this.lastAttacker || null
                }
            });
            Telemetry.completeBossEncounter(bossId);
        }
        
        // Give XP to all alive players (multiplayer: host distributes; solo: local player)
        if (typeof Game !== 'undefined' && Game.distributeXPToAllPlayers && this.xpValue) {
            Game.distributeXPToAllPlayers(this.xpValue);
        }
        
        // Item drop system (bosses have high chance to drop items)
        if (typeof Game !== 'undefined' && typeof ITEM_DEFINITIONS !== 'undefined' && typeof getRandomItem === 'function') {
            // Bosses have 50% chance to drop an item (highest drop rate)
            // Bosses are exempt from scaling since they're rare and should feel rewarding
            const roomNumber = (typeof Game !== 'undefined' && Game.roomNumber) ? Game.roomNumber : 1;
            if (Math.random() < 0.50) {
                const itemDef = getRandomItem();

                // Check if in multiplayer - use pylons instead of ground items
                const inMultiplayer = typeof multiplayerManager !== 'undefined' &&
                    multiplayerManager &&
                    multiplayerManager.lobbyCode;

                if (inMultiplayer) {
                    // Create item pylon (multiplayer)
                    if (typeof createItemPylon === 'function') {
                        createItemPylon(this.x, this.y, itemDef);
                        
                        // Increment item drop counter for this room
                        if (typeof Game !== 'undefined') {
                            if (!Game.itemsDroppedThisRoom) Game.itemsDroppedThisRoom = 0;
                            Game.itemsDroppedThisRoom++;
                        }
                        
                        console.log(`[Item Pylon] ${itemDef.name} (${itemDef.rarity}) from Boss (Room ${roomNumber}, Total: ${Game.itemsDroppedThisRoom || 0})`);
                    }
                } else {
                    // Create ground item (single player)
                    const groundItem = {
                        id: 'item_' + Date.now() + '_' + Math.random(),
                        itemId: itemDef.id,
                        definition: itemDef,
                        x: this.x,
                        y: this.y,
                        size: 12,
                        pulse: 0,
                        pickupRadius: 30
                    };

                    // Add to ground items
                    if (!Game.groundItems) Game.groundItems = [];
                    Game.groundItems.push(groundItem);

                    // Increment item drop counter for this room
                    if (typeof Game !== 'undefined') {
                        if (!Game.itemsDroppedThisRoom) Game.itemsDroppedThisRoom = 0;
                        Game.itemsDroppedThisRoom++;
                    }

                    console.log(`[Item Drop] ${itemDef.name} (${itemDef.rarity}) from Boss (Room ${roomNumber}, Total: ${Game.itemsDroppedThisRoom || 0})`);
                }
            }
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
                if (gear) {
                    groundLoot.push(gear);
                    console.log(`Boss dropped ${gear.tier} loot`);
                }
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
        ctx.font = 'bold 12px Orbitron';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`Phase ${this.phase}`, this.x, barY - 10);
    }

    // Override renderStatusEffects for bosses (positioned above health bar)
    renderStatusEffects(ctx) {
        const effects = [];
        const iconSize = 10; // Slightly larger for bosses
        const iconSpacing = 14;
        const startY = this.y - this.size - 23; // Above health bar (which is at -15)
        let currentX = this.x;

        // Bleed indicator (red drop icon with stack count)
        if (this.bleeding && this.bleedStacks > 0) {
            effects.push({
                x: currentX,
                y: startY,
                type: 'bleed',
                stacks: this.bleedStacks,
                color: '#ff0000'
            });
            currentX += iconSpacing;
        }

        // Burn indicator (orange flame icon)
        if (this.burning && this.burnDuration > 0) {
            effects.push({
                x: currentX,
                y: startY,
                type: 'burn',
                color: '#ff6600'
            });
            currentX += iconSpacing;
        }

        // Vulnerability indicator (purple icon)
        if (this.vulnerable && this.vulnerabilityDuration > 0) {
            effects.push({
                x: currentX,
                y: startY,
                type: 'vulnerability',
                color: '#aa00ff'
            });
            currentX += iconSpacing;
        }

        // Slow indicator (blue snowflake icon)
        if (this.slowed && this.slowDuration > 0) {
            effects.push({
                x: currentX,
                y: startY,
                type: 'slow',
                color: '#0099ff'
            });
            currentX += iconSpacing;
        }

        // Render all effects
        if (effects.length === 0) return;

        // Center the effects horizontally
        const totalWidth = (effects.length - 1) * iconSpacing;
        const startX = this.x - totalWidth / 2;

        effects.forEach((effect, index) => {
            const x = startX + index * iconSpacing;
            const y = effect.y;

            ctx.save();

            // Draw icon background circle
            ctx.fillStyle = effect.color;
            ctx.globalAlpha = 0.8;
            ctx.beginPath();
            ctx.arc(x, y, iconSize / 2 + 1, 0, Math.PI * 2);
            ctx.fill();

            // Draw icon border
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.globalAlpha = 1.0;
            ctx.stroke();

            // Draw icon symbol
            ctx.fillStyle = '#ffffff';
            ctx.globalAlpha = 1.0;
            ctx.beginPath();

            switch (effect.type) {
                case 'bleed':
                    // Draw drop shape
                    ctx.moveTo(x, y - iconSize / 2);
                    ctx.lineTo(x - iconSize / 3, y);
                    ctx.lineTo(x, y + iconSize / 2);
                    ctx.lineTo(x + iconSize / 3, y);
                    ctx.closePath();
                    ctx.fill();
                    // Draw stack count ABOVE the icon
                    if (effect.stacks > 1) {
                        ctx.fillStyle = '#ffffff';
                        ctx.font = 'bold 12px Arial';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'bottom';
                        // Add text shadow for better visibility
                        ctx.shadowColor = '#000000';
                        ctx.shadowBlur = 3;
                        ctx.fillText(effect.stacks.toString(), x, y - iconSize / 2 - 4);
                        ctx.shadowBlur = 0;
                    }
                    break;
                case 'burn':
                    // Draw flame shape (simple triangle)
                    ctx.moveTo(x, y - iconSize / 2);
                    ctx.lineTo(x - iconSize / 3, y + iconSize / 4);
                    ctx.lineTo(x, y + iconSize / 2);
                    ctx.lineTo(x + iconSize / 3, y + iconSize / 4);
                    ctx.closePath();
                    ctx.fill();
                    break;
                case 'vulnerability':
                    // Draw exclamation mark
                    ctx.fillRect(x - 1.5, y - iconSize / 2, 3, iconSize * 0.6);
                    ctx.beginPath();
                    ctx.arc(x, y + iconSize / 3, 2, 0, Math.PI * 2);
                    ctx.fill();
                    break;
                case 'slow':
                    // Draw snowflake (simple X with center)
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.moveTo(x - iconSize / 3, y);
                    ctx.lineTo(x + iconSize / 3, y);
                    ctx.moveTo(x, y - iconSize / 3);
                    ctx.lineTo(x, y + iconSize / 3);
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.arc(x, y, 2, 0, Math.PI * 2);
                    ctx.fill();
                    break;
            }

            ctx.restore();
        });
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
            environmentalHazards: hazardStates,
            // Weak points for client display (clients do not run boss AI)
            weakPoints: (this.weakPoints || []).map(wp => ({
                offsetX: wp.offsetX,
                offsetY: wp.offsetY,
                x: wp.x,
                y: wp.y,
                radius: wp.radius,
                hitRadius: wp.hitRadius,
                angle: wp.angle,
                visible: wp.visible !== false,
                active: wp.active !== false
            }))
        };
    }
    
    // Override applyState to handle Boss-specific state  
    applyState(state) {
        super.applyState(state);
        // Boss-specific properties
        if (state.phase !== undefined) this.phase = state.phase;
        if (state.introComplete !== undefined) this.introComplete = state.introComplete;
        if (state.weakPoints !== undefined && Array.isArray(state.weakPoints)) {
            // Preserve existing weak point objects when possible; otherwise replace
            if (this.weakPoints && this.weakPoints.length === state.weakPoints.length) {
                for (let i = 0; i < state.weakPoints.length; i++) {
                    const src = state.weakPoints[i];
                    const dst = this.weakPoints[i];
                    if (src.offsetX !== undefined) dst.offsetX = src.offsetX;
                    if (src.offsetY !== undefined) dst.offsetY = src.offsetY;
                    if (src.x !== undefined) dst.x = src.x;
                    if (src.y !== undefined) dst.y = src.y;
                    if (src.radius !== undefined) dst.radius = src.radius;
                    if (src.hitRadius !== undefined) dst.hitRadius = src.hitRadius;
                    if (src.angle !== undefined) dst.angle = src.angle;
                    if (src.visible !== undefined) dst.visible = src.visible;
                    if (src.active !== undefined) dst.active = src.active;
                }
            } else {
                this.weakPoints = state.weakPoints.map(wp => ({ ...wp }));
            }
        }
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

