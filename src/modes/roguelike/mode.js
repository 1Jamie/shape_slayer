/**
 * Roguelike mode — Shape Slayer Gear Mode room-clear loop.
 * Consumes game packages; owns scene/state machine wiring and engine Core boot.
 */
(function (root) {
    'use strict';

    const ROGUELIKE_PACKAGES = Object.freeze([
        'audio',
        'content',
        'telegraph',
        'entities',
        'combat',
        'rooms',
        'presentation',
        'net',
        'world'
    ]);

    function buildModeInstance(world) {
        const mode = {
            id: 'roguelike',
            world,
            _started: false,
            _core: null,
            _session: null,
            _preSessionState: null,

            start() {
                if (this._started) return;
                this._started = true;
                this._bootAndStartCore();
            },

            stop() {
                this.endSession();
                if (this._core && typeof this._core.stop === 'function') {
                    this._core.stop();
                }
                this._started = false;
            },

            /**
             * Run another mode as a full-viewport session inside this engine Core.
             * Takeover (input flush, spatial-hash park, camera reset, UI chrome) is
             * owned by the session's start() via GameModeTakeover.begin.
             */
            launchSession(session) {
                if (!session) return null;
                this.endSession();
                this._preSessionState = (this.world && this.world.state) || 'NEXUS';
                this._session = session;
                if (typeof session.start === 'function') {
                    session.start({
                        hostWorld: this.world,
                        runtime: (typeof Engine !== 'undefined' && Engine.Boot)
                            ? Engine.Boot.runtime
                            : null
                    });
                }
                return session;
            },

            endSession() {
                if (!this._session) return;
                const session = this._session;
                this._session = null;
                if (typeof session.stop === 'function') {
                    try { session.stop(); } catch (err) {
                        console.warn('[Modes.roguelike] session.stop failed:', err);
                    }
                }
                // session.stop should call GameModeTakeover.end; ensure shell state
                if (this.world && this.world.state === 'SESSION') {
                    if (typeof GameModeTakeover !== 'undefined' && GameModeTakeover.end) {
                        GameModeTakeover.end({ world: this.world });
                    } else {
                        this.world.state = this._preSessionState || 'NEXUS';
                        this.world.activeSessionId = null;
                    }
                }
                this._preSessionState = null;
            },

            update(dt) {
                // Cache session — update() may end it (Return to Nexus → AppHost.endSession).
                const session = this._session;
                if (session) {
                    if (typeof session.update === 'function') {
                        session.update(dt);
                    }
                    if (this._session !== session) return;
                    if (session.usesPlayingPipeline) {
                        const game = this.world;
                        if (game && game.state === 'PLAYING' && typeof game.update === 'function') {
                            game.update(dt);
                        } else if (game && game.state === 'ENTERING_ROOM' && typeof game.updateRoomEnterTransition === 'function') {
                            game.updateRoomEnterTransition();
                        }
                        if (typeof updateVoxelParticles === 'function') {
                            updateVoxelParticles(dt);
                        }
                    }
                    return;
                }

                const game = this.world;
                if (!game) return;
                if (typeof game.updateLocalSplitJoin === 'function') {
                    game.updateLocalSplitJoin();
                }
                if (game.state === 'PLAYING') {
                    game.update(dt);
                } else if (game.state === 'ENTERING_ROOM') {
                    game.updateRoomEnterTransition();
                } else if (game.state === 'TITLE') {
                    if (typeof TitleAttract !== 'undefined' && TitleAttract.update) {
                        TitleAttract.update(dt);
                    }
                    game.updateTitleExitTransition(dt);
                } else if (game.state === 'NEXUS') {
                    if (typeof updateNexus !== 'undefined') {
                        updateNexus(game.ctx, dt);
                    }
                    game.tickNexusPrewarm();
                    game.updateTitleExitTransition(dt);
                }
                if (typeof updateVoxelParticles === 'function') {
                    updateVoxelParticles(dt);
                }
            },

            render(ctx, alpha) {
                if (this._session && !this._session.usesPlayingPipeline) {
                    if (typeof this._session.render === 'function') {
                        this._session.render(ctx, alpha);
                    }
                    return;
                }

                const game = this.world;
                if (!game) return;
                game._renderAlpha = Number.isFinite(alpha) ? alpha : 0;
                game.currentFrameTimings = {
                    static: 0,
                    world: 0,
                    worldGlow: 0,
                    worldBodies: 0,
                    vignette: 0,
                    postFx: 0,
                    ui: 0
                };
                if (typeof Engine !== 'undefined' && Engine.Profiler && typeof Engine.Profiler.beginFrame === 'function') {
                    Engine.Profiler.beginFrame();
                    if (Engine.Profiler.markPhase) Engine.Profiler.markPhase('render');
                }
                game.render();
                game.renderLocalSplitJoinPrompt();
            },

            onQualityChange(tier, frameBudget) {
                const game = this.world;
                if (!game) return;
                const boost = frameBudget && frameBudget.fxBoost != null ? frameBudget.fxBoost : 0;
                game.renderQuality = game.getRenderQualityForTier(tier, boost);
                game.debugFrameBudget = frameBudget;
                if (typeof Engine !== 'undefined' && Engine.FX && Engine.FX.ShardPool
                    && typeof Engine.FX.ShardPool.setSoftCap === 'function'
                    && game.renderQuality && game.renderQuality.shardParticleCap != null) {
                    Engine.FX.ShardPool.setSoftCap(game.renderQuality.shardParticleCap);
                }
            },

            onHitPauseTick(dt) {
                const game = this.world;
                if (typeof updateVoxelParticles === 'function') {
                    updateVoxelParticles(dt);
                }
                if (game && typeof game.updateScreenShake === 'function') {
                    game.updateScreenShake(dt);
                }
                if (typeof updateDamageNumbers === 'function') {
                    updateDamageNumbers(dt);
                }
            },

            onFrameEnd(metrics) {
                const game = this.world;
                if (!game) return;
                const {
                    realDeltaTime,
                    processTime,
                    updateTime,
                    renderTime,
                    updatesRun,
                    accumulatorTruncated
                } = metrics || {};

                if (typeof Engine !== 'undefined' && Engine.Profiler && typeof Engine.Profiler.endFrame === 'function') {
                    Engine.Profiler.endFrame();
                }
                game.frameRenderTimings = Object.assign({}, game.currentFrameTimings || {}, {
                    update: updateTime,
                    render: renderTime,
                    catchupUpdates: updatesRun,
                    accumulatorMs: (root.engine && root.engine.accumulator != null)
                        ? root.engine.accumulator * 1000
                        : 0,
                    accumulatorTruncated: accumulatorTruncated,
                    stageTimings: game._lastStageTimings || null,
                    snapshot: typeof game.buildDebugMetricsSnapshot === 'function'
                        ? game.buildDebugMetricsSnapshot()
                        : null
                });

                if (typeof Engine !== 'undefined' && Engine.Debug) {
                    Engine.Debug.update(realDeltaTime, processTime, game.frameRenderTimings);
                } else if (typeof DebugPanel !== 'undefined') {
                    DebugPanel.update(realDeltaTime, processTime, game.frameRenderTimings);
                }

                if (typeof RunProfiler !== 'undefined' && RunProfiler.isActive()) {
                    RunProfiler.recordFrame(realDeltaTime, processTime, game.frameRenderTimings, {
                        state: game.state,
                        roomNumber: game.roomNumber,
                        catchupUpdates: updatesRun,
                        accumulatorTruncated: accumulatorTruncated
                    });
                }
            },

            setup() {
                const game = this.world;
                game.init();
                try {
                    if (typeof game.ensurePlayingRenderPipeline === 'function') {
                        game.ensurePlayingRenderPipeline();
                    }
                } catch (err) {
                    console.warn('[Modes.roguelike] Early playing pipeline register failed:', err);
                }
                if (typeof Engine !== 'undefined' && Engine.Debug && typeof Engine.Debug.refresh === 'function') {
                    Engine.Debug.refresh();
                }
            },

            _bootAndStartCore() {
                const game = this.world;
                const self = this;

                const startCore = () => {
                    if (typeof Engine !== 'undefined' && Engine.Input && typeof Engine.Input.onDeviceChange === 'function') {
                        Engine.Input.onDeviceChange(() => {
                            if (game.canvas && Engine.Input.isMobileUiMode && Engine.Input.isMobileUiMode()) {
                                if (Engine.Input.initTouchControls) {
                                    Engine.Input.initTouchControls(game.canvas);
                                }
                            }
                        });
                    }

                    self._core = new Engine.Core({
                        onInit: () => self.setup(),
                        onUpdate: (dt) => {
                            if (typeof Engine !== 'undefined' && Engine.Debug && Engine.Debug.frozen) return;
                            if (typeof Engine !== 'undefined' && Engine.Profiler && typeof Engine.Profiler.markPhase === 'function') {
                                Engine.Profiler.markPhase('update');
                            }
                            self.update(dt);
                        },
                        onRender: (ctx, alpha) => self.render(ctx, alpha),
                        preferBackgroundTimeout: () => !!(
                            game.multiplayerEnabled &&
                            typeof multiplayerManager !== 'undefined' &&
                            multiplayerManager &&
                            multiplayerManager.lobbyCode
                        ),
                        onQualityChange: (tier, frameBudget) => self.onQualityChange(tier, frameBudget),
                        onHitPauseTick: (dt) => self.onHitPauseTick(dt),
                        onFrameEnd: (metrics) => self.onFrameEnd(metrics),
                        onVisibilityChange: (isHidden) => game.handleVisibilityChange(isHidden)
                    });

                    root.engine = self._core;
                    root.Game = game;
                    self._core.start();
                };

                const bootOptions = {
                    canvasId: 'gameCanvas',
                    logicalW: game.config.width,
                    logicalH: game.config.height || 720
                };

                const bootPromise = (typeof Engine !== 'undefined' && Engine.Boot && typeof Engine.Boot.start === 'function')
                    ? Engine.Boot.start(bootOptions)
                    : Promise.resolve(null);

                Promise.resolve(bootPromise).then((runtime) => {
                    if (runtime && runtime.ok === false) {
                        console.error('Engine boot failed; roguelike start blocked.', runtime);
                        return;
                    }
                    startCore();
                    if (typeof Engine !== 'undefined' && Engine.Boot && typeof Engine.Boot.handoff === 'function') {
                        Engine.Boot.handoff();
                    }
                    if (typeof Engine !== 'undefined' && Engine.Debug && typeof Engine.Debug.refresh === 'function') {
                        Engine.Debug.refresh();
                    }
                }).catch((error) => {
                    console.error('Engine boot failed; roguelike start blocked.', error);
                });
            }
        };

        return mode;
    }

    root.Modes = root.Modes || {};
    root.Modes.roguelike = {
        id: 'roguelike',
        packages: ROGUELIKE_PACKAGES,
        scripts: Object.freeze([
            'src/modes/roguelike/mode.js'
        ]),
        Rules: root.RoguelikeRules || (root.Modes.roguelike && root.Modes.roguelike.Rules) || null,
        Run: root.RoguelikeRun || (root.Modes.roguelike && root.Modes.roguelike.Run) || null,
        create(runtime, deps) {
            const world = (deps && deps.world)
                || (typeof Game !== 'undefined' ? Game : null);
            if (!world) {
                throw new Error('Modes.roguelike.create requires Game world piece');
            }
            if (typeof GamePackages !== 'undefined' && GamePackages.attach) {
                GamePackages.attach(world);
            }
            world.gameMode = world.gameMode || 'gear';
            world.modeId = 'roguelike';
            world.selectedModeId = world.selectedModeId || 'roguelike';
            return buildModeInstance(world);
        }
    };

    if (typeof GameModeCatalog !== 'undefined' && GameModeCatalog.register) {
        GameModeCatalog.register({
            id: 'roguelike',
            title: 'Roguelike',
            shortLabel: 'GEAR',
            portalLabel: 'GEAR MODE',
            nexusSelectable: true,
            multiplayerOk: true,
            requiresClass: true,
            supportsResume: true,
            contentGameMode: 'gear',
            packages: ROGUELIKE_PACKAGES,
            theme: {
                glow: 'rgba(255, 150, 100, ',
                core: 'rgba(255, 180, 120, 0.8)',
                border: '#ff8844',
                light: '#ff8844'
            },
            enterFromPortal(ctx) {
                if (typeof Game === 'undefined' || !Game) return;
                Game.gameMode = 'gear';
                Game.selectedModeId = 'roguelike';
                if (ctx && ctx.nexusRoom) {
                    ctx.nexusRoom.portalMode = 'roguelike';
                }

                const hasResume = !!(ctx && ctx.hasResumeCheckpoint);
                console.log(hasResume
                    ? '[Nexus] Resuming run from checkpoint'
                    : '[Nexus] Entering Roguelike (Gear Mode) portal');

                const inLobby = typeof multiplayerManager !== 'undefined'
                    && multiplayerManager
                    && multiplayerManager.lobbyCode;
                if (inLobby) {
                    if (multiplayerManager.isHost) {
                        multiplayerManager.startGame();
                        Game.startGame();
                    }
                } else if (typeof Game.tryResumeOrStartFromPortal === 'function') {
                    Game.tryResumeOrStartFromPortal();
                } else {
                    Game.startGame();
                }
            }
        });
    }
})(typeof globalThis !== 'undefined' ? globalThis : window);
