(function () {
	let layer, modal, body, cardList, shardDisplay, tabContainer, masteryTab, unlockTab;
	let open = false;
	let needsRebuild = true;
	let lastMasteryHash = '';
	let currentTab = 'mastery'; // 'mastery' or 'unlock'

	// Mastery upgrade costs by card category/type
	function getMasteryCost(card, fromLevel) {
		if (fromLevel >= 5) return null; // Max level
		
		const toLevel = fromLevel + 1;
		
		// Phoenix Down (most expensive)
		if (card.family === 'Phoenix Down') {
			const costs = [30, 75, 150, 300, 600];
			return costs[fromLevel] || null;
		}
		
		// Ability mutators (moderate cost)
		if (card.category === 'Ability') {
			// Some ability mutators cost more (Block Stance, Backstab Edge, Beam Mastery, Hammer Smash)
			const expensiveAbilities = ['Block Stance', 'Backstab Edge', 'Beam Mastery', 'Hammer Smash'];
			if (expensiveAbilities.includes(card.family)) {
				const costs = [20, 50, 100, 200, 400];
				return costs[fromLevel] || null;
			}
			// Standard ability mutators
			const costs = [15, 35, 70, 140, 280];
			return costs[fromLevel] || null;
		}
		
		// Advanced cards (Volley, Execute, Fractal Conduit, Detonating Vertex, Overcharge)
		const advancedCards = ['Volley', 'Execute', 'Fractal Conduit', 'Detonating Vertex', 'Overcharge'];
		if (advancedCards.includes(card.family)) {
			if (card.family === 'Fractal Conduit') {
				const costs = [20, 50, 100, 200, 400];
				return costs[fromLevel] || null;
			}
			const costs = [15, 35, 70, 140, 280];
			return costs[fromLevel] || null;
		}
		
		// Standard cards (Precision, Fury, Momentum, Bulwark, Velocity, etc.)
		const costs = [10, 25, 50, 100, 200];
		return costs[fromLevel] || null;
	}

	function createMasterySystem() {
		const rootLayer = document.createElement('div');
		rootLayer.className = 'ui-layer ui-layer--modal';
		rootLayer.style.display = 'none';
		rootLayer.style.pointerEvents = 'auto';
		rootLayer.style.position = 'fixed';
		rootLayer.style.inset = '0';
		rootLayer.style.zIndex = '10000'; // High z-index to appear above HP/XP bars and other UI
		rootLayer.setAttribute('role', 'dialog');
		rootLayer.setAttribute('aria-modal', 'true');
		rootLayer.setAttribute('aria-label', 'Card Mastery');

		const panel = document.createElement('div');
		panel.className = 'modal mastery-system';
		panel.style.width = 'min(1400px, 98vw)';
		panel.style.maxHeight = '90vh';
		panel.style.display = 'flex';
		panel.style.flexDirection = 'column';

		const header = document.createElement('div');
		header.className = 'modal__header';
		header.style.display = 'flex';
		header.style.flexDirection = 'column';
		header.style.padding = '0';
		header.style.borderBottom = '2px solid #444';

		// Top row: title and close button
		const titleRow = document.createElement('div');
		titleRow.style.display = 'flex';
		titleRow.style.justifyContent = 'space-between';
		titleRow.style.alignItems = 'center';
		titleRow.style.padding = '20px';
		titleRow.style.paddingBottom = '10px';

		const title = document.createElement('h2');
		title.textContent = 'Card System';
		title.style.margin = '0';
		title.style.color = '#fff';

		const closeBtn = document.createElement('button');
		closeBtn.className = 'btn';
		closeBtn.textContent = '✕';
		closeBtn.style.padding = '8px 16px';
		closeBtn.style.fontSize = '18px';
		closeBtn.addEventListener('click', () => toggle(false));

		titleRow.appendChild(title);
		titleRow.appendChild(closeBtn);

		// Tab navigation
		tabContainer = document.createElement('div');
		tabContainer.style.display = 'flex';
		tabContainer.style.gap = '10px';
		tabContainer.style.padding = '0 20px 10px 20px';
		tabContainer.style.borderBottom = '1px solid #333';

		masteryTab = document.createElement('button');
		masteryTab.className = 'btn';
		masteryTab.textContent = 'Mastery';
		masteryTab.style.padding = '10px 20px';
		masteryTab.style.fontSize = '16px';
		masteryTab.style.borderRadius = '4px 4px 0 0';
		masteryTab.style.border = 'none';
		masteryTab.style.borderBottom = '2px solid transparent';
		masteryTab.style.backgroundColor = 'transparent';
		masteryTab.style.color = '#aaa';
		masteryTab.style.cursor = 'pointer';
		masteryTab.addEventListener('click', () => switchTab('mastery'));

		unlockTab = document.createElement('button');
		unlockTab.className = 'btn';
		unlockTab.textContent = 'Unlock Cards';
		unlockTab.style.padding = '10px 20px';
		unlockTab.style.fontSize = '16px';
		unlockTab.style.borderRadius = '4px 4px 0 0';
		unlockTab.style.border = 'none';
		unlockTab.style.borderBottom = '2px solid transparent';
		unlockTab.style.backgroundColor = 'transparent';
		unlockTab.style.color = '#aaa';
		unlockTab.style.cursor = 'pointer';
		unlockTab.addEventListener('click', () => switchTab('unlock'));

		tabContainer.appendChild(masteryTab);
		tabContainer.appendChild(unlockTab);

		header.appendChild(titleRow);
		header.appendChild(tabContainer);

		// Shard display
		shardDisplay = document.createElement('div');
		shardDisplay.style.padding = '15px 20px';
		shardDisplay.style.backgroundColor = '#2a2a2a';
		shardDisplay.style.borderBottom = '1px solid #444';
		shardDisplay.style.display = 'flex';
		shardDisplay.style.justifyContent = 'space-between';
		shardDisplay.style.alignItems = 'center';

		const shardLabel = document.createElement('span');
		shardLabel.textContent = 'Card Shards:';
		shardLabel.style.color = '#aaa';
		shardLabel.style.fontSize = '16px';

		const shardValue = document.createElement('span');
		shardValue.id = 'mastery-shard-count';
		shardValue.style.color = '#ffd700';
		shardValue.style.fontSize = '20px';
		shardValue.style.fontWeight = 'bold';

		shardDisplay.appendChild(shardLabel);
		shardDisplay.appendChild(shardValue);

		// Card list container
		const content = document.createElement('div');
		content.style.flex = '1';
		content.style.overflowY = 'auto';
		content.style.padding = '20px';
		content.className = 'mastery-content-scroll';
		
		// Add custom scrollbar styling (only once)
		if (!document.getElementById('mastery-scrollbar-style')) {
			const style = document.createElement('style');
			style.id = 'mastery-scrollbar-style';
			style.textContent = `
				.mastery-content-scroll {
					scrollbar-width: thin;
					scrollbar-color: rgba(120, 160, 255, 0.5) rgba(20, 20, 40, 0.3);
				}
				.mastery-content-scroll::-webkit-scrollbar {
					width: 12px;
				}
				.mastery-content-scroll::-webkit-scrollbar-track {
					background: rgba(20, 20, 40, 0.3);
					border-radius: 6px;
				}
				.mastery-content-scroll::-webkit-scrollbar-thumb {
					background: rgba(120, 160, 255, 0.5);
					border-radius: 6px;
					border: 2px solid rgba(20, 20, 40, 0.3);
				}
				.mastery-content-scroll::-webkit-scrollbar-thumb:hover {
					background: rgba(120, 160, 255, 0.7);
				}
			`;
			document.head.appendChild(style);
		}

		cardList = document.createElement('div');
		cardList.style.display = 'grid';
		cardList.style.gridTemplateColumns = 'repeat(auto-fill, minmax(350px, 1fr))';
		cardList.style.gap = '15px';

		content.appendChild(cardList);
		panel.appendChild(header);
		panel.appendChild(shardDisplay);
		panel.appendChild(content);
		rootLayer.appendChild(panel);
		body = content;
		layer = rootLayer;

		const root = window.UIRoot && window.UIRoot.ensure ? window.UIRoot.ensure() : document.body;
		root.appendChild(rootLayer);
	}

	function getUnlockedCards() {
		if (typeof SaveSystem === 'undefined' || !SaveSystem.getCardsUnlocked) return [];
		return SaveSystem.getCardsUnlocked() || [];
	}

	function getAllCards() {
		if (typeof window.CardCatalog === 'undefined' || !window.CardCatalog.getAll) return [];
		return window.CardCatalog.getAll() || [];
	}

	function getCardMastery(cardId) {
		if (typeof SaveSystem === 'undefined' || !SaveSystem.getCardMastery) return 0;
		return SaveSystem.getCardMastery(cardId);
	}

	function getCardShards() {
		if (typeof SaveSystem === 'undefined' || !SaveSystem.getCardShards) return 0;
		return SaveSystem.getCardShards();
	}

	function upgradeCard(cardId) {
		if (typeof SaveSystem === 'undefined' || !SaveSystem.getCardMastery || !SaveSystem.setCardMastery || !SaveSystem.getCardShards || !SaveSystem.addCardShards) {
			console.error('[MasterySystem] SaveSystem not available');
			return false;
		}

		const card = window.CardCatalog && window.CardCatalog.getById ? window.CardCatalog.getById(cardId) : null;
		if (!card) {
			console.error('[MasterySystem] Card not found:', cardId);
			return false;
		}

		const currentLevel = getCardMastery(cardId);
		if (currentLevel >= 5) {
			alert('Card is already at maximum mastery level!');
			return false;
		}

		const cost = getMasteryCost(card, currentLevel);
		if (cost === null) {
			alert('Cannot upgrade further!');
			return false;
		}

		const currentShards = getCardShards();
		if (currentShards < cost) {
			alert(`Not enough shards! Need ${cost}, have ${currentShards}.`);
			return false;
		}

		// Deduct shards
		SaveSystem.addCardShards(-cost);
		
		// Upgrade mastery
		const newLevel = SaveSystem.setCardMastery(cardId, currentLevel + 1);
		
		console.log(`[MasterySystem] Upgraded ${card.name} from M${currentLevel} to M${newLevel} for ${cost} shards`);
		
		// Force rebuild
		needsRebuild = true;
		build();
		
		return true;
	}

	function getMasteryHash() {
		// Include lifetime stats in hash so UI rebuilds when stats change
		const lifetimeStats = typeof window.getLifetimeStats === 'function' ? window.getLifetimeStats() : {};
		const statsHash = JSON.stringify(lifetimeStats);
		const unlocked = getUnlockedCards();
		const mastery = {};
		unlocked.forEach(cardId => {
			mastery[cardId] = getCardMastery(cardId);
		});
		const masteryHash = JSON.stringify(mastery);
		// Also include shards in hash since they affect unlock affordability
		const shards = typeof SaveSystem !== 'undefined' && SaveSystem.getCardShards ? SaveSystem.getCardShards() : 0;
		return JSON.stringify({ mastery: masteryHash, stats: statsHash, shards });
	}

	function switchTab(tab) {
		currentTab = tab;
		needsRebuild = true;
		updateTabStyles();
		build();
	}

	function updateTabStyles() {
		if (!masteryTab || !unlockTab) return;
		
		// Reset all tabs
		masteryTab.style.color = '#aaa';
		masteryTab.style.borderBottom = '2px solid transparent';
		masteryTab.style.backgroundColor = 'transparent';
		unlockTab.style.color = '#aaa';
		unlockTab.style.borderBottom = '2px solid transparent';
		unlockTab.style.backgroundColor = 'transparent';
		
		// Highlight active tab
		if (currentTab === 'mastery') {
			masteryTab.style.color = '#fff';
			masteryTab.style.borderBottom = '2px solid #4caf50';
			masteryTab.style.backgroundColor = '#2a2a2a';
		} else if (currentTab === 'unlock') {
			unlockTab.style.color = '#fff';
			unlockTab.style.borderBottom = '2px solid #2196f3';
			unlockTab.style.backgroundColor = '#2a2a2a';
		}
	}

	function build() {
		if (!cardList || !shardDisplay) return;

		// Update shard display
		const shardCount = getCardShards();
		const shardValue = document.getElementById('mastery-shard-count');
		if (shardValue) {
			shardValue.textContent = shardCount.toLocaleString();
		}

		// Update tab styles
		updateTabStyles();

		// Clear card list
		cardList.innerHTML = '';

		if (currentTab === 'mastery') {
			buildMasteryTab();
		} else if (currentTab === 'unlock') {
			buildUnlockTab();
		}
	}

	function buildMasteryTab() {
		const unlocked = getUnlockedCards();
		
		if (unlocked.length === 0) {
			const emptyMsg = document.createElement('div');
			emptyMsg.style.gridColumn = '1 / -1';
			emptyMsg.style.textAlign = 'center';
			emptyMsg.style.padding = '40px';
			emptyMsg.style.color = '#888';
			emptyMsg.textContent = 'No cards unlocked yet. Unlock cards in the "Unlock Cards" tab!';
			cardList.appendChild(emptyMsg);
			return;
		}

		// Get all unlocked cards
		const cards = unlocked.map(cardId => {
			const card = window.CardCatalog && window.CardCatalog.getById ? window.CardCatalog.getById(cardId) : null;
			return card ? { id: cardId, card } : null;
		}).filter(Boolean);

		// Sort by category, then name
		const categoryOrder = ['Offense', 'Defense', 'Mobility', 'Ability', 'Economy', 'Enemy', 'Room', 'Team'];
		cards.sort((a, b) => {
			const catA = categoryOrder.indexOf(a.card.category) >= 0 ? categoryOrder.indexOf(a.card.category) : 999;
			const catB = categoryOrder.indexOf(b.card.category) >= 0 ? categoryOrder.indexOf(b.card.category) : 999;
			if (catA !== catB) return catA - catB;
			return (a.card.name || '').localeCompare(b.card.name || '');
		});

		cards.forEach(({ id: cardId, card }) => {
			buildMasteryCard(cardId, card);
		});
	}

	function buildUnlockTab() {
		const unlocked = getUnlockedCards();
		const allCards = getAllCards();
		
		// Get unlockable cards (not yet unlocked but can be unlocked)
		const unlockableCards = allCards
			.filter(card => !unlocked.includes(card.id))
			.map(card => {
				const status = typeof window.getCardUnlockStatus === 'function' ? window.getCardUnlockStatus(card.id) : { unlocked: false, canUnlock: false };
				return { id: card.id, card, unlockStatus: status };
			})
			.filter(item => item.unlockStatus.canUnlock || (item.unlockStatus.condition && (item.unlockStatus.condition.type === 'purchase' || (item.unlockStatus.condition.alternative && item.unlockStatus.condition.alternative.type === 'purchase'))));
		
		if (unlockableCards.length === 0) {
			const emptyMsg = document.createElement('div');
			emptyMsg.style.gridColumn = '1 / -1';
			emptyMsg.style.textAlign = 'center';
			emptyMsg.style.padding = '40px';
			emptyMsg.style.color = '#888';
			emptyMsg.textContent = 'No cards available to unlock. Play the game to unlock more cards!';
			cardList.appendChild(emptyMsg);
			return;
		}

		// Sort by category, then name
		const categoryOrder = ['Offense', 'Defense', 'Mobility', 'Ability', 'Economy', 'Enemy', 'Room', 'Team'];
		unlockableCards.sort((a, b) => {
			const catA = categoryOrder.indexOf(a.card.category) >= 0 ? categoryOrder.indexOf(a.card.category) : 999;
			const catB = categoryOrder.indexOf(b.card.category) >= 0 ? categoryOrder.indexOf(b.card.category) : 999;
			if (catA !== catB) return catA - catB;
			return (a.card.name || '').localeCompare(b.card.name || '');
		});

		unlockableCards.forEach(({ id: cardId, card, unlockStatus }) => {
			buildUnlockCard(cardId, card, unlockStatus);
		});
	}

	function buildMasteryCard(cardId, card) {
		const masteryLevel = getCardMastery(cardId);
		const cost = getMasteryCost(card, masteryLevel);
		const currentShards = getCardShards();
		const canAfford = cost !== null && currentShards >= cost;
		const isMaxLevel = masteryLevel >= 5;

		const cardEl = document.createElement('div');
		cardEl.style.backgroundColor = '#2a2a2a';
		cardEl.style.border = '2px solid #444';
		cardEl.style.borderRadius = '8px';
		cardEl.style.padding = '15px';
		cardEl.style.display = 'flex';
		cardEl.style.flexDirection = 'column';
		cardEl.style.gap = '10px';

		// Card header
		const header = document.createElement('div');
		header.style.display = 'flex';
		header.style.justifyContent = 'space-between';
		header.style.alignItems = 'start';

		const name = document.createElement('div');
		name.style.fontSize = '18px';
		name.style.fontWeight = 'bold';
		name.style.color = '#fff';
		name.textContent = card.name || cardId;

		const category = document.createElement('div');
		category.style.fontSize = '12px';
		category.style.color = '#888';
		category.textContent = card.category || 'Unknown';

		const nameSection = document.createElement('div');
		nameSection.style.display = 'flex';
		nameSection.style.flexDirection = 'column';
		nameSection.style.gap = '4px';
		nameSection.appendChild(name);
		nameSection.appendChild(category);

		// Mastery level indicator
		const masteryBadge = document.createElement('div');
		masteryBadge.style.padding = '4px 12px';
		masteryBadge.style.borderRadius = '12px';
		masteryBadge.style.fontSize = '14px';
		masteryBadge.style.fontWeight = 'bold';
		masteryBadge.textContent = `M${masteryLevel}`;
		
		const qualityColors = {
			0: '#ccc', // White
			1: '#4caf50', // Green
			2: '#2196f3', // Blue
			3: '#9c27b0', // Purple
			4: '#ff9800', // Orange
			5: '#ffd700' // Gold (max)
		};
		masteryBadge.style.backgroundColor = qualityColors[masteryLevel] || '#666';
		masteryBadge.style.color = masteryLevel >= 4 ? '#000' : '#fff';

		header.appendChild(nameSection);
		header.appendChild(masteryBadge);

		// Quality bands display
		const qualityBands = document.createElement('div');
		qualityBands.style.display = 'flex';
		qualityBands.style.gap = '4px';
		qualityBands.style.flexWrap = 'wrap';

		const qualityNames = ['White', 'Green', 'Blue', 'Purple', 'Orange'];
		qualityNames.forEach((qName, index) => {
			const band = card.qualityBands && card.qualityBands[qName.toLowerCase()];
			if (!band) return;

			const bandEl = document.createElement('div');
			bandEl.style.padding = '4px 8px';
			bandEl.style.borderRadius = '4px';
			bandEl.style.fontSize = '11px';
			bandEl.textContent = qName[0]; // First letter
			
			const unlocked = index <= masteryLevel;
			bandEl.style.backgroundColor = unlocked ? qualityColors[index] : '#333';
			bandEl.style.color = unlocked && index >= 4 ? '#000' : '#fff';
			bandEl.style.opacity = unlocked ? '1' : '0.3';
			bandEl.title = `${qName}: ${band.description || 'N/A'}`;

			qualityBands.appendChild(bandEl);
		});

		// Upgrade button
		const upgradeBtn = document.createElement('button');
		upgradeBtn.className = 'btn';
		upgradeBtn.type = 'button';
		upgradeBtn.style.padding = '10px';
		upgradeBtn.style.fontSize = '14px';
		upgradeBtn.style.pointerEvents = 'auto';
		upgradeBtn.style.cursor = canAfford && !isMaxLevel ? 'pointer' : 'not-allowed';
		upgradeBtn.disabled = !canAfford || isMaxLevel;

		if (isMaxLevel) {
			upgradeBtn.textContent = 'MAX LEVEL';
			upgradeBtn.style.backgroundColor = '#666';
			upgradeBtn.style.color = '#aaa';
		} else if (canAfford) {
			upgradeBtn.textContent = `Upgrade (${cost} shards)`;
			upgradeBtn.style.backgroundColor = '#4caf50';
			upgradeBtn.style.color = '#fff';
			upgradeBtn.addEventListener('click', function(e) {
				e.preventDefault();
				e.stopPropagation();
				if (upgradeCard(cardId)) {
					// Success - UI will rebuild
				}
			}, false);
		} else {
			upgradeBtn.textContent = `Need ${cost} shards`;
			upgradeBtn.style.backgroundColor = '#666';
			upgradeBtn.style.color = '#aaa';
		}

		cardEl.appendChild(header);
		cardEl.appendChild(qualityBands);
		cardEl.appendChild(upgradeBtn);
		cardList.appendChild(cardEl);
	}

	function buildUnlockCard(cardId, card, unlockStatus) {
		const unlockCost = unlockStatus && unlockStatus.condition ? 
			(unlockStatus.condition.type === 'purchase' ? (unlockStatus.condition.shards || 0) : 
			(unlockStatus.condition.alternative && unlockStatus.condition.alternative.type === 'purchase' ? (unlockStatus.condition.alternative.shards || 0) : 0)) : 0;
		const currentShards = getCardShards();
		const canAffordUnlock = unlockCost > 0 && currentShards >= unlockCost;
		
		const cardEl = document.createElement('div');
		cardEl.style.backgroundColor = '#1a1a1a';
		cardEl.style.border = '2px dashed #666';
		cardEl.style.borderRadius = '8px';
		cardEl.style.padding = '15px';
		cardEl.style.display = 'flex';
		cardEl.style.flexDirection = 'column';
		cardEl.style.gap = '10px';
		cardEl.style.opacity = '0.9';

		const header = document.createElement('div');
		header.style.display = 'flex';
		header.style.justifyContent = 'space-between';
		header.style.alignItems = 'start';

		const name = document.createElement('div');
		name.style.fontSize = '18px';
		name.style.fontWeight = 'bold';
		name.style.color = '#888';
		name.textContent = card.name || cardId;

		const category = document.createElement('div');
		category.style.fontSize = '12px';
		category.style.color = '#666';
		category.textContent = card.category || 'Unknown';

		const nameSection = document.createElement('div');
		nameSection.style.display = 'flex';
		nameSection.style.flexDirection = 'column';
		nameSection.style.gap = '4px';
		nameSection.appendChild(name);
		nameSection.appendChild(category);

		const lockedBadge = document.createElement('div');
		lockedBadge.style.padding = '4px 12px';
		lockedBadge.style.borderRadius = '12px';
		lockedBadge.style.fontSize = '14px';
		lockedBadge.style.fontWeight = 'bold';
		lockedBadge.textContent = '🔒 LOCKED';
		lockedBadge.style.backgroundColor = '#666';
		lockedBadge.style.color = '#fff';

		header.appendChild(nameSection);
		header.appendChild(lockedBadge);

		// Show unlock condition info
		const conditionInfo = document.createElement('div');
		conditionInfo.style.fontSize = '12px';
		conditionInfo.style.color = '#aaa';
		conditionInfo.style.marginTop = '5px';
		conditionInfo.style.display = 'flex';
		conditionInfo.style.flexDirection = 'column';
		conditionInfo.style.gap = '8px';
		
		if (unlockStatus && unlockStatus.condition) {
			const cond = unlockStatus.condition;
			if (cond.type === 'room_milestone') {
				const currentRoom = typeof Game !== 'undefined' && Game.roomNumber ? Game.roomNumber : 0;
				const requiredRoom = cond.room || 0;
				if (currentRoom >= requiredRoom) {
					conditionInfo.innerHTML = `<div style="color: #4caf50;">✓ Unlock at Room ${requiredRoom} (Complete!)</div>`;
				} else {
					conditionInfo.innerHTML = `<div>Unlock at Room ${requiredRoom} (Current: Room ${currentRoom})</div>`;
				}
			} else if (cond.type === 'achievement') {
				// Show achievement progress if available
				if (unlockStatus.achievementProgress) {
					const progress = unlockStatus.achievementProgress;
					const percentage = progress.required > 0 ? Math.min(100, Math.floor((progress.current / progress.required) * 100)) : 0;
					const isComplete = progress.current >= progress.required;
					
					// Progress label
					const labelEl = document.createElement('div');
					labelEl.style.color = isComplete ? '#4caf50' : '#aaa';
					labelEl.textContent = progress.label || 'Achievement';
					conditionInfo.appendChild(labelEl);
					
					// Progress bar container
					const progressContainer = document.createElement('div');
					progressContainer.style.display = 'flex';
					progressContainer.style.flexDirection = 'column';
					progressContainer.style.gap = '4px';
					
					// Progress bar
					const progressBar = document.createElement('div');
					progressBar.style.width = '100%';
					progressBar.style.height = '8px';
					progressBar.style.backgroundColor = '#333';
					progressBar.style.borderRadius = '4px';
					progressBar.style.overflow = 'hidden';
					progressBar.style.position = 'relative';
					
					const progressFill = document.createElement('div');
					progressFill.style.width = `${percentage}%`;
					progressFill.style.height = '100%';
					progressFill.style.backgroundColor = isComplete ? '#4caf50' : '#2196f3';
					progressFill.style.transition = 'width 0.3s ease';
					progressBar.appendChild(progressFill);
					
					// Progress text
					const progressText = document.createElement('div');
					progressText.style.fontSize = '11px';
					progressText.style.color = isComplete ? '#4caf50' : '#888';
					progressText.textContent = `${progress.current.toLocaleString()} / ${progress.required.toLocaleString()} (${percentage}%)`;
					
					progressContainer.appendChild(progressBar);
					progressContainer.appendChild(progressText);
					conditionInfo.appendChild(progressContainer);
					
					// Show alternative purchase option if available
					if (cond.alternative && cond.alternative.type === 'purchase') {
						const altText = document.createElement('div');
						altText.style.fontSize = '11px';
						altText.style.color = '#888';
						altText.style.marginTop = '4px';
						altText.textContent = `OR purchase for ${cond.alternative.shards || 0} shards`;
						conditionInfo.appendChild(altText);
					}
				} else {
					conditionInfo.textContent = `Unlock via: ${cond.achievement || 'Achievement'}`;
				}
			} else if (cond.type === 'purchase') {
				conditionInfo.textContent = `Purchase for ${cond.shards || 0} shards`;
			} else if (cond.alternative && cond.alternative.type === 'purchase') {
				conditionInfo.textContent = `Or purchase for ${cond.alternative.shards || 0} shards`;
			}
		} else if (unlockStatus && unlockStatus.reason) {
			conditionInfo.textContent = unlockStatus.reason;
		}

		const unlockBtn = document.createElement('button');
		unlockBtn.className = 'btn';
		unlockBtn.type = 'button';
		unlockBtn.style.padding = '10px';
		unlockBtn.style.fontSize = '14px';
		unlockBtn.style.pointerEvents = 'auto';
		unlockBtn.style.cursor = canAffordUnlock ? 'pointer' : 'not-allowed';
		unlockBtn.disabled = !canAffordUnlock;

		if (unlockCost > 0) {
			if (canAffordUnlock) {
				unlockBtn.textContent = `Unlock (${unlockCost} shards)`;
				unlockBtn.style.backgroundColor = '#2196f3';
				unlockBtn.style.color = '#fff';
				unlockBtn.addEventListener('click', function(e) {
					e.preventDefault();
					e.stopPropagation();
					if (typeof window.purchaseCardUnlock === 'function') {
						const result = window.purchaseCardUnlock(cardId);
						if (result.success) {
							needsRebuild = true;
							build();
						} else {
							alert(result.error || 'Failed to unlock card');
						}
					}
				}, false);
			} else {
				unlockBtn.textContent = `Need ${unlockCost} shards`;
				unlockBtn.style.backgroundColor = '#666';
				unlockBtn.style.color = '#aaa';
			}
		} else {
			unlockBtn.textContent = unlockStatus && unlockStatus.reason ? unlockStatus.reason : 'Cannot unlock yet';
			unlockBtn.style.backgroundColor = '#666';
			unlockBtn.style.color = '#aaa';
			unlockBtn.disabled = true;
		}

		cardEl.appendChild(header);
		if (conditionInfo.textContent) {
			cardEl.appendChild(conditionInfo);
		}
		cardEl.appendChild(unlockBtn);
		cardList.appendChild(cardEl);
	}

	function buildMasteryCard(cardId, card) {
		const masteryLevel = getCardMastery(cardId);
		const cost = getMasteryCost(card, masteryLevel);
		const currentShards = getCardShards();
		const canAfford = cost !== null && currentShards >= cost;
		const isMaxLevel = masteryLevel >= 5;

		const cardEl = document.createElement('div');
		cardEl.style.backgroundColor = '#2a2a2a';
		cardEl.style.border = '2px solid #444';
		cardEl.style.borderRadius = '8px';
		cardEl.style.padding = '15px';
		cardEl.style.display = 'flex';
		cardEl.style.flexDirection = 'column';
		cardEl.style.gap = '10px';

		// Card header
		const header = document.createElement('div');
		header.style.display = 'flex';
		header.style.justifyContent = 'space-between';
		header.style.alignItems = 'start';

		const name = document.createElement('div');
		name.style.fontSize = '18px';
		name.style.fontWeight = 'bold';
		name.style.color = '#fff';
		name.textContent = card.name || cardId;

		const category = document.createElement('div');
		category.style.fontSize = '12px';
		category.style.color = '#888';
		category.textContent = card.category || 'Unknown';

		const nameSection = document.createElement('div');
		nameSection.style.display = 'flex';
		nameSection.style.flexDirection = 'column';
		nameSection.style.gap = '4px';
		nameSection.appendChild(name);
		nameSection.appendChild(category);

		// Mastery level indicator
		const masteryBadge = document.createElement('div');
		masteryBadge.style.padding = '4px 12px';
		masteryBadge.style.borderRadius = '12px';
		masteryBadge.style.fontSize = '14px';
		masteryBadge.style.fontWeight = 'bold';
		masteryBadge.textContent = `M${masteryLevel}`;
		
		const qualityColors = {
			0: '#ccc', // White
			1: '#4caf50', // Green
			2: '#2196f3', // Blue
			3: '#9c27b0', // Purple
			4: '#ff9800', // Orange
			5: '#ffd700' // Gold (max)
		};
		masteryBadge.style.backgroundColor = qualityColors[masteryLevel] || '#666';
		masteryBadge.style.color = masteryLevel >= 4 ? '#000' : '#fff';

		header.appendChild(nameSection);
		header.appendChild(masteryBadge);

		// Quality bands display
		const qualityBands = document.createElement('div');
		qualityBands.style.display = 'flex';
		qualityBands.style.gap = '4px';
		qualityBands.style.flexWrap = 'wrap';

		const qualityNames = ['White', 'Green', 'Blue', 'Purple', 'Orange'];
		qualityNames.forEach((qName, index) => {
			const band = card.qualityBands && card.qualityBands[qName.toLowerCase()];
			if (!band) return;

			const bandEl = document.createElement('div');
			bandEl.style.padding = '4px 8px';
			bandEl.style.borderRadius = '4px';
			bandEl.style.fontSize = '11px';
			bandEl.textContent = qName[0]; // First letter
			
			const unlocked = index <= masteryLevel;
			bandEl.style.backgroundColor = unlocked ? qualityColors[index] : '#333';
			bandEl.style.color = unlocked && index >= 4 ? '#000' : '#fff';
			bandEl.style.opacity = unlocked ? '1' : '0.3';
			bandEl.title = `${qName}: ${band.description || 'N/A'}`;

			qualityBands.appendChild(bandEl);
		});

		// Upgrade button
		const upgradeBtn = document.createElement('button');
		upgradeBtn.className = 'btn';
		upgradeBtn.type = 'button';
		upgradeBtn.style.padding = '10px';
		upgradeBtn.style.fontSize = '14px';
		upgradeBtn.style.pointerEvents = 'auto';
		upgradeBtn.style.cursor = canAfford && !isMaxLevel ? 'pointer' : 'not-allowed';
		upgradeBtn.disabled = !canAfford || isMaxLevel;

		if (isMaxLevel) {
			upgradeBtn.textContent = 'MAX LEVEL';
			upgradeBtn.style.backgroundColor = '#666';
			upgradeBtn.style.color = '#aaa';
		} else if (canAfford) {
			upgradeBtn.textContent = `Upgrade (${cost} shards)`;
			upgradeBtn.style.backgroundColor = '#4caf50';
			upgradeBtn.style.color = '#fff';
			upgradeBtn.addEventListener('click', function(e) {
				e.preventDefault();
				e.stopPropagation();
				if (upgradeCard(cardId)) {
					// Success - UI will rebuild
				}
			}, false);
		} else {
			upgradeBtn.textContent = `Need ${cost} shards`;
			upgradeBtn.style.backgroundColor = '#666';
			upgradeBtn.style.color = '#aaa';
		}

		cardEl.appendChild(header);
		cardEl.appendChild(qualityBands);
		cardEl.appendChild(upgradeBtn);
		cardList.appendChild(cardEl);
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
		if (open) {
			currentTab = 'mastery'; // Reset to mastery tab when opening
			// Force rebuild when opening to ensure fresh stats
			needsRebuild = true;
			lastMasteryHash = ''; // Reset hash to force rebuild
		}
		refresh();
	}

	function refresh() {
		if (!layer) return;
		if (visible()) {
			const currentHash = getMasteryHash();
			if (needsRebuild || currentHash !== lastMasteryHash) {
				build();
				lastMasteryHash = currentHash;
				needsRebuild = false;
			}
			layer.style.display = 'block';
		} else {
			layer.style.display = 'none';
			needsRebuild = true;
		}
	}

	function tick() {
		refresh();
		requestAnimationFrame(tick);
	}

	function init() {
		createMasterySystem();
		tick();
		
		// Keyboard shortcut: M key to toggle
		document.addEventListener('keydown', (e) => {
			if (e.key === 'm' || e.key === 'M') {
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

	window.toggleMasterySystem = toggle;
})();

