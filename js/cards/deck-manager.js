// Deck manager - runtime state and basic operations (global, non-module)

window.DeckState = {
	runDeck: [],
	drawPile: [],
	hand: [],
	discard: [],
	spent: [],
	reserve: [],
	roomModifierInventory: [],
	activeTeamCards: []
};

// Room-based upgrade quality limits (easily tunable)
// Format: [minRoom, maxRoom] -> maxQuality
const UPGRADE_QUALITY_LIMITS = [
	{ rooms: [1, 5], maxQuality: 'green' },      // Rooms 1-5: Max Green
	{ rooms: [6, 10], maxQuality: 'blue' },      // Rooms 6-10: Max Blue
	{ rooms: [11, 15], maxQuality: 'purple' },   // Rooms 11-15: Max Purple
	{ rooms: [16, 21], maxQuality: 'purple' },   // Rooms 16-21: Max Purple (unchanged)
	{ rooms: [22, 31], maxQuality: 'orange' },   // Rooms 22-31: Max Orange
	{ rooms: [32, 999], maxQuality: 'orange' }   // Rooms 32+: Max Orange (unchanged)
];

// Get maximum upgrade quality allowed for a room number
function getMaxUpgradeQualityForRoom(roomNumber) {
	if (!roomNumber || roomNumber < 1) return 'white';
	for (const limit of UPGRADE_QUALITY_LIMITS) {
		if (roomNumber >= limit.rooms[0] && roomNumber <= limit.rooms[1]) {
			return limit.maxQuality;
		}
	}
	return 'orange'; // Fallback
}

// Get the room number where a quality becomes available
function getRoomForQualityUnlock(targetQuality) {
	const qualityOrder = ['white', 'green', 'blue', 'purple', 'orange'];
	const targetIdx = qualityOrder.indexOf(targetQuality);
	if (targetIdx === -1) return 999;
	
	for (const limit of UPGRADE_QUALITY_LIMITS) {
		const limitIdx = qualityOrder.indexOf(limit.maxQuality);
		if (limitIdx >= targetIdx) {
			return limit.rooms[0];
		}
	}
	return 999;
}

// Check if any cards in hand can be upgraded given room limits
function canUpgradeAnyCard(roomNumber) {
	const hand = window.DeckState && Array.isArray(window.DeckState.hand) ? window.DeckState.hand : [];
	if (hand.length === 0) return false;
	
	const maxQuality = getMaxUpgradeQualityForRoom(roomNumber);
	const qualityOrder = ['white', 'green', 'blue', 'purple', 'orange'];
	const maxQualityIdx = qualityOrder.indexOf(maxQuality);
	
	for (const card of hand) {
		if (!card || !card.qualityBands) continue;
		const cur = card._resolvedQuality || 'white';
		const curIdx = qualityOrder.indexOf(cur);
		if (curIdx === -1 || curIdx >= qualityOrder.length - 1) continue;
		
		const next = qualityOrder[curIdx + 1];
		if (!card.qualityBands[next]) continue;
		
		// Check if upgrade would exceed room limit
		if (curIdx + 1 <= maxQualityIdx) {
			return true; // At least one card can be upgraded
		}
	}
	return false; // No cards can be upgraded
}

// Count how many cards in hand can be upgraded given room limits
function countUpgradeableCards(roomNumber) {
	const hand = window.DeckState && Array.isArray(window.DeckState.hand) ? window.DeckState.hand : [];
	if (hand.length === 0) return 0;
	
	const maxQuality = getMaxUpgradeQualityForRoom(roomNumber);
	const qualityOrder = ['white', 'green', 'blue', 'purple', 'orange'];
	const maxQualityIdx = qualityOrder.indexOf(maxQuality);
	let count = 0;
	
	for (const card of hand) {
		if (!card || !card.qualityBands) continue;
		const cur = card._resolvedQuality || 'white';
		const curIdx = qualityOrder.indexOf(cur);
		if (curIdx === -1 || curIdx >= qualityOrder.length - 1) continue;
		
		const next = qualityOrder[curIdx + 1];
		if (!card.qualityBands[next]) continue;
		
		// Check if upgrade would exceed room limit
		if (curIdx + 1 <= maxQualityIdx) {
			count++; // This card can be upgraded
		}
	}
	return count;
}

function pickWeighted(weights) {
	const r = Math.random();
	let cum = 0;
	for (const [key, w] of Object.entries(weights)) {
		cum += w;
		if (r < cum) return key;
	}
	// Fallback to first key
	return Object.keys(weights)[0];
}

function normalizeWeights(obj) {
	const sum = Object.values(obj).reduce((a, b) => a + b, 0) || 1;
	const out = {};
	for (const k in obj) out[k] = obj[k] / sum;
	return out;
}

