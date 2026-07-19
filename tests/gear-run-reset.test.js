/**
 * Regression: run gear + ground-loot tooltip must clear on return-to-nexus /
 * between-run start. Checkpoint exit keeps equipped gear but still hides loot UI.
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadLootSelection() {
    const code = fs.readFileSync(path.join(__dirname, '../src/game/content/loot-selection.js'), 'utf8');
    const sandbox = {
        console,
        window: { groundLoot: [] },
        Math,
        Array,
        Object
    };
    sandbox.window = Object.assign(sandbox.window, sandbox);
    vm.runInNewContext(code, sandbox);
    return sandbox.LootSelection || sandbox.window.LootSelection;
}

function makePlayerWithGear() {
    return {
        weapon: { id: 'w1', slot: 'weapon' },
        armor: { id: 'a1', slot: 'armor' },
        accessory: { id: 'x1', slot: 'accessory' },
        statsUpdated: 0,
        visualsUpdated: 0,
        clearEquippedGear() {
            this.weapon = null;
            this.armor = null;
            this.accessory = null;
            this.statsUpdated += 1;
            this.visualsUpdated += 1;
        }
    };
}

function makeGameHarness(overrides = {}) {
    const LootSelection = loadLootSelection();
    const tooltip = {
        isVisible: true,
        hideCalls: 0,
        hide() {
            this.isVisible = false;
            this.hideCalls += 1;
        }
    };

    const game = {
        player: makePlayerWithGear(),
        localSplitEnabled: false,
        localSplitPlayerId: 'local-seat-1',
        multiplayerEnabled: false,
        remotePlayerInstances: new Map(),
        isHost() { return false; },
        clearRunEquippedGear() {
            const clearOne = (player) => {
                if (player && typeof player.clearEquippedGear === 'function') {
                    player.clearEquippedGear();
                }
            };
            clearOne(this.player);
            if (this.localSplitEnabled && this.remotePlayerInstances) {
                clearOne(this.remotePlayerInstances.get(this.localSplitPlayerId));
            }
            if (this.multiplayerEnabled && this.isHost() && this.remotePlayerInstances) {
                this.remotePlayerInstances.forEach((playerInstance, playerId) => {
                    if (playerId === this.localSplitPlayerId) return;
                    clearOne(playerInstance);
                });
            }
        },
        hideGroundLootUi() {
            LootSelection.reset();
            tooltip.hide();
        },
        ...overrides
    };

    return { game, LootSelection, tooltip };
}

describe('gear run reset', () => {
    it('LootSelection.reset clears nearby selection for both seats', () => {
        const LootSelection = loadLootSelection();
        LootSelection.seats.p1.nearbyItems = [{ id: 'g1' }];
        LootSelection.seats.p1.selectedIndex = 2;
        LootSelection.seats.p2.nearbyItems = [{ id: 'g2' }];
        LootSelection.seats.p2.selectedIndex = 1;

        LootSelection.reset();

        assert.equal(LootSelection.seats.p1.nearbyItems.length, 0);
        assert.equal(LootSelection.seats.p1.selectedIndex, 0);
        assert.equal(LootSelection.seats.p2.nearbyItems.length, 0);
        assert.equal(LootSelection.seats.p2.selectedIndex, 0);
    });

    it('clearRunEquippedGear strips local and local-coop gear', () => {
        const p2 = makePlayerWithGear();
        const { game } = makeGameHarness({
            localSplitEnabled: true,
            remotePlayerInstances: new Map([['local-seat-1', p2]])
        });

        game.clearRunEquippedGear();

        assert.equal(game.player.weapon, null);
        assert.equal(game.player.armor, null);
        assert.equal(game.player.accessory, null);
        assert.equal(p2.weapon, null);
        assert.equal(p2.armor, null);
        assert.equal(p2.accessory, null);
        assert.ok(game.player.statsUpdated > 0);
        assert.ok(game.player.visualsUpdated > 0);
    });

    it('hideGroundLootUi resets selection and hides sticky tooltip', () => {
        const { game, LootSelection, tooltip } = makeGameHarness();
        LootSelection.seats.p1.nearbyItems = [{ id: 'stuck' }];
        LootSelection.seats.p1.selectedIndex = 0;
        tooltip.isVisible = true;

        game.hideGroundLootUi();

        assert.equal(LootSelection.seats.p1.nearbyItems.length, 0);
        assert.equal(tooltip.isVisible, false);
        assert.equal(tooltip.hideCalls, 1);
    });

    it('checkpoint-style exit clears loot UI but can keep equipped gear', () => {
        const { game, LootSelection, tooltip } = makeGameHarness();
        LootSelection.seats.p1.nearbyItems = [{ id: 'stuck' }];

        // Mimic exitToNexusWithCheckpoint: hide UI, do not clear gear
        game.hideGroundLootUi();

        assert.equal(game.player.weapon.id, 'w1');
        assert.equal(LootSelection.seats.p1.nearbyItems.length, 0);
        assert.equal(tooltip.isVisible, false);
    });
});
