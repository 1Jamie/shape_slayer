// Card effect resolver (hooks wired in later integration steps) - global

window.CardEffects = window.CardEffects || {};
window.CardEffects.applyPlayerStatModifiers = function applyPlayerStatModifiers(player, handCards) {
	// Minimal scaffold: compute aggregate bonuses for starters
	let critChance = 0;
	let defense = 0;
	let moveSpeed = 0;
	let projectileDamagePenalty = 0;
	let defensePenalty = 0;
	let moveSpeedPenalty = 0;
	// Expanded stats
	let critDamageMultiplierAdd = 0;
	let lifestealAdd = 0;
	let projectileSpeedAdd = 0;
	let cooldownReductionAdd = 0;
	let dodgeCooldownDelta = 0; // seconds, negative reduces cooldown
	let bonusDodgeChargesAdd = 0; // integer
	let thornsReflectAdd = 0;

	handCards.forEach(card => {
		if (!card || !card.qualityBands) return;
		// Assume resolved quality band stored on instance as card._resolvedQuality ('white'|'green'|...)
		const q = card._resolvedQuality || 'white';
		const band = card.qualityBands[q];
		if (!band) return;

		switch (card.family) {
			case 'Precision':
				critChance += band.value || 0;
				if (q === 'blue' || q === 'purple' || q === 'orange') defensePenalty += 0.03;
				break;
			case 'Bulwark':
				defense += band.value || 0;
				if (q === 'blue' || q === 'purple' || q === 'orange') moveSpeedPenalty += 0.05;
				break;
			case 'Velocity':
				moveSpeed += band.value || 0;
				if (q === 'green' || q === 'blue' || q === 'purple' || q === 'orange') projectileDamagePenalty += 0.02;
				break;
			case 'Fury':
				// Crit damage multiplier bonus; damage taken penalty at blue+
				critDamageMultiplierAdd += band.value || 0;
				// Note: +3% damage taken is not directly modeled; consider as defense penalty if needed later
				break;
			case 'Lifeline':
				lifestealAdd += band.value || 0;
				break;
			case 'Vector Laminar':
				projectileSpeedAdd += band.value || 0;
				break;
			case 'Arcane Flow':
				cooldownReductionAdd += band.value || 0;
				break;
			case 'Parallelogram Slip':
				// Value is negative seconds to reduce cooldown
				dodgeCooldownDelta += band.value || 0; // band values already negative in data
				break;
			case 'Phase Step':
				// Value is additional charges (integer-like)
				bonusDodgeChargesAdd += Math.floor(band.value || 0);
				break;
			case 'Prism Shield':
				thornsReflectAdd += band.value || 0;
				break;
		}
	});

	return {
		critChance,
		defense,
		moveSpeed,
		projectileDamagePenalty,
		defensePenalty,
		moveSpeedPenalty,
		critDamageMultiplierAdd,
		lifestealAdd,
		projectileSpeedAdd,
		cooldownReductionAdd,
		dodgeCooldownDelta,
		bonusDodgeChargesAdd,
		thornsReflectAdd
	};
};

// Extract conditional card effects from hand (for runtime tracking)
window.CardEffects.getConditionalEffects = function getConditionalEffects(handCards) {
	const effects = {
		momentum: null,
		execute: null,
		fractalConduit: null,
		detonatingVertex: null,
		overcharge: null
	};
	
	handCards.forEach(card => {
		if (!card || !card.qualityBands) return;
		const q = card._resolvedQuality || 'white';
		const band = card.qualityBands[q];
		if (!band) return;
		
		switch (card.family) {
			case 'Momentum':
				effects.momentum = {
					perKill: band.value || 0,
					cap: band.bonus?.cap || 0.10,
					duration: band.bonus?.duration || 5,
					extendOnKill: band.bonus?.extendOnKill || 0,
					moveSpeedOnKill: band.bonus?.moveSpeedOnKill || 0
				};
				break;
			case 'Execute':
				effects.execute = {
					threshold: band.value || 0.25,
					bossThreshold: band.bonus?.boss || 0.10,
					moveSpeedOnExecute: band.bonus?.moveSpeedOnExecute || null
				};
				break;
			case 'Fractal Conduit':
				effects.fractalConduit = {
					chainCount: band.value || 1,
					chainDamage: band.bonus?.chainDamage || 0.50,
					lifeOnChain: band.bonus?.lifeOnChain || 0,
					rangeBoost: band.bonus?.rangeBoost || false
				};
				break;
			case 'Detonating Vertex':
				effects.detonatingVertex = {
					chance: band.value || 0.12,
					aoe: band.bonus?.aoe || 0.50,
					chainChance: band.bonus?.chainChance || 0,
					clusters: band.bonus?.clusters || null
				};
				break;
			case 'Overcharge':
				effects.overcharge = {
					burstDamage: band.value || 0.15,
					interval: band.bonus?.interval || 5,
					invuln: band.bonus?.invuln || 0,
					moveSpeed: band.bonus?.moveSpeed || 0
				};
				break;
		}
	});
	
	return effects;
};

