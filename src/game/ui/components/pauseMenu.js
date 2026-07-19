(function () {
	let layer, modal, modalBody, resumeBtn, skipGuideBtn, multiplayerBtn, localCoopBtn;
	let updateModeButtons, updateCameraDistanceButtons;
	let wasPauseVisible = false;

	const MP_LOCK_HINT = 'Finish your first run (Room 0 tutorial) first';

	const CONTROL_MODES = [
		{ id: 'auto', label: 'Auto' },
		{ id: 'mobile', label: 'Mobile' },
		{ id: 'desktop', label: 'Desktop' },
		{ id: 'gamepad', label: 'Pad' }
	];

	const CAMERA_DISTANCES = [
		{ id: 'close', label: 'Close' },
		{ id: 'medium', label: 'Medium' },
		{ id: 'far', label: 'Far' }
	];

	function canOpenMultiplayer() {
		if (typeof SaveSystem !== 'undefined' && SaveSystem.canAccessMultiplayer) {
			return !!SaveSystem.canAccessMultiplayer();
		}
		if (typeof SaveSystem !== 'undefined' && SaveSystem.getOnboarding) {
			const ob = SaveSystem.getOnboarding();
			return !!(ob && ob.room0TutorialDone);
		}
		return false;
	}

	function getMultiplayerLockHint() {
		if (typeof SaveSystem !== 'undefined' && SaveSystem.getMultiplayerLockHint) {
			return SaveSystem.getMultiplayerLockHint() || MP_LOCK_HINT;
		}
		return MP_LOCK_HINT;
	}

	function getCurrentCameraDistance() {
		if (typeof Game !== 'undefined' && Game.getCameraDistance) {
			return Game.getCameraDistance();
		}
		if (typeof Game !== 'undefined' && Game.cameraDistance) {
			return Game.cameraDistance;
		}
		if (typeof SaveSystem !== 'undefined' && SaveSystem.getCameraDistance) {
			return SaveSystem.getCameraDistance();
		}
		return 'medium';
	}

	function getCurrentControlMode() {
		if ((typeof Engine !== 'undefined' && Engine.Input) && Engine.Input.controlMode) {
			return Engine.Input.controlMode;
		}
		if (typeof SaveSystem !== 'undefined' && SaveSystem.getControlMode) {
			return SaveSystem.getControlMode();
		}
		return 'auto';
	}

	function setButtonDisabled(btn, disabled, tooltipText) {
		if (!btn) return;
		btn.disabled = !!disabled;
		btn.classList.toggle('is-disabled', !!disabled);
		btn.title = disabled ? (tooltipText || '') : '';
		btn.setAttribute('aria-disabled', disabled ? 'true' : 'false');
	}

	function attachDisabledTooltip(btn, getText) {
		let tooltip = null;
		let tooltipTimeout = null;

		btn.addEventListener('mouseenter', () => {
			if (!btn.disabled) return;
			if (tooltipTimeout) clearTimeout(tooltipTimeout);
			tooltipTimeout = setTimeout(() => {
				tooltip = document.createElement('div');
				tooltip.className = 'pause-tooltip';
				tooltip.textContent = getText();
				document.body.appendChild(tooltip);
				const rect = btn.getBoundingClientRect();
				tooltip.style.left = rect.left + 'px';
				tooltip.style.top = (rect.bottom + 8) + 'px';
			}, 200);
		});

		btn.addEventListener('mouseleave', () => {
			if (tooltipTimeout) {
				clearTimeout(tooltipTimeout);
				tooltipTimeout = null;
			}
			if (tooltip) {
				tooltip.remove();
				tooltip = null;
			}
		});
	}

	function makeSection(title, extraClass) {
		const section = document.createElement('section');
		section.className = 'pause-section' + (extraClass ? ' ' + extraClass : '');
		if (title) {
			const heading = document.createElement('h3');
			heading.className = 'pause-section__title';
			heading.textContent = title;
			section.appendChild(heading);
		}
		return section;
	}

	function makeActionButton(text, action, options = {}) {
		const btn = document.createElement('button');
		btn.className = 'btn pause-btn-block' + (options.primary ? ' btn--primary' : '');
		btn.type = 'button';
		btn.textContent = text;
		if (options.datasetAction) {
			btn.setAttribute('data-pause-action', options.datasetAction);
		}
		if (options.title) {
			btn.title = options.title;
		}
		btn.addEventListener('click', () => {
			action();
			refresh();
		});
		return btn;
	}

	function makeSegmentedControl(options, { getValue, onSelect, updateRef }) {
		const wrap = document.createElement('div');
		wrap.className = 'pause-segmented';
		wrap.setAttribute('role', 'group');

		const buttons = [];

		options.forEach((opt) => {
			const btn = document.createElement('button');
			btn.type = 'button';
			btn.className = 'btn pause-segmented__btn';
			btn.dataset.value = opt.id;
			btn.textContent = opt.label;
			btn.addEventListener('click', (e) => {
				e.preventDefault();
				e.stopPropagation();
				onSelect(opt.id);
				sync();
			});
			wrap.appendChild(btn);
			buttons.push(btn);
		});

		function sync() {
			const current = getValue();
			buttons.forEach((btn) => {
				btn.classList.toggle('is-active', btn.dataset.value === current);
			});
		}

		sync();
		if (updateRef) updateRef(sync);
		return wrap;
	}

	function focusResumeForController() {
		if (!resumeBtn) return;
		if (window.ControllerNav && typeof window.ControllerNav.setFocus === 'function') {
			window.ControllerNav.setFocus(resumeBtn);
			return;
		}
		try {
			resumeBtn.focus({ preventScroll: true });
		} catch (_) {
			resumeBtn.focus();
		}
	}

	function createMenu() {
		const rootLayer = document.createElement('div');
		rootLayer.className = 'ui-layer ui-layer--modal';
		rootLayer.style.display = 'none';
		rootLayer.style.pointerEvents = 'auto';
		rootLayer.setAttribute('role', 'dialog');
		rootLayer.setAttribute('aria-modal', 'true');
		rootLayer.setAttribute('aria-label', 'Paused');

		const panel = document.createElement('div');
		panel.className = 'modal pause-menu';

		const header = document.createElement('div');
		header.className = 'modal__header';
		header.textContent = 'Paused';

		const body = document.createElement('div');
		body.className = 'modal__body pause-menu__body';
		modalBody = body;

		// Sticky primary: Resume + Fullscreen (always visible)
		const primary = document.createElement('div');
		primary.className = 'pause-primary';
		resumeBtn = makeActionButton(
			'Resume',
			() => Game && Game.togglePause && Game.togglePause(),
			{ primary: true, datasetAction: 'resume' }
		);
		primary.appendChild(resumeBtn);
		primary.appendChild(makeActionButton(
			'Fullscreen',
			() => Game && Game.toggleFullscreen && Game.toggleFullscreen(),
			{ datasetAction: 'fullscreen' }
		));

		const scroll = document.createElement('div');
		scroll.className = 'pause-scroll';

		// --- Run ---
		const runSection = makeSection('Run', 'pause-section--run');

		localCoopBtn = makeActionButton('Local Co-op', () => {
			if (!Game) return;
			if (Game.localSplitEnabled) {
				Game.disableLocalSplit();
				return;
			}
			const eligibility = typeof Game.getLocalSplitEligibility === 'function'
				? Game.getLocalSplitEligibility()
				: { ok: false, reason: 'Local co-op unavailable' };
			if (!eligibility.ok) {
				if (typeof window.showToast === 'function') {
					window.showToast(eligibility.reason || 'Cannot start local co-op', 3200);
				}
				return;
			}
			// Prefer keyboard+mouse + pad when available; otherwise two controllers (incl. mobile).
			const preferKeyboard = eligibility.mode === 'keyboardPad'
				|| (eligibility.mode === 'dualPad'
					&& typeof Game.hasLocalSplitKeyboardMouse === 'function'
					&& Game.hasLocalSplitKeyboardMouse());
			const joined = Game.enableLocalSplit && Game.enableLocalSplit(
				preferKeyboard ? { allowKeyboardPrimary: true } : {}
			);
			if (!joined && typeof window.showToast === 'function') {
				window.showToast(eligibility.reason || 'Cannot start local co-op', 3200);
			}
		}, { datasetAction: 'local-coop' });
		runSection.appendChild(localCoopBtn);

		multiplayerBtn = makeActionButton('Multiplayer', () => {
			if (!canOpenMultiplayer()) {
				if (typeof window.showToast === 'function') {
					window.showToast(getMultiplayerLockHint(), 3200);
				}
				return;
			}
			if (window.UIMultiplayer) window.UIMultiplayer.open();
		});
		attachDisabledTooltip(multiplayerBtn, getMultiplayerLockHint);
		runSection.appendChild(multiplayerBtn);

		runSection.appendChild(makeActionButton('Restart', async () => {
			const confirmed = typeof window.showConfirm === 'function'
				? await window.showConfirm('Restart this run? Your current progress will be lost.')
				: window.confirm('Restart this run? Your current progress will be lost.');
			if (confirmed && Game && Game.restart) Game.restart();
		}));

		runSection.appendChild(makeActionButton('Return to Nexus', async () => {
			const confirmed = typeof window.showConfirm === 'function'
				? await window.showConfirm('Return to Nexus? Your current run will end.')
				: window.confirm('Return to Nexus? Your current run will end.');
			if (confirmed && Game && Game.returnToNexus) Game.returnToNexus();
		}));

		skipGuideBtn = makeActionButton(
			'Skip Guide',
			() => {
				if (window.CoachSkipUI && window.CoachSkipUI.trySkipGuide) {
					window.CoachSkipUI.trySkipGuide();
				} else if (typeof Onboarding !== 'undefined' && Onboarding.canSkipGuide
					&& Onboarding.canSkipGuide() && Onboarding.skipGuide) {
					Onboarding.skipGuide();
				} else if (typeof FeatureTutorials !== 'undefined' && FeatureTutorials.skipGuide) {
					FeatureTutorials.skipGuide();
				}
				if (Game && Game.togglePause) Game.togglePause();
			},
			{ title: 'Dismiss the Nexus tutorial spotlight if you get stuck' }
		);
		skipGuideBtn.hidden = true;
		runSection.appendChild(skipGuideBtn);

		// --- Preferences ---
		const prefsSection = makeSection('Preferences', 'pause-section--preferences');

		const controlLabel = document.createElement('div');
		controlLabel.className = 'pause-label';
		controlLabel.textContent = 'Control Mode';
		prefsSection.appendChild(controlLabel);
		prefsSection.appendChild(makeSegmentedControl(CONTROL_MODES, {
			getValue: getCurrentControlMode,
			onSelect: (id) => {
				if (typeof SaveSystem !== 'undefined') {
					SaveSystem.setControlMode(id);
				}
				if ((typeof Engine !== 'undefined' && Engine.Input)) {
					if (Engine.Input.applyControlMode) {
						Engine.Input.applyControlMode(id, window.Game && window.Game.canvas);
					} else {
						Engine.Input.controlMode = id;
					}
				}
			},
			updateRef: (fn) => { updateModeButtons = fn; }
		}));

		const cameraLabel = document.createElement('div');
		cameraLabel.className = 'pause-label';
		cameraLabel.textContent = 'Camera Distance';
		prefsSection.appendChild(cameraLabel);
		prefsSection.appendChild(makeSegmentedControl(CAMERA_DISTANCES, {
			getValue: getCurrentCameraDistance,
			onSelect: (id) => {
				if (typeof Game !== 'undefined' && Game.setCameraDistance) {
					Game.setCameraDistance(id);
				} else if (typeof SaveSystem !== 'undefined' && SaveSystem.setCameraDistance) {
					SaveSystem.setCameraDistance(id);
				}
			},
			updateRef: (fn) => { updateCameraDistanceButtons = fn; }
		}));

		const customizeControlsBtn = makeActionButton(
			'Customize Mobile Controls',
			() => {
				if (typeof MobileControlEditor !== 'undefined' && MobileControlEditor.open) {
					MobileControlEditor.open();
				}
			}
		);
		prefsSection.appendChild(customizeControlsBtn);

		// --- Settings ---
		const settingsSection = makeSection('Settings', 'pause-section--settings');
		settingsSection.appendChild(makeActionButton(
			'Audio',
			() => { if (window.UIAudio) window.UIAudio.open(); }
		));
		settingsSection.appendChild(makeActionButton(
			'Privacy',
			() => { if (Game && Game.openPrivacyModal) Game.openPrivacyModal('pause'); }
		));

		// --- Info ---
		const infoSection = makeSection('Info', 'pause-section--info');
		infoSection.appendChild(makeActionButton(
			'How to Play',
			() => { if (Game) { Game.launchModalVisible = true; } }
		));

		scroll.appendChild(runSection);
		scroll.appendChild(prefsSection);
		scroll.appendChild(settingsSection);
		scroll.appendChild(infoSection);

		body.appendChild(primary);
		body.appendChild(scroll);

		panel.appendChild(header);
		panel.appendChild(body);

		// Shell: pause panel + patch-notes rail sitting beside it (only while paused)
		const shell = document.createElement('div');
		shell.className = 'pause-menu-shell';

		const notesBtn = document.createElement('button');
		notesBtn.type = 'button';
		notesBtn.className = 'btn pause-notes-rail';
		notesBtn.setAttribute('aria-label', 'Patch Notes');
		notesBtn.setAttribute('data-pause-action', 'patch-notes');
		notesBtn.title = 'Patch Notes';
		notesBtn.innerHTML =
			'<span class="pause-notes-rail__glyph" aria-hidden="true">' +
				'<span class="pause-notes-rail__page"></span>' +
				'<span class="pause-notes-rail__lines"></span>' +
			'</span>' +
			'<span class="pause-notes-rail__label">Patch<br>Notes</span>';
		notesBtn.addEventListener('click', (e) => {
			e.preventDefault();
			e.stopPropagation();
			if (Game) Game.updateModalVisible = true;
			// Hand focus to the patch-notes layer next frame
			if (window.ControllerNav) {
				window.ControllerNav.clearFocus && window.ControllerNav.clearFocus();
				window.ControllerNav.lastModal = null;
			}
		});

		shell.appendChild(panel);
		shell.appendChild(notesBtn);
		rootLayer.appendChild(shell);

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

	let pauseModalEntry = null;
	function refresh() {
		if (!layer) return;
		const visible = isPauseVisible();
		if (visible) {
			if (!pauseModalEntry) {
				pauseModalEntry = GameUI.openModal(layer, {
					closeOnEscape: false,
					onClose: () => { pauseModalEntry = null; }
				});
			}
		} else if (pauseModalEntry) {
			GameUI.closeModal(pauseModalEntry);
			pauseModalEntry = null;
		}

		const canSkipOnboarding = typeof Onboarding !== 'undefined'
			&& Onboarding.canSkipGuide
			&& Onboarding.canSkipGuide();
		const canSkipFeature = typeof FeatureTutorials !== 'undefined'
			&& FeatureTutorials.canSkipGuide
			&& FeatureTutorials.canSkipGuide();
		if (skipGuideBtn) {
			skipGuideBtn.hidden = !(canSkipOnboarding || canSkipFeature);
		}

		setButtonDisabled(multiplayerBtn, !canOpenMultiplayer(), getMultiplayerLockHint());
		if (localCoopBtn && typeof Game !== 'undefined') {
			localCoopBtn.textContent = Game.localSplitEnabled ? 'Leave Local Co-op' : 'Local Co-op';
			const eligibility = typeof Game.getLocalSplitEligibility === 'function'
				? Game.getLocalSplitEligibility()
				: { ok: false, reason: 'Local co-op unavailable' };
			const disabledHint = eligibility.reason
				|| 'Connect two controllers, or one controller for Player 2 with keyboard + mouse';
			setButtonDisabled(
				localCoopBtn,
				!Game.localSplitEnabled && !eligibility.ok,
				disabledHint
			);
		}

		if (visible) {
			if (typeof updateModeButtons === 'function') updateModeButtons();
			if (typeof updateCameraDistanceButtons === 'function') updateCameraDistanceButtons();

			// On open: baseline gamepad focus on sticky Resume (avoids scroll-container focus trap)
			if (!wasPauseVisible) {
				requestAnimationFrame(() => focusResumeForController());
			}
		}

		wasPauseVisible = visible;
	}

	function tick() {
		refresh();
		requestAnimationFrame(tick);
	}

	function init() {
		createMenu();
		document.addEventListener('keydown', (e) => {
			const target = e.target;
			if (typeof isFormFieldTarget === 'function' && isFormFieldTarget(target)) {
				return;
			}
			if (typeof window !== 'undefined' && window.multiplayerMenuVisible) {
				return;
			}
			if (typeof window !== 'undefined' && window.UIIndexMachine && window.UIIndexMachine.isOpen && window.UIIndexMachine.isOpen()) {
				return;
			}
			// Mobile control editor sits above the pause menu; let it consume Escape
			if (typeof window !== 'undefined' && window.MobileControlEditor
				&& window.MobileControlEditor.isOpen && window.MobileControlEditor.isOpen()) {
				return;
			}
			if (document.querySelector('.confirm-dialog')) {
				return;
			}

			if (e.key === 'Escape' && isPauseVisible()) {
				// Nested overlays (patch notes, how to play, audio, privacy): close those first
				if (typeof Game !== 'undefined' && Game.dismissOverlayAbovePause
					&& Game.dismissOverlayAbovePause()) {
					e.preventDefault();
					e.stopPropagation();
					return;
				}
				if (Game && Game.togglePause) {
					Game.togglePause();
				}
				refresh();
				e.preventDefault();
				e.stopPropagation();
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
