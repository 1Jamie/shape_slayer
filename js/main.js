// Main game loop and initialization

const Game = {
    // Version tracking (from version.js)
    get VERSION() {
        return typeof GameVersion !== 'undefined' ? GameVersion.VERSION : '1.0.0';
    },
    get UPDATE_MESSAGES() {
        return typeof GameVersion !== 'undefined' ? GameVersion.UPDATE_MESSAGES : { '1.0.0': 'Initial release!' };
    },
    
    // Canvas and context
    canvas: null,
    ctx: null,
    
    // Game state
    state: 'NEXUS', // 'NEXUS', 'PLAYING', 'PAUSED'
    paused: false,
    pausedFromState: null, // Track where we paused from ('PLAYING' or 'NEXUS')
    lastTime: 0,
    
    // Modal states
    launchModalVisible: false,
    updateModalVisible: false,
    
    // Class selection
    selectedClass: null,
    mouse: { x: 0, y: 0 },
    clickHandled: false,
    
    // Currency system
    currentCurrency: 0,
    currencyEarned: 0, // Currency earned from current run
    
    // Game config
    config: {
        width: 1280,
        height: 720,
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
    
    // Boss intro system
    bossIntroActive: false,
    bossIntroData: null, // { boss, name, duration, elapsedTime, skipAvailable }
    
    // FPS tracking
    fps: 0,
    lastFpsUpdate: 0,
    frameCount: 0,
    
    // Input state tracking
    lastGKeyState: false,
    lastRKeyState: false,
    lastMKeyState: false,
    
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
        
        // Set internal canvas dimensions (game resolution)
        this.canvas.width = this.config.width;
        this.canvas.height = this.config.height;
        
        // Setup responsive scaling
        this.setupResponsiveCanvas();
        
        // Initialize input system
        Input.init(this.canvas);
        
        // Load fullscreen preference
        if (typeof SaveSystem !== 'undefined') {
            this.fullscreenEnabled = SaveSystem.getFullscreenPreference();
        }
        
        // Setup fullscreen API event listeners
        this.setupFullscreenListeners();
        
        // Handle window resize
        const handleResize = () => {
            this.setupResponsiveCanvas();
            // Force a reflow to ensure bounding rect is updated
            if (this.canvas) {
                void this.canvas.offsetWidth;
            }
            // Reinitialize touch controls with new canvas size after a brief delay
            if (typeof Input !== 'undefined' && Input.isTouchMode && Input.isTouchMode()) {
                setTimeout(() => {
                    if (this.canvas && typeof Input !== 'undefined' && Input.initTouchControls) {
                        Input.initTouchControls(this.canvas);
                    }
                }, 50);
            }
        };
        
        window.addEventListener('resize', handleResize);
        
        // Also listen to visualViewport resize (for mobile system UI changes)
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', handleResize);
            window.visualViewport.addEventListener('scroll', () => {
                // Prevent scrolling and ensure canvas is positioned correctly
                window.scrollTo(0, 0);
            });
        }
        
        // Handle orientation change
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                this.setupResponsiveCanvas();
                if (typeof Input !== 'undefined' && Input.isTouchMode && Input.isTouchMode()) {
                    Input.initTouchControls(this.canvas);
                }
            }, 100);
        });
        
        // Load save data
        if (typeof SaveSystem !== 'undefined') {
            const saveData = SaveSystem.load();
            this.currentCurrency = saveData.currency || 0;
            this.selectedClass = saveData.selectedClass || null;
            
            // Check if launch modal should show (first time ever)
            if (!SaveSystem.getHasSeenLaunchModal()) {
                this.launchModalVisible = true;
            }
            
            // Check if update modal should show (version changed)
            if (SaveSystem.shouldShowUpdateModal()) {
                this.updateModalVisible = true;
            }
        }
        
        // Player will be created after class selection
        this.player = null;
        
        // Handle click/touch on canvas (for pause menu buttons, pause button, and interaction button)
        this.canvas.addEventListener('click', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const gameCoords = this.screenToGame(e.clientX, e.clientY);
            
            // Check modal close button first (highest priority when modals are visible)
            if (this.launchModalVisible || this.updateModalVisible) {
                if (typeof checkModalCloseButtonClick === 'function') {
                    if (checkModalCloseButtonClick(e.clientX, e.clientY)) {
                        return;
                    }
                }
            }
            
            // Check pause menu buttons first if paused (highest priority)
            if (this.state === 'PAUSED') {
                if (typeof checkPauseMenuButtonClick === 'function') {
                    if (checkPauseMenuButtonClick(e.clientX, e.clientY)) {
                        return;
                    }
                }
            }
            
            // Check pause button overlay if playing or in nexus (before other UI elements)
            if (this.state === 'PLAYING' || this.state === 'NEXUS') {
                if (typeof handlePauseButtonClick === 'function') {
                    if (handlePauseButtonClick(gameCoords.x, gameCoords.y)) {
                        return;
                    }
                }
            }
            
            // Check interaction button (if in touch mode)
            if (typeof Input !== 'undefined' && Input.isTouchMode && Input.isTouchMode()) {
                if (typeof handleInteractionButtonClick === 'function') {
                    if (handleInteractionButtonClick(gameCoords.x, gameCoords.y)) {
                        return;
                    }
                }
            }
            
            // Handle click on death screen
            if (this.player && this.player.dead && this.state === 'PLAYING') {
                this.returnToNexus();
            }
        });
        
        // Handle touch events for pause menu, pause button, and interaction button
        // IMPORTANT: This must run BEFORE Input.handleTouchStart to intercept UI touches
        this.canvas.addEventListener('touchstart', (e) => {
            if (e.touches.length > 0) {
                const touch = e.touches[0];
                // Always get fresh bounding rect for accurate coordinate conversion
                const rect = this.canvas.getBoundingClientRect();
                const gameCoords = this.screenToGame(touch.clientX, touch.clientY);
                
                // Check modal close button first (highest priority when modals are visible)
                if (this.launchModalVisible || this.updateModalVisible) {
                    if (typeof checkModalCloseButtonClick === 'function') {
                        if (checkModalCloseButtonClick(touch.clientX, touch.clientY)) {
                            e.preventDefault();
                            e.stopPropagation();
                            return;
                        }
                    }
                }
                
                // Check pause menu buttons first (highest priority) if paused
                if (this.state === 'PAUSED') {
                    if (typeof checkPauseMenuButtonClick === 'function') {
                        if (checkPauseMenuButtonClick(touch.clientX, touch.clientY)) {
                            e.preventDefault();
                            e.stopPropagation();
                            return;
                        }
                    }
                }
                
                // Check pause button overlay if playing or in nexus (before touch controls)
                if (this.state === 'PLAYING' || this.state === 'NEXUS') {
                    if (typeof handlePauseButtonClick === 'function') {
                        if (handlePauseButtonClick(gameCoords.x, gameCoords.y)) {
                            e.preventDefault();
                            e.stopPropagation();
                            return;
                        }
                    }
                }
                
                // Check interaction button (if in touch mode)
                if (typeof Input !== 'undefined' && Input.isTouchMode && Input.isTouchMode()) {
                    if (typeof handleInteractionButtonClick === 'function') {
                        if (handleInteractionButtonClick(gameCoords.x, gameCoords.y)) {
                            e.preventDefault();
                            e.stopPropagation();
                            return;
                        }
                    }
                }
                
                // Handle touch on death screen (return to nexus)
                if (this.player && this.player.dead && this.state === 'PLAYING') {
                    this.returnToNexus();
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
            }
        }, { capture: true }); // Use capture phase to run before other handlers
        
        // Handle pause toggle with ESC
        document.addEventListener('keydown', (e) => {
            // Handle boss intro skip
            if (this.bossIntroActive && this.bossIntroData && this.bossIntroData.skipAvailable) {
                this.skipBossIntro();
                return;
            }
            
            if (e.key === 'Escape') {
                // Close modals first if visible
                if (this.launchModalVisible) {
                    this.launchModalVisible = false;
                    if (typeof SaveSystem !== 'undefined') {
                        SaveSystem.setHasSeenLaunchModal(true);
                    }
                    return;
                }
                if (this.updateModalVisible) {
                    this.updateModalVisible = false;
                    if (typeof SaveSystem !== 'undefined' && this.VERSION) {
                        SaveSystem.setLastRunVersion(this.VERSION);
                    }
                    return;
                }
                
                // Normal pause handling
                if (this.state === 'PLAYING' || this.state === 'NEXUS') {
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
            if (e.key === 'm' || e.key === 'M') {
                if (this.player && this.player.dead) {
                    this.returnToNexus();
                }
            }
        });
        
        console.log('Game initialized successfully');
        this.start();
    },
    
    // Setup responsive canvas scaling
    setupResponsiveCanvas() {
        if (!this.canvas) return;
        
        const gameAspect = this.config.width / this.config.height;
        
        // Use actual available viewport - in fullscreen on mobile, this accounts for system UI
        // Use visualViewport if available (better for mobile with system UI bars)
        let availableWidth, availableHeight;
        if (window.visualViewport) {
            availableWidth = window.visualViewport.width;
            availableHeight = window.visualViewport.height;
        } else {
            availableWidth = window.innerWidth;
            availableHeight = window.innerHeight;
        }
        
        const windowAspect = availableWidth / availableHeight;
        
        let scale, displayWidth, displayHeight;
        
        // Calculate scale to fit screen while maintaining aspect ratio
        // This ensures consistent game world coordinates across all devices
        if (windowAspect > gameAspect) {
            // Window is wider - fit to height (minimize top/bottom borders)
            scale = availableHeight / this.config.height;
            displayHeight = availableHeight;
            displayWidth = this.config.width * scale;
        } else {
            // Window is taller - fit to width (minimize left/right borders)
            scale = availableWidth / this.config.width;
            displayWidth = availableWidth;
            displayHeight = this.config.height * scale;
        }
        
        // Set CSS size (these are display pixels, not game world pixels)
        this.canvas.style.width = displayWidth + 'px';
        this.canvas.style.height = displayHeight + 'px';
        
        // Reset margins (flexbox will center it)
        this.canvas.style.marginLeft = '0';
        this.canvas.style.marginTop = '0';
        
        // Force a reflow to ensure the canvas is positioned
        void this.canvas.offsetWidth;
        
        // Get the actual bounding rect after positioning
        const rect = this.canvas.getBoundingClientRect();
        
        // Store scale for coordinate conversion
        // Scale factor: game world pixels per display pixel
        this.scale = scale;
        
        // Calculate offset for coordinate conversion based on actual rect position
        // In fullscreen with system UI, rect.left/top may not be 0
        this.offsetX = rect.left;
        this.offsetY = rect.top;
        
        // Store the ACTUAL game area dimensions (what we calculated, not what the browser reports)
        // The browser might stretch the canvas element, but the game renders only in displayWidth x displayHeight
        this.actualGameWidth = displayWidth;
        this.actualGameHeight = displayHeight;
        
        // Calculate where the game area actually starts (centered within the canvas element)
        // The canvas element might be larger due to CSS stretching, but the game renders centered
        const gameAreaLeft = rect.left + (rect.width - displayWidth) / 2;
        const gameAreaTop = rect.top + (rect.height - displayHeight) / 2;
        
        this.gameAreaOffsetX = gameAreaLeft;
        this.gameAreaOffsetY = gameAreaTop;
        
        // Store viewport info for multiplayer consistency
        this.viewport = {
            width: displayWidth,
            height: displayHeight,
            scale: scale,
            offsetX: this.offsetX,
            offsetY: this.offsetY,
            gameWidth: this.config.width,
            gameHeight: this.config.height,
            actualRect: {
                width: rect.width,
                height: rect.height,
                left: rect.left,
                top: rect.top
            },
            gameArea: {
                width: displayWidth,
                height: displayHeight,
                left: gameAreaLeft,
                top: gameAreaTop
            }
        };
        
        console.log(`Canvas scaled: ${displayWidth.toFixed(0)}x${displayHeight.toFixed(0)} (scale: ${scale.toFixed(2)}, game: ${this.config.width}x${this.config.height})`);
        console.log(`Canvas element rect: ${rect.width.toFixed(0)}x${rect.height.toFixed(0)} at (${rect.left.toFixed(0)}, ${rect.top.toFixed(0)})`);
        console.log(`Actual game area: ${displayWidth.toFixed(0)}x${displayHeight.toFixed(0)} at (${gameAreaLeft.toFixed(0)}, ${gameAreaTop.toFixed(0)})`);
        console.log(`Viewport: ${availableWidth.toFixed(0)}x${availableHeight.toFixed(0)}`);
    },
    
    // Convert screen coordinates to game coordinates
    screenToGame(x, y) {
        // Use the ACTUAL game area dimensions we calculated, not the canvas element's bounding rect
        // The canvas element might be stretched by CSS, but the game renders only in actualGameWidth x actualGameHeight
        if (!this.actualGameWidth || !this.actualGameHeight) {
            // Fallback to bounding rect if not initialized yet
            const rect = this.canvas.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) {
                console.warn('[screenToGame] Invalid dimensions, using fallback');
                return { x: 0, y: 0 };
            }
            const scaleX = this.config.width / rect.width;
            const scaleY = this.config.height / rect.height;
            return {
                x: (x - rect.left) * scaleX,
                y: (y - rect.top) * scaleY
            };
        }
        
        // Get fresh bounding rect to find where the canvas element is
        const rect = this.canvas.getBoundingClientRect();
        
        // Calculate where the actual game area starts (centered within canvas element)
        // If canvas is stretched, the game area is centered
        const gameAreaLeft = rect.left + (rect.width - this.actualGameWidth) / 2;
        const gameAreaTop = rect.top + (rect.height - this.actualGameHeight) / 2;
        
        // Convert from screen pixels to game world pixels
        // Use the actual game area dimensions, not the stretched canvas element
        const scaleX = this.config.width / this.actualGameWidth;
        const scaleY = this.config.height / this.actualGameHeight;
        
        // Subtract game area offset to get position relative to game area (accounting for letterboxing)
        const relativeX = x - gameAreaLeft;
        const relativeY = y - gameAreaTop;
        
        // Scale to game coordinates (0-1280 for x, 0-720 for y)
        const gameX = relativeX * scaleX;
        const gameY = relativeY * scaleY;
        
        // Clamp to game bounds to prevent out-of-range coordinates
        const clampedX = Math.max(0, Math.min(this.config.width, gameX));
        const clampedY = Math.max(0, Math.min(this.config.height, gameY));
        
        // Debug logging in fullscreen mode
        if (this.fullscreenEnabled) {
            console.log(`[screenToGame] Screen: (${x.toFixed(0)}, ${y.toFixed(0)})`);
            console.log(`  Canvas element rect: ${rect.width.toFixed(0)}x${rect.height.toFixed(0)} at (${rect.left.toFixed(0)}, ${rect.top.toFixed(0)})`);
            console.log(`  Game area: ${this.actualGameWidth.toFixed(0)}x${this.actualGameHeight.toFixed(0)} at (${gameAreaLeft.toFixed(0)}, ${gameAreaTop.toFixed(0)})`);
            console.log(`  Relative to game area: (${relativeX.toFixed(0)}, ${relativeY.toFixed(0)})`);
            console.log(`  Scale: ${scaleX.toFixed(3)}x${scaleY.toFixed(3)}`);
            console.log(`  Game coords: (${gameX.toFixed(0)}, ${gameY.toFixed(0)}) -> clamped: (${clampedX.toFixed(0)}, ${clampedY.toFixed(0)})`);
        }
        
        return { x: clampedX, y: clampedY };
    },
    
    // Setup fullscreen API listeners
    setupFullscreenListeners() {
        // Listen for fullscreen changes
        const fullscreenChange = () => {
            const isFullscreen = !!(document.fullscreenElement || 
                                  document.webkitFullscreenElement || 
                                  document.mozFullScreenElement || 
                                  document.msFullscreenElement);
            this.fullscreenEnabled = isFullscreen;
            
            console.log(`[FULLSCREEN] Changed to: ${isFullscreen}`);
            
            // Update save preference
            if (typeof SaveSystem !== 'undefined') {
                SaveSystem.setFullscreenPreference(isFullscreen);
            }
            
            // Recalculate canvas size after fullscreen change
            // Use multiple requestAnimationFrame calls to ensure canvas has fully updated
            // Fullscreen transitions can take time, especially on mobile devices
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        // Force canvas resize
                        this.setupResponsiveCanvas();
                        
                        // Force multiple reflows to ensure everything is updated
                        if (this.canvas) {
                            void this.canvas.offsetWidth;
                            void this.canvas.offsetHeight;
                            // Get fresh rect to verify
                            const rect = this.canvas.getBoundingClientRect();
                            console.log(`[FULLSCREEN] Canvas rect after resize: ${rect.width.toFixed(0)}x${rect.height.toFixed(0)} at (${rect.left.toFixed(0)}, ${rect.top.toFixed(0)})`);
                        }
                        
                        if (typeof Input !== 'undefined' && Input.isTouchMode && Input.isTouchMode()) {
                            // Clear all existing touch controls and active touches
                            if (Input.touchJoysticks) {
                                // End all active joysticks first
                                for (const joystick of Object.values(Input.touchJoysticks)) {
                                    if (joystick && joystick.active && joystick.touchId !== null) {
                                        joystick.endTouch(joystick.touchId);
                                    }
                                }
                                Input.touchJoysticks = {};
                            }
                            if (Input.touchButtons) {
                                // End all active buttons first
                                for (const button of Object.values(Input.touchButtons)) {
                                    if (button && button.active && button.touchId !== null) {
                                        button.endTouch(button.touchId);
                                    }
                                }
                                Input.touchButtons = {};
                            }
                            if (Input.activeTouches) {
                                Input.activeTouches = {};
                            }
                            Input.touchActive = false;
                            
                            // Reinitialize with correct positions after a brief delay
                            // This ensures the canvas bounding rect is fully updated
                            setTimeout(() => {
                                if (this.canvas && typeof Input !== 'undefined' && Input.initTouchControls) {
                                    // Force one more reflow before reinitializing
                                    void this.canvas.offsetWidth;
                                    const rect = this.canvas.getBoundingClientRect();
                                    console.log(`[FULLSCREEN] Reinitializing controls, rect: ${rect.width.toFixed(0)}x${rect.height.toFixed(0)}`);
                                    Input.initTouchControls(this.canvas);
                                    console.log('[FULLSCREEN] Touch controls reinitialized');
                                }
                            }, 100); // Increased delay for mobile devices
                        }
                    });
                });
            });
        };
        
        document.addEventListener('fullscreenchange', fullscreenChange);
        document.addEventListener('webkitfullscreenchange', fullscreenChange);
        document.addEventListener('mozfullscreenchange', fullscreenChange);
        document.addEventListener('MSFullscreenChange', fullscreenChange);
    },
    
    // Toggle fullscreen
    toggleFullscreen() {
        if (!this.canvas) return;
        
        const isFullscreen = !!(document.fullscreenElement || 
                              document.webkitFullscreenElement || 
                              document.mozFullScreenElement || 
                              document.msFullscreenElement);
        
        if (isFullscreen) {
            // Exit fullscreen
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.mozCancelFullScreen) {
                document.mozCancelFullScreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
        } else {
            // Enter fullscreen
            const element = this.canvas;
            if (element.requestFullscreen) {
                element.requestFullscreen();
            } else if (element.webkitRequestFullscreen) {
                element.webkitRequestFullscreen();
            } else if (element.mozRequestFullScreen) {
                element.mozRequestFullScreen();
            } else if (element.msRequestFullscreen) {
                element.msRequestFullscreen();
            }
        }
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
        } else if (this.state === 'NEXUS') {
            if (typeof updateNexus !== 'undefined') {
                updateNexus(this.ctx, deltaTime);
            }
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
        
        // Update boss intro if active (before normal updates)
        if (this.bossIntroActive) {
            this.updateBossIntro(deltaTime);
            // Don't update normal game logic during intro
            return;
        }
        
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
        
        // Update player FIRST (before resetting button states)
        // This allows player to read justPressed/justReleased flags
        if (this.player && this.player.alive) {
            this.player.update(deltaTime, Input);
        }
        
        // Update input system (for touch controls) AFTER player reads button states
        // This resets justPressed/justReleased flags for next frame
        if (typeof Input !== 'undefined' && Input.update) {
            Input.update(deltaTime);
        }
        
        // Update enemies (skip if boss intro is active - boss is frozen)
        this.enemies.forEach(enemy => {
            if (enemy.alive) {
                // Skip update if this is a boss and intro not complete
                if (enemy.isBoss && !enemy.introComplete) {
                    return;
                }
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
        this.doorPulse += deltaTime;
        
        // Update debug panel if visible
        if (typeof DebugPanel !== 'undefined') {
            DebugPanel.update();
        }
        
        // Remove dead enemies and track kills
        this.enemies = this.enemies.filter(enemy => {
            if (!enemy.alive) {
                this.enemiesKilled++;
            }
            return enemy.alive;
        });
    },
    
    // Start boss intro sequence
    startBossIntro(boss) {
        if (!boss || !boss.isBoss) {
            console.error('startBossIntro called with invalid boss');
            return;
        }
        
        this.bossIntroActive = true;
        this.bossIntroData = {
            boss: boss,
            name: boss.bossName || 'BOSS',
            duration: 3.0, // 3 seconds total
            elapsedTime: 0,
            skipAvailable: false
        };
        
        // Mark boss intro as started (boss will freeze during intro)
        boss.introComplete = false;
        
        console.log(`Boss intro started for ${boss.bossName}`);
    },
    
    // Update boss intro sequence
    updateBossIntro(deltaTime) {
        if (!this.bossIntroData) return;
        
        this.bossIntroData.elapsedTime += deltaTime;
        
        // Enable skip after 2 seconds
        if (this.bossIntroData.elapsedTime >= 2.0) {
            this.bossIntroData.skipAvailable = true;
        }
        
        // End intro after duration or if skipped
        if (this.bossIntroData.elapsedTime >= this.bossIntroData.duration) {
            this.endBossIntro();
        }
    },
    
    // Skip boss intro
    skipBossIntro() {
        if (!this.bossIntroData || !this.bossIntroData.skipAvailable) return;
        
        this.endBossIntro();
    },
    
    // End boss intro sequence
    endBossIntro() {
        if (!this.bossIntroData || !this.bossIntroData.boss) return;
        
        // Mark boss intro as complete
        this.bossIntroData.boss.introComplete = true;
        
        this.bossIntroActive = false;
        this.bossIntroData = null;
        
        console.log('Boss intro ended');
    },
    
    // Render boss intro sequence
    renderBossIntro(ctx) {
        if (!this.bossIntroData || !this.bossIntroData.boss) return;
        
        // Dark overlay (80% opacity)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(0, 0, this.config.width, this.config.height);
        
        // Calculate fade and scale for boss name text
        const elapsed = this.bossIntroData.elapsedTime;
        const nameFadeIn = Math.min(1.0, elapsed / 0.5); // Fade in over 0.5s
        const nameScale = 0.5 + (nameFadeIn * 0.5); // Scale from 0.5 to 1.0
        
        // Render boss (frozen during intro)
        ctx.save();
        ctx.globalAlpha = 1.0;
        this.bossIntroData.boss.render(ctx);
        ctx.restore();
        
        // Boss name text
        ctx.save();
        ctx.globalAlpha = nameFadeIn;
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${48 * nameScale}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.bossIntroData.name, this.config.width / 2, this.config.height / 2 - 100);
        ctx.restore();
        
        // "Press any key to continue" text (after 2 seconds)
        if (this.bossIntroData.skipAvailable) {
            const skipFade = Math.sin(Date.now() / 200); // Blinking effect
            ctx.save();
            ctx.globalAlpha = 0.5 + skipFade * 0.5;
            ctx.fillStyle = '#ffff00';
            ctx.font = '20px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('Press any key to continue', this.config.width / 2, this.config.height / 2 + 100);
            ctx.restore();
        }
    },
    
    // Check for gear pickup
    checkGearPickup() {
        if (!Input) return;
        
        let shouldPickup = false;
        
        // Check keyboard input (or interaction button simulated G key)
        if (Input.keys && !this.lastGKeyState && Input.keys['g']) {
            this.lastGKeyState = true;
            shouldPickup = true;
        } else if (Input.keys && Input.keys['g'] === false) {
            this.lastGKeyState = false;
        }
        
        if (shouldPickup) {
            // Find closest gear within pickup range
            let closestGear = null;
            let closestDistance = 50; // pickup range
            
            if (typeof groundLoot !== 'undefined') {
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
            }
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
            
            // Check if this is a boss room and start intro
            if (newRoom.type === 'boss' && this.enemies.length > 0 && this.enemies[0].isBoss) {
                const boss = this.enemies[0];
                // Start boss intro
                this.startBossIntro(boss);
            }
            
            // Clear ground loot from previous room
            if (typeof groundLoot !== 'undefined') {
                groundLoot.length = 0;
            }
            
            // Reset player position to left side
            this.player.x = 50;
            this.player.y = 300;
            
            console.log(`Advanced to Room ${this.roomNumber}${newRoom.type === 'boss' ? ' (BOSS ROOM)' : ''}`);
        }
    },
    
    // Render everything
    render() {
        // Render boss intro if active (before anything else)
        if (this.bossIntroActive) {
            // Clear with dark background for boss intro
            Renderer.clear(this.ctx, this.config.width, this.config.height);
            this.renderBossIntro(this.ctx);
            return; // Skip normal rendering during intro
        }
        
        // Render based on game state
        if (this.state === 'NEXUS') {
            if (typeof renderNexus !== 'undefined') {
                renderNexus(this.ctx);
            }
        } else if (this.state === 'PAUSED') {
            // Render background based on where we paused from
            if (this.pausedFromState === 'NEXUS') {
                // Draw nexus in background (dimmed)
                this.ctx.globalAlpha = 0.3;
                if (typeof renderNexus !== 'undefined') {
                    renderNexus(this.ctx);
                }
                this.ctx.globalAlpha = 1.0;
            } else {
                // Draw game world in background (dimmed)
                if (typeof renderRoomBackground !== 'undefined') {
                    renderRoomBackground(this.ctx, this.roomNumber);
                } else {
                    Renderer.clear(this.ctx, this.config.width, this.config.height);
                }
                
                if (this.player && this.player.alive) {
                    this.ctx.globalAlpha = 0.3;
                    this.renderGameWorld(this.ctx);
                    this.ctx.globalAlpha = 1.0;
                }
            }
            
            // Draw pause menu
            if (typeof renderPauseMenu !== 'undefined') {
                renderPauseMenu(this.ctx);
            }
        } else {
            // Render room background with biome styling
            if (typeof renderRoomBackground !== 'undefined') {
                renderRoomBackground(this.ctx, this.roomNumber);
            } else {
                Renderer.clear(this.ctx, this.config.width, this.config.height);
            }
            
            // Apply screen shake
            this.ctx.save();
            this.ctx.translate(this.screenShakeOffset.x, this.screenShakeOffset.y);
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
                    
                    this.ctx.fillStyle = projectile.color || '#ff1493';
                    this.ctx.beginPath();
                    this.ctx.moveTo(projectile.size, 0); // Point forward
                    this.ctx.lineTo(-projectile.size / 2, -projectile.size / 2);
                    this.ctx.lineTo(-projectile.size / 2, projectile.size / 2);
                    this.ctx.closePath();
                    this.ctx.fill();
                    
                    this.ctx.restore();
                } else if (projectile.type === 'magic') {
                    // Draw magic bolt as glowing circle
                    this.ctx.fillStyle = projectile.color || '#673ab7';
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
                this.ctx.fillStyle = '#888888';
                this.ctx.font = 'bold 14px monospace';
                this.ctx.textAlign = 'left';
                this.ctx.fillText(`FPS: ${this.fps}`, 30, this.config.height - 20);
            }
        }
        
        // Restore context after screen shake
        this.ctx.restore();
        
        // Render modals on top of everything (launch modal takes priority)
        if (this.launchModalVisible && typeof renderLaunchModal !== 'undefined') {
            renderLaunchModal(this.ctx);
        } else if (this.updateModalVisible && typeof renderUpdateModal !== 'undefined') {
            renderUpdateModal(this.ctx);
        }
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
                ctx.fillStyle = projectile.color || '#ff1493';
                ctx.beginPath();
                ctx.moveTo(projectile.size, 0);
                ctx.lineTo(-projectile.size / 2, -projectile.size / 2);
                ctx.lineTo(-projectile.size / 2, projectile.size / 2);
                ctx.closePath();
                ctx.fill();
                ctx.restore();
            } else if (projectile.type === 'magic') {
                ctx.fillStyle = projectile.color || '#673ab7';
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
            this.pausedFromState = 'PLAYING'; // Remember where we paused from
            console.log('Game paused');
        } else if (this.state === 'NEXUS') {
            this.state = 'PAUSED';
            this.paused = true;
            this.pausedFromState = 'NEXUS'; // Remember where we paused from
            console.log('Nexus paused');
        } else if (this.state === 'PAUSED') {
            // Resume to the state we paused from
            this.state = this.pausedFromState || 'PLAYING';
            this.paused = false;
            this.pausedFromState = null;
            console.log('Game resumed');
        }
    },
    
    // Return to nexus after death
    returnToNexus() {
        // Calculate and save currency earned (if not already saved)
        if (this.player && this.player.dead && this.currencyEarned > 0) {
            if (typeof SaveSystem !== 'undefined') {
                SaveSystem.addCurrency(this.currencyEarned);
                const saveData = SaveSystem.load();
                this.currentCurrency = saveData.currency || 0;
            }
            this.currencyEarned = 0;
        }
        
        // Reset game state
        this.state = 'NEXUS';
        this.enemies = [];
        this.projectiles = [];

        // Reset player but keep it for nexus navigation
        if (this.player) {
            this.player.dead = false;
            this.player.alive = true;
            // Position will be set by initNexus
        }
        
        this.enemiesKilled = 0;
        this.roomNumber = 1;
        
        // Clear ground loot
        if (typeof groundLoot !== 'undefined') {
            groundLoot.length = 0;
        }
        
        // Initialize nexus if needed
        if (typeof initNexus !== 'undefined') {
            initNexus();
        }
    },
    
    // Calculate currency earned from run
    calculateCurrency() {
        if (!this.player) return 0;
        
        const roomsCleared = Math.max(0, this.roomNumber - 1);
        const enemiesKilled = this.enemiesKilled || 0;
        const levelReached = this.player.level || 1;
        
        const base = 9 * roomsCleared; // Reduced from 10
        const bonus = 1.8 * enemiesKilled; // Reduced from 2
        const levelBonus = 0.9 * levelReached; // Reduced from 1
        
        return base + bonus + levelBonus;
    },
    
    // Start game after class selection
    startGame() {
        if (!this.selectedClass) {
            console.error('No class selected');
            return;
        }
        
        console.log('Starting game with class:', this.selectedClass);
        
        // Create player with selected class (start at left side of screen)
        this.player = new Player(100, this.config.height / 2);
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
        // Create new player with same class (start at left side of screen)
        this.player = new Player(100, this.config.height / 2);
        
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
            
            // Check if this is a boss room and start intro
            if (currentRoom.type === 'boss' && this.enemies.length > 0 && this.enemies[0].isBoss) {
                const boss = this.enemies[0];
                // Start boss intro
                this.startBossIntro(boss);
            }
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
                        // Check for backstab (Rogue passive: player must be behind enemy when projectile hits)
                        let isBackstab = false;
                        let finalDamage = projectile.damage;
                        
                        // Check for range bonus (Mage passive: increased damage at range)
                        if (projectile.type === 'magic' && this.player && this.player.playerClass === 'hexagon') {
                            // Calculate distance from player to enemy
                            const dx = enemy.x - this.player.x;
                            const dy = enemy.y - this.player.y;
                            const distance = Math.sqrt(dx * dx + dy * dy);
                            
                            // Apply range-based damage multiplier
                            // 1.0x at 0-100px, 1.5x at 100-200px, 2.0x at 200px+
                            let rangeMultiplier = 1.0;
                            if (distance >= 200) {
                                rangeMultiplier = 2.0;
                            } else if (distance >= 100) {
                                // Linear interpolation between 100 and 200
                                rangeMultiplier = 1.0 + ((distance - 100) / 100) * 1.0; // 1.0 to 2.0
                            }
                            
                            finalDamage = projectile.damage * rangeMultiplier;
                        }
                        
                        if (projectile.type === 'knife' && projectile.playerClass === 'triangle') {
                            // Use stored player position when projectile was created
                            const playerX = projectile.playerX !== undefined ? projectile.playerX : this.player.x;
                            const playerY = projectile.playerY !== undefined ? projectile.playerY : this.player.y;
                            
                            // Calculate vector from enemy to player (when knife was thrown)
                            const enemyToPlayerX = playerX - enemy.x;
                            const enemyToPlayerY = playerY - enemy.y;
                            const enemyToPlayerDist = Math.sqrt(enemyToPlayerX * enemyToPlayerX + enemyToPlayerY * enemyToPlayerY);
                            
                            if (enemyToPlayerDist > 0) {
                                // Normalize enemy-to-player vector
                                const enemyToPlayerNormX = enemyToPlayerX / enemyToPlayerDist;
                                const enemyToPlayerNormY = enemyToPlayerY / enemyToPlayerDist;
                                
                                // Enemy forward direction
                                const enemyForwardX = Math.cos(enemy.rotation);
                                const enemyForwardY = Math.sin(enemy.rotation);
                                
                                // Dot product: negative means player is behind enemy
                                const dot = enemyToPlayerNormX * enemyForwardX + enemyToPlayerNormY * enemyForwardY;
                                isBackstab = dot < 0; // Player was behind enemy
                                
                                if (isBackstab) {
                                    finalDamage *= 2; // 2x damage for backstab
                                }
                            }
                        }
                        
                        // Hit enemy with final damage (including backstab multiplier)
                        const damageDealt = Math.min(finalDamage, enemy.hp);
                        enemy.takeDamage(finalDamage);
                        
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

