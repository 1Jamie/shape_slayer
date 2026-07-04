(function () {
	console.log('[RoomModifierSelection] Script loading...');
	let layer, modal, body, selectedList, collectionList, purchaseBtn, convertBtn;

	function createRoomModifierSelection() {
		console.log('[RoomModifierSelection] Creating component DOM');
		const rootLayer = document.createElement('div');
		rootLayer.className = 'ui-layer ui-layer--modal';
		rootLayer.style.display = 'none';
		rootLayer.style.pointerEvents = 'auto';
		rootLayer.style.position = 'fixed';
		rootLayer.style.inset = '0';
		rootLayer.style.zIndex = '10000';
		rootLayer.setAttribute('role', 'dialog');
		rootLayer.setAttribute('aria-modal', 'true');
		rootLayer.setAttribute('aria-label', 'Room Modifier Selection');
		
		// Prevent clicks on the background from closing the modal
		rootLayer.addEventListener('click', (e) => {
			if (e.target === rootLayer) {
				e.stopPropagation();
			}
		});

		const panel = document.createElement('div');
		panel.className = 'modal room-modifier-selection';
		panel.style.width = 'min(1200px, 95vw)';
		panel.style.maxHeight = '90vh';

		const header = document.createElement('div');
		header.className = 'modal__header';
		header.style.display = 'flex';
		header.style.justifyContent = 'space-between';
		header.style.alignItems = 'center';
		
		const title = document.createElement('div');
		title.textContent = 'Room Modifiers';
		title.style.fontSize = '20px';
		title.style.fontWeight = 'bold';
		
		const closeBtn = document.createElement('button');
		closeBtn.className = 'btn';
		closeBtn.textContent = '✕';
		closeBtn.style.padding = '8px 16px';
		closeBtn.style.fontSize = '18px';
		closeBtn.addEventListener('click', () => {
			if (typeof Game !== 'undefined') {
				Game.showingRoomModifierSelection = false;
			}
			refresh();
		});
		
		header.appendChild(title);
		header.appendChild(closeBtn);

		body = document.createElement('div');
		body.className = 'modal__body nexus-scrollbar';
		body.style.display = 'grid';
		body.style.gridTemplateColumns = '1fr 1fr';
		body.style.gap = '20px';
		body.style.maxHeight = 'calc(90vh - 200px)';
		body.style.overflow = 'auto';
		body.style.padding = '20px';

		// Left: Collection
		const collectionPanel = document.createElement('div');
		collectionPanel.style.display = 'flex';
		collectionPanel.style.flexDirection = 'column';
		collectionPanel.style.gap = '12px';
		
		const collectionTitle = document.createElement('div');
		collectionTitle.style.fontSize = '18px';
		collectionTitle.style.fontWeight = 'bold';
		collectionTitle.textContent = 'Collection';
		
		const collectionInfo = document.createElement('div');
		collectionInfo.style.fontSize = '12px';
		collectionInfo.style.color = '#aaa';
		collectionInfo.textContent = 'Select modifiers to carry on your run (max 3)';
		
		collectionList = document.createElement('div');
		collectionList.className = 'nexus-scrollbar';
		collectionList.style.display = 'flex';
		collectionList.style.flexDirection = 'column';
		collectionList.style.gap = '8px';
		collectionList.style.maxHeight = 'calc(90vh - 350px)';
		collectionList.style.overflowY = 'auto';
		
		collectionPanel.appendChild(collectionTitle);
		collectionPanel.appendChild(collectionInfo);
		collectionPanel.appendChild(collectionList);

		// Right: Selected for Run
		const selectedPanel = document.createElement('div');
		selectedPanel.style.display = 'flex';
		selectedPanel.style.flexDirection = 'column';
		selectedPanel.style.gap = '12px';
		
		const selectedTitle = document.createElement('div');
		selectedTitle.style.fontSize = '18px';
		selectedTitle.style.fontWeight = 'bold';
		selectedTitle.textContent = 'Selected for Run';
		
		const selectedInfo = document.createElement('div');
		selectedInfo.style.fontSize = '12px';
		selectedInfo.style.color = '#aaa';
		selectedInfo.id = 'selected-info';
		
		selectedList = document.createElement('div');
		selectedList.className = 'nexus-scrollbar';
		selectedList.style.display = 'flex';
		selectedList.style.flexDirection = 'column';
		selectedList.style.gap = '8px';
		selectedList.style.minHeight = '200px';
		selectedList.style.maxHeight = 'calc(90vh - 350px)';
		selectedList.style.overflowY = 'auto';
		
		selectedPanel.appendChild(selectedTitle);
		selectedPanel.appendChild(selectedInfo);
		selectedPanel.appendChild(selectedList);

		body.appendChild(collectionPanel);
		body.appendChild(selectedPanel);

		// Footer with actions
		const footer = document.createElement('div');
		footer.className = 'modal__footer';
		footer.style.display = 'flex';
		footer.style.justifyContent = 'space-between';
		footer.style.alignItems = 'center';
		footer.style.gap = '12px';
		
		const leftActions = document.createElement('div');
		leftActions.style.display = 'flex';
		leftActions.style.gap = '8px';
		
		purchaseBtn = document.createElement('button');
		purchaseBtn.className = 'btn';
		purchaseBtn.textContent = 'Purchase Random (50 shards)';
		purchaseBtn.addEventListener('click', purchaseRandomModifier);
		
		convertBtn = document.createElement('button');
		convertBtn.className = 'btn';
		convertBtn.textContent = 'Convert Selected to Shards';
		convertBtn.addEventListener('click', convertSelectedToShards);
		
		leftActions.appendChild(purchaseBtn);
		leftActions.appendChild(convertBtn);
		
		const rightActions = document.createElement('div');
		const confirmBtn = document.createElement('button');
		confirmBtn.className = 'btn';
		confirmBtn.style.background = '#4caf50';
		confirmBtn.textContent = 'Confirm Selection';
		confirmBtn.addEventListener('click', () => {
			if (typeof Game !== 'undefined') {
				Game.showingRoomModifierSelection = false;
			}
			refresh();
		});
		rightActions.appendChild(confirmBtn);
		
		footer.appendChild(leftActions);
		footer.appendChild(rightActions);

		panel.appendChild(header);
		panel.appendChild(body);
		panel.appendChild(footer);
		rootLayer.appendChild(panel);

		const root = window.UIRoot && window.UIRoot.ensure ? window.UIRoot.ensure() : document.body;
		root.appendChild(rootLayer);
		layer = rootLayer;
		modal = panel;
		console.log('[RoomModifierSelection] Component DOM created and added to root, layer:', layer, 'root:', root);
		
		// Handle escape key to close modal
		document.addEventListener('keydown', (e) => {
			// Don't intercept if user is typing in an input field
			const target = e.target;
			if (typeof isFormFieldTarget === 'function' && isFormFieldTarget(target)) {
				return;
			}
			
			if (e.key === 'Escape' && layer && layer.style.display !== 'none' && layer.style.display !== '') {
				if (typeof Game !== 'undefined') {
					Game.showingRoomModifierSelection = false;
				}
				refresh();
				e.preventDefault();
				e.stopPropagation();
			}
		}, { capture: true });
		
		// Add mobile scaling styles
		if (!document.getElementById('room-modifier-selection-mobile-styles')) {
			const style = document.createElement('style');
			style.id = 'room-modifier-selection-mobile-styles';
			style.textContent = `
				@media (min-aspect-ratio: 2/1) and (max-width: 1024px) {
					.modal.room-modifier-selection {
						width: min(90vw, 1200px) !important;
						max-height: 90vh !important;
					}
					.modal.room-modifier-selection .modal__header {
						padding: 12px 16px !important;
					}
					.modal.room-modifier-selection .modal__header > div {
						font-size: 18px !important;
					}
					.modal.room-modifier-selection .modal__header .btn {
						padding: 6px 12px !important;
						font-size: 16px !important;
					}
					.modal.room-modifier-selection .modal__body {
						padding: 12px 16px !important;
						gap: 12px !important;
						grid-template-columns: 1fr !important;
					}
					.modal.room-modifier-selection .modal__body > div > div[style*="fontSize: 18px"] {
						font-size: 16px !important;
					}
					.modal.room-modifier-selection .modal__body > div > div[style*="fontSize: 12px"] {
						font-size: 11px !important;
					}
					.modal.room-modifier-selection .modal__footer {
						padding: 10px 12px !important;
						gap: 8px !important;
					}
					.modal.room-modifier-selection .modal__footer .btn {
						padding: 8px 12px !important;
						font-size: 0.9em !important;
					}
				}
			`;
			document.head.appendChild(style);
		}
	}

	function build() {
		if (!layer || !body || !collectionList || !selectedList) return;
		
		// Clear existing content
		collectionList.innerHTML = '';
		selectedList.innerHTML = '';
		
		if (typeof SaveSystem === 'undefined' || !SaveSystem.load) return;
		if (typeof Game === 'undefined') return;
		
		const save = SaveSystem.load();
		const collection = Array.isArray(save.roomModifierCollection) ? save.roomModifierCollection : [];
		const slots = (SaveSystem.getDeckUpgrades ? (SaveSystem.getDeckUpgrades().roomModifierCarrySlots || 3) : 3);
		
		// Initialize selected modifiers if not set
		if (!Array.isArray(Game.selectedRoomModifiers)) {
			Game.selectedRoomModifiers = [];
		}
		// Use direct reference to Game.selectedRoomModifiers
		const selected = Game.selectedRoomModifiers;
		
		// Update selected info
		const selectedInfo = document.getElementById('selected-info');
		if (selectedInfo) {
			selectedInfo.textContent = `${selected.length}/${slots} modifiers selected`;
			selectedInfo.style.color = selected.length >= slots ? '#4caf50' : '#aaa';
		}
		
		// Build collection list
		collection.forEach((mod, idx) => {
			const isSelected = selected.some(s => s && s.id === mod.id);
			const item = document.createElement('div');
			item.style.display = 'flex';
			item.style.justifyContent = 'space-between';
			item.style.alignItems = 'center';
			item.style.padding = '12px';
			item.style.background = isSelected ? 'rgba(76, 175, 80, 0.2)' : 'rgba(255, 255, 255, 0.05)';
			item.style.border = `1px solid ${isSelected ? '#4caf50' : '#555'}`;
			item.style.borderRadius = '4px';
			item.style.cursor = isSelected || selected.length >= slots ? 'default' : 'pointer';
			item.style.opacity = isSelected ? '0.7' : '1';
			
			const info = document.createElement('div');
			info.style.flex = '1';
			
			const name = document.createElement('div');
			name.style.fontWeight = 'bold';
			name.style.marginBottom = '4px';
			name.textContent = mod.family || mod.name || mod.id;
			
			const quality = mod._resolvedQuality || 'white';
			const qualityColors = {
				white: '#fff',
				green: '#4caf50',
				blue: '#2196f3',
				purple: '#9c27b0',
				orange: '#ff9800'
			};
			name.style.color = qualityColors[quality] || '#fff';
			
			const desc = document.createElement('div');
			desc.style.fontSize = '12px';
			desc.style.color = '#aaa';
			if (mod.qualityBands && mod.qualityBands[quality]) {
				desc.textContent = mod.qualityBands[quality].description || '';
			} else {
				desc.textContent = 'Room modifier';
			}
			
			info.appendChild(name);
			info.appendChild(desc);
			
			const actions = document.createElement('div');
			actions.style.display = 'flex';
			actions.style.gap = '8px';
			
			if (!isSelected && selected.length < slots) {
				const selectBtn = document.createElement('button');
				selectBtn.className = 'btn';
				selectBtn.textContent = 'Select';
				selectBtn.style.padding = '6px 12px';
				selectBtn.style.fontSize = '12px';
				selectBtn.style.pointerEvents = 'auto';
				selectBtn.style.cursor = 'pointer';
				
				const selectClickHandler = (e) => {
					console.log('[RoomModifierSelection] Select button click handler called for:', mod.family || mod.name);
					e.preventDefault();
					e.stopPropagation();
					console.log('[RoomModifierSelection] Select button clicked for:', mod.family || mod.name);
					if (typeof Game !== 'undefined' && Game.selectedRoomModifiers.length < slots) {
						// Check if already selected (prevent duplicates)
						const alreadySelected = Game.selectedRoomModifiers.some(s => s && s.id === mod.id);
						if (!alreadySelected) {
							Game.selectedRoomModifiers.push(mod);
							console.log('[RoomModifierSelection] Added modifier to selection:', mod.family || mod.name, 'Total:', Game.selectedRoomModifiers.length);
							build();
						} else {
							console.log('[RoomModifierSelection] Modifier already selected');
						}
					} else {
						console.log('[RoomModifierSelection] Cannot select - Game undefined or slots full');
					}
				};
				
				// Add both click and mousedown handlers
				selectBtn.onclick = selectClickHandler;
				selectBtn.addEventListener('click', selectClickHandler, true); // Use capture phase
				selectBtn.addEventListener('click', selectClickHandler, false); // Use bubble phase
				selectBtn.addEventListener('mousedown', (e) => {
					console.log('[RoomModifierSelection] Select button mousedown for:', mod.family || mod.name);
					// If click doesn't fire, trigger it manually
					e.preventDefault();
					e.stopPropagation();
					// Use setTimeout to ensure mousedown completes first
					setTimeout(() => {
						console.log('[RoomModifierSelection] Triggering click programmatically after mousedown');
						selectClickHandler(e);
					}, 0);
				}, false);
				
				actions.appendChild(selectBtn);
			} else if (isSelected) {
				const removeBtn = document.createElement('button');
				removeBtn.className = 'btn';
				removeBtn.textContent = 'Remove';
				removeBtn.style.padding = '6px 12px';
				removeBtn.style.fontSize = '12px';
				removeBtn.style.background = '#f44336';
				const removeClickHandler = (e) => {
					e.preventDefault();
					e.stopPropagation();
					console.log('[RoomModifierSelection] Remove button clicked for:', mod.family || mod.name);
					if (typeof Game !== 'undefined') {
						const idx = Game.selectedRoomModifiers.findIndex(s => s && s.id === mod.id);
						if (idx >= 0) {
							Game.selectedRoomModifiers.splice(idx, 1);
							console.log('[RoomModifierSelection] Removed modifier from selection:', mod.family || mod.name);
							build();
						}
					}
				};
				removeBtn.addEventListener('click', removeClickHandler, false);
				removeBtn.addEventListener('mousedown', (e) => {
					console.log('[RoomModifierSelection] Remove button mousedown for:', mod.family || mod.name);
				}, false);
				actions.appendChild(removeBtn);
			}
			
			const convertBtn = document.createElement('button');
			convertBtn.className = 'btn';
			convertBtn.textContent = '→ 25 shards';
			convertBtn.style.padding = '6px 12px';
			convertBtn.style.fontSize = '12px';
			convertBtn.style.background = '#ff9800';
			convertBtn.style.pointerEvents = 'auto';
			convertBtn.style.cursor = 'pointer';
			
			const convertClickHandler = (e) => {
				e.preventDefault();
				e.stopPropagation();
				console.log('[RoomModifierSelection] Convert button clicked for:', mod.family || mod.name);
				convertModifierToShards(mod);
			};
			
			convertBtn.addEventListener('click', convertClickHandler, false);
			actions.appendChild(convertBtn);
			
			item.appendChild(info);
			item.appendChild(actions);
			
			if (!isSelected && selected.length < slots) {
				item.addEventListener('click', (e) => {
					// Don't trigger if clicking on a button
					if (e.target === selectBtn || e.target === convertBtn || e.target.closest('button')) {
						return;
					}
					console.log('[RoomModifierSelection] Item clicked for:', mod.family || mod.name);
					if (typeof Game !== 'undefined' && Game.selectedRoomModifiers.length < slots) {
						// Check if already selected (prevent duplicates)
						const alreadySelected = Game.selectedRoomModifiers.some(s => s && s.id === mod.id);
						if (!alreadySelected) {
							Game.selectedRoomModifiers.push(mod);
							console.log('[RoomModifierSelection] Added modifier to selection (item click):', mod.family || mod.name);
							build();
						}
					}
				}, false);
			}
			
			collectionList.appendChild(item);
		});
		
		// Build selected list
		if (selected.length === 0) {
			const empty = document.createElement('div');
			empty.style.padding = '20px';
			empty.style.textAlign = 'center';
			empty.style.color = '#666';
			empty.textContent = 'No modifiers selected. Click modifiers from your collection to add them.';
			selectedList.appendChild(empty);
		} else {
			selected.forEach((mod, idx) => {
				const item = document.createElement('div');
				item.style.display = 'flex';
				item.style.justifyContent = 'space-between';
				item.style.alignItems = 'center';
				item.style.padding = '12px';
				item.style.background = 'rgba(76, 175, 80, 0.1)';
				item.style.border = '1px solid #4caf50';
				item.style.borderRadius = '4px';
				
				const info = document.createElement('div');
				info.style.flex = '1';
				
				const name = document.createElement('div');
				name.style.fontWeight = 'bold';
				name.style.marginBottom = '4px';
				name.textContent = mod.family || mod.name || mod.id;
				
				const quality = mod._resolvedQuality || 'white';
				const qualityColors = {
					white: '#fff',
					green: '#4caf50',
					blue: '#2196f3',
					purple: '#9c27b0',
					orange: '#ff9800'
				};
				name.style.color = qualityColors[quality] || '#fff';
				
				const desc = document.createElement('div');
				desc.style.fontSize = '12px';
				desc.style.color = '#aaa';
				if (mod.qualityBands && mod.qualityBands[quality]) {
					desc.textContent = mod.qualityBands[quality].description || '';
				}
				
				info.appendChild(name);
				info.appendChild(desc);
				
				const removeBtn = document.createElement('button');
				removeBtn.className = 'btn';
				removeBtn.textContent = '✕';
				removeBtn.style.padding = '6px 12px';
				removeBtn.style.fontSize = '14px';
				removeBtn.style.background = '#f44336';
				removeBtn.addEventListener('click', () => {
					Game.selectedRoomModifiers.splice(idx, 1);
					console.log('[RoomModifierSelection] Removed modifier from selection (selected list):', mod.family || mod.name);
					build();
				});
				
				item.appendChild(info);
				item.appendChild(removeBtn);
				selectedList.appendChild(item);
			});
		}
		
		// Update purchase button state
		if (purchaseBtn) {
			const shards = (typeof SaveSystem !== 'undefined' && SaveSystem.getCardShards) ? SaveSystem.getCardShards() : 0;
			purchaseBtn.disabled = shards < 50;
			purchaseBtn.textContent = `Purchase Random (50 shards) - You have ${shards}`;
			purchaseBtn.style.opacity = shards < 50 ? '0.5' : '1';
		}
	}

	function convertModifierToShards(mod) {
		if (typeof SaveSystem === 'undefined' || !SaveSystem.load || !SaveSystem.save || !SaveSystem.addCardShards) return;
		
		const save = SaveSystem.load();
		if (!Array.isArray(save.roomModifierCollection)) return;
		
		const idx = save.roomModifierCollection.findIndex(m => m.id === mod.id);
		if (idx >= 0) {
			save.roomModifierCollection.splice(idx, 1);
			SaveSystem.save(save);
			SaveSystem.addCardShards(25);
			
			// Remove from selected if present
			if (typeof Game !== 'undefined' && Array.isArray(Game.selectedRoomModifiers)) {
				const selIdx = Game.selectedRoomModifiers.findIndex(s => s && s.id === mod.id);
				if (selIdx >= 0) {
					Game.selectedRoomModifiers.splice(selIdx, 1);
				}
			}
			
			build();
			console.log(`[Room Modifier] Converted ${mod.family || mod.name} to 25 shards`);
		}
	}

	function convertSelectedToShards() {
		if (typeof Game === 'undefined' || !Array.isArray(Game.selectedRoomModifiers)) return;
		if (Game.selectedRoomModifiers.length === 0) return;
		
		const selected = Game.selectedRoomModifiers.slice();
		let totalShards = 0;
		
		selected.forEach(mod => {
			convertModifierToShards(mod);
			totalShards += 25;
		});
		
		Game.selectedRoomModifiers = [];
		build();
		console.log(`[Room Modifier] Converted ${selected.length} modifiers to ${totalShards} shards`);
	}

	function purchaseRandomModifier() {
		if (typeof SaveSystem === 'undefined' || !SaveSystem.getCardShards || !SaveSystem.addCardShards || !SaveSystem.load || !SaveSystem.save) return;
		
		const shards = SaveSystem.getCardShards();
		if (shards < 50) {
			console.log('[Room Modifier] Not enough shards to purchase');
			return;
		}
		
		// Get available room modifier cards
		if (typeof ROOM_MODIFIER_CARDS === 'undefined' || !Array.isArray(ROOM_MODIFIER_CARDS)) {
			console.log('[Room Modifier] Room modifier cards not available');
			return;
		}
		
		// Check storage cap
		const save = SaveSystem.load();
		if (!Array.isArray(save.roomModifierCollection)) {
			save.roomModifierCollection = [];
		}
		const maxStorage = 40;
		if (save.roomModifierCollection.length >= maxStorage) {
			console.log('[Room Modifier] Collection full, cannot purchase');
			// TODO: Show UI message
			return;
		}
		
		// Select random modifier
		const available = ROOM_MODIFIER_CARDS.filter(mod => {
			// Filter by quality distribution (weighted towards lower qualities)
			return true;
		});
		
		if (available.length === 0) {
			console.log('[Room Modifier] No modifiers available');
			return;
		}
		
		// Weighted random: 40% white, 30% green, 20% blue, 8% purple, 2% orange
		const rand = Math.random();
		let quality = 'white';
		if (rand < 0.40) quality = 'white';
		else if (rand < 0.70) quality = 'green';
		else if (rand < 0.90) quality = 'blue';
		else if (rand < 0.98) quality = 'purple';
		else quality = 'orange';
		
		// Find modifier with matching quality
		const qualityMods = available.filter(mod => {
			const modQuality = mod._resolvedQuality || mod.id.split('_').pop() || 'white';
			return modQuality === quality;
		});
		
		const selectedMod = qualityMods.length > 0 
			? qualityMods[Math.floor(Math.random() * qualityMods.length)]
			: available[Math.floor(Math.random() * available.length)];
		
		// Create instance with resolved quality
		const modInstance = { ...selectedMod };
		modInstance._resolvedQuality = quality;
		
		// Add to collection
		save.roomModifierCollection.push(modInstance);
		// Track discovery
		if (modInstance.id && SaveSystem.discoverUtilityCard) {
			SaveSystem.discoverUtilityCard(modInstance.id);
		}
		SaveSystem.save(save);
		SaveSystem.addCardShards(-50);
		
		build();
		console.log(`[Room Modifier] Purchased ${modInstance.family || modInstance.name} (${quality}) for 50 shards`);
	}

	function isVisible() {

		if (typeof Game === 'undefined') {
			return false;
		}
		if (Game.state !== 'NEXUS') {
			return false;
		}
		const shouldShow = !!Game.showingRoomModifierSelection;
		if (shouldShow && !layer) {
			console.warn('[RoomModifierSelection] Layer not initialized but should be visible');
		}
		return shouldShow;
	}

	function refresh() {
		if (!layer) {
			return;
		}
		const visible = isVisible();
		if (visible) {
			layer.style.display = 'flex';
			build();
		} else {
			layer.style.display = 'none';
		}
	}

	function tick() {
		refresh();
		requestAnimationFrame(tick);
	}

	function init() {
		console.log('[RoomModifierSelection] Initializing component');
		createRoomModifierSelection();
		console.log('[RoomModifierSelection] Component created, starting tick loop');
		tick();
	}

	if (document.readyState === 'loading') {
		console.log('[RoomModifierSelection] Document still loading, waiting for DOMContentLoaded');
		document.addEventListener('DOMContentLoaded', init, { once: true });
	} else {
		console.log('[RoomModifierSelection] Document ready, initializing immediately');
		init();
	}
})();

