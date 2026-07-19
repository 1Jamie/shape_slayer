(function () {
	let layer, messageEl;

	function create() {
		const root = window.UIRoot && window.UIRoot.ensure ? window.UIRoot.ensure() : document.body;
		layer = document.createElement('div');
		layer.className = 'ui-layer level-up-overlay';
		layer.style.pointerEvents = 'none';
		layer.style.userSelect = 'none';
		layer.style.position = 'fixed';
		layer.style.left = '0';
		layer.style.right = '0';
		layer.style.top = '0';
		layer.style.bottom = '0';
		layer.style.display = 'none';
		layer.style.alignItems = 'flex-start';
		layer.style.justifyContent = 'center';
		layer.style.zIndex = '5000';

		messageEl = document.createElement('div');
		messageEl.style.color = '#00ffff';
		messageEl.style.fontWeight = '900';
		messageEl.style.fontFamily = "'Orbitron', sans-serif";
		messageEl.style.textAlign = 'center';
		messageEl.style.textShadow = '0 0 40px #00ffff, 2px 2px 4px rgba(0,0,0,0.9), -2px 0 #000, 2px 0 #000, 0 -2px #000, 0 2px #000';
		messageEl.textContent = 'LEVEL UP!';
		layer.appendChild(messageEl);
		root.appendChild(layer);
	}

	function tick() {
		if (!layer) {
			requestAnimationFrame(tick);
			return;
		}

		const show = window.USE_DOM_UI &&
			window.Game &&
			Game.levelUpMessageActive &&
			Game.state === 'PLAYING';

		if (!show) {
			layer.style.display = 'none';
			layer.style.opacity = '0';
		} else {
			const progress = Math.max(0, Math.min(1, Game.levelUpMessageTime / 2.0));
			const alpha = Math.min(1.0, progress * 2.0);

			const isMobile = Engine.Input && Engine.Input.isMobileUiMode && Engine.Input.isMobileUiMode();
			messageEl.style.fontSize = isMobile ? '48px' : '96px';
			layer.style.paddingTop = isMobile ? '18%' : '22%';
			layer.style.display = 'flex';
			layer.style.opacity = String(alpha);
		}

		requestAnimationFrame(tick);
	}

	function showLevelUpMessage() {
		if (typeof Game === 'undefined') return;
		Game.levelUpMessageActive = true;
		Game.levelUpMessageTime = 2.0;
	}

	function init() {
		create();
		window.showLevelUpMessage = showLevelUpMessage;
		tick();
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init, { once: true });
	} else {
		init();
	}
})();
