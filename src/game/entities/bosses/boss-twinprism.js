// Twin Prism Boss - Room 15
// Two overlapping diamonds forming hourglass, alternating dash patterns

class BossTwinPrism extends BossBase {
    constructor(x, y) {
        super(x, y);
        
        // Boss name
        this.bossName = 'Twin Prism';
        
        // Twin diamond properties
        this.diamond1 = { x: x - 30, y: y, angle: 0 };
        this.diamond2 = { x: x + 30, y: y, angle: Math.PI / 2 };
        this.centerX = x;
        this.centerY = y;
        this.diamondSize = 50; // Size of each diamond
        this.rotationAngle = 0; // Rotation around center
        this.separation = 60; // Distance between diamonds
        
        // State machine
        this.state = 'chase'; // 'chase', 'dash', 'rotate', 'swap', 'sync', 'split', 'merge'
        this.stateTimer = 0;
        
        // Attack cooldowns
        this.dashCooldown = 0;
        this.rotateCooldown = 0;
        this.swapCooldown = 0;
        this.syncCooldown = 0;
        
        // Color swap tracking
        this.colorSwapActive = false;
        this.colorSwapTimer = 0;
        
        // Merge slam tracking
        this.mergeSlamActive = false;
        this.mergeSlamTimer = 0;
        this.oldSeparation = 60;
        
        // Telegraph tracking for attacks
        this.telegraphActive = false;
        this.telegraphTimer = 0;
        this.telegraphDiamond = null; // Which diamond is telegraphing (1 or 2, or 'both')
        this.telegraphType = ''; // 'dash', 'sync', 'split', etc.
        this.syncExecuted = false; // Track if synchronized strike has been executed
        this.dash1Executed = false; // Track if dash 1 has been executed
        this.dash2Executed = false; // Track if dash 2 has been executed
        this.splitDashExecuted = false; // Track if split dash has been executed
        this.swapExecuted = false;
        this.phase3DashCycleIndex = -1;
        this.phase3MergeCycleIndex = -1;
        this.positioningMode = 'orbit'; // 'orbit' or 'override'
        
        // Split attack animation state
        this.splitTargetSeparation = 60; // Target separation for smooth animation
        this.splitDashTarget1 = null; // Target position for diamond 1 dash
        this.splitDashTarget2 = null; // Target position for diamond 2 dash
        this.splitDashSpeed = 856; // Speed for dash animation (pixels per second)
        this.splitDashTrail1 = []; // Motion trail positions for diamond 1
        this.splitDashTrail2 = []; // Motion trail positions for diamond 2
        
        // Phase 3 bullet hell cooldowns
        this.bulletHellCooldown = 0;
        this.spiralBurstCooldown = 0;
        this.spiralSequence = 0;
        this.phase3ProjectileWindup = null; // null | 'targeted' | 'spiral'
        this.phase3ProjectileWindupTimer = 0;
        this.phase3TargetedWindupDuration = 0.95;
        this.phase3SpiralWindupDuration = 1.2;
        this.phase3SpiralPreviewAngle = 0;
        this.phase3SpiralCenterCount = 10;
        this.phase3SpiralDiamondCount = 6;
        this.phase3TargetedCount = 4;
        
        // Turret-style aiming tracking (limited turn rate)
        this.trackingAngle1 = 0; // Current aiming angle for diamond 1
        this.trackingAngle2 = Math.PI / 2; // Current aiming angle for diamond 2
        this.turnRate = Math.PI * 0.6; // Radians per second - how fast the turret can turn 
        
        // Area attack lock-on system
        this.lockedTargets = []; // Array of {x, y, timer, radius, damage, type, active}
        this.targetLockDuration = 0.6; // How long to show the indicator before impact (increased from 0.4)
        this.targetFlashDuration = 0.3; // How long the flash lasts before hit (increased from 0.2)
        this.beamTelegraphTimer = null; // Track beam telegraph
        
        // Override base stats
        this.size = 50; // Each diamond is 50px (doubled to 100 for collision)
        this.maxHp = 1500; // BossBase will multiply by 12
        this.hp = this.maxHp;
        this.damage = 10;
        this.moveSpeed = 235.4; // Increased from 150 for assassin-like speed
        this.color = '#ff00ff'; // Magenta
        
        // Prism beam cooldown
        this.beamCooldown = 0;
        this.refractionSegments = [];
        this.refractionAnchors = [];
        this.refractionTimer = 0;
        this.refractionState = 'idle'; // 'idle', 'preview', 'charge', 'active', 'fade'
        this.refractionPreviewDuration = 1.7;
        this.refractionChargeDuration = 0.75;
        this.refractionActiveDuration = 1.65;
        this.refractionFadeDuration = 0.55;
        this.refractionDuration = this.refractionPreviewDuration + this.refractionChargeDuration + this.refractionActiveDuration + this.refractionFadeDuration;
        this.refractionArmed = false;
        this.refractionBurstFired = false;
        this.refractionSequenceActive = false;
        this.lightCage = null;
        this.lightCageCooldown = 7.0;
        this.collisionMergeSpread = 145;
        this.weakPointExposeTimer = 0;
        this.weakPointExposeLinger = 1.6;
        
        // Add weak point at center connection (exposed when prisms split apart)
        this.addWeakPoint(0, 0, 10, 0);
        this.weakPointDamageMultiplier = 2;
        if (this.weakPoints[0]) {
            this.weakPoints[0].hitRadius = 8;
            this.weakPoints[0].visible = false;
        }
    }
    
    update(deltaTime, player) {
        if (!this.introComplete) return;
        if (!this.alive) return;
        
        const aggroPlayer = this.resolveAggroPlayer(deltaTime, player);
        if (!aggroPlayer) return;
        player = aggroPlayer;
        
        // Safety check: ensure deltaTime is valid to prevent freeze from invalid timestep
        if (!isFinite(deltaTime) || deltaTime <= 0 || deltaTime > 1.0) {
            deltaTime = 0.016; // Default to ~60fps if invalid
        }
        
        this.processKnockback(deltaTime);
        this.checkPhaseTransition();
        this.updateHazards(deltaTime, player);
        this.checkHazardCollisions(player, deltaTime);
        this.updateWeakPoints(deltaTime);
        
        // Update center position (boss position is center)
        // For multiplayer clients, ensure center follows interpolated boss position
        const isMultiplayerClient = typeof Game !== 'undefined' && 
                                     Game.multiplayerEnabled && 
                                     typeof multiplayerManager !== 'undefined' && 
                                     multiplayerManager && 
                                     !multiplayerManager.isHost;
        
        if (isMultiplayerClient) {
            // On clients, boss position is interpolated, so sync center to interpolated position
            this.centerX = this.x;
            this.centerY = this.y;
        } else {
            // On host, center is already set correctly
            this.centerX = this.x;
            this.centerY = this.y;
        }
        
        // Update cooldowns (with safety checks to prevent freeze from invalid deltaTime)
        if (isFinite(deltaTime) && deltaTime > 0 && deltaTime <= 1.0) {
            this.dashCooldown -= deltaTime;
            this.rotateCooldown -= deltaTime;
            this.swapCooldown -= deltaTime;
            this.syncCooldown -= deltaTime;
            this.beamCooldown -= deltaTime;
            this.lightCageCooldown -= deltaTime;
            this.stateTimer += deltaTime;
            
            // Safety check: prevent stateTimer from growing too large (could cause modulo issues)
            if (this.stateTimer > 1000) {
                this.stateTimer = this.stateTimer % 1000;
            }
        }
        // Update turret tracking angles (limited turn rate)
        if (player && player.alive) {
            // Get target (handles decoy/clone logic)
            const target = this.findTarget(player);
            // Validate target and diamond positions to prevent NaN/Infinity issues
            const playerX = isFinite(target.x) ? target.x : this.x;
            const playerY = isFinite(target.y) ? target.y : this.y;
            const d1X = isFinite(this.diamond1.x) ? this.diamond1.x : this.x;
            const d1Y = isFinite(this.diamond1.y) ? this.diamond1.y : this.y;
            const d2X = isFinite(this.diamond2.x) ? this.diamond2.x : this.x;
            const d2Y = isFinite(this.diamond2.y) ? this.diamond2.y : this.y;
            
            // Ensure tracking angles are valid
            if (!isFinite(this.trackingAngle1)) this.trackingAngle1 = 0;
            if (!isFinite(this.trackingAngle2)) this.trackingAngle2 = Math.PI / 2;
            
            // Calculate desired angles to player from each diamond
            const dx1 = playerX - d1X;
            const dy1 = playerY - d1Y;
            const dist1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
            
            const dx2 = playerX - d2X;
            const dy2 = playerY - d2Y;
            const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
            
            // Only update if distances are valid (prevent division by zero or NaN)
            if (dist1 > 0 && isFinite(dist1)) {
                const desiredAngle1 = Math.atan2(dy1, dx1);
                
                if (isFinite(desiredAngle1)) {
                    // Normalize angles to [-PI, PI] range for both current and desired
                    const normalizeAngle = (angle) => {
                        if (!isFinite(angle)) return 0;
                        while (angle > Math.PI) angle -= Math.PI * 2;
                        while (angle < -Math.PI) angle += Math.PI * 2;
                        return angle;
                    };
                    
                    const normAngle1 = normalizeAngle(this.trackingAngle1);
                    const normDesired1 = normalizeAngle(desiredAngle1);
                    
                    // Calculate angle differences
                    let diff1 = normDesired1 - normAngle1;
                    
                    // Normalize differences to shortest path
                    if (diff1 > Math.PI) diff1 -= Math.PI * 2;
                    if (diff1 < -Math.PI) diff1 += Math.PI * 2;
                    
                    // Clamp turn rate and update tracking angles
                    const maxTurn = this.turnRate * deltaTime;
                    diff1 = Math.max(-maxTurn, Math.min(maxTurn, diff1));
                    
                    const newAngle1 = normalizeAngle(normAngle1 + diff1);
                    if (isFinite(newAngle1)) {
                        this.trackingAngle1 = newAngle1;
                    }
                }
            }
            
            if (dist2 > 0 && isFinite(dist2)) {
                const desiredAngle2 = Math.atan2(dy2, dx2);
                
                if (isFinite(desiredAngle2)) {
                    // Normalize angles to [-PI, PI] range
                    const normalizeAngle = (angle) => {
                        if (!isFinite(angle)) return Math.PI / 2;
                        while (angle > Math.PI) angle -= Math.PI * 2;
                        while (angle < -Math.PI) angle += Math.PI * 2;
                        return angle;
                    };
                    
                    const normAngle2 = normalizeAngle(this.trackingAngle2);
                    const normDesired2 = normalizeAngle(desiredAngle2);
                    
                    // Calculate angle differences
                    let diff2 = normDesired2 - normAngle2;
                    
                    // Normalize differences to shortest path
                    if (diff2 > Math.PI) diff2 -= Math.PI * 2;
                    if (diff2 < -Math.PI) diff2 += Math.PI * 2;
                    
                    // Clamp turn rate and update tracking angles
                    const maxTurn = this.turnRate * deltaTime;
                    diff2 = Math.max(-maxTurn, Math.min(maxTurn, diff2));
                    
                    const newAngle2 = normalizeAngle(normAngle2 + diff2);
                    if (isFinite(newAngle2)) {
                        this.trackingAngle2 = newAngle2;
                    }
                }
            }
        }
        
        // Update color swap
        if (this.colorSwapActive) {
            this.colorSwapTimer += deltaTime;
            if (this.colorSwapTimer >= 0.3) {
                this.colorSwapActive = false;
                this.colorSwapTimer = 0;
            }
        }
        
        const isClient = typeof Game !== 'undefined' && Game.isMultiplayerClient && Game.isMultiplayerClient();

        // Update locked targets (area attack indicators) - with safety checks
        if (isFinite(deltaTime) && deltaTime > 0 && deltaTime <= 1.0) {
            this.lockedTargets = this.lockedTargets.filter(target => {
                // Safety check: validate target properties
                if (!target || !isFinite(target.x) || !isFinite(target.y) || !isFinite(target.timer)) {
                    return false; // Remove invalid targets
                }
                
                target.timer += deltaTime;
                if (target.timer >= this.targetLockDuration) {
                    // Create damage zone at locked position (only if position is valid)
                    if (!isClient && isFinite(target.x) && isFinite(target.y)) {
                        this.createDamageZone(target.x, target.y, target.radius || 50, target.duration || 1.2, target.damage || this.damage);
                    }
                    return false; // Remove from array
                }
                return true; // Keep in array
            });
            if (this.lockedTargets.length > 12) {
                this.lockedTargets.splice(0, this.lockedTargets.length - 12);
            }
        }
        
        // Phase-based behavior
        if (this.phase === 1) {
            this.updatePhase1(deltaTime, player);
        } else if (this.phase === 2) {
            this.updatePhase2(deltaTime, player);
        } else {
            this.updatePhase3(deltaTime, player);
        }

        this.updateRefractionPatterns(deltaTime, player);
        
        // Update diamond positions
        this.updateDiamondPositions(deltaTime);
        
        // Safety check: ensure diamond positions are valid (prevent NaN/Infinity from teleport issues)
        if (!isFinite(this.diamond1.x) || !isFinite(this.diamond1.y)) {
            this.diamond1.x = isFinite(this.diamond1.x) ? this.diamond1.x : this.x - 30;
            this.diamond1.y = isFinite(this.diamond1.y) ? this.diamond1.y : this.y;
        }
        if (!isFinite(this.diamond2.x) || !isFinite(this.diamond2.y)) {
            this.diamond2.x = isFinite(this.diamond2.x) ? this.diamond2.x : this.x + 30;
            this.diamond2.y = isFinite(this.diamond2.y) ? this.diamond2.y : this.y;
        }
        
        // Safety check: ensure boss position is valid
        if (!isFinite(this.x) || !isFinite(this.y)) {
            if (typeof Game !== 'undefined' && Game.canvas) {
                this.x = isFinite(this.x) ? Math.max(50, Math.min(Game.canvas.width - 50, this.x)) : 400;
                this.y = isFinite(this.y) ? Math.max(50, Math.min(Game.canvas.height - 50, this.y)) : 300;
            } else {
                this.x = isFinite(this.x) ? this.x : 400;
                this.y = isFinite(this.y) ? this.y : 300;
            }
        }
        
        this.keepInBounds();
        this.updateCombatFacing(deltaTime, player);
    }
    