// Initialize conditional effect state on player (call once per run start)
window.CardEffects.initConditionalState = function initConditionalState(player) {
	if (!player) return;
	player._cardEffects = player._cardEffects || {};
	player._cardEffects.momentumStacks = 0;
	player._cardEffects.momentumTimer = 0;
	player._cardEffects.overchargeTimer = 0;
	player._cardEffects.overchargeActive = false;
};

// Update conditional effects (call each frame with deltaTime)
window.CardEffects.updateConditionalEffects = function updateConditionalEffects(player, deltaTime) {
	if (!player || !player._cardEffects) return;
	const effects = player._cardEffects;
	
	// Momentum decay
	if (effects.momentumStacks > 0 && effects.momentumTimer > 0) {
		effects.momentumTimer -= deltaTime;
		if (effects.momentumTimer <= 0) {
			effects.momentumStacks = 0;
		}
	}
	
	// Overcharge timer
	if (effects.overchargeTimer > 0) {
		effects.overchargeTimer -= deltaTime;
		if (effects.overchargeTimer <= 0) {
			effects.overchargeActive = true;
			effects.overchargeTimer = 0; // Will be reset by effect handler
		}
	}
};

// Get current momentum damage multiplier
window.CardEffects.getMomentumMultiplier = function getMomentumMultiplier(player) {
	if (!player || !player._cardEffects) return 1.0;
	// momentumStacks is already the accumulated multiplier value (e.g., 0.10 for 10%)
	return 1.0 + (player._cardEffects.momentumStacks || 0);
};

// Get current overcharge multiplier (1.0 or burst multiplier)
window.CardEffects.getOverchargeMultiplier = function getOverchargeMultiplier(player) {
	if (!player || !player._cardEffects || !player._cardEffects.overchargeActive) return 1.0;
	return 1.0 + (player._cardEffects.overchargeBurstDamage || 0);
};

