// Ground card drops and pickup handling

window.groundCards = window.groundCards || [];

function qualityColor(band) {
	switch (band) {
		case 'green': return '#4caf50';
		case 'blue': return '#2196f3';
		case 'purple': return '#9c27b0';
		case 'orange': return '#ff9800';
		default: return '#bbbbbb';
	}
}

window.CardGround = {
	selection: { index: 0, list: [] },
	dropAt(x, y, card) {
		if (!card) return;
		let dropX = x;
		let dropY = y;
		if (typeof currentRoom !== 'undefined' && currentRoom && currentRoom.layout && typeof RoomLayoutGenerator !== 'undefined' &&
			!RoomLayoutGenerator.isPointWalkable(currentRoom.layout, dropX, dropY, 25)) {
			const safePoint = RoomLayoutGenerator.findSafeSpawnPoint(currentRoom.layout, {
				radius: 25,
				margin: 80,
				minDistanceFrom: [{ x: currentRoom.layout.spawnZone.x, y: currentRoom.layout.spawnZone.y, distance: 160 }],
				maxAttempts: 100
			});
			if (safePoint) {
				dropX = safePoint.x;
				dropY = safePoint.y;
			}
		}
		const item = {
			id: 'card_' + Date.now() + '_' + Math.floor(Math.random() * 1e6),
			x: dropX,
			y: dropY,
			size: 20,
			card
		};
		window.groundCards.push(item);
	},
	dropNearPlayer(card) {
		if (typeof Game === 'undefined' || !Game.player) return this.dropAt(200, 200, card);
		const px = Game.player.x + 40;
		const py = Game.player.y;
		this.dropAt(px, py, card);
	},
	pickAt(x, y) {
		// First, check if there's a selected card (via [ and ] keys) within range
		// If so, prefer that over the closest card
		let targetIndex = -1;
		if (this.selection && Array.isArray(this.selection.list) && this.selection.list.length > 0) {
			const sel = this.selection.list[this.selection.index] || null;
			if (sel) {
				const dxs = x - sel.x;
				const dys = y - sel.y;
				const rs = sel.size + 20;
				if (dxs * dxs + dys * dys <= rs * rs) {
					// Selected card is within range - use it
					targetIndex = window.groundCards.findIndex(g => g.id === sel.id);
				}
			}
		}

		// If no selected card within range, find the closest card within click range
		if (targetIndex === -1) {
			let nearestDist2 = Infinity;
			for (let i = 0; i < window.groundCards.length; i++) {
				const it = window.groundCards[i];
				const dx = x - it.x;
				const dy = y - it.y;
				const r = it.size + 20;
				const dist2 = dx * dx + dy * dy;
				if (dist2 <= r * r && dist2 < nearestDist2) {
					nearestDist2 = dist2;
					targetIndex = i;
				}
			}
		}
		if (targetIndex === -1) return false;
		const it = window.groundCards[targetIndex];

		// Check if this is a room modifier card (category === 'Room' or category === 'Economy')
		const isRoomModifier = it.card && (it.card.category === 'Room' || it.card.category === 'Economy');

		if (isRoomModifier) {
			// Check if we're in a run and have space in run inventory
			const inRun = typeof Game !== 'undefined' && Game.state === 'PLAYING';
			let addedToRunInventory = false;

			if (inRun) {
				// Check available slots in run inventory
				const slots = (typeof SaveSystem !== 'undefined' && SaveSystem.getDeckUpgrades)
					? (SaveSystem.getDeckUpgrades().roomModifierCarrySlots || 3)
					: 3;
				const currentRunInventory = (typeof Game !== 'undefined' && Array.isArray(Game.roomModifierInventory))
					? Game.roomModifierInventory
					: [];

				if (currentRunInventory.length < slots) {
					// Add to run inventory
					if (!Game.roomModifierInventory) {
						Game.roomModifierInventory = [];
					}
					Game.roomModifierInventory.push(it.card);

					// Also sync to DeckState
					if (typeof DeckState !== 'undefined') {
						if (!DeckState.roomModifierInventory) {
							DeckState.roomModifierInventory = [];
						}
						DeckState.roomModifierInventory.push(it.card);
					}

					// Also add to Nexus collection (so it can be removed from both when used, and doesn't need transfer if unused)
					if (typeof SaveSystem !== 'undefined' && SaveSystem.load && SaveSystem.save) {
						const save = SaveSystem.load();
						if (!Array.isArray(save.roomModifierCollection)) {
							save.roomModifierCollection = [];
						}
						// Check storage cap
						const maxStorage = 40;
						if (save.roomModifierCollection.length < maxStorage) {
							save.roomModifierCollection.push(it.card);
							// Track discovery
							if (it.card.id && SaveSystem.discoverUtilityCard) {
								SaveSystem.discoverUtilityCard(it.card.id);
							}
							SaveSystem.save(save);
							console.log(`[Room Modifier] Also added ${it.card.family || it.card.name} to Nexus collection`);
						} else {
							console.warn(`[Room Modifier] Nexus collection full, modifier only added to run inventory`);
						}
					}

					window.groundCards.splice(targetIndex, 1);
					console.log(`[Room Modifier] Added ${it.card.family || it.card.name} to run inventory (${currentRunInventory.length}/${slots})`);
					addedToRunInventory = true;
				}
			}

			// If not added to run inventory (either not in run or run inventory full), add to Nexus collection
			if (!addedToRunInventory) {
				if (typeof SaveSystem !== 'undefined' && SaveSystem.load && SaveSystem.save) {
					const save = SaveSystem.load();
					if (!Array.isArray(save.roomModifierCollection)) {
						save.roomModifierCollection = [];
					}
					// Check storage cap (max 30-40 stored)
					const maxStorage = 40;
					if (save.roomModifierCollection.length >= maxStorage) {
						// Collection full - show message or convert to shards
						console.log('[Room Modifier] Collection full, cannot pick up');
						// TODO: Show UI message
						return false;
					}
					// Add to collection
					save.roomModifierCollection.push(it.card);
					SaveSystem.save(save);
					window.groundCards.splice(targetIndex, 1);
					console.log(`[Room Modifier] Added ${it.card.family || it.card.name} to Nexus collection`);
					return true;
				}
				return false;
			}

			return true;
		} else {
			// Regular card - add to hand
			// If there's an existing swap state, cancel it first (old ground card remains)
			if (typeof Game !== 'undefined' && Game.awaitingHandSwap && Game.pendingSwapSourceId) {
				// Previous swap was not completed - cancel it but keep the old ground card
				console.log('[Card Pickup] Cancelling previous incomplete swap, starting new pickup');
				// Clear the old swap state - the old ground card remains on the ground
				Game.awaitingHandSwap = false;
				Game.pendingSwapCard = null;
				Game.pendingSwapSourceId = null; // Clear the old ID to prevent confusion
			}

			const ok = (typeof addToHand === 'function') ? addToHand(it.card) : false;
			if (ok) {
				// Card was successfully added to hand - clear any swap state
				if (typeof Game !== 'undefined') {
					Game.awaitingHandSwap = false;
					Game.pendingSwapCard = null;
					Game.pendingSwapSourceId = null;
				}
				window.groundCards.splice(targetIndex, 1);
				return true;
			}

			// If hand is full, addToHand returns false and sets Game.awaitingHandSwap; remember source
			if (typeof Game !== 'undefined' && Game.awaitingHandSwap) {
				// Always set the source ID for the current pickup attempt
				// Make sure we're tracking the correct ground card
				Game.pendingSwapSourceId = it.id;
				// Highlight this as selected
				this.selection = { index: 0, list: [it] };
				console.log('[Card Pickup] Hand full, swap mode activated for card:', it.card?.name || it.card?.family, 'Ground card ID:', it.id);

				// Verify the ground card is still in the array
				const verifyIndex = window.groundCards.findIndex(g => g.id === it.id);
				if (verifyIndex === -1) {
					console.error('[Card Pickup] ERROR: Ground card not found after setting swap state!', it.id);
				} else if (verifyIndex !== targetIndex) {
					console.warn('[Card Pickup] Ground card index changed:', targetIndex, '->', verifyIndex);
				}

				return true;
			}

			// If we get here, addToHand returned false but didn't set awaitingHandSwap
			// This can happen with non-stacking cards that already exist in hand
			console.log('[Card Pickup] Cannot add card to hand (possibly non-stacking duplicate)');
			return false;
		}
	},
	updateSelection(player) {
		if (!player || !Array.isArray(window.groundCards)) {
			this.selection = { index: 0, list: [] };
			return;
		}
		const px = player.x, py = player.y;
		const near = [];
		const radius = 180;
		const r2 = radius * radius;
		for (let i = 0; i < window.groundCards.length; i++) {
			const it = window.groundCards[i];
			const dx = it.x - px;
			const dy = it.y - py;
			if (dx * dx + dy * dy <= r2) near.push(it);
		}
		// Preserve current selected id if still near
		const prev = (this.selection.list && this.selection.list[this.selection.index]) ? this.selection.list[this.selection.index].id : null;
		this.selection = { index: 0, list: near };
		if (prev) {
			const keepIdx = near.findIndex(i => i.id === prev);
			if (keepIdx >= 0) this.selection.index = keepIdx;
		}
	},
	cycleSelection(dir) {
		if (!this.selection || !Array.isArray(this.selection.list) || this.selection.list.length === 0) return;
		const n = this.selection.list.length;
		this.selection.index = (this.selection.index + (dir > 0 ? 1 : -1) + n) % n;
	},
	getSelected() {
		if (!this.selection || !Array.isArray(this.selection.list) || this.selection.list.length === 0) return null;
		return this.selection.list[this.selection.index] || null;
	}
};

