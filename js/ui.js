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
    const barX = 20;
    const barY = 20;
    const barWidth = 200;
    const barHeight = 20;
    
    // Draw background (dark red/gray)
    ctx.fillStyle = '#333333';
    ctx.fillRect(barX, barY, barWidth, barHeight);
    
    // Draw foreground (green) scaled by HP/maxHP
    const hpPercent = player.hp / player.maxHp;
    ctx.fillStyle = hpPercent > 0.5 ? '#4caf50' : hpPercent > 0.25 ? '#ff9800' : '#f44336';
    ctx.fillRect(barX, barY, barWidth * hpPercent, barHeight);
    
    // Draw border
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(barX, barY, barWidth, barHeight);
    
    // Draw text centered on bar
    ctx.fillStyle = '#ffffff';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    const healthText = `${Math.floor(player.hp)}/${Math.floor(player.maxHp)}`;
    ctx.fillText(healthText, barX + barWidth / 2, barY + 15);
    ctx.textAlign = 'left'; // Reset alignment
}

// Render XP bar
function renderXPBar(ctx, player) {
    const barX = (800 - 700) / 2; // Center the bar
    const barY = 570;
    const barWidth = 700;
    const barHeight = 15;
    
    // Draw background (dark)
    ctx.fillStyle = '#222222';
    ctx.fillRect(barX, barY, barWidth, barHeight);
    
    // Draw foreground (cyan) scaled by XP/xpToNext
    const xpPercent = player.xp / player.xpToNext;
    ctx.fillStyle = '#00ffff';
    ctx.fillRect(barX, barY, barWidth * xpPercent, barHeight);
    
    // Draw border
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(barX, barY, barWidth, barHeight);
    
    // Draw text
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px Arial';
    const text = `Level ${player.level} - ${Math.floor(player.xp)}/${player.xpToNext} XP`;
    const textWidth = ctx.measureText(text).width;
    ctx.fillText(text, barX + (barWidth - textWidth) / 2, barY + 12);
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
    
    // Dark overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
    ctx.fillRect(0, 0, 800, 600);
    
    // Title
    ctx.fillStyle = '#ff0000';
    ctx.font = 'bold 60px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', 400, 120);
    
    // Stats
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px Arial';
    
    const stats = [
        `Level Reached: ${player.level}`,
        `Rooms Cleared: ${Game.roomNumber - 1}`,
        `Enemies Killed: ${Game.enemiesKilled || 0}`,
        `Time Played: ${minutes}:${seconds}`
    ];
    
    stats.forEach((stat, index) => {
        ctx.fillText(stat, 400, 220 + (index * 50));
    });
    
    // Instructions
    ctx.font = 'bold 24px Arial';
    ctx.fillStyle = '#ffff00';
    ctx.fillText('Press R to Restart', 400, 480);
    ctx.fillStyle = '#aaaaaa';
    ctx.font = '18px Arial';
    ctx.fillText('Press M for Main Menu', 400, 520);
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
    
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`Room ${Game.roomNumber}`, 400, 40);
    
    // Draw enemy count if room not cleared
    if (typeof currentRoom !== 'undefined' && currentRoom && !currentRoom.cleared) {
        const enemyCount = currentRoom.enemies.filter(e => e.alive).length;
        ctx.font = '14px Arial';
        ctx.fillStyle = '#ffaaaa';
        ctx.fillText(`Enemies: ${enemyCount}`, 400, 60);
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
    
    const barY = 540; // Position near bottom
    const barWidth = 100;
    const barHeight = 8;
    const spacing = 110;
    
    // Dodge cooldown indicator
    if (player.playerClass === 'triangle') {
        // Show all charges for Triangle
        const charges = player.dodgeChargeCooldowns.length;
        for (let i = 0; i < charges; i++) {
            const barX = 50 + i * (spacing * 0.3);
            const cooldown = player.dodgeChargeCooldowns[i];
            const maxCooldown = player.dodgeCooldownTime;
            
            // Background
            ctx.fillStyle = '#333333';
            ctx.fillRect(barX, barY, barWidth * 0.3, barHeight);
            
            // Cooldown fill
            if (cooldown > 0) {
                const cooldownPercent = cooldown / maxCooldown;
                ctx.fillStyle = '#ff6666';
                ctx.fillRect(barX, barY, (barWidth * 0.3) * cooldownPercent, barHeight);
            } else {
                ctx.fillStyle = '#66ff66';
                ctx.fillRect(barX, barY, barWidth * 0.3, barHeight);
            }
            
            // Label
            ctx.fillStyle = '#ffffff';
            ctx.font = '10px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('D', barX + (barWidth * 0.15), barY - 5);
        }
    } else {
        // Single dodge cooldown for other classes
        const barX = 50;
        const cooldown = player.dodgeCooldown;
        const maxCooldown = player.dodgeCooldownTime;
        
        // Background
        ctx.fillStyle = '#333333';
        ctx.fillRect(barX, barY, barWidth, barHeight);
        
        // Cooldown fill
        if (cooldown > 0) {
            const cooldownPercent = cooldown / maxCooldown;
            ctx.fillStyle = '#ff6666';
            ctx.fillRect(barX, barY, barWidth * cooldownPercent, barHeight);
        } else {
            ctx.fillStyle = '#66ff66';
            ctx.fillRect(barX, barY, barWidth, barHeight);
        }
        
        // Label
        ctx.fillStyle = '#ffffff';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Dodge', barX + barWidth / 2, barY - 5);
    }
    
    // Special ability cooldown indicator
    // For triangle, position after the 3 dodge charges, for others after single dodge
    const specialBarX = player.playerClass === 'triangle' ? 50 + 120 : 50 + spacing;
    const specialCooldown = player.specialCooldown;
    const specialMaxCooldown = player.specialCooldownTime;
    
    // Background
    ctx.fillStyle = '#333333';
    ctx.fillRect(specialBarX, barY, barWidth, barHeight);
    
    // Cooldown fill
    if (specialCooldown > 0) {
        const cooldownPercent = specialCooldown / specialMaxCooldown;
        ctx.fillStyle = '#ff6666';
        ctx.fillRect(specialBarX, barY, barWidth * cooldownPercent, barHeight);
    } else {
        ctx.fillStyle = '#66ff66';
        ctx.fillRect(specialBarX, barY, barWidth, barHeight);
    }
    
    // Label
    ctx.fillStyle = '#ffffff';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    const abilityName = player.playerClass === 'triangle' ? 'Clones' :
                       player.playerClass === 'square' ? 'Whirlwind' : 
                       player.playerClass === 'pentagon' ? 'Shield' : 'Blink';
    ctx.fillText(abilityName, specialBarX + barWidth / 2, barY - 5);
    
    // Heavy attack cooldown indicator
    // For triangle, position well after special to avoid overlap (special extends to ~270, so start heavy at ~280)
    const heavyBarX = player.playerClass === 'triangle' ? 50 + spacing * 2.7 : 50 + spacing * 2.2;
    const heavyCooldown = player.heavyAttackCooldown || 0;
    const heavyMaxCooldown = player.heavyAttackCooldownTime || 1.5;
    
    // Background
    ctx.fillStyle = '#333333';
    ctx.fillRect(heavyBarX, barY, barWidth, barHeight);
    
    // Cooldown fill
    if (heavyCooldown > 0) {
        const cooldownPercent = heavyCooldown / heavyMaxCooldown;
        ctx.fillStyle = '#ff6600';
        ctx.fillRect(heavyBarX, barY, barWidth * cooldownPercent, barHeight);
    } else {
        ctx.fillStyle = '#66ff66';
        ctx.fillRect(heavyBarX, barY, barWidth, barHeight);
    }
    
    // Label
    ctx.fillStyle = '#ffffff';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Heavy', heavyBarX + barWidth / 2, barY - 5);
}