// Extract ability mutator effects from hand cards (for class-specific ability modifications)
window.CardEffects.getAbilityModifiers = function getAbilityModifiers(player, handCards) {
	if (!player || !handCards || !Array.isArray(handCards)) return {};
	
	const playerClass = player.playerClass || (player.constructor.name === 'Warrior' ? 'square' : 
		player.constructor.name === 'Rogue' ? 'triangle' :
		player.constructor.name === 'Tank' ? 'pentagon' :
		player.constructor.name === 'Mage' ? 'hexagon' : null);
	
	if (!playerClass) return {};
	
	const modifiers = {};
	
	handCards.forEach(card => {
		if (!card || !card.qualityBands || card.category !== 'Ability') return;
		const q = card._resolvedQuality || 'white';
		const band = card.qualityBands[q];
		if (!band) return;
		
		// Only process cards that match this player's class
		if (card.effectTarget && card.effectTarget.startsWith(playerClass + '_')) {
			const target = card.effectTarget.replace(playerClass + '_', '');
			const family = card.family;
			
			// Initialize modifier object for this target if needed
			if (!modifiers[target]) {
				modifiers[target] = {};
			}
			
			switch (family) {
				// Square (Warrior) abilities
				case 'Whirlwind Core':
					if (q === 'white') {
						modifiers.whirlwind = modifiers.whirlwind || {};
						modifiers.whirlwind.durationBonus = (modifiers.whirlwind.durationBonus || 0) + band.value;
					} else if (q === 'green') {
						modifiers.whirlwind = modifiers.whirlwind || {};
						modifiers.whirlwind.damageMultiplier = (modifiers.whirlwind.damageMultiplier || 0) + band.value;
					} else if (q === 'blue') {
						modifiers.whirlwind = modifiers.whirlwind || {};
						modifiers.whirlwind.pullEffect = true;
					} else if (q === 'purple') {
						modifiers.whirlwind = modifiers.whirlwind || {};
						modifiers.whirlwind.damageAura = true;
					} else if (q === 'orange') {
						modifiers.whirlwind = modifiers.whirlwind || {};
						modifiers.whirlwind.resetOnKill = true;
					}
					break;
				case 'Thrust Focus':
					if (q === 'white') {
						modifiers.thrust = modifiers.thrust || {};
						modifiers.thrust.rangeBonus = (modifiers.thrust.rangeBonus || 0) + band.value;
					} else if (q === 'green') {
						modifiers.thrust = modifiers.thrust || {};
						modifiers.thrust.damageMultiplier = (modifiers.thrust.damageMultiplier || 0) + band.value;
					} else if (q === 'blue') {
						modifiers.thrust = modifiers.thrust || {};
						modifiers.thrust.knockback = true;
					} else if (q === 'purple') {
						modifiers.thrust = modifiers.thrust || {};
						modifiers.thrust.pierce = true;
					} else if (q === 'orange') {
						modifiers.thrust = modifiers.thrust || {};
						modifiers.thrust.infiniteRange = true;
						modifiers.thrust.pierceAll = true;
						modifiers.thrust.burningTrail = true;
					}
					break;
				case 'Block Stance':
					if (q === 'white' || q === 'green' || q === 'blue') {
						modifiers.block = modifiers.block || {};
						modifiers.block.reductionBonus = (modifiers.block.reductionBonus || 0) + band.value;
					} else if (q === 'purple') {
						modifiers.block = modifiers.block || {};
						modifiers.block.reductionBonus = (modifiers.block.reductionBonus || 0) + band.value;
						modifiers.block.damageBoostOnBlock = 0.10;
					} else if (q === 'orange') {
						modifiers.block = modifiers.block || {};
						modifiers.block.reductionBonus = (modifiers.block.reductionBonus || 0) + band.value;
						modifiers.block.damageBoostOnBlock = 0.20;
						modifiers.block.reflectOnBlock = true;
					}
					break;
				
				// Triangle (Rogue) abilities
				case 'Fan of Knives+':
					if (q === 'white' || q === 'green' || q === 'blue' || q === 'purple') {
						modifiers.fanOfKnives = modifiers.fanOfKnives || {};
						modifiers.fanOfKnives.knifeCountBonus = (modifiers.fanOfKnives.knifeCountBonus || 0) + Math.floor(band.value);
						if (q === 'purple') {
							modifiers.fanOfKnives.pierceChance = 0.25;
						}
					} else if (q === 'orange') {
						modifiers.fanOfKnives = modifiers.fanOfKnives || {};
						modifiers.fanOfKnives.returnToPlayer = true;
					}
					break;
				case 'Shadow Clone':
					if (q === 'white' || q === 'green' || q === 'blue' || q === 'purple') {
						modifiers.shadowClone = modifiers.shadowClone || {};
						modifiers.shadowClone.cloneCountBonus = (modifiers.shadowClone.cloneCountBonus || 0) + Math.floor(band.value);
						if (q === 'purple') {
							modifiers.shadowClone.cloneDamage = 0.25;
						}
					} else if (q === 'orange') {
						modifiers.shadowClone = modifiers.shadowClone || {};
						modifiers.shadowClone.explodeOnDeath = true;
					}
					break;
				case 'Backstab Edge':
					if (q === 'white' || q === 'green' || q === 'blue' || q === 'purple') {
						modifiers.backstab = modifiers.backstab || {};
						modifiers.backstab.damageMultiplier = (modifiers.backstab.damageMultiplier || 0) + band.value;
						if (q === 'purple') {
							modifiers.backstab.chainChance = 0.25;
						}
					} else if (q === 'orange') {
						modifiers.backstab = modifiers.backstab || {};
						modifiers.backstab.damageMultiplier = (modifiers.backstab.damageMultiplier || 0) + band.value;
						modifiers.backstab.stealthOnKill = 3.0; // 3 seconds
						modifiers.backstab.resetCooldownOnKill = true;
					}
					break;
				
				// Hexagon (Mage) abilities
				case 'Blink Flux':
					if (q === 'white') {
						modifiers.blink = modifiers.blink || {};
						modifiers.blink.rangeBonus = (modifiers.blink.rangeBonus || 0) + band.value;
					} else if (q === 'green') {
						modifiers.blink = modifiers.blink || {};
						modifiers.blink.damageMultiplier = (modifiers.blink.damageMultiplier || 0) + band.value;
					} else if (q === 'blue') {
						modifiers.blink = modifiers.blink || {};
						modifiers.blink.chainBlink = true;
					} else if (q === 'purple') {
						modifiers.blink = modifiers.blink || {};
						modifiers.blink.damagingTrail = true;
					} else if (q === 'orange') {
						modifiers.blink = modifiers.blink || {};
						modifiers.blink.damagingTrail = true;
						modifiers.blink.resetOnKill = true;
					}
					break;
				case 'Beam Mastery':
					if (q === 'white') {
						modifiers.beam = modifiers.beam || {};
						modifiers.beam.chargeBonus = (modifiers.beam.chargeBonus || 0) + Math.floor(band.value);
					} else if (q === 'green') {
						modifiers.beam = modifiers.beam || {};
						modifiers.beam.tickRateReduction = (modifiers.beam.tickRateReduction || 0) + Math.abs(band.value);
					} else if (q === 'blue') {
						modifiers.beam = modifiers.beam || {};
						modifiers.beam.durationMultiplier = (modifiers.beam.durationMultiplier || 0) + band.value;
					} else if (q === 'purple') {
						modifiers.beam = modifiers.beam || {};
						modifiers.beam.penetrationBonus = (modifiers.beam.penetrationBonus || 0) + Math.floor(band.value);
					} else if (q === 'orange') {
						modifiers.beam = modifiers.beam || {};
						modifiers.beam.splitOnHit = true;
					}
					break;
				
				// Pentagon (Tank) abilities
				case 'Shield Bulwark':
					if (q === 'white') {
						modifiers.shield = modifiers.shield || {};
						modifiers.shield.durationBonus = (modifiers.shield.durationBonus || 0) + band.value;
					} else if (q === 'green') {
						modifiers.shield = modifiers.shield || {};
						modifiers.shield.waveDamageMultiplier = (modifiers.shield.waveDamageMultiplier || 0) + band.value;
					} else if (q === 'blue') {
						modifiers.shield = modifiers.shield || {};
						modifiers.shield.largerWaveRadius = true;
					} else if (q === 'purple') {
						modifiers.shield = modifiers.shield || {};
						modifiers.shield.damageReductionWhileShielding = true;
					} else if (q === 'orange') {
						modifiers.shield = modifiers.shield || {};
						modifiers.shield.explodeOnBreak = true;
					}
					break;
				case 'Hammer Smash':
					if (q === 'white') {
						modifiers.hammer = modifiers.hammer || {};
						modifiers.hammer.radiusBonus = (modifiers.hammer.radiusBonus || 0) + band.value;
					} else if (q === 'green') {
						modifiers.hammer = modifiers.hammer || {};
						modifiers.hammer.knockbackMultiplier = (modifiers.hammer.knockbackMultiplier || 0) + band.value;
					} else if (q === 'blue') {
						modifiers.hammer = modifiers.hammer || {};
						modifiers.hammer.stunEffect = true;
					} else if (q === 'purple') {
						modifiers.hammer = modifiers.hammer || {};
						modifiers.hammer.damageZone = true;
					} else if (q === 'orange') {
						modifiers.hammer = modifiers.hammer || {};
						modifiers.hammer.shockwave = true;
					}
					break;
			}
		}
	});
	
	return modifiers;
};


