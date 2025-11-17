(function () {
	let layer, modal, body, cardList, deckList, rightPanel;
	let open = false;
	let needsRebuild = true;
	let lastDeckHash = '';

	function createDeckBuilder() {
		const rootLayer = document.createElement('div');
		rootLayer.className = 'ui-layer ui-layer--modal';
		rootLayer.style.display = 'none';
		rootLayer.style.pointerEvents = 'auto';
		rootLayer.setAttribute('role', 'dialog');
		rootLayer.setAttribute('aria-modal', 'true');
		rootLayer.setAttribute('aria-label', 'Deck Builder');

		const panel = document.createElement('div');
		panel.className = 'modal deck-builder';
		panel.style.width = 'min(1400px, 98vw)';
		panel.style.maxHeight = '90vh';

		const header = document.createElement('div');
		header.className = 'modal__header';
		header.textContent = 'Deck Builder';

		body = document.createElement('div');
		body.className = 'modal__body';
		body.style.display = 'grid';
		body.style.gridTemplateColumns = '1fr 1fr';
		body.style.gap = '20px';
		body.style.maxHeight = 'calc(90vh - 120px)';
		body.style.overflow = 'auto';

		// Left: Card Library
		const leftPanel = document.createElement('div');
		leftPanel.className = 'deck-builder__library';
		const libraryTitle = document.createElement('div');
		libraryTitle.style.fontSize = '18px';
		libraryTitle.style.fontWeight = 'bold';
		libraryTitle.style.marginBottom = '12px';
		libraryTitle.textContent = 'Card Library';
		
		// Filter/search
		const filterBar = document.createElement('div');
		filterBar.style.display = 'flex';
		filterBar.style.gap = '8px';
		filterBar.style.marginBottom = '12px';
		const searchInput = document.createElement('input');
		searchInput.type = 'text';
		searchInput.placeholder = 'Search cards...';
		searchInput.style.flex = '1';
		searchInput.style.padding = '6px 10px';
		searchInput.style.border = '1px solid #555';
		searchInput.style.background = '#222';
		searchInput.style.color = '#fff';
		const categoryFilter = document.createElement('select');
		categoryFilter.style.padding = '6px 10px';
		categoryFilter.style.border = '1px solid #555';
		categoryFilter.style.background = '#222';
		categoryFilter.style.color = '#fff';
		const allOption = document.createElement('option');
		allOption.value = '';
		allOption.textContent = 'All Categories';
		categoryFilter.appendChild(allOption);
		['Offense', 'Defense', 'Mobility', 'Ability'].forEach(cat => {
			const opt = document.createElement('option');
			opt.value = cat;
			opt.textContent = cat;
			categoryFilter.appendChild(opt);
		});
		filterBar.appendChild(searchInput);
		filterBar.appendChild(categoryFilter);
		
		cardList = document.createElement('div');
		cardList.className = 'deck-builder__card-list';
		cardList.style.display = 'grid';
		cardList.style.gridTemplateColumns = 'repeat(auto-fill, minmax(280px, 1fr))';
		cardList.style.gap = '12px';
		cardList.style.maxHeight = 'calc(90vh - 280px)';
		cardList.style.overflowY = 'auto';
		
		leftPanel.appendChild(libraryTitle);
		leftPanel.appendChild(filterBar);
		leftPanel.appendChild(cardList);

		// Right: Current Deck
		rightPanel = document.createElement('div');
		rightPanel.className = 'deck-builder__deck';
		const deckTitle = document.createElement('div');
		deckTitle.style.fontSize = '18px';
		deckTitle.style.fontWeight = 'bold';
		deckTitle.style.marginBottom = '12px';
		deckTitle.textContent = 'Current Deck';
		
		const deckInfo = document.createElement('div');
		deckInfo.style.marginBottom = '12px';
		deckInfo.style.padding = '8px';
		deckInfo.style.background = 'rgba(255,255,255,0.05)';
		deckInfo.style.borderRadius = '4px';
		
		deckList = document.createElement('div');
		deckList.className = 'deck-builder__deck-list';
		deckList.style.display = 'flex';
		deckList.style.flexDirection = 'column';
		deckList.style.gap = '8px';
		deckList.style.maxHeight = 'calc(90vh - 280px)';
		deckList.style.overflowY = 'auto';
		
		rightPanel.appendChild(deckTitle);
		rightPanel.appendChild(deckInfo);
		rightPanel.appendChild(deckList);

		body.appendChild(leftPanel);
		body.appendChild(rightPanel);

		const footer = document.createElement('div');
		footer.className = 'modal__footer';
		footer.style.display = 'flex';
		footer.style.justifyContent = 'space-between';
		footer.style.alignItems = 'center';
		
		const saveBtn = document.createElement('button');
		saveBtn.className = 'btn';
		saveBtn.textContent = 'Save Deck';
		saveBtn.addEventListener('click', saveDeck);
		
		const closeBtn = document.createElement('button');
		closeBtn.className = 'btn';
		closeBtn.textContent = 'Close (B)';
		closeBtn.addEventListener('click', () => toggle(false));
		
		footer.appendChild(saveBtn);
		footer.appendChild(closeBtn);

		panel.appendChild(header);
		panel.appendChild(body);
		panel.appendChild(footer);
		rootLayer.appendChild(panel);

		const root = window.UIRoot && window.UIRoot.ensure ? window.UIRoot.ensure() : document.body;
		root.appendChild(rootLayer);
		layer = rootLayer;

		// Filter handlers
		let filterTimeout;
		searchInput.addEventListener('input', () => {
			clearTimeout(filterTimeout);
			filterTimeout = setTimeout(() => build(), 200);
		});
		categoryFilter.addEventListener('change', () => build());
	}

	function getCurrentDeck() {
		if (typeof SaveSystem === 'undefined' || !SaveSystem.getDeckConfig) return [];
		const config = SaveSystem.getDeckConfig();
		return Array.isArray(config.cards) ? config.cards : [];
	}

	function getDeckSize() {
		if (typeof SaveSystem === 'undefined' || !SaveSystem.getDeckConfig) return 20;
		const config = SaveSystem.getDeckConfig();
		return config.size || 20;
	}

	function getUnlockedCards() {
		if (typeof SaveSystem === 'undefined' || !SaveSystem.getCardsUnlocked) return [];
		const unlocked = SaveSystem.getCardsUnlocked();
		return Array.isArray(unlocked) ? unlocked : [];
	}

	function countCardInDeck(deck, cardId) {
		return deck.filter(id => id === cardId).length;
	}

	function addCardToDeck(cardId) {
		console.log('[DeckBuilder] addCardToDeck called for', cardId);
		const deck = getCurrentDeck();
		const card = window.CardCatalog && window.CardCatalog.getById ? window.CardCatalog.getById(cardId) : null;
		if (!card) {
			console.log('[DeckBuilder] Card not found:', cardId);
			return;
		}
		
		const currentCount = countCardInDeck(deck, cardId);
		const maxCopies = card.maxCopies || 1;
		const deckSize = getDeckSize();
		
		console.log('[DeckBuilder] Current count:', currentCount, 'Max:', maxCopies, 'Deck size:', deck.length, '/', deckSize);
		
		if (currentCount >= maxCopies) {
			console.log('[DeckBuilder] Already at max copies');
			return;
		}
		
		if (deck.length >= deckSize) {
			console.log('[DeckBuilder] Deck is full');
			return;
		}
		
		deck.push(cardId);
		console.log('[DeckBuilder] Added card, new deck length:', deck.length);
		
		// Save the modified deck back to SaveSystem
		if (typeof SaveSystem !== 'undefined' && SaveSystem.setDeckConfig) {
			SaveSystem.setDeckConfig({ cards: deck, size: deckSize });
			console.log('[DeckBuilder] Saved deck to SaveSystem');
		} else {
			console.log('[DeckBuilder] ERROR: SaveSystem not available!');
		}
		
		// Force rebuild to show changes
		needsRebuild = true;
		build();
	}

	function removeCardFromDeck(cardId) {
		console.log('[DeckBuilder] removeCardFromDeck called for', cardId);
		const deck = getCurrentDeck();
		const deckSize = getDeckSize();
		const index = deck.lastIndexOf(cardId);
		console.log('[DeckBuilder] Found card at index:', index, 'Deck length:', deck.length);
		if (index >= 0) {
			deck.splice(index, 1);
			console.log('[DeckBuilder] Removed card, new deck length:', deck.length);
			
			// Save the modified deck back to SaveSystem
			if (typeof SaveSystem !== 'undefined' && SaveSystem.setDeckConfig) {
				SaveSystem.setDeckConfig({ cards: deck, size: deckSize });
				console.log('[DeckBuilder] Saved deck to SaveSystem');
			} else {
				console.log('[DeckBuilder] ERROR: SaveSystem not available!');
			}
			
			// Force rebuild to show changes
			needsRebuild = true;
			build();
		} else {
			console.log('[DeckBuilder] Card not found in deck');
		}
	}

	function saveDeck() {
		const deck = getCurrentDeck();
		const deckSize = getDeckSize();
		
		// Validation
		if (deck.length < 10) {
			alert('Deck must have at least 10 cards!');
			return;
		}
		
		if (deck.length > deckSize) {
			alert(`Deck cannot exceed ${deckSize} cards!`);
			return;
		}
		
		// Check copy limits
		const cardCounts = {};
		for (const cardId of deck) {
			cardCounts[cardId] = (cardCounts[cardId] || 0) + 1;
			const card = window.CardCatalog && window.CardCatalog.getById ? window.CardCatalog.getById(cardId) : null;
			if (card && cardCounts[cardId] > (card.maxCopies || 1)) {
				alert(`Too many copies of ${card.name || cardId}! Maximum is ${card.maxCopies || 1}.`);
				return;
			}
		}
		
		// Save
		if (typeof SaveSystem !== 'undefined' && SaveSystem.setDeckConfig) {
			SaveSystem.setDeckConfig({ cards: deck, size: deckSize });
			alert('Deck saved!');
		}
	}

	function build() {
		if (!cardList || !deckList) return;
		
		const deck = getCurrentDeck();
		const deckSize = getDeckSize();
		const unlocked = getUnlockedCards();
		const searchTerm = body.querySelector('input[type="text"]')?.value.toLowerCase() || '';
		const categoryFilter = body.querySelector('select')?.value || '';
		
		// Build card library
		cardList.innerHTML = '';
		const allCards = window.CardCatalog && window.CardCatalog.getAll ? window.CardCatalog.getAll() : [];
		const playerCards = allCards.filter(c => c.category !== 'Curse' && c.category !== 'Room' && c.category !== 'Team');
		
		const filtered = playerCards.filter(card => {
			if (!unlocked.includes(card.id)) return false;
			if (searchTerm && !card.name.toLowerCase().includes(searchTerm) && !card.family.toLowerCase().includes(searchTerm)) return false;
			if (categoryFilter && card.category !== categoryFilter) return false;
			return true;
		});
		
		filtered.forEach(card => {
			const currentCount = countCardInDeck(deck, card.id);
			const maxCopies = card.maxCopies || 1;
			const canAdd = currentCount < maxCopies && deck.length < deckSize;
			
			const cardEl = document.createElement('div');
			cardEl.className = 'deck-builder__card';
			cardEl.style.border = '1px solid #555';
			cardEl.style.borderRadius = '6px';
			cardEl.style.padding = '12px';
			cardEl.style.background = canAdd ? 'rgba(255,255,255,0.05)' : 'rgba(100,100,100,0.1)';
			cardEl.style.cursor = canAdd ? 'pointer' : 'not-allowed';
			cardEl.style.opacity = canAdd ? '1' : '0.6';
			
			const name = document.createElement('div');
			name.style.fontWeight = 'bold';
			name.style.marginBottom = '4px';
			name.textContent = card.name || card.family;
			
			const category = document.createElement('div');
			category.style.fontSize = '12px';
			category.style.opacity = '0.7';
			category.style.marginBottom = '4px';
			category.textContent = card.category;
			
			const description = document.createElement('div');
			description.style.fontSize = '11px';
			description.style.opacity = '0.8';
			description.style.marginBottom = '8px';
			const whiteBand = card.qualityBands && card.qualityBands.white;
			description.textContent = whiteBand ? whiteBand.description : 'No description';
			
			const copyInfo = document.createElement('div');
			copyInfo.style.display = 'flex';
			copyInfo.style.justifyContent = 'space-between';
			copyInfo.style.alignItems = 'center';
			copyInfo.style.fontSize = '12px';
			
			const count = document.createElement('span');
			count.textContent = `In deck: ${currentCount}/${maxCopies}`;
			count.style.color = currentCount >= maxCopies ? '#ff6666' : currentCount > 0 ? '#ffaa00' : '#aaa';
			
			const addBtn = document.createElement('button');
			addBtn.className = 'btn';
			addBtn.type = 'button'; // Prevent form submission
			addBtn.textContent = '+';
			addBtn.style.padding = '4px 12px';
			addBtn.style.fontSize = '16px';
			addBtn.style.pointerEvents = 'auto';
			addBtn.style.cursor = canAdd ? 'pointer' : 'not-allowed';
			addBtn.disabled = !canAdd;
			
			// Always attach listener, but check canAdd inside
			const clickHandler = function(e) {
				e.preventDefault();
				e.stopPropagation();
				console.log('[DeckBuilder] Add button clicked for', card.id, 'canAdd:', canAdd, 'disabled:', addBtn.disabled);
				if (canAdd && !addBtn.disabled) {
					addCardToDeck(card.id);
				} else {
					console.log('[DeckBuilder] Add button click ignored - canAdd:', canAdd, 'disabled:', addBtn.disabled);
				}
			};
			addBtn.addEventListener('click', clickHandler, false);
			addBtn.addEventListener('mousedown', function(e) {
				console.log('[DeckBuilder] Add button mousedown for', card.id);
			}, false);
			
			// Verify button is set up correctly
			console.log('[DeckBuilder] Created add button for', card.id, 'canAdd:', canAdd, 'disabled:', addBtn.disabled, 'hasListeners:', addBtn.onclick !== null || true);
			
			copyInfo.appendChild(count);
			copyInfo.appendChild(addBtn);
			
			cardEl.appendChild(name);
			cardEl.appendChild(category);
			cardEl.appendChild(description);
			cardEl.appendChild(copyInfo);
			
			// Only add card click handler if button is disabled (as fallback)
			// Button click should take priority
			if (canAdd) {
				cardEl.addEventListener('click', (e) => {
					// Don't trigger if clicking on the button
					if (e.target === addBtn || e.target.closest('button')) {
						return;
					}
					console.log('[DeckBuilder] Card element clicked for', card.id);
					addCardToDeck(card.id);
				});
			}
			
			cardList.appendChild(cardEl);
		});
		
		// Build deck list
		deckList.innerHTML = '';
		
		// Update deck info
		const infoEl = rightPanel.querySelector('.deck-builder__deck-info') || rightPanel.querySelector('div:nth-child(2)');
		if (infoEl) {
			infoEl.className = 'deck-builder__deck-info';
			infoEl.innerHTML = `
				<div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
					<span>Deck Size: ${deck.length}/${deckSize}</span>
					<span style="color: ${deck.length < 10 ? '#ff6666' : deck.length >= deckSize ? '#ffaa00' : '#4a90e2'}">
						${deck.length < 10 ? 'Minimum 10 cards required' : deck.length >= deckSize ? 'Deck full' : 'Valid'}
					</span>
				</div>
			`;
		}
		
		// Group deck by card ID
		const deckGroups = {};
		deck.forEach(cardId => {
			if (!deckGroups[cardId]) deckGroups[cardId] = 0;
			deckGroups[cardId]++;
		});
		
		Object.entries(deckGroups).sort(([a], [b]) => {
			const cardA = window.CardCatalog && window.CardCatalog.getById ? window.CardCatalog.getById(a) : null;
			const cardB = window.CardCatalog && window.CardCatalog.getById ? window.CardCatalog.getById(b) : null;
			const nameA = cardA ? (cardA.name || cardA.family) : a;
			const nameB = cardB ? (cardB.name || cardB.family) : b;
			return nameA.localeCompare(nameB);
		}).forEach(([cardId, count]) => {
			const card = window.CardCatalog && window.CardCatalog.getById ? window.CardCatalog.getById(cardId) : null;
			if (!card) return;
			
			const deckItem = document.createElement('div');
			deckItem.className = 'deck-builder__deck-item';
			deckItem.style.display = 'flex';
			deckItem.style.justifyContent = 'space-between';
			deckItem.style.alignItems = 'center';
			deckItem.style.padding = '10px';
			deckItem.style.border = '1px solid #555';
			deckItem.style.borderRadius = '4px';
			deckItem.style.background = 'rgba(255,255,255,0.05)';
			
			const info = document.createElement('div');
			info.style.flex = '1';
			const name = document.createElement('div');
			name.style.fontWeight = 'bold';
			name.textContent = `${card.name || card.family} x${count}`;
			const category = document.createElement('div');
			category.style.fontSize = '11px';
			category.style.opacity = '0.7';
			category.textContent = card.category;
			info.appendChild(name);
			info.appendChild(category);
			
			const removeBtn = document.createElement('button');
			removeBtn.className = 'btn';
			removeBtn.type = 'button'; // Prevent form submission
			removeBtn.textContent = '−';
			removeBtn.style.padding = '4px 12px';
			removeBtn.style.fontSize = '16px';
			removeBtn.style.pointerEvents = 'auto';
			removeBtn.style.cursor = 'pointer';
			const removeClickHandler = function(e) {
				e.preventDefault();
				e.stopPropagation();
				console.log('[DeckBuilder] Remove button clicked for', cardId);
				removeCardFromDeck(cardId);
			};
			removeBtn.addEventListener('click', removeClickHandler, false);
			removeBtn.addEventListener('mousedown', function(e) {
				console.log('[DeckBuilder] Remove button mousedown for', cardId);
			}, false);
			
			// Verify button is set up correctly
			console.log('[DeckBuilder] Created remove button for', cardId);
			
			deckItem.appendChild(info);
			deckItem.appendChild(removeBtn);
			deckList.appendChild(deckItem);
		});
	}

	function visible() {
		if (!window.USE_DOM_UI) return false;
		return open && typeof Game !== 'undefined' && Game.state === 'NEXUS';
	}

	function toggle(force) {
		if (force !== undefined) {
			open = force;
		} else {
			open = !open;
		}
		needsRebuild = true; // Force rebuild when toggling
		refresh();
	}

	function getDeckHash() {
		const deck = getCurrentDeck();
		return JSON.stringify(deck.sort());
	}

	function refresh() {
		if (!layer) return;
		if (visible()) {
			// Only rebuild if deck changed or first time opening
			const currentHash = getDeckHash();
			if (needsRebuild || currentHash !== lastDeckHash) {
				build();
				lastDeckHash = currentHash;
				needsRebuild = false;
			}
			layer.style.display = 'block';
		} else {
			layer.style.display = 'none';
			needsRebuild = true; // Rebuild next time we open
		}
	}

	function tick() {
		refresh();
		requestAnimationFrame(tick);
	}

	function init() {
		createDeckBuilder();
		tick();
		
		// Keyboard shortcut: B key to toggle
		document.addEventListener('keydown', (e) => {
			if (e.key === 'b' || e.key === 'B') {
				if (typeof Game !== 'undefined' && Game.state === 'NEXUS' && !e.target.matches('input, textarea, select')) {
					e.preventDefault();
					toggle();
				}
			}
		});
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}

	window.toggleDeckBuilder = toggle;
})();

