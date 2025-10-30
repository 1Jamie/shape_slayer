// UI rendering - HUD elements, menus

// Damage number class for floating damage text
class DamageNumber {
    constructor(x, y, damage, isCrit = false, isWeakPoint = false) {
        this.x = x;
        this.y = y;
        this.damage = damage;
        this.isCrit = isCrit;
        this.isWeakPoint = isWeakPoint;
        this.life = 1.5; // fade over 1.5s
        this.maxLife = 1.5;
        this.alpha = 1.0;
        this.dy = -30; // float upward
    }
    
    update(deltaTime) {
        this.y += this.dy * deltaTime;
        this.life -= deltaTime;
        this.alpha = this.life / this.maxLife;
        
        // Slow down over time
        this.dy *= 0.95;
        
        return this.life > 0;
    }
    
    render(ctx) {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        
        // Styling based on damage type
        let fontSize, color;
        if (this.isWeakPoint) {
            // Weak point hits: cyan, large
            fontSize = 32;
            color = '#00ffff';
        } else if (this.isCrit) {
            // Crits: orange, medium-large
            fontSize = 28;
            color = '#ffaa00';
        } else {
            // Normal: white, medium
            fontSize = 20;
            color = '#ffffff';
        }
        
        ctx.fillStyle = color;
        ctx.font = `bold ${fontSize}px Arial`;
        ctx.textAlign = 'center';
        
        // Draw text
        const text = Math.floor(this.damage);
        
        // Thick black outline for visibility
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 6;
        ctx.strokeText(text, this.x, this.y);
        
        // Fill text on top
        ctx.fillStyle = color;
        ctx.fillText(text, this.x, this.y);
        
        ctx.restore();
    }
}

// Create damage number
function createDamageNumber(x, y, damage, isCrit = false, isWeakPoint = false) {
    if (typeof Game === 'undefined') return;
    if (!Game.damageNumbers) Game.damageNumbers = [];
    
    Game.damageNumbers.push(new DamageNumber(x, y, damage, isCrit, isWeakPoint));
}

// Update damage numbers
function updateDamageNumbers(deltaTime) {
    if (!Game || !Game.damageNumbers) return;
    
    Game.damageNumbers = Game.damageNumbers.filter(number => number.update(deltaTime));
}

// Render damage numbers
function renderDamageNumbers(ctx) {
    if (!Game || !Game.damageNumbers) return;
    
    Game.damageNumbers.forEach(number => number.render(ctx));
}

// Render health bar
function renderHealthBar(ctx, player) {
    const barX = 30;
    const barY = 30;
    const barWidth = 320;
    const barHeight = 36;
    
    // Panel background
    const panelGradient = ctx.createLinearGradient(barX - 10, barY - 10, barX - 10, barY + barHeight + 10);
    panelGradient.addColorStop(0, 'rgba(20, 20, 30, 0.85)');
    panelGradient.addColorStop(1, 'rgba(10, 10, 20, 0.85)');
    ctx.fillStyle = panelGradient;
    ctx.fillRect(barX - 10, barY - 10, barWidth + 20, barHeight + 20);
    
    // Panel border
    ctx.strokeStyle = 'rgba(100, 150, 255, 0.4)';
    ctx.lineWidth = 2;
    ctx.strokeRect(barX - 10, barY - 10, barWidth + 20, barHeight + 20);
    
    // Background with gradient
    const bgGradient = ctx.createLinearGradient(barX, barY, barX, barY + barHeight);
    bgGradient.addColorStop(0, '#2a1a1a');
    bgGradient.addColorStop(1, '#1a0a0a');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(barX, barY, barWidth, barHeight);
    
    // Draw foreground (green/orange/red) scaled by HP/maxHP with gradient
    const hpPercent = player.hp / player.maxHp;
    const hpGradient = ctx.createLinearGradient(barX, barY, barX, barY + barHeight);
    
    if (hpPercent > 0.5) {
        hpGradient.addColorStop(0, '#66ff66');
        hpGradient.addColorStop(1, '#00cc00');
    } else if (hpPercent > 0.25) {
        hpGradient.addColorStop(0, '#ffaa44');
        hpGradient.addColorStop(1, '#cc6600');
    } else {
        hpGradient.addColorStop(0, '#ff6666');
        hpGradient.addColorStop(1, '#cc0000');
    }
    
    ctx.fillStyle = hpGradient;
    ctx.fillRect(barX + 2, barY + 2, (barWidth - 4) * hpPercent, barHeight - 4);
    
    // Inner highlight
    if (hpPercent > 0) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillRect(barX + 2, barY + 2, (barWidth - 4) * hpPercent, (barHeight - 4) * 0.4);
    }
    
    // Draw border
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(barX, barY, barWidth, barHeight);
    
    // Draw text centered on bar with shadow
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.shadowBlur = 3;
    ctx.shadowColor = '#000000';
    const healthText = `${Math.floor(player.hp)}/${Math.floor(player.maxHp)}`;
    ctx.fillText(healthText, barX + barWidth / 2, barY + 24);
    ctx.shadowBlur = 0;
    ctx.textAlign = 'left'; // Reset alignment
}

