// Soft service-worker updates: auto-apply on title/advertise, prompt in nexus/run.
(function (root) {
	const PwaUpdate = {
		_registration: null,
		_pending: false,
		_applying: false,
		_promptDismissed: false,
		_banner: null,
		_watchTimer: null
	};

	function canAutoApply() {
		if (typeof Game === 'undefined' || !Game) {
			return true;
		}
		// Title / attract is safe. Nexus and live runs must opt in.
		return Game.state === 'TITLE';
	}

	function isPlaySession() {
		if (typeof Game === 'undefined' || !Game) {
			return false;
		}
		const state = Game.state;
		return state === 'NEXUS' ||
			state === 'PLAYING' ||
			state === 'ENTERING_ROOM' ||
			state === 'PAUSED';
	}

	function hideBanner() {
		if (!PwaUpdate._banner) {
			return;
		}
		PwaUpdate._banner.remove();
		PwaUpdate._banner = null;
	}

	function showBanner() {
		if (PwaUpdate._banner || typeof document === 'undefined') {
			return;
		}

		const banner = document.createElement('div');
		banner.className = 'pwa-update-banner';
		banner.setAttribute('role', 'status');
		banner.setAttribute('aria-live', 'polite');

		const text = document.createElement('span');
		text.className = 'pwa-update-banner__text';
		text.textContent = 'Update ready — apply when you are free.';

		const actions = document.createElement('div');
		actions.className = 'pwa-update-banner__actions';

		const updateBtn = document.createElement('button');
		updateBtn.type = 'button';
		updateBtn.className = 'btn btn--primary pwa-update-banner__btn';
		updateBtn.textContent = 'Update now';
		updateBtn.addEventListener('click', (event) => {
			event.preventDefault();
			event.stopPropagation();
			PwaUpdate.apply();
		});

		const laterBtn = document.createElement('button');
		laterBtn.type = 'button';
		laterBtn.className = 'btn pwa-update-banner__btn';
		laterBtn.textContent = 'Not now';
		laterBtn.addEventListener('click', (event) => {
			event.preventDefault();
			event.stopPropagation();
			PwaUpdate._promptDismissed = true;
			hideBanner();
			if (typeof root.showToast === 'function') {
				root.showToast('Update waiting — it will apply on the title screen.', 3500);
			}
		});

		actions.appendChild(updateBtn);
		actions.appendChild(laterBtn);
		banner.appendChild(text);
		banner.appendChild(actions);
		document.body.appendChild(banner);
		PwaUpdate._banner = banner;
	}

	function ensureWatch() {
		if (PwaUpdate._watchTimer || typeof root.setInterval !== 'function') {
			return;
		}
		PwaUpdate._watchTimer = root.setInterval(() => {
			if (!PwaUpdate._pending || PwaUpdate._applying) {
				return;
			}
			if (canAutoApply()) {
				PwaUpdate.apply();
			} else if (isPlaySession() && !PwaUpdate._promptDismissed) {
				showBanner();
			}
		}, 2000);
	}

	PwaUpdate.bindRegistration = function bindRegistration(registration) {
		PwaUpdate._registration = registration || null;
	};

	PwaUpdate.notifyAvailable = function notifyAvailable(registration) {
		if (registration) {
			PwaUpdate._registration = registration;
		}
		if (!PwaUpdate._registration || !PwaUpdate._registration.waiting) {
			return;
		}
		if (PwaUpdate._applying) {
			return;
		}

		PwaUpdate._pending = true;
		ensureWatch();

		if (canAutoApply()) {
			PwaUpdate.apply();
			return;
		}

		if (!PwaUpdate._promptDismissed) {
			showBanner();
		}
	};

	PwaUpdate.apply = function apply() {
		const registration = PwaUpdate._registration;
		if (!registration || !registration.waiting || PwaUpdate._applying) {
			return false;
		}

		PwaUpdate._applying = true;
		PwaUpdate._pending = false;
		hideBanner();
		root.__shapeSlayerSwUpdateAccepted = true;
		registration.waiting.postMessage({ type: 'SKIP_WAITING' });
		return true;
	};

	PwaUpdate.hasPending = function hasPending() {
		return !!(PwaUpdate._pending && PwaUpdate._registration && PwaUpdate._registration.waiting);
	};

	root.PwaUpdate = PwaUpdate;

	if (typeof module !== 'undefined' && module.exports) {
		module.exports = { PwaUpdate };
	}
})(typeof window !== 'undefined' ? window : globalThis);
