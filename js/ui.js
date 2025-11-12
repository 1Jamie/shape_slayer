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
        let fontSize, color, prefix = '';
        if (this.isWeakPoint) {
            // Weak point hits: cyan, very large
            fontSize = 32;
            color = '#00ffff';
            prefix = 'WEAK! ';
        } else if (this.isCrit) {
            // Crits: bright red, large
            fontSize = 30;
            color = '#ff3333';
            prefix = 'CRIT! ';
        } else {
            // Normal: white, medium
            fontSize = 20;
            color = '#ffffff';
        }
        
        ctx.fillStyle = color;
        ctx.font = `bold ${fontSize}px Arial`;
        ctx.textAlign = 'center';
        
        // Draw text with prefix for crits/weak points
        const text = prefix + Math.floor(this.damage);
        
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
    
    // Validate coordinates
    if (typeof x !== 'number' || typeof y !== 'number' || isNaN(x) || isNaN(y)) {
        console.error(`[UI] Invalid coordinates for damage number: x=${x}, y=${y}`);
        return;
    }
    
    // Validate damage
    if (typeof damage !== 'number' || isNaN(damage) || damage < 0) {
        console.error(`[UI] Invalid damage value: ${damage}`);
        return;
    }
    
    Game.damageNumbers.push(new DamageNumber(x, y, damage, isCrit, isWeakPoint));
    
    if (typeof DebugFlags !== 'undefined' && DebugFlags.DAMAGE_NUMBERS) {
        console.log(`[UI] Damage number created at (${x}, ${y}), damage=${damage}, isCrit=${isCrit}, isWeakPoint=${isWeakPoint}. Total count: ${Game.damageNumbers.length}`);
    }
}

// Update damage numbers
function updateDamageNumbers(deltaTime) {
    if (!Game || !Game.damageNumbers) return;
    
    Game.damageNumbers = Game.damageNumbers.filter(number => number.update(deltaTime));
}

// Render damage numbers
function renderDamageNumbers(ctx) {
    if (!Game || !Game.damageNumbers) return;
    
    if (typeof DebugFlags !== 'undefined' && DebugFlags.DAMAGE_NUMBERS && Game.damageNumbers.length > 0) {
        console.log(`[UI] Rendering ${Game.damageNumbers.length} damage numbers`);
    }
    
    Game.damageNumbers.forEach(number => number.render(ctx));
}

// Render health bar
function renderHealthBar(ctx, player) {
    // Scale down on mobile for better space usage
    const isMobile = typeof Input !== 'undefined' && Input.isTouchMode && Input.isTouchMode();
    const mobileScale = isMobile ? 0.75 : 1.0;
    
    const barX = 30;
    const barY = 30;
    const barWidth = Math.floor(320 * mobileScale);
    const barHeight = Math.floor(36 * mobileScale);
    
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
    ctx.textBaseline = 'middle';
    ctx.shadowBlur = 3;
    ctx.shadowColor = '#000000';
    const healthText = `${Math.floor(player.hp)}/${Math.floor(player.maxHp)}`;
    ctx.fillText(healthText, barX + barWidth / 2, barY + barHeight / 2);
    ctx.shadowBlur = 0;
    ctx.textAlign = 'left'; // Reset alignment
    ctx.textBaseline = 'alphabetic'; // Reset baseline
    
    // Phoenix Down indicator (if player has the affix)
    if (player.hasPhoenixDown) {
        const pdX = barX + barWidth + 15;
        const pdY = barY + (barHeight / 2) - 18;
        const pdSize = 36;
        
        // Background circle
        const isCharged = player.phoenixDownCharges > 0;
        ctx.fillStyle = isCharged ? 'rgba(255, 170, 0, 0.3)' : 'rgba(100, 100, 100, 0.3)';
        ctx.beginPath();
        ctx.arc(pdX + pdSize / 2, pdY + pdSize / 2, pdSize / 2, 0, Math.PI * 2);
        ctx.fill();
        
        // Border
        ctx.strokeStyle = isCharged ? '#ffaa00' : '#666666';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Charge progress arc (if not fully charged)
        if (!isCharged && player.phoenixDownDamageProgress > 0) {
            const progress = player.phoenixDownDamageProgress / player.phoenixDownDamageThreshold;
            ctx.strokeStyle = '#ffcc66';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(pdX + pdSize / 2, pdY + pdSize / 2, pdSize / 2 - 2, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * progress));
            ctx.stroke();
        }
        
        // PD text
        ctx.fillStyle = isCharged ? '#ffaa00' : '#666666';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('PD', pdX + pdSize / 2, pdY + pdSize / 2);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
    }
}

// Helper function to draw a small shape indicator
function drawPlayerShapeIndicator(ctx, x, y, shape, color, size = 12) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = color;
    
    if (shape === 'triangle') {
        ctx.beginPath();
        ctx.moveTo(size, 0);
        ctx.lineTo(-size * 0.5, -size * 0.866);
        ctx.lineTo(-size * 0.5, size * 0.866);
        ctx.closePath();
        ctx.fill();
    } else if (shape === 'hexagon') {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i;
            const px = Math.cos(angle) * size;
            const py = Math.sin(angle) * size;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
    } else if (shape === 'pentagon') {
        const rotationOffset = 18 * Math.PI / 180;
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
            const angle = (Math.PI * 2 / 5) * i - Math.PI / 2 + rotationOffset;
            const px = Math.cos(angle) * size;
            const py = Math.sin(angle) * size;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
    } else {
        // Square (default)
        ctx.beginPath();
        ctx.rect(-size * 0.8, -size * 0.8, size * 1.6, size * 1.6);
        ctx.fill();
    }
    
    ctx.restore();
}

// Render health bars for other players in multiplayer
function renderOtherPlayersHealthBars(ctx) {
    // Check if in multiplayer mode
    const inMultiplayer = Game.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.lobbyCode;
    if (!inMultiplayer) return;
    
    // Get local player ID
    const localPlayerId = Game.getLocalPlayerId ? Game.getLocalPlayerId() : null;
    if (!localPlayerId) return;
    
    // Scale down on mobile for better space usage
    const isMobile = typeof Input !== 'undefined' && Input.isTouchMode && Input.isTouchMode();
    const mobileScale = isMobile ? 0.75 : 1.0;
    
    // Position below local health bar (local bar is at y=30, height=36, so start at y=80)
    const startY = 80;
    const barX = 30;
    const barWidth = Math.floor(240 * mobileScale); // Smaller than local bar
    const barHeight = Math.floor(28 * mobileScale); // Smaller than local bar
    const barSpacing = Math.floor(40 * mobileScale); // Space between bars
    const shapeSize = 12; // Size of shape indicator
    
    let currentY = startY;
    let playerCount = 0;
    
    // Get remote players based on whether we're host or client
    const isHost = multiplayerManager.isHost;
    const remotePlayerMap = isHost ? Game.remotePlayerInstances : Game.remotePlayerShadowInstances;
    
    if (!remotePlayerMap || remotePlayerMap.size === 0) return;
    
    // Iterate through remote players
    remotePlayerMap.forEach((playerInstance, playerId) => {
        // Skip local player
        if (playerId === localPlayerId) return;
        
        // Get player health from player instance (both host and client use instances)
        if (!playerInstance) return;
        
        // Get HP values from the player instance (authoritative source)
        let hp = playerInstance.hp;
        let maxHp = playerInstance.maxHp;
        let dead = playerInstance.dead || false;
        
        // Fallback to remotePlayerStates if instance doesn't have HP (shouldn't happen, but safety)
        if ((hp === undefined || hp === null) && isHost && Game.remotePlayerStates) {
            const state = Game.remotePlayerStates.get(playerId);
            if (state) {
                hp = state.hp;
                maxHp = state.maxHp;
                dead = state.dead || false;
            }
        }
        
        // Default values if still undefined
        if (hp === undefined || hp === null) hp = 0;
        if (maxHp === undefined || maxHp === null) maxHp = 100;
        
        // Skip if no valid health data
        if (maxHp <= 0) return;
        
        // Get player class
        const meta = typeof getRemotePlayerMeta !== 'undefined' ? getRemotePlayerMeta(playerId) : null;
        const classKey = playerInstance.playerClass || (meta ? meta.class : null) || 'square';
        
        // Get class definition for shape and color
        let playerShape = 'square';
        let playerColor = '#888888';
        if (typeof CLASS_DEFINITIONS !== 'undefined') {
            const classDef = CLASS_DEFINITIONS[classKey] || CLASS_DEFINITIONS.square;
            playerShape = classDef.shape || 'square';
            playerColor = classDef.color || '#888888';
        }
        
        // Calculate alpha for dead players
        const alpha = dead ? 0.5 : 1.0;
        
        // Shape indicator position (left of health bar)
        const shapeX = barX - shapeSize - 8;
        const shapeY = currentY + barHeight / 2;
        
        // Panel background
        ctx.save();
        ctx.globalAlpha = alpha;
        
        const panelGradient = ctx.createLinearGradient(barX - 8, currentY - 8, barX - 8, currentY + barHeight + 8);
        panelGradient.addColorStop(0, 'rgba(20, 20, 30, 0.85)');
        panelGradient.addColorStop(1, 'rgba(10, 10, 20, 0.85)');
        ctx.fillStyle = panelGradient;
        ctx.fillRect(barX - 8, currentY - 8, barWidth + 16, barHeight + 16);
        
        // Panel border
        ctx.strokeStyle = 'rgba(100, 150, 255, 0.4)';
        ctx.lineWidth = 2;
        ctx.strokeRect(barX - 8, currentY - 8, barWidth + 16, barHeight + 16);
        
        // Background with gradient
        const bgGradient = ctx.createLinearGradient(barX, currentY, barX, currentY + barHeight);
        bgGradient.addColorStop(0, '#2a1a1a');
        bgGradient.addColorStop(1, '#1a0a0a');
        ctx.fillStyle = bgGradient;
        ctx.fillRect(barX, currentY, barWidth, barHeight);
        
        // Draw foreground (green/orange/red) scaled by HP/maxHP with gradient
        const hpPercent = Math.max(0, Math.min(1, hp / maxHp));
        const hpGradient = ctx.createLinearGradient(barX, currentY, barX, currentY + barHeight);
        
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
        ctx.fillRect(barX + 2, currentY + 2, (barWidth - 4) * hpPercent, barHeight - 4);
        
        // Inner highlight
        if (hpPercent > 0) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.fillRect(barX + 2, currentY + 2, (barWidth - 4) * hpPercent, (barHeight - 4) * 0.4);
        }
        
        // Draw border
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(barX, currentY, barWidth, barHeight);
        
        // Draw text centered on bar with shadow
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.floor(14 * mobileScale)}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowBlur = 3;
        ctx.shadowColor = '#000000';
        const healthText = `${Math.floor(hp)}/${Math.floor(maxHp)}`;
        ctx.fillText(healthText, barX + barWidth / 2, currentY + barHeight / 2);
        ctx.shadowBlur = 0;
        ctx.textAlign = 'left'; // Reset alignment
        ctx.textBaseline = 'alphabetic'; // Reset baseline
        
        ctx.restore();
        
        // Draw shape indicator (outside the alpha save/restore so it's always visible)
        ctx.save();
        ctx.globalAlpha = alpha;
        drawPlayerShapeIndicator(ctx, shapeX, shapeY, playerShape, playerColor, shapeSize);
        ctx.restore();
        
        // Move to next position
        currentY += barHeight + barSpacing;
        playerCount++;
    });
}

// Render XP bar
function renderXPBar(ctx, player) {
    const canvasWidth = Game ? Game.config.width : 1280;
    const canvasHeight = Game ? Game.config.height : 720;
    
    // Scale down on mobile
    const isMobile = typeof Input !== 'undefined' && Input.isTouchMode && Input.isTouchMode();
    const mobileScale = isMobile ? 0.70 : 1.0;
    
    const maxBarWidth = Math.floor(1200 * mobileScale);
    const barWidth = Math.min(maxBarWidth, canvasWidth - 80);
    const barX = (canvasWidth - barWidth) / 2; // Center the bar
    const bottomMargin = isMobile ? 35 : 55;
    const barY = canvasHeight - bottomMargin;
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

// Render solo death screen (for solo mode or when all players dead)
function renderSoloDeathScreen(ctx, player) {
    // Initialize death screen start time if not set
    if (Game.deathScreenStartTime === 0) {
        Game.deathScreenStartTime = Date.now();
    }
    
    // Calculate time since death screen appeared
    const timeSinceDeath = (Date.now() - (Game.deathScreenStartTime || Date.now())) / 1000;
    const inputDelay = 3.0; // 3 second delay before allowing input
    const canAcceptInput = timeSinceDeath >= inputDelay;
    
    // Calculate time played
    const timePlayed = ((Game.endTime - Game.startTime) / 1000).toFixed(1);
    const minutes = Math.floor(timePlayed / 60);
    const seconds = (timePlayed % 60).toFixed(1);
    
    // Calculate currency breakdown
    const roomsCleared = Math.max(0, Game.roomNumber - 1);
    const enemiesKilled = Game.enemiesKilled || 0;
    const levelReached = player.level || 1;
    
    const baseCurrency = Math.floor(9 * roomsCleared); // Reduced from 10
    const bonusCurrency = Math.floor(1.8 * enemiesKilled); // Reduced from 2
    const levelCurrency = Math.floor(0.9 * levelReached); // Reduced from 1
    const totalEarned = baseCurrency + bonusCurrency + levelCurrency;
    
    // Dark overlay
    const canvasWidth = Game ? Game.config.width : 1280;
    const canvasHeight = Game ? Game.config.height : 720;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;
    
    // Scale fonts based on screen height
    const scale = Math.min(canvasHeight / 720, 1.5); // Scale up to 1.5x max
    
    // Title
    ctx.fillStyle = '#ff0000';
    ctx.font = `bold ${Math.floor(60 * scale)}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', centerX, centerY - 280 * scale);
    
    // Stats
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.floor(24 * scale)}px Arial`;
    
    const stats = [
        `Level Reached: ${levelReached}`,
        `Rooms Cleared: ${roomsCleared}`,
        `Enemies Killed: ${enemiesKilled}`,
        `Time Played: ${minutes}:${seconds}`
    ];
    
    stats.forEach((stat, index) => {
        ctx.fillText(stat, centerX, centerY - 200 * scale + (index * 35 * scale));
    });
    
    // Currency breakdown
    ctx.font = `bold ${Math.floor(20 * scale)}px Arial`;
    ctx.fillStyle = '#ffff00';
    ctx.fillText('Currency Earned:', centerX, centerY - 30 * scale);
    
    ctx.font = `${Math.floor(18 * scale)}px Arial`;
    ctx.fillStyle = '#cccccc';
    ctx.textAlign = 'left';
    
    const currencyBreakdown = [
        `Rooms: 9 × ${roomsCleared} = ${baseCurrency}`,
        `Enemies: 1.8 × ${enemiesKilled} = ${bonusCurrency}`,
        `Level: 0.9 × ${levelReached} = ${levelCurrency}`
    ];
    
    currencyBreakdown.forEach((line, index) => {
        ctx.fillText(line, centerX - 200 * scale, centerY + (index * 25 * scale));
    });
    
    ctx.textAlign = 'center';
    ctx.fillStyle = '#00ff00';
    ctx.font = `bold ${Math.floor(22 * scale)}px Arial`;
    ctx.fillText(`Total Earned: ${totalEarned}`, centerX, centerY + 90 * scale);
    
    // Current total currency
    const currentTotal = typeof SaveSystem !== 'undefined' ? Math.floor(SaveSystem.getCurrency()) : 0;
    ctx.fillStyle = '#ffff00';
    ctx.font = `bold ${Math.floor(20 * scale)}px Arial`;
    ctx.fillText(`Total Currency: ${currentTotal}`, centerX, centerY + 130 * scale);
    
    // Instructions (with input delay)
    if (!canAcceptInput) {
        // Show countdown during delay
        const timeRemaining = Math.ceil(inputDelay - timeSinceDeath);
        ctx.font = `bold ${Math.floor(28 * scale)}px Arial`;
        ctx.fillStyle = '#ff8888';
        ctx.fillText(`Wait ${timeRemaining}...`, centerX, centerY + 220 * scale);
    } else {
        // Show normal instructions after delay
        ctx.font = `bold ${Math.floor(24 * scale)}px Arial`;
        ctx.fillStyle = '#ffff00';
        ctx.fillText('Press R to Restart', centerX, centerY + 200 * scale);
        ctx.fillStyle = '#00ffff';
        ctx.font = `bold ${Math.floor(20 * scale)}px Arial`;
        ctx.fillText('Press M or Click to Continue to Nexus', centerX, centerY + 240 * scale);
    }
}

// Render individual death screen (multiplayer - when player dies)
function renderIndividualDeathScreen(ctx, player, playerId) {
    const canvasWidth = Game ? Game.config.width : 1280;
    const canvasHeight = Game ? Game.config.height : 720;
    
    // Get player stats
    const stats = Game.getPlayerStats ? Game.getPlayerStats(playerId) : null;
    if (!stats) {
        renderSoloDeathScreen(ctx, player);
        return;
    }
    
    // Semi-transparent overlay (can see through if spectating)
    const alpha = Game.spectateMode ? 0.3 : 0.85;
    ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;
    
    // Scale fonts based on screen height
    const scale = Math.min(canvasHeight / 720, 1.5);
    
    // Title
    ctx.fillStyle = '#ff6666';
    ctx.font = `bold ${Math.floor(48 * scale)}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText('YOU DIED', centerX, centerY - 200 * scale);
    
    // Your Stats
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.floor(28 * scale)}px Arial`;
    ctx.fillText('Your Stats', centerX, centerY - 140 * scale);
    
    // Stats table
    ctx.font = `${Math.floor(20 * scale)}px Arial`;
    const statLines = [
        `Damage Dealt: ${Math.floor(stats.damageDealt)}`,
        `Kills: ${stats.kills}`,
        `Damage Taken: ${Math.floor(stats.damageTaken)}`,
        `Rooms Cleared: ${Game.roomNumber - 1}`,
        `Time Alive: ${formatTime(stats.getTimeAlive())}`
    ];
    
    statLines.forEach((line, index) => {
        ctx.fillText(line, centerX, centerY - 90 * scale + (index * 30 * scale));
    });
    
    // Instructions
    if (!Game.spectateMode) {
        ctx.fillStyle = '#ffff00';
        ctx.font = `bold ${Math.floor(20 * scale)}px Arial`;
        ctx.fillText('Press SPACE to spectate', centerX, centerY + 100 * scale);
    } else {
        ctx.fillStyle = '#00ff00';
        ctx.font = `bold ${Math.floor(18 * scale)}px Arial`;
        ctx.fillText('SPECTATING - Press SPACE to show stats', centerX, centerY + 100 * scale);
    }
}

// Render collective death screen (multiplayer - when all players die)
function renderCollectiveDeathScreen(ctx, player) {
    const canvasWidth = Game ? Game.config.width : 1280;
    const canvasHeight = Game ? Game.config.height : 720;
    
    // Track death screen start time
    if (!Game.deathScreenStartTime) {
        Game.deathScreenStartTime = Date.now();
    }
    
    // Calculate time since death screen appeared
    const timeSinceDeath = (Date.now() - (Game.deathScreenStartTime || Date.now())) / 1000;
    const inputDelay = 3.0; // 3 second delay before allowing input
    const canAcceptInput = timeSinceDeath >= inputDelay;
    
    // Dark overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;
    
    // Scale fonts and layout based on screen size
    const scale = Math.min(canvasHeight / 720, canvasWidth / 1280, 1.5);
    
    // Title
    ctx.fillStyle = '#ff0000';
    ctx.font = `bold ${Math.floor(52 * scale)}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER - Final Scores', centerX, centerY - 260 * scale);
    
    // Get all player stats in lobby join order
    // Clients use finalStats from host (authoritative), host uses local playerStats
    const allStats = [];
    const isClient = Game.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager && !multiplayerManager.isHost;
    
    if (isClient && Game.finalStats) {
        // Client: Use final stats from host (authoritative)
        console.log('[Death Screen] Client using finalStats from host');
        if (typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.players) {
            multiplayerManager.players.forEach(player => {
                const statsData = Game.finalStats[player.id];
                if (statsData) {
                    allStats.push({ 
                        playerId: player.id, 
                        stats: {
                            damageDealt: statsData.damageDealt,
                            kills: statsData.kills,
                            damageTaken: statsData.damageTaken,
                            getTimeAlive: () => statsData.timeAlive
                        },
                        roomsCleared: statsData.roomsCleared
                    });
                }
            });
        }
    } else if (Game.playerStats) {
        // Host or solo: Use local playerStats
        console.log('[Death Screen] Using local playerStats');
        // Use lobby player order if available (maintains consistent ordering)
        if (typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.players) {
            multiplayerManager.players.forEach(player => {
                const stats = Game.playerStats.get(player.id);
                if (stats) {
                    allStats.push({ playerId: player.id, stats: stats });
                }
            });
        } else {
            // Fallback: use map iteration order
            Game.playerStats.forEach((stats, playerId) => {
                allStats.push({ playerId, stats });
            });
        }
    }
    
    console.log(`[Death Screen] Showing ${allStats.length} players:`, allStats.map(s => s.playerId));
    console.log(`[Death Screen] Local player ID:`, Game.getLocalPlayerId ? Game.getLocalPlayerId() : 'unknown');
    console.log(`[Death Screen] Lobby players:`, multiplayerManager && multiplayerManager.players ? multiplayerManager.players.map(p => p.id) : 'none');
    
    // Calculate table dimensions (scaled)
    const columns = ['Player', 'Damage', 'Kills', 'Dmg Taken', 'Rooms', 'Time'];
    const colWidth = 110 * scale;
    const rowHeight = 35 * scale;
    const tableWidth = colWidth * columns.length;
    const tableX = centerX - tableWidth / 2;
    const tableY = centerY - 150 * scale;
    
    // Draw table header
    ctx.fillStyle = '#444444';
    ctx.fillRect(tableX, tableY, tableWidth, rowHeight);
    
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.floor(16 * scale)}px Arial`;
    ctx.textAlign = 'center';
    columns.forEach((col, i) => {
        ctx.fillText(col, tableX + (i + 0.5) * colWidth, tableY + 22 * scale);
    });
    
    // Draw table rows
    allStats.forEach((entry, index) => {
        const rowY = tableY + (index + 1) * rowHeight;
        const stats = entry.stats;
        
        // Alternate row colors
        ctx.fillStyle = index % 2 === 0 ? '#222222' : '#333333';
        ctx.fillRect(tableX, rowY, tableWidth, rowHeight);
        
        // Player number
        const playerNum = index + 1;
        const localPlayerId = Game.getLocalPlayerId ? Game.getLocalPlayerId() : null;
        const isLocalPlayer = entry.playerId === localPlayerId;
        
        ctx.fillStyle = isLocalPlayer ? '#ffff00' : '#ffffff';
        ctx.font = isLocalPlayer ? `bold ${Math.floor(16 * scale)}px Arial` : `${Math.floor(16 * scale)}px Arial`;
        ctx.textAlign = 'center';
        
        // Draw cell values (use roomsCleared if available from finalStats)
        const roomsCleared = entry.roomsCleared !== undefined ? entry.roomsCleared : (Game.roomNumber - 1);
        const values = [
            `Player ${playerNum}${isLocalPlayer ? ' (You)' : ''}`,
            Math.floor(stats.damageDealt).toString(),
            stats.kills.toString(),
            Math.floor(stats.damageTaken).toString(),
            roomsCleared.toString(),
            formatTime(stats.getTimeAlive ? stats.getTimeAlive() : 0)
        ];
        
        values.forEach((val, i) => {
            ctx.fillText(val, tableX + (i + 0.5) * colWidth, rowY + 22 * scale);
        });
    });
    
    // Draw table border
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2 * scale;
    ctx.strokeRect(tableX, tableY, tableWidth, rowHeight * (allStats.length + 1));
    
    // Instructions (with input delay)
    const isHost = typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.isHost;
    
    if (!canAcceptInput) {
        // Show countdown during delay
        const timeRemaining = Math.ceil(inputDelay - timeSinceDeath);
        ctx.font = `bold ${Math.floor(28 * scale)}px Arial`;
        ctx.fillStyle = '#ff8888';
        ctx.fillText(`Wait ${timeRemaining}...`, centerX, centerY + 200 * scale);
    } else if (isHost) {
        ctx.fillStyle = '#00ff00';
        ctx.font = `bold ${Math.floor(24 * scale)}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText('Press M to Return to Nexus', centerX, centerY + 200 * scale);
    } else {
        ctx.fillStyle = '#ffaa00';
        ctx.font = `bold ${Math.floor(20 * scale)}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText('Waiting for host...', centerX, centerY + 200 * scale);
    }
}

// Main death screen dispatcher
function renderDeathScreen(ctx, player) {
    // Check if in multiplayer mode
    const inMultiplayer = Game.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.lobbyCode;
    
    if (!inMultiplayer) {
        // Solo mode - use original death screen
        renderSoloDeathScreen(ctx, player);
    } else if (Game.allPlayersDead) {
        // All players dead - show collective screen
        renderCollectiveDeathScreen(ctx, player);
    } else {
        // Individual player dead - show individual screen
        const playerId = Game.getLocalPlayerId ? Game.getLocalPlayerId() : 'local';
        renderIndividualDeathScreen(ctx, player, playerId);
    }
}

// Helper function to format time
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Character sheet state
const CharacterSheet = {
    isOpen: false,
    lastIKey: false,
    lastTabKey: false,
    scrollOffset: 0,
    maxScroll: 0,
    contentHeight: 0,
    modalBounds: null,
    lastTouchY: null,
    scrollVelocity: 0
};

// Handle character sheet scroll input
function handleCharacterSheetScroll(x, y, deltaY) {
    if (!CharacterSheet.isOpen || !CharacterSheet.modalBounds) return false;
    
    const bounds = CharacterSheet.modalBounds;
    
    // Check if touch/click is within scrollable area
    if (x >= bounds.x && x <= bounds.x + bounds.width &&
        y >= bounds.scrollableTop && y <= bounds.scrollableTop + bounds.scrollableHeight) {
        
        // Apply scroll delta
        if (deltaY !== undefined && deltaY !== 0) {
            CharacterSheet.scrollOffset += deltaY;
            CharacterSheet.scrollOffset = Math.max(0, Math.min(CharacterSheet.scrollOffset, CharacterSheet.maxScroll));
            return true;
        }
    }
    
    return false;
}

// Convert world coordinates to screen coordinates (accounting for camera and zoom)
function worldToScreen(worldX, worldY) {
    // Get current zoom level (desktop only)
    const isMobile = typeof Input !== 'undefined' && Input.isTouchMode && Input.isTouchMode();
    const zoom = isMobile ? 1.0 : (typeof Game !== 'undefined' && Game.baseZoom ? Game.baseZoom : 1.1);
    
    if (typeof Game !== 'undefined' && Game.camera && Game.state === 'PLAYING') {
        const centerX = Game.config.width / 2;
        const centerY = Game.config.height / 2;
        
        // Apply zoom to world-to-screen conversion
        const worldDeltaX = (worldX - Game.camera.x) * zoom;
        const worldDeltaY = (worldY - Game.camera.y) * zoom;
        
        return {
            x: centerX + worldDeltaX,
            y: centerY + worldDeltaY
        };
    }
    
    if (typeof Game !== 'undefined' && Game.nexusCamera && Game.state === 'NEXUS') {
        const centerX = Game.config.width / 2;
        const centerY = Game.config.height / 2;
        
        // Apply zoom to world-to-screen conversion
        const worldDeltaX = (worldX - Game.nexusCamera.x) * zoom;
        const worldDeltaY = (worldY - Game.nexusCamera.y) * zoom;
        
        return {
            x: centerX + worldDeltaX,
            y: centerY + worldDeltaY
        };
    }
    
    // No camera - world coords are screen coords
    return { x: worldX, y: worldY };
}

// Check if enemy is within viewport (visible on screen)
function isEnemyInViewport(enemy, camera, zoom, canvasWidth, canvasHeight) {
    if (!enemy || !camera) return false;
    
    // Calculate visible world space bounds
    const halfVisibleWorldW = (canvasWidth / 2) / zoom;
    const halfVisibleWorldH = (canvasHeight / 2) / zoom;
    
    // Get viewport bounds in world coordinates
    const viewportLeft = camera.x - halfVisibleWorldW;
    const viewportRight = camera.x + halfVisibleWorldW;
    const viewportTop = camera.y - halfVisibleWorldH;
    const viewportBottom = camera.y + halfVisibleWorldH;
    
    // Check if enemy is within bounds (with some padding for size)
    const padding = enemy.size || 20;
    return (
        enemy.x + padding >= viewportLeft &&
        enemy.x - padding <= viewportRight &&
        enemy.y + padding >= viewportTop &&
        enemy.y - padding <= viewportBottom
    );
}

// Calculate arrow position and angle for off-screen enemy indicator
function calculateEnemyArrowPosition(enemy, player, camera, zoom, canvasWidth, canvasHeight) {
    if (!enemy || !player || !camera) return null;
    
    // Convert player position to screen coordinates
    const playerScreen = worldToScreen(player.x, player.y);
    
    // Get direction from player to enemy (in world space)
    const dx = enemy.x - player.x;
    const dy = enemy.y - player.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance === 0) return null;
    
    // Normalize direction
    const dirX = dx / distance;
    const dirY = dy / distance;
    
    // Calculate angle for arrow rotation
    const angle = Math.atan2(dy, dx);
    
    // Find intersection with screen edges
    // We'll cast a ray from player center toward enemy and find where it hits screen edge
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;
    
    // Calculate how far to extend the ray to hit screen edge
    let tX = Infinity;
    let tY = Infinity;
    
    if (dirX !== 0) {
        const tLeft = (0 - centerX - (playerScreen.x - centerX)) / (dirX * zoom);
        const tRight = (canvasWidth - centerX - (playerScreen.x - centerX)) / (dirX * zoom);
        tX = dirX > 0 ? tRight : tLeft;
    }
    
    if (dirY !== 0) {
        const tTop = (0 - centerY - (playerScreen.y - centerY)) / (dirY * zoom);
        const tBottom = (canvasHeight - centerY - (playerScreen.y - centerY)) / (dirY * zoom);
        tY = dirY > 0 ? tBottom : tTop;
    }
    
    // Use the smaller t value (first intersection)
    const t = Math.min(Math.abs(tX), Math.abs(tY));
    
    // Calculate edge intersection point in screen space
    const edgeX = playerScreen.x + dirX * t * zoom;
    const edgeY = playerScreen.y + dirY * t * zoom;
    
    // Position arrow at midpoint between edge and player center
    const arrowX = (edgeX + centerX) / 2;
    const arrowY = (edgeY + centerY) / 2;
    
    // Add some margin from edges to account for UI elements
    const margin = 60; // pixels from edge
    const clampedX = Math.max(margin, Math.min(canvasWidth - margin, arrowX));
    const clampedY = Math.max(margin, Math.min(canvasHeight - margin, arrowY));
    
    return {
        x: clampedX,
        y: clampedY,
        angle: angle
    };
}

