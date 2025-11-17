(function () {
	let layer, modal;

	function createPrivacyModal() {
		const rootLayer = document.createElement('div');
		rootLayer.className = 'ui-layer ui-layer--modal';
		rootLayer.style.display = 'none';
		rootLayer.style.pointerEvents = 'auto';
		rootLayer.setAttribute('role', 'dialog');
		rootLayer.setAttribute('aria-modal', 'true');
		rootLayer.setAttribute('aria-label', 'Privacy settings');

		const panel = document.createElement('div');
		panel.className = 'modal privacy-modal';

		const header = document.createElement('div');
		header.className = 'modal__header';
		header.textContent = 'Privacy';

		const body = document.createElement('div');
		body.className = 'modal__body';
		const p = document.createElement('p');
		p.textContent = 'We collect limited telemetry to improve the game. You can opt in or out at any time.';
		p.style.marginBottom = '12px';
		const a = document.createElement('a');
		a.href = 'privacy.html';
		a.target = '_blank';
		a.rel = 'noreferrer';
		a.textContent = 'Read the full policy';
		body.appendChild(p);
		body.appendChild(a);

		const footer = document.createElement('div');
		footer.className = 'modal__footer';

		const optOut = document.createElement('button');
		optOut.className = 'btn';
		optOut.type = 'button';
		optOut.textContent = 'Opt out';
		optOut.addEventListener('click', () => {
			if (Game && Game.handlePrivacyChoice) Game.handlePrivacyChoice(false);
			refresh();
		});

		const optIn = document.createElement('button');
		optIn.className = 'btn btn--primary';
		optIn.type = 'button';
		optIn.textContent = 'Opt in';
		optIn.addEventListener('click', () => {
			if (Game && Game.handlePrivacyChoice) Game.handlePrivacyChoice(true);
			refresh();
		});

		const close = document.createElement('button');
		close.className = 'btn';
		close.type = 'button';
		close.textContent = 'Close';
		close.addEventListener('click', () => {
			if (Game && Game.closePrivacyModal) Game.closePrivacyModal();
			refresh();
		});

		footer.appendChild(optOut);
		footer.appendChild(optIn);
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
		return window.USE_DOM_UI && typeof Game !== 'undefined' && !!Game.privacyModalVisible;
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
		createPrivacyModal();
		tick();
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init, { once: true });
	} else {
		init();
	}
})();






