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
        this.lastAliveTimestamp = null; // When player last became alive (null = timer not started)
        this.isAlive = true;
        this.timerStarted = false; // Whether the timer has been started (game must start first)
        this.timerStopped = false; // Whether the timer is frozen (game ended)
    }

    // Start the timer - called when game actually begins
    startTimer() {
        if (!this.timerStarted && !this.timerStopped) {
            this.lastAliveTimestamp = Date.now();
            this.timerStarted = true;
            this.isAlive = true;
        }
    }

    // Stop the timer - freeze the value (game ended)
    stopTimer() {
        if (this.timerStarted && !this.timerStopped) {
            // Accumulate any remaining time before stopping
            if (this.isAlive && this.lastAliveTimestamp) {
                this.timeAlive += (Date.now() - this.lastAliveTimestamp) / 1000;
            }
            this.timerStopped = true;
            this.lastAliveTimestamp = null;
        }
    }

    // Called when player dies - accumulate time from this life
    onDeath() {
        if (this.isAlive && this.timerStarted && !this.timerStopped) {
            this.timeAlive += (Date.now() - this.lastAliveTimestamp) / 1000;
            this.isAlive = false;
            this.lastAliveTimestamp = null;
        }
    }

    // Called when player revives - start new life timer
    onRevive() {
        if (!this.isAlive && this.timerStarted && !this.timerStopped) {
            this.lastAliveTimestamp = Date.now();
            this.isAlive = true;
        }
    }

    // Get total time alive (includes current life if still alive, but frozen if timer stopped)
    getTimeAlive() {
        // If timer is stopped, return frozen value
        if (this.timerStopped) {
            return this.timeAlive;
        }
        // If timer hasn't started yet, return 0
        if (!this.timerStarted) {
            return 0;
        }
        // If alive and timer is running, calculate current time
        if (this.isAlive && this.lastAliveTimestamp) {
            return this.timeAlive + (Date.now() - this.lastAliveTimestamp) / 1000;
        }
        // Otherwise return accumulated time
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
        this.lastAliveTimestamp = null;
        this.isAlive = true;
        this.timerStarted = false;
        this.timerStopped = false;
    }
}

