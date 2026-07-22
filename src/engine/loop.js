/**
 * @typedef {Object} FrameEndMetrics
 * @property {number} realDeltaTime Delta time in seconds
 * @property {number} processTime CPU work time in ms
 * @property {number} updateTime Fixed update time in ms
 * @property {number} renderTime Render time in ms
 * @property {number} updatesRun Number of fixed timestep steps executed
 * @property {boolean} accumulatorTruncated True if spike caused accumulator reset
 *
 * @typedef {Object} CoreHooks
 * @property {function(): void} [onInit] Called once during start()
 * @property {function(number): void} [onUpdate] Fixed timestep update callback (dt in seconds)
 * @property {function(CanvasRenderingContext2D|null, number): void} [onRender] Render callback (ctx placeholder, alpha interpolation factor)
 * @property {function(number): void} [onHitPauseTick] Tick callback while hit-pause freezes sim
 * @property {function(FrameEndMetrics): void} [onFrameEnd] Frame metrics collector hook
 * @property {function(boolean): void} [onVisibilityChange] Tab visibility change handler
 * @property {function(number, {frameAvg: number, renderAvg: number, fxBoost: number}): void} [onQualityChange] Quality tier / boost change callback
 * @property {function(): boolean} [preferBackgroundTimeout] Callback returning true if setTimeout loop should run when hidden
 * @property {boolean} [adaptiveRenderQuality] Enable adaptive frame budget governor (default true)
 *
 * @typedef {Object} FrameBudgetThresholds
 * @property {number} mediumFrame
 * @property {number} mediumRender
 * @property {number} heavyFrame
 * @property {number} heavyRender
 * @property {number} restoreFrame
 * @property {number} restoreRender
 * @property {number} mediumVignetteScale
 * @property {number} heavyVignetteScale
 * @property {number} [boostEnterFrame]
 * @property {number} [boostEnterRender]
 * @property {number} [boostFullFrame]
 * @property {number} [boostFullRender]
 * @property {number} [boostExitFrame]
 * @property {number} [boostExitRender]
 */

if (typeof window !== 'undefined') {
    window.Engine = window.Engine || {};
}

const QUALITY_TIER = (
    typeof globalThis !== 'undefined' &&
    globalThis.Engine &&
    globalThis.Engine.Render &&
    globalThis.Engine.Render.QualityTier
) || Object.freeze({ HIGH: 0, MEDIUM: 1, LOW: 2 });

/**
 * Generic game loop, fixed-timestep scheduler, and frame-budget governor.
 */
