// Gear system - loot and equipment

// Gear tier colors
const GEAR_TIERS = {
    gray: '#999999',
    green: '#4caf50',
    blue: '#2196f3',
    purple: '#9c27b0',
    orange: '#ff9800'
};

// Stat bonuses per tier
const TIER_BONUSES = {
    gray: 0,
    green: 0.2,
    blue: 0.4,
    purple: 0.7,
    orange: 1.0
};

// Affix tiers by power level
const AFFIX_TIERS = {
    basic: ['movementSpeed', 'attackSpeed', 'projectileSpeed', 'maxHealth', 'knockbackPower'],
    advanced: ['critChance', 'critDamage', 'lifesteal', 'cooldownReduction', 'areaOfEffect', 'beamTickRate', 'beamDuration'],
    rare: ['dodgeCharges', 'pierce', 'chainLightning', 'execute', 'rampage', 'multishot', 'phasing', 'explosiveAttacks', 'fortify', 'overcharge', 'beamCharges', 'beamPenetration']
};

// Affix pool with balanced value ranges
const AFFIX_POOL = {
    // BASIC TIER
    movementSpeed: { min: 0.1, max: 0.15, slot: ['armor', 'accessory'], weight: 0.7, tier: 'basic' }, // Reduced from 0.25 max, weight 1.0
    attackSpeed: { min: 0.1, max: 0.2, slot: ['weapon', 'accessory'], weight: 0.8, tier: 'basic' }, // Reduced from 0.3 max, weight 1.0
    projectileSpeed: { min: 0.15, max: 0.25, slot: ['weapon', 'accessory'], weight: 1.0, tier: 'basic' }, // Reduced from 0.4 max
    maxHealth: { min: 15, max: 40, slot: ['armor'], weight: 1.0, tier: 'basic' },
    knockbackPower: { min: 0.2, max: 0.5, slot: ['weapon'], weight: 1.0, tier: 'basic' },
    
    // ADVANCED TIER
    critChance: { min: 0.05, max: 0.15, slot: ['weapon', 'accessory'], weight: 1.0, tier: 'advanced' },
    critDamage: { min: 0.15, max: 0.45, slot: ['weapon'], weight: 1.0, tier: 'advanced' },
    lifesteal: { min: 0.03, max: 0.1, slot: ['weapon', 'armor'], weight: 1.0, tier: 'advanced' },
    cooldownReduction: { min: 0.08, max: 0.15, slot: ['accessory', 'armor'], weight: 1.0, tier: 'advanced' }, // Reduced from 0.2 max
    areaOfEffect: { min: 0.12, max: 0.28, slot: ['weapon'], weight: 1.0, tier: 'advanced' },
    
    // RARE TIER
    dodgeCharges: { min: 1, max: 1, slot: ['armor', 'accessory'], weight: 0.3, tier: 'rare' },
    pierce: { min: 1, max: 3, slot: ['weapon'], weight: 0.5, tier: 'rare' },
    chainLightning: { min: 1, max: 2, slot: ['weapon'], weight: 0.4, tier: 'rare' },
    execute: { min: 0.25, max: 0.50, slot: ['weapon'], weight: 0.5, tier: 'rare' },
    rampage: { min: 0.04, max: 0.12, slot: ['weapon', 'accessory'], weight: 0.4, tier: 'rare' },
    multishot: { min: 1, max: 2, slot: ['weapon'], weight: 0.3, tier: 'rare' },
    phasing: { min: 0.1, max: 0.25, slot: ['armor', 'accessory'], weight: 0.4, tier: 'rare' },
    explosiveAttacks: { min: 0.12, max: 0.25, slot: ['weapon'], weight: 0.5, tier: 'rare' },
    fortify: { min: 0.05, max: 0.15, slot: ['armor'], weight: 0.5, tier: 'rare' },
    overcharge: { min: 0.15, max: 0.3, slot: ['accessory'], weight: 0.3, tier: 'rare' },
    beamCharges: { min: 1, max: 1, slot: ['weapon', 'accessory'], weight: 0.3, tier: 'rare' },
    beamPenetration: { min: 1, max: 2, slot: ['weapon', 'accessory'], weight: 0.4, tier: 'rare' },
    
    // MAGE-SPECIFIC ADVANCED TIER
    beamTickRate: { min: 0.15, max: 0.35, slot: ['weapon', 'accessory'], weight: 1.0, tier: 'advanced' },
    beamDuration: { min: 0.2, max: 0.5, slot: ['weapon', 'accessory'], weight: 1.0, tier: 'advanced' }
};

