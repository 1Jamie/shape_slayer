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
    
    const baseCurrency = 9 * roomsCleared; // Reduced from 10
    const bonusCurrency = 1.8 * enemiesKilled; // Reduced from 2
    const levelCurrency = 0.9 * levelReached; // Reduced from 1
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
        `Rooms: 9 × ${roomsCleared} = ${baseCurrency}`,
        `Enemies: 1.8 × ${enemiesKilled} = ${bonusCurrency}`,
        `Level: 0.9 × ${levelReached} = ${levelCurrency}`
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
            const tooltipY = gear.y - gear.size - 50;
            
            // Get current equipped gear in same slot
            const currentGear = player.getEquippedGear(gear.slot);
            const currentStats = getGearStatString(currentGear, gear.slot);
            const newStats = getGearStatString(gear, gear.slot);
            
            // Draw tooltip background (larger to accommodate bigger text)
            const tooltipWidth = 200;
            const tooltipHeight = 110;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            ctx.fillRect(tooltipX - tooltipWidth / 2, tooltipY - tooltipHeight / 2, tooltipWidth, tooltipHeight);
            
            // Draw border
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.strokeRect(tooltipX - tooltipWidth / 2, tooltipY - tooltipHeight / 2, tooltipWidth, tooltipHeight);
            
            // Draw text (larger fonts)
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 18px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(gear.tier.toUpperCase() + ' ' + gear.slot.toUpperCase(), tooltipX, tooltipY - 35);
            
            ctx.font = '14px Arial';
            ctx.fillText(currentStats, tooltipX, tooltipY - 10);
            ctx.fillStyle = '#00ff00';
            ctx.fillText('NEW: ' + newStats, tooltipX, tooltipY + 10);
            
            // Draw pickup prompt (only show in desktop mode)
            if (typeof Input !== 'undefined' && (!Input.isTouchMode || !Input.isTouchMode())) {
                ctx.fillStyle = '#ffff00';
                ctx.font = 'bold 14px Arial';
                ctx.fillText('Press G to pickup', tooltipX, tooltipY + 35);
            }
            
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
        { key: 'triangle', name: 'Rogue', color: '#ff1493', x: 150, y: 280 },
        { key: 'pentagon', name: 'Tank', color: '#c72525', x: 150, y: 360 },
        { key: 'hexagon', name: 'Mage', color: '#673ab7', x: 150, y: 440 }
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

// Pause menu button state tracking
let pauseMenuButtons = {
    resume: { x: 0, y: 0, width: 0, height: 0, pressed: false },
    restart: { x: 0, y: 0, width: 0, height: 0, pressed: false },
    nexus: { x: 0, y: 0, width: 0, height: 0, pressed: false },
    fullscreen: { x: 0, y: 0, width: 0, height: 0, pressed: false },
    controlMode: { x: 0, y: 0, width: 0, height: 0, pressed: false },
    howToPlay: { x: 0, y: 0, width: 0, height: 0, pressed: false }
};

// Update button (circular, side of menu)
let updateButton = { x: 0, y: 0, radius: 0, pressed: false };

// Modal close button state
let modalCloseButton = { x: 0, y: 0, width: 0, height: 0, pressed: false };

// Pause button overlay state
let pauseButtonOverlay = {
    x: 0,
    y: 0,
    size: 60,
    pressed: false
};