class Core {
    /**
     * @param {CoreHooks} [hooks]
     */
    constructor({
        onInit,
        onUpdate,
        onRender,
        onHitPauseTick,
        onFrameEnd,
        onVisibilityChange,
        onQualityChange,
        preferBackgroundTimeout,
        adaptiveRenderQuality
    } = {}) {
        this.onInit = onInit;
        this.onUpdate = onUpdate;
        this.onRender = onRender;
        this.onHitPauseTick = onHitPauseTick;
        this.onFrameEnd = onFrameEnd;
        this.onVisibilityChange = onVisibilityChange;
        this.onQualityChange = onQualityChange;
        this.preferBackgroundTimeout = typeof preferBackgroundTimeout === 'function'
            ? preferBackgroundTimeout
            : () => false;
        this.adaptiveRenderQuality = adaptiveRenderQuality !== false;

        // Timing configurations
        this.fixedTimestep = 1 / 60; // 60 Hz fixed timestep (0.016666... seconds)
        this.maxCatchupUpdates = 5;
        this.accumulatorTruncateThreshold = 0.1;

        // Timing states
        this.accumulator = 0;
        this.lastTime = 0;
        this.useSetTimeoutLoop = false;
        this.timeoutId = null;
        this.loopStopped = true;
        this.lastAccumulatorTruncated = false;

        // Hit pause handling (game-managed freeze duration)
        this.hitPauseTime = 0;

        // FPS tracking
        this.fps = 0;
        this.frameCount = 0;
        this.lastFpsUpdate = 0;

        // Frame budget governor variables
        this.frameBudgetCapacity = 128;
        this.frameBudgetMask = 127;
        this._sampleTimes = new Float64Array(128);
        this._sampleFrames = new Float32Array(128);
        this._sampleRenders = new Float32Array(128);
        this._sampleHead = 0;
        this._sampleCount = 0;
        this.frameBudgetSamples = [];
        this.debugFrameBudget = { frameAvg: 0, renderAvg: 0, fxBoost: 0 };
        this.qualityTier = QUALITY_TIER.HIGH;
        this.fxBoost = 0;
        this._lastBoostUpdateMs = 0;
        this._lastEmittedBoostBucket = 0;
        this._lastEmittedTier = QUALITY_TIER.HIGH;
        this._boostValidSampleMin = 60; // ~1s at 60fps before raise is allowed
        this._boostUpRate = 0.35;
        this._boostDownRate = 0.75;

        this._frameEndMetrics = {
            realDeltaTime: 0,
            processTime: 0,
            updateTime: 0,
            renderTime: 0,
            updatesRun: 0,
            accumulatorTruncated: false
        };

        this._visibilityHandler = this.handleVisibilityChange.bind(this);
    }

    /**
     * Start the game loop.
     */
    start() {
        this.lastTime = performance.now();
        this.accumulator = 0;
        this.useSetTimeoutLoop = false;
        this.loopStopped = false;

        document.addEventListener('visibilitychange', this._visibilityHandler);

        if (this.onInit) {
            this.onInit();
        }

        this.gameLoop();
    }

    /**
     * Stop the game loop and unbind listeners.
     */
    stop() {
        this.loopStopped = true;
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
        document.removeEventListener('visibilitychange', this._visibilityHandler);
    }

    /**
     * Handle document visibility change (switch to background setTimeout loop if requested).
     */
    handleVisibilityChange() {
        const isHidden = document.hidden;

        const keepBackgroundFrames = this.preferBackgroundTimeout();

        if (keepBackgroundFrames && isHidden) {
            this.useSetTimeoutLoop = true;
            console.log('[Engine] Switched to setTimeout loop (background)');
        } else {
            this.useSetTimeoutLoop = false;
            console.log('[Engine] Switched to RAF loop (foreground)');
        }

        if (this.onVisibilityChange) {
            this.onVisibilityChange(isHidden);
        }
    }

