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

        this.pheromoneTrails = [];
        this.pheromoneSequenceId = 0;
        this.pheromoneCooldown = 2.0;
        this.nestPulseMarkers = [];
        this.resinPuddles = [];
        this.swarmBeat = 'command';
        this.attackFired = false;
        this.swarmVolleySequence = 0;
        this.phase3BurstSequence = 0;
        this.phase3WebAnchors = [];
        this.phase3WebIndex = 0;
        this.phase3DashStart = null;
        this.phase3DashPath = [];
        this.phase3DashFinalTarget = null;
        this.phase3DashElapsed = 0;
        this.phase3DashStuckTimer = 0;
        this.phase3DashLastPosition = null;
        this.activePhase3WebTrail = null;

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
        if (this.pheromoneCooldown > 0) {
            this.pheromoneCooldown = Math.max(0, this.pheromoneCooldown - deltaTime);
        }

        this.updatePheromoneTrails(deltaTime);
        this.updatePheromoneMinions(deltaTime);
        this.damagePlayersAlongPheromoneTrails(deltaTime);

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
        this.updateSwarmRhythm(deltaTime, player, false);
    }

    updatePhase2(deltaTime, player) {
        this.phase2VolleyCooldown = Math.max(0, this.phase2VolleyCooldown - deltaTime);
        this.updateSwarmRhythm(deltaTime, player, true);
    }

    updateSwarmRhythm(deltaTime, player, phaseTwo = false) {
        const isClient = typeof Game !== 'undefined' && Game.isMultiplayerClient && Game.isMultiplayerClient();
        const distance = Math.hypot(player.x - this.x, player.y - this.y);

        if (this.state === 'chase') {
            this.swarmBeat = 'command';
            this.state = 'command';
            this.stateTimer = 0;
            this.attackFired = false;
        }

        if (this.state === 'command') {
            this.rotationSpeed = Math.PI * 0.35;
            this.spikeExtension = 0.15 + Math.sin(this.stateTimer * 10) * 0.08;
            const commandPrep = phaseTwo ? 0.45 : 0.65;
            const commandDuration = phaseTwo ? 1.55 : 1.85;
            if (!this.attackFired && this.stateTimer >= commandPrep && !isClient) {
                this.startPheromoneCircuit(player);
                if (phaseTwo) {
                    this.spikeBarrage();
                }
                this.attackFired = true;
            }
            if (this.stateTimer >= commandDuration) {
                this.state = phaseTwo ? 'spinning' : 'lunge';
                this.swarmBeat = 'pressure';
                this.stateTimer = 0;
                this.attackFired = false;
                if (!phaseTwo) {
                    this.beginTelegraph('charge', { duration: 0.35, color: '#ff8800' });
                }
            }
            return;
        }

        if (this.state === 'lunge') {
            if (this.stateTimer < 0.35) {
                const targetAngle = Math.atan2(player.y - this.y, player.x - this.x);
                this.rotationSpeed = 0;
                this.rotationAngle = this.rotateTowards(this.rotationAngle, targetAngle, Math.PI * 5 * deltaTime);
                this.spikeExtension = -0.15;
            } else if (this.stateTimer < 1.3) {
                this.spikeExtension = 0.55;
                this.moveTowardPoint(player.x, player.y, 3.15, deltaTime, 0.22);
            } else {
                this.state = 'slam';
                this.swarmBeat = 'punish';
                this.stateTimer = 0;
                this.attackFired = false;
            }
            return;
        }

        if (this.state === 'spinning') {
            if (this.stateTimer < 0.4) {
                this.rotationSpeed = Math.PI * 0.6;
                this.spikeExtension = -0.5;
            } else if (this.stateTimer < 1.85) {
                this.rotationSpeed = Math.PI * 6.5;
                this.spikeExtension = 0.75;
                this.moveTowardPoint(player.x, player.y, 1.55, deltaTime, 0.28);
                if (!isClient && distance < this.size + player.size && typeof player.takeDamage === 'function') {
                    player.takeDamage(this.damage * 0.38);
                }
            } else {
                this.state = 'slam';
                this.swarmBeat = 'punish';
                this.stateTimer = 0;
                this.attackFired = false;
                this.rotationSpeed = 0;
            }
            return;
        }

        if (this.state === 'slam') {
            if (this.stateTimer < 0.55) {
                this.rotationSpeed = Math.PI * 0.4;
                this.spikeExtension = Math.min(1.0, this.stateTimer * 2.2);
            } else if (this.stateTimer < 0.72) {
                this.spikeExtension = 1.0;
                if (!this.attackFired && !isClient) {
                    this.spikeSlam();
                    this.attackFired = true;
                }
            } else if (this.stateTimer < 1.35) {
                this.rotationSpeed = Math.PI * 0.25;
                this.spikeExtension = 0.1;
            } else {
                this.spikeExtension = 0;
                this.rotationSpeed = 0;
                this.state = 'command';
                this.swarmBeat = 'command';
                this.stateTimer = 0;
                this.attackFired = false;
                this.spawnCooldown = phaseTwo ? 4.5 : 5.2;
                this.barrageCooldown = phaseTwo ? 3.2 : 3.8;
                this.slamCooldown = phaseTwo ? 4.2 : 5.0;
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
                    this.phase3DashElapsed += deltaTime;
                    const dx = this.dashTarget.x - this.x;
                    const dy = this.dashTarget.y - this.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (this.phase3DashLastPosition) {
                        const moved = Math.hypot(this.x - this.phase3DashLastPosition.x, this.y - this.phase3DashLastPosition.y);
                        this.phase3DashStuckTimer = moved < 1 ? this.phase3DashStuckTimer + deltaTime : 0;
                    }
                    this.phase3DashLastPosition = { x: this.x, y: this.y };

                    if (dist < 10 || dist > 2000 || this.phase3DashElapsed > 2.2 || this.phase3DashStuckTimer > 0.35) { // Arrived or failed safely
                        const failed = this.phase3DashStuckTimer > 0.35 || this.phase3DashElapsed > 2.2;
                        if (!failed) {
                            this.x = this.dashTarget.x;
                            this.y = this.dashTarget.y;
                        } else {
                            this.phase3DashPath = [];
                        }
                        this.finishPhase3WebTrail({ x: this.x, y: this.y });
                        this.phase3DashStart = null;
                        this.phase3DashElapsed = 0;
                        this.phase3DashStuckTimer = 0;
                        this.phase3DashLastPosition = null;

                        if (!failed && Array.isArray(this.phase3DashPath) && this.phase3DashPath.length > 0) {
                            this.phase3DashStart = { x: this.x, y: this.y };
                            if (this.phase3DashVisitedPoints) {
                                this.phase3DashVisitedPoints.push({ x: this.x, y: this.y });
                            }
                            this.dashTarget = this.phase3DashPath.shift();
                            return;
                        }

                        this.isDashing = false;
                        this.dashTarget = null;

                        // Fire barrage on arrival
                        if (!isClient) {
                            this.phase3HornetCrossfire(player);
                            // Screen shake on impact
                            if (typeof Game !== 'undefined') {
                                Game.triggerScreenShake(5, 0.2, 'boss');
                            }
                        }

                        this.dashCount++;
                        if (this.dashCount >= this.maxDashes) {
                            if (!this.finalExplosionTriggered && !isClient) {
                                this.explosiveFinale();
                                this.finalExplosionTriggered = true;
                            }
                            this.phase3State = 'exhausted';
                            this.exhaustedTimer = 0;
                            this.dashCount = 0;
                        }
                    } else {
                        const moveDist = this.dashSpeed * deltaTime;
                        let nextX = this.x;
                        let nextY = this.y;
                        if (moveDist >= dist) {
                            nextX = this.dashTarget.x;
                            nextY = this.dashTarget.y;
                        } else {
                            nextX += (dx / dist) * moveDist;
                            nextY += (dy / dist) * moveDist;
                        }

                        const layout = currentRoom && currentRoom.layout ? currentRoom.layout : null;
                        const clearance = this.getPhase3DashClearanceRadius();
                        if (layout) {
                            const resolved = RoomLayoutGenerator.resolveCircleCollision(
                                layout,
                                nextX,
                                nextY,
                                clearance,
                                this.x,
                                this.y
                            );
                            if (resolved.collided) {
                                this.x = resolved.x;
                                this.y = resolved.y;
                                this.phase3DashPath = [];
                                this.isDashing = false;
                                this.dashTarget = null;
                                this.finishPhase3WebTrail({ x: this.x, y: this.y });

                                if (typeof Game !== 'undefined') {
                                    Game.triggerScreenShake(12, 0.35, 'boss');
                                }
                                if (typeof GameAudio !== 'undefined' && GameAudio.sounds && GameAudio.sounds.enemySlam) {
                                    GameAudio.sounds.enemySlam();
                                }

                                this.dashCount++;
                                if (this.dashCount >= this.maxDashes) {
                                    if (!this.finalExplosionTriggered && !isClient) {
                                        this.explosiveFinale();
                                        this.finalExplosionTriggered = true;
                                    }
                                    this.phase3State = 'exhausted';
                                    this.exhaustedTimer = 0;
                                    this.dashCount = 0;
                                }
                                return;
                            }
                        }

                        this.x = nextX;
                        this.y = nextY;
                        this.updatePhase3WebTrail({ x: this.x, y: this.y });
                    }
                } else {
                    this.isDashing = false;
                }
            } else {
                // Not dashing, prepare next dash
                if (!this.activeTelegraph && !isClient) {
                    this.preparePhase3NestDash(player);
                    this.nestPulseMarkers.push({
                        x: this.phase3DashFinalTarget ? this.phase3DashFinalTarget.x : this.dashTarget.x,
                        y: this.phase3DashFinalTarget ? this.phase3DashFinalTarget.y : this.dashTarget.y,
                        elapsed: 0,
                        duration: 0.55,
                        warning: true
                    });

                    // Start telegraph
                    this.beginTelegraph('dash', {
                        duration: 0.55,
                        intensity: 1.0,
                        color: '#ff0000',
                        onEnd: (t, owner, cancelled) => {
                            if (!cancelled) {
                                owner.beginPhase3WebTrail({ x: owner.x, y: owner.y });
                                owner.isDashing = true;
                            }
                        }
                    });
                }
            }
        } else if (this.phase3State === 'exhausted') {
            // Stop moving and rotating
            this.rotationSpeed = Math.PI * 0.5; // Slow rotation
            this.spikeExtension = -0.45;

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

        // Keep in bounds
        this.keepInBounds();
    }

    keepInBounds() {
        if (this.phase3State === 'franticBarrage' && this.isDashing) {
            if (typeof currentRoom !== 'undefined' && currentRoom && currentRoom.layout && typeof RoomLayoutGenerator !== 'undefined') {
                const clearance = this.getPhase3DashClearanceRadius();
                this.x = clamp(this.x, clearance, currentRoom.width - clearance);
                this.y = clamp(this.y, clearance, currentRoom.height - clearance);
                if (RoomLayoutGenerator.isPointWalkable(currentRoom.layout, this.x, this.y, clearance)) {
                    this.lastSafeX = this.x;
                    this.lastSafeY = this.y;
                } else {
                    const resolved = RoomLayoutGenerator.resolveCircleCollision(
                        currentRoom.layout,
                        this.x,
                        this.y,
                        clearance,
                        this.lastSafeX || this.x,
                        this.lastSafeY || this.y
                    );
                    this.x = resolved.x;
                    this.y = resolved.y;
                }
                return;
            }
        }
        super.keepInBounds();
    }

    selectPhase3NestDashTarget(player) {
        const hives = this.getBossArenaAnchors('swarmNest');
        const layout = currentRoom && currentRoom.layout ? currentRoom.layout : null;
        const clearance = this.getPhase3DashClearanceRadius();
        const targetPlayer = player || { x: this.x, y: this.y, vx: 0, vy: 0 };
        const predictedX = targetPlayer.x + (Number.isFinite(targetPlayer.vx) ? targetPlayer.vx * 0.35 : 0);
        const predictedY = targetPlayer.y + (Number.isFinite(targetPlayer.vy) ? targetPlayer.vy * 0.35 : 0);
        
        if (layout) {
            let bestTarget = null;
            let bestScore = -Infinity;
            for (let i = 0; i < 32; i++) {
                const angle = (i / 32) * Math.PI * 2;
                const dist = 140 + Math.random() * 180;
                const cx = predictedX + Math.cos(angle) * dist;
                const cy = predictedY + Math.sin(angle) * dist;
                
                if (RoomLayoutGenerator.isPointWalkable(layout, cx, cy, clearance)) {
                    let farFromHives = true;
                    let minHiveDist = Infinity;
                    for (let h = 0; h < hives.length; h++) {
                        const distToHive = Math.hypot(cx - hives[h].x, cy - hives[h].y);
                        if (distToHive < minHiveDist) minHiveDist = distToHive;
                        if (distToHive < 120) {
                            farFromHives = false;
                            break;
                        }
                    }
                    if (farFromHives) {
                        const distToBoss = Math.hypot(cx - this.x, cy - this.y);
                        if (distToBoss > this.size * 1.5) {
                            const lineDist = this.distanceToSegment(predictedX, predictedY, this.x, this.y, cx, cy);
                            const score = -lineDist * 2.0 + minHiveDist * 0.5;
                            if (score > bestScore) {
                                bestScore = score;
                                bestTarget = { x: cx, y: cy };
                            }
                        }
                    }
                }
            }
            if (bestTarget) return bestTarget;
        }
        
        const angleToPlayer = Math.atan2(predictedY - this.y, predictedX - this.x);
        return this.findSafeBossPosition(
            predictedX + Math.cos(angleToPlayer) * 120,
            predictedY + Math.sin(angleToPlayer) * 120
        );
    }

    preparePhase3NestDash(player) {
        const start = { x: this.x, y: this.y };
        let finalTarget = null;
        let route = null;
        const clearance = this.getPhase3DashClearanceRadius();
        
        for (let attempt = 0; attempt < 10; attempt++) {
            finalTarget = this.selectPhase3NestDashTarget(player);
            const tempRoute = this.buildCollisionAwarePheromoneRoute([start, finalTarget], clearance)
                .map(point => ({ x: point.x, y: point.y }));
            
            if (tempRoute && tempRoute.length >= 2) {
                const lastPoint = tempRoute[tempRoute.length - 1];
                const distToFinal = Math.hypot(lastPoint.x - finalTarget.x, lastPoint.y - finalTarget.y);
                if (distToFinal < 40) {
                    route = tempRoute;
                    break;
                }
            }
        }
        
        if (!route) {
            finalTarget = player ? { x: player.x, y: player.y } : { x: this.x, y: this.y };
            route = [start, finalTarget];
        }

        const path = route.slice(1);
        this.phase3DashStart = start;
        this.phase3DashFinalTarget = finalTarget;
        this.dashTarget = path.shift() || finalTarget;
        this.phase3DashPath = path;
        this.phase3DashElapsed = 0;
        this.phase3DashStuckTimer = 0;
        this.phase3DashLastPosition = null;
    }

    getPhase3DashClearanceRadius() {
        return Math.max(42, this.size * 0.85);
    }

    beginPhase3WebTrail(start) {
        if (!start) return;
        this.phase3DashVisitedPoints = [{ x: start.x, y: start.y }];
        const trail = {
            id: `swarmWeb-${this.pheromoneSequenceId++}`,
            points: [
                { x: start.x, y: start.y },
                { x: start.x, y: start.y }
            ],
            elapsed: 0,
            windupDuration: 0,
            buildDelay: 0,
            segmentRevealInterval: 0,
            activeDuration: 6.75,
            fadeDuration: 1.5,
            duration: 8.25,
            alpha: 1,
            webTrail: true,
            liveTrail: true,
            visualWidth: 42,
            lane: this.dashCount
        };
        this.pheromoneTrails.push(trail);
        while (this.pheromoneTrails.length > 8) {
            const removed = this.pheromoneTrails.shift();
            if (removed === this.activePhase3WebTrail) {
                this.activePhase3WebTrail = null;
            }
        }
        this.activePhase3WebTrail = trail;
        this.nestPulseMarkers.push({
            x: start.x,
            y: start.y,
            elapsed: 0,
            duration: 0.9
        });
    }

    updatePhase3WebTrail(pos) {
        const trail = this.activePhase3WebTrail;
        if (!trail || !pos || !Array.isArray(trail.points) || !Array.isArray(this.phase3DashVisitedPoints)) return;
        const pts = this.phase3DashVisitedPoints.map(p => ({ x: p.x, y: p.y }));
        pts.push({ x: pos.x, y: pos.y });
        trail.points = pts;
    }

    finishPhase3WebTrail(end) {
        const trail = this.activePhase3WebTrail;
        if (!trail) return;
        const pts = (this.phase3DashVisitedPoints || []).map(p => ({ x: p.x, y: p.y }));
        if (end) {
            pts.push({ x: end.x, y: end.y });
        }
        trail.points = pts;
        trail.liveTrail = false;
        this.activePhase3WebTrail = null;
        if (end) {
            this.nestPulseMarkers.push({
                x: end.x,
                y: end.y,
                elapsed: 0,
                duration: 0.9
            });
            if (typeof createParticleBurst !== 'undefined') {
                createParticleBurst(end.x, end.y, '#b7ff39', 12);
            }
        }
    }

    paintPhase3WebTrail(start, end) {
        this.beginPhase3WebTrail(start);
        this.finishPhase3WebTrail(end);
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
        const volleySeed = this.swarmVolleySequence++;
        const phaseOffset = (this.phase - 1) * 0.11 + (volleySeed % 3) * 0.07;
        for (let i = 0; i < 8; i++) {
            const organicWave = Math.sin(volleySeed * 0.9 + i * 1.7) * 0.12;
            const angle = this.rotationAngle + phaseOffset + (Math.PI * 2 / 8) * i + organicWave;
            const speed = projectileSpeed * (0.94 + (i % 3) * 0.04);
            Game.projectiles.push({
                x: this.x,
                y: this.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                damage: this.damage * 0.8,
                size: 7 + (i % 3),
                lifetime: 5.0, // Increased from 3.0 to cover room
                elapsed: 0,
                color: i % 2 === 0 ? '#ffb000' : '#d9ff55',
                trailLength: 4
            });
        }
    }

    phase3HornetCrossfire(player) {
        if (typeof Game === 'undefined') return;
        const target = player || { x: this.x + 1, y: this.y };
        const baseAngle = Math.atan2(target.y - this.y, target.x - this.x);
        const sequence = this.phase3BurstSequence++;
        const ringCount = 10;
        const ringOffset = (sequence % 2) * (Math.PI / ringCount);
        for (let i = 0; i < ringCount; i++) {
            const angle = ringOffset + (Math.PI * 2 / ringCount) * i + Math.sin(i * 1.4 + sequence) * 0.05;
            const speed = 210 + (i % 2) * 28;
            Game.projectiles.push({
                x: this.x,
                y: this.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                damage: this.damage * 0.72,
                size: 7,
                lifetime: 3.2,
                elapsed: 0,
                color: '#d9ff55',
                trailLength: 4
            });
        }

        const sideAngles = [-0.38, 0.38];
        sideAngles.forEach((offset, sideIndex) => {
            for (let i = 0; i < 4; i++) {
                const angle = baseAngle + offset + (i - 1.5) * 0.075;
                const speed = 285 + i * 18 + sideIndex * 14;
                Game.projectiles.push({
                    x: this.x + Math.cos(angle) * 28,
                    y: this.y + Math.sin(angle) * 28,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    damage: this.damage * 0.82,
                    size: 8,
                    lifetime: 2.8,
                    elapsed: 0,
                    color: sideIndex === 0 ? '#ffb000' : '#f1ff6b',
                    trailLength: 5
                });
            }
        });

        if (typeof createParticleBurst !== 'undefined') {
            createParticleBurst(this.x, this.y, '#d9ff55', 14);
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

    updatePheromoneTrails(deltaTime) {
        this.pheromoneTrails.forEach(trail => {
            trail.elapsed += deltaTime;
            const activeEnd = (trail.windupDuration || 0) + (trail.activeDuration || 0);
            trail.alpha = Math.max(0, 1 - Math.max(0, trail.elapsed - activeEnd) / Math.max(0.1, trail.fadeDuration));
        });
        this.pheromoneTrails = this.pheromoneTrails.filter(trail => trail.elapsed < trail.duration);
        this.nestPulseMarkers.forEach(marker => {
            marker.elapsed += deltaTime;
        });
        this.nestPulseMarkers = this.nestPulseMarkers.filter(marker => marker.elapsed < (marker.duration || 1) + (marker.delay || 0));
    }

    startPheromoneCircuit(player) {
        const anchors = this.getWalkableArenaAnchors('swarmNest', 22, player || { x: this.x, y: this.y });
        if (!anchors || anchors.length < 2) {
            this.spawnMinions();
            return;
        }

        const phaseConfig = this.getPheromonePhaseConfig();
        const maxTrails = Math.max(phaseConfig.trailCount, this.phase >= 3 ? 3 : 2);

        const routes = [];
        for (let lane = 0; lane < phaseConfig.trailCount; lane++) {
            const route = this.buildCollisionAwarePheromoneRoute(this.selectPheromoneRoute(anchors, player, lane));
            if (route && route.length >= 2) {
                routes.push(route);
            }
        }
        if (routes.length === 0) {
            this.spawnMinions();
            return;
        }

        while (this.pheromoneTrails.length > Math.max(0, maxTrails - routes.length)) {
            this.pheromoneTrails.shift();
        }

        const availableSlots = Math.max(0, Math.min(this.maxMinions || 8, this.getPhaseMinionCap()) - this.minions.length);
        const runnerBudget = Math.min(availableSlots, phaseConfig.runnerBudget);
        routes.forEach((route, lane) => {
            const trail = {
                id: `swarmTrail-${this.pheromoneSequenceId++}`,
                points: route.map(point => ({
                    x: point.walkableX !== undefined ? point.walkableX : point.x,
                    y: point.walkableY !== undefined ? point.walkableY : point.y
                })),
                elapsed: 0,
                windupDuration: phaseConfig.windupDuration + lane * 0.08,
                buildDelay: phaseConfig.buildDelay + lane * 0.08,
                segmentRevealInterval: phaseConfig.segmentRevealInterval,
                activeDuration: phaseConfig.activeDuration,
                fadeDuration: 1.1,
                duration: phaseConfig.windupDuration + lane * 0.08 + phaseConfig.activeDuration + 1.1,
                alpha: 1,
                runnerSpeed: phaseConfig.runnerSpeed + lane * 18,
                visualWidth: phaseConfig.visualWidth,
                lane,
                routeComplete: false
            };
            this.pheromoneTrails.push(trail);
            this.nestPulseMarkers.push(...trail.points.map((point, pointIndex) => ({
                x: point.x,
                y: point.y,
                elapsed: 0,
                duration: 1.0,
                delay: trail.buildDelay + trail.segmentRevealInterval * Math.max(0, pointIndex - 1)
            })));
            if (typeof createParticleBurst !== 'undefined') {
                createParticleBurst(trail.points[0].x, trail.points[0].y, '#b7ff39', lane === 0 ? 8 : 5);
            }
            const remainingBudget = Math.max(0, runnerBudget - (this.minions.length - (Math.min(this.maxMinions || 8, this.getPhaseMinionCap()) - availableSlots)));
            const remainingLanes = Math.max(1, routes.length - lane);
            const laneRunners = Math.max(1, Math.ceil(remainingBudget / remainingLanes));
            this.spawnMinions({
                trail,
                forcePheromoneSpawn: true,
                suppressSummonCooldown: true,
                maxTrailRunners: laneRunners
            });
        });
        if (typeof Game !== 'undefined') {
            Game.triggerScreenShake(3 + Math.min(2, routes.length - 1), 0.18, 'boss');
        }
        if (typeof GameAudio !== 'undefined' && GameAudio.sounds && GameAudio.sounds.swarmPheromoneWindup) {
            GameAudio.sounds.swarmPheromoneWindup();
        }
        this.summonGlobalCooldown = this.getSummonGlobalCooldown();
        this.pheromoneCooldown = phaseConfig.cooldown;
    }

    selectPheromoneRoute(anchors, player, laneIndex = 0) {
        const anchorX = anchor => anchor.walkableX !== undefined ? anchor.walkableX : anchor.x;
        const anchorY = anchor => anchor.walkableY !== undefined ? anchor.walkableY : anchor.y;
        const target = player || { x: this.x, y: this.y, vx: 0, vy: 0 };
        const sortedByPlayer = anchors.slice().sort((a, b) => {
            const ad = Math.hypot(anchorX(a) - target.x, anchorY(a) - target.y);
            const bd = Math.hypot(anchorX(b) - target.x, anchorY(b) - target.y);
            return ad - bd;
        });
        const entryPool = sortedByPlayer.slice(0, Math.min(3, sortedByPlayer.length));
        const entry = entryPool[(Math.floor(Math.random() * entryPool.length) + laneIndex) % entryPool.length];
        const exitPool = sortedByPlayer
            .filter(anchor => anchor !== entry)
            .sort((a, b) => Math.hypot(anchorX(b) - anchorX(entry), anchorY(b) - anchorY(entry)) - Math.hypot(anchorX(a) - anchorX(entry), anchorY(a) - anchorY(entry)))
            .slice(0, Math.min(3, Math.max(1, sortedByPlayer.length - 1)));
        const exit = exitPool[(Math.floor(Math.random() * exitPool.length) + laneIndex) % exitPool.length] || sortedByPlayer.find(anchor => anchor !== entry);
        if (!entry || !exit) return sortedByPlayer.slice(0, 2);

        const pressurePoints = this.buildPheromonePressurePoints(entry, exit, target, laneIndex);
        const sceneryBridge = anchors
            .filter(anchor => anchor !== entry && anchor !== exit)
            .sort((a, b) => {
                const ax = anchorX(a);
                const ay = anchorY(a);
                const bx = anchorX(b);
                const by = anchorY(b);
                const aToPlayer = Math.hypot(ax - target.x, ay - target.y);
                const bToPlayer = Math.hypot(bx - target.x, by - target.y);
                const aToLine = this.distanceToSegment(ax, ay, anchorX(entry), anchorY(entry), anchorX(exit), anchorY(exit));
                const bToLine = this.distanceToSegment(bx, by, anchorX(entry), anchorY(entry), anchorX(exit), anchorY(exit));
                return (aToPlayer + aToLine * 0.45) - (bToPlayer + bToLine * 0.45);
            })[0];

        const route = [entry, pressurePoints[0]];
        if (this.phase >= 2 && sceneryBridge) route.push(sceneryBridge);
        if (this.phase >= 3 && pressurePoints[1]) route.push(pressurePoints[1]);
        route.push(exit);
        return this.dedupePheromoneRoute(route);
    }

    getPheromonePhaseConfig() {
        if (this.phase >= 3) {
            return { windupDuration: 1.15, buildDelay: 0.32, segmentRevealInterval: 0.14, activeDuration: 4.45, runnerSpeed: 410, cooldown: 4.0, trailCount: 3, runnerBudget: 7, visualWidth: 34 };
        }
        if (this.phase >= 2) {
            return { windupDuration: 1.25, buildDelay: 0.38, segmentRevealInterval: 0.16, activeDuration: 3.8, runnerSpeed: 335, cooldown: 5.2, trailCount: 2, runnerBudget: 4, visualWidth: 30 };
        }
        return { windupDuration: 1.45, buildDelay: 0.48, segmentRevealInterval: 0.2, activeDuration: 3.35, runnerSpeed: 285, cooldown: 6.4, trailCount: 1, runnerBudget: 2, visualWidth: 24 };
    }

    buildPheromonePressurePoints(entry, exit, player, laneIndex = 0) {
        const getX = point => point.walkableX !== undefined ? point.walkableX : point.x;
        const getY = point => point.walkableY !== undefined ? point.walkableY : point.y;
        const entryX = getX(entry);
        const entryY = getY(entry);
        const exitX = getX(exit);
        const exitY = getY(exit);
        const playerVx = Number.isFinite(player.vx) ? player.vx : 0;
        const playerVy = Number.isFinite(player.vy) ? player.vy : 0;
        const predictedX = player.x + playerVx * 0.35;
        const predictedY = player.y + playerVy * 0.35;
        const approachAngle = Math.atan2(player.y - entryY, player.x - entryX);
        const side = (this.pheromoneSequenceId + laneIndex) % 2 === 0 ? 1 : -1;
        const sideOffset = (55 + Math.random() * 65) * side;
        const forwardOffset = 35 + Math.random() * 45;
        const first = this.resolvePheromonePoint(
            predictedX + Math.cos(approachAngle) * forwardOffset + Math.cos(approachAngle + Math.PI / 2) * sideOffset,
            predictedY + Math.sin(approachAngle) * forwardOffset + Math.sin(approachAngle + Math.PI / 2) * sideOffset,
            player
        );
        const exitAngle = Math.atan2(exitY - player.y, exitX - player.x);
        const second = this.resolvePheromonePoint(
            player.x + Math.cos(exitAngle) * (120 + Math.random() * 80) - Math.cos(exitAngle + Math.PI / 2) * sideOffset * 0.65,
            player.y + Math.sin(exitAngle) * (120 + Math.random() * 80) - Math.sin(exitAngle + Math.PI / 2) * sideOffset * 0.65,
            player
        );
        return [first, second].filter(Boolean);
    }

    resolvePheromonePoint(x, y, preferredFrom) {
        const context = this.getCurrentBossLayout();
        const width = context && context.layout && context.layout.width ? context.layout.width : 2400;
        const height = context && context.layout && context.layout.height ? context.layout.height : 1350;
        const margin = Math.max(32, this.size * 0.35);
        const anchor = {
            x: Math.max(margin, Math.min(width - margin, x)),
            y: Math.max(margin, Math.min(height - margin, y)),
            radius: 24,
            motif: 'swarmPressure'
        };
        return this.resolveAnchorToWalkable(anchor, 22, preferredFrom || { x: this.x, y: this.y });
    }

    dedupePheromoneRoute(route) {
        const cleaned = [];
        route.filter(Boolean).forEach(point => {
            const x = point.walkableX !== undefined ? point.walkableX : point.x;
            const y = point.walkableY !== undefined ? point.walkableY : point.y;
            const previous = cleaned[cleaned.length - 1];
            const px = previous && (previous.walkableX !== undefined ? previous.walkableX : previous.x);
            const py = previous && (previous.walkableY !== undefined ? previous.walkableY : previous.y);
            if (!previous || Math.hypot(x - px, y - py) > 70) {
                cleaned.push(point);
            }
        });
        return cleaned.length >= 2 ? cleaned : route.filter(Boolean).slice(0, 2);
    }

    buildCollisionAwarePheromoneRoute(route, radius = 20) {
        if (!Array.isArray(route) || route.length < 2) return route;
        const context = this.getCurrentBossLayout();
        const layout = context && context.layout ? context.layout : null;
        if (!layout || typeof RoomLayoutGenerator === 'undefined') {
            return this.dedupePheromoneRoute(route);
        }
        const getPoint = point => ({
            x: point.walkableX !== undefined ? point.walkableX : point.x,
            y: point.walkableY !== undefined ? point.walkableY : point.y
        });
        const resolved = [getPoint(route[0])];
        for (let i = 0; i < route.length - 1; i++) {
            const from = getPoint(route[i]);
            const to = getPoint(route[i + 1]);
            if (this.isPheromoneSegmentClear(from, to, radius)) {
                resolved.push(to);
                continue;
            }
            let path = RoomLayoutGenerator.findPath(layout, from, to, radius, {
                maxVisited: 900,
                maxPathLength: 48
            });
            if (!path || path.length < 2) {
                path = RoomLayoutGenerator.findPath(layout, from, to, Math.max(12, radius * 0.6), {
                    maxVisited: 900,
                    maxPathLength: 48
                });
            }
            if (path && path.length >= 2) {
                path.slice(1).forEach(point => resolved.push({ x: point.x, y: point.y }));
            } else {
                const fallback = this.resolvePheromonePoint(to.x, to.y, from);
                resolved.push({
                    x: fallback.walkableX !== undefined ? fallback.walkableX : fallback.x,
                    y: fallback.walkableY !== undefined ? fallback.walkableY : fallback.y
                });
            }
        }
        return this.dedupePheromoneRoute(resolved);
    }

    isPheromoneSegmentClear(from, to, radius = 20) {
        const context = this.getCurrentBossLayout();
        const layout = context && context.layout ? context.layout : null;
        if (!layout || typeof RoomLayoutGenerator === 'undefined') return true;
        if (typeof RoomLayoutGenerator.isProjectilePathClear === 'function') {
            return RoomLayoutGenerator.isProjectilePathClear(layout, from, to, radius);
        }
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const steps = Math.max(2, Math.ceil(Math.hypot(dx, dy) / 36));
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            if (!RoomLayoutGenerator.isPointWalkable(layout, from.x + dx * t, from.y + dy * t, radius)) {
                return false;
            }
        }
        return true;
    }

    distanceToSegment(px, py, ax, ay, bx, by) {
        return Engine.Physics.Geometry.distancePointToSegment(px, py, ax, ay, bx, by);
    }

    updatePheromoneMinions(deltaTime) {
        this.minions.forEach(minion => {
            const runner = minion && minion.pheromoneRunner;
            if (!runner || !runner.trail || !Array.isArray(runner.trail.points)) return;
            if (runner.exiting) {
                this.updatePheromoneExit(minion, runner, deltaTime);
                return;
            }
            if ((runner.trail.elapsed || 0) < (runner.trail.windupDuration || 0)) {
                if (runner.startPoint) {
                    minion.pheromoneControlled = true;
                    minion.ignoreSceneryCollision = true;
                    minion.x = runner.startPoint.x;
                    minion.y = runner.startPoint.y;
                    minion.vx = 0;
                    minion.vy = 0;
                }
                return;
            }
            const activeEnd = (runner.trail.windupDuration || 0) + (runner.trail.activeDuration || 0);
            if (!minion.alive || runner.routeComplete || runner.trail.elapsed >= activeEnd) {
                this.startPheromoneExit(minion, runner);
                return;
            }
            const points = runner.trail.points;
            const target = points[Math.min(runner.segmentIndex + 1, points.length - 1)];
            if (!target) {
                this.startPheromoneExit(minion, runner);
                return;
            }
            const dx = target.x - minion.x;
            const dy = target.y - minion.y;
            const dist = Math.hypot(dx, dy);
            if (dist < 12) {
                if (runner.segmentIndex >= points.length - 2) {
                    runner.routeComplete = true;
                    this.startPheromoneExit(minion, runner);
                } else {
                    runner.segmentIndex++;
                }
                return;
            }
            const speed = runner.speed || runner.trail.runnerSpeed || 300;
            const step = Math.min(dist, speed * deltaTime);
            minion.pheromoneControlled = true;
            minion.ignoreSceneryCollision = true;
            minion.rotation = Math.atan2(dy, dx);
            minion.movementHeading = minion.rotation;
            minion.x += (dx / dist) * step;
            minion.y += (dy / dist) * step;
            minion.vx = (dx / dist) * speed;
            minion.vy = (dy / dist) * speed;
        });
    }

    startPheromoneExit(minion, runner) {
        if (!minion || !runner) return;
        if (!minion.alive) {
            this.finishPheromoneRelease(minion);
            return;
        }
        const exitPath = this.getPheromoneExitPath(minion, runner);
        if (exitPath.length > 0) {
            runner.exiting = true;
            runner.exitPoints = exitPath;
            runner.exitIndex = 0;
            minion.pheromoneControlled = true;
            minion.ignoreSceneryCollision = true;
            return;
        }
        this.finishPheromoneRelease(minion);
    }

    getPheromoneExitPath(minion, runner) {
        const context = this.getCurrentBossLayout();
        const layout = context && context.layout ? context.layout : null;
        const radius = Math.max(10, minion.size || 14);
        if (!layout || typeof RoomLayoutGenerator === 'undefined') return [];
        const current = { x: minion.x, y: minion.y };
        if (RoomLayoutGenerator.isPointWalkable(layout, current.x, current.y, radius)) return [];
        const exitAnchor = this.resolveAnchorToWalkable({
            x: current.x,
            y: current.y,
            radius,
            motif: 'swarmExit'
        }, radius, runner.startPoint || { x: this.x, y: this.y });
        const exit = {
            x: exitAnchor.walkableX !== undefined ? exitAnchor.walkableX : exitAnchor.x,
            y: exitAnchor.walkableY !== undefined ? exitAnchor.walkableY : exitAnchor.y
        };
        const path = RoomLayoutGenerator.findPath(layout, current, exit, radius, {
            maxVisited: 420,
            maxPathLength: 18
        });
        return path && path.length > 0
            ? path.map(point => ({ x: point.x, y: point.y }))
            : [exit];
    }

    updatePheromoneExit(minion, runner, deltaTime) {
        const points = runner.exitPoints || [];
        const target = points[runner.exitIndex || 0];
        if (!target) {
            this.finishPheromoneRelease(minion);
            return;
        }
        const dx = target.x - minion.x;
        const dy = target.y - minion.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 10) {
            runner.exitIndex = (runner.exitIndex || 0) + 1;
            if (runner.exitIndex >= points.length) {
                this.finishPheromoneRelease(minion);
            }
            return;
        }
        const speed = Math.max(120, (runner.speed || runner.trail.runnerSpeed || 300) * 0.75);
        const step = Math.min(dist, speed * deltaTime);
        minion.pheromoneControlled = true;
        minion.ignoreSceneryCollision = true;
        minion.rotation = Math.atan2(dy, dx);
        minion.movementHeading = minion.rotation;
        minion.x += (dx / dist) * step;
        minion.y += (dy / dist) * step;
        minion.vx = (dx / dist) * speed;
        minion.vy = (dy / dist) * speed;
    }

    finishPheromoneRelease(minion) {
        if (!minion) return;
        minion.pheromoneControlled = false;
        minion.ignoreSceneryCollision = false;
        minion.pheromoneRunner = null;
        minion.vx = 0;
        minion.vy = 0;
        if (typeof minion.keepInBounds === 'function') {
            minion.keepInBounds();
        }
    }

    damagePlayersAlongPheromoneTrails(deltaTime) {
        const isClient = typeof Game !== 'undefined' && Game.isMultiplayerClient && Game.isMultiplayerClient();
        if (isClient || !this.pheromoneTrails.length) return;
        const targets = [];
        if (typeof this.getAllAlivePlayers === 'function') {
            this.getAllAlivePlayers().forEach(entry => {
                if (entry && entry.player) targets.push(entry.player);
            });
        } else if (typeof Game !== 'undefined' && Game.player) {
            targets.push(Game.player);
        }
        if (!targets.length) return;
        const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        this.pheromoneTrails.forEach(trail => {
            if (!trail || !Array.isArray(trail.points) || trail.points.length < 2) return;
            if ((trail.elapsed || 0) < (trail.windupDuration || 0)) return;
            if ((trail.elapsed || 0) >= (trail.windupDuration || 0) + (trail.activeDuration || 0)) return;
            const width = trail.webTrail ? 28 : 22;
            targets.forEach(target => {
                if (!target || target.alive === false || target.dead) return;
                if (target.lastSwarmTrailHitAt && now - target.lastSwarmTrailHitAt < 420) return;
                for (let i = 0; i < trail.points.length - 1; i++) {
                    const a = trail.points[i];
                    const b = trail.points[i + 1];
                    const dist = this.distanceToSegment(target.x, target.y, a.x, a.y, b.x, b.y);
                    if (dist <= width + (target.size || 18)) {
                        if (typeof target.takeDamage === 'function') {
                            target.takeDamage(this.damage * (trail.webTrail ? 0.35 : 0.22));
                        }
                        target.lastSwarmTrailHitAt = now;
                        break;
                    }
                }
            });
        });
    }

    // Spawn orbiting minions
    spawnMinions(options = {}) {
        if (typeof Game === 'undefined' || typeof currentRoom === 'undefined') return;

        const maxTotal = this.maxMinions || 8;
        const phaseCap = Math.min(maxTotal, this.getPhaseMinionCap());
        const availableSlots = Math.max(0, phaseCap - this.minions.length);
        const forcedPheromoneSpawn = !!(options.trail && options.forcePheromoneSpawn);
        if (availableSlots <= 0 || (!forcedPheromoneSpawn && this.summonGlobalCooldown > 0)) return;

        const desiredCount = this.phase === 1 ? 2 + Math.floor(Math.random() * 2) :
            this.phase === 2 ? 3 + Math.floor(Math.random() * 2) :
                5 + Math.floor(Math.random() * 2);

        const trailLimit = options.trail
            ? (options.maxTrailRunners || (this.phase >= 3 ? 5 : this.phase >= 2 ? 4 : 3))
            : 3;
        const spawnCount = Math.min(availableSlots, trailLimit, desiredCount);
        if (spawnCount <= 0) return;

        for (let i = 0; i < spawnCount; i++) {
            const routePoint = options.trail && options.trail.points && options.trail.points.length
                ? options.trail.points[i % options.trail.points.length]
                : null;
            const angle = (Math.PI * 2 / spawnCount) * i;
            const distance = 150 + Math.random() * 50;
            const minionX = routePoint ? routePoint.x : this.x + Math.cos(angle) * distance;
            const minionY = routePoint ? routePoint.y : this.y + Math.sin(angle) * distance;

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
            if (options.trail) {
                minion.pheromoneRunner = {
                    trail: options.trail,
                    segmentIndex: i % Math.max(1, options.trail.points.length - 1),
                    startPoint: { x: minionX, y: minionY },
                    speed: options.trail.runnerSpeed || (minion.moveSpeed || 120) * 2.5,
                    routeComplete: false
                };
                minion.pheromoneControlled = true;
                minion.ignoreSceneryCollision = true;
                minion.activated = true;
            }

            if (currentRoom) {
                currentRoom.enemies.push(minion);
            }
            if (Game.enemies) {
                Game.enemies.push(minion);
            }
            this.minions.push(minion);
        }

        if (!options.suppressSummonCooldown) {
            this.summonGlobalCooldown = this.getSummonGlobalCooldown();
        }
    }

    // Spike slam creating shockwave
    spikeSlam() {
        this.createShockwave(this.x, this.y, 145, 0.42, this.damage * 0.9);
        this.createResinPuddle(this.x, this.y, 130, 3.4);
        const anchors = this.getBossArenaAnchors('swarmNest');
        anchors
            .slice()
            .sort((a, b) => Math.hypot(a.x - this.x, a.y - this.y) - Math.hypot(b.x - this.x, b.y - this.y))
            .slice(0, this.phase >= 2 ? 2 : 1)
            .forEach(anchor => this.createResinPuddle(anchor.x, anchor.y, 72, 2.5));

        // Screen shake
        if (typeof Game !== 'undefined') {
            Game.triggerScreenShake(6, 0.3, 'boss');
        }
    }

    createResinPuddle(x, y, radius, duration) {
        const puddle = {
            type: 'swarmResin',
            x,
            y,
            radius,
            maxRadius: radius,
            lifetime: duration,
            elapsed: 0,
            expired: false,
            damage: this.damage * 0.08,
            lastDamageTime: 0,
            update(deltaTime) {
                this.elapsed += deltaTime;
                if (this.elapsed >= this.lifetime) this.expired = true;
            },
            applyDamage(player) {
                if (!player || player.alive === false || player.dead) return false;
                const size = player.size || 18;
                const dx = player.x - this.x;
                const dy = player.y - this.y;
                const dist = Math.hypot(dx, dy);
                if (dist > this.radius + size) return false;
                if (Number.isFinite(player.vx)) player.vx *= 0.42;
                if (Number.isFinite(player.vy)) player.vy *= 0.42;
                if (dist > 1) {
                    const drag = Math.min(1.8, (this.radius - Math.min(this.radius, dist)) / Math.max(1, this.radius) * 2.2);
                    player.x -= (dx / dist) * drag;
                    player.y -= (dy / dist) * drag;
                }
                if (this.elapsed - this.lastDamageTime >= 0.65 && typeof player.takeDamage === 'function') {
                    player.takeDamage(this.damage);
                    this.lastDamageTime = this.elapsed;
                }
                return true;
            }
        };
        this.addEnvironmentalHazard(puddle);
        if (typeof createParticleBurst !== 'undefined') {
            createParticleBurst(x, y, '#ffb000', 16);
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
        this.swarmBeat = 'command';
        this.attackFired = false;
        if (this.activeTelegraph && typeof this.cancelTelegraph === 'function') {
            this.cancelTelegraph();
        }
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
            this.phase3WebAnchors = [];
            this.phase3WebIndex = 0;
            this.phase3DashStart = null;
            this.phase3DashPath = [];
            this.phase3DashFinalTarget = null;
            this.activePhase3WebTrail = null;
        }
        this.nestPulseMarkers.push(...this.getBossArenaAnchors('swarmNest').slice(0, 8).map(anchor => ({
            x: anchor.x,
            y: anchor.y,
            elapsed: 0,
            duration: 1.4
        })));
    }

    renderResinPuddles(ctx) {
        const puddles = this.environmentalHazards.filter(hazard => hazard && hazard.type === 'swarmResin' && !hazard.expired);
        if (!puddles.length) return;
        ctx.save();
        puddles.forEach(puddle => {
            const progress = Math.min(1, (puddle.elapsed || 0) / Math.max(0.01, puddle.lifetime || 1));
            const pulse = 0.5 + Math.sin((puddle.elapsed || 0) * 9) * 0.5;
            const alpha = Math.max(0, 1 - progress) * (0.34 + pulse * 0.14);
            if (alpha < 0.05) return;
            const radius = (puddle.radius || 80) * (0.82 + Math.min(1, progress * 4) * 0.18);
            const gradient = ctx.createRadialGradient(puddle.x, puddle.y, radius * 0.12, puddle.x, puddle.y, radius);
            gradient.addColorStop(0, `rgba(255, 237, 98, ${alpha * 0.95})`);
            gradient.addColorStop(0.55, `rgba(255, 162, 0, ${alpha * 0.82})`);
            gradient.addColorStop(1, 'rgba(255, 106, 0, 0)');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(puddle.x, puddle.y, radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = alpha * 0.7;
            ctx.strokeStyle = '#fff36b';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(puddle.x, puddle.y, radius * (0.72 + pulse * 0.08), 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 1;
        });
        ctx.restore();
    }

    renderPheromoneTrails(ctx) {
        if (!this.pheromoneTrails.length && !this.nestPulseMarkers.length) return;
        ctx.save();
        this.pheromoneTrails.forEach(trail => {
            if (!trail.points || trail.points.length < 2) return;
            const pulse = 0.5 + Math.sin((trail.elapsed || 0) * 10) * 0.5;
            const windup = trail.elapsed < (trail.windupDuration || 0);
            const visiblePoints = this.getVisiblePheromonePoints(trail);
            if (visiblePoints.length < 2) return;
            const windupProgress = Math.min(1, trail.elapsed / Math.max(0.01, trail.windupDuration || 0.65));
            const visualWidth = trail.visualWidth || (trail.webTrail ? 42 : 30);
            ctx.globalAlpha = Math.max(0, trail.alpha || 0) * (windup ? 0.2 + windupProgress * 0.26 : 0.45 + pulse * 0.18);
            ctx.strokeStyle = windup ? '#eaff7a' : (trail.webTrail ? '#ffef6b' : '#b7ff39');
            ctx.lineWidth = windup ? Math.max(14, visualWidth * 0.58) + windupProgress * Math.max(6, visualWidth * 0.35) : (trail.webTrail ? 42 : visualWidth);
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(visiblePoints[0].x, visiblePoints[0].y);
            for (let i = 1; i < visiblePoints.length; i++) {
                ctx.lineTo(visiblePoints[i].x, visiblePoints[i].y);
            }
            ctx.stroke();
            ctx.globalAlpha = Math.max(0, trail.alpha || 0) * 0.9;
            ctx.strokeStyle = windup ? '#ffffff' : (trail.webTrail ? '#ffffff' : '#f1ff6b');
            ctx.lineWidth = windup ? 4 : (trail.webTrail ? 10 : Math.max(5, visualWidth * 0.24));
            ctx.stroke();
            if (windup) {
                const head = visiblePoints[visiblePoints.length - 1];
                const headPulse = 0.75 + pulse * 0.25;
                ctx.globalAlpha = Math.max(0, trail.alpha || 0) * (0.55 + windupProgress * 0.3);
                ctx.fillStyle = trail.webTrail ? '#fff36b' : '#eaff7a';
                ctx.beginPath();
                ctx.arc(head.x, head.y, Math.max(7, visualWidth * 0.22) * headPulse, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = Math.max(0, trail.alpha || 0) * 0.28;
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(head.x, head.y, Math.max(14, visualWidth * 0.44) * headPulse, 0, Math.PI * 2);
                ctx.stroke();
            }
        });
        this.nestPulseMarkers.forEach(marker => {
            const progress = ((marker.elapsed || 0) - (marker.delay || 0)) / Math.max(0.01, marker.duration);
            if (progress < 0) return;
            const radius = marker.warning ? 44 + progress * 34 : 34 + progress * 54;
            ctx.globalAlpha = Math.max(0, 1 - progress) * (marker.warning ? 0.82 : 0.65);
            ctx.strokeStyle = marker.warning ? '#ff6b00' : '#d9ff55';
            ctx.lineWidth = marker.warning ? 5 : 4;
            ctx.beginPath();
            ctx.arc(marker.x, marker.y, radius, 0, Math.PI * 2);
            ctx.stroke();
        });
        ctx.restore();
    }

    getVisiblePheromonePoints(trail) {
        if (!trail || !Array.isArray(trail.points) || trail.points.length < 2) return [];
        if (trail.liveTrail || trail.webTrail) return trail.points;
        const windup = (trail.elapsed || 0) < (trail.windupDuration || 0);
        if (!windup) return trail.points;
        const buildDelay = trail.buildDelay || 0;
        const buildElapsed = (trail.elapsed || 0) - buildDelay;
        if (buildElapsed <= 0) return [];
        const interval = Math.max(0.05, trail.segmentRevealInterval || 0.16);
        const segmentCount = trail.points.length - 1;
        const drawProgress = Math.min(segmentCount, buildElapsed / interval);
        const completedSegments = Math.min(segmentCount - 1, Math.floor(drawProgress));
        const segmentProgress = Math.min(1, Math.max(0, drawProgress - completedSegments));
        const visiblePoints = trail.points.slice(0, completedSegments + 1);
        const from = trail.points[completedSegments];
        const to = trail.points[completedSegments + 1];
        visiblePoints.push({
            x: from.x + (to.x - from.x) * segmentProgress,
            y: from.y + (to.y - from.y) * segmentProgress
        });
        return visiblePoints;
    }

    traceStarBodyPath(ctx, visualSize, spikeLength, innerRadius, spikeCount) {
        ctx.beginPath();
        for (let i = 0; i < spikeCount; i++) {
            const outerAngle = (Math.PI * 2 / spikeCount) * i;
            const innerAngle = (Math.PI * 2 / spikeCount) * (i + 0.5);

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
    }

    render(ctx) {
        if (!this.alive) return;

        this.renderResinPuddles(ctx);
        this.renderPheromoneTrails(ctx);

        const isClient = typeof Game !== 'undefined' && Game.isMultiplayerClient && Game.isMultiplayerClient();
        const renderAngle = isClient && this.visualRotationAngle !== undefined
            ? this.visualRotationAngle
            : this.rotationAngle;

        const exhaustedPulse = this.phase3State === 'exhausted'
            ? (0.5 + Math.sin(this.exhaustedTimer * Math.PI * 7) * 0.5)
            : 0;
        let drawColor = exhaustedPulse > 0
            ? `rgb(255, ${Math.floor(210 + exhaustedPulse * 45)}, ${Math.floor(60 + exhaustedPulse * 120)})`
            : this.color;
        drawColor = typeof this.getFlashDrawColor === 'function'
            ? this.getFlashDrawColor(drawColor)
            : drawColor;

        const visualSize = this.size;
        const spikeLength = visualSize + (this.spikeExtension * this.maxSpikeExtension);
        const innerRadius = visualSize * 0.4;

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(renderAngle);
        ctx.fillStyle = drawColor;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        this.traceStarBodyPath(ctx, visualSize, spikeLength, innerRadius, this.spikeCount);
        ctx.fill();
        ctx.stroke();

        if (this.phase3State === 'exhausted') {
            ctx.globalAlpha = 0.35 + exhaustedPulse * 0.45;
            ctx.strokeStyle = '#fff36b';
            ctx.lineWidth = 4;
            for (let i = 0; i < this.spikeCount; i++) {
                const angle = (Math.PI * 2 / this.spikeCount) * i;
                ctx.beginPath();
                ctx.moveTo(Math.cos(angle) * visualSize * 0.38, Math.sin(angle) * visualSize * 0.38);
                ctx.lineTo(Math.cos(angle + 0.08) * visualSize * 0.96, Math.sin(angle + 0.08) * visualSize * 0.96);
                ctx.stroke();
            }
        }

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
            const telegraphTarget = this.phase3DashFinalTarget || this.dashTarget;
            const dx = telegraphTarget.x - this.x;
            const dy = telegraphTarget.y - this.y;
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
            const pulse = (Math.sin(this.exhaustedTimer * Math.PI * 5) + 1) / 2;
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
        if (this.phase3State === 'exhausted') {
            this.getBossArenaAnchors('swarmNest').slice(0, 10).forEach((anchor, index) => {
                const pulse = (Math.sin(this.exhaustedTimer * Math.PI * 4 + index) + 1) / 2;
                ctx.save();
                ctx.globalAlpha = 0.18 + pulse * 0.18;
                ctx.strokeStyle = '#fff36b';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(anchor.x, anchor.y, 28 + pulse * 16, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            });
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
            state: this.state,
            stateTimer: this.stateTimer,
            swarmBeat: this.swarmBeat,
            attackFired: this.attackFired,
            swarmVolleySequence: this.swarmVolleySequence,
            phase3BurstSequence: this.phase3BurstSequence,
            phase3State: this.phase3State,
            dashCount: this.dashCount,
            dashTarget: this.dashTarget,
            exhaustedTimer: this.exhaustedTimer,
            phase3WebIndex: this.phase3WebIndex,
            phase3DashStart: this.phase3DashStart,
            phase3DashPath: this.phase3DashPath,
            phase3DashFinalTarget: this.phase3DashFinalTarget,
            beamStateTimer: this.beamStateTimer,
            pendingBeamAngle: this.pendingBeamAngle,
            beamTelegraphAngle: this.beamTelegraphAngle,
            phase3BeamCooldown: this.phase3BeamCooldown,
            phase2VolleyCooldown: this.phase2VolleyCooldown,
            pheromoneTrails: this.pheromoneTrails.map(trail => ({
                id: trail.id,
                points: trail.points,
                elapsed: trail.elapsed,
                windupDuration: trail.windupDuration,
                buildDelay: trail.buildDelay,
                segmentRevealInterval: trail.segmentRevealInterval,
                activeDuration: trail.activeDuration,
                fadeDuration: trail.fadeDuration,
                duration: trail.duration,
                alpha: trail.alpha,
                runnerSpeed: trail.runnerSpeed,
                visualWidth: trail.visualWidth,
                lane: trail.lane || 0,
                webTrail: !!trail.webTrail,
                liveTrail: !!trail.liveTrail,
                routeComplete: !!trail.routeComplete
            })),
            activePhase3WebTrailId: this.activePhase3WebTrail ? this.activePhase3WebTrail.id : null,
            nestPulseMarkers: this.nestPulseMarkers
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
        if (state.state !== undefined) this.state = state.state;
        if (state.stateTimer !== undefined) this.stateTimer = state.stateTimer;
        if (state.swarmBeat !== undefined) this.swarmBeat = state.swarmBeat;
        if (state.attackFired !== undefined) this.attackFired = state.attackFired;
        if (state.swarmVolleySequence !== undefined) this.swarmVolleySequence = state.swarmVolleySequence;
        if (state.phase3BurstSequence !== undefined) this.phase3BurstSequence = state.phase3BurstSequence;
        if (state.phase3State !== undefined) this.phase3State = state.phase3State;
        if (state.dashCount !== undefined) this.dashCount = state.dashCount;
        if (state.dashTarget !== undefined) this.dashTarget = state.dashTarget;
        if (state.exhaustedTimer !== undefined) this.exhaustedTimer = state.exhaustedTimer;
        if (state.phase3WebIndex !== undefined) this.phase3WebIndex = state.phase3WebIndex;
        if (state.phase3DashStart !== undefined) this.phase3DashStart = state.phase3DashStart;
        if (Array.isArray(state.phase3DashPath)) this.phase3DashPath = state.phase3DashPath.map(point => ({ x: point.x, y: point.y }));
        if (state.phase3DashFinalTarget !== undefined) this.phase3DashFinalTarget = state.phase3DashFinalTarget;
        if (state.beamStateTimer !== undefined) this.beamStateTimer = state.beamStateTimer;
        if (state.pendingBeamAngle !== undefined) this.pendingBeamAngle = state.pendingBeamAngle;
        if (state.beamTelegraphAngle !== undefined) this.beamTelegraphAngle = state.beamTelegraphAngle;
        if (state.phase3BeamCooldown !== undefined) this.phase3BeamCooldown = state.phase3BeamCooldown;
        if (state.phase2VolleyCooldown !== undefined) this.phase2VolleyCooldown = state.phase2VolleyCooldown;
        if (Array.isArray(state.pheromoneTrails)) {
            this.pheromoneTrails = state.pheromoneTrails.map(trail => ({
                id: trail.id,
                points: Array.isArray(trail.points) ? trail.points.map(point => ({ x: point.x, y: point.y })) : [],
                elapsed: trail.elapsed || 0,
                windupDuration: trail.windupDuration !== undefined ? trail.windupDuration : 0.65,
                buildDelay: trail.buildDelay !== undefined ? trail.buildDelay : 0,
                segmentRevealInterval: trail.segmentRevealInterval !== undefined ? trail.segmentRevealInterval : 0.16,
                activeDuration: trail.activeDuration || 4,
                fadeDuration: trail.fadeDuration || 1,
                duration: trail.duration || 5,
                alpha: trail.alpha !== undefined ? trail.alpha : 1,
                runnerSpeed: trail.runnerSpeed || this.getPheromonePhaseConfig().runnerSpeed,
                visualWidth: trail.visualWidth || this.getPheromonePhaseConfig().visualWidth,
                lane: trail.lane || 0,
                webTrail: !!trail.webTrail,
                liveTrail: !!trail.liveTrail,
                routeComplete: !!trail.routeComplete
            }));
        }
        if (state.activePhase3WebTrailId) {
            this.activePhase3WebTrail = this.pheromoneTrails.find(trail => trail.id === state.activePhase3WebTrailId) || null;
        } else {
            this.activePhase3WebTrail = null;
        }
        if (Array.isArray(state.nestPulseMarkers)) {
            this.nestPulseMarkers = state.nestPulseMarkers.map(marker => ({
                x: marker.x,
                y: marker.y,
                elapsed: marker.elapsed || 0,
                duration: marker.duration || 1,
                delay: marker.delay || 0,
                warning: !!marker.warning
            }));
        }

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