function applyUpwardShift(dist, shiftUp = 0) {
	if (!shiftUp || shiftUp <= 0) return { ...dist };
	const out = { ...dist };
	// Take from white (and then green if needed), add to purple/orange (60/40)
	let remaining = shiftUp;
	const takeWhite = Math.min(out.white, remaining);
	out.white -= takeWhite;
	remaining -= takeWhite;
	if (remaining > 0) {
		const takeGreen = Math.min(out.green, remaining);
		out.green -= takeGreen;
		remaining -= takeGreen;
	}
	out.orange += shiftUp * 0.6;
	out.purple += shiftUp * 0.4;
	return normalizeWeights(out);
}

function applyMinBand(dist, minBand) {
	if (!minBand) return { ...dist };
	const order = ['white','green','blue','purple','orange'];
	const minIdx = order.indexOf(minBand);
	if (minIdx <= 0) return { ...dist };
	const out = { ...dist };
	for (let i = 0; i < minIdx; i++) {
		out[order[i]] = 0;
	}
	return normalizeWeights(out);
}

// Returns distribution by room range per spec (baseline, no elite shift)
function getRoomQualityDistribution(roomNumber) {
	if (roomNumber <= 5) {
		return { white: 0.70, green: 0.20, blue: 0.08, purple: 0.02, orange: 0.0 };
	} else if (roomNumber <= 10) {
		return { white: 0.50, green: 0.25, blue: 0.15, purple: 0.08, orange: 0.02 };
	} else if (roomNumber <= 15) {
		return { white: 0.35, green: 0.25, blue: 0.20, purple: 0.12, orange: 0.08 };
	}
	return { white: 0.20, green: 0.25, blue: 0.25, purple: 0.18, orange: 0.12 };
}

// Apply elite shift (+10% toward top two bands)
function applyEliteShift(dist) {
	const out = { ...dist };
	// top two: determine by keys order [orange, purple]
	const boost = 0.10;
	const pull = boost;
	// Pull from white first, then green if needed
	const pullWhite = Math.min(out.white, pull * 0.7);
	out.white -= pullWhite;
	let residual = pull - pullWhite;
	if (residual > 0) {
		const pullGreen = Math.min(out.green, residual);
		out.green -= pullGreen;
		residual -= pullGreen;
	}
	out.purple += boost * 0.4;
	out.orange += boost * 0.6;
	return normalizeWeights(out);
}

function capByMastery(dist, masteryLevel) {
	const out = { ...dist };
	// Mastery 0: white only; 1: white/green; 2: +blue; 3: +purple; 4+: +orange
	const allowed = masteryLevel >= 4 ? ['white','green','blue','purple','orange']
		: masteryLevel === 3 ? ['white','green','blue','purple']
		: masteryLevel === 2 ? ['white','green','blue']
		: masteryLevel === 1 ? ['white','green']
		: ['white'];
	for (const band of ['white','green','blue','purple','orange']) {
		if (!allowed.includes(band)) out[band] = 0;
	}
	return normalizeWeights(out);
}

function getCardMastery(cardId) {
	if (typeof SaveSystem === 'undefined' || !SaveSystem.getCardMastery) return 0;
	return SaveSystem.getCardMastery(cardId) || 0;
}

// Starting draw mastery floor distribution per spec
function getStartingFloorDistribution(avgMastery) {
	if (avgMastery >= 4) return { white: 0.20, green: 0.25, blue: 0.25, purple: 0.20, orange: 0.10 };
	if (avgMastery >= 3) return { white: 0.40, green: 0.30, blue: 0.20, purple: 0.08, orange: 0.02 };
	if (avgMastery >= 2) return { white: 0.60, green: 0.25, blue: 0.10, purple: 0.05, orange: 0.0 };
	return { white: 0.80, green: 0.15, blue: 0.05, purple: 0.0, orange: 0.0 };
}

function averageMastery(cardIds) {
	if (!Array.isArray(cardIds) || cardIds.length === 0) return 0;
	let sum = 0;
	cardIds.forEach(id => { sum += getCardMastery(id); });
	return sum / cardIds.length;
}

// Resolve final quality band for a card draw
function resolveQualityForCard(cardId, roomNumber, options = {}) {
	const isStarting = options.isStarting === true;
	const isElite = options.isElite === true;
	const ignoreCap = options.ignoreCap === true;
	const qualityShift = Number.isFinite(options.qualityShift) ? Math.max(0, Math.min(0.5, options.qualityShift)) : 0;
	const minBand = options.minBand || null;
	const mastery = getCardMastery(cardId);
	let dist = isStarting
		? getStartingFloorDistribution(averageMastery((SaveSystem.getDeckConfig && SaveSystem.getDeckConfig().cards) || []))
		: getRoomQualityDistribution(roomNumber || 1);
	if (isElite) {
		dist = applyEliteShift(dist);
	}
	// Apply external quality shift (from pack bonuses)
	if (qualityShift > 0) {
		dist = applyUpwardShift(dist, qualityShift);
	}
	// Cap by mastery (standard packs respect cap). For elites, spec allows ignoring cap, but that will be handled when generating packs; draws from deck should respect cap.
	if (!ignoreCap) {
		dist = capByMastery(dist, mastery);
	}
	// Enforce minimum band if specified (e.g., guaranteed rare+)
	if (minBand) {
		dist = applyMinBand(dist, minBand);
	}
	return pickWeighted(dist);
}

