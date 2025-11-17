// Lightweight event bus for UI ↔ game communication
(function () {
	const listeners = new Map();

	function on(eventName, handler) {
		if (!listeners.has(eventName)) {
			listeners.set(eventName, new Set());
		}
		listeners.get(eventName).add(handler);
	}

	function off(eventName, handler) {
		if (!listeners.has(eventName)) return;
		if (handler) {
			listeners.get(eventName).delete(handler);
		} else {
			listeners.delete(eventName);
		}
	}

	function emit(eventName, detail) {
		if (!listeners.has(eventName)) return;
		for (const handler of listeners.get(eventName)) {
			try {
				handler(detail);
			} catch (err) {
				console.error('[UIBus] handler error for', eventName, err);
			}
		}
	}

	// Expose globally (no bundler)
	window.UIBus = { on, off, emit };
})();






