// Card pack generation (minimal scaffolding per spec)
// Generates a single reward after room clear: either card (from deck) or upgrade/shards

window.CardPacks = window.CardPacks || {};

function parseBandFromId(id) {
	if (!id) return null;
	const parts = String(id).split('_');
	const last = parts[parts.length - 1];
	const bands = ['white', 'green', 'blue', 'purple', 'orange'];
	return bands.includes(last) ? last : null;
}

function getModifierBonuses(modCard) {
	// Return { qualityShift, bonusCards, shards, minBand, ignoreCap }
	if (!modCard) return null;
	const band = modCard._resolvedQuality || parseBandFromId(modCard.id) || 'white';
	const bandOrder = ['white', 'green', 'blue', 'purple', 'orange'];
	const idx = Math.max(0, bandOrder.indexOf(band));
	const family = modCard.family || '';
	// Defaults
	let qualityShift = 0, bonusCards = 0, shards = 0, minBand = null, ignoreCap = false;
	const shifts = { white: 0.10, green: 0.15, blue: 0.20, purple: 0.25, orange: 0.30 };
	// Reduced bonus cards by 1 across the board
	const bonusMap = { white: 0, green: 0, blue: 1, purple: 1, orange: 2 };

	// Enemy modifiers (harder = better rewards)
	if (family === 'Elite Armor' || family === 'Swift Assault' || family === 'Volatile Spawn' || family === 'Shielded Brood') {
		qualityShift = shifts[band] || 0;
		bonusCards = bonusMap[band] || 0;
		// Add bonus shards based on quality (for shard/upgrade rewards)
		// White: +5, Green: +10, Blue: +15, Purple: +20, Orange: +30
		const shardBonusMap = { white: 5, green: 10, blue: 15, purple: 20, orange: 30 };
		shards += shardBonusMap[band] || 0;
		ignoreCap = true; // harder room, better rewards
	}
	if (family === 'Double Trouble') {
		// Epic only - guaranteed rare+, +50 shards, +2 bonus cards (reduced from 3)
		qualityShift = 0.50;
		bonusCards = 2;
		shards = 50;
		minBand = 'blue'; // guaranteed rare+
		ignoreCap = true;
	}

	// Economy modifiers
	if (family === 'Prism Tax') {
		qualityShift = [0.20, 0.30, 0.40, 0.50, 0.60][idx] || 0;
		// Reduced by 1: [0,0,1,1,2] instead of [1,1,2,2,3]
		bonusCards = [0, 0, 1, 1, 2][idx] || 0;
		if (band === 'purple') shards += 10;
		if (band === 'orange') shards += 25;
	}
	if (family === 'Scholar Sigil') {
		qualityShift = [0.10, 0.10, 0.15, 0.20, 0.25][idx] || 0;
		// Reduced by 1: [0,0,1,1,2] instead of [1,1,2,2,3]
		bonusCards = [0, 0, 1, 1, 2][idx] || 0;
	}
	if (family === 'Loot Surge') {
		// Reduced by 1-2: [0,1,2,3,4] instead of [1,2,3,4,5]
		bonusCards = [0, 1, 2, 3, 4][idx] || 0;
		qualityShift = [0.0, 0.10, 0.15, 0.20, 0.25][idx] || 0;
		if (band === 'purple' || band === 'orange') {
			minBand = 'blue'; // guaranteed rare
		}
		if (band === 'orange') shards += 25;
	}
	if (family === 'Shard Mine') {
		shards = [15, 25, 50][['green', 'blue', 'purple'].indexOf(band)] || 0;
		// Reduced by 1: [0,1,2] instead of [1,2,3]
		bonusCards = [0, 1, 2][['green', 'blue', 'purple'].indexOf(band)] || 0;
		if (band === 'blue') qualityShift = 0.10;
		if (band === 'purple') qualityShift = 0.20;
	}
	if (family === 'Mastery Boost') {
		// Rare only - all cards gain +1 quality band
		// Use special flag instead of qualityShift to ensure exact +1 upgrade
		qualityShift = 0; // Don't use shift - we'll upgrade directly
		ignoreCap = true;
	}

	// Room type modifiers (easier = no extra rewards, handled separately)
	// Rest Stop, Safe Passage, Treasure Cache, Elite Challenge, Boss Rush
	// These don't provide pack bonuses, they change room type directly

	// Special flag for Mastery Boost - upgrades all cards by +1 quality band
	const qualityUpgrade = (family === 'Mastery Boost');
	
	return { qualityShift, bonusCards, shards, minBand, ignoreCap, qualityUpgrade };
}

// Expose getModifierBonuses globally for UI components (after function is defined)
window.getModifierBonuses = getModifierBonuses;