    /**
     * Main loop step function called via rAF or setTimeout.
     * @param {number} [currentTime=0]
     */
    gameLoop(currentTime = 0) {
        if (this.loopStopped) return;

        if (!currentTime) {
            currentTime = performance.now();
        }

        const realDeltaTime = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;

        const cappedRealDeltaTime = Math.min(realDeltaTime, 0.25);

        // Measure CPU process time
        const processStart = performance.now();
        let updateTime = 0;

        // Hit pause handling (freezes simulation updates, but keeps visual ticking)
        if (this.hitPauseTime > 0) {
            this.hitPauseTime -= cappedRealDeltaTime;
            if (this.hitPauseTime <= 0) {
                this.hitPauseTime = 0;
            }

            const juiceDt = Math.min(cappedRealDeltaTime, this.fixedTimestep);
            if (this.onHitPauseTick) {
                this.onHitPauseTick(juiceDt);
            }

            if (this.onRender) {
                // Pass context placeholder (null) if context is bound inside onRender,
                // and 1.0 interpolation factor during hit pause.
                this.onRender(null, 1.0);
            }

            if (this.useSetTimeoutLoop) {
                this.timeoutId = setTimeout(() => this.gameLoop(performance.now()), 1000 / 60);
            } else {
                requestAnimationFrame((time) => this.gameLoop(time));
            }
            return;
        }

        // FPS tracking
        this.frameCount++;
        if (currentTime - this.lastFpsUpdate >= 1000) {
            this.fps = this.frameCount;
            this.frameCount = 0;
            this.lastFpsUpdate = currentTime;
        }

        // Accumulate time for fixed timestep updates
        this.lastAccumulatorTruncated = realDeltaTime > (this.accumulatorTruncateThreshold || 0.1);
        if (this.lastAccumulatorTruncated) {
            this.accumulator = 0;
        } else {
            this.accumulator += cappedRealDeltaTime;
        }

        // Run catch-up updates
        const maxUpdates = this.maxCatchupUpdates || 5;
        let updatesRun = 0;
        while (this.accumulator >= this.fixedTimestep && updatesRun < maxUpdates) {
            const updateStart = performance.now();
            if (this.onUpdate) {
                this.onUpdate(this.fixedTimestep);
            }
            updateTime += performance.now() - updateStart;
            this.accumulator -= this.fixedTimestep;
            updatesRun++;
        }

        // Render pass
        const renderStart = performance.now();
        const alpha = this.accumulator / this.fixedTimestep;
        if (this.onRender) {
            this.onRender(null, alpha);
        }
        const renderTime = performance.now() - renderStart;

        // Governor must use CPU work time, NOT rAF interval. Vsync-capped frames stay
        // ~16.7ms wall-clock even when the game only needs ~2ms — that fake "full"
        // budget was blocking fxBoost (exit threshold ~12ms).
        const processEnd = performance.now();
        const processTime = processEnd - processStart;
        this.updateFrameBudgetGovernor(processTime, renderTime);

        // metrics / profiler callback hook
        if (this.onFrameEnd) {
            const metrics = this._frameEndMetrics;
            metrics.realDeltaTime = realDeltaTime;
            metrics.processTime = processTime;
            metrics.updateTime = updateTime;
            metrics.renderTime = renderTime;
            metrics.updatesRun = updatesRun;
            metrics.accumulatorTruncated = this.lastAccumulatorTruncated;
            this.onFrameEnd(metrics);
        }

        if (this.useSetTimeoutLoop) {
            this.timeoutId = setTimeout(() => this.gameLoop(performance.now()), 1000 / 60);
        } else {
            requestAnimationFrame((time) => this.gameLoop(time));
        }
    }

    // Frame budget governor & performance capabilities
    updateFrameBudgetGovernor(frameTimeMs, renderTimeMs) {
        const debugFlagsAdaptive = (typeof Engine !== 'undefined' && Engine.Debug && Engine.Debug.flags)
            ? Engine.Debug.flags.ADAPTIVE_RENDER_QUALITY !== false
            : (typeof DebugFlags === 'undefined' || DebugFlags.ADAPTIVE_RENDER_QUALITY !== false);
        const adaptiveEnabled = this.adaptiveRenderQuality && debugFlagsAdaptive;
        if (!adaptiveEnabled) {
            this.setQualityTier(QUALITY_TIER.HIGH);
            this._setFxBoost(0, true);
        }

        const now = performance.now();
        const head = this._sampleHead;
        this._sampleTimes[head] = now;
        this._sampleFrames[head] = frameTimeMs;
        this._sampleRenders[head] = renderTimeMs;

        this._sampleHead = (head + 1) & this.frameBudgetMask;
        if (this._sampleCount < this.frameBudgetCapacity) {
            this._sampleCount++;
        }

        const cutoff = now - 2000;
        let frameSum = 0;
        let renderSum = 0;
        let validCount = 0;

        for (let i = 0; i < this._sampleCount; i++) {
            const sampleIdx = (this._sampleHead - 1 - i + this.frameBudgetCapacity) & this.frameBudgetMask;
            if (this._sampleTimes[sampleIdx] < cutoff) break;
            frameSum += this._sampleFrames[sampleIdx];
            renderSum += this._sampleRenders[sampleIdx];
            validCount++;
        }

        const count = Math.max(1, validCount);
        const frameAvg = frameSum / count;
        const renderAvg = renderSum / count;
        this.debugFrameBudget.frameAvg = frameAvg;
        this.debugFrameBudget.renderAvg = renderAvg;

        if (adaptiveEnabled) {
            const thresholds = this.getFrameBudgetThresholds();
            if (frameAvg > thresholds.heavyFrame || renderAvg > thresholds.heavyRender) {
                this.setQualityTier(QUALITY_TIER.LOW);
            } else if (frameAvg > thresholds.mediumFrame || renderAvg > thresholds.mediumRender) {
                this.setQualityTier(QUALITY_TIER.MEDIUM);
            } else if (frameAvg < thresholds.restoreFrame && renderAvg < thresholds.restoreRender) {
                this.setQualityTier(QUALITY_TIER.HIGH);
            }

            this._updateFxBoost(frameAvg, renderAvg, validCount, thresholds, now);
        }

        this.debugFrameBudget.fxBoost = this.fxBoost;
        this._notifyQualityIfChanged();
    }

