(function () {
	let layer, panel, msg, btn;

	function create() {
		const root = window.UIRoot && window.UIRoot.ensure ? window.UIRoot.ensure() : document.body;
		layer = document.createElement('div');
		layer.className = 'ui-layer ui-layer--modal';
		layer.style.display = 'none';
		layer.style.pointerEvents = 'auto';

		panel = document.createElement('div');
		panel.className = 'modal death-overlay';

		const header = document.createElement('div');
		header.className = 'modal__header';
		header.textContent = 'You Died';

		const body = document.createElement('div');
		body.className = 'modal__body';
		msg = document.createElement('div');
		body.appendChild(msg);

		const footer = document.createElement('div');
		footer.className = 'modal__footer';
		btn = document.createElement('button');
		btn.type = 'button';
		btn.className = 'btn';
		btn.textContent = 'Return to Nexus';
		btn.addEventListener('click', () => {
			if (!window.Game) return;
			const isClient = Game.multiplayerEnabled && Game.isMultiplayerClient && Game.isMultiplayerClient();
			if (!isClient || !Game.waitingForHostReturn) {
				Game.returnToNexus && Game.returnToNexus();
			}
		});
		footer.appendChild(btn);

		panel.appendChild(header);
		panel.appendChild(body);
		panel.appendChild(footer);
		layer.appendChild(panel);
		root.appendChild(layer);
	}

	function visible() {
		if (!window.USE_DOM_UI || !window.Game) return false;
		const inMultiplayer = Game.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.lobbyCode;
		const showDeathScreen = Game.player && Game.player.dead && (!inMultiplayer || Game.allPlayersDead);
		return Game.state === 'PLAYING' && showDeathScreen;
	}

	function refresh() {
		if (!layer) return;
		if (!visible()) {
			layer.style.display = 'none';
			return;
		}
		layer.style.display = 'flex';
		const inMultiplayer = Game.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.lobbyCode;
		if (inMultiplayer && !Game.allPlayersDead) {
			msg.textContent = 'Spectating. You will be revived when the room is cleared.';
			btn.style.display = 'none';
		} else {
			const timeSinceDeath = (Date.now() - (Game.deathScreenStartTime || Date.now())) / 1000;
			const enabled = timeSinceDeath >= 3.0;
			btn.disabled = !enabled;
			msg.textContent = enabled ? 'You may return to the Nexus.' : 'Please wait...';
			btn.style.display = 'inline-block';
		}
	}

	function tick() {
		refresh();
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






