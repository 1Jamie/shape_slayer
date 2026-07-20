// Game render pipeline — Shape Slayer PLAYING recipe assembled on Engine.Render.Pipeline.
// Engine owns the runner/targets; this file owns stage order and draw bodies.
//
// Stage contract (enforced by convention, not the runner):
// each draw() must leave ctx transform / composite / alpha clean for the next stage.
// Camera-bound stages use enterWorldContext / leaveWorldContext (manual DPR reset,
// not runner save/restore).

(function(root) {
    function worldTargetName(frame) {
        return frame.bag && frame.bag.useChromaticPass ? 'world' : 'main';
    }

    function resetDprBaseline(ctx, dpr) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        if (ctx.globalAlpha !== 1) ctx.globalAlpha = 1;
        if (ctx.globalCompositeOperation !== 'source-over') ctx.globalCompositeOperation = 'source-over';
        if ('filter' in ctx && ctx.filter !== 'none') ctx.filter = 'none';
        if ('shadowBlur' in ctx && ctx.shadowBlur !== 0) {
            ctx.shadowBlur = 0;
            ctx.shadowColor = 'rgba(0,0,0,0)';
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
        }
    }

    /**
     * Enter world space: DPR identity + common state reset, then camera apply.
     * Stages must call leaveWorldContext in a finally block.
     */
    function enterWorldContext(frame, ctx) {
        const dpr = frame.dpr || 1;
        resetDprBaseline(ctx, dpr);
        const camera = frame.camera || {};
        Engine.Render.applyCamera(ctx, camera);
    }

    /** Leave world space: restore DPR baseline and common Canvas2D state. */
    function leaveWorldContext(frame, ctx) {
        resetDprBaseline(ctx, frame.dpr || 1);
    }

    function withWorldContext(frame, ctx, drawFn) {
        enterWorldContext(frame, ctx);
        try {
            drawFn();
        } finally {
            leaveWorldContext(frame, ctx);
        }
    }

    function timeCoarse(game, key, fn) {
        if (!game.currentFrameTimings) {
            fn();
            return;
        }
        if (typeof game.shouldCollectDebugMetrics === 'function' && !game.shouldCollectDebugMetrics()) {
            fn();
            return;
        }
        const t0 = performance.now();
        fn();
        game.currentFrameTimings[key] += performance.now() - t0;
    }

    /**
     * PLAYING default recipe: world stages then post/overlay stages.
     * World stages share worldTargetName (main, or offscreen world during chromatic).
     */
    function createPlayingRecipe(game) {
        return [
            {
                id: 'worldClear',
                target: worldTargetName,
                draw(frame, ctx) {
                    // Screen-space clear; no camera. Prefer active viewport size when split.
                    resetDprBaseline(ctx, frame.dpr || 1);
                    game.renderPlayingWorldClear(ctx, frame.viewport);
                }
            },
            {
                id: 'worldStatic',
                target: worldTargetName,
                draw(frame, ctx) {
                    withWorldContext(frame, ctx, () => {
                        timeCoarse(game, 'static', () => game.renderPlayingWorldStatic(ctx));
                    });
                }
            },
            {
                id: 'worldVisibility',
                target: worldTargetName,
                draw(frame, ctx) {
                    // No drawing / no ctx mutation — publish cull lists for glow, bodies, vignette.
                    const lists = game.gatherVisibleFrameLists(frame.camera, frame.viewport);
                    frame.bag.visibleLists = lists;
                    game.visibleFrameLists = lists;
                    if (typeof Engine !== 'undefined' && Engine.Debug && typeof Engine.Debug.trace === 'function') {
                        Engine.Debug.trace('visibleCounts', {
                            enemies: lists.enemies ? lists.enemies.length : 0,
                            projectiles: lists.projectiles ? lists.projectiles.length : 0,
                            groundLoot: lists.groundLoot ? lists.groundLoot.length : 0,
                            groundItems: lists.groundItems ? lists.groundItems.length : 0
                        });
                    }
                }
            },
            {
                id: 'worldGlow',
                target: worldTargetName,
                draw(frame, ctx) {
                    // Skip secondary ambient glows when quality governor signals LOW (tier 2)
                    if (frame.quality === 2 || (frame.bag && frame.bag.quality === 2)) return;
                    withWorldContext(frame, ctx, () => {
                        const lists = frame.bag.visibleLists || game.visibleFrameLists;
                        game.renderWorldGlows(ctx, lists);
                    });
                }
            },
            {
                id: 'worldBodies',
                target: worldTargetName,
                draw(frame, ctx) {
                    withWorldContext(frame, ctx, () => {
                        const lists = frame.bag.visibleLists || game.visibleFrameLists;
                        game.renderWorldBodies(ctx, lists);
                    });
                }
            },
            {
                id: 'worldVoxelDecay',
                target: worldTargetName,
                draw(frame, ctx) {
                    withWorldContext(frame, ctx, () => {
                        if (typeof renderVoxelActiveParticles === 'function') {
                            renderVoxelActiveParticles(ctx);
                        }
                    });
                }
            },
            {
                id: 'worldParticles',
                target: worldTargetName,
                draw(frame, ctx) {
                    withWorldContext(frame, ctx, () => {
                        if (game.particleSystem && typeof game.particleSystem.render === 'function') {
                            game.particleSystem.render(ctx);
                        }
                    });
                }
            },
            {
                id: 'worldTutorial',
                target: worldTargetName,
                enabled() {
                    return typeof Room0Tutorial !== 'undefined' && !!Room0Tutorial.renderWorld;
                },
                draw(frame, ctx) {
                    withWorldContext(frame, ctx, () => {
                        timeCoarse(game, 'world', () => game.renderPlayingWorldTutorial(ctx));
                    });
                }
            },
            {
                id: 'damagePostFx',
                target: 'main',
                enabled(frame) {
                    return !!(frame.bag && frame.bag.useChromaticPass);
                },
                draw(frame, ctx) {
                    const world = frame.targets.get('world');
                    if (world) {
                        game.offscreenCanvas = world.canvas;
                        game.offscreenCtx = world.ctx;
                    }
                    timeCoarse(game, 'postFx', () => {
                        game.applyChromaticAberrationFromOffscreen(frame.bag.trauma, frame.viewport);
                    });
                }
            },
            {
                id: 'vignetteLighting',
                target: 'main',
                enabled() {
                    return typeof currentRoom === 'undefined' || !currentRoom || currentRoom.type !== 'safe';
                },
                draw(frame, ctx) {
                    timeCoarse(game, 'vignette', () => game.renderVignette(ctx, frame.viewport, frame.camera));
                }
            },
            {
                id: 'punchThroughFx',
                target: 'main',
                enabled(frame) {
                    const viewPlayer = (frame.bag && frame.bag.viewPlayer) || game.player;
                    return typeof currentRoom !== 'undefined'
                        && currentRoom
                        && currentRoom.doorOpen
                        && currentRoom.preBossHealer
                        && !!viewPlayer;
                },
                draw(frame, ctx) {
                    timeCoarse(game, 'ui', () => {
                        game.renderPreBossHealerPunchThrough(ctx, frame.bag && frame.bag.viewPlayer, frame.viewport, frame.camera);
                    });
                }
            },
            {
                id: 'screenIndicators',
                target: 'main',
                draw(frame, ctx) {
                    timeCoarse(game, 'ui', () => {
                        const viewPlayer = (frame.bag && frame.bag.viewPlayer) || game.player;
                        const viewport = frame.viewport;
                        if (viewport) {
                            ctx.save();
                            ctx.translate(viewport.x, viewport.y);
                        }
                        try {
                            if (typeof renderEnemyDirectionArrows === 'function') {
                                renderEnemyDirectionArrows(ctx, viewPlayer);
                            }
                            if (typeof renderDoorDirectionArrow === 'function') {
                                renderDoorDirectionArrow(ctx, viewPlayer);
                            }
                            if (typeof renderExitChevron === 'function') {
                                renderExitChevron(ctx);
                            }
                        } finally {
                            if (viewport) ctx.restore();
                        }
                    });
                }
            },
            {
                id: 'inputOverlay',
                target: 'main',
                enabled(frame) {
                    // Touch/gamepad chrome is global; only draw once on the primary seat.
                    return !(frame.viewport && frame.bag && frame.bag.viewPlayer
                        && game.player && frame.bag.viewPlayer !== game.player);
                },
                draw(frame, ctx) {
                    timeCoarse(game, 'ui', () => {
                        if (Engine.Input && typeof Engine.Input.render === 'function') {
                            Engine.Input.render(ctx);
                        }
                    });
                }
            },
            {
                id: 'tutorialOverlay',
                target: 'main',
                enabled(frame) {
                    // Room0 coach is P1-facing; keep it on the primary seat only.
                    return typeof Room0Tutorial !== 'undefined'
                        && !(frame.viewport && frame.bag && frame.bag.viewPlayer
                            && game.player && frame.bag.viewPlayer !== game.player);
                },
                draw(frame, ctx) {
                    timeCoarse(game, 'ui', () => {
                        withWorldContext(frame, ctx, () => {
                            if (Room0Tutorial.renderSpotlight) {
                                Room0Tutorial.renderSpotlight(ctx);
                            }
                            if (Room0Tutorial.isExitCoachActive
                                && Room0Tutorial.isExitCoachActive()
                                && game.player
                                && game.player.alive
                                && typeof game.player.render === 'function') {
                                game.player.render(ctx);
                            }
                            if (Room0Tutorial.renderCoachCard) {
                                Room0Tutorial.renderCoachCard(ctx);
                            }
                        });
                    });
                }
            },
            {
                id: 'interactionOverlay',
                target: 'main',
                enabled(frame) {
                    return !(frame.viewport && frame.bag && frame.bag.viewPlayer
                        && game.player && frame.bag.viewPlayer !== game.player);
                },
                draw(frame, ctx) {
                    timeCoarse(game, 'ui', () => {
                        if (typeof renderInteractionButton === 'function') {
                            renderInteractionButton(ctx);
                        }
                    });
                }
            }
        ];
    }

    function createPlayingPipeline(game) {
        if (!Engine.Render || typeof Engine.Render.createPipeline !== 'function') {
            throw new Error('Engine.Render.createPipeline is required.');
        }
        return Engine.Render.createPipeline(createPlayingRecipe(game));
    }

    /**
     * Build a frame host for the PLAYING pipe and ensure the world target when
     * chromatic trauma needs an offscreen buffer.
     */
    function beginPlayingFrame(game, options = {}) {
        const viewport = options.viewport || null;
        const logicalW = viewport ? viewport.w : game.config.width;
        const logicalH = viewport ? viewport.h : game.config.height;
        const dpr = game.dpr || 1;
        const bag = options.bag || {};
        const timings = options.timings || game.currentFrameTimings || Object.create(null);

        const targets = options.targets || new Engine.Render.Targets();
        targets.bindMain(game.canvas, game.ctx, {
            dpr,
            logicalW: game.config.width,
            logicalH: game.config.height
        });

        if (bag.useChromaticPass) {
            const world = targets.ensure('world', {
                pixelW: logicalW * dpr,
                pixelH: logicalH * dpr,
                logicalW,
                logicalH,
                dpr,
                clear: true
            });
            game.offscreenCanvas = world.canvas;
            game.offscreenCtx = world.ctx;
        }
        // Keep a previously ensured world buffer across frames. Clear-on-ensure
        // prevents ghosting when reused; release via cleanupPlayingTargets().

        game._playingTargetFrame = Engine.Render.createFrame({
            targetFrame: options.targetFrame || game._playingTargetFrame || null,
            canvas: game.canvas,
            ctx: game.ctx,
            logicalW,
            logicalH,
            dpr,
            alpha: options.alpha,
            quality: game.renderQuality || null,
            viewport,
            camera: {
                x: (options.camera || game.camera).x,
                y: (options.camera || game.camera).y,
                zoom: typeof game.getViewZoom === 'function' ? game.getViewZoom() : 1,
                centerX: bag.useChromaticPass
                    ? logicalW / 2
                    : (viewport ? viewport.x + viewport.w / 2 : logicalW / 2),
                centerY: bag.useChromaticPass
                    ? logicalH / 2
                    : (viewport ? viewport.y + viewport.h / 2 : logicalH / 2),
                offsetX: game.screenShakeOffset ? game.screenShakeOffset.x : 0,
                offsetY: game.screenShakeOffset ? game.screenShakeOffset.y : 0
            },
            targets,
            timings,
            stageTimings: options.stageTimings || Object.create(null),
            bag,
            debugPipelineId: 'playing',
            profileStages: !!(typeof Engine !== 'undefined' && Engine.Debug
                && ((typeof Engine.Debug.wantsProfile === 'function' && Engine.Debug.wantsProfile('playing'))
                    || (typeof Engine.Debug.wantsSnapshot === 'function' && Engine.Debug.wantsSnapshot('playing'))))
        });
        return game._playingTargetFrame;
    }

    /** Release pooled offscreen targets (keeps main). Call on teardown/resize. */
    function cleanupPlayingTargets(game) {
        if (game && game._playingRenderTargets && typeof game._playingRenderTargets.releaseAll === 'function') {
            game._playingRenderTargets.releaseAll();
        }
        if (game) {
            game.offscreenCanvas = null;
            game.offscreenCtx = null;
        }
    }

    // --- TITLE STATE PIPELINE ---

    function createTitleRecipe(game) {
        return [
            {
                id: 'titleAttract',
                target: 'main',
                draw(frame, ctx) {
                    resetDprBaseline(ctx, frame.dpr || 1);
                    if (typeof TitleAttract !== 'undefined' && TitleAttract.render) {
                        if (TitleAttract.resize) {
                            TitleAttract.resize(frame.logicalW, frame.logicalH);
                        }
                        TitleAttract.render(ctx);
                    } else if (Engine.Renderer && typeof Engine.Renderer.clear === 'function') {
                        Engine.Renderer.clear(ctx, frame.logicalW, frame.logicalH, '#0a0e1a');
                    } else {
                        ctx.fillStyle = '#0a0e1a';
                        ctx.fillRect(0, 0, frame.logicalW, frame.logicalH);
                    }
                }
            },
            {
                id: 'titleOverlay',
                target: 'main',
                draw(frame, ctx) {
                    timeCoarse(game, 'ui', () => {
                        if (typeof game.renderTitleExitOverlay === 'function') {
                            game.renderTitleExitOverlay(ctx);
                        }
                    });
                }
            },
            {
                id: 'inputOverlay',
                target: 'main',
                draw(frame, ctx) {
                    timeCoarse(game, 'ui', () => {
                        if (Engine.Input && typeof Engine.Input.render === 'function') {
                            Engine.Input.render(ctx);
                        }
                    });
                }
            }
        ];
    }

    function createTitlePipeline(game) {
        if (!Engine.Render || typeof Engine.Render.createPipeline !== 'function') {
            throw new Error('Engine.Render.createPipeline is required.');
        }
        return Engine.Render.createPipeline(createTitleRecipe(game));
    }

    function beginTitleFrame(game, options = {}) {
        const logicalW = game.config ? game.config.width : 1280;
        const logicalH = (game.config && game.config.height) ? game.config.height : 720;
        const dpr = game.dpr || 1;
        const targets = options.targets || (game._titleRenderTargets || (game._titleRenderTargets = new Engine.Render.Targets()));
        targets.bindMain(game.canvas, game.ctx, { dpr, logicalW, logicalH });

        game._titleTargetFrame = Engine.Render.createFrame({
            targetFrame: options.targetFrame || game._titleTargetFrame || null,
            canvas: game.canvas,
            ctx: game.ctx,
            logicalW,
            logicalH,
            dpr,
            alpha: options.alpha,
            quality: game.renderQuality || null,
            targets,
            timings: options.timings || game.currentFrameTimings || Object.create(null),
            bag: options.bag || Object.create(null),
            debugPipelineId: 'title',
            profileStages: !!(typeof Engine !== 'undefined' && Engine.Debug
                && ((typeof Engine.Debug.wantsProfile === 'function' && Engine.Debug.wantsProfile('title'))
                    || (typeof Engine.Debug.wantsSnapshot === 'function' && Engine.Debug.wantsSnapshot('title'))))
        });
        return game._titleTargetFrame;
    }

    // --- NEXUS STATE PIPELINE ---

    function createNexusRecipe(game) {
        return [
            {
                id: 'nexusWorld',
                target: 'main',
                draw(frame, ctx) {
                    resetDprBaseline(ctx, frame.dpr || 1);
                    if (typeof renderNexus !== 'undefined') {
                        renderNexus(ctx);
                    }
                }
            },
            {
                id: 'interactionOverlay',
                target: 'main',
                draw(frame, ctx) {
                    timeCoarse(game, 'ui', () => {
                        if (typeof renderInteractionButton === 'function') {
                            renderInteractionButton(ctx);
                        }
                    });
                }
            },
            {
                id: 'nexusOverlay',
                target: 'main',
                draw(frame, ctx) {
                    timeCoarse(game, 'ui', () => {
                        if (typeof game.renderTitleExitOverlay === 'function') {
                            game.renderTitleExitOverlay(ctx);
                        }
                        const inMultiplayer = game.multiplayerEnabled
                            && typeof multiplayerManager !== 'undefined'
                            && multiplayerManager
                            && multiplayerManager.lobbyCode;
                        if (inMultiplayer && game.showPauseMenu && !window.USE_DOM_UI) {
                            if (typeof renderPauseMenu !== 'undefined') {
                                renderPauseMenu(ctx);
                            }
                        }
                    });
                }
            },
            {
                id: 'inputOverlay',
                target: 'main',
                draw(frame, ctx) {
                    timeCoarse(game, 'ui', () => {
                        if (Engine.Input && typeof Engine.Input.render === 'function') {
                            Engine.Input.render(ctx);
                        }
                    });
                }
            }
        ];
    }

    function createNexusPipeline(game) {
        if (!Engine.Render || typeof Engine.Render.createPipeline !== 'function') {
            throw new Error('Engine.Render.createPipeline is required.');
        }
        return Engine.Render.createPipeline(createNexusRecipe(game));
    }

    function beginNexusFrame(game, options = {}) {
        const logicalW = game.config ? game.config.width : 1280;
        const logicalH = (game.config && game.config.height) ? game.config.height : 720;
        const dpr = game.dpr || 1;
        const targets = options.targets || (game._nexusRenderTargets || (game._nexusRenderTargets = new Engine.Render.Targets()));
        targets.bindMain(game.canvas, game.ctx, { dpr, logicalW, logicalH });

        game._nexusTargetFrame = Engine.Render.createFrame({
            targetFrame: options.targetFrame || game._nexusTargetFrame || null,
            canvas: game.canvas,
            ctx: game.ctx,
            logicalW,
            logicalH,
            dpr,
            alpha: options.alpha,
            quality: game.renderQuality || null,
            targets,
            timings: options.timings || game.currentFrameTimings || Object.create(null),
            bag: options.bag || Object.create(null),
            debugPipelineId: 'nexus',
            profileStages: !!(typeof Engine !== 'undefined' && Engine.Debug
                && ((typeof Engine.Debug.wantsProfile === 'function' && Engine.Debug.wantsProfile('nexus'))
                    || (typeof Engine.Debug.wantsSnapshot === 'function' && Engine.Debug.wantsSnapshot('nexus'))))
        });
        return game._nexusTargetFrame;
    }

    // --- ENTERING ROOM STATE PIPELINE ---

    function createEnteringRoomRecipe(game) {
        return [
            {
                id: 'enteringRoomScreen',
                target: 'main',
                draw(frame, ctx) {
                    resetDprBaseline(ctx, frame.dpr || 1);
                    if (typeof game.renderRoomEnterScreen === 'function') {
                        game.renderRoomEnterScreen(ctx);
                    }
                }
            },
            {
                id: 'inputOverlay',
                target: 'main',
                draw(frame, ctx) {
                    timeCoarse(game, 'ui', () => {
                        if (Engine.Input && typeof Engine.Input.render === 'function') {
                            Engine.Input.render(ctx);
                        }
                    });
                }
            }
        ];
    }

    function createEnteringRoomPipeline(game) {
        if (!Engine.Render || typeof Engine.Render.createPipeline !== 'function') {
            throw new Error('Engine.Render.createPipeline is required.');
        }
        return Engine.Render.createPipeline(createEnteringRoomRecipe(game));
    }

    function beginEnteringRoomFrame(game, options = {}) {
        const logicalW = game.config ? game.config.width : 1280;
        const logicalH = (game.config && game.config.height) ? game.config.height : 720;
        const dpr = game.dpr || 1;
        const targets = options.targets || (game._enteringRoomRenderTargets || (game._enteringRoomRenderTargets = new Engine.Render.Targets()));
        targets.bindMain(game.canvas, game.ctx, { dpr, logicalW, logicalH });

        game._enteringRoomTargetFrame = Engine.Render.createFrame({
            targetFrame: options.targetFrame || game._enteringRoomTargetFrame || null,
            canvas: game.canvas,
            ctx: game.ctx,
            logicalW,
            logicalH,
            dpr,
            alpha: options.alpha,
            quality: game.renderQuality || null,
            targets,
            timings: options.timings || game.currentFrameTimings || Object.create(null),
            bag: options.bag || Object.create(null),
            debugPipelineId: 'enteringRoom',
            profileStages: !!(typeof Engine !== 'undefined' && Engine.Debug
                && ((typeof Engine.Debug.wantsProfile === 'function' && Engine.Debug.wantsProfile('enteringRoom'))
                    || (typeof Engine.Debug.wantsSnapshot === 'function' && Engine.Debug.wantsSnapshot('enteringRoom'))))
        });
        return game._enteringRoomTargetFrame;
    }

    // --- PAUSED STATE PIPELINE ---

    function createPausedRecipe(game) {
        return [
            {
                id: 'pausedBackground',
                target: 'main',
                draw(frame, ctx) {
                    resetDprBaseline(ctx, frame.dpr || 1);
                    if (game.pausedFromState === 'NEXUS') {
                        ctx.globalAlpha = 0.3;
                        if (typeof renderNexus !== 'undefined') {
                            renderNexus(ctx);
                        }
                        ctx.globalAlpha = 1.0;
                    } else {
                        if (typeof renderRoomBackground !== 'undefined') {
                            renderRoomBackground(ctx, game.roomNumber);
                        } else if (Engine.Renderer && typeof Engine.Renderer.clear === 'function') {
                            Engine.Renderer.clear(ctx, frame.logicalW, frame.logicalH);
                        }
                        if (game.player && game.player.alive && typeof game.renderGameWorld === 'function') {
                            ctx.globalAlpha = 0.3;
                            game.renderGameWorld(ctx);
                            ctx.globalAlpha = 1.0;
                        }
                    }
                }
            },
            {
                id: 'pausedOverlay',
                target: 'main',
                draw(frame, ctx) {
                    timeCoarse(game, 'ui', () => {
                        if (typeof renderPauseMenu !== 'undefined') {
                            renderPauseMenu(ctx);
                        }
                    });
                }
            },
            {
                id: 'inputOverlay',
                target: 'main',
                draw(frame, ctx) {
                    timeCoarse(game, 'ui', () => {
                        if (Engine.Input && typeof Engine.Input.render === 'function') {
                            Engine.Input.render(ctx);
                        }
                    });
                }
            }
        ];
    }

    function createPausedPipeline(game) {
        if (!Engine.Render || typeof Engine.Render.createPipeline !== 'function') {
            throw new Error('Engine.Render.createPipeline is required.');
        }
        return Engine.Render.createPipeline(createPausedRecipe(game));
    }

    function beginPausedFrame(game, options = {}) {
        const logicalW = game.config ? game.config.width : 1280;
        const logicalH = (game.config && game.config.height) ? game.config.height : 720;
        const dpr = game.dpr || 1;
        const targets = options.targets || (game._pausedRenderTargets || (game._pausedRenderTargets = new Engine.Render.Targets()));
        targets.bindMain(game.canvas, game.ctx, { dpr, logicalW, logicalH });

        game._pausedTargetFrame = Engine.Render.createFrame({
            targetFrame: options.targetFrame || game._pausedTargetFrame || null,
            canvas: game.canvas,
            ctx: game.ctx,
            logicalW,
            logicalH,
            dpr,
            alpha: options.alpha,
            quality: game.renderQuality || null,
            targets,
            timings: options.timings || game.currentFrameTimings || Object.create(null),
            bag: options.bag || Object.create(null),
            debugPipelineId: 'paused',
            profileStages: !!(typeof Engine !== 'undefined' && Engine.Debug
                && ((typeof Engine.Debug.wantsProfile === 'function' && Engine.Debug.wantsProfile('paused'))
                    || (typeof Engine.Debug.wantsSnapshot === 'function' && Engine.Debug.wantsSnapshot('paused'))))
        });
        return game._pausedTargetFrame;
    }

    /** Release pooled offscreen targets across all state pipelines. Call on teardown/resize. */
    function cleanupAllStateTargets(game) {
        if (!game) return;
        cleanupPlayingTargets(game);
        const targetSets = [
            game._titleRenderTargets,
            game._nexusRenderTargets,
            game._enteringRoomRenderTargets,
            game._pausedRenderTargets
        ];
        for (let i = 0; i < targetSets.length; i++) {
            const targets = targetSets[i];
            if (targets && typeof targets.releaseAll === 'function') {
                targets.releaseAll();
            }
        }
    }

    root.GameRenderPipeline = {
        createPlayingRecipe,
        createPlayingPipeline,
        beginPlayingFrame,
        cleanupPlayingTargets,
        cleanupAllStateTargets,
        createTitleRecipe,
        createTitlePipeline,
        beginTitleFrame,
        createNexusRecipe,
        createNexusPipeline,
        beginNexusFrame,
        createEnteringRoomRecipe,
        createEnteringRoomPipeline,
        beginEnteringRoomFrame,
        createPausedRecipe,
        createPausedPipeline,
        beginPausedFrame,
        worldTargetName,
        enterWorldContext,
        leaveWorldContext,
        withWorldContext,
        resetDprBaseline
    };
})(typeof window !== 'undefined' ? window : globalThis);