function choosePackType(roomNumber, allowVariety = false) {
	// Check for special conditions first
	// Bonus Slot Pack: Very rare, appears once per run maximum
	if (typeof Game !== 'undefined' && !Game.bonusSlotRoomUsed) {
		// 5% chance to appear (very rare)
		if (Math.random() < 0.05 && roomNumber >= 10) {
			return 'Bonus Slot';
		}
	}

	// Safe Room: Guaranteed break every 6 rooms (6, 12, 18...)
	if (roomNumber % 6 === 0) {
		return 'Safe';
	}

	// Purification Pack: Rare, appears every 8-10 rooms (guaranteed if cursed)
	if (typeof Game !== 'undefined' && Game.hand && Array.isArray(Game.hand)) {
		const hasCurses = Game.hand.some(card => card.isCurse === true);
		if (hasCurses) {
			// If player has curses, higher chance to appear (guaranteed within 8 rooms)
			// Track last purification room
			if (!Game.lastPurificationRoom) Game.lastPurificationRoom = 0;
			const roomsSincePurification = roomNumber - Game.lastPurificationRoom;
			if (roomsSincePurification >= 8 || Math.random() < 0.3) {
				return 'Purification';
			}
		} else if (roomNumber % 9 === 0) {
			// Every 9 rooms if no curses
			return 'Purification';
		}
	}

	// Boss rooms are always Boss packs
	if (roomNumber % 10 === 0) return 'Boss';

	// If allowVariety is true, add randomization to pack types within a room
	// This creates variety between door options in the same room
	if (allowVariety) {
		// Calculate base probabilities that scale with room number
		// Early rooms: mostly Standard/Treasure
		// Mid rooms: mix of Standard/Treasure/Elite/Challenge
		// Late rooms: more Elite/Challenge
		const roomProgress = Math.min(roomNumber / 32, 1.0); // 0.0 to 1.0

		// Base pack type weights (scales with room progress)
		// Base pack type weights (scales with room progress)
		// Early rooms (1-3): Standard is very common (~80%)
		// Late rooms (32): Standard is rare (~20%)
		let standardWeight, treasureWeight, eliteWeight, challengeWeight, truncationWeight;

		if (roomNumber <= 3) {
			// Early game: mostly Standard
			standardWeight = 0.80;
			treasureWeight = 0.10;
			eliteWeight = 0.05;
			challengeWeight = 0.05;
			truncationWeight = 0.0;
		} else {
			// Progressive scaling from room 4 to 32
			// Standard: 0.80 -> 0.20
			// Treasure: 0.10 -> 0.25
			// Elite: 0.05 -> 0.30
			// Challenge: 0.05 -> 0.25
			const progress = Math.min((roomNumber - 3) / 29, 1.0); // 0.0 at room 3, 1.0 at room 32
			standardWeight = 0.80 - (progress * 0.60);
			treasureWeight = 0.10 + (progress * 0.15);
			eliteWeight = 0.05 + (progress * 0.25);
			challengeWeight = 0.05 + (progress * 0.20);
			truncationWeight = 0.05; // Small chance for Truncation packs
		}

		const weights = {
			'Standard': standardWeight,
			'Treasure': treasureWeight,
			'Elite': eliteWeight,
			'Challenge': challengeWeight,
			'Truncation': truncationWeight
		};

		// Still respect deterministic patterns but add variety
		// If room matches a pattern, 70% chance to use it, 30% chance to roll weighted
		const r = Math.random();

		if (roomNumber % 6 === 0) {
			// Challenge room pattern
			return (r < 0.7) ? 'Challenge' : weightedRandom(weights);
		}
		if (roomNumber % 4 === 0) {
			// Elite room pattern
			return (r < 0.7) ? 'Elite' : weightedRandom(weights);
		}
		if (roomNumber % 3 === 0) {
			// Treasure room pattern
			return (r < 0.7) ? 'Treasure' : weightedRandom(weights);
		}

		// Standard rooms: use weighted random
		return weightedRandom(weights);
	}

	// Original deterministic behavior (for backwards compatibility)
	if (roomNumber % 6 === 0) return 'Challenge';
	if (roomNumber % 4 === 0) return 'Elite';
	if (roomNumber % 3 === 0) return 'Treasure';
	return 'Standard';
}

// Helper function for weighted random selection
function weightedRandom(weights) {
	const total = Object.values(weights).reduce((sum, w) => sum + w, 0);
	let r = Math.random() * total;
	for (const [packType, weight] of Object.entries(weights)) {
		r -= weight;
		if (r <= 0) return packType;
	}
	return 'Standard'; // Fallback
}

function getPackBonuses(packType) {
	// Bonus cards are now rare instead of guaranteed
	// Returns { qualityShift, bonusCards, bonusCardChance, guaranteedRare, ignoreCap }
	switch (packType) {
		case 'Elite':
			// Elite: Higher quality cards (Green+), decent chance for bonus card
			return { qualityShift: 0.25, bonusCards: 1, bonusCardChance: 0.20, guaranteedRare: false, minBand: 'green', ignoreCap: true };
		case 'Treasure':
			// Treasure: Bonus shards guaranteed, small chance for bonus card
			return { qualityShift: 0.0, bonusCards: 1, bonusCardChance: 0.15, bonusShards: 25, guaranteedRare: false, ignoreCap: false };
		case 'Challenge':
			// Challenge: High risk, high reward - Guaranteed 2 bonus cards (3 cards total)
			return { qualityShift: 0.15, bonusCards: 2, bonusCardChance: 1.0, guaranteedRare: false, ignoreCap: true };
		case 'Boss':
			return { qualityShift: 0.30, bonusCards: 0, bonusCardChance: 0.0, guaranteedRare: true, ignoreCap: true };
		case 'Truncation':
			return { qualityShift: 0.0, bonusCards: 0, bonusCardChance: 0.0, guaranteedRare: false, ignoreCap: false };
		case 'Safe':
			return { qualityShift: 0.0, bonusCards: 0, bonusCardChance: 0.0, guaranteedRare: false, ignoreCap: false };
		case 'Purification':
			return { qualityShift: 0.0, bonusCards: 0, bonusCardChance: 0.0, guaranteedRare: false, ignoreCap: false };
		case 'Bonus Slot':
			return { qualityShift: 0.0, bonusCards: 0, bonusCardChance: 0.0, guaranteedRare: false, ignoreCap: false };
		default:
			return { qualityShift: 0.0, bonusCards: 0, bonusCardChance: 0.0, guaranteedRare: false, ignoreCap: false };
	}
}

function rollRewardType(packType) {
	const r = Math.random();
	switch (packType) {
		case 'Elite':
			// Elite: Balanced mix, slightly favored towards Upgrades/Cards
			if (r < 0.30) return 'Card';
			if (r < 0.70) return 'Upgrade';
			return 'Shard';
		case 'Treasure':
			// Treasure: Favors Shards (since it gives bonus shards) and Cards
			if (r < 0.35) return 'Card';
			if (r < 0.60) return 'Upgrade';
			return 'Shard';
		case 'Challenge':
			// Challenge: Favors Cards (high reward)
			if (r < 0.50) return 'Card';
			if (r < 0.75) return 'Upgrade';
			return 'Shard';
		case 'Standard':
		default:
			// Standard: Mostly Upgrades/Shards, rare Cards
			if (r < 0.15) return 'Card';
			if (r < 0.65) return 'Upgrade';
			return 'Shard';
	}
}

function getDeckIds() {
	if (typeof SaveSystem === 'undefined' || !SaveSystem.getDeckConfig) return [];
	const cfg = SaveSystem.getDeckConfig();
	return Array.isArray(cfg.cards) ? cfg.cards : [];
}

function drawCardFromDeckForPack(roomNumber, isElite, options = {}) {
	const ids = getDeckIds();
	if (ids.length === 0) return null;
	// Pick random deck card id
	const id = ids[Math.floor(Math.random() * ids.length)];
	// Look up definition
	if (!window.CardCatalog || !window.CardCatalog.getById) return null;
	const def = window.CardCatalog.getById(id);
	if (!def) return null;
	// Create instance with resolved quality (packs respect mastery cap unless elite with ignore; omitted here)
	const instance = { ...def, origin: 'found' };
	try {
		const ignoreCap = !!options.ignoreCap;
		const qualityShift = Number.isFinite(options.qualityShift) ? options.qualityShift : 0;
		const minBand = options.minBand || null;
		const q = (window.resolveQualityForCard)
			? window.resolveQualityForCard(def.id, roomNumber, { isStarting: false, isElite: !!isElite, ignoreCap, qualityShift, minBand })
			: 'white';
		instance._resolvedQuality = q;
	} catch (e) {
		instance._resolvedQuality = 'white';
	}
	return instance;
}

