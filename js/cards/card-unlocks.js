// Card unlock system - checks unlock conditions and unlocks cards

(function () {
	// Lifetime stats stored in save system
	function getLifetimeStats() {
		if (typeof SaveSystem === 'undefined' || !SaveSystem.load) return {};
		const save = SaveSystem.load();
		return save.lifetimeStats || {
			totalRoomsCleared: 0,
			totalDamageDealt: 0,
			totalKills: 0,
			successfulRuns: 0,
			totalDodges: 0,
			totalAbilityUses: 0,
			totalBlocks: 0,
			totalReflectedDamage: 0,
			totalRevives: 0,
			maxRoomsInOneRun: 0,
			totalBackstabDamage: 0,
			totalBeamDamage: 0,
			totalStuns: 0,
			totalDeaths: 0,
			totalNearDeathExperiences: 0
		};
	}

	function setLifetimeStats(stats) {
		if (typeof SaveSystem === 'undefined' || !SaveSystem.load || !SaveSystem.save) return;
		const save = SaveSystem.load();
		save.lifetimeStats = stats;
		SaveSystem.save(save);
	}

	function updateLifetimeStats(updates) {
		const stats = getLifetimeStats();
		Object.keys(updates).forEach(key => {
			stats[key] = (stats[key] || 0) + (updates[key] || 0);
		});
		setLifetimeStats(stats);
		return stats;
	}

	// Check if a card's unlock condition is met
	function checkUnlockCondition(card) {
		if (!card || !card.unlockCondition) return false;
		
		const condition = card.unlockCondition;
		const stats = getLifetimeStats();
		const unlocked = typeof SaveSystem !== 'undefined' && SaveSystem.getCardsUnlocked ? SaveSystem.getCardsUnlocked() : [];
		
		// Already unlocked
		if (unlocked.includes(card.id)) return false;
		
		// Starter cards are always unlocked
		if (condition.type === 'starter') return true;
		
		// Room milestone
		if (condition.type === 'room_milestone') {
			const currentRoom = typeof Game !== 'undefined' && Game.roomNumber ? Game.roomNumber : 0;
			return currentRoom >= (condition.room || 0);
		}
		
		// Achievement-based unlocks
		if (condition.type === 'achievement') {
			const achievement = condition.achievement || '';
			
			// Parse achievement strings
			if (achievement.includes('damage') && achievement.includes('lifetime')) {
				const match = achievement.match(/(\d+)/);
				const required = match ? parseInt(match[1], 10) : 0;
				return stats.totalDamageDealt >= required;
			}
			
			if (achievement.includes('rooms') && (achievement.includes('total') || achievement.includes('cumulative'))) {
				const match = achievement.match(/(\d+)/);
				const required = match ? parseInt(match[1], 10) : 0;
				return stats.totalRoomsCleared >= required;
			}
			
			if (achievement.includes('kills') && achievement.includes('one run')) {
				const match = achievement.match(/(\d+)/);
				const required = match ? parseInt(match[1], 10) : 0;
				const currentRunKills = typeof Game !== 'undefined' && Game.getPlayerStats && Game.getLocalPlayerId ? 
					(Game.getPlayerStats(Game.getLocalPlayerId())?.kills || 0) : 0;
				return currentRunKills >= required;
			}
			
			if (achievement.includes('dodge') && achievement.includes('lifetime')) {
				const match = achievement.match(/(\d+)/);
				const required = match ? parseInt(match[1], 10) : 0;
				return stats.totalDodges >= required;
			}
			
			if (achievement.includes('ability') && achievement.includes('lifetime')) {
				const match = achievement.match(/(\d+)/);
				const required = match ? parseInt(match[1], 10) : 0;
				return stats.totalAbilityUses >= required;
			}
			
			if (achievement.includes('block') && achievement.includes('lifetime')) {
				const match = achievement.match(/(\d+)/);
				const required = match ? parseInt(match[1], 10) : 0;
				return stats.totalBlocks >= required;
			}
			
			if (achievement.includes('reflect') && achievement.includes('lifetime')) {
				const match = achievement.match(/(\d+)/);
				const required = match ? parseInt(match[1], 10) : 0;
				return stats.totalReflectedDamage >= required;
			}
			
			if (achievement.includes('revive') && achievement.includes('lifetime')) {
				const match = achievement.match(/(\d+)/);
				const required = match ? parseInt(match[1], 10) : 0;
				return stats.totalRevives >= required;
			}
			
			if (achievement.includes('die') && achievement.includes('lifetime')) {
				const match = achievement.match(/(\d+)/);
				const required = match ? parseInt(match[1], 10) : 0;
				return (stats.totalDeaths || 0) >= required;
			}
			
			if (achievement.includes('near_death') && achievement.includes('lifetime')) {
				const match = achievement.match(/(\d+)/);
				const required = match ? parseInt(match[1], 10) : 0;
				return (stats.totalNearDeathExperiences || 0) >= required;
			}
			
			if (achievement.includes('backstab') && achievement.includes('lifetime')) {
				const match = achievement.match(/(\d+)/);
				const required = match ? parseInt(match[1], 10) : 0;
				return (stats.totalBackstabDamage || 0) >= required;
			}
			
			if (achievement.includes('beam') && achievement.includes('lifetime')) {
				const match = achievement.match(/(\d+)/);
				const required = match ? parseInt(match[1], 10) : 0;
				return (stats.totalBeamDamage || 0) >= required;
			}
			
			if (achievement.includes('successful') && achievement.includes('runs')) {
				const match = achievement.match(/(\d+)/);
				const required = match ? parseInt(match[1], 10) : 0;
				return (stats.successfulRuns || 0) >= required;
			}
			
			if (achievement.includes('stun') && achievement.includes('lifetime')) {
				const match = achievement.match(/(\d+)/);
				const required = match ? parseInt(match[1], 10) : 0;
				// TODO: Track stuns separately - for now return false
				return (stats.totalStuns || 0) >= required;
			}
		}
		
		// Purchase unlocks are handled separately (via UI)
		if (condition.type === 'purchase') {
			return false; // Must be purchased via UI
		}
		
		return false;
	}

	// Check all cards and unlock any that meet conditions
	function checkAndUnlockCards() {
		if (typeof window.CardCatalog === 'undefined' || !window.CardCatalog.getAll) return [];
		
		const allCards = window.CardCatalog.getAll();
		const unlocked = [];
		
		allCards.forEach(card => {
			if (checkUnlockCondition(card)) {
				if (typeof SaveSystem !== 'undefined' && SaveSystem.unlockCard) {
					SaveSystem.unlockCard(card.id);
					unlocked.push(card);
					console.log(`[CardUnlocks] Unlocked card: ${card.name || card.id}`);
				}
			}
		});
		
		return unlocked;
	}

	// Check room milestone unlocks (called when room is cleared)
	// Note: Lifetime stats should be updated separately before calling this
	window.checkRoomMilestoneUnlocks = function checkRoomMilestoneUnlocks(roomNumber) {
		if (!roomNumber || roomNumber < 1) return [];
		
		// Check for unlocks based on current room number
		return checkAndUnlockCards();
	};

	// Check achievement unlocks (called periodically or on stat updates)
	window.checkAchievementUnlocks = function checkAchievementUnlocks() {
		return checkAndUnlockCards();
	};

	// Update lifetime stats from run stats (called on run end)
	window.updateLifetimeStatsFromRun = function updateLifetimeStatsFromRun(runStats) {
		if (!runStats) return;
		
		const updates = {};
		
		// Don't add damageDealt or kills here - they're already tracked in real-time
		// Only update run-specific stats that aren't tracked incrementally
		
		if (typeof runStats.roomsCleared === 'number') {
			// Don't double-count - rooms are already counted on clear
			// But update max rooms in one run
			const stats = getLifetimeStats();
			if (runStats.roomsCleared > (stats.maxRoomsInOneRun || 0)) {
				updates.maxRoomsInOneRun = runStats.roomsCleared;
			}
		}
		
		// Check if this was a successful run (died or beat boss)
		if (runStats.runEnded && (runStats.died || runStats.beatBoss)) {
			updates.successfulRuns = 1;
		}
		
		updateLifetimeStats(updates);
		
		// Check for achievement unlocks after updating stats
		return checkAchievementUnlocks();
	};

	// Unlock card via shard purchase
	window.purchaseCardUnlock = function purchaseCardUnlock(cardId) {
		if (typeof SaveSystem === 'undefined' || !SaveSystem.getCardShards || !SaveSystem.addCardShards || !SaveSystem.unlockCard) {
			return { success: false, error: 'SaveSystem not available' };
		}
		
		const card = window.CardCatalog && window.CardCatalog.getById ? window.CardCatalog.getById(cardId) : null;
		if (!card || !card.unlockCondition) {
			return { success: false, error: 'Card not found or has no unlock condition' };
		}
		
		const unlocked = SaveSystem.getCardsUnlocked();
		if (unlocked.includes(cardId)) {
			return { success: false, error: 'Card already unlocked' };
		}
		
		const condition = card.unlockCondition;
		if (condition.type !== 'purchase' && (!condition.alternative || condition.alternative.type !== 'purchase')) {
			return { success: false, error: 'Card cannot be purchased' };
		}
		
		const cost = condition.type === 'purchase' ? (condition.shards || 0) : (condition.alternative?.shards || 0);
		if (cost <= 0) {
			return { success: false, error: 'Invalid purchase cost' };
		}
		
		const currentShards = SaveSystem.getCardShards();
		if (currentShards < cost) {
			return { success: false, error: `Not enough shards. Need ${cost}, have ${currentShards}` };
		}
		
		// Deduct shards and unlock card
		SaveSystem.addCardShards(-cost);
		SaveSystem.unlockCard(cardId);
		
		console.log(`[CardUnlocks] Purchased unlock for ${card.name || cardId} for ${cost} shards`);
		
		return { success: true, card: card.name || cardId, cost };
	};

	// Get achievement progress for a card unlock condition
	function getAchievementProgress(condition) {
		if (!condition || condition.type !== 'achievement') return null;
		
		const achievement = condition.achievement || '';
		const stats = getLifetimeStats();
		
		// Parse achievement strings and return current/required
		if (achievement.includes('damage') && achievement.includes('lifetime')) {
			const match = achievement.match(/(\d+)/);
			const required = match ? parseInt(match[1], 10) : 0;
			const current = stats.totalDamageDealt || 0;
			return { current, required, label: 'Deal damage (lifetime)' };
		}
		
		if (achievement.includes('rooms') && (achievement.includes('total') || achievement.includes('cumulative'))) {
			const match = achievement.match(/(\d+)/);
			const required = match ? parseInt(match[1], 10) : 0;
			const current = stats.totalRoomsCleared || 0;
			return { current, required, label: 'Clear rooms (cumulative)' };
		}
		
		if (achievement.includes('kills') && achievement.includes('one run')) {
			const match = achievement.match(/(\d+)/);
			const required = match ? parseInt(match[1], 10) : 0;
			const currentRunKills = typeof Game !== 'undefined' && Game.getPlayerStats && Game.getLocalPlayerId ? 
				(Game.getPlayerStats(Game.getLocalPlayerId())?.kills || 0) : 0;
			return { current: currentRunKills, required, label: 'Kills (one run)' };
		}
		
		if (achievement.includes('dodge') && achievement.includes('lifetime')) {
			const match = achievement.match(/(\d+)/);
			const required = match ? parseInt(match[1], 10) : 0;
			const current = stats.totalDodges || 0;
			return { current, required, label: 'Dodge attacks (lifetime)' };
		}
		
		if (achievement.includes('ability') && achievement.includes('lifetime')) {
			const match = achievement.match(/(\d+)/);
			const required = match ? parseInt(match[1], 10) : 0;
			const current = stats.totalAbilityUses || 0;
			return { current, required, label: 'Use abilities (lifetime)' };
		}
		
		if (achievement.includes('block') && achievement.includes('lifetime')) {
			const match = achievement.match(/(\d+)/);
			const required = match ? parseInt(match[1], 10) : 0;
			const current = stats.totalBlocks || 0;
			return { current, required, label: 'Block attacks (lifetime)' };
		}
		
		if (achievement.includes('reflect') && achievement.includes('lifetime')) {
			const match = achievement.match(/(\d+)/);
			const required = match ? parseInt(match[1], 10) : 0;
			const current = stats.totalReflectedDamage || 0;
			return { current, required, label: 'Reflect damage (lifetime)' };
		}
		
		if (achievement.includes('revive') && achievement.includes('lifetime')) {
			const match = achievement.match(/(\d+)/);
			const required = match ? parseInt(match[1], 10) : 0;
			const current = stats.totalRevives || 0;
			return { current, required, label: 'Revive (lifetime)' };
		}
		
		if (achievement.includes('die') && achievement.includes('lifetime')) {
			const match = achievement.match(/(\d+)/);
			const required = match ? parseInt(match[1], 10) : 0;
			const current = stats.totalDeaths || 0;
			return { current, required, label: 'Die (lifetime)' };
		}
		
		if (achievement.includes('near_death') && achievement.includes('lifetime')) {
			const match = achievement.match(/(\d+)/);
			const required = match ? parseInt(match[1], 10) : 0;
			const current = stats.totalNearDeathExperiences || 0;
			return { current, required, label: 'Near-death experiences (lifetime)' };
		}
		
		if (achievement.includes('backstab') && achievement.includes('lifetime')) {
			const match = achievement.match(/(\d+)/);
			const required = match ? parseInt(match[1], 10) : 0;
			const current = stats.totalBackstabDamage || 0;
			return { current, required, label: 'Deal backstab damage (lifetime)' };
		}
		
		if (achievement.includes('beam') && achievement.includes('lifetime')) {
			const match = achievement.match(/(\d+)/);
			const required = match ? parseInt(match[1], 10) : 0;
			const current = stats.totalBeamDamage || 0;
			return { current, required, label: 'Deal beam damage (lifetime)' };
		}
		
		if (achievement.includes('successful') && achievement.includes('runs')) {
			const match = achievement.match(/(\d+)/);
			const required = match ? parseInt(match[1], 10) : 0;
			const current = stats.successfulRuns || 0;
			return { current, required, label: 'Complete successful runs' };
		}
		
		if (achievement.includes('stun') && achievement.includes('lifetime')) {
			const match = achievement.match(/(\d+)/);
			const required = match ? parseInt(match[1], 10) : 0;
			const current = stats.totalStuns || 0;
			return { current, required, label: 'Stun enemies (lifetime)' };
		}
		
		return null;
	}

	// Get unlock status for a card
	window.getCardUnlockStatus = function getCardUnlockStatus(cardId) {
		const card = window.CardCatalog && window.CardCatalog.getById ? window.CardCatalog.getById(cardId) : null;
		if (!card) return { unlocked: false, canUnlock: false, reason: 'Card not found' };
		
		const unlocked = typeof SaveSystem !== 'undefined' && SaveSystem.getCardsUnlocked ? SaveSystem.getCardsUnlocked() : [];
		const isUnlocked = unlocked.includes(cardId);
		
		if (isUnlocked) {
			return { unlocked: true, canUnlock: false, reason: 'Already unlocked' };
		}
		
		const canUnlock = checkUnlockCondition(card);
		const condition = card.unlockCondition || {};
		
		// Get achievement progress if applicable
		const achievementProgress = getAchievementProgress(condition);
		
		let reason = '';
		if (canUnlock) {
			reason = 'Condition met';
		} else if (condition.type === 'purchase' || (condition.alternative && condition.alternative.type === 'purchase')) {
			const cost = condition.type === 'purchase' ? (condition.shards || 0) : (condition.alternative?.shards || 0);
			const currentShards = typeof SaveSystem !== 'undefined' && SaveSystem.getCardShards ? SaveSystem.getCardShards() : 0;
			reason = `Purchase for ${cost} shards${currentShards >= cost ? ' (affordable)' : ` (need ${cost - currentShards} more)`}`;
		} else {
			reason = 'Condition not met';
		}
		
		return { unlocked: false, canUnlock, reason, condition, achievementProgress };
	};

	// Helper function to track a single stat increment
	window.trackLifetimeStat = function trackLifetimeStat(statName, amount = 1) {
		if (typeof statName !== 'string' || !statName) return;
		const validStats = [
			'totalRoomsCleared', 'totalDamageDealt', 'totalKills', 'successfulRuns',
			'totalDodges', 'totalAbilityUses', 'totalBlocks', 'totalReflectedDamage',
			'totalRevives', 'maxRoomsInOneRun', 'totalBackstabDamage', 'totalBeamDamage',
			'totalStuns', 'totalDeaths', 'totalNearDeathExperiences'
		];
		if (!validStats.includes(statName)) {
			console.warn(`[CardUnlocks] Invalid stat name: ${statName}`);
			return;
		}
		const actualAmount = typeof amount === 'number' && !isNaN(amount) ? amount : 1;
		console.log(`[CardUnlocks] Tracking ${statName}: +${actualAmount}`);
		updateLifetimeStats({ [statName]: actualAmount });
		const newStats = getLifetimeStats();
		console.log(`[CardUnlocks] New ${statName} value:`, newStats[statName]);
	};

	// Expose lifetime stats getter and updater
	window.getLifetimeStats = getLifetimeStats;
	window.updateLifetimeStats = updateLifetimeStats;
})();

