(function () {
	let layer, modal, closeBtn, optOutBtn, optInBtn;

	function isOnboardingForced() {
		return typeof Onboarding !== 'undefined'
			&& Onboarding.isForcedModalActive
			&& Onboarding.isForcedModalActive()
			&& typeof Game !== 'undefined'
			&& Game.privacyModalContext === 'onboarding';
	}

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

		optOutBtn = document.createElement('button');
		optOutBtn.className = 'btn';
		optOutBtn.type = 'button';
		optOutBtn.textContent = 'Opt out';
		optOutBtn.setAttribute('data-onboarding-action', 'privacy-opt-out');
		optOutBtn.addEventListener('click', () => {
			if (Game && Game.handlePrivacyChoice) Game.handlePrivacyChoice(false);
			refresh();
		});

		optInBtn = document.createElement('button');
		optInBtn.className = 'btn btn--primary';
		optInBtn.type = 'button';
		optInBtn.textContent = 'Opt in';
		optInBtn.setAttribute('data-onboarding-action', 'privacy-opt-in');
		optInBtn.addEventListener('click', () => {
			if (Game && Game.handlePrivacyChoice) Game.handlePrivacyChoice(true);
			refresh();
		});

		closeBtn = document.createElement('button');
		closeBtn.className = 'btn';
		closeBtn.type = 'button';
		closeBtn.textContent = 'Close';
		closeBtn.setAttribute('data-onboarding-action', 'privacy-close');
		closeBtn.addEventListener('click', () => {
			if (isOnboardingForced()) return;
			if (Game && Game.closePrivacyModal) Game.closePrivacyModal();
			refresh();
		});

		footer.appendChild(optOutBtn);
		footer.appendChild(optInBtn);
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

	function isVisible() {
		return window.USE_DOM_UI && typeof Game !== 'undefined' && !!Game.privacyModalVisible;
	}

	let privacyModalEntry = null;
	function refresh() {
		if (!layer) return;
		const visible = isVisible();
		if (visible) {
			if (!privacyModalEntry) {
				privacyModalEntry = GameUI.openModal(layer, {
					closeOnEscape: !isOnboardingForced(),
					onClose: () => {
						privacyModalEntry = null;
						if (Game && Game.closePrivacyModal && !isOnboardingForced()) {
							Game.closePrivacyModal();
						}
					}
				});
			}
		} else if (privacyModalEntry) {
			GameUI.closeModal(privacyModalEntry);
			privacyModalEntry = null;
		}
		if (closeBtn) {
			const forced = isOnboardingForced();
			closeBtn.style.display = forced ? 'none' : '';
			closeBtn.disabled = forced;
		}
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
