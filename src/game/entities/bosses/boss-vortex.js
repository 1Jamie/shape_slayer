// Vortex Boss - Room 30 (Final Boss)
// Gravity-engine final boss with readable force windows, safe lanes, and cosmic showcase rendering.

const VORTEX_STATES = {
    NEUTRAL: 'neutral',
    TELEGRAPH: 'telegraph',
    ACTIVE: 'active',
    RECOVERY: 'recovery'
};

const VORTEX_ATTACKS = {
    ORBIT: 'orbitStrafe',
    BLINK: 'repositionBlink',
    DASH: 'gravityDash',
    INHALE: 'singularityInhale',
    BURST: 'polarityBurst',
    BLADES: 'orbitBlades',
    SPIRAL: 'spiralGates',
    LANCE: 'gravityLance',
    NEEDLES: 'needleCurtain',
    PULSAR: 'sweepingPulsar',
    CAGE: 'orbitalCage',
    NET: 'crossingNet',
    SCENERY: 'sceneryHarvest',
    WELLS: 'gravityWells',
    FINALE: 'eventHorizon'
};

const VORTEX_MOVEMENT_ACTIONS = new Set([
    VORTEX_ATTACKS.ORBIT,
    VORTEX_ATTACKS.BLINK,
    VORTEX_ATTACKS.DASH
]);

const VORTEX_FINALE_STATES = {
    NONE: 'VORTEX_FINALE_NONE',
    LOCK: 'VORTEX_FINALE_LOCK',
    INHALE: 'VORTEX_FINALE_INHALE',
    BLADES: 'VORTEX_FINALE_BLADES',
    BURST: 'VORTEX_FINALE_BURST',
    VOLLEY: 'VORTEX_FINALE_VOLLEY'
};

class BossVortex extends BossBase {
    constructor(x, y) {
        super(x, y);
        this.bossName = 'Vortex';

        this.bossScalingId = 'vortex';
        this.size = 80;
        this.hp = this.maxHp;
        this.damage = 16;
        this.moveSpeed = 132;
        this.color = '#00ced1';
        this.shape = 'vortex';
        this.collisionRadius = 34;
        this.damageProjectionMultiplier = 0.12;
        this.damageProjectionRadius = 18;
        this.contactKnockback = 38;
        this.vortexContactDamageMultiplier = 0.25;

        this.rotationAngle = 0;
        this.rotationSpeed = Math.PI * 0.45;
        this.visualPulse = 0;
        this.coreExposure = 0;

        this.state = VORTEX_STATES.NEUTRAL;
        this.stateTimer = 0;
        this.activeAttack = null;
        this.lastAttack = null;
        this.attackTimer = 0;
        this.attackDuration = 0;
        this.telegraphDuration = 0;
        this.recoveryDuration = 0;
        this.actionQueue = [];
        this.currentAction = null;
        this.currentComboName = '';
        this.comboStepIndex = 0;
        this.comboCounter = 0;
        this.telegraphActive = false;
        this.telegraphType = '';
        this.telegraphTimer = 0;

        this.cooldowns = {
            [VORTEX_ATTACKS.INHALE]: 1.2,
            [VORTEX_ATTACKS.BURST]: 5.5,
            [VORTEX_ATTACKS.BLADES]: 3.0,
            [VORTEX_ATTACKS.SPIRAL]: 2.0,
            [VORTEX_ATTACKS.LANCE]: 4.2,
            [VORTEX_ATTACKS.NEEDLES]: 4.8,
            [VORTEX_ATTACKS.PULSAR]: 7.0,
            [VORTEX_ATTACKS.CAGE]: 8.0,
            [VORTEX_ATTACKS.NET]: 5.4,
            [VORTEX_ATTACKS.SCENERY]: 8.5,
            [VORTEX_ATTACKS.WELLS]: 7.0,
            [VORTEX_ATTACKS.FINALE]: 8.0
        };

        this.attackFired = false;
        this.spiralWaveTimer = 0;
        this.spiralWavesFired = 0;
        this.spiralBaseAngle = 0;
        this.spiralDirection = 1;
        this.lastTargetAngle = 0;
        this.lanceTargetAngle = 0;
        this.lancePredictedPoint = null;
        this.beamBaseAngle = 0;
        this.beamDirection = 1;
        this.beamSpawned = false;
        this.patternTimer = 0;
        this.patternBurstsFired = 0;
        this.cageVolleyTimer = 0;
        this.rangedPressureTimer = 0;
        this.inhaleBulletTimer = 0;
        this.bladeSparkTimer = 0;
        this.burstRingFired = false;

        this.orbitBladeAngle = 0;
        this.orbitBladeDamageTimer = 0;

        this.gravityWells = [];
        this.wellSeed = 1;
        this.wellDamageTimer = 0;
        this.ghostBlocks = [];
        this.harvestSeed = 1;
        this.harvestRestored = true;

        this.gravityDampQueued = false;
        this.gravityForceActive = false;
        this.currentForceType = 'none';
        this.previousForceType = 'none';

        this.finaleState = VORTEX_FINALE_STATES.NONE;
        this.finaleElapsed = 0;
        this.finaleDirection = 1;
        this.finaleBaseAngle = 0;
        this.finaleAngularSpeed = Math.PI * 0.18;
        this.finaleCorridorWidth = Math.PI / 9;
        this.finaleDamageTimer = 0;
        this.finaleVolleyTimer = 0;
        this.finaleVolleyCount = 0;
        this.lastFinaleSoundState = VORTEX_FINALE_STATES.NONE;

        this.lensAssets = null;
        this.dustAssets = null;
        this.dustRotation = 0;
        this.dustCounterRotation = 0;
        this.chromaFramesRemaining = 0;
        this.syncedSoundKey = '';

        this.orbitDirection = 1;
        this.orbitDirectionTimer = 0;
        this.blinkDestination = null;
        this.blinkPhase = 'none';
        this.blinkAlpha = 1;
        this.blinkSnapDone = false;
        this.dashTarget = null;
        this.dashTelegraphStart = null;
        this.afterimages = [];
        this.afterimageTimer = 0;
        this.shockRings = [];
        this.arenaLight = {
            color: '#00ffff',
            alpha: 0,
            targetAlpha: 0
        };
        this.spectacle = {
            finaleFlashes: [],
            birthFlashes: [],
            corridorParticles: [],
            deathParticles: [],
            comboBanner: null,
            phaseMoment: null,
            deathSequence: null,
            bannerCanvases: null,
            birthFlashSprite: null,
            beatClock: 0,
            lastSpectacleBeat: -999,
            corridorParticleTimer: 0
        };
        this.massShadowActive = false;
        this.massShadowProgress = 0;
        this.panicMode = false;
        this.firstCollapseUsed = false;
        this.gravityStormUsed = false;

        this.addWeakPoint(0, 0, 12, 0);
        this.weakPoints[0].visible = true;
    }

    isAuthoritative() {
        return !(typeof Game !== 'undefined' && Game.isMultiplayerClient && Game.isMultiplayerClient());
    }

    shouldSuppressContactDamage() {
        if (this.state !== VORTEX_STATES.ACTIVE) return false;
        return this.activeAttack === VORTEX_ATTACKS.SPIRAL ||
            this.activeAttack === VORTEX_ATTACKS.LANCE ||
            this.activeAttack === VORTEX_ATTACKS.NEEDLES ||
            this.activeAttack === VORTEX_ATTACKS.PULSAR ||
            this.activeAttack === VORTEX_ATTACKS.CAGE ||
            this.activeAttack === VORTEX_ATTACKS.NET ||
            this.activeAttack === VORTEX_ATTACKS.SCENERY ||
            this.activeAttack === VORTEX_ATTACKS.WELLS ||
            this.activeAttack === VORTEX_ATTACKS.FINALE;
    }

    getContactDamageMultiplier() {
        return this.shouldSuppressContactDamage() ? 0 : this.vortexContactDamageMultiplier;
    }

    getAttackConfig(attack) {
        const phaseScale = this.phase === 3 ? 0.9 : this.phase === 2 ? 0.95 : 1;
        const configs = {
            [VORTEX_ATTACKS.ORBIT]: {
                telegraph: 0.12,
                active: this.phase === 3 || this.panicMode ? 0.55 : 0.7,
                recovery: 0,
                cooldown: 0,
                telegraphType: 'orbitStrafe'
            },
            [VORTEX_ATTACKS.BLINK]: {
                telegraph: 0.35,
                active: 0.34,
                recovery: 0,
                cooldown: 0,
                telegraphType: 'blink'
            },
            [VORTEX_ATTACKS.DASH]: {
                telegraph: 0.4,
                active: 0.32,
                recovery: 0,
                cooldown: 0,
                telegraphType: 'dash'
            },
            [VORTEX_ATTACKS.INHALE]: {
                telegraph: 1.05 * phaseScale,
                active: this.phase === 1 ? 1.05 : 1.25,
                recovery: this.phase === 1 ? 1.1 : 0.85,
                cooldown: this.phase === 1 ? 6.0 : 5.0,
                telegraphType: 'inhale'
            },
            inhaleFlip: {
                telegraph: 0.2,
                active: 0.72,
                recovery: 0.85,
                cooldown: 0,
                telegraphType: 'burstFlip'
            },
            [VORTEX_ATTACKS.BURST]: {
                telegraph: 0.85,
                active: 0.75,
                recovery: 0.95,
                cooldown: 6.5,
                telegraphType: 'burst'
            },
            [VORTEX_ATTACKS.BLADES]: {
                telegraph: 0.95 * phaseScale,
                active: this.phase === 3 ? 2.1 : 1.75,
                recovery: 1.0,
                cooldown: this.phase === 1 ? 5.0 : 4.4,
                telegraphType: 'blades'
            },
            [VORTEX_ATTACKS.SPIRAL]: {
                telegraph: 0.75,
                active: this.phase === 3 ? 1.0 : 0.78,
                recovery: 0.85,
                cooldown: this.phase === 1 ? 4.6 : 3.9,
                telegraphType: 'spiralGates'
            },
            [VORTEX_ATTACKS.LANCE]: {
                telegraph: 0.7,
                active: 0.28,
                recovery: 0.65,
                cooldown: 4.2,
                telegraphType: 'gravityLance'
            },
            [VORTEX_ATTACKS.NEEDLES]: {
                telegraph: 0.72,
                active: this.phase === 3 ? 1.35 : 1.12,
                recovery: 0.75,
                cooldown: 4.8,
                telegraphType: 'needleCurtain'
            },
            [VORTEX_ATTACKS.PULSAR]: {
                telegraph: 1.0,
                active: this.phase === 3 ? 2.4 : 2.0,
                recovery: 0.95,
                cooldown: 7.0,
                telegraphType: 'sweepingPulsar'
            },
            [VORTEX_ATTACKS.CAGE]: {
                telegraph: 0.95,
                active: this.phase === 3 ? 2.45 : 2.15,
                recovery: 0.95,
                cooldown: 8.0,
                telegraphType: 'orbitalCage'
            },
            [VORTEX_ATTACKS.NET]: {
                telegraph: 0.8,
                active: this.phase === 3 ? 1.25 : 1.0,
                recovery: 0.75,
                cooldown: 5.4,
                telegraphType: 'crossingNet'
            },
            [VORTEX_ATTACKS.SCENERY]: {
                telegraph: 1.0,
                active: this.phase === 3 ? 2.25 : this.phase === 2 ? 2.1 : 1.95,
                recovery: 0.85,
                cooldown: 8.5,
                telegraphType: 'sceneryHarvest'
            },
            [VORTEX_ATTACKS.WELLS]: {
                telegraph: 0.9,
                active: 3.0,
                recovery: 0.85,
                cooldown: 9.0,
                telegraphType: 'wells'
            },
            [VORTEX_ATTACKS.FINALE]: {
                telegraph: 1.3,
                active: 5.4,
                recovery: 1.65,
                cooldown: 10.0,
                telegraphType: 'eventHorizon'
            }
        };

        return configs[attack];
    }

    update(deltaTime, player) {
        if (!this.introComplete) return;
        if (!this.alive) return;

        if (!isFinite(deltaTime) || deltaTime <= 0 || deltaTime > 1) {
            deltaTime = 0.016;
        }

        if (this.spectacle && this.spectacle.deathSequence) {
            this.stateTimer += deltaTime;
            this.visualPulse += deltaTime;
            this.updateApexVisualState(deltaTime);
            this.rotationAngle += this.rotationSpeed * deltaTime;
            return;
        }

        const aggroPlayer = this.resolveAggroPlayer(deltaTime, player);
        if (!aggroPlayer) return;
        player = aggroPlayer;
        this.lastTargetAngle = Math.atan2(player.y - this.y, player.x - this.x);

        this.processKnockback(deltaTime);
        this.checkPhaseTransition();
        this.updateHazards(deltaTime, player);
        this.checkHazardCollisions(player, deltaTime);
        this.updateWeakPoints(deltaTime);

        this.stateTimer += deltaTime;
        this.visualPulse += deltaTime;
        this.rotationAngle += this.rotationSpeed * deltaTime;
        this.updatePanicMode();
        const dustSpeed = this.panicMode || this.activeAttack === VORTEX_ATTACKS.FINALE ? 0.16 : this.currentComboName === 'gravityStorm' ? 0.11 : 0.06;
        this.dustRotation += deltaTime * dustSpeed;
        this.dustCounterRotation -= deltaTime * (dustSpeed * 0.7);
        this.spiralDirection = this.getPhaseSpiralDirection();
        this.updateApexVisualState(deltaTime);

        Object.keys(this.cooldowns).forEach(key => {
            this.cooldowns[key] = Math.max(0, this.cooldowns[key] - deltaTime);
        });

        this.updateGravityWells(deltaTime, player);
        this.updateStateMachine(deltaTime, player);
        this.updateWeakPointExposure(deltaTime);
        this.keepInBounds();
    }

    updateStateMachine(deltaTime, player) {
        if (this.state === VORTEX_STATES.NEUTRAL) {
            this.telegraphActive = false;
            this.telegraphType = '';
            this.attackTimer = 0;
            this.gravityForceActive = false;
            this.currentForceType = 'none';
            this.moveInNeutral(deltaTime, player);
            this.updateRangedPressure(deltaTime, player);

            if (this.isAuthoritative()) {
                if (this.actionQueue.length === 0) {
                    this.enqueueNextCombo(player);
                }
                if (this.actionQueue.length > 0) {
                    this.startNextQueuedAction(player);
                }
            }
            return;
        }

        this.attackTimer += deltaTime;
        this.telegraphTimer = this.attackTimer;
        this.telegraphActive = this.state === VORTEX_STATES.TELEGRAPH;

        if (this.state === VORTEX_STATES.TELEGRAPH) {
            this.updateTelegraph(deltaTime, player);
            if (this.attackTimer >= this.telegraphDuration && this.isAuthoritative()) {
                this.beginActiveWindow();
            }
            return;
        }

        if (this.state === VORTEX_STATES.ACTIVE) {
            this.updateActiveAttack(deltaTime, player);
            if (this.attackTimer >= this.attackDuration && this.isAuthoritative()) {
                this.completeCurrentAction(player);
            }
            return;
        }

        if (this.state === VORTEX_STATES.RECOVERY) {
            this.gravityForceActive = false;
            this.currentForceType = 'none';
            this.rotationSpeed = Math.PI * 0.35;
            this.coreExposure = Math.min(1, this.coreExposure + deltaTime * 3);
            this.updateRangedPressure(deltaTime, player, true);
            if (this.attackTimer >= this.recoveryDuration && this.isAuthoritative()) {
                this.finishAttack();
            }
        }
    }

    moveInNeutral(deltaTime, player) {
        const distance = Math.hypot(player.x - this.x, player.y - this.y);
        const targetDistance = this.phase === 3 ? 330 : 250;
        const angleToPlayer = Math.atan2(this.y - player.y, this.x - player.x);
        this.orbitDirectionTimer -= deltaTime;
        if (this.orbitDirectionTimer <= 0) {
            this.orbitDirection *= -1;
            this.orbitDirectionTimer = this.panicMode ? 1.4 : 2.4;
        }
        const orbitAngle = angleToPlayer + this.orbitDirection * Math.PI * 0.5;
        const radialCorrection = Math.max(-120, Math.min(120, distance - targetDistance));
        const targetX = this.x + Math.cos(orbitAngle) * 150 + Math.cos(angleToPlayer) * radialCorrection;
        const targetY = this.y + Math.sin(orbitAngle) * 150 + Math.sin(angleToPlayer) * radialCorrection;
        this.moveTowardPoint(targetX, targetY, this.panicMode ? 0.9 : this.phase === 3 ? 0.72 : 0.58, deltaTime, 0.32);
        this.rotationSpeed += (Math.PI * 0.45 - this.rotationSpeed) * Math.min(1, deltaTime * 3);
    }

    updatePanicMode() {
        const hpPercent = this.hp / this.maxHp;
        this.panicMode = (this.phase === 2 && hpPercent <= 0.4) || (this.phase === 3 && hpPercent <= 0.18);
    }

    updateApexVisualState(deltaTime) {
        this.updateSpectacleVisuals(deltaTime);

        this.afterimageTimer -= deltaTime;
        if (this.afterimageTimer <= 0) {
            this.captureAfterimage();
            this.afterimageTimer = this.panicMode ? 0.045 : 0.07;
        }

        this.afterimages.forEach(image => {
            image.life -= deltaTime;
            image.alpha = Math.max(0, image.life / image.maxLife);
        });
        this.afterimages = this.afterimages.filter(image => image.life > 0);

        this.shockRings.forEach(ring => {
            ring.elapsed += deltaTime;
            ring.radius += ring.speed * deltaTime;
            ring.alpha = Math.max(0, 1 - ring.elapsed / ring.duration);
        });
        this.shockRings = this.shockRings.filter(ring => ring.elapsed < ring.duration);

        const targetAlpha = this.getArenaLightTarget();
        this.arenaLight.targetAlpha = targetAlpha.alpha;
        this.arenaLight.color = targetAlpha.color;
        this.arenaLight.alpha += (this.arenaLight.targetAlpha - this.arenaLight.alpha) * Math.min(1, deltaTime * 5);

        if (this.massShadowActive) {
            this.massShadowProgress = Math.min(1, this.massShadowProgress + deltaTime / Math.max(0.1, this.telegraphDuration));
        } else {
            this.massShadowProgress = Math.max(0, this.massShadowProgress - deltaTime * 4);
        }
    }

    getArenaLightTarget() {
        if (this.activeAttack === VORTEX_ATTACKS.FINALE || this.telegraphType === 'eventHorizon') {
            return { color: '#030018', alpha: 0.34 };
        }
        if (this.currentComboName === 'gravityStorm') {
            return { color: '#26105a', alpha: 0.2 };
        }
        if (this.activeAttack === VORTEX_ATTACKS.BURST || this.activeAttack === 'inhaleFlip') {
            return { color: '#ffffff', alpha: 0.12 };
        }
        if (this.activeAttack === VORTEX_ATTACKS.PULSAR || this.activeAttack === VORTEX_ATTACKS.CAGE) {
            return { color: '#071b2f', alpha: 0.18 };
        }
        if (this.activeAttack === VORTEX_ATTACKS.NET || this.activeAttack === VORTEX_ATTACKS.NEEDLES || this.activeAttack === VORTEX_ATTACKS.LANCE) {
            return { color: '#120c2f', alpha: 0.14 };
        }
        if (this.panicMode) {
            const noise = 0.5 + Math.sin(this.visualPulse * 29.7 + Math.sin(this.visualPulse * 11.1) * 2.4) * 0.5;
            return { color: '#14051f', alpha: 0.12 + noise * 0.08 };
        }
        return { color: '#00ffff', alpha: 0 };
    }

    updateSpectacleVisuals(deltaTime) {
        const spectacle = this.spectacle;
        if (!spectacle) return;
        spectacle.beatClock += deltaTime;

        spectacle.finaleFlashes.forEach(flash => {
            flash.elapsed += deltaTime;
            flash.alpha = Math.max(0, 1 - flash.elapsed / flash.duration);
        });
        spectacle.finaleFlashes = spectacle.finaleFlashes.filter(flash => flash.elapsed < flash.duration).slice(-12);

        spectacle.birthFlashes.forEach(flash => {
            flash.elapsed += deltaTime;
            flash.alpha = Math.max(0, 1 - flash.elapsed / flash.duration);
        });
        spectacle.birthFlashes = spectacle.birthFlashes.filter(flash => flash.elapsed < flash.duration).slice(-16);

        spectacle.corridorParticles.forEach(particle => {
            particle.elapsed += deltaTime;
            particle.distance += particle.speed * deltaTime;
            particle.alpha = Math.max(0, 1 - particle.elapsed / particle.duration);
        });
        spectacle.corridorParticles = spectacle.corridorParticles.filter(particle => particle.elapsed < particle.duration).slice(-30);

        spectacle.deathParticles.forEach(particle => {
            particle.elapsed += deltaTime;
            particle.distance = Math.max(0, particle.distance - particle.speed * deltaTime);
            particle.alpha = Math.max(0, 1 - particle.elapsed / particle.duration);
        });
        spectacle.deathParticles = spectacle.deathParticles.filter(particle => particle.elapsed < particle.duration).slice(-20);

        if (spectacle.comboBanner) {
            spectacle.comboBanner.elapsed += deltaTime;
            if (spectacle.comboBanner.elapsed >= spectacle.comboBanner.duration) {
                spectacle.comboBanner = null;
            }
        }

        if (spectacle.phaseMoment) {
            spectacle.phaseMoment.elapsed += deltaTime;
            if (spectacle.phaseMoment.elapsed >= spectacle.phaseMoment.duration) {
                spectacle.phaseMoment = null;
            }
        }

        if (spectacle.deathSequence) {
            this.updateDeathSequence(deltaTime);
        }

        if (this.finaleState === VORTEX_FINALE_STATES.LOCK) {
            this.updateFinaleCorridorParticles(deltaTime);
        }
    }

    captureAfterimage() {
        this.afterimages.push({
            x: this.x,
            y: this.y,
            rotationAngle: this.rotationAngle,
            coreExposure: this.coreExposure,
            alpha: 1,
            life: this.panicMode ? 0.32 : 0.24,
            maxLife: this.panicMode ? 0.32 : 0.24,
            scale: this.panicMode ? 1.08 : 1
        });
        if (this.afterimages.length > 5) {
            this.afterimages.shift();
        }
    }

    addShockRing(x = this.x, y = this.y, color = '#8ffcff', maxRadius = 180) {
        this.shockRings.push({
            x,
            y,
            color,
            radius: 20,
            maxRadius,
            speed: maxRadius / 0.45,
            elapsed: 0,
            duration: 0.45,
            alpha: 1
        });
        if (this.shockRings.length > 8) {
            this.shockRings.shift();
        }
    }

