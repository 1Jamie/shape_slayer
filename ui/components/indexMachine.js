(function () {
	let layer, modal, body, previewSection;
	let open = false;
	let currentTab = 'affixes'; // 'affixes', 'eliteAffixes', 'enemies', 'items', 'weapons', 'combatLedger'
	let currentLedgerSubtab = 'global'; // 'global' | 'warrior' | 'rogue' | 'tank' | 'mage'
	let selectedEntry = null; // Currently selected entry for preview
	let previewAnimId = null;
	let previewAnimCanvas = null;
	let previewAnimKind = null; // 'eliteAffix' | 'enemy'
	let previewAnimKey = null;

	function stopPreviewAnimation() {
		if (previewAnimId != null) {
			cancelAnimationFrame(previewAnimId);
			previewAnimId = null;
		}
		previewAnimCanvas = null;
		previewAnimKind = null;
		previewAnimKey = null;
	}

	function startPreviewAnimation(canvas, kind, key) {
		stopPreviewAnimation();
		if (!canvas) return;
		previewAnimCanvas = canvas;
		previewAnimKind = kind;
		previewAnimKey = key;

		function tick() {
			if (!open || !previewAnimCanvas || previewAnimCanvas !== canvas) return;
			const t = Date.now() / 1000;
			if (kind === 'eliteAffix' && typeof EliteEnemyAffixes !== 'undefined' && EliteEnemyAffixes.paintEliteAffixPreview) {
				EliteEnemyAffixes.paintEliteAffixPreview(canvas, key, t);
			} else if (kind === 'enemy' && typeof EnemyIndexCatalog !== 'undefined' && EnemyIndexCatalog.paintEnemyPreview) {
				EnemyIndexCatalog.paintEnemyPreview(canvas, key, t);
			}
			previewAnimId = requestAnimationFrame(tick);
		}
		previewAnimId = requestAnimationFrame(tick);
	}

	function appendIndexVisual(parent, canvas) {
		if (!parent || !canvas) return;
		const wrap = document.createElement('div');
		wrap.style.display = 'flex';
		wrap.style.justifyContent = 'center';
		wrap.style.marginBottom = '10px';
		wrap.appendChild(canvas);
		parent.appendChild(wrap);
	}

	/** Mark catalog/ledger cards as controller-navigable (divs with click handlers). */
	function makeFocusableCard(el, label) {
		if (!el) return el;
		el.setAttribute('role', 'button');
		el.tabIndex = 0;
		if (label) el.setAttribute('aria-label', label);
		el.addEventListener('keydown', (e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				el.click();
			}
		});
		return el;
	}
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
		tabContainer.style.flexWrap = 'wrap';
		tabContainer.style.gap = '10px';
		tabContainer.style.padding = '10px 20px';
		tabContainer.style.borderBottom = '1px solid #333';
		tabContainer.style.backgroundColor = '#1a1a1a';

		const tabs = [
			{ key: 'affixes', label: 'Gear Affixes', icon: '⚔' },
			{ key: 'eliteAffixes', label: 'Elite Affixes', icon: '💀' },
			{ key: 'enemies', label: 'Enemies', icon: '⬡' },
			{ key: 'items', label: 'Items', icon: '📦' },
			{ key: 'weapons', label: 'Weapons', icon: '🗡️' },
			{ key: 'combatLedger', label: 'Combat Ledger & Feats', icon: '📜' }
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
		stopPreviewAnimation();
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
		} else if (currentTab === 'eliteAffixes') {
			renderEliteAffixes(discoveries.eliteAffixes || []);
		} else if (currentTab === 'enemies') {
			renderEnemies(discoveries.enemies || [], discoveries.biomes || []);
		} else if (currentTab === 'items') {
			renderItems(discoveries.items || []);
		} else if (currentTab === 'weapons') {
			renderWeaponTypes();
		} else if (currentTab === 'combatLedger') {
			renderCombatLedger();
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
			makeFocusableCard(card, isDiscovered ? formatAffixName(affixType) : 'Unknown affix');

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
			makeFocusableCard(itemEl, isDiscovered ? (item.name || 'Item') : 'Unknown item');

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

	function renderWeaponTypes() {
		if (typeof WEAPON_TYPES === 'undefined') {
			body.innerHTML = '<p style="color: #aaa;">Weapon type data not available</p>';
			return;
		}

		const intro = document.createElement('p');
		intro.style.color = '#888';
		intro.style.fontSize = '13px';
		intro.style.margin = '0 0 16px 0';
		intro.style.lineHeight = '1.5';
		intro.textContent = 'Every weapon rolls one type. Types change feel (timing, reach, twin strikes) and gently bias which affixes show up - equal-value tradeoffs, not strict power tiers.';
		body.appendChild(intro);

		const order = ['fast', 'heavy', 'reach', 'dual'];
		const container = document.createElement('div');
		container.style.display = 'grid';
		container.style.gridTemplateColumns = 'repeat(auto-fill, minmax(250px, 1fr))';
		container.style.gap = '15px';

		container.addEventListener('click', (e) => {
			const card = e.target.closest('[data-weapon-type]');
			if (!card) return;
			const weaponTypeKey = card.dataset.weaponType;
			const weaponData = WEAPON_TYPES[weaponTypeKey];
			if (!weaponData) return;
			selectedEntry = { type: 'weapon', weaponTypeKey, weaponData };
			updatePreview(selectedEntry);
			container.querySelectorAll('[data-weapon-type]').forEach(el => {
				el.style.borderColor = '#444';
			});
			card.style.borderColor = weaponData.color || '#9c27b0';
		});

		order.forEach(key => {
			const weaponData = WEAPON_TYPES[key];
			if (!weaponData) return;

			const card = document.createElement('div');
			card.style.padding = '15px';
			card.style.borderRadius = '8px';
			card.style.border = `2px solid ${weaponData.color || '#444'}`;
			card.style.backgroundColor = '#2a2a2a';
			card.style.cursor = 'pointer';
			card.dataset.weaponType = key;
			makeFocusableCard(card, weaponData.name || key);

			const name = document.createElement('div');
			name.style.fontSize = '16px';
			name.style.fontWeight = 'bold';
			name.style.color = weaponData.color || '#fff';
			name.style.marginBottom = '8px';
			name.textContent = weaponData.name;

			const blurb = document.createElement('div');
			blurb.style.fontSize = '12px';
			blurb.style.color = '#aaa';
			blurb.textContent = weaponData.pickupBlurb || weaponData.accentHint || '';

			card.appendChild(name);
			card.appendChild(blurb);
			container.appendChild(card);
		});

		body.appendChild(container);

		if (selectedEntry && selectedEntry.type === 'weapon' && selectedEntry.weaponTypeKey) {
			const selectedCard = container.querySelector(`[data-weapon-type="${selectedEntry.weaponTypeKey}"]`);
			if (selectedCard) {
				selectedCard.style.borderColor = selectedEntry.weaponData.color || '#9c27b0';
			}
		}
	}

	function renderEliteAffixes(discovered) {
		if (typeof EliteEnemyAffixes === 'undefined' || !EliteEnemyAffixes.index) {
			body.innerHTML = '<p style="color: #aaa;">Elite affix data not available</p>';
			return;
		}
		discovered = Array.isArray(discovered) ? discovered : [];

		const intro = document.createElement('p');
		intro.style.color = '#888';
		intro.style.fontSize = '13px';
		intro.style.margin = '0 0 16px 0';
		intro.style.lineHeight = '1.5';
		intro.textContent = 'Mid/late rooms can roll elites with exactly one threat affix (jagged ring). Entries unlock the first time you see that threat in a run.';
		body.appendChild(intro);

		const order = EliteEnemyAffixes.indexOrder || Object.keys(EliteEnemyAffixes.index);
		const container = document.createElement('div');
		container.style.display = 'grid';
		container.style.gridTemplateColumns = 'repeat(auto-fill, minmax(250px, 1fr))';
		container.style.gap = '15px';

		container.addEventListener('click', (e) => {
			const card = e.target.closest('[data-elite-affix]');
			if (!card) return;
			const affixKey = card.dataset.eliteAffix;
			const affixData = EliteEnemyAffixes.index[affixKey];
			if (!affixData) return;
			selectedEntry = { type: 'eliteAffix', affixKey, affixData };
			updatePreview(selectedEntry);
			container.querySelectorAll('[data-elite-affix]').forEach(el => {
				el.style.borderColor = '#444';
			});
			card.style.borderColor = discovered.includes(affixKey) ? '#ff9800' : '#666';
		});

		order.forEach(key => {
			const affixData = EliteEnemyAffixes.index[key];
			if (!affixData) return;
			const isDiscovered = discovered.includes(key);

			const card = document.createElement('div');
			card.style.padding = '15px';
			card.style.borderRadius = '8px';
			card.style.border = '2px solid #444';
			card.style.backgroundColor = isDiscovered ? '#2a2a2a' : '#1a1a1a';
			card.style.opacity = isDiscovered ? '1' : '0.55';
			card.style.cursor = 'pointer';
			card.dataset.eliteAffix = key;
			makeFocusableCard(card, isDiscovered ? (affixData.name || key) : 'Unknown elite threat');

			if (isDiscovered && typeof EliteEnemyAffixes.createEliteAffixPreviewCanvas === 'function') {
				const thumb = EliteEnemyAffixes.createEliteAffixPreviewCanvas(key, 88, 88);
				thumb.style.margin = '0 auto 10px auto';
				thumb.style.pointerEvents = 'none';
				card.appendChild(thumb);
			} else {
				const locked = document.createElement('div');
				locked.style.width = '88px';
				locked.style.height = '88px';
				locked.style.margin = '0 auto 10px auto';
				locked.style.borderRadius = '8px';
				locked.style.background = '#0e0e12';
				locked.style.display = 'flex';
				locked.style.alignItems = 'center';
				locked.style.justifyContent = 'center';
				locked.style.color = '#555';
				locked.style.fontSize = '28px';
				locked.textContent = '?';
				card.appendChild(locked);
			}

			const name = document.createElement('div');
			name.style.fontSize = '16px';
			name.style.fontWeight = 'bold';
			name.style.color = isDiscovered ? '#ff9800' : '#666';
			name.style.marginBottom = '8px';
			name.style.textAlign = 'center';
			name.textContent = isDiscovered ? affixData.name : '???';

			const blurb = document.createElement('div');
			blurb.style.fontSize = '12px';
			blurb.style.color = isDiscovered ? '#aaa' : '#555';
			blurb.style.textAlign = 'center';
			blurb.textContent = isDiscovered ? (affixData.blurb || '') : 'Not yet encountered';

			card.appendChild(name);
			card.appendChild(blurb);
			container.appendChild(card);
		});

		body.appendChild(container);

		if (selectedEntry && selectedEntry.type === 'eliteAffix' && selectedEntry.affixKey) {
			const selectedCard = container.querySelector(`[data-elite-affix="${selectedEntry.affixKey}"]`);
			if (selectedCard) {
				selectedCard.style.borderColor = discovered.includes(selectedEntry.affixKey) ? '#ff9800' : '#666';
			}
		}
	}

	function renderEnemies(discoveredEnemies, discoveredBiomes) {
		if (typeof EnemyIndexCatalog === 'undefined' || !EnemyIndexCatalog.enemies) {
			body.innerHTML = '<p style="color: #aaa;">Enemy catalog not available</p>';
			return;
		}
		discoveredEnemies = Array.isArray(discoveredEnemies) ? discoveredEnemies : [];
		discoveredBiomes = Array.isArray(discoveredBiomes) ? discoveredBiomes : [];

		const intro = document.createElement('p');
		intro.style.color = '#888';
		intro.style.fontSize = '13px';
		intro.style.margin = '0 0 12px 0';
		intro.style.lineHeight = '1.5';
		intro.textContent = 'Five base shapes remixed by biome. Entries unlock the first time you see that shape (or biome) in a run.';
		body.appendChild(intro);

		if (EnemyIndexCatalog.biomes) {
			const biomeRow = document.createElement('div');
			biomeRow.style.display = 'flex';
			biomeRow.style.flexWrap = 'wrap';
			biomeRow.style.gap = '8px';
			biomeRow.style.marginBottom = '16px';
			(EnemyIndexCatalog.biomeOrder || Object.keys(EnemyIndexCatalog.biomes)).forEach(id => {
				const b = EnemyIndexCatalog.biomes[id];
				if (!b) return;
				const isDiscovered = discoveredBiomes.includes(id);
				const chip = document.createElement('div');
				chip.style.padding = '6px 10px';
				chip.style.borderRadius = '6px';
				chip.style.border = `1px solid ${isDiscovered ? (b.color || '#555') : '#444'}`;
				chip.style.fontSize = '11px';
				chip.style.color = isDiscovered ? '#ccc' : '#555';
				chip.style.cursor = 'pointer';
				chip.style.opacity = isDiscovered ? '1' : '0.55';
				chip.textContent = isDiscovered ? b.name : '???';
				chip.title = isDiscovered ? (b.blurb || '') : 'Not yet encountered';
				makeFocusableCard(chip, isDiscovered ? (b.name || id) : 'Unknown biome');
				chip.addEventListener('click', () => {
					selectedEntry = { type: 'biome', biomeId: id, biomeData: b };
					updatePreview(selectedEntry);
				});
				biomeRow.appendChild(chip);
			});
			body.appendChild(biomeRow);
		}

		const container = document.createElement('div');
		container.style.display = 'grid';
		container.style.gridTemplateColumns = 'repeat(auto-fill, minmax(250px, 1fr))';
		container.style.gap = '15px';

		container.addEventListener('click', (e) => {
			const card = e.target.closest('[data-enemy-id]');
			if (!card) return;
			const enemyId = card.dataset.enemyId;
			const enemyData = EnemyIndexCatalog.enemies[enemyId];
			if (!enemyData) return;
			selectedEntry = { type: 'enemy', enemyId, enemyData };
			updatePreview(selectedEntry);
			container.querySelectorAll('[data-enemy-id]').forEach(el => {
				el.style.borderColor = '#444';
			});
			const unlocked = discoveredEnemies.includes(enemyId);
			card.style.borderColor = unlocked ? (enemyData.color || '#9c27b0') : '#666';
		});

		(EnemyIndexCatalog.enemyOrder || Object.keys(EnemyIndexCatalog.enemies)).forEach(id => {
			const enemyData = EnemyIndexCatalog.enemies[id];
			if (!enemyData) return;
			const isDiscovered = discoveredEnemies.includes(id);

			const card = document.createElement('div');
			card.style.padding = '15px';
			card.style.borderRadius = '8px';
			card.style.border = `2px solid ${isDiscovered ? (enemyData.color || '#444') : '#444'}`;
			card.style.backgroundColor = isDiscovered ? '#2a2a2a' : '#1a1a1a';
			card.style.opacity = isDiscovered ? '1' : '0.55';
			card.style.cursor = 'pointer';
			card.dataset.enemyId = id;
			makeFocusableCard(card, isDiscovered ? (enemyData.name || id) : 'Unknown enemy');

			if (isDiscovered && typeof EnemyIndexCatalog.createEnemyPreviewCanvas === 'function') {
				const thumb = EnemyIndexCatalog.createEnemyPreviewCanvas(id, 88, 88);
				thumb.style.margin = '0 auto 10px auto';
				thumb.style.pointerEvents = 'none';
				card.appendChild(thumb);
			} else {
				const locked = document.createElement('div');
				locked.style.width = '88px';
				locked.style.height = '88px';
				locked.style.margin = '0 auto 10px auto';
				locked.style.borderRadius = '8px';
				locked.style.background = '#0e0e12';
				locked.style.display = 'flex';
				locked.style.alignItems = 'center';
				locked.style.justifyContent = 'center';
				locked.style.color = '#555';
				locked.style.fontSize = '28px';
				locked.textContent = '?';
				card.appendChild(locked);
			}

			const name = document.createElement('div');
			name.style.fontSize = '16px';
			name.style.fontWeight = 'bold';
			name.style.color = isDiscovered ? (enemyData.color || '#fff') : '#666';
			name.style.marginBottom = '4px';
			name.style.textAlign = 'center';
			name.textContent = isDiscovered ? enemyData.name : '???';

			const role = document.createElement('div');
			role.style.fontSize = '11px';
			role.style.color = isDiscovered ? '#888' : '#555';
			role.style.marginBottom = '8px';
			role.style.textAlign = 'center';
			role.textContent = isDiscovered ? (enemyData.role || '') : 'Unknown';

			const blurb = document.createElement('div');
			blurb.style.fontSize = '12px';
			blurb.style.color = isDiscovered ? '#aaa' : '#555';
			blurb.style.textAlign = 'center';
			blurb.textContent = isDiscovered ? (enemyData.blurb || '') : 'Not yet encountered';

			card.appendChild(name);
			card.appendChild(role);
			card.appendChild(blurb);
			container.appendChild(card);
		});

		body.appendChild(container);

		if (selectedEntry && selectedEntry.type === 'enemy' && selectedEntry.enemyId) {
			const selectedCard = container.querySelector(`[data-enemy-id="${selectedEntry.enemyId}"]`);
			if (selectedCard) {
				const unlocked = discoveredEnemies.includes(selectedEntry.enemyId);
				selectedCard.style.borderColor = unlocked
					? (selectedEntry.enemyData.color || '#9c27b0')
					: '#666';
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

	const WEAPON_AFFINITY_LABELS = {
		fast: 'Acute',
		heavy: 'Obtuse',
		reach: 'Vector',
		dual: 'Parallel'
	};

	function formatLedgerMs(ms) {
		if (typeof LedgerManager !== 'undefined' && LedgerManager.formatDurationMs) {
			return LedgerManager.formatDurationMs(ms);
		}
		const totalSec = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
		const m = Math.floor(totalSec / 60);
		const s = totalSec % 60;
		return `${m}:${String(s).padStart(2, '0')}`;
	}

	function renderCombatLedger() {
		const subtabs = [
			{ key: 'global', label: 'GLOBAL' },
			{ key: 'warrior', label: 'WARRIOR' },
			{ key: 'rogue', label: 'ROGUE' },
			{ key: 'tank', label: 'TANK' },
			{ key: 'mage', label: 'MAGE' }
		];

		const row = document.createElement('div');
		row.style.display = 'flex';
		row.style.flexWrap = 'wrap';
		row.style.gap = '8px';
		row.style.marginBottom = '16px';

		subtabs.forEach(st => {
			const btn = document.createElement('button');
			btn.className = 'btn';
			btn.dataset.ledgerSubtab = st.key;
			btn.textContent = st.label;
			btn.style.padding = '8px 14px';
			btn.style.fontSize = '12px';
			btn.style.border = 'none';
			btn.style.borderRadius = '4px';
			btn.style.cursor = 'pointer';
			const active = currentLedgerSubtab === st.key;
			btn.style.backgroundColor = active ? '#333' : 'transparent';
			btn.style.color = active ? '#fff' : '#aaa';
			btn.addEventListener('click', () => {
				currentLedgerSubtab = st.key;
				selectedEntry = null;
				refresh();
				updatePreview(null);
			});
			row.appendChild(btn);
		});
		body.appendChild(row);

		const grid = document.createElement('div');
		grid.style.display = 'grid';
		grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(250px, 1fr))';
		grid.style.gap = '12px';

		if (currentLedgerSubtab === 'global') {
			const records = (typeof SaveSystem !== 'undefined' && SaveSystem.getGlobalRecords)
				? SaveSystem.getGlobalRecords()
				: {};
			const deepest = records.deepestRoom || 0;
			const biome = records.deepestBiome || 'None';
			const items = [
				{
					type: 'record',
					id: 'deepest',
					title: 'Deepest Excursion',
					summary: deepest > 0 ? `Room ${deepest} (${biome})` : 'None yet',
					detail: 'Furthest room and biome reached. Independent of run duration.'
				},
				{
					type: 'record',
					id: 'longest',
					title: 'Longest Active Run',
					summary: formatLedgerMs(records.longestRunMs || 0),
					detail: 'Longest pause/safe-room-gated active play time across runs.'
				},
				{
					type: 'record',
					id: 'maxHit',
					title: 'The Big One',
					summary: `${Math.floor(records.maxSingleHit || 0).toLocaleString()} Damage`,
					detail: 'Maximum damage dealt in a single frame/hit.'
				},
				{
					type: 'record',
					id: 'fastest',
					title: 'Speed Demon',
					summary: (records.fastestRunClear > 0)
						? formatLedgerMs(records.fastestRunClear)
						: 'No room-50 clear yet',
					detail: 'Fastest active clear time for a successful 50-room run.'
				},
				{
					type: 'record',
					id: 'voxels',
					title: 'Voxel Shatter Count',
					summary: `${Math.floor(records.lifetimeVoxels || 0).toLocaleString()} Voxels`,
					detail: 'Lifetime count of enemy shape cells fractured into debris.'
				}
			];
			items.forEach(entry => appendLedgerCard(grid, entry));
		} else {
			const tracking = (typeof SaveSystem !== 'undefined' && SaveSystem.getClassTracking)
				? SaveSystem.getClassTracking(currentLedgerSubtab)
				: {};
			const hits = tracking.weaponHits || {};
			const totalHits = (hits.fast || 0) + (hits.heavy || 0) + (hits.reach || 0) + (hits.dual || 0);
			const affinityParts = Object.keys(WEAPON_AFFINITY_LABELS).map(k => {
				const n = hits[k] || 0;
				const pct = totalHits > 0 ? Math.round((n / totalHits) * 100) : 0;
				return `${WEAPON_AFFINITY_LABELS[k]} ${pct}%`;
			});
			const dodgeRate = (tracking.totalDodges > 0)
				? ((tracking.perfectDodges || 0) / tracking.totalDodges * 100).toFixed(1)
				: '0.0';

			const classRecords = [
				{
					type: 'record',
					id: `${currentLedgerSubtab}-affinity`,
					title: 'Weapon Archetype Weight',
					summary: affinityParts.join(' · '),
					detail: 'Hits landed with each weapon variant while playing this class.'
				},
				{
					type: 'record',
					id: `${currentLedgerSubtab}-dodge`,
					title: 'Dodge Precision Rate',
					summary: `${dodgeRate}%`,
					detail: `Perfect Dodges ${tracking.perfectDodges || 0} / Total Dodges ${tracking.totalDodges || 0}`
				},
				{
					type: 'record',
					id: `${currentLedgerSubtab}-interrupt`,
					title: 'Counter-Strike Count',
					summary: String(tracking.perfectInterrupts || 0),
					detail: 'Successful Perfect Interrupts during enemy telegraph windows.'
				}
			];
			classRecords.forEach(entry => appendLedgerCard(grid, entry));
		}

		// Feats section
		const featsHeader = document.createElement('div');
		featsHeader.style.gridColumn = '1 / -1';
		featsHeader.style.marginTop = '8px';
		featsHeader.style.color = '#fff';
		featsHeader.style.fontWeight = '700';
		featsHeader.style.fontSize = '16px';
		featsHeader.textContent = 'FEATS PROGRESSION';
		grid.appendChild(featsHeader);

		const feats = (typeof FeatsRegistry !== 'undefined' && FeatsRegistry.getForTab)
			? FeatsRegistry.getForTab(currentLedgerSubtab)
			: [];
		const unlocked = (typeof SaveSystem !== 'undefined' && SaveSystem.getUnlockedFeats)
			? SaveSystem.getUnlockedFeats()
			: [];
		const completions = (typeof SaveSystem !== 'undefined' && SaveSystem.getFeatCompletions)
			? SaveSystem.getFeatCompletions()
			: {};
		const progress = (typeof LedgerManager !== 'undefined' && LedgerManager.getProgressSnapshot)
			? LedgerManager.getProgressSnapshot()
			: {};

		feats.forEach(feat => {
			const isUnlocked = unlocked.indexOf(feat.id) !== -1;
			const times = Math.max(0, Math.floor(Number(completions[feat.id]) || 0));
			let mark = '[ ]';
			let status = 'LOCKED';
			if (isUnlocked) {
				mark = '[X]';
				const r = feat.reward || {};
				const firstPay = r.credits ? `+${r.credits}c` : (r.shards ? `+${r.shards} shards` : '');
				status = times > 1
					? `UNLOCKED ×${times}`
					: `UNLOCKED${firstPay ? `: ${firstPay}` : ''}`;
				if (times > 1) status += firstPay ? ` (first ${firstPay})` : '';
			} else if (feat.progressKey && progress[feat.progressKey] != null && feat.target > 1) {
				const cur = progress[feat.progressKey] || 0;
				if (cur > 0) {
					mark = '[=]';
					status = `${Number(cur).toFixed(1)} / ${feat.target}`;
				}
			}
			appendLedgerCard(grid, {
				type: 'feat',
				id: feat.id,
				title: `${mark} ${feat.name}`,
				summary: status,
				detail: feat.description,
				feat,
				completions: times
			});
		});

		body.appendChild(grid);
	}

	function appendLedgerCard(grid, entry) {
		const card = document.createElement('div');
		card.style.padding = '14px';
		card.style.border = '1px solid #444';
		card.style.borderRadius = '4px';
		card.style.cursor = 'pointer';
		card.style.backgroundColor = selectedEntry && selectedEntry.id === entry.id ? 'rgba(156,39,176,0.2)' : '#222';
		if (selectedEntry && selectedEntry.id === entry.id) {
			card.style.borderColor = '#9c27b0';
		}
		makeFocusableCard(card, entry.title || 'Ledger entry');
		const title = document.createElement('div');
		title.style.color = '#fff';
		title.style.fontWeight = '600';
		title.style.marginBottom = '6px';
		title.textContent = entry.title;
		const summary = document.createElement('div');
		summary.style.color = '#aaa';
		summary.style.fontSize = '13px';
		summary.textContent = entry.summary;
		card.appendChild(title);
		card.appendChild(summary);
		card.addEventListener('click', () => {
			selectedEntry = entry;
			refresh();
			updatePreview(entry);
		});
		grid.appendChild(card);
	}

	function updatePreview(entry) {
		if (!previewSection) return;

		stopPreviewAnimation();
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

		// Large visual for enemies / elite affixes (animated where it matters)
		if (entry.type === 'eliteAffix' && typeof EliteEnemyAffixes !== 'undefined'
			&& EliteEnemyAffixes.createEliteAffixPreviewCanvas) {
			const unlocked = typeof SaveSystem !== 'undefined' && SaveSystem.hasDiscoveredEliteAffix
				&& SaveSystem.hasDiscoveredEliteAffix(entry.affixKey);
			if (unlocked) {
				const viz = EliteEnemyAffixes.createEliteAffixPreviewCanvas(entry.affixKey, 220, 160);
				viz.style.width = '100%';
				viz.style.maxWidth = '280px';
				viz.style.height = 'auto';
				viz.style.marginBottom = '12px';
				appendIndexVisual(content, viz);
				startPreviewAnimation(viz, 'eliteAffix', entry.affixKey);
			}
		} else if (entry.type === 'enemy' && typeof EnemyIndexCatalog !== 'undefined'
			&& EnemyIndexCatalog.createEnemyPreviewCanvas) {
			const unlocked = typeof SaveSystem !== 'undefined' && SaveSystem.hasDiscoveredEnemy
				&& SaveSystem.hasDiscoveredEnemy(entry.enemyId);
			if (unlocked) {
				const viz = EnemyIndexCatalog.createEnemyPreviewCanvas(entry.enemyId, 220, 160);
				viz.style.width = '100%';
				viz.style.maxWidth = '280px';
				viz.style.height = 'auto';
				viz.style.marginBottom = '12px';
				appendIndexVisual(content, viz);
				startPreviewAnimation(viz, 'enemy', entry.enemyId);
			}
		}
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
		} else if (entry.type === 'weapon') {
			const wt = entry.weaponData || {};
			title.textContent = wt.name || 'Weapon Type';
			title.style.color = wt.color || '#fff';

			const tag = document.createElement('div');
			tag.style.color = wt.color || '#aaa';
			tag.style.marginBottom = '12px';
			tag.style.fontSize = '13px';
			tag.textContent = wt.pickupBlurb || '';
			content.appendChild(tag);

			function addBlock(label, text) {
				if (!text) return;
				const block = document.createElement('div');
				block.style.marginBottom = '12px';
				block.style.padding = '10px';
				block.style.backgroundColor = '#2a2a2a';
				block.style.borderRadius = '4px';
				const lab = document.createElement('div');
				lab.style.color = '#fff';
				lab.style.fontWeight = 'bold';
				lab.style.marginBottom = '6px';
				lab.style.fontSize = '12px';
				lab.textContent = label;
				const bodyText = document.createElement('div');
				bodyText.style.color = '#bbb';
				bodyText.style.fontSize = '13px';
				bodyText.style.lineHeight = '1.5';
				bodyText.textContent = text;
				block.appendChild(lab);
				block.appendChild(bodyText);
				content.appendChild(block);
			}

			addBlock('Feel', wt.feel);
			addBlock('Pitch', wt.pitch);
			addBlock('Leans toward', wt.leansToward);

			const note = document.createElement('div');
			note.style.marginTop = '8px';
			note.style.fontSize = '11px';
			note.style.color = '#666';
			note.style.fontStyle = 'italic';
			note.textContent = 'Pickup tooltips only show the short line. This Index has the full read.';
			content.appendChild(note);
		} else if (entry.type === 'eliteAffix') {
			const ea = entry.affixData || {};
			const unlocked = typeof SaveSystem !== 'undefined' && SaveSystem.hasDiscoveredEliteAffix
				&& SaveSystem.hasDiscoveredEliteAffix(entry.affixKey);
			title.textContent = unlocked ? (ea.name || 'Elite Affix') : '???';
			title.style.color = unlocked ? '#ff9800' : '#666';

			if (!unlocked) {
				content.textContent = 'This elite threat has not been encountered yet.';
			} else {
				const tag = document.createElement('div');
				tag.style.color = '#ffcc80';
				tag.style.marginBottom = '12px';
				tag.style.fontSize = '13px';
				tag.textContent = ea.blurb || '';
				content.appendChild(tag);

				function addEliteBlock(label, text) {
					if (!text) return;
					const block = document.createElement('div');
					block.style.marginBottom = '12px';
					block.style.padding = '10px';
					block.style.backgroundColor = '#2a2a2a';
					block.style.borderRadius = '4px';
					const lab = document.createElement('div');
					lab.style.color = '#fff';
					lab.style.fontWeight = 'bold';
					lab.style.marginBottom = '6px';
					lab.style.fontSize = '12px';
					lab.textContent = label;
					const bodyText = document.createElement('div');
					bodyText.style.color = '#bbb';
					bodyText.style.fontSize = '13px';
					bodyText.style.lineHeight = '1.5';
					bodyText.textContent = text;
					block.appendChild(lab);
					block.appendChild(bodyText);
					content.appendChild(block);
				}

				addEliteBlock('What it does', ea.description);
				addEliteBlock('Tell', ea.tell);

				if (typeof EliteEnemyAffixes !== 'undefined' && EliteEnemyAffixes.getBiomesForEliteAffix) {
					const biomes = EliteEnemyAffixes.getBiomesForEliteAffix(entry.affixKey) || [];
					if (biomes.length) {
						const names = biomes.map(id => {
							const known = typeof SaveSystem !== 'undefined' && SaveSystem.hasDiscoveredBiome
								&& SaveSystem.hasDiscoveredBiome(id);
							if (typeof EnemyIndexCatalog !== 'undefined' && EnemyIndexCatalog.biomes && EnemyIndexCatalog.biomes[id]) {
								return known ? EnemyIndexCatalog.biomes[id].name : '???';
							}
							return known ? id : '???';
						});
						addEliteBlock('Biome pools', names.join(', '));
					}
				}
			}
		} else if (entry.type === 'enemy') {
			const en = entry.enemyData || {};
			const unlocked = typeof SaveSystem !== 'undefined' && SaveSystem.hasDiscoveredEnemy
				&& SaveSystem.hasDiscoveredEnemy(entry.enemyId);
			title.textContent = unlocked ? (en.name || 'Enemy') : '???';
			title.style.color = unlocked ? (en.color || '#fff') : '#666';

			if (!unlocked) {
				content.textContent = 'This enemy has not been encountered yet.';
			} else {
				const role = document.createElement('div');
				role.style.color = '#888';
				role.style.marginBottom = '8px';
				role.style.fontSize = '13px';
				role.textContent = en.role || '';
				content.appendChild(role);

				const tag = document.createElement('div');
				tag.style.color = '#ccc';
				tag.style.marginBottom = '12px';
				tag.style.fontSize = '13px';
				tag.textContent = en.blurb || '';
				content.appendChild(tag);

				function addEnemyBlock(label, text) {
					if (!text) return;
					const block = document.createElement('div');
					block.style.marginBottom = '12px';
					block.style.padding = '10px';
					block.style.backgroundColor = '#2a2a2a';
					block.style.borderRadius = '4px';
					const lab = document.createElement('div');
					lab.style.color = '#fff';
					lab.style.fontWeight = 'bold';
					lab.style.marginBottom = '6px';
					lab.style.fontSize = '12px';
					lab.textContent = label;
					const bodyText = document.createElement('div');
					bodyText.style.color = '#bbb';
					bodyText.style.fontSize = '13px';
					bodyText.style.lineHeight = '1.5';
					bodyText.textContent = text;
					block.appendChild(lab);
					block.appendChild(bodyText);
					content.appendChild(block);
				}

				addEnemyBlock('Behavior', en.description);
				addEnemyBlock('Tells', en.tells);
			}
		} else if (entry.type === 'biome') {
			const b = entry.biomeData || {};
			const unlocked = typeof SaveSystem !== 'undefined' && SaveSystem.hasDiscoveredBiome
				&& SaveSystem.hasDiscoveredBiome(entry.biomeId);
			title.textContent = unlocked ? (b.name || 'Biome') : '???';
			title.style.color = unlocked ? (b.color || '#fff') : '#666';

			if (!unlocked) {
				content.textContent = 'This biome has not been encountered yet.';
			} else {
				const tag = document.createElement('div');
				tag.style.color = '#ccc';
				tag.style.marginBottom = '12px';
				tag.style.fontSize = '13px';
				tag.style.lineHeight = '1.5';
				tag.textContent = b.blurb || '';
				content.appendChild(tag);

				const note = document.createElement('div');
				note.style.fontSize = '12px';
				note.style.color = '#666';
				note.style.lineHeight = '1.5';
				note.textContent = 'Biomes modulate the five base enemies. Elite affix pools also change by biome - see Elite Affixes.';
				content.appendChild(note);
			}
		} else if (entry.type === 'record' || entry.type === 'feat') {
			title.textContent = entry.title || 'Entry';
			title.style.color = entry.type === 'feat' ? '#ffd54f' : '#80cbc4';
			const summary = document.createElement('div');
			summary.style.color = '#ccc';
			summary.style.marginBottom = '12px';
			summary.style.fontSize = '14px';
			summary.textContent = entry.summary || '';
			content.appendChild(summary);
			const detail = document.createElement('div');
			detail.style.color = '#bbb';
			detail.style.fontSize = '13px';
			detail.style.lineHeight = '1.5';
			detail.textContent = entry.detail || (entry.feat && entry.feat.description) || '';
			content.appendChild(detail);
			if (entry.feat && entry.feat.reward) {
				const reward = document.createElement('div');
				reward.style.marginTop = '12px';
				reward.style.color = '#ffd700';
				reward.style.fontWeight = '600';
				const r = entry.feat.reward;
				const ratio = (typeof LedgerManager !== 'undefined' && LedgerManager.FEAT_REPEAT_PAYOUT_RATIO)
					? LedgerManager.FEAT_REPEAT_PAYOUT_RATIO
					: 0.25;
				let text = '';
				if (r.credits) {
					const repeat = Math.max(1, Math.floor(r.credits * ratio));
					text = `First: +${r.credits} Credits · Repeat: +${repeat} Credits`;
				} else if (r.shards) {
					const repeat = Math.max(1, Math.floor(r.shards * ratio));
					text = `First: +${r.shards} Shards · Repeat: +${repeat} Shards`;
				}
				reward.textContent = text;
				content.appendChild(reward);
			}
			if (entry.completions > 0) {
				const times = document.createElement('div');
				times.style.marginTop = '8px';
				times.style.color = '#aaa';
				times.style.fontSize = '13px';
				times.textContent = `Completed ${entry.completions} time${entry.completions === 1 ? '' : 's'}`;
				content.appendChild(times);
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
				// Land controller focus on catalog cards (not tab/Close buttons)
				setTimeout(() => {
					const firstCard = layer.querySelector('[role="button"][tabindex="0"]');
					if (firstCard) firstCard.focus();
				}, 50);
			} else {
				stopPreviewAnimation();
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