const Game = {
    // Version tracking (from version.js)
    get VERSION() {
        return typeof GameVersion !== 'undefined' ? GameVersion.VERSION : '1.0.0';
    },

    // Debug flags
    enemyStealthMode: false, // Toggle enemy glow and vignette lights
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
    gameOverMusicPlaying: false,

    // Fixed timestep variables
    accumulator: 0, // Accumulated real time for fixed timestep updates
    fixedTimestep: 1 / 60, // 60 Hz fixed timestep (0.016666... seconds)
    maxCatchupUpdates: 5, // Maximum fixed updates per frame to prevent stuttering

    // Modal states
    launchModalVisible: false,
    updateModalVisible: false,
    privacyModalVisible: false,
    privacyModalContext: 'onboarding', // 'onboarding' | 'pause'
    privacyModalReturnToPause: false,
    privacyModalPreviousShowPauseMenu: false,

    // Class selection
    selectedClass: null,
    mouse: { x: 0, y: 0 },
    clickHandled: false,

    // Game mode: 'cards' (default) or 'gear'
    gameMode: 'cards',

    // Currency system
    currentCurrency: 0,
    currencyEarned: 0, // Currency (credits) earned from current run (elites/bosses only)
    shardsEarned: 0, // Shards earned from current run

    // Game config
    config: {
        width: 1280,
        height: 720,
        targetFPS: 60,
        fpsInterval: 1000 / 60
    },

    // Camera system for following player in larger room (and nexus)
    camera: {
        x: 640,          // Camera world position X (center of viewport)
        y: 360,          // Camera world position Y (center of viewport)
        targetX: 640,    // Desired camera X (where camera wants to be)
        targetY: 360,    // Desired camera Y (where camera wants to be)
        offsetX: 0,      // Movement-based offset X
        offsetY: 0,      // Movement-based offset Y
        smoothSpeed: 5,  // Lerp speed (higher = faster following)
        offsetAmount: 60, // Max offset from center based on movement
        deadzone: 20     // Minimum movement before applying offset
    },

    // Nexus-specific camera (separate from combat camera)
    nexusCamera: {
        x: 900,
        y: 550,
        targetX: 900,
        targetY: 550,
        smoothSpeed: 3   // Slower for nexus (less combat, more relaxed)
    },

    // Game objects
    player: null,
    enemies: [],
    projectiles: [],
    previousProjectiles: [], // Previous projectile state for interpolation (clients)
    particles: [],
    damageNumbers: [],
    explosions: [], // Visual explosions from enemy deaths (Volatile Spawn modifier)
    remotePlayers: [], // Multiplayer: other players in the lobby

    // Stats tracking (legacy - kept for compatibility)
    enemiesKilled: 0,
    elitesKilled: 0, // Track elite enemies killed
    bossesKilled: 0, // Track bosses killed
    roomNumber: 1,
    doorPulse: 0, // For door animation

    // Per-player stats tracking (new system)
    playerStats: new Map(), // Map<playerId, PlayerStats>
    deadPlayers: new Set(), // Set of dead player IDs
    allPlayersDead: false, // Flag for when all players are dead
    spectateMode: false, // Local player is spectating after death
    spectatedPlayerId: null, // ID of player being spectated (when dead in multiplayer)
    lastRoomClearReviveRoomNumber: null, // Track last room number where clear revive triggered

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
    screenShakeDirection: null, // 'player' for vertical bias, 'boss' for horizontal bias, null for omnidirectional
    hitPauseTime: 0, // For brief freezes on big hits

    // Background pause flags
    backgroundPauseActive: false,
    autoPausedForBackground: false,
    isMobileDevice: false,

    // Level up message
    levelUpMessageActive: false,
    levelUpMessageTime: 0,

    // Boss intro system
    bossIntroActive: false,
    bossIntroData: null, // { boss, name, duration, elapsedTime, skipAvailable }
    bossIntroCameraPan: false, // Smooth pan from boss to player after intro
    bossIntroPanProgress: 0, // 0 to 1
    bossIntroPanDuration: 1.0, // 1 second pan
    bossIntroPanStartX: 0,
    bossIntroPanStartY: 0,

    // Camera zoom
    baseZoom: 1.1, // Desktop zoom level (10% closer)
    bossIntroZoom: 1.3, // Extra zoom during boss intro (30% closer total)

    // FPS tracking
    fps: 0,
    lastFpsUpdate: 0,
    frameCount: 0,

    // Input state tracking
    lastGKeyState: false,
    lastRKeyState: false,
    lastMKeyState: false,
    lastLeftArrowState: false,
    lastRightArrowState: false,

    // Multiplayer state
    multiplayerModuleLoaded: false,
    multiplayerEnabled: false,
    waitingForHostReturn: false, // Client flag: waiting for host to signal return to nexus
    finalStats: null, // Final stats from host when all players die (clients only)

    // Privacy / telemetry settings
    telemetryOptIn: null,

    // Time tracking for death screen
    startTime: 0,
    endTime: 0,
    deathScreenStartTime: 0,

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

        // Prevent text selection and right-click context menu on canvas
        this.canvas.style.userSelect = 'none';
        this.canvas.style.webkitUserSelect = 'none';
        this.canvas.style.mozUserSelect = 'none';
        this.canvas.style.msUserSelect = 'none';

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
            this.telemetryOptIn = SaveSystem.getTelemetryOptIn ? SaveSystem.getTelemetryOptIn() : null;

            // Run card system migration and auto-unlock cards on load
            if (typeof runCardSystemMigration === 'function') {
                runCardSystemMigration(SaveSystem);
            }
            // Auto-unlock any cards that meet conditions (including starter cards)
            if (typeof window.checkAchievementUnlocks === 'function') {
                window.checkAchievementUnlocks();
            }

            // Privacy modal disabled by dev - telemetry system is disabled
            // const hasAcknowledgedPrivacy = SaveSystem.hasAcknowledgedPrivacy ? SaveSystem.hasAcknowledgedPrivacy() : true;
            // if (!hasAcknowledgedPrivacy) {
            //     this.openPrivacyModal('onboarding');
            // } else {
            //     // Check if launch modal should show (first time ever)
            //     if (!SaveSystem.getHasSeenLaunchModal()) {
            //         this.launchModalVisible = true;
            //     }
            // }

            // Check if launch modal should show (first time ever)
            if (!SaveSystem.getHasSeenLaunchModal()) {
                this.launchModalVisible = true;
            }

            // Check if update modal should show (version changed)
            if (SaveSystem.shouldShowUpdateModal()) {
                this.updateModalVisible = true;
            }
        } else {
            this.telemetryOptIn = null;
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


        // Handle pause toggle with ESC
        document.addEventListener('keydown', (e) => {
            // Don't intercept keys if user is typing in an input field
            const target = e.target;
            if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
                return;
            }

            // Handle boss intro skip
            if (this.bossIntroActive && this.bossIntroData && this.bossIntroData.skipAvailable) {
                this.skipBossIntro();
                return;
            }

            if (e.key === 'Escape') {
                // Prevent pausing when awaiting card swap
                if (this.awaitingHandSwap && this.pendingSwapCard) {
                    console.log('[ESC KEY] Blocked - awaiting card swap');
                    e.preventDefault();
                    return;
                }

                // Close multiplayer menu first if visible (before other handlers)
                // Check window.multiplayerMenuVisible first (set by multiplayer menu component)
                if (typeof window !== 'undefined' && window.multiplayerMenuVisible) {
                    // Let the multiplayer menu component handle closing itself
                    // Don't interfere here - the component's handler will close it
                    // Just return early to prevent other handlers from running
                    return;
                }

                // Close character sheet first if open
                if (typeof CharacterSheet !== 'undefined' && CharacterSheet.isOpen) {
                    CharacterSheet.isOpen = false;
                    return;
                }

                // Close audio settings menu first if visible
                if (typeof audioMenuVisible !== 'undefined' && audioMenuVisible) {
                    audioMenuVisible = false;
                    if (typeof activeAudioSliderKey !== 'undefined') {
                        activeAudioSliderKey = null;
                    }
                    if (typeof activeAudioSliderPointerId !== 'undefined') {
                        activeAudioSliderPointerId = null;
                    }
                    if (typeof AudioManager !== 'undefined') {
                        AudioManager.saveSettings();
                    }

                    if (typeof this.showPauseMenu !== 'undefined') {
                        this.showPauseMenu = true;
                    }
                    return;
                }

                // Close Nexus modals first if visible (in NEXUS state)
                if (this.state === 'NEXUS') {
                    // Close room modifier selection modal
                    if (this.showingRoomModifierSelection) {
                        this.showingRoomModifierSelection = false;
                        e.preventDefault();
                        return;
                    }

                    // Close deck builder modal - check if visible by looking for the modal element
                    const deckBuilderLayer = document.querySelector('.ui-layer--modal[aria-label="Deck Builder"]');
                    if (deckBuilderLayer && deckBuilderLayer.style.display !== 'none' && deckBuilderLayer.style.display !== '') {
                        if (typeof window !== 'undefined' && typeof window.toggleDeckBuilder === 'function') {
                            window.toggleDeckBuilder(false); // Close it
                            e.preventDefault();
                            return;
                        }
                    }

                    // Close mastery system modal - check if visible by looking for the modal element
                    const masteryLayer = document.querySelector('.ui-layer--modal[aria-label="Card Mastery"]');
                    if (masteryLayer && masteryLayer.style.display !== 'none' && masteryLayer.style.display !== '') {
                        if (typeof window !== 'undefined' && typeof window.toggleMasterySystem === 'function') {
                            window.toggleMasterySystem(false); // Close it
                            e.preventDefault();
                            return;
                        }
                    }

                    // Close door modifier selection modal (used during gameplay, but check anyway)
                    if (this.showingDoorModifierSelection) {
                        this.showingDoorModifierSelection = false;
                        e.preventDefault();
                        return;
                    }
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
                    // Check for 3-second input delay
                    const timeSinceDeath = (Date.now() - (this.deathScreenStartTime || Date.now())) / 1000;
                    if (timeSinceDeath >= 3.0) {
                        this.restart();
                    }
                }
            }
            if (e.key === 'm' || e.key === 'M') {
                if (this.player && this.player.dead && (!this.multiplayerEnabled || this.allPlayersDead)) {
                    // In multiplayer, only host can return to nexus (clients wait for signal)
                    const isHost = this.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.isHost;
                    const isClient = this.multiplayerEnabled && this.isMultiplayerClient();
                    if (!this.multiplayerEnabled || isHost || (isClient && !this.waitingForHostReturn)) {
                        // Check for 3-second input delay
                        const timeSinceDeath = (Date.now() - (this.deathScreenStartTime || Date.now())) / 1000;
                        if (timeSinceDeath >= 3.0) {
                            this.returnToNexus();
                        }
                    }
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
        this.updateMusicForCurrentRoom();
        this.start();
    },

    // Setup responsive canvas sizing - dynamic viewport to match screen
    setupResponsiveCanvas() {
        if (!this.canvas) return;

        // Use actual available viewport - must account for browser chrome on mobile
        let availableWidth, availableHeight;

        // Detect mobile device FIRST (before using it in viewport calculation)
        const isMobileDevice = typeof Input !== 'undefined' && Input.isMobileDevice && Input.isMobileDevice();
        this.isMobileDevice = isMobileDevice;

        // Check if we're in fullscreen mode
        const isFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement ||
            document.mozFullScreenElement || document.msFullscreenElement);

        // MOBILE CHROME FIX: Use visualViewport as primary source (most accurate)
        // Fallback chain for maximum compatibility
        // On mobile, prefer window.innerWidth/Height to get full screen size
        if (isFullscreen) {
            // Fullscreen: use window dimensions
            availableWidth = window.innerWidth;
            availableHeight = window.innerHeight;
        } else if (window.visualViewport && !isMobileDevice) {
            // Desktop with visualViewport: use it for accuracy
            availableWidth = window.visualViewport.width;
            availableHeight = window.visualViewport.height;
        } else {
            // Mobile or fallback: use window dimensions to fill screen
            availableWidth = window.innerWidth;
            availableHeight = window.innerHeight;
        }

        let canvasWidth = Math.floor(availableWidth);
        let canvasHeight = Math.floor(availableHeight);

        // Desktop: enforce minimum size for playability
        const minWidth = 800;
        const minHeight = 600;
        if (!isMobileDevice && (canvasWidth < minWidth || canvasHeight < minHeight)) {
            canvasWidth = Math.max(canvasWidth, minWidth);
            canvasHeight = Math.max(canvasHeight, minHeight);
        }

        // Calculate aspect ratio early (used for clamping, zoom calculation, and logging)
        let aspectRatio = canvasWidth / canvasHeight;

        // On mobile, use exact viewport dimensions (no aspect ratio clamping)
        // On desktop, clamp aspect ratio to reasonable range
        if (!isMobileDevice) {
            const minAspect = 0.428; // 9:21 portrait
            const maxAspect = 2.333; // 21:9 landscape

            if (aspectRatio < minAspect) {
                // Too tall - clamp height
                canvasHeight = canvasWidth / minAspect;
                aspectRatio = canvasWidth / canvasHeight; // Recalculate
            } else if (aspectRatio > maxAspect) {
                // Too wide - clamp width
                canvasWidth = canvasHeight * maxAspect;
                aspectRatio = canvasWidth / canvasHeight; // Recalculate
            }
        }

        // Round to whole pixels
        canvasWidth = Math.floor(canvasWidth);
        canvasHeight = Math.floor(canvasHeight);
        
        // Recalculate aspect ratio after rounding
        aspectRatio = canvasWidth / canvasHeight;

        // Calculate mobile zoom based on aspect ratio (zoom out for 21:9 landscape)
        if (isMobileDevice) {
            // For 21:9 landscape (aspect ratio > 2.0), zoom out to show more vertical space
            if (aspectRatio > 2.0) {
                // Zoom out more for wider aspect ratios
                // 21:9 (2.33) -> 0.85, wider -> more zoom out
                const zoomFactor = Math.max(0.85, 1.0 - (aspectRatio - 2.0) * 0.15);
                this.mobileZoom = zoomFactor;
            } else {
                // For other mobile aspect ratios, use 1.0 (no zoom)
                this.mobileZoom = 1.0;
            }
        } else {
            this.mobileZoom = 1.0; // Not used on desktop, but set for consistency
        }

        // High DPI Support (Fix Aliasing)
        // Force minimum 2.0 DPR for supersampling (General AA)
        const minPixelRatio = 2.0;
        const dpr = Math.max(window.devicePixelRatio || 1, minPixelRatio);
        this.dpr = dpr; // Store for use in other rendering methods

        // Set canvas resolution (internal rendering size) scaled by DPR
        this.canvas.width = canvasWidth * dpr;
        this.canvas.height = canvasHeight * dpr;

        // Set CSS size to match logical canvas size exactly (1:1, no stretching)
        // This ensures canvas fills viewport without distortion
        this.canvas.style.width = canvasWidth + 'px';
        this.canvas.style.height = canvasHeight + 'px';
        this.canvas.style.maxWidth = '100vw';
        this.canvas.style.maxHeight = '100vh';
        this.canvas.style.position = 'fixed';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.margin = '0';
        this.canvas.style.padding = '0';

        // Scale the context so drawing commands use logical pixels
        this.ctx.scale(dpr, dpr);

        // Enable high-quality image smoothing
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = 'high';

        // Reset margins and ensure no transforms
        this.canvas.style.marginLeft = '0';
        this.canvas.style.marginTop = '0';
        this.canvas.style.transform = 'none';

        // Update game config to match new logical canvas size
        this.config.width = canvasWidth;
        this.config.height = canvasHeight;

        // Initialize touch controls if in touch mode
        if (typeof Input !== 'undefined' && Input.isTouchMode && Input.isTouchMode()) {
            // Small delay to ensure canvas rect is updated
            setTimeout(() => {
                if (Input.initTouchControls) {
                    Input.initTouchControls(this.canvas);
                }
            }, 50);
        }

        // Force a reflow to ensure the canvas is positioned
        void this.canvas.offsetWidth;

        // Get the actual bounding rect after positioning
        const rect = this.canvas.getBoundingClientRect();

        // Store scale (should be 1.0 now since we match screen size)
        this.scale = 1.0;

        // Calculate offset for coordinate conversion based on actual rect position
        this.offsetX = rect.left;
        this.offsetY = rect.top;

        // Store actual game dimensions
        this.actualGameWidth = canvasWidth;
        this.actualGameHeight = canvasHeight;

        this.gameAreaOffsetX = rect.left;
        this.gameAreaOffsetY = rect.top;

        // Store viewport info for multiplayer consistency
        this.viewport = {
            width: canvasWidth,
            height: canvasHeight,
            scale: 1.0,
            offsetX: this.offsetX,
            offsetY: this.offsetY,
            gameWidth: canvasWidth,
            gameHeight: canvasHeight,
            actualRect: {
                width: rect.width,
                height: rect.height,
                left: rect.left,
                top: rect.top
            },
            gameArea: {
                width: canvasWidth,
                height: canvasHeight,
                left: rect.left,
                top: rect.top
            }
        };

        console.log(`Canvas dynamic sizing: ${canvasWidth}x${canvasHeight} (aspect: ${aspectRatio.toFixed(2)})`);
        console.log(`  Available: ${Math.floor(availableWidth)}x${Math.floor(availableHeight)}, Fullscreen: ${isFullscreen}`);
        if (window.visualViewport) {
            console.log(`  VisualViewport: ${window.visualViewport.width}x${window.visualViewport.height}`);
        }
        console.log(`  DocumentElement client: ${document.documentElement.clientWidth}x${document.documentElement.clientHeight}`);
        console.log(`  Window inner: ${window.innerWidth}x${window.innerHeight}`);
    },

    // Convert screen coordinates to game coordinates
    screenToGame(x, y) {
        const rect = this.canvas.getBoundingClientRect();
        
        // Calculate scale factors based on actual canvas display size vs logical size
        // This handles cases where canvas CSS size might differ from logical size
        const scaleX = this.config.width / rect.width;
        const scaleY = this.config.height / rect.height;
        
        // Convert screen coordinates to canvas coordinates, then scale to logical coordinates
        const canvasX = x - rect.left;
        const canvasY = y - rect.top;
        const gameX = canvasX * scaleX;
        const gameY = canvasY * scaleY;

        // Clamp to game bounds to prevent out-of-range coordinates
        const clampedX = Math.max(0, Math.min(this.config.width, gameX));
        const clampedY = Math.max(0, Math.min(this.config.height, gameY));

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
            // Enter fullscreen - use document.documentElement to include DOM UI
            const element = document.documentElement;
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
            this.useSetTimeoutLoop = true;
            console.log('[Game] Switched to setTimeout loop (background)');
        } else {
            this.useSetTimeoutLoop = false;
            console.log('[Game] Switched to RAF loop (foreground)');
        }

        const isMobile = this.isMobileDevice;
        if (isMobile && isHidden) {
            this.backgroundPauseActive = true;
            if (typeof MusicManager !== 'undefined' && MusicManager && typeof MusicManager.pauseForBackground === 'function') {
                MusicManager.pauseForBackground().catch(err => {
                    console.warn('[Music] Failed to pause background playback:', err);
                });
            }
            if (this.state === 'PLAYING' && !this.paused) {
                this.autoPausedForBackground = true;
                this.togglePause();
            }
        }

        if (!isHidden && isMobile) {
            if (typeof MusicManager !== 'undefined' && MusicManager && typeof MusicManager.pauseForBackground === 'function') {
                // No auto resume; just clear flag so manual resume works normally
            }
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
        this.accumulator = 0; // Reset accumulator for fixed timestep
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

        // Handle initial call or restart
        if (!currentTime) {
            currentTime = performance.now();
        }

        // Calculate real time delta (for metrics and accumulation)
        const realDeltaTime = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;

        // Cap real delta time to prevent huge jumps (max 250ms to prevent spiral of death)
        const cappedRealDeltaTime = Math.min(realDeltaTime, 0.25);

        // Accumulate real time for fixed timestep updates
        this.accumulator += cappedRealDeltaTime;

        // Measure CPU process time
        const processStart = performance.now();

        // Handle hit pause (uses fixed timestep for consistency)
        if (this.hitPauseTime > 0) {
            // Process hit pause with fixed timestep
            const maxUpdates = this.maxCatchupUpdates || 5;
            let updatesRun = 0;
            while (this.accumulator >= this.fixedTimestep && this.hitPauseTime > 0 && updatesRun < maxUpdates) {
                this.hitPauseTime -= this.fixedTimestep;
                if (this.hitPauseTime <= 0) {
                    this.hitPauseTime = 0;
                }
                this.accumulator -= this.fixedTimestep;
                updatesRun++;
            }

            // If still in hit pause, skip updates but still render
            if (this.hitPauseTime > 0) {
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

        // FPS tracking (uses real time delta)
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

        // Run fixed timestep updates (catch-up if behind)
        const maxUpdates = this.maxCatchupUpdates || 5;
        let updatesRun = 0;
        while (this.accumulator >= this.fixedTimestep && updatesRun < maxUpdates) {
            if (this.state === 'PLAYING') {
                this.update(this.fixedTimestep);
            } else if (this.state === 'NEXUS') {
                if (typeof updateNexus !== 'undefined') {
                    updateNexus(this.ctx, this.fixedTimestep);
                }
            }
            this.accumulator -= this.fixedTimestep;
            updatesRun++;
        }

        // Note: In multiplayer, showPauseMenu doesn't stop updates - game continues running

        // Render once per frame (variable rate, smooth visuals)
        this.render();

        const processEnd = performance.now();
        const processTime = processEnd - processStart;

        // Update debug panel metrics with actual CPU time and frame time
        if (typeof DebugPanel !== 'undefined') {
            DebugPanel.update(realDeltaTime, processTime);
        }

        // Continue the loop - use setTimeout in background for multiplayer, RAF otherwise
        if (this.useSetTimeoutLoop) {
            this.timeoutId = setTimeout(() => this.gameLoop(performance.now()), 1000 / 60);
        } else {
            requestAnimationFrame((time) => this.gameLoop(time));
        }
    },

    // Trigger screen shake
    triggerScreenShake(intensity, duration, direction = null) {
        this.screenShakeIntensity = intensity;
        this.screenShakeDuration = duration;
        this.screenShakeDirection = direction; // 'player' or 'boss' for directional bias
    },

    // Trigger hit pause
    triggerHitPause(duration = 0.1) {
        this.hitPauseTime = duration;
    },

    // Update screen shake
    updateScreenShake(deltaTime) {
        if (this.screenShakeDuration > 0) {
            this.screenShakeDuration -= deltaTime;

            // Generate random shake offset with directional bias
            let xOffset, yOffset;
            const baseShake = this.screenShakeIntensity * 10;

            if (this.screenShakeDirection === 'player') {
                // Player damage: Almost purely vertical (like being knocked back/staggered upward)
                // Very minimal horizontal movement, strong vertical movement
                xOffset = (Math.random() - 0.5) * baseShake * 0.15; // 15% horizontal - very minimal
                yOffset = (Math.random() - 0.5) * baseShake * 1.2;  // 120% vertical - stronger vertical
            } else if (this.screenShakeDirection === 'boss') {
                // Boss damage: Circular/explosive pattern (like impact radiating outward)
                // Use circular pattern with slight emphasis on horizontal
                const angle = Math.random() * Math.PI * 2;
                const radius = Math.random() * baseShake;
                xOffset = Math.cos(angle) * radius * 1.1;  // Slight horizontal emphasis
                yOffset = Math.sin(angle) * radius * 0.9; // Slight vertical reduction
            } else {
                // Default: Omnidirectional (equal in all directions)
                xOffset = (Math.random() - 0.5) * baseShake;
                yOffset = (Math.random() - 0.5) * baseShake;
            }

            this.screenShakeOffset.x = xOffset;
            this.screenShakeOffset.y = yOffset;

            if (this.screenShakeDuration <= 0) {
                this.screenShakeDuration = 0;
                this.screenShakeOffset.x = 0;
                this.screenShakeOffset.y = 0;
                this.screenShakeDirection = null;
            }
        }
    },

    // Update camera to follow player
    updateCamera(deltaTime) {
        // Only update camera in PLAYING state
        if (this.state !== 'PLAYING' || !this.player) return;

        // Handle boss intro camera override - center on boss
        if (this.bossIntroActive && this.bossIntroData && this.bossIntroData.boss) {
            // Directly center camera on boss during intro
            this.camera.x = this.bossIntroData.boss.x;
            this.camera.y = this.bossIntroData.boss.y;
            return;
        }

        // Handle smooth camera pan after boss intro
        if (this.bossIntroCameraPan) {
            this.bossIntroPanProgress += deltaTime / this.bossIntroPanDuration;

            if (this.bossIntroPanProgress >= 1.0) {
                // Pan complete, resume normal camera following
                this.bossIntroCameraPan = false;
                this.bossIntroPanProgress = 0;
            } else {
                // Smooth easing (ease-out cubic)
                const t = this.bossIntroPanProgress;
                const eased = 1 - Math.pow(1 - t, 3);

                // Lerp from boss position to player position
                const targetPlayer = this.player;
                if (targetPlayer && targetPlayer.alive) {
                    this.camera.x = this.bossIntroPanStartX + (targetPlayer.x - this.bossIntroPanStartX) * eased;
                    this.camera.y = this.bossIntroPanStartY + (targetPlayer.y - this.bossIntroPanStartY) * eased;
                }
                return;
            }
        }

        // Get the player to follow
        let targetPlayer = this.player;

        // In multiplayer, if local player is dead, spectate another player
        const inMultiplayer = this.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.lobbyCode;
        if (inMultiplayer && targetPlayer && targetPlayer.dead) {
            // Local player is dead - find a living player to spectate
            this.spectateMode = true;

            // Look for alive remote player instances (host authority)
            let spectateTarget = null;
            if (this.remotePlayerInstances && this.remotePlayerInstances.size > 0) {
                // Try to find an alive remote player instance
                for (const [playerId, playerInstance] of this.remotePlayerInstances) {
                    if (playerInstance && playerInstance.alive && !playerInstance.dead) {
                        spectateTarget = playerInstance;
                        this.spectatedPlayerId = playerId;
                        break;
                    }
                }
            }

            // If no instances found, try remote players array (for clients)
            if (!spectateTarget && this.remotePlayers && this.remotePlayers.length > 0) {
                for (const remotePlayer of this.remotePlayers) {
                    if (remotePlayer && !remotePlayer.dead) {
                        spectateTarget = remotePlayer;
                        this.spectatedPlayerId = remotePlayer.id;
                        break;
                    }
                }
            }

            if (spectateTarget) {
                targetPlayer = spectateTarget;
            } else {
                // No one to spectate - just stay at current camera position
                return;
            }
        } else if (targetPlayer && targetPlayer.alive) {
            // Local player is alive - clear spectate mode
            this.spectateMode = false;
            this.spectatedPlayerId = null;
        }

        if (!targetPlayer || !targetPlayer.alive) return;

        // Calculate movement-based offset
        const playerVelX = targetPlayer.vx || 0;
        const playerVelY = targetPlayer.vy || 0;
        const speed = Math.sqrt(playerVelX * playerVelX + playerVelY * playerVelY);

        if (speed > this.camera.deadzone) {
            // Player is moving - apply offset in movement direction
            const dirX = playerVelX / speed;
            const dirY = playerVelY / speed;

            // Scale offset based on speed (up to offsetAmount)
            const offsetScale = Math.min(speed / 300, 1); // Max offset at 300 speed
            this.camera.offsetX = dirX * this.camera.offsetAmount * offsetScale;
            this.camera.offsetY = dirY * this.camera.offsetAmount * offsetScale;
        } else {
            // Player is stationary - gradually reduce offset
            this.camera.offsetX *= 0.9;
            this.camera.offsetY *= 0.9;

            // Snap to zero if very small
            if (Math.abs(this.camera.offsetX) < 0.1) this.camera.offsetX = 0;
            if (Math.abs(this.camera.offsetY) < 0.1) this.camera.offsetY = 0;
        }

        // Calculate target camera position (player position + offset)
        this.camera.targetX = targetPlayer.x + this.camera.offsetX;
        this.camera.targetY = targetPlayer.y + this.camera.offsetY;

        // Clamp camera to room boundaries (prevent showing outside room)
        // Account for zoom - with zoom, we see less world space, so bounds are tighter
        if (typeof currentRoom !== 'undefined' && currentRoom) {
            const isMobile = typeof Input !== 'undefined' && Input.isTouchMode && Input.isTouchMode();
            const currentZoom = isMobile ? (this.mobileZoom || 1.0) : this.baseZoom;

            // Visible world space is smaller when zoomed
            const halfVisibleWorldW = (this.config.width / 2) / currentZoom;
            const halfVisibleWorldH = (this.config.height / 2) / currentZoom;

            this.camera.targetX = Math.max(halfVisibleWorldW, Math.min(currentRoom.width - halfVisibleWorldW, this.camera.targetX));
            this.camera.targetY = Math.max(halfVisibleWorldH, Math.min(currentRoom.height - halfVisibleWorldH, this.camera.targetY));
        }

        // Smooth lerp toward target
        const lerpFactor = 1 - Math.exp(-this.camera.smoothSpeed * deltaTime);
        this.camera.x += (this.camera.targetX - this.camera.x) * lerpFactor;
        this.camera.y += (this.camera.targetY - this.camera.y) * lerpFactor;
    },

    // Initialize camera position (when entering room or starting game)
    initializeCamera() {
        if (this.player) {
            this.camera.x = this.player.x;
            this.camera.y = this.player.y;
            this.camera.targetX = this.player.x;
            this.camera.targetY = this.player.y;
            this.camera.offsetX = 0;
            this.camera.offsetY = 0;
        } else {
            // Default to room center
            const roomWidth = (typeof currentRoom !== 'undefined' && currentRoom) ? currentRoom.width : 2400;
            const roomHeight = (typeof currentRoom !== 'undefined' && currentRoom) ? currentRoom.height : 1350;
            this.camera.x = roomWidth / 2;
            this.camera.y = roomHeight / 2;
            this.camera.targetX = this.camera.x;
            this.camera.targetY = this.camera.y;
        }
    },

    // Update nexus camera to follow player
    updateNexusCamera(deltaTime) {
        if (!this.player || typeof nexusRoom === 'undefined' || !nexusRoom) return;

        // Target camera on player position
        this.nexusCamera.targetX = this.player.x;
        this.nexusCamera.targetY = this.player.y;

        // Clamp to nexus boundaries (account for zoom)
        const isMobile = typeof Input !== 'undefined' && Input.isTouchMode && Input.isTouchMode();
        const currentZoom = isMobile ? (this.mobileZoom || 1.0) : this.baseZoom;

        // Visible world space is smaller when zoomed
        const halfVisibleWorldW = (this.config.width / 2) / currentZoom;
        const halfVisibleWorldH = (this.config.height / 2) / currentZoom;

        this.nexusCamera.targetX = Math.max(halfVisibleWorldW, Math.min(nexusRoom.width - halfVisibleWorldW, this.nexusCamera.targetX));
        this.nexusCamera.targetY = Math.max(halfVisibleWorldH, Math.min(nexusRoom.height - halfVisibleWorldH, this.nexusCamera.targetY));

        // Smooth lerp toward target
        const lerpFactor = 1 - Math.exp(-this.nexusCamera.smoothSpeed * deltaTime);
        this.nexusCamera.x += (this.nexusCamera.targetX - this.nexusCamera.x) * lerpFactor;
        this.nexusCamera.y += (this.nexusCamera.targetY - this.nexusCamera.y) * lerpFactor;
    },

    // Initialize nexus camera
    initializeNexusCamera() {
        if (this.player) {
            this.nexusCamera.x = this.player.x;
            this.nexusCamera.y = this.player.y;
            this.nexusCamera.targetX = this.player.x;
            this.nexusCamera.targetY = this.player.y;
        } else if (typeof nexusRoom !== 'undefined' && nexusRoom) {
            this.nexusCamera.x = nexusRoom.width / 2;
            this.nexusCamera.y = nexusRoom.height / 2;
            this.nexusCamera.targetX = this.nexusCamera.x;
            this.nexusCamera.targetY = this.nexusCamera.y;
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

    openPrivacyModal(context = 'onboarding') {
        // Telemetry system disabled by dev - modal will not show
        return;
        // this.privacyModalContext = context;
        // this.privacyModalVisible = true;
        // this.privacyModalReturnToPause = context === 'pause';
        // this.privacyModalPreviousShowPauseMenu = this.showPauseMenu;
        // if (this.privacyModalReturnToPause && this.showPauseMenu) {
        //     this.showPauseMenu = false;
        // }
    },

    closePrivacyModal() {
        this.privacyModalVisible = false;
        if (this.privacyModalReturnToPause) {
            if (this.multiplayerEnabled) {
                this.showPauseMenu = this.privacyModalPreviousShowPauseMenu;
            } else {
                this.showPauseMenu = false;
            }
        }
        this.privacyModalReturnToPause = false;
        this.privacyModalContext = 'onboarding';
        this.privacyModalPreviousShowPauseMenu = false;
    },

    setTelemetryPreference(optIn) {
        const enabled = optIn === true;
        this.telemetryOptIn = enabled;
        if (typeof SaveSystem !== 'undefined' && SaveSystem.setTelemetryOptIn) {
            SaveSystem.setTelemetryOptIn(enabled);
        }
        if (!enabled && typeof Telemetry !== 'undefined' && Telemetry.reset) {
            Telemetry.reset();
        }
    },

    handlePrivacyChoice(optIn) {
        if (typeof SaveSystem !== 'undefined' && SaveSystem.setPrivacyAcknowledged) {
            SaveSystem.setPrivacyAcknowledged(true);
        }
        const context = this.privacyModalContext;
        this.setTelemetryPreference(optIn);
        this.closePrivacyModal();
        if (context === 'onboarding') {
            if (typeof SaveSystem !== 'undefined' && !SaveSystem.getHasSeenLaunchModal()) {
                this.launchModalVisible = true;
            }
        }
    },

    collectTelemetryParticipants(includeRemote = true) {
        const participants = [];
        const localId = this.getLocalPlayerId ? this.getLocalPlayerId() : 'local';

        if (this.player) {
            participants.push({
                player: this.player,
                playerId: localId
            });
        }

        if (
            includeRemote &&
            this.multiplayerEnabled &&
            typeof this.isHost === 'function' &&
            this.isHost() &&
            this.remotePlayerInstances &&
            this.remotePlayerInstances.size > 0
        ) {
            this.remotePlayerInstances.forEach((playerInstance, playerId) => {
                if (playerInstance) {
                    participants.push({
                        player: playerInstance,
                        playerId
                    });
                }
            });
        }

        return participants;
    },

    // Distribute XP to all alive players (host only in multiplayer, all in solo)
    distributeXPToAllPlayers(xpAmount) {
        // Only run on host in multiplayer, or in solo mode
        if (this.multiplayerEnabled && !this.isHost()) {
            return;
        }

        // Collect all alive players
        const alivePlayers = [];

        // Add local player if alive
        if (this.player && this.player.alive && !this.player.dead) {
            alivePlayers.push({
                player: this.player,
                id: this.getLocalPlayerId()
            });
        }

        // In multiplayer, add remote player instances if alive
        if (this.multiplayerEnabled && this.remotePlayerInstances) {
            this.remotePlayerInstances.forEach((playerInstance, playerId) => {
                if (playerInstance && playerInstance.alive && !playerInstance.dead) {
                    alivePlayers.push({
                        player: playerInstance,
                        id: playerId
                    });
                }
            });
        }

        // If no alive players, do nothing
        if (alivePlayers.length === 0) {
            return;
        }

        // Apply XP boost from room modifiers (Scholar Sigil)
        let effectiveXP = xpAmount;
        if (this.nextRoomModifiers && typeof this.nextRoomModifiers.xpBoost === 'number' && this.nextRoomModifiers.xpBoost > 0) {
            effectiveXP = xpAmount * (1 + this.nextRoomModifiers.xpBoost);
        }

        // Give XP to all alive players
        alivePlayers.forEach(({ player, id }) => {
            player.addXP(effectiveXP);
        });
    },

    // Send final stats to all clients when all players die (host only)
    sendFinalStats() {
        if (!this.isHost() || !this.multiplayerEnabled) return;
        if (typeof multiplayerManager === 'undefined' || !multiplayerManager) return;

        // Stop all timers to freeze values
        this.playerStats.forEach((stats, playerId) => {
            stats.stopTimer();
        });

        // Serialize stats for all players (using frozen values)
        const statsObject = {};
        this.playerStats.forEach((stats, playerId) => {
            statsObject[playerId] = {
                damageDealt: stats.damageDealt,
                kills: stats.kills,
                damageTaken: stats.damageTaken,
                roomsCleared: Math.max(0, this.roomNumber - 1),
                timeAlive: stats.getTimeAlive() // This will return frozen value since timer is stopped
            };
        });

        console.log('[Host] Sending final stats to clients:', statsObject);

        // Send to all clients
        multiplayerManager.send({
            type: 'final_stats',
            data: {
                playerStats: statsObject
            }
        });
    },

    // Initialize player stats for a new game
    initializePlayerStats() {
        this.playerStats.clear();
        this.deadPlayers.clear();
        this.allPlayersDead = false;
        this.spectateMode = false;
        this.lastRoomClearReviveRoomNumber = null;

        // Create stats for local player
        const localId = this.getLocalPlayerId();
        this.getPlayerStats(localId);

        // In multiplayer, create stats for all players in lobby
        if (this.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager) {
            console.log(`[Stats Init] My player ID: ${multiplayerManager.playerId}`);
            console.log(`[Stats Init] Lobby has ${multiplayerManager.players ? multiplayerManager.players.length : 0} players`);
            console.log(`[Stats Init] Player list:`, multiplayerManager.players ? multiplayerManager.players.map(p => `${p.id} (${p.name})`) : []);

            if (multiplayerManager.players && multiplayerManager.players.length > 0) {
                multiplayerManager.players.forEach(player => {
                    this.getPlayerStats(player.id);
                    console.log(`[Stats Init] Created stats for ${player.id} (${player.id === localId ? 'ME' : 'REMOTE'})`);

                    // Host: Initialize remote player state tracking AND player instances
                    if (this.isHost() && player.id !== localId) {
                        this.initializeRemotePlayerState(player.id);
                        this.initializeRemotePlayerInstance(player.id, player.class);
                    }
                });
            } else {
                console.error(`[Stats Init] WARNING: No players in lobby! Cannot initialize stats.`);
            }
        }

        // Start timers for all players when game actually begins
        this.playerStats.forEach((stats, playerId) => {
            stats.startTimer();
        });

        console.log(`[Stats] Initialized stats for ${this.playerStats.size} player(s):`);
        this.playerStats.forEach((stats, playerId) => {
            console.log(`  - ${playerId}: ${stats.playerId}`);
        });
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
            playerInstance.playerId = playerId; // Store player ID for damage attribution

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
                        speed: classUpgrades.speed * config.speedPerLevel,
                        cooldown: classUpgrades.cooldown * config.cooldownPerLevel,
                        health: classUpgrades.health * config.healthPerLevel,
                        attackSpeed: classUpgrades.attackSpeed * config.attackSpeedPerLevel
                    };

                    // Apply upgrades to base stats (config values already loaded in constructor)
                    playerInstance.baseDamage = config.baseDamage + upgradeBonuses.damage;
                    playerInstance.baseMoveSpeed = config.baseSpeed + upgradeBonuses.speed;
                    playerInstance.baseDefense = config.baseDefense + upgradeBonuses.defense;
                    playerInstance.baseMaxHp = config.baseHp + upgradeBonuses.health;
                    if (typeof playerInstance.cooldownReduction !== 'undefined') {
                        playerInstance.cooldownReduction = Math.min(0.75, upgradeBonuses.cooldown); // Cap at 75%
                    }
                    if (typeof playerInstance.attackSpeedMultiplier !== 'undefined') {
                        playerInstance.attackSpeedMultiplier = 1.0 + upgradeBonuses.attackSpeed;
                    }
                    if (typeof playerInstance.syncBaseStatAnchors === 'function') {
                        playerInstance.syncBaseStatAnchors();
                    }

                    // Recalculate effective stats
                    playerInstance.updateEffectiveStats();

                    console.log(`[Host] Applied upgrades to ${playerId} (${playerClass}): damage=${classUpgrades.damage}, defense=${classUpgrades.defense}, speed=${classUpgrades.speed}, cooldown=${classUpgrades.cooldown}, health=${classUpgrades.health}, attackSpeed=${classUpgrades.attackSpeed}`);
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
                if (keyLower === 'w') return rawInput.up || false;
                if (keyLower === 's') return rawInput.down || false;
                if (keyLower === 'a') return rawInput.left || false;
                if (keyLower === 'd') return rawInput.right || false;
                if (keyLower === ' ' || keyLower === 'space') return rawInput.space || false;
                if (keyLower === 'shift') return rawInput.shift || false;

                // Check keys object (supports arrow keys and any other bindings)
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
                    // Desktop: calculate rotation from world mouse position
                    // Client sends world coordinates (accounting for their camera)
                    if (rawInput.mouse && rawInput.mouse.x !== undefined && rawInput.mouse.y !== undefined) {
                        const dx = rawInput.mouse.x - remotePlayer.x;
                        const dy = rawInput.mouse.y - remotePlayer.y;
                        return Math.atan2(dy, dx);
                    }
                    // Fallback: use sent rotation or last known angle
                    if (rawInput.rotation !== undefined && rawInput.rotation !== null) {
                        return rawInput.rotation;
                    }
                    return remotePlayer.rotation || remotePlayer.lastAimAngle || 0;
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
                    // Desktop mode: calculate direction from world mouse position
                    // Client now sends world coordinates (accounting for their camera)
                    if (rawInput.mouse && rawInput.mouse.x !== undefined && rawInput.mouse.y !== undefined) {
                        const dx = rawInput.mouse.x - remotePlayer.x;
                        const dy = rawInput.mouse.y - remotePlayer.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        if (dist > 0) {
                            return { x: dx / dist, y: dy / dist };
                        }
                    }
                    // Fallback: use rotation
                    const rotation = rawInput.rotation !== undefined ? rawInput.rotation : (remotePlayer.rotation || 0);
                    return {
                        x: Math.cos(rotation),
                        y: Math.sin(rotation)
                    };
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
                } else {
                    // Desktop mode: calculate angle from world mouse position
                    if (rawInput.mouse && rawInput.mouse.x !== undefined && rawInput.mouse.y !== undefined) {
                        const dx = rawInput.mouse.x - remotePlayer.x;
                        const dy = rawInput.mouse.y - remotePlayer.y;
                        return Math.atan2(dy, dx);
                    }
                    // Fallback: use sent rotation
                    return rawInput.rotation !== undefined ? rawInput.rotation : (remotePlayer.rotation || 0);
                }
            },

            // Get world mouse position (for remote player context)
            getWorldMousePos() {
                // Client now sends world coordinates directly (accounting for their camera)
                // We can use them directly for abilities like Mage blink
                return rawInput.mouse || { x: remotePlayer.x, y: remotePlayer.y };
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

    isBossRoom(roomNumber) {
        if (typeof roomNumber !== 'number') return false;
        if (roomNumber < 10) return false;
        return roomNumber % 5 === 0;
    },

    getActiveBossPhase() {
        if (!this.enemies || !Array.isArray(this.enemies)) {
            return 1;
        }
        const boss = this.enemies.find(enemy => enemy && enemy.isBoss);
        if (boss && typeof boss.phase === 'number') {
            return boss.phase;
        }
        return 1;
    },

    updateMusicForCurrentRoom() {
        if (typeof MusicManager === 'undefined' || !MusicManager) {
            return;
        }
        if (this.gameOverMusicPlaying) {
            return;
        }
        if (this.state === 'NEXUS') {
            MusicManager.setNexus().catch(err => {
                console.error('[Music] Failed to set nexus music:', err);
            });
            return;
        }
        if (!this.roomNumber || this.state === 'PAUSED') {
            return;
        }
        if (this.isBossRoom(this.roomNumber)) {
            const phase = this.getActiveBossPhase();
            MusicManager.setBossPhase(this.roomNumber, phase).catch(err => {
                console.error('[Music] Failed to set boss music:', err);
            });
        } else {
            MusicManager.setRoom(this.roomNumber).catch(err => {
                console.error('[Music] Failed to set room music:', err);
            });
        }
    },

    triggerGameOverMusic() {
        if (this.gameOverMusicPlaying) {
            return;
        }
        this.gameOverMusicPlaying = true;
        if (typeof MusicManager === 'undefined' || !MusicManager || typeof MusicManager.playGameOver !== 'function') {
            return;
        }
        MusicManager.playGameOver().catch(err => {
            console.error('[Music] Failed to start game over music:', err);
        });
    },

    playPauseMusic() {
        if (typeof MusicManager === 'undefined' || !MusicManager || typeof MusicManager.playPauseMenu !== 'function') {
            return;
        }
        if (this.backgroundPauseActive) {
            return;
        }
        const nexusContext = this.state === 'NEXUS' || this.pausedFromState === 'NEXUS';
        if (nexusContext) {
            if (typeof MusicManager.setNexus === 'function') {
                MusicManager.setNexus().catch(err => {
                    console.error('[Music] Failed to reaffirm nexus music during pause:', err);
                });
            }
            return;
        }
        MusicManager.playPauseMenu().catch(err => {
            console.error('[Music] Failed to start pause music:', err);
        });
    },

    resumeFromPauseMusic() {
        if (typeof MusicManager === 'undefined' || !MusicManager) {
            this.updateMusicForCurrentRoom();
            return;
        }
        const nexusContext = this.state === 'NEXUS' || this.pausedFromState === 'NEXUS';
        if (nexusContext) {
            if (typeof MusicManager.setNexus === 'function') {
                MusicManager.setNexus().then(() => {
                    this.updateMusicForCurrentRoom();
                }).catch(err => {
                    console.error('[Music] Failed to resume nexus music after pause:', err);
                    this.updateMusicForCurrentRoom();
                });
            } else {
                this.updateMusicForCurrentRoom();
            }
            this.backgroundPauseActive = false;
            this.autoPausedForBackground = false;
            return;
        }
        if (typeof MusicManager.resumeFromPause !== 'function') {
            this.updateMusicForCurrentRoom();
            this.backgroundPauseActive = false;
            this.autoPausedForBackground = false;
            return;
        }
        MusicManager.resumeFromPause()
            .then((resumed) => {
                if (!resumed) {
                    this.updateMusicForCurrentRoom();
                }
                this.backgroundPauseActive = false;
                this.autoPausedForBackground = false;
            })
            .catch(err => {
                console.error('[Music] Failed to resume music from pause:', err);
                this.updateMusicForCurrentRoom();
                this.backgroundPauseActive = false;
                this.autoPausedForBackground = false;
            });
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

        // Track damage taken in stats
        if (this.getPlayerStats) {
            const stats = this.getPlayerStats(playerId);
            stats.addStat('damageTaken', damage);
        }

        // Apply damage
        state.hp -= damage;

        if (typeof Telemetry !== 'undefined') {
            Telemetry.recordPlayerHit({
                playerId,
                amount: damage,
                roomNumber: this.roomNumber,
                sourceId: null,
                sourceType: 'enemy'
            });
        }
        state.invulnerable = true;
        state.invulnerabilityTime = 0.5; // Same as local player

        // Also update the player instance HP
        const playerInstance = this.remotePlayerInstances.get(playerId);
        if (playerInstance) {
            const oldHp = playerInstance.hp;
            playerInstance.hp = state.hp;
            playerInstance.invulnerable = true;
            playerInstance.invulnerabilityTime = 0.5;

            // Set lastDamageTime and lastDamageAmount for visual effects (chromatic aberration)
            // Screen shake will be triggered on client side when HP syncs via applyState
            // Only set if HP actually decreased (not just invulnerability refresh)
            if (oldHp > state.hp) {
                const damageAmount = oldHp - state.hp;
                playerInstance.lastDamageTime = Date.now() / 1000;
                playerInstance.lastDamageAmount = damageAmount; // Track damage amount for visual effects
            }
        }

        // Check if dead
        if (state.hp <= 0) {
            state.hp = 0;
            state.dead = true;

            // CRITICAL: Also mark the player instance as dead so it's serialized correctly
            if (playerInstance) {
                playerInstance.dead = true;
                playerInstance.alive = false;
                playerInstance.hp = 0;
            }

            // Add to dead players set
            this.deadPlayers.add(playerId);

            // Track death for lifetime stats (only for local player to avoid double-counting)
            const localPlayerId = typeof Game !== 'undefined' && Game.getLocalPlayerId ? Game.getLocalPlayerId() : 'local';
            if (playerId === localPlayerId && typeof window.trackLifetimeStat === 'function') {
                window.trackLifetimeStat('totalDeaths', 1);
            }

            // Track death in stats
            if (this.getPlayerStats) {
                const stats = this.getPlayerStats(playerId);
                stats.onDeath();
            }

            if (typeof Telemetry !== 'undefined') {
                Telemetry.recordPlayerDeath(playerId);
            }

            // Check if all players are dead
            const wasAllDead = this.allPlayersDead;
            this.allPlayersDead = this.checkAllPlayersDead();

            // If all players just died, set death screen start time and send final stats
            if (!wasAllDead && this.allPlayersDead) {
                if (!this.deathScreenStartTime) {
                    this.deathScreenStartTime = Date.now();
                }
                if (!this.endTime) {
                    this.endTime = Date.now();
                }

                if (this.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager) {
                    this.sendFinalStats();
                }

                if (typeof this.triggerGameOverMusic === 'function') {
                    this.triggerGameOverMusic();
                }
            }

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
            // Update camera during boss intro (centers on boss)
            this.updateCamera(deltaTime);
            // Don't update normal game logic during intro
            return;
        }

        // Update screen shake
        this.updateScreenShake(deltaTime);

        // Update camera to follow player
        this.updateCamera(deltaTime);

        // Update particles
        if (typeof updateParticles !== 'undefined') {
            updateParticles(deltaTime);
        }

        // Update lightning arcs
        if (typeof updateLightningArcs !== 'undefined') {
            updateLightningArcs(deltaTime);
        }

        // Update damage numbers
        if (typeof updateDamageNumbers !== 'undefined') {
            updateDamageNumbers(deltaTime);
        }

        // Update door selections
        if (typeof updateDoorSelections !== 'undefined') {
            updateDoorSelections(deltaTime);
        }

        // Update ground items (pulse animation)
        if (typeof updateGroundItems !== 'undefined') {
            updateGroundItems(deltaTime);
        }

        // Update item pylons (multiplayer)
        if (typeof updateItemPylons !== 'undefined') {
            updateItemPylons(deltaTime);
        }

        // Update item pickup messages
        if (typeof updateItemPickupMessages !== 'undefined') {
            updateItemPickupMessages(deltaTime);
        }

        // Check for item pickup
        if (this.player && this.player.alive && typeof checkItemPickup !== 'undefined') {
            checkItemPickup(this.player);
        }

        // Update item effects (auras, etc.)
        if (typeof updateItemEffects !== 'undefined') {
            updateItemEffects(deltaTime);
        }

        // Update item visual animations
        if (typeof updateItemVisuals !== 'undefined') {
            updateItemVisuals(deltaTime);
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

                        // Update heavy attack preview for Warrior/Triangle/Mage
                        if ((this.player.playerClass === 'square' || this.player.playerClass === 'triangle' || this.player.playerClass === 'hexagon') &&
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
                        // Desktop mode: clear previews and update rotation from mouse
                        this.player.dashPreviewActive = false;
                        if (this.player.clearHeavyAttackPreview) {
                            this.player.clearHeavyAttackPreview();
                        }

                        // Update rotation to face mouse cursor (using world coordinates with camera)
                        if (Input.getWorldMousePos) {
                            const worldMouse = Input.getWorldMousePos();
                            const dx = worldMouse.x - savedX; // Use saved (host-authoritative) position
                            const dy = worldMouse.y - savedY;
                            this.player.rotation = Math.atan2(dy, dx);
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
                // Update conditional card effects (momentum decay, overcharge timer)
                if (typeof CardEffects !== 'undefined' && CardEffects.updateConditionalEffects) {
                    CardEffects.updateConditionalEffects(this.player, deltaTime);
                }
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
            // Host or solo: Run full enemy AI and movement
            // Enemies handle their own targeting internally via getAllAlivePlayers()
            this.enemies.forEach(enemy => {
                if (enemy.alive) {
                    // Skip update if this is a boss and intro not complete
                    if (enemy.isBoss && !enemy.introComplete) {
                        return;
                    }
                    enemy.update(deltaTime);

                    // Prevent default overlap with players unless ability explicitly allows it
                    if (enemy.resolvePlayerOverlap) {
                        enemy.resolvePlayerOverlap();
                    }
                }
            });
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

        // Update explosions (remove expired ones)
        if (this.explosions && Array.isArray(this.explosions)) {
            this.explosions = this.explosions.filter(explosion => {
                explosion.elapsed = (explosion.elapsed || 0) + deltaTime;
                return explosion.elapsed < explosion.duration;
            });
        }

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
                    const localPlayerId = this.getLocalPlayerId();
                    checkAttacksVsEnemies(this.player, this.enemies, localPlayerId);
                }

                // Check remote player instance attacks (host only)
                if (this.remotePlayerInstances) {
                    this.remotePlayerInstances.forEach((playerInstance, playerId) => {
                        if (playerInstance && playerInstance.alive) {
                            // Pass the remote player's ID so damage is attributed correctly
                            checkAttacksVsEnemies(playerInstance, this.enemies, playerId);
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
            // Only check old door collision if no door selections are active
            if (typeof currentRoom !== 'undefined' && currentRoom && currentRoom.doorOpen) {
                const hasActiveSelections = typeof window !== 'undefined' &&
                    Array.isArray(window.selectionDoors) &&
                    window.selectionDoors.length > 0 &&
                    window.selectionDoors.some(d => !d.selected && d.alpha > 0);

                // Only use old door system if new system is not active
                if (!hasActiveSelections && !Game.awaitingDoorSelection) {
                    this.checkDoorCollision();
                }
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
        // Keep dead enemies for 1.5 seconds to allow damage numbers to display
        const now = Date.now();
        const DEATH_DISPLAY_DELAY = 1500; // ms

        if (this.isHost() || !this.multiplayerEnabled) {
            // Host or solo: filter and track kills
            this.enemies = this.enemies.filter(enemy => {
                if (!enemy.alive) {
                    // Check if enemy just died (no deathTime yet)
                    if (!enemy.deathTime) {
                        enemy.deathTime = now;
                        this.enemiesKilled++;
                    }
                    // Keep dead enemies for delay period
                    return (now - enemy.deathTime) < DEATH_DISPLAY_DELAY;
                }
                return true; // Keep alive enemies
            });
        } else {
            // Client: filter dead enemies after delay (authoritative state from host)
            this.enemies = this.enemies.filter(enemy => {
                if (!enemy.alive) {
                    // Set deathTime if not already set
                    if (!enemy.deathTime) {
                        enemy.deathTime = now;
                    }
                    // Keep dead enemies for delay period
                    return (now - enemy.deathTime) < DEATH_DISPLAY_DELAY;
                }
                return true; // Keep alive enemies
            });
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

        // Start smooth camera pan from boss to player
        this.bossIntroCameraPan = true;
        this.bossIntroPanProgress = 0;
        this.bossIntroPanStartX = this.camera.x; // Current position (on boss)
        this.bossIntroPanStartY = this.camera.y;

        this.bossIntroActive = false;
        this.bossIntroData = null;

        console.log('Boss intro ended, starting camera pan to player');
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

        // Apply camera transform with boss intro zoom to render boss centered and zoomed
        ctx.save();

        // Center point of screen
        const centerX = this.config.width / 2;
        const centerY = this.config.height / 2;

        // Translate to center, apply zoom, then offset by camera position
        ctx.translate(centerX, centerY);
        ctx.scale(this.bossIntroZoom, this.bossIntroZoom);
        ctx.translate(-this.camera.x, -this.camera.y);

        // Render boss (frozen during intro)
        ctx.globalAlpha = 1.0;
        this.bossIntroData.boss.render(ctx);
        ctx.restore();

        // Boss name text (positioned above boss to avoid health bar overlap)
        ctx.save();
        ctx.globalAlpha = nameFadeIn;
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${48 * nameScale}px Orbitron`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        // Scale-aware positioning: move up based on screen height
        const nameOffsetY = this.config.height * 0.20; // 20% from center
        ctx.fillText(this.bossIntroData.name, this.config.width / 2, this.config.height / 2 - nameOffsetY);
        ctx.restore();

        // "Press any key to continue" text (after 2 seconds)
        if (this.bossIntroData.skipAvailable) {
            const skipFade = Math.sin(Date.now() / 200); // Blinking effect
            ctx.save();
            ctx.globalAlpha = 0.5 + skipFade * 0.5;
            ctx.fillStyle = '#ffff00';
            ctx.font = 'bold 20px Orbitron';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            // Position at bottom of screen area
            const skipOffsetY = this.config.height * 0.25; // 25% from center
            ctx.fillText('Press any key to continue', this.config.width / 2, this.config.height / 2 + skipOffsetY);
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

        // Handle loot cycling (desktop only)
        if (typeof LootSelection !== 'undefined' && (!Input.isTouchMode || !Input.isTouchMode())) {
            // Update nearby items
            LootSelection.updateNearbyItems(this.player);

            // Check for cycle input
            if (Input.keys && Input.keys['arrowleft'] && !this.lastLeftArrowState) {
                this.lastLeftArrowState = true;
                LootSelection.cyclePrevious();
            } else if (Input.keys && Input.keys['arrowleft'] === false) {
                this.lastLeftArrowState = false;
            }

            if (Input.keys && Input.keys['arrowright'] && !this.lastRightArrowState) {
                this.lastRightArrowState = true;
                LootSelection.cycleNext();
            } else if (Input.keys && Input.keys['arrowright'] === false) {
                this.lastRightArrowState = false;
            }
        }

        if (shouldPickup) {
            // Check for item pylon interaction first (multiplayer)
            if (typeof checkItemPylonInteraction !== 'undefined') {
                const pylon = checkItemPylonInteraction(this.player);
                if (pylon && typeof interactWithItemPylon === 'function') {
                    interactWithItemPylon(pylon, this.player);
                    return; // Pylon interaction handled, don't check for gear
                }
            }

            // Use selected gear from LootSelection if available
            let gearToPickup = null;

            if (typeof LootSelection !== 'undefined') {
                LootSelection.updateNearbyItems(this.player);
                gearToPickup = LootSelection.getSelectedGear();
            }

            // Fallback to closest gear if selection system not available
            if (!gearToPickup && typeof groundLoot !== 'undefined') {
                let closestDistance = 50; // pickup range

                groundLoot.forEach(gear => {
                    const dx = gear.x - this.player.x;
                    const dy = gear.y - this.player.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    if (distance < closestDistance) {
                        closestDistance = distance;
                        gearToPickup = gear;
                    }
                });
            }

            // Pick up the gear if found
            if (gearToPickup) {
                this.pickupGear(gearToPickup);
            }
        }
    },

    // Pick up gear
    pickupGear(gear) {
        // Play gear pickup sound
        if (typeof AudioManager !== 'undefined' && AudioManager.sounds) {
            AudioManager.sounds.gearPickup();
        }

        const oldGear = this.player.equipGear(gear);

        // Drop old gear on the ground if it existed
        if (oldGear) {
            // Add small random offset to prevent exact overlap with other items
            const offsetX = (Math.random() - 0.5) * 20;
            const offsetY = (Math.random() - 0.5) * 20;

            // Set position to player location with offset
            oldGear.x = this.player.x + offsetX;
            oldGear.y = this.player.y + offsetY;

            // Clamp to room bounds to prevent gear spawning outside playable area
            const margin = 50;
            const roomWidth = (typeof currentRoom !== 'undefined' && currentRoom) ? currentRoom.width : 2400;
            const roomHeight = (typeof currentRoom !== 'undefined' && currentRoom) ? currentRoom.height : 1350;
            oldGear.x = Math.max(margin, Math.min(roomWidth - margin, oldGear.x));
            oldGear.y = Math.max(margin, Math.min(roomHeight - margin, oldGear.y));

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
                            size: oldGear.size || 15,
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

    reviveDeadPlayers(options = {}) {
        const {
            reason = 'unknown',
            broadcast = true,
            targetPlayerIds = null,
            respawnStrategy = 'auto'
        } = options;

        const manager = (typeof multiplayerManager !== 'undefined') ? multiplayerManager : null;
        const inMultiplayer = !!(this.multiplayerEnabled && manager);
        const revived = new Set();
        const targetSet = Array.isArray(targetPlayerIds) ? new Set(targetPlayerIds) : null;
        const shouldProcess = (playerId) => {
            if (!playerId) return false;
            return !targetSet || targetSet.has(playerId);
        };

        const doorRect = (typeof getDoorPosition === 'function') ? getDoorPosition() : null;
        const roomWidth = (typeof currentRoom !== 'undefined' && currentRoom && currentRoom.width) ? currentRoom.width : this.config.width;
        const roomHeight = (typeof currentRoom !== 'undefined' && currentRoom && currentRoom.height) ? currentRoom.height : this.config.height;
        const spawnBaseX = 140;
        const spawnBaseY = roomHeight / 2;
        const spawnSpread = 70;
        const safeRespawnNeeded = (reason === 'room_clear' || reason === 'room_transition' || respawnStrategy === 'safe');

        const resetActionState = (playerObj) => {
            if (!playerObj) return;
            playerObj.isDodging = false;
            playerObj.dodgeElapsed = 0;
            playerObj.isChargingHeavy = false;
            playerObj.heavyChargeElapsed = 0;
            playerObj.isAttacking = false;
            playerObj.attackCooldown = 0;
            playerObj.heavyAttackCooldown = 0;
            playerObj.specialCooldown = playerObj.specialCooldown || 0;
            playerObj.vx = 0;
            playerObj.vy = 0;
            playerObj.dodgeVx = 0;
            playerObj.dodgeVy = 0;
        };

        const repositionPlayer = (playerObj, index = 0) => {
            if (!playerObj) return;

            const needsDoorEscape = doorRect && (
                playerObj.x >= (doorRect.x - playerObj.size * 0.5) &&
                playerObj.x <= (doorRect.x + doorRect.width + playerObj.size * 0.5) &&
                playerObj.y >= (doorRect.y - playerObj.size) &&
                playerObj.y <= (doorRect.y + doorRect.height + playerObj.size)
            );

            if (!safeRespawnNeeded && !needsDoorEscape) {
                return;
            }

            const column = index % 3;
            const row = Math.floor(index / 3);
            const offsetX = column * spawnSpread;
            const offsetY = (row % 2 === 0 ? 1 : -1) * Math.ceil(row / 2) * spawnSpread * 0.75;

            playerObj.x = Math.min(spawnBaseX + offsetX, roomWidth - playerObj.size * 2);
            playerObj.y = Math.min(Math.max(spawnBaseY + offsetY, playerObj.size * 2), roomHeight - playerObj.size * 2);
        };

        const applyRevival = (playerObj, playerId, index = 0, isLocal = false) => {
            if (!playerObj) return false;
            if (!this.deadPlayers.has(playerId)) return false;
            if (!shouldProcess(playerId)) return false;

            resetActionState(playerObj);

            playerObj.dead = false;
            playerObj.alive = true;
            playerObj.hp = playerObj.maxHp * 0.5;
            playerObj.invulnerable = true;
            playerObj.invulnerabilityTime = Math.max(playerObj.invulnerabilityTime || 0, 1.5);

            if (typeof playerObj.clearStatusEffects === 'function') {
                playerObj.clearStatusEffects();
            } else if (playerObj.statusEffects) {
                Object.keys(playerObj.statusEffects).forEach(key => {
                    playerObj.statusEffects[key] = null;
                });
            }

            if (typeof playerObj.resetDashAnimation === 'function') {
                playerObj.resetDashAnimation();
            }

            if (typeof playerObj.resetHeavyCharge === 'function') {
                playerObj.resetHeavyCharge();
            }

            if (typeof playerObj.updateEffectiveStats === 'function') {
                playerObj.updateEffectiveStats();
            }

            repositionPlayer(playerObj, index);

            this.deadPlayers.delete(playerId);
            revived.add(playerId);

            if (typeof this.getPlayerStats === 'function') {
                const stats = this.getPlayerStats(playerId);
                if (stats && typeof stats.onRevive === 'function') {
                    stats.onRevive();
                }
            }

            if (isLocal) {
                this.allPlayersDead = false;
                this.spectateMode = false;
                this.spectatedPlayerId = null;
                this.deathScreenStartTime = 0;
                this.endTime = 0;
            }

            return true;
        };

        const localPlayerId = this.getLocalPlayerId ? this.getLocalPlayerId() : null;
        if (localPlayerId && this.player && this.player.dead) {
            const revivedLocal = applyRevival(this.player, localPlayerId, revived.size, true);
            if (revivedLocal) {
                // Track revive for lifetime stats
                if (typeof window.trackLifetimeStat === 'function') {
                    window.trackLifetimeStat('totalRevives', 1);
                }
                console.log(`[Revival] Player revived at 50% HP (${Math.floor(this.player.hp)}/${Math.floor(this.player.maxHp)}) [reason=${reason}]`);
            }
        }

        if (this.isHost() && this.remotePlayerInstances && this.remotePlayerInstances.size > 0) {
            let remoteIndex = revived.size;
            this.remotePlayerInstances.forEach((playerInstance, playerId) => {
                if (!playerInstance || !playerInstance.dead) return;
                const revivedRemote = applyRevival(playerInstance, playerId, remoteIndex);
                if (revivedRemote) {
                    if (this.remotePlayerStates && this.remotePlayerStates.has(playerId)) {
                        const state = this.remotePlayerStates.get(playerId);
                        state.dead = false;
                        state.hp = playerInstance.hp;
                        state.invulnerable = true;
                        state.invulnerabilityTime = Math.max(state.invulnerabilityTime || 0, 1.5);
                    }
                    console.log(`[Host Revival] Remote player ${playerId} revived at 50% HP (${Math.floor(playerInstance.hp)}/${Math.floor(playerInstance.maxHp)}) [reason=${reason}]`);
                    remoteIndex++;
                }
            });
        }

        if (revived.size > 0) {
            this.allPlayersDead = false;

            if (this.playersOnDoor && this.playersOnDoor.length > 0) {
                this.playersOnDoor = this.playersOnDoor.filter(id => !revived.has(id));
            }

            if (this.isHost() && inMultiplayer && broadcast) {
                try {
                    manager.send({
                        type: 'revive_players',
                        data: {
                            playerIds: Array.from(revived),
                            reason,
                            roomNumber: this.roomNumber,
                            timestamp: Date.now()
                        }
                    });
                } catch (err) {
                    console.error('[Revival] Failed to broadcast revive_players message:', err);
                }
            }

            if (this.isHost() && inMultiplayer) {
                manager.sendGameState();
            }
        }

        return Array.from(revived);
    },

    // Advance to next room
    advanceToNextRoom() {
        this.roomNumber++;
        this.gameOverMusicPlaying = false;
        if (typeof audioMenuVisible !== 'undefined') {
            audioMenuVisible = false;
        }

        // Reset door waiting state
        this.playersOnDoor = [];
        this.totalAlivePlayers = 0;

        // Phoenix down is now charge-based, no need to reset per room
        // Charges persist across rooms and are recharged by dealing damage

        // Multiplayer: Revive dead players at 50% HP
        let transitionRevivedIds = [];
        if (this.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager) {
            transitionRevivedIds = this.reviveDeadPlayers({
                reason: 'room_transition',
                broadcast: false,
                respawnStrategy: 'safe'
            });

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

                // Clear ground cards (will be synced from host)
                if (typeof window.groundCards !== 'undefined' && Array.isArray(window.groundCards)) {
                    window.groundCards.length = 0;
                }

                // Clear ground items (will be synced from host)
                if (typeof Game !== 'undefined' && Game.groundItems && Array.isArray(Game.groundItems)) {
                    Game.groundItems.length = 0;
                }

                // Clear item pylons (will be synced from host)
                if (typeof Game !== 'undefined' && Game.itemPylons && Array.isArray(Game.itemPylons)) {
                    Game.itemPylons.length = 0;
                }

                // Reset player position to left side (new room size)
                const roomHeight = 1350;
                this.player.x = 100;
                this.player.y = roomHeight / 2; // Vertically centered (675)

                // Initialize camera to follow player
                this.initializeCamera();

                console.log(`[Client] Waiting for room ${this.roomNumber} from host...`);
                this.updateMusicForCurrentRoom();
            } else {
                // Host or solo: Generate room normally
                const newRoom = generateRoom(this.roomNumber);

                // Update currentRoom to the new room
                if (typeof currentRoom !== 'undefined') {
                    currentRoom = newRoom;
                    // Sync to window for DOM components
                    if (typeof window !== 'undefined') {
                        window.currentRoom = currentRoom;
                    }
                }

                // Update enemies array
                this.enemies = newRoom.enemies;

                // No longer pre-assign targets - proximity detection and damage-based aggro handle targeting

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

                // Clear ground cards from previous room
                if (typeof window.groundCards !== 'undefined' && Array.isArray(window.groundCards)) {
                    window.groundCards.length = 0;
                }

                // Clear ground items from previous room
                if (typeof Game !== 'undefined' && Game.groundItems && Array.isArray(Game.groundItems)) {
                    Game.groundItems.length = 0;
                }

                // Clear item pylons from previous room (multiplayer)
                if (typeof Game !== 'undefined' && Game.itemPylons && Array.isArray(Game.itemPylons)) {
                    Game.itemPylons.length = 0;
                }

                // Clear door selections from previous room (but preserve selectedDoorReward for spawning)
                if (typeof clearDoorSelections === 'function') {
                    // Don't clear selectedDoorReward - it needs to persist until this room is cleared
                    const savedReward = window.selectedDoorReward;
                    clearDoorSelections();
                    // Restore it if it exists (it will be cleared after spawning in spawnRoomReward)
                    if (savedReward) {
                        window.selectedDoorReward = savedReward;
                    }
                }

                // Reset player position to left side (new room size)
                const roomHeight = 1350;
                this.player.x = 100;
                this.player.y = roomHeight / 2; // Vertically centered (675)

                // Reset remote player instances to spawn (host only)
                if (this.isHost() && this.remotePlayerInstances) {
                    this.remotePlayerInstances.forEach((playerInstance, playerId) => {
                        playerInstance.x = 100;
                        playerInstance.y = roomHeight / 2;
                    });
                }

                // Initialize camera to follow player
                this.initializeCamera();

                console.log(`Advanced to Room ${this.roomNumber}${newRoom.type === 'boss' ? ' (BOSS ROOM)' : ''}`);
                this.updateMusicForCurrentRoom();

                if (typeof Telemetry !== 'undefined') {
                    const participants = this.collectTelemetryParticipants(true);
                    Telemetry.recordRoomEnter(this.roomNumber, newRoom.type, participants);
                }

                // Multiplayer: Send room transition message and immediate state update
                if (this.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager) {
                    if (multiplayerManager.isHost) {
                        // Send room transition message first (with revival data)
                        multiplayerManager.send({
                            type: 'room_transition',
                            data: {
                                roomNumber: this.roomNumber,
                                reviveePlayers: transitionRevivedIds && transitionRevivedIds.length
                                    ? transitionRevivedIds
                                    : (transitionRevivedIds === undefined ? undefined : []),
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
            if (inMultiplayer && this.showPauseMenu && !window.USE_DOM_UI) {
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

                    return; // Exit early, state conversion done
                } else {
                    // Unknown paused state, default to nexus
                    this.state = 'NEXUS';
                    this.showPauseMenu = true;
                    this.paused = false;
                    if (typeof renderNexus !== 'undefined') {
                        renderNexus(this.ctx);
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
            }
        } else {
            // PLAYING state

            // Check for damage trauma (Chromatic Aberration)
            // Use a threshold of 0.5 seconds for the glitch effect
            const now = Date.now() / 1000;
            const damageTraumaDuration = 0.5;

            // Check local player or client's remote player instance
            let playerToCheck = this.player;
            if (!playerToCheck && this.multiplayerEnabled && typeof this.getLocalPlayerId === 'function') {
                const localPlayerId = this.getLocalPlayerId();
                if (localPlayerId && this.remotePlayerInstances) {
                    playerToCheck = this.remotePlayerInstances.get(localPlayerId);
                }
            }

            const isDamaged = playerToCheck && playerToCheck.lastDamageTime && (now - playerToCheck.lastDamageTime < damageTraumaDuration);

            if (isDamaged) {
                // --- OFFSCREEN RENDER PATH (With Chromatic Aberration) ---

                // Initialize offscreen canvas if needed
                const dpr = this.dpr || 1;
                const logicalWidth = this.config.width;
                const logicalHeight = this.config.height;
                const pixelWidth = logicalWidth * dpr;
                const pixelHeight = logicalHeight * dpr;

                if (!this.offscreenCanvas) {
                    this.offscreenCanvas = document.createElement('canvas');
                    this.offscreenCanvas.width = pixelWidth;
                    this.offscreenCanvas.height = pixelHeight;
                    this.offscreenCtx = this.offscreenCanvas.getContext('2d');
                    this.offscreenCtx.scale(dpr, dpr); // Scale context for logical drawing
                } else if (this.offscreenCanvas.width !== pixelWidth || this.offscreenCanvas.height !== pixelHeight) {
                    this.offscreenCanvas.width = pixelWidth;
                    this.offscreenCanvas.height = pixelHeight;
                    this.offscreenCtx.scale(dpr, dpr); // Re-apply scale after resize
                }

                // Clear offscreen canvas
                const biome = typeof getBiomeForRoom !== 'undefined' ? getBiomeForRoom(this.roomNumber) : { baseColor: '#1a1a2e' };
                Renderer.clear(this.offscreenCtx, logicalWidth, logicalHeight, biome.baseColor);

                // Apply camera transform and screen shake to offscreen context
                this.offscreenCtx.save();

                // Detect if desktop (for zoom)
                const isMobile = typeof Input !== 'undefined' && Input.isTouchMode && Input.isTouchMode();
                const currentZoom = isMobile ? (this.mobileZoom || 1.0) : this.baseZoom;

                // Camera transform
                const centerX = logicalWidth / 2;
                const centerY = logicalHeight / 2;
                this.offscreenCtx.translate(centerX + this.screenShakeOffset.x, centerY + this.screenShakeOffset.y);
                this.offscreenCtx.scale(currentZoom, currentZoom);
                this.offscreenCtx.translate(-this.camera.x, -this.camera.y);

                // Render room background with grid pattern (inside camera transform - world space)
                if (typeof renderRoomBackground !== 'undefined') {
                    renderRoomBackground(this.offscreenCtx, this.roomNumber);
                }

                // Render room boundaries (visible walls at room edges)
                if (typeof renderRoomBoundaries !== 'undefined') {
                    renderRoomBoundaries(this.offscreenCtx, this.roomNumber);
                }

                // Render game entities to offscreen canvas
                this.renderGameWorld(this.offscreenCtx);

                // Restore offscreen context
                this.offscreenCtx.restore();

                // --- Chromatic Aberration Pass (True RGB Split) ---
                // Draw offscreen canvas to main canvas with RGB offsets
                // To prevent "wash out", we isolate channels using multiply blend mode

                // Initialize channel buffer if needed
                if (!this.channelCanvas) {
                    this.channelCanvas = document.createElement('canvas');
                    this.channelCanvas.width = pixelWidth;
                    this.channelCanvas.height = pixelHeight;
                    this.channelCtx = this.channelCanvas.getContext('2d');
                    this.channelCtx.scale(dpr, dpr);
                } else if (this.channelCanvas.width !== pixelWidth || this.channelCanvas.height !== pixelHeight) {
                    this.channelCanvas.width = pixelWidth;
                    this.channelCanvas.height = pixelHeight;
                    this.channelCtx.scale(dpr, dpr);
                }

                // Calculate intensity based on time elapsed (Fade Out)
                const elapsed = now - playerToCheck.lastDamageTime;
                const progress = Math.min(elapsed / damageTraumaDuration, 1.0);
                const intensity = 1.0 - progress; // Linear fade out (1.0 -> 0.0)

                // Calculate damage percentage based on damage amount from THIS hit (not total health lost)
                // Scale from 0% to 45% of max HP (45% = maximum effect)
                const hitDamagePercentage = playerToCheck.maxHp > 0 && playerToCheck.lastDamageAmount > 0
                    ? playerToCheck.lastDamageAmount / playerToCheck.maxHp
                    : 0;
                // Normalize to 0.1-1.0, capped at 45% of max HP (0.1 at 0% damage, 1.0 at 45%+ damage)
                const normalizedDamage = Math.min(hitDamagePercentage / 0.45, 1.0);
                const damagePercentage = 0.1 + (1.0 - 0.1) * normalizedDamage; // Scale from 0.1 to 1.0

                // Scale maxOffset based on damage percentage
                // At 0% damage: minimal separation (2px)
                // At 45% damage: maximum separation (16px)
                const baseMaxOffset = 2; // Minimum offset at 0% damage
                const maxMaxOffset = 16; // Maximum offset at 45% damage
                const maxOffset = baseMaxOffset + (maxMaxOffset - baseMaxOffset) * damagePercentage;

                // Ease out the offset to prevent "pop" at the end
                // Quadratic ease out: t * (2 - t)
                const easeIntensity = intensity * (2 - intensity);
                const offset = maxOffset * easeIntensity;

                // Clear main canvas (Black background)
                this.ctx.clearRect(0, 0, logicalWidth, logicalHeight);

                // Use additive blending to recombine channels
                this.ctx.globalCompositeOperation = 'lighter';

                // Helper to draw a single channel
                const drawChannel = (color, xOffset) => {
                    // 1. Copy scene to channel buffer
                    this.channelCtx.globalCompositeOperation = 'copy';
                    // Draw offscreen canvas (source) to channel canvas (dest)
                    // Both are pixel-sized, but contexts are scaled.
                    // We need to draw at logical size to fill the scaled context.
                    this.channelCtx.drawImage(this.offscreenCanvas, 0, 0, logicalWidth, logicalHeight);

                    // 2. Multiply with channel color to isolate it
                    this.channelCtx.globalCompositeOperation = 'multiply';
                    this.channelCtx.fillStyle = color;
                    this.channelCtx.fillRect(0, 0, logicalWidth, logicalHeight);

                    // 3. Draw isolated channel to main canvas with offset
                    this.ctx.save();
                    this.ctx.translate(xOffset, 0);
                    this.ctx.drawImage(this.channelCanvas, 0, 0, logicalWidth, logicalHeight);
                    this.ctx.restore();
                };

                // Draw Red Channel (Left)
                drawChannel('#FF0000', -offset);

                // Draw Green Channel (Center)
                drawChannel('#00FF00', 0);

                // Draw Blue Channel (Right)
                drawChannel('#0000FF', offset);

                // Reset composite operation
                this.ctx.globalCompositeOperation = 'source-over';

            } else {
                // --- DIRECT RENDER PATH (Sharp, no blur) ---

                // Clear main canvas
                const biome = typeof getBiomeForRoom !== 'undefined' ? getBiomeForRoom(this.roomNumber) : { baseColor: '#1a1a2e' };
                Renderer.clear(this.ctx, this.config.width, this.config.height, biome.baseColor);

                // Apply camera transform
                this.ctx.save();

                // Detect if desktop (for zoom)
                const isMobile = typeof Input !== 'undefined' && Input.isTouchMode && Input.isTouchMode();
                const currentZoom = isMobile ? (this.mobileZoom || 1.0) : this.baseZoom;

                // Camera transform
                const centerX = this.config.width / 2;
                const centerY = this.config.height / 2;
                this.ctx.translate(centerX + this.screenShakeOffset.x, centerY + this.screenShakeOffset.y);
                this.ctx.scale(currentZoom, currentZoom);
                this.ctx.translate(-this.camera.x, -this.camera.y);

                // Render room background
                if (typeof renderRoomBackground !== 'undefined') {
                    renderRoomBackground(this.ctx, this.roomNumber);
                }
                if (typeof renderRoomBoundaries !== 'undefined') {
                    renderRoomBoundaries(this.ctx, this.roomNumber);
                }

                // Render game entities
                this.renderGameWorld(this.ctx);

                // Restore main context
                this.ctx.restore();
            }

            // --- DYNAMIC VIGNETTE (Light-Aware) ---
            this.renderVignette(this.ctx);
        }

        // Render touch controls (on top of everything)
        if (typeof Input !== 'undefined' && Input.render) {
            Input.render(this.ctx);
        }

        // Render interaction button (on top of touch controls)
        if (typeof renderInteractionButton === 'function') {
            renderInteractionButton(this.ctx);
        }
    },

    // Create cached light sprite for efficient rendering
    createLightSprite() {
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        const center = size / 2;
        const radius = size / 2;

        const grad = ctx.createRadialGradient(center, center, 0, center, center, radius);
        grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
        grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.5)');
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(center, center, radius, 0, Math.PI * 2);
        ctx.fill();

        return canvas;
    },

    // Render dynamic vignette with light sources
    renderVignette(ctx) {
        // Initialize light sprite if not exists
        if (!this.lightSprite) {
            this.lightSprite = this.createLightSprite();
        }
        // Get Device Pixel Ratio (or default to 1)
        const dpr = this.dpr || 1;
        const logicalWidth = this.config.width;
        const logicalHeight = this.config.height;
        const physicalWidth = Math.floor(logicalWidth * dpr);
        const physicalHeight = Math.floor(logicalHeight * dpr);

        // Create offscreen canvases if needed
        if (!this.vignetteCanvas) {
            this.vignetteCanvas = document.createElement('canvas');
            this.vignetteCtx = this.vignetteCanvas.getContext('2d');
        }
        if (!this.playerLightCanvas) {
            this.playerLightCanvas = document.createElement('canvas');
            this.playerLightCtx = this.playerLightCanvas.getContext('2d');
        }

        // Resize offscreen canvases if needed (check against physical size)
        // OPTIMIZATION: Use lower resolution for lighting (0.5x)
        const lightScale = 0.5;
        const lightWidth = Math.floor(physicalWidth * lightScale);
        const lightHeight = Math.floor(physicalHeight * lightScale);

        if (this.vignetteCanvas.width !== lightWidth || this.vignetteCanvas.height !== lightHeight) {
            this.vignetteCanvas.width = lightWidth;
            this.vignetteCanvas.height = lightHeight;
            this.playerLightCanvas.width = lightWidth;
            this.playerLightCanvas.height = lightHeight;

            // IMPORTANT: Scale contexts to match logical coordinates
            // This must be done after resizing (which resets transform)
            // We need to account for the lightScale as well
            this.vignetteCtx.scale(dpr * lightScale, dpr * lightScale);
            this.playerLightCtx.scale(dpr * lightScale, dpr * lightScale);
        }

        const vCtx = this.vignetteCtx;
        const pCtx = this.playerLightCtx;

        // 1. Clear canvases (using logical dimensions because context is scaled)
        vCtx.clearRect(0, 0, logicalWidth, logicalHeight);
        pCtx.clearRect(0, 0, logicalWidth, logicalHeight);

        // Helper to get screen coordinates
        const getScreenPos = (x, y) => {
            // Camera transform logic from renderGameWorld
            const isMobile = typeof Input !== 'undefined' && Input.isTouchMode && Input.isTouchMode();
            const currentZoom = isMobile ? (this.mobileZoom || 1.0) : this.baseZoom;
            const centerX = logicalWidth / 2;
            const centerY = logicalHeight / 2;

            // Apply camera transform: (world - camera) * zoom + center + shake
            const screenX = (x - this.camera.x) * currentZoom + centerX + this.screenShakeOffset.x;
            const screenY = (y - this.camera.y) * currentZoom + centerY + this.screenShakeOffset.y;

            return { x: screenX, y: screenY, zoom: currentZoom };
        };

        // Helper to draw light using cached sprite
        const drawLight = (ctx, x, y, radius) => {
            const pos = getScreenPos(x, y);
            const screenRadius = radius * pos.zoom;
            const diameter = screenRadius * 2;

            ctx.drawImage(
                this.lightSprite,
                pos.x - screenRadius,
                pos.y - screenRadius,
                diameter,
                diameter
            );
        };

        // --- PHASE 1: WORLD LIGHTS (Enemies, Doors, Environment) ---
        // Use 'lighten' to prevent infinite stacking.
        vCtx.globalCompositeOperation = 'lighten';

        // Helper to check if light is visible (for vignette culling)
        const isVisibleInVignette = (x, y, radius) => {
            // Check if light affects visible area
            // Account for light radius when culling
            const isMobile = typeof Input !== 'undefined' && Input.isTouchMode && Input.isTouchMode();
            const zoom = isMobile ? (this.mobileZoom || 1.0) : (this.baseZoom || 1.1);
            const margin = radius; // Use light radius as margin

            const screenW = logicalWidth / zoom;
            const screenH = logicalHeight / zoom;

            const viewX = this.camera.x - screenW / 2 - margin;
            const viewY = this.camera.y - screenH / 2 - margin;
            const viewW = screenW + margin * 2;
            const viewH = screenH + margin * 2;

            return (
                x >= viewX &&
                x <= viewX + viewW &&
                y >= viewY &&
                y <= viewY + viewH
            );
        };

        // Enemy Lights (Glowing enemies) - CULLED
        // Skip individual enemies with stealth flag OR if global stealth mode enabled
        this.enemies.forEach(enemy => {
            if (enemy.alive) {
                // Skip if this enemy is stealth OR global stealth mode is on
                if (!enemy.stealthEnemy && !this.enemyStealthMode) {
                    const lightRadius = enemy.size * 4 + 100;
                    if (isVisibleInVignette(enemy.x, enemy.y, lightRadius)) {
                        drawLight(vCtx, enemy.x, enemy.y, lightRadius);
                    }
                }
            }
        });

        // Door Lights (Nexus Portal & Selection Doors & Level Exit)
        // 1. Nexus Portal (only in Nexus)
        if (this.state === 'NEXUS' && typeof nexusRoom !== 'undefined' && nexusRoom) {
            if (nexusRoom.portalPos && isVisibleInVignette(nexusRoom.portalPos.x, nexusRoom.portalPos.y, 250)) {
                drawLight(vCtx, nexusRoom.portalPos.x, nexusRoom.portalPos.y, 250);
            }
        }

        // 2. Selection Doors (Card Packs in Game) - CULLED
        if (typeof window.selectionDoors !== 'undefined' && Array.isArray(window.selectionDoors)) {
            window.selectionDoors.forEach(door => {
                if (door.alpha > 0 && isVisibleInVignette(door.x, door.y, 200)) {
                    drawLight(vCtx, door.x, door.y, 200);
                }
            });
        }

        // 3. Ground Upgrades (if any) - CULLED
        if (typeof window.groundUpgrades !== 'undefined' && Array.isArray(window.groundUpgrades)) {
            window.groundUpgrades.forEach(upgrade => {
                if (upgrade.alpha > 0 && isVisibleInVignette(upgrade.x, upgrade.y, 150)) {
                    drawLight(vCtx, upgrade.x, upgrade.y, 150);
                }
            });
        }

        // 3.5. Ground Cards (Card Mode Loot) - CULLED
        if (typeof window.groundCards !== 'undefined' && Array.isArray(window.groundCards)) {
            window.groundCards.forEach(card => {
                // Match enemy light pattern: size * 4 + base
                // Card size is ~16, so 16 * 4 + 120 = 184
                const lightRadius = 200;
                if (isVisibleInVignette(card.x, card.y, lightRadius)) {
                    drawLight(vCtx, card.x, card.y, lightRadius);
                }
            });
        }

        // 3.6. Ground Loot (Gear Items from groundLoot array) - CULLED
        // Note: Gear items use groundLoot array, NOT Game.groundItems
        if (typeof groundLoot !== 'undefined' && Array.isArray(groundLoot)) {
            groundLoot.forEach(item => {
                // Match enemy light pattern: size * 4 + base
                // Gear items are larger, use bigger radius
                const lightRadius = 200;
                if (isVisibleInVignette(item.x, item.y, lightRadius)) {
                    drawLight(vCtx, item.x, item.y, lightRadius);
                }
            });
        }

        // 3.7. Ground Items (Item System - Single Player) - CULLED
        // Note: Items use Game.groundItems array (not groundLoot)
        if (typeof Game !== 'undefined' && Game.groundItems && Array.isArray(Game.groundItems)) {
            Game.groundItems.forEach(item => {
                const lightRadius = 150;
                if (isVisibleInVignette(item.x, item.y, lightRadius)) {
                    drawLight(vCtx, item.x, item.y, lightRadius);
                }
            });
        }

        // 3.8. Item Pylons (Multiplayer Item Drops) - CULLED
        if (typeof Game !== 'undefined' && Game.itemPylons && Array.isArray(Game.itemPylons)) {
            Game.itemPylons.forEach(pylon => {
                // Skip if disappearing
                if (pylon.disappearing) return;

                const lightRadius = 180;
                if (isVisibleInVignette(pylon.x, pylon.y, lightRadius)) {
                    drawLight(vCtx, pylon.x, pylon.y, lightRadius);
                }
            });
        }

        // 4. Level Exit Door (Standard Door) - CULLED
        if (typeof currentRoom !== 'undefined' && currentRoom && currentRoom.doorOpen) {
            const selectionDoorsActive = typeof window.selectionDoors !== 'undefined' && Array.isArray(window.selectionDoors) && window.selectionDoors.length > 0;

            if (!selectionDoorsActive && typeof getDoorPosition === 'function') {
                const doorPos = getDoorPosition();
                if (doorPos) {
                    const centerX = doorPos.x + doorPos.width / 2;
                    const centerY = doorPos.y + doorPos.height / 2;

                    if (isVisibleInVignette(centerX, centerY, 300)) {
                        drawLight(vCtx, centerX, centerY, 300);
                    }
                }
            }
        }

        // 5. Non-Player Projectiles (Enemy Projectiles) - CULLED
        this.projectiles.forEach(proj => {
            // Only render if NOT a player projectile
            if (!proj.playerId) {
                const lightRadius = proj.size * 6 + 50;
                if (isVisibleInVignette(proj.x, proj.y, lightRadius)) {
                    drawLight(vCtx, proj.x, proj.y, lightRadius);
                }
            }
        });

        // --- PHASE 2: PLAYER LIGHTS (Additive) ---
        // Render to separate canvas using 'lighter' so player lights stack with each other
        pCtx.globalCompositeOperation = 'lighter';

        // Player Light (Local Player)
        if (this.player && this.player.alive) {
            drawLight(pCtx, this.player.x, this.player.y, 400); // Reduced from 600 for stealth gameplay
        }

        // Remote Players Lights (Multiplayer)
        if (this.remotePlayers && this.remotePlayers.length > 0) {
            this.remotePlayers.forEach(remotePlayer => {
                if (remotePlayer && !remotePlayer.dead) { // Check if alive
                    drawLight(pCtx, remotePlayer.x, remotePlayer.y, 400); // Reduced from 600
                }
            });
        }

        // Player Projectiles - CULLED
        this.projectiles.forEach(proj => {
            if (proj.playerId) {
                const lightRadius = proj.size * 6 + 50;
                if (isVisibleInVignette(proj.x, proj.y, lightRadius)) {
                    drawLight(pCtx, proj.x, proj.y, lightRadius);
                }
            }
        });

        // Mage Beam Lights (Player Ability)
        // Draw lights along active beams for dramatic lighting effect
        if (this.player && this.player.activeBeams && this.player.activeBeams.length > 0) {
            this.player.activeBeams.forEach(beam => {
                // Calculate beam endpoint
                const beamRange = 800; // MAGE_CONFIG.beamRange
                const endX = beam.origin.x + beam.direction.x * beamRange;
                const endY = beam.origin.y + beam.direction.y * beamRange;

                // Draw multiple lights along the beam path
                const numLights = 8;
                for (let i = 0; i < numLights; i++) {
                    const t = i / (numLights - 1);
                    const lightX = beam.origin.x + (endX - beam.origin.x) * t;
                    const lightY = beam.origin.y + (endY - beam.origin.y) * t;

                    // Larger lights at origin, smaller at end
                    const lightSize = 150 * (1 - t * 0.5);

                    if (isVisibleInVignette(lightX, lightY, lightSize)) {
                        drawLight(pCtx, lightX, lightY, lightSize);
                    }
                }
            });
        }

        // Remote Player Beams (Multiplayer)
        if (this.remotePlayers && this.remotePlayers.length > 0) {
            this.remotePlayers.forEach(remotePlayer => {
                if (remotePlayer && !remotePlayer.dead && remotePlayer.activeBeams && remotePlayer.activeBeams.length > 0) {
                    remotePlayer.activeBeams.forEach(beam => {
                        const beamRange = 800;
                        const endX = beam.origin.x + beam.direction.x * beamRange;
                        const endY = beam.origin.y + beam.direction.y * beamRange;

                        const numLights = 8;
                        for (let i = 0; i < numLights; i++) {
                            const t = i / (numLights - 1);
                            const lightX = beam.origin.x + (endX - beam.origin.x) * t;
                            const lightY = beam.origin.y + (endY - beam.origin.y) * t;
                            const lightSize = 150 * (1 - t * 0.5);

                            if (isVisibleInVignette(lightX, lightY, lightSize)) {
                                drawLight(pCtx, lightX, lightY, lightSize);
                            }
                        }
                    });
                }
            });
        }

        // --- PHASE 3: COMBINE ---
        // Draw player lights onto world lights using 'lighten' (Max)
        // Note: We use logical dimensions for drawImage because vCtx is scaled
        vCtx.globalCompositeOperation = 'lighten';
        vCtx.drawImage(this.playerLightCanvas, 0, 0, logicalWidth, logicalHeight);

        // --- PHASE 3.5: BACKGROUND GRID GLOW ---
        // Draw the background grid onto the light mask so it glows through the darkness
        // We need to apply the camera transform to match the world space rendering
        vCtx.save();

        // Apply camera transform (same as main render loop)
        // Center camera
        // Note: We use logicalWidth/Height which should match config.width/height used in renderGameWorld
        vCtx.translate(
            logicalWidth / 2 + this.screenShakeOffset.x,
            logicalHeight / 2 + this.screenShakeOffset.y
        );

        const isMobile = typeof Input !== 'undefined' && Input.isTouchMode && Input.isTouchMode();
        const currentZoom = isMobile ? (this.mobileZoom || 1.0) : this.baseZoom;

        vCtx.scale(currentZoom, currentZoom);
        vCtx.translate(-this.camera.x, -this.camera.y);

        // Draw grid lines (using lighten to add to light mask)
        // The pattern has the glow "baked in" (wide lines with alpha)
        if (typeof drawBiomeGrid === 'function') {
            drawBiomeGrid(vCtx, this.roomNumber, true); // true = isVignetteMask
        }

        vCtx.restore();

        // --- PHASE 4: APPLY DARKNESS ---
        // Draw darkness everywhere EXCEPT where we have light
        vCtx.globalCompositeOperation = 'source-out';
        vCtx.fillStyle = 'rgba(0, 0, 0, 1.0)'; // Total darkness (100%) - only lit areas visible
        vCtx.fillRect(0, 0, logicalWidth, logicalHeight);

        // --- PHASE 5: RENDER TO SCREEN ---
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform to screen space (physical pixels)
        // Draw the physical canvas onto the physical screen
        // Scale it back up to fill the screen (since we rendered at 0.5x)
        ctx.drawImage(this.vignetteCanvas, 0, 0, physicalWidth, physicalHeight);
        ctx.restore();
    },

    // Render game world (player, enemies, etc.)
    renderGameWorld(ctx) {
        // Note: ctx is now likely the offscreen context, but logic remains the same
        // Camera transform is already applied by caller

        // ------------------------------------------
        // PHASE 1: THE GLOWS (The "Neon" look)
        // ------------------------------------------
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        // Helper to check if entity is visible (Culling)
        const isVisible = (entity, margin = 100) => {
            // Simple AABB check against camera view
            // Viewport is centered on camera
            const halfWidth = (this.config.width / 2) / (this.baseZoom || 1) + margin;
            const halfHeight = (this.config.height / 2) / (this.baseZoom || 1) + margin;

            return (
                entity.x >= this.camera.x - halfWidth &&
                entity.x <= this.camera.x + halfWidth &&
                entity.y >= this.camera.y - halfHeight &&
                entity.y <= this.camera.y + halfHeight
            );
        };

        // Create cached glow sprite if not exists
        if (!this.glowSprite) {
            const size = 128;
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const gCtx = canvas.getContext('2d');
            const center = size / 2;
            const radius = size / 2;

            const grad = gCtx.createRadialGradient(center, center, 0, center, center, radius);
            grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
            grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

            gCtx.fillStyle = grad;
            gCtx.beginPath();
            gCtx.arc(center, center, radius, 0, Math.PI * 2);
            gCtx.fill();

            this.glowSprite = canvas;
        }

        // Helper to draw glow using sprite (much faster than gradients)
        // Glow Cache System
        // Stores offscreen canvases for glow effects to avoid expensive gradient creation per frame
        if (!this.glowCache) {
            this.glowCache = new Map();
        }

        // Helper to get or create a cached glow sprite
        // Helper to get or create a cached glow sprite
        const getCachedGlow = (color) => {
            // Use a fixed large size for the cache key to avoid fragmentation/thrashing
            // We'll scale this texture down/up as needed
            const key = color;

            if (this.glowCache.has(key)) {
                return this.glowCache.get(key);
            }

            // Create new cached glow
            // Use a reasonably high resolution (e.g., 128px radius = 256px diameter)
            // This allows scaling up to ~256px radius without too much blur, and scales down well
            const size = 128;
            const canvas = document.createElement('canvas');
            const diameter = size * 2;
            // Add padding to avoid clipping at edges
            const padding = 4;
            canvas.width = diameter + padding * 2;
            canvas.height = diameter + padding * 2;
            const gCtx = canvas.getContext('2d');

            const center = size + padding;

            const grad = gCtx.createRadialGradient(
                center, center, size * 0.1,
                center, center, size
            );
            grad.addColorStop(0, color);
            grad.addColorStop(1, 'rgba(0,0,0,0)');

            gCtx.fillStyle = grad;
            gCtx.beginPath();
            gCtx.arc(center, center, size, 0, Math.PI * 2);
            gCtx.fill();

            this.glowCache.set(key, canvas);
            return canvas;
        };

        // Optimized drawGlow using cache
        const drawGlow = (x, y, size, color) => {
            // Check debug flag
            if (typeof DebugFlags !== 'undefined' && DebugFlags.USE_CACHING === false) {
                // Fallback to original gradient rendering
                const grad = ctx.createRadialGradient(
                    x, y, size * 0.1,
                    x, y, size
                );
                grad.addColorStop(0, color);
                grad.addColorStop(1, 'rgba(0,0,0,0)');

                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(x, y, size, 0, Math.PI * 2);
                ctx.fill();
                return;
            }

            const cachedCanvas = getCachedGlow(color);

            // Calculate scale factor
            // Cached image has radius 128 (plus padding)
            // We want to draw it with radius 'size'
            const cachedRadius = 128;
            const scale = size / cachedRadius;

            // Draw centered and scaled
            const offset = cachedCanvas.width / 2;

            ctx.save();
            ctx.translate(x, y);
            ctx.scale(scale, scale);
            ctx.drawImage(cachedCanvas, -offset, -offset);
            ctx.restore();
        };

        // Draw Enemy Glows (Culled)
        // Skip individual enemies with stealth flag OR if global stealth mode enabled
        this.enemies.forEach(enemy => {
            if (enemy.alive && isVisible(enemy, enemy.size * 3)) {
                // Skip if this enemy is stealth OR global stealth mode is on
                if (!enemy.stealthEnemy && !this.enemyStealthMode) {
                    const glowSize = enemy.size * 2.5;
                    drawGlow(enemy.x, enemy.y, glowSize, enemy.color);
                }
            }
        });

        // Draw Projectile Glows (Culled)
        this.projectiles.forEach(projectile => {
            if (isVisible(projectile, projectile.size * 4)) {
                const glowSize = projectile.size * 3.0;
                const color = projectile.color || (projectile.type === 'knife' ? '#ff1493' : '#ffff00');
                drawGlow(projectile.x, projectile.y, glowSize, color);
            }
        });

        // Draw Ground Loot Glows (Gear Items from groundLoot array) - Culled
        // Note: Gear items use groundLoot array, NOT Game.groundItems
        if (typeof groundLoot !== 'undefined' && Array.isArray(groundLoot)) {
            // Gear tier colors
            const gearTierColors = {
                white: '#cccccc',
                green: '#4caf50',
                blue: '#2196f3',
                purple: '#9c27b0',
                orange: '#ff9800'
            };

            groundLoot.forEach(gear => {
                if (isVisible(gear, 50)) {
                    const glowSize = 60; // Fixed size for gear
                    const color = gearTierColors[gear.tier] || '#cccccc';
                    drawGlow(gear.x, gear.y, glowSize, color);
                }
            });
        }

        // Draw Ground Card Glows (Card Mode Loot) - Culled
        if (typeof window !== 'undefined' && window.groundCards && Array.isArray(window.groundCards)) {
            // Card band colors
            const getBandColor = (band) => {
                switch (band) {
                    case 'green': return '#4caf50';
                    case 'blue': return '#2196f3';
                    case 'purple': return '#9c27b0';
                    case 'orange': return '#ff9800';
                    default: return '#cccccc';
                }
            };

            window.groundCards.forEach(card => {
                if (isVisible(card, 20)) {
                    const pulseSize = 2 + Math.sin(card.pulse || 0) * 2;
                    const glowSize = (16 + pulseSize) * 3.0;
                    const color = getBandColor(card._resolvedQuality || 'white');
                    drawGlow(card.x, card.y, glowSize, color);
                }
            });
        }

        // Draw Ground Items Glows (Item System - Single Player) - Culled
        if (typeof Game !== 'undefined' && Game.groundItems && Array.isArray(Game.groundItems)) {
            // Item rarity colors
            const itemRarityColors = {
                common: '#999999',
                uncommon: '#4caf50',
                rare: '#2196f3',
                epic: '#9c27b0'
            };

            Game.groundItems.forEach(item => {
                if (isVisible(item, 20)) {
                    const pulseSize = 2 + Math.sin(item.pulse || 0) * 2;
                    const glowSize = (item.size + pulseSize) * 3.0;
                    const rarity = item.definition?.rarity || 'common';
                    const color = itemRarityColors[rarity] || '#999999';
                    drawGlow(item.x, item.y, glowSize, color);
                }
            });
        }

        // Draw Item Pylons Glows (Multiplayer Item Drops) - Culled
        if (typeof Game !== 'undefined' && Game.itemPylons && Array.isArray(Game.itemPylons)) {
            // Item rarity colors (same as ground items)
            const itemRarityColors = {
                common: '#999999',
                uncommon: '#4caf50',
                rare: '#2196f3',
                epic: '#9c27b0'
            };

            Game.itemPylons.forEach(pylon => {
                // Skip if disappearing
                if (pylon.disappearing) return;

                if (isVisible(pylon, 30)) {
                    const pulseSize = 3 + Math.sin(pylon.pulse || 0) * 2;
                    const glowSize = (pylon.size + pulseSize) * 3.5;
                    const rarity = pylon.rarity || 'common';
                    const color = itemRarityColors[rarity] || '#999999';
                    drawGlow(pylon.x, pylon.y, glowSize, color);
                }
            });
        }

        // Draw Particles (Particles are naturally glowing/additive)
        // Note: renderParticles should handle its own culling if possible, 
        // but for now we rely on it being fast enough or adding culling there later.
        if (typeof renderParticles !== 'undefined') {
            renderParticles(ctx);
        }

        // Draw Lightning Arcs (naturally glowing)
        if (typeof renderLightningArcs !== 'undefined') {
            renderLightningArcs(ctx);
        }

        // Draw Local Player Glow
        if (this.player && this.player.alive) {
            const selectedClass = this.selectedClass;
            const classDef = selectedClass && typeof CLASS_DEFINITIONS !== 'undefined' ? CLASS_DEFINITIONS[selectedClass] : null;
            const playerColor = classDef ? classDef.color : '#888888';
            const playerSize = this.player.size || 20;

            // Draw a radial gradient larger than the player
            const glowSize = playerSize * 2.5;

            // Use cached glow if available, otherwise draw gradient
            if (isVisible(this.player, glowSize)) {
                drawGlow(this.player.x, this.player.y, glowSize, playerColor);
            }
        }

        // Draw Remote Player Glows (multiplayer)
        const inMultiplayer = this.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.lobbyCode;
        if (inMultiplayer) {
            if (this.isHost() && this.remotePlayerInstances && this.remotePlayerInstances.size > 0) {
                this.remotePlayerInstances.forEach((playerInstance, playerId) => {
                    if (!playerInstance || playerInstance.dead || !playerInstance.alive) {
                        return;
                    }

                    const classKey = playerInstance.playerClass || 'square';
                    const classDef = typeof CLASS_DEFINITIONS !== 'undefined' ? (CLASS_DEFINITIONS[classKey] || CLASS_DEFINITIONS.square) : null;
                    const playerColor = classDef ? classDef.color : '#888888';
                    const playerSize = playerInstance.size || 20;
                    const glowSize = playerSize * 2.5;

                    if (isVisible(playerInstance, glowSize)) {
                        drawGlow(playerInstance.x, playerInstance.y, glowSize, playerColor);
                    }
                });
            } else if (this.isMultiplayerClient() && this.remotePlayerShadowInstances && this.remotePlayerShadowInstances.size > 0) {
                this.remotePlayerShadowInstances.forEach((shadowInstance, playerId) => {
                    if (!shadowInstance || shadowInstance.dead || !shadowInstance.alive) {
                        return;
                    }

                    const classKey = shadowInstance.playerClass || shadowInstance.classType || 'square';
                    const classDef = typeof CLASS_DEFINITIONS !== 'undefined' ? (CLASS_DEFINITIONS[classKey] || CLASS_DEFINITIONS.square) : null;
                    const playerColor = classDef ? classDef.color : '#888888';
                    const playerSize = shadowInstance.size || 20;
                    const glowSize = playerSize * 2.5;

                    if (isVisible(shadowInstance, glowSize)) {
                        drawGlow(shadowInstance.x, shadowInstance.y, glowSize, playerColor);
                    }
                });
            } else if (this.remotePlayers && this.remotePlayers.length > 0) {
                this.remotePlayers.forEach(remotePlayer => {
                    if (!remotePlayer || remotePlayer.dead) {
                        return;
                    }

                    const classKey = remotePlayer.class || 'square';
                    const classDef = typeof CLASS_DEFINITIONS !== 'undefined' ? (CLASS_DEFINITIONS[classKey] || CLASS_DEFINITIONS.square) : null;
                    const playerColor = classDef ? classDef.color : '#888888';
                    const playerSize = remotePlayer.size || 20;
                    const glowSize = playerSize * 2.5;

                    if (isVisible(remotePlayer, glowSize)) {
                        drawGlow(remotePlayer.x, remotePlayer.y, glowSize, playerColor);
                    }
                });
            }
        }

        ctx.restore(); // Restore to source-over

        // ------------------------------------------
        // PHASE 2: THE BODIES (The "Solid" look)
        // ------------------------------------------
        // ctx.globalCompositeOperation is 'source-over' by default after restore

        // Draw item aura rings (damage aura, slow aura) - BEFORE player render so they appear underneath
        if (typeof renderItemVisuals !== 'undefined') {
            renderItemVisuals(ctx);
        }

        // Draw player (Player is drawn normally)
        if (this.player && this.player.alive) {
            this.player.render(ctx);
        }

        // Draw remote players (multiplayer)
        if (this.remotePlayers && this.remotePlayers.length > 0) {
            this.renderRemotePlayers(ctx);
        }

        // Draw enemies (Solid bodies on top of glows)
        this.enemies.forEach(enemy => {
            if (enemy.alive && isVisible(enemy, enemy.size * 2)) {
                enemy.render(ctx);
            }
        });

        // Draw projectiles (Solid bodies)
        this.projectiles.forEach(projectile => {
            if (!isVisible(projectile, projectile.size * 2)) return;

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

        // Draw ground cards
        if (typeof renderGroundCards !== 'undefined') {
            renderGroundCards(ctx);
        }

        // Draw ground items (item system - single player)
        if (typeof renderGroundItems !== 'undefined') {
            renderGroundItems(ctx);
        }

        // Draw item pylons (multiplayer item drops)
        if (typeof renderItemPylons !== 'undefined') {
            renderItemPylons(ctx);
        }

        // Draw upgrade pickups
        if (typeof window !== 'undefined' && typeof window.renderUpgradePickups === 'function') {
            window.renderUpgradePickups(ctx);
        } else if (typeof renderUpgradePickups !== 'undefined') {
            renderUpgradePickups(ctx);
        }

        // Draw door selections (card view before selection, door view after)
        if (typeof window !== 'undefined' && typeof window.renderDoorSelections === 'function') {
            window.renderDoorSelections(ctx);
        } else if (typeof renderDoorSelections !== 'undefined') {
            renderDoorSelections(ctx);
        }

        // Draw door if room is cleared (only if no door selections active)
        // The new door selection system replaces the old door when active
        if (typeof currentRoom !== 'undefined' && currentRoom && currentRoom.doorOpen) {
            // Check if new door selection system is active
            const hasActiveSelections = typeof window !== 'undefined' &&
                Array.isArray(window.selectionDoors) &&
                window.selectionDoors.length > 0 &&
                window.selectionDoors.some(d => !d.selected && d.alpha > 0);

            // Only show regular door if new system is not active
            if (!hasActiveSelections && !Game.awaitingDoorSelection) {
                const door = getDoorPosition();
                Renderer.door(ctx, door.x, door.y, door.width, door.height, this.doorPulse);
            }
        }

        // Debug: verify renderGameWorld is being called
        if (!this._lastRenderLog || Date.now() - this._lastRenderLog > 5000) {
            // console.log('[Main] renderGameWorld executing'); // Commented out to reduce noise
            this._lastRenderLog = Date.now();
        }

        // Draw damage numbers
        if (typeof renderDamageNumbers !== 'undefined') {
            renderDamageNumbers(ctx);
        }

        // Update DOM-based gear tooltip
        if (typeof GearTooltipUI !== 'undefined' && GearTooltipUI.update) {
            // console.log('[Main] Calling GearTooltipUI.update()');
            GearTooltipUI.update();
        } else if (typeof renderGearTooltips === 'function') {
            // Fallback to canvas renderer if DOM UI not loaded
            // console.log('[Main] GearTooltipUI not found, using canvas renderer');
            if (this.player && this.player.alive) {
                try {
                    renderGearTooltips(this.ctx, this.player);
                } catch (e) {
                    console.error('[Game] Error rendering gear tooltips:', e);
                }
            }
        }
    },

    // Toggle pause
    togglePause() {
        // Prevent pausing when awaiting card swap
        if (this.awaitingHandSwap && this.pendingSwapCard) {
            console.log('[TOGGLE PAUSE] Blocked - awaiting card swap');
            return;
        }

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
                    if (typeof audioMenuVisible !== 'undefined') {
                        audioMenuVisible = false;
                    }
                    this.playPauseMusic();
                } else if (this.pausedFromState === 'PLAYING') {
                    this.state = 'PLAYING';
                    this.showPauseMenu = true;
                    this.paused = false;
                    console.log('Converted single-player game pause to multiplayer pause menu');
                    if (typeof audioMenuVisible !== 'undefined') {
                        audioMenuVisible = false;
                    }
                    this.playPauseMusic();
                }
                return;
            }

            // Normal multiplayer pause menu toggle
            if (this.showPauseMenu) {
                this.showPauseMenu = false;
                console.log('[TOGGLE PAUSE] Multiplayer pause menu closed');
                if (typeof audioMenuVisible !== 'undefined') {
                    audioMenuVisible = false;
                }
                this.resumeFromPauseMusic();
            } else {
                this.showPauseMenu = true;
                this.pausedFromState = this.state; // Remember where we paused from
                console.log('[TOGGLE PAUSE] Multiplayer pause menu opened - pausedFromState set to:', this.state);
                if (typeof audioMenuVisible !== 'undefined') {
                    audioMenuVisible = false;
                }
                this.playPauseMusic();
            }
        } else {
            // Single player: Normal pause behavior
            if (this.state === 'PLAYING') {
                this.state = 'PAUSED';
                this.paused = true;
                this.pausedFromState = 'PLAYING'; // Remember where we paused from
                console.log('[TOGGLE PAUSE] Game paused - pausedFromState set to: PLAYING');
                this.playPauseMusic();
            } else if (this.state === 'NEXUS') {
                this.state = 'PAUSED';
                this.paused = true;
                this.pausedFromState = 'NEXUS'; // Remember where we paused from
                console.log('[TOGGLE PAUSE] Nexus paused - pausedFromState set to: NEXUS');
                this.playPauseMusic();
            } else if (this.state === 'PAUSED') {
                // Resume to the state we paused from
                this.state = this.pausedFromState || 'PLAYING';
                this.paused = false;
                this.pausedFromState = null;
                console.log('[TOGGLE PAUSE] Game resumed - pausedFromState cleared');
                if (typeof audioMenuVisible !== 'undefined') {
                    audioMenuVisible = false;
                }
                this.resumeFromPauseMusic();
            }
        }
    },

    // Cleanup deck/hand state (called when returning to nexus, restarting, or game over)
    cleanupDeckState() {
        // Clear deck state
        if (typeof window.DeckState !== 'undefined') {
            if (Array.isArray(window.DeckState.hand)) {
                window.DeckState.hand.length = 0;
            }
            if (Array.isArray(window.DeckState.discard)) {
                window.DeckState.discard.length = 0;
            }
            if (Array.isArray(window.DeckState.drawPile)) {
                window.DeckState.drawPile.length = 0;
            }
            if (Array.isArray(window.DeckState.spent)) {
                window.DeckState.spent.length = 0;
            }
            if (Array.isArray(window.DeckState.reserve)) {
                window.DeckState.reserve.length = 0;
            }
        }

        // Clear pending swap state
        this.pendingSwapCard = null;
        this.pendingSwapSourceId = null;
        this.awaitingHandSwap = false;

        // Clear ground cards
        if (typeof window.groundCards !== 'undefined' && Array.isArray(window.groundCards)) {
            window.groundCards.length = 0;
        }

        // Clear mulligan state
        this.awaitingMulligan = false;
        this.mulliganSelections = [];
        this.mulliganCount = 0;

        // Clear items on death/run end
        if (this.player && this.player.itemManager) {
            this.player.itemManager.clearAllItems();
        }

        // Clear ground items
        if (typeof Game !== 'undefined' && Game.groundItems && Array.isArray(Game.groundItems)) {
            Game.groundItems.length = 0;
        }

        // Clear item pylons (multiplayer)
        if (typeof Game !== 'undefined' && Game.itemPylons && Array.isArray(Game.itemPylons)) {
            Game.itemPylons.length = 0;
        }
    },

    // Return to nexus after death
    returnToNexus() {
        // Multiplayer clients: wait for host signal
        if (this.waitingForHostReturn && this.isMultiplayerClient()) {
            console.log('[Client] Waiting for host to signal return to nexus');
            return;
        }

        // Multiplayer: Host calculates and distributes currency rewards
        if (this.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.isHost) {
            // Calculate currency for all players who died
            const localPlayerId = this.getLocalPlayerId();

            // Award shards and credits for local player
            if (this.player && this.player.dead) {
                // Award shards
                if (this.shardsEarned > 0 && typeof SaveSystem !== 'undefined' && SaveSystem.addCardShards) {
                    SaveSystem.addCardShards(this.shardsEarned);
                    console.log(`[Return to Nexus] Awarded ${this.shardsEarned} shards to local player`);
                }

                // Award credits (only from elites/bosses)
                if (this.currencyEarned > 0) {
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
                }

                this.currencyEarned = 0;
                this.shardsEarned = 0;
            }

            // Award shards and credits for remote players who died
            if (this.deadPlayers && this.deadPlayers.size > 0) {
                this.deadPlayers.forEach(playerId => {
                    if (playerId !== localPlayerId) {
                        // Calculate shards for remote player
                        const shardsEarned = this.calculateShardsForPlayer ? this.calculateShardsForPlayer(playerId) : 0;

                        // Calculate credits for remote player (only from elites/bosses)
                        const currencyEarned = this.calculateCurrencyForPlayer(playerId);

                        // Send shards update via server
                        if (shardsEarned > 0 && multiplayerManager.send) {
                            multiplayerManager.send({
                                type: 'shards_update',
                                data: {
                                    targetPlayerId: playerId,
                                    shardsEarned: shardsEarned,
                                    reason: 'round_reward'
                                }
                            });
                        }

                        // Send currency update via server (server will route to player)
                        if (currencyEarned > 0) {
                            const currentCurrency = this.playerCurrencies.get(playerId) || 0;
                            const newCurrency = Math.floor(currentCurrency + currencyEarned);
                            this.playerCurrencies.set(playerId, newCurrency);

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
                    }
                });
            }

            // Reset death tracking before the next run
            if (this.deadPlayers) {
                this.deadPlayers.clear();
            }
            this.allPlayersDead = false;
            this.spectateMode = false;

            // Send return to nexus message to all clients
            multiplayerManager.send({
                type: 'return_to_nexus',
                data: { timestamp: Date.now() }
            });
        } else if (this.multiplayerEnabled && this.isMultiplayerClient && this.isMultiplayerClient()) {
            // Multiplayer client: Calculate and award shards/credits locally (fallback if host message didn't arrive)
            if (this.player && this.player.dead) {
                if (typeof SaveSystem !== 'undefined') {
                    // Calculate shards if not already set
                    if (this.shardsEarned === 0 && this.calculateShards) {
                        this.shardsEarned = this.calculateShards();
                    }

                    // Award shards
                    if (this.shardsEarned > 0 && SaveSystem.addCardShards) {
                        SaveSystem.addCardShards(this.shardsEarned);
                        console.log(`[Return to Nexus] Client awarded ${this.shardsEarned} shards (fallback)`);
                    }

                    // Calculate credits if not already set
                    if (this.currencyEarned === 0 && this.calculateCurrency) {
                        this.currencyEarned = this.calculateCurrency();
                    }

                    // Award credits (only from elites/bosses)
                    if (this.currencyEarned > 0) {
                        SaveSystem.addCurrency(this.currencyEarned);
                        const saveData = SaveSystem.load();
                        this.currentCurrency = Math.floor(saveData.currency || 0);
                        console.log(`[Return to Nexus] Client awarded ${this.currencyEarned} credits (fallback)`);
                    }
                }
                this.currencyEarned = 0;
                this.shardsEarned = 0;
            }
        } else {
            // Single-player: Award shards and credits earned
            if (this.player && this.player.dead) {
                if (typeof SaveSystem !== 'undefined') {
                    // Award shards
                    if (this.shardsEarned > 0 && SaveSystem.addCardShards) {
                        SaveSystem.addCardShards(this.shardsEarned);
                        console.log(`[Return to Nexus] Awarded ${this.shardsEarned} shards`);
                    }

                    // Award credits (only from elites/bosses)
                    if (this.currencyEarned > 0) {
                        SaveSystem.addCurrency(this.currencyEarned);
                        const saveData = SaveSystem.load();
                        this.currentCurrency = Math.floor(saveData.currency || 0);
                        console.log(`[Return to Nexus] Awarded ${this.currencyEarned} credits`);
                    }
                }
                this.currencyEarned = 0;
                this.shardsEarned = 0;
            }
        }

        if (typeof Telemetry !== 'undefined') {
            const participants = this.collectTelemetryParticipants(true);
            let result = 'abandoned';
            if (this.allPlayersDead || (this.player && this.player.dead)) {
                result = 'failure';
            } else if (typeof currentRoom !== 'undefined' && currentRoom && currentRoom.type === 'boss' && currentRoom.cleared) {
                result = 'success';
            }

            const roomsClearedByPlayer = {};
            if (this.playerStats && this.playerStats.size > 0) {
                this.playerStats.forEach((stats, playerId) => {
                    roomsClearedByPlayer[playerId] = typeof stats.roomsCleared === 'number'
                        ? stats.roomsCleared
                        : Math.max(0, this.roomNumber - 1);
                });
            }

            Telemetry.completeRun({
                result,
                metadata: {
                    reason: 'returnToNexus',
                    lobbyCode: this.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager
                        ? multiplayerManager.lobbyCode || null
                        : null
                },
                roomsClearedByPlayer,
                finalPlayers: participants
            });

            // Update lifetime stats from run
            if (typeof window.updateLifetimeStatsFromRun === 'function' && this.playerStats) {
                const localPlayerId = this.getLocalPlayerId ? this.getLocalPlayerId() : null;
                if (localPlayerId) {
                    const stats = this.getPlayerStats(localPlayerId);
                    if (stats) {
                        window.updateLifetimeStatsFromRun({
                            roomsCleared: stats.roomsCleared || 0,
                            runEnded: true,
                            died: result === 'failure',
                            beatBoss: result === 'success'
                        });
                    }
                }
            }
        }

        // Reset game state
        this.state = 'NEXUS';
        this.enemies = [];
        this.projectiles = [];
        this.gameOverMusicPlaying = false;
        this.updateMusicForCurrentRoom();

        // Reset pause state completely
        this.paused = false;
        this.showPauseMenu = false;
        this.pausedFromState = null;

        // Reset multiplayer menu visibility (ensure clean state)
        if (typeof multiplayerMenuVisible !== 'undefined') {
            multiplayerMenuVisible = false;
        }
        if (typeof audioMenuVisible !== 'undefined') {
            audioMenuVisible = false;
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
        this.elitesKilled = 0;
        this.bossesKilled = 0;
        this.roomNumber = 1;
        this.currencyEarned = 0;
        this.shardsEarned = 0;
        this.lastGKeyState = false;
        this.clickHandled = false;
        this.deathScreenStartTime = 0; // Reset death screen timer
        this.waitingForHostReturn = false; // Clear waiting flag
        this.finalStats = null; // Clear final stats

        // Reset first room flag for door reward system
        if (typeof window !== 'undefined') {
            window.isFirstRoom = true;
            window.selectedDoorReward = null;
        }
        if (this.deadPlayers) {
            this.deadPlayers.clear();
        }
        this.allPlayersDead = false;
        this.spectateMode = false;

        // Clear ground loot
        if (typeof groundLoot !== 'undefined') {
            groundLoot.length = 0;
        }

        // Transfer unused room modifiers from run inventory to Nexus collection
        if (typeof SaveSystem !== 'undefined' && Array.isArray(this.roomModifierInventory) && this.roomModifierInventory.length > 0) {
            const save = SaveSystem.load();
            if (!Array.isArray(save.roomModifierCollection)) {
                save.roomModifierCollection = [];
            }

            // Check storage cap
            const maxStorage = 40;
            let transferredCount = 0;

            // Transfer each modifier, avoiding duplicates (modifiers picked up during run are already in collection)
            for (const modifier of this.roomModifierInventory) {
                if (save.roomModifierCollection.length >= maxStorage) {
                    console.warn(`[Return to Nexus] Nexus collection full, could not transfer remaining modifiers`);
                    break;
                }

                // Check if modifier already exists in collection (by ID)
                const exists = save.roomModifierCollection.some(m => m && m.id === modifier.id);
                if (!exists) {
                    save.roomModifierCollection.push(modifier);
                    transferredCount++;
                } else {
                    console.log(`[Return to Nexus] Modifier ${modifier.family || modifier.name} already in Nexus collection, skipping transfer`);
                }
            }

            if (transferredCount > 0) {
                SaveSystem.save(save);
                console.log(`[Return to Nexus] Transferred ${transferredCount} unused room modifier(s) to Nexus collection`);
            }

            // Clear run inventory (modifiers have been transferred or were used)
            this.roomModifierInventory = [];
        }

        // Clear deck/hand state (cleanup from run)
        this.cleanupDeckState();

        // Clean up multiplayer shadow instances (clients only)
        if (this.remotePlayerShadowInstances) {
            this.remotePlayerShadowInstances.clear();
            console.log('[Client] Cleared shadow instances on return to nexus');
        }

        // Initialize nexus if needed
        if (typeof initNexus !== 'undefined') {
            initNexus();
        }

        // Host: revive and reset remote player simulations for the nexus
        if (this.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.isHost) {
            const fallbackSpawnX = (typeof nexusRoom !== 'undefined' && nexusRoom && nexusRoom.spawnPos) ? nexusRoom.spawnPos.x : 300;
            const fallbackSpawnY = (typeof nexusRoom !== 'undefined' && nexusRoom && nexusRoom.spawnPos) ? nexusRoom.spawnPos.y : 360;

            const spawnPositions = new Map();
            if (multiplayerManager.remotePlayers && multiplayerManager.remotePlayers.length > 0) {
                multiplayerManager.remotePlayers.forEach(remotePlayer => {
                    const spawnX = remotePlayer.x !== undefined ? remotePlayer.x : fallbackSpawnX;
                    const spawnY = remotePlayer.y !== undefined ? remotePlayer.y : fallbackSpawnY;
                    spawnPositions.set(remotePlayer.id, { x: spawnX, y: spawnY });
                });
            }

            if (this.remotePlayerStates && this.remotePlayerStates.size > 0) {
                this.remotePlayerStates.forEach((state, playerId) => {
                    if (!state) return;

                    const playerInstance = this.remotePlayerInstances ? this.remotePlayerInstances.get(playerId) : null;
                    const maxHp = playerInstance && (playerInstance.maxHp || playerInstance.baseMaxHp)
                        ? (playerInstance.maxHp || playerInstance.baseMaxHp)
                        : (state.maxHp !== undefined ? state.maxHp : 100);

                    state.maxHp = maxHp;
                    state.hp = maxHp;
                    state.dead = false;
                    state.invulnerable = false;
                    state.invulnerabilityTime = 0;
                });
            }

            if (this.remotePlayerInstances && this.remotePlayerInstances.size > 0) {
                this.remotePlayerInstances.forEach((playerInstance, playerId) => {
                    if (!playerInstance) return;

                    const spawn = spawnPositions.get(playerId);
                    const spawnX = spawn ? spawn.x : fallbackSpawnX;
                    const spawnY = spawn ? spawn.y : fallbackSpawnY;

                    playerInstance.dead = false;
                    playerInstance.alive = true;
                    playerInstance.invulnerable = false;
                    playerInstance.invulnerabilityTime = 0;
                    playerInstance.isDodging = false;
                    playerInstance.dodgeElapsed = 0;
                    playerInstance.attackHitboxes = Array.isArray(playerInstance.attackHitboxes) ? playerInstance.attackHitboxes : [];
                    playerInstance.attackHitboxes.length = 0;

                    const maxHp = playerInstance.maxHp || playerInstance.baseMaxHp || 100;
                    playerInstance.hp = maxHp;

                    playerInstance.x = spawnX;
                    playerInstance.y = spawnY;
                    playerInstance.vx = 0;
                    playerInstance.vy = 0;

                    playerInstance.attackCooldown = 0;
                    playerInstance.heavyAttackCooldown = 0;
                    playerInstance.dodgeCooldown = 0;
                    playerInstance.specialCooldown = 0;
                });
            }
        }

        // Initialize nexus camera to follow player
        this.initializeNexusCamera();

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

    // Calculate shards earned from run (for local player)
    calculateShards() {
        if (!this.player) return 0;

        // In gear mode, shards are not rewarded (converted to credits instead)
        if (this.gameMode === 'gear') {
            return 0;
        }

        const roomsCleared = Math.max(0, this.roomNumber - 1);
        const enemiesKilled = this.enemiesKilled || 0;
        const levelReached = this.player.level || 1;

        const base = 9 * roomsCleared; // Reduced from 10
        const bonus = 1.8 * enemiesKilled; // Reduced from 2
        const levelBonus = 0.9 * levelReached; // Reduced from 1

        let total = base + bonus + levelBonus;

        // Apply currency boost from room modifiers (Prism Tax) - also affects shards
        if (this.nextRoomModifiers && typeof this.nextRoomModifiers.currencyBoost === 'number' && this.nextRoomModifiers.currencyBoost > 0) {
            total *= (1 + this.nextRoomModifiers.currencyBoost);
            console.log(`[Shards] Applied ${(this.nextRoomModifiers.currencyBoost * 100).toFixed(0)}% boost from Prism Tax`);
        }

        return Math.floor(total);
    },

    // Calculate currency (credits) earned from run
    // In gear mode: includes shard-to-credit conversion (rooms, enemies, level)
    // In card mode: only from elites and bosses
    calculateCurrency() {
        if (!this.player) return 0;

        const elitesKilled = this.elitesKilled || 0;
        const bossesKilled = this.bossesKilled || 0;

        let total = 0;

        if (this.gameMode === 'gear') {
            // In gear mode, convert shard calculation to credits (with reduced scale)
            const roomsCleared = Math.max(0, this.roomNumber - 1);
            const enemiesKilled = this.enemiesKilled || 0;
            const levelReached = this.player.level || 1;

            // Convert shard values to credits with 0.75x scale (a bit less than shards)
            const creditBase = Math.floor(9 * roomsCleared * 0.75); // 6.75 per room
            const creditBonus = Math.floor(1.8 * enemiesKilled * 0.75); // 1.35 per enemy
            const creditLevelBonus = Math.floor(0.9 * levelReached * 0.75); // 0.675 per level

            total = creditBase + creditBonus + creditLevelBonus;

            // Also add elite/boss credits
            const eliteCredits = 15 * elitesKilled;
            const bossCredits = 50 * bossesKilled;
            total += eliteCredits + bossCredits;
        } else {
            // Card mode: Credits only from elites and bosses
            // Elite: 15 credits, Boss: 50 credits
            const eliteCredits = 15 * elitesKilled;
            const bossCredits = 50 * bossesKilled;
            total = eliteCredits + bossCredits;
        }

        // Apply currency boost from room modifiers (Prism Tax)
        if (this.nextRoomModifiers && typeof this.nextRoomModifiers.currencyBoost === 'number' && this.nextRoomModifiers.currencyBoost > 0) {
            total *= (1 + this.nextRoomModifiers.currencyBoost);
            console.log(`[Currency] Applied ${(this.nextRoomModifiers.currencyBoost * 100).toFixed(0)}% boost from Prism Tax`);
        }

        return Math.floor(total);
    },

    // Calculate shards for a specific player (multiplayer)
    calculateShardsForPlayer(playerId) {
        // In gear mode, shards are not rewarded (converted to credits instead)
        if (this.gameMode === 'gear') {
            return 0;
        }

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

        let total = base + bonus + levelBonus;

        // Apply currency boost from room modifiers (Prism Tax) - also affects shards
        if (this.nextRoomModifiers && typeof this.nextRoomModifiers.currencyBoost === 'number' && this.nextRoomModifiers.currencyBoost > 0) {
            total *= (1 + this.nextRoomModifiers.currencyBoost);
        }

        return Math.floor(total);
    },

    // Calculate currency (credits) for a specific player (multiplayer)
    // In gear mode: includes shard-to-credit conversion (rooms, enemies, level)
    // In card mode: only from elites and bosses
    calculateCurrencyForPlayer(playerId) {
        // In multiplayer, all players share the same elite/boss kill count
        const elitesKilled = this.elitesKilled || 0;
        const bossesKilled = this.bossesKilled || 0;

        let total = 0;

        if (this.gameMode === 'gear') {
            // In gear mode, convert shard calculation to credits (with reduced scale)
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

            // Convert shard values to credits with 0.75x scale (a bit less than shards)
            const creditBase = Math.floor(9 * roomsCleared * 0.75); // 6.75 per room
            const creditBonus = Math.floor(1.8 * enemiesKilled * 0.75); // 1.35 per enemy
            const creditLevelBonus = Math.floor(0.9 * levelReached * 0.75); // 0.675 per level

            total = creditBase + creditBonus + creditLevelBonus;

            // Also add elite/boss credits
            const eliteCredits = 15 * elitesKilled;
            const bossCredits = 50 * bossesKilled;
            total += eliteCredits + bossCredits;
        } else {
            // Card mode: Credits only from elites and bosses
            // Elite: 15 credits, Boss: 50 credits
            const eliteCredits = 15 * elitesKilled;
            const bossCredits = 50 * bossesKilled;
            total = eliteCredits + bossCredits;
        }

        // Apply currency boost from room modifiers (Prism Tax)
        if (this.nextRoomModifiers && typeof this.nextRoomModifiers.currencyBoost === 'number' && this.nextRoomModifiers.currencyBoost > 0) {
            total *= (1 + this.nextRoomModifiers.currencyBoost);
        }

        return Math.floor(total);
    },

    // Start game after class selection
    startGame() {
        if (!this.selectedClass) {
            console.error('No class selected');
            return;
        }

        // Initialize based on game mode
        if (this.gameMode === 'cards') {
            // Card system migration and deck initialization
            if (typeof runCardSystemMigration === 'function' && typeof SaveSystem !== 'undefined') {
                runCardSystemMigration(SaveSystem);
            }
            // Check and unlock any cards that meet conditions (including starter cards)
            if (typeof window.checkAchievementUnlocks === 'function') {
                window.checkAchievementUnlocks();
            }
        }

        if (this.gameMode === 'cards' && typeof initializeRunDeck === 'function' && typeof SaveSystem !== 'undefined' && typeof CardCatalog !== 'undefined') {
            const deckCfg = SaveSystem.getDeckConfig ? SaveSystem.getDeckConfig() : { cards: [], size: 20 };
            let cards = Array.isArray(deckCfg.cards) ? deckCfg.cards.slice() : [];
            // Validate deck: ensure at least 10 cards, cap to size
            const sizeLimit = Number.isFinite(deckCfg.size) ? deckCfg.size : 20;
            if (cards.length < 10 && typeof SaveSystem.getCardsUnlocked === 'function') {
                const unlocked = SaveSystem.getCardsUnlocked();
                // Fill with unlocked (prefer starters) up to 10
                const starterOrder = ['precision_001', 'bulwark_001', 'velocity_001'];
                starterOrder.forEach(id => { if (cards.length < 10 && unlocked.includes(id) && !cards.includes(id)) cards.push(id); });
                for (let i = 0; i < unlocked.length && cards.length < 10; i++) {
                    const id = unlocked[i];
                    if (!cards.includes(id)) cards.push(id);
                }
            }
            if (cards.length > sizeLimit) {
                cards = cards.slice(0, sizeLimit);
            }
            // Apply team card selection (basic support for single team card)
            if (Array.isArray(window.DeckState && DeckState.activeTeamCards)) {
                DeckState.activeTeamCards = [];
            }
            const activeTeamCardId = SaveSystem.activeTeamCard || null;
            if (activeTeamCardId && typeof CardCatalog !== 'undefined' && CardCatalog.getById) {
                const def = CardCatalog.getById(activeTeamCardId);
                if (def) {
                    if (typeof DeckState !== 'undefined') {
                        DeckState.activeTeamCards = [def];
                    }
                    // Special-case: Fortune's Favor → global min band of green
                    if ((def.family || '').toLowerCase().includes('fortune') && (def.family || '').toLowerCase().includes('favor')) {
                        this.teamMinBand = 'green';
                    }
                }
            } else {
                this.teamMinBand = null;
            }
            initializeRunDeck(cards);
            const upgrades = SaveSystem.getDeckUpgrades ? SaveSystem.getDeckUpgrades() : { handSize: 4, startingCards: 3 };
            const drawCount = Math.max(0, Math.min(upgrades.startingCards || 3, upgrades.handSize || 4));
            if (drawCount > 0) {
                if (typeof drawStartingHand === 'function') {
                    drawStartingHand(drawCount);
                } else {
                    // Fallback
                    drawCards(drawCount);
                }
            }
            // Mulligan UI if available
            const mulligans = (SaveSystem.getDeckUpgrades ? (SaveSystem.getDeckUpgrades().mulligans || 0) : 0);
            if (mulligans > 0) {
                this.awaitingMulligan = true;
                this.mulliganSelections = [];
                this.mulliganCount = mulligans;
            } else {
                this.awaitingMulligan = false;
                this.mulliganSelections = [];
                this.mulliganCount = 0;
            }
        }

        // Load room modifier inventory from selected modifiers (or use defaults)
        if (typeof SaveSystem !== 'undefined') {
            const save = SaveSystem.load();
            const slots = (SaveSystem.getDeckUpgrades ? (SaveSystem.getDeckUpgrades().roomModifierCarrySlots || 3) : 3);
            // Load selected modifiers into run inventory (or empty array if none selected)
            this.roomModifierInventory = Array.isArray(this.selectedRoomModifiers)
                ? this.selectedRoomModifiers.slice(0, slots)
                : [];
            // Also sync to DeckState for consistency
            if (typeof DeckState !== 'undefined') {
                DeckState.roomModifierInventory = this.roomModifierInventory.slice();
            }
            console.log(`[Game Start] Loaded ${this.roomModifierInventory.length} room modifiers into run inventory`);
        } else {
            this.roomModifierInventory = [];
            if (typeof DeckState !== 'undefined') {
                DeckState.roomModifierInventory = [];
            }
        }

        this.gameOverMusicPlaying = false;

        // Only create a new player if one doesn't exist or if the class doesn't match
        // This preserves the nexus player and its initialized state (including HUD)
        if (!this.player || this.player.playerClass !== this.selectedClass) {
            this.player = createPlayer(this.selectedClass, 100, this.config.height / 2);
            this.player.playerId = this.getLocalPlayerId(); // Set player ID for damage attribution
        } else {
            // Player already exists with correct class, just reset position and HP
            this.player.x = 100;
            this.player.y = this.config.height / 2;
            this.player.hp = this.player.maxHp;
            this.player.dead = false;
            this.player.alive = true;
            this.player.playerId = this.getLocalPlayerId();
        }

        // Initialize class card for this run (card mode only)
        if (this.gameMode === 'cards' && typeof window.initializeClassCard === 'function') {
            window.initializeClassCard(this.selectedClass);
        }

        // Initialize conditional card effects state (card mode only)
        if (this.gameMode === 'cards' && typeof CardEffects !== 'undefined' && CardEffects.initConditionalState) {
            CardEffects.initConditionalState(this.player);
            // Initialize Overcharge timer if player has Overcharge card
            if (typeof DeckState !== 'undefined' && Array.isArray(DeckState.hand)) {
                const condEffects = CardEffects.getConditionalEffects ? CardEffects.getConditionalEffects(DeckState.hand) : null;
                if (condEffects && condEffects.overcharge && this.player._cardEffects) {
                    this.player._cardEffects.overchargeTimer = condEffects.overcharge.interval || 5;
                    this.player._cardEffects.overchargeBurstDamage = condEffects.overcharge.burstDamage || 0.15;
                }
            }
        }

        // Initialize room system
        if (typeof initializeRoom !== 'undefined') {
            initializeRoom(1);
        }

        // Enter playing state before spawning enemies so music starts immediately
        this.state = 'PLAYING';
        this.paused = false;
        this.showPauseMenu = false;
        this.pausedFromState = null;

        // Spawn enemies
        this.spawnEnemies();
        this.updateMusicForCurrentRoom();

        if (typeof Telemetry !== 'undefined') {
            const localPlayerId = this.getLocalPlayerId ? this.getLocalPlayerId() : 'local';
            const runPlayers = this.collectTelemetryParticipants(true);

            Telemetry.startRun({
                mode: this.multiplayerEnabled ? 'multiplayer' : 'singleplayer',
                hostPlayerId: localPlayerId,
                difficulty: this.difficulty || 'default',
                seed: (typeof currentRoom !== 'undefined' && currentRoom && currentRoom.seed) ? currentRoom.seed : null,
                players: runPlayers,
                metadata: {
                    lobbyCode: this.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager
                        ? multiplayerManager.lobbyCode || null
                        : null
                }
            });

            const firstRoomType = (typeof currentRoom !== 'undefined' && currentRoom && currentRoom.type) ? currentRoom.type : 'normal';
            Telemetry.recordRoomEnter(this.roomNumber, firstRoomType, runPlayers);
        }

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
        this.screenShakeDirection = null;
        this.hitPauseTime = 0;
        this.levelUpMessageActive = false;
        this.levelUpMessageTime = 0;

        // Clear ground loot
        if (typeof groundLoot !== 'undefined') {
            groundLoot.length = 0;
        }

        // Clear item pylons (multiplayer)
        if (typeof Game !== 'undefined' && Game.itemPylons && Array.isArray(Game.itemPylons)) {
            Game.itemPylons.length = 0;
        }

        // Clean up multiplayer shadow instances (clients only)
        if (this.remotePlayerShadowInstances) {
            this.remotePlayerShadowInstances.clear();
            console.log('[Client] Cleared shadow instances on game start');
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
        this.gameOverMusicPlaying = false;
        if (typeof audioMenuVisible !== 'undefined') {
            audioMenuVisible = false;
        }
        // Create new player with same class (start at left edge of new larger room)
        const roomHeight = 1350; // New room height
        this.player = createPlayer(this.selectedClass, 100, roomHeight / 2); // Spawn at left edge, vertically centered
        this.player.playerId = this.getLocalPlayerId(); // Set player ID for damage attribution

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
        this.deathScreenStartTime = 0; // Reset death screen timer

        // Initialize per-player stats tracking
        this.initializePlayerStats();

        // Reset screen effects
        this.screenShakeOffset = { x: 0, y: 0 };
        this.screenShakeIntensity = 0;
        this.screenShakeDuration = 0;
        this.screenShakeDirection = null;
        this.hitPauseTime = 0;
        this.levelUpMessageActive = false;
        this.levelUpMessageTime = 0;

        // Clear ground loot
        if (typeof groundLoot !== 'undefined') {
            groundLoot.length = 0;
        }

        // Clear item pylons (multiplayer)
        if (typeof Game !== 'undefined' && Game.itemPylons && Array.isArray(Game.itemPylons)) {
            Game.itemPylons.length = 0;
        }

        // Clear deck/hand state (cleanup from previous run)
        this.cleanupDeckState();

        // Reset room system
        if (typeof initializeRoom !== 'undefined') {
            currentRoom = null;
            // Sync to window for DOM components
            if (typeof window !== 'undefined') {
                window.currentRoom = null;
            }
        }

        // Enter playing state before spawning
        this.state = 'PLAYING';
        this.paused = false;
        this.showPauseMenu = false;
        this.pausedFromState = null;
        this.lastGKeyState = false;
        this.clickHandled = false;

        // Spawn enemies
        this.spawnEnemies();
        this.updateMusicForCurrentRoom();

        if (typeof Telemetry !== 'undefined') {
            const localPlayerId = this.getLocalPlayerId ? this.getLocalPlayerId() : 'local';
            const runPlayers = this.collectTelemetryParticipants(true);

            Telemetry.startRun({
                mode: this.multiplayerEnabled ? 'multiplayer' : 'singleplayer',
                hostPlayerId: localPlayerId,
                difficulty: this.difficulty || 'default',
                seed: (typeof currentRoom !== 'undefined' && currentRoom && currentRoom.seed) ? currentRoom.seed : null,
                players: runPlayers,
                metadata: {
                    lobbyCode: this.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager
                        ? multiplayerManager.lobbyCode || null
                        : null
                }
            });

            const firstRoomType = (typeof currentRoom !== 'undefined' && currentRoom && currentRoom.type) ? currentRoom.type : 'normal';
            Telemetry.recordRoomEnter(this.roomNumber, firstRoomType, runPlayers);
        }

        // Initialize camera position to follow player
        this.initializeCamera();

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
            // Sync to window for DOM components
            if (typeof window !== 'undefined') {
                window.currentRoom = currentRoom;
            }
            this.enemies = currentRoom.enemies;

            // No longer pre-assign targets - proximity detection and damage-based aggro handle targeting

            // Check if this is a boss room and start intro
            if (currentRoom.type === 'boss' && this.enemies.length > 0 && this.enemies[0].isBoss) {
                const boss = this.enemies[0];
                // Start boss intro
                this.startBossIntro(boss);
            }
        }

        this.updateMusicForCurrentRoom();

        console.log(`Room ${this.roomNumber} initialized with ${this.enemies.length} enemies`);
    },

    // Update projectiles
    updateProjectiles(deltaTime) {
        const isMultiplayerClient = this.multiplayerEnabled &&
            typeof multiplayerManager !== 'undefined' &&
            multiplayerManager &&
            !multiplayerManager.isHost;

        this.projectiles = this.projectiles.filter(projectile => {
            // For multiplayer clients, use dead-reckoning with smooth corrections
            if (isMultiplayerClient && projectile.id) {
                // Primary: velocity-based movement (dead-reckoning)
                projectile.x += projectile.vx * deltaTime;
                projectile.y += projectile.vy * deltaTime;

                // Secondary: smooth correction toward authoritative position (if target exists)
                if (projectile.targetX !== undefined && projectile.targetY !== undefined) {
                    const dx = projectile.targetX - projectile.x;
                    const dy = projectile.targetY - projectile.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    // Use larger snap distance for fast projectiles to prevent rewinds
                    const projectileSnapDistance = MultiplayerConfig.SNAP_DISTANCE * 3; // 300px for fast projectiles

                    // Only snap if extremely far (likely a new projectile or major desync)
                    if (distance > projectileSnapDistance) {
                        projectile.x = projectile.targetX;
                        projectile.y = projectile.targetY;
                    } else if (distance > 15) {
                        // Smooth correction for moderate differences (prevents rewinds)
                        // Use slower correction speed for projectiles to avoid visual jumps
                        const correctionSpeed = MultiplayerConfig.BASE_LERP_SPEED * 0.15; // Very slow correction
                        const t = Math.min(1, deltaTime * correctionSpeed);
                        projectile.x += dx * t;
                        projectile.y += dy * t;
                    }
                    // If distance < 15px, don't correct - let velocity handle it
                }
            } else if (isMultiplayerClient && projectile.targetX !== undefined && projectile.targetY !== undefined) {
                // Fallback: use velocity with gentle position correction (if InterpolationManager not available)
                // Primary movement: velocity-based (smooth)
                projectile.x += projectile.vx * deltaTime;
                projectile.y += projectile.vy * deltaTime;

                // Secondary: gentle correction toward authoritative position
                const dx = projectile.targetX - projectile.x;
                const dy = projectile.targetY - projectile.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                // Use larger snap distance for projectiles (they move fast)
                const projectileSnapDistance = MultiplayerConfig.SNAP_DISTANCE * 2; // 200px for fast projectiles

                // If very far, snap (correction or new projectile)
                if (distance > projectileSnapDistance) {
                    projectile.x = projectile.targetX;
                    projectile.y = projectile.targetY;
                } else if (distance > 10) {
                    // Gentle correction when moderately off (increased threshold for projectiles)
                    const correctionSpeed = MultiplayerConfig.BASE_LERP_SPEED * 0.2; // Slower correction for projectiles
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

            // Remove if expired or out of bounds (use room bounds, not canvas bounds)
            const roomWidth = (typeof currentRoom !== 'undefined' && currentRoom) ? currentRoom.width : 2400;
            const roomHeight = (typeof currentRoom !== 'undefined' && currentRoom) ? currentRoom.height : 1350;
            if (projectile.elapsed >= projectile.lifetime) return false;
            if (projectile.x < -50 || projectile.x > roomWidth + 50) return false;
            if (projectile.y < -50 || projectile.y > roomHeight + 50) return false;

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

                            // Precision card bonuses: Apply vulnerability debuff on crit (Orange only)
                            if (typeof CardEffects !== 'undefined' && CardEffects.getConditionalEffects && typeof DeckState !== 'undefined') {
                                const handCards = Array.isArray(DeckState.hand) ? DeckState.hand : [];
                                const condEffects = CardEffects.getConditionalEffects(handCards);
                                if (condEffects.precision && condEffects.precision.vulnOnCrit && typeof enemy.applyDebuff === 'function') {
                                    const vuln = condEffects.precision.vulnOnCrit;
                                    enemy.applyDebuff({
                                        type: 'vulnerability',
                                        multiplier: vuln.multiplier || 0.10,
                                        duration: vuln.duration || 3.0
                                    });
                                }
                            }
                        }

                        // Apply vulnerability debuff multiplier (Precision Orange bonus)
                        if (enemy.vulnerable && enemy.vulnerabilityMultiplier && enemy.vulnerabilityMultiplier > 1.0) {
                            finalDamage *= enemy.vulnerabilityMultiplier;
                        }

                        // Check for shield reflection (Shielded Brood modifier - Purple+)
                        if (enemy.hasShield && enemy.shieldReflects && enemy.shieldHealth > 0) {
                            // Reflect projectile back at player
                            const reflectDamage = finalDamage * 0.75; // 75% of original damage

                            // Create reflected projectile
                            const toPlayerX = shooterPlayer.x - enemy.x;
                            const toPlayerY = shooterPlayer.y - enemy.y;
                            const dist = Math.sqrt(toPlayerX * toPlayerX + toPlayerY * toPlayerY);
                            if (dist > 0) {
                                const reflectVx = (toPlayerX / dist) * 400;
                                const reflectVy = (toPlayerY / dist) * 400;

                                this.projectiles.push({
                                    x: enemy.x,
                                    y: enemy.y,
                                    vx: reflectVx,
                                    vy: reflectVy,
                                    size: projectile.size,
                                    damage: reflectDamage,
                                    type: 'enemy_reflected',
                                    color: '#ff6600',
                                    lifetime: 2.0,
                                    elapsed: 0
                                });

                                // Visual feedback for reflection
                                if (typeof createParticleBurst !== 'undefined') {
                                    createParticleBurst(enemy.x, enemy.y, '#ffaa00', 12);
                                }

                                // Remove original projectile
                                projectilesToRemove.push(index);
                                hitEnemy = true;
                                return; // Skip damage application - shield reflected it
                            }
                        }
                        // If we get here, shield didn't reflect (maybe no shooterPlayer), continue with normal damage

                        // Calculate damage dealt BEFORE applying damage (so enemy.hp is still valid)
                        const damageDealt = Math.min(finalDamage, enemy.hp);

                        // HOST ONLY: Apply damage (clients don't run this code path)
                        enemy.takeDamage(finalDamage, projectileOwnerId);

                        // Precision card bonuses: lifeOnCrit healing (Purple/Orange) - applied after damage dealt
                        if (isCrit && shooterPlayer && typeof CardEffects !== 'undefined' && CardEffects.getConditionalEffects && typeof DeckState !== 'undefined') {
                            const handCards = Array.isArray(DeckState.hand) ? DeckState.hand : [];
                            const condEffects = CardEffects.getConditionalEffects(handCards);
                            if (condEffects.precision && condEffects.precision.lifeOnCrit && condEffects.precision.lifeOnCrit > 0) {
                                // Heal on crit based on damage dealt
                                const healAmount = damageDealt * condEffects.precision.lifeOnCrit;
                                shooterPlayer.hp = Math.min(shooterPlayer.hp + healAmount, shooterPlayer.maxHp);
                                // Visual feedback
                                if (typeof createParticleBurst !== 'undefined') {
                                    createParticleBurst(shooterPlayer.x, shooterPlayer.y, '#00ff00', 8);
                                }
                            }

                            // Fury card bonuses: stunOnCritChance and critExplosion (Purple/Orange)
                            if (condEffects.fury) {
                                // Stun on crit chance (Purple)
                                if (condEffects.fury.stunOnCritChance && condEffects.fury.stunOnCritChance > 0 &&
                                    typeof enemy.applyStun === 'function' && Math.random() < condEffects.fury.stunOnCritChance) {
                                    enemy.applyStun(condEffects.fury.stunDuration || 1.0);
                                }

                                // Crit explosion (Orange) - AoE explosion on crit
                                if (condEffects.fury.critExplosion && condEffects.fury.critExplosion.multiplier &&
                                    typeof createExplosion !== 'undefined' && typeof Game !== 'undefined') {
                                    const explosion = condEffects.fury.critExplosion;
                                    const explosionDamage = damageDealt * explosion.multiplier;
                                    createExplosion(enemy.x, enemy.y, explosion.radius || 90, explosionDamage, shooterPlayer, Game.enemies || []);
                                }
                            }
                        }

                        // Track lifetime damage stat
                        if (typeof window.trackLifetimeStat === 'function') {
                            window.trackLifetimeStat('totalDamageDealt', damageDealt);
                        }

                        if (this.getPlayerStats && projectileOwnerId) {
                            const stats = this.getPlayerStats(projectileOwnerId);
                            if (stats) {
                                stats.addStat('damageDealt', damageDealt);
                            }
                        }

                        // Apply lifesteal if shooter has it
                        if (shooterPlayer && typeof applyLifesteal !== 'undefined') {
                            applyLifesteal(shooterPlayer, damageDealt);
                        }

                        // Apply legendary effects if shooter has them
                        if (shooterPlayer && shooterPlayer.activeLegendaryEffects) {
                            shooterPlayer.activeLegendaryEffects.forEach(effect => {
                                if (effect.type === 'incendiary') {
                                    // Apply burn DoT
                                    if (enemy.applyBurn) {
                                        const burnDPS = finalDamage * effect.burnDPS; // DPS as percentage of damage dealt
                                        enemy.applyBurn(burnDPS, effect.burnDuration, projectileOwnerId);
                                    }
                                } else if (effect.type === 'freezing') {
                                    // Apply slow with chance
                                    if (enemy.applySlow && Math.random() < effect.slowChance) {
                                        enemy.applySlow(effect.slowAmount, effect.slowDuration);
                                    }
                                } else if (effect.type === 'chain_lightning') {
                                    // Apply chain lightning (only once per projectile)
                                    if (!projectile.hasChainedLegendary && typeof chainLightningAttack !== 'undefined') {
                                        chainLightningAttack(shooterPlayer, enemy, effect, finalDamage);
                                        projectile.hasChainedLegendary = true;
                                    }
                                }
                            });
                        }

                        // Damage numbers for player projectiles (rogue knives, mage bolts)
                        if (typeof createDamageNumber !== 'undefined') {
                            createDamageNumber(enemy.x, enemy.y, Math.floor(damageDealt), isCrit, false);
                        }

                        // Multiplayer: Send damage number event to clients
                        if (this.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager) {
                            if (typeof DebugFlags !== 'undefined' && DebugFlags.DAMAGE_NUMBERS) {
                                console.log(`[Host/Projectile] Sending damage_number to clients: enemyId=${enemy.id}, coords=(${enemy.x}, ${enemy.y}), damage=${Math.floor(damageDealt)}, isCrit=${isCrit}`);
                            }

                            multiplayerManager.send({
                                type: 'damage_number',
                                data: {
                                    enemyId: enemy.id,
                                    x: enemy.x,
                                    y: enemy.y,
                                    damage: Math.floor(damageDealt),
                                    isCrit: isCrit,
                                    isWeakPoint: false
                                }
                            });
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
                        // Use item pierce damage percent if available, otherwise default 25% reduction per pierce
                        if (shooterPlayer && shooterPlayer.itemPierceDamagePercent > 0) {
                            // Item pierce: second target takes itemPierceDamagePercent of original damage
                            // Store original damage if not already stored
                            if (!projectile.originalDamage) {
                                projectile.originalDamage = projectile.damage;
                            }
                            projectile.damage = projectile.originalDamage * shooterPlayer.itemPierceDamagePercent;
                        } else {
                            // Default: 25% damage reduction per pierce
                            const damageReduction = 0.25 * enemiesPierced;
                            projectile.damage = projectile.damage * (1 - damageReduction);
                        }
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

                    // Handle reflected projectiles (from shielded enemies)
                    if (projectile.type === 'enemy_reflected') {
                        playersToCheck.forEach(({ id, player: p, isLocal }) => {
                            if (projectileHit) return;

                            if (checkCircleCollision(
                                projectile.x, projectile.y, projectile.size,
                                p.x, p.y, p.size || 20
                            )) {
                                // Hit player with reflected projectile
                                if (isLocal && this.player) {
                                    this.player.takeDamage(projectile.damage);
                                } else if (!isLocal) {
                                    this.damageRemotePlayer(id, projectile.damage);
                                }

                                // Visual feedback
                                if (typeof createParticleBurst !== 'undefined') {
                                    createParticleBurst(projectile.x, projectile.y, '#ff6600', 8);
                                }

                                projectilesToRemove.push(index);
                                projectileHit = true;
                            }
                        });
                        return; // Skip normal enemy projectile handling for reflected projectiles
                    }

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

                                    // Play shield block sound
                                    if (typeof AudioManager !== 'undefined' && AudioManager.sounds) {
                                        AudioManager.sounds.tankShieldHit();
                                    }

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
                            // Check if player is dodging/invulnerable - if so, count as successful dodge
                            if (p.invulnerable || p.isDodging) {
                                // Track successful dodge (projectile would have hit, but player dodged it)
                                // Only track for local player to avoid double-counting in multiplayer
                                if (isLocal && typeof window.trackLifetimeStat === 'function') {
                                    // Use a cooldown to prevent counting the same projectile multiple times
                                    const dodgeTrackKey = `dodge_projectile_${projectile.id || index}_${id}`;
                                    if (!this.projectileDodgeTrackCooldowns) {
                                        this.projectileDodgeTrackCooldowns = new Map();
                                    }
                                    const currentTime = Date.now();
                                    const lastDodgeTrack = this.projectileDodgeTrackCooldowns.get(dodgeTrackKey) || 0;
                                    const damageCooldownMs = 350; // Same cooldown as melee attacks
                                    if (currentTime - lastDodgeTrack >= damageCooldownMs) {
                                        window.trackLifetimeStat('totalDodges', 1);
                                        this.projectileDodgeTrackCooldowns.set(dodgeTrackKey, currentTime);
                                    }
                                }
                                // Skip damage application but remove projectile
                                projectilesToRemove.push(index);
                                projectileHit = true;
                                return; // Skip to next player
                            }

                            // Play projectile hit sound
                            if (typeof AudioManager !== 'undefined' && AudioManager.sounds) {
                                AudioManager.sounds.projectileHit();
                            }

                            // Hit player
                            if (isLocal) {
                                // Local player - apply damage directly
                                this.player.takeDamage(projectile.damage);
                            } else {
                                // Remote player - apply damage to host's state tracking
                                // HP syncs to clients via game_state, not individual damage events
                                this.damageRemotePlayer(id, projectile.damage);
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

                        // Render player name above player
                        let playerName = 'Player';
                        if (typeof multiplayerManager !== 'undefined' && multiplayerManager.players) {
                            const playerData = multiplayerManager.players.find(p => p.id === playerId);
                            if (playerData && playerData.name) {
                                playerName = playerData.name;
                            }
                        }

                        ctx.fillStyle = '#ffffff';
                        ctx.font = 'bold 12px Orbitron';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'bottom';
                        ctx.fillText(playerName, shadowInstance.x, shadowInstance.y - shadowInstance.size - 5);
                    }
                });
            }
        } else if (this.isHost()) {
            // HOST: Render remote player instances directly
            if (this.remotePlayerInstances && this.remotePlayerInstances.size > 0) {
                this.remotePlayerInstances.forEach((playerInstance, playerId) => {
                    if (playerInstance && !playerInstance.dead && playerInstance.alive) {
                        playerInstance.render(ctx);

                        // Render player name above player
                        let playerName = 'Player';
                        if (typeof multiplayerManager !== 'undefined' && multiplayerManager.players) {
                            const playerData = multiplayerManager.players.find(p => p.id === playerId);
                            if (playerData && playerData.name) {
                                playerName = playerData.name;
                            }
                        }

                        ctx.fillStyle = '#ffffff';
                        ctx.font = 'bold 12px Orbitron';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'bottom';
                        ctx.fillText(playerName, playerInstance.x, playerInstance.y - playerInstance.size - 5);
                    }
                });
            }
        } else if (!this.multiplayerEnabled) {
            if (!this.remotePlayers || this.remotePlayers.length === 0) return;

            // Create cached whirlwind gradient if needed
            if (!this.whirlwindGradient) {
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = 120;
                tempCanvas.height = 120;
                const tempCtx = tempCanvas.getContext('2d');
                const radius = 60;
                const gradient = tempCtx.createRadialGradient(60, 60, 0, 60, 60, radius);
                gradient.addColorStop(0, 'rgba(74, 144, 226, 0.4)');
                gradient.addColorStop(1, 'rgba(74, 144, 226, 0)');
                this.whirlwindGradient = { pattern: gradient, radius: radius };
            }

            // Helper to check if remote player is visible
            const isPlayerVisible = (player) => {
                const margin = 100; // Extra margin for effects
                const halfWidth = (this.config.width / 2) / (this.baseZoom || 1) + margin;
                const halfHeight = (this.config.height / 2) / (this.baseZoom || 1) + margin;

                return (
                    player.x >= this.camera.x - halfWidth &&
                    player.x <= this.camera.x + halfWidth &&
                    player.y >= this.camera.y - halfHeight &&
                    player.y <= this.camera.y + halfHeight
                );
            };

            this.remotePlayers.forEach(remotePlayer => {
                if (!remotePlayer || remotePlayer.dead) return;

                // CULLING: Skip if off-screen
                if (!isPlayerVisible(remotePlayer)) return;

                // Get class definition
                const classDef = typeof PLAYER_CLASSES !== 'undefined' && PLAYER_CLASSES[remotePlayer.playerClass]
                    ? PLAYER_CLASSES[remotePlayer.playerClass]
                    : { shape: 'circle', color: '#ff1493' };

                const size = remotePlayer.size || 15;

                // Draw player shape
                ctx.save();
                ctx.translate(remotePlayer.x, remotePlayer.y);

                // Apply rotation if available
                if (typeof remotePlayer.rotation !== 'undefined') {
                    ctx.rotate(remotePlayer.rotation);
                }

                // Draw based on class shape
                if (classDef.shape === 'circle') {
                    ctx.fillStyle = classDef.color;
                    ctx.beginPath();
                    ctx.arc(0, 0, size, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                } else if (classDef.shape === 'triangle') {
                    ctx.fillStyle = classDef.color;
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 2;

                    ctx.beginPath();
                    ctx.moveTo(size, 0);
                    ctx.lineTo(-size / 2, -size);
                    ctx.lineTo(-size / 2, size);
                    ctx.closePath();
                    ctx.fill();
                    ctx.stroke();
                } else if (classDef.shape === 'square') {
                    ctx.fillStyle = classDef.color;
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 2;

                    ctx.beginPath();
                    ctx.rect(-size, -size, size * 2, size * 2);
                    ctx.fill();
                    ctx.stroke();
                } else if (classDef.shape === 'pentagon') {
                    Renderer.polygon(ctx, 0, 0, size, 5, 0, classDef.color);
                } else if (classDef.shape === 'hexagon') {
                    Renderer.polygon(ctx, 0, 0, size, 6, 0, classDef.color);
                }

                ctx.restore();

                // Draw class-specific effects (only if visible)
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
                    // Draw whirlwind effect using cached gradient
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

                // Draw player name above player
                ctx.save();
                ctx.fillStyle = '#ffffff';
                ctx.font = '12px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';

                // Get player name from multiplayer manager
                let playerName = 'Player';
                if (typeof multiplayerManager !== 'undefined' && multiplayerManager.players) {
                    const playerData = multiplayerManager.players.find(p => p.id === remotePlayer.playerId);
                    if (playerData && playerData.name) {
                        playerName = playerData.name;
                    }
                }

                ctx.fillText(playerName, remotePlayer.x, remotePlayer.y - size - 10);
                ctx.restore();

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
                // ctx.font = '12px Orbitron';
                // ctx.textAlign = 'center';
                // ctx.fillText(remotePlayer.name || 'Player', remotePlayer.x, barY - 5);
            });
        }
    }
};

// Start the game when page loads
window.addEventListener('load', () => {
    Game.init();
});

// Debug console commands
window.toggleEnemyStealth = function () {
    Game.enemyStealthMode = !Game.enemyStealthMode;
    console.log(`Enemy Stealth Mode: ${Game.enemyStealthMode ? 'ON (enemies hidden)' : 'OFF (enemies visible)'}`);
    return `Enemy stealth mode ${Game.enemyStealthMode ? 'enabled' : 'disabled'}`;
};

console.log('%cDebug Commands Available:', 'color: #00ff00; font-weight: bold;');
console.log('%c  toggleEnemyStealth() - Toggle enemy glow and vignette lights', 'color: #00aaff;');

