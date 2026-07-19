// Item Ground System - Handles ground item rendering, pickup, and visual effects

// Initialize ground items array
if (typeof Game !== 'undefined' && !Game.groundItems) {
    Game.groundItems = [];
}

// Initialize item pickup messages
if (typeof Game !== 'undefined' && !Game.itemPickupMessages) {
    Game.itemPickupMessages = [];
}

// Rarity colors for visual feedback
const ITEM_RARITY_COLORS = {
    common: '#999999',
    uncommon: '#4caf50',
    rare: '#2196f3',
    epic: '#9c27b0'
};

// Update ground items (pulse animation)
function updateGroundItems(deltaTime) {
    if (!Game.groundItems) return;

    for (const item of Game.groundItems) {
        item.pulse = (item.pulse || 0) + deltaTime * 3;
    }
}

// Update item pickup messages (fade and float)
function updateItemPickupMessages(deltaTime) {
    if (!Game.itemPickupMessages) return;

    for (let i = Game.itemPickupMessages.length - 1; i >= 0; i--) {
        const msg = Game.itemPickupMessages[i];
        msg.duration -= deltaTime;
        msg.alpha = Math.max(0, msg.duration / 2.0);
        msg.y -= deltaTime * 30; // Float upward

        if (msg.duration <= 0) {
            Game.itemPickupMessages.splice(i, 1);
        }
    }
}

// Check for item pickup (call in game update loop)
function checkItemPickup(player) {
    // Competitive ground pickups are solo-only. Local co-op / online MP use pylons.
    if (typeof shouldUseItemPylons === 'function' && shouldUseItemPylons()) return;
    if (!Game.groundItems || !player || !player.itemManager) return;

    for (let i = Game.groundItems.length - 1; i >= 0; i--) {
        const item = Game.groundItems[i];

        // Check distance to player
        const dx = player.x - item.x;
        const dy = player.y - item.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < item.pickupRadius) {
            // Pick up item
            const success = player.itemManager.addItem(item.itemId);

            if (success) {
                if (typeof Telemetry !== 'undefined') {
                    Telemetry.recordEvent('itemPickedUp', {
                        roomNumber: typeof Game !== 'undefined' && Game.roomNumber ? Game.roomNumber : 1,
                        playerId: player.playerId || (typeof Game !== 'undefined' && Game.getLocalPlayerId ? Game.getLocalPlayerId() : 'local'),
                        targetId: item.itemId,
                        metadata: {
                            itemId: item.itemId,
                            itemName: item.definition ? item.definition.name : null,
                            rarity: item.definition ? item.definition.rarity : null,
                            source: 'ground'
                        }
                    });
                }

                // Remove from ground
                Game.groundItems.splice(i, 1);

                // Show pickup message
                showItemPickupMessage(item.definition.name, item.definition.rarity);

                // Play sound (if available)
                if (typeof Engine !== 'undefined' && Engine.Audio && Engine.Audio.playSound) {
                    Engine.Audio.playSound('itemPickup', 0.4);
                }
            }
        }
    }
}

// Show item pickup message
function showItemPickupMessage(itemName, rarity) {
    if (!Game.itemPickupMessages) Game.itemPickupMessages = [];

    const color = ITEM_RARITY_COLORS[rarity] || '#999999';

    Game.itemPickupMessages.push({
        text: `+${itemName}`,
        color: color,
        alpha: 1.0,
        y: Game.canvas.height / 2 - 50,
        duration: 2.0
    });

    // Also show toast notification
    if (typeof window.showToast === 'function') {
        window.showToast(`Picked up: ${itemName}`, 2500);
    }
}

