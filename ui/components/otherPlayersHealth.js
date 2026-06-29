(function () {
	let container, list;
	const playerBars = new Map(); // Map<playerId, HTMLElement> - cache bars for updates

	function createClassIcon(shape, color, size = 14) {
		const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		svg.setAttribute('width', size);
		svg.setAttribute('height', size);
		svg.setAttribute('viewBox', `-${size} -${size} ${size * 2} ${size * 2}`);
		svg.style.display = 'block';
		svg.style.flexShrink = '0';

		const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
		let pathData = '';

		if (shape === 'triangle') {
			pathData = `M ${size} 0 L ${-size * 0.5} ${-size * 0.866} L ${-size * 0.5} ${size * 0.866} Z`;
		} else if (shape === 'hexagon') {
			const points = [];
			for (let i = 0; i < 6; i++) {
				const angle = (Math.PI / 3) * i;
				const px = Math.cos(angle) * size;
				const py = Math.sin(angle) * size;
				points.push(`${px},${py}`);
			}
			pathData = `M ${points.join(' L ')} Z`;
		} else if (shape === 'pentagon') {
			const rotationOffset = 18 * Math.PI / 180;
			const points = [];
			for (let i = 0; i < 5; i++) {
				const angle = (Math.PI * 2 / 5) * i - Math.PI / 2 + rotationOffset;
				const px = Math.cos(angle) * size;
				const py = Math.sin(angle) * size;
				points.push(`${px},${py}`);
			}
			pathData = `M ${points.join(' L ')} Z`;
		} else {
			// Square (default)
			const halfSize = size * 0.8;
			pathData = `M ${-halfSize} ${-halfSize} L ${halfSize} ${-halfSize} L ${halfSize} ${halfSize} L ${-halfSize} ${halfSize} Z`;
		}

		path.setAttribute('d', pathData);
		path.setAttribute('fill', color);
		svg.appendChild(path);
		return svg;
	}

	function createPlayerBar(playerId, playerInstance, playerName, classKey) {
		const wrap = document.createElement('div');
		wrap.style.display = 'flex';
		wrap.style.alignItems = 'center';
		wrap.style.gap = '8px';
		wrap.style.marginBottom = '8px';
		wrap.style.padding = '6px 8px';
		wrap.style.background = 'rgba(20, 20, 30, 0.85)';
		wrap.style.border = '1px solid rgba(100, 150, 255, 0.4)';
		wrap.style.borderRadius = '6px';
		wrap.style.minWidth = '240px';
		wrap.style.position = 'relative';

		// Get class definition for shape and color
		let playerShape = 'square';
		let playerColor = '#888888';
		if (typeof CLASS_DEFINITIONS !== 'undefined') {
			const classDef = CLASS_DEFINITIONS[classKey] || CLASS_DEFINITIONS.square;
			playerShape = classDef.shape || 'square';
			playerColor = classDef.color || '#888888';
		}

		// Class icon
		const iconContainer = document.createElement('div');
		iconContainer.style.display = 'flex';
		iconContainer.style.alignItems = 'center';
		iconContainer.style.justifyContent = 'center';
		iconContainer.style.width = '20px';
		iconContainer.style.height = '20px';
		iconContainer.style.flexShrink = '0';
		const icon = createClassIcon(playerShape, playerColor, 12);
		iconContainer.appendChild(icon);

		// Name and bars container
		const infoContainer = document.createElement('div');
		infoContainer.style.display = 'flex';
		infoContainer.style.flexDirection = 'column';
		infoContainer.style.gap = '4px';
		infoContainer.style.flex = '1';
		infoContainer.style.minWidth = '0';

		// Player name
		const name = document.createElement('div');
		name.textContent = playerName || `Player ${playerId || ''}`;
		name.style.color = '#ffffff';
		name.style.fontSize = '12px';
		name.style.fontWeight = 'bold';
		name.style.textShadow = '0 0 3px rgba(0,0,0,0.8)';
		name.style.whiteSpace = 'nowrap';
		name.style.overflow = 'hidden';
		name.style.textOverflow = 'ellipsis';

		// Shield bar (if they have shields)
		const shieldBar = document.createElement('div');
		shieldBar.style.height = '10px';
		shieldBar.style.background = 'rgba(255,255,255,0.08)';
		shieldBar.style.border = '1px solid rgba(0,200,255,0.4)';
		shieldBar.style.borderRadius = '4px';
		shieldBar.style.overflow = 'hidden';
		shieldBar.style.display = 'none'; // Hidden by default
		const shieldBarFill = document.createElement('div');
		shieldBarFill.style.height = '100%';
		shieldBarFill.style.width = '0%';
		shieldBarFill.style.background = 'linear-gradient(to bottom, #66ccff, #0099cc)';
		shieldBar.appendChild(shieldBarFill);

		// HP bar
		const hpBar = document.createElement('div');
		hpBar.style.height = '12px';
		hpBar.style.background = 'rgba(255,255,255,0.08)';
		hpBar.style.border = '1px solid rgba(150,150,255,0.3)';
		hpBar.style.borderRadius = '4px';
		hpBar.style.overflow = 'hidden';
		hpBar.style.position = 'relative';
		const hpBarFill = document.createElement('div');
		hpBarFill.style.height = '100%';
		hpBarFill.style.width = '0%';
		hpBarFill.style.transition = 'width 0.1s ease-out';
		hpBar.appendChild(hpBarFill);

		// HP text overlay
		const hpText = document.createElement('div');
		hpText.style.position = 'absolute';
		hpText.style.left = '50%';
		hpText.style.top = '50%';
		hpText.style.transform = 'translate(-50%, -50%)';
		hpText.style.color = '#ffffff';
		hpText.style.fontSize = '10px';
		hpText.style.fontWeight = 'bold';
		hpText.style.textShadow = '0 0 3px rgba(0,0,0,0.8)';
		hpText.style.pointerEvents = 'none';
		hpText.style.zIndex = '1';
		hpBar.appendChild(hpText);

		infoContainer.appendChild(name);
		infoContainer.appendChild(shieldBar);
		infoContainer.appendChild(hpBar);

		wrap.appendChild(iconContainer);
		wrap.appendChild(infoContainer);

		// Store references for updates
		wrap._playerId = playerId;
		wrap._hpBarFill = hpBarFill;
		wrap._hpText = hpText;
		wrap._shieldBar = shieldBar;
		wrap._shieldBarFill = shieldBarFill;

		return wrap;
	}

	function updatePlayerBar(barElement, playerInstance, dead) {
		if (!barElement || !playerInstance) return;

		const hp = Math.max(0, playerInstance.hp || 0);
		const maxHp = Math.max(1, playerInstance.maxHp || 1);
		const hpPercent = Math.max(0, Math.min(100, (hp / maxHp) * 100));

		// Update HP bar
		const hpBarFill = barElement._hpBarFill;
		const hpText = barElement._hpText;
		if (hpBarFill && hpText) {
			hpBarFill.style.width = hpPercent + '%';
			
			// Color based on HP percentage (green > 50%, orange > 25%, red otherwise)
			if (hpPercent > 50) {
				hpBarFill.style.background = 'linear-gradient(to bottom, #66ff66, #00cc00)';
			} else if (hpPercent > 25) {
				hpBarFill.style.background = 'linear-gradient(to bottom, #ffaa44, #cc6600)';
			} else {
				hpBarFill.style.background = 'linear-gradient(to bottom, #ff6666, #cc0000)';
			}

			hpText.textContent = `${Math.floor(hp)}/${Math.floor(maxHp)}`;
		}

		// Update shield bar
		const shieldBar = barElement._shieldBar;
		const shieldBarFill = barElement._shieldBarFill;
		if (shieldBar && shieldBarFill) {
			const shieldHealth = Math.max(0, playerInstance.shieldHealth || 0);
			const maxShieldHealth = Math.max(0, playerInstance.maxShieldHealth || 0);
			
			if (maxShieldHealth > 0) {
				shieldBar.style.display = 'block';
				const shieldPercent = Math.max(0, Math.min(100, (shieldHealth / maxShieldHealth) * 100));
				shieldBarFill.style.width = shieldPercent + '%';
			} else {
				shieldBar.style.display = 'none';
			}
		}

		// Update opacity for dead players
		barElement.style.opacity = dead ? '0.5' : '1.0';
	}

	function getPlayerName(playerId) {
		if (typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.players) {
			const player = multiplayerManager.players.find(p => p && p.id === playerId);
			if (player && player.name) {
				return player.name;
			}
		}
		// Fallback to getRemotePlayerMeta if available
		if (typeof getRemotePlayerMeta !== 'undefined') {
			const meta = getRemotePlayerMeta(playerId);
			if (meta && meta.name) {
				return meta.name;
			}
		}
		return null;
	}

	function tick() {
		try {
			if (!container) {
				// Container not created yet, try to create it
				create();
				if (!container) return;
			}
			
			
			if (typeof Game === 'undefined' || !window.USE_DOM_UI) {
				if (container) container.style.display = 'none';
				return;
			}

		// Only show during PLAYING state (when HUD is visible)
		if (Game.state !== 'PLAYING') {
			if (container) container.style.display = 'none';
			return;
		}

		// Check if in multiplayer mode
		const inMultiplayer = Game.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.lobbyCode;
		if (!inMultiplayer) {
			if (container) container.style.display = 'none';
			return;
		}

		// Get local player ID
		const localPlayerId = Game.getLocalPlayerId ? Game.getLocalPlayerId() : null;
		if (!localPlayerId) {
			if (container) container.style.display = 'none';
			return;
		}

		// Get remote players based on whether we're host or client
		const isHost = multiplayerManager.isHost;
		const remotePlayerMap = isHost ? Game.remotePlayerInstances : Game.remotePlayerShadowInstances;

		if (!remotePlayerMap) {
			if (container) container.style.display = 'none';
			return;
		}

		if (remotePlayerMap.size === 0) {
			if (container) container.style.display = 'none';
			return;
		}

		// Show container
		if (container) {
			const isMobile = typeof window.Input !== 'undefined' && window.Input.isMobileUiMode && window.Input.isMobileUiMode();
			container.style.bottom = isMobile ? '280px' : '180px';
			container.style.display = 'block';
		}

		// Track which players we've seen this frame
		const seenPlayerIds = new Set();

		// Iterate through remote players
		remotePlayerMap.forEach((playerInstance, playerId) => {
			// Skip local player
			if (playerId === localPlayerId) return;

			// Skip if no valid instance
			if (!playerInstance) return;

			// Get HP values from the player instance
			let hp = playerInstance.hp;
			let maxHp = playerInstance.maxHp;
			let dead = playerInstance.dead || false;

			// Fallback to remotePlayerStates if instance doesn't have HP (shouldn't happen, but safety)
			if ((hp === undefined || hp === null) && isHost && Game.remotePlayerStates) {
				const state = Game.remotePlayerStates.get(playerId);
				if (state) {
					hp = state.hp;
					maxHp = state.maxHp;
					dead = state.dead || false;
				}
			}

			// Default values if still undefined
			if (hp === undefined || hp === null) hp = 0;
			if (maxHp === undefined || maxHp === null) maxHp = 100;

			// Skip if no valid health data
			if (maxHp <= 0) return;

			// Add to seen players only after we've validated the data
			seenPlayerIds.add(playerId);

			// Get player class
			const meta = typeof getRemotePlayerMeta !== 'undefined' ? getRemotePlayerMeta(playerId) : null;
			const classKey = playerInstance.playerClass || (meta ? meta.class : null) || 'square';

			// Get or create player bar
			let barElement = playerBars.get(playerId);
			if (!barElement) {
				const playerName = getPlayerName(playerId);
				barElement = createPlayerBar(playerId, playerInstance, playerName, classKey);
				playerBars.set(playerId, barElement);
				list.appendChild(barElement);
			}

			// Update player bar with current data
			updatePlayerBar(barElement, playerInstance, dead);
		});

		// Remove bars for players that are no longer in the game
		playerBars.forEach((barElement, playerId) => {
			if (!seenPlayerIds.has(playerId)) {
				if (barElement && barElement.parentNode) {
					barElement.parentNode.removeChild(barElement);
				}
				playerBars.delete(playerId);
			}
		});
		} catch (error) {
			console.error('[TeammateHealth] Error in tick:', error);
		}
	}

	function create() {
		const root = window.UIRoot && window.UIRoot.ensure ? window.UIRoot.ensure() : document.body;
		if (!root) {
			console.error('[TeammateHealth] Failed to get UI root');
			return;
		}
		
		container = document.createElement('div');
		container.className = 'teammate-health-hud';
		container.id = 'dom-teammate-health';
		container.style.position = 'fixed';
		container.style.left = '20px';
		// Position above local HUD
		// Mobile: HUD is at bottom: 200px, so position teammate bars higher
		const isMobileInit = typeof window.Input !== 'undefined' && window.Input.isMobileUiMode && window.Input.isMobileUiMode();
		container.style.bottom = isMobileInit ? '280px' : '180px'; // Above local HUD
		container.style.pointerEvents = 'none';
		container.style.userSelect = 'none';
		container.style.webkitUserSelect = 'none';
		container.style.mozUserSelect = 'none';
		container.style.msUserSelect = 'none';
		container.style.zIndex = '1999'; // Just below local HUD (2000)
		container.style.display = 'none';

		// Prevent right-click context menu
		container.addEventListener('contextmenu', (e) => {
			e.preventDefault();
			e.stopPropagation();
			return false;
		});

		list = document.createElement('div');
		list.style.display = 'flex';
		list.style.flexDirection = 'column';
		list.style.gap = '0px';
		container.appendChild(list);
		root.appendChild(container);
	}

	function init() {
		create();
		tick();
		// Fallback interval in case rAF is throttled
		setInterval(() => {
			tick();
		}, 250);
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init, { once: true });
	} else {
		init();
	}
})();