// Render directional arrows pointing to off-screen enemies (when 5 or fewer remain)
function renderEnemyDirectionArrows(ctx, player) {
    if (!player) return;
    
    // Check if we're in playing state
    if (typeof Game === 'undefined' || Game.state !== 'PLAYING') return;
    
    // Determine the reference player for arrow positioning
    // In multiplayer spectate mode, use the spectated player
    let referencePlayer = player;
    const inMultiplayer = Game.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.lobbyCode;
    
    if (inMultiplayer && player.dead && Game.spectateMode) {
        // Local player is dead and spectating - find the spectated player
        if (Game.spectatedPlayerId) {
            // Try to find spectated player from remotePlayerInstances
            if (Game.remotePlayerInstances && Game.remotePlayerInstances.has(Game.spectatedPlayerId)) {
                referencePlayer = Game.remotePlayerInstances.get(Game.spectatedPlayerId);
            } 
            // Or from remotePlayers array
            else if (Game.remotePlayers && Game.remotePlayers.length > 0) {
                const spectated = Game.remotePlayers.find(rp => rp.id === Game.spectatedPlayerId);
                if (spectated) {
                    referencePlayer = spectated;
                }
            }
        }
    }
    
    // If no valid reference player, don't show arrows
    if (!referencePlayer || !referencePlayer.alive) return;
    
    // Get enemy list based on multiplayer state
    let enemies = [];
    
    if (inMultiplayer && Game.enemies) {
        enemies = Game.enemies.filter(e => e.alive);
    } else if (typeof currentRoom !== 'undefined' && currentRoom && currentRoom.enemies) {
        enemies = currentRoom.enemies.filter(e => e.alive);
    }
    
    // Only show arrows when 5 or fewer enemies remain
    if (enemies.length === 0 || enemies.length > 5) return;
    
    // Get camera and viewport info
    const camera = Game.camera;
    if (!camera) return;
    
    const isMobile = typeof Input !== 'undefined' && Input.isTouchMode && Input.isTouchMode();
    const zoom = isMobile ? 1.0 : (Game.baseZoom || 1.1);
    const canvasWidth = Game.config.width;
    const canvasHeight = Game.config.height;
    
    // Render arrows for each off-screen enemy
    enemies.forEach(enemy => {
        // Check if enemy is off-screen
        if (isEnemyInViewport(enemy, camera, zoom, canvasWidth, canvasHeight)) {
            return; // Enemy is visible, skip
        }
        
        // Calculate arrow position using the reference player (local or spectated)
        const arrowData = calculateEnemyArrowPosition(enemy, referencePlayer, camera, zoom, canvasWidth, canvasHeight);
        if (!arrowData) return;
        
        // Render the arrow
        ctx.save();
        ctx.translate(arrowData.x, arrowData.y);
        ctx.rotate(arrowData.angle);
        
        // Draw white arrow/caret pointing toward enemy
        const arrowSize = 10;
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        
        // Draw arrow as a triangle pointing right (will be rotated)
        ctx.beginPath();
        ctx.moveTo(arrowSize, 0); // Tip
        ctx.lineTo(-arrowSize / 2, -arrowSize);
        ctx.lineTo(-arrowSize / 2, arrowSize);
        ctx.closePath();
        
        // Draw outline first (black stroke)
        ctx.stroke();
        // Then fill with white
        ctx.fill();
        
        ctx.restore();
    });
}

// Render directional arrow pointing to the exit door when it is open and off-screen
function renderDoorDirectionArrow(ctx, player) {
    if (!player) return;
    
    if (typeof Game === 'undefined' || Game.state !== 'PLAYING') return;
    if (typeof currentRoom === 'undefined' || !currentRoom || !currentRoom.doorOpen) return;
    
    const inMultiplayer = Game.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.lobbyCode;
    
    let referencePlayer = player;
    if (inMultiplayer && player.dead && Game.spectateMode) {
        if (Game.spectatedPlayerId) {
            if (Game.remotePlayerInstances && Game.remotePlayerInstances.has(Game.spectatedPlayerId)) {
                referencePlayer = Game.remotePlayerInstances.get(Game.spectatedPlayerId);
            } else if (Game.remotePlayers && Game.remotePlayers.length > 0) {
                const spectated = Game.remotePlayers.find(rp => rp.id === Game.spectatedPlayerId);
                if (spectated) {
                    referencePlayer = spectated;
                }
            }
        }
    }
    
    if (!referencePlayer || !referencePlayer.alive) return;
    
    const camera = Game.camera;
    if (!camera || !Game.config) return;
    
    const isMobile = typeof Input !== 'undefined' && Input.isTouchMode && Input.isTouchMode();
    const zoom = isMobile ? 1.0 : (Game.baseZoom || 1.1);
    const canvasWidth = Game.config.width;
    const canvasHeight = Game.config.height;
    
    const doorRect = getDoorPosition();
    if (!doorRect) return;
    
    const doorTarget = {
        x: doorRect.x + doorRect.width / 2,
        y: doorRect.y + doorRect.height / 2,
        size: Math.max(doorRect.width, doorRect.height) / 2
    };
    
    if (isEnemyInViewport(doorTarget, camera, zoom, canvasWidth, canvasHeight)) {
        return;
    }
    
    const arrowData = calculateEnemyArrowPosition(doorTarget, referencePlayer, camera, zoom, canvasWidth, canvasHeight);
    if (!arrowData) return;
    
    ctx.save();
    ctx.translate(arrowData.x, arrowData.y);
    ctx.rotate(arrowData.angle);
    
    const arrowSize = 10;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    
    ctx.beginPath();
    ctx.moveTo(arrowSize, 0);
    ctx.lineTo(-arrowSize / 2, -arrowSize);
    ctx.lineTo(-arrowSize / 2, arrowSize);
    ctx.closePath();
    
    ctx.stroke();
    ctx.fill();
    
    ctx.restore();
}

// Render gear tooltip when near gear
function renderGearTooltips(ctx, player) {
    if (!player || !player.alive || typeof groundLoot === 'undefined') return;
    
    // Update nearby items list
    LootSelection.updateNearbyItems(player);
    const selectedGear = LootSelection.getSelectedGear();
    const nearbyCount = LootSelection.getCount();
    
    // Only show tooltip for selected gear (or if only one nearby)
    if (!selectedGear) return;
    
    const gear = selectedGear;
    const dx = gear.x - player.x;
    const dy = gear.y - player.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Show tooltip within range
    if (distance < 50) {
            // Check if any enemy is within 150px of the gear
            // If so, don't show tooltip to avoid obstructing combat
            
            // Get enemy list based on multiplayer vs solo mode
            let enemies = [];
            if (typeof Game !== 'undefined') {
                const inMultiplayer = Game.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.lobbyCode;
                
                if (inMultiplayer && Game.enemies) {
                    enemies = Game.enemies.filter(e => e.alive);
                } else if (typeof currentRoom !== 'undefined' && currentRoom && currentRoom.enemies) {
                    enemies = currentRoom.enemies.filter(e => e.alive);
                }
            }
            
            // Check if any enemy is too close to the gear
            const enemyTooClose = enemies.some(enemy => {
                const edx = enemy.x - gear.x;
                const edy = enemy.y - gear.y;
                const enemyDistance = Math.sqrt(edx * edx + edy * edy);
                return enemyDistance < 150;
            });
            
            if (enemyTooClose) {
                return; // Don't show tooltip when enemies are nearby
            }
            
            // Convert gear world position to screen position
            const screenPos = worldToScreen(gear.x, gear.y);
            const tooltipX = screenPos.x;
            let tooltipY = screenPos.y - gear.size - 50;
            
            // Build tooltip content - TWO COLUMNS (current vs new)
            const leftLines = [];  // Current gear
            const rightLines = []; // New gear
            
            // Get currently equipped gear in same slot
            const currentGear = player.getEquippedGear(gear.slot);
            
            // === LEFT COLUMN: CURRENT GEAR ===
            if (currentGear) {
                let currentTitle = `CURRENT ${gear.slot.toUpperCase()}`;
                if (currentGear.weaponType && typeof WEAPON_TYPES !== 'undefined') {
                    currentTitle = `${WEAPON_TYPES[currentGear.weaponType].name}`;
                }
                if (currentGear.armorType && typeof ARMOR_TYPES !== 'undefined') {
                    currentTitle = `${ARMOR_TYPES[currentGear.armorType].name}`;
                }
                leftLines.push({ text: currentTitle, color: currentGear.color, font: 'bold 14px Arial' });
                
                if (currentGear.stats.damage) {
                    leftLines.push({ text: `+${currentGear.stats.damage.toFixed(1)} Dmg`, color: '#ff8888', font: '12px Arial' });
                }
                if (currentGear.stats.defense) {
                    leftLines.push({ text: `+${(currentGear.stats.defense * 100).toFixed(1)}% Def`, color: '#88aaff', font: '12px Arial' });
                }
                if (currentGear.stats.speed) {
                    leftLines.push({ text: `+${(currentGear.stats.speed * 100).toFixed(0)}% Spd`, color: '#88ff88', font: '12px Arial' });
                }
                
                const affixCount = (currentGear.affixes && currentGear.affixes.length) || 0;
                if (affixCount > 0) {
                    leftLines.push({ text: `${affixCount} affixes`, color: '#aaddff', font: '11px Arial' });
                    // Show first 3 affixes for current gear too
                    for (let i = 0; i < Math.min(3, currentGear.affixes.length); i++) {
                        const affix = currentGear.affixes[i];
                        let displayValue, displayName;
                        
                        const isIntegerAffix = ['dodgeCharges', 'maxHealth', 'pierce', 'chainLightning', 'multishot'].includes(affix.type);
                        if (isIntegerAffix) {
                            displayValue = `+${affix.value.toFixed(0)}`;
                            const nameMap = {
                                pierce: 'Pierce',
                                chainLightning: 'Chain',
                                multishot: 'Multishot'
                            };
                            displayName = nameMap[affix.type] || affix.type.replace(/([A-Z])/g, ' $1').trim();
                        } else if (affix.type === 'critDamage') {
                            displayValue = `+${(affix.value * 100).toFixed(0)}%`;
                            displayName = 'Crit Dmg Bonus';
                        } else {
                            displayValue = `+${(affix.value * 100).toFixed(0)}%`;
                            displayName = affix.type.replace(/([A-Z])/g, ' $1').trim();
                        }
                        
                        leftLines.push({ text: `  ${displayName}: ${displayValue}`, color: '#aaddff', font: '11px Arial' });
                    }
                }
            } else {
                leftLines.push({ text: 'NONE EQUIPPED', color: '#888888', font: 'bold 14px Arial' });
            }
            
            // === RIGHT COLUMN: NEW GEAR ===
            let newTitle = `${gear.tier.toUpperCase()} ${gear.slot.toUpperCase()}`;
            if (gear.weaponType && typeof WEAPON_TYPES !== 'undefined') {
                newTitle = `${WEAPON_TYPES[gear.weaponType].name}`;
            }
            if (gear.armorType && typeof ARMOR_TYPES !== 'undefined') {
                newTitle = `${ARMOR_TYPES[gear.armorType].name}`;
            }
            rightLines.push({ text: newTitle, color: gear.color, font: 'bold 14px Arial' });
            
            if (gear.name) {
                rightLines.push({ text: gear.name, color: '#ffffff', font: '12px Arial' });
            }
            
            if (gear.stats.damage) {
                rightLines.push({ text: `+${gear.stats.damage.toFixed(1)} Dmg`, color: '#ff8888', font: '12px Arial' });
            }
            if (gear.stats.defense) {
                rightLines.push({ text: `+${(gear.stats.defense * 100).toFixed(1)}% Def`, color: '#88aaff', font: '12px Arial' });
            }
            if (gear.stats.speed) {
                rightLines.push({ text: `+${(gear.stats.speed * 100).toFixed(0)}% Spd`, color: '#88ff88', font: '12px Arial' });
            }
            
            const newAffixCount = (gear.affixes && gear.affixes.length) || 0;
            if (newAffixCount > 0) {
                rightLines.push({ text: `${newAffixCount} affixes`, color: '#aaddff', font: '11px Arial' });
                // Show first 3 affixes
                for (let i = 0; i < Math.min(3, gear.affixes.length); i++) {
                    const affix = gear.affixes[i];
                    let displayValue, displayName;
                    
                    const isIntegerAffix = ['dodgeCharges', 'maxHealth', 'pierce', 'chainLightning', 'multishot'].includes(affix.type);
                    if (isIntegerAffix) {
                        displayValue = `+${affix.value.toFixed(0)}`;
                        const nameMap = {
                            pierce: 'Pierce',
                            chainLightning: 'Chain',
                            multishot: 'Multishot'
                        };
                        displayName = nameMap[affix.type] || affix.type.replace(/([A-Z])/g, ' $1').trim();
                    } else if (affix.type === 'critDamage') {
                        displayValue = `+${(affix.value * 100).toFixed(0)}%`;
                        displayName = 'Crit Dmg Bonus';
                    } else {
                        displayValue = `+${(affix.value * 100).toFixed(0)}%`;
                        displayName = affix.type.replace(/([A-Z])/g, ' $1').trim();
                    }
                    
                    rightLines.push({ text: `  ${displayName}: ${displayValue}`, color: '#aaddff', font: '11px Arial' });
                }
            }
            
            if (gear.classModifier) {
                const classIcon = gear.classModifier.class === 'universal' ? '[All]' : `[${gear.classModifier.class}]`;
                rightLines.push({ text: `${classIcon} ${gear.classModifier.description}`, color: '#ffaa00', font: 'bold 11px Arial' });
            }
            
            if (gear.legendaryEffect) {
                rightLines.push({ text: '[LEGENDARY]', color: '#ff9800', font: 'bold 12px Arial' });
                rightLines.push({ text: gear.legendaryEffect.description, color: '#ff9800', font: '11px Arial' });
            }
            
            // Calculate tooltip size
            const lineHeight = 16;
            const columnWidth = 150;
            const tooltipWidth = columnWidth * 2 + 20; // Two columns + padding
            const maxLines = Math.max(leftLines.length, rightLines.length) + 1; // +1 for column label row
            const tooltipHeight = Math.max(120, maxLines * lineHeight + 50);
            
            // Adjust position to stay on screen
            if (tooltipY - tooltipHeight / 2 < 10) {
                tooltipY = tooltipHeight / 2 + 10;
            }
            
            // Draw tooltip background
            ctx.fillStyle = 'rgba(0, 0, 0, 0.95)';
            ctx.fillRect(tooltipX - tooltipWidth / 2, tooltipY - tooltipHeight / 2, tooltipWidth, tooltipHeight);
            
            // Draw border (color based on tier)
            ctx.strokeStyle = gear.color;
            ctx.lineWidth = 3;
            ctx.strokeRect(tooltipX - tooltipWidth / 2, tooltipY - tooltipHeight / 2, tooltipWidth, tooltipHeight);
            
            // Draw divider line
            ctx.strokeStyle = '#555555';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(tooltipX, tooltipY - tooltipHeight / 2 + 5);
            ctx.lineTo(tooltipX, tooltipY + tooltipHeight / 2 - 30);
            ctx.stroke();
            
            // Draw column labels
            const headerY = tooltipY - tooltipHeight / 2 + 16;
            ctx.fillStyle = '#ffffaa';
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Equipped', tooltipX - columnWidth / 2, headerY);
            ctx.fillText('On Ground', tooltipX + columnWidth / 2, headerY);

            // Draw left column (current gear)
            ctx.textAlign = 'center';
            let currentY = headerY + lineHeight;
            leftLines.forEach(line => {
                ctx.fillStyle = line.color;
                ctx.font = line.font;
                ctx.fillText(line.text, tooltipX - columnWidth / 2, currentY);
                currentY += lineHeight;
            });
            
            // Draw right column (new gear)
            currentY = headerY + lineHeight;
            rightLines.forEach(line => {
                ctx.fillStyle = line.color;
                ctx.font = line.font;
                ctx.fillText(line.text, tooltipX + columnWidth / 2, currentY);
                currentY += lineHeight;
            });
            
            // Draw comparison arrow
            ctx.fillStyle = '#ffff00';
            ctx.font = 'bold 16px Arial';
            ctx.fillText('→', tooltipX, tooltipY);
            
            // Draw pickup prompt (only show in desktop mode)
            if (typeof Input !== 'undefined' && (!Input.isTouchMode || !Input.isTouchMode())) {
                ctx.fillStyle = '#ffff00';
                ctx.font = 'bold 12px Arial';
                ctx.textAlign = 'center';
                
                let promptY = tooltipY + tooltipHeight / 2 - 8;
                ctx.fillText('Press G to pickup', tooltipX, promptY);
                
                // Show cycling instructions if multiple items nearby
                if (nearbyCount > 1) {
                    promptY += 18;
                    ctx.fillStyle = '#aaaaaa';
                    ctx.font = '11px Arial';
                    ctx.fillText(`← → to cycle (${LootSelection.selectedIndex + 1}/${nearbyCount})`, tooltipX, promptY);
                }
            }
            
            // Draw range indicator (using screen coordinates)
            // Highlight selected item more prominently
            const isSelected = nearbyCount > 1;
            ctx.strokeStyle = isSelected ? 'rgba(255, 255, 0, 0.8)' : 'rgba(255, 255, 0, 0.5)';
            ctx.lineWidth = isSelected ? 3 : 2;
            ctx.beginPath();
            ctx.arc(screenPos.x, screenPos.y, 50, 0, Math.PI * 2);
            ctx.stroke();
            
            // Draw selection indicator for selected item
            if (isSelected) {
                ctx.strokeStyle = gear.color;
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.arc(screenPos.x, screenPos.y, gear.size + 8, 0, Math.PI * 2);
                ctx.stroke();
            }
    }
}