window.CardPacks.generateRoomClearReward = function generateRoomClearReward(roomNumber) {
	const packType = choosePackType(roomNumber || 1);
	const rewardType = rollRewardType(packType);
	if (rewardType === 'Card') {
		const isElite = (packType === 'Elite' || packType === 'Challenge');
		// Combine pack bonuses with next-room modifier bonuses (if present)
		const packBonuses = getPackBonuses(packType);
		const mod = (typeof Game !== 'undefined' && Game.nextRoomPackBonus) ? Game.nextRoomPackBonus : null;

		// Roll for bonus cards from pack (rare chance)
		let packBonusCards = 0;
		if (packBonuses.bonusCardChance && Math.random() < packBonuses.bonusCardChance) {
			packBonusCards = packBonuses.bonusCards || 0;
		}

		// Modifier bonus cards are always applied (they're special)
		const modifierBonusCards = (mod && mod.bonusCards) ? mod.bonusCards : 0;

		const combined = {
			qualityShift: (packBonuses.qualityShift || 0) + (mod && mod.qualityShift ? mod.qualityShift : 0),
			bonusCards: packBonusCards + modifierBonusCards,
			guaranteedRare: !!(packBonuses.guaranteedRare || (mod && mod.minBand === 'blue') || (typeof Game !== 'undefined' && Game.teamMinBand === 'blue')),
			ignoreCap: !!(packBonuses.ignoreCap || (mod && mod.ignoreCap))
		};
		// Apply team min band (e.g., Fortune's Favor → green minimum)
		let minBand = combined.guaranteedRare ? 'blue' : (packBonuses.minBand || null);
		if (!minBand && typeof Game !== 'undefined' && Game.teamMinBand) {
			minBand = Game.teamMinBand;
		}
		let card = drawCardFromDeckForPack(roomNumber, isElite, { ignoreCap: combined.ignoreCap, qualityShift: combined.qualityShift, minBand });

		// Apply Mastery Boost: Upgrade card quality by +1 band if modifier is active
		if (card && mod && mod.qualityUpgrade) {
			const qualityOrder = ['white', 'green', 'blue', 'purple', 'orange'];
			const currentQuality = card._resolvedQuality || 'white';
			const currentIdx = qualityOrder.indexOf(currentQuality);
			
			if (currentIdx >= 0 && currentIdx < qualityOrder.length - 1) {
				// Check if card has next quality band available
				const nextQuality = qualityOrder[currentIdx + 1];
				if (card.qualityBands && card.qualityBands[nextQuality]) {
					// Create new card instance to avoid modifying shared references
					card = { ...card };
					card._resolvedQuality = nextQuality;
					card._tempUpgradeSteps = (card._tempUpgradeSteps || 0) + 1;
					// Track that this quality band has been seen for this card
					if (typeof SaveSystem !== 'undefined' && SaveSystem.seeCardQualityBand && card.id) {
						SaveSystem.seeCardQualityBand(card.id, nextQuality);
					}
					// Track that this quality band has been seen for this card
					if (typeof SaveSystem !== 'undefined' && SaveSystem.seeCardQualityBand && card.id) {
						SaveSystem.seeCardQualityBand(card.id, nextQuality);
					}
					console.log(`[Mastery Boost] Upgraded ${card.name || card.family} from ${currentQuality} to ${nextQuality}`);
				}
			}
		}

		// Apply bonus shards from pack if any (e.g. Treasure pack)
		if (packBonuses.bonusShards && typeof SaveSystem !== 'undefined' && SaveSystem.addCardShards) {
			SaveSystem.addCardShards(packBonuses.bonusShards);
			console.log(`[Room Clear] Granted ${packBonuses.bonusShards} bonus shards from pack type: ${packType}`);
		}
		
		// Apply bonus shards from modifier (Shard Mine) if any
		// Note: We grant shards here so they're given when room is cleared
		if (mod && mod.shards && mod.shards > 0 && typeof SaveSystem !== 'undefined' && SaveSystem.addCardShards) {
			SaveSystem.addCardShards(mod.shards);
			console.log(`[Room Clear] Granted ${mod.shards} bonus shards from Shard Mine modifier`);
			// Clear shards from modifier so they're not granted multiple times
			mod.shards = 0;
		}

		return { packType, rewardType, card, bonuses: combined };
	}
	// Minimal upgrade: award shards as fallback
	let shards = packType === 'Challenge' ? 50 : packType === 'Elite' ? 25 : packType === 'Treasure' ? 35 : 15;

	// Apply bonus shards from pack if any (e.g. Treasure pack)
	const packBonuses = getPackBonuses(packType);
	if (packBonuses.bonusShards) {
		shards += packBonuses.bonusShards;
		if (typeof SaveSystem !== 'undefined' && SaveSystem.addCardShards) {
			// We add them to the returned shards amount, but we should also log/grant them if needed.
			// However, for non-card rewards, the 'shards' value is usually just added to player inventory by the caller.
			// But wait, generateRoomClearReward returns a reward object. The caller handles it.
			// If rewardType is 'Shard', the caller adds 'shards'.
			// If rewardType is 'Upgrade', the caller might not add 'shards' unless it's in payload.
			// Let's just add it to the returned shards value for simplicity, assuming caller handles 'shards' property.
			console.log(`[Room Clear] Added ${packBonuses.bonusShards} bonus shards to fallback reward for pack type: ${packType}`);
		}
	}
	
	// Apply bonus shards from modifier (Shard Mine) if any
	const modShard = (typeof Game !== 'undefined' && Game.nextRoomPackBonus) ? Game.nextRoomPackBonus : null;
	if (modShard && modShard.shards && modShard.shards > 0) {
		shards += modShard.shards;
		console.log(`[Room Clear] Added ${modShard.shards} bonus shards from Shard Mine modifier to shard reward`);
		// Clear shards from modifier so they're not granted multiple times
		modShard.shards = 0;
	}

	return { packType, rewardType, shards };
};

