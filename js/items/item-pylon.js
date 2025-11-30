// Item Pylon System - Multiplayer item drops that each player can interact with once

// Initialize item pylons array
if (typeof Game !== 'undefined' && !Game.itemPylons) {
    Game.itemPylons = [];
}

// Rarity colors (use existing from item-ground.js if available, otherwise define fallback)
// Note: ITEM_RARITY_COLORS is already defined in item-ground.js, so we just use it
// If for some reason it's not available, we'll use a fallback function
function getItemRarityColor(rarity) {
    if (typeof ITEM_RARITY_COLORS !== 'undefined' && ITEM_RARITY_COLORS[rarity]) {
        return ITEM_RARITY_COLORS[rarity];
    }
    // Fallback colors
    const fallbackColors = {
        common: '#999999',
        uncommon: '#4caf50',
        rare: '#2196f3',
        epic: '#9c27b0'
    };
    return fallbackColors[rarity] || '#999999';
}

// Update item pylons (animation and cleanup)
function updateItemPylons(deltaTime) {
    if (!Game.itemPylons) return;

    for (let i = Game.itemPylons.length - 1; i >= 0; i--) {
        const pylon = Game.itemPylons[i];

        // Update pulse animation
        pylon.pulse = (pylon.pulse || 0) + deltaTime * 3;

        // Update disappear animation
        if (pylon.disappearing) {
            pylon.disappearProgress = (pylon.disappearProgress || 0) + deltaTime * 2; // 0.5 second animation

            if (pylon.disappearProgress >= 1.0) {
                // Animation complete, remove pylon
                Game.itemPylons.splice(i, 1);
                continue;
            }
        }
    }
}

// Check if player can interact with an item pylon
function checkItemPylonInteraction(player) {
    if (!Game.itemPylons || !player || !player.itemManager) return null;

    // Check if in multiplayer
    const inMultiplayer = typeof multiplayerManager !== 'undefined' &&
        multiplayerManager &&
        multiplayerManager.lobbyCode;

    if (!inMultiplayer) return null; // Only works in multiplayer

    const playerId = multiplayerManager.playerId;
    if (!playerId) return null;

    let nearest = null;
    let bestDist2 = Infinity;
    const interactionRadius = 50; // Interaction radius

    for (const pylon of Game.itemPylons) {
        // Skip if pylon is disappearing
        if (pylon.disappearing) continue;

        // Skip if this player already interacted
        if (pylon.interactedPlayers && pylon.interactedPlayers.includes(playerId)) continue;

        const dx = pylon.x - player.x;
        const dy = pylon.y - player.y;
        const dist2 = dx * dx + dy * dy;

        if (dist2 < bestDist2 && dist2 <= interactionRadius * interactionRadius) {
            bestDist2 = dist2;
            nearest = pylon;
        }
    }

    return nearest;
}

// Interact with an item pylon (give player an item)
function interactWithItemPylon(pylon, player) {
    if (!pylon || !player || !player.itemManager) return false;

    // Check if in multiplayer
    const inMultiplayer = typeof multiplayerManager !== 'undefined' &&
        multiplayerManager &&
        multiplayerManager.lobbyCode;

    if (!inMultiplayer) return false;

    const playerId = multiplayerManager.playerId;
    if (!playerId) return false;

    // Check if player already interacted
    if (!pylon.interactedPlayers) {
        pylon.interactedPlayers = [];
    }

    if (pylon.interactedPlayers.includes(playerId)) {
        return false; // Already interacted
    }

    // Send interaction request to host (host is authoritative)
    if (multiplayerManager.send) {
        multiplayerManager.send({
            type: 'item_pylon_interact_request',
            data: {
                pylonId: pylon.id,
                playerId: playerId
            }
        });
    }

    // If we're the host, process immediately
    if (multiplayerManager.isHost) {
        // Host processes the interaction
        if (multiplayerManager.handleItemPylonInteractRequest) {
            multiplayerManager.handleItemPylonInteractRequest({
                pylonId: pylon.id,
                playerId: playerId
            });
        }
    }

    return true; // Request sent
}

