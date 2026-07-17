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
    advanced: ['critChance', 'critDamage', 'lifesteal', 'cooldownReduction', 'areaOfEffect', 'beamTickRate', 'beamDuration', 'whirlwindRadius', 'thrustSpeed', 'cloneDuration', 'dashCooldown', 'shieldWidth'],
    rare: ['dodgeCharges', 'pierce', 'chainLightning', 'execute', 'rampage', 'multishot', 'phasing', 'explosiveAttacks', 'fortify', 'overcharge', 'beamCharges', 'beamPenetration', 'cleaveArea', 'fanCount', 'shoutStun', 'hammerHeal']
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
    lifesteal: { min: 0.02, max: 0.07, slot: ['weapon', 'armor'], weight: 1.0, tier: 'advanced' },
    cooldownReduction: { min: 0.08, max: 0.15, slot: ['accessory', 'armor'], weight: 1.0, tier: 'advanced' }, // Reduced from 0.2 max
    areaOfEffect: { min: 0.12, max: 0.28, slot: ['weapon'], weight: 1.0, tier: 'advanced' },
    
    // WARRIOR-SPECIFIC (Square)
    whirlwindRadius: { min: 0.15, max: 0.35, slot: ['weapon', 'accessory'], weight: 1.0, tier: 'advanced', class: 'square' },
    thrustSpeed: { min: 0.10, max: 0.25, slot: ['weapon', 'accessory'], weight: 1.0, tier: 'advanced', class: 'square' },
    
    // ROGUE-SPECIFIC (Triangle)
    cloneDuration: { min: 0.20, max: 0.50, slot: ['accessory', 'armor'], weight: 1.0, tier: 'advanced', class: 'triangle' },
    dashCooldown: { min: 0.15, max: 0.25, slot: ['armor', 'accessory'], weight: 1.0, tier: 'advanced', class: 'triangle' },
    
    // TANK-SPECIFIC (Pentagon)
    shieldWidth: { min: 0.20, max: 0.40, slot: ['armor', 'accessory'], weight: 1.0, tier: 'advanced', class: 'pentagon' },
    
    // MAGE-SPECIFIC (Hexagon)
    beamTickRate: { min: 0.15, max: 0.35, slot: ['weapon', 'accessory'], weight: 1.0, tier: 'advanced', class: 'hexagon' },
    beamDuration: { min: 0.2, max: 0.5, slot: ['weapon', 'accessory'], weight: 1.0, tier: 'advanced', class: 'hexagon' },
    
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
    
    // WARRIOR-SPECIFIC (Square)
    cleaveArea: { min: 0.15, max: 0.30, slot: ['weapon'], weight: 1.0, tier: 'rare', class: 'square' },
    
    // ROGUE-SPECIFIC (Triangle)
    fanCount: { min: 1, max: 2, slot: ['weapon'], weight: 1.0, tier: 'rare', class: 'triangle' },
    
    // TANK-SPECIFIC (Pentagon)
    shoutStun: { min: 0.3, max: 0.8, slot: ['weapon', 'armor'], weight: 1.0, tier: 'rare', class: 'pentagon' },
    hammerHeal: { min: 0.02, max: 0.04, slot: ['weapon'], weight: 1.0, tier: 'rare', class: 'pentagon' },
    
    // MAGE-SPECIFIC (Hexagon)
    beamCharges: { min: 1, max: 1, slot: ['weapon', 'accessory'], weight: 0.3, tier: 'rare', class: 'hexagon' },
    beamPenetration: { min: 1, max: 2, slot: ['weapon', 'accessory'], weight: 0.4, tier: 'rare', class: 'hexagon' }
};

// Dynamic affix slot allocation based on gear upgrades
function getTieredAffixSlots(gearTier, upgrades = {}) {
    const basicLvl = upgrades.affixSlotsBasic || 0;
    const advancedLvl = upgrades.affixSlotsAdvanced || 0;
    const rareLvl = upgrades.affixSlotsRare || 0;

    let basicCap = 1;
    if (basicLvl >= 5) basicCap = 3;
    else if (basicLvl >= 3) basicCap = 2;

    let advancedCap = 0;
    if (advancedLvl >= 4) advancedCap = 2;
    else if (advancedLvl >= 2) advancedCap = 1;

    let rareCap = 0;
    if (rareLvl >= 5) rareCap = 2;
    else if (rareLvl >= 3) rareCap = 1;

    const config = {
        gray:   { basic: [0, 0], advanced: [0, 0], rare: [0, 0] },
        green:  { basic: [1, basicCap], advanced: [0, 0], rare: [0, 0] },
        blue:   { basic: [1, basicCap], advanced: [1, Math.min(1, advancedCap)], rare: [0, 0] },
        purple: { basic: [1, basicCap], advanced: [1, advancedCap], rare: [1, Math.min(1, rareCap)] },
        orange: { basic: [1, basicCap], advanced: [1, advancedCap], rare: [1, rareCap] }
    };

    return config[gearTier] || config.gray;
}

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
// Expose globally for DOM components
window.groundLoot = groundLoot;

