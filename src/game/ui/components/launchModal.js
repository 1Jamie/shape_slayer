(function () {
	let layer, modal, continueBtn;

	function isOnboardingForced() {
		return typeof Onboarding !== 'undefined'
			&& Onboarding.getStep
			&& Onboarding.getStep() === Onboarding.STEPS.CONTROLS
			&& !Onboarding.isSuspended();
	}

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
		body.className = 'modal__body how-to-play';
		body.appendChild(buildControlsGrid());

		const footer = document.createElement('div');
		footer.className = 'modal__footer';

		continueBtn = document.createElement('button');
		continueBtn.className = 'btn btn--primary';
		continueBtn.type = 'button';
		continueBtn.textContent = 'Close';
		continueBtn.setAttribute('data-onboarding-action', 'controls-continue');
		continueBtn.addEventListener('click', () => {
			const forced = isOnboardingForced();
			if (typeof Onboarding !== 'undefined' && Onboarding.notifyControlsDone) {
				Onboarding.notifyControlsDone();
			} else {
				if (Game) Game.launchModalVisible = false;
				if (typeof SaveSystem !== 'undefined' && SaveSystem.setHasSeenLaunchModal) {
					SaveSystem.setHasSeenLaunchModal(true);
				}
			}
			if (!forced && Game) {
				Game.launchModalVisible = false;
			}
			refresh();
		});
		footer.appendChild(continueBtn);

		panel.appendChild(header);
		panel.appendChild(body);
		panel.appendChild(footer);

		rootLayer.appendChild(panel);

		const root = window.UIRoot && window.UIRoot.ensure ? window.UIRoot.ensure() : document.body;
		root.appendChild(rootLayer);
		layer = rootLayer;
		modal = panel;
	}

	function buildControlsGrid() {
		const wrap = document.createElement('div');
		wrap.className = 'controls-guide';

		wrap.appendChild(buildSection('Keyboard + Mouse', [
			{ input: keys('W', 'A', 'S', 'D'), action: 'Move' },
			{ input: mouse('Aim'), action: 'Aim at cursor' },
			{ input: mouse('LMB'), action: 'Primary attack' },
			{ input: mouse('RMB'), action: 'Heavy attack' },
			{ input: keys('Space'), action: 'Special ability' },
			{ input: keys('Shift'), action: 'Dodge' },
			{ input: keys('G'), action: 'Interact / select' },
			{ input: keys('M'), action: 'Apply room modifier' },
			{ input: keys('Tab'), action: 'Character sheet' },
			{ input: keys('Esc'), action: 'Pause / back' }
		]));

		wrap.appendChild(buildSection('Touch', [
			{ input: touchBadge('Left Stick'), action: 'Move' },
			{ input: touchBadge('Right Cluster'), action: 'Aim and abilities' },
			{ input: touchBadge('Interact'), action: 'Pick up, select, open' },
			{ input: touchBadge('Pause'), action: 'Open pause menu' },
			{ input: touchBadge('Char'), action: 'Character sheet' }
		]));

		wrap.appendChild(buildSection('Controller', [
			{ input: padText('Left Stick'), action: 'Move' },
			{ input: padText('Right Stick'), action: 'Aim' },
			{ input: padText('RT / R2'), action: 'Primary attack' },
			{ input: padText('LT / L2'), action: 'Heavy attack' },
			{ input: padText('LB / L1'), action: 'Special ability' },
			{ input: padText('RB / R1'), action: 'Dodge' },
			{ input: controllerButton('confirm'), action: 'Interact / confirm' },
			{ input: controllerButton('modifier'), action: 'Room modifier' },
			{ input: controllerButton('cancel'), action: 'Back / close menus' },
			{ input: controllerButton('start'), action: 'Pause menu' },
			{ input: controllerButton('select'), action: 'Character sheet' }
		]));

		const note = document.createElement('div');
		note.className = 'controls-guide__note';
		note.textContent = 'Controller prompts adapt to PlayStation, Xbox, Steam, Nintendo, or generic controllers when detected.';
		wrap.appendChild(note);

		return wrap;
	}

	function buildSection(title, rows) {
		const section = document.createElement('section');
		section.className = 'controls-guide__section';
		const heading = document.createElement('h3');
		heading.textContent = title;
		section.appendChild(heading);

		for (const row of rows) {
			const item = document.createElement('div');
			item.className = 'controls-guide__row';
			const input = document.createElement('div');
			input.className = 'controls-guide__input';
			input.appendChild(row.input);
			const action = document.createElement('div');
			action.className = 'controls-guide__action';
			action.textContent = row.action;
			item.appendChild(input);
			item.appendChild(action);
			section.appendChild(item);
		}

		return section;
	}

	function keys(...labels) {
		const wrap = document.createElement('span');
		wrap.className = 'control-badge-row';
		for (const label of labels) {
			const key = document.createElement('span');
			key.className = 'control-key-badge';
			key.textContent = label;
			wrap.appendChild(key);
		}
		return wrap;
	}

	function mouse(label) {
		const badge = document.createElement('span');
		badge.className = 'control-pill-badge';
		badge.textContent = label;
		return badge;
	}

	function touchBadge(label) {
		const badge = document.createElement('span');
		badge.className = 'control-pill-badge control-pill-badge--touch';
		badge.textContent = label;
		return badge;
	}

	function padText(label) {
		const badge = document.createElement('span');
		badge.className = 'control-pill-badge control-pill-badge--controller';
		badge.textContent = label;
		return badge;
	}

	function controllerButton(action) {
		const wrap = document.createElement('span');
		wrap.className = 'control-badge-row';
		if (window.ControllerButtons && ControllerButtons.createButtonBadge) {
			wrap.appendChild(ControllerButtons.createButtonBadge(action));
		} else {
			const fallback = document.createElement('span');
			fallback.className = 'control-key-badge';
			fallback.textContent = action;
			wrap.appendChild(fallback);
		}
		return wrap;
	}

	function isVisible() {
		return window.USE_DOM_UI && typeof Game !== 'undefined' && !!Game.launchModalVisible;
	}

	let launchModalEntry = null;
	function refresh() {
		if (!layer) return;
		const visible = isVisible();
		if (visible) {
			if (!launchModalEntry) {
				launchModalEntry = GameUI.openModal(layer, {
					closeOnEscape: !isOnboardingForced(),
					onClose: () => { launchModalEntry = null; }
				});
			}
		} else if (launchModalEntry) {
			GameUI.closeModal(launchModalEntry);
			launchModalEntry = null;
		}
		if (continueBtn) {
			continueBtn.textContent = isOnboardingForced() ? 'Got it' : 'Close';
		}
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