// Tiered affix slot allocation per gear tier
const TIERED_AFFIX_SLOTS = {
    gray: { basic: [0, 2], advanced: [0, 0], rare: [0, 0] },
    green: { basic: [1, 2], advanced: [0, 1], rare: [0, 0] },
    blue: { basic: [1, 2], advanced: [1, 2], rare: [0, 1] },
    purple: { basic: [1, 2], advanced: [1, 2], rare: [1, 2] },
    orange: { basic: [1, 2], advanced: [1, 2], rare: [1, 2] }
};

// Class modifier pool with class-specific ability modifications
const CLASS_MODIFIER_POOL = {
    square: [
        { type: 'whirlwind_duration', value: 1.0, description: '+1s Whirlwind' },
        { type: 'whirlwind_damage', value: 0.4, description: '+40% Whirlwind Dmg' },
        { type: 'thrust_distance', value: 100, description: '+100 Thrust Range' },
        { type: 'thrust_damage', value: 0.4, description: '+40% Thrust Dmg' },
        { type: 'block_reduction', value: 0.2, description: '+20% Block Reduction' }
    ],
    triangle: [
        { type: 'dodge_damage', value: 0.4, description: '+40% Dodge Dmg' },
        { type: 'dodge_charges', value: 1, description: '+1 Dodge Charge' },
        { type: 'knife_count', value: 3, description: '+3 Knives' },
        { type: 'shadow_clone_count', value: 1, description: '+1 Shadow Clone' },
        { type: 'backstab_multiplier', value: 0.4, description: '+40% Backstab' }
    ],
    hexagon: [
        { type: 'projectile_count', value: 1, description: '+1 Projectile' },
        { type: 'blink_range', value: 150, description: '+150 Blink Range' },
        { type: 'blink_damage', value: 0.8, description: '+80% Blink Dmg' },
        { type: 'aoe_radius', value: 30, description: '+30 AoE Radius' },
        { type: 'explosion_radius', value: 25, description: '+25 Explosion Radius' },
        { type: 'beam_charges', value: 1, description: '+1 Beam Charge' },
        { type: 'beam_tick_rate', value: 0.25, description: '-25% Beam Tick Rate' },
        { type: 'beam_duration', value: 0.5, description: '+50% Beam Duration' },
        { type: 'beam_penetration', value: 1, description: '+1 Beam Penetration' }
    ],
    pentagon: [
        { type: 'shield_duration', value: 1.0, description: '+1s Shield' },
        { type: 'shield_wave_damage', value: 0.8, description: '+80% Wave Dmg' },
        { type: 'smash_radius', value: 40, description: '+40 Smash Radius' },
        { type: 'hammer_knockback', value: 0.5, description: '+50% Hammer KB' },
        { type: 'shield_reduction', value: 0.2, description: '+20% Shield Reduction' }
    ],
    universal: [
        { type: 'heavy_cooldown', value: -0.5, description: '-0.5s Heavy CD' },
        { type: 'special_cooldown', value: -1.0, description: '-1s Special CD' },
        { type: 'dodge_cooldown', value: -0.3, description: '-0.3s Dodge CD' },
        { type: 'basic_damage', value: 0.20, description: '+20% Basic Dmg' }
    ]
};

// Global ground loot array
const groundLoot = [];

// Get gear scaling based on room number
function getGearScaling(roomNumber) {
    return 1 + (roomNumber * 0.04); // +4% per room (balanced for difficulty curve)
}

// Flat stat ranges for weapons and armor
const FLAT_STAT_RANGES = {
    weapon: {
        damage: {
            gray: { min: 2, max: 4 },
            green: { min: 6, max: 9 },
            blue: { min: 11, max: 16 },
            purple: { min: 18, max: 26 },
            orange: { min: 26, max: 38 }
        }
    },
    armor: {
        defense: {
            gray: { min: 0.02, max: 0.04 },
            green: { min: 0.05, max: 0.08 },
            blue: { min: 0.10, max: 0.15 },
            purple: { min: 0.16, max: 0.23 },
            orange: { min: 0.24, max: 0.36 }
        }
    }
};

