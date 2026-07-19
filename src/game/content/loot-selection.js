// Loot Selection System - Handles selecting and cycling through nearby gear
// Used by the gear tooltip renderer and input system

function createLootSeatState() {
    return {
        selectedIndex: 0,
        nearbyItems: [],
        lastUpdateFrame: -1
    };
}

const LootSelection = {
    // Per-seat selection so P1/P2 can target different nearby piles in local co-op.
    seats: {
        p1: createLootSeatState(),
        p2: createLootSeatState()
    },

    _seat(seatId = 'p1') {
        const key = seatId === 'p2' ? 'p2' : 'p1';
        if (!this.seats[key]) this.seats[key] = createLootSeatState();
        return this.seats[key];
    },

    // Legacy getters used by existing UI (P1 / primary seat).
    get selectedIndex() { return this._seat('p1').selectedIndex; },
    set selectedIndex(value) { this._seat('p1').selectedIndex = value; },
    get nearbyItems() { return this._seat('p1').nearbyItems; },
    set nearbyItems(value) { this._seat('p1').nearbyItems = value; },

    // Update list of nearby items
    updateNearbyItems: function (player, seatId = 'p1') {
        const seat = this._seat(seatId);
        // Optimization: Don't update more than once per frame per seat
        if (typeof Game !== 'undefined' && Game.frameCount === seat.lastUpdateFrame) {
            return;
        }
        if (typeof Game !== 'undefined') {
            seat.lastUpdateFrame = Game.frameCount;
        }

        if (!player || !window.groundLoot) {
            seat.nearbyItems = [];
            return;
        }

        // Find items within range (use 60px to match interaction range + buffer)
        // Interaction range is typically 50px
        const range = 60;

        seat.nearbyItems = window.groundLoot.filter(gear => {
            const dx = gear.x - player.x;
            const dy = gear.y - player.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            return distance < range;
        });

        // Sort by distance to player
        seat.nearbyItems.sort((a, b) => {
            const distA = Math.sqrt(Math.pow(a.x - player.x, 2) + Math.pow(a.y - player.y, 2));
            const distB = Math.sqrt(Math.pow(b.x - player.x, 2) + Math.pow(b.y - player.y, 2));
            return distA - distB;
        });

        // Clamp index if list changed size
        if (seat.nearbyItems.length === 0) {
            seat.selectedIndex = 0;
        } else if (seat.selectedIndex >= seat.nearbyItems.length) {
            seat.selectedIndex = 0; // Reset to closest if list changes significantly
        }
    },

    // Get the currently selected gear item
    getSelectedGear: function (seatId = 'p1') {
        const seat = this._seat(seatId);
        if (seat.nearbyItems.length === 0) return null;

        // Safety check
        if (seat.selectedIndex >= seat.nearbyItems.length) {
            seat.selectedIndex = 0;
        }

        return seat.nearbyItems[seat.selectedIndex];
    },

    // Get count of nearby items
    getCount: function (seatId = 'p1') {
        return this._seat(seatId).nearbyItems.length;
    },

    // Cycle to next item
    cycleNext: function (seatId = 'p1') {
        const seat = this._seat(seatId);
        if (seat.nearbyItems.length <= 1) return;
        seat.selectedIndex = (seat.selectedIndex + 1) % seat.nearbyItems.length;
    },

    // Cycle to previous item
    cyclePrevious: function (seatId = 'p1') {
        const seat = this._seat(seatId);
        if (seat.nearbyItems.length <= 1) return;
        seat.selectedIndex = (seat.selectedIndex - 1 + seat.nearbyItems.length) % seat.nearbyItems.length;
    },

    // Reset selection
    reset: function (seatId = null) {
        if (seatId) {
            this.seats[seatId === 'p2' ? 'p2' : 'p1'] = createLootSeatState();
            return;
        }
        this.seats.p1 = createLootSeatState();
        this.seats.p2 = createLootSeatState();
    }
};

// Expose globally
window.LootSelection = LootSelection;