// Render XP bar
function renderXPBar(ctx, player) {
    const canvasWidth = Game ? Game.config.width : 1280;
    const canvasHeight = Game ? Game.config.height : 720;
    const barWidth = Math.min(1200, canvasWidth - 80);
    const barX = (canvasWidth - barWidth) / 2; // Center the bar
    const barY = canvasHeight - 55;
    const barHeight = 28;
    
    // Panel background
    const panelGradient = ctx.createLinearGradient(barX - 10, barY - 10, barX - 10, barY + barHeight + 10);
    panelGradient.addColorStop(0, 'rgba(20, 20, 30, 0.85)');
    panelGradient.addColorStop(1, 'rgba(10, 10, 20, 0.85)');
    ctx.fillStyle = panelGradient;
    ctx.fillRect(barX - 10, barY - 10, barWidth + 20, barHeight + 20);
    
    // Panel border
    ctx.strokeStyle = 'rgba(100, 150, 255, 0.4)';
    ctx.lineWidth = 2;
    ctx.strokeRect(barX - 10, barY - 10, barWidth + 20, barHeight + 20);
    
    // Background with gradient
    const bgGradient = ctx.createLinearGradient(barX, barY, barX, barY + barHeight);
    bgGradient.addColorStop(0, '#1a1a2a');
    bgGradient.addColorStop(1, '#0a0a1a');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(barX, barY, barWidth, barHeight);
    
    // Draw foreground (cyan) scaled by XP/xpToNext with gradient
    const xpPercent = player.xp / player.xpToNext;
    const xpGradient = ctx.createLinearGradient(barX, barY, barX, barY + barHeight);
    xpGradient.addColorStop(0, '#66ffff');
    xpGradient.addColorStop(1, '#00cccc');
    ctx.fillStyle = xpGradient;
    ctx.fillRect(barX + 2, barY + 2, (barWidth - 4) * xpPercent, barHeight - 4);
    
    // Inner highlight
    if (xpPercent > 0) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillRect(barX + 2, barY + 2, (barWidth - 4) * xpPercent, (barHeight - 4) * 0.4);
    }
    
    // Draw border
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(barX, barY, barWidth, barHeight);
    
    // Draw text with shadow
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px Arial';
    ctx.shadowBlur = 3;
    ctx.shadowColor = '#000000';
    const text = `Level ${player.level} - ${Math.floor(player.xp)}/${player.xpToNext} XP`;
    const textWidth = ctx.measureText(text).width;
    ctx.fillText(text, barX + (barWidth - textWidth) / 2, barY + 20);
    ctx.shadowBlur = 0;
}

