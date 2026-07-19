(function(root) {
    const Engine = root.Engine = root.Engine || {};
    const UI = Engine.UI = Engine.UI || {};

    class EventBus {
        constructor() {
            this.listeners = new Map();
        }

        on(eventName, handler) {
            if (typeof handler !== 'function') throw new TypeError('Event handler must be a function.');
            if (!this.listeners.has(eventName)) this.listeners.set(eventName, new Set());
            this.listeners.get(eventName).add(handler);
            return () => this.off(eventName, handler);
        }

        once(eventName, handler) {
            const unsubscribe = this.on(eventName, detail => {
                unsubscribe();
                handler(detail);
            });
            return unsubscribe;
        }

        off(eventName, handler) {
            if (!this.listeners.has(eventName)) return false;
            if (!handler) return this.listeners.delete(eventName);
            const removed = this.listeners.get(eventName).delete(handler);
            if (this.listeners.get(eventName).size === 0) this.listeners.delete(eventName);
            return removed;
        }

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