    updateDiamondPositions(deltaTime) {
        if (this.isRefractionBusy()) {
            this.rotationAngle += Math.PI * 0.75 * deltaTime;
            this.centerX = this.x;
            this.centerY = this.y;
            const angle1 = this.rotationAngle;
            const angle2 = this.rotationAngle + Math.PI;
            this.diamond1.x = this.centerX + Math.cos(angle1) * (this.separation / 2);
            this.diamond1.y = this.centerY + Math.sin(angle1) * (this.separation / 2);
            this.diamond1.angle = angle1;
            this.diamond2.x = this.centerX + Math.cos(angle2) * (this.separation / 2);
            this.diamond2.y = this.centerY + Math.sin(angle2) * (this.separation / 2);
            this.diamond2.angle = angle2;
            this.syncRefractionSourceSegments();
            return;
        }

        if (this.usesOverridePositioning()) {
            const angle1 = this.rotationAngle;
            const angle2 = this.rotationAngle + Math.PI;
            this.diamond1.angle = angle1;
            this.diamond2.angle = angle2;
            return;
        }
        
        // Normal orbit positioning
        const angle1 = this.rotationAngle;
        const angle2 = this.rotationAngle + Math.PI;
        
        // Always sync center to boss position (especially important for clients with interpolation)
        // This ensures diamonds follow the interpolated boss position
        this.centerX = this.x;
        this.centerY = this.y;
        
        // Ensure center is valid
        if (!isFinite(this.centerX) || !isFinite(this.centerY)) {
            this.centerX = this.x;
            this.centerY = this.y;
        }
        
        // Calculate diamond positions relative to center (which matches interpolated boss position)
        this.diamond1.x = this.centerX + Math.cos(angle1) * (this.separation / 2);
        this.diamond1.y = this.centerY + Math.sin(angle1) * (this.separation / 2);
        this.diamond1.angle = angle1;
        
        this.diamond2.x = this.centerX + Math.cos(angle2) * (this.separation / 2);
        this.diamond2.y = this.centerY + Math.sin(angle2) * (this.separation / 2);
        this.diamond2.angle = angle2;
    }

    usesOverridePositioning() {
        if (this.state === 'split' && this.stateTimer < 1.1) {
            return false;
        }
        return this.positioningMode === 'override'
            || this.state === 'dash'
            || this.state === 'sync'
            || this.state === 'split'
            || this.mergeSlamActive;
    }

    shouldAnchorBossCenter() {
        return this.isRefractionBusy()
            || this.positioningMode === 'override'
            || this.lockedTargets.length > 0;
    }

    isRefractionBusy() {
        return this.refractionSequenceActive || (this.refractionState && this.refractionState !== 'idle');
    }

