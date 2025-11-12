(function (global) {
    const root = global || {};

    class TelegraphState {
        constructor(type, options = {}) {
            this.type = type;
            this.duration = Math.max(0.05, options.duration || 0.6);
            this.intensity = options.intensity !== undefined ? options.intensity : 1.0;
            this.color = options.color || null;
            this.sound = options.sound || null;
            this.screenShake = options.screenShake || false;
            this.projectRadius = options.projectRadius !== undefined ? options.projectRadius : null;
            this.metadata = options.metadata || null;
            this.startTime = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
            this.elapsed = 0;
            this.progress = 0;
        }

        update(deltaTime) {
            this.elapsed += deltaTime;
            if (this.duration <= 0) {
                this.progress = 1;
            } else {
                this.progress = Math.min(1, this.elapsed / this.duration);
            }
            return this.progress >= 1;
        }

        serialize() {
            return {
                type: this.type,
                progress: this.progress || 0,
                duration: this.duration,
                intensity: this.intensity,
                projectRadius: this.projectRadius,
                color: this.color
            };
        }
    }

    class RecoveryWindow {
        constructor(options = {}) {
            this.duration = Math.max(0.05, options.duration || 0.4);
            this.elapsed = 0;
            this.vulnerability = options.vulnerability || 'standard';
            this.modifier = options.modifier !== undefined ? options.modifier : 1.0;
            this.metadata = options.metadata || null;
            this.onEnter = typeof options.onEnter === 'function' ? options.onEnter : null;
            this.onExit = typeof options.onExit === 'function' ? options.onExit : null;
        }

        update(deltaTime) {
            this.elapsed += deltaTime;
            return this.elapsed >= this.duration;
        }

        serialize() {
            return {
                duration: this.duration,
                elapsed: this.elapsed,
                vulnerability: this.vulnerability,
                modifier: this.modifier
            };
        }
    }

    class TelegraphManager {
        constructor(owner) {
            if (!owner) {
                throw new Error('TelegraphManager requires an owner reference.');
            }
            this.owner = owner;
            this.activeTelegraph = null;
            this.queue = [];
            this.recoveryWindow = null;
        }

        _invokeCallback(cb, telegraph, cancelled = false) {
            if (typeof cb === 'function') {
                cb(telegraph, this.owner, cancelled);
            }
        }

        begin(type, options = {}) {
            const telegraph = new TelegraphState(type, options);
            this.activeTelegraph = telegraph;
            this.owner.activeTelegraph = telegraph;

            if (options.sound && typeof AudioManager !== 'undefined' && AudioManager.sounds) {
                const sound = AudioManager.sounds[options.sound];
                if (typeof sound === 'function') {
                    sound();
                }
            }

            this._invokeCallback(options.onStart, telegraph, false);
            if (this.owner.telegraphCallbacks && typeof this.owner.telegraphCallbacks.onStart === 'function') {
                this.owner.telegraphCallbacks.onStart(telegraph, this.owner);
            }

            return telegraph;
        }

        queueTelegraph(type, options = {}) {
            this.queue.push({ type, options });
        }

        end(currentOptions = {}) {
            if (!this.activeTelegraph) return;
            const finished = this.activeTelegraph;
            this.activeTelegraph = null;
            this.owner.activeTelegraph = null;

            this._invokeCallback(currentOptions.onEnd, finished, false);
            if (this.owner.telegraphCallbacks && typeof this.owner.telegraphCallbacks.onEnd === 'function') {
                this.owner.telegraphCallbacks.onEnd(finished, this.owner);
            }
        }

        cancel(currentOptions = {}) {
            if (!this.activeTelegraph) return;
            const cancelled = this.activeTelegraph;
            this.activeTelegraph = null;
            this.owner.activeTelegraph = null;

            this._invokeCallback(currentOptions.onEnd, cancelled, true);
            if (this.owner.telegraphCallbacks && typeof this.owner.telegraphCallbacks.onEnd === 'function') {
                this.owner.telegraphCallbacks.onEnd(cancelled, this.owner);
            }
        }

        update(deltaTime) {
            if (this.activeTelegraph) {
                const completed = this.activeTelegraph.update(deltaTime);
                if (completed) {
                    this.end();
                    if (this.queue.length > 0) {
                        const next = this.queue.shift();
                        this.begin(next.type, next.options || {});
                    }
                }
            } else if (this.queue.length > 0) {
                const next = this.queue.shift();
                this.begin(next.type, next.options || {});
            }
        }

        enterRecovery(options = {}) {
            const recovery = new RecoveryWindow(options);
            this.recoveryWindow = recovery;
            this.owner.recoveryWindow = recovery;

            if (recovery.onEnter) {
                recovery.onEnter(recovery, this.owner);
            }

            return recovery;
        }

        cancelRecovery(cancelled = true) {
            if (!this.recoveryWindow) return;
            const window = this.recoveryWindow;
            this.recoveryWindow = null;
            this.owner.recoveryWindow = null;

            if (window.onExit) {
                window.onExit(window, this.owner, cancelled);
            }
        }

        updateRecovery(deltaTime) {
            if (!this.recoveryWindow) return;
            const expired = this.recoveryWindow.update(deltaTime);
            if (expired) {
                const window = this.recoveryWindow;
                this.recoveryWindow = null;
                this.owner.recoveryWindow = null;
                if (window.onExit) {
                    window.onExit(window, this.owner, false);
                }
            }
        }

        serializeState() {
            return {
                telegraph: this.activeTelegraph ? this.activeTelegraph.serialize() : null,
                recoveryWindow: this.recoveryWindow ? this.recoveryWindow.serialize() : null
            };
        }

        applyState(state) {
            if (state && state.telegraph) {
                const telegraphState = state.telegraph;
                const telegraph = new TelegraphState(telegraphState.type, {
                    duration: telegraphState.duration,
                    intensity: telegraphState.intensity,
                    color: telegraphState.color,
                    projectRadius: telegraphState.projectRadius
                });
                telegraph.elapsed = telegraphState.duration * (telegraphState.progress || 0);
                telegraph.progress = telegraphState.progress || 0;
                this.activeTelegraph = telegraph;
                this.owner.activeTelegraph = telegraph;
            } else {
                this.activeTelegraph = null;
                this.owner.activeTelegraph = null;
            }

            if (state && state.recoveryWindow) {
                const recoveryState = state.recoveryWindow;
                const recovery = new RecoveryWindow({
                    duration: recoveryState.duration,
                    vulnerability: recoveryState.vulnerability,
                    modifier: recoveryState.modifier
                });
                recovery.elapsed = recoveryState.elapsed || 0;
                this.recoveryWindow = recovery;
                this.owner.recoveryWindow = recovery;
            } else {
                this.recoveryWindow = null;
                this.owner.recoveryWindow = null;
            }
        }
    }

    const apiRoot = root.TelegraphSystem || (root.TelegraphSystem = {});
    apiRoot.TelegraphManager = TelegraphManager;
    apiRoot.TelegraphState = TelegraphState;
    apiRoot.RecoveryWindow = RecoveryWindow;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));

