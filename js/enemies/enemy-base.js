// Base enemy class with common functionality

function normalizeAngle(angle) {
    while (angle > Math.PI) angle -= Math.PI * 2;
    while (angle < -Math.PI) angle += Math.PI * 2;
    return angle;
}

class GroupRetreatCoordinator {
    constructor() {
        this.recentRetreats = [];
        this.timeWindowMs = 2200;
    }

    prune(now = Date.now()) {
        const cutoff = now - this.timeWindowMs;
        if (this.recentRetreats.length === 0) return;
        let idx = 0;
        while (idx < this.recentRetreats.length && this.recentRetreats[idx].time < cutoff) {
            idx++;
        }
        if (idx > 0) {
            this.recentRetreats.splice(0, idx);
        }
    }

    getGroupPenalty(enemy, { radius = 220, maxPenalty = 0.65 } = {}) {
        const now = Date.now();
        this.prune(now);
        if (!enemy || this.recentRetreats.length === 0) {
            return 0;
        }
        const radiusSq = radius * radius;
        let weight = 0;
        for (let i = 0; i < this.recentRetreats.length; i++) {
            const entry = this.recentRetreats[i];
            if (entry.enemyId === enemy.id) {
                continue;
            }
            const dx = entry.x - enemy.x;
            const dy = entry.y - enemy.y;
            const distSq = dx * dx + dy * dy;
            if (distSq > radiusSq) {
                continue;
            }
            const proximityWeight = 1 - Math.min(1, distSq / radiusSq);
            const timeFactor = 1 - Math.min(1, (now - entry.time) / this.timeWindowMs);
            weight += proximityWeight * (0.5 + timeFactor * 0.5);
        }
        if (weight <= 0) {
            return 0;
        }
        const penalty = Math.min(maxPenalty, weight * 0.35);
        return Math.max(0, Math.min(1, penalty));
    }

    registerRetreat(enemy) {
        if (!enemy) return;
        const now = Date.now();
        this.prune(now);
        const enemyId = enemy.id || enemy.uuid || enemy._id || `enemy-${Math.random()}`;
        this.recentRetreats.push({
            time: now,
            x: enemy.x,
            y: enemy.y,
            enemyId
        });
        if (this.recentRetreats.length > 40) {
            this.recentRetreats.splice(0, this.recentRetreats.length - 40);
        }
    }
}