// Render pause button overlay (top-right corner)
function renderPauseButton(ctx) {
    if (!Game || (Game.state !== 'PLAYING' && Game.state !== 'NEXUS')) return;
    
    const canvasWidth = Game ? Game.config.width : 1280;
    const size = pauseButtonOverlay.size;
    const padding = 10;
    pauseButtonOverlay.x = canvasWidth - size - padding;
    pauseButtonOverlay.y = padding;
    
    // Background circle
    const isPressed = pauseButtonOverlay.pressed;
    ctx.fillStyle = isPressed ? 'rgba(100, 100, 150, 0.9)' : 'rgba(60, 60, 90, 0.8)';
    ctx.beginPath();
    ctx.arc(pauseButtonOverlay.x + size / 2, pauseButtonOverlay.y + size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();
    
    // Border
    ctx.strokeStyle = isPressed ? 'rgba(255, 255, 255, 1.0)' : 'rgba(200, 200, 255, 0.8)';
    ctx.lineWidth = 3;
    ctx.stroke();
    
    // Pause icon (two vertical bars)
    ctx.fillStyle = '#ffffff';
    const barWidth = 8;
    const barHeight = 24;
    const barSpacing = 6;
    const iconX = pauseButtonOverlay.x + size / 2 - (barWidth * 2 + barSpacing) / 2;
    const iconY = pauseButtonOverlay.y + size / 2 - barHeight / 2;
    
    ctx.fillRect(iconX, iconY, barWidth, barHeight);
    ctx.fillRect(iconX + barWidth + barSpacing, iconY, barWidth, barHeight);
}

// Handle pause button click/touch
function handlePauseButtonClick(x, y) {
    // Use the same position calculation as renderPauseButton for consistency
    const canvasWidth = Game ? Game.config.width : 1280;
    const size = pauseButtonOverlay.size;
    const padding = 10;
    const buttonX = canvasWidth - size - padding;
    const buttonY = padding;
    
    // Use the actual stored position if available (from render), otherwise calculate
    const actualButtonX = pauseButtonOverlay.x > 0 ? pauseButtonOverlay.x : buttonX;
    const actualButtonY = pauseButtonOverlay.y > 0 ? pauseButtonOverlay.y : buttonY;
    
    // Calculate center of button (circle)
    const centerX = actualButtonX + size / 2;
    const centerY = actualButtonY + size / 2;
    const radius = size / 2;
    
    // Calculate distance from touch point to button center
    const dx = x - centerX;
    const dy = y - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    console.log(`Pause button check: touch(${x.toFixed(0)}, ${y.toFixed(0)}) vs button center(${centerX.toFixed(0)}, ${centerY.toFixed(0)}) radius(${radius.toFixed(0)})`);
    console.log(`  Distance: ${distance.toFixed(1)}, within radius? ${distance <= radius}`);
    
    // Check if click is within button circle (button is rendered as a circle)
    if (distance <= radius) {
        console.log('Pause button hit detected!');
        if (Game && Game.togglePause) {
            Game.togglePause();
            return true;
        }
    }
    return false;
}

// Render pause menu with touch-friendly buttons
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
    const panelWidth = 700;
    const panelHeight = 680; // Increased height to accommodate new buttons
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
    ctx.font = 'bold 72px Arial';
    ctx.textAlign = 'center';
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#6666ff';
    ctx.fillText('PAUSED', centerX, panelY + 70);
    ctx.shadowBlur = 0;
    
    // Button configuration
    const buttonWidth = 280;
    const buttonHeight = 70;
    const buttonSpacing = 20;
    const startY = panelY + 140;
    const fsButtonWidth = 200;
    // Check if paused from nexus (not just current state, since state is 'PAUSED' when paused)
    const pausedFromNexus = Game && Game.pausedFromState === 'NEXUS';
    
    // Resume button (prominent, center)
    pauseMenuButtons.resume.x = centerX - buttonWidth / 2;
    pauseMenuButtons.resume.y = startY;
    pauseMenuButtons.resume.width = buttonWidth;
    pauseMenuButtons.resume.height = buttonHeight;
    renderPauseMenuButton(ctx, pauseMenuButtons.resume, 'Resume', true);
    
    // Only show restart and nexus buttons when NOT paused from nexus
    if (!pausedFromNexus) {
        // Restart button
        pauseMenuButtons.restart.x = centerX - buttonWidth / 2;
        pauseMenuButtons.restart.y = startY + buttonHeight + buttonSpacing;
        pauseMenuButtons.restart.width = buttonWidth;
        pauseMenuButtons.restart.height = buttonHeight;
        renderPauseMenuButton(ctx, pauseMenuButtons.restart, 'Restart', false);
        
        // Return to Nexus button
        pauseMenuButtons.nexus.x = centerX - buttonWidth / 2;
        pauseMenuButtons.nexus.y = startY + (buttonHeight + buttonSpacing) * 2;
        pauseMenuButtons.nexus.width = buttonWidth;
        pauseMenuButtons.nexus.height = buttonHeight;
        renderPauseMenuButton(ctx, pauseMenuButtons.nexus, 'Return to Nexus', false);
    }
    
    // Fullscreen toggle button (smaller, bottom)
    const fullscreenY = pausedFromNexus ? startY + buttonHeight + buttonSpacing : startY + (buttonHeight + buttonSpacing) * 3 + 10;
    pauseMenuButtons.fullscreen.x = centerX - fsButtonWidth / 2;
    pauseMenuButtons.fullscreen.y = fullscreenY;
    pauseMenuButtons.fullscreen.width = fsButtonWidth;
    pauseMenuButtons.fullscreen.height = 50;
    const isFullscreen = Game && Game.fullscreenEnabled;
    renderPauseMenuButton(ctx, pauseMenuButtons.fullscreen, isFullscreen ? 'Exit Fullscreen' : 'Fullscreen', false);
    
    // Control mode selector button
    const controlMode = Input && Input.controlMode ? Input.controlMode : 'auto';
    let controlModeText = 'Control: Auto';
    if (controlMode === 'mobile') {
        controlModeText = 'Control: Mobile';
    } else if (controlMode === 'desktop') {
        controlModeText = 'Control: Desktop';
    }
    pauseMenuButtons.controlMode.x = centerX - fsButtonWidth / 2;
    pauseMenuButtons.controlMode.y = fullscreenY + 50 + buttonSpacing;
    pauseMenuButtons.controlMode.width = fsButtonWidth;
    pauseMenuButtons.controlMode.height = 50;
    renderPauseMenuButton(ctx, pauseMenuButtons.controlMode, controlModeText, false);
    
    // How to Play button
    pauseMenuButtons.howToPlay.x = centerX - fsButtonWidth / 2;
    pauseMenuButtons.howToPlay.y = fullscreenY + 50 + buttonSpacing * 2 + 50;
    pauseMenuButtons.howToPlay.width = fsButtonWidth;
    pauseMenuButtons.howToPlay.height = 50;
    renderPauseMenuButton(ctx, pauseMenuButtons.howToPlay, 'How to Play', false);
    
    // Update button (circular, on the right side of menu) - always show
    const updateButtonRadius = 35;
    const updateButtonX = panelX + panelWidth - 60;
    const updateButtonY = panelY + 120; // Position near top of menu
    
    updateButton.x = updateButtonX;
    updateButton.y = updateButtonY;
    updateButton.radius = updateButtonRadius;
    
    // Check if there's a new update (for visual indication)
    const hasNewUpdate = typeof SaveSystem !== 'undefined' && SaveSystem.shouldShowUpdateModal();
    
    const isPressed = updateButton.pressed;
    
    // Button background circle - brighter if new update available
    const bgGradient = ctx.createRadialGradient(updateButtonX, updateButtonY, 0, updateButtonX, updateButtonY, updateButtonRadius);
    if (hasNewUpdate) {
        // Pulsing/glowing effect for new updates
        const pulse = Math.sin(Date.now() / 300) * 0.2 + 0.8;
        bgGradient.addColorStop(0, isPressed ? `rgba(150, 200, 255, ${0.9 * pulse})` : `rgba(100, 200, 255, ${0.8 * pulse})`);
        bgGradient.addColorStop(1, isPressed ? `rgba(80, 150, 255, ${0.9 * pulse})` : `rgba(60, 150, 255, ${0.8 * pulse})`);
    } else {
        bgGradient.addColorStop(0, isPressed ? 'rgba(150, 200, 255, 0.9)' : 'rgba(100, 150, 255, 0.8)');
        bgGradient.addColorStop(1, isPressed ? 'rgba(80, 130, 220, 0.9)' : 'rgba(60, 100, 200, 0.8)');
    }
    ctx.fillStyle = bgGradient;
    ctx.beginPath();
    ctx.arc(updateButtonX, updateButtonY, updateButtonRadius, 0, Math.PI * 2);
    ctx.fill();
    
    // Button border - stronger glow if new update
    if (hasNewUpdate) {
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#66ccff';
    }
    ctx.strokeStyle = isPressed ? 'rgba(255, 255, 255, 1.0)' : (hasNewUpdate ? 'rgba(150, 220, 255, 1.0)' : 'rgba(150, 200, 255, 0.9)');
    ctx.lineWidth = isPressed ? 4 : 3;
    ctx.stroke();
    ctx.shadowBlur = 0;
    
    // Icon - exclamation mark or "!" to indicate update
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', updateButtonX, updateButtonY);
    
    // Optional: glow effect for icon (stronger if new update)
    if (hasNewUpdate) {
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#66ccff';
    } else {
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#66ccff';
    }
    ctx.fillText('!', updateButtonX, updateButtonY);
    ctx.shadowBlur = 0;
    
    // Label below button
    ctx.font = 'bold 14px Arial';
    ctx.fillText('Updates', updateButtonX, updateButtonY + updateButtonRadius + 20);
    
    // Handle button clicks/touches
    handlePauseMenuInput();
}

