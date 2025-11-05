// Base enemy class with common functionality

class EnemyBase {
    constructor(x, y, inheritedTarget = null) {
        // Position
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.rotation = 0; // Facing direction (in radians, 0 = right)
        
        // Knockback system
        this.knockbackVx = 0;
        this.knockbackVy = 0;
        this.knockbackDecay = 0.5; // Per second decay rate (faster decay = shorter knockback)
        
        // Stun system
        this.stunned = false;
        this.stunDuration = 0;
        this.stunSlowFactor = 0.5; // 50% speed reduction when stunned
        this.baseMoveSpeed = 100; // Store original move speed before stun
        
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
        this.threatWindowDuration = 5.0; // 5 second rolling window
        
        // Target lock system (prevents jittering when targeting clones/decoys)
        this.targetLock = null; // Locked target { x, y, type: 'player'|'clone'|'decoy', ref }
        this.targetLockDuration = 1.5; // How long to maintain lock (seconds)
        this.targetLockTimer = 0; // Time remaining on current lock
        
        // Detection/activation system
        this.detectionRange = 400; // Range to detect and activate on player proximity (pixels)
        this.activated = false; // Whether enemy has been activated (detected a player)
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
        if (!player || !player.alive) return { x: this.x, y: this.y };
        
        // Check if player has a blink decoy or shadow clones active - target decoy/clone instead of player
        if (player.blinkDecoyActive) {
            targetX = player.blinkDecoyX;
            targetY = player.blinkDecoyY;
            lockType = 'decoy';
            lockPlayerRef = player;
        } else if (player.shadowClonesActive && player.shadowClones && player.shadowClones.length > 0) {
            // Target the nearest shadow clone instead of the player and LOCK onto it
            let nearestDist = Infinity;
            let nearestClone = null;
            let nearestIndex = -1;
            
            player.shadowClones.forEach((clone, index) => {
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
                lockPlayerRef = player;
                lockCloneIndex = nearestIndex;
            } else {
                // No valid clones, target player
                targetX = player.x;
                targetY = player.y;
                lockType = 'player';
                lockPlayerRef = player;
            }
        } else {
            // No decoys/clones, target player
            targetX = player.x;
            targetY = player.y;
            lockType = 'player';
            lockPlayerRef = player;
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
    
    // Calculate avoidance force to dodge player attacks
    avoidPlayerAttacks(player, avoidanceRadius = 60) {
        if (!player || !player.attackHitboxes || player.attackHitboxes.length === 0) {
            return { x: 0, y: 0 };
        }
        
        let avoidanceX = 0;
        let avoidanceY = 0;
        
        player.attackHitboxes.forEach(hitbox => {
            const dx = this.x - hitbox.x;
            const dy = this.y - hitbox.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < avoidanceRadius && dist > 0) {
                const strength = (avoidanceRadius - dist) / avoidanceRadius * 200;
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
        if (this.targetRotation !== undefined) {
            let rotDiff = this.targetRotation - this.rotation;
            // Normalize to [-PI, PI]
            while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
            while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
            this.rotation += rotDiff * t;
        }
        
        // Snap the last bit if very close to prevent micro-jitter
        if (distance < 0.1) {
            this.x = this.targetX;
            this.y = this.targetY;
            if (this.targetRotation !== undefined) {
                this.rotation = this.targetRotation;
            }
        }
    }
    
    // Update state from host (for multiplayer clients)
    updateFromHost(hostData) {
        // Calculate velocity for extrapolation
        if (this.targetX !== null && this.targetY !== null && this.x !== undefined && this.y !== undefined) {
            const dt = (Date.now() - this.lastUpdateTime) / 1000;
            if (dt > 0 && dt < 1) { // Sanity check
                this.lastVelocityX = (hostData.x - this.x) / dt;
                this.lastVelocityY = (hostData.y - this.y) / dt;
            }
        }
        
        // Set interpolation targets for smooth movement
        this.targetX = hostData.x;
        this.targetY = hostData.y;
        this.targetRotation = hostData.rotation;
        
        // Update timestamp for velocity calculation
        this.lastUpdateTime = Date.now();
        
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
                    allPlayers.push({
                        id: `local-clone-${i}`,
                        player: clone
                    });
                });
            }
            
            if (Game.player.blinkDecoyActive) {
                allPlayers.push({
                    id: 'local-blink-decoy',
                    player: { x: Game.player.blinkDecoyX, y: Game.player.blinkDecoyY }
                });
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
                            allPlayers.push({
                                id: `${playerId}-clone-${i}`,
                                player: clone
                            });
                        });
                    }
                    
                    if (playerInstance.blinkDecoyActive) {
                        allPlayers.push({
                            id: `${playerId}-blink-decoy`,
                            player: { x: playerInstance.blinkDecoyX, y: playerInstance.blinkDecoyY }
                        });
                    }
                }
            });
        }
        
        return allPlayers;
    }
    
    // Get player by ID (for aggro targeting)
    getPlayerById(playerId) {
        // Check local player
        if (typeof Game !== 'undefined' && Game.player && Game.getLocalPlayerId) {
            if (Game.getLocalPlayerId() === playerId) {
                return Game.player;
            }
        }
        
        // Check remote player INSTANCES (host simulates these)
        if (typeof Game !== 'undefined' && Game.remotePlayerInstances) {
            const playerInstance = Game.remotePlayerInstances.get(playerId);
            if (playerInstance) return playerInstance;
            
            // Check remote player decoys/clones
            for (const [pid, instance] of Game.remotePlayerInstances) {
                if (playerId.startsWith(`${pid}-clone-`)) {
                    const index = parseInt(playerId.split('-')[2]);
                    if (instance.shadowClones && instance.shadowClones[index]) {
                        return instance.shadowClones[index];
                    }
                }
                if (playerId === `${pid}-blink-decoy` && instance.blinkDecoyActive) {
                    return { x: instance.blinkDecoyX, y: instance.blinkDecoyY };
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
            dashElapsed: this.dashElapsed
        };
    }
    
    // Apply state from host (uses updateFromHost which sets interpolation targets)
    applyState(state) {
        // Use existing updateFromHost method
        if (this.updateFromHost) {
            this.updateFromHost(state);
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