// Weapon type definitions
const WEAPON_TYPES = {
    fast: {
        name: 'Acute',
        damageMultiplier: 0.95,
        cooldownMultiplier: 0.7,  // 30% faster attacks
        movementSpeedBonus: 0.15,
        color: '#00ffff'
    },
    heavy: {
        name: 'Obtuse',
        damageMultiplier: 1.25,
        cooldownMultiplier: 1.1,  // 10% slower attacks
        knockbackBonus: 0.5,
        stunChance: 0.15,
        color: '#ff8800'
    },
    reach: {
        name: 'Vector',
        damageMultiplier: 1.0,
        rangeMultiplier: 1.5,
        projectileRangeBonus: 0.3,
        color: '#8800ff'
    },
    dual: {
        name: 'Parallel',
        damageMultiplier: 0.80,
        hitCount: 2,
        critBonus: 0.10,
        color: '#ff00ff'
    }
};

// Armor type definitions
const ARMOR_TYPES = {
    light: {
        name: 'Fractal',
        defenseMultiplier: 0.75,
        movementSpeedBonus: 0.20,
        dodgeBonus: 1, // +1 charge
        dodgeDamageReduction: 0.15,
        color: '#aaffaa'
    },
    medium: {
        name: 'Polygon',
        defenseMultiplier: 1.0,
        healthBonus: 0.10,
        color: '#aaaaff'
    },
    heavy: {
        name: 'Tessellated',
        defenseMultiplier: 1.30,
        movementSpeedPenalty: -0.10,
        interruptImmune: true,
        knockbackImmune: true,
        color: '#ffaaaa'
    },
    cloth: {
        name: 'Membrane',
        defenseMultiplier: 0.60,
        cooldownReduction: 0.15,
        projectileSpeedBonus: 0.20,
        color: '#ffaaff'
    }
};

// Legendary effect definitions (orange tier only)
const LEGENDARY_EFFECTS = {
    vampiric: { lifesteal: 0.08, description: '8% Lifesteal' },
    incendiary: { burnDuration: 3, burnDPS: 0.3, description: 'Burns enemies for 3s' },
    freezing: { slowChance: 0.20, slowAmount: 0.5, slowDuration: 2, description: '20% chance to slow' },
    thorns: { reflectPercent: 0.25, description: 'Reflects 25% damage' },
    berserker_rage: { damageBonus: 0.25, defensePenalty: -0.20, description: 'Berserker Rage: +25% Dmg, -20% Def' },
    glass_cannon: { damageBonus: 0.45, healthPenalty: -0.40, description: 'Glass Cannon: +45% Dmg, -40% HP' },
    phoenix_down: { reviveHealth: 0.30, description: 'Revive once per room at 30% HP' },
    time_dilation: { timeSlow: 0.20, description: 'Slow time 20%' },
    chain_lightning: { chainCount: 2, chainDamage: 0.6, chainRange: 150, description: 'Chains to 2 enemies (60% dmg)' }
};