// Get gear stat as string for tooltip (comprehensive version)
function getGearStatString(gear, slot) {
    if (!gear) return 'None';
    
    let lines = [];
    
    // Base stats
    if (gear.stats.damage) {
        lines.push(`+${gear.stats.damage.toFixed(1)} Dmg`);
    }
    if (gear.stats.defense) {
        lines.push(`+${(gear.stats.defense * 100).toFixed(1)}% Def`);
    }
    if (gear.stats.speed) {
        lines.push(`+${(gear.stats.speed * 100).toFixed(0)}% Spd`);
    }
    
    // Weapon/Armor type
    if (gear.weaponType && typeof WEAPON_TYPES !== 'undefined') {
        lines.push(`[${WEAPON_TYPES[gear.weaponType].name}]`);
    }
    if (gear.armorType && typeof ARMOR_TYPES !== 'undefined') {
        lines.push(`[${ARMOR_TYPES[gear.armorType].name}]`);
    }
    
    // Affixes (show count)
    if (gear.affixes && gear.affixes.length > 0) {
        lines.push(`${gear.affixes.length} affix${gear.affixes.length > 1 ? 'es' : ''}`);
    }
    
    // Class modifier indicator
    if (gear.classModifier) {
        const classIcon = gear.classModifier.class === 'universal' ? 'All' : gear.classModifier.class;
        lines.push(`[${classIcon}]`);
    }
    
    // Legendary indicator
    if (gear.legendaryEffect) {
        lines.push('[LEGENDARY]');
    }
    
    return lines.length > 0 ? lines.join(' ') : 'No bonus';
}

// Update character sheet state based on input
function updateCharacterSheet(input) {
    if (!input) return;
    
    const wasOpen = CharacterSheet.isOpen;
    
    // Mobile: Character sheet button is handled in input.js handleTouchStart directly
    // (no need to check here to avoid double-toggling)
    
    // Desktop: I key toggle OR Tab key hold
    const iKeyPressed = input.getKeyState && input.getKeyState('i');
    const tabKeyPressed = input.getKeyState && input.getKeyState('Tab');
    
    // Toggle with I key
    if (iKeyPressed && !CharacterSheet.lastIKey) {
        CharacterSheet.isOpen = !CharacterSheet.isOpen;
    }
    CharacterSheet.lastIKey = iKeyPressed;
    
    // Or hold Tab key (overrides I key state while held)
    if (tabKeyPressed) {
        CharacterSheet.isOpen = true;
    } else if (CharacterSheet.lastTabKey && !tabKeyPressed) {
        // Tab was just released
        CharacterSheet.isOpen = false;
    }
    CharacterSheet.lastTabKey = tabKeyPressed;
    
    // Reset scroll position when opening
    if (CharacterSheet.isOpen && !wasOpen) {
        CharacterSheet.scrollOffset = 0;
        CharacterSheet.lastTouchY = null;
    }
}

// Render character sheet (inventory and stats)
function renderCharacterSheet(ctx, player) {
    if (!CharacterSheet.isOpen || !player) return;
    
    // Auto-close if player dies
    if (player.dead || player.hp <= 0) {
        CharacterSheet.isOpen = false;
        return;
    }
    
    const canvas = ctx.canvas;
    const screenWidth = canvas.width;
    const screenHeight = canvas.height;
    
    // Detect mobile
    const isMobile = typeof Input !== 'undefined' && Input.isTouchMode && Input.isTouchMode();
    
    // Modal dimensions - responsive to screen size
    // On mobile, maximize vertical space (minimal padding)
    const modalWidth = isMobile ? Math.min(screenWidth * 0.96, 600) : Math.min(screenWidth * 0.90, 600);
    // Mobile: 92% of screen height (maximize space, minimal margins)
    // Desktop: 90% or max 700px
    const modalHeight = isMobile 
        ? Math.min(screenHeight * 0.92, screenHeight - 40) // Leave only 40px total margin (20px top+bottom)
        : Math.min(screenHeight * 0.90, 700);
    const modalX = (screenWidth - modalWidth) / 2;
    const modalY = (screenHeight - modalHeight) / 2;
    
    // Draw semi-transparent overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(0, 0, screenWidth, screenHeight);
    
    // Draw modal background
    ctx.fillStyle = 'rgba(20, 20, 40, 0.75)';
    ctx.fillRect(modalX, modalY, modalWidth, modalHeight);
    
    // Draw border
    ctx.strokeStyle = '#4a90e2';
    ctx.lineWidth = 3;
    ctx.strokeRect(modalX, modalY, modalWidth, modalHeight);
    
    // Start tracking content height for scrolling
    let contentMaxY = modalY;
    
    // Save context for clipping scrollable content
    ctx.save();
    
    // Clip content to modal bounds (leave space for header and footer)
    const headerHeight = 75;
    const footerHeight = 35;
    const scrollableTop = modalY + headerHeight;
    const scrollableHeight = modalHeight - headerHeight - footerHeight;
    ctx.beginPath();
    ctx.rect(modalX, scrollableTop, modalWidth, scrollableHeight);
    ctx.clip();
    
    // Apply scroll offset
    const scrollY = -CharacterSheet.scrollOffset;
    
    // Draw title (fixed, not scrolled)
    ctx.restore();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('CHARACTER', screenWidth / 2, modalY + 30);
    
    // Re-save and clip for scrollable content
    ctx.save();
    ctx.beginPath();
    ctx.rect(modalX, scrollableTop, modalWidth, scrollableHeight);
    ctx.clip();
    
    // Draw player class info (scrollable content starts here)
    let currentY = scrollableTop + scrollY + 10;
    if (player.playerClass && typeof CLASS_DEFINITIONS !== 'undefined') {
        const classDef = CLASS_DEFINITIONS[player.playerClass];
        ctx.font = '18px Arial';
        ctx.fillStyle = player.color;
        ctx.fillText(`${classDef.name} - Level ${player.level}`, screenWidth / 2, currentY);
        currentY += 25;
    }
    
    // Draw horizontal divider
    ctx.strokeStyle = '#555555';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(modalX + 30, currentY);
    ctx.lineTo(modalX + modalWidth - 30, currentY);
    ctx.stroke();
    currentY += 10;
    
    // Draw class bonuses section (centered, under divider) - using dynamic descriptions
    if (player.playerClass && typeof CLASS_DEFINITIONS !== 'undefined') {
        const classDef = CLASS_DEFINITIONS[player.playerClass];
        
        // Use dynamic description if available, otherwise fall back to manual calculation
        let baseStatsText = '';
        if (typeof getClassDescription !== 'undefined') {
            const classDesc = getClassDescription(player.playerClass);
            baseStatsText = classDesc.baseStats || '';
        } else {
            // Fallback: calculate manually
            const bonuses = [];
            if (classDef.critChance > 0) bonuses.push(`${(classDef.critChance * 100).toFixed(0)}% Crit`);
            if (classDef.defense > 0) bonuses.push(`${(classDef.defense * 100).toFixed(0)}% Defense`);
            if (classDef.dodgeCharges > 1) bonuses.push(`${classDef.dodgeCharges} Dodges`);
            baseStatsText = bonuses.join('  •  ');
        }
        
        if (baseStatsText) {
            ctx.font = 'bold 11px Arial';
            ctx.fillStyle = '#ffdd88';
            ctx.textAlign = 'center';
            ctx.fillText('CLASS BONUSES:', screenWidth / 2, currentY);
            currentY += 14;
            
            ctx.font = '12px Arial';
            ctx.fillStyle = '#ffaa55';
            ctx.fillText(baseStatsText, screenWidth / 2, currentY);
            currentY += 20;
        } else {
            currentY += 10;
        }
    }
    
    // Draw stats section (using currentY so it scrolls)
    const leftColumnX = modalX + 60;
    ctx.textAlign = 'left';
    ctx.font = 'bold 16px Arial';
    ctx.fillStyle = '#ffdd88';
    ctx.fillText('STATS', leftColumnX, currentY);
    currentY += 25;
    
    ctx.font = '13px Arial';
    ctx.fillStyle = '#ffffff';
    let statY = currentY;
    const statLineHeight = 20;
    
    ctx.fillText(`HP: ${Math.floor(player.hp)} / ${Math.floor(player.maxHp)}`, leftColumnX, statY);
    statY += statLineHeight;
    ctx.fillText(`Damage: ${player.damage.toFixed(1)}`, leftColumnX, statY);
    statY += statLineHeight;
    ctx.fillText(`Defense: ${(player.defense * 100).toFixed(1)}%`, leftColumnX, statY);
    statY += statLineHeight;
    ctx.fillText(`Speed: ${player.moveSpeed.toFixed(0)}`, leftColumnX, statY);
    statY += statLineHeight;
    
    // Show derived stats if they exist
    if (player.critChance > 0) {
        ctx.fillText(`Crit Chance: ${(player.critChance * 100).toFixed(0)}%`, leftColumnX, statY);
        statY += statLineHeight;
        
        // Always show crit damage when crit chance > 0
        const critDamageMult = player.critDamageMultiplier || 1.0;
        const totalCritMult = 2.0 * critDamageMult; // Base 2x times the multiplier
        ctx.fillText(`Crit Damage: ${totalCritMult.toFixed(2)}x (${(critDamageMult * 100).toFixed(0)}%)`, leftColumnX, statY);
        statY += statLineHeight;
    }
    if (player.lifesteal > 0) {
        ctx.fillText(`Lifesteal: ${(player.lifesteal * 100).toFixed(0)}%`, leftColumnX, statY);
        statY += statLineHeight;
    }
    if (player.cooldownReduction > 0) {
        ctx.fillText(`Cooldown Reduction: ${(player.cooldownReduction * 100).toFixed(0)}%`, leftColumnX, statY);
        statY += statLineHeight;
    }
    
    // Dodge charges breakdown (show sources clearly)
    if (player.maxDodgeCharges) {
        const baseCharges = player.baseDodgeCharges || 1;
        const armorBonus = player.armor && player.armor.armorType && typeof ARMOR_TYPES !== 'undefined' && ARMOR_TYPES[player.armor.armorType] ? 
            (ARMOR_TYPES[player.armor.armorType].dodgeBonus || 0) : 0;
        const affixBonus = player.bonusDodgeCharges || 0;
        
        ctx.fillText(`Dodge Charges: ${player.maxDodgeCharges}`, leftColumnX, statY);
        statY += statLineHeight;
        
        // Show breakdown in smaller text
        ctx.font = '10px Arial';
        ctx.fillStyle = '#aaaaaa';
        ctx.fillText(`  Base: ${baseCharges}`, leftColumnX, statY);
        statY += 14;
        if (armorBonus > 0) {
            ctx.fillText(`  Armor Type: +${armorBonus}`, leftColumnX, statY);
            statY += 14;
        }
        if (affixBonus > 0) {
            ctx.fillText(`  Affixes: +${affixBonus}`, leftColumnX, statY);
            statY += 14;
        }
        ctx.font = '13px Arial';
        ctx.fillStyle = '#ffffff';
    }
    
    if (player.pierceCount > 0) {
        ctx.fillStyle = '#ff44ff'; // Rare affix color
        ctx.fillText(`Pierce: ${player.pierceCount} enemies`, leftColumnX, statY);
        statY += statLineHeight;
        ctx.fillStyle = '#ffffff';
    }
    
    if (player.chainLightningCount > 0) {
        ctx.fillStyle = '#ff44ff';
        ctx.fillText(`Chain Lightning: ${player.chainLightningCount} targets`, leftColumnX, statY);
        statY += statLineHeight;
        ctx.fillStyle = '#ffffff';
    }
    
    if (player.executeBonus > 0) {
        ctx.fillStyle = '#ff44ff';
        ctx.fillText(`Execute: +${(player.executeBonus * 100).toFixed(0)}% vs low HP`, leftColumnX, statY);
        statY += statLineHeight;
        ctx.fillStyle = '#ffffff';
    }
    
    if (player.rampageBonus > 0) {
        ctx.fillStyle = '#ff44ff';
        ctx.fillText(`Rampage: ${player.rampageStacks || 0}/5 stacks (${(player.rampageBonus * 100).toFixed(0)}% each)`, leftColumnX, statY);
        statY += statLineHeight;
        ctx.fillStyle = '#ffffff';
    }
    
    if (player.multishotCount > 0) {
        ctx.fillStyle = '#ff44ff';
        ctx.fillText(`Multishot: +${player.multishotCount} projectiles`, leftColumnX, statY);
        statY += statLineHeight;
        ctx.fillStyle = '#ffffff';
    }
    
    if (player.phasingChance > 0) {
        ctx.fillStyle = '#ff44ff';
        ctx.fillText(`Phasing: ${(player.phasingChance * 100).toFixed(0)}% avoid`, leftColumnX, statY);
        statY += statLineHeight;
        ctx.fillStyle = '#ffffff';
    }
    
    if (player.explosiveChance > 0) {
        ctx.fillStyle = '#ff44ff';
        ctx.fillText(`Explosive: ${(player.explosiveChance * 100).toFixed(0)}% proc`, leftColumnX, statY);
        statY += statLineHeight;
        ctx.fillStyle = '#ffffff';
    }
    
    if (player.fortifyPercent > 0) {
        ctx.fillStyle = '#ff44ff';
        ctx.fillText(`Fortify: ${(player.fortifyPercent * 100).toFixed(0)}% → Shield (${player.fortifyShield.toFixed(0)})`, leftColumnX, statY);
        statY += statLineHeight;
        ctx.fillStyle = '#ffffff';
    }
    
    if (player.overchargeChance > 0) {
        ctx.fillStyle = '#ff44ff';
        ctx.fillText(`Overcharge: ${(player.overchargeChance * 100).toFixed(0)}% refund`, leftColumnX, statY);
        statY += statLineHeight;
        ctx.fillStyle = '#ffffff';
    }
    
    // Add spacing before ability cooldowns section
    statY += 5;
    
    // Draw ability cooldowns section (using dynamic class descriptions)
    if (player.playerClass && typeof getClassDescription !== 'undefined') {
        // Get class config for cooldown values
        const classKey = player.playerClass;
        let config = null;
        
        if (classKey === 'square' && typeof WARRIOR_CONFIG !== 'undefined') {
            config = WARRIOR_CONFIG;
        } else if (classKey === 'triangle' && typeof ROGUE_CONFIG !== 'undefined') {
            config = ROGUE_CONFIG;
        } else if (classKey === 'pentagon' && typeof TANK_CONFIG !== 'undefined') {
            config = TANK_CONFIG;
        } else if (classKey === 'hexagon' && typeof MAGE_CONFIG !== 'undefined') {
            config = MAGE_CONFIG;
        }
        
        if (config) {
            ctx.font = 'bold 14px Arial';
            ctx.fillStyle = '#ffdd88';
            ctx.fillText('ABILITY COOLDOWNS', leftColumnX, statY);
            statY += 18;
            
            ctx.font = '12px Arial';
            ctx.fillStyle = '#ffffff';
            
            // Heavy Attack cooldown
            const heavyCooldown = config.heavyAttackCooldown || 0;
            const actualHeavyCooldown = heavyCooldown * (1 - (player.cooldownReduction || 0));
            ctx.fillText(`Heavy Attack: ${actualHeavyCooldown.toFixed(1)}s`, leftColumnX, statY);
            statY += 16;
            
            // Special Ability cooldown
            const specialCooldown = config.specialCooldown || 0;
            const actualSpecialCooldown = specialCooldown * (1 - (player.cooldownReduction || 0));
            ctx.fillText(`Special Ability: ${actualSpecialCooldown.toFixed(1)}s`, leftColumnX, statY);
            statY += 16;
            
            // Mage-specific beam stats
            if (classKey === 'hexagon') {
                statY += 5; // Add spacing
                
                ctx.font = 'bold 14px Arial';
                ctx.fillStyle = '#ffdd88';
                ctx.fillText('BEAM STATS', leftColumnX, statY);
                statY += 18;
                
                ctx.font = '12px Arial';
                ctx.fillStyle = '#ffffff';
                
                // Beam charges (current/max)
                const currentCharges = player.beamCharges || 0;
                const maxCharges = player.maxBeamCharges || 2;
                ctx.fillText(`Beam Charges: ${currentCharges}/${maxCharges}`, leftColumnX, statY);
                statY += 16;
                
                // Beam duration
                const beamDuration = player.effectiveBeamDuration || config.beamDuration || 1.5;
                ctx.fillText(`Beam Duration: ${beamDuration.toFixed(2)}s`, leftColumnX, statY);
                statY += 16;
                
                // Beam tick rate
                const beamTickRate = player.effectiveBeamTickRate || config.beamTickRate || 0.2;
                ctx.fillText(`Beam Tick Rate: ${beamTickRate.toFixed(3)}s`, leftColumnX, statY);
                statY += 16;
                
                // Beam damage per tick
                const beamDamagePerTick = config.beamDamagePerTick || 0.4;
                ctx.fillText(`Beam Damage/Tick: ${(beamDamagePerTick * 100).toFixed(0)}%`, leftColumnX, statY);
                statY += 16;
                
                // Beam max penetration
                const maxPenetration = player.effectiveBeamMaxPenetration || config.beamMaxPenetration || 2;
                ctx.fillText(`Beam Max Penetration: ${maxPenetration}`, leftColumnX, statY);
                statY += 16;
            }
        }
    }
    
    // Draw equipped gear section (parallel to stats, using same Y position)
    const rightColumnX = modalX + modalWidth / 2 + 30;
    const gearStartY = currentY - 25; // Same starting Y as stats section
    ctx.textAlign = 'left';
    ctx.font = 'bold 16px Arial';
    ctx.fillStyle = '#88ddff';
    ctx.fillText('EQUIPPED GEAR', rightColumnX, gearStartY);
    
    // Render each equipment slot
    let gearY = gearStartY + 25;
    const slots = ['weapon', 'armor', 'accessory'];
    
    slots.forEach(slot => {
        const gear = player.getEquippedGear(slot);
        
        // Slot label
        ctx.font = 'bold 14px Arial';
        ctx.fillStyle = '#ffaa88';
        ctx.fillText(slot.toUpperCase() + ':', rightColumnX, gearY);
        gearY += 18;
        
        if (gear) {
            // Gear name and tier
            ctx.font = '12px Arial';
            ctx.fillStyle = gear.color;
            let gearTitle = `${gear.tier.toUpperCase()}`;
            if (gear.weaponType && typeof WEAPON_TYPES !== 'undefined') {
                gearTitle += ` ${WEAPON_TYPES[gear.weaponType].name}`;
            }
            if (gear.armorType && typeof ARMOR_TYPES !== 'undefined') {
                gearTitle += ` ${ARMOR_TYPES[gear.armorType].name}`;
            }
            ctx.fillText(gearTitle, rightColumnX + 10, gearY);
            gearY += 15;
            
            if (gear.name) {
                ctx.font = '11px Arial';
                ctx.fillStyle = '#dddddd';
                ctx.fillText(gear.name, rightColumnX + 10, gearY);
                gearY += 14;
            }
            
            // Base stats
            ctx.font = '10px Arial';
            if (gear.stats.damage) {
                ctx.fillStyle = '#ff8888';
                ctx.fillText(`  +${gear.stats.damage.toFixed(1)} Damage`, rightColumnX + 10, gearY);
                gearY += 13;
            }
            if (gear.stats.defense) {
                ctx.fillStyle = '#88aaff';
                ctx.fillText(`  +${(gear.stats.defense * 100).toFixed(1)}% Defense`, rightColumnX + 10, gearY);
                gearY += 13;
            }
            if (gear.stats.speed) {
                ctx.fillStyle = '#88ff88';
                ctx.fillText(`  +${(gear.stats.speed * 100).toFixed(0)}% Speed`, rightColumnX + 10, gearY);
                gearY += 13;
            }
            
            // Affixes (show all)
            if (gear.affixes && gear.affixes.length > 0) {
                ctx.fillStyle = '#aaddff';
                gear.affixes.forEach(affix => {
                    // Integer affixes (count-based)
                    const isIntegerAffix = ['dodgeCharges', 'maxHealth', 'pierce', 'chainLightning', 'multishot', 'beamCharges', 'beamPenetration'].includes(affix.type);
                    let displayValue;
                    
                    // Special handling for beam affixes
                    if (affix.type === 'beamTickRate') {
                        displayValue = `-${(affix.value * 100).toFixed(0)}%`;
                    } else if (isIntegerAffix) {
                        displayValue = `+${affix.value.toFixed(0)}`;
                    } else {
                        displayValue = `+${(affix.value * 100).toFixed(0)}%`;
                    }
                    
                    let displayName = affix.type.replace(/([A-Z])/g, ' $1').trim();
                    
                    // Special formatting for specific affixes
                    const nameMap = {
                        pierce: 'Pierce',
                        chainLightning: 'Chain Lightning',
                        execute: 'Execute',
                        rampage: 'Rampage',
                        multishot: 'Multishot',
                        phasing: 'Phasing',
                        explosiveAttacks: 'Explosive',
                        fortify: 'Fortify',
                        overcharge: 'Overcharge'
                    };
                    if (nameMap[affix.type]) {
                        displayName = nameMap[affix.type];
                    }
                    
                    // Tier badge
                    const tierColors = { basic: '#888888', advanced: '#4488ff', rare: '#ff44ff' };
                    const tierColor = tierColors[affix.tier] || '#888888';
                    ctx.fillStyle = tierColor;
                    ctx.fillText(`  [${(affix.tier || 'basic').toUpperCase()}] ${displayName}: ${displayValue}`, rightColumnX + 10, gearY);
                    gearY += 13;
                });
            }
            
            // Class modifier
            if (gear.classModifier) {
                const classIcon = gear.classModifier.class === 'universal' ? '[All]' : `[${gear.classModifier.class}]`;
                ctx.fillStyle = '#ffaa00';
                ctx.font = 'bold 10px Arial';
                ctx.fillText(`  ${classIcon} ${gear.classModifier.description}`, rightColumnX + 10, gearY);
                gearY += 13;
                ctx.font = '10px Arial';
            }
            
            // Legendary effect
            if (gear.legendaryEffect) {
                ctx.fillStyle = '#ff9800';
                ctx.font = 'bold 10px Arial';
                ctx.fillText(`  [LEGENDARY] ${gear.legendaryEffect.description}`, rightColumnX + 10, gearY);
                gearY += 13;
                ctx.font = '10px Arial';
            }
            
            gearY += 8; // Extra spacing between slots
        } else {
            ctx.font = '11px Arial';
            ctx.fillStyle = '#888888';
            ctx.fillText('  None equipped', rightColumnX + 10, gearY);
            gearY += 25;
        }
    });
    
    // Track maximum content Y position (for scroll calculation)
    contentMaxY = Math.max(contentMaxY, gearY);
    
    // Restore context (end clipping)
    ctx.restore();
    
    // Calculate content height and max scroll
    CharacterSheet.contentHeight = contentMaxY - scrollableTop;
    CharacterSheet.maxScroll = Math.max(0, CharacterSheet.contentHeight - scrollableHeight);
    
    // Clamp scroll offset
    CharacterSheet.scrollOffset = Math.max(0, Math.min(CharacterSheet.scrollOffset, CharacterSheet.maxScroll));
    
    // Store modal bounds for scroll input handling
    CharacterSheet.modalBounds = {
        x: modalX,
        y: modalY,
        width: modalWidth,
        height: modalHeight,
        scrollableTop: scrollableTop,
        scrollableHeight: scrollableHeight
    };
    
    // Draw scrollbar if content exceeds visible area
    if (CharacterSheet.maxScroll > 0) {
        const scrollbarWidth = 8;
        const scrollbarX = modalX + modalWidth - scrollbarWidth - 5;
        const scrollbarTrackHeight = scrollableHeight - 10;
        const scrollbarTrackY = scrollableTop + 5;
        
        // Scrollbar track
        ctx.fillStyle = 'rgba(100, 100, 100, 0.3)';
        ctx.fillRect(scrollbarX, scrollbarTrackY, scrollbarWidth, scrollbarTrackHeight);
        
        // Scrollbar thumb
        const thumbHeight = Math.max(30, (scrollableHeight / CharacterSheet.contentHeight) * scrollbarTrackHeight);
        const thumbY = scrollbarTrackY + (CharacterSheet.scrollOffset / CharacterSheet.maxScroll) * (scrollbarTrackHeight - thumbHeight);
        ctx.fillStyle = 'rgba(150, 150, 255, 0.7)';
        ctx.fillRect(scrollbarX, thumbY, scrollbarWidth, thumbHeight);
    }
    
    // Draw instructions at bottom (fixed, not scrolled)
    ctx.textAlign = 'center';
    ctx.font = '12px Arial';
    ctx.fillStyle = '#ffff88';
    if (isMobile) {
        ctx.fillText('Tap X to close  •  Swipe to scroll', screenWidth / 2, modalY + modalHeight - 15);
        
        // Draw close button (X) in top-right of modal
        const closeButtonSize = 40;
        const closeButtonX = modalX + modalWidth - closeButtonSize - 10;
        const closeButtonY = modalY + 10;
        
        ctx.fillStyle = 'rgba(200, 50, 50, 0.8)';
        ctx.fillRect(closeButtonX, closeButtonY, closeButtonSize, closeButtonSize);
        ctx.strokeStyle = '#ff6666';
        ctx.lineWidth = 2;
        ctx.strokeRect(closeButtonX, closeButtonY, closeButtonSize, closeButtonSize);
        
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('×', closeButtonX + closeButtonSize / 2, closeButtonY + closeButtonSize / 2 + 8);
        
        // Store close button bounds for touch detection
        CharacterSheet.closeButtonBounds = {
            x: closeButtonX,
            y: closeButtonY,
            width: closeButtonSize,
            height: closeButtonSize
        };
    } else {
        const scrollHint = CharacterSheet.maxScroll > 0 ? '  •  Scroll for more' : '';
        ctx.fillText('Press I or release Tab to close' + scrollHint, screenWidth / 2, modalY + modalHeight - 15);
    }
}

