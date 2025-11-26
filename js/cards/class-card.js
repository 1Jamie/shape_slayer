// Class Card System - Special card that scales with player level
// Quality bands determine damage bonus per level

window.CLASS_CARD_DEFINITIONS = {
	square: {
		id: 'class_card_square',
		family: 'Warrior Class',
		name: 'Warrior Class',
		category: 'Class',
		effectType: 'class_card',
		effectTarget: 'damage_per_level',
		application: 'passive',
		duration: 'persistent',
		nonStacking: true,
		maxCopies: 1,
		qualityBands: {
			white: { value: 0.2, description: '+0.2 damage per level', flavorText: 'Basic warrior training' },
			green: { value: 0.3, description: '+0.3 damage per level', flavorText: 'Refined combat techniques' },
			blue: { value: 0.4, description: '+0.4 damage per level', flavorText: 'Advanced warrior mastery' },
			purple: { value: 0.5, description: '+0.5 damage per level', flavorText: 'Elite warrior discipline' },
			orange: { value: 0.6, description: '+0.6 damage per level', flavorText: 'Legendary warrior prowess' }
		}
	},
	triangle: {
		id: 'class_card_triangle',
		family: 'Rogue Class',
		name: 'Rogue Class',
		category: 'Class',
		effectType: 'class_card',
		effectTarget: 'damage_per_level',
		application: 'passive',
		duration: 'persistent',
		nonStacking: true,
		maxCopies: 1,
		qualityBands: {
			white: { value: 0.2, description: '+0.2 damage per level', flavorText: 'Basic rogue training' },
			green: { value: 0.3, description: '+0.3 damage per level', flavorText: 'Refined stealth techniques' },
			blue: { value: 0.4, description: '+0.4 damage per level', flavorText: 'Advanced rogue mastery' },
			purple: { value: 0.5, description: '+0.5 damage per level', flavorText: 'Elite rogue discipline' },
			orange: { value: 0.6, description: '+0.6 damage per level', flavorText: 'Legendary rogue prowess' }
		}
	},
	pentagon: {
		id: 'class_card_pentagon',
		family: 'Tank Class',
		name: 'Tank Class',
		category: 'Class',
		effectType: 'class_card',
		effectTarget: 'damage_per_level',
		application: 'passive',
		duration: 'persistent',
		nonStacking: true,
		maxCopies: 1,
		qualityBands: {
			white: { value: 0.2, description: '+0.2 damage per level', flavorText: 'Basic tank training' },
			green: { value: 0.3, description: '+0.3 damage per level', flavorText: 'Refined defensive techniques' },
			blue: { value: 0.4, description: '+0.4 damage per level', flavorText: 'Advanced tank mastery' },
			purple: { value: 0.5, description: '+0.5 damage per level', flavorText: 'Elite tank discipline' },
			orange: { value: 0.6, description: '+0.6 damage per level', flavorText: 'Legendary tank prowess' }
		}
	},
	hexagon: {
		id: 'class_card_hexagon',
		family: 'Mage Class',
		name: 'Mage Class',
		category: 'Class',
		effectType: 'class_card',
		effectTarget: 'damage_per_level',
		application: 'passive',
		duration: 'persistent',
		nonStacking: true,
		maxCopies: 1,
		qualityBands: {
			white: { value: 0.2, description: '+0.2 damage per level', flavorText: 'Basic mage training' },
			green: { value: 0.3, description: '+0.3 damage per level', flavorText: 'Refined arcane techniques' },
			blue: { value: 0.4, description: '+0.4 damage per level', flavorText: 'Advanced mage mastery' },
			purple: { value: 0.5, description: '+0.5 damage per level', flavorText: 'Elite mage discipline' },
			orange: { value: 0.6, description: '+0.6 damage per level', flavorText: 'Legendary mage prowess' }
		}
	}
};

