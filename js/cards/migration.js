// One-time migration from gear saves to starter card unlocks/deck (global)

window.runCardSystemMigration = function runCardSystemMigration(saveSystem) {
	try {
		const save = saveSystem.load();
		if (save.migratedFromGear === true) return false;

		// Initialize card fields if missing
		save.cardsUnlocked = Array.isArray(save.cardsUnlocked) ? save.cardsUnlocked : [];
		save.cardMastery = save.cardMastery || {};
		save.deckConfig = save.deckConfig || { cards: [], size: 20 };
		save.teamCardsUnlocked = Array.isArray(save.teamCardsUnlocked) ? save.teamCardsUnlocked : [];
		save.activeTeamCard = save.activeTeamCard || null;
		save.cardShards = Number.isFinite(save.cardShards) ? save.cardShards : 0;
		save.deckUpgrades = save.deckUpgrades || {
			handSize: 4,
			startingCards: 3,
			mulligans: 0,
			reserveSlots: 0,
			roomModifierCarrySlots: 3,
			cardCombinationUnlocked: false
		};
		save.roomModifierCollection = Array.isArray(save.roomModifierCollection) ? save.roomModifierCollection : [];

		// Map old gear presence to minimal starter unlocks (fallback if no gear available)
		// We don't parse detailed gear contents; just ensure the starter trio is present.
		const starterIds = ['precision_001', 'bulwark_001', 'velocity_001'];
		starterIds.forEach(id => {
			if (!save.cardsUnlocked.includes(id)) {
				save.cardsUnlocked.push(id);
			}
			if (save.cardMastery[id] === undefined) {
				save.cardMastery[id] = 0; // mastery 0
			}
		});

		// Starter deck contains the three starters by default
		save.deckConfig.cards = save.deckConfig.cards && save.deckConfig.cards.length > 0
			? save.deckConfig.cards
			: starterIds.slice();

		// Mark migration complete
		save.migratedFromGear = true;
		saveSystem.save(save);
		return true;
	} catch (e) {
		console.error('[CardMigration] Failed:', e);
		return false;
	}
}


