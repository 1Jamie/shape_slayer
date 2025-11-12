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
        
        // Add weak point at center connection
        this.addWeakPoint(0, 0, 10, 0);
    }
    
    update(deltaTime, player) {
        if (!this.introComplete) return;
        // Get player from getAllAlivePlayers if not provided
        if (!player) {
            const nearestPlayer = this.getNearestPlayer();
            if (!nearestPlayer || !nearestPlayer.alive) return;
            player = nearestPlayer;
        }
        if (!this.alive || !player || !player.alive) return;
        
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
                    if (isFinite(target.x) && isFinite(target.y)) {
                        this.createDamageZone(target.x, target.y, target.radius || 50, target.duration || 1.2, target.damage || this.damage);
                    }
                    return false; // Remove from array
                }
                return true; // Keep in array
            });
        }
        
        // Phase-based behavior
        if (this.phase === 1) {
            this.updatePhase1(deltaTime, player);
        } else if (this.phase === 2) {
            this.updatePhase2(deltaTime, player);
        } else {
            this.updatePhase3(deltaTime, player);
        }
        
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
    }
    
    updateDiamondPositions(deltaTime) {
        // Skip normal positioning during split dash phase (manual positioning handles it)
        if (this.state === 'split' && this.stateTimer >= 1.1 && this.stateTimer < 1.6) {
            // During dash phase, only update angles for visual rotation
            const angle1 = this.rotationAngle;
            const angle2 = this.rotationAngle + Math.PI;
            this.diamond1.angle = angle1;
            this.diamond2.angle = angle2;
            return; // Skip position updates, they're handled manually in split state
        }
        
        // Skip normal positioning during split return phase (handled in split state)
        if (this.state === 'split' && this.stateTimer >= 1.6) {
            // Return phase handles positioning, but we still update angles
            const angle1 = this.rotationAngle;
            const angle2 = this.rotationAngle + Math.PI;
            this.diamond1.angle = angle1;
            this.diamond2.angle = angle2;
            return; // Skip position updates, they're handled in split return phase
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
            const targetDistance = Math.sqrt(dx * dx + dy * dy);
            if (targetDistance > 0) {
                this.x += (dx / targetDistance) * this.moveSpeed * deltaTime * 0.6;
                this.y += (dy / targetDistance) * this.moveSpeed * deltaTime * 0.6;
            }
            
            // Choose attack
            if (this.dashCooldown <= 0 && distance < 250) {
                this.state = 'dash';
                this.stateTimer = 0;
                this.beamTelegraphTimer = null; // Reset beam telegraph if switching to different attack
                if (this.telegraphType === 'beam') this.telegraphActive = false;
            } else if (this.rotateCooldown <= 0 && distance < 200) {
                this.state = 'rotate';
                this.stateTimer = 0;
                this.beamTelegraphTimer = null; // Reset beam telegraph if switching to different attack
                if (this.telegraphType === 'beam') this.telegraphActive = false;
            } else if (this.beamCooldown <= 0 && distance > 200) {
                // Prism beam when player is far - with telegraph
                if (!this.beamTelegraphTimer) {
                    this.beamTelegraphTimer = 0.8; // 0.8s telegraph for aiming
                    this.telegraphActive = true;
                    this.telegraphTimer = 0;
                    this.telegraphDiamond = 'both';
                    this.telegraphType = 'beam';
                }
                this.beamTelegraphTimer -= deltaTime;
                if (this.beamTelegraphTimer <= 0) {
                    this.prismBeam(player);
                    this.beamCooldown = 5.0;
                    this.telegraphActive = false;
                    this.beamTelegraphTimer = null;
                }
            } else if (this.swapCooldown <= 0) {
                this.state = 'swap';
                this.stateTimer = 0;
                this.beamTelegraphTimer = null; // Reset beam telegraph if switching to different attack
                if (this.telegraphType === 'beam') this.telegraphActive = false;
            } else if (this.syncCooldown <= 0 && distance < 180) {
                this.state = 'sync';
                this.stateTimer = 0;
                this.beamTelegraphTimer = null; // Reset beam telegraph if switching to different attack
                if (this.telegraphType === 'beam') this.telegraphActive = false;
            } else {
                // Reset beam telegraph if not using beam attack
                this.beamTelegraphTimer = null;
                if (this.telegraphType === 'beam') {
                    this.telegraphActive = false;
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
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > 0) {
                    this.x += (dx / dist) * this.moveSpeed * deltaTime * 0.8; // Move toward target
                    this.y += (dy / dist) * this.moveSpeed * deltaTime * 0.8;
                }
                
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
                const temp = { ...this.diamond1 };
                this.diamond1 = { ...this.diamond2 };
                this.diamond2 = temp;
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
                this.syncCooldown = 5.5; // Increased from 4.0 for more time between attacks
            }
        } else {
            // Safety fallback: if state is invalid, reset to chase
            if (!this.state || (this.state !== 'chase' && this.state !== 'dash' && this.state !== 'rotate' && 
                this.state !== 'swap' && this.state !== 'sync' && this.state !== 'split' && this.state !== 'merge')) {
                this.state = 'chase';
                this.stateTimer = 0;
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
            const targetDistance = Math.sqrt(dx * dx + dy * dy);
            if (targetDistance > 0) {
                this.x += (dx / targetDistance) * this.moveSpeed * deltaTime * 0.7; // Increased from 0.5
                this.y += (dy / targetDistance) * this.moveSpeed * deltaTime * 0.7;
            }
            
            // Choose attack - ensure all states can be triggered
            if (this.dashCooldown <= 0) {
                this.state = 'split';
                this.stateTimer = 0;
                this.beamTelegraphTimer = null; // Reset beam telegraph if switching
                if (this.telegraphType === 'beam') this.telegraphActive = false;
            } else if (this.rotateCooldown <= 0 && distance < 200) {
                this.state = 'rotate';
                this.stateTimer = 0;
                this.beamTelegraphTimer = null; // Reset beam telegraph if switching
                if (this.telegraphType === 'beam') this.telegraphActive = false;
            } else if (this.swapCooldown <= 0) {
                this.state = 'swap';
                this.stateTimer = 0;
                this.swapCooldown = 4.0; // More frequent
                this.beamTelegraphTimer = null; // Reset beam telegraph if switching
                if (this.telegraphType === 'beam') this.telegraphActive = false;
            } else {
                // Reset beam telegraph if not using beam attack
                this.beamTelegraphTimer = null;
                if (this.telegraphType === 'beam') {
                    this.telegraphActive = false;
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
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > 0) {
                    this.x += (dx / dist) * this.moveSpeed * deltaTime * 0.9; // Move toward target (faster in Phase 2)
                    this.y += (dy / dist) * this.moveSpeed * deltaTime * 0.9;
                }
                
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
                const temp = { ...this.diamond1 };
                this.diamond1 = { ...this.diamond2 };
                this.diamond2 = temp;
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
        }
        
        // Safety check: ensure deltaTime is valid
        if (!isFinite(deltaTime) || deltaTime <= 0 || deltaTime > 1.0) {
            deltaTime = 0.016; // Default to ~60fps if invalid
        }
        
        // Frenzy mode: constant spinning + dashing
        this.rotationAngle += Math.PI * 6 * deltaTime; // Very fast rotation
        
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
        const dashCycle = this.stateTimer % 2.0;
        if (dashCycle < 0.9) {
            // Long windup before dash (visible telegraph)
            this.telegraphActive = true;
            this.telegraphTimer = dashCycle;
            this.telegraphDiamond = dashCycle % 1.0 < 0.45 ? 1 : 2;
            this.telegraphType = 'dash';
        } else if (dashCycle < 1.0) {
            // Dash (less frequent than before)
            this.telegraphActive = false;
            this.dualDashPattern(this.stateTimer % 3.0 < 1.5);
        } else {
            this.telegraphActive = false;
        }
        
        // Occasionally merge form for slam (every 5 seconds)
        if (Math.floor(this.stateTimer) % 5 === 0 && this.stateTimer % 5.0 < 0.2 && !this.mergeSlamActive) {
            this.mergedFormSlam(player);
        }
        
        // Update merge slam if active
        if (this.mergeSlamActive) {
            this.mergeSlamTimer += deltaTime;
            if (this.mergeSlamTimer >= 0.2) {
                this.createShockwave(this.x, this.y, 120, 0.6, this.damage * 1.5);
                this.separation = this.oldSeparation;
                this.mergeSlamActive = false;
                this.mergeSlamTimer = 0;
            }
        }
        
        // Chase player (slower in Phase 3 to allow dodging)
        // Target already calculated above
        const dx = target.x - this.x;
        const dy = target.y - this.y;
        if (distance > 0) {
            this.x += (dx / distance) * this.moveSpeed * deltaTime * 0.5; // Reduced from 0.9 for better dodging
            this.y += (dy / distance) * this.moveSpeed * deltaTime * 0.5;
        }
        
        // Bullet hell mechanics - keep players moving when far away
        // Update cooldowns
        if (this.bulletHellCooldown > 0) {
            this.bulletHellCooldown -= deltaTime;
        }
        if (this.spiralBurstCooldown > 0) {
            this.spiralBurstCooldown -= deltaTime;
        }
        
        // Targeted burst (when player is far or after dash)
        if (this.bulletHellCooldown <= 0 && distance > 200) {
            this.targetedBurst(target);
            this.bulletHellCooldown = 1.5; // Fire every 1.5 seconds
        }
        
        // Spiral pattern (less frequent, more intense)
        if (this.spiralBurstCooldown <= 0) {
            this.spiralBurst();
            this.spiralBurstCooldown = 3.0; // Every 3 seconds
        }
    }
    
    // Targeted burst - fires projectiles toward player with spread
    targetedBurst(target) {
        if (typeof Game === 'undefined') return;
        
        const dx = target.x - this.x;
        const dy = target.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 0) {
            const baseAngle = Math.atan2(dy, dx);
            const projectileSpeed = 299.6;
            const count = 5; // 5 projectiles in spread
            
            // Fire from both diamonds for double the threat
            for (let diamond of [this.diamond1, this.diamond2]) {
                for (let i = 0; i < count; i++) {
                    const spread = (i - (count - 1) / 2) * 0.15; // Spread angle
                    const angle = baseAngle + spread;
                    
                    Game.projectiles.push({
                        x: diamond.x,
                        y: diamond.y,
                        vx: Math.cos(angle) * projectileSpeed,
                        vy: Math.sin(angle) * projectileSpeed,
                        damage: this.damage * 0.7,
                        size: 8,
                        lifetime: 2.5,
                        elapsed: 0,
                        color: diamond === this.diamond1 ? '#ff00ff' : '#00ffff'
                    });
                }
            }
        }
    }
    
    // Spiral burst - expanding spiral pattern from center
    spiralBurst() {
        if (typeof Game === 'undefined') return;
        
        const spiralAngle = Date.now() / 200; // Slower rotation for visibility
        const projectileSpeed = 267.5;
        const count = 12; // 12 projectiles in full circle
        
        // Fire spiral from center
        for (let i = 0; i < count; i++) {
            const angle = spiralAngle + (Math.PI * 2 / count) * i;
            Game.projectiles.push({
                x: this.x,
                y: this.y,
                vx: Math.cos(angle) * projectileSpeed,
                vy: Math.sin(angle) * projectileSpeed,
                damage: this.damage * 0.6,
                size: 7,
                lifetime: 3.0,
                elapsed: 0,
                color: '#ff00ff'
            });
        }
        
        // Also fire tighter spiral from each diamond (offset angle)
        for (let diamond of [this.diamond1, this.diamond2]) {
            const offset = diamond === this.diamond1 ? Math.PI / 4 : -Math.PI / 4;
            for (let i = 0; i < 8; i++) {
                const angle = spiralAngle + offset + (Math.PI * 2 / 8) * i;
                Game.projectiles.push({
                    x: diamond.x,
                    y: diamond.y,
                    vx: Math.cos(angle) * (projectileSpeed * 0.8), // Slightly slower
                    vy: Math.sin(angle) * (projectileSpeed * 0.8),
                    damage: this.damage * 0.5,
                    size: 6,
                    lifetime: 2.5,
                    elapsed: 0,
                    color: diamond === this.diamond1 ? '#ff00ff' : '#00ffff'
                });
            }
        }
    }
    
    // Alternating dash pattern - uses turret tracking angle with lock-on
    dualDashPattern(diamond1) {
        if (typeof Game === 'undefined' || !Game.player) return;
        
        const target = diamond1 ? this.diamond1 : this.diamond2;
        
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
            active: true
        });
        
        // Update diamond position (dash with more reach)
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
            active: true
        });
        
        // Both diamonds dash toward their tracked directions (both aiming at player)
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
    
    render(ctx) {
        if (!this.alive) return;
        
        // Determine colors based on telegraph state
        let color1 = '#ff00ff';
        let color2 = '#ff88ff';
        
        if (this.telegraphActive) {
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
        
        // Render motion trails during split dash (before diamonds so they appear behind)
        if (this.state === 'split' && this.stateTimer >= 1.1 && this.stateTimer < 1.6) {
            this.renderMotionTrails(ctx);
        }
        
        // Render two diamonds
        this.renderDiamond(ctx, this.diamond1, color1, this.telegraphActive && (this.telegraphDiamond === 1 || this.telegraphDiamond === 'both'));
        this.renderDiamond(ctx, this.diamond2, color2, this.telegraphActive && (this.telegraphDiamond === 2 || this.telegraphDiamond === 'both'));
        
        // Render center weak point (visible when separated)
        if (this.separation > 40) {
            this.renderWeakPoints(ctx);
        } else if (this.colorSwapActive) {
            // Glow brighter during color swap
            const wp = this.weakPoints[0];
            if (wp) {
                ctx.save();
                const wpX = this.x + wp.offsetX;
                const wpY = this.y + wp.offsetY;
                const glow = Math.sin(Date.now() / 50) * 0.5 + 1.0;
                
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
        
        // Render health bar
        this.renderHealthBar(ctx);
    }
    
    renderLockedTargets(ctx) {
        // Render indicators for locked area attack targets
        this.lockedTargets.forEach(target => {
            if (!target.active) return;
            
            const progress = target.timer / this.targetLockDuration; // 0 to 1
            const flashProgress = Math.max(0, (target.timer - (this.targetLockDuration - this.targetFlashDuration)) / this.targetFlashDuration); // 0 to 1 during flash
            
            ctx.save();
            
            // Initial warning ring (expanding)
            if (progress < 0.8) {
                ctx.strokeStyle = '#ff0000';
                ctx.lineWidth = 3;
                ctx.globalAlpha = 0.6 - progress * 0.5;
                ctx.beginPath();
                ctx.arc(target.x, target.y, target.radius * (0.3 + progress * 0.7), 0, Math.PI * 2);
                ctx.stroke();
            }
            
            // Final flash before impact
            if (flashProgress > 0) {
                const flashIntensity = Math.sin(flashProgress * Math.PI * 10) * 0.5 + 0.5; // Fast flashing
                ctx.fillStyle = `rgba(255, 0, 0, ${0.7 * flashIntensity})`;
                ctx.globalAlpha = 0.5 + flashIntensity * 0.5;
                ctx.beginPath();
                ctx.arc(target.x, target.y, target.radius, 0, Math.PI * 2);
                ctx.fill();
            } else {
                // Normal indicator ring
                ctx.strokeStyle = '#ff0000';
                ctx.lineWidth = 2 + progress * 2;
                ctx.globalAlpha = 0.4 + progress * 0.4;
                ctx.beginPath();
                ctx.arc(target.x, target.y, target.radius, 0, Math.PI * 2);
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
            
            // Outer glow
            ctx.globalAlpha = pulse * 0.4;
            ctx.fillStyle = '#ff0000';
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
            ctx.strokeStyle = '#ff0000';
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
            
            ctx.beginPath();
            for (let i = 0; i < this.splitDashTrail1.length; i++) {
                const point = this.splitDashTrail1[i];
                const alpha = point.alpha * 0.6;
                ctx.globalAlpha = alpha;
                
                if (i === 0) {
                    ctx.moveTo(point.x, point.y);
                } else {
                    ctx.lineTo(point.x, point.y);
                }
            }
            ctx.stroke();
        }
        
        // Render trail for diamond 2 (cyan)
        if (this.splitDashTrail2.length > 1) {
            ctx.strokeStyle = '#00ffff';
            ctx.lineWidth = 4;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            
            ctx.beginPath();
            for (let i = 0; i < this.splitDashTrail2.length; i++) {
                const point = this.splitDashTrail2[i];
                const alpha = point.alpha * 0.6;
                ctx.globalAlpha = alpha;
                
                if (i === 0) {
                    ctx.moveTo(point.x, point.y);
                } else {
                    ctx.lineTo(point.x, point.y);
                }
            }
            ctx.stroke();
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
            trackingAngle1: this.trackingAngle1,
            trackingAngle2: this.trackingAngle2,
            splitTargetSeparation: this.splitTargetSeparation,
            splitDashTarget1: this.splitDashTarget1,
            splitDashTarget2: this.splitDashTarget2
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
        
        // Sync diamond angles if provided (for visual consistency)
        if (state.diamond1 && state.diamond1.angle !== undefined) {
            this.diamond1.angle = state.diamond1.angle;
        }
        if (state.diamond2 && state.diamond2.angle !== undefined) {
            this.diamond2.angle = state.diamond2.angle;
        }
        
        // Ensure center position matches boss position (for clients)
        // The boss position (this.x, this.y) is interpolated, so we need to sync center
        // This ensures diamonds follow the interpolated boss position
        this.centerX = this.x;
        this.centerY = this.y;
    }
}