// Render death screen
function renderDeathScreen(ctx, player) {
    // Record end time
    if (Game.endTime === 0) {
        Game.endTime = Date.now();
    }
    
    // Calculate time played
    const timePlayed = ((Game.endTime - Game.startTime) / 1000).toFixed(1);
    const minutes = Math.floor(timePlayed / 60);
    const seconds = (timePlayed % 60).toFixed(1);
    
    // Calculate currency breakdown
    const roomsCleared = Math.max(0, Game.roomNumber - 1);
    const enemiesKilled = Game.enemiesKilled || 0;
    const levelReached = player.level || 1;
    
    const baseCurrency = 10 * roomsCleared;
    const bonusCurrency = 2 * enemiesKilled;
    const levelCurrency = 1 * levelReached;
    const totalEarned = baseCurrency + bonusCurrency + levelCurrency;
    
    // Dark overlay
    const canvasWidth = Game ? Game.config.width : 1280;
    const canvasHeight = Game ? Game.config.height : 720;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;
    
    // Title
    ctx.fillStyle = '#ff0000';
    ctx.font = 'bold 60px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', centerX, centerY - 280);
    
    // Stats
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px Arial';
    
    const stats = [
        `Level Reached: ${levelReached}`,
        `Rooms Cleared: ${roomsCleared}`,
        `Enemies Killed: ${enemiesKilled}`,
        `Time Played: ${minutes}:${seconds}`
    ];
    
    stats.forEach((stat, index) => {
        ctx.fillText(stat, centerX, centerY - 200 + (index * 35));
    });
    
    // Currency breakdown
    ctx.font = 'bold 20px Arial';
    ctx.fillStyle = '#ffff00';
    ctx.fillText('Currency Earned:', centerX, centerY - 30);
    
    ctx.font = '18px Arial';
    ctx.fillStyle = '#cccccc';
    ctx.textAlign = 'left';
    
    const currencyBreakdown = [
        `Rooms: 10 × ${roomsCleared} = ${baseCurrency}`,
        `Enemies: 2 × ${enemiesKilled} = ${bonusCurrency}`,
        `Level: 1 × ${levelReached} = ${levelCurrency}`
    ];
    
    currencyBreakdown.forEach((line, index) => {
        ctx.fillText(line, centerX - 200, centerY + (index * 25));
    });
    
    ctx.textAlign = 'center';
    ctx.fillStyle = '#00ff00';
    ctx.font = 'bold 22px Arial';
    ctx.fillText(`Total Earned: ${totalEarned}`, centerX, centerY + 90);
    
    // Current total currency
    const currentTotal = typeof SaveSystem !== 'undefined' ? SaveSystem.getCurrency() : 0;
    ctx.fillStyle = '#ffff00';
    ctx.font = 'bold 20px Arial';
    ctx.fillText(`Total Currency: ${currentTotal}`, centerX, centerY + 130);
    
    // Instructions
    ctx.font = 'bold 24px Arial';
    ctx.fillStyle = '#ffff00';
    ctx.fillText('Press R to Restart', centerX, centerY + 200);
    ctx.fillStyle = '#00ffff';
    ctx.font = 'bold 20px Arial';
    ctx.fillText('Press M or Click to Continue to Nexus', centerX, centerY + 240);
}

// Render gear tooltip when near gear
function renderGearTooltips(ctx, player) {
    if (!player || !player.alive || typeof groundLoot === 'undefined') return;
    
    groundLoot.forEach(gear => {
        const dx = gear.x - player.x;
        const dy = gear.y - player.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Show tooltip within range
        if (distance < 50) {
            const tooltipX = gear.x;
            const tooltipY = gear.y - gear.size - 30;
            
            // Get current equipped gear in same slot
            const currentGear = player.getEquippedGear(gear.slot);
            const currentStats = getGearStatString(currentGear, gear.slot);
            const newStats = getGearStatString(gear, gear.slot);
            
            // Draw tooltip background
            ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            ctx.fillRect(tooltipX - 80, tooltipY - 40, 160, 80);
            
            // Draw border
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.strokeRect(tooltipX - 80, tooltipY - 40, 160, 80);
            
            // Draw text
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(gear.tier.toUpperCase() + ' ' + gear.slot.toUpperCase(), tooltipX, tooltipY - 20);
            
            ctx.font = '10px Arial';
            ctx.fillText(currentStats, tooltipX, tooltipY);
            ctx.fillStyle = '#00ff00';
            ctx.fillText('NEW: ' + newStats, tooltipX, tooltipY + 15);
            
            // Draw pickup prompt
            ctx.fillStyle = '#ffff00';
            ctx.font = 'bold 11px Arial';
            ctx.fillText('Press G to pickup', tooltipX, tooltipY + 30);
            
            // Draw range indicator
            ctx.strokeStyle = 'rgba(255, 255, 0, 0.5)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(gear.x, gear.y, 50, 0, Math.PI * 2);
            ctx.stroke();
        }
    });
}

