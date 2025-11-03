// Main game loop and initialization

// PlayerStats class for tracking individual player statistics
class PlayerStats {
    constructor(playerId) {
        this.playerId = playerId;
        this.damageDealt = 0;
        this.kills = 0;
        this.damageTaken = 0;
        this.roomsCleared = 0;
        
        // Time tracking - only counts time while alive (NOT total run time)
        this.timeAlive = 0; // Accumulated alive time in seconds
        this.lastAliveTimestamp = Date.now(); // When player last became alive
        this.isAlive = true;
    }
    
    // Called when player dies - accumulate time from this life
    onDeath() {
        if (this.isAlive) {
            this.timeAlive += (Date.now() - this.lastAliveTimestamp) / 1000;
            this.isAlive = false;
            this.lastAliveTimestamp = null;
        }
    }
    
    // Called when player revives - start new life timer
    onRevive() {
        if (!this.isAlive) {
            this.lastAliveTimestamp = Date.now();
            this.isAlive = true;
        }
    }
    
    // Get total time alive (includes current life if still alive)
    getTimeAlive() {
        if (this.isAlive && this.lastAliveTimestamp) {
            return this.timeAlive + (Date.now() - this.lastAliveTimestamp) / 1000;
        }
        return this.timeAlive;
    }
    
    // Add to a stat (for modular stat additions)
    addStat(statName, value) {
        if (this.hasOwnProperty(statName)) {
            this[statName] += value;
        }
    }
    
    // Reset stats (for new game)
    reset() {
        this.damageDealt = 0;
        this.kills = 0;
        this.damageTaken = 0;
        this.roomsCleared = 0;
        this.timeAlive = 0;
        this.lastAliveTimestamp = Date.now();
        this.isAlive = true;
    }
}

