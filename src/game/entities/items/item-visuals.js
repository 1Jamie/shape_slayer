// Item Visual Effects - Renders visual effects for items (auras, etc.)

// Animation timers for auras (stored globally to persist across frames)
const auraAnimations = {
    damageAura: { rotation: 0, pulse: 0 },
    slowAura: { rotation: 0, pulse: 0 }
};

// Update aura animations
function updateItemVisuals(deltaTime) {
    // Update damage aura animation
    auraAnimations.damageAura.rotation += deltaTime * 1.0; // 1 rotation per second
    auraAnimations.damageAura.pulse += deltaTime * 2.0; // 2 pulses per second

    // Update slow aura animation
    auraAnimations.slowAura.rotation += deltaTime * 0.5; // 0.5 rotation per second
    auraAnimations.slowAura.pulse += deltaTime * 1.5; // 1.5 pulses per second
}

// Render item visual effects for all players
function renderItemVisuals(ctx) {
    if (typeof Game === 'undefined') return;

    // Render local player auras
    if (Game.player && Game.player.alive) {
        renderPlayerItemVisuals(ctx, Game.player);
    }

    // Render remote player auras (multiplayer)
    // Check both host instances and client shadow instances
    if (Game.remotePlayerInstances) {
        Game.remotePlayerInstances.forEach((remotePlayer, playerId) => {
            if (remotePlayer && remotePlayer.alive) {
                renderPlayerItemVisuals(ctx, remotePlayer);
            }
        });
    }

    // Also check client shadow instances (for clients rendering their own player)
    if (Game.remotePlayerShadowInstances) {
        Game.remotePlayerShadowInstances.forEach((shadowPlayer, playerId) => {
            if (shadowPlayer && shadowPlayer.alive) {
                renderPlayerItemVisuals(ctx, shadowPlayer);
            }
        });
    }
}

// Render item visual effects for a single player
function renderPlayerItemVisuals(ctx, player) {
    if (!player || !player.alive) return;

    // Damage Aura
    if (player.itemDamageAuraRadius > 0 && player.itemDamageAuraPercent > 0) {
        renderDamageAura(ctx, player, player.itemDamageAuraRadius);
    }

    // Slow Aura
    if (player.itemSlowAuraRadius > 0 && player.itemSlowAuraPercent > 0) {
        renderSlowAura(ctx, player, player.itemSlowAuraRadius);
    }
}

// Aura Cache System
const auraCache = new Map();