// Render ground items
function renderGroundItems(ctx, visibleItems) {
    const items = visibleItems || Game.groundItems;
    if (!items || items.length === 0) return;

    for (const item of items) {
        const pulseSize = 2 + Math.sin(item.pulse) * 2;
        const color = ITEM_RARITY_COLORS[item.definition.rarity] || '#999999';

        ctx.save();

        // Glow effect
        ctx.shadowBlur = 15;
        ctx.shadowColor = color;

        // Draw item circle
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.arc(item.x, item.y, item.size + pulseSize, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;

        // Draw icon (first letter of icon name)
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px Orbitron';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(item.definition.icon.charAt(0).toUpperCase(), item.x, item.y);

        ctx.restore();
    }
}

// Render item pickup messages
function renderItemPickupMessages(ctx) {
    if (!Game.itemPickupMessages || Game.itemPickupMessages.length === 0) return;

    ctx.save();
    ctx.font = 'bold 20px Orbitron';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (const msg of Game.itemPickupMessages) {
        ctx.globalAlpha = msg.alpha;
        ctx.fillStyle = msg.color;
        ctx.fillText(msg.text, Game.canvas.width / 2, msg.y);
    }

    ctx.restore();
}

// Dev console commands for dropping items
// Usage: dropItem() - drops a random item
//        dropItem('shield_generator') - drops a specific item by ID
window.dropItem = function(itemId = null) {
    if (typeof Game === 'undefined') {
        console.error('[Dev] Game not available');
        return;
    }
    
    if (typeof ITEM_DEFINITIONS === 'undefined') {
        console.error('[Dev] ITEM_DEFINITIONS not available');
        return;
    }
    
    // Get item definition
    let itemDef;
    if (itemId) {
        itemDef = ITEM_DEFINITIONS[itemId];
        if (!itemDef) {
            console.error(`[Dev] Item not found: ${itemId}`);
            console.log('[Dev] Available items:', Object.keys(ITEM_DEFINITIONS).join(', '));
            return;
        }
    } else {
        // Get random item
        if (typeof getRandomItem === 'function') {
            itemDef = getRandomItem();
        } else {
            console.error('[Dev] getRandomItem function not available');
            return;
        }
    }
    
    // Determine drop position
    let dropX, dropY;
    if (Game.player && Game.player.alive) {
        // Drop at player position
        dropX = Game.player.x;
        dropY = Game.player.y;
    } else if (typeof currentRoom !== 'undefined' && currentRoom) {
        // Drop at room center
        dropX = currentRoom.width / 2;
        dropY = currentRoom.height / 2;
    } else {
        // Drop at screen center
        dropX = Game.config ? Game.config.width / 2 : 640;
        dropY = Game.config ? Game.config.height / 2 : 360;
    }
    
    // Local co-op / online MP → shared pylon; solo → ground pickup.
    if (typeof spawnItemDrop === 'function') {
        return spawnItemDrop(dropX, dropY, itemDef);
    }

    // Fallback if pylon helpers have not loaded yet (solo-safe only).
    if (typeof shouldUseItemPylons === 'function' && shouldUseItemPylons()) {
        console.error('[Dev] spawnItemDrop unavailable while pylons required');
        return null;
    }

    const groundItem = {
        id: 'item_' + Date.now() + '_' + Math.random(),
        itemId: itemDef.id,
        definition: itemDef,
        x: dropX,
        y: dropY,
        size: 12,
        pulse: 0,
        pickupRadius: 30
    };

    if (!Game.groundItems) Game.groundItems = [];
    Game.groundItems.push(groundItem);

    console.log(`[Dev] Dropped item: ${itemDef.name} (${itemDef.rarity}) at (${dropX.toFixed(1)}, ${dropY.toFixed(1)})`);
    return groundItem;
};

// List all available item IDs
window.listItems = function() {
    if (typeof ITEM_DEFINITIONS === 'undefined') {
        console.error('[Dev] ITEM_DEFINITIONS not available');
        return;
    }
    
    const items = Object.entries(ITEM_DEFINITIONS).map(([id, def]) => ({
        id: id,
        name: def.name,
        rarity: def.rarity,
        category: def.category
    }));
    
    console.table(items);
    return items;
};

// Render item inventory (bottom-right HUD)
function renderItemInventory(ctx, player) {
    if (!player || !player.itemManager) return;

    const items = player.itemManager.getItemsArray();
    if (items.length === 0) return;

    const startX = Game.canvas.width - 220;
    const startY = Game.canvas.height - 150;
    const itemSize = 32;
    const itemSpacing = 4;
    const itemsPerRow = 5;

    // Background panel
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    const panelHeight = Math.ceil(items.length / itemsPerRow) * (itemSize + itemSpacing) + 40;
    ctx.fillRect(startX - 10, startY - 30, 210, panelHeight);

    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px Orbitron';
    ctx.textAlign = 'left';
    ctx.fillText('Items', startX, startY - 10);

    // Render each item
    items.forEach((item, index) => {
        const row = Math.floor(index / itemsPerRow);
        const col = index % itemsPerRow;
        const x = startX + col * (itemSize + itemSpacing);
        const y = startY + row * (itemSize + itemSpacing);

        const color = ITEM_RARITY_COLORS[item.definition.rarity] || '#999999';

        // Item background
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.3;
        ctx.fillRect(x, y, itemSize, itemSize);
        ctx.globalAlpha = 1.0;

        // Item border
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, itemSize, itemSize);

        // Item icon
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px Orbitron';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(item.definition.icon.charAt(0).toUpperCase(),
            x + itemSize / 2, y + itemSize / 2);

        // Stack count
        if (item.stacks > 1) {
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 10px Orbitron';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'bottom';
            ctx.fillText(`x${item.stacks}`, x + itemSize - 2, y + itemSize - 2);
        }

        // Store bounds for hover detection (if needed)
        if (!Game.itemInventoryBounds) Game.itemInventoryBounds = [];
        Game.itemInventoryBounds[index] = { x, y, w: itemSize, h: itemSize, item };
    });
}
