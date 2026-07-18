(function () {
	let layer, modal, codeInput, statusText, codeDisplay, rosterList, isHostBadge, nameInput, joinBtn, createBtn;
	let setupSection, lobbySection, leaveBtn, copyBtn;

	async function ensureMultiplayerModule() {
		// Check if module is already loaded
		if (typeof initMultiplayer !== 'undefined' || window.multiplayerManager) {
			return true;
		}
		
		// Try to load via Game.loadMultiplayerModule if available
		if (typeof Game !== 'undefined' && Game.loadMultiplayerModule && typeof Game.loadMultiplayerModule === 'function') {
			try {
				await Game.loadMultiplayerModule();
				return true;
			} catch (error) {
				console.error('[MultiplayerMenu] Failed to load multiplayer module:', error);
				return false;
			}
		}
		
		// If Game isn't available, try loading the script directly
		return new Promise((resolve) => {
			if (typeof initMultiplayer !== 'undefined') {
				resolve(true);
				return;
			}
			
			const script = document.createElement('script');
			script.src = 'src/js/multiplayer.js';
			script.onload = () => {
				console.log('[MultiplayerMenu] Multiplayer module loaded');
				resolve(true);
			};
			script.onerror = () => {
				console.error('[MultiplayerMenu] Failed to load multiplayer module');
				resolve(false);
			};
			document.head.appendChild(script);
		});
	}

	function getMultiplayerManager() {
		// Try to get existing manager
		if (window.multiplayerManager) {
			return window.multiplayerManager;
		}
		
		// Try to initialize if initMultiplayer exists
		if (typeof initMultiplayer !== 'undefined' && typeof initMultiplayer === 'function') {
			const mgr = initMultiplayer();
			if (mgr) {
				window.multiplayerManager = mgr;
				return mgr;
			}
		}
		
		// Try to create new instance if class exists
		if (typeof MultiplayerManager !== 'undefined') {
			const mgr = new MultiplayerManager();
			window.multiplayerManager = mgr;
			return mgr;
		}
		
		return null;
	}

	function getPlayerName() {
		// Get custom name from SaveSystem if set
		if (typeof SaveSystem !== 'undefined' && SaveSystem.getPlayerName) {
			const customName = SaveSystem.getPlayerName();
			if (customName) {
				return customName;
			}
		}
		// Fallback to Game.player.name if available
		if (typeof Game !== 'undefined' && Game.player && Game.player.name) {
			return Game.player.name;
		}
		return null; // Return null to indicate no name set
	}

	function getPlayerDisplayName(playerIndex) {
		// Get custom name if set, otherwise use player number
		const customName = getPlayerName();
		if (customName) {
			return customName;
		}
		// Return null to indicate we should use player number
		return null;
	}

	function getPlayerClass() {
		if (typeof Game !== 'undefined' && Game.selectedClass) {
			return Game.selectedClass;
		}
		return 'square';
	}

	function createMPMenu() {
		const rootLayer = document.createElement('div');
		rootLayer.className = 'ui-layer ui-layer--modal';
		rootLayer.style.display = 'none';
		rootLayer.style.pointerEvents = 'auto';
		rootLayer.setAttribute('role', 'dialog');
		rootLayer.setAttribute('aria-modal', 'true');
		rootLayer.setAttribute('aria-label', 'Multiplayer');

		const panel = document.createElement('div');
		panel.className = 'modal multiplayer-modal';

		const header = document.createElement('div');
		header.className = 'modal__header';
		header.textContent = 'Multiplayer';

		const body = document.createElement('div');
		body.className = 'modal__body';

		// --- Display name (always visible) ---
		const nameSection = document.createElement('div');
		nameSection.className = 'mp-section';

		const nameLabel = document.createElement('label');
		nameLabel.className = 'mp-label';
		nameLabel.textContent = 'Display Name';
		nameLabel.htmlFor = 'mp-display-name';

		nameInput = document.createElement('input');
		nameInput.id = 'mp-display-name';
		nameInput.className = 'mp-input';
		nameInput.type = 'text';
		nameInput.maxLength = 20;
		nameInput.placeholder = 'Enter your name (optional)';
		nameInput.addEventListener('keydown', (e) => { e.stopPropagation(); });
		nameInput.addEventListener('keyup', (e) => { e.stopPropagation(); });
		if (typeof SaveSystem !== 'undefined' && SaveSystem.getPlayerName) {
			const savedName = SaveSystem.getPlayerName();
			if (savedName) nameInput.value = savedName;
		}

		const saveNameBtn = document.createElement('button');
		saveNameBtn.className = 'btn mp-btn-block';
		saveNameBtn.type = 'button';
		saveNameBtn.textContent = 'Save Name';
		saveNameBtn.addEventListener('click', () => {
			if (typeof SaveSystem !== 'undefined' && SaveSystem.setPlayerName) {
				SaveSystem.setPlayerName(nameInput.value);
				const mgr = getMultiplayerManager();
				if (mgr && mgr.lobbyCode && mgr.send) {
					mgr.send({
						type: 'update_player_name',
						data: { name: nameInput.value || null }
					});
				} else {
					refresh();
				}
				if (window.showToast) {
					window.showToast('Name Saved!', 1500);
				}
			}
		});

		nameSection.appendChild(nameLabel);
		nameSection.appendChild(nameInput);
		nameSection.appendChild(saveNameBtn);

		// --- Setup mode: Create / Join ---
		setupSection = document.createElement('div');
		setupSection.className = 'mp-section mp-setup';

		createBtn = document.createElement('button');
		createBtn.className = 'btn btn--primary mp-btn-block';
		createBtn.type = 'button';
		createBtn.textContent = 'Create Lobby';
		createBtn.addEventListener('click', async () => {
			status('Loading multiplayer system...');

			const loaded = await ensureMultiplayerModule();
			if (!loaded) {
				status('Failed to load multiplayer system');
				console.error('[MultiplayerMenu] Failed to load multiplayer module');
				return;
			}

			const mgr = getMultiplayerManager();
			if (!mgr) {
				status('Multiplayer system not available');
				console.warn('[MultiplayerMenu] MultiplayerManager not available after loading');
				return;
			}

			try {
				status('Creating lobby...');
				const playerName = getPlayerName();
				const playerClass = getPlayerClass();
				await mgr.createLobby(playerName, playerClass);
			} catch (error) {
				console.error('[MultiplayerMenu] Error creating lobby:', error);
				status(error.message || 'Failed to create lobby');
			}
		});

		const divider = document.createElement('div');
		divider.className = 'mp-divider';
		divider.setAttribute('role', 'separator');
		const dividerText = document.createElement('span');
		dividerText.textContent = 'or';
		divider.appendChild(dividerText);

		const joinCluster = document.createElement('div');
		joinCluster.className = 'mp-join';

		const joinLabel = document.createElement('label');
		joinLabel.className = 'mp-label';
		joinLabel.textContent = 'Join with code';
		joinLabel.htmlFor = 'mp-join-code';

		const joinRow = document.createElement('div');
		joinRow.className = 'mp-join__row';

		codeInput = document.createElement('input');
		codeInput.id = 'mp-join-code';
		codeInput.className = 'mp-input mp-input--code';
		codeInput.type = 'text';
		codeInput.maxLength = 6;
		codeInput.placeholder = 'ABC123';
		codeInput.autocomplete = 'off';
		codeInput.spellcheck = false;
		codeInput.addEventListener('keydown', (e) => { e.stopPropagation(); });
		codeInput.addEventListener('keyup', (e) => { e.stopPropagation(); });
		codeInput.addEventListener('input', () => {
			codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
		});

		joinBtn = document.createElement('button');
		joinBtn.className = 'btn';
		joinBtn.type = 'button';
		joinBtn.textContent = 'Join Lobby';
		joinBtn.addEventListener('click', async () => {
			const code = (codeInput.value || '').trim().toUpperCase();
			if (!code || code.length !== 6) {
				status('Please enter a 6-character code');
				return;
			}

			status('Loading multiplayer system...');

			const loaded = await ensureMultiplayerModule();
			if (!loaded) {
				status('Failed to load multiplayer system');
				console.error('[MultiplayerMenu] Failed to load multiplayer module');
				return;
			}

			const mgr = getMultiplayerManager();
			if (!mgr) {
				status('Multiplayer system not available');
				console.warn('[MultiplayerMenu] MultiplayerManager not available after loading');
				return;
			}

			try {
				status('Joining lobby...');
				const playerName = getPlayerName();
				const playerClass = getPlayerClass();
				await mgr.joinLobby(code, playerName, playerClass);
			} catch (error) {
				console.error('[MultiplayerMenu] Error joining lobby:', error);
				status(error.message || 'Failed to join lobby');
			}
		});

		joinRow.appendChild(codeInput);
		joinRow.appendChild(joinBtn);
		joinCluster.appendChild(joinLabel);
		joinCluster.appendChild(joinRow);

		setupSection.appendChild(createBtn);
		setupSection.appendChild(divider);
		setupSection.appendChild(joinCluster);

		// --- Lobby mode: code + roster + leave ---
		lobbySection = document.createElement('div');
		lobbySection.className = 'mp-section mp-lobby';
		lobbySection.hidden = true;

		const lobbyHeader = document.createElement('div');
		lobbyHeader.className = 'mp-lobby__header';

		const codeBlock = document.createElement('div');
		codeBlock.className = 'mp-code';

		const codeLabel = document.createElement('div');
		codeLabel.className = 'mp-label';
		codeLabel.textContent = 'Lobby code';

		codeDisplay = document.createElement('div');
		codeDisplay.className = 'mp-code__value';

		isHostBadge = document.createElement('span');
		isHostBadge.className = 'mp-host-badge';

		codeBlock.appendChild(codeLabel);
		codeBlock.appendChild(codeDisplay);

		const codeActions = document.createElement('div');
		codeActions.className = 'mp-lobby__actions';

		copyBtn = document.createElement('button');
		copyBtn.className = 'btn';
		copyBtn.type = 'button';
		copyBtn.textContent = 'Copy Code';
		copyBtn.addEventListener('click', async () => {
			const mgr = getMultiplayerManager();
			const code = (mgr && mgr.lobbyCode) || '';
			if (!code) {
				status('No lobby code to copy');
				return;
			}

			if (navigator.clipboard && navigator.clipboard.writeText) {
				try {
					await navigator.clipboard.writeText(code);
					status('Code copied!');
					if (window.showToast) {
						window.showToast('Code Copied!', 1500);
					}
				} catch (error) {
					console.error('[MultiplayerMenu] Failed to copy code:', error);
					status('Failed to copy code');
				}
			} else {
				const textArea = document.createElement('textarea');
				textArea.value = code;
				textArea.style.position = 'fixed';
				textArea.style.opacity = '0';
				document.body.appendChild(textArea);
				textArea.select();
				try {
					document.execCommand('copy');
					status('Code copied!');
					if (window.showToast) {
						window.showToast('Code Copied!', 1500);
					}
				} catch (error) {
					console.error('[MultiplayerMenu] Failed to copy code:', error);
					status('Failed to copy code');
				}
				document.body.removeChild(textArea);
			}
		});

		codeActions.appendChild(isHostBadge);
		codeActions.appendChild(copyBtn);

		lobbyHeader.appendChild(codeBlock);
		lobbyHeader.appendChild(codeActions);

		rosterList = document.createElement('div');
		rosterList.className = 'mp-roster';

		leaveBtn = document.createElement('button');
		leaveBtn.className = 'btn mp-btn-block';
		leaveBtn.type = 'button';
		leaveBtn.textContent = 'Leave Lobby';
		leaveBtn.addEventListener('click', async () => {
			await ensureMultiplayerModule();

			const mgr = getMultiplayerManager();
			if (!mgr) {
				status('Multiplayer system not available');
				return;
			}

			try {
				mgr.leaveLobby();
				refresh();
				status('Left lobby');
			} catch (error) {
				console.error('[MultiplayerMenu] Error leaving lobby:', error);
				status(error.message || 'Failed to leave lobby');
			}
		});

		lobbySection.appendChild(lobbyHeader);
		lobbySection.appendChild(rosterList);
		lobbySection.appendChild(leaveBtn);

		statusText = document.createElement('div');
		statusText.className = 'mp-status';
		statusText.setAttribute('aria-live', 'polite');

		body.appendChild(nameSection);
		body.appendChild(setupSection);
		body.appendChild(lobbySection);
		body.appendChild(statusText);

		const footer = document.createElement('div');
		footer.className = 'modal__footer';
		const close = document.createElement('button');
		close.className = 'btn';
		close.type = 'button';
		close.textContent = 'Back';
		close.addEventListener('click', () => {
			hide();
		});
		footer.appendChild(close);

		panel.appendChild(header);
		panel.appendChild(body);
		panel.appendChild(footer);
		rootLayer.appendChild(panel);

		const root = window.UIRoot && window.UIRoot.ensure ? window.UIRoot.ensure() : document.body;
		root.appendChild(rootLayer);
		layer = rootLayer;
		modal = panel;
	}

	function status(msg) {
		if (!statusText) return;
		statusText.textContent = msg || '';
		statusText.hidden = !msg;
		console.log('[MultiplayerMenu]', msg);
	}

	async function show() {
		if (!layer) return;

		// Room 0 tutorial must be finished before MP lobby create/join
		const mpAllowed = typeof SaveSystem !== 'undefined' && SaveSystem.canAccessMultiplayer
			? SaveSystem.canAccessMultiplayer()
			: (typeof SaveSystem !== 'undefined' && SaveSystem.getOnboarding
				? !!(SaveSystem.getOnboarding().room0TutorialDone)
				: false);
		if (!mpAllowed) {
			const hint = (typeof SaveSystem !== 'undefined' && SaveSystem.getMultiplayerLockHint)
				? (SaveSystem.getMultiplayerLockHint() || 'Finish your first run (Room 0 tutorial) first')
				: 'Finish your first run (Room 0 tutorial) first';
			if (typeof window.showToast === 'function') {
				window.showToast(hint, 3200);
			}
			console.log('[MultiplayerMenu] Blocked - Room 0 tutorial not finished');
			return;
		}
		
		// Load saved name into input field when menu opens
		if (nameInput && typeof SaveSystem !== 'undefined' && SaveSystem.getPlayerName) {
			const savedName = SaveSystem.getPlayerName();
			if (savedName) {
				nameInput.value = savedName;
			} else {
				nameInput.value = '';
			}
		}

		status('');
		
		// Try to ensure module is loaded when opening (but don't block)
		ensureMultiplayerModule().then(() => {
			refresh();
		}).catch(() => {
			// Module load failed, but still show menu
			refresh();
		});
		
		// Set visibility flag for escape key handling
		if (typeof window !== 'undefined') {
			window.multiplayerMenuVisible = true;
		}
		
		layer.style.display = 'flex';
		// Focus the modal panel itself so escape key works immediately
		if (modal) {
			modal.setAttribute('tabindex', '-1');
			modal.focus();
		}
		// Prefer action buttons on gamepad; text fields need a keyboard
		setTimeout(() => {
			const usingGamepad = typeof Input !== 'undefined'
				&& ((Input.isGamepadMode && Input.isGamepadMode())
					|| Input._activeInputSource === 'gamepad');
			const mgr = getMultiplayerManager();
			const inLobby = !!(mgr && mgr.lobbyCode);
			if (usingGamepad) {
				if (inLobby && leaveBtn) leaveBtn.focus();
				else if (createBtn) createBtn.focus();
				return;
			}
			if (!inLobby && codeInput) codeInput.focus();
			else if (nameInput) nameInput.focus();
		}, 100);
	}

	function hide() {
		if (!layer) return;
		
		// Clear visibility flag
		if (typeof window !== 'undefined') {
			window.multiplayerMenuVisible = false;
		}
		
		layer.style.display = 'none';
	}

	function createShapeIcon(shape, color, size = 16) {
		const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		svg.setAttribute('width', size);
		svg.setAttribute('height', size);
		svg.setAttribute('viewBox', `-${size} -${size} ${size * 2} ${size * 2}`);
		svg.classList.add('mp-roster__icon');

		const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
		path.setAttribute('fill', color);

		if (shape === 'triangle') {
			path.setAttribute('d', `M ${size} 0 L ${-size * 0.5} ${-size * 0.866} L ${-size * 0.5} ${size * 0.866} Z`);
		} else if (shape === 'hexagon') {
			const points = [];
			for (let i = 0; i < 6; i++) {
				const angle = (Math.PI / 3) * i;
				const px = Math.cos(angle) * size;
				const py = Math.sin(angle) * size;
				points.push(`${px},${py}`);
			}
			path.setAttribute('d', `M ${points.join(' L ')} Z`);
		} else if (shape === 'pentagon') {
			const rotationOffset = 18 * Math.PI / 180;
			const points = [];
			for (let i = 0; i < 5; i++) {
				const angle = (Math.PI * 2 / 5) * i - Math.PI / 2 + rotationOffset;
				const px = Math.cos(angle) * size;
				const py = Math.sin(angle) * size;
				points.push(`${px},${py}`);
			}
			path.setAttribute('d', `M ${points.join(' L ')} Z`);
		} else {
			// Square (default)
			path.setAttribute('d', `M ${-size * 0.8} ${-size * 0.8} L ${size * 0.8} ${-size * 0.8} L ${size * 0.8} ${size * 0.8} L ${-size * 0.8} ${size * 0.8} Z`);
		}

		svg.appendChild(path);
		return svg;
	}

	function getClassShapeAndColor(playerClass) {
		const classMap = {
			square: { shape: 'square', color: '#4a90e2' },
			triangle: { shape: 'triangle', color: '#ff1493' },
			pentagon: { shape: 'pentagon', color: '#c72525' },
			hexagon: { shape: 'hexagon', color: '#9c27b0' }
		};
		return classMap[playerClass] || classMap.square;
	}

	function refresh() {
		const mgr = getMultiplayerManager();
		const code = (mgr && mgr.lobbyCode) || '';
		const inLobby = !!code;

		if (setupSection) setupSection.hidden = inLobby;
		if (lobbySection) lobbySection.hidden = !inLobby;

		if (codeDisplay) {
			codeDisplay.textContent = code || '';
		}
		if (isHostBadge) {
			const isHost = !!(mgr && mgr.isHost);
			isHostBadge.textContent = isHost ? 'Host' : '';
			isHostBadge.hidden = !isHost;
		}

		if (rosterList) {
			rosterList.innerHTML = '';
			const players = (mgr && mgr.players) || [];
			if (inLobby && Array.isArray(players) && players.length > 0) {
				const title = document.createElement('div');
				title.className = 'mp-roster__title';
				title.textContent = 'Players';
				rosterList.appendChild(title);

				const playerIndexMap = new Map();
				players.forEach((p, idx) => {
					playerIndexMap.set(p.id, idx);
				});

				const sortedPlayers = [...players].sort((a, b) => {
					if (mgr && mgr.isHost) {
						if (a.id === mgr.playerId) return -1;
						if (b.id === mgr.playerId) return 1;
					}
					const idxA = playerIndexMap.get(a.id) || 0;
					const idxB = playerIndexMap.get(b.id) || 0;
					return idxA - idxB;
				});

				sortedPlayers.forEach((p, index) => {
					const row = document.createElement('div');
					row.className = 'mp-roster__row';
					if (mgr && mgr.playerId === p.id) {
						row.classList.add('mp-roster__row--you');
					}
					if (p.disconnected) {
						row.classList.add('mp-roster__row--offline');
					}

					const leftSide = document.createElement('div');
					leftSide.className = 'mp-roster__player';

					const playerClass = p.class || 'square';
					const { shape, color } = getClassShapeAndColor(playerClass);
					leftSide.appendChild(createShapeIcon(shape, color, 14));

					const playerNumber = index + 1;
					const nameText = document.createElement('span');
					nameText.className = 'mp-roster__name';

					let displayName;
					if (p.name && p.name.trim() !== '' && p.name !== 'Player') {
						displayName = p.name;
					} else {
						displayName = `Player ${playerNumber}`;
					}

					nameText.textContent = displayName;
					if (p.disconnected) {
						nameText.textContent += ' (Offline)';
					}
					if (mgr && mgr.playerId === p.id) {
						nameText.textContent += ' (You)';
					}
					leftSide.appendChild(nameText);
					row.appendChild(leftSide);

					if (mgr && mgr.isHost && p.id !== mgr.playerId) {
						const kickBtn = document.createElement('button');
						kickBtn.className = 'btn mp-kick-btn';
						kickBtn.type = 'button';
						kickBtn.textContent = 'Kick';
						kickBtn.addEventListener('click', async (e) => {
							e.stopPropagation();
							const confirmed = typeof window.showConfirm === 'function'
								? await window.showConfirm(`Kick Player ${playerNumber}?`)
								: confirm(`Kick Player ${playerNumber}?`);
							if (confirmed) {
								if (mgr && mgr.send) {
									mgr.send({
										type: 'kick_player',
										data: { playerId: p.id }
									});
								}
							}
						});
						row.appendChild(kickBtn);
					}

					rosterList.appendChild(row);
				});
			} else if (inLobby) {
				const empty = document.createElement('div');
				empty.className = 'mp-roster__empty';
				empty.textContent = 'Waiting for players…';
				rosterList.appendChild(empty);
			}
		}
	}

	function init() {
		createMPMenu();
		window.UIMultiplayer = {
			open: show,
			close: hide,
			refresh: refresh
		};
		
		// Handle escape key to close multiplayer menu and return to pause menu
		document.addEventListener('keydown', (e) => {
			const isVisible = layer && layer.style.display !== 'none' && layer.style.display !== '';
			const isVisibleFlag = typeof window !== 'undefined' && window.multiplayerMenuVisible;
			
			if (e.key === 'Escape' && (isVisible || isVisibleFlag)) {
				console.log('[MultiplayerMenu] Escape key pressed, closing menu. isVisible:', isVisible, 'isVisibleFlag:', isVisibleFlag);
				hide();
				if (typeof Game !== 'undefined' && typeof Game.showPauseMenu !== 'undefined') {
					Game.showPauseMenu = true;
				}
				e.preventDefault();
				e.stopPropagation();
				return;
			}
		}, { capture: true });
		
		let toastShown = { created: false, joined: false };
		
		if (window.UIBus && UIBus.on) {
			UIBus.on('mp:lobby:created', () => {
				refresh();
				status('Lobby created!');
				if (window.showToast && !toastShown.created) {
					toastShown.created = true;
					window.showToast('Lobby Created!', 2000);
					setTimeout(() => { toastShown.created = false; }, 3000);
				}
			});
			UIBus.on('mp:lobby:joined', () => {
				refresh();
				status('Joined lobby!');
				if (window.showToast && !toastShown.joined) {
					toastShown.joined = true;
					window.showToast('Connected to Lobby!', 2000);
					setTimeout(() => { toastShown.joined = false; }, 3000);
				}
			});
			UIBus.on('mp:lobby:error', (e) => {
				const msg = (e && e.message) ? e.message : (typeof e === 'string' ? e : 'Error');
				status(msg);
			});
			UIBus.on('mp:lobby:players', () => {
				refresh();
			});
			UIBus.on('mp:player_list_update', () => {
				refresh();
			});
		}
		
		setInterval(() => {
			if (layer && layer.style.display !== 'none') {
				refresh();
			}
		}, 1000);
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init, { once: true });
	} else {
		init();
	}
})();