// Generate multiple door options with previews (no RNG protection yet)
window.CardPacks.generateDoorOptions = function generateDoorOptions(roomNumber, count) {
	// Get player state for smart option generation
	const hand = (typeof Game !== 'undefined' && Game.hand && Array.isArray(Game.hand)) ? Game.hand : [];
	const maxHandSize = (typeof SaveSystem !== 'undefined' && SaveSystem.getDeckConfig)
		? (SaveSystem.getDeckConfig().deckUpgrades?.handSize || 4)
		: 4;
	const handSlotsAvailable = maxHandSize - hand.length;
	const handIsFull = handSlotsAvailable <= 0;

	// Count upgradeable cards
	const currentRoomNumber = roomNumber || (typeof Game !== 'undefined' ? Game.roomNumber : 1);
	const upgradeableCount = typeof window.countUpgradeableCards === 'function'
		? window.countUpgradeableCards(currentRoomNumber)
		: (typeof window.canUpgradeAnyCard === 'function' && window.canUpgradeAnyCard(currentRoomNumber) ? 1 : 0);

	// Check if room reward is an upgrade (will be picked up before door selection)
	const roomRewardIsUpgrade = typeof window !== 'undefined' && window.selectedDoorReward
		&& window.selectedDoorReward.rewardType === 'Upgrade'
		&& window.selectedDoorReward.payload
		&& window.selectedDoorReward.payload.upgrade;
	const canUpgrade = upgradeableCount >= (roomRewardIsUpgrade ? 2 : 1);

	// RNG protection: ensure after 4 consecutive non-card packs, include at least one Card option;
	// after 6, force a full Card pack.
	let nonCardStreak = (typeof Game !== 'undefined' && Number.isFinite(Game.nonCardPackStreak)) ? Game.nonCardPackStreak : 0;

	// Smart card limiting: Calculate target cards for this room to achieve 0.8-1 avg per room
	// Early game gets more cards to build deck, late game gets fewer
	let targetCards, maxCards;
	if (roomNumber <= 5) {
		// Rooms 1-5: 80% chance of 1 card, 20% chance of 2 cards (avg 1.2)
		targetCards = Math.random() < 0.80 ? 1 : 2;
		maxCards = 2;
	} else if (roomNumber <= 10) {
		// Rooms 6-10: Always 1 card (avg 1.0)
		targetCards = 1;
		maxCards = 1;
	} else if (roomNumber <= 15) {
		// Rooms 11-15: 80% chance of 1 card, 20% chance of 0 cards (avg 0.8)
		targetCards = Math.random() < 0.80 ? 1 : 0;
		maxCards = 1;
	} else {
		// Rooms 16+: 70% chance of 1 card, 30% chance of 0 cards (avg 0.7)
		targetCards = Math.random() < 0.70 ? 1 : 0;
		maxCards = 1;
	}
	let cardsGenerated = 0;

	const options = [];
	const usedPackTypes = new Set(); // Track pack types to ensure variety
	const usedRewardTypes = new Set(); // Track reward types to ensure variety
	const usedCards = new Set(); // Track card IDs to avoid duplicates
	const usedShardAmounts = new Set(); // Track shard amounts to avoid duplicates

	// Generate options with variety constraints
	for (let i = 0; i < count; i++) {
		// Choose pack type with variety (allow different pack types in same room)
		let packType;
		let attempts = 0;
		do {
			packType = choosePackType(roomNumber || 1, true); // Enable variety mode
			attempts++;
			// Allow same pack type if we've tried too many times (rare edge case)
		} while (usedPackTypes.has(packType) && attempts < 10 && count > 1);
		usedPackTypes.add(packType);

		// Determine reward type with smart constraints
		let rewardType;

		// Smart card limiting: Force first option to Card if we have a target >= 1
		// This ensures we meet our card target for the room
		if (i === 0 && targetCards >= 1 && !handIsFull) {
			rewardType = 'Card';
		} else {
			rewardType = rollRewardType(packType);

			// Enforce max cards limit - prevent additional cards if we've hit the max
			if (rewardType === 'Card' && cardsGenerated >= maxCards) {
				rewardType = canUpgrade ? 'Upgrade' : 'Shard';
			}
		}

		// Apply streak rules on last option to guarantee inclusion (RNG protection)
		const isLast = (i === count - 1);
		if (nonCardStreak >= 5) {
			rewardType = 'Card'; // After 6-1 = 5 completed non-cards, next option forced Card
			// Override card limit for RNG protection
		} else if (nonCardStreak >= 3 && isLast) {
			// After 4-1 = 3 completed, ensure at least one Card present
			if (!options.some(o => o.rewardType === 'Card')) {
				rewardType = 'Card';
				// Override card limit for RNG protection
			}
		}

		// Smart constraints based on player state
		// If hand is full, limit card options (max 1-2, prefer 1)
		if (rewardType === 'Card' && handIsFull) {
			const cardOptionsCount = options.filter(o => o.rewardType === 'Card').length;
			// If we already have 1-2 card options and hand is full, prefer other types
			if (cardOptionsCount >= (count === 3 ? 1 : 0)) {
				// Only allow if we need it for streak protection
				if (!(nonCardStreak >= 3 && isLast && !options.some(o => o.rewardType === 'Card'))) {
					// Prefer Upgrade or Shard instead
					rewardType = canUpgrade ? 'Upgrade' : 'Shard';
				}
			}
		}

		// If can't upgrade, avoid upgrade options (unless forced)
		if (rewardType === 'Upgrade' && !canUpgrade) {
			// Prefer Card (if slots available) or Shard
			rewardType = (!handIsFull) ? 'Card' : 'Shard';
		}

		// Ensure variety: never all 3 same reward type
		if (isLast && count === 3) {
			const rewardTypeCounts = {};
			options.forEach(o => {
				rewardTypeCounts[o.rewardType] = (rewardTypeCounts[o.rewardType] || 0) + 1;
			});
			// If first two are same type, force third to be different
			if (rewardTypeCounts[rewardType] >= 2) {
				// Find a different type
				const availableTypes = ['Card', 'Upgrade', 'Shard'].filter(t => {
					if (t === 'Card' && handIsFull) return false;
					if (t === 'Upgrade' && !canUpgrade) return false;
					return t !== rewardType;
				});
				if (availableTypes.length > 0) {
					rewardType = availableTypes[Math.floor(Math.random() * availableTypes.length)];
				}
			}
		}
		let preview = [];
		let payload = null;
		if (rewardType === 'Card') {
			const isElite = (packType === 'Elite' || packType === 'Challenge');
			// Combine pack + next-room modifier bonuses for preview and generation
			const base = getPackBonuses(packType);
			const mod = (typeof Game !== 'undefined' && Game.nextRoomPackBonus) ? Game.nextRoomPackBonus : null;

			// Roll for bonus cards from pack (rare chance)
			let packBonusCards = 0;
			if (base.bonusCardChance && Math.random() < base.bonusCardChance) {
				packBonusCards = base.bonusCards || 0;
			}

			// Modifier bonus cards are always applied (they're special)
			const modifierBonusCards = (mod && mod.bonusCards) ? mod.bonusCards : 0;

			const bonuses = {
				qualityShift: (base.qualityShift || 0) + (mod && mod.qualityShift ? mod.qualityShift : 0),
				bonusCards: packBonusCards + modifierBonusCards,
				guaranteedRare: !!(base.guaranteedRare || (mod && mod.minBand === 'blue') || (typeof Game !== 'undefined' && Game.teamMinBand === 'blue')),
				ignoreCap: !!(base.ignoreCap || (mod && mod.ignoreCap))
			};
			let minBand = bonuses.guaranteedRare ? 'blue' : null;
			if (!minBand && typeof Game !== 'undefined' && Game.teamMinBand) {
				minBand = Game.teamMinBand;
			}

			// Ensure card variety: never show 3 identical cards
			let card;
			let cardAttempts = 0;
			do {
				card = drawCardFromDeckForPack(roomNumber, isElite, { ignoreCap: bonuses.ignoreCap, qualityShift: bonuses.qualityShift, minBand });
				cardAttempts++;
				// If we've tried many times and still get duplicates, allow it (rare edge case with small deck)
			} while (card && usedCards.has(card.id) && cardAttempts < 20);

			// Apply Mastery Boost: Upgrade card quality by +1 band if modifier is active
			if (card && mod && mod.qualityUpgrade) {
				const qualityOrder = ['white', 'green', 'blue', 'purple', 'orange'];
				const currentQuality = card._resolvedQuality || 'white';
				const currentIdx = qualityOrder.indexOf(currentQuality);
				
				if (currentIdx >= 0 && currentIdx < qualityOrder.length - 1) {
					// Check if card has next quality band available
					const nextQuality = qualityOrder[currentIdx + 1];
					if (card.qualityBands && card.qualityBands[nextQuality]) {
						// Create new card instance to avoid modifying shared references
						card = { ...card };
						card._resolvedQuality = nextQuality;
						card._tempUpgradeSteps = (card._tempUpgradeSteps || 0) + 1;
						console.log(`[Mastery Boost] Upgraded ${card.name || card.family} from ${currentQuality} to ${nextQuality}`);
					}
				}
			}

			if (card) {
				usedCards.add(card.id);
			}

			// Boss mastery unlock indicator: if packType is Boss, compute unlockLevel
			let bossUnlock = null;
			if (packType === 'Boss' && card && typeof SaveSystem !== 'undefined' && SaveSystem.getCardMastery) {
				const current = SaveSystem.getCardMastery(card.id) || 0;
				// Boss drops ignore cap by +1 minimum; unlock limited to +1 from current
				const dropBandToLevel = { white: 0, green: 1, blue: 2, purple: 3, orange: 4 };
				const dropLevel = dropBandToLevel[card._resolvedQuality || 'white'] || 0;
				const targetUnlock = Math.min(current + 1, dropLevel);
				if (targetUnlock > current) {
					bossUnlock = { unlockLevel: targetUnlock };
				}
			}
			payload = { card, bonuses };
			if (card) {
				preview.push(`${card.name}`);
				if (bonuses.bonusCards) preview.push(`+${bonuses.bonusCards} bonus card(s)`);
				if (bonuses.guaranteedRare) preview.push('Guaranteed rare+');
			}
			options.push({ packType, rewardType, preview, payload, bossUnlock });
			cardsGenerated++; // Track cards generated for smart limiting
			continue;
		} else if (rewardType === 'Shard') {
			// Shard reward (from rollRewardType)
			// Ensure shard variety: never show 3 identical shard amounts
			let shards;
			let shardAttempts = 0;
			do {
				shards = packType === 'Challenge' ? 50 : packType === 'Elite' ? 25 : packType === 'Treasure' ? 35 : 15;
				shardAttempts++;
				// If we've tried many times, allow slight variation
				if (shardAttempts > 5 && usedShardAmounts.has(shards)) {
					// Add small random variation to make it different
					shards += Math.floor(Math.random() * 5) - 2; // -2 to +2 variation
					shards = Math.max(10, shards); // Minimum 10 shards
				}
			} while (usedShardAmounts.has(shards) && shardAttempts < 10);
			usedShardAmounts.add(shards);
			
			// Add bonus shards from modifier (Shard Mine) if any
			if (mod && mod.shards && mod.shards > 0) {
				shards += mod.shards;
			}
			
			payload = { shards };
			preview.push(`${shards} shards`);
		} else {
			// Handle special pack types
			if (packType === 'Truncation') {
				// Truncation pack: Utility reward (Health restore + Enemy Reduction)
				payload = { utility: 'truncation' };
				preview.push('Health restore (50% max HP)');
				preview.push('Truncation: -50% Enemy HP, -20% Enemies');
				options.push({ packType, rewardType: 'Utility', preview, payload });
				continue;
			} else if (packType === 'Safe') {
				// Safe pack: Utility reward (Health restore + No Enemies)
				payload = { utility: 'safe' };
				preview.push('Safe Room - No Enemies');
				preview.push('Health restore (50% max HP)');
				options.push({ packType, rewardType: 'Utility', preview, payload });
				continue;
			} else if (packType === 'Purification') {
				// Purification pack: Remove curse or shards
				payload = { utility: 'purification' };
				preview.push('🔮 Remove one curse');
				preview.push('OR +40 shards (if no curses)');
				options.push({ packType, rewardType: 'Utility', preview, payload });
				continue;
			} else if (packType === 'Bonus Slot') {
				// Bonus slot pack: Utility reward (hand slot, shards)
				payload = { utility: 'bonus_slot' };
				preview.push('+1 hand slot for rest of run');
				preview.push('+15 shards');
				options.push({ packType, rewardType: 'Utility', preview, payload });
				continue;
			} else {
				// Upgrade reward (from rollRewardType)
				payload = { upgrade: true };
				preview.push('+1 quality to a hand card');

				// Differentiate Treasure Upgrade: Show bonus shards explicitly
				if (packType === 'Treasure') {
					const packBonuses = getPackBonuses(packType);
					if (packBonuses.bonusShards) {
						payload.bonusShards = packBonuses.bonusShards;
						preview.push(`+${packBonuses.bonusShards} Bonus Shards`);
					}
				}
			}
		}
		options.push({ packType, rewardType, preview, payload });
	}
	// Update streak based on presence of any Card options
	const hasCard = options.some(o => o.rewardType === 'Card');
	if (typeof Game !== 'undefined') {
		Game.nonCardPackStreak = hasCard ? 0 : ((Game.nonCardPackStreak || 0) + 1);
		// Clear next-room pack bonus after options are generated (consumed)
		if (Game.nextRoomPackBonus) {
			Game.nextRoomPackBonus = null;
		}
	}
	// Validate upgrade options - check if player can actually upgrade
	// IMPORTANT: Account for room reward upgrade that will be picked up before door selection
	// (currentRoomNumber, roomRewardIsUpgrade, and upgradeableCount already declared at top of function)

	// If room reward is an upgrade, it will use one upgrade slot
	// So door upgrade options need at least 2 upgradeable cards (1 for room reward, 1 for door option)
	const requiredUpgradeableCount = roomRewardIsUpgrade ? 2 : 1;

	for (const opt of options) {
		if (opt.rewardType === 'Upgrade' && opt.payload && opt.payload.upgrade) {
			const canUpgrade = upgradeableCount >= requiredUpgradeableCount;

			opt.canUpgrade = canUpgrade;
			if (!canUpgrade) {
				const maxQuality = typeof window.getMaxUpgradeQualityForRoom === 'function'
					? window.getMaxUpgradeQualityForRoom(currentRoomNumber)
					: 'orange';
				if (roomRewardIsUpgrade) {
					opt.upgradeWarning = `Room reward is an upgrade. After using it, no cards will be upgradeable (max ${maxQuality} for Room ${currentRoomNumber}). Choose a different reward.`;
				} else {
					opt.upgradeWarning = `All cards are already at maximum upgrade quality (${maxQuality}) for Room ${currentRoomNumber}. Choose a different reward.`;
				}
			}
		}
	}
	return options;
};