// Simple PRNG-seeded shuffle placeholder (replace with seeded RNG later if needed)
function shuffleDeck(deck) {
	const copy = deck.slice();
	for (let i = copy.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[copy[i], copy[j]] = [copy[j], copy[i]];
	}
	return copy;
}

// Draw cards - quality distribution logic added in later phase
window.drawCards = function drawCards(count = 1) {
	const drawn = [];
	for (let i = 0; i < count; i++) {
		if (window.DeckState.drawPile.length === 0) {
			// Reshuffle from discard: only deck-origin cards return
			const toReshuffle = window.DeckState.discard.filter(c => c.origin === 'deck');
			window.DeckState.drawPile = shuffleDeck(toReshuffle);
			window.DeckState.discard = window.DeckState.discard.filter(c => c.origin !== 'deck');
		}
		const card = window.DeckState.drawPile.shift();
		if (!card) break;
		// Respect non-stacking: skip if a card with same family is already in hand
		if (card.nonStacking) {
			const exists = window.DeckState.hand.some(h => h.family === card.family);
			if (exists) {
				// Put at end of draw pile to avoid immediate loop
				window.DeckState.drawPile.push(card);
				// Try next card
				i--;
				continue;
			}
		}
		card.origin = card.origin || 'deck';
		// Assign resolved quality based on room and mastery (deck draws use roomNumber from Game)
		try {
			const roomNum = (typeof Game !== 'undefined' && Game.roomNumber) ? Game.roomNumber : 1;
			card._resolvedQuality = resolveQualityForCard(card.id, roomNum, { isStarting: false, isElite: false });
		} catch (e) {
			card._resolvedQuality = 'white';
		}
		window.DeckState.hand.push(card);
		drawn.push(card);
	}
	return drawn;
};

// Draw the starting hand using the mastery-adjusted starting distribution (floor) per spec
window.drawStartingHand = function drawStartingHand(count = 1) {
	const drawn = [];
	for (let i = 0; i < count; i++) {
		if (window.DeckState.drawPile.length === 0) {
			// No reshuffle at start; if empty just stop
			break;
		}
		const card = window.DeckState.drawPile.shift();
		if (!card) break;
		// Respect non-stacking for starting hand as well
		if (card.nonStacking) {
			const exists = window.DeckState.hand.some(h => h.family === card.family);
			if (exists) {
				// Put back to end and try next
				window.DeckState.drawPile.push(card);
				i--;
				continue;
			}
		}
		card.origin = 'deck';
		try {
			card._resolvedQuality = resolveQualityForCard(card.id, 1, { isStarting: true, isElite: false });
		} catch (e) {
			card._resolvedQuality = 'white';
		}
		window.DeckState.hand.push(card);
		drawn.push(card);
	}
	return drawn;
};

window.addToHand = function addToHand(card) {
	// Non-stacking validation
	if (card.nonStacking) {
		const already = window.DeckState.hand.find(c => c.family === card.family);
		if (already) return false;
	}
	// Capacity check
	const maxSize = (typeof SaveSystem !== 'undefined' && SaveSystem.getDeckUpgrades) ? (SaveSystem.getDeckUpgrades().handSize || 4) : 4;
	if (Array.isArray(window.DeckState.hand) && window.DeckState.hand.length >= maxSize) {
		// Trigger swap UI
		if (typeof Game !== 'undefined') {
			Game.awaitingHandSwap = true;
			Game.pendingSwapCard = { ...card, origin: card.origin || 'found' };
			// Open character sheet to perform swap in full UI
			if (typeof CharacterSheet !== 'undefined') {
				CharacterSheet.isOpen = true;
			}
		}
		return false;
	}
	const instance = { ...card, origin: card.origin || 'found' };
	if (!instance._resolvedQuality) {
		try {
			const roomNum = (typeof Game !== 'undefined' && Game.roomNumber) ? Game.roomNumber : 1;
			instance._resolvedQuality = resolveQualityForCard(instance.id, roomNum, { isStarting: false, isElite: false });
		} catch (e) {
			instance._resolvedQuality = 'white';
		}
	}
	window.DeckState.hand.push(instance);
	return true;
};

window.discardCard = function discardCard(cardId) {
	const idx = window.DeckState.hand.findIndex(c => c.id === cardId);
	if (idx === -1) return false;
	const [card] = window.DeckState.hand.splice(idx, 1);
	window.DeckState.discard.push(card);
	return true;
};

