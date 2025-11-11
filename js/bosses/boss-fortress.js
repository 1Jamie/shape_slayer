// Fortress Boss - Room 20
// Stationary fortress encounter with phased bullet hell, minion waves, and turret defenses
//
const SWARM_KING_BEAM_TURN_RATE = Math.PI * 0.1575;
const FORTRESS_TURRET_TURN_RATE = SWARM_KING_BEAM_TURN_RATE * 0.45; // Slower than Swarm King because multiple turrets track simultaneously
const FORTRESS_TURRET_FIRE_TURN_RATE = SWARM_KING_BEAM_TURN_RATE * 0.55;
const FORTRESS_CONFIG_TEMPLATE = Object.freeze({
    arcVolley: {
        telegraphDuration: 1.05,
        attackDuration: 0.85,
        waveInterval: 0.18,
        projectileSpeed: 250,
        damageMultiplier: 0.75,
        phaseProjectiles: { 1: 14, 2: 18, 3: 22 },
        phaseWaves: { 1: 2, 2: 3, 3: 4 },
        rotationStep: Math.PI / 32
    },
    turretBurst: {
        telegraphDuration: 0.85,
        attackDuration: 1.25,
        shotInterval: 0.28,
        shotsPerTurret: { 1: 2, 2: 3, 3: 4 },
        projectileSpeed: 265,
        damageMultiplier: 0.85,
        spread: 0.08
    },
    knockbackPulse: {
        telegraphDuration: 2.0,
        attackDuration: 0.8,
        radius: 580,
        duration: 1.2,
        damageMultiplier: 1.1,
        force: 220,
        proximityDelay: 1.5
    },
    pauses: {
        phase1: 1.25,
        phase2: 1.0,
        phase3: 0.45
    },
    minions: {
        telegraphDuration: 0.9,
        cooldown: { 1: 12, 2: 10, 3: 8 },
        compositions: {
            1: { guards: 2, skirmishers: 1 },
            2: { guards: 3, skirmishers: 2 },
            3: { guards: 4, skirmishers: 3 }
        }
    }
});

class BossFortress extends BossBase {
    constructor(x, y) {
        super(x, y);

        this.bossName = 'Fortress';
        this.width = 220;
        this.height = 160;
        this.size = Math.max(this.width, this.height);
        this.maxHp = 1500;
        this.hp = this.maxHp;
        this.damage = 11;
        this.moveSpeed = 0; // Stationary boss
        this.color = '#1c264f';

        this.anchorX = this.x;
        this.anchorY = this.y;
        this.stationary = true;
        this.anchorInitialized = false;

        this.config = this.buildConfig();
        this.turrets = this.createTurrets();
        this.arcRotationOffset = 0;
        this.globalTimer = 0;

        this.patternQueue = [];
        this.state = 'idle';
        this.stateTimer = 0;
        this.stateDuration = 0;
        this.stateData = null;
        this.stateFired = false;
        this.phaseCycleCounters = { 1: 0, 2: 0, 3: 0 };

        this.telegraph = { type: null, timer: 0, duration: 0, data: null };
        this.gateTelegraph = { active: false, timer: 0, duration: 0 };

        this.activeArcVolley = null;
        this.activeTurretBurst = null;
        this.activeKnockbackPulse = null;
        this.knockbackTelegraphIntensity = 0;

        this.minions = [];
        this.activeMinionWave = null;
        this.minionWaveCooldown = 6.0;
        this.pendingWave = null;
        this.waveSequenceId = 0;

        this.knockbackContextCooldown = 0;
        this.knockbackProximityDelay = 0;

        this.weakPoints.length = 0;
        const weakSpacing = this.width * 0.22;
        const weakY = -this.height * 0.02;
        const weakRadius = 10;
        this.addWeakPoint(-weakSpacing, weakY, weakRadius, 0);
        this.addWeakPoint(0, weakY, weakRadius + 1, 0);
        this.addWeakPoint(weakSpacing, weakY, weakRadius, 0);
    }

    buildConfig() {
        return JSON.parse(JSON.stringify(FORTRESS_CONFIG_TEMPLATE));
    }

    createTurrets() {
        const offsets = [
            { x: -this.width * 0.38, y: -this.height * 0.62 },
            { x: this.width * 0.38, y: -this.height * 0.62 },
            { x: -this.width * 0.48, y: -this.height * 0.15 },
            { x: this.width * 0.48, y: -this.height * 0.15 }
        ];
        return offsets.map((offset, index) => ({
            index,
            offsetX: offset.x,
            offsetY: offset.y,
            angle: Math.PI / 2,
            desiredAngle: Math.PI / 2,
            charge: 0,
            cooldown: 0
        }));
    }

    update(deltaTime, player) {
        if (!this.introComplete) return;
        if (!player) {
            const nearestPlayer = this.getNearestPlayer();
            if (!nearestPlayer || !nearestPlayer.alive) return;
            player = nearestPlayer;
        }
        if (!this.alive || !player || !player.alive) return;

        const room = (typeof currentRoom !== 'undefined') ? currentRoom : null;
        if (!this.anchorInitialized && room) {
            let doorCenterX = room.width - this.width * 0.6;
            let doorCenterY = room.height * 0.5;
            if (typeof getDoorPosition === 'function') {
                const door = getDoorPosition();
                if (door) {
                    doorCenterX = door.x + door.width / 2;
                    doorCenterY = door.y + door.height / 2;
                }
            }
            // Position fortress so its front aligns with the door center
            this.anchorX = doorCenterX - this.width * 0.45;
            this.anchorY = doorCenterY;
            this.anchorInitialized = true;
        }

        this.x = this.anchorX;
        this.y = this.anchorY;
        this.globalTimer += deltaTime;

        if (this.knockbackContextCooldown > 0) {
            this.knockbackContextCooldown = Math.max(0, this.knockbackContextCooldown - deltaTime);
        }
        if (this.knockbackProximityDelay > 0) {
            this.knockbackProximityDelay = Math.max(0, this.knockbackProximityDelay - deltaTime);
        }

        this.checkPhaseTransition();

        this.updateTelegraph(deltaTime);
        this.updateGateTelegraph(deltaTime);

        this.maybeInjectContextualKnockback(player);
        this.updatePhaseController(deltaTime, player);
        this.updateCurrentState(deltaTime, player);
        this.updateArcVolley(deltaTime, player);
        this.updateTurretBurst(deltaTime, player);
        this.updateTurrets(deltaTime, player);
        this.considerMinionSpawn(deltaTime);

        this.updateHazards(deltaTime, player);
        this.checkHazardCollisions(player, deltaTime);
        this.updateWeakPoints(deltaTime);

        this.minions = this.minions.filter(minion => minion && minion.alive);
        if (this.activeMinionWave && this.minions.length === 0) {
            this.activeMinionWave = null;
            this.minionWaveCooldown = this.config.minions.cooldown[this.phase] || 10;
        }
        if (!this.activeMinionWave && this.minionWaveCooldown > 0) {
            this.minionWaveCooldown = Math.max(0, this.minionWaveCooldown - deltaTime);
        }

        if (this.activeKnockbackPulse && this.activeKnockbackPulse.expired) {
            this.activeKnockbackPulse = null;
        }
        this.keepInBounds();
    }

