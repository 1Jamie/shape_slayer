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
        ctx.font = `bold ${fontSize}px Orbitron`;
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

// Helper function to draw a small shape indicator
function drawPlayerShapeIndicator(ctx, x, y, shape, color, size = 12) {
    // Scale down on mobile for better space usage
    const isMobile = typeof Input !== 'undefined' && Input.isMobileUiMode && Input.isMobileUiMode();
    const mobileScale = isMobile ? 0.75 : 1.0;

    const barX = 30;
    let barY = 30;
    const barWidth = Math.floor(320 * mobileScale);
    const barHeight = Math.floor(36 * mobileScale);

    // Adjust Y position if shield bar is shown
    const shieldBarHeight = player.maxShieldHealth > 0 ? Math.floor(28 * mobileScale) : 0;
    const shieldBarGap = 4;
    if (shieldBarHeight > 0) {
        barY += shieldBarHeight + shieldBarGap;
    }

    // Render shield bar above health bar if player has shield
    if (player.maxShieldHealth > 0) {
        const shieldBarY = 30;

        // Panel background (extend to cover shield bar)
        const panelGradient = ctx.createLinearGradient(barX - 10, shieldBarY - 10, barX - 10, barY + barHeight + 10);
        panelGradient.addColorStop(0, 'rgba(20, 20, 30, 0.85)');
        panelGradient.addColorStop(1, 'rgba(10, 10, 20, 0.85)');
        ctx.fillStyle = panelGradient;
        ctx.fillRect(barX - 10, shieldBarY - 10, barWidth + 20, (barY - shieldBarY) + barHeight + 20);

        // Panel border
        ctx.strokeStyle = 'rgba(100, 150, 255, 0.4)';
        ctx.lineWidth = 2;
        ctx.strokeRect(barX - 10, shieldBarY - 10, barWidth + 20, (barY - shieldBarY) + barHeight + 20);

        // Shield bar background
        const shieldBgGradient = ctx.createLinearGradient(barX, shieldBarY, barX, shieldBarY + shieldBarHeight);
        shieldBgGradient.addColorStop(0, '#1a1a2a');
        shieldBgGradient.addColorStop(1, '#0a0a1a');
        ctx.fillStyle = shieldBgGradient;
        ctx.fillRect(barX, shieldBarY, barWidth, shieldBarHeight);

        // Shield bar foreground (cyan/blue gradient)
        const shieldPercent = player.shieldHealth / player.maxShieldHealth;
        const shieldGradient = ctx.createLinearGradient(barX, shieldBarY, barX, shieldBarY + shieldBarHeight);
        shieldGradient.addColorStop(0, '#66ccff');
        shieldGradient.addColorStop(1, '#0099cc');
        ctx.fillStyle = shieldGradient;
        ctx.fillRect(barX + 2, shieldBarY + 2, (barWidth - 4) * shieldPercent, shieldBarHeight - 4);

        // Inner highlight
        if (shieldPercent > 0) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.fillRect(barX + 2, shieldBarY + 2, (barWidth - 4) * shieldPercent, (shieldBarHeight - 4) * 0.4);
        }

        // Shield bar border
        ctx.strokeStyle = '#00ccff';
        ctx.lineWidth = 2;
        ctx.strokeRect(barX, shieldBarY, barWidth, shieldBarHeight);

        // Shield text
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px Orbitron';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowBlur = 3;
        ctx.shadowColor = '#000000';
        const shieldText = `Shield: ${Math.floor(player.shieldHealth)}/${Math.floor(player.maxShieldHealth)}`;
        ctx.fillText(shieldText, barX + barWidth / 2, shieldBarY + shieldBarHeight / 2);
        ctx.shadowBlur = 0;
    } else {
        // Normal panel background (no shield)
        const panelGradient = ctx.createLinearGradient(barX - 10, barY - 10, barX - 10, barY + barHeight + 10);
        panelGradient.addColorStop(0, 'rgba(20, 20, 30, 0.85)');
        panelGradient.addColorStop(1, 'rgba(10, 10, 20, 0.85)');
        ctx.fillStyle = panelGradient;
        ctx.fillRect(barX - 10, barY - 10, barWidth + 20, barHeight + 20);

        // Panel border
        ctx.strokeStyle = 'rgba(100, 150, 255, 0.4)';
        ctx.lineWidth = 2;
        ctx.strokeRect(barX - 10, barY - 10, barWidth + 20, barHeight + 20);
    }

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
    ctx.font = 'bold 18px Orbitron';
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
        ctx.font = 'bold 12px Orbitron';
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
    const isMobile = typeof Input !== 'undefined' && Input.isMobileUiMode && Input.isMobileUiMode();
    const mobileScale = isMobile ? 0.75 : 1.0;

    // Position below local health bar (local bar is at y=30, height=36, so start at y=80)
    const startY = 80;
    const barX = 30;
    const barWidth = Math.floor(240 * mobileScale); // Smaller than local bar
    const barHeight = Math.floor(28 * mobileScale); // Smaller than local bar
    const shieldBarHeight = Math.floor(22 * mobileScale);
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
        let shieldHealth = playerInstance.shieldHealth;
        let maxShieldHealth = playerInstance.maxShieldHealth;
        let dead = playerInstance.dead || false;

        // Fallback to remotePlayerStates if instance doesn't have HP (shouldn't happen, but safety)
        if ((hp === undefined || hp === null) && isHost && Game.remotePlayerStates) {
            const state = Game.remotePlayerStates.get(playerId);
            if (state) {
                hp = state.hp;
                maxHp = state.maxHp;
                dead = state.dead || false;
                if (shieldHealth == null) shieldHealth = state.shieldHealth;
                if (maxShieldHealth == null) maxShieldHealth = state.maxShieldHealth;
            }
        }

        // Default values if still undefined
        if (hp === undefined || hp === null) hp = 0;
        if (maxHp === undefined || maxHp === null) maxHp = 100;
        if (shieldHealth === undefined || shieldHealth === null) shieldHealth = 0;
        if (maxShieldHealth === undefined || maxShieldHealth === null) maxShieldHealth = 0;

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
        const hasShield = maxShieldHealth > 0;
        let healthBarY = currentY;

        // Shape indicator position (left of health bar)
        const shapeX = barX - shapeSize - 8;
        const shapeY = (hasShield ? currentY + shieldBarHeight / 2 : currentY + barHeight / 2);

        // Panel background
        ctx.save();
        ctx.globalAlpha = alpha;

        const panelTop = currentY - 8;
        const panelHeight = (hasShield ? shieldBarHeight + 4 : 0) + barHeight + 16;
        const panelGradient = ctx.createLinearGradient(barX - 8, panelTop, barX - 8, panelTop + panelHeight);
        panelGradient.addColorStop(0, 'rgba(20, 20, 30, 0.85)');
        panelGradient.addColorStop(1, 'rgba(10, 10, 20, 0.85)');
        ctx.fillStyle = panelGradient;
        ctx.fillRect(barX - 8, panelTop, barWidth + 16, panelHeight);

        // Panel border
        ctx.strokeStyle = 'rgba(100, 150, 255, 0.4)';
        ctx.lineWidth = 2;
        ctx.strokeRect(barX - 8, panelTop, barWidth + 16, panelHeight);

        if (hasShield) {
            const shieldBarY = currentY;

            const shieldBgGradient = ctx.createLinearGradient(barX, shieldBarY, barX, shieldBarY + shieldBarHeight);
            shieldBgGradient.addColorStop(0, '#1a1a2a');
            shieldBgGradient.addColorStop(1, '#0a0a1a');
            ctx.fillStyle = shieldBgGradient;
            ctx.fillRect(barX, shieldBarY, barWidth, shieldBarHeight);

            const shieldPercent = Math.max(0, Math.min(1, shieldHealth / maxShieldHealth));
            const shieldGradient = ctx.createLinearGradient(barX, shieldBarY, barX, shieldBarY + shieldBarHeight);
            shieldGradient.addColorStop(0, '#66ccff');
            shieldGradient.addColorStop(1, '#0099cc');
            ctx.fillStyle = shieldGradient;
            ctx.fillRect(barX + 2, shieldBarY + 2, (barWidth - 4) * shieldPercent, shieldBarHeight - 4);

            ctx.strokeStyle = '#00ccff';
            ctx.lineWidth = 2;
            ctx.strokeRect(barX, shieldBarY, barWidth, shieldBarHeight);

            ctx.fillStyle = '#ffffff';
            ctx.font = `bold ${Math.floor(11 * mobileScale)}px Orbitron`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowBlur = 3;
            ctx.shadowColor = '#000000';
            ctx.fillText(
                `Shield: ${Math.floor(shieldHealth)}/${Math.floor(maxShieldHealth)}`,
                barX + barWidth / 2,
                shieldBarY + shieldBarHeight / 2
            );
            ctx.shadowBlur = 0;

            healthBarY += shieldBarHeight + 4;
        }

        // Background with gradient
        const bgGradient = ctx.createLinearGradient(barX, healthBarY, barX, healthBarY + barHeight);
        bgGradient.addColorStop(0, '#2a1a1a');
        bgGradient.addColorStop(1, '#1a0a0a');
        ctx.fillStyle = bgGradient;
        ctx.fillRect(barX, healthBarY, barWidth, barHeight);

        // Draw foreground (green/orange/red) scaled by HP/maxHP with gradient
        const hpPercent = Math.max(0, Math.min(1, hp / maxHp));
        const hpGradient = ctx.createLinearGradient(barX, healthBarY, barX, healthBarY + barHeight);

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
        ctx.fillRect(barX + 2, healthBarY + 2, (barWidth - 4) * hpPercent, barHeight - 4);

        // Inner highlight
        if (hpPercent > 0) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.fillRect(barX + 2, healthBarY + 2, (barWidth - 4) * hpPercent, (barHeight - 4) * 0.4);
        }

        // Draw border
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(barX, healthBarY, barWidth, barHeight);

        // Draw text centered on bar with shadow
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.floor(14 * mobileScale)}px Orbitron`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowBlur = 3;
        ctx.shadowColor = '#000000';
        const healthText = `${Math.floor(hp)}/${Math.floor(maxHp)}`;
        ctx.fillText(healthText, barX + barWidth / 2, healthBarY + barHeight / 2);
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
        currentY += (hasShield ? shieldBarHeight + 4 : 0) + barHeight + barSpacing;
        playerCount++;
    });
}

// Helper function to format time
function formatTime(seconds) {
    // Initialize death screen start time if not set
    if (!Game.deathScreenStartTime) {
        Game.deathScreenStartTime = Date.now();
    }

    // Calculate time since death screen appeared
    const timeSinceDeath = (Date.now() - (Game.deathScreenStartTime || Date.now())) / 1000;
    const inputDelay = 3.0; // 3 second delay before allowing input
    const canAcceptInput = timeSinceDeath >= inputDelay;

    // Calculate time played
    const timePlayed = ((Game.endTime - Game.startTime) / 1000).toFixed(1);
    const minutes = Math.floor(timePlayed / 60);

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
    ctx.font = `bold ${Math.floor(60 * scale)}px Orbitron`;
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', centerX, centerY - 280 * scale);

    // Stats
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.floor(24 * scale)}px Orbitron`;

    const stats = [
        `Level Reached: ${levelReached}`,
        `Rooms Cleared: ${roomsCleared}`,
        `Enemies Killed: ${enemiesKilled}`,
        `Time Played: ${minutes}:${seconds}`
    ];

    stats.forEach((stat, index) => {
        ctx.fillText(stat, centerX, centerY - 200 * scale + (index * 35 * scale));
    });

    // Shards earned (replacing old currency system)
    const shardsEarned = typeof SaveSystem !== 'undefined' && SaveSystem.getCardShards ? SaveSystem.getCardShards() : 0;
    ctx.font = `bold ${Math.floor(20 * scale)}px Orbitron`;
    ctx.fillStyle = '#ffd700';
    ctx.textAlign = 'center';
    ctx.fillText('Shards:', centerX, centerY - 30 * scale);

    ctx.font = `bold ${Math.floor(24 * scale)}px Orbitron`;
    ctx.fillStyle = '#ffd700';
    ctx.fillText(`${shardsEarned.toLocaleString()}`, centerX, centerY + 20 * scale);

    // Instructions (with input delay)
    if (!canAcceptInput) {
        // Show countdown during delay
        const timeRemaining = Math.ceil(inputDelay - timeSinceDeath);
        ctx.font = `bold ${Math.floor(28 * scale)}px Orbitron`;
        ctx.fillStyle = '#ff8888';
        ctx.fillText(`Wait ${timeRemaining}...`, centerX, centerY + 220 * scale);
    } else {
        // Show normal instructions after delay
        ctx.font = `bold ${Math.floor(24 * scale)}px Orbitron`;
        ctx.fillStyle = '#ffff00';
        ctx.fillText('Press R to Restart', centerX, centerY + 200 * scale);
        ctx.fillStyle = '#00ffff';
        ctx.font = `bold ${Math.floor(20 * scale)}px Orbitron`;
        const continueHint = typeof Input !== 'undefined' && Input.getInputHint
            ? `Press ${Input.getInputHint('modifier')} or Click to Continue to Nexus`
            : 'Press M or Click to Continue to Nexus';
        ctx.fillText(continueHint, centerX, centerY + 240 * scale);
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
    ctx.font = `bold ${Math.floor(48 * scale)}px Orbitron`;
    ctx.textAlign = 'center';
    ctx.fillText('YOU DIED', centerX, centerY - 200 * scale);

    // Your Stats
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.floor(28 * scale)}px Orbitron`;
    ctx.fillText('Your Stats', centerX, centerY - 140 * scale);

    // Stats table
    ctx.font = `${Math.floor(20 * scale)}px Orbitron`;
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
        ctx.font = `bold ${Math.floor(20 * scale)}px Orbitron`;
        ctx.fillText('Press SPACE to spectate', centerX, centerY + 100 * scale);
    } else {
        ctx.fillStyle = '#00ff00';
        ctx.font = `bold ${Math.floor(18 * scale)}px Orbitron`;
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
    ctx.font = `bold ${Math.floor(52 * scale)}px Orbitron`;
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
    ctx.font = `bold ${Math.floor(16 * scale)}px Orbitron`;
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
        ctx.font = isLocalPlayer ? `bold ${Math.floor(16 * scale)}px Orbitron` : `${Math.floor(16 * scale)}px Orbitron`;
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
        ctx.font = `bold ${Math.floor(28 * scale)}px Orbitron`;
        ctx.fillStyle = '#ff8888';
        ctx.fillText(`Wait ${timeRemaining}...`, centerX, centerY + 200 * scale);
    } else if (isHost) {
        ctx.fillStyle = '#00ff00';
        ctx.font = `bold ${Math.floor(24 * scale)}px Orbitron`;
        ctx.textAlign = 'center';
        const returnHint = typeof Input !== 'undefined' && Input.getInputHint
            ? `Press ${Input.getInputHint('modifier')} to Return to Nexus`
            : 'Press M to Return to Nexus';
        ctx.fillText(returnHint, centerX, centerY + 200 * scale);
    } else {
        ctx.fillStyle = '#ffaa00';
        ctx.font = `bold ${Math.floor(20 * scale)}px Orbitron`;
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
    scrollVelocity: 0,
    handSlotBounds: []
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
// Expose worldToScreen globally for DOM components
window.worldToScreen = function worldToScreen(worldX, worldY) {
    // Get current zoom level
    const zoom = (typeof Game !== 'undefined' && Game.getViewZoom)
        ? Game.getViewZoom()
        : (typeof Game !== 'undefined' && Game.baseZoom ? Game.baseZoom : 1.1);

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

    const zoom = (Game.getViewZoom && Game.getViewZoom()) || 1.0;
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

    const zoom = (Game.getViewZoom && Game.getViewZoom()) || 1.0;
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

    const arrowSize = 12;
    ctx.fillStyle = '#ffcc33';
    ctx.strokeStyle = '#4a2a00';
    ctx.lineWidth = 2.5;
    ctx.shadowBlur = 10;
    ctx.shadowColor = 'rgba(255, 190, 40, 0.85)';

    ctx.beginPath();
    ctx.moveTo(arrowSize, 0);
    ctx.lineTo(-arrowSize / 2, -arrowSize);
    ctx.lineTo(-arrowSize / 2, arrowSize);
    ctx.closePath();

    ctx.stroke();
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff3aa';
    ctx.beginPath();
    ctx.arc(-arrowSize * 0.05, 0, arrowSize * 0.22, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
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

// Check for nexus interactions
function checkNexusInteractions() {
    if (!Game || Game.state !== 'NEXUS' || !Game.player || typeof nexusRoom === 'undefined' || !nexusRoom) {
        return null;
    }

    const allow = (type, detail) => {
        const cpOk = typeof RunCheckpoint === 'undefined' || !RunCheckpoint.allowsNexusInteraction
            || RunCheckpoint.allowsNexusInteraction(type);
        const obOk = typeof Onboarding === 'undefined' || !Onboarding.allowsInteraction || Onboarding.allowsInteraction(type);
        const ftOk = typeof FeatureTutorials === 'undefined' || !FeatureTutorials.allowsInteraction || FeatureTutorials.allowsInteraction(type, detail);
        return cpOk && obOk && ftOk;
    };

    // Check class stations
    if (typeof classStations !== 'undefined' && allow('class')) {
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
    if (Game.selectedClass && typeof upgradeStations !== 'undefined' && allow('upgrade')) {
        for (const station of upgradeStations) {
            const dx = station.x - Game.player.x;
            const dy = station.y - Game.player.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < 50) {
                return { type: 'upgrade', data: station };
            }
        }
    }

    // Check card portal (default)
    if (nexusRoom.portalPos && allow('portal')) {
        const portalDx = nexusRoom.portalPos.x - Game.player.x;
        const portalDy = nexusRoom.portalPos.y - Game.player.y;
        const portalDistance = Math.sqrt(portalDx * portalDx + portalDy * portalDy);
        const hasResume = typeof SaveSystem !== 'undefined' && SaveSystem.hasActiveRunCheckpoint
            && SaveSystem.hasActiveRunCheckpoint();

        if (portalDistance < 60 && (Game.selectedClass || hasResume)) {
            return { type: 'portal', data: { mode: 'gear', resume: hasResume } };
        }
    }

    // Check gear portal
    if (nexusRoom.gearPortalPos && allow('portal')) {
        const gearPortalDx = nexusRoom.gearPortalPos.x - Game.player.x;
        const gearPortalDy = nexusRoom.gearPortalPos.y - Game.player.y;
        const gearPortalDistance = Math.sqrt(gearPortalDx * gearPortalDx + gearPortalDy * gearPortalDy);

        if (gearPortalDistance < 60 && Game.selectedClass) {
            return { type: 'portal', data: { mode: 'gear' } };
        }
    }

    // Check mode switcher
    if (nexusRoom.modeSwitcherPos && allow('modeSwitcher')) {
        const switcherDx = nexusRoom.modeSwitcherPos.x - Game.player.x;
        const switcherDy = nexusRoom.modeSwitcherPos.y - Game.player.y;
        const switcherDistance = Math.sqrt(switcherDx * switcherDx + switcherDy * switcherDy);

        if (switcherDistance < 60) {
            // Check if in multiplayer lobby
            const inMultiplayerLobby = typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.lobbyCode;
            if (!inMultiplayerLobby) {
                return { type: 'modeSwitcher' };
            }
        }
    }

    // Check gear upgrade stations (UI Safety Locks guard check watchpoint 1)
    const gearStations = window.gearUpgradeStations;
    if (typeof gearStations !== 'undefined' && Array.isArray(gearStations)) {
        const targetedStation = gearStations.find(s => {
            const dx = s.x - Game.player.x;
            const dy = s.y - Game.player.y;
            return Math.sqrt(dx * dx + dy * dy) < 50;
        });

        if (targetedStation && allow('gearUpgrade', targetedStation.key)) {
            const lock = (typeof window.getGearStationLockState === 'function')
                ? window.getGearStationLockState(targetedStation)
                : { locked: !!targetedStation.isLocked };
            if (lock.locked) {
                return {
                    type: 'gearUpgradeLocked',
                    upgradeId: targetedStation.key,
                    unlockHint: lock.unlockHint || 'Locked',
                    requiredBoss: lock.requiredBoss || null
                };
            }
            return { type: 'gearUpgrade', upgradeId: targetedStation.key };
        }
    }

    // Check index machine
    if (nexusRoom.indexMachinePos && allow('indexMachine')) {
        const indexDx = nexusRoom.indexMachinePos.x - Game.player.x;
        const indexDy = nexusRoom.indexMachinePos.y - Game.player.y;
        const indexDistance = Math.sqrt(indexDx * indexDx + indexDy * indexDy);

        if (indexDistance < 50) {
            return { type: 'indexMachine' };
        }
    }

    return null;
}

// Interaction button class for canvas rendering
class InteractionButton {
    constructor(x, y, width, height, label = 'Interact') {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.label = label;
        this.pressed = false;
        this.justPressed = false;
    }

    // Check if point is within button
    contains(x, y) {
        // Add padding for easier mobile tapping
        const padding = 8;
        return x >= this.x - padding && x <= this.x + this.width + padding &&
            y >= this.y - padding && y <= this.y + this.height + padding;
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

    // Render button
    render(ctx) {
        const isPressed = this.pressed;
        const radius = 8;
        const bgAlpha = isPressed ? 0.85 : 0.65;

        // Background with rounded corners
        ctx.fillStyle = `rgba(100, 100, 255, ${bgAlpha})`;
        this.drawRoundedRect(ctx, this.x, this.y, this.width, this.height, radius);
        ctx.fill();

        // Border
        const borderWidth = isPressed ? 4 : 3;
        ctx.strokeStyle = isPressed ? 'rgba(200, 200, 255, 1.0)' : 'rgba(150, 150, 200, 0.7)';
        ctx.lineWidth = borderWidth;
        this.drawRoundedRect(ctx, this.x, this.y, this.width, this.height, radius);
        ctx.stroke();

        // Label
        if (this.label) {
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 17px Orbitron';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // Text shadow for better readability
            ctx.shadowBlur = 3;
            ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
            ctx.fillText(this.label, this.x + this.width / 2, this.y + this.height / 2);
            ctx.shadowBlur = 0;
        }
    }

    // Update (call at end of frame to reset justPressed)
    update() {
        this.justPressed = false;
    }
}

// Global interaction button instance
let interactionButton = null;
let currentInteraction = null;

function getInteractionTargetName(interaction) {
    if (!interaction) return '';
    const data = interaction.data || interaction.pylon || interaction;
    if (interaction.type === 'safeRoomMachine') return interaction.machineName || 'Safe Room Machine';
    if (interaction.type === 'preBossHealer') return 'Pre-Boss Healer';
    if (interaction.type === 'doorpack' && data) {
        return data.packName || data.name || data.type || '';
    }
    if (interaction.type === 'gear' && data) {
        return data.name || data.displayName || `${data.tier || ''} ${data.slot || 'Gear'}`.trim();
    }
    if (interaction.type === 'card' && data) {
        return data.name || data.cardName || data.title || 'Card';
    }
    if (interaction.type === 'upgrade' && data) {
        const option = data.option || data;
        return option.name || option.title || option.statType || 'Upgrade';
    }
    if (interaction.type === 'itemPylon' && data) return data.name || 'Item Pylon';
    return '';
}

function getInteractionLabel(interaction) {
    if (!interaction) return '';
    if (interaction.type === 'safeRoomMachine') {
        if (interaction.machineId === 'runSave' && typeof Game !== 'undefined' && Game.safeRoomUsedThisVisit) {
            return 'Cannot save after machines used';
        }
        return (interaction.machineId === 'runSave' ? 'Use ' : 'Open ') + (interaction.machineName || 'Machine');
    }
    if (interaction.type === 'preBossHealer') return 'Activate Healer';
    if (interaction.type === 'doorpack') return 'Select Pack';
    if (interaction.type === 'gear') return 'Pickup Gear';
    if (interaction.type === 'card') return 'Pickup Card';
    if (interaction.type === 'class') return 'Select Class';
    if (interaction.type === 'upgrade') {
        return interaction.data && interaction.data.option ? 'Pickup Upgrade' : 'Purchase Upgrade';
    }
    if (interaction.type === 'portal') {
        if (typeof SaveSystem !== 'undefined' && SaveSystem.hasActiveRunCheckpoint && SaveSystem.hasActiveRunCheckpoint()) {
            return 'Resume Run';
        }
        return 'Enter Portal';
    }
    if (interaction.type === 'itemPylon') return 'Interact with Item Pylon';
    if (interaction.type === 'modeSwitcher') {
        const inMultiplayerLobby = typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.lobbyCode;
        return inMultiplayerLobby ? 'Cannot swap modes in multiplayer' : 'Switch Mode';
    }
    if (interaction.type === 'gearUpgrade') {
        const upgradeNames = {
            affixSlots: 'Affix Capacity',
            rarityChance: 'Rarity Chances',
            safeRoomSystems: 'Safe Room Systems',
            safeRoomEfficiency: 'Safe Room Efficiency'
        };
        return `Open ${upgradeNames[interaction.upgradeId] || 'Gear Upgrades'}`;
    }
    if (interaction.type === 'gearUpgradeLocked') {
        return interaction.unlockHint || 'Locked';
    }
    if (interaction.type === 'indexMachine') return 'Open Index';
    if (interaction.type === 'exitDoor') {
        const localId = typeof Game !== 'undefined' && Game.getLocalPlayerId ? Game.getLocalPlayerId() : null;
        const isReady = localId && typeof Game.isPlayerDoorReady === 'function' && Game.isPlayerDoorReady(localId);
        return isReady ? 'Cancel Ready' : 'Ready - Enter Room';
    }
    return 'Interact';
}

function getInteractionDisabledReason(interaction) {
    if (!interaction) return '';
    if (interaction.type === 'modeSwitcher') {
        const inMultiplayerLobby = typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.lobbyCode;
        if (inMultiplayerLobby) return 'Cannot swap modes in multiplayer';
    }
    if (interaction.type === 'gearUpgradeLocked') {
        return interaction.unlockHint || 'Locked';
    }
    return '';
}

function recordMobileInteractionEvent(type, interaction, metadata = {}) {
    if (typeof Telemetry === 'undefined' || !Telemetry || !Telemetry.recordEvent) return;
    Telemetry.recordEvent(type, {
        roomNumber: typeof Game !== 'undefined' ? Game.roomNumber : null,
        playerId: typeof Game !== 'undefined' && Game.getLocalPlayerId ? Game.getLocalPlayerId() : null,
        targetType: interaction && interaction.type ? interaction.type : null,
        metadata: {
            interactionType: interaction && interaction.type ? interaction.type : null,
            targetName: getInteractionTargetName(interaction),
            inputSource: typeof Input !== 'undefined' ? Input._activeInputSource : null,
            gamepad: typeof Input !== 'undefined' && Input.isGamepadMode ? Input.isGamepadMode() : false,
            mobileUi: typeof Input !== 'undefined' && Input.isMobileUiMode ? Input.isMobileUiMode() : false,
            ...metadata
        }
    });
}

// Helper function to check gear interaction
function checkGearInteraction() {
    // Check LootSelection first
    if (typeof LootSelection !== 'undefined' && LootSelection.getSelectedGear) {
        const gear = LootSelection.getSelectedGear();
        if (gear) return { type: 'gear', data: gear };
    }

    // Fallback to manual check if LootSelection not available
    if (typeof groundLoot !== 'undefined' && Game.player) {
        let closest = null;
        let closestDist = 100; // Interaction radius
        groundLoot.forEach(gear => {
            const dx = gear.x - Game.player.x;
            const dy = gear.y - Game.player.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < closestDist) {
                closestDist = dist;
                closest = gear;
            }
        });
        if (closest) return { type: 'gear', data: closest };
    }
    return null;
}

// Update interaction state
function updateInteractionState() {
    if (!Input || !Input.isMobileUiMode || !Input.isMobileUiMode() || (Input.isGamepadMode && Input.isGamepadMode())) {
        currentInteraction = null;
        return;
    }

    // Check for interactions based on game state
    if (Game && Game.state === 'PLAYING') {
        // Check for safe room machines interaction
        let safeMachineInteraction = null;
        if (typeof currentRoom !== 'undefined' && currentRoom && currentRoom.type === 'safe' && Game.player) {
            const machines = (typeof window.getSafeRoomMachines === 'function') ? window.getSafeRoomMachines(currentRoom) : [];
            const nearMachine = machines.find(m => {
                const dx = m.x - Game.player.x;
                const dy = m.y - Game.player.y;
                return Math.sqrt(dx * dx + dy * dy) < m.range;
            });
            if (nearMachine) {
                safeMachineInteraction = { type: 'safeRoomMachine', machineId: nearMachine.id, machineName: nearMachine.name };
            }
        }

        // Check for pre-boss healer interaction (only after room clear opens the boss door)
        let preBossHealerInteraction = null;
        if (typeof currentRoom !== 'undefined' && currentRoom && currentRoom.doorOpen && currentRoom.preBossHealer && Game.player) {
            const healer = currentRoom.preBossHealer;
            if (!healer.usedBy) healer.usedBy = new Set();
            const _uiLocalId = typeof Game.getLocalPlayerId === 'function' ? Game.getLocalPlayerId() : 'local';
            if (!healer.usedBy.has(_uiLocalId)) {
                const dx = healer.x - Game.player.x;
                const dy = healer.y - Game.player.y;
                if (Math.sqrt(dx * dx + dy * dy) < healer.range) {
                    preBossHealerInteraction = { type: 'preBossHealer', healer: healer };
                }
            }
        }

        // Check for item pylon interaction (multiplayer)
        let pylonInteraction = null;
        if (typeof checkItemPylonInteraction !== 'undefined' && Game.player) {
            const pylon = checkItemPylonInteraction(Game.player);
            if (pylon) {
                const playerId = typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.playerId;
                const hasInteracted = pylon.interactedPlayers && playerId && pylon.interactedPlayers.includes(playerId);
                if (!hasInteracted) {
                    pylonInteraction = { type: 'itemPylon', pylon: pylon };
                }
            }
        }

        // Check for exit-door interaction (solo G-key on desktop; touch button on mobile)
        let exitDoorInteraction = null;
        if (typeof Game !== 'undefined' && Game.nearExitDoor
            && typeof currentRoom !== 'undefined' && currentRoom && currentRoom.doorOpen) {
            exitDoorInteraction = { type: 'exitDoor' };
        }

        currentInteraction = safeMachineInteraction ||
            preBossHealerInteraction ||
            checkGearInteraction() ||
            pylonInteraction ||
            exitDoorInteraction;
    } else if (Game && Game.state === 'NEXUS') {
        currentInteraction = checkNexusInteractions();
    } else {
        currentInteraction = null;
    }
}

function getMobileInteractionState() {
    updateInteractionState();
    if (!currentInteraction) return null;
    const disabledReason = getInteractionDisabledReason(currentInteraction);
    return {
        type: currentInteraction.type,
        label: getInteractionLabel(currentInteraction),
        targetName: getInteractionTargetName(currentInteraction),
        disabledReason,
        disabled: !!disabledReason,
        raw: currentInteraction,
        perform() {
            return performCurrentInteraction();
        }
    };
}

// Render interaction button
function renderInteractionButton(ctx) {
    if (!Input || !Input.isMobileUiMode || !Input.isMobileUiMode()) {
        return;
    }

    // Update interaction state
    updateInteractionState();

    if (!currentInteraction) {
        return;
    }

    const label = getInteractionLabel(currentInteraction);

    // Position button (center-bottom, low on screen but above touch controls)
    const canvasWidth = Game ? Game.config.width : 1280;
    const canvasHeight = Game ? Game.config.height : 720;
    const buttonWidth = 200;
    const buttonHeight = 60;
    const buttonX = (canvasWidth - buttonWidth) / 2;
    // Position above touch controls
    // Touch controls are now at ~23% from bottom on mobile, so position button accordingly
    // On mobile, position button above controls with some spacing
    // Calculate based on control position: controls are at ~23% from bottom, button should be ~28-30% from bottom
    const isMobile = Input && Input.isMobileUiMode && Input.isMobileUiMode();
    // Use percentage-based positioning to match control positioning
    const mobileBottomOffset = Math.max(canvasHeight * 0.28, 140); // ~28% from bottom, minimum 140px
    const buttonY = isMobile ? canvasHeight - mobileBottomOffset : canvasHeight - 150;

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

    // Update button state (reset justPressed)
    interactionButton.update();
}

function performCurrentInteraction() {
    if (!currentInteraction) return false;
    const disabledReason = getInteractionDisabledReason(currentInteraction);
    if (disabledReason) {
        recordMobileInteractionEvent('mobileInteractionBlocked', currentInteraction, { disabledReason });
        return false;
    }

    recordMobileInteractionEvent('mobileInteractionPerformed', currentInteraction);

    if (Game && Game.state === 'PLAYING' && currentInteraction.type === 'itemPylon') {
            // Interact with item pylon
            if (currentInteraction.pylon && Game.player && typeof interactWithItemPylon === 'function') {
                interactWithItemPylon(currentInteraction.pylon, Game.player);
            }
        } else if (Game && Game.state === 'PLAYING' && currentInteraction.type === 'gear') {
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
        } else if (Game && Game.state === 'PLAYING' && currentInteraction.type === 'safeRoomMachine') {
            if (typeof window.toggleSafeRoomMachine === 'function') {
                window.toggleSafeRoomMachine(true, currentInteraction.machineId);
            }
        } else if (Game && Game.state === 'PLAYING' && currentInteraction.type === 'preBossHealer'
            && typeof currentRoom !== 'undefined' && currentRoom && currentRoom.doorOpen) {
            const healer = currentInteraction.healer;
            if (!healer.usedBy) healer.usedBy = new Set();
            const _healLocalId = typeof Game.getLocalPlayerId === 'function' ? Game.getLocalPlayerId() : 'local';
            if (!healer.usedBy.has(_healLocalId)) {
                healer.usedBy.add(_healLocalId);
                Game.player.hp = Math.min(Game.player.maxHp, Game.player.hp + Math.floor(Game.player.maxHp * 0.25));
                if (typeof Game.player.updateEffectiveStats === 'function') {
                    Game.player.updateEffectiveStats();
                }
                if (typeof AudioManager !== 'undefined' && AudioManager.sounds && AudioManager.sounds.heal) {
                    AudioManager.sounds.heal();
                }
                console.log("[Healer] Restored 25% HP to player", _healLocalId);
            }
        } else if (Game && Game.state === 'PLAYING' && currentInteraction.type === 'exitDoor') {
            if (typeof Game.toggleDoorReadyAtExit === 'function') {
                Game.toggleDoorReadyAtExit();
            }
        } else if (Game && Game.state === 'NEXUS') {
            // Handle specific nexus interaction types
            if (currentInteraction.type === 'modeSwitcher') {
                // Portal switcher is locked to Gear Mode (Card Mode removed)
                if (typeof nexusRoom !== 'undefined' && nexusRoom) {
                    nexusRoom.portalMode = 'gear';
                }
                console.log('[Nexus] Portal switcher is locked to Gear Mode');
            } else if (currentInteraction.type === 'gearUpgrade') {
                // Open gear upgrades
                if (typeof window !== 'undefined' && typeof window.toggleGearUpgrades === 'function') {
                    window.toggleGearUpgrades(true, currentInteraction.upgradeId);
                }
            } else if (currentInteraction.type === 'indexMachine') {
                // Open index machine
                if (typeof window !== 'undefined' && typeof window.UIIndexMachine !== 'undefined' && typeof window.UIIndexMachine.open === 'function') {
                    window.UIIndexMachine.open();
                }
            } else {
                // Fallback: Trigger nexus interaction by simulating G key press
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
    }

    return true;
}

// Handle interaction button click
function handleInteractionButtonClick(x, y) {
    if (!interactionButton || !currentInteraction) {
        recordMobileInteractionEvent('mobileInteractionMiss', null, { reason: 'noCurrentInteraction' });
        return false;
    }

    if (interactionButton.contains(x, y)) {
        interactionButton.justPressed = true;
        return performCurrentInteraction();
    }

    return false;
}

if (typeof window !== 'undefined') {
    window.getMobileInteractionState = getMobileInteractionState;
    window.performMobileInteraction = performCurrentInteraction;
}

// Render mobile loot selection UI (when multiple items nearby)
function renderMobileLootSelection(ctx) {
    if (!Input || !Input.isMobileUiMode || !Input.isMobileUiMode()) {
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
    ctx.font = 'bold 14px Orbitron';
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
    ctx.font = 'bold 24px Orbitron';
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
        ctx.font = 'bold 12px Orbitron';
        ctx.textAlign = 'center';
        const gearName = selectedGear.name || `${selectedGear.tier} ${selectedGear.slot}`;
        ctx.fillText(gearName, centerX, buttonY + buttonSize / 2);
    }
}

// Handle mobile loot selection button clicks
function handleMobileLootSelectionClick(x, y) {
    if (!Input || !Input.isMobileUiMode || !Input.isMobileUiMode()) {
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
    // Logic moved to Input.render() in js/input.js to prevent double rendering
    // and ensure consistency across all game states (including Nexus)
    return;
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
    ctx.font = 'bold 28px Orbitron';
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
    ctx.font = 'bold 20px Orbitron';
    ctx.fillText(`Following: ${spectatedName}`, centerX, 58);

    // Revival hint
    ctx.fillStyle = '#aaaaaa';
    ctx.font = 'italic 16px Orbitron';
    ctx.fillText('You will be revived when the room is cleared', centerX, canvasHeight - 20);
}

// Main UI render function
function renderUI(ctx, player) {
    if (!player) return;

    // In multiplayer, only show death screen when ALL players are dead
    // If local player dead but others alive, just spectate (no death screen overlay)
    const inMultiplayer = Game.multiplayerEnabled && typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.lobbyCode;

    // When dead but spectating (multiplayer), show spectator indicator
    if (player.dead && inMultiplayer && Game.spectateMode) {
        renderSpectatorIndicator(ctx);
    }

    // Render other players' health bars in multiplayer (when alive or spectating)
    if (inMultiplayer) {
        renderOtherPlayersHealthBars(ctx);
    }

    // Render gear tooltips in gear mode (using renderer-based UI which has direct access to positions)
    // Always use renderer-based tooltips for gear in gear mode, even with DOM UI active
    if (typeof renderGearTooltips === 'function' && typeof Game !== 'undefined' && Game.gameMode === 'gear') {
        renderGearTooltips(ctx, player);
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

// Multiplayer event callbacks (called by multiplayer.js)
function onLobbyCreated(data) {
    console.log('[Multiplayer] Lobby created:', data.code);
    // Note: multiplayerError variable was removed with old UI
    // This callback is kept for compatibility but may need updating
}

function onLobbyJoined(data) {
    console.log('[Multiplayer] Joined lobby:', data.code);
    // Note: multiplayerError variable was removed with old UI
    // This callback is kept for compatibility but may need updating
}

function onLobbyError(data) {
    multiplayerError = data.message || 'Unknown error';
}

function onPlayerJoined(data) {
    console.log('[Multiplayer] Player joined lobby');
}

function onPlayerLeft(data) {
    console.log('[Multiplayer] Player left lobby');
    if (data && data.playerId && typeof Game !== 'undefined' && typeof Game.handlePlayerRemovedFromLobby === 'function') {
        Game.handlePlayerRemovedFromLobby(data.playerId);
    }
}

function onHostMigrated(data, wasHost, isHost) {
    if (isHost && !wasHost) {
        if (typeof window.showToast === 'function') {
            window.showToast('You are now the host', 2500);
        }
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

        // Force a class-bearing player_state so host doesn't rebuild us as default square
        if (typeof multiplayerManager !== 'undefined' && multiplayerManager && !multiplayerManager.isHost) {
            multiplayerManager.lastPlayerStateSnapshot = null;
            setTimeout(() => {
                if (multiplayerManager && !multiplayerManager.isHost && typeof multiplayerManager.sendPlayerState === 'function') {
                    multiplayerManager.sendPlayerState();
                }
            }, 50);
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

