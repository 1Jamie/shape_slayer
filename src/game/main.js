// Main game loop and initialization
// PlayerStats class is extracted to src/game/simulation/player-stats.js

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
    get PATCH_TITLES() {
        return typeof GameVersion !== 'undefined' ? GameVersion.PATCH_TITLES : {};
    },
    getPatchTitle(version) {
        const v = version || this.VERSION;
        const titles = this.PATCH_TITLES || {};
        return titles[v] || ('UPDATE ' + v);
    },

    // Canvas and context
    canvas: null,
    ctx: null,

    // Game state
    state: 'TITLE', // 'TITLE', 'NEXUS', 'PLAYING', 'PAUSED', 'ENTERING_ROOM'
    pendingBootModals: null, // { privacy, launch, update } deferred until title dismiss
    titleExitTransition: null, // fade title → nexus handoff
    // Title attract is a visual sim — no feats, discoveries, currency, or lifetime stats
    allowsMetaProgression() {
        return this.state !== 'TITLE';
    },
    paused: false,
    pausedFromState: null, // Track where we paused from ('PLAYING' or 'NEXUS')
    showPauseMenu: false, // Visual pause menu flag (for multiplayer - doesn't pause game)
    roomEnterTransition: null,
    nexusPrewarm: null,
    nexusPrewarmComplete: false,
    get lastTime() { return window.engine ? window.engine.lastTime : (this._lastTime || 0); },
    set lastTime(v) { if (window.engine) { window.engine.lastTime = v; } else { this._lastTime = v; } },
    gameOverMusicPlaying: false,

    // Fixed timestep variables
    get accumulator() { return window.engine ? window.engine.accumulator : (this._accumulator || 0); },
    set accumulator(v) { if (window.engine) { window.engine.accumulator = v; } else { this._accumulator = v; } },
    get fixedTimestep() { return window.engine ? window.engine.fixedTimestep : (this._fixedTimestep || 1 / 60); },
    set fixedTimestep(v) { if (window.engine) { window.engine.fixedTimestep = v; } else { this._fixedTimestep = v; } },
    get maxCatchupUpdates() { return window.engine ? window.engine.maxCatchupUpdates : (this._maxCatchupUpdates || 5); },
    set maxCatchupUpdates(v) { if (window.engine) { window.engine.maxCatchupUpdates = v; } else { this._maxCatchupUpdates = v; } },
    get accumulatorTruncateThreshold() { return window.engine ? window.engine.accumulatorTruncateThreshold : (this._accumulatorTruncateThreshold || 0.1); },
    set accumulatorTruncateThreshold(v) { if (window.engine) { window.engine.accumulatorTruncateThreshold = v; } else { this._accumulatorTruncateThreshold = v; } },
    frameRenderTimings: null,
    currentFrameTimings: null,
    get lastAccumulatorTruncated() { return window.engine ? window.engine.lastAccumulatorTruncated : (this._lastAccumulatorTruncated || false); },
    set lastAccumulatorTruncated(v) { if (window.engine) { window.engine.lastAccumulatorTruncated = v; } else { this._lastAccumulatorTruncated = v; } },
    get frameBudgetSamples() { return window.engine ? window.engine.frameBudgetSamples : (this._frameBudgetSamples || []); },
    set frameBudgetSamples(v) { if (window.engine) { window.engine.frameBudgetSamples = v; } else { this._frameBudgetSamples = v; } },
    get renderQuality() { return this._renderQuality || this._defaultRenderQuality; },
    set renderQuality(v) { this._renderQuality = v; },
    get _defaultRenderQuality() {
        return (typeof GameRenderQuality !== 'undefined')
            ? GameRenderQuality.DEFAULT_RENDER_QUALITY
            : {
                vignetteScale: 0.5,
                maxSceneryLights: Infinity,
                gearRingPoints: 64,
                groundLootAnimatedRing: true,
                remoteFullRender: true,
                maxBeamLights: 8,
                damageFxScale: 1,
                voxelParticleCap: 512,
                shardParticleCap: 256
            };
    },
    renderSubTimings: { groundLoot: 0, gearRings: 0, remotePlayers: 0, worldGlow: 0, worldBodies: 0 },
    renderSubTimingSamples: null,
    debugFrameBudget: { frameAvg: 0, renderAvg: 0, targetBudget: 16.67 },

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

    // Game mode: content tables key ('gear'). Mode package id is selectedModeId / Modes.*.
    gameMode: 'gear',
    selectedModeId: 'roguelike',

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

    // Game-owned camera instances use generic engine spatial math.
    camera: new Engine.Camera({
        x: 640, y: 360,
        smoothSpeed: 5,
        offsetAmount: 60,
        deadzone: 20,
        viewWidth: 1280,
        viewHeight: 720
    }),

    nexusCamera: new Engine.Camera({
        x: 900, y: 550,
        smoothSpeed: 3,
        viewWidth: 1280,
        viewHeight: 720
    }),

    splitCamera: new Engine.Camera({
        x: 640, y: 360,
        smoothSpeed: 5,
        offsetAmount: 60,
        deadzone: 20,
        viewWidth: 640,
        viewHeight: 720
    }),
    localSplitEnabled: false,
    localSplitPlayerId: 'local-seat-1',
    localSplitSelectedClass: null,
    localSplitLayout: 'vertical',
    _localJoinStartPrev: new Map(),

    // Game objects
    player: null,
    enemies: [],
    projectiles: (typeof createProjectileList === 'function' ? createProjectileList() : []),
    _projectilePool: [],
    previousProjectiles: [], // Previous projectile state for interpolation (clients)
    get particles() { return Engine.Renderer ? Engine.Renderer.particles : (this._particles || []); },
    set particles(v) { if (Engine.Renderer) { Engine.Renderer.particles = v; } else { this._particles = v; } },
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
    playersOnDoor: [], // Player IDs toggled ready at the exit door
    doorReadyPlayers: null, // Set<playerId> - host authoritative ready toggles
    totalAlivePlayers: 0, // Total number of alive players
    _doorGKeyPrevLocal: false,
    _doorGKeyPrevByPlayer: null, // Map<playerId, boolean>
    pendingDoorReadyToggle: false, // Client one-shot door ready request

    // Screen shake system
    get screenShakeOffset() { return Engine.Renderer ? Engine.Renderer.screenShakeOffset : (this._screenShakeOffset || { x: 0, y: 0 }); },
    set screenShakeOffset(v) { if (Engine.Renderer) { Engine.Renderer.screenShakeOffset = v; } else { this._screenShakeOffset = v; } },
    get screenShakeIntensity() { return Engine.Renderer ? Engine.Renderer.screenShakeIntensity : (this._screenShakeIntensity || 0); },
    set screenShakeIntensity(v) { if (Engine.Renderer) { Engine.Renderer.screenShakeIntensity = v; } else { this._screenShakeIntensity = v; } },
    get screenShakeDuration() { return Engine.Renderer ? Engine.Renderer.screenShakeDuration : (this._screenShakeDuration || 0); },
    set screenShakeDuration(v) { if (Engine.Renderer) { Engine.Renderer.screenShakeDuration = v; } else { this._screenShakeDuration = v; } },
    get screenShakeDirection() { return Engine.Renderer ? Engine.Renderer.screenShakeDirection : (this._screenShakeDirection || null); },
    set screenShakeDirection(v) { if (Engine.Renderer) { Engine.Renderer.screenShakeDirection = v; } else { this._screenShakeDirection = v; } },
    get hitPauseTime() { return window.engine ? window.engine.hitPauseTime : (this._hitPauseTime || 0); },
    set hitPauseTime(v) { if (window.engine) { window.engine.hitPauseTime = v; } else { this._hitPauseTime = v; } },

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
    mobileZoom: 0.9, // Mobile default: pull back so more of the arena is visible
    cameraDistance: 'medium', // 'close' | 'medium' | 'far' (from save / pause menu)
    // Desktop: close-in / neutral / pulled back
    CAMERA_DISTANCE_MULT: { close: 1.15, medium: 1.0, far: 0.85 },
    // Mobile: shifted out one step — old far is the new medium (default), with a wider far
    CAMERA_DISTANCE_MULT_MOBILE: { close: 1.0, medium: 0.85, far: 0.7 },
    bossIntroZoom: 1.3, // Extra zoom during boss intro (30% closer total)

    getViewZoom() {
        if (typeof GameCameraManager !== 'undefined') {
            return GameCameraManager.getViewZoom(this);
        }
        return 1.0;
    },

    setCameraDistance(distance) {
        if (typeof GameCameraManager !== 'undefined') {
            return GameCameraManager.setCameraDistance(this, distance);
        }
        return false;
    },

    getCameraDistance() {
        if (typeof GameCameraManager !== 'undefined') {
            return GameCameraManager.getCameraDistance(this);
        }
        return 'medium';
    },

    // FPS tracking
    get fps() { return window.engine ? window.engine.fps : (this._fps || 0); },
    set fps(v) { if (window.engine) { window.engine.fps = v; } else { this._fps = v; } },
    get lastFpsUpdate() { return window.engine ? window.engine.lastFpsUpdate : (this._lastFpsUpdate || 0); },
    set lastFpsUpdate(v) { if (window.engine) { window.engine.lastFpsUpdate = v; } else { this._lastFpsUpdate = v; } },
    get frameCount() { return window.engine ? window.engine.frameCount : (this._frameCount || 0); },
    set frameCount(v) { if (window.engine) { window.engine.frameCount = v; } else { this._frameCount = v; } },

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
    get useSetTimeoutLoop() { return window.engine ? window.engine.useSetTimeoutLoop : (this._useSetTimeoutLoop || false); },
    set useSetTimeoutLoop(v) { if (window.engine) { window.engine.useSetTimeoutLoop = v; } else { this._useSetTimeoutLoop = v; } },
    get timeoutId() { return window.engine ? window.engine.timeoutId : (this._timeoutId || null); },
    set timeoutId(v) { if (window.engine) { window.engine.timeoutId = v; } else { this._timeoutId = v; } },
    get loopStopped() { return window.engine ? window.engine.loopStopped : (this._loopStopped || false); },
    set loopStopped(v) { if (window.engine) { window.engine.loopStopped = v; } else { this._loopStopped = v; } },
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
            script.src = 'src/game/networking/multiplayer.js';
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

        // Prefer canvas/context published by Engine.Boot; fall back to DOM lookup.
        const bootRuntime = (typeof Engine !== 'undefined' && Engine.Boot && Engine.Boot.runtime)
            ? Engine.Boot.runtime
            : null;
        this.canvas = (bootRuntime && bootRuntime.canvas)
            || document.getElementById('gameCanvas');
        if (!this.canvas) {
            console.error('Canvas element not found!');
            return;
        }

        // Prevent text selection and right-click context menu on canvas
        this.canvas.style.userSelect = 'none';

        this.ctx = (bootRuntime && bootRuntime.ctx) || this.canvas.getContext('2d');

        // Set internal canvas dimensions (game resolution)
        this.canvas.width = this.config.width;
        this.canvas.height = this.config.height;

        // Setup responsive scaling
        this.setupResponsiveCanvas();
        this.renderQuality = this.getBaseRenderQuality();
        this.prewarmRenderCaches();

        // Initialize input system
        Engine.Input.init(this.canvas);

        // Load fullscreen preference
        if (typeof SaveSystem !== 'undefined') {
            this.fullscreenEnabled = SaveSystem.getFullscreenPreference();
            if (SaveSystem.getCameraDistance) {
                this.cameraDistance = SaveSystem.getCameraDistance();
            }
        }

        // Setup fullscreen API event listeners
        this.setupFullscreenListeners();

        // Installed PWA / mobile: fullscreen chrome + force landscape
        this.setupLandscapeMode();

        if (this.fullscreenEnabled &&
            Engine.System &&
            Engine.System.supportsElementFullscreen &&
            !Engine.System.supportsElementFullscreen()) {
            this.pseudoFullscreenActive = true;
            document.body.classList.add('pseudo-fullscreen');
        }

        // Coalesce mobile toolbar/visualViewport resize bursts. Reallocating the
        // canvas backing store for every intermediate Safari toolbar frame can
        // interrupt touches and cause visible stalls.
        let resizeFrame = 0;
        let touchReinitTimer = 0;
        const handleResize = () => {
            if (resizeFrame) cancelAnimationFrame(resizeFrame);
            resizeFrame = requestAnimationFrame(() => {
                resizeFrame = 0;
                this.setupResponsiveCanvas();
                if (this.canvas) void this.canvas.offsetWidth;
            });

            clearTimeout(touchReinitTimer);
            touchReinitTimer = setTimeout(() => {
                if (this.canvas && (typeof Engine !== 'undefined' && Engine.Input) &&
                    Engine.Input.isMobileUiMode && Engine.Input.isMobileUiMode() &&
                    Engine.Input.initTouchControls) {
                    Engine.Input.initTouchControls(this.canvas);
                }
            }, 100);
        };

        window.addEventListener('resize', handleResize);

        // Also listen to visualViewport resize (for mobile system UI changes)
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', handleResize);
            // MobileControlsDOM follows the canvas rect every frame; forcing
            // scrollTo during Safari toolbar animation causes visible jitter.
            window.visualViewport.addEventListener('scroll', handleResize);
        }

        // Handle orientation change
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                this.setupResponsiveCanvas();
                this.updatePortraitRotateOverlay();
                this.lockLandscapeOrientation();
                if ((typeof Engine !== 'undefined' && Engine.Input) && Engine.Input.isMobileUiMode && Engine.Input.isMobileUiMode()) {
                    Engine.Input.initTouchControls(this.canvas);
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
            const pendingBoot = { privacy: false, launch: false, update: false };

            if (!hasAcknowledgedPrivacy) {
                pendingBoot.privacy = true;
            } else if (typeof Onboarding !== 'undefined' && Onboarding.getStep && Onboarding.getStep() === Onboarding.STEPS.CONTROLS) {
                pendingBoot.launch = true;
            } else if (!SaveSystem.getHasSeenLaunchModal()) {
                pendingBoot.launch = true;
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
                    }
                } else {
                    pendingBoot.update = true;
                }
            }

            // Boot modals + onboarding wait until title screen is dismissed
            this.pendingBootModals = pendingBoot;
        } else {
            this.telemetryOptIn = null;
        }

        // Player will be created after class selection
        this.player = null;

        if (typeof TitleAttract !== 'undefined' && TitleAttract.init) {
            TitleAttract.init(this.config.width, this.config.height);
        }

        // Dismiss title via click/tap on the canvas (DOM chrome also listens)
        const dismissTitleFromPointer = (e) => {
            if (this.state !== 'TITLE') return;
            e.preventDefault();
            this.dismissTitleScreen();
        };
        this.canvas.addEventListener('mousedown', dismissTitleFromPointer);
        this.canvas.addEventListener('touchstart', dismissTitleFromPointer, { passive: false });

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

            // Title screen: Enter / Space dismiss; Esc does nothing
            if (this.state === 'TITLE') {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.dismissTitleScreen();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                }
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

                // Mobile control editor is topmost; its own handler closes it (or its
                // nested popover/info modal) so don't toggle pause underneath it
                if (typeof window !== 'undefined' && window.MobileControlEditor
                    && typeof window.MobileControlEditor.isOpen === 'function'
                    && window.MobileControlEditor.isOpen()) {
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

                // Close character sheet first if open (DOM UI)
                if (typeof window !== 'undefined' && window.CharacterSheet
                    && typeof window.CharacterSheet.isOpen === 'function' && window.CharacterSheet.isOpen()) {
                    if (typeof window.CharacterSheet.toggle === 'function') {
                        window.CharacterSheet.toggle(false);
                    }
                    e.preventDefault();
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
                    if (typeof Engine !== 'undefined' && Engine.Audio) {
                        Engine.Audio.saveSettings();
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

                // Normal pause handling — death overlay owns the dead-player screen
                if (this.state === 'PLAYING' && this.player && this.player.dead
                    && (!this.multiplayerEnabled || this.allPlayersDead)) {
                    e.preventDefault();
                    return;
                }
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
    },

    applyDeferredBootModals() {
        if (typeof GameTitleTransition !== 'undefined') {
            GameTitleTransition.applyDeferredBootModals(this);
            return;
        }
    },

    dismissTitleScreen() {
        if (typeof GameTitleTransition !== 'undefined') {
            GameTitleTransition.dismissTitleScreen(this);
            return;
        }
    },

    updateTitleExitTransition(dt) {
        if (typeof GameTitleTransition !== 'undefined') {
            GameTitleTransition.updateTitleExitTransition(this, dt);
            return;
        }
    },

    swapTitleToNexus() {
        if (typeof GameTitleTransition !== 'undefined') {
            GameTitleTransition.swapTitleToNexus(this);
            return;
        }
    },

    getTitleExitFadeAlpha() {
        if (typeof GameTitleTransition !== 'undefined') {
            return GameTitleTransition.getTitleExitFadeAlpha(this);
        }
        return 0;
    },

    renderTitleExitOverlay(ctx) {
        if (typeof GameTitleTransition !== 'undefined') {
            GameTitleTransition.renderTitleExitOverlay(this, ctx);
            return;
        }
    },

    // Setup responsive canvas sizing - dynamic viewport to match screen
    setupResponsiveCanvas() {
        if (!this.canvas) return;

        // Use actual available viewport - must account for browser chrome on mobile

        // Detect the active UI layout FIRST (before using it in viewport calculation)
        const isMobileDevice = (typeof Engine !== 'undefined' && Engine.Input) && Engine.Input.isMobileUiMode
            ? Engine.Input.isMobileUiMode()
            : ((typeof Engine !== 'undefined' && Engine.Input) && Engine.Input.isMobileDevice && Engine.Input.isMobileDevice());
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

        // Calculate mobile zoom based on aspect ratio (zoom out further for 21:9 landscape)
        const baseMobileZoom = 0.9; // Slightly pulled back vs 1:1 world scale
        if (isMobileDevice) {
            // For 21:9 landscape (aspect ratio > 2.0), zoom out more to show vertical space
            if (aspectRatio > 2.0) {
                // Zoom out more for wider aspect ratios
                // 21:9 (2.33) -> ~0.85, wider -> more zoom out
                const zoomFactor = Math.max(0.75, baseMobileZoom - (aspectRatio - 2.0) * 0.15);
                this.mobileZoom = zoomFactor;
            } else {
                this.mobileZoom = baseMobileZoom;
            }
        } else {
            this.mobileZoom = baseMobileZoom; // Not used on desktop, but set for consistency
        }

        // High DPI Support - never force upscale on 1x displays.
        // Gecko/Servo: cap at 1.5 (matches room static cache) - full 2x backbuffers thrash WebRender.
        const dprCap = this.getDprCap ? this.getDprCap() : 2;
        const configured = Engine.Render.configureCanvas(this.canvas, {
            logicalW: canvasWidth,
            logicalH: canvasHeight,
            dprCap
        });
        this.dpr = configured.dpr;
        this.ctx = configured.ctx;

        // Pooled world offscreen may be wrong size after a DPR/logical resize.
        this.cleanupPlayingRenderTargets();

        // Keep viewport framing styles owned by the game shell.
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
        if ((typeof Engine !== 'undefined' && Engine.Input) && Engine.Input.isMobileUiMode && Engine.Input.isMobileUiMode()) {
            // Small delay to ensure canvas rect is updated
            setTimeout(() => {
                if (Engine.Input.initTouchControls) {
                    Engine.Input.initTouchControls(this.canvas);
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

        if (typeof GameRenderPipeline !== 'undefined' && GameRenderPipeline.cleanupAllStateTargets) {
            GameRenderPipeline.cleanupAllStateTargets(this);
        }
    },

    // Convert screen coordinates to game coordinates
    screenToGame(x, y) {
        if (typeof GameCameraManager !== 'undefined') {
            return GameCameraManager.screenToGame(this, x, y);
        }
        return { x: Math.max(0, x || 0), y: Math.max(0, y || 0) };
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
        return (typeof GameDisplayManager !== 'undefined')
            ? GameDisplayManager.isNativeFullscreenActive()
            : !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement);
    },

    isFullscreenActive() {
        return (typeof GameDisplayManager !== 'undefined')
            ? GameDisplayManager.isFullscreenActive(this)
            : (this.isNativeFullscreenActive() || !!this.pseudoFullscreenActive);
    },

    // Setup fullscreen API listeners
    setupFullscreenListeners() {
        if (typeof GameDisplayManager !== 'undefined') {
            GameDisplayManager.setupFullscreenListeners(this);
            return;
        }
    },

    setupLandscapeMode() {
        if (typeof GameDisplayManager !== 'undefined') {
            GameDisplayManager.setupLandscapeMode(this);
            return;
        }
    },

    ensurePortraitRotateOverlay() {
        if (typeof GameDisplayManager !== 'undefined') {
            return GameDisplayManager.ensurePortraitRotateOverlay(this);
        }
        return this._rotateOverlay || null;
    },

    shouldForceLandscape() {
        if (typeof GameDisplayManager !== 'undefined') {
            return GameDisplayManager.shouldForceLandscape();
        }
        return false;
    },

    lockLandscapeOrientation() {
        if (typeof GameDisplayManager !== 'undefined') {
            return GameDisplayManager.lockLandscapeOrientation();
        }
        return Promise.resolve(false);
    },

    updatePortraitRotateOverlay() {
        if (typeof GameDisplayManager !== 'undefined') {
            GameDisplayManager.updatePortraitRotateOverlay(this);
            return;
        }
    },

    // Toggle fullscreen
    toggleFullscreen() {
        if (typeof GameDisplayManager !== 'undefined') {
            GameDisplayManager.toggleFullscreen(this);
            return;
        }
    },

    // Handle visibility change (delegated from Engine.Core)
    handleVisibilityChange(isHidden) {
        if (this.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager) {
            if (multiplayerManager.isHost && typeof multiplayerManager.sendHostStatus === 'function') {
                multiplayerManager.sendHostStatus();
            }
        }
        const isMobile = this.isMobileDevice;
        const inMultiplayer = this.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.lobbyCode;
        if (isMobile && isHidden) {
            this.backgroundPauseActive = true;
            if (typeof GameMusic !== 'undefined' && GameMusic) {
                GameMusic.pauseForBackground().catch(err => {
                    console.warn('[Music] Failed to pause background playback:', err);
                });
            }
            if (this.state === 'PLAYING' && !this.paused && !inMultiplayer) {
                this.autoPausedForBackground = true;
                this.togglePause();
            } else if (inMultiplayer) {
                this.showPauseMenu = true;
            }
        } else if (!isHidden) {
            this.backgroundPauseActive = false;
            if (this.autoPausedForBackground && this.state === 'PAUSED') {
                this.autoPausedForBackground = false;
                this.togglePause();
            }
        }
    },

    // Trigger screen shake
    triggerScreenShake(intensity, duration, direction = null) {
        if (typeof GameScreenEffects !== 'undefined') {
            GameScreenEffects.triggerScreenShake(this, intensity, duration, direction);
            return;
        }
    },

    triggerChromaticTrauma(frames = 5, intensity = 0.75) {
        if (typeof GameScreenEffects !== 'undefined') {
            GameScreenEffects.triggerChromaticTrauma(this, frames, intensity);
            return;
        }
    },

    getDamageTraumaParams(playerToCheck, nowSec, traumaNowMs, damageTraumaDuration) {
        if (typeof GameScreenEffects !== 'undefined') {
            return GameScreenEffects.getDamageTraumaParams(this, playerToCheck, nowSec, traumaNowMs, damageTraumaDuration);
        }
        return { intensity: 0, offset: 0, damagePercentage: 0, active: false };
    },

    renderPlayingWorldClear(ctx, viewport = null) {
        const activeViewport = viewport || this._activeRenderViewport;
        const logicalWidth = activeViewport ? activeViewport.w : this.config.width;
        const logicalHeight = activeViewport ? activeViewport.h : this.config.height;
        const biome = typeof getBiomeForRoom !== 'undefined' ? getBiomeForRoom(this.roomNumber) : { baseColor: '#1a1a2e' };
        // When clipped to a viewport on main, clear at the viewport origin so we only wipe that seat.
        if (activeViewport && ctx === this.ctx) {
            const biomeColor = biome.baseColor || '#1a1a2e';
            ctx.fillStyle = biomeColor;
            ctx.fillRect(activeViewport.x, activeViewport.y, activeViewport.w, activeViewport.h);
            return;
        }
        Engine.Renderer.clear(ctx, logicalWidth, logicalHeight, biome.baseColor);
    },

    /** Safe-room walls, static room layer / fallback scenery, layout debug. Camera must already be applied. */
    renderPlayingWorldStatic(ctx) {
        if (typeof currentRoom !== 'undefined' && currentRoom && currentRoom.type === 'safe') {
            const rw = currentRoom.width || 2400;
            const rh = currentRoom.height || 1350;
            const wallPad = 2400;
            ctx.save();
            ctx.fillStyle = 'rgba(10, 14, 20, 0.96)';
            ctx.fillRect(-wallPad, -wallPad, rw + wallPad * 2, wallPad);
            ctx.fillRect(-wallPad, rh, rw + wallPad * 2, wallPad);
            ctx.fillRect(-wallPad, 0, wallPad, rh);
            ctx.fillRect(rw, 0, wallPad, rh);
            ctx.strokeStyle = 'rgba(50, 90, 70, 0.55)';
            ctx.lineWidth = 8;
            ctx.strokeRect(-4, -4, rw + 8, rh + 8);
            ctx.restore();
        }

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

        if (typeof DebugFlags !== 'undefined' && DebugFlags.ROOM_LAYOUT && typeof renderRoomLayoutDebug !== 'undefined') {
            renderRoomLayoutDebug(ctx);
        }
    },

    renderPlayingWorldTutorial(ctx) {
        if (typeof Room0Tutorial !== 'undefined' && Room0Tutorial.renderWorld) {
            Room0Tutorial.renderWorld(ctx);
        }
    },

    /**
     * Compatibility orchestrator used only if something still expects the old
     * single-pass world layer. PLAYING uses the stage recipe instead.
     */
    renderPlayingWorldLayer(ctx) {
        this.renderPlayingWorldClear(ctx);
        ctx.save();
        const logicalWidth = this.config.width;
        const logicalHeight = this.config.height;
        Engine.Render.applyCamera(ctx, {
            x: this.camera.x,
            y: this.camera.y,
            zoom: this.getViewZoom(),
            centerX: logicalWidth / 2,
            centerY: logicalHeight / 2,
            offsetX: this.screenShakeOffset.x,
            offsetY: this.screenShakeOffset.y
        });
        const profile = typeof this.shouldCollectDebugMetrics === 'function' && this.shouldCollectDebugMetrics();
        const tStatic = profile ? performance.now() : 0;
        this.renderPlayingWorldStatic(ctx);
        if (profile && this.currentFrameTimings) {
            this.currentFrameTimings.static += performance.now() - tStatic;
        }
        const tWorld = profile ? performance.now() : 0;
        this.renderGameWorld(ctx);
        this.renderPlayingWorldTutorial(ctx);
        if (profile && this.currentFrameTimings) {
            this.currentFrameTimings.world += performance.now() - tWorld;
        }
        ctx.restore();
    },

    applyChromaticAberrationFromOffscreen(traumaParams, viewport = null) {
        if (typeof GameScreenEffects !== 'undefined') {
            GameScreenEffects.applyChromaticAberrationFromOffscreen(this, traumaParams, viewport);
            return;
        }
    },

    /** Post-vignette screen-space glow for the pre-boss healer (after door opens). */
    renderPreBossHealerPunchThrough(ctx, viewPlayer = null, viewport = null, camera = null) {
        if (typeof GameScreenEffects !== 'undefined') {
            GameScreenEffects.renderPreBossHealerPunchThrough(this, ctx, viewPlayer, viewport, camera);
            return;
        }
    },

    // Trigger hit pause — ~1 frame sells weight; longer / stacking reads as hitch
    triggerHitPause(duration = 0.016) {
        if (typeof GameScreenEffects !== 'undefined') {
            GameScreenEffects.triggerHitPause(this, duration);
            return;
        }
    },

    // Update screen shake
    updateScreenShake(deltaTime) {
        if (typeof GameScreenEffects !== 'undefined') {
            GameScreenEffects.updateScreenShake(this, deltaTime);
            return;
        }
    },

    // Update camera to follow player
    updateCamera(deltaTime) {
        if (typeof GameCameraManager !== 'undefined') {
            GameCameraManager.updateCamera(this, deltaTime);
            return;
        }
    },

    initializeCamera() {
        if (typeof GameCameraManager !== 'undefined') {
            GameCameraManager.initializeCamera(this);
            return;
        }
    },

    updateNexusCamera(deltaTime) {
        if (typeof GameCameraManager !== 'undefined') {
            GameCameraManager.updateNexusCamera(this, deltaTime);
            return;
        }
    },

    initializeNexusCamera() {
        if (typeof GameCameraManager !== 'undefined') {
            GameCameraManager.initializeNexusCamera(this);
            return;
        }
    },

    // Get local player ID (solo = 'local', multiplayer = multiplayerManager.playerId)
    getLocalPlayerId() {
        if (this.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.playerId) {
            return multiplayerManager.playerId;
        }
        return 'local'; // Solo mode
    },

    /** Visual position for local player (includes MP prediction correction). */
    getLocalPlayerRenderPosition() {
        if (!this.player) return null;
        if (typeof this.player.getPredictedRenderPosition === 'function') {
            return this.player.getPredictedRenderPosition();
        }
        return { x: this.player.x, y: this.player.y };
    },

    getExitDoorNearRange(player) {
        if (typeof GameDoorController !== 'undefined') {
            return GameDoorController.getExitDoorNearRange(this, player);
        }
        return (player && player.size || 28) * 1.8;
    },

    isPlayerNearExitDoor(player) {
        if (typeof GameDoorController !== 'undefined') {
            return GameDoorController.isPlayerNearExitDoor(this, player);
        }
        return false;
    },

    ensureDoorReadySet() {
        if (typeof GameDoorController !== 'undefined') {
            return GameDoorController.ensureDoorReadySet(this);
        }
        if (!this.doorReadyPlayers) this.doorReadyPlayers = new Set();
        return this.doorReadyPlayers;
    },

    isPlayerDoorReady(playerId) {
        if (typeof GameDoorController !== 'undefined') {
            return GameDoorController.isPlayerDoorReady(this, playerId);
        }
        return false;
    },

    toggleDoorReadyForPlayer(playerId) {
        if (typeof GameDoorController !== 'undefined') {
            GameDoorController.toggleDoorReadyForPlayer(this, playerId);
            return;
        }
    },

    syncPlayersOnDoorFromReady() {
        if (typeof GameDoorController !== 'undefined') {
            GameDoorController.syncPlayersOnDoorFromReady(this);
            return;
        }
    },

    clearDoorReadyState() {
        if (typeof GameDoorController !== 'undefined') {
            GameDoorController.clearDoorReadyState(this);
            return;
        }
    },

    toggleDoorReadyAtExit() {
        if (typeof GameDoorController !== 'undefined') {
            return GameDoorController.toggleDoorReadyAtExit(this);
        }
        return false;
    },

    didPlayerRequestDoorInteract(playerId, isLocal, inputState) {
        if (typeof GameDoorController !== 'undefined') {
            return GameDoorController.didPlayerRequestDoorInteract(this, playerId, isLocal, inputState);
        }
        return false;
    },

    tryAdvanceWhenAllDoorReady() {
        if (typeof GameDoorController !== 'undefined') {
            GameDoorController.tryAdvanceWhenAllDoorReady(this);
            return;
        }
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

    /**
     * Close the top overlay that sits above the pause menu (patch notes, how to play,
     * audio, privacy) without unpausing. Returns true if something was dismissed.
     */
    dismissOverlayAbovePause() {
        if (typeof GameModalController !== 'undefined') {
            return GameModalController.dismissOverlayAbovePause(this);
        }
        return false;
    },

    setTelemetryPreference(optIn) {
        if (typeof GameModalController !== 'undefined') {
            GameModalController.setTelemetryPreference(this, optIn);
            return;
        }
    },

    handlePrivacyChoice(optIn) {
        if (typeof GameModalController !== 'undefined') {
            GameModalController.handlePrivacyChoice(this, optIn);
            return;
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

        if (includeRemote && this.remotePlayerInstances && this.remotePlayerInstances.size > 0) {
            const isMpHost = this.multiplayerEnabled && typeof this.isHost === 'function' && this.isHost();
            const isLocalSplit = !this.multiplayerEnabled && this.localSplitEnabled;
            if (isMpHost || isLocalSplit) {
                this.remotePlayerInstances.forEach((playerInstance, playerId) => {
                    if (playerInstance) {
                        participants.push({
                            player: playerInstance,
                            playerId
                        });
                    }
                });
            }
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
        const gameMode = (this.activeSessionId === 'surge-arena') ? 'surge-arena' : (this.gameMode || 'gear');
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
                gameMode: (this.activeSessionId === 'surge-arena') ? 'surge-arena' : (this.gameMode || 'gear'),
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
        if ((this.multiplayerEnabled || this.localSplitEnabled) && this.remotePlayerInstances) {
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
        if ((this.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager) ||
            this.localSplitEnabled) {
            if (this.localSplitEnabled) {
                this.getPlayerStats(this.localSplitPlayerId);
            }
        }
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
        if (!this.isHost() && !this.localSplitEnabled) return;

        // Create actual player instance for this remote player
        if (typeof createPlayer !== 'undefined') {
            const playerInstance = createPlayer(playerClass, 100, 300);
            playerInstance.lastAimAngle = 0; // Initialize rotation state for touch controls
            playerInstance.playerId = playerId; // Store player ID for damage attribution

            // Apply upgrades from host tracking (remote players have their own upgrades)
            let upgrades = this.playerUpgrades.get(playerId);
            if (!upgrades && (this.localSplitEnabled || playerId === this.localSplitPlayerId)) {
                if (typeof SaveSystem !== 'undefined') {
                    upgrades = {
                        [playerClass]: SaveSystem.getUpgrades(playerClass)
                    };
                }
            }
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
                    playerInstance.maxHp = playerInstance.baseMaxHp;
                    playerInstance.hp = playerInstance.maxHp;

                    console.log(`[Host] Applied upgrades to ${playerId} (${playerClass}): damage=${classUpgrades.damage}, defense=${classUpgrades.defense}, speed=${classUpgrades.speed}, cooldown=${classUpgrades.cooldown}, health=${classUpgrades.health}, attackSpeed=${classUpgrades.attackSpeed}`);
                }
            }

            this.remotePlayerInstances.set(playerId, playerInstance);
            console.log(`[Host] Created player instance for ${playerId} (${playerClass})`);
        }
    },

    // Get suppressed input adapter for local player when navigating menus
    getSuppressedInputAdapter() {
        return {
            getKeyState: () => false,
            getWorldMousePos: () => (Engine.Input && Engine.Input.getWorldMousePos ? Engine.Input.getWorldMousePos() : { x: 0, y: 0 }),
            mouseLeft: false,
            mouseRight: false,
            touchJoysticks: {},
            touchButtons: {},
            keys: {}
        };
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
                if ((typeof Engine !== 'undefined' && Engine.Input) && GameInput.getAbilityInputType) {
                    return GameInput.getAbilityInputType(classType, ability);
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
        if (!this.isHost() && !this.localSplitEnabled) return;

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
        if (this.localSplitEnabled) {
            const secondPlayer = this.remotePlayerInstances.get(this.localSplitPlayerId);
            const firstDead = !this.player || this.player.dead || this.player.alive === false;
            const secondDead = !secondPlayer || secondPlayer.dead || secondPlayer.alive === false;
            return firstDead && secondDead;
        }
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
        const mode = (typeof Game !== 'undefined' && Game.gameMode) ? Game.gameMode : 'gear';
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
        if (typeof GameMusic === 'undefined' || !GameMusic) {
            return;
        }
        if (this.gameOverMusicPlaying) {
            return;
        }
        if (this.state === 'TITLE') {
            GameMusic.setTitle().catch(err => {
                console.error('[Music] Failed to set title music:', err);
            });
            return;
        }
        if (this.state === 'NEXUS' || (typeof currentRoom !== 'undefined' && currentRoom && currentRoom.type === 'safe')) {
            GameMusic.setHub().catch(err => {
                console.error('[Music] Failed to set nexus music:', err);
            });
            return;
        }
        if (!this.roomNumber || this.state === 'PAUSED') {
            return;
        }
        if (this.isBossRoom(this.roomNumber)) {
            const phase = this.getActiveBossPhase();
            GameMusic.setEncounterPhase(this.roomNumber, phase).catch(err => {
                console.error('[Music] Failed to set boss music:', err);
            });
        } else {
            GameMusic.setRoom(this.roomNumber).catch(err => {
                console.error('[Music] Failed to set room music:', err);
            });
        }
    },

    triggerGameOverMusic() {
        if (this.gameOverMusicPlaying) {
            return;
        }
        this.gameOverMusicPlaying = true;
        if (typeof GameMusic === 'undefined' || !GameMusic) {
            return;
        }
        GameMusic.playGameOver().catch(err => {
            console.error('[Music] Failed to start game over music:', err);
        });
    },

    playPauseMusic() {
        if (typeof GameMusic === 'undefined' || !GameMusic) {
            return;
        }
        if (this.backgroundPauseActive) {
            return;
        }
        const nexusContext = this.state === 'NEXUS' || this.pausedFromState === 'NEXUS';
        if (nexusContext) {
            GameMusic.setHub().catch(err => {
                console.error('[Music] Failed to reaffirm nexus music during pause:', err);
            });
            return;
        }
        GameMusic.playPauseMenu().catch(err => {
            console.error('[Music] Failed to start pause music:', err);
        });
    },

    resumeFromPauseMusic() {
        if (typeof GameMusic === 'undefined' || !GameMusic) {
            this.updateMusicForCurrentRoom();
            return;
        }
        const nexusContext = this.state === 'NEXUS' || this.pausedFromState === 'NEXUS';
        if (nexusContext) {
            GameMusic.setHub().then(() => {
                this.updateMusicForCurrentRoom();
            }).catch(err => {
                console.error('[Music] Failed to resume nexus music after pause:', err);
                this.updateMusicForCurrentRoom();
            });
            this.backgroundPauseActive = false;
            this.autoPausedForBackground = false;
            return;
        }
        GameMusic.resumeFromPause()
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

    getAllAlivePlayers() {
        const list = [];
        if (this.player && this.player.alive && !this.player.dead) {
            list.push(this.player);
        }
        const remMap = this.isHost() ? this.remotePlayerInstances : this.remotePlayerShadowInstances;
        if (remMap) {
            remMap.forEach(p => {
                if (p && p.alive && !p.dead) {
                    list.push(p);
                }
            });
        }
        return list;
    },

    getConnectedLocalSplitPads() {
        if (typeof navigator === 'undefined' || !navigator.getGamepads) return [];
        return Array.from(navigator.getGamepads())
            .filter(pad => pad && pad.connected)
            .sort((a, b) => a.index - b.index);
    },

    /**
     * Keyboard + mouse can be a local-coop seat. Touch never can.
     * Phones/tablets that are touch-primary without a fine pointer don't qualify.
     */
    hasLocalSplitKeyboardMouse() {
        if (typeof Engine !== 'undefined' && Engine.System && typeof Engine.System.getProfile === 'function') {
            const profile = Engine.System.getProfile();
            const caps = profile && profile.capabilities;
            if (caps) {
                if (caps.hasFinePointer || caps.finePointer || caps.hasHover || caps.canHover) {
                    return true;
                }
                if (caps.touchPrimary) return false;
            }
        }
        if (typeof Engine !== 'undefined' && Engine.Input) {
            if (Engine.Input.controlMode === 'touch' || Engine.Input.controlMode === 'mobile') {
                return false;
            }
            if (typeof Engine.Input.isMobileUiMode === 'function' && Engine.Input.isMobileUiMode()
                && typeof Engine.Input.isGamepadMode === 'function' && !Engine.Input.isGamepadMode()) {
                // Mobile touch UI without pads-as-primary → no keyboard seat.
                return false;
            }
        }
        return true;
    },

    /**
     * Local co-op needs two non-touch inputs: two pads, or keyboard+mouse + one pad.
     */
    getLocalSplitEligibility() {
        const online = this.multiplayerEnabled &&
            typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.lobbyCode;
        if (online) {
            return {
                ok: false,
                mode: null,
                pads: [],
                reason: 'Leave the online lobby before starting local co-op'
            };
        }
        const pads = this.getConnectedLocalSplitPads();
        if (pads.length >= 2) {
            return { ok: true, mode: 'dualPad', pads, reason: null };
        }
        if (pads.length >= 1 && this.hasLocalSplitKeyboardMouse()) {
            return { ok: true, mode: 'keyboardPad', pads, reason: null };
        }
        if (pads.length >= 1) {
            return {
                ok: false,
                mode: null,
                pads,
                reason: 'Local co-op needs two controllers (touch cannot be a player seat)'
            };
        }
        return {
            ok: false,
            mode: null,
            pads,
            reason: 'Connect two controllers, or one controller for Player 2 with keyboard + mouse'
        };
    },

    getLocalSplitJoinCandidate() {
        const pads = this.getConnectedLocalSplitPads();
        if (pads.length < 2) return null;
        const input = Engine.Input;
        const activePadIndex = input && Number.isInteger(input._gamepadIndex)
            ? input._gamepadIndex
            : null;
        const primaryPadIndex = pads.some(pad => pad.index === activePadIndex)
            ? activePadIndex
            : pads[0].index;
        return pads.find(pad => pad.index !== primaryPadIndex) || null;
    },

    getLocalSplitPrimaryGamepadIndex(candidateIndex) {
        const connected = this.getConnectedLocalSplitPads()
            .filter(pad => pad.index !== candidateIndex);
        if (connected.length === 0) return null;
        const activePadIndex = Engine.Input && Number.isInteger(Engine.Input._gamepadIndex)
            ? Engine.Input._gamepadIndex
            : null;
        return connected.some(pad => pad.index === activePadIndex)
            ? activePadIndex
            : connected[0].index;
    },

    getLocalSplitMenuGamepad() {
        const pads = this.getConnectedLocalSplitPads();
        return pads[0] || null;
    },

    updateLocalSplitJoin() {
        if (this.localSplitEnabled || !this.player ||
            (this.state !== 'NEXUS' && this.state !== 'PLAYING')) {
            return;
        }
        const eligibility = this.getLocalSplitEligibility();
        if (!eligibility.ok || eligibility.mode !== 'dualPad') return;

        const candidate = this.getLocalSplitJoinCandidate();
        if (!candidate) return;
        const startDown = !!candidate.buttons?.[9]?.pressed;
        const wasDown = this._localJoinStartPrev.get(candidate.index) === true;
        this._localJoinStartPrev.set(candidate.index, startDown);
        if (startDown && !wasDown) {
            this.enableLocalSplit({ gamepadIndex: candidate.index });
        }
    },

    renderLocalSplitJoinPrompt() {
        if (this.localSplitEnabled || !this.player ||
            (this.state !== 'NEXUS' && this.state !== 'PLAYING')) {
            return;
        }
        const eligibility = this.getLocalSplitEligibility();
        if (!eligibility.ok || eligibility.mode !== 'dualPad') return;
        const candidate = this.getLocalSplitJoinCandidate();
        if (!candidate) return;
        const ctx = this.ctx;
        const text = `Controller ${candidate.index + 1}: press START to join local co-op`;
        ctx.save();
        ctx.setTransform(this.dpr || 1, 0, 0, this.dpr || 1, 0, 0);
        ctx.font = 'bold 15px Orbitron, monospace';
        const width = Math.ceil(ctx.measureText(text).width) + 36;
        const x = (this.config.width - width) / 2;
        const y = this.config.height - 58;
        ctx.fillStyle = 'rgba(4, 8, 20, 0.82)';
        ctx.fillRect(x, y, width, 38);
        ctx.strokeStyle = 'rgba(110, 170, 255, 0.75)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, width, 38);
        ctx.fillStyle = '#dceaff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, this.config.width / 2, y + 19);
        ctx.restore();
    },

    enableLocalSplit(options = {}) {
        if (typeof GameSplitSession !== 'undefined') {
            const eligibility = this.getLocalSplitEligibility();
            let primaryPadIndex = null;
            let seat1PadIndex = null;
            if (Number.isInteger(options.gamepadIndex)) {
                seat1PadIndex = options.gamepadIndex;
                primaryPadIndex = this.getLocalSplitPrimaryGamepadIndex(seat1PadIndex);
                if (primaryPadIndex === null) return false;
            } else if (options.allowKeyboardPrimary && this.hasLocalSplitKeyboardMouse()) {
                const pad = this.getLocalSplitMenuGamepad();
                if (!pad) return false;
                primaryPadIndex = null;
                seat1PadIndex = pad.index;
            } else if (eligibility.ok && eligibility.mode === 'dualPad') {
                primaryPadIndex = eligibility.pads[0].index;
                seat1PadIndex = eligibility.pads[1].index;
            } else {
                return false;
            }
            return GameSplitSession.enableLocalSplit(this, primaryPadIndex, seat1PadIndex);
        }
        return false;
    },

    disableLocalSplit() {
        if (typeof GameSplitSession !== 'undefined') {
            GameSplitSession.disableLocalSplit(this);
            return;
        }
    },

    setLocalSplitClass(classKey, x = null, y = null) {
        if (typeof GameSplitSession !== 'undefined') {
            return GameSplitSession.setLocalSplitClass(this, classKey, x, y);
        }
        return false;
    },

    getLocalSplitClass() {
        if (typeof GameSplitSession !== 'undefined') {
            return GameSplitSession.getLocalSplitClass(this);
        }
        return null;
    },

    /** Local-coop / solo actors that can claim gear, items, doors, healers. */
    getLocalCoopActors() {
        const actors = [];
        if (this.player && this.player.alive) {
            actors.push({
                seatId: 'p1',
                player: this.player,
                playerId: typeof this.getLocalPlayerId === 'function' ? this.getLocalPlayerId() : 'local',
                seat: this.localSplitSession && this.localSplitSession.seats
                    ? this.localSplitSession.seats[0]
                    : null,
                isPrimary: true
            });
        }
        if (this.localSplitEnabled && this.remotePlayerInstances) {
            const p2 = this.remotePlayerInstances.get(this.localSplitPlayerId);
            if (p2 && p2.alive && !p2.dead) {
                actors.push({
                    seatId: 'p2',
                    player: p2,
                    playerId: this.localSplitPlayerId,
                    seat: this.localSplitSession && this.localSplitSession.seats
                        ? this.localSplitSession.seats[1]
                        : null,
                    isPrimary: false
                });
            }
        }
        return actors;
    },

    /** Prompt glyph options for the local-coop seat nearest (x,y), or null for global Input mode. */
    getInteractionPromptOptionsNear(x, y, radius = 80) {
        if (!this.localSplitEnabled) return null;
        const actors = typeof this.getLocalCoopActors === 'function' ? this.getLocalCoopActors() : [];
        let bestSeat = null;
        let bestDist = radius;
        for (const actor of actors) {
            if (!actor.player || !actor.seat) continue;
            const dx = actor.player.x - x;
            const dy = actor.player.y - y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < bestDist) {
                bestDist = dist;
                bestSeat = actor.seat;
            }
        }
        return bestSeat ? { seat: bestSeat } : null;
    },

    isAnyLocalActorNear(x, y, radius) {
        const actors = typeof this.getLocalCoopActors === 'function'
            ? this.getLocalCoopActors()
            : (this.player && this.player.alive ? [{ player: this.player }] : []);
        for (const actor of actors) {
            if (!actor.player || !actor.player.alive) continue;
            const dx = actor.player.x - x;
            const dy = actor.player.y - y;
            if (Math.sqrt(dx * dx + dy * dy) < radius) return true;
        }
        return false;
    },

    toggleLocalSplit() {
        if (this.localSplitEnabled) {
            this.disableLocalSplit();
            return false;
        }
        const eligibility = this.getLocalSplitEligibility();
        if (!eligibility.ok) return false;
        if (eligibility.mode === 'keyboardPad' || this.hasLocalSplitKeyboardMouse()) {
            return this.enableLocalSplit({ allowKeyboardPrimary: true });
        }
        return this.enableLocalSplit();
    },

    serializeLocalSplitSeatInput(seat) {
        if (!seat) return null;
        const movement = seat.getMovementInput();
        const aimAngle = seat.getAimDirection();
        const aim = { x: Math.cos(aimAngle), y: Math.sin(aimAngle) };
        const moveMag = Math.min(1, Math.hypot(movement.x, movement.y));
        const joystick = (active, direction, magnitude = 1) => ({
            active,
            magnitude: active ? magnitude : 0,
            direction
        });
        const button = (ability) => {
            const pressed = seat.isAbilityPressed(ability);
            const justPressed = seat.isAbilityJustPressed(ability);
            const justReleased = typeof seat.isAbilityJustReleased === 'function'
                ? seat.isAbilityJustReleased(ability)
                : false;
            const entry = {
                pressed,
                justPressed,
                justReleased
            };
            if (justReleased && ability === 'dodge' && moveMag > 0.1) {
                entry.finalJoystickState = {
                    direction: { x: movement.x / (moveMag || 1), y: movement.y / (moveMag || 1) },
                    magnitude: moveMag,
                    angle: Math.atan2(movement.y, movement.x)
                };
            }
            return entry;
        };
        const primary = seat.isAbilityPressed('basicAttack');
        const interactPressed = !!(seat.isInteractPressed && seat.isInteractPressed());
        return {
            isTouchMode: true,
            rotation: aimAngle,
            keys: { g: interactPressed },
            touchJoysticks: {
                movement: joystick(Math.hypot(movement.x, movement.y) > 0.01, movement,
                    Math.min(1, Math.hypot(movement.x, movement.y))),
                basicAttack: joystick(primary, aim),
                heavyAttack: joystick(seat.isAbilityPressed('heavyAttack'), aim),
                specialAbility: joystick(seat.isAbilityPressed('specialAbility'), aim),
                dodge: joystick(seat.isAbilityPressed('dodge'), movement, moveMag)
            },
            touchButtons: {
                heavyAttack: button('heavyAttack'),
                specialAbility: button('specialAbility'),
                dodge: button('dodge'),
                interact: {
                    pressed: interactPressed,
                    justPressed: false,
                    justReleased: false
                }
            }
        };
    },

    updateLocalSplit(deltaTime) {
        if (!this.localSplitEnabled || !this.localSplitSession) return;
        if (Engine.Input && Engine.Input.updateSeats) Engine.Input.updateSeats(deltaTime);
        const seat0 = this.localSplitSession.seats[0];
        const seat1 = this.localSplitSession.seats[1];
        const secondPlayer = this.remotePlayerInstances.get(this.localSplitPlayerId);

        if (this.player && this.player.alive) this.player.update(deltaTime, seat0 || Engine.Input);
        if (secondPlayer && secondPlayer.alive && seat1) {
            const rawInput = this.serializeLocalSplitSeatInput(seat1);
            this.storeRemotePlayerInput(this.localSplitPlayerId, rawInput);
            secondPlayer.update(deltaTime, this.createRemoteInputAdapter(rawInput, secondPlayer));
        }
        this.updateRemotePlayerInvulnerability(deltaTime);

        const viewport = this.localSplitSession.viewports.seat1;
        if (secondPlayer && secondPlayer.alive) {
            this.splitCamera
                .setViewSize(viewport.w, viewport.h)
                .setZoom(this.getViewZoom())
                .follow({
                    x: secondPlayer.x,
                    y: secondPlayer.y,
                    vx: secondPlayer.vx || 0,
                    vy: secondPlayer.vy || 0
                }, deltaTime, typeof currentRoom !== 'undefined' ? currentRoom : null);
        }
    },

    /** Shared-camera nexus sim for local co-op: seat0 drives P1, seat1 drives the local-as-remote P2. */
    updateLocalSplitNexus(deltaTime) {
        if (!this.localSplitEnabled || !this.localSplitSession || typeof nexusRoom === 'undefined' || !nexusRoom) {
            return;
        }
        const seat0 = this.localSplitSession.seats[0] || Engine.Input;
        const seat1 = this.localSplitSession.seats[1];
        const moveSpeed = 300;
        const clampPos = (entity) => {
            const size = entity.size || 25;
            entity.x = Math.max(size, Math.min(nexusRoom.width - size, entity.x));
            entity.y = Math.max(size, Math.min(nexusRoom.height - size, entity.y));
        };

        if (this.player && this.player.alive && seat0) {
            const moveInput = seat0.getMovementInput ? seat0.getMovementInput() : { x: 0, y: 0 };
            this.player.vx = moveInput.x * moveSpeed;
            this.player.vy = moveInput.y * moveSpeed;
            this.player.x += this.player.vx * deltaTime;
            this.player.y += this.player.vy * deltaTime;
            clampPos(this.player);
            if (seat0.getAimDirection) {
                this.player.rotation = seat0.getAimDirection();
            }
        }

        const secondPlayer = this.remotePlayerInstances.get(this.localSplitPlayerId);
        if (secondPlayer && secondPlayer.alive && seat1) {
            const rawInput = this.serializeLocalSplitSeatInput(seat1);
            this.storeRemotePlayerInput(this.localSplitPlayerId, rawInput);
            let moveX = 0;
            let moveY = 0;
            if (rawInput.isTouchMode && rawInput.touchJoysticks && rawInput.touchJoysticks.movement) {
                const joystick = rawInput.touchJoysticks.movement;
                if (joystick.active) {
                    moveX = joystick.direction.x * joystick.magnitude;
                    moveY = joystick.direction.y * joystick.magnitude;
                }
            } else {
                if (rawInput.up) moveY -= 1;
                if (rawInput.down) moveY += 1;
                if (rawInput.left) moveX -= 1;
                if (rawInput.right) moveX += 1;
                if (moveX !== 0 && moveY !== 0) {
                    const len = Math.hypot(moveX, moveY);
                    moveX /= len;
                    moveY /= len;
                }
            }
            secondPlayer.vx = moveX * moveSpeed;
            secondPlayer.vy = moveY * moveSpeed;
            secondPlayer.x += secondPlayer.vx * deltaTime;
            secondPlayer.y += secondPlayer.vy * deltaTime;
            clampPos(secondPlayer);
            if (Number.isFinite(rawInput.rotation)) {
                secondPlayer.rotation = rawInput.rotation;
                secondPlayer.lastAimAngle = rawInput.rotation;
            } else if (rawInput.isTouchMode && rawInput.touchJoysticks) {
                const sticks = ['heavyAttack', 'specialAbility', 'basicAttack'];
                let aimed = false;
                for (const key of sticks) {
                    const stick = rawInput.touchJoysticks[key];
                    if (stick && stick.active && stick.magnitude > 0.1) {
                        secondPlayer.rotation = Math.atan2(stick.direction.y, stick.direction.x);
                        secondPlayer.lastAimAngle = secondPlayer.rotation;
                        aimed = true;
                        break;
                    }
                }
                if (!aimed) secondPlayer.rotation = secondPlayer.lastAimAngle || 0;
            } else if (rawInput.mouse) {
                secondPlayer.rotation = Math.atan2(
                    rawInput.mouse.y - secondPlayer.y,
                    rawInput.mouse.x - secondPlayer.x
                );
            }
        }
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

            // Respect lobby offline seats - don't sim ghosts that block doors
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

            // Populate upgrades and currency BEFORE creating the instance so that
            // initializeRemotePlayerInstance reads the correct values from playerUpgrades.
            if (stateData) {
                if (stateData.upgrades) {
                    this.playerUpgrades.set(playerId, JSON.parse(JSON.stringify(stateData.upgrades)));
                }
                if (stateData.currency !== undefined) {
                    this.playerCurrencies.set(playerId, stateData.currency);
                }
            }

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
     * Host: player dropped mid-run - save run snapshot, mark dead, stop simulating.
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

        if (this.doorReadyPlayers) {
            this.doorReadyPlayers.delete(playerId);
            this.syncPlayersOnDoorFromReady();
        }
        if (this._doorGKeyPrevByPlayer) {
            this._doorGKeyPrevByPlayer.delete(playerId);
        }

        console.log(`[MP Disconnect] Saved snapshot for ${playerId}, marked dead (kick to remove from lobby)`);

        if (typeof multiplayerManager !== 'undefined' && multiplayerManager &&
            typeof multiplayerManager.sendGameState === 'function') {
            multiplayerManager.sendGameState();
        }
    },

    /**
     * Host: disconnected player rejoined - restore saved run state (not dead).
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

    /** Host kick / leave lobby - purge sim + saved snapshot for that player. */
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
        if (this.doorReadyPlayers) {
            this.doorReadyPlayers.delete(playerId);
            this.syncPlayersOnDoorFromReady();
        }
        if (this._doorGKeyPrevByPlayer) {
            this._doorGKeyPrevByPlayer.delete(playerId);
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
        const instance = this.remotePlayerInstances ? this.remotePlayerInstances.get(playerId) : null;
        const initialMaxHp = instance && (instance.maxHp || instance.baseMaxHp) ? (instance.maxHp || instance.baseMaxHp) : 100;
        this.remotePlayerStates.set(playerId, {
            id: playerId,
            hp: initialMaxHp,
            maxHp: initialMaxHp,
            invulnerable: false,
            invulnerabilityTime: 0,
            size: 20,
            dead: false
        });
        console.log(`[Host] Initialized state for remote player: ${playerId} (HP: ${initialMaxHp})`);
    },

    // Update invulnerability frames for remote players (host only)
    updateRemotePlayerInvulnerability(deltaTime) {
        if (!this.isHost() && !this.localSplitEnabled) return;

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
                this.hideGroundLootUi();
            }

            console.log(`[Host] Remote player ${playerId} died!`);
        }

        return true; // Damage was applied
    },

    // Update game logic
    update(deltaTime) {
        // Only update if in PLAYING state
        if (this.state !== 'PLAYING') return;

        // Throttled tick for stream companion cross-tab state sync (5Hz max)
        if (typeof CompanionSync !== 'undefined' && typeof CompanionSync.tick === 'function') {
            CompanionSync.tick();
        }

        // Clear SpatialHash grid at the exact start of update
        if (!this.spatialHash && typeof Engine !== 'undefined' && Engine.Physics && typeof Engine.Physics.SpatialHash === 'function') {
            this.spatialHash = new Engine.Physics.SpatialHash(64);
        }
        if (this.spatialHash) {
            this.spatialHash.clear();
        }

        // Snapshot prevX/prevY at exact start of fixed physics step before velocity integration
        if (this.player) {
            if (typeof this.player.savePreviousPosition === 'function') {
                this.player.savePreviousPosition();
            } else {
                this.player.prevX = this.player.x;
                this.player.prevY = this.player.y;
            }
            if (this.spatialHash && this.player.alive) {
                this.spatialHash.insert(this.player);
            }
        }
        if (this.remotePlayerInstances) {
            this.remotePlayerInstances.forEach(p => {
                if (p) {
                    p.prevX = p.x;
                    p.prevY = p.y;
                    if (this.spatialHash && p.alive && !p.dead) this.spatialHash.insert(p);
                }
            });
        }
        if (this.enemies && Array.isArray(this.enemies)) {
            const list = this.enemies;
            for (let i = 0; i < list.length; i++) {
                const e = list[i];
                if (e) {
                    e.prevX = e.x;
                    e.prevY = e.y;
                    if (this.spatialHash && e.alive) this.spatialHash.insert(e);
                }
            }
        }

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

        // Ground item auto-pickup is solo-only. Local co-op / online MP use claim pylons.
        if (typeof checkItemPickup !== 'undefined'
            && !(typeof shouldUseItemPylons === 'function' && shouldUseItemPylons())) {
            const itemActors = typeof this.getLocalCoopActors === 'function'
                ? this.getLocalCoopActors()
                : (this.player && this.player.alive ? [{ player: this.player }] : []);
            for (const actor of itemActors) {
                if (actor.player && actor.player.alive) checkItemPickup(actor.player);
            }
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
            const activeInput = (this.showPauseMenu || (typeof multiplayerMenuVisible !== 'undefined' && multiplayerMenuVisible))
                ? this.getSuppressedInputAdapter()
                : Engine.Input;

            if (this.isHost()) {
                // HOST: Update local player + simulate all remote player instances
                if (this.player && this.player.alive) {
                    this.player.update(deltaTime, activeInput);
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
                        this.player.predictMovementStep(deltaTime, Engine.Input, {
                            allowPredictedDodge: true,
                            applyForces: true,
                            applyAim: true,
                            applyDriftBias: true
                        });
                    }

                    // Ability previews / aim overlays (visual only)
                    if (Engine.Input.isTouchMode && Engine.Input.isTouchMode()) {
                        this.player.dashPreviewActive = false;
                        if (this.player.clearHeavyAttackPreview) {
                            this.player.clearHeavyAttackPreview();
                        }

                        if (this.player.playerClass === 'triangle' && Engine.Input.touchButtons && Engine.Input.touchButtons.dodge) {
                            const button = Engine.Input.touchButtons.dodge;
                            if (button.pressed && Engine.Input.touchJoysticks && Engine.Input.touchJoysticks.dodge) {
                                const joystick = Engine.Input.touchJoysticks.dodge;
                                if (joystick.active && joystick.getMagnitude() > 0.1) {
                                    this.player.dashPreviewActive = true;
                                    this.player.rotation = joystick.getAngle();
                                    if (this.player.updateDashPreview) {
                                        this.player.updateDashPreview(Engine.Input);
                                    }
                                }
                            }
                        }

                        if ((this.player.playerClass === 'square' || this.player.playerClass === 'triangle' || this.player.playerClass === 'hexagon') &&
                            Engine.Input.touchButtons && Engine.Input.touchButtons.heavyAttack) {
                            const button = Engine.Input.touchButtons.heavyAttack;
                            if (button.pressed && Engine.Input.touchJoysticks && Engine.Input.touchJoysticks.heavyAttack) {
                                const joystick = Engine.Input.touchJoysticks.heavyAttack;
                                if (joystick.active && joystick.getMagnitude() > 0.1) {
                                    this.player.rotation = joystick.getAngle();
                                    if (this.player.updateHeavyAttackPreview) {
                                        this.player.updateHeavyAttackPreview(Engine.Input);
                                    }
                                }
                            }
                        }

                        if (Engine.Input.touchJoysticks) {
                            const heavyAttack = Engine.Input.touchJoysticks.heavyAttack;
                            const specialAbility = Engine.Input.touchJoysticks.specialAbility;
                            const basicAttack = Engine.Input.touchJoysticks.basicAttack;

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

                        if (!predictionOn && Engine.Input.getWorldMousePos) {
                            const worldMouse = Engine.Input.getWorldMousePos();
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
            if (this.localSplitEnabled) {
                this.updateLocalSplit(deltaTime);
            } else if (this.player && this.player.alive) {
                const activeInput = (this.showPauseMenu || (typeof multiplayerMenuVisible !== 'undefined' && multiplayerMenuVisible))
                    ? this.getSuppressedInputAdapter()
                    : Engine.Input;
                this.player.update(deltaTime, activeInput);
            }
        }

        // MULTIPLAYER: Snapshot input state BEFORE resetting flags
        // This preserves justPressed/justReleased for serialization
        if (this.isMultiplayerClient() && typeof multiplayerManager !== 'undefined' && multiplayerManager) {
            // Cache current input state before Engine.Input.update() resets justPressed/justReleased
            multiplayerManager.cachedInputSnapshot = multiplayerManager.serializeInput();
        }

        // Update input system (for touch controls) AFTER player reads button states
        // This resets justPressed/justReleased flags for next frame
        if ((typeof Engine !== 'undefined' && Engine.Input) && Engine.Input.update) {
            Engine.Input.update(deltaTime);
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

            if (typeof BiomeEnemyMods !== 'undefined' && BiomeEnemyMods.updateEchoes) {
                const players = this.getAllAlivePlayers ? this.getAllAlivePlayers() : this.player;
                BiomeEnemyMods.updateEchoes(deltaTime, players);
            }

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

            // Animate synced biome echoes between host snapshots (no damage)
            if (typeof BiomeEnemyMods !== 'undefined' && BiomeEnemyMods.updateEchoes) {
                BiomeEnemyMods.updateEchoes(deltaTime, null);
            }
        }

        // Update projectiles
        this.updateProjectiles(deltaTime);

        // Update explosions (remove expired ones, in-place compaction)
        if (this.explosions && Array.isArray(this.explosions)) {
            const list = this.explosions;
            let writeIndex = 0;
            for (let i = 0; i < list.length; i++) {
                const explosion = list[i];
                if (!explosion) continue;
                explosion.elapsed = (explosion.elapsed || 0) + deltaTime;
                if (explosion.elapsed < explosion.duration) {
                    list[writeIndex++] = explosion;
                }
            }
            list.length = writeIndex;
        }

        // Check collisions
        // Host: check collisions if ANY player alive (local or remote)
        // Client: check collisions if local player alive
        let anyPlayerAlive = this.player && this.player.alive;
        if (!anyPlayerAlive && this.remotePlayerInstances) {
            this.remotePlayerInstances.forEach(pInst => {
                if (pInst && pInst.alive) {
                    anyPlayerAlive = true;
                }
            });
        }
        const shouldCheckCollisions = anyPlayerAlive;

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

        // Gear / pylon / healer / safe-machine interact (per local-coop seat)
        const splitP2Alive = !!(this.localSplitEnabled && this.remotePlayerInstances
            && (this.remotePlayerInstances.get(this.localSplitPlayerId) || {}).alive);
        if (typeof groundLoot !== 'undefined' && ((this.player && this.player.alive) || splitP2Alive)) {
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

        // Remove dead enemies and track kills (in-place compaction, zero allocations)
        // This happens AFTER broadcasting so clients receive the alive=false state
        // Keep dead enemies for 1.5 seconds to allow damage numbers to display
        const now = Date.now();
        const DEATH_DISPLAY_DELAY = 1500; // ms

        if (this.enemies && Array.isArray(this.enemies)) {
            const list = this.enemies;
            let writeIndex = 0;
            const isHostOrSolo = this.isHost() || !this.multiplayerEnabled;
            for (let i = 0; i < list.length; i++) {
                const enemy = list[i];
                if (!enemy) continue;
                let keep = true;
                if (!enemy.alive) {
                    if (!enemy.deathTime) {
                        enemy.deathTime = now;
                        if (isHostOrSolo && !enemy._countedForKills) {
                            enemy._countedForKills = true;
                            this.enemiesKilled++;
                        }
                    }
                    if ((now - enemy.deathTime) >= DEATH_DISPLAY_DELAY) {
                        keep = false;
                    }
                }
                if (keep) {
                    list[writeIndex++] = enemy;
                }
            }
            list.length = writeIndex;
        }
    },

    // Start boss intro sequence
    startBossIntro(boss) {
        if (typeof GameBossIntro !== 'undefined') {
            GameBossIntro.startBossIntro(this, boss);
            return;
        }
    },

    // Update boss intro sequence
    updateBossIntro(deltaTime) {
        if (typeof GameBossIntro !== 'undefined') {
            GameBossIntro.updateBossIntro(this, deltaTime);
            return;
        }
    },

    // Skip boss intro
    skipBossIntro() {
        if (typeof GameBossIntro !== 'undefined') {
            GameBossIntro.skipBossIntro(this);
            return;
        }
    },

    // End boss intro sequence
    endBossIntro() {
        if (typeof GameBossIntro !== 'undefined') {
            GameBossIntro.endBossIntro(this);
            return;
        }
    },

        // Render boss intro sequence
    renderBossIntro(ctx) {
        if (typeof GameBossIntro !== 'undefined') {
            GameBossIntro.renderBossIntro(this, ctx);
            return;
        }
    },

    // Check for gear pickup
    checkGearPickup() {
        if (typeof GameLootInteraction !== 'undefined') {
            GameLootInteraction.checkGearPickup(this);
            return;
        }
    },

    // Pick up gear for a specific player (defaults to P1)
    pickupGear(gear, player = null, playerId = null) {
        const target = player || this.player;
        if (!target || !gear) return;
        const claimId = playerId
            || target.playerId
            || (typeof this.getLocalPlayerId === 'function' ? this.getLocalPlayerId() : 'local');

        // Play gear pickup sound
        if (typeof GameAudio !== 'undefined' && GameAudio.sounds) {
            GameAudio.sounds.pickupChime();
        }

        const oldGear = target.equipGear(gear);
        if (typeof Telemetry !== 'undefined' && Telemetry.recordGearEquipped) {
            Telemetry.recordGearEquipped({
                playerId: claimId,
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
            oldGear.x = target.x + offsetX;
            oldGear.y = target.y + offsetY;

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
            if (this.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager
                && target === this.player) {
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

        console.log(`[${claimId}] Picked up ${gear.name || gear.tier + ' ' + gear.slot}`);
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
        console.log(`New stats - Damage: ${target.damage.toFixed(1)}, Defense: ${(target.defense * 100).toFixed(1)}%, Speed: ${target.moveSpeed.toFixed(1)}`);

        // Multiplayer: Notify all players of loot pickup so it's removed everywhere
        // Send full gear object so host can equip it on remote player instance
        if (this.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager
            && target === this.player) {
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
        if (typeof GameDoorController !== 'undefined') {
            GameDoorController.checkDoorCollision(this);
            return;
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
                if (this.doorReadyPlayers) {
                    revived.forEach(id => this.doorReadyPlayers.delete(id));
                }
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
        if (typeof GameRoomTransition !== 'undefined') {
            GameRoomTransition.beginRoomEnterTransition(this, options);
            return;
        }
    },

    updateRoomEnterTransition() {
        if (typeof GameRoomTransition !== 'undefined') {
            GameRoomTransition.updateRoomEnterTransition(this);
            return;
        }
    },

    finishRoomEnterTransition() {
        if (typeof GameRoomTransition !== 'undefined') {
            GameRoomTransition.finishRoomEnterTransition(this);
            return;
        }
    },

    maybeStartBossIntroForCurrentRoom() {
        if (typeof GameRoomTransition !== 'undefined') {
            GameRoomTransition.maybeStartBossIntroForCurrentRoom(this);
            return;
        }
    },

    tickNexusPrewarm() {
        if (typeof GameRoomTransition !== 'undefined') {
            GameRoomTransition.tickNexusPrewarm(this);
            return;
        }
    },

    renderRoomEnterScreen(ctx) {
        if (typeof GameRoomTransition !== 'undefined') {
            GameRoomTransition.renderRoomEnterScreen(this, ctx);
            return;
        }
    },

    renderRoomEnterScreen(ctx) {
        const logicalWidth = this.config.width;
        const logicalHeight = this.config.height;
        const biome = typeof getBiomeForRoom !== 'undefined'
            ? getBiomeForRoom(this.roomNumber)
            : { baseColor: '#1a1a2e', accentColor: '#6699ff' };

        Engine.Renderer.clear(ctx, logicalWidth, logicalHeight, biome.baseColor);

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
        if (!was && now && typeof LedgerManager !== 'undefined' && LedgerManager.recordEvent) {
            LedgerManager.recordEvent('safeRoomEnter', { now: Date.now() });
            // Reset perfectionist slot counters for a new visit
            if (LedgerManager.getRunState) {
                const rs = LedgerManager.getRunState();
                if (rs) {
                    rs.sameSlotRerolls = {};
                    rs.maxSameSlotRerolls = 0;
                }
            }
        } else if (was && !now && typeof LedgerManager !== 'undefined' && LedgerManager.recordEvent) {
            LedgerManager.recordEvent('safeRoomExit', { now: Date.now() });
        }
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
        this.hideGroundLootUi();
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
            if (run.runTiming && typeof run.runTiming === 'object') {
                this.runTiming = JSON.parse(JSON.stringify(run.runTiming));
            } else if (typeof LedgerManager !== 'undefined' && LedgerManager.createEmptyRunTiming) {
                this.runTiming = LedgerManager.createEmptyRunTiming();
                this.runTiming.startedAt = this.startTime;
            }

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
        if (typeof RoguelikeRun !== 'undefined' && RoguelikeRun.advance) {
            return RoguelikeRun.advance(this);
        }
        return this._advanceToNextRoomImpl();
    },

    _advanceToNextRoomImpl() {
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
        this.clearDoorReadyState();
        
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
                if (typeof BiomeEnemyMods !== 'undefined' && BiomeEnemyMods.clearEchoes) {
                    BiomeEnemyMods.clearEchoes();
                }

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
                if (typeof BiomeEnemyMods !== 'undefined' && BiomeEnemyMods.clearEchoes) {
                    BiomeEnemyMods.clearEchoes();
                }

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
                if ((this.isHost() || this.localSplitEnabled) && this.remotePlayerInstances) {
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

                if (newRoom.type === 'boss' && this.player && typeof LedgerManager !== 'undefined' && LedgerManager.recordEvent) {
                    const hpPct = this.player.maxHp > 0 ? this.player.hp / this.player.maxHp : 1;
                    LedgerManager.recordEvent('bossRoomEnter', { hpPct, player: this.player });
                }

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
            Engine.Renderer.clear(this.ctx, this.config.width, this.config.height);
            this.renderBossIntro(this.ctx);
            return; // Skip normal rendering during intro
        }

        // Check if multiplayer is enabled
        const inMultiplayer = this.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.lobbyCode;

        // Render based on game state using Engine.Render pipeline runners
        if (this.state === 'TITLE') {
            this.renderTitlePipeline();
            return;
        } else if (this.state === 'NEXUS') {
            this.renderNexusPipeline();
            return;
        } else if (this.state === 'ENTERING_ROOM') {
            this.renderEnteringRoomPipeline();
            return;
        } else if (this.state === 'PAUSED') {
            if (inMultiplayer) {
                if (this.pausedFromState === 'NEXUS') {
                    this.state = 'NEXUS';
                    this.showPauseMenu = true;
                    this.paused = false;
                    this.renderNexusPipeline();
                    return;
                } else if (this.pausedFromState === 'PLAYING') {
                    this.state = 'PLAYING';
                    this.showPauseMenu = true;
                    this.paused = false;
                    this.renderPlayingPipeline();
                    return;
                } else {
                    this.state = 'NEXUS';
                    this.showPauseMenu = true;
                    this.paused = false;
                    this.renderNexusPipeline();
                    return;
                }
            } else {
                this.renderPausedPipeline();
                return;
            }
        } else {
            // PLAYING: ordered stage pipe assembled by GameRenderPipeline.
            this.renderPlayingPipeline();
            return;
        }
    },

    ensureTitleRenderPipeline() {
        if (this._titleRenderPipeline) return this._titleRenderPipeline;
        if (typeof GameRenderPipeline === 'undefined' || !GameRenderPipeline.createTitlePipeline) {
            throw new Error('GameRenderPipeline is required for TITLE render.');
        }
        this._titleRenderPipeline = GameRenderPipeline.createTitlePipeline(this);
        if (typeof Engine !== 'undefined' && Engine.Debug && typeof Engine.Debug.registerPipeline === 'function') {
            Engine.Debug.registerPipeline('title', this._titleRenderPipeline, { label: 'TITLE' });
        }
        return this._titleRenderPipeline;
    },

    renderTitlePipeline() {
        const pipeline = this.ensureTitleRenderPipeline();
        const frame = GameRenderPipeline.beginTitleFrame(this, {
            alpha: this._renderAlpha,
            timings: this.currentFrameTimings
        });
        pipeline.run(frame);
    },

    ensureNexusRenderPipeline() {
        if (this._nexusRenderPipeline) return this._nexusRenderPipeline;
        if (typeof GameRenderPipeline === 'undefined' || !GameRenderPipeline.createNexusPipeline) {
            throw new Error('GameRenderPipeline is required for NEXUS render.');
        }
        this._nexusRenderPipeline = GameRenderPipeline.createNexusPipeline(this);
        if (typeof Engine !== 'undefined' && Engine.Debug && typeof Engine.Debug.registerPipeline === 'function') {
            Engine.Debug.registerPipeline('nexus', this._nexusRenderPipeline, { label: 'NEXUS' });
        }
        return this._nexusRenderPipeline;
    },

    renderNexusPipeline() {
        const pipeline = this.ensureNexusRenderPipeline();
        const frame = GameRenderPipeline.beginNexusFrame(this, {
            alpha: this._renderAlpha,
            timings: this.currentFrameTimings
        });
        pipeline.run(frame);
    },

    ensureEnteringRoomRenderPipeline() {
        if (this._enteringRoomRenderPipeline) return this._enteringRoomRenderPipeline;
        if (typeof GameRenderPipeline === 'undefined' || !GameRenderPipeline.createEnteringRoomPipeline) {
            throw new Error('GameRenderPipeline is required for ENTERING_ROOM render.');
        }
        this._enteringRoomRenderPipeline = GameRenderPipeline.createEnteringRoomPipeline(this);
        if (typeof Engine !== 'undefined' && Engine.Debug && typeof Engine.Debug.registerPipeline === 'function') {
            Engine.Debug.registerPipeline('enteringRoom', this._enteringRoomRenderPipeline, { label: 'ENTERING_ROOM' });
        }
        return this._enteringRoomRenderPipeline;
    },

    renderEnteringRoomPipeline() {
        const pipeline = this.ensureEnteringRoomRenderPipeline();
        const frame = GameRenderPipeline.beginEnteringRoomFrame(this, {
            alpha: this._renderAlpha,
            timings: this.currentFrameTimings
        });
        pipeline.run(frame);
    },

    ensurePausedRenderPipeline() {
        if (this._pausedRenderPipeline) return this._pausedRenderPipeline;
        if (typeof GameRenderPipeline === 'undefined' || !GameRenderPipeline.createPausedPipeline) {
            throw new Error('GameRenderPipeline is required for PAUSED render.');
        }
        this._pausedRenderPipeline = GameRenderPipeline.createPausedPipeline(this);
        if (typeof Engine !== 'undefined' && Engine.Debug && typeof Engine.Debug.registerPipeline === 'function') {
            Engine.Debug.registerPipeline('paused', this._pausedRenderPipeline, { label: 'PAUSED' });
        }
        return this._pausedRenderPipeline;
    },

    renderPausedPipeline() {
        const pipeline = this.ensurePausedRenderPipeline();
        const frame = GameRenderPipeline.beginPausedFrame(this, {
            alpha: this._renderAlpha,
            timings: this.currentFrameTimings
        });
        pipeline.run(frame);
    },

    /** Ensure the PLAYING stage recipe exists (lazy; game owns assembly). */
    ensurePlayingRenderPipeline() {
        if (this._playingRenderPipeline) return this._playingRenderPipeline;
        if (typeof GameRenderPipeline === 'undefined' || !GameRenderPipeline.createPlayingPipeline) {
            throw new Error('GameRenderPipeline is required for PLAYING render.');
        }
        this._playingRenderPipeline = GameRenderPipeline.createPlayingPipeline(this);
        this._playingRenderTargets = new Engine.Render.Targets();
        if (typeof Engine !== 'undefined' && Engine.Debug) {
            if (typeof Engine.Debug.registerPipeline === 'function') {
                Engine.Debug.registerPipeline('playing', this._playingRenderPipeline, {
                    label: 'PLAYING'
                });
            } else if (typeof Engine.Debug.bindPipeline === 'function') {
                Engine.Debug.bindPipeline(this._playingRenderPipeline);
            }
        }
        return this._playingRenderPipeline;
    },

    /** Release pooled render targets (world offscreen). Keeps main canvas. */
    cleanupPlayingRenderTargets() {
        if (typeof GameRenderPipeline !== 'undefined' && GameRenderPipeline.cleanupPlayingTargets) {
            GameRenderPipeline.cleanupPlayingTargets(this);
        } else if (this._playingRenderTargets && typeof this._playingRenderTargets.releaseAll === 'function') {
            this._playingRenderTargets.releaseAll();
            this.offscreenCanvas = null;
            this.offscreenCtx = null;
        }
    },

    /**
     * PLAYING path: gather trauma bag, ensure named targets, run the ordered pipe.
     * Local co-op runs the same recipe twice — once per viewport/camera/view-player.
     */
    renderPlayingPipeline() {
        const pipeline = this.ensurePlayingRenderPipeline();
        const now = Date.now() / 1000;
        const damageTraumaDuration = 0.35;
        const traumaNow = performance.now();

        if (!this.localSplitEnabled || !this.localSplitSession) {
            let playerToCheck = this.player;
            if (!playerToCheck && this.multiplayerEnabled && typeof this.getLocalPlayerId === 'function') {
                const localPlayerId = this.getLocalPlayerId();
                if (localPlayerId && this.remotePlayerInstances) {
                    playerToCheck = this.remotePlayerInstances.get(localPlayerId);
                }
            }
            const trauma = this.getDamageTraumaParams(
                playerToCheck, now, traumaNow, damageTraumaDuration
            );
            const useChromaticPass = trauma.active && trauma.intensity >= 0.18;
            const frame = GameRenderPipeline.beginPlayingFrame(this, {
                alpha: this._renderAlpha,
                timings: this.currentFrameTimings,
                targets: this._playingRenderTargets,
                bag: { trauma, useChromaticPass, viewPlayer: playerToCheck || this.player }
            });
            pipeline.run(frame);
            if (frame.stageTimings) {
                this._lastStageTimings = Object.assign(Object.create(null), frame.stageTimings);
            }
            return;
        }

        const secondPlayer = this.remotePlayerInstances.get(this.localSplitPlayerId);

        // Pass 0 (local player, seat0)
        const trauma0 = this.getDamageTraumaParams(
            this.player, now, traumaNow, damageTraumaDuration
        );
        const useChromaticPass0 = trauma0.active && trauma0.intensity >= 0.18;
        const viewport0 = this.localSplitSession.viewports.seat0;
        const begun0 = Engine.Render.beginViewport(this.ctx, viewport0);
        try {
            this._activeRenderCamera = this.camera;
            this._activeRenderViewport = viewport0;
            this._activeViewPlayer = this.player;
            const frame = GameRenderPipeline.beginPlayingFrame(this, {
                alpha: this._renderAlpha,
                timings: this.currentFrameTimings,
                targets: this._playingRenderTargets,
                camera: this.camera,
                viewport: viewport0,
                bag: {
                    trauma: trauma0,
                    useChromaticPass: useChromaticPass0,
                    viewPlayer: this.player
                }
            });
            pipeline.run(frame);
            if (frame.stageTimings) {
                this._lastStageTimings = Object.assign(
                    this._lastStageTimings || Object.create(null),
                    frame.stageTimings
                );
            }
        } finally {
            this._activeRenderCamera = null;
            this._activeRenderViewport = null;
            this._activeViewPlayer = null;
            Engine.Render.endViewport(this.ctx, begun0);
        }

        // Pass 1 (second player, seat1)
        const viewPlayer1 = secondPlayer || this.player;
        const trauma1 = this.getDamageTraumaParams(
            viewPlayer1, now, traumaNow, damageTraumaDuration
        );
        const useChromaticPass1 = trauma1.active && trauma1.intensity >= 0.18;
        const viewport1 = this.localSplitSession.viewports.seat1;
        const begun1 = Engine.Render.beginViewport(this.ctx, viewport1);
        try {
            this._activeRenderCamera = this.splitCamera;
            this._activeRenderViewport = viewport1;
            this._activeViewPlayer = viewPlayer1;
            const frame = GameRenderPipeline.beginPlayingFrame(this, {
                alpha: this._renderAlpha,
                timings: this.currentFrameTimings,
                targets: this._playingRenderTargets,
                camera: this.splitCamera,
                viewport: viewport1,
                bag: {
                    trauma: trauma1,
                    useChromaticPass: useChromaticPass1,
                    viewPlayer: viewPlayer1
                }
            });
            pipeline.run(frame);
            if (frame.stageTimings) {
                this._lastStageTimings = Object.assign(
                    this._lastStageTimings || Object.create(null),
                    frame.stageTimings
                );
            }
        } finally {
            this._activeRenderCamera = null;
            this._activeRenderViewport = null;
            this._activeViewPlayer = null;
            Engine.Render.endViewport(this.ctx, begun1);
        }

        this.renderLocalSplitDivider();
    },

    /** Thin seat divider only — each seat already ran the full PLAYING recipe. */
    renderLocalSplitDivider() {
        if (!this.localSplitEnabled || !this.localSplitSession) return;
        const viewport = this.localSplitSession.viewports.seat1;
        const ctx = this.ctx;
        ctx.save();
        ctx.setTransform(this.dpr || 1, 0, 0, this.dpr || 1, 0, 0);
        ctx.fillStyle = 'rgba(255,255,255,0.65)';
        if (this.localSplitLayout === 'vertical') {
            ctx.fillRect(viewport.x - 1, 0, 2, this.config.height);
        } else {
            ctx.fillRect(0, viewport.y - 1, this.config.width, 2);
        }
        ctx.restore();
    },

    // Create cached light sprite for efficient rendering
    createLightSprite() {
        const size = 256;
        const canvas = Engine.Graphics.createCanvas(size, size);
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
        const key = color || 'rgba(255,255,255,0.75)';
        return Engine.Graphics.GlowAtlas.get(key);
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

        if ((typeof GameRender !== 'undefined') && GameRender.getCachedDoor) {
            GameRender.getCachedDoor(80, 120);
            GameRender.getCachedDoor(100, 140);
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
        if (window.engine) window.engine.updateFrameBudgetGovernor(frameTimeMs, renderTimeMs);
    },

    isGeckoFamilyEngine() {
        return window.engine ? window.engine.isGeckoFamilyEngine() : false;
    },

    preferSpriteShadows() {
        return window.engine ? window.engine.preferSpriteShadows() : false;
    },

    getDprCap() {
        return window.engine ? window.engine.getDprCap() : 2;
    },

    getBaseRenderQuality() {
        return (typeof GameRenderQuality !== 'undefined')
            ? GameRenderQuality.getBaseRenderQuality(this)
            : { vignetteScale: 0.5, maxSceneryLights: Infinity, gearRingPoints: 64, groundLootAnimatedRing: true, remoteFullRender: true, maxBeamLights: 8, damageFxScale: 1, voxelParticleCap: 512, shardParticleCap: 256 };
    },

    getRenderQualityForTier(tier, fxBoost) {
        const boost = fxBoost != null
            ? fxBoost
            : (window.engine && window.engine.fxBoost != null ? window.engine.fxBoost : 0);
        return (typeof GameRenderQuality !== 'undefined')
            ? GameRenderQuality.getRenderQualityForTier(tier, this, boost)
            : this.getBaseRenderQuality();
    },

    getFrameBudgetThresholds() {
        return (typeof GameRenderQuality !== 'undefined')
            ? GameRenderQuality.getFrameBudgetThresholds()
            : (window.engine ? window.engine.getFrameBudgetThresholds() : { mediumFrame: 30, mediumRender: 22, heavyFrame: 34, heavyRender: 28, restoreFrame: 24, restoreRender: 17, mediumVignetteScale: 0.4, heavyVignetteScale: 0.33 });
    },

    // Approximate neon stroke glow without ctx.shadowBlur (Servo/Firefox).
    strokeNeonRect(ctx, x, y, w, h, color, blur, lineWidth) {
        const lw = lineWidth != null ? lineWidth : 2;
        Engine.Graphics.neonStrokeRect(
            ctx,
            { x, y, width: w, height: h },
            color,
            blur,
            lw,
            {
                mode: this.preferSpriteShadows()
                    ? Engine.Graphics.NeonMode.MULTIPASS_LIGHTER
                    : Engine.Graphics.NeonMode.SHADOW_BLUR
            }
        );
    },

    fillNeonText(ctx, text, x, y, color, blur) {
        Engine.Graphics.neonFillText(ctx, text, x, y, color, blur, {
            mode: this.preferSpriteShadows()
                ? Engine.Graphics.NeonMode.MULTIPASS_LIGHTER
                : Engine.Graphics.NeonMode.SHADOW_BLUR
        });
    },

    drawAdditiveGlowSprite(ctx, x, y, radius, colorCss, alpha) {
        const sprite = this.getCachedGlowSprite(colorCss || '#ffffff');
        if (!sprite) return false;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = alpha != null ? alpha : 0.2;
        ctx.drawImage(sprite, x - radius, y - radius, radius * 2, radius * 2);
        ctx.restore();
        return true;
    },

    shouldCollectDebugMetrics() {
        if (typeof Engine !== 'undefined' && Engine.Debug && typeof Engine.Debug.shouldCollect === 'function') {
            return Engine.Debug.shouldCollect();
        }
        return (typeof RunProfiler !== 'undefined' && RunProfiler.isActive()) ||
            (typeof DebugPanel !== 'undefined' && DebugPanel.visible) ||
            (typeof DebugFlags !== 'undefined' && DebugFlags.RENDER_TIMING);
    },

    getRenderQualityTier() {
        const q = this.renderQuality || {};
        if (q.gearRingPoints === 24 && q.remoteFullRender === false) return 'heavy';
        if (q.gearRingPoints === 32 || q.groundLootAnimatedRing === false) return 'medium';
        const boost = (typeof window !== 'undefined' && window.engine && window.engine.fxBoost != null)
            ? window.engine.fxBoost
            : 0;
        if (boost > 0.12 || (q.voxelParticleCap != null && q.voxelParticleCap > 512)) return 'boost';
        return 'normal';
    },

    buildDebugMetricsSnapshot() {
        const lists = this.visibleFrameLists || {};
        const totalGroundLoot = (typeof groundLoot !== 'undefined' && Array.isArray(groundLoot))
            ? groundLoot.length
            : 0;

        // TITLE attract draws its sandbox without the PLAYING visibility pass, so
        // visibleFrameLists stays stale/empty while Game.enemies still has attract
        // actors — report what is actually drawn instead of 0/x.
        const counts = this.state === 'TITLE'
            ? this.buildTitleAttractSceneCounts()
            : {
                enemiesVisible: lists.enemies ? lists.enemies.length : 0,
                enemiesTotal: this.enemies ? this.enemies.length : 0,
                projectilesVisible: lists.projectiles ? lists.projectiles.length : 0,
                projectilesTotal: this.projectiles ? this.projectiles.length : 0,
                groundLootVisible: lists.groundLoot ? lists.groundLoot.length : 0,
                groundLootTotal: totalGroundLoot,
                groundItemsVisible: lists.groundItems ? lists.groundItems.length : 0,
                groundItemsTotal: this.groundItems ? this.groundItems.length : 0
            };

        return {
            fps: this.fps || 0,
            qualityTier: this.getRenderQualityTier(),
            frameBudget: (typeof window !== 'undefined' && window.engine && window.engine.debugFrameBudget)
                ? window.engine.debugFrameBudget
                : (this.debugFrameBudget || { frameAvg: 0, renderAvg: 0 }),
            counts,
            subTimings: {
                groundLoot: (this.renderSubTimings && this.renderSubTimings.groundLoot) || 0,
                detailRings: (this.renderSubTimings && this.renderSubTimings.gearRings) || 0,
                remoteActors: (this.renderSubTimings && this.renderSubTimings.remotePlayers) || 0,
                worldGlow: (this.renderSubTimings && this.renderSubTimings.worldGlow) || 0,
                worldBodies: (this.renderSubTimings && this.renderSubTimings.worldBodies) || 0
            },
            stageTimings: this._lastStageTimings || null
        };
    },

    /** Attract mode renders without camera cull — count drawable actors. */
    buildTitleAttractSceneCounts() {
        let enemiesVisible = 0;
        const enemies = this.enemies;
        const enemiesTotal = enemies ? enemies.length : 0;
        if (enemies) {
            for (let i = 0; i < enemies.length; i++) {
                const enemy = enemies[i];
                if (!enemy) continue;
                if (enemy.alive) {
                    enemiesVisible++;
                    continue;
                }
                if (typeof isEnemyDeathJuiceVisible === 'function' && isEnemyDeathJuiceVisible(enemy)) {
                    enemiesVisible++;
                }
            }
        }

        const projectilesTotal = this.projectiles ? this.projectiles.length : 0;
        const groundLootTotal = (typeof groundLoot !== 'undefined' && Array.isArray(groundLoot))
            ? groundLoot.length
            : 0;
        const groundItemsTotal = this.groundItems ? this.groundItems.length : 0;

        return {
            enemiesVisible,
            enemiesTotal,
            // Attract draws every live projectile (no cull lists).
            projectilesVisible: projectilesTotal,
            projectilesTotal,
            groundLootVisible: groundLootTotal,
            groundLootTotal,
            groundItemsVisible: groundItemsTotal,
            groundItemsTotal
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
    renderVignette(ctx, viewport = null, camera = null) {
        // Initialize light sprite if not exists
        if (!this.lightSprite) {
            this.lightSprite = this.createLightSprite();
        }
        // Get Device Pixel Ratio (or default to 1)
        const dpr = this.dpr || 1;
        const activeCamera = camera || this._activeRenderCamera || this.camera;
        const activeViewport = viewport || this._activeRenderViewport;
        const logicalWidth = activeViewport ? activeViewport.w : this.config.width;
        const logicalHeight = activeViewport ? activeViewport.h : this.config.height;
        const originX = activeViewport ? activeViewport.x : 0;
        const originY = activeViewport ? activeViewport.y : 0;
        const physicalWidth = Math.floor(logicalWidth * dpr);
        const physicalHeight = Math.floor(logicalHeight * dpr);

        // Keep lighting low-res and let image smoothing create the soft vignette.
        const adaptiveEnabled = typeof DebugFlags === 'undefined' || DebugFlags.ADAPTIVE_RENDER_QUALITY !== false;
        const lightScale = adaptiveEnabled && this.renderQuality && this.renderQuality.vignetteScale
            ? this.renderQuality.vignetteScale
            : 0.5;

        if (!this._vignetteLightMask) {
            this._vignetteLightMask = Engine.FX.LightMask.create();
            this._playerLightMask = Engine.FX.LightMask.create();
        }
        this._vignetteLightMask.ensure(logicalWidth, logicalHeight, { dpr, scale: lightScale });
        this._playerLightMask.ensure(logicalWidth, logicalHeight, { dpr, scale: lightScale });
        this.vignetteCanvas = this._vignetteLightMask.canvas;
        this.vignetteCtx = this._vignetteLightMask.ctx;
        this.playerLightCanvas = this._playerLightMask.canvas;
        this.playerLightCtx = this._playerLightMask.ctx;

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

        const currentZoom = this.getViewZoom();
        const centerX = logicalWidth / 2;
        const centerY = logicalHeight / 2;
        const visibleLists = this.visibleFrameLists || null;

        // Helper to get screen coordinates (viewport-local)
        const getScreenPos = (x, y) => {
            // Apply camera transform: (world - camera) * zoom + center + shake
            const screenX = (x - activeCamera.x) * currentZoom + centerX + this.screenShakeOffset.x;
            const screenY = (y - activeCamera.y) * currentZoom + centerY + this.screenShakeOffset.y;

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

            const viewX = activeCamera.x - screenW / 2 - margin;
            const viewY = activeCamera.y - screenH / 2 - margin;
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

        // Stage 2: Draw static settled voxel/fluid canvas to punch through vignette using normalized lighten clamping.
        // Single blit with globalAlpha = 0.65 and 'lighten' composite prevents multiplicative compounding/blown-out white holes.
        if (typeof VoxelStaticCanvas !== 'undefined' && VoxelStaticCanvas.dirty && VoxelStaticCanvas.canvas && VoxelStaticCanvas.canvas.width > 0 && VoxelStaticCanvas.canvas.height > 0) {
            vCtx.save();
            vCtx.translate(centerX + this.screenShakeOffset.x, centerY + this.screenShakeOffset.y);
            vCtx.scale(currentZoom, currentZoom);
            vCtx.translate(-activeCamera.x, -activeCamera.y);

            const destW = VoxelStaticCanvas.logicalWidth || VoxelStaticCanvas.width || VoxelStaticCanvas.canvas.width;
            const destH = VoxelStaticCanvas.logicalHeight || VoxelStaticCanvas.height || VoxelStaticCanvas.canvas.height;
            vCtx.globalCompositeOperation = 'lighten';
            vCtx.globalAlpha = 0.65;
            vCtx.drawImage(VoxelStaticCanvas.canvas, 0, 0, destW, destH);
            vCtx.restore();

            // Explicitly restore composite operation and alpha for subsequent lights
            vCtx.globalCompositeOperation = 'lighten';
            vCtx.globalAlpha = 1.0;
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
                const camX = activeCamera.x;
                const camY = activeCamera.y;
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

        // 3.9. Arena wave trigger plaza — punch through darkness so the pad stays readable
        if (typeof currentRoom !== 'undefined' && currentRoom && currentRoom.wavePylon) {
            const wp = currentRoom.wavePylon;
            const padR = wp.padRadius || 195;
            const lightRadius = wp.active
                ? Math.max(280, padR * 1.55)
                : Math.max(160, padR * 1.05);
            if (isVisibleInVignette(wp.x, wp.y, lightRadius)) {
                drawLight(vCtx, wp.x, wp.y, lightRadius);
            }
        }
        // 3.10. Gore-clean pad — amber warm light, always present in arena
        if (typeof currentRoom !== 'undefined' && currentRoom && currentRoom.goreCleanPad) {
            const gcp = currentRoom.goreCleanPad;
            const lightRadius = Math.max(120, (gcp.padRadius || 68) * 1.8);
            if (isVisibleInVignette(gcp.x, gcp.y, lightRadius)) {
                drawLight(vCtx, gcp.x, gcp.y, lightRadius);
            }
        }

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
            const renderPos = this.getLocalPlayerRenderPosition();
            if (renderPos) {
                drawLight(vCtx, renderPos.x, renderPos.y, 400); // Reduced from 600 for stealth gameplay
            }
        }

        // Remote Players Lights (Multiplayer)
        if (this.remotePlayers && this.remotePlayers.length > 0) {
            this.remotePlayers.forEach(remotePlayer => {
                if (remotePlayer && !remotePlayer.dead) { // Check if alive
                    drawLight(vCtx, remotePlayer.x, remotePlayer.y, 400); // Reduced from 600
                }
            });
        }

        // Local co-op / host-authoritative remote instances
        if (this.remotePlayerInstances && this.remotePlayerInstances.size > 0) {
            this.remotePlayerInstances.forEach((playerInstance) => {
                if (playerInstance && playerInstance.alive && !playerInstance.dead) {
                    drawLight(vCtx, playerInstance.x, playerInstance.y, 400);
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
        vCtx.translate(-activeCamera.x, -activeCamera.y);

        // Draw grid lines (using lighten to add to light mask)
        // The pattern has the glow "baked in" (wide lines with alpha)
        if (typeof drawBiomeGrid === 'function') {
            const prevAlpha = vCtx.globalAlpha;
            vCtx.globalAlpha = (typeof VoxelStaticCanvas !== 'undefined' && VoxelStaticCanvas.dirty) ? 0.35 : 1.0;
            drawBiomeGrid(vCtx, this.roomNumber, true); // true = isVignetteMask
            vCtx.globalAlpha = prevAlpha;
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
        this._vignetteLightMask.composite(ctx, {
            x: Math.floor(originX * dpr),
            y: Math.floor(originY * dpr),
            width: physicalWidth,
            height: physicalHeight,
            smoothing: true
        });
        ctx.restore();
    },

    _visibleFrameListsCache: null,

    /** Frustum cull helper used by visibility gather and glow extras. */
    isEntityVisible(entity, margin = 100, camera = null, viewport = null) {
        if (!entity) return false;
        const activeCamera = camera || this._activeRenderCamera || this.camera;
        if (!activeCamera) return true;
        const activeViewport = viewport || this._activeRenderViewport;
        const zoom = typeof this.getViewZoom === 'function' ? this.getViewZoom() : 1;
        const width = activeViewport ? activeViewport.w : (this.config ? this.config.width : 1280);
        const height = activeViewport ? activeViewport.h : (this.config ? this.config.height : 720);
        const halfWidth = (width / 2) / zoom;
        const halfHeight = (height / 2) / zoom;
        const left = activeCamera.x - halfWidth;
        const top = activeCamera.y - halfHeight;
        const right = activeCamera.x + halfWidth;
        const bottom = activeCamera.y + halfHeight;
        const rad = Math.max(0, Number(margin ?? entity.cullRadius ?? entity.radius) || 0);
        return entity.x + rad >= left
            && entity.x - rad <= right
            && entity.y + rad >= top
            && entity.y - rad <= bottom;
    },

    /** Build per-frame visible lists for glow, bodies, and vignette. */
    gatherVisibleFrameLists(camera = null, viewport = null) {
        if (!this._visibleFrameListsCache) {
            this._visibleFrameListsCache = {
                enemies: [],
                enemyLights: [],
                projectiles: [],
                projectileLights: [],
                groundLoot: [],
                groundItems: [],
                itemPylons: []
            };
        }
        const frameLists = this._visibleFrameListsCache;
        frameLists.enemies.length = 0;
        frameLists.enemyLights.length = 0;
        frameLists.projectiles.length = 0;
        frameLists.projectileLights.length = 0;
        frameLists.groundLoot.length = 0;
        frameLists.groundItems.length = 0;
        frameLists.itemPylons.length = 0;

        const activeCamera = camera || this._activeRenderCamera || this.camera;
        let isVisible;
        if (activeCamera) {
            const activeViewport = viewport || this._activeRenderViewport;
            const zoom = typeof this.getViewZoom === 'function' ? this.getViewZoom() : 1;
            const width = activeViewport ? activeViewport.w : (this.config ? this.config.width : 1280);
            const height = activeViewport ? activeViewport.h : (this.config ? this.config.height : 720);
            const halfWidth = (width / 2) / zoom;
            const halfHeight = (height / 2) / zoom;
            const shakePadX = this.screenShakeOffset ? Math.abs(this.screenShakeOffset.x || 0) : 0;
            const shakePadY = this.screenShakeOffset ? Math.abs(this.screenShakeOffset.y || 0) : 0;
            const left = activeCamera.x - halfWidth - shakePadX;
            const top = activeCamera.y - halfHeight - shakePadY;
            const right = activeCamera.x + halfWidth + shakePadX;
            const bottom = activeCamera.y + halfHeight + shakePadY;

            isVisible = (entity, margin) => {
                if (!entity) return false;
                const rad = Math.max(0, Number(margin ?? entity.cullRadius ?? entity.radius) || 0);
                return entity.x + rad >= left
                    && entity.x - rad <= right
                    && entity.y + rad >= top
                    && entity.y - rad <= bottom;
            };
        } else {
            isVisible = (entity) => !!entity;
        }

        if (Array.isArray(this.enemies)) {
            for (let i = 0; i < this.enemies.length; i++) {
                const enemy = this.enemies[i];
                if (!enemy) continue;
                const visible = enemy.alive ||
                    (typeof isEnemyDeathJuiceVisible === 'function' && isEnemyDeathJuiceVisible(enemy));
                if (!visible) continue;
                const enemySize = enemy.size || 20;
                if (isVisible(enemy, enemySize * 3)) frameLists.enemies.push(enemy);
                if (isVisible(enemy, enemySize * 4 + 100)) frameLists.enemyLights.push(enemy);
            }
        }
        if (Array.isArray(this.projectiles)) {
            for (let i = 0; i < this.projectiles.length; i++) {
                const projectile = this.projectiles[i];
                if (!projectile) continue;
                const projSize = projectile.size || 5;
                if (isVisible(projectile, projSize * 4)) frameLists.projectiles.push(projectile);
                const lightMargin = projectile.vignetteLightRadius || (projSize * 6 + 50);
                if (isVisible(projectile, lightMargin)) frameLists.projectileLights.push(projectile);
            }
        }
        if (typeof groundLoot !== 'undefined' && Array.isArray(groundLoot)) {
            for (let i = 0; i < groundLoot.length; i++) {
                const item = groundLoot[i];
                if (item && isVisible(item, 50)) frameLists.groundLoot.push(item);
            }
        }
        if (Array.isArray(this.groundItems)) {
            for (let i = 0; i < this.groundItems.length; i++) {
                const item = this.groundItems[i];
                if (item && isVisible(item, 20)) frameLists.groundItems.push(item);
            }
        }
        if (Array.isArray(this.itemPylons)) {
            for (let i = 0; i < this.itemPylons.length; i++) {
                const pylon = this.itemPylons[i];
                if (pylon && !pylon.disappearing && isVisible(pylon, 30)) frameLists.itemPylons.push(pylon);
            }
        }
        return frameLists;
    },

    /** Additive neon glow phase. Camera must already be applied. */
    renderWorldGlows(ctx, lists) {
        const profile = typeof this.shouldCollectDebugMetrics === 'function' && this.shouldCollectDebugMetrics();
        const glowPhaseStart = profile ? performance.now() : 0;
        const frameLists = lists || this.visibleFrameLists || {
            enemies: [], enemyLights: [], projectiles: [], projectileLights: [],
            groundLoot: [], groundItems: [], itemPylons: []
        };
        const isVisible = (entity, margin) => this.isEntityVisible(entity, margin);

        // ------------------------------------------
        // PHASE 1: THE GLOWS (The "Neon" look)
        // ------------------------------------------
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        // Create cached glow sprite if not exists
        if (!this.glowSprite) {
            const size = 128;
            const canvas = Engine.Graphics.createCanvas(size, size);
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

        // Draw Projectile Glows (Culled) with high-contrast pulsing aura for ground visibility
        const projPulseTime = Date.now() * 0.008; // ~1.3Hz pulse frequency
        const projPulseScale = 1.0 + Math.sin(projPulseTime) * 0.35; // Distinct 0.65x to 1.35x glow pulse
        frameLists.projectiles.forEach(projectile => {
            const baseGlow = projectile.glowSize || (projectile.size * 4.5);
            const glowSize = baseGlow * projPulseScale;
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
            const renderPos = this.getLocalPlayerRenderPosition();

            // Use cached glow if available, otherwise draw gradient
            if (renderPos && isVisible({ x: renderPos.x, y: renderPos.y, size: this.player.size }, glowSize)) {
                drawGlow(renderPos.x, renderPos.y, glowSize, playerColor);
            }
        }

        // Draw Remote Player Glows (multiplayer)
        const inMultiplayer = this.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.lobbyCode;
        if (inMultiplayer || this.localSplitEnabled) {
            if ((this.isHost() || this.localSplitEnabled) && this.remotePlayerInstances && this.remotePlayerInstances.size > 0) {
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

        if (profile) {
            const glowPhaseTime = performance.now() - glowPhaseStart;
            if (this.currentFrameTimings) {
                this.currentFrameTimings.worldGlow += glowPhaseTime;
                this.currentFrameTimings.world += glowPhaseTime;
            }
            this.recordRenderSubTiming('worldGlow', glowPhaseTime);
        }

    },

    /** Solid body / entity phase. Camera must already be applied. */
    renderWorldBodies(ctx, lists) {
        const profile = typeof this.shouldCollectDebugMetrics === 'function' && this.shouldCollectDebugMetrics();
        const bodiesPhaseStart = profile ? performance.now() : 0;
        const frameLists = lists || this.visibleFrameLists || {
            enemies: [], enemyLights: [], projectiles: [], projectileLights: [],
            groundLoot: [], groundItems: [], itemPylons: []
        };

        // ------------------------------------------
        // PHASE 2: THE BODIES (The "Solid" look)
        // ------------------------------------------

        if (typeof renderVoxelStaticLayer === 'function') {
            renderVoxelStaticLayer(ctx);
        }

        // Draw item aura rings (damage aura, slow aura) - BEFORE player render so they appear underneath
        if (typeof renderItemVisuals !== 'undefined') {
            renderItemVisuals(ctx);
        }

        // Solid silhouettes punch through settled viscera so spray hugs biome shapes.
        if (typeof renderRoomObstacles === 'function') {
            renderRoomObstacles(ctx, this.roomNumber, { occlude: true });
        }

        if (typeof renderDebrisInteractiveFixtures === 'function') {
            renderDebrisInteractiveFixtures(ctx, this.roomNumber);
        }

        // Arena wave pad: above settled viscera, below player/loot competition targets.
        if (typeof this.renderArenaWavePylon === 'function') {
            this.renderArenaWavePylon(ctx, { promptOnly: false });
        }
        if (typeof this.renderArenaGoreCleanPad === 'function') {
            this.renderArenaGoreCleanPad(ctx, { promptOnly: false });
        }
        if (typeof this.renderStylePickups === 'function') {
            this.renderStylePickups(ctx);
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
            if (typeof drawCombatClarityBoost === 'function') {
                drawCombatClarityBoost(ctx, this.player, { rimColor: 'rgba(180, 230, 255, 0.65)' });
            }
            this.player.render(ctx);
        }

        // Draw remote players (multiplayer)
        if ((this.remotePlayers && this.remotePlayers.length > 0) ||
            (this.localSplitEnabled && this.remotePlayerInstances && this.remotePlayerInstances.size > 0)) {
            this.renderRemotePlayers(ctx);
        }

        // Draw enemies (Solid bodies on top of glows / spray)
        frameLists.enemies.forEach(enemy => {
            if (typeof drawCombatClarityBoost === 'function') {
                drawCombatClarityBoost(ctx, enemy);
            }
            enemy.render(ctx);
        });
        if (typeof BiomeEnemyMods !== 'undefined' && BiomeEnemyMods.renderEchoes) {
            BiomeEnemyMods.renderEchoes(ctx);
        }

        // Draw projectiles (Solid bodies)
        const projPulseTime = Date.now() * 0.005;
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
                const pulseOffset = (projectile.x || 0) * 0.02 + (projectile.y || 0) * 0.02;
                const pulseVal = Math.sin(projPulseTime * 1.5 + pulseOffset);
                const drawRadius = (projectile.size || 6) * (1.1 + pulseVal * 0.28); // Dynamic pulse between 0.82x and 1.38x size

                // High-contrast black outline border first (ensures pop over dark red/black viscera)
                ctx.strokeStyle = '#000000';
                ctx.lineWidth = 3.5;
                ctx.beginPath();
                ctx.arc(projectile.x, projectile.y, drawRadius + 1.5, 0, Math.PI * 2);
                ctx.stroke();

                // Bright base projectile core (yellow/custom)
                ctx.fillStyle = projectile.color || '#ffff00';
                ctx.beginPath();
                ctx.arc(projectile.x, projectile.y, drawRadius, 0, Math.PI * 2);
                ctx.fill();

                // Vibrant pulsing white halo ring overlay
                const haloAlpha = 0.5 + pulseVal * 0.35;
                ctx.strokeStyle = `rgba(255, 255, 255, ${Math.max(0.2, Math.min(1, haloAlpha))})`;
                ctx.lineWidth = 2.0;
                ctx.beginPath();
                ctx.arc(projectile.x, projectile.y, drawRadius * 1.35, 0, Math.PI * 2);
                ctx.stroke();
            }
        });



        // Draw safe room / arena upgrade machines
        if (typeof currentRoom !== 'undefined' && currentRoom) {
            const drawMachines = currentRoom.type === 'safe'
                || (currentRoom.machinesAccessible && (currentRoom.allowSafeRoomMachines || currentRoom.isArenaComplex));
            if (drawMachines) {
            const machines = (typeof window.getSafeRoomMachines === 'function') ? window.getSafeRoomMachines(currentRoom) : [];
            machines.forEach(machine => {
                const isNear = typeof this.isAnyLocalActorNear === 'function'
                    ? this.isAnyLocalActorNear(machine.x, machine.y, machine.range)
                    : (() => {
                        const dx = machine.x - (this.player ? this.player.x : 0);
                        const dy = machine.y - (this.player ? this.player.y : 0);
                        return Math.sqrt(dx * dx + dy * dy) < machine.range;
                    })();
                const saveLocked = machine.id === 'runSave' && !!this.safeRoomUsedThisVisit;
                const promptOpts = typeof this.getInteractionPromptOptionsNear === 'function'
                    ? this.getInteractionPromptOptionsNear(machine.x, machine.y, machine.range)
                    : null;

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
                this.strokeNeonRect(ctx, machineX, machineY, machineWidth, machineHeight, accent, isNear ? 8 : 2, isNear ? 2 : 1);

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
                if (isNear && (typeof Engine !== 'undefined' && Engine.Input)) {
                    const promptY = isRunSave ? machine.y + 52 : machine.y + 48;
                    if (saveLocked) {
                        ctx.fillStyle = '#ff8888';
                        ctx.font = '10px Orbitron';
                        ctx.fillText('Locked after use', machine.x, promptY);
                    } else if (Engine.Input.drawInteractionPrompt) {
                        Engine.Input.drawInteractionPrompt(ctx, 'select', machine.x, promptY, promptOpts);
                    } else {
                        ctx.fillStyle = '#00ffcc';
                        ctx.font = '12px Orbitron';
                        ctx.fillText('Press [G] to open', machine.x, promptY);
                    }
                }

                ctx.restore();
            });
            }
        }

        // Arena wave trigger prompt (pad body already drawn above viscera / below player)
        if (typeof this.renderArenaWavePylon === 'function') {
            this.renderArenaWavePylon(ctx, { promptOnly: true });
        }
        if (typeof this.renderArenaGoreCleanPad === 'function') {
            this.renderArenaGoreCleanPad(ctx, { promptOnly: true });
        }

        // Draw pre-boss healer machine (visible only once the boss door is open)
        if (typeof currentRoom !== 'undefined' && currentRoom && currentRoom.doorOpen && currentRoom.preBossHealer) {
            const healer = currentRoom.preBossHealer;
            if (!healer.usedBy) healer.usedBy = new Set();

            // Prefer an unclaimed local-coop seat near the healer for prompt glyphs / "near" state.
            let promptSeat = null;
            let isNear = false;
            let usedByNearest = false;
            const healActors = typeof this.getLocalCoopActors === 'function'
                ? this.getLocalCoopActors()
                : (this.player && this.player.alive
                    ? [{ player: this.player, playerId: this.getLocalPlayerId(), seat: null }]
                    : []);
            let bestDist = healer.range;
            for (const actor of healActors) {
                if (!actor.player || !actor.player.alive) continue;
                const dx = healer.x - actor.player.x;
                const dy = healer.y - actor.player.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist >= healer.range) continue;
                isNear = true;
                const already = healer.usedBy.has(actor.playerId);
                if (!already && dist < bestDist) {
                    bestDist = dist;
                    promptSeat = actor.seat || null;
                    usedByNearest = false;
                } else if (!promptSeat && dist < bestDist) {
                    bestDist = dist;
                    promptSeat = actor.seat || null;
                    usedByNearest = already;
                }
            }
            const localHealerId = typeof this.getLocalPlayerId === 'function' ? this.getLocalPlayerId() : 'local';
            const usedByMe = healer.usedBy.has(localHealerId);
            const promptOpts = promptSeat ? { seat: promptSeat } : null;

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
                if (this.preferSpriteShadows()) {
                    this.drawAdditiveGlowSprite(
                        ctx, healer.x, healer.y,
                        110 + pulse * 20,
                        '#00ff64',
                        0.1 + pulse * 0.08
                    );
                } else {
                    ctx.globalCompositeOperation = 'lighter';
                    const haloGrad = ctx.createRadialGradient(healer.x, healer.y, 0, healer.x, healer.y, 110 + pulse * 20);
                    haloGrad.addColorStop(0, `rgba(0, 255, 100, ${0.06 + pulse * 0.06})`);
                    haloGrad.addColorStop(1, 'rgba(0,0,0,0)');
                    ctx.fillStyle = haloGrad;
                    ctx.fillRect(healer.x - 130, healer.y - 130, 260, 260);
                    ctx.globalCompositeOperation = 'source-over';
                }

                // Panel background
                ctx.fillStyle = isNear
                    ? `rgba(0, 28, 18, ${0.88 + pulse * 0.05})`
                    : 'rgba(0, 20, 14, 0.82)';
                ctx.fillRect(machineX, machineY, machineWidth, machineHeight);

                // Glowing border
                const borderColor = isNear ? `rgba(0,255,100,${0.9 + pulse * 0.1})` : '#00cc55';
                this.strokeNeonRect(
                    ctx, machineX, machineY, machineWidth, machineHeight,
                    borderColor,
                    isNear ? 18 + pulse * 12 : 8 + pulse * 4,
                    isNear ? 2.5 : 1.5
                );

                // Icon - large, bright
                ctx.font = '28px serif';
                ctx.textAlign = 'center';
                this.fillNeonText(
                    ctx,
                    healer.icon || '\u{1F49A}',
                    healer.x,
                    healer.y - 2,
                    `rgba(60,255,140,${0.85 + pulse * 0.15})`,
                    12 + pulse * 8
                );

                // Name label - white with drop-shadow for legibility
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 12px Orbitron, monospace';
                ctx.textAlign = 'center';
                if (this.preferSpriteShadows()) {
                    ctx.fillStyle = 'rgba(0,0,0,0.85)';
                    ctx.fillText(healer.name || 'Pre-Boss Healer', healer.x + 1, healer.y + 23);
                    ctx.fillStyle = '#ffffff';
                    ctx.fillText(healer.name || 'Pre-Boss Healer', healer.x, healer.y + 22);
                } else {
                    ctx.shadowColor = 'rgba(0,0,0,0.95)';
                    ctx.shadowOffsetX = 1; ctx.shadowOffsetY = 1;
                    ctx.shadowBlur = 5;
                    ctx.fillText(healer.name || 'Pre-Boss Healer', healer.x, healer.y + 22);
                    ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0; ctx.shadowBlur = 0;
                }

                // Heal amount tag
                ctx.fillStyle = `rgba(80,255,140,${0.7 + pulse * 0.2})`;
                ctx.font = 'bold 10px Orbitron, monospace';
                ctx.fillText('+25% HP', healer.x, healer.y + 35);

                // Interaction Prompt
                if (isNear && !usedByNearest && (typeof Engine !== 'undefined' && Engine.Input)) {
                    if (Engine.Input.drawInteractionPrompt) {
                        Engine.Input.drawInteractionPrompt(ctx, 'select', healer.x, healer.y + 54, promptOpts);
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
            GameRender.door(ctx, door.x, door.y, door.width, door.height, this.doorPulse);
            if (this.nearExitDoor && (typeof Engine !== 'undefined' && Engine.Input) && Engine.Input.drawInteractionPrompt) {
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
                let readyId = this.getLocalPlayerId();
                let promptOpts = null;
                if (this.localSplitEnabled && typeof this.getLocalCoopActors === 'function') {
                    let best = null;
                    let bestDist = Infinity;
                    for (const actor of this.getLocalCoopActors()) {
                        if (!actor.player || !this.isPlayerNearExitDoor(actor.player)) continue;
                        const dx = actor.player.x - promptX;
                        const dy = actor.player.y - promptY;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        if (dist < bestDist) {
                            bestDist = dist;
                            best = actor;
                        }
                    }
                    if (best) {
                        readyId = best.playerId;
                        if (best.seat) promptOpts = { seat: best.seat };
                    }
                }
                const isReady = typeof this.isPlayerDoorReady === 'function' && this.isPlayerDoorReady(readyId);
                Engine.Input.drawInteractionPrompt(
                    ctx,
                    isReady ? 'cancel ready' : 'ready - enter next room',
                    promptX,
                    promptY,
                    promptOpts
                );
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

        if (profile) {
            const bodiesPhaseTime = performance.now() - bodiesPhaseStart;
            if (this.currentFrameTimings) {
                this.currentFrameTimings.worldBodies += bodiesPhaseTime;
                this.currentFrameTimings.world += bodiesPhaseTime;
            }
            this.recordRenderSubTiming('worldBodies', bodiesPhaseTime);
        }
    },

    /**
     * Compatibility wrapper for PAUSED paths: visibility + glow + bodies.
     * PLAYING uses the stage recipe instead.
     */
    renderGameWorld(ctx) {
        const lists = this.gatherVisibleFrameLists();
        this.visibleFrameLists = lists;
        this.renderWorldGlows(ctx, lists);
        this.renderWorldBodies(ctx, lists);
    },

    /**
     * Arena wave trigger plaza.
     * Ice/cyan + dark shadow — readable over fortress orange / gore without yellow blend.
     * @param {CanvasRenderingContext2D} ctx
     * @param {{promptOnly?: boolean}} [options] promptOnly draws G-prompt only (after player)
     */
    renderArenaWavePylon(ctx, options) {
        if (typeof currentRoom === 'undefined' || !currentRoom || !currentRoom.wavePylon) return;
        const opts = options || {};
        const pylon = currentRoom.wavePylon;
        const active = !!pylon.active;
        const padR = pylon.padRadius || Math.min(190, (pylon.range || 72) * 0.9);
        const isNear = typeof this.isAnyLocalActorNear === 'function'
            ? this.isAnyLocalActorNear(pylon.x, pylon.y, pylon.range)
            : false;

        // Biome-safe accent: cool cyan (avoids fortress gold/orange and swarm yellow gore).
        const accent = active ? (isNear ? '#9BFFF6' : '#5CE6DA') : '#5A6478';
        const fillActive = isNear ? 'rgba(92, 230, 218, 0.22)' : 'rgba(92, 230, 218, 0.12)';
        const ringActive = isNear ? 'rgba(180, 255, 250, 0.92)' : 'rgba(120, 240, 230, 0.55)';

        ctx.save();
        if (!opts.promptOnly) {
            // Drop shadow so the pad lifts off viscera / biome floor paint.
            ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
            ctx.beginPath();
            ctx.ellipse(pylon.x + 4, pylon.y + 10, padR * 1.02, padR * 0.72, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(0, 8, 18, 0.35)';
            ctx.beginPath();
            ctx.arc(pylon.x, pylon.y, padR * 1.04, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = active ? fillActive : 'rgba(40, 48, 64, 0.18)';
            ctx.beginPath();
            ctx.arc(pylon.x, pylon.y, padR, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = active ? ringActive : 'rgba(100, 110, 130, 0.4)';
            ctx.lineWidth = active && isNear ? 4 : 2.5;
            ctx.setLineDash(active ? [] : [12, 10]);
            ctx.beginPath();
            ctx.arc(pylon.x, pylon.y, padR, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);

            // Inner beacon disc + white hairline for contrast on any biome.
            ctx.fillStyle = active
                ? (isNear ? 'rgba(155, 255, 246, 0.42)' : 'rgba(92, 230, 218, 0.26)')
                : 'rgba(55, 60, 78, 0.28)';
            ctx.beginPath();
            ctx.arc(pylon.x, pylon.y, 44, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = active ? '#F4FFFD' : accent;
            ctx.lineWidth = active && isNear ? 3 : 1.75;
            ctx.stroke();

            ctx.fillStyle = active ? '#F4FFFD' : accent;
            ctx.font = 'bold 13px Orbitron';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
            ctx.shadowBlur = 6;
            ctx.fillText(active ? 'WAVE' : 'IDLE', pylon.x, pylon.y + 1);
            ctx.shadowBlur = 0;
        }

        if (opts.promptOnly && active && isNear) {
            // Check if all players are inside the pad range
            const players = typeof this.getAllAlivePlayers === 'function' ? this.getAllAlivePlayers() : [this.player];
            const allInside = players.every(p => {
                const dx = pylon.x - p.x;
                const dy = pylon.y - p.y;
                return Math.sqrt(dx * dx + dy * dy) < pylon.range;
            });
            const isMp = this.multiplayerEnabled || this.localSplitEnabled;

            ctx.save();
            if (isMp && !allInside) {
                // Dimmed state for waiting
                ctx.globalAlpha = 0.5;
                ctx.fillStyle = '#A0B0C0';
                ctx.font = 'bold 15px Orbitron, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
                ctx.shadowBlur = 4;
                ctx.shadowOffsetX = 1;
                ctx.shadowOffsetY = 1;
                if (typeof Engine !== 'undefined' && Engine.Input && Engine.Input.drawInteractionPrompt) {
                    const promptOpts = typeof this.getInteractionPromptOptionsNear === 'function'
                        ? this.getInteractionPromptOptionsNear(pylon.x, pylon.y, pylon.range)
                        : null;
                    Engine.Input.drawInteractionPrompt(ctx, 'waiting for other player', pylon.x, pylon.y + 62, promptOpts);
                } else {
                    ctx.fillText('Waiting for other player...', pylon.x, pylon.y + 62);
                }
            } else {
                ctx.fillStyle = '#F4FFFD';
                ctx.font = 'bold 16px Orbitron, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
                ctx.shadowBlur = 6;
                ctx.shadowOffsetX = 1;
                ctx.shadowOffsetY = 1;
                if (typeof Engine !== 'undefined' && Engine.Input && Engine.Input.drawInteractionPrompt) {
                    const promptOpts = typeof this.getInteractionPromptOptionsNear === 'function'
                        ? this.getInteractionPromptOptionsNear(pylon.x, pylon.y, pylon.range)
                        : null;
                    Engine.Input.drawInteractionPrompt(ctx, 'start next wave', pylon.x, pylon.y + 62, promptOpts);
                } else {
                    ctx.fillText('Press [G] — next wave', pylon.x, pylon.y + 62);
                }
            }
            ctx.restore();
        }
        ctx.restore();
    },

    /**
     * Arena gore-clean pad — amber/orange to contrast the cyan wave pylon.
     * @param {CanvasRenderingContext2D} ctx
     * @param {{promptOnly?: boolean}} [options]
     */
    renderArenaGoreCleanPad(ctx, options) {
        if (typeof currentRoom === 'undefined' || !currentRoom || !currentRoom.goreCleanPad) return;
        const opts = options || {};
        const pad = currentRoom.goreCleanPad;
        const padR = pad.padRadius || 68;
        const isNear = typeof this.isAnyLocalActorNear === 'function'
            ? this.isAnyLocalActorNear(pad.x, pad.y, pad.range)
            : false;

        const accent = isNear ? '#FFD680' : '#C48A20';
        const fillCol = isNear ? 'rgba(255, 190, 60, 0.22)' : 'rgba(180, 130, 30, 0.12)';
        const ringCol = isNear ? 'rgba(255, 220, 100, 0.90)' : 'rgba(200, 150, 40, 0.50)';

        ctx.save();
        if (!opts.promptOnly) {
            // Drop shadow
            ctx.fillStyle = 'rgba(0, 0, 0, 0.50)';
            ctx.beginPath();
            ctx.ellipse(pad.x + 3, pad.y + 8, padR * 1.02, padR * 0.72, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(10, 6, 0, 0.30)';
            ctx.beginPath();
            ctx.arc(pad.x, pad.y, padR * 1.04, 0, Math.PI * 2);
            ctx.fill();

            // Pad fill + ring
            ctx.fillStyle = fillCol;
            ctx.beginPath();
            ctx.arc(pad.x, pad.y, padR, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = ringCol;
            ctx.lineWidth = isNear ? 3 : 2;
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.arc(pad.x, pad.y, padR, 0, Math.PI * 2);
            ctx.stroke();

            // Inner beacon disc
            ctx.fillStyle = isNear ? 'rgba(255, 210, 80, 0.40)' : 'rgba(180, 130, 30, 0.24)';
            ctx.beginPath();
            ctx.arc(pad.x, pad.y, 30, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = isNear ? '#FFF0C0' : accent;
            ctx.lineWidth = isNear ? 2.5 : 1.5;
            ctx.stroke();

            // Label
            ctx.fillStyle = isNear ? '#FFF0C0' : accent;
            ctx.font = 'bold 11px Orbitron, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
            ctx.shadowBlur = 5;
            ctx.fillText('SWEEP', pad.x, pad.y + 1);
            ctx.shadowBlur = 0;
        }

        if (opts.promptOnly && isNear) {
            ctx.fillStyle = '#FFF0C0';
            ctx.font = 'bold 13px Orbitron, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
            ctx.shadowBlur = 6;
            ctx.shadowOffsetX = 1;
            ctx.shadowOffsetY = 1;
            if (typeof Engine !== 'undefined' && Engine.Input && Engine.Input.drawInteractionPrompt) {
                const promptOpts = typeof this.getInteractionPromptOptionsNear === 'function'
                    ? this.getInteractionPromptOptionsNear(pad.x, pad.y, pad.range)
                    : null;
                Engine.Input.drawInteractionPrompt(ctx, 'clear arena viscera', pad.x, pad.y + 48, promptOpts);
            } else {
                ctx.fillText('[G] Clear Viscera', pad.x, pad.y + 48);
            }
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
        }
        ctx.restore();
    },

    /** Style Crash credit shards + B+ heal orbs. */
    renderStylePickups(ctx) {
        if (!ctx) return;
        const shards = this.styleCrashPickups;
        if (Array.isArray(shards)) {
            for (let i = 0; i < shards.length; i++) {
                const p = shards[i];
                if (!p) continue;
                ctx.save();
                ctx.fillStyle = '#ffd76a';
                ctx.strokeStyle = '#fff4c0';
                ctx.lineWidth = 1.5;
                ctx.globalAlpha = Math.min(1, Math.max(0.25, p.life / 3));
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius || 12, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                ctx.restore();
            }
        }
        const orbs = this.styleHealOrbs;
        if (Array.isArray(orbs)) {
            for (let i = 0; i < orbs.length; i++) {
                const o = orbs[i];
                if (!o) continue;
                ctx.save();
                ctx.fillStyle = 'rgba(80,255,140,0.75)';
                ctx.strokeStyle = '#b8ffd0';
                ctx.lineWidth = 2;
                ctx.globalAlpha = Math.min(1, Math.max(0.3, o.life / 4));
                ctx.beginPath();
                ctx.arc(o.x, o.y, o.radius || 16, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                ctx.restore();
            }
        }
    },

    // Toggle pause
    togglePause() {
        if (this.state === 'TITLE') {
            return;
        }

        // Check if multiplayer is enabled
        const inMultiplayer = this.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.lobbyCode;

        if (inMultiplayer) {
            // Multiplayer: Only show/hide pause menu, don't actually pause the game
            this.paused = false;
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
                if (typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.isHost && typeof multiplayerManager.sendHostStatus === 'function') {
                    multiplayerManager.sendHostStatus();
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
            if (typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.isHost && typeof multiplayerManager.sendHostStatus === 'function') {
                multiplayerManager.sendHostStatus();
            }
        } else {
            // Single player: Normal pause behavior
            if (this.state === 'PLAYING') {
                this.state = 'PAUSED';
                this.paused = true;
                this.pausedFromState = 'PLAYING'; // Remember where we paused from
                console.log('[TOGGLE PAUSE] Game paused - pausedFromState set to: PLAYING');
                if (typeof LedgerManager !== 'undefined' && LedgerManager.recordEvent) {
                    LedgerManager.recordEvent('pauseEnter', { now: Date.now() });
                }
                this.playPauseMusic();
            } else if (this.state === 'NEXUS') {
                this.state = 'PAUSED';
                this.paused = true;
                this.pausedFromState = 'NEXUS'; // Remember where we paused from
                console.log('[TOGGLE PAUSE] Nexus paused - pausedFromState set to: NEXUS');
                this.playPauseMusic();
            } else if (this.state === 'PAUSED') {
                // Resume to the state we paused from
                const from = this.pausedFromState || 'PLAYING';
                this.state = from;
                this.paused = false;
                this.pausedFromState = null;
                console.log('[TOGGLE PAUSE] Game resumed - pausedFromState cleared');
                if (from === 'PLAYING' && typeof LedgerManager !== 'undefined' && LedgerManager.recordEvent) {
                    LedgerManager.recordEvent('pauseExit', { now: Date.now() });
                }
                if (typeof audioMenuVisible !== 'undefined') {
                    audioMenuVisible = false;
                }
                this.resumeFromPauseMusic();
            }
        }
    },

    // Cleanup run state (called when returning to nexus, restarting, or game over)
    cleanupRunState() {
        this.cleanupPlayingRenderTargets();

        if (this.player && this.player.itemManager) {
            this.player.itemManager.clearAllItems();
        }

        if (typeof Game !== 'undefined' && Game.groundItems && Array.isArray(Game.groundItems)) {
            Game.groundItems.length = 0;
        }

        if (typeof Game !== 'undefined' && Game.itemPylons && Array.isArray(Game.itemPylons)) {
            Game.itemPylons.length = 0;
        }

        if (typeof BiomeEnemyMods !== 'undefined' && BiomeEnemyMods.clearEchoes) {
            BiomeEnemyMods.clearEchoes();
        }
    },

    // Clear equipped run gear from local (and local-coop) players.
    // Checkpoint exit must NOT call this — resume keeps gear.
    clearRunEquippedGear() {
        const clearOne = (player) => {
            if (player && typeof player.clearEquippedGear === 'function') {
                player.clearEquippedGear();
            }
        };

        // 1. Clear local player
        clearOne(this.player);

        // 2. Clear local split-screen player
        if (this.localSplitEnabled && this.remotePlayerInstances) {
            const p2 = this.remotePlayerInstances.get(this.localSplitPlayerId);
            clearOne(p2);
        }

        // Safely determine host status
        const isHost = this.multiplayerEnabled && 
                       typeof multiplayerManager !== 'undefined' && 
                       multiplayerManager && 
                       multiplayerManager.isHost;

        // 3. Clear remote simulations (Host only, as originally intended)
        if (isHost && this.remotePlayerInstances) {
            this.remotePlayerInstances.forEach((playerInstance, playerId) => {
                if (playerId === this.localSplitPlayerId) return;
                clearOne(playerInstance);
            });
        }
    },

    hideGroundLootUi() {
        if (typeof LootSelection !== 'undefined' && typeof LootSelection.reset === 'function') {
            LootSelection.reset();
        }
        if (typeof GearTooltipUI !== 'undefined' && typeof GearTooltipUI.hide === 'function') {
            GearTooltipUI.hide();
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

    // Return to nexus after death — mode owns timing via RoguelikeRun.returnToNexus
    returnToNexus() {
        if (typeof RoguelikeRun !== 'undefined' && RoguelikeRun.returnToNexus) {
            return RoguelikeRun.returnToNexus(this);
        }
        return this._returnToNexusImpl();
    },

    _returnToNexusImpl() {
        // If an active session is running, end it first so AppHost tears it down
        if (this.activeSessionId
            && typeof AppHost !== 'undefined'
            && typeof AppHost.endSession === 'function') {
            AppHost.endSession();
        }

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

            // Clear ALL player gear BEFORE broadcasting so the very next sendGameState
            // carries null gear for every player, not stale run gear.
            if (typeof this.clearRunEquippedGear === 'function') {
                this.clearRunEquippedGear();
            }

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

        if (typeof LedgerManager !== 'undefined' && LedgerManager.recordEvent && !this.lastRunTimingResult) {
            const success = typeof currentRoom !== 'undefined' && currentRoom
                && currentRoom.type === 'boss' && currentRoom.cleared;
            LedgerManager.recordEvent('runEnded', {
                now: Date.now(),
                roomNumber: this.roomNumber || 0,
                successfulClear: !!success || (this.roomNumber || 0) >= 50
            });
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
        if (typeof GameWorld !== 'undefined' && GameWorld.clearPlayingField) {
            GameWorld.clearPlayingField(this);
        } else if (typeof setCurrentRoom === 'function') {
            setCurrentRoom(null);
        } else if (typeof initializeRoom !== 'undefined') {
            currentRoom = null;
            if (typeof window !== 'undefined') {
                window.currentRoom = null;
            }
        }
        this.runSeed = null;
        this.waveNumber = null;
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

        this.hideGroundLootUi();
        this.clearRunEquippedGear();

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
        if (typeof GameRunRewards !== 'undefined') {
            return GameRunRewards.calculateCurrency(this);
        }
        return 0;
    },

    awardRunCredits(baseAmount, reason = 'combat') {
        if (typeof GameRunRewards !== 'undefined') {
            return GameRunRewards.awardRunCredits(this, baseAmount, reason);
        }
        return 0;
    },

    calculateShardsForPlayer(playerId) {
        if (typeof GameRunRewards !== 'undefined') {
            return GameRunRewards.calculateShardsForPlayer(this, playerId);
        }
        return 0;
    },

    calculateCurrencyForPlayer(playerId) {
        if (typeof GameRunRewards !== 'undefined') {
            return GameRunRewards.calculateCurrencyForPlayer(this, playerId);
        }
        return 0;
    },

    // Start game after class selection — mode owns timing via RoguelikeRun.begin
    startGame() {
        if (typeof RoguelikeRun !== 'undefined' && RoguelikeRun.begin) {
            return RoguelikeRun.begin(this);
        }
        return this._beginRoguelikeRun();
    },

    _beginRoguelikeRun() {
        if (!this.selectedClass) {
            console.error('No class selected');
            return;
        }

        if (typeof GameAudio !== 'undefined' && typeof GameAudio.bindSettings === 'function') {
            GameAudio.bindSettings();
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

        // New runs never inherit previous-run gear (returnToNexus also clears;
        // this is a safety net if startGame is reached another way).
        this.clearRunEquippedGear();
        this.hideGroundLootUi();

        // Reset tracking before the first room is generated and telemetry starts.
        this.enemiesKilled = 0;
        const profile = this.modeProfile || null;
        const skipTutorial = !!(profile && profile.room && profile.room.skipTutorial);
        const startAt = (profile && profile.room && profile.room.startAt != null)
            ? profile.room.startAt
            : null;
        if (skipTutorial || startAt != null) {
            this.roomNumber = Math.max(1, startAt != null ? startAt : 1);
            this.waveNumber = this.roomNumber;
        } else {
            this.roomNumber = (typeof Room0Tutorial !== 'undefined' && Room0Tutorial.shouldEnter && Room0Tutorial.shouldEnter())
                ? 0
                : 1;
        }
        if (!this.runSeed && profile && profile.room && profile.room.forceCombat) {
            this.runSeed = (typeof GameWorld !== 'undefined' && GameWorld.makeRunSeed)
                ? GameWorld.makeRunSeed('arena')
                : (`arena-${Date.now()}`);
        }
        this.doorPulse = 0;
        this.startTime = Date.now();
        if (typeof LedgerManager !== 'undefined' && LedgerManager.recordEvent) {
            this.lastRunTimingResult = null;
            LedgerManager.recordEvent('runStart', { player: this.player });
        }

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

        // Reset room system (always destroy previous Island/Gear room)
        if (typeof GameWorld !== 'undefined' && GameWorld.clearPlayingField) {
            GameWorld.clearPlayingField(this);
        } else if (typeof setCurrentRoom === 'function') {
            setCurrentRoom(null);
        } else if (typeof initializeRoom !== 'undefined') {
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
                mode: this.multiplayerEnabled ? 'multiplayer' : (this.localSplitEnabled ? 'local-coop' : 'singleplayer'),
                gameMode: (this.activeSessionId === 'surge-arena') ? 'surge-arena' : (this.gameMode || 'gear'),
                hostPlayerId: localPlayerId,
                difficulty: this.difficulty || 'normal',
                seed: (typeof currentRoom !== 'undefined' && currentRoom && currentRoom.seed) ? currentRoom.seed : null,
                players: runPlayers,
                metadata: {
                    gameMode: (this.activeSessionId === 'surge-arena') ? 'surge-arena' : (this.gameMode || 'gear'),
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
        // Embedded Islands (Surge Arena / Sandbox): relaunch the session cleanly.
        if (this.activeSessionId
            && typeof AppHost !== 'undefined'
            && typeof AppHost.endSession === 'function'
            && typeof AppHost.launchSession === 'function') {
            const sessionId = this.activeSessionId;
            this.gameOverMusicPlaying = false;
            this.paused = false;
            this.showPauseMenu = false;
            this.deathScreenStartTime = 0;
            this.endTime = 0;
            if (typeof audioMenuVisible !== 'undefined') {
                audioMenuVisible = false;
            }
            if (typeof Telemetry !== 'undefined') {
                this.finalizeTelemetryRun({
                    result: 'abandoned',
                    reason: 'restart'
                });
            }
            AppHost.endSession();
            AppHost.launchSession(sessionId);
            return;
        }

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
        this.lastRunTimingResult = null;
        if (typeof LedgerManager !== 'undefined' && LedgerManager.recordEvent) {
            LedgerManager.recordEvent('runStart', { player: this.player });
        }

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
                mode: this.multiplayerEnabled ? 'multiplayer' : (this.localSplitEnabled ? 'local-coop' : 'singleplayer'),
                gameMode: (this.activeSessionId === 'surge-arena') ? 'surge-arena' : (this.gameMode || 'gear'),
                hostPlayerId: localPlayerId,
                difficulty: this.difficulty || 'normal',
                seed: (typeof currentRoom !== 'undefined' && currentRoom && currentRoom.seed) ? currentRoom.seed : null,
                players: runPlayers,
                metadata: {
                    gameMode: (this.activeSessionId === 'surge-arena') ? 'surge-arena' : (this.gameMode || 'gear'),
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
                if (this.localSplitEnabled) {
                    const secondPlayer = this.remotePlayerInstances.get(this.localSplitPlayerId);
                    if (secondPlayer) {
                        const secondSpawn = this.getRoomSpawnPoint(currentRoom, 1);
                        secondPlayer.x = secondSpawn.x;
                        secondPlayer.y = secondSpawn.y;
                    }
                }
            }

            if (typeof Room0Tutorial !== 'undefined' && Room0Tutorial.beginIfNeeded) {
                Room0Tutorial.beginIfNeeded(currentRoom);
            }
        }

        this.updateMusicForCurrentRoom();

        console.log(`Room ${this.roomNumber} initialized with ${this.enemies.length} enemies`);
    },

    releasePooledProjectile(projectile) {
        if (typeof GameCombatProjectiles !== 'undefined') {
            return GameCombatProjectiles.releasePooledProjectile.call(this, projectile);
        }
    },

    acquireProjectile(spec) {
        if (typeof GameCombatProjectiles !== 'undefined') {
            return GameCombatProjectiles.acquireProjectile.call(this, spec);
        }
        const projectile = Object.assign({}, spec || {});
        projectile._fromProjectilePool = false;
        return projectile;
    },

    updateProjectiles(deltaTime) {
        if (typeof GameCombatProjectiles !== 'undefined') {
            return GameCombatProjectiles.updateProjectiles.call(this, deltaTime);
        }
    },

    checkProjectilesVsPlayer() {
        if (typeof GameCombatProjectiles !== 'undefined') {
            return GameCombatProjectiles.checkProjectilesVsPlayer.call(this);
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
        const camera = this._activeRenderCamera || this.camera;
        if (!remote || !camera) return true;
        const dist = Math.hypot(remote.x - camera.x, remote.y - camera.y);
        return dist < (threshold || 400);
    },

    isRemotePlayerVisible(remote, margin) {
        const camera = this._activeRenderCamera || this.camera;
        const viewport = this._activeRenderViewport;
        if (!remote || !camera || !this.config) return true;
        const m = margin != null ? margin : remote.size * 4;
        const zoom = this.getViewZoom();
        const halfWidth = ((viewport ? viewport.w : this.config.width) / 2) / zoom + m;
        const halfHeight = ((viewport ? viewport.h : this.config.height) / 2) / zoom + m;
        return (
            remote.x >= camera.x - halfWidth &&
            remote.x <= camera.x + halfWidth &&
            remote.y >= camera.y - halfHeight &&
            remote.y <= camera.y + halfHeight
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

        // Local co-op: seats are already split across viewports — name tags live on HUD bars only.
        if (this.localSplitEnabled) return;

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
            } else if (this.isHost() || this.localSplitEnabled) {
                if (this.remotePlayerInstances && this.remotePlayerInstances.size > 0) {
                    this.remotePlayerInstances.forEach((playerInstance, playerId) => {
                        this.renderRemotePlayerInstance(ctx, playerInstance, playerId);
                    });
                }
            } else if (!this.multiplayerEnabled) {
            if (!this.remotePlayers || this.remotePlayers.length === 0) return;

            // Create cached whirlwind gradient if needed
            if (!this.whirlwindGradient) {
                const tempCanvas = Engine.Graphics.createCanvas(120, 120);
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
                const zoom = this.getViewZoom();
                const halfWidth = (this.config.width / 2) / zoom + margin;
                const halfHeight = (this.config.height / 2) / zoom + margin;

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
                    Engine.Renderer.polygon(ctx, 0, 0, size, 5, 0, classDef.color);
                } else if (classDef.shape === 'hexagon') {
                    Engine.Renderer.polygon(ctx, 0, 0, size, 6, 0, classDef.color);
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
                    Engine.Renderer.polygon(ctx, 0, 0, size, 6, 0, classDef.color);
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

if (typeof window !== 'undefined') {
    window.Game = Game;
}

// Boot / Core / scene tick ownership lives in the roguelike mode package
// (started by the app host). Game remains the Shape Slayer world piece.

// Debug console commands
window.toggleEnemyStealth = function () {
    Game.enemyStealthMode = !Game.enemyStealthMode;
    console.log(`Enemy Stealth Mode: ${Game.enemyStealthMode ? 'ON (enemies hidden)' : 'OFF (enemies visible)'}`);
    return `Enemy stealth mode ${Game.enemyStealthMode ? 'enabled' : 'disabled'}`;
};

console.log('%cDebug Commands Available:', 'color: #00ff00; font-weight: bold;');
console.log('%c  toggleEnemyStealth() - Toggle enemy glow and vignette lights', 'color: #00aaff;');

