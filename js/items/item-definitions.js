// Item System - Item Definitions
// Defines all items, their effects, stacking behavior, and rarity

// Logarithmic scaling helper function
// Uses log2 scaling for diminishing returns: stack 1 = baseValue, stack 2 ≈ 1.58x, stack 4 ≈ 2x, etc.
function logarithmicScale(baseValue, stacks) {
    if (stacks <= 0) return 0;
    // Formula: baseValue * (1 + log2(stacks))
    // This gives: stack 1 = baseValue, stack 2 ≈ baseValue * 1.58, stack 4 = baseValue * 2, etc.
    return baseValue * (1 + Math.log2(stacks));
}

const ITEM_DEFINITIONS = {
    // ===== DEFENSIVE ITEMS =====

    shield_generator: {
        id: 'shield_generator',
        name: 'Shield Generator',
        rarity: 'common',
        category: 'defensive',
        description: 'Gain a shield equal to {value}% max HP that regenerates after 5s without damage',
        stackDescription: 'Shield: {totalValue}% max HP (+{value}% per stack)',
        icon: 'shield',
        effectType: 'shield',
        baseValue: 10,
        stackingType: 'additive',
        maxStacks: null, // Infinite stacking, linear scaling

        applyEffect: function (player, stacks) {
            const totalValue = this.baseValue * stacks;
            const oldPercent = player.itemShieldPercent || 0;
            player.itemShieldPercent = (player.itemShieldPercent || 0) + totalValue;

            // Initialize shield health to max when first applied or when max increases
            if (player.itemShieldPercent > 0 && player.maxHp > 0) {
                const newMaxShield = player.maxHp * (player.itemShieldPercent / 100);
                if (oldPercent === 0 || player.shieldHealth === undefined || player.shieldHealth === 0) {
                    // First time getting shield or shield was at 0, set to max
                    player.shieldHealth = newMaxShield;
                } else {
                    // Shield already exists, scale it proportionally
                    const oldMaxShield = player.maxHp * (oldPercent / 100);
                    if (oldMaxShield > 0) {
                        player.shieldHealth = (player.shieldHealth / oldMaxShield) * newMaxShield;
                    } else {
                        player.shieldHealth = newMaxShield;
                    }
                }
                player.maxShieldHealth = newMaxShield;
            }
        },

        removeEffect: function (player, stacks) {
            const totalValue = this.baseValue * stacks;
            player.itemShieldPercent = Math.max(0, (player.itemShieldPercent || 0) - totalValue);
        },

        getTooltip: function (stacks) {
            const totalValue = this.baseValue * stacks;
            return this.stackDescription
                .replace('{totalValue}', totalValue)
                .replace('{value}', this.baseValue);
        }
    },

    reactive_armor: {
        id: 'reactive_armor',
        name: 'Reactive Armor',
        rarity: 'common',
        category: 'defensive',
        description: 'When hit, gain +{value}% damage reduction for 2s (stacks up to {maxReduction}%)',
        stackDescription: '+{value}% damage reduction per hit (max {maxReduction}%, +{stackBonus}% max per stack)',
        icon: 'armor',
        effectType: 'reactive_defense',
        baseValue: 5,
        stackingType: 'additive_cap',
        maxStacks: null, // Infinite stacking, cap increases linearly with stacks

        applyEffect: function (player, stacks) {
            player.reactiveArmorValue = this.baseValue;
            player.reactiveArmorMaxCap = 25 + (stacks - 1) * 5;
            player.reactiveArmorDuration = 2.0;
        },

        removeEffect: function (player, stacks) {
            player.reactiveArmorValue = 0;
            player.reactiveArmorMaxCap = 0;
        },

        getTooltip: function (stacks) {
            const maxReduction = 25 + (stacks - 1) * 5;
            const stackBonus = (stacks - 1) * 5;
            return this.stackDescription
                .replace('{value}', this.baseValue)
                .replace('{maxReduction}', maxReduction)
                .replace('{stackBonus}', stackBonus);
        }
    },

    // DISABLED: Regenerative Matrix - healing too fast, needs rebalancing
    // regenerative_matrix: {
    //     id: 'regenerative_matrix',
    //     name: 'Regenerative Matrix',
    //     rarity: 'common',
    //     category: 'defensive',
    //     description: 'Regenerate {value}% max HP per second',
    //     stackDescription: 'Regenerate {totalValue}% max HP/sec (+{value}% per stack)',
    //     icon: 'regen',
    //     effectType: 'hp_regen',
    //     baseValue: 1,
    //     stackingType: 'additive',
    //     maxStacks: null, // Infinite stacking, linear scaling

    //     applyEffect: function (player, stacks) {
    //         const totalValue = this.baseValue * stacks;
    //         player.itemHpRegenPercent = (player.itemHpRegenPercent || 0) + totalValue;
    //     },

    //     removeEffect: function (player, stacks) {
    //         const totalValue = this.baseValue * stacks;
    //         player.itemHpRegenPercent = Math.max(0, (player.itemHpRegenPercent || 0) - totalValue);
    //     },

    //     getTooltip: function (stacks) {
    //         const totalValue = this.baseValue * stacks;
    //         return this.stackDescription
    //             .replace('{totalValue}', totalValue)
    //             .replace('{value}', this.baseValue);
    //     }
    // },

    thornmail_fragment: {
        id: 'thornmail_fragment',
        name: 'Thornmail Fragment',
        rarity: 'uncommon',
        category: 'defensive',
        description: 'Reflect {value}% of damage taken back to attackers (scales logarithmically)',
        stackDescription: 'Reflect {totalValue}% damage (scales logarithmically)',
        icon: 'thorns',
        effectType: 'reflect',
        baseValue: 10,
        stackingType: 'logarithmic',
        maxStacks: null, // Infinite stacking, logarithmic scaling

        applyEffect: function (player, stacks) {
            const totalValue = logarithmicScale(this.baseValue, stacks);
            player.itemReflectPercent = (player.itemReflectPercent || 0) + totalValue;
        },

        removeEffect: function (player, stacks) {
            const totalValue = logarithmicScale(this.baseValue, stacks);
            player.itemReflectPercent = Math.max(0, (player.itemReflectPercent || 0) - totalValue);
        },

        getTooltip: function (stacks) {
            const totalValue = logarithmicScale(this.baseValue, stacks);
            return this.stackDescription
                .replace('{totalValue}', totalValue.toFixed(1));
        }
    },

    // ===== OFFENSIVE ITEMS =====

    fractal_shard: {
        id: 'fractal_shard',
        name: 'Fractal Shard',
        rarity: 'common',
        category: 'offensive',
        description: '+{value}% damage (scales logarithmically)',
        stackDescription: '+{totalValue}% damage (scales logarithmically)',
        icon: 'shard',
        effectType: 'damage_boost',
        baseValue: 10,
        stackingType: 'logarithmic',
        maxStacks: null, // Infinite stacking, logarithmic scaling

        applyEffect: function (player, stacks) {
            const totalValue = logarithmicScale(this.baseValue, stacks);
            player.itemDamageBonus = (player.itemDamageBonus || 0) + totalValue / 100;
        },

        removeEffect: function (player, stacks) {
            const totalValue = logarithmicScale(this.baseValue, stacks);
            player.itemDamageBonus = Math.max(0, (player.itemDamageBonus || 0) - totalValue / 100);
        },

        getTooltip: function (stacks) {
            const totalValue = logarithmicScale(this.baseValue, stacks);
            return this.stackDescription
                .replace('{totalValue}', totalValue.toFixed(1));
        }
    },

    critical_lens: {
        id: 'critical_lens',
        name: 'Critical Lens',
        rarity: 'common',
        category: 'offensive',
        description: '+{critChance}% crit chance, +{critDamage}% crit damage (scales logarithmically)',
        stackDescription: '+{totalCritChance}% crit chance, +{totalCritDamage}% crit damage (scales logarithmically)',
        icon: 'lens',
        effectType: 'crit_boost',
        baseCritChance: 5,
        baseCritDamage: 10,
        stackingType: 'logarithmic',
        maxStacks: null, // Infinite stacking, logarithmic scaling

        applyEffect: function (player, stacks) {
            const totalCritChance = logarithmicScale(this.baseCritChance, stacks);
            const totalCritDamage = logarithmicScale(this.baseCritDamage, stacks);
            player.itemCritChance = (player.itemCritChance || 0) + totalCritChance / 100;
            player.itemCritDamage = (player.itemCritDamage || 0) + totalCritDamage / 100;
        },

        removeEffect: function (player, stacks) {
            const totalCritChance = logarithmicScale(this.baseCritChance, stacks);
            const totalCritDamage = logarithmicScale(this.baseCritDamage, stacks);
            player.itemCritChance = Math.max(0, (player.itemCritChance || 0) - totalCritChance / 100);
            player.itemCritDamage = Math.max(0, (player.itemCritDamage || 0) - totalCritDamage / 100);
        },

        getTooltip: function (stacks) {
            const totalCritChance = logarithmicScale(this.baseCritChance, stacks);
            const totalCritDamage = logarithmicScale(this.baseCritDamage, stacks);
            return this.stackDescription
                .replace('{totalCritChance}', totalCritChance.toFixed(1))
                .replace('{totalCritDamage}', totalCritDamage.toFixed(1));
        }
    },

    fury_catalyst: {
        id: 'fury_catalyst',
        name: 'Fury Catalyst',
        rarity: 'common',
        category: 'offensive',
        description: '+{attackSpeed}% attack speed, +{damage}% damage (scales logarithmically)',
        stackDescription: '+{totalAttackSpeed}% attack speed, +{totalDamage}% damage (scales logarithmically)',
        icon: 'fury',
        effectType: 'fury',
        baseAttackSpeed: 5,
        baseDamage: 2,
        stackingType: 'logarithmic',
        maxStacks: null, // Infinite stacking, logarithmic scaling

        applyEffect: function (player, stacks) {
            const totalAttackSpeed = logarithmicScale(this.baseAttackSpeed, stacks);
            const totalDamage = logarithmicScale(this.baseDamage, stacks);
            player.itemAttackSpeedBonus = (player.itemAttackSpeedBonus || 0) + totalAttackSpeed / 100;
            player.itemDamageBonus = (player.itemDamageBonus || 0) + totalDamage / 100;
        },

        removeEffect: function (player, stacks) {
            const totalAttackSpeed = logarithmicScale(this.baseAttackSpeed, stacks);
            const totalDamage = logarithmicScale(this.baseDamage, stacks);
            player.itemAttackSpeedBonus = Math.max(0, (player.itemAttackSpeedBonus || 0) - totalAttackSpeed / 100);
            player.itemDamageBonus = Math.max(0, (player.itemDamageBonus || 0) - totalDamage / 100);
        },

        getTooltip: function (stacks) {
            const totalAttackSpeed = logarithmicScale(this.baseAttackSpeed, stacks);
            const totalDamage = logarithmicScale(this.baseDamage, stacks);
            return this.stackDescription
                .replace('{totalAttackSpeed}', totalAttackSpeed.toFixed(1))
                .replace('{totalDamage}', totalDamage.toFixed(1));
        }
    },

    damage_aura: {
        id: 'damage_aura',
        name: 'Damage Aura',
        rarity: 'uncommon',
        category: 'offensive',
        description: 'Enemies within {radius}px take {damage}% of your damage per second (damage scales logarithmically, radius scales linearly)',
        stackDescription: '{damage}% player damage/sec within {radius}px (damage scales logarithmically)',
        icon: 'aura_damage',
        effectType: 'damage_aura',
        baseRadius: 120,
        baseDamagePercent: 50,
        stackingType: 'logarithmic',
        maxStacks: null, // Infinite stacking, logarithmic scaling (damage), linear (radius)

        applyEffect: function (player, stacks) {
            const totalRadius = this.baseRadius + (stacks - 1) * 5; // +5px per stack (linear)
            const totalDamage = logarithmicScale(this.baseDamagePercent, stacks); // Logarithmic scaling
            player.itemDamageAuraRadius = totalRadius;
            player.itemDamageAuraPercent = totalDamage;
        },

        removeEffect: function (player, stacks) {
            player.itemDamageAuraRadius = 0;
            player.itemDamageAuraPercent = 0;
        },

        getTooltip: function (stacks) {
            const totalRadius = this.baseRadius + (stacks - 1) * 5;
            const totalDamage = logarithmicScale(this.baseDamagePercent, stacks);
            return this.stackDescription
                .replace('{damage}', totalDamage.toFixed(1))
                .replace('{radius}', totalRadius);
        }
    },

    chain_reaction: {
        id: 'chain_reaction',
        name: 'Chain Reaction',
        rarity: 'uncommon',
        category: 'offensive',
        description: 'On kill: {damage}% max HP as AoE damage ({radius}px radius) (damage scales logarithmically, radius scales linearly)',
        stackDescription: '{damage}% max HP AoE on kill ({radius}px radius) (damage scales logarithmically)',
        icon: 'chain',
        effectType: 'on_kill_aoe',
        baseDamagePercent: 15,
        baseRadius: 50,
        stackingType: 'logarithmic',
        maxStacks: null, // Infinite stacking, logarithmic scaling (damage), linear (radius)

        applyEffect: function (player, stacks) {
            const totalDamage = logarithmicScale(this.baseDamagePercent, stacks); // Logarithmic scaling
            const totalRadius = this.baseRadius + (stacks - 1) * 5; // +5px per stack (linear)
            player.itemChainReactionDamage = totalDamage;
            player.itemChainReactionRadius = totalRadius;
        },

        removeEffect: function (player, stacks) {
            player.itemChainReactionDamage = 0;
            player.itemChainReactionRadius = 0;
        },

        getTooltip: function (stacks) {
            const totalDamage = logarithmicScale(this.baseDamagePercent, stacks);
            const totalRadius = this.baseRadius + (stacks - 1) * 5;
            return this.stackDescription
                .replace('{damage}', totalDamage.toFixed(1))
                .replace('{radius}', totalRadius);
        }
    },

    bleeding_edge: {
        id: 'bleeding_edge',
        name: 'Bleeding Edge',
        rarity: 'uncommon',
        category: 'offensive',
        description: 'Attacks apply {damage}% max enemy HP/sec bleed for {duration}s (stacks {maxStacks}x, scales logarithmically)',
        stackDescription: '{damage}% max HP/sec bleed for {duration}s (stacks {maxStacks}x, scales logarithmically)',
        icon: 'bleed',
        effectType: 'bleed_on_hit',
        baseDamagePercent: 2,
        baseDuration: 3,
        maxStacks: 5, // Max stacks of the bleed effect itself (on enemies)
        stackingType: 'logarithmic',
        maxItemStacks: null, // Infinite stacking, logarithmic scaling

        applyEffect: function (player, stacks) {
            const totalDamage = logarithmicScale(this.baseDamagePercent, stacks); // Logarithmic scaling
            player.itemBleedDamagePercent = totalDamage;
            player.itemBleedDuration = this.baseDuration;
            player.itemBleedMaxStacks = this.maxStacks;
        },

        removeEffect: function (player, stacks) {
            player.itemBleedDamagePercent = 0;
            player.itemBleedDuration = 0;
            player.itemBleedMaxStacks = 0;
        },

        getTooltip: function (stacks) {
            const totalDamage = logarithmicScale(this.baseDamagePercent, stacks);
            return this.stackDescription
                .replace('{damage}', totalDamage.toFixed(1))
                .replace('{duration}', this.baseDuration)
                .replace('{maxStacks}', this.maxStacks);
        }
    },

    executioners_mark: {
        id: 'executioners_mark',
        name: 'Executioner\'s Mark',
        rarity: 'uncommon',
        category: 'offensive',
        description: '+{damage}% damage to enemies below {threshold}% HP (up to {maxThreshold}% threshold, damage scales logarithmically, threshold scales linearly)',
        stackDescription: '+{damage}% damage below {threshold}% HP (damage scales logarithmically)',
        icon: 'execute',
        effectType: 'execute_damage',
        baseDamagePercent: 25,
        baseThreshold: 30,
        baseMaxThreshold: 50,
        stackingType: 'logarithmic',
        maxStacks: null, // Infinite stacking, logarithmic scaling (damage), linear (threshold)

        applyEffect: function (player, stacks) {
            const totalDamage = logarithmicScale(this.baseDamagePercent, stacks); // Logarithmic scaling
            const totalThreshold = Math.min(this.baseMaxThreshold, this.baseThreshold + (stacks - 1) * 5); // Linear with cap
            player.itemExecuteDamagePercent = totalDamage;
            player.itemExecuteThreshold = totalThreshold;
        },

        removeEffect: function (player, stacks) {
            player.itemExecuteDamagePercent = 0;
            player.itemExecuteThreshold = 0;
        },

        getTooltip: function (stacks) {
            const totalDamage = logarithmicScale(this.baseDamagePercent, stacks);
            const totalThreshold = Math.min(this.baseMaxThreshold, this.baseThreshold + (stacks - 1) * 5);
            return this.stackDescription
                .replace('{damage}', totalDamage.toFixed(1))
                .replace('{threshold}', totalThreshold);
        }
    },

    volatile_core: {
        id: 'volatile_core',
        name: 'Volatile Core',
        rarity: 'rare',
        category: 'offensive',
        description: '{chance}% chance on hit to explode ({damage}% damage, {radius}px radius) (chance and damage scale logarithmically, radius scales linearly)',
        stackDescription: '{chance}% chance to explode ({damage}% damage, {radius}px radius) (chance and damage scale logarithmically)',
        icon: 'volatile',
        effectType: 'explosion_on_hit',
        baseChance: 10,
        baseDamagePercent: 50,
        baseRadius: 40,
        stackingType: 'logarithmic',
        maxStacks: null, // Infinite stacking, logarithmic scaling (chance and damage), linear (radius)

        applyEffect: function (player, stacks) {
            const totalChance = Math.min(100, logarithmicScale(this.baseChance, stacks)); // Logarithmic with 100% cap
            const totalDamage = logarithmicScale(this.baseDamagePercent, stacks); // Logarithmic scaling
            const totalRadius = this.baseRadius + (stacks - 1) * 5; // +5px per stack (linear)
            player.itemVolatileChance = totalChance / 100;
            player.itemVolatileDamagePercent = totalDamage;
            player.itemVolatileRadius = totalRadius;
        },

        removeEffect: function (player, stacks) {
            player.itemVolatileChance = 0;
            player.itemVolatileDamagePercent = 0;
            player.itemVolatileRadius = 0;
        },

        getTooltip: function (stacks) {
            const totalChance = Math.min(100, logarithmicScale(this.baseChance, stacks));
            const totalDamage = logarithmicScale(this.baseDamagePercent, stacks);
            const totalRadius = this.baseRadius + (stacks - 1) * 5;
            return this.stackDescription
                .replace('{chance}', totalChance.toFixed(1))
                .replace('{damage}', totalDamage.toFixed(1))
                .replace('{radius}', totalRadius);
        }
    },

    piercing_strike: {
        id: 'piercing_strike',
        name: 'Piercing Strike',
        rarity: 'rare',
        category: 'offensive',
        description: 'Attacks pierce {count} enemy ({damage}% damage to second target)',
        stackDescription: 'Pierce {count} enemy ({damage}% damage)',
        icon: 'pierce',
        effectType: 'pierce',
        basePierceCount: 1,
        basePierceDamagePercent: 80,
        stackingType: 'additive',
        maxStacks: null, // Infinite stacking, linear scaling (discrete mechanic)

        applyEffect: function (player, stacks) {
            const totalPierce = this.basePierceCount * stacks;
            const totalDamage = this.basePierceDamagePercent; // Damage percent doesn't stack, stays at 80%
            player.itemPierceCount = (player.itemPierceCount || 0) + totalPierce;
            player.itemPierceDamagePercent = totalDamage / 100;
        },

        removeEffect: function (player, stacks) {
            const totalPierce = this.basePierceCount * stacks;
            player.itemPierceCount = Math.max(0, (player.itemPierceCount || 0) - totalPierce);
            if (player.itemPierceCount <= 0) {
                player.itemPierceDamagePercent = 0;
            }
        },

        getTooltip: function (stacks) {
            const totalPierce = this.basePierceCount * stacks;
            return this.stackDescription
                .replace('{count}', totalPierce)
                .replace('{damage}', this.basePierceDamagePercent);
        }
    },

    // ===== UTILITY ITEMS =====

    speed_boost_module: {
        id: 'speed_boost_module',
        name: 'Speed Boost Module',
        rarity: 'common',
        category: 'utility',
        description: '+{value}% movement speed',
        stackDescription: '+{totalValue}% movement speed (+{value}% per stack)',
        icon: 'speed',
        effectType: 'speed_boost',
        baseValue: 8,
        stackingType: 'additive',
        maxStacks: null, // Infinite stacking, linear scaling

        applyEffect: function (player, stacks) {
            const totalValue = this.baseValue * stacks;
            player.itemSpeedBonus = (player.itemSpeedBonus || 0) + totalValue / 100;
        },

        removeEffect: function (player, stacks) {
            const totalValue = this.baseValue * stacks;
            player.itemSpeedBonus = Math.max(0, (player.itemSpeedBonus || 0) - totalValue / 100);
        },

        getTooltip: function (stacks) {
            const totalValue = this.baseValue * stacks;
            return this.stackDescription
                .replace('{totalValue}', totalValue)
                .replace('{value}', this.baseValue);
        }
    },

    slow_aura: {
        id: 'slow_aura',
        name: 'Slow Aura',
        rarity: 'uncommon',
        category: 'defensive',
        description: 'Enemies within {radius}px are slowed by {slow}% movement speed (slow scales logarithmically, radius scales linearly)',
        stackDescription: '{slow}% slow within {radius}px (slow scales logarithmically)',
        icon: 'aura_slow',
        effectType: 'slow_aura',
        baseRadius: 80,
        baseSlowPercent: 15,
        stackingType: 'logarithmic',
        maxStacks: null, // Infinite stacking, logarithmic scaling (slow), linear (radius)

        applyEffect: function (player, stacks) {
            const totalRadius = this.baseRadius + (stacks - 1) * 10; // +10px per stack (linear)
            const totalSlow = Math.min(100, logarithmicScale(this.baseSlowPercent, stacks)); // Logarithmic with 100% cap
            player.itemSlowAuraRadius = totalRadius;
            player.itemSlowAuraPercent = totalSlow;
        },

        removeEffect: function (player, stacks) {
            player.itemSlowAuraRadius = 0;
            player.itemSlowAuraPercent = 0;
        },

        getTooltip: function (stacks) {
            const totalRadius = this.baseRadius + (stacks - 1) * 10;
            const totalSlow = Math.min(100, logarithmicScale(this.baseSlowPercent, stacks));
            return this.stackDescription
                .replace('{slow}', totalSlow.toFixed(1))
                .replace('{radius}', totalRadius);
        }
    },

    cooldown_reducer: {
        id: 'cooldown_reducer',
        name: 'Cooldown Reducer',
        rarity: 'uncommon',
        category: 'utility',
        description: '-{value}% cooldown reduction per stack (multiplicative)',
        stackDescription: '{totalReduction}% cooldown reduction',
        icon: 'cooldown',
        effectType: 'cooldown_reduction',
        baseValue: 5,
        stackingType: 'multiplicative',
        maxStacks: null, // Infinite stacking, multiplicative scaling (already has diminishing returns)

        applyEffect: function (player, stacks) {
            // Multiplicative: each stack multiplies by 0.95 (5% reduction)
            // Total reduction = 1 - (0.95^stacks)
            const multiplier = Math.pow(0.95, stacks);
            const totalReduction = (1 - multiplier) * 100;
            player.itemCooldownReduction = totalReduction / 100;
        },

        removeEffect: function (player, stacks) {
            player.itemCooldownReduction = 0;
        },

        getTooltip: function (stacks) {
            const multiplier = Math.pow(0.95, stacks);
            const totalReduction = (1 - multiplier) * 100;
            return this.stackDescription
                .replace('{totalReduction}', totalReduction.toFixed(1));
        }
    }
};

// Rarity weights for drops
const ITEM_RARITY_WEIGHTS = {
    common: 45,
    uncommon: 35,
    rare: 17,
    epic: 8
};

// Get random item based on rarity weights
function getRandomItem() {
    const totalWeight = Object.values(ITEM_RARITY_WEIGHTS).reduce((a, b) => a + b, 0);
    let random = Math.random() * totalWeight;

    for (const [rarity, weight] of Object.entries(ITEM_RARITY_WEIGHTS)) {
        random -= weight;
        if (random <= 0) {
            // Get all items of this rarity
            const itemsOfRarity = Object.values(ITEM_DEFINITIONS).filter(item => item.rarity === rarity);
            if (itemsOfRarity.length > 0) {
                return itemsOfRarity[Math.floor(Math.random() * itemsOfRarity.length)];
            }
        }
    }

    // Fallback to first common item
    return Object.values(ITEM_DEFINITIONS).find(item => item.rarity === 'common') || ITEM_DEFINITIONS.shield_generator;
}