    getCoreIntensity() {
        if (this.spectacle && this.spectacle.deathSequence) return 1.08;
        if (this.panicMode) return 1.0;
        if (this.activeAttack === VORTEX_ATTACKS.FINALE || this.telegraphType === 'eventHorizon') return 0.9;
        if (this.spectacle && this.spectacle.phaseMoment) return 0.85;
        if (this.phase === 3) return 0.7;
        if (this.phase === 2) return 0.5;
        return 0.3;
    }

    getSpectaclePulse(multiplier = 1) {
        const panicBoost = this.panicMode ? 1.5 : 1;
        return 0.5 + Math.sin(this.visualPulse * Math.PI * 4 * multiplier * panicBoost) * 0.5;
    }

    getRenderJitter() {
        if (!this.panicMode && !(this.spectacle && this.spectacle.phaseMoment)) return { x: 0, y: 0 };
        const intensity = this.panicMode ? 3 : 1.8;
        return {
            x: Math.sin(this.visualPulse * 61.7) * intensity,
            y: Math.cos(this.visualPulse * 47.3) * intensity
        };
    }

    trySpectacleBeat(key, minInterval = 0.18) {
        const spectacle = this.spectacle;
        if (!spectacle) return false;
        const beatKey = `${key}:${this.finaleState}`;
        if (spectacle.lastBeatKey === beatKey && spectacle.beatClock - spectacle.lastSpectacleBeat < minInterval) {
            return false;
        }
        if (spectacle.beatClock - spectacle.lastSpectacleBeat < minInterval) {
            return false;
        }
        spectacle.lastBeatKey = beatKey;
        spectacle.lastSpectacleBeat = spectacle.beatClock;
        return true;
    }

    spawnFinaleSpectacleBeat(finaleState) {
        if (!finaleState || finaleState === VORTEX_FINALE_STATES.NONE) return;
        if (!this.trySpectacleBeat('finale', 0.16)) return;
        const colors = {
            [VORTEX_FINALE_STATES.LOCK]: '#9ffcff',
            [VORTEX_FINALE_STATES.INHALE]: '#5ffcff',
            [VORTEX_FINALE_STATES.BLADES]: '#ffffff',
            [VORTEX_FINALE_STATES.BURST]: '#ffffff',
            [VORTEX_FINALE_STATES.VOLLEY]: '#8c7bff'
        };
        const color = colors[finaleState] || '#ffffff';
        this.spectacle.finaleFlashes.push({
            x: this.x,
            y: this.y,
            color,
            state: finaleState,
            elapsed: 0,
            duration: finaleState === VORTEX_FINALE_STATES.BURST ? 0.32 : 0.24,
            alpha: 1
        });
        this.spectacle.finaleFlashes = this.spectacle.finaleFlashes.slice(-12);
        this.addShockRing(this.x, this.y, color, finaleState === VORTEX_FINALE_STATES.BURST ? 340 : 240);
        if (typeof Game !== 'undefined' && typeof Game.triggerScreenShake === 'function') {
            Game.triggerScreenShake(finaleState === VORTEX_FINALE_STATES.BURST ? 5 : 2.5, 0.18, 'boss');
        }
    }

    startComboBanner(comboName) {
        const canvas = this.getBannerCanvas(comboName);
        if (!canvas) return;
        this.spectacle.comboBanner = {
            name: comboName,
            canvas,
            elapsed: 0,
            duration: 0.58
        };
    }

    getBannerCanvas(comboName) {
        if (typeof document === 'undefined') return null;
        if (!this.spectacle.bannerCanvases) {
            this.spectacle.bannerCanvases = {};
        }
        const label = this.getComboBannerLabel(comboName);
        if (!label) return null;
        if (this.spectacle.bannerCanvases[label]) return this.spectacle.bannerCanvases[label];

        const canvas = document.createElement('canvas');
        canvas.width = 420;
        canvas.height = 72;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = 'bold 30px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 6;
        ctx.strokeStyle = 'rgba(0, 0, 12, 0.95)';
        ctx.strokeText(label, canvas.width / 2, canvas.height / 2);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(label, canvas.width / 2, canvas.height / 2);
        ctx.strokeStyle = 'rgba(95, 252, 255, 0.75)';
        ctx.lineWidth = 2;
        ctx.strokeText(label, canvas.width / 2, canvas.height / 2);
        this.spectacle.bannerCanvases[label] = canvas;
        return canvas;
    }

    getComboBannerLabel(comboName) {
        const labels = {
            apexEventHorizon: 'APEX EVENT HORIZON',
            gravityStorm: 'GRAVITY STORM',
            firstCollapse: 'FIRST COLLAPSE',
            panicReversal: 'PANIC REVERSAL',
            panicBladeGate: 'BLADE GATE',
            burstRepositionGate: 'POLARITY BREAK',
            wellBladeInhale: 'GRAVITY WELL',
            netNeedlePulsar: 'CROSSING NET',
            orbitInhaleGate: 'ORBITAL INHALE',
            blinkBladesBurst: 'BLINK BURST'
        };
        return labels[comboName] || null;
    }

    addProjectileBirthFlash(x, y, color = '#ffffff') {
        const spectacle = this.spectacle;
        if (!spectacle) return;
        spectacle.birthFlashes.push({
            x,
            y,
            color,
            elapsed: 0,
            duration: 0.16,
            alpha: 1
        });
        spectacle.birthFlashes = spectacle.birthFlashes.slice(-16);
    }

    updateFinaleCorridorParticles(deltaTime) {
        const spectacle = this.spectacle;
        if (!spectacle) return;
        spectacle.corridorParticleTimer -= deltaTime;
        if (spectacle.corridorParticleTimer > 0 || spectacle.corridorParticles.length >= 30) return;
        spectacle.corridorParticleTimer = 0.035;
        const base = this.getFinaleCorridorAngle();
        for (let i = 0; i < 2; i++) {
            const lane = (this.comboCounter + spectacle.corridorParticles.length + i) % 4;
            const angle = base + lane * Math.PI / 2 + (Math.random() - 0.5) * this.finaleCorridorWidth;
            spectacle.corridorParticles.push({
                angle,
                distance: 520,
                speed: -(360 + Math.random() * 120),
                elapsed: 0,
                duration: 0.75,
                alpha: 1,
                color: i % 2 === 0 ? '#9ffcff' : '#ffffff'
            });
        }
        spectacle.corridorParticles = spectacle.corridorParticles.slice(-30);
    }

    startPhaseMoment(oldPhase, newPhase) {
        if (!this.spectacle) return;
        if (!this.trySpectacleBeat(`phase-${oldPhase}-${newPhase}`, 0.35)) return;
        this.spectacle.phaseMoment = {
            oldPhase,
            newPhase,
            elapsed: 0,
            duration: newPhase === 3 ? 1.35 : 0.85
        };
        this.addShockRing(this.x, this.y, newPhase === 3 ? '#ffffff' : '#8c7bff', newPhase === 3 ? 420 : 280);
        if (typeof Game !== 'undefined' && typeof Game.triggerScreenShake === 'function') {
            Game.triggerScreenShake(newPhase === 3 ? 6 : 4, 0.35, 'boss');
        }
    }

    startDeathSequence() {
        if (!this.spectacle || this.spectacle.deathSequence) return;
        this.queueGravityDampForAllPlayers(true);
        this.deactivateGravityWells(true);
        this.expireVortexPatternBeams();
        this.restoreSceneryHarvest();
        this.environmentalHazards.forEach(hazard => {
            if (hazard) hazard.expired = true;
        });
        this.spectacle.deathSequence = {
            elapsed: 0,
            duration: 3,
            resolved: false,
            safeRadius: Math.max(120, this.size * 1.45),
            particleTimer: 0
        };
        this.spectacle.birthFlashes.length = 0;
        this.spectacle.deathParticles.length = 0;
        this.spectacle.finaleFlashes.length = Math.min(this.spectacle.finaleFlashes.length, 8);
        this.state = VORTEX_STATES.RECOVERY;
        this.activeAttack = null;
        this.telegraphActive = false;
        this.finaleState = VORTEX_FINALE_STATES.NONE;
        this.playAttackSound(VORTEX_ATTACKS.FINALE, 'phase');
        this.triggerChromaTrauma(8, 0.95);
        if (typeof Game !== 'undefined' && typeof Game.triggerScreenShake === 'function') {
            Game.triggerScreenShake(5, 0.6, 'boss');
        }
    }

    updateDeathSequence(deltaTime) {
        const sequence = this.spectacle && this.spectacle.deathSequence;
        if (!sequence || sequence.resolved) return;
        sequence.elapsed += deltaTime;
        const progress = Math.min(1, sequence.elapsed / sequence.duration);
        this.rotationSpeed = Math.PI * (1.4 + progress * 3.2);
        this.coreExposure = 1;
        sequence.particleTimer = (sequence.particleTimer || 0) - deltaTime;
        if (sequence.particleTimer <= 0 && this.spectacle.deathParticles.length < 20) {
            sequence.particleTimer = 0.055 - Math.min(0.035, progress * 0.03);
            const angle = this.visualPulse * 2.7 + this.spectacle.deathParticles.length * 2.399;
            this.spectacle.deathParticles.push({
                angle,
                distance: 620 + Math.sin(angle * 1.7) * 90,
                speed: 360 + progress * 520,
                elapsed: 0,
                duration: 0.9,
                alpha: 1
            });
        }
        if (progress > 0.72 && this.spectacle.finaleFlashes.length < 8) {
            this.spectacle.finaleFlashes.push({
                x: this.x,
                y: this.y,
                color: progress > 0.9 ? '#ffffff' : '#ff3b6b',
                state: 'death',
                elapsed: 0,
                duration: 0.2,
                alpha: 1
            });
        }
        if (sequence.elapsed >= sequence.duration && this.isAuthoritative()) {
            this.resolveDeathSequence();
        }
    }

    resolveDeathSequence() {
        const sequence = this.spectacle && this.spectacle.deathSequence;
        if (!sequence || sequence.resolved) return;
        sequence.resolved = true;
        this.getForceTargets().forEach(target => {
            if (!target || target.dead || target.alive === false || typeof target.takeDamage !== 'function') return;
            const distance = Math.hypot(target.x - this.x, target.y - this.y);
            if (distance > sequence.safeRadius + (target.size || 0)) {
                target.takeDamage(this.damage * 2.6);
            }
        });
        this.addShockRing(this.x, this.y, '#ffffff', 520);
        this.addShockRing(this.x, this.y, '#ff3b6b', 360);
        this.triggerChromaTrauma(10, 1);
        if (typeof Game !== 'undefined' && typeof Game.triggerScreenShake === 'function') {
            Game.triggerScreenShake(8, 0.45, 'boss');
        }
        super.die();
    }

    die() {
        if (this.spectacle && this.spectacle.deathSequence && this.spectacle.deathSequence.resolved) {
            super.die();
            return;
        }
        this.alive = true;
        this.hp = Math.min(this.hp, 0);
        this.startDeathSequence();
    }

    prepareMovementAction(action, player) {
        const mode = action.movementMode || 'orbitStrafe';
        if (action.name === VORTEX_ATTACKS.BLINK) {
            this.blinkDestination = this.findMovementDestination(mode, player);
            this.blinkPhase = 'fadeOut';
            this.blinkAlpha = 1;
            this.blinkSnapDone = false;
            this.addShockRing(this.blinkDestination.x, this.blinkDestination.y, '#5ffcff', 120);
        } else if (action.name === VORTEX_ATTACKS.DASH) {
            this.dashTelegraphStart = { x: this.x, y: this.y };
            this.dashTarget = this.findMovementDestination(mode, player);
            this.addShockRing(this.dashTarget.x, this.dashTarget.y, '#ffffff', 150);
        } else if (action.name === VORTEX_ATTACKS.ORBIT) {
            this.orbitDirection *= -1;
            this.orbitDirectionTimer = 1.2;
        }
    }

    findMovementDestination(mode, player) {
        const roomWidth = (typeof currentRoom !== 'undefined' && currentRoom) ? currentRoom.width : 2400;
        const roomHeight = (typeof currentRoom !== 'undefined' && currentRoom) ? currentRoom.height : 1350;
        const center = { x: roomWidth / 2, y: roomHeight / 2 };
        let target = { x: center.x, y: center.y };

        if (mode === 'centerSnap') {
            target = center;
        } else if (mode === 'behindPlayer' && player) {
            const angle = Math.atan2(player.y - this.y, player.x - this.x);
            target = {
                x: player.x - Math.cos(angle) * 260,
                y: player.y - Math.sin(angle) * 260
            };
        } else if (mode === 'edgeAnchor' || mode === 'edgeSlingshot') {
            const anchors = [
                { x: roomWidth * 0.2, y: roomHeight * 0.22 },
                { x: roomWidth * 0.8, y: roomHeight * 0.22 },
                { x: roomWidth * 0.8, y: roomHeight * 0.78 },
                { x: roomWidth * 0.2, y: roomHeight * 0.78 }
            ];
            target = anchors[(this.comboCounter + this.comboStepIndex) % anchors.length];
        } else {
            const angle = player ? Math.atan2(this.y - player.y, this.x - player.x) + this.orbitDirection * Math.PI * 0.6 : this.rotationAngle;
            const origin = player || center;
            target = {
                x: origin.x + Math.cos(angle) * 300,
                y: origin.y + Math.sin(angle) * 300
            };
        }

        return this.findSafeBossPosition(target.x, target.y);
    }

    updateOrbitStrafeAction(deltaTime) {
        const target = this.getForceTargets()[0] || null;
        if (!target) return;
        const angle = Math.atan2(this.y - target.y, this.x - target.x) + this.orbitDirection * Math.PI * 0.55;
        const targetX = target.x + Math.cos(angle) * (this.panicMode ? 320 : 270);
        const targetY = target.y + Math.sin(angle) * (this.panicMode ? 320 : 270);
        this.moveTowardPoint(targetX, targetY, this.panicMode ? 1.1 : 0.85, deltaTime, 0.25);
        this.rotationSpeed = Math.PI * (this.panicMode ? 1.8 : 1.1);
    }

    updateBlinkAction() {
        const duration = Math.max(0.1, this.attackDuration);
        const progress = Math.min(1, this.attackTimer / duration);
        if (progress < 0.45) {
            this.blinkAlpha = 1 - progress / 0.45;
        } else {
            if (!this.blinkSnapDone && this.blinkDestination) {
                this.captureAfterimage();
                this.teleportToSafePosition(this.blinkDestination.x, this.blinkDestination.y);
                this.addShockRing(this.x, this.y, '#5ffcff', 190);
                this.triggerChromaTrauma(3, 0.45);
                this.blinkSnapDone = true;
            }
            this.blinkAlpha = Math.min(1, (progress - 0.45) / 0.55);
        }
        this.rotationSpeed = Math.PI * 1.35;
    }

    updateDashAction(deltaTime) {
        if (!this.dashTarget) return;
        const dx = this.dashTarget.x - this.x;
        const dy = this.dashTarget.y - this.y;
        const distance = Math.hypot(dx, dy);
        if (distance > 4) {
            const speed = this.panicMode ? 980 : 760;
            const moveDistance = Math.min(distance, speed * deltaTime);
            this.x += (dx / distance) * moveDistance;
            this.y += (dy / distance) * moveDistance;
        } else {
            this.x = this.dashTarget.x;
            this.y = this.dashTarget.y;
        }
        this.rotationSpeed = Math.PI * 2.3;
    }

    chooseNextAttack(player) {
        if (this.phase === 3 && this.cooldowns[VORTEX_ATTACKS.FINALE] <= 0) {
            return VORTEX_ATTACKS.FINALE;
        }

        const distance = Math.hypot(player.x - this.x, player.y - this.y);
        const candidates = [];

        if (this.cooldowns[VORTEX_ATTACKS.INHALE] <= 0) candidates.push(VORTEX_ATTACKS.INHALE);
        if (this.cooldowns[VORTEX_ATTACKS.BLADES] <= 0 && distance < 420) candidates.push(VORTEX_ATTACKS.BLADES);
        if (this.cooldowns[VORTEX_ATTACKS.SPIRAL] <= 0) candidates.push(VORTEX_ATTACKS.SPIRAL);
        if (this.phase >= 2 && this.cooldowns[VORTEX_ATTACKS.BURST] <= 0 && distance < 320) candidates.push(VORTEX_ATTACKS.BURST);
        if (this.phase >= 2 && this.phase < 3 && this.cooldowns[VORTEX_ATTACKS.WELLS] <= 0) candidates.push(VORTEX_ATTACKS.WELLS);

        const filtered = candidates.filter(attack => attack !== this.lastAttack);
        const pool = filtered.length > 0 ? filtered : candidates;
        if (pool.length === 0) return null;

        if (pool.includes(VORTEX_ATTACKS.INHALE) && distance > 190) return VORTEX_ATTACKS.INHALE;
        if (pool.includes(VORTEX_ATTACKS.BURST) && distance < 210) return VORTEX_ATTACKS.BURST;
        return pool[0];
    }

    enqueueNextCombo(player) {
        const combo = this.chooseNextCombo(player);
        this.currentComboName = combo.name;
        this.comboStepIndex = 0;
        this.comboCounter++;
        this.actionQueue = combo.actions.map(action => ({ ...action }));
        this.startComboBanner(combo.name);
    }

    chooseNextCombo(player) {
        const hpPercent = this.hp / this.maxHp;
        if (this.phase === 3 && this.cooldowns[VORTEX_ATTACKS.FINALE] <= 0) {
            return {
                name: 'apexEventHorizon',
                actions: [
                    { name: VORTEX_ATTACKS.BLINK, movementMode: 'centerSnap', telegraphType: 'blink' },
                    { name: VORTEX_ATTACKS.FINALE, telegraphType: 'eventHorizon' }
                ]
            };
        }

        if (this.phase >= 2 && !this.gravityStormUsed && hpPercent <= 0.58) {
            this.gravityStormUsed = true;
            return {
                name: 'gravityStorm',
                actions: [
                    { name: VORTEX_ATTACKS.BLINK, movementMode: 'edgeAnchor', telegraphType: 'blink' },
                    { name: VORTEX_ATTACKS.WELLS, telegraphType: 'wells' },
                    { name: VORTEX_ATTACKS.CAGE, telegraphType: 'orbitalCage' },
                    { name: VORTEX_ATTACKS.BLADES, telegraphType: 'blades' },
                    { name: VORTEX_ATTACKS.INHALE, telegraphType: 'inhale' }
                ]
            };
        }

        if (!this.firstCollapseUsed) {
            this.firstCollapseUsed = true;
            return {
                name: 'firstCollapse',
                actions: [
                    { name: VORTEX_ATTACKS.BLINK, movementMode: 'centerSnap', telegraphType: 'blink' },
                    { name: VORTEX_ATTACKS.SCENERY, telegraphType: 'sceneryHarvest' },
                    { name: VORTEX_ATTACKS.INHALE, telegraphType: 'inhale' },
                    { name: VORTEX_ATTACKS.SPIRAL, telegraphType: 'spiralGates' }
                ]
            };
        }

        if (this.panicMode) {
            return this.comboCounter % 2 === 0
                ? {
                    name: 'panicReversal',
                    actions: [
                        { name: VORTEX_ATTACKS.DASH, movementMode: 'edgeSlingshot', telegraphType: 'dash' },
                        { name: VORTEX_ATTACKS.SCENERY, telegraphType: 'sceneryHarvest' },
                        { name: VORTEX_ATTACKS.INHALE, telegraphType: 'inhale' },
                        { name: 'inhaleFlip', telegraphType: 'burstFlip' },
                        { name: VORTEX_ATTACKS.NET, telegraphType: 'crossingNet' },
                        { name: VORTEX_ATTACKS.SPIRAL, telegraphType: 'spiralGates', metadata: { extraWaves: 1 } }
                    ]
                }
                : {
                    name: 'panicBladeGate',
                    actions: [
                        { name: VORTEX_ATTACKS.ORBIT, movementMode: 'panicOrbit', telegraphType: 'orbitStrafe' },
                        { name: VORTEX_ATTACKS.PULSAR, telegraphType: 'sweepingPulsar' },
                        { name: VORTEX_ATTACKS.BLADES, telegraphType: 'blades' },
                        { name: VORTEX_ATTACKS.BLINK, movementMode: 'behindPlayer', telegraphType: 'blink' },
                        { name: VORTEX_ATTACKS.NEEDLES, telegraphType: 'needleCurtain' }
                    ]
                };
        }

        if (this.phase >= 2) {
            const phaseCombo = this.comboCounter % 3;
            if (phaseCombo === 0) {
                return {
                    name: 'burstRepositionGate',
                    actions: [
                        { name: VORTEX_ATTACKS.BURST, telegraphType: 'burst' },
                        { name: VORTEX_ATTACKS.BLINK, movementMode: 'behindPlayer', telegraphType: 'blink' },
                        { name: VORTEX_ATTACKS.LANCE, telegraphType: 'gravityLance' },
                        { name: VORTEX_ATTACKS.SPIRAL, telegraphType: 'spiralGates' }
                    ]
                };
            }
            if (phaseCombo === 1) {
                return {
                    name: 'wellBladeInhale',
                    actions: [
                        { name: VORTEX_ATTACKS.WELLS, telegraphType: 'wells' },
                        { name: VORTEX_ATTACKS.CAGE, telegraphType: 'orbitalCage' },
                        { name: VORTEX_ATTACKS.SCENERY, telegraphType: 'sceneryHarvest' },
                        { name: VORTEX_ATTACKS.BLADES, telegraphType: 'blades' },
                        { name: VORTEX_ATTACKS.INHALE, telegraphType: 'inhale' }
                    ]
                };
            }
            return {
                name: 'netNeedlePulsar',
                actions: [
                    { name: VORTEX_ATTACKS.ORBIT, movementMode: 'orbitStrafe', telegraphType: 'orbitStrafe' },
                    { name: VORTEX_ATTACKS.NET, telegraphType: 'crossingNet' },
                    { name: VORTEX_ATTACKS.NEEDLES, telegraphType: 'needleCurtain' },
                    { name: VORTEX_ATTACKS.PULSAR, telegraphType: 'sweepingPulsar' }
                ]
            };
        }

        return this.comboCounter % 2 === 0
            ? {
                name: 'orbitInhaleGate',
                actions: [
                    { name: VORTEX_ATTACKS.ORBIT, movementMode: 'orbitStrafe', telegraphType: 'orbitStrafe' },
                    { name: VORTEX_ATTACKS.SCENERY, telegraphType: 'sceneryHarvest' },
                    { name: VORTEX_ATTACKS.INHALE, telegraphType: 'inhale' },
                    { name: VORTEX_ATTACKS.NEEDLES, telegraphType: 'needleCurtain' },
                    { name: VORTEX_ATTACKS.SPIRAL, telegraphType: 'spiralGates' }
                ]
            }
            : {
                name: 'blinkBladesBurst',
                actions: [
                    { name: VORTEX_ATTACKS.BLINK, movementMode: 'sideAnchor', telegraphType: 'blink' },
                    { name: VORTEX_ATTACKS.LANCE, telegraphType: 'gravityLance' },
                    { name: VORTEX_ATTACKS.BLADES, telegraphType: 'blades' },
                    { name: VORTEX_ATTACKS.BURST, telegraphType: 'burst' }
                ]
            };
    }

