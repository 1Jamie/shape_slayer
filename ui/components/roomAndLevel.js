(function () {
	let roomEl, levelEl, layer;

	function create() {
		const root = window.UIRoot && window.UIRoot.ensure ? window.UIRoot.ensure() : document.body;
		layer = document.createElement('div');
		layer.className = 'ui-layer';
		layer.style.pointerEvents = 'none';
		layer.style.position = 'absolute';
		layer.style.left = '0';
		layer.style.right = '0';
		layer.style.top = '12px';
		layer.style.display = 'flex';
		layer.style.justifyContent = 'space-between';
		layer.style.padding = '0 20px';
		roomEl = document.createElement('div');
		roomEl.style.color = '#fff';
		roomEl.style.fontWeight = '700';
		levelEl = document.createElement('div');
		levelEl.style.color = '#ffea8a';
		levelEl.style.fontWeight = '700';
		layer.appendChild(roomEl);
		layer.appendChild(levelEl);
		root.appendChild(layer);
	}

	function tick() {
		if (!window.USE_DOM_UI || !window.Game) {
			layer.style.display = 'none';
		} else {
			layer.style.display = 'flex';
			const room = Game.roomNumber || 1;
			roomEl.textContent = `Room ${room}`;
			const player = Game.player;
			// Heuristic: show banner when level increases; keep it for 2s
			const now = Date.now();
			if (!tick._until) tick._until = 0;
			if (player && typeof player.level === 'number') {
				if (tick._lastLevel === undefined) tick._lastLevel = player.level;
				if (player.level > tick._lastLevel) {
					tick._until = now + 2000;
					tick._lastLevel = player.level;
				}
			}
			levelEl.textContent = now < tick._until ? 'LEVEL UP!' : '';
		}
		requestAnimationFrame(tick);
	}

	function init() {
		create();
		tick();
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init, { once: true });
	} else {
		init();
	}
})();


