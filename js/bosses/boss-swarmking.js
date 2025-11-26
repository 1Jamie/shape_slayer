// Swarm King Boss - Room 10
// Large star with inward-bending spikes, rotation attacks, minion spawning

function normalizeAngle(angle) {
    while (angle > Math.PI) angle -= Math.PI * 2;
    while (angle < -Math.PI) angle += Math.PI * 2;
    return angle;
}

class BossSwarmKing extends BossBase {
    constructor(x, y) {
        super(x, y);

        // Boss name
        this.bossName = 'Swarm King';

        // Star shape properties
        this.spikeCount = 8; // 8 spikes for star
        this.rotationAngle = 0; // Current rotation
        this.rotationSpeed = 0; // Rotation speed (radians per second)
        this.rotation = 0;
        this.spikeExtension = 0; // Current spike extension (0-1)
        this.maxSpikeExtension = 30; // Max spike extension in pixels

        // State machine
        this.state = 'chase'; // 'chase', 'barrage', 'lunge', 'slam', 'spinning'
        this.stateTimer = 0;

        // Attack cooldowns
        this.barrageCooldown = 0;
        this.lungeCooldown = 0;
        this.slamCooldown = 0;
        this.spawnCooldown = 0;

        // Minions spawned
        this.minions = [];
        this.maxMinions = 8; // Hard cap across phases

        // Multi-barrage tracking
        this.multiBarrageTimer = 0;
        this.multiBarrageWaves = 0;
        this.phase2VolleyCooldown = 0;
        this.phase3BeamCooldown = 0;
        this.phase3BeamInterval = 6.0;
        this.phase3BeamWarmup = 2.1;
        this.phase3BeamDuration = 2.4;
        this.activeBeamHazard = null;
        this.beamStateTimer = 0;
        this.pendingBeamAngle = 0;
        this.beamTelegraphAngle = 0;
        this.beamTelegraphLength = 720;
        this.beamTelegraphTurnRate = Math.PI * 0.1575;
        this.beamFireTurnRate = Math.PI * 0.1209375;
        this.beamLengthGrowthSpeed = 377;
        this.beamInitialLength = 120;
        this.beamMaxLength = 720;
        this.finalExplosionTriggered = false;
        this.summonGlobalCooldown = 0;
        this.serverRotationAngle = 0;
        this.visualRotationAngle = this.rotationAngle;
        this.clientSpin = null;
        this.defaultSpinSpeed = Math.PI * 2;

        // Phase 3 Rework: Frantic Barrage & Exhausted
        this.phase3State = 'franticBarrage'; // 'franticBarrage', 'exhausted'
        this.dashCount = 0;
        this.maxDashes = 5;
        this.dashTarget = null; // {x, y}
        this.exhaustedTimer = 0;
        this.exhaustedDuration = 4.0;
        this.dashSpeed = 450; // High speed for frantic feel
        this.isDashing = false;

        // Disable old beam vars but keep for reference
        // this.phase3BeamCooldown = 0;
        // this.phase3BeamInterval = 6.0;
        // ...
        this.size = 60; // Large star (BossBase will multiply by 2, so final size is 120)
        this.maxHp = 1250; // BossBase will multiply by 12
        this.hp = this.maxHp;
        this.damage = 8; // BossBase will multiply by 1.5
        this.moveSpeed = 90.95; // Increased from 80 for better speed
        this.color = '#ff6b00'; // Orange-red

        // Add weak points at spike bases (3 weak points)
        // Use this.size (after BossBase multiplies it) for positioning
        const angleStep = (Math.PI * 2) / this.spikeCount;
        for (let i = 0; i < 3; i++) {
            const angle = angleStep * i * 2.67; // Space them out
            const dist = this.size * 0.4; // At base of spikes (now using actual size)
            this.addWeakPoint(
                Math.cos(angle) * dist,
                Math.sin(angle) * dist,
                8, // Weak point radius
                angle
            );
        }
    }

    getPhaseMinionCap() {
        if (this.phase === 1) return 3;
        if (this.phase === 2) return 5;
        return this.maxMinions || 8;
    }

    getSummonGlobalCooldown() {
        if (this.phase === 1) return 5.0;
        if (this.phase === 2) return 4.0;
        return 3.0;
    }