// Generate affixes using tiered slot system
function generateAffixes(gearTier, slot) {
    const slotConfig = TIERED_AFFIX_SLOTS[gearTier];
    if (!slotConfig) return [];
    
    const selectedAffixes = [];
    const usedAffixTypes = new Set(); // Prevent duplicates across all tiers
    
    // Helper: Select random affix from tier pool
    function selectFromTier(affixTier, count) {
        if (count <= 0) return;
        
        // Get compatible affixes for this tier and slot
        const compatible = [];
        const tierAffixes = AFFIX_TIERS[affixTier] || [];
        
        for (const affixType of tierAffixes) {
            const affixData = AFFIX_POOL[affixType];
            if (affixData && affixData.slot.includes(slot) && !usedAffixTypes.has(affixType)) {
                compatible.push({
                    type: affixType,
                    data: affixData,
                    weight: affixData.weight || 1.0
                });
            }
        }
        
        // Select 'count' affixes using weighted random
        for (let i = 0; i < Math.min(count, compatible.length); i++) {
            if (compatible.length === 0) break;
            
            // Calculate total weight
            const totalWeight = compatible.reduce((sum, affix) => sum + affix.weight, 0);
            if (totalWeight <= 0) break;
            
            // Weighted random selection
            let random = Math.random() * totalWeight;
            let selectedIndex = 0;
            
            for (let j = 0; j < compatible.length; j++) {
                random -= compatible[j].weight;
                if (random <= 0) {
                    selectedIndex = j;
                    break;
                }
            }
            
            const selected = compatible[selectedIndex];
            compatible.splice(selectedIndex, 1); // Remove to prevent duplicates
            
            let value = selected.data.min + Math.random() * (selected.data.max - selected.data.min);
            // Round integer affixes to whole numbers
            const integerAffixes = ['dodgeCharges', 'maxHealth', 'pierce', 'chainLightning', 'multishot', 'beamCharges', 'beamPenetration'];
            if (integerAffixes.includes(selected.type)) {
                value = Math.round(value);
            }
            
            selectedAffixes.push({
                type: selected.type,
                value: value,
                tier: affixTier
            });
            
            usedAffixTypes.add(selected.type);
        }
    }
    
    // Roll for each tier with weighted probability (favor lower counts)
    // For 0-2: 50% chance 0, 30% chance 1, 20% chance 2
    // For 1-2: 70% chance 1, 30% chance 2
    function weightedRoll(min, max) {
        if (min === max) return min;
        const range = max - min;
        const rand = Math.random();
        
        if (min === 0 && max === 2) {
            // 0-2 range: favor 0
            if (rand < 0.5) return 0;
            if (rand < 0.8) return 1;
            return 2;
        } else if (min === 1 && max === 2) {
            // 1-2 range: favor 1
            return rand < 0.7 ? 1 : 2;
        } else if (min === 0 && max === 1) {
            // 0-1 range: favor 0
            return rand < 0.65 ? 0 : 1;
        } else {
            // Fallback: uniform distribution
            return min + Math.floor(Math.random() * (max - min + 1));
        }
    }
    
    const basicCount = weightedRoll(slotConfig.basic[0], slotConfig.basic[1]);
    const advancedCount = weightedRoll(slotConfig.advanced[0], slotConfig.advanced[1]);
    const rareCount = weightedRoll(slotConfig.rare[0], slotConfig.rare[1]);
    
    selectFromTier('basic', basicCount);
    selectFromTier('advanced', advancedCount);
    selectFromTier('rare', rareCount);
    
    return selectedAffixes;
}

// Generate a name for gear based on affixes
function generateGearName(tier, slot, affixes) {
    const prefixes = ['Sketched', 'Linear', 'Geometric', 'Euclidean', 'Transcendent'];
    const tierIndex = ['gray', 'green', 'blue', 'purple', 'orange'].indexOf(tier);
    const prefix = prefixes[tierIndex];
    
    const slotNames = {
        weapon: ['Theorem', 'Axiom', 'Arc', 'Spiral', 'Construct'],
        armor: ['Surface', 'Lattice', 'Grid', 'Shell', 'Form'],
        accessory: ['Circle', 'Sigil', 'Rune', 'Glyph', 'Token']
    };
    
    const slotName = slotNames[slot][Math.floor(Math.random() * slotNames[slot].length)];
    
    return `${prefix} ${slotName}`;
}

// Select a class modifier for gear
function selectClassModifier() {
    const allClasses = ['square', 'triangle', 'hexagon', 'pentagon', 'universal'];
    // Weight towards current player class if Game.player exists
    const currentClass = typeof Game !== 'undefined' && Game.player 
        ? Game.player.playerClass 
        : null;
    
    let selectedClass;
    if (currentClass && Math.random() < 0.6) {
        // 60% chance to match player class
        selectedClass = currentClass;
    } else {
        // 40% chance for any class (including universal)
        selectedClass = allClasses[Math.floor(Math.random() * allClasses.length)];
    }
    
    const modifiers = CLASS_MODIFIER_POOL[selectedClass];
    const selected = modifiers[Math.floor(Math.random() * modifiers.length)];
    
    return {
        class: selectedClass,
        type: selected.type,
        value: selected.value,
        description: selected.description
    };
}

// Enemy difficulty multipliers for loot quality scaling
const ENEMY_DIFFICULTY = {
    basic: { multiplier: 1.0, name: 'basic' },      // Red circle (basic melee)
    diamond: { multiplier: 1.4, name: 'diamond' },   // Cyan diamond (assassin)
    star: { multiplier: 1.4, name: 'star' },         // Yellow star (ranged)
    octagon: { multiplier: 2.2, name: 'elite' },     // Gold octagon (elite)
    boss: { multiplier: 3.5, name: 'boss' }          // Bosses
};

