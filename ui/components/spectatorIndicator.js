(function () {
	let layer, text;

	function create() {
		const root = window.UIRoot && window.UIRoot.ensure ? window.UIRoot.ensure() : document.body;
		layer = document.createElement('div');
		layer.className = 'ui-layer';
		layer.style.pointerEvents = 'none';
		layer.style.position = 'absolute';
		layer.style.left = '0';
		layer.style.right = '0';
		layer.style.bottom = '20px';
		text = document.createElement('div');
		text.style.textAlign = 'center';
		text.style.color = '#ffea8a';
		text.style.fontWeight = '700';
		text.textContent = 'You will be revived when the room is cleared';
		layer.appendChild(text);
		root.appendChild(layer);
	}

	function tick() {
		if (!window.USE_DOM_UI || !window.Game) {
			layer.style.display = 'none';
		} else {
			const inMultiplayer = Game.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.lobbyCode;
			const show = Game.player && Game.player.dead && inMultiplayer && Game.spectateMode && !Game.allPlayersDead;
			layer.style.display = show ? 'block' : 'none';
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






