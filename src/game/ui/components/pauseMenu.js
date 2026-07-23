(function () {
	let layer, modal, modalBody, resumeBtn, skipGuideBtn, multiplayerBtn, localCoopBtn;
	let restartBtn, exitBtn, settingsBtn, customizeControlsBtn, settingsBackBtn;
	let mainViewEl, settingsViewEl;
	let updateModeButtons, updateCameraDistanceButtons;
	let wasPauseVisible = false;
	let pauseView = 'main'; // 'main' | 'settings'

	const MP_LOCK_HINT = 'Finish your first run (Room 0 tutorial) first';
	const NEXUS_EXIT_HINT = 'Already in the Nexus';
	const NEXUS_RESTART_HINT = 'No active run to restart';

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
		if (typeof Engine !== 'undefined' && Engine.Input && Engine.Input.controlMode) {
			return Engine.Input.controlMode;
		}
		if (typeof SaveSystem !== 'undefined' && SaveSystem.getControlMode) {
			return SaveSystem.getControlMode();
		}
		return 'auto';
	}

	function isTouchUiActive() {
		if (typeof Engine !== 'undefined' && Engine.Input) {
			if (typeof Engine.Input.isMobileUiMode === 'function' && Engine.Input.isMobileUiMode()) {
				return true;
			}
			const mode = Engine.Input.controlMode;
			if (mode === 'mobile' || mode === 'touch') return true;
		}
		const saved = getCurrentControlMode();
		return saved === 'mobile' || saved === 'touch';
	}

	function getPauseContext() {
		const game = typeof Game !== 'undefined' ? Game : null;
		const inNexus = !!(game && (
			game.pausedFromState === 'NEXUS'
			|| game.state === 'NEXUS'
		));
		const profile = game && game.modeProfile ? game.modeProfile : null;
		const isIslandSession = !!(game && (
			game.activeSessionId
			|| (profile && profile.exit === 'endSession')
		));
		const exitIsEndSession = !!(profile && profile.exit === 'endSession')
			|| !!(game && game.activeSessionId);
		return {
			inNexus,
			isIslandSession,
			exitIsEndSession,
			touchUiActive: isTouchUiActive(),
			restartLabel: isIslandSession ? 'Restart Session' : 'Restart',
			exitLabel: exitIsEndSession ? 'End Session' : 'Return to Nexus',
			restartDisabled: inNexus,
			exitDisabled: inNexus,
			restartHint: NEXUS_RESTART_HINT,
			exitHint: NEXUS_EXIT_HINT
		};
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
			if (btn.disabled) return;
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
				refresh();
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

	function focusElement(el) {
		if (!el) return;
		if (window.ControllerNav && typeof window.ControllerNav.setFocus === 'function') {
			window.ControllerNav.setFocus(el);
			return;
		}
		try {
			el.focus({ preventScroll: true });
		} catch (_) {
			el.focus();
		}
	}

	function focusResumeForController() {
		focusElement(resumeBtn);
	}

	function setPauseView(next, { focusTarget } = {}) {
		pauseView = next === 'settings' ? 'settings' : 'main';
		if (mainViewEl) {
			mainViewEl.hidden = pauseView !== 'main';
			mainViewEl.classList.toggle('is-active', pauseView === 'main');
		}
		if (settingsViewEl) {
			settingsViewEl.hidden = pauseView !== 'settings';
			settingsViewEl.classList.toggle('is-active', pauseView === 'settings');
		}
		if (focusTarget) {
			requestAnimationFrame(() => focusElement(focusTarget));
		}
	}

	function openSettingsView() {
		setPauseView('settings', { focusTarget: settingsBackBtn });
	}

	function closeSettingsView() {
		setPauseView('main', { focusTarget: settingsBtn });
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

		// --- Main view ---
		mainViewEl = document.createElement('div');
		mainViewEl.className = 'pause-view pause-view--main is-active';

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

		restartBtn = makeActionButton('Restart', async () => {
			const ctx = getPauseContext();
			if (ctx.restartDisabled) return;
			const confirmMsg = ctx.isIslandSession
				? 'Restart this session? Your current progress will be lost.'
				: 'Restart this run? Your current progress will be lost.';
			const confirmed = typeof window.showConfirm === 'function'
				? await window.showConfirm(confirmMsg)
				: window.confirm(confirmMsg);
			if (confirmed && Game && Game.restart) Game.restart();
		}, { datasetAction: 'restart' });
		attachDisabledTooltip(restartBtn, () => getPauseContext().restartHint);
		runSection.appendChild(restartBtn);

		exitBtn = makeActionButton('Return to Nexus', async () => {
			const ctx = getPauseContext();
			if (ctx.exitDisabled) return;
			const confirmMsg = ctx.exitIsEndSession
				? 'End this session and return?'
				: 'Return to Nexus? Your current run will end.';
			const confirmed = typeof window.showConfirm === 'function'
				? await window.showConfirm(confirmMsg)
				: window.confirm(confirmMsg);
			if (!confirmed) return;
			// Prefer returnToNexus so Island sessions and Gear share one exit path.
			if (Game && Game.returnToNexus) {
				Game.returnToNexus();
				return;
			}
			if (Game && Game.activeSessionId
				&& typeof AppHost !== 'undefined' && AppHost.endSession) {
				AppHost.endSession();
			}
		}, { datasetAction: 'exit' });
		attachDisabledTooltip(exitBtn, () => getPauseContext().exitHint);
		runSection.appendChild(exitBtn);

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
			{ title: 'Dismiss the Nexus tutorial spotlight if you get stuck', datasetAction: 'skip-guide' }
		);
		skipGuideBtn.hidden = true;
		runSection.appendChild(skipGuideBtn);

		const moreSection = makeSection('More', 'pause-section--more');
		settingsBtn = makeActionButton(
			'Settings',
			() => { openSettingsView(); },
			{ datasetAction: 'settings' }
		);
		moreSection.appendChild(settingsBtn);
		moreSection.appendChild(makeActionButton(
			'How to Play',
			() => { if (Game) { Game.launchModalVisible = true; } },
			{ datasetAction: 'how-to-play' }
		));

		mainViewEl.appendChild(runSection);
		mainViewEl.appendChild(moreSection);

		// --- Settings sub-view ---
		settingsViewEl = document.createElement('div');
		settingsViewEl.className = 'pause-view pause-view--settings';
		settingsViewEl.hidden = true;

		const settingsHeader = document.createElement('div');
		settingsHeader.className = 'pause-settings-header';
		settingsBackBtn = document.createElement('button');
		settingsBackBtn.type = 'button';
		settingsBackBtn.className = 'btn pause-settings-header__back';
		settingsBackBtn.textContent = 'Back';
		settingsBackBtn.setAttribute('data-pause-action', 'settings-back');
		settingsBackBtn.addEventListener('click', () => {
			closeSettingsView();
			refresh();
		});
		const settingsTitle = document.createElement('h3');
		settingsTitle.className = 'pause-settings-header__title';
		settingsTitle.textContent = 'Settings';
		settingsHeader.appendChild(settingsBackBtn);
		settingsHeader.appendChild(settingsTitle);
		settingsViewEl.appendChild(settingsHeader);

		const prefsSection = makeSection(null, 'pause-section--preferences');

		const controlLabel = document.createElement('div');
		controlLabel.className = 'pause-label';
		controlLabel.textContent = 'Control Mode';
		prefsSection.appendChild(controlLabel);
		prefsSection.appendChild(makeSegmentedControl(CONTROL_MODES, {
			getValue: getCurrentControlMode,
			onSelect: (id) => {
				if (typeof SaveSystem !== 'undefined') SaveSystem.setControlMode(id);
				if (typeof Engine !== 'undefined' && Engine.Input && typeof Engine.Input.applyControlMode === 'function') {
					Engine.Input.applyControlMode(id, window.Game && window.Game.canvas);
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

		customizeControlsBtn = makeActionButton(
			'Customize Mobile Controls',
			() => {
				if (typeof MobileControlEditor !== 'undefined' && MobileControlEditor.open) {
					MobileControlEditor.open();
				}
			},
			{ datasetAction: 'customize-mobile' }
		);
		customizeControlsBtn.hidden = true;
		prefsSection.appendChild(customizeControlsBtn);

		prefsSection.appendChild(makeActionButton(
			'Audio',
			() => { if (window.UIAudio) window.UIAudio.open(); },
			{ datasetAction: 'audio' }
		));
		prefsSection.appendChild(makeActionButton(
			'Privacy',
			() => { if (Game && Game.openPrivacyModal) Game.openPrivacyModal('pause'); },
			{ datasetAction: 'privacy' }
		));

		settingsViewEl.appendChild(prefsSection);

		scroll.appendChild(mainViewEl);
		scroll.appendChild(settingsViewEl);

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
		setPauseView('main');
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
			setPauseView('main');
		}

		const ctx = getPauseContext();

		const canSkipOnboarding = typeof Onboarding !== 'undefined'
			&& Onboarding.canSkipGuide
			&& Onboarding.canSkipGuide();
		const canSkipFeature = typeof FeatureTutorials !== 'undefined'
			&& FeatureTutorials.canSkipGuide
			&& FeatureTutorials.canSkipGuide();
		if (skipGuideBtn) {
			skipGuideBtn.hidden = !(canSkipOnboarding || canSkipFeature);
		}

		if (restartBtn) {
			restartBtn.textContent = ctx.restartLabel;
			setButtonDisabled(restartBtn, ctx.restartDisabled, ctx.restartHint);
		}
		if (exitBtn) {
			exitBtn.textContent = ctx.exitLabel;
			setButtonDisabled(exitBtn, ctx.exitDisabled, ctx.exitHint);
		}
		if (customizeControlsBtn) {
			customizeControlsBtn.hidden = !ctx.touchUiActive;
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
				setPauseView('main');
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
				// Settings sub-view: Back to main before unpausing
				if (pauseView === 'settings') {
					closeSettingsView();
					refresh();
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