// Render room number
function renderRoomNumber(ctx) {
    if (typeof Game === 'undefined' || !Game.roomNumber) return;
    
    // Scale down on mobile and position to avoid overlap with health bar
    const isMobile = typeof Input !== 'undefined' && Input.isTouchMode && Input.isTouchMode();
    const mobileScale = isMobile ? 0.75 : 1.0;
    
    const centerX = Game ? Game.config.width / 2 : 640;
    const panelWidth = Math.floor(280 * mobileScale);
    const panelHeight = Math.floor(70 * mobileScale);
    const panelX = centerX - panelWidth / 2;
    const panelY = isMobile ? 10 : 15;
    
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
    
    const fontSize = Math.floor(38 * mobileScale);
    const enemyFontSize = Math.floor(18 * mobileScale);
    
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${fontSize}px Arial`;
    ctx.textAlign = 'center';
    ctx.shadowBlur = 2;
    ctx.shadowColor = '#000000';
    ctx.fillText(`Room ${Game.roomNumber}`, centerX, panelY + Math.floor(42 * mobileScale));
    ctx.shadowBlur = 0;
    
    // Draw enemy count if room not cleared
    // In multiplayer, use Game.enemies (authoritative from host), otherwise use currentRoom.enemies
    const inMultiplayer = typeof Game !== 'undefined' && Game.multiplayerEnabled;
    let enemyCount = 0;
    let roomCleared = false;
    const doorOpen = (typeof currentRoom !== 'undefined' && currentRoom) ? currentRoom.doorOpen : false;
    const playersOnDoorCount = (typeof Game !== 'undefined' && Array.isArray(Game.playersOnDoor)) ? Game.playersOnDoor.length : 0;
    
    if (inMultiplayer && typeof Game !== 'undefined' && Game.enemies) {
        // Multiplayer: Use Game.enemies array (synced from host)
        enemyCount = Game.enemies.filter(e => e.alive).length;
        roomCleared = enemyCount === 0;
    } else if (typeof currentRoom !== 'undefined' && currentRoom) {
        // Solo: Use currentRoom.enemies
        enemyCount = currentRoom.enemies.filter(e => e.alive).length;
        roomCleared = currentRoom.cleared;
    }
    
    const shouldShowDoorOpenMessage = doorOpen && (!inMultiplayer || playersOnDoorCount === 0);
    
    if (!roomCleared && enemyCount > 0) {
        ctx.font = `bold ${enemyFontSize}px Arial`;
        ctx.fillStyle = '#ffaaaa';
        ctx.shadowBlur = 2;
        ctx.shadowColor = '#000000';
        ctx.fillText(`Enemies: ${enemyCount}`, centerX, panelY + Math.floor(65 * mobileScale));
        ctx.shadowBlur = 0;
    } else if (shouldShowDoorOpenMessage) {
        ctx.font = `bold ${enemyFontSize}px Arial`;
        ctx.fillStyle = '#aaffaa';
        ctx.shadowBlur = 2;
        ctx.shadowColor = '#000000';
        ctx.fillText('Door is open!', centerX, panelY + Math.floor(65 * mobileScale));
        ctx.shadowBlur = 0;
    }
    
    // Multiplayer: Show door waiting message if room is cleared and not all players on door
    if (typeof currentRoom !== 'undefined' && currentRoom && currentRoom.doorOpen) {
        if (Game.multiplayerEnabled && Game.playersOnDoor && Game.totalAlivePlayers > 1) {
            const localPlayerId = Game.getLocalPlayerId ? Game.getLocalPlayerId() : null;
            const localPlayerOnDoor = Game.playersOnDoor.includes(localPlayerId);
            const someoneWaiting = Game.playersOnDoor.length > 0 && Game.playersOnDoor.length < Game.totalAlivePlayers;
            
            if (someoneWaiting) {
                const messageY = panelY + panelHeight + 20; // Just below room number panel
                
                ctx.textAlign = 'center';
                ctx.font = 'bold 22px Arial';
                
                if (localPlayerOnDoor) {
                    // Local player is waiting for others
                    ctx.fillStyle = '#ffaa00';
                    ctx.shadowBlur = 10;
                    ctx.shadowColor = '#000000';
                    ctx.fillText('Waiting for other players...', centerX, messageY);
                } else {
                    // Local player not on door, others are waiting
                    ctx.fillStyle = '#ff4444';
                    ctx.shadowBlur = 10;
                    ctx.shadowColor = '#000000';
                    ctx.fillText('Other players are waiting for you!', centerX, messageY);
                }
                
                // Show count
                ctx.font = 'bold 16px Arial';
                ctx.fillStyle = '#ffffff';
                ctx.fillText(`${Game.playersOnDoor.length}/${Game.totalAlivePlayers} on door`, centerX, messageY + 25);
                
                ctx.shadowBlur = 0;
            }
        }
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
    
    // On mobile, cooldowns are rendered radially around buttons in touch controls
    // On desktop, render as bars at bottom
    const isMobile = typeof Input !== 'undefined' && Input.isTouchMode && Input.isTouchMode();
    if (isMobile) {
        // Cooldowns rendered in renderTouchControls for mobile
        return;
    }
    
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
    
    const hasMultipleDodgeCharges = (player.maxDodgeCharges || 0) > 1;
    
    // Dodge cooldown indicator
    if (hasMultipleDodgeCharges) {
        const charges = player.maxDodgeCharges;
        for (let i = 0; i < charges; i++) {
            const barX = startX + i * 45;
            const cooldown = player.dodgeChargeCooldowns[i] || 0;
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
    const specialBarX = hasMultipleDodgeCharges ? startX + 150 : startX + spacing;
    const specialCooldown = player.specialCooldown;
    const specialMaxCooldown = player.specialCooldownTime;
    const abilityName = player.playerClass === 'triangle' ? 'Clones' :
                       player.playerClass === 'square' ? 'Whirlwind' : 
                       player.playerClass === 'pentagon' ? 'Shield' : 'Blink';
    renderCooldownBar(specialBarX, barY, barWidth, barHeight, specialCooldown, specialMaxCooldown, abilityName);
    
    // Heavy attack cooldown indicator
    const heavyBarX = hasMultipleDodgeCharges ? startX + spacing * 2.5 : startX + spacing * 2;
    
    // Mage (hexagon) uses charge-based heavy attack
    if (player.playerClass === 'hexagon' && player.maxBeamCharges > 1) {
        // Render multiple charge bars for beam
        for (let i = 0; i < player.maxBeamCharges; i++) {
            const barX = heavyBarX + i * 45;
            const cooldown = player.beamChargeCooldowns[i];
            const maxCooldown = player.heavyAttackCooldownTime;
            renderCooldownBar(barX, barY, 40, barHeight, cooldown, maxCooldown, 'B');
        }
    } else {
        // Single heavy attack cooldown for other classes
        const heavyCooldown = player.heavyAttackCooldown || 0;
        const heavyMaxCooldown = player.heavyAttackCooldownTime || 1.5;
        renderCooldownBar(heavyBarX, barY, barWidth, barHeight, heavyCooldown, heavyMaxCooldown, 'Heavy');
    }
}

// Pause menu button state tracking
let pauseMenuButtons = {
    resume: { x: 0, y: 0, width: 0, height: 0, pressed: false },
    restart: { x: 0, y: 0, width: 0, height: 0, pressed: false },
    nexus: { x: 0, y: 0, width: 0, height: 0, pressed: false },
    fullscreen: { x: 0, y: 0, width: 0, height: 0, pressed: false },
    controlMode: { x: 0, y: 0, width: 0, height: 0, pressed: false },
    volume: { x: 0, y: 0, width: 0, height: 0, pressed: false },
    howToPlay: { x: 0, y: 0, width: 0, height: 0, pressed: false },
    privacy: { x: 0, y: 0, width: 0, height: 0, pressed: false },
    multiplayer: { x: 0, y: 0, width: 0, height: 0, pressed: false }
};

// Multiplayer menu state
let multiplayerMenuVisible = false;
let multiplayerMenuButtons = {
    createLobby: { x: 0, y: 0, width: 0, height: 0, pressed: false },
    joinLobby: { x: 0, y: 0, width: 0, height: 0, pressed: false },
    leaveLobby: { x: 0, y: 0, width: 0, height: 0, pressed: false },
    copyCode: { x: 0, y: 0, width: 0, height: 0, pressed: false },
    pasteCode: { x: 0, y: 0, width: 0, height: 0, pressed: false },
    back: { x: 0, y: 0, width: 0, height: 0, pressed: false }
};

// Privacy modal buttons
const privacyModalButtons = {
    optIn: { x: 0, y: 0, width: 0, height: 0, pressed: false },
    optOut: { x: 0, y: 0, width: 0, height: 0, pressed: false },
    policy: { x: 0, y: 0, width: 0, height: 0, pressed: false },
    close: { x: 0, y: 0, width: 0, height: 0, pressed: false }
};
let joinCodeInput = '';
let multiplayerError = '';
let copyCodeFeedback = ''; // Feedback message when code is copied

// Update button (square, like other pause menu buttons)
let updateButton = { x: 0, y: 0, width: 0, height: 0, pressed: false };

// Modal close button state
let modalCloseButton = { x: 0, y: 0, width: 0, height: 0, pressed: false };

// Update modal scroll state
let updateModalScroll = 0;

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

// Helper function to draw a hexagon outline
function drawHexagonOutline(ctx, x, y, radius) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i;
        const px = x + Math.cos(angle) * radius;
        const py = y + Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.closePath();
}

// Helper function to draw a triangle
function drawTriangle(ctx, x, y, size, rotation = 0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.beginPath();
    ctx.moveTo(size, 0);
    ctx.lineTo(-size * 0.5, -size * 0.866);
    ctx.lineTo(-size * 0.5, size * 0.866);
    ctx.closePath();
    ctx.restore();
}

// Render a pause menu button (geometric, retro style)
function renderPauseMenuButton(ctx, button, text, isHighlighted = false, hasNotification = false) {
    const isPulsing = hasNotification;
    const pulse = isPulsing ? (Math.sin(Date.now() / 300) * 0.2 + 0.8) : 1.0;
    
    // Button background - clean, solid colors
    if (isHighlighted) {
        // Primary button (Resume) - warrior blue
        ctx.fillStyle = button.pressed ? 'rgba(74, 144, 226, 0.9)' : 'rgba(74, 144, 226, 0.8)'; // Warrior blue
    } else if (isPulsing) {
        // Pulsing for notification
        const alpha = 0.9 * pulse;
        ctx.fillStyle = button.pressed ? `rgba(255, 200, 0, ${alpha})` : `rgba(255, 150, 0, ${0.8 * pulse})`;
    } else {
        // Normal button - neutral dark gray
        ctx.fillStyle = button.pressed ? 'rgba(50, 50, 70, 0.9)' : 'rgba(30, 30, 50, 0.8)';
    }
    ctx.fillRect(button.x, button.y, button.width, button.height);
    
    // Clean border - consistent white/light blue for all buttons
    if (isHighlighted) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
    } else if (isPulsing) {
        ctx.strokeStyle = `rgba(255, 200, 0, ${pulse})`;
        ctx.lineWidth = 2;
    } else {
        // Neutral border color - light blue-gray, no green
        ctx.strokeStyle = 'rgba(150, 150, 200, 0.7)';
        ctx.lineWidth = 2;
    }
    ctx.strokeRect(button.x, button.y, button.width, button.height);
    
    // Button text (support multiline with \n)
    ctx.fillStyle = '#ffffff';
    const fontSize = Math.min(24, button.width * 0.16);
    ctx.font = `bold ${fontSize}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Handle multiline text
    const lines = text.split('\n');
    const lineHeight = fontSize * 1.2;
    const totalHeight = lines.length * lineHeight;
    const startY = button.y + button.height / 2 - totalHeight / 2 + lineHeight / 2;
    
    lines.forEach((line, index) => {
        ctx.fillText(line, button.x + button.width / 2, startY + index * lineHeight);
    });
}

