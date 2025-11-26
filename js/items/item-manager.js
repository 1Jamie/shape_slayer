// Item Manager - Manages player's item inventory, stacking, and effect application

class ItemManager {
    constructor(player) {
        this.player = player;
        this.items = {}; // { itemId: { definition: ITEM_DEF, stacks: 2 } }
    }

    // Add item to inventory
    addItem(itemId) {
        const itemDef = ITEM_DEFINITIONS[itemId];
        if (!itemDef) {
            console.error('[ItemManager] Unknown item:', itemId);
            return false;
        }

        // Check if item already exists
        if (this.items[itemId]) {
            // Stack it
            const currentStacks = this.items[itemId].stacks;

            // Check max stacks (only if maxStacks is defined)
            if (itemDef.maxStacks !== null && itemDef.maxStacks !== undefined && currentStacks >= itemDef.maxStacks) {
                console.log(`[ItemManager] Item ${itemId} is at max stacks (${itemDef.maxStacks})`);
                return false;
            }

            // Remove old effect
            itemDef.removeEffect(this.player, currentStacks);

            // Increment stack
            this.items[itemId].stacks++;

            // Apply new effect
            itemDef.applyEffect(this.player, this.items[itemId].stacks);

            console.log(`[ItemManager] Stacked ${itemDef.name} (x${this.items[itemId].stacks})`);
        } else {
            // New item
            this.items[itemId] = {
                definition: itemDef,
                stacks: 1
            };

            // Apply effect
            itemDef.applyEffect(this.player, 1);

            // Track discovery
            if (typeof SaveSystem !== 'undefined' && SaveSystem.discoverItem) {
                SaveSystem.discoverItem(itemId);
            }

            console.log(`[ItemManager] Acquired ${itemDef.name}`);
        }

        // Update player stats
        if (typeof this.player.updateEffectiveStats === 'function') {
            this.player.updateEffectiveStats();
        }

        return true;
    }

    // Remove item from inventory
    removeItem(itemId, stacksToRemove = 1) {
        if (!this.items[itemId]) return false;

        const item = this.items[itemId];
        const itemDef = item.definition;

        // Remove effect
        itemDef.removeEffect(this.player, item.stacks);

        // Decrease stacks
        item.stacks -= stacksToRemove;

        if (item.stacks <= 0) {
            // Remove item completely
            delete this.items[itemId];
            console.log(`[ItemManager] Removed ${itemDef.name}`);
        } else {
            // Re-apply effect with new stack count
            itemDef.applyEffect(this.player, item.stacks);
            console.log(`[ItemManager] Removed stack from ${itemDef.name} (x${item.stacks} remaining)`);
        }

        // Update player stats
        if (typeof this.player.updateEffectiveStats === 'function') {
            this.player.updateEffectiveStats();
        }

        return true;
    }

    // Get all items as array for display
    getItemsArray() {
        return Object.entries(this.items).map(([itemId, item]) => ({
            id: itemId,
            definition: item.definition,
            stacks: item.stacks,
            tooltip: item.definition.getTooltip(item.stacks)
        }));
    }

    // Get total item count (including stacks)
    getTotalItemCount() {
        return Object.values(this.items).reduce((sum, item) => sum + item.stacks, 0);
    }

    // Get unique item count (not including stacks)
    getUniqueItemCount() {
        return Object.keys(this.items).length;
    }

    // Clear all items (on death/run end)
    clearAllItems() {
        for (const itemId in this.items) {
            const item = this.items[itemId];
            item.definition.removeEffect(this.player, item.stacks);
        }
        this.items = {};

        // Update player stats
        if (typeof this.player.updateEffectiveStats === 'function') {
            this.player.updateEffectiveStats();
        }

        console.log('[ItemManager] Cleared all items');
    }

    // Serialize for multiplayer
    serialize() {
        const serialized = {};
        for (const [itemId, item] of Object.entries(this.items)) {
            serialized[itemId] = item.stacks;
        }
        return serialized;
    }

    // Deserialize from multiplayer
    deserialize(data) {
        this.clearAllItems();
        for (const [itemId, stacks] of Object.entries(data)) {
            for (let i = 0; i < stacks; i++) {
                this.addItem(itemId);
            }
        }
    }

    // Check if player has a specific item
    hasItem(itemId) {
        return this.items[itemId] !== undefined;
    }

    // Get stack count for a specific item
    getStackCount(itemId) {
        return this.items[itemId] ? this.items[itemId].stacks : 0;
    }
}
