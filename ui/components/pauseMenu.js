(function () {
	let layer, modal, modalBody, updateModeButtons, skipGuideBtn;

	function createMenu() {
		const rootLayer = document.createElement('div');
		rootLayer.className = 'ui-layer ui-layer--modal';
		rootLayer.style.display = 'none';
		rootLayer.style.pointerEvents = 'auto';
		rootLayer.setAttribute('role', 'dialog');
		rootLayer.setAttribute('aria-modal', 'true');

		const panel = document.createElement('div');
		panel.className = 'modal pause-menu';

		const header = document.createElement('div');
		header.className = 'modal__header';
		header.textContent = 'Paused';

		const body = document.createElement('div');
		body.className = 'modal__body';
		modalBody = body; // Store reference for refresh function

		const footer = document.createElement('div');
		footer.className = 'modal__footer';

		const actions = [
			{ text: 'Resume', action: () => Game && Game.togglePause && Game.togglePause(), primary: true },
			{ text: 'Multiplayer', action: () => { if (window.UIMultiplayer) { window.UIMultiplayer.open(); } } },
			{ text: 'Restart', action: () => Game && Game.restart && Game.restart() },
			{ text: 'Return to Nexus', action: () => Game && Game.returnToNexus && Game.returnToNexus() },
			{ text: 'Audio', action: () => { if (window.UIAudio) window.UIAudio.open(); } },
			{ text: 'Fullscreen', action: () => Game && Game.toggleFullscreen && Game.toggleFullscreen() },
			{ text: 'How to Play', action: () => { if (Game) { Game.launchModalVisible = true; } } },
			{ text: 'Privacy', action: () => { if (Game && Game.openPrivacyModal) Game.openPrivacyModal('pause'); } },
			{ text: 'Update Notes', action: () => { if (Game) { Game.updateModalVisible = true; } } }
		];

		const list = document.createElement('div');
		list.style.display = 'grid';
		list.style.gridTemplateColumns = '1fr';
		list.style.gap = '10px';
		list.style.position = 'relative'; // For scroll indicator positioning
		list.style.flex = '1 1 auto';      // Allow list to fill remaining height
		list.style.minHeight = '0';        // Allow list to shrink below content size
		list.style.overflowY = 'auto';
		// Keep enough inner space for controller focus outlines so they are not clipped by the scroll container.
		list.style.padding = '4px 12px 4px 4px';
		list.style.margin = '-4px 0 0 -4px';

		// Hide default scrollbar (we're using custom indicator)
		list.style.scrollbarWidth = 'none'; // Firefox
		list.style.msOverflowStyle = 'none'; // IE/Edge

		// Create a style element to hide webkit scrollbar
		const style = document.createElement('style');
		style.textContent = `
			.pause-menu-list::-webkit-scrollbar {
				display: none;
			}
		`;
		document.head.appendChild(style);
		list.className = 'pause-menu-list';

		function appendActionButton(a) {
			const btn = document.createElement('button');
			btn.className = 'btn' + (a.primary ? ' btn--primary' : '');
			btn.type = 'button';
			btn.textContent = a.text;

			// Handle disabled state (telemetry disabled by dev)
			if (a.disabled) {
				btn.disabled = true;
				btn.style.opacity = '0.5';
				btn.style.cursor = 'not-allowed';
				btn.style.filter = 'grayscale(50%)';

				// Create custom tooltip for disabled button
				if (a.tooltip) {
					let tooltip = null;
					let tooltipTimeout = null;

					btn.addEventListener('mouseenter', (e) => {
						// Clear any existing timeout
						if (tooltipTimeout) {
							clearTimeout(tooltipTimeout);
							tooltipTimeout = null;
						}

						// Create tooltip after a short delay
						tooltipTimeout = setTimeout(() => {
							tooltip = document.createElement('div');
							tooltip.style.position = 'fixed';
							tooltip.style.background = 'rgba(0, 0, 0, 0.95)';
							tooltip.style.border = '2px solid #666';
							tooltip.style.borderRadius = '6px';
							tooltip.style.padding = '8px 12px';
							tooltip.style.color = '#fff';
							tooltip.style.fontSize = '12px';
							tooltip.style.fontFamily = "'Orbitron', sans-serif";
							tooltip.style.zIndex = '10003';
							tooltip.style.pointerEvents = 'none';
							tooltip.style.whiteSpace = 'nowrap';
							tooltip.style.boxShadow = '0 4px 8px rgba(0,0,0,0.5)';
							tooltip.textContent = a.tooltip;

							// Position tooltip near the button
							const rect = btn.getBoundingClientRect();
							tooltip.style.left = rect.left + 'px';
							tooltip.style.top = (rect.bottom + 8) + 'px';

							document.body.appendChild(tooltip);
						}, 300);
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
			} else {
				btn.addEventListener('click', () => {
					a.action();
					refresh(); // reflect any state changes (e.g., resume closes)
				});
			}

			list.appendChild(btn);
			return btn;
		}

		for (const a of actions) {
			appendActionButton(a);
			if (a.text === 'Resume') {
				skipGuideBtn = appendActionButton({
					text: 'Skip Guide',
					action: () => {
						if (window.CoachSkipUI && window.CoachSkipUI.trySkipGuide) {
							window.CoachSkipUI.trySkipGuide();
						} else {
							if (typeof Onboarding !== 'undefined' && Onboarding.canSkipGuide
								&& Onboarding.canSkipGuide() && Onboarding.skipGuide) {
								Onboarding.skipGuide();
							} else if (typeof FeatureTutorials !== 'undefined' && FeatureTutorials.skipGuide) {
								FeatureTutorials.skipGuide();
							}
						}
						if (Game && Game.togglePause) Game.togglePause();
					}
				});
				skipGuideBtn.style.display = 'none';
				skipGuideBtn.title = 'Dismiss the Nexus tutorial spotlight if you get stuck';
			}
		}

		// Add custom scroll indicator for mobile (attached to body, not list)
		const scrollIndicator = document.createElement('div');
		scrollIndicator.className = 'pause-menu-scroll-indicator';
		scrollIndicator.style.position = 'absolute';
		scrollIndicator.style.right = '8px';
		scrollIndicator.style.top = '0';
		scrollIndicator.style.bottom = '0';
		scrollIndicator.style.width = '8px';
		scrollIndicator.style.background = 'rgba(20, 20, 40, 0.6)';
		scrollIndicator.style.borderRadius = '4px';
		scrollIndicator.style.pointerEvents = 'none';
		scrollIndicator.style.zIndex = '10';

		const scrollThumb = document.createElement('div');
		scrollThumb.style.position = 'absolute';
		scrollThumb.style.right = '0';
		scrollThumb.style.width = '8px';
		scrollThumb.style.background = 'rgba(74, 144, 226, 0.9)';
		scrollThumb.style.borderRadius = '4px';
		scrollThumb.style.boxShadow = '0 0 4px rgba(74, 144, 226, 0.5)';
		scrollIndicator.appendChild(scrollThumb);

		// Control Mode Selector row
		const controlRow = document.createElement('div');
		controlRow.className = 'control-mode-selector';
		controlRow.style.display = 'flex';
		controlRow.style.flexDirection = 'column';
		controlRow.style.gap = '6px';
		controlRow.style.padding = '4px 0 12px 0';
		controlRow.style.borderBottom = '1px solid rgba(150, 150, 255, 0.2)';
		controlRow.style.marginBottom = '12px';
		controlRow.style.pointerEvents = 'auto';

		const controlLabel = document.createElement('div');
		controlLabel.textContent = 'Control Mode';
		controlLabel.style.color = '#88ddff';
		controlLabel.style.fontSize = '12px';
		controlLabel.style.fontWeight = '700';
		controlLabel.style.textTransform = 'uppercase';
		controlLabel.style.letterSpacing = '1px';
		controlRow.appendChild(controlLabel);

		const controlBtnContainer = document.createElement('div');
		controlBtnContainer.style.display = 'flex';
		controlBtnContainer.style.gap = '8px';
		controlRow.appendChild(controlBtnContainer);

		const modes = [
			{ id: 'auto', label: 'Auto' },
			{ id: 'mobile', label: 'Mobile' },
			{ id: 'desktop', label: 'Desktop' },
			{ id: 'gamepad', label: '🎮 Pad' }
		];

		const modeButtons = {};

		modes.forEach(m => {
			const mBtn = document.createElement('button');
			mBtn.className = 'btn';
			mBtn.type = 'button';
			mBtn.textContent = m.label;
			mBtn.style.flex = '1';
			mBtn.style.padding = '8px 12px';
			mBtn.style.fontSize = '13px';
			mBtn.style.transition = 'all 0.2s ease';

			mBtn.addEventListener('click', (e) => {
				e.preventDefault();
				e.stopPropagation();

				// Save control mode
				if (typeof SaveSystem !== 'undefined') {
					SaveSystem.setControlMode(m.id);
				}
				if (typeof Input !== 'undefined') {
					if (Input.applyControlMode) {
						Input.applyControlMode(m.id, window.Game && window.Game.canvas);
					} else {
						Input.controlMode = m.id;
					}
				}

				// Update button styling
				updateModeButtons();
			});

			controlBtnContainer.appendChild(mBtn);
			modeButtons[m.id] = mBtn;
		});

		updateModeButtons = function() {
			const currentMode = (typeof Input !== 'undefined' && Input.controlMode) ? Input.controlMode : 'auto';
			modes.forEach(m => {
				const btn = modeButtons[m.id];
				if (btn) {
					if (m.id === currentMode) {
						btn.classList.add('btn--primary');
						btn.style.borderColor = 'var(--ui-border)';
						btn.style.background = 'rgba(100, 100, 255, 0.35)';
						btn.style.boxShadow = '0 0 8px rgba(74, 144, 226, 0.4)';
					} else {
						btn.classList.remove('btn--primary');
						btn.style.borderColor = 'rgba(150, 150, 255, 0.3)';
						btn.style.background = 'transparent';
						btn.style.boxShadow = 'none';
					}
				}
			});
		};

		// Initial update
		updateModeButtons();

		// Append to body (modal body) not list, so it doesn't scroll with content
		body.style.position = 'relative';
		body.style.display = 'flex';
		body.style.flexDirection = 'column';
		body.style.minHeight = '0'; // Essential for flex child overflow shrinking
		body.appendChild(controlRow);
		body.appendChild(list);
		body.appendChild(scrollIndicator); // Add after list

		// Update scroll indicator position
		function updateScrollIndicator() {
			// Only show on mobile
			const isMobile = typeof Input !== 'undefined' && Input.isMobileUiMode && Input.isMobileUiMode();

			if (!isMobile) {
				scrollIndicator.style.display = 'none';
				return;
			}

			// Wait for next frame to ensure layout is complete
			requestAnimationFrame(() => {
				const scrollHeight = list.scrollHeight;
				const clientHeight = list.clientHeight;
				const scrollTop = list.scrollTop;

				// Only show if content is scrollable
				if (scrollHeight <= clientHeight + 1) { // +1 for rounding
					scrollIndicator.style.display = 'none';
					return;
				}

				scrollIndicator.style.display = 'block';

				// Position track exactly matching the list's visible bounds
				scrollIndicator.style.top = list.offsetTop + 'px';
				scrollIndicator.style.height = clientHeight + 'px';

				// Calculate thumb height and position
				const scrollableHeight = scrollHeight - clientHeight;
				const thumbHeight = Math.max(30, (clientHeight / scrollHeight) * clientHeight);
				const maxThumbTop = clientHeight - thumbHeight;
				const thumbTop = (scrollTop / scrollableHeight) * maxThumbTop;

				scrollThumb.style.height = thumbHeight + 'px';
				scrollThumb.style.top = thumbTop + 'px';
			});
		}

		// Update on scroll with passive listener for better performance
		list.addEventListener('scroll', updateScrollIndicator, { passive: true });

		// Update on resize
		window.addEventListener('resize', updateScrollIndicator);

		// Store update function for external access
		list._updateScrollIndicator = updateScrollIndicator;

		panel.appendChild(header);
		panel.appendChild(body);

		rootLayer.appendChild(panel);

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

	function refresh() {
		if (!layer) return;
		layer.style.display = isPauseVisible() ? 'flex' : 'none';

		const canSkipOnboarding = typeof Onboarding !== 'undefined'
			&& Onboarding.canSkipGuide
			&& Onboarding.canSkipGuide();
		const canSkipFeature = typeof FeatureTutorials !== 'undefined'
			&& FeatureTutorials.canSkipGuide
			&& FeatureTutorials.canSkipGuide();
		if (skipGuideBtn) {
			skipGuideBtn.style.display = (canSkipOnboarding || canSkipFeature) ? '' : 'none';
		}

		// Update scroll indicator when menu becomes visible
		if (isPauseVisible() && modalBody) {
			if (typeof updateModeButtons === 'function') {
				updateModeButtons();
			}
			// Find the list element and update its scroll indicator
			const listElement = modalBody.querySelector('div[style*="grid"]');
			if (listElement && listElement._updateScrollIndicator) {
				setTimeout(() => listElement._updateScrollIndicator(), 50);
			}
		}
	}

	function tick() {
		refresh();
		requestAnimationFrame(tick);
	}

	function init() {
		createMenu();
		// ESC to resume when menu visible
		document.addEventListener('keydown', (e) => {
			// Don't intercept if user is typing in an input field
			const target = e.target;
			if (typeof isFormFieldTarget === 'function' && isFormFieldTarget(target)) {
				return;
			}

			// Don't handle escape if multiplayer menu is open (let it handle it)
			if (typeof window !== 'undefined' && window.multiplayerMenuVisible) {
				return;
			}

			// Don't handle escape if index machine is open (let it handle it)
			if (typeof window !== 'undefined' && window.UIIndexMachine && window.UIIndexMachine.isOpen && window.UIIndexMachine.isOpen()) {
				return;
			}

			if (e.key === 'Escape' && isPauseVisible()) {
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


