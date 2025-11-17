// Door selection system - spawns physical door objects for reward selection

(function() {
	'use strict';
	
	// Array of door selection objects
	window.selectionDoors = [];
	
	// Selected door option (stored for next room)
	window.selectedDoorReward = null;
	
	// Track if this is the first room
	window.isFirstRoom = true;
	
	// Spawn reward when room is cleared
	window.spawnRoomReward = function spawnRoomReward() {
		console.log('[DOOR SYSTEM] spawnRoomReward called, isFirstRoom:', window.isFirstRoom, 'selectedDoorReward:', window.selectedDoorReward);
		
		const roomWidth = (currentRoom && currentRoom.width) ? currentRoom.width : 2400;
		const roomHeight = (currentRoom && currentRoom.height) ? currentRoom.height : 1350;
		const centerX = roomWidth / 2;
		const centerY = roomHeight / 2 - 200; // Move reward up 200px to separate from door selections
		
		if (window.isFirstRoom) {
			// Room 1: spawn random reward in center (moved up)
			console.log('[DOOR SYSTEM] Room 1 - spawning random reward');
			if (!Game || !Game.doorOptions || Game.doorOptions.length === 0) {
				console.log('[DOOR SYSTEM] No door options available for room 1');
				return;
			}
			const randomOption = Game.doorOptions[Math.floor(Math.random() * Game.doorOptions.length)];
			console.log('[DOOR SYSTEM] Selected random option:', randomOption);
			
			if (randomOption.rewardType === 'Card' && randomOption.payload && randomOption.payload.card) {
				console.log('[DOOR SYSTEM] Spawning card reward');
				if (typeof CardGround !== 'undefined' && CardGround.dropAt) {
					CardGround.dropAt(centerX, centerY, randomOption.payload.card);
				} else {
					console.error('[DOOR SYSTEM] CardGround.dropAt not available');
				}
			} else if (randomOption.rewardType === 'Upgrade') {
				console.log('[DOOR SYSTEM] Spawning upgrade reward');
				spawnUpgradePickup(centerX, centerY, randomOption);
			}
			window.isFirstRoom = false;
		} else if (window.selectedDoorReward) {
			// Room 2+: spawn the selected reward from previous room (moved up)
			console.log('[DOOR SYSTEM] Room 2+ - spawning selected reward:', window.selectedDoorReward);
			const reward = window.selectedDoorReward;
			
			if (reward.rewardType === 'Card' && reward.payload && reward.payload.card) {
				console.log('[DOOR SYSTEM] Spawning card reward');
				if (typeof CardGround !== 'undefined' && CardGround.dropAt) {
					CardGround.dropAt(centerX, centerY, reward.payload.card);
				} else {
					console.error('[DOOR SYSTEM] CardGround.dropAt not available');
				}
			} else if (reward.rewardType === 'Upgrade') {
				console.log('[DOOR SYSTEM] Spawning upgrade reward');
				spawnUpgradePickup(centerX, centerY, reward);
			}
			
			// Clear selected reward after spawning
			window.selectedDoorReward = null;
		} else {
			console.log('[DOOR SYSTEM] No reward to spawn (not first room and no selected reward)');
		}
	};
	
	// Create door selection objects (card pack representations) when room is cleared
	window.createDoorSelections = function createDoorSelections() {
		console.log('[DOOR SYSTEM] createDoorSelections called, doorOptions:', Game ? Game.doorOptions : 'no Game');
		
		if (!Game || !Game.doorOptions || !Array.isArray(Game.doorOptions) || Game.doorOptions.length === 0) {
			console.log('[DOOR SYSTEM] No door options available, cannot create selections');
			return;
		}
		
		// Clear any existing selections
		window.selectionDoors = [];
		
		const options = Game.doorOptions;
		const roomWidth = (currentRoom && currentRoom.width) ? currentRoom.width : 2400;
		const roomHeight = (currentRoom && currentRoom.height) ? currentRoom.height : 1350;
		
		// Spawn card pack representations in center area, horizontal row
		const packSpacing = 200;
		const startX = roomWidth / 2 - ((options.length - 1) * packSpacing) / 2;
		const packY = roomHeight / 2 + 100; // Below center (where reward was)
		
		console.log('[DOOR SYSTEM] Creating', options.length, 'door selection packs at y:', packY);
		
		options.forEach((opt, index) => {
			const pack = {
				id: `pack_${Date.now()}_${index}`,
				x: startX + (index * packSpacing),
				y: packY,
				width: 140,
				height: 180,
				option: opt,
				selected: false,
				pulse: 0,
				alpha: 1.0,
				size: 50 // For interaction radius
			};
			window.selectionDoors.push(pack);
		});
		
		console.log('[DOOR SYSTEM] Created', window.selectionDoors.length, 'selection packs');
	};
	
	// Spawn upgrade pickup on ground
	window.spawnUpgradePickup = function spawnUpgradePickup(x, y, option) {
		if (!Array.isArray(window.groundUpgrades)) {
			window.groundUpgrades = [];
		}
		
		const upgrade = {
			id: `upgrade_${Date.now()}_${Math.random()}`,
			x: x,
			y: y,
			size: 30,
			option: option,
			pulse: 0,
			alpha: 1.0
		};
		
		window.groundUpgrades.push(upgrade);
	};
	
	// Check if player is near a pack and can interact
	window.checkDoorInteraction = function checkDoorInteraction(player) {
		if (!player || !Array.isArray(window.selectionDoors)) return null;
		
		let nearest = null;
		let bestDist2 = Infinity;
		
		for (const pack of window.selectionDoors) {
			if (pack.selected || pack.alpha <= 0) continue;
			
			const dx = pack.x - player.x;
			const dy = pack.y - player.y;
			const interactionRadius = pack.size + 40; // Interaction radius
			const dist2 = dx * dx + dy * dy;
			
			if (dist2 < bestDist2 && dist2 <= interactionRadius * interactionRadius) {
				bestDist2 = dist2;
				nearest = pack;
			}
		}
		
		return nearest;
	};
	
	// Select a pack (called when player presses G near pack) - moves to next room IMMEDIATELY
	window.selectDoor = function selectDoor(pack) {
		if (!pack || pack.selected) return false;
		
		// Prevent selection of disabled upgrade doors
		const opt = pack.option;
		if (opt.rewardType === 'Upgrade' && opt.canUpgrade === false) {
			console.warn('[Door Selection] Cannot select disabled upgrade door');
			return false;
		}
		
		console.log('[DOOR SYSTEM] selectDoor called, pack option:', pack.option);
		
		pack.selected = true;
		// Store the selected reward for the NEXT room (will spawn when that room is cleared)
		window.selectedDoorReward = pack.option;
		console.log('[DOOR SYSTEM] Stored selectedDoorReward:', window.selectedDoorReward);
		
		// Clear door selection state
		if (Game) {
			Game.awaitingDoorSelection = false;
			Game.doorOptions = [];
		}
		
		// Clear door selections immediately (don't wait for fade)
		window.selectionDoors = [];
		
		// Move to next room IMMEDIATELY
		console.log('[DOOR SYSTEM] Moving to next room...');
		if (Game && typeof Game.advanceToNextRoom === 'function') {
			Game.advanceToNextRoom();
		} else {
			console.error('[DOOR SYSTEM] Game.advanceToNextRoom not available!');
		}
		
		return true;
	};
	
	// Update door animations
	window.updateDoorSelections = function updateDoorSelections(deltaTime) {
		if (!Array.isArray(window.selectionDoors)) return;
		
		window.selectionDoors.forEach(door => {
			door.pulse += deltaTime * 0.003;
		});
	};
	
	// Render door selections as card packs on the ground
	window.renderDoorSelections = function renderDoorSelections(ctx) {
		if (!Array.isArray(window.selectionDoors)) {
			return;
		}
		
		if (window.selectionDoors.length === 0) {
			return;
		}
		
		console.log('[DOOR SYSTEM] renderDoorSelections called, rendering', window.selectionDoors.length, 'packs');
		
		window.selectionDoors.forEach(pack => {
			if (pack.alpha <= 0) return;
			
			const opt = pack.option;
			const isUpgradeDisabled = opt.rewardType === 'Upgrade' && opt.canUpgrade === false;
			
			// Adjust alpha for disabled doors
			const alpha = isUpgradeDisabled ? 0.4 : pack.alpha;
			
			ctx.save();
			ctx.globalAlpha = alpha;
			
			// Render door with grayscale filter if disabled
			if (isUpgradeDisabled) {
				ctx.filter = 'grayscale(70%)';
			}
			
			const pulseSize = 2 + Math.sin(pack.pulse * 10) * 2;
			
			// Get border color based on pack type (grayed if disabled)
			let borderColor = '#ffffff';
			if (isUpgradeDisabled) {
				borderColor = '#888888';
			} else if (opt.packType === 'Elite') borderColor = '#00ffff';
			else if (opt.packType === 'Challenge') borderColor = '#ff8800';
			else if (opt.packType === 'Upgrade') borderColor = '#ffaa00';
			
			// Glow ring (like ground cards)
			ctx.shadowBlur = 20 + pulseSize;
			ctx.shadowColor = borderColor;
			ctx.fillStyle = borderColor;
			ctx.globalAlpha = pack.alpha * 0.3;
			ctx.beginPath();
			ctx.arc(pack.x, pack.y, pack.size + pulseSize + 15, 0, Math.PI * 2);
			ctx.fill();
			ctx.globalAlpha = pack.alpha;
			
			// Card pack representation (larger than regular cards)
			const cardWidth = pack.width;
			const cardHeight = pack.height;
			const cardX = pack.x - cardWidth / 2;
			const cardY = pack.y - cardHeight / 2;
			
			// Card body with gradient
			const gradient = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardHeight);
			gradient.addColorStop(0, 'rgba(16, 16, 28, 0.95)');
			gradient.addColorStop(1, 'rgba(10, 10, 20, 0.95)');
			ctx.fillStyle = gradient;
			ctx.fillRect(cardX, cardY, cardWidth, cardHeight);
			
			// Border with glow
			ctx.shadowBlur = 15;
			ctx.shadowColor = borderColor;
			ctx.strokeStyle = borderColor;
			ctx.lineWidth = 3;
			ctx.strokeRect(cardX, cardY, cardWidth, cardHeight);
			ctx.shadowBlur = 0;
			
			// Pack type header
			ctx.fillStyle = isUpgradeDisabled ? '#888888' : '#ffff00';
			ctx.font = 'bold 14px Arial';
			ctx.textAlign = 'center';
			ctx.fillText(`${opt.packType} Pack`, pack.x, cardY + 22);
			
			// Reward type
			ctx.fillStyle = isUpgradeDisabled ? '#aaaaaa' : '#ffffff';
			ctx.font = '12px Arial';
			ctx.fillText(`Reward: ${opt.rewardType}`, pack.x, cardY + 45);
			
			// Warning text if disabled
			if (isUpgradeDisabled && opt.upgradeWarning) {
				ctx.fillStyle = '#ff6666';
				ctx.font = 'bold 10px Arial';
				ctx.fillText('⚠️ No upgrades available', pack.x, cardY + 70);
				ctx.font = '9px Arial';
				const warningLines = opt.upgradeWarning.split('\n');
				warningLines.forEach((line, idx) => {
					ctx.fillText(line, pack.x, cardY + 90 + (idx * 12));
				});
			} else {
				// Preview (first 2-3 items)
				const previews = Array.isArray(opt.preview) ? opt.preview.slice(0, 3) : [];
				ctx.fillStyle = '#cfd8ff';
				ctx.font = '11px Arial';
				previews.forEach((p, i) => {
					ctx.fillText(`• ${p}`, pack.x, cardY + 70 + (i * 18));
				});
			}
			
			// Boss unlock indicator
			if (opt.bossUnlock && opt.rewardType === 'Card') {
				ctx.fillStyle = '#ffdd55';
				ctx.font = 'bold 11px Arial';
				ctx.fillText('Boss Unlock!', pack.x, cardY + cardHeight - 15);
			}
			
			// Interaction hint above pack (only if not disabled)
			if (!isUpgradeDisabled) {
				ctx.fillStyle = '#00ff00';
				ctx.font = 'bold 12px Arial';
				ctx.fillText('Press G to Select', pack.x, cardY - 25);
			} else {
				ctx.fillStyle = '#ff6666';
				ctx.font = 'bold 11px Arial';
				ctx.fillText('Cannot Select', pack.x, cardY - 25);
			}
			
			// Reset filter
			ctx.filter = 'none';
			ctx.restore();
		});
	};
	
	// Clear all door selections (but preserve selectedDoorReward if needed)
	window.clearDoorSelections = function clearDoorSelections() {
		window.selectionDoors = [];
		// Don't clear selectedDoorReward here - it needs to persist until the next room is cleared
		// It will be cleared in spawnRoomReward() after spawning
	};
	
	// Check if player is near an upgrade pickup
	window.checkUpgradePickup = function checkUpgradePickup(player) {
		if (!player || !Array.isArray(window.groundUpgrades)) return null;
		
		const interactionRadius = 80;
		let nearest = null;
		let bestDist2 = Infinity;
		
		for (const upgrade of window.groundUpgrades) {
			if (upgrade.alpha <= 0) continue;
			
			const dx = upgrade.x - player.x;
			const dy = upgrade.y - player.y;
			const dist2 = dx * dx + dy * dy;
			
			if (dist2 < bestDist2 && dist2 <= interactionRadius * interactionRadius) {
				bestDist2 = dist2;
				nearest = upgrade;
			}
		}
		
		return nearest;
	};
	
	// Pick up upgrade (opens upgrade modal)
	window.pickupUpgrade = function pickupUpgrade(upgrade) {
		if (!upgrade || !upgrade.option) return false;
		
		// Open upgrade selection modal
		if (typeof Game !== 'undefined') {
			Game.awaitingUpgradeSelection = true;
			Game.upgradeOption = upgrade.option;
		}
		
		// Remove upgrade from ground
		const index = window.groundUpgrades.indexOf(upgrade);
		if (index > -1) {
			window.groundUpgrades.splice(index, 1);
		}
		
		return true;
	};
	
	// Render upgrade pickups
	window.renderUpgradePickups = function renderUpgradePickups(ctx) {
		if (!Array.isArray(window.groundUpgrades)) return;
		
		window.groundUpgrades.forEach(upgrade => {
			if (upgrade.alpha <= 0) return;
			
			upgrade.pulse += 0.06;
			const pulseSize = 2 + Math.sin(upgrade.pulse * 10) * 2;
			
			ctx.save();
			ctx.globalAlpha = upgrade.alpha;
			
			// Glow
			ctx.shadowBlur = 20;
			ctx.shadowColor = '#ffaa00';
			
			// Upgrade icon (star/upgrade symbol)
			ctx.fillStyle = '#ffaa00';
			ctx.beginPath();
			ctx.arc(upgrade.x, upgrade.y, upgrade.size + pulseSize, 0, Math.PI * 2);
			ctx.fill();
			
			// Outline
			ctx.strokeStyle = '#ffffff';
			ctx.lineWidth = 2;
			ctx.stroke();
			ctx.shadowBlur = 0;
			
			// Label
			ctx.fillStyle = '#ffffff';
			ctx.font = 'bold 11px Arial';
			ctx.textAlign = 'center';
			ctx.fillText('Upgrade', upgrade.x, upgrade.y - (upgrade.size + 16));
			
			// Interaction hint
			ctx.fillStyle = '#00ff00';
			ctx.font = 'bold 10px Arial';
			ctx.fillText('Press G', upgrade.x, upgrade.y + (upgrade.size + 14));
			
			ctx.restore();
		});
	};
	
})();

