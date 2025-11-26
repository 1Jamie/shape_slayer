(function () {
	let panel, roomNumberEl, enemyCountEl, statusEl;

	function createRoomInfo() {
		const root = window.UIRoot && window.UIRoot.ensure ? window.UIRoot.ensure() : document.body;
		panel = document.createElement('div');
		panel.className = 'room-info-panel';
		panel.style.position = 'fixed';
		panel.style.top = '15px';
		panel.style.left = '50%';
		panel.style.transform = 'translateX(-50%)';
		panel.style.zIndex = '100';
		panel.style.pointerEvents = 'none';
		panel.style.display = 'none';
		
		// Panel styling
		panel.style.width = '280px';
		panel.style.minHeight = '70px';
		panel.style.background = 'linear-gradient(to bottom, rgba(30, 30, 50, 0.9), rgba(20, 20, 40, 0.9))';
		panel.style.border = '2px solid #6666ff';
		panel.style.borderRadius = '4px';
		panel.style.boxShadow = '0 0 10px rgba(102, 102, 255, 0.5), inset 0 0 0 1px rgba(150, 150, 255, 0.3)';
		panel.style.padding = '12px 16px';
		panel.style.textAlign = 'center';
		
		// Room number element
		roomNumberEl = document.createElement('div');
		roomNumberEl.className = 'room-info__number';
		roomNumberEl.style.fontSize = '38px';
		roomNumberEl.style.fontWeight = 'bold';
		roomNumberEl.style.color = '#ffffff';
		roomNumberEl.style.textShadow = '2px 2px 2px rgba(0, 0, 0, 0.8)';
		roomNumberEl.style.marginBottom = '4px';
		roomNumberEl.textContent = 'Room 1';
		
		// Enemy count element
		enemyCountEl = document.createElement('div');
		enemyCountEl.className = 'room-info__enemies';
		enemyCountEl.style.fontSize = '18px';
		enemyCountEl.style.fontWeight = 'bold';
		enemyCountEl.style.color = '#ffaaaa';
		enemyCountEl.style.textShadow = '2px 2px 2px rgba(0, 0, 0, 0.8)';
		enemyCountEl.style.minHeight = '22px';
		
		// Status element (for door open, waiting messages, etc.)
		statusEl = document.createElement('div');
		statusEl.className = 'room-info__status';
		statusEl.style.position = 'absolute';
		statusEl.style.top = 'calc(100% + 8px)';
		statusEl.style.left = '50%';
		statusEl.style.transform = 'translateX(-50%)';
		statusEl.style.fontSize = '22px';
		statusEl.style.fontWeight = 'bold';
		statusEl.style.textShadow = '0 0 10px rgba(0, 0, 0, 1)';
		statusEl.style.whiteSpace = 'nowrap';
		statusEl.style.display = 'none';
		statusEl.style.zIndex = '101';
		
		panel.appendChild(roomNumberEl);
		panel.appendChild(enemyCountEl);
		panel.appendChild(statusEl);
		root.appendChild(panel);
	}

	function getEnemyCount() {
		if (typeof Game === 'undefined') return 0;
		
		const inMultiplayer = Game.multiplayerEnabled;
		let enemyCount = 0;
		
		if (inMultiplayer && Game.enemies) {
			// Multiplayer: Use Game.enemies array (synced from host)
			enemyCount = Game.enemies.filter(e => e && e.alive).length;
		} else if (typeof currentRoom !== 'undefined' && currentRoom && currentRoom.enemies) {
			// Solo: Use currentRoom.enemies
			enemyCount = currentRoom.enemies.filter(e => e && e.alive).length;
		}
		
		return enemyCount;
	}

	function isRoomCleared() {
		if (typeof Game === 'undefined') return false;
		
		const inMultiplayer = Game.multiplayerEnabled;
		
		if (inMultiplayer && Game.enemies) {
			return Game.enemies.filter(e => e && e.alive).length === 0;
		} else if (typeof currentRoom !== 'undefined' && currentRoom) {
			return currentRoom.cleared || false;
		}
		
		return false;
	}

	function update() {
		if (!panel || !roomNumberEl || !enemyCountEl || !statusEl) return;
		
		// Check if we should show the panel
		const shouldShow = window.USE_DOM_UI && 
			typeof Game !== 'undefined' && 
			Game.roomNumber && 
			Game.state === 'PLAYING';
		
		if (!shouldShow) {
			panel.style.display = 'none';
			statusEl.style.display = 'none';
			return;
		}
		
		panel.style.display = 'block';
		
		// Update room number
		roomNumberEl.textContent = `Room ${Game.roomNumber}`;
		
		// Update enemy count / door open status
		const enemyCount = getEnemyCount();
		const roomCleared = isRoomCleared();
		const doorOpen = (typeof currentRoom !== 'undefined' && currentRoom) ? currentRoom.doorOpen : false;
		const inMultiplayer = typeof Game !== 'undefined' && Game.multiplayerEnabled;
		
		if (!roomCleared && enemyCount > 0) {
			// Show enemy count when there are enemies
			enemyCountEl.textContent = `Enemies: ${enemyCount}`;
			enemyCountEl.style.color = '#ffaaaa';
			enemyCountEl.style.display = 'block';
		} else if (doorOpen) {
			// Show "Door Open" in yellow (matching door color) when door is open
			enemyCountEl.textContent = 'Door Open';
			enemyCountEl.style.color = '#ffaa00';
			enemyCountEl.style.display = 'block';
		} else {
			enemyCountEl.style.display = 'none';
		}
		
		// Update multiplayer door waiting status
		if (doorOpen && inMultiplayer) {
			// Check if we have valid multiplayer door state
			const playersOnDoor = (Array.isArray(Game.playersOnDoor)) ? Game.playersOnDoor : [];
			const totalAlivePlayers = (typeof Game.totalAlivePlayers === 'number') ? Game.totalAlivePlayers : 0;
			
			// Show waiting messages if:
			// - There are players on the door
			// - There are alive players not on the door (totalAlivePlayers > playersOnDoor.length)
			// - Total alive players > 1 (multiplayer requirement)
			if (totalAlivePlayers > 1 && playersOnDoor.length > 0 && playersOnDoor.length < totalAlivePlayers) {
				statusEl.style.display = 'block';
				const localPlayerId = Game.getLocalPlayerId ? Game.getLocalPlayerId() : null;
				const localPlayerOnDoor = localPlayerId !== null && playersOnDoor.includes(localPlayerId);
				
				if (localPlayerOnDoor) {
					// Player on door sees: "Waiting for other players"
					statusEl.textContent = 'Waiting for other players';
					statusEl.style.color = '#ffaa00';
				} else {
					// Player NOT on door sees: "Player(s) are waiting for them at the door"
					const waitingCount = playersOnDoor.length;
					const playerText = waitingCount === 1 ? 'player' : 'players';
					statusEl.textContent = `${waitingCount} ${playerText} ${waitingCount === 1 ? 'is' : 'are'} waiting for you at the door`;
					statusEl.style.color = '#ff4444';
				}
				
				// Remove count element if it exists (not needed per requirements)
				let countEl = statusEl.querySelector('.room-info__count');
				if (countEl) {
					countEl.remove();
				}
			} else {
				statusEl.style.display = 'none';
			}
		} else {
			statusEl.style.display = 'none';
		}
		
		// Mobile scaling
		const isMobile = typeof Input !== 'undefined' && Input.isTouchMode && Input.isTouchMode();
		if (isMobile) {
			panel.style.top = '10px';
			panel.style.width = '210px';
			panel.style.minHeight = '52px';
			panel.style.padding = '8px 12px';
			roomNumberEl.style.fontSize = '28px';
			enemyCountEl.style.fontSize = '14px';
			statusEl.style.fontSize = '16px';
		} else {
			panel.style.top = '15px';
			panel.style.width = '280px';
			panel.style.minHeight = '70px';
			panel.style.padding = '12px 16px';
			roomNumberEl.style.fontSize = '38px';
			enemyCountEl.style.fontSize = '18px';
			statusEl.style.fontSize = '22px';
		}
	}

	function tick() {
		update();
		requestAnimationFrame(tick);
	}

	function init() {
		createRoomInfo();
		tick();
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init, { once: true });
	} else {
		init();
	}
})();

