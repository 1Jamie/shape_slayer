(function () {
	let layer;
	let creditsEl;
	let shardsEl;
	let subtitleEl;
	let promptEl;
	let versionEl;
	let installBtn;
	let installPromptEvent = null;
	let pauseBtnHidden = false;

	function isInstalledPwa() {
		return (window.matchMedia && (
			window.matchMedia('(display-mode: standalone)').matches ||
			window.matchMedia('(display-mode: fullscreen)').matches
		)) || window.navigator.standalone === true;
	}

	function isIosInstallCandidate() {
		const ua = navigator.userAgent || '';
		const ios = /iPad|iPhone|iPod/.test(ua) ||
			(navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
		return ios && !isInstalledPwa();
	}

	async function promptInstall(e) {
		e.preventDefault();
		e.stopPropagation();
		if (installPromptEvent) {
			installPromptEvent.prompt();
			await installPromptEvent.userChoice;
			installPromptEvent = null;
		} else if (isIosInstallCandidate() && window.showToast) {
			window.showToast('In Safari, tap Share, then Add to Home Screen.', 4500);
		}
	}

	window.addEventListener('beforeinstallprompt', (event) => {
		event.preventDefault();
		installPromptEvent = event;
	});

	window.addEventListener('appinstalled', () => {
		installPromptEvent = null;
	});

	function isTitleVisible() {
		return typeof Game !== 'undefined' && Game.state === 'TITLE';
	}

	function isExiting() {
		return !!(layer && layer.classList.contains('title-screen--exiting'));
	}

	function beginExit(durationSec) {
		if (!layer) create();
		if (!layer) return;
		const ms = Math.max(120, Math.round((durationSec != null ? durationSec : 0.45) * 1000));
		layer.style.setProperty('--title-exit-ms', ms + 'ms');
		layer.classList.add('title-screen--exiting');
	}

	function resetExit() {
		if (!layer) return;
		layer.classList.remove('title-screen--exiting');
		layer.style.removeProperty('--title-exit-ms');
	}

	function getPatchSubtitle() {
		if (typeof Game === 'undefined') return '';
		const version = Game.VERSION || '';
		const title = (typeof Game.getPatchTitle === 'function')
			? Game.getPatchTitle(version)
			: ('UPDATE ' + version);
		return version + ' ' + title;
	}

	function makeKeyBadge(label) {
		const badge = document.createElement('span');
		badge.className = 'control-key-badge title-screen__key';
		badge.textContent = label;
		return badge;
	}

	function makeStartGlyph() {
		if (window.ControllerButtons && ControllerButtons.createButtonBadge) {
			const badge = ControllerButtons.createButtonBadge('start');
			badge.classList.add('title-screen__key');
			return badge;
		}
		return makeKeyBadge('START');
	}

	function renderStartPrompt() {
		if (!promptEl) return;

		const inp = (typeof Input !== 'undefined' ? Input : (window.Input || null));
		const isMobile = inp && inp.isMobileUiMode && inp.isMobileUiMode();

		promptEl.replaceChildren();
		if (isMobile) {
			promptEl.textContent = 'TAP TO START';
			return;
		}

		promptEl.appendChild(document.createTextNode('PRESS '));
		promptEl.appendChild(makeStartGlyph());
		promptEl.appendChild(document.createTextNode(' OR '));
		promptEl.appendChild(makeKeyBadge('ENTER'));
		promptEl.appendChild(document.createTextNode(' TO START'));
	}

	function setChromeHidden(hidden) {
		const pauseBtn = document.getElementById('ui-pause-button');
		const sheetBtn = document.getElementById('ui-charsheet-button');
		if (hidden) {
			if (pauseBtn) pauseBtn.style.setProperty('display', 'none', 'important');
			if (sheetBtn) sheetBtn.style.setProperty('display', 'none', 'important');
			pauseBtnHidden = true;
		} else if (pauseBtnHidden) {
			if (pauseBtn) pauseBtn.style.removeProperty('display');
			if (sheetBtn) sheetBtn.style.removeProperty('display');
			pauseBtnHidden = false;
		}
	}

	function dismiss() {
		if (isExiting()) return;
		if (typeof Game !== 'undefined' && typeof Game.dismissTitleScreen === 'function') {
			Game.dismissTitleScreen();
		}
	}

	function create() {
		if (layer) return;

		const root = window.UIRoot && window.UIRoot.ensure ? window.UIRoot.ensure() : document.body;
		if (!root) {
			setTimeout(create, 100);
			return;
		}

		layer = document.createElement('div');
		layer.id = 'title-screen';
		layer.className = 'ui-layer title-screen';
		layer.style.display = 'none';
		layer.setAttribute('role', 'dialog');
		layer.setAttribute('aria-label', 'Shape Slayer title screen');

		layer.innerHTML = [
			'<div class="title-screen__top">',
			'  <div class="title-screen__logo" aria-hidden="true">',
			'    <span class="title-screen__word title-screen__word--shape">SHAPE</span>',
			'    <span class="title-screen__gem">',
			'      <svg viewBox="0 0 64 64" width="56" height="56" focusable="false">',
			'        <polygon points="32,4 60,32 32,60 4,32" fill="#1a1030" stroke="#00e5ff" stroke-width="3"/>',
			'        <polygon points="32,4 60,32 32,32" fill="#00e5ff" opacity="0.85"/>',
			'        <polygon points="32,32 60,32 32,60" fill="#ff6a00" opacity="0.9"/>',
			'        <polygon points="32,4 32,32 4,32" fill="#2a6cff" opacity="0.55"/>',
			'      </svg>',
			'    </span>',
			'    <span class="title-screen__word title-screen__word--slayer">SLAYER</span>',
			'  </div>',
			'  <div class="title-screen__subtitle" id="title-screen-subtitle"></div>',
			'</div>',
			'<div class="title-screen__bottom">',
			'  <div class="title-screen__currency">',
			'    <div class="title-screen__credits">CREDITS: <span id="title-screen-credits">0</span></div>',
			'    <div class="title-screen__shards">SHARDS: <span id="title-screen-shards">0</span>',
			'      <span class="title-screen__shard-icon" aria-hidden="true"></span>',
			'    </div>',
			'  </div>',
			'  <div class="title-screen__prompt" id="title-screen-prompt"></div>',
			'  <div class="title-screen__version" id="title-screen-version"></div>',
			'</div>',
			'<button class="title-screen__install" id="title-screen-install" type="button" hidden>Install App</button>'
		].join('');

		root.appendChild(layer);

		creditsEl = document.getElementById('title-screen-credits');
		shardsEl = document.getElementById('title-screen-shards');
		subtitleEl = document.getElementById('title-screen-subtitle');
		promptEl = document.getElementById('title-screen-prompt');
		versionEl = document.getElementById('title-screen-version');
		installBtn = document.getElementById('title-screen-install');
		if (installBtn) {
			installBtn.addEventListener('click', promptInstall);
			installBtn.addEventListener('touchend', (e) => {
				e.preventDefault();
				e.stopPropagation();
				promptInstall(e);
			}, { passive: false });
		}
		renderStartPrompt();

		layer.addEventListener('click', function (e) {
			e.preventDefault();
			dismiss();
		});
		layer.addEventListener('touchend', function (e) {
			e.preventDefault();
			dismiss();
		}, { passive: false });
		layer.addEventListener('contextmenu', function (e) {
			e.preventDefault();
			return false;
		});
	}

	let wasVisible = false;

	function refresh() {
		if (!layer) create();
		if (!layer) {
			requestAnimationFrame(refresh);
			return;
		}

		const visible = isTitleVisible();
		if (visible) {
			layer.style.display = 'flex';
			setChromeHidden(true);
		} else {
			layer.style.display = 'none';
			resetExit();
			setChromeHidden(false);
			wasVisible = false;
			requestAnimationFrame(refresh);
			return;
		}

		if (installBtn) {
			installBtn.hidden = isInstalledPwa() ||
				(!installPromptEvent && !isIosInstallCandidate());
		}

		if (!wasVisible) {
			renderStartPrompt();
			wasVisible = true;
		}

		if (subtitleEl) {
			subtitleEl.textContent = getPatchSubtitle();
		}
		if (versionEl && typeof Game !== 'undefined') {
			versionEl.textContent = 'v' + (Game.VERSION || '0.0.0') + ' // SHAPE ENGINE';
		}
		if (creditsEl) {
			const credits = typeof SaveSystem !== 'undefined' && SaveSystem.getCurrency
				? SaveSystem.getCurrency()
				: (typeof Game !== 'undefined' && Game.currentCurrency != null ? Game.currentCurrency : 0);
			creditsEl.textContent = Math.floor(credits).toLocaleString();
		}
		if (shardsEl) {
			const shards = typeof SaveSystem !== 'undefined' && SaveSystem.getCardShards
				? SaveSystem.getCardShards()
				: 0;
			shardsEl.textContent = shards.toLocaleString();
		}

		requestAnimationFrame(refresh);
	}

	function tryInit() {
		if (typeof window.UIRoot === 'undefined' || !window.UIRoot.ensure) {
			setTimeout(tryInit, 50);
			return;
		}
		create();
		refresh();
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', tryInit, { once: true });
	} else {
		tryInit();
	}

	window.addEventListener('controlmodechange', function () {
		if (isTitleVisible()) {
			renderStartPrompt();
		}
	});

	window.TitleScreen = {
		beginExit: beginExit,
		isExiting: isExiting
	};
})();
