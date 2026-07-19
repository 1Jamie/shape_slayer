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
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        if ('filter' in ctx) ctx.filter = 'none';
        if ('shadowBlur' in ctx) {
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
     * PLAYING default recipe: six world stages then post/overlay stages.
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
                }
            },
            {
                id: 'worldGlow',
                target: worldTargetName,
                draw(frame, ctx) {
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

        return Engine.Render.createFrame({
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
                offsetX: game.screenShakeOffset.x,
                offsetY: game.screenShakeOffset.y
            },
            targets,
            timings,
            stageTimings: options.stageTimings || Object.create(null),
            bag,
            profileStages: typeof game.shouldCollectDebugMetrics === 'function'
                ? game.shouldCollectDebugMetrics()
                : false
        });
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

    root.GameRenderPipeline = {
        createPlayingRecipe,
        createPlayingPipeline,
        beginPlayingFrame,
        cleanupPlayingTargets,
        worldTargetName,
        enterWorldContext,
        leaveWorldContext,
        withWorldContext,
        resetDprBaseline
    };
})(typeof window !== 'undefined' ? window : globalThis);