// Render a pause menu button
function renderPauseMenuButton(ctx, button, text, isPrimary) {
    const isPressed = button.pressed;
    
    // Button background
    const bgGradient = ctx.createLinearGradient(button.x, button.y, button.x, button.y + button.height);
    if (isPrimary) {
        bgGradient.addColorStop(0, isPressed ? 'rgba(100, 150, 255, 0.9)' : 'rgba(80, 120, 220, 0.8)');
        bgGradient.addColorStop(1, isPressed ? 'rgba(70, 110, 200, 0.9)' : 'rgba(60, 100, 180, 0.8)');
    } else {
        bgGradient.addColorStop(0, isPressed ? 'rgba(80, 80, 120, 0.9)' : 'rgba(60, 60, 100, 0.8)');
        bgGradient.addColorStop(1, isPressed ? 'rgba(50, 50, 90, 0.9)' : 'rgba(40, 40, 80, 0.8)');
    }
    ctx.fillStyle = bgGradient;
    ctx.fillRect(button.x, button.y, button.width, button.height);
    
    // Button border
    ctx.strokeStyle = isPressed ? 'rgba(255, 255, 255, 1.0)' : (isPrimary ? 'rgba(150, 200, 255, 0.9)' : 'rgba(150, 150, 200, 0.7)');
    ctx.lineWidth = isPressed ? 4 : 3;
    ctx.strokeRect(button.x, button.y, button.width, button.height);
    
    // Button text
    ctx.fillStyle = '#ffffff';
    ctx.font = isPrimary ? 'bold 32px Arial' : 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, button.x + button.width / 2, button.y + button.height / 2);
}

// Handle pause menu input (mouse and touch)
function handlePauseMenuInput() {
    if (!Input || !Game) return;
    
    let clickX = null, clickY = null;
    let isClick = false;
    
    // Check for mouse click
    if (Input.mouse && typeof Input.mouseLeft !== 'undefined') {
        // Check if mouse was just clicked (would need to track previous state)
        // For now, we'll handle this via click events on canvas
    }
    
    // Check for touch taps
    if (Input.isTouchMode && Input.isTouchMode() && Input.activeTouches) {
        // Track touches that just started (would need frame tracking)
        // This will be handled via touch events
    }
    
    // Handle keyboard shortcuts (still work)
    if (Input.getKeyState('r') && !Game.lastRKeyState) {
        Game.lastRKeyState = true;
        if (Game.restart) Game.restart();
    } else if (!Input.getKeyState('r')) {
        Game.lastRKeyState = false;
    }
    
    if (Input.getKeyState('m') && !Game.lastMKeyState) {
        Game.lastMKeyState = true;
        if (Game.returnToNexus) Game.returnToNexus();
    } else if (!Input.getKeyState('m')) {
        Game.lastMKeyState = false;
    }
}

// Check if click/touch is on a pause menu button
function checkPauseMenuButtonClick(x, y) {
    // Convert screen coordinates to game coordinates
    if (Game && Game.screenToGame) {
        const gameCoords = Game.screenToGame(x, y);
        x = gameCoords.x;
        y = gameCoords.y;
    }
    
    // Check resume button
    if (x >= pauseMenuButtons.resume.x && x <= pauseMenuButtons.resume.x + pauseMenuButtons.resume.width &&
        y >= pauseMenuButtons.resume.y && y <= pauseMenuButtons.resume.y + pauseMenuButtons.resume.height) {
        if (Game && Game.togglePause) {
            Game.togglePause();
            return true;
        }
    }
    
    // Check restart button
    if (x >= pauseMenuButtons.restart.x && x <= pauseMenuButtons.restart.x + pauseMenuButtons.restart.width &&
        y >= pauseMenuButtons.restart.y && y <= pauseMenuButtons.restart.y + pauseMenuButtons.restart.height) {
        if (Game && Game.restart) {
            Game.restart();
            return true;
        }
    }
    
    // Check nexus button
    if (x >= pauseMenuButtons.nexus.x && x <= pauseMenuButtons.nexus.x + pauseMenuButtons.nexus.width &&
        y >= pauseMenuButtons.nexus.y && y <= pauseMenuButtons.nexus.y + pauseMenuButtons.nexus.height) {
        if (Game && Game.returnToNexus) {
            Game.returnToNexus();
            return true;
        }
    }
    
    // Check fullscreen button
    if (x >= pauseMenuButtons.fullscreen.x && x <= pauseMenuButtons.fullscreen.x + pauseMenuButtons.fullscreen.width &&
        y >= pauseMenuButtons.fullscreen.y && y <= pauseMenuButtons.fullscreen.y + pauseMenuButtons.fullscreen.height) {
        if (Game && Game.toggleFullscreen) {
            Game.toggleFullscreen();
            return true;
        }
    }
    
    // Check control mode button
    if (x >= pauseMenuButtons.controlMode.x && x <= pauseMenuButtons.controlMode.x + pauseMenuButtons.controlMode.width &&
        y >= pauseMenuButtons.controlMode.y && y <= pauseMenuButtons.controlMode.y + pauseMenuButtons.controlMode.height) {
        if (typeof Input !== 'undefined' && typeof SaveSystem !== 'undefined') {
            // Cycle through modes: auto -> mobile -> desktop -> auto
            const currentMode = Input.controlMode || 'auto';
            let nextMode = 'auto';
            if (currentMode === 'auto') {
                nextMode = 'mobile';
            } else if (currentMode === 'mobile') {
                nextMode = 'desktop';
            } else if (currentMode === 'desktop') {
                nextMode = 'auto';
            }
            
            // Save new mode
            SaveSystem.setControlMode(nextMode);
            
            // Update Input system
            Input.controlMode = nextMode;
            
            // Reinitialize touch controls if needed
            if (Game && Game.canvas) {
                if (Input.isTouchMode()) {
                    Input.initTouchControls(Game.canvas);
                } else {
                    // Clear touch controls if switching to desktop
                    Input.touchJoysticks = {};
                    Input.touchButtons = {};
                }
            }
            
            return true;
        }
    }
    
    // Check how to play button
    if (x >= pauseMenuButtons.howToPlay.x && x <= pauseMenuButtons.howToPlay.x + pauseMenuButtons.howToPlay.width &&
        y >= pauseMenuButtons.howToPlay.y && y <= pauseMenuButtons.howToPlay.y + pauseMenuButtons.howToPlay.height) {
        if (Game) {
            Game.launchModalVisible = true;
            return true;
        }
    }
    
    // Check circular update button (always available)
    if (updateButton.radius > 0) {
        const dx = x - updateButton.x;
        const dy = y - updateButton.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance <= updateButton.radius) {
            if (Game) {
                Game.updateModalVisible = true;
                return true;
            }
        }
    }
    
    return false;
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

