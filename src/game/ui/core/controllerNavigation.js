(function () {
	const focusableSelector = [
		'button:not([disabled])',
		'[role="button"]:not([aria-disabled="true"])',
		'input:not([disabled])',
		'select:not([disabled])',
		'textarea:not([disabled])',
		'[tabindex]:not([tabindex="-1"])'
	].join(',');

	const scrollableSelector = [
		'[data-controller-scroll]',
		'.nexus-scrollbar',
		'.modal__body',
		'.pause-scroll'
	].join(',');

	const buttonMap = {
		playstation: {
			confirm: { label: '', mark: 'cross', color: '#6d96d8', name: 'Cross' },
			cancel: { label: '', mark: 'circle', color: '#f06b6b', name: 'Circle' },
			modifier: { label: '', mark: 'triangle', color: '#7ee083', name: 'Triangle' },
			secondary: { label: '', mark: 'square', color: '#d787d9', name: 'Square' },
			start: { label: 'OP', mark: 'text', color: '#ffffff', name: 'Options' },
			select: { label: 'SH', mark: 'text', color: '#ffffff', name: 'Share' }
		},
		xbox: {
			confirm: { label: 'A', mark: 'text', color: '#6fcf5f', name: 'A' },
			cancel: { label: 'B', mark: 'text', color: '#f06b6b', name: 'B' },
			modifier: { label: 'Y', mark: 'text', color: '#f2d35b', name: 'Y' },
			secondary: { label: 'X', mark: 'text', color: '#6d96d8', name: 'X' },
			start: { label: '☰', mark: 'text', color: '#ffffff', name: 'Menu' },
			select: { label: '⧉', mark: 'text', color: '#ffffff', name: 'View' }
		},
		steam: {
			confirm: { label: 'A', mark: 'text', color: '#6fcf5f', name: 'A' },
			cancel: { label: 'B', mark: 'text', color: '#f06b6b', name: 'B' },
			modifier: { label: 'Y', mark: 'text', color: '#f2d35b', name: 'Y' },
			secondary: { label: 'X', mark: 'text', color: '#6d96d8', name: 'X' },
			start: { label: '☰', mark: 'text', color: '#ffffff', name: 'Menu' },
			select: { label: '⧉', mark: 'text', color: '#ffffff', name: 'View' }
		},
		nintendo: {
			confirm: { label: 'B', mark: 'text', color: '#f06b6b', name: 'B' },
			cancel: { label: 'A', mark: 'text', color: '#6fcf5f', name: 'A' },
			modifier: { label: 'X', mark: 'text', color: '#6d96d8', name: 'X' },
			secondary: { label: 'Y', mark: 'text', color: '#f2d35b', name: 'Y' },
			start: { label: '+', mark: 'text', color: '#ffffff', name: 'Plus' },
			select: { label: '-', mark: 'text', color: '#ffffff', name: 'Minus' }
		},
		generic: {
			confirm: { label: 'A', mark: 'text', color: '#ffffff', name: 'A' },
			cancel: { label: 'B', mark: 'text', color: '#ffffff', name: 'B' },
			modifier: { label: 'Y', mark: 'text', color: '#ffffff', name: 'Y' },
			secondary: { label: 'X', mark: 'text', color: '#ffffff', name: 'X' },
			start: { label: '☰', mark: 'text', color: '#ffffff', name: 'Start' },
			select: { label: '⧉', mark: 'text', color: '#ffffff', name: 'Select' }
		}
	};

	function getFamily() {
		if (Engine.Input && Engine.Input._gamepadFamily) return Engine.Input._gamepadFamily;
		return 'generic';
	}

	function getButtonStyle(action, family = getFamily()) {
		const familyMap = buttonMap[family] || buttonMap.generic;
		return familyMap[action] || buttonMap.generic[action] || buttonMap.generic.confirm;
	}

	function createButtonBadge(action, options = {}) {
		const badge = document.createElement('span');
		badge.className = 'controller-button-badge';
		badge.dataset.controllerAction = action;
		if (options.family) badge.dataset.controllerFamily = options.family;
		updateButtonBadge(badge, action, options.family || badge.dataset.controllerFamily || getFamily());
		return badge;
	}

	function updateButtonBadge(badge, action = badge && badge.dataset ? badge.dataset.controllerAction : 'confirm', family = null) {
		if (!badge) return badge;
		const resolvedFamily = family
			|| (badge.dataset && badge.dataset.controllerFamily)
			|| getFamily();
		if (badge.dataset) badge.dataset.controllerFamily = resolvedFamily;
		const style = getButtonStyle(action, resolvedFamily);
		badge.setAttribute('aria-label', style.name);
		badge.title = style.name;
		badge.style.setProperty('--controller-button-color', style.color || '#ffffff');
		badge.textContent = '';

		if (style.mark === 'cross') {
			badge.appendChild(makeMark('controller-button-mark controller-button-mark--cross'));
		} else if (style.mark === 'circle') {
			badge.appendChild(makeMark('controller-button-mark controller-button-mark--circle'));
		} else if (style.mark === 'triangle') {
			badge.appendChild(makeMark('controller-button-mark controller-button-mark--triangle'));
		} else if (style.mark === 'square') {
			badge.appendChild(makeMark('controller-button-mark controller-button-mark--square'));
		} else {
			badge.textContent = style.label || style.name || '?';
		}

		return badge;
	}

	function refreshButtonBadges(root = document) {
		Array.from(root.querySelectorAll('.controller-button-badge[data-controller-action]'))
			.forEach(badge => updateButtonBadge(
				badge,
				badge.dataset.controllerAction,
				badge.dataset.controllerFamily || getFamily()
			));
	}

	function makeMark(className) {
		const mark = document.createElement('span');
		mark.className = className;
		return mark;
	}

	const ControllerNav = {
		handlesSystemButtons: true,
		focusedElement: null,
		activeModal: null,
		lastMoveTime: 0,
		lastActionTime: 0,
		moveCooldown: 180,
		repeatMoveCooldown: 95,
		repeatDelay: 380,
		actionCooldown: 180,
		stickThreshold: 0.65,
		lastModal: null,
		moveHoldStartedAt: 0,
		prevButtons: {},
		prevMove: { x: 0, y: 0 },

		/** True while a DOM modal owns gamepad focus (pause, machines, sheets, etc.). */
		isBlockingGameplay() {
			return !!(this.activeModal || this.getTopVisibleModal());
		},

		init() {
			this.updateLoop = this.updateLoop.bind(this);
			this.updateLoop();
		},

		updateLoop() {
			requestAnimationFrame(this.updateLoop);
			this.update();
		},

		update() {
			const gamepad = this.getActiveGamepad();
			if (!gamepad) {
				document.body.classList.remove('controller-nav-active');
				this.clearFocus();
				this.removeHints();
				return;
			}

			this.syncGamepadInputSource(gamepad);
			document.body.classList.add('controller-nav-active');

			this.activeModal = this.getTopVisibleModal();
			this.handleGlobalButtons(gamepad);

			if (!this.activeModal) {
				this.lastModal = null;
				this.clearFocus();
				this.removeHints();
				this.capturePreviousState(gamepad);
				return;
			}

			if (this.activeModal !== this.lastModal) {
				this.clearFocus();
				this.removeHints();
				this.lastModal = this.activeModal;
			}

			const targets = this.getFocusableTargets(this.activeModal);
			if (targets.length === 0) {
				this.clearFocus();
				this.ensureHints(this.activeModal, null);
				this.capturePreviousState(gamepad);
				return;
			}

			if (!this.focusedElement || !targets.includes(this.focusedElement)) {
				this.setFocus(this.findInitialTarget(targets));
			}

			this.handleDirectionalInput(gamepad, targets);
			this.handleRightStickScroll(gamepad);
			this.handleActions(gamepad);
			this.ensureHints(this.activeModal, this.focusedElement);
			this.capturePreviousState(gamepad);
		},

		getActiveGamepad() {
			const pads = navigator.getGamepads ? navigator.getGamepads() : [];
			let pad = null;
			if (Engine.Input && Engine.Input._gamepadIndex !== null && pads[Engine.Input._gamepadIndex]) {
				pad = pads[Engine.Input._gamepadIndex];
			} else {
				pad = Array.from(pads).find(p => p && p.connected) || null;
			}
			if (pad && Engine.Input && typeof Engine.Input._getMappedGamepad === 'function') {
				return Engine.Input._getMappedGamepad(pad);
			}
			return pad;
		},

		syncGamepadInputSource(gamepad) {
			if (!gamepad || (typeof Engine === 'undefined' || !Engine.Input) || typeof Engine.Input._activateGamepadInput !== 'function') return;
			// Couch split owns pad routing; don't steal P1 keyboard-primary onto the global pad source.
			if (Engine.Input._couchSplitActive) return;

			const hasButtonInput = gamepad.buttons.some(button => button && (button.pressed || (button.value || 0) > 0.15));
			const hasStickInput = (gamepad.axes || []).some(axis => Math.abs(axis || 0) >= this.stickThreshold);
			if (hasButtonInput || hasStickInput) {
				Engine.Input._activateGamepadInput();
			}
		},

		getTopVisibleModal() {
			// Prefer Game-flagged / dedicated overlays so pause never steals focus underneath
			if (typeof Game !== 'undefined') {
				const flagged = [];
				if (Game.updateModalVisible) flagged.push('.update-modal');
				if (Game.launchModalVisible) flagged.push('.launch-modal');
				if (Game.privacyModalVisible) flagged.push('.privacy-modal');
				for (let i = 0; i < flagged.length; i++) {
					const panel = document.querySelector(flagged[i]);
					const layer = panel && panel.closest('.ui-layer--modal');
					if (layer && this.isVisibleLayer(layer)) return layer;
				}
			}

			const confirm = document.querySelector('.confirm-dialog');
			if (confirm && this.isVisibleLayer(confirm)) return confirm;

			const audioPanel = document.querySelector('.audio-menu');
			const audioLayer = audioPanel && audioPanel.closest('.ui-layer--modal');
			if (audioLayer && this.isVisibleLayer(audioLayer)) return audioLayer;

			const layers = Array.from(document.querySelectorAll('.ui-layer, .ui-layer--modal'));
			const visible = layers.filter(layer => this.isModalLayer(layer) && this.isVisibleLayer(layer));
			if (visible.length === 0) return null;
			visible.sort((a, b) => {
				const za = Number.parseInt(getComputedStyle(a).zIndex || '0', 10) || 0;
				const zb = Number.parseInt(getComputedStyle(b).zIndex || '0', 10) || 0;
				return za - zb;
			});
			return visible[visible.length - 1];
		},

		isModalLayer(layer) {
			return layer.classList.contains('ui-layer--modal') || !!layer.querySelector('.modal, .modal-content');
		},

		isVisibleLayer(layer) {
			if (this.isVisibleElement(layer)) return true;
			const modal = layer.querySelector('.modal, .modal-content');
			return !!modal && this.isVisibleElement(modal);
		},

		getFocusableTargets(root) {
			let controls = Array.from(root.querySelectorAll(focusableSelector))
				.filter(el => this.isNavigableTarget(el, root));
			const scrollables = Array.from(root.querySelectorAll(scrollableSelector))
				.filter(el => this.isScrollableTarget(el, root));

			// Forced onboarding: trap focus to allowed actions only
			if (typeof Onboarding !== 'undefined' && Onboarding.isForcedModalActive && Onboarding.isForcedModalActive()) {
				const step = Onboarding.getStep && Onboarding.getStep();
				controls = controls.filter(el => {
					const action = el.getAttribute('data-onboarding-action') || '';
					if (step === Onboarding.STEPS.PRIVACY) {
						return action === 'privacy-opt-in' || action === 'privacy-opt-out';
					}
					if (step === Onboarding.STEPS.CONTROLS) {
						return action === 'controls-continue';
					}
					return true;
				});
				return Array.from(new Set(controls));
			}

			return Array.from(new Set([...scrollables, ...controls]));
		},

		isNavigableTarget(el, root) {
			if (!el || !root.contains(el)) return false;
			if (el.disabled || el.getAttribute('aria-disabled') === 'true') return false;
			if (el.closest('[inert]')) return false;
			if (el.tabIndex < 0 && !['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName)) return false;
			return this.isVisibleElement(el);
		},

		isScrollableTarget(el, root) {
			if (!el || !root.contains(el)) return false;
			if (el.closest('[inert]')) return false;
			if (!this.isVisibleElement(el)) return false;
			if (el.querySelector(focusableSelector) && !el.matches('[data-controller-scroll]')) return false;

			const style = getComputedStyle(el);
			const canScrollY = /(auto|scroll)/.test(style.overflowY || style.overflow) && el.scrollHeight > el.clientHeight + 4;
			const canScrollX = /(auto|scroll)/.test(style.overflowX || style.overflow) && el.scrollWidth > el.clientWidth + 4;
			return canScrollY || canScrollX;
		},

		isVisibleElement(el) {
			if (!el || !el.isConnected) return false;
			const rect = el.getBoundingClientRect();
			if (rect.width <= 0 || rect.height <= 0) return false;

			let node = el;
			while (node && node.nodeType === 1) {
				const style = getComputedStyle(node);
				if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
				node = node.parentElement;
			}

			return true;
		},

		findInitialTarget(targets) {
			const active = document.activeElement;
			if (active && targets.includes(active)) return active;
			const modal = this.activeModal;
			const byText = (pattern) => targets.find(el => pattern.test(el.textContent || el.getAttribute('aria-label') || ''));

			// Confirm dialogs: land on Confirm
			if (modal && modal.classList.contains('confirm-dialog')) {
				const confirmBtn = byText(/^confirm$/i);
				if (confirmBtn) return confirmBtn;
			}

			// Pause menu only: sticky Resume is the baseline (not when a nested overlay is top)
			if (modal && modal.querySelector && modal.querySelector('.pause-menu')) {
				const pauseResume = targets.find(el => el.getAttribute('data-pause-action') === 'resume');
				if (pauseResume) return pauseResume;
			}

			if (modal && modal.querySelector && modal.querySelector('.update-modal')) {
				const scrollPane = targets.find(el => this.isScrollableTarget(el, modal));
				if (scrollPane) return scrollPane;
				const closeBtn = byText(/^close$/i);
				if (closeBtn) return closeBtn;
			}

			if (modal && modal.querySelector && modal.querySelector('.launch-modal')) {
				const continueBtn = byText(/got it|continue/i);
				if (continueBtn) return continueBtn;
			}

			if (modal && modal.querySelector && modal.querySelector('.audio-menu')) {
				const range = targets.find(el => el.type === 'range');
				if (range) return range;
			}

			const preferredButton = byText(/got it|opt in|resume|continue/i);
			if (preferredButton) return preferredButton;

			const preferredControl = targets.find(el => el.type === 'range' || el.tagName === 'SELECT');
			if (preferredControl) return preferredControl;

			return targets[0];
		},

		setFocus(el) {
			if (!el || this.focusedElement === el) return;
			this.clearFocus();
			this.focusedElement = el;
			el.classList.add('controller-focused');
			if (this.isScrollableTarget(el, this.activeModal || document) && !el.hasAttribute('tabindex')) {
				el.tabIndex = -1;
			}
			if (typeof el.focus === 'function') {
				try {
					el.focus({ preventScroll: true });
				} catch {
					el.focus();
				}
			}
			el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
		},

		clearFocus() {
			if (this.focusedElement) {
				this.focusedElement.classList.remove('controller-focused');
				this.focusedElement = null;
			}
		},

		handleDirectionalInput(gamepad, targets) {
			const direction = this.readDirection(gamepad);
			const now = performance.now();
			const pressed = direction.x !== 0 || direction.y !== 0;
			const wasPressed = this.prevMove.x !== 0 || this.prevMove.y !== 0;

			if (!pressed) {
				this.moveHoldStartedAt = 0;
				return;
			}

			if (!wasPressed) {
				this.moveHoldStartedAt = now;
			}

			const holdTime = this.moveHoldStartedAt ? now - this.moveHoldStartedAt : 0;
			const cooldown = holdTime > this.repeatDelay ? this.repeatMoveCooldown : this.moveCooldown;
			if (wasPressed && now - this.lastMoveTime < cooldown) return;

			if (this.handleDirectionalControlAdjustment(direction)) {
				this.lastMoveTime = now;
				return;
			}

			const target = this.findSpatialTarget(this.focusedElement, targets, direction);
			if (target) {
				this.setFocus(target);
				this.lastMoveTime = now;
			}
		},

		handleRightStickScroll(gamepad) {
			const el = this.focusedElement;
			if (!el || !this.isScrollableTarget(el, this.activeModal || document)) return;

			const x = gamepad.axes[2] || 0;
			const y = gamepad.axes[3] || 0;
			if (Math.abs(x) < this.stickThreshold && Math.abs(y) < this.stickThreshold) return;

			this.scrollElement(el, {
				x: Math.abs(x) >= this.stickThreshold ? Math.sign(x) : 0,
				y: Math.abs(y) >= this.stickThreshold ? Math.sign(y) : 0
			}, 0.36);
		},

		readDirection(gamepad) {
			const xAxis = gamepad.axes[0] || 0;
			const yAxis = gamepad.axes[1] || 0;
			const left = gamepad.buttons[14]?.pressed || xAxis < -this.stickThreshold;
			const right = gamepad.buttons[15]?.pressed || xAxis > this.stickThreshold;
			const up = gamepad.buttons[12]?.pressed || yAxis < -this.stickThreshold;
			const down = gamepad.buttons[13]?.pressed || yAxis > this.stickThreshold;

			if (Math.abs(xAxis) > Math.abs(yAxis)) {
				return { x: right ? 1 : (left ? -1 : 0), y: 0 };
			}
			if (up || down) return { x: 0, y: down ? 1 : -1 };
			return { x: right ? 1 : (left ? -1 : 0), y: 0 };
		},

		findSpatialTarget(current, targets, direction) {
			if (!current || !targets.includes(current)) return targets[0];

			const currentRect = current.getBoundingClientRect();
			const currentCenter = this.centerOf(currentRect);
			const currentRow = current.closest ? current.closest('.pause-segmented') : null;
			let best = null;
			let bestScore = Infinity;

			for (const candidate of targets) {
				if (candidate === current) continue;

				const candidateRow = candidate.closest ? candidate.closest('.pause-segmented') : null;
				// Vertical moves stay out of the same segmented row (Left/Right cycle those)
				if (direction.y !== 0 && currentRow && candidateRow && currentRow === candidateRow) {
					continue;
				}

				const metrics = this.getSpatialMetrics(currentCenter, candidate, direction, candidateRow);
				const dx = metrics.dx;
				const dy = metrics.dy;

				if (direction.x > 0 && dx <= 4) continue;
				if (direction.x < 0 && dx >= -4) continue;
				if (direction.y > 0 && dy <= 4) continue;
				if (direction.y < 0 && dy >= -4) continue;

				const primary = direction.x !== 0 ? Math.abs(dx) : Math.abs(dy);
				const secondary = direction.x !== 0 ? Math.abs(dy) : Math.abs(dx);
				const score = primary + secondary * 2.25;

				if (score < bestScore - 0.05) {
					bestScore = score;
					best = candidate;
				} else if (best && Math.abs(score - bestScore) <= 0.05) {
					best = this.pickSegmentedTieBreak(currentCenter, best, candidate, direction);
					bestScore = Math.min(bestScore, score);
				}
			}

			return best || this.findLinearFallback(current, targets, direction);
		},

		/**
		 * For vertical nav into a .pause-segmented row, score against the row band
		 * so off-center chips (Auto/Pad) are not skipped for centered ones below.
		 */
		getSpatialMetrics(currentCenter, candidate, direction, candidateRow) {
			const rect = candidate.getBoundingClientRect();
			if (direction.y !== 0 && candidateRow) {
				const rowRect = candidateRow.getBoundingClientRect();
				let dx = 0;
				if (currentCenter.x < rowRect.left) dx = rowRect.left - currentCenter.x;
				else if (currentCenter.x > rowRect.right) dx = currentCenter.x - rowRect.right;
				const dy = (rowRect.top + rowRect.height / 2) - currentCenter.y;
				return { dx, dy };
			}
			const center = this.centerOf(rect);
			return {
				dx: center.x - currentCenter.x,
				dy: center.y - currentCenter.y
			};
		},

		pickSegmentedTieBreak(currentCenter, a, b, direction) {
			const rowA = a.closest ? a.closest('.pause-segmented') : null;
			const rowB = b.closest ? b.closest('.pause-segmented') : null;
			if (direction.y !== 0 && rowA && rowA === rowB) {
				if (a.classList.contains('is-active') && !b.classList.contains('is-active')) return a;
				if (b.classList.contains('is-active') && !a.classList.contains('is-active')) return b;
				const da = Math.abs(this.centerOf(a.getBoundingClientRect()).x - currentCenter.x);
				const db = Math.abs(this.centerOf(b.getBoundingClientRect()).x - currentCenter.x);
				return da <= db ? a : b;
			}
			return a;
		},

		centerOf(rect) {
			return {
				x: rect.left + rect.width / 2,
				y: rect.top + rect.height / 2
			};
		},

		findLinearFallback(current, targets, direction) {
			const index = targets.indexOf(current);
			if (index === -1) return targets[0];
			const delta = direction.x < 0 || direction.y < 0 ? -1 : 1;
			const nextIndex = (index + delta + targets.length) % targets.length;
			return targets[nextIndex];
		},

		handleActions(gamepad) {
			if (this.wasPressed(gamepad, 0)) {
				this.activateFocused();
			}
			if (this.wasPressed(gamepad, 1)) {
				this.back();
			}
		},

		handleDirectionalControlAdjustment(direction) {
			const el = this.focusedElement;
			if (!el) return false;

			if (el.type === 'range' && direction.x !== 0) {
				this.adjustRange(el, direction.x);
				return true;
			}

			if (el.tagName === 'SELECT' && (direction.x !== 0 || direction.y !== 0)) {
				this.adjustSelect(el, direction.x || direction.y);
				return true;
			}

			if (this.isScrollableTarget(el, this.activeModal || document) && (direction.x !== 0 || direction.y !== 0)) {
				return this.scrollElement(el, direction);
			}

			return false;
		},

		handleGlobalButtons(gamepad) {
			// Title screen: Start (or A/confirm) begins the game. togglePause()
			// ignores TITLE, so without this the controller has no way forward.
			if (typeof Game !== 'undefined' && Game.state === 'TITLE' && !this.activeModal) {
				if ((this.wasPressed(gamepad, 9) || this.wasPressed(gamepad, 0))
					&& typeof Game.dismissTitleScreen === 'function') {
					Game.dismissTitleScreen();
				}
				return;
			}
			if (this.wasPressed(gamepad, 9)) {
				// Confirm dialog owns the stack — don't unpause underneath it
				const confirm = document.querySelector('.confirm-dialog');
				if (confirm && this.isVisibleLayer(confirm)) return;

				// Prefer dismissing nested overlays over unpausing
				if (typeof Game !== 'undefined' && Game.dismissOverlayAbovePause
					&& Game.dismissOverlayAbovePause()) {
					this.clearFocus();
					this.lastModal = null;
					return;
				}
				if (typeof Game !== 'undefined' && Game.togglePause) Game.togglePause();
			}
			if (this.wasPressed(gamepad, 8)) {
				this.openCharacterSheet();
			}
		},

		resolveLocalSplitSheetSeatId(gamepad) {
			if (typeof Game === 'undefined' || !Game.localSplitEnabled || !Game.localSplitSession) {
				return 'p1';
			}
			const seats = Game.localSplitSession.seats || [];
			const seat0 = seats[0];
			const seat1 = seats[1];
			const padIndex = gamepad && Number.isInteger(gamepad.index) ? gamepad.index : null;
			if (padIndex !== null) {
				if (seat1 && seat1.gamepadIndex === padIndex) return 'p2';
				if (seat0 && seat0.gamepadIndex === padIndex) return 'p1';
			}
			// Keyboard-primary co-op: the only bound pad is P2.
			if (seat0 && seat0.gamepadIndex === null) return 'p2';
			return 'p2';
		},

		openCharacterSheet() {
			const gamepad = this.getActiveGamepad();
			const seatId = this.resolveLocalSplitSheetSeatId(gamepad);
			if (window.CharacterSheet && typeof window.CharacterSheet.openForSeat === 'function') {
				const alreadyOpen = typeof window.CharacterSheet.isOpen === 'function'
					&& window.CharacterSheet.isOpen();
				const activeSeat = typeof window.CharacterSheet.getActiveSeatId === 'function'
					? window.CharacterSheet.getActiveSeatId()
					: null;
				if (alreadyOpen && activeSeat === seatId) {
					window.CharacterSheet.toggle(false);
				} else {
					window.CharacterSheet.openForSeat(seatId, true);
				}
				return;
			}
			if (window.CharacterSheet && typeof window.CharacterSheet.toggle === 'function') {
				// Select toggles open/closed (unlike Tab hold-to-view)
				window.CharacterSheet.toggle();
				return;
			}

			const keydown = new KeyboardEvent('keydown', {
				key: 'Tab',
				code: 'Tab',
				keyCode: 9,
				which: 9,
				bubbles: true,
				cancelable: true
			});
			document.dispatchEvent(keydown);
		},

		activateFocused() {
			const el = this.focusedElement;
			if (!el || !this.isVisibleElement(el)) return;

			if (el.tagName === 'SELECT') {
				this.adjustSelect(el, 1);
				return;
			}

			if (el.type === 'range') {
				this.adjustRange(el, 1);
				return;
			}

			el.click();
			this.lastActionTime = performance.now();
		},

		back() {
			// Forced onboarding modals: Cancel/Esc cannot dismiss without completing the step
			if (typeof Onboarding !== 'undefined' && Onboarding.isForcedModalActive && Onboarding.isForcedModalActive()) {
				return;
			}

			// Nested pause overlays first — never click Pause's Resume while these are up
			if (typeof Game !== 'undefined' && Game.dismissOverlayAbovePause
				&& Game.dismissOverlayAbovePause()) {
				this.clearFocus();
				this.lastModal = null;
				return;
			}

			const modal = this.activeModal || this.getTopVisibleModal();
			if (!modal) return;

			const closeButton = Array.from(modal.querySelectorAll('button'))
				.find(btn => {
					if (!this.isVisibleElement(btn)) return false;
					const label = `${btn.textContent || ''} ${btn.getAttribute('aria-label') || ''} ${btn.className || ''}`;
					// Do not treat Pause "Resume" as a generic back/close here — handled below
					if (/resume/i.test(label) && modal.querySelector && modal.querySelector('.pause-menu')) {
						return false;
					}
					return /close|cancel|back|no|×|✕/i.test(label);
				});

			if (closeButton) {
				closeButton.click();
				this.clearFocus();
				this.lastModal = null;
				return;
			}

			if (typeof Game !== 'undefined') {
				if ((Game.state === 'PAUSED' || Game.showPauseMenu) && Game.togglePause) {
					Game.togglePause();
				}
			}
		},

		ensureHints(modal, focusedElement) {
			if (!modal) {
				this.removeHints();
				return;
			}

			let panel = modal.querySelector('.modal, .modal-content') || modal;
			let hints = panel.querySelector(':scope > .controller-nav-hints');
			if (!hints) {
				hints = document.createElement('div');
				hints.className = 'controller-nav-hints';
				panel.appendChild(hints);
			}

			const isScrollPane = focusedElement && this.isScrollableTarget(focusedElement, modal);
			const scrollHint = isScrollPane ? this.getScrollHintText(focusedElement) : 'Navigate';
			const source = this.getActiveInputSource();
			hints.innerHTML = '';

			if (source === 'gamepad') {
				this.addHint(hints, null, 'D-pad / LS', scrollHint);
				if (isScrollPane) this.addHint(hints, null, 'RS', 'Scroll');
				this.addHint(hints, 'confirm', 'Confirm');
				this.addHint(hints, 'cancel', 'Back');
				this.addHint(hints, 'start', 'Pause');
			} else if (source === 'touch') {
				this.addHint(hints, null, 'Swipe', isScrollPane ? scrollHint : 'Scroll');
				this.addHint(hints, null, 'Tap', 'Select');
				this.addHint(hints, null, 'Back', 'Close');
			} else {
				this.addHint(hints, null, isScrollPane ? '↑↓' : 'Arrows / Tab', scrollHint);
				this.addHint(hints, null, 'Enter / Space', 'Confirm');
				this.addHint(hints, null, 'Esc', 'Back');
			}
		},

		getActiveInputSource() {
			if ((typeof Engine === 'undefined' || !Engine.Input)) return 'keyboardMouse';
			if (Engine.Input._activeInputSource === 'gamepad') return 'gamepad';
			if (Engine.Input._activeInputSource === 'touch') return 'touch';
			if (Engine.Input._activeInputSource === 'keyboardMouse') return 'keyboardMouse';
			if (Engine.Input.isGamepadMode && Engine.Input.isGamepadMode()) return 'gamepad';
			if (Engine.Input.isMobileUiMode && Engine.Input.isMobileUiMode()) return 'touch';
			return 'keyboardMouse';
		},

		refreshHints() {
			const modal = this.activeModal || this.getTopVisibleModal();
			if (!modal) {
				this.removeHints();
				return;
			}
			this.ensureHints(modal, this.focusedElement);
		},

		addHint(parent, action, text, fallbackText) {
			const item = document.createElement('span');
			item.className = 'controller-nav-hint';

			if (action && window.ControllerButtons && ControllerButtons.createButtonBadge) {
				item.appendChild(ControllerButtons.createButtonBadge(action));
				const label = document.createElement('span');
				label.textContent = text;
				item.appendChild(label);
			} else {
				const badge = document.createElement('span');
				badge.className = 'control-pill-badge control-pill-badge--controller';
				badge.textContent = text;
				item.appendChild(badge);
				if (fallbackText) {
					const label = document.createElement('span');
					label.textContent = fallbackText;
					item.appendChild(label);
				}
			}

			parent.appendChild(item);
		},

		getScrollHintText(el) {
			const atTop = el.scrollTop <= 2;
			const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 2;
			if (atTop && !atBottom) return 'Scroll down';
			if (atBottom && !atTop) return 'Scroll up';
			return 'Scroll';
		},

		removeHints() {
			Array.from(document.querySelectorAll('.controller-nav-hints')).forEach(el => el.remove());
		},

		adjustSelect(select, direction) {
			const next = Math.max(0, Math.min(select.options.length - 1, select.selectedIndex + direction));
			if (next === select.selectedIndex) return;
			select.selectedIndex = next;
			select.dispatchEvent(new Event('input', { bubbles: true }));
			select.dispatchEvent(new Event('change', { bubbles: true }));
		},

		adjustRange(range, direction) {
			const step = Number.parseFloat(range.step || '1') || 1;
			const min = Number.parseFloat(range.min || '0');
			const max = Number.parseFloat(range.max || '100');
			const value = Number.parseFloat(range.value || '0');
			const next = Math.max(min, Math.min(max, value + step * direction));
			if (next === value) return;
			range.value = String(next);
			range.dispatchEvent(new Event('input', { bubbles: true }));
			range.dispatchEvent(new Event('change', { bubbles: true }));
		},

		scrollElement(el, direction, scale = 0.24) {
			const amount = Math.max(72, Math.round(el.clientHeight * scale));
			const beforeTop = el.scrollTop;
			const beforeLeft = el.scrollLeft;
			const top = direction.y * amount;
			const left = direction.x * amount;

			el.scrollBy({ top, left, behavior: 'auto' });

			return el.scrollTop !== beforeTop || el.scrollLeft !== beforeLeft;
		},

		wasPressed(gamepad, index) {
			const pressed = !!gamepad.buttons[index]?.pressed;
			return pressed && !this.prevButtons[index];
		},

		capturePreviousState(gamepad) {
			for (let i = 0; i < gamepad.buttons.length; i++) {
				this.prevButtons[i] = !!gamepad.buttons[i]?.pressed;
			}
			this.prevMove = this.readDirection(gamepad);
		}
	};

	window.ControllerNav = ControllerNav;
	window.ControllerButtons = {
		createButtonBadge,
		updateButtonBadge,
		refreshButtonBadges,
		getButtonStyle,
		getFamily
	};

	window.addEventListener('inputsourcechange', () => {
		refreshButtonBadges();
		ControllerNav.refreshHints();
	});
	window.addEventListener('controlmodechange', () => {
		refreshButtonBadges();
		ControllerNav.refreshHints();
	});

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', () => ControllerNav.init(), { once: true });
	} else {
		ControllerNav.init();
	}
})();