    update(deltaTime, player) {
        if (!this.introComplete) return; // Don't update during intro
        if (!this.alive) return;

        const aggroPlayer = this.resolveAggroPlayer(deltaTime, player);
        if (!aggroPlayer) return;
        player = aggroPlayer;

        // Process knockback first
        this.processKnockback(deltaTime);

        // Check phase transitions
        this.checkPhaseTransition();

        // Update hazards
        this.updateHazards(deltaTime, player);

        // Check hazard collisions with player
        this.checkHazardCollisions(player, deltaTime);

        // Update weak points animation
        this.updateWeakPoints(deltaTime);

        // Update telegraphs
        if (this.updateTelegraph) {
            this.updateTelegraph(deltaTime);
        }

        // Update recovery window
        if (this.updateRecoveryWindow) {
            this.updateRecoveryWindow(deltaTime);
        }

        // Update attack cooldowns
        this.barrageCooldown -= deltaTime;
        this.lungeCooldown -= deltaTime;
        this.slamCooldown -= deltaTime;
        this.spawnCooldown -= deltaTime;
        this.stateTimer += deltaTime;
        if (this.summonGlobalCooldown > 0) {
            this.summonGlobalCooldown -= deltaTime;
            if (this.summonGlobalCooldown < 0) this.summonGlobalCooldown = 0;
        }

        // Update rotation
        this.rotationAngle += this.rotationSpeed * deltaTime;
        this.rotation = this.rotationAngle;
        this.targetRotation = this.rotationAngle;

        // Phase-based behavior
        if (this.phase === 1) {
            this.updatePhase1(deltaTime, player);
        } else if (this.phase === 2) {
            this.updatePhase2(deltaTime, player);
        } else {
            this.updatePhase3(deltaTime, player);
        }

        // Keep in bounds
        this.keepInBounds();

        // Update minions list (remove dead ones)
        this.minions = this.minions.filter(m => m && m.alive);

        this.visualRotationAngle = this.rotationAngle;
    }

    updatePhase1(deltaTime, player) {
        const distance = Math.sqrt((player.x - this.x) ** 2 + (player.y - this.y) ** 2);

        // State machine
        if (this.state === 'chase') {
            // Chase player
            const dx = player.x - this.x;
            const dy = player.y - this.y;
            if (distance > 0) {
                this.x += (dx / distance) * this.moveSpeed * deltaTime * 0.5;
                this.y += (dy / distance) * this.moveSpeed * deltaTime * 0.5;
            }

            // Decide next attack
            if (this.barrageCooldown <= 0 && distance > 150) {
                this.state = 'barrage';
                this.stateTimer = 0;
            } else if (this.lungeCooldown <= 0 && distance < 200) {
                this.state = 'lunge';
                this.stateTimer = 0;
            } else if (this.slamCooldown <= 0 && distance < 100) {
                this.state = 'slam';
                this.stateTimer = 0;
            } else if (this.spawnCooldown <= 0 && this.summonGlobalCooldown <= 0 && this.minions.length < this.getPhaseMinionCap()) {
                this.spawnMinions();
                this.spawnCooldown = 8.0;
            }
        } else if (this.state === 'barrage') {
            // Spike barrage attack
            if (this.stateTimer < 0.5) {
                // Windup: rotate slowly
                this.rotationSpeed = Math.PI * 0.5;
            } else if (this.stateTimer < 1.0) {
                // Fire projectiles
                if (this.stateTimer < 0.6) {
                    this.spikeBarrage();
                }
                this.rotationSpeed = Math.PI * 2;
            } else {
                // End attack
                this.state = 'chase';
                this.rotationSpeed = 0;
                this.barrageCooldown = 4.0;
            }
        } else if (this.state === 'lunge') {
            // Chase lunge - Reworked for better range
            if (this.stateTimer < 0.4) {
                // Windup: Face player, maybe back up slightly?
                // Just rotate for now
                const targetAngle = Math.atan2(player.y - this.y, player.x - this.x);
                this.rotationSpeed = 0;
                this.rotationAngle = this.rotateTowards(this.rotationAngle, targetAngle, Math.PI * 4 * deltaTime);

                // Telegraph
                if (this.stateTimer === 0) {
                    this.beginTelegraph('charge', { duration: 0.4, color: '#ff8800' });
                }
            } else if (this.stateTimer < 1.5) { // Increased duration (was 1.2)
                // Lunge forward
                const dx = player.x - this.x;
                const dy = player.y - this.y;
                // Move in direction of rotation (or just towards player for easier tracking)
                // Let's track player loosely
                if (distance > 0) {
                    this.x += (dx / distance) * this.moveSpeed * deltaTime * 3.0; // Reduced speed (was 4.0)
                    this.y += (dy / distance) * this.moveSpeed * deltaTime * 3.0;
                }
            } else {
                // End
                this.state = 'chase';
                this.lungeCooldown = 5.0;
            }
        } else if (this.state === 'slam') {
            // Spike slam
            if (this.stateTimer < 0.5) {
                // Windup: extend spikes
                this.spikeExtension = Math.min(1.0, this.stateTimer * 2);
            } else if (this.stateTimer < 0.6) {
                // Slam: create shockwave
                if (this.stateTimer < 0.51) {
                    this.spikeSlam();
                }
                this.spikeExtension = 1.0;
            } else {
                // End
                this.spikeExtension = 0;
                this.state = 'chase';
                this.slamCooldown = 6.0;
            }
        }
    }

