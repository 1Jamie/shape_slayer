(function () {
	console.log('[DoorModifierSelection] Script loading...');
	let layer, modal, body, modifierList, previewSection, confirmBtn, cancelBtn;
	let currentDoorPack = null;
	let selectedModifier = null;
	let originalOption = null;
	let modifiedOption = null;

	function createDoorModifierSelection() {
		console.log('[DoorModifierSelection] Creating component DOM');
		const rootLayer = document.createElement('div');
		rootLayer.className = 'ui-layer ui-layer--modal';
		rootLayer.style.display = 'none';
		rootLayer.style.pointerEvents = 'auto';
		rootLayer.style.position = 'fixed';
		rootLayer.style.inset = '0';
		rootLayer.style.zIndex = '10000';
		rootLayer.setAttribute('role', 'dialog');
		rootLayer.setAttribute('aria-modal', 'true');
		rootLayer.setAttribute('aria-label', 'Select Room Modifier');

		rootLayer.addEventListener('click', (e) => {
			if (e.target === rootLayer) {
				e.preventDefault();
				e.stopPropagation();
			}
		});

		const panel = document.createElement('div');
		panel.className = 'modal door-modifier-selection';
		panel.style.width = 'min(1000px, 95vw)';
		panel.style.maxHeight = '90vh';
		panel.style.pointerEvents = 'auto';

		const header = document.createElement('div');
		header.className = 'modal__header';
		header.style.display = 'flex';
		header.style.justifyContent = 'space-between';
		header.style.alignItems = 'center';
		
		const title = document.createElement('div');
		title.textContent = 'Select Room Modifier';
		title.style.fontSize = '20px';
		title.style.fontWeight = 'bold';
		
		const closeBtn = document.createElement('button');
		closeBtn.className = 'btn';
		closeBtn.textContent = '✕';
		closeBtn.style.padding = '8px 16px';
		closeBtn.style.fontSize = '18px';
		closeBtn.style.pointerEvents = 'auto';
		closeBtn.style.cursor = 'pointer';
		
		const closeClickHandler = (e) => {
			console.log('[DoorModifierSelection] Close button clicked');
			e.preventDefault();
			e.stopPropagation();
			closeModal();
		};
		closeBtn.onclick = closeClickHandler;
		closeBtn.addEventListener('click', closeClickHandler, true);
		closeBtn.addEventListener('click', closeClickHandler, false);
		closeBtn.addEventListener('mousedown', (e) => {
			console.log('[DoorModifierSelection] Close button mousedown');
			e.preventDefault();
			e.stopPropagation();
			setTimeout(() => {
				closeClickHandler(e);
			}, 0);
		}, false);
		
		header.appendChild(title);
		header.appendChild(closeBtn);

		body = document.createElement('div');
		body.className = 'modal__body';
		body.style.display = 'grid';
		body.style.gridTemplateColumns = '1fr 1fr';
		body.style.gap = '20px';
		body.style.maxHeight = 'calc(90vh - 200px)';
		body.style.overflow = 'auto';
		body.style.padding = '20px';
		body.style.pointerEvents = 'auto';

		// Left: Room Preview
		const previewPanel = document.createElement('div');
		previewPanel.style.display = 'flex';
		previewPanel.style.flexDirection = 'column';
		previewPanel.style.gap = '12px';
		
		const previewTitle = document.createElement('div');
		previewTitle.style.fontSize = '18px';
		previewTitle.style.fontWeight = 'bold';
		previewTitle.textContent = 'Room Preview';
		
		previewSection = document.createElement('div');
		previewSection.style.display = 'flex';
		previewSection.style.flexDirection = 'column';
		previewSection.style.gap = '8px';
		previewSection.style.padding = '16px';
		previewSection.style.backgroundColor = 'rgba(20, 20, 30, 0.8)';
		previewSection.style.borderRadius = '8px';
		previewSection.style.border = '2px solid #444';
		
		previewPanel.appendChild(previewTitle);
		previewPanel.appendChild(previewSection);

		// Right: Available Modifiers
		const modifierPanel = document.createElement('div');
		modifierPanel.style.display = 'flex';
		modifierPanel.style.flexDirection = 'column';
		modifierPanel.style.gap = '12px';
		
		const modifierTitle = document.createElement('div');
		modifierTitle.style.fontSize = '18px';
		modifierTitle.style.fontWeight = 'bold';
		modifierTitle.textContent = 'Available Modifiers';
		
		const modifierInfo = document.createElement('div');
		modifierInfo.style.fontSize = '12px';
		modifierInfo.style.color = '#aaa';
		modifierInfo.textContent = 'Click a modifier to preview its effects';
		
		modifierList = document.createElement('div');
		modifierList.style.display = 'flex';
		modifierList.style.flexDirection = 'column';
		modifierList.style.gap = '8px';
		modifierList.style.maxHeight = 'calc(90vh - 400px)';
		modifierList.style.overflowY = 'auto';
		modifierList.style.pointerEvents = 'auto';
		
		modifierPanel.appendChild(modifierTitle);
		modifierPanel.appendChild(modifierInfo);
		modifierPanel.appendChild(modifierList);

		body.appendChild(previewPanel);
		body.appendChild(modifierPanel);

		// Footer with buttons
		const footer = document.createElement('div');
		footer.className = 'modal__footer';
		footer.style.display = 'flex';
		footer.style.justifyContent = 'flex-end';
		footer.style.gap = '12px';
		footer.style.padding = '16px 20px';
		footer.style.borderTop = '1px solid #444';

		cancelBtn = document.createElement('button');
		cancelBtn.className = 'btn';
		cancelBtn.textContent = 'Cancel';
		cancelBtn.style.padding = '10px 20px';
		cancelBtn.style.pointerEvents = 'auto';
		cancelBtn.style.cursor = 'pointer';
		
		const cancelClickHandler = (e) => {
			console.log('[DoorModifierSelection] Cancel button clicked');
			e.preventDefault();
			e.stopPropagation();
			closeModal();
		};
		cancelBtn.onclick = cancelClickHandler;
		cancelBtn.addEventListener('click', cancelClickHandler, true);
		cancelBtn.addEventListener('click', cancelClickHandler, false);
		cancelBtn.addEventListener('mousedown', (e) => {
			console.log('[DoorModifierSelection] Cancel button mousedown');
			e.preventDefault();
			e.stopPropagation();
			setTimeout(() => {
				cancelClickHandler(e);
			}, 0);
		}, false);

		confirmBtn = document.createElement('button');
		confirmBtn.className = 'btn btn--primary';
		confirmBtn.textContent = 'Confirm';
		confirmBtn.style.padding = '10px 20px';
		confirmBtn.style.backgroundColor = '#4caf50';
		confirmBtn.style.color = '#fff';
		confirmBtn.style.pointerEvents = 'auto';
		confirmBtn.style.cursor = 'pointer';
		confirmBtn.disabled = true;
		
		const confirmClickHandler = (e) => {
			console.log('[DoorModifierSelection] Confirm button clicked');
			e.preventDefault();
			e.stopPropagation();
			if (selectedModifier && currentDoorPack) {
				applyModifierToDoor();
			}
		};
		confirmBtn.onclick = confirmClickHandler;
		confirmBtn.addEventListener('click', confirmClickHandler, true);
		confirmBtn.addEventListener('click', confirmClickHandler, false);
		confirmBtn.addEventListener('mousedown', (e) => {
			console.log('[DoorModifierSelection] Confirm button mousedown');
			e.preventDefault();
			e.stopPropagation();
			if (!confirmBtn.disabled) {
				setTimeout(() => {
					confirmClickHandler(e);
				}, 0);
			}
		}, false);

		footer.appendChild(cancelBtn);
		footer.appendChild(confirmBtn);

		panel.appendChild(header);
		panel.appendChild(body);
		panel.appendChild(footer);

		rootLayer.appendChild(panel);
		document.body.appendChild(rootLayer);
		layer = rootLayer;
		modal = panel;
	}

	function updatePreview() {
		if (!previewSection) return;
		
		previewSection.innerHTML = '';
		
		const opt = modifiedOption || originalOption;
		if (!opt) return;

		// Pack type (show modified if applicable)
		const displayPackType = selectedModifier && modifiedOption ? modifiedOption.packType : opt.packType;
		const packTypeDiv = document.createElement('div');
		packTypeDiv.style.fontSize = '16px';
		packTypeDiv.style.fontWeight = 'bold';
		packTypeDiv.style.color = selectedModifier ? '#4caf50' : '#ffff00';
		packTypeDiv.textContent = `${displayPackType} Pack${selectedModifier ? ' (Modified)' : ''}`;
		previewSection.appendChild(packTypeDiv);

		// Reward type
		const rewardTypeDiv = document.createElement('div');
		rewardTypeDiv.style.fontSize = '14px';
		rewardTypeDiv.style.color = '#ffffff';
		rewardTypeDiv.textContent = `Reward: ${opt.rewardType}`;
		previewSection.appendChild(rewardTypeDiv);

		// Room type info
		const roomTypeDiv = document.createElement('div');
		roomTypeDiv.style.fontSize = '12px';
		roomTypeDiv.style.color = '#aaa';
		roomTypeDiv.style.marginTop = '8px';
		roomTypeDiv.style.paddingTop = '8px';
		roomTypeDiv.style.borderTop = '1px solid #444';
		
		// Determine room type from pack type and modifier
		let roomType = opt.packType.toLowerCase();
		if (selectedModifier) {
			const family = selectedModifier.family || '';
			if (family === 'Rest Stop') roomType = 'Rest';
			else if (family === 'Safe Passage') roomType = 'Safe';
			else if (family === 'Treasure Cache') roomType = 'Treasure';
			else if (family === 'Elite Challenge') roomType = 'Elite';
			else if (family === 'Boss Rush') roomType = 'Boss';
		}
		
		roomTypeDiv.innerHTML = `<strong>Room Type:</strong> ${roomType.charAt(0).toUpperCase() + roomType.slice(1)}`;
		previewSection.appendChild(roomTypeDiv);

		// Modifier effects
		if (selectedModifier) {
			const modEffectsDiv = document.createElement('div');
			modEffectsDiv.style.fontSize = '12px';
			modEffectsDiv.style.color = '#4caf50';
			modEffectsDiv.style.marginTop = '8px';
			modEffectsDiv.style.paddingTop = '8px';
			modEffectsDiv.style.borderTop = '1px solid #444';
			modEffectsDiv.innerHTML = '<strong>Modifier Effects:</strong>';
			previewSection.appendChild(modEffectsDiv);

			const effectsList = document.createElement('ul');
			effectsList.style.margin = '4px 0 0 0';
			effectsList.style.paddingLeft = '20px';
			effectsList.style.listStyle = 'disc';
			
			const family = selectedModifier.family || '';
			const quality = selectedModifier._resolvedQuality || 'white';
			
			// Add modifier-specific effects
			if (family === 'Elite Armor') {
				effectsList.innerHTML += '<li>Enemies have +50% HP</li>';
			} else if (family === 'Swift Assault') {
				effectsList.innerHTML += '<li>Enemies move 30% faster</li>';
			} else if (family === 'Volatile Spawn') {
				effectsList.innerHTML += '<li>Enemies have 15% chance to explode on death</li>';
			} else if (family === 'Shielded Brood') {
				effectsList.innerHTML += '<li>Enemies have 20% chance to spawn with shield</li>';
			} else if (family === 'Double Trouble') {
				effectsList.innerHTML += '<li>Double enemy count</li>';
			} else if (family === 'Prism Tax') {
				effectsList.innerHTML += '<li>+20-60% quality shift, +1-3 bonus cards</li>';
			} else if (family === 'Scholar Sigil') {
				effectsList.innerHTML += '<li>+10-25% XP gain</li>';
			} else if (family === 'Loot Surge') {
				effectsList.innerHTML += '<li>+1-5 bonus cards, guaranteed rare+</li>';
			} else if (family === 'Mastery Boost') {
				effectsList.innerHTML += '<li>All cards gain +1 quality band</li>';
			} else if (family === 'Shard Mine') {
				effectsList.innerHTML += '<li>+15-50 shards, +1-3 bonus cards</li>';
			} else if (family === 'Rest Stop') {
				effectsList.innerHTML += '<li>Rest room: No enemies, health restore</li>';
			} else if (family === 'Safe Passage') {
				effectsList.innerHTML += '<li>Easy room: Fewer, weaker enemies</li>';
			} else if (family === 'Treasure Cache') {
				effectsList.innerHTML += '<li>Treasure room: Guaranteed shards</li>';
			} else if (family === 'Elite Challenge') {
				effectsList.innerHTML += '<li>Elite room: Stronger enemies, better rewards</li>';
			} else if (family === 'Boss Rush') {
				effectsList.innerHTML += '<li>Skip to next boss room</li>';
			}
			
			previewSection.appendChild(effectsList);
		}

		// Preview items
		if (opt.preview && opt.preview.length > 0) {
			const previewDiv = document.createElement('div');
			previewDiv.style.fontSize = '12px';
			previewDiv.style.color = '#aaa';
			previewDiv.style.marginTop = '8px';
			previewDiv.style.paddingTop = '8px';
			previewDiv.style.borderTop = '1px solid #444';
			previewDiv.innerHTML = '<strong>Rewards:</strong>';
			previewSection.appendChild(previewDiv);

			const previewList = document.createElement('ul');
			previewList.style.margin = '4px 0 0 0';
			previewList.style.paddingLeft = '20px';
			previewList.style.listStyle = 'disc';
			
			opt.preview.forEach(item => {
				const li = document.createElement('li');
				li.textContent = item;
				li.style.color = '#fff';
				previewList.appendChild(li);
			});
			
			previewSection.appendChild(previewList);
		}
	}

	function refreshModifierList() {
		if (!modifierList) return;
		
		modifierList.innerHTML = '';
		
		// Get available modifiers from run inventory
		// Check both locations - Game.roomModifierInventory is set at run start, DeckState.roomModifierInventory may also be used
		const modifiers = (typeof Game !== 'undefined' && Array.isArray(Game.roomModifierInventory) && Game.roomModifierInventory.length > 0)
			? Game.roomModifierInventory
			: (typeof DeckState !== 'undefined' && Array.isArray(DeckState.roomModifierInventory) && DeckState.roomModifierInventory.length > 0)
				? DeckState.roomModifierInventory
				: [];
		
		if (modifiers.length === 0) {
			const emptyMsg = document.createElement('div');
			emptyMsg.style.padding = '20px';
			emptyMsg.style.textAlign = 'center';
			emptyMsg.style.color = '#888';
			emptyMsg.textContent = 'No room modifiers available';
			modifierList.appendChild(emptyMsg);
			return;
		}

		const qualityColors = {
			white: '#cccccc',
			green: '#4caf50',
			blue: '#2196f3',
			purple: '#9c27b0',
			orange: '#ff9800'
		};

		modifiers.forEach(mod => {
			const modCard = document.createElement('div');
		modCard.style.padding = '12px';
		modCard.style.backgroundColor = 'rgba(30, 30, 40, 0.8)';
		modCard.style.border = '2px solid ' + (selectedModifier && selectedModifier.id === mod.id ? '#4caf50' : '#555');
		modCard.style.borderRadius = '6px';
		modCard.style.cursor = 'pointer';
		modCard.style.transition = 'all 0.2s';
		modCard.style.pointerEvents = 'auto';
		
		if (selectedModifier && selectedModifier.id === mod.id) {
			modCard.style.backgroundColor = 'rgba(76, 175, 80, 0.2)';
		}
		
		modCard.addEventListener('mouseenter', () => {
			if (!(selectedModifier && selectedModifier.id === mod.id)) {
				modCard.style.backgroundColor = 'rgba(50, 50, 60, 0.8)';
				modCard.style.borderColor = '#777';
			}
		});
		
		modCard.addEventListener('mouseleave', () => {
			if (!(selectedModifier && selectedModifier.id === mod.id)) {
				modCard.style.backgroundColor = 'rgba(30, 30, 40, 0.8)';
				modCard.style.borderColor = '#555';
			}
		});
		
		const modClickHandler = (e) => {
			console.log('[DoorModifierSelection] Modifier card clicked:', mod);
			e.preventDefault();
			e.stopPropagation();
			selectModifier(mod);
		};
		
		modCard.onclick = modClickHandler;
		modCard.addEventListener('click', modClickHandler, true);
		modCard.addEventListener('click', modClickHandler, false);
		modCard.addEventListener('mousedown', (e) => {
			console.log('[DoorModifierSelection] Modifier card mousedown:', mod);
			e.preventDefault();
			e.stopPropagation();
			setTimeout(() => {
				modClickHandler(e);
			}, 0);
		}, false);

			const quality = mod._resolvedQuality || 'white';
			const color = qualityColors[quality] || '#cccccc';

			const nameDiv = document.createElement('div');
			nameDiv.style.fontSize = '14px';
			nameDiv.style.fontWeight = 'bold';
			nameDiv.style.color = '#fff';
			nameDiv.textContent = mod.name || mod.family || 'Modifier';
			modCard.appendChild(nameDiv);

			const qualityDiv = document.createElement('div');
			qualityDiv.style.fontSize = '11px';
			qualityDiv.style.color = color;
			qualityDiv.style.marginTop = '4px';
			qualityDiv.textContent = `[${quality.toUpperCase()}]`;
			modCard.appendChild(qualityDiv);

			const familyDiv = document.createElement('div');
			familyDiv.style.fontSize = '11px';
			familyDiv.style.color = '#aaa';
			familyDiv.style.marginTop = '4px';
			familyDiv.textContent = mod.family || '';
			modCard.appendChild(familyDiv);

			modifierList.appendChild(modCard);
		});
	}

	function selectModifier(mod) {
		console.log('[DoorModifierSelection] Selecting modifier:', mod);
		selectedModifier = mod;
		
		// Create a modified copy of the option
		modifiedOption = JSON.parse(JSON.stringify(originalOption));
		
		// Apply modifier effects to preview
		// The actual application happens when door is selected
		modifiedOption.selectedModifier = mod;
		
		// Get modifier bonuses
		let modBonuses = null;
		if (typeof window.getModifierBonuses === 'function') {
			modBonuses = window.getModifierBonuses(mod);
		} else if (typeof getModifierBonuses === 'function') {
			modBonuses = getModifierBonuses(mod);
		}
		
		// Update pack type if modifier changes room type
		const family = mod.family || '';
		if (family === 'Rest Stop') {
			modifiedOption.packType = 'Rest';
		} else if (family === 'Safe Passage') {
			modifiedOption.packType = 'Safe';
		} else if (family === 'Treasure Cache') {
			modifiedOption.packType = 'Treasure';
		} else if (family === 'Elite Challenge') {
			modifiedOption.packType = 'Elite';
		} else if (family === 'Boss Rush') {
			modifiedOption.packType = 'Boss';
		}
		
		// Apply modifier bonuses to rewards
		if (modBonuses) {
			// Store bonuses in payload for later use
			if (!modifiedOption.payload) {
				modifiedOption.payload = {};
			}
			if (!modifiedOption.payload.modBonuses) {
				modifiedOption.payload.modBonuses = {};
			}
			modifiedOption.payload.modBonuses = {
				qualityShift: modBonuses.qualityShift || 0,
				bonusCards: modBonuses.bonusCards || 0,
				shards: modBonuses.shards || 0,
				minBand: modBonuses.minBand || null,
				ignoreCap: modBonuses.ignoreCap || false
			};
			
			// Update preview to show bonus rewards
			if (modifiedOption.rewardType === 'Card' && modifiedOption.payload && modifiedOption.payload.card) {
				// Add bonus cards to preview
				if (modBonuses.bonusCards > 0) {
					const bonusText = `+${modBonuses.bonusCards} bonus card(s)`;
					if (!modifiedOption.preview.includes(bonusText)) {
						modifiedOption.preview.push(bonusText);
					}
				}
				// Add guaranteed rare if applicable
				if (modBonuses.minBand === 'blue' && !modifiedOption.preview.includes('Guaranteed rare+')) {
					modifiedOption.preview.push('Guaranteed rare+');
				}
				// Update bonuses in payload
				if (modifiedOption.payload.bonuses) {
					modifiedOption.payload.bonuses.qualityShift = (modifiedOption.payload.bonuses.qualityShift || 0) + (modBonuses.qualityShift || 0);
					modifiedOption.payload.bonuses.bonusCards = (modifiedOption.payload.bonuses.bonusCards || 0) + (modBonuses.bonusCards || 0);
					if (modBonuses.minBand === 'blue') {
						modifiedOption.payload.bonuses.guaranteedRare = true;
					}
					if (modBonuses.ignoreCap) {
						modifiedOption.payload.bonuses.ignoreCap = true;
					}
				} else {
					modifiedOption.payload.bonuses = {
						qualityShift: modBonuses.qualityShift || 0,
						bonusCards: modBonuses.bonusCards || 0,
						guaranteedRare: modBonuses.minBand === 'blue',
						ignoreCap: modBonuses.ignoreCap || false
					};
				}
			} else if (modifiedOption.rewardType === 'Upgrade' || modifiedOption.rewardType === 'Shard') {
				// Add bonus shards to preview and payload
				if (modBonuses.shards > 0) {
					const bonusShardsText = `+${modBonuses.shards} bonus shards`;
					if (!modifiedOption.preview.includes(bonusShardsText)) {
						modifiedOption.preview.push(bonusShardsText);
					}
					// Store bonus shards in payload
					if (modifiedOption.payload.shards) {
						modifiedOption.payload.shards += modBonuses.shards;
					} else {
						modifiedOption.payload.bonusShards = modBonuses.shards;
					}
				}
			}
		}
		
		updatePreview();
		refreshModifierList();
		
		if (confirmBtn) {
			confirmBtn.disabled = false;
			confirmBtn.style.pointerEvents = 'auto';
			confirmBtn.style.cursor = 'pointer';
		}
	}

	function applyModifierToDoor() {
		if (!currentDoorPack || !selectedModifier) return;
		
		console.log('[DoorModifierSelection] Applying modifier to door:', selectedModifier);
		
		// Store the modifier on the door pack (will be consumed when door is selected)
		currentDoorPack.selectedModifier = selectedModifier;
		currentDoorPack.modifiedOption = modifiedOption;
		
		// The modified option will be used when rendering and selecting the door
		
		// Remove modifier from inventory immediately (consumed when confirmed)
		// Remove from both locations to keep them in sync
		if (typeof Game !== 'undefined' && Array.isArray(Game.roomModifierInventory)) {
			const idx = Game.roomModifierInventory.findIndex(m => m && m.id === selectedModifier.id);
			if (idx >= 0) {
				Game.roomModifierInventory.splice(idx, 1);
				console.log('[DoorModifierSelection] Removed modifier from Game.roomModifierInventory');
			}
		}
		if (typeof DeckState !== 'undefined' && Array.isArray(DeckState.roomModifierInventory)) {
			const idx = DeckState.roomModifierInventory.findIndex(m => m && m.id === selectedModifier.id);
			if (idx >= 0) {
				DeckState.roomModifierInventory.splice(idx, 1);
				console.log('[DoorModifierSelection] Removed modifier from DeckState.roomModifierInventory');
			}
		}
		
		// Also remove from collection (one-time use)
		if (typeof SaveSystem !== 'undefined') {
			const save = SaveSystem.load();
			if (Array.isArray(save.roomModifierCollection)) {
				const idx = save.roomModifierCollection.findIndex(m => m.id === selectedModifier.id);
				if (idx >= 0) {
					save.roomModifierCollection.splice(idx, 1);
					SaveSystem.save(save);
					console.log('[DoorModifierSelection] Removed modifier from collection (consumed)');
				}
			}
		}
		
		closeModal();
	}

	function closeModal() {
		if (typeof Game !== 'undefined') {
			Game.showingDoorModifierSelection = false;
		}
		currentDoorPack = null;
		selectedModifier = null;
		originalOption = null;
		modifiedOption = null;
		refresh();
	}

	function refresh() {
		if (!layer) return;
		
		const shouldShow = typeof Game !== 'undefined' 
			&& Game.showingDoorModifierSelection 
			&& Game.state === 'PLAYING'
			&& currentDoorPack;
		
		if (shouldShow) {
			layer.style.display = 'block';
			updatePreview();
			refreshModifierList();
		} else {
			layer.style.display = 'none';
		}
	}

	function openForDoor(doorPack) {
		if (!doorPack || !doorPack.option) {
			console.warn('[DoorModifierSelection] Cannot open: invalid door pack');
			return;
		}
		
		console.log('[DoorModifierSelection] Opening for door:', doorPack);
		currentDoorPack = doorPack;
		originalOption = JSON.parse(JSON.stringify(doorPack.option));
		modifiedOption = null;
		selectedModifier = doorPack.selectedModifier || null;
		
		if (typeof Game !== 'undefined') {
			Game.showingDoorModifierSelection = true;
		}
		
		refresh();
	}

	// Expose function to open modal
	window.openDoorModifierSelection = openForDoor;

	function tick() {
		refresh();
		requestAnimationFrame(tick);
	}

	function init() {
		console.log('[DoorModifierSelection] Initializing component');
		createDoorModifierSelection();
		console.log('[DoorModifierSelection] Component created, starting tick loop');
		tick();
	}

	if (document.readyState === 'loading') {
		console.log('[DoorModifierSelection] Document still loading, waiting for DOMContentLoaded');
		document.addEventListener('DOMContentLoaded', init, { once: true });
	} else {
		init();
	}
})();