    updatePhaseController(deltaTime, player) {
        this.stateTimer += deltaTime;

        if (!this.activeArcVolley && !this.activeTurretBurst && this.stateDuration > 0 && this.stateTimer >= this.stateDuration && this.state !== 'telegraph') {
            this.advancePatternQueue();
        }

        if (!this.patternQueue.length) {
            this.enqueuePhasePatterns(this.phase, player);
        }

        if (!this.state || this.state === 'idle' || (this.stateDuration === 0 && this.state !== 'telegraph')) {
            this.advancePatternQueue();
        }
    }

    advancePatternQueue() {
        if (!this.patternQueue.length) return;
        const next = this.patternQueue.shift();
        this.enterState(next);
    }

    enterState(entry) {
        if (!entry) {
            this.state = 'idle';
            this.stateTimer = 0;
            this.stateDuration = 0;
            this.stateData = null;
            this.stateFired = false;
            this.clearTelegraph();
            return;
        }

        if (this.state === 'telegraph' && this.state !== entry.state) {
            this.clearTelegraph();
        }

        this.state = entry.state;
        this.stateTimer = 0;
        this.stateDuration = entry.duration || 0;
        this.stateData = entry.data || null;
        this.stateFired = false;

        if (this.state === 'telegraph') {
            const telegraphType = this.stateData ? this.stateData.type : null;
            this.startTelegraph(telegraphType, entry.duration, this.stateData ? this.stateData.payload : null);
        }
    }

    updateCurrentState(deltaTime, player) {
        if (!this.state) return;

        if (this.state === 'telegraph') {
            if (this.stateTimer >= this.stateDuration) {
                this.clearTelegraph();
                this.advancePatternQueue();
            }
            return;
        }

        if (this.state === 'pause') {
            if (this.stateTimer >= this.stateDuration) {
                this.advancePatternQueue();
            }
            return;
        }

        if (this.state === 'arcVolley') {
            if (!this.stateFired) {
                this.startArcVolley(this.stateData || {});
                this.stateFired = true;
            }
            if (!this.activeArcVolley) {
                this.advancePatternQueue();
            }
            return;
        }

        if (this.state === 'turretBurst') {
            if (!this.stateFired) {
                this.startTurretBurst(this.stateData || {}, player);
                this.stateFired = true;
            }
            if (!this.activeTurretBurst) {
                this.advancePatternQueue();
            }
            return;
        }

        if (this.state === 'knockbackPulse') {
            if (!this.stateFired) {
                this.triggerKnockbackPulse(this.stateData || {});
                this.stateFired = true;
            }
            if (this.stateTimer >= this.stateDuration) {
                this.advancePatternQueue();
            }
            return;
        }

    }

    enqueuePhasePatterns(phase, player) {
        if (phase === 1) {
            this.enqueuePhase1Patterns();
        } else if (phase === 2) {
            this.enqueuePhase2Patterns(player);
        } else {
            this.enqueuePhase3Patterns(player);
        }
    }

    enqueuePhase1Patterns() {
        const volleyPayload = this.buildArcVolleyPayload(1);
        this.queueTelegraph('arcVolley', this.config.arcVolley.telegraphDuration, volleyPayload);
        this.queueAttack('arcVolley', this.config.arcVolley.attackDuration, volleyPayload);
        this.queuePause(this.config.pauses.phase1);

        this.phaseCycleCounters[1]++;

        if (this.phaseCycleCounters[1] % 2 === 0) {
            this.queuePause(this.config.pauses.phase1 * 0.5);
        }
    }

    enqueuePhase2Patterns(player) {
        const volleyPayload = this.buildArcVolleyPayload(2);
        this.queueTelegraph('arcVolley', this.config.arcVolley.telegraphDuration * 0.9, volleyPayload);
        this.queueAttack('arcVolley', this.config.arcVolley.attackDuration, volleyPayload);

        const turretPayload = this.buildTurretPayload(2);
        this.queueTelegraph('turretBurst', this.config.turretBurst.telegraphDuration, turretPayload);
        this.queueAttack('turretBurst', this.config.turretBurst.attackDuration, turretPayload);

        const useKnockback = this.shouldTriggerKnockback(player);
        if (useKnockback) {
            const pulsePayload = this.buildKnockbackPayload({ contextual: true });
            this.queueTelegraph('knockbackPulse', this.config.knockbackPulse.telegraphDuration, pulsePayload);
            this.queueAttack('knockbackPulse', this.config.knockbackPulse.attackDuration, pulsePayload);
        }

        this.queuePause(this.config.pauses.phase2);
        this.phaseCycleCounters[2]++;
    }

    enqueuePhase3Patterns(player) {
        const volleyPayload = this.buildArcVolleyPayload(3, { rotateFaster: true });
        this.queueTelegraph('arcVolley', this.config.arcVolley.telegraphDuration * 0.85, volleyPayload);
        this.queueAttack('arcVolley', this.config.arcVolley.attackDuration, volleyPayload);

        const turretPayload = this.buildTurretPayload(3, { staggered: true });
        this.queueTelegraph('turretBurst', this.config.turretBurst.telegraphDuration * 0.9, turretPayload);
        this.queueAttack('turretBurst', this.config.turretBurst.attackDuration, turretPayload);

        const useKnockback = this.shouldTriggerKnockback(player);
        if (useKnockback) {
            const pulsePayload = this.buildKnockbackPayload({ empowered: true, contextual: true });
            this.queueTelegraph('knockbackPulse', this.config.knockbackPulse.telegraphDuration * 0.9, pulsePayload);
            this.queueAttack('knockbackPulse', this.config.knockbackPulse.attackDuration, pulsePayload);
        }

        this.queuePause(this.config.pauses.phase3);
        this.phaseCycleCounters[3]++;
    }