    updatePhase2(deltaTime, player) {
        // Faster versions of Phase 1, plus new attacks
        const distance = Math.sqrt((player.x - this.x) ** 2 + (player.y - this.y) ** 2);
        const isClient = typeof Game !== 'undefined' && Game.isMultiplayerClient && Game.isMultiplayerClient();
        this.phase2VolleyCooldown -= deltaTime;
        if (this.phase2VolleyCooldown < 0) this.phase2VolleyCooldown = 0;

        if (this.state === 'chase') {
            const dx = player.x - this.x;
            const dy = player.y - this.y;
            if (distance > 0) {
                this.x += (dx / distance) * this.moveSpeed * deltaTime * 0.6;
                this.y += (dy / distance) * this.moveSpeed * deltaTime * 0.6;
            }

            if (this.barrageCooldown <= 0 && this.phase2VolleyCooldown <= 0 && distance > 160) {
                this.state = 'barrage';
                this.stateTimer = 0;
                this.phase2VolleyCooldown = 4.5;
            } else if (this.slamCooldown <= 0 && distance < 120) {
                this.state = 'spinning'; // Spinning spike wheel
                this.stateTimer = 0;
            } else if (this.spawnCooldown <= 0 && this.summonGlobalCooldown <= 0 && this.minions.length < this.getPhaseMinionCap()) {
                this.spawnMinions();
                this.spawnCooldown = 6.5;
            }
        } else if (this.state === 'barrage') {
            if (this.stateTimer < 0.3) {
                this.rotationSpeed = Math.PI;
            } else if (this.stateTimer < 1.5) {
                if (this.stateTimer < 0.35 && this.multiBarrageWaves === 0) {
                    // Start multi-barrage
                    this.multiBarrageWaves = 1; // 1 more wave after first
                    this.multiBarrageTimer = 0.35;
                    this.multiBarrage();
                }
                // Update multi-barrage waves
                if (this.multiBarrageTimer > 0) {
                    this.multiBarrageTimer -= deltaTime;
                    if (this.multiBarrageTimer <= 0 && this.multiBarrageWaves > 0) {
                        this.multiBarrage();
                        this.multiBarrageWaves--;
                        this.multiBarrageTimer = 0.35;
                    }
                }
                this.rotationSpeed = Math.PI * 3;
            } else {
                this.state = 'chase';
                this.rotationSpeed = 0;
                this.barrageCooldown = 3.5;
                this.phase2VolleyCooldown = Math.max(this.phase2VolleyCooldown, 3.5);
            }
        } else if (this.state === 'spinning') {
            if (this.stateTimer < 2.0) {
                // Rapid rotation with contact damage
                this.rotationSpeed = Math.PI * 6;
                this.spikeExtension = 0.7;

                // Chase player while spinning (Phase 2 tweak)
                const dx = player.x - this.x;
                const dy = player.y - this.y;
                if (distance > 0) {
                    this.x += (dx / distance) * this.moveSpeed * deltaTime * 1.5;
                    this.y += (dy / distance) * this.moveSpeed * deltaTime * 1.5;
                }

                // Check contact damage with player
                if (!isClient && distance < this.size + player.size) {
                    player.takeDamage(this.damage * 0.5); // Half damage per frame during spin
                }
            } else {
                this.state = 'chase';
                this.rotationSpeed = 0;
                this.spikeExtension = 0;
                this.slamCooldown = 4.0;
            }
        }
    }