// Calculate tier probabilities based on room number and enemy difficulty
// Uses gradual curve: slow early progression, accelerates in later rooms
function calculateTierProbabilities(roomNumber, enemyDifficulty = 'basic') {
    // Get difficulty multiplier
    const difficultyData = ENEMY_DIFFICULTY[enemyDifficulty] || ENEMY_DIFFICULTY.basic;
    const diffMultiplier = difficultyData.multiplier;
    
    // Calculate effective level: 75% room weight, 25% difficulty weight
    const effectiveLevel = roomNumber * 0.75 + (roomNumber * diffMultiplier * 0.25);
    
    // Gradual curve scaling factor (exponent creates acceleration)
    const scalingFactor = Math.pow(effectiveLevel, 1.2) / 150; // Reduced from /100, slower curve
    
    // Base weights (room 1, basic enemy) - more conservative
    const baseWeights = {
        gray: 70,    // Increased gray chance early
        green: 25,   // Reduced green
        blue: 4,     // Much rarer blue early
        purple: 0.8, // Very rare purple
        orange: 0.2  // Extremely rare orange
    };
    
    // Growth rates per tier (how much each tier grows with scaling) - slower progression
    const growthRates = {
        gray: -2.5,   // Gray decreases slower
        green: -1.0,  // Green decreases slower
        blue: 0.6,    // Blue increases slower
        purple: 1.2,  // Purple increases slower
        orange: 1.5   // Orange increases slower
    };
    
    // Calculate adjusted weights
    let weights = {};
    for (let tier in baseWeights) {
        weights[tier] = Math.max(0.1, baseWeights[tier] + (scalingFactor * growthRates[tier]));
    }
    
    // Bosses never drop gray (white) gear - redistribute probability to higher tiers
    if (difficultyData.name === 'boss') {
        weights.gray = 0;
    }
    
    // Normalize to probabilities (sum to 1.0)
    const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);
    let probabilities = {};
    for (let tier in weights) {
        probabilities[tier] = weights[tier] / totalWeight;
    }
    
    return probabilities;
}

// Generate random gear with stats
function generateGear(x, y, roomNumberOrTier = 1, enemyDifficulty = 'basic') {
    const tiers = ['gray', 'green', 'blue', 'purple', 'orange'];
    const slots = ['weapon', 'armor', 'accessory'];
    
    // Handle both roomNumber and forcedTier parameters
    let roomNumber = 1;
    let tier;
    
    if (typeof roomNumberOrTier === 'string') {
        // Third parameter is a forced tier (for boss drops - legacy support)
        tier = roomNumberOrTier;
        roomNumber = typeof Game !== 'undefined' ? (Game.roomNumber || 1) : 1;
    } else {
        // Third parameter is room number, do progressive tier selection
        roomNumber = roomNumberOrTier || 1;
        
        // Get tier probabilities based on room and enemy difficulty
        const probabilities = calculateTierProbabilities(roomNumber, enemyDifficulty);
        
        // Select tier based on weighted probabilities
        const rand = Math.random();
        let cumulative = 0;
        
        // Check each tier in order
        for (const tierName of tiers) {
            cumulative += probabilities[tierName];
            if (rand < cumulative) {
                tier = tierName;
                break;
            }
        }
        
        // Fallback to gray if something went wrong
        if (!tier) tier = 'gray';
    }
    
    const slot = slots[Math.floor(Math.random() * slots.length)];
    const bonus = TIER_BONUSES[tier];
    const scaling = getGearScaling(roomNumber);
    
    // Select weapon/armor type
    let weaponType = null;
    let armorType = null;
    
    if (slot === 'weapon') {
        const types = Object.keys(WEAPON_TYPES);
        weaponType = types[Math.floor(Math.random() * types.length)];
    }
    
    if (slot === 'armor') {
        const types = Object.keys(ARMOR_TYPES);
        armorType = types[Math.floor(Math.random() * types.length)];
    }
    
    // Generate stats based on slot
    let stats = {};
    if (slot === 'weapon') {
        // Use flat damage with room scaling
        const range = FLAT_STAT_RANGES.weapon.damage[tier];
        const baseDamage = range.min + Math.random() * (range.max - range.min);
        const typeMultiplier = weaponType ? WEAPON_TYPES[weaponType].damageMultiplier : 1.0;
        stats.damage = baseDamage * scaling * typeMultiplier; // Apply type modifier to damage
    } else if (slot === 'armor') {
        // Use flat defense with room scaling
        const range = FLAT_STAT_RANGES.armor.defense[tier];
        const baseDefense = range.min + Math.random() * (range.max - range.min);
        const typeMultiplier = armorType ? ARMOR_TYPES[armorType].defenseMultiplier : 1.0;
        stats.defense = baseDefense * scaling * typeMultiplier; // Apply type modifier to defense
    } else if (slot === 'accessory') {
        // Keep speed as percentage for now
        const minBonus = 0.05;
        const effectiveBonus = bonus > 0 ? bonus : minBonus;
        stats.speed = effectiveBonus * 0.5; // Smaller speed bonus
    }
    
    // Generate affixes based on tier and slot
    const affixes = generateAffixes(tier, slot);
    
    // Generate class modifiers and/or legendary effects
    let classModifier = null;
    let legendaryEffect = null;
    
    if (tier === 'purple') {
        if (Math.random() < 0.3) {
            classModifier = selectClassModifier();
        }
    } else if (tier === 'orange') {
        // Orange gear can roll either a class modifier or a legendary effect, never both
        const roll = Math.random();
        if (roll < 0.75) {
            classModifier = selectClassModifier();
        } else {
            const effects = Object.keys(LEGENDARY_EFFECTS);
            const effectKey = effects[Math.floor(Math.random() * effects.length)];
            const effectData = LEGENDARY_EFFECTS[effectKey];
            legendaryEffect = {
                type: effectKey,
                ...effectData
            };
            console.log(`[LEGENDARY] Orange gear rolled legendary effect: ${effectKey}`);
        }
    }
    
    // Generate name
    const name = generateGearName(tier, slot, affixes);
    
    return {
        id: 'gear_' + Date.now() + Math.random(),
        x: x,
        y: y,
        slot: slot,
        tier: tier,
        bonus: bonus,
        color: GEAR_TIERS[tier],
        size: 15,
        stats: stats,
        affixes: affixes,
        classModifier: classModifier,
        weaponType: weaponType,   // Weapon type (fast, heavy, reach, dual)
        armorType: armorType,     // Armor type (light, medium, heavy, cloth)
        legendaryEffect: legendaryEffect, // Legendary effect (orange only)
        name: name,
        roomNumber: roomNumber,  // Store room number for display
        scaling: scaling,         // Store scaling multiplier
        pulse: 0 // For pulsing animation
    };
}

