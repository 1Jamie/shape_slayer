// Player cards (Offense, Defense, Mobility, Ability Mutators)
// Start with starter cards per spec; expand in later tasks

window.PLAYER_CARDS = [
	// Precision (starter)
	{
		id: 'precision_001',
		family: 'Precision',
		name: 'Precision',
		category: 'Offense',
		effectType: 'stat_modifier',
		effectTarget: 'critChance',
		application: 'passive',
		duration: 'persistent',
		unlockCondition: { type: 'starter' },
		tradeOffs: { defensePenaltyAtBlue: 0.03 },
		nonStacking: false,
		maxCopies: 4,
		qualityBands: {
			white: { value: 0.05, description: '+5% crit chance', flavorText: 'Basic geometric precision' },
			green: { value: 0.10, description: '+10% crit chance', flavorText: 'Refined calculation' },
			blue: { value: 0.15, description: '+15% crit chance, -3% defense', flavorText: 'Advanced theorem' },
			purple: { value: 0.20, description: '+20% crit chance, -3% defense; crits restore 2% HP', flavorText: 'Masterful application', bonus: { lifeOnCrit: 0.02 } },
			orange: { value: 0.25, description: '+25% crit chance, -3% defense; crits restore 5% HP and apply Vulnerability (10%/3s)', flavorText: 'Bend probability itself.', bonus: { lifeOnCrit: 0.05, vulnOnCrit: { multiplier: 0.10, duration: 3 } }, legendaryFlavor: 'Critical hits restore health and find the target\'s absolute weakness.' }
		}
	},
	// Bulwark (starter)
	{
		id: 'bulwark_001',
		family: 'Bulwark',
		name: 'Bulwark',
		category: 'Defense',
		effectType: 'stat_modifier',
		effectTarget: 'defense',
		application: 'passive',
		duration: 'persistent',
		unlockCondition: { type: 'starter' },
		tradeOffs: { moveSpeedPenaltyAtBlue: 0.05 },
		nonStacking: false,
		maxCopies: 4,
		qualityBands: {
			white: { value: 0.05, description: '+5% defense', flavorText: 'Basic protection' },
			green: { value: 0.08, description: '+8% defense', flavorText: 'Reinforced guard' },
			blue: { value: 0.12, description: '+12% defense, -5% movement speed', flavorText: 'Fortified defense' },
			purple: { value: 0.16, description: '+16% defense, -5% movement speed; blocking reflects 10% damage', flavorText: 'Impenetrable wall', bonus: { reflectOnBlock: 0.10 } },
			orange: { value: 0.20, description: '+20% defense, -5% movement speed; blocking reflects 25% damage and grants brief invulnerability', flavorText: 'Absolute barrier. Defense becomes offense.', bonus: { reflectOnBlock: 0.25, invulnOnBlock: 0.6 } }
		}
	},
	// Velocity (starter)
	{
		id: 'velocity_001',
		family: 'Velocity',
		name: 'Velocity',
		category: 'Mobility',
		effectType: 'stat_modifier',
		effectTarget: 'movementSpeed',
		application: 'passive',
		duration: 'persistent',
		unlockCondition: { type: 'starter' },
		tradeOffs: { projectileDamagePenaltyAtGreen: 0.02 },
		nonStacking: false,
		maxCopies: 4,
		qualityBands: {
			white: { value: 0.10, description: '+10% movement speed', flavorText: 'Quick step' },
			green: { value: 0.15, description: '+15% movement speed, -2% projectile damage', flavorText: 'Swift movement' },
			blue: { value: 0.20, description: '+20% movement speed, -2% projectile damage', flavorText: 'Rapid transit' },
			purple: { value: 0.25, description: '+25% movement speed, -2% projectile damage; movement speed increases damage by 5%', flavorText: 'Momentum power', bonus: { speedToDamage: 0.05 } },
			orange: { value: 0.30, description: '+30% movement speed, -2% projectile damage; movement speed increases damage by 10% and grants dodge chance', flavorText: 'Infinite velocity. Speed becomes strength.', bonus: { speedToDamage: 0.10, dodgeChance: 0.10 } }
		}
	}
	,
	// Fury
	{
		id: 'fury_001',
		family: 'Fury',
		name: 'Fury',
		category: 'Offense',
		effectType: 'stat_modifier',
		effectTarget: 'critDamage',
		application: 'passive',
		duration: 'persistent',
		unlockCondition: { type: 'room_milestone', room: 10, alternative: { type: 'purchase', shards: 30 } },
		tradeOffs: { damageTakenPenaltyAtBlue: 0.03 },
		nonStacking: false,
		maxCopies: 4,
		qualityBands: {
			white: { value: 0.15, description: '+15% crit damage', flavorText: 'Sharpened edge' },
			green: { value: 0.30, description: '+30% crit damage', flavorText: 'Razor focus' },
			blue: { value: 0.45, description: '+45% crit damage, +3% damage taken', flavorText: 'Devastating strike' },
			purple: { value: 0.60, description: '+60% crit damage, +3% damage taken; crits have 10% chance to stun', flavorText: 'Unstoppable force', bonus: { stunOnCritChance: 0.10, stunDuration: 1.0 } },
			orange: { value: 0.75, description: '+75% crit damage, +3% damage taken; crits explode for 50% damage in small radius', flavorText: 'Fury incarnate.', bonus: { critExplosion: { multiplier: 0.50, radius: 90 } } }
		}
	},
	// Momentum
	{
		id: 'momentum_001',
		family: 'Momentum',
		name: 'Momentum',
		category: 'Offense',
		effectType: 'conditional',
		effectTarget: 'onKillStackingDamage',
		application: 'conditional',
		duration: 'temporary',
		unlockCondition: { type: 'room_milestone', room: 5, alternative: { type: 'purchase', shards: 40 } },
		nonStacking: false,
		maxCopies: 3,
		qualityBands: {
			white: { value: 0.02, description: '+2% damage per kill (cap 10%, 5s)', flavorText: 'Building rhythm', bonus: { cap: 0.10, duration: 5 } },
			green: { value: 0.04, description: '+4% per kill (cap 15%, 6s)', flavorText: 'Gathering speed', bonus: { cap: 0.15, duration: 6 } },
			blue: { value: 0.06, description: '+6% per kill (cap 20%, 7s)', flavorText: 'Unstoppable momentum', bonus: { cap: 0.20, duration: 7 } },
			purple: { value: 0.08, description: '+8% per kill (cap 25%, 8s); kills extend duration +1s', flavorText: 'Cascading power', bonus: { cap: 0.25, duration: 8, extendOnKill: 1 } },
			orange: { value: 0.10, description: '+10% per kill (cap 30%, 10s); extend on kill and +5% movespeed', flavorText: 'Infinite acceleration.', bonus: { cap: 0.30, duration: 10, extendOnKill: 1, moveSpeedOnKill: 0.05 } }
		}
	},
	// Volley (balanced)
	{
		id: 'volley_001',
		family: 'Volley',
		name: 'Volley',
		category: 'Offense',
		effectType: 'ability_modifier',
		effectTarget: 'projectileCount',
		application: 'passive',
		duration: 'persistent',
		unlockCondition: { type: 'room_milestone', room: 25, alternative: { type: 'purchase', shards: 150 }, bossDrop: { rooms: [22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32] } },
		tradeOffs: { reducedDamagePerProjectile: true, increasedSpreadAngle: true, reducedRange: true },
		nonStacking: true,
		maxCopies: 2,
		qualityBands: {
			white: { value: 1, description: '+1 projectile, -40% dmg per proj', flavorText: 'Split shot', bonus: { dmgPerProjectile: 0.60 } },
			green: { value: 1, description: '+1 projectile, -35% dmg per proj', flavorText: 'Twin volley', bonus: { dmgPerProjectile: 0.65 } },
			blue: { value: 2, description: '+2 total, -45% dmg per proj', flavorText: 'Triple threat', bonus: { dmgPerProjectile: 0.55 } },
			purple: { value: 2, description: '+2 total, -40% dmg per proj; 25% pierce chance', flavorText: 'Scattered barrage', bonus: { dmgPerProjectile: 0.60, pierceChance: 0.25 } },
			orange: { value: 3, description: '+3 total, -37.5% dmg per proj; pierce and chain', flavorText: 'Fractal volley.', bonus: { dmgPerProjectile: 0.625, pierceAll: true, chain: true } }
		}
	},
	// Execute
	{
		id: 'execute_001',
		family: 'Execute',
		name: 'Execute',
		category: 'Offense',
		effectType: 'conditional',
		effectTarget: 'executeThreshold',
		application: 'conditional',
		duration: 'instant',
		unlockCondition: { type: 'achievement', achievement: 'deal_10000_damage_lifetime', alternative: { type: 'purchase', shards: 125 } },
		tradeOffs: { onlyTriggersBelowThreshold: true, lowerBossThreshold: true },
		nonStacking: true,
		maxCopies: 2,
		qualityBands: {
			white: { value: 0.25, description: 'Execute at 25% HP (boss 10%)', flavorText: 'Finishing blow', bonus: { boss: 0.10 } },
			green: { value: 0.30, description: 'Execute at 30% (boss 12%)', flavorText: 'Swift end', bonus: { boss: 0.12 } },
			blue: { value: 0.35, description: 'Execute at 35% (boss 15%)', flavorText: 'Merciless strike', bonus: { boss: 0.15 } },
			purple: { value: 0.40, description: 'Execute at 40% (boss 18%); +10% movespeed 3s', flavorText: 'Absolute termination', bonus: { boss: 0.18, moveSpeedOnExecute: { value: 0.10, duration: 3 } } },
			orange: { value: 0.40, description: 'Execute at 40% (boss 18%); +15% movespeed 5s', flavorText: 'Geometric execution.', bonus: { boss: 0.18, moveSpeedOnExecute: { value: 0.15, duration: 5 } } }
		}
	},
	// Fractal Conduit (chain lightning)
	{
		id: 'fractal_conduit_001',
		family: 'Fractal Conduit',
		name: 'Fractal Conduit',
		category: 'Offense',
		effectType: 'conditional',
		effectTarget: 'chainLightning',
		application: 'conditional',
		duration: 'instant',
		unlockCondition: { type: 'achievement', achievement: 'clear_50_rooms_cumulative', alternative: { type: 'purchase', shards: 175 } },
		tradeOffs: { reducedDamagePerChain: true, requiresMultipleEnemies: true, sequentialChaining: true },
		nonStacking: true,
		maxCopies: 2,
		qualityBands: {
			white: { value: 1, description: 'Chains to 1 enemy (50% dmg per chain)', flavorText: 'Single link', bonus: { chainDamage: 0.50, totalPotential: 1.5 } },
			green: { value: 2, description: 'Chains to 2 (55% dmg)', flavorText: 'Double chain', bonus: { chainDamage: 0.55, totalPotential: 2.1 } },
			blue: { value: 3, description: 'Chains to 3 (60% dmg)', flavorText: 'Triple link', bonus: { chainDamage: 0.60, totalPotential: 2.8 } },
			purple: { value: 4, description: 'Chains to 4 (65% dmg); chains restore 2% HP', flavorText: 'Cascading energy', bonus: { chainDamage: 0.65, totalPotential: 3.6, lifeOnChain: 0.02 } },
			orange: { value: 5, description: 'Chains to 5 (70% dmg); restore 5% HP, extend range', flavorText: 'Infinite recursion.', bonus: { chainDamage: 0.70, totalPotential: 4.5, lifeOnChain: 0.05, rangeBoost: true } }
		}
	},
	// Detonating Vertex
	{
		id: 'detonating_vertex_001',
		family: 'Detonating Vertex',
		name: 'Detonating Vertex',
		category: 'Offense',
		effectType: 'conditional',
		effectTarget: 'explosiveAttacks',
		application: 'conditional',
		duration: 'instant',
		unlockCondition: { type: 'achievement', achievement: 'achieve_100_kills_one_run', alternative: { type: 'purchase', shards: 100 } },
		tradeOffs: { randomChance: true, canDamagePlayer: true },
		nonStacking: true,
		maxCopies: 2,
		qualityBands: {
			white: { value: 0.12, description: '12% explode (50% AoE)', flavorText: 'Unstable geometry', bonus: { aoe: 0.50 } },
			green: { value: 0.18, description: '18% explode (60% AoE)', flavorText: 'Volatile strike', bonus: { aoe: 0.60 } },
			blue: { value: 0.25, description: '25% explode (70% AoE)', flavorText: 'Explosive impact', bonus: { aoe: 0.70 } },
			purple: { value: 0.32, description: '32% explode (80% AoE); 20% chain', flavorText: 'Cascading detonation', bonus: { aoe: 0.80, chainChance: 0.20 } },
			orange: { value: 0.40, description: '40% explode (90% AoE); +3 cluster bombs (30% each)', flavorText: 'Fractal explosion.', bonus: { aoe: 0.90, clusters: { count: 3, multiplier: 0.30 } } }
		}
	},
	// Overcharge
	{
		id: 'overcharge_001',
		family: 'Overcharge',
		name: 'Overcharge',
		category: 'Offense',
		effectType: 'conditional',
		effectTarget: 'timedBurst',
		application: 'conditional',
		duration: 'temporary',
		unlockCondition: { type: 'achievement', achievement: 'clear_30_rooms_cumulative', alternative: { type: 'purchase', shards: 75 } },
		tradeOffs: { timeGated: true, requiresTiming: true },
		nonStacking: true,
		maxCopies: 2,
		qualityBands: {
			white: { value: 0.15, description: '+15% burst every 5s', flavorText: 'Power surge', bonus: { interval: 5 } },
			green: { value: 0.20, description: '+20% burst every 4s', flavorText: 'Energy spike', bonus: { interval: 4 } },
			blue: { value: 0.25, description: '+25% burst every 3s', flavorText: 'Voltage surge', bonus: { interval: 3 } },
			purple: { value: 0.30, description: '+30% burst every 3s; brief invulnerability', flavorText: 'Overwhelming power', bonus: { interval: 3, invuln: 0.3 } },
			orange: { value: 0.35, description: '+35% burst every 2s; invulnerability + haste', flavorText: 'Infinite potential.', bonus: { interval: 2, invuln: 0.3, moveSpeed: 0.15 } }
		}
	}
	,
	// Lifeline
	{
		id: 'lifeline_001',
		family: 'Lifeline',
		name: 'Lifeline',
		category: 'Defense',
		effectType: 'stat_modifier',
		effectTarget: 'lifesteal',
		application: 'passive',
		duration: 'persistent',
		unlockCondition: { type: 'room_milestone', room: 10, alternative: { type: 'purchase', shards: 50 } },
		tradeOffs: { requiresDealingDamage: true, lessEffectiveAtFullHP: true },
		nonStacking: false,
		maxCopies: 4,
		qualityBands: {
			white: { value: 0.03, description: '3% lifesteal', flavorText: 'Sustaining flow' },
			green: { value: 0.05, description: '5% lifesteal', flavorText: 'Vital drain' },
			blue: { value: 0.07, description: '7% lifesteal', flavorText: 'Life force' },
			purple: { value: 0.09, description: '9% lifesteal; heal burst at 100% HP (10%)', flavorText: 'Overflowing vitality', bonus: { overhealBurst: 0.10 } },
			orange: { value: 0.12, description: '12% lifesteal; burst 20% and damage boost at full', flavorText: 'Immortal geometry.', bonus: { overhealBurst: 0.20, damageBoostOnFull: 0.10, duration: 5 } }
		}
	},
	// Fortify Aura
	{
		id: 'fortify_aura_001',
		family: 'Fortify Aura',
		name: 'Fortify Aura',
		category: 'Defense',
		effectType: 'aura',
		effectTarget: 'defenseAura',
		application: 'passive',
		duration: 'persistent',
		unlockCondition: { type: 'room_milestone', room: 10, alternative: { type: 'purchase', shards: 75 }, bossDrop: { rooms: [11, 12, 13, 14, 15] } },
		tradeOffs: { requiresStayingNearAllies: true, reducedPersonalBenefit: true, limitedPositioning: true },
		nonStacking: true,
		maxCopies: 2,
		qualityBands: {
			white: { value: 0.05, description: '+5% defense aura (100px)', flavorText: 'Protective field', bonus: { radius: 100 } },
			green: { value: 0.08, description: '+8% defense aura (125px)', flavorText: 'Warding presence', bonus: { radius: 125 } },
			blue: { value: 0.12, description: '+12% defense aura (150px)', flavorText: 'Bastion field', bonus: { radius: 150 } },
			purple: { value: 0.16, description: '+16% aura (175px); reflects 15% melee', flavorText: 'Reflective barrier', bonus: { radius: 175, reflectMelee: 0.15 } },
			orange: { value: 0.20, description: '+20% aura (200px); reflect 25% and lifesteal to allies', flavorText: 'Geometric fortress.', bonus: { radius: 200, reflectMelee: 0.25, allyLifesteal: 0.05 } }
		}
	},
	// Phase Step
	{
		id: 'phase_step_001',
		family: 'Phase Step',
		name: 'Phase Step',
		category: 'Defense',
		effectType: 'stat_modifier',
		effectTarget: 'dodgeCharges',
		application: 'passive',
		duration: 'persistent',
		unlockCondition: { type: 'room_milestone', room: 10, alternative: { type: 'purchase', shards: 60 } },
		nonStacking: false,
		maxCopies: 4,
		qualityBands: {
			white: { value: 1, description: '+1 dodge charge', flavorText: 'Extra mobility' },
			green: { value: 1, description: '+1 dodge charge', flavorText: 'Enhanced evasion' },
			blue: { value: 2, description: '+2 dodge charges', flavorText: 'Masterful dodging' },
			purple: { value: 2, description: '+2 charges; 20% reset on kill', flavorText: 'Flowing movement', bonus: { resetOnKillChance: 0.20 } },
			orange: { value: 3, description: '+3 charges; reset on kill + invulnerability', flavorText: 'Infinite slip.', bonus: { resetOnKill: true, invuln: 0.2 } }
		}
	},
	// Phasing
	{
		id: 'phasing_001',
		family: 'Phasing',
		name: 'Phasing',
		category: 'Defense',
		effectType: 'conditional',
		effectTarget: 'phaseChance',
		application: 'conditional',
		duration: 'instant',
		unlockCondition: { type: 'achievement', achievement: 'dodge_500_attacks_lifetime', alternative: { type: 'purchase', shards: 100 } },
		tradeOffs: { randomChance: true, unreliable: true },
		nonStacking: true,
		maxCopies: 2,
		qualityBands: {
			white: { value: 0.10, description: '10% chance to phase', flavorText: 'Partial intangibility' },
			green: { value: 0.15, description: '15% chance to phase', flavorText: 'Ethereal form' },
			blue: { value: 0.20, description: '20% chance to phase', flavorText: 'Phase shifting' },
			purple: { value: 0.25, description: '25% chance; phasing grants brief invuln', flavorText: 'Quantum state', bonus: { invuln: 0.2 } },
			orange: { value: 0.30, description: '30% chance; invulnerability + movespeed', flavorText: 'Transcendent geometry.', bonus: { invuln: 0.25, moveSpeed: 0.15, duration: 2 } }
		}
	},
	// Prism Shield
	{
		id: 'prism_shield_001',
		family: 'Prism Shield',
		name: 'Prism Shield',
		category: 'Defense',
		effectType: 'stat_modifier',
		effectTarget: 'thorns',
		application: 'passive',
		duration: 'persistent',
		unlockCondition: { type: 'achievement', achievement: 'reflect_1000_damage_lifetime', alternative: { type: 'purchase', shards: 150 } },
		tradeOffs: { requiresTakingDamage: true, lessEffectiveVsRanged: true },
		nonStacking: false,
		maxCopies: 3,
		qualityBands: {
			white: { value: 0.15, description: '15% damage reflect', flavorText: 'Reactive defense' },
			green: { value: 0.20, description: '20% damage reflect', flavorText: 'Mirror shield' },
			blue: { value: 0.25, description: '25% damage reflect', flavorText: 'Prismatic barrier' },
			purple: { value: 0.30, description: '30% reflect; reflected heals 50%', flavorText: 'Vampiric reflection', bonus: { reflectHeal: 0.50 } },
			orange: { value: 0.35, description: '35% reflect; heals 100% and chains', flavorText: 'Infinite mirror.', bonus: { reflectHeal: 1.00, chain: true } }
		}
	},
	// Phoenix Down
	{
		id: 'phoenix_down_001',
		family: 'Phoenix Down',
		name: 'Phoenix Down',
		category: 'Defense',
		effectType: 'conditional',
		effectTarget: 'revive',
		application: 'conditional',
		duration: 'one_time',
		unlockCondition: { type: 'achievement', achievement: 'near_death_15_times_lifetime', alternative: { type: 'purchase', shards: 750, requiresFirstClear: true } },
		tradeOffs: { singleUse: true, onlyOnDeath: true, permanentLossOfSlot: true },
		nonStacking: true,
		maxCopies: 1,
		qualityBands: {
			// Drops only Orange; include only orange band to signal behavior
			orange: { value: 0.30, description: 'Revive at 30% HP (M5: 50%) + 20% dmg/10s at M5', flavorText: 'Rise from geometric ash', legendaryFlavor: 'Transcendent rebirth. Return stronger than before.', bonus: { mastery5ReviveHP: 0.50, mastery5DamageBoost: 0.20, mastery5Duration: 10 } }
		}
	}
	,
	// Vector Laminar
	{
		id: 'vector_laminar_001',
		family: 'Vector Laminar',
		name: 'Vector Laminar',
		category: 'Mobility',
		effectType: 'stat_modifier',
		effectTarget: 'projectileSpeed',
		application: 'passive',
		duration: 'persistent',
		unlockCondition: { type: 'room_milestone', room: 10, alternative: { type: 'purchase', shards: 40 } },
		nonStacking: false,
		maxCopies: 4,
		qualityBands: {
			white: { value: 0.15, description: '+15% projectile speed', flavorText: 'Faster bolts' },
			green: { value: 0.25, description: '+25% projectile speed', flavorText: 'Swift projectiles' },
			blue: { value: 0.35, description: '+35% projectile speed', flavorText: 'Lightning fast' },
			purple: { value: 0.45, description: '+45% projectile speed; 25% pierce chance', flavorText: 'Penetrating speed', bonus: { pierceChance: 0.25 } },
			orange: { value: 0.55, description: '+55% projectile speed; pierce all + range', flavorText: 'Infinite range.', bonus: { pierceAll: true, rangeBoost: true } }
		}
	},
	// Arcane Flow
	{
		id: 'arcane_flow_001',
		family: 'Arcane Flow',
		name: 'Arcane Flow',
		category: 'Mobility',
		effectType: 'stat_modifier',
		effectTarget: 'cooldownReduction',
		application: 'passive',
		duration: 'persistent',
		unlockCondition: { type: 'achievement', achievement: 'use_abilities_200_times_lifetime', alternative: { type: 'purchase', shards: 125 } },
		nonStacking: false,
		maxCopies: 3,
		qualityBands: {
			white: { value: 0.08, description: '8% cooldown reduction', flavorText: 'Faster recovery' },
			green: { value: 0.12, description: '12% cooldown reduction', flavorText: 'Quick recharge' },
			blue: { value: 0.16, description: '16% cooldown reduction', flavorText: 'Rapid cycling' },
			purple: { value: 0.20, description: '20% CDR; kills reduce CDs by 1s', flavorText: 'Flowing energy', bonus: { killReduce: 1 } },
			orange: { value: 0.25, description: '25% CDR; kills reset CDs + invuln', flavorText: 'Infinite cycle.', bonus: { killReset: true, invuln: 0.2 } }
		}
	},
	// Parallelogram Slip
	{
		id: 'parallelogram_slip_001',
		family: 'Parallelogram Slip',
		name: 'Parallelogram Slip',
		category: 'Mobility',
		effectType: 'stat_modifier',
		effectTarget: 'dodgeCooldown',
		application: 'passive',
		duration: 'persistent',
		unlockCondition: { type: 'achievement', achievement: 'dodge_300_times_lifetime', alternative: { type: 'purchase', shards: 75 } },
		nonStacking: false,
		maxCopies: 3,
		qualityBands: {
			white: { value: -0.3, description: '-0.3s dodge cooldown', flavorText: 'Quicker dodge' },
			green: { value: -0.5, description: '-0.5s dodge cooldown', flavorText: 'Faster evasion' },
			blue: { value: -0.7, description: '-0.7s dodge cooldown', flavorText: 'Rapid dodge' },
			purple: { value: -1.0, description: '-1.0s; dodge grants +10% speed 2s', flavorText: 'Flowing dodge', bonus: { moveSpeedOnDodge: { value: 0.10, duration: 2 } } },
			orange: { value: -1.5, description: '-1.5s; +20% speed and invuln', flavorText: 'Infinite slip.', bonus: { moveSpeedOnDodge: { value: 0.20, duration: 2 }, invulnOnDodge: 0.2 } }
		}
	}
	,
	// Ability Mutators (Square)
	{
		id: 'whirlwind_core_001',
		family: 'Whirlwind Core',
		name: 'Whirlwind Core',
		category: 'Ability',
		effectType: 'ability_modifier',
		effectTarget: 'square_whirlwind',
		application: 'passive',
		duration: 'persistent',
		unlockCondition: { type: 'room_milestone', room: 15, alternative: { type: 'purchase', shards: 100 }, classRestriction: 'square' },
		tradeOffs: { requiresMeleeRange: true, canBeInterrupted: true, locksPlayerInPlace: true },
		nonStacking: true,
		maxCopies: 2,
		qualityBands: {
			white: { value: 1, description: '+1s whirlwind duration', flavorText: 'Extended spin' },
			green: { value: 0.40, description: '+40% whirlwind damage', flavorText: 'Powerful rotation' },
			blue: { value: 1, description: 'Adds pull effect', flavorText: 'Vortex force' },
			purple: { value: 1, description: 'Adds damage aura', flavorText: 'Blade storm' },
			orange: { value: 1, description: 'Resets cooldown on kill', flavorText: 'Infinite rotation.' }
		}
	},
	{
		id: 'thrust_focus_001',
		family: 'Thrust Focus',
		name: 'Thrust Focus',
		category: 'Ability',
		effectType: 'ability_modifier',
		effectTarget: 'square_thrust',
		application: 'passive',
		duration: 'persistent',
		unlockCondition: { type: 'room_milestone', room: 15, alternative: { type: 'purchase', shards: 100 }, classRestriction: 'square' },
		tradeOffs: { linearAttack: true, requiresPositioning: true, commitsToForwardMovement: true },
		nonStacking: true,
		maxCopies: 2,
		qualityBands: {
			white: { value: 100, description: '+100 thrust range', flavorText: 'Extended reach' },
			green: { value: 0.40, description: '+40% thrust damage', flavorText: 'Powerful thrust' },
			blue: { value: 1, description: 'Adds knockback', flavorText: 'Forceful strike' },
			purple: { value: 1, description: 'Adds pierce', flavorText: 'Penetrating thrust' },
			orange: { value: 1, description: 'Infinite range, pierces, burning trail 2s', flavorText: 'Fractal thrust.' }
		}
	},
	{
		id: 'block_stance_001',
		family: 'Block Stance',
		name: 'Block Stance',
		category: 'Ability',
		effectType: 'ability_modifier',
		effectTarget: 'square_block',
		application: 'passive',
		duration: 'persistent',
		unlockCondition: { type: 'achievement', achievement: 'block_200_attacks_lifetime', alternative: { type: 'purchase', shards: 125 }, classRestriction: 'square' },
		tradeOffs: { requiresStandingStill: true, preventsMovementAndAttacks: true },
		nonStacking: true,
		maxCopies: 2,
		qualityBands: {
			white: { value: 0.20, description: '+20% block reduction', flavorText: 'Stronger block' },
			green: { value: 0.30, description: '+30% block reduction', flavorText: 'Reinforced block' },
			blue: { value: 0.40, description: '+40% block reduction', flavorText: 'Perfect block' },
			purple: { value: 0.50, description: '+50% block; blocking grants +10% damage', flavorText: 'Counter stance' },
			orange: { value: 0.50, description: 'Blocking grants +20% dmg and reflects', flavorText: 'Absolute defense.' }
		}
	},
	// Ability Mutators (Triangle)
	{
		id: 'fan_of_knives_plus_001',
		family: 'Fan of Knives+',
		name: 'Fan of Knives+',
		category: 'Ability',
		effectType: 'ability_modifier',
		effectTarget: 'triangle_fok',
		application: 'passive',
		duration: 'persistent',
		unlockCondition: { type: 'room_milestone', room: 15, alternative: { type: 'purchase', shards: 100 }, classRestriction: 'triangle' },
		tradeOffs: { spreadReducesAccuracy: true, requiresCloseRange: true },
		nonStacking: true,
		maxCopies: 2,
		qualityBands: {
			white: { value: 2, description: '+2 knives', flavorText: 'More blades' },
			green: { value: 4, description: '+4 knives', flavorText: 'Blade fan' },
			blue: { value: 5, description: '+5 knives', flavorText: 'Knife storm' },
			purple: { value: 7, description: '+7 knives; 25% pierce chance', flavorText: 'Penetrating fan' },
			orange: { value: 1, description: 'Knives return to player', flavorText: 'Boomerang geometry.' }
		}
	},
	{
		id: 'shadow_clone_001',
		family: 'Shadow Clone',
		name: 'Shadow Clone',
		category: 'Ability',
		effectType: 'ability_modifier',
		effectTarget: 'triangle_clone',
		application: 'passive',
		duration: 'persistent',
		unlockCondition: { type: 'room_milestone', room: 15, alternative: { type: 'purchase', shards: 100 }, classRestriction: 'triangle' },
		tradeOffs: { limitedDuration: true, canBeDestroyed: true, temporaryAndVulnerable: true },
		nonStacking: true,
		maxCopies: 2,
		qualityBands: {
			white: { value: 1, description: '+1 clone', flavorText: 'Single decoy' },
			green: { value: 2, description: '+2 clones', flavorText: 'Twin shadows' },
			blue: { value: 3, description: '+3 clones', flavorText: 'Multiple decoys' },
			purple: { value: 4, description: '+4 clones; clones deal 25% dmg', flavorText: 'Combat clones', bonus: { cloneDamage: 0.25 } },
			orange: { value: 1, description: 'Clones explode on death', flavorText: 'Volatile shadows.' }
		}
	},
	{
		id: 'backstab_edge_001',
		family: 'Backstab Edge',
		name: 'Backstab Edge',
		category: 'Ability',
		effectType: 'ability_modifier',
		effectTarget: 'triangle_backstab',
		application: 'passive',
		duration: 'persistent',
		unlockCondition: { type: 'achievement', achievement: 'deal_5000_backstab_damage_lifetime', alternative: { type: 'purchase', shards: 125 }, classRestriction: 'triangle' },
		tradeOffs: { requiresPositioningBehind: true, onlyBenefitsFromRearAttacks: true, requiresFlanking: true },
		nonStacking: true,
		maxCopies: 2,
		qualityBands: {
			white: { value: 0.25, description: '+25% backstab damage', flavorText: 'Sharpened edge' },
			green: { value: 0.35, description: '+35% backstab damage', flavorText: 'Deadly strike' },
			blue: { value: 0.45, description: '+45% backstab damage', flavorText: 'Lethal backstab' },
			purple: { value: 0.55, description: '+55% backstab; 25% chain', flavorText: 'Cascading strike', bonus: { chainChance: 0.25 } },
			orange: { value: 0.60, description: '+60% backstab; kill grants 3s stealth and resets CD', flavorText: 'Fractal assassination.' }
		}
	},
	// Ability Mutators (Hexagon)
	{
		id: 'blink_flux_001',
		family: 'Blink Flux',
		name: 'Blink Flux',
		category: 'Ability',
		effectType: 'ability_modifier',
		effectTarget: 'hexagon_blink',
		application: 'passive',
		duration: 'persistent',
		unlockCondition: { type: 'room_milestone', room: 15, alternative: { type: 'purchase', shards: 100 }, classRestriction: 'hexagon' },
		tradeOffs: { requiresPositioning: true, canBeDisorienting: true, canTeleportIntoDanger: true },
		nonStacking: true,
		maxCopies: 2,
		qualityBands: {
			white: { value: 150, description: '+150 blink range', flavorText: 'Extended teleport' },
			green: { value: 0.80, description: '+80% blink damage', flavorText: 'Powerful blink' },
			blue: { value: 2, description: 'Chain blink (2x)', flavorText: 'Double blink' },
			purple: { value: 1, description: 'Blink leaves damaging trail', flavorText: 'Blazing trail' },
			orange: { value: 1, description: 'Trail + resets on kill', flavorText: 'Infinite teleport.' }
		}
	},
	{
		id: 'beam_mastery_001',
		family: 'Beam Mastery',
		name: 'Beam Mastery',
		category: 'Ability',
		effectType: 'ability_modifier',
		effectTarget: 'hexagon_beam',
		application: 'passive',
		duration: 'persistent',
		unlockCondition: { type: 'achievement', achievement: 'deal_10000_beam_damage_lifetime', alternative: { type: 'purchase', shards: 125 }, classRestriction: 'hexagon' },
		tradeOffs: { requiresChanneling: true, canBeInterrupted: true, mustRemainStationary: true },
		nonStacking: true,
		maxCopies: 2,
		qualityBands: {
			white: { value: 1, description: '+1 beam charge', flavorText: 'Extra beam' },
			green: { value: -0.25, description: '-25% beam tick rate', flavorText: 'Faster ticks' },
			blue: { value: 0.50, description: '+50% beam duration', flavorText: 'Longer beam' },
			purple: { value: 1, description: '+1 beam penetration', flavorText: 'Piercing beam' },
			orange: { value: 1, description: 'Beam splits on hit', flavorText: 'Fractal beam.' }
		}
	},
	// Ability Mutators (Pentagon)
	{
		id: 'shield_bulwark_001',
		family: 'Shield Bulwark',
		name: 'Shield Bulwark',
		category: 'Ability',
		effectType: 'ability_modifier',
		effectTarget: 'pentagon_shield',
		application: 'passive',
		duration: 'persistent',
		unlockCondition: { type: 'room_milestone', room: 15, alternative: { type: 'purchase', shards: 100 }, classRestriction: 'pentagon' },
		tradeOffs: { requiresTiming: true, canBeBrokenEarly: true },
		nonStacking: true,
		maxCopies: 2,
		qualityBands: {
			white: { value: 1, description: '+1s shield duration', flavorText: 'Longer shield' },
			green: { value: 0.80, description: '+80% shield wave damage', flavorText: 'Powerful wave' },
			blue: { value: 1, description: 'Larger wave radius', flavorText: 'Expansive wave' },
			purple: { value: 1, description: 'Damage reduction while shielding', flavorText: 'Fortified shield' },
			orange: { value: 1, description: 'Shield explodes on break', flavorText: 'Volatile defense.' }
		}
	},
	{
		id: 'hammer_smash_001',
		family: 'Hammer Smash',
		name: 'Hammer Smash',
		category: 'Ability',
		effectType: 'ability_modifier',
		effectTarget: 'pentagon_hammer',
		application: 'passive',
		duration: 'persistent',
		unlockCondition: { type: 'achievement', achievement: 'stun_100_enemies_lifetime', alternative: { type: 'purchase', shards: 125 }, classRestriction: 'pentagon' },
		tradeOffs: { requiresCloseRange: true, longWindup: true, vulnerableDuringWindup: true },
		nonStacking: true,
		maxCopies: 2,
		qualityBands: {
			white: { value: 40, description: '+40 radius', flavorText: 'Larger smash' },
			green: { value: 0.50, description: '+50% knockback', flavorText: 'Forceful smash' },
			blue: { value: 1, description: 'Stun effect', flavorText: 'Stunning smash' },
			purple: { value: 1, description: 'Damage zone (lingering)', flavorText: 'Cratering smash' },
			orange: { value: 1, description: 'Creates outward shockwave', flavorText: 'Seismic geometry.' }
		}
	}
];