// Re-validate door options after hand changes (e.g., card swap)
window.CardPacks.revalidateDoorOptions = function revalidateDoorOptions() {
	if (typeof Game === 'undefined' || !Game.doorOptions || !Array.isArray(Game.doorOptions)) return;

	const currentRoomNumber = (typeof Game !== 'undefined' && Game.roomNumber) ? Game.roomNumber : 1;

	// Check if there's a room reward that's an upgrade (from previous room's door selection)
	const roomRewardIsUpgrade = typeof window !== 'undefined' && window.selectedDoorReward
		&& window.selectedDoorReward.rewardType === 'Upgrade'
		&& window.selectedDoorReward.payload
		&& window.selectedDoorReward.payload.upgrade;

	// Count how many cards can be upgraded
	const upgradeableCount = typeof window.countUpgradeableCards === 'function'
		? window.countUpgradeableCards(currentRoomNumber)
		: (typeof window.canUpgradeAnyCard === 'function' && window.canUpgradeAnyCard(currentRoomNumber) ? 1 : 0);

	// If room reward is an upgrade, it will use one upgrade slot
	// So door upgrade options need at least 2 upgradeable cards (1 for room reward, 1 for door option)
	const requiredUpgradeableCount = roomRewardIsUpgrade ? 2 : 1;

	for (const opt of Game.doorOptions) {
		if (opt.rewardType === 'Upgrade' && opt.payload && opt.payload.upgrade) {
			const canUpgrade = upgradeableCount >= requiredUpgradeableCount;

			opt.canUpgrade = canUpgrade;
			if (!canUpgrade) {
				const maxQuality = typeof window.getMaxUpgradeQualityForRoom === 'function'
					? window.getMaxUpgradeQualityForRoom(currentRoomNumber)
					: 'orange';
				if (roomRewardIsUpgrade) {
					opt.upgradeWarning = `Room reward is an upgrade. After using it, no cards will be upgradeable (max ${maxQuality} for Room ${currentRoomNumber}). Choose a different reward.`;
				} else {
					opt.upgradeWarning = `All cards are already at maximum upgrade quality (${maxQuality}) for Room ${currentRoomNumber}. Choose a different reward.`;
				}
			} else {
				// Clear warning if upgrade is now possible
				opt.upgradeWarning = undefined;
			}
		}
	}
};