// Render pause menu with touch-friendly buttons
function renderPauseMenu(ctx) {
    const canvasWidth = Game ? Game.config.width : 1280;
    const canvasHeight = Game ? Game.config.height : 720;
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;
    
    // Detect mobile
    const isMobile = typeof Input !== 'undefined' && Input.isTouchMode && Input.isTouchMode();
    
    // Dark overlay with grid pattern matching game background
    ctx.fillStyle = 'rgba(15, 15, 26, 0.95)'; // Dark background matching game
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    // Draw grid pattern (retro 90s aesthetic)
    ctx.strokeStyle = 'rgba(100, 100, 150, 0.15)';
    ctx.lineWidth = 1;
    const gridSize = 50;
    for (let x = 0; x < canvasWidth; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvasHeight);
        ctx.stroke();
    }
    for (let y = 0; y < canvasHeight; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvasWidth, y);
        ctx.stroke();
    }
    
    // Subtle scanline effect (retro 90s)
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.lineWidth = 1;
    for (let y = 0; y < canvasHeight; y += 4) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvasWidth, y);
        ctx.stroke();
    }
    
    // Main menu panel with geometric styling (responsive to screen size)
    // On ultra-wide screens (21:9), use MORE width to reduce wasted space
    const aspectRatio = canvasWidth / canvasHeight;
    const isUltraWide = aspectRatio < 0.5; // 21:9 portrait or wider
    
    // Mobile: increase panel size by 5-10% and better utilize space
    // Desktop: keep original sizing
    if (isMobile) {
        // Mobile: larger panel, better centering
        const panelWidth = Math.min(canvasWidth * 0.98, canvasWidth - 10); // 98% width, minimal margin
        const panelHeight = Math.min(canvasHeight * 0.96, canvasHeight - 10); // 96% height
        var panelX = (canvasWidth - panelWidth) / 2;
        var panelY = (canvasHeight - panelHeight) / 2;
        var panelWidth_final = panelWidth;
        var panelHeight_final = panelHeight;
    } else {
        // Desktop: keep original sizing
        const widthPercent = isUltraWide ? 0.96 : 0.90;
        const heightPercent = isUltraWide ? 0.88 : 0.80;
        const panelWidth = Math.min(800, canvasWidth * widthPercent);
        const panelHeight = Math.min(550, canvasHeight * heightPercent);
        var panelX = (canvasWidth - panelWidth) / 2;
        var panelY = (canvasHeight - panelHeight) / 2;
        var panelWidth_final = panelWidth;
        var panelHeight_final = panelHeight;
    }
    
    // Panel background - solid color matching game UI
    ctx.fillStyle = 'rgba(20, 20, 40, 0.95)';
    ctx.fillRect(panelX, panelY, panelWidth_final, panelHeight_final);
    
    // Geometric corner decorations (triangles)
    const cornerSize = 12;
    ctx.fillStyle = '#ffff00'; // Selection yellow
    // Top-left corner
    drawTriangle(ctx, panelX + cornerSize, panelY + cornerSize, cornerSize, Math.PI * 0.25);
    ctx.fill();
    // Top-right corner
    drawTriangle(ctx, panelX + panelWidth_final - cornerSize, panelY + cornerSize, cornerSize, Math.PI * 0.75);
    ctx.fill();
    // Bottom-left corner
    drawTriangle(ctx, panelX + cornerSize, panelY + panelHeight_final - cornerSize, cornerSize, -Math.PI * 0.25);
    ctx.fill();
    // Bottom-right corner
    drawTriangle(ctx, panelX + panelWidth_final - cornerSize, panelY + panelHeight_final - cornerSize, cornerSize, Math.PI * 1.25);
    ctx.fill();
    
    // Outer border - sharp angular border (no glow)
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.strokeRect(panelX, panelY, panelWidth_final, panelHeight_final);
    
    // Inner border with geometric pattern
    ctx.strokeStyle = '#4a90e2'; // Warrior blue
    ctx.lineWidth = 2;
    ctx.strokeRect(panelX + 3, panelY + 3, panelWidth_final - 6, panelHeight_final - 6);
    
    // Add small hexagon accents at border corners
    const hexRadius = 8;
    ctx.strokeStyle = '#673ab7'; // Mage purple
    ctx.lineWidth = 2;
    // Top corners
    drawHexagonOutline(ctx, panelX + hexRadius + 5, panelY + hexRadius + 5, hexRadius);
    ctx.stroke();
    drawHexagonOutline(ctx, panelX + panelWidth_final - hexRadius - 5, panelY + hexRadius + 5, hexRadius);
    ctx.stroke();
    // Bottom corners
    drawHexagonOutline(ctx, panelX + hexRadius + 5, panelY + panelHeight_final - hexRadius - 5, hexRadius);
    ctx.stroke();
    drawHexagonOutline(ctx, panelX + panelWidth_final - hexRadius - 5, panelY + panelHeight_final - hexRadius - 5, hexRadius);
    ctx.stroke();
    
    // NEW LAYOUT: "PAUSED" text placement based on aspect ratio
    let leftSectionWidth, buttonAreaWidth, buttonAreaX;
    
    if (isMobile) {
        // On mobile: smaller PAUSED section, maximize button space
        leftSectionWidth = panelWidth_final * 0.12; // 12% for "PAUSED" text (smaller than desktop)
        buttonAreaWidth = panelWidth_final * 0.86; // 86% for buttons (more space)
        buttonAreaX = panelX + leftSectionWidth + panelWidth_final * 0.01;
    } else if (isUltraWide) {
        // On ultra-wide: smaller PAUSED section, more room for buttons
        leftSectionWidth = panelWidth_final * 0.20; // 20% for "PAUSED" text (was 30%)
        buttonAreaWidth = panelWidth_final * 0.78; // 78% for buttons
        buttonAreaX = panelX + leftSectionWidth + panelWidth_final * 0.02;
    } else {
        // Normal aspect ratio - desktop keeps original sizing
        leftSectionWidth = panelWidth_final * 0.30;
        buttonAreaWidth = panelWidth_final * 0.68;
        buttonAreaX = panelX + leftSectionWidth + panelWidth_final * 0.02;
    }
    
    const leftSectionX = panelX + 20;
    
    // "PAUSED" text - vertical on left side with geometric accents
    ctx.save();
    const pausedXOffset = isMobile ? 10 : (isUltraWide ? 25 : 40);
    ctx.translate(leftSectionX + pausedXOffset, panelY + panelHeight_final / 2);
    ctx.rotate(-Math.PI / 2); // Rotate 90 degrees counter-clockwise
    
    // Add geometric shape accents around text
    const accentSize = isMobile ? 6 : 12;
    const accentOffset = isMobile ? 20 : 35;
    
    // Small triangles above and below text
    ctx.fillStyle = '#ffff00'; // Selection yellow
    drawTriangle(ctx, -accentOffset, -accentSize * 2, accentSize, 0);
    ctx.fill();
    drawTriangle(ctx, accentOffset, -accentSize * 2, accentSize, 0);
    ctx.fill();
    drawTriangle(ctx, -accentOffset, accentSize * 2, accentSize, Math.PI);
    ctx.fill();
    drawTriangle(ctx, accentOffset, accentSize * 2, accentSize, Math.PI);
    ctx.fill();
    
    // Small hexagons on sides
    ctx.strokeStyle = '#4a90e2'; // Warrior blue
    ctx.lineWidth = 2;
    drawHexagonOutline(ctx, -accentOffset * 1.5, 0, accentSize);
    ctx.stroke();
    drawHexagonOutline(ctx, accentOffset * 1.5, 0, accentSize);
    ctx.stroke();
    
    // Text - solid color, no glow
    ctx.fillStyle = '#ffff00'; // Selection yellow for emphasis
    const pausedFontSize = isMobile ? Math.min(32, leftSectionWidth * 0.85) : Math.min(60, leftSectionWidth * 0.90);
    ctx.font = `bold ${pausedFontSize}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', 0, 0);
    ctx.restore();
    
    // TWO-COLUMN LAYOUT for buttons: Primary left (larger), Settings right (smaller)
    // Mobile: optimized spacing and larger buttons. Desktop: keep original sizing
    const primaryButtonWidth = isMobile 
        ? Math.min(buttonAreaWidth * 0.48, 170)  // Increased from 160 for mobile
        : (isUltraWide ? Math.min(180, buttonAreaWidth * 0.47) : Math.min(140, buttonAreaWidth * 0.45)); // Desktop original
    const primaryButtonHeight = isMobile ? Math.min(60, panelHeight_final * 0.12) : Math.min(70, panelHeight_final * 0.14); // Desktop original
    const settingsButtonWidth = isMobile 
        ? Math.min(buttonAreaWidth * 0.48, 170)  // Increased from 160 for mobile
        : (isUltraWide ? Math.min(200, buttonAreaWidth * 0.48) : Math.min(160, buttonAreaWidth * 0.42)); // Desktop original
    const settingsButtonHeight = isMobile ? Math.min(55, panelHeight_final * 0.11) : Math.min(55, panelHeight_final * 0.12); // Desktop original
    const buttonSpacing = isMobile ? Math.min(12, panelHeight_final * 0.02) : Math.min(15, panelHeight_final * 0.03); // Desktop original
    const columnGap = isMobile ? Math.min(10, buttonAreaWidth * 0.025) : (isUltraWide ? Math.min(12, buttonAreaWidth * 0.03) : Math.min(20, buttonAreaWidth * 0.05)); // Desktop original
    const startY = isMobile ? panelY + Math.min(55, panelHeight_final * 0.10) : panelY + Math.min(80, panelHeight_final * 0.15); // Desktop original
    
    // Column positions
    const leftColumnX = buttonAreaX;
    const rightColumnX = buttonAreaX + primaryButtonWidth + columnGap;
    
    // Check if paused from nexus (not just current state, since state is 'PAUSED' when paused)
    const pausedFromNexus = Game && Game.pausedFromState === 'NEXUS';
    const inMultiplayer = Game && Game.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.lobbyCode;
    const isHost = inMultiplayer && multiplayerManager.isHost;
    
    // LEFT COLUMN: Primary Actions (LARGE, RECTANGULAR - wider but shorter)
    let leftY = startY;
    
    // Resume button (most important, always first)
    pauseMenuButtons.resume.x = leftColumnX;
    pauseMenuButtons.resume.y = leftY;
    pauseMenuButtons.resume.width = primaryButtonWidth;
    pauseMenuButtons.resume.height = primaryButtonHeight;
    renderPauseMenuButton(ctx, pauseMenuButtons.resume, 'Resume', true);
    leftY += primaryButtonHeight + buttonSpacing;
    
    // Multiplayer button (only in nexus, left column)
    if (pausedFromNexus) {
        let mpButtonText = 'Multiplayer';
        if (typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.lobbyCode) {
            mpButtonText = 'Lobby';
        }
        pauseMenuButtons.multiplayer.x = leftColumnX;
        pauseMenuButtons.multiplayer.y = leftY;
        pauseMenuButtons.multiplayer.width = primaryButtonWidth;
        pauseMenuButtons.multiplayer.height = primaryButtonHeight;
        renderPauseMenuButton(ctx, pauseMenuButtons.multiplayer, mpButtonText, false);
        leftY += primaryButtonHeight + buttonSpacing;
    }
    
    // Restart button (only in game, only for solo or host)
    if (!pausedFromNexus && (!inMultiplayer || isHost)) {
        pauseMenuButtons.restart.x = leftColumnX;
        pauseMenuButtons.restart.y = leftY;
        pauseMenuButtons.restart.width = primaryButtonWidth;
        pauseMenuButtons.restart.height = primaryButtonHeight;
        renderPauseMenuButton(ctx, pauseMenuButtons.restart, 'Restart', false);
        leftY += primaryButtonHeight + buttonSpacing;
    }
    
    // Return to Nexus button (only in game, only for solo or host)
    if (!pausedFromNexus && (!inMultiplayer || isHost)) {
        pauseMenuButtons.nexus.x = leftColumnX;
        pauseMenuButtons.nexus.y = leftY;
        pauseMenuButtons.nexus.width = primaryButtonWidth;
        pauseMenuButtons.nexus.height = primaryButtonHeight;
        renderPauseMenuButton(ctx, pauseMenuButtons.nexus, 'To Nexus', false);
        leftY += primaryButtonHeight + buttonSpacing;
    }
    
    // RIGHT COLUMN: Settings & Info (SMALLER, RECTANGULAR)
    let rightY = startY;
    
    // Fullscreen toggle button
    const isFullscreen = Game && Game.fullscreenEnabled;
    pauseMenuButtons.fullscreen.x = rightColumnX;
    pauseMenuButtons.fullscreen.y = rightY;
    pauseMenuButtons.fullscreen.width = settingsButtonWidth;
    pauseMenuButtons.fullscreen.height = settingsButtonHeight;
    renderPauseMenuButton(ctx, pauseMenuButtons.fullscreen, isFullscreen ? 'Exit FS' : 'Fullscreen', false);
    rightY += settingsButtonHeight + buttonSpacing;
    
    // Control mode selector button
    const controlMode = Input && Input.controlMode ? Input.controlMode : 'auto';
    let controlModeText = controlMode === 'mobile' ? 'Mobile' : controlMode === 'desktop' ? 'Desktop' : 'Auto';
    pauseMenuButtons.controlMode.x = rightColumnX;
    pauseMenuButtons.controlMode.y = rightY;
    pauseMenuButtons.controlMode.width = settingsButtonWidth;
    pauseMenuButtons.controlMode.height = settingsButtonHeight;
    renderPauseMenuButton(ctx, pauseMenuButtons.controlMode, `Ctrl: ${controlModeText}`, false);
    rightY += settingsButtonHeight + buttonSpacing;
    
    // Volume button
    const volumePercent = typeof AudioManager !== 'undefined' && AudioManager.initialized ? Math.round(AudioManager.masterVolume * 100) : 50;
    const volumeMuted = typeof AudioManager !== 'undefined' && AudioManager.initialized ? AudioManager.muted : false;
    const volumeText = volumeMuted ? 'Vol: Muted' : `Vol: ${volumePercent}%`;
    pauseMenuButtons.volume.x = rightColumnX;
    pauseMenuButtons.volume.y = rightY;
    pauseMenuButtons.volume.width = settingsButtonWidth;
    pauseMenuButtons.volume.height = settingsButtonHeight;
    renderPauseMenuButton(ctx, pauseMenuButtons.volume, volumeText, false);
    rightY += settingsButtonHeight + buttonSpacing;
    
    // How to Play button
    pauseMenuButtons.howToPlay.x = rightColumnX;
    pauseMenuButtons.howToPlay.y = rightY;
    pauseMenuButtons.howToPlay.width = settingsButtonWidth;
    pauseMenuButtons.howToPlay.height = settingsButtonHeight;
    renderPauseMenuButton(ctx, pauseMenuButtons.howToPlay, 'How to Play', false);
    rightY += settingsButtonHeight + buttonSpacing;

    const telemetryEnabled = Game && Game.telemetryOptIn === true;
    const privacyLabel = telemetryEnabled === true ? 'Telemetry: On' : telemetryEnabled === false ? 'Telemetry: Off' : 'Telemetry';
    pauseMenuButtons.privacy.x = rightColumnX;
    pauseMenuButtons.privacy.y = rightY;
    pauseMenuButtons.privacy.width = settingsButtonWidth;
    pauseMenuButtons.privacy.height = settingsButtonHeight;
    renderPauseMenuButton(ctx, pauseMenuButtons.privacy, privacyLabel, false);
    rightY += settingsButtonHeight + buttonSpacing;
    
    // Updates button
    const hasNewUpdate = typeof SaveSystem !== 'undefined' && SaveSystem.shouldShowUpdateModal();
    updateButton.x = rightColumnX;
    updateButton.y = rightY;
    updateButton.width = settingsButtonWidth;
    updateButton.height = settingsButtonHeight;
    let updatesText = hasNewUpdate ? 'Updates !' : 'Updates';
    renderPauseMenuButton(ctx, updateButton, updatesText, false, hasNewUpdate);
    
    // Handle button clicks/touches
    handlePauseMenuInput();
    
    // Render multiplayer submenu if visible
    if (multiplayerMenuVisible) {
        renderMultiplayerMenu(ctx);
    }
}

// Render multiplayer submenu
function renderMultiplayerMenu(ctx) {
    const canvasWidth = Game ? Game.config.width : 1280;
    const canvasHeight = Game ? Game.config.height : 720;
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;
    
    // Detect mobile
    const isMobile = typeof Input !== 'undefined' && Input.isTouchMode && Input.isTouchMode();
    
    // Overlay with grid pattern
    ctx.fillStyle = 'rgba(15, 15, 26, 0.95)';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    // Draw grid pattern
    ctx.strokeStyle = 'rgba(100, 100, 150, 0.15)';
    ctx.lineWidth = 1;
    const gridSize = 50;
    for (let x = 0; x < canvasWidth; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvasHeight);
        ctx.stroke();
    }
    for (let y = 0; y < canvasHeight; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvasWidth, y);
        ctx.stroke();
    }
    
    // Panel (responsive to screen size - mobile optimized)
    const panelWidth = isMobile 
        ? Math.min(canvasWidth * 0.96, canvasWidth - 10)  // Mobile: 96% width
        : Math.min(500, canvasWidth * 0.85);  // Desktop: 85% width, max 500px
    const panelHeight = isMobile
        ? Math.min(canvasHeight * 0.94, canvasHeight - 10)  // Mobile: 94% height
        : Math.min(520, canvasHeight * 0.85);  // Desktop: 85% height, max 520px
    const panelX = (canvasWidth - panelWidth) / 2;
    const panelY = (canvasHeight - panelHeight) / 2;
    
    // Panel background - solid color matching game UI
    ctx.fillStyle = 'rgba(20, 20, 40, 0.95)';
    ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
    
    // Geometric corner decorations
    const cornerSize = isMobile ? 8 : 10;
    ctx.fillStyle = '#673ab7'; // Mage purple
    drawTriangle(ctx, panelX + cornerSize, panelY + cornerSize, cornerSize, Math.PI * 0.25);
    ctx.fill();
    drawTriangle(ctx, panelX + panelWidth - cornerSize, panelY + cornerSize, cornerSize, Math.PI * 0.75);
    ctx.fill();
    drawTriangle(ctx, panelX + cornerSize, panelY + panelHeight - cornerSize, cornerSize, -Math.PI * 0.25);
    ctx.fill();
    drawTriangle(ctx, panelX + panelWidth - cornerSize, panelY + panelHeight - cornerSize, cornerSize, Math.PI * 1.25);
    ctx.fill();
    
    // Outer border
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);
    
    // Inner border
    ctx.strokeStyle = '#4a90e2'; // Warrior blue
    ctx.lineWidth = 2;
    ctx.strokeRect(panelX + 3, panelY + 3, panelWidth - 6, panelHeight - 6);
    
    // Title
    ctx.fillStyle = '#ffff00'; // Selection yellow
    const titleSize = isMobile ? Math.min(36, panelWidth * 0.08) : Math.min(48, panelWidth * 0.096);
    ctx.font = `bold ${titleSize}px Arial`;
    ctx.textAlign = 'center';
    const titleY = isMobile ? panelY + 35 : panelY + 60;
    ctx.fillText('MULTIPLAYER', centerX, titleY);
    
    // Mobile: larger buttons, tighter spacing. Desktop: original sizing
    const buttonWidth = isMobile 
        ? Math.min(panelWidth * 0.92, panelWidth - 20)  // Mobile: 92% width, full-width buttons
        : Math.min(250, panelWidth * 0.7);  // Desktop: 70% width, max 250px
    const buttonHeight = isMobile 
        ? Math.min(55, panelHeight * 0.10)  // Mobile: taller buttons
        : Math.min(60, panelHeight * 0.115);  // Desktop: original
    const buttonSpacing = isMobile 
        ? Math.min(10, panelHeight * 0.018)  // Mobile: tighter spacing
        : Math.min(20, panelHeight * 0.038);  // Desktop: original
    let startY = isMobile 
        ? panelY + Math.min(70, panelHeight * 0.12)  // Mobile: start lower
        : panelY + Math.min(120, panelHeight * 0.23);  // Desktop: original
    
    const inLobby = typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.lobbyCode;
    
    if (!inLobby) {
        // Create lobby button
        multiplayerMenuButtons.createLobby.x = centerX - buttonWidth / 2;
        multiplayerMenuButtons.createLobby.y = startY;
        multiplayerMenuButtons.createLobby.width = buttonWidth;
        multiplayerMenuButtons.createLobby.height = buttonHeight;
        renderPauseMenuButton(ctx, multiplayerMenuButtons.createLobby, 'Create Lobby', false);
        
        startY += buttonHeight + buttonSpacing;
        
        // Join lobby section
        ctx.fillStyle = '#aaaaaa';
        const separatorFontSize = isMobile ? 16 : 20;
        ctx.font = `bold ${separatorFontSize}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText('- OR -', centerX, startY + (isMobile ? 15 : 20));
        
        startY += isMobile ? 35 : 50;
        
        // Join code input
        ctx.fillStyle = '#ffffff';
        const labelFontSize = isMobile ? 16 : 18;
        ctx.font = `${labelFontSize}px Arial`;
        ctx.fillText('Enter Join Code:', centerX, startY);
        
        startY += isMobile ? 25 : 30;
        
        // Input box - mobile optimized
        const inputWidth = isMobile 
            ? Math.min(panelWidth * 0.90, panelWidth - 20)  // Mobile: 90% width
            : 200;  // Desktop: fixed 200px
        const inputHeight = isMobile ? 45 : 40;  // Mobile: taller for easier touch
        const inputX = centerX - inputWidth / 2;
        const inputY = startY;
        
        ctx.fillStyle = 'rgba(30, 30, 50, 0.8)';
        ctx.fillRect(inputX, inputY, inputWidth, inputHeight);
        ctx.strokeStyle = 'rgba(150, 150, 200, 0.7)'; // Neutral light blue-gray
        ctx.lineWidth = 2;
        ctx.strokeRect(inputX, inputY, inputWidth, inputHeight);
        
        // Input text (always display in uppercase)
        ctx.fillStyle = '#ffffff';
        const inputFontSize = isMobile ? 28 : 24;  // Mobile: larger text
        ctx.font = `bold ${inputFontSize}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText((joinCodeInput || '_').toUpperCase(), centerX, inputY + inputHeight / 2 + (isMobile ? 10 : 8));
        
        startY += inputHeight + (isMobile ? 12 : 10);
        
        // Paste Code button - mobile optimized
        const pasteButtonWidth = isMobile 
            ? buttonWidth  // Mobile: full width like other buttons
            : Math.min(220, panelWidth * 0.65);  // Desktop: original sizing
        const pasteButtonHeight = isMobile ? buttonHeight : 40;  // Mobile: same height as other buttons
        multiplayerMenuButtons.pasteCode.x = centerX - pasteButtonWidth / 2;
        multiplayerMenuButtons.pasteCode.y = startY;
        multiplayerMenuButtons.pasteCode.width = pasteButtonWidth;
        multiplayerMenuButtons.pasteCode.height = pasteButtonHeight;
        renderPauseMenuButton(ctx, multiplayerMenuButtons.pasteCode, '📋 Paste Code', false);
        
        startY += pasteButtonHeight + buttonSpacing;
        
        // Join button
        multiplayerMenuButtons.joinLobby.x = centerX - buttonWidth / 2;
        multiplayerMenuButtons.joinLobby.y = startY;
        multiplayerMenuButtons.joinLobby.width = buttonWidth;
        multiplayerMenuButtons.joinLobby.height = buttonHeight;
        renderPauseMenuButton(ctx, multiplayerMenuButtons.joinLobby, 'Join Lobby', false);
    } else {
        // In lobby - show lobby info and leave button
        ctx.fillStyle = '#00ff00';
        const lobbyCodeFontSize = isMobile ? 24 : 32;
        ctx.font = `bold ${lobbyCodeFontSize}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText(`Lobby: ${multiplayerManager.lobbyCode}`, centerX, startY);
        
        startY += isMobile ? 40 : 50;
        
        // Copy Code button - mobile optimized
        const copyButtonWidth = isMobile ? buttonWidth : 150;  // Mobile: full width
        const copyButtonHeight = isMobile ? buttonHeight : 35;  // Mobile: same height as other buttons
        multiplayerMenuButtons.copyCode.x = centerX - copyButtonWidth / 2;
        multiplayerMenuButtons.copyCode.y = startY;
        multiplayerMenuButtons.copyCode.width = copyButtonWidth;
        multiplayerMenuButtons.copyCode.height = copyButtonHeight;
        renderPauseMenuButton(ctx, multiplayerMenuButtons.copyCode, '📋 Copy Code', false);
        
        // Show feedback message if code was just copied
        if (copyCodeFeedback) {
            ctx.fillStyle = '#00ff00';
            const feedbackFontSize = isMobile ? 12 : 14;
            ctx.font = `${feedbackFontSize}px Arial`;
            ctx.fillText(copyCodeFeedback, centerX, startY + copyButtonHeight + (isMobile ? 15 : 20));
        }
        
        startY += copyButtonHeight + (isMobile ? 35 : 50);
        
        // Player list
        ctx.fillStyle = '#ffffff';
        const playersLabelFontSize = isMobile ? 16 : 18;
        ctx.font = `${playersLabelFontSize}px Arial`;
        ctx.fillText(`Players: ${multiplayerManager.players.length}/${MultiplayerConfig.MAX_PLAYERS}`, centerX, startY);
        
        startY += isMobile ? 30 : 40;
        
        // List players - mobile optimized
        if (multiplayerManager.players) {
            const playerListX = isMobile ? panelX + 15 : panelX + 50;  // Mobile: less padding
            const playerFontSize = isMobile ? 14 : 16;
            const playerLineHeight = isMobile ? 22 : 25;
            multiplayerManager.players.forEach((player, index) => {
                const playerText = `${index + 1}. ${player.name} (${player.class})`;
                const isHost = index === 0;
                ctx.fillStyle = isHost ? '#ffaa00' : '#aaaaaa';
                ctx.font = `${playerFontSize}px Arial`;
                ctx.textAlign = 'left';
                ctx.fillText(playerText, playerListX, startY + (index * playerLineHeight));
                if (isHost) {
                    const hostX = isMobile ? panelX + panelWidth - 80 : panelX + 350;  // Mobile: right-aligned
                    ctx.fillText('(Host)', hostX, startY + (index * playerLineHeight));
                }
            });
        }
        
        // Leave lobby button - positioned above back button
        const leaveButtonY = isMobile 
            ? panelY + panelHeight - (buttonHeight + buttonSpacing + 60)  // Mobile: account for back button
            : panelY + panelHeight - 140;  // Desktop: original
        multiplayerMenuButtons.leaveLobby.x = centerX - buttonWidth / 2;
        multiplayerMenuButtons.leaveLobby.y = leaveButtonY;
        multiplayerMenuButtons.leaveLobby.width = buttonWidth;
        multiplayerMenuButtons.leaveLobby.height = buttonHeight;
        renderPauseMenuButton(ctx, multiplayerMenuButtons.leaveLobby, 'Leave Lobby', false);
    }
    
    // Error message - mobile optimized
    if (multiplayerError) {
        ctx.fillStyle = '#ff0000';
        const errorFontSize = isMobile ? 14 : 16;
        ctx.font = `${errorFontSize}px Arial`;
        ctx.textAlign = 'center';
        const errorY = isMobile 
            ? panelY + panelHeight - (buttonHeight + buttonSpacing + 30)
            : panelY + panelHeight - 80;
        ctx.fillText(multiplayerError, centerX, errorY);
    }
    
    // Back button - mobile optimized
    const backButtonHeight = isMobile ? buttonHeight : 40;
    multiplayerMenuButtons.back.x = centerX - buttonWidth / 2;
    multiplayerMenuButtons.back.y = panelY + panelHeight - (isMobile ? (backButtonHeight + 10) : 50);
    multiplayerMenuButtons.back.width = buttonWidth;
    multiplayerMenuButtons.back.height = backButtonHeight;
    renderPauseMenuButton(ctx, multiplayerMenuButtons.back, 'Back', false);
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
    
    console.log('[PAUSE MENU] Checking buttons - multiplayerMenuVisible:', multiplayerMenuVisible, 'pausedFromState:', Game ? Game.pausedFromState : 'no Game');
    
    // CHECK MULTIPLAYER SUBMENU FIRST (highest priority when visible)
    if (multiplayerMenuVisible) {
        // Back button
        if (x >= multiplayerMenuButtons.back.x && x <= multiplayerMenuButtons.back.x + multiplayerMenuButtons.back.width &&
            y >= multiplayerMenuButtons.back.y && y <= multiplayerMenuButtons.back.y + multiplayerMenuButtons.back.height) {
            multiplayerMenuButtons.back.pressed = true;
            setTimeout(() => { multiplayerMenuButtons.back.pressed = false; }, 100);
            // Just close the multiplayer submenu, keep the pause menu open
            multiplayerMenuVisible = false;
            
            // Don't close the pause menu - just return to main pause menu
            // The pause menu should remain open showing the main buttons
            
            return true;
        }
        
        const inLobby = typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.lobbyCode;
        
        if (!inLobby) {
            // Create lobby button
            if (x >= multiplayerMenuButtons.createLobby.x && x <= multiplayerMenuButtons.createLobby.x + multiplayerMenuButtons.createLobby.width &&
                y >= multiplayerMenuButtons.createLobby.y && y <= multiplayerMenuButtons.createLobby.y + multiplayerMenuButtons.createLobby.height) {
                multiplayerMenuButtons.createLobby.pressed = true;
                setTimeout(() => { multiplayerMenuButtons.createLobby.pressed = false; }, 100);
                handleCreateLobby();
                return true;
            }
            
            // Paste Code button
            if (x >= multiplayerMenuButtons.pasteCode.x && x <= multiplayerMenuButtons.pasteCode.x + multiplayerMenuButtons.pasteCode.width &&
                y >= multiplayerMenuButtons.pasteCode.y && y <= multiplayerMenuButtons.pasteCode.y + multiplayerMenuButtons.pasteCode.height) {
                multiplayerMenuButtons.pasteCode.pressed = true;
                setTimeout(() => { multiplayerMenuButtons.pasteCode.pressed = false; }, 100);
                handlePasteCode();
                return true;
            }
            
            // Join lobby button
            if (x >= multiplayerMenuButtons.joinLobby.x && x <= multiplayerMenuButtons.joinLobby.x + multiplayerMenuButtons.joinLobby.width &&
                y >= multiplayerMenuButtons.joinLobby.y && y <= multiplayerMenuButtons.joinLobby.y + multiplayerMenuButtons.joinLobby.height) {
                multiplayerMenuButtons.joinLobby.pressed = true;
                setTimeout(() => { multiplayerMenuButtons.joinLobby.pressed = false; }, 100);
                handleJoinLobby();
                return true;
            }
        } else {
            // Copy Code button
            if (x >= multiplayerMenuButtons.copyCode.x && x <= multiplayerMenuButtons.copyCode.x + multiplayerMenuButtons.copyCode.width &&
                y >= multiplayerMenuButtons.copyCode.y && y <= multiplayerMenuButtons.copyCode.y + multiplayerMenuButtons.copyCode.height) {
                multiplayerMenuButtons.copyCode.pressed = true;
                setTimeout(() => { multiplayerMenuButtons.copyCode.pressed = false; }, 100);
                handleCopyCode();
                return true;
            }
            
            // Leave lobby button
            if (x >= multiplayerMenuButtons.leaveLobby.x && x <= multiplayerMenuButtons.leaveLobby.x + multiplayerMenuButtons.leaveLobby.width &&
                y >= multiplayerMenuButtons.leaveLobby.y && y <= multiplayerMenuButtons.leaveLobby.y + multiplayerMenuButtons.leaveLobby.height) {
                multiplayerMenuButtons.leaveLobby.pressed = true;
                setTimeout(() => { multiplayerMenuButtons.leaveLobby.pressed = false; }, 100);
                handleLeaveLobby();
                return true;
            }
        }
        
        // If multiplayer menu is visible and we clicked somewhere (but not on a button),
        // don't check main menu buttons - consume the click
        return false;
    }
    
    // Check resume button
    if (x >= pauseMenuButtons.resume.x && x <= pauseMenuButtons.resume.x + pauseMenuButtons.resume.width &&
        y >= pauseMenuButtons.resume.y && y <= pauseMenuButtons.resume.y + pauseMenuButtons.resume.height) {
        if (Game && Game.togglePause) {
            Game.togglePause();
            return true;
        }
    }
    
    // Check multiplayer button (only visible when paused from nexus) - CHECK BEFORE RESTART!
    if (Game && Game.pausedFromState === 'NEXUS') {
        console.log('[PAUSE MENU] Checking multiplayer button region - x:', x, 'y:', y, 'button bounds:', pauseMenuButtons.multiplayer);
        if (x >= pauseMenuButtons.multiplayer.x && x <= pauseMenuButtons.multiplayer.x + pauseMenuButtons.multiplayer.width &&
            y >= pauseMenuButtons.multiplayer.y && y <= pauseMenuButtons.multiplayer.y + pauseMenuButtons.multiplayer.height) {
            console.log('[PAUSE MENU] ✓ Multiplayer button region HIT! Setting multiplayerMenuVisible = true');
            multiplayerMenuVisible = true;
            multiplayerError = '';
            return true;
        }
    } else {
        console.log('[PAUSE MENU] Multiplayer button NOT visible - pausedFromState:', Game ? Game.pausedFromState : 'no Game');
    }
    
    // Check restart button (only visible when NOT paused from nexus)
    const pausedFromNexus = Game && Game.pausedFromState === 'NEXUS';
    if (!pausedFromNexus) {
        if (x >= pauseMenuButtons.restart.x && x <= pauseMenuButtons.restart.x + pauseMenuButtons.restart.width &&
            y >= pauseMenuButtons.restart.y && y <= pauseMenuButtons.restart.y + pauseMenuButtons.restart.height) {
            if (Game && Game.restart) {
                console.log('[PAUSE MENU] ✓ Restart button HIT!');
                Game.restart();
                return true;
            }
        }
    }
    
    // Check nexus button (only visible when NOT paused from nexus)
    if (!pausedFromNexus) {
        if (x >= pauseMenuButtons.nexus.x && x <= pauseMenuButtons.nexus.x + pauseMenuButtons.nexus.width &&
            y >= pauseMenuButtons.nexus.y && y <= pauseMenuButtons.nexus.y + pauseMenuButtons.nexus.height) {
            if (Game && Game.returnToNexus) {
                console.log('[PAUSE MENU] ✓ Return to Nexus button HIT!');
                Game.returnToNexus();
                return true;
            }
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
    
    // Check volume button
    if (x >= pauseMenuButtons.volume.x && x <= pauseMenuButtons.volume.x + pauseMenuButtons.volume.width &&
        y >= pauseMenuButtons.volume.y && y <= pauseMenuButtons.volume.y + pauseMenuButtons.volume.height) {
        if (typeof AudioManager !== 'undefined') {
            // Initialize audio if not initialized
            if (!AudioManager.initialized) {
                AudioManager.init();
            }
            
            // Cycle volume: 100% -> 75% -> 50% -> 25% -> 0% (muted) -> 100%
            if (AudioManager.muted || AudioManager.masterVolume === 0) {
                AudioManager.setMute(false);
                AudioManager.setVolume(1.0);
            } else if (AudioManager.masterVolume > 0.75) {
                AudioManager.setVolume(0.75);
            } else if (AudioManager.masterVolume > 0.50) {
                AudioManager.setVolume(0.50);
            } else if (AudioManager.masterVolume > 0.25) {
                AudioManager.setVolume(0.25);
            } else {
                AudioManager.setMute(true);
            }
            
            console.log(`Volume: ${AudioManager.muted ? 'Muted' : Math.round(AudioManager.masterVolume * 100) + '%'}`);
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

    // Check privacy settings button
    if (x >= pauseMenuButtons.privacy.x && x <= pauseMenuButtons.privacy.x + pauseMenuButtons.privacy.width &&
        y >= pauseMenuButtons.privacy.y && y <= pauseMenuButtons.privacy.y + pauseMenuButtons.privacy.height) {
        if (Game && Game.openPrivacyModal) {
            Game.openPrivacyModal('pause');
            return true;
        }
    }
    
    // Check square update button (always available)
    if (updateButton.width > 0 && updateButton.height > 0) {
        if (x >= updateButton.x && x <= updateButton.x + updateButton.width &&
            y >= updateButton.y && y <= updateButton.y + updateButton.height) {
            if (Game) {
                Game.updateModalVisible = true;
                return true;
            }
        }
    }
    
    return false;
}

// Handle create lobby
async function handleCreateLobby() {
    try {
        multiplayerError = 'Connecting...';
        
        // Load multiplayer module if not loaded
        if (Game && !Game.multiplayerModuleLoaded) {
            await Game.loadMultiplayerModule();
        }
        
        // Initialize multiplayer manager
        if (typeof initMultiplayer !== 'undefined') {
            window.multiplayerManager = initMultiplayer();
        }
        
        if (!multiplayerManager) {
            multiplayerError = 'Failed to initialize multiplayer';
            return;
        }
        
        // Create lobby
        await multiplayerManager.createLobby('Player', Game.selectedClass || 'square');
        
        if (Game) {
            Game.multiplayerEnabled = true;
        }
        
        multiplayerError = '';
    } catch (err) {
        console.error('[UI] Failed to create lobby:', err);
        multiplayerError = `Error: ${err.message || 'Failed to connect to server'}`;
    }
}

// Handle join lobby
async function handleJoinLobby() {
    try {
        multiplayerError = '';
        
        if (!joinCodeInput || joinCodeInput.length < 6) {
            multiplayerError = 'Enter a valid 6-character code';
            return;
        }
        
        // Load multiplayer module if not loaded
        if (Game && !Game.multiplayerModuleLoaded) {
            await Game.loadMultiplayerModule();
        }
        
        // Initialize multiplayer manager
        if (typeof initMultiplayer !== 'undefined') {
            window.multiplayerManager = initMultiplayer();
        }
        
        if (!multiplayerManager) {
            multiplayerError = 'Failed to initialize multiplayer';
            return;
        }
        
        // Join lobby (ensure code is uppercase)
        await multiplayerManager.joinLobby(joinCodeInput.toUpperCase(), 'Player', Game.selectedClass);
        
        if (Game) {
            Game.multiplayerEnabled = true;
        }
        
        joinCodeInput = '';
        console.log('[UI] Joined lobby');
    } catch (err) {
        console.error('[UI] Failed to join lobby:', err);
        multiplayerError = 'Failed to join lobby';
    }
}

// Handle leave lobby
function handleLeaveLobby() {
    if (multiplayerManager) {
        multiplayerManager.leaveLobby();
    }
    
    if (Game) {
        Game.multiplayerEnabled = false;
        // Reset pause menu state if it was showing
        Game.showPauseMenu = false;
        
        // If we're in nexus pause menu, close it properly
        if (Game.state === 'PAUSED' && Game.pausedFromState === 'NEXUS') {
            if (Game.togglePause) {
                Game.togglePause(); // Resume from paused state back to nexus
            }
        }
    }
    
    multiplayerMenuVisible = false;
    copyCodeFeedback = '';
    console.log('[UI] Left lobby');
}

// Handle copy code to clipboard
function handleCopyCode() {
    if (!multiplayerManager || !multiplayerManager.lobbyCode) {
        return;
    }
    
    const code = multiplayerManager.lobbyCode;
    
    // Try to copy to clipboard using modern API
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code)
            .then(() => {
                copyCodeFeedback = 'Code copied to clipboard!';
                console.log('[UI] Copied lobby code to clipboard:', code);
                
                // Clear feedback after 3 seconds
                setTimeout(() => {
                    copyCodeFeedback = '';
                }, 3000);
            })
            .catch(err => {
                console.error('[UI] Failed to copy code:', err);
                copyCodeFeedback = 'Failed to copy code';
                setTimeout(() => {
                    copyCodeFeedback = '';
                }, 3000);
            });
    } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = code;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            const successful = document.execCommand('copy');
            if (successful) {
                copyCodeFeedback = 'Code copied to clipboard!';
                console.log('[UI] Copied lobby code to clipboard (fallback):', code);
            } else {
                copyCodeFeedback = 'Failed to copy code';
            }
        } catch (err) {
            console.error('[UI] Failed to copy code (fallback):', err);
            copyCodeFeedback = 'Failed to copy code';
        }
        
        document.body.removeChild(textArea);
        
        // Clear feedback after 3 seconds
        setTimeout(() => {
            copyCodeFeedback = '';
        }, 3000);
    }
}