    _computeTargetFxBoost(frameAvg, renderAvg, validCount, thresholds) {
        if (this.qualityTier !== QUALITY_TIER.HIGH) return 0;
        if (validCount < this._boostValidSampleMin) return 0;

        const enterF = thresholds.boostEnterFrame;
        const enterR = thresholds.boostEnterRender;
        const fullF = thresholds.boostFullFrame;
        const fullR = thresholds.boostFullRender;
        const exitF = thresholds.boostExitFrame;
        const exitR = thresholds.boostExitRender;

        if (frameAvg >= exitF || renderAvg >= exitR) return 0;

        const frameDen = Math.max(0.001, enterF - fullF);
        const renderDen = Math.max(0.001, enterR - fullR);
        const frameScore = Math.max(0, Math.min(1, (enterF - frameAvg) / frameDen));
        const renderScore = Math.max(0, Math.min(1, (enterR - renderAvg) / renderDen));
        return Math.min(frameScore, renderScore);
    }

    _updateFxBoost(frameAvg, renderAvg, validCount, thresholds, now) {
        const target = this._computeTargetFxBoost(frameAvg, renderAvg, validCount, thresholds);
        const last = this._lastBoostUpdateMs || now;
        const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
        this._lastBoostUpdateMs = now;

        if (this.qualityTier !== QUALITY_TIER.HIGH) {
            this._setFxBoost(0, true);
            return;
        }

        let next = this.fxBoost;
        if (target > next) {
            next = Math.min(target, next + this._boostUpRate * dt);
        } else if (target < next) {
            next = Math.max(target, next - this._boostDownRate * dt);
        }
        this._setFxBoost(next, false);
    }

    _setFxBoost(value, instant) {
        const clamped = Math.max(0, Math.min(1, value));
        if (instant || Math.abs(clamped - this.fxBoost) > 1e-6) {
            this.fxBoost = clamped;
        }
    }

    resetFxBoost() {
        this._setFxBoost(0, true);
        this._lastBoostUpdateMs = 0;
        this._lastEmittedBoostBucket = -1;
        this.debugFrameBudget.fxBoost = 0;
        this._notifyQualityIfChanged(true);
    }

