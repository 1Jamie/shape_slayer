// Card pack generation (minimal scaffolding per spec)
// Generates a single reward after room clear: either card (from deck) or upgrade/shards

window.CardPacks = window.CardPacks || {};

function parseBandFromId(id) {
	if (!id) return null;
	const parts = String(id).split('_');
	const last = parts[parts.length - 1];
	const bands = ['white','green','blue','purple','orange'];
	return bands.includes(last) ? last : null;
}

function getModifierBonuses(modCard) {
	// Return { qualityShift, bonusCards, shards, minBand, ignoreCap }
	if (!modCard) return null;
	const band = modCard._resolvedQuality || parseBandFromId(modCard.id) || 'white';
	const bandOrder = ['white','green','blue','purple','orange'];
	const idx = Math.max(0, bandOrder.indexOf(band));
	const family = modCard.family || '';
	// Defaults
	let qualityShift = 0, bonusCards = 0, shards = 0, minBand = null, ignoreCap = false;
	const shifts = { white: 0.10, green: 0.15, blue: 0.20, purple: 0.25, orange: 0.30 };
	const bonusMap = { white: 1, green: 1, blue: 2, purple: 2, orange: 3 };
	if (family === 'Elite Armor' || family === 'Swift Assault') {
		qualityShift = shifts[band] || 0;
		bonusCards = bonusMap[band] || 0;
		if (band === 'purple') shards += 10;
		if (band === 'orange') shards += 25;
		ignoreCap = true; // harder room, better rewards
	}
	if (family === 'Prism Tax') {
		qualityShift = [0.20,0.30,0.40,0.50,0.60][idx] || 0;
		bonusCards = [1,1,2,2,3][idx] || 0;
		if (band === 'purple') shards += 10;
		if (band === 'orange') shards += 25;
	}
	// Extend for other families as needed
	return { qualityShift, bonusCards, shards, minBand, ignoreCap };
}

function choosePackType(roomNumber) {
	// Minimal: Standard / Elite / Treasure / Challenge by simple rules
	if (roomNumber % 10 === 0) return 'Boss';
	if (roomNumber % 6 === 0) return 'Challenge';
	if (roomNumber % 4 === 0) return 'Elite';
	if (roomNumber % 3 === 0) return 'Treasure';
	return 'Standard';
}

function getPackBonuses(packType) {
	switch (packType) {
		case 'Elite':
			return { qualityShift: 0.10, bonusCards: 1, guaranteedRare: false, ignoreCap: true };
		case 'Treasure':
			return { qualityShift: 0.20, bonusCards: 1, guaranteedRare: false, ignoreCap: false };
		case 'Challenge':
			return { qualityShift: 0.30, bonusCards: 2, guaranteedRare: false, ignoreCap: true };
		case 'Boss':
			return { qualityShift: 0.30, bonusCards: 0, guaranteedRare: true, ignoreCap: true };
		default:
			return { qualityShift: 0.0, bonusCards: 0, guaranteedRare: false, ignoreCap: false };
	}
}

function rollRewardType(packType) {
	const r = Math.random();
	switch (packType) {
		case 'Elite': return r < 0.40 ? 'Card' : 'Upgrade';
		case 'Treasure': return r < 0.50 ? 'Card' : 'Upgrade';
		case 'Challenge': return r < 0.60 ? 'Card' : 'Upgrade';
		case 'Standard':
		default:
			return r < 0.30 ? 'Card' : 'Upgrade';
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
		const combined = {
			qualityShift: (packBonuses.qualityShift || 0) + (mod && mod.qualityShift ? mod.qualityShift : 0),
			bonusCards: (packBonuses.bonusCards || 0) + (mod && mod.bonusCards ? mod.bonusCards : 0),
			guaranteedRare: !!(packBonuses.guaranteedRare || (mod && mod.minBand === 'blue') || (typeof Game !== 'undefined' && Game.teamMinBand === 'blue')),
			ignoreCap: !!(packBonuses.ignoreCap || (mod && mod.ignoreCap))
		};
		// Apply team min band (e.g., Fortune's Favor → green minimum)
		let minBand = combined.guaranteedRare ? 'blue' : null;
		if (!minBand && typeof Game !== 'undefined' && Game.teamMinBand) {
			minBand = Game.teamMinBand;
		}
		const card = drawCardFromDeckForPack(roomNumber, isElite, { ignoreCap: combined.ignoreCap, qualityShift: combined.qualityShift, minBand });
		return { packType, rewardType, card, bonuses: combined };
	}
	// Minimal upgrade: award shards as fallback
	const shards = packType === 'Challenge' ? 50 : packType === 'Elite' ? 25 : packType === 'Treasure' ? 35 : 15;
	return { packType, rewardType, shards };
};

