// Door selection system - spawns physical door objects for reward selection

(function () {
	'use strict';

	// Array of door selection objects
	window.selectionDoors = [];

	// Selected door option (stored for next room)
	window.selectedDoorReward = null;

	// Track if this is the first room
	window.isFirstRoom = true;

	// Spawn reward when room is cleared
	window.spawnRoomReward = function spawnRoomReward() {
		const roomWidth = (currentRoom && currentRoom.width) ? currentRoom.width : 2400;
		const roomHeight = (currentRoom && currentRoom.height) ? currentRoom.height : 1350;
		const centerX = roomWidth / 2;
		const centerY = roomHeight / 2 - 200; // Move reward up 200px to separate from door selections

		if (window.isFirstRoom) {
			// Room 1: Generate a random reward using CardPacks.generateRoomClearReward (only in card mode)
			const gameMode = (typeof Game !== 'undefined' && Game.gameMode) ? Game.gameMode : 'cards';
			if (gameMode === 'cards' && typeof CardPacks !== 'undefined' && CardPacks.generateRoomClearReward) {
				const roomNumber = (typeof currentRoom !== 'undefined' && currentRoom.number) ? currentRoom.number : 1;
				const rewardData = CardPacks.generateRoomClearReward(roomNumber);

				// Convert the reward data to a door option format and store it
				const rewardOption = {
					packType: rewardData.packType,
					rewardType: rewardData.rewardType,
					preview: [],
					payload: {}
				};

				if (rewardData.rewardType === 'Card' && rewardData.card) {
					rewardOption.payload.card = rewardData.card;
					rewardOption.payload.bonuses = rewardData.bonuses || {};
					rewardOption.preview.push(rewardData.card.name || rewardData.card.family);
				} else if (rewardData.rewardType === 'Shard' && rewardData.shards) {
					rewardOption.payload.shards = rewardData.shards;
					rewardOption.preview.push(`${rewardData.shards} shards`);
				} else if (rewardData.rewardType === 'Upgrade') {
					rewardOption.payload.upgrade = true;
					rewardOption.preview.push('+1 quality to a hand card');
				}

				// Store the reward so it can be granted when Room 1 is cleared
				window.selectedDoorReward = rewardOption;

				if (rewardOption.rewardType === 'Upgrade') {
					spawnUpgradePickup(centerX, centerY, rewardOption);
				}
			}
			window.isFirstRoom = false;
		} else if (window.selectedDoorReward) {
			// Room 2+: spawn the selected reward from previous room (moved up)
			const reward = window.selectedDoorReward;

			if (reward.rewardType === 'Upgrade') {
				spawnUpgradePickup(centerX, centerY, reward);
			}
			// Note: Don't clear selectedDoorReward here - it will be cleared after rewards are granted in checkRoomCleared
		}
	};

	// Create door selection objects (card pack representations) when room is cleared
	window.createDoorSelections = function createDoorSelections() {
		if (!Game || !Game.doorOptions || !Array.isArray(Game.doorOptions) || Game.doorOptions.length === 0) {
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

		// Use modified option if available, otherwise use original
		const opt = pack.modifiedOption || pack.option;

		// Prevent selection of disabled upgrade doors
		if (opt.rewardType === 'Upgrade' && opt.canUpgrade === false) {
			return false;
		}

		// Apply any selected modifier to the option before processing
		if (pack.selectedModifier) {
			// Store the modifier so applyDoorOption can use it when room is cleared
			Game.selectedRoomModifier = pack.selectedModifier;

			// IMPORTANT: Set nextRoomModifiers NOW so they apply to the next room when it's generated
			// (Rewards will still be granted when the room is cleared)
			const fam = pack.selectedModifier.family || '';
			const qBand = pack.selectedModifier._resolvedQuality || (pack.selectedModifier.id ? pack.selectedModifier.id.split('_').pop() : 'white');

			// Map quality to percent for supported modifiers
			const qToVal = { white: 0.10, green: 0.20, blue: 0.30, purple: 0.40, orange: 0.50 };
			const qToValExplosion = { white: 0.20, green: 0.30, blue: 0.40, purple: 0.50, orange: 0.60 };
			const qToValShield = { white: 0.10, green: 0.20, blue: 0.30, purple: 0.40, orange: 0.50 };

			let hpPct = 0, speedPct = 0, explosionChance = 0, shieldChance = 0, doubleEnemies = false;
			let currencyBoost = 0, xpBoost = 0;
			let roomTypeOverride = null;

			if (fam === 'Elite Armor') hpPct = qToVal[qBand] || 0;
			if (fam === 'Swift Assault') speedPct = qToVal[qBand] || 0;
			if (fam === 'Volatile Spawn') explosionChance = qToValExplosion[qBand] || 0;
			if (fam === 'Shielded Brood') shieldChance = qToValShield[qBand] || 0;
			if (fam === 'Double Trouble') doubleEnemies = true;
			if (fam === 'Prism Tax') currencyBoost = [0.20, 0.30, 0.40, 0.50, 0.60][['white', 'green', 'blue', 'purple', 'orange'].indexOf(qBand)] || 0;
			if (fam === 'Scholar Sigil') xpBoost = [0.25, 0.35, 0.45, 0.55, 0.70][['white', 'green', 'blue', 'purple', 'orange'].indexOf(qBand)] || 0;

			// Room type modifiers that override pack type
			if (fam === 'Rest Stop' || fam === 'Truncation') roomTypeOverride = 'truncation';
			if (fam === 'Safe Passage') roomTypeOverride = 'safe';
			if (fam === 'Treasure Cache') roomTypeOverride = 'treasure';
			if (fam === 'Elite Challenge') roomTypeOverride = 'elite';
			if (fam === 'Boss Rush') {
				const currentRoom = (typeof Game !== 'undefined' && Game.roomNumber) ? Game.roomNumber : 1;
				const bossRooms = [12, 22, 32];
				const nextBoss = bossRooms.find(r => r > currentRoom);
				if (nextBoss) {
					Game.bossRushTargetRoom = nextBoss;
					roomTypeOverride = 'boss';
				}
			}

			// Store consolidated modifiers for next room generation
			Game.nextRoomModifiers = {
				hpPct,
				speedPct,
				explosionChance,
				shieldChance,
				doubleEnemies,
				currencyBoost,
				xpBoost,
				roomTypeOverride
			};

			// If room type override is set, use it instead of pack type
			if (roomTypeOverride && typeof Game !== 'undefined') {
				Game.nextRoomTypeOverride = roomTypeOverride;
			}

		}

		// DON'T apply door option here - rewards will be granted when the room is cleared
		// Just store the option for later processing

		pack.selected = true;
		// Store the selected reward for the NEXT room (will spawn when that room is cleared)
		// This includes the modified option if a modifier was applied
		window.selectedDoorReward = opt;

		// Store pack type for next room generation
		if (Game && pack.option && pack.option.packType) {
			Game.nextRoomPackType = pack.option.packType;
		}

		// Clear door selection state
		if (Game) {
			Game.awaitingDoorSelection = false;
			Game.doorOptions = [];
		}

		// Clear door selections immediately (don't wait for fade)
		window.selectionDoors = [];

		// Move to next room IMMEDIATELY
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

		window.selectionDoors.forEach(pack => {
			if (pack.alpha <= 0) return;

			// Use modified option if available, otherwise use original
			const opt = pack.modifiedOption || pack.option;
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

			// Pack type header (show modified if applicable)
			const displayPackType = pack.selectedModifier ?
				(pack.modifiedOption ? pack.modifiedOption.packType : opt.packType) : opt.packType;
			ctx.fillStyle = isUpgradeDisabled ? '#888888' : '#ffff00';
			ctx.font = 'bold 14px Orbitron';
			ctx.textAlign = 'center';
			ctx.fillText(`${displayPackType} Pack${pack.selectedModifier ? ' (Modified)' : ''}`, pack.x, cardY + 22);

			// Reward type
			ctx.fillStyle = isUpgradeDisabled ? '#aaaaaa' : '#ffffff';
			ctx.font = 'bold 12px Orbitron';
			ctx.fillText(`Reward: ${opt.rewardType}`, pack.x, cardY + 45);

			// Warning text if disabled
			if (isUpgradeDisabled && opt.upgradeWarning) {
				ctx.fillStyle = '#ff6666';
				ctx.font = 'bold 10px Orbitron';
				ctx.fillText('⚠️ No upgrades available', pack.x, cardY + 70);
				ctx.font = 'bold 9px Orbitron';
				const warningLines = opt.upgradeWarning.split('\n');
				warningLines.forEach((line, idx) => {
					ctx.fillText(line, pack.x, cardY + 90 + (idx * 12));
				});
			} else {
				// Preview (first 2-3 items)
				const previews = Array.isArray(opt.preview) ? opt.preview.slice(0, 3) : [];
				ctx.fillStyle = '#cfd8ff';
				ctx.font = 'bold 11px Orbitron';
				previews.forEach((p, i) => {
					ctx.fillText(`• ${p}`, pack.x, cardY + 70 + (i * 18));
				});
			}

			// Boss unlock indicator
			if (opt.bossUnlock && opt.rewardType === 'Card') {
				ctx.fillStyle = '#ffdd55';
				ctx.font = 'bold 11px Orbitron';
				ctx.fillText('Boss Unlock!', pack.x, cardY + cardHeight - 15);
			}

			// Interaction hint above pack (only show when player is near and not disabled)
			if (!isUpgradeDisabled && Game && Game.player) {
				const dx = pack.x - Game.player.x;
				const dy = pack.y - Game.player.y;
				const interactionRadius = pack.size + 40;
				const dist2 = dx * dx + dy * dy;
				const isNear = dist2 <= interactionRadius * interactionRadius;

				if (isNear) {
					// Check if player has modifiers available
					const hasModifiers = (typeof DeckState !== 'undefined' && Array.isArray(DeckState.roomModifierInventory) && DeckState.roomModifierInventory.length > 0)
						|| (typeof Game !== 'undefined' && Array.isArray(Game.roomModifierInventory) && Game.roomModifierInventory.length > 0);

					ctx.fillStyle = '#00ff00';
					ctx.font = 'bold 12px Orbitron';
					if (hasModifiers) {
						if (typeof Input !== 'undefined' && !Input.isTouchMode()) {
							ctx.fillText('Press G to Select or M for Modifier', pack.x, cardY - 25);
						}
					} else {
						if (typeof Input !== 'undefined' && !Input.isTouchMode()) {
							ctx.fillText('Press G to Select', pack.x, cardY - 25);
						}
					}

					// Show modifier indicator if door has one
					if (pack.selectedModifier) {
						ctx.fillStyle = '#4caf50';
						ctx.font = 'bold 10px Orbitron';
						ctx.fillText('✓ Modifier Applied', pack.x, cardY - 10);
					}
				}
			} else if (isUpgradeDisabled) {
				ctx.fillStyle = '#ff6666';
				ctx.font = 'bold 11px Orbitron';
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
			ctx.font = 'bold 11px Orbitron';
			ctx.textAlign = 'center';
			ctx.fillText('Upgrade', upgrade.x, upgrade.y - (upgrade.size + 16));

			// Interaction hint
			if (typeof Input !== 'undefined' && !Input.isTouchMode()) {
				ctx.fillStyle = '#00ff00';
				ctx.font = 'bold 10px Orbitron';
				ctx.fillText('Press G', upgrade.x, upgrade.y + (upgrade.size + 14));
			}

			ctx.restore();
		});
	};

})();