// Render pause menu
function renderPauseMenu(ctx) {
    // Dark overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, 800, 600);
    
    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', 400, 140);
    
    // Options
    ctx.font = '24px Arial';
    
    const options = [
        { text: 'Press ESC to Resume', y: 220 },
        { text: 'Press R to Restart', y: 260 },
        { text: 'Press M for Menu', y: 300 }
    ];
    
    options.forEach(option => {
        ctx.fillText(option.text, 400, option.y);
    });
    
    // Controls info box
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fillRect(150, 340, 500, 200);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(150, 340, 500, 200);
    
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('CONTROLS', 400, 370);
    
    ctx.font = '16px Arial';
    ctx.textAlign = 'left';
    
    const controls = [
        { x: 180, y: 400, text: 'WASD - Move' },
        { x: 180, y: 425, text: 'Mouse - Aim' },
        { x: 180, y: 450, text: 'Left Click - Basic Attack' },
        { x: 180, y: 475, text: 'Right Click - Heavy Attack' },
        { x: 180, y: 500, text: 'Shift - Dodge Roll' },
        { x: 180, y: 525, text: 'Space - Special Ability' },
        { x: 480, y: 400, text: 'G - Pickup Gear' },
        { x: 480, y: 425, text: 'Esc - Pause' },
        { x: 480, y: 450, text: 'R - Restart' },
        { x: 480, y: 475, text: 'M - Main Menu' }
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
        Game.state = 'MENU';
        Game.player = null;
        Game.enemies = [];
        Game.projectiles = [];
        Game.selectedClass = null;
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
    ctx.font = 'bold 72px Arial';
    ctx.textAlign = 'center';
    
    // Draw outline first (thinner for better readability)
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.strokeText('LEVEL UP!', 400, 100);
    
    // Draw filled text on top
    ctx.fillStyle = '#00ffff';
    ctx.fillText('LEVEL UP!', 400, 100);
    
    // Add glow effect
    ctx.shadowBlur = 30;
    ctx.shadowColor = '#00ffff';
    ctx.fillText('LEVEL UP!', 400, 100);
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