// Generate multiple door options with previews (no RNG protection yet)
window.CardPacks.generateDoorOptions = function generateDoorOptions(roomNumber, count) {
	// RNG protection: ensure after 3 consecutive non-card packs, include at least one Card option;
	// after 5, force a full Card pack.
	let nonCardStreak = (typeof Game !== 'undefined' && Number.isFinite(Game.nonCardPackStreak)) ? Game.nonCardPackStreak : 0;
	const options = [];
	for (let i = 0; i < count; i++) {
		const packType = choosePackType(roomNumber || 1);
		let rewardType = rollRewardType(packType);
		// Apply streak rules on last option to guarantee inclusion
		const isLast = (i === count - 1);
		if (nonCardStreak >= 4) {
			rewardType = 'Card'; // After 5-1 = 4 completed non-cards, next option forced Card
		} else if (nonCardStreak >= 2 && isLast) {
			// After 3-1 = 2 completed, ensure at least one Card present
			if (!options.some(o => o.rewardType === 'Card')) {
				rewardType = 'Card';
			}
		}
		let preview = [];
		let payload = null;
		if (rewardType === 'Card') {
			const isElite = (packType === 'Elite' || packType === 'Challenge');
			// Combine pack + next-room modifier bonuses for preview and generation
			const base = getPackBonuses(packType);
			const mod = (typeof Game !== 'undefined' && Game.nextRoomPackBonus) ? Game.nextRoomPackBonus : null;
			const bonuses = {
				qualityShift: (base.qualityShift || 0) + (mod && mod.qualityShift ? mod.qualityShift : 0),
				bonusCards: (base.bonusCards || 0) + (mod && mod.bonusCards ? mod.bonusCards : 0),
				guaranteedRare: !!(base.guaranteedRare || (mod && mod.minBand === 'blue') || (typeof Game !== 'undefined' && Game.teamMinBand === 'blue')),
				ignoreCap: !!(base.ignoreCap || (mod && mod.ignoreCap))
			};
			let minBand = bonuses.guaranteedRare ? 'blue' : null;
			if (!minBand && typeof Game !== 'undefined' && Game.teamMinBand) {
				minBand = Game.teamMinBand;
			}
			const card = drawCardFromDeckForPack(roomNumber, isElite, { ignoreCap: bonuses.ignoreCap, qualityShift: bonuses.qualityShift, minBand });
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
			continue;
		} else {
			// 50% chance upgrade vs shards
			if (Math.random() < 0.5) {
				payload = { upgrade: true };
				preview.push('+1 quality to a hand card');
			} else {
				const shards = packType === 'Challenge' ? 50 : packType === 'Elite' ? 25 : packType === 'Treasure' ? 35 : 15;
				payload = { shards };
				preview.push(`${shards} shards`);
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
	const currentRoomNumber = roomNumber || (typeof Game !== 'undefined' ? Game.roomNumber : 1);
	
	// Check if there's a room reward that's an upgrade (from previous room's door selection)
	// This reward will be picked up BEFORE the player selects a door, so we need to account for it
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
	if (option.rewardType === 'Card' && option.payload && option.payload.card) {
		// Track boss unlock banner (visual minimal via console + flag)
		if (option.bossUnlock && typeof Game !== 'undefined') {
			const cardName = option.payload.card.name || option.payload.card.family || 'Card';
			Game.lastBossUnlock = { level: option.bossUnlock.unlockLevel, cardName };
			// Fire a transient HUD banner (3 seconds)
			Game.bossUnlockBanner = {
				text: `Mastery ${option.bossUnlock.unlockLevel} Unlocked for ${cardName}!`,
				until: Date.now() + 3000
			};
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
		if (typeof CardGround !== 'undefined' && CardGround.dropAt) {
			CardGround.dropAt(centerX + 30, centerY, option.payload.card);
		} else if (typeof addToHand === 'function') {
			addToHand(option.payload.card);
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
		// If modifier adds shards for next room reward, grant now
		if (option.payload.modBonuses && option.payload.modBonuses.shards && typeof SaveSystem !== 'undefined' && SaveSystem.addCardShards) {
			SaveSystem.addCardShards(option.payload.modBonuses.shards);
		}
		// Consume selected modifier
		if (typeof Game !== 'undefined' && Game.selectedRoomModifier) {
			// Compute and store next-room bonuses/effects from the selected room modifier
			const modBonuses = getModifierBonuses(Game.selectedRoomModifier) || {};
			// Persist pack-related bonuses for next room's rewards
			Game.nextRoomPackBonus = {
				qualityShift: modBonuses.qualityShift || 0,
				bonusCards: modBonuses.bonusCards || 0,
				minBand: modBonuses.minBand || null,
				ignoreCap: !!modBonuses.ignoreCap
			};
			// Persist enemy-related effects for next room generation (hp/speed)
			const fam = Game.selectedRoomModifier.family || '';
			const qBand = Game.selectedRoomModifier._resolvedQuality || parseBandFromId(Game.selectedRoomModifier.id) || 'white';
			// Map quality to percent for supported modifiers
			const qToVal = { white: 0.10, green: 0.20, blue: 0.30, purple: 0.40, orange: 0.50 };
			let hpPct = 0, speedPct = 0;
			if (fam === 'Elite Armor') hpPct = qToVal[qBand] || 0;
			if (fam === 'Swift Assault') speedPct = qToVal[qBand] || 0;
			Game.nextRoomEnemyMod = { hpPct, speedPct };
			// Remove modifier from collection
			if (typeof SaveSystem !== 'undefined') {
				const save = SaveSystem.load();
				if (Array.isArray(save.roomModifierCollection)) {
					const idx = save.roomModifierCollection.findIndex(m => m.id === Game.selectedRoomModifier.id);
					if (idx >= 0) {
						save.roomModifierCollection.splice(idx, 1);
						SaveSystem.save(save);
					}
				}
			}
			Game.selectedRoomModifier = null;
		}
		return true;
	}
	if (option.rewardType === 'Upgrade' && option.payload && option.payload.upgrade) {
		// Defer to upgrade selection
		if (typeof Game !== 'undefined') {
			Game.awaitingUpgradeSelection = true;
			Game.pendingUpgrade = { type: 'quality_plus_one' };
			return true;
		}
		return false;
	}
	if (option.rewardType === 'Upgrade' && option.payload && Number.isFinite(option.payload.shards) && typeof SaveSystem !== 'undefined' && SaveSystem.addCardShards) {
		SaveSystem.addCardShards(option.payload.shards);
		return true;
	}
	return false;
};