    startNextQueuedAction(player = null) {
        const action = this.actionQueue[0];
        if (!action) {
            this.beginRecoveryWindow();
            return;
        }
        this.startAttack(action, player);
    }

    startAttack(actionOrName, player = null) {
        const action = typeof actionOrName === 'string' ? { name: actionOrName } : { ...actionOrName };
        const attack = action.name;
        const baseConfig = this.getAttackConfig(attack);
        if (!baseConfig) return;
        const config = {
            ...baseConfig,
            telegraph: action.telegraph !== undefined ? action.telegraph : baseConfig.telegraph,
            active: action.active !== undefined ? action.active : baseConfig.active,
            recovery: action.recovery !== undefined ? action.recovery : baseConfig.recovery,
            telegraphType: action.telegraphType || baseConfig.telegraphType
        };
        if (!config) return;

        if (attack === VORTEX_ATTACKS.INHALE || attack === VORTEX_ATTACKS.FINALE) {
            this.deactivateGravityWells(true);
        }

        this.state = VORTEX_STATES.TELEGRAPH;
        this.activeAttack = attack;
        this.currentAction = action;
        this.comboStepIndex++;
        this.stateTimer = 0;
        this.attackTimer = 0;
        this.attackDuration = config.active;
        this.telegraphDuration = config.telegraph;
        this.recoveryDuration = config.recovery;
        this.telegraphType = config.telegraphType;
        this.telegraphActive = true;
        this.attackFired = false;
        this.burstRingFired = false;
        this.spiralWaveTimer = 0;
        this.spiralWavesFired = 0;
        this.patternTimer = 0;
        this.patternBurstsFired = 0;
        this.cageVolleyTimer = 0.18;
        this.beamSpawned = false;
        this.inhaleBulletTimer = 0.28;
        this.bladeSparkTimer = 0.22;
        this.orbitBladeDamageTimer = 0;
        this.finaleDamageTimer = 0;
        this.finaleVolleyTimer = 0;
        this.finaleVolleyCount = 0;
        this.currentForceType = 'none';
        this.gravityForceActive = false;
        this.coreExposure = 0;
        if (!VORTEX_MOVEMENT_ACTIONS.has(attack) && config.cooldown > 0) {
            this.cooldowns[attack] = config.cooldown;
        }

        if (attack === VORTEX_ATTACKS.SPIRAL || attack === VORTEX_ATTACKS.NET) {
            this.spiralBaseAngle = player
                ? Math.atan2(player.y - this.y, player.x - this.x)
                : this.rotationAngle;
        } else {
            this.spiralBaseAngle = this.rotationAngle;
        }

        if (attack === VORTEX_ATTACKS.LANCE) {
            this.lancePredictedPoint = this.getPredictedTargetPoint(player, 0.5);
            this.lanceTargetAngle = this.lancePredictedPoint
                ? Math.atan2(this.lancePredictedPoint.y - this.y, this.lancePredictedPoint.x - this.x)
                : this.lastTargetAngle;
        }

        if (attack === VORTEX_ATTACKS.PULSAR || attack === VORTEX_ATTACKS.CAGE) {
            this.beamDirection = Math.random() < 0.5 ? -1 : 1;
            this.beamBaseAngle = player
                ? Math.atan2(player.y - this.y, player.x - this.x)
                : this.rotationAngle;
        }

        if (attack === VORTEX_ATTACKS.FINALE) {
            this.finaleDirection = Math.random() < 0.5 ? -1 : 1;
            this.finaleBaseAngle = this.rotationAngle;
            this.finaleElapsed = 0;
            this.finaleState = VORTEX_FINALE_STATES.LOCK;
            this.lastFinaleSoundState = VORTEX_FINALE_STATES.NONE;
        }

        if (attack === VORTEX_ATTACKS.WELLS) {
            this.prepareGravityWells();
        }

        if (attack === VORTEX_ATTACKS.SCENERY) {
            this.prepareSceneryHarvest();
        }

        if (VORTEX_MOVEMENT_ACTIONS.has(attack)) {
            this.prepareMovementAction(action, player);
        }

        this.playAttackSound(attack, 'telegraph');
    }

    completeCurrentAction(player = null) {
        const finishedAttack = this.activeAttack;
        this.lastAttack = finishedAttack;
        this.actionQueue.shift();

        if (finishedAttack === VORTEX_ATTACKS.PULSAR || finishedAttack === VORTEX_ATTACKS.CAGE) {
            this.expireVortexPatternBeams();
        }
        if (finishedAttack === VORTEX_ATTACKS.SCENERY) {
            this.restoreSceneryHarvest();
        }

        if (this.currentForceType !== 'none' || finishedAttack === VORTEX_ATTACKS.INHALE || finishedAttack === VORTEX_ATTACKS.BURST || finishedAttack === 'inhaleFlip') {
            this.queueGravityDampForAllPlayers(true);
        }

        if (this.actionQueue.length > 0) {
            this.state = VORTEX_STATES.TELEGRAPH;
            this.attackTimer = 0;
            this.activeAttack = null;
            this.currentAction = null;
            this.gravityForceActive = false;
            this.currentForceType = 'none';
            this.startNextQueuedAction(player);
        } else {
            this.beginRecoveryWindow();
        }
    }

    updateTelegraph(deltaTime, player) {
        this.rotationSpeed += (Math.PI * 0.25 - this.rotationSpeed) * Math.min(1, deltaTime * 4);
        this.massShadowActive = this.activeAttack === VORTEX_ATTACKS.INHALE ||
            this.activeAttack === 'inhaleFlip' ||
            this.activeAttack === VORTEX_ATTACKS.FINALE;
        if (this.activeAttack === VORTEX_ATTACKS.FINALE) {
            this.finaleState = VORTEX_FINALE_STATES.LOCK;
            this.finaleElapsed = 0;
        }
        if (this.activeAttack === VORTEX_ATTACKS.INHALE) {
            this.deactivateGravityWells(true);
        }
    }

    beginActiveWindow() {
        this.state = VORTEX_STATES.ACTIVE;
        this.attackTimer = 0;
        this.telegraphActive = false;
        this.attackFired = false;
        this.coreExposure = 0;
        this.massShadowActive = false;

        if (this.activeAttack === VORTEX_ATTACKS.INHALE) {
            this.queueGravityDampForAllPlayers(true);
            this.currentForceType = 'pull';
            this.gravityForceActive = true;
            this.suppressCompetingGravityHazards();
        } else if (this.activeAttack === 'inhaleFlip') {
            this.queueGravityDampForAllPlayers(true);
            this.currentForceType = 'push';
            this.gravityForceActive = true;
            this.createShockwave(this.x, this.y, 350, 0.65, this.damage * 0.35);
            this.triggerChromaTrauma(4, 0.65);
        } else if (this.activeAttack === VORTEX_ATTACKS.BURST) {
            this.queueGravityDampForAllPlayers(true);
            this.currentForceType = 'push';
            this.gravityForceActive = true;
            this.createShockwave(this.x, this.y, 330, 0.72, this.damage * 0.35);
            this.triggerChromaTrauma(4, 0.5);
        } else if (this.activeAttack === VORTEX_ATTACKS.WELLS) {
            this.currentForceType = 'wells';
            this.gravityForceActive = true;
        } else if (this.activeAttack === VORTEX_ATTACKS.FINALE) {
            this.currentForceType = 'finale';
            this.gravityForceActive = true;
            this.finaleElapsed = 0;
            this.finaleState = VORTEX_FINALE_STATES.LOCK;
            this.suppressCompetingGravityHazards();
            this.spawnFinaleSpectacleBeat(this.finaleState);
            this.triggerChromaTrauma(5, 0.75);
        } else {
            this.currentForceType = 'none';
            this.gravityForceActive = false;
        }

        this.playAttackSound(this.activeAttack, 'active');
    }

    updateActiveAttack(deltaTime, player) {
        this.suppressCompetingGravityHazards();

        if (this.activeAttack === VORTEX_ATTACKS.INHALE) {
            this.updateSingularityInhale(deltaTime);
        } else if (this.activeAttack === 'inhaleFlip') {
            this.updatePolarityBurst(deltaTime);
        } else if (this.activeAttack === VORTEX_ATTACKS.BURST) {
            this.updatePolarityBurst(deltaTime);
        } else if (this.activeAttack === VORTEX_ATTACKS.BLADES) {
            this.updateOrbitBlades(deltaTime);
        } else if (this.activeAttack === VORTEX_ATTACKS.SPIRAL) {
            this.updateSpiralGates(deltaTime);
        } else if (this.activeAttack === VORTEX_ATTACKS.LANCE) {
            this.updateGravityLance(deltaTime, player);
        } else if (this.activeAttack === VORTEX_ATTACKS.NEEDLES) {
            this.updateNeedleCurtain(deltaTime);
        } else if (this.activeAttack === VORTEX_ATTACKS.PULSAR) {
            this.updateSweepingPulsar(deltaTime);
        } else if (this.activeAttack === VORTEX_ATTACKS.CAGE) {
            this.updateOrbitalCage(deltaTime);
        } else if (this.activeAttack === VORTEX_ATTACKS.NET) {
            this.updateCrossingNet(deltaTime);
        } else if (this.activeAttack === VORTEX_ATTACKS.SCENERY) {
            this.updateSceneryHarvest(deltaTime);
        } else if (this.activeAttack === VORTEX_ATTACKS.WELLS) {
            this.updateGravityWellForces(deltaTime);
        } else if (this.activeAttack === VORTEX_ATTACKS.FINALE) {
            this.updateEventHorizon(deltaTime);
        } else if (this.activeAttack === VORTEX_ATTACKS.ORBIT) {
            this.updateOrbitStrafeAction(deltaTime);
        } else if (this.activeAttack === VORTEX_ATTACKS.BLINK) {
            this.updateBlinkAction(deltaTime);
        } else if (this.activeAttack === VORTEX_ATTACKS.DASH) {
            this.updateDashAction(deltaTime);
        }
    }

    beginRecoveryWindow() {
        this.queueGravityDampForAllPlayers(true);
        this.state = VORTEX_STATES.RECOVERY;
        this.attackTimer = 0;
        this.telegraphActive = false;
        this.gravityForceActive = false;
        this.currentForceType = 'none';
        this.massShadowActive = false;
        this.actionQueue = [];
        this.currentAction = null;
        this.finaleState = VORTEX_FINALE_STATES.NONE;
        this.deactivateGravityWells(false);
        this.restoreSceneryHarvest();
        this.coreExposure = 1;
        this.playAttackSound(this.activeAttack, 'recovery');
    }

    finishAttack() {
        this.lastAttack = this.activeAttack;
        this.activeAttack = null;
        this.currentAction = null;
        this.currentComboName = '';
        this.actionQueue = [];
        this.massShadowActive = false;
        this.restoreSceneryHarvest();
        this.state = VORTEX_STATES.NEUTRAL;
        this.stateTimer = 0;
        this.attackTimer = 0;
        this.telegraphType = '';
        this.telegraphActive = false;
        this.finaleState = VORTEX_FINALE_STATES.NONE;
        this.rotationSpeed = Math.PI * 0.45;
    }

    updateSingularityInhale(deltaTime) {
        this.rotationSpeed += (Math.PI * 1.4 - this.rotationSpeed) * Math.min(1, deltaTime * 5);
        this.applyGravityToTargets({
            mode: 'pull',
            radius: 420,
            strength: this.phase === 3 ? 330 : this.phase === 2 ? 285 : 240,
            maxVelocity: this.phase === 3 ? 300 : 260,
            deltaTime
        });
        this.inhaleBulletTimer -= deltaTime;
        if (this.inhaleBulletTimer <= 0) {
            this.spawnRadialBulletRing({
                count: this.phase === 1 ? 12 : 16,
                speed: this.phase === 3 ? 205 : 185,
                damageScale: 0.42,
                gapAngle: this.lastTargetAngle,
                gapWidth: Math.PI / (this.phase === 1 ? 3.2 : 4.1),
                color: '#8ffcff',
                trailColor: '#35eaff',
                phaseOffset: this.attackTimer * 0.7
            });
            this.inhaleBulletTimer = this.phase === 3 ? 0.42 : 0.55;
        }
    }

    updatePolarityBurst(deltaTime) {
        this.rotationSpeed += (Math.PI * 0.85 - this.rotationSpeed) * Math.min(1, deltaTime * 5);
        this.applyGravityToTargets({
            mode: 'push',
            radius: 360,
            strength: 420,
            maxVelocity: 320,
            deltaTime
        });
        if (!this.attackFired && this.attackTimer > 0.08) {
            this.attackFired = true;
            if (typeof Game !== 'undefined') {
                Game.triggerScreenShake(5, 0.22, 'boss');
            }
        }
        if (!this.burstRingFired && this.attackTimer > 0.16) {
            this.burstRingFired = true;
            this.spawnRadialBulletRing({
                count: this.phase === 1 ? 14 : 18,
                speed: this.phase === 3 ? 260 : 230,
                damageScale: 0.48,
                gapAngle: this.lastTargetAngle + Math.PI,
                gapWidth: Math.PI / 3.4,
                color: '#ffffff',
                trailColor: '#8ffcff',
                phaseOffset: this.rotationAngle
            });
        }
    }

    updateOrbitBlades(deltaTime) {
        this.rotationSpeed = Math.PI * 1.25;
        this.orbitBladeAngle += (Math.PI * (this.phase === 3 ? 0.85 : 0.65)) * deltaTime;
        this.orbitBladeDamageTimer = Math.max(0, this.orbitBladeDamageTimer - deltaTime);
        if (!this.isAuthoritative()) return;

        this.getForceTargets().forEach(target => {
            if (this.isTargetInsideOrbitBlade(target) && this.orbitBladeDamageTimer <= 0) {
                target.takeDamage(this.damage * 0.42);
                this.orbitBladeDamageTimer = 0.35;
            }
        });
        this.bladeSparkTimer -= deltaTime;
        if (this.bladeSparkTimer <= 0) {
            this.spawnBladeSparkVolley();
            this.bladeSparkTimer = this.phase === 3 ? 0.42 : 0.55;
        }
    }

    updateSpiralGates(deltaTime) {
        this.rotationSpeed = Math.PI * 0.6;
        this.spiralWaveTimer -= deltaTime;
        if (this.spiralWaveTimer <= 0 && this.spiralWavesFired < (this.phase === 3 ? 4 : 3)) {
            this.spawnSpiralGateWave(this.spiralWavesFired);
            this.spiralWavesFired++;
            this.spiralWaveTimer = 0.26;
        }
    }

    updateGravityLance(deltaTime, player) {
        this.rotationSpeed = Math.PI * 0.95;
        if (!this.attackFired && this.attackTimer > 0.04) {
            this.attackFired = true;
            this.spawnPredictiveShotgun();
            this.addShockRing(this.x, this.y, '#ffffff', 130);
        }
    }

    updateNeedleCurtain(deltaTime) {
        this.rotationSpeed = Math.PI * 0.7;
        this.patternTimer -= deltaTime;
        if (this.patternTimer <= 0 && this.patternBurstsFired < (this.phase === 3 ? 7 : 5)) {
            this.spawnSineWavePetals(this.patternBurstsFired);
            this.patternBurstsFired++;
            this.patternTimer = this.phase === 3 ? 0.17 : 0.21;
        }
    }

    updateSweepingPulsar(deltaTime) {
        this.rotationSpeed = Math.PI * 0.5;
        if (!this.beamSpawned) {
            this.beamSpawned = true;
            this.spawnSweepingPulsarBeams();
        }

        const angularSpeed = Math.PI * (this.phase === 3 ? 0.42 : 0.34);
        const angle = this.beamBaseAngle + this.beamDirection * angularSpeed * this.attackTimer;
        this.updateBeamPair(`${this.id}-pulsar`, angle);
    }

    updateOrbitalCage(deltaTime) {
        this.rotationSpeed = Math.PI * 0.42;
        if (!this.beamSpawned) {
            this.beamSpawned = true;
            this.spawnOrbitalCageBeams();
        }

        this.cageVolleyTimer -= deltaTime;
        if (this.cageVolleyTimer <= 0) {
            this.spawnCageSliceVolley();
            this.cageVolleyTimer = this.phase === 3 ? 0.42 : 0.52;
        }
    }

    updateCrossingNet(deltaTime) {
        this.rotationSpeed = Math.PI * 0.65;
        this.patternTimer -= deltaTime;
        if (this.patternTimer <= 0 && this.patternBurstsFired < (this.phase === 3 ? 5 : 4)) {
            this.spawnCrossingNetBurst(this.patternBurstsFired);
            this.patternBurstsFired++;
            this.patternTimer = 0.22;
        }
    }

    prepareSceneryHarvest() {
        this.restoreSceneryHarvest();
        this.ghostBlocks = [];
        this.harvestRestored = false;

        const room = typeof currentRoom !== 'undefined' ? currentRoom : null;
        const layout = room && room.layout ? room.layout : null;
        if (!room || !layout || !Array.isArray(layout.grid)) return;
        if (typeof prepareRoomRenderData === 'function') {
            prepareRoomRenderData(room, typeof Game !== 'undefined' ? Game.roomNumber : 30);
        }

        const runs = (Array.isArray(room.blockedRuns) ? room.blockedRuns : [])
            .filter(run => run && run.length > 0 && run.width > 0 && run.height > 0);
        if (runs.length === 0) return;

        const desiredCount = this.phase === 1
            ? 3 + (this.harvestSeed % 2)
            : this.phase === 2
                ? 5
                : 6 + (this.harvestSeed % 2);
        const pressureTarget = this.getForceTargets()[0] || null;
        const selectedRuns = this.pickHarvestRuns(runs, Math.min(desiredCount, runs.length), pressureTarget);

        this.ghostBlocks = selectedRuns.map((run, index) => {
            const segment = this.createHarvestRunSegment(run, index, layout, pressureTarget);
            const cells = [];
            for (let offset = 0; offset < segment.length; offset++) {
                const col = segment.startCol + offset;
                const cellIndex = run.row * layout.cols + col;
                if (layout.grid[cellIndex] === 1) {
                    layout.grid[cellIndex] = 0;
                    cells.push({ row: run.row, col, index: cellIndex });
                }
            }
            return {
                id: `harvest-${this.harvestSeed}-${index}`,
                originX: segment.centerX,
                originY: segment.centerY,
                x: segment.centerX,
                y: segment.centerY,
                startX: segment.centerX,
                startY: segment.centerY,
                previousX: segment.centerX,
                previousY: segment.centerY,
                width: segment.width,
                height: segment.height,
                radius: Math.max(18, Math.min(70, Math.max(segment.width, segment.height) * 0.42)),
                row: run.row,
                startCol: segment.startCol,
                length: segment.length,
                cells,
                alpha: 1,
                damageCooldown: 0,
                restored: false,
                sprite: null,
                spritePadding: 10,
                threatScore: run.threatScore || 0
            };
        }).filter(block => block.cells.length > 0);

        const colors = this.getHarvestSceneryColors();
        this.ghostBlocks.forEach(block => {
            block.sprite = this.createHarvestBlockSprite(block, layout, colors);
        });

        this.harvestSeed++;
        this.eraseHarvestBlocksFromStaticCache(this.ghostBlocks);
    }

    pickHarvestRuns(runs, count, target = null) {
        const bossToTargetAngle = target ? Math.atan2(target.y - this.y, target.x - this.x) : 0;
        const behindPoint = target ? {
            x: target.x + Math.cos(bossToTargetAngle) * 250,
            y: target.y + Math.sin(bossToTargetAngle) * 250
        } : null;
        const ranked = runs
            .map((run, index) => {
                const dist = Math.hypot(run.centerX - this.x, run.centerY - this.y);
                const seed = Math.sin((index + 1) * (this.harvestSeed + 3) * 12.9898) * 43758.5453;
                const jitter = seed - Math.floor(seed);
                let threatScore = 0;
                if (target && behindPoint) {
                    const distToBehind = Math.hypot(run.centerX - behindPoint.x, run.centerY - behindPoint.y);
                    const laneDistance = this.distancePointToSegment(target.x, target.y, run.centerX, run.centerY, this.x, this.y);
                    const runAngle = Math.atan2(run.centerY - this.y, run.centerX - this.x);
                    const angleDiff = Math.abs(Math.atan2(Math.sin(runAngle - bossToTargetAngle), Math.cos(runAngle - bossToTargetAngle)));
                    const behindBonus = Math.max(0, 1 - distToBehind / 520) * 520;
                    const laneBonus = Math.max(0, 1 - laneDistance / 170) * 420;
                    const angleBonus = Math.max(0, 1 - angleDiff / 0.95) * 220;
                    threatScore = behindBonus + laneBonus + angleBonus;
                }
                const score = Math.abs(dist - 430) + jitter * 180 - threatScore;
                return { run: { ...run, threatScore }, score };
            })
            .sort((a, b) => a.score - b.score);
        return ranked.slice(0, count).map(entry => entry.run);
    }

    createHarvestRunSegment(run, index, layout, target = null) {
        const cellSize = layout && layout.cellSize ? layout.cellSize : 60;
        const maxCells = this.phase === 1 ? 1 : 2;
        const length = Math.max(1, Math.min(run.length || 1, maxCells));
        const maxOffset = Math.max(0, (run.length || 1) - length);
        let offset = 0;
        if (target && maxOffset > 0) {
            const desiredCol = Math.floor(target.x / cellSize - length / 2);
            offset = Math.max(0, Math.min(maxOffset, desiredCol - (run.startCol || run.col || 0)));
        } else {
            const seed = Math.sin((index + 1) * (this.harvestSeed + 11) * 78.233) * 43758.5453;
            const jitter = seed - Math.floor(seed);
            offset = Math.min(maxOffset, Math.floor(jitter * (maxOffset + 1)));
        }
        const startCol = (run.startCol || run.col || 0) + offset;
        return {
            row: run.row,
            startCol,
            length,
            width: length * cellSize,
            height: cellSize,
            centerX: (startCol + length / 2) * cellSize,
            centerY: run.row * cellSize + cellSize / 2
        };
    }