    updatePhase3(deltaTime, player) {
        // Disable old beam logic
        /*
        // Maximum intensity
        this.rotationSpeed = Math.PI * 2; // Constant rotation
        const isClient = typeof Game !== 'undefined' && Game.isMultiplayerClient && Game.isMultiplayerClient();
        const distance = Math.sqrt((player.x - this.x) ** 2 + (player.y - this.y) ** 2);

        if (!this.activeBeamHazard) {
            const existingBeam = this.environmentalHazards.find(h => h && h.type === 'beam' && !h.expired);
            if (existingBeam) {
                this.activeBeamHazard = existingBeam;
            }
        } else if (this.activeBeamHazard.expired) {
            this.activeBeamHazard = null;
        }

        this.phase3BeamCooldown -= deltaTime;
        if (this.phase3BeamCooldown < 0) this.phase3BeamCooldown = 0;

        if (this.state === 'beamWarmup') {
            this.beamStateTimer += deltaTime;
            if (player) {
                const targetAngle = Math.atan2(player.y - this.y, player.x - this.x);
                this.pendingBeamAngle = this.rotateTowards(this.pendingBeamAngle, targetAngle, this.beamTelegraphTurnRate * deltaTime);
            }
            this.beamTelegraphAngle = this.pendingBeamAngle;
            this.spikeExtension = 0.6 + Math.min(0.3, (this.beamStateTimer / this.phase3BeamWarmup) * 0.3);
            if (this.beamStateTimer >= this.phase3BeamWarmup && !isClient) {
                this.startPhase3Beam(player);
            }
        } else if (this.state === 'beamFire') {
            this.beamStateTimer += deltaTime;
            this.spikeExtension = Math.max(this.spikeExtension, 0.85);
            if (this.activeBeamHazard) {
                this.beamTelegraphAngle = this.activeBeamHazard.angle;
            }
            if ((!this.activeBeamHazard || this.beamStateTimer >= this.phase3BeamDuration) && !isClient) {
                this.endPhase3Beam();
            }
        } else {
            if (this.hp / this.maxHp < 0.1) {
                this.spikeExtension = 0.8;
                if (!this.finalExplosionTriggered && !isClient) {
                    this.explosiveFinale();
                    this.finalExplosionTriggered = true;
                }
            } else {
                this.spikeExtension = 0.6;
            }

            if (this.phase3BeamCooldown <= 0 && !this.activeBeamHazard && !isClient) {
                this.startPhase3BeamWarmup(player);
            } else if (this.barrageCooldown <= 0 && !isClient) {
                this.spikeBarrage();
                this.barrageCooldown = 4.5;
            }
        }

        if (this.spawnCooldown <= 0 && this.summonGlobalCooldown <= 0 && this.minions.length < this.getPhaseMinionCap() && this.state !== 'beamFire') {
            this.spawnMinions();
            this.spawnCooldown = 4.5;
        }

        const dx = player.x - this.x;
        const dy = player.y - this.y;
        if (distance > 0) {
            const moveMultiplier = this.state === 'beamFire' ? 0.2 : 0.75;
            this.x += (dx / distance) * this.moveSpeed * deltaTime * moveMultiplier;
            this.y += (dy / distance) * this.moveSpeed * deltaTime * moveMultiplier;
        }
        */

        // New Phase 3 Logic: Frantic Barrage -> Exhausted
        const isClient = typeof Game !== 'undefined' && Game.isMultiplayerClient && Game.isMultiplayerClient();

        // Always rotate fast in phase 3
        this.rotationSpeed = Math.PI * 3;

        if (this.phase3State === 'franticBarrage') {
            // Reset vulnerability if coming from exhausted
            if (this.vulnerable) {
                this.vulnerable = false;
                this.vulnerabilityMultiplier = 1.0;
                this.cancelRecoveryWindow();
            }

            if (this.isDashing) {
                // Move towards dash target
                if (this.dashTarget) {
                    const dx = this.dashTarget.x - this.x;
                    const dy = this.dashTarget.y - this.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < 10 || dist > 2000) { // Arrived or glitch
                        this.x = this.dashTarget.x;
                        this.y = this.dashTarget.y;
                        this.isDashing = false;
                        this.dashTarget = null;

                        // Fire barrage on arrival
                        if (!isClient) {
                            this.spikeBarrage();
                            // Screen shake on impact
                            if (typeof Game !== 'undefined') {
                                Game.triggerScreenShake(5, 0.2, 'boss');
                            }
                        }

                        this.dashCount++;
                        if (this.dashCount >= this.maxDashes) {
                            this.phase3State = 'exhausted';
                            this.exhaustedTimer = 0;
                            this.dashCount = 0;
                        }
                    } else {
                        // Move
                        const moveDist = this.dashSpeed * deltaTime;
                        if (moveDist >= dist) {
                            this.x = this.dashTarget.x;
                            this.y = this.dashTarget.y;
                        } else {
                            this.x += (dx / dist) * moveDist;
                            this.y += (dy / dist) * moveDist;
                        }
                    }
                } else {
                    this.isDashing = false;
                }
            } else {
                // Not dashing, prepare next dash
                if (!this.activeTelegraph && !isClient) {
                    // Pick random point in room (safe bounds approx 200-1800?)
                    // Assuming room is roughly 2000x2000, keep somewhat central or near player
                    // Let's pick a point relative to player but clamped to room bounds
                    // Since we don't have room bounds easily, let's just pick a point 300-600px away from current pos
                    // but try to stay within reasonable world bounds if possible. 
                    // Better: Pick a point near the player to be aggressive.

                    const angle = Math.random() * Math.PI * 2;
                    const dist = 300 + Math.random() * 300;
                    let tx = player.x + Math.cos(angle) * 100; // Aim near player
                    let ty = player.y + Math.sin(angle) * 100;

                    // Simple bounds check (assuming standard room)
                    // If we don't have room bounds, just clamp to some reasonable area or rely on wall collision later?
                    // BossBase usually has keepInBounds. Let's trust keepInBounds to fix us if we go too far,
                    // but try to pick a valid point.
                    // Let's just aim for a point around the player.

                    this.dashTarget = { x: tx, y: ty };

                    // Start telegraph
                    this.beginTelegraph('dash', {
                        duration: 0.4, // Short warning
                        intensity: 1.0,
                        color: '#ff0000',
                        onEnd: (t, owner, cancelled) => {
                            if (!cancelled) {
                                owner.isDashing = true;
                            }
                        }
                    });
                }
            }
        } else if (this.phase3State === 'exhausted') {
            // Stop moving and rotating
            this.rotationSpeed = Math.PI * 0.5; // Slow rotation
            this.spikeExtension = 0;

            // Apply vulnerability
            if (!this.vulnerable) {
                this.vulnerable = true;
                this.vulnerabilityMultiplier = 2.0;
                this.enterRecoveryWindow(this.exhaustedDuration, 'critical', { modifier: 2.0 });
            }

            this.exhaustedTimer += deltaTime;
            if (this.exhaustedTimer >= this.exhaustedDuration) {
                this.phase3State = 'franticBarrage';
                this.vulnerable = false;
                this.vulnerabilityMultiplier = 1.0;
                this.cancelRecoveryWindow();
            }
        }

