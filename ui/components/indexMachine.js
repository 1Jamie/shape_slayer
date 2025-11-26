(function () {
	let layer, modal, body, previewSection;
	let open = false;
	let currentTab = 'affixes'; // 'affixes', 'cards', 'utilityCards', 'items'
	let selectedEntry = null; // Currently selected entry for preview

	function createIndexMachine() {
		const rootLayer = document.createElement('div');
		rootLayer.className = 'ui-layer ui-layer--modal';
		rootLayer.style.display = 'none';
		rootLayer.style.pointerEvents = 'auto';
		rootLayer.style.position = 'fixed';
		rootLayer.style.inset = '0';
		rootLayer.style.zIndex = '10000';
		rootLayer.setAttribute('role', 'dialog');
		rootLayer.setAttribute('aria-modal', 'true');
		rootLayer.setAttribute('aria-label', 'Index');

		// Prevent clicks on the background from closing the modal
		rootLayer.addEventListener('click', (e) => {
			if (e.target === rootLayer) {
				e.stopPropagation();
			}
		});

		const panel = document.createElement('div');
		panel.className = 'modal index-machine';
		panel.style.width = 'min(1200px, 95vw)';
		panel.style.maxHeight = '90vh';
		panel.style.display = 'flex';
		panel.style.flexDirection = 'column';

		const header = document.createElement('div');
		header.className = 'modal__header';
		header.style.display = 'flex';
		header.style.justifyContent = 'space-between';
		header.style.alignItems = 'center';
		header.style.padding = '20px';
		header.style.borderBottom = '2px solid #444';

		const title = document.createElement('h2');
		title.textContent = 'Index';
		title.style.margin = '0';
		title.style.color = '#fff';

		const closeBtn = document.createElement('button');
		closeBtn.className = 'btn';
		closeBtn.textContent = '✕';
		closeBtn.style.padding = '8px 16px';
		closeBtn.style.fontSize = '18px';
		closeBtn.addEventListener('click', () => toggle(false));

		header.appendChild(title);
		header.appendChild(closeBtn);

		// Tab navigation
		const tabContainer = document.createElement('div');
		tabContainer.style.display = 'flex';
		tabContainer.style.gap = '10px';
		tabContainer.style.padding = '10px 20px';
		tabContainer.style.borderBottom = '1px solid #333';
		tabContainer.style.backgroundColor = '#1a1a1a';

		const tabs = [
			{ key: 'affixes', label: 'Affixes', icon: '⚔' },
			{ key: 'cards', label: 'Cards', icon: '🃏' },
			{ key: 'utilityCards', label: 'Utility Cards', icon: '🎴' },
			{ key: 'items', label: 'Items', icon: '📦' }
		];

		tabs.forEach(tab => {
			const tabBtn = document.createElement('button');
			tabBtn.className = 'btn';
			tabBtn.textContent = `${tab.icon} ${tab.label}`;
			tabBtn.style.padding = '10px 20px';
			tabBtn.style.fontSize = '14px';
			tabBtn.style.borderRadius = '4px';
			tabBtn.style.border = 'none';
			tabBtn.style.backgroundColor = 'transparent';
			tabBtn.style.color = '#aaa';
			tabBtn.style.cursor = 'pointer';
			tabBtn.dataset.tab = tab.key;
			tabBtn.addEventListener('click', () => switchTab(tab.key));
			tabContainer.appendChild(tabBtn);
		});

		// Create two-column layout
		const bodyContainer = document.createElement('div');
		bodyContainer.style.display = 'flex';
		bodyContainer.style.flex = '1';
		bodyContainer.style.overflow = 'hidden';
		bodyContainer.style.gap = '20px';

		body = document.createElement('div');
		body.className = 'modal__body nexus-scrollbar';
		body.style.flex = '1';
		body.style.overflow = 'auto';
		body.style.padding = '20px';
		body.style.minWidth = '0'; // Allow flex shrinking

		previewSection = document.createElement('div');
		previewSection.className = 'index-preview nexus-scrollbar';
		previewSection.style.width = '400px';
		previewSection.style.padding = '20px';
		previewSection.style.backgroundColor = '#1a1a1a';
		previewSection.style.borderLeft = '2px solid #444';
		previewSection.style.overflow = 'auto';
		previewSection.style.display = 'flex';
		previewSection.style.flexDirection = 'column';

		const previewPlaceholder = document.createElement('div');
		previewPlaceholder.style.color = '#666';
		previewPlaceholder.style.fontSize = '14px';
		previewPlaceholder.style.textAlign = 'center';
		previewPlaceholder.style.marginTop = '50%';
		previewPlaceholder.textContent = 'Select an entry to view details';
		previewSection.appendChild(previewPlaceholder);

		bodyContainer.appendChild(body);
		bodyContainer.appendChild(previewSection);

		panel.appendChild(header);
		panel.appendChild(tabContainer);
		panel.appendChild(bodyContainer);

		rootLayer.appendChild(panel);

		const root = window.UIRoot && window.UIRoot.ensure ? window.UIRoot.ensure() : document.body;
		root.appendChild(rootLayer);
		layer = rootLayer;
		modal = panel;

		// Handle escape key to close modal
		document.addEventListener('keydown', (e) => {
			// Don't intercept if user is typing in an input field
			const target = e.target;
			if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
				return;
			}
			
			if (e.key === 'Escape' && open && layer && layer.style.display !== 'none' && layer.style.display !== '') {
				toggle(false);
				e.preventDefault();
				e.stopPropagation();
			}
		}, { capture: true });
	}

	function switchTab(tab) {
		currentTab = tab;
		selectedEntry = null;
		refresh();
		updatePreview(null);
		// Update tab button styles
		const tabButtons = modal.querySelectorAll('[data-tab]');
		tabButtons.forEach(btn => {
			if (btn.dataset.tab === tab) {
				btn.style.backgroundColor = '#333';
				btn.style.color = '#fff';
			} else {
				btn.style.backgroundColor = 'transparent';
				btn.style.color = '#aaa';
			}
		});
	}

	function refresh() {
		if (!body) return;

		body.innerHTML = '';

		if (typeof SaveSystem === 'undefined' || !SaveSystem.getDiscoveries) {
			body.innerHTML = '<p style="color: #aaa;">Save system not available</p>';
			return;
		}

		// Sync existing unlocks to discoveries before displaying
		if (typeof SaveSystem.syncExistingUnlocksToDiscoveries === 'function') {
			SaveSystem.syncExistingUnlocksToDiscoveries();
		}

		const discoveries = SaveSystem.getDiscoveries();

		if (currentTab === 'affixes') {
			renderAffixes(discoveries.affixes || []);
		} else if (currentTab === 'cards') {
			renderCards(discoveries.cards || []);
		} else if (currentTab === 'utilityCards') {
			renderUtilityCards(discoveries.utilityCards || []);
		} else if (currentTab === 'items') {
			renderItems(discoveries.items || []);
		}
	}

	function renderAffixes(discovered) {
		if (typeof AFFIX_POOL === 'undefined') {
			body.innerHTML = '<p style="color: #aaa;">Affix data not available</p>';
			return;
		}

		const allAffixes = Object.keys(AFFIX_POOL).sort();
		const container = document.createElement('div');
		container.style.display = 'grid';
		container.style.gridTemplateColumns = 'repeat(auto-fill, minmax(250px, 1fr))';
		container.style.gap = '15px';

		// Use event delegation for better performance and reliability
		container.addEventListener('click', (e) => {
			const card = e.target.closest('[data-affix-type]');
			if (!card) return;
			
			const affixType = card.dataset.affixType;
			const affixData = AFFIX_POOL[affixType];
			selectedEntry = { type: 'affix', affixType, affixData };
			updatePreview(selectedEntry);
			// Update selection visual
			container.querySelectorAll('[data-affix-type]').forEach(el => {
				el.style.borderColor = '#444';
			});
			card.style.borderColor = '#9c27b0';
		});

		allAffixes.forEach(affixType => {
			const isDiscovered = discovered.includes(affixType);
			const affixData = AFFIX_POOL[affixType];
			const tier = affixData.tier || 'basic';

			const card = document.createElement('div');
			card.style.padding = '15px';
			card.style.borderRadius = '8px';
			card.style.border = '2px solid #444';
			card.style.backgroundColor = isDiscovered ? '#2a2a2a' : '#1a1a1a';
			card.style.opacity = isDiscovered ? '1' : '0.5';
			card.style.cursor = 'pointer';
			card.dataset.affixType = affixType;

			const name = document.createElement('div');
			name.style.fontSize = '16px';
			name.style.fontWeight = 'bold';
			name.style.color = isDiscovered ? '#fff' : '#666';
			name.style.marginBottom = '8px';
			name.textContent = isDiscovered ? formatAffixName(affixType) : '???';

			const tierBadge = document.createElement('div');
			tierBadge.style.fontSize = '12px';
			tierBadge.style.color = isDiscovered ? getTierColor(tier) : '#666';
			tierBadge.textContent = isDiscovered ? tier.toUpperCase() : '???';

			if (isDiscovered) {
				const slots = document.createElement('div');
				slots.style.fontSize = '12px';
				slots.style.color = '#aaa';
				slots.style.marginTop = '5px';
				slots.textContent = `Slots: ${affixData.slot.join(', ')}`;

				card.appendChild(slots);
			}

			card.appendChild(name);
			card.appendChild(tierBadge);
			container.appendChild(card);
		});

		body.appendChild(container);

		// Restore selection visual if entry is still selected
		if (selectedEntry && selectedEntry.type === 'affix' && selectedEntry.affixType) {
			const selectedCard = container.querySelector(`[data-affix-type="${selectedEntry.affixType}"]`);
			if (selectedCard) {
				selectedCard.style.borderColor = '#9c27b0';
			}
		}
	}

	function renderCards(discovered) {
		if (typeof window.CardCatalog === 'undefined' || !window.CardCatalog.getAll) {
			body.innerHTML = '<p style="color: #aaa;">Card catalog not available</p>';
			return;
		}

		const allCards = window.CardCatalog.getAll()
			.filter(card => card.category !== 'Room' && card.category !== 'Team' && card.category !== 'Curse')
			.sort((a, b) => (a.name || a.family || '').localeCompare(b.name || b.family || ''));

		const container = document.createElement('div');
		container.style.display = 'grid';
		container.style.gridTemplateColumns = 'repeat(auto-fill, minmax(250px, 1fr))';
		container.style.gap = '15px';

		// Use event delegation for better performance and reliability
		container.addEventListener('click', (e) => {
			const cardEl = e.target.closest('[data-card-id]');
			if (!cardEl) return;
			
			const cardId = cardEl.dataset.cardId;
			const card = allCards.find(c => c.id === cardId);
			if (!card) return;
			
			selectedEntry = { type: 'card', card };
			updatePreview(selectedEntry);
			// Update selection visual
			container.querySelectorAll('[data-card-id]').forEach(el => {
				el.style.borderColor = '#444';
			});
			cardEl.style.borderColor = '#9c27b0';
		});

		allCards.forEach(card => {
			const isDiscovered = discovered.includes(card.id);
			const cardName = card.name || card.family || card.id;

			const cardEl = document.createElement('div');
			cardEl.style.padding = '15px';
			cardEl.style.borderRadius = '8px';
			cardEl.style.border = '2px solid #444';
			cardEl.style.backgroundColor = isDiscovered ? '#2a2a2a' : '#1a1a1a';
			cardEl.style.opacity = isDiscovered ? '1' : '0.5';
			cardEl.style.cursor = 'pointer';
			cardEl.dataset.cardId = card.id;

			const name = document.createElement('div');
			name.style.fontSize = '16px';
			name.style.fontWeight = 'bold';
			name.style.color = isDiscovered ? '#fff' : '#666';
			name.style.marginBottom = '8px';
			name.textContent = isDiscovered ? cardName : '???';

			const category = document.createElement('div');
			category.style.fontSize = '12px';
			category.style.color = isDiscovered ? '#aaa' : '#666';
			category.textContent = isDiscovered ? card.category || 'Unknown' : '???';

			cardEl.appendChild(name);
			cardEl.appendChild(category);
			container.appendChild(cardEl);
		});

		body.appendChild(container);

		// Restore selection visual if entry is still selected
		if (selectedEntry && selectedEntry.type === 'card' && selectedEntry.card && selectedEntry.card.id) {
			const selectedCard = container.querySelector(`[data-card-id="${selectedEntry.card.id}"]`);
			if (selectedCard) {
				selectedCard.style.borderColor = '#9c27b0';
			}
		}
	}

	function renderUtilityCards(discovered) {
		if (typeof window.CardCatalog === 'undefined' || !window.CardCatalog.getAll) {
			body.innerHTML = '<p style="color: #aaa;">Card catalog not available</p>';
			return;
		}

		const allCards = window.CardCatalog.getAll()
			.filter(card => card.category === 'Room' || card.category === 'Team');

		// Group cards by family and merge quality bands
		const familyMap = new Map();
		
		allCards.forEach(card => {
			const family = card.family || card.name || card.id;
			if (!familyMap.has(family)) {
				// Create a merged card entry with all quality bands
				const mergedCard = {
					id: card.id, // Use first card's ID as base
					family: family,
					name: card.name || family,
					category: card.category,
					effectType: card.effectType,
					effectTarget: card.effectTarget,
					qualityBands: {},
					allIds: [] // Track all variant IDs for discovery checking
				};
				familyMap.set(family, mergedCard);
			}
			
			const merged = familyMap.get(family);
			merged.allIds.push(card.id);
			
			// Merge quality bands from this variant
			if (card.qualityBands) {
				Object.keys(card.qualityBands).forEach(quality => {
					if (!merged.qualityBands[quality]) {
						merged.qualityBands[quality] = card.qualityBands[quality];
					}
				});
			}
		});

		// Convert to array and sort
		const groupedCards = Array.from(familyMap.values())
			.sort((a, b) => (a.name || a.family || '').localeCompare(b.name || b.family || ''));

		const container = document.createElement('div');
		container.style.display = 'grid';
		container.style.gridTemplateColumns = 'repeat(auto-fill, minmax(250px, 1fr))';
		container.style.gap = '15px';

		// Use event delegation for better performance and reliability
		container.addEventListener('click', (e) => {
			const cardEl = e.target.closest('[data-utility-card-family]');
			if (!cardEl) return;
			
			const family = cardEl.dataset.utilityCardFamily;
			const card = groupedCards.find(c => c.family === family);
			if (!card) return;
			
			selectedEntry = { type: 'utilityCard', card };
			updatePreview(selectedEntry);
			// Update selection visual
			container.querySelectorAll('[data-utility-card-family]').forEach(el => {
				el.style.borderColor = '#444';
			});
			cardEl.style.borderColor = '#9c27b0';
		});

		groupedCards.forEach(card => {
			// Check if any variant of this family has been discovered
			const isDiscovered = card.allIds.some(id => discovered.includes(id));
			const cardName = card.name || card.family;

			const cardEl = document.createElement('div');
			cardEl.style.padding = '15px';
			cardEl.style.borderRadius = '8px';
			cardEl.style.border = '2px solid #444';
			cardEl.style.backgroundColor = isDiscovered ? '#2a2a2a' : '#1a1a1a';
			cardEl.style.opacity = isDiscovered ? '1' : '0.5';
			cardEl.style.cursor = 'pointer';
			cardEl.dataset.utilityCardFamily = card.family;

			const name = document.createElement('div');
			name.style.fontSize = '16px';
			name.style.fontWeight = 'bold';
			name.style.color = isDiscovered ? '#fff' : '#666';
			name.style.marginBottom = '8px';
			name.textContent = isDiscovered ? cardName : '???';

			const category = document.createElement('div');
			category.style.fontSize = '12px';
			category.style.color = isDiscovered ? '#aaa' : '#666';
			category.textContent = isDiscovered ? card.category || 'Unknown' : '???';

			// Show quality band indicators if discovered
			if (isDiscovered && card.qualityBands) {
				const qualityCount = Object.keys(card.qualityBands).length;
				if (qualityCount > 0) {
					const qualityBadge = document.createElement('div');
					qualityBadge.style.fontSize = '11px';
					qualityBadge.style.color = '#888';
					qualityBadge.style.marginTop = '5px';
					qualityBadge.textContent = `${qualityCount} quality variant${qualityCount !== 1 ? 's' : ''}`;
					cardEl.appendChild(qualityBadge);
				}
			}

			cardEl.appendChild(name);
			cardEl.appendChild(category);
			container.appendChild(cardEl);
		});

		body.appendChild(container);

		// Restore selection visual if entry is still selected
		if (selectedEntry && selectedEntry.type === 'utilityCard' && selectedEntry.card && selectedEntry.card.family) {
			const selectedCard = container.querySelector(`[data-utility-card-family="${selectedEntry.card.family}"]`);
			if (selectedCard) {
				selectedCard.style.borderColor = '#9c27b0';
			}
		}
	}

	function renderItems(discovered) {
		if (typeof ITEM_DEFINITIONS === 'undefined') {
			body.innerHTML = '<p style="color: #aaa;">Item data not available</p>';
			return;
		}

		const allItems = Object.values(ITEM_DEFINITIONS)
			.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

		const container = document.createElement('div');
		container.style.display = 'grid';
		container.style.gridTemplateColumns = 'repeat(auto-fill, minmax(250px, 1fr))';
		container.style.gap = '15px';

		// Use event delegation for better performance and reliability
		container.addEventListener('click', (e) => {
			const itemEl = e.target.closest('[data-item-id]');
			if (!itemEl) return;
			
			const itemId = itemEl.dataset.itemId;
			const item = allItems.find(i => i.id === itemId);
			if (!item) return;
			
			selectedEntry = { type: 'item', item };
			updatePreview(selectedEntry);
			// Update selection visual
			container.querySelectorAll('[data-item-id]').forEach(el => {
				el.style.borderColor = '#444';
			});
			itemEl.style.borderColor = '#9c27b0';
		});

		allItems.forEach(item => {
			const isDiscovered = discovered.includes(item.id);

			const itemEl = document.createElement('div');
			itemEl.style.padding = '15px';
			itemEl.style.borderRadius = '8px';
			itemEl.style.border = '2px solid #444';
			itemEl.style.backgroundColor = isDiscovered ? '#2a2a2a' : '#1a1a1a';
			itemEl.style.opacity = isDiscovered ? '1' : '0.5';
			itemEl.style.cursor = 'pointer';
			itemEl.dataset.itemId = item.id;

			const name = document.createElement('div');
			name.style.fontSize = '16px';
			name.style.fontWeight = 'bold';
			name.style.color = isDiscovered ? '#fff' : '#666';
			name.style.marginBottom = '8px';
			name.textContent = isDiscovered ? item.name : '???';

			if (isDiscovered) {
				const rarity = document.createElement('div');
				rarity.style.fontSize = '12px';
				rarity.style.color = getRarityColor(item.rarity);
				rarity.style.marginTop = '5px';
				rarity.textContent = item.rarity.toUpperCase();

				const category = document.createElement('div');
				category.style.fontSize = '12px';
				category.style.color = '#aaa';
				category.style.marginTop = '5px';
				category.textContent = item.category || 'Unknown';

				itemEl.appendChild(rarity);
				itemEl.appendChild(category);
			}

			itemEl.appendChild(name);
			container.appendChild(itemEl);
		});

		body.appendChild(container);

		// Restore selection visual if entry is still selected
		if (selectedEntry && selectedEntry.type === 'item' && selectedEntry.item && selectedEntry.item.id) {
			const selectedItem = container.querySelector(`[data-item-id="${selectedEntry.item.id}"]`);
			if (selectedItem) {
				selectedItem.style.borderColor = '#9c27b0';
			}
		}
	}

	function formatAffixName(affixType) {
		return affixType
			.replace(/([A-Z])/g, ' $1')
			.replace(/^./, str => str.toUpperCase())
			.trim();
	}

	function getTierColor(tier) {
		const colors = {
			basic: '#4caf50',
			advanced: '#2196f3',
			rare: '#ff9800'
		};
		return colors[tier] || '#aaa';
	}

	function getRarityColor(rarity) {
		const colors = {
			common: '#999999',
			uncommon: '#4caf50',
			rare: '#2196f3',
			epic: '#9c27b0'
		};
		return colors[rarity] || '#aaa';
	}

	function updatePreview(entry) {
		if (!previewSection) return;

		previewSection.innerHTML = '';

		if (!entry) {
			const placeholder = document.createElement('div');
			placeholder.style.color = '#666';
			placeholder.style.fontSize = '14px';
			placeholder.style.textAlign = 'center';
			placeholder.style.marginTop = '50%';
			placeholder.textContent = 'Select an entry to view details';
			previewSection.appendChild(placeholder);
			return;
		}

		const title = document.createElement('h3');
		title.style.color = '#fff';
		title.style.fontSize = '20px';
		title.style.marginTop = '0';
		title.style.marginBottom = '15px';
		title.style.borderBottom = '2px solid #444';
		title.style.paddingBottom = '10px';

		const content = document.createElement('div');
		content.style.color = '#aaa';
		content.style.fontSize = '14px';
		content.style.lineHeight = '1.6';

		if (entry.type === 'affix') {
			const isDiscovered = typeof SaveSystem !== 'undefined' && SaveSystem.hasDiscoveredAffix && SaveSystem.hasDiscoveredAffix(entry.affixType);
			title.textContent = isDiscovered ? formatAffixName(entry.affixType) : '???';
			
			if (isDiscovered) {
				const tier = entry.affixData.tier || 'basic';
				const tierEl = document.createElement('div');
				tierEl.style.color = getTierColor(tier);
				tierEl.style.marginBottom = '10px';
				tierEl.textContent = `Tier: ${tier.toUpperCase()}`;
				content.appendChild(tierEl);

				const slotsEl = document.createElement('div');
				slotsEl.style.marginBottom = '10px';
				slotsEl.textContent = `Compatible Slots: ${entry.affixData.slot.join(', ')}`;
				content.appendChild(slotsEl);

				const rangeEl = document.createElement('div');
				rangeEl.style.marginBottom = '10px';
				if (entry.affixData.min !== undefined && entry.affixData.max !== undefined) {
					rangeEl.textContent = `Value Range: ${entry.affixData.min} - ${entry.affixData.max}`;
				}
				content.appendChild(rangeEl);
			} else {
				content.textContent = 'This affix has not been discovered yet.';
			}
		} else if (entry.type === 'card' || entry.type === 'utilityCard') {
			const card = entry.card;
			let isDiscovered = false;
			if (entry.type === 'card') {
				isDiscovered = typeof SaveSystem !== 'undefined' && SaveSystem.hasDiscoveredCard && SaveSystem.hasDiscoveredCard(card.id);
			} else {
				// For utility cards, check if any variant has been discovered
				if (card.allIds && Array.isArray(card.allIds)) {
					isDiscovered = card.allIds.some(id => 
						typeof SaveSystem !== 'undefined' && SaveSystem.hasDiscoveredUtilityCard && SaveSystem.hasDiscoveredUtilityCard(id)
					);
				} else {
					isDiscovered = typeof SaveSystem !== 'undefined' && SaveSystem.hasDiscoveredUtilityCard && SaveSystem.hasDiscoveredUtilityCard(card.id);
				}
			}
			
			title.textContent = isDiscovered ? (card.name || card.family || card.id) : '???';
			
			if (isDiscovered) {
				const categoryEl = document.createElement('div');
				categoryEl.style.color = '#888';
				categoryEl.style.marginBottom = '10px';
				categoryEl.textContent = `Category: ${card.category || 'Unknown'}`;
				content.appendChild(categoryEl);

				// Show quality bands for cards (only reveal if seen)
				if (card.qualityBands && entry.type === 'card') {
					const qualityBandsTitle = document.createElement('div');
					qualityBandsTitle.style.color = '#fff';
					qualityBandsTitle.style.fontSize = '16px';
					qualityBandsTitle.style.marginTop = '20px';
					qualityBandsTitle.style.marginBottom = '10px';
					qualityBandsTitle.textContent = 'Quality Bands:';
					content.appendChild(qualityBandsTitle);

					const qualityOrder = ['white', 'green', 'blue', 'purple', 'orange'];
					const qualityNames = ['White', 'Green', 'Blue', 'Purple', 'Orange'];
					const qualityColors = {
						white: '#ffffff',
						green: '#4caf50',
						blue: '#2196f3',
						purple: '#9c27b0',
						orange: '#ff9800'
					};

					// Get mastery level for this card
					const masteryLevel = typeof SaveSystem !== 'undefined' && SaveSystem.getCardMastery 
						? SaveSystem.getCardMastery(card.id) 
						: 0;
					const hasMastery5 = masteryLevel >= 5;

					qualityOrder.forEach((quality, index) => {
						const band = card.qualityBands[quality];
						if (!band) return;

						// White is always visible if card is unlocked
						// Quality is visible if: seen OR (index <= masteryLevel)
						const hasSeen = typeof SaveSystem !== 'undefined' && SaveSystem.hasSeenCardQualityBand && SaveSystem.hasSeenCardQualityBand(card.id, quality);
						const isUnlockedByMastery = index <= masteryLevel;
						const shouldShow = quality === 'white' || hasSeen || isUnlockedByMastery;
						
						const bandEl = document.createElement('div');
						bandEl.style.marginBottom = '15px';
						bandEl.style.padding = '10px';
						bandEl.style.borderRadius = '4px';
						bandEl.style.border = `2px solid ${qualityColors[quality] || '#666'}`;
						bandEl.style.backgroundColor = shouldShow ? '#2a2a2a' : '#1a1a1a';
						bandEl.style.opacity = shouldShow ? '1' : '0.6';

						const qualityHeader = document.createElement('div');
						qualityHeader.style.color = qualityColors[quality] || '#aaa';
						qualityHeader.style.fontWeight = 'bold';
						qualityHeader.style.marginBottom = '5px';
						qualityHeader.textContent = qualityNames[index];
						if (isUnlockedByMastery && !hasSeen) {
							const masteryBadge = document.createElement('span');
							masteryBadge.style.fontSize = '10px';
							masteryBadge.style.color = '#ffd700';
							masteryBadge.style.marginLeft = '5px';
							masteryBadge.textContent = '(Mastery)';
							qualityHeader.appendChild(masteryBadge);
						}
						bandEl.appendChild(qualityHeader);

						if (shouldShow) {
							const descEl = document.createElement('div');
							descEl.style.color = '#aaa';
							descEl.style.marginBottom = '5px';
							descEl.textContent = band.description || 'No description';
							bandEl.appendChild(descEl);

							// Show M5 bonuses if they exist and mastery 5 is unlocked
							if (band.bonus && hasMastery5) {
								const m5Bonuses = [];
								if (band.bonus.mastery5ReviveHP !== undefined) {
									m5Bonuses.push(`Revive HP: ${(band.bonus.mastery5ReviveHP * 100).toFixed(0)}%`);
								}
								if (band.bonus.mastery5DamageBoost !== undefined) {
									m5Bonuses.push(`Damage Boost: +${(band.bonus.mastery5DamageBoost * 100).toFixed(0)}%`);
								}
								if (band.bonus.mastery5Duration !== undefined) {
									m5Bonuses.push(`Duration: ${band.bonus.mastery5Duration}s`);
								}
								
								if (m5Bonuses.length > 0) {
									const m5El = document.createElement('div');
									m5El.style.color = '#ffd700';
									m5El.style.fontSize = '12px';
									m5El.style.fontWeight = 'bold';
									m5El.style.marginTop = '8px';
									m5El.style.padding = '6px';
									m5El.style.backgroundColor = 'rgba(255, 215, 0, 0.1)';
									m5El.style.borderRadius = '4px';
									m5El.style.border = '1px solid rgba(255, 215, 0, 0.3)';
									m5El.innerHTML = `<div style="margin-bottom: 4px;">Mastery 5 Bonuses:</div>${m5Bonuses.map(b => `<div style="margin-left: 8px;">• ${b}</div>`).join('')}`;
									bandEl.appendChild(m5El);
								}
							}

							if (band.flavorText) {
								const flavorEl = document.createElement('div');
								flavorEl.style.color = '#666';
								flavorEl.style.fontStyle = 'italic';
								flavorEl.style.fontSize = '12px';
								flavorEl.style.marginTop = '5px';
								flavorEl.textContent = `"${band.flavorText}"`;
								bandEl.appendChild(flavorEl);
							}

							if (band.value !== undefined) {
								const valueEl = document.createElement('div');
								valueEl.style.color = '#888';
								valueEl.style.fontSize = '12px';
								valueEl.style.marginTop = '5px';
								valueEl.textContent = `Value: ${band.value}`;
								bandEl.appendChild(valueEl);
							}
						} else {
							const lockedEl = document.createElement('div');
							lockedEl.style.color = '#666';
							lockedEl.textContent = '???';
							bandEl.appendChild(lockedEl);
						}

						content.appendChild(bandEl);
					});
				} else if (card.qualityBands && entry.type === 'utilityCard') {
					// For utility cards, show all quality bands similar to regular cards
					const qualityBandsTitle = document.createElement('div');
					qualityBandsTitle.style.color = '#fff';
					qualityBandsTitle.style.fontSize = '16px';
					qualityBandsTitle.style.marginTop = '20px';
					qualityBandsTitle.style.marginBottom = '10px';
					qualityBandsTitle.textContent = 'Quality Variants:';
					content.appendChild(qualityBandsTitle);

					const qualityOrder = ['white', 'green', 'blue', 'purple', 'orange'];
					const qualityNames = ['White', 'Green', 'Blue', 'Purple', 'Orange'];
					const qualityColors = {
						white: '#ffffff',
						green: '#4caf50',
						blue: '#2196f3',
						purple: '#9c27b0',
						orange: '#ff9800'
					};

					// Check which variants have been discovered
					const discoveredVariants = card.allIds ? card.allIds.filter(id => 
						typeof SaveSystem !== 'undefined' && SaveSystem.hasDiscoveredUtilityCard && SaveSystem.hasDiscoveredUtilityCard(id)
					) : [];

					qualityOrder.forEach((quality, index) => {
						const band = card.qualityBands[quality];
						if (!band) return;

						// Check if this quality variant has been discovered
						// Find the ID that corresponds to this quality
						// Map quality names to possible ID suffixes
						const qualitySuffixes = {
							white: ['white'],
							green: ['green', 'uncommon'],
							blue: ['blue', 'rare'],
							purple: ['purple', 'epic'],
							orange: ['orange']
						};
						
						// Helper to extract quality from ID
						function extractQualityFromId(id) {
							if (!id) return null;
							const parts = String(id).split('_');
							const lastPart = parts[parts.length - 1];
							// Map suffixes to quality
							if (lastPart === 'white') return 'white';
							if (lastPart === 'green' || lastPart === 'uncommon') return 'green';
							if (lastPart === 'blue' || lastPart === 'rare') return 'blue';
							if (lastPart === 'purple' || lastPart === 'epic') return 'purple';
							if (lastPart === 'orange') return 'orange';
							return null;
						}
						
						const qualityVariantId = card.allIds ? card.allIds.find(id => {
							const extractedQuality = extractQualityFromId(id);
							return extractedQuality === quality;
						}) : null;
						
						const hasDiscoveredVariant = qualityVariantId && discoveredVariants.includes(qualityVariantId);
						
						const bandEl = document.createElement('div');
						bandEl.style.marginBottom = '15px';
						bandEl.style.padding = '10px';
						bandEl.style.borderRadius = '4px';
						bandEl.style.border = `2px solid ${qualityColors[quality] || '#666'}`;
						bandEl.style.backgroundColor = hasDiscoveredVariant ? '#2a2a2a' : '#1a1a1a';
						bandEl.style.opacity = hasDiscoveredVariant ? '1' : '0.6';

						const qualityHeader = document.createElement('div');
						qualityHeader.style.color = qualityColors[quality] || '#aaa';
						qualityHeader.style.fontWeight = 'bold';
						qualityHeader.style.marginBottom = '5px';
						qualityHeader.textContent = qualityNames[index];
						bandEl.appendChild(qualityHeader);

						if (hasDiscoveredVariant) {
							if (band.description) {
								const descEl = document.createElement('div');
								descEl.style.color = '#aaa';
								descEl.style.marginBottom = '5px';
								descEl.textContent = band.description;
								bandEl.appendChild(descEl);
							}

							if (band.flavorText) {
								const flavorEl = document.createElement('div');
								flavorEl.style.color = '#666';
								flavorEl.style.fontStyle = 'italic';
								flavorEl.style.fontSize = '12px';
								flavorEl.textContent = `"${band.flavorText}"`;
								bandEl.appendChild(flavorEl);
							}

							if (band.value !== undefined) {
								const valueEl = document.createElement('div');
								valueEl.style.color = '#888';
								valueEl.style.fontSize = '12px';
								valueEl.style.marginTop = '5px';
								valueEl.textContent = `Value: ${band.value}`;
								bandEl.appendChild(valueEl);
							}
						} else {
							const lockedEl = document.createElement('div');
							lockedEl.style.color = '#666';
							lockedEl.textContent = '???';
							bandEl.appendChild(lockedEl);
						}

						content.appendChild(bandEl);
					});
				}
			} else {
				content.textContent = 'This card has not been discovered yet.';
			}
		} else if (entry.type === 'item') {
			const isDiscovered = typeof SaveSystem !== 'undefined' && SaveSystem.hasDiscoveredItem && SaveSystem.hasDiscoveredItem(entry.item.id);
			title.textContent = isDiscovered ? entry.item.name : '???';
			
			if (isDiscovered) {
				const rarityEl = document.createElement('div');
				rarityEl.style.color = getRarityColor(entry.item.rarity);
				rarityEl.style.marginBottom = '10px';
				rarityEl.textContent = `Rarity: ${entry.item.rarity.toUpperCase()}`;
				content.appendChild(rarityEl);

				const categoryEl = document.createElement('div');
				categoryEl.style.marginBottom = '10px';
				categoryEl.textContent = `Category: ${entry.item.category || 'Unknown'}`;
				content.appendChild(categoryEl);

				if (entry.item.description) {
					const descEl = document.createElement('div');
					descEl.style.marginTop = '15px';
					descEl.style.padding = '10px';
					descEl.style.backgroundColor = '#2a2a2a';
					descEl.style.borderRadius = '4px';
					
					// Replace template values with actual base values
					let description = entry.item.description;
					const item = entry.item;
					
					// Replace template values in order (more specific first to avoid conflicts)
					// Note: {damage} appears in multiple contexts, so we need to be careful
					if (item.baseMaxThreshold !== undefined) {
						description = description.replace(/\{maxThreshold\}/g, item.baseMaxThreshold);
					}
					if (item.baseThreshold !== undefined) {
						description = description.replace(/\{threshold\}/g, item.baseThreshold);
					}
					if (item.baseSlowPercent !== undefined) {
						description = description.replace(/\{slow\}/g, item.baseSlowPercent);
					}
					if (item.baseCritChance !== undefined) {
						description = description.replace(/\{critChance\}/g, item.baseCritChance);
					}
					if (item.baseCritDamage !== undefined) {
						description = description.replace(/\{critDamage\}/g, item.baseCritDamage);
					}
					if (item.baseAttackSpeed !== undefined) {
						description = description.replace(/\{attackSpeed\}/g, item.baseAttackSpeed);
					}
					if (item.baseChance !== undefined) {
						description = description.replace(/\{chance\}/g, item.baseChance);
					}
					if (item.basePierceDamagePercent !== undefined) {
						description = description.replace(/\{damage\}% damage to second target/g, `${item.basePierceDamagePercent}% damage to second target`);
					}
					if (item.baseDamagePercent !== undefined) {
						description = description.replace(/\{damage\}/g, item.baseDamagePercent);
					}
					if (item.baseRadius !== undefined) {
						description = description.replace(/\{radius\}/g, item.baseRadius);
					}
					if (item.baseValue !== undefined) {
						description = description.replace(/\{value\}/g, item.baseValue);
					}
					if (item.baseDuration !== undefined) {
						description = description.replace(/\{duration\}/g, item.baseDuration);
					}
					if (item.basePierceCount !== undefined) {
						description = description.replace(/\{count\}/g, item.basePierceCount);
					}
					if (item.maxStacks !== undefined && item.maxStacks !== null) {
						description = description.replace(/\{maxStacks\}/g, item.maxStacks);
					}
					
					descEl.textContent = description;
					content.appendChild(descEl);
				}

				// Show stacking information with scaling examples
				if (entry.item.stackingType) {
					const stackEl = document.createElement('div');
					stackEl.style.marginTop = '15px';
					stackEl.style.padding = '10px';
					stackEl.style.backgroundColor = '#2a2a2a';
					stackEl.style.borderRadius = '4px';
					
					const stackTitle = document.createElement('div');
					stackTitle.style.color = '#fff';
					stackTitle.style.fontWeight = 'bold';
					stackTitle.style.marginBottom = '8px';
					stackTitle.textContent = 'Stacking Behavior:';
					stackEl.appendChild(stackTitle);
					
					const stackType = entry.item.stackingType;
					const stackTypeText = stackType === 'logarithmic' ? 'Logarithmic (diminishing returns)' :
					                     stackType === 'additive' ? 'Additive (linear)' :
					                     stackType === 'additive_cap' ? 'Additive with cap' :
					                     stackType === 'multiplicative' ? 'Multiplicative' :
					                     stackType;
					
					const typeEl = document.createElement('div');
					typeEl.style.color = '#aaa';
					typeEl.style.marginBottom = '8px';
					typeEl.textContent = `Type: ${stackTypeText}`;
					stackEl.appendChild(typeEl);
					
					// Show scaling examples for logarithmic items
					// Check if logarithmicScale is available (from item-definitions.js)
					// It's defined as a global function, so check both window and global scope
					const logScaleFn = typeof logarithmicScale === 'function' ? logarithmicScale : 
					                   (typeof window !== 'undefined' && typeof window.logarithmicScale === 'function') ? window.logarithmicScale : null;
					if (stackType === 'logarithmic' && logScaleFn) {
						const examplesEl = document.createElement('div');
						examplesEl.style.marginTop = '10px';
						examplesEl.style.padding = '8px';
						examplesEl.style.backgroundColor = '#1a1a1a';
						examplesEl.style.borderRadius = '4px';
						
						const examplesTitle = document.createElement('div');
						examplesTitle.style.color = '#888';
						examplesTitle.style.fontSize = '12px';
						examplesTitle.style.marginBottom = '5px';
						examplesTitle.textContent = 'Scaling Examples (per stack):';
						examplesEl.appendChild(examplesTitle);
						
						// Show examples for different properties
						const exampleStacks = [1, 2, 4, 8];
						const item = entry.item;
						
						if (item.baseValue !== undefined) {
							const valueExamples = exampleStacks.map(stacks => {
								const value = logScaleFn(item.baseValue, stacks);
								return `${stacks}x: ${value.toFixed(1)}`;
							}).join(' | ');
							const valueEl = document.createElement('div');
							valueEl.style.color = '#aaa';
							valueEl.style.fontSize = '11px';
							valueEl.textContent = `Value: ${valueExamples}`;
							examplesEl.appendChild(valueEl);
						}
						
						if (item.baseSlowPercent !== undefined) {
							const slowExamples = exampleStacks.map(stacks => {
								const slow = Math.min(100, logScaleFn(item.baseSlowPercent, stacks));
								return `${stacks}x: ${slow.toFixed(1)}%`;
							}).join(' | ');
							const slowEl = document.createElement('div');
							slowEl.style.color = '#aaa';
							slowEl.style.fontSize = '11px';
							slowEl.textContent = `Slow: ${slowExamples}`;
							examplesEl.appendChild(slowEl);
						}
						
						if (item.baseDamagePercent !== undefined) {
							const damageExamples = exampleStacks.map(stacks => {
								const damage = logScaleFn(item.baseDamagePercent, stacks);
								return `${stacks}x: ${damage.toFixed(1)}%`;
							}).join(' | ');
							const damageEl = document.createElement('div');
							damageEl.style.color = '#aaa';
							damageEl.style.fontSize = '11px';
							damageEl.textContent = `Damage: ${damageExamples}`;
							examplesEl.appendChild(damageEl);
						}
						
						if (item.baseCritChance !== undefined) {
							const critChanceExamples = exampleStacks.map(stacks => {
								const crit = logScaleFn(item.baseCritChance, stacks);
								return `${stacks}x: ${crit.toFixed(1)}%`;
							}).join(' | ');
							const critEl = document.createElement('div');
							critEl.style.color = '#aaa';
							critEl.style.fontSize = '11px';
							critEl.textContent = `Crit Chance: ${critChanceExamples}`;
							examplesEl.appendChild(critEl);
						}
						
						if (item.baseCritDamage !== undefined) {
							const critDamageExamples = exampleStacks.map(stacks => {
								const crit = logScaleFn(item.baseCritDamage, stacks);
								return `${stacks}x: ${crit.toFixed(1)}%`;
							}).join(' | ');
							const critEl = document.createElement('div');
							critEl.style.color = '#aaa';
							critEl.style.fontSize = '11px';
							critEl.textContent = `Crit Damage: ${critDamageExamples}`;
							examplesEl.appendChild(critEl);
						}
						
						if (item.baseChance !== undefined) {
							const chanceExamples = exampleStacks.map(stacks => {
								const chance = Math.min(100, logScaleFn(item.baseChance, stacks));
								return `${stacks}x: ${chance.toFixed(1)}%`;
							}).join(' | ');
							const chanceEl = document.createElement('div');
							chanceEl.style.color = '#aaa';
							chanceEl.style.fontSize = '11px';
							chanceEl.textContent = `Chance: ${chanceExamples}`;
							examplesEl.appendChild(chanceEl);
						}
						
						// Show linear properties if they exist alongside logarithmic ones
						if (item.baseRadius !== undefined && item.stackingType === 'logarithmic') {
							// Determine radius increment based on item type
							let radiusIncrement = 5; // Default
							if (item.id === 'slow_aura') {
								radiusIncrement = 10; // +10px per stack for slow aura
							} else if (item.id === 'damage_aura') {
								radiusIncrement = 5; // +5px per stack for damage aura
							} else if (item.id === 'chain_reaction') {
								radiusIncrement = 5; // +5px per stack for chain reaction
							} else if (item.id === 'volatile_core') {
								radiusIncrement = 5; // +5px per stack for volatile core
							}
							
							const radiusExamples = exampleStacks.map(stacks => {
								const radius = item.baseRadius + (stacks - 1) * radiusIncrement;
								return `${stacks}x: ${radius}px`;
							}).join(' | ');
							const radiusEl = document.createElement('div');
							radiusEl.style.color = '#888';
							radiusEl.style.fontSize = '11px';
							radiusEl.style.fontStyle = 'italic';
							radiusEl.textContent = `Radius (linear): ${radiusExamples}`;
							examplesEl.appendChild(radiusEl);
						}
						
						if (examplesEl.children.length > 1) { // More than just the title
							stackEl.appendChild(examplesEl);
						}
					}
					
					content.appendChild(stackEl);
				}
			} else {
				content.textContent = 'This item has not been discovered yet.';
			}
		}

		previewSection.appendChild(title);
		previewSection.appendChild(content);
	}

	function isVisible() {
		return window.USE_DOM_UI && typeof Game !== 'undefined' && !!Game.showingIndexMachine;
	}

	function toggle(show) {
		if (show === undefined) {
			show = !open;
		}
		open = show;

		if (!layer) {
			createIndexMachine();
		}

		if (typeof Game !== 'undefined') {
			Game.showingIndexMachine = show;
		}

		if (layer) {
			layer.style.display = show ? 'block' : 'none';
			if (show) {
				refresh();
				switchTab(currentTab); // Update tab button styles
			}
		}
	}

	// Auto-refresh when visible
	setInterval(() => {
		if (isVisible() && open) {
			refresh();
		}
	}, 1000);

	window.UIIndexMachine = {
		open: () => toggle(true),
		close: () => toggle(false),
		toggle: () => toggle(),
		isOpen: () => open
	};
})();