    _applyQualitySideEffects(tier) {
        const engine = typeof globalThis !== 'undefined' ? globalThis.Engine : null;
        if (!engine || !engine.Render || !engine.Render.Quality) return;
        const preset = engine.Render.Quality.preset(tier);
        let particleCap = preset.particleCap;
        if (tier === QUALITY_TIER.HIGH && this.fxBoost > 0) {
            particleCap = Math.round(particleCap + (2800 - particleCap) * this.fxBoost);
        }
        if (engine.FX && engine.FX.Particles
            && typeof engine.FX.Particles.setParticleCap === 'function') {
            engine.FX.Particles.setParticleCap(particleCap);
        }
        if (engine.Graphics && engine.Graphics.TileBaker
            && typeof engine.Graphics.TileBaker.setQualityTier === 'function') {
            engine.Graphics.TileBaker.setQualityTier(tier);
        }
        if (engine.Audio && typeof engine.Audio.setQualityTier === 'function') {
            engine.Audio.setQualityTier(tier);
        }
        if (engine.FX && engine.FX.ShardPool
            && typeof engine.FX.ShardPool.setSoftCap === 'function') {
            const base = 256;
            const max = engine.FX.ShardPool.capacity || 512;
            const soft = tier === QUALITY_TIER.HIGH
                ? Math.round(base + (max - base) * this.fxBoost)
                : (tier === QUALITY_TIER.MEDIUM ? 192 : 64);
            engine.FX.ShardPool.setSoftCap(soft);
        }
    }

    _notifyQualityIfChanged(force) {
        const boostBucket = Math.round(this.fxBoost * 50) / 50;
        const tierChanged = this._lastEmittedTier !== this.qualityTier;
        const boostChanged = this._lastEmittedBoostBucket !== boostBucket;
        if (!force && !tierChanged && !boostChanged) return;

        this._lastEmittedTier = this.qualityTier;
        this._lastEmittedBoostBucket = boostBucket;
        this._applyQualitySideEffects(this.qualityTier);
        if (this.onQualityChange) {
            this.onQualityChange(this.qualityTier, Object.assign({}, this.debugFrameBudget));
        }
    }

    setQualityTier(tier) {
        if (this.qualityTier === tier) return;
        const leavingHigh = this.qualityTier === QUALITY_TIER.HIGH && tier !== QUALITY_TIER.HIGH;
        this.qualityTier = tier;
        if (leavingHigh || tier !== QUALITY_TIER.HIGH) {
            this._setFxBoost(0, true);
        }
        this.debugFrameBudget.fxBoost = this.fxBoost;
        // Emission deferred to _notifyQualityIfChanged from governor (or force below).
        this._lastEmittedTier = null;
        this._notifyQualityIfChanged(true);
    }

    isGeckoFamilyEngine() {
        const system = (typeof globalThis !== 'undefined' && globalThis.Engine && globalThis.Engine.System) || null;
        return !!(system && typeof system.isGeckoFamily === 'function' && system.isGeckoFamily());
    }

    preferSpriteShadows() {
        return this.isGeckoFamilyEngine();
    }

    getDprCap() {
        return this.isGeckoFamilyEngine() ? 1.5 : 2;
    }

    getFrameBudgetThresholds() {
        if (this.isGeckoFamilyEngine()) {
            return {
                mediumFrame: 28,
                mediumRender: 20,
                heavyFrame: 32,
                heavyRender: 24,
                restoreFrame: 24,
                restoreRender: 17,
                mediumVignetteScale: 0.4,
                heavyVignetteScale: 0.33,
                // More conservative headroom gate on Gecko.
                boostEnterFrame: 7,
                boostEnterRender: 5,
                boostFullFrame: 3.5,
                boostFullRender: 2.5,
                boostExitFrame: 11,
                boostExitRender: 8
            };
        }
        return {
            mediumFrame: 30,
            mediumRender: 22,
            heavyFrame: 34,
            heavyRender: 28,
            restoreFrame: 24,
            restoreRender: 17,
            mediumVignetteScale: 0.4,
            heavyVignetteScale: 0.33,
            boostEnterFrame: 8,
            boostEnterRender: 6,
            boostFullFrame: 4,
            boostFullRender: 3,
            boostExitFrame: 12,
            boostExitRender: 9
        };
    }
};

if (typeof window !== 'undefined') {
    window.Engine.Core = Core;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Core;
}