    distancePointToSegment(px, py, ax, ay, bx, by) {
        return Engine.Physics.Geometry.distancePointToSegment(px, py, ax, ay, bx, by);
    }

    updateSceneryHarvest(deltaTime) {
        this.rotationSpeed = Math.PI * 1.05;
        if (!this.ghostBlocks.length) return;

        const pullEnd = this.attackDuration * this.getHarvestPullFraction();
        const holdEnd = pullEnd + 0.45;
        const targets = this.getForceTargets();

        this.ghostBlocks.forEach((block, index) => {
            block.damageCooldown = Math.max(0, (block.damageCooldown || 0) - deltaTime);
            block.previousX = block.x;
            block.previousY = block.y;
            if (this.attackTimer < pullEnd) {
                const t = this.easeInCubic(this.attackTimer / Math.max(0.01, pullEnd));
                block.x = this.lerp(block.originX, this.x, t);
                block.y = this.lerp(block.originY, this.y, t);
                block.alpha = 1;
            } else if (this.attackTimer < holdEnd) {
                const t = (this.attackTimer - pullEnd) / Math.max(0.01, holdEnd - pullEnd);
                const angle = this.rotationAngle + index * (Math.PI * 2 / Math.max(1, this.ghostBlocks.length)) + t * Math.PI * 1.1;
                const orbitRadius = 48 + index * 5;
                block.x = this.x + Math.cos(angle) * orbitRadius;
                block.y = this.y + Math.sin(angle) * orbitRadius;
                block.startX = block.x;
                block.startY = block.y;
                block.alpha = 1;
            } else {
                block.x = block.originX;
                block.y = block.originY;
                block.alpha = 0;
            }

            if (this.isAuthoritative()) {
                this.damageTargetsWithGhostBlock(block, targets);
            }
        });

        if (this.attackTimer >= holdEnd && !this.harvestRestored) {
            this.restoreSceneryHarvest();
            this.addShockRing(this.x, this.y, '#ff6a9f', 210);
        }
    }

    damageTargetsWithGhostBlock(block, targets) {
        if (!block || block.damageCooldown > 0 || !Array.isArray(targets)) return;
        const halfW = Math.max(12, block.width * 0.5);
        const halfH = Math.max(12, block.height * 0.5);
        const hitRadius = Math.max(halfW, halfH) + 10;
        targets.forEach(target => {
            if (!target || target.alive === false || target.dead) return;
            const playerRadius = target.size || 18;
            const insideCurrent = Math.abs(target.x - block.x) <= halfW + playerRadius &&
                Math.abs(target.y - block.y) <= halfH + playerRadius;
            const sweptDistance = this.distancePointToSegment(
                target.x,
                target.y,
                block.previousX !== undefined ? block.previousX : block.x,
                block.previousY !== undefined ? block.previousY : block.y,
                block.x,
                block.y
            );
            const sweptHit = sweptDistance <= hitRadius + playerRadius;
            if ((insideCurrent || sweptHit) && typeof target.takeDamage === 'function') {
                target.takeDamage(this.damage * 0.62);
                if (typeof target.snapDampPullForce === 'function') {
                    target.snapDampPullForce(28, 3, 0.45, 0.5);
                }
                block.damageCooldown = 0.34;
            }
        });
    }

    getHarvestPullFraction() {
        return this.phase === 3 ? 0.42 : this.phase === 2 ? 0.45 : 0.48;
    }

    eraseHarvestBlocksFromStaticCache(blocks) {
        const room = typeof currentRoom !== 'undefined' ? currentRoom : null;
        const cache = room && room.renderCache ? room.renderCache : null;
        if (!cache || !cache.staticSceneCanvas || !Array.isArray(blocks) || blocks.length === 0) return;
        const ctx = cache.staticSceneCanvas.getContext('2d');
        if (!ctx) return;
        const scale = cache.scale || 1;
        ctx.save();
        ctx.scale(scale, scale);
        ctx.globalCompositeOperation = 'destination-out';
        blocks.forEach(block => {
            ctx.fillRect(
                block.originX - block.width / 2 - 3,
                block.originY - block.height / 2 - 3,
                block.width + 6,
                block.height + 6
            );
        });
        ctx.restore();
    }

    restoreSceneryHarvest() {
        if (!this.ghostBlocks || this.ghostBlocks.length === 0) {
            this.harvestRestored = true;
            return;
        }

        const room = typeof currentRoom !== 'undefined' ? currentRoom : null;
        const layout = room && room.layout ? room.layout : null;
        if (layout && Array.isArray(layout.grid)) {
            this.ghostBlocks.forEach(block => {
                if (!block || !Array.isArray(block.cells)) return;
                block.cells.forEach(cell => {
                    if (cell && cell.index >= 0 && cell.index < layout.grid.length) {
                        layout.grid[cell.index] = 1;
                    }
                });
                block.restored = true;
            });
            this.redrawHarvestBlocksToStaticCache(this.ghostBlocks);
        }

        this.ghostBlocks = [];
        this.harvestRestored = true;
    }

    redrawHarvestBlocksToStaticCache(blocks) {
        const room = typeof currentRoom !== 'undefined' ? currentRoom : null;
        const cache = room && room.renderCache ? room.renderCache : null;
        if (!cache || !cache.staticSceneCanvas || !Array.isArray(blocks) || blocks.length === 0) {
            if (room) room.renderCache = null;
            return;
        }
        const ctx = cache.staticSceneCanvas.getContext('2d');
        if (!ctx) return;
        const scale = cache.scale || 1;
        ctx.save();
        ctx.scale(scale, scale);
        ctx.globalCompositeOperation = 'source-over';
        blocks.forEach(block => {
            this.drawHarvestBlockSprite(ctx, block, block.originX, block.originY, 1);
        });
        ctx.restore();
    }

    refreshRoomSceneryRuns(room, layout) {
        if (!room || !layout) return;
        if (typeof computeBlockedRuns === 'function') {
            layout.cachedBlockedRuns = computeBlockedRuns(layout);
            room.blockedRuns = layout.cachedBlockedRuns;
            this.refreshSceneryLightEmitters(room, layout);
        } else if (Array.isArray(layout.cachedBlockedRuns)) {
            room.blockedRuns = layout.cachedBlockedRuns;
        }
    }

    refreshSceneryLightEmitters(room, layout) {
        if (!room || !layout || !Array.isArray(layout.cachedBlockedRuns)) return;
        const lightRadius = Math.max(80, (layout.cellSize || 60) * 1.35);
        const nonSceneryEmitters = Array.isArray(room.sceneryLightEmitters)
            ? room.sceneryLightEmitters.filter(emitter => emitter && emitter.type !== 'scenery')
            : [];
        const sceneryEmitters = layout.cachedBlockedRuns.map(run => ({
            x: run.centerX,
            y: run.centerY,
            radius: lightRadius + Math.min(140, run.length * (layout.cellSize || 60) * 0.25),
            type: 'scenery'
        }));
        layout.cachedSceneryLightEmitters = sceneryEmitters.concat(nonSceneryEmitters);
        room.sceneryLightEmitters = layout.cachedSceneryLightEmitters;
    }

    lerp(start, end, t) {
        const clamped = Math.max(0, Math.min(1, t));
        return start + (end - start) * clamped;
    }

    easeInCubic(t) {
        const clamped = Math.max(0, Math.min(1, t));
        return clamped * clamped * clamped;
    }

    easeOutCubic(t) {
        const clamped = Math.max(0, Math.min(1, t));
        return 1 - Math.pow(1 - clamped, 3);
    }

    updateGravityWellForces(deltaTime) {
        this.rotationSpeed = Math.PI * 0.35;
        this.applyGravityWellsToTargets(deltaTime);
    }

    updateEventHorizon(deltaTime) {
        this.finaleElapsed += deltaTime;
        const previousState = this.finaleState;
        this.finaleState = this.getFinaleStateForElapsed(this.finaleElapsed);

        if (previousState !== this.finaleState) {
            this.spawnFinaleSpectacleBeat(this.finaleState);
            this.triggerChromaTrauma(5, 0.85);
            this.playFinaleStateSound(this.finaleState);
        }

        if (this.finaleState === VORTEX_FINALE_STATES.INHALE) {
            this.rotationSpeed = Math.PI * 1.25;
            this.applyGravityToTargets({
                mode: 'pull',
                radius: 470,
                strength: 310,
                maxVelocity: 285,
                deltaTime
            });
        } else if (this.finaleState === VORTEX_FINALE_STATES.BLADES) {
            this.rotationSpeed = Math.PI * 1.7;
            this.finaleDamageTimer = Math.max(0, this.finaleDamageTimer - deltaTime);
            if (this.isAuthoritative()) {
                this.getForceTargets().forEach(target => {
                    if (!this.isInFinaleSafeCorridor(target) && this.finaleDamageTimer <= 0) {
                        target.takeDamage(this.damage * 0.45);
                        this.finaleDamageTimer = 0.38;
                    }
                });
            }
        } else if (this.finaleState === VORTEX_FINALE_STATES.BURST) {
            this.rotationSpeed = Math.PI * 0.8;
            this.applyGravityToTargets({
                mode: 'push',
                radius: 420,
                strength: 390,
                maxVelocity: 300,
                deltaTime
            });
            if (!this.attackFired) {
                this.attackFired = true;
                this.createShockwave(this.x, this.y, 380, 0.8, this.damage * 0.45);
            }
        } else if (this.finaleState === VORTEX_FINALE_STATES.VOLLEY) {
            this.rotationSpeed = Math.PI * 0.55;
            this.finaleVolleyTimer -= deltaTime;
            if (this.finaleVolleyTimer <= 0 && this.finaleVolleyCount < 4) {
                this.spawnSpiralGateWave(this.finaleVolleyCount, true);
                this.finaleVolleyCount++;
                this.finaleVolleyTimer = 0.22;
            }
        }
    }

    updateRangedPressure(deltaTime, player, duringRecovery = false) {
        if (!this.isAuthoritative() || !player) return;
        const distance = Math.hypot(player.x - this.x, player.y - this.y);
        const threshold = duringRecovery ? 430 : 520;
        if (distance < threshold) {
            this.rangedPressureTimer = Math.min(this.rangedPressureTimer, 0.18);
            return;
        }

        this.rangedPressureTimer -= deltaTime;
        if (this.rangedPressureTimer <= 0) {
            this.spawnAimedPressureVolley(player, duringRecovery);
            this.rangedPressureTimer = duringRecovery ? 0.48 : 0.7;
        }
    }

    spawnAimedPressureVolley(player, duringRecovery = false) {
        if (typeof Game === 'undefined' || !Game.projectiles || !player) return;
        const angle = Math.atan2(player.y - this.y, player.x - this.x);
        const spread = duringRecovery ? 0.34 : 0.24;
        const shots = duringRecovery ? 3 : 2;
        const speed = duringRecovery ? 240 : 215;
        for (let i = 0; i < shots; i++) {
            const offset = shots === 1 ? 0 : -spread / 2 + (spread / Math.max(1, shots - 1)) * i;
            const shotAngle = angle + offset;
            Game.projectiles.push({
                x: this.x + Math.cos(shotAngle) * 48,
                y: this.y + Math.sin(shotAngle) * 48,
                vx: Math.cos(shotAngle) * speed,
                vy: Math.sin(shotAngle) * speed,
                damage: this.damage * 0.42,
                size: 6,
                lifetime: 2.4,
                elapsed: 0,
                color: duringRecovery ? '#ffffff' : '#8ffcff',
                trailLength: 3,
                trailColor: '#35eaff'
            });
        }
        this.addProjectileBirthFlash(this.x, this.y, duringRecovery ? '#ffffff' : '#8ffcff');
    }

    spawnRadialBulletRing(options = {}) {
        if (!this.isAuthoritative() || typeof Game === 'undefined') return;
        if (!Game.projectiles) Game.projectiles = (typeof createProjectileList === "function" ? createProjectileList() : []);

        const count = options.count || 14;
        const speed = options.speed || 200;
        const gapAngle = options.gapAngle !== undefined ? options.gapAngle : this.lastTargetAngle;
        const gapWidth = options.gapWidth || Math.PI / 4;
        const phaseOffset = options.phaseOffset || 0;

        for (let i = 0; i < count; i++) {
            const angle = phaseOffset + (Math.PI * 2 / count) * i;
            const diff = Math.abs(Math.atan2(Math.sin(angle - gapAngle), Math.cos(angle - gapAngle)));
            if (diff < gapWidth * 0.5) continue;

            Game.projectiles.push({
                x: this.x + Math.cos(angle) * 46,
                y: this.y + Math.sin(angle) * 46,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                damage: this.damage * (options.damageScale || 0.45),
                size: options.size || 6,
                lifetime: options.lifetime || 2.7,
                elapsed: 0,
                color: options.color || '#8ffcff',
                trailLength: options.trailLength || 3,
                trailColor: options.trailColor || '#35eaff'
            });
        }
        this.addProjectileBirthFlash(this.x, this.y, options.color || '#8ffcff');
    }