// Handle paste code from clipboard
async function handlePasteCode() {
    try {
        let pastedText = '';
        
        // Try modern clipboard API first
        if (navigator.clipboard && navigator.clipboard.readText) {
            try {
                pastedText = await navigator.clipboard.readText();
            } catch (clipboardErr) {
                // Clipboard access denied - user needs to use Ctrl+V
                console.log('[UI] Clipboard access denied, user should use Ctrl+V');
                multiplayerError = 'Use Ctrl+V to paste (or Cmd+V on Mac)';
                setTimeout(() => {
                    multiplayerError = '';
                }, 3000);
                return;
            }
        } else {
            // Fallback for older browsers - can't really read clipboard without user paste action
            multiplayerError = 'Use Ctrl+V to paste (or Cmd+V on Mac)';
            setTimeout(() => {
                multiplayerError = '';
            }, 3000);
            return;
        }
        
        if (pastedText) {
            // Filter to alphanumeric only, convert to uppercase, limit to 6 characters
            const filtered = pastedText
                .split('')
                .filter(char => /[a-zA-Z0-9]/.test(char))
                .map(char => char.toUpperCase())
                .slice(0, 6)
                .join('');
            
            if (filtered.length > 0) {
                joinCodeInput = filtered;
                console.log('[UI] Pasted code from clipboard:', filtered);
                // Clear any error message
                multiplayerError = '';
            } else {
                multiplayerError = 'No valid code in clipboard';
                setTimeout(() => {
                    multiplayerError = '';
                }, 2000);
            }
        } else {
            multiplayerError = 'Clipboard is empty';
            setTimeout(() => {
                multiplayerError = '';
            }, 2000);
        }
    } catch (err) {
        console.error('[UI] Failed to read from clipboard:', err);
        multiplayerError = 'Use Ctrl+V to paste (or Cmd+V on Mac)';
        setTimeout(() => {
            multiplayerError = '';
        }, 3000);
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

// Loot selection system - handles cycling through nearby items
const LootSelection = {
    nearbyItems: [], // Array of gear items within pickup range
    selectedIndex: 0, // Currently selected item index
    lastCycleTime: 0, // Prevent rapid cycling
    cycleCooldown: 150, // ms between cycles
    
    // Update nearby items list
    updateNearbyItems(player) {
        if (!player || !player.alive || typeof groundLoot === 'undefined') {
            this.nearbyItems = [];
            this.selectedIndex = 0;
            return;
        }
        
        const pickupRange = 50;
        const nearby = [];
        
        groundLoot.forEach(gear => {
            const dx = gear.x - player.x;
            const dy = gear.y - player.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < pickupRange) {
                nearby.push({
                    gear: gear,
                    distance: distance
                });
            }
        });
        
        // Sort by distance (closest first)
        nearby.sort((a, b) => a.distance - b.distance);
        
        // Update list
        const previousSelectedGear = this.getSelectedGear();
        this.nearbyItems = nearby.map(item => item.gear);
        
        // Try to maintain selection if possible
        if (previousSelectedGear && this.nearbyItems.length > 0) {
            const previousIndex = this.nearbyItems.findIndex(g => g.id === previousSelectedGear.id);
            if (previousIndex !== -1) {
                this.selectedIndex = previousIndex;
            } else {
                // Previous selection no longer nearby, reset to closest
                this.selectedIndex = 0;
            }
        } else {
            this.selectedIndex = 0;
        }
        
        // Clamp index
        if (this.selectedIndex >= this.nearbyItems.length) {
            this.selectedIndex = Math.max(0, this.nearbyItems.length - 1);
        }
    },
    
    // Get currently selected gear
    getSelectedGear() {
        if (this.nearbyItems.length === 0) return null;
        return this.nearbyItems[this.selectedIndex] || null;
    },
    
    // Cycle to next item
    cycleNext() {
        const now = Date.now();
        if (now - this.lastCycleTime < this.cycleCooldown) return;
        
        if (this.nearbyItems.length > 1) {
            this.selectedIndex = (this.selectedIndex + 1) % this.nearbyItems.length;
            this.lastCycleTime = now;
            return true;
        }
        return false;
    },
    
    // Cycle to previous item
    cyclePrevious() {
        const now = Date.now();
        if (now - this.lastCycleTime < this.cycleCooldown) return;
        
        if (this.nearbyItems.length > 1) {
            this.selectedIndex = (this.selectedIndex - 1 + this.nearbyItems.length) % this.nearbyItems.length;
            this.lastCycleTime = now;
            return true;
        }
        return false;
    },
    
    // Get count of nearby items
    getCount() {
        return this.nearbyItems.length;
    }
};

// Check for gear pickup interaction
function checkGearInteraction() {
    if (!Game || !Game.player || !Game.player.alive || typeof groundLoot === 'undefined') {
        return null;
    }
    
    // Update nearby items and get selected gear
    LootSelection.updateNearbyItems(Game.player);
    const selectedGear = LootSelection.getSelectedGear();
    
    if (selectedGear) {
        return { type: 'gear', data: selectedGear };
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
    
    // Position button (center-bottom, low on screen but above touch controls)
    const canvasWidth = Game ? Game.config.width : 1280;
    const canvasHeight = Game ? Game.config.height : 720;
    const buttonWidth = 200;
    const buttonHeight = 60;
    const buttonX = (canvasWidth - buttonWidth) / 2;
    // Position at ~150px from bottom (above touch controls at ~16-18% from bottom)
    const buttonY = canvasHeight - 150;
    
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
    
    console.log('[INTERACTION BTN] Checking click - interaction:', currentInteraction);
    
    if (interactionButton.contains(x, y)) {
        interactionButton.pressed = true;
        interactionButton.justPressed = true;
        
        // Trigger the interaction directly
        if (Game && Game.state === 'PLAYING' && currentInteraction.type === 'gear') {
            // Use selected gear from LootSelection
            if (typeof LootSelection !== 'undefined') {
                LootSelection.updateNearbyItems(Game.player);
                const selectedGear = LootSelection.getSelectedGear();
                if (selectedGear && Game.pickupGear) {
                    Game.pickupGear(selectedGear);
                }
            } else {
                // Fallback to closest gear
                if (Game.checkGearPickup && Game.player && Game.player.alive && typeof groundLoot !== 'undefined') {
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

// Render mobile loot selection UI (when multiple items nearby)
function renderMobileLootSelection(ctx) {
    if (!Input || !Input.isTouchMode || !Input.isTouchMode()) {
        return;
    }
    
    if (!Game || Game.state !== 'PLAYING' || !Game.player || !Game.player.alive) {
        return;
    }
    
    // Update nearby items
    if (typeof LootSelection === 'undefined') return;
    LootSelection.updateNearbyItems(Game.player);
    const nearbyCount = LootSelection.getCount();
    
    // Only show if multiple items nearby
    if (nearbyCount <= 1) return;
    
    const canvasWidth = Game ? Game.config.width : 1280;
    const canvasHeight = Game ? Game.config.height : 720;
    
    // Create loot selection panel at top-center
    const panelWidth = Math.min(400, canvasWidth - 40);
    const panelHeight = 80;
    const panelX = (canvasWidth - panelWidth) / 2;
    const panelY = 20;
    
    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
    
    // Border
    ctx.strokeStyle = '#ffff00';
    ctx.lineWidth = 2;
    ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);
    
    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`Select Loot (${LootSelection.selectedIndex + 1}/${nearbyCount}):`, panelX + 10, panelY + 22);
    
    // Cycle buttons
    const buttonSize = 40;
    const buttonY = panelY + 35;
    const leftButtonX = panelX + 10;
    const rightButtonX = panelX + panelWidth - buttonSize - 10;
    
    // Left arrow button (always enabled when multiple items)
    ctx.fillStyle = 'rgba(100, 150, 255, 0.8)';
    ctx.fillRect(leftButtonX, buttonY, buttonSize, buttonSize);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(leftButtonX, buttonY, buttonSize, buttonSize);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('←', leftButtonX + buttonSize / 2, buttonY + buttonSize / 2);
    
    // Right arrow button (always enabled when multiple items)
    ctx.fillStyle = 'rgba(100, 150, 255, 0.8)';
    ctx.fillRect(rightButtonX, buttonY, buttonSize, buttonSize);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(rightButtonX, buttonY, buttonSize, buttonSize);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('→', rightButtonX + buttonSize / 2, buttonY + buttonSize / 2);
    
    // Selected item name (center)
    const selectedGear = LootSelection.getSelectedGear();
    if (selectedGear) {
        const centerX = panelX + panelWidth / 2;
        ctx.fillStyle = selectedGear.color || '#ffffff';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        const gearName = selectedGear.name || `${selectedGear.tier} ${selectedGear.slot}`;
        ctx.fillText(gearName, centerX, buttonY + buttonSize / 2);
    }
}

// Handle mobile loot selection button clicks
function handleMobileLootSelectionClick(x, y) {
    if (!Input || !Input.isTouchMode || !Input.isTouchMode()) {
        return false;
    }
    
    if (!Game || Game.state !== 'PLAYING') {
        return false;
    }
    
    if (typeof LootSelection === 'undefined') return false;
    LootSelection.updateNearbyItems(Game.player);
    const nearbyCount = LootSelection.getCount();
    
    if (nearbyCount <= 1) return false;
    
    const canvasWidth = Game ? Game.config.width : 1280;
    const panelWidth = Math.min(400, canvasWidth - 40);
    const panelX = (canvasWidth - panelWidth) / 2;
    const panelY = 20;
    const buttonSize = 40;
    const buttonY = panelY + 35;
    const leftButtonX = panelX + 10;
    const rightButtonX = panelX + panelWidth - buttonSize - 10;
    
    // Check left button (wraps around)
    if (x >= leftButtonX && x <= leftButtonX + buttonSize &&
        y >= buttonY && y <= buttonY + buttonSize) {
        LootSelection.cyclePrevious();
        return true;
    }
    
    // Check right button (wraps around)
    if (x >= rightButtonX && x <= rightButtonX + buttonSize &&
        y >= buttonY && y <= buttonY + buttonSize) {
        LootSelection.cycleNext();
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
        
        // Draw unified cluster background (subtle glow/outline) - much tighter, 1/3 size
        const backgroundRadius = maxDistance / 3;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.beginPath();
        ctx.arc(centerX, centerY, backgroundRadius, 0, Math.PI * 2);
        ctx.fill();
        
        // Outer glow ring for cohesion
        ctx.strokeStyle = 'rgba(150, 150, 200, 0.2)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(centerX, centerY, backgroundRadius, 0, Math.PI * 2);
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
        const playerClass = player.playerClass || 'square';
        
        // Heavy attack button (always show)
        if (Input.touchButtons.heavyAttack) {
            // For Mage, show charge count instead of cooldown
            if (player.playerClass === 'hexagon' && player.maxBeamCharges > 1) {
                // Pass charges instead of cooldown for touch button display
                const longestCooldown = Math.max(...player.beamChargeCooldowns);
                Input.touchButtons.heavyAttack.render(ctx, 
                    longestCooldown,
                    player.heavyAttackCooldownTime || 1.5,
                    player.beamCharges); // Pass current charges
            } else {
                Input.touchButtons.heavyAttack.render(ctx, 
                    player.heavyAttackCooldown || 0, 
                    player.heavyAttackCooldownTime || 1.5);
            }
        }
        
        // Special ability button (always show, joystick hidden for triangle/square)
        if (Input.touchButtons.specialAbility) {
            Input.touchButtons.specialAbility.render(ctx, 
                player.specialCooldown || 0, 
                player.specialCooldownTime || 5.0);
        }
        
        // Dodge button (hide for triangle, show for others)
        if (Input.touchButtons.dodge && playerClass !== 'triangle') {
            const dodgeMaxCooldown = player.dodgeCooldownTime || 2.0;
            const hasMultipleDodgeCharges = (player.maxDodgeCharges || 0) > 1;
            
            if (hasMultipleDodgeCharges && player.dodgeChargeCooldowns) {
                const chargeCooldowns = player.dodgeChargeCooldowns;
                const longestCooldown = chargeCooldowns.length ? Math.max(...chargeCooldowns) : 0;
                const readyCharges = chargeCooldowns.filter(c => c <= 0).length;
                Input.touchButtons.dodge.render(ctx, longestCooldown, dodgeMaxCooldown, readyCharges);
            } else {
                const dodgeCooldown = player.dodgeCooldown || 0;
                Input.touchButtons.dodge.render(ctx, dodgeCooldown, dodgeMaxCooldown);
            }
        }
        
        // Character sheet button (always show in top-right)
        if (Input.touchButtons.characterSheet) {
            Input.touchButtons.characterSheet.render(ctx, 0, 1);
        }
        
        // RADIAL COOLDOWN INDICATORS around joysticks (mobile only)
        // (playerClass already declared above)
        
        // Dodge joystick cooldown (for triangle/rogue - shows as radial arc)
        if (Input.touchJoysticks.dodge && playerClass === 'triangle' && player.dodgeChargeCooldowns) {
            const joystick = Input.touchJoysticks.dodge;
            const radius = joystick.radius + 8; // Slightly outside joystick
            
            // Render each charge as a segment
            const charges = player.dodgeChargeCooldowns.length;
            const anglePerCharge = (Math.PI * 2) / charges;
            
            for (let i = 0; i < charges; i++) {
                const cooldown = player.dodgeChargeCooldowns[i];
                const maxCooldown = player.dodgeCooldownTime;
                const startAngle = -Math.PI / 2 + (anglePerCharge * i);
                const endAngle = startAngle + anglePerCharge;
                
                // Draw cooldown arc
                ctx.lineWidth = 4;
                ctx.strokeStyle = cooldown > 0 ? '#ff4444' : '#44ff44';
                ctx.beginPath();
                if (cooldown > 0) {
                    // Show progress
                    const progress = 1 - (cooldown / maxCooldown);
                    ctx.arc(joystick.centerX, joystick.centerY, radius, startAngle, startAngle + anglePerCharge * progress);
                } else {
                    // Full charge
                    ctx.arc(joystick.centerX, joystick.centerY, radius, startAngle, endAngle);
                }
                ctx.stroke();
            }
            
            // Draw charge count
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            ctx.shadowBlur = 2;
            ctx.shadowColor = '#000000';
            const readyCharges = player.dodgeChargeCooldowns.filter(c => c <= 0).length;
            ctx.fillText(readyCharges, joystick.centerX + radius + 15, joystick.centerY - radius - 5);
            ctx.shadowBlur = 0;
        }
        
        // Heavy attack joystick cooldown (for classes with directional heavy)
        if (Input.touchJoysticks.heavyAttack && player.heavyAttackCooldown !== undefined) {
            const joystick = Input.touchJoysticks.heavyAttack;
            if (joystick.centerX && joystick.centerY) {
                const radius = joystick.radius + 6;
                // For Mage with charges, use longest cooldown
                const cooldown = (player.playerClass === 'hexagon' && player.maxBeamCharges > 1) 
                    ? Math.max(...player.beamChargeCooldowns) 
                    : player.heavyAttackCooldown;
                const maxCooldown = player.heavyAttackCooldownTime || 1.5;
                
                // Draw cooldown arc (full circle)
                ctx.lineWidth = 4;
                if (cooldown > 0) {
                    const progress = 1 - (cooldown / maxCooldown);
                    ctx.strokeStyle = '#ff4444';
                    ctx.beginPath();
                    ctx.arc(joystick.centerX, joystick.centerY, radius, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * progress));
                    ctx.stroke();
                } else {
                    ctx.strokeStyle = '#44ff44';
                    ctx.beginPath();
                    ctx.arc(joystick.centerX, joystick.centerY, radius, 0, Math.PI * 2);
                    ctx.stroke();
                }
                
                // Show charge count for Mage beam
                if (player.playerClass === 'hexagon' && player.maxBeamCharges > 1) {
                    ctx.font = 'bold 18px Arial';
                    ctx.fillStyle = '#ffffff';
                    ctx.textAlign = 'left';
                    ctx.textBaseline = 'middle';
                    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
                    ctx.shadowBlur = 4;
                    const readyCharges = player.beamCharges || 0;
                    ctx.fillText(readyCharges, joystick.centerX + radius + 15, joystick.centerY - radius - 5);
                    ctx.shadowBlur = 0;
                }
            }
        }
        
        // Special ability joystick cooldown
        if (Input.touchJoysticks.specialAbility && player.specialCooldown !== undefined) {
            const joystick = Input.touchJoysticks.specialAbility;
            if (joystick.centerX && joystick.centerY) {
                const radius = joystick.radius + 6;
                const cooldown = player.specialCooldown;
                const maxCooldown = player.specialCooldownTime || 5.0;
                
                // Draw cooldown arc (full circle)
                ctx.lineWidth = 4;
                if (cooldown > 0) {
                    const progress = 1 - (cooldown / maxCooldown);
                    ctx.strokeStyle = '#ff4444';
                    ctx.beginPath();
                    ctx.arc(joystick.centerX, joystick.centerY, radius, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * progress));
                    ctx.stroke();
                } else {
                    ctx.strokeStyle = '#44ff44';
                    ctx.beginPath();
                    ctx.arc(joystick.centerX, joystick.centerY, radius, 0, Math.PI * 2);
                    ctx.stroke();
                }
            }
        }
    }
}

// Render spectator mode indicator
function renderSpectatorIndicator(ctx) {
    const canvasWidth = Game ? Game.config.width : 1280;
    const canvasHeight = Game ? Game.config.height : 720;
    
    // Semi-transparent overlay at top
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, canvasWidth, 80);
    
    const centerX = canvasWidth / 2;
    
    // Main spectator text
    ctx.fillStyle = '#ff6666';
    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('SPECTATING', centerX, 30);
    
    // Get spectated player name
    let spectatedName = 'Player';
    if (Game.spectatedPlayerId && typeof multiplayerManager !== 'undefined' && multiplayerManager) {
        const spectatedPlayer = multiplayerManager.players.find(p => p.id === Game.spectatedPlayerId);
        if (spectatedPlayer && spectatedPlayer.name) {
            spectatedName = spectatedPlayer.name;
        }
    }
    
    // Spectated player name
    ctx.fillStyle = '#ffffff';
    ctx.font = '20px Arial';
    ctx.fillText(`Following: ${spectatedName}`, centerX, 58);
    
    // Revival hint
    ctx.fillStyle = '#aaaaaa';
    ctx.font = 'italic 16px Arial';
    ctx.fillText('You will be revived when the team reaches the next room', centerX, canvasHeight - 20);
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
    // In multiplayer, only show death screen when ALL players are dead
    // If local player dead but others alive, just spectate (no death screen overlay)
    const inMultiplayer = Game.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.lobbyCode;
    const showDeathScreen = player.dead && (!inMultiplayer || Game.allPlayersDead);
    
    if (!showDeathScreen) {
        // Render normal UI elements when alive or spectating
        if (!player.dead) {
            renderHealthBar(ctx, player);
            renderXPBar(ctx, player);
            renderCooldownIndicators(ctx, player);
            
            // Render gear tooltips
            if (typeof renderGearTooltips === 'function') {
                renderGearTooltips(ctx, player);
            }
        }
        // When dead but spectating (multiplayer), show spectator indicator
        if (player.dead && inMultiplayer && Game.spectateMode) {
            renderSpectatorIndicator(ctx);
        }
        
        // Render other players' health bars in multiplayer (when alive or spectating)
        if (inMultiplayer) {
            renderOtherPlayersHealthBars(ctx);
        }
    } else {
        // Only show death screen in solo OR when all players dead in multiplayer
        renderDeathScreen(ctx, player);
    }
    
    // Render pause button (if playing or in nexus)
    if ((Game.state === 'PLAYING' || Game.state === 'NEXUS') && typeof renderPauseButton === 'function') {
        renderPauseButton(ctx);
    }
    
    // Update and render character sheet (always render on top of game but below touch controls)
    if (typeof Input !== 'undefined' && Input.getKeyState) {
        updateCharacterSheet(Input);
    }
    if (typeof renderCharacterSheet === 'function') {
        renderCharacterSheet(ctx, player);
    }
    
    // Render touch controls (on top of everything, only in touch mode)
    renderTouchControls(ctx);
    
    // Render interaction button (on top of touch controls)
    if (typeof renderInteractionButton === 'function') {
        renderInteractionButton(ctx);
    }
    
    // Render mobile loot selection UI (when multiple items nearby)
    if (typeof renderMobileLootSelection === 'function') {
        renderMobileLootSelection(ctx);
    }
}

// Render launch modal (controls tutorial)
function renderLaunchModal(ctx) {
    const canvasWidth = Game ? Game.config.width : 1280;
    const canvasHeight = Game ? Game.config.height : 720;
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;
    
    // Dark overlay with grid pattern matching game background
    ctx.fillStyle = 'rgba(15, 15, 26, 0.95)';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    // Draw grid pattern (retro 90s aesthetic)
    ctx.strokeStyle = 'rgba(100, 100, 150, 0.15)';
    ctx.lineWidth = 1;
    const gridSize = 50;
    for (let x = 0; x < canvasWidth; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvasHeight);
        ctx.stroke();
    }
    for (let y = 0; y < canvasHeight; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvasWidth, y);
        ctx.stroke();
    }
    
    // Main panel (responsive to screen size)
    const panelWidth = Math.min(900, canvasWidth * 0.90);
    const panelHeight = Math.min(650, canvasHeight * 0.85);
    const panelX = (canvasWidth - panelWidth) / 2;
    const panelY = (canvasHeight - panelHeight) / 2;
    
    // Panel background - solid color matching game UI
    ctx.fillStyle = 'rgba(20, 20, 40, 0.95)';
    ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
    
    // Geometric corner decorations (triangles)
    const cornerSize = 12;
    ctx.fillStyle = '#ffff00'; // Selection yellow
    drawTriangle(ctx, panelX + cornerSize, panelY + cornerSize, cornerSize, Math.PI * 0.25);
    ctx.fill();
    drawTriangle(ctx, panelX + panelWidth - cornerSize, panelY + cornerSize, cornerSize, Math.PI * 0.75);
    ctx.fill();
    drawTriangle(ctx, panelX + cornerSize, panelY + panelHeight - cornerSize, cornerSize, -Math.PI * 0.25);
    ctx.fill();
    drawTriangle(ctx, panelX + panelWidth - cornerSize, panelY + panelHeight - cornerSize, cornerSize, Math.PI * 1.25);
    ctx.fill();
    
    // Outer border - sharp angular border (no glow)
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);
    
    // Inner border
    ctx.strokeStyle = '#4a90e2'; // Warrior blue
    ctx.lineWidth = 2;
    ctx.strokeRect(panelX + 3, panelY + 3, panelWidth - 6, panelHeight - 6);
    
    // Title - geometric retro style
    ctx.fillStyle = '#ffff00'; // Selection yellow
    const titleSize = Math.min(56, panelWidth * 0.062);
    ctx.font = `bold ${titleSize}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText('How to Play', centerX, panelY + Math.min(60, panelHeight * 0.092));
    
    // Check if mobile or desktop
    const isMobile = typeof Input !== 'undefined' && Input.isTouchMode && Input.isTouchMode();
    
    if (isMobile) {
        // Mobile controls visual - mini preview of screen layout
        // Position controls lower and spaced out to match actual screen
        const previewStartY = panelY + Math.min(140, panelHeight * 0.22);
        const previewWidth = panelWidth - 60;
        const previewHeight = Math.min(400, panelHeight * 0.62);
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
        
        // Label - positioned to the LEFT of the cluster for clarity
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'right';
        ctx.fillText('Primary Fire', rightJoystickX - joystickRadius - 25, rightJoystickY - 10);
        ctx.font = '14px Arial';
        ctx.fillStyle = '#aaaaaa';
        ctx.fillText('Aim & Attack', rightJoystickX - joystickRadius - 25, rightJoystickY + 10);
        
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
        
        // Character sheet button representation (top-right, next to pause button)
        const charButtonWidth = 70 * scale;
        const charButtonHeight = 35 * scale;
        const charButtonX = previewX + previewWidth - 140; // Position to the left of pause button
        const charButtonY = previewY + 40;
        
        // Character sheet button background
        ctx.fillStyle = 'rgba(60, 60, 90, 0.8)';
        ctx.fillRect(charButtonX - charButtonWidth / 2, charButtonY - charButtonHeight / 2, charButtonWidth, charButtonHeight);
        
        // Character sheet button border
        ctx.strokeStyle = 'rgba(200, 200, 255, 0.8)';
        ctx.lineWidth = 2;
        ctx.strokeRect(charButtonX - charButtonWidth / 2, charButtonY - charButtonHeight / 2, charButtonWidth, charButtonHeight);
        
        // Character sheet button label
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 15px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Char', charButtonX, charButtonY);
        
        // Label below character sheet button
        ctx.font = 'bold 12px Arial';
        ctx.textBaseline = 'top';
        ctx.fillText('Character Sheet', charButtonX, charButtonY + charButtonHeight / 2 + 8);
        
        // Pause button representation (top-right of preview, next to char button)
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
        
        // Label below pause button (to avoid hanging off edge)
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Pause', pauseButtonX, pauseButtonY + pauseButtonSize / 2 + 28);
        
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
        
        // Add extra spacing indicator - a subtle line to separate sections
        ctx.strokeStyle = 'rgba(100, 100, 150, 0.3)';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(controlsCenterX - 350, wasdY + keySpacing + 60);
        ctx.lineTo(controlsCenterX + 350, wasdY + keySpacing + 60);
        ctx.stroke();
        ctx.setLineDash([]);
        
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
        
        // Character sheet keys (bottom of control area - moved down more for better spacing)
        const charKeysY = controlsStartY + 300;
        const charKeySpacing = 60;
        
        // Tab key
        const tabWidth = 70;
        const tabHeight = 40;
        ctx.fillStyle = 'rgba(150, 150, 200, 0.9)';
        ctx.fillRect(centerX - charKeySpacing - tabWidth/2, charKeysY - tabHeight/2, tabWidth, tabHeight);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(centerX - charKeySpacing - tabWidth/2, charKeysY - tabHeight/2, tabWidth, tabHeight);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Tab', centerX - charKeySpacing, charKeysY);
        
        // I key
        const iKeySize = 40;
        ctx.fillStyle = 'rgba(150, 150, 200, 0.9)';
        ctx.fillRect(centerX + charKeySpacing - iKeySize/2, charKeysY - iKeySize/2, iKeySize, iKeySize);
        ctx.strokeRect(centerX + charKeySpacing - iKeySize/2, charKeysY - iKeySize/2, iKeySize, iKeySize);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 22px Arial';
        ctx.fillText('I', centerX + charKeySpacing, charKeysY);
        
        // Character sheet label
        ctx.font = '14px Arial';
        ctx.fillStyle = '#aaaaaa';
        ctx.fillText('Hold', centerX - charKeySpacing, charKeysY + 30);
        ctx.fillText('Toggle', centerX + charKeySpacing, charKeysY + 30);
        ctx.font = '16px Arial';
        ctx.fillStyle = '#88ccff';
        ctx.fillText('Character Sheet', centerX, charKeysY + 52);
        
        // Loot controls section (below character sheet)
        const lootY = charKeysY + 85;
        ctx.font = '15px Arial';
        ctx.fillStyle = '#aaddff';
        ctx.fillText('Loot:', centerX, lootY);
        ctx.font = '14px Arial';
        ctx.fillStyle = '#cccccc';
        ctx.fillText('G to pickup  •  Arrow keys to cycle nearby items', centerX, lootY + 22);
        
        // Class variations explanation (centered at bottom of controls area)
        ctx.font = '18px Arial';
        ctx.fillStyle = '#ffffaa';
        ctx.textAlign = 'center';
        ctx.fillText('Each class has variations you\'ll discover!', centerX, controlsStartY + 430);
    }
    
    // Thank you message
    ctx.fillStyle = '#ffffaa';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Thanks for trying my game!', centerX, panelY + panelHeight - 80);
    
    // Close button - geometric retro style
    const closeButtonWidth = 200;
    const closeButtonHeight = 50;
    const closeButtonX = centerX - closeButtonWidth / 2;
    const closeButtonY = panelY + panelHeight - 50;
    
    modalCloseButton.x = closeButtonX;
    modalCloseButton.y = closeButtonY;
    modalCloseButton.width = closeButtonWidth;
    modalCloseButton.height = closeButtonHeight;
    
    const isClosePressed = modalCloseButton.pressed;
    
    // Button background - solid color
    ctx.fillStyle = isClosePressed ? 'rgba(74, 144, 226, 0.9)' : 'rgba(74, 144, 226, 0.8)'; // Warrior blue
    ctx.fillRect(closeButtonX, closeButtonY, closeButtonWidth, closeButtonHeight);
    
    // Clean border - sharp, angular
    ctx.strokeStyle = isClosePressed ? '#ffffff' : 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = isClosePressed ? 4 : 3;
    ctx.strokeRect(closeButtonX, closeButtonY, closeButtonWidth, closeButtonHeight);
    
    // Button text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Close', centerX, closeButtonY + closeButtonHeight / 2);
}

function renderPrivacyModal(ctx) {
    const canvasWidth = Game ? Game.config.width : 1280;
    const canvasHeight = Game ? Game.config.height : 720;
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;

    // Detect mobile
    const isMobile = typeof Input !== 'undefined' && Input.isTouchMode && Input.isTouchMode();

    ctx.save();
    
    // Dark overlay with grid pattern matching game background
    ctx.fillStyle = 'rgba(15, 15, 26, 0.95)';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    // Draw grid pattern (retro 90s aesthetic)
    ctx.strokeStyle = 'rgba(100, 100, 150, 0.15)';
    ctx.lineWidth = 1;
    const gridSize = 50;
    for (let x = 0; x < canvasWidth; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvasHeight);
        ctx.stroke();
    }
    for (let y = 0; y < canvasHeight; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvasWidth, y);
        ctx.stroke();
    }

    // Mobile: maximize space, Desktop: standard sizing
    const panelWidth = isMobile 
        ? Math.min(canvasWidth * 0.96, canvasWidth - 20)  // 96% width, min 20px margin
        : Math.min(880, canvasWidth * 0.88);
    const panelHeight = isMobile
        ? Math.min(canvasHeight * 0.95, canvasHeight - 20) // 95% height, min 20px margin
        : Math.min(620, canvasHeight * 0.85);
    const panelX = Math.max(10, centerX - panelWidth / 2);
    const panelY = Math.max(10, centerY - panelHeight / 2);

    // Panel background - solid color matching game UI
    ctx.fillStyle = 'rgba(20, 20, 40, 0.95)';
    ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
    
    // Geometric corner decorations (triangles)
    const cornerSize = isMobile ? 10 : 12;
    ctx.fillStyle = '#673ab7'; // Mage purple
    drawTriangle(ctx, panelX + cornerSize, panelY + cornerSize, cornerSize, Math.PI * 0.25);
    ctx.fill();
    drawTriangle(ctx, panelX + panelWidth - cornerSize, panelY + cornerSize, cornerSize, Math.PI * 0.75);
    ctx.fill();
    drawTriangle(ctx, panelX + cornerSize, panelY + panelHeight - cornerSize, cornerSize, -Math.PI * 0.25);
    ctx.fill();
    drawTriangle(ctx, panelX + panelWidth - cornerSize, panelY + panelHeight - cornerSize, cornerSize, Math.PI * 1.25);
    ctx.fill();
    
    // Outer border - sharp angular border (no glow)
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);
    
    // Inner border
    ctx.strokeStyle = '#4a90e2'; // Warrior blue
    ctx.lineWidth = 2;
    ctx.strokeRect(panelX + 3, panelY + 3, panelWidth - 6, panelHeight - 6);

    // Button rendering function - using geometric retro style
    const drawButton = (button, text, primary = false) => {
        if (!button) return;
        
        // Button background - solid colors
        if (primary) {
            ctx.fillStyle = button.pressed ? 'rgba(74, 144, 226, 0.9)' : 'rgba(74, 144, 226, 0.8)'; // Warrior blue
        } else {
            ctx.fillStyle = button.pressed ? 'rgba(50, 50, 70, 0.9)' : 'rgba(30, 30, 50, 0.8)'; // Neutral dark gray
        }
        ctx.fillRect(button.x, button.y, button.width, button.height);
        
        // Clean border - sharp, angular (no rounded corners)
        if (primary) {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 3;
        } else {
            ctx.strokeStyle = 'rgba(150, 150, 200, 0.7)';
            ctx.lineWidth = 2;
        }
        ctx.strokeRect(button.x, button.y, button.width, button.height);

        // Button text
        ctx.fillStyle = '#ffffff';
        const buttonFontSize = isMobile ? (primary ? 14 : 12) : (primary ? 20 : 18);
        ctx.font = `bold ${buttonFontSize}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, button.x + button.width / 2, button.y + button.height / 2);
    };

    // Title - geometric retro style
    ctx.fillStyle = '#ffff00'; // Selection yellow
    ctx.font = isMobile ? 'bold 24px Arial' : 'bold 36px Arial';
    ctx.textAlign = 'left';
    const titleX = panelX + (isMobile ? 15 : 40);
    const titleY = panelY + (isMobile ? 35 : 70);
    ctx.fillText('Privacy & Telemetry', titleX, titleY);

    // Policy button - mobile: smaller, positioned below title
    const policyButtonWidth = isMobile ? Math.min(200, panelWidth - 30) : 240;
    const policyButtonHeight = isMobile ? 40 : 46;
    const policyButtonX = isMobile 
        ? panelX + (panelWidth - policyButtonWidth) / 2  // Centered on mobile
        : panelX + panelWidth - policyButtonWidth - 40;
    const policyButtonY = isMobile 
        ? titleY + 35  // Below title on mobile
        : panelY + 40;
    privacyModalButtons.policy.x = policyButtonX;
    privacyModalButtons.policy.y = policyButtonY;
    privacyModalButtons.policy.width = policyButtonWidth;
    privacyModalButtons.policy.height = policyButtonHeight;
    drawButton(privacyModalButtons.policy, 'Open Privacy Policy', false);

    // Description text - mobile: shorter, simplified message
    ctx.fillStyle = '#d0d7eb';
    ctx.font = isMobile ? '14px Arial' : '18px Arial';
    ctx.textAlign = 'left';
    const textX = panelX + (isMobile ? 15 : 40);
    let textY = isMobile ? policyButtonY + policyButtonHeight + 25 : titleY + 40;
    const lineHeight = isMobile ? 20 : 26;
    const maxTextWidth = panelWidth - (isMobile ? 30 : 80);
    
    let paragraphs;
    if (isMobile) {
        // Mobile: shorter, simplified message
        paragraphs = [
            'Help improve the game by sharing gameplay data (damage, timing, affixes).',
            'No personal info collected. Each run is anonymous.',
            'You can change this anytime in the pause menu.'
        ];
    } else {
        // Desktop: full message
        paragraphs = [
            'Your feedback is fantastic, but "the boss feels spicy" isn\'t exactly spreadsheet-compatible. Telemetry lets me pin numbers to this "spicy" so I can do something about it.',
            'Here\'s what gets logged: raw gameplay telemetry--damage, room timing, affix usage, boss smackdowns. No therapy sessions, just math.',
            'Absolutely zero personal info is attached. Each run is a fresh anonymous blob; no player dossiers, no secret tracking, no input tracking, no drama. I don\'t want your personal data, you can keep it. I have a hard enough time keeping track of my own.',
            'Changed your mind? Flip telemetry on or off anytime from the pause menu and the game will respect your newfound mood instantly.'
        ];
    }
    
    paragraphs.forEach(paragraph => {
        textY = wrapText(ctx, paragraph, textX, textY, maxTextWidth, lineHeight);
        textY += (isMobile ? 4 : 6);
    });

    // Status text
    const telemetryStatus = Game ? Game.telemetryOptIn === true : null;
    let statusText = 'Telemetry is currently disabled.';
    if (telemetryStatus === true) {
        statusText = 'Telemetry is currently enabled.';
    } else if (telemetryStatus === null) {
        statusText = 'Telemetry has not been configured yet.';
    }
    ctx.fillStyle = '#ffe082';
    ctx.font = isMobile ? 'bold 16px Arial' : 'bold 20px Arial';
    textY += isMobile ? 8 : 10;
    ctx.fillText(statusText, textX, textY);

    // Buttons area - mobile: smaller side-by-side; desktop: side by side
    const buttonGap = isMobile ? 12 : 30;
    const buttonHeight = isMobile ? 45 : 60;
    
    if (isMobile) {
        // Mobile: buttons side-by-side, smaller size
        const buttonWidth = (panelWidth - 30 - buttonGap) / 2; // Two buttons with gap
        const buttonStartY = panelY + panelHeight - (Game && Game.privacyModalContext === 'pause' ? 120 : 100);
        
        privacyModalButtons.optIn.x = panelX + 15;
        privacyModalButtons.optIn.y = buttonStartY;
        privacyModalButtons.optIn.width = buttonWidth;
        privacyModalButtons.optIn.height = buttonHeight;

        privacyModalButtons.optOut.x = panelX + 15 + buttonWidth + buttonGap;
        privacyModalButtons.optOut.y = buttonStartY;
        privacyModalButtons.optOut.width = buttonWidth;
        privacyModalButtons.optOut.height = buttonHeight;

        drawButton(privacyModalButtons.optIn, 'Enable', true);
        drawButton(privacyModalButtons.optOut, 'Disable', true);

        if (Game && Game.privacyModalContext === 'pause') {
            const closeWidth = panelWidth - 30;
            const closeHeight = 42;
            privacyModalButtons.close.x = panelX + 15;
            privacyModalButtons.close.y = buttonStartY + buttonHeight + 12;
            privacyModalButtons.close.width = closeWidth;
            privacyModalButtons.close.height = closeHeight;
            drawButton(privacyModalButtons.close, 'Back', false);
        } else {
            privacyModalButtons.close.x = 0;
            privacyModalButtons.close.y = 0;
            privacyModalButtons.close.width = 0;
            privacyModalButtons.close.height = 0;
        }
    } else {
        // Desktop: buttons side by side
        const buttonAreaY = panelY + panelHeight - 180;
        const buttonWidth = Math.min(320, (panelWidth - 2 * 40 - buttonGap) / 2);

        privacyModalButtons.optIn.x = panelX + 40;
        privacyModalButtons.optIn.y = buttonAreaY;
        privacyModalButtons.optIn.width = buttonWidth;
        privacyModalButtons.optIn.height = buttonHeight;

        privacyModalButtons.optOut.x = panelX + panelWidth - 40 - buttonWidth;
        privacyModalButtons.optOut.y = buttonAreaY;
        privacyModalButtons.optOut.width = buttonWidth;
        privacyModalButtons.optOut.height = buttonHeight;

        drawButton(privacyModalButtons.optIn, 'Enable Telemetry & Continue', true);
        drawButton(privacyModalButtons.optOut, 'Disable Telemetry & Continue', true);

        if (Game && Game.privacyModalContext === 'pause') {
            const closeWidth = 180;
            const closeHeight = 48;
            privacyModalButtons.close.x = panelX + panelWidth / 2 - closeWidth / 2;
            privacyModalButtons.close.y = buttonAreaY + buttonHeight + 25;
            privacyModalButtons.close.width = closeWidth;
            privacyModalButtons.close.height = closeHeight;
            drawButton(privacyModalButtons.close, 'Back', false);
        } else {
            privacyModalButtons.close.x = 0;
            privacyModalButtons.close.y = 0;
            privacyModalButtons.close.width = 0;
            privacyModalButtons.close.height = 0;
        }
    }

    ctx.restore();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    let currentY = y;

    for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = ctx.measureText(testLine);
        const testWidth = metrics.width;
        if (testWidth > maxWidth && n > 0) {
            ctx.fillText(line, x, currentY);
            line = words[n] + ' ';
            currentY += lineHeight;
        } else {
            line = testLine;
        }
    }
    ctx.fillText(line.trim(), x, currentY);
    return currentY + lineHeight;
}