const Game = {
    // Version tracking (from version.js)
    get VERSION() {
        return typeof GameVersion !== 'undefined' ? GameVersion.VERSION : '1.0.0';
    },
    get UPDATE_MESSAGES() {
        return typeof GameVersion !== 'undefined' ? GameVersion.UPDATE_MESSAGES : { '1.0.0': 'Initial release!' };
    },
    get UPDATE_TYPES() {
        return typeof GameVersion !== 'undefined' ? GameVersion.UPDATE_TYPES : {};
    },
    
    // Canvas and context
    canvas: null,
    ctx: null,
    
    // Game state
    state: 'NEXUS', // 'NEXUS', 'PLAYING', 'PAUSED'
    paused: false,
    pausedFromState: null, // Track where we paused from ('PLAYING' or 'NEXUS')
    showPauseMenu: false, // Visual pause menu flag (for multiplayer - doesn't pause game)
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
    previousProjectiles: [], // Previous projectile state for interpolation (clients)
    particles: [],
    damageNumbers: [],
    remotePlayers: [], // Multiplayer: other players in the lobby
    
    // Stats tracking (legacy - kept for compatibility)
    enemiesKilled: 0,
    roomNumber: 1,
    doorPulse: 0, // For door animation
    
    // Per-player stats tracking (new system)
    playerStats: new Map(), // Map<playerId, PlayerStats>
    deadPlayers: new Set(), // Set of dead player IDs
    allPlayersDead: false, // Flag for when all players are dead
    spectateMode: false, // Local player is spectating after death
    
    // Remote player state tracking (host authority for HP, invulnerability)
    remotePlayerStates: new Map(), // Map<playerId, {hp, maxHp, invulnerable, invulnerabilityTime, size, dead}>
    
    // Host simulation of remote players (thin client architecture)
    remotePlayerInstances: new Map(), // Map<playerId, PlayerInstance> - Host simulates ALL players
    remotePlayerInputs: new Map(), // Map<playerId, InputState> - Host stores latest client inputs
    remotePlayerShadowInstances: new Map(), // Map<playerId, PlayerInstance> - Clients use for rendering (shadow copies)
    
    // Host-side currency and upgrade tracking (authoritative)
    playerCurrencies: new Map(), // Map<playerId, currency>
    playerUpgrades: new Map(), // Map<playerId, {square: {damage, defense, speed}, triangle: {...}, ...}>
    
    // Door waiting state (for multiplayer)
    playersOnDoor: [], // Array of player IDs currently on door
    totalAlivePlayers: 0, // Total number of alive players
    
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
    
    // Multiplayer state
    multiplayerModuleLoaded: false,
    multiplayerEnabled: false,
    
    // Time tracking for death screen
    startTime: 0,
    endTime: 0,
    
    // Game loop control (for background execution in multiplayer)
    useSetTimeoutLoop: false,
    timeoutId: null,
    loopStopped: false,
    
    // Load multiplayer module dynamically
    loadMultiplayerModule() {
        return new Promise((resolve, reject) => {
            // Check if already loaded
            if (this.multiplayerModuleLoaded || typeof initMultiplayer !== 'undefined') {
                this.multiplayerModuleLoaded = true;
                resolve();
                return;
            }
            
            console.log('[Game] Loading multiplayer module...');
            
            const script = document.createElement('script');
            script.src = 'js/multiplayer.js';
            script.onload = () => {
                this.multiplayerModuleLoaded = true;
                console.log('[Game] Multiplayer module loaded');
                resolve();
            };
            script.onerror = () => {
                console.error('[Game] Failed to load multiplayer module');
                reject(new Error('Failed to load multiplayer module'));
            };
            
            document.head.appendChild(script);
        });
    },
    
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
            this.currentCurrency = Math.floor(saveData.currency || 0);
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
        
        // Handle mouse wheel scrolling for update modal
        this.canvas.addEventListener('wheel', (e) => {
            if (this.updateModalVisible && typeof updateModalScroll !== 'undefined') {
                e.preventDefault();
                // Scroll speed: 30 pixels per wheel tick
                updateModalScroll += e.deltaY > 0 ? 30 : -30;
            }
        }, { passive: false });
        
        // Track touch scroll position for update modal
        let updateModalTouchStartY = null;
        let updateModalTouchStartScroll = 0;
        
        // Handle touch scrolling for update modal
        this.canvas.addEventListener('touchstart', (e) => {
            if (this.updateModalVisible && e.touches.length === 1) {
                updateModalTouchStartY = e.touches[0].clientY;
                updateModalTouchStartScroll = typeof updateModalScroll !== 'undefined' ? updateModalScroll : 0;
            }
        }, { passive: false, capture: true });
        
        this.canvas.addEventListener('touchmove', (e) => {
            if (this.updateModalVisible && updateModalTouchStartY !== null && e.touches.length === 1) {
                e.preventDefault();
                e.stopPropagation();
                const deltaY = updateModalTouchStartY - e.touches[0].clientY;
                if (typeof updateModalScroll !== 'undefined') {
                    updateModalScroll = updateModalTouchStartScroll + deltaY;
                }
            }
        }, { passive: false, capture: true });
        
        this.canvas.addEventListener('touchend', (e) => {
            if (this.updateModalVisible) {
                updateModalTouchStartY = null;
            }
        }, { passive: false, capture: true });
        
        // Handle click/touch on canvas (for pause menu buttons, pause button, and interaction button)
        this.canvas.addEventListener('click', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const gameCoords = this.screenToGame(e.clientX, e.clientY);
            
            console.log('[CLICK] Canvas clicked at:', gameCoords.x, gameCoords.y, 'state:', this.state, 'pausedFrom:', this.pausedFromState, 'showPauseMenu:', this.showPauseMenu);
            
            // Check modal close button first (highest priority when modals are visible)
            if (this.launchModalVisible || this.updateModalVisible) {
                if (typeof checkModalCloseButtonClick === 'function') {
                    if (checkModalCloseButtonClick(e.clientX, e.clientY)) {
                        return;
                    }
                }
            }
            
            // Check pause menu buttons first if paused (highest priority)
            // Check both single-player pause state and multiplayer pause menu flag
            const inMultiplayer = this.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.lobbyCode;
            const pauseMenuVisible = this.state === 'PAUSED' || (inMultiplayer && this.showPauseMenu);
            
            if (pauseMenuVisible) {
                // Check if click hits any pause menu button
                if (typeof checkPauseMenuButtonClick === 'function') {
                    if (checkPauseMenuButtonClick(e.clientX, e.clientY)) {
                        return;
                    }
                }
                // If pause menu is visible but click didn't hit a button, consume the click
                return;
            }
            
            // Check pause button overlay if playing or in nexus (before other UI elements)
            if ((this.state === 'PLAYING' || this.state === 'NEXUS') && !pauseMenuVisible) {
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
                // Only allow return when ALL players dead (in multiplayer)
                if (!this.multiplayerEnabled || this.allPlayersDead) {
                    this.returnToNexus();
                }
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
                // Check both single-player pause state and multiplayer pause menu flag
                const inMultiplayer = this.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.lobbyCode;
                const pauseMenuVisible = this.state === 'PAUSED' || (inMultiplayer && this.showPauseMenu);
                
                if (pauseMenuVisible) {
                    // Check if touch hits any pause menu button
                    if (typeof checkPauseMenuButtonClick === 'function') {
                        if (checkPauseMenuButtonClick(touch.clientX, touch.clientY)) {
                            e.preventDefault();
                            e.stopPropagation();
                            return;
                        }
                    }
                    // If pause menu is visible but touch didn't hit a button, block the touch
                    // (pause menu overlay blocks game input)
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
                
                // Check pause button overlay if playing or in nexus (before touch controls)
                // Don't check if pause menu is already showing
                if ((this.state === 'PLAYING' || this.state === 'NEXUS') && !pauseMenuVisible) {
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
                    // Only allow return when ALL players dead (in multiplayer)
                    if (!this.multiplayerEnabled || this.allPlayersDead) {
                        this.returnToNexus();
                        e.preventDefault();
                        e.stopPropagation();
                        return;
                    }
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
                // Close character sheet first if open
                if (typeof CharacterSheet !== 'undefined' && CharacterSheet.isOpen) {
                    CharacterSheet.isOpen = false;
                    return;
                }
                
                // Close multiplayer menu first if visible
                if (typeof multiplayerMenuVisible !== 'undefined' && multiplayerMenuVisible) {
                    // Just close the multiplayer submenu, keep the pause menu open
                    multiplayerMenuVisible = false;
                    return;
                }
                
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
                    // Reset scroll position
                    if (typeof updateModalScroll !== 'undefined') {
                        updateModalScroll = 0;
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
                if (this.player && this.player.dead && (!this.multiplayerEnabled || this.allPlayersDead)) {
                    this.restart();
                }
            }
            if (e.key === 'm' || e.key === 'M') {
                if (this.player && this.player.dead && (!this.multiplayerEnabled || this.allPlayersDead)) {
                    this.returnToNexus();
                }
            }
            if (e.key === ' ' || e.key === 'Spacebar') {
                // Toggle spectate mode (multiplayer only, when local player dead but not all dead)
                if (this.player && this.player.dead && !this.allPlayersDead && this.multiplayerEnabled) {
                    this.spectateMode = !this.spectateMode;
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
    
    // Handle visibility change (for multiplayer background execution)
    handleVisibilityChange() {
        const isHidden = document.hidden;
        
        if (this.multiplayerEnabled && isHidden) {
            // Tab not visible + multiplayer = use setTimeout to keep running
            this.useSetTimeoutLoop = true;
            console.log('[Game] Switched to setTimeout loop (background)');
        } else {
            // Tab visible OR solo mode = use RAF for better performance
            this.useSetTimeoutLoop = false;
            console.log('[Game] Switched to RAF loop (foreground)');
        }
    },
    
    // Stop the game loop
    stopGameLoop() {
        this.loopStopped = true;
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
    },
    
    // Start the game loop
    start() {
        this.lastTime = performance.now();
        this.useSetTimeoutLoop = false;
        this.loopStopped = false;
        
        // Setup visibility listener for multiplayer background execution
        document.addEventListener('visibilitychange', () => {
            this.handleVisibilityChange();
        });
        
        this.gameLoop();
    },
    
    // Main game loop
    gameLoop(currentTime = 0) {
        // Check if loop should stop
        if (this.loopStopped) return;
        
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
                
                // Schedule next frame based on mode
                if (this.useSetTimeoutLoop) {
                    this.timeoutId = setTimeout(() => this.gameLoop(performance.now()), 1000 / 60);
                } else {
                    requestAnimationFrame((time) => this.gameLoop(time));
                }
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
        
        // Check if multiplayer is enabled
        const inMultiplayer = this.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.lobbyCode;
        
        // Update and render based on state
        // In multiplayer, continue updating even when pause menu is shown (showPauseMenu is visual only)
        if (this.state === 'PLAYING') {
            this.update(deltaTime);
        } else if (this.state === 'NEXUS') {
            if (typeof updateNexus !== 'undefined') {
                updateNexus(this.ctx, deltaTime);
            }
        }
        // Note: In multiplayer, showPauseMenu doesn't stop updates - game continues running
        
        this.render();
        
        // Continue the loop - use setTimeout in background for multiplayer, RAF otherwise
        if (this.useSetTimeoutLoop) {
            this.timeoutId = setTimeout(() => this.gameLoop(performance.now()), 1000 / 60);
        } else {
            requestAnimationFrame((time) => this.gameLoop(time));
        }
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
    
    // Get local player ID (solo = 'local', multiplayer = multiplayerManager.playerId)
    getLocalPlayerId() {
        if (this.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.playerId) {
            return multiplayerManager.playerId;
        }
        return 'local'; // Solo mode
    },
    
    // Get or create player stats
    getPlayerStats(playerId) {
        if (!this.playerStats.has(playerId)) {
            this.playerStats.set(playerId, new PlayerStats(playerId));
        }
        return this.playerStats.get(playerId);
    },
    
    // Initialize player stats for a new game
    initializePlayerStats() {
        this.playerStats.clear();
        this.deadPlayers.clear();
        this.allPlayersDead = false;
        this.spectateMode = false;
        
        // Create stats for local player
        const localId = this.getLocalPlayerId();
        this.getPlayerStats(localId);
        
        // In multiplayer, create stats for all players in lobby
        if (this.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager) {
            if (multiplayerManager.players && multiplayerManager.players.length > 0) {
                multiplayerManager.players.forEach(player => {
                    this.getPlayerStats(player.id);
                    
                    // Host: Initialize remote player state tracking AND player instances
                    if (this.isHost() && player.id !== localId) {
                        this.initializeRemotePlayerState(player.id);
                        this.initializeRemotePlayerInstance(player.id, player.class);
                    }
                });
            }
        }
        
        console.log(`[Stats] Initialized stats for ${this.playerStats.size} player(s)`);
        if (this.isHost()) {
            console.log(`[Host] Initialized state tracking for ${this.remotePlayerStates.size} remote player(s)`);
            console.log(`[Host] Initialized player instances for ${this.remotePlayerInstances.size} remote player(s)`);
        }
    },
    
    // Initialize remote player instance (host only - for simulation)
    initializeRemotePlayerInstance(playerId, playerClass) {
        if (!this.isHost()) return;
        
        // Create actual player instance for this remote player
        if (typeof createPlayer !== 'undefined') {
            const playerInstance = createPlayer(playerClass, 100, 300);
            playerInstance.lastAimAngle = 0; // Initialize rotation state for touch controls
            
            // Apply upgrades from host tracking (remote players have their own upgrades)
            const upgrades = this.playerUpgrades.get(playerId);
            if (upgrades && upgrades[playerClass]) {
                const classUpgrades = upgrades[playerClass];
                
                // Get the config for this class to calculate upgrade bonuses
                let config = null;
                if (playerClass === 'square' && typeof WARRIOR_CONFIG !== 'undefined') {
                    config = WARRIOR_CONFIG;
                } else if (playerClass === 'triangle' && typeof ROGUE_CONFIG !== 'undefined') {
                    config = ROGUE_CONFIG;
                } else if (playerClass === 'pentagon' && typeof TANK_CONFIG !== 'undefined') {
                    config = TANK_CONFIG;
                } else if (playerClass === 'hexagon' && typeof MAGE_CONFIG !== 'undefined') {
                    config = MAGE_CONFIG;
                }
                
                if (config) {
                    // Calculate upgrade bonuses using config values
                    const upgradeBonuses = {
                        damage: classUpgrades.damage * config.damagePerLevel,
                        defense: classUpgrades.defense * config.defensePerLevel,
                        speed: classUpgrades.speed * config.speedPerLevel
                    };
                    
                    // Apply upgrades to base stats (config values already loaded in constructor)
                    playerInstance.baseDamage = config.baseDamage + upgradeBonuses.damage;
                    playerInstance.baseMoveSpeed = config.baseSpeed + upgradeBonuses.speed;
                    playerInstance.baseDefense = config.baseDefense + upgradeBonuses.defense;
                    
                    // Recalculate effective stats
                    playerInstance.updateEffectiveStats();
                    
                    console.log(`[Host] Applied upgrades to ${playerId} (${playerClass}): damage=${classUpgrades.damage}, defense=${classUpgrades.defense}, speed=${classUpgrades.speed}`);
                }
            }
            
            this.remotePlayerInstances.set(playerId, playerInstance);
            console.log(`[Host] Created player instance for ${playerId} (${playerClass})`);
        }
    },
    
    // Create input adapter for remote player (passes raw input directly)
    createRemoteInputAdapter(rawInput, remotePlayer) {
        if (!rawInput) return null;
        
        // Wrap serialized joysticks to provide methods (getMagnitude, getAngle, getDirection)
        const wrappedJoysticks = {};
        if (rawInput.touchJoysticks) {
            for (const [name, joystick] of Object.entries(rawInput.touchJoysticks)) {
                wrappedJoysticks[name] = {
                    active: joystick.active || false,
                    magnitude: joystick.magnitude || 0,
                    direction: joystick.direction || { x: 0, y: 0 },
                    justReleased: joystick.justReleased || false,
                    getMagnitude() { return this.magnitude; },
                    getAngle() { return Math.atan2(this.direction.y, this.direction.x); },
                    getDirection() { return this.direction; }
                };
            }
        }
        
        // Wrap serialized buttons to match TouchButton structure
        const wrappedButtons = {};
        if (rawInput.touchButtons) {
            for (const [name, button] of Object.entries(rawInput.touchButtons)) {
                wrappedButtons[name] = {
                    pressed: button.pressed || false,
                    justPressed: button.justPressed || false,
                    justReleased: button.justReleased || false,
                    // Include finalJoystickState for press-and-release abilities
                    finalJoystickState: button.finalJoystickState || null
                };
            }
        }
        
        // Return minimal adapter - expose raw input directly
        // Player classes will handle their own logic for desktop vs mobile
        return {
            // Expose raw properties directly
            keys: rawInput.keys || {},
            mouse: rawInput.mouse || { x: 0, y: 0 },
            mouseLeft: rawInput.mouseLeft || false,
            mouseRight: rawInput.mouseRight || false,
            
            // Wrapped touch controls with methods
            touchJoysticks: wrappedJoysticks,
            touchButtons: wrappedButtons,
            
            // Simple helper methods
            isTouchMode() {
                return rawInput.isTouchMode || false;
            },
            
            getKeyState(key) {
                const keyLower = key.toLowerCase();
                
                // Check special keys first
                if (keyLower === 'w' || keyLower === 'arrowup') return rawInput.up || false;
                if (keyLower === 's' || keyLower === 'arrowdown') return rawInput.down || false;
                if (keyLower === 'a' || keyLower === 'arrowleft') return rawInput.left || false;
                if (keyLower === 'd' || keyLower === 'arrowright') return rawInput.right || false;
                if (keyLower === ' ' || keyLower === 'space') return rawInput.space || false;
                if (keyLower === 'shift') return rawInput.shift || false;
                
                // Check keys object
                return rawInput.keys ? (rawInput.keys[keyLower] || false) : false;
            },
            
            // Movement input - handle both mobile and desktop natively
            getMovementInput() {
                let x = 0, y = 0;
                
                if (rawInput.isTouchMode && rawInput.touchJoysticks && rawInput.touchJoysticks.movement) {
                    // Mobile: use joystick directly
                    const joystick = rawInput.touchJoysticks.movement;
                    if (joystick.active) {
                        x = joystick.direction.x * joystick.magnitude;
                        y = joystick.direction.y * joystick.magnitude;
                    }
                } else {
                    // Desktop: use keys
                    if (rawInput.up) y -= 1;
                    if (rawInput.down) y += 1;
                    if (rawInput.left) x -= 1;
                    if (rawInput.right) x += 1;
                    
                    // Normalize diagonal movement
                    if (x !== 0 && y !== 0) {
                        const len = Math.sqrt(x * x + y * y);
                        x /= len;
                        y /= len;
                    }
                }
                
                return { x, y };
            },
            
            // Aim direction - handle both mobile and desktop natively
            getAimDirection() {
                if (!remotePlayer) return 0;
                
                if (rawInput.isTouchMode && rawInput.touchJoysticks) {
                    // Mobile: check joysticks with priority (heavy → special → basic)
                    const heavyAttack = rawInput.touchJoysticks.heavyAttack;
                    if (heavyAttack && heavyAttack.active && heavyAttack.magnitude > 0.1) {
                        const angle = Math.atan2(heavyAttack.direction.y, heavyAttack.direction.x);
                        remotePlayer.lastAimAngle = angle;
                        return angle;
                    }
                    
                    const specialAbility = rawInput.touchJoysticks.specialAbility;
                    if (specialAbility && specialAbility.active && specialAbility.magnitude > 0.1) {
                        const angle = Math.atan2(specialAbility.direction.y, specialAbility.direction.x);
                        remotePlayer.lastAimAngle = angle;
                        return angle;
                    }
                    
                    const basicAttack = rawInput.touchJoysticks.basicAttack;
                    if (basicAttack && basicAttack.active && basicAttack.magnitude > 0.1) {
                        const angle = Math.atan2(basicAttack.direction.y, basicAttack.direction.x);
                        remotePlayer.lastAimAngle = angle;
                        return angle;
                    }
                    
                    // No joystick active: maintain last angle
                    return remotePlayer.lastAimAngle || 0;
                } else {
                    // Desktop: use mouse position
                    const dx = rawInput.mouse.x - remotePlayer.x;
                    const dy = rawInput.mouse.y - remotePlayer.y;
                    return Math.atan2(dy, dx);
                }
            },
            
            // Get ability input type (for future flexibility with control layout changes)
            getAbilityInputType(classType, ability) {
                // Delegate to global Input if available (has the class config)
                if (typeof Input !== 'undefined' && Input.getAbilityInputType) {
                    return Input.getAbilityInputType(classType, ability);
                }
                // Fallback: return 'button' as default
                return 'button';
            },
            
            // Check if ability is pressed (required by player classes)
            isAbilityPressed(ability) {
                if (rawInput.isTouchMode) {
                    // Touch mode: check joysticks and buttons natively
                    if (ability === 'basicAttack' && this.touchJoysticks.basicAttack) {
                        return this.touchJoysticks.basicAttack.active && this.touchJoysticks.basicAttack.magnitude > 0.1;
                    }
                    // For button abilities
                    if (this.touchButtons[ability]) {
                        return this.touchButtons[ability].pressed;
                    }
                    return false;
                } else {
                    // Desktop mode: check keyboard/mouse
                    if (ability === 'basicAttack') return rawInput.mouseLeft || false;
                    if (ability === 'heavyAttack') return rawInput.mouseRight || false;
                    if (ability === 'specialAbility') return rawInput.space || false;
                    if (ability === 'dodge') return rawInput.shift || false;
                    return false;
                }
            },
            
            // Get ability direction (for projectile abilities)
            getAbilityDirection(ability) {
                if (!remotePlayer) return { x: 0, y: 0 };
                
                if (rawInput.isTouchMode && this.touchJoysticks) {
                    // Touch mode: get direction from joystick
                    if (ability === 'basicAttack' && this.touchJoysticks.basicAttack) {
                        return this.touchJoysticks.basicAttack.getDirection();
                    }
                    if (ability === 'heavyAttack') {
                        // Check if heavy attack joystick is active
                        if (this.touchJoysticks.heavyAttack && this.touchJoysticks.heavyAttack.active) {
                            return this.touchJoysticks.heavyAttack.getDirection();
                        }
                        // Fallback to basic attack joystick
                        if (this.touchJoysticks.basicAttack) {
                            return this.touchJoysticks.basicAttack.getDirection();
                        }
                    }
                    if (ability === 'specialAbility' && this.touchJoysticks.specialAbility) {
                        // Check if class needs joystick for special ability
                        const playerClass = remotePlayer.playerClass;
                        const specialInputType = this.getAbilityInputType(playerClass, 'specialAbility');
                        const needsSpecialJoystick = specialInputType === 'joystick-press-release' || 
                            specialInputType === 'joystick-continuous';
                        if (needsSpecialJoystick && this.touchJoysticks.specialAbility.active) {
                            return this.touchJoysticks.specialAbility.getDirection();
                        }
                    }
                    return { x: 0, y: 0 };
                } else {
                    // Desktop mode: calculate direction from mouse to player
                    const dx = rawInput.mouse.x - remotePlayer.x;
                    const dy = rawInput.mouse.y - remotePlayer.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist > 0) {
                        return { x: dx / dist, y: dy / dist };
                    }
                    return { x: 0, y: 0 };
                }
            },
            
            // Get ability angle (for directional abilities)
            getAbilityAngle(ability) {
                if (rawInput.isTouchMode && this.touchJoysticks) {
                    if (ability === 'basicAttack' && this.touchJoysticks.basicAttack) {
                        return this.touchJoysticks.basicAttack.getAngle();
                    }
                    if (ability === 'heavyAttack') {
                        if (this.touchJoysticks.heavyAttack && this.touchJoysticks.heavyAttack.active) {
                            return this.touchJoysticks.heavyAttack.getAngle();
                        }
                        if (this.touchJoysticks.basicAttack) {
                            return this.touchJoysticks.basicAttack.getAngle();
                        }
                    }
                    if (ability === 'specialAbility' && this.touchJoysticks.specialAbility) {
                        const playerClass = remotePlayer ? remotePlayer.playerClass : null;
                        const specialInputType = this.getAbilityInputType(playerClass, 'specialAbility');
                        const needsSpecialJoystick = specialInputType === 'joystick-press-release' || 
                            specialInputType === 'joystick-continuous';
                        if (needsSpecialJoystick && this.touchJoysticks.specialAbility.active) {
                            return this.touchJoysticks.specialAbility.getAngle();
                        }
                    }
                    return 0;
                }
                return 0;
            },
            
            // Stub update method (no-op for remote input)
            update() {
                // Remote input doesn't need to update
            }
        };
    },
    
    // Get remote player input state (host only)
    getRemotePlayerInput(playerId) {
        return this.remotePlayerInputs.get(playerId) || null;
    },
    
    // Store remote player input (host only)
    storeRemotePlayerInput(playerId, inputState) {
        if (!this.isHost()) return;
        
        // Track previous state to detect button releases
        const previousInput = this.remotePlayerInputs.get(playerId);
        
        // If we have previous state, detect state changes and set justPressed/justReleased
        if (previousInput && previousInput.touchButtons && inputState.touchButtons) {
            for (const [buttonName, currentButton] of Object.entries(inputState.touchButtons)) {
                const prevButton = previousInput.touchButtons[buttonName];
                if (prevButton && currentButton) {
                    // Detect press: was not pressed, now pressed
                    currentButton.justPressed = !prevButton.pressed && currentButton.pressed;
                    // Detect release: was pressed, now not pressed
                    const wasPressed = prevButton.pressed;
                    const isPressed = currentButton.pressed;
                    currentButton.justReleased = wasPressed && !isPressed;
                    
                    // Debug log state changes
                    if (currentButton.justPressed) {
                        console.log(`[Host] Detected ${buttonName} PRESS for ${playerId}`);
                    }
                    if (currentButton.justReleased) {
                        console.log(`[Host] Detected ${buttonName} RELEASE for ${playerId} (was: ${wasPressed}, now: ${isPressed}), finalJoystickState:`, currentButton.finalJoystickState);
                    }
                }
            }
        } else if (inputState.touchButtons) {
            // First frame - initialize justPressed/justReleased to false if not set
            for (const [buttonName, currentButton] of Object.entries(inputState.touchButtons)) {
                if (currentButton.justPressed === undefined) currentButton.justPressed = false;
                if (currentButton.justReleased === undefined) currentButton.justReleased = false;
            }
        }
        
        this.remotePlayerInputs.set(playerId, inputState);
    },
    
    // Update shadow instance with host state (clients only)
    updateShadowInstance(shadowInstance, playerData) {
        // Let the player apply its own state! (clean architecture)
        // applyState() will set interpolation targets for clients
        if (shadowInstance.applyState) {
            shadowInstance.applyState(playerData);
        }
    },
    
    // Check if all players are dead (multiplayer)
    checkAllPlayersDead() {
        if (!this.multiplayerEnabled || typeof multiplayerManager === 'undefined' || !multiplayerManager) {
            // Solo mode - just check local player
            return this.player && this.player.dead;
        }
        
        // Multiplayer - check if all players are dead
        const totalPlayers = multiplayerManager.players ? multiplayerManager.players.length : 1;
        return this.deadPlayers.size >= totalPlayers;
    },
    
    // Check if current instance is the host
    isHost() {
        return this.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.isHost;
    },
    
    // Check if current instance is a multiplayer client (not host)
    isMultiplayerClient() {
        return this.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.lobbyCode && !multiplayerManager.isHost;
    },
    
    // Get enemy index in the enemies array
    getEnemyIndex(enemy) {
        return this.enemies.indexOf(enemy);
    },
    
    // Send enemy damage event to host (client only)
    sendEnemyDamageEvent(enemyIndex, damage, hitboxX, hitboxY, hitboxRadius, hitWeakPoint) {
        if (!this.isMultiplayerClient()) return;
        
        if (typeof multiplayerManager !== 'undefined' && multiplayerManager) {
            multiplayerManager.send({
                type: 'enemy_damaged',
                data: {
                    enemyIndex: enemyIndex,
                    damage: damage,
                    attackerId: multiplayerManager.playerId,
                    hitboxX: hitboxX,
                    hitboxY: hitboxY,
                    hitboxRadius: hitboxRadius,
                    hitWeakPoint: hitWeakPoint
                }
            });
        }
    },
    
    // Send player damage event to specific client (host only)
    sendPlayerDamageEvent(targetPlayerId, damage) {
        if (!this.isHost()) return;
        
        if (typeof multiplayerManager !== 'undefined' && multiplayerManager) {
            multiplayerManager.send({
                type: 'player_damaged',
                data: {
                    targetPlayerId: targetPlayerId,
                    damage: damage
                }
            });
        }
    },
    
    // Initialize remote player state (host only)
    initializeRemotePlayerState(playerId) {
        this.remotePlayerStates.set(playerId, {
            id: playerId,
            hp: 100,
            maxHp: 100,
            invulnerable: false,
            invulnerabilityTime: 0,
            size: 20,
            dead: false
        });
        console.log(`[Host] Initialized state for remote player: ${playerId}`);
    },
    
    // Update invulnerability frames for remote players (host only)
    updateRemotePlayerInvulnerability(deltaTime) {
        if (!this.isHost()) return;
        
        this.remotePlayerStates.forEach(state => {
            if (state.invulnerabilityTime > 0) {
                state.invulnerabilityTime -= deltaTime;
                if (state.invulnerabilityTime <= 0) {
                    state.invulnerable = false;
                    state.invulnerabilityTime = 0;
                }
            }
        });
    },
    
    // Apply damage to remote player (host only)
    damageRemotePlayer(playerId, damage) {
        const state = this.remotePlayerStates.get(playerId);
        if (!state || state.invulnerable || state.dead) {
            return false; // Damage not applied (invuln or dead)
        }
        
        // Apply damage
        state.hp -= damage;
        state.invulnerable = true;
        state.invulnerabilityTime = 0.5; // Same as local player
        
        // Check if dead
        if (state.hp <= 0) {
            state.hp = 0;
            state.dead = true;
            
            // Add to dead players set
            this.deadPlayers.add(playerId);
            
            // Track death in stats
            if (this.getPlayerStats) {
                const stats = this.getPlayerStats(playerId);
                stats.onDeath();
            }
            
            // Check if all players are dead
            this.allPlayersDead = this.checkAllPlayersDead();
            
            console.log(`[Host] Remote player ${playerId} died!`);
        }
        
        return true; // Damage was applied
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
        
        // Update players based on multiplayer role
        if (this.multiplayerEnabled) {
            if (this.isHost()) {
                // HOST: Update local player + simulate all remote player instances
                if (this.player && this.player.alive) {
                    this.player.update(deltaTime, Input);
                }
                
                // Update all remote player instances with their inputs
                this.remotePlayerInstances.forEach((playerInstance, playerId) => {
                    if (playerInstance && playerInstance.alive) {
                        const rawInput = this.getRemotePlayerInput(playerId);
                        if (rawInput) {
                            // Convert raw input to Input interface using adapter
                            const inputAdapter = this.createRemoteInputAdapter(rawInput, playerInstance);
                            
                            // Debug: Log adapter state when touch buttons have releases
                            if (rawInput.isTouchMode && rawInput.touchButtons) {
                                for (const [name, btn] of Object.entries(rawInput.touchButtons)) {
                                    if (btn.justReleased) {
                                        console.log(`[Host] About to update ${playerId} with ${name} justReleased, isTouchMode():`, inputAdapter.isTouchMode ? inputAdapter.isTouchMode() : 'NO FUNCTION');
                                        console.log(`[Host] Adapter touchButtons.${name}:`, inputAdapter.touchButtons ? inputAdapter.touchButtons[name] : 'NO TOUCHBUTTONS');
                                    }
                                }
                            }
                            
                            playerInstance.update(deltaTime, inputAdapter);
                        } else {
                            // No input received yet from this client
                            // This can happen during initial connection
                        }
                    }
                });
                
                // Update remote player invulnerability frames
                this.updateRemotePlayerInvulnerability(deltaTime);
            } else {
                // CLIENT: Update local player visuals/previews WITHOUT executing abilities
                // Abilities are host-authoritative - client only shows previews
                if (this.player && this.player.alive) {
                    // Store host-authoritative state
                    const savedX = this.player.x;
                    const savedY = this.player.y;
                    const savedVx = this.player.vx;
                    const savedVy = this.player.vy;
                    const savedRotation = this.player.rotation;
                    const savedIsDodging = this.player.isDodging;
                    const savedIsChargingHeavy = this.player.isChargingHeavy;
                    
                    // Update visuals/previews but prevent ability execution
                    // We'll manually update preview states based on input
                    if (Input.isTouchMode && Input.isTouchMode()) {
                        // Clear all previews first, then activate based on current input
                        this.player.dashPreviewActive = false;
                        if (this.player.clearHeavyAttackPreview) {
                            this.player.clearHeavyAttackPreview();
                        }
                        
                        // Update dash preview for Rogue (triangle)
                        if (this.player.playerClass === 'triangle' && Input.touchButtons && Input.touchButtons.dodge) {
                            const button = Input.touchButtons.dodge;
                            if (button.pressed && Input.touchJoysticks && Input.touchJoysticks.dodge) {
                                const joystick = Input.touchJoysticks.dodge;
                                if (joystick.active && joystick.getMagnitude() > 0.1) {
                                    this.player.dashPreviewActive = true;
                                    this.player.rotation = joystick.getAngle();
                                    // Update preview position (uses saved position which is host position)
                                    if (this.player.updateDashPreview) {
                                        this.player.updateDashPreview(Input);
                                    }
                                }
                            }
                        }
                        
                        // Update heavy attack preview for Warrior/Triangle
                        if ((this.player.playerClass === 'square' || this.player.playerClass === 'triangle') && 
                            Input.touchButtons && Input.touchButtons.heavyAttack) {
                            const button = Input.touchButtons.heavyAttack;
                            if (button.pressed && Input.touchJoysticks && Input.touchJoysticks.heavyAttack) {
                                const joystick = Input.touchJoysticks.heavyAttack;
                                if (joystick.active && joystick.getMagnitude() > 0.1) {
                                    this.player.rotation = joystick.getAngle();
                                    if (this.player.updateHeavyAttackPreview) {
                                        this.player.updateHeavyAttackPreview(Input);
                                    }
                                }
                            }
                        }
                        
                        // Update rotation based on attack joysticks (priority: heavy > special > basic)
                        if (Input.touchJoysticks) {
                            const heavyAttack = Input.touchJoysticks.heavyAttack;
                            const specialAbility = Input.touchJoysticks.specialAbility;
                            const basicAttack = Input.touchJoysticks.basicAttack;
                            
                            if (heavyAttack && heavyAttack.active && heavyAttack.getMagnitude() > 0.1) {
                                this.player.rotation = heavyAttack.getAngle();
                            } else if (specialAbility && specialAbility.active && specialAbility.getMagnitude() > 0.1) {
                                this.player.rotation = specialAbility.getAngle();
                            } else if (basicAttack && basicAttack.active && basicAttack.getMagnitude() > 0.1) {
                                this.player.rotation = basicAttack.getAngle();
                            }
                        }
                    } else {
                        // Desktop mode: clear previews
                        this.player.dashPreviewActive = false;
                        if (this.player.clearHeavyAttackPreview) {
                            this.player.clearHeavyAttackPreview();
                        }
                    }
                    
                    // Restore host-authoritative state (abilities execute on host only)
                    this.player.x = savedX;
                    this.player.y = savedY;
                    this.player.vx = savedVx;
                    this.player.vy = savedVy;
                    this.player.isDodging = savedIsDodging;
                    this.player.isChargingHeavy = savedIsChargingHeavy;
                    // Keep rotation for visual feedback, but interpolate will correct it
                    
                    // Interpolate to host position
                    if (this.player.interpolatePosition) {
                        this.player.interpolatePosition(deltaTime);
                    }
                }
                
                // Remote player shadow instances interpolation
                if (this.remotePlayerShadowInstances) {
                    this.remotePlayerShadowInstances.forEach((shadowInstance, playerId) => {
                        if (shadowInstance && shadowInstance.alive && shadowInstance.interpolatePosition) {
                            shadowInstance.interpolatePosition(deltaTime);
                        }
                    });
                }
            }
        } else {
            // SOLO: Update normally
            if (this.player && this.player.alive) {
                this.player.update(deltaTime, Input);
            }
        }
        
        // MULTIPLAYER: Snapshot input state BEFORE resetting flags
        // This preserves justPressed/justReleased for serialization
        if (this.isMultiplayerClient() && typeof multiplayerManager !== 'undefined' && multiplayerManager) {
            // Cache current input state before Input.update() resets justPressed/justReleased
            multiplayerManager.cachedInputSnapshot = multiplayerManager.serializeInput();
        }
        
        // Update input system (for touch controls) AFTER player reads button states
        // This resets justPressed/justReleased flags for next frame
        if (typeof Input !== 'undefined' && Input.update) {
            Input.update(deltaTime);
        }
        
        // Update enemies (host simulates AI, clients interpolate positions)
        if (this.isHost() || !this.multiplayerEnabled) {
            // Get any alive player for enemy targeting
            let targetPlayer = this.player;
            
            // If local player is dead, find an alive remote player (host only)
            if (this.multiplayerEnabled && (!this.player || this.player.dead)) {
                for (const [playerId, playerInstance] of this.remotePlayerInstances) {
                    if (playerInstance.alive && !playerInstance.dead) {
                        targetPlayer = playerInstance;
                        break;
                    }
                }
            }
            
            // Host or solo: Run full enemy AI and movement (continue even if host is dead)
            if (targetPlayer) {
                this.enemies.forEach(enemy => {
                    if (enemy.alive) {
                        // Skip update if this is a boss and intro not complete
                        if (enemy.isBoss && !enemy.introComplete) {
                            return;
                        }
                        enemy.update(deltaTime, targetPlayer);
                    }
                });
            }
        } else {
            // Client: Only interpolate positions from host
            this.enemies.forEach(enemy => {
                if (enemy.alive && enemy.interpolateToTarget) {
                    enemy.interpolateToTarget(deltaTime);
                }
            });
        }
        
        // Update projectiles
        this.updateProjectiles(deltaTime);
        
        // Check collisions
        // Host: check collisions if ANY player alive (local or remote)
        // Client: check collisions if local player alive
        const shouldCheckCollisions = this.player && (
            this.player.alive || 
            (this.isHost() && this.remotePlayers && this.remotePlayers.some(rp => rp.hp > 0))
        );
        
        if (shouldCheckCollisions) {
            // Player attacks against enemies
            if (this.isHost() || !this.multiplayerEnabled) {
                // Host or solo: Check local player AND all remote player instances
                if (this.player && this.player.alive) {
                    checkAttacksVsEnemies(this.player, this.enemies);
                }
                
                // Check remote player instance attacks (host only)
                if (this.remotePlayerInstances) {
                    this.remotePlayerInstances.forEach(playerInstance => {
                        if (playerInstance && playerInstance.alive) {
                            checkAttacksVsEnemies(playerInstance, this.enemies);
                        }
                    });
                }
            } else {
                // Client: Don't check attacks (host does this)
            }
            
            // Enemy attacks: host checks all players, client checks local
            checkEnemiesVsPlayer(this.player, this.enemies);
            
            // Enemy collisions with clones/decoys
            checkEnemiesVsClones(this.player, this.enemies);
            
            // Projectiles
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
        
        // Multiplayer: Send game state if host, or player state if client
        // IMPORTANT: Send state BEFORE filtering dead enemies so clients know which ones died
        if (this.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager) {
            if (multiplayerManager.isHost) {
                multiplayerManager.sendGameState();
            } else {
                multiplayerManager.sendPlayerState();
            }
        }
        
        // Remove dead enemies and track kills
        // This happens AFTER broadcasting so clients receive the alive=false state
        if (this.isHost() || !this.multiplayerEnabled) {
            // Host or solo: filter and track kills
            this.enemies = this.enemies.filter(enemy => {
                if (!enemy.alive) {
                    this.enemiesKilled++;
                }
                return enemy.alive;
            });
        } else {
            // Client: filter dead enemies (authoritative state from host)
            this.enemies = this.enemies.filter(enemy => enemy.alive);
        }
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
        
        // Drop old gear on the ground if it existed
        if (oldGear) {
            // Add small random offset to prevent exact overlap with other items
            const offsetX = (Math.random() - 0.5) * 20;
            const offsetY = (Math.random() - 0.5) * 20;
            
            // Set position to player location with offset
            oldGear.x = this.player.x + offsetX;
            oldGear.y = this.player.y + offsetY;
            
            // Clamp to game bounds to prevent gear spawning outside playable area
            const margin = 50;
            oldGear.x = Math.max(margin, Math.min(this.config.width - margin, oldGear.x));
            oldGear.y = Math.max(margin, Math.min(this.config.height - margin, oldGear.y));
            
            // Reset pulse animation
            oldGear.pulse = 0;
            
            // Add to ground loot
            groundLoot.push(oldGear);
            
            console.log(`Dropped ${oldGear.name || oldGear.tier + ' ' + oldGear.slot} on ground`);
            
            // Multiplayer: Broadcast dropped gear to other clients
            if (this.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager) {
                multiplayerManager.send({
                    type: 'gear_dropped',
                    data: {
                        playerId: multiplayerManager.playerId,
                        gear: {
                            id: oldGear.id,
                            x: oldGear.x,
                            y: oldGear.y,
                            slot: oldGear.slot,
                            tier: oldGear.tier,
                            color: oldGear.color,
                            bonus: oldGear.bonus,
                            stats: oldGear.stats,
                            affixes: oldGear.affixes || [],
                            classModifier: oldGear.classModifier || null,
                            weaponType: oldGear.weaponType || null,
                            armorType: oldGear.armorType || null,
                            legendaryEffect: oldGear.legendaryEffect || null,
                            name: oldGear.name,
                            roomNumber: oldGear.roomNumber,
                            scaling: oldGear.scaling,
                            pulse: 0
                        }
                    }
                });
            }
        }
        
        // Remove picked up gear from ground
        const index = groundLoot.indexOf(gear);
        if (index > -1) {
            groundLoot.splice(index, 1);
        }
        
        console.log(`Picked up ${gear.name || gear.tier + ' ' + gear.slot}`);
        if (gear.weaponType) console.log(`  Weapon Type: ${gear.weaponType}`);
        if (gear.armorType) console.log(`  Armor Type: ${gear.armorType}`);
        if (gear.affixes && gear.affixes.length > 0) {
            console.log(`  Affixes (${gear.affixes.length}):`);
            gear.affixes.forEach(affix => {
                const isIntegerAffix = ['dodgeCharges', 'maxHealth', 'pierce', 'chainLightning', 'multishot'].includes(affix.type);
                const val = isIntegerAffix
                    ? `+${affix.value.toFixed(0)}` 
                    : `+${(affix.value * 100).toFixed(0)}%`;
                const tierBadge = affix.tier ? `[${affix.tier.toUpperCase()}]` : '';
                console.log(`    - ${tierBadge} ${affix.type}: ${val}`);
            });
        }
        if (gear.classModifier) {
            console.log(`  Class Modifier [${gear.classModifier.class}]: ${gear.classModifier.description}`);
        }
        if (gear.legendaryEffect) {
            console.log(`  LEGENDARY: ${gear.legendaryEffect.description}`);
        }
        console.log(`New stats - Damage: ${this.player.damage.toFixed(1)}, Defense: ${(this.player.defense * 100).toFixed(1)}%, Speed: ${this.player.moveSpeed.toFixed(1)}`);
        
        // Multiplayer: Notify all players of loot pickup so it's removed everywhere
        // Send full gear object so host can equip it on remote player instance
        if (this.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager) {
            multiplayerManager.send({
                type: 'loot_pickup',
                data: {
                    playerId: multiplayerManager.playerId,
                    lootId: gear.id, // Use loot ID for reliable sync
                    gear: {
                        id: gear.id,
                        slot: gear.slot,
                        tier: gear.tier,
                        color: gear.color,
                        bonus: gear.bonus,
                        stats: gear.stats,
                        affixes: gear.affixes || [],  // NEW: Affix system
                        classModifier: gear.classModifier || null, // NEW: Class modifiers
                        weaponType: gear.weaponType || null, // NEW: Weapon types
                        armorType: gear.armorType || null,   // NEW: Armor types
                        legendaryEffect: gear.legendaryEffect || null, // NEW: Legendary effects
                        name: gear.name               // NEW: Gear names
                    }
                }
            });
        }
    },
    
    // Check door collision
    checkDoorCollision() {
        const doorPos = getDoorPosition();
        
        // Multiplayer: Check if ALL ALIVE players are on the door
        if (this.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager) {
            // Only host can trigger room advancement
            if (!this.isHost()) return;
            
            // Collect all alive players (host may be dead, but remote players can still advance)
            const alivePlayers = [];
            const playersOnDoor = [];
            
            // Check local player
            if (this.player && this.player.alive) {
                alivePlayers.push({ player: this.player, id: this.getLocalPlayerId() });
            }
            
            // Check remote player instances
            if (this.remotePlayerInstances) {
                this.remotePlayerInstances.forEach((playerInstance, playerId) => {
                    if (playerInstance && playerInstance.alive && !playerInstance.dead) {
                        alivePlayers.push({ player: playerInstance, id: playerId });
                    }
                });
            }
            
            // If no alive players, can't advance
            if (alivePlayers.length === 0) return;
            
            // Check which players are on the door
            alivePlayers.forEach(({ player, id }) => {
                const dx = player.x - Math.max(doorPos.x, Math.min(player.x, doorPos.x + doorPos.width));
                const dy = player.y - Math.max(doorPos.y, Math.min(player.y, doorPos.y + doorPos.height));
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance <= player.size) {
                    playersOnDoor.push(id);
                }
            });
            
            // Store door waiting state for UI
            this.playersOnDoor = playersOnDoor;
            this.totalAlivePlayers = alivePlayers.length;
            
            // All alive players on door → advance
            if (playersOnDoor.length === alivePlayers.length && playersOnDoor.length > 0) {
                this.advanceToNextRoom();
            }
        } else {
            // Solo: Just check local player
            if (!this.player || !this.player.alive) return;
            
            const dx = this.player.x - Math.max(doorPos.x, Math.min(this.player.x, doorPos.x + doorPos.width));
            const dy = this.player.y - Math.max(doorPos.y, Math.min(this.player.y, doorPos.y + doorPos.height));
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance <= this.player.size) {
                this.advanceToNextRoom();
            }
        }
    },
    
    // Advance to next room
    advanceToNextRoom() {
        this.roomNumber++;
        
        // Reset door waiting state
        this.playersOnDoor = [];
        this.totalAlivePlayers = 0;
        
        // Phoenix down is now charge-based, no need to reset per room
        // Charges persist across rooms and are recharged by dealing damage
        
        // Multiplayer: Revive dead players at 50% HP
        if (this.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager) {
            const localPlayerId = this.getLocalPlayerId();
            
            // Revive local player if dead
            if (this.player && this.player.dead && this.deadPlayers.has(localPlayerId)) {
                this.player.dead = false;
                this.player.alive = true;
                this.player.hp = this.player.maxHp * 0.5; // Revive at 50% HP
                
                // Update stats - restart alive timer
                const stats = this.getPlayerStats(localPlayerId);
                stats.onRevive();
                
                // Remove from dead players
                this.deadPlayers.delete(localPlayerId);
                this.allPlayersDead = false;
                this.spectateMode = false;
                
                console.log(`[Revival] Player revived at 50% HP (${Math.floor(this.player.hp)}/${Math.floor(this.player.maxHp)})`);
            }
            
            // Host: Revive remote players if dead
            if (this.isHost()) {
                // Revive remote player instances (for simulation)
                this.remotePlayerInstances.forEach((playerInstance, playerId) => {
                    if (playerInstance.dead && this.deadPlayers.has(playerId)) {
                        playerInstance.dead = false;
                        playerInstance.alive = true;
                        playerInstance.hp = playerInstance.maxHp * 0.5; // Revive at 50% HP
                        
                        // Update remote player state tracking
                        const state = this.remotePlayerStates.get(playerId);
                        if (state) {
                            state.dead = false;
                            state.hp = playerInstance.hp;
                            state.invulnerable = false;
                            state.invulnerabilityTime = 0;
                        }
                        
                        // Update stats - restart alive timer
                        const stats = this.getPlayerStats(playerId);
                        if (stats) {
                            stats.onRevive();
                        }
                        
                        // Remove from dead players
                        this.deadPlayers.delete(playerId);
                        
                        console.log(`[Host Revival] Remote player ${playerId} revived at 50% HP (${Math.floor(playerInstance.hp)}/${Math.floor(playerInstance.maxHp)})`);
                    }
                });
                
                this.allPlayersDead = false;
            }
            
            // Update rooms cleared for all players
            this.playerStats.forEach((stats, playerId) => {
                stats.roomsCleared = this.roomNumber - 1;
            });
        } else {
            // Solo mode - update rooms in local stats
            if (this.getLocalPlayerId && this.getPlayerStats) {
                const localId = this.getLocalPlayerId();
                const stats = this.getPlayerStats(localId);
                stats.roomsCleared = this.roomNumber - 1;
            }
        }
        
        // Generate new room (host only in multiplayer)
        if (typeof generateRoom !== 'undefined') {
            if (this.multiplayerEnabled && !this.isHost()) {
                // Client: Don't generate room/enemies - wait for host
                this.enemies = [];
                
                // Clear ground loot (will be synced from host)
                if (typeof groundLoot !== 'undefined') {
                    groundLoot.length = 0;
                }
                
                // Reset player position to left side
                this.player.x = 50;
                this.player.y = 300;
                
                console.log(`[Client] Waiting for room ${this.roomNumber} from host...`);
            } else {
                // Host or solo: Generate room normally
                const newRoom = generateRoom(this.roomNumber);
                
                // Update currentRoom to the new room
                if (typeof currentRoom !== 'undefined') {
                    currentRoom = newRoom;
                }
                
                // Update enemies array
                this.enemies = newRoom.enemies;
                
                // Assign initial targets for aggro system (host only, multiplayer only)
                if (this.isHost()) {
                    this.enemies.forEach(enemy => {
                        if (enemy.assignInitialTarget) {
                            enemy.assignInitialTarget();
                        }
                    });
                }
                
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
                
                // Reset remote player instances to spawn (host only)
                if (this.isHost() && this.remotePlayerInstances) {
                    this.remotePlayerInstances.forEach((playerInstance, playerId) => {
                        playerInstance.x = 50;
                        playerInstance.y = 300;
                    });
                }
                
                console.log(`Advanced to Room ${this.roomNumber}${newRoom.type === 'boss' ? ' (BOSS ROOM)' : ''}`);
                
                // Multiplayer: Send room transition message and immediate state update
                if (this.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager) {
                    if (multiplayerManager.isHost) {
                        // Send room transition message first (with revival data)
                        multiplayerManager.send({
                            type: 'room_transition',
                            data: {
                                roomNumber: this.roomNumber,
                                reviveePlayers: true, // Signal to revive dead players
                                timestamp: Date.now()
                            }
                        });
                        
                        // Then send game state
                        multiplayerManager.sendGameState();
                    } else {
                        multiplayerManager.sendPlayerState();
                    }
                }
            }
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
        
        // Check if multiplayer is enabled
        const inMultiplayer = this.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.lobbyCode;
        
        // Render based on game state
        if (this.state === 'NEXUS') {
            if (typeof renderNexus !== 'undefined') {
                renderNexus(this.ctx);
            }
            
            // In multiplayer, show pause menu overlay if showPauseMenu is true
            if (inMultiplayer && this.showPauseMenu) {
                // Draw pause menu overlay
                if (typeof renderPauseMenu !== 'undefined') {
                    renderPauseMenu(this.ctx);
                }
            }
        } else if (this.state === 'PAUSED') {
            // If in multiplayer, convert PAUSED state to proper multiplayer pause menu
            if (inMultiplayer) {
                // Convert single-player pause state to multiplayer pause menu
                if (this.pausedFromState === 'NEXUS') {
                    this.state = 'NEXUS';
                    this.showPauseMenu = true;
                    this.paused = false;
                    // Render nexus with pause menu overlay
                    if (typeof renderNexus !== 'undefined') {
                        renderNexus(this.ctx);
                    }
                    if (typeof renderPauseMenu !== 'undefined') {
                        renderPauseMenu(this.ctx);
                    }
                } else if (this.pausedFromState === 'PLAYING') {
                    this.state = 'PLAYING';
                    this.showPauseMenu = true;
                    this.paused = false;
                    // Now render as PLAYING state with pause menu overlay
                    // Re-render with PLAYING logic (will be handled in PLAYING branch next frame)
                    // For this frame, render game world with pause menu
                    if (typeof renderRoomBackground !== 'undefined') {
                        renderRoomBackground(this.ctx, this.roomNumber);
                    } else {
                        Renderer.clear(this.ctx, this.config.width, this.config.height);
                    }
                    this.renderGameWorld(this.ctx);
                    if (typeof renderPauseMenu !== 'undefined') {
                        renderPauseMenu(this.ctx);
                    }
                    return; // Exit early, state conversion done
                } else {
                    // Unknown paused state, default to nexus
                    this.state = 'NEXUS';
                    this.showPauseMenu = true;
                    this.paused = false;
                    if (typeof renderNexus !== 'undefined') {
                        renderNexus(this.ctx);
                    }
                    if (typeof renderPauseMenu !== 'undefined') {
                        renderPauseMenu(this.ctx);
                    }
                }
            } else {
                // Single player pause behavior
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
            }
        } else {
            // PLAYING state - render game world normally
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
            
            // Draw remote players (multiplayer)
            if (this.remotePlayers && this.remotePlayers.length > 0) {
                this.renderRemotePlayers(this.ctx);
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
            
            // In multiplayer, show pause menu overlay if showPauseMenu is true
            if (inMultiplayer && this.showPauseMenu) {
                // Draw pause menu overlay on top of everything
                if (typeof renderPauseMenu !== 'undefined') {
                    renderPauseMenu(this.ctx);
                }
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
        
        // Draw remote players (multiplayer)
        if (this.remotePlayers && this.remotePlayers.length > 0) {
            this.renderRemotePlayers(ctx);
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
        // Check if multiplayer is enabled
        const inMultiplayer = this.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.lobbyCode;
        
        if (inMultiplayer) {
            // Multiplayer: Only show/hide pause menu, don't actually pause the game
            // First, convert any PAUSED state to proper multiplayer pause state
            if (this.state === 'PAUSED') {
                // Convert single-player pause state to multiplayer pause menu
                if (this.pausedFromState === 'NEXUS') {
                    this.state = 'NEXUS';
                    this.showPauseMenu = true;
                    this.paused = false;
                    console.log('Converted single-player nexus pause to multiplayer pause menu');
                } else if (this.pausedFromState === 'PLAYING') {
                    this.state = 'PLAYING';
                    this.showPauseMenu = true;
                    this.paused = false;
                    console.log('Converted single-player game pause to multiplayer pause menu');
                }
                return;
            }
            
            // Normal multiplayer pause menu toggle
            if (this.showPauseMenu) {
                this.showPauseMenu = false;
                console.log('[TOGGLE PAUSE] Multiplayer pause menu closed');
            } else {
                this.showPauseMenu = true;
                this.pausedFromState = this.state; // Remember where we paused from
                console.log('[TOGGLE PAUSE] Multiplayer pause menu opened - pausedFromState set to:', this.state);
            }
        } else {
            // Single player: Normal pause behavior
            if (this.state === 'PLAYING') {
                this.state = 'PAUSED';
                this.paused = true;
                this.pausedFromState = 'PLAYING'; // Remember where we paused from
                console.log('[TOGGLE PAUSE] Game paused - pausedFromState set to: PLAYING');
            } else if (this.state === 'NEXUS') {
                this.state = 'PAUSED';
                this.paused = true;
                this.pausedFromState = 'NEXUS'; // Remember where we paused from
                console.log('[TOGGLE PAUSE] Nexus paused - pausedFromState set to: NEXUS');
            } else if (this.state === 'PAUSED') {
                // Resume to the state we paused from
                this.state = this.pausedFromState || 'PLAYING';
                this.paused = false;
                this.pausedFromState = null;
                console.log('[TOGGLE PAUSE] Game resumed - pausedFromState cleared');
            }
        }
    },
    
    // Return to nexus after death
    returnToNexus() {
        // Multiplayer: Host calculates and distributes currency rewards
        if (this.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.isHost) {
            // Calculate currency for all players who died
            const localPlayerId = this.getLocalPlayerId();
            
            // Calculate and sync currency for local player
            if (this.player && this.player.dead && this.currencyEarned > 0) {
                const currentCurrency = this.playerCurrencies.get(localPlayerId) || 0;
                const newCurrency = Math.floor(currentCurrency + this.currencyEarned);
                this.playerCurrencies.set(localPlayerId, newCurrency);
                
                // Update local SaveSystem
                if (typeof SaveSystem !== 'undefined') {
                    SaveSystem.setCurrency(newCurrency);
                    this.currentCurrency = newCurrency;
                }
                
                // Send currency update to self via server (for consistency)
                if (multiplayerManager.send) {
                    multiplayerManager.send({
                        type: 'currency_update',
                        data: {
                            targetPlayerId: localPlayerId,
                            newCurrency: newCurrency,
                            reason: 'round_reward'
                        }
                    });
                }
                
                this.currencyEarned = 0;
            }
            
            // Calculate and sync currency for remote players who died
            if (this.deadPlayers && this.deadPlayers.size > 0) {
                this.deadPlayers.forEach(playerId => {
                    if (playerId !== localPlayerId) {
                        const currencyEarned = this.calculateCurrencyForPlayer(playerId);
                        const currentCurrency = this.playerCurrencies.get(playerId) || 0;
                        const newCurrency = Math.floor(currentCurrency + currencyEarned);
                        this.playerCurrencies.set(playerId, newCurrency);
                        
                        // Send currency update via server (server will route to player)
                        if (multiplayerManager.send) {
                            multiplayerManager.send({
                                type: 'currency_update',
                                data: {
                                    targetPlayerId: playerId,
                                    newCurrency: newCurrency,
                                    reason: 'round_reward'
                                }
                            });
                        }
                        
                        // Update player data in lobby
                        const player = multiplayerManager.players.find(p => p.id === playerId);
                        if (player) {
                            player.currency = newCurrency;
                        }
                    }
                });
            }
            
            // Send return to nexus message to all clients
            multiplayerManager.send({
                type: 'return_to_nexus',
                data: { timestamp: Date.now() }
            });
        } else {
            // Single-player: Calculate and save currency earned
            if (this.player && this.player.dead && this.currencyEarned > 0) {
                if (typeof SaveSystem !== 'undefined') {
                    SaveSystem.addCurrency(this.currencyEarned);
                    const saveData = SaveSystem.load();
                    this.currentCurrency = Math.floor(saveData.currency || 0);
                }
                this.currencyEarned = 0;
            }
        }
        
        // Reset game state
        this.state = 'NEXUS';
        this.enemies = [];
        this.projectiles = [];

        // Reset pause state completely
        this.paused = false;
        this.showPauseMenu = false;
        this.pausedFromState = null;
        
        // Reset multiplayer menu visibility (ensure clean state)
        if (typeof multiplayerMenuVisible !== 'undefined') {
            multiplayerMenuVisible = false;
        }

        // Reset multiplayer state if not in a lobby
        const inLobby = typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.lobbyCode;
        if (!inLobby) {
            this.multiplayerEnabled = false;
        }

        // Reset player but keep it for nexus navigation
        if (this.player) {
            this.player.dead = false;
            this.player.alive = true;
            // Position will be set by initNexus
        }
        
        // Reset game tracking variables
        this.enemiesKilled = 0;
        this.roomNumber = 1;
        this.currencyEarned = 0;
        this.lastGKeyState = false;
        this.clickHandled = false;
        
        // Clear ground loot
        if (typeof groundLoot !== 'undefined') {
            groundLoot.length = 0;
        }
        
        // Initialize nexus if needed
        if (typeof initNexus !== 'undefined') {
            initNexus();
        }
        
        console.log('[RETURN TO NEXUS] State reset complete:', {
            state: this.state,
            paused: this.paused,
            showPauseMenu: this.showPauseMenu,
            pausedFromState: this.pausedFromState,
            multiplayerMenuVisible: typeof multiplayerMenuVisible !== 'undefined' ? multiplayerMenuVisible : 'undefined',
            multiplayerEnabled: this.multiplayerEnabled,
            lastGKeyState: this.lastGKeyState
        });
        
        // Multiplayer: Send immediate state update after returning to nexus
        if (this.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager) {
            setTimeout(() => {
                if (multiplayerManager.isHost) {
                    multiplayerManager.sendGameState();
                } else {
                    multiplayerManager.sendPlayerState();
                }
            }, 100);
        }
    },
    
    // Calculate currency earned from run (for local player)
    calculateCurrency() {
        if (!this.player) return 0;
        
        const roomsCleared = Math.max(0, this.roomNumber - 1);
        const enemiesKilled = this.enemiesKilled || 0;
        const levelReached = this.player.level || 1;
        
        const base = 9 * roomsCleared; // Reduced from 10
        const bonus = 1.8 * enemiesKilled; // Reduced from 2
        const levelBonus = 0.9 * levelReached; // Reduced from 1
        
        return Math.floor(base + bonus + levelBonus);
    },
    
    // Calculate currency for a specific player (multiplayer)
    calculateCurrencyForPlayer(playerId) {
        const roomsCleared = Math.max(0, this.roomNumber - 1);
        const enemiesKilled = this.enemiesKilled || 0;
        
        // Get player level from stats or instance
        let levelReached = 1;
        if (playerId === this.getLocalPlayerId()) {
            levelReached = this.player ? this.player.level || 1 : 1;
        } else if (this.remotePlayerInstances && this.remotePlayerInstances.has(playerId)) {
            const remotePlayer = this.remotePlayerInstances.get(playerId);
            levelReached = remotePlayer.level || 1;
        }
        
        const base = 9 * roomsCleared;
        const bonus = 1.8 * enemiesKilled;
        const levelBonus = 0.9 * levelReached;
        
        return Math.floor(base + bonus + levelBonus);
    },
    
    // Start game after class selection
    startGame() {
        if (!this.selectedClass) {
            console.error('No class selected');
            return;
        }
        
        console.log('[GAME START] ========================================');
        console.log('[GAME START] Called with class:', this.selectedClass);
        console.log('[GAME START] Current state:', this.state, 'pausedFrom:', this.pausedFromState);
        console.log('[GAME START] Stack trace:', new Error().stack);
        console.log('[GAME START] ========================================');
        
        // Create player with selected class (start at left side of screen)
        this.player = createPlayer(this.selectedClass, 100, this.config.height / 2);
        
        // Initialize room system
        if (typeof initializeRoom !== 'undefined') {
            initializeRoom(1);
        }
        
        // Spawn enemies
        this.spawnEnemies();
        
        // Switch to playing state
        this.state = 'PLAYING';
        this.showPauseMenu = false;
        
        // Reset tracking
        this.enemiesKilled = 0;
        this.roomNumber = 1;
        this.doorPulse = 0;
        this.startTime = Date.now();
        
        // Initialize per-player stats tracking
        this.initializePlayerStats();
        
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
        
        // Multiplayer: Send immediate state update after starting game
        if (this.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager) {
            setTimeout(() => {
                if (multiplayerManager.isHost) {
                    multiplayerManager.sendGameState();
                } else {
                    multiplayerManager.sendPlayerState();
                }
            }, 100);
        }
    },
    
    // Restart game
    restart() {
        // Create new player with same class (start at left side of screen)
        this.player = createPlayer(this.selectedClass, 100, this.config.height / 2);
        
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
        
        // Initialize per-player stats tracking
        this.initializePlayerStats();
        
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
        this.showPauseMenu = false;
        this.paused = false;
        this.showPauseMenu = false;
        this.lastGKeyState = false;
        this.clickHandled = false;
        
        console.log('Game restarted with class:', this.selectedClass);
    },
    
    // Spawn enemies at random positions (legacy function, now uses room system)
    spawnEnemies() {
        // Only host generates enemies in multiplayer (clients receive via game_state)
        if (this.multiplayerEnabled && !this.isHost()) {
            // Client: Don't generate enemies - wait for host's enemy data
            this.enemies = [];
            console.log(`[Client] Waiting for enemies from host...`);
            return;
        }
        
        // Host or solo: Initialize first room if not already done
        if (typeof initializeRoom !== 'undefined' && (!currentRoom || currentRoom.number === 1)) {
            currentRoom = generateRoom(1);
            this.enemies = currentRoom.enemies;
            
            // Assign initial targets for aggro system (host only, multiplayer only)
            if (this.isHost()) {
                this.enemies.forEach(enemy => {
                    if (enemy.assignInitialTarget) {
                        enemy.assignInitialTarget();
                    }
                });
            }
            
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
        const isMultiplayerClient = this.multiplayerEnabled && 
                                     typeof multiplayerManager !== 'undefined' && 
                                     multiplayerManager && 
                                     !multiplayerManager.isHost;
        
        this.projectiles = this.projectiles.filter(projectile => {
            // For multiplayer clients, use velocity with position correction
            if (isMultiplayerClient && projectile.targetX !== undefined && projectile.targetY !== undefined) {
                // Primary movement: velocity-based (smooth)
                projectile.x += projectile.vx * deltaTime;
                projectile.y += projectile.vy * deltaTime;
                
                // Secondary: gentle correction toward authoritative position
                const dx = projectile.targetX - projectile.x;
                const dy = projectile.targetY - projectile.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                // If very far, snap (correction or new projectile)
                if (distance > MultiplayerConfig.SNAP_DISTANCE) {
                    projectile.x = projectile.targetX;
                    projectile.y = projectile.targetY;
                } else if (distance > 5) {
                    // Gentle correction when moderately off
                    const correctionSpeed = MultiplayerConfig.BASE_LERP_SPEED * 0.3; // Slow correction
                    const t = Math.min(1, deltaTime * correctionSpeed);
                    projectile.x += dx * t;
                    projectile.y += dy * t;
                }
            } else {
                // Host or solo: normal velocity-based movement
                projectile.x += projectile.vx * deltaTime;
                projectile.y += projectile.vy * deltaTime;
            }
            
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
            // ONLY HOST checks player projectile collisions (thin client architecture)
            if ((projectile.type === 'knife' || projectile.type === 'magic') && 
                (this.isHost() || !this.multiplayerEnabled)) {
                let hitEnemy = false;
                
                // Get projectile owner ID and shooter player ONCE (outside enemy loop)
                let projectileOwnerId = null;
                if (projectile.playerId) {
                    projectileOwnerId = projectile.playerId;
                } else {
                    projectileOwnerId = this.getLocalPlayerId ? this.getLocalPlayerId() : null;
                }
                
                let shooterPlayer = null;
                if (projectileOwnerId === (this.getLocalPlayerId ? this.getLocalPlayerId() : 'local')) {
                    shooterPlayer = this.player;
                } else if (this.remotePlayerInstances && this.remotePlayerInstances.has(projectileOwnerId)) {
                    shooterPlayer = this.remotePlayerInstances.get(projectileOwnerId);
                }
                
                this.enemies.forEach(enemy => {
                    if (!enemy.alive) return;
                    
                    // Skip if this projectile already hit this enemy (for pierce)
                    if (projectile.hitEnemies && projectile.hitEnemies.has(enemy)) {
                        return;
                    }
                    
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
                        
                        // Apply crit multiplier if applicable (shooterPlayer already defined above)
                        let isCrit = false;
                        if (shooterPlayer && shooterPlayer.critChance && Math.random() < shooterPlayer.critChance) {
                            const critMultiplier = 2.0 * (shooterPlayer.critDamageMultiplier || 1.0);
                            finalDamage *= critMultiplier;
                            isCrit = true;
                        }
                        
                        // Calculate damage dealt BEFORE applying damage (so enemy.hp is still valid)
                        const damageDealt = Math.min(finalDamage, enemy.hp);
                        
                        // HOST ONLY: Apply damage (clients don't run this code path)
                        enemy.takeDamage(finalDamage, projectileOwnerId);
                        if (this.getPlayerStats && projectileOwnerId) {
                            const stats = this.getPlayerStats(projectileOwnerId);
                            if (stats) {
                                stats.addStat('damageDealt', damageDealt);
                            }
                        }
                        
                        // Damage numbers for player projectiles (rogue knives, mage bolts)
                        if (typeof createDamageNumber !== 'undefined') {
                            createDamageNumber(enemy.x, enemy.y, Math.floor(damageDealt), isCrit, false);
                        }
                        
                        // Track pierce hits
                        if (!projectile.hitEnemies) {
                            projectile.hitEnemies = new Set();
                        }
                        projectile.hitEnemies.add(enemy);
                        
                        hitEnemy = true;
                    }
                });
                
                // Pierce mechanics: Remove projectile only if pierce limit reached
                if (hitEnemy) {
                    // Get pierce count from shooter
                    let pierceCount = 0;
                    if (shooterPlayer && shooterPlayer.pierceCount) {
                        pierceCount = shooterPlayer.pierceCount;
                    }
                    
                    // Check if projectile has pierced too many enemies
                    const enemiesPierced = projectile.hitEnemies ? projectile.hitEnemies.size : 0;
                    if (enemiesPierced > pierceCount) {
                        // Pierce limit reached, remove projectile
                        projectilesToRemove.push(index);
                    } else {
                        // Still has pierce charges, reduce damage for next hit
                        // 25% damage reduction per pierce
                        const damageReduction = 0.25 * enemiesPierced;
                        projectile.damage = projectile.damage * (1 - damageReduction);
                    }
                }
            } else {
                // Enemy projectiles - check all players (host only) or just local player (client/solo)
                
                // Only host checks remote players
                if (this.isHost() || !this.multiplayerEnabled) {
                    // Get all players to check
                    const playersToCheck = [];
                    
                    // Add local player
                    if (this.player && this.player.alive) {
                        playersToCheck.push({
                            id: this.getLocalPlayerId ? this.getLocalPlayerId() : 'local',
                            player: this.player,
                            isLocal: true
                        });
                    }
                    
                    // Add remote players (multiplayer only)
                    if (this.remotePlayers) {
                        this.remotePlayers.forEach(rp => {
                            if (rp.hp > 0) {
                                playersToCheck.push({
                                    id: rp.id,
                                    player: rp,
                                    isLocal: false
                                });
                            }
                        });
                    }
                    
                    // Check projectile against each player
                    let projectileHit = false;
                    
                    playersToCheck.forEach(({ id, player: p, isLocal }) => {
                        if (projectileHit) return; // Projectile already hit someone
                        
                        // Check shield blocking (local player only, remote players don't have shield logic)
                        let isBlocked = false;
                        
                        if (isLocal && p.shieldActive) {
                            const shieldStart = p.size + 5;
                            const shieldDepth = 20;
                            const shieldWidth = 60;
                            
                            const toPlayerX = projectile.x - p.x;
                            const toPlayerY = projectile.y - p.y;
                            const toPlayerDist = Math.sqrt(toPlayerX * toPlayerX + toPlayerY * toPlayerY);
                            const toPlayerNormX = toPlayerX / toPlayerDist;
                            const toPlayerNormY = toPlayerY / toPlayerDist;
                            
                            const playerDirX = Math.cos(p.rotation);
                            const playerDirY = Math.sin(p.rotation);
                            
                            const dot = toPlayerNormX * playerDirX + toPlayerNormY * playerDirY;
                            
                            if (dot > 0 && toPlayerDist < shieldStart + shieldDepth) {
                                const perpendicularX = -playerDirY;
                                const perpendicularY = playerDirX;
                                const lateralDist = Math.abs(toPlayerX * perpendicularX + toPlayerY * perpendicularY);
                                
                                if (lateralDist < shieldWidth) {
                                    isBlocked = true;
                                    if (typeof createParticleBurst !== 'undefined') {
                                        createParticleBurst(projectile.x, projectile.y, '#0099ff', 5);
                                    }
                                }
                            }
                        }
                        
                        if (isBlocked) {
                            projectilesToRemove.push(index);
                            projectileHit = true;
                        } else if (checkCircleCollision(
                            projectile.x, projectile.y, projectile.size,
                            p.x, p.y, p.size || 20
                        )) {
                            // Hit player
                            if (isLocal) {
                                // Local player - apply damage directly
                                this.player.takeDamage(projectile.damage);
                            } else {
                                // Remote player - apply damage to host's state tracking
                                const damaged = this.damageRemotePlayer(id, projectile.damage);
                                if (damaged) {
                                    // Only send event if damage was actually applied (not invuln)
                                    this.sendPlayerDamageEvent(id, projectile.damage);
                                }
                            }
                            projectilesToRemove.push(index);
                            projectileHit = true;
                        }
                    });
                } else {
                    // Client in multiplayer - still check local player for visual consistency
                    // (Host will send authoritative damage event)
                    // Just check for blocking
                    let isBlocked = false;
                    
                    if (this.player && this.player.shieldActive) {
                        const shieldStart = this.player.size + 5;
                        const shieldDepth = 20;
                        const shieldWidth = 60;
                        
                        const toPlayerX = projectile.x - this.player.x;
                        const toPlayerY = projectile.y - this.player.y;
                        const toPlayerDist = Math.sqrt(toPlayerX * toPlayerX + toPlayerY * toPlayerY);
                        const toPlayerNormX = toPlayerX / toPlayerDist;
                        const toPlayerNormY = toPlayerY / toPlayerDist;
                        
                        const playerDirX = Math.cos(this.player.rotation);
                        const playerDirY = Math.sin(this.player.rotation);
                        
                        const dot = toPlayerNormX * playerDirX + toPlayerNormY * playerDirY;
                        
                        if (dot > 0 && toPlayerDist < shieldStart + shieldDepth) {
                            const perpendicularX = -playerDirY;
                            const perpendicularY = playerDirX;
                            const lateralDist = Math.abs(toPlayerX * perpendicularX + toPlayerY * perpendicularY);
                            
                            if (lateralDist < shieldWidth) {
                                isBlocked = true;
                                if (typeof createParticleBurst !== 'undefined') {
                                    createParticleBurst(projectile.x, projectile.y, '#0099ff', 5);
                                }
                            }
                        }
                    }
                    
                    // Note: Damage will be sent by host, client just shows visual feedback
                    if (isBlocked) {
                        projectilesToRemove.push(index);
                    }
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
    },
    
    // Render remote players (multiplayer)
    renderRemotePlayers(ctx) {
        if (this.isMultiplayerClient()) {
            // CLIENTS: Render shadow instances (full player render methods)
            if (this.remotePlayerShadowInstances && this.remotePlayerShadowInstances.size > 0) {
                this.remotePlayerShadowInstances.forEach((shadowInstance, playerId) => {
                    if (shadowInstance && !shadowInstance.dead && shadowInstance.alive) {
                        // Use the actual player render method - all animations work automatically!
                        shadowInstance.render(ctx);
                    }
                });
            }
        } else if (this.isHost()) {
            // HOST: Render remote player instances directly
            if (this.remotePlayerInstances && this.remotePlayerInstances.size > 0) {
                this.remotePlayerInstances.forEach((playerInstance, playerId) => {
                    if (playerInstance && !playerInstance.dead && playerInstance.alive) {
                        playerInstance.render(ctx);
                    }
                });
            }
        } else if (!this.multiplayerEnabled) {
            // SOLO: No remote players to render
            return;
        }
    },
    
    // Legacy custom rendering (no longer used, kept for reference)
    renderRemotePlayersOld(ctx) {
        if (!this.remotePlayers || this.remotePlayers.length === 0) return;
        
        this.remotePlayers.forEach(remotePlayer => {
            // Skip rendering dead players
            if (remotePlayer.dead) {
                return;
            }
            
            ctx.save();
            
            // Get class definition for color and shape
            const classDef = CLASS_DEFINITIONS[remotePlayer.class] || CLASS_DEFINITIONS.square;
            const size = 20; // Standard player size
            
            // Draw player shape based on class
            ctx.translate(remotePlayer.x, remotePlayer.y);
            ctx.rotate(remotePlayer.rotation);
            
            // Draw based on shape type
            ctx.fillStyle = classDef.color;
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            
            if (classDef.shape === 'square') {
                ctx.fillRect(-size, -size, size * 2, size * 2);
                ctx.strokeRect(-size, -size, size * 2, size * 2);
            } else if (classDef.shape === 'triangle') {
                ctx.beginPath();
                ctx.moveTo(size, 0);
                ctx.lineTo(-size, -size);
                ctx.lineTo(-size, size);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            } else if (classDef.shape === 'pentagon') {
                Renderer.polygon(ctx, 0, 0, size, 5, 0, classDef.color);
            } else if (classDef.shape === 'hexagon') {
                Renderer.polygon(ctx, 0, 0, size, 6, 0, classDef.color);
            }
            
            ctx.restore();
            
            // Draw class-specific effects
            if (remotePlayer.shieldActive && classDef.shape === 'pentagon') {
                // Draw shield
                const shieldStart = size + 5;
                const shieldDepth = 20;
                const shieldWidth = 60;
                
                ctx.save();
                ctx.translate(remotePlayer.x, remotePlayer.y);
                ctx.rotate(remotePlayer.rotation);
                
                ctx.fillStyle = 'rgba(0, 153, 255, 0.3)';
                ctx.strokeStyle = 'rgba(0, 153, 255, 0.8)';
                ctx.lineWidth = 3;
                
                ctx.beginPath();
                ctx.moveTo(shieldStart, -shieldWidth);
                ctx.lineTo(shieldStart + shieldDepth, -shieldWidth);
                ctx.lineTo(shieldStart + shieldDepth, shieldWidth);
                ctx.lineTo(shieldStart, shieldWidth);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                
                ctx.restore();
            }
            
            if (remotePlayer.whirlwindActive && classDef.shape === 'square') {
                // Draw whirlwind effect
                ctx.save();
                const radius = 60;
                const gradient = ctx.createRadialGradient(remotePlayer.x, remotePlayer.y, 0, remotePlayer.x, remotePlayer.y, radius);
                gradient.addColorStop(0, 'rgba(74, 144, 226, 0.4)');
                gradient.addColorStop(1, 'rgba(74, 144, 226, 0)');
                
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(remotePlayer.x, remotePlayer.y, radius, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
            
            if (remotePlayer.arcaneFocusActive && classDef.shape === 'hexagon') {
                // Draw arcane focus effect
                ctx.save();
                const orbitRadius = 40;
                const orbSize = 6;
                const numOrbs = 3;
                const time = Date.now() / 1000;
                
                for (let i = 0; i < numOrbs; i++) {
                    const angle = (time * 2) + (i * (Math.PI * 2 / numOrbs));
                    const orbX = remotePlayer.x + Math.cos(angle) * orbitRadius;
                    const orbY = remotePlayer.y + Math.sin(angle) * orbitRadius;
                    
                    ctx.fillStyle = '#9c27b0';
                    ctx.beginPath();
                    ctx.arc(orbX, orbY, orbSize, 0, Math.PI * 2);
                    ctx.fill();
                    
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                }
                ctx.restore();
            }
            
            // Draw attack hitboxes if any
            if (remotePlayer.attackHitboxes && remotePlayer.attackHitboxes.length > 0) {
                remotePlayer.attackHitboxes.forEach(hitbox => {
                    ctx.save();
                    // Draw hitbox circle (semi-transparent)
                    ctx.fillStyle = 'rgba(255, 100, 100, 0.2)';
                    ctx.strokeStyle = 'rgba(255, 100, 100, 0.5)';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(hitbox.x, hitbox.y, hitbox.radius, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();
                    ctx.restore();
                });
            }
            
            // Draw shadow clones (Rogue ability)
            if (remotePlayer.shadowClonesActive && remotePlayer.shadowClones) {
                remotePlayer.shadowClones.forEach(clone => {
                    ctx.save();
                    ctx.globalAlpha = 0.5;
                    ctx.translate(clone.x, clone.y);
                    ctx.rotate(clone.rotation);
                    ctx.fillStyle = classDef.color;
                    ctx.beginPath();
                    ctx.moveTo(size, 0);
                    ctx.lineTo(-size, -size);
                    ctx.lineTo(-size, size);
                    ctx.closePath();
                    ctx.fill();
                    ctx.restore();
                });
            }
            
            // Draw blink decoy (Mage ability)
            if (remotePlayer.blinkDecoyActive) {
                ctx.save();
                ctx.globalAlpha = 0.6;
                ctx.translate(remotePlayer.blinkDecoyX, remotePlayer.blinkDecoyY);
                Renderer.polygon(ctx, 0, 0, size, 6, 0, classDef.color);
                ctx.restore();
            }
            
            // Draw health bar above player
            const barWidth = 40;
            const barHeight = 5;
            const barX = remotePlayer.x - barWidth / 2;
            const barY = remotePlayer.y - size - 15;
            
            // Background
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(barX, barY, barWidth, barHeight);
            
            // Health
            const healthPercent = remotePlayer.hp / remotePlayer.maxHp;
            ctx.fillStyle = healthPercent > 0.5 ? '#00ff00' : (healthPercent > 0.25 ? '#ffaa00' : '#ff0000');
            ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);
            
            // Border
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.strokeRect(barX, barY, barWidth, barHeight);
            
            // Player name tag (optional - could add later)
            // ctx.fillStyle = '#ffffff';
            // ctx.font = '12px Arial';
            // ctx.textAlign = 'center';
            // ctx.fillText(remotePlayer.name || 'Player', remotePlayer.x, barY - 5);
        });
    }
};

// Start the game when page loads
window.addEventListener('load', () => {
    Game.init();
});