// Affix visual configuration (matching player-base.js)
const AFFIX_VISUAL_MAP = {
    // Basic tier
    movementSpeed: { shape: 'wave', color: { r: 0, g: 255, b: 255 } },
    attackSpeed: { shape: 'zigzag', color: { r: 255, g: 255, b: 0 } },
    projectileSpeed: { shape: 'chevron', color: { r: 100, g: 255, b: 100 } },
    maxHealth: { shape: 'plus', color: { r: 0, g: 255, b: 0 } },
    knockbackPower: { shape: 'burst', color: { r: 200, g: 0, b: 255 } },
    
    // Advanced tier
    critChance: { shape: 'triangle', color: { r: 255, g: 50, b: 50 } },
    critDamage: { shape: 'star', color: { r: 255, g: 0, b: 100 } },
    lifesteal: { shape: 'cross', color: { r: 200, g: 0, b: 0 } },
    cooldownReduction: { shape: 'hexagon', color: { r: 100, g: 100, b: 255 } },
    areaOfEffect: { shape: 'circle', color: { r: 255, g: 150, b: 0 } },
    
    // Rare tier
    dodgeCharges: { shape: 'diamond', color: { r: 255, g: 255, b: 255 } },
    pierce: { shape: 'arrow', color: { r: 100, g: 255, b: 255 } },
    chainLightning: { shape: 'fork', color: { r: 150, g: 200, b: 255 } },
    execute: { shape: 'skull', color: { r: 255, g: 50, b: 50 } },
    rampage: { shape: 'stairs', color: { r: 255, g: 100, b: 0 } },
    multishot: { shape: 'splitarrow', color: { r: 200, g: 255, b: 100 } },
    phasing: { shape: 'ghost', color: { r: 200, g: 200, b: 255 } },
    explosiveAttacks: { shape: 'explosion', color: { r: 255, g: 200, b: 0 } },
    fortify: { shape: 'shield', color: { r: 150, g: 150, b: 255 } },
    overcharge: { shape: 'lightning', color: { r: 255, g: 255, b: 150 } },
    
    // Mage beam affixes
    beamCharges: { shape: 'charge', color: { r: 150, g: 100, b: 255 } },
    beamTickRate: { shape: 'pulse', color: { r: 255, g: 150, b: 200 } },
    beamDuration: { shape: 'extend', color: { r: 200, g: 100, b: 255 } },
    beamPenetration: { shape: 'penetrate', color: { r: 100, g: 200, b: 255 } }
};