function handlePrivacyModalClick(x, y) {
    if (Game && Game.screenToGame) {
        const gameCoords = Game.screenToGame(x, y);
        x = gameCoords.x;
        y = gameCoords.y;
    }

    const withinButton = (button) => (
        button.width > 0 &&
        button.height > 0 &&
        x >= button.x &&
        x <= button.x + button.width &&
        y >= button.y &&
        y <= button.y + button.height
    );

    if (withinButton(privacyModalButtons.policy)) {
        privacyModalButtons.policy.pressed = true;
        setTimeout(() => { privacyModalButtons.policy.pressed = false; }, 120);
        if (typeof window !== 'undefined' && window.open) {
            window.open('privacy.html', '_blank', 'noreferrer');
        }
        return true;
    }

    if (withinButton(privacyModalButtons.optIn)) {
        privacyModalButtons.optIn.pressed = true;
        setTimeout(() => { privacyModalButtons.optIn.pressed = false; }, 120);
        if (Game && Game.handlePrivacyChoice) {
            Game.handlePrivacyChoice(true);
        }
        return true;
    }

    if (withinButton(privacyModalButtons.optOut)) {
        privacyModalButtons.optOut.pressed = true;
        setTimeout(() => { privacyModalButtons.optOut.pressed = false; }, 120);
        if (Game && Game.handlePrivacyChoice) {
            Game.handlePrivacyChoice(false);
        }
        return true;
    }

    if (withinButton(privacyModalButtons.close)) {
        privacyModalButtons.close.pressed = true;
        setTimeout(() => { privacyModalButtons.close.pressed = false; }, 120);
        if (Game && Game.closePrivacyModal) {
            Game.closePrivacyModal();
        }
        return true;
    }

    return false;
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
    
    // Main panel (responsive to screen size)
    const panelWidth = Math.min(900, canvasWidth * 0.93);
    const panelHeight = Math.min(600, canvasHeight * 0.85);
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
    const currentVersion = Game && Game.VERSION ? Game.VERSION : '1.0.0';
    ctx.fillText(`Patch Notes`, centerX, panelY + 60);
    ctx.shadowBlur = 0;
    
    // Get all update messages and types
    const updateMessages = Game && Game.UPDATE_MESSAGES ? Game.UPDATE_MESSAGES : {};
    const updateTypes = Game && Game.UPDATE_TYPES ? Game.UPDATE_TYPES : {};
    
    // Define tag colors and display names
    const tagStyles = {
        'major': { color: '#ff6b6b', bg: 'rgba(255, 107, 107, 0.2)', name: 'Major Update' },
        'feature': { color: '#4ecdc4', bg: 'rgba(78, 205, 196, 0.2)', name: 'New Feature' },
        'minor': { color: '#95e1d3', bg: 'rgba(149, 225, 211, 0.2)', name: 'Minor Update' },
        'hotfix': { color: '#ffa502', bg: 'rgba(255, 165, 2, 0.2)', name: 'Hotfix' },
        'bugfix': { color: '#a8dadc', bg: 'rgba(168, 218, 220, 0.2)', name: 'Bug Fix' },
        'refactor': { color: '#b8b8ff', bg: 'rgba(184, 184, 255, 0.2)', name: 'Refactor' },
        'rebalance': { color: '#ffaa55', bg: 'rgba(255, 170, 85, 0.2)', name: 'Rebalance' }
    };
    
    // Sort versions in reverse chronological order (newest first)
    const versions = Object.keys(updateMessages).sort((a, b) => {
        // Simple version comparison (assumes semantic versioning)
        const aParts = a.split('.').map(Number);
        const bParts = b.split('.').map(Number);
        for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
            const aVal = aParts[i] || 0;
            const bVal = bParts[i] || 0;
            if (aVal !== bVal) return bVal - aVal; // Reverse order (newest first)
        }
        return 0;
    });
    
    // Set up scrollable content area
    const contentX = panelX + 40;
    const contentY = panelY + 100;
    const contentWidth = panelWidth - 80;
    const contentHeight = panelHeight - 180; // Leave space for title and close button
    const lineHeight = 28;
    const versionSpacing = 20;
    const topPadding = 30; // Padding to prevent text from being clipped at the top
    
    // Create a clipping region for the scrollable area
    ctx.save();
    ctx.beginPath();
    ctx.rect(contentX, contentY, contentWidth, contentHeight);
    ctx.clip();
    
    // Calculate total content height and render all versions
    let y = contentY + topPadding - updateModalScroll;
    let totalContentHeight = topPadding; // Start with top padding
    
    versions.forEach((version, versionIndex) => {
        const isCurrentVersion = version === currentVersion;
        const message = updateMessages[version];
        const versionTags = updateTypes[version] || [];
        
        // Version header
        ctx.fillStyle = isCurrentVersion ? '#ffdd44' : '#66ddff';
        ctx.font = isCurrentVersion ? 'bold 24px Arial' : 'bold 22px Arial';
        ctx.textAlign = 'left';
        const versionText = `v${version}${isCurrentVersion ? ' (Current)' : ''}`;
        ctx.fillText(versionText, contentX, y);
        
        // Render tags next to version number
        let tagX = contentX + ctx.measureText(versionText).width + 12;
        versionTags.forEach((tag, tagIndex) => {
            const tagStyle = tagStyles[tag];
            if (tagStyle) {
                // Tag background
                ctx.font = '14px Arial';
                const tagText = tagStyle.name;
                const tagPadding = 8;
                const tagWidth = ctx.measureText(tagText).width + tagPadding * 2;
                const tagHeight = 22;
                const tagY = y - 18; // Align with version text
                
                ctx.fillStyle = tagStyle.bg;
                ctx.fillRect(tagX, tagY, tagWidth, tagHeight);
                
                // Tag border
                ctx.strokeStyle = tagStyle.color;
                ctx.lineWidth = 1.5;
                ctx.strokeRect(tagX, tagY, tagWidth, tagHeight);
                
                // Tag text
                ctx.fillStyle = tagStyle.color;
                ctx.textAlign = 'left';
                ctx.fillText(tagText, tagX + tagPadding, y - 4);
                
                tagX += tagWidth + 6; // Space between tags
            }
        });
        
        y += lineHeight + 5;
        totalContentHeight += lineHeight + 5;
        
        // Message content - parse and render markdown
        ctx.fillStyle = '#cccccc';
        ctx.font = '18px Arial';
        
        // Split by newlines first (handle both \n and literal \n in strings)
        const lines = message.split(/\\n|\n/);
        
        lines.forEach((line, lineIndex) => {
            // Calculate indentation level (count leading spaces before trimming)
            const leadingSpaces = line.search(/\S/);
            const indentLevel = leadingSpaces >= 0 ? Math.floor(leadingSpaces / 2) : 0;
            
            // Trim whitespace
            line = line.trim();
            
            if (line.length === 0) {
                // Empty line - add spacing
                y += lineHeight * 0.5;
                totalContentHeight += lineHeight * 0.5;
                return;
            }
            
            // Check if it's a horizontal rule separator (---)
            if (line === '---' || line === '___' || line === '***') {
                // Render horizontal line
                ctx.strokeStyle = 'rgba(150, 150, 200, 0.4)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(contentX, y);
                ctx.lineTo(contentX + contentWidth, y);
                ctx.stroke();
                
                // Add spacing
                y += lineHeight;
                totalContentHeight += lineHeight;
                return;
            }
            
            // Check if it's a header (## or ###)
            const isHeader = line.startsWith('##');
            
            // Check if it's a bullet point (but not ---)
            const isBullet = (line.startsWith('•') || line.startsWith('-')) && line !== '---';
            
            // Calculate base indent from indentation level
            const baseIndent = indentLevel * 25;
            let renderX = contentX + baseIndent;
            let bulletIndent = 0;
            
            if (isBullet && !isHeader) {
                bulletIndent = 20;
                renderX = contentX + baseIndent + bulletIndent;
                
                // Render bullet
                ctx.fillStyle = '#88aaff';
                ctx.font = '16px Arial';
                ctx.fillText('•', contentX + baseIndent + 5, y);
                
                // Remove bullet from line
                line = line.substring(1).trim();
            }
            
            // Track starting Y for this line
            const startY = y;
            
            // Parse and render markdown (handles bold, headers, wrapping, etc.)
            const segments = parseMarkdownLine(line);
            let currentX = renderX;
            let maxLineY = y;
            
            // Check if this is a header from segments
            const hasHeader = segments.length > 0 && segments[0].header > 0;
            const headerLevel = hasHeader ? segments[0].header : 0;
            
            segments.forEach((segment, segmentIndex) => {
                // Determine font size based on header level
                let fontSize = '18px';
                if (headerLevel === 2) {
                    fontSize = '28px';
                } else if (headerLevel === 3) {
                    fontSize = '22px';
                }
                
                // Set font style (italic for quotes, bold for headers)
                let fontStyle = '';
                if (segment.italic) fontStyle = 'italic ';
                if (segment.bold || headerLevel > 0) fontStyle += 'bold ';
                ctx.font = `${fontStyle}${fontSize} Arial`;
                
                // Set color (special styling for quotes and headers)
                if (segment.quote) {
                    ctx.fillStyle = segment.color || '#88ddff';
                } else if (headerLevel === 2) {
                    ctx.fillStyle = '#ffaa55'; // Orange for ## headers
                } else if (headerLevel === 3) {
                    ctx.fillStyle = '#ffdd77'; // Yellow for ### headers
                } else if (segment.bold) {
                    ctx.fillStyle = '#ffdd88';
                } else {
                    ctx.fillStyle = '#cccccc';
                }
                
                // Word wrap within segment
                const words = segment.text.split(' ');
                words.forEach((word, wordIndex) => {
                    const wordWithSpace = wordIndex < words.length - 1 ? word + ' ' : word;
                    const wordWidth = ctx.measureText(wordWithSpace).width;
                    
                    // Check if word fits on current line
                    if (currentX + wordWidth > contentX + contentWidth && currentX > renderX) {
                        // Move to next line, maintaining indent
                        maxLineY += (headerLevel > 0 ? 32 : 22);
                        currentX = renderX;
                        totalContentHeight += (headerLevel > 0 ? 32 : 22);
                    }
                    
                    ctx.fillText(wordWithSpace, currentX, maxLineY);
                    currentX += wordWidth;
                });
            });
            
            // Update Y position to after the rendered content
            // Headers get more line height
            const thisLineHeight = headerLevel === 2 ? 32 : (headerLevel === 3 ? 26 : 22);
            y = maxLineY + thisLineHeight;
            totalContentHeight += thisLineHeight;
            
            // Add extra spacing after headers and certain lines
            if (lineIndex < lines.length - 1) {
                const nextLine = lines[lineIndex + 1].trim();
                // Add extra space after headers
                if (headerLevel > 0) {
                    y += lineHeight * 0.5;
                    totalContentHeight += lineHeight * 0.5;
                }
                // Add extra space before section headers (bold lines with **) or after empty lines
                else if (nextLine.startsWith('**') || line.length === 0) {
                    y += lineHeight * 0.3;
                    totalContentHeight += lineHeight * 0.3;
                }
            }
        });
        
        // Add spacing between versions (except after the last one)
        if (versionIndex < versions.length - 1) {
            y += versionSpacing;
            totalContentHeight += versionSpacing;
            
            // Draw separator line
            ctx.strokeStyle = 'rgba(100, 100, 150, 0.3)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(contentX, y - versionSpacing / 2);
            ctx.lineTo(contentX + contentWidth, y - versionSpacing / 2);
            ctx.stroke();
        }
    });
    
    // Add bottom padding
    totalContentHeight += 20;
    
    // Restore context after clipping
    ctx.restore();
    
    // Calculate max scroll
    const maxScroll = Math.max(0, totalContentHeight - contentHeight);
    
    // Clamp scroll position
    updateModalScroll = Math.max(0, Math.min(updateModalScroll, maxScroll));
    
    // Render scroll indicators if content is scrollable
    if (maxScroll > 0) {
        const scrollBarX = panelX + panelWidth - 25;
        const scrollBarY = contentY;
        const scrollBarWidth = 8;
        const scrollBarHeight = contentHeight;
        
        // Scroll track
        ctx.fillStyle = 'rgba(100, 100, 150, 0.3)';
        ctx.fillRect(scrollBarX, scrollBarY, scrollBarWidth, scrollBarHeight);
        
        // Scroll thumb
        const thumbHeight = Math.max(30, (contentHeight / totalContentHeight) * scrollBarHeight);
        const thumbY = scrollBarY + (updateModalScroll / maxScroll) * (scrollBarHeight - thumbHeight);
        ctx.fillStyle = 'rgba(150, 150, 255, 0.7)';
        ctx.fillRect(scrollBarX, thumbY, scrollBarWidth, thumbHeight);
        
        // Scroll hints
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(200, 200, 200, 0.7)';
        
        if (updateModalScroll > 0) {
            ctx.fillText('▲', scrollBarX + scrollBarWidth / 2, contentY - 5);
        }
        if (updateModalScroll < maxScroll) {
            ctx.fillText('▼', scrollBarX + scrollBarWidth / 2, contentY + contentHeight + 15);
        }
    }
    
    // Close button
    const closeButtonWidth = 200;
    const closeButtonHeight = 50;
    const closeButtonX = centerX - closeButtonWidth / 2;
    const closeButtonY = panelY + panelHeight - 70;
    
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
    ctx.fillText('Close', centerX, closeButtonY + closeButtonHeight / 2 + 8);
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
            // Reset scroll position
            if (typeof updateModalScroll !== 'undefined') {
                updateModalScroll = 0;
            }
            return true;
        }
    }
    
    return false;
}