// Interaction button system for mobile
let currentInteraction = null; // { type: 'gear'|'class'|'upgrade'|'portal', data: object } or null

// Interaction button class
class InteractionButton {
    constructor(x, y, width, height, label) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.label = label;
        this.pressed = false;
        this.justPressed = false;
    }
    
    contains(x, y) {
        // Add padding for easier tapping
        const padding = 8;
        return x >= this.x - padding && x <= this.x + this.width + padding &&
               y >= this.y - padding && y <= this.y + this.height + padding;
    }
    
    render(ctx) {
        const isPressed = this.pressed;
        
        // Rounded rectangle background
        const radius = 12;
        const bgAlpha = isPressed ? 0.9 : 0.75;
        
        // Background with rounded corners
        ctx.fillStyle = `rgba(80, 150, 255, ${bgAlpha})`;
        this.drawRoundedRect(ctx, this.x, this.y, this.width, this.height, radius);
        ctx.fill();
        
        // Border
        const borderWidth = isPressed ? 4 : 3;
        ctx.strokeStyle = isPressed ? 'rgba(255, 255, 255, 1.0)' : 'rgba(200, 230, 255, 0.9)';
        ctx.lineWidth = borderWidth;
        this.drawRoundedRect(ctx, this.x, this.y, this.width, this.height, radius);
        ctx.stroke();
        
        // Label
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Text shadow for readability
        ctx.shadowBlur = 3;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
        ctx.fillText(this.label, this.x + this.width / 2, this.y + this.height / 2);
        ctx.shadowBlur = 0;
    }
    
    // Helper function to draw rounded rectangle
    drawRoundedRect(ctx, x, y, width, height, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
    }
    
    update() {
        this.justPressed = false;
    }
}

// Global interaction button instance
let interactionButton = null;

// Check for gear pickup interaction
function checkGearInteraction() {
    if (!Game || !Game.player || !Game.player.alive || typeof groundLoot === 'undefined') {
        return null;
    }
    
    // Find closest gear within pickup range
    let closestGear = null;
    let closestDistance = 50; // pickup range
    
    groundLoot.forEach(gear => {
        const dx = gear.x - Game.player.x;
        const dy = gear.y - Game.player.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < closestDistance) {
            closestDistance = distance;
            closestGear = gear;
        }
    });
    
    if (closestGear) {
        return { type: 'gear', data: closestGear };
    }
    
    return null;
}

// Check for nexus interactions
function checkNexusInteractions() {
    if (!Game || Game.state !== 'NEXUS' || !Game.player || typeof nexusRoom === 'undefined' || !nexusRoom) {
        return null;
    }
    
    // Check class stations
    if (typeof classStations !== 'undefined') {
        for (const station of classStations) {
            const dx = station.x - Game.player.x;
            const dy = station.y - Game.player.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < 50) {
                return { type: 'class', data: station };
            }
        }
    }
    
    // Check upgrade stations
    if (Game.selectedClass && typeof upgradeStations !== 'undefined') {
        for (const station of upgradeStations) {
            const dx = station.x - Game.player.x;
            const dy = station.y - Game.player.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < 50) {
                return { type: 'upgrade', data: station };
            }
        }
    }
    
    // Check portal
    if (nexusRoom.portalPos) {
        const portalDx = nexusRoom.portalPos.x - Game.player.x;
        const portalDy = nexusRoom.portalPos.y - Game.player.y;
        const portalDistance = Math.sqrt(portalDx * portalDx + portalDy * portalDy);
        
        if (portalDistance < 60 && Game.selectedClass) {
            return { type: 'portal', data: null };
        }
    }
    
    return null;
}

// Update interaction state
function updateInteractionState() {
    if (!Input || !Input.isTouchMode || !Input.isTouchMode()) {
        currentInteraction = null;
        return;
    }
    
    // Check for interactions based on game state
    if (Game && Game.state === 'PLAYING') {
        currentInteraction = checkGearInteraction();
    } else if (Game && Game.state === 'NEXUS') {
        currentInteraction = checkNexusInteractions();
    } else {
        currentInteraction = null;
    }
}

// Render interaction button
function renderInteractionButton(ctx) {
    if (!Input || !Input.isTouchMode || !Input.isTouchMode()) {
        return;
    }
    
    // Update interaction state
    updateInteractionState();
    
    if (!currentInteraction) {
        return;
    }
    
    // Determine button label
    let label = 'Interact';
    if (currentInteraction.type === 'gear') {
        label = 'Pickup Gear';
    } else if (currentInteraction.type === 'class') {
        label = 'Select Class';
    } else if (currentInteraction.type === 'upgrade') {
        label = 'Purchase Upgrade';
    } else if (currentInteraction.type === 'portal') {
        label = 'Enter Portal';
    }
    
    // Position button (center-bottom, above touch controls)
    const canvasWidth = Game ? Game.config.width : 1280;
    const canvasHeight = Game ? Game.config.height : 720;
    const buttonWidth = 200;
    const buttonHeight = 60;
    const buttonX = (canvasWidth - buttonWidth) / 2;
    const buttonY = canvasHeight - 250; // Above touch controls
    
    // Create or update button
    if (!interactionButton) {
        interactionButton = new InteractionButton(buttonX, buttonY, buttonWidth, buttonHeight, label);
    } else {
        interactionButton.x = buttonX;
        interactionButton.y = buttonY;
        interactionButton.width = buttonWidth;
        interactionButton.height = buttonHeight;
        interactionButton.label = label;
    }
    
    // Render button
    interactionButton.render(ctx);
}

// Handle interaction button click
function handleInteractionButtonClick(x, y) {
    if (!interactionButton || !currentInteraction) {
        return false;
    }
    
    if (interactionButton.contains(x, y)) {
        interactionButton.pressed = true;
        interactionButton.justPressed = true;
        
        // Trigger the interaction directly
        if (Game && Game.state === 'PLAYING' && currentInteraction.type === 'gear') {
            // Trigger gear pickup directly
            if (Game.checkGearPickup && Game.player && Game.player.alive && typeof groundLoot !== 'undefined') {
                // Find closest gear and pick it up
                let closestGear = null;
                let closestDistance = 50;
                
                groundLoot.forEach(gear => {
                    const dx = gear.x - Game.player.x;
                    const dy = gear.y - Game.player.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance < closestDistance) {
                        closestDistance = distance;
                        closestGear = gear;
                    }
                });
                
                if (closestGear && Game.pickupGear) {
                    Game.pickupGear(closestGear);
                }
            }
        } else if (Game && Game.state === 'NEXUS') {
            // Trigger nexus interaction by simulating G key press
            // We need to use the existing interaction logic
            if (Input && Input.keys) {
                const originalGState = Input.keys['g'];
                Input.keys['g'] = true;
                Game.lastGKeyState = false; // Force it to trigger
                // The updateNexus will handle it on next frame
                setTimeout(() => {
                    Input.keys['g'] = originalGState;
                }, 10);
            }
        }
        
        return true;
    }
    
    return false;
}

