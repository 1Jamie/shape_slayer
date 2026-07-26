const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadCompanionEnv() {
    const syncSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'game', 'ui', 'components', 'companionSync.js'), 'utf-8');

    class MockBroadcastChannel {
        constructor(name) {
            this.name = name;
            this.onmessage = null;
            MockBroadcastChannel.channels = MockBroadcastChannel.channels || new Map();
            if (!MockBroadcastChannel.channels.has(name)) {
                MockBroadcastChannel.channels.set(name, new Set());
            }
            MockBroadcastChannel.channels.get(name).add(this);
        }

        postMessage(data) {
            const set = MockBroadcastChannel.channels.get(this.name);
            if (set) {
                set.forEach(ch => {
                    if (ch !== this && typeof ch.onmessage === 'function') {
                        ch.onmessage({ data: JSON.parse(JSON.stringify(data)) });
                    }
                });
            }
        }

        close() {
            const set = MockBroadcastChannel.channels.get(this.name);
            if (set) set.delete(this);
        }
    }

    const localStorageStore = new Map();
    const mockLocalStorage = {
        setItem(k, v) { localStorageStore.set(k, v); },
        getItem(k) { return localStorageStore.get(k) || null; },
        removeItem(k) { localStorageStore.delete(k); }
    };

    const context = {
        window: {
            addEventListener: () => {}
        },
        BroadcastChannel: MockBroadcastChannel,
        localStorage: mockLocalStorage,
        console: console,
        Date: Date,
        getClassDescription: () => ({ baseStats: '10% Base Crit Chance' })
    };

    vm.createContext(context);
    vm.runInContext(syncSource, context, { filename: 'companionSync.js' });
    return {
        CompanionSync: context.window.CompanionSync,
        MockBroadcastChannel
    };
}

test('serializePlayerData extracts complete stats, gear, affixes and items', () => {
    const { CompanionSync } = loadCompanionEnv();

    const mockPlayer = {
        playerClass: 'square',
        level: 5,
        hp: 80,
        maxHp: 120,
        damage: 42.5,
        defense: 0.15,
        moveSpeed: 340,
        critChance: 0.25,
        critDamageMultiplier: 1.75,
        lifesteal: 0.05,
        maxDodgeCharges: 2,
        pierceCount: 1,
        getEquippedGear(slot) {
            if (slot === 'weapon') {
                return {
                    name: 'Blade of Fury',
                    tier: 'purple',
                    slot: 'weapon',
                    color: '#9c27b0',
                    stats: { damage: 15.5 },
                    affixes: [
                        { type: 'critChance', value: 0.1, tier: 'rare' }
                    ],
                    classModifier: { class: 'square', description: '+20% Cleave Area' },
                    legendaryEffect: { description: 'Attacks trigger shockwaves' }
                };
            }
            return null;
        },
        itemManager: {
            getItemsArray() {
                return [
                    {
                        definition: { name: 'Health Potion', rarity: 'uncommon', description: 'Restores HP' },
                        stacks: 3,
                        tooltip: 'Restores HP over time'
                    }
                ];
            }
        }
    };

    const snapshot = CompanionSync.serializePlayerData(mockPlayer, 'p1');

    assert.strictEqual(snapshot.isSnapshot, true);
    assert.strictEqual(snapshot.seatId, 'p1');
    assert.strictEqual(snapshot.playerClass, 'square');
    assert.strictEqual(snapshot.level, 5);
    assert.strictEqual(snapshot.hp, 80);
    assert.strictEqual(snapshot.maxHp, 120);
    assert.strictEqual(snapshot.damage, 42.5);
    assert.strictEqual(snapshot.critChance, 0.25);
    assert.strictEqual(snapshot.equippedGear.weapon.name, 'Blade of Fury');
    assert.strictEqual(snapshot.equippedGear.weapon.tier, 'purple');
    assert.strictEqual(snapshot.equippedGear.weapon.affixes[0].type, 'critChance');
    assert.strictEqual(snapshot.items[0].name, 'Health Potion');
    assert.strictEqual(snapshot.items[0].stacks, 3);
});

test('CompanionSync throttles rapid tick calls to 5Hz max interval', () => {
    const { CompanionSync } = loadCompanionEnv();

    let broadcastCount = 0;
    const unsub = CompanionSync.subscribe(() => {
        broadcastCount++;
    });

    CompanionSync.tick(true); // force first
    const countAfterFirst = broadcastCount;

    // Rapid ticks within 50ms should be ignored by throttle
    CompanionSync.tick(false);
    CompanionSync.tick(false);
    CompanionSync.tick(false);

    assert.strictEqual(broadcastCount, countAfterFirst);

    unsub();
});
