(function () {
	let layer, modal;

	function createMenu() {
		const rootLayer = document.createElement('div');
		rootLayer.className = 'ui-layer ui-layer--modal';
		rootLayer.style.display = 'none';
		rootLayer.style.pointerEvents = 'auto';
		rootLayer.setAttribute('role', 'dialog');
		rootLayer.setAttribute('aria-modal', 'true');

		const panel = document.createElement('div');
		panel.className = 'modal pause-menu';

		const header = document.createElement('div');
		header.className = 'modal__header';
		header.textContent = 'Paused';

		const body = document.createElement('div');
		body.className = 'modal__body';

		const footer = document.createElement('div');
		footer.className = 'modal__footer';

		const actions = [
			{ text: 'Resume', action: () => Game && Game.togglePause && Game.togglePause(), primary: true },
			{ text: 'Multiplayer', action: () => { if (window.UIMultiplayer) { window.UIMultiplayer.open(); } } },
			{ text: 'Restart', action: () => Game && Game.restart && Game.restart() },
			{ text: 'Return to Nexus', action: () => Game && Game.returnToNexus && Game.returnToNexus() },
			{ text: 'Audio', action: () => { if (window.UIAudio) window.UIAudio.open(); } },
			{ text: 'Fullscreen', action: () => Game && Game.toggleFullscreen && Game.toggleFullscreen() },
			{ text: 'How to Play', action: () => { if (Game) { Game.launchModalVisible = true; } } },
			{ text: 'Privacy', action: () => { if (Game && Game.openPrivacyModal) Game.openPrivacyModal('pause'); } },
			{ text: 'Update Notes', action: () => { if (Game) { Game.updateModalVisible = true; } } }
		];

		const list = document.createElement('div');
		list.style.display = 'grid';
		list.style.gridTemplateColumns = '1fr';
		list.style.gap = '10px';
		for (const a of actions) {
			const btn = document.createElement('button');
			btn.className = 'btn' + (a.primary ? ' btn--primary' : '');
			btn.type = 'button';
			btn.textContent = a.text;
			btn.addEventListener('click', () => {
				a.action();
				refresh(); // reflect any state changes (e.g., resume closes)
			});
			list.appendChild(btn);
		}

		body.appendChild(list);

		const closeBtn = document.createElement('button');
		closeBtn.className = 'btn';
		closeBtn.type = 'button';
		closeBtn.textContent = 'Close';
		closeBtn.addEventListener('click', () => {
			if (Game && Game.togglePause) Game.togglePause();
			refresh();
		});
		footer.appendChild(closeBtn);

		panel.appendChild(header);
		panel.appendChild(body);
		panel.appendChild(footer);

		rootLayer.appendChild(panel);

		const root = window.UIRoot && window.UIRoot.ensure ? window.UIRoot.ensure() : document.body;
		root.appendChild(rootLayer);
		layer = rootLayer;
		modal = panel;
	}

	function isPauseVisible() {
		if (typeof Game === 'undefined') return false;
		const inMultiplayer = Game.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.lobbyCode;
		return Game.state === 'PAUSED' || (inMultiplayer && Game.showPauseMenu);
	}

	function refresh() {
		if (!layer) return;
		if (!window.USE_DOM_UI) {
			layer.style.display = 'none';
			return;
		}
		layer.style.display = isPauseVisible() ? 'flex' : 'none';
	}

	function tick() {
		refresh();
		requestAnimationFrame(tick);
	}

	function init() {
		createMenu();
		// ESC to resume when menu visible
		document.addEventListener('keydown', (e) => {
			if (!window.USE_DOM_UI) return;
			if (e.key === 'Escape' && isPauseVisible()) {
				if (Game && Game.togglePause) Game.togglePause();
				refresh();
				e.preventDefault();
			}
		}, { capture: true });
		tick();
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init, { once: true });
	} else {
		init();
	}
})();


