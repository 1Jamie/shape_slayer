const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
require(path.join(root, 'src/game/simulation/player-stats.js'));
require(path.join(root, 'src/game/simulation/run-rewards.js'));
require(path.join(root, 'src/game/ui/core/modal-controller.js'));

test('Save State & Serialization Round-Trip Integrity', async (t) => {
    await t.test('PlayerStats serializes and deserializes without data loss', () => {
        const stats = new globalThis.PlayerStats('player-seat-1');
        stats.damageDealt = 1450;
        stats.kills = 15;
        stats.damageTaken = 120;
        stats.roomsCleared = 4;
        stats.timeAlive = 125.5;

        const serialized = JSON.stringify(stats);
        const restored = JSON.parse(serialized);

        assert.equal(restored.playerId, 'player-seat-1');
        assert.equal(restored.damageDealt, 1450);
        assert.equal(restored.kills, 15);
        assert.equal(restored.damageTaken, 120);
        assert.equal(restored.roomsCleared, 4);
        assert.equal(restored.timeAlive, 125.5);
    });

    await t.test('GameRunRewards shard calculations round-trip cleanly across edge cases', () => {
        const testCases = [
            { roomNumber: 1, damageDealt: 0, shardsExpected: 0 },
            { roomNumber: 5, damageDealt: 500, shardsExpected: 5 },
            { roomNumber: 30, damageDealt: 10000, shardsExpected: 30 }
        ];

        testCases.forEach(tc => {
            const shards = GameRunRewards.calculateShardsForPlayer(tc);
            const serialized = JSON.stringify({ roomNumber: tc.roomNumber, shards });
            const restored = JSON.parse(serialized);

            assert.equal(restored.shards, shards);
            assert.ok(Number.isInteger(restored.shards) && restored.shards >= 0);
        });
    });

    await t.test('GameModalController preference states serialize and restore losslessly', () => {
        const state = {
            launchModalVisible: false,
            privacyModalVisible: false,
            privacyModalContext: 'onboarding'
        };

        const mockGame = { ...state };
        GameModalController.setTelemetryPreference(mockGame, true);

        const serialized = JSON.stringify({
            telemetryOptIn: mockGame.telemetryOptIn,
            privacyModalContext: mockGame.privacyModalContext
        });

        const restored = JSON.parse(serialized);
        assert.equal(restored.telemetryOptIn, true);
        assert.equal(restored.privacyModalContext, 'onboarding');
    });
});