// Get gear stat as string for tooltip
function getGearStatString(gear, slot) {
    if (!gear) return 'None';
    
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
    
    return statsStr.length > 0 ? statsStr.join(' ') : 'No bonus';
}

// Render room number
function renderRoomNumber(ctx) {
    if (typeof Game === 'undefined' || !Game.roomNumber) return;
    
    const centerX = Game ? Game.config.width / 2 : 640;
    const panelWidth = 280;
    const panelHeight = 70;
    const panelX = centerX - panelWidth / 2;
    const panelY = 15;
    
    // Modern panel background with gradient
    const panelGradient = ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelHeight);
    panelGradient.addColorStop(0, 'rgba(30, 30, 50, 0.9)');
    panelGradient.addColorStop(1, 'rgba(20, 20, 40, 0.9)');
    ctx.fillStyle = panelGradient;
    ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
    
    // Panel border with glow
    ctx.strokeStyle = '#6666ff';
    ctx.lineWidth = 2;
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#6666ff';
    ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);
    ctx.shadowBlur = 0;
    
    // Inner border
    ctx.strokeStyle = 'rgba(150, 150, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX + 1, panelY + 1, panelWidth - 2, panelHeight - 2);
    
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 38px Arial';
    ctx.textAlign = 'center';
    ctx.shadowBlur = 2;
    ctx.shadowColor = '#000000';
    ctx.fillText(`Room ${Game.roomNumber}`, centerX, panelY + 42);
    ctx.shadowBlur = 0;
    
    // Draw enemy count if room not cleared
    if (typeof currentRoom !== 'undefined' && currentRoom && !currentRoom.cleared) {
        const enemyCount = currentRoom.enemies.filter(e => e.alive).length;
        ctx.font = 'bold 18px Arial';
        ctx.fillStyle = '#ffaaaa';
        ctx.shadowBlur = 2;
        ctx.shadowColor = '#000000';
        ctx.fillText(`Enemies: ${enemyCount}`, centerX, panelY + 65);
        ctx.shadowBlur = 0;
    }
}