// Get gear scaling based on room number
function getGearScaling(roomNumber) {
    // +3.5%/room - stretched for the 50-room gear run (was +4% for a 30-room end)
    return 1 + (roomNumber * 0.035);
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
        cooldownMultiplier: 0.7,
        movementSpeedBonus: 0.15,
        color: '#00ffff',
        hitpauseScale: 0.55,
        recoveryScale: 0.65,
        trailStyle: 'snap',
        dualStaggerMs: 0,
        perHitDamageShare: 1.0,
        hitCount: 1,
        onHitPolicy: { status: 'perSwing', proc: 'perSwing', sustain: 'perSwing' },
        basicWeights: { attackSpeed: 1.4, projectileSpeed: 1.0, knockbackPower: 0.45 },
        basicValueScale: { attackSpeed: 1.2, projectileSpeed: 1.0, knockbackPower: 0.55 },
        // Short line for pickup / gear tooltips (keep brief)
        pickupBlurb: 'Fast & light - snappy swings, leans speed',
        accentHint: 'Favors attack speed, crit chance & rampage',
        // Index machine copy
        feel: 'Light hitpause, quick recovery, shorter commitment after each swing.',
        pitch: 'Built for tempo. Basics and heavies come out sooner; you stay mobile between hits.',
        leansToward: 'Attack speed, crit chance, rampage, and other density tools.'
    },
    heavy: {
        name: 'Obtuse',
        damageMultiplier: 1.25,
        cooldownMultiplier: 1.15,
        knockbackBonus: 0.5,
        stunChance: 0.15,
        color: '#ff8800',
        hitpauseScale: 1.35,
        recoveryScale: 1.45,
        trailStyle: 'heavy',
        dualStaggerMs: 0,
        perHitDamageShare: 1.0,
        hitCount: 1,
        onHitPolicy: { status: 'perSwing', proc: 'perSwing', sustain: 'perSwing' },
        basicWeights: { attackSpeed: 0.55, projectileSpeed: 0.5, knockbackPower: 1.6 },
        basicValueScale: { attackSpeed: 0.65, projectileSpeed: 0.75, knockbackPower: 1.25 },
        pickupBlurb: 'Slow & heavy - hard hits, leans knockback',
        accentHint: 'Favors knockback, crit damage, execute & explosions',
        feel: 'Chunky hitpause and longer recovery - each connect feels like a commit.',
        pitch: 'Trades speed for punch. Stronger per-hit damage and shove; heavies hit like a statement.',
        leansToward: 'Knockback, crit damage, execute, and explosive finishers.'
    },
    reach: {
        name: 'Vector',
        damageMultiplier: 1.0,
        rangeMultiplier: 1.5,
        projectileRangeBonus: 0.3,
        color: '#8800ff',
        hitpauseScale: 0.85,
        recoveryScale: 1.0,
        trailStyle: 'elongated',
        dualStaggerMs: 0,
        perHitDamageShare: 1.0,
        hitCount: 1,
        onHitPolicy: { status: 'perSwing', proc: 'perSwing', sustain: 'perSwing' },
        basicWeights: { attackSpeed: 1.0, projectileSpeed: 1.6, knockbackPower: 0.4 },
        basicValueScale: { attackSpeed: 1.0, projectileSpeed: 1.25, knockbackPower: 0.6 },
        pickupBlurb: 'Long reach - space control, leans range',
        accentHint: 'Favors range, pierce, chain & volleys',
        feel: 'Extended melee arcs, longer projectile travel, and farther beams / shouts / thrusts.',
        pitch: 'Keep distance or cover more ground per swing. Identity is geometry, not raw DPS.',
        leansToward: 'Range, pierce, chain lightning, multishot, and volley tools.'
    },
    dual: {
        name: 'Parallel',
        // Full connect ≈ 1.0x baseline (0.5 share × 2 contacts × ~1.0 type mult)
        damageMultiplier: 1.0,
        hitCount: 2,
        critBonus: 0.05,
        color: '#ff00ff',
        hitpauseScale: 0.7,
        recoveryScale: 1.15,
        trailStyle: 'twin',
        dualStaggerMs: 55,
        perHitDamageShare: 0.5,
        onHitPolicy: { status: 'perContact', proc: 'perContact', sustain: 'perSwing' },
        basicWeights: { attackSpeed: 1.25, projectileSpeed: 1.0, knockbackPower: 0.4 },
        basicValueScale: { attackSpeed: 1.1, projectileSpeed: 1.0, knockbackPower: 0.5 },
        pickupBlurb: 'Twin strikes - same damage, denser procs',
        accentHint: 'Twin strikes: status & proc density at parity damage',
        feel: 'Two staggered contacts (~55ms apart). Total damage matches a normal weapon; status and procs can roll twice.',
        pitch: 'Not double DPS - double tick density. Basics, heavies, beams, fans, and thrusts all twin in their own way.',
        leansToward: 'Attack speed, status/proc density, and tools that love hitting more often.'
    }
};

/** One-line player copy for pickup / tooltip (name + short blurb). */
function getWeaponTypePickupInfo(weaponTypeKey) {
    if (!weaponTypeKey || typeof WEAPON_TYPES === 'undefined') return null;
    const wt = WEAPON_TYPES[weaponTypeKey];
    if (!wt) return null;
    return {
        key: weaponTypeKey,
        name: wt.name,
        color: wt.color || '#ffffff',
        blurb: wt.pickupBlurb || wt.accentHint || ''
    };
}

// Purple/orange weapon advanced+rare accent pools (basics stay universal with weights)
const WEAPON_TYPE_AFFIX_POOLS = {
    fast: {
        advanced: ['critChance', 'lifesteal', 'areaOfEffect', 'thrustSpeed', 'whirlwindRadius', 'beamTickRate'],
        rare: ['rampage', 'pierce', 'chainLightning', 'multishot', 'fanCount', 'beamCharges'],
        exclude: ['critDamage', 'execute', 'explosiveAttacks', 'cleaveArea', 'shoutStun', 'hammerHeal']
    },
    heavy: {
        advanced: ['critDamage', 'lifesteal', 'areaOfEffect', 'whirlwindRadius'],
        rare: ['execute', 'explosiveAttacks', 'cleaveArea', 'shoutStun', 'hammerHeal'],
        exclude: ['multishot', 'pierce', 'rampage', 'critChance', 'fanCount', 'beamCharges', 'beamPenetration']
    },
    reach: {
        advanced: ['critChance', 'lifesteal', 'areaOfEffect', 'thrustSpeed', 'beamDuration'],
        rare: ['pierce', 'chainLightning', 'multishot', 'beamPenetration', 'fanCount'],
        exclude: ['execute', 'explosiveAttacks', 'rampage', 'shoutStun', 'hammerHeal', 'cleaveArea']
    },
    dual: {
        advanced: ['critChance', 'lifesteal', 'areaOfEffect', 'beamTickRate', 'whirlwindRadius'],
        rare: ['chainLightning', 'rampage', 'pierce', 'fanCount', 'beamCharges'],
        exclude: ['multishot', 'execute', 'explosiveAttacks', 'critDamage', 'cleaveArea', 'shoutStun', 'hammerHeal', 'beamPenetration']
    }
};

// Honest rare-tier safety net when class ∩ type pool is too narrow (never promote advanced→rare)
const WEAPON_RARE_SAFETY_SET = ['pierce', 'chainLightning', 'rampage'];

function getWeaponTypeAffixAllowlist(weaponType, affixTier) {
    if (!weaponType || !WEAPON_TYPE_AFFIX_POOLS[weaponType]) return null;
    const pool = WEAPON_TYPE_AFFIX_POOLS[weaponType];
    if (affixTier === 'advanced') return pool.advanced;
    if (affixTier === 'rare') return pool.rare;
    return null;
}

function isAffixExcludedForWeaponType(weaponType, affixType) {
    if (!weaponType || !WEAPON_TYPE_AFFIX_POOLS[weaponType]) return false;
    return (WEAPON_TYPE_AFFIX_POOLS[weaponType].exclude || []).includes(affixType);
}

function getWeaponBasicWeight(weaponType, affixType) {
    const type = weaponType && WEAPON_TYPES[weaponType];
    if (!type || !type.basicWeights) return 1.0;
    return type.basicWeights[affixType] != null ? type.basicWeights[affixType] : 1.0;
}

