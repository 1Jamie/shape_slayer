// Item Pylon System - Multiplayer / local co-op item drops that each player claims once

// Initialize item pylons array
if (typeof Game !== 'undefined' && !Game.itemPylons) {
    Game.itemPylons = [];
}

/** True for online lobby OR local split — both use claim-once pylons instead of free-for-all ground items. */
function shouldUseItemPylons() {
    if (typeof Game !== 'undefined' && Game.localSplitEnabled) return true;
    return !!(typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.lobbyCode);
}

/**
 * Spawn a combat-item drop at (x, y).
 * Local co-op / online MP → shared claim-once pylon (non-competitive).
 * Solo → ground item (first player to touch gets it).
 */
function spawnItemDrop(x, y, itemDef) {
    if (!itemDef) return null;

    if (shouldUseItemPylons()) {
        if (typeof createItemPylon !== 'function') {
            console.error('[Item Drop] createItemPylon unavailable; refusing competitive ground drop in co-op');
            return null;
        }
        const pylon = createItemPylon(x, y, itemDef);
        if (typeof Game !== 'undefined') {
            if (!Game.itemsDroppedThisRoom) Game.itemsDroppedThisRoom = 0;
            Game.itemsDroppedThisRoom++;
        }
        return pylon;
    }

    const groundItem = {
        id: 'item_' + Date.now() + '_' + Math.random(),
        itemId: itemDef.id,
        definition: itemDef,
        x: x,
        y: y,
        size: 12,
        pulse: 0,
        pickupRadius: 30
    };
    if (typeof Game !== 'undefined') {
        if (!Game.groundItems) Game.groundItems = [];
        Game.groundItems.push(groundItem);
        if (!Game.itemsDroppedThisRoom) Game.itemsDroppedThisRoom = 0;
        Game.itemsDroppedThisRoom++;
    }
    return groundItem;
}

/** Convert any leftover solo ground items into pylons (e.g. enabling local co-op mid-run). */
function convertGroundItemsToPylons() {
    if (typeof Game === 'undefined' || !Game.groundItems || Game.groundItems.length === 0) return 0;
    if (typeof createItemPylon !== 'function') return 0;
    let converted = 0;
    const leftover = Game.groundItems.splice(0, Game.groundItems.length);
    for (const item of leftover) {
        createItemPylon(item.x, item.y, item.definition || null);
        converted++;
    }
    return converted;
}

function getItemPylonExpectedClaims() {
    if (typeof Game !== 'undefined' && Game.localSplitEnabled) return 2;
    if (typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.players) {
        return Math.max(1, multiplayerManager.players.length);
    }
    return 1;
}

function getItemPylonClaimIds() {
    if (typeof Game !== 'undefined' && Game.localSplitEnabled) {
        const p1 = typeof Game.getLocalPlayerId === 'function' ? Game.getLocalPlayerId() : 'local';
        return [p1, Game.localSplitPlayerId || 'local-seat-1'];
    }
    if (typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.players) {
        return multiplayerManager.players.map(p => p && p.id).filter(Boolean);
    }
    return [];
}

function resolvePylonPlayerId(player) {
    if (!player) return null;
    if (player.playerId) return player.playerId;
    if (typeof Game !== 'undefined' && Game.localSplitEnabled
        && Game.remotePlayerInstances
        && Game.remotePlayerInstances.get(Game.localSplitPlayerId) === player) {
        return Game.localSplitPlayerId;
    }
    if (typeof Game !== 'undefined' && typeof Game.getLocalPlayerId === 'function') {
        return Game.getLocalPlayerId();
    }
    if (typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.playerId) {
        return multiplayerManager.playerId;
    }
    return 'local';
}

function rollItemForPylon(pylon) {
    const pylonRarity = (pylon && pylon.rarity) || 'common';
    if (typeof ITEM_DEFINITIONS === 'undefined') return null;
    let pool = Object.values(ITEM_DEFINITIONS).filter(item => item.rarity === pylonRarity);
    if (pool.length === 0) {
        pool = Object.values(ITEM_DEFINITIONS).filter(item => item.rarity === 'common');
    }
    if (pool.length === 0) return null;
    return pool[Math.floor(Math.random() * pool.length)];
}

