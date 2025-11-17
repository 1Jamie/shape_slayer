(function () {
	let layer, modal;

	function createLaunchModal() {
		const rootLayer = document.createElement('div');
		rootLayer.className = 'ui-layer ui-layer--modal';
		rootLayer.style.display = 'none';
		rootLayer.style.pointerEvents = 'auto';
		rootLayer.setAttribute('role', 'dialog');
		rootLayer.setAttribute('aria-modal', 'true');
		rootLayer.setAttribute('aria-label', 'How to play');

		const panel = document.createElement('div');
		panel.className = 'modal launch-modal';

		const header = document.createElement('div');
		header.className = 'modal__header';
		header.textContent = 'How to Play';

		const body = document.createElement('div');
		body.className = 'modal__body';
		const ul = document.createElement('ul');
		ul.style.paddingLeft = '18px';
		const tips = [
			'WASD to move (desktop) or left joystick (mobile).',
			'Left click to attack (desktop) or right joystick (mobile).',
			'Use abilities: Shift (dodge), Space (special), Right click (heavy).',
			'Press Escape or Pause button to open the pause menu.',
			'Press Tab to open the Character Sheet.'
		];
		for (const t of tips) {
			const li = document.createElement('li');
			li.textContent = t;
			ul.appendChild(li);
		}
		body.appendChild(ul);

		const footer = document.createElement('div');
		footer.className = 'modal__footer';

		const close = document.createElement('button');
		close.className = 'btn';
		close.type = 'button';
		close.textContent = 'Close';
		close.addEventListener('click', () => {
			if (Game) {
				Game.launchModalVisible = false;
			}
			refresh();
		});
		footer.appendChild(close);

		panel.appendChild(header);
		panel.appendChild(body);
		panel.appendChild(footer);

		rootLayer.appendChild(panel);

		const root = window.UIRoot && window.UIRoot.ensure ? window.UIRoot.ensure() : document.body;
		root.appendChild(rootLayer);
		layer = rootLayer;
		modal = panel;
	}

	function isVisible() {
		return window.USE_DOM_UI && typeof Game !== 'undefined' && !!Game.launchModalVisible;
	}

	function refresh() {
		if (!layer) return;
		layer.style.display = isVisible() ? 'flex' : 'none';
	}

	function tick() {
		refresh();
		requestAnimationFrame(tick);
	}

	function init() {
		createLaunchModal();
		tick();
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init, { once: true });
	} else {
		init();
	}
})();






