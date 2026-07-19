/**
 * Engine-owned two-part boot intro: brand reveal, then init status / fatal controls.
 * The sequence is not skippable — the full branding + verification always runs.
 */
(function(root) {
    const Engine = root.Engine = root.Engine || {};
    const UI = Engine.UI = Engine.UI || {};

    function documentRef() {
        return root.document || null;
    }

    function prefersReducedMotion() {
        try {
            return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
        } catch (_) {
            return false;
        }
    }

    function clearTimer(id) {
        if (id == null) return;
        const clearer = root.clearTimeout || clearTimeout;
        clearer(id);
    }

    // Keep in sync with the exit transition duration in the boot-screen CSS.
    const EXIT_FADE_MS = 700;

    const BootScreen = {
        EXIT_FADE_MS,
        layer: null,
        statusEl: null,
        brandEl: null,
        titleEl: null,
        versionEl: null,
        actionsEl: null,
        stageEl: null,
        scanlineEl: null,
        _cinematic: null,
        _scanStopHandler: null,
        _advanceWait: null,
        _autoTimer: null,
        _exitTimer: null,
        _diagnosticTimer: null,
        _errorWait: null,

        show(options = {}) {
            const document = documentRef();
            if (!document) return null;
            if (this.layer) {
                clearTimer(this._exitTimer);
                this._exitTimer = null;
                this.layer.hidden = false;
                this.layer.classList.remove('engine-boot-screen--exiting');
                this.layer.setAttribute('aria-hidden', 'false');
                return this.layer;
            }

            const parent = (UI.Root && typeof UI.Root.ensure === 'function')
                ? UI.Root.ensure()
                : document.body;

            const layer = document.createElement('div');
            layer.className = 'engine-boot-screen';
            layer.setAttribute('role', 'status');
            layer.setAttribute('aria-live', 'polite');
            layer.setAttribute('aria-hidden', 'false');
            if (prefersReducedMotion()) layer.classList.add('engine-boot-screen--reduced');

            layer.innerHTML = [
                '<canvas class="engine-boot-screen__stage" data-boot-stage></canvas>',
                '<div class="engine-boot-screen__scanline" data-boot-scanline></div>',
                '<div class="engine-boot-screen__panel">',
                '  <div class="engine-boot-screen__brand" data-boot-brand>Powered by</div>',
                '  <div class="engine-boot-screen__title" data-boot-title>Shape Engine</div>',
                '  <div class="engine-boot-screen__version" data-boot-version></div>',
                '  <div class="engine-boot-screen__rule"></div>',
                '  <div class="engine-boot-screen__shapes">',
                '    <span class="engine-boot-screen__shape engine-boot-screen__shape--square"></span>',
                '    <span class="engine-boot-screen__shape engine-boot-screen__shape--triangle"></span>',
                '    <span class="engine-boot-screen__shape engine-boot-screen__shape--pentagon"></span>',
                '    <span class="engine-boot-screen__shape engine-boot-screen__shape--hexagon"></span>',
                '  </div>',
                '  <div class="engine-boot-screen__status" data-boot-status>Initializing…</div>',
                '  <div class="engine-boot-screen__actions" data-boot-actions hidden></div>',
                '</div>'
            ].join('');

            parent.appendChild(layer);
            this.layer = layer;
            this.brandEl = layer.querySelector('[data-boot-brand]');
            this.titleEl = layer.querySelector('[data-boot-title]');
            this.versionEl = layer.querySelector('[data-boot-version]');
            this.statusEl = layer.querySelector('[data-boot-status]');
            this.actionsEl = layer.querySelector('[data-boot-actions]');
            this.stageEl = layer.querySelector('[data-boot-stage]');
            this.scanlineEl = layer.querySelector('[data-boot-scanline]');

            if (options.version) this.showBrand(options.version);
            return layer;
        },

        showBrand(version) {
            this.show();
            if (this.brandEl) this.brandEl.textContent = 'Powered by';
            if (this.titleEl) this.titleEl.textContent = 'Shape Engine';
            if (this.versionEl) this.versionEl.textContent = version ? `v${version}` : '';
            if (this.layer) {
                this.layer.classList.remove(
                    'engine-boot-screen--ready',
                    'engine-boot-screen--error',
                    'engine-boot-screen--scan-done'
                );
                this.layer.classList.add('engine-boot-screen--brand');
            }
            if (this._scanStopHandler && this.scanlineEl
                && typeof this.scanlineEl.removeEventListener === 'function') {
                this.scanlineEl.removeEventListener('animationiteration', this._scanStopHandler);
                this._scanStopHandler = null;
            }
            if (this.actionsEl) {
                this.actionsEl.hidden = true;
                this.actionsEl.innerHTML = '';
            }
            this.startCinematic(version);
            return this;
        },

        /**
         * Run the engine-primitive cinematic on the stage canvas. The DOM
         * panel stays mounted (visually hidden) as the accessible narration
         * and as the fallback whenever the cinematic cannot run.
         */
        startCinematic(version) {
            if (this._cinematic) return this._cinematic;
            if (prefersReducedMotion()) return null;
            const cinema = UI.BootCinematic;
            if (!cinema
                || typeof cinema.start !== 'function'
                || (typeof cinema.supported === 'function' && !cinema.supported())
                || !this.stageEl) {
                return null;
            }
            let controller = null;
            try {
                controller = cinema.start({ canvas: this.stageEl, version });
            } catch (_) {
                controller = null;
            }
            if (controller) {
                this._cinematic = controller;
                if (this.layer) this.layer.classList.add('engine-boot-screen--cinematic');
            }
            return controller;
        },

        stopCinematic() {
            if (this._cinematic) {
                try {
                    this._cinematic.stop();
                } catch (_) {
                    // Stage teardown failures must never block boot flow.
                }
                this._cinematic = null;
            }
            if (this.layer) this.layer.classList.remove('engine-boot-screen--cinematic');
            return this;
        },

        setStatus(text) {
            this.show();
            if (this.statusEl) this.statusEl.textContent = text || '';
            return this;
        },

        startInitializing() {
            this.stopInitializing();
            const frames = ['Initializing', 'Initializing·', 'Initializing··', 'Initializing···'];
            let frame = 0;
            this.setStatus(frames[frame]);
            const timer = root.setInterval || setInterval;
            this._diagnosticTimer = timer(() => {
                frame = (frame + 1) % frames.length;
                if (this.statusEl) this.statusEl.textContent = frames[frame];
            }, 320);
            return this;
        },

        stopInitializing() {
            if (this._diagnosticTimer == null) return this;
            const clearer = root.clearInterval || clearInterval;
            clearer(this._diagnosticTimer);
            this._diagnosticTimer = null;
            return this;
        },

        /**
         * Let the read/write sweep complete the pass it is on, then stop at
         * the cycle boundary — the final reveal must never cut the line off
         * mid-screen.
         */
        finishScanCycle() {
            const el = this.scanlineEl;
            if (!el || !this.layer) return this;
            if (this._scanStopHandler) return this;
            if (this.layer.classList.contains('engine-boot-screen--scan-done')) return this;

            const done = () => {
                if (this._scanStopHandler && typeof el.removeEventListener === 'function') {
                    el.removeEventListener('animationiteration', this._scanStopHandler);
                }
                this._scanStopHandler = null;
                if (this.layer) this.layer.classList.add('engine-boot-screen--scan-done');
            };

            // Reduced motion never animates the line, and environments without
            // animation events just stop immediately.
            if (prefersReducedMotion() || typeof el.addEventListener !== 'function') {
                done();
                return this;
            }
            this._scanStopHandler = done;
            el.addEventListener('animationiteration', done);
            return this;
        },

        stopScanNow() {
            if (this._scanStopHandler && this.scanlineEl
                && typeof this.scanlineEl.removeEventListener === 'function') {
                this.scanlineEl.removeEventListener('animationiteration', this._scanStopHandler);
            }
            this._scanStopHandler = null;
            if (this.layer) this.layer.classList.add('engine-boot-screen--scan-done');
            return this;
        },

        /** Compact capability dump shown with the frozen READY state. */
        _bootSummary(runtime) {
            const checks = runtime && runtime.report && runtime.report.checks
                ? runtime.report.checks
                : null;
            if (!checks) return '';
            const flag = ok => (ok ? 'OK' : '--');
            return [
                `CANVAS2D ${flag(checks.canvas2d)}`,
                `STORAGE ${flag(checks.localStorage)}`,
                `AUDIO ${flag(checks.audioContext)}`,
                `SW ${flag(checks.serviceWorker)}`,
                `DPR ${checks.highDpr ? '2X' : '1X'}`
            ].join(' · ');
        },

        showReady(runtime) {
            this.show();
            this.stopInitializing();
            if (this.layer) {
                this.layer.classList.add('engine-boot-screen--ready');
                this.layer.classList.remove('engine-boot-screen--error');
            }
            this.setStatus('Ready');
            this.finishScanCycle();
            if (this._cinematic && typeof this._cinematic.ready === 'function') {
                this._cinematic.ready('', this._bootSummary(runtime));
            }
            if (this.actionsEl) {
                this.actionsEl.hidden = true;
                this.actionsEl.innerHTML = '';
            }
            return this;
        },

        showDegraded(runtime) {
            this.show();
            this.stopInitializing();
            if (this.layer) {
                this.layer.classList.add('engine-boot-screen--ready');
                this.layer.classList.remove('engine-boot-screen--error');
            }
            const warning = runtime && Array.isArray(runtime.warnings) && runtime.warnings[0]
                ? runtime.warnings[0]
                : 'Running with limited capabilities.';
            this.setStatus(`Ready — ${warning}`);
            this.finishScanCycle();
            if (this._cinematic && typeof this._cinematic.ready === 'function') {
                this._cinematic.ready(warning, this._bootSummary(runtime));
            }
            if (this.actionsEl) {
                this.actionsEl.hidden = true;
                this.actionsEl.innerHTML = '';
            }
            return this;
        },

        waitForAdvance(options = {}) {
            const minWaitMs = Math.max(0, Number(options.minWaitMs) || 0);
            const autoAdvanceMs = Math.max(0, Number(options.autoAdvanceMs) || 0);

            this._cancelAdvanceWait();

            return new Promise(resolve => {
                const finish = (reason) => {
                    if (!this._advanceWait) return;
                    this._advanceWait = null;
                    clearTimer(this._autoTimer);
                    this._autoTimer = null;
                    resolve(reason || 'auto');
                };

                this._advanceWait = { resolve: finish };
                const timer = root.setTimeout || setTimeout;
                this._autoTimer = timer(() => finish('auto'), Math.max(minWaitMs, autoAdvanceMs));
            });
        },

        _cancelAdvanceWait() {
            if (this._advanceWait && typeof this._advanceWait.resolve === 'function') {
                const resolve = this._advanceWait.resolve;
                this._advanceWait = null;
                clearTimer(this._autoTimer);
                this._autoTimer = null;
                resolve('cancel');
            } else {
                clearTimer(this._autoTimer);
                this._autoTimer = null;
            }
        },

        showError(runtime, handlers = {}) {
            this.show();
            this.stopInitializing();
            this.stopScanNow();
            // Fatal states fall back to the DOM panel so the retry/reload
            // controls are real focusable buttons.
            this.stopCinematic();
            this._cancelAdvanceWait();
            if (this.layer) {
                this.layer.classList.add('engine-boot-screen--error');
                this.layer.classList.remove('engine-boot-screen--ready', 'engine-boot-screen--brand');
            }

            const fatal = (runtime && runtime.fatal) || ['Engine initialization failed.'];
            const details = fatal.filter(Boolean).join(' ');
            this.setStatus(`Unable to start. ${details}`);

            const document = documentRef();
            if (!this.actionsEl || !document) {
                return Promise.reject(new Error(details || 'Engine initialization failed.'));
            }

            this.actionsEl.hidden = false;
            this.actionsEl.innerHTML = '';

            const retryBtn = document.createElement('button');
            retryBtn.type = 'button';
            retryBtn.className = 'engine-boot-screen__button';
            retryBtn.textContent = 'Retry';

            const reloadBtn = document.createElement('button');
            reloadBtn.type = 'button';
            reloadBtn.className = 'engine-boot-screen__button engine-boot-screen__button--secondary';
            reloadBtn.textContent = 'Reload';

            this.actionsEl.appendChild(retryBtn);
            this.actionsEl.appendChild(reloadBtn);

            if (this._errorWait && typeof this._errorWait.reject === 'function') {
                this._errorWait.reject(new Error('Boot error UI replaced.'));
            }

            return new Promise((resolve, reject) => {
                this._errorWait = { resolve, reject };

                retryBtn.addEventListener('click', async () => {
                    retryBtn.disabled = true;
                    reloadBtn.disabled = true;
                    this.setStatus('Retrying…');
                    try {
                        const result = typeof handlers.onRetry === 'function'
                            ? await handlers.onRetry()
                            : null;
                        this._errorWait = null;
                        resolve(result);
                    } catch (error) {
                        retryBtn.disabled = false;
                        reloadBtn.disabled = false;
                        this.setStatus(`Unable to start. ${error && error.message ? error.message : error}`);
                    }
                });

                reloadBtn.addEventListener('click', () => {
                    if (typeof handlers.onReload === 'function') handlers.onReload();
                    else if (root.location && typeof root.location.reload === 'function') {
                        root.location.reload();
                    }
                });
            });
        },

        hide(options = {}) {
            this._cancelAdvanceWait();
            if (this._errorWait) {
                this._errorWait = null;
            }
            if (!this.layer) return this;
            this.layer.setAttribute('aria-hidden', 'true');

            const immediate = options.immediate === true || prefersReducedMotion();
            if (immediate) {
                this.stopCinematic();
                this.layer.hidden = true;
                return this;
            }

            // Fade out over the title underneath so the handoff reads as a
            // crossfade rather than a hard cut.
            this.layer.classList.add('engine-boot-screen--exiting');
            clearTimer(this._exitTimer);
            const timer = root.setTimeout || setTimeout;
            this._exitTimer = timer(() => {
                this._exitTimer = null;
                if (this.layer) {
                    this.layer.hidden = true;
                    this.layer.classList.remove('engine-boot-screen--exiting');
                }
                this.stopCinematic();
            }, EXIT_FADE_MS);
            return this;
        },

        cleanup() {
            this.stopInitializing();
            this.stopCinematic();
            this._scanStopHandler = null;
            this.hide({ immediate: true });
            clearTimer(this._exitTimer);
            this._exitTimer = null;
            if (this.layer && this.layer.parentNode) {
                this.layer.parentNode.removeChild(this.layer);
            }
            this.layer = null;
            this.statusEl = null;
            this.brandEl = null;
            this.titleEl = null;
            this.versionEl = null;
            this.actionsEl = null;
            this.stageEl = null;
            this.scanlineEl = null;
            return this;
        }
    };

    UI.BootScreen = BootScreen;
    root.EngineBootScreen = BootScreen;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = BootScreen;
    }
})(typeof window !== 'undefined' ? window : globalThis);