// Render class selection menu
function renderClassSelection(ctx) {
    const classes = [
        { key: 'square', name: 'Warrior', color: '#4a90e2', x: 150, y: 200 },
        { key: 'triangle', name: 'Rogue', color: '#e24ace', x: 150, y: 280 },
        { key: 'pentagon', name: 'Tank', color: '#c72525', x: 150, y: 360 },
        { key: 'hexagon', name: 'Mage', color: '#9c27b0', x: 150, y: 440 }
    ];
    
    const boxWidth = 250; // Wider boxes to fit text
    
    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('SHAPE SLAYER', 400, 80);
    
    ctx.font = 'bold 24px Arial';
    ctx.fillText('Select Your Class', 400, 120);
    
    // Draw each class option
    classes.forEach(cls => {
        const isSelected = Game.selectedClass === cls.key;
        const isHovered = Input.mouse.x >= cls.x - 10 && Input.mouse.x <= cls.x + boxWidth && 
                         Input.mouse.y >= cls.y - 20 && Input.mouse.y <= cls.y + 70;
        
        // Background
        ctx.fillStyle = isHovered ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.05)';
        if (isSelected) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        }
        ctx.fillRect(cls.x - 10, cls.y - 20, boxWidth, 75);
        
        // Border
        ctx.strokeStyle = isSelected ? '#ffff00' : cls.color;
        ctx.lineWidth = isSelected ? 3 : 2;
        ctx.strokeRect(cls.x - 10, cls.y - 20, boxWidth, 75);
        
        // Draw class shape
        ctx.fillStyle = cls.color;
        ctx.beginPath();
        if (cls.key === 'square') {
            ctx.fillRect(cls.x, cls.y, 40, 40);
        } else if (cls.key === 'triangle') {
            ctx.moveTo(cls.x + 20, cls.y);
            ctx.lineTo(cls.x, cls.y + 40);
            ctx.lineTo(cls.x + 40, cls.y + 40);
            ctx.closePath();
            ctx.fill();
        } else if (cls.key === 'pentagon') {
            for (let i = 0; i < 5; i++) {
                const angle = (Math.PI * 2 / 5) * i - Math.PI / 2;
                const px = cls.x + 20 + Math.cos(angle) * 20;
                const py = cls.y + 20 + Math.sin(angle) * 20;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
        } else if (cls.key === 'hexagon') {
            for (let i = 0; i < 6; i++) {
                const angle = (Math.PI / 3) * i;
                const px = cls.x + 20 + Math.cos(angle) * 20;
                const py = cls.y + 20 + Math.sin(angle) * 20;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
        }
        
        // Class name
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(cls.name, cls.x + 55, cls.y + 28);
        
        // Class stats (shortened to fit)
        const def = CLASS_DEFINITIONS[cls.key];
        ctx.font = '12px Arial';
        ctx.fillStyle = '#aaaaaa';
        const statsText = `${def.hp}HP  ${def.damage}DMG  ${def.speed}SPD`;
        ctx.fillText(statsText, cls.x + 55, cls.y + 48);
    });
    
    // Instructions
    ctx.fillStyle = '#ffffff';
    ctx.font = '18px Arial';
    ctx.textAlign = 'center';
    if (Game.selectedClass) {
        ctx.fillStyle = '#ffff00';
        ctx.fillText('Click to confirm and start!', 400, 525);
    } else {
        ctx.fillStyle = '#ffffff';
        ctx.fillText('Click a class to select, then click again to start', 400, 525);
    }
    
    // Controls panel on the right side
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fillRect(500, 150, 280, 350);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(500, 150, 280, 350);
    
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('CONTROLS', 520, 180);
    
    ctx.font = '14px Arial';
    ctx.fillStyle = '#cccccc';
    const controls = [
        'WASD - Move',
        'Mouse - Aim',
        'Left Click - Basic Attack',
        'Right Click - Heavy Attack',
        'Shift - Dodge Roll',
        'Space - Special Ability',
        '',
        'Esc - Pause',
        'R - Restart',
        'M - Main Menu'
    ];
    
    controls.forEach((control, i) => {
        ctx.fillText(control, 520, 210 + i * 28);
    });
    
    // Check for clicks
    if (Input.mouseLeft && !Game.clickHandled) {
        classes.forEach(cls => {
            if (Input.mouse.x >= cls.x - 10 && Input.mouse.x <= cls.x + boxWidth &&
                Input.mouse.y >= cls.y - 20 && Input.mouse.y <= cls.y + 70) {
                
                if (Game.selectedClass === cls.key) {
                    // Double click to start
                    Game.startGame();
                } else {
                    // First click to select
                    Game.selectedClass = cls.key;
                }
                Game.clickHandled = true;
            }
        });
    } else if (!Input.mouseLeft) {
        Game.clickHandled = false;
    }
}