// Create an item pylon (called when item drops in multiplayer)
// The pylon determines a rarity when created, and each player gets a random item of that rarity
function createItemPylon(x, y, itemDef = null) {
    if (!Game.itemPylons) Game.itemPylons = [];

    // Determine rarity for this pylon (all players will get items of this rarity)
    let pylonRarity = 'common';
    if (itemDef && itemDef.rarity) {
        // Use the rarity of the item that triggered the drop
        pylonRarity = itemDef.rarity;
    } else if (typeof ITEM_RARITY_WEIGHTS !== 'undefined') {
        // Roll for rarity based on weights
        const totalWeight = Object.values(ITEM_RARITY_WEIGHTS).reduce((a, b) => a + b, 0);
        let random = Math.random() * totalWeight;

        for (const [rarity, weight] of Object.entries(ITEM_RARITY_WEIGHTS)) {
            random -= weight;
            if (random <= 0) {
                pylonRarity = rarity;
                break;
            }
        }
    }

    const pylon = {
        id: 'pylon_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        x: x,
        y: y,
        size: 20,
        pulse: 0,
        rarity: pylonRarity, // Store the rarity - all players will get items of this rarity
        interactedPlayers: [], // Track which players have interacted
        disappearing: false,
        disappearProgress: 0
    };

    Game.itemPylons.push(pylon);
    console.log(`[Item Pylon] Created ${pylonRarity} rarity pylon at (${x.toFixed(1)}, ${y.toFixed(1)}) - each player will get a random ${pylonRarity} item`);

    return pylon;
}

// Pylon Cache System
const pylonCache = new Map();

// Helper to get or create a cached pylon sprite
function getCachedPylon(color, size) {
    // Round size to reduce fragmentation
    const keySize = Math.ceil(size);
    const key = `${color}_${keySize}`;

    if (pylonCache.has(key)) {
        return pylonCache.get(key);
    }

    // Create new cached pylon
    const canvas = document.createElement('canvas');
    // Size includes glow + padding
    const padding = 25;
    const diameter = keySize * 2;
    canvas.width = diameter + padding * 2;
    canvas.height = diameter + padding * 2;
    const ctx = canvas.getContext('2d');
    const center = keySize + padding;

    // Glow effect
    ctx.shadowBlur = 20;
    ctx.shadowColor = color;

    // Draw pylon base (hexagon shape)
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i;
        const px = center + Math.cos(angle) * keySize;
        const py = center + Math.sin(angle) * keySize;
        if (i === 0) {
            ctx.moveTo(px, py);
        } else {
            ctx.lineTo(px, py);
        }
    }
    ctx.closePath();
    ctx.fill();

    // Draw center circle
    ctx.shadowBlur = 0; // Reset shadow for inner details
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(center, center, keySize * 0.4, 0, Math.PI * 2);
    ctx.fill();

    // Draw pylon icon
    const icon = '!';
    ctx.fillStyle = color;
    ctx.globalAlpha = 1.0;
    ctx.font = 'bold ' + (12 * (keySize / 20)) + 'px Orbitron'; // Scale font relative to default size 20
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icon, center, center);

    pylonCache.set(key, canvas);
    return canvas;
}

