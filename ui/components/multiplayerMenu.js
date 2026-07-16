(function () {
	let layer, modal, codeInput, statusText, codeDisplay, rosterList, isHostBadge, nameInput, joinBtn, createBtn;

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
			script.src = 'js/multiplayer.js';
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
		body.style.display = 'grid';
		body.style.gap = '12px';

		// Lobby code display and host badge
		const headerRow = document.createElement('div');
		headerRow.style.display = 'flex';
		headerRow.style.justifyContent = 'space-between';
		codeDisplay = document.createElement('div');
		codeDisplay.style.fontWeight = '700';
		isHostBadge = document.createElement('div');
		isHostBadge.style.opacity = '0.8';
		headerRow.appendChild(codeDisplay);
		headerRow.appendChild(isHostBadge);
		body.appendChild(headerRow);

		// Player name input
		const nameWrap = document.createElement('div');
		const nameLabel = document.createElement('label');
		nameLabel.textContent = 'Display Name';
		nameLabel.style.display = 'block';
		nameLabel.style.marginBottom = '4px';
		nameLabel.style.fontSize = '14px';
		nameInput = document.createElement('input');
		nameInput.type = 'text';
		nameInput.maxLength = 20;
		nameInput.placeholder = 'Enter your name (optional)';
		nameInput.style.width = '100%';
		nameInput.style.padding = '8px';
		nameInput.style.border = '1px solid rgba(150,150,255,0.3)';
		nameInput.style.borderRadius = '4px';
		nameInput.style.background = 'rgba(0,0,0,0.3)';
		nameInput.style.color = '#fff';
		nameInput.style.fontSize = '14px';
		// Prevent keyboard shortcuts from interfering when typing
		nameInput.addEventListener('keydown', (e) => {
			e.stopPropagation();
		});
		nameInput.addEventListener('keyup', (e) => {
			e.stopPropagation();
		});
		// Load saved name
		if (typeof SaveSystem !== 'undefined' && SaveSystem.getPlayerName) {
			const savedName = SaveSystem.getPlayerName();
			if (savedName) {
				nameInput.value = savedName;
			}
		}
		
		// Save button
		const saveNameBtn = document.createElement('button');
		saveNameBtn.className = 'btn';
		saveNameBtn.textContent = 'Save Name';
		saveNameBtn.style.marginTop = '8px';
		saveNameBtn.style.width = '100%';
		saveNameBtn.addEventListener('click', () => {
			// Save name when button is clicked
			if (typeof SaveSystem !== 'undefined' && SaveSystem.setPlayerName) {
				SaveSystem.setPlayerName(nameInput.value);
				// Update name in lobby if connected
				const mgr = getMultiplayerManager();
				if (mgr && mgr.lobbyCode && mgr.send) {
					// Send name update to server
					mgr.send({
						type: 'update_player_name',
						data: { name: nameInput.value || null }
					});
					// Don't refresh immediately - wait for server to broadcast update
					// The server will send player_list_update which will trigger refresh
				} else {
					// Not in a lobby, just refresh locally
					refresh();
				}
				// Show confirmation
				if (window.showToast) {
					window.showToast('Name Saved!', 1500);
				}
			}
		});
		
		nameWrap.appendChild(nameLabel);
		nameWrap.appendChild(nameInput);
		nameWrap.appendChild(saveNameBtn);
		body.appendChild(nameWrap);

		createBtn = document.createElement('button');
		createBtn.className = 'btn btn--primary';
		createBtn.textContent = 'Create Lobby';
		createBtn.addEventListener('click', async () => {
			status('Loading multiplayer system...');
			
			// Ensure module is loaded first
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
				// Get name from SaveSystem, or use null to let server assign Player 1
				const playerName = getPlayerName();
				const playerClass = getPlayerClass();
				await mgr.createLobby(playerName, playerClass);
				// Don't refresh immediately - wait for server response via UIBus event
				// Toast will be shown by UIBus event handler
			} catch (error) {
				console.error('[MultiplayerMenu] Error creating lobby:', error);
				status(error.message || 'Failed to create lobby');
			}
		});

		const inputWrap = document.createElement('div');
		const inputLabel = document.createElement('label');
		inputLabel.textContent = 'Join code';
		inputLabel.style.display = 'block';
		codeInput = document.createElement('input');
		codeInput.type = 'text';
		codeInput.maxLength = 6;
		codeInput.placeholder = 'ABC123';
		codeInput.style.width = '100%';
		codeInput.addEventListener('input', () => {
			codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
		});
		inputWrap.appendChild(inputLabel);
		inputWrap.appendChild(codeInput);

		joinBtn = document.createElement('button');
		joinBtn.className = 'btn';
		joinBtn.textContent = 'Join Lobby';
		joinBtn.addEventListener('click', async () => {
			const code = (codeInput.value || '').trim().toUpperCase();
			if (!code || code.length !== 6) {
				status('Please enter a 6-character code');
				return;
			}
			
			status('Loading multiplayer system...');
			
			// Ensure module is loaded first
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
				// Get name from SaveSystem, or use null to let server assign player number
				const playerName = getPlayerName();
				const playerClass = getPlayerClass();
				await mgr.joinLobby(code, playerName, playerClass);
				// Don't refresh immediately - wait for server response via UIBus event
				// Toast will be shown by UIBus event handler
			} catch (error) {
				console.error('[MultiplayerMenu] Error joining lobby:', error);
				status(error.message || 'Failed to join lobby');
			}
		});

		const copyBtn = document.createElement('button');
		copyBtn.className = 'btn';
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
					// Show toast notification
					if (window.showToast) {
						window.showToast('Code Copied!', 1500);
					}
				} catch (error) {
					console.error('[MultiplayerMenu] Failed to copy code:', error);
					status('Failed to copy code');
				}
			} else {
				// Fallback for older browsers
				const textArea = document.createElement('textarea');
				textArea.value = code;
				textArea.style.position = 'fixed';
				textArea.style.opacity = '0';
				document.body.appendChild(textArea);
				textArea.select();
				try {
					document.execCommand('copy');
					status('Code copied!');
					// Show toast notification
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

		rosterList = document.createElement('div');
		rosterList.style.borderTop = '1px solid rgba(150,150,255,0.3)';
		rosterList.style.paddingTop = '12px';
		rosterList.style.marginTop = '8px';

		const leaveBtn = document.createElement('button');
		leaveBtn.className = 'btn';
		leaveBtn.textContent = 'Leave Lobby';
		leaveBtn.addEventListener('click', async () => {
			// Ensure module is loaded first
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

		statusText = document.createElement('div');
		statusText.className = 'sr-only';

		body.appendChild(createBtn);
		body.appendChild(inputWrap);
		body.appendChild(joinBtn);
		body.appendChild(copyBtn);
		body.appendChild(rosterList);
		body.appendChild(leaveBtn);
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
		statusText.textContent = msg;
		// Also log for debugging
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
			console.log('[MultiplayerMenu] Blocked — Room 0 tutorial not finished');
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
		// We'll focus the input after a short delay to allow escape to work
		if (modal) {
			modal.setAttribute('tabindex', '-1');
			modal.focus();
		}
		// Focus the code input after a brief delay (allows escape to work first)
		setTimeout(() => {
			if (codeInput) codeInput.focus();
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
		svg.style.display = 'inline-block';
		svg.style.verticalAlign = 'middle';
		svg.style.marginRight = '8px';
		svg.style.flexShrink = '0';

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
		// Map player class to shape and color
		const classMap = {
			square: { shape: 'square', color: '#4a90e2' },
			triangle: { shape: 'triangle', color: '#ff1493' },
			pentagon: { shape: 'pentagon', color: '#c72525' },
			hexagon: { shape: 'hexagon', color: '#9c27b0' }
		};
		return classMap[playerClass] || classMap.square;
	}

	function refresh() {
		// Reflect lobby state: code + roster
		const mgr = getMultiplayerManager();
		const code = (mgr && mgr.lobbyCode) || '';
		const inLobby = !!code;
		
		if (codeDisplay) {
			codeDisplay.textContent = code ? `Code: ${code}` : '';
		}
		if (isHostBadge) {
			isHostBadge.textContent = (mgr && mgr.isHost) ? 'Host' : '';
		}
		
		// Disable/enable create lobby, join button and code input based on lobby state
		if (createBtn) {
			createBtn.disabled = inLobby;
			createBtn.style.opacity = inLobby ? '0.5' : '1';
			createBtn.style.cursor = inLobby ? 'not-allowed' : 'pointer';
		}
		if (joinBtn) {
			joinBtn.disabled = inLobby;
			joinBtn.style.opacity = inLobby ? '0.5' : '1';
			joinBtn.style.cursor = inLobby ? 'not-allowed' : 'pointer';
		}
		if (codeInput) {
			codeInput.disabled = inLobby;
			codeInput.style.opacity = inLobby ? '0.5' : '1';
			codeInput.style.cursor = inLobby ? 'not-allowed' : 'text';
		}
		
		// Don't update name input here - only load it when menu opens
		// This prevents overwriting what the user is typing
		if (rosterList) {
			rosterList.innerHTML = '';
			const players = (mgr && mgr.players) || [];
			if (Array.isArray(players) && players.length > 0) {
				const title = document.createElement('div');
				title.style.fontWeight = '700';
				title.style.marginBottom = '8px';
				title.textContent = 'Players';
				rosterList.appendChild(title);

				// Sort players: host first, then by join order
				// Create a map of player IDs to their index in the original array
				const playerIndexMap = new Map();
				players.forEach((p, idx) => {
					playerIndexMap.set(p.id, idx);
				});
				
				const sortedPlayers = [...players].sort((a, b) => {
					// Host always comes first
					if (mgr && mgr.isHost) {
						if (a.id === mgr.playerId) return -1;
						if (b.id === mgr.playerId) return 1;
					}
					// Otherwise maintain original order
					const idxA = playerIndexMap.get(a.id) || 0;
					const idxB = playerIndexMap.get(b.id) || 0;
					return idxA - idxB;
				});

				sortedPlayers.forEach((p, index) => {
					const row = document.createElement('div');
					row.style.display = 'flex';
					row.style.alignItems = 'center';
					row.style.justifyContent = 'space-between';
					row.style.padding = '8px 12px';
					row.style.marginBottom = '6px';
					row.style.borderRadius = '6px';
					row.style.background = (mgr && mgr.playerId === p.id) ? 'rgba(120, 160, 255, 0.25)' : 'rgba(120, 160, 255, 0.15)';
					row.style.border = (mgr && mgr.playerId === p.id) ? '1px solid rgba(120, 160, 255, 0.4)' : '1px solid rgba(120, 160, 255, 0.2)';

					const leftSide = document.createElement('div');
					leftSide.style.display = 'flex';
					leftSide.style.alignItems = 'center';
					leftSide.style.flex = '1';

					// Add shape icon
					const playerClass = p.class || 'square';
					const { shape, color } = getClassShapeAndColor(playerClass);
					const icon = createShapeIcon(shape, color, 14);
					leftSide.appendChild(icon);

					// Add player number and name
					const playerNumber = index + 1;
					const nameText = document.createElement('span');
					
					// Always use the name from the server's player list (p.name)
					// If name is set and not empty, use it; otherwise use player number
					let displayName;
					if (p.name && p.name.trim() !== '' && p.name !== 'Player') {
						displayName = p.name;
					} else {
						displayName = `Player ${playerNumber}`;
					}
					
					nameText.textContent = displayName;
					if (mgr && mgr.playerId === p.id) {
						nameText.textContent += ' (You)';
						nameText.style.fontWeight = '700';
					}
					leftSide.appendChild(nameText);
					row.appendChild(leftSide);

					// Add kick button for host (if not self)
					if (mgr && mgr.isHost && p.id !== mgr.playerId) {
						const kickBtn = document.createElement('button');
						kickBtn.textContent = 'Kick';
						kickBtn.style.padding = '4px 12px';
						kickBtn.style.fontSize = '12px';
						kickBtn.style.fontWeight = '600';
						kickBtn.style.background = 'rgba(200, 50, 50, 0.9)';
						kickBtn.style.color = '#fff';
						kickBtn.style.border = '1px solid rgba(200, 50, 50, 1)';
						kickBtn.style.borderRadius = '4px';
						kickBtn.style.cursor = 'pointer';
						kickBtn.style.marginLeft = '8px';
						kickBtn.style.transition = 'background 0.2s';
						kickBtn.addEventListener('mouseenter', () => {
							kickBtn.style.background = 'rgba(220, 70, 70, 1)';
						});
						kickBtn.addEventListener('mouseleave', () => {
							kickBtn.style.background = 'rgba(200, 50, 50, 0.9)';
						});
						kickBtn.addEventListener('click', async (e) => {
							e.stopPropagation();
							const confirmed = typeof window.showConfirm === 'function'
								? await window.showConfirm(`Kick Player ${playerNumber}?`)
								: confirm(`Kick Player ${playerNumber}?`);
							if (confirmed) {
								// Send kick message to server
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
		// Use capture phase to run before other handlers
		document.addEventListener('keydown', (e) => {
			// Check if multiplayer menu is visible first
			const isVisible = layer && layer.style.display !== 'none' && layer.style.display !== '';
			const isVisibleFlag = typeof window !== 'undefined' && window.multiplayerMenuVisible;
			
			// Only handle escape if menu is visible
			if (e.key === 'Escape' && (isVisible || isVisibleFlag)) {
				// Allow escape to work even if focus is on an input field
				// (Escape should always close modals, even when typing)
				console.log('[MultiplayerMenu] Escape key pressed, closing menu. isVisible:', isVisible, 'isVisibleFlag:', isVisibleFlag);
				hide();
				// Ensure pause menu is visible after closing multiplayer menu
				if (typeof Game !== 'undefined' && typeof Game.showPauseMenu !== 'undefined') {
					Game.showPauseMenu = true;
				}
				e.preventDefault();
				e.stopPropagation();
				return; // Stop event from propagating further
			}
		}, { capture: true });
		
		// Track if we've already shown toast to prevent duplicates
		let toastShown = { created: false, joined: false };
		
		// Subscribe to MP events to keep view synced
		if (window.UIBus && UIBus.on) {
			UIBus.on('mp:lobby:created', () => {
				refresh();
				status('Lobby created!');
				// Show toast notification (only once)
				if (window.showToast && !toastShown.created) {
					toastShown.created = true;
					window.showToast('Lobby Created!', 2000);
					setTimeout(() => { toastShown.created = false; }, 3000);
				}
			});
			UIBus.on('mp:lobby:joined', () => {
				refresh();
				status('Joined lobby!');
				// Show toast notification (only once)
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
			UIBus.on('mp:player:joined', () => {
				refresh();
			});
			UIBus.on('mp:player:left', () => {
				refresh();
			});
			UIBus.on('mp:player_list_update', () => {
				refresh();
			});
		}
		
		// Also set up periodic refresh in case events are missed
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