        // Still spawn minions in phase 3? Maybe reduce frequency or stop during exhausted?
        // Let's keep it but only during barrage
        if (this.phase3State === 'franticBarrage' && !this.isDashing &&
            this.spawnCooldown <= 0 && this.summonGlobalCooldown <= 0 &&
            this.minions.length < this.getPhaseMinionCap()) {
            this.spawnMinions();
            this.spawnCooldown = 5.0;
        }

        // Keep in bounds
        this.keepInBounds();
    }

    startPhase3BeamWarmup(player) {
        const isClient = typeof Game !== 'undefined' && Game.isMultiplayerClient && Game.isMultiplayerClient();
        if (isClient) return;
        this.state = 'beamWarmup';
        this.beamStateTimer = 0;
        this.pendingBeamAngle = player ? Math.atan2(player.y - this.y, player.x - this.x) : this.rotationAngle;
        this.beamTelegraphAngle = this.pendingBeamAngle;
        this.phase3BeamCooldown = this.phase3BeamInterval;
        this.activeBeamHazard = null;
        this.stateTimer = 0;
        if (typeof Game !== 'undefined') {
            Game.triggerScreenShake(4, 0.25, 'boss');
        }
    }

    startPhase3Beam(player) {
        const isClient = typeof Game !== 'undefined' && Game.isMultiplayerClient && Game.isMultiplayerClient();
        if (isClient) return;
        this.state = 'beamFire';
        this.beamStateTimer = 0;
        this.stateTimer = 0;
        const baseAngle = this.pendingBeamAngle;
        const hazard = this.createBeam({
            width: 72,
            length: this.beamInitialLength,
            maxLength: this.beamMaxLength,
            lengthGrowthSpeed: this.beamLengthGrowthSpeed,
            angle: baseAngle,
            tickInterval: 0.15,
            damagePerTick: this.damage,
            turnRate: this.beamFireTurnRate,
            lifetime: this.phase3BeamDuration,
            followSource: true,
            trackPlayer: true
        });
        this.pendingBeamAngle = baseAngle;
        this.beamTelegraphAngle = baseAngle;
        this.activeBeamHazard = hazard || null;
        if (typeof Game !== 'undefined') {
            Game.triggerScreenShake(8, 0.4, 'boss');
        }
    }

    endPhase3Beam() {
        const isClient = typeof Game !== 'undefined' && Game.isMultiplayerClient && Game.isMultiplayerClient();
        if (isClient) {
            this.beamStateTimer = 0;
            return;
        }
        this.state = 'chase';
        this.beamStateTimer = 0;
        this.stateTimer = 0;
        if (this.activeBeamHazard) {
            this.activeBeamHazard.expired = true;
        }
        this.activeBeamHazard = null;
        this.phase3BeamCooldown = Math.max(this.phase3BeamCooldown, this.phase3BeamInterval * 0.5);
    }

    rotateTowards(current, target, maxDelta) {
        let diff = target - current;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        if (diff > maxDelta) diff = maxDelta;
        if (diff < -maxDelta) diff = -maxDelta;
        return current + diff;
    }

    // Fire 8 projectiles in star pattern
    spikeBarrage() {
        if (typeof Game === 'undefined') return;

        const projectileSpeed = 214;
        for (let i = 0; i < 8; i++) {
            const angle = this.rotationAngle + (Math.PI * 2 / 8) * i;
            Game.projectiles.push({
                x: this.x,
                y: this.y,
                vx: Math.cos(angle) * projectileSpeed,
                vy: Math.sin(angle) * projectileSpeed,
                damage: this.damage * 0.8,
                size: 8,
                lifetime: 5.0, // Increased from 3.0 to cover room
                elapsed: 0
            });
        }
    }

    // 3 waves of 8 projectiles (call this multiple times with delays)
    multiBarrage() {
        // First wave
        this.spikeBarrage();
        // Store wave timer for subsequent waves
        if (!this.multiBarrageTimer) {
            this.multiBarrageTimer = 0;
        }
    }

    // Update multi-barrage waves (call in update)
    updateMultiBarrage(deltaTime) {
        if (this.multiBarrageTimer > 0) {
            this.multiBarrageTimer -= deltaTime;
            if (this.multiBarrageTimer <= 0) {
                // Fire next wave
                this.spikeBarrage();
                if (this.multiBarrageWaves > 0) {
                    this.multiBarrageWaves--;
                    this.multiBarrageTimer = 0.3; // Delay between waves
                }
            }
        }
    }

    // Spawn orbiting minions
    spawnMinions() {
        if (typeof Game === 'undefined' || typeof currentRoom === 'undefined') return;

        const maxTotal = this.maxMinions || 8;
        const phaseCap = Math.min(maxTotal, this.getPhaseMinionCap());
        const availableSlots = Math.max(0, phaseCap - this.minions.length);
        if (availableSlots <= 0 || this.summonGlobalCooldown > 0) return;

        const desiredCount = this.phase === 1 ? 2 + Math.floor(Math.random() * 2) :
            this.phase === 2 ? 3 + Math.floor(Math.random() * 2) :
                5 + Math.floor(Math.random() * 2);

        const spawnCount = Math.min(availableSlots, 3, desiredCount);
        if (spawnCount <= 0) return;

        for (let i = 0; i < spawnCount; i++) {
            const angle = (Math.PI * 2 / spawnCount) * i;
            const distance = 150 + Math.random() * 50;
            const minionX = this.x + Math.cos(angle) * distance;
            const minionY = this.y + Math.sin(angle) * distance;

            // Pass parent's currentTarget to minion constructor for aggro inheritance
            const minion = new Enemy(minionX, minionY, this.currentTarget);
            // Use helper function to scale minion stats based on current room progression
            if (typeof scaleMinionStats !== 'undefined') {
                scaleMinionStats(minion, 0.3, 0.7, 0.3);
            } else {
                // Fallback if helper not available (shouldn't happen)
                minion.maxHp = Math.floor(minion.maxHp * 0.3);
                minion.hp = minion.maxHp;
                minion.damage = minion.damage * 0.7;
                minion.xpValue = Math.floor(minion.xpValue * 0.3);
            }
            minion.lootChance = 0.0;

            if (currentRoom) {
                currentRoom.enemies.push(minion);
            }
            if (Game.enemies) {
                Game.enemies.push(minion);
            }
            this.minions.push(minion);
        }

        this.summonGlobalCooldown = this.getSummonGlobalCooldown();
    }

    // Spike slam creating shockwave
    spikeSlam() {
        this.createShockwave(this.x, this.y, 150, 0.5, this.damage * 1.5);

        // Screen shake
        if (typeof Game !== 'undefined') {
            Game.triggerScreenShake(6, 0.3, 'boss');
        }
    }

    // Explosive finale when HP < 10%
    explosiveFinale() {
        if (typeof Game === 'undefined') return;

        // Fire projectiles in all directions
        const projectileSpeed = 267.5;
        for (let i = 0; i < 16; i++) {
            const angle = (Math.PI * 2 / 16) * i;
            Game.projectiles.push({
                x: this.x,
                y: this.y,
                vx: Math.cos(angle) * projectileSpeed,
                vy: Math.sin(angle) * projectileSpeed,
                damage: this.damage * 1.2,
                size: 10,
                lifetime: 2.5,
                elapsed: 0
            });
        }

        // Create large shockwave
        this.createShockwave(this.x, this.y, 200, 0.8, this.damage * 2);

        // Particles
        if (typeof createParticleBurst !== 'undefined') {
            createParticleBurst(this.x, this.y, this.color, 40);
        }
    }

    // Override phase transition
    onPhaseTransition(oldPhase, newPhase) {
        super.onPhaseTransition(oldPhase, newPhase);

        // Reset state on phase transition
        this.state = 'chase';
        this.stateTimer = 0;
        this.rotationSpeed = 0;
        this.spikeExtension = 0;
        this.activeBeamHazard = null;
        this.beamStateTimer = 0;
        this.finalExplosionTriggered = false;
        this.phase2VolleyCooldown = 0;
        if (newPhase === 3) {
            this.phase3BeamCooldown = 1.5;
        } else {
            this.phase3BeamCooldown = 0;
        }

        if (newPhase === 3) {
            this.phase3State = 'franticBarrage';
            this.dashCount = 0;
            this.exhaustedTimer = 0;
        }
    }

    render(ctx) {
        if (!this.alive) return;

        ctx.save();
        ctx.translate(this.x, this.y);
        const isClient = typeof Game !== 'undefined' && Game.isMultiplayerClient && Game.isMultiplayerClient();
        const renderAngle = isClient && this.visualRotationAngle !== undefined
            ? this.visualRotationAngle
            : this.rotationAngle;
        ctx.rotate(renderAngle);

        // Draw star with inward-bending spikes
        ctx.fillStyle = this.color;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;

        ctx.beginPath();
        // Visual size should match hitbox size (no division)
        const visualSize = this.size; // Match the collision hitbox size
        const spikeLength = visualSize + (this.spikeExtension * this.maxSpikeExtension);
        const innerRadius = visualSize * 0.4; // Concave inward

        for (let i = 0; i < this.spikeCount; i++) {
            const outerAngle = (Math.PI * 2 / this.spikeCount) * i;
            const innerAngle = (Math.PI * 2 / this.spikeCount) * (i + 0.5);

            const outerX = Math.cos(outerAngle) * spikeLength;
            const outerY = Math.sin(outerAngle) * spikeLength;
            const innerX = Math.cos(innerAngle) * innerRadius;
            const innerY = Math.sin(innerAngle) * innerRadius;

            if (i === 0) {
                ctx.moveTo(outerX, outerY);
            } else {
                ctx.lineTo(outerX, outerY);
            }
            ctx.lineTo(innerX, innerY);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.restore();



        // Render Charge Telegraph (Phase 1 Lunge)
        if (this.activeTelegraph && this.activeTelegraph.type === 'charge') {
            const progress = this.activeTelegraph.progress;
            const length = 200 * progress;

            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(this.rotationAngle);

            // Draw charge arrow
            ctx.fillStyle = `rgba(255, 136, 0, ${0.4 + progress * 0.4})`;
            ctx.beginPath();
            ctx.moveTo(0, -15);
            ctx.lineTo(length, 0);
            ctx.lineTo(0, 15);
            ctx.closePath();
            ctx.fill();

            ctx.restore();
        }

        // Render Dash Telegraph
        if (this.activeTelegraph && this.activeTelegraph.type === 'dash' && this.dashTarget) {
            const progress = this.activeTelegraph.progress;
            const dx = this.dashTarget.x - this.x;
            const dy = this.dashTarget.y - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx);

            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(angle);

            // Draw arrow/line
            // Color shifts from orange to red
            const r = 255;
            const g = Math.floor(165 * (1 - progress));
            const b = 0;
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${0.3 + progress * 0.5})`;

            // Arrow shape
            ctx.beginPath();
            ctx.moveTo(0, -10);
            ctx.lineTo(dist - 20, -10);
            ctx.lineTo(dist - 20, -25);
            ctx.lineTo(dist, 0);
            ctx.lineTo(dist - 20, 25);
            ctx.lineTo(dist - 20, 10);
            ctx.lineTo(0, 10);
            ctx.closePath();
            ctx.fill();

            ctx.restore();
        }

        // Render Exhausted State
        if (this.phase3State === 'exhausted') {
            // Pulse effect
            const pulse = (Math.sin(Date.now() / 200) + 1) / 2; // 0 to 1
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.beginPath();
            ctx.arc(0, 0, this.size * 1.5, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255, 255, 0, ${0.3 + pulse * 0.4})`; // Yellow pulse
            ctx.lineWidth = 4;
            ctx.stroke();

            // "STUNNED" text or icon?
            // Just the pulse and maybe darker color for body
            ctx.restore();
        }

        // Render weak points
        this.renderWeakPoints(ctx);

        // Render hazards
        this.renderHazards(ctx);

        // Render health bar
        this.renderHealthBar(ctx);

        // Draw status effect indicators
        this.renderStatusEffects(ctx);
    }

    serialize() {
        const baseState = super.serialize();
        return {
            ...baseState,
            rotationAngle: this.rotationAngle,
            rotationSpeed: this.rotationSpeed,
            spikeExtension: this.spikeExtension,
            beamStateTimer: this.beamStateTimer,
            pendingBeamAngle: this.pendingBeamAngle,
            beamTelegraphAngle: this.beamTelegraphAngle,
            phase3BeamCooldown: this.phase3BeamCooldown,
            phase2VolleyCooldown: this.phase2VolleyCooldown
        };
    }

    applyState(state) {
        super.applyState(state);
        const isClient = typeof Game !== 'undefined' && Game.isMultiplayerClient && Game.isMultiplayerClient();

        if (state.rotationAngle !== undefined) {
            this.serverRotationAngle = state.rotationAngle;
            if (!isClient || !this.clientSpin) {
                this.rotationAngle = state.rotationAngle;
                this.rotation = state.rotationAngle;
                this.targetRotation = state.rotationAngle;
                this.visualRotationAngle = state.rotationAngle;
            }
        }
        if (state.rotationSpeed !== undefined) this.rotationSpeed = state.rotationSpeed;
        if (state.spikeExtension !== undefined) this.spikeExtension = state.spikeExtension;
        if (state.beamStateTimer !== undefined) this.beamStateTimer = state.beamStateTimer;
        if (state.pendingBeamAngle !== undefined) this.pendingBeamAngle = state.pendingBeamAngle;
        if (state.beamTelegraphAngle !== undefined) this.beamTelegraphAngle = state.beamTelegraphAngle;
        if (state.phase3BeamCooldown !== undefined) this.phase3BeamCooldown = state.phase3BeamCooldown;
        if (state.phase2VolleyCooldown !== undefined) this.phase2VolleyCooldown = state.phase2VolleyCooldown;

        if (isClient) {
            const desiredSpin = this.shouldClientSpin(this.phase, this.state);
            if (desiredSpin) {
                if (!this.clientSpin || this.clientSpin.state !== this.state || this.clientSpin.phase !== this.phase) {
                    const baseAngle = this.serverRotationAngle !== undefined ? this.serverRotationAngle : this.rotation;
                    this.clientSpin = {
                        state: this.state,
                        phase: this.phase,
                        startTime: Date.now(),
                        lastUpdate: Date.now(),
                        angle: baseAngle
                    };
                    this.visualRotationAngle = baseAngle;
                }
            } else {
                this.clientSpin = null;
                if (this.serverRotationAngle !== undefined) {
                    this.visualRotationAngle = this.serverRotationAngle;
                } else {
                    this.visualRotationAngle = this.rotation;
                }
            }
        } else {
            this.clientSpin = null;
            this.visualRotationAngle = this.rotationAngle;
        }
    }

    interpolateToTarget(deltaTime) {
        const isClient = typeof Game !== 'undefined' && Game.isMultiplayerClient && Game.isMultiplayerClient();
        super.interpolateToTarget(deltaTime);
        if (isClient) {
            if (this.clientSpin) {
                const now = Date.now();
                const dt = Math.max(0, (now - this.clientSpin.lastUpdate) / 1000);
                this.clientSpin.lastUpdate = now;
                const elapsed = Math.max(0, (now - this.clientSpin.startTime) / 1000);
                const speed = this.getClientSpinSpeed(this.clientSpin.phase, this.clientSpin.state, elapsed);
                if (speed !== null) {
                    const direction = this.rotationSpeed !== undefined && this.rotationSpeed < 0 ? -1 : 1;
                    this.clientSpin.angle = normalizeAngle(this.clientSpin.angle + direction * speed * dt);
                    this.visualRotationAngle = this.clientSpin.angle;
                } else {
                    this.clientSpin = null;
                    this.visualRotationAngle = this.serverRotationAngle !== undefined ? this.serverRotationAngle : this.rotation;
                }
            } else {
                this.visualRotationAngle = this.serverRotationAngle !== undefined ? this.serverRotationAngle : this.rotation;
            }
        } else {
            this.visualRotationAngle = this.rotation;
        }
    }

    shouldClientSpin(phase, state) {
        if (phase >= 3) {
            return state !== 'beamWarmup' && state !== 'beamFire';
        }
        if (phase === 2) {
            return state === 'barrage' || state === 'spinning';
        }
        if (phase === 1) {
            return state === 'barrage';
        }
        return false;
    }

    getClientSpinSpeed(phase, state, elapsed) {
        if (phase >= 3) {
            if (state === 'beamWarmup' || state === 'beamFire') return null;
            return Math.PI * 2;
        }
        if (phase === 2) {
            if (state === 'spinning') {
                return Math.PI * 6;
            }
            if (state === 'barrage') {
                if (elapsed < 0.3) return Math.PI;
                return Math.PI * 3;
            }
            return null;
        }
        if (phase === 1) {
            if (state === 'barrage') {
                if (elapsed < 0.5) return Math.PI * 0.5;
                return Math.PI * 2;
            }
            return null;
        }
        return null;
    }
}

