// Generic game loop, fixed-timestep scheduler, and frame-budget governor.
// Composition-based design with zero Shape Slayer game references.

if (typeof window !== 'undefined') {
    window.Engine = window.Engine || {};
}

const QUALITY_TIER = (
    typeof globalThis !== 'undefined' &&
    globalThis.Engine &&
    globalThis.Engine.Render &&
    globalThis.Engine.Render.QualityTier
) || Object.freeze({ HIGH: 0, MEDIUM: 1, LOW: 2 });

class Core {
    constructor({
        onInit,
        onUpdate,
        onRender,
        onHitPauseTick,
        onFrameEnd,
        onVisibilityChange,
        onQualityChange,
        preferBackgroundTimeout
    }) {
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
        this.frameBudgetSamples = [];
        this.debugFrameBudget = { frameAvg: 0, renderAvg: 0 };
        this.qualityTier = QUALITY_TIER.HIGH;

        this._visibilityHandler = this.handleVisibilityChange.bind(this);
    }

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

    stop() {
        this.loopStopped = true;
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
        document.removeEventListener('visibilitychange', this._visibilityHandler);
    }

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

        // Governor performance measurement
        this.updateFrameBudgetGovernor(realDeltaTime * 1000, renderTime);

        // telemetry / profiler callback hook
        const processEnd = performance.now();
        const processTime = processEnd - processStart;
        if (this.onFrameEnd) {
            this.onFrameEnd({
                realDeltaTime,
                processTime,
                updateTime,
                renderTime,
                updatesRun,
                accumulatorTruncated: this.lastAccumulatorTruncated
            });
        }

        if (this.useSetTimeoutLoop) {
            this.timeoutId = setTimeout(() => this.gameLoop(performance.now()), 1000 / 60);
        } else {
            requestAnimationFrame((time) => this.gameLoop(time));
        }
    }

    // Frame budget governor & performance capabilities
    updateFrameBudgetGovernor(frameTimeMs, renderTimeMs) {
        const adaptiveEnabled = typeof DebugFlags === 'undefined' || DebugFlags.ADAPTIVE_RENDER_QUALITY !== false;
        if (!adaptiveEnabled) {
            this.frameBudgetSamples.length = 0;
            this.setQualityTier(QUALITY_TIER.HIGH);
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

        const thresholds = this.getFrameBudgetThresholds();
        if (frameAvg > thresholds.heavyFrame || renderAvg > thresholds.heavyRender) {
            this.setQualityTier(QUALITY_TIER.LOW);
        } else if (frameAvg > thresholds.mediumFrame || renderAvg > thresholds.mediumRender) {
            this.setQualityTier(QUALITY_TIER.MEDIUM);
        } else if (frameAvg < thresholds.restoreFrame && renderAvg < thresholds.restoreRender) {
            this.setQualityTier(QUALITY_TIER.HIGH);
        }
    }

    setQualityTier(tier) {
        if (this.qualityTier === tier) return;
        this.qualityTier = tier;
        const engine = typeof globalThis !== 'undefined' ? globalThis.Engine : null;
        if (engine && engine.Render && engine.Render.Quality) {
            const preset = engine.Render.Quality.preset(tier);
            if (engine.FX && engine.FX.Particles
                && typeof engine.FX.Particles.setParticleCap === 'function') {
                engine.FX.Particles.setParticleCap(preset.particleCap);
            }
            if (engine.Graphics && engine.Graphics.TileBaker
                && typeof engine.Graphics.TileBaker.setQualityTier === 'function') {
                engine.Graphics.TileBaker.setQualityTier(tier);
            }
        }
        if (this.onQualityChange) {
            this.onQualityChange(tier, Object.assign({}, this.debugFrameBudget));
        }
    }

    isGeckoFamilyEngine() {
        return typeof DeviceDetection !== 'undefined'
            && typeof DeviceDetection.isGeckoFamily === 'function'
            && DeviceDetection.isGeckoFamily();
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
                heavyVignetteScale: 0.33
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
            heavyVignetteScale: 0.33
        };
    }
};

if (typeof window !== 'undefined') {
    window.Engine.Core = Core;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Core;
}
