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
    state: 'NEXUS', // 'NEXUS', 'PLAYING', 'PAUSED', 'ENTERING_ROOM'
    paused: false,
    pausedFromState: null, // Track where we paused from ('PLAYING' or 'NEXUS')
    showPauseMenu: false, // Visual pause menu flag (for multiplayer - doesn't pause game)
    roomEnterTransition: null,
    nexusPrewarm: null,
    nexusPrewarmComplete: false,
    lastTime: 0,
    gameOverMusicPlaying: false,

    // Fixed timestep variables
    accumulator: 0, // Accumulated real time for fixed timestep updates
    fixedTimestep: 1 / 60, // 60 Hz fixed timestep (0.016666... seconds)
    maxCatchupUpdates: 5, // Maximum fixed updates per frame to prevent stuttering
    accumulatorTruncateThreshold: 0.1, // Drop catch-up after severe stalls to avoid spiral of death
    frameRenderTimings: null,
    currentFrameTimings: null,
    lastAccumulatorTruncated: false,
    frameBudgetSamples: [],
    renderQuality: {
        vignetteScale: 0.5,
        maxSceneryLights: Infinity,
        gearRingPoints: 64,
        groundLootAnimatedRing: true,
        remoteFullRender: true,
        maxBeamLights: 8,
        damageFxScale: 1
    },
    renderSubTimings: { groundLoot: 0, gearRings: 0, remotePlayers: 0, worldGlow: 0, worldBodies: 0 },
    renderSubTimingSamples: null,
    debugFrameBudget: { frameAvg: 0, renderAvg: 0 },

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

    // Game mode: 'gear' (default)
    gameMode: 'gear',

    // Currency system
    currentCurrency: 0,
    currencyEarned: 0, // Credits earned this run (display + bookkeeping)
    currencyBankedThisRun: 0, // Credits already written to SaveSystem mid-run
    shardsEarned: 0, // Shards earned from current run (meta; banked at run end)
    rewardsCredited: false,

    ELITE_CREDIT_REWARD: 15,
    BOSS_CREDIT_REWARD: 50,

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
    projectiles: (typeof createProjectileList === 'function' ? createProjectileList() : []),
    _projectilePool: [],
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
    itemsDroppedThisRoom: 0, // Track items dropped in current room for balancing

    // Per-player stats tracking (new system)
    playerStats: new Map(), // Map<playerId, PlayerStats>
    deadPlayers: new Set(), // Set of dead player IDs
    disconnectedPlayerIds: new Set(), // Mid-run disconnect (lobby seat kept until kick)
    disconnectedRunSnapshots: new Map(), // Map<playerId, serialized run state for rejoin>
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
    playerSafeRoomMeta: new Map(), // Map<playerId, safe-room gearUpgrades blob>

    // Safe room visit flag (true while inside a safe room)
    inSafeRoom: false,
    enteringSafeRoom: false,
    // True after any Safe Room machine transaction this visit (locks Save Run)
    safeRoomUsedThisVisit: false,
    // Skip safe-room +50% soft heal once after resume (snapshot HP wins)
    resumeSkipSafeSoftHeal: false,

    // Door waiting state (for multiplayer)
    playersOnDoor: [], // Array of player IDs currently on door
    totalAlivePlayers: 0, // Total number of alive players

    // Screen shake system
    screenShakeOffset: { x: 0, y: 0 },
    screenShakeIntensity: 0,
    screenShakeDuration: 0,
    screenShakeDirection: null, // 'player' for vertical bias, 'boss' for horizontal bias, null for omnidirectional
    hitPauseTime: 0, // Brief gameplay freeze on player heavy attacks only

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
    pseudoFullscreenActive: false,

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

        this.ctx = this.canvas.getContext('2d');

        // Set internal canvas dimensions (game resolution)
        this.canvas.width = this.config.width;
        this.canvas.height = this.config.height;

        // Setup responsive scaling
        this.setupResponsiveCanvas();
        this.prewarmRenderCaches();

        // Initialize input system
        Input.init(this.canvas);

        // Load fullscreen preference
        if (typeof SaveSystem !== 'undefined') {
            this.fullscreenEnabled = SaveSystem.getFullscreenPreference();
        }

        // Setup fullscreen API event listeners
        this.setupFullscreenListeners();

        if (this.fullscreenEnabled &&
            typeof DeviceDetection !== 'undefined' &&
            DeviceDetection.supportsElementFullscreen &&
            !DeviceDetection.supportsElementFullscreen()) {
            this.pseudoFullscreenActive = true;
            document.body.classList.add('pseudo-fullscreen');
        }

        // Handle window resize
        const handleResize = () => {
            this.setupResponsiveCanvas();
            // Force a reflow to ensure bounding rect is updated
            if (this.canvas) {
                void this.canvas.offsetWidth;
            }
            // Reinitialize touch controls with new canvas size after a brief delay
            if (typeof Input !== 'undefined' && Input.isMobileUiMode && Input.isMobileUiMode()) {
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
                if (typeof Input !== 'undefined' && Input.isMobileUiMode && Input.isMobileUiMode()) {
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

            const hasAcknowledgedPrivacy = SaveSystem.hasAcknowledgedPrivacy ? SaveSystem.hasAcknowledgedPrivacy() : true;
            if (!hasAcknowledgedPrivacy) {
                this.openPrivacyModal('onboarding');
            } else if (typeof Onboarding !== 'undefined' && Onboarding.getStep && Onboarding.getStep() === Onboarding.STEPS.CONTROLS) {
                this.launchModalVisible = true;
            } else if (!SaveSystem.getHasSeenLaunchModal()) {
                this.launchModalVisible = true;
            }

            // Patch notes: returning players only. New saves get a quiet version stamp.
            if (typeof SaveSystem.stampCurrentVersionIfNew === 'function') {
                SaveSystem.stampCurrentVersionIfNew();
            }
            if (SaveSystem.shouldShowUpdateModal()) {
                if (typeof Onboarding !== 'undefined' && !Onboarding.isComplete()) {
                    Onboarding.deferUpdateModal();
                } else if (typeof FeatureTutorials !== 'undefined'
                    && FeatureTutorials.isSpotlightActive
                    && FeatureTutorials.isSpotlightActive()) {
                    if (typeof Onboarding !== 'undefined' && Onboarding.deferUpdateModal) {
                        Onboarding.deferUpdateModal();
                    } else {
                        this.updateModalVisible = false;
                    }
                } else {
                    this.updateModalVisible = true;
                }
            }

            if (typeof Onboarding !== 'undefined' && Onboarding.onNexusEnter) {
                // Delay until nexus is ready; boot may still be initializing
                setTimeout(() => {
                    Onboarding.onNexusEnter();
                    if (typeof FeatureTutorials !== 'undefined' && FeatureTutorials.onNexusEnter) {
                        FeatureTutorials.onNexusEnter();
                    }
                }, 0);
            } else if (typeof FeatureTutorials !== 'undefined' && FeatureTutorials.onNexusEnter) {
                setTimeout(() => FeatureTutorials.onNexusEnter(), 0);
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
            if (target && typeof isFormFieldTarget === 'function' && isFormFieldTarget(target)) {
                return;
            }

            // Handle boss intro skip
            if (this.bossIntroActive && this.bossIntroData && this.bossIntroData.skipAvailable) {
                this.skipBossIntro();
                return;
            }

            if (e.key === 'Escape') {
                // Forced first-run onboarding: Esc cannot dismiss privacy/controls steps
                if (typeof Onboarding !== 'undefined' && Onboarding.isForcedModalActive && Onboarding.isForcedModalActive()) {
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

                // Close Safe Room upgrades first if visible
                if (typeof window !== 'undefined' && window.SafeRoomMenu && window.SafeRoomMenu.isOpen) {
                    if (typeof window.toggleSafeRoomMachine === 'function') {
                        window.toggleSafeRoomMachine(false);
                        e.preventDefault();
                        return;
                    }
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
                    // Close gear upgrade modal
                    if (typeof window !== 'undefined' && window.GearUpgradeMenu && window.GearUpgradeMenu.isOpen) {
                        if (typeof window.toggleGearUpgrades === 'function') {
                            window.toggleGearUpgrades(false);
                            e.preventDefault();
                            return;
                        }
                    }

                    // Close room modifier selection modal
                    if (this.showingRoomModifierSelection) {
                        this.showingRoomModifierSelection = false;
                        e.preventDefault();
                        return;
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
                    // Pause-menu "How to Play" can still close with Esc; first-run uses Got it
                    if (typeof Onboarding !== 'undefined' && Onboarding.getStep
                        && Onboarding.getStep() === Onboarding.STEPS.CONTROLS
                        && !Onboarding.isSuspended()) {
                        e.preventDefault();
                        return;
                    }
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
            if (e.key === ' ') {
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

        // Detect the active UI layout FIRST (before using it in viewport calculation)
        const isMobileDevice = typeof Input !== 'undefined' && Input.isMobileUiMode
            ? Input.isMobileUiMode()
            : (typeof Input !== 'undefined' && Input.isMobileDevice && Input.isMobileDevice());
        this.isMobileDevice = isMobileDevice;

        // Use visualViewport when available (accurate on mobile Safari + desktop)
        const viewport = this.getViewportSize();
        const isFullscreen = this.isFullscreenActive();
        const availableWidth = viewport.width;
        const availableHeight = viewport.height;

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

        // High DPI Support - cap at 2x, never force upscale on 1x displays
        const deviceDpr = window.devicePixelRatio || 1;
        const dpr = Math.min(2, Math.max(1, deviceDpr));
        this.dpr = dpr; // Store for use in other rendering methods

        // Set canvas resolution (internal rendering size) scaled by DPR
        this.canvas.width = canvasWidth * dpr;
        this.canvas.height = canvasHeight * dpr;

        // Set CSS size to match logical canvas size exactly (1:1, no stretching)
        // This ensures canvas fills viewport without distortion
        this.canvas.style.width = canvasWidth + 'px';
        this.canvas.style.height = canvasHeight + 'px';
        this.canvas.style.maxWidth = '100vw';
        this.canvas.style.maxHeight = (typeof CSS !== 'undefined' && CSS.supports && CSS.supports('height', '100dvh'))
            ? '100dvh'
            : '100vh';
        this.canvas.style.position = 'fixed';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.margin = '0';
        this.canvas.style.padding = '0';

        // Scale the context so drawing commands use logical pixels
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
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
        if (typeof Input !== 'undefined' && Input.isMobileUiMode && Input.isMobileUiMode()) {
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

    getViewportSize() {
        if (typeof window !== 'undefined' && window.visualViewport) {
            return {
                width: window.visualViewport.width,
                height: window.visualViewport.height
            };
        }
        return {
            width: typeof window !== 'undefined' ? window.innerWidth : 0,
            height: typeof window !== 'undefined' ? window.innerHeight : 0
        };
    },

    isNativeFullscreenActive() {
        return !!(document.fullscreenElement ||
            document.webkitFullscreenElement ||
            document.mozFullScreenElement);
    },

    isFullscreenActive() {
        return this.isNativeFullscreenActive() || !!this.pseudoFullscreenActive;
    },

    // Setup fullscreen API listeners
    setupFullscreenListeners() {
        // Listen for fullscreen changes
        const fullscreenChange = () => {
            const isFullscreen = this.isNativeFullscreenActive();
            this.fullscreenEnabled = isFullscreen || !!this.pseudoFullscreenActive;

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

                        if (typeof Input !== 'undefined' && Input.isMobileUiMode && Input.isMobileUiMode()) {
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
    },

    // Toggle fullscreen
    toggleFullscreen() {
        if (!this.canvas) return;

        if (typeof DeviceDetection !== 'undefined' &&
            DeviceDetection.supportsElementFullscreen &&
            !DeviceDetection.supportsElementFullscreen()) {
            this.pseudoFullscreenActive = !this.pseudoFullscreenActive;
            document.body.classList.toggle('pseudo-fullscreen', this.pseudoFullscreenActive);
            this.fullscreenEnabled = this.pseudoFullscreenActive;
            this.setupResponsiveCanvas();
            if (typeof SaveSystem !== 'undefined') {
                SaveSystem.setFullscreenPreference(this.fullscreenEnabled);
            }
            if (typeof window.showToast === 'function') {
                const msg = this.pseudoFullscreenActive
                    ? 'Expanded to screen - add to Home Screen for true fullscreen on iOS'
                    : 'Exited expanded view';
                window.showToast(msg, 2500);
            }
            return;
        }

        const isFullscreen = this.isNativeFullscreenActive();

        if (isFullscreen) {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.mozCancelFullScreen) {
                document.mozCancelFullScreen();
            }
        } else {
            const element = document.documentElement;
            if (element.requestFullscreen) {
                element.requestFullscreen();
            } else if (element.webkitRequestFullscreen) {
                element.webkitRequestFullscreen();
            } else if (element.mozRequestFullScreen) {
                element.mozRequestFullScreen();
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
        } else if (!isHidden) {
            this.backgroundPauseActive = false;
            if (this.autoPausedForBackground && this.state === 'PAUSED') {
                this.autoPausedForBackground = false;
                this.togglePause();
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

        // Accumulate real time for fixed timestep updates. Severe spikes are truncated
        // so the browser does not lock up trying to run many catch-up updates.
        this.lastAccumulatorTruncated = realDeltaTime > (this.accumulatorTruncateThreshold || 0.1);
        if (this.lastAccumulatorTruncated) {
            this.accumulator = 0;
        } else {
            this.accumulator += cappedRealDeltaTime;
        }

        // Measure CPU process time
        const processStart = performance.now();
        let updateTime = 0;

        // Hit pause: freeze gameplay sim only - VFX/particles keep moving so it reads as impact, not lag
        if (this.hitPauseTime > 0) {
            this.hitPauseTime -= cappedRealDeltaTime;
            if (this.hitPauseTime <= 0) {
                this.hitPauseTime = 0;
            }

            const juiceDt = Math.min(cappedRealDeltaTime, this.fixedTimestep);
            if (typeof updateVoxelParticles === 'function') {
                updateVoxelParticles(juiceDt);
            }
            this.updateScreenShake(juiceDt);
            if (typeof updateDamageNumbers === 'function') {
                updateDamageNumbers(juiceDt);
            }

            this.render();

            if (this.useSetTimeoutLoop) {
                this.timeoutId = setTimeout(() => this.gameLoop(performance.now()), 1000 / 60);
            } else {
                requestAnimationFrame((time) => this.gameLoop(time));
            }
            return;
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
            const updateStart = performance.now();
            if (this.state === 'PLAYING') {
                this.update(this.fixedTimestep);
            } else if (this.state === 'ENTERING_ROOM') {
                this.updateRoomEnterTransition();
            } else if (this.state === 'NEXUS') {
                if (typeof updateNexus !== 'undefined') {
                    updateNexus(this.ctx, this.fixedTimestep);
                }
                this.tickNexusPrewarm();
            }
            if (typeof updateVoxelParticles === 'function') {
                updateVoxelParticles(this.fixedTimestep);
            }
            updateTime += performance.now() - updateStart;
            this.accumulator -= this.fixedTimestep;
            updatesRun++;
        }

        // Note: In multiplayer, showPauseMenu doesn't stop updates - game continues running

        // Render once per frame (variable rate, smooth visuals)
        const renderStart = performance.now();
        this.currentFrameTimings = {
            static: 0,
            world: 0,
            worldGlow: 0,
            worldBodies: 0,
            vignette: 0,
            postFx: 0,
            ui: 0
        };
        this.render();
        const renderTime = performance.now() - renderStart;
        const renderTimings = this.currentFrameTimings || {};
        this.frameRenderTimings = Object.assign({}, renderTimings, {
            update: updateTime,
            render: renderTime,
            catchupUpdates: updatesRun,
            accumulatorMs: this.accumulator * 1000,
            accumulatorTruncated: this.lastAccumulatorTruncated,
            snapshot: typeof this.buildDebugMetricsSnapshot === 'function' ? this.buildDebugMetricsSnapshot() : null
        });
        this.updateFrameBudgetGovernor(realDeltaTime * 1000, renderTime);

        const processEnd = performance.now();
        const processTime = processEnd - processStart;

        // Update debug panel metrics with actual CPU time and frame time
        if (typeof DebugPanel !== 'undefined') {
            DebugPanel.update(realDeltaTime, processTime, this.frameRenderTimings);
        }

        if (typeof RunProfiler !== 'undefined' && RunProfiler.isActive()) {
            RunProfiler.recordFrame(realDeltaTime, processTime, this.frameRenderTimings, {
                state: this.state,
                roomNumber: this.roomNumber,
                catchupUpdates: updatesRun,
                accumulatorTruncated: this.lastAccumulatorTruncated
            });
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
        const shouldReplace = this.screenShakeDuration <= 0 || intensity >= this.screenShakeIntensity;
        if (shouldReplace) {
            this.screenShakeIntensity = intensity;
            this.screenShakeDuration = duration;
            this.screenShakeDirection = direction; // 'player' or 'boss' for directional bias
        } else {
            // Preserve stronger shake; briefly extend for follow-up hits
            this.screenShakeDuration = Math.max(this.screenShakeDuration, duration * 0.45);
        }
    },

    triggerChromaticTrauma(frames = 5, intensity = 0.75) {
        const now = performance.now();
        const duration = Math.max(1, frames) * (1000 / 60);
        this.chromaticTraumaStart = now;
        this.chromaticTraumaDuration = duration;
        this.chromaticTraumaUntil = now + duration;
        this.chromaticTraumaIntensity = Math.max(0, Math.min(1, intensity));
    },

    getDamageTraumaParams(playerToCheck, nowSec, traumaNowMs, damageTraumaDuration) {
        const params = { intensity: 0, offset: 0, damagePercentage: 0, active: false };
        const minHitRatioForCa = 0.03;

        if (playerToCheck && playerToCheck.lastDamageTime) {
            const elapsed = nowSec - playerToCheck.lastDamageTime;
            if (elapsed >= 0 && elapsed < damageTraumaDuration) {
                const hitRatio = playerToCheck.maxHp > 0 && playerToCheck.lastDamageAmount > 0
                    ? playerToCheck.lastDamageAmount / playerToCheck.maxHp
                    : 0;
                if (hitRatio >= minHitRatioForCa) {
                    const progress = Math.min(elapsed / damageTraumaDuration, 1.0);
                    params.intensity = Math.max(params.intensity, 1.0 - progress);
                    const normalizedDamage = Math.min(hitRatio / 0.45, 1.0);
                    params.damagePercentage = Math.max(params.damagePercentage, 0.1 + 0.9 * normalizedDamage);
                    params.active = true;
                }
            }
        }

        if (this.chromaticTraumaUntil && traumaNowMs < this.chromaticTraumaUntil) {
            const traumaElapsed = traumaNowMs - (this.chromaticTraumaStart || traumaNowMs);
            const traumaDuration = Math.max(1, this.chromaticTraumaDuration || (5 * 1000 / 60));
            const traumaProgress = Math.min(traumaElapsed / traumaDuration, 1.0);
            const traumaIntensity = (1.0 - traumaProgress) * (this.chromaticTraumaIntensity || 0.75);
            params.intensity = Math.max(params.intensity, traumaIntensity);
            params.damagePercentage = Math.max(params.damagePercentage, 0.45 * (this.chromaticTraumaIntensity || 0.75));
            params.active = true;
        }

        if (!params.active || params.intensity <= 0) {
            return params;
        }

        const baseMaxOffset = 2;
        const maxMaxOffset = 16;
        const maxOffset = baseMaxOffset + (maxMaxOffset - baseMaxOffset) * params.damagePercentage;
        const easeIntensity = params.intensity * (2 - params.intensity);
        params.offset = maxOffset * easeIntensity;
        return params;
    },

    ensureWorldRenderTarget(pixelWidth, pixelHeight, dpr) {
        if (!this.offscreenCanvas) {
            this.offscreenCanvas = document.createElement('canvas');
            this.offscreenCtx = this.offscreenCanvas.getContext('2d');
        }
        if (this.offscreenCanvas.width !== pixelWidth || this.offscreenCanvas.height !== pixelHeight) {
            this.offscreenCanvas.width = pixelWidth;
            this.offscreenCanvas.height = pixelHeight;
            this.offscreenCtx.setTransform(1, 0, 0, 1, 0, 0);
            this.offscreenCtx.scale(dpr, dpr);
        }
        return this.offscreenCtx;
    },

    ensureChannelBuffer(logicalWidth, logicalHeight, pixelWidth, pixelHeight, dpr, processScale) {
        const scaledPixelW = Math.max(1, Math.floor(pixelWidth * processScale));
        const scaledPixelH = Math.max(1, Math.floor(pixelHeight * processScale));
        if (!this.channelCanvas) {
            this.channelCanvas = document.createElement('canvas');
            this.channelCtx = this.channelCanvas.getContext('2d');
        }
        if (this.channelCanvas.width !== scaledPixelW || this.channelCanvas.height !== scaledPixelH) {
            this.channelCanvas.width = scaledPixelW;
            this.channelCanvas.height = scaledPixelH;
        }
        this.channelCtx.setTransform(1, 0, 0, 1, 0, 0);
        this.channelCtx.scale(dpr * processScale, dpr * processScale);
        return this.channelCtx;
    },

    renderPlayingWorldLayer(ctx) {
        const logicalWidth = this.config.width;
        const logicalHeight = this.config.height;
        const biome = typeof getBiomeForRoom !== 'undefined' ? getBiomeForRoom(this.roomNumber) : { baseColor: '#1a1a2e' };
        Renderer.clear(ctx, logicalWidth, logicalHeight, biome.baseColor);

        ctx.save();
        const isMobile = typeof Input !== 'undefined' && Input.isMobileUiMode && Input.isMobileUiMode();
        const currentZoom = isMobile ? (this.mobileZoom || 1.0) : (this.baseZoom);
        const centerX = logicalWidth / 2;
        const centerY = logicalHeight / 2;
        ctx.translate(centerX + this.screenShakeOffset.x, centerY + this.screenShakeOffset.y);
        ctx.scale(currentZoom, currentZoom);
        ctx.translate(-this.camera.x, -this.camera.y);

        // Draw solid outer-wall fill for safe rooms so non-traversable space is clearly blocked
        if (typeof currentRoom !== 'undefined' && currentRoom && currentRoom.type === 'safe') {
            const rw = currentRoom.width || 2400;
            const rh = currentRoom.height || 1350;
            const wallPad = 2400; // extend far beyond room edges
            ctx.save();
            ctx.fillStyle = 'rgba(10, 14, 20, 0.96)';
            // Fill four side bands around the room
            ctx.fillRect(-wallPad, -wallPad, rw + wallPad * 2, wallPad);           // top
            ctx.fillRect(-wallPad, rh, rw + wallPad * 2, wallPad);                 // bottom
            ctx.fillRect(-wallPad, 0, wallPad, rh);                                // left
            ctx.fillRect(rw, 0, wallPad, rh);                                      // right
            // Add a subtle inset border/bevel at room edge
            ctx.strokeStyle = 'rgba(50, 90, 70, 0.55)';
            ctx.lineWidth = 8;
            ctx.strokeRect(-4, -4, rw + 8, rh + 8);
            ctx.restore();
        }

        const staticStart = performance.now();
        if (typeof renderCachedRoomStaticLayer === 'function' && renderCachedRoomStaticLayer(ctx, this.roomNumber)) {
            if (typeof renderRoomAmbientLife === 'function') {
                renderRoomAmbientLife(ctx, this.roomNumber);
            }
        } else {
            if (typeof renderRoomBackground !== 'undefined') {
                renderRoomBackground(ctx, this.roomNumber);
            }
            if (typeof renderRoomBoundaries !== 'undefined') {
                renderRoomBoundaries(ctx, this.roomNumber);
            }
            if (typeof renderRoomObstacles !== 'undefined') {
                renderRoomObstacles(ctx, this.roomNumber);
            }
        }
        this.currentFrameTimings.static += performance.now() - staticStart;

        if (typeof DebugFlags !== 'undefined' && DebugFlags.ROOM_LAYOUT && typeof renderRoomLayoutDebug !== 'undefined') {
            renderRoomLayoutDebug(ctx);
        }

        const worldStart = performance.now();
        this.renderGameWorld(ctx);
        if (typeof Room0Tutorial !== 'undefined' && Room0Tutorial.renderWorld) {
            Room0Tutorial.renderWorld(ctx);
        }
        this.currentFrameTimings.world += performance.now() - worldStart;
        ctx.restore();
    },

    applyChromaticAberrationFromOffscreen(traumaParams) {
        const dpr = this.dpr || 1;
        const logicalWidth = this.config.width;
        const logicalHeight = this.config.height;
        const pixelWidth = logicalWidth * dpr;
        const pixelHeight = logicalHeight * dpr;
        const adaptiveEnabled = typeof DebugFlags === 'undefined' || DebugFlags.ADAPTIVE_RENDER_QUALITY !== false;
        const processScale = adaptiveEnabled && this.renderQuality && this.renderQuality.damageFxScale
            ? this.renderQuality.damageFxScale
            : 1;

        const channelCtx = this.ensureChannelBuffer(
            logicalWidth, logicalHeight, pixelWidth, pixelHeight, dpr, processScale
        );
        const intensity = traumaParams.intensity;
        const offset = traumaParams.offset * processScale;

        this.ctx.clearRect(0, 0, logicalWidth, logicalHeight);

        if (intensity < 0.18) {
            this.ctx.drawImage(this.offscreenCanvas, 0, 0, logicalWidth, logicalHeight);
            return;
        }

        this.ctx.drawImage(this.offscreenCanvas, 0, 0, logicalWidth, logicalHeight);
        this.ctx.globalCompositeOperation = 'lighter';
        this.ctx.globalAlpha = intensity;

        const drawTintedChannel = (color, xOffset) => {
            channelCtx.globalCompositeOperation = 'copy';
            channelCtx.drawImage(this.offscreenCanvas, 0, 0, logicalWidth, logicalHeight);
            channelCtx.globalCompositeOperation = 'multiply';
            channelCtx.fillStyle = color;
            channelCtx.fillRect(0, 0, logicalWidth, logicalHeight);
            this.ctx.drawImage(this.channelCanvas, xOffset, 0, logicalWidth, logicalHeight);
        };

        drawTintedChannel('#FF0000', -offset);
        drawTintedChannel('#0000FF', offset);

        this.ctx.globalAlpha = 1;
        this.ctx.globalCompositeOperation = 'source-over';
    },

    // Trigger hit pause (player heavy attacks only - keep short, never stack)
    triggerHitPause(duration = 0.1) {
        const capped = Math.min(duration, 0.045);
        if (this.hitPauseTime <= 0) {
            this.hitPauseTime = capped;
        } else {
            this.hitPauseTime = Math.min(this.hitPauseTime + capped * 0.2, 0.045);
        }
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

        // Room 0 exit-door coach: bias camera toward the open door
        if (typeof Room0Tutorial !== 'undefined'
            && Room0Tutorial.getCameraOverride
            && Room0Tutorial.isExitCoachActive
            && Room0Tutorial.isExitCoachActive()) {
            const override = Room0Tutorial.getCameraOverride();
            if (override && Number.isFinite(override.x) && Number.isFinite(override.y)) {
                this.camera.targetX = override.x;
                this.camera.targetY = override.y;
                const lerpFactor = 1 - Math.exp(-this.camera.smoothSpeed * deltaTime);
                this.camera.x += (this.camera.targetX - this.camera.x) * lerpFactor;
                this.camera.y += (this.camera.targetY - this.camera.y) * lerpFactor;
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
        // Local predicted player: include decaying reconcile correction so camera doesn't pop
        let followX = targetPlayer.x;
        let followY = targetPlayer.y;
        if (targetPlayer === this.player && typeof targetPlayer.getPredictedRenderPosition === 'function') {
            const rp = targetPlayer.getPredictedRenderPosition();
            followX = rp.x;
            followY = rp.y;
        }
        this.camera.targetX = followX + this.camera.offsetX;
        this.camera.targetY = followY + this.camera.offsetY;

        // Clamp camera to room boundaries (prevent showing outside room)
        // Account for zoom - with zoom, we see less world space, so bounds are tighter
        if (typeof currentRoom !== 'undefined' && currentRoom) {
            const isMobile = typeof Input !== 'undefined' && Input.isMobileUiMode && Input.isMobileUiMode();
            const currentZoom = isMobile ? (this.mobileZoom || 1.0) : this.baseZoom;

            // Visible world space is smaller when zoomed
            const halfVisibleWorldW = (this.config.width / 2) / currentZoom;
            const halfVisibleWorldH = (this.config.height / 2) / currentZoom;

            // If the room is smaller than the viewport on an axis, center on that axis
            // (avoids asymmetric side/top buffers from inverted clamp bounds)
            if (currentRoom.width <= halfVisibleWorldW * 2) {
                this.camera.targetX = currentRoom.width / 2;
            } else {
                this.camera.targetX = Math.max(halfVisibleWorldW, Math.min(currentRoom.width - halfVisibleWorldW, this.camera.targetX));
            }
            if (currentRoom.height <= halfVisibleWorldH * 2) {
                this.camera.targetY = currentRoom.height / 2;
            } else {
                this.camera.targetY = Math.max(halfVisibleWorldH, Math.min(currentRoom.height - halfVisibleWorldH, this.camera.targetY));
            }
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

        // Onboarding spotlight: lock camera to cutout center so the hole cannot scroll off-screen
        let camOverride = (typeof Onboarding !== 'undefined' && Onboarding.getCameraOverride)
            ? Onboarding.getCameraOverride()
            : null;
        if (!camOverride && typeof FeatureTutorials !== 'undefined' && FeatureTutorials.getCameraOverride) {
            camOverride = FeatureTutorials.getCameraOverride();
        }
        if (camOverride) {
            this.nexusCamera.targetX = camOverride.x;
            this.nexusCamera.targetY = camOverride.y;
        } else {
            // Target camera on player position
            this.nexusCamera.targetX = this.player.x;
            this.nexusCamera.targetY = this.player.y;
        }

        // Clamp to nexus boundaries (account for zoom)
        const isMobile = typeof Input !== 'undefined' && Input.isMobileUiMode && Input.isMobileUiMode();
        const currentZoom = isMobile ? (this.mobileZoom || 1.0) : this.baseZoom;

        // Visible world space is smaller when zoomed
        const halfVisibleWorldW = (this.config.width / 2) / currentZoom;
        const halfVisibleWorldH = (this.config.height / 2) / currentZoom;

        if (nexusRoom.width <= halfVisibleWorldW * 2) {
            this.nexusCamera.targetX = nexusRoom.width / 2;
        } else {
            this.nexusCamera.targetX = Math.max(halfVisibleWorldW, Math.min(nexusRoom.width - halfVisibleWorldW, this.nexusCamera.targetX));
        }
        if (nexusRoom.height <= halfVisibleWorldH * 2) {
            this.nexusCamera.targetY = nexusRoom.height / 2;
        } else {
            this.nexusCamera.targetY = Math.max(halfVisibleWorldH, Math.min(nexusRoom.height - halfVisibleWorldH, this.nexusCamera.targetY));
        }

        // Smooth lerp toward target
        const lerpFactor = 1 - Math.exp(-this.nexusCamera.smoothSpeed * deltaTime);
        this.nexusCamera.x += (this.nexusCamera.targetX - this.nexusCamera.x) * lerpFactor;
        this.nexusCamera.y += (this.nexusCamera.targetY - this.nexusCamera.y) * lerpFactor;
    },

    // Initialize nexus camera
    initializeNexusCamera() {
        let camOverride = (typeof Onboarding !== 'undefined' && Onboarding.getCameraOverride)
            ? Onboarding.getCameraOverride()
            : null;
        if (!camOverride && typeof FeatureTutorials !== 'undefined' && FeatureTutorials.getCameraOverride) {
            camOverride = FeatureTutorials.getCameraOverride();
        }
        if (camOverride) {
            this.nexusCamera.x = camOverride.x;
            this.nexusCamera.y = camOverride.y;
            this.nexusCamera.targetX = camOverride.x;
            this.nexusCamera.targetY = camOverride.y;
        } else if (this.player) {
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
        this.privacyModalContext = context;
        this.privacyModalVisible = true;
        this.privacyModalReturnToPause = context === 'pause';
        this.privacyModalPreviousShowPauseMenu = this.showPauseMenu;
        if (this.privacyModalReturnToPause && this.showPauseMenu) {
            this.showPauseMenu = false;
        }
    },

    closePrivacyModal() {
        // Forced first-run privacy: closing without Opt In/Out is not allowed
        if (typeof Onboarding !== 'undefined'
            && Onboarding.getStep
            && Onboarding.getStep() === Onboarding.STEPS.PRIVACY
            && this.privacyModalContext === 'onboarding') {
            return;
        }
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
        // Force-close after ack (privacy step is done; do not use the blocked close path)
        this.privacyModalVisible = false;
        this.privacyModalReturnToPause = false;
        this.privacyModalContext = 'onboarding';
        this.privacyModalPreviousShowPauseMenu = false;
        if (context === 'onboarding') {
            if (typeof Onboarding !== 'undefined' && Onboarding.notifyPrivacyDone) {
                Onboarding.notifyPrivacyDone();
            }
            if (typeof SaveSystem !== 'undefined' && !SaveSystem.getHasSeenLaunchModal()) {
                this.launchModalVisible = true;
            }
        } else if (context === 'pause') {
            if (this.multiplayerEnabled) {
                this.showPauseMenu = true;
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

    getTelemetryEnemyComposition() {
        const enemies = Array.isArray(this.enemies) ? this.enemies : [];
        return enemies.reduce((counts, enemy) => {
            const type = enemy?.bossName || enemy?.enemyType || enemy?.type || enemy?.constructor?.name || 'unknown';
            counts[type] = (counts[type] || 0) + 1;
            return counts;
        }, {});
    },

    getTelemetryBossId(room = null) {
        const sourceRoom = room || (typeof currentRoom !== 'undefined' ? currentRoom : null);
        const enemies = sourceRoom && Array.isArray(sourceRoom.enemies) ? sourceRoom.enemies : this.enemies;
        const boss = Array.isArray(enemies)
            ? enemies.find(enemy => enemy && (enemy.bossName || enemy.isBoss || enemy.type === 'boss'))
            : null;
        return boss ? (boss.bossName || boss.id || boss.constructor?.name || 'boss') : null;
    },

    getTelemetryRoomContext(room = null) {
        const sourceRoom = room || (typeof currentRoom !== 'undefined' ? currentRoom : null);
        const gameMode = this.gameMode || 'gear';
        const playerCount = typeof getPlayerCount === 'function'
            ? getPlayerCount()
            : (this.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.players
                ? multiplayerManager.players.length
                : 1);

        return {
            biomeId: sourceRoom && sourceRoom.biomeId ? sourceRoom.biomeId : null,
            layoutHash: sourceRoom && sourceRoom.layoutHash ? sourceRoom.layoutHash : null,
            archetype: sourceRoom && sourceRoom.archetype ? sourceRoom.archetype : null,
            entranceVariant: sourceRoom && sourceRoom.entranceVariant ? sourceRoom.entranceVariant : null,
            roomType: sourceRoom && sourceRoom.type ? sourceRoom.type : 'normal',
            gameMode,
            difficulty: this.difficulty || 'normal',
            playerCount,
            enemyCount: sourceRoom && Array.isArray(sourceRoom.enemies)
                ? sourceRoom.enemies.length
                : (Array.isArray(this.enemies) ? this.enemies.length : 0),
            enemyTypes: this.getTelemetryEnemyComposition(),
            multiplayerScaling: typeof getMultiplayerScaling === 'function'
                ? getMultiplayerScaling({ gameMode, playerCount })
                : null
        };
    },

    finalizeTelemetryRun({ result, reason, roomsClearedByPlayer = null } = {}) {
        if (typeof Telemetry === 'undefined') {
            return;
        }

        const participants = this.collectTelemetryParticipants(true);
        const clearedByPlayer = roomsClearedByPlayer || {};
        if (!roomsClearedByPlayer && this.playerStats && this.playerStats.size > 0) {
            this.playerStats.forEach((stats, playerId) => {
                clearedByPlayer[playerId] = typeof stats.roomsCleared === 'number'
                    ? stats.roomsCleared
                    : Math.max(0, this.roomNumber - 1);
            });
        }

        Telemetry.completeRun({
            result,
            metadata: {
                reason,
                gameMode: this.gameMode || 'gear',
                playerCount: participants.length,
                difficulty: this.difficulty || 'normal'
            },
            roomsClearedByPlayer: clearedByPlayer,
            finalPlayers: participants
        });
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
                        const existing = this.remotePlayerInstances.get(player.id);
                        const remoteMeta = (typeof multiplayerManager !== 'undefined' && multiplayerManager.remotePlayers)
                            ? multiplayerManager.remotePlayers.find(rp => rp.id === player.id)
                            : null;
                        const className = (typeof multiplayerManager !== 'undefined' && multiplayerManager.resolvePlayerClass)
                            ? multiplayerManager.resolvePlayerClass(
                                player.id,
                                (existing && existing.playerClass) || (remoteMeta && remoteMeta.class) || player.class
                            )
                            : ((existing && existing.playerClass)
                                || (remoteMeta && remoteMeta.class)
                                || player.class
                                || 'square');
                        if (!existing || existing.playerClass !== className) {
                            this.initializeRemotePlayerInstance(player.id, className);
                        }
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

        // Track latest input seq on the simulated instance for client reconcile acks
        if (inputState && inputState.inputSeq != null && this.remotePlayerInstances) {
            const instance = this.remotePlayerInstances.get(playerId);
            if (instance) {
                instance.lastProcessedInputSeq = inputState.inputSeq;
            }
        }
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

        // Multiplayer - check if all connected players are dead (offline seats don't block)
        const roster = multiplayerManager.players || [];
        const connectedCount = roster.filter(p => p && !p.disconnected).length || roster.length;
        if (connectedCount <= 0) {
            return this.player && this.player.dead;
        }
        const deadConnected = Array.from(this.deadPlayers).filter(pid => this.isPlayerConnectedForMp(pid)).length;
        return deadConnected >= connectedCount;
    },

    isBossRoom(roomNumber) {
        if (typeof roomNumber !== 'number') return false;
        if (roomNumber < 10) return false;
        const mode = (typeof Game !== 'undefined' && Game.gameMode) ? Game.gameMode : 'cards';
        if (mode === 'gear') {
            return roomNumber % 10 === 0;
        }
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
        if (this.state === 'NEXUS' || (typeof currentRoom !== 'undefined' && currentRoom && currentRoom.type === 'safe')) {
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

    // Promote/demote simulation authority when the lobby host changes
    handleHostMigration({ wasHost, isHost, newHostId, previousHostId }) {
        if (!this.multiplayerEnabled || typeof multiplayerManager === 'undefined' || !multiplayerManager) {
            return;
        }

        if (isHost && !wasHost) {
            console.log(`[Host Migration] Promoted to host (was ${previousHostId || 'unknown'})`);
            this.hydrateHostAuthorityFromSnapshot(multiplayerManager.latestGameState);
            multiplayerManager.forceFullState = true;
            multiplayerManager.lastSentGameState = null;
            multiplayerManager.lastStateUpdate = 0;

            // Respect lobby offline seats — don't sim ghosts that block doors
            if (multiplayerManager.players) {
                multiplayerManager.players.forEach(p => {
                    if (!p || p.id === this.getLocalPlayerId()) return;
                    if (p.disconnected && typeof this.handlePlayerDisconnectedMidRun === 'function') {
                        if (!this.isPlayerDisconnectedMidRun(p.id)) {
                            this.handlePlayerDisconnectedMidRun(p.id);
                        } else if (this.remotePlayerInstances) {
                            this.remotePlayerInstances.delete(p.id);
                        }
                    }
                });
            }

            if (typeof multiplayerManager.sendGameState === 'function') {
                multiplayerManager.sendGameState();
            }
            return;
        }

        if (!isHost && wasHost) {
            console.log(`[Host Migration] Demoted from host to client (new host: ${newHostId})`);

            if (this.remotePlayerInstances) {
                this.remotePlayerInstances.clear();
            }
            if (this.remotePlayerStates) {
                this.remotePlayerStates.clear();
            }
            if (this.remotePlayerInputs) {
                this.remotePlayerInputs.clear();
            }

            multiplayerManager.latestGameState = null;
            multiplayerManager.lastSentGameState = null;
            multiplayerManager.expectedSequence = null;
        }
    },

    /**
     * Rebuild host simulation maps from a single game_state snapshot.
     * Used on promote so remotes/economy match last known world instead of lobby defaults.
     */
    hydrateHostAuthorityFromSnapshot(snapshot) {
        const localId = this.getLocalPlayerId ? this.getLocalPlayerId() : (multiplayerManager && multiplayerManager.playerId);
        const lobbyPlayers = (multiplayerManager && multiplayerManager.players) || [];
        const statePlayers = (snapshot && snapshot.players) || [];

        if (this.remotePlayerShadowInstances) {
            this.remotePlayerShadowInstances.clear();
        }
        if (this.remotePlayerInputs) {
            this.remotePlayerInputs.clear();
        }
        if (this.remotePlayerInstances) {
            this.remotePlayerInstances.clear();
        }
        if (this.remotePlayerStates) {
            this.remotePlayerStates.clear();
        }

        const ensureInstance = (playerId, playerClass, stateData) => {
            if (!playerId || playerId === localId) return;
            const className = (stateData && stateData.class) || playerClass || 'square';
            this.initializeRemotePlayerInstance(playerId, className);
            const remoteInstance = this.remotePlayerInstances.get(playerId);
            if (remoteInstance && stateData && remoteInstance.applyState) {
                remoteInstance.applyState(stateData);
                if (stateData.lastProcessedInputSeq != null) {
                    remoteInstance.lastProcessedInputSeq = stateData.lastProcessedInputSeq;
                }
            }

            // Mirror HP/life into remotePlayerStates from snapshot (not defaults)
            const hp = stateData && stateData.hp != null ? stateData.hp : (remoteInstance ? remoteInstance.hp : 100);
            const maxHp = stateData && stateData.maxHp != null ? stateData.maxHp : (remoteInstance ? remoteInstance.maxHp : 100);
            this.remotePlayerStates.set(playerId, {
                id: playerId,
                hp,
                maxHp,
                invulnerable: !!(stateData && stateData.invulnerable),
                invulnerabilityTime: (stateData && stateData.invulnerabilityTime) || 0,
                size: (stateData && stateData.size) || (remoteInstance && remoteInstance.size) || 20,
                dead: !!(stateData && (stateData.dead || stateData.hp <= 0))
            });

            if (stateData) {
                if (stateData.currency !== undefined) {
                    this.playerCurrencies.set(playerId, stateData.currency);
                }
                if (stateData.upgrades) {
                    this.playerUpgrades.set(playerId, JSON.parse(JSON.stringify(stateData.upgrades)));
                }
            }
        };

        // Prefer snapshot players; fall back to lobby roster for anyone missing
        const seen = new Set();
        statePlayers.forEach(stateData => {
            if (!stateData || !stateData.id || stateData.id === localId) return;
            if (!this.isPlayerConnectedForMp(stateData.id)) return;
            seen.add(stateData.id);
            ensureInstance(stateData.id, stateData.class, stateData);
        });

        lobbyPlayers.forEach(player => {
            if (!player || player.id === localId || seen.has(player.id)) return;
            if (player.disconnected || !this.isPlayerConnectedForMp(player.id)) return;
            if (!this.playerCurrencies.has(player.id)) {
                this.playerCurrencies.set(player.id, player.currency || 0);
            }
            if (!this.playerUpgrades.has(player.id) && player.upgrades) {
                this.playerUpgrades.set(player.id, JSON.parse(JSON.stringify(player.upgrades)));
            }
            ensureInstance(player.id, player.class, null);
        });

        // Re-apply enemy snapshot fields for a clean handoff frame (keep existing objects)
        if (snapshot && Array.isArray(snapshot.enemies) && this.enemies) {
            snapshot.enemies.forEach(enemyUpdate => {
                const enemy = this.enemies.find(e => e && e.id === enemyUpdate.id);
                if (enemy && enemy.applyState) {
                    enemy.applyState(enemyUpdate);
                }
            });
        }

        // Ensure projectile array keeps stable-id push wrapper
        if (typeof createProjectileList === 'function' && this.projectiles && !this.projectiles._isProjectileList) {
            this.projectiles = createProjectileList(this.projectiles);
        }

        console.log(`[Host Migration] Hydrated ${this.remotePlayerInstances.size} remote instances from snapshot`);
    },

    isPlayerConnectedForMp(playerId) {
        if (!this.multiplayerEnabled || typeof multiplayerManager === 'undefined' || !multiplayerManager) {
            return true;
        }
        const entry = (multiplayerManager.players || []).find(p => p.id === playerId);
        return !!(entry && !entry.disconnected);
    },

    isPlayerDisconnectedMidRun(playerId) {
        return this.disconnectedPlayerIds && this.disconnectedPlayerIds.has(playerId);
    },

    /**
     * Host: player dropped mid-run — save run snapshot, mark dead, stop simulating.
     * Lobby seat stays until host kicks from MP menu.
     */
    handlePlayerDisconnectedMidRun(playerId) {
        if (!this.multiplayerEnabled || !this.isHost() || !playerId) return;
        const localId = this.getLocalPlayerId ? this.getLocalPlayerId() : null;
        if (playerId === localId) return;

        if (!this.disconnectedPlayerIds) this.disconnectedPlayerIds = new Set();
        if (!this.disconnectedRunSnapshots) this.disconnectedRunSnapshots = new Map();
        this.disconnectedPlayerIds.add(playerId);

        const instance = this.remotePlayerInstances && this.remotePlayerInstances.get(playerId);
        if (instance) {
            let snapshot = null;
            if (typeof multiplayerManager !== 'undefined' && multiplayerManager &&
                typeof multiplayerManager.serializePlayerInstance === 'function') {
                snapshot = multiplayerManager.serializePlayerInstance(instance, playerId);
            } else if (typeof instance.serialize === 'function') {
                snapshot = Object.assign(
                    { id: playerId, class: instance.playerClass, playerClass: instance.playerClass },
                    instance.serialize()
                );
            }
            if (snapshot) {
                this.disconnectedRunSnapshots.set(playerId, JSON.parse(JSON.stringify(snapshot)));
            }

            this.deadPlayers.add(playerId);
            if (this.remotePlayerStates && this.remotePlayerStates.has(playerId)) {
                const st = this.remotePlayerStates.get(playerId);
                st.dead = true;
                st.hp = 0;
            }

            this.remotePlayerInstances.delete(playerId);
        } else if (!this.deadPlayers.has(playerId)) {
            this.deadPlayers.add(playerId);
        }

        if (this.remotePlayerInputs) {
            this.remotePlayerInputs.delete(playerId);
        }

        console.log(`[MP Disconnect] Saved snapshot for ${playerId}, marked dead (kick to remove from lobby)`);

        if (typeof multiplayerManager !== 'undefined' && multiplayerManager &&
            typeof multiplayerManager.sendGameState === 'function') {
            multiplayerManager.sendGameState();
        }
    },

    /**
     * Host: disconnected player rejoined — restore saved run state (not dead).
     */
    handlePlayerReconnectedMidRun(playerId) {
        if (!this.multiplayerEnabled || !this.isHost() || !playerId) return;

        this.disconnectedPlayerIds.delete(playerId);
        this.deadPlayers.delete(playerId);

        const snapshot = this.disconnectedRunSnapshots && this.disconnectedRunSnapshots.get(playerId);
        const lobbyPlayer = (typeof multiplayerManager !== 'undefined' && multiplayerManager.players)
            ? multiplayerManager.players.find(p => p.id === playerId)
            : null;
        const className = (snapshot && (snapshot.class || snapshot.playerClass))
            || (lobbyPlayer && lobbyPlayer.class)
            || 'square';

        this.initializeRemotePlayerInstance(playerId, className);
        const inst = this.remotePlayerInstances && this.remotePlayerInstances.get(playerId);
        if (!inst) return;

        if (snapshot && typeof inst.applyState === 'function') {
            const restore = JSON.parse(JSON.stringify(snapshot));
            restore.dead = false;
            restore.alive = true;
            if (!restore.hp || restore.hp <= 0) {
                restore.hp = (restore.maxHp || inst.maxHp || 100) * 0.5;
            }
            inst.applyState(restore);
            inst.dead = false;
            inst.alive = true;
        } else {
            inst.dead = false;
            inst.alive = true;
            inst.hp = inst.maxHp * 0.5;
        }

        const spawnIndex = Math.max(1, Array.from(this.remotePlayerInstances.keys()).indexOf(playerId));
        const spawn = this.getRoomSpawnPoint(
            (typeof currentRoom !== 'undefined' ? currentRoom : null),
            spawnIndex
        );
        inst.x = spawn.x;
        inst.y = spawn.y;
        inst.invulnerable = true;
        inst.invulnerabilityTime = Math.max(inst.invulnerabilityTime || 0, 1.5);

        if (this.remotePlayerStates) {
            this.remotePlayerStates.set(playerId, {
                id: playerId,
                hp: inst.hp,
                maxHp: inst.maxHp,
                dead: false,
                invulnerable: true,
                invulnerabilityTime: Math.max(inst.invulnerabilityTime || 0, 1.5),
                size: inst.size || 20
            });
        }

        console.log(`[MP Reconnect] Restored ${playerId} from snapshot at ${Math.floor(inst.hp)}/${Math.floor(inst.maxHp)} HP`);

        if (typeof multiplayerManager !== 'undefined' && multiplayerManager &&
            typeof multiplayerManager.sendGameState === 'function') {
            multiplayerManager.sendGameState();
        }
    },

    /** Host kick / leave lobby — purge sim + saved snapshot for that player. */
    handlePlayerRemovedFromLobby(playerId) {
        if (!playerId) return;
        if (this.disconnectedPlayerIds) this.disconnectedPlayerIds.delete(playerId);
        if (this.disconnectedRunSnapshots) this.disconnectedRunSnapshots.delete(playerId);
        if (this.deadPlayers) this.deadPlayers.delete(playerId);
        if (this.remotePlayerInstances) this.remotePlayerInstances.delete(playerId);
        if (this.remotePlayerInputs) this.remotePlayerInputs.delete(playerId);
        if (this.remotePlayerStates) this.remotePlayerStates.delete(playerId);
        if (this.remotePlayerShadowInstances) {
            this.remotePlayerShadowInstances.delete(playerId);
        }
        console.log(`[MP Lobby] Purged run state for removed player ${playerId}`);
    },

    /** Revive offline players' saved snapshots (safe room / room transition). */
    reviveDisconnectedSnapshots(hpFraction = 0.5) {
        if (!this.disconnectedRunSnapshots || this.disconnectedRunSnapshots.size === 0) return;
        this.disconnectedRunSnapshots.forEach((snap, playerId) => {
            if (!snap) return;
            snap.dead = false;
            snap.alive = true;
            const maxHp = snap.maxHp || 100;
            const targetHp = Math.max(snap.hp || 0, maxHp * hpFraction);
            snap.hp = Math.min(maxHp, targetHp);
            if (this.deadPlayers) this.deadPlayers.delete(playerId);
        });
    },

    // Get enemy index in the enemies array
    getEnemyIndex(enemy) {
        return this.enemies.indexOf(enemy);
    },

    // DEPRECATED: Clients no longer send enemy_damaged (host simulates attacks).
    sendEnemyDamageEvent(_enemyIndex, _damage, _hitboxX, _hitboxY, _hitboxRadius, _hitWeakPoint) {
        if (typeof DebugFlags !== 'undefined' && DebugFlags.DAMAGE_NUMBERS) {
            console.warn('[Multiplayer] sendEnemyDamageEvent is deprecated and ignored');
        }
    },

    // DEPRECATED: HP syncs via game_state; player_damaged is a no-op on clients.
    sendPlayerDamageEvent(_targetPlayerId, _damage) {
        if (typeof DebugFlags !== 'undefined' && DebugFlags.DAMAGE_NUMBERS) {
            console.warn('[Multiplayer] sendPlayerDamageEvent is deprecated and ignored');
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
                if (typeof Telemetry !== 'undefined') {
                    Telemetry.recordEvent('allPlayersDead', {
                        roomNumber: this.roomNumber || 1,
                        metadata: {
                            deadPlayers: Array.from(this.deadPlayers || []),
                            playerCount: this.playerStats ? this.playerStats.size : null
                        }
                    });
                }

                if (typeof this.triggerGameOverMusic === 'function') {
                    this.triggerGameOverMusic();
                }

                // Credit rewards immediately on game over screen
                this.creditRewards();
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

        // Update ground items (pulse animation)
        if (typeof updateGroundItems !== 'undefined') {
            updateGroundItems(deltaTime);
        }

        // Update ground gear pulse (gear mode)
        if (typeof updateGroundLoot !== 'undefined') {
            updateGroundLoot(deltaTime);
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
                            if (rawInput.inputSeq != null) {
                                playerInstance.lastProcessedInputSeq = rawInput.inputSeq;
                            }
                        } else {
                            // No input received yet from this client
                            // This can happen during initial connection
                        }
                    }
                });

                // Update remote player invulnerability frames
                this.updateRemotePlayerInvulnerability(deltaTime);
            } else {
                // CLIENT: Movement prediction + ability previews (no combat authority)
                if (this.player && this.player.alive) {
                    const predictionOn = typeof multiplayerManager !== 'undefined' && multiplayerManager &&
                        multiplayerManager.predictionEnabled;

                    if (predictionOn && typeof this.player.predictMovementStep === 'function') {
                        // Snapshot input before flags reset later in the frame
                        const inputSnap = multiplayerManager.serializeInput
                            ? multiplayerManager.serializeInput()
                            : null;
                        multiplayerManager.recordPredictionFrame(deltaTime, inputSnap);
                        this.player.predictMovementStep(deltaTime, Input, {
                            allowPredictedDodge: true,
                            applyForces: true,
                            applyAim: true,
                            applyDriftBias: true
                        });
                    }

                    // Ability previews / aim overlays (visual only)
                    if (Input.isTouchMode && Input.isTouchMode()) {
                        this.player.dashPreviewActive = false;
                        if (this.player.clearHeavyAttackPreview) {
                            this.player.clearHeavyAttackPreview();
                        }

                        if (this.player.playerClass === 'triangle' && Input.touchButtons && Input.touchButtons.dodge) {
                            const button = Input.touchButtons.dodge;
                            if (button.pressed && Input.touchJoysticks && Input.touchJoysticks.dodge) {
                                const joystick = Input.touchJoysticks.dodge;
                                if (joystick.active && joystick.getMagnitude() > 0.1) {
                                    this.player.dashPreviewActive = true;
                                    this.player.rotation = joystick.getAngle();
                                    if (this.player.updateDashPreview) {
                                        this.player.updateDashPreview(Input);
                                    }
                                }
                            }
                        }

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
                        this.player.dashPreviewActive = false;
                        if (this.player.clearHeavyAttackPreview) {
                            this.player.clearHeavyAttackPreview();
                        }

                        if (!predictionOn && Input.getWorldMousePos) {
                            const worldMouse = Input.getWorldMousePos();
                            const dx = worldMouse.x - this.player.x;
                            const dy = worldMouse.y - this.player.y;
                            this.player.rotation = Math.atan2(dy, dx);
                        }
                        // When prediction is on, aim is already applied inside predictMovementStep
                    }

                    // Without prediction, fall back to host interpolation
                    if (!predictionOn && this.player.interpolatePosition) {
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

            // Drain up to 2 queued A* requests per frame
            if (typeof RoomLayoutGenerator !== 'undefined' && RoomLayoutGenerator.processPathfindingQueue) {
                RoomLayoutGenerator.processPathfindingQueue(2);
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
                this.checkDoorCollision();
            }
        }

        if (typeof Room0Tutorial !== 'undefined' && Room0Tutorial.update) {
            Room0Tutorial.update(deltaTime);
        }

        // Update door pulse animation
        this.doorPulse += deltaTime;

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

        // Disable boss intros after room 30
        const currentRoomNumber = this.roomNumber || (typeof currentRoom !== 'undefined' && currentRoom ? currentRoom.number : 0);
        if (currentRoomNumber > 30) {
            // Skip intro - immediately mark as complete
            boss.introComplete = true;
            console.log(`Boss intro skipped for ${boss.bossName} (room ${currentRoomNumber} > 30)`);
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
        if (typeof LootSelection !== 'undefined' && (!Input.isMobileUiMode || !Input.isMobileUiMode())) {
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
            // Check for Safe Room machine interactions
            if (typeof currentRoom !== 'undefined' && currentRoom && currentRoom.type === 'safe') {
                const machines = (typeof window.getSafeRoomMachines === 'function') ? window.getSafeRoomMachines(currentRoom) : [];
                const nearMachine = machines.find(m => {
                    const dx = m.x - this.player.x;
                    const dy = m.y - this.player.y;
                    return Math.sqrt(dx * dx + dy * dy) < m.range;
                });
                if (nearMachine) {
                    if (typeof window.toggleSafeRoomMachine === 'function') {
                        window.toggleSafeRoomMachine(true, nearMachine.id);
                        return;
                    }
                }
            }

            // Check for Pre-Boss Healer interaction (only after room clear opens the boss door)
            if (typeof currentRoom !== 'undefined' && currentRoom && currentRoom.doorOpen && currentRoom.preBossHealer) {
                const healer = currentRoom.preBossHealer;
                // Ensure usedBy is initialised as a Set (backwards-compatible)
                if (!healer.usedBy) healer.usedBy = new Set();
                const localId = typeof this.getLocalPlayerId === 'function' ? this.getLocalPlayerId() : 'local';
                if (!healer.usedBy.has(localId)) {
                    const dx = healer.x - this.player.x;
                    const dy = healer.y - this.player.y;
                    if (Math.sqrt(dx * dx + dy * dy) < healer.range) {
                        healer.usedBy.add(localId);
                        // Heal by 25% max HP
                        this.player.hp = Math.min(this.player.maxHp, this.player.hp + Math.floor(this.player.maxHp * 0.25));
                        if (typeof this.player.updateEffectiveStats === 'function') {
                            this.player.updateEffectiveStats();
                        }
                        if (typeof AudioManager !== 'undefined' && AudioManager.sounds && AudioManager.sounds.heal) {
                            AudioManager.sounds.heal();
                        }
                        console.log("[Healer] Restored 25% HP to player", localId);
                        return;
                    }
                }
            }

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
        if (typeof Telemetry !== 'undefined' && Telemetry.recordGearEquipped) {
            const playerId = this.getLocalPlayerId ? this.getLocalPlayerId() : (this.player && this.player.playerId) || 'local';
            Telemetry.recordGearEquipped({
                playerId,
                gear,
                oldGear,
                roomNumber: this.roomNumber || 1
            });
        }

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
            const gearPayload = (typeof multiplayerManager.serializeGearForNetwork === 'function')
                ? multiplayerManager.serializeGearForNetwork(gear)
                : {
                    id: gear.id,
                    slot: gear.slot,
                    tier: gear.tier,
                    color: gear.color,
                    bonus: gear.bonus,
                    stats: gear.stats,
                    affixes: gear.affixes || [],
                    classModifier: gear.classModifier || null,
                    weaponType: gear.weaponType || null,
                    armorType: gear.armorType || null,
                    legendaryEffect: gear.legendaryEffect || null,
                    name: gear.name
                };

            multiplayerManager.send({
                type: 'loot_pickup',
                data: {
                    playerId: multiplayerManager.playerId,
                    lootId: gear.id,
                    gear: gearPayload
                }
            });
        }
    },

    // Check door collision
    checkDoorCollision() {
        const doorPos = getDoorPosition();
        this.nearExitDoor = false; // Reset flag each frame

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

            // Check remote player instances (connected + alive only)
            if (this.remotePlayerInstances) {
                this.remotePlayerInstances.forEach((playerInstance, playerId) => {
                    if (!this.isPlayerConnectedForMp(playerId)) return;
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
                const isMobile = typeof Input !== 'undefined' && Input.isMobileUiMode && Input.isMobileUiMode();
                const nearRange = (player.size || 28) * (isMobile ? 3.2 : 1.8);
                if (distance <= nearRange) {
                    if (id === this.getLocalPlayerId()) {
                        this.nearExitDoor = true;
                    }
                    const isLocal = id === this.getLocalPlayerId();
                    const isInteracting = isLocal
                        ? (Input.keys && Input.keys['g'])
                        : (typeof Game.getRemotePlayerInput === 'function' &&
                           Game.getRemotePlayerInput(id) &&
                           Game.getRemotePlayerInput(id).keys &&
                           Game.getRemotePlayerInput(id).keys['g']);
                    if (isInteracting) {
                        playersOnDoor.push(id);
                    }
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
            const isMobile = typeof Input !== 'undefined' && Input.isMobileUiMode && Input.isMobileUiMode();
            const nearRange = (this.player.size || 28) * (isMobile ? 3.2 : 1.8);

            if (distance <= nearRange) {
                this.nearExitDoor = true;
                if (Input.keys && Input.keys['g']) {
                    this.advanceToNextRoom();
                }
            }
        }
    },

    getRoomSpawnPoint(room = null, index = 0) {
        const activeRoom = room || (typeof currentRoom !== 'undefined' ? currentRoom : null);
        const layoutSpawn = activeRoom && activeRoom.layout && activeRoom.layout.spawnZone
            ? activeRoom.layout.spawnZone
            : null;
        const spawnZone = layoutSpawn || (
            activeRoom && Array.isArray(activeRoom.spawnZones) && activeRoom.spawnZones[0]
                ? activeRoom.spawnZones[0]
                : { x: 140, y: ((activeRoom && activeRoom.height) || 1350) / 2 }
        );
        const roomWidth = (activeRoom && activeRoom.width) || 2400;
        const roomHeight = (activeRoom && activeRoom.height) || 1350;
        const playerSize = (this.player && this.player.size) || 30;
        const spawnSpread = 70;
        const column = index % 3;
        const row = Math.floor(index / 3);
        const offsetX = column * spawnSpread;
        const offsetY = (row % 2 === 0 ? 1 : -1) * Math.ceil(row / 2) * spawnSpread * 0.75;

        return {
            x: Math.min(Math.max(spawnZone.x + offsetX, playerSize * 2), roomWidth - playerSize * 2),
            y: Math.min(Math.max(spawnZone.y + offsetY, playerSize * 2), roomHeight - playerSize * 2)
        };
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

            const spawnPoint = this.getRoomSpawnPoint(
                (typeof currentRoom !== 'undefined' ? currentRoom : null),
                index
            );
            playerObj.x = spawnPoint.x;
            playerObj.y = spawnPoint.y;
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
            if (typeof Telemetry !== 'undefined') {
                Telemetry.recordEvent('playersRevived', {
                    roomNumber: this.roomNumber || 1,
                    metadata: {
                        reason,
                        playerIds: Array.from(revived),
                        respawnStrategy
                    }
                });
            }

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

        if (reason === 'room_transition' || reason === 'room_clear' || reason === 'safe_room') {
            this.reviveDisconnectedSnapshots(0.5);
        }

        return Array.from(revived);
    },

    beginRoomEnterTransition(options = {}) {
        if (typeof RunProfiler !== 'undefined' && RunProfiler.isActive()) {
            RunProfiler.markRoomTransitionStart();
        }
        this.roomEnterTransition = {
            phase: 0,
            roomNumber: options.roomNumber != null ? options.roomNumber : this.roomNumber,
            startedAt: performance.now(),
            minMs: options.minMs != null ? options.minMs : 280,
            onComplete: typeof options.onComplete === 'function' ? options.onComplete : null
        };
        this.state = 'ENTERING_ROOM';
        this.paused = false;
    },

    updateRoomEnterTransition() {
        const transition = this.roomEnterTransition;
        if (!transition) {
            this.finishRoomEnterTransition();
            return;
        }

        if (transition.phase === 0) {
            if (typeof currentRoom !== 'undefined' && currentRoom && typeof prepareRoomRenderData === 'function') {
                prepareRoomRenderData(currentRoom, transition.roomNumber);
            }
            if (typeof resetVoxelStaticCanvas === 'function' && typeof currentRoom !== 'undefined' && currentRoom) {
                resetVoxelStaticCanvas(currentRoom.width || 2400, currentRoom.height || 1350);
            }
            // Fresh frame-budget window per room so end-of-fight load does not crush vignette on entry.
            this.frameBudgetSamples.length = 0;
            this.renderQuality = {
                vignetteScale: 0.5,
                maxSceneryLights: Infinity,
                gearRingPoints: 64,
                groundLootAnimatedRing: true,
                remoteFullRender: true,
                maxBeamLights: 8,
                damageFxScale: 1,
                voxelParticleCap: 512
            };
            transition.phase = 1;
            return;
        }

        if (transition.phase === 1) {
            if (typeof currentRoom !== 'undefined' && currentRoom) {
                if (typeof bakeRoomStaticSceneCache === 'function') {
                    bakeRoomStaticSceneCache(currentRoom, transition.roomNumber);
                } else if (typeof prepareRoomRenderCaches === 'function') {
                    prepareRoomRenderCaches(currentRoom, transition.roomNumber);
                }
            }
            transition.phase = 2;
            return;
        }

        if (transition.phase === 2 && performance.now() - transition.startedAt >= transition.minMs) {
            this.finishRoomEnterTransition();
        }
    },

    finishRoomEnterTransition() {
        const onComplete = this.roomEnterTransition && this.roomEnterTransition.onComplete;
        const roomNumber = this.roomEnterTransition ? this.roomEnterTransition.roomNumber : this.roomNumber;
        this.roomEnterTransition = null;
        this.state = 'PLAYING';
        if (typeof RunProfiler !== 'undefined' && RunProfiler.isActive()) {
            RunProfiler.markRoomTransitionEnd(roomNumber);
            const roomType = (typeof currentRoom !== 'undefined' && currentRoom && currentRoom.type) ? currentRoom.type : 'normal';
            const biomeId = (typeof currentRoom !== 'undefined' && currentRoom && currentRoom.biomeId) ? currentRoom.biomeId : null;
            RunProfiler.markRoomEnter(roomNumber, roomType, biomeId);
        }
        if (typeof this.initializeCamera === 'function') {
            this.initializeCamera();
        }
        if (typeof onComplete === 'function') {
            onComplete();
        }
    },

    maybeStartBossIntroForCurrentRoom() {
        if (typeof currentRoom === 'undefined' || !currentRoom || currentRoom.type !== 'boss') {
            return;
        }
        if (!Array.isArray(this.enemies) || this.enemies.length === 0 || !this.enemies[0].isBoss) {
            return;
        }
        const boss = this.enemies[0];
        const currentRoomNumber = this.roomNumber || (currentRoom ? currentRoom.number : 0);
        if (currentRoomNumber <= 50) {
            this.startBossIntro(boss);
        } else {
            boss.introComplete = true;
        }
    },

    tickNexusPrewarm() {
        if (this.state !== 'NEXUS' || this.nexusPrewarmComplete) {
            return;
        }
        if (!this.selectedClass) {
            return;
        }

        if (!this.nexusPrewarm) {
            if (typeof generateRoom === 'undefined') {
                return;
            }
            this.nexusPrewarm = {
                phase: 0,
                room: generateRoom(1),
                roomNumber: 1
            };
        }

        const prewarm = this.nexusPrewarm;
        if (prewarm.phase === 0) {
            if (typeof prepareRoomRenderData === 'function') {
                prepareRoomRenderData(prewarm.room, prewarm.roomNumber);
            }
            prewarm.phase = 1;
            return;
        }

        if (prewarm.phase === 1) {
            if (typeof bakeRoomStaticSceneCache === 'function') {
                bakeRoomStaticSceneCache(prewarm.room, prewarm.roomNumber);
            } else if (typeof prepareRoomRenderCaches === 'function') {
                prepareRoomRenderCaches(prewarm.room, prewarm.roomNumber);
            }
            if (typeof releaseRoomRenderCaches === 'function') {
                releaseRoomRenderCaches(prewarm.room);
            }
            this.nexusPrewarm = null;
            this.nexusPrewarmComplete = true;
        }
    },

    renderRoomEnterScreen(ctx) {
        const logicalWidth = this.config.width;
        const logicalHeight = this.config.height;
        const biome = typeof getBiomeForRoom !== 'undefined'
            ? getBiomeForRoom(this.roomNumber)
            : { baseColor: '#1a1a2e', accentColor: '#6699ff' };

        Renderer.clear(ctx, logicalWidth, logicalHeight, biome.baseColor);

        if (this.roomEnterTransition && this.roomEnterTransition.phase >= 1 &&
            typeof currentRoom !== 'undefined' && currentRoom &&
            typeof renderCachedRoomStaticLayer === 'function') {
            ctx.save();
            ctx.globalAlpha = 0.35;
            renderCachedRoomStaticLayer(ctx, this.roomNumber);
            ctx.restore();
        }

        ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
        ctx.fillRect(0, 0, logicalWidth, logicalHeight);

        const hex = (biome.accentColor || '#6699ff').replace('#', '');
        const accentR = parseInt(hex.substring(0, 2), 16);
        const accentG = parseInt(hex.substring(2, 4), 16);
        const accentB = parseInt(hex.substring(4, 6), 16);

        ctx.fillStyle = `rgba(${accentR}, ${accentG}, ${accentB}, 0.9)`;
        ctx.font = 'bold 22px Orbitron, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`Entering Room ${this.roomNumber}`, logicalWidth / 2, logicalHeight / 2 - 12);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
        ctx.font = '12px Orbitron, sans-serif';
        ctx.fillText('Preparing environment...', logicalWidth / 2, logicalHeight / 2 + 18);
    },

    /**
     * Set whether we are currently in a safe room.
     * On true → false, clear rarityUpgradedThisVisit on all live gear.
     */
    setInSafeRoom(next) {
        const was = !!this.inSafeRoom;
        const now = !!next;
        this.inSafeRoom = now;
        if (was && !now && typeof clearAllGearRarityVisitFlags === 'function') {
            clearAllGearRarityVisitFlags();
        } else if (was && !now && typeof window !== 'undefined' && typeof window.clearAllGearRarityVisitFlags === 'function') {
            window.clearAllGearRarityVisitFlags();
        }
    },

    syncInSafeRoomFromCurrentRoom(room) {
        const isSafe = !!(room && room.type === 'safe');
        if (isSafe && !this.inSafeRoom) {
            this.safeRoomUsedThisVisit = false;
        }
        this.setInSafeRoom(isSafe);

        // Safe room: revive everyone (including offline snapshots for when they rejoin)
        if (isSafe && this.multiplayerEnabled && this.isHost && this.isHost()) {
            this.reviveDeadPlayers({
                reason: 'safe_room',
                broadcast: true,
                respawnStrategy: 'safe'
            });
            this.reviveDisconnectedSnapshots(0.5);
            if (typeof multiplayerManager !== 'undefined' && multiplayerManager &&
                typeof multiplayerManager.sendGameState === 'function') {
                multiplayerManager.sendGameState();
            }
        }
    },

    markSafeRoomMachineUsed() {
        this.safeRoomUsedThisVisit = true;
    },

    canSaveRunAtSafeRoom() {
        if (this.multiplayerEnabled) return false;
        if (this.state !== 'PLAYING') return false;
        if (!this.inSafeRoom && !(typeof currentRoom !== 'undefined' && currentRoom && currentRoom.type === 'safe')) {
            return false;
        }
        if (this.safeRoomUsedThisVisit) return false;
        if (!this.player || this.player.dead) return false;
        return true;
    },

    saveRunAtSafeRoom() {
        if (!this.canSaveRunAtSafeRoom()) {
            console.warn('[RunSave] Cannot save: solo safe room + unused machines required');
            return false;
        }
        if (typeof SaveSystem === 'undefined' || typeof RunCheckpoint === 'undefined') {
            console.error('[RunSave] SaveSystem/RunCheckpoint unavailable');
            return false;
        }

        const checkpoint = RunCheckpoint.buildCheckpoint(this, this.player);
        if (!checkpoint || !checkpoint.player) {
            console.error('[RunSave] Failed to build checkpoint');
            return false;
        }

        SaveSystem.setActiveRunCheckpoint(checkpoint);
        if (checkpoint.playerClass) {
            this.selectedClass = checkpoint.playerClass;
            if (SaveSystem.setSelectedClass) {
                SaveSystem.setSelectedClass(checkpoint.playerClass);
            }
        }

        if (typeof window !== 'undefined' && typeof window.toggleSafeRoomMachine === 'function') {
            window.toggleSafeRoomMachine(false);
        }

        this.exitToNexusWithCheckpoint();
        return true;
    },

    exitToNexusWithCheckpoint() {
        // Keep activeRunCheckpoint. Do not creditRewards / end-run economy.
        this.state = 'NEXUS';
        this.roomEnterTransition = null;
        if (typeof initializeRoom !== 'undefined') {
            currentRoom = null;
            if (typeof window !== 'undefined') {
                window.currentRoom = null;
            }
        }
        this.enemies = [];
        this.projectiles = (typeof createProjectileList === 'function' ? createProjectileList() : []);
        this.gameOverMusicPlaying = false;
        this.updateMusicForCurrentRoom();

        this.paused = false;
        this.showPauseMenu = false;
        this.pausedFromState = null;
        if (typeof audioMenuVisible !== 'undefined') {
            audioMenuVisible = false;
        }

        this.enemiesKilled = 0;
        this.elitesKilled = 0;
        this.bossesKilled = 0;
        this.roomNumber = 1;
        this.currencyEarned = 0;
        this.currencyBankedThisRun = 0;
        this.shardsEarned = 0;
        this.enteringSafeRoom = false;
        this.safeRoomUsedThisVisit = false;
        this.resumeSkipSafeSoftHeal = false;
        this.setInSafeRoom(false);

        if (typeof groundLoot !== 'undefined') {
            groundLoot.length = 0;
        }
        this.cleanupRunState();

        if (typeof initNexus !== 'undefined') {
            initNexus();
        }
        // Sync unlock queue, but FeatureTutorials must not spotlight during resume lock
        if (typeof FeatureTutorials !== 'undefined' && FeatureTutorials.onNexusEnter) {
            FeatureTutorials.onNexusEnter();
        }
        this.initializeNexusCamera();
        console.log('[RunSave] Exited to Nexus with active run checkpoint');
    },

    resumeRunFromCheckpoint(checkpoint) {
        if (!checkpoint || typeof checkpoint !== 'object') {
            console.error('[RunSave] resumeRunFromCheckpoint called without checkpoint');
            return false;
        }
        if (this.multiplayerEnabled) {
            console.warn('[RunSave] Resume blocked in multiplayer');
            return false;
        }

        try {
            const playerClass = checkpoint.playerClass || (checkpoint.player && checkpoint.player.playerClass);
            if (!playerClass || typeof createPlayer === 'undefined') {
                throw new Error('Missing player class or createPlayer');
            }

            this.gameMode = checkpoint.gameMode || 'gear';
            this.difficulty = checkpoint.difficulty || 'normal';
            this.selectedClass = playerClass;
            if (typeof SaveSystem !== 'undefined' && SaveSystem.setSelectedClass) {
                SaveSystem.setSelectedClass(playerClass);
            }

            const spawnPoint = this.getRoomSpawnPoint ? this.getRoomSpawnPoint(null, 0) : { x: 400, y: 300 };
            this.player = createPlayer(playerClass, spawnPoint.x, spawnPoint.y);
            this.player.playerId = this.getLocalPlayerId ? this.getLocalPlayerId() : 'local';

            if (typeof RunCheckpoint === 'undefined' ||
                !RunCheckpoint.applyPlayerSnapshot(this.player, checkpoint.player)) {
                throw new Error('Failed to apply player snapshot');
            }

            const run = checkpoint.run || {};
            this.enemiesKilled = run.enemiesKilled || 0;
            this.elitesKilled = run.elitesKilled || 0;
            this.bossesKilled = run.bossesKilled || 0;
            this.currencyEarned = run.currencyEarned || 0;
            this.currencyBankedThisRun = run.currencyBankedThisRun || 0;
            this.shardsEarned = run.shardsEarned || 0;
            this.startTime = run.startTime || Date.now();

            this.roomNumber = checkpoint.roomNumber || 1;
            this.enteringSafeRoom = true;
            this.safeRoomUsedThisVisit = false;
            this.resumeSkipSafeSoftHeal = true;
            this.gameOverMusicPlaying = false;
            this.showPauseMenu = false;
            this.paused = false;
            this.pausedFromState = null;
            this.roomEnterTransition = null;
            this.deathScreenStartTime = 0;
            this.finalStats = null;

            if (typeof initializeRoom !== 'undefined') {
                currentRoom = null;
                if (typeof window !== 'undefined') {
                    window.currentRoom = null;
                }
            }

            this.initializePlayerStats && this.initializePlayerStats();
            this.state = 'PLAYING';
            this.spawnEnemies();
            this.updateMusicForCurrentRoom();

            if (this.beginRoomEnterTransition) {
                this.beginRoomEnterTransition({
                    roomNumber: this.roomNumber,
                    onComplete: () => {}
                });
            }

            console.log(`[RunSave] Resumed at safe room for room ${this.roomNumber}`);
            return true;
        } catch (err) {
            console.error('[RunSave] Resume failed after checkpoint consume:', err);
            this.state = 'NEXUS';
            this.enteringSafeRoom = false;
            this.resumeSkipSafeSoftHeal = false;
            if (typeof initNexus !== 'undefined') {
                initNexus();
            }
            this.initializeNexusCamera && this.initializeNexusCamera();
            return false;
        }
    },

    tryResumeOrStartFromPortal() {
        if (this.multiplayerEnabled) {
            this.startGame();
            return;
        }
        if (typeof SaveSystem === 'undefined' || !SaveSystem.hasActiveRunCheckpoint ||
            !SaveSystem.hasActiveRunCheckpoint()) {
            this.startGame();
            return;
        }
        const cp = SaveSystem.consumeActiveRunCheckpoint();
        if (!cp) {
            this.startGame();
            return;
        }
        this.resumeRunFromCheckpoint(cp);
    },

    advanceToNextRoom() {
        if (this.roomNumber === 0
            || (typeof currentRoom !== 'undefined' && currentRoom && currentRoom.type === 'tutorial')) {
            if (typeof Room0Tutorial !== 'undefined' && Room0Tutorial.markDone) {
                Room0Tutorial.markDone();
            }
            this.enteringSafeRoom = false;
            this.roomNumber = 1;
        } else if (this.gameMode === 'gear' && typeof currentRoom !== 'undefined' && currentRoom) {
            if (currentRoom.type !== 'safe') {
                // Safe room every 5 rooms: after room 5, 10, 15, 20...
                // Guard: room 0 must never insert a safe room (0 % 5 === 0)
                if (this.roomNumber > 0 && this.roomNumber % 5 === 0) {
                    this.enteringSafeRoom = true;
                } else {
                    this.roomNumber++;
                }
            } else {
                // Exit Safe Room - clear visit flag then return to regular room structure
                this.setInSafeRoom(false);
                this.enteringSafeRoom = false;
                this.roomNumber++;
            }
        } else {
            if (this.inSafeRoom) this.setInSafeRoom(false);
            this.roomNumber++;
        }
        this.gameOverMusicPlaying = false;
        if (typeof audioMenuVisible !== 'undefined') {
            audioMenuVisible = false;
        }

        // Reset door waiting state
        this.playersOnDoor = [];
        this.totalAlivePlayers = 0;
        
        // Reset item drop counter for new room
        this.itemsDroppedThisRoom = 0;

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

                // Clear ground items (will be synced from host)
                if (typeof Game !== 'undefined' && Game.groundItems && Array.isArray(Game.groundItems)) {
                    Game.groundItems.length = 0;
                }

                // Clear item pylons (will be synced from host)
                if (typeof Game !== 'undefined' && Game.itemPylons && Array.isArray(Game.itemPylons)) {
                    Game.itemPylons.length = 0;
                }

                // Clients wait for the host layout; keep the fallback routed through the same spawn helper.
                const spawnPoint = this.getRoomSpawnPoint(null, 0);
                this.player.x = spawnPoint.x;
                this.player.y = spawnPoint.y;

                // Initialize camera to follow player
                this.initializeCamera();

                console.log(`[Client] Waiting for room ${this.roomNumber} from host...`);
                this.updateMusicForCurrentRoom();
            } else {
                // Host or solo: Generate room normally
                const newRoom = generateRoom(this.roomNumber);

                // Update currentRoom to the new room
                if (typeof currentRoom !== 'undefined') {
                    if (typeof releaseRoomRenderCaches === 'function') {
                        releaseRoomRenderCaches(currentRoom);
                    }
                    currentRoom = newRoom;
                    // Sync to window for DOM components
                    if (typeof window !== 'undefined') {
                        window.currentRoom = currentRoom;
                    }
                    this.syncInSafeRoomFromCurrentRoom(currentRoom);
                    if (typeof RoomLayoutGenerator !== 'undefined' && RoomLayoutGenerator.clearPathfindingQueue) {
                        RoomLayoutGenerator.clearPathfindingQueue();
                    }
                }

                // Update enemies array
                this.enemies = newRoom.enemies;

                // No longer pre-assign targets - proximity detection and damage-based aggro handle targeting
                if (typeof groundLoot !== 'undefined') {
                    groundLoot.length = 0;
                }

                // Clear ground items from previous room
                if (typeof Game !== 'undefined' && Game.groundItems && Array.isArray(Game.groundItems)) {
                    Game.groundItems.length = 0;
                }

                // Clear item pylons from previous room (multiplayer)
                if (typeof Game !== 'undefined' && Game.itemPylons && Array.isArray(Game.itemPylons)) {
                    Game.itemPylons.length = 0;
                }

                // Reset player position to the generated spawn zone.
                const spawnPoint = this.getRoomSpawnPoint(newRoom, 0);
                this.player.x = spawnPoint.x;
                this.player.y = spawnPoint.y;

                // Reset remote player instances to spawn (host only)
                if (this.isHost() && this.remotePlayerInstances) {
                    let remoteIndex = 1;
                    this.remotePlayerInstances.forEach((playerInstance, playerId) => {
                        const remoteSpawn = this.getRoomSpawnPoint(newRoom, remoteIndex);
                        playerInstance.x = remoteSpawn.x;
                        playerInstance.y = remoteSpawn.y;
                        remoteIndex++;
                    });
                }

                // Initialize camera to follow player
                this.initializeCamera();

                console.log(`Advanced to Room ${this.roomNumber}${newRoom.type === 'boss' ? ' (BOSS ROOM)' : ''}`);
                this.updateMusicForCurrentRoom();

                if (typeof Telemetry !== 'undefined') {
                    const participants = this.collectTelemetryParticipants(true);
                    const roomContext = this.getTelemetryRoomContext(newRoom);
                    Telemetry.recordRoomEnter(this.roomNumber, newRoom.type, participants, roomContext);
                    Telemetry.recordEvent('roomGenerated', {
                        roomNumber: this.roomNumber,
                        metadata: roomContext
                    });
                    const bossId = this.getTelemetryBossId(newRoom);
                    if (bossId) {
                        Telemetry.recordBossEncounter({
                            bossId,
                            roomNumber: this.roomNumber,
                            phases: [],
                            damageByPlayer: {},
                            damageToPlayers: {},
                            hitsTakenByPlayers: {}
                        });
                        Telemetry.recordEvent('bossEncounterStarted', {
                            roomNumber: this.roomNumber,
                            targetId: bossId,
                            metadata: { bossId, roomType: newRoom.type }
                        });
                    }
                }

                // Multiplayer: Send room transition message and immediate state update
                if (this.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager) {
                    if (multiplayerManager.isHost) {
                        // Send room transition message first (with revival data)
                        multiplayerManager.send({
                            type: 'room_transition',
                            data: {
                                roomNumber: this.roomNumber,
                                roomType: newRoom.type,
                                roomLayout: (typeof RoomLayoutGenerator !== 'undefined' && newRoom.layout)
                                    ? RoomLayoutGenerator.serializeLayout(newRoom.layout)
                                    : null,
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

                this.beginRoomEnterTransition({
                    roomNumber: this.roomNumber,
                    onComplete: () => this.maybeStartBossIntroForCurrentRoom()
                });
            }
        }
    },

    // Render everything
    render() {
        if (!this.currentFrameTimings) {
            this.currentFrameTimings = {
                static: 0, world: 0, worldGlow: 0, worldBodies: 0,
                vignette: 0, postFx: 0, ui: 0
            };
        }
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
        } else if (this.state === 'ENTERING_ROOM') {
            this.renderRoomEnterScreen(this.ctx);
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
            const now = Date.now() / 1000;
            const damageTraumaDuration = 0.35;

            let playerToCheck = this.player;
            if (!playerToCheck && this.multiplayerEnabled && typeof this.getLocalPlayerId === 'function') {
                const localPlayerId = this.getLocalPlayerId();
                if (localPlayerId && this.remotePlayerInstances) {
                    playerToCheck = this.remotePlayerInstances.get(localPlayerId);
                }
            }

            const traumaNow = performance.now();
            const traumaParams = this.getDamageTraumaParams(
                playerToCheck, now, traumaNow, damageTraumaDuration
            );
            const useChromaticPass = traumaParams.active && traumaParams.intensity >= 0.18;

            const dpr = this.dpr || 1;
            const logicalWidth = this.config.width;
            const logicalHeight = this.config.height;
            const worldTarget = useChromaticPass
                ? this.ensureWorldRenderTarget(logicalWidth * dpr, logicalHeight * dpr, dpr)
                : this.ctx;

            this.renderPlayingWorldLayer(worldTarget);

            if (useChromaticPass) {
                const postFxStart = performance.now();
                this.applyChromaticAberrationFromOffscreen(traumaParams);
                this.currentFrameTimings.postFx += performance.now() - postFxStart;
            }

            if (typeof currentRoom === 'undefined' || !currentRoom || currentRoom.type !== 'safe') {
                const vignetteStart = performance.now();
                this.renderVignette(this.ctx);
                this.currentFrameTimings.vignette += performance.now() - vignetteStart;
            }

            // Post-vignette: punch-through screen-space glow for pre-boss healer (after door opens)
            if (typeof currentRoom !== 'undefined' && currentRoom && currentRoom.doorOpen && currentRoom.preBossHealer && this.player) {
                const healer = currentRoom.preBossHealer;
                if (!healer.usedBy) healer.usedBy = new Set();
                const _localId = typeof this.getLocalPlayerId === 'function' ? this.getLocalPlayerId() : 'local';
                if (!healer.usedBy.has(_localId)) {
                    // Convert world coords to screen coords
                    const isMobile = typeof Input !== 'undefined' && Input.isMobileUiMode && Input.isMobileUiMode();
                    const _zoom = isMobile ? (this.mobileZoom || 1.0) : (this.baseZoom || 1.1);
                    const _cX = (this.config.width / 2) + this.screenShakeOffset.x;
                    const _cY = (this.config.height / 2) + this.screenShakeOffset.y;
                    const sx = (healer.x - this.camera.x) * _zoom + _cX;
                    const sy = (healer.y - this.camera.y) * _zoom + _cY;
                    const _t = Date.now() * 0.002;
                    const _pulse = 0.5 + Math.sin(_t) * 0.5;
                    // Draw a bright additive glow that punches through the vignette darkness
                    this.ctx.save();
                    this.ctx.globalCompositeOperation = 'lighter';
                    const glowR = (70 + _pulse * 20) * _zoom;
                    const grad = this.ctx.createRadialGradient(sx, sy, 0, sx, sy, glowR);
                    grad.addColorStop(0, `rgba(0, 255, 100, ${0.18 + _pulse * 0.12})`);
                    grad.addColorStop(0.4, `rgba(0, 200, 80, ${0.08 + _pulse * 0.06})`);
                    grad.addColorStop(1, 'rgba(0,0,0,0)');
                    this.ctx.fillStyle = grad;
                    this.ctx.beginPath();
                    this.ctx.arc(sx, sy, glowR, 0, Math.PI * 2);
                    this.ctx.fill();
                    this.ctx.restore();
                }
            }
        }


        const uiStart = performance.now();
        if (typeof renderEnemyDirectionArrows === 'function') {
            renderEnemyDirectionArrows(this.ctx, this.player);
        }
        if (typeof renderDoorDirectionArrow === 'function') {
            renderDoorDirectionArrow(this.ctx, this.player);
        }
        if (typeof renderExitChevron === 'function') {
            renderExitChevron(this.ctx);
        }

        // Render touch controls (on top of everything)
        if (typeof Input !== 'undefined' && Input.render) {
            Input.render(this.ctx);
        }

        // Room 0 coach + exit-door spotlight (world-space, camera-transformed)
        if (typeof Room0Tutorial !== 'undefined') {
            this.ctx.save();
            const isMobile = typeof Input !== 'undefined' && Input.isMobileUiMode && Input.isMobileUiMode();
            const currentZoom = isMobile ? (this.mobileZoom || 1.0) : (this.baseZoom);
            const centerX = this.config.width / 2;
            const centerY = this.config.height / 2;
            this.ctx.translate(centerX + this.screenShakeOffset.x, centerY + this.screenShakeOffset.y);
            this.ctx.scale(currentZoom, currentZoom);
            this.ctx.translate(-this.camera.x, -this.camera.y);
            if (Room0Tutorial.renderSpotlight) {
                Room0Tutorial.renderSpotlight(this.ctx);
            }
            // Redraw player above the exit-coach dim (shade stays full; character sits on top)
            if (Room0Tutorial.isExitCoachActive
                && Room0Tutorial.isExitCoachActive()
                && this.player
                && this.player.alive
                && typeof this.player.render === 'function') {
                this.player.render(this.ctx);
            }
            if (Room0Tutorial.renderCoachCard) {
                Room0Tutorial.renderCoachCard(this.ctx);
            }
            this.ctx.restore();
        }

        // Render interaction button (on top of touch controls)
        if (typeof renderInteractionButton === 'function') {
            renderInteractionButton(this.ctx);
        }
        this.currentFrameTimings.ui += performance.now() - uiStart;
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

    getCachedGlowSprite(color) {
        if (!this.glowCache) {
            this.glowCache = new Map();
        }
        const key = color || 'rgba(255,255,255,0.75)';
        if (this.glowCache.has(key)) {
            return this.glowCache.get(key);
        }

        const size = 128;
        const canvas = document.createElement('canvas');
        const diameter = size * 2;
        const padding = 4;
        canvas.width = diameter + padding * 2;
        canvas.height = diameter + padding * 2;
        const gCtx = canvas.getContext('2d');
        const center = size + padding;
        const grad = gCtx.createRadialGradient(center, center, size * 0.1, center, center, size);
        grad.addColorStop(0, key);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        gCtx.fillStyle = grad;
        gCtx.beginPath();
        gCtx.arc(center, center, size, 0, Math.PI * 2);
        gCtx.fill();
        this.glowCache.set(key, canvas);
        return canvas;
    },

    prewarmRenderCaches() {
        if (!this.lightSprite) {
            this.lightSprite = this.createLightSprite();
        }

        const glowColors = new Set([
            '#cccccc', '#4caf50', '#2196f3', '#9c27b0', '#ff9800',
            '#999999', '#ffff00', '#ffaa00', '#ff1493', '#888888'
        ]);
        if (typeof CLASS_DEFINITIONS !== 'undefined') {
            Object.keys(CLASS_DEFINITIONS).forEach(key => {
                if (CLASS_DEFINITIONS[key] && CLASS_DEFINITIONS[key].color) {
                    glowColors.add(CLASS_DEFINITIONS[key].color);
                }
            });
        }
        glowColors.forEach(color => this.getCachedGlowSprite(color));

        if (typeof Renderer !== 'undefined' && Renderer.getCachedDoor) {
            Renderer.getCachedDoor(80, 120);
            Renderer.getCachedDoor(100, 140);
        }

        if (this.ctx && typeof BiomeConfig !== 'undefined' && typeof getBiomeGridPattern === 'function') {
            Object.keys(BiomeConfig.definitions || {}).forEach(id => {
                const biome = BiomeConfig.getBiomeDefinition(id);
                getBiomeGridPattern(this.ctx, biome, false, false);
                getBiomeGridPattern(this.ctx, biome, true, false);
                getBiomeGridPattern(this.ctx, biome, false, true);
                getBiomeGridPattern(this.ctx, biome, true, true);
            });
        }

        if (typeof currentRoom !== 'undefined' && currentRoom && typeof prepareRoomRenderCaches === 'function') {
            prepareRoomRenderCaches(currentRoom, this.roomNumber || currentRoom.number || 1);
        }
    },

    updateFrameBudgetGovernor(frameTimeMs, renderTimeMs) {
        const adaptiveEnabled = typeof DebugFlags === 'undefined' || DebugFlags.ADAPTIVE_RENDER_QUALITY !== false;
        const baseQuality = {
            vignetteScale: 0.5,
            maxSceneryLights: Infinity,
            gearRingPoints: 64,
            groundLootAnimatedRing: true,
            remoteFullRender: true,
            maxBeamLights: 8,
            damageFxScale: 1,
            voxelParticleCap: 512
        };
        if (!adaptiveEnabled) {
            this.frameBudgetSamples.length = 0;
            this.renderQuality = baseQuality;
            this.debugFrameBudget = { frameAvg: 0, renderAvg: 0 };
            return;
        }

        const now = performance.now();
        this.frameBudgetSamples.push({ time: now, frame: frameTimeMs, render: renderTimeMs });
        const cutoff = now - 2000;
        while (this.frameBudgetSamples.length > 0 && this.frameBudgetSamples[0].time < cutoff) {
            this.frameBudgetSamples.shift();
        }

        let frameSum = 0;
        let renderSum = 0;
        for (let i = 0; i < this.frameBudgetSamples.length; i++) {
            frameSum += this.frameBudgetSamples[i].frame;
            renderSum += this.frameBudgetSamples[i].render;
        }
        const count = Math.max(1, this.frameBudgetSamples.length);
        const frameAvg = frameSum / count;
        const renderAvg = renderSum / count;
        this.debugFrameBudget = { frameAvg, renderAvg };

        if (frameAvg > 34 || renderAvg > 28) {
            this.renderQuality = {
                vignetteScale: 0.5,
                maxSceneryLights: 36,
                gearRingPoints: 24,
                groundLootAnimatedRing: false,
                remoteFullRender: false,
                maxBeamLights: 4,
                damageFxScale: 0.5,
                voxelParticleCap: 64
            };
        } else if (frameAvg > 30 || renderAvg > 22) {
            this.renderQuality = {
                vignetteScale: 0.5,
                maxSceneryLights: 64,
                gearRingPoints: 32,
                groundLootAnimatedRing: false,
                remoteFullRender: true,
                maxBeamLights: 4,
                damageFxScale: 0.75,
                voxelParticleCap: 192
            };
        } else if (frameAvg < 24 && renderAvg < 17) {
            this.renderQuality = baseQuality;
        }
    },

    shouldCollectDebugMetrics() {
        return (typeof RunProfiler !== 'undefined' && RunProfiler.isActive()) ||
            (typeof DebugPanel !== 'undefined' && DebugPanel.visible) ||
            (typeof DebugFlags !== 'undefined' && DebugFlags.RENDER_TIMING);
    },

    getRenderQualityTier() {
        const q = this.renderQuality || {};
        if (q.gearRingPoints === 24 && q.remoteFullRender === false) return 'heavy';
        if (q.gearRingPoints === 32 || q.groundLootAnimatedRing === false) return 'medium';
        return 'normal';
    },

    buildDebugMetricsSnapshot() {
        const lists = this.visibleFrameLists || {};
        const totalGroundLoot = (typeof groundLoot !== 'undefined' && Array.isArray(groundLoot))
            ? groundLoot.length
            : 0;
        return {
            fps: this.fps || 0,
            qualityTier: this.getRenderQualityTier(),
            frameBudget: this.debugFrameBudget || { frameAvg: 0, renderAvg: 0 },
            counts: {
                enemiesVisible: lists.enemies ? lists.enemies.length : 0,
                enemiesTotal: this.enemies ? this.enemies.length : 0,
                projectilesVisible: lists.projectiles ? lists.projectiles.length : 0,
                projectilesTotal: this.projectiles ? this.projectiles.length : 0,
                groundLootVisible: lists.groundLoot ? lists.groundLoot.length : 0,
                groundLootTotal: totalGroundLoot,
                groundItemsVisible: lists.groundItems ? lists.groundItems.length : 0,
                groundItemsTotal: this.groundItems ? this.groundItems.length : 0
            },
            subTimings: Object.assign({}, this.renderSubTimings || {})
        };
    },

    recordRenderSubTiming(key, durationMs) {
        if (!this.shouldCollectDebugMetrics()) return;
        if (!this.renderSubTimingSamples) {
            this.renderSubTimingSamples = {
                groundLoot: [],
                gearRings: [],
                remotePlayers: [],
                worldGlow: [],
                worldBodies: []
            };
        }
        const samples = this.renderSubTimingSamples[key];
        if (!samples) return;
        const now = performance.now();
        samples.push({ time: now, value: durationMs });
        const cutoff = now - 1000;
        while (samples.length > 0 && samples[0].time < cutoff) {
            samples.shift();
        }
        let sum = 0;
        for (let i = 0; i < samples.length; i++) sum += samples[i].value;
        if (!this.renderSubTimings) this.renderSubTimings = {};
        this.renderSubTimings[key] = samples.length > 0 ? sum / samples.length : 0;
    },

    trackRenderSection(key, fn) {
        if (this.shouldCollectDebugMetrics()) {
            const start = performance.now();
            fn();
            this.recordRenderSubTiming(key, performance.now() - start);
            return;
        }
        fn();
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
        // Keep lighting low-res and let image smoothing create the soft vignette.
        const adaptiveEnabled = typeof DebugFlags === 'undefined' || DebugFlags.ADAPTIVE_RENDER_QUALITY !== false;
        const lightScale = adaptiveEnabled && this.renderQuality && this.renderQuality.vignetteScale
            ? this.renderQuality.vignetteScale
            : 0.5;
        const lightWidth = Math.floor(physicalWidth * lightScale);
        const lightHeight = Math.floor(physicalHeight * lightScale);

        if (this.vignetteCanvas.width !== lightWidth || this.vignetteCanvas.height !== lightHeight) {
            this.vignetteCanvas.width = lightWidth;
            this.vignetteCanvas.height = lightHeight;
            this.playerLightCanvas.width = lightWidth;
            this.playerLightCanvas.height = lightHeight;
        }

        const vCtx = this.vignetteCtx;
        const pCtx = this.playerLightCtx;

        // Reset mask contexts every frame - phase 4 leaves source-out active and a stale
        // composite/transform can prevent clears from wiping the buffer (reads as layering).
        vCtx.setTransform(1, 0, 0, 1, 0, 0);
        vCtx.globalCompositeOperation = 'source-over';
        vCtx.globalAlpha = 1;
        vCtx.clearRect(0, 0, this.vignetteCanvas.width, this.vignetteCanvas.height);
        vCtx.scale(dpr * lightScale, dpr * lightScale);

        pCtx.setTransform(1, 0, 0, 1, 0, 0);
        pCtx.globalCompositeOperation = 'source-over';
        pCtx.globalAlpha = 1;
        pCtx.clearRect(0, 0, this.playerLightCanvas.width, this.playerLightCanvas.height);
        pCtx.scale(dpr * lightScale, dpr * lightScale);

        const isMobile = typeof Input !== 'undefined' && Input.isMobileUiMode && Input.isMobileUiMode();
        const currentZoom = isMobile ? (this.mobileZoom || 1.0) : (this.baseZoom || 1.1);
        const centerX = logicalWidth / 2;
        const centerY = logicalHeight / 2;
        const visibleLists = this.visibleFrameLists || null;

        // Helper to get screen coordinates
        const getScreenPos = (x, y) => {
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
            const margin = radius; // Use light radius as margin

            const screenW = logicalWidth / currentZoom;
            const screenH = logicalHeight / currentZoom;

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
        const enemyLightCandidates = visibleLists && Array.isArray(visibleLists.enemyLights) ? visibleLists.enemyLights : this.enemies;
        enemyLightCandidates.forEach(enemy => {
            if (enemy && enemy.alive && !enemy.stealthEnemy && !this.enemyStealthMode) {
                const lightRadius = enemy.size * 4 + 100;
                if (!visibleLists && !isVisibleInVignette(enemy.x, enemy.y, lightRadius)) return;
                drawLight(vCtx, enemy.x, enemy.y, lightRadius);
            }
        });

        // Bosses need a dedicated mask punch so arena lighting never buries the centerpiece.
        const bossLightSources = new Set();
        const addBossLightSource = (enemy) => {
            if (!enemy) return;
            const isBossLike = enemy.isBoss ||
                enemy.bossName ||
                enemy.type === 'boss' ||
                enemy.shape === 'vortex' ||
                (enemy.constructor && /^Boss/.test(enemy.constructor.name || ''));
            if (isBossLike) bossLightSources.add(enemy);
        };
        if (Array.isArray(this.enemies)) {
            this.enemies.forEach(addBossLightSource);
        }
        if (typeof currentRoom !== 'undefined' && currentRoom && Array.isArray(currentRoom.enemies)) {
            currentRoom.enemies.forEach(addBossLightSource);
        }
        if (visibleLists && Array.isArray(visibleLists.enemies)) {
            visibleLists.enemies.forEach(addBossLightSource);
        }
        if (this.bossIntroData && this.bossIntroData.boss) {
            addBossLightSource(this.bossIntroData.boss);
        }
        bossLightSources.forEach(enemy => {
            if (!enemy || enemy.alive === false || enemy.dead === true) return;
            const bossSize = Math.max(60, enemy.size || enemy.collisionRadius || 80);
            const lightRadius = bossSize * 6 + 180;
            drawLight(vCtx, enemy.x, enemy.y, lightRadius);
        });

        // Draw the static settled voxel/fluid canvas to punch through vignette
        if (typeof VoxelStaticCanvas !== 'undefined' && VoxelStaticCanvas.dirty && VoxelStaticCanvas.canvas && VoxelStaticCanvas.canvas.width > 0 && VoxelStaticCanvas.canvas.height > 0) {
            vCtx.save();
            vCtx.translate(centerX + this.screenShakeOffset.x, centerY + this.screenShakeOffset.y);
            vCtx.scale(currentZoom, currentZoom);
            vCtx.translate(-this.camera.x, -this.camera.y);
            
            // Draw multiple times using 'screen' to accumulate alpha mask and punch through vignette darkness
            vCtx.globalCompositeOperation = 'screen';
            vCtx.drawImage(VoxelStaticCanvas.canvas, 0, 0);
            vCtx.drawImage(VoxelStaticCanvas.canvas, 0, 0);
            vCtx.drawImage(VoxelStaticCanvas.canvas, 0, 0);
            vCtx.restore();

            // Explicitly restore composite operation to lighten for subsequent lights
            vCtx.globalCompositeOperation = 'lighten';
        }

        // Generated scenery glows softly so physical biome shapes remain readable in darkness.
        if (typeof currentRoom !== 'undefined' && currentRoom && currentRoom.layout) {
            if (typeof prepareRoomRenderData === 'function') {
                prepareRoomRenderData(currentRoom, this.roomNumber);
            }
            const emitters = Array.isArray(currentRoom.sceneryLightEmitters)
                ? currentRoom.sceneryLightEmitters
                : (Array.isArray(currentRoom.layout.cachedSceneryLightEmitters) ? currentRoom.layout.cachedSceneryLightEmitters : []);
            const maxSceneryLights = adaptiveEnabled && this.renderQuality && this.renderQuality.maxSceneryLights
                ? this.renderQuality.maxSceneryLights
                : emitters.length;
            let sceneryLightsToDraw = emitters;
            if (maxSceneryLights < emitters.length) {
                const camX = this.camera.x;
                const camY = this.camera.y;
                sceneryLightsToDraw = emitters
                    .filter(emitter => emitter && isVisibleInVignette(emitter.x, emitter.y, emitter.radius))
                    .sort((a, b) => {
                        const da = (a.x - camX) * (a.x - camX) + (a.y - camY) * (a.y - camY);
                        const db = (b.x - camX) * (b.x - camX) + (b.y - camY) * (b.y - camY);
                        return da - db;
                    })
                    .slice(0, maxSceneryLights);
            } else {
                sceneryLightsToDraw = emitters.filter(emitter =>
                    emitter && isVisibleInVignette(emitter.x, emitter.y, emitter.radius)
                );
            }
            for (let i = 0; i < sceneryLightsToDraw.length; i++) {
                const emitter = sceneryLightsToDraw[i];
                drawLight(vCtx, emitter.x, emitter.y, emitter.radius);
            }
        }

        // Door Lights (Nexus Portal & Selection Doors & Level Exit)
        // 1. Nexus Portal (only in Nexus)
        if (this.state === 'NEXUS' && typeof nexusRoom !== 'undefined' && nexusRoom) {
            if (nexusRoom.portalPos && isVisibleInVignette(nexusRoom.portalPos.x, nexusRoom.portalPos.y, 250)) {
                drawLight(vCtx, nexusRoom.portalPos.x, nexusRoom.portalPos.y, 250);
            }
        }

        // 3. Ground Upgrades (if any) - CULLED
        if (typeof window.groundUpgrades !== 'undefined' && Array.isArray(window.groundUpgrades)) {
            window.groundUpgrades.forEach(upgrade => {
                if (upgrade.alpha > 0 && isVisibleInVignette(upgrade.x, upgrade.y, 150)) {
                    drawLight(vCtx, upgrade.x, upgrade.y, 150);
                }
            });
        }

        // 3.6. Ground Loot (Gear Items from groundLoot array) - CULLED
        // Note: Gear items use groundLoot array, NOT Game.groundItems
        const groundLootLights = visibleLists && Array.isArray(visibleLists.groundLoot)
            ? visibleLists.groundLoot
            : (typeof groundLoot !== 'undefined' && Array.isArray(groundLoot) ? groundLoot : []);
        groundLootLights.forEach(item => {
                // Match enemy light pattern: size * 4 + base
                // Gear items are larger, use bigger radius
                const lightRadius = 200;
                if (visibleLists || isVisibleInVignette(item.x, item.y, lightRadius)) {
                    drawLight(vCtx, item.x, item.y, lightRadius);
                }
        });

        // 3.7. Ground Items (Item System - Single Player) - CULLED
        // Note: Items use Game.groundItems array (not groundLoot)
        const groundItemLights = visibleLists && Array.isArray(visibleLists.groundItems)
            ? visibleLists.groundItems
            : (typeof Game !== 'undefined' && Game.groundItems && Array.isArray(Game.groundItems) ? Game.groundItems : []);
        groundItemLights.forEach(item => {
                const lightRadius = 150;
                if (visibleLists || isVisibleInVignette(item.x, item.y, lightRadius)) {
                    drawLight(vCtx, item.x, item.y, lightRadius);
                }
        });

        // 3.8. Item Pylons (Multiplayer Item Drops) - CULLED
        const pylonLights = visibleLists && Array.isArray(visibleLists.itemPylons)
            ? visibleLists.itemPylons
            : (typeof Game !== 'undefined' && Game.itemPylons && Array.isArray(Game.itemPylons) ? Game.itemPylons : []);
        pylonLights.forEach(pylon => {
                // Skip if disappearing
                if (pylon.disappearing) return;

                const lightRadius = 180;
                if (visibleLists || isVisibleInVignette(pylon.x, pylon.y, lightRadius)) {
                    drawLight(vCtx, pylon.x, pylon.y, lightRadius);
                }
        });

        // 4. Level Exit Door (Standard Door) - CULLED
        if (typeof currentRoom !== 'undefined' && currentRoom && currentRoom.doorOpen && typeof getDoorPosition === 'function') {
            const doorPos = getDoorPosition();
            if (doorPos) {
                const centerX = doorPos.x + doorPos.width / 2;
                const centerY = doorPos.y + doorPos.height / 2;
                if (isVisibleInVignette(centerX, centerY, 300)) {
                    drawLight(vCtx, centerX, centerY, 300);
                }
            }
        }

        // 5. Non-Player Projectiles (Enemy Projectiles) - CULLED
        const projectileLightCandidates = visibleLists && Array.isArray(visibleLists.projectileLights) ? visibleLists.projectileLights : this.projectiles;
        projectileLightCandidates.forEach(proj => {
            // Only render if NOT a player projectile
            if (!proj.playerId) {
                const lightRadius = proj.vignetteLightRadius || (proj.size * 6 + 50);
                if (visibleLists || isVisibleInVignette(proj.x, proj.y, lightRadius)) {
                    drawLight(vCtx, proj.x, proj.y, lightRadius);
                }
            }
        });

        // --- PHASE 2: PLAYER LIGHTS ---
        // Draw player lights, projectiles, and abilities directly onto vCtx (vignette light mask)
        // using 'lighten' so they combine correctly with world lights.
        vCtx.globalCompositeOperation = 'lighten';

        // Player Light (Local Player)
        if (this.player && this.player.alive) {
            drawLight(vCtx, this.player.x, this.player.y, 400); // Reduced from 600 for stealth gameplay
        }

        // Remote Players Lights (Multiplayer)
        if (this.remotePlayers && this.remotePlayers.length > 0) {
            this.remotePlayers.forEach(remotePlayer => {
                if (remotePlayer && !remotePlayer.dead) { // Check if alive
                    drawLight(vCtx, remotePlayer.x, remotePlayer.y, 400); // Reduced from 600
                }
            });
        }

        // Player Projectiles - CULLED
        projectileLightCandidates.forEach(proj => {
            if (proj.playerId) {
                const lightRadius = proj.size * 6 + 50;
                if (visibleLists || isVisibleInVignette(proj.x, proj.y, lightRadius)) {
                    drawLight(vCtx, proj.x, proj.y, lightRadius);
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
                const numLights = (this.renderQuality && this.renderQuality.maxBeamLights) || 8;
                for (let i = 0; i < numLights; i++) {
                    const t = numLights > 1 ? i / (numLights - 1) : 0;
                    const lightX = beam.origin.x + (endX - beam.origin.x) * t;
                    const lightY = beam.origin.y + (endY - beam.origin.y) * t;

                    // Larger lights at origin, smaller at end
                    const lightSize = 150 * (1 - t * 0.5);

                    if (isVisibleInVignette(lightX, lightY, lightSize)) {
                        drawLight(vCtx, lightX, lightY, lightSize);
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

                        const numLights = (this.renderQuality && this.renderQuality.maxBeamLights) || 8;
                        for (let i = 0; i < numLights; i++) {
                            const t = numLights > 1 ? i / (numLights - 1) : 0;
                            const lightX = beam.origin.x + (endX - beam.origin.x) * t;
                            const lightY = beam.origin.y + (endY - beam.origin.y) * t;
                            const lightSize = 150 * (1 - t * 0.5);

                            if (isVisibleInVignette(lightX, lightY, lightSize)) {
                                drawLight(vCtx, lightX, lightY, lightSize);
                            }
                        }
                    });
                }
            });
        }

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

        vCtx.scale(currentZoom, currentZoom);
        vCtx.translate(-this.camera.x, -this.camera.y);

        // Draw grid lines (using lighten to add to light mask)
        // The pattern has the glow "baked in" (wide lines with alpha)
        if (typeof drawBiomeGrid === 'function') {
            drawBiomeGrid(vCtx, this.roomNumber, true); // true = isVignetteMask
        }

        vCtx.restore();

        // Boss hazard beams cut through darkness (light cage, refraction lasers, etc.)
        const bossVignetteCandidates = visibleLists && Array.isArray(visibleLists.enemies)
            ? visibleLists.enemies
            : (Array.isArray(this.enemies) ? this.enemies : []);
        bossVignetteCandidates.forEach(enemy => {
            if (!enemy || !enemy.alive || typeof enemy.drawVignetteCuts !== 'function') return;
            enemy.drawVignetteCuts(vCtx, getScreenPos, isVisibleInVignette);
        });

        // --- PHASE 4: APPLY DARKNESS ---
        vCtx.globalCompositeOperation = 'source-out';
        vCtx.globalAlpha = 1;
        vCtx.fillStyle = 'rgba(0, 0, 0, 1.0)';
        vCtx.fillRect(0, 0, logicalWidth, logicalHeight);

        // --- PHASE 5: RENDER TO SCREEN ---
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(this.vignetteCanvas, 0, 0, physicalWidth, physicalHeight);
        ctx.restore();
    },

    // Render game world (player, enemies, etc.)
    renderGameWorld(ctx) {
        // Note: ctx is now likely the offscreen context, but logic remains the same
        // Camera transform is already applied by caller

        const glowPhaseStart = performance.now();

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

        const frameLists = {
            enemies: [],
            enemyLights: [],
            projectiles: [],
            projectileLights: [],
            groundLoot: [],
            groundItems: [],
            itemPylons: []
        };
        this.enemies.forEach(enemy => {
            if (!enemy) return;
            const visible = enemy.alive ||
                (typeof isEnemyDeathJuiceVisible === 'function' && isEnemyDeathJuiceVisible(enemy));
            if (!visible) return;
            if (isVisible(enemy, enemy.size * 3)) frameLists.enemies.push(enemy);
            if (isVisible(enemy, enemy.size * 4 + 100)) frameLists.enemyLights.push(enemy);
        });
        this.projectiles.forEach(projectile => {
            if (!projectile) return;
            if (isVisible(projectile, projectile.size * 4)) frameLists.projectiles.push(projectile);
            const lightMargin = projectile.vignetteLightRadius || (projectile.size * 6 + 50);
            if (isVisible(projectile, lightMargin)) frameLists.projectileLights.push(projectile);
        });
        if (typeof groundLoot !== 'undefined' && Array.isArray(groundLoot)) {
            groundLoot.forEach(item => { if (isVisible(item, 50)) frameLists.groundLoot.push(item); });
        }
        if (this.groundItems && Array.isArray(this.groundItems)) {
            this.groundItems.forEach(item => { if (isVisible(item, 20)) frameLists.groundItems.push(item); });
        }
        if (this.itemPylons && Array.isArray(this.itemPylons)) {
            this.itemPylons.forEach(pylon => { if (pylon && !pylon.disappearing && isVisible(pylon, 30)) frameLists.itemPylons.push(pylon); });
        }
        this.visibleFrameLists = frameLists;

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

        const getCachedGlow = (color) => this.getCachedGlowSprite(color);

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
            const cachedRadius = 128;
            const drawSize = cachedCanvas.width * (size / cachedRadius);
            const half = drawSize * 0.5;
            ctx.drawImage(cachedCanvas, x - half, y - half, drawSize, drawSize);
        };

        // Draw Enemy Glows (Culled)
        // Skip individual enemies with stealth flag OR if global stealth mode enabled
        frameLists.enemies.forEach(enemy => {
            // Skip if this enemy is stealth OR global stealth mode is on
            if (!enemy.stealthEnemy && !this.enemyStealthMode) {
                const glowSize = enemy.size * 2.5;
                drawGlow(enemy.x, enemy.y, glowSize, enemy.color);
            }
        });

        // Draw Projectile Glows (Culled)
        frameLists.projectiles.forEach(projectile => {
            const glowSize = projectile.glowSize || (projectile.size * 3.0);
            const color = projectile.color || (projectile.type === 'knife' ? '#ff1493' : '#ffff00');
            drawGlow(projectile.x, projectile.y, glowSize, color);
        });

        // Draw Ground Loot Glows (Gear Items from groundLoot array) - Culled
        // Note: Gear items use groundLoot array, NOT Game.groundItems
        if (typeof groundLoot !== 'undefined' && Array.isArray(groundLoot)) {
            // Gear tier colors
            const gearTierColors = {
                gray: '#999999',
                white: '#cccccc',
                green: '#4caf50',
                blue: '#2196f3',
                purple: '#9c27b0',
                orange: '#ff9800'
            };

            frameLists.groundLoot.forEach(gear => {
                const glowSize = 60; // Fixed size for gear
                const color = gearTierColors[gear.tier] || '#cccccc';
                drawGlow(gear.x, gear.y, glowSize, color);
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

            frameLists.groundItems.forEach(item => {
                const pulseSize = 2 + Math.sin(item.pulse || 0) * 2;
                const glowSize = (item.size + pulseSize) * 3.0;
                const rarity = item.definition?.rarity || 'common';
                const color = itemRarityColors[rarity] || '#999999';
                drawGlow(item.x, item.y, glowSize, color);
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

            frameLists.itemPylons.forEach(pylon => {
                const pulseSize = 3 + Math.sin(pylon.pulse || 0) * 2;
                const glowSize = (pylon.size + pulseSize) * 3.5;
                const rarity = pylon.rarity || 'common';
                const color = itemRarityColors[rarity] || '#999999';
                drawGlow(pylon.x, pylon.y, glowSize, color);
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

        const glowPhaseTime = performance.now() - glowPhaseStart;
        if (this.currentFrameTimings) {
            this.currentFrameTimings.worldGlow += glowPhaseTime;
        }
        this.recordRenderSubTiming('worldGlow', glowPhaseTime);

        const bodiesPhaseStart = performance.now();

        // ------------------------------------------
        // PHASE 2: THE BODIES (The "Solid" look)
        // ------------------------------------------
        // ctx.globalCompositeOperation is 'source-over' by default after restore

        // Draw item aura rings (damage aura, slow aura) - BEFORE player render so they appear underneath
        if (typeof renderItemVisuals !== 'undefined') {
            renderItemVisuals(ctx);
        }

        if (typeof renderVoxelStaticLayer === 'function') {
            renderVoxelStaticLayer(ctx);
        }

        if (typeof renderDebrisInteractiveFixtures === 'function') {
            renderDebrisInteractiveFixtures(ctx, this.roomNumber);
        }

        // Draw ground loot above floor debris/splatters
        if (typeof renderGroundLoot !== 'undefined') {
            const visibleLoot = frameLists.groundLoot;
            this.trackRenderSection('groundLoot', () => {
                renderGroundLoot(ctx, visibleLoot);
            });
        }

        if (typeof renderVoxelActiveParticles === 'function') {
            renderVoxelActiveParticles(ctx);
        }

        // Draw ground items (item system - single player)
        if (typeof renderGroundItems !== 'undefined') {
            renderGroundItems(ctx, frameLists.groundItems);
        }

        // Draw item pylons (multiplayer item drops)
        if (typeof renderItemPylons !== 'undefined') {
            renderItemPylons(ctx);
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
        frameLists.enemies.forEach(enemy => {
            enemy.render(ctx);
        });

        // Draw projectiles (Solid bodies)
        frameLists.projectiles.forEach(projectile => {
            if (projectile.trailLength && projectile.vx !== undefined && projectile.vy !== undefined) {
                const trailLength = Math.min(6, Math.max(1, projectile.trailLength));
                const speed = Math.sqrt(projectile.vx * projectile.vx + projectile.vy * projectile.vy) || 1;
                const dirX = projectile.vx / speed;
                const dirY = projectile.vy / speed;
                const color = projectile.trailColor || projectile.color || '#ffff00';
                ctx.save();
                ctx.globalCompositeOperation = 'screen';
                for (let i = trailLength; i >= 1; i--) {
                    const alpha = (1 - i / (trailLength + 1)) * 0.35;
                    const offset = i * projectile.size * 1.35;
                    ctx.globalAlpha = alpha;
                    ctx.fillStyle = color;
                    ctx.beginPath();
                    ctx.arc(
                        projectile.x - dirX * offset,
                        projectile.y - dirY * offset,
                        projectile.size * (1 - i * 0.1),
                        0,
                        Math.PI * 2
                    );
                    ctx.fill();
                }
                ctx.restore();
            }
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
                ctx.fillStyle = projectile.color || '#ffff00';
                ctx.beginPath();
                ctx.arc(projectile.x, projectile.y, projectile.size, 0, Math.PI * 2);
                ctx.fill();
            }
        });



        // Draw safe room machines
        if (typeof currentRoom !== 'undefined' && currentRoom && currentRoom.type === 'safe') {
            const machines = (typeof window.getSafeRoomMachines === 'function') ? window.getSafeRoomMachines(currentRoom) : [];
            machines.forEach(machine => {
                const dx = machine.x - (this.player ? this.player.x : 0);
                const dy = machine.y - (this.player ? this.player.y : 0);
                const distance = Math.sqrt(dx * dx + dy * dy);
                const isNear = distance < machine.range;
                const saveLocked = machine.id === 'runSave' && !!this.safeRoomUsedThisVisit;

                const isRunSave = machine.id === 'runSave';
                const machineWidth = isRunSave ? 140 : 130;
                const machineHeight = isRunSave ? 78 : 65;
                const machineX = Math.round(machine.x - machineWidth / 2);
                const machineY = Math.round(machine.y - machineHeight / 2);

                ctx.save();

                const accent = saveLocked ? '#888888' : '#00ffcc';
                // Panel background
                ctx.fillStyle = saveLocked
                    ? (isNear ? 'rgba(80, 80, 80, 0.25)' : 'rgba(40, 40, 40, 0.2)')
                    : (isNear ? 'rgba(0, 255, 204, 0.15)' : 'rgba(0, 255, 204, 0.05)');
                ctx.fillRect(machineX, machineY, machineWidth, machineHeight);

                // Neon Border
                ctx.strokeStyle = accent;
                ctx.lineWidth = isNear ? 2 : 1;
                ctx.shadowColor = accent;
                ctx.shadowBlur = isNear ? 8 : 2;
                ctx.strokeRect(machineX, machineY, machineWidth, machineHeight);
                ctx.shadowBlur = 0;
                ctx.shadowColor = 'transparent';

                if (isRunSave) {
                    // Lost's PS2 is the Save Run icon (no floppy)
                    drawLostPs2EasterEgg(ctx, machine.x, machine.y - 10, {
                        lit: !saveLocked,
                        near: isNear,
                        scale: 0.72,
                        groundShadow: false
                    });
                } else {
                    ctx.fillStyle = accent;
                    ctx.font = '24px Orbitron';
                    ctx.textAlign = 'center';
                    ctx.fillText(machine.icon, machine.x, machine.y - 6);
                }

                // Name
                ctx.fillStyle = saveLocked ? '#aaaaaa' : '#ffffff';
                ctx.font = 'bold 11px Orbitron';
                ctx.textAlign = 'center';
                ctx.fillText(machine.name, machine.x, isRunSave ? machine.y + 22 : machine.y + 20);

                // Prompt
                if (isNear && typeof Input !== 'undefined') {
                    const promptY = isRunSave ? machine.y + 52 : machine.y + 48;
                    if (saveLocked) {
                        ctx.fillStyle = '#ff8888';
                        ctx.font = '10px Orbitron';
                        ctx.fillText('Locked after use', machine.x, promptY);
                    } else if (Input.drawInteractionPrompt) {
                        Input.drawInteractionPrompt(ctx, 'select', machine.x, promptY);
                    } else {
                        ctx.fillStyle = '#00ffcc';
                        ctx.font = '12px Orbitron';
                        ctx.fillText('Press [G] to open', machine.x, promptY);
                    }
                }

                ctx.restore();
            });
        }

        // Draw pre-boss healer machine (visible only once the boss door is open)
        if (typeof currentRoom !== 'undefined' && currentRoom && currentRoom.doorOpen && currentRoom.preBossHealer) {
            const healer = currentRoom.preBossHealer;
            const dx = healer.x - (this.player ? this.player.x : 0);
            const dy = healer.y - (this.player ? this.player.y : 0);
            const distance = Math.sqrt(dx * dx + dy * dy);
            const isNear = distance < healer.range;

            // Per-player used check
            if (!healer.usedBy) healer.usedBy = new Set();
            const localHealerId = typeof this.getLocalPlayerId === 'function' ? this.getLocalPlayerId() : 'local';
            const usedByMe = healer.usedBy.has(localHealerId);

            const machineWidth = 150;
            const machineHeight = 72;
            const machineX = Math.round(healer.x - machineWidth / 2);
            const machineY = Math.round(healer.y - machineHeight / 2);
            const t = Date.now() * 0.002;
            const pulse = usedByMe ? 0 : (0.5 + Math.sin(t) * 0.5);

            ctx.save();

            if (usedByMe) {
                // Used state - dark, offline
                ctx.fillStyle = 'rgba(40, 40, 40, 0.55)';
                ctx.fillRect(machineX, machineY, machineWidth, machineHeight);
                ctx.strokeStyle = 'rgba(80, 80, 80, 0.7)';
                ctx.lineWidth = 1.5;
                ctx.strokeRect(machineX, machineY, machineWidth, machineHeight);
                ctx.font = '26px serif';
                ctx.textAlign = 'center';
                ctx.fillStyle = '#666666';
                ctx.fillText('\u{1F5A4}', healer.x, healer.y - 4);
                ctx.fillStyle = '#777777';
                ctx.font = 'bold 11px Orbitron, monospace';
                ctx.fillText('Already Used', healer.x, healer.y + 20);
            } else {
                // Active state - vivid green glow halo
                ctx.globalCompositeOperation = 'lighter';
                const haloGrad = ctx.createRadialGradient(healer.x, healer.y, 0, healer.x, healer.y, 110 + pulse * 20);
                haloGrad.addColorStop(0, `rgba(0, 255, 100, ${0.06 + pulse * 0.06})`);
                haloGrad.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = haloGrad;
                ctx.fillRect(healer.x - 130, healer.y - 130, 260, 260);
                ctx.globalCompositeOperation = 'source-over';

                // Panel background
                ctx.fillStyle = isNear
                    ? `rgba(0, 28, 18, ${0.88 + pulse * 0.05})`
                    : 'rgba(0, 20, 14, 0.82)';
                ctx.fillRect(machineX, machineY, machineWidth, machineHeight);

                // Glowing border
                ctx.shadowColor = '#00ff66';
                ctx.shadowBlur = isNear ? 18 + pulse * 12 : 8 + pulse * 4;
                ctx.strokeStyle = isNear ? `rgba(0,255,100,${0.9 + pulse * 0.1})` : '#00cc55';
                ctx.lineWidth = isNear ? 2.5 : 1.5;
                ctx.strokeRect(machineX, machineY, machineWidth, machineHeight);
                ctx.shadowBlur = 0;

                // Icon - large, bright
                ctx.font = '28px serif';
                ctx.textAlign = 'center';
                ctx.fillStyle = `rgba(60,255,140,${0.85 + pulse * 0.15})`;
                ctx.shadowColor = '#00ff88';
                ctx.shadowBlur = 12 + pulse * 8;
                ctx.fillText(healer.icon || '\u{1F49A}', healer.x, healer.y - 2);
                ctx.shadowBlur = 0;

                // Name label - white with drop-shadow for legibility
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 12px Orbitron, monospace';
                ctx.textAlign = 'center';
                ctx.shadowColor = 'rgba(0,0,0,0.95)';
                ctx.shadowOffsetX = 1; ctx.shadowOffsetY = 1;
                ctx.shadowBlur = 5;
                ctx.fillText(healer.name || 'Pre-Boss Healer', healer.x, healer.y + 22);
                ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0; ctx.shadowBlur = 0;

                // Heal amount tag
                ctx.fillStyle = `rgba(80,255,140,${0.7 + pulse * 0.2})`;
                ctx.font = 'bold 10px Orbitron, monospace';
                ctx.fillText('+25% HP', healer.x, healer.y + 35);

                // Interaction Prompt
                if (isNear && typeof Input !== 'undefined') {
                    if (Input.drawInteractionPrompt) {
                        Input.drawInteractionPrompt(ctx, 'select', healer.x, healer.y + 54);
                    } else {
                        ctx.fillStyle = '#00ff88';
                        ctx.font = '11px Orbitron';
                        ctx.fillText('Press [G] to Heal', healer.x, healer.y + 54);
                    }
                }
            }

            ctx.restore();
        }


        // Draw door if room is cleared
        if (typeof currentRoom !== 'undefined' && currentRoom && currentRoom.doorOpen) {
            const door = getDoorPosition();
            Renderer.door(ctx, door.x, door.y, door.width, door.height, this.doorPulse);
            if (this.nearExitDoor && typeof Input !== 'undefined' && Input.drawInteractionPrompt) {
                ctx.save();
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 15px Orbitron, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
                ctx.shadowBlur = 4;
                ctx.shadowOffsetX = 1;
                ctx.shadowOffsetY = 1;
                const promptX = door.x + door.width / 2;
                const promptY = door.y + door.height + 35;
                Input.drawInteractionPrompt(ctx, 'enter next room', promptX, promptY);
                ctx.restore();
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

        const bodiesPhaseTime = performance.now() - bodiesPhaseStart;
        if (this.currentFrameTimings) {
            this.currentFrameTimings.worldBodies += bodiesPhaseTime;
        }
        this.recordRenderSubTiming('worldBodies', bodiesPhaseTime);
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

    // Cleanup run state (called when returning to nexus, restarting, or game over)
    cleanupRunState() {
        if (this.player && this.player.itemManager) {
            this.player.itemManager.clearAllItems();
        }

        if (typeof Game !== 'undefined' && Game.groundItems && Array.isArray(Game.groundItems)) {
            Game.groundItems.length = 0;
        }

        if (typeof Game !== 'undefined' && Game.itemPylons && Array.isArray(Game.itemPylons)) {
            Game.itemPylons.length = 0;
        }
    },

    // Credit rewards immediately on game over / death
    creditRewards() {
        if (this.rewardsCredited) return;
        this.rewardsCredited = true;

        if (this.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.isHost) {
            console.log('[Game] Crediting rewards on game over (Multiplayer Host)');
            const localPlayerId = this.getLocalPlayerId();

            // Award shards and credits for local player
            if (this.player && this.player.dead) {
                if (this.shardsEarned > 0 && typeof SaveSystem !== 'undefined' && SaveSystem.addCardShards) {
                    SaveSystem.addCardShards(this.shardsEarned);
                    console.log(`[Game Over] Awarded ${this.shardsEarned} shards to local player`);
                }

                if (this.currencyEarned > 0) {
                    const banked = this.currencyBankedThisRun || 0;
                    const remaining = Math.max(0, Math.floor(this.currencyEarned) - banked);
                    if (remaining > 0) {
                        const currentCurrency = this.playerCurrencies.get(localPlayerId) || 0;
                        const newCurrency = Math.floor(currentCurrency + remaining);
                        this.playerCurrencies.set(localPlayerId, newCurrency);

                        if (typeof SaveSystem !== 'undefined') {
                            SaveSystem.setCurrency(newCurrency);
                            this.currentCurrency = newCurrency;
                        }

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
                        this.currencyBankedThisRun = banked + remaining;
                    }
                }
            }

            // Award shards and credits for remote players who died
            if (this.deadPlayers && this.deadPlayers.size > 0) {
                this.deadPlayers.forEach(playerId => {
                    if (playerId !== localPlayerId) {
                        const shardsEarned = this.calculateShardsForPlayer ? this.calculateShardsForPlayer(playerId) : 0;
                        const currencyEarned = this.calculateCurrencyForPlayer(playerId);

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

                        if (currencyEarned > 0) {
                            const banked = this.currencyBankedThisRun || 0;
                            const remaining = Math.max(0, Math.floor(currencyEarned) - banked);
                            if (remaining <= 0) return;

                            const currentCurrency = this.playerCurrencies.get(playerId) || 0;
                            const newCurrency = Math.floor(currentCurrency + remaining);
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

                            const player = multiplayerManager.players.find(p => p.id === playerId);
                            if (player) {
                                player.currency = newCurrency;
                            }
                        }
                    }
                });
            }
        } else if (this.multiplayerEnabled && this.isMultiplayerClient && this.isMultiplayerClient()) {
            console.log('[Game] Crediting rewards on game over (Multiplayer Client Fallback/Pre-emptive)');
            if (this.player && this.player.dead) {
                if (typeof SaveSystem !== 'undefined') {
                    if (this.shardsEarned === 0 && this.calculateShards) {
                        this.shardsEarned = this.calculateShards();
                    }
                    if (this.shardsEarned > 0 && SaveSystem.addCardShards) {
                        SaveSystem.addCardShards(this.shardsEarned);
                        console.log(`[Game Over] Client awarded ${this.shardsEarned} shards (pre-emptive)`);
                    }

                    if (this.currencyEarned === 0 && this.calculateCurrency) {
                        this.currencyEarned = this.calculateCurrency();
                    }
                    // Credits are banked live mid-run; only top up leftovers (avoid double-pay)
                    const clientRemaining = Math.max(0, Math.floor(this.currencyEarned || 0) - (this.currencyBankedThisRun || 0));
                    if (clientRemaining > 0) {
                        SaveSystem.addCurrency(clientRemaining);
                        const saveData = SaveSystem.load();
                        this.currentCurrency = Math.floor(saveData.currency || 0);
                        this.currencyBankedThisRun = (this.currencyBankedThisRun || 0) + clientRemaining;
                        console.log(`[Game Over] Client topped up ${clientRemaining} credits`);
                    }
                }
            }
        } else {
            console.log('[Game] Crediting rewards on game over (Single Player)');
            if (this.player && this.player.dead) {
                if (typeof SaveSystem !== 'undefined') {
                    if (this.shardsEarned > 0 && SaveSystem.addCardShards) {
                        SaveSystem.addCardShards(this.shardsEarned);
                        console.log(`[Game Over] Awarded ${this.shardsEarned} shards`);
                    }

                    // Credits already persist on elite/boss kills; only bank any remainder
                    if (this.currencyEarned === 0 && this.calculateCurrency) {
                        this.currencyEarned = this.calculateCurrency();
                    }
                    const remaining = Math.max(0, Math.floor(this.currencyEarned || 0) - (this.currencyBankedThisRun || 0));
                    if (remaining > 0) {
                        SaveSystem.addCurrency(remaining);
                        const saveData = SaveSystem.load();
                        this.currentCurrency = Math.floor(saveData.currency || 0);
                        this.currencyBankedThisRun = (this.currencyBankedThisRun || 0) + remaining;
                        console.log(`[Game Over] Topped up ${remaining} credits`);
                    }
                }
            }
        }
    },

    // Return to nexus after death
    returnToNexus() {
        // Multiplayer clients: wait for host signal
        if (this.waitingForHostReturn && this.isMultiplayerClient()) {
            console.log('[Client] Waiting for host to signal return to nexus');
            return;
        }

        if (typeof multiplayerManager !== 'undefined' && multiplayerManager &&
            typeof multiplayerManager.clearRunClassLocks === 'function') {
            multiplayerManager.clearRunClassLocks();
        }
        if (this.disconnectedPlayerIds) this.disconnectedPlayerIds.clear();
        if (this.disconnectedRunSnapshots) this.disconnectedRunSnapshots.clear();

        // Safety net: abandon/death clears any leftover solo checkpoint
        if (typeof SaveSystem !== 'undefined' && SaveSystem.clearActiveRunCheckpoint) {
            SaveSystem.clearActiveRunCheckpoint();
        }

        // Multiplayer: Host calculates and distributes currency rewards
        if (this.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.isHost) {
            // Ensure rewards are credited if not already done
            this.creditRewards();

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
            // Ensure rewards are credited if not already done
            this.creditRewards();
            this.currencyEarned = 0;
            this.shardsEarned = 0;
        } else {
            // Single-player: Award shards and credits earned if not already credited
            this.creditRewards();
            this.currencyEarned = 0;
            this.shardsEarned = 0;
        }

        if (typeof Telemetry !== 'undefined') {
            let result = 'abandoned';
            if (this.allPlayersDead || (this.player && this.player.dead)) {
                result = 'failure';
            } else if (typeof currentRoom !== 'undefined' && currentRoom && currentRoom.type === 'boss' && currentRoom.cleared) {
                result = 'success';
            }

            this.finalizeTelemetryRun({
                result,
                reason: 'returnToNexus'
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
        this.roomEnterTransition = null;
        if (typeof initializeRoom !== 'undefined') {
            currentRoom = null;
            if (typeof window !== 'undefined') {
                window.currentRoom = null;
            }
        }
        if (typeof RunProfiler !== 'undefined' && RunProfiler.isActive()) {
            RunProfiler.endRun('returnToNexus');
            console.log('[RunProfiler] Profile captured on return to Nexus:\n' + RunProfiler.getSummaryText());
        }
        this.enemies = [];
        this.projectiles = (typeof createProjectileList === 'function' ? createProjectileList() : []);
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
        this.currencyBankedThisRun = 0;
        this.shardsEarned = 0;
        this.lastGKeyState = false;
        this.clickHandled = false;
        this.deathScreenStartTime = 0; // Reset death screen timer
        this.waitingForHostReturn = false; // Clear waiting flag
        this.finalStats = null; // Clear final stats

        if (this.deadPlayers) {
            this.deadPlayers.clear();
        }
        this.allPlayersDead = false;
        this.spectateMode = false;

        // Clear ground loot
        if (typeof groundLoot !== 'undefined') {
            groundLoot.length = 0;
        }

        this.cleanupRunState();

        // Clean up multiplayer shadow instances (clients only)
        if (this.remotePlayerShadowInstances) {
            this.remotePlayerShadowInstances.clear();
            console.log('[Client] Cleared shadow instances on return to nexus');
        }

        // Initialize nexus if needed
        if (typeof initNexus !== 'undefined') {
            initNexus();
        }

        if (typeof Onboarding !== 'undefined' && Onboarding.onNexusEnter) {
            Onboarding.onNexusEnter();
        }
        if (typeof FeatureTutorials !== 'undefined' && FeatureTutorials.onNexusEnter) {
            FeatureTutorials.onNexusEnter();
        }

        // Camera after onboarding / feature tutorials may have restaged the player
        this.initializeNexusCamera();

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

    calculateShards() {
        if (!this.player) return 0;

        const roomsCleared = Math.max(0, this.roomNumber - 1);
        const enemiesKilled = this.enemiesKilled || 0;
        const levelReached = this.player.level || 1;

        // Boosted rewards in gear mode, standard in card mode
        const roomScale = this.gameMode === 'gear' ? 12 : 9;
        const killScale = this.gameMode === 'gear' ? 2.4 : 1.8;
        const lvlScale = this.gameMode === 'gear' ? 1.2 : 0.9;

        const base = roomScale * roomsCleared;
        const bonus = killScale * enemiesKilled;
        const levelBonus = lvlScale * levelReached;

        let total = base + bonus + levelBonus;

        // Apply currency boost from room modifiers (Prism Tax) - also affects shards
        if (this.nextRoomModifiers && typeof this.nextRoomModifiers.currencyBoost === 'number' && this.nextRoomModifiers.currencyBoost > 0) {
            total *= (1 + this.nextRoomModifiers.currencyBoost);
            console.log(`[Shards] Applied ${(this.nextRoomModifiers.currencyBoost * 100).toFixed(0)}% boost from Prism Tax`);
        }

        return Math.floor(total);
    },

    // Calculate currency (credits) earned from run
    calculateCurrency() {
        // Live mid-run banking (trash + elite + boss) is the source of truth
        if ((this.currencyEarned || 0) > 0 || (this.currencyBankedThisRun || 0) > 0) {
            return Math.floor(this.currencyEarned || this.currencyBankedThisRun || 0);
        }

        if (!this.player) return 0;

        const elitesKilled = this.elitesKilled || 0;
        const bossesKilled = this.bossesKilled || 0;
        const eliteBase = (typeof CombatEconomy !== 'undefined' && CombatEconomy.CREDIT_BASE)
            ? CombatEconomy.CREDIT_BASE.OctagonEnemy
            : (this.ELITE_CREDIT_REWARD || 15);
        const bossBase = (typeof CombatEconomy !== 'undefined' && CombatEconomy.BOSS_CREDIT_BASE)
            ? CombatEconomy.BOSS_CREDIT_BASE
            : (this.BOSS_CREDIT_REWARD || 50);

        let total = eliteBase * elitesKilled + bossBase * bossesKilled;

        // Apply currency boost from room modifiers (Prism Tax)
        if (this.nextRoomModifiers && typeof this.nextRoomModifiers.currencyBoost === 'number' && this.nextRoomModifiers.currencyBoost > 0) {
            total *= (1 + this.nextRoomModifiers.currencyBoost);
            console.log(`[Currency] Applied ${(this.nextRoomModifiers.currencyBoost * 100).toFixed(0)}% boost from Prism Tax`);
        }

        return Math.floor(total);
    },

    /**
     * Bank persistent credits immediately (trash / elite / boss kills).
     * Shards stay end-of-run meta via creditRewards().
     */
    awardRunCredits(baseAmount, reason = 'combat') {
        const isClient = this.isMultiplayerClient && this.isMultiplayerClient();
        if (isClient) return 0;

        let amount = Math.floor(Number(baseAmount) || 0);
        if (amount <= 0) return 0;

        if (this.nextRoomModifiers && typeof this.nextRoomModifiers.currencyBoost === 'number' && this.nextRoomModifiers.currencyBoost > 0) {
            amount = Math.floor(amount * (1 + this.nextRoomModifiers.currencyBoost));
        }
        if (amount <= 0) return 0;

        this.currencyEarned = (this.currencyEarned || 0) + amount;
        this.currencyBankedThisRun = (this.currencyBankedThisRun || 0) + amount;

        if (this.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.isHost) {
            const players = multiplayerManager.players || [];
            const localPlayerId = this.getLocalPlayerId ? this.getLocalPlayerId() : null;

            players.forEach(player => {
                if (!player || !player.id) return;
                // Skip players already dead this run (no mid-run earn after death)
                if (this.deadPlayers && this.deadPlayers.has(player.id)) return;

                const currentCurrency = this.playerCurrencies.get(player.id)
                    || (player.id === localPlayerId && typeof SaveSystem !== 'undefined' ? SaveSystem.getCurrency() : (player.currency || 0));
                const newCurrency = Math.floor(currentCurrency + amount);
                this.playerCurrencies.set(player.id, newCurrency);
                player.currency = newCurrency;

                if (player.id === localPlayerId) {
                    this.currentCurrency = newCurrency;
                    if (typeof SaveSystem !== 'undefined' && SaveSystem.setCurrency) {
                        SaveSystem.setCurrency(newCurrency);
                    }
                }

                if (multiplayerManager.send) {
                    multiplayerManager.send({
                        type: 'currency_update',
                        data: {
                            targetPlayerId: player.id,
                            newCurrency,
                            reason: reason || 'run_credit'
                        }
                    });
                }
            });
        } else if (typeof SaveSystem !== 'undefined' && SaveSystem.addCurrency) {
            const newBal = SaveSystem.addCurrency(amount);
            this.currentCurrency = Math.floor(newBal);
        } else {
            this.currentCurrency = Math.floor((this.currentCurrency || 0) + amount);
        }

        console.log(`[Credits] +${amount} (${reason}) → banked this run ${this.currencyBankedThisRun}`);
        return amount;
    },

    // Calculate shards for a specific player (multiplayer)
    calculateShardsForPlayer(playerId) {
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

        // Boosted rewards in gear mode, standard in card mode
        const roomScale = this.gameMode === 'gear' ? 12 : 9;
        const killScale = this.gameMode === 'gear' ? 2.4 : 1.8;
        const lvlScale = this.gameMode === 'gear' ? 1.2 : 0.9;

        const base = roomScale * roomsCleared;
        const bonus = killScale * enemiesKilled;
        const levelBonus = lvlScale * levelReached;

        let total = base + bonus + levelBonus;

        // Apply currency boost from room modifiers (Prism Tax) - also affects shards
        if (this.nextRoomModifiers && typeof this.nextRoomModifiers.currencyBoost === 'number' && this.nextRoomModifiers.currencyBoost > 0) {
            total *= (1 + this.nextRoomModifiers.currencyBoost);
        }

        return Math.floor(total);
    },

    // Calculate currency (credits) for a specific player (multiplayer)
    calculateCurrencyForPlayer(playerId) {
        // Shared pool: mid-run awards already banked equally; prefer live total
        if ((this.currencyEarned || 0) > 0 || (this.currencyBankedThisRun || 0) > 0) {
            return Math.floor(this.currencyEarned || this.currencyBankedThisRun || 0);
        }

        const elitesKilled = this.elitesKilled || 0;
        const bossesKilled = this.bossesKilled || 0;
        const eliteBase = (typeof CombatEconomy !== 'undefined' && CombatEconomy.CREDIT_BASE)
            ? CombatEconomy.CREDIT_BASE.OctagonEnemy
            : 15;
        const bossBase = (typeof CombatEconomy !== 'undefined' && CombatEconomy.BOSS_CREDIT_BASE)
            ? CombatEconomy.BOSS_CREDIT_BASE
            : 50;
        let total = eliteBase * elitesKilled + bossBase * bossesKilled;

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

        if (typeof Onboarding !== 'undefined' && Onboarding.notifyRunStarted) {
            Onboarding.notifyRunStarted();
        }

        this.gameOverMusicPlaying = false;

        // Only create a new player if one doesn't exist or if the class doesn't match
        // This preserves the nexus player and its initialized state (including HUD)
        const initialSpawnPoint = this.getRoomSpawnPoint(null, 0);
        if (!this.player || this.player.playerClass !== this.selectedClass) {
            this.player = createPlayer(this.selectedClass, initialSpawnPoint.x, initialSpawnPoint.y);
            this.player.playerId = this.getLocalPlayerId(); // Set player ID for damage attribution
        } else {
            // Player already exists with correct class, just reset position and HP
            this.player.x = initialSpawnPoint.x;
            this.player.y = initialSpawnPoint.y;
            this.player.hp = this.player.maxHp;
            this.player.dead = false;
            this.player.alive = true;
            this.player.playerId = this.getLocalPlayerId();
        }

        // Reset tracking before the first room is generated and telemetry starts.
        this.enemiesKilled = 0;
        this.roomNumber = (typeof Room0Tutorial !== 'undefined' && Room0Tutorial.shouldEnter && Room0Tutorial.shouldEnter())
            ? 0
            : 1;
        this.doorPulse = 0;
        this.startTime = Date.now();

        // Initialize per-player stats tracking
        this.initializePlayerStats();

        // MP: freeze classes for the run (host path never goes through handleGameStart)
        if (this.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager &&
            typeof multiplayerManager.lockRunClasses === 'function') {
            multiplayerManager.lockRunClasses();
        }

        this.showPauseMenu = false;
        this.pausedFromState = null;
        this.roomEnterTransition = null;

        // Reset room system
        if (typeof initializeRoom !== 'undefined') {
            currentRoom = null;
            if (typeof window !== 'undefined') {
                window.currentRoom = null;
            }
        }

        this.spawnEnemies();
        this.updateMusicForCurrentRoom();

        if (typeof RunProfiler !== 'undefined') {
            if (RunProfiler.autoStartOnRun && !RunProfiler.isActive()) {
                RunProfiler.start({
                    gameMode: this.gameMode || null,
                    selectedClass: this.selectedClass || null,
                    multiplayer: !!this.multiplayerEnabled
                });
                if (typeof DebugFlags !== 'undefined') {
                    DebugFlags.RENDER_TIMING = true;
                }
            }
        }

        const recordStartTelemetry = () => {
            if (typeof Telemetry === 'undefined') {
                return;
            }
            const localPlayerId = this.getLocalPlayerId ? this.getLocalPlayerId() : 'local';
            const runPlayers = this.collectTelemetryParticipants(true);

            Telemetry.startRun({
                mode: this.multiplayerEnabled ? 'multiplayer' : 'singleplayer',
                gameMode: this.gameMode || 'gear',
                hostPlayerId: localPlayerId,
                difficulty: this.difficulty || 'normal',
                seed: (typeof currentRoom !== 'undefined' && currentRoom && currentRoom.seed) ? currentRoom.seed : null,
                players: runPlayers,
                metadata: {
                    gameMode: this.gameMode || 'gear',
                    selectedClass: this.selectedClass || null,
                    playerCount: runPlayers.length,
                    difficulty: this.difficulty || 'normal'
                }
            });

            const firstRoomType = (typeof currentRoom !== 'undefined' && currentRoom && currentRoom.type) ? currentRoom.type : 'normal';
            const firstRoomContext = this.getTelemetryRoomContext();
            Telemetry.recordRoomEnter(this.roomNumber, firstRoomType, runPlayers, firstRoomContext);
            Telemetry.recordEvent('roomGenerated', {
                roomNumber: this.roomNumber,
                metadata: firstRoomContext
            });
            const bossId = this.getTelemetryBossId();
            if (bossId) {
                Telemetry.recordBossEncounter({
                    bossId,
                    roomNumber: this.roomNumber,
                    phases: [],
                    damageByPlayer: {},
                    damageToPlayers: {},
                    hitsTakenByPlayers: {}
                });
                Telemetry.recordEvent('bossEncounterStarted', {
                    roomNumber: this.roomNumber,
                    targetId: bossId,
                    metadata: { bossId, roomType: firstRoomType }
                });
            }
        };

        this.beginRoomEnterTransition({
            roomNumber: this.roomNumber,
            onComplete: () => {
                recordStartTelemetry();
                this.maybeStartBossIntroForCurrentRoom();
            }
        });

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
        if (typeof Telemetry !== 'undefined') {
            this.finalizeTelemetryRun({
                result: 'abandoned',
                reason: 'restart'
            });
        }

        this.gameOverMusicPlaying = false;
        if (typeof audioMenuVisible !== 'undefined') {
            audioMenuVisible = false;
        }
        // Create new player with same class at the default spawn helper position.
        const restartSpawnPoint = this.getRoomSpawnPoint(null, 0);
        this.player = createPlayer(this.selectedClass, restartSpawnPoint.x, restartSpawnPoint.y);
        this.player.playerId = this.getLocalPlayerId(); // Set player ID for damage attribution

        // Reset arrays
        this.enemies = [];
        this.projectiles = (typeof createProjectileList === 'function' ? createProjectileList() : []);
        this.particles = [];
        this.damageNumbers = [];

        // Reset stats
        this.enemiesKilled = 0;
        this.elitesKilled = 0;
        this.bossesKilled = 0;
        this.currencyEarned = 0;
        this.currencyBankedThisRun = 0;
        this.shardsEarned = 0;
        this.roomNumber = (typeof Room0Tutorial !== 'undefined' && Room0Tutorial.shouldEnter && Room0Tutorial.shouldEnter())
            ? 0
            : 1;
        this.doorPulse = 0;
        this.itemsDroppedThisRoom = 0;
        this.startTime = Date.now();
        this.endTime = 0; // Reset end time
        this.deathScreenStartTime = 0; // Reset death screen timer
        this.rewardsCredited = false;

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

        this.cleanupRunState();

        // Reset room system
        if (typeof initializeRoom !== 'undefined') {
            currentRoom = null;
            // Sync to window for DOM components
            if (typeof window !== 'undefined') {
                window.currentRoom = null;
            }
        }

        // Enter playing state before spawning
        this.paused = false;
        this.showPauseMenu = false;
        this.pausedFromState = null;
        this.roomEnterTransition = null;
        this.lastGKeyState = false;
        this.clickHandled = false;

        // Spawn enemies
        this.spawnEnemies();
        this.updateMusicForCurrentRoom();

        const recordRestartTelemetry = () => {
            if (typeof Telemetry === 'undefined') {
                return;
            }
            const localPlayerId = this.getLocalPlayerId ? this.getLocalPlayerId() : 'local';
            const runPlayers = this.collectTelemetryParticipants(true);

            Telemetry.startRun({
                mode: this.multiplayerEnabled ? 'multiplayer' : 'singleplayer',
                gameMode: this.gameMode || 'gear',
                hostPlayerId: localPlayerId,
                difficulty: this.difficulty || 'normal',
                seed: (typeof currentRoom !== 'undefined' && currentRoom && currentRoom.seed) ? currentRoom.seed : null,
                players: runPlayers,
                metadata: {
                    gameMode: this.gameMode || 'gear',
                    selectedClass: this.selectedClass || null,
                    playerCount: runPlayers.length,
                    difficulty: this.difficulty || 'normal'
                }
            });

            const firstRoomType = (typeof currentRoom !== 'undefined' && currentRoom && currentRoom.type) ? currentRoom.type : 'normal';
            const firstRoomContext = this.getTelemetryRoomContext();
            Telemetry.recordRoomEnter(this.roomNumber, firstRoomType, runPlayers, firstRoomContext);
            Telemetry.recordEvent('roomGenerated', {
                roomNumber: this.roomNumber,
                metadata: firstRoomContext
            });
            const bossId = this.getTelemetryBossId();
            if (bossId) {
                Telemetry.recordBossEncounter({
                    bossId,
                    roomNumber: this.roomNumber,
                    phases: [],
                    damageByPlayer: {},
                    damageToPlayers: {},
                    hitsTakenByPlayers: {}
                });
                Telemetry.recordEvent('bossEncounterStarted', {
                    roomNumber: this.roomNumber,
                    targetId: bossId,
                    metadata: { bossId, roomType: firstRoomType }
                });
            }
        };

        this.beginRoomEnterTransition({
            roomNumber: this.roomNumber,
            onComplete: () => {
                recordRestartTelemetry();
                this.maybeStartBossIntroForCurrentRoom();
            }
        });

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
        if (typeof initializeRoom !== 'undefined' && (!currentRoom || currentRoom.number !== this.roomNumber)) {
            if (typeof releaseRoomRenderCaches === 'function') {
                releaseRoomRenderCaches(currentRoom);
            }
            currentRoom = generateRoom(this.roomNumber);
            // Sync to window for DOM components
            if (typeof window !== 'undefined') {
                window.currentRoom = currentRoom;
            }
            this.syncInSafeRoomFromCurrentRoom(currentRoom);
            this.enemies = currentRoom.enemies;

            if (this.player && typeof this.getRoomSpawnPoint === 'function') {
                const spawnPoint = this.getRoomSpawnPoint(currentRoom, 0);
                this.player.x = spawnPoint.x;
                this.player.y = spawnPoint.y;
            }

            if (typeof Room0Tutorial !== 'undefined' && Room0Tutorial.beginIfNeeded) {
                Room0Tutorial.beginIfNeeded(currentRoom);
            }
        }

        this.updateMusicForCurrentRoom();

        console.log(`Room ${this.roomNumber} initialized with ${this.enemies.length} enemies`);
    },

    releasePooledProjectile(projectile) {
        if (!projectile || !projectile._fromProjectilePool) return;
        if (!this._projectilePool) this._projectilePool = [];
        this._projectilePool.push(projectile);
    },

    acquireProjectile(spec) {
        const pool = this._projectilePool || (this._projectilePool = []);
        const projectile = pool.pop() || {};
        Object.assign(projectile, spec);
        projectile._fromProjectilePool = true;
        return projectile;
    },

    // Update projectiles
    updateProjectiles(deltaTime) {
        const isMultiplayerClient = this.multiplayerEnabled &&
            typeof multiplayerManager !== 'undefined' &&
            multiplayerManager &&
            !multiplayerManager.isHost;

        const projectiles = this.projectiles;
        const roomWidth = (typeof currentRoom !== 'undefined' && currentRoom) ? currentRoom.width : 2400;
        const roomHeight = (typeof currentRoom !== 'undefined' && currentRoom) ? currentRoom.height : 1350;
        let writeIndex = 0;

        for (let readIndex = 0; readIndex < projectiles.length; readIndex++) {
            const projectile = projectiles[readIndex];
            const previousX = projectile.x;
            const previousY = projectile.y;
            let keep = true;

            if (projectile.waveAmplitude && projectile.baseAngle !== undefined) {
                projectile.waveClock = (projectile.waveClock || 0) + deltaTime;
                const baseSpeed = projectile.baseSpeed || Math.sqrt(projectile.vx * projectile.vx + projectile.vy * projectile.vy) || 1;
                const wave = Math.sin(projectile.waveClock * (projectile.waveFrequency || 7) + (projectile.wavePhase || 0)) * projectile.waveAmplitude;
                const forwardX = Math.cos(projectile.baseAngle);
                const forwardY = Math.sin(projectile.baseAngle);
                const perpX = -forwardY;
                const perpY = forwardX;
                projectile.vx = forwardX * baseSpeed + perpX * wave;
                projectile.vy = forwardY * baseSpeed + perpY * wave;
            }

            if (isMultiplayerClient && projectile.id) {
                projectile.x += projectile.vx * deltaTime;
                projectile.y += projectile.vy * deltaTime;

                if (projectile.targetX !== undefined && projectile.targetY !== undefined) {
                    const dx = projectile.targetX - projectile.x;
                    const dy = projectile.targetY - projectile.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    const projectileSnapDistance = MultiplayerConfig.SNAP_DISTANCE * 3;

                    if (distance > projectileSnapDistance) {
                        projectile.x = projectile.targetX;
                        projectile.y = projectile.targetY;
                    } else if (distance > 15) {
                        const correctionSpeed = MultiplayerConfig.BASE_LERP_SPEED * 0.15;
                        const t = Math.min(1, deltaTime * correctionSpeed);
                        projectile.x += dx * t;
                        projectile.y += dy * t;
                    }
                }
            } else if (isMultiplayerClient && projectile.targetX !== undefined && projectile.targetY !== undefined) {
                projectile.x += projectile.vx * deltaTime;
                projectile.y += projectile.vy * deltaTime;

                const dx = projectile.targetX - projectile.x;
                const dy = projectile.targetY - projectile.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const projectileSnapDistance = MultiplayerConfig.SNAP_DISTANCE * 2;

                if (distance > projectileSnapDistance) {
                    projectile.x = projectile.targetX;
                    projectile.y = projectile.targetY;
                } else if (distance > 10) {
                    const correctionSpeed = MultiplayerConfig.BASE_LERP_SPEED * 0.2;
                    const t = Math.min(1, deltaTime * correctionSpeed);
                    projectile.x += dx * t;
                    projectile.y += dy * t;
                }
            } else {
                projectile.x += projectile.vx * deltaTime;
                projectile.y += projectile.vy * deltaTime;
            }

            if (keep && !projectile.ignoresWorldCollision &&
                typeof currentRoom !== 'undefined' &&
                currentRoom &&
                currentRoom.layout &&
                typeof RoomLayoutGenerator !== 'undefined' &&
                !RoomLayoutGenerator.isProjectilePathClear(
                    currentRoom.layout,
                    { x: previousX, y: previousY },
                    { x: projectile.x, y: projectile.y },
                    projectile.size || 4
                )) {
                keep = false;
            }

            projectile.elapsed += deltaTime;

            if (keep && projectile.elapsed >= projectile.lifetime) keep = false;
            if (keep && (projectile.x < -50 || projectile.x > roomWidth + 50)) keep = false;
            if (keep && (projectile.y < -50 || projectile.y > roomHeight + 50)) keep = false;

            if (!keep) {
                this.releasePooledProjectile(projectile);
                continue;
            }

            if (writeIndex !== readIndex) projectiles[writeIndex] = projectile;
            writeIndex++;
        }

        projectiles.length = writeIndex;
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

                    const attackHit = typeof resolveEnemyAttackHit === 'function'
                        ? resolveEnemyAttackHit(projectile.x, projectile.y, projectile.size, enemy)
                        : (typeof checkEnemyCircleCollision === 'function'
                            ? checkEnemyCircleCollision(projectile.x, projectile.y, projectile.size, enemy)
                            : { hit: checkCircleCollision(
                                projectile.x, projectile.y, projectile.size,
                                enemy.x, enemy.y, enemy.size
                            ) });

                    if (attackHit.hit) {
                        // Check for backstab (Rogue passive: player must be behind enemy when projectile hits)
                        let isBackstab = false;
                        let finalDamage = projectile.damage;

                        // Check for range bonus (Mage passive: increased damage at range)
                        if (projectile.type === 'magic' && shooterPlayer && shooterPlayer.playerClass === 'hexagon') {
                            // Calculate distance from shooter to enemy
                            const dx = enemy.x - shooterPlayer.x;
                            const dy = enemy.y - shooterPlayer.y;
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
                        if (enemy.isBoss && typeof enemy.takeDamage === 'function') {
                            enemy.takeDamage(finalDamage, projectile.x, projectile.y, projectile.size, projectileOwnerId);
                        } else {
                            const vArchetype = projectile.type === 'knife' ? 'pierce' : 'magic';
                            enemy.takeDamage(finalDamage, projectileOwnerId, projectile.x, projectile.y, vArchetype);
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
                            applyLifesteal(shooterPlayer, damageDealt, {
                                enemy,
                                source: 'projectile',
                                batchId: projectile.lifestealBatchId
                            });
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
                        if (typeof hostBroadcastDamageNumber === 'function') {
                            hostBroadcastDamageNumber(enemy.x, enemy.y, damageDealt, {
                                enemyId: enemy.id,
                                isCrit
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

                    // Add remote players (multiplayer only) — use simulated instances, not lobby snapshots
                    if (this.remotePlayerInstances && this.remotePlayerInstances.size > 0) {
                        this.remotePlayerInstances.forEach((instance, id) => {
                            if (instance && instance.alive && instance.hp > 0) {
                                playersToCheck.push({
                                    id,
                                    player: instance,
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

                        // Check shield blocking (local and remote tank instances)
                        let isBlocked = false;

                        if (p.shieldActive) {
                            const shieldStart = p.size + 5;
                            const shieldDepth = 20;
                            const shieldWidth = 60;

                            const toPlayerX = projectile.x - p.x;
                            const toPlayerY = projectile.y - p.y;
                            const toPlayerDist = Math.sqrt(toPlayerX * toPlayerX + toPlayerY * toPlayerY);
                            if (toPlayerDist > 0) {
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

                                        // Play shield block sound (local feedback on host)
                                        if (isLocal && typeof AudioManager !== 'undefined' && AudioManager.sounds) {
                                            AudioManager.sounds.tankShieldHit();
                                        }

                                        if (typeof createParticleBurst !== 'undefined') {
                                            createParticleBurst(projectile.x, projectile.y, '#0099ff', 5);
                                        }
                                        if (typeof hostBroadcastCombatFx === 'function') {
                                            hostBroadcastCombatFx({
                                                kind: 'particle_burst',
                                                x: projectile.x,
                                                y: projectile.y,
                                                color: '#0099ff',
                                                count: 5
                                            });
                                        }
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
            const removed = this.projectiles[projectilesToRemove[i]];
            this.projectiles.splice(projectilesToRemove[i], 1);
            this.releasePooledProjectile(removed);
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
    isRemotePlayerNearby(remote, threshold) {
        if (!remote || !this.camera) return true;
        const dist = Math.hypot(remote.x - this.camera.x, remote.y - this.camera.y);
        return dist < (threshold || 400);
    },

    isRemotePlayerVisible(remote, margin) {
        if (!remote || !this.camera || !this.config) return true;
        const m = margin != null ? margin : remote.size * 4;
        const zoom = this.baseZoom || 1;
        const halfWidth = (this.config.width / 2) / zoom + m;
        const halfHeight = (this.config.height / 2) / zoom + m;
        return (
            remote.x >= this.camera.x - halfWidth &&
            remote.x <= this.camera.x + halfWidth &&
            remote.y >= this.camera.y - halfHeight &&
            remote.y <= this.camera.y + halfHeight
        );
    },

    renderSimplifiedRemote(ctx, remote) {
        if (!remote) return;
        const classKey = remote.playerClass || remote.classType || remote.class || null;
        const classDef = (classKey && typeof CLASS_DEFINITIONS !== 'undefined' && CLASS_DEFINITIONS[classKey])
            ? CLASS_DEFINITIONS[classKey]
            : null;
        const color = remote.color || (classDef && classDef.color) || '#4a90e2';
        const size = remote.size || 20;
        const shape = remote.shape || (classDef && classDef.shape) || 'square';

        if (this.glowCache && typeof this.getCachedGlowSprite === 'function') {
            const cached = this.getCachedGlowSprite(color);
            const cachedRadius = 128;
            const drawSize = cached.width * ((size * 2) / cachedRadius);
            const half = drawSize * 0.5;
            ctx.drawImage(cached, remote.x - half, remote.y - half, drawSize, drawSize);
        }

        ctx.save();
        ctx.translate(remote.x, remote.y);
        if (typeof remote.rotation !== 'undefined') {
            ctx.rotate(remote.rotation);
        }
        ctx.fillStyle = color;
        if (shape === 'triangle') {
            ctx.beginPath();
            ctx.moveTo(size, 0);
            ctx.lineTo(-size * 0.5, -size * 0.866);
            ctx.lineTo(-size * 0.5, size * 0.866);
            ctx.closePath();
            ctx.fill();
        } else if (shape === 'hexagon') {
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const angle = (Math.PI / 3) * i;
                const px = Math.cos(angle) * size;
                const py = Math.sin(angle) * size;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
        } else if (shape === 'pentagon') {
            ctx.beginPath();
            for (let i = 0; i < 5; i++) {
                const angle = (Math.PI * 2 / 5) * i - Math.PI / 2;
                const px = Math.cos(angle) * size;
                const py = Math.sin(angle) * size;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
        } else {
            ctx.fillRect(-size * 0.8, -size * 0.8, size * 1.6, size * 1.6);
        }
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
    },

    renderRemotePlayerInstance(ctx, remote, playerId) {
        if (!remote || remote.dead || !remote.alive) return;
        if (!this.isRemotePlayerVisible(remote, remote.size * 4)) return;

        const fullRender = this.renderQuality && this.renderQuality.remoteFullRender !== false;
        const nearby = this.isRemotePlayerNearby(remote, 400);

        if (fullRender && nearby) {
            remote.render(ctx);
        } else {
            this.renderSimplifiedRemote(ctx, remote);
        }

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
        ctx.fillText(playerName, remote.x, remote.y - remote.size - 5);
    },

    renderRemotePlayers(ctx) {
        const renderFn = () => {
            if (this.isMultiplayerClient()) {
                if (this.remotePlayerShadowInstances && this.remotePlayerShadowInstances.size > 0) {
                    this.remotePlayerShadowInstances.forEach((shadowInstance, playerId) => {
                        this.renderRemotePlayerInstance(ctx, shadowInstance, playerId);
                    });
                }
            } else if (this.isHost()) {
                if (this.remotePlayerInstances && this.remotePlayerInstances.size > 0) {
                    this.remotePlayerInstances.forEach((playerInstance, playerId) => {
                        this.renderRemotePlayerInstance(ctx, playerInstance, playerId);
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
        };
        this.trackRenderSection('remotePlayers', renderFn);
    },
};

/**
 * Vector fat PS2 easter egg (solo Save Run booth).
 * Ode to Lost: leave it on for days, keep the run, chase room 200.
 * Front-on fat PS2 — grooved face, MC/controller ports, tray, reset/eject, blue USB bay.
 */
function drawLostPs2EasterEgg(ctx, x, y, options = {}) {
    function roundRectPath(px, py, w, h, r) {
        const radius = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
        ctx.beginPath();
        ctx.moveTo(px + radius, py);
        ctx.lineTo(px + w - radius, py);
        ctx.quadraticCurveTo(px + w, py, px + w, py + radius);
        ctx.lineTo(px + w, py + h - radius);
        ctx.quadraticCurveTo(px + w, py + h, px + w - radius, py + h);
        ctx.lineTo(px + radius, py + h);
        ctx.quadraticCurveTo(px, py + h, px, py + h - radius);
        ctx.lineTo(px, py + radius);
        ctx.quadraticCurveTo(px, py, px + radius, py);
        ctx.closePath();
    }

    const lit = options.lit !== false;
    const near = !!options.near;
    const scale = Number.isFinite(options.scale) ? options.scale : 1;
    const groundShadow = options.groundShadow !== false;
    const t = Date.now() * 0.0015;
    const pulse = lit ? (0.6 + Math.sin(t) * 0.3) : 0.2;

    // Front-view proportions (fat PS2 is a wide black slab)
    const W = 108;
    const H = 46;
    const bx = -W / 2;
    const by = -H / 2;
    const grooveH = H * 0.58;
    const flatH = H - grooveH;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';

    // Floor shadow (skip when nested as a machine icon)
    if (groundShadow) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.beginPath();
        ctx.ellipse(0, by + H + 6, W * 0.48, 6, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    // Outer shell
    const shell = ctx.createLinearGradient(0, by, 0, by + H);
    shell.addColorStop(0, '#2a2a2e');
    shell.addColorStop(0.55, '#1a1a1e');
    shell.addColorStop(1, '#101014');
    ctx.fillStyle = shell;
    roundRectPath(bx, by, W, H, 3);
    ctx.fill();

    // === UPPER GROOVED FACE ===
    ctx.fillStyle = '#16161a';
    ctx.fillRect(bx + 2, by + 2, W - 4, grooveH - 2);

    // Horizontal ribbing across the whole upper band
    for (let i = 0; i < 7; i++) {
        const gy = by + 4 + i * ((grooveH - 6) / 6);
        ctx.strokeStyle = i % 2 === 0 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.45)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(bx + 3, gy);
        ctx.lineTo(bx + W - 3, gy);
        ctx.stroke();
    }

    // Left bay: memory card flaps (top) + controller ports (bottom)
    const portBayX = bx + 5;
    const portBayY = by + 5;
    const portBayW = 28;
    const portBayH = grooveH - 8;
    ctx.fillStyle = '#0c0c10';
    roundRectPath(portBayX, portBayY, portBayW, portBayH, 1.5);
    ctx.fill();

    // MEMORY CARD slots
    for (let i = 0; i < 2; i++) {
        const sx = portBayX + 3 + i * 12;
        const sy = portBayY + 3;
        ctx.fillStyle = '#222228';
        roundRectPath(sx, sy, 10, 7, 1);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.lineWidth = 0.8;
        roundRectPath(sx, sy, 10, 7, 1);
        ctx.stroke();
        // flap hinge line
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath();
        ctx.moveTo(sx + 1, sy + 3.5);
        ctx.lineTo(sx + 9, sy + 3.5);
        ctx.stroke();
        ctx.fillStyle = 'rgba(170,175,190,0.55)';
        ctx.font = 'bold 4px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(String(i + 1), sx + 5, sy - 0.5);
    }

    // Controller ports (circle + pin ring look)
    for (let i = 0; i < 2; i++) {
        const cx = portBayX + 8 + i * 12;
        const cy = portBayY + portBayH - 8;
        ctx.fillStyle = '#1c1c22';
        ctx.beginPath();
        ctx.arc(cx, cy, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 0.8;
        ctx.stroke();
        ctx.fillStyle = '#0a0a0e';
        ctx.beginPath();
        ctx.arc(cx, cy, 2.6, 0, Math.PI * 2);
        ctx.fill();
        // pin dots
        ctx.fillStyle = 'rgba(200,200,210,0.35)';
        for (let p = 0; p < 6; p++) {
            const a = (p / 6) * Math.PI * 2 - Math.PI / 2;
            ctx.beginPath();
            ctx.arc(cx + Math.cos(a) * 1.5, cy + Math.sin(a) * 1.5, 0.45, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Disc tray (center of upper face)
    const trayX = bx + 36;
    const trayY = by + 6;
    const trayW = 48;
    const trayH = grooveH - 10;
    ctx.fillStyle = '#1e1e24';
    roundRectPath(trayX, trayY, trayW, trayH, 1.5);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    roundRectPath(trayX, trayY, trayW, trayH, 1.5);
    ctx.stroke();
    // tray face detail lines
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath();
    ctx.moveTo(trayX + 4, trayY + trayH * 0.35);
    ctx.lineTo(trayX + trayW - 4, trayY + trayH * 0.35);
    ctx.moveTo(trayX + 4, trayY + trayH * 0.65);
    ctx.lineTo(trayX + trayW - 4, trayY + trayH * 0.65);
    ctx.stroke();

    // Right: RESET + EJECT buttons
    const btnX = bx + W - 18;
    // Reset (top) — green power glyph
    ctx.fillStyle = '#2a2a30';
    roundRectPath(btnX, by + 5, 12, 11, 1.5);
    ctx.fill();
    const resetGlow = lit ? `rgba(40, 220, 160, ${0.55 + pulse * 0.35})` : 'rgba(40, 120, 90, 0.45)';
    if (lit) {
        ctx.shadowColor = resetGlow;
        ctx.shadowBlur = near ? 6 : 3;
    }
    ctx.strokeStyle = resetGlow;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(btnX + 6, by + 9.5, 2.6, Math.PI * 0.2, Math.PI * 1.8);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(btnX + 6, by + 7.2);
    ctx.lineTo(btnX + 6, by + 10.2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = lit ? 'rgba(80, 230, 180, 0.7)' : 'rgba(100, 140, 120, 0.45)';
    ctx.font = 'bold 3.5px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('RESET', btnX + 6, by + 13.5);

    // Eject (bottom) — blue triangle
    ctx.fillStyle = '#2a2a30';
    roundRectPath(btnX, by + 18, 12, 9, 1.5);
    ctx.fill();
    const ejectGlow = lit
        ? `rgba(60, 140, 255, ${0.65 + pulse * 0.3})`
        : 'rgba(40, 70, 120, 0.5)';
    if (lit) {
        ctx.shadowColor = ejectGlow;
        ctx.shadowBlur = near ? 7 : 4;
    }
    ctx.fillStyle = ejectGlow;
    ctx.beginPath();
    ctx.moveTo(btnX + 4, by + 20.5);
    ctx.lineTo(btnX + 8.5, by + 22.5);
    ctx.lineTo(btnX + 4, by + 24.5);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(btnX + 8.2, by + 20.5, 1.6, 4);
    ctx.shadowBlur = 0;

    // === LOWER FLAT FACE ===
    const flatY = by + grooveH;
    ctx.fillStyle = '#141418';
    ctx.fillRect(bx + 2, flatY, W - 4, flatH - 2);

    // Blue USB / i.LINK bay (the famous tell)
    const usbX = bx + 5;
    const usbY = flatY + 3;
    const usbW = 22;
    const usbH = flatH - 7;
    ctx.fillStyle = lit ? '#1a4fd0' : '#163a8a';
    roundRectPath(usbX, usbY, usbW, usbH, 1.5);
    ctx.fill();
    // highlight on blue bay
    ctx.fillStyle = 'rgba(120, 170, 255, 0.25)';
    ctx.fillRect(usbX + 1, usbY + 1, usbW - 2, 2);

    // Two stacked USB ports
    for (let i = 0; i < 2; i++) {
        const uy = usbY + 3 + i * 5;
        ctx.fillStyle = '#0a0a12';
        roundRectPath(usbX + 3, uy, 8, 3.5, 0.5);
        ctx.fill();
        ctx.fillStyle = 'rgba(200, 210, 230, 0.35)';
        ctx.fillRect(usbX + 4, uy + 1, 6, 1.5);
    }
    // i.LINK (small square + icon mark)
    ctx.fillStyle = '#0a0a12';
    roundRectPath(usbX + 13, usbY + 5, 6, 6, 0.5);
    ctx.fill();
    ctx.strokeStyle = 'rgba(220, 230, 255, 0.45)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(usbX + 14.5, usbY + 8);
    ctx.lineTo(usbX + 17.5, usbY + 8);
    ctx.moveTo(usbX + 16, usbY + 6.5);
    ctx.lineTo(usbX + 16, usbY + 9.5);
    ctx.stroke();

    // Ventilation grille (rest of lower face)
    const ventX = usbX + usbW + 3;
    const ventY = flatY + 4;
    const ventW = bx + W - 5 - ventX;
    const ventH = flatH - 9;
    ctx.fillStyle = '#0c0c10';
    roundRectPath(ventX, ventY, ventW, ventH, 1);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 0.6;
    const slits = 16;
    for (let i = 0; i < slits; i++) {
        const sy = ventY + 1.5 + (i / (slits - 1)) * (ventH - 3);
        ctx.beginPath();
        ctx.moveTo(ventX + 2, sy);
        ctx.lineTo(ventX + ventW - 2, sy);
        ctx.stroke();
    }

    // Feet
    ctx.fillStyle = '#0a0a0c';
    ctx.beginPath();
    ctx.ellipse(bx + 10, by + H - 1, 4, 1.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(bx + W - 10, by + H - 1, 4, 1.6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Outer rim
    ctx.strokeStyle = near ? 'rgba(200, 210, 230, 0.28)' : 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    roundRectPath(bx, by, W, H, 3);
    ctx.stroke();

    ctx.restore();
}

if (typeof window !== 'undefined') {
    window.Game = Game;
    window.drawLostPs2EasterEgg = drawLostPs2EasterEgg;
}

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