window.renderGroundCards = function renderGroundCards(ctx) {
	if (!Array.isArray(window.groundCards)) return;
	// Update selection based on player proximity
	if (typeof Game !== 'undefined' && Game.player) {
		window.CardGround.updateSelection(Game.player);
	}
	const selected = window.CardGround.getSelected();
	window.groundCards.forEach(it => {
		const band = it.card && it.card._resolvedQuality || 'white';
		const col = qualityColor(band);
		// Check if room modifier
		const isRoomModifier = it.card && (it.card.category === 'Room' || it.card.category === 'Economy');
		// glow
		ctx.save();
		ctx.shadowBlur = 10;
		ctx.shadowColor = col;
		ctx.fillStyle = col;
		ctx.beginPath();
		ctx.arc(it.x, it.y, it.size, 0, Math.PI * 2);
		ctx.fill();
		ctx.shadowBlur = 0;
		// label
		const name = (it.card && (it.card.name || it.card.family)) || 'Card';
		const labelText = isRoomModifier ? `[MOD] ${name} (${band})` : `${name} (${band})`;
		ctx.textAlign = 'center';
		ctx.font = 'bold 13px Orbitron';
		// Outline for readability
		ctx.strokeStyle = 'rgba(0,0,0,0.9)';
		ctx.lineWidth = 3;
		ctx.strokeText(labelText, it.x, it.y - it.size - 10);
		ctx.fillStyle = '#ffffff';
		ctx.fillText(labelText, it.x, it.y - it.size - 10);

		// Detailed tooltip for selected only
		if (selected && selected.id === it.id) {
			const desc = it.card && it.card.qualityBands && it.card.qualityBands[band] && it.card.qualityBands[band].description;
			const tip = desc || '';
			if (tip) {
				const boxW = Math.min(320, Math.max(140, tip.length * 6));
				const boxH = 42;
				const bx = it.x - boxW / 2;
				const by = it.y - it.size - 10 - boxH - 6;
				ctx.fillStyle = 'rgba(0,0,0,0.75)';
				ctx.fillRect(bx, by, boxW, boxH);
				ctx.strokeStyle = '#66ccff';
				ctx.lineWidth = 2;
				ctx.strokeRect(bx, by, boxW, boxH);
				ctx.fillStyle = '#dddddd';
				ctx.font = 'bold 12px Orbitron';
				ctx.textAlign = 'left';
				ctx.fillText(tip, bx + 8, by + 24);
			}
		}

		// Proximity hint
		if (typeof Game !== 'undefined' && Game.player) {
			const dx = it.x - Game.player.x;
			const dy = it.y - Game.player.y;
			const d2 = dx * dx + dy * dy;
			const pickR = 100;
			if (d2 <= pickR * pickR) {
				ctx.font = 'bold 12px Orbitron';
				ctx.fillStyle = '#ffdd55';
				if (typeof Input !== 'undefined' && Input.drawInteractionPrompt) {
					Input.drawInteractionPrompt(ctx, 'pick up', it.x, it.y + it.size + 18);
				} else {
					const hint = typeof Input !== 'undefined' && Input.getInteractionPrompt
						? Input.getInteractionPrompt('pick up')
						: 'Press G to pick up';
					ctx.strokeText(hint, it.x, it.y + it.size + 18);
					ctx.fillText(hint, it.x, it.y + it.size + 18);
				}
			}
		}
		ctx.restore();
	});
};


