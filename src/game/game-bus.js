/**
 * GameBus — discrete state-transition pub/sub for Island rules.
 *
 * HAZARDS (enforced by contract, not by runtime policing):
 * 1. Discrete events only (kill / clear / death / exit / per-hit damage).
 *    Never emit per-tick DoT — that causes GC stutter in AoE bullet-hell fights.
 *    combat:enemyDamaged is per discrete hit; status ticks must set enemy._damageCause='status'.
 * 2. emit() is synchronous: listeners run on the same call stack before the
 *    emitter continues, so modes can halt the session before the next line.
 * 3. Prefer subscribe()/attach handles that return a single teardown — PlayingHost
 *    must run teardown on Island end to prevent zombie XP / conflicting rules.
 */
(function (root) {
    'use strict';

    /** @typedef {function(any): void} GameBusHandler */

	const DISCRETE_EVENTS = Object.freeze([
        'combat:enemyKilled',
        'combat:enemyDamaged',
        'combat:bossThresholdReached',
        'combat:playerDamaged',
        'combat:playerDied',
        'rooms:cleared',
        'rooms:doorReady',
        'run:exitRequested',
        'combo:tierChanged',
        'combo:countChanged',
        'combo:bleedApplied',
        'combo:styleRecovered',
        'combo:styleCrashed',
        'combo:varietyBonus',
        'combo:apexPulse'
    ]);

    class GameBusImpl {
        constructor() {
            /** @type {Map<string, Set<GameBusHandler>>} */
            this.listeners = new Map();
            /** @type {Map<string, Array<GameBusHandler>>} */
            this.bakedListeners = new Map();
        }

        _rebake(eventName) {
            const set = this.listeners.get(eventName);
            if (!set || set.size === 0) {
                this.bakedListeners.delete(eventName);
            } else {
                this.bakedListeners.set(eventName, Array.from(set));
            }
        }

        /**
         * @param {string} eventName
         * @param {GameBusHandler} handler
         * @returns {function(): boolean} Unsubscribe for this handler
         */
        on(eventName, handler) {
            if (typeof handler !== 'function') {
                throw new TypeError('GameBus handler must be a function.');
            }
            if (!this.listeners.has(eventName)) {
                this.listeners.set(eventName, new Set());
            }
            this.listeners.get(eventName).add(handler);
            this._rebake(eventName);
            return () => this.off(eventName, handler);
        }

        once(eventName, handler) {
            const unsubscribe = this.on(eventName, (detail) => {
                unsubscribe();
                handler(detail);
            });
            return unsubscribe;
        }

        off(eventName, handler) {
            if (!this.listeners.has(eventName)) return false;
            if (!handler) {
                const res = this.listeners.delete(eventName);
                this._rebake(eventName);
                return res;
            }
            const removed = this.listeners.get(eventName).delete(handler);
            if (this.listeners.get(eventName).size === 0) {
                this.listeners.delete(eventName);
            }
            this._rebake(eventName);
            return removed;
        }

        /**
         * Synchronous dispatch — handlers run immediately in registration order.
         * @returns {number} Handlers invoked
         */
        emit(eventName, detail) {
            const handlers = this.bakedListeners.get(eventName);
            if (!handlers || handlers.length === 0) return 0;
            let count = 0;
            for (let i = 0; i < handlers.length; i++) {
                try {
                    handlers[i](detail);
                } catch (error) {
                    if (root.console && typeof root.console.error === 'function') {
                        root.console.error('[GameBus] handler error for', eventName, error);
                    }
                }
                count++;
            }
            return count;
        }

        /**
         * Subscribe many events; returns one teardown that removes all of them.
         * @param {Object.<string, GameBusHandler>} handlerMap
         * @returns {function(): void}
         */
        subscribe(handlerMap) {
            const unsubs = [];
            if (handlerMap && typeof handlerMap === 'object') {
                for (const eventName of Object.keys(handlerMap)) {
                    const handler = handlerMap[eventName];
                    if (typeof handler === 'function') {
                        unsubs.push(this.on(eventName, handler));
                    }
                }
            }
            let tornDown = false;
            return function teardown() {
                if (tornDown) return;
                tornDown = true;
                for (let i = 0; i < unsubs.length; i++) {
                    try { unsubs[i](); } catch (_) { /* ignore */ }
                }
            };
        }

        clear() {
            this.listeners.clear();
            this.bakedListeners.clear();
        }

        listenerCount(eventName) {
            const set = this.listeners.get(eventName);
            return set ? set.size : 0;
        }
    }

    const bus = new GameBusImpl();

    root.GameBus = bus;
    root.GameBusClass = GameBusImpl;
    root.GameBusEvents = DISCRETE_EVENTS;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { GameBus: bus, GameBusClass: GameBusImpl, GameBusEvents: DISCRETE_EVENTS };
    }
})(typeof globalThis !== 'undefined' ? globalThis : window);