    buildArcVolleyPayload(phase, extra = {}) {
        return {
            phase,
            projectilesPerWave: this.config.arcVolley.phaseProjectiles[phase] || this.config.arcVolley.phaseProjectiles[3],
            waves: this.config.arcVolley.phaseWaves[phase] || this.config.arcVolley.phaseWaves[3],
            waveInterval: this.config.arcVolley.waveInterval,
            rotationStep: 0,
            speed: this.config.arcVolley.projectileSpeed,
            damageMultiplier: this.config.arcVolley.damageMultiplier
        };
    }

    buildTurretPayload(phase, extra = {}) {
        return {
            phase,
            shotsPerTurret: this.config.turretBurst.shotsPerTurret[phase] || this.config.turretBurst.shotsPerTurret[3],
            shotInterval: extra.staggered ? this.config.turretBurst.shotInterval * 0.85 : this.config.turretBurst.shotInterval,
            spread: extra.staggered ? this.config.turretBurst.spread * 1.2 : this.config.turretBurst.spread,
            damageMultiplier: this.config.turretBurst.damageMultiplier,
            projectileSpeed: this.config.turretBurst.projectileSpeed
        };
    }

    buildKnockbackPayload(extra = {}) {
        return {
            radius: this.config.knockbackPulse.radius,
            duration: this.config.knockbackPulse.duration,
            force: extra.empowered ? this.config.knockbackPulse.force * 1.15 : this.config.knockbackPulse.force,
            damageMultiplier: extra.empowered ? this.config.knockbackPulse.damageMultiplier * 1.15 : this.config.knockbackPulse.damageMultiplier
        };
    }

    shouldTriggerKnockback(player) {
        if (!player) return false;
        if (this.knockbackContextCooldown > 0) return false;
        if (this.knockbackProximityDelay > 0) return false;
        if (this.state === 'knockbackPulse' || (this.telegraph && this.telegraph.type === 'knockbackPulse')) return false;
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const radius = this.config.knockbackPulse.radius || 600;
        const threshold = radius * 0.75;
        return distance <= threshold;
    }

    maybeInjectContextualKnockback(player) {
        if (!this.shouldTriggerKnockback(player)) {
            if (this.knockbackProximityDelay <= 0) {
                this.knockbackProximityDelay = this.config.knockbackPulse.proximityDelay || 0.45;
            }
            return;
        }
        if (this.state === 'knockbackPulse') return;
        if (this.state === 'telegraph' && this.telegraph && this.telegraph.type === 'knockbackPulse') return;

        const alreadyQueued = this.patternQueue.some(entry => {
            if (!entry) return false;
            if (entry.state === 'knockbackPulse') return true;
            if (entry.state === 'telegraph' && entry.data && entry.data.type === 'knockbackPulse') return true;
            return false;
        });

        if (alreadyQueued) return;

        const basePayload = this.buildKnockbackPayload({ contextual: true });
        const payload = { ...basePayload, contextual: true };
        const telegraphDuration = this.config.knockbackPulse.telegraphDuration;
        const attackDuration = this.config.knockbackPulse.attackDuration;

        const telegraphEntry = {
            state: 'telegraph',
            duration: telegraphDuration,
            data: {
                type: 'knockbackPulse',
                payload
            }
        };

        const attackEntry = {
            state: 'knockbackPulse',
            duration: attackDuration,
            data: payload
        };

        this.patternQueue.unshift(attackEntry);
        this.patternQueue.unshift(telegraphEntry);

        if (this.state === 'pause') {
            this.stateTimer = this.stateDuration;
        }

        const entryDelay = attackDuration + telegraphDuration + 0.4;
        this.knockbackContextCooldown = Math.max(
            this.knockbackContextCooldown,
            (this.config.knockbackPulse.contextCooldown || 3.0) * 0.35 + entryDelay
        );
        this.knockbackProximityDelay = this.config.knockbackPulse.proximityDelay || 0.45;
    }

    queueTelegraph(type, duration, payload) {
        this.patternQueue.push({ state: 'telegraph', duration, data: { type, payload } });
    }

    queueAttack(state, duration, payload) {
        this.patternQueue.push({ state, duration, data: payload });
    }

    queuePause(duration) {
        if (duration > 0) {
            this.patternQueue.push({ state: 'pause', duration });
        }
    }

    startTelegraph(type, duration, data) {
        this.telegraph.type = type;
        this.telegraph.timer = 0;
        this.telegraph.duration = duration || 0;
        this.telegraph.data = data || null;

        if (type === 'turretBurst') {
            this.turrets.forEach(turret => {
                turret.charge = Math.max(turret.charge, 0.4);
            });
        }
    }

    clearTelegraph() {
        if (this.telegraph.type === 'turretBurst') {
            this.turrets.forEach(turret => turret.charge = 0);
        }
        this.telegraph.type = null;
        this.telegraph.timer = 0;
        this.telegraph.duration = 0;
        this.telegraph.data = null;
        this.knockbackTelegraphIntensity = 0;
    }

    updateTelegraph(deltaTime) {
        if (!this.telegraph.type || this.telegraph.type !== 'knockbackPulse') {
            this.knockbackTelegraphIntensity = Math.max(0, this.knockbackTelegraphIntensity - deltaTime * 2.5);
        }
        if (!this.telegraph.type) return;
        this.telegraph.timer += deltaTime;
        if (this.telegraph.type === 'turretBurst') {
            const progress = this.getTelegraphProgress();
            this.turrets.forEach(turret => {
                turret.charge = Math.max(turret.charge, progress);
            });
        }
        if (this.telegraph.type === 'knockbackPulse') {
            const progress = this.getTelegraphProgress();
            this.knockbackTelegraphIntensity = Math.max(this.knockbackTelegraphIntensity, progress);
        }
    }

