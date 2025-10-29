// Main game loop and initialization

const Game = {
    // Canvas and context
    canvas: null,
    ctx: null,
    
    // Game state
    state: 'MENU', // 'MENU', 'PLAYING', 'PAUSED'
    paused: false,
    lastTime: 0,
    
    // Class selection
    selectedClass: null,
    mouse: { x: 0, y: 0 },
    clickHandled: false,
    
    // Game config
    config: {
        width: 800,
        height: 600,
        targetFPS: 60,
        fpsInterval: 1000 / 60
    },
    
    // Game objects
    player: null,
    enemies: [],
    projectiles: [],
    particles: [],
    damageNumbers: [],
    
    // Stats tracking
    enemiesKilled: 0,
    roomNumber: 1,
    doorPulse: 0, // For door animation
    
    // Screen shake system
    screenShakeOffset: { x: 0, y: 0 },
    screenShakeIntensity: 0,
    screenShakeDuration: 0,
    hitPauseTime: 0, // For brief freezes on big hits
    
    // Level up message
    levelUpMessageActive: false,
    levelUpMessageTime: 0,
    
    // FPS tracking
    fps: 0,
    lastFpsUpdate: 0,
    frameCount: 0,
    
    // Input state tracking
    lastGKeyState: false,
    
    // Time tracking for death screen
    startTime: 0,
    endTime: 0,
    
    // Initialize the game
    init() {
        console.log('Initializing Shape Slayer...');
        
        // Get canvas and context
        this.canvas = document.getElementById('gameCanvas');
        if (!this.canvas) {
            console.error('Canvas element not found!');
            return;
        }
        
        this.ctx = this.canvas.getContext('2d');
        
        // Set canvas dimensions
        this.canvas.width = this.config.width;
        this.canvas.height = this.config.height;
        
        // Initialize input system
        Input.init(this.canvas);
        
        // Player will be created after class selection
        this.player = null;
        
        // Handle pause toggle with ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (this.state === 'PLAYING') {
                    this.togglePause();
                } else if (this.state === 'PAUSED') {
                    this.togglePause(); // Resume
                }
            }
            if (e.key === 'r' || e.key === 'R') {
                if (this.player && this.player.dead) {
                    this.restart();
                }
            }
        });
        
        console.log('Game initialized successfully');
        this.start();
    },
    
    // Start the game loop
    start() {
        this.lastTime = performance.now();
        this.gameLoop();
    },
    
    // Main game loop
    gameLoop(currentTime = 0) {
        // Calculate delta time
        let deltaTime = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;
        
        // Cap delta time to prevent huge jumps (max 16ms)
        deltaTime = Math.min(deltaTime, 0.016);
        
        // Handle hit pause
        if (this.hitPauseTime > 0) {
            this.hitPauseTime -= deltaTime;
            if (this.hitPauseTime <= 0) {
                this.hitPauseTime = 0;
            } else {
                // Skip update but still render
                this.render();
                requestAnimationFrame((time) => this.gameLoop(time));
                return;
            }
        }
        
        // FPS tracking
        this.frameCount++;
        if (currentTime - this.lastFpsUpdate >= 1000) {
            this.fps = this.frameCount;
            this.frameCount = 0;
            this.lastFpsUpdate = currentTime;
        }
        
        // Update and render based on state
        if (this.state === 'PLAYING') {
            this.update(deltaTime);
        }
        
        this.render();
        
        // Continue the loop
        requestAnimationFrame((time) => this.gameLoop(time));
    },
    
    // Trigger screen shake
    triggerScreenShake(intensity, duration) {
        this.screenShakeIntensity = intensity;
        this.screenShakeDuration = duration;
    },
    
    // Trigger hit pause
    triggerHitPause(duration = 0.1) {
        this.hitPauseTime = duration;
    },
    
    // Update screen shake
    updateScreenShake(deltaTime) {
        if (this.screenShakeDuration > 0) {
            this.screenShakeDuration -= deltaTime;
            
            // Generate random shake offset
            this.screenShakeOffset.x = (Math.random() - 0.5) * this.screenShakeIntensity * 10;
            this.screenShakeOffset.y = (Math.random() - 0.5) * this.screenShakeIntensity * 10;
            
            if (this.screenShakeDuration <= 0) {
                this.screenShakeDuration = 0;
                this.screenShakeOffset.x = 0;
                this.screenShakeOffset.y = 0;
            }
        }
    },
    
    // Update game logic
    update(deltaTime) {
        // Only update if in PLAYING state
        if (this.state !== 'PLAYING') return;
        
        // Update screen shake
        this.updateScreenShake(deltaTime);
        
        // Update particles
        if (typeof updateParticles !== 'undefined') {
            updateParticles(deltaTime);
        }
        
        // Update damage numbers
        if (typeof updateDamageNumbers !== 'undefined') {
            updateDamageNumbers(deltaTime);
        }
        
        // Update level up message
        if (this.levelUpMessageTime > 0) {
            this.levelUpMessageTime -= deltaTime;
            if (this.levelUpMessageTime <= 0) {
                this.levelUpMessageActive = false;
            }
        }
        
        // Update player
        if (this.player && this.player.alive) {
            this.player.update(deltaTime, Input);
        }
        
        // Update enemies
        this.enemies.forEach(enemy => {
            if (enemy.alive) {
                enemy.update(deltaTime, this.player);
            }
        });
        
        // Update projectiles
        this.updateProjectiles(deltaTime);
        
        // Check collisions
        if (this.player && this.player.alive) {
            checkAttacksVsEnemies(this.player, this.enemies);
            checkEnemiesVsPlayer(this.player, this.enemies);
            this.checkProjectilesVsPlayer();
        }
        
        // Check gear pickup (G key)
        if (typeof groundLoot !== 'undefined' && this.player && this.player.alive) {
            this.checkGearPickup();
        }
        
        // Check room clearing and door collision
        if (typeof checkRoomCleared !== 'undefined') {
            checkRoomCleared();
            
            // Check if player wants to advance to next room
            if (typeof currentRoom !== 'undefined' && currentRoom && currentRoom.doorOpen) {
                this.checkDoorCollision();
            }
        }
        
        // Update door pulse animation
        this.doorPulse += deltaTime * 2;
        
        // Remove dead enemies and track kills
        this.enemies = this.enemies.filter(enemy => {
            if (!enemy.alive) {
                this.enemiesKilled++;
            }
            return enemy.alive;
        });
    },
    
    // Check for gear pickup
    checkGearPickup() {
        if (!Input || !Input.keys) return;
        
        // Check if G key just pressed
        if (!this.lastGKeyState && Input.keys['g']) {
            this.lastGKeyState = true;
            
            // Find closest gear within pickup range
            let closestGear = null;
            let closestDistance = 50; // pickup range
            
            groundLoot.forEach(gear => {
                const dx = gear.x - this.player.x;
                const dy = gear.y - this.player.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < closestDistance) {
                    closestDistance = distance;
                    closestGear = gear;
                }
            });
            
            // Pick up the gear if found
            if (closestGear) {
                this.pickupGear(closestGear);
            }
        } else if (Input.keys['g'] === false) {
            this.lastGKeyState = false;
        }
    },
    
    // Pick up gear
    pickupGear(gear) {
        const oldGear = this.player.equipGear(gear);
        
        // Remove gear from ground
        const index = groundLoot.indexOf(gear);
        if (index > -1) {
            groundLoot.splice(index, 1);
        }
        
        console.log(`Picked up ${gear.tier} ${gear.slot}`);
        console.log(`New stats - Damage: ${this.player.damage.toFixed(1)}, Defense: ${this.player.defense.toFixed(1)}, Speed: ${this.player.moveSpeed.toFixed(1)}`);
    },
    
    // Check door collision
    checkDoorCollision() {
        if (!this.player || !this.player.alive) return;
        
        const doorPos = getDoorPosition();
        
        // Circle-rectangle collision detection
        const dx = this.player.x - Math.max(doorPos.x, Math.min(this.player.x, doorPos.x + doorPos.width));
        const dy = this.player.y - Math.max(doorPos.y, Math.min(this.player.y, doorPos.y + doorPos.height));
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Check if player circle touches door rectangle
        if (distance <= this.player.size) {
            this.advanceToNextRoom();
        }
    },
    
    // Advance to next room
    advanceToNextRoom() {
        this.roomNumber++;
        
        // Generate new room
        if (typeof generateRoom !== 'undefined') {
            const newRoom = generateRoom(this.roomNumber);
            
            // Update currentRoom to the new room
            if (typeof currentRoom !== 'undefined') {
                currentRoom = newRoom;
            }
            
            // Update enemies array
            this.enemies = newRoom.enemies;
            
            // Clear ground loot from previous room
            if (typeof groundLoot !== 'undefined') {
                groundLoot.length = 0;
            }
            
            // Reset player position to left side
            this.player.x = 50;
            this.player.y = 300;
            
            console.log(`Advanced to Room ${this.roomNumber}`);
        }
    },
    
    // Render everything
    render() {
        // Clear canvas
        Renderer.clear(this.ctx, this.config.width, this.config.height);
        
        // Apply screen shake
        this.ctx.save();
        this.ctx.translate(this.screenShakeOffset.x, this.screenShakeOffset.y);
        
        // Render based on game state
        if (this.state === 'MENU') {
            if (typeof renderClassSelection !== 'undefined') {
                renderClassSelection(this.ctx);
            }
        } else if (this.state === 'PAUSED') {
            // Draw game world in background (dimmed)
            if (this.player && this.player.alive) {
                this.ctx.globalAlpha = 0.3;
                this.renderGameWorld(this.ctx);
                this.ctx.globalAlpha = 1.0;
            }
            
            // Draw pause menu
            if (typeof renderPauseMenu !== 'undefined') {
                renderPauseMenu(this.ctx);
            }
        } else {
            // Draw player
            if (this.player && this.player.alive) {
                this.player.render(this.ctx);
            }
            
            // Draw enemies
            this.enemies.forEach(enemy => {
                if (enemy.alive) {
                    enemy.render(this.ctx);
                }
            });
            
            // Draw projectiles
            this.projectiles.forEach(projectile => {
                if (projectile.type === 'knife') {
                    // Draw knife as triangle pointing in direction of travel
                    this.ctx.save();
                    this.ctx.translate(projectile.x, projectile.y);
                    
                    // Calculate rotation from velocity
                    const angle = Math.atan2(projectile.vy, projectile.vx);
                    this.ctx.rotate(angle);
                    
                    this.ctx.fillStyle = projectile.color || '#e24ace';
                    this.ctx.beginPath();
                    this.ctx.moveTo(projectile.size, 0); // Point forward
                    this.ctx.lineTo(-projectile.size / 2, -projectile.size / 2);
                    this.ctx.lineTo(-projectile.size / 2, projectile.size / 2);
                    this.ctx.closePath();
                    this.ctx.fill();
                    
                    this.ctx.restore();
                } else if (projectile.type === 'magic') {
                    // Draw magic bolt as glowing circle
                    this.ctx.fillStyle = projectile.color || '#9c27b0';
                    this.ctx.beginPath();
                    this.ctx.arc(projectile.x, projectile.y, projectile.size, 0, Math.PI * 2);
                    this.ctx.fill();
                    
                    // Outer glow
                    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
                    this.ctx.lineWidth = 2;
                    this.ctx.stroke();
                } else {
                    // Default projectile (enemy projectiles)
                    this.ctx.fillStyle = '#ffff00';
                    this.ctx.beginPath();
                    this.ctx.arc(projectile.x, projectile.y, projectile.size, 0, Math.PI * 2);
                    this.ctx.fill();
                }
            });
            
            // Draw ground loot
            if (typeof renderGroundLoot !== 'undefined') {
                renderGroundLoot(this.ctx);
            }
            
            // Draw particles (behind UI)
            if (typeof renderParticles !== 'undefined') {
                renderParticles(this.ctx);
            }
            
            // Draw door if room is cleared
            if (typeof currentRoom !== 'undefined' && currentRoom && currentRoom.doorOpen) {
                const door = getDoorPosition();
                Renderer.door(this.ctx, door.x, door.y, door.width, door.height, this.doorPulse);
            }
            
            // Draw damage numbers
            if (typeof renderDamageNumbers !== 'undefined') {
                renderDamageNumbers(this.ctx);
            }
            
            // Draw UI (on top of everything)
            renderUI(this.ctx, this.player);
            
            // Draw FPS
            if (this.player && !this.player.dead) {
                this.ctx.fillStyle = '#ffffff';
                this.ctx.font = '12px monospace';
                this.ctx.fillText(`FPS: ${this.fps}`, 10, 70);
            }
        }
        
        // Restore context after screen shake
        this.ctx.restore();
    },
    
    // Render game world (player, enemies, etc.)
    renderGameWorld(ctx) {
        // Apply screen shake
        ctx.save();
        ctx.translate(this.screenShakeOffset.x, this.screenShakeOffset.y);
        
        // Draw player
        if (this.player && this.player.alive) {
            this.player.render(ctx);
        }
        
        // Draw enemies
        this.enemies.forEach(enemy => {
            if (enemy.alive) {
                enemy.render(ctx);
            }
        });
        
        // Draw projectiles
        this.projectiles.forEach(projectile => {
            if (projectile.type === 'knife') {
                ctx.save();
                ctx.translate(projectile.x, projectile.y);
                const angle = Math.atan2(projectile.vy, projectile.vx);
                ctx.rotate(angle);
                ctx.fillStyle = projectile.color || '#e24ace';
                ctx.beginPath();
                ctx.moveTo(projectile.size, 0);
                ctx.lineTo(-projectile.size / 2, -projectile.size / 2);
                ctx.lineTo(-projectile.size / 2, projectile.size / 2);
                ctx.closePath();
                ctx.fill();
                ctx.restore();
            } else if (projectile.type === 'magic') {
                ctx.fillStyle = projectile.color || '#9c27b0';
                ctx.beginPath();
                ctx.arc(projectile.x, projectile.y, projectile.size, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
                ctx.lineWidth = 2;
                ctx.stroke();
            } else {
                ctx.fillStyle = '#ffff00';
                ctx.beginPath();
                ctx.arc(projectile.x, projectile.y, projectile.size, 0, Math.PI * 2);
                ctx.fill();
            }
        });
        
        // Draw ground loot
        if (typeof renderGroundLoot !== 'undefined') {
            renderGroundLoot(ctx);
        }
        
        // Draw door if room is cleared
        if (typeof currentRoom !== 'undefined' && currentRoom && currentRoom.doorOpen) {
            const door = getDoorPosition();
            Renderer.door(ctx, door.x, door.y, door.width, door.height, this.doorPulse);
        }
        
        // Draw particles
        if (typeof renderParticles !== 'undefined') {
            renderParticles(ctx);
        }
        
        // Draw damage numbers
        if (typeof renderDamageNumbers !== 'undefined') {
            renderDamageNumbers(ctx);
        }
        
        // Restore context
        ctx.restore();
        
        // Draw UI (outside of screen shake)
        renderUI(ctx, this.player);
    },
    
    // Toggle pause
    togglePause() {
        if (this.state === 'PLAYING') {
            this.state = 'PAUSED';
            this.paused = true;
            console.log('Game paused');
        } else if (this.state === 'PAUSED') {
            this.state = 'PLAYING';
            this.paused = false;
            console.log('Game resumed');
        }
    },
    
    // Start game after class selection
    startGame() {
        if (!this.selectedClass) {
            console.error('No class selected');
            return;
        }
        
        console.log('Starting game with class:', this.selectedClass);
        
        // Create player with selected class
        this.player = new Player(this.config.width / 2, this.config.height / 2);
        this.player.setClass(this.selectedClass);
        
        // Initialize room system
        if (typeof initializeRoom !== 'undefined') {
            initializeRoom(1);
        }
        
        // Spawn enemies
        this.spawnEnemies();
        
        // Switch to playing state
        this.state = 'PLAYING';
        
        // Reset tracking
        this.enemiesKilled = 0;
        this.roomNumber = 1;
        this.doorPulse = 0;
        this.startTime = Date.now();
        
        // Clear effects
        this.particles = [];
        this.damageNumbers = [];
        this.screenShakeOffset = { x: 0, y: 0 };
        this.screenShakeIntensity = 0;
        this.screenShakeDuration = 0;
        this.hitPauseTime = 0;
        this.levelUpMessageActive = false;
        this.levelUpMessageTime = 0;
        
        // Clear ground loot
        if (typeof groundLoot !== 'undefined') {
            groundLoot.length = 0;
        }
    },
    
    // Restart game
    restart() {
        // Create new player with same class
        this.player = new Player(this.config.width / 2, this.config.height / 2);
        
        // Re-initialize player with selected class
        if (this.selectedClass && this.player) {
            this.player.setClass(this.selectedClass);
        }
        
        // Reset arrays
        this.enemies = [];
        this.projectiles = [];
        this.particles = [];
        this.damageNumbers = [];
        
        // Reset stats
        this.enemiesKilled = 0;
        this.roomNumber = 1;
        this.doorPulse = 0;
        this.startTime = Date.now();
        this.endTime = 0; // Reset end time
        
        // Reset screen effects
        this.screenShakeOffset = { x: 0, y: 0 };
        this.screenShakeIntensity = 0;
        this.screenShakeDuration = 0;
        this.hitPauseTime = 0;
        this.levelUpMessageActive = false;
        this.levelUpMessageTime = 0;
        
        // Clear ground loot
        if (typeof groundLoot !== 'undefined') {
            groundLoot.length = 0;
        }
        
        // Reset room system
        if (typeof initializeRoom !== 'undefined') {
            currentRoom = null;
        }
        
        // Spawn enemies
        this.spawnEnemies();
        
        // Reset state
        this.state = 'PLAYING';
        this.paused = false;
        this.lastGKeyState = false;
        this.clickHandled = false;
        
        console.log('Game restarted with class:', this.selectedClass);
    },
    
    // Spawn enemies at random positions (legacy function, now uses room system)
    spawnEnemies() {
        // Initialize first room if not already done
        if (typeof initializeRoom !== 'undefined' && (!currentRoom || currentRoom.number === 1)) {
            currentRoom = generateRoom(1);
            this.enemies = currentRoom.enemies;
        }
        
        console.log(`Room ${this.roomNumber} initialized with ${this.enemies.length} enemies`);
    },
    
    // Update projectiles
    updateProjectiles(deltaTime) {
        this.projectiles = this.projectiles.filter(projectile => {
            // Update position
            projectile.x += projectile.vx * deltaTime;
            projectile.y += projectile.vy * deltaTime;
            
            // Update lifetime
            projectile.elapsed += deltaTime;
            
            // Remove if expired or out of bounds
            if (projectile.elapsed >= projectile.lifetime) return false;
            if (projectile.x < -50 || projectile.x > this.config.width + 50) return false;
            if (projectile.y < -50 || projectile.y > this.config.height + 50) return false;
            
            return true;
        });
    },
    
    // Check projectiles vs player and player projectiles vs enemies
    checkProjectilesVsPlayer() {
        if (!this.player || !this.player.alive) return;
        
        const projectilesToRemove = [];
        
        this.projectiles.forEach((projectile, index) => {
            // Player projectiles (knife, magic bolt) hit enemies
            if (projectile.type === 'knife' || projectile.type === 'magic') {
                let hitEnemy = false;
                
                this.enemies.forEach(enemy => {
                    if (!enemy.alive) return;
                    
                    if (checkCircleCollision(
                        projectile.x, projectile.y, projectile.size,
                        enemy.x, enemy.y, enemy.size
                    )) {
                        // Hit enemy
                        const damageDealt = Math.min(projectile.damage, enemy.hp);
                        enemy.takeDamage(projectile.damage);
                        // Damage numbers for player projectiles (rogue knives, mage bolts)
                        if (typeof createDamageNumber !== 'undefined') {
                            const isHeavy = false;
                            createDamageNumber(enemy.x, enemy.y, damageDealt, isHeavy);
                        }
                        hitEnemy = true;
                    }
                });
                
                // Remove projectile if it hit an enemy
                if (hitEnemy) {
                    projectilesToRemove.push(index);
                }
            } else {
                // Enemy projectiles hit player
                // First check if player's shield blocks it
                let isBlocked = false;
                
                if (this.player.shieldActive) {
                    const shieldStart = this.player.size + 5;
                    const shieldDepth = 20;
                    const shieldWidth = 60; // Half width (120 total / 2)
                    
                    // Get projectile direction
                    const projDirX = Math.cos(Math.atan2(projectile.vy, projectile.vx));
                    const projDirY = Math.sin(Math.atan2(projectile.vy, projectile.vx));
                    
                    // Check if projectile is in front of player
                    const toPlayerX = projectile.x - this.player.x;
                    const toPlayerY = projectile.y - this.player.y;
                    const toPlayerDist = Math.sqrt(toPlayerX * toPlayerX + toPlayerY * toPlayerY);
                    const toPlayerNormX = toPlayerX / toPlayerDist;
                    const toPlayerNormY = toPlayerY / toPlayerDist;
                    
                    const playerDirX = Math.cos(this.player.rotation);
                    const playerDirY = Math.sin(this.player.rotation);
                    
                    const dot = toPlayerNormX * playerDirX + toPlayerNormY * playerDirY;
                    
                    // Projectile is in front of player and within shield range
                    if (dot > 0 && toPlayerDist < shieldStart + shieldDepth) {
                        // Check lateral distance
                        const perpendicularX = -playerDirY;
                        const perpendicularY = playerDirX;
                        const lateralDist = Math.abs(toPlayerX * perpendicularX + toPlayerY * perpendicularY);
                        
                        if (lateralDist < shieldWidth) {
                            // Block the projectile
                            isBlocked = true;
                            // Create particle effect on block
                            if (typeof createParticleBurst !== 'undefined') {
                                createParticleBurst(projectile.x, projectile.y, '#0099ff', 5);
                            }
                        }
                    }
                }
                
                if (isBlocked) {
                    // Mark projectile for removal (blocked by shield)
                    projectilesToRemove.push(index);
                } else if (checkCircleCollision(
                    projectile.x, projectile.y, projectile.size,
                    this.player.x, this.player.y, this.player.size
                )) {
                    // Hit player
                    this.player.takeDamage(projectile.damage);
                    // Mark for removal
                    projectilesToRemove.push(index);
                }
            }
        });
        
        // Remove projectiles that hit (in reverse order)
        for (let i = projectilesToRemove.length - 1; i >= 0; i--) {
            this.projectiles.splice(projectilesToRemove[i], 1);
        }
    },
    
    // Raycast function for checking shield collision
    raycastCheckShield(startX, startY, endX, endY, shieldStart, shieldDepth, shieldWidth, playerX, playerY, playerRot) {
        const dx = endX - startX;
        const dy = endY - startY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= 0) return null;
        
        const dirX = dx / dist;
        const dirY = dy / dist;
        
        const playerDirX = Math.cos(playerRot);
        const playerDirY = Math.sin(playerRot);
        
        // Sample points along the ray
        const steps = Math.floor(dist / 5) + 1;
        
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const testX = startX + dirX * dist * t;
            const testY = startY + dirY * dist * t;
            
            // Check if this point is in front of player
            const toPlayerX = testX - playerX;
            const toPlayerY = testY - playerY;
            const toPlayerDist = Math.sqrt(toPlayerX * toPlayerX + toPlayerY * toPlayerY);
            const toPlayerNormX = toPlayerX / toPlayerDist;
            const toPlayerNormY = toPlayerY / toPlayerDist;
            
            const dot = toPlayerNormX * playerDirX + toPlayerNormY * playerDirY;
            
            if (dot > 0 && toPlayerDist < shieldStart + shieldDepth) {
                // Check lateral distance
                const perpendicularX = -playerDirY;
                const perpendicularY = playerDirX;
                const lateralDist = Math.abs(toPlayerX * perpendicularX + toPlayerY * perpendicularY);
                
                if (lateralDist < shieldWidth) {
                    // Hit the shield
                    return { x: testX, y: testY };
                }
            }
        }
        
        return null; // No intersection
    }
};

// Start the game when page loads
window.addEventListener('load', () => {
    Game.init();
});