// Render touch controls (virtual joysticks and buttons)
function renderTouchControls(ctx) {
    if (!Input || !Input.isTouchMode || !Input.isTouchMode()) return;
    
    const width = Game ? Game.config.width : 1280;
    const height = Game ? Game.config.height : 720;
    
    // Debug: Show touch control bounds and pause button
    if (Input.touchJoysticks && Input.touchJoysticks.basicAttack) {
        const joystick = Input.touchJoysticks.basicAttack;
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(joystick.centerX, joystick.centerY, joystick.radius * 2, 0, Math.PI * 2);
        ctx.stroke();
        
        // Show center point
        ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
        ctx.beginPath();
        ctx.arc(joystick.centerX, joystick.centerY, 5, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Debug: Show pause button bounds
    if (Game && Game.state === 'PLAYING') {
        const canvasWidth = Game.config.width;
        const size = pauseButtonOverlay.size;
        const padding = 10;
        const buttonX = canvasWidth - size - padding;
        const buttonY = padding;
        
        ctx.strokeStyle = 'rgba(0, 255, 0, 0.8)';
        ctx.lineWidth = 3;
        ctx.strokeRect(buttonX, buttonY, size, size);
        
        // Show text
        ctx.fillStyle = 'rgba(0, 255, 0, 0.8)';
        ctx.font = '12px Arial';
        ctx.fillText(`Pause: ${buttonX},${buttonY}`, buttonX - 50, buttonY - 5);
    }
    
    // LEFT SIDE: Movement joystick with subtle background
    if (Input.touchJoysticks && Input.touchJoysticks.movement) {
        const movement = Input.touchJoysticks.movement;
        // Subtle glow/background for movement joystick
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.beginPath();
        ctx.arc(movement.centerX, movement.centerY, movement.radius + 20, 0, Math.PI * 2);
        ctx.fill();
        
        movement.render(ctx);
    }
    
    // RIGHT SIDE: Combat control cluster with unified background
    if (Input.touchJoysticks && Input.touchJoysticks.basicAttack) {
        const basicAttack = Input.touchJoysticks.basicAttack;
        const centerX = basicAttack.centerX;
        const centerY = basicAttack.centerY;
        
        // Calculate cluster bounds (encompass all controls)
        let maxDistance = basicAttack.radius + 20;
        if (Input.touchButtons) {
            for (const button of Object.values(Input.touchButtons)) {
                if (button) {
                    const btnCenterX = button.x + button.width / 2;
                    const btnCenterY = button.y + button.height / 2;
                    const dx = btnCenterX - centerX;
                    const dy = btnCenterY - centerY;
                    const dist = Math.sqrt(dx * dx + dy * dy) + Math.max(button.width, button.height) / 2;
                    if (dist > maxDistance) maxDistance = dist;
                }
            }
        }
        
        // Draw unified cluster background (subtle glow/outline)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.beginPath();
        ctx.arc(centerX, centerY, maxDistance + 15, 0, Math.PI * 2);
        ctx.fill();
        
        // Outer glow ring for cohesion
        ctx.strokeStyle = 'rgba(150, 150, 200, 0.2)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(centerX, centerY, maxDistance + 15, 0, Math.PI * 2);
        ctx.stroke();
    }
    
    // Get player class for conditional rendering
    const playerClass = typeof Game !== 'undefined' && Game.player ? Game.player.playerClass : null;
    
    // Render joysticks (conditionally based on class)
    if (Input.touchJoysticks) {
        for (const [name, joystick] of Object.entries(Input.touchJoysticks)) {
            if (joystick) {
                // Hide special ability joystick for triangle and square (they use buttons)
                if (name === 'specialAbility' && (playerClass === 'triangle' || playerClass === 'square')) {
                    continue;
                }
                // Show dodge joystick for triangle (replaces button)
                if (name === 'dodge' && playerClass === 'triangle') {
                    joystick.render(ctx);
                    continue;
                }
                // Hide dodge joystick for other classes (they use button)
                if (name === 'dodge' && playerClass !== 'triangle') {
                    continue;
                }
                // Render all other joysticks
                joystick.render(ctx);
            }
        }
    }
    
    // Render buttons with cooldowns (conditionally based on class)
    if (Input.touchButtons && typeof Game !== 'undefined' && Game.player) {
        const player = Game.player;
        
        // Heavy attack button (always show)
        if (Input.touchButtons.heavyAttack) {
            Input.touchButtons.heavyAttack.render(ctx, 
                player.heavyAttackCooldown || 0, 
                player.heavyAttackCooldownTime || 1.5);
        }
        
        // Special ability button (always show, joystick hidden for triangle/square)
        if (Input.touchButtons.specialAbility) {
            Input.touchButtons.specialAbility.render(ctx, 
                player.specialCooldown || 0, 
                player.specialCooldownTime || 5.0);
        }
        
        // Dodge button (hide for triangle, show for others)
        if (Input.touchButtons.dodge && playerClass !== 'triangle') {
            let dodgeCooldown = 0;
            let dodgeMaxCooldown = player.dodgeCooldownTime || 2.0;
            dodgeCooldown = player.dodgeCooldown || 0;
            Input.touchButtons.dodge.render(ctx, dodgeCooldown, dodgeMaxCooldown);
        }
    }
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
    
    // Render pause button (if playing or in nexus)
    if ((Game.state === 'PLAYING' || Game.state === 'NEXUS') && typeof renderPauseButton === 'function') {
        renderPauseButton(ctx);
    }
    
    // Render touch controls (on top of everything, only in touch mode)
    renderTouchControls(ctx);
    
    // Render interaction button (on top of touch controls)
    if (typeof renderInteractionButton === 'function') {
        renderInteractionButton(ctx);
    }
}

// Render launch modal (controls tutorial)
function renderLaunchModal(ctx) {
    const canvasWidth = Game ? Game.config.width : 1280;
    const canvasHeight = Game ? Game.config.height : 720;
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;
    
    // Dark overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    // Main panel
    const panelWidth = 900;
    const panelHeight = 650;
    const panelX = (canvasWidth - panelWidth) / 2;
    const panelY = (canvasHeight - panelHeight) / 2;
    
    // Panel background with gradient
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
    
    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 56px Arial';
    ctx.textAlign = 'center';
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#6666ff';
    ctx.fillText('How to Play', centerX, panelY + 60);
    ctx.shadowBlur = 0;
    
    // Check if mobile or desktop
    const isMobile = typeof Input !== 'undefined' && Input.isTouchMode && Input.isTouchMode();
    
    if (isMobile) {
        // Mobile controls visual - mini preview of screen layout
        // Position controls lower and spaced out to match actual screen
        const previewStartY = panelY + 140;
        const previewWidth = panelWidth - 60;
        const previewHeight = 400;
        const previewX = panelX + 30;
        const previewY = previewStartY;
        
        // Scale factor for mini preview (larger for better readability)
        const scale = 0.95;
        const joystickRadius = 50 * scale;
        const buttonRadius = 35 * scale;
        const buttonDistance = 85 * scale;
        
        // Left joystick (movement) - positioned like actual screen
        const leftJoystickX = previewX + 100;
        const leftJoystickY = previewY + previewHeight - 140;
        
        // Joystick background circle
        ctx.fillStyle = 'rgba(100, 100, 150, 0.3)';
        ctx.beginPath();
        ctx.arc(leftJoystickX, leftJoystickY, joystickRadius, 0, Math.PI * 2);
        ctx.fill();
        
        // Joystick border
        ctx.strokeStyle = 'rgba(150, 150, 200, 0.8)';
        ctx.lineWidth = 3;
        ctx.stroke();
        
        // Joystick knob
        ctx.fillStyle = 'rgba(200, 200, 255, 0.9)';
        ctx.beginPath();
        ctx.arc(leftJoystickX, leftJoystickY, 25 * scale, 0, Math.PI * 2);
        ctx.fill();
        
        // Label
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 22px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Move', leftJoystickX, leftJoystickY + joystickRadius + 30);
        
        // Right joystick (aim/attack) - center-right like actual screen
        const rightJoystickX = previewX + previewWidth - 180;
        const rightJoystickY = previewY + previewHeight - 140;
        
        // Joystick background
        ctx.fillStyle = 'rgba(100, 100, 150, 0.3)';
        ctx.beginPath();
        ctx.arc(rightJoystickX, rightJoystickY, joystickRadius, 0, Math.PI * 2);
        ctx.fill();
        
        // Joystick border
        ctx.strokeStyle = 'rgba(150, 150, 200, 0.8)';
        ctx.lineWidth = 3;
        ctx.stroke();
        
        // Joystick knob
        ctx.fillStyle = 'rgba(200, 200, 255, 0.9)';
        ctx.beginPath();
        ctx.arc(rightJoystickX, rightJoystickY, 25 * scale, 0, Math.PI * 2);
        ctx.fill();
        
        // Label
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 22px Arial';
        ctx.fillText('Primary Fire', rightJoystickX, rightJoystickY + joystickRadius + 30);
        ctx.font = '16px Arial';
        ctx.fillStyle = '#aaaaaa';
        ctx.fillText('Aim & Attack', rightJoystickX, rightJoystickY + joystickRadius + 50);
        
        // Three radial buttons around right joystick - CORRECT POSITIONS
        // Dodge button (TOP of joystick)
        const dodgeX = rightJoystickX;
        const dodgeY = rightJoystickY - buttonDistance;
        ctx.fillStyle = 'rgba(150, 150, 200, 0.6)';
        ctx.beginPath();
        ctx.arc(dodgeX, dodgeY, buttonRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(200, 200, 255, 0.9)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Dodge', dodgeX, dodgeY);
        
        // Heavy Attack button (BOTTOM-LEFT of joystick)
        const heavyX = rightJoystickX - buttonDistance * 0.707; // 45 degrees bottom-left
        const heavyY = rightJoystickY + buttonDistance * 0.707;
        ctx.fillStyle = 'rgba(150, 150, 200, 0.6)';
        ctx.beginPath();
        ctx.arc(heavyX, heavyY, buttonRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(200, 200, 255, 0.9)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 13px Arial';
        ctx.fillText('Heavy', heavyX, heavyY - 5);
        ctx.font = 'bold 13px Arial';
        ctx.fillText('Attack', heavyX, heavyY + 10);
        
        // Special Attack button (BOTTOM-RIGHT of joystick)
        const specialX = rightJoystickX + buttonDistance * 0.707; // 45 degrees bottom-right
        const specialY = rightJoystickY + buttonDistance * 0.707;
        ctx.fillStyle = 'rgba(150, 150, 200, 0.6)';
        ctx.beginPath();
        ctx.arc(specialX, specialY, buttonRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(200, 200, 255, 0.9)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 13px Arial';
        ctx.fillText('Special', specialX, specialY - 5);
        ctx.fillText('Attack', specialX, specialY + 10);
        
        // Pause button representation (top-right of preview)
        const pauseButtonX = previewX + previewWidth - 50;
        const pauseButtonY = previewY + 40;
        const pauseButtonSize = 40 * scale;
        
        // Pause button background circle
        ctx.fillStyle = 'rgba(60, 60, 90, 0.8)';
        ctx.beginPath();
        ctx.arc(pauseButtonX, pauseButtonY, pauseButtonSize / 2, 0, Math.PI * 2);
        ctx.fill();
        
        // Pause button border
        ctx.strokeStyle = 'rgba(200, 200, 255, 0.8)';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Pause icon (two vertical bars)
        ctx.fillStyle = '#ffffff';
        const barWidth = 4 * scale;
        const barHeight = 14 * scale;
        const barSpacing = 3 * scale;
        const iconX = pauseButtonX - (barWidth * 2 + barSpacing) / 2;
        const iconY = pauseButtonY - barHeight / 2;
        
        ctx.fillRect(iconX, iconY, barWidth, barHeight);
        ctx.fillRect(iconX + barWidth + barSpacing, iconY, barWidth, barHeight);
        
        // Label next to pause button
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('Pause Button', pauseButtonX + pauseButtonSize / 2 + 15, pauseButtonY + 5);
        
    } else {
        // Desktop controls visual - better organized layout
        const controlsStartY = panelY + 120;
        const controlsCenterX = centerX;
        
        // Left side: Mouse graphic with arrows
        const mouseX = controlsCenterX - 250;
        const mouseY = controlsStartY + 150;
        
        // Draw directional arrows around mouse (aim indication)
        const arrowLength = 50;
        const arrowDistance = 70;
        ctx.strokeStyle = 'rgba(100, 200, 255, 0.6)';
        ctx.lineWidth = 3;
        ctx.fillStyle = 'rgba(100, 200, 255, 0.6)';
        
        // Top arrow
        ctx.beginPath();
        ctx.moveTo(mouseX, mouseY - arrowDistance);
        ctx.lineTo(mouseX, mouseY - arrowDistance - arrowLength);
        ctx.lineTo(mouseX - 8, mouseY - arrowDistance - arrowLength + 12);
        ctx.moveTo(mouseX, mouseY - arrowDistance - arrowLength);
        ctx.lineTo(mouseX + 8, mouseY - arrowDistance - arrowLength + 12);
        ctx.stroke();
        ctx.fill();
        
        // Bottom arrow
        ctx.beginPath();
        ctx.moveTo(mouseX, mouseY + arrowDistance);
        ctx.lineTo(mouseX, mouseY + arrowDistance + arrowLength);
        ctx.lineTo(mouseX - 8, mouseY + arrowDistance + arrowLength - 12);
        ctx.moveTo(mouseX, mouseY + arrowDistance + arrowLength);
        ctx.lineTo(mouseX + 8, mouseY + arrowDistance + arrowLength - 12);
        ctx.stroke();
        ctx.fill();
        
        // Left arrow
        ctx.beginPath();
        ctx.moveTo(mouseX - arrowDistance, mouseY);
        ctx.lineTo(mouseX - arrowDistance - arrowLength, mouseY);
        ctx.lineTo(mouseX - arrowDistance - arrowLength + 12, mouseY - 8);
        ctx.moveTo(mouseX - arrowDistance - arrowLength, mouseY);
        ctx.lineTo(mouseX - arrowDistance - arrowLength + 12, mouseY + 8);
        ctx.stroke();
        ctx.fill();
        
        // Right arrow
        ctx.beginPath();
        ctx.moveTo(mouseX + arrowDistance, mouseY);
        ctx.lineTo(mouseX + arrowDistance + arrowLength, mouseY);
        ctx.lineTo(mouseX + arrowDistance + arrowLength - 12, mouseY - 8);
        ctx.moveTo(mouseX + arrowDistance + arrowLength, mouseY);
        ctx.lineTo(mouseX + arrowDistance + arrowLength - 12, mouseY + 8);
        ctx.stroke();
        ctx.fill();
        
        // Mouse body (oval)
        ctx.fillStyle = 'rgba(120, 120, 140, 0.9)';
        ctx.beginPath();
        ctx.ellipse(mouseX, mouseY, 45, 65, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Mouse button separation line
        ctx.strokeStyle = 'rgba(60, 60, 80, 0.9)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(mouseX, mouseY - 30);
        ctx.lineTo(mouseX, mouseY + 30);
        ctx.stroke();
        
        // Left mouse button (larger, clearer)
        ctx.fillStyle = 'rgba(80, 150, 220, 0.9)';
        ctx.fillRect(mouseX - 45, mouseY - 30, 40, 25);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(mouseX - 45, mouseY - 30, 40, 25);
        
        // Right mouse button
        ctx.fillStyle = 'rgba(150, 100, 220, 0.9)';
        ctx.fillRect(mouseX + 5, mouseY - 30, 40, 25);
        ctx.strokeRect(mouseX + 5, mouseY - 30, 40, 25);
        
        // Button labels (clearer)
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('L', mouseX - 25, mouseY - 15);
        ctx.fillText('R', mouseX + 25, mouseY - 15);
        
        // Button action labels below mouse
        ctx.font = 'bold 14px Arial';
        ctx.fillStyle = '#88ccff';
        ctx.fillText('Primary', mouseX - 25, mouseY + 50);
        ctx.fillStyle = '#cc88ff';
        ctx.fillText('Heavy', mouseX + 25, mouseY + 50);
        
        // Mouse movement explanation
        ctx.font = '16px Arial';
        ctx.fillStyle = '#cccccc';
        ctx.fillText('Move mouse to aim', mouseX, mouseY + 80);
        
        // Center: WASD keys in proper keyboard layout (W on top, A-S-D in row)
        const wasdX = controlsCenterX;
        const wasdY = controlsStartY + 150;
        const keySize = 40;
        const keySpacing = 48;
        
        // W key (top, centered)
        ctx.fillStyle = 'rgba(150, 150, 200, 0.9)';
        ctx.fillRect(wasdX - keySize/2, wasdY - keySpacing - keySize/2, keySize, keySize);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(wasdX - keySize/2, wasdY - keySpacing - keySize/2, keySize, keySize);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 22px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('W', wasdX, wasdY - keySpacing);
        
        // A key (left)
        ctx.fillStyle = 'rgba(150, 150, 200, 0.9)';
        ctx.fillRect(wasdX - keySpacing - keySize/2, wasdY - keySize/2, keySize, keySize);
        ctx.strokeRect(wasdX - keySpacing - keySize/2, wasdY - keySize/2, keySize, keySize);
        ctx.fillStyle = '#ffffff'; // Explicitly set to white like W key
        ctx.fillText('A', wasdX - keySpacing, wasdY);
        
        // S key (center)
        ctx.fillStyle = 'rgba(150, 150, 200, 0.9)';
        ctx.fillRect(wasdX - keySize/2, wasdY - keySize/2, keySize, keySize);
        ctx.strokeRect(wasdX - keySize/2, wasdY - keySize/2, keySize, keySize);
        ctx.fillStyle = '#ffffff'; // Explicitly set to white like W key
        ctx.fillText('S', wasdX, wasdY);
        
        // D key (right)
        ctx.fillStyle = 'rgba(150, 150, 200, 0.9)';
        ctx.fillRect(wasdX + keySpacing - keySize/2, wasdY - keySize/2, keySize, keySize);
        ctx.strokeRect(wasdX + keySpacing - keySize/2, wasdY - keySize/2, keySize, keySize);
        ctx.fillStyle = '#ffffff'; // Explicitly set to white like W key
        ctx.fillText('D', wasdX + keySpacing, wasdY);
        
        // Movement label
        ctx.font = '18px Arial';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('Movement', wasdX, wasdY + keySpacing + 25);
        
        // Right side: Shift and Space keys
        const keysX = controlsCenterX + 250;
        const keysY = controlsStartY + 150;
        
        // Shift key
        const shiftWidth = 90;
        const shiftHeight = 40;
        ctx.fillStyle = 'rgba(150, 150, 200, 0.9)';
        ctx.fillRect(keysX - shiftWidth/2, keysY - shiftHeight/2 - 30, shiftWidth, shiftHeight);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(keysX - shiftWidth/2, keysY - shiftHeight/2 - 30, shiftWidth, shiftHeight);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 18px Arial';
        ctx.fillText('Shift', keysX, keysY - 30);
        ctx.font = '14px Arial';
        ctx.fillStyle = '#aaaaaa';
        ctx.fillText('Dodge', keysX, keysY + 15); // Below the Shift button
        
        // Space bar (moved further down to avoid overlapping Shift's label)
        const spaceWidth = 140;
        const spaceHeight = 40;
        const spaceOffset = 60; // Increased from 30 to 60 for more spacing
        ctx.fillStyle = 'rgba(150, 150, 200, 0.9)';
        ctx.fillRect(keysX - spaceWidth/2, keysY - spaceHeight/2 + spaceOffset, spaceWidth, spaceHeight);
        ctx.strokeRect(keysX - spaceWidth/2, keysY - spaceHeight/2 + spaceOffset, spaceWidth, spaceHeight);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 18px Arial';
        ctx.fillText('Space', keysX, keysY + spaceOffset);
        ctx.font = '14px Arial';
        ctx.fillStyle = '#aaaaaa';
        ctx.fillText('Special', keysX, keysY + spaceOffset + 45); // Moved down below the Space button
        
        // Class variations explanation (centered at bottom of controls area)
        ctx.font = '18px Arial';
        ctx.fillStyle = '#ffffaa';
        ctx.textAlign = 'center';
        ctx.fillText('Each class has variations you\'ll discover!', centerX, controlsStartY + 280);
    }
    
    // Thank you message
    ctx.fillStyle = '#ffffaa';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Thanks for trying my game!', centerX, panelY + panelHeight - 80);
    
    // Close button
    const closeButtonWidth = 200;
    const closeButtonHeight = 50;
    const closeButtonX = centerX - closeButtonWidth / 2;
    const closeButtonY = panelY + panelHeight - 50;
    
    modalCloseButton.x = closeButtonX;
    modalCloseButton.y = closeButtonY;
    modalCloseButton.width = closeButtonWidth;
    modalCloseButton.height = closeButtonHeight;
    
    const isClosePressed = modalCloseButton.pressed;
    const closeBgGradient = ctx.createLinearGradient(closeButtonX, closeButtonY, closeButtonX, closeButtonY + closeButtonHeight);
    closeBgGradient.addColorStop(0, isClosePressed ? 'rgba(100, 150, 255, 0.9)' : 'rgba(80, 120, 220, 0.8)');
    closeBgGradient.addColorStop(1, isClosePressed ? 'rgba(70, 110, 200, 0.9)' : 'rgba(60, 100, 180, 0.8)');
    ctx.fillStyle = closeBgGradient;
    ctx.fillRect(closeButtonX, closeButtonY, closeButtonWidth, closeButtonHeight);
    
    ctx.strokeStyle = isClosePressed ? 'rgba(255, 255, 255, 1.0)' : 'rgba(150, 200, 255, 0.9)';
    ctx.lineWidth = isClosePressed ? 4 : 3;
    ctx.strokeRect(closeButtonX, closeButtonY, closeButtonWidth, closeButtonHeight);
    
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Close', centerX, closeButtonY + closeButtonHeight / 2);
}

// Render update modal
function renderUpdateModal(ctx) {
    const canvasWidth = Game ? Game.config.width : 1280;
    const canvasHeight = Game ? Game.config.height : 720;
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;
    
    // Dark overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    // Main panel
    const panelWidth = 700;
    const panelHeight = 500;
    const panelX = (canvasWidth - panelWidth) / 2;
    const panelY = (canvasHeight - panelHeight) / 2;
    
    // Panel background with gradient
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
    
    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#6666ff';
    const version = Game && Game.VERSION ? Game.VERSION : '1.0.0';
    ctx.fillText(`What's New - v${version}`, centerX, panelY + 60);
    ctx.shadowBlur = 0;
    
    // Update message
    const updateMessage = Game && Game.UPDATE_MESSAGES && Game.UPDATE_MESSAGES[version] 
        ? Game.UPDATE_MESSAGES[version] 
        : 'Game updated!';
    
    ctx.fillStyle = '#cccccc';
    ctx.font = '20px Arial';
    ctx.textAlign = 'center';
    
    // Word wrap the message
    const maxWidth = panelWidth - 80;
    const words = updateMessage.split(' ');
    let line = '';
    let y = panelY + 140;
    
    words.forEach(word => {
        const testLine = line + word + ' ';
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && line.length > 0) {
            ctx.fillText(line, centerX, y);
            line = word + ' ';
            y += 30;
        } else {
            line = testLine;
        }
    });
    ctx.fillText(line, centerX, y);
    
    // Close button
    const closeButtonWidth = 200;
    const closeButtonHeight = 50;
    const closeButtonX = centerX - closeButtonWidth / 2;
    const closeButtonY = panelY + panelHeight - 50;
    
    modalCloseButton.x = closeButtonX;
    modalCloseButton.y = closeButtonY;
    modalCloseButton.width = closeButtonWidth;
    modalCloseButton.height = closeButtonHeight;
    
    const isClosePressed = modalCloseButton.pressed;
    const closeBgGradient = ctx.createLinearGradient(closeButtonX, closeButtonY, closeButtonX, closeButtonY + closeButtonHeight);
    closeBgGradient.addColorStop(0, isClosePressed ? 'rgba(100, 150, 255, 0.9)' : 'rgba(80, 120, 220, 0.8)');
    closeBgGradient.addColorStop(1, isClosePressed ? 'rgba(70, 110, 200, 0.9)' : 'rgba(60, 100, 180, 0.8)');
    ctx.fillStyle = closeBgGradient;
    ctx.fillRect(closeButtonX, closeButtonY, closeButtonWidth, closeButtonHeight);
    
    ctx.strokeStyle = isClosePressed ? 'rgba(255, 255, 255, 1.0)' : 'rgba(150, 200, 255, 0.9)';
    ctx.lineWidth = isClosePressed ? 4 : 3;
    ctx.strokeRect(closeButtonX, closeButtonY, closeButtonWidth, closeButtonHeight);
    
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Close', centerX, closeButtonY + closeButtonHeight / 2);
}

// Check if click/touch is on modal close button
function checkModalCloseButtonClick(x, y) {
    // Convert screen coordinates to game coordinates
    if (Game && Game.screenToGame) {
        const gameCoords = Game.screenToGame(x, y);
        x = gameCoords.x;
        y = gameCoords.y;
    }
    
    // Check if click is within close button bounds
    if (x >= modalCloseButton.x && x <= modalCloseButton.x + modalCloseButton.width &&
        y >= modalCloseButton.y && y <= modalCloseButton.y + modalCloseButton.height) {
        
        // Close launch modal
        if (Game && Game.launchModalVisible) {
            Game.launchModalVisible = false;
            if (typeof SaveSystem !== 'undefined') {
                SaveSystem.setHasSeenLaunchModal(true);
            }
            return true;
        }
        
        // Close update modal
        if (Game && Game.updateModalVisible) {
            Game.updateModalVisible = false;
            if (typeof SaveSystem !== 'undefined' && Game.VERSION) {
                SaveSystem.setLastRunVersion(Game.VERSION);
            }
            return true;
        }
    }
    
    return false;
}