// Tier opacity settings
const TIER_OPACITY = {
    gray: 0.5,
    green: 0.7,
    blue: 0.9,
    purple: 1.0,
    orange: 1.0
};

// Tier glow settings
const TIER_GLOW = {
    gray: 0,
    green: 5,
    blue: 10,
    purple: 15,
    orange: 25
};

// Render ground loot
function renderGroundLoot(ctx) {
    groundLoot.forEach(gear => {
        // Update pulse animation (slow and smooth)
        gear.pulse = (gear.pulse || 0) + 0.05; // Slower pulse
        const pulseSize = 2 + Math.sin(gear.pulse) * 2;
        const time = Date.now() * 0.0003; // Match player animation speed
        
        // Validate gear properties
        if (!gear.tier) gear.tier = 'gray';
        if (!gear.stats) gear.stats = {};
        
        const tierOpacity = TIER_OPACITY[gear.tier] || 0.5;
        const tierGlow = TIER_GLOW[gear.tier] || 0;
        
        ctx.save();
        
        // Apply tier-based glow
        if (tierGlow > 0) {
            ctx.shadowBlur = tierGlow;
            ctx.shadowColor = gear.color || '#999999';
        }
        
        // Extra glow for legendary items
        if (gear.legendaryEffect) {
            ctx.shadowBlur = 30;
            ctx.shadowColor = '#ffaa00';
            
            // Draw pulsing legendary aura
            const legendaryPulse = Math.sin(gear.pulse * 0.5) * 0.5 + 0.5;
            ctx.fillStyle = `rgba(255, 170, 0, ${0.3 * legendaryPulse})`;
            ctx.beginPath();
            ctx.arc(gear.x, gear.y, gear.size + pulseSize + 15, 0, Math.PI * 2);
            ctx.fill();
        } else if (gear.tier === 'orange' && gear.classModifier) {
            ctx.shadowBlur = 22;
            ctx.shadowColor = '#55ccff';
            
            const modifierPulse = Math.sin(gear.pulse * 0.45) * 0.5 + 0.5;
            ctx.fillStyle = `rgba(85, 204, 255, ${0.22 * modifierPulse})`;
            ctx.beginPath();
            ctx.arc(gear.x, gear.y, gear.size + pulseSize + 12, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Draw tier color base circle
        ctx.fillStyle = gear.color || '#999999';
        ctx.globalAlpha = tierOpacity;
        ctx.beginPath();
        ctx.arc(gear.x, gear.y, gear.size + pulseSize, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
        
        // Draw tier outline
        ctx.strokeStyle = gear.color || '#999999';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.shadowBlur = 0;
        
        // Draw wave-deformed ring showing affixes
        if (gear.affixes && gear.affixes.length > 0) {
            const ringRadius = gear.size + pulseSize + 10;
            const numPoints = 32;
            
            // Calculate blended color once
            let baseR = 0, baseG = 0, baseB = 0;
            let colorCount = 0;
            
            gear.affixes.forEach(affix => {
                const affixConfig = AFFIX_VISUAL_MAP[affix.type];
                if (affixConfig) {
                    baseR += affixConfig.color.r;
                    baseG += affixConfig.color.g;
                    baseB += affixConfig.color.b;
                    colorCount++;
                }
            });
            
            // Average the colors
            if (colorCount > 0) {
                baseR = Math.floor(baseR / colorCount);
                baseG = Math.floor(baseG / colorCount);
                baseB = Math.floor(baseB / colorCount);
            } else {
                baseR = 150; baseG = 150; baseB = 150;
            }
            
            ctx.beginPath();
            for (let i = 0; i <= numPoints; i++) {
                const angle = (i / numPoints) * Math.PI * 2;
                
                // Simple wave combination - limit to first 2 for clarity
                let waveOffset = 0;
                const affixesToShow = Math.min(2, gear.affixes.length);
                
                for (let a = 0; a < affixesToShow; a++) {
                    const affix = gear.affixes[a];
                    const affixConfig = AFFIX_VISUAL_MAP[affix.type];
                    if (affixConfig) {
                        // Use cleaner wave pattern - limited frequency (2-3 only)
                        const freq = 2 + a;
                        // Slow, smooth phase animation
                        const smoothPhase = time * (0.5 + a * 0.2);
                        const normalizedAngle = ((angle * freq + smoothPhase) % (Math.PI * 2)) / (Math.PI * 2);
                        // Triangle wave for smooth transitions
                        const waveValue = normalizedAngle < 0.5 ? (normalizedAngle * 4 - 1) : (3 - normalizedAngle * 4);
                        waveOffset += waveValue * 4;
                    }
                }
                
                const radius = ringRadius + waveOffset;
                const px = gear.x + Math.cos(angle) * radius;
                const py = gear.y + Math.sin(angle) * radius;
                
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            
            ctx.strokeStyle = `rgba(${baseR}, ${baseG}, ${baseB}, ${tierOpacity * 0.8})`;
            ctx.lineWidth = 2;
            ctx.stroke();
        }
        
        // Draw type indicator border for weapons and armor
        if (gear.weaponType && WEAPON_TYPES[gear.weaponType]) {
            const typeColor = WEAPON_TYPES[gear.weaponType].color;
            ctx.strokeStyle = typeColor;
            ctx.lineWidth = 3;
            ctx.setLineDash([5, 3]);
            ctx.beginPath();
            ctx.arc(gear.x, gear.y, gear.size + pulseSize + 5, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        }
        
        if (gear.armorType && ARMOR_TYPES[gear.armorType]) {
            const typeColor = ARMOR_TYPES[gear.armorType].color;
            ctx.strokeStyle = typeColor;
            ctx.lineWidth = 3;
            ctx.setLineDash([3, 3]); // Different pattern for armor
            ctx.beginPath();
            ctx.arc(gear.x, gear.y, gear.size + pulseSize + 5, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        }
        
        ctx.restore();
        
        // Draw tier name above gear
        ctx.fillStyle = '#ffffff';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(gear.tier.toUpperCase(), gear.x, gear.y - gear.size - 15);
        
        // Draw slot name and type
        ctx.font = '8px Arial';
        let slotText = gear.slot;
        if (gear.weaponType) slotText += ` (${WEAPON_TYPES[gear.weaponType].name})`;
        if (gear.armorType) slotText += ` (${ARMOR_TYPES[gear.armorType].name})`;
        ctx.fillText(slotText, gear.x, gear.y - gear.size - 5);
    });
}

// Get gear stats as string for tooltip
function getGearStatsString(gear) {
    let statsStr = [];
    
    if (gear.stats.damage) {
        // Show flat damage value (scaled)
        statsStr.push(`+${gear.stats.damage.toFixed(1)} Dmg`);
    }
    if (gear.stats.defense) {
        // Show defense as percentage
        statsStr.push(`+${(gear.stats.defense * 100).toFixed(1)}% Def`);
    }
    if (gear.stats.speed) {
        statsStr.push(`+${(gear.stats.speed * 100).toFixed(0)}% Spd`);
    }
    
    // Add affixes
    if (gear.affixes && gear.affixes.length > 0) {
        gear.affixes.forEach(affix => {
            const isIntegerAffix = ['dodgeCharges', 'maxHealth', 'pierce', 'chainLightning', 'multishot', 'beamCharges', 'beamPenetration'].includes(affix.type);
            let displayValue;
            
            // Special handling for beam affixes
            if (affix.type === 'beamTickRate') {
                // Display as reduction (negative percentage)
                displayValue = `-${(affix.value * 100).toFixed(0)}%`;
            } else if (isIntegerAffix) {
                displayValue = `+${affix.value.toFixed(0)}`;
            } else {
                displayValue = `+${(affix.value * 100).toFixed(0)}%`;
            }
            
            const displayName = affix.type.replace(/([A-Z])/g, ' $1').trim();
            const tierBadge = affix.tier ? `[${affix.tier}]` : '';
            statsStr.push(`${tierBadge} ${displayName}: ${displayValue}`);
        });
    }
    
    // Add class modifier
    if (gear.classModifier) {
        const classIcon = gear.classModifier.class === 'universal' ? '[All]' : `[${gear.classModifier.class}]`;
        statsStr.push(`${classIcon} ${gear.classModifier.description}`);
    }
    
    // Add legendary effect
    if (gear.legendaryEffect) {
        statsStr.push(`[LEGENDARY] ${gear.legendaryEffect.description}`);
    }
    
    return statsStr.join(', ');
}