// Handle keyboard input for multiplayer join code
// Use capture phase to intercept keys before Input system processes them
document.addEventListener('keydown', (e) => {
    if (!multiplayerMenuVisible) return;
    
    const inLobby = typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.lobbyCode;
    if (inLobby) return; // Don't handle input when in a lobby
    
    // Handle Ctrl+V/Cmd+V for paste
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        e.stopPropagation();
        // Don't call handlePasteCode here - let the paste event handler deal with it
        return;
    }
    
    // Handle special keys first
    if (e.key === 'Backspace') {
        joinCodeInput = joinCodeInput.slice(0, -1);
        e.preventDefault();
        e.stopPropagation();
        return;
    } else if (e.key === 'Enter' && joinCodeInput.length === 6) {
        handleJoinLobby();
        e.preventDefault();
        e.stopPropagation();
        return;
    }
    
    // Handle alphanumeric input for join code
    if (e.key.length === 1 && /[a-zA-Z0-9]/.test(e.key)) {
        if (joinCodeInput.length < 6) {
            // Convert any letter to uppercase, allow any number
            joinCodeInput += e.key.toUpperCase();
        }
        // Always prevent default to stop game controls and browser shortcuts
        e.preventDefault();
        e.stopPropagation();
        return;
    }
    
    // For any other key, prevent it from triggering game controls
    e.preventDefault();
    e.stopPropagation();
}, { capture: true }); // Use capture phase to run before Input system

// Handle paste event for multiplayer join code (legacy support for actual paste events)
document.addEventListener('paste', (e) => {
    if (!multiplayerMenuVisible) return;
    
    const inLobby = typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.lobbyCode;
    if (inLobby) return; // Don't handle paste when in a lobby
    
    // Get pasted text from clipboard event
    const pastedText = (e.clipboardData || window.clipboardData).getData('text');
    
    if (pastedText) {
        // Filter to alphanumeric only, convert to uppercase, limit to 6 characters
        const filtered = pastedText
            .split('')
            .filter(char => /[a-zA-Z0-9]/.test(char))
            .map(char => char.toUpperCase())
            .slice(0, 6)
            .join('');
        
        joinCodeInput = filtered;
        console.log('[UI] Pasted code from paste event:', filtered);
        
        e.preventDefault();
        e.stopPropagation();
    }
}, { capture: true });

// Multiplayer event callbacks (called by multiplayer.js)
function onLobbyCreated(data) {
    console.log('[Multiplayer] Lobby created:', data.code);
    multiplayerError = ''; // Clear any error
    
    // Ensure pause menu stays open when creating lobby from pause menu
    if (Game) {
        // If we're in NEXUS and pause menu should be open (multiplayer menu visible), keep it open
        if (Game.state === 'NEXUS' && multiplayerMenuVisible) {
            Game.showPauseMenu = true;
            Game.paused = false;
            Game.pausedFromState = 'NEXUS';
        }
        // Convert any PAUSED state to multiplayer pause menu
        else if (Game.state === 'PAUSED') {
            if (Game.pausedFromState === 'NEXUS') {
                Game.state = 'NEXUS';
                Game.showPauseMenu = true;
                Game.paused = false;
            } else if (Game.pausedFromState === 'PLAYING') {
                Game.state = 'PLAYING';
                Game.showPauseMenu = true;
                Game.paused = false;
            }
        }
    }
}

function onLobbyJoined(data) {
    console.log('[Multiplayer] Joined lobby:', data.code);
    multiplayerError = '';
    
    // Ensure pause menu stays open when joining lobby from pause menu
    if (Game) {
        // If we're in NEXUS and pause menu should be open (multiplayer menu visible), keep it open
        if (Game.state === 'NEXUS' && multiplayerMenuVisible) {
            Game.showPauseMenu = true;
            Game.paused = false;
            Game.pausedFromState = 'NEXUS';
        }
        // Convert any PAUSED state to multiplayer pause menu
        else if (Game.state === 'PAUSED') {
            if (Game.pausedFromState === 'NEXUS') {
                Game.state = 'NEXUS';
                Game.showPauseMenu = true;
                Game.paused = false;
            } else if (Game.pausedFromState === 'PLAYING') {
                Game.state = 'PLAYING';
                Game.showPauseMenu = true;
                Game.paused = false;
            }
        }
    }
}

function onLobbyError(data) {
    multiplayerError = data.message || 'Unknown error';
}

function onPlayerJoined(data) {
    console.log('[Multiplayer] Player joined lobby');
}

function onPlayerLeft(data) {
    console.log('[Multiplayer] Player left lobby');
}

function onHostMigrated(data, wasHost, isHost) {
    if (isHost && !wasHost) {
        console.log('[Multiplayer] You are now the host');
        multiplayerError = 'You are now the host!';
        setTimeout(() => { multiplayerError = ''; }, 3000);
        
        // Check if all remaining players are dead after host migration
        // This handles the edge case where a dead client becomes host after the host leaves
        if (typeof Game !== 'undefined' && Game.checkAllPlayersDead) {
            Game.allPlayersDead = Game.checkAllPlayersDead();
            
            // If all players are dead, trigger game over
            if (Game.allPlayersDead && Game.multiplayerEnabled) {
                console.log('[Host Migration] All players are dead - triggering game over');
                
                // Send final stats to any remaining clients (if any)
                if (typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.isHost) {
                    if (Game.sendFinalStats) {
                        Game.sendFinalStats();
                    }
                }
                
                // Record end time for death screen (if not already set)
                if (!Game.endTime) {
                    Game.endTime = Date.now();
                    Game.currencyEarned = Game.calculateCurrency();
                }
            }
        }
    }
}

function onGameStart(data) {
    console.log('[Multiplayer] Starting game');
    
    // Close any open menus
    multiplayerMenuVisible = false;
    
    // Position reset already handled in handleGameStart in multiplayer.js
    // Start the game (or transition to PLAYING if already started by host)
    if (Game) {
        if (Game.state === 'NEXUS' || Game.state === 'PAUSED') {
            // Make sure we're unpaused
            Game.paused = false;
            Game.pausedFromState = null;
            
            // Start game if in nexus
            if (Game.state === 'NEXUS') {
                Game.startGame();
            }
        }
    }
}

function onMultiplayerDisconnect() {
    multiplayerError = 'Disconnected from server';
    if (Game) {
        Game.multiplayerEnabled = false;
    }
}

function onReturnToNexus(data) {
    console.log('[Multiplayer] Returning to nexus');
    
    // Return to nexus for this client
    if (Game) {
        // Close any open menus
        multiplayerMenuVisible = false;
        
        // Position reset already handled in handleReturnToNexus in multiplayer.js
        if (Game.returnToNexus) {
            Game.returnToNexus();
        }
        
        // Make sure client is unpaused and in NEXUS state
        Game.state = 'NEXUS';
        Game.paused = false;
        Game.pausedFromState = null;
    }
}

function onRoomTransition(data) {
    // Position reset already handled in handleRoomTransition in multiplayer.js
    // Just update room number
    if (Game) {
        Game.roomNumber = data.roomNumber;
    }
}