    getCollisionBodySpread() {
        const points = [
            { x: this.diamond1.x, y: this.diamond1.y },
            { x: this.diamond2.x, y: this.diamond2.y },
            { x: this.x, y: this.y }
        ];
        let maxSpread = 0;
        for (let i = 0; i < points.length; i++) {
            for (let j = i + 1; j < points.length; j++) {
                maxSpread = Math.max(
                    maxSpread,
                    Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y)
                );
            }
        }
        return maxSpread;
    }

    getDamageCollisionBodies() {
        const mergeSpread = this.collisionMergeSpread || 145;
        const spread = this.getCollisionBodySpread();
        const bodies = [];

        if (spread < mergeSpread) {
            bodies.push({ x: this.x, y: this.y, radius: this.size, part: 'merged' });
        } else {
            const diamondRadius = this.diamondSize || (this.size * 0.5);
            bodies.push(
                { x: this.diamond1.x, y: this.diamond1.y, radius: diamondRadius, part: 'diamond1' },
                { x: this.diamond2.x, y: this.diamond2.y, radius: diamondRadius, part: 'diamond2' }
            );
        }

        const wp = this.weakPoints && this.weakPoints[0];
        if (wp && wp.visible) {
            const coreRadius = (wp.hitRadius || wp.radius || 8) + 4;
            bodies.push({
                x: this.x + (wp.offsetX || 0),
                y: this.y + (wp.offsetY || 0),
                radius: coreRadius,
                part: 'core'
            });
        }

        return bodies;
    }

    releaseOverridePositioning() {
        this.positioningMode = 'orbit';
    }

    clearAttackTelegraph() {
        this.telegraphActive = false;
        this.telegraphTimer = 0;
        this.telegraphDiamond = null;
        this.telegraphType = '';
        this.beamTelegraphTimer = null;
    }

    resetOneShotFlags() {
        this.syncExecuted = false;
        this.dash1Executed = false;
        this.dash2Executed = false;
        this.splitDashExecuted = false;
        this.swapExecuted = false;
    }
    
    updatePhase1(deltaTime, player) {
        // Safety check: validate player position before calculating distance
        if (!player || !isFinite(player.x) || !isFinite(player.y)) {
            return; // Skip update if player position is invalid
        }
        
        const distance = Math.sqrt((player.x - this.x) ** 2 + (player.y - this.y) ** 2);
        
        // Safety check: ensure distance is valid
        if (!isFinite(distance)) {
            return; // Skip update if distance calculation failed
        }
        
        if (this.state === 'chase') {
            // Move center toward target (handles clones/decoy)
            const target = this.findTarget(player);
            const dx = target.x - this.x;
            const dy = target.y - this.y;
            if (!this.shouldAnchorBossCenter()) {
                this.moveTowardPoint(target.x, target.y, 0.6, deltaTime, 0.35);
            }
            
            // Choose attack (skip while refraction sequence is playing out)
            if (!this.isRefractionBusy()) {
                const isClient = typeof Game !== 'undefined' && Game.isMultiplayerClient && Game.isMultiplayerClient();
                if (this.dashCooldown <= 0 && distance < 250) {
                    this.state = 'dash';
                    this.stateTimer = 0;
                    this.resetOneShotFlags();
                    this.beamTelegraphTimer = null;
                    if (this.telegraphType === 'beam') this.telegraphActive = false;
                } else if (this.rotateCooldown <= 0 && distance < 200) {
                    this.state = 'rotate';
                    this.stateTimer = 0;
                    this.resetOneShotFlags();
                    this.releaseOverridePositioning();
                    this.beamTelegraphTimer = null;
                    if (this.telegraphType === 'beam') this.telegraphActive = false;
                } else if (this.beamCooldown <= 0 && distance > 200 && this.refractionState === 'idle') {
                    if (!isClient) {
                        if (this.prepareDiffractionTrap(player)) {
                            this.telegraphActive = true;
                            this.telegraphTimer = 0;
                            this.telegraphDiamond = 'both';
                            this.telegraphType = 'beam';
                        } else {
                            this.prismBeam(player);
                            this.beamCooldown = 5.0;
                        }
                    }
                } else if (this.swapCooldown <= 0) {
                    this.state = 'swap';
                    this.stateTimer = 0;
                    this.resetOneShotFlags();
                    this.beamTelegraphTimer = null;
                    if (this.telegraphType === 'beam') this.telegraphActive = false;
                } else if (this.syncCooldown <= 0 && distance < 180) {
                    this.state = 'sync';
                    this.stateTimer = 0;
                    this.resetOneShotFlags();
                    this.beamTelegraphTimer = null;
                    if (this.telegraphType === 'beam') this.telegraphActive = false;
                }
            }
        } else if (this.state === 'dash') {
            // Alternating dash pattern with long visible windup
            if (this.stateTimer < 0.8) {
                // Windup/telegraph for diamond 1 dash (longer, visible)
                this.telegraphActive = true;
                this.telegraphTimer = this.stateTimer;
                this.telegraphDiamond = 1;
                this.telegraphType = 'dash';
                this.dash1Executed = false; // Reset flag
            } else if (this.stateTimer < 1.0) {
                // Dash diamond 1 (only once when crossing threshold)
                if (!this.dash1Executed) {
                    this.telegraphActive = false;
                    this.dualDashPattern(true);
                    this.dash1Executed = true;
                }
            } else if (this.stateTimer < 1.8) {
                // Windup for diamond 2 dash (longer, visible)
                this.telegraphActive = true;
                this.telegraphTimer = this.stateTimer - 1.0;
                this.telegraphDiamond = 2;
                this.telegraphType = 'dash';
                this.dash2Executed = false; // Reset flag
            } else if (this.stateTimer < 2.0) {
                // Dash diamond 2 (only once when crossing threshold)
                if (!this.dash2Executed) {
                    this.telegraphActive = false;
                    this.dualDashPattern(false);
                    this.dash2Executed = true;
                }
            } else {
                // Safety check: ensure state transition completes
                if (this.stateTimer > 3.0) {
                    this.state = 'chase';
                    this.stateTimer = 0;
                } else {
                    this.state = 'chase';
                }
                this.telegraphActive = false;
                this.dash1Executed = false;
                this.dash2Executed = false;
                this.releaseOverridePositioning();
                this.dashCooldown = 5.5; // Increased from 3.5 for more time between attacks
            }
        } else if (this.state === 'rotate') {
            // Rotation attack: spin in place as telegraph, then move toward player
            if (this.stateTimer < 0.8) {
                // Telegraph: spin in place (no red flashing, just visual spinning)
                this.telegraphActive = false; // No red telegraph for spin attacks
                this.rotationAngle += Math.PI * 2 * deltaTime; // Moderate rotation speed for telegraph
                // Stay in place during telegraph
            } else if (this.stateTimer < 2.5) {
                // Active rotation: spin faster and move toward player
                this.rotationAngle += Math.PI * 3 * deltaTime; // Faster rotation (1.5x speed)
                
                // Move toward target while spinning (handles clones/decoy)
                const target = this.findTarget(player);
                const dx = target.x - this.x;
                const dy = target.y - this.y;
                this.moveTowardPoint(target.x, target.y, 0.8, deltaTime, 0.3);
                
                // Check contact damage with player (actual player, not clone)
                if (player && isFinite(player.x) && isFinite(player.y)) {
                    const contactDist = Math.sqrt((player.x - this.x) ** 2 + (player.y - this.y) ** 2);
                    if (contactDist < this.size + player.size + 20) {
                        player.takeDamage(this.damage * 0.6); // Contact damage during rotation
                    }
                }
            } else {
                // Safety check: ensure state transition completes
                if (this.stateTimer > 3.0) {
                    this.state = 'chase';
                    this.stateTimer = 0;
                } else {
                    this.state = 'chase';
                }
                this.telegraphActive = false;
                this.rotateCooldown = 5.5; // Increased from 4.0 for more time between attacks
            }
        } else if (this.state === 'swap') {
            // Color swap (position swap)
            if (this.stateTimer < 0.2) {
                // Pause before swap
                this.colorSwapActive = true;
            } else if (this.stateTimer < 0.4) {
                // Swap positions
                if (!this.swapExecuted) {
                    const temp = { ...this.diamond1 };
                    this.diamond1 = { ...this.diamond2 };
                    this.diamond2 = temp;
                    this.swapExecuted = true;
                    this.positioningMode = 'override';
                }
                this.colorSwapActive = false;
            } else {
                // Safety check: ensure state transition completes
                if (this.stateTimer > 1.0) {
                    this.state = 'chase';
                    this.stateTimer = 0;
                } else {
                    this.state = 'chase';
                }
                this.swapCooldown = 7.0;
                this.swapExecuted = false;
                this.releaseOverridePositioning();
            }
        } else if (this.state === 'sync') {
            // Synchronized strike (both dash simultaneously) with long visible windup
            if (this.stateTimer < 1.1) {
                // Windup/telegraph before synchronized strike (longer for better aiming, increased from 0.9)
                this.telegraphActive = true;
                this.telegraphTimer = this.stateTimer;
                this.telegraphDiamond = 'both';
                this.telegraphType = 'sync';
                this.syncExecuted = false; // Reset flag
            } else if (this.stateTimer < 1.2) {
                // Execute synchronized strike (only once when crossing threshold)
                if (!this.syncExecuted) {
                    this.telegraphActive = false;
                    this.synchronizedStrike(player);
                    this.syncExecuted = true;
                }
            } else {
                // Safety check: ensure state transition completes
                if (this.stateTimer > 2.0) {
                    this.state = 'chase';
                    this.stateTimer = 0;
                } else {
                    this.state = 'chase';
                }
                this.syncExecuted = false;
                this.telegraphActive = false;
                this.releaseOverridePositioning();
                this.syncCooldown = 5.5; // Increased from 4.0 for more time between attacks
            }
        } else {
            // Safety fallback: if state is invalid, reset to chase
            if (!this.state || (this.state !== 'chase' && this.state !== 'dash' && this.state !== 'rotate' && 
                this.state !== 'swap' && this.state !== 'sync' && this.state !== 'split' && this.state !== 'merge')) {
                this.state = 'chase';
                this.stateTimer = 0;
                this.resetOneShotFlags();
                this.releaseOverridePositioning();
            }
        }
    }
    
    updatePhase2(deltaTime, player) {
        // Safety check: validate player position before calculating distance
        if (!player || !isFinite(player.x) || !isFinite(player.y)) {
            return; // Skip update if player position is invalid
        }
        
        // Phase transition safety: reset invalid Phase 1 states to chase
        // Phase 2 valid states: 'chase', 'split', 'rotate', 'swap'
        const validPhase2States = ['chase', 'split', 'rotate', 'swap'];
        if (!validPhase2States.includes(this.state)) {
            // Reset from Phase 1-specific states (dash, sync, beam, etc.)
            this.state = 'chase';
            this.stateTimer = 0;
            this.telegraphActive = false;
            this.beamTelegraphTimer = null;
            this.dash1Executed = false;
            this.dash2Executed = false;
            this.syncExecuted = false;
            this.splitDashExecuted = false;
            this.colorSwapActive = false;
            this.colorSwapTimer = 0;
            this.swapExecuted = false;
            this.releaseOverridePositioning();
        }
        
        // Faster rotation, split attack, more frequent swaps
        // Get target (handles clones/decoy)
        const target = this.findTarget(player);
        const distance = Math.sqrt((target.x - this.x) ** 2 + (target.y - this.y) ** 2);
        
        // Safety check: ensure distance is valid
        if (!isFinite(distance)) {
            return; // Skip update if distance calculation failed
        }
        
        if (this.state === 'chase') {
            // Move toward target (handles clones/decoy)
            const target = this.findTarget(player);
            const dx = target.x - this.x;
            const dy = target.y - this.y;
            if (!this.shouldAnchorBossCenter()) {
                this.moveTowardPoint(target.x, target.y, 0.7, deltaTime, 0.35);
            }
            
            // Choose attack - ensure all states can be triggered
            if (!this.isRefractionBusy()) {
                if (this.dashCooldown <= 0) {
                    this.state = 'split';
                    this.stateTimer = 0;
                    this.resetOneShotFlags();
                    this.positioningMode = 'override';
                    this.beamTelegraphTimer = null;
                    if (this.telegraphType === 'beam') this.telegraphActive = false;
                } else if (this.rotateCooldown <= 0 && distance < 200) {
                    this.state = 'rotate';
                    this.stateTimer = 0;
                    this.resetOneShotFlags();
                    this.releaseOverridePositioning();
                    this.beamTelegraphTimer = null;
                    if (this.telegraphType === 'beam') this.telegraphActive = false;
                } else if (this.swapCooldown <= 0) {
                    this.state = 'swap';
                    this.stateTimer = 0;
                    this.resetOneShotFlags();
                    this.swapCooldown = 4.0; // More frequent
                    this.beamTelegraphTimer = null;
                    if (this.telegraphType === 'beam') this.telegraphActive = false;
                }
            }
        } else if (this.state === 'split') {
            // Split attack: separate to edges, then pincer attack from both sides using turret tracking
            if (this.stateTimer < 0.5) {
                // Phase 1: Smooth separation animation (telegraph phase)
                this.telegraphActive = true;
                this.telegraphTimer = this.stateTimer;
                this.telegraphDiamond = 'both';
                this.telegraphType = 'split';
                
                // Smoothly animate separation from current to target
                const separationProgress = this.stateTimer / 0.5; // 0 to 1 over 0.5 seconds
                const startSeparation = 60;
                const targetSeparation = 350;
                this.separation = startSeparation + (targetSeparation - startSeparation) * separationProgress;
                this.splitTargetSeparation = targetSeparation;
                
                // Reset execution flags
                this.splitDashExecuted = false;
                this.splitDashTarget1 = null;
                this.splitDashTarget2 = null;
            } else if (this.stateTimer < 1.0) {
                // Phase 2: Hold separation and allow turret tracking to lock onto player
                this.separation = this.splitTargetSeparation; // Maintain separation
                this.telegraphActive = true; // Keep telegraphing to show aim direction
                this.telegraphTimer = this.stateTimer;
            } else if (this.stateTimer < 1.1) {
                // Phase 3: Calculate and lock onto dash targets (only once)
                if (!this.splitDashExecuted && player && isFinite(player.x) && isFinite(player.y)) {
                    const dashDistance = 250; // Increased range to actually reach player
                    
                    // Diamond 1 dashes toward player using its tracking angle
                    const start1X = this.diamond1.x;
                    const start1Y = this.diamond1.y;
                    const start2X = this.diamond2.x;
                    const start2Y = this.diamond2.y;
                    const dir1X = Math.cos(this.trackingAngle1);
                    const dir1Y = Math.sin(this.trackingAngle1);
                    const landing1X = this.diamond1.x + dir1X * dashDistance;
                    const landing1Y = this.diamond1.y + dir1Y * dashDistance;
                    
                    // Diamond 2 dashes toward player using its tracking angle
                    const dir2X = Math.cos(this.trackingAngle2);
                    const dir2Y = Math.sin(this.trackingAngle2);
                    const landing2X = this.diamond2.x + dir2X * dashDistance;
                    const landing2Y = this.diamond2.y + dir2Y * dashDistance;
                    
                    // Store target positions for smooth animation
                    this.splitDashTarget1 = { x: landing1X, y: landing1Y };
                    this.splitDashTarget2 = { x: landing2X, y: landing2Y };
                    
                    // Lock onto landing positions (show indicators before impact)
                    this.lockedTargets.push({
                        x: landing1X,
                        y: landing1Y,
                        timer: 0,
                        radius: 55,
                        damage: this.damage * 1.0,
                        duration: 1.2,
                        type: 'split',
                        source: 1,
                        lane: { x1: start1X, y1: start1Y, x2: landing1X, y2: landing1Y },
                        active: true
                    });
                    this.lockedTargets.push({
                        x: landing2X,
                        y: landing2Y,
                        timer: 0,
                        radius: 55,
                        damage: this.damage * 1.0,
                        duration: 1.2,
                        type: 'split',
                        source: 2,
                        lane: { x1: start2X, y1: start2Y, x2: landing2X, y2: landing2Y },
                        active: true
                    });
                    
                    this.splitDashExecuted = true;
                    this.telegraphActive = false; // Stop telegraphing during dash
                }
            } else if (this.stateTimer < 1.6) {
                // Phase 4: Smooth dash animation toward targets
                if (this.splitDashTarget1 && this.splitDashTarget2) {
                    // Store previous positions for trail (before moving)
                    const prevX1 = this.diamond1.x;
                    const prevY1 = this.diamond1.y;
                    const prevX2 = this.diamond2.x;
                    const prevY2 = this.diamond2.y;
                    
                    // Calculate distance to targets
                    const dx1 = this.splitDashTarget1.x - this.diamond1.x;
                    const dy1 = this.splitDashTarget1.y - this.diamond1.y;
                    const dist1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
                    
                    const dx2 = this.splitDashTarget2.x - this.diamond2.x;
                    const dy2 = this.splitDashTarget2.y - this.diamond2.y;
                    const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
                    
                    // Move toward targets at dash speed
                    if (dist1 > 5) { // Still moving
                        const moveDist1 = Math.min(this.splitDashSpeed * deltaTime, dist1);
                        this.diamond1.x += (dx1 / dist1) * moveDist1;
                        this.diamond1.y += (dy1 / dist1) * moveDist1;
                    } else {
                        // Snap to target if very close
                        this.diamond1.x = this.splitDashTarget1.x;
                        this.diamond1.y = this.splitDashTarget1.y;
                    }
                    
                    if (dist2 > 5) { // Still moving
                        const moveDist2 = Math.min(this.splitDashSpeed * deltaTime, dist2);
                        this.diamond2.x += (dx2 / dist2) * moveDist2;
                        this.diamond2.y += (dy2 / dist2) * moveDist2;
                    } else {
                        // Snap to target if very close
                        this.diamond2.x = this.splitDashTarget2.x;
                        this.diamond2.y = this.splitDashTarget2.y;
                    }
                    
                    // During dash, keep boss position stable (don't move boss, only diamonds)
                    // The centerX/centerY will be synced with boss position in main update loop
                    // We don't update this.x/this.y here to prevent boss from teleporting
                    
                    // Add trail points (only if moved significantly)
                    if (Math.abs(this.diamond1.x - prevX1) > 2 || Math.abs(this.diamond1.y - prevY1) > 2) {
                        this.splitDashTrail1.push({ x: this.diamond1.x, y: this.diamond1.y, alpha: 1.0 });
                        // Limit trail length
                        if (this.splitDashTrail1.length > 8) {
                            this.splitDashTrail1.shift();
                        }
                    }
                    
                    if (Math.abs(this.diamond2.x - prevX2) > 2 || Math.abs(this.diamond2.y - prevY2) > 2) {
                        this.splitDashTrail2.push({ x: this.diamond2.x, y: this.diamond2.y, alpha: 1.0 });
                        // Limit trail length
                        if (this.splitDashTrail2.length > 8) {
                            this.splitDashTrail2.shift();
                        }
                    }
                    
                    // Fade trail points
                    this.splitDashTrail1.forEach(point => point.alpha *= 0.85);
                    this.splitDashTrail2.forEach(point => point.alpha *= 0.85);
                }
            } else {
                // Phase 5: Return to normal and reset
                // Restore center to boss position (from being between diamonds during dash)
                this.centerX = this.x;
                this.centerY = this.y;
                
                // Smoothly return separation to normal and restore diamond positions
                const returnProgress = Math.min(1.0, (this.stateTimer - 1.6) / 0.3);
                const startSeparation = this.splitTargetSeparation;
                const targetSeparation = 60;
                this.separation = startSeparation + (targetSeparation - startSeparation) * returnProgress;
                
                // Restore diamonds to normal orbital positions around center
                // This ensures they're properly positioned for subsequent attacks
                const angle1 = this.rotationAngle;
                const angle2 = this.rotationAngle + Math.PI;
                this.diamond1.x = this.centerX + Math.cos(angle1) * (this.separation / 2);
                this.diamond1.y = this.centerY + Math.sin(angle1) * (this.separation / 2);
                this.diamond1.angle = angle1;
                this.diamond2.x = this.centerX + Math.cos(angle2) * (this.separation / 2);
                this.diamond2.y = this.centerY + Math.sin(angle2) * (this.separation / 2);
                this.diamond2.angle = angle2;
                
                // Safety check: ensure state transition completes
                if (this.stateTimer > 3.0 || returnProgress >= 1.0) {
                    // Fully reset to normal state
                    this.state = 'chase';
                    this.stateTimer = 0;
                    this.separation = 60; // Ensure final separation is correct
                    
                    // Final position restore to ensure diamonds are exactly where they should be
                    // Center should match boss position
                    this.centerX = this.x;
                    this.centerY = this.y;
                    
                    const finalAngle1 = this.rotationAngle;
                    const finalAngle2 = this.rotationAngle + Math.PI;
                    this.diamond1.x = this.centerX + Math.cos(finalAngle1) * 30;
                    this.diamond1.y = this.centerY + Math.sin(finalAngle1) * 30;
                    this.diamond1.angle = finalAngle1;
                    this.diamond2.x = this.centerX + Math.cos(finalAngle2) * 30;
                    this.diamond2.y = this.centerY + Math.sin(finalAngle2) * 30;
                    this.diamond2.angle = finalAngle2;
                    
                    // Clear all split attack state (after final positioning)
                    this.telegraphActive = false;
                    this.splitDashExecuted = false;
                    this.splitDashTarget1 = null;
                    this.splitDashTarget2 = null;
                    this.splitTargetSeparation = 60;
                    this.splitDashTrail1 = []; // Clear trails
                    this.splitDashTrail2 = []; // Clear trails
                    this.releaseOverridePositioning();
                    this.dashCooldown = 5.5; // Increased from 4.0 for more time between attacks
                } else {
                    // Still in return phase - clear state flags but keep trails until fully reset
                    this.telegraphActive = false;
                }
            }
        } else if (this.state === 'rotate') {
            // Rotation attack (faster in Phase 2): spin in place as telegraph, then move toward player
            if (this.stateTimer < 0.8) {
                // Telegraph: spin in place (no red flashing, just visual spinning)
                this.telegraphActive = false; // No red telegraph for spin attacks
                this.rotationAngle += Math.PI * 2.5 * deltaTime; // Moderate rotation speed for telegraph
                // Stay in place during telegraph
            } else if (this.stateTimer < 2.5) {
                // Active rotation: spin faster and move toward player (faster in Phase 2)
                this.rotationAngle += Math.PI * 4 * deltaTime; // 2x faster than Phase 1
                
                // Move toward target while spinning (handles clones/decoy)
                const target = this.findTarget(player);
                const dx = target.x - this.x;
                const dy = target.y - this.y;
                this.moveTowardPoint(target.x, target.y, 0.9, deltaTime, 0.3);
                
                // Check contact damage with player (actual player, not clone)
                if (player && isFinite(player.x) && isFinite(player.y)) {
                    const contactDist = Math.sqrt((player.x - this.x) ** 2 + (player.y - this.y) ** 2);
                    if (contactDist < this.size + player.size + 20) {
                        player.takeDamage(this.damage * 0.6); // Contact damage during rotation
                    }
                }
            } else {
                // Safety check: ensure state transition completes
                if (this.stateTimer > 3.0) {
                    this.state = 'chase';
                    this.stateTimer = 0;
                } else {
                    this.state = 'chase';
                }
                this.telegraphActive = false;
                this.rotateCooldown = 4.0;
            }
        } else if (this.state === 'swap') {
            // Color swap (position swap) - same as Phase 1
            if (this.stateTimer < 0.2) {
                // Pause before swap
                this.colorSwapActive = true;
            } else if (this.stateTimer < 0.4) {
                // Swap positions
                if (!this.swapExecuted) {
                    const temp = { ...this.diamond1 };
                    this.diamond1 = { ...this.diamond2 };
                    this.diamond2 = temp;
                    this.swapExecuted = true;
                    this.positioningMode = 'override';
                }
                this.colorSwapActive = false;
            } else {
                // Safety check: ensure state transition completes
                if (this.stateTimer > 1.0) {
                    this.state = 'chase';
                    this.stateTimer = 0;
                } else {
                    this.state = 'chase';
                }
                this.swapCooldown = 4.0; // More frequent in Phase 2
                this.swapExecuted = false;
                this.releaseOverridePositioning();
            }
        } else {
            // Safety fallback: if state is invalid for Phase 2, reset to chase
            const validPhase2States = ['chase', 'split', 'rotate', 'swap'];
            if (!this.state || !validPhase2States.includes(this.state)) {
                this.state = 'chase';
                this.stateTimer = 0;
                this.telegraphActive = false;
                this.beamTelegraphTimer = null;
                this.dash1Executed = false;
                this.dash2Executed = false;
                this.syncExecuted = false;
                this.splitDashExecuted = false;
                this.colorSwapActive = false;
                this.colorSwapTimer = 0;
            }
        }
    }
    
    updatePhase3(deltaTime, player) {
        const isClient = typeof Game !== 'undefined' && Game.isMultiplayerClient && Game.isMultiplayerClient();
        // Safety check: validate player position before calculating distance
        if (!player || !isFinite(player.x) || !isFinite(player.y)) {
            return; // Skip update if player position is invalid
        }
        
        // Handle phase transition: if we're in split state, complete it first
        if (this.state === 'split') {
            // Complete the split attack and bring diamonds together before starting Phase 3
            // This ensures diamonds are reunited before Phase 3 begins
            
            // Restore center to boss position
            this.centerX = this.x;
            this.centerY = this.y;
            
            // Handle different phases of split attack
            if (this.stateTimer < 1.0) {
                // Still in separation phase - fast forward to return phase
                this.stateTimer = 1.6; // Jump to start of return phase
                this.separation = 350; // Set to max separation
                this.splitTargetSeparation = 350;
                this.splitDashExecuted = false; // Reset flag
            } else if (this.stateTimer < 1.1) {
                // In pause/aim phase - fast forward to return phase
                this.stateTimer = 1.6;
            } else if (this.stateTimer < 1.6) {
                // In dash phase - complete dash quickly and move to return
                if (this.splitDashTarget1 && this.splitDashTarget2) {
                    // Snap diamonds to their dash targets
                    this.diamond1.x = this.splitDashTarget1.x;
                    this.diamond1.y = this.splitDashTarget1.y;
                    this.diamond2.x = this.splitDashTarget2.x;
                    this.diamond2.y = this.splitDashTarget2.y;
                }
                this.stateTimer = 1.6; // Move to return phase
            }
            
            // Now handle return phase (bring diamonds together)
            const returnProgress = Math.min(1.0, (this.stateTimer - 1.6) / 0.3);
            const startSeparation = this.separation > 60 ? this.separation : 350;
            const targetSeparation = 60;
            this.separation = startSeparation + (targetSeparation - startSeparation) * returnProgress;
            
            // Restore diamonds to normal orbital positions
            const angle1 = this.rotationAngle;
            const angle2 = this.rotationAngle + Math.PI;
            this.diamond1.x = this.centerX + Math.cos(angle1) * (this.separation / 2);
            this.diamond1.y = this.centerY + Math.sin(angle1) * (this.separation / 2);
            this.diamond1.angle = angle1;
            this.diamond2.x = this.centerX + Math.cos(angle2) * (this.separation / 2);
            this.diamond2.y = this.centerY + Math.sin(angle2) * (this.separation / 2);
            this.diamond2.angle = angle2;
            
            // Check if return is complete
            if (returnProgress >= 1.0 || this.separation <= 60) {
                // Fully reset to normal state
                this.state = 'chase';
                this.stateTimer = 0;
                this.separation = 60;
                
                // Final position restore
                this.centerX = this.x;
                this.centerY = this.y;
                const finalAngle1 = this.rotationAngle;
                const finalAngle2 = this.rotationAngle + Math.PI;
                this.diamond1.x = this.centerX + Math.cos(finalAngle1) * 30;
                this.diamond1.y = this.centerY + Math.sin(finalAngle1) * 30;
                this.diamond1.angle = finalAngle1;
                this.diamond2.x = this.centerX + Math.cos(finalAngle2) * 30;
                this.diamond2.y = this.centerY + Math.sin(finalAngle2) * 30;
                this.diamond2.angle = finalAngle2;
                
                // Clear all split attack state
                this.telegraphActive = false;
                this.splitDashExecuted = false;
                this.splitDashTarget1 = null;
                this.splitDashTarget2 = null;
                this.splitTargetSeparation = 60;
                this.splitDashTrail1 = [];
                this.splitDashTrail2 = [];
                this.releaseOverridePositioning();
            } else {
                // Still completing return - update stateTimer for return progress
                this.stateTimer += deltaTime;
                // Continue return animation
                return; // Don't proceed with Phase 3 yet
            }
        }
        
        // Phase transition safety: reset invalid Phase 1/2 states (but not split, handled above)
        // Phase 3 doesn't use a traditional state machine (it's always in frenzy mode)
        // But we still need to ensure we're not stuck in an old state
        const invalidStates = ['dash', 'sync', 'rotate', 'swap', 'beam'];
        if (invalidStates.includes(this.state)) {
            // Phase 3 doesn't use states, but clear any leftover state flags
            this.state = 'chase'; // Use chase as default (though Phase 3 doesn't check state)
            this.stateTimer = 0;
            this.telegraphActive = false;
            this.beamTelegraphTimer = null;
            this.dash1Executed = false;
            this.dash2Executed = false;
            this.syncExecuted = false;
            this.splitDashExecuted = false;
            this.colorSwapActive = false;
            this.colorSwapTimer = 0;
            this.swapExecuted = false;
            this.releaseOverridePositioning();
        }
        
        // Safety check: ensure deltaTime is valid
        if (!isFinite(deltaTime) || deltaTime <= 0 || deltaTime > 1.0) {
            deltaTime = 0.016; // Default to ~60fps if invalid
        }
        
        // Frenzy mode: constant spinning + dashing (tuned for readability)
        const projectileWindupActive = !!this.phase3ProjectileWindup;
        const spinSpeed = projectileWindupActive ? Math.PI * 2.2 : Math.PI * 4.2;
        this.rotationAngle += spinSpeed * deltaTime;
        if (!isClient && this.lightCageCooldown <= 0 && !this.lightCage) {
            this.startLightCage();
            this.lightCageCooldown = 10.5;
        }
        
        // Get target (handles clones/decoy)
        const target = this.findTarget(player);
        const distance = Math.sqrt((target.x - this.x) ** 2 + (target.y - this.y) ** 2);
        
        // Safety check: ensure distance is valid
        if (!isFinite(distance)) {
            return; // Skip update if distance calculation failed
        }
        
        // Safety check: ensure stateTimer is valid
        if (!isFinite(this.stateTimer)) {
            this.stateTimer = 0;
        }
        
        // Less frequent dashes with long visible windup
        const dashCycleLength = 2.6;
        const dashWindup = 1.1;
        const dashCycle = this.stateTimer % dashCycleLength;
        const dashCycleIndex = Math.floor(this.stateTimer / dashCycleLength);
        if (!projectileWindupActive) {
            if (dashCycle < dashWindup) {
                // Long windup before dash (visible telegraph)
                this.telegraphActive = true;
                this.telegraphTimer = dashCycle;
                this.telegraphDiamond = dashCycle % 1.0 < 0.45 ? 1 : 2;
                this.telegraphType = 'dash';
                this.releaseOverridePositioning();
            } else if (dashCycle < dashWindup + 0.12) {
                // Dash (less frequent than before)
                this.telegraphActive = false;
                if (this.phase3DashCycleIndex !== dashCycleIndex) {
                    this.dualDashPattern(this.stateTimer % 3.0 < 1.5);
                    this.phase3DashCycleIndex = dashCycleIndex;
                }
            } else {
                this.telegraphActive = false;
            }
        }
        
        // Occasionally merge form for slam
        const mergeInterval = 6.5;
        const mergeCycleIndex = Math.floor(this.stateTimer / mergeInterval);
        if (this.stateTimer >= 0.2 && this.stateTimer % mergeInterval < 0.2 && this.phase3MergeCycleIndex !== mergeCycleIndex && !this.mergeSlamActive) {
            this.mergedFormSlam(player);
            this.phase3MergeCycleIndex = mergeCycleIndex;
        }
        
        // Update merge slam if active
        if (this.mergeSlamActive) {
            this.mergeSlamTimer += deltaTime;
            if (this.mergeSlamTimer >= 0.2) {
                if (!isClient) {
                    this.createShockwave(this.x, this.y, 120, 0.6, this.damage * 1.5);
                }
                this.separation = this.oldSeparation;
                this.mergeSlamActive = false;
                this.mergeSlamTimer = 0;
                this.releaseOverridePositioning();
            }
        }
        
        // Chase player (slower while winding up projectiles)
        const dx = target.x - this.x;
        const dy = target.y - this.y;
        const chaseSpeed = projectileWindupActive ? 0.16 : 0.44;
        this.moveTowardPoint(target.x, target.y, chaseSpeed, deltaTime, 0.35);
        
        // Bullet hell mechanics - windup broadcast then fire
        if (this.bulletHellCooldown > 0) {
            this.bulletHellCooldown -= deltaTime;
        }
        if (this.spiralBurstCooldown > 0) {
            this.spiralBurstCooldown -= deltaTime;
        }

        if (this.phase3ProjectileWindup) {
            if (!isClient) {
                this.phase3ProjectileWindupTimer += deltaTime;
            }
            const windupDuration = this.phase3ProjectileWindup === 'spiral'
                ? this.phase3SpiralWindupDuration
                : this.phase3TargetedWindupDuration;
            this.telegraphActive = true;
            this.telegraphType = this.phase3ProjectileWindup === 'spiral' ? 'spiral' : 'projectile';
            this.telegraphDiamond = 'both';
            this.telegraphTimer = this.phase3ProjectileWindupTimer;

            if (!isClient && this.phase3ProjectileWindupTimer >= windupDuration) {
                if (this.phase3ProjectileWindup === 'spiral') {
                    this.spiralBurst();
                    this.spiralBurstCooldown = 4.2;
                } else {
                    this.targetedBurst(target);
                    this.bulletHellCooldown = 2.2;
                }
                this.phase3ProjectileWindup = null;
                this.phase3ProjectileWindupTimer = 0;
                this.telegraphActive = false;
                this.telegraphType = '';
            }
        } else if (!isClient) {
            if (this.spiralBurstCooldown <= 0) {
                this.phase3ProjectileWindup = 'spiral';
                this.phase3ProjectileWindupTimer = 0;
                this.phase3SpiralPreviewAngle = this.spiralSequence * 0.37 + this.stateTimer * 0.18;
            } else if (this.bulletHellCooldown <= 0 && distance > 200) {
                this.phase3ProjectileWindup = 'targeted';
                this.phase3ProjectileWindupTimer = 0;
            }
        }
    }
    
    // Targeted burst - fires projectiles toward player with spread
    targetedBurst(target) {
        if (typeof Game === 'undefined') return;
        
        const dx = target.x - this.x;
        const dy = target.y - this.y;
        const distanceSq = dx * dx + dy * dy;
        
        if (distanceSq > 0) {
            const baseAngle = Math.atan2(dy, dx);
            const projectileSpeed = 299.6;
            const count = 5;
            const cosSpeed = projectileSpeed;
            
            for (let diamondIndex = 0; diamondIndex < 2; diamondIndex++) {
                const diamond = diamondIndex === 0 ? this.diamond1 : this.diamond2;
                const color = diamondIndex === 0 ? '#ff00ff' : '#00ffff';
                for (let i = 0; i < count; i++) {
                    const spread = (i - (count - 1) / 2) * 0.15;
                    const angle = baseAngle + spread;
                    this.spawnPrismProjectile(
                        diamond.x,
                        diamond.y,
                        Math.cos(angle) * cosSpeed,
                        Math.sin(angle) * cosSpeed,
                        this.damage * 0.7,
                        8,
                        2.5,
                        color
                    );
                }
            }
        }
    }
    
    // Spiral burst - expanding spiral pattern from center
    spiralBurst() {
        if (typeof Game === 'undefined') return;
        
        const spiralAngle = this.spiralSequence++ * 0.37 + this.stateTimer * 0.18;
        const projectileSpeed = 267.5;
        const centerCount = 12;
        const diamondCount = 8;
        const centerStep = Math.PI * 2 / centerCount;
        const diamondStep = Math.PI * 2 / diamondCount;
        const slowSpeed = projectileSpeed * 0.8;
        
        for (let i = 0; i < centerCount; i++) {
            const angle = spiralAngle + centerStep * i;
            this.spawnPrismProjectile(
                this.x,
                this.y,
                Math.cos(angle) * projectileSpeed,
                Math.sin(angle) * projectileSpeed,
                this.damage * 0.6,
                7,
                3.0,
                '#ff00ff'
            );
        }
        
        for (let diamondIndex = 0; diamondIndex < 2; diamondIndex++) {
            const diamond = diamondIndex === 0 ? this.diamond1 : this.diamond2;
            const offset = diamondIndex === 0 ? Math.PI / 4 : -Math.PI / 4;
            const color = diamondIndex === 0 ? '#ff00ff' : '#00ffff';
            for (let i = 0; i < diamondCount; i++) {
                const angle = spiralAngle + offset + diamondStep * i;
                this.spawnPrismProjectile(
                    diamond.x,
                    diamond.y,
                    Math.cos(angle) * slowSpeed,
                    Math.sin(angle) * slowSpeed,
                    this.damage * 0.5,
                    6,
                    2.5,
                    color
                );
            }
        }
    }

    spawnPrismProjectile(x, y, vx, vy, damage, size, lifetime, color) {
        if (typeof Game === 'undefined' || typeof Game.acquireProjectile !== 'function') return;
        const projectile = Game.acquireProjectile({
            x,
            y,
            vx,
            vy,
            damage,
            size,
            lifetime,
            elapsed: 0,
            color,
            glowSize: size * 3,
            vignetteLightRadius: size * 6 + 50
        });
        delete projectile.playerId;
        delete projectile.type;
        delete projectile.hitEnemies;
        delete projectile.waveAmplitude;
        delete projectile.trailLength;
        Game.projectiles.push(projectile);
    }
    
    // Alternating dash pattern - uses turret tracking angle with lock-on
    dualDashPattern(diamond1) {
        if (typeof Game === 'undefined' || !Game.player) return;
        
        const target = diamond1 ? this.diamond1 : this.diamond2;
        const startX = target.x;
        const startY = target.y;
        
        // Use turret tracking angle instead of direct angle to player
        const trackingAngle = diamond1 ? this.trackingAngle1 : this.trackingAngle2;
        const dashSpeed = 749; // Increased from 500
        const dashX = Math.cos(trackingAngle) * dashSpeed;
        const dashY = Math.sin(trackingAngle) * dashSpeed;
        
        // Calculate where the diamond will land
        const landingX = target.x + dashX * 0.35;
        const landingY = target.y + dashY * 0.35;
        
        // Lock onto the landing position (show indicator before impact)
        this.lockedTargets.push({
            x: landingX,
            y: landingY,
            timer: 0,
            radius: 60,
            damage: this.damage * 0.8,
            duration: 1.2,
            type: 'dash',
            source: diamond1 ? 1 : 2,
            lane: { x1: startX, y1: startY, x2: landingX, y2: landingY },
            active: true
        });
        
        // Update diamond position (dash with more reach)
        this.positioningMode = 'override';
        if (diamond1) {
            this.diamond1.x += dashX * 0.35; // Increased from 0.2 for more reach
            this.diamond1.y += dashY * 0.35;
        } else {
            this.diamond2.x += dashX * 0.35;
            this.diamond2.y += dashY * 0.35;
        }
    }
    
    // Synchronized strike (both dash simultaneously) - uses turret tracking angles with lock-on
    synchronizedStrike(player) {
        // Both diamonds dash toward player using their individual tracking angles (not opposite sides)
        const dashDistance = 180; // Increased from 100 for more range
        
        // Diamond 1 dashes in direction of its tracking angle
        const dir1X = Math.cos(this.trackingAngle1);
        const dir1Y = Math.sin(this.trackingAngle1);
        
        // Diamond 2 dashes in direction of its tracking angle
        const dir2X = Math.cos(this.trackingAngle2);
        const dir2Y = Math.sin(this.trackingAngle2);
        
        // Calculate landing positions BEFORE moving diamonds
        const start1X = this.diamond1.x;
        const start1Y = this.diamond1.y;
        const start2X = this.diamond2.x;
        const start2Y = this.diamond2.y;
        const landing1X = this.diamond1.x + dir1X * dashDistance;
        const landing1Y = this.diamond1.y + dir1Y * dashDistance;
        const landing2X = this.diamond2.x + dir2X * dashDistance;
        const landing2Y = this.diamond2.y + dir2Y * dashDistance;
        
        // Lock onto both landing positions (show indicators before impact)
        this.lockedTargets.push({
            x: landing1X,
            y: landing1Y,
            timer: 0,
            radius: 50,
            damage: this.damage * 1.2,
            duration: 1.0,
            type: 'sync',
            source: 1,
            lane: { x1: start1X, y1: start1Y, x2: landing1X, y2: landing1Y },
            active: true
        });
        this.lockedTargets.push({
            x: landing2X,
            y: landing2Y,
            timer: 0,
            radius: 50,
            damage: this.damage * 1.2,
            duration: 1.0,
            type: 'sync',
            source: 2,
            lane: { x1: start2X, y1: start2Y, x2: landing2X, y2: landing2Y },
            active: true
        });
        
        // Both diamonds dash toward their tracked directions (both aiming at player)
        this.positioningMode = 'override';
        this.diamond1.x += dir1X * dashDistance;
        this.diamond1.y += dir1Y * dashDistance;
        this.diamond2.x += dir2X * dashDistance;
        this.diamond2.y += dir2Y * dashDistance;
    }
    
    // Merged form slam
    mergedFormSlam(player) {
        // Brief merge into large shape
        this.mergeSlamActive = true;
        this.mergeSlamTimer = 0;
        this.oldSeparation = this.separation;
        this.separation = 0; // Merge
    }
    
    // Prism Beam - ranged attack when player is far - uses turret tracking angles
    prismBeam(player) {
        if (typeof Game === 'undefined') return;
        if (this.tryStartDiffractionTrap(player)) return;
        
        // Use turret tracking angles instead of direct angles to player
        const beamSpeed = 374.5;
        const beam1StartX = this.diamond1.x;
        const beam1StartY = this.diamond1.y;
        const beam2StartX = this.diamond2.x;
        const beam2StartY = this.diamond2.y;
        
        // Beam from diamond 1 (uses tracking angle, slight convergence)
        const angle1 = this.trackingAngle1 + 0.1; // Slight convergence angle
        Game.projectiles.push({
            x: beam1StartX,
            y: beam1StartY,
            vx: Math.cos(angle1) * beamSpeed,
            vy: Math.sin(angle1) * beamSpeed,
            damage: this.damage * 1.0,
            size: 10,
            lifetime: 2.5,
            elapsed: 0
        });
        
        // Beam from diamond 2 (uses tracking angle, slight convergence)
        const angle2 = this.trackingAngle2 - 0.1; // Slight convergence angle
        Game.projectiles.push({
            x: beam2StartX,
            y: beam2StartY,
            vx: Math.cos(angle2) * beamSpeed,
            vy: Math.sin(angle2) * beamSpeed,
            damage: this.damage * 1.0,
            size: 10,
            lifetime: 2.5,
            elapsed: 0
        });
    }

    tryStartDiffractionTrap(player) {
        if (this.refractionSegments.length > 0 && this.refractionState !== 'idle' && this.refractionState !== 'preview') return true;
        if (!this.refractionSegments.length && !this.prepareDiffractionTrap(player)) return false;
        this.refractionArmed = true;
        this.refractionState = 'charge';
        this.refractionTimer = 0;
        this.refractionBurstFired = false;
        if (typeof Game !== 'undefined') {
            Game.triggerScreenShake(4, 0.2, 'boss');
        }
        if (typeof createParticleBurst !== 'undefined') {
            this.refractionAnchors.forEach(anchor => createParticleBurst(anchor.x, anchor.y, anchor.type === 'diffraction' ? '#ff66ff' : '#66ccff', 10));
        }
        return true;
    }

    prepareDiffractionTrap(player) {
        const anchors = this.getBossArenaAnchors('prismAnchor');
        if (!anchors || anchors.length < 2) return false;
        const target = player || { x: this.x, y: this.y };
        const pair = this.selectRefractionAnchorPair(anchors, target);
        const mirror = pair && pair.mirror;
        const diffraction = pair && pair.diffraction;
        if (!mirror || !diffraction) return false;

        const segments = [];
        segments.push({
            x1: this.diamond1.x,
            y1: this.diamond1.y,
            x2: mirror.x,
            y2: mirror.y,
            width: 16,
            damage: this.damage * 0.8,
            kind: 'source1'
        });
        segments.push({
            x1: this.diamond2.x,
            y1: this.diamond2.y,
            x2: diffraction.x,
            y2: diffraction.y,
            width: 16,
            damage: this.damage * 0.8,
            kind: 'source2'
        });
        segments.push({
            x1: mirror.x,
            y1: mirror.y,
            x2: diffraction.x,
            y2: diffraction.y,
            width: 14,
            damage: this.damage * 0.8,
            kind: 'mirror'
        });

        const predicted = {
            x: target.x + (Number.isFinite(target.vx) ? target.vx * 0.25 : 0),
            y: target.y + (Number.isFinite(target.vy) ? target.vy * 0.25 : 0)
        };
        const baseAngle = Math.atan2(predicted.y - diffraction.y, predicted.x - diffraction.x);
        const fanCount = 15;
        for (let i = 0; i < fanCount; i++) {
            const offset = (i - (fanCount - 1) / 2) * 0.085;
            const angle = baseAngle + offset;
            const length = 420;
            segments.push({
                x1: diffraction.x,
                y1: diffraction.y,
                x2: diffraction.x + Math.cos(angle) * length,
                y2: diffraction.y + Math.sin(angle) * length,
                width: 7,
                damage: this.damage * 0.42,
                kind: 'diffraction',
                fanIndex: i
            });
        }

        this.assignRefractionRevealTimings(segments);
        this.refractionSegments = segments;
        this.refractionAnchors = [
            { x: mirror.x, y: mirror.y, type: 'mirror' },
            { x: diffraction.x, y: diffraction.y, type: 'diffraction' }
        ];
        this.refractionTimer = 0;
        this.refractionArmed = false;
        this.refractionState = 'preview';
        this.refractionBurstFired = false;
        this.refractionSequenceActive = true;
        return true;
    }

    selectRefractionAnchorPair(anchors, target) {
        const predicted = {
            x: target.x + (Number.isFinite(target.vx) ? target.vx * 0.25 : 0),
            y: target.y + (Number.isFinite(target.vy) ? target.vy * 0.25 : 0)
        };
        let best = null;
        anchors.forEach((mirror, mirrorIndex) => {
            anchors.forEach((diffraction, diffractionIndex) => {
                if (mirrorIndex === diffractionIndex) return;
                const spread = Math.hypot(diffraction.x - mirror.x, diffraction.y - mirror.y);
                if (spread < 160) return;
                const mirrorToPlayer = Math.hypot(mirror.x - predicted.x, mirror.y - predicted.y);
                const diffractionToPlayer = Math.hypot(diffraction.x - predicted.x, diffraction.y - predicted.y);
                const chainPressure = this.distanceToSegment(predicted.x, predicted.y, mirror.x, mirror.y, diffraction.x, diffraction.y);
                const source1Pressure = this.distanceToSegment(predicted.x, predicted.y, this.diamond1.x, this.diamond1.y, mirror.x, mirror.y);
                const source2Pressure = this.distanceToSegment(predicted.x, predicted.y, this.diamond2.x, this.diamond2.y, diffraction.x, diffraction.y);
                const bossToMirror = Math.hypot(mirror.x - this.x, mirror.y - this.y);
                const bossToDiffraction = Math.hypot(diffraction.x - this.x, diffraction.y - this.y);
                const spreadSweetSpot = Math.abs(spread - 360) * 0.34;
                const anchorPressure = Math.min(mirrorToPlayer, diffractionToPlayer) * 0.24;
                const linePressure = Math.min(chainPressure, source1Pressure, source2Pressure) * 1.7;
                const bossBias = Math.abs(bossToMirror - bossToDiffraction) * 0.12;
                const score = linePressure + anchorPressure + spreadSweetSpot + bossBias;
                if (!best || score < best.score) {
                    best = { mirror, diffraction, score };
                }
            });
        });
        if (best) return best;
        return {
            mirror: anchors[0],
            diffraction: anchors.find(anchor => anchor !== anchors[0]) || anchors[1]
        };
    }

    assignRefractionRevealTimings(segments) {
        segments.forEach((segment, index) => {
            if (segment.kind === 'source1' || segment.kind === 'source2') {
                segment.revealStart = 0.05;
                segment.revealEnd = 0.38;
                segment.fireStart = 0.02;
                segment.fireEnd = 0.2;
            } else if (segment.kind === 'mirror') {
                segment.revealStart = 0.28;
                segment.revealEnd = 0.68;
                segment.fireStart = 0.18;
                segment.fireEnd = 0.38;
            } else {
                const fanIndex = Number.isFinite(segment.fanIndex) ? segment.fanIndex : Math.max(0, index - 3);
                const centerDistance = Math.abs(fanIndex - 7) / 7;
                segment.revealStart = 0.62 + centerDistance * 0.16;
                segment.revealEnd = Math.min(1, segment.revealStart + 0.34);
                segment.fireStart = 0.38 + centerDistance * 0.18;
                segment.fireEnd = Math.min(1, segment.fireStart + 0.26);
            }
        });
    }

    startLightCage() {
        const anchors = this.getBossArenaAnchors('prismAnchor');
        if (!anchors || anchors.length < 2) return;
        const first = anchors[0];
        const second = anchors
            .slice(1)
            .sort((a, b) => Math.hypot(b.x - first.x, b.y - first.y) - Math.hypot(a.x - first.x, a.y - first.y))[0];
        if (!first || !second) return;
        this.lightCage = {
            centerX: (first.x + second.x) / 2,
            centerY: (first.y + second.y) / 2,
            halfLength: Math.max(260, Math.hypot(second.x - first.x, second.y - first.y) / 2),
            angle: Math.atan2(second.y - first.y, second.x - first.x),
            elapsed: 0,
            telegraph: 1.15,
            active: 3.0,
            rotateSpeed: 1.05,
            width: 26,
            damageCooldown: 0
        };
        if (typeof Game !== 'undefined') {
            Game.triggerScreenShake(3, 0.2, 'boss');
        }
        if (typeof createParticleBurst !== 'undefined') {
            createParticleBurst(first.x, first.y, '#66ccff', 8);
            createParticleBurst(second.x, second.y, '#ff66ff', 8);
        }
    }

    syncRefractionSourceSegments() {
        if (!this.refractionSegments.length) return;
        this.refractionSegments.forEach(segment => {
            if (segment.kind === 'source1') {
                segment.x1 = this.diamond1.x;
                segment.y1 = this.diamond1.y;
            } else if (segment.kind === 'source2') {
                segment.x1 = this.diamond2.x;
                segment.y1 = this.diamond2.y;
            }
        });
    }

    updateRefractionPatterns(deltaTime, player) {
        const isClient = typeof Game !== 'undefined' && Game.isMultiplayerClient && Game.isMultiplayerClient();
        if (this.refractionSegments.length > 0) {
            this.syncRefractionSourceSegments();
            this.refractionTimer += deltaTime;
            if (this.refractionState === 'preview') {
                if (this.refractionTimer >= this.refractionPreviewDuration && !this.refractionArmed) {
                    if (!isClient) {
                        if (this.tryStartDiffractionTrap(player)) {
                            this.beamCooldown = 5.0;
                            this.telegraphActive = false;
                            if (this.telegraphType === 'beam') this.telegraphType = null;
                        }
                    } else {
                        this.refractionTimer = this.refractionPreviewDuration;
                    }
                }
            } else if (this.refractionState === 'charge') {
                if (this.refractionTimer >= this.refractionChargeDuration) {
                    this.refractionState = 'active';
                    this.refractionTimer = 0;
                    this.triggerRefractionActivation();
                }
            } else if (this.refractionState === 'active') {
                if (!isClient) {
                    const activeSegments = this.getActiveRefractionSegments();
                    if (activeSegments.length) {
                        this.damagePlayersAlongSegments(activeSegments, 0.2);
                    }
                }
                if (this.refractionTimer >= this.refractionActiveDuration) {
                    this.refractionState = 'fade';
                    this.refractionTimer = 0;
                    this.refractionArmed = false;
                }
            } else if (this.refractionState === 'fade') {
                if (this.refractionTimer >= this.refractionFadeDuration) {
                    this.clearRefractionPattern();
                }
            }
        }

        if (this.lightCage) {
            const cage = this.lightCage;
            cage.elapsed += deltaTime;
            cage.damageCooldown = Math.max(0, (cage.damageCooldown || 0) - deltaTime);
            if (cage.elapsed > cage.telegraph) {
                const rotateSpeed = cage.rotateSpeed !== undefined ? cage.rotateSpeed : (this.phase >= 3 ? 1.05 : 1.35);
                cage.angle += deltaTime * rotateSpeed;
                if (!isClient && cage.damageCooldown <= 0) {
                    const segment = this.getLightCageSegment(cage);
                    const damageSegment = this._lightCageDamageSegment || (this._lightCageDamageSegment = {});
                    damageSegment.x1 = segment.x1;
                    damageSegment.y1 = segment.y1;
                    damageSegment.x2 = segment.x2;
                    damageSegment.y2 = segment.y2;
                    damageSegment.width = cage.width;
                    damageSegment.damage = this.damage * 0.75;
                    this.damagePlayersAlongSegments([damageSegment], 0.18);
                    cage.damageCooldown = 0.18;
                }
            }
            if (cage.elapsed >= cage.telegraph + cage.active) {
                this.lightCage = null;
            }
        }
    }

    clearRefractionPattern() {
        this.refractionSegments = [];
        this.refractionAnchors = [];
        this.refractionTimer = 0;
        this.refractionArmed = false;
        this.refractionState = 'idle';
        this.refractionBurstFired = false;
        this.refractionSequenceActive = false;
        if (this.telegraphType === 'beam') {
            this.telegraphActive = false;
            this.telegraphType = null;
        }
        if (this.positioningMode === 'override' && this.state !== 'dash' && this.state !== 'sync' && this.state !== 'split') {
            this.releaseOverridePositioning();
        }
    }

    triggerRefractionActivation() {
        if (this.refractionBurstFired) return;
        this.refractionBurstFired = true;
        if (typeof Game !== 'undefined') {
            Game.triggerScreenShake(6, 0.18, 'boss');
        }
        if (typeof createParticleBurst !== 'undefined') {
            this.refractionAnchors.forEach(anchor => {
                createParticleBurst(anchor.x, anchor.y, anchor.type === 'diffraction' ? '#ff66ff' : '#66ccff', 16);
            });
        }
    }

    getActiveRefractionSegments() {
        const progress = Math.min(1, this.refractionTimer / Math.max(0.01, this.refractionActiveDuration));
        const scratch = this._activeRefractionScratch || (this._activeRefractionScratch = []);
        let count = 0;
        const segments = this.refractionSegments;
        for (let i = 0; i < segments.length; i++) {
            const segment = segments[i];
            const fireProgress = this.getRefractionSegmentFireProgress(segment, progress);
            if (fireProgress <= 0) continue;
            const partial = this.getPartialRefractionSegment(segment, fireProgress);
            let entry = scratch[count];
            if (!entry) {
                entry = {};
                scratch[count] = entry;
            }
            entry.x1 = partial.x1;
            entry.y1 = partial.y1;
            entry.x2 = partial.x2;
            entry.y2 = partial.y2;
            entry.width = segment.width;
            entry.damage = segment.damage;
            entry.kind = segment.kind;
            count++;
        }
        scratch.length = count;
        return scratch;
    }

    getLightCageSegment(cage) {
        return {
            x1: cage.centerX + Math.cos(cage.angle) * cage.halfLength,
            y1: cage.centerY + Math.sin(cage.angle) * cage.halfLength,
            x2: cage.centerX - Math.cos(cage.angle) * cage.halfLength,
            y2: cage.centerY - Math.sin(cage.angle) * cage.halfLength
        };
    }

    isWeakPointExposed() {
        const spread = this.getCollisionBodySpread();
        if (spread >= 95) return true;
        if (this.separation >= 68) return true;
        if (this.state === 'split' && this.stateTimer >= 0.35) return true;
        if ((this.state === 'dash' || this.state === 'sync') && this.stateTimer >= 0.7) return true;
        if (this.state === 'swap' && this.stateTimer >= 0.2 && this.stateTimer < 0.45) return true;
        if (this.mergeSlamActive) return true;
        if (this.positioningMode === 'override' && spread >= 80) return true;
        return false;
    }

    updateWeakPoints(deltaTime) {
        super.updateWeakPoints(deltaTime);
        let exposed = this.isWeakPointExposed();
        if (exposed) {
            this.weakPointExposeTimer = this.weakPointExposeLinger;
        } else if (this.weakPointExposeTimer > 0) {
            this.weakPointExposeTimer = Math.max(0, this.weakPointExposeTimer - deltaTime);
            exposed = true;
        }
        this.weakPoints.forEach(wp => {
            wp.visible = exposed;
        });
    }

    checkWeakPointHit(x, y, radius) {
        const wp = this.weakPoints[0];
        if (!wp || !wp.visible) return null;
        const wpX = this.x + wp.offsetX;
        const wpY = this.y + wp.offsetY;
        const sweetRadius = wp.hitRadius || wp.radius || 8;
        const attackRadius = Math.max(0, radius || 0);
        const dist = Math.hypot(x - wpX, y - wpY);
        if (dist <= sweetRadius + attackRadius) return wp;
        return null;
    }

    takeDamage(damage, hitX = null, hitY = null, hitRadius = 0, attackerId = null) {
        return super.takeDamage(damage, hitX, hitY, hitRadius, attackerId);
    }

    drawVignetteCuts(vCtx, getScreenPos, isVisibleInVignette) {
        vCtx.globalCompositeOperation = 'lighten';
        const drawLineCut = (x1, y1, x2, y2, width, strength) => {
            const midX = (x1 + x2) * 0.5;
            const midY = (y1 + y2) * 0.5;
            const reach = Math.hypot(x2 - x1, y2 - y1) * 0.5 + (width || 12);
            if (typeof isVisibleInVignette === 'function' && !isVisibleInVignette(midX, midY, reach)) {
                return;
            }
            const a = getScreenPos(x1, y1);
            const b = getScreenPos(x2, y2);
            vCtx.strokeStyle = `rgba(255, 255, 255, ${strength})`;
            vCtx.lineWidth = Math.max(6, (width || 12) * a.zoom * 0.62);
            vCtx.lineCap = 'round';
            vCtx.beginPath();
            vCtx.moveTo(a.x, a.y);
            vCtx.lineTo(b.x, b.y);
            vCtx.stroke();
        };

        if (this.lightCage) {
            const cage = this.lightCage;
            const segment = this.getLightCageSegment(cage);
            const active = cage.elapsed > cage.telegraph;
            drawLineCut(segment.x1, segment.y1, segment.x2, segment.y2, cage.width, active ? 0.92 : 0.42);
        }

        if (!this.refractionSegments.length) return;

        if (this.refractionState === 'active') {
            const progress = Math.min(1, this.refractionTimer / Math.max(0.01, this.refractionActiveDuration));
            let cuts = 0;
            for (let i = 0; i < this.refractionSegments.length && cuts < 14; i++) {
                const segment = this.refractionSegments[i];
                const fireProgress = this.getRefractionSegmentFireProgress(segment, progress);
                if (fireProgress <= 0) continue;
                const clamped = Math.max(0, Math.min(1, fireProgress));
                const x2 = segment.x1 + (segment.x2 - segment.x1) * clamped;
                const y2 = segment.y1 + (segment.y2 - segment.y1) * clamped;
                drawLineCut(segment.x1, segment.y1, x2, y2, segment.width, 0.84);
                cuts++;
            }
            return;
        }

        if (this.refractionState === 'charge') {
            let cuts = 0;
            for (let i = 0; i < this.refractionSegments.length && cuts < 5; i++) {
                const segment = this.refractionSegments[i];
                if (segment.kind === 'diffraction') continue;
                drawLineCut(segment.x1, segment.y1, segment.x2, segment.y2, segment.width, 0.38);
                cuts++;
            }
            return;
        }

        if (this.refractionState === 'preview') {
            let cuts = 0;
            for (let i = 0; i < this.refractionSegments.length && cuts < 4; i++) {
                const segment = this.refractionSegments[i];
                if (segment.kind === 'diffraction') continue;
                drawLineCut(segment.x1, segment.y1, segment.x2, segment.y2, segment.width, 0.24);
                cuts++;
            }
        }
    }

    damagePlayersAlongSegments(segments, cooldown) {
        const targets = [];
        if (typeof this.getAllAlivePlayers === 'function') {
            this.getAllAlivePlayers().forEach(entry => {
                if (entry && entry.player) targets.push(entry.player);
            });
        } else if (typeof Game !== 'undefined' && Game.player) {
            targets.push(Game.player);
        }
        targets.forEach(target => {
            if (!target || target.dead || target.alive === false || typeof target.takeDamage !== 'function') return;
            const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
            if (target.lastPrismBeamHitAt && now - target.lastPrismBeamHitAt < (cooldown || 0.2) * 1000) return;
            const radius = target.size || 18;
            let hitSegment = null;
            for (let i = 0; i < segments.length; i++) {
                const segment = segments[i];
                if (this.distanceToSegment(target.x, target.y, segment.x1, segment.y1, segment.x2, segment.y2) <= (segment.width || 10) + radius) {
                    hitSegment = segment;
                    break;
                }
            }
            if (hitSegment) {
                target.takeDamage(hitSegment.damage || this.damage);
                target.lastPrismBeamHitAt = now;
            }
        });
    }

    distanceToSegment(px, py, x1, y1, x2, y2) {
        return Engine.Physics.Geometry.distancePointToSegment(px, py, x1, y1, x2, y2);
    }
    
    render(ctx) {
        if (!this.alive) return;
        this.renderRefractionPatterns(ctx);
        this.renderAttackBroadcasts(ctx);
        
        // Determine colors based on telegraph state
        let color1 = '#ff00ff';
        let color2 = '#ff88ff';
        
        const prismTelegraph = this.telegraphType === 'projectile' || this.telegraphType === 'spiral';
        if (this.telegraphActive && this.telegraphType !== 'beam' && !prismTelegraph) {
            // Flash red/orange during telegraph
            const pulse = Math.sin(this.telegraphTimer * Math.PI * 4) * 0.5 + 0.5; // Fast pulsing
            const redIntensity = 0.5 + pulse * 0.5; // 0.5 to 1.0
            
            if (this.telegraphDiamond === 1 || this.telegraphDiamond === 'both') {
                color1 = `rgb(255, ${Math.floor(100 * (1 - redIntensity))}, ${Math.floor(100 * (1 - redIntensity))})`; // Flash red
            }
            if (this.telegraphDiamond === 2 || this.telegraphDiamond === 'both') {
                color2 = `rgb(255, ${Math.floor(136 * (1 - redIntensity))}, ${Math.floor(136 * (1 - redIntensity))})`; // Flash red
            }
        }
        
        // Render motion trails before diamonds so they appear behind the moving prisms.
        if ((this.splitDashTrail1.length > 1 || this.splitDashTrail2.length > 1) && this.state === 'split') {
            this.renderMotionTrails(ctx);
        }
        
        // Render two diamonds
        this.renderDiamond(ctx, this.diamond1, color1, this.telegraphActive && !prismTelegraph && this.telegraphType !== 'beam' && (this.telegraphDiamond === 1 || this.telegraphDiamond === 'both'));
        this.renderDiamond(ctx, this.diamond2, color2, this.telegraphActive && !prismTelegraph && this.telegraphType !== 'beam' && (this.telegraphDiamond === 2 || this.telegraphDiamond === 'both'));
        
        // Render center weak point (visible when separated enough to expose the core)
        const wp = this.weakPoints[0];
        if (wp && wp.visible) {
            this.renderWeakPoints(ctx);
        } else if (this.colorSwapActive) {
            // Glow brighter during color swap
            const wp = this.weakPoints[0];
            if (wp) {
                ctx.save();
                const wpX = this.x + wp.offsetX;
                const wpY = this.y + wp.offsetY;
                const glow = Math.sin(this.stateTimer * 18) * 0.5 + 1.0;
                
                ctx.globalAlpha = 0.5 * glow;
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(wpX, wpY, wp.radius * 1.5, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.restore();
            }
        }
        
        // Render locked target indicators (area attack warnings)
        this.renderLockedTargets(ctx);
        
        // Render hazards
        this.renderHazards(ctx);

        this.renderFacingIndicator(ctx, Math.max(this.size, (this.separation || 0) * 0.35 + this.size * 0.5));
        
        // Render health bar
        this.renderHealthBar(ctx);

        // Draw status effect indicators
        this.renderStatusEffects(ctx);
    }

    renderAttackBroadcasts(ctx) {
        if (!ctx) return;
        ctx.save();
        if (this.telegraphActive && this.telegraphType === 'beam' && this.refractionState === 'preview') {
            const progress = Math.min(1, this.refractionTimer / this.refractionPreviewDuration);
            [this.diamond1, this.diamond2].forEach((diamond, index) => {
                const color = index === 0 ? '#ff66ee' : '#66ddff';
                ctx.globalAlpha = 0.18 + progress * 0.16;
                ctx.strokeStyle = color;
                ctx.lineWidth = 3;
                ctx.setLineDash([12, 10]);
                ctx.beginPath();
                ctx.arc(diamond.x, diamond.y, 34 + progress * 18, 0, Math.PI * 2);
                ctx.stroke();
                ctx.setLineDash([]);
            });
        }

        if (this.telegraphActive && (this.telegraphType === 'dash' || this.telegraphType === 'sync' || this.telegraphType === 'split')) {
            const progress = Math.min(1, this.telegraphTimer / (this.telegraphType === 'sync' ? 1.1 : this.telegraphType === 'split' ? 1.0 : 0.8));
            const diamonds = this.telegraphDiamond === 'both'
                ? [this.diamond1, this.diamond2]
                : [this.telegraphDiamond === 2 ? this.diamond2 : this.diamond1];
            diamonds.forEach((diamond, index) => {
                const source = diamond === this.diamond2 ? 2 : 1;
                const angle = source === 1 ? this.trackingAngle1 : this.trackingAngle2;
                const color = source === 1 ? '#ff4fff' : '#66f7ff';
                const length = this.telegraphType === 'split' ? 260 : this.telegraphType === 'sync' ? 220 : 285;
                const endX = diamond.x + Math.cos(angle) * length;
                const endY = diamond.y + Math.sin(angle) * length;
                ctx.globalAlpha = 0.26 + progress * 0.34;
                ctx.strokeStyle = color;
                ctx.lineWidth = 10 + progress * 8;
                ctx.lineCap = 'round';
                ctx.setLineDash([18, 12]);
                ctx.beginPath();
                ctx.moveTo(diamond.x, diamond.y);
                ctx.lineTo(endX, endY);
                ctx.stroke();
                ctx.setLineDash([]);
                ctx.globalAlpha = 0.72 + Math.sin(this.telegraphTimer * 18 + index) * 0.12;
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(diamond.x, diamond.y);
                ctx.lineTo(endX, endY);
                ctx.stroke();
                ctx.globalAlpha = 0.38 + progress * 0.28;
                ctx.strokeStyle = color;
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(endX, endY - 18);
                ctx.lineTo(endX + 18, endY);
                ctx.lineTo(endX, endY + 18);
                ctx.lineTo(endX - 18, endY);
                ctx.closePath();
                ctx.stroke();
            });
        }

        if (this.telegraphActive && this.telegraphType === 'projectile') {
            const duration = this.phase3TargetedWindupDuration || 0.95;
            const progress = Math.min(1, this.telegraphTimer / duration);
            const spreadCount = 5;
            const spreadStep = 0.15;
            [this.diamond1, this.diamond2].forEach((diamond, index) => {
                const source = diamond === this.diamond2 ? 2 : 1;
                const baseAngle = source === 1 ? this.trackingAngle1 : this.trackingAngle2;
                const color = source === 1 ? '#ff4fff' : '#66f7ff';
                ctx.globalAlpha = 0.14 + progress * 0.28;
                ctx.strokeStyle = color;
                ctx.lineWidth = 6 + progress * 6;
                ctx.lineCap = 'round';
                ctx.setLineDash([16, 10]);
                for (let i = 0; i < spreadCount; i++) {
                    const spread = (i - (spreadCount - 1) / 2) * spreadStep;
                    const angle = baseAngle + spread;
                    const length = 120 + progress * 220;
                    const endX = diamond.x + Math.cos(angle) * length;
                    const endY = diamond.y + Math.sin(angle) * length;
                    ctx.beginPath();
                    ctx.moveTo(diamond.x, diamond.y);
                    ctx.lineTo(endX, endY);
                    ctx.stroke();
                }
                ctx.setLineDash([]);
                ctx.globalAlpha = 0.42 + Math.sin(this.telegraphTimer * 16 + index) * 0.14;
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(diamond.x, diamond.y, 24 + progress * 16, 0, Math.PI * 2);
                ctx.stroke();
            });
            ctx.globalAlpha = 0.2 + progress * 0.22;
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.setLineDash([10, 8]);
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size * 0.35 + progress * 18, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        if (this.telegraphActive && this.telegraphType === 'spiral') {
            const duration = this.phase3SpiralWindupDuration || 1.2;
            const progress = Math.min(1, this.telegraphTimer / duration);
            const pulse = 0.5 + Math.sin(this.telegraphTimer * 14) * 0.5;
            const previewAngle = this.phase3SpiralPreviewAngle + progress * 0.55;
            const emitters = [
                { x: this.x, y: this.y, color: '#ff66ff', radius: 26 },
                { x: this.diamond1.x, y: this.diamond1.y, color: '#ff4fff', radius: 20 },
                { x: this.diamond2.x, y: this.diamond2.y, color: '#66f7ff', radius: 20 }
            ];
            emitters.forEach((emitter, emitterIndex) => {
                ctx.globalAlpha = 0.18 + progress * 0.3;
                ctx.strokeStyle = emitter.color;
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(emitter.x, emitter.y, emitter.radius + progress * 42 + pulse * 8, 0, Math.PI * 2);
                ctx.stroke();
                const rayCount = emitterIndex === 0 ? 12 : 8;
                const rayStep = Math.PI * 2 / rayCount;
                ctx.globalAlpha = 0.12 + progress * 0.22;
                ctx.strokeStyle = emitter.color;
                ctx.lineWidth = emitterIndex === 0 ? 5 : 4;
                ctx.lineCap = 'round';
                ctx.setLineDash([12, 10]);
                for (let i = 0; i < rayCount; i++) {
                    const angle = previewAngle + rayStep * i + emitterIndex * 0.2;
                    const inner = emitter.radius * 0.5;
                    const outer = 70 + progress * 180;
                    ctx.beginPath();
                    ctx.moveTo(emitter.x + Math.cos(angle) * inner, emitter.y + Math.sin(angle) * inner);
                    ctx.lineTo(emitter.x + Math.cos(angle) * outer, emitter.y + Math.sin(angle) * outer);
                    ctx.stroke();
                }
                ctx.setLineDash([]);
            });
            ctx.globalAlpha = 0.24 + pulse * 0.2;
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.setLineDash([14, 12]);
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size + 18 + progress * 52, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        if (this.state === 'rotate') {
            const windup = this.stateTimer < 0.8;
            const progress = windup ? this.stateTimer / 0.8 : Math.min(1, (this.stateTimer - 0.8) / 1.7);
            const pulse = 0.5 + Math.sin(this.stateTimer * (windup ? 12 : 18)) * 0.5;
            ctx.globalAlpha = windup ? 0.22 + progress * 0.24 : 0.36 + pulse * 0.22;
            ctx.strokeStyle = windup ? '#66f7ff' : '#ffffff';
            ctx.lineWidth = windup ? 4 : 7;
            ctx.setLineDash(windup ? [18, 12] : []);
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size + 28 + progress * 46, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.globalAlpha = windup ? 0.18 : 0.32;
            ctx.strokeStyle = '#ff4fff';
            ctx.lineWidth = 3;
            for (let i = 0; i < 4; i++) {
                const angle = this.rotationAngle + i * Math.PI / 2;
                ctx.beginPath();
                ctx.moveTo(this.x + Math.cos(angle) * (this.size * 0.4), this.y + Math.sin(angle) * (this.size * 0.4));
                ctx.lineTo(this.x + Math.cos(angle) * (this.size + 52), this.y + Math.sin(angle) * (this.size + 52));
                ctx.stroke();
            }
        }
        ctx.restore();
    }

    renderRefractionPatterns(ctx) {
        if (!this.refractionSegments.length && !this.lightCage && !this.refractionAnchors.length) return;
        ctx.save();
        this.refractionAnchors.forEach(anchor => {
            const preview = this.refractionState === 'preview';
            const charge = this.refractionState === 'charge';
            const active = this.refractionState === 'active';
            const pulse = (Math.sin((this.refractionTimer || 0) * (anchor.type === 'mirror' ? 8 : 12)) + 1) / 2;
            const anchorColor = anchor.type === 'mirror' ? '#66ccff' : '#ff66ff';
            ctx.globalAlpha = active ? 0.7 + pulse * 0.25 : preview ? 0.28 + pulse * 0.18 : 0.38 + pulse * 0.22;
            ctx.strokeStyle = anchorColor;
            ctx.lineWidth = active ? 6 : preview ? 3 : 4;
            ctx.beginPath();
            if (anchor.type === 'mirror') {
                ctx.rect(anchor.x - 24, anchor.y - 24, 48, 48);
            } else {
                ctx.moveTo(anchor.x, anchor.y - 32);
                ctx.lineTo(anchor.x + 30, anchor.y + 20);
                ctx.lineTo(anchor.x - 30, anchor.y + 20);
                ctx.closePath();
            }
            ctx.stroke();
            ctx.globalAlpha = active ? 0.24 + pulse * 0.18 : 0.12 + pulse * 0.1;
            ctx.fillStyle = anchorColor;
            ctx.fill();
            if (preview || charge) {
                ctx.globalAlpha = preview ? 0.16 + pulse * 0.12 : 0.24 + pulse * 0.18;
                ctx.strokeStyle = anchor.type === 'mirror' ? '#9be8ff' : '#ff9cff';
                ctx.lineWidth = 2;
                ctx.setLineDash([10, 8]);
                ctx.beginPath();
                ctx.arc(anchor.x, anchor.y, 28 + pulse * 10, 0, Math.PI * 2);
                ctx.stroke();
                ctx.setLineDash([]);
            } else if (active) {
                ctx.globalAlpha = 0.34 + pulse * 0.2;
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(anchor.x, anchor.y, 42 + pulse * 18, 0, Math.PI * 2);
                ctx.stroke();
            }
        });
        if (this.refractionSegments.length) {
            const preview = this.refractionState === 'preview';
            const charge = this.refractionState === 'charge';
            const active = this.refractionState === 'active';
            const fade = this.refractionState === 'fade';
            const phaseDuration = preview ? this.refractionPreviewDuration
                : charge ? this.refractionChargeDuration
                    : active ? this.refractionActiveDuration
                        : this.refractionFadeDuration;
            const phaseProgress = Math.min(1, this.refractionTimer / Math.max(0.01, phaseDuration));
            const chargePulse = 0.5 + Math.sin(this.refractionTimer * 24) * 0.5;
            this.refractionSegments.forEach(segment => {
                const sourceMagenta = segment.kind === 'source1' || segment.kind === 'diffraction';
                const fireProgress = active ? this.getRefractionSegmentFireProgress(segment, phaseProgress) : 1;
                const revealProgress = preview
                    ? this.getRefractionSegmentRevealProgress(segment, phaseProgress)
                    : fireProgress;
                if ((preview || active) && revealProgress <= 0) {
                    if (!active) return;
                    this.renderChargedRefractionSegment(ctx, segment, sourceMagenta);
                    return;
                }
                const visible = this.getPartialRefractionSegment(segment, revealProgress);
                const previewAlpha = 0.16 + phaseProgress * 0.22;
                const fadeAlpha = Math.max(0, 0.5 * (1 - phaseProgress));
                const beamColor = sourceMagenta ? '#ff88ee' : '#7ad8ff';
                const chargeColor = sourceMagenta ? '#ff66dd' : '#66ccff';
                ctx.globalAlpha = active ? 0.58 + fireProgress * 0.34
                    : charge ? 0.24 + chargePulse * 0.18
                        : preview ? previewAlpha : fadeAlpha;
                ctx.strokeStyle = active
                    ? (sourceMagenta ? '#ff4fff' : '#bff7ff')
                    : charge ? chargeColor : beamColor;
                ctx.lineWidth = active ? segment.width + 4
                    : charge ? Math.max(3, segment.width * (0.42 + chargePulse * 0.18))
                        : preview ? Math.max(3, segment.width * (0.32 + phaseProgress * 0.22))
                            : Math.max(2, segment.width * 0.5);
                ctx.lineCap = 'round';
                if (preview || charge || fade) {
                    ctx.setLineDash(segment.kind === 'diffraction' ? [10, 10] : preview ? [20, 14] : [12, 8]);
                }
                ctx.beginPath();
                ctx.moveTo(visible.x1, visible.y1);
                ctx.lineTo(visible.x2, visible.y2);
                ctx.stroke();
                if (preview || charge || fade) ctx.setLineDash([]);
                if (active) {
                    ctx.globalAlpha = 0.95;
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = Math.max(2, segment.width * (0.18 + fireProgress * 0.12));
                    ctx.beginPath();
                    ctx.moveTo(visible.x1, visible.y1);
                    ctx.lineTo(visible.x2, visible.y2);
                    ctx.stroke();
                    ctx.globalAlpha = 0.45 + fireProgress * 0.35;
                    ctx.fillStyle = '#ffffff';
                    ctx.beginPath();
                    ctx.arc(visible.x2, visible.y2, Math.max(5, segment.width * 0.42), 0, Math.PI * 2);
                    ctx.fill();
                } else if (charge) {
                    const pulseT = (phaseProgress + (segment.revealStart || 0) * 0.35) % 1;
                    const pulseX = visible.x1 + (visible.x2 - visible.x1) * pulseT;
                    const pulseY = visible.y1 + (visible.y2 - visible.y1) * pulseT;
                    ctx.globalAlpha = 0.28 + chargePulse * 0.22;
                    ctx.fillStyle = sourceMagenta ? '#ff99ff' : '#99eeff';
                    ctx.beginPath();
                    ctx.arc(pulseX, pulseY, Math.max(4, segment.width * 0.22), 0, Math.PI * 2);
                    ctx.fill();
                }
            });
        }
        if (this.lightCage) {
            const cage = this.lightCage;
            const segment = this.getLightCageSegment(cage);
            const active = cage.elapsed > cage.telegraph;
            ctx.globalAlpha = active ? 0.78 : 0.32 + Math.sin(cage.elapsed * 14) * 0.16;
            ctx.strokeStyle = active ? '#ffffff' : '#66ccff';
            ctx.lineWidth = active ? cage.width : 7;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(segment.x1, segment.y1);
            ctx.lineTo(segment.x2, segment.y2);
            ctx.stroke();
            ctx.globalAlpha = 0.55;
            ctx.strokeStyle = '#ff66ff';
            ctx.lineWidth = 4;
            ctx.stroke();
            ctx.globalAlpha = active ? 0.42 : 0.22;
            ctx.strokeStyle = active ? '#ff2d8f' : '#ffffff';
            ctx.lineWidth = 2;
            ctx.setLineDash(active ? [] : [18, 12]);
            ctx.stroke();
            ctx.setLineDash([]);
        }
        ctx.restore();
    }

    getRefractionSegmentRevealProgress(segment, phaseProgress) {
        const start = segment.revealStart !== undefined ? segment.revealStart : 0;
        const end = segment.revealEnd !== undefined ? segment.revealEnd : 1;
        return Math.max(0, Math.min(1, (phaseProgress - start) / Math.max(0.01, end - start)));
    }

    getRefractionSegmentFireProgress(segment, phaseProgress) {
        const start = segment.fireStart !== undefined ? segment.fireStart : 0;
        const end = segment.fireEnd !== undefined ? segment.fireEnd : 1;
        return Math.max(0, Math.min(1, (phaseProgress - start) / Math.max(0.01, end - start)));
    }

    getPartialRefractionSegment(segment, progress) {
        const clamped = Math.max(0, Math.min(1, progress));
        return {
            x1: segment.x1,
            y1: segment.y1,
            x2: segment.x1 + (segment.x2 - segment.x1) * clamped,
            y2: segment.y1 + (segment.y2 - segment.y1) * clamped
        };
    }

    renderChargedRefractionSegment(ctx, segment, sourceMagenta) {
        ctx.globalAlpha = 0.18;
        ctx.strokeStyle = sourceMagenta ? '#ff9cff' : '#7ddcff';
        ctx.lineWidth = Math.max(2, segment.width * 0.45);
        ctx.lineCap = 'round';
        ctx.setLineDash(segment.kind === 'diffraction' ? [8, 10] : [20, 14]);
        ctx.beginPath();
        ctx.moveTo(segment.x1, segment.y1);
        ctx.lineTo(segment.x2, segment.y2);
        ctx.stroke();
        ctx.setLineDash([]);
    }
    
    renderLockedTargets(ctx) {
        // Render indicators for locked area attack targets
        this.lockedTargets.forEach(target => {
            if (!target.active) return;
            
            const progress = target.timer / this.targetLockDuration; // 0 to 1
            const flashProgress = Math.max(0, (target.timer - (this.targetLockDuration - this.targetFlashDuration)) / this.targetFlashDuration); // 0 to 1 during flash
            const sourceColor = target.source === 2 ? '#66f7ff' : '#ff4fff';
            
            ctx.save();
            if (target.lane) {
                ctx.globalAlpha = Math.max(0.18, 0.52 - progress * 0.22);
                ctx.strokeStyle = sourceColor;
                ctx.lineWidth = target.type === 'sync' ? 14 : 10;
                ctx.lineCap = 'round';
                ctx.setLineDash([24, 10]);
                ctx.beginPath();
                ctx.moveTo(target.lane.x1, target.lane.y1);
                ctx.lineTo(target.lane.x2, target.lane.y2);
                ctx.stroke();
                ctx.setLineDash([]);
                ctx.globalAlpha = 0.7;
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(target.lane.x1, target.lane.y1);
                ctx.lineTo(target.lane.x2, target.lane.y2);
                ctx.stroke();
            }
            
            // Initial warning ring (expanding)
            if (progress < 0.8) {
                ctx.strokeStyle = sourceColor;
                ctx.lineWidth = 3;
                ctx.globalAlpha = 0.6 - progress * 0.5;
                ctx.beginPath();
                ctx.arc(target.x, target.y, target.radius * (0.3 + progress * 0.7), 0, Math.PI * 2);
                ctx.stroke();
            }
            
            // Final flash before impact
            if (flashProgress > 0) {
                const flashIntensity = Math.sin(flashProgress * Math.PI * 10) * 0.5 + 0.5; // Fast flashing
                ctx.fillStyle = target.source === 2
                    ? `rgba(102, 247, 255, ${0.7 * flashIntensity})`
                    : `rgba(255, 79, 255, ${0.7 * flashIntensity})`;
                ctx.globalAlpha = 0.5 + flashIntensity * 0.5;
                ctx.beginPath();
                ctx.arc(target.x, target.y, target.radius, 0, Math.PI * 2);
                ctx.fill();
            } else {
                // Normal indicator ring
                ctx.strokeStyle = sourceColor;
                ctx.lineWidth = 2 + progress * 2;
                ctx.globalAlpha = 0.4 + progress * 0.4;
                ctx.beginPath();
                ctx.arc(target.x, target.y, target.radius, 0, Math.PI * 2);
                ctx.stroke();
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1.5;
                ctx.globalAlpha = 0.35 + progress * 0.25;
                ctx.beginPath();
                ctx.moveTo(target.x, target.y - target.radius * 0.45);
                ctx.lineTo(target.x + target.radius * 0.45, target.y);
                ctx.lineTo(target.x, target.y + target.radius * 0.45);
                ctx.lineTo(target.x - target.radius * 0.45, target.y);
                ctx.closePath();
                ctx.stroke();
            }
            
            ctx.restore();
        });
    }
    
    renderDiamond(ctx, diamond, color, isTelegraphing = false) {
        ctx.save();
        ctx.translate(diamond.x, diamond.y);
        ctx.rotate(diamond.angle);
        
        const visualSize = this.diamondSize; // Visual size
        
        // Base color
        ctx.fillStyle = this.colorSwapActive ? '#ffff00' : color;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        
        // If telegraphing, add pulsing glow effect
        if (isTelegraphing) {
            const pulse = Math.sin(this.telegraphTimer * Math.PI * 6) * 0.3 + 0.7; // Fast pulse
            const glowSize = visualSize * (1 + pulse * 0.3); // Scale up during pulse
            const telegraphColor = diamond === this.diamond2 ? '#66f7ff' : '#ff4fff';
            
            // Outer glow
            ctx.globalAlpha = pulse * 0.4;
            ctx.fillStyle = telegraphColor;
            ctx.beginPath();
            ctx.moveTo(0, -glowSize);
            ctx.lineTo(glowSize, 0);
            ctx.lineTo(0, glowSize);
            ctx.lineTo(-glowSize, 0);
            ctx.closePath();
            ctx.fill();
            
            ctx.globalAlpha = 1.0;
            ctx.fillStyle = this.colorSwapActive ? '#ffff00' : color;
        }
        
        ctx.beginPath();
        // Draw diamond (rotated square)
        ctx.moveTo(0, -visualSize);
        ctx.lineTo(visualSize, 0);
        ctx.lineTo(0, visualSize);
        ctx.lineTo(-visualSize, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        ctx.restore();
        
        // If telegraphing, draw warning indicator line using turret tracking angle (after restore so we're in world space)
        if (isTelegraphing && typeof Game !== 'undefined' && Game.player) {
            ctx.save();
            ctx.strokeStyle = diamond === this.diamond2 ? '#66f7ff' : '#ff4fff';
            ctx.lineWidth = 4;
            ctx.globalAlpha = 0.6 + Math.sin(this.telegraphTimer * Math.PI * 8) * 0.4;
            
            // Use turret tracking angle instead of direct angle to player
            let trackingAngle;
            if (diamond === this.diamond1) {
                trackingAngle = this.trackingAngle1;
            } else {
                trackingAngle = this.trackingAngle2;
            }
            
            // Draw line indicating attack direction using tracking angle
            const lineLength = visualSize * 3; // Longer line for better visibility
            ctx.beginPath();
            ctx.moveTo(diamond.x, diamond.y);
            ctx.lineTo(diamond.x + Math.cos(trackingAngle) * lineLength, diamond.y + Math.sin(trackingAngle) * lineLength);
            ctx.stroke();
            
            ctx.globalAlpha = 1.0;
            ctx.restore();
        }
    }
    
    renderMotionTrails(ctx) {
        // Render motion trails for split dash attack
        ctx.save();
        
        // Render trail for diamond 1 (magenta)
        if (this.splitDashTrail1.length > 1) {
            ctx.strokeStyle = '#ff00ff';
            ctx.lineWidth = 4;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            for (let i = 1; i < this.splitDashTrail1.length; i++) {
                const previous = this.splitDashTrail1[i - 1];
                const point = this.splitDashTrail1[i];
                ctx.globalAlpha = Math.max(0, point.alpha * 0.6);
                ctx.beginPath();
                ctx.moveTo(previous.x, previous.y);
                ctx.lineTo(point.x, point.y);
                ctx.stroke();
            }
        }
        
        // Render trail for diamond 2 (cyan)
        if (this.splitDashTrail2.length > 1) {
            ctx.strokeStyle = '#00ffff';
            ctx.lineWidth = 4;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            for (let i = 1; i < this.splitDashTrail2.length; i++) {
                const previous = this.splitDashTrail2[i - 1];
                const point = this.splitDashTrail2[i];
                ctx.globalAlpha = Math.max(0, point.alpha * 0.6);
                ctx.beginPath();
                ctx.moveTo(previous.x, previous.y);
                ctx.lineTo(point.x, point.y);
                ctx.stroke();
            }
        }
        
        ctx.restore();
    }
    
    // Serialize boss state for multiplayer sync
    serialize() {
        const base = super.serialize();
        return {
            ...base,
            // Twin Prism specific properties
            diamond1: {
                x: this.diamond1.x,
                y: this.diamond1.y,
                angle: this.diamond1.angle
            },
            diamond2: {
                x: this.diamond2.x,
                y: this.diamond2.y,
                angle: this.diamond2.angle
            },
            centerX: this.centerX,
            centerY: this.centerY,
            rotationAngle: this.rotationAngle,
            separation: this.separation,
            state: this.state,
            stateTimer: this.stateTimer,
            positioningMode: this.positioningMode,
            telegraphActive: this.telegraphActive,
            telegraphTimer: this.telegraphTimer,
            telegraphDiamond: this.telegraphDiamond,
            telegraphType: this.telegraphType,
            colorSwapActive: this.colorSwapActive,
            colorSwapTimer: this.colorSwapTimer,
            mergeSlamActive: this.mergeSlamActive,
            mergeSlamTimer: this.mergeSlamTimer,
            lockedTargets: this.lockedTargets,
            trackingAngle1: this.trackingAngle1,
            trackingAngle2: this.trackingAngle2,
            splitTargetSeparation: this.splitTargetSeparation,
            splitDashTarget1: this.splitDashTarget1,
            splitDashTarget2: this.splitDashTarget2,
            splitDashTrail1: this.splitDashTrail1,
            splitDashTrail2: this.splitDashTrail2,
            refractionSegments: this.refractionSegments,
            refractionAnchors: this.refractionAnchors,
            refractionTimer: this.refractionTimer,
            refractionState: this.refractionState,
            refractionArmed: this.refractionArmed,
            refractionBurstFired: this.refractionBurstFired,
            refractionSequenceActive: this.refractionSequenceActive,
            lightCage: this.lightCage,
            lightCageCooldown: this.lightCageCooldown,
            syncExecuted: this.syncExecuted,
            dash1Executed: this.dash1Executed,
            dash2Executed: this.dash2Executed,
            splitDashExecuted: this.splitDashExecuted,
            swapExecuted: this.swapExecuted,
            phase3DashCycleIndex: this.phase3DashCycleIndex,
            phase3MergeCycleIndex: this.phase3MergeCycleIndex,
            spiralSequence: this.spiralSequence,
            phase3ProjectileWindup: this.phase3ProjectileWindup,
            phase3ProjectileWindupTimer: this.phase3ProjectileWindupTimer,
            phase3SpiralPreviewAngle: this.phase3SpiralPreviewAngle,
            bulletHellCooldown: this.bulletHellCooldown,
            spiralBurstCooldown: this.spiralBurstCooldown
        };
    }
    
    // Apply state from host (for multiplayer clients)
    applyState(state) {
        // Apply base enemy state first (handles position, HP, etc.)
        // This will set interpolation targets for boss position
        super.applyState(state);
        
        // Apply Twin Prism specific properties
        // Note: We don't set diamond positions directly - they're calculated in updateDiamondPositions()
        // based on centerX/centerY, rotationAngle, and separation, which are synced here
        if (state.centerX !== undefined) this.centerX = state.centerX;
        if (state.centerY !== undefined) this.centerY = state.centerY;
        if (state.rotationAngle !== undefined) this.rotationAngle = state.rotationAngle;
        if (state.separation !== undefined) this.separation = state.separation;
        if (state.state !== undefined) this.state = state.state;
        if (state.stateTimer !== undefined) this.stateTimer = state.stateTimer;
        if (state.trackingAngle1 !== undefined) this.trackingAngle1 = state.trackingAngle1;
        if (state.trackingAngle2 !== undefined) this.trackingAngle2 = state.trackingAngle2;
        if (state.splitTargetSeparation !== undefined) this.splitTargetSeparation = state.splitTargetSeparation;
        if (state.splitDashTarget1 !== undefined) this.splitDashTarget1 = state.splitDashTarget1;
        if (state.splitDashTarget2 !== undefined) this.splitDashTarget2 = state.splitDashTarget2;
        if (Array.isArray(state.refractionSegments)) this.refractionSegments = state.refractionSegments;
        if (Array.isArray(state.refractionAnchors)) this.refractionAnchors = state.refractionAnchors;
        if (state.refractionTimer !== undefined) this.refractionTimer = state.refractionTimer;
        if (state.refractionArmed !== undefined) this.refractionArmed = state.refractionArmed;
        if (state.refractionBurstFired !== undefined) this.refractionBurstFired = state.refractionBurstFired;
        if (state.lightCage !== undefined) this.lightCage = state.lightCage;
        if (state.lightCageCooldown !== undefined) this.lightCageCooldown = state.lightCageCooldown;

        if (state.positioningMode !== undefined) this.positioningMode = state.positioningMode;
        if (state.telegraphActive !== undefined) this.telegraphActive = state.telegraphActive;
        if (state.telegraphTimer !== undefined) this.telegraphTimer = state.telegraphTimer;
        if (state.telegraphDiamond !== undefined) this.telegraphDiamond = state.telegraphDiamond;
        if (state.telegraphType !== undefined) this.telegraphType = state.telegraphType;
        if (state.colorSwapActive !== undefined) this.colorSwapActive = state.colorSwapActive;
        if (state.colorSwapTimer !== undefined) this.colorSwapTimer = state.colorSwapTimer;
        if (state.mergeSlamActive !== undefined) this.mergeSlamActive = state.mergeSlamActive;
        if (state.mergeSlamTimer !== undefined) this.mergeSlamTimer = state.mergeSlamTimer;
        if (Array.isArray(state.lockedTargets)) {
            this.lockedTargets = state.lockedTargets.map(target => ({
                ...target,
                lane: target && target.lane ? { ...target.lane } : null
            }));
        }
        if (Array.isArray(state.splitDashTrail1)) this.splitDashTrail1 = state.splitDashTrail1.map(point => ({ ...point }));
        if (Array.isArray(state.splitDashTrail2)) this.splitDashTrail2 = state.splitDashTrail2.map(point => ({ ...point }));
        if (state.refractionState !== undefined) this.refractionState = state.refractionState;
        if (state.refractionSequenceActive !== undefined) this.refractionSequenceActive = state.refractionSequenceActive;
        if (state.syncExecuted !== undefined) this.syncExecuted = state.syncExecuted;
        if (state.dash1Executed !== undefined) this.dash1Executed = state.dash1Executed;
        if (state.dash2Executed !== undefined) this.dash2Executed = state.dash2Executed;
        if (state.splitDashExecuted !== undefined) this.splitDashExecuted = state.splitDashExecuted;
        if (state.swapExecuted !== undefined) this.swapExecuted = state.swapExecuted;
        if (state.phase3DashCycleIndex !== undefined) this.phase3DashCycleIndex = state.phase3DashCycleIndex;
        if (state.phase3MergeCycleIndex !== undefined) this.phase3MergeCycleIndex = state.phase3MergeCycleIndex;
        if (state.spiralSequence !== undefined) this.spiralSequence = state.spiralSequence;
        if (state.phase3ProjectileWindup !== undefined) this.phase3ProjectileWindup = state.phase3ProjectileWindup;
        if (state.phase3ProjectileWindupTimer !== undefined) this.phase3ProjectileWindupTimer = state.phase3ProjectileWindupTimer;
        if (state.phase3SpiralPreviewAngle !== undefined) this.phase3SpiralPreviewAngle = state.phase3SpiralPreviewAngle;
        if (state.bulletHellCooldown !== undefined) this.bulletHellCooldown = state.bulletHellCooldown;
        if (state.spiralBurstCooldown !== undefined) this.spiralBurstCooldown = state.spiralBurstCooldown;

        // Sync diamond positions and angles for override-owned animations.
        if (state.diamond1) {
            if (state.diamond1.x !== undefined) this.diamond1.x = state.diamond1.x;
            if (state.diamond1.y !== undefined) this.diamond1.y = state.diamond1.y;
            if (state.diamond1.angle !== undefined) this.diamond1.angle = state.diamond1.angle;
        }
        if (state.diamond2) {
            if (state.diamond2.x !== undefined) this.diamond2.x = state.diamond2.x;
            if (state.diamond2.y !== undefined) this.diamond2.y = state.diamond2.y;
            if (state.diamond2.angle !== undefined) this.diamond2.angle = state.diamond2.angle;
        }
        
        // Ensure center position matches boss position (for clients)
        // The boss position (this.x, this.y) is interpolated, so we need to sync center
        // This ensures diamonds follow the interpolated boss position
        this.centerX = this.x;
        this.centerY = this.y;
    }
}

