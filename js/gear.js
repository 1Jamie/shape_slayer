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

// Global ground loot array
const groundLoot = [];

// Generate random gear with stats
function generateGear(x, y) {
    const tiers = ['gray', 'green', 'blue', 'purple', 'orange'];
    const slots = ['weapon', 'armor', 'accessory'];
    
    // Weighted tier selection
    const rand = Math.random();
    let tier;
    if (rand < 0.5) tier = 'gray';
    else if (rand < 0.8) tier = 'green';
    else if (rand < 0.95) tier = 'blue';
    else if (rand < 0.99) tier = 'purple';
    else tier = 'orange';
    
    const slot = slots[Math.floor(Math.random() * slots.length)];
    const bonus = TIER_BONUSES[tier];
    
    // Generate stats based on slot
    // All gear should have at least a small bonus, even gray tier
    const minBonus = 0.05; // Minimum 5% bonus for gray tier
    const effectiveBonus = bonus > 0 ? bonus : minBonus;
    
    let stats = {};
    if (slot === 'weapon') {
        stats.damage = effectiveBonus;
    } else if (slot === 'armor') {
        stats.defense = effectiveBonus;
    } else if (slot === 'accessory') {
        stats.speed = effectiveBonus * 0.5; // Smaller speed bonus
    }
    
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
        pulse: 0 // For pulsing animation
    };
}

// Render ground loot
function renderGroundLoot(ctx) {
    groundLoot.forEach(gear => {
        // Update pulse animation
        gear.pulse = (gear.pulse || 0) + 0.1;
        const pulseSize = 2 + Math.sin(gear.pulse) * 2;
        
        // Draw gear with glow effect for higher tiers
        ctx.save();
        
        // Outer glow for rare tiers
        if (gear.tier === 'purple' || gear.tier === 'orange') {
            ctx.shadowBlur = 20;
            ctx.shadowColor = gear.color;
        }
        
        // Draw gear
        ctx.fillStyle = gear.color;
        ctx.beginPath();
        ctx.arc(gear.x, gear.y, gear.size + pulseSize, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw tier outline
        ctx.strokeStyle = gear.color;
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.restore();
        
        // Draw tier name above gear
        ctx.fillStyle = '#ffffff';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(gear.tier.toUpperCase(), gear.x, gear.y - gear.size - 15);
        
        // Draw slot name
        ctx.font = '8px Arial';
        ctx.fillText(gear.slot, gear.x, gear.y - gear.size - 5);
    });
}

// Get gear stats as string for tooltip
function getGearStatsString(gear) {
    let statsStr = [];
    
    if (gear.stats.damage) {
        statsStr.push(`Dmg: +${(gear.stats.damage * 100).toFixed(0)}%`);
    }
    if (gear.stats.defense) {
        statsStr.push(`Def: +${(gear.stats.defense * 100).toFixed(0)}%`);
    }
    if (gear.stats.speed) {
        statsStr.push(`Spd: +${(gear.stats.speed * 100).toFixed(0)}%`);
    }
    
    return statsStr.join(', ');
}