// Render cooldown indicators
function renderCooldownIndicators(ctx, player) {
    if (!player || player.dead) return;
    
    const canvasHeight = Game ? Game.config.height : 720;
    const barY = canvasHeight - 90; // Position near bottom, above XP bar
    const barWidth = 140;
    const barHeight = 14;
    const spacing = 160;
    const startX = 30; // Left side of screen
    
    // Helper function to render a cooldown bar
    const renderCooldownBar = (x, y, width, height, cooldown, maxCooldown, label) => {
        // Background with gradient
        const bgGradient = ctx.createLinearGradient(x, y, x, y + height);
        bgGradient.addColorStop(0, '#2a2a2a');
        bgGradient.addColorStop(1, '#1a1a1a');
        ctx.fillStyle = bgGradient;
        ctx.fillRect(x, y, width, height);
        
        // Cooldown fill with gradient
        if (cooldown > 0) {
            const cooldownPercent = cooldown / maxCooldown;
            const fillGradient = ctx.createLinearGradient(x, y, x, y + height);
            fillGradient.addColorStop(0, '#ff4444');
            fillGradient.addColorStop(1, '#cc0000');
            ctx.fillStyle = fillGradient;
            ctx.fillRect(x, y, width * cooldownPercent, height);
        } else {
            const readyGradient = ctx.createLinearGradient(x, y, x, y + height);
            readyGradient.addColorStop(0, '#44ff44');
            readyGradient.addColorStop(1, '#00cc00');
            ctx.fillStyle = readyGradient;
            ctx.fillRect(x, y, width, height);
        }
        
        // Inner highlight
        if (cooldown <= 0) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.fillRect(x, y, width, height * 0.4);
        }
        
        // Label with shadow
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.shadowBlur = 2;
        ctx.shadowColor = '#000000';
        ctx.fillText(label, x + width / 2, y - 6);
        ctx.shadowBlur = 0;
    };
    
    // Dodge cooldown indicator
    if (player.playerClass === 'triangle') {
        // Show all charges for Triangle
        const charges = player.dodgeChargeCooldowns.length;
        for (let i = 0; i < charges; i++) {
            const barX = startX + i * 45;
            const cooldown = player.dodgeChargeCooldowns[i];
            const maxCooldown = player.dodgeCooldownTime;
            renderCooldownBar(barX, barY, 40, barHeight, cooldown, maxCooldown, 'D');
        }
    } else {
        // Single dodge cooldown for other classes
        const cooldown = player.dodgeCooldown;
        const maxCooldown = player.dodgeCooldownTime;
        renderCooldownBar(startX, barY, barWidth, barHeight, cooldown, maxCooldown, 'Dodge');
    }
    
    // Special ability cooldown indicator
    const specialBarX = player.playerClass === 'triangle' ? startX + 150 : startX + spacing;
    const specialCooldown = player.specialCooldown;
    const specialMaxCooldown = player.specialCooldownTime;
    const abilityName = player.playerClass === 'triangle' ? 'Clones' :
                       player.playerClass === 'square' ? 'Whirlwind' : 
                       player.playerClass === 'pentagon' ? 'Shield' : 'Blink';
    renderCooldownBar(specialBarX, barY, barWidth, barHeight, specialCooldown, specialMaxCooldown, abilityName);
    
    // Heavy attack cooldown indicator
    const heavyBarX = player.playerClass === 'triangle' ? startX + spacing * 2.5 : startX + spacing * 2;
    const heavyCooldown = player.heavyAttackCooldown || 0;
    const heavyMaxCooldown = player.heavyAttackCooldownTime || 1.5;
    renderCooldownBar(heavyBarX, barY, barWidth, barHeight, heavyCooldown, heavyMaxCooldown, 'Heavy');
}