// Helper to get or create a cached aura sprite
function getCachedAura(type, radius) {
    // Round radius to reduce cache fragmentation
    const keyRadius = Math.ceil(radius);
    const key = `${type}_${keyRadius}`;

    if (auraCache.has(key)) {
        return auraCache.get(key);
    }

    // Create new cached aura
    const canvas = document.createElement('canvas');
    const diameter = keyRadius * 2;
    // Add padding for glow/spikes
    const padding = 20;
    canvas.width = diameter + padding * 2;
    canvas.height = diameter + padding * 2;
    const ctx = canvas.getContext('2d');
    const center = keyRadius + padding;

    if (type === 'damage') {
        // Draw main circle ring (thick, visible)
        ctx.strokeStyle = '#ff3333';
        ctx.lineWidth = 4;
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#ff6600';
        ctx.beginPath();
        ctx.arc(center, center, keyRadius, 0, Math.PI * 2);
        ctx.stroke();

        // Draw spikes pointing outward (8 spikes for visibility)
        const spikeCount = 8;
        const spikeLength = keyRadius * 0.2;
        const baseRadius = keyRadius * 0.92;

        ctx.strokeStyle = '#ff6600';
        ctx.lineWidth = 3;
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#ff4400';
        ctx.beginPath();
        for (let i = 0; i < spikeCount; i++) {
            const angle = (Math.PI * 2 / spikeCount) * i;
            const x1 = center + Math.cos(angle) * baseRadius;
            const y1 = center + Math.sin(angle) * baseRadius;
            const x2 = center + Math.cos(angle) * (baseRadius + spikeLength);
            const y2 = center + Math.sin(angle) * (baseRadius + spikeLength);
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
        }
        ctx.stroke();

        // Draw inner energy circle
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255, 100, 0, 0.15)';
        ctx.beginPath();
        ctx.arc(center, center, keyRadius * 0.3, 0, Math.PI * 2);
        ctx.fill();

        // Draw outer glow gradient (subtle)
        const gradient = ctx.createRadialGradient(center, center, keyRadius * 0.7, center, center, keyRadius);
        gradient.addColorStop(0, 'rgba(255, 50, 50, 0.2)');
        gradient.addColorStop(1, 'rgba(255, 50, 50, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(center, center, keyRadius, 0, Math.PI * 2);
        ctx.fill();

    } else if (type === 'slow') {
        // Draw hexagon pattern (6-sided) for slow aura - distinct from damage circle
        const hexagonSides = 6;
        const hexRadius = keyRadius * 0.95;

        ctx.strokeStyle = '#66aaff';
        ctx.lineWidth = 4;
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#88ccff';
        ctx.beginPath();
        for (let i = 0; i < hexagonSides; i++) {
            const angle = (Math.PI / 3) * i - Math.PI / 2; // Start from top
            const x = center + Math.cos(angle) * hexRadius;
            const y = center + Math.sin(angle) * hexRadius;
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.closePath();
        ctx.stroke();

        // Draw small ice crystals at hexagon corners (6 crystals)
        const crystalLength = keyRadius * 0.15;
        ctx.strokeStyle = '#88ccff';
        ctx.lineWidth = 3;
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#66aaff';
        ctx.beginPath();
        for (let i = 0; i < hexagonSides; i++) {
            const angle = (Math.PI / 3) * i - Math.PI / 2;
            const x1 = center + Math.cos(angle) * hexRadius;
            const y1 = center + Math.sin(angle) * hexRadius;
            const x2 = center + Math.cos(angle) * (hexRadius + crystalLength);
            const y2 = center + Math.sin(angle) * (hexRadius + crystalLength);
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
        }
        ctx.stroke();

        // Draw inner frost hexagon
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(150, 220, 255, 0.12)';
        ctx.beginPath();
        const innerHexRadius = keyRadius * 0.4;
        for (let i = 0; i < hexagonSides; i++) {
            const angle = (Math.PI / 3) * i - Math.PI / 2;
            const x = center + Math.cos(angle) * innerHexRadius;
            const y = center + Math.sin(angle) * innerHexRadius;
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.closePath();
        ctx.fill();

        // Draw outer frost glow (subtle)
        const gradient = ctx.createRadialGradient(center, center, keyRadius * 0.7, center, center, keyRadius);
        gradient.addColorStop(0, 'rgba(100, 200, 255, 0.15)');
        gradient.addColorStop(1, 'rgba(100, 200, 255, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(center, center, keyRadius, 0, Math.PI * 2);
        ctx.fill();
    }

    auraCache.set(key, canvas);
    return canvas;
}

// Ring Cache System (for animated overlays)
const ringCache = new Map();

// Helper to get or create a cached ring sprite
function getCachedRing(type, radius) {
    // Round radius to reduce cache fragmentation
    const keyRadius = Math.ceil(radius);
    const key = `${type}_${keyRadius}`;

    if (ringCache.has(key)) {
        return ringCache.get(key);
    }

    // Create new cached ring
    const canvas = document.createElement('canvas');
    const diameter = keyRadius * 2;
    // Add padding for glow/stroke
    const padding = 20;
    canvas.width = diameter + padding * 2;
    canvas.height = diameter + padding * 2;
    const ctx = canvas.getContext('2d');
    const center = keyRadius + padding;

    if (type === 'damage') {
        // Draw main range ring (dashed red/orange)
        ctx.strokeStyle = '#ff3333';
        ctx.lineWidth = 4;
        ctx.setLineDash([10, 6]); // Dashed pattern
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ff6600';
        ctx.beginPath();
        ctx.arc(center, center, keyRadius, 0, Math.PI * 2);
        ctx.stroke();

        // Draw inner solid ring (thinner, more transparent)
        ctx.strokeStyle = 'rgba(255, 150, 50, 0.7)';
        ctx.lineWidth = 2;
        ctx.setLineDash([]); // Solid line
        ctx.shadowBlur = 6;
        ctx.shadowColor = '#ff8844';
        ctx.beginPath();
        ctx.arc(center, center, keyRadius * 0.95, 0, Math.PI * 2);
        ctx.stroke();
    } else if (type === 'slow') {
        // Draw main range ring (dashed frosty blue)
        ctx.strokeStyle = '#66aaff';
        ctx.lineWidth = 4;
        ctx.setLineDash([8, 5]); // Different dash pattern
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#88ccff';
        ctx.beginPath();
        ctx.arc(center, center, keyRadius, 0, Math.PI * 2);
        ctx.stroke();

        // Draw inner solid ring (thinner, more transparent)
        ctx.strokeStyle = 'rgba(150, 200, 255, 0.7)';
        ctx.lineWidth = 2;
        ctx.setLineDash([]); // Solid line
        ctx.shadowBlur = 6;
        ctx.shadowColor = '#88aaff';
        ctx.beginPath();
        ctx.arc(center, center, keyRadius * 0.95, 0, Math.PI * 2);
        ctx.stroke();
    }

    ringCache.set(key, canvas);
    return canvas;
}

// Render damage aura (red/orange ring showing range)
function renderDamageAura(ctx, player, radius) {
    // Validate inputs to prevent NaN/Infinity
    if (!player || !isFinite(radius) || radius <= 0 || !isFinite(player.x) || !isFinite(player.y)) {
        return;
    }

    const anim = auraAnimations.damageAura;
    const pulseScale = 1.0 + Math.sin(anim.pulse) * 0.03; // Subtle pulse 0.97-1.03

    // OPTIMIZATION: Use base radius for caching to avoid thrashing
    // Apply pulseScale via transform instead of requesting new cache size every frame

    ctx.save();

    // Use world coordinates (camera transform is already applied in renderGameWorld)
    const worldX = player.x;
    const worldY = player.y;

    // Validate world coordinates
    if (!isFinite(worldX) || !isFinite(worldY)) {
        ctx.restore();
        return;
    }

    // Use cached aura sprite for base (includes glow, spikes, inner circle)
    const cachedAura = getCachedAura('damage', radius);
    if (cachedAura) {
        const padding = 20;
        const center = Math.ceil(radius) + padding;
        ctx.save(); // Save state before transforms
        ctx.translate(worldX, worldY);
        ctx.rotate(anim.rotation); // Apply rotation
        ctx.scale(pulseScale, pulseScale); // Apply pulse scale
        ctx.drawImage(cachedAura, -center, -center);
        ctx.restore(); // Restore state after drawing cached sprite
    }

    // Use cached ring for the animated overlay
    // We rotate the entire cached ring to simulate the dashing animation
    const cachedRing = getCachedRing('damage', radius);
    if (cachedRing) {
        const padding = 20;
        const center = Math.ceil(radius) + padding;
        ctx.save();
        ctx.translate(worldX, worldY);
        // Rotate the ring to simulate dashes moving
        // The original code used lineDashOffset = anim.rotation * 20
        // Rotating the ring gives a similar visual effect of spinning
        ctx.rotate(anim.rotation);
        ctx.scale(pulseScale, pulseScale);
        ctx.drawImage(cachedRing, -center, -center);
        ctx.restore();
    }

    ctx.restore();
}

// Render slow aura (frosty blue ring showing range - distinct from shield)
function renderSlowAura(ctx, player, radius) {
    // Validate inputs to prevent NaN/Infinity
    if (!player || !isFinite(radius) || radius <= 0 || !isFinite(player.x) || !isFinite(player.y)) {
        return;
    }

    const anim = auraAnimations.slowAura;
    const pulseScale = 1.0 + Math.sin(anim.pulse) * 0.03; // Subtle pulse 0.97-1.03

    // OPTIMIZATION: Use base radius for caching

    ctx.save();

    // Use world coordinates (camera transform is already applied in renderGameWorld)
    const worldX = player.x;
    const worldY = player.y;

    // Validate world coordinates
    if (!isFinite(worldX) || !isFinite(worldY)) {
        ctx.restore();
        return;
    }

    // Use cached aura sprite for base (includes glow, crystals, inner circle)
    const cachedAura = getCachedAura('slow', radius);
    if (cachedAura) {
        const padding = 20;
        const center = Math.ceil(radius) + padding;
        ctx.save(); // Save state before transforms
        ctx.translate(worldX, worldY);
        ctx.rotate(anim.rotation); // Apply rotation
        ctx.scale(pulseScale, pulseScale); // Apply pulse scale
        ctx.drawImage(cachedAura, -center, -center);
        ctx.restore(); // Restore state after drawing cached sprite
    }

    // Use cached ring for the animated overlay
    const cachedRing = getCachedRing('slow', radius);
    if (cachedRing) {
        const padding = 20;
        const center = Math.ceil(radius) + padding;
        ctx.save();
        ctx.translate(worldX, worldY);
        // Rotate opposite direction for slow aura
        ctx.rotate(-anim.rotation);
        ctx.scale(pulseScale, pulseScale);
        ctx.drawImage(cachedRing, -center, -center);
        ctx.restore();
    }

    ctx.restore();
}

