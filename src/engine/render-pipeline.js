// Engine.Render pipeline: named targets + ordered stage runner (pipe, not graph).
// Stages own Canvas2D state cleanup; the runner never wraps draw in save/restore.

(function(root) {
    const Engine = root.Engine = root.Engine || {};
    const Render = Engine.Render = Engine.Render || {};

    function requireName(name) {
        if (typeof name !== 'string' || name.length === 0) {
            throw new TypeError('Target names must be non-empty strings.');
        }
        return name;
    }

    function getCanvasPool() {
        const pool = Engine.Graphics && Engine.Graphics.CanvasPool;
        if (!pool || typeof pool.acquire !== 'function') {
            throw new Error('Engine.Render.Targets requires Engine.Graphics.CanvasPool.');
        }
        return pool;
    }

    /**
     * Named shared render targets for one pipe.
     * `main` is an external canvas bound by the host; pooled targets
     * (e.g. `world`) are acquired/resized from CanvasPool and cleared on ensure
     * so leftover pixels from a prior frame cannot ghost through.
     */
    class Targets {
        constructor(options = {}) {
            this._slots = new Map();
            this._pool = options.canvasPool || null;
            this._main = null;
        }

        bindMain(canvas, ctx, meta = {}) {
            if (!canvas || !ctx) {
                throw new TypeError('bindMain requires canvas and ctx.');
            }
            this._main = {
                name: 'main',
                canvas,
                ctx,
                pooled: false,
                dpr: Number(meta.dpr) || 1,
                logicalW: Number(meta.logicalW) || canvas.width || 1,
                logicalH: Number(meta.logicalH) || canvas.height || 1,
                pixelW: canvas.width,
                pixelH: canvas.height
            };
            this._slots.set('main', this._main);
            return this._main;
        }

        _poolRef() {
            return this._pool || getCanvasPool();
        }

        /**
         * Ensure a named target is sized, DPR-scaled, and ready to draw.
         * Pooled targets clear on every ensure (default) to prevent ghosting.
         * Pass { clear: false } only when a later stage will fully replace pixels.
         */
        ensure(name, options = {}) {
            requireName(name);
            if (name === 'main') {
                if (!this._main) {
                    throw new Error('Targets.ensure("main") requires bindMain() first.');
                }
                return this._main;
            }

            const pixelW = Math.max(1, Math.round(Number(options.pixelW) || Number(options.width) || 1));
            const pixelH = Math.max(1, Math.round(Number(options.pixelH) || Number(options.height) || 1));
            const dpr = Math.max(0.25, Number(options.dpr) || 1);
            const logicalW = Number.isFinite(options.logicalW)
                ? Math.max(1, options.logicalW)
                : pixelW / dpr;
            const logicalH = Number.isFinite(options.logicalH)
                ? Math.max(1, options.logicalH)
                : pixelH / dpr;
            const shouldClear = options.clear !== false;

            let slot = this._slots.get(name);
            const pool = this._poolRef();
            let resized = false;

            if (!slot) {
                const canvas = pool.acquire(pixelW, pixelH);
                const ctx = canvas.getContext('2d');
                slot = { name, canvas, ctx, pooled: true, dpr, logicalW, logicalH, pixelW, pixelH };
                this._slots.set(name, slot);
                resized = true;
            } else if (slot.canvas.width !== pixelW || slot.canvas.height !== pixelH) {
                pool.release(slot.canvas);
                slot.canvas = pool.acquire(pixelW, pixelH);
                slot.ctx = slot.canvas.getContext('2d');
                slot.pixelW = pixelW;
                slot.pixelH = pixelH;
                resized = true;
            }

            slot.dpr = dpr;
            slot.logicalW = logicalW;
            slot.logicalH = logicalH;

            // Pooled canvases keep stale transforms and pixels; always reset.
            slot.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            if (shouldClear || resized) {
                slot.ctx.clearRect(0, 0, logicalW, logicalH);
            }
            return slot;
        }

        get(name) {
            requireName(name);
            return this._slots.get(name) || null;
        }

        ctx(name) {
            const slot = this.get(name);
            return slot ? slot.ctx : null;
        }

        canvas(name) {
            const slot = this.get(name);
            return slot ? slot.canvas : null;
        }

        release(name) {
            requireName(name);
            if (name === 'main') return false;
            const slot = this._slots.get(name);
            if (!slot) return false;
            this._slots.delete(name);
            if (slot.pooled) {
                const pool = this._poolRef();
                if (pool && typeof pool.release === 'function') pool.release(slot.canvas);
            }
            return true;
        }

        releaseAll() {
            for (const name of Array.from(this._slots.keys())) {
                if (name !== 'main') this.release(name);
            }
        }
    }

    /**
     * Per-frame host object passed to every stage draw(frame, ctx).
     * `bag` is an opaque game payload; the engine never inspects it.
     * Optional per-stage measurements land in `stageTimings` (never in `timings`)
     * so game coarse profiler buckets stay unpolluted.
     */
    function createFrame(options = {}) {
        const targets = options.targets || new Targets(options);
        if (options.canvas && options.ctx) {
            const existing = targets.get('main');
            // Avoid double-binding when the caller already bound the same main surface.
            if (!existing || existing.canvas !== options.canvas || existing.ctx !== options.ctx) {
                targets.bindMain(options.canvas, options.ctx, {
                    dpr: options.dpr,
                    logicalW: options.logicalW,
                    logicalH: options.logicalH
                });
            } else {
                existing.dpr = Number(options.dpr) || existing.dpr;
                existing.logicalW = Number(options.logicalW) || existing.logicalW;
                existing.logicalH = Number(options.logicalH) || existing.logicalH;
                existing.pixelW = options.canvas.width;
                existing.pixelH = options.canvas.height;
            }
        }

        const tf = options.targetFrame && typeof options.targetFrame === 'object' ? options.targetFrame : null;
        let viewport = null;
        if (options.viewport) {
            viewport = tf && tf.viewport ? tf.viewport : { x: 0, y: 0, w: 1, h: 1 };
            viewport.x = Number(options.viewport.x) || 0;
            viewport.y = Number(options.viewport.y) || 0;
            viewport.w = Math.max(1, Number(options.viewport.w) || 1);
            viewport.h = Math.max(1, Number(options.viewport.h) || 1);
        }

        if (tf) {
            tf.canvas = options.canvas || null;
            tf.ctx = options.ctx || null;
            tf.logicalW = Number(options.logicalW) || 1;
            tf.logicalH = Number(options.logicalH) || 1;
            tf.dpr = Number(options.dpr) || 1;
            tf.alpha = Number.isFinite(options.alpha) ? options.alpha : 0;
            tf.quality = options.quality || null;
            tf.camera = options.camera || null;
            tf.viewport = viewport;
            tf.targets = targets;
            tf.timings = options.timings || tf.timings || Object.create(null);
            tf.stageTimings = options.stageTimings || tf.stageTimings || Object.create(null);
            tf.bag = options.bag || tf.bag || Object.create(null);
            tf.profileStages = !!options.profileStages;
            tf.debugPipelineId = options.debugPipelineId || null;
            return tf;
        }

        return {
            canvas: options.canvas || null,
            ctx: options.ctx || null,
            logicalW: Number(options.logicalW) || 1,
            logicalH: Number(options.logicalH) || 1,
            dpr: Number(options.dpr) || 1,
            alpha: Number.isFinite(options.alpha) ? options.alpha : 0,
            quality: options.quality || null,
            camera: options.camera || null,
            viewport,
            targets,
            timings: options.timings || Object.create(null),
            stageTimings: options.stageTimings || Object.create(null),
            bag: options.bag || Object.create(null),
            /** When true, the runner records per-stage performance.now deltas. */
            profileStages: !!options.profileStages,
            /** Registered Engine.Debug pipeline id for attach/detach snapshot gates. */
            debugPipelineId: options.debugPipelineId || null
        };
    }

    /**
     * Restrict a complete render pass to a logical-canvas viewport.
     * Keep this paired with endViewport(); Canvas2D clips intersect rather than replace.
     */
    function beginViewport(ctx, viewport) {
        if (!ctx || !viewport) return false;
        ctx.save();
        ctx.beginPath();
        ctx.rect(viewport.x, viewport.y, viewport.w, viewport.h);
        ctx.clip();
        return true;
    }

    function endViewport(ctx, begun = true) {
        if (ctx && begun) ctx.restore();
    }

    /**
     * Ordered stage-list runner.
     *
     * Stage contract:
     * - `id` (string): stable name for timings / debugging
     * - `target` (string | (frame) => string): named write target
     * - `draw(frame, ctx)`: draw into ctx; must leave ctx state clean
     *   (identity-equivalent transform/composite/alpha for the next stage).
     *   The runner does NOT wrap draw in save/restore.
     * - `enabled?(frame)`: optional skip predicate
     *
     * Profiling is off unless frame.profileStages is true (game sets this from
     * debug/profiler flags). Clock math is skipped entirely otherwise.
     */
    function createPipeline(recipe, options = {}) {
        if (!Array.isArray(recipe)) {
            throw new TypeError('Pipeline recipe must be an array of stages.');
        }
        const stages = recipe.map((stage, index) => {
            if (!stage || typeof stage !== 'object') {
                throw new TypeError(`Pipeline stage ${index} must be an object.`);
            }
            if (typeof stage.id !== 'string' || !stage.id) {
                throw new TypeError(`Pipeline stage ${index} requires a non-empty id.`);
            }
            if (typeof stage.draw !== 'function') {
                throw new TypeError(`Pipeline stage "${stage.id}" requires a draw(frame, ctx) function.`);
            }
            if (stage.target == null) {
                throw new TypeError(`Pipeline stage "${stage.id}" must declare a target name.`);
            }
            return stage;
        });

        const resolveTargetName = (stage, frame) => {
            if (typeof stage.target === 'function') return stage.target(frame);
            return stage.target;
        };

        return {
            stages() {
                return stages.slice();
            },

            run(frame) {
                if (!frame || !frame.targets) {
                    throw new TypeError('pipeline.run requires a frame with targets.');
                }
                const Debug = Engine.Debug;
                if (Debug && typeof Debug.setActivePipelineId === 'function') {
                    Debug.setActivePipelineId(frame.debugPipelineId || null);
                }
                const snap = !!(Debug && typeof Debug.shouldSnapshot === 'function'
                    && Debug.shouldSnapshot(frame.debugPipelineId || null));
                const profile = !!frame.profileStages || snap;
                const stageTimings = frame.stageTimings || (frame.stageTimings = Object.create(null));
                const now = profile && typeof performance !== 'undefined' && performance.now
                    ? () => performance.now()
                    : null;
                const canStageHook = !!(Debug && (profile || snap));

                for (let i = 0; i < stages.length; i++) {
                    const stage = stages[i];
                    if (typeof stage.enabled === 'function' && !stage.enabled(frame)) {
                        continue;
                    }

                    const targetName = resolveTargetName(stage, frame);
                    if (typeof targetName !== 'string' || !targetName) {
                        throw new Error(`Stage "${stage.id}" resolved an invalid target.`);
                    }

                    let slot = frame.targets.get(targetName);
                    if (!slot && targetName === 'main' && frame.ctx) {
                        slot = frame.targets.bindMain(frame.canvas, frame.ctx, {
                            dpr: frame.dpr,
                            logicalW: frame.logicalW,
                            logicalH: frame.logicalH
                        });
                    }
                    if (!slot || !slot.ctx) {
                        throw new Error(`Stage "${stage.id}" target "${targetName}" is not ready; call targets.ensure() first.`);
                    }

                    let stageMeta = null;
                    if (canStageHook) {
                        stageMeta = {
                            target: targetName,
                            targetWidth: slot.pixelW || (slot.canvas ? slot.canvas.width : 0),
                            targetHeight: slot.pixelH || (slot.canvas ? slot.canvas.height : 0),
                            targetDpr: slot.dpr || frame.dpr || 1,
                            targetPooled: !!slot.pooled,
                            ctxState: {
                                globalAlpha: slot.ctx.globalAlpha,
                                compositeOperation: slot.ctx.globalCompositeOperation,
                                imageSmoothing: slot.ctx.imageSmoothingEnabled
                            },
                            camera: frame.camera ? {
                                x: frame.camera.x,
                                y: frame.camera.y,
                                zoom: frame.camera.zoom,
                                offsetX: frame.camera.offsetX || 0,
                                offsetY: frame.camera.offsetY || 0
                            } : null,
                            viewport: frame.viewport ? {
                                x: frame.viewport.x,
                                y: frame.viewport.y,
                                w: frame.viewport.w,
                                h: frame.viewport.h
                            } : null,
                            quality: frame.quality || null
                        };
                    }

                    let bagIn = null;
                    if (canStageHook && Debug.beginStage) {
                        Debug.beginStage(stage.id, stageMeta);
                    }
                    if (snap && Debug.summarizeBag) {
                        bagIn = Debug.summarizeBag(frame.bag);
                    }

                    const t0 = now ? now() : 0;
                    stage.draw(frame, slot.ctx);
                    const ms = now ? (now() - t0) : 0;
                    if (now) {
                        stageTimings[stage.id] = (stageTimings[stage.id] || 0) + ms;
                    }

                    let bagOut = null;
                    if (snap && Debug.summarizeBag) {
                        bagOut = Debug.summarizeBag(frame.bag);
                    }
                    if (canStageHook && Debug.endStage) {
                        Debug.endStage(stage.id, ms, bagIn, bagOut, stageMeta);
                    }
                }

                return frame;
            }
        };
    }

    Render.Targets = Targets;
    Render.createFrame = createFrame;
    Render.createPipeline = createPipeline;
    Render.beginViewport = beginViewport;
    Render.endViewport = endViewport;
})(typeof window !== 'undefined' ? window : globalThis);

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        Targets: globalThis.Engine.Render.Targets,
        createFrame: globalThis.Engine.Render.createFrame,
        createPipeline: globalThis.Engine.Render.createPipeline,
        beginViewport: globalThis.Engine.Render.beginViewport,
        endViewport: globalThis.Engine.Render.endViewport
    };
}