// Render pause menu
function renderPauseMenu(ctx) {
    const canvasWidth = Game ? Game.config.width : 1280;
    const canvasHeight = Game ? Game.config.height : 720;
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;
    
    // Dark overlay with gradient effect
    const gradient = ctx.createLinearGradient(0, 0, 0, canvasHeight);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.95)');
    gradient.addColorStop(1, 'rgba(20, 10, 40, 0.95)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    // Main menu panel with modern styling
    const panelWidth = 900;
    const panelHeight = 580;
    const panelX = (canvasWidth - panelWidth) / 2;
    const panelY = (canvasHeight - panelHeight) / 2;
    
    // Panel background with gradient and glow
    const panelGradient = ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelHeight);
    panelGradient.addColorStop(0, 'rgba(30, 30, 50, 0.95)');
    panelGradient.addColorStop(0.5, 'rgba(20, 20, 40, 0.95)');
    panelGradient.addColorStop(1, 'rgba(15, 15, 35, 0.95)');
    ctx.fillStyle = panelGradient;
    ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
    
    // Panel border with glow
    ctx.strokeStyle = '#6666ff';
    ctx.lineWidth = 4;
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#6666ff';
    ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);
    ctx.shadowBlur = 0;
    
    // Inner border
    ctx.strokeStyle = 'rgba(150, 150, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(panelX + 2, panelY + 2, panelWidth - 4, panelHeight - 4);
    
    // Title with glow effect
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 80px Arial';
    ctx.textAlign = 'center';
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#6666ff';
    ctx.fillText('PAUSED', centerX, panelY + 80);
    ctx.shadowBlur = 0;
    
    // Options with hover-like styling
    ctx.font = 'bold 28px Arial';
    const options = [
        { text: 'Press ESC to Resume', y: panelY + 160 },
        { text: 'Press R to Restart', y: panelY + 210 },
        { text: 'Press M for Nexus', y: panelY + 260 }
    ];
    
    options.forEach(option => {
        ctx.fillStyle = '#e0e0e0';
        ctx.fillText(option.text, centerX, option.y);
    });
    
    // Controls info box with modern styling
    const boxWidth = 820;
    const boxHeight = 280;
    const boxX = (canvasWidth - boxWidth) / 2;
    const boxY = panelY + 300;
    
    // Box background with subtle gradient
    const boxGradient = ctx.createLinearGradient(boxX, boxY, boxX, boxY + boxHeight);
    boxGradient.addColorStop(0, 'rgba(40, 40, 60, 0.8)');
    boxGradient.addColorStop(1, 'rgba(30, 30, 50, 0.8)');
    ctx.fillStyle = boxGradient;
    ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
    
    // Box border
    ctx.strokeStyle = '#8888ff';
    ctx.lineWidth = 2;
    ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);
    
    // Controls title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('CONTROLS', centerX, boxY + 35);
    
    // Controls list with better spacing
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#cccccc';
    
    const controls = [
        { x: boxX + 50, y: boxY + 75, text: 'WASD - Move' },
        { x: boxX + 50, y: boxY + 110, text: 'Mouse - Aim' },
        { x: boxX + 50, y: boxY + 145, text: 'Left Click - Basic Attack' },
        { x: boxX + 50, y: boxY + 180, text: 'Right Click - Heavy Attack' },
        { x: boxX + 50, y: boxY + 215, text: 'Shift - Dodge Roll' },
        { x: boxX + 50, y: boxY + 250, text: 'Space - Special Ability' },
        { x: boxX + 430, y: boxY + 75, text: 'G - Pickup Gear' },
        { x: boxX + 430, y: boxY + 110, text: 'Esc - Pause' },
        { x: boxX + 430, y: boxY + 145, text: 'R - Restart' },
        { x: boxX + 430, y: boxY + 180, text: 'M - Nexus' }
    ];
    
    controls.forEach(control => {
        ctx.fillText(control.text, control.x, control.y);
    });
    
    ctx.textAlign = 'center';
    
    // Handle input
    if (Input && Input.getKeyState('r')) {
        Game.restart();
    }
    if (Input && Input.getKeyState('m')) {
        Game.returnToNexus();
    }
}

// Render level up message
function renderLevelUpMessage(ctx) {
    if (typeof Game === 'undefined' || !Game.levelUpMessageActive) return;
    
    // Calculate fade based on time remaining
    const progress = Game.levelUpMessageTime / 2.0;
    const alpha = Math.min(1.0, progress * 2.0); // Fade in quickly, hold, fade out
    
    ctx.save();
    ctx.globalAlpha = alpha;
    
    // Draw centered "LEVEL UP!" message
    const centerX = Game ? Game.config.width / 2 : 640;
    const centerY = Game ? Game.config.height / 2 : 360;
    ctx.font = 'bold 96px Arial';
    ctx.textAlign = 'center';
    
    // Draw outline first (thinner for better readability)
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 5;
    ctx.strokeText('LEVEL UP!', centerX, centerY - 250);
    
    // Draw filled text on top
    ctx.fillStyle = '#00ffff';
    ctx.fillText('LEVEL UP!', centerX, centerY - 250);
    
    // Add glow effect
    ctx.shadowBlur = 40;
    ctx.shadowColor = '#00ffff';
    ctx.fillText('LEVEL UP!', centerX, centerY - 250);
    ctx.shadowBlur = 0;
    
    ctx.restore();
}

// Main UI render function
function renderUI(ctx, player) {
    if (!player) return;
    
    // Render level up message (on top of everything)
    if (!player.dead) {
        renderLevelUpMessage(ctx);
    }
    
    // Render room number at top
    renderRoomNumber(ctx);
    
    // Render health and XP bars
    if (!player.dead) {
        renderHealthBar(ctx, player);
        renderXPBar(ctx, player);
        renderCooldownIndicators(ctx, player);
        
        // Render gear tooltips
        if (typeof renderGearTooltips === 'function') {
            renderGearTooltips(ctx, player);
        }
    } else {
        // Render death screen
        renderDeathScreen(ctx, player);
    }
}