function grantPylonItemToPlayer(pylon, player, playerId) {
    if (!pylon || !player || !player.itemManager || !playerId) return false;
    if (!pylon.interactedPlayers) pylon.interactedPlayers = [];
    if (pylon.interactedPlayers.includes(playerId)) return false;

    const itemDef = rollItemForPylon(pylon);
    if (!itemDef) return false;
    const success = player.itemManager.addItem(itemDef.id);
    if (!success) return false;

    pylon.interactedPlayers.push(playerId);
    if (typeof Telemetry !== 'undefined') {
        Telemetry.recordEvent('itemPylonInteracted', {
            roomNumber: typeof Game !== 'undefined' && Game.roomNumber ? Game.roomNumber : 1,
            playerId,
            targetId: pylon.id,
            metadata: {
                pylonId: pylon.id,
                pylonRarity: pylon.rarity || 'common',
                itemId: itemDef.id,
                itemName: itemDef.name || null,
                itemRarity: itemDef.rarity || null,
                interactedCount: pylon.interactedPlayers.length,
                localSplit: !!(typeof Game !== 'undefined' && Game.localSplitEnabled)
            }
        });
    }

    if (typeof Game !== 'undefined') {
        if (!Game.itemPickupMessages) Game.itemPickupMessages = [];
        Game.itemPickupMessages.push({
            text: itemDef.name || itemDef.id,
            x: player.x,
            y: player.y - 40,
            alpha: 1,
            duration: 2.0,
            color: (typeof ITEM_RARITY_COLORS !== 'undefined' && ITEM_RARITY_COLORS[itemDef.rarity])
                || '#ffffff'
        });
    }
    if (typeof GameAudio !== 'undefined' && GameAudio.sounds && GameAudio.sounds.pickupChime) {
        GameAudio.sounds.pickupChime();
    }

    if (pylon.interactedPlayers.length >= getItemPylonExpectedClaims()) {
        pylon.disappearing = true;
        pylon.disappearProgress = 0;
    }
    return true;
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
function checkItemPylonInteraction(player, explicitPlayerId = null) {
    if (!Game.itemPylons || !player || !player.itemManager) return null;
    if (!shouldUseItemPylons()) return null;

    const playerId = explicitPlayerId || resolvePylonPlayerId(player);
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
function interactWithItemPylon(pylon, player, explicitPlayerId = null) {
    if (!pylon || !player || !player.itemManager) return false;
    if (!shouldUseItemPylons()) return false;

    const playerId = explicitPlayerId || resolvePylonPlayerId(player);
    if (!playerId) return false;

    if (!pylon.interactedPlayers) {
        pylon.interactedPlayers = [];
    }

    if (pylon.interactedPlayers.includes(playerId)) {
        return false; // Already interacted
    }

    // Local co-op: grant immediately on the shared sim (no network).
    if (typeof Game !== 'undefined' && Game.localSplitEnabled) {
        return grantPylonItemToPlayer(pylon, player, playerId);
    }

    const inMultiplayer = typeof multiplayerManager !== 'undefined' &&
        multiplayerManager &&
        multiplayerManager.lobbyCode;
    if (!inMultiplayer) return false;

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
    let pylonX = x;
    let pylonY = y;
    if (typeof currentRoom !== 'undefined' && currentRoom && currentRoom.layout && typeof RoomLayoutGenerator !== 'undefined' &&
        !RoomLayoutGenerator.isPointWalkable(currentRoom.layout, pylonX, pylonY, 25)) {
        const safePoint = RoomLayoutGenerator.findSafeSpawnPoint(currentRoom.layout, {
            radius: 25,
            margin: 80,
            minDistanceFrom: [{ x: currentRoom.layout.spawnZone.x, y: currentRoom.layout.spawnZone.y, distance: 160 }],
            maxAttempts: 100
        });
        if (safePoint) {
            pylonX = safePoint.x;
            pylonY = safePoint.y;
        }
    }

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
        x: pylonX,
        y: pylonY,
        size: 20,
        pulse: 0,
        rarity: pylonRarity, // Store the rarity - all players will get items of this rarity
        interactedPlayers: [], // Track which players have interacted
        disappearing: false,
        disappearProgress: 0
    };

    Game.itemPylons.push(pylon);
    if (typeof Telemetry !== 'undefined') {
        Telemetry.recordEvent('itemPylonCreated', {
            roomNumber: typeof Game !== 'undefined' && Game.roomNumber ? Game.roomNumber : 1,
            targetId: pylon.id,
            metadata: {
                pylonId: pylon.id,
                rarity: pylonRarity,
                sourceItemId: itemDef ? itemDef.id || null : null,
                sourceItemName: itemDef ? itemDef.name || null : null
            }
        });
    }
    console.log(`[Item Pylon] Created ${pylonRarity} rarity pylon at (${pylonX.toFixed(1)}, ${pylonY.toFixed(1)}) - each player will get a random ${pylonRarity} item`);

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

            // Draw interaction indicator (if any local-split / MP seat can interact)
            if (!pylon.disappearing) {
                const claimActors = [];
                if (typeof Game !== 'undefined' && Game.localSplitEnabled) {
                    if (typeof Game.getLocalCoopActors === 'function') {
                        for (const actor of Game.getLocalCoopActors()) {
                            claimActors.push({
                                player: actor.player,
                                playerId: actor.playerId,
                                seat: actor.seat || null
                            });
                        }
                    } else {
                        if (Game.player && Game.player.alive) {
                            claimActors.push({
                                player: Game.player,
                                playerId: typeof Game.getLocalPlayerId === 'function' ? Game.getLocalPlayerId() : 'local',
                                seat: Game.localSplitSession && Game.localSplitSession.seats
                                    ? Game.localSplitSession.seats[0] : null
                            });
                        }
                        const p2 = Game.remotePlayerInstances && Game.remotePlayerInstances.get(Game.localSplitPlayerId);
                        if (p2 && p2.alive) {
                            claimActors.push({
                                player: p2,
                                playerId: Game.localSplitPlayerId,
                                seat: Game.localSplitSession && Game.localSplitSession.seats
                                    ? Game.localSplitSession.seats[1] : null
                            });
                        }
                    }
                } else if (typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.playerId && Game.player) {
                    claimActors.push({ player: Game.player, playerId: multiplayerManager.playerId, seat: null });
                }

                let bestPrompt = null;
                let bestDist = 50;
                for (const actor of claimActors) {
                    if (!actor.player) continue;
                    const dx = pylon.x - actor.player.x;
                    const dy = pylon.y - actor.player.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist >= 50) continue;

                    const hasInteracted = pylon.interactedPlayers && pylon.interactedPlayers.includes(actor.playerId);
                    if (!hasInteracted && dist < bestDist) {
                        bestDist = dist;
                        bestPrompt = actor;
                    } else if (!bestPrompt && dist < bestDist) {
                        bestDist = dist;
                        bestPrompt = { ...actor, claimed: true };
                    }
                }

                if (bestPrompt) {
                    const hasInteracted = bestPrompt.claimed
                        || (pylon.interactedPlayers && pylon.interactedPlayers.includes(bestPrompt.playerId));
                    if (!hasInteracted) {
                        if ((typeof Engine !== 'undefined' && Engine.Input) && (!Engine.Input.shouldShowWorldInteractionHints || Engine.Input.shouldShowWorldInteractionHints())) {
                            const promptOpts = bestPrompt.seat ? { seat: bestPrompt.seat } : null;
                            ctx.fillStyle = '#ffff00';
                            ctx.globalAlpha = alpha;
                            ctx.font = 'bold 12px Orbitron';
                            ctx.textAlign = 'center';
                            if (Engine.Input.drawInteractionPrompt) {
                                Engine.Input.drawInteractionPrompt(ctx, 'interact', pylon.x, pylon.y + radius + 20, promptOpts);
                            } else {
                                const prompt = Engine.Input.getInteractionPrompt
                                    ? Engine.Input.getInteractionPrompt('interact', promptOpts)
                                    : 'Press G to interact';
                                ctx.fillText(prompt, pylon.x, pylon.y + radius + 20);
                            }
                        }
                    } else {
                        ctx.fillStyle = '#888888';
                        ctx.globalAlpha = alpha * 0.7;
                        ctx.font = 'bold 12px Orbitron';
                        ctx.textAlign = 'center';
                        ctx.fillText('Claimed', pylon.x, pylon.y + radius + 20);
                    }
                }
            }

            // Draw player interaction indicators (small dots for each player who interacted)
            if (pylon.interactedPlayers && pylon.interactedPlayers.length > 0) {
                const claimIds = getItemPylonClaimIds();
                const totalPlayers = Math.max(getItemPylonExpectedClaims(), claimIds.length || 1);
                const indicatorRadius = 3;
                const indicatorSpacing = 8;
                const startX = pylon.x - ((totalPlayers - 1) * indicatorSpacing) / 2;

                for (let i = 0; i < totalPlayers; i++) {
                    const indicatorX = startX + i * indicatorSpacing;
                    const indicatorY = pylon.y - radius - 15;

                    const playerId = claimIds[i] || null;
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

        // Draw interaction indicator (if any local-split / MP seat can interact)
        // Note: Interaction text is dynamic and view-dependent, so we don't cache it
        if (!pylon.disappearing) {
            const claimActors = [];
            if (typeof Game !== 'undefined' && Game.localSplitEnabled && typeof Game.getLocalCoopActors === 'function') {
                for (const actor of Game.getLocalCoopActors()) {
                    claimActors.push({
                        player: actor.player,
                        playerId: actor.playerId,
                        seat: actor.seat || null
                    });
                }
            } else if (typeof Game !== 'undefined' && Game.localSplitEnabled) {
                if (Game.player && Game.player.alive) {
                    claimActors.push({
                        player: Game.player,
                        playerId: typeof Game.getLocalPlayerId === 'function' ? Game.getLocalPlayerId() : 'local',
                        seat: Game.localSplitSession && Game.localSplitSession.seats
                            ? Game.localSplitSession.seats[0] : null
                    });
                }
                const p2 = Game.remotePlayerInstances && Game.remotePlayerInstances.get(Game.localSplitPlayerId);
                if (p2 && p2.alive) {
                    claimActors.push({
                        player: p2,
                        playerId: Game.localSplitPlayerId,
                        seat: Game.localSplitSession && Game.localSplitSession.seats
                            ? Game.localSplitSession.seats[1] : null
                    });
                }
            } else if (typeof multiplayerManager !== 'undefined' && multiplayerManager && multiplayerManager.playerId && Game.player) {
                claimActors.push({ player: Game.player, playerId: multiplayerManager.playerId, seat: null });
            }

            let bestPrompt = null;
            let bestDist = 50;
            for (const actor of claimActors) {
                if (!actor.player) continue;
                const dx = pylon.x - actor.player.x;
                const dy = pylon.y - actor.player.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist >= 50) continue;
                const hasInteracted = pylon.interactedPlayers && pylon.interactedPlayers.includes(actor.playerId);
                if (!hasInteracted && dist < bestDist) {
                    bestDist = dist;
                    bestPrompt = actor;
                } else if (!bestPrompt) {
                    bestDist = dist;
                    bestPrompt = { ...actor, claimed: true };
                }
            }

            if (bestPrompt) {
                const hasInteracted = bestPrompt.claimed
                    || (pylon.interactedPlayers && pylon.interactedPlayers.includes(bestPrompt.playerId));
                const radius = (pylon.size + pulseSize) * scale;
                if (!hasInteracted) {
                    ctx.save();
                    ctx.fillStyle = '#ffff00';
                    ctx.globalAlpha = alpha;
                    ctx.font = 'bold 12px Orbitron';
                    ctx.textAlign = 'center';
                    const promptOpts = bestPrompt.seat ? { seat: bestPrompt.seat } : null;
                    if ((typeof Engine !== 'undefined' && Engine.Input) && (!Engine.Input.shouldShowWorldInteractionHints || Engine.Input.shouldShowWorldInteractionHints())) {
                        if (Engine.Input.drawInteractionPrompt) {
                            Engine.Input.drawInteractionPrompt(ctx, 'interact', pylon.x, pylon.y + radius + 20, promptOpts);
                        } else {
                            const prompt = Engine.Input.getInteractionPrompt
                                ? Engine.Input.getInteractionPrompt('interact', promptOpts)
                                : 'Press G to interact';
                            ctx.fillText(prompt, pylon.x, pylon.y + radius + 20);
                        }
                    }
                    ctx.restore();
                } else {
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

        // Draw player interaction indicators (small dots for each player who interacted)
        if (pylon.interactedPlayers && pylon.interactedPlayers.length > 0) {
            const claimIds = getItemPylonClaimIds();
            const totalPlayers = Math.max(getItemPylonExpectedClaims(), claimIds.length || 1);
            const indicatorRadius = 3;
            const indicatorSpacing = 8;
            const startX = pylon.x - ((totalPlayers - 1) * indicatorSpacing) / 2;
            const radius = (pylon.size + pulseSize) * scale;

            for (let i = 0; i < totalPlayers; i++) {
                const indicatorX = startX + i * indicatorSpacing;
                const indicatorY = pylon.y - radius - 15;

                const playerId = claimIds[i] || null;
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

/** Snapshot fields for multiplayer game_state (host → clients). */
function serializeItemPylonForNetwork(pylon) {
    if (!pylon) return null;
    return {
        id: pylon.id,
        x: pylon.x,
        y: pylon.y,
        rarity: pylon.rarity || 'common', // Store the rarity - all players get items of this rarity
        interactedPlayers: pylon.interactedPlayers ? pylon.interactedPlayers.slice() : [],
        disappearing: pylon.disappearing || false,
        disappearProgress: pylon.disappearProgress || 0
    };
}

// Export functions
window.shouldUseItemPylons = shouldUseItemPylons;
window.spawnItemDrop = spawnItemDrop;
window.convertGroundItemsToPylons = convertGroundItemsToPylons;
window.getItemPylonExpectedClaims = getItemPylonExpectedClaims;
window.grantPylonItemToPlayer = grantPylonItemToPlayer;
window.updateItemPylons = updateItemPylons;
window.checkItemPylonInteraction = checkItemPylonInteraction;
window.interactWithItemPylon = interactWithItemPylon;
window.createItemPylon = createItemPylon;
window.renderItemPylons = renderItemPylons;
window.serializeItemPylonForNetwork = serializeItemPylonForNetwork;