// Initialize class card for a player class
window.initializeClassCard = function initializeClassCard(playerClass) {
	if (!playerClass || !window.CLASS_CARD_DEFINITIONS[playerClass]) {
		console.warn('[ClassCard] Invalid player class:', playerClass);
		return null;
	}
	
	const def = window.CLASS_CARD_DEFINITIONS[playerClass];
	const classCard = {
		...def,
		_resolvedQuality: 'white', // Start at white quality
		origin: 'class' // Mark as class card
	};
	
	// Store in DeckState
	if (typeof window.DeckState !== 'undefined') {
		window.DeckState.classCard = classCard;
	}
	
	return classCard;
};

// Get class card damage bonus based on player level and quality
window.getClassCardDamageBonus = function getClassCardDamageBonus(player) {
	if (!player || !window.DeckState || !window.DeckState.classCard) {
		return 0;
	}
	
	const classCard = window.DeckState.classCard;
	const quality = classCard._resolvedQuality || 'white';
	const band = classCard.qualityBands && classCard.qualityBands[quality];
	
	if (!band || !band.value) {
		return 0;
	}
	
	// Damage bonus = value per level * player level
	const playerLevel = player.level || 1;
	return band.value * playerLevel;
};

// Upgrade class card by one quality band (same system as hand cards)
window.upgradeClassCardOneBand = function upgradeClassCardOneBand() {
	if (!window.DeckState || !window.DeckState.classCard) {
		console.warn('[ClassCard] No class card to upgrade');
		return false;
	}
	
	const classCard = window.DeckState.classCard;
	if (!classCard.qualityBands) {
		console.warn('[ClassCard] Class card has no quality bands');
		return false;
	}
	
	const order = ['white', 'green', 'blue', 'purple', 'orange'];
	const cur = classCard._resolvedQuality || 'white';
	const curIdx = order.indexOf(cur);
	
	if (curIdx === -1 || curIdx >= order.length - 1) {
		console.warn('[ClassCard] Class card already at maximum quality');
		return false;
	}
	
	const next = order[curIdx + 1];
	if (!classCard.qualityBands[next]) {
		console.warn('[ClassCard] Next quality band not available:', next);
		return false;
	}
	
	// Check room-based upgrade limit
	const roomNumber = (typeof Game !== 'undefined' && Game.roomNumber) ? Game.roomNumber : 1;
	const maxQuality = typeof window.getMaxUpgradeQualityForRoom === 'function'
		? window.getMaxUpgradeQualityForRoom(roomNumber)
		: 'orange';
	const maxQualityIdx = order.indexOf(maxQuality);
	
	if (curIdx + 1 > maxQualityIdx) {
		const unlockRoom = typeof window.getRoomForQualityUnlock === 'function'
			? window.getRoomForQualityUnlock(next)
			: 999;
		console.warn(`[ClassCard] Cannot upgrade to ${next} in Room ${roomNumber}. Maximum upgrade quality is ${maxQuality}. Upgrade to ${next} available starting Room ${unlockRoom}.`);
		return false;
	}
	
	// Upgrade the class card
	classCard._resolvedQuality = next;
	console.log(`[ClassCard] Upgraded class card from ${cur} to ${next}`);
	
	// Recalculate player stats if player exists
	if (typeof Game !== 'undefined' && Game.player) {
		Game.player.updateEffectiveStats();
	}
	
	return true;
};

// Check if class card can be upgraded
window.canUpgradeClassCard = function canUpgradeClassCard(roomNumber) {
	if (!window.DeckState || !window.DeckState.classCard) {
		return false;
	}
	
	const classCard = window.DeckState.classCard;
	if (!classCard.qualityBands) {
		return false;
	}
	
	const order = ['white', 'green', 'blue', 'purple', 'orange'];
	const cur = classCard._resolvedQuality || 'white';
	const curIdx = order.indexOf(cur);
	
	if (curIdx === -1 || curIdx >= order.length - 1) {
		return false; // Already at max
	}
	
	const next = order[curIdx + 1];
	if (!classCard.qualityBands[next]) {
		return false;
	}
	
	// Check room-based upgrade limit
	const maxQuality = typeof window.getMaxUpgradeQualityForRoom === 'function'
		? window.getMaxUpgradeQualityForRoom(roomNumber)
		: 'orange';
	const maxQualityIdx = order.indexOf(maxQuality);
	
	return curIdx + 1 <= maxQualityIdx;
};