// Apply selected door option
window.CardPacks.applyDoorOption = function applyDoorOption(option) {
	if (!option) return false;

	// Handle utility rewards (Rest, Purification, Bonus Slot)
	if (option.rewardType === 'Utility' && option.payload && option.payload.utility) {
		console.log('[DEBUG applyDoorOption] Handling Utility reward');
		// Store pack type for next room generation
		if (typeof Game !== 'undefined' && option.packType) {
			Game.nextRoomPackType = option.packType;
		}
		// Utility rewards are handled on room clear, just store the pack type
		return true;
	}

	console.log('[DEBUG applyDoorOption] Checking Card reward condition');
	console.log('[DEBUG applyDoorOption] rewardType:', option.rewardType);
	console.log('[DEBUG applyDoorOption] payload:', option.payload);
	console.log('[DEBUG applyDoorOption] payload.card:', option.payload ? option.payload.card : 'no payload');
	if (option.rewardType === 'Card' && option.payload && option.payload.card) {
		console.log('[DEBUG applyDoorOption] Card reward detected, processing...');
		// Track boss unlock banner (visual minimal via console + flag)
		if (option.bossUnlock && typeof Game !== 'undefined') {
			const cardName = option.payload.card.name || option.payload.card.family || 'Card';
			Game.lastBossUnlock = { level: option.bossUnlock.unlockLevel, cardName };
			// Fire a transient HUD banner (3 seconds)
			Game.bossUnlockBanner = {
				text: `Mastery ${option.bossUnlock.unlockLevel} Unlocked for ${cardName}!`,
				until: Date.now() + 3000
			};
			// Show toast notification for boss mastery unlock
			if (typeof window.showToast === 'function') {
				window.showToast(`Mastery ${option.bossUnlock.unlockLevel} Unlocked for ${cardName}!`, 3500);
			}
			// Apply save unlock if needed
			if (typeof SaveSystem !== 'undefined' && SaveSystem.setCardMastery) {
				const current = SaveSystem.getCardMastery(option.payload.card.id) || 0;
				if (option.bossUnlock.unlockLevel > current) {
					SaveSystem.setCardMastery(option.payload.card.id, option.bossUnlock.unlockLevel);
				}
			}
		}
		// Drop main card and bonus cards to ground (pickup flow)
		const centerX = (typeof Game !== 'undefined' && Game.player) ? Game.player.x : 0;
		const centerY = (typeof Game !== 'undefined' && Game.player) ? Game.player.y : 0;
		console.log('[DEBUG applyDoorOption] Dropping card at:', centerX, centerY);
		console.log('[DEBUG applyDoorOption] CardGround available:', typeof CardGround !== 'undefined');
		console.log('[DEBUG applyDoorOption] CardGround.dropAt available:', typeof CardGround !== 'undefined' && typeof CardGround.dropAt === 'function');
		if (typeof CardGround !== 'undefined' && CardGround.dropAt) {
			console.log('[DEBUG applyDoorOption] Calling CardGround.dropAt');
			CardGround.dropAt(centerX + 30, centerY, option.payload.card);
			console.log('[DEBUG applyDoorOption] CardGround.dropAt completed');
		} else if (typeof addToHand === 'function') {
			console.log('[DEBUG applyDoorOption] CardGround not available, using addToHand');
			addToHand(option.payload.card);
		} else {
			console.error('[DEBUG applyDoorOption] ERROR: Neither CardGround.dropAt nor addToHand available!');
		}
		// Apply effective bonuses (pack + modifier)
		const effBonuses = option.payload.bonuses || {};
		if (effBonuses.bonusCards > 0) {
			for (let i = 0; i < effBonuses.bonusCards; i++) {
				const isElite = (option.packType === 'Elite' || option.packType === 'Challenge');
				const base = getPackBonuses(option.packType);
				const extra = drawCardFromDeckForPack((typeof Game !== 'undefined' ? Game.roomNumber : 1), isElite, { ignoreCap: effBonuses.ignoreCap || base.ignoreCap, qualityShift: effBonuses.qualityShift, minBand: effBonuses.guaranteedRare ? 'blue' : null });
				if (extra) {
					if (typeof CardGround !== 'undefined' && CardGround.dropAt) {
						const offset = (i + 2) * 26;
						CardGround.dropAt(centerX + offset, centerY, extra);
					} else if (typeof addToHand === 'function') {
						addToHand(extra);
					}
				}
			}
		}
		// If modifier adds bonus shards to this reward, grant them now (when room is cleared)
		if (option.payload.bonusShards && typeof SaveSystem !== 'undefined' && SaveSystem.addCardShards) {
			SaveSystem.addCardShards(option.payload.bonusShards);
			console.log(`[Room Clear] Granted ${option.payload.bonusShards} bonus shards from modifier`);
		}
		// Also check modBonuses.shards (legacy support)
		if (option.payload.modBonuses && option.payload.modBonuses.shards && typeof SaveSystem !== 'undefined' && SaveSystem.addCardShards) {
			SaveSystem.addCardShards(option.payload.modBonuses.shards);
			console.log(`[Room Clear] Granted ${option.payload.modBonuses.shards} bonus shards from modifier (legacy)`);
		}
		// Store pack type for next room generation
		if (typeof Game !== 'undefined' && option.packType) {
			Game.nextRoomPackType = option.packType;
		}

		// Consume selected modifier and consolidate into Game.nextRoomModifiers
		if (typeof Game !== 'undefined' && Game.selectedRoomModifier) {
			// Compute and store next-room bonuses/effects from the selected room modifier
			const modBonuses = getModifierBonuses(Game.selectedRoomModifier) || {};
			// Persist pack-related bonuses for next room's rewards
			Game.nextRoomPackBonus = {
				qualityShift: modBonuses.qualityShift || 0,
				bonusCards: modBonuses.bonusCards || 0,
				minBand: modBonuses.minBand || null,
				ignoreCap: !!modBonuses.ignoreCap,
				qualityUpgrade: !!modBonuses.qualityUpgrade, // Mastery Boost flag
				shards: modBonuses.shards || 0 // Shard Mine shards
			};
			// Consolidate all room modifier effects into Game.nextRoomModifiers
			const fam = Game.selectedRoomModifier.family || '';
			const qBand = Game.selectedRoomModifier._resolvedQuality || parseBandFromId(Game.selectedRoomModifier.id) || 'white';
			// Map quality to percent for supported modifiers
			const qToVal = { white: 0.10, green: 0.20, blue: 0.30, purple: 0.40, orange: 0.50 };
			const qToValExplosion = { white: 0.20, green: 0.30, blue: 0.40, purple: 0.50, orange: 0.60 };
			const qToValShield = { white: 0.10, green: 0.20, blue: 0.30, purple: 0.40, orange: 0.50 };
			let hpPct = 0, speedPct = 0, explosionChance = 0, shieldChance = 0, doubleEnemies = false;
			let currencyBoost = 0, xpBoost = 0;
			let roomTypeOverride = null; // For modifiers that change room type directly

			if (fam === 'Elite Armor') hpPct = qToVal[qBand] || 0;
			if (fam === 'Swift Assault') speedPct = qToVal[qBand] || 0;
			if (fam === 'Volatile Spawn') explosionChance = qToValExplosion[qBand] || 0;
			if (fam === 'Shielded Brood') shieldChance = qToValShield[qBand] || 0;
			if (fam === 'Double Trouble') doubleEnemies = true;
			if (fam === 'Prism Tax') currencyBoost = [0.20, 0.30, 0.40, 0.50, 0.60][['white', 'green', 'blue', 'purple', 'orange'].indexOf(qBand)] || 0;
			if (fam === 'Scholar Sigil') xpBoost = [0.25, 0.35, 0.45, 0.55, 0.70][['white', 'green', 'blue', 'purple', 'orange'].indexOf(qBand)] || 0;

			// Room type modifiers that override pack type
			if (fam === 'Rest Stop') roomTypeOverride = 'truncation'; // Legacy support or rename modifier? Let's map to truncation for now if modifier exists
			if (fam === 'Safe Passage') roomTypeOverride = 'safe';
			if (fam === 'Treasure Cache') roomTypeOverride = 'treasure';
			if (fam === 'Elite Challenge') roomTypeOverride = 'elite';
			if (fam === 'Boss Rush') {
				// Special: Skip to next boss room
				// This needs special handling - find next boss room number
				const currentRoom = (typeof Game !== 'undefined' && Game.roomNumber) ? Game.roomNumber : 1;
				const bossRooms = [12, 22, 32];
				const nextBoss = bossRooms.find(r => r > currentRoom);
				if (nextBoss) {
					// Store boss room number to skip to
					Game.bossRushTargetRoom = nextBoss;
					roomTypeOverride = 'boss';
				}
			}

			// Store consolidated modifiers
			Game.nextRoomModifiers = {
				hpPct,
				speedPct,
				explosionChance,
				shieldChance,
				doubleEnemies,
				currencyBoost,
				xpBoost,
				roomTypeOverride
			};

			// If room type override is set, use it instead of pack type
			if (roomTypeOverride && typeof Game !== 'undefined') {
				// This will be checked in generateRoom()
				Game.nextRoomTypeOverride = roomTypeOverride;
			}

			// Keep legacy support for existing code
			Game.nextRoomEnemyMod = { hpPct, speedPct };

			// Remove modifier from run inventory (consumable - used once per run)
			// Note: Modifier may have already been removed when confirmed in modal, so this is safe to call
			if (typeof Game !== 'undefined' && Array.isArray(Game.roomModifierInventory)) {
				const idx = Game.roomModifierInventory.findIndex(m => m && m.id === Game.selectedRoomModifier.id);
				if (idx >= 0) {
					Game.roomModifierInventory.splice(idx, 1);
					console.log(`[Room Modifier] Consumed ${Game.selectedRoomModifier.family || Game.selectedRoomModifier.name} from run inventory`);
				}
			}
			// Also check DeckState.roomModifierInventory
			if (typeof DeckState !== 'undefined' && Array.isArray(DeckState.roomModifierInventory)) {
				const idx = DeckState.roomModifierInventory.findIndex(m => m && m.id === Game.selectedRoomModifier.id);
				if (idx >= 0) {
					DeckState.roomModifierInventory.splice(idx, 1);
					console.log(`[Room Modifier] Consumed ${Game.selectedRoomModifier.family || Game.selectedRoomModifier.name} from DeckState inventory`);
				}
			}
			// Also remove from collection (one-time use, don't persist)
			// Note: Modifier may have already been removed when confirmed in modal, so this is safe to call
			if (typeof SaveSystem !== 'undefined') {
				const save = SaveSystem.load();
				if (Array.isArray(save.roomModifierCollection)) {
					const idx = save.roomModifierCollection.findIndex(m => m.id === Game.selectedRoomModifier.id);
					if (idx >= 0) {
						save.roomModifierCollection.splice(idx, 1);
						SaveSystem.save(save);
						console.log(`[Room Modifier] Removed ${Game.selectedRoomModifier.family || Game.selectedRoomModifier.name} from collection (consumed)`);
					}
				}
			}
			Game.selectedRoomModifier = null;
		} else if (typeof Game !== 'undefined') {
			// Initialize empty modifiers if no modifier selected
			Game.nextRoomModifiers = {
				hpPct: 0,
				speedPct: 0,
				explosionChance: 0,
				shieldChance: 0,
				doubleEnemies: false,
				currencyBoost: 0,
				xpBoost: 0
			};
		}
		return true;
	}
	if (option.rewardType === 'Upgrade' && option.payload && option.payload.upgrade) {
		// Store pack type for next room generation
		if (typeof Game !== 'undefined' && option.packType) {
			Game.nextRoomPackType = option.packType;
		}
		// Grant bonus shards from modifier if present (when room is cleared)
		if (option.payload.bonusShards && typeof SaveSystem !== 'undefined' && SaveSystem.addCardShards) {
			SaveSystem.addCardShards(option.payload.bonusShards);
			console.log(`[Room Clear] Adding ${option.payload.bonusShards} bonus shards to upgrade reward`);
		}
		// Grant Shard Mine shards if modifier is active
		const modUpgrade = (typeof Game !== 'undefined' && Game.nextRoomPackBonus) ? Game.nextRoomPackBonus : null;
		if (modUpgrade && modUpgrade.shards && modUpgrade.shards > 0 && typeof SaveSystem !== 'undefined' && SaveSystem.addCardShards) {
			SaveSystem.addCardShards(modUpgrade.shards);
			console.log(`[Room Clear] Granted ${modUpgrade.shards} bonus shards from Shard Mine modifier (Upgrade reward)`);
			modUpgrade.shards = 0; // Clear so not granted again
		}
		// Defer to upgrade selection
		if (typeof Game !== 'undefined') {
			Game.awaitingUpgradeSelection = true;
			Game.pendingUpgrade = { type: 'quality_plus_one' };
			return true;
		}
		return false;
	}
	if (option.rewardType === 'Upgrade' && option.payload && Number.isFinite(option.payload.shards) && typeof SaveSystem !== 'undefined' && SaveSystem.addCardShards) {
		// Store pack type for next room generation
		if (typeof Game !== 'undefined' && option.packType) {
			Game.nextRoomPackType = option.packType;
		}
		let totalShards = option.payload.shards;
		// Add bonus shards from modifier if present (when room is cleared)
		if (option.payload.bonusShards) {
			totalShards += option.payload.bonusShards;
			console.log(`[Room Clear] Adding ${option.payload.bonusShards} bonus shards to upgrade reward`);
		}
		SaveSystem.addCardShards(totalShards);
		return true;
	}
	// Handle shard rewards (when rewardType is 'Shard' or payload has shards but not upgrade)
	// Note: Shard rewards are granted when room is cleared, not when door is selected
	if (option.rewardType === 'Shard' || (option.payload && Number.isFinite(option.payload.shards) && !option.payload.upgrade)) {
		// Store pack type for next room generation
		if (typeof Game !== 'undefined' && option.packType) {
			Game.nextRoomPackType = option.packType;
		}
		if (option.payload && Number.isFinite(option.payload.shards) && typeof SaveSystem !== 'undefined' && SaveSystem.addCardShards) {
			let totalShards = option.payload.shards;
			// Add bonus shards from modifier if present
			if (option.payload.bonusShards) {
				totalShards += option.payload.bonusShards;
				console.log(`[Room Clear] Adding ${option.payload.bonusShards} bonus shards to shard reward`);
			}
			SaveSystem.addCardShards(totalShards);
			console.log(`[Room Clear] Granted ${totalShards} shards (${option.payload.shards} base + ${option.payload.bonusShards || 0} bonus)`);
			return true;
		}
	}
	return false;
};