function getWeaponBasicValueScale(weaponType, affixType) {
    const type = weaponType && WEAPON_TYPES[weaponType];
    if (!type || !type.basicValueScale) return 1.0;
    return type.basicValueScale[affixType] != null ? type.basicValueScale[affixType] : 1.0;
}

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
    vampiric: { lifesteal: 0.06, description: '6% Lifesteal' },
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
// options.weaponType: when slot is weapon, applies basic weights + purple/orange accent pools
function generateAffixes(gearTier, slot, options = {}) {
    const weaponType = options.weaponType || null;
    const useAccentPools = slot === 'weapon' && weaponType && (gearTier === 'purple' || gearTier === 'orange');
    const upgrades = (typeof SaveSystem !== 'undefined' && SaveSystem.getGearUpgrades)
        ? SaveSystem.getGearUpgrades()
        : {};
    const slotConfig = getTieredAffixSlots(gearTier, upgrades);
    if (!slotConfig) return [];
    
    // Determine active classes for smart loot distribution
    const activeClasses = new Set();
    if (typeof Game !== 'undefined') {
        if (Game.player && Game.player.playerClass) {
            activeClasses.add(Game.player.playerClass);
        }
        // Check other players in multiplayer
        if (Game.players) {
            Game.players.forEach(p => {
                if (p && p.playerClass) activeClasses.add(p.playerClass);
            });
        }
    }
    
    const selectedAffixes = [];
    const usedAffixTypes = new Set(); // Prevent duplicates across all tiers

    function buildCompatibleList(affixTier) {
        const compatible = [];
        const tierAffixes = AFFIX_TIERS[affixTier] || [];
        const allowlist = useAccentPools ? getWeaponTypeAffixAllowlist(weaponType, affixTier) : null;

        for (const affixType of tierAffixes) {
            const affixData = AFFIX_POOL[affixType];
            if (!affixData || !affixData.slot.includes(slot) || usedAffixTypes.has(affixType)) continue;
            if (isAffixExcludedForWeaponType(weaponType, affixType) && useAccentPools && affixTier !== 'basic') {
                continue;
            }
            if (allowlist && affixTier !== 'basic' && !allowlist.includes(affixType)) {
                continue;
            }

            let weight = affixData.weight || 1.0;
            if (affixData.class) {
                if (activeClasses.has(affixData.class)) {
                    weight *= 4.0;
                } else {
                    continue;
                }
            }
            if (slot === 'weapon' && weaponType && affixTier === 'basic') {
                weight *= getWeaponBasicWeight(weaponType, affixType);
            }

            compatible.push({ type: affixType, data: affixData, weight: weight });
        }

        // Starvation fallback for purple/orange rare/advanced: widen with honest rare safety set
        if (useAccentPools && (affixTier === 'rare' || affixTier === 'advanced') && compatible.length < 2) {
            if (typeof console !== 'undefined' && console.log) {
                console.log(`[AFFIX POOL] Starvation fallback for ${weaponType} ${affixTier} (had ${compatible.length})`);
            }
            const safetySource = affixTier === 'rare'
                ? WEAPON_RARE_SAFETY_SET
                : (WEAPON_TYPE_AFFIX_POOLS[weaponType].advanced || []);
            for (const affixType of safetySource) {
                if (usedAffixTypes.has(affixType) || isAffixExcludedForWeaponType(weaponType, affixType)) continue;
                const affixData = AFFIX_POOL[affixType];
                if (!affixData || !affixData.slot.includes(slot)) continue;
                if (affixTier === 'rare' && affixData.tier !== 'rare') continue;
                if (affixData.class && !activeClasses.has(affixData.class)) continue;
                if (compatible.some(c => c.type === affixType)) continue;
                compatible.push({
                    type: affixType,
                    data: affixData,
                    weight: (affixData.weight || 1.0) * 0.85
                });
            }
        }

        return compatible;
    }
    
    // Helper: Select random affix from tier pool
    function selectFromTier(affixTier, count) {
        if (count <= 0) return;
        
        const compatible = buildCompatibleList(affixTier);
        
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
            if (slot === 'weapon' && weaponType && affixTier === 'basic') {
                value *= getWeaponBasicValueScale(weaponType, selected.type);
            }
            // Round integer affixes to whole numbers
            const integerAffixes = [
                'dodgeCharges', 'maxHealth', 'pierce', 'chainLightning', 'multishot', 
                'beamCharges', 'beamPenetration', 'fanCount'
            ];
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
    boss: { multiplier: 4.5, name: 'boss' }          // Bosses (dedicated reward curve below)
};

// Boss loot progress: 0 at first boss (room 10), 1 around room 50.
// Early bosses reward above trash without dumping late-game rarity every kill.
function getBossLootProgress(roomNumber) {
    return Math.max(0, Math.min(1, (roomNumber - 10) / 40));
}

function lerpBossLoot(a, b, t) {
    return a + (b - a) * t;
}

// Room-scaled boss extras curve: Swarm King leans blue; late bosses lean purple/orange.
function getBossTierBaseWeights(roomNumber) {
    const t = getBossLootProgress(roomNumber);
    return {
        gray: 0,
        green: lerpBossLoot(22, 2, t),
        blue: lerpBossLoot(63, 28, t),
        purple: lerpBossLoot(13, 45, t),
        orange: lerpBossLoot(2, 25, t)
    };
}

const BOSS_TIER_GROWTH_RATES = {
    gray: 0,
    green: -1.2,
    blue: -0.6,
    purple: 1.0,
    orange: 1.6
};

// Highlight piece for a boss kill. Always above trash, but epic/legendary ramp with room.
// Room 10: mostly blue, purple uncommon, orange rare. Room 50: purple/orange jackpot.
function rollBossTrophyTier(roomNumber, rng = Math.random) {
    const t = getBossLootProgress(roomNumber);
    const roll = typeof rng === 'function' ? rng() : Math.random();

    const orangeChance = lerpBossLoot(0.02, 0.42, t);
    const purpleChance = lerpBossLoot(0.16, 0.50, t);

    if (roll < orangeChance) return 'orange';
    if (roll < orangeChance + purpleChance) return 'purple';
    // Pre-room-30 trophies can still be "just" rare (blue) - still a clear upgrade over trash
    if (t < 0.55) return 'blue';
    return 'purple';
}

// Calculate tier probabilities based on room number and enemy difficulty
// Uses gradual curve: slow early progression, accelerates in later rooms
function calculateTierProbabilities(roomNumber, enemyDifficulty = 'basic') {
    // Get difficulty multiplier
    const difficultyData = ENEMY_DIFFICULTY[enemyDifficulty] || ENEMY_DIFFICULTY.basic;
    const diffMultiplier = difficultyData.multiplier;
    const isBoss = difficultyData.name === 'boss';
    
    // Calculate effective level: 75% room weight, 25% difficulty weight
    const effectiveLevel = roomNumber * 0.75 + (roomNumber * diffMultiplier * 0.25);
    
    // Gradual curve scaling factor (exponent creates acceleration)
    const scalingFactor = Math.pow(effectiveLevel, 1.2) / 150; // Reduced from /100, slower curve
    
    const upgrades = (typeof SaveSystem !== 'undefined' && SaveSystem.getGearUpgrades)
        ? SaveSystem.getGearUpgrades()
        : { rarityChanceGreen: 0, rarityChanceBlue: 0, rarityChancePurple: 0, rarityChanceOrange: 0 };

    // Base weights: trash enemies stay gray-heavy; bosses use a room-scaled reward curve
    const baseWeights = isBoss
        ? getBossTierBaseWeights(roomNumber)
        : {
            gray: 75,
            green: 23,
            blue: 1.7,
            purple: 0.25,
            orange: 0.05
        };
    
    // Growth rates per tier (how much each tier grows with scaling)
    const growthRates = isBoss
        ? BOSS_TIER_GROWTH_RATES
        : {
            gray: -2.8,   // Gray decreases slower
            green: -1.0,  // Green decreases slower
            blue: 0.8,    // Blue increases
            purple: 1.4,  // Purple increases
            orange: 1.6   // Orange increases
        };
    
    // Calculate adjusted weights (boss gray may stay at 0)
    let weights = {};
    for (let tier in baseWeights) {
        const floor = (isBoss && tier === 'gray') ? 0 : 0.1;
        weights[tier] = Math.max(floor, baseWeights[tier] + (scalingFactor * growthRates[tier]));
    }
    
    // Convert to preliminary probabilities to apply relative multiplier upgrades safely
    const preTotal = Object.values(weights).reduce((sum, w) => sum + w, 0);
    let probs = {};
    for (let tier in weights) {
        probs[tier] = weights[tier] / preTotal;
    }

    // Apply independent upward multipliers (no sequence breaking early game)
    probs.green  *= (1 + (upgrades.rarityChanceGreen || 0) * 0.10);
    probs.blue   *= (1 + (upgrades.rarityChanceBlue || 0) * 0.08);
    probs.purple *= (1 + (upgrades.rarityChancePurple || 0) * 0.06);
    probs.orange *= (1 + (upgrades.rarityChanceOrange || 0) * 0.04);

    // Normalize so it always equals 1.0 without dropping below zero
    const minGray = isBoss ? 0.0 : 0.05;
    const totalHigherTiers = probs.green + probs.blue + probs.purple + probs.orange;
    probs.gray = Math.max(minGray, 1.0 - totalHigherTiers);

    // Final normalization
    const newTotal = probs.gray + totalHigherTiers;
    let probabilities = {};
    for (let key in probs) {
        probabilities[key] = probs[key] / newTotal;
    }
    
    return probabilities;
}

// Generate random gear with stats
function generateGear(x, y, roomNumberOrTier = 1, enemyDifficulty = 'basic') {
    // Only generate gear in gear mode
    if (typeof Game !== 'undefined' && Game.gameMode !== 'gear') {
        return null;
    }
    
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

        // Boss drops are never trash - floor at rare (blue)
        if (enemyDifficulty === 'boss') {
            const minIdx = tiers.indexOf('blue');
            if (tiers.indexOf(tier) < minIdx) {
                tier = 'blue';
            }
        }
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
    
    // Generate affixes based on tier and slot (weapon type accents purple/orange + basic weights)
    const affixes = generateAffixes(tier, slot, { weaponType });
    
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
        pulse: 0, // For pulsing animation
        phaseOffset: Math.random() * Math.PI * 2,
        level: roomNumber,
        upgradesApplied: 0,
        originalTier: tier,
        rarityStepsApplied: 0,
        rarityUpgradedThisVisit: false,
        rerollIndex: -1,
        rerollCount: 0
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
    beamPenetration: { shape: 'penetrate', color: { r: 100, g: 200, b: 255 } },
    
    // Warrior affixes
    whirlwindRadius: { shape: 'spiral', color: { r: 255, g: 150, b: 50 } },
    thrustSpeed: { shape: 'arrow', color: { r: 255, g: 100, b: 50 } },
    cleaveArea: { shape: 'arc', color: { r: 255, g: 80, b: 0 } },
    
    // Rogue affixes
    cloneDuration: { shape: 'ghost', color: { r: 255, g: 50, b: 150 } },
    dashCooldown: { shape: 'flash', color: { r: 255, g: 100, b: 200 } },
    fanCount: { shape: 'fan', color: { r: 200, g: 0, b: 100 } },
    
    // Tank affixes
    shieldWidth: { shape: 'wall', color: { r: 100, g: 150, b: 255 } },
    shoutStun: { shape: 'ring', color: { r: 200, g: 50, b: 50 } },
    hammerHeal: { shape: 'heart', color: { r: 50, g: 255, b: 100 } }
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

const GEAR_BASE_SIZE = 15;
const GEAR_SPRITE_CACHE_MAX = 128;
const gearSpriteCache = new Map();
const gearSpriteCacheOrder = [];

function isGroundGearVisible(gear, margin) {
    if (typeof Game === 'undefined' || !Game.camera || !Game.config) {
        return true;
    }
    const zoom = Game.baseZoom || 1;
    const halfWidth = (Game.config.width / 2) / zoom + margin;
    const halfHeight = (Game.config.height / 2) / zoom + margin;
    return (
        gear.x >= Game.camera.x - halfWidth &&
        gear.x <= Game.camera.x + halfWidth &&
        gear.y >= Game.camera.y - halfHeight &&
        gear.y <= Game.camera.y + halfHeight
    );
}

function ensureGearDropMetadata(gear) {
    if (!gear) return gear;
    if (gear.pulse == null) gear.pulse = 0;
    if (gear.phaseOffset == null) {
        if (gear.id) {
            let hash = 0;
            for (let i = 0; i < gear.id.length; i++) {
                hash = ((hash << 5) - hash + gear.id.charCodeAt(i)) | 0;
            }
            gear.phaseOffset = (Math.abs(hash) % 628) / 100;
        } else {
            gear.phaseOffset = Math.random() * Math.PI * 2;
        }
    }
    if (!gear.size) gear.size = GEAR_BASE_SIZE;
    return gear;
}

function buildGearSpriteCacheKey(gear) {
    const affixTypes = (gear.affixes || []).map(a => a.type);
    return [
        gear.tier || 'gray',
        gear.slot || '',
        gear.weaponType || '',
        gear.armorType || '',
        [...affixTypes].sort().join(','),
        gear.legendaryEffect ? 'L' : '',
        gear.classModifier ? 'C' : ''
    ].join('_');
}

function touchGearSpriteCacheKey(key) {
    const idx = gearSpriteCacheOrder.indexOf(key);
    if (idx >= 0) gearSpriteCacheOrder.splice(idx, 1);
    gearSpriteCacheOrder.push(key);
    while (gearSpriteCacheOrder.length > GEAR_SPRITE_CACHE_MAX) {
        const evict = gearSpriteCacheOrder.shift();
        gearSpriteCache.delete(evict);
    }
}

function drawGroundAffixRingPath(ctx, centerX, centerY, ringRadius, affixes, tierOpacity, numPoints, time) {
    let baseR = 0, baseG = 0, baseB = 0;
    let colorCount = 0;
    affixes.forEach(affix => {
        const affixConfig = AFFIX_VISUAL_MAP[affix.type];
        if (affixConfig) {
            baseR += affixConfig.color.r;
            baseG += affixConfig.color.g;
            baseB += affixConfig.color.b;
            colorCount++;
        }
    });
    if (colorCount > 0) {
        baseR = Math.floor(baseR / colorCount);
        baseG = Math.floor(baseG / colorCount);
        baseB = Math.floor(baseB / colorCount);
    } else {
        baseR = 150; baseG = 150; baseB = 150;
    }

    const animTime = typeof time === 'number' ? time : 0;

    ctx.beginPath();
    for (let i = 0; i <= numPoints; i++) {
        const angle = (i / numPoints) * Math.PI * 2;
        let waveOffset = 0;
        const affixesToShow = Math.min(2, affixes.length);
        for (let a = 0; a < affixesToShow; a++) {
            const affix = affixes[a];
            const affixConfig = AFFIX_VISUAL_MAP[affix.type];
            if (affixConfig) {
                const freq = 2 + a;
                const smoothPhase = animTime * (0.5 + a * 0.2);
                const normalizedAngle = ((angle * freq + smoothPhase) % (Math.PI * 2)) / (Math.PI * 2);
                const waveValue = normalizedAngle < 0.5 ? (normalizedAngle * 4 - 1) : (3 - normalizedAngle * 4);
                waveOffset += waveValue * 4;
            }
        }
        const radius = ringRadius + waveOffset;
        const px = centerX + Math.cos(angle) * radius;
        const py = centerY + Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.strokeStyle = `rgba(${baseR}, ${baseG}, ${baseB}, ${tierOpacity * 0.8})`;
    ctx.lineWidth = 2;
    ctx.stroke();
    return { baseR, baseG, baseB };
}

function drawGroundSlotGlyph(ctx, centerX, centerY, slot, size) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.beginPath();
    if (slot === 'weapon') {
        ctx.moveTo(centerX, centerY - size * 0.35);
        ctx.lineTo(centerX + size * 0.3, centerY + size * 0.25);
        ctx.lineTo(centerX - size * 0.3, centerY + size * 0.25);
        ctx.closePath();
    } else if (slot === 'armor') {
        ctx.rect(centerX - size * 0.25, centerY - size * 0.25, size * 0.5, size * 0.5);
    } else {
        ctx.arc(centerX, centerY, size * 0.18, 0, Math.PI * 2);
    }
    ctx.fill();
}

function bakeGearSprite(gear) {
    const tier = gear.tier || 'gray';
    const tierOpacity = TIER_OPACITY[tier] || 0.5;
    const baseSize = gear.size || GEAR_BASE_SIZE;
    const ringRadius = baseSize + 10;
    const padding = 40;
    const diameter = (ringRadius + 20) * 2;
    const canvas = document.createElement('canvas');
    canvas.width = diameter + padding * 2;
    canvas.height = diameter + padding * 2;
    const ctx = canvas.getContext('2d');
    const center = canvas.width / 2;

    ctx.fillStyle = gear.color || '#999999';
    ctx.globalAlpha = tierOpacity;
    ctx.beginPath();
    ctx.arc(center, center, baseSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;

    ctx.strokeStyle = gear.color || '#999999';
    ctx.lineWidth = 2;
    ctx.stroke();

    if (gear.weaponType && WEAPON_TYPES[gear.weaponType]) {
        ctx.strokeStyle = WEAPON_TYPES[gear.weaponType].color;
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 3]);
        ctx.beginPath();
        ctx.arc(center, center, baseSize + 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
    } else if (gear.armorType && ARMOR_TYPES[gear.armorType]) {
        ctx.strokeStyle = ARMOR_TYPES[gear.armorType].color;
        ctx.lineWidth = 3;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.arc(center, center, baseSize + 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    drawGroundSlotGlyph(ctx, center, center, gear.slot, baseSize);

    let ringCanvas = null;
    if (gear.affixes && gear.affixes.length > 0) {
        ringCanvas = document.createElement('canvas');
        ringCanvas.width = canvas.width;
        ringCanvas.height = canvas.height;
        const ringCtx = ringCanvas.getContext('2d');
        drawGroundAffixRingPath(ringCtx, center, center, ringRadius, gear.affixes, tierOpacity, 32);
    }

    let legendaryFrames = null;
    if (gear.legendaryEffect) {
        legendaryFrames = [];
        for (let f = 0; f < 4; f++) {
            const frameCanvas = document.createElement('canvas');
            frameCanvas.width = canvas.width;
            frameCanvas.height = canvas.height;
            const fCtx = frameCanvas.getContext('2d');
            const pulse = f / 4;
            const legendaryPulse = Math.sin(pulse * Math.PI * 2) * 0.5 + 0.5;
            fCtx.fillStyle = `rgba(255, 170, 0, ${0.3 * legendaryPulse})`;
            fCtx.beginPath();
            fCtx.arc(center, center, baseSize + 15, 0, Math.PI * 2);
            fCtx.fill();
            legendaryFrames.push(frameCanvas);
        }
    } else if (gear.tier === 'orange' && gear.classModifier) {
        legendaryFrames = [];
        for (let f = 0; f < 4; f++) {
            const frameCanvas = document.createElement('canvas');
            frameCanvas.width = canvas.width;
            frameCanvas.height = canvas.height;
            const fCtx = frameCanvas.getContext('2d');
            const pulse = f / 4;
            const modifierPulse = Math.sin(pulse * Math.PI * 2) * 0.5 + 0.5;
            fCtx.fillStyle = `rgba(85, 204, 255, ${0.22 * modifierPulse})`;
            fCtx.beginPath();
            fCtx.arc(center, center, baseSize + 12, 0, Math.PI * 2);
            fCtx.fill();
            legendaryFrames.push(frameCanvas);
        }
    }

    return {
        baseCanvas: canvas,
        ringCanvas,
        legendaryFrames,
        baseSize,
        centerOffset: canvas.width / 2
    };
}

function getCachedGearSprite(gear) {
    const key = buildGearSpriteCacheKey(gear);
    if (gearSpriteCache.has(key)) {
        touchGearSpriteCacheKey(key);
        return gearSpriteCache.get(key);
    }
    const sprite = bakeGearSprite(gear);
    gearSpriteCache.set(key, sprite);
    touchGearSpriteCacheKey(key);
    return sprite;
}

function updateGroundLoot(deltaTime) {
    if (typeof groundLoot === 'undefined' || !Array.isArray(groundLoot)) return;
    const pulseRate = 0.05 * (deltaTime || 1) * 60;
    groundLoot.forEach(gear => {
        if (!isGroundGearVisible(gear, 50)) return;
        gear.pulse = (gear.pulse || 0) + pulseRate;
    });
}

function renderGroundLootUncached(ctx, gear) {
    const pulseSize = 2 + Math.sin(gear.pulse || 0) * 2;
    const time = Date.now() * 0.0003;

    if (!gear.tier) gear.tier = 'gray';
    if (!gear.stats) gear.stats = {};

    const tierOpacity = TIER_OPACITY[gear.tier] || 0.5;
    const tierGlow = TIER_GLOW[gear.tier] || 0;

    ctx.save();

    if (tierGlow > 0) {
        ctx.shadowBlur = tierGlow;
        ctx.shadowColor = gear.color || '#999999';
    }

    if (gear.legendaryEffect) {
        ctx.shadowBlur = 30;
        ctx.shadowColor = '#ffaa00';
        const legendaryPulse = Math.sin((gear.pulse || 0) * 0.5) * 0.5 + 0.5;
        ctx.fillStyle = `rgba(255, 170, 0, ${0.3 * legendaryPulse})`;
        ctx.beginPath();
        ctx.arc(gear.x, gear.y, gear.size + pulseSize + 15, 0, Math.PI * 2);
        ctx.fill();
    } else if (gear.tier === 'orange' && gear.classModifier) {
        ctx.shadowBlur = 22;
        ctx.shadowColor = '#55ccff';
        const modifierPulse = Math.sin((gear.pulse || 0) * 0.45) * 0.5 + 0.5;
        ctx.fillStyle = `rgba(85, 204, 255, ${0.22 * modifierPulse})`;
        ctx.beginPath();
        ctx.arc(gear.x, gear.y, gear.size + pulseSize + 12, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.fillStyle = gear.color || '#999999';
    ctx.globalAlpha = tierOpacity;
    ctx.beginPath();
    ctx.arc(gear.x, gear.y, gear.size + pulseSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;

    ctx.strokeStyle = gear.color || '#999999';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.shadowBlur = 0;

    if (gear.affixes && gear.affixes.length > 0) {
        const ringRadius = gear.size + pulseSize + 10;
        ctx.save();
        ctx.translate(gear.x, gear.y);
        ctx.rotate(time * 0.5 + (gear.phaseOffset || 0));
        drawGroundAffixRingPath(ctx, 0, 0, ringRadius, gear.affixes, tierOpacity, 32, time);
        ctx.restore();
    }

    if (gear.weaponType && WEAPON_TYPES[gear.weaponType]) {
        ctx.strokeStyle = WEAPON_TYPES[gear.weaponType].color;
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 3]);
        ctx.beginPath();
        ctx.arc(gear.x, gear.y, gear.size + pulseSize + 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    if (gear.armorType && ARMOR_TYPES[gear.armorType]) {
        ctx.strokeStyle = ARMOR_TYPES[gear.armorType].color;
        ctx.lineWidth = 3;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.arc(gear.x, gear.y, gear.size + pulseSize + 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    drawGroundSlotGlyph(ctx, gear.x, gear.y, gear.slot, gear.size);

    ctx.restore();
}

function renderGroundLootCached(ctx, gear) {
    const sprite = getCachedGearSprite(gear);
    const pulseSize = 2 + Math.sin(gear.pulse || 0) * 2;
    const baseSize = sprite.baseSize || GEAR_BASE_SIZE;
    const scale = (baseSize + pulseSize) / baseSize;
    const time = Date.now() * 0.0003;
    const offset = sprite.centerOffset;

    ctx.save();
    ctx.translate(gear.x, gear.y);
    ctx.scale(scale, scale);

    if (sprite.legendaryFrames && sprite.legendaryFrames.length > 0) {
        const frameIdx = Math.floor((gear.pulse || 0) * 0.5) % sprite.legendaryFrames.length;
        ctx.drawImage(sprite.legendaryFrames[frameIdx], -offset, -offset);
    }

    ctx.drawImage(sprite.baseCanvas, -offset, -offset);

    if (gear.affixes && gear.affixes.length > 0) {
        const tierOpacity = TIER_OPACITY[gear.tier] || 0.5;
        const ringRadius = baseSize + 10;
        const animatedRing = typeof Game === 'undefined' || !Game.renderQuality || Game.renderQuality.groundLootAnimatedRing !== false;
        ctx.save();
        if (animatedRing) {
            ctx.rotate(time * 0.5 + (gear.phaseOffset || 0));
        }
        drawGroundAffixRingPath(ctx, 0, 0, ringRadius, gear.affixes, tierOpacity, 32, time);
        ctx.restore();
    }

    ctx.restore();
}

function renderGroundLootItem(ctx, gear) {
    ensureGearDropMetadata(gear);
    const useCache = typeof DebugFlags === 'undefined' || DebugFlags.USE_CACHING !== false;
    if (useCache) {
        renderGroundLootCached(ctx, gear);
    } else {
        renderGroundLootUncached(ctx, gear);
    }
}

// Render ground loot (optional culled list)
function renderGroundLoot(ctx, visibleLoot) {
    const items = visibleLoot || groundLoot;
    if (!items || !Array.isArray(items)) return;

    items.forEach(gear => {
        renderGroundLootItem(ctx, gear);
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
    
    // Add weapon type identity (short pickup line - full writeup lives in Nexus Index)
    if (gear.slot === 'weapon' && gear.weaponType && WEAPON_TYPES[gear.weaponType]) {
        const info = typeof getWeaponTypePickupInfo === 'function'
            ? getWeaponTypePickupInfo(gear.weaponType)
            : null;
        if (info) {
            statsStr.push(`[${info.name}] ${info.blurb}`);
        } else {
            const wt = WEAPON_TYPES[gear.weaponType];
            statsStr.push(`[${wt.name}] ${wt.pickupBlurb || wt.accentHint || ''}`);
        }
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

// Rerolls a single affix of a gear piece, respecting class smart loot and upgrades scaling
function rerollGearAffix(gear, index) {
    const oldAffix = gear.affixes[index];
    if (!oldAffix) return;

    const slot = gear.slot;
    const weaponType = gear.weaponType || null;
    const useAccentPools = slot === 'weapon' && weaponType && (gear.tier === 'purple' || gear.tier === 'orange');
    const activeClasses = new Set();
    if (typeof Game !== 'undefined') {
        if (Game.player && Game.player.playerClass) {
            activeClasses.add(Game.player.playerClass);
        }
        if (Game.players) {
            Game.players.forEach(p => {
                if (p && p.playerClass) activeClasses.add(p.playerClass);
            });
        }
    }

    // Get compatible affixes for this tier and slot
    const compatible = [];
    const tierAffixes = AFFIX_TIERS[oldAffix.tier] || [];
    const allowlist = useAccentPools ? getWeaponTypeAffixAllowlist(weaponType, oldAffix.tier) : null;

    for (const affixType of tierAffixes) {
        const affixData = AFFIX_POOL[affixType];
        if (!affixData || !affixData.slot.includes(slot)) continue;
        if (affixData.class && !activeClasses.has(affixData.class)) continue;
        if (useAccentPools && oldAffix.tier !== 'basic') {
            if (isAffixExcludedForWeaponType(weaponType, affixType)) continue;
            if (allowlist && !allowlist.includes(affixType)) continue;
        }
        let weight = affixData.weight || 1.0;
        if (slot === 'weapon' && weaponType && oldAffix.tier === 'basic') {
            weight *= getWeaponBasicWeight(weaponType, affixType);
        }
        compatible.push({ type: affixType, data: affixData, weight });
    }

    if (useAccentPools && (oldAffix.tier === 'rare' || oldAffix.tier === 'advanced') && compatible.length < 2) {
        for (const affixType of WEAPON_RARE_SAFETY_SET) {
            if (isAffixExcludedForWeaponType(weaponType, affixType)) continue;
            const affixData = AFFIX_POOL[affixType];
            if (!affixData || !affixData.slot.includes(slot) || affixData.tier !== 'rare') continue;
            if (compatible.some(c => c.type === affixType)) continue;
            compatible.push({ type: affixType, data: affixData, weight: 0.85 });
        }
    }

    if (compatible.length > 0) {
        const totalWeight = compatible.reduce((s, c) => s + (c.weight || 1), 0);
        let random = Math.random() * totalWeight;
        let selected = compatible[0];
        for (const c of compatible) {
            random -= (c.weight || 1);
            if (random <= 0) {
                selected = c;
                break;
            }
        }
        let value = selected.data.min + Math.random() * (selected.data.max - selected.data.min);
        if (slot === 'weapon' && weaponType && oldAffix.tier === 'basic') {
            value *= getWeaponBasicValueScale(weaponType, selected.type);
        }

        // Round integer affixes
        const integerAffixes = [
            'dodgeCharges', 'maxHealth', 'pierce', 'chainLightning', 'multishot',
            'beamCharges', 'beamPenetration', 'fanCount'
        ];
        if (integerAffixes.includes(selected.type)) {
            value = Math.round(value);
        }

        // Apply upgraded level scaling if item has been upgraded
        if (gear.upgradesApplied && gear.upgradesApplied > 0) {
            value *= (1 + gear.upgradesApplied * 0.04);
            if (integerAffixes.includes(selected.type)) {
                value = Math.round(value);
            }
        }

        gear.affixes[index] = {
            type: selected.type,
            value: value,
            tier: oldAffix.tier
        };

        // Keep name identity on reroll (do not regenerate)
    }
}

const GEAR_TIER_ORDER = ['gray', 'green', 'blue', 'purple', 'orange'];

const RARITY_UPGRADE_BASE_COSTS = {
    gray: 150,   // gray → green
    green: 350,  // green → blue
    blue: 800,   // blue → purple
    purple: 2000 // purple → orange
};

function normalizeGearProgressFields(gear) {
    if (!gear || typeof gear !== 'object') return gear;
    if (gear.level == null || !Number.isFinite(gear.level)) {
        gear.level = gear.roomNumber || 1;
    }
    if (gear.upgradesApplied == null || !Number.isFinite(gear.upgradesApplied)) {
        gear.upgradesApplied = 0;
    }
    if (!gear.originalTier) {
        gear.originalTier = gear.tier || 'gray';
    }
    if (gear.rarityStepsApplied == null || !Number.isFinite(gear.rarityStepsApplied)) {
        gear.rarityStepsApplied = 0;
    }
    if (gear.rarityUpgradedThisVisit == null) {
        gear.rarityUpgradedThisVisit = false;
    }
    if (gear.rerollIndex == null || !Number.isFinite(gear.rerollIndex)) {
        gear.rerollIndex = -1;
    }
    if (gear.rerollCount == null || !Number.isFinite(gear.rerollCount)) {
        gear.rerollCount = 0;
    }
    return gear;
}

/**
 * Shared gear network whitelist for ground loot and equipped slots.
 * @param {object} gear
 * @param {{ includeWorld?: boolean }} [options]
 *   includeWorld: ground loot (x/y/size/pulse). Equipped uses false and
 *   preserves prior stats/name defaults (|| {} / || '').
 */
function serializeGearForNetwork(gear, options = {}) {
    if (!gear) return null;
    normalizeGearProgressFields(gear);
    const includeWorld = !!options.includeWorld;
    const payload = {
        id: gear.id,
        slot: gear.slot,
        tier: gear.tier,
        color: gear.color,
        bonus: gear.bonus,
        affixes: gear.affixes || [],
        classModifier: gear.classModifier || null,
        weaponType: gear.weaponType || null,
        armorType: gear.armorType || null,
        legendaryEffect: gear.legendaryEffect || null,
        roomNumber: gear.roomNumber,
        scaling: gear.scaling,
        level: gear.level != null ? gear.level : (gear.roomNumber || 1),
        upgradesApplied: gear.upgradesApplied != null ? gear.upgradesApplied : 0,
        originalTier: gear.originalTier || gear.tier,
        rarityStepsApplied: gear.rarityStepsApplied != null ? gear.rarityStepsApplied : 0,
        rarityUpgradedThisVisit: !!gear.rarityUpgradedThisVisit,
        rerollIndex: gear.rerollIndex != null ? gear.rerollIndex : -1,
        rerollCount: gear.rerollCount != null ? gear.rerollCount : 0
    };
    if (includeWorld) {
        // Ground loot: preserve prior nullish behavior for stats/name
        payload.x = gear.x;
        payload.y = gear.y;
        payload.size = gear.size || 15;
        payload.pulse = gear.pulse || 0;
        payload.stats = gear.stats;
        payload.name = gear.name;
    } else {
        // Equipped: prior defaults for remote display / safe-room progress
        payload.stats = gear.stats || {};
        payload.name = gear.name || '';
    }
    return payload;
}

function getNextGearTier(tier) {
    const idx = GEAR_TIER_ORDER.indexOf(tier);
    if (idx < 0 || idx >= GEAR_TIER_ORDER.length - 1) return null;
    return GEAR_TIER_ORDER[idx + 1];
}

function getRarityUpgradeBaseCost(fromTier) {
    return RARITY_UPGRADE_BASE_COSTS[fromTier] || null;
}

function getGearTypeMultiplier(gear) {
    if (!gear) return 1;
    if (gear.slot === 'weapon' && gear.weaponType && WEAPON_TYPES[gear.weaponType]) {
        return WEAPON_TYPES[gear.weaponType].damageMultiplier || 1;
    }
    if (gear.slot === 'armor' && gear.armorType && ARMOR_TYPES[gear.armorType]) {
        return ARMOR_TYPES[gear.armorType].defenseMultiplier || 1;
    }
    return 1;
}

function adaptPrimaryStatsToTier(gear, oldTier, newTier) {
    if (!gear || !gear.stats) return;
    const upgradeMul = Math.pow(1.04, gear.upgradesApplied || 0);
    const scaling = gear.scaling || 1;
    const typeMul = getGearTypeMultiplier(gear);

    if (gear.slot === 'weapon' && gear.stats.damage != null) {
        const oldR = FLAT_STAT_RANGES.weapon.damage[oldTier];
        const newR = FLAT_STAT_RANGES.weapon.damage[newTier];
        if (oldR && newR) {
            const raw = gear.stats.damage / upgradeMul;
            const base = raw / (scaling * typeMul);
            const quality = Math.max(0, Math.min(1, (base - oldR.min) / Math.max(0.0001, oldR.max - oldR.min)));
            const newBase = newR.min + quality * (newR.max - newR.min);
            gear.stats.damage = newBase * scaling * typeMul * upgradeMul;
        }
    } else if (gear.slot === 'armor' && gear.stats.defense != null) {
        const oldR = FLAT_STAT_RANGES.armor.defense[oldTier];
        const newR = FLAT_STAT_RANGES.armor.defense[newTier];
        if (oldR && newR) {
            const raw = gear.stats.defense / upgradeMul;
            const base = raw / (scaling * typeMul);
            const quality = Math.max(0, Math.min(1, (base - oldR.min) / Math.max(0.0001, oldR.max - oldR.min)));
            const newBase = newR.min + quality * (newR.max - newR.min);
            gear.stats.defense = newBase * scaling * typeMul * upgradeMul;
        }
    } else if (gear.slot === 'accessory' && gear.stats.speed != null) {
        const oldBonus = TIER_BONUSES[oldTier] || 0;
        const newBonus = TIER_BONUSES[newTier] || 0;
        const denom = oldBonus > 0 ? oldBonus : 0.05;
        gear.stats.speed = gear.stats.speed * (newBonus > 0 ? newBonus : 0.05) / denom;
    }
}

function rollSingleAffixForSlot(affixTier, slot, usedAffixTypes, options = {}) {
    const weaponType = options.weaponType || null;
    const gearTier = options.gearTier || null;
    const useAccentPools = slot === 'weapon' && weaponType && (gearTier === 'purple' || gearTier === 'orange');
    const tierAffixes = AFFIX_TIERS[affixTier] || [];
    const activeClasses = new Set();
    if (typeof Game !== 'undefined') {
        if (Game.player && Game.player.playerClass) activeClasses.add(Game.player.playerClass);
        if (Game.players) {
            Game.players.forEach(p => {
                if (p && p.playerClass) activeClasses.add(p.playerClass);
            });
        }
        if (Game.remotePlayerInstances) {
            Game.remotePlayerInstances.forEach(p => {
                if (p && p.playerClass) activeClasses.add(p.playerClass);
            });
        }
    }

    const allowlist = useAccentPools ? getWeaponTypeAffixAllowlist(weaponType, affixTier) : null;
    const compatible = [];
    for (const affixType of tierAffixes) {
        if (usedAffixTypes.has(affixType)) continue;
        const affixData = AFFIX_POOL[affixType];
        if (!affixData || !affixData.slot.includes(slot)) continue;
        if (affixData.class && !activeClasses.has(affixData.class)) continue;
        if (useAccentPools && affixTier !== 'basic') {
            if (isAffixExcludedForWeaponType(weaponType, affixType)) continue;
            if (allowlist && !allowlist.includes(affixType)) continue;
        }
        let weight = affixData.weight || 1.0;
        if (slot === 'weapon' && weaponType && affixTier === 'basic') {
            weight *= getWeaponBasicWeight(weaponType, affixType);
        }
        compatible.push({ type: affixType, data: affixData, weight });
    }
    if (useAccentPools && (affixTier === 'rare' || affixTier === 'advanced') && compatible.length < 2) {
        for (const affixType of WEAPON_RARE_SAFETY_SET) {
            if (usedAffixTypes.has(affixType) || isAffixExcludedForWeaponType(weaponType, affixType)) continue;
            const affixData = AFFIX_POOL[affixType];
            if (!affixData || !affixData.slot.includes(slot) || affixData.tier !== 'rare') continue;
            if (compatible.some(c => c.type === affixType)) continue;
            compatible.push({ type: affixType, data: affixData, weight: 0.85 });
        }
    }
    if (compatible.length === 0) return null;

    const totalWeight = compatible.reduce((s, c) => s + (c.weight || 1), 0);
    let random = Math.random() * totalWeight;
    let selected = compatible[0];
    for (const c of compatible) {
        random -= (c.weight || 1);
        if (random <= 0) {
            selected = c;
            break;
        }
    }
    let value = selected.data.min + Math.random() * (selected.data.max - selected.data.min);
    if (slot === 'weapon' && weaponType && affixTier === 'basic') {
        value *= getWeaponBasicValueScale(weaponType, selected.type);
    }
    const integerAffixes = [
        'dodgeCharges', 'maxHealth', 'pierce', 'chainLightning', 'multishot',
        'beamCharges', 'beamPenetration', 'fanCount'
    ];
    if (integerAffixes.includes(selected.type)) value = Math.round(value);

    usedAffixTypes.add(selected.type);
    return { type: selected.type, value, tier: affixTier };
}

function appendMissingAffixesForTier(gear, newTier) {
    if (!gear) return;
    gear.affixes = gear.affixes || [];
    const upgrades = (typeof SaveSystem !== 'undefined' && SaveSystem.getGearUpgrades)
        ? SaveSystem.getGearUpgrades()
        : {};
    const slotConfig = getTieredAffixSlots(newTier, upgrades);
    if (!slotConfig) return;

    const used = new Set(gear.affixes.map(a => a.type));
    const counts = { basic: 0, advanced: 0, rare: 0 };
    gear.affixes.forEach(a => {
        if (counts[a.tier] != null) counts[a.tier]++;
    });

    ['basic', 'advanced', 'rare'].forEach(affixTier => {
        const minNeeded = slotConfig[affixTier] ? slotConfig[affixTier][0] : 0;
        let deficit = Math.max(0, minNeeded - counts[affixTier]);
        while (deficit > 0) {
            const rolled = rollSingleAffixForSlot(affixTier, gear.slot, used, {
                weaponType: gear.weaponType || null,
                gearTier: newTier
            });
            if (!rolled) break;
            // Scale new affix if item already has level-ups
            if (gear.upgradesApplied && gear.upgradesApplied > 0) {
                rolled.value *= (1 + gear.upgradesApplied * 0.04);
                const integerAffixes = [
                    'dodgeCharges', 'maxHealth', 'pierce', 'chainLightning', 'multishot',
                    'beamCharges', 'beamPenetration', 'fanCount'
                ];
                if (integerAffixes.includes(rolled.type)) rolled.value = Math.round(rolled.value);
            }
            gear.affixes.push(rolled);
            counts[affixTier]++;
            deficit--;
        }
    });
}

/**
 * Adapt gear in-place to the next rarity tier.
 * Preserves identity/affixes/level-ups; scales primaries; adds only missing affix slots.
 */
function raiseGearRarity(gear) {
    if (!gear) return { ok: false, reason: 'no_gear' };
    normalizeGearProgressFields(gear);

    const oldTier = gear.tier;
    const newTier = getNextGearTier(oldTier);
    if (!newTier) return { ok: false, reason: 'max_tier' };

    adaptPrimaryStatsToTier(gear, oldTier, newTier);

    gear.tier = newTier;
    gear.bonus = TIER_BONUSES[newTier];
    gear.color = GEAR_TIERS[newTier];
    if (!gear.originalTier) gear.originalTier = oldTier;

    appendMissingAffixesForTier(gear, newTier);

    gear.rarityStepsApplied = (gear.rarityStepsApplied || 0) + 1;
    gear.rarityUpgradedThisVisit = true;

    return { ok: true, from: oldTier, to: newTier };
}

function clearAllGearRarityVisitFlags() {
    const clearGear = (gear) => {
        if (gear) gear.rarityUpgradedThisVisit = false;
    };
    const clearPlayer = (player) => {
        if (!player) return;
        clearGear(player.weapon);
        clearGear(player.armor);
        clearGear(player.accessory);
    };

    if (typeof Game !== 'undefined') {
        clearPlayer(Game.player);
        if (Game.remotePlayerInstances) {
            Game.remotePlayerInstances.forEach(clearPlayer);
        }
        if (Game.remotePlayerShadowInstances) {
            Game.remotePlayerShadowInstances.forEach(clearPlayer);
        }
    }

    if (typeof groundLoot !== 'undefined' && Array.isArray(groundLoot)) {
        groundLoot.forEach(clearGear);
    }
    if (typeof window !== 'undefined' && Array.isArray(window.groundLoot)) {
        window.groundLoot.forEach(clearGear);
    }
}

// Expose globally
if (typeof window !== 'undefined') {
    window.rerollGearAffix = rerollGearAffix;
    window.normalizeGearProgressFields = normalizeGearProgressFields;
    window.serializeGearForNetwork = serializeGearForNetwork;
    window.raiseGearRarity = raiseGearRarity;
    window.getNextGearTier = getNextGearTier;
    window.getRarityUpgradeBaseCost = getRarityUpgradeBaseCost;
    window.clearAllGearRarityVisitFlags = clearAllGearRarityVisitFlags;
    window.GEAR_TIER_ORDER = GEAR_TIER_ORDER;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        normalizeGearProgressFields,
        serializeGearForNetwork,
        raiseGearRarity,
        getNextGearTier,
        getRarityUpgradeBaseCost,
        clearAllGearRarityVisitFlags,
        GEAR_TIER_ORDER,
        RARITY_UPGRADE_BASE_COSTS,
        FLAT_STAT_RANGES,
        TIER_BONUSES,
        GEAR_TIERS
    };
}