window.initializeRunDeck = function initializeRunDeck(deckCardIds) {
	const catalog = (window.CardCatalog && window.CardCatalog.getAll) ? window.CardCatalog.getAll() : [];
	const deck = [];
	deckCardIds.forEach(id => {
		const def = catalog.find(c => c.id === id);
		if (def) {
			deck.push({ ...def, origin: 'deck' });
		}
	});
	window.DeckState.runDeck = deck.slice();
	window.DeckState.drawPile = shuffleDeck(deck);
	window.DeckState.hand = [];
	window.DeckState.discard = [];
	window.DeckState.spent = [];
	window.DeckState.reserve = [];
};

// Upgrade a hand card by one quality band (run-only)
window.upgradeHandCardOneBand = function upgradeHandCardOneBand(index) {
	const hand = window.DeckState.hand;
	if (!Array.isArray(hand) || index < 0 || index >= hand.length) return false;
	const card = hand[index];
	if (!card || !card.qualityBands) return false;
	
	// CRITICAL FIX: Ensure we're working with a unique card instance
	// If multiple cards with the same ID exist, they might share object references
	// Create a new object with the updated quality to prevent affecting other instances
	const order = ['white','green','blue','purple','orange'];
	const cur = card._resolvedQuality || 'white';
	const curIdx = order.indexOf(cur);
	if (curIdx === -1 || curIdx >= order.length - 1) return false;
	const next = order[curIdx + 1];
	if (!card.qualityBands[next]) return false;
	
	// NEW: Check room-based upgrade limit
	const roomNumber = (typeof Game !== 'undefined' && Game.roomNumber) ? Game.roomNumber : 1;
	const maxQuality = getMaxUpgradeQualityForRoom(roomNumber);
	const maxQualityIdx = order.indexOf(maxQuality);
	
	if (curIdx + 1 > maxQualityIdx) {
		const unlockRoom = getRoomForQualityUnlock(next);
		console.warn(`[UPGRADE] Cannot upgrade ${card.name || card.family} to ${next} in Room ${roomNumber}. Maximum upgrade quality is ${maxQuality}. Upgrade to ${next} available starting Room ${unlockRoom}.`);
		return false;
	}
	
	// Check if this card object is referenced elsewhere in the hand
	const sameCardRefs = hand.filter(c => c === card);
	if (sameCardRefs.length > 1) {
		// Multiple references to the same object - create a new instance
		console.warn('[UPGRADE] Card at index', index, 'is shared by', sameCardRefs.length, 'hand slots. Creating new instance.');
		const newCard = { ...card };
		newCard._resolvedQuality = next;
		newCard._tempUpgradeSteps = (card._tempUpgradeSteps || 0) + 1;
		hand[index] = newCard;
	} else {
		// Safe to modify directly
		card._resolvedQuality = next;
		card._tempUpgradeSteps = (card._tempUpgradeSteps || 0) + 1;
	}
	return true;
};

// Mulligan for starting hand indices
window.mulligan = function mulligan(indices) {
	if (!Array.isArray(indices) || indices.length === 0) return [];
	const unique = Array.from(new Set(indices.filter(i => Number.isInteger(i) && i >= 0 && i < window.DeckState.hand.length))).sort((a,b)=>b-a);
	const putBack = [];
	unique.forEach(idx => {
		const [card] = window.DeckState.hand.splice(idx, 1);
		if (card) {
			// Return to draw pile as deck-origin card
			const back = { ...card, origin: 'deck' };
			putBack.push(back);
		}
	});
	// Place back and reshuffle
	window.DeckState.drawPile = shuffleDeck(window.DeckState.drawPile.concat(putBack));
	// Draw new cards using starting distribution and mastery floor
	const deckIds = (SaveSystem.getDeckConfig && SaveSystem.getDeckConfig().cards) || [];
	const drawCount = unique.length;
	const drawn = [];
	for (let i = 0; i < drawCount; i++) {
		if (window.DeckState.drawPile.length === 0) break;
		const next = window.DeckState.drawPile.shift();
		if (!next) break;
		try {
			next.origin = 'deck';
			next._resolvedQuality = resolveQualityForCard(next.id, 1, { isStarting: true, isElite: false });
		} catch (e) {
			next._resolvedQuality = 'white';
		}
		window.DeckState.hand.push(next);
		drawn.push(next);
	}
	return drawn;
};

// Expose helper functions globally for UI access
window.getMaxUpgradeQualityForRoom = getMaxUpgradeQualityForRoom;
window.getRoomForQualityUnlock = getRoomForQualityUnlock;
window.canUpgradeAnyCard = canUpgradeAnyCard;
window.countUpgradeableCards = countUpgradeableCards;