class EnemyBase {
    constructor(x, y, inheritedTarget = null) {
        // Position
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.rotation = 0; // Facing direction (in radians, 0 = right)
        this.rotationSpeed = 0;
        this.rotationBaseline = this.rotation;
        this.rotationBaselineTime = Date.now();
        this.movementHeading = this.rotation;
        
        // Knockback system
        this.knockbackVx = 0;
        this.knockbackVy = 0;
        this.knockbackDecay = 0.5; // Per second decay rate (faster decay = shorter knockback)
        
        // Stun system
        this.stunned = false;
        this.stunDuration = 0;
        this.stunSlowFactor = 0.5; // 50% speed reduction when stunned
        this.baseMoveSpeed = 100; // Store original move speed before stun
        
        // Slow system (separate from stun)
        this.slowed = false;
        this.slowDuration = 0;
        this.slowAmount = 0; // 0.5 = 50% slow
        
        // Burn DoT system (damage over time from incendiary legendary effect)
        this.burning = false;
        this.burnDuration = 0;
        this.burnDPS = 0; // Damage per second
        this.burnTickTimer = 0; // Timer for burn damage ticks
        this.burnTickRate = 0.5; // How often burn damage ticks (seconds)
        this.burnAttackerId = null; // Who applied the burn (for damage attribution)
        
        // Unique ID for multiplayer synchronization
        this.id = `enemy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // Common properties
        this.alive = true;
        
        // Default stats (will be overridden by subclasses)
        this.size = 20;
        this.maxHp = 30;
        this.hp = 30;
        this.damage = 5;
        this.moveSpeed = 100;
        this.color = '#ff6b6b';
        this.xpValue = 10;
        this.lootChance = 0.10; // Reduced from 0.2 for larger rooms
        
        // Track last attacker for kill attribution
        this.lastAttacker = null;
        
        // Contact knockback force applied to players on hit
        this.contactKnockback = 72;
        this.damageProjectionMultiplier = 0.9;
        this.damageProjectionRadius = null;
        
        // Multiplayer interpolation targets (for clients)
        this.targetX = x;
        this.targetY = y;
        this.targetRotation = 0;
        this.lastUpdateTime = 0;
        this.lastVelocityX = 0;
        this.lastVelocityY = 0;
        
        // Threat/aggro system for multiplayer (per-enemy independent tracking)
        this.threatTable = new Map(); // playerId -> [{damage, timestamp}]
        this.currentTarget = inheritedTarget; // Current aggro target (playerId), inherited from parent if spawned
        this.threatWindowDuration = 8.0; // 8 second rolling window (extended for better tank aggro)
        
        // Target lock system (prevents jittering when targeting clones/decoys)
        this.targetLock = null; // Locked target { x, y, type: 'player'|'clone'|'decoy', ref }
        this.targetLockDuration = 1.5; // How long to maintain lock (seconds)
        this.targetLockTimer = 0; // Time remaining on current lock
        
        // Detection/activation system
        this.detectionRange = 400; // Range to detect and activate on player proximity (pixels)
        this.activated = false; // Whether enemy has been activated (detected a player)
        
        // Intelligence scaling system (room-based difficulty)
        this.roomNumber = typeof Game !== 'undefined' ? (Game.roomNumber || 1) : 1;
        this.intelligenceLevel = this.getIntelligenceLevel(this.roomNumber);
        this.coordinationEnabled = false; // Set by subclasses based on room thresholds
        this.lastPlayerAction = null; // Track last player action for reactions
        this.coordinationTimer = 0; // Timer for coordinated attacks
        this.threatLevel = 0; // Perceived threat level of player
        
        // Predictive positioning system
        this.usePredictivePositioning = false; // Enabled by subclasses
        this.predictionLookAhead = 0.5; // How far ahead to predict (seconds)
        
        // Optimal engagement distance
        this.optimalDistance = null; // Preferred distance (set by subclasses)
        this.optimalDistanceTolerance = 20; // Tolerance around optimal distance
        
        // Telegraph system
        this.activeTelegraph = null; // { type, duration, elapsed, intensity, visuals }
        this.telegraphCallbacks = {
            onStart: null,
            onEnd: null
        };
        const telegraphModule = (typeof globalThis !== 'undefined' && globalThis.TelegraphSystem) ? globalThis.TelegraphSystem : null;
        if (!telegraphModule || !telegraphModule.TelegraphManager) {
            throw new Error('TelegraphSystem.TelegraphManager not loaded. Ensure js/enemies/telegraph/telegraph-manager.js is included before EnemyBase.');
        }
        this.telegraphController = new telegraphModule.TelegraphManager(this);

        // Recovery window system
        this.recoveryWindow = null; // { duration, elapsed, vulnerability, modifier }

        // Attack timing system
        this.lastDamageTime = 0; // Track when last damage was taken
        this.damageHistory = []; // Recent damage events for combo detection
        this.comboThreshold = 3; // Number of hits in short time to trigger combo awareness
        
        // Player pattern recognition
        this.playerPatterns = {
            dodgeFrequency: 0,
            attackFrequency: 0,
            preferredDirection: { x: 0, y: 0 },
            movementHistory: []
        };
        this.patternSampleCount = 0;
        this.lastAttackReactionTime = 0;
        this.lastRetreatDecisionTime = 0;
        this.attackAvoidanceBias = 0.75 + Math.random() * 0.5; // 0.75 - 1.25 variation
        
        // Environmental awareness
        this.wallProximity = 0; // 0-1, how close to walls
        this.cornerProximity = 0; // 0-1, how close to corners

        // Smoothing configuration
        this.positionSmoothing = 0.35;
        this.rotationSmoothing = 0.25;
        this.movementHeading = this.rotation;

        // Shared retreat coordination
        if (!EnemyBase.globalRetreatCoordinator) {
            EnemyBase.globalRetreatCoordinator = new GroupRetreatCoordinator();
        }
        this.retreatCoordinator = EnemyBase.globalRetreatCoordinator;

        // Retreat regulation
        this.retreatCooldown = 0;
        this.retreatCooldownTime = 0.75;
        this.retreatHeat = 0;
        this.retreatHeatGain = 0.35;
        this.retreatHeatDecay = 0.25;
        this.maxRetreatHeat = 1.5;
        this.baseRetreatChance = 0.6;
        this.minimumRetreatChance = 0.08;
        this.retreatGroupRadius = 220;
        this.maxGroupRetreatPenalty = 0.65;
    }
    
    // =====================
    // Telegraph System
    // =====================

    beginTelegraph(type, options = {}) {
        return this.telegraphController.begin(type, options);
    }
    
    queueTelegraph(type, options = {}) {
        this.telegraphController.queueTelegraph(type, options);
    }
    
    endTelegraph(options = {}) {
        this.telegraphController.end(options);
    }
    
    cancelTelegraph(options = {}) {
        this.telegraphController.cancel(options);
    }
    
    updateTelegraph(deltaTime) {
        this.telegraphController.update(deltaTime);
    }
    
    // =====================
    // Recovery System
    // =====================
    
    enterRecoveryWindow(duration = 0.4, vulnerability = 'standard', options = {}) {
        let config;
        if (typeof duration === 'object' && duration !== null) {
            config = Object.assign({}, duration);
        } else {
            config = Object.assign({}, options, {
                duration,
                vulnerability
            });
        }
        return this.telegraphController.enterRecovery(config);
    }
    
    cancelRecoveryWindow() {
        this.telegraphController.cancelRecovery(true);
    }
    
    updateRecoveryWindow(deltaTime) {
        this.telegraphController.updateRecovery(deltaTime);
    }
    
    // Calculate intelligence level from room number (0.0 to 1.0)
    getIntelligenceLevel(roomNumber) {
        if (roomNumber <= 3) {
            // Early rooms: 0.5-0.65 (smarter base, faster ramp)
            return 0.5 + (roomNumber / 3) * 0.15;
        } else if (roomNumber <= 10) {
            // Mid rooms: 0.65-0.85 (faster progression)
            return 0.65 + ((roomNumber - 3) / 7) * 0.2;
        } else {
            // Late rooms: 0.85-1.0 (quickly reach max)
            return 0.85 + Math.min((roomNumber - 10) / 10, 0.15);
        }
    }
    
    // Get reaction speed based on intelligence (slower early, faster late)
    getReactionSpeed(baseDelay = 0.3, minDelay = 0.1, maxDelay = 0.6) {
        // Lower intelligence = slower reaction (higher delay)
        // Higher intelligence = faster reaction (lower delay)
        // Base delay reduced and range tightened for more challenging base behavior
        const delay = baseDelay + (maxDelay - baseDelay) * (1 - this.intelligenceLevel);
        return Math.max(minDelay, Math.min(maxDelay, delay));
    }
    
    // Check if a pattern is unlocked for current room
    canUsePattern(patternName, thresholds) {
        if (!thresholds || !thresholds[patternName]) return true; // Default to available
        
        const thresholdRoom = thresholds[patternName];
        return this.roomNumber >= thresholdRoom;
    }
    
    // Get pattern weight based on intelligence and room thresholds
    getPatternWeight(patternName, thresholds, baseWeight = 1.0) {
        if (!this.canUsePattern(patternName, thresholds)) return 0.0;
        
        const thresholdRoom = thresholds[patternName] || 1;
        if (this.roomNumber < thresholdRoom) return 0.0;
        
        // Scale weight from 0 to baseWeight based on how far past threshold we are
        // Faster scaling (3 rooms instead of 5) for quicker ramp-up
        const roomsPastThreshold = Math.max(0, this.roomNumber - thresholdRoom);
        const scalingRooms = 3; // Takes 3 rooms to fully unlock (was 5)
        const weightScale = Math.min(1.0, roomsPastThreshold / scalingRooms);
        
        // Higher base weight multiplier for more challenging base behavior
        return baseWeight * weightScale * (0.7 + this.intelligenceLevel * 0.3);
    }
    
    // Determine behavior weight as smooth function of intelligence (0-1)
    getIntelligenceWeightedValue(minValue, maxValue, curve = 1.0) {
        const t = Math.pow(this.intelligenceLevel, Math.max(0.1, curve));
        return minValue + (maxValue - minValue) * t;
    }

    // =====================
    // Smoothing Helpers
    // =====================

    smoothMoveTo(targetX, targetY, smoothing = this.positionSmoothing) {
        const factor = Math.min(Math.max(smoothing, 0), 1);
        this.x += (targetX - this.x) * factor;
        this.y += (targetY - this.y) * factor;
    }

    smoothMoveBy(offsetX, offsetY, smoothing = this.positionSmoothing) {
        this.applySmoothedOffset(offsetX, offsetY, { smoothing });
    }

    applySmoothedOffset(offsetX, offsetY, options = {}) {
        const smoothing = options.smoothing !== undefined ? options.smoothing : this.positionSmoothing;
        const maintainMagnitude = options.maintainMagnitude !== undefined ? options.maintainMagnitude : true;
        let targetOffsetX = offsetX;
        let targetOffsetY = offsetY;
        if (maintainMagnitude && smoothing > 0) {
            const factor = Math.max(0.0001, smoothing);
            targetOffsetX = offsetX / factor;
            targetOffsetY = offsetY / factor;
        }
        this.smoothMoveTo(this.x + targetOffsetX, this.y + targetOffsetY, smoothing);
    }

    smoothRotateTo(targetAngle, smoothing = this.rotationSmoothing) {
        if (!isFinite(targetAngle)) return;
        const factor = Math.min(Math.max(smoothing, 0), 1);
        let delta = targetAngle - this.rotation;
        delta = normalizeAngle(delta);
        this.rotation += delta * factor;
        this.movementHeading = this.rotation;
    }

    updateSmoothedHeading(targetAngle, smoothing = this.rotationSmoothing) {
        if (!isFinite(targetAngle)) {
            return this.movementHeading !== undefined ? this.movementHeading : this.rotation;
        }
        if (this.movementHeading === undefined || !isFinite(this.movementHeading)) {
            this.movementHeading = targetAngle;
            return this.movementHeading;
        }
        const factor = Math.min(Math.max(smoothing, 0), 1);
        let delta = normalizeAngle(targetAngle - this.movementHeading);
        this.movementHeading = normalizeAngle(this.movementHeading + delta * factor);
        return this.movementHeading;
    }

    applySmoothedDirectionalMovement(dirX, dirY, speed, deltaTime, smoothing = this.rotationSmoothing, updateFacing = true) {
        const magnitude = Math.sqrt(dirX * dirX + dirY * dirY);
        if (magnitude === 0 || !isFinite(magnitude) || speed === 0) {
            return;
        }
        const normX = dirX / magnitude;
        const normY = dirY / magnitude;
        const targetAngle = Math.atan2(normY, normX);
        const heading = this.updateSmoothedHeading(targetAngle, smoothing);
        const moveX = Math.cos(heading) * speed * deltaTime;
        const moveY = Math.sin(heading) * speed * deltaTime;
        this.x += moveX;
        this.y += moveY;
        if (updateFacing) {
            this.rotation = heading;
            this.movementHeading = heading;
        }
    }

    getNearbyAlliesCount(enemies = [], radius = 200, includeSelf = false) {
        if (!enemies || enemies.length === 0) {
            return includeSelf ? 1 : 0;
        }
        const radiusSq = radius * radius;
        let count = includeSelf ? 1 : 0;
        for (let i = 0; i < enemies.length; i++) {
            const other = enemies[i];
            if (!other || other === this || !other.alive) continue;
            const dx = other.x - this.x;
            const dy = other.y - this.y;
            const distSq = dx * dx + dy * dy;
            if (distSq <= radiusSq) {
                count++;
            }
        }
        return count;
    }

    getAdaptiveRetreatDistance(localGroupSize = 1) {
        const clamped = Math.max(1, Math.min(localGroupSize, 8));
        const base = 60;
        const extra = 12 * (clamped - 1);
        return base + extra;
    }

    canAttemptRetreat() {
        return this.retreatCooldown <= 0;
    }

    computeRetreatChance(context = {}) {
        const heatFactor = Math.min(1, this.retreatHeat / this.maxRetreatHeat);
        let chance = this.baseRetreatChance * (1 - heatFactor);
        const localGroupSize = Math.max(1, context.localGroupSize || 1);
        const groupClamp = Math.max(2, context.groupSizeClamp || 8);
        const normalizedGroup = Math.min(groupClamp, localGroupSize);
        // Smaller groups have significantly reduced retreat probability
        const groupModifier = 0.35 + ((normalizedGroup - 1) / (groupClamp - 1)) * 0.65;
        chance *= groupModifier;

        // Early rooms should have more timid retreat behavior
        const roomProgress = Math.min(1, Math.max(0, (this.roomNumber - 1) / 12));
        const roomModifier = 0.45 + roomProgress * 0.55;
        chance *= roomModifier;

        if (context.extraPressure !== undefined) {
            chance *= (1 - Math.min(0.5, context.extraPressure));
        }
        if (this.retreatCoordinator) {
            const groupPenalty = this.retreatCoordinator.getGroupPenalty(this, {
                radius: context.groupRadius || this.retreatGroupRadius,
                maxPenalty: this.maxGroupRetreatPenalty
            });
            chance *= Math.max(0, 1 - groupPenalty);
        }
        return Math.max(this.minimumRetreatChance, Math.min(1, chance));
    }

    recordRetreatAttempt(successful = true) {
        this.retreatCooldown = this.retreatCooldownTime;
        if (successful) {
            this.retreatHeat = Math.min(this.maxRetreatHeat, this.retreatHeat + this.retreatHeatGain);
            if (this.retreatCoordinator) {
                this.retreatCoordinator.registerRetreat(this);
            }
        } else {
            this.retreatHeat = Math.max(0, this.retreatHeat - this.retreatHeatGain * 0.5);
        }
    }
    
    // Update predictive positioning weight with intelligence
    getPredictiveWeight(base = 0.35, max = 0.85) {
        return this.getIntelligenceWeightedValue(base, max, 0.75);
    }
    
    // Update coordination aggressiveness weight with intelligence
    getCoordinationAggression(base = 0.25, max = 0.8) {
        return this.getIntelligenceWeightedValue(base, max, 0.6);
    }
    
    // React to player action (scaled by intelligence)
    reactToPlayerAction(action, player) {
        if (!player) return;
        
        // Store last action for pattern selection
        this.lastPlayerAction = {
            type: action,
            timestamp: Date.now(),
            player: player
        };
    }
    
    // Determine the center position of a player attack hitbox (world coordinates)
    getHitboxCenter(hitbox, player = null) {
        if (!hitbox) {
            return {
                x: player ? player.x : this.x,
                y: player ? player.y : this.y
            };
        }
        
        const fallbackX = player ? player.x : this.x;
        const fallbackY = player ? player.y : this.y;
        
        const centerX = hitbox.x !== undefined ? hitbox.x :
            (hitbox.centerX !== undefined ? hitbox.centerX : fallbackX);
        const centerY = hitbox.y !== undefined ? hitbox.y :
            (hitbox.centerY !== undefined ? hitbox.centerY : fallbackY);
        
        return { x: centerX, y: centerY };
    }
    
    // Estimate a representative radius for a hitbox (used for threat detection)
    getHitboxBaseRadius(hitbox) {
        if (!hitbox) return 0;
        
        if (typeof hitbox.radius === 'number') {
            return Math.abs(hitbox.radius);
        }
        
        if (hitbox.width !== undefined || hitbox.height !== undefined) {
            const width = Math.abs(hitbox.width || 0);
            const height = Math.abs(hitbox.height || 0);
            return Math.max(width, height) * 0.5;
        }
        
        if (hitbox.halfWidth !== undefined || hitbox.halfHeight !== undefined) {
            return Math.max(Math.abs(hitbox.halfWidth || 0), Math.abs(hitbox.halfHeight || 0));
        }
        
        if (hitbox.length !== undefined) {
            return Math.abs(hitbox.length) * 0.5;
        }
        
        if (hitbox.size !== undefined) {
            return Math.abs(hitbox.size);
        }
        
        return 0;
    }
    
    // Calculate an expanded threat radius for a hitbox with padding for enemy size
    getHitboxThreatRadius(hitbox, options = {}) {
        const expansion = options.expansion !== undefined ? options.expansion : 1.2;
        const includeEnemySize = options.includeEnemySize !== false;
        const padding = options.padding !== undefined ? options.padding : Math.max(this.size * 0.35, 8);
        
        const baseRadius = this.getHitboxBaseRadius(hitbox);
        const sizePadding = includeEnemySize ? this.size * 0.5 : 0;
        
        const threatRadius = baseRadius * expansion + padding + sizePadding;
        return Math.max(threatRadius, padding + sizePadding);
    }
    
    // Determine if a single hitbox currently threatens this enemy
    isHitboxThreatening(hitbox, player = null, options = {}) {
        if (!hitbox) return false;
        
        const center = this.getHitboxCenter(hitbox, player);
        const threatRadius = this.getHitboxThreatRadius(hitbox, options);
        if (threatRadius <= 0) return false;
        
        const dx = this.x - center.x;
        const dy = this.y - center.y;
        return (dx * dx + dy * dy) <= (threatRadius * threatRadius);
    }
    
    // Gather detailed information about the strongest player attack threat
    getPlayerAttackThreatInfo(player, options = {}) {
        const emptyInfo = {
            threatening: false,
            proximity: 0,
            rawProximity: -Infinity,
            distance: Infinity,
            threatRadius: 0,
            hitbox: null,
            center: null
        };
        
        if (!player || !player.attackHitboxes || player.attackHitboxes.length === 0) {
            return emptyInfo;
        }
        
        const expansion = options.expansion !== undefined ? options.expansion : 1.2;
        const padding = options.padding !== undefined ? options.padding : Math.max(this.size * 0.35, 10);
        const includeEnemySize = options.includeEnemySize !== undefined ? options.includeEnemySize : true;
        
        let best = null;
        
        for (let i = 0; i < player.attackHitboxes.length; i++) {
            const hitbox = player.attackHitboxes[i];
            const center = this.getHitboxCenter(hitbox, player);
            const threatRadius = this.getHitboxThreatRadius(hitbox, {
                expansion,
                padding,
                includeEnemySize
            });
            
            if (threatRadius <= 0) continue;
            
            const dx = this.x - center.x;
            const dy = this.y - center.y;
            const distSq = dx * dx + dy * dy;
            const dist = Math.sqrt(distSq);
            const proximity = threatRadius > 0 ? (threatRadius - dist) / threatRadius : 0; // >0 when inside
            
            if (!best || proximity > best.proximity) {
                best = {
                    threatening: proximity > 0,
                    proximity: Math.max(0, proximity),
                    rawProximity: proximity,
                    distance: dist,
                    threatRadius: threatRadius,
                    hitbox,
                    center
                };
            }
        }
        
        return best || emptyInfo;
    }
    
    // Determine if any of the player's active attack hitboxes threaten this enemy
    isPlayerAttackThreatening(player, options = {}) {
        const info = this.getPlayerAttackThreatInfo(player, options);
        return !!(info && info.threatening);
    }
    
    // Decide if this enemy should react to a threatening player attack (returns reaction info)
    shouldReactToPlayerAttack(player, options = {}) {
        const info = this.getPlayerAttackThreatInfo(player, options);
        if (!info || !info.threatening) {
            return { shouldReact: false, info, chance: 0 };
        }
        
        const now = Date.now();
        const cooldownMs = options.cooldownMs !== undefined ? options.cooldownMs : 250;
        if (cooldownMs > 0 && now - this.lastAttackReactionTime < cooldownMs) {
            return { shouldReact: false, info, chance: 0 };
        }
        
        const baseChance = options.baseChance !== undefined ? options.baseChance : (0.06 + this.intelligenceLevel * 0.12);
        const proximityWeight = options.proximityWeight !== undefined ? options.proximityWeight : 0.35;
        const bonus = options.additionalBonus !== undefined ? options.additionalBonus : 0;
        const maxChance = options.maxChance !== undefined ? options.maxChance : 0.25;
        const minChance = options.minChance !== undefined ? options.minChance : 0.02;
        
        let chance = baseChance + info.proximity * proximityWeight + bonus;
        chance = Math.max(minChance, Math.min(maxChance, chance));
        
        const shouldReact = Math.random() < chance;
        if (shouldReact) {
            this.lastAttackReactionTime = now;
        }
        
        return { shouldReact, info, chance };
    }
    
    // Assess threat level of player
    assessThreat(player) {
        if (!player) return 0;
        
        let threat = 0;
        
        // Factor 1: Player HP (lower HP = higher threat priority)
        const hpPercent = player.hp / (player.maxHp || 100);
        threat += (1 - hpPercent) * 0.3;
        
        // Factor 2: Player is attacking
        if (this.isPlayerAttackThreatening(player, { expansion: 1.1, padding: 8, includeEnemySize: false })) {
            threat += 0.4;
        }
        
        // Factor 3: Player is dodging (vulnerable after)
        if (player.isDodging) {
            threat += 0.2;
        }
        
        // Factor 4: Distance (closer = more threatening)
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const maxDistance = 300;
        threat += (1 - Math.min(distance / maxDistance, 1)) * 0.1;
        
        this.threatLevel = Math.min(1.0, threat);
        return this.threatLevel;
    }
    
    // Coordinate with nearby enemies (if coordination enabled)
    coordinateWithAllies(enemies) {
        if (!this.coordinationEnabled || !enemies) return null;
        
        const coordinationRange = 200;
        const nearbyAllies = [];
        
        enemies.forEach(other => {
            if (other === this || !other.alive) return;
            
            const dx = other.x - this.x;
            const dy = other.y - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < coordinationRange) {
                nearbyAllies.push({ enemy: other, distance: dist });
            }
        });
        
        return nearbyAllies.length > 0 ? nearbyAllies : null;
    }
    
    assignCoordinationRole(enemies) {
        if (!this.coordinationEnabled) {
            this.coordinationRole = null;
            return null;
        }
        
        const allies = this.coordinateWithAllies(enemies);
        if (!allies) {
            this.coordinationRole = null;
            return null;
        }
        
        // Determine highest threat player among allies for focal point
        let highestThreat = 0;
        let highestThreatEnemy = this;
        allies.forEach(({ enemy }) => {
            if (enemy.threatLevel > highestThreat) {
                highestThreat = enemy.threatLevel;
                highestThreatEnemy = enemy;
            }
        });
        
        const index = allies.findIndex(({ enemy }) => enemy === this);
        const roleWeights = {
            vanguard: 0.4,
            flanker: 0.3,
            support: 0.3
        };
        const aggression = this.getCoordinationAggression();
        let role;
        if (this === highestThreatEnemy || Math.random() < aggression) {
            role = 'vanguard';
        } else if (index % 2 === 0) {
            role = 'flanker';
        } else {
            role = 'support';
        }
        
        this.coordinationRole = role;
        return role;
    }
    
    // Apply knockback force
    applyKnockback(forceX, forceY) {
        this.knockbackVx = forceX;
        this.knockbackVy = forceY;
    }
    
    // Apply stun effect
    applyStun(duration) {
        this.stunned = true;
        this.stunDuration = duration;
        // Store base move speed if not already stored
        if (this.baseMoveSpeed === undefined || this.baseMoveSpeed === null) {
            this.baseMoveSpeed = this.moveSpeed;
        }
    }
    
    // Process stun (should be called in update before movement)
    processStun(deltaTime) {
        if (this.stunned && this.stunDuration > 0) {
            this.stunDuration -= deltaTime;
            if (this.stunDuration <= 0) {
                this.stunned = false;
                this.stunDuration = 0;
            }
        }
    }
    
    // Apply slow effect (separate from stun, activates after stun if both applied)
    applySlow(slowAmount, duration) {
        this.slowed = true;
        this.slowAmount = slowAmount;
        this.slowDuration = duration;
        // Store base move speed if not already stored
        if (this.baseMoveSpeed === undefined || this.baseMoveSpeed === null) {
            this.baseMoveSpeed = this.moveSpeed;
        }
    }
    
    // Process slow (should be called in update before movement)
    processSlow(deltaTime) {
        if (this.slowed && this.slowDuration > 0) {
            this.slowDuration -= deltaTime;
            if (this.slowDuration <= 0) {
                this.slowed = false;
                this.slowDuration = 0;
                this.slowAmount = 0;
            }
        }
    }
    
    // Apply burn DoT effect
    applyBurn(dps, duration, attackerId = null) {
        this.burning = true;
        this.burnDPS = dps;
        this.burnDuration = duration;
        this.burnAttackerId = attackerId;
        this.burnTickTimer = 0; // Reset tick timer to apply damage immediately on next tick
    }
    
    // Process burn DoT (should be called in update)
    processBurn(deltaTime) {
        if (this.burning && this.burnDuration > 0) {
            this.burnDuration -= deltaTime;
            this.burnTickTimer += deltaTime;
            
            // Apply burn damage at tick rate
            if (this.burnTickTimer >= this.burnTickRate) {
                const tickDamage = this.burnDPS * this.burnTickRate;
                const damageDealt = Math.min(tickDamage, this.hp);
                
                // Apply damage
                this.takeDamage(tickDamage, this.burnAttackerId);
                
                // Track stats (host/solo only)
                const isClient = typeof Game !== 'undefined' && Game.isMultiplayerClient && Game.isMultiplayerClient();
                if (!isClient && typeof Game !== 'undefined' && Game.getPlayerStats && this.burnAttackerId) {
                    const stats = Game.getPlayerStats(this.burnAttackerId);
                    if (stats) {
                        stats.addStat('damageDealt', damageDealt);
                    }
                    
                    // Track kill if enemy died
                    if (this.hp <= 0) {
                        const killStats = Game.getPlayerStats(this.burnAttackerId);
                        if (killStats) {
                            killStats.addStat('kills', 1);
                        }
                    }
                }
                
                // Reset tick timer
                this.burnTickTimer = 0;
                
                // Create damage number for burn tick
                if (typeof createDamageNumber !== 'undefined') {
                    createDamageNumber(this.x, this.y, Math.floor(tickDamage), false, false);
                }
            }
            
            // End burn if duration expired
            if (this.burnDuration <= 0) {
                this.burning = false;
                this.burnDuration = 0;
                this.burnDPS = 0;
                this.burnTickTimer = 0;
                this.burnAttackerId = null;
            }
        }
    }
    
    // Get effective movement speed considering stun and slow
    getEffectiveMoveSpeed() {
        let speed = this.baseMoveSpeed;
        
        // Apply stun (takes priority, cannot be slowed while stunned)
        if (this.stunned) {
            speed *= this.stunSlowFactor;
        } 
        // Apply slow (only if not stunned)
        else if (this.slowed) {
            speed *= (1 - this.slowAmount);
        }
        
        return speed;
    }
    
    // Update target lock timer (should be called in update)
    updateTargetLock(deltaTime) {
        if (this.targetLockTimer > 0) {
            this.targetLockTimer -= deltaTime;
            if (this.targetLockTimer <= 0) {
                this.targetLock = null;
                this.targetLockTimer = 0;
            }
        }
    }
    
    // Check if enemy should activate based on player proximity
    checkDetection() {
        // If already activated, stay activated
        if (this.activated) return true;
        
        // Check if we're in a boss room - minions should activate immediately
        const isBossRoom = (typeof currentRoom !== 'undefined' && currentRoom && currentRoom.type === 'boss');
        
        // If enemy has an inherited aggro target (from spawner), activate immediately
        if (this.currentTarget) {
            this.activated = true;
            // Switch from standby to normal state (each enemy type has different initial state)
            if (this.state === 'standby') {
                // Determine appropriate state based on enemy type
                if (this.shape === 'diamond') {
                    this.state = 'circle';
                } else {
                    this.state = 'chase'; // Default for basic, rectangle, octagon enemies
                }
            }
            return true;
        }
        
        // In boss rooms, activate immediately and assign a target (range doesn't matter)
        if (isBossRoom) {
            const allPlayers = this.getAllAlivePlayers();
            if (allPlayers.length > 0) {
                // Assign a target (use assignInitialTarget logic or pick first alive player)
                const alivePlayers = allPlayers.filter(p => p.player && p.player.alive !== false);
                if (alivePlayers.length > 0) {
                    // Pick a random alive player as target
                    const randomIndex = Math.floor(Math.random() * alivePlayers.length);
                    this.currentTarget = alivePlayers[randomIndex].id;
                    this.activated = true;
                    // Switch from standby to normal state
                    if (this.state === 'standby') {
                        if (this.shape === 'diamond') {
                            this.state = 'circle';
                        } else {
                            this.state = 'chase';
                        }
                    }
                    return true;
                }
            }
        }
        
        // Check distance to all alive players
        const allPlayers = this.getAllAlivePlayers();
        if (allPlayers.length === 0) return false;
        
        for (const playerData of allPlayers) {
            const dx = playerData.player.x - this.x;
            const dy = playerData.player.y - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // If any player is within detection range, activate
            if (distance <= this.detectionRange) {
                this.activated = true;
                // Switch from standby to normal state (each enemy type has different initial state)
                if (this.state === 'standby') {
                    // Determine appropriate state based on enemy type
                    if (this.shape === 'diamond') {
                        this.state = 'circle';
                    } else {
                        this.state = 'chase'; // Default for basic, rectangle, octagon enemies
                    }
                }
                return true;
            }
        }
        
        return false;
    }
    
    // Find the target to chase (handles aggro in multiplayer, decoy/clone logic)
    findTarget(player) {
        // Check if we have a valid target lock
        if (this.targetLock && this.targetLockTimer > 0) {
            // Validate that locked target still exists
            let lockValid = false;
            
            if (this.targetLock.type === 'decoy') {
                // Check if decoy is still active
                const targetPlayer = this.targetLock.playerRef;
                if (targetPlayer && targetPlayer.blinkDecoyActive) {
                    this.targetLock.x = targetPlayer.blinkDecoyX;
                    this.targetLock.y = targetPlayer.blinkDecoyY;
                    lockValid = true;
                }
            } else if (this.targetLock.type === 'clone') {
                // Check if clone still exists and has health
                const targetPlayer = this.targetLock.playerRef;
                const cloneIndex = this.targetLock.cloneIndex;
                if (targetPlayer && targetPlayer.shadowClonesActive && 
                    targetPlayer.shadowClones && targetPlayer.shadowClones[cloneIndex] &&
                    targetPlayer.shadowClones[cloneIndex].health > 0) {
                    const clone = targetPlayer.shadowClones[cloneIndex];
                    this.targetLock.x = clone.x;
                    this.targetLock.y = clone.y;
                    lockValid = true;
                }
            } else if (this.targetLock.type === 'player') {
                // Check if player is still alive
                const targetPlayer = this.targetLock.playerRef;
                if (targetPlayer && (targetPlayer.alive || targetPlayer.hp > 0)) {
                    this.targetLock.x = targetPlayer.x;
                    this.targetLock.y = targetPlayer.y;
                    lockValid = true;
                }
            }
            
            if (lockValid) {
                return { x: this.targetLock.x, y: this.targetLock.y };
            } else {
                // Lock invalid, clear it
                this.targetLock = null;
                this.targetLockTimer = 0;
            }
        }
        
        // No valid lock, find new target and create lock
        let targetX, targetY, lockType, lockPlayerRef, lockCloneIndex;
        
        // Unified system for both single player and multiplayer
        // Use radius-based targeting with damage override via currentTarget
        if (typeof Game !== 'undefined' && Game.multiplayerEnabled) {
            // In multiplayer, check if we have a currentTarget (from damage or spawn inheritance)
            let targetPlayer = null;
            
            if (this.currentTarget) {
                targetPlayer = this.getPlayerById(this.currentTarget);
                // Verify target is still alive
                if (!targetPlayer || !targetPlayer.alive || (targetPlayer.hp !== undefined && targetPlayer.hp <= 0)) {
                    // Current target died, clear it and find nearest player
                    this.currentTarget = null;
                    targetPlayer = null;
                }
            }
            
            // If no current target or target died, find nearest player
            if (!targetPlayer) {
                const nearestPlayerData = this.getNearestPlayer();
                if (nearestPlayerData && nearestPlayerData.alive) {
                    targetPlayer = nearestPlayerData;
                    // Don't set currentTarget here - only damage sets it
                } else {
                    // No alive players, return current position
                    return { x: this.x, y: this.y };
                }
            }
            
            // Now we have a valid target player, check for decoys/clones
            if (targetPlayer.blinkDecoyActive) {
                targetX = targetPlayer.blinkDecoyX;
                targetY = targetPlayer.blinkDecoyY;
                lockType = 'decoy';
                lockPlayerRef = targetPlayer;
            } else if (targetPlayer.shadowClonesActive && targetPlayer.shadowClones && targetPlayer.shadowClones.length > 0) {
                // Target nearest shadow clone and LOCK onto it
                let nearestDist = Infinity;
                let nearestClone = null;
                let nearestIndex = -1;
                
                targetPlayer.shadowClones.forEach((clone, index) => {
                    if (clone.health > 0) {
                        const dist = Math.sqrt((clone.x - this.x) ** 2 + (clone.y - this.y) ** 2);
                        if (dist < nearestDist) {
                            nearestDist = dist;
                            nearestClone = clone;
                            nearestIndex = index;
                        }
                    }
                });
                
                if (nearestClone) {
                    targetX = nearestClone.x;
                    targetY = nearestClone.y;
                    lockType = 'clone';
                    lockPlayerRef = targetPlayer;
                    lockCloneIndex = nearestIndex;
                } else {
                    // No valid clones, target player
                    targetX = targetPlayer.x;
                    targetY = targetPlayer.y;
                    lockType = 'player';
                    lockPlayerRef = targetPlayer;
                }
            } else {
                // No decoys/clones, target player
                targetX = targetPlayer.x;
                targetY = targetPlayer.y;
                lockType = 'player';
                lockPlayerRef = targetPlayer;
            }
            
            // Create target lock
            this.targetLock = {
                x: targetX,
                y: targetY,
                type: lockType,
                playerRef: lockPlayerRef,
                cloneIndex: lockCloneIndex
            };
            this.targetLockTimer = this.targetLockDuration;
            
            return { x: targetX, y: targetY };
        }
        
        // Solo mode - target local player
        // If player is null/undefined, get local player from Game
        let targetPlayer = player;
        if (!targetPlayer && typeof Game !== 'undefined' && Game.player) {
            targetPlayer = Game.player;
        }
        
        if (!targetPlayer || !targetPlayer.alive) return { x: this.x, y: this.y };
        
        // Check if player has a blink decoy or shadow clones active - target decoy/clone instead of player
        if (targetPlayer.blinkDecoyActive) {
            targetX = targetPlayer.blinkDecoyX;
            targetY = targetPlayer.blinkDecoyY;
            lockType = 'decoy';
            lockPlayerRef = targetPlayer;
        } else if (targetPlayer.shadowClonesActive && targetPlayer.shadowClones && targetPlayer.shadowClones.length > 0) {
            // Target the nearest shadow clone instead of the player and LOCK onto it
            let nearestDist = Infinity;
            let nearestClone = null;
            let nearestIndex = -1;
            
            targetPlayer.shadowClones.forEach((clone, index) => {
                if (clone.health > 0) {
                    const dist = Math.sqrt((clone.x - this.x) ** 2 + (clone.y - this.y) ** 2);
                    if (dist < nearestDist) {
                        nearestDist = dist;
                        nearestClone = clone;
                        nearestIndex = index;
                    }
                }
            });
            
            if (nearestClone) {
                targetX = nearestClone.x;
                targetY = nearestClone.y;
                lockType = 'clone';
                lockPlayerRef = targetPlayer;
                lockCloneIndex = nearestIndex;
            } else {
                // No valid clones, target player
                targetX = targetPlayer.x;
                targetY = targetPlayer.y;
                lockType = 'player';
                lockPlayerRef = targetPlayer;
            }
        } else {
            // No decoys/clones, target player
            targetX = targetPlayer.x;
            targetY = targetPlayer.y;
            lockType = 'player';
            lockPlayerRef = targetPlayer;
        }
        
        // Create target lock
        this.targetLock = {
            x: targetX,
            y: targetY,
            type: lockType,
            playerRef: lockPlayerRef,
            cloneIndex: lockCloneIndex
        };
        this.targetLockTimer = this.targetLockDuration;
        
        return { x: targetX, y: targetY };
    }
    
    // Process knockback (should be called before AI movement in update)
    processKnockback(deltaTime) {
        if (this.knockbackVx !== 0 || this.knockbackVy !== 0) {
            this.x += this.knockbackVx * deltaTime;
            this.y += this.knockbackVy * deltaTime;
            
            // Decay knockback over time
            this.knockbackVx *= Math.pow(this.knockbackDecay, deltaTime);
            this.knockbackVy *= Math.pow(this.knockbackDecay, deltaTime);
            
            // Stop if knockback is very small
            if (Math.abs(this.knockbackVx) < 1) this.knockbackVx = 0;
            if (Math.abs(this.knockbackVy) < 1) this.knockbackVy = 0;
        }
    }
    
    // Take damage
    takeDamage(damage, attackerId = null) {
        this.hp -= damage;
        
        // Record damage for combo detection
        this.recordDamage(damage);
        
        // Track who dealt the damage (for kill attribution and aggro)
        if (attackerId) {
            this.lastAttacker = attackerId;
            // Add threat for aggro system
            this.addThreat(attackerId, damage);
        } else if (typeof Game !== 'undefined' && Game.getLocalPlayerId) {
            this.lastAttacker = Game.getLocalPlayerId();
            this.addThreat(Game.getLocalPlayerId(), damage);
        }
        
        if (this.hp <= 0) {
            this.die();
        }
    }
    
    // Die and handle death logic
    // NOTE: Only called on host or in solo mode. Clients receive death via game_state sync.
    die() {
        this.alive = false;
        this.deathTime = Date.now(); // Track when enemy died (for delayed removal)
        
        // Track kill for the last attacker
        if (this.lastAttacker && typeof Game !== 'undefined' && Game.getPlayerStats) {
            const stats = Game.getPlayerStats(this.lastAttacker);
            stats.addStat('kills', 1);
        }
        
        // Emit particles on death
        if (typeof createParticleBurst !== 'undefined') {
            createParticleBurst(this.x, this.y, this.color, 12);
        }
        
        // Give XP to all alive players (multiplayer: host distributes; solo: local player)
        if (typeof Game !== 'undefined' && Game.distributeXPToAllPlayers && this.xpValue) {
            Game.distributeXPToAllPlayers(this.xpValue);
        }
        
        // Drop loot based on lootChance (loot syncs via game_state in multiplayer)
        if (typeof generateGear !== 'undefined' && typeof groundLoot !== 'undefined') {
            if (Math.random() < this.lootChance) {
                const roomNum = typeof Game !== 'undefined' ? (Game.roomNumber || 1) : 1;
                // Default to 'basic' difficulty for base class (can be overridden in subclasses)
                const gear = generateGear(this.x, this.y, roomNum, 'basic');
                groundLoot.push(gear);
                console.log(`Dropped loot at (${Math.floor(this.x)}, ${Math.floor(this.y)})`);
            }
        }
    }
    
    // Keep enemy within room bounds (not canvas bounds)
    keepInBounds() {
        if (typeof currentRoom !== 'undefined' && currentRoom) {
            this.x = clamp(this.x, this.size, currentRoom.width - this.size);
            this.y = clamp(this.y, this.size, currentRoom.height - this.size);
        } else if (typeof Game !== 'undefined') {
            // Fallback to canvas bounds if room not available
            this.x = clamp(this.x, this.size, Game.canvas.width - this.size);
            this.y = clamp(this.y, this.size, Game.canvas.height - this.size);
        }
    }
    
    // Render health bar
    renderHealthBar(ctx) {
        const barWidth = this.size * 2;
        const barHeight = 3;
        const barX = this.x - barWidth / 2;
        const barY = this.y - this.size - 10;
        
        // Draw background (total HP bar in red)
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(barX, barY, barWidth, barHeight);
        
        // Draw foreground (current HP bar in green)
        const hpPercent = this.hp / this.maxHp;
        ctx.fillStyle = '#00ff00';
        ctx.fillRect(barX, barY, barWidth * hpPercent, barHeight);
        
        // Draw border
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barWidth, barHeight);
    }
    
    // AI Behavior Methods - Shared across all enemies
    
    // Calculate separation force to avoid crowding with other enemies
    getSeparationForce(enemies, separationRadius = 40, separationStrength = 150) {
        if (!enemies || enemies.length === 0) return { x: 0, y: 0 };
        
        let separationX = 0;
        let separationY = 0;
        let count = 0;
        
        enemies.forEach(other => {
            if (other === this || !other.alive) return;
            
            const dx = this.x - other.x;
            const dy = this.y - other.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist > 0 && dist < separationRadius) {
                const strength = separationStrength / (dist + 1);
                separationX += (dx / dist) * strength;
                separationY += (dy / dist) * strength;
                count++;
            }
        });
        
        if (count > 0) {
            return { x: separationX, y: separationY };
        }
        return { x: 0, y: 0 };
    }
    
    // Check for obstacles (enemies) directly in path to target
    checkPathObstacles(targetX, targetY, enemies, checkRadius = 30, lookAheadDistance = 80) {
        if (!enemies || enemies.length === 0) return null;
        
        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const distToTarget = Math.sqrt(dx * dx + dy * dy);
        
        if (distToTarget <= 0) return null;
        
        const dirX = dx / distToTarget;
        const dirY = dy / distToTarget;
        
        // Check along path for obstacles
        let closestObstacle = null;
        let closestDist = Infinity;
        
        enemies.forEach(other => {
            if (other === this || !other.alive) return;
            
            // Vector from this enemy to other enemy
            const toOtherX = other.x - this.x;
            const toOtherY = other.y - this.y;
            const distToOther = Math.sqrt(toOtherX * toOtherX + toOtherY * toOtherY);
            
            // Project other enemy onto path direction
            const projection = toOtherX * dirX + toOtherY * dirY;
            
            // Only consider enemies in front (positive projection) and within look-ahead distance
            if (projection > 0 && projection < lookAheadDistance) {
                // Calculate perpendicular distance from path
                const perpX = toOtherX - dirX * projection;
                const perpY = toOtherY - dirY * projection;
                const perpDist = Math.sqrt(perpX * perpX + perpY * perpY);
                
                // Check if enemy is blocking the path
                const combinedRadius = this.size + other.size + checkRadius;
                if (perpDist < combinedRadius && distToOther < closestDist) {
                    closestObstacle = {
                        enemy: other,
                        distance: distToOther,
                        projection: projection,
                        perpDist: perpDist,
                        perpX: perpX,
                        perpY: perpY
                    };
                    closestDist = distToOther;
                }
            }
        });
        
        return closestObstacle;
    }
    
    // Calculate avoidance force for obstacles in path (smooth and natural)
    getPathAvoidance(targetX, targetY, enemies, avoidanceStrength = 200) {
        const obstacle = this.checkPathObstacles(targetX, targetY, enemies);
        if (!obstacle) return { x: 0, y: 0 };
        
        // Avoid by moving perpendicular to path
        const perpDist = Math.sqrt(obstacle.perpX * obstacle.perpX + obstacle.perpY * obstacle.perpY);
        if (perpDist <= 0) return { x: 0, y: 0 };
        
        // Smooth avoidance curve - only significant when very close
        // Use smoothstep-like function for natural feel
        const normalizedDist = Math.max(0, Math.min(1, obstacle.distance / 80));
        const smoothFactor = normalizedDist * normalizedDist * (3 - 2 * normalizedDist); // Smoothstep
        const strength = avoidanceStrength * (1 - smoothFactor) * 0.6; // Reduced max strength for subtlety
        const avoidX = (obstacle.perpX / perpDist) * strength;
        const avoidY = (obstacle.perpY / perpDist) * strength;
        
        return { x: avoidX, y: avoidY };
    }
    
    // Calculate lateral spread force to break formations (subtle and natural)
    getLateralSpreadForce(targetX, targetY, enemies, spreadRadius = 120, spreadStrength = 100) {
        if (!enemies || enemies.length === 0) return { x: 0, y: 0 };
        
        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const distToTarget = Math.sqrt(dx * dx + dy * dy);
        if (distToTarget <= 0) return { x: 0, y: 0 };
        
        const dirX = dx / distToTarget;
        const dirY = dy / distToTarget;
        
        // Perpendicular vectors (left and right of path)
        const perpLeftX = -dirY;
        const perpLeftY = dirX;
        const perpRightX = dirY;
        const perpRightY = -dirX;
        
        // Count enemies on each side with distance weighting
        let leftWeight = 0;
        let rightWeight = 0;
        
        enemies.forEach(other => {
            if (other === this || !other.alive) return;
            
            const toOtherX = other.x - this.x;
            const toOtherY = other.y - this.y;
            const distToOther = Math.sqrt(toOtherX * toOtherX + toOtherY * toOtherY);
            
            // Only consider nearby enemies, with stronger weight for closer ones
            if (distToOther < spreadRadius && distToOther > 0) {
                // Project onto perpendicular
                const perpProj = toOtherX * perpLeftX + toOtherY * perpLeftY;
                // Inverse square weighting for natural falloff
                const weight = 1 / (distToOther * distToOther + 10);
                
                if (perpProj > 0) {
                    leftWeight += weight;
                } else {
                    rightWeight += weight;
                }
            }
        });
        
        // Only apply spread if there's a significant imbalance (threshold increased for subtlety)
        const imbalance = Math.abs(leftWeight - rightWeight);
        const threshold = 0.15; // Higher threshold = less sensitive
        
        if (imbalance > threshold) {
            // Smooth strength based on imbalance
            const strengthScale = Math.min(imbalance / threshold, 2.0) * 0.4; // Max 40% of base strength
            if (leftWeight > rightWeight) {
                return { x: perpRightX * spreadStrength * strengthScale, y: perpRightY * spreadStrength * strengthScale };
            } else {
                return { x: perpLeftX * spreadStrength * strengthScale, y: perpLeftY * spreadStrength * strengthScale };
            }
        }
        
        return { x: 0, y: 0 };
    }
    
    // Calculate avoidance force to dodge player attacks
    avoidPlayerAttacks(player, options = {}) {
        if (!player || !player.attackHitboxes || player.attackHitboxes.length === 0) {
            return { x: 0, y: 0 };
        }
        
        const expansion = options.expansion !== undefined ? options.expansion : 1.15;
        const padding = options.padding !== undefined ? options.padding : Math.max(this.size * 0.35, 8);
        const includeEnemySize = options.includeEnemySize !== undefined ? options.includeEnemySize : true;
        const strengthMultiplier = options.strengthMultiplier !== undefined ? options.strengthMultiplier : 220;
        const avoidanceBias = options.avoidanceBias !== undefined ? options.avoidanceBias : this.attackAvoidanceBias;
        const bias = Math.max(0, avoidanceBias);
        
        let avoidanceX = 0;
        let avoidanceY = 0;
        
        player.attackHitboxes.forEach(hitbox => {
            const center = this.getHitboxCenter(hitbox, player);
            const dx = this.x - center.x;
            const dy = this.y - center.y;
            const distSq = dx * dx + dy * dy;
            const threatRadius = this.getHitboxThreatRadius(hitbox, {
                expansion,
                padding,
                includeEnemySize
            });
            const radiusSq = threatRadius * threatRadius;
            
            if (distSq < radiusSq && distSq > 0.0001) {
                const dist = Math.sqrt(distSq);
                const penetration = (threatRadius - dist) / threatRadius;
                const strength = penetration * strengthMultiplier * bias;
                avoidanceX += (dx / dist) * strength;
                avoidanceY += (dy / dist) * strength;
            }
        });
        
        return { x: avoidanceX, y: avoidanceY };
    }
    
    // Predict where player will be based on current velocity
    predictPlayerPosition(player, timeToReach) {
        if (!player || !player.alive) return { x: this.x, y: this.y };
        
        // If player isn't moving, return current position
        if (!player.vx && !player.vy) {
            return { x: player.x, y: player.y };
        }
        
        // Predict based on current velocity (with damping for accuracy)
        const predictedX = player.x + player.vx * timeToReach * 0.7;
        const predictedY = player.y + player.vy * timeToReach * 0.7;
        
        return { x: predictedX, y: predictedY };
    }
    
    // Get predicted target position for intercepting player movement
    getPredictedTargetPosition(player, lookAheadTime = null) {
        if (!player || !player.alive) return { x: player.x, y: player.y };
        
        if (lookAheadTime === null) {
            lookAheadTime = this.predictionLookAhead;
        }
        
        // Calculate direction to player
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance <= 0) return { x: player.x, y: player.y };
        
        // Calculate player's movement direction relative to enemy
        const playerSpeed = Math.sqrt(player.vx * player.vx + player.vy * player.vy);
        if (playerSpeed <= 0) {
            // Player not moving, use current position
            return { x: player.x, y: player.y };
        }
        
        // Normalize direction to player
        const toPlayerX = dx / distance;
        const toPlayerY = dy / distance;
        
        // Normalize player velocity
        const playerDirX = player.vx / playerSpeed;
        const playerDirY = player.vy / playerSpeed;
        
        // Calculate dot product: positive = moving toward enemy, negative = moving away
        const dotProduct = toPlayerX * playerDirX + toPlayerY * playerDirY;
        
        // If player is moving directly toward enemy (dot product > 0.7), don't use prediction
        // This prevents enemies from trying to move backward when player charges them
        if (dotProduct > 0.7) {
            // Player moving directly toward enemy - use current position
            return { x: player.x, y: player.y };
        }
        
        // Calculate time to reach player
        const timeToReach = distance / (this.moveSpeed || 100);
        
        // Use prediction if player is moving laterally or away
        if (player.vx !== 0 || player.vy !== 0) {
            const predictionFactor = Math.min(this.intelligenceLevel, 0.8); // Cap at 80% for realism
            const predicted = this.predictPlayerPosition(player, timeToReach * predictionFactor);
            
            // Validate prediction: ensure it doesn't cause enemy to move away from player
            const predDx = predicted.x - this.x;
            const predDy = predicted.y - this.y;
            const predDist = Math.sqrt(predDx * predDx + predDy * predDy);
            
            if (predDist > 0) {
                const predDirX = predDx / predDist;
                const predDirY = predDy / predDist;
                
                // Check if predicted direction is still toward player (or at least not away)
                const predDotProduct = toPlayerX * predDirX + toPlayerY * predDirY;
                
                // If prediction would cause backward movement (dot product < 0), use current position instead
                if (predDotProduct < 0) {
                    return { x: player.x, y: player.y };
                }
            }
            
            return predicted;
        }
        
        return { x: player.x, y: player.y };
    }
    
    // Calculate optimal position based on engagement distance
    getOptimalPosition(targetX, targetY, preferredDistance, minDistance = null, maxDistance = null) {
        if (!preferredDistance) return { x: targetX, y: targetY };
        
        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const currentDistance = Math.sqrt(dx * dx + dy * dy);
        
        if (currentDistance <= 0) return { x: targetX + preferredDistance, y: targetY };
        
        // Check if we're in optimal range
        const tolerance = this.optimalDistanceTolerance || 20;
        const minDist = minDistance || (preferredDistance - tolerance);
        const maxDist = maxDistance || (preferredDistance + tolerance);
        
        if (currentDistance >= minDist && currentDistance <= maxDist) {
            // Already in optimal range, maintain position
            return { x: targetX, y: targetY };
        }
        
        // Calculate desired position at optimal distance
        const angle = Math.atan2(dy, dx);
        const desiredX = targetX - Math.cos(angle) * preferredDistance;
        const desiredY = targetY - Math.sin(angle) * preferredDistance;
        
        return { x: desiredX, y: desiredY };
    }
    
    // Check if attack timing is good (player not attacking/dodging)
    isGoodAttackTiming(player, reactionDelay = 0.3) {
        if (!player) return true;
        
        // Check if player's current attack threatens this enemy
        if (this.isPlayerAttackThreatening(player, { expansion: 1.05, padding: 6 })) {
            return false; // Bad timing - attack is incoming
        }
        
        // Check if player just dodged (vulnerable window)
        if (this.lastPlayerAction && this.lastPlayerAction.type === 'dodge') {
            const timeSinceDodge = (Date.now() - this.lastPlayerAction.timestamp) / 1000;
            const dodgeRecovery = 0.2; // Recovery time after dodge
            if (timeSinceDodge < dodgeRecovery) {
                return true; // Good timing - player just finished dodging
            }
        }
        
        // Check if player is dodging
        if (player.isDodging) {
            return false; // Bad timing - player is dodging
        }
        
        // Check if player is moving away (good time to attack)
        if (player.vx !== 0 || player.vy !== 0) {
            const toPlayerX = player.x - this.x;
            const toPlayerY = player.y - this.y;
            const playerVelDot = (toPlayerX * player.vx + toPlayerY * player.vy) / 
                                (Math.sqrt(toPlayerX * toPlayerX + toPlayerY * toPlayerY) + 1);
            if (playerVelDot < 0) {
                return true; // Player moving away - good time to attack
            }
        }
        
        return true; // Default to allowing attack
    }
    
    // Record damage for combo detection
    recordDamage(damage) {
        const now = Date.now();
        this.lastDamageTime = now;
        this.damageHistory.push({ timestamp: now, damage: damage });
        
        // Keep only recent damage (last 1 second)
        this.damageHistory = this.damageHistory.filter(e => now - e.timestamp < 1000);
    }
    
    // Check if enemy is being combo'd
    isBeingComboed() {
        if (this.damageHistory.length < this.comboThreshold) return false;
        
        // Check if multiple hits in short time
        const recentHits = this.damageHistory.length;
        const timeSpan = this.damageHistory.length > 0 ? 
            Date.now() - this.damageHistory[0].timestamp : 0;
        
        return recentHits >= this.comboThreshold && timeSpan < 800; // 3+ hits in < 0.8s
    }
    
    // Update player movement patterns
    updatePlayerPatterns(player) {
        if (!player) return;
        
        // Track dodge frequency
        if (player.isDodging) {
            this.playerPatterns.dodgeFrequency = 
                (this.playerPatterns.dodgeFrequency * this.patternSampleCount + 1) / 
                (this.patternSampleCount + 1);
        }
        
        // Track attack frequency
        if (this.isPlayerAttackThreatening(player, { expansion: 1.05, padding: 8, includeEnemySize: false })) {
            this.playerPatterns.attackFrequency = 
                (this.playerPatterns.attackFrequency * this.patternSampleCount + 1) / 
                (this.patternSampleCount + 1);
        }
        
        // Track movement direction
        if (player.vx !== 0 || player.vy !== 0) {
            const speed = Math.sqrt(player.vx * player.vx + player.vy * player.vy);
            if (speed > 0) {
                const dirX = player.vx / speed;
                const dirY = player.vy / speed;
                this.playerPatterns.preferredDirection.x = 
                    (this.playerPatterns.preferredDirection.x * this.patternSampleCount + dirX) / 
                    (this.patternSampleCount + 1);
                this.playerPatterns.preferredDirection.y = 
                    (this.playerPatterns.preferredDirection.y * this.patternSampleCount + dirY) / 
                    (this.patternSampleCount + 1);
            }
        }
        
        // Store movement history (last 10 samples)
        if (player.vx !== 0 || player.vy !== 0) {
            this.playerPatterns.movementHistory.push({
                x: player.x,
                y: player.y,
                vx: player.vx,
                vy: player.vy,
                timestamp: Date.now()
            });
            if (this.playerPatterns.movementHistory.length > 10) {
                this.playerPatterns.movementHistory.shift();
            }
        }
        
        this.patternSampleCount++;
    }
    
    // Predict player movement based on patterns
    predictFromPatterns(player) {
        if (!player || this.playerPatterns.movementHistory.length < 3) {
            return { x: player.x, y: player.y };
        }
        
        // Use recent movement history to predict
        const history = this.playerPatterns.movementHistory;
        const recent = history.slice(-3);
        
        // Calculate average velocity from recent history
        let avgVx = 0;
        let avgVy = 0;
        let timeSpan = 0;
        
        if (recent.length > 1) {
            const first = recent[0];
            const last = recent[recent.length - 1];
            timeSpan = (last.timestamp - first.timestamp) / 1000;
            
            if (timeSpan > 0) {
                avgVx = (last.x - first.x) / timeSpan;
                avgVy = (last.y - first.y) / timeSpan;
            }
        }
        
        // Predict future position
        const predictionTime = 0.3;
        const predictedX = player.x + avgVx * predictionTime * this.intelligenceLevel;
        const predictedY = player.y + avgVy * predictionTime * this.intelligenceLevel;
        
        return { x: predictedX, y: predictedY };
    }
    
    // Calculate environmental awareness (wall/corner proximity)
    updateEnvironmentalAwareness() {
        if (typeof currentRoom === 'undefined' || !currentRoom) {
            this.wallProximity = 0;
            this.cornerProximity = 0;
            return;
        }
        
        const margin = 80; // Distance from wall to consider "near"
        const cornerMargin = 60; // Distance from corner to consider "near corner"
        
        // Check distance to each wall
        const distToLeft = this.x;
        const distToRight = currentRoom.width - this.x;
        const distToTop = this.y;
        const distToBottom = currentRoom.height - this.y;
        
        const minWallDist = Math.min(distToLeft, distToRight, distToTop, distToBottom);
        this.wallProximity = Math.max(0, 1 - (minWallDist / margin));
        
        // Check corner proximity (within cornerMargin of both walls)
        const nearLeftWall = distToLeft < cornerMargin;
        const nearRightWall = distToRight < cornerMargin;
        const nearTopWall = distToTop < cornerMargin;
        const nearBottomWall = distToBottom < cornerMargin;
        
        const inCorner = (nearLeftWall || nearRightWall) && (nearTopWall || nearBottomWall);
        this.cornerProximity = inCorner ? 1.0 : 0.0;
    }
    
    // Get strategic position considering environment
    getStrategicPosition(targetX, targetY, preferredDistance) {
        this.updateEnvironmentalAwareness();
        
        // If near corner and low HP, try to escape corner
        if (this.cornerProximity > 0.5 && (this.hp / this.maxHp) < 0.5) {
            // Move toward center
            const centerX = typeof currentRoom !== 'undefined' && currentRoom ? 
                currentRoom.width / 2 : targetX;
            const centerY = typeof currentRoom !== 'undefined' && currentRoom ? 
                currentRoom.height / 2 : targetY;
            return { x: centerX, y: centerY };
        }
        
        // If near wall, can use it to limit player escape routes
        if (this.wallProximity > 0.3 && this.intelligenceLevel > 0.6) {
            // Position to cut off escape route
            const dx = targetX - this.x;
            const dy = targetY - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist > 0) {
                // Position between player and nearest wall
                const angle = Math.atan2(dy, dx);
                const strategicX = targetX - Math.cos(angle) * preferredDistance * 0.8;
                const strategicY = targetY - Math.sin(angle) * preferredDistance * 0.8;
                return { x: strategicX, y: strategicY };
            }
        }
        
        // Default to optimal position
        return this.getOptimalPosition(targetX, targetY, preferredDistance);
    }
    
    // Check if should retreat tactically (situational and intelligent)
    shouldRetreat(player, enemies = []) {
        if (!player) return false;
        
        // Only smarter enemies retreat (room 10+)
        if (this.intelligenceLevel < 0.7) {
            return false; // Dumber enemies fight to the death
        }
        
        const hpPercent = this.hp / this.maxHp;
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        // Check if we're in a corner (bad retreat position)
        this.updateEnvironmentalAwareness();
        if (this.cornerProximity > 0.7) {
            return false; // Don't retreat if cornered - fight instead
        }
        
        // Check if other enemies are nearby (coordination - don't abandon allies)
        const nearbyAllies = this.getNearbyAlliesCount(enemies, 160, false);
        
        // If multiple allies nearby, less likely to retreat (coordination)
        if (nearbyAllies >= 2) {
            return false; // Stay and fight with allies
        }
        
        const threatInfo = this.getPlayerAttackThreatInfo(player, { expansion: 1.05, padding: 10 });
        const now = Date.now();
        
        // Only retreat if being actively combo'd AND low HP (not just low HP)
        if (this.isBeingComboed() && hpPercent < 0.4 && threatInfo.threatening && dist < 100) {
            const comboRetreatChance = Math.min(0.9,
                0.35 + threatInfo.proximity * 0.4 + this.intelligenceLevel * 0.3);
            if (Math.random() < comboRetreatChance) {
                this.lastRetreatDecisionTime = now;
                return true; // Tactical retreat due to combo pressure
            }
        }
        
        // Only retreat if player is actively attacking AND we're very close AND low HP
        if (threatInfo.threatening && dist < 60 && hpPercent < 0.25) {
            const closeRetreatChance = Math.min(0.85,
                0.25 + threatInfo.proximity * 0.5 + this.intelligenceLevel * 0.35);
            if (Math.random() < closeRetreatChance) {
                this.lastRetreatDecisionTime = now;
                return true; // Quick reposition from lethal proximity
            }
        }
        
        // Don't retreat just because of low HP - that's not fun
        // Only retreat when there's a clear tactical advantage
        
        return false;
    }
    
    // Get retreat position
    getRetreatPosition(player, retreatDistance = 150) {
        if (!player) return { x: this.x, y: this.y };
        
        const dx = this.x - player.x;
        const dy = this.y - player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist <= 0) {
            // If on top of player, retreat in random direction
            const angle = Math.random() * Math.PI * 2;
            return {
                x: this.x + Math.cos(angle) * retreatDistance,
                y: this.y + Math.sin(angle) * retreatDistance
            };
        }
        
        // Retreat away from player
        const retreatX = this.x + (dx / dist) * retreatDistance;
        const retreatY = this.y + (dy / dist) * retreatDistance;
        
        return { x: retreatX, y: retreatY };
    }
    
    // Find center of nearby group of enemies (for swarming behavior)
    getGroupCenter(enemies, maxRadius = 150, sameTypeOnly = false) {
        if (!enemies || enemies.length === 0) return null;
        
        let centerX = 0;
        let centerY = 0;
        let count = 0;
        
        enemies.forEach(other => {
            if (other === this || !other.alive) return;
            
            // Check if same type if required
            if (sameTypeOnly && other.constructor !== this.constructor) return;
            
            const dx = this.x - other.x;
            const dy = this.y - other.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < maxRadius) {
                centerX += other.x;
                centerY += other.y;
                count++;
            }
        });
        
        if (count > 0) {
            return { x: centerX / count, y: centerY / count };
        }
        return null;
    }
    
    // Resolve stacking/overlapping with other enemies (post-movement correction)
    resolveStacking(enemies, minDistance = null) {
        if (!enemies || enemies.length === 0) return;
        
        // Default minDistance is sum of radii + padding
        if (minDistance === null) {
            minDistance = this.size * 2 + 5; // 5px padding
        }
        
        enemies.forEach(other => {
            if (other === this || !other.alive) return;
            
            const dx = this.x - other.x;
            const dy = this.y - other.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            // If too close, push apart
            if (dist > 0 && dist < minDistance) {
                const overlap = minDistance - dist;
                const pushStrength = overlap * 0.5; // Gentle push to avoid jitter
                
                const pushX = (dx / dist) * pushStrength;
                const pushY = (dy / dist) * pushStrength;
                
                // Only move this enemy (other will handle its own separation)
                this.x += pushX;
                this.y += pushY;
            }
        });
    }
    
    // Resolve overlap with players, clones, and decoys to maintain personal space
    resolvePlayerOverlap(extraBuffer = 1) {
        const allPlayers = this.getAllAlivePlayers();
        if (!allPlayers || allPlayers.length === 0) {
            return;
        }
        
        allPlayers.forEach(({ player }) => {
            if (!player) return;
            
            // Skip dead targets (but allow decoys/clones with health > 0)
            if (player.alive === false && player.hp !== undefined && player.hp <= 0) {
                return;
            }
            if (player.health !== undefined && player.health <= 0) {
                return;
            }
            
            resolveEnemyPlayerOverlap(this, player, extraBuffer);
        });
        
        if (typeof this.keepInBounds === 'function') {
            this.keepInBounds();
        }
    }
    
    // Add threat to a player (for aggro system)
    // Records damage for per-enemy sliding window threat calculation
    // Does NOT immediately switch targets - that's handled by updateAggroTarget()
    addThreat(playerId, amount) {
        // Skip if currently locked to a clone/decoy (absolute aggro)
        if (this.targetLock && (this.targetLock.type === 'clone' || this.targetLock.type === 'decoy')) {
            return; // Absolute aggro: never leave clone/decoy
        }
        
        // Record damage in THIS enemy's threat table
        if (!this.threatTable.has(playerId)) {
            this.threatTable.set(playerId, []);
        }
        
        this.threatTable.get(playerId).push({
            damage: amount,
            timestamp: Date.now()
        });
        
        // If we have no current target, set initial target to this player
        if (!this.currentTarget) {
            this.currentTarget = playerId;
            this.targetLock = null;
            this.targetLockTimer = 0;
        }
    }
    
    // Calculate total threat for a player (within time window)
    getThreat(playerId) {
        if (!this.threatTable.has(playerId)) return 0;
        
        const now = Date.now();
        const windowMs = this.threatWindowDuration * 1000;
        const damageEvents = this.threatTable.get(playerId);
        
        let totalThreat = 0;
        for (const event of damageEvents) {
            if (now - event.timestamp <= windowMs) {
                totalThreat += event.damage;
            }
        }
        
        return totalThreat;
    }
    
    // Clean up old threat entries (outside window)
    cleanOldThreat() {
        const now = Date.now();
        const windowMs = this.threatWindowDuration * 1000;
        
        this.threatTable.forEach((events, playerId) => {
            this.threatTable.set(playerId, 
                events.filter(e => now - e.timestamp <= windowMs)
            );
        });
    }
    
    // Get highest threat target
    getHighestThreatTarget() {
        this.cleanOldThreat();
        
        let maxThreat = 0;
        let targetId = null;
        
        this.threatTable.forEach((events, playerId) => {
            const threat = this.getThreat(playerId);
            if (threat > maxThreat) {
                maxThreat = threat;
                targetId = playerId;
            }
        });
        
        return targetId;
    }
    
    // Update aggro target based on sliding window threat calculation
    // Called periodically in enemy update loops
    // Each enemy makes independent targeting decisions based on its own threat table
    updateAggroTarget() {
        // Clean old threat entries from THIS enemy's threat table
        this.cleanOldThreat();
        
        // Absolute aggro: never leave clone/decoy until they die
        if (this.targetLock && (this.targetLock.type === 'clone' || this.targetLock.type === 'decoy')) {
            return;
        }
        
        // Get highest threat player from THIS enemy's perspective
        const highestThreatId = this.getHighestThreatTarget();
        
        // No threat recorded yet - stick with current target or find nearest
        if (!highestThreatId) {
            return;
        }
        
        // Switch if new target has 20%+ more threat than current
        if (highestThreatId && highestThreatId !== this.currentTarget) {
            const currentThreat = this.getThreat(this.currentTarget || '');
            const newThreat = this.getThreat(highestThreatId);
            
            // Switch targets if new target has significantly more threat (20% threshold)
            if (newThreat > currentThreat * 1.2) {
                this.currentTarget = highestThreatId;
                // Clear target lock to force retargeting in findTarget()
                this.targetLock = null;
                this.targetLockTimer = 0;
            }
        }
    }
    
    // Interpolate toward target position (for multiplayer clients)
    interpolateToTarget(deltaTime) {
        if (this.targetX === undefined || this.targetY === undefined) return;
        
        // Use InterpolationManager for smooth interpolation with velocity-based extrapolation
        if (typeof interpolationManager !== 'undefined' && interpolationManager && this.id) {
            const smoothed = interpolationManager.getSmoothedPosition(
                this.id,
                this.x,
                this.y,
                this.rotation,
                this.targetX,
                this.targetY,
                this.targetRotation !== undefined ? this.targetRotation : this.rotation,
                deltaTime
            );
            
            this.x = smoothed.x;
            this.y = smoothed.y;
            this.rotation = smoothed.rotation;
            
            // Update rotationAngle if it exists
            if (this.rotationAngle !== undefined) {
                this.rotationAngle = smoothed.rotation;
            }
            
            return;
        }
        
        // Fallback: Simple lerp if InterpolationManager not available
        // Calculate distance to target
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // If very far from target, snap to prevent rubber-banding
        if (distance > MultiplayerConfig.SNAP_DISTANCE) {
            this.x = this.targetX;
            this.y = this.targetY;
            if (this.targetRotation !== undefined) {
                this.rotation = this.targetRotation;
            }
            return;
        }
        
        // Adaptive lerp speed based on distance
        // Closer to target = slower lerp (smoother), further = faster (catch up)
        const baseSpeed = MultiplayerConfig.BASE_LERP_SPEED;
        const distanceFactor = Math.min(distance / 50, 2); // Scale up to 2x speed when far
        const lerpSpeed = clamp(
            baseSpeed * (1 + distanceFactor),
            MultiplayerConfig.MIN_LERP_SPEED,
            MultiplayerConfig.MAX_LERP_SPEED
        );
        
        // Smooth lerp toward target with exponential smoothing
        const t = Math.min(1, deltaTime * lerpSpeed);
        this.x += dx * t;
        this.y += dy * t;
        
        // Interpolate rotation (handle wrapping)
        let desiredRotation = this.targetRotation;
        if (desiredRotation === undefined && this.rotationBaseline !== undefined) {
            desiredRotation = this.rotationBaseline;
        }
        if (this.rotationBaseline !== undefined && this.rotationBaselineTime) {
            const elapsed = (Date.now() - this.rotationBaselineTime) / 1000;
            desiredRotation = this.rotationBaseline + (this.rotationSpeed || 0) * elapsed;
        }
        if (desiredRotation !== undefined) {
            let rotDiff = normalizeAngle(desiredRotation - this.rotation);
            this.rotation += rotDiff * t;
            if (this.rotationAngle !== undefined) {
                this.rotationAngle = desiredRotation;
            }
        }
        
        // Snap the last bit if very close to prevent micro-jitter
        if (distance < 0.1) {
            this.x = this.targetX;
            this.y = this.targetY;
            if (desiredRotation !== undefined) {
                this.rotation = desiredRotation;
                this.targetRotation = desiredRotation;
                if (this.rotationAngle !== undefined) {
                    this.rotationAngle = desiredRotation;
                }
            }
        }
    }
    
    // Update state from host (for multiplayer clients)
    updateFromHost(hostData) {
        // Use authoritative timestamp from host state if available, otherwise use current time
        const stateTimestamp = hostData.timestamp || hostData.serverSendTime || Date.now();
        
        // Add state to interpolation buffer for smooth rendering
        if (typeof interpolationManager !== 'undefined' && interpolationManager && this.id) {
            interpolationManager.addEntityState(this.id, stateTimestamp, {
                x: hostData.x,
                y: hostData.y,
                rotation: hostData.rotation !== undefined ? hostData.rotation : (hostData.rotationAngle !== undefined ? hostData.rotationAngle : this.rotation),
                timestamp: stateTimestamp
            });
        }
        
        // Set interpolation targets for smooth movement (fallback if InterpolationManager not available)
        this.targetX = hostData.x;
        this.targetY = hostData.y;
        this.targetRotation = hostData.rotation;
        if (hostData.rotationAngle !== undefined) {
            this.rotationAngle = hostData.rotationAngle;
            this.rotation = hostData.rotationAngle;
            this.targetRotation = hostData.rotationAngle;
        }
        if (hostData.rotationSpeed !== undefined) {
            this.rotationSpeed = hostData.rotationSpeed;
        }
        if (hostData.rotationAngle !== undefined) {
            this.rotationBaseline = hostData.rotationAngle;
        } else if (hostData.rotation !== undefined) {
            this.rotationBaseline = hostData.rotation;
        } else {
            this.rotationBaseline = this.rotation;
        }
        this.rotationBaselineTime = Date.now();
        
        // Update timestamp for velocity calculation (use authoritative timestamp)
        this.lastUpdateTime = stateTimestamp;
        
        // Direct state updates
        this.hp = hostData.hp;
        this.maxHp = hostData.maxHp;
        this.alive = hostData.alive;
        
        // Apply animation states (for visual consistency)
        if (hostData.state !== undefined) this.state = hostData.state;
        if (hostData.chargeElapsed !== undefined) this.chargeElapsed = hostData.chargeElapsed;
        if (hostData.sizeMultiplier !== undefined) this.sizeMultiplier = hostData.sizeMultiplier;
        if (hostData.spinElapsed !== undefined) this.spinElapsed = hostData.spinElapsed;
        if (hostData.telegraphElapsed !== undefined) this.telegraphElapsed = hostData.telegraphElapsed;
        if (hostData.lungeElapsed !== undefined) this.lungeElapsed = hostData.lungeElapsed;
        if (hostData.dashElapsed !== undefined) this.dashElapsed = hostData.dashElapsed;
        if (hostData.coordinationRole !== undefined) this.coordinationRole = hostData.coordinationRole;
        
        if (this.telegraphController) {
            this.telegraphController.applyState({
                telegraph: hostData.telegraph || null,
                recoveryWindow: hostData.recoveryWindow || null
            });
        } else {
            this.activeTelegraph = hostData.telegraph || null;
            this.recoveryWindow = hostData.recoveryWindow || null;
        }
        
        // Boss-specific state
        if (this.isBoss && hostData.phase !== undefined) {
            this.phase = hostData.phase;
        }
        if (hostData.attacking !== undefined) {
            this.attacking = hostData.attacking;
        }
        
        // Update last attacker for kill attribution
        if (hostData.lastAttacker) {
            this.lastAttacker = hostData.lastAttacker;
        }
        
        // Update current target for aggro visualization
        if (hostData.currentTarget) {
            this.currentTarget = hostData.currentTarget;
        }
    }
    
    // Get all alive players (for aggro system)
    getAllAlivePlayers() {
        const allPlayers = [];
        
        // Add local player
        if (typeof Game !== 'undefined' && Game.player && Game.player.alive && Game.getLocalPlayerId) {
            allPlayers.push({
                id: Game.getLocalPlayerId(),
                player: Game.player
            });
            
            // Add local player's decoys/clones
            if (Game.player.shadowClones) {
                Game.player.shadowClones.forEach((clone, i) => {
                    if (!clone) return;
                    if (clone.alive === false) return;
                    if (clone.health !== undefined && clone.health <= 0) return;
                    
                    allPlayers.push({
                        id: `local-clone-${i}`,
                        player: clone
                    });
                });
            }
            
            if (Game.player.blinkDecoyActive) {
                const decoyTarget = typeof Game.player.getBlinkDecoyTarget === 'function'
                    ? Game.player.getBlinkDecoyTarget()
                    : null;
                
                if (decoyTarget) {
                    allPlayers.push({
                        id: 'local-blink-decoy',
                        player: decoyTarget
                    });
                }
            }
        }
        
        // Add remote player INSTANCES (host simulates these)
        if (typeof Game !== 'undefined' && Game.remotePlayerInstances) {
            Game.remotePlayerInstances.forEach((playerInstance, playerId) => {
                if (playerInstance && playerInstance.alive) {
                    allPlayers.push({
                        id: playerId,
                        player: playerInstance
                    });
                    
                    // Add remote player's decoys/clones
                    if (playerInstance.shadowClones) {
                        playerInstance.shadowClones.forEach((clone, i) => {
                            if (!clone) return;
                            if (clone.alive === false) return;
                            if (clone.health !== undefined && clone.health <= 0) return;
                            
                            allPlayers.push({
                                id: `${playerId}-clone-${i}`,
                                player: clone
                            });
                        });
                    }
                    
                    if (playerInstance.blinkDecoyActive) {
                        const decoyTarget = typeof playerInstance.getBlinkDecoyTarget === 'function'
                            ? playerInstance.getBlinkDecoyTarget()
                            : null;
                        
                        if (decoyTarget) {
                            allPlayers.push({
                                id: `${playerId}-blink-decoy`,
                                player: decoyTarget
                            });
                        }
                    }
                }
            });
        }
        
        return allPlayers;
    }
    
    // Get player by ID (for aggro targeting)
    getPlayerById(playerId) {
        if (playerId === null || playerId === undefined) {
            return null;
        }
        
        // Check local player
        if (typeof Game !== 'undefined' && Game.player && Game.getLocalPlayerId) {
            if (Game.getLocalPlayerId() === playerId) {
                return Game.player;
            }
            
            if (playerId.startsWith('local-clone-')) {
                const index = parseInt(playerId.split('-')[2]);
                if (Game.player.shadowClones && Game.player.shadowClones[index]) {
                    const clone = Game.player.shadowClones[index];
                    if (clone && clone.alive !== false && (clone.health === undefined || clone.health > 0)) {
                        return clone;
                    }
                }
            }
            
            if (playerId === 'local-blink-decoy' && typeof Game.player.getBlinkDecoyTarget === 'function') {
                return Game.player.getBlinkDecoyTarget();
            }
        }
        
        // Check remote player INSTANCES (host simulates these)
        if (typeof Game !== 'undefined' && Game.remotePlayerInstances) {
            const playerInstance = Game.remotePlayerInstances.get(playerId);
            if (playerInstance) return playerInstance;
            
            // Check remote player decoys/clones
            for (const [pid, instance] of Game.remotePlayerInstances) {
                if (typeof playerId === 'string' && playerId.startsWith(`${pid}-clone-`)) {
                    const index = parseInt(playerId.split('-')[2]);
                    if (instance.shadowClones && instance.shadowClones[index]) {
                        const clone = instance.shadowClones[index];
                        if (clone && clone.alive !== false && (clone.health === undefined || clone.health > 0)) {
                            return clone;
                        }
                    }
                }
                if (playerId === `${pid}-blink-decoy` && instance && instance.blinkDecoyActive) {
                    if (typeof instance.getBlinkDecoyTarget === 'function') {
                        return instance.getBlinkDecoyTarget();
                    }
                    const decoyTarget = {
                        x: instance.blinkDecoyX,
                        y: instance.blinkDecoyY,
                        size: instance.size,
                        hp: instance.blinkDecoyHealth,
                        health: instance.blinkDecoyHealth,
                        maxHp: instance.blinkDecoyMaxHealth,
                        alive: instance.blinkDecoyActive && instance.blinkDecoyHealth > 0,
                        dead: !(instance.blinkDecoyActive && instance.blinkDecoyHealth > 0),
                        takeDamage: (amount = 0) => {
                            if (typeof instance.applyBlinkDecoyDamage === 'function') {
                                instance.applyBlinkDecoyDamage(amount);
                            } else {
                                instance.blinkDecoyHealth = Math.max(0, instance.blinkDecoyHealth - amount);
                                if (instance.blinkDecoyHealth <= 0) {
                                    instance.blinkDecoyHealth = 0;
                                    instance.blinkDecoyActive = false;
                                }
                            }
                            decoyTarget.hp = instance.blinkDecoyHealth;
                            decoyTarget.health = instance.blinkDecoyHealth;
                            decoyTarget.alive = instance.blinkDecoyActive && instance.blinkDecoyHealth > 0;
                            decoyTarget.dead = !decoyTarget.alive;
                        }
                    };
                    return decoyTarget;
                }
            }
        }
        
        return null;
    }
    
    // Get nearest player (fallback when no aggro)
    getNearestPlayer() {
        const allPlayers = this.getAllAlivePlayers();
        if (allPlayers.length === 0) {
            return { x: this.x, y: this.y, alive: false };
        }
        
        let nearest = null;
        let minDist = Infinity;
        
        allPlayers.forEach(({ player }) => {
            const dx = player.x - this.x;
            const dy = player.y - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < minDist) {
                minDist = dist;
                nearest = player;
            }
        });
        
        return nearest || { x: this.x, y: this.y, alive: false };
    }
    
    // Assign initial target at room start (weighted random to avoid all-on-one)
    assignInitialTarget() {
        const allPlayers = this.getAllAlivePlayers();
        if (allPlayers.length === 0) return null;
        if (allPlayers.length === 1) {
            this.currentTarget = allPlayers[0].id;
            return this.currentTarget;
        }
        
        // Get list of player IDs
        const playerIds = allPlayers.map(p => p.id);
        
        // Weighted random: 70% pure random, 30% favor less-targeted players
        // This prevents all enemies targeting one player without rigid balancing
        if (Math.random() < 0.7) {
            // 70% of the time: pure random
            const randomIndex = Math.floor(Math.random() * playerIds.length);
            this.currentTarget = playerIds[randomIndex];
        } else {
            // 30% of the time: pick player with fewer enemies targeting them
            const targetCounts = new Map();
            playerIds.forEach(id => targetCounts.set(id, 0));
            
            if (typeof Game !== 'undefined' && Game.enemies) {
                Game.enemies.forEach(e => {
                    if (e !== this && e.currentTarget && targetCounts.has(e.currentTarget)) {
                        targetCounts.set(e.currentTarget, targetCounts.get(e.currentTarget) + 1);
                    }
                });
            }
            
            // Pick one of the less-targeted players
            let minCount = Infinity;
            targetCounts.forEach(count => {
                if (count < minCount) minCount = count;
            });
            
            const lessTargetedPlayers = [];
            targetCounts.forEach((count, id) => {
                if (count === minCount) {
                    lessTargetedPlayers.push(id);
                }
            });
            
            this.currentTarget = lessTargetedPlayers[Math.floor(Math.random() * lessTargetedPlayers.length)];
        }
        
        return this.currentTarget;
    }
    
    // Abstract methods - subclasses must implement
    update(deltaTime, player) {
        throw new Error('EnemyBase.update() must be implemented by subclass');
    }
    
    render(ctx) {
        throw new Error('EnemyBase.render() must be implemented by subclass');
    }
    
    // Serialize enemy state for multiplayer sync
    serialize() {
        const telegraphState = this.telegraphController
            ? this.telegraphController.serializeState()
            : {
                telegraph: this.activeTelegraph ? {
                    type: this.activeTelegraph.type,
                    progress: Math.min(1, Math.max(0, (this.activeTelegraph.elapsed || 0) / Math.max(0.05, this.activeTelegraph.duration || 1))),
                    duration: this.activeTelegraph.duration,
                    intensity: this.activeTelegraph.intensity || 1,
                    projectRadius: this.activeTelegraph.projectRadius || null,
                    color: this.activeTelegraph.color || null
                } : null,
                recoveryWindow: this.recoveryWindow ? {
                    duration: this.recoveryWindow.duration,
                    elapsed: this.recoveryWindow.elapsed,
                    vulnerability: this.recoveryWindow.vulnerability,
                    modifier: this.recoveryWindow.modifier
                } : null
            };
        return {
            id: this.id,
            x: this.x,
            y: this.y,
            rotation: this.rotation,
            hp: this.hp,
            maxHp: this.maxHp,
            size: this.size,
            color: this.color,
            shape: this.shape,
            alive: this.alive,
            isBoss: this.isBoss || false,
            lastAttacker: this.lastAttacker,
            currentTarget: this.currentTarget,
            // Animation states
            state: this.state,
            chargeElapsed: this.chargeElapsed,
            sizeMultiplier: this.sizeMultiplier,
            spinElapsed: this.spinElapsed,
            telegraphElapsed: this.telegraphElapsed,
            lungeElapsed: this.lungeElapsed,
            dashElapsed: this.dashElapsed,
            telegraph: telegraphState.telegraph,
            recoveryWindow: telegraphState.recoveryWindow,
            coordinationRole: this.coordinationRole || null
        };
    }
    
    // Apply state from host (uses updateFromHost which sets interpolation targets)
    applyState(state) {
        // Use existing updateFromHost method
        if (this.updateFromHost) {
            this.updateFromHost(state);
        }
        if (this.telegraphController && state) {
            this.telegraphController.applyState({
                telegraph: state.telegraph || null,
                recoveryWindow: state.recoveryWindow || null
            });
        }
    }
}

// Factory function to create enemy instances from serialized data (for clients)
function createEnemyFromData(enemyData) {
    let enemy = null;
    
    // Determine enemy type - check for boss first
    if (enemyData.isBoss && enemyData.bossName) {
        // Create appropriate boss based on bossName
        switch (enemyData.bossName) {
            case 'Swarm King':
                if (typeof BossSwarmKing !== 'undefined') {
                    enemy = new BossSwarmKing(enemyData.x, enemyData.y);
                    console.log(`[Client] Created ${enemyData.bossName} boss from host data`);
                } else {
                    console.error(`[Client] BossSwarmKing class not loaded`);
                    return null;
                }
                break;
            case 'Twin Prism':
                if (typeof BossTwinPrism !== 'undefined') {
                    enemy = new BossTwinPrism(enemyData.x, enemyData.y);
                    console.log(`[Client] Created ${enemyData.bossName} boss from host data`);
                } else {
                    console.error(`[Client] BossTwinPrism class not loaded`);
                    return null;
                }
                break;
            case 'Fortress':
                if (typeof BossFortress !== 'undefined') {
                    enemy = new BossFortress(enemyData.x, enemyData.y);
                    console.log(`[Client] Created ${enemyData.bossName} boss from host data`);
                } else {
                    console.error(`[Client] BossFortress class not loaded`);
                    return null;
                }
                break;
            case 'Fractal Core':
                if (typeof BossFractalCore !== 'undefined') {
                    enemy = new BossFractalCore(enemyData.x, enemyData.y);
                    console.log(`[Client] Created ${enemyData.bossName} boss from host data`);
                } else {
                    console.error(`[Client] BossFractalCore class not loaded`);
                    return null;
                }
                break;
            case 'Vortex':
                if (typeof BossVortex !== 'undefined') {
                    enemy = new BossVortex(enemyData.x, enemyData.y);
                    console.log(`[Client] Created ${enemyData.bossName} boss from host data`);
                } else {
                    console.error(`[Client] BossVortex class not loaded`);
                    return null;
                }
                break;
            default:
                console.warn(`[Client] Unknown boss name: ${enemyData.bossName}`);
                return null;
        }
    } else if (enemyData.isBoss) {
        // Boss without a name (shouldn't happen but handle it)
        console.warn(`[Client] Boss detected but no bossName property found`);
        return null;
    } else {
        // Create regular enemy based on shape
        switch (enemyData.shape) {
            case 'circle':
                enemy = new Enemy(enemyData.x, enemyData.y);
                break;
            case 'star':
                enemy = new StarEnemy(enemyData.x, enemyData.y);
                break;
            case 'diamond':
                enemy = new DiamondEnemy(enemyData.x, enemyData.y);
                break;
            case 'rectangle':
                enemy = new RectangleEnemy(enemyData.x, enemyData.y);
                break;
            case 'octagon':
                enemy = new OctagonEnemy(enemyData.x, enemyData.y);
                break;
            default:
                console.warn(`Unknown enemy shape: ${enemyData.shape}`);
                enemy = new Enemy(enemyData.x, enemyData.y);
        }
    }
    
    if (!enemy) return null;
    
    // Override the auto-generated ID with the host's ID
    enemy.id = enemyData.id;
    
    // Apply host's state to the new enemy
    enemy.x = enemyData.x;
    enemy.y = enemyData.y;
    enemy.hp = enemyData.hp;
    enemy.maxHp = enemyData.maxHp;
    enemy.rotation = enemyData.rotation;
    enemy.size = enemyData.size;
    enemy.color = enemyData.color;
    enemy.alive = enemyData.alive;
    
    // Initialize interpolation targets (for smooth movement on clients)
    enemy.targetX = enemyData.x;
    enemy.targetY = enemyData.y;
    enemy.targetRotation = enemyData.rotation;
    
    // Apply animation states
    if (enemyData.state !== undefined) enemy.state = enemyData.state;
    if (enemyData.chargeElapsed !== undefined) enemy.chargeElapsed = enemyData.chargeElapsed;
    if (enemyData.sizeMultiplier !== undefined) enemy.sizeMultiplier = enemyData.sizeMultiplier;
    if (enemyData.spinElapsed !== undefined) enemy.spinElapsed = enemyData.spinElapsed;
    if (enemyData.telegraphElapsed !== undefined) enemy.telegraphElapsed = enemyData.telegraphElapsed;
    if (enemyData.lungeElapsed !== undefined) enemy.lungeElapsed = enemyData.lungeElapsed;
    if (enemyData.dashElapsed !== undefined) enemy.dashElapsed = enemyData.dashElapsed;
    
    // Apply aggro/targeting state
    if (enemyData.lastAttacker) enemy.lastAttacker = enemyData.lastAttacker;
    if (enemyData.currentTarget) enemy.currentTarget = enemyData.currentTarget;
    
    return enemy;
}

