(function(root) {
    const Engine = root.Engine = root.Engine || {};
    const UI = Engine.UI = Engine.UI || {};

    /**
     * @typedef {function(any): void} EventHandlerFn
     */

    /**
     * Engine UI decoupled EventBus for pub/sub event routing.
     */
    class EventBus {
        constructor() {
            /** @type {Map<string, Set<EventHandlerFn>>} */
            this.listeners = new Map();
        }

        /**
         * Register an event listener callback.
         * @param {string} eventName
         * @param {EventHandlerFn} handler
         * @returns {function(): boolean} Unsubscribe function
         */
        on(eventName, handler) {
            if (typeof handler !== 'function') throw new TypeError('Event handler must be a function.');
            if (!this.listeners.has(eventName)) this.listeners.set(eventName, new Set());
            this.listeners.get(eventName).add(handler);
            return () => this.off(eventName, handler);
        }

        /**
         * Register a single-execution event listener callback.
         * @param {string} eventName
         * @param {EventHandlerFn} handler
         * @returns {function(): boolean} Unsubscribe function
         */
        once(eventName, handler) {
            const unsubscribe = this.on(eventName, detail => {
                unsubscribe();
                handler(detail);
            });
            return unsubscribe;
        }

        /**
         * Remove an event listener callback or all handlers for an event.
         * @param {string} eventName
         * @param {EventHandlerFn} [handler]
         * @returns {boolean}
         */
        off(eventName, handler) {
            if (!this.listeners.has(eventName)) return false;
            if (!handler) return this.listeners.delete(eventName);
            const removed = this.listeners.get(eventName).delete(handler);
            if (this.listeners.get(eventName).size === 0) this.listeners.delete(eventName);
            return removed;
        }

        /**
         * Emit event with detail payload to all registered listeners.
         * @param {string} eventName
         * @param {any} [detail]
         * @returns {number} Count of handlers invoked
         */
        emit(eventName, detail) {
            const handlers = this.listeners.get(eventName);
            if (!handlers) return 0;
            let count = 0;
            for (const handler of Array.from(handlers)) {
                try {
                    handler(detail);
                } catch (error) {
                    if (root.console && typeof root.console.error === 'function') {
                        root.console.error('[Engine.UI.Bus] handler error', error);
                    }
                }
                count++;
            }
            return count;
        }

        /**
         * Unbind all event listeners.
         */
        clear() {
            this.listeners.clear();
        }
    }

    UI.EventBus = EventBus;
    UI.Bus = UI.Bus || new EventBus();
    root.UIBus = UI.Bus;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { EventBus, Bus: UI.Bus };
    }
})(typeof window !== 'undefined' ? window : globalThis);