    updateGateTelegraph(deltaTime) {
        if (!this.gateTelegraph.active) return;
        this.gateTelegraph.timer += deltaTime;
        if (this.gateTelegraph.timer >= this.gateTelegraph.duration) {
            this.gateTelegraph.active = false;
        }
    }

    getTelegraphProgress() {
        if (!this.telegraph.type || this.telegraph.duration <= 0) return 0;
        return Math.min(1, this.telegraph.timer / this.telegraph.duration);
    }

    startArcVolley(config) {
        if (typeof Game === 'undefined') return;
        const payload = {
            projectilesPerWave: config.projectilesPerWave,
            waves: config.waves,
            waveInterval: config.waveInterval,
            rotationStep: 0,
            speed: config.speed,
            damageMultiplier: config.damageMultiplier,
            wavesFired: 0,
            timer: 0,
            nextWaveTime: 0
        };
        this.activeArcVolley = payload;
    }

    updateArcVolley(deltaTime) {
        if (!this.activeArcVolley || typeof Game === 'undefined') return;
        const pattern = this.activeArcVolley;
        pattern.timer += deltaTime;
        if (pattern.nextWaveTime === undefined) {
            pattern.nextWaveTime = 0;
        }

        while (pattern.wavesFired < pattern.waves && pattern.timer >= pattern.nextWaveTime) {
            this.spawnArcWave(pattern, pattern.wavesFired);
            pattern.wavesFired++;
            pattern.nextWaveTime += pattern.waveInterval;
        }

        if (pattern.wavesFired >= pattern.waves) {
            this.activeArcVolley = null;
        }
    }

    spawnArcWave(pattern, index) {
        if (typeof Game === 'undefined') return;
        const count = Math.max(6, pattern.projectilesPerWave || 12);
        const origin = this.getArcOrigin();
        const baseAngle = Math.PI;
        const spread = Math.PI;
        const startAngle = baseAngle - spread / 2;
        const damage = this.damage * (pattern.damageMultiplier || 1);

        for (let i = 0; i < count; i++) {
            const ratio = count === 1 ? 0.5 : i / (count - 1);
            const angle = startAngle + spread * ratio;
            Game.projectiles.push({
                x: origin.x,
                y: origin.y,
                vx: Math.cos(angle) * pattern.speed,
                vy: Math.sin(angle) * pattern.speed,
                damage,
                size: 8,
                lifetime: 3.5,
                elapsed: 0
            });
        }
    }

    getArcOrigin() {
        return {
            x: this.x - this.width * 0.45,
            y: this.y
        };
    }

    startTurretBurst(config, player) {
        const info = {
            shotsPerTurret: config.shotsPerTurret,
            shotInterval: config.shotInterval,
            projectileSpeed: config.projectileSpeed,
            damageMultiplier: config.damageMultiplier,
            spread: config.spread,
            shotsFired: 0,
            timer: 0
        };
        this.activeTurretBurst = info;
        this.turrets.forEach(turret => {
            turret.charge = 1;
            if (player) {
                const pos = this.getTurretWorldPosition(turret);
                turret.desiredAngle = Math.atan2(player.y - pos.y, player.x - pos.x);
            }
        });
    }

    updateTurretBurst(deltaTime, player) {
        if (!this.activeTurretBurst || typeof Game === 'undefined') return;
        const burst = this.activeTurretBurst;
        burst.timer += deltaTime;
        const totalShots = burst.shotsPerTurret;

        while (burst.shotsFired < totalShots && burst.timer >= burst.shotInterval * burst.shotsFired) {
            this.fireTurretShot(burst, player);
            burst.shotsFired++;
        }

        if (burst.shotsFired >= totalShots) {
            this.activeTurretBurst = null;
            this.turrets.forEach(turret => (turret.charge = 0));
        }
    }

    fireTurretShot(burst, player) {
        if (typeof Game === 'undefined') return;
        const damage = this.damage * (burst.damageMultiplier || 1);
        this.turrets.forEach(turret => {
            const origin = this.getTurretWorldPosition(turret);
            let angle = turret.angle;
            if (player) {
                const dx = player.x - origin.x;
                const dy = player.y - origin.y;
                const targetAngle = Math.atan2(dy, dx);
                angle = this.rotateTowards(angle, targetAngle, FORTRESS_TURRET_FIRE_TURN_RATE * 0.016);
            }
            angle += (Math.random() - 0.5) * (burst.spread || this.config.turretBurst.spread);
            Game.projectiles.push({
                x: origin.x,
                y: origin.y,
                vx: Math.cos(angle) * burst.projectileSpeed,
                vy: Math.sin(angle) * burst.projectileSpeed,
                damage,
                size: 7,
                lifetime: 3.2,
                elapsed: 0
            });
        });
    }

    triggerKnockbackPulse(config) {
        const isClient = typeof Game !== 'undefined' && Game.isMultiplayerClient && Game.isMultiplayerClient();
        if (isClient) return;

        const pulse = this.buildKnockbackHazard(config);
        if (pulse) {
            this.addEnvironmentalHazard(pulse);
            this.activeKnockbackPulse = pulse;
        }
        const cooldown = config && config.contextual ? (this.config.knockbackPulse.contextCooldown || 3.0) : (this.config.knockbackPulse.baseCooldown || 1.8);
        this.knockbackContextCooldown = Math.max(this.knockbackContextCooldown, cooldown);
        this.knockbackProximityDelay = this.config.knockbackPulse.proximityDelay || 0.45;
        if (typeof Game !== 'undefined') {
            Game.triggerScreenShake(6, 0.35);
        }
    }

