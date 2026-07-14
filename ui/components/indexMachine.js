(function () {
	let layer, modal, body, previewSection;
	let open = false;
	let currentTab = 'affixes'; // 'affixes', 'items'
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
		
		// Add mobile scaling styles
		if (!document.getElementById('index-machine-mobile-styles')) {
			const style = document.createElement('style');
			style.id = 'index-machine-mobile-styles';
			style.textContent = `
				@media (min-aspect-ratio: 2/1) and (max-width: 1024px) {
					.modal.index-machine {
						width: min(90vw, 1200px) !important;
						max-height: 90vh !important;
					}
					.modal.index-machine .modal__header {
						padding: 12px 16px !important;
					}
					.modal.index-machine .modal__header h2 {
						font-size: 18px !important;
					}
					.modal.index-machine .modal__header .btn {
						padding: 6px 12px !important;
						font-size: 16px !important;
					}
					.modal.index-machine > div[style*="display: flex"][style*="gap: 10px"] {
						padding: 8px 12px !important;
						gap: 8px !important;
					}
					.modal.index-machine > div[style*="display: flex"][style*="gap: 10px"] .btn {
						padding: 8px 12px !important;
						font-size: 12px !important;
					}
					.modal.index-machine .modal__body {
						padding: 12px 16px !important;
						font-size: 0.9em !important;
					}
					.modal.index-machine .index-preview {
						width: 300px !important;
						padding: 12px 16px !important;
					}
					.modal.index-machine .index-preview h3 {
						font-size: 18px !important;
						margin-bottom: 12px !important;
					}
					.modal.index-machine .index-preview > div {
						font-size: 13px !important;
					}
					.modal.index-machine [style*="grid-template-columns: repeat(auto-fill, minmax(250px"] {
						grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)) !important;
						gap: 12px !important;
					}
					.modal.index-machine [style*="padding: 15px"][style*="borderRadius: 8px"] {
						padding: 12px !important;
					}
					.modal.index-machine [style*="fontSize: 16px"][style*="fontWeight: bold"] {
						font-size: 14px !important;
					}
					.modal.index-machine [style*="fontSize: 12px"] {
						font-size: 11px !important;
					}
				}
			`;
			document.head.appendChild(style);
		}

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
			if (typeof isFormFieldTarget === 'function' && isFormFieldTarget(target)) {
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

		const discoveries = SaveSystem.getDiscoveries();

		if (currentTab === 'affixes') {
			renderAffixes(discoveries.affixes || []);
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