    spawnBladeSparkVolley() {
        if (!this.isAuthoritative() || typeof Game === 'undefined') return;
        if (!Game.projectiles) Game.projectiles = (typeof createProjectileList === "function" ? createProjectileList() : []);

        const bladeCount = this.phase === 3 ? 8 : 6;
        const safeBlade = Math.floor(((this.lastTargetAngle - this.orbitBladeAngle - this.rotationAngle + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2 / bladeCount));
        for (let i = 0; i < bladeCount; i++) {
            if (Math.abs(i - safeBlade) <= 0) continue;
            const angle = this.orbitBladeAngle + this.rotationAngle + (Math.PI * 2 / bladeCount) * i;
            Game.projectiles.push({
                x: this.x + Math.cos(angle) * (this.size * 1.35),
                y: this.y + Math.sin(angle) * (this.size * 1.35),
                vx: Math.cos(angle) * (this.phase === 3 ? 220 : 195),
                vy: Math.sin(angle) * (this.phase === 3 ? 220 : 195),
                damage: this.damage * 0.38,
                size: 5,
                lifetime: 2.1,
                elapsed: 0,
                color: '#ffffff',
                trailLength: 2,
                trailColor: '#8ffcff'
            });
        }
        this.addProjectileBirthFlash(this.x, this.y, '#ffffff');
    }

    spawnPredictiveShotgun() {
        if (!this.isAuthoritative() || typeof Game === 'undefined') return;
        if (!Game.projectiles) Game.projectiles = (typeof createProjectileList === "function" ? createProjectileList() : []);

        const aimAngle = this.lanceTargetAngle;

        const shots = this.phase === 3 ? 11 : 9;
        const cone = Math.PI / 4;
        const speed = this.phase === 3 ? 335 : 305;
        const spawnRadius = this.getProjectileSpawnRadius();
        for (let i = 0; i < shots; i++) {
            const t = shots === 1 ? 0.5 : i / (shots - 1);
            const angle = aimAngle - cone * 0.5 + cone * t;
            Game.projectiles.push({
                x: this.x + Math.cos(angle) * spawnRadius,
                y: this.y + Math.sin(angle) * spawnRadius,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                damage: this.damage * 0.48,
                size: 5.5,
                lifetime: 1.85,
                elapsed: 0,
                color: '#ffffff',
                trailLength: 4,
                trailColor: '#8ffcff'
            });
        }
        this.addProjectileBirthFlash(this.x, this.y, '#ffffff');
    }

    spawnSineWavePetals(burstIndex = 0) {
        if (!this.isAuthoritative() || typeof Game === 'undefined') return;
        if (!Game.projectiles) Game.projectiles = (typeof createProjectileList === "function" ? createProjectileList() : []);

        const petalCount = this.phase === 3 ? 8 : 6;
        const speed = this.phase === 3 ? 215 : 195;
        const spawnRadius = this.getProjectileSpawnRadius();
        const baseAngle = this.rotationAngle * 0.45 + burstIndex * 0.18;
        for (let i = 0; i < petalCount; i++) {
            const angle = baseAngle + (Math.PI * 2 / petalCount) * i;
            const wavePhase = burstIndex * 0.7 + i * 0.95;
            Game.projectiles.push({
                x: this.x + Math.cos(angle) * spawnRadius,
                y: this.y + Math.sin(angle) * spawnRadius,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                damage: this.damage * 0.4,
                size: 5,
                lifetime: 2.8,
                elapsed: 0,
                color: '#9ffcff',
                trailLength: 3,
                trailColor: '#5ffcff',
                baseAngle: angle,
                baseSpeed: speed,
                waveAmplitude: this.phase === 3 ? 78 : 62,
                waveFrequency: this.phase === 3 ? 8.2 : 7.0,
                wavePhase,
                waveClock: 0
            });
        }
        this.addProjectileBirthFlash(this.x, this.y, '#9ffcff');
    }

    spawnCrossingNetBurst(burstIndex = 0) {
        if (!this.isAuthoritative() || typeof Game === 'undefined') return;
        if (!Game.projectiles) Game.projectiles = (typeof createProjectileList === "function" ? createProjectileList() : []);

        const streams = this.phase === 3 ? 9 : 8;
        const speed = this.phase === 3 ? 225 : 205;
        const spawnRadius = this.getProjectileSpawnRadius();
        const baseAngle = this.spiralBaseAngle + burstIndex * 0.28;
        for (let direction = -1; direction <= 1; direction += 2) {
            for (let i = 0; i < streams; i++) {
                const angle = baseAngle + direction * ((Math.PI * 2 / streams) * i + burstIndex * 0.2);
                Game.projectiles.push({
                    x: this.x + Math.cos(angle) * spawnRadius,
                    y: this.y + Math.sin(angle) * spawnRadius,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    damage: this.damage * 0.42,
                    size: 5.5,
                    lifetime: 2.65,
                    elapsed: 0,
                    color: direction > 0 ? '#8ffcff' : '#b8a7ff',
                    trailLength: 3,
                    trailColor: direction > 0 ? '#35eaff' : '#6a5cff'
                });
            }
        }
        this.addProjectileBirthFlash(this.x, this.y, '#b8a7ff');
    }

    spawnSweepingPulsarBeams() {
        const lifetime = Math.max(0.1, this.attackDuration - this.attackTimer + 0.08);
        this.createVortexBeam(`${this.id}-pulsar-0`, this.beamBaseAngle, lifetime, 38, 0.18);
        this.createVortexBeam(`${this.id}-pulsar-1`, this.beamBaseAngle + Math.PI, lifetime, 38, 0.18);
    }

    spawnOrbitalCageBeams() {
        const beamCount = this.phase === 3 ? 8 : 6;
        const lifetime = Math.max(0.1, this.attackDuration - this.attackTimer + 0.08);
        for (let i = 0; i < beamCount; i++) {
            const angle = this.beamBaseAngle + (Math.PI * 2 / beamCount) * i;
            this.createVortexBeam(`${this.id}-cage-${i}`, angle, lifetime, 28, 0.12);
        }
    }

    spawnCageSliceVolley() {
        if (!this.isAuthoritative() || typeof Game === 'undefined') return;
        if (!Game.projectiles) Game.projectiles = (typeof createProjectileList === "function" ? createProjectileList() : []);

        const target = this.getForceTargets()[0] || null;
        const targetAngle = target ? Math.atan2(target.y - this.y, target.x - this.x) : this.lastTargetAngle;
        const shots = this.phase === 3 ? 5 : 4;
        const spread = Math.PI / 7;
        const speed = this.phase === 3 ? 250 : 225;
        const spawnRadius = this.getProjectileSpawnRadius();
        for (let i = 0; i < shots; i++) {
            const offset = shots === 1 ? 0 : -spread * 0.5 + (spread / (shots - 1)) * i;
            const angle = targetAngle + offset;
            Game.projectiles.push({
                x: this.x + Math.cos(angle) * spawnRadius,
                y: this.y + Math.sin(angle) * spawnRadius,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                damage: this.damage * 0.38,
                size: 5,
                lifetime: 2.2,
                elapsed: 0,
                color: '#ffffff',
                trailLength: 3,
                trailColor: '#8ffcff'
            });
        }
        this.addProjectileBirthFlash(this.x, this.y, '#ffffff');
    }

    createVortexBeam(sourceId, angle, lifetime, width, damageScale) {
        const origin = this.getBeamOrigin(angle);
        const length = this.getBeamLength();
        if (typeof BeamHazard !== 'undefined') {
            const beam = new BeamHazard(origin.x, origin.y, {
                angle,
                length,
                width,
                lifetime,
                damagePerTick: this.damage * damageScale,
                tickInterval: 0.16,
                followSource: false,
                trackPlayer: false,
                sourceId,
                color: '#4dfcff',
                coreColor: '#9ffcff',
                haloColor: '#ffffff'
            });
            this.addEnvironmentalHazard(beam);
            return beam;
        }
        return null;
    }

    updateBeamPair(prefix, baseAngle) {
        this.environmentalHazards.forEach(hazard => {
            if (!hazard || hazard.type !== 'beam' || !hazard.sourceId || !hazard.sourceId.startsWith(prefix)) return;
            const isOpposite = hazard.sourceId.endsWith('-1');
            this.positionBeamAtAngle(hazard, baseAngle + (isOpposite ? Math.PI : 0));
        });
    }

    positionBeamAtAngle(beam, angle) {
        const origin = this.getBeamOrigin(angle);
        beam.x = origin.x;
        beam.y = origin.y;
        beam.angle = angle;
        beam.length = this.getBeamLength();
    }

    expireVortexPatternBeams() {
        const prefix = `${this.id}-`;
        this.environmentalHazards.forEach(hazard => {
            if (hazard && hazard.type === 'beam' && hazard.sourceId && hazard.sourceId.startsWith(prefix)) {
                hazard.expired = true;
            }
        });
    }

    getBeamOrigin(angle) {
        const blindSpotRadius = Math.max(70, this.size * 0.92);
        return {
            x: this.x + Math.cos(angle) * blindSpotRadius,
            y: this.y + Math.sin(angle) * blindSpotRadius
        };
    }

    getProjectileSpawnRadius() {
        return Math.max(72, this.size * 0.85);
    }

    getBeamLength() {
        const roomWidth = (typeof currentRoom !== 'undefined' && currentRoom) ? currentRoom.width : 2400;
        const roomHeight = (typeof currentRoom !== 'undefined' && currentRoom) ? currentRoom.height : 1350;
        return Math.hypot(roomWidth, roomHeight);
    }

    getPredictedTargetPoint(player = null, seconds = 0.5) {
        let target = player;
        if (!target || target.alive === false) {
            target = this.getForceTargets()[0] || null;
        }
        if (!target) return null;
        return {
            x: target.x + (target.vx || 0) * seconds,
            y: target.y + (target.vy || 0) * seconds
        };
    }

    getFinaleStateForElapsed(elapsed) {
        if (elapsed < 0.3) return VORTEX_FINALE_STATES.LOCK;
        if (elapsed < 1.6) return VORTEX_FINALE_STATES.INHALE;
        if (elapsed < 3.6) return VORTEX_FINALE_STATES.BLADES;
        if (elapsed < 4.3) return VORTEX_FINALE_STATES.BURST;
        if (elapsed < 5.4) return VORTEX_FINALE_STATES.VOLLEY;
        return VORTEX_FINALE_STATES.NONE;
    }

    getPhaseSpiralDirection() {
        if (this.phase === 1) return 1;
        if (this.phase === 2) return -1;
        return 1;
    }

    getForceTargets() {
        const targets = new Set();
        if (typeof this.getAllAlivePlayers === 'function') {
            this.getAllAlivePlayers().forEach(entry => {
                if (entry && entry.player) targets.add(entry.player);
            });
        }
        if (targets.size === 0 && typeof Game !== 'undefined' && Game.player && Game.player.alive) {
            targets.add(Game.player);
        }
        return Array.from(targets);
    }

    applyGravityToTargets(options) {
        if (!this.isAuthoritative()) return;
        this.suppressCompetingGravityHazards();
        this.getForceTargets().forEach(target => {
            this.applyCappedGravityForce(target, this.x, this.y, options);
        });
    }

    applyCappedGravityForce(target, sourceX, sourceY, options) {
        if (!target || target.dead || target.alive === false) return;

        const radius = options.radius || 300;
        const dx = sourceX - target.x;
        const dy = sourceY - target.y;
        const distance = Math.hypot(dx, dy);
        if (distance <= 0 || distance > radius) return;

        const direction = options.mode === 'push' ? -1 : 1;
        const falloff = 1 - (distance / radius);
        const strength = (options.strength || 220) * falloff;
        const dirX = (dx / distance) * direction;
        const dirY = (dy / distance) * direction;
        const deltaTime = options.deltaTime || 0.016;
        const forceX = dirX * strength * deltaTime;
        const forceY = dirY * strength * deltaTime;
        const maxVelocity = options.maxVelocity || 260;

        if (typeof target.applyImpulse === 'function') {
            target.applyImpulse(forceX, forceY, {
                resistance: 1,
                maxSpeed: Math.max(target.impulseMaxSpeed || 0, maxVelocity)
            });
            // Cap gravity contribution relative to continuous field strength
            const velocity = Math.hypot(target.impulseVx || 0, target.impulseVy || 0);
            if (velocity > maxVelocity) {
                const scale = maxVelocity / velocity;
                target.impulseVx *= scale;
                target.impulseVy *= scale;
            }
        } else {
            target.pullForceVx = (target.pullForceVx || 0) + forceX;
            target.pullForceVy = (target.pullForceVy || 0) + forceY;
            const velocity = Math.hypot(target.pullForceVx, target.pullForceVy);
            if (velocity > maxVelocity) {
                const scale = maxVelocity / velocity;
                target.pullForceVx *= scale;
                target.pullForceVy *= scale;
            }
        }
    }

    queueGravityDampForAllPlayers(snap = false) {
        this.getForceTargets().forEach(target => {
            if (!target) return;
            if (snap && typeof target.snapDampPullForce === 'function') {
                target.snapDampPullForce(42, 4, 0.4, 0.5);
            } else if (typeof target.smoothDampPullForce === 'function') {
                target.smoothDampPullForce(4, 0.85);
            } else {
                target.pullForceVx = (target.pullForceVx || 0) * (snap ? 0.4 : 0.85);
                target.pullForceVy = (target.pullForceVy || 0) * (snap ? 0.4 : 0.85);
            }
        });
    }

    suppressCompetingGravityHazards() {
        if (!this.gravityForceActive && this.currentForceType === 'none') return;
        this.environmentalHazards.forEach(hazard => {
            if (hazard && hazard.type === 'pullField') {
                hazard.expired = true;
            }
        });
    }

    prepareGravityWells() {
        this.gravityWells = [];
        const count = this.phase === 2 ? 3 : 4;
        const angleOffset = (this.wellSeed++ * 1.618) % (Math.PI * 2);
        for (let i = 0; i < count; i++) {
            const angle = angleOffset + (Math.PI * 2 / count) * i;
            const radius = 210 + (i % 2) * 85;
            const pos = this.findGravityWellTeleportPoint(
                this.x + Math.cos(angle) * radius,
                this.y + Math.sin(angle) * radius
            );
            this.gravityWells.push({
                x: pos.x,
                y: pos.y,
                radius: 120,
                innerRadius: 44,
                strength: 165,
                active: false,
                alpha: 1,
                armProgress: 0,
                activeElapsed: 0,
                collapseAt: 1.45 + i * 0.5,
                collapsed: false,
                collapseWarning: 0,
                deactivating: false
            });
        }
    }

    findGravityWellTeleportPoint(x, y) {
        const clamped = this.clampToRoom(x, y);
        const room = typeof currentRoom !== 'undefined' ? currentRoom : null;
        const layout = room && room.layout ? room.layout : null;
        if (!layout || typeof RoomLayoutGenerator === 'undefined' || typeof RoomLayoutGenerator.isPointWalkable !== 'function') {
            return clamped;
        }

        if (RoomLayoutGenerator.isPointWalkable(layout, clamped.x, clamped.y, this.size)) {
            return clamped;
        }

        const searchRadii = [40, 70, 100, 130, 160, 200];
        let best = null;
        let bestDistance = Infinity;
        searchRadii.forEach(searchRadius => {
            for (let i = 0; i < 12; i++) {
                const angle = (Math.PI * 2 / 12) * i + searchRadius * 0.013;
                const candidate = this.clampToRoom(
                    clamped.x + Math.cos(angle) * searchRadius,
                    clamped.y + Math.sin(angle) * searchRadius
                );
                if (!RoomLayoutGenerator.isPointWalkable(layout, candidate.x, candidate.y, this.size)) continue;
                const distance = Math.hypot(candidate.x - clamped.x, candidate.y - clamped.y);
                if (distance < bestDistance) {
                    best = candidate;
                    bestDistance = distance;
                }
            }
        });

        return best || this.findSafeBossPosition(clamped.x, clamped.y);
    }

    updateGravityWells(deltaTime) {
        this.gravityWells = this.gravityWells.filter(well => {
            if (this.activeAttack === VORTEX_ATTACKS.INHALE || this.activeAttack === VORTEX_ATTACKS.FINALE) {
                well.deactivating = true;
            }
            if (this.activeAttack === VORTEX_ATTACKS.WELLS && this.state === VORTEX_STATES.ACTIVE) {
                well.active = true;
                well.activeElapsed += deltaTime;
                well.armProgress = Math.min(1, well.armProgress + deltaTime * 2.5);
                well.collapseWarning = Math.max(0, Math.min(1, (well.activeElapsed - (well.collapseAt - 0.45)) / 0.45));
                if (!well.collapsed && well.activeElapsed >= well.collapseAt) {
                    this.collapseGravityWell(well);
                }
            }
            if (well.deactivating || this.state === VORTEX_STATES.RECOVERY) {
                well.active = false;
                well.alpha -= deltaTime * 2.35;
            }
            return well.alpha > 0;
        });
    }

    collapseGravityWell(well) {
        well.collapsed = true;
        well.active = false;
        well.deactivating = true;
        well.alpha = Math.min(well.alpha, 0.75);
        this.blinkToGravityWell(well);
        this.addShockRing(well.x, well.y, '#9f7bff', 170);
        this.createDamageZone(well.x, well.y, well.innerRadius || 44, 0.55, this.damage * 0.75);

        if (this.isAuthoritative()) {
            this.getForceTargets().forEach(target => {
                const distance = Math.hypot(target.x - well.x, target.y - well.y);
                if (distance <= (well.innerRadius || 44) + (target.size || 0) && typeof target.takeDamage === 'function') {
                    target.takeDamage(this.damage * 0.7);
                    if (typeof target.snapDampPullForce === 'function') {
                        target.snapDampPullForce(20, 3, 0.35, 0.5);
                    }
                }
            });
            this.spawnWellCollapseShards(well);
        }

        if (typeof Game !== 'undefined') {
            Game.triggerScreenShake(3.5, 0.18, 'boss');
        }
    }

    blinkToGravityWell(well) {
        if (!well) return;
        const originX = this.x;
        const originY = this.y;
        const target = this.findGravityWellTeleportPoint(well.x, well.y);
        well.x = target.x;
        well.y = target.y;
        this.captureAfterimage();
        this.addShockRing(originX, originY, '#5ffcff', 110);
        this.teleportToSafePosition(target.x, target.y);
        this.captureAfterimage();
        this.addShockRing(this.x, this.y, '#ffffff', 145);
        this.rotationAngle = Math.atan2(this.y - originY, this.x - originX);
        this.triggerChromaTrauma(2, 0.35);
    }

    spawnWellCollapseShards(well) {
        if (typeof Game === 'undefined') return;
        if (!Game.projectiles) Game.projectiles = (typeof createProjectileList === "function" ? createProjectileList() : []);

        const shardCount = this.panicMode ? 8 : 6;
        const baseAngle = this.rotationAngle + well.x * 0.001;
        for (let i = 0; i < shardCount; i++) {
            const angle = baseAngle + (Math.PI * 2 / shardCount) * i;
            Game.projectiles.push({
                x: well.x + Math.cos(angle) * 16,
                y: well.y + Math.sin(angle) * 16,
                vx: Math.cos(angle) * 185,
                vy: Math.sin(angle) * 185,
                damage: this.damage * 0.45,
                size: 6,
                lifetime: 1.6,
                elapsed: 0,
                color: '#b8a7ff',
                trailLength: 2,
                trailColor: '#6a5cff'
            });
        }
        this.addProjectileBirthFlash(well.x, well.y, '#b8a7ff');
    }

    updateGravityWellForces(deltaTime) {
        this.applyGravityWellsToTargets(deltaTime);
    }

    applyGravityWellsToTargets(deltaTime) {
        if (!this.isAuthoritative()) return;
        const activeWells = this.gravityWells.filter(well => well.active && !well.deactivating && !well.collapsed);
        if (activeWells.length === 0) return;

        this.getForceTargets().forEach(target => {
            let strongestWell = null;
            let strongestFalloff = 0;
            activeWells.forEach(well => {
                const distance = Math.hypot(well.x - target.x, well.y - target.y);
                if (distance > 0 && distance < well.radius) {
                    const falloff = 1 - distance / well.radius;
                    if (falloff > strongestFalloff) {
                        strongestFalloff = falloff;
                        strongestWell = well;
                    }
                }
            });
            if (strongestWell) {
                this.applyCappedGravityForce(target, strongestWell.x, strongestWell.y, {
                    mode: 'pull',
                    radius: strongestWell.radius,
                    strength: strongestWell.strength,
                    maxVelocity: 205,
                    deltaTime
                });
            }
        });
    }

    deactivateGravityWells(immediate) {
        this.gravityWells.forEach(well => {
            well.active = false;
            well.deactivating = true;
            if (immediate) well.alpha = Math.min(well.alpha, 0.25);
        });
    }

    spawnSpiralGateWave(waveIndex, finale = false) {
        if (!this.isAuthoritative() || typeof Game === 'undefined') return;
        if (!Game.projectiles) Game.projectiles = (typeof createProjectileList === "function" ? createProjectileList() : []);

        const pattern = this.getSpiralPattern(waveIndex, finale);

        for (let i = 0; i < pattern.count; i++) {
            if (this.isSpiralGapIndex(i, pattern)) continue;

            const angle = pattern.baseAngle + pattern.direction * (Math.PI * 2 / pattern.count) * i;
            Game.projectiles.push({
                x: this.x + Math.cos(angle) * 42,
                y: this.y + Math.sin(angle) * 42,
                vx: Math.cos(angle) * pattern.speed,
                vy: Math.sin(angle) * pattern.speed,
                damage: this.damage * (finale ? 0.7 : 0.6),
                size: finale ? 8 : 7,
                lifetime: 3.2,
                elapsed: 0,
                color: finale ? '#ffffff' : '#8ffcff',
                trailLength: finale ? 4 : 3,
                trailColor: finale ? '#8ffcff' : '#35eaff'
            });
        }
        this.addProjectileBirthFlash(this.x, this.y, finale ? '#ffffff' : '#8ffcff');

        if (typeof AudioManager !== 'undefined' && AudioManager.sounds && AudioManager.sounds.vortexSpiralGate) {
            AudioManager.sounds.vortexSpiralGate();
        }
    }

    getSpiralPattern(waveIndex = this.spiralWavesFired || 0, finale = false) {
        const count = finale ? 18 : this.phase === 1 ? 10 : 12;
        const gapCount = finale ? 4 : 3;
        const speed = finale ? 235 : this.phase === 1 ? 190 : this.phase === 2 ? 210 : 225;
        const direction = this.spiralDirection;
        const baseAngle = this.spiralBaseAngle + direction * waveIndex * 0.34 + this.phase * 0.18;
        return { count, gapCount, speed, direction, baseAngle };
    }

    isSpiralGapIndex(index, pattern) {
        const distanceFromGap = Math.min(index, pattern.count - index);
        return distanceFromGap < pattern.gapCount / 2;
    }

    isTargetInsideOrbitBlade(target) {
        const dx = target.x - this.x;
        const dy = target.y - this.y;
        const distance = Math.hypot(dx, dy);
        const innerRadius = this.size * 0.45;
        const outerRadius = this.size * 1.65;
        if (distance < innerRadius || distance > outerRadius + target.size) return false;

        const bladeCount = this.phase === 3 ? 8 : 6;
        const targetAngle = Math.atan2(dy, dx);
        for (let i = 0; i < bladeCount; i++) {
            const angle = this.orbitBladeAngle + this.rotationAngle + (Math.PI * 2 / bladeCount) * i;
            const diff = Math.abs(Math.atan2(Math.sin(targetAngle - angle), Math.cos(targetAngle - angle)));
            if (diff < 0.08 + target.size / Math.max(distance, 1)) return true;
        }
        return false;
    }

    getFinaleCorridorAngle() {
        if (this.finaleState === VORTEX_FINALE_STATES.LOCK) {
            return this.finaleBaseAngle;
        }
        const rotatingTime = Math.max(0, this.finaleElapsed - 0.3);
        return this.finaleBaseAngle + this.finaleDirection * this.finaleAngularSpeed * rotatingTime;
    }

    isInFinaleSafeCorridor(target) {
        const angle = Math.atan2(target.y - this.y, target.x - this.x);
        const base = this.getFinaleCorridorAngle();
        for (let i = 0; i < 4; i++) {
            const center = base + i * Math.PI / 2;
            const diff = Math.abs(Math.atan2(Math.sin(angle - center), Math.cos(angle - center)));
            if (diff < this.finaleCorridorWidth) return true;
        }
        return false;
    }

    updateWeakPointExposure(deltaTime) {
        const shouldExpose = this.state === VORTEX_STATES.RECOVERY || this.state === VORTEX_STATES.NEUTRAL;
        this.coreExposure += (shouldExpose ? 1 : -1) * deltaTime * 3;
        this.coreExposure = Math.max(0, Math.min(1, this.coreExposure));
        this.weakPoints[0].visible = this.coreExposure > 0.35;
    }

    onPhaseTransition(oldPhase, newPhase) {
        super.onPhaseTransition(oldPhase, newPhase);
        this.queueGravityDampForAllPlayers(true);
        this.deactivateGravityWells(true);
        this.actionQueue = [];
        this.currentAction = null;
        this.currentComboName = '';
        this.state = VORTEX_STATES.RECOVERY;
        this.activeAttack = null;
        this.expireVortexPatternBeams();
        this.restoreSceneryHarvest();
        this.attackTimer = 0;
        this.recoveryDuration = 1.2;
        this.telegraphActive = false;
        this.massShadowActive = false;
        this.finaleState = VORTEX_FINALE_STATES.NONE;
        this.cooldowns[VORTEX_ATTACKS.INHALE] = 1.0;
        this.cooldowns[VORTEX_ATTACKS.BLADES] = 2.0;
        this.cooldowns[VORTEX_ATTACKS.SPIRAL] = 1.4;
        this.cooldowns[VORTEX_ATTACKS.LANCE] = 1.2;
        this.cooldowns[VORTEX_ATTACKS.NEEDLES] = 1.6;
        this.cooldowns[VORTEX_ATTACKS.PULSAR] = newPhase === 3 ? 1.8 : 3.0;
        this.cooldowns[VORTEX_ATTACKS.CAGE] = newPhase >= 2 ? 2.2 : 6.0;
        this.cooldowns[VORTEX_ATTACKS.NET] = newPhase >= 2 ? 1.7 : 4.0;
        this.cooldowns[VORTEX_ATTACKS.SCENERY] = newPhase >= 2 ? 2.4 : 3.8;
        this.cooldowns[VORTEX_ATTACKS.FINALE] = newPhase === 3 ? 3.0 : 8.0;
        this.startPhaseMoment(oldPhase, newPhase);
        this.triggerChromaTrauma(5, 0.8);
        this.playAttackSound(VORTEX_ATTACKS.FINALE, 'phase');
    }

    triggerChromaTrauma(frames = 5, intensity = 0.7) {
        this.chromaFramesRemaining = Math.max(this.chromaFramesRemaining, frames);
        if (typeof Game !== 'undefined' && typeof Game.triggerChromaticTrauma === 'function') {
            Game.triggerChromaticTrauma(frames, intensity);
        }
    }

    playAttackSound(attack, stage) {
        if (typeof AudioManager === 'undefined' || !AudioManager.sounds) return;
        const sounds = AudioManager.sounds;
        if (attack === VORTEX_ATTACKS.INHALE && stage === 'telegraph' && sounds.vortexInhale) sounds.vortexInhale();
        if (attack === VORTEX_ATTACKS.SCENERY && stage === 'telegraph' && sounds.vortexInhale) sounds.vortexInhale();
        if (attack === 'inhaleFlip' && stage === 'telegraph' && sounds.vortexPolarityBurst) sounds.vortexPolarityBurst();
        if (attack === VORTEX_ATTACKS.BURST && stage === 'active' && sounds.vortexPolarityBurst) sounds.vortexPolarityBurst();
        if (attack === VORTEX_ATTACKS.BLADES && stage === 'active' && sounds.vortexOrbitBlades) sounds.vortexOrbitBlades();
        if ((attack === VORTEX_ATTACKS.LANCE || attack === VORTEX_ATTACKS.NET || attack === VORTEX_ATTACKS.NEEDLES) && stage === 'active' && sounds.vortexSpiralGate) sounds.vortexSpiralGate();
        if ((attack === VORTEX_ATTACKS.PULSAR || attack === VORTEX_ATTACKS.CAGE) && stage === 'telegraph' && sounds.vortexEventHorizon) sounds.vortexEventHorizon();
        if (attack === VORTEX_ATTACKS.WELLS && stage === 'telegraph' && sounds.vortexWells) sounds.vortexWells();
        if (attack === VORTEX_ATTACKS.FINALE && stage === 'telegraph' && sounds.vortexEventHorizon) sounds.vortexEventHorizon();
        if (stage === 'recovery' && sounds.vortexRecovery) sounds.vortexRecovery();
        if (stage === 'phase' && sounds.vortexOverload) sounds.vortexOverload();
    }

    playFinaleStateSound(finaleState) {
        if (this.lastFinaleSoundState === finaleState) return;
        this.lastFinaleSoundState = finaleState;
        if (typeof AudioManager === 'undefined' || !AudioManager.sounds || !AudioManager.sounds.vortexFinaleStep) return;
        AudioManager.sounds.vortexFinaleStep(finaleState);
    }

    render(ctx) {
        if (!this.alive || !ctx) return;

        this.renderArenaLighting(ctx);
        this.renderFinaleFlashes(ctx);
        this.renderAfterimages(ctx);
        this.renderShockRings(ctx);
        this.renderFlowLayer(ctx);
        this.renderMassShadows(ctx);
        this.renderCosmicAccretion(ctx);
        this.renderHazards(ctx);
        this.renderGravityWells(ctx);
        this.renderSceneryHarvest(ctx);
        this.renderGameplayVectors(ctx);
        this.renderBirthFlashes(ctx);
        this.renderCore(ctx);

        if (this.spectacle && this.spectacle.deathSequence) {
            this.renderDeathSequence(ctx);
            return;
        }

        if (this.weakPoints[0].visible) {
            this.renderWeakPoints(ctx);
        }

        this.renderHealthBar(ctx);
        this.renderStatusEffects(ctx);
    }

    renderFlowLayer(ctx) {
        const showingForceWindow = this.activeAttack === VORTEX_ATTACKS.INHALE ||
            this.activeAttack === VORTEX_ATTACKS.BURST ||
            this.activeAttack === 'inhaleFlip';
        if (!this.telegraphActive && this.finaleState === VORTEX_FINALE_STATES.NONE && !showingForceWindow) return;

        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        const pulse = this.getSpectaclePulse(1);

        if (this.telegraphType === 'inhale' || this.activeAttack === VORTEX_ATTACKS.INHALE || this.finaleState === VORTEX_FINALE_STATES.INHALE) {
            this.renderLensEffect(ctx, 'inhale');
            this.renderInwardFlow(ctx, pulse);
        } else if (this.telegraphType === 'burst' || this.telegraphType === 'burstFlip' || this.activeAttack === VORTEX_ATTACKS.BURST || this.activeAttack === 'inhaleFlip' || this.finaleState === VORTEX_FINALE_STATES.BURST) {
            this.renderLensEffect(ctx, 'burst');
            this.renderOutwardFlow(ctx, pulse);
        }

        if (this.telegraphType === 'eventHorizon' || this.activeAttack === VORTEX_ATTACKS.FINALE) {
            this.renderSafeCorridors(ctx, pulse);
            if (this.finaleState === VORTEX_FINALE_STATES.LOCK) {
                this.renderFinaleLockCeremony(ctx, pulse);
            }
        }

        ctx.restore();
    }

    renderArenaLighting(ctx) {
        if (!this.arenaLight || this.arenaLight.alpha <= 0.01) return;
        const roomWidth = (typeof currentRoom !== 'undefined' && currentRoom) ? currentRoom.width : 2400;
        const roomHeight = (typeof currentRoom !== 'undefined' && currentRoom) ? currentRoom.height : 1350;
        ctx.save();
        ctx.globalAlpha = this.arenaLight.alpha;
        ctx.fillStyle = this.arenaLight.color;
        ctx.globalCompositeOperation = this.arenaLight.color === '#ffffff' ? 'screen' : 'multiply';
        ctx.fillRect(0, 0, roomWidth, roomHeight);
        ctx.restore();
    }

    renderFinaleFlashes(ctx) {
        const flashes = this.spectacle ? this.spectacle.finaleFlashes : null;
        if (!Array.isArray(flashes) || flashes.length === 0) return;
        const roomWidth = (typeof currentRoom !== 'undefined' && currentRoom) ? currentRoom.width : 2400;
        const roomHeight = (typeof currentRoom !== 'undefined' && currentRoom) ? currentRoom.height : 1350;
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        flashes.forEach(flash => {
            const alpha = flash.alpha || 0;
            if (alpha <= 0) return;
            ctx.globalAlpha = alpha * (flash.state === VORTEX_FINALE_STATES.BURST ? 0.28 : 0.16);
            ctx.fillStyle = flash.color || '#ffffff';
            ctx.fillRect(0, 0, roomWidth, roomHeight);

            ctx.globalAlpha = alpha * 0.65;
            ctx.strokeStyle = flash.color || '#ffffff';
            ctx.lineWidth = flash.state === VORTEX_FINALE_STATES.BURST ? 8 : 4;
            ctx.beginPath();
            ctx.arc(flash.x, flash.y, 90 + (1 - alpha) * 300, 0, Math.PI * 2);
            ctx.stroke();
        });
        ctx.restore();
    }

    getBirthFlashSprite() {
        if (this.spectacle && this.spectacle.birthFlashSprite) return this.spectacle.birthFlashSprite;
        if (typeof document === 'undefined' || !this.spectacle) return null;
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
        gradient.addColorStop(0.35, 'rgba(143, 252, 255, 0.65)');
        gradient.addColorStop(1, 'rgba(143, 252, 255, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 64, 64);
        this.spectacle.birthFlashSprite = canvas;
        return canvas;
    }

    renderBirthFlashes(ctx) {
        const flashes = this.spectacle ? this.spectacle.birthFlashes : null;
        if (!Array.isArray(flashes) || flashes.length === 0) return;
        const sprite = this.getBirthFlashSprite();
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        flashes.forEach(flash => {
            const alpha = flash.alpha || 0;
            if (alpha <= 0) return;
            const scale = 0.65 + (1 - alpha) * 0.8;
            const size = 64 * scale;
            ctx.globalAlpha = alpha * 0.85;
            if (sprite) {
                ctx.drawImage(sprite, flash.x - size / 2, flash.y - size / 2, size, size);
            } else {
                ctx.fillStyle = flash.color || '#ffffff';
                ctx.beginPath();
                ctx.arc(flash.x, flash.y, 18 * scale, 0, Math.PI * 2);
                ctx.fill();
            }
        });
        ctx.restore();
    }

    renderAfterimages(ctx) {
        if (!this.afterimages.length) return;
        this.afterimages.forEach((image, index) => {
            const alpha = image.alpha * (0.08 + index * 0.055);
            if (alpha <= 0) return;
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.globalCompositeOperation = 'screen';
            ctx.translate(image.x, image.y);
            ctx.rotate(image.rotationAngle);
            ctx.scale(image.scale, image.scale);
            const visualRadius = this.size * 0.52;
            ctx.fillStyle = '#04232b';
            ctx.strokeStyle = '#66ffff';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(0, 0, visualRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.restore();
        });
    }

    renderShockRings(ctx) {
        this.shockRings.forEach(ring => {
            ctx.save();
            ctx.globalCompositeOperation = 'screen';
            ctx.globalAlpha = ring.alpha * 0.85;
            ctx.strokeStyle = ring.color;
            ctx.lineWidth = 4 * ring.alpha + 1;
            ctx.beginPath();
            ctx.arc(ring.x, ring.y, Math.min(ring.radius, ring.maxRadius), 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        });
    }

    renderSceneryHarvest(ctx, telegraphOnly = false) {
        if (!this.ghostBlocks || this.ghostBlocks.length === 0) return;
        const pulse = 0.5 + Math.sin(this.visualPulse * Math.PI * 8) * 0.5;
        const pullEnd = Math.max(0.1, this.attackDuration * this.getHarvestPullFraction());
        const holdStart = pullEnd;
        const holdEnd = holdStart + 0.45;
        const holding = this.state === VORTEX_STATES.ACTIVE && this.attackTimer >= holdStart && this.attackTimer < holdEnd;
        const showTelegraph = telegraphOnly || this.state === VORTEX_STATES.TELEGRAPH;

        ctx.save();
        ctx.lineCap = 'round';
        this.ghostBlocks.forEach(block => {
            const drawX = showTelegraph ? block.originX : block.x;
            const drawY = showTelegraph ? block.originY : block.y;
            const alpha = showTelegraph ? 0.78 : Math.max(0.1, block.alpha);
            this.renderHarvestSceneryBlock(ctx, block, drawX, drawY, alpha, pulse);

            if (showTelegraph) {
                this.renderHarvestTelegraphMarker(ctx, block, drawX, drawY, pulse);
            }
        });

        if (holding) {
            ctx.globalAlpha = 0.55 + pulse * 0.3;
            ctx.strokeStyle = '#ff3b6b';
            ctx.lineWidth = 4 + pulse * 3;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size * 1.15 + pulse * 14, 0, Math.PI * 2);
            ctx.stroke();
        }

        if (!showTelegraph && this.state === VORTEX_STATES.ACTIVE) {
            ctx.globalCompositeOperation = 'screen';
            for (let i = 0; i < 3; i++) {
                const radius = this.size * (1.15 + i * 0.34) - pulse * 18;
                ctx.globalAlpha = 0.18 + pulse * 0.08;
                ctx.strokeStyle = i === 0 ? '#ffffff' : '#ff6a9f';
                ctx.lineWidth = 2 + i;
                ctx.beginPath();
                ctx.arc(this.x, this.y, Math.max(this.size * 0.72, radius), this.rotationAngle + i, this.rotationAngle + i + Math.PI * 1.35);
                ctx.stroke();
            }
        }

        ctx.restore();
    }

    renderFinaleLockCeremony(ctx, pulse) {
        const base = this.getFinaleCorridorAngle();
        const radius = 560;
        ctx.save();
        ctx.globalCompositeOperation = 'screen';

        for (let i = 0; i < 4; i++) {
            const center = base + i * Math.PI / 2;
            ctx.strokeStyle = '#9ffcff';
            ctx.globalAlpha = 0.24 + pulse * 0.2;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(this.x + Math.cos(center) * 58, this.y + Math.sin(center) * 58);
            ctx.lineTo(this.x + Math.cos(center) * radius, this.y + Math.sin(center) * radius);
            ctx.stroke();

            for (let crack = -1; crack <= 1; crack += 2) {
                const crackAngle = center + crack * (this.finaleCorridorWidth * (0.75 + pulse * 0.2));
                ctx.strokeStyle = '#ffffff';
                ctx.globalAlpha = 0.13 + pulse * 0.1;
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(this.x + Math.cos(crackAngle) * 90, this.y + Math.sin(crackAngle) * 90);
                ctx.lineTo(this.x + Math.cos(crackAngle) * (radius * 0.72), this.y + Math.sin(crackAngle) * (radius * 0.72));
                ctx.stroke();
            }
        }

        const particles = this.spectacle ? this.spectacle.corridorParticles : null;
        if (Array.isArray(particles)) {
            particles.forEach(particle => {
                const x = this.x + Math.cos(particle.angle) * particle.distance;
                const y = this.y + Math.sin(particle.angle) * particle.distance;
                ctx.globalAlpha = (particle.alpha || 0) * 0.78;
                ctx.fillStyle = particle.color || '#ffffff';
                ctx.beginPath();
                ctx.arc(x, y, 3, 0, Math.PI * 2);
                ctx.fill();
            });
        }

        ctx.restore();
    }

    renderHarvestSceneryBlock(ctx, block, x, y, alpha = 1, pulse = 0) {
        if (block && block.sprite) {
            this.drawHarvestBlockSprite(ctx, block, x, y, alpha);
            return;
        }

        const room = typeof currentRoom !== 'undefined' ? currentRoom : null;
        const layout = room && room.layout ? room.layout : null;
        const cellSize = (layout && layout.cellSize) || Math.max(1, block.height || 60);
        const colors = this.getHarvestSceneryColors();
        const cells = Array.isArray(block.cells) && block.cells.length > 0
            ? block.cells
            : [{ row: block.row || 0, col: block.startCol || 0 }];

        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = alpha;
        ctx.shadowColor = `rgba(${colors.r}, ${colors.g}, ${colors.b}, ${0.52 + pulse * 0.18})`;
        ctx.shadowBlur = 10 + pulse * 6;
        cells.forEach(cell => {
            const relX = (cell.col - block.startCol + 0.5) * cellSize - block.width / 2;
            const relY = (cell.row - block.row + 0.5) * cellSize - block.height / 2;
            this.drawHarvestSceneryCell(ctx, x + relX, y + relY, cell.col, cell.row, cellSize, layout, colors);
        });
        ctx.restore();
    }

    renderHarvestTelegraphMarker(ctx, block, x, y, pulse = 0) {
        const width = Math.max(24, block.width + 10);
        const height = Math.max(24, block.height + 10);
        const corner = Math.min(18, width * 0.25, height * 0.25);
        const threat = Math.max(0, Math.min(1, (block.threatScore || 0) / 760));
        const left = x - width / 2;
        const right = x + width / 2;
        const top = y - height / 2;
        const bottom = y + height / 2;

        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 0.72 + pulse * 0.18 + threat * 0.1;
        ctx.strokeStyle = threat > 0.45 ? '#ffffff' : '#ff3b6b';
        ctx.lineWidth = 3 + threat * 2;

        ctx.beginPath();
        ctx.moveTo(left, top + corner);
        ctx.lineTo(left, top);
        ctx.lineTo(left + corner, top);
        ctx.moveTo(right - corner, top);
        ctx.lineTo(right, top);
        ctx.lineTo(right, top + corner);
        ctx.moveTo(right, bottom - corner);
        ctx.lineTo(right, bottom);
        ctx.lineTo(right - corner, bottom);
        ctx.moveTo(left + corner, bottom);
        ctx.lineTo(left, bottom);
        ctx.lineTo(left, bottom - corner);
        ctx.stroke();

        ctx.globalAlpha = 0.22 + pulse * 0.12 + threat * 0.1;
        ctx.fillStyle = '#ff3b6b';
        ctx.fillRect(left, top, width, height);
        ctx.restore();
    }

    createHarvestBlockSprite(block, layout, colors) {
        if (typeof document === 'undefined' || !block) return null;
        const padding = block.spritePadding || 18;
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.ceil(block.width + padding * 2));
        canvas.height = Math.max(1, Math.ceil(block.height + padding * 2));
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        const cellSize = (layout && layout.cellSize) || Math.max(1, block.height || 60);
        const cells = Array.isArray(block.cells) && block.cells.length > 0
            ? block.cells
            : [{ row: block.row || 0, col: block.startCol || 0 }];

        ctx.save();
        ctx.translate(padding + block.width / 2, padding + block.height / 2);
        ctx.shadowColor = `rgba(${colors.r}, ${colors.g}, ${colors.b}, 0.58)`;
        ctx.shadowBlur = 10;
        cells.forEach(cell => {
            const relX = (cell.col - block.startCol + 0.5) * cellSize - block.width / 2;
            const relY = (cell.row - block.row + 0.5) * cellSize - block.height / 2;
            this.drawHarvestSceneryCell(ctx, relX, relY, cell.col, cell.row, cellSize, layout, colors);
        });
        ctx.restore();
        return canvas;
    }

    drawHarvestBlockSprite(ctx, block, x, y, alpha = 1) {
        if (!block || !block.sprite) return;
        const padding = block.spritePadding || 18;
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = alpha;
        ctx.drawImage(
            block.sprite,
            x - block.width / 2 - padding,
            y - block.height / 2 - padding
        );
        ctx.restore();
    }

    drawHarvestSceneryCell(ctx, centerX, centerY, col, row, cellSize, layout, colors) {
        const radius = cellSize * 0.48;
        const biomeId = layout && layout.biomeId ? layout.biomeId : 'vortex';
        ctx.fillStyle = `rgba(${Math.floor(colors.r * 0.26)}, ${Math.floor(colors.g * 0.28)}, ${Math.floor(colors.b * 0.32)}, 0.68)`;
        ctx.strokeStyle = `rgba(${colors.r}, ${colors.g}, ${colors.b}, 0.82)`;
        ctx.lineWidth = 2;

        if (biomeId === 'vortex') {
            const rotation = (col + row) * 0.34;
            ctx.beginPath();
            ctx.ellipse(centerX, centerY, radius, radius * 0.64, rotation, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            ctx.save();
            ctx.globalAlpha *= 0.35;
            ctx.beginPath();
            ctx.ellipse(centerX, centerY, radius * 0.58, radius * 0.28, rotation + Math.PI / 4, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
            return;
        }

        if (biomeId === 'prism' || biomeId === 'fractal') {
            const sides = biomeId === 'prism' ? 4 : 4;
            const rotation = biomeId === 'prism' ? Math.PI / 4 : Math.PI / 4 + ((col + row) % 3) * 0.18;
            ctx.beginPath();
            for (let i = 0; i < sides; i++) {
                const angle = rotation + (Math.PI * 2 * i) / sides;
                const px = centerX + Math.cos(angle) * radius * (biomeId === 'prism' ? 0.9 : 1);
                const py = centerY + Math.sin(angle) * radius;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            return;
        }

        if (biomeId === 'endless') {
            const sides = (col + row) % 3 === 0 ? 5 : 4;
            ctx.beginPath();
            for (let i = 0; i < sides; i++) {
                const angle = -Math.PI / 2 + (col % 2) * 0.22 + (Math.PI * 2 * i) / sides;
                const px = centerX + Math.cos(angle) * radius;
                const py = centerY + Math.sin(angle) * radius * (sides === 5 ? 0.82 : 1);
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            return;
        }

        ctx.fillRect(centerX - cellSize / 2, centerY - cellSize / 2, cellSize, cellSize);
        ctx.strokeRect(centerX - cellSize / 2 + 1, centerY - cellSize / 2 + 1, cellSize - 2, cellSize - 2);
    }

    strokeHarvestBlockEnvelope(ctx, block, x, y, pulse = 0) {
        const radiusX = Math.max(18, block.width * 0.5);
        const radiusY = Math.max(18, block.height * 0.5);
        ctx.beginPath();
        ctx.ellipse(x, y, radiusX + pulse * 5, radiusY * 0.72 + pulse * 3, this.rotationAngle * 0.35, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#ffffff';
        ctx.globalAlpha *= 0.65;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(x, y, Math.max(8, radiusX - 8), Math.max(8, radiusY * 0.5), this.rotationAngle * 0.35 + Math.PI / 4, 0, Math.PI * 2);
        ctx.stroke();
    }

    getHarvestSceneryColors() {
        const biome = typeof getBiomeForRoom === 'function' && typeof Game !== 'undefined'
            ? getBiomeForRoom(Game.roomNumber)
            : { accentColor: '#8c7bff' };
        const hex = (biome.accentColor || '#8c7bff').replace('#', '');
        return {
            r: parseInt(hex.substring(0, 2), 16) || 140,
            g: parseInt(hex.substring(2, 4), 16) || 123,
            b: parseInt(hex.substring(4, 6), 16) || 255
        };
    }

    renderMassShadows(ctx) {
        if (this.massShadowProgress <= 0) return;
        const collapseRadius = 300 * (1 - this.massShadowProgress);
        if (collapseRadius <= 3) return;
        ctx.save();
        ctx.globalCompositeOperation = 'multiply';
        for (let i = 0; i < 4; i++) {
            const noiseAngle = this.visualPulse * (1.3 + i * 0.2) + i * Math.PI * 0.5;
            const offset = 8 + i * 5;
            ctx.globalAlpha = 0.13 + i * 0.035;
            ctx.fillStyle = '#000000';
            ctx.beginPath();
            ctx.arc(
                this.x + Math.cos(noiseAngle) * offset,
                this.y + Math.sin(noiseAngle) * offset,
                collapseRadius * (1 - i * 0.14),
                0,
                Math.PI * 2
            );
            ctx.fill();
        }
        ctx.restore();
    }

    renderLensEffect(ctx, mode) {
        const assets = this.getLensAssets();
        if (!assets) return;

        const progressBase = this.telegraphActive
            ? Math.min(1, this.attackTimer / Math.max(0.1, this.telegraphDuration))
            : Math.min(1, this.attackTimer / Math.max(0.1, this.attackDuration));

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.globalCompositeOperation = 'screen';
        assets.forEach((canvas, index) => {
            const loop = (progressBase + index * 0.22) % 1;
            const scale = mode === 'inhale'
                ? 1.45 - loop * 1.05
                : 0.35 + loop * 1.35;
            const alpha = mode === 'inhale'
                ? 0.42 * (1 - loop)
                : 0.36 * (1 - Math.abs(loop - 0.55));
            const size = canvas.width * scale;
            ctx.globalAlpha = Math.max(0, alpha);
            ctx.drawImage(canvas, -size / 2, -size / 2, size, size);
        });
        ctx.restore();
    }

    getLensAssets() {
        if (this.lensAssets) return this.lensAssets;
        if (typeof document === 'undefined') return null;

        this.lensAssets = [];
        for (let layer = 0; layer < 4; layer++) {
            const size = 180 + layer * 34;
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const lctx = canvas.getContext('2d');
            const center = size / 2;
            lctx.globalCompositeOperation = 'screen';
            for (let ring = 0; ring < 4; ring++) {
                const radius = center * (0.28 + ring * 0.16);
                lctx.strokeStyle = ring % 2 === 0 ? '#ffffff' : '#5ffcff';
                lctx.globalAlpha = 0.35 + ring * 0.12;
                lctx.lineWidth = 1 + layer * 0.35;
                lctx.beginPath();
                lctx.arc(center, center, radius, 0, Math.PI * 2);
                lctx.stroke();
            }
            this.lensAssets.push(canvas);
        }
        return this.lensAssets;
    }

    renderInwardFlow(ctx, pulse) {
        const progress = this.telegraphActive ? Math.min(1, this.attackTimer / Math.max(0.1, this.telegraphDuration)) : (this.attackTimer % 1);
        ctx.strokeStyle = '#5ffcff';
        ctx.lineWidth = 2 + pulse * 2;
        ctx.globalAlpha = 0.18 + pulse * 0.18;
        for (let i = 0; i < 4; i++) {
            const radius = 120 + i * 75 - progress * 70;
            ctx.beginPath();
            ctx.arc(this.x, this.y, Math.max(20, radius), this.rotationAngle + i, this.rotationAngle + i + Math.PI * 1.65);
            ctx.stroke();
        }
        this.renderForceOnlyBoundary(ctx, 420, -1, pulse);
        this.renderDirectionalArrows(ctx, -1, 360);
    }

    renderOutwardFlow(ctx, pulse) {
        const progress = Math.min(1, this.attackTimer / Math.max(0.1, this.telegraphDuration || this.attackDuration));
        const radius = 70 + progress * 280;
        ctx.strokeStyle = '#8ffcff';
        ctx.lineWidth = 3 + progress * 5;
        ctx.globalAlpha = Math.max(0.12, 0.5 - progress * 0.28);
        ctx.beginPath();
        ctx.arc(this.x, this.y, radius, 0, Math.PI * 2);
        ctx.stroke();
        this.renderForceOnlyBoundary(ctx, 360, 1, pulse);
        this.renderDirectionalArrows(ctx, 1, 340);
    }

    renderForceOnlyBoundary(ctx, radius, direction, pulse) {
        ctx.save();
        ctx.strokeStyle = direction < 0 ? '#5ffcff' : '#9ffcff';
        ctx.fillStyle = ctx.strokeStyle;
        ctx.globalAlpha = 0.42 + pulse * 0.16;
        ctx.lineWidth = 2.5;
        ctx.setLineDash([18, 12]);
        ctx.beginPath();
        ctx.arc(this.x, this.y, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        for (let i = 0; i < 10; i++) {
            const angle = this.rotationAngle * 0.22 + (Math.PI * 2 / 10) * i;
            const arrowRadius = radius - 28;
            const x = this.x + Math.cos(angle) * arrowRadius;
            const y = this.y + Math.sin(angle) * arrowRadius;
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(angle + (direction < 0 ? Math.PI : 0));
            ctx.globalAlpha = 0.55 + pulse * 0.2;
            ctx.beginPath();
            ctx.moveTo(12, 0);
            ctx.lineTo(-8, -6);
            ctx.lineTo(-4, 0);
            ctx.lineTo(-8, 6);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }
        ctx.restore();
    }

    renderDirectionalArrows(ctx, direction, radius) {
        ctx.save();
        ctx.strokeStyle = direction < 0 ? '#9ffcff' : '#ffffff';
        ctx.fillStyle = ctx.strokeStyle;
        ctx.globalAlpha = 0.42;
        for (let i = 0; i < 12; i++) {
            const angle = this.rotationAngle * 0.3 + (Math.PI * 2 / 12) * i;
            const x = this.x + Math.cos(angle) * radius;
            const y = this.y + Math.sin(angle) * radius;
            const arrowAngle = angle + (direction < 0 ? Math.PI : 0);
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(arrowAngle);
            ctx.beginPath();
            ctx.moveTo(14, 0);
            ctx.lineTo(-10, -7);
            ctx.lineTo(-5, 0);
            ctx.lineTo(-10, 7);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }
        ctx.restore();
    }

    renderCosmicAccretion(ctx) {
        let alpha = 0.24;
        const busyDamageWindow = this.state === VORTEX_STATES.ACTIVE && (
            this.activeAttack === VORTEX_ATTACKS.BLADES ||
            this.activeAttack === VORTEX_ATTACKS.SPIRAL ||
            this.activeAttack === VORTEX_ATTACKS.LANCE ||
            this.activeAttack === VORTEX_ATTACKS.NEEDLES ||
            this.activeAttack === VORTEX_ATTACKS.PULSAR ||
            this.activeAttack === VORTEX_ATTACKS.CAGE ||
            this.activeAttack === VORTEX_ATTACKS.NET ||
            this.activeAttack === VORTEX_ATTACKS.SCENERY ||
            (this.activeAttack === VORTEX_ATTACKS.FINALE && (
                this.finaleState === VORTEX_FINALE_STATES.BLADES ||
                this.finaleState === VORTEX_FINALE_STATES.VOLLEY
            ))
        );
        if (busyDamageWindow) alpha = 0;
        if (this.telegraphType === 'eventHorizon' || this.activeAttack === VORTEX_ATTACKS.FINALE) alpha = Math.max(alpha, busyDamageWindow ? 0 : 0.34);
        if (this.currentComboName === 'gravityStorm') alpha = Math.max(alpha, busyDamageWindow ? 0 : 0.32);
        if (this.panicMode) alpha = Math.max(alpha, busyDamageWindow ? 0 : 0.38);
        if (this.activeAttack === VORTEX_ATTACKS.INHALE || this.activeAttack === VORTEX_ATTACKS.BURST || this.activeAttack === 'inhaleFlip') {
            alpha = Math.min(alpha, 0.16);
        }
        if (alpha <= 0) return;

        const assets = this.getDustAssets();
        if (!assets) return;

        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = alpha;
        const size = assets.size;
        const warpX = this.panicMode ? Math.sin(this.visualPulse * 8) * 4 : 0;
        const warpY = this.panicMode ? Math.cos(this.visualPulse * 6) * 4 : 0;
        ctx.translate(this.x + warpX, this.y + warpY);

        ctx.save();
        ctx.rotate(this.dustRotation);
        ctx.drawImage(assets.layers[0], -size / 2, -size / 2, size, size);
        ctx.restore();

        ctx.globalAlpha = alpha * 0.65;
        ctx.save();
        ctx.rotate(this.dustCounterRotation);
        ctx.drawImage(assets.layers[1], -size / 2, -size / 2, size, size);
        ctx.restore();

        if (assets.layers[2]) {
            ctx.globalAlpha = alpha * (this.panicMode ? 0.95 : 0.72);
            ctx.save();
            ctx.rotate(this.dustRotation * -1.35);
            ctx.scale(1.08, 1.08);
            ctx.drawImage(assets.layers[2], -size / 2, -size / 2, size, size);
            ctx.restore();
        }

        this.renderPhotonRings(ctx, alpha);

        ctx.restore();
    }

    renderPhotonRings(ctx, alpha) {
        const pulse = 0.5 + Math.sin(this.visualPulse * Math.PI * 5) * 0.5;
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        for (let i = 0; i < 3; i++) {
            const radius = this.size * (0.72 + i * 0.34) + pulse * 8;
            ctx.strokeStyle = i === 0 ? '#ffffff' : i === 1 ? '#7ffcff' : '#7f7bff';
            ctx.lineWidth = i === 0 ? 3 : 2;
            ctx.globalAlpha = alpha * (0.45 - i * 0.08);
            ctx.beginPath();
            ctx.ellipse(0, 0, radius * 1.35, radius * 0.58, this.rotationAngle * 0.45 + i * 0.55, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.restore();
    }

    getDustAssets() {
        if (this.dustAssets) return this.dustAssets;
        if (typeof document === 'undefined') return null;

        const size = 512;
        const layers = [];
        for (let layer = 0; layer < 3; layer++) {
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const dctx = canvas.getContext('2d');
            dctx.translate(size / 2, size / 2);

            if (layer < 2) {
                // Dense seeded motes ride on top of the broader spiral arms.
                for (let i = 0; i < 1200; i++) {
                    const seed = Math.sin((i + 1) * (layer + 3) * 12.9898) * 43758.5453;
                    const rand = seed - Math.floor(seed);
                    const theta = i * 0.052 + rand * 0.5;
                    const radius = 14 * Math.exp(0.016 * theta) + rand * 28;
                    if (radius > size * 0.47) continue;
                    const arm = layer === 0 ? 1 : -1;
                    const x = Math.cos(theta * arm) * radius;
                    const y = Math.sin(theta * arm) * radius * 0.64;
                    dctx.globalAlpha = 0.07 + rand * 0.24;
                    dctx.fillStyle = rand > 0.74 ? '#ffffff' : layer === 0 ? '#66ffff' : '#8c7bff';
                    dctx.fillRect(x, y, 1 + rand * 2.1, 1 + rand * 2.1);
                }
            } else {
                // Broad luminous spiral arms make the disk read as an accretion disk instead of random particles.
                dctx.globalCompositeOperation = 'screen';
                for (let arm = 0; arm < 4; arm++) {
                    const armOffset = arm * Math.PI * 0.5;
                    for (let strand = 0; strand < 4; strand++) {
                        dctx.beginPath();
                        for (let i = 0; i < 150; i++) {
                            const t = i / 149;
                            const theta = armOffset + t * Math.PI * 2.35 + strand * 0.055;
                            const radius = 28 + t * 205;
                            const widthWarp = 1 + Math.sin(t * Math.PI) * 0.18;
                            const x = Math.cos(theta) * radius * widthWarp;
                            const y = Math.sin(theta) * radius * 0.52;
                            if (i === 0) dctx.moveTo(x, y);
                            else dctx.lineTo(x, y);
                        }
                        dctx.strokeStyle = strand % 2 === 0 ? '#6fffff' : '#7b6cff';
                        dctx.globalAlpha = 0.16 - strand * 0.022;
                        dctx.lineWidth = 10 - strand * 1.8;
                        dctx.lineCap = 'round';
                        dctx.stroke();
                    }
                }
            }
            layers.push(canvas);
        }
        this.dustAssets = { size, layers };
        return this.dustAssets;
    }

    renderGravityWells(ctx) {
        this.gravityWells.forEach(well => {
            ctx.save();
            ctx.globalCompositeOperation = 'screen';
            ctx.globalAlpha = Math.max(0, well.alpha);
            const pulse = 0.5 + Math.sin(this.visualPulse * Math.PI * 5 + well.x * 0.01) * 0.5;
            const warning = well.collapseWarning || 0;
            ctx.strokeStyle = well.collapsed ? '#ff8cff' : warning > 0 ? '#ffffff' : well.active ? '#6a5cff' : '#5ffcff';
            ctx.lineWidth = 2 + pulse * 2;
            ctx.beginPath();
            ctx.arc(well.x, well.y, well.radius * (0.45 + well.armProgress * 0.55), 0, Math.PI * 2);
            ctx.stroke();

            if (well.active && !well.collapsed) {
                if (warning > 0) {
                    ctx.globalAlpha = well.alpha * warning * 0.42;
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 1.5 + warning * 2;
                    ctx.setLineDash([10, 8]);
                    ctx.beginPath();
                    ctx.moveTo(this.x, this.y);
                    ctx.lineTo(well.x, well.y);
                    ctx.stroke();
                    ctx.setLineDash([]);
                }

                ctx.globalAlpha = Math.max(0.35, well.alpha) * (0.45 + warning * 0.45);
                ctx.strokeStyle = warning > 0 ? '#ffffff' : '#b8a7ff';
                ctx.lineWidth = 3 + warning * 4;
                ctx.beginPath();
                ctx.arc(well.x, well.y, well.innerRadius || 44, 0, Math.PI * 2);
                ctx.stroke();

                if (warning > 0) {
                    ctx.globalAlpha = well.alpha * warning * 0.28;
                    ctx.fillStyle = '#ffffff';
                    ctx.beginPath();
                    ctx.arc(well.x, well.y, (well.innerRadius || 44) * (0.8 + pulse * 0.25), 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            ctx.globalAlpha *= 0.28;
            ctx.fillStyle = '#20104f';
            ctx.beginPath();
            ctx.arc(well.x, well.y, well.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });
    }

    renderGameplayVectors(ctx) {
        if (this.telegraphActive) {
            this.renderTelegraph(ctx);
        }

        if (this.state === VORTEX_STATES.ACTIVE && this.activeAttack === VORTEX_ATTACKS.INHALE) {
            this.renderActiveGravityDamageHints(ctx, 'inhale');
        }

        if (this.state === VORTEX_STATES.ACTIVE && (this.activeAttack === VORTEX_ATTACKS.BURST || this.activeAttack === 'inhaleFlip')) {
            this.renderActiveGravityDamageHints(ctx, 'burst');
        }

        if (this.activeAttack === VORTEX_ATTACKS.BLADES || this.finaleState === VORTEX_FINALE_STATES.BLADES) {
            this.renderOrbitBlades(ctx);
        }

        if (this.activeAttack === VORTEX_ATTACKS.SPIRAL || this.finaleState === VORTEX_FINALE_STATES.VOLLEY) {
            this.renderSpiralRails(ctx);
        }

        this.renderComboBanner(ctx);
    }

    renderComboBanner(ctx) {
        const banner = this.spectacle ? this.spectacle.comboBanner : null;
        if (!banner || !banner.canvas) return;
        const progress = Math.min(1, banner.elapsed / Math.max(0.01, banner.duration));
        const fadeIn = Math.min(1, progress / 0.18);
        const fadeOut = Math.min(1, (1 - progress) / 0.28);
        const alpha = Math.min(fadeIn, fadeOut);
        if (alpha <= 0) return;

        const scale = 0.72 + Math.sin(progress * Math.PI) * 0.08;
        const width = banner.canvas.width * scale;
        const height = banner.canvas.height * scale;
        const x = this.x - width / 2;
        const y = this.y - this.size * 2.15 - Math.sin(progress * Math.PI) * 16;

        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = alpha * 0.9;
        ctx.drawImage(banner.canvas, x, y, width, height);
        ctx.restore();
    }

    renderDeathSequence(ctx) {
        const sequence = this.spectacle ? this.spectacle.deathSequence : null;
        if (!sequence) return;
        const progress = Math.min(1, sequence.elapsed / Math.max(0.01, sequence.duration));
        const pulseRate = 4 + progress * 18;
        const pulse = 0.5 + Math.sin(this.visualPulse * Math.PI * pulseRate) * 0.5;
        const roomWidth = (typeof currentRoom !== 'undefined' && currentRoom) ? currentRoom.width : 2400;
        const roomHeight = (typeof currentRoom !== 'undefined' && currentRoom) ? currentRoom.height : 1350;
        const safeVisible = sequence.elapsed >= 1.0;

        ctx.save();
        ctx.globalCompositeOperation = progress > 0.94 ? 'screen' : 'multiply';
        ctx.globalAlpha = progress > 0.94 ? 0.48 : 0.18 + progress * 0.36;
        ctx.fillStyle = progress > 0.94 ? '#ffffff' : '#030008';
        ctx.fillRect(0, 0, roomWidth, roomHeight);

        ctx.globalCompositeOperation = 'screen';
        const particles = this.spectacle && Array.isArray(this.spectacle.deathParticles) ? this.spectacle.deathParticles : [];
        particles.forEach(particle => {
            const startDistance = particle.distance;
            const endDistance = Math.max(this.size * 0.62, startDistance - 90 - progress * 80);
            const sx = this.x + Math.cos(particle.angle) * startDistance;
            const sy = this.y + Math.sin(particle.angle) * startDistance;
            const ex = this.x + Math.cos(particle.angle) * endDistance;
            const ey = this.y + Math.sin(particle.angle) * endDistance;
            ctx.globalAlpha = (particle.alpha || 0) * (0.32 + progress * 0.42);
            ctx.strokeStyle = progress > 0.82 ? '#ffffff' : '#b8a7ff';
            ctx.lineWidth = 2 + progress * 2;
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(ex, ey);
            ctx.stroke();
        });

        for (let i = 0; i < 4; i++) {
            const t = (progress + i * 0.18) % 1;
            const radius = this.size * (5.2 - t * 4.45) + pulse * 8;
            ctx.globalAlpha = (1 - t) * (0.34 + progress * 0.3);
            ctx.strokeStyle = i % 2 === 0 ? '#ff3b6b' : '#ffffff';
            ctx.lineWidth = 5 - i * 0.55 + progress * 3;
            ctx.beginPath();
            ctx.arc(this.x, this.y, Math.max(this.size * 0.62, radius), 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 0.8 + progress * 0.2;
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * (0.85 + progress * 0.75 + pulse * 0.08), 0, Math.PI * 2);
        ctx.fill();

        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = 0.55 + pulse * 0.35;
        ctx.strokeStyle = progress > 0.82 ? '#ffffff' : '#ff3b6b';
        ctx.lineWidth = 5 + progress * 5;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * (1.05 + progress * 0.3), 0, Math.PI * 2);
        ctx.stroke();

        if (safeVisible) {
            const safeProgress = Math.min(1, (sequence.elapsed - 1.0) / 1.0);
            ctx.globalAlpha = 0.08 + safeProgress * 0.18 + pulse * 0.06;
            ctx.fillStyle = '#5ffcff';
            ctx.beginPath();
            ctx.arc(this.x, this.y, sequence.safeRadius, 0, Math.PI * 2);
            ctx.fill();

            ctx.globalAlpha = 0.55 + pulse * 0.24;
            ctx.strokeStyle = '#9ffcff';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(this.x, this.y, sequence.safeRadius, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.restore();
    }

    renderActiveGravityDamageHints(ctx, mode) {
        const pulse = 0.5 + Math.sin(this.visualPulse * Math.PI * 8) * 0.5;
        ctx.save();
        ctx.globalCompositeOperation = 'screen';

        if (mode === 'burst') {
            const progress = Math.min(1, this.attackTimer / Math.max(0.1, this.attackDuration));
            const radius = 70 + progress * 280;
            ctx.strokeStyle = '#ff3b6b';
            ctx.globalAlpha = Math.max(0.18, 0.72 - progress * 0.48);
            ctx.lineWidth = 4 + pulse * 2;
            ctx.beginPath();
            ctx.arc(this.x, this.y, radius, 0, Math.PI * 2);
            ctx.stroke();
        }

        this.renderRadialBulletPreview(ctx, {
            count: mode === 'inhale' ? (this.phase === 1 ? 12 : 16) : (this.phase === 1 ? 14 : 18),
            gapAngle: mode === 'inhale' ? this.lastTargetAngle : this.lastTargetAngle + Math.PI,
            gapWidth: mode === 'inhale' ? Math.PI / (this.phase === 1 ? 3.2 : 4.1) : Math.PI / 3.4,
            radius: mode === 'inhale' ? 245 : 285,
            color: '#ff6a9f',
            hazard: true
        });

        ctx.restore();
    }

    renderTelegraph(ctx) {
        const pulse = 0.55 + Math.sin(this.visualPulse * Math.PI * 6) * 0.45;
        ctx.save();
        ctx.globalCompositeOperation = 'screen';

        if (this.telegraphType === 'blades') {
            this.renderOrbitBlades(ctx, true);
            this.renderRadialBulletPreview(ctx, {
                count: this.phase === 3 ? 8 : 6,
                gapAngle: this.lastTargetAngle,
                gapWidth: Math.PI / 3.2,
                radius: this.size * 1.5,
                color: '#ff6a9f',
                hazard: true
            });
        } else if (this.telegraphType === 'spiralGates') {
            this.renderSpiralRails(ctx, true);
        } else if (this.telegraphType === 'gravityLance') {
            this.renderGravityLancePreview(ctx);
        } else if (this.telegraphType === 'needleCurtain') {
            this.renderNeedleCurtainPreview(ctx);
        } else if (this.telegraphType === 'sweepingPulsar') {
            this.renderBeamFanTelegraph(ctx, 2, true);
        } else if (this.telegraphType === 'orbitalCage') {
            this.renderBeamFanTelegraph(ctx, this.phase === 3 ? 8 : 6, false);
        } else if (this.telegraphType === 'crossingNet') {
            this.renderCrossingNetPreview(ctx);
        } else if (this.telegraphType === 'inhale') {
            this.renderRadialBulletPreview(ctx, {
                count: this.phase === 1 ? 12 : 16,
                gapAngle: this.lastTargetAngle,
                gapWidth: Math.PI / (this.phase === 1 ? 3.2 : 4.1),
                radius: 245,
                color: '#ff6a9f',
                hazard: true
            });
        } else if (this.telegraphType === 'burst' || this.telegraphType === 'burstFlip') {
            this.renderShockwaveDamagePreview(ctx, this.telegraphType === 'burstFlip' ? 350 : 330, pulse);
            this.renderRadialBulletPreview(ctx, {
                count: this.phase === 1 ? 14 : 18,
                gapAngle: this.lastTargetAngle + Math.PI,
                gapWidth: Math.PI / 3.4,
                radius: 285,
                color: '#ff6a9f',
                hazard: true
            });
        } else if (this.telegraphType === 'blink') {
            this.renderMovementDestination(ctx, '#5ffcff');
        } else if (this.telegraphType === 'dash') {
            this.renderDashTrajectory(ctx);
        } else if (this.telegraphType === 'wells') {
            ctx.strokeStyle = '#8c7bff';
            ctx.lineWidth = 3;
            ctx.globalAlpha = 0.55 + pulse * 0.25;
            this.gravityWells.forEach(well => {
                ctx.beginPath();
                ctx.arc(well.x, well.y, well.radius, 0, Math.PI * 2);
                ctx.stroke();
            });
        } else if (this.telegraphType === 'eventHorizon') {
            this.renderSafeCorridors(ctx, pulse);
        }

        ctx.restore();
    }

    renderShockwaveDamagePreview(ctx, radius, pulse) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.strokeStyle = '#ff3b6b';
        ctx.fillStyle = '#ff3b6b';
        ctx.globalAlpha = 0.16 + pulse * 0.12;
        ctx.beginPath();
        ctx.arc(this.x, this.y, radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = 0.72 + pulse * 0.22;
        ctx.lineWidth = 5 + pulse * 3;
        ctx.setLineDash([20, 10]);
        ctx.beginPath();
        ctx.arc(this.x, this.y, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.strokeStyle = '#ffffff';
        ctx.globalAlpha = 0.7 + pulse * 0.2;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.x, this.y, radius - 12, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    renderGravityLancePreview(ctx) {
        const pulse = 0.5 + Math.sin(this.visualPulse * Math.PI * 8) * 0.5;
        const angle = this.lanceTargetAngle || this.lastTargetAngle;
        const cone = Math.PI / 4;
        const radius = 470;
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.fillStyle = '#ff3b6b';
        ctx.globalAlpha = 0.12 + pulse * 0.1;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.arc(this.x, this.y, radius, angle - cone * 0.5, angle + cone * 0.5);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = '#ff6a9f';
        ctx.lineCap = 'round';
        const lanes = this.phase === 3 ? 11 : 9;
        for (let i = 0; i < lanes; i++) {
            const t = lanes === 1 ? 0.5 : i / (lanes - 1);
            const laneAngle = angle - cone * 0.5 + cone * t;
            ctx.globalAlpha = 0.58 + pulse * 0.25;
            ctx.lineWidth = 2.5 + pulse;
            ctx.beginPath();
            ctx.moveTo(this.x + Math.cos(laneAngle) * this.getProjectileSpawnRadius(), this.y + Math.sin(laneAngle) * this.getProjectileSpawnRadius());
            ctx.lineTo(this.x + Math.cos(laneAngle) * radius, this.y + Math.sin(laneAngle) * radius);
            ctx.stroke();

            ctx.strokeStyle = '#ffffff';
            ctx.globalAlpha = 0.48 + pulse * 0.22;
            ctx.lineWidth = 1.25;
            ctx.beginPath();
            ctx.moveTo(this.x + Math.cos(laneAngle) * (this.getProjectileSpawnRadius() + 8), this.y + Math.sin(laneAngle) * (this.getProjectileSpawnRadius() + 8));
            ctx.lineTo(this.x + Math.cos(laneAngle) * (radius - 20), this.y + Math.sin(laneAngle) * (radius - 20));
            ctx.stroke();
            ctx.strokeStyle = '#ff6a9f';
        }
        ctx.restore();
    }

    renderNeedleCurtainPreview(ctx) {
        const pulse = 0.5 + Math.sin(this.visualPulse * Math.PI * 8) * 0.5;
        const petalCount = this.phase === 3 ? 8 : 6;
        const originRadius = this.getProjectileSpawnRadius();
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.strokeStyle = '#ff6a9f';
        ctx.lineCap = 'round';
        for (let i = 0; i < petalCount; i++) {
            const angle = this.rotationAngle * 0.45 + (Math.PI * 2 / petalCount) * i;
            const perp = angle + Math.PI / 2;
            ctx.globalAlpha = 0.52 + pulse * 0.24;
            ctx.lineWidth = 2.5 + pulse;
            ctx.beginPath();
            for (let step = 0; step < 18; step++) {
                const t = step / 17;
                const travel = originRadius + t * 360;
                const wave = Math.sin(t * Math.PI * 4 + i * 0.8 + this.visualPulse * 4) * 18;
                const x = this.x + Math.cos(angle) * travel + Math.cos(perp) * wave;
                const y = this.y + Math.sin(angle) * travel + Math.sin(perp) * wave;
                if (step === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
        }
        ctx.restore();
    }

    renderBeamFanTelegraph(ctx, beamCount, rotating) {
        const pulse = 0.5 + Math.sin(this.visualPulse * Math.PI * 7) * 0.5;
        const length = Math.min(this.getBeamLength(), 1150);
        const base = this.beamBaseAngle || this.rotationAngle;
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.lineCap = 'round';
        for (let i = 0; i < beamCount; i++) {
            const angle = base + (Math.PI * 2 / beamCount) * i;
            const origin = this.getBeamOrigin(angle);
            ctx.strokeStyle = rotating ? '#ff3b6b' : '#ff6a9f';
            ctx.globalAlpha = 0.22 + pulse * 0.2;
            ctx.lineWidth = rotating ? 18 : 14;
            ctx.beginPath();
            ctx.moveTo(origin.x, origin.y);
            ctx.lineTo(origin.x + Math.cos(angle) * length, origin.y + Math.sin(angle) * length);
            ctx.stroke();

            ctx.strokeStyle = '#ffffff';
            ctx.globalAlpha = 0.5 + pulse * 0.3;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(origin.x, origin.y);
            ctx.lineTo(origin.x + Math.cos(angle) * length, origin.y + Math.sin(angle) * length);
            ctx.stroke();
        }
        if (rotating) {
            this.renderBeamRotationArrow(ctx, base, this.beamDirection, length * 0.32);
        }
        ctx.restore();
    }

    renderBeamRotationArrow(ctx, baseAngle, direction, radius) {
        const start = baseAngle + direction * 0.25;
        const end = baseAngle + direction * 0.95;
        ctx.strokeStyle = '#ffffff';
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 0.65;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.x, this.y, radius, start, end, direction < 0);
        ctx.stroke();
        const headAngle = end;
        const x = this.x + Math.cos(headAngle) * radius;
        const y = this.y + Math.sin(headAngle) * radius;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(headAngle + (direction > 0 ? Math.PI / 2 : -Math.PI / 2));
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(-8, -6);
        ctx.lineTo(-4, 0);
        ctx.lineTo(-8, 6);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    renderCrossingNetPreview(ctx) {
        const pulse = 0.5 + Math.sin(this.visualPulse * Math.PI * 8) * 0.5;
        const streams = this.phase === 3 ? 9 : 8;
        const radius = 420;
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.lineCap = 'round';
        for (let direction = -1; direction <= 1; direction += 2) {
            ctx.strokeStyle = direction > 0 ? '#ff6a9f' : '#ff3b6b';
            ctx.globalAlpha = 0.48 + pulse * 0.22;
            ctx.lineWidth = 2.5 + pulse;
            for (let i = 0; i < streams; i += 2) {
                const angle = this.spiralBaseAngle + direction * (Math.PI * 2 / streams) * i;
                ctx.beginPath();
                ctx.moveTo(this.x + Math.cos(angle) * this.getProjectileSpawnRadius(), this.y + Math.sin(angle) * this.getProjectileSpawnRadius());
                ctx.lineTo(this.x + Math.cos(angle + direction * 0.35) * radius, this.y + Math.sin(angle + direction * 0.35) * radius);
                ctx.stroke();
            }
        }
        ctx.restore();
    }

    renderRadialBulletPreview(ctx, options = {}) {
        const count = options.count || 12;
        const gapAngle = options.gapAngle || 0;
        const gapWidth = options.gapWidth || Math.PI / 4;
        const radius = options.radius || 240;
        const color = options.color || '#ffffff';
        const hazard = options.hazard === true;
        const pulse = 0.5 + Math.sin(this.visualPulse * Math.PI * 8) * 0.5;

        ctx.save();
        ctx.globalCompositeOperation = 'screen';

        ctx.fillStyle = '#5ffcff';
        ctx.globalAlpha = hazard ? 0.14 + pulse * 0.08 : 0.08 + pulse * 0.06;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.arc(this.x, this.y, radius, gapAngle - gapWidth * 0.5, gapAngle + gapWidth * 0.5);
        ctx.closePath();
        ctx.fill();

        if (hazard) {
            ctx.strokeStyle = '#5ffcff';
            ctx.globalAlpha = 0.58 + pulse * 0.22;
            ctx.lineWidth = 3;
            ctx.setLineDash([12, 8]);
            ctx.beginPath();
            ctx.arc(this.x, this.y, radius, gapAngle - gapWidth * 0.5, gapAngle + gapWidth * 0.5);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 / count) * i + this.rotationAngle * 0.15;
            const diff = Math.abs(Math.atan2(Math.sin(angle - gapAngle), Math.cos(angle - gapAngle)));
            if (diff < gapWidth * 0.5) continue;

            ctx.strokeStyle = color;
            ctx.lineWidth = hazard ? 3 + pulse * 1.5 : 2 + pulse;
            ctx.globalAlpha = hazard ? 0.62 + pulse * 0.25 : 0.42 + pulse * 0.28;
            ctx.beginPath();
            ctx.moveTo(this.x + Math.cos(angle) * 52, this.y + Math.sin(angle) * 52);
            ctx.lineTo(this.x + Math.cos(angle) * radius, this.y + Math.sin(angle) * radius);
            ctx.stroke();

            if (hazard) {
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1.5;
                ctx.globalAlpha = 0.55 + pulse * 0.25;
                ctx.beginPath();
                ctx.moveTo(this.x + Math.cos(angle) * 64, this.y + Math.sin(angle) * 64);
                ctx.lineTo(this.x + Math.cos(angle) * (radius - 18), this.y + Math.sin(angle) * (radius - 18));
                ctx.stroke();
            }

            ctx.fillStyle = color;
            ctx.globalAlpha = hazard ? 0.85 + pulse * 0.12 : 0.65 + pulse * 0.25;
            ctx.beginPath();
            ctx.arc(this.x + Math.cos(angle) * 70, this.y + Math.sin(angle) * 70, hazard ? 4 + pulse * 2.5 : 3 + pulse * 2, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }

    renderMovementDestination(ctx, color) {
        if (!this.blinkDestination) return;
        const pulse = 0.5 + Math.sin(this.visualPulse * Math.PI * 8) * 0.5;
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.strokeStyle = color;
        ctx.lineWidth = 3 + pulse * 2;
        ctx.globalAlpha = 0.55 + pulse * 0.25;
        ctx.setLineDash([12, 8]);
        ctx.beginPath();
        ctx.arc(this.blinkDestination.x, this.blinkDestination.y, this.size * 0.75, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 0.18 + pulse * 0.16;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(this.blinkDestination.x, this.blinkDestination.y, this.size * (0.48 + pulse * 0.12), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    renderDashTrajectory(ctx) {
        if (!this.dashTarget || !this.dashTelegraphStart) return;
        const pulse = 0.5 + Math.sin(this.visualPulse * Math.PI * 8) * 0.5;
        ctx.save();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 4;
        ctx.globalAlpha = 0.55 + pulse * 0.25;
        ctx.setLineDash([18, 10]);
        ctx.globalCompositeOperation = 'screen';
        ctx.beginPath();
        ctx.moveTo(this.dashTelegraphStart.x, this.dashTelegraphStart.y);
        ctx.lineTo(this.dashTarget.x, this.dashTarget.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(this.dashTarget.x, this.dashTarget.y, this.size * 0.8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    renderOrbitBlades(ctx, telegraphOnly = false) {
        const bladeCount = this.phase === 3 ? 8 : 6;
        const innerRadius = this.size * 0.45;
        const outerRadius = this.size * 1.7;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.orbitBladeAngle + this.rotationAngle);
        ctx.strokeStyle = telegraphOnly ? '#ff6a6a' : '#ffffff';
        ctx.lineWidth = telegraphOnly ? 3 : 6;
        ctx.globalAlpha = telegraphOnly ? 0.55 : 0.9;
        ctx.setLineDash(telegraphOnly ? [10, 10] : []);
        for (let i = 0; i < bladeCount; i++) {
            const angle = (Math.PI * 2 / bladeCount) * i;
            ctx.beginPath();
            ctx.moveTo(Math.cos(angle) * innerRadius, Math.sin(angle) * innerRadius);
            ctx.lineTo(Math.cos(angle) * outerRadius, Math.sin(angle) * outerRadius);
            ctx.stroke();
        }
        ctx.setLineDash([]);
        ctx.restore();
    }

    renderSpiralRails(ctx, telegraphOnly = false) {
        const finale = this.activeAttack === VORTEX_ATTACKS.FINALE || this.finaleState === VORTEX_FINALE_STATES.VOLLEY;
        const pattern = this.getSpiralPattern(this.spiralWavesFired || 0, finale);
        const laneLength = finale ? 520 : 430;
        const pulse = 0.5 + Math.sin(this.visualPulse * Math.PI * 8) * 0.5;

        ctx.save();
        ctx.globalCompositeOperation = 'screen';

        // Highlight the actual no-fire wedge first so the player can immediately read the gap.
        const gapAngle = pattern.baseAngle;
        const gapWidth = (Math.PI * 2 / pattern.count) * pattern.gapCount;
        ctx.fillStyle = '#5ffcff';
        ctx.globalAlpha = telegraphOnly ? 0.12 + pulse * 0.08 : 0.06;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.arc(this.x, this.y, laneLength, gapAngle - gapWidth * 0.5, gapAngle + gapWidth * 0.5);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = '#ff6a9f';
        ctx.lineWidth = telegraphOnly ? 2.5 + pulse * 1.5 : 2.5;
        ctx.globalAlpha = telegraphOnly ? 0.82 : 0.6;
        for (let i = 0; i < pattern.count; i++) {
            const angle = pattern.baseAngle + pattern.direction * (Math.PI * 2 / pattern.count) * i;
            if (this.isSpiralGapIndex(i, pattern)) {
                ctx.save();
                ctx.strokeStyle = '#5ffcff';
                ctx.globalAlpha = telegraphOnly ? 0.75 : 0.35;
                ctx.lineWidth = 4;
                ctx.setLineDash([12, 10]);
                ctx.beginPath();
                ctx.moveTo(this.x + Math.cos(angle) * 55, this.y + Math.sin(angle) * 55);
                ctx.lineTo(this.x + Math.cos(angle) * laneLength, this.y + Math.sin(angle) * laneLength);
                ctx.stroke();
                ctx.setLineDash([]);
                ctx.restore();
                continue;
            }

            ctx.beginPath();
            ctx.moveTo(this.x + Math.cos(angle) * 45, this.y + Math.sin(angle) * 45);
            ctx.lineTo(this.x + Math.cos(angle) * laneLength, this.y + Math.sin(angle) * laneLength);
            ctx.stroke();

            // Small muzzle bead shows exactly where a projectile will leave the boss.
            ctx.globalAlpha = telegraphOnly ? 0.9 : 0.55;
            ctx.fillStyle = '#ff6a9f';
            ctx.beginPath();
            ctx.arc(this.x + Math.cos(angle) * 62, this.y + Math.sin(angle) * 62, 4 + pulse * 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#ff6a9f';
            ctx.globalAlpha = telegraphOnly ? 0.82 : 0.6;
        }
        ctx.restore();
    }

    renderSafeCorridors(ctx, pulse) {
        const base = this.getFinaleCorridorAngle();
        const radius = 520;
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        for (let i = 0; i < 4; i++) {
            const center = base + i * Math.PI / 2;
            const left = center - this.finaleCorridorWidth;
            const right = center + this.finaleCorridorWidth;
            ctx.strokeStyle = '#9ffcff';
            ctx.lineWidth = 4;
            ctx.globalAlpha = 0.55 + pulse * 0.3;
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.x + Math.cos(left) * radius, this.y + Math.sin(left) * radius);
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.x + Math.cos(right) * radius, this.y + Math.sin(right) * radius);
            ctx.stroke();

            this.renderCorridorArrow(ctx, center, radius * 0.48);
        }
        ctx.restore();
    }

    renderCorridorArrow(ctx, angle, radius) {
        const tangent = angle + this.finaleDirection * Math.PI / 2;
        const x = this.x + Math.cos(angle) * radius;
        const y = this.y + Math.sin(angle) * radius;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(tangent);
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 0.65 + Math.sin(this.visualPulse * Math.PI * 5) * 0.2;
        ctx.beginPath();
        ctx.moveTo(16, 0);
        ctx.lineTo(-10, -8);
        ctx.lineTo(-5, 0);
        ctx.lineTo(-10, 8);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    renderCore(ctx) {
        const visualRadius = this.size * 0.52;
        const intensity = this.getCoreIntensity();
        const pulse = this.getSpectaclePulse(1 + intensity * 0.45);
        const gravityCharge = this.telegraphType === 'inhale' || this.telegraphType === 'burstFlip' || this.activeAttack === VORTEX_ATTACKS.FINALE;
        const deathSequence = this.spectacle && this.spectacle.deathSequence;
        const phaseMoment = this.spectacle && this.spectacle.phaseMoment;
        const jitter = this.getRenderJitter();
        const coreColor = deathSequence
            ? '#ff3b6b'
            : this.panicMode
                ? '#b8a7ff'
                : intensity >= 0.8
                    ? '#ffffff'
                    : '#00ffff';
        const toothColor = this.state === VORTEX_STATES.RECOVERY
            ? '#ffffff'
            : this.panicMode
                ? '#b8a7ff'
                : '#00ced1';

        ctx.save();
        ctx.globalAlpha = Math.max(0.05, this.blinkAlpha);
        ctx.translate(this.x + jitter.x, this.y + jitter.y);
        ctx.rotate(this.rotationAngle);

        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = (gravityCharge ? 0.62 : 0.32) + pulse * (0.16 + intensity * 0.14);
        ctx.fillStyle = coreColor;
        ctx.beginPath();
        ctx.arc(0, 0, visualRadius * (gravityCharge ? 1.95 + intensity * 0.22 : 1.35 + intensity * 0.35), 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = gravityCharge ? 0.55 + intensity * 0.12 : 0.22 + intensity * 0.18;
        ctx.strokeStyle = gravityCharge ? '#ffffff' : coreColor;
        ctx.lineWidth = gravityCharge ? 5 + intensity * 2 : 3 + intensity;
        ctx.beginPath();
        ctx.ellipse(0, 0, visualRadius * (2.0 + intensity * 0.25), visualRadius * (0.64 + intensity * 0.16), -this.rotationAngle * 0.4, 0, Math.PI * 2);
        ctx.stroke();

        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#000004';
        ctx.strokeStyle = deathSequence ? '#ff3b6b' : this.state === VORTEX_STATES.RECOVERY ? '#ffffff' : '#9ffcff';
        ctx.lineWidth = 4 + intensity;
        ctx.beginPath();
        ctx.arc(0, 0, visualRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        const inhaleContract = this.activeAttack === VORTEX_ATTACKS.INHALE || this.finaleState === VORTEX_FINALE_STATES.INHALE;
        const innerVoidRadius = visualRadius * (0.42 - intensity * 0.08 + pulse * (0.05 + intensity * 0.04) - (inhaleContract ? 0.09 : 0));
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(0, 0, innerVoidRadius, 0, Math.PI * 2);
        ctx.fill();

        const teethCount = this.panicMode || deathSequence ? 16 : intensity > 0.65 ? 14 : 12;
        ctx.strokeStyle = toothColor;
        ctx.lineWidth = 3 + intensity * 1.5;
        for (let i = 0; i < teethCount; i++) {
            const angle = (Math.PI * 2 / teethCount) * i;
            const inner = visualRadius * (0.68 - intensity * 0.03);
            const outer = visualRadius * (1.0 + pulse * (0.08 + intensity * 0.1));
            ctx.beginPath();
            ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
            ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
            ctx.stroke();
        }

        if (phaseMoment) {
            const progress = Math.min(1, phaseMoment.elapsed / phaseMoment.duration);
            ctx.globalCompositeOperation = 'screen';
            ctx.globalAlpha = (1 - progress) * 0.42;
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 5;
            for (let i = 0; i < 7; i++) {
                const angle = (Math.PI * 2 / 7) * i + progress * 0.8;
                ctx.beginPath();
                ctx.moveTo(Math.cos(angle) * visualRadius * 0.7, Math.sin(angle) * visualRadius * 0.7);
                ctx.lineTo(Math.cos(angle) * visualRadius * (2.5 + progress * 2.4), Math.sin(angle) * visualRadius * (2.5 + progress * 2.4));
                ctx.stroke();
            }
        }

        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = Math.min(1, 0.85 * this.coreExposure + (deathSequence ? 0.45 : 0));
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, 9 + pulse * (3 + intensity * 5), 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
        ctx.globalAlpha = 1;
    }

    serialize() {
        const baseState = super.serialize();
        return {
            ...baseState,
            rotationAngle: this.rotationAngle,
            rotationSpeed: this.rotationSpeed,
            activeAttack: this.activeAttack,
            currentAction: this.currentAction,
            actionQueue: this.actionQueue,
            currentComboName: this.currentComboName,
            comboStepIndex: this.comboStepIndex,
            attackTimer: this.attackTimer,
            attackDuration: this.attackDuration,
            telegraphDuration: this.telegraphDuration,
            recoveryDuration: this.recoveryDuration,
            telegraphActive: this.telegraphActive,
            telegraphType: this.telegraphType,
            gravityWells: this.gravityWells,
            ghostBlocks: this.ghostBlocks,
            harvestRestored: this.harvestRestored,
            finaleState: this.finaleState,
            finaleElapsed: this.finaleElapsed,
            finaleDirection: this.finaleDirection,
            finaleBaseAngle: this.finaleBaseAngle,
            finaleAngularSpeed: this.finaleAngularSpeed,
            finaleCorridorWidth: this.finaleCorridorWidth,
            spiralDirection: this.spiralDirection,
            spiralBaseAngle: this.spiralBaseAngle,
            lanceTargetAngle: this.lanceTargetAngle,
            lancePredictedPoint: this.lancePredictedPoint,
            beamBaseAngle: this.beamBaseAngle,
            beamDirection: this.beamDirection,
            beamSpawned: this.beamSpawned,
            patternTimer: this.patternTimer,
            patternBurstsFired: this.patternBurstsFired,
            cageVolleyTimer: this.cageVolleyTimer,
            orbitBladeAngle: this.orbitBladeAngle,
            coreExposure: this.coreExposure,
            blinkDestination: this.blinkDestination,
            blinkAlpha: this.blinkAlpha,
            dashTarget: this.dashTarget,
            dashTelegraphStart: this.dashTelegraphStart,
            panicMode: this.panicMode,
            massShadowProgress: this.massShadowProgress,
            arenaLight: this.arenaLight,
            spectaclePhaseMoment: this.spectacle && this.spectacle.phaseMoment ? { ...this.spectacle.phaseMoment } : null,
            spectacleDeathSequence: this.spectacle && this.spectacle.deathSequence ? { ...this.spectacle.deathSequence } : null
        };
    }

    applyState(state) {
        const previousAttack = this.activeAttack;
        const previousState = this.state;
        const previousFinaleState = this.finaleState;
        const previousComboName = this.currentComboName;
        super.applyState(state);

        if (state.rotationAngle !== undefined) this.rotationAngle = state.rotationAngle;
        if (state.rotationSpeed !== undefined) this.rotationSpeed = state.rotationSpeed;
        if (state.activeAttack !== undefined) this.activeAttack = state.activeAttack;
        if (state.currentAction !== undefined) this.currentAction = state.currentAction ? { ...state.currentAction } : null;
        if (Array.isArray(state.actionQueue)) this.actionQueue = state.actionQueue.map(action => ({ ...action }));
        if (state.currentComboName !== undefined) this.currentComboName = state.currentComboName;
        if (state.comboStepIndex !== undefined) this.comboStepIndex = state.comboStepIndex;
        if (state.attackTimer !== undefined) this.attackTimer = state.attackTimer;
        if (state.attackDuration !== undefined) this.attackDuration = state.attackDuration;
        if (state.telegraphDuration !== undefined) this.telegraphDuration = state.telegraphDuration;
        if (state.recoveryDuration !== undefined) this.recoveryDuration = state.recoveryDuration;
        if (state.telegraphActive !== undefined) this.telegraphActive = state.telegraphActive;
        if (state.telegraphType !== undefined) this.telegraphType = state.telegraphType;
        if (Array.isArray(state.gravityWells)) this.gravityWells = state.gravityWells.map(well => ({ ...well }));
        if (Array.isArray(state.ghostBlocks)) this.ghostBlocks = state.ghostBlocks.map(block => ({ ...block }));
        if (state.harvestRestored !== undefined) this.harvestRestored = state.harvestRestored;
        if (state.finaleState !== undefined) this.finaleState = state.finaleState;
        if (state.finaleElapsed !== undefined) this.finaleElapsed = state.finaleElapsed;
        if (state.finaleDirection !== undefined) this.finaleDirection = state.finaleDirection;
        if (state.finaleBaseAngle !== undefined) this.finaleBaseAngle = state.finaleBaseAngle;
        if (state.finaleAngularSpeed !== undefined) this.finaleAngularSpeed = state.finaleAngularSpeed;
        if (state.finaleCorridorWidth !== undefined) this.finaleCorridorWidth = state.finaleCorridorWidth;
        if (state.spiralDirection !== undefined) this.spiralDirection = state.spiralDirection;
        if (state.spiralBaseAngle !== undefined) this.spiralBaseAngle = state.spiralBaseAngle;
        if (state.lanceTargetAngle !== undefined) this.lanceTargetAngle = state.lanceTargetAngle;
        if (state.lancePredictedPoint !== undefined) this.lancePredictedPoint = state.lancePredictedPoint ? { ...state.lancePredictedPoint } : null;
        if (state.beamBaseAngle !== undefined) this.beamBaseAngle = state.beamBaseAngle;
        if (state.beamDirection !== undefined) this.beamDirection = state.beamDirection;
        if (state.beamSpawned !== undefined) this.beamSpawned = state.beamSpawned;
        if (state.patternTimer !== undefined) this.patternTimer = state.patternTimer;
        if (state.patternBurstsFired !== undefined) this.patternBurstsFired = state.patternBurstsFired;
        if (state.cageVolleyTimer !== undefined) this.cageVolleyTimer = state.cageVolleyTimer;
        if (state.orbitBladeAngle !== undefined) this.orbitBladeAngle = state.orbitBladeAngle;
        if (state.coreExposure !== undefined) this.coreExposure = state.coreExposure;
        if (state.blinkDestination !== undefined) this.blinkDestination = state.blinkDestination ? { ...state.blinkDestination } : null;
        if (state.blinkAlpha !== undefined) this.blinkAlpha = state.blinkAlpha;
        if (state.dashTarget !== undefined) this.dashTarget = state.dashTarget ? { ...state.dashTarget } : null;
        if (state.dashTelegraphStart !== undefined) this.dashTelegraphStart = state.dashTelegraphStart ? { ...state.dashTelegraphStart } : null;
        if (state.panicMode !== undefined) this.panicMode = state.panicMode;
        if (state.massShadowProgress !== undefined) this.massShadowProgress = state.massShadowProgress;
        if (state.arenaLight !== undefined) this.arenaLight = { ...this.arenaLight, ...state.arenaLight };
        if (state.spectaclePhaseMoment !== undefined && this.spectacle) {
            this.spectacle.phaseMoment = state.spectaclePhaseMoment ? { ...state.spectaclePhaseMoment } : null;
        }
        if (state.spectacleDeathSequence !== undefined && this.spectacle) {
            this.spectacle.deathSequence = state.spectacleDeathSequence ? { ...state.spectacleDeathSequence } : null;
            if (this.spectacle.deathSequence) {
                this.alive = true;
            }
        }
        if (this.currentComboName && this.currentComboName !== previousComboName) {
            this.startComboBanner(this.currentComboName);
        }

        const isClient = typeof Game !== 'undefined' && Game.isMultiplayerClient && Game.isMultiplayerClient();
        if (isClient) {
            const attackKey = `${this.state}:${this.activeAttack}:${this.finaleState}`;
            if (attackKey !== this.syncedSoundKey) {
                this.syncedSoundKey = attackKey;
                if (this.state === VORTEX_STATES.TELEGRAPH && previousAttack !== this.activeAttack) {
                    this.playAttackSound(this.activeAttack, 'telegraph');
                }
                if (this.state === VORTEX_STATES.ACTIVE && previousState !== this.state) {
                    this.playAttackSound(this.activeAttack, 'active');
                }
                if (this.finaleState !== previousFinaleState) {
                    this.spawnFinaleSpectacleBeat(this.finaleState);
                    this.playFinaleStateSound(this.finaleState);
                }
            }
        }
    }
}

