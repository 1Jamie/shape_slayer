// Loot Selection System - Handles selecting and cycling through nearby gear
// Used by the gear tooltip renderer and input system

const LootSelection = {
    selectedIndex: 0,
    nearbyItems: [],
    lastUpdateFrame: 0,

    // Update list of nearby items
    updateNearbyItems: function (player) {
        // Optimization: Don't update more than once per frame
        if (typeof Game !== 'undefined' && Game.frameCount === this.lastUpdateFrame) {
            return;
        }
        if (typeof Game !== 'undefined') {
            this.lastUpdateFrame = Game.frameCount;
        }

        if (!player || !window.groundLoot) {
            this.nearbyItems = [];
            return;
        }

        // Find items within range (use 60px to match interaction range + buffer)
        // Interaction range is typically 50px
        const range = 60;

        this.nearbyItems = window.groundLoot.filter(gear => {
            const dx = gear.x - player.x;
            const dy = gear.y - player.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            return distance < range;
        });

        // Sort by distance to player
        this.nearbyItems.sort((a, b) => {
            const distA = Math.sqrt(Math.pow(a.x - player.x, 2) + Math.pow(a.y - player.y, 2));
            const distB = Math.sqrt(Math.pow(b.x - player.x, 2) + Math.pow(b.y - player.y, 2));
            return distA - distB;
        });

        // Clamp index if list changed size
        if (this.nearbyItems.length === 0) {
            this.selectedIndex = 0;
        } else if (this.selectedIndex >= this.nearbyItems.length) {
            this.selectedIndex = 0; // Reset to closest if list changes significantly
        }
    },

    // Get the currently selected gear item
    getSelectedGear: function () {
        if (this.nearbyItems.length === 0) return null;

        // Safety check
        if (this.selectedIndex >= this.nearbyItems.length) {
            this.selectedIndex = 0;
        }

        return this.nearbyItems[this.selectedIndex];
    },

    // Get count of nearby items
    getCount: function () {
        return this.nearbyItems.length;
    },

    // Cycle to next item
    cycleNext: function () {
        if (this.nearbyItems.length <= 1) return;
        this.selectedIndex = (this.selectedIndex + 1) % this.nearbyItems.length;
    },

    // Cycle to previous item
    cyclePrevious: function () {
        if (this.nearbyItems.length <= 1) return;
        this.selectedIndex = (this.selectedIndex - 1 + this.nearbyItems.length) % this.nearbyItems.length;
    },

    // Reset selection
    reset: function () {
        this.selectedIndex = 0;
        this.nearbyItems = [];
    }
};

// Expose globally
window.LootSelection = LootSelection;