// Render item pylons
function renderItemPylons(ctx) {
    if (!Game.itemPylons || Game.itemPylons.length === 0) return;

    for (const pylon of Game.itemPylons) {
        // Skip if fully disappeared
        if (pylon.disappearing && pylon.disappearProgress >= 1.0) continue;

        const alpha = pylon.disappearing ? (1.0 - pylon.disappearProgress) : 1.0;
        const scale = pylon.disappearing ? (1.0 - pylon.disappearProgress * 0.5) : 1.0;
        const pulseSize = 3 + Math.sin(pylon.pulse) * 2;
        // Get rarity color from the pylon's stored rarity
        const rarity = pylon.rarity || 'common';
        const color = getItemRarityColor(rarity);

        // Check debug flag
        if (typeof DebugFlags !== 'undefined' && DebugFlags.USE_CACHING === false) {
            // Fallback to original rendering
            ctx.save();
            ctx.globalAlpha = alpha;

            // Glow effect
            ctx.shadowBlur = 20;
            ctx.shadowColor = color;

            // Draw pylon base (hexagon shape)
            const radius = (pylon.size + pulseSize) * scale;
            ctx.fillStyle = color;
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const angle = (Math.PI / 3) * i;
                const px = pylon.x + Math.cos(angle) * radius;
                const py = pylon.y + Math.sin(angle) * radius;
                if (i === 0) {
                    ctx.moveTo(px, py);
                } else {
                    ctx.lineTo(px, py);
                }
            }
            ctx.closePath();
            ctx.fill();

            // Draw center circle
            ctx.fillStyle = '#ffffff';
            ctx.globalAlpha = alpha * 0.9;
            ctx.beginPath();
            ctx.arc(pylon.x, pylon.y, radius * 0.4, 0, Math.PI * 2);
            ctx.fill();

            // Draw pylon icon - use "!" to indicate it's a pylon that gives random items
            // (each player gets a different random item, so we don't show a specific item icon)
            const icon = '!';
            ctx.fillStyle = color;
            ctx.globalAlpha = alpha;
            ctx.font = 'bold ' + (12 * scale) + 'px Orbitron';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(icon, pylon.x, pylon.y);

            // Draw interaction indicator (if player can interact)
            if (!pylon.disappearing) {
                const inMultiplayer = typeof multiplayerManager !== 'undefined' &&
                    multiplayerManager &&
                    multiplayerManager.playerId;

                if (inMultiplayer && Game.player) {
                    const dx = pylon.x - Game.player.x;
                    const dy = pylon.y - Game.player.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < 50) {
                        // Check if player already interacted
                        const playerId = multiplayerManager.playerId;
                        const hasInteracted = pylon.interactedPlayers && pylon.interactedPlayers.includes(playerId);

                        if (!hasInteracted) {
                            // Show interaction prompt
                            if (typeof Input !== 'undefined' && !Input.isTouchMode()) {
                                ctx.fillStyle = '#ffff00';
                                ctx.globalAlpha = alpha;
                                ctx.font = 'bold 12px Orbitron';
                                ctx.textAlign = 'center';
                                ctx.fillText('Press G to interact', pylon.x, pylon.y + radius + 20);
                            }
                        } else {
                            // Show "Already claimed" message
                            ctx.fillStyle = '#888888';
                            ctx.globalAlpha = alpha * 0.7;
                            ctx.font = 'bold 12px Orbitron';
                            ctx.textAlign = 'center';
                            ctx.fillText('Claimed', pylon.x, pylon.y + radius + 20);
                        }
                    }
                }
            }

            // Draw player interaction indicators (small dots for each player who interacted)
            if (pylon.interactedPlayers && pylon.interactedPlayers.length > 0) {
                const totalPlayers = multiplayerManager && multiplayerManager.players ? multiplayerManager.players.length : 1;
                const indicatorRadius = 3;
                const indicatorSpacing = 8;
                const startX = pylon.x - ((totalPlayers - 1) * indicatorSpacing) / 2;

                for (let i = 0; i < totalPlayers; i++) {
                    const indicatorX = startX + i * indicatorSpacing;
                    const indicatorY = pylon.y - radius - 15;

                    const playerId = multiplayerManager && multiplayerManager.players && multiplayerManager.players[i]
                        ? multiplayerManager.players[i].id
                        : null;

                    const hasInteracted = playerId && pylon.interactedPlayers.includes(playerId);

                    ctx.fillStyle = hasInteracted ? '#00ff00' : '#444444';
                    ctx.globalAlpha = alpha * 0.8;
                    ctx.beginPath();
                    ctx.arc(indicatorX, indicatorY, indicatorRadius, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            ctx.restore();
            continue;
        }

        // Use cached pylon
        // Base size is 20, we add pulseSize at draw time via scaling
        const baseSize = 20;
        const cachedCanvas = getCachedPylon(color, baseSize);

        ctx.save();
        ctx.globalAlpha = alpha;

        // Apply pulse scale
        // Effective radius = (baseSize + pulseSize) * scale
        // Draw scale = ((baseSize + pulseSize) / baseSize) * scale
        const drawScale = ((baseSize + pulseSize) / baseSize) * scale;

        ctx.translate(pylon.x, pylon.y);
        ctx.scale(drawScale, drawScale);

        const offset = cachedCanvas.width / 2;
        ctx.drawImage(cachedCanvas, -offset, -offset);

        ctx.restore();

        // Draw interaction indicator (if player can interact)
        // Note: Interaction text is dynamic and view-dependent, so we don't cache it
        if (!pylon.disappearing) {
            const inMultiplayer = typeof multiplayerManager !== 'undefined' &&
                multiplayerManager &&
                multiplayerManager.playerId;

            if (inMultiplayer && Game.player) {
                const dx = pylon.x - Game.player.x;
                const dy = pylon.y - Game.player.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < 50) {
                    // Check if player already interacted
                    const playerId = multiplayerManager.playerId;
                    const hasInteracted = pylon.interactedPlayers && pylon.interactedPlayers.includes(playerId);

                    const radius = (pylon.size + pulseSize) * scale;

                    if (!hasInteracted) {
                        // Show interaction prompt
                        ctx.save();
                        ctx.fillStyle = '#ffff00';
                        ctx.globalAlpha = alpha;
                        ctx.font = 'bold 12px Orbitron';
                        ctx.textAlign = 'center';
                        if (typeof Input !== 'undefined' && !Input.isTouchMode()) {
                            ctx.fillText('Press G to interact', pylon.x, pylon.y + radius + 20);
                        }
                        ctx.restore();
                    } else {
                        // Show "Already claimed" message
                        ctx.save();
                        ctx.fillStyle = '#888888';
                        ctx.globalAlpha = alpha * 0.7;
                        ctx.font = 'bold 12px Orbitron';
                        ctx.textAlign = 'center';
                        ctx.fillText('Claimed', pylon.x, pylon.y + radius + 20);
                        ctx.restore();
                    }
                }
            }
        }

        // Draw player interaction indicators (small dots for each player who interacted)
        if (pylon.interactedPlayers && pylon.interactedPlayers.length > 0) {
            const totalPlayers = multiplayerManager && multiplayerManager.players ? multiplayerManager.players.length : 1;
            const indicatorRadius = 3;
            const indicatorSpacing = 8;
            const startX = pylon.x - ((totalPlayers - 1) * indicatorSpacing) / 2;
            const radius = (pylon.size + pulseSize) * scale;

            for (let i = 0; i < totalPlayers; i++) {
                const indicatorX = startX + i * indicatorSpacing;
                const indicatorY = pylon.y - radius - 15;

                const playerId = multiplayerManager && multiplayerManager.players && multiplayerManager.players[i]
                    ? multiplayerManager.players[i].id
                    : null;

                const hasInteracted = playerId && pylon.interactedPlayers.includes(playerId);

                ctx.save();
                ctx.fillStyle = hasInteracted ? '#00ff00' : '#444444';
                ctx.globalAlpha = alpha * 0.8;
                ctx.beginPath();
                ctx.arc(indicatorX, indicatorY, indicatorRadius, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
        }
    }
}

// Export functions
window.updateItemPylons = updateItemPylons;
window.checkItemPylonInteraction = checkItemPylonInteraction;
window.interactWithItemPylon = interactWithItemPylon;
window.createItemPylon = createItemPylon;
window.renderItemPylons = renderItemPylons;

