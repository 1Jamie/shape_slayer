/**
 * Shape Engine boot lifecycle: probe, verify, initialize, and publish runtime
 * before any game code touches the canvas/input/save stack.
 */
(function(root) {
    const Engine = root.Engine = root.Engine || {};
    Engine.VERSION = Engine.VERSION || '0.1a';

    const REQUIRED_NAMESPACES = Object.freeze([
        'System', 'Save', 'Physics', 'Proc', 'Graphics', 'FX',
        'Render', 'Core', 'Audio', 'Input', 'Net', 'Shell', 'UI'
    ]);

    function now() {
        if (root.performance && typeof root.performance.now === 'function') {
            return root.performance.now();
        }
        return Date.now();
    }

    function prefersReducedMotion() {
        try {
            return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
        } catch (_) {
            return false;
        }
    }

    function pageMode() {
        try {
            const protocol = String(root.location && root.location.protocol || '');
            if (protocol === 'file:') return 'file';
            if (protocol === 'http:' || protocol === 'https:') return 'http';
            return protocol || 'unknown';
        } catch (_) {
            return 'unknown';
        }
    }

    function resolveDocument() {
        return root.document || null;
    }

    function classify(report) {
        const fatal = [];
        const warnings = [];
        const checks = report.checks || {};

        if (!checks.document) fatal.push('Missing document.');
        if (!checks.canvas) fatal.push('Missing canvas element.');
        if (!checks.canvas2d) fatal.push('Canvas2D is unavailable.');
        if (!checks.raf) fatal.push('requestAnimationFrame is unavailable.');
        if (!checks.performanceNow) fatal.push('performance.now is unavailable.');
        if (Array.isArray(checks.missingNamespaces) && checks.missingNamespaces.length) {
            fatal.push(`Missing engine namespaces: ${checks.missingNamespaces.join(', ')}`);
        }

        if (!checks.localStorage) warnings.push('Persistent storage unavailable; using memory save fallback.');
        if (!checks.audioContext) warnings.push('AudioContext unavailable; audio will stay muted until available.');
        if (!checks.serviceWorker) warnings.push('Service worker unavailable in this environment.');
        if (checks.highDpr === false && checks.dprMissing) {
            warnings.push('Device pixel ratio unavailable; using 1x render density.');
        }

        let status = 'ready';
        if (fatal.length) status = 'fatal';
        else if (warnings.length) status = 'degraded';
        return { status, fatal, warnings };
    }

    const Boot = {
        VERSION: Engine.VERSION,
        runtime: null,
        _initializing: false,
        _lastReport: null,
        _handoffPromise: null,

        probe(options = {}) {
            const document = resolveDocument();
            const canvasId = options.canvasId || 'gameCanvas';
            const canvas = options.canvas
                || (document && typeof document.getElementById === 'function'
                    ? document.getElementById(canvasId)
                    : null);

            let canvas2d = false;
            if (canvas && typeof canvas.getContext === 'function') {
                try {
                    canvas2d = !!canvas.getContext('2d');
                } catch (_) {
                    canvas2d = false;
                }
            }

            let localStorageOk = false;
            try {
                const storage = root.localStorage || null;
                if (storage && typeof storage.getItem === 'function' && typeof storage.setItem === 'function') {
                    const probeKey = '__shape_engine_boot_probe__';
                    storage.setItem(probeKey, '1');
                    localStorageOk = storage.getItem(probeKey) === '1';
                    storage.removeItem(probeKey);
                }
            } catch (_) {
                localStorageOk = false;
            }

            const AudioCtx = root.AudioContext || root.webkitAudioContext || null;
            const missingNamespaces = REQUIRED_NAMESPACES.filter(name => !Engine[name]);
            const deviceProfile = (Engine.System && typeof Engine.System.getProfile === 'function')
                ? Engine.System.getProfile()
                : null;
            const dpr = Number(root.devicePixelRatio) || 1;

            const report = {
                version: Engine.VERSION,
                probedAt: Date.now(),
                mode: pageMode(),
                reducedMotion: prefersReducedMotion(),
                crossOriginIsolated: !!root.crossOriginIsolated,
                sharedArrayBuffer: typeof root.SharedArrayBuffer === 'function',
                worker: typeof root.Worker === 'function',
                atomics: typeof root.Atomics === 'object' && !!root.Atomics,
                hardwareConcurrency: Number(root.navigator && root.navigator.hardwareConcurrency) || 0,
                deviceMemory: Number(root.navigator && root.navigator.deviceMemory) || 0,
                deviceProfile,
                checks: {
                    document: !!document,
                    canvas: !!canvas,
                    canvas2d,
                    raf: typeof root.requestAnimationFrame === 'function',
                    performanceNow: !!(root.performance && typeof root.performance.now === 'function'),
                    localStorage: localStorageOk,
                    audioContext: typeof AudioCtx === 'function',
                    serviceWorker: !!(root.navigator && root.navigator.serviceWorker),
                    highDpr: dpr > 1,
                    dprMissing: !(Number(root.devicePixelRatio) > 0),
                    missingNamespaces,
                    useDomUi: !!(Engine.Shell && Engine.Shell.getFlag && Engine.Shell.getFlag('USE_DOM_UI'))
                },
                canvasId,
                canvas
            };
            this._lastReport = report;
            return report;
        },

        verify(report = this._lastReport || this.probe()) {
            const verdict = classify(report);
            return {
                ok: verdict.status !== 'fatal',
                status: verdict.status,
                fatal: verdict.fatal,
                warnings: verdict.warnings,
                report
            };
        },

        initialize(options = {}) {
            if (this.runtime && options.force !== true) return this.runtime;
            if (this._initializing) {
                throw new Error('Engine.Boot.initialize is already in progress.');
            }
            this._initializing = true;
            const startedAt = now();
            const warnings = [];
            const diagnostics = [];

            try {
                const report = this.probe(options);
                let verdict = this.verify(report);

                // Soft storage failure is degraded: Engine.Save already falls back to memory.
                if (!report.checks.localStorage) {
                    warnings.push('Persistent storage unavailable; using memory save fallback.');
                    report.checks.storageFallback = 'memory';
                    if (Engine.Save && typeof Engine.Save.storage === 'function') {
                        try {
                            Engine.Save.storage().getItem('__shape_engine_boot_storage__');
                        } catch (error) {
                            diagnostics.push(`Memory save fallback failed: ${error && error.message ? error.message : error}`);
                        }
                    }
                }

                if (verdict.status === 'fatal') {
                    const fatalRuntime = Object.freeze({
                        version: Engine.VERSION,
                        status: 'fatal',
                        ok: false,
                        fatal: verdict.fatal.slice(),
                        warnings: warnings.concat(verdict.warnings),
                        diagnostics,
                        report,
                        elapsedMs: now() - startedAt
                    });
                    this.runtime = fatalRuntime;
                    return fatalRuntime;
                }

                warnings.push(...verdict.warnings.filter(item => !warnings.includes(item)));

                const document = resolveDocument();
                const canvas = report.canvas;
                if (!canvas) throw new Error('Canvas element is required for engine boot.');

                let uiRoot = null;
                if (Engine.UI && Engine.UI.Root && typeof Engine.UI.Root.ensure === 'function') {
                    uiRoot = Engine.UI.Root.ensure();
                }

                const logicalW = Math.max(1, Number(options.logicalW) || canvas.clientWidth || 1280);
                const logicalH = Math.max(1, Number(options.logicalH) || canvas.clientHeight || 720);
                const dprCap = Math.max(0.25, Number(options.dprCap) || 2);
                let configured = null;
                if (Engine.Render && typeof Engine.Render.configureCanvas === 'function') {
                    configured = Engine.Render.configureCanvas(canvas, { logicalW, logicalH, dprCap });
                } else {
                    const ctx = canvas.getContext('2d');
                    if (!ctx) throw new Error('Canvas2D context acquisition failed.');
                    configured = { canvas, ctx, dpr: 1, logicalW, logicalH, pixelWidth: logicalW, pixelHeight: logicalH };
                }

                // Exercise canvas pool allocate/release so pooled surfaces are warm.
                let poolOk = false;
                if (Engine.Graphics && Engine.Graphics.CanvasPool) {
                    const pool = Engine.Graphics.CanvasPool;
                    const sample = pool.acquire(32, 32);
                    const sampleCtx = sample.getContext('2d');
                    if (sampleCtx) {
                        sampleCtx.clearRect(0, 0, 32, 32);
                        sampleCtx.fillStyle = '#112233';
                        sampleCtx.fillRect(0, 0, 8, 8);
                        poolOk = true;
                    }
                    pool.release(sample);
                } else {
                    warnings.push('Canvas pool unavailable; boot continued without pool warm-up.');
                }

                if (Engine.Shell) {
                    if (typeof Engine.Shell.ensureFlag === 'function') {
                        Engine.Shell.ensureFlag('USE_DOM_UI', true);
                    }
                    if (typeof Engine.Shell.installBackNavigationGuard === 'function') {
                        Engine.Shell.installBackNavigationGuard();
                    }
                }

                // Validate save storage read path without mutating game schemas.
                if (Engine.Save && typeof Engine.Save.storage === 'function') {
                    const storage = Engine.Save.storage();
                    storage.getItem('__shape_engine_boot_ready__');
                }

                const status = warnings.length ? 'degraded' : 'ready';
                const runtime = Object.freeze({
                    version: Engine.VERSION,
                    status,
                    ok: true,
                    fatal: [],
                    warnings: warnings.slice(),
                    diagnostics: diagnostics.slice(),
                    report,
                    canvas: configured.canvas,
                    ctx: configured.ctx,
                    dpr: configured.dpr,
                    logicalW: configured.logicalW,
                    logicalH: configured.logicalH,
                    pixelWidth: configured.pixelWidth,
                    pixelHeight: configured.pixelHeight,
                    uiRoot,
                    poolWarmed: poolOk,
                    reducedMotion: !!report.reducedMotion,
                    elapsedMs: now() - startedAt,
                    createCore(hooks) {
                        if (!Engine.Core) throw new Error('Engine.Core is unavailable.');
                        return new Engine.Core(hooks || {});
                    }
                });
                this.runtime = runtime;
                return runtime;
            } finally {
                this._initializing = false;
            }
        },

        async start(options = {}) {
            const screen = Engine.UI && Engine.UI.BootScreen ? Engine.UI.BootScreen : null;
            // Hold the brand long enough to actually read it before the status
            // phase can hand off. The sequence is not skippable.
            const minBrandMs = Number.isFinite(options.minBrandMs) ? options.minBrandMs : 2200;
            const autoAdvanceMs = Number.isFinite(options.autoAdvanceMs) ? options.autoAdvanceMs : 4200;
            const brandStarted = now();

            if (screen && typeof screen.show === 'function') {
                screen.show({ version: Engine.VERSION });
                if (typeof screen.showBrand === 'function') screen.showBrand(Engine.VERSION);
                if (typeof screen.startInitializing === 'function') screen.startInitializing();
                else if (typeof screen.setStatus === 'function') screen.setStatus('Initializing…');
            }

            let runtime = null;
            try {
                runtime = this.initialize(Object.assign({}, options, { force: !!options.force }));
            } catch (error) {
                // One degraded retry before declaring fatal.
                try {
                    if (Engine.Save) Engine.Save._storage = null;
                    runtime = this.initialize(Object.assign({}, options, { force: true }));
                    if (runtime && runtime.ok) {
                        runtime = Object.freeze(Object.assign({}, runtime, {
                            status: 'degraded',
                            warnings: (runtime.warnings || []).concat(['Recovered via degraded boot fallback.'])
                        }));
                        this.runtime = runtime;
                    }
                } catch (fallbackError) {
                    runtime = Object.freeze({
                        version: Engine.VERSION,
                        status: 'fatal',
                        ok: false,
                        fatal: [
                            error && error.message ? error.message : String(error),
                            fallbackError && fallbackError.message ? fallbackError.message : String(fallbackError)
                        ],
                        warnings: [],
                        diagnostics: [],
                        report: this._lastReport,
                        elapsedMs: now() - brandStarted
                    });
                    this.runtime = runtime;
                }
            }

            if (!runtime || !runtime.ok) {
                if (screen && typeof screen.showError === 'function') {
                    await screen.showError(runtime || { fatal: ['Unknown boot failure.'] }, {
                        onRetry: () => this.start(Object.assign({}, options, { force: true })),
                        onReload: () => {
                            if (root.location && typeof root.location.reload === 'function') {
                                root.location.reload();
                            }
                        }
                    });
                    // showError resolves only after a successful retry path returns runtime
                    return this.runtime;
                }
                throw new Error((runtime && runtime.fatal && runtime.fatal[0]) || 'Engine boot failed.');
            }

            const reduced = !!(runtime.reducedMotion || prefersReducedMotion());
            const timer = root.setTimeout || setTimeout;

            // Initialization usually finishes in milliseconds; hold the reveal so
            // the sequence still reads brand -> Initializing… -> Ready.
            const statusRevealMs = Number.isFinite(options.statusRevealMs) ? options.statusRevealMs : 2600;
            const revealHold = reduced ? 0 : Math.max(0, statusRevealMs - (now() - brandStarted));
            if (revealHold > 0) {
                await new Promise(resolve => timer(resolve, revealHold));
            }

            if (screen) {
                if (runtime.status === 'degraded' && typeof screen.showDegraded === 'function') {
                    screen.showDegraded(runtime);
                } else if (typeof screen.showReady === 'function') {
                    screen.showReady(runtime);
                } else if (typeof screen.setStatus === 'function') {
                    screen.setStatus('Ready');
                }
            }

            const readyAt = now();
            const brandElapsed = readyAt - brandStarted;
            const minWaitMs = reduced ? 0 : Math.max(0, minBrandMs - brandElapsed);
            const autoMs = reduced
                ? Math.max(600, Math.min(1200, autoAdvanceMs * 0.35))
                : Math.max(0, autoAdvanceMs - brandElapsed);

            if (screen && typeof screen.waitForAdvance === 'function') {
                await screen.waitForAdvance({
                    minWaitMs,
                    autoAdvanceMs: autoMs
                });
            } else {
                const wait = Math.max(minWaitMs, autoMs);
                await new Promise(resolve => {
                    const timer = root.setTimeout || setTimeout;
                    timer(resolve, wait);
                });
            }

            // The cover stays up in its frozen "READY" state. The application
            // boots underneath and reports back via Engine.Boot.handoff();
            // only then does the engine run the final reveal. The engine owns
            // the guarantee that a half-initialized app is never visible.
            return this.runtime;
        },

        /**
         * Application-ready handoff. Called by the app once it is fully
         * initialized and rendering beneath the cover. Waits a couple of
         * painted frames so the reveal lands on real content, then fades and
         * purges the boot state completely. Idempotent.
         */
        handoff(options = {}) {
            if (this._handoffPromise) return this._handoffPromise;
            const screen = Engine.UI && Engine.UI.BootScreen ? Engine.UI.BootScreen : null;
            const timer = root.setTimeout || setTimeout;
            const frames = Math.max(0, Number.isFinite(options.afterFrames) ? options.afterFrames : 2);

            const nextFrame = () => new Promise(resolve => {
                // rAF is throttled or paused in background tabs; the timeout
                // fallback keeps the handoff from stalling there.
                let settled = false;
                const settle = () => {
                    if (settled) return;
                    settled = true;
                    resolve();
                };
                if (typeof root.requestAnimationFrame === 'function') {
                    root.requestAnimationFrame(settle);
                }
                timer(settle, 250);
            });

            this._handoffPromise = (async () => {
                for (let i = 0; i < frames; i++) {
                    await nextFrame();
                }
                if (!screen) return this.runtime;
                if (typeof screen.hide === 'function') screen.hide();
                if (!prefersReducedMotion()) {
                    const exitMs = Number(screen.EXIT_FADE_MS) || 700;
                    await new Promise(resolve => timer(resolve, exitMs + 50));
                }
                if (typeof screen.cleanup === 'function') screen.cleanup();
                return this.runtime;
            })();
            return this._handoffPromise;
        },

        resetForTests() {
            this.runtime = null;
            this._lastReport = null;
            this._initializing = false;
            this._handoffPromise = null;
            if (Engine.Save) Engine.Save._storage = null;
        }
    };

    Engine.Boot = Boot;

    // Mount the boot cover at parse time, before any application scripts run.
    // Application UI mounts on DOMContentLoaded, so the cover must already be
    // in the DOM by then — otherwise the first painted frames flash the raw
    // page (unsized canvas, application chrome) before start() is called.
    if (root.document && Engine.UI && Engine.UI.BootScreen) {
        try {
            Engine.UI.BootScreen.show({ version: Engine.VERSION });
        } catch (_) {
            // Headless or partial DOM environments boot without the cover.
        }
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = Boot;
    }
})(typeof window !== 'undefined' ? window : globalThis);
