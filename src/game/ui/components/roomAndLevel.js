(function () {
	let layer, messageEl;

	const LEVEL_UP_STYLE = {
		color: '#00ffff',
		shadow: '0 0 40px #00ffff, 2px 2px 4px rgba(0,0,0,0.9), -2px 0 #000, 2px 0 #000, 0 -2px #000, 0 2px #000',
		text: 'LEVEL UP!',
		duration: 2.0,
		fontDesktop: '96px',
		fontMobile: '48px'
	};

	const BOSS_SURGE_STYLE = {
		color: '#ff3344',
		shadow: '0 0 48px #ff2200, 0 0 18px #ffaa00, 2px 2px 4px rgba(0,0,0,0.95), -2px 0 #000, 2px 0 #000, 0 -2px #000, 0 2px #000',
		text: 'WARNING!\nBOSS SURGE!',
		duration: 2.4,
		fontDesktop: '72px',
		fontMobile: '36px'
	};

	const MACHINES_OPEN_STYLE = {
		color: '#66ffcc',
		shadow: '0 0 40px #33ffaa, 0 0 16px #88ffe0, 2px 2px 4px rgba(0,0,0,0.95), -2px 0 #000, 2px 0 #000, 0 -2px #000, 0 2px #000',
		text: 'MACHINES OPEN',
		duration: 2.2,
		fontDesktop: '72px',
		fontMobile: '36px'
	};

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
		messageEl.style.color = LEVEL_UP_STYLE.color;
		messageEl.style.fontWeight = '900';
		messageEl.style.fontFamily = "'Orbitron', sans-serif";
		messageEl.style.textAlign = 'center';
		messageEl.style.whiteSpace = 'pre-line';
		messageEl.style.lineHeight = '1.05';
		messageEl.style.letterSpacing = '0.04em';
		messageEl.style.textShadow = LEVEL_UP_STYLE.shadow;
		messageEl.textContent = LEVEL_UP_STYLE.text;
		layer.appendChild(messageEl);
		root.appendChild(layer);
	}

	function applyStyle(style, isMobile) {
		messageEl.style.color = style.color;
		messageEl.style.textShadow = style.shadow;
		messageEl.textContent = style.text;
		messageEl.style.fontSize = isMobile ? style.fontMobile : style.fontDesktop;
	}

	function activeBanner() {
		if (!window.USE_DOM_UI || !window.Game || Game.state !== 'PLAYING') return null;
		// Boss surge wins if somehow overlapping; machines open is post-clear opportunity.
		if (Game.bossSurgeMessageActive) {
			return { style: BOSS_SURGE_STYLE, time: Game.bossSurgeMessageTime };
		}
		if (Game.machinesOpenMessageActive) {
			return { style: MACHINES_OPEN_STYLE, time: Game.machinesOpenMessageTime };
		}
		if (Game.levelUpMessageActive) {
			return { style: LEVEL_UP_STYLE, time: Game.levelUpMessageTime };
		}
		return null;
	}

	function tick() {
		if (!layer) {
			requestAnimationFrame(tick);
			return;
		}

		const banner = activeBanner();
		if (!banner) {
			layer.style.display = 'none';
			layer.style.opacity = '0';
		} else {
			const { style, time } = banner;
			const progress = Math.max(0, Math.min(1, time / style.duration));
			const alpha = Math.min(1.0, progress * 2.0);

			const isMobile = Engine.Input && Engine.Input.isMobileUiMode && Engine.Input.isMobileUiMode();
			applyStyle(style, isMobile);
			layer.style.paddingTop = isMobile ? '18%' : '22%';
			layer.style.display = 'flex';
			layer.style.opacity = String(alpha);
		}

		requestAnimationFrame(tick);
	}

	function showLevelUpMessage() {
		if (typeof Game === 'undefined') return;
		Game.levelUpMessageActive = true;
		Game.levelUpMessageTime = LEVEL_UP_STYLE.duration;
	}

	function showBossSurgeMessage() {
		if (typeof Game === 'undefined') return;
		Game.bossSurgeMessageActive = true;
		Game.bossSurgeMessageTime = BOSS_SURGE_STYLE.duration;
		if (typeof Game.triggerScreenShake === 'function') {
			Game.triggerScreenShake(0.35, 0.35);
		}
		if (typeof GameAudio !== 'undefined' && GameAudio.sounds && typeof GameAudio.sounds.bossSurgeWarning === 'function') {
			GameAudio.sounds.bossSurgeWarning();
		}
	}

	function showMachinesOpenMessage() {
		if (typeof Game === 'undefined') return;
		Game.machinesOpenMessageActive = true;
		Game.machinesOpenMessageTime = MACHINES_OPEN_STYLE.duration;
		if (typeof GameAudio !== 'undefined' && GameAudio.sounds) {
			if (typeof GameAudio.sounds.machinesOpen === 'function') {
				GameAudio.sounds.machinesOpen();
			} else if (typeof GameAudio.sounds.doorOpen === 'function') {
				GameAudio.sounds.doorOpen();
			}
		}
	}

	function init() {
		create();
		window.showLevelUpMessage = showLevelUpMessage;
		window.showBossSurgeMessage = showBossSurgeMessage;
		window.showMachinesOpenMessage = showMachinesOpenMessage;
		tick();
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init, { once: true });
	} else {
		init();
	}
})();