    buildKnockbackHazard(config) {
        const origin = { x: this.x, y: this.y - this.height * 0.2 };
        const hazard = {
            type: 'fortressKnockbackPulse',
            ignoreInvulnerability: true,
            x: origin.x,
            y: origin.y,
            radius: 0,
            maxRadius: config.radius || this.config.knockbackPulse.radius,
            lifetime: config.duration || this.config.knockbackPulse.duration,
            elapsed: 0,
            expired: false,
            damage: this.damage * (config.damageMultiplier || this.config.knockbackPulse.damageMultiplier),
            force: config.force || this.config.knockbackPulse.force,
            hitPlayers: new Set(),
            update: function(deltaTime) {
                this.elapsed += deltaTime;
                const progress = this.elapsed / this.lifetime;
                this.radius = Math.min(this.maxRadius, this.maxRadius * progress);
                if (this.elapsed >= this.lifetime) {
                    this.expired = true;
                }
            },
            applyDamage: function(player) {
                if (this.expired) return;
                const dx = player.x - this.x;
                const dy = player.y - this.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance <= this.radius + player.size) {
                    const key = player.playerId || player.id || player;
                    if (!this.hitPlayers.has(key)) {
                        player.takeDamage(this.damage);
                        this.hitPlayers.add(key);
                    }
                    if (player.applyDamageKnockback) {
                        const norm = distance > 0 ? 1 / distance : 0;
                        const falloff = Math.max(0.35, 1 - distance / Math.max(1, this.maxRadius || this.radius));
                        const pushForce = this.force * (1.2 + Math.sqrt(falloff) * 2.4);
                        player.applyDamageKnockback(dx * norm * pushForce, dy * norm * pushForce);
                        const effectiveForce = pushForce / Math.max(0.1, player.knockbackResistance || 1);
                        if (typeof player.damageKnockbackVx === 'number' && typeof player.damageKnockbackVy === 'number') {
                            player.damageKnockbackVx += dx * norm * effectiveForce;
                            player.damageKnockbackVy += dy * norm * effectiveForce;
                        }
                        if (typeof player.vx === 'number' && typeof player.vy === 'number') {
                            player.vx += dx * norm * effectiveForce * 0.35;
                            player.vy += dy * norm * effectiveForce * 0.35;
                        }
                    }
                }
            },
            render: function(ctx) {
                if (this.expired || !ctx) return;
                ctx.save();
                ctx.translate(this.x, this.y);
                const ratio = this.maxRadius > 0 ? this.radius / this.maxRadius : 0;
                const outerAlpha = 0.45 * (1 - ratio * 0.4);
                ctx.globalAlpha = outerAlpha;
                ctx.strokeStyle = '#ff4ddb';
                ctx.lineWidth = 18;
                ctx.beginPath();
                ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
                ctx.stroke();

                ctx.globalAlpha = Math.max(0, outerAlpha - 0.2);
                ctx.fillStyle = '#ff4ddb';
                ctx.beginPath();
                ctx.arc(0, 0, this.radius * 0.92, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
        };
        return hazard;
    }

    updateTurrets(deltaTime, player) {
        this.turrets.forEach(turret => {
            const world = this.getTurretWorldPosition(turret);
            let targetAngle = Math.PI / 2;
            if (player) {
                const dx = player.x - world.x;
                const dy = player.y - world.y;
                targetAngle = Math.atan2(dy, dx);
            }
            const turnRate = this.telegraph.type === 'turretBurst' || this.state === 'turretBurst'
                ? FORTRESS_TURRET_TURN_RATE
                : FORTRESS_TURRET_TURN_RATE * 0.5;
            turret.angle = this.rotateTowards(turret.angle, targetAngle, turnRate * deltaTime);
            turret.desiredAngle = targetAngle;
            turret.charge = Math.max(0, turret.charge - deltaTime * 0.6);
        });
    }

    getTurretWorldPosition(turret) {
        return {
            x: this.x + turret.offsetX,
            y: this.y + turret.offsetY
        };
    }

    considerMinionSpawn(deltaTime) {
        if (this.pendingWave) {
            this.pendingWave.timer += deltaTime;
            if (this.pendingWave.timer >= this.pendingWave.duration) {
                this.spawnGarrisonWave(this.pendingWave.config);
                this.pendingWave = null;
                this.gateTelegraph.active = false;
            }
            return;
        }

        if (this.activeMinionWave || this.minionWaveCooldown > 0 || this.minions.length > 0) return;
        if (typeof Game === 'undefined' || typeof currentRoom === 'undefined' || !currentRoom) return;

        const composition = this.config.minions.compositions[this.phase];
        if (!composition) return;

        this.pendingWave = {
            timer: 0,
            duration: this.config.minions.telegraphDuration,
            config: { composition }
        };
        this.startTelegraph('minionWave', this.pendingWave.duration, composition);
    }

    spawnGarrisonWave(details) {
        if (!details || !details.composition) return;
        if (this.activeMinionWave) return;
        const isClient = typeof Game !== 'undefined' && Game.isMultiplayerClient && Game.isMultiplayerClient();
        if (isClient) return;
        if (typeof currentRoom === 'undefined' || !currentRoom) return;

        const waveId = ++this.waveSequenceId;
        const composition = details.composition;
        const spawnCount = (composition.guards || 0) + (composition.skirmishers || 0);
        if (spawnCount === 0) return;

        const spawnRadius = 140;
        const gateBaseY = this.y + this.height * 0.15;
        const worldEnemies = Game && Game.enemies;

        for (let i = 0; i < composition.guards; i++) {
            const angle = Math.PI / 2 + ((i - (composition.guards - 1) / 2) * Math.PI) / Math.max(1, composition.guards * 2);
            const spawnX = this.x + Math.cos(angle) * spawnRadius;
            const spawnY = gateBaseY + Math.sin(angle) * (spawnRadius * 0.6);
            const guard = new RectangleEnemy(spawnX, spawnY);
            guard.maxHp = Math.floor(guard.maxHp * (this.phase === 3 ? 0.6 : 0.5));
            guard.hp = guard.maxHp;
            guard.damage *= 0.7;
            guard.lootChance = 0;
            guard.parentBoss = this;
            guard.waveId = waveId;
            currentRoom.enemies.push(guard);
            if (worldEnemies) worldEnemies.push(guard);
            this.minions.push(guard);
        }

        for (let i = 0; i < (composition.skirmishers || 0); i++) {
            const spread = (i - ((composition.skirmishers || 1) - 1) / 2);
            const spawnX = this.x + spread * 45;
            const spawnY = gateBaseY + 40 + i * 12;
            const skirmisher = new Enemy(spawnX, spawnY, this.currentTarget);
            skirmisher.maxHp = Math.floor(skirmisher.maxHp * (this.phase === 3 ? 0.4 : 0.35));
            skirmisher.hp = skirmisher.maxHp;
            skirmisher.damage *= 0.65;
            skirmisher.lootChance = 0;
            skirmisher.parentBoss = this;
            skirmisher.waveId = waveId;
            if (currentRoom) currentRoom.enemies.push(skirmisher);
            if (worldEnemies) worldEnemies.push(skirmisher);
            this.minions.push(skirmisher);
        }

        this.activeMinionWave = { id: waveId };
        this.minionWaveCooldown = this.config.minions.cooldown[this.phase] || 10;
    }

    rotateTowards(current, target, maxDelta) {
        let diff = target - current;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        if (diff > maxDelta) diff = maxDelta;
        if (diff < -maxDelta) diff = -maxDelta;
        return current + diff;
    }

    onPhaseTransition(oldPhase, newPhase) {
        super.onPhaseTransition(oldPhase, newPhase);
        this.patternQueue = [];
        this.state = 'idle';
        this.stateTimer = 0;
        this.stateDuration = 0;
        this.stateData = null;
        this.stateFired = false;
        this.clearTelegraph();
        this.activeArcVolley = null;
        this.activeTurretBurst = null;
        this.activeKnockbackPulse = null;
        this.pendingWave = null;
        this.gateTelegraph.active = false;
        this.phaseCycleCounters[newPhase] = 0;
        this.minionWaveCooldown = Math.min(this.minionWaveCooldown, this.config.minions.cooldown[newPhase] || this.minionWaveCooldown);
    }

    render(ctx) {
        if (!this.alive) return;

        ctx.save();
        ctx.translate(this.x, this.y);

        const telegraphCharge = this.knockbackTelegraphIntensity || 0;
        if (telegraphCharge > 0) {
            ctx.save();
            const auraRadius = Math.max(this.width, this.height) * (0.55 + telegraphCharge * 0.55);
            const innerRadius = auraRadius * 0.3;
            const gradient = ctx.createRadialGradient(0, 0, innerRadius, 0, 0, auraRadius);
            gradient.addColorStop(0, 'rgba(255, 77, 219, 0.35)');
            gradient.addColorStop(1, 'rgba(255, 77, 219, 0.0)');
            ctx.globalAlpha = 0.8;
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(0, 0, auraRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        const telegraphScale = 1 + telegraphCharge * 0.12;
        if (telegraphScale !== 1) {
            ctx.scale(telegraphScale, telegraphScale);
        }

        const palette = {
            baseFill: '#101533',
            baseStroke: '#57faff',
            shadow: 'rgba(8, 10, 22, 0.65)',
            accent1: '#ff59f7',
            accent2: '#41ffd7',
            accent3: '#7a7cff',
            turretCore: '#121a36',
            turretGlow: '#6df5ff',
            window: '#2cf5ff'
        };

        const baseWidth = this.width * 0.78;
        const baseHeight = this.height * 0.48;
        const baseLeft = -baseWidth / 2;
        const baseTop = -this.height * 0.1;
        const baseBottom = baseTop + baseHeight;

        // Shadow silhouette
        ctx.save();
        ctx.fillStyle = palette.shadow;
        ctx.fillRect(baseLeft - 28, baseTop - 36, baseWidth + 56, baseHeight + this.height * 0.42);
        ctx.restore();

        // Main wall
        this.drawNeonRect(ctx, baseLeft, baseTop, baseWidth, baseHeight, palette.baseFill, palette.baseStroke, 4, 18);

        // Central keep
        const keepWidth = this.width * 0.4;
        const keepHeight = this.height * 0.52;
        const keepLeft = -keepWidth / 2;
        const keepTop = baseTop - this.height * 0.16;
        this.drawNeonRect(ctx, keepLeft, keepTop, keepWidth, keepHeight, '#0e132d', palette.accent2, 3, 14);

        // Central doorway
        const doorWidth = keepWidth * 0.32;
        const doorHeight = keepHeight * 0.58;
        const doorLeft = -doorWidth / 2;
        const doorTop = keepTop + keepHeight - doorHeight;
        this.drawNeonRect(ctx, doorLeft, doorTop, doorWidth, doorHeight, '#070a17', palette.baseStroke, 3, 10);

        // Side buttresses
        const buttressWidth = this.width * 0.08;
        const buttressHeight = keepHeight * 0.66;
        const buttressOffset = keepWidth / 2 + buttressWidth * 0.2;
        this.drawNeonRect(ctx, -buttressOffset - buttressWidth, keepTop + keepHeight - buttressHeight, buttressWidth, buttressHeight, '#0a1024', palette.accent3, 3, 12);
        this.drawNeonRect(ctx, buttressOffset, keepTop + keepHeight - buttressHeight, buttressWidth, buttressHeight, '#0a1024', palette.accent3, 3, 12);

        // Left & right towers
        const towerWidth = this.width * 0.22;
        const towerHeight = this.height * 0.78;
        const towerBottom = baseBottom + this.height * 0.04;
        const leftTowerX = baseLeft - towerWidth * 0.55;
        const rightTowerX = baseLeft + baseWidth - towerWidth * 0.45;

        this.drawNeonRect(ctx, leftTowerX, towerBottom - towerHeight, towerWidth, towerHeight, palette.baseFill, palette.baseStroke, 4, 16);
        this.drawNeonRect(ctx, rightTowerX, towerBottom - towerHeight, towerWidth, towerHeight, palette.baseFill, palette.baseStroke, 4, 16);

        // Tower roofs
        const roofHeight = towerWidth * 0.75;
        const leftRoofPoints = [
            { x: leftTowerX + towerWidth / 2, y: towerBottom - towerHeight - roofHeight },
            { x: leftTowerX + towerWidth, y: towerBottom - towerHeight },
            { x: leftTowerX, y: towerBottom - towerHeight }
        ];
        const rightRoofPoints = [
            { x: rightTowerX + towerWidth / 2, y: towerBottom - towerHeight - roofHeight },
            { x: rightTowerX + towerWidth, y: towerBottom - towerHeight },
            { x: rightTowerX, y: towerBottom - towerHeight }
        ];
        this.drawNeonPolygon(ctx, leftRoofPoints, '#0b1024', palette.accent1, 3, 14);
        this.drawNeonPolygon(ctx, rightRoofPoints, '#0b1024', palette.accent1, 3, 14);

        // Tower flags
        const flagHeight = roofHeight * 0.55;
        this.drawFlag(ctx, leftTowerX + towerWidth / 2, towerBottom - towerHeight - roofHeight, flagHeight, palette.accent2, palette.accent1);
        this.drawFlag(ctx, rightTowerX + towerWidth / 2, towerBottom - towerHeight - roofHeight, flagHeight, palette.accent2, palette.accent1, true);

        // Crenellations on wall
        this.drawCrenellations(ctx, baseLeft, baseLeft + baseWidth, baseTop, this.width * 0.06, this.height * 0.08, '#121832', palette.baseStroke);

        // Accent piping
        const pipingWidth = this.width * 0.012;
        this.drawNeonRect(ctx, baseLeft + pipingWidth, baseTop + pipingWidth, baseWidth - pipingWidth * 2, pipingWidth, palette.accent2, null);
        this.drawNeonRect(ctx, keepLeft + pipingWidth, keepTop + pipingWidth, keepWidth - pipingWidth * 2, pipingWidth, palette.accent1, null);

        // Hexagonal weak point housings
        const windowRadius = this.width * 0.06;
        const windowY = baseTop + baseHeight * 0.35;
        const windowSpacing = this.width * 0.22;
        this.drawNeonHex(ctx, -windowSpacing, windowY, windowRadius, '#121a34', palette.accent2, 3, 12);
        this.drawNeonHex(ctx, 0, windowY, windowRadius, '#121a34', palette.accent2, 3, 12);
        this.drawNeonHex(ctx, windowSpacing, windowY, windowRadius, '#121a34', palette.accent2, 3, 12);

        // Turret mounts & barrels
        this.turrets.forEach(turret => {
            ctx.save();
            ctx.translate(turret.offsetX, turret.offsetY);
            this.drawTurret(ctx, turret, palette);
            ctx.restore();
        });

        ctx.restore();

        this.renderTelegraphs(ctx);
        this.renderWeakPoints(ctx);
        this.renderHazards(ctx);
        this.renderHealthBar(ctx);
    }

    drawNeonRect(ctx, x, y, width, height, fill, stroke, lineWidth = 3, glow = 10) {
        ctx.save();
        ctx.fillStyle = fill;
        ctx.fillRect(x, y, width, height);
        if (stroke) {
            ctx.shadowColor = stroke;
            ctx.shadowBlur = glow;
            ctx.strokeStyle = stroke;
            ctx.lineWidth = lineWidth;
            ctx.strokeRect(x, y, width, height);
        }
        ctx.restore();
    }

    drawNeonPolygon(ctx, points, fill, stroke, lineWidth = 3, glow = 10) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
        if (stroke) {
            ctx.shadowColor = stroke;
            ctx.shadowBlur = glow;
            ctx.strokeStyle = stroke;
            ctx.lineWidth = lineWidth;
            ctx.stroke();
        }
        ctx.restore();
    }

    drawNeonHex(ctx, cx, cy, radius, fill, stroke, lineWidth = 3, glow = 10) {
        const points = [];
        for (let i = 0; i < 6; i++) {
            const angle = Math.PI / 6 + (Math.PI / 3) * i;
            points.push({
                x: cx + Math.cos(angle) * radius,
                y: cy + Math.sin(angle) * radius
            });
        }
        this.drawNeonPolygon(ctx, points, fill, stroke, lineWidth, glow);
    }

    drawCrenellations(ctx, left, right, top, blockWidth, blockHeight, fill, stroke) {
        const spacing = blockWidth * 0.6;
        ctx.save();
        ctx.fillStyle = fill;
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 2;
        ctx.shadowColor = stroke;
        ctx.shadowBlur = 6;
        for (let xPos = left; xPos < right - blockWidth / 2; xPos += blockWidth + spacing) {
            ctx.fillRect(xPos, top - blockHeight, blockWidth, blockHeight);
            if (stroke) {
                ctx.strokeRect(xPos, top - blockHeight, blockWidth, blockHeight);
            }
        }
        ctx.shadowBlur = 0;
        ctx.restore();
    }

    drawFlag(ctx, x, y, height, poleColor, flagColor, flip = false) {
        const poleHeight = height * 1.35;
        ctx.save();
        ctx.fillStyle = poleColor;
        ctx.fillRect(x - 2, y - poleHeight, 4, poleHeight);

        const flagWidth = height * 0.75;
        const dir = flip ? -1 : 1;
        const points = [
            { x: x + dir * 2, y: y - height * 0.85 },
            { x: x + dir * (flagWidth + 2), y: y - height * 0.65 },
            { x: x + dir * 2, y: y - height * 0.45 }
        ];
        this.drawNeonPolygon(ctx, points, flagColor, '#ffffff', 2, 8);
        ctx.restore();
    }

    drawTurret(ctx, turret, palette) {
        ctx.save();

        const coreRadius = this.width * 0.05;
        // Core
        ctx.fillStyle = palette.turretCore;
        ctx.beginPath();
        ctx.arc(0, 0, coreRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowColor = palette.turretGlow;
        ctx.shadowBlur = 14;
        ctx.strokeStyle = palette.turretGlow;
        ctx.lineWidth = 3;
        ctx.stroke();

        // Barrel
        ctx.shadowBlur = 0;
        ctx.rotate(turret.angle);
        const barrelLength = this.width * 0.28;
        const barrelWidth = coreRadius * 0.55;
        ctx.fillStyle = palette.accent2;
        ctx.beginPath();
        this.roundRectPath(ctx, coreRadius * 0.4, -barrelWidth / 2, barrelLength, barrelWidth, barrelWidth * 0.35);
        ctx.fill();

        if (turret.charge > 0.1) {
            ctx.globalAlpha = 0.35 + 0.45 * turret.charge;
            ctx.fillStyle = palette.accent1;
            ctx.fillRect(coreRadius * 0.4, -barrelWidth * 0.7, barrelLength * 0.65, barrelWidth * 1.4);
            ctx.globalAlpha = 1.0;
        }

        ctx.shadowBlur = 0;
        ctx.restore();
    }

    roundRectPath(ctx, x, y, width, height, radius) {
        const r = Math.min(radius, width / 2, height / 2);
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + width - r, y);
        ctx.arcTo(x + width, y, x + width, y + r, r);
        ctx.lineTo(x + width, y + height - r);
        ctx.arcTo(x + width, y + height, x + width - r, y + height, r);
        ctx.lineTo(x + r, y + height);
        ctx.arcTo(x, y + height, x, y + height - r, r);
        ctx.lineTo(x, y + r);
        ctx.arcTo(x, y, x + r, y, r);
        ctx.closePath();
    }

    renderWeakPoints(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        this.weakPoints.forEach(wp => {
            if (!wp.visible) return;
            const glow = wp.glowIntensity || 1;
            const stroke = `rgba(87, 250, 255, ${0.55 + 0.35 * glow})`;
            this.drawNeonHex(ctx, wp.offsetX, wp.offsetY, wp.radius + 6, '#121833', stroke, 3, 18 * glow);

            ctx.save();
            ctx.globalAlpha = 0.4 + 0.45 * glow;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(wp.offsetX, wp.offsetY, wp.radius * 0.45, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });

        ctx.restore();
    }

    renderTelegraphs(ctx) {
        const progress = this.getTelegraphProgress();
        if (progress <= 0) return;
        if (this.telegraph.type === 'arcVolley') {
            const origin = this.getArcOrigin();
            const spread = Math.PI;
            const radius = 420;
            ctx.save();
            ctx.translate(origin.x, origin.y);
            ctx.globalAlpha = 0.35 + progress * 0.25;
            ctx.fillStyle = '#49d1ff';
            ctx.beginPath();
            ctx.moveTo(0, 0);
            const start = Math.PI - spread / 2;
            const end = Math.PI + spread / 2;
            ctx.arc(0, 0, radius, start, end);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        } else if (this.telegraph.type === 'turretBurst') {
            this.turrets.forEach(turret => {
                const pos = this.getTurretWorldPosition(turret);
                const length = 260;
                ctx.save();
                ctx.translate(pos.x, pos.y);
                ctx.rotate(turret.angle);
                ctx.globalAlpha = 0.25 + 0.3 * progress;
                ctx.fillStyle = '#7af5fa';
                ctx.fillRect(0, -6, length, 12);
                ctx.restore();
            });
        }
    }

    serialize() {
        const baseState = super.serialize();
        return {
            ...baseState,
            width: this.width,
            height: this.height,
            anchorX: this.anchorX,
            anchorY: this.anchorY,
            state: this.state,
            stateTimer: this.stateTimer,
            stateDuration: this.stateDuration,
            patternQueue: this.patternQueue,
            telegraph: this.telegraph,
            gateTelegraph: this.gateTelegraph,
            arcRotationOffset: this.arcRotationOffset,
            turrets: this.turrets.map(({ angle, charge }) => ({ angle, charge })),
            phaseCycleCounters: this.phaseCycleCounters,
            minionWaveCooldown: this.minionWaveCooldown,
            knockbackContextCooldown: this.knockbackContextCooldown,
            activeWave: this.activeMinionWave ? this.activeMinionWave.id : null,
            pendingWave: this.pendingWave ? {
                timer: this.pendingWave.timer,
                duration: this.pendingWave.duration,
                composition: this.pendingWave.config && this.pendingWave.config.composition
            } : null,
            activeArcVolley: this.activeArcVolley ? { ...this.activeArcVolley } : null,
            activeTurretBurst: this.activeTurretBurst ? { ...this.activeTurretBurst } : null
        };
    }

    applyState(state) {
        super.applyState(state);
        if (state.anchorX !== undefined) this.anchorX = state.anchorX;
        if (state.anchorY !== undefined) this.anchorY = state.anchorY;
        if (state.anchorX !== undefined || state.anchorY !== undefined) {
            this.anchorInitialized = true;
        }
        if (state.state !== undefined) this.state = state.state;
        if (state.stateTimer !== undefined) this.stateTimer = state.stateTimer;
        if (state.stateDuration !== undefined) this.stateDuration = state.stateDuration;
        if (state.patternQueue !== undefined) this.patternQueue = state.patternQueue.map(entry => ({ ...entry }));
        if (state.telegraph !== undefined) this.telegraph = { ...state.telegraph };
        if (state.gateTelegraph !== undefined) this.gateTelegraph = { ...state.gateTelegraph };
        if (state.arcRotationOffset !== undefined) this.arcRotationOffset = state.arcRotationOffset;
        if (state.turrets !== undefined) {
            state.turrets.forEach((tData, index) => {
                if (this.turrets[index]) {
                    this.turrets[index].angle = tData.angle;
                    this.turrets[index].charge = tData.charge;
                }
            });
        }
        if (state.phaseCycleCounters !== undefined) this.phaseCycleCounters = { ...state.phaseCycleCounters };
        if (state.minionWaveCooldown !== undefined) this.minionWaveCooldown = state.minionWaveCooldown;
        if (state.knockbackContextCooldown !== undefined) this.knockbackContextCooldown = state.knockbackContextCooldown;
        if (state.activeWave !== undefined) this.activeMinionWave = state.activeWave ? { id: state.activeWave } : null;
        if (state.pendingWave !== undefined && state.pendingWave) {
            this.pendingWave = {
                timer: state.pendingWave.timer,
                duration: state.pendingWave.duration,
                config: { composition: state.pendingWave.composition || this.config.minions.compositions[this.phase] }
            };
            this.gateTelegraph.active = true;
            this.gateTelegraph.timer = this.pendingWave.timer;
            this.gateTelegraph.duration = this.pendingWave.duration;
        }
        if (state.activeArcVolley !== undefined) {
            this.activeArcVolley = state.activeArcVolley ? { ...state.activeArcVolley } : null;
        }
        if (state.activeTurretBurst !== undefined) {
            this.activeTurretBurst = state.activeTurretBurst ? { ...state.activeTurretBurst } : null;
        }
    }

    static getTuningReference() {
        return FORTRESS_CONFIG_TEMPLATE;
    }

    static getTestChecklist() {
        return [
            'Phase 1: Verify arc volley telegraph clarity and pacing without damage wave cadence.',
            'Phase 2: Confirm turret burst rotation speed matches slower-than-Swarm reference and contextual knockback force.',
            'Phase 3: Ensure continuous bullet patterns and staggered turrets maintain readable gaps.',
            'Minion Waves: Check gate telegraph, spawn cooldown enforcement, and wave clear requirement.',
            'Multiplayer/Host: Validate hazard serialization, telegraph sync, and minion spawning only on host.'
        ];
    }
}

